import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const sbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
  ...extra,
});
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

const FRUITLINK_NUMBER = '+918919388756';
const NOTIFY_METHOD = process.env.NOTIFY_METHOD || 'deep_link';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

async function tenantMachineIds(ownerId: string): Promise<string[]> {
  const url = SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(ownerId);
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r: any) => r.machine_id).filter(Boolean) : [];
}

function tenantOf(session: any): string {
  // A top-level operator IS the tenant: their own id is the owner id.
  // Sub-operators and field staff carry owner_id pointing at their operator.
  return session.owner_id ? String(session.owner_id) : String(session.sub || '');
}

async function sendTelegram(message: string) {
  if (!TELEGRAM_TOKEN || TELEGRAM_CHAT_IDS.length === 0) return;
  for (const chatId of TELEGRAM_CHAT_IDS) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
      });
    } catch { /* never fail visit on telegram error */ }
  }
}
async function buildNotification(visit: any, machineName: string, staffName: string) {
  const machineId = visit.machine_id;
  const ownerId = visit.owner_id;

  let arr: any = null;
  const perM = await fetch(SB_URL + '/rest/v1/service_arrangement?select=*&machine_id=eq.' + encodeURIComponent(machineId) + '&limit=1', { headers: sbHeaders() });
  const perMrows = await perM.json();
  if (Array.isArray(perMrows) && perMrows[0]) arr = perMrows[0];
  else if (ownerId) {
    const def = await fetch(SB_URL + '/rest/v1/service_arrangement?select=*&owner_id=eq.' + encodeURIComponent(ownerId) + '&machine_id=is.null&limit=1', { headers: sbHeaders() });
    const defRows = await def.json();
    if (Array.isArray(defRows) && defRows[0]) arr = defRows[0];
  }

  const mode = arr ? arr.mode : 'self_service';
  let numbers: string[] = arr && Array.isArray(arr.notify_numbers) ? [...arr.notify_numbers] : [];
  if (mode === 'fruitlink_service' && !numbers.includes(FRUITLINK_NUMBER)) numbers.push(FRUITLINK_NUMBER);

  const lines = ['\uD83C\uDF4A Fruitlink Visit Update'];
  lines.push('Machine: ' + machineName);
  lines.push('Type: ' + (visit.visit_type ? visit.visit_type[0].toUpperCase() + visit.visit_type.slice(1) : ''));
  if (staffName) lines.push('By: ' + staffName);
  if (visit.visit_type === 'loading' && visit.oranges_net != null) {
    let s = 'Oranges: ' + (visit.oranges_loaded ?? '?') + ' loaded';
    if (visit.oranges_damaged) s += ', ' + visit.oranges_damaged + ' damaged';
    s += ' (net ' + visit.oranges_net + ')';
    lines.push(s);
  }
  lines.push('Time: ' + new Date(visit.created_at || Date.now()).toLocaleString('en-IN'));
  if (visit.address) lines.push('\uD83D\uDCCD ' + visit.address);
  if (visit.lat != null && visit.lng != null) lines.push('\uD83D\uDDFA\uFE0F https://maps.google.com/?q=' + visit.lat + ',' + visit.lng);
  if (visit.photo_url) lines.push('Photo: ' + visit.photo_url);

  const message = lines.join('\n');
  return { method: NOTIFY_METHOD, mode, recipients: numbers, message };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    if (request.nextUrl.searchParams.get('geocode') === '1') {
      const lat = request.nextUrl.searchParams.get('lat');
      const lng = request.nextUrl.searchParams.get('lng');
      if (!lat || !lng) return NextResponse.json({ addr: null }, { headers: NO_STORE });
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`,
          { headers: { 'Accept': 'application/json', 'User-Agent': 'FruitlinkServer/1.0 (fruitlinktech.in)' } }
        );
        const d = await r.json();
        let addr = lat + 'N, ' + lng + 'E';
        if (d?.display_name) {
          const parts = String(d.display_name).split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 2 && !/^\d+$/.test(s));
          addr = parts.slice(0, 3).join(', ');
        }
        return NextResponse.json({ addr }, { headers: NO_STORE });
      } catch {
        return NextResponse.json({ addr: null }, { headers: NO_STORE });
      }
    }
    if (request.nextUrl.searchParams.get('machines') === '1') {
      if (session.role === 'super_admin' || session.role === 'staff') {
        // Super admin + Fruitlink staff service the whole fleet
        const res = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,location,location_id,location_lat,location_lng&order=display_name.asc', { headers: sbHeaders() });
        const all = await res.json();
        return NextResponse.json(Array.isArray(all) ? all : [], { headers: NO_STORE });
      }
      const staffId = String(session.sub || '');
      const owner = tenantOf(session);
      // Field staff inherit their tenant's machines. machine_operators is TENANCY
      // (which operator owns which machine) - it was also being used as a work
      // assignment for field staff, so one table meant two things and a guard
      // could not tell them apart. That is why an operator could not self-serve
      // and why test6 was created on 16 Jul with 8 permissions and still saw no
      // machines: nothing writes the assignment rows, so every new hire was dead
      // on arrival until someone ran SQL.
      //
      // There is no per-person scoping anywhere, by design: any staff member may
      // service any machine in their operator's fleet. The flow already scopes it
      // - LOCATION, CHECK IN, then MACHINE - and the visit page filters machines
      // by the location_id you checked into (page.tsx:505). A field staff member
      // is standing at the machine with a GPS-verified check-in; a second gate on
      // top of that added nothing but a way to break new accounts.
      //
      // (An earlier version of this comment claimed location_staff was the
      // assignment layer. It was not: that table had zero rows, nothing read it
      // except a staff_count that always rendered 0, and it has since been
      // removed.)
      const ids = await tenantMachineIds(owner);
      if (ids.length === 0) return NextResponse.json([], { headers: NO_STORE });
      const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
      const res = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,location,location_id,location_lat,location_lng&id=in.' + inList + '&order=display_name.asc', { headers: sbHeaders() });
      const data = await res.json();
      return NextResponse.json(Array.isArray(data) ? data : [], { headers: NO_STORE });
    }

    // Reports: super_admin gets ALL visits in a date range, with staff names resolved
    if (request.nextUrl.searchParams.get('report') === '1' && (session.role === 'super_admin' || session.role === 'operator' || session.role === 'sub_operator' || session.role === 'staff')) {
      let vurl = SB_URL + '/rest/v1/visits?select=*&order=created_at.desc&limit=1000';
      // Scope to operator's tenant; Fruitlink staff + super_admin see all visits fleet-wide
      if (session.role === 'operator' || session.role === 'sub_operator') {
        const tenant = tenantOf(session);
        vurl += '&owner_id=eq.' + encodeURIComponent(tenant);
      }
      // super_admin and staff: no filter — full fleet
      const from = request.nextUrl.searchParams.get('from');
      const to = request.nextUrl.searchParams.get('to');
      if (from) vurl += '&created_at=gte.' + encodeURIComponent(from);
      if (to) vurl += '&created_at=lte.' + encodeURIComponent(to);
      const vres = await fetch(vurl, { headers: sbHeaders() });
      const visits = await vres.json();
      const rows = Array.isArray(visits) ? visits : [];
      const staffIds = Array.from(new Set(rows.map((v: any) => v.staff_id).filter(Boolean)));
      let names: Record<string, string> = {};
      if (staffIds.length) {
        const inList = '(' + staffIds.map(encodeURIComponent).join(',') + ')';
        const nr = await fetch(SB_URL + '/rest/v1/operators?select=id,name,email&id=in.' + inList, { headers: sbHeaders() });
        const nrows = await nr.json();
        (Array.isArray(nrows) ? nrows : []).forEach((o: any) => { names[o.id] = o.name || o.email || String(o.id).slice(0, 6); });
      }
      const withNames = rows.map((v: any) => ({ ...v, staff_name: v.staff_id ? (names[v.staff_id] || '—') : '—' }));
      return NextResponse.json(withNames, { headers: NO_STORE });
    }

    const staffId = String(session.sub || '');
    const url = SB_URL + '/rest/v1/visits?select=*&staff_id=eq.' + encodeURIComponent(staffId) + '&order=created_at.desc&limit=50';
    const res = await fetch(url, { headers: sbHeaders() });
    const data = await res.json();
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role !== 'field_staff' && session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    const body = await request.json().catch(() => ({}));
    const machine_id = String(body.machine_id || '');
    const visit_type = String(body.visit_type || '');
    if (!machine_id || !visit_type) {
      return NextResponse.json({ error: 'machine_id and visit_type required' }, { status: 400, headers: NO_STORE });
    }
    const ALLOWED_TYPES = ['cleaning', 'loading', 'maintenance', 'other'];
    if (!ALLOWED_TYPES.includes(visit_type)) {
      return NextResponse.json({ error: 'invalid visit_type' }, { status: 400, headers: NO_STORE });
    }

    const staffId = String(session.sub || '');

    // ── Step order, enforced here rather than in React ──────────────────
    // A visit may only be logged while an attendance row is open. This is what
    // makes "check in -> photo -> details" an audit trail instead of a UI hint:
    // a reload, a back button, or a hand-rolled request cannot reorder it.
    // check_in_at is taken from that row, never from the request body.
    let openAttendanceId: string | null = null;
    let openCheckInAt: string | null = null;
    if (session.role === 'field_staff') {
      const attRes = await fetch(
        SB_URL + '/rest/v1/attendance?select=id,check_in_at&staff_id=eq.' + encodeURIComponent(staffId) +
        '&check_out_at=is.null&order=check_in_at.desc&limit=1',
        { headers: sbHeaders() }
      );
      const attRows = await attRes.json();
      const open = Array.isArray(attRows) ? attRows[0] : null;
      if (!open) {
        return NextResponse.json(
          { error: 'not_checked_in', message: 'Check in before logging a visit.' },
          { status: 409, headers: NO_STORE }
        );
      }
      openAttendanceId = String(open.id);
      openCheckInAt = open.check_in_at;

      // A visit without a photo is not evidence. Required for field staff.
      if (!body.photo_url) {
        return NextResponse.json(
          { error: 'photo_required', message: 'A photo is required for every visit.' },
          { status: 400, headers: NO_STORE }
        );
      }
    }

    let ownerId = session.owner_id ? String(session.owner_id) : '';
    if (session.role === 'field_staff') {
      if (!ownerId) return NextResponse.json({ error: 'No tenant for staff' }, { status: 403, headers: NO_STORE });
      const allowed = await tenantMachineIds(ownerId);
      if (!allowed.includes(machine_id)) {
        return NextResponse.json({ error: 'Machine not in your scope' }, { status: 403, headers: NO_STORE });
      }
    } else {
      const url = SB_URL + '/rest/v1/machine_operators?select=operator_id&machine_id=eq.' + encodeURIComponent(machine_id) + '&limit=1';
      const r = await fetch(url, { headers: sbHeaders() });
      const rows = await r.json();
      ownerId = Array.isArray(rows) && rows[0] ? String(rows[0].operator_id) : ownerId;
    }
    const loaded = body.oranges_loaded != null ? parseInt(body.oranges_loaded) : null;
    const damaged = body.oranges_damaged != null ? parseInt(body.oranges_damaged) : null;
    const net = (loaded != null && damaged != null) ? (loaded - damaged) : (loaded != null ? loaded : null);
    // The fruit size loaded on THIS visit. Oranges-per-cup follows the fruit, not
    // the machine: F4 was configured count 100 (5/cup) while holding 88s (4/cup),
    // and the stock balance sank ~60 oranges a day until it read -359 while the
    // machine physically held 170. The count in Settings is now only a fallback
    // for visits that did not record one.
    const fruitCount = body.fruit_count != null && !isNaN(parseInt(body.fruit_count))
      ? parseInt(body.fruit_count) : null;

    const row = {
      machine_id,
      staff_id: staffId,
      owner_id: ownerId || null,
      visit_type,
      note: body.note ? String(body.note).slice(0, 2000) : null,
      oranges_loaded: loaded,
      oranges_damaged: damaged,
      oranges_net: net,
      fruit_count: fruitCount,
      consumables: body.consumables && typeof body.consumables === 'object' ? body.consumables : null,
      photo_url: body.photo_url ? String(body.photo_url).slice(0, 500) : null,
      lat: (body.lat != null && !isNaN(parseFloat(body.lat))) ? parseFloat(body.lat) : null,
      lng: (body.lng != null && !isNaN(parseFloat(body.lng))) ? parseFloat(body.lng) : null,
      // Accuracy of the fix, in metres. Without it, lat/lng cannot be judged later.
      gps_accuracy_m: (body.gps_accuracy_m != null && !isNaN(parseInt(body.gps_accuracy_m))) ? parseInt(body.gps_accuracy_m) : null,
      // Which location this visit belongs to. Advisory — never enforced.
      location_id: body.location_id ? String(body.location_id) : null,
      address: body.address ? String(body.address).slice(0, 500) : null,
      // Server-stamped from the open attendance row. Never trusted from the client.
      attendance_id: openAttendanceId,
      check_in_at: openCheckInAt || body.check_in_at || null,
      check_out_at: body.check_out_at || new Date().toISOString(),
    };

    const res = await fetch(SB_URL + '/rest/v1/visits', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'insert failed', detail: data }, { status: 500, headers: NO_STORE });

    const savedVisit = Array.isArray(data) ? data[0] : data;

    // Update the attendance row with the machine_id from this visit
    // (staff may have checked in via 'Office' mode then logged a machine visit)
    if (openAttendanceId && machine_id) {
      await fetch(
        SB_URL + '/rest/v1/attendance?id=eq.' + encodeURIComponent(openAttendanceId),
        { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify({ machine_id, updated_at: new Date().toISOString() }) }
      ).catch(() => {});
    }

    let staffName = session.name || '';
    if (!staffName) {
      const sres = await fetch(SB_URL + '/rest/v1/operators?select=name&id=eq.' + encodeURIComponent(staffId) + '&limit=1', { headers: sbHeaders() });
      const srows = await sres.json();
      staffName = Array.isArray(srows) && srows[0] ? (srows[0].name || '') : '';
    }
    let machineName = '';
    const mres = await fetch(SB_URL + '/rest/v1/machines?select=display_name,sn&id=eq.' + encodeURIComponent(machine_id) + '&limit=1', { headers: sbHeaders() });
    const mrows = await mres.json();
    if (Array.isArray(mrows) && mrows[0]) machineName = mrows[0].display_name || mrows[0].sn || '';

    let notify = null;
    try {
      notify = await buildNotification(savedVisit, machineName, staffName);
      if (notify?.message) await sendTelegram(notify.message);
    } catch { /* never fail the visit on notify prep */ }

    return NextResponse.json({ success: true, visit: savedVisit, notify }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
