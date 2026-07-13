import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const NO_STORE = { 'Cache-Control': 'no-store' };
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
    const params = request.nextUrl.searchParams;

    // Check if staff is currently checked in (open attendance)
    if (params.get('current') === '1') {
      const staffId = String(session.sub);
      const url = SB_URL + '/rest/v1/attendance?select=*&staff_id=eq.' + encodeURIComponent(staffId) + '&check_out_at=is.null&order=check_in_at.desc&limit=1';
      const res = await fetch(url, { headers: sbHeaders() });
      const data = await res.json();
      return NextResponse.json(Array.isArray(data) && data[0] ? data[0] : null, { headers: NO_STORE });
    }

    // Report: super_admin/operator gets attendance in date range
    if (params.get('report') === '1') {
      if (session.role !== 'super_admin' && session.role !== 'operator' && session.role !== 'sub_operator') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
      }
      let url = SB_URL + '/rest/v1/attendance?select=*&order=check_in_at.desc&limit=500';
      const from = params.get('from');
      const to = params.get('to');
      const staffId = params.get('staff_id');
      const machineId = params.get('machine_id');
      if (from) url += '&check_in_at=gte.' + encodeURIComponent(from);
      if (to) url += '&check_in_at=lte.' + encodeURIComponent(to);
      if (staffId && staffId !== 'all') url += '&staff_id=eq.' + encodeURIComponent(staffId);
      if (machineId && machineId !== 'all') url += '&machine_id=eq.' + encodeURIComponent(machineId);
      // Scope attendance to the tenant
      if (session.role === 'operator') {
        // Operator sees all staff under them (their id IS the owner_id on staff records)
        url += '&owner_id=eq.' + encodeURIComponent(String(session.sub));
      } else if (session.role === 'sub_operator') {
        // Sub-operator sees same tenant as their parent operator
        const ownerId = session.owner_id ? String(session.owner_id) : String(session.sub);
        url += '&owner_id=eq.' + encodeURIComponent(ownerId);
      }
      const res = await fetch(url, { headers: sbHeaders() });
      const rows = await res.json();
      if (!Array.isArray(rows)) return NextResponse.json([], { headers: NO_STORE });
      // resolve staff names
      const staffIds = Array.from(new Set(rows.map((r: any) => r.staff_id).filter(Boolean)));
      const machineIds = Array.from(new Set(rows.map((r: any) => r.machine_id).filter(Boolean)));
      let names: Record<string, string> = {};
      let mnames: Record<string, string> = {};
      if (staffIds.length) {
        const inList = '(' + staffIds.map(encodeURIComponent).join(',') + ')';
        const nr = await fetch(SB_URL + '/rest/v1/operators?select=id,name,email&id=in.' + inList, { headers: sbHeaders() }).then(r => r.json());
        (Array.isArray(nr) ? nr : []).forEach((o: any) => { names[o.id] = o.name || o.email || String(o.id).slice(0, 6); });
      }
      if (machineIds.length) {
        const inList = '(' + machineIds.map(encodeURIComponent).join(',') + ')';
        const mr = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name&id=in.' + inList, { headers: sbHeaders() }).then(r => r.json());
        (Array.isArray(mr) ? mr : []).forEach((m: any) => { mnames[m.id] = m.display_name || String(m.id).slice(0, 8); });
      }
      const withNames = rows.map((r: any) => ({
        ...r,
        staff_name: names[r.staff_id] || '—',
        machine_name: r.machine_id ? (mnames[r.machine_id] || '—') : 'Office',
      }));
      return NextResponse.json(withNames, { headers: NO_STORE });
    }

    return NextResponse.json({ error: 'Invalid params' }, { status: 400, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    // Operators and sub-operators were silently refused here with a bare 403,
    // which the UI rendered as "Check in failed" with no hint why. Attendance is
    // a record, not a privilege — anyone who can reach the visit page may check in.
    if (session.role !== 'field_staff' && session.role !== 'super_admin'
        && session.role !== 'operator' && session.role !== 'sub_operator') {
      return NextResponse.json({ error: 'Your role cannot check in (' + session.role + ')' }, { status: 403, headers: NO_STORE });
    }
    const body = await request.json().catch(() => ({}));
    const staffId = String(session.sub);
    // Check if already checked in
    const existing = await fetch(SB_URL + '/rest/v1/attendance?select=id&staff_id=eq.' + encodeURIComponent(staffId) + '&check_out_at=is.null&limit=1', { headers: sbHeaders() }).then(r => r.json());
    if (Array.isArray(existing) && existing[0]) {
      // Already checked in. The guided flow calls this idempotently, so hand back
      // the open row rather than treating it as an error the UI must recover from.
      return NextResponse.json({ already_open: true, id: existing[0].id }, { status: 200, headers: NO_STORE });
    }
    const VALID_VERDICTS = ['inside', 'outside', 'uncertain', 'unknown'];
    const verdict = VALID_VERDICTS.includes(String(body.geofence_verdict)) ? String(body.geofence_verdict) : null;

    const row = {
      staff_id: staffId,
      owner_id: session.owner_id || null,
      machine_id: body.machine_id ? String(body.machine_id) : null,
      location_id: body.location_id ? String(body.location_id) : null,
      visit_mode: (body.visit_mode === 'office' || body.visit_mode === 'machine') ? body.visit_mode : null,
      check_in_at: new Date().toISOString(),
      check_in_lat: body.lat != null ? parseFloat(body.lat) : null,
      check_in_lng: body.lng != null ? parseFloat(body.lng) : null,
      check_in_address: body.address ? String(body.address).slice(0, 500) : null,
      // Geofence is evidence, not a gate: we record what we saw and move on.
      gps_accuracy_m: (body.gps_accuracy_m != null && !isNaN(parseInt(body.gps_accuracy_m))) ? parseInt(body.gps_accuracy_m) : null,
      distance_meters: (body.distance_meters != null && !isNaN(parseInt(body.distance_meters))) ? parseInt(body.distance_meters) : null,
      geofence_verdict: verdict,
      override_reason: body.override_reason ? String(body.override_reason).slice(0, 500) : null,
    };
    const res = await fetch(SB_URL + '/rest/v1/attendance', { method: 'POST', headers: sbHeaders(), body: JSON.stringify(row) });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: JSON.stringify(data) }, { status: res.status, headers: NO_STORE });
    return NextResponse.json(Array.isArray(data) ? data[0] : data, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_STORE });

    // Ownership: a staff member may only close their OWN open attendance row.
    // Without this, anyone holding a row id could check another person out.
    const ownRes = await fetch(
      SB_URL + '/rest/v1/attendance?select=id,staff_id,check_out_at&id=eq.' + encodeURIComponent(id) + '&limit=1',
      { headers: sbHeaders() }
    );
    const ownRows = await ownRes.json();
    const row = Array.isArray(ownRows) ? ownRows[0] : null;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
    if (session.role !== 'super_admin' && String(row.staff_id) !== String(session.sub)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    if (row.check_out_at) {
      // Already closed. Idempotent: don't error, just report it.
      return NextResponse.json({ already_closed: true, id: row.id }, { headers: NO_STORE });
    }

    const body = await request.json().catch(() => ({}));
    const update = {
      check_out_at: new Date().toISOString(),
      check_out_lat: body.lat != null ? parseFloat(body.lat) : null,
      check_out_lng: body.lng != null ? parseFloat(body.lng) : null,
      check_out_address: body.address ? String(body.address).slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    };
    const res = await fetch(SB_URL + '/rest/v1/attendance?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(update) });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: JSON.stringify(data) }, { status: res.status, headers: NO_STORE });
    return NextResponse.json(Array.isArray(data) ? data[0] : data, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
