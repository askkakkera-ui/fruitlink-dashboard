import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const sbH = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json', Prefer: 'return=representation', ...extra,
});
const NO_STORE = { 'Cache-Control': 'no-store' };

const PERMISSION_KEYS = [
  'can_view_console', 'can_view_orders', 'can_view_alerts', 'can_view_fleet_map',
  'can_view_warehouse', 'can_view_reports', 'can_view_field_staff', 'can_view_attendance',
  'can_view_notify_config', 'can_view_comm_log', 'can_edit_machine_config',
  'can_manage_field_staff', 'can_manage_locations', 'can_edit_office_location', 'can_export_data',
];

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

// GET /api/operator-permissions?operator_id= — get permissions for an operator
// GET /api/operator-permissions?my=1 — get own permissions (operator use)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    let operatorId: string;

    if (request.nextUrl.searchParams.get('my') === '1') {
      // Operator reading own permissions
      operatorId = String(session.sub);
    } else {
      // Super admin reading any operator's permissions
      if (session.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
      operatorId = request.nextUrl.searchParams.get('operator_id') || '';
      if (!operatorId) {
        // Return all operators with their permissions — bulk fetch
        const [opsRes, permsRes] = await Promise.all([
          fetch(SB_URL + '/rest/v1/operators?select=id,name,email,role&role=neq.super_admin&order=name.asc', { headers: sbH() }),
          fetch(SB_URL + '/rest/v1/operator_permissions?select=*', { headers: sbH() }),
        ]);
        const [ops, perms] = await Promise.all([opsRes.json(), permsRes.json()]);
        const permsByOp: Record<string, any> = {};
        (Array.isArray(perms) ? perms : []).forEach((p: any) => { permsByOp[p.operator_id] = p; });
        const result = (Array.isArray(ops) ? ops : []).map((op: any) => ({
          ...op,
          permissions: permsByOp[op.id] || null,
        }));
        return NextResponse.json(result, { headers: NO_STORE });
      }
    }

    const res = await fetch(
      SB_URL + '/rest/v1/operator_permissions?select=*&operator_id=eq.' + encodeURIComponent(operatorId) + '&limit=1',
      { headers: sbH() }
    );
    const rows = await res.json();
    return NextResponse.json(Array.isArray(rows) && rows[0] ? rows[0] : null, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// PUT /api/operator-permissions — upsert permissions (super admin only)
// Body: { operator_id, permissions: { can_view_reports: true, ... } }
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    const body = await request.json().catch(() => ({}));
    const operator_id = String(body.operator_id || '');
    if (!operator_id) return NextResponse.json({ error: 'operator_id required' }, { status: 400, headers: NO_STORE });

    const permissions = body.permissions || {};

    // Validate only known permission keys
    const patch: Record<string, any> = { operator_id, updated_at: new Date().toISOString() };
    for (const key of PERMISSION_KEYS) {
      if (permissions[key] !== undefined) {
        patch[key] = permissions[key] === true || permissions[key] === 'true';
      }
    }

    // Check if record exists
    const existsRes = await fetch(
      SB_URL + '/rest/v1/operator_permissions?select=operator_id&operator_id=eq.' + encodeURIComponent(operator_id) + '&limit=1',
      { headers: sbH() }
    );
    const existing = await existsRes.json();

    let res;
    if (Array.isArray(existing) && existing[0]) {
      // Update
      res = await fetch(SB_URL + '/rest/v1/operator_permissions?operator_id=eq.' + encodeURIComponent(operator_id), {
        method: 'PATCH', headers: sbH(),
        body: JSON.stringify(patch),
      });
    } else {
      // Insert with defaults
      res = await fetch(SB_URL + '/rest/v1/operator_permissions', {
        method: 'POST', headers: sbH(),
        body: JSON.stringify(patch),
      });
    }

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'Save failed', detail: data }, { status: 500, headers: NO_STORE });

    return NextResponse.json({ success: true, permissions: Array.isArray(data) ? data[0] : data }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
