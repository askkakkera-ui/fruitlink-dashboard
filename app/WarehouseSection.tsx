'use client';
import { useState, useEffect } from 'react';

// Dashboard-native Warehouse section — full-width, matches dashboard C tokens.
// Calls the secure /api/warehouse route (auth + scoping server-side).

const C = {
  active: '#FE6505', bg: '#f4f5f9', surface: '#ffffff', surface2: '#f4f5f9',
  border: '#e8eaf0', border2: '#dcdfe9', text: '#1f2533', text2: '#5b6478', text3: '#9099ac',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  amber: '#c98a00', amberBg: '#fff7e0', blue: '#0D6EFD', blueBg: '#e7f0ff',
  orange: '#FE6505', orangeBg: '#fff3ea',
};

type Item = {
  id: string; category: string; country?: string; size?: number; name: string;
  base_unit: string; pack_size: number; pack_label: string; machine_type?: string;
  on_hand?: number; boxes_equiv?: number | null;
};
type Machine = { id: string; display_name?: string; sn?: string };
type Movement = {
  id: string; item_id: string; movement_type: string; qty_base: number; packs?: number;
  machine_id?: string; note?: string; created_at: string; created_by_name?: string;
};

export default function WarehouseSection({ role = 'operator', permissions = {} }: { role?: string; permissions?: Record<string, boolean> }) {
  const isSuper = role === 'super_admin' || role === 'staff';  // Fruitlink staff see Fruitlink's warehouse
  // Who may WRITE: super_admin & operators always; staff only with can_manage_warehouse.
  const canManage = role === 'super_admin' || permissions.can_manage_warehouse === true;
  const [tab, setTab] = useState<'onhand' | 'receive' | 'dispatch' | 'sale' | 'damage' | 'transfer' | 'incoming' | 'log'>('onhand');
  const [items, setItems] = useState<Item[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [itemId, setItemId] = useState('');
  const [packs, setPacks] = useState('');
  const [machineId, setMachineId] = useState('');
  const [note, setNote] = useState('');
  const [operators, setOperators] = useState<{id:string;name:string}[]>([]);
  const [soldToOp, setSoldToOp] = useState('');
  const [soldToName, setSoldToName] = useState('');
  const [xferTo, setXferTo] = useState('');
  const [pending, setPending] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadOnhand() {
    try {
      const r = await fetch('/api/warehouse?onhand=1', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) { setItems(d); if (!itemId && d[0]) setItemId(d[0].id); }
    } catch { setErr('Could not load stock'); }
  }
  async function loadMachines() {
    // Only machines this user may actually dispatch to (server decides; same rule the POST guard enforces).
    try {
      const r = await fetch('/api/warehouse?dispatchable=1', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) { setMachines(d); if (!machineId && d[0]) setMachineId(d[0].id); }
    } catch { /* ignore */ }
  }
  async function loadOperators() {
    try {
      // Server decides who this user may sell/transfer to (never themselves).
      const r = await fetch('/api/warehouse?buyers=1', { cache: 'no-store' });
      const d = await r.json();
      const arr = Array.isArray(d) ? d : [];
      setOperators(arr.map((o:any)=>({id:o.id,name:o.name||o.email})));
    } catch { /* ignore */ }
  }
  async function loadPending() {
    try {
      const r = await fetch('/api/transfer?pending=1', { cache: 'no-store' });
      const d = await r.json();
      setPending(Array.isArray(d) ? d : []);
    } catch { /* ignore */ }
  }
  async function resolveTransfer(transfer_id: string, action: 'confirm' | 'reject') {
    setErr(''); setMsg(''); setSaving(true);
    try {
      const r = await fetch('/api/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transfer_id, action }) });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Failed'); setSaving(false); return; }
      setMsg(action === 'confirm' ? 'Receipt confirmed. Stock added to your warehouse.' : 'Transfer rejected. Stock returned to sender.');
      await loadPending(); await loadOnhand(); await loadLog();
    } catch { setErr('Network problem'); }
    setSaving(false);
  }
  async function loadLog() {
    try {
      const r = await fetch('/api/warehouse?movements=1', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) setMovements(d);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    (async () => { setLoading(true); await loadOnhand(); await loadMachines(); await loadOperators(); await loadPending(); await loadLog(); setLoading(false); })();
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const itemById = (id: string) => items.find(i => i.id === id);
  const machineLabel = (m?: Machine) => m ? (m.display_name || m.sn || m.id.slice(0, 6)) : '';
  const selItem = itemById(itemId);
  const previewBase = selItem && packs ? Number(packs) * selItem.pack_size : 0;

  async function record(movement_type: 'receive' | 'dispatch' | 'sale' | 'damage_warehouse' | 'transfer_out') {
    setErr(''); setMsg('');
    if (!itemId) { setErr('Pick an item'); return; }
    if (!packs || Number(packs) <= 0) { setErr('Enter a quantity'); return; }
    if (movement_type === 'dispatch' && !machineId) { setErr('Pick a machine'); return; }
    if (movement_type === 'sale' && !soldToOp && !soldToName.trim()) { setErr('Pick a buyer or type a name'); return; }
    if (movement_type === 'transfer_out' && !xferTo) { setErr('Pick an operator to transfer to'); return; }
    setSaving(true);
    try {
      const body: any = { item_id: itemId, movement_type, packs: Number(packs), note: note.trim() || null };
      if (movement_type === 'dispatch') body.machine_id = machineId;
      if (movement_type === 'sale') { if (soldToOp) body.sold_to_operator_id = soldToOp; else body.sold_to_name = soldToName.trim(); }
      if (movement_type === 'transfer_out') body.transfer_to_operator_id = xferTo;
      const r = await fetch('/api/warehouse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Failed'); setPacks(''); setSaving(false); return; }
      const it = itemById(itemId);
      const base = Number(packs) * (it ? it.pack_size : 1);
      const verb = movement_type === 'receive' ? 'Received'
        : movement_type === 'dispatch' ? 'Dispatched'
        : movement_type === 'sale' ? 'Sold'
        : movement_type === 'damage_warehouse' ? 'Wrote off'
        : movement_type === 'transfer_out' ? 'Sent'
        : 'Recorded';
      setMsg(`${verb} ${packs} ${it?.pack_label || ''}${Number(packs) > 1 ? 's' : ''} = ${base} ${it?.base_unit || ''}${base > 1 ? 's' : ''}.`);
      setPacks(''); setNote(''); setXferTo(''); setSoldToOp(''); setSoldToName('');
      await loadOnhand(); await loadLog();
    } catch { setErr('Network problem'); }
    setSaving(false);
  }

  const fruit = items.filter(i => i.category === 'fruit');
  const cons = items.filter(i => i.category === 'consumable');

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100%', overflow: 'auto' }}>
      {!canManage && (
        <div style={{ padding: '10px 14px', background: '#fff8e6', border: '1px solid #ffe08a', borderRadius: 10, fontSize: 13, color: '#8a6d00', marginBottom: 16 }}>
          👁 View-only access. You can see stock levels and history. Ask a super admin to grant "Manage warehouse" to record movements.
        </div>
      )}
      {/* tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {((!canManage
          ? [['onhand', 'On hand'], ['log', 'Movement log']]
          : isSuper
          ? [['onhand', 'On hand'], ['receive', 'Receive'], ['dispatch', 'Dispatch'], ['transfer', 'Transfer'], ['sale', 'Sale'], ['damage', 'Damage'], ['log', 'Movement log']]
          : [['onhand', 'On hand'], ['receive', 'Receive'], ['dispatch', 'Dispatch'], ['incoming', 'Incoming' + (pending.length ? ' (' + pending.length + ')' : '')], ['sale', 'Sale'], ['damage', 'Damage'], ['log', 'Movement log']]) as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k as any); setErr(''); setMsg(''); }}
            style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid ' + (tab === k ? C.orange : C.border), background: tab === k ? C.orange : C.surface, color: tab === k ? '#fff' : C.text2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {err && <div style={{ padding: '11px 14px', background: C.redBg, color: C.red, borderRadius: 9, fontSize: 14, marginBottom: 14 }}>{err}</div>}
      {msg && <div style={{ padding: '11px 14px', background: C.greenBg, color: C.green, borderRadius: 9, fontSize: 14, marginBottom: 14 }}>{msg}</div>}

      {loading && <div style={{ color: C.text2 }}>Loading…</div>}

      {/* ON HAND — two columns on desktop */}
      {!loading && tab === 'onhand' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
          <div style={card}>
            <div style={cardTitle}>Fruit</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>On hand</th><th style={{ ...th, textAlign: 'right' }}>Boxes</th></tr></thead>
              <tbody>
                {fruit.map(i => (
                  <tr key={i.id}>
                    <td style={td}>{i.name}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{i.on_hand ?? 0}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.text2 }}>{i.boxes_equiv ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={card}>
            <div style={cardTitle}>Consumables</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>On hand</th></tr></thead>
              <tbody>
                {cons.map(i => (
                  <tr key={i.id}>
                    <td style={td}>{i.name}{i.machine_type && i.machine_type !== 'common' ? <span style={{ color: C.text3, fontSize: 12 }}> ({i.machine_type})</span> : ''}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{i.on_hand ?? 0} <span style={{ color: C.text3, fontWeight: 400, fontSize: 12 }}>{i.base_unit}s</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECEIVE / DISPATCH */}
      {!loading && (tab === 'receive' || tab === 'dispatch') && (
        <div style={{ ...card, maxWidth: 560 }}>
          <div style={cardTitle}>{tab === 'receive' ? 'Receive stock into warehouse' : 'Dispatch stock to a machine'}</div>
          <label style={lbl}>Item</label>
          <select style={inp} value={itemId} onChange={e => setItemId(e.target.value)}>
            <optgroup label="Fruit">{fruit.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
            <optgroup label="Consumables">{cons.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
          </select>

          {tab === 'dispatch' && (<>
            <label style={lbl}>To machine</label>
            {machines.length === 0 ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff3ea', color: '#B25000', fontSize: 13.5, marginBottom: 4 }}>
                You do not service any machines. Use the Transfer tab to send stock to an operator.
              </div>
            ) : (
              <select style={inp} value={machineId} onChange={e => setMachineId(e.target.value)}>
                {machines.map(m => <option key={m.id} value={m.id}>{machineLabel(m)}</option>)}
              </select>
            )}
          </>)}

          <label style={lbl}>Quantity {selItem ? `(${selItem.pack_label}${selItem.pack_size > 1 ? `s — 1 ${selItem.pack_label} = ${selItem.pack_size} ${selItem.base_unit}s` : 's'})` : ''}</label>
          <input style={inp} type="number" inputMode="numeric" value={packs} onChange={e => setPacks(e.target.value)} placeholder={selItem ? `Number of ${selItem.pack_label}s` : ''} />
          {selItem && packs && <div style={{ marginTop: 6, color: C.orange, fontWeight: 600, fontSize: 14 }}>= {previewBase} {selItem.base_unit}{previewBase !== 1 ? 's' : ''}</div>}

          <label style={lbl}>Note (optional)</label>
          <input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder={tab === 'receive' ? 'Supplier / invoice…' : 'Reason…'} />

          <button onClick={() => record(tab === 'receive' ? 'receive' : 'dispatch')} disabled={saving}
            style={{ marginTop: 18, padding: '12px 24px', border: 'none', borderRadius: 9, background: tab === 'receive' ? C.orange : C.blue, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : (tab === 'receive' ? 'Receive stock' : 'Dispatch to machine')}
          </button>
        </div>
      )}

      {!loading && tab === 'sale' && (
        <div style={{ ...card, maxWidth: 560 }}>
          <div style={cardTitle}>Sell stock to an operator or buyer</div>
          <label style={lbl}>Item</label>
          <select style={inp} value={itemId} onChange={e => setItemId(e.target.value)}>
            <optgroup label="Fruit">{fruit.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
            <optgroup label="Consumables">{cons.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
          </select>
          <label style={lbl}>Buyer (operator)</label>
          <select style={inp} value={soldToOp} onChange={e => { setSoldToOp(e.target.value); if (e.target.value) setSoldToName(''); }}>
            <option value="">— Other buyer (type below) —</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {!soldToOp && (<>
            <label style={lbl}>Other buyer name</label>
            <input style={inp} value={soldToName} onChange={e => setSoldToName(e.target.value)} placeholder="Buyer name (non-operator)" />
          </>)}
          <label style={lbl}>Quantity {selItem ? `(${selItem.pack_label}s — 1 = ${selItem.pack_size} ${selItem.base_unit}s)` : ''}</label>
          <input style={inp} type="number" inputMode="numeric" value={packs} onChange={e => setPacks(e.target.value)} placeholder={selItem ? `Number of ${selItem.pack_label}s` : ''} />
          {selItem && packs && <div style={{ marginTop: 6, color: C.orange, fontWeight: 600, fontSize: 14 }}>= {previewBase} {selItem.base_unit}{previewBase !== 1 ? 's' : ''}</div>}
          <label style={lbl}>Note (optional)</label>
          <input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder="Invoice / reference…" />
          <button onClick={() => record('sale')} disabled={saving}
            style={{ marginTop: 18, padding: '12px 24px', border: 'none', borderRadius: 9, background: C.orange, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Record sale'}
          </button>
        </div>
      )}
      {!loading && tab === 'damage' && (
        <div style={{ ...card, maxWidth: 560 }}>
          <div style={cardTitle}>Write off damaged stock from warehouse</div>
          <label style={lbl}>Item</label>
          <select style={inp} value={itemId} onChange={e => setItemId(e.target.value)}>
            <optgroup label="Fruit">{fruit.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
            <optgroup label="Consumables">{cons.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
          </select>
          <label style={lbl}>Quantity {selItem ? `(${selItem.pack_label}s — 1 = ${selItem.pack_size} ${selItem.base_unit}s)` : ''}</label>
          <input style={inp} type="number" inputMode="numeric" value={packs} onChange={e => setPacks(e.target.value)} placeholder={selItem ? `Number of ${selItem.pack_label}s` : ''} />
          {selItem && packs && <div style={{ marginTop: 6, color: '#B00020', fontWeight: 600, fontSize: 14 }}>= {previewBase} {selItem.base_unit}{previewBase !== 1 ? 's' : ''} written off</div>}
          <label style={lbl}>Reason</label>
          <input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder="Rotten / spoiled / damaged…" />
          <button onClick={() => record('damage_warehouse')} disabled={saving}
            style={{ marginTop: 18, padding: '12px 24px', border: 'none', borderRadius: 9, background: '#B00020', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Write off damaged'}
          </button>
        </div>
      )}
      {!loading && tab === 'transfer' && isSuper && (
        <div style={{ ...card, maxWidth: 560 }}>
          <div style={cardTitle}>Transfer stock to an operator</div>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 10 }}>Stock leaves your warehouse immediately and stays in transit until the operator confirms receipt.</div>
          <label style={lbl}>Item</label>
          <select style={inp} value={itemId} onChange={e => setItemId(e.target.value)}>
            <optgroup label="Fruit">{fruit.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
            <optgroup label="Consumables">{cons.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
          </select>
          <label style={lbl}>To operator</label>
          <select style={inp} value={xferTo} onChange={e => setXferTo(e.target.value)}>
            <option value="">— Pick an operator —</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <label style={lbl}>Quantity {selItem ? `(${selItem.pack_label}s — 1 = ${selItem.pack_size} ${selItem.base_unit}s)` : ''}</label>
          <input style={inp} type="number" inputMode="numeric" value={packs} onChange={e => setPacks(e.target.value)} placeholder={selItem ? `Number of ${selItem.pack_label}s` : ''} />
          {selItem && packs && <div style={{ marginTop: 6, color: C.orange, fontWeight: 600, fontSize: 14 }}>= {previewBase} {selItem.base_unit}{previewBase !== 1 ? 's' : ''}</div>}
          <label style={lbl}>Note (optional)</label>
          <input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder="Delivery reference…" />
          <button onClick={() => record('transfer_out')} disabled={saving}
            style={{ marginTop: 18, padding: '12px 24px', border: 'none', borderRadius: 9, background: C.blue, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sending…' : 'Send transfer'}
          </button>
        </div>
      )}
      {!loading && tab === 'incoming' && (
        <div style={card}>
          <div style={cardTitle}>Incoming stock awaiting your confirmation</div>
          {pending.length === 0 && <div style={{ color: C.text2, fontSize: 14 }}>Nothing in transit.</div>}
          {pending.map((t: any) => {
            const it = itemById(t.item_id);
            const qty = Math.abs(Number(t.qty_base || 0));
            return (
              <div key={t.transfer_id} style={{ border: '1px solid ' + C.border, borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{qty} {it?.base_unit || 'unit'}{qty !== 1 ? 's' : ''} · {it?.name || 'Item'}</div>
                <div style={{ fontSize: 13, color: C.text2, marginTop: 3 }}>Sent {new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                {t.note && <div style={{ fontSize: 13, color: C.text3, marginTop: 3, fontStyle: 'italic' }}>{t.note}</div>}
                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <button onClick={() => resolveTransfer(t.transfer_id, 'confirm')} disabled={saving}
                    style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: '#1B5E20', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    Confirm receipt
                  </button>
                  <button onClick={() => resolveTransfer(t.transfer_id, 'reject')} disabled={saving}
                    style={{ padding: '9px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.surface, color: '#B00020', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* LOG */}
      {!loading && tab === 'log' && (
        <div style={card}>
          <div style={cardTitle}>Movement log</div>
          {movements.length === 0 && <div style={{ color: C.text2, fontSize: 14 }}>No movements yet.</div>}

          {/* Desktop: table */}
          {!isMobile && movements.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr><th style={th}>When</th><th style={th}>Type</th><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={th}>Machine</th><th style={th}>By</th><th style={th}>Note</th></tr></thead>
              <tbody>
                {movements.map(m => {
                  const it = itemById(m.item_id); const mac = machines.find(x => x.id === m.machine_id);
                  const tagBg = m.movement_type === 'receive' ? C.greenBg : m.movement_type === 'dispatch' ? C.blueBg : C.amberBg;
                  const tagC = m.movement_type === 'receive' ? C.green : m.movement_type === 'dispatch' ? C.blue : C.amber;
                  return (
                    <tr key={m.id}>
                      <td style={{ ...td, color: C.text2, whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString('en-IN')}</td>
                      <td style={td}><span style={{ background: tagBg, color: tagC, padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>{m.movement_type}</span></td>
                      <td style={td}>{it ? it.name : m.item_id.slice(0, 6)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: m.qty_base >= 0 ? C.green : C.blue }}>{m.qty_base >= 0 ? '+' : ''}{m.qty_base}</td>
                      <td style={{ ...td, color: C.text2 }}>{mac ? machineLabel(mac) : '—'}</td>
                      <td style={{ ...td, color: C.text2 }}>{m.created_by_name || '—'}</td>
                      <td style={{ ...td, color: C.text2 }}>{m.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Mobile: rich stacked cards */}
          {isMobile && movements.map(m => {
            const it = itemById(m.item_id); const mac = machines.find(x => x.id === m.machine_id);
            const accent = m.movement_type === 'receive' ? C.green : m.movement_type === 'dispatch' ? C.blue : C.amber;
            const unit = it ? it.base_unit + 's' : '';
            return (
              <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid ' + C.border, overflow: 'hidden', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 5, background: accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <span style={{ background: accent, color: '#fff', padding: '3px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{m.movement_type}</span>
                        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 8 }}>{it ? it.name : m.item_id.slice(0, 6)}</div>
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

const card: React.CSSProperties = { background: C.surface, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid ' + C.border };
const td: React.CSSProperties = { padding: '10px', borderBottom: '1px solid ' + C.border, color: C.text };
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: C.text2, margin: '14px 0 5px' };
const inp: React.CSSProperties = { width: '100%', padding: '11px', fontSize: 15, border: '1px solid ' + C.border2, borderRadius: 9, boxSizing: 'border-box', background: '#fff', color: C.text };
