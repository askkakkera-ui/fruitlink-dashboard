'use client';
import { useState, useEffect } from 'react';

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
  machine_id?: string; note?: string; created_at: string;
};

export default function WarehouseSection() {
  const [tab, setTab] = useState<'onhand' | 'receive' | 'dispatch' | 'log'>('onhand');
  const [items, setItems] = useState<Item[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [itemId, setItemId] = useState('');
  const [packs, setPacks] = useState('');
  const [machineId, setMachineId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadOnhand() {
    try {
      const r = await fetch('/api/warehouse?onhand=1', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) { setItems(d); if (!itemId && d[0]) setItemId(d[0].id); }
    } catch { setErr('Could not load stock'); }
  }
  async function loadMachines() {
    try {
      const r = await fetch('/api/visit?machines=1', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) { setMachines(d); if (!machineId && d[0]) setMachineId(d[0].id); }
    } catch { /* ignore */ }
  }
  async function loadLog() {
    try {
      const r = await fetch('/api/warehouse?movements=1', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) setMovements(d);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    (async () => { setLoading(true); await loadOnhand(); await loadMachines(); await loadLog(); setLoading(false); })();
  }, []);

  const itemById = (id: string) => items.find(i => i.id === id);
  const machineLabel = (m?: Machine) => m ? (m.display_name || m.sn || m.id.slice(0, 6)) : '';
  const selItem = itemById(itemId);
  const previewBase = selItem && packs ? Number(packs) * selItem.pack_size : 0;

  async function record(movement_type: 'receive' | 'dispatch') {
    setErr(''); setMsg('');
    if (!itemId) { setErr('Pick an item'); return; }
    if (!packs || Number(packs) <= 0) { setErr('Enter a quantity'); return; }
    if (movement_type === 'dispatch' && !machineId) { setErr('Pick a machine'); return; }
    setSaving(true);
    try {
      const body: any = { item_id: itemId, movement_type, packs: Number(packs), note: note.trim() || null };
      if (movement_type === 'dispatch') body.machine_id = machineId;
      const r = await fetch('/api/warehouse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Failed'); setSaving(false); return; }
      const it = itemById(itemId);
      const base = Number(packs) * (it ? it.pack_size : 1);
      const plural = (n: number, w: string) => `${n} ${w}${n !== 1 ? (w.endsWith('x') ? 'es' : 's') : ''}`;
      setMsg(`${movement_type === 'receive' ? 'Received' : 'Dispatched'} ${plural(Number(packs), it?.pack_label || 'unit')} = ${plural(base, it?.base_unit || 'unit')}.`);
      setPacks(''); setNote('');
      await loadOnhand(); await loadLog();
    } catch { setErr('Network problem'); }
    setSaving(false);
  }

  const fruit = items.filter(i => i.category === 'fruit');
  const cons = items.filter(i => i.category === 'consumable');

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {([['onhand', 'On hand'], ['receive', 'Receive'], ['dispatch', 'Dispatch'], ['log', 'Movement log']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setErr(''); setMsg(''); }}
            style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid ' + (tab === k ? C.orange : C.border), background: tab === k ? C.orange : C.surface, color: tab === k ? '#fff' : C.text2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {err && <div style={{ padding: '11px 14px', background: C.redBg, color: C.red, borderRadius: 9, fontSize: 14, marginBottom: 14 }}>{err}</div>}
      {msg && <div style={{ padding: '11px 14px', background: C.greenBg, color: C.green, borderRadius: 9, fontSize: 14, marginBottom: 14 }}>{msg}</div>}

      {loading && <div style={{ color: C.text2 }}>Loading…</div>}

      {!loading && tab === 'onhand' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
          <div style={card}>
            <div style={cardTitle}>Fruit (oranges)</div>
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
            <select style={inp} value={machineId} onChange={e => setMachineId(e.target.value)}>
              {machines.map(m => <option key={m.id} value={m.id}>{machineLabel(m)}</option>)}
            </select>
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

      {!loading && tab === 'log' && (
        <div style={card}>
          <div style={cardTitle}>Movement log</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr><th style={th}>When</th><th style={th}>Type</th><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={th}>Machine</th><th style={th}>Note</th></tr></thead>
            <tbody>
              {movements.length === 0 && <tr><td style={td} colSpan={6}>No movements yet.</td></tr>}
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
                    <td style={{ ...td, color: C.text2 }}>{m.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: '#ffffff', borderRadius: 12, padding: 20, border: '1px solid #e8eaf0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1f2533', marginBottom: 14 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 700, color: '#9099ac', textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #e8eaf0' };
const td: React.CSSProperties = { padding: '10px', borderBottom: '1px solid #e8eaf0', color: '#1f2533' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#5b6478', margin: '14px 0 5px' };
const inp: React.CSSProperties = { width: '100%', padding: '11px', fontSize: 15, border: '1px solid #dcdfe9', borderRadius: 9, boxSizing: 'border-box', background: '#fff', color: '#1f2533' };
