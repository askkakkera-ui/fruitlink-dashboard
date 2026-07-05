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
  return session.owner_id ? String(session.owner_id) : '';
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

    if (request.nextUrl.searchParams.get('machines') === '1') {
      if (session.role === 'super_admin') {
        const res = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,location&order=display_name.asc', { headers: sbHeaders() });
        const all = await res.json();
        return NextResponse.json(Array.isArray(all) ? all : [], { headers: NO_STORE });
      }
      const owner = tenantOf(session);
      if (!owner) return NextResponse.json([], { headers: NO_STORE });
      const ids = await tenantMachineIds(owner);
      if (ids.length === 0) return NextResponse.json([], { headers: NO_STORE });
      const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
      const res = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,location&id=in.' + inList + '&order=display_name.asc', { headers: sbHeaders() });
      const data = await res.json();
      return NextResponse.json(Array.isArray(data) ? data : [], { headers: NO_STORE });
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

    const row = {
      machine_id,
      staff_id: staffId,
      owner_id: ownerId || null,
      visit_type,
      note: body.note ? String(body.note).slice(0, 2000) : null,
      oranges_loaded: loaded,
      oranges_damaged: damaged,
      oranges_net: net,
      consumables: body.consumables && typeof body.consumables === 'object' ? body.consumables : null,
      photo_url: body.photo_url ? String(body.photo_url).slice(0, 500) : null,
      lat: (body.lat != null && !isNaN(parseFloat(body.lat))) ? parseFloat(body.lat) : null,
      lng: (body.lng != null && !isNaN(parseFloat(body.lng))) ? parseFloat(body.lng) : null,
      address: body.address ? String(body.address).slice(0, 500) : null,
      check_in_at: body.check_in_at || null,
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
    try { notify = await buildNotification(savedVisit, machineName, staffName); } catch { /* never fail the visit on notify prep */ }

    return NextResponse.json({ success: true, visit: savedVisit, notify }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
