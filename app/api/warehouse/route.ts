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

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

function ownerForOperator(session: any): string {
  return String(session.sub || '');
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const role = session.role;
    if (role !== 'super_admin' && role !== 'operator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    const sp = request.nextUrl.searchParams;
    let ownerFilter = '';
    if (role === 'operator') ownerFilter = 'owner_id=eq.' + encodeURIComponent(ownerForOperator(session));
    else if (sp.get('owner')) ownerFilter = 'owner_id=eq.' + encodeURIComponent(String(sp.get('owner')));

    if (sp.get('items') === '1') {
      let url = SB_URL + '/rest/v1/warehouse_items?select=*&active=eq.true&order=category.asc,size.asc,name.asc';
      if (ownerFilter) url += '&' + ownerFilter;
      const r = await fetch(url, { headers: sbHeaders() });
      const d = await r.json();
      return NextResponse.json(Array.isArray(d) ? d : [], { headers: NO_STORE });
    }

    if (sp.get('onhand') === '1') {
      let iurl = SB_URL + '/rest/v1/warehouse_items?select=*&active=eq.true';
      if (ownerFilter) iurl += '&' + ownerFilter;
      const ir = await fetch(iurl, { headers: sbHeaders() });
      const items = await ir.json();
      let murl = SB_URL + '/rest/v1/stock_movements?select=item_id,qty_base';
      if (ownerFilter) murl += '&' + ownerFilter;
      const mr = await fetch(murl, { headers: sbHeaders() });
      const movs = await mr.json();
      const sums: Record<string, number> = {};
      (Array.isArray(movs) ? movs : []).forEach((m: any) => {
        sums[m.item_id] = (sums[m.item_id] || 0) + Number(m.qty_base || 0);
      });
      const out = (Array.isArray(items) ? items : []).map((it: any) => ({
        ...it,
        on_hand: sums[it.id] || 0,
        boxes_equiv: (it.category === 'fruit' && it.size) ? Math.round(((sums[it.id] || 0) / it.size) * 10) / 10 : null,
      }));
      return NextResponse.json(out, { headers: NO_STORE });
    }

    if (sp.get('movements') === '1') {
      let url = SB_URL + '/rest/v1/stock_movements?select=*&order=created_at.desc&limit=500';
      if (ownerFilter) url += '&' + ownerFilter;
      const from = sp.get('from'); const to = sp.get('to');
      if (from) url += '&created_at=gte.' + encodeURIComponent(from);
      if (to) url += '&created_at=lte.' + encodeURIComponent(to);
      const type = sp.get('type');
      if (type) url += '&movement_type=eq.' + encodeURIComponent(type);
      const item = sp.get('item');
      if (item) url += '&item_id=eq.' + encodeURIComponent(item);
      const r = await fetch(url, { headers: sbHeaders() });
      const d = await r.json();
      return NextResponse.json(Array.isArray(d) ? d : [], { headers: NO_STORE });
    }

    return NextResponse.json({ error: 'specify items|onhand|movements' }, { status: 400, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const role = session.role;
    if (role !== 'super_admin' && role !== 'operator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }

    const body = await request.json().catch(() => ({}));
    const item_id = String(body.item_id || '');
    const movement_type = String(body.movement_type || '');
    if (!item_id || !['receive', 'dispatch', 'adjust'].includes(movement_type)) {
      return NextResponse.json({ error: 'item_id and valid movement_type required' }, { status: 400, headers: NO_STORE });
    }

    const ir = await fetch(SB_URL + '/rest/v1/warehouse_items?select=*&id=eq.' + encodeURIComponent(item_id) + '&limit=1', { headers: sbHeaders() });
    const irows = await ir.json();
    if (!Array.isArray(irows) || !irows[0]) return NextResponse.json({ error: 'item not found' }, { status: 404, headers: NO_STORE });
    const item = irows[0];

    if (role === 'operator' && String(item.owner_id) !== ownerForOperator(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    const ownerId = String(item.owner_id);

    let qty_base: number;
    const packs = body.packs != null && body.packs !== '' ? Number(body.packs) : null;
    if (body.qty_base != null && body.qty_base !== '') {
      qty_base = Number(body.qty_base);
    } else if (packs != null) {
      qty_base = packs * Number(item.pack_size || 1);
    } else {
      return NextResponse.json({ error: 'packs or qty_base required' }, { status: 400, headers: NO_STORE });
    }
    if (isNaN(qty_base) || qty_base <= 0) {
      return NextResponse.json({ error: 'quantity must be positive' }, { status: 400, headers: NO_STORE });
    }

    let signed = qty_base;
    if (movement_type === 'dispatch') signed = -Math.abs(qty_base);
    if (movement_type === 'receive') signed = Math.abs(qty_base);
    if (movement_type === 'adjust' && body.direction === 'down') signed = -Math.abs(qty_base);

    const machine_id = body.machine_id ? String(body.machine_id) : null;
    if (movement_type === 'dispatch' && !machine_id) {
      return NextResponse.json({ error: 'dispatch needs a machine' }, { status: 400, headers: NO_STORE });
    }

    const row = {
      owner_id: ownerId,
      item_id,
      movement_type,
      qty_base: signed,
      packs: packs,
      machine_id,
      note: body.note ? String(body.note).slice(0, 500) : null,
      created_by: String(session.sub || ''),
    };
    const res = await fetch(SB_URL + '/rest/v1/stock_movements', {
      method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    });
    const d = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'insert failed', detail: d }, { status: 500, headers: NO_STORE });
    return NextResponse.json({ success: true, movement: Array.isArray(d) ? d[0] : d }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
