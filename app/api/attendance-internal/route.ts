import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

// Fruitlink INTERNAL-team attendance — a super_admin-only report that is a hard,
// server-side sibling of /api/attendance. It never serves tenant field-staff
// rows: the row set is scoped to the internal operators OWNED BY the Fruitlink
// super_admin account (role super_admin | staff, owner_id = Fruitlink). The
// shared /api/attendance route is deliberately left untouched; any tenant scoping
// there is its own concern. This route only ever sees the internal team.
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const NO_STORE = { 'Cache-Control': 'no-store' };

// The Fruitlink super_admin operator. The internal team is the set of operators
// this account owns. Overridable via env for non-prod; defaults to the prod id.
const FRUITLINK_OWNER_ID = process.env.FRUITLINK_OWNER_ID || '0c1bd083-682a-4913-ac37-08c85ef94b41';
// Mirrors INTERNAL_ROLES semantics: a person is "internal" by role, never by a
// team_name string. owner_id = Fruitlink is what excludes tenant staff.
const INTERNAL_ROLES = ['super_admin', 'staff'];

function sbHeaders() {
  return { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}
async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    // Super-admin only. No permission-key back door: this is the platform owner's
    // own team, not a delegated view.
    if (session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    const params = request.nextUrl.searchParams;

    // 1. Resolve the internal team: operators owned by Fruitlink with an internal
    //    role. Tenant field staff (owner_id = a tenant) can never enter this set.
    const internalRes = await fetch(
      SB_URL + '/rest/v1/operators?select=id&role=in.(' + INTERNAL_ROLES.join(',') + ')&owner_id=eq.' + encodeURIComponent(FRUITLINK_OWNER_ID),
      { headers: sbHeaders() },
    );
    const internalRows = internalRes.ok ? await internalRes.json() : [];
    const internalIds = Array.isArray(internalRows) ? internalRows.map((o: any) => o.id).filter(Boolean) : [];
    // No internal operators → nothing to show. Returning [] is safer than emitting
    // an empty in.() list, which PostgREST would reject.
    if (internalIds.length === 0) return NextResponse.json([], { headers: NO_STORE });

    // 2. Attendance for those staff only, within the requested window.
    let url = SB_URL + '/rest/v1/attendance?select=*&order=check_in_at.desc&limit=500';
    const from = params.get('from');
    const to = params.get('to');
    const staffId = params.get('staff_id');
    const machineId = params.get('machine_id');
    if (from) url += '&check_in_at=gte.' + encodeURIComponent(from);
    if (to) url += '&check_in_at=lte.' + encodeURIComponent(to);
    // A staff_id filter can only NARROW within the internal set — a caller can
    // never widen it to someone outside the team. Anything else falls back to the
    // whole internal set.
    if (staffId && staffId !== 'all' && internalIds.includes(staffId)) {
      url += '&staff_id=eq.' + encodeURIComponent(staffId);
    } else {
      url += '&staff_id=in.(' + internalIds.map(encodeURIComponent).join(',') + ')';
    }
    if (machineId && machineId !== 'all') url += '&machine_id=eq.' + encodeURIComponent(machineId);

    const res = await fetch(url, { headers: sbHeaders() });
    const rows = await res.json();
    if (!Array.isArray(rows)) return NextResponse.json([], { headers: NO_STORE });

    // 3. Enrich to the exact same row shape as /api/attendance so the page can
    //    render with the same components (staff/team/machine/tz metadata).
    const staffIds = Array.from(new Set(rows.map((r: any) => r.staff_id).filter(Boolean)));
    const machineIds = Array.from(new Set(rows.map((r: any) => r.machine_id).filter(Boolean)));
    let names: Record<string, string> = {};
    let mnames: Record<string, string> = {};
    let staffMeta: Record<string, { role: string; designation: string; employee_id?: string; staff_type?: string; owner_id?: string }> = {};
    let ownerNames: Record<string, string> = {};
    let ownerTz: Record<string, string> = {};
    if (staffIds.length) {
      const inList = '(' + staffIds.map(encodeURIComponent).join(',') + ')';
      const nr = await fetch(SB_URL + '/rest/v1/operators?select=id,name,email,role,designation,employee_id,staff_type,owner_id&id=in.' + inList, { headers: sbHeaders() }).then(r => r.json());
      (Array.isArray(nr) ? nr : []).forEach((o: any) => { names[o.id] = o.name || o.email || String(o.id).slice(0, 6); staffMeta[o.id] = { role: o.role, designation: o.designation, employee_id: o.employee_id, staff_type: o.staff_type, owner_id: o.owner_id }; });
      const ownerIds = Array.from(new Set([
        ...(Array.isArray(nr) ? nr : []).map((o: any) => o.owner_id),
        ...rows.map((r: any) => r.owner_id),
      ].filter(Boolean)));
      if (ownerIds.length) {
        const oInList = '(' + ownerIds.map(encodeURIComponent).join(',') + ')';
        const or = await fetch(SB_URL + '/rest/v1/operators?select=id,name,role,timezone&id=in.' + oInList, { headers: sbHeaders() }).then(r => r.json());
        (Array.isArray(or) ? or : []).forEach((o: any) => { ownerNames[o.id] = o.name || String(o.id).slice(0, 6); ownerTz[o.id] = o.timezone || 'Asia/Kolkata'; });
      }
    }
    if (machineIds.length) {
      const inList = '(' + machineIds.map(encodeURIComponent).join(',') + ')';
      const mr = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name&id=in.' + inList, { headers: sbHeaders() }).then(r => r.json());
      (Array.isArray(mr) ? mr : []).forEach((m: any) => { mnames[m.id] = m.display_name || String(m.id).slice(0, 8); });
    }
    const withNames = rows.map((r: any) => ({
      ...r,
      staff_name: names[r.staff_id] || '—',
      staff_role: staffMeta[r.staff_id]?.role || '',
      staff_designation: staffMeta[r.staff_id]?.designation || '',
      staff_employee_id: staffMeta[r.staff_id]?.employee_id || '',
      staff_type: staffMeta[r.staff_id]?.staff_type || '',
      // Internal staff (role 'staff') always render as the Fruitlink team.
      team_name: (staffMeta[r.staff_id]?.role === 'staff') ? 'Fruitlink' : (staffMeta[r.staff_id]?.owner_id ? (ownerNames[staffMeta[r.staff_id]!.owner_id!] || 'Operator') : '—'),
      machine_name: r.machine_id ? (mnames[r.machine_id] || '—') : 'Office',
      // Internal team is IST; anything unresolved falls back to Asia/Kolkata.
      tenant_timezone: (staffMeta[r.staff_id]?.role === 'staff')
        ? 'Asia/Kolkata'
        : (ownerTz[r.owner_id] || 'Asia/Kolkata'),
    }));
    return NextResponse.json(withNames, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
