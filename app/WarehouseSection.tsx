'use client';
import { useState, useEffect } from 'react';
import { formatMoney, useIsMobile } from './lib/dashboard-shared';

// Dashboard-native Warehouse section — redesigned.
// Grouped, eyebrow-labelled field sections in a 2-column form + sticky summary
// rail; KPI strip; status pills on stock; responsive. All logic preserved:
// server-scoped /api/warehouse calls, isSuper/canManage gating, buyer auto-fill,
// per-box math, challan button, Sale hidden for operators.

const C = {
  active: '#FE6505', bg: '#f4f5f9', surface: '#ffffff', surface2: '#f4f5f9',
  border: '#e8eaf0', border2: '#dcdfe9', text: '#1f2533', text2: '#5b6478', text3: '#9099ac',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  amber: '#c98a00', amberBg: '#fff7e0', blue: '#0D6EFD', blueBg: '#e7f0ff',
  orange: '#FE6505', orangeBg: '#fff3ea', indigo: '#423A8E', indigoBg: '#efeefc',
  dangerDeep: '#B00020',
};

type Item = {
  id: string; category: string; country?: string; size?: number; name: string;
  base_unit: string; pack_size: number; pack_label: string; machine_type?: string;
  on_hand?: number; boxes_equiv?: number | null;
};
type Machine = { id: string; display_name?: string; sn?: string };
type Movement = {
  id: string; item_id: string; movement_type: string; qty_base: number; packs?: number;
  machine_id?: string; note?: string; created_at: string; created_by_name?: string; challan_no?: string;
};

// "N boxes + M pcs" for a damage write-off. Pieces are derived, not stored:
// pcs = |qty_base| − boxes × box_size (matches how the server composes the total).
function damageParts(qtyBaseAbs: number, boxes: number, packSize: number, packLabel = 'box'): string {
  const pieces = qtyBaseAbs - (boxes || 0) * (packSize || 1);
  const parts: string[] = [];
  if (boxes > 0) parts.push(`${boxes} ${packLabel}${boxes !== 1 ? 'es' : ''}`);
  if (pieces > 0) parts.push(`${pieces} pc${pieces !== 1 ? 's' : ''}`);
  return parts.join(' + ');
}

export default function WarehouseSection({ role = 'operator', permissions = {} }: { role?: string; permissions?: Record<string, boolean> }) {
  const isSuper = role === 'super_admin' || role === 'staff';
  const canManage = role === 'super_admin' || permissions.can_manage_warehouse === true;
  const [tab, setTab] = useState<'onhand' | 'receive' | 'dispatch' | 'sale' | 'damage' | 'log'>('onhand');
  const [items, setItems] = useState<Item[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [itemId, setItemId] = useState('');
  const [packs, setPacks] = useState('');
  const [pcs, setPcs] = useState(''); // damage only: loose pieces (oranges)
  const [machineId, setMachineId] = useState('');
  const [note, setNote] = useState('');
  const [operators, setOperators] = useState<{id:string;name:string;company_name?:string;billing_address?:string;gstin?:string;pincode?:string;phone?:string}[]>([]);
  const [soldToOp, setSoldToOp] = useState('');
  const [soldToName, setSoldToName] = useState('');
  const [rate, setRate] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [saving, setSaving] = useState(false);

  // fetch() only rejects on a network failure — an HTTP 403/401 resolves fine, so
  // a permission failure used to slip past `Array.isArray(d)` and leave the state
  // empty with no error, indistinguishable from "no data". Every loader now treats
  // a non-2xx as a visible error. loadOnhand owns the primary access message and
  // runs first; the secondary loaders use setErr(prev => prev || …) so they never
  // clobber it when the whole warehouse 403s at once (the auth gate is shared).
  async function loadOnhand() {
    try {
      const r = await fetch('/api/warehouse?onhand=1', { cache: 'no-store' });
      if (!r.ok) { setErr("Couldn't load items — you may not have warehouse access."); return; }
      const d = await r.json();
      if (Array.isArray(d)) { setItems(d); if (!itemId && d[0]) setItemId(d[0].id); }
    } catch { setErr("Couldn't load items — check your connection and retry."); }
  }
  async function loadMachines() {
    try {
      const r = await fetch('/api/warehouse?dispatchable=1', { cache: 'no-store' });
      if (!r.ok) { setErr(prev => prev || "Couldn't load machines for dispatch."); return; }
      const d = await r.json();
      if (Array.isArray(d)) { setMachines(d); if (!machineId && d[0]) setMachineId(d[0].id); }
    } catch { setErr(prev => prev || "Couldn't load machines for dispatch."); }
  }
  async function loadOperators() {
    try {
      const r = await fetch('/api/warehouse?buyers=1', { cache: 'no-store' });
      if (!r.ok) { setErr(prev => prev || "Couldn't load the buyer list."); return; }
      const d = await r.json();
      const arr = Array.isArray(d) ? d : [];
      setOperators(arr.map((o:any)=>({id:o.id,name:o.name||o.email,company_name:o.company_name||'',billing_address:o.billing_address||'',gstin:o.gstin||'',pincode:o.pincode||'',phone:o.phone||''})));
    } catch { setErr(prev => prev || "Couldn't load the buyer list."); }
  }
  async function loadLog() {
    try {
      const r = await fetch('/api/warehouse?movements=1', { cache: 'no-store' });
      if (!r.ok) { setErr(prev => prev || "Couldn't load the movement log."); return; }
      const d = await r.json();
      if (Array.isArray(d)) setMovements(d);
    } catch { setErr(prev => prev || "Couldn't load the movement log."); }
  }

  useEffect(() => {
    (async () => { setLoading(true); await loadOnhand(); await loadMachines(); await loadOperators(); await loadLog(); setLoading(false); })();
  }, []);

  const itemById = (id: string) => items.find(i => i.id === id);
  const machineLabel = (m?: Machine) => m ? (m.display_name || m.sn || m.id.slice(0, 6)) : '';
  const selItem = itemById(itemId);
  const previewBase = selItem && packs ? Number(packs) * selItem.pack_size : 0;
  // Damage total in oranges: whole boxes × box_size + loose pieces.
  const damageOranges = selItem ? (Number(packs) || 0) * selItem.pack_size + (Number(pcs) || 0) : 0;
  const taxable = packs && rate ? Number(packs) * Number(rate) : 0;
  // Warehouse stock is sold from the Indian entity and invoiced in INR; there is
  // no per-sale currency column. Rate is typed in major units, so it is scaled
  // to minor units for formatMoney, which always shows two decimals here.
  //
  // A second selling entity would sell in its own currency and be invoiced in
  // it — the currency follows the entity making the sale, and is never restated
  // into a base currency. A challan has to match the buyer's bank statement.
  //
  // The old preview passed only minimumFractionDigits, so it inherited Intl's
  // default maximum of 3 and could read ₹12,34,567.891 for a rate typed to three
  // decimals — while POST /api/warehouse stores Math.round(rate * boxes * 100) /
  // 100, i.e. ₹12,34,567.89. The preview now shows the value that is recorded.
  const saleCur = 'INR';
  const fmtTaxable = (v: number) => formatMoney(Math.round(v * 100), saleCur, { minDigits: 2 });

  async function record(movement_type: 'receive' | 'dispatch' | 'sale' | 'damage_warehouse') {
    setErr(''); setMsg('');
    if (!itemId) { setErr('Pick an item'); return; }
    if (movement_type === 'damage_warehouse') {
      if (damageOranges <= 0) { setErr('Enter boxes and/or pieces to write off'); return; }
    } else if (!packs || Number(packs) <= 0) { setErr('Enter a quantity'); return; }
    if (movement_type === 'dispatch' && !machineId) { setErr('Pick a machine'); return; }
    if (movement_type === 'sale') {
      if (!soldToOp && !soldToName.trim()) { setErr('Pick a buyer or type a name'); return; }
      if (!rate || Number(rate) <= 0) { setErr('Enter the ex-GST rate per box'); return; }
      if (!buyerCompany.trim()) { setErr('Enter buyer company'); return; }
      if (!buyerAddress.trim()) { setErr('Enter buyer address'); return; }
      if (!buyerContact.trim()) { setErr('Enter buyer contact'); return; }
    }
    setSaving(true);
    try {
      const body: any = { item_id: itemId, movement_type, packs: Number(packs) || 0, note: note.trim() || null };
      if (movement_type === 'damage_warehouse') body.pcs = Number(pcs) || 0;
      if (movement_type === 'dispatch') body.machine_id = machineId;
      if (movement_type === 'sale') {
        if (soldToOp) body.sold_to_operator_id = soldToOp; else body.sold_to_name = soldToName.trim();
        body.rate = Number(rate);
        body.buyer_company = buyerCompany.trim();
        body.buyer_address = buyerAddress.trim();
        body.buyer_gstin = buyerGstin.trim() || null;
        body.buyer_contact = buyerContact.trim();
      }
      const r = await fetch('/api/warehouse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Failed'); setPacks(''); setSaving(false); return; }
      const it = itemById(itemId);
      if (movement_type === 'damage_warehouse') {
        const total = (Number(packs) || 0) * (it ? it.pack_size : 1) + (Number(pcs) || 0);
        const breakdown = damageParts(total, Number(packs) || 0, it ? it.pack_size : 1, it?.pack_label || 'box');
        setMsg(`Wrote off ${breakdown} = ${total} ${it?.base_unit || ''}${total !== 1 ? 's' : ''}.`);
      } else {
        const base = Number(packs) * (it ? it.pack_size : 1);
        const verb = movement_type === 'receive' ? 'Received'
          : movement_type === 'dispatch' ? 'Dispatched'
          : movement_type === 'sale' ? 'Sold'
          : 'Recorded';
        setMsg(`${verb} ${packs} ${it?.pack_label || ''}${Number(packs) > 1 ? 's' : ''} = ${base} ${it?.base_unit || ''}${base > 1 ? 's' : ''}.`);
      }
      setPacks(''); setPcs(''); setNote(''); setSoldToOp(''); setSoldToName(''); setRate(''); setBuyerCompany(''); setBuyerAddress(''); setBuyerGstin(''); setBuyerContact('');
      await loadOnhand(); await loadLog();
    } catch { setErr('Network problem'); }
    setSaving(false);
  }

  const fruit = items.filter(i => i.category === 'fruit');
  const cons = items.filter(i => i.category === 'consumable');
  // Anything that is neither fruit nor consumable (a new/typo/null category). These
  // used to fall through every filter — invisible in the picker AND absent from the
  // On-hand tables and KPIs. An owned item must never silently vanish from stock, so
  // it is surfaced in all three (only when non-empty, so the normal case is unchanged).
  const other = items.filter(i => i.category !== 'fruit' && i.category !== 'consumable');

  // ---- derived KPI figures ----
  const totalOranges = fruit.reduce((s, i) => s + (i.on_hand ?? 0), 0);
  const totalBoxes = fruit.reduce((s, i) => s + (i.boxes_equiv ?? 0), 0);
  const consLow = cons.filter(i => (i.on_hand ?? 0) <= i.pack_size * 2).length;
  const totalOther = other.reduce((s, i) => s + (i.on_hand ?? 0), 0);
  const today = new Date().toDateString();
  const movesToday = movements.filter(m => new Date(m.created_at).toDateString() === today).length;

  // ---- tab list (unchanged logic) ----
  const TABS = (!canManage
    ? [['onhand', 'On hand'], ['log', 'Movement log']]
    : isSuper
    ? [['onhand', 'On hand'], ['receive', 'Receive'], ['dispatch', 'Dispatch'], ['sale', 'Sale'], ['damage', 'Damage'], ['log', 'Movement log']]
    : [['onhand', 'On hand'], ['receive', 'Receive'], ['dispatch', 'Dispatch'], ['damage', 'Damage'], ['log', 'Movement log']]) as [string, string][];

  const qtyHint = selItem
    ? (previewBase ? `= ${previewBase} ${selItem.base_unit}${previewBase !== 1 ? 's' : ''}` : `1 ${selItem.pack_label} = ${selItem.pack_size} ${selItem.base_unit}s`)
    : '';

  const ItemSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select style={inp} value={value} onChange={e => onChange(e.target.value)}>
      <optgroup label="Fruit">{fruit.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
      <optgroup label="Consumables">{cons.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
      {other.length > 0 && <optgroup label="Other">{other.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>}
    </select>
  );

  return (
    <div style={{ padding: isMobile ? 16 : 24, background: C.bg, minHeight: '100%', overflow: 'auto' }}>
      {!canManage && (
        <div style={{ padding: '10px 14px', background: '#fff8e6', border: '1px solid #ffe08a', borderRadius: 10, fontSize: 13, color: '#8a6d00', marginBottom: 16 }}>
          👁 View-only access. You can see stock levels and history. Ask a super admin to grant &quot;Manage warehouse&quot; to record movements.
        </div>
      )}

      {/* KPI strip */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap: isMobile ? 10 : 14, marginBottom: 18 }}>
          <StatCard label="Oranges on hand" value={totalOranges.toLocaleString('en-IN')} sub={`${totalBoxes} boxes`} icon="🍊" color={C.orange} />
          <StatCard label="Consumables" value={String(cons.length)} sub={consLow ? `${consLow} low` : 'all stocked'} icon="📦" color={C.blue} />
          <StatCard label="Machines" value={String(machines.length)} sub={isSuper ? 'fleet' : 'you service'} icon="▣" color={C.green} />
          <StatCard label="Movements today" value={String(movesToday)} sub={`${movements.length} total`} icon="🔁" color={C.indigo} />
          {other.length > 0 && (
            <StatCard label="Other items" value={String(other.length)} sub={`${totalOther.toLocaleString('en-IN')} on hand · check category`} icon="❓" color={C.amber} />
          )}
        </div>
      )}

      {/* tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k as any); setErr(''); setMsg(''); }}
            style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid ' + (tab === k ? C.orange : C.border), background: tab === k ? C.orange : C.surface, color: tab === k ? '#fff' : C.text2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{l}</button>
        ))}
      </div>

      {err && <div style={{ padding: '11px 14px', background: C.redBg, color: C.red, borderRadius: 9, fontSize: 14, marginBottom: 14 }}>{err}</div>}
      {msg && <div style={{ padding: '11px 14px', background: C.greenBg, color: C.green, borderRadius: 9, fontSize: 14, marginBottom: 14, fontWeight: 600 }}>{msg}</div>}

      {loading && <div style={{ color: C.text2 }}>Loading…</div>}

      {/* ON HAND */}
      {!loading && tab === 'onhand' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ ...card, borderTop: `3px solid ${C.green}` }}>
            <div style={cardTitle}>🍊 Fruit</div>
            <table className="fl-stack" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>On hand</th><th style={{ ...th, textAlign: 'right' }}>Boxes</th></tr></thead>
              <tbody>
                {fruit.map(i => (
                  <tr key={i.id}>
                    <td data-label="Item" style={td}>{i.name}</td>
                    <td data-label="On hand" style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{(i.on_hand ?? 0).toLocaleString('en-IN')}</td>
                    <td data-label="Boxes" style={{ ...td, textAlign: 'right', color: C.text2 }}>{i.boxes_equiv ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...card, borderTop: `3px solid ${C.blue}` }}>
            <div style={cardTitle}>📦 Consumables</div>
            <table className="fl-stack" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>On hand</th><th style={{ ...th, textAlign: 'right' }}></th></tr></thead>
              <tbody>
                {cons.map(i => {
                  const low = (i.on_hand ?? 0) <= i.pack_size * 2;
                  return (
                    <tr key={i.id}>
                      <td data-label="Item" style={td}>{i.name}{i.machine_type && i.machine_type !== 'common' ? <span style={{ color: C.text3, fontSize: 12 }}> ({i.machine_type})</span> : ''}</td>
                      <td data-label="On hand" style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{(i.on_hand ?? 0).toLocaleString('en-IN')} <span style={{ color: C.text3, fontWeight: 400, fontSize: 12 }}>{i.base_unit}s</span></td>
                      <td data-label="Status" style={{ ...td, textAlign: 'right' }}>
                        <Pill color={low ? C.red : C.green} bg={low ? C.redBg : C.greenBg}>{low ? 'Low' : 'OK'}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {other.length > 0 && (
            <div style={{ ...card, borderTop: `3px solid ${C.amber}`, gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <div style={cardTitle}>❓ Other <span style={{ fontWeight: 400, fontSize: 12, color: C.text3 }}>— uncategorised, check item setup</span></div>
              <table className="fl-stack" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>On hand</th><th style={th}>Category</th></tr></thead>
                <tbody>
                  {other.map(i => (
                    <tr key={i.id}>
                      <td data-label="Item" style={td}>{i.name}</td>
                      <td data-label="On hand" style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{(i.on_hand ?? 0).toLocaleString('en-IN')} <span style={{ color: C.text3, fontWeight: 400, fontSize: 12 }}>{i.base_unit}s</span></td>
                      <td data-label="Category" style={{ ...td, color: C.text2 }}>{i.category || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RECEIVE / DISPATCH / DAMAGE — form + summary rail */}
      {!loading && (tab === 'receive' || tab === 'dispatch' || tab === 'damage') && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.7fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ ...card, padding: isMobile ? 18 : 24 }}>
            {tab === 'receive' && <ActionHeader icon="📥" color={C.orange} title="Receive stock into warehouse" subtitle="Log a delivery arriving into the warehouse." />}
            {tab === 'dispatch' && <ActionHeader icon="🚚" color={C.blue} title="Dispatch stock to a machine" subtitle="Move stock out to a machine you service." />}
            {tab === 'damage' && <ActionHeader icon="⚠️" color={C.red} title="Write off damaged stock" subtitle="Remove spoiled or damaged stock from the warehouse." />}

            <FormGroup label="Item & quantity" isMobile={isMobile}>
              <Field label="Item" span2={tab !== 'dispatch'}><ItemSelect value={itemId} onChange={setItemId} /></Field>
              {tab === 'dispatch' && (
                <Field label="To machine">
                  {machines.length === 0
                    ? <div style={{ padding: '10px 12px', borderRadius: 8, background: C.orangeBg, color: '#B25000', fontSize: 13.5 }}>You do not service any machines.</div>
                    : <select style={inp} value={machineId} onChange={e => setMachineId(e.target.value)}>{machines.map(m => <option key={m.id} value={m.id}>{machineLabel(m)}</option>)}</select>}
                </Field>
              )}
              {tab === 'damage' ? (
                <>
                  <Field label={`Boxes (${selItem?.pack_label || 'box'}s)`} hint={selItem ? `× ${selItem.pack_size} ${selItem.base_unit}s each` : ''} hintColor={C.dangerDeep}>
                    <input style={inp} type="number" inputMode="numeric" value={packs} onChange={e => setPacks(e.target.value)} placeholder={selItem ? `Whole ${selItem.pack_label}s` : ''} />
                  </Field>
                  <Field label={`Pieces (${selItem?.base_unit || 'orange'}s)`} hint={damageOranges ? `= ${damageOranges} ${selItem?.base_unit || 'orange'}s total` : ''} hintColor={C.dangerDeep}>
                    <input style={inp} type="number" inputMode="numeric" value={pcs} onChange={e => setPcs(e.target.value)} placeholder={`Loose ${selItem?.base_unit || 'orange'}s`} />
                  </Field>
                </>
              ) : (
                <Field label={`Quantity (${selItem?.pack_label || 'unit'}s)`} hint={qtyHint} hintColor={C.orange} span2>
                  <input style={inp} type="number" inputMode="numeric" value={packs} onChange={e => setPacks(e.target.value)} placeholder={selItem ? `Number of ${selItem.pack_label}s` : ''} />
                </Field>
              )}
            </FormGroup>

            <FormGroup label={tab === 'damage' ? 'Reason' : 'Reference'} isMobile={isMobile}>
              <Field label={tab === 'receive' ? 'Note (supplier / invoice)' : tab === 'damage' ? 'Reason' : 'Note (optional)'} span2>
                <input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder={tab === 'receive' ? 'Supplier / invoice…' : tab === 'damage' ? 'Rotten / spoiled / damaged…' : 'Reason…'} />
              </Field>
            </FormGroup>

            <button onClick={() => record(tab === 'receive' ? 'receive' : tab === 'dispatch' ? 'dispatch' : 'damage_warehouse')} disabled={saving}
              style={{ marginTop: 4, padding: '12px 24px', border: 'none', borderRadius: 9, background: tab === 'receive' ? C.orange : tab === 'dispatch' ? C.blue : C.dangerDeep, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : tab === 'receive' ? 'Receive stock' : tab === 'dispatch' ? 'Dispatch to machine' : 'Write off damaged'}
            </button>
          </div>

          {!isMobile && (
            <SummaryRail title="Summary">
              <RailRow label="Item" value={selItem ? selItem.name : '—'} />
              <RailRow label="Current on hand" value={selItem ? `${(selItem.on_hand ?? 0).toLocaleString('en-IN')} ${selItem.base_unit}s` : '—'} />
              {tab === 'dispatch' && machines.length > 0 && <RailRow label="Destination" value={machineLabel(machines.find(m => m.id === machineId))} />}
              <RailRow
                label={tab === 'damage' ? 'Writing off' : tab === 'receive' ? 'Adding' : 'Removing'}
                value={(tab === 'damage' ? damageOranges : previewBase) ? `${tab === 'damage' ? damageOranges : previewBase} ${selItem?.base_unit}s` : '—'}
                color={tab === 'receive' ? C.green : tab === 'damage' ? C.dangerDeep : C.blue}
                big
              />
              {tab === 'damage' && damageOranges > 0 && selItem && (
                <RailRow label="Breakdown" value={damageParts(damageOranges, Number(packs) || 0, selItem.pack_size, selItem.pack_label) || '—'} />
              )}
              {selItem && <div style={{ marginTop: 12, fontSize: 12, color: C.text3, lineHeight: 1.5 }}>{tab === 'damage'
                ? `1 ${selItem.pack_label} = ${selItem.pack_size} ${selItem.base_unit}s. Enter whole ${selItem.pack_label}s and/or loose ${selItem.base_unit}s; total = boxes × ${selItem.pack_size} + pieces.`
                : `1 ${selItem.pack_label} = ${selItem.pack_size} ${selItem.base_unit}s. Enter whole ${selItem.pack_label}s; the warehouse tracks ${selItem.base_unit}s.`}</div>}
            </SummaryRail>
          )}
        </div>
      )}

      {/* SALE — super admin only */}
      {!loading && tab === 'sale' && isSuper && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.7fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ ...card, padding: isMobile ? 18 : 24 }}>
            <ActionHeader icon="🧾" color={C.indigo} title="Sell stock to an operator or buyer" subtitle="Records a taxable sale and generates a delivery challan." />

            <FormGroup label="What & how much" isMobile={isMobile}>
              <Field label="Item"><ItemSelect value={itemId} onChange={setItemId} /></Field>
              <Field label={`Quantity (${selItem?.pack_label || 'box'}s)`} hint={qtyHint} hintColor={C.orange}>
                <input style={inp} type="number" inputMode="numeric" value={packs} onChange={e => setPacks(e.target.value)} placeholder={selItem ? `Number of ${selItem.pack_label}s` : ''} />
              </Field>
              <Field label={`Rate per ${selItem?.pack_label || 'box'} (ex-GST)`} hint={taxable ? `Taxable value = ${fmtTaxable(taxable)}` : ''} hintColor={C.green}>
                <input style={inp} type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="Price per box, before GST" />
              </Field>
              <Field label="Note (optional)"><input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder="Internal reference…" /></Field>
            </FormGroup>

            <FormGroup label="Buyer details" isMobile={isMobile}>
              <Field label="Buyer (operator)">
                <select style={inp} value={soldToOp} onChange={e => {
                  const id = e.target.value; setSoldToOp(id);
                  if (id) {
                    setSoldToName('');
                    const op = operators.find(o => o.id === id);
                    // Re-fill from the newly selected operator; clear if it can't be
                    // found so we never leave a previous operator's details behind.
                    setBuyerCompany(op ? (op.company_name || op.name || '') : '');
                    setBuyerAddress(op ? [op.billing_address, op.pincode].filter(Boolean).join(' - ') : '');
                    setBuyerGstin(op?.gstin || '');
                    setBuyerContact(op?.phone || '');
                  } else {
                    // "Other buyer" / none — clear the operator-derived fields so a
                    // non-operator sale starts blank and can't inherit a previous
                    // operator's company / address / GSTIN / contact on the challan.
                    setBuyerCompany('');
                    setBuyerAddress('');
                    setBuyerGstin('');
                    setBuyerContact('');
                  }
                }}>
                  <option value="">— Other buyer (type below) —</option>
                  {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              {!soldToOp && <Field label="Other buyer name"><input style={inp} value={soldToName} onChange={e => setSoldToName(e.target.value)} placeholder="Buyer name (non-operator)" /></Field>}
              <Field label="Buyer company" span2={!!soldToOp}><input style={inp} value={buyerCompany} onChange={e => setBuyerCompany(e.target.value)} placeholder="Registered company name" /></Field>
              <Field label="Buyer address" span2><input style={inp} value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} placeholder="Billing / shipping address" /></Field>
              <Field label="Buyer GSTIN (optional)"><input style={inp} value={buyerGstin} onChange={e => setBuyerGstin(e.target.value)} placeholder="Leave blank if unregistered" /></Field>
              <Field label="Buyer contact"><input style={inp} value={buyerContact} onChange={e => setBuyerContact(e.target.value)} placeholder="Phone and/or email" /></Field>
            </FormGroup>

            <button onClick={() => record('sale')} disabled={saving}
              style={{ marginTop: 4, padding: '12px 24px', border: 'none', borderRadius: 9, background: C.orange, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Record sale'}
            </button>
          </div>

          {!isMobile && (
            <SummaryRail title="Sale summary">
              <RailRow label="Item" value={selItem ? selItem.name : '—'} />
              <RailRow label="Quantity" value={previewBase ? `${previewBase} ${selItem?.base_unit}s` : '—'} />
              <RailRow label="On hand after" value={selItem ? `${((selItem.on_hand ?? 0) - previewBase).toLocaleString('en-IN')} ${selItem.base_unit}s` : '—'} color={C.blue} />
              <RailRow label="Taxable value" value={taxable ? fmtTaxable(taxable) : '—'} color={C.green} big />
              <div style={{ marginTop: 12 }}><Pill color={C.indigo} bg={C.indigoBg}>📄 Challan auto-generated</Pill></div>
              <div style={{ marginTop: 10, fontSize: 12, color: C.text3, lineHeight: 1.5 }}>GST is added by accounts. Value shown is the ex-GST taxable value.</div>
            </SummaryRail>
          )}
        </div>
      )}

      {/* LOG */}
      {!loading && tab === 'log' && (
        <div style={card}>
          <div style={cardTitle}>Movement log</div>
          {movements.length === 0 && <div style={{ color: C.text2, fontSize: 14 }}>No movements yet.</div>}

          {!isMobile && movements.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr><th style={th}>When</th><th style={th}>Type</th><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={th}>Machine</th><th style={th}>By</th><th style={th}>Note</th>{isSuper && <th style={th}>Challan</th>}</tr></thead>
              <tbody>
                {movements.map(m => {
                  const it = itemById(m.item_id); const mac = machines.find(x => x.id === m.machine_id);
                  return (
                    <tr key={m.id}>
                      <td style={{ ...td, color: C.text2, whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString('en-IN')}</td>
                      <td style={td}><MovementBadge type={m.movement_type} /></td>
                      <td style={td}>{it ? it.name : m.item_id.slice(0, 6)}
                        {m.movement_type === 'damage_warehouse' && it && (() => {
                          const bd = damageParts(Math.abs(m.qty_base), m.packs || 0, it.pack_size, it.pack_label);
                          return bd ? <div style={{ fontSize: 11, color: C.text3, fontWeight: 400 }}>{bd}</div> : null;
                        })()}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: m.qty_base >= 0 ? C.green : C.blue }}>{m.qty_base >= 0 ? '+' : ''}{m.qty_base}</td>
                      <td style={{ ...td, color: C.text2 }}>{mac ? machineLabel(mac) : '—'}</td>
                      <td style={{ ...td, color: C.text2 }}>{m.created_by_name || '—'}</td>
                      <td style={{ ...td, color: C.text2 }}>{m.note || '—'}</td>
                      {isSuper && <td style={td}>{m.movement_type === 'sale' && m.challan_no
                        ? <a href={'/api/challan?sale_id=' + m.id} target="_blank" rel="noreferrer" style={{ color: C.blue, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }} title={m.challan_no}>📄 Challan</a>
                        : '—'}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {isMobile && movements.map(m => {
            const it = itemById(m.item_id); const mac = machines.find(x => x.id === m.machine_id);
            const accent = m.movement_type === 'receive' ? C.green : m.movement_type === 'sale' ? C.indigo : m.movement_type === 'damage_warehouse' ? C.red : C.blue;
            const unit = it ? it.base_unit + 's' : '';
            return (
              <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid ' + C.border, overflow: 'hidden', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 5, background: accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <MovementBadge type={m.movement_type} solid />
                        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 8 }}>{it ? it.name : m.item_id.slice(0, 6)}</div>
                        {m.movement_type === 'damage_warehouse' && it && (() => {
                          const bd = damageParts(Math.abs(m.qty_base), m.packs || 0, it.pack_size, it.pack_label);
                          return bd ? <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{bd}</div> : null;
                        })()}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1 }}>{m.qty_base >= 0 ? '+' : ''}{m.qty_base}</div>
                        {unit && <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{unit}</div>}
                      </div>
                    </div>
                    <div style={{ borderTop: '0.5px solid ' + C.border, paddingTop: 10, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 10px', fontSize: 12.5 }}>
                      <span style={{ color: C.text3 }}>Time</span>
                      <span style={{ color: C.text2, textAlign: 'right' }}>{new Date(m.created_at).toLocaleString('en-IN')}</span>
                      {mac && <><span style={{ color: C.text3 }}>Machine</span><span style={{ color: C.text2, textAlign: 'right', fontWeight: 600 }}>{machineLabel(mac)}</span></>}
                      <span style={{ color: C.text3 }}>By</span>
                      <span style={{ color: C.text2, textAlign: 'right' }}>{m.created_by_name || '—'}</span>
                      {m.note && <><span style={{ color: C.text3 }}>Note</span><span style={{ color: C.text2, textAlign: 'right' }}>{m.note}</span></>}
                      {isSuper && m.movement_type === 'sale' && m.challan_no && <><span style={{ color: C.text3 }}>Challan</span><span style={{ textAlign: 'right' }}><a href={'/api/challan?sale_id=' + m.id} target="_blank" rel="noreferrer" style={{ color: C.blue, fontWeight: 700, textDecoration: 'none' }}>📄 {m.challan_no}</a></span></>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- presentational helpers ----
function StatCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.text3 }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: C.text, marginTop: 6, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.text2, marginTop: 6 }}>{sub}</div>}
      <div style={{ height: 3, background: color, borderRadius: 2, marginTop: 12, opacity: 0.85 }} />
    </div>
  );
}

function FormGroup({ label, children, isMobile }: { label: string; children: React.ReactNode; isMobile: boolean }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.text3, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{label}</span><span style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px 18px' }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, hintColor, span2, children }: { label: string; hint?: string; hintColor?: string; span2?: boolean; children: React.ReactNode }) {
  return (
    <div style={span2 ? { gridColumn: '1 / -1' } : undefined}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: hintColor || C.text3 }}>{hint}</div>}
    </div>
  );
}

function SummaryRail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'sticky', top: 0, alignSelf: 'start', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.text3, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function RailRow({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12.5, color: C.text2 }}>{label}</span>
      <span style={{ fontSize: big ? 20 : 14, fontWeight: 700, color: color || C.text }}>{value}</span>
    </div>
  );
}

function ActionHeader({ icon, color, title, subtitle }: { icon: string; color: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 19, flexShrink: 0, background: color + '22' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>{title}</div>
        <div style={{ fontSize: 13, color: C.text2, marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Pill({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>{children}</span>;
}

function MovementBadge({ type, solid }: { type: string; solid?: boolean }) {
  const map: Record<string, { c: string; bg: string }> = {
    receive: { c: C.green, bg: C.greenBg },
    dispatch: { c: C.blue, bg: C.blueBg },
    sale: { c: C.indigo, bg: C.indigoBg },
    damage_warehouse: { c: C.red, bg: C.redBg },
  };
  const s = map[type] || { c: C.amber, bg: C.amberBg };
  const label = type === 'damage_warehouse' ? 'damage' : type;
  if (solid) return <span style={{ background: s.c, color: '#fff', padding: '3px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>;
  return <span style={{ background: s.bg, color: s.c, padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>;
}

const card: React.CSSProperties = { background: C.surface, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid ' + C.border };
const td: React.CSSProperties = { padding: '10px', borderBottom: '1px solid ' + C.border, color: C.text };
const inp: React.CSSProperties = { width: '100%', padding: '11px', fontSize: 15, border: '1px solid ' + C.border2, borderRadius: 9, boxSizing: 'border-box', background: '#fff', color: C.text };
