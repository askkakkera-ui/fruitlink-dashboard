import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { logAudit } from '@/lib/audit';

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

async function operatorNames(ids: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return {};
  const inList = '(' + uniq.map(encodeURIComponent).join(',') + ')';
  const r = await fetch(SB_URL + '/rest/v1/operators?select=id,name,email&id=in.' + inList, { headers: sbHeaders() });
  const rows = await r.json();
  const map: Record<string, string> = {};
  (Array.isArray(rows) ? rows : []).forEach((o: any) => { map[o.id] = o.name || o.email || String(o.id).slice(0, 6); });
  return map;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const role = session.role;
    if (role !== 'super_admin' && role !== 'operator' && role !== 'sub_operator' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    const sp = request.nextUrl.searchParams;
    // Tenant scope. owner_id is ALWAYS derived from the session, never client input.
    // Only super_admin may inspect another owner's warehouse via ?owner=.
    let scopeOwner = '';
    if (role === 'super_admin') scopeOwner = String(sp.get('owner') || ownerForOperator(session));
    else if (role === 'operator') scopeOwner = ownerForOperator(session);
    else if (role === 'sub_operator') scopeOwner = String(session.owner_id || '');
    else if (role === 'staff') scopeOwner = String(session.owner_id || '');  // Fruitlink staff see Fruitlink's warehouse (owner_id = super_admin id)
    // Every branch above must yield a tenant. Empty means the session is
    // malformed, not that the caller may see everything.
    if (!scopeOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const ownerFilter = 'owner_id=eq.' + encodeURIComponent(scopeOwner);
    // Machines this caller may dispatch to (same rule the POST guard enforces).
    if (sp.get('dispatchable') === '1') {
      const wantMode = (role === 'super_admin' || role === 'staff') ? 'fruitlink_service' : 'self_service';
      const sr = await fetch(SB_URL + '/rest/v1/service_arrangement?select=machine_id,mode&mode=eq.' + wantMode, { headers: sbHeaders() });
      const srows = await sr.json();
      let ids: string[] = (Array.isArray(srows) ? srows : []).map((r: any) => r.machine_id).filter(Boolean);
      if (role !== 'super_admin' && role !== 'staff') {
        // Tenancy, not per-person: field staff inherit their operator's machines.
        const tenantId = session.owner_id ? String(session.owner_id) : String(session.sub || '');
        const gr = await fetch(SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(tenantId), { headers: sbHeaders() });
        const grows = await gr.json();
        const mine = new Set((Array.isArray(grows) ? grows : []).map((r: any) => String(r.machine_id)));
        ids = ids.filter((id) => mine.has(String(id)));
      }
      if (ids.length === 0) return NextResponse.json([], { headers: NO_STORE });
      const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
      const mr = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,name,sn,location&id=in.' + inList + '&order=display_name.asc', { headers: sbHeaders() });
      const md = await mr.json();
      return NextResponse.json(Array.isArray(md) ? md : [], { headers: NO_STORE });
    }
    // Operators this caller may sell to (never themselves).
    if (sp.get('buyers') === '1') {
      const me = role === 'sub_operator' ? String(session.owner_id || '') : ownerForOperator(session);
      const r = await fetch(SB_URL + '/rest/v1/operators?select=id,name,email&role=eq.operator&order=name.asc', { headers: sbHeaders() });
      const rows = await r.json();
      const out = (Array.isArray(rows) ? rows : [])
        .filter((o: any) => String(o.id) !== String(me))
        .map((o: any) => ({ id: o.id, name: o.name || o.email }));
      return NextResponse.json(out, { headers: NO_STORE });
    }
    if (sp.get('items') === '1') {
      const url = SB_URL + '/rest/v1/warehouse_items?select=*&active=eq.true&order=category.asc,size.asc,name.asc';
      const r = await fetch(url, { headers: sbHeaders() });
      const d = await r.json();
      return NextResponse.json(Array.isArray(d) ? d : [], { headers: NO_STORE });
    }
    if (sp.get('onhand') === '1') {
      const iurl = SB_URL + '/rest/v1/warehouse_items?select=*&active=eq.true';
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
      const rows = Array.isArray(d) ? d : [];
      const names = await operatorNames(rows.map((m: any) => m.created_by));
      const withNames = rows.map((m: any) => ({ ...m, created_by_name: m.created_by ? (names[m.created_by] || '\u2014') : '\u2014' }));
      return NextResponse.json(withNames, { headers: NO_STORE });
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
    if (role !== 'super_admin' && role !== 'operator' && role !== 'sub_operator' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    // Fruitlink staff need the explicit can_manage_warehouse permission to WRITE.
    // (Viewing is separate — can_view_warehouse. Super admin & operators always may write.)
    if (role === 'staff') {
      const perms = session.permissions || {};
      if (perms.can_manage_warehouse !== true) {
        return NextResponse.json({ error: 'Forbidden: warehouse editing not permitted' }, { status: 403, headers: NO_STORE });
      }
    }

    const body = await request.json().catch(() => ({}));
    const item_id = String(body.item_id || '');
    const movement_type = String(body.movement_type || '');
    if (!item_id || !['receive', 'dispatch', 'adjust', 'sale', 'damage_warehouse'].includes(movement_type)) {
      return NextResponse.json({ error: 'item_id and valid movement_type required' }, { status: 400, headers: NO_STORE });
    }
    const ir = await fetch(SB_URL + '/rest/v1/warehouse_items?select=*&id=eq.' + encodeURIComponent(item_id) + '&limit=1', { headers: sbHeaders() });
    const irows = await ir.json();
    if (!Array.isArray(irows) || !irows[0]) return NextResponse.json({ error: 'item not found' }, { status: 404, headers: NO_STORE });
    const item = irows[0];

    const ownerId = (role === 'sub_operator' || role === 'staff') ? String(session.owner_id || '') : ownerForOperator(session);
    if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

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
    if (movement_type === 'sale') signed = -Math.abs(qty_base);
    if (movement_type === 'damage_warehouse') signed = -Math.abs(qty_base);
    if (movement_type === 'receive') signed = Math.abs(qty_base);
    if (movement_type === 'adjust' && body.direction === 'down') signed = -Math.abs(qty_base);
    const machine_id = body.machine_id ? String(body.machine_id) : null;
    if (movement_type === 'dispatch' && !machine_id) {
      return NextResponse.json({ error: 'dispatch needs a machine' }, { status: 400, headers: NO_STORE });
    }
    // Dispatch scoping: you may only load a machine you actually service.
    // super_admin  -> machines on fruitlink_service
    // operator/sub -> their own machines, on self_service
    if (movement_type === 'dispatch' && machine_id) {
      const sr = await fetch(
        SB_URL + '/rest/v1/service_arrangement?select=mode,owner_id&machine_id=eq.' + encodeURIComponent(machine_id) + '&limit=1',
        { headers: sbHeaders() }
      );
      const srows = await sr.json();
      let mode = Array.isArray(srows) && srows[0] ? String(srows[0].mode || '') : '';
      if (!mode) {
        const dr = await fetch(
          SB_URL + '/rest/v1/service_arrangement?select=mode&machine_id=is.null&owner_id=eq.' + encodeURIComponent(ownerId) + '&limit=1',
          { headers: sbHeaders() }
        );
        const drows = await dr.json();
        mode = Array.isArray(drows) && drows[0] ? String(drows[0].mode || 'self_service') : 'self_service';
      }
      if (role === 'super_admin' || role === 'staff') {
        if (mode !== 'fruitlink_service') {
          return NextResponse.json({ error: 'You do not service this machine. Transfer stock to the operator instead.' }, { status: 403, headers: NO_STORE });
        }
      } else {
        const gr = await fetch(
          SB_URL + '/rest/v1/machine_operators?select=machine_id&machine_id=eq.' + encodeURIComponent(machine_id) +
          '&operator_id=eq.' + encodeURIComponent(ownerId) + '&limit=1',
          { headers: sbHeaders() }
        );
        const grows = await gr.json();
        if (!Array.isArray(grows) || !grows[0]) {
          return NextResponse.json({ error: 'That machine is not assigned to you' }, { status: 403, headers: NO_STORE });
        }
        if (mode !== 'self_service') {
          return NextResponse.json({ error: 'Fruitlink services this machine' }, { status: 403, headers: NO_STORE });
        }
      }
    }
    const sold_to_operator_id = body.sold_to_operator_id ? String(body.sold_to_operator_id) : null;
    const sold_to_name = body.sold_to_name ? String(body.sold_to_name).slice(0, 200) : null;

    // Sale accounting fields. Rate is EX-GST; the dashboard never computes GST.
    let rate: number | null = null;
    let taxable_value: number | null = null;
    let buyer_company: string | null = null;
    let buyer_address: string | null = null;
    let buyer_gstin: string | null = null;
    let buyer_contact: string | null = null;
    let challan_no: string | null = null;

    if (movement_type === 'sale') {
      buyer_company = body.buyer_company ? String(body.buyer_company).slice(0, 200) : null;
      buyer_address = body.buyer_address ? String(body.buyer_address).slice(0, 500) : null;
      buyer_gstin = body.buyer_gstin ? String(body.buyer_gstin).slice(0, 20).toUpperCase() : null; // OPTIONAL
      buyer_contact = body.buyer_contact ? String(body.buyer_contact).slice(0, 120) : null;
      if (!buyer_company || !buyer_address || !buyer_contact) {
        return NextResponse.json({ error: 'sale needs buyer company, address and contact' }, { status: 400, headers: NO_STORE });
      }
      if (sold_to_operator_id && sold_to_operator_id === ownerId) {
        return NextResponse.json({ error: 'cannot sell to yourself' }, { status: 400, headers: NO_STORE });
      }
      rate = body.rate != null && body.rate !== '' ? Number(body.rate) : null;
      if (rate == null || isNaN(rate) || rate <= 0) {
        return NextResponse.json({ error: 'sale needs a positive ex-GST rate' }, { status: 400, headers: NO_STORE });
      }
      // Rate is per BOX (pack), not per orange. Fruit is priced per 15kg box.
      const boxes = packs != null ? packs : (qty_base / Number(item.pack_size || 1));
      taxable_value = Math.round(rate * boxes * 100) / 100;

      // Financial year (Apr-Mar) -> "2026-27", then an atomic challan number.
      const now = new Date();
      const y = now.getUTCFullYear();
      const fyStart = now.getUTCMonth() >= 3 ? y : y - 1; // Apr = month 3
      const fy = fyStart + '-' + String((fyStart + 1) % 100).padStart(2, '0');
      const cr = await fetch(SB_URL + '/rest/v1/rpc/next_challan_no', {
        method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ p_fy: fy }),
      });
      const cj = await cr.json();
      if (!cr.ok || typeof cj !== 'string') {
        return NextResponse.json({ error: 'could not assign challan number', detail: cj }, { status: 500, headers: NO_STORE });
      }
      challan_no = cj;
    }
    // Negative-stock guard: a movement may never take an owner's balance below zero.
    // Applies to every stock-out (dispatch, sale, damage_warehouse, adjust-down).
    // Corrections use 'receive' or 'adjust' up, never a forced negative.
    if (signed < 0) {
      const bres = await fetch(
        SB_URL + '/rest/v1/stock_movements?select=qty_base&owner_id=eq.' + encodeURIComponent(ownerId) +
        '&item_id=eq.' + encodeURIComponent(item_id),
        { headers: sbHeaders() }
      );
      const brows = await bres.json();
      const onHand = (Array.isArray(brows) ? brows : []).reduce((t: number, r: any) => t + Number(r.qty_base || 0), 0);
      if (onHand + signed < 0) {
        const unit = item.base_unit || 'unit';
        return NextResponse.json({
          error: 'Not enough stock. On hand: ' + onHand + ' ' + unit + 's; this would leave ' + (onHand + signed) + '.'
        }, { status: 400, headers: NO_STORE });
      }
    }
    const row = {
      owner_id: ownerId,
      item_id,
      movement_type,
      qty_base: signed,
      packs: packs,
      machine_id,
      note: body.note ? String(body.note).slice(0, 500) : null,
      sold_to_operator_id,
      sold_to_name,
      rate,
      taxable_value,
      buyer_company,
      buyer_address,
      buyer_gstin,
      buyer_contact,
      challan_no,
      created_by: String(session.sub || ''),
    };
    const res = await fetch(SB_URL + '/rest/v1/stock_movements', {
      method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    });
    const d = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'insert failed', detail: d }, { status: 500, headers: NO_STORE });

    const movement = Array.isArray(d) ? d[0] : d;
    // Append-only ledger: every movement is a new record, so there is no prior
    // state to diff. old_value stays null; new_value is the movement itself.
    // owner_id is scoped to the affected stock's tenant, not the actor's.
    await logAudit({
      session,
      action: movement_type,
      module: 'warehouse',
      entity_table: 'stock_movements',
      entity_id: movement && movement.id ? String(movement.id) : null,
      old_value: null,
      new_value: movement,
      owner_id: ownerId,
      req: request,
    });

    return NextResponse.json({ success: true, movement }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
