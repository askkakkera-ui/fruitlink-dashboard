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

const FRUITLINK_SUPER_ADMIN_ID = '0c1bd083-682a-4913-ac37-08c85ef94b41';

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

function normNumber(n: any): string | null {
  let s = String(n || '').replace(/[^\d+]/g, '');
  if (!s) return null;
  if (!s.startsWith('+')) s = '+' + s;
  if (s.length < 8 || s.length > 16) return null;
  return s;
}

async function machineOwner(machineId: string): Promise<string | null> {
  const url = SB_URL + '/rest/v1/machine_operators?select=operator_id&machine_id=eq.' + encodeURIComponent(machineId) + '&limit=1';
  const r = await fetch(url, { headers: sbHeaders() });
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? String(rows[0].operator_id) : null;
}

async function tenantLimit(ownerId: string): Promise<number> {
  const url = SB_URL + '/rest/v1/operators?select=max_notify_numbers&id=eq.' + encodeURIComponent(ownerId) + '&limit=1';
  const r = await fetch(url, { headers: sbHeaders() });
  const rows = await r.json();
  const v = Array.isArray(rows) && rows[0] ? rows[0].max_notify_numbers : 5;
  return (typeof v === 'number' && v >= 0) ? v : 5;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    if (request.nextUrl.searchParams.get('tenants') === '1') {
      const r = await fetch(SB_URL + '/rest/v1/operators?select=id,name,email,role,max_notify_numbers&order=name.asc', { headers: sbHeaders() });
      const data = await r.json();
      return NextResponse.json(Array.isArray(data) ? data : [], { headers: NO_STORE });
    }

    const mres = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn&order=display_name.asc', { headers: sbHeaders() });
    const machines = await mres.json();
    const ares = await fetch(SB_URL + '/rest/v1/service_arrangement?select=*', { headers: sbHeaders() });
    const arrangements = await ares.json();

    const byMachine: Record<string, any> = {};
    const byOwnerDefault: Record<string, any> = {};
    (Array.isArray(arrangements) ? arrangements : []).forEach((a: any) => {
      if (a.machine_id) byMachine[a.machine_id] = a;
      else byOwnerDefault[a.owner_id] = a;
    });

    const out = [];
    for (const m of (Array.isArray(machines) ? machines : [])) {
      const owner = await machineOwner(m.id);
      const arr = byMachine[m.id] || (owner ? byOwnerDefault[owner] : null);
      out.push({
        machine_id: m.id,
        machine_name: m.display_name || m.sn,
        owner_id: owner,
        mode: arr ? arr.mode : 'self_service',
        notify_numbers: arr && Array.isArray(arr.notify_numbers) ? arr.notify_numbers : [],
        source: byMachine[m.id] ? 'machine' : (arr ? 'owner_default' : 'none'),
      });
    }
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    const body = await request.json().catch(() => ({}));

    if (body.set_limit && body.set_limit.owner_id) {
      const max = parseInt(body.set_limit.max);
      if (isNaN(max) || max < 0 || max > 100) return NextResponse.json({ error: 'invalid limit' }, { status: 400, headers: NO_STORE });
      const patch = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + encodeURIComponent(body.set_limit.owner_id), {
        method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ max_notify_numbers: max }),
      });
      const d = await patch.json();
      if (!patch.ok) return NextResponse.json({ error: 'limit update failed', detail: d }, { status: 500, headers: NO_STORE });
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    const machine_id = String(body.machine_id || '');
    if (!machine_id) return NextResponse.json({ error: 'machine_id required' }, { status: 400, headers: NO_STORE });

    const owner = await machineOwner(machine_id);
    if (!owner) return NextResponse.json({ error: 'machine has no owner' }, { status: 400, headers: NO_STORE });

    let numbers: string[] = [];
    if (Array.isArray(body.notify_numbers)) {
      const seen = new Set<string>();
      for (const n of body.notify_numbers) {
        const nn = normNumber(n);
        if (nn && !seen.has(nn)) { seen.add(nn); numbers.push(nn); }
      }
    }

    if (owner !== FRUITLINK_SUPER_ADMIN_ID) {
      const limit = await tenantLimit(owner);
      if (numbers.length > limit) {
        return NextResponse.json({ error: `Limit is ${limit} numbers for this tenant. Raise the limit first.`, limit }, { status: 400, headers: NO_STORE });
      }
    }

    const mode = (body.mode === 'fruitlink_service') ? 'fruitlink_service' : 'self_service';

    const existing = await fetch(SB_URL + '/rest/v1/service_arrangement?select=id&machine_id=eq.' + encodeURIComponent(machine_id) + '&limit=1', { headers: sbHeaders() });
    const exRows = await existing.json();
    if (Array.isArray(exRows) && exRows[0]) {
      const patch = await fetch(SB_URL + '/rest/v1/service_arrangement?machine_id=eq.' + encodeURIComponent(machine_id), {
        method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ mode, notify_numbers: numbers, updated_at: new Date().toISOString() }),
      });
      const d = await patch.json();
      if (!patch.ok) return NextResponse.json({ error: 'update failed', detail: d }, { status: 500, headers: NO_STORE });
    } else {
      const ins = await fetch(SB_URL + '/rest/v1/service_arrangement', {
        method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ machine_id, owner_id: owner, mode, notify_numbers: numbers }),
      });
      const d = await ins.json();
      if (!ins.ok) return NextResponse.json({ error: 'insert failed', detail: d }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json({ success: true, notify_numbers: numbers, mode }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
