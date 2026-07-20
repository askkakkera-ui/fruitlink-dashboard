import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { loadEntitlements, countTeam, atLimit, limitMessage } from '@/lib/entitlements';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || ''; // service key only — never anon
const sbH = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const NO_STORE = { 'Cache-Control': 'no-store' };

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

// GET /api/my-team
// Returns the sub_operators and field_staff belonging to the calling operator,
// each enriched with their current permission flags, plus the operator's plan
// entitlements and current seat usage.
// super_admin may pass ?owner_id=<id> to inspect any operator's team.
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    let parentId: string;
    if (session.role === 'super_admin') {
      parentId = request.nextUrl.searchParams.get('owner_id') || '';
      if (!parentId) return NextResponse.json({ error: 'owner_id required' }, { status: 400, headers: NO_STORE });
    } else if (session.role === 'operator') {
      parentId = String(session.sub);
    } else {
      // sub_operator and field_staff have no team
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }

    // Bulk fetch: team members + my own permissions (the grant ceiling) + plan
    // entitlements, in parallel
    const [teamRes, myPermRes, ent] = await Promise.all([
      fetch(
        SB_URL + '/rest/v1/operators?select=id,name,email,phone,role,state,country,created_at' +
        '&owner_id=eq.' + encodeURIComponent(parentId) + '&deleted_at=is.null&order=created_at.desc',
        { headers: sbH() }
      ),
      fetch(
        SB_URL + '/rest/v1/operator_permissions?select=*&operator_id=eq.' + encodeURIComponent(parentId) + '&limit=1',
        { headers: sbH() }
      ),
      loadEntitlements(parentId),
    ]);

    const team = await teamRes.json();
    const myPermRows = await myPermRes.json();
    const myPermissions = Array.isArray(myPermRows) && myPermRows[0] ? myPermRows[0] : null;

    const list = Array.isArray(team) ? team : [];
    // Usage is counted from the rows we just read, so the number the UI gates on
    // is the same number the list shows.
    const usage = {
      field_staff: list.filter((t: any) => t.role === 'field_staff').length,
      sub_operators: list.filter((t: any) => t.role === 'sub_operator').length,
    };
    const entitlements = ent ? ent.entitlements : null;

    if (list.length === 0) {
      return NextResponse.json({ team: [], my_permissions: myPermissions, entitlements, usage }, { headers: NO_STORE });
    }

    // One bulk query for every team member's permissions — no N+1
    const ids = list.map((t: any) => t.id);
    const permRes = await fetch(
      SB_URL + '/rest/v1/operator_permissions?select=*&operator_id=in.(' + ids.map(encodeURIComponent).join(',') + ')',
      { headers: sbH() }
    );
    const permRows = await permRes.json();

    const permByOp: Record<string, any> = {};
    (Array.isArray(permRows) ? permRows : []).forEach((p: any) => { permByOp[p.operator_id] = p; });

    const enriched = list.map((t: any) => ({ ...t, permissions: permByOp[t.id] || null }));

    return NextResponse.json({ team: enriched, my_permissions: myPermissions, entitlements, usage }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// ── Field-staff self-service writes ───────────────────────────────────
// The UI hides the Add button when the plan says no; that is a courtesy, not a
// control. Everything below is enforced here, from the session and the plans
// table, and nothing about the tenant is taken from the request body:
//
//   (a) the caller must be an `operator` whose plan has_team_management,
//   (b) they must be under their effective field-staff limit,
//   (c) owner_id is stamped with the session's own id and role is forced to
//       'field_staff' — an operator cannot create staff under another tenant,
//       nor mint a sub_operator/super_admin through this door.
//
// operators is super_admin-only in /api/sb's WRITE_RULES and stays that way:
// this route is the single sanctioned path for an operator to touch it, the
// same shape as /api/operator-permissions.

// Passwords are bcrypt-hashed by /api/hash-password before they ever reach a
// write route (same as register / OperatorsPage / MyStaffSection). Reject
// anything that is not a bcrypt digest so a plaintext password can never be
// written into password_hash by a mistaken or hand-rolled client.
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Fetch a team member and prove they are this operator's own field staff.
async function ownFieldStaff(id: string, ownerId: string): Promise<any | null> {
  const res = await fetch(
    SB_URL + '/rest/v1/operators?select=id,name,email,phone,role,owner_id&id=eq.' + encodeURIComponent(id) +
    '&deleted_at=is.null&limit=1',
    { headers: sbH() }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) return null;
  if (String(row.owner_id || '') !== String(ownerId)) return null;
  if (String(row.role || '') !== 'field_staff') return null;
  return row;
}

// Common gate for every write below: an operator with team management on their
// plan. Returns the operator id to scope by, or a response to return as-is.
async function requireTeamManager(session: any): Promise<{ ownerId: string; entitlements: any } | NextResponse> {
  if (session.role !== 'operator') {
    return NextResponse.json({ error: 'Only an operator can manage their own field staff' }, { status: 403, headers: NO_STORE });
  }
  const ownerId = String(session.sub);
  const ent = await loadEntitlements(ownerId);
  if (!ent) return NextResponse.json({ error: 'Operator not found' }, { status: 403, headers: NO_STORE });
  if (!ent.entitlements.has_team_management) {
    return NextResponse.json(
      { error: 'Your plan does not include team management. Contact Fruitlink to upgrade.' },
      { status: 403, headers: NO_STORE }
    );
  }
  return { ownerId, entitlements: ent.entitlements };
}

// POST /api/my-team — create a field staff member under the calling operator
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const gate = await requireTeamManager(session);
    if (gate instanceof NextResponse) return gate;
    const { ownerId, entitlements } = gate;

    // Seat check against the live count, never a client-supplied one. (Two
    // simultaneous creates could both read the same count; PostgREST gives us
    // no transaction here, so the worst case is one seat over — visible on the
    // next load, and not a privilege boundary.)
    const used = await countTeam(ownerId);
    if (atLimit(used.field_staff, entitlements.field_staff_limit)) {
      return NextResponse.json(
        { error: limitMessage('field staff', entitlements.field_staff_limit), limit: entitlements.field_staff_limit, used: used.field_staff },
        { status: 403, headers: NO_STORE }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const password_hash = String(body.password_hash || '');
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: NO_STORE });
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: NO_STORE });
    if (!BCRYPT_RE.test(password_hash)) {
      return NextResponse.json({ error: 'A password is required' }, { status: 400, headers: NO_STORE });
    }

    const row = {
      name, email, phone: phone || null, password_hash,
      role: 'field_staff',   // forced: this endpoint creates field staff, nothing else
      owner_id: ownerId,     // forced: the authenticated operator, never the body
    };

    const res = await fetch(SB_URL + '/rest/v1/operators', {
      method: 'POST', headers: { ...sbH(), Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = typeof data?.message === 'string' ? data.message : '';
      const msg = /duplicate|unique/i.test(detail) ? 'That email is already in use' : 'Could not create field staff';
      return NextResponse.json({ error: msg, detail }, { status: res.status === 409 ? 409 : 400, headers: NO_STORE });
    }

    const created = Array.isArray(data) ? data[0] : data;
    await logAudit({
      session, action: 'create', module: 'my_team', entity_table: 'operators',
      entity_id: created?.id ? String(created.id) : null,
      old_value: null, new_value: { ...created, password_hash: undefined },
      owner_id: ownerId, req: request,
    });

    return NextResponse.json({ success: true, member: { ...created, password_hash: undefined } }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// PATCH /api/my-team?id= — edit one of the calling operator's field staff
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const gate = await requireTeamManager(session);
    if (gate instanceof NextResponse) return gate;
    const { ownerId } = gate;

    const id = request.nextUrl.searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: NO_STORE });
    const before = await ownFieldStaff(id, ownerId);
    if (!before) return NextResponse.json({ error: 'Not your field staff' }, { status: 403, headers: NO_STORE });

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, any> = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: NO_STORE });
      patch.name = name;
    }
    if (body.phone != null) patch.phone = String(body.phone).trim() || null;
    if (body.password_hash) {
      if (!BCRYPT_RE.test(String(body.password_hash))) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 400, headers: NO_STORE });
      }
      patch.password_hash = String(body.password_hash);
    }
    // email, role and owner_id are not editable here: changing any of them
    // would move the account between identities or tenants.
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400, headers: NO_STORE });
    }

    const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: { ...sbH(), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'Could not update field staff', detail: data }, { status: 400, headers: NO_STORE });

    const after = Array.isArray(data) ? data[0] : data;
    await logAudit({
      session, action: 'update', module: 'my_team', entity_table: 'operators', entity_id: String(id),
      old_value: before, new_value: { ...after, password_hash: undefined },
      owner_id: ownerId, req: request,
    });

    return NextResponse.json({ success: true, member: { ...after, password_hash: undefined } }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// DELETE /api/my-team?id= — soft-delete one of the calling operator's field staff.
// Soft, like every other operators delete (see SOFT_DELETE_TABLES in /api/sb):
// their visits and attendance rows still point at this id and must keep resolving.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const gate = await requireTeamManager(session);
    if (gate instanceof NextResponse) return gate;
    const { ownerId } = gate;

    const id = request.nextUrl.searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: NO_STORE });
    const before = await ownFieldStaff(id, ownerId);
    if (!before) return NextResponse.json({ error: 'Not your field staff' }, { status: 403, headers: NO_STORE });

    const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: { ...sbH(), Prefer: 'return=minimal' },
      body: JSON.stringify({ deleted_at: new Date().toISOString(), updated_by: String(session.sub) }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json({ error: 'Could not remove field staff', detail }, { status: 400, headers: NO_STORE });
    }

    await logAudit({
      session, action: 'delete', module: 'my_team', entity_table: 'operators', entity_id: String(id),
      old_value: before, new_value: null, owner_id: ownerId, req: request,
    });

    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
