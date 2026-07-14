import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const sbH = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json', ...extra,
});
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };
const FRUITLINK_SUPER_ADMIN_ID = '0c1bd083-682a-4913-ac37-08c85ef94b41';

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

function normPhone(n: any): string | null {
  let s = String(n || '').replace(/[^\d+]/g, '');
  if (!s) return null;
  if (!s.startsWith('+')) s = '+' + s;
  return (s.length >= 8 && s.length <= 16) ? s : null;
}

function normTgId(n: any): string | null {
  const s = String(n || '').trim();
  return /^-?\d+$/.test(s) ? s : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const isSuperAdmin = session.role === 'super_admin';
    const isOperator = session.role === 'operator' || session.role === 'sub_operator';
    if (!isSuperAdmin && !isOperator) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    // Operator's own tenant id (sub_operator uses parent's owner_id)
    const myOwnerId = isSuperAdmin ? null : (session.role === 'sub_operator' && session.owner_id ? String(session.owner_id) : String(session.sub));

    const params = request.nextUrl.searchParams;

    // Tenants list
    if (params.get('tenants') === '1') {
      // Operators see only themselves as a tenant
      if (isOperator) {
        const opRes = await fetch(SB_URL + '/rest/v1/operators?select=id,name,email,role,max_notify_numbers,max_telegram_ids&id=eq.' + encodeURIComponent(myOwnerId!), { headers: sbH() });
        const opData = await opRes.json();
        return NextResponse.json(Array.isArray(opData) ? opData : [], { headers: NO_STORE });
      }
      // One query: operators + their machine ownership status
      const [opsRes, moRes] = await Promise.all([
        fetch(SB_URL + '/rest/v1/operators?select=id,name,email,role,max_notify_numbers,max_telegram_ids&order=name.asc', { headers: sbH() }),
        fetch(SB_URL + '/rest/v1/machine_operators?select=operator_id', { headers: sbH() }),
      ]);
      const ops = await opsRes.json();
      const mo = await moRes.json();
      const owners = new Set((Array.isArray(mo) ? mo : []).map((x: any) => String(x.operator_id)));
      const tenants = (Array.isArray(ops) ? ops : [])
        .filter((o: any) => o.role !== 'super_admin' && owners.has(String(o.id)));
      return NextResponse.json(tenants, { headers: NO_STORE });
    }

    // Main list — bulk fetch everything in 3 parallel queries
    const [machinesRes, arrangementsRes, moAllRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn&order=display_name.asc', { headers: sbH() }),
      fetch(SB_URL + '/rest/v1/service_arrangement?select=*', { headers: sbH() }),
      fetch(SB_URL + '/rest/v1/machine_operators?select=machine_id,operator_id', { headers: sbH() }),
    ]);

    const [machines, arrangements, moAll] = await Promise.all([
      machinesRes.json(), arrangementsRes.json(), moAllRes.json(),
    ]);

    // Build lookup maps — O(n) not O(n²)
    const machineOwnerMap: Record<string, string> = {};
    (Array.isArray(moAll) ? moAll : []).forEach((mo: any) => {
      machineOwnerMap[mo.machine_id] = mo.operator_id;
    });

    const byMachine: Record<string, any> = {};
    const byOwnerDefault: Record<string, any> = {};
    (Array.isArray(arrangements) ? arrangements : []).forEach((a: any) => {
      if (a.machine_id) byMachine[a.machine_id] = a;
      else if (a.owner_id) byOwnerDefault[a.owner_id] = a;
    });

    // Operators only see their own machines
    const visibleMachines = isSuperAdmin
      ? (Array.isArray(machines) ? machines : [])
      : (Array.isArray(machines) ? machines : []).filter((m: any) => machineOwnerMap[m.id] === myOwnerId);

    const out = visibleMachines.map((m: any) => {
      const owner = machineOwnerMap[m.id] || null;
      const arr = byMachine[m.id] || (owner ? byOwnerDefault[owner] : null);
      return {
        machine_id: m.id,
        machine_name: m.display_name || m.sn,
        owner_id: owner,
        mode: arr?.mode || 'self_service',
        notify_numbers: Array.isArray(arr?.notify_numbers) ? arr.notify_numbers : [],
        telegram_chat_ids: Array.isArray(arr?.telegram_chat_ids) ? arr.telegram_chat_ids : [],
        source: byMachine[m.id] ? 'machine' : (arr ? 'owner_default' : 'none'),
      };
    });

    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const isSuperAdminP = session.role === 'super_admin';
    const isOperatorP = session.role === 'operator' || session.role === 'sub_operator';
    if (!isSuperAdminP && !isOperatorP) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    const myOwnerIdP = isSuperAdminP ? null : (session.role === 'sub_operator' && session.owner_id ? String(session.owner_id) : String(session.sub));

    const body = await request.json().catch(() => ({}));

    // Update tenant limit — super admin only
    if (body.set_limit?.owner_id) {
      if (!isSuperAdminP) return NextResponse.json({ error: 'Only super admin can change limits' }, { status: 403, headers: NO_STORE });
      const field = body.set_limit.field === 'telegram' ? 'max_telegram_ids' : 'max_notify_numbers';
      const max = parseInt(body.set_limit.max);
      if (isNaN(max) || max < 0 || max > 100) return NextResponse.json({ error: 'Invalid limit' }, { status: 400, headers: NO_STORE });
      const r = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + encodeURIComponent(body.set_limit.owner_id), {
        method: 'PATCH', headers: sbH({ Prefer: 'return=representation' }),
        body: JSON.stringify({ [field]: max }),
      });
      if (!r.ok) return NextResponse.json({ error: 'Limit update failed' }, { status: 500, headers: NO_STORE });
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    const machine_id = String(body.machine_id || '');
    if (!machine_id) return NextResponse.json({ error: 'machine_id required' }, { status: 400, headers: NO_STORE });

    // Get machine owner — single query
    const moRes = await fetch(SB_URL + '/rest/v1/machine_operators?select=operator_id&machine_id=eq.' + encodeURIComponent(machine_id) + '&limit=1', { headers: sbH() });
    const moRows = await moRes.json();
    const owner = Array.isArray(moRows) && moRows[0] ? String(moRows[0].operator_id) : null;
    if (!owner) return NextResponse.json({ error: 'Machine has no owner' }, { status: 400, headers: NO_STORE });
    // Operators can only edit their OWN machines
    if (!isSuperAdminP && owner !== myOwnerIdP) return NextResponse.json({ error: 'Forbidden — not your machine' }, { status: 403, headers: NO_STORE });

    // Validate and deduplicate numbers
    const numbers: string[] = [];
    const seenN = new Set<string>();
    for (const n of (Array.isArray(body.notify_numbers) ? body.notify_numbers : [])) {
      const nn = normPhone(n);
      if (nn && !seenN.has(nn)) { seenN.add(nn); numbers.push(nn); }
    }

    const telegramIds: string[] = [];
    const seenT = new Set<string>();
    for (const n of (Array.isArray(body.telegram_chat_ids) ? body.telegram_chat_ids : [])) {
      const nn = normTgId(n);
      if (nn && !seenT.has(nn)) { seenT.add(nn); telegramIds.push(nn); }
    }

    // Apply tenant limits (skip for Fruitlink super admin)
    if (owner !== FRUITLINK_SUPER_ADMIN_ID) {
      const opRes = await fetch(SB_URL + '/rest/v1/operators?select=max_notify_numbers,max_telegram_ids&id=eq.' + encodeURIComponent(owner) + '&limit=1', { headers: sbH() });
      const opRows = await opRes.json();
      const op = Array.isArray(opRows) && opRows[0] ? opRows[0] : {};
      const waLimit = typeof op.max_notify_numbers === 'number' ? op.max_notify_numbers : 5;
      const tgLimit = typeof op.max_telegram_ids === 'number' ? op.max_telegram_ids : 3;
      if (numbers.length > waLimit) return NextResponse.json({ error: `WhatsApp limit is ${waLimit} for this tenant` }, { status: 400, headers: NO_STORE });
      if (telegramIds.length > tgLimit) return NextResponse.json({ error: `Telegram limit is ${tgLimit} for this tenant` }, { status: 400, headers: NO_STORE });
    }

    const mode = body.mode === 'fruitlink_service' ? 'fruitlink_service' : 'self_service';
    const payload = { mode, notify_numbers: numbers, telegram_chat_ids: telegramIds, updated_at: new Date().toISOString() };

    // Upsert — check existing in one query
    const exRes = await fetch(SB_URL + '/rest/v1/service_arrangement?select=id&machine_id=eq.' + encodeURIComponent(machine_id) + '&limit=1', { headers: sbH() });
    const exRows = await exRes.json();

    if (Array.isArray(exRows) && exRows[0]) {
      await fetch(SB_URL + '/rest/v1/service_arrangement?machine_id=eq.' + encodeURIComponent(machine_id), {
        method: 'PATCH', headers: sbH({ Prefer: 'return=representation' }),
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(SB_URL + '/rest/v1/service_arrangement', {
        method: 'POST', headers: sbH({ Prefer: 'return=representation' }),
        body: JSON.stringify({ machine_id, owner_id: owner, ...payload }),
      });
    }

    return NextResponse.json({ success: true, notify_numbers: numbers, telegram_chat_ids: telegramIds, mode }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
