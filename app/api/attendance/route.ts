import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const NO_STORE = { 'Cache-Control': 'no-store' };
// Fruitlink internal team — the EXACT set /api/attendance-internal serves
// (role∈INTERNAL_ROLES & owner_id=Fruitlink). The super_admin tenant-facing
// report below excludes this set so internal staff show only on Team Attendance.
// Kept byte-identical to attendance-internal so the two never drift.
const FRUITLINK_OWNER_ID = process.env.FRUITLINK_OWNER_ID || '0c1bd083-682a-4913-ac37-08c85ef94b41';
const INTERNAL_ROLES = ['super_admin', 'staff'];
function sbHeaders() {
  return { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}
async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

// Great-circle distance in metres between two WGS84 points (mirrors verify-gps).
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // mean Earth radius, metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Resolve which of the tenant's machines the staff physically checked in at,
// from the GPS fix — so machine_id is reliable regardless of what the client
// sent. The field-staff flow (LOCATION → CHECK IN → MACHINE) picks the machine
// AFTER check-in, so it always sends machine_id:null; the only thing that used
// to populate it was the visit-log backfill, which is why identical-GPS rows
// intermittently landed as "Office". This is TENANT-SCOPED via machine_operators
// — never another tenant's machine. A machine is accepted only when the fix sits
// within its location's geofence (accuracy-aware, mirroring verify-gps):
// distance - accuracy <= radius, with a 150m fallback when the location has no
// radius. Returns null when nothing qualifies — which correctly leaves "Office".
async function resolveMachineByGps(
  tenantId: string, lat: number, lng: number, accuracy: number,
): Promise<{ machine_id: string; location_id: string | null } | null> {
  // 1. The tenant's own machines (authoritative join), with coordinates.
  const moRes = await fetch(
    SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(tenantId),
    { headers: sbHeaders() },
  );
  if (!moRes.ok) return null;
  const moRows = await moRes.json();
  const ids = Array.isArray(moRows) ? moRows.map((r: any) => r.machine_id).filter(Boolean) : [];
  if (ids.length === 0) return null;
  const mInList = '(' + ids.map(encodeURIComponent).join(',') + ')';
  const mRes = await fetch(
    SB_URL + '/rest/v1/machines?select=id,location_id,location_lat,location_lng&id=in.' + mInList,
    { headers: sbHeaders() },
  );
  if (!mRes.ok) return null;
  const machines = await mRes.json();
  const withCoords = (Array.isArray(machines) ? machines : []).filter(
    (m: any) => m.location_lat != null && m.location_lng != null,
  );
  if (withCoords.length === 0) return null;

  // 2. Per-location geofence radius (150m fallback), one query for all locations.
  const locIds = Array.from(new Set(withCoords.map((m: any) => m.location_id).filter(Boolean)));
  const radiusById: Record<string, number> = {};
  if (locIds.length) {
    const lRes = await fetch(
      SB_URL + '/rest/v1/locations?select=id,geofence_radius_m&id=in.(' + locIds.map(encodeURIComponent).join(',') + ')',
      { headers: sbHeaders() },
    );
    if (lRes.ok) {
      const locs = await lRes.json();
      (Array.isArray(locs) ? locs : []).forEach((l: any) => { radiusById[l.id] = Number(l.geofence_radius_m) || 150; });
    }
  }

  // 3. Nearest machine whose geofence the fix falls inside (accuracy-aware).
  const acc = Math.max(0, accuracy || 0);
  let best: { machine_id: string; location_id: string | null; distance: number } | null = null;
  for (const m of withCoords) {
    const distance = haversineMetres(lat, lng, Number(m.location_lat), Number(m.location_lng));
    const radius = (m.location_id && radiusById[m.location_id]) || 150;
    if (distance - acc > radius) continue; // fix sits outside this machine's geofence
    if (!best || distance < best.distance) {
      best = { machine_id: String(m.id), location_id: m.location_id ? String(m.location_id) : null, distance };
    }
  }
  return best ? { machine_id: best.machine_id, location_id: best.location_id } : null;
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
      if (session.role !== 'super_admin' && session.role !== 'operator' && session.role !== 'sub_operator' && session.role !== 'staff') {
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
      // scope to owner if operator
      if (session.role === 'staff') {
        // Internal staff see only their own attendance
        url += '&staff_id=eq.' + encodeURIComponent(String(session.sub));
      } else if (session.role === 'operator' || session.role === 'sub_operator') {
        // A top-level operator IS the tenant: their own id is the owner id, and
        // session.owner_id is null. The old condition required owner_id to be
        // truthy, so it never fired for the only role that reaches it - and no
        // filter was applied at all. Fruitlinq's operator login could read
        // Fruitlink's attendance. Same rule as tenantOf() in visit/route.ts.
        const tenant = session.owner_id ? String(session.owner_id) : String(session.sub || '');
        if (!tenant) return NextResponse.json([], { headers: NO_STORE });
        url += '&owner_id=eq.' + encodeURIComponent(tenant);
      } else if (session.role === 'super_admin') {
        // Tenant-only: this page is Operator Management → Attendance. Exclude the
        // Fruitlink internal team — they belong on Team Attendance only. This is
        // the exact mirror of /api/attendance-internal: resolve the SAME
        // internalIds (role∈INTERNAL_ROLES & owner_id=Fruitlink) and negate with
        // not.in. PURE mirror — the super_admin's own row is NOT special-cased;
        // if it isn't in internalIds (e.g. owner_id != Fruitlink) it stays
        // visible here, exactly as it would be absent from Team Attendance.
        // Empty internal set → nothing to exclude, so no filter is added.
        const internalRes = await fetch(
          SB_URL + '/rest/v1/operators?select=id&role=in.(' + INTERNAL_ROLES.join(',') + ')&owner_id=eq.' + encodeURIComponent(FRUITLINK_OWNER_ID),
          { headers: sbHeaders() },
        );
        const internalRows = internalRes.ok ? await internalRes.json() : [];
        const internalIds = Array.isArray(internalRows) ? internalRows.map((o: any) => o.id).filter(Boolean) : [];
        if (internalIds.length) {
          url += '&staff_id=not.in.(' + internalIds.map(encodeURIComponent).join(',') + ')';
        }
      }
      const res = await fetch(url, { headers: sbHeaders() });
      const rows = await res.json();
      if (!Array.isArray(rows)) return NextResponse.json([], { headers: NO_STORE });
      // resolve staff names
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
        // Resolve the entity/team name for each person (their owner's company name)
        // Gather owner ids from both the staff rows and the attendance rows
        // themselves, so every row's owner_id resolves to a timezone even if the
        // two ever drift. (Read-only — no scoping filter changes.)
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
        team_name: (staffMeta[r.staff_id]?.role === 'staff') ? 'Fruitlink' : (staffMeta[r.staff_id]?.owner_id ? (ownerNames[staffMeta[r.staff_id]!.owner_id!] || 'Operator') : '—'),
        machine_name: r.machine_id ? (mnames[r.machine_id] || '—') : 'Office',
        // Display timezone for this row. Fruitlink-internal (staff) rows always
        // render in IST; tenant rows use their operator's stored timezone; anything
        // unresolved falls back to Asia/Kolkata. Purely additive — scoping untouched.
        tenant_timezone: (staffMeta[r.staff_id]?.role === 'staff')
          ? 'Asia/Kolkata'
          : (ownerTz[r.owner_id] || 'Asia/Kolkata'),
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
        && session.role !== 'operator' && session.role !== 'sub_operator' && session.role !== 'staff') {
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

    // Tenant, not parent: a top-level operator has owner_id null and is its own
    // tenant. Stamping null here would orphan the row from every read filter.
    const tenantId = session.owner_id ? String(session.owner_id) : String(session.sub || '');
    const visitMode = (body.visit_mode === 'office' || body.visit_mode === 'machine') ? body.visit_mode : null;
    const checkInLat = body.lat != null ? parseFloat(body.lat) : null;
    const checkInLng = body.lng != null ? parseFloat(body.lng) : null;
    const gpsAccuracy = (body.gps_accuracy_m != null && !isNaN(parseInt(body.gps_accuracy_m))) ? parseInt(body.gps_accuracy_m) : null;

    // machine_id: an explicit client selection wins; otherwise resolve it from the
    // check-in GPS against the tenant's machine geofences. Skipped for an explicit
    // 'office' check-in and when there's no usable fix. Non-blocking: any failure
    // just leaves machine_id null (→ "Office"), never breaks the check-in.
    let machineId: string | null = body.machine_id ? String(body.machine_id) : null;
    let locationId: string | null = body.location_id ? String(body.location_id) : null;
    if (!machineId && visitMode !== 'office' && tenantId
        && Number.isFinite(checkInLat as number) && Number.isFinite(checkInLng as number)) {
      try {
        const resolved = await resolveMachineByGps(tenantId, checkInLat as number, checkInLng as number, gpsAccuracy ?? 0);
        if (resolved) {
          machineId = resolved.machine_id;
          if (!locationId) locationId = resolved.location_id; // adopt the machine's location when none was sent
        }
      } catch { /* resolution is best-effort; never fail the check-in on it */ }
    }

    const row = {
      staff_id: staffId,
      owner_id: tenantId,
      machine_id: machineId,
      location_id: locationId,
      visit_mode: visitMode,
      check_in_at: new Date().toISOString(),
      check_in_lat: checkInLat,
      check_in_lng: checkInLng,
      check_in_address: body.address ? String(body.address).slice(0, 500) : null,
      check_in_photo: body.photo_url ? String(body.photo_url) : null,
      // Geofence is evidence, not a gate: we record what we saw and move on.
      gps_accuracy_m: gpsAccuracy,
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
      check_out_photo: body.photo_url ? String(body.photo_url) : null,
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
