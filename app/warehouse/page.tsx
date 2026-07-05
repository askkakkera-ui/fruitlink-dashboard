'use client';
import { useState, useEffect } from 'react';

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

export default function WarehousePage() {
  const [tab, setTab] = useState<'onhand' | 'receive' | 'dispatch' | 'log'>('onhand');
  const [items, setItems] = useState<Item[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [forbidden, setForbidden] = useState(false);
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
      if (r.status === 403) { setForbidden(true); return; }
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

  async function record(movement_type: 'receive' | 'dispatch') {
    setErr(''); setMsg('');
    if (!itemId) { setErr('Pick an item'); return; }
    if (!packs || Number(packs) <= 0) { setErr('Enter a quantity'); return; }
    if (movement_type === 'dispatch' && !machineId) { setErr('Pick a machine'); return; }
    setSaving(true);
    try {
      const body: any = { item_id: itemId, movement_type, packs: Number(packs), note: note.trim() || null };
      if (movement_type === 'dispatch') body.machine_id = machineId;
      const r = await fetch('/api/warehouse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Failed'); setSaving(false); return; }
      const it = itemById(itemId);
      const base = Number(packs) * (it ? it.pack_size : 1);
      setMsg(`${movement_type === 'receive' ? 'Received' : 'Dispatched'} ${packs} ${it?.pack_label || ''}${Number(packs) > 1 ? 's' : ''} = ${base} ${it?.base_unit || ''}${base > 1 ? 's' : ''}.`);
      setPacks(''); setNote('');
      await loadOnhand(); await loadLog();
    } catch { setErr('Network problem'); }
    setSaving(false);
  }

  if (forbidden) return <div style={S.page}><div style={S.card}>Warehouse is for operators / super admin.</div></div>;
  if (loading) return <div style={S.page}><div style={S.card}>Loading…</div></div>;

  const selItem = itemById(itemId);
  const previewBase = selItem && packs ? Number(packs) * selItem.pack_size : 0;

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.h2}>Warehouse</h2>
        <div style={S.tabs}>
          {([['onhand','On hand'],['receive','Receive'],['dispatch','Dispatch'],['log','Log']] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setErr(''); setMsg(''); }}
              style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>{l}</button>
          ))}
        </div>
        {err && <div style={S.err}>{err}</div>}
        {msg && <div style={S.ok}>{msg}</div>}
      </div>

      {tab === 'onhand' && (
        <div style={S.card}>
          <div style={S.secTitle}>Fruit</div>
          {items.filter(i => i.category === 'fruit').map(i => (
            <div key={i.id} style={S.row}>
              <span>{i.name}</span>
              <span style={S.qty}>{i.on_hand ?? 0} oranges{i.boxes_equiv != null ? ` · ${i.boxes_equiv} boxes` : ''}</span>
            </div>
          ))}
          <div style={{ ...S.secTitle, marginTop: 14 }}>Consumables</div>
          {items.filter(i => i.category === 'consumable').map(i => (
            <div key={i.id} style={S.row}>
              <span>{i.name}{i.machine_type && i.machine_type !== 'common' ? ` (${i.machine_type})` : ''}</span>
              <span style={S.qty}>{i.on_hand ?? 0} {i.base_unit}{(i.on_hand ?? 0) !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {(tab === 'receive' || tab === 'dispatch') && (
        <div style={S.card}>
          <label style={S.label}>Item</label>
          <select style={S.input} value={itemId} onChange={e => setItemId(e.target.value)}>
            <optgroup label="Fruit">
              {items.filter(i => i.category === 'fruit').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </optgroup>
            <optgroup label="Consumables">
              {items.filter(i => i.category === 'consumable').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </optgroup>
          </select>

          {tab === 'dispatch' && (
            <>
              <label style={S.label}>To machine</label>
              <select style={S.input} value={machineId} onChange={e => setMachineId(e.target.value)}>
                {machines.map(m => <option key={m.id} value={m.id}>{machineLabel(m)}</option>)}
              </select>
            </>
          )}

          <label style={S.label}>
            Quantity {selItem ? `(${selItem.pack_label}${selItem.pack_size > 1 ? `, 1 ${selItem.pack_label} = ${selItem.pack_size} ${selItem.base_unit}s` : ''})` : ''}
          </label>
          <input style={S.input} type="number" inputMode="numeric" value={packs}
            onChange={e => setPacks(e.target.value)} placeholder={selItem ? `Number of ${selItem.pack_label}s` : ''} />
          {selItem && packs && (
            <div style={S.preview}>= {previewBase} {selItem.base_unit}{previewBase !== 1 ? 's' : ''}</div>
          )}

          <label style={S.label}>Note (optional)</label>
          <input style={S.input} value={note} onChange={e => setNote(e.target.value)}
            placeholder={tab === 'receive' ? 'Supplier / invoice…' : 'Reason…'} />

          <button style={{ ...S.submit, ...(tab === 'dispatch' ? { background: '#0D6EFD' } : {}) }}
            disabled={saving} onClick={() => record(tab === 'receive' ? 'receive' : 'dispatch')}>
            {saving ? 'Saving…' : (tab === 'receive' ? 'Receive stock' : 'Dispatch to machine')}
          </button>
        </div>
      )}

      {tab === 'log' && (
        <div style={S.card}>
          <div style={S.secTitle}>Recent movements</div>
          {movements.length === 0 && <div style={S.muted}>No movements yet.</div>}
          {movements.map(m => {
            const it = itemById(m.item_id);
            const mac = machines.find(x => x.id === m.machine_id);
            const sign = m.qty_base >= 0 ? '+' : '';
            return (
              <div key={m.id} style={S.logRow}>
                <div>
                  <span style={{ ...S.tag, ...(m.movement_type === 'receive' ? S.tagIn : m.movement_type === 'dispatch' ? S.tagOut : S.tagAdj) }}>{m.movement_type}</span>
                  <b style={{ marginLeft: 6 }}>{it ? it.name : m.item_id.slice(0, 6)}</b>
                </div>
                <div style={S.muted}>
                  {sign}{m.qty_base} {it?.base_unit || ''}{Math.abs(m.qty_base) !== 1 ? 's' : ''}
                  {mac ? ` → ${machineLabel(mac)}` : ''}
                  {m.note ? ` · ${m.note}` : ''}
                </div>
                <div style={S.time}>{new Date(m.created_at).toLocaleString('en-IN')}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const C = { orange: '#FE6505', text: '#1F2533', text2: '#5B6478', line: '#E4E7EE', bg: '#F4F5F9' };
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: C.bg, padding: 18, maxWidth: 640, margin: '0 auto', boxSizing: 'border-box' },
  card: { background: '#fff', borderRadius: 12, padding: 18, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  h2: { margin: '0 0 12px', fontSize: 20, color: C.text },
  tabs: { display: 'flex', gap: 6 },
  tab: { flex: 1, padding: '9px', fontSize: 13, fontWeight: 600, border: '1px solid ' + C.line, borderRadius: 8, background: '#fff', color: C.text, cursor: 'pointer' },
  tabOn: { background: C.orange, borderColor: C.orange, color: '#fff' },
  secTitle: { fontSize: 14, fontWeight: 700, color: C.text2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #EEF0F5', fontSize: 15 },
  qty: { fontWeight: 700, color: C.text },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: C.text2, margin: '12px 0 5px' },
  input: { width: '100%', padding: '11px', fontSize: 16, border: '1px solid ' + C.line, borderRadius: 9, boxSizing: 'border-box', background: '#fff', color: C.text },
  preview: { marginTop: 6, fontSize: 14, color: C.orange, fontWeight: 600 },
  submit: { width: '100%', marginTop: 16, padding: '13px', fontSize: 16, fontWeight: 700, color: '#fff', background: C.orange, border: 'none', borderRadius: 10, cursor: 'pointer' },
  muted: { fontSize: 13, color: C.text2, marginTop: 3 },
  logRow: { padding: '10px 0', borderBottom: '1px solid #EEF0F5' },
  tag: { fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase' },
  tagIn: { background: '#E7F8EF', color: '#198754' },
  tagOut: { background: '#E7F0FF', color: '#0D6EFD' },
  tagAdj: { background: '#FFF3E0', color: '#B8860B' },
  time: { fontSize: 12, color: '#98A0B0', marginTop: 4 },
  err: { marginTop: 10, padding: '10px 12px', background: '#FDEEEE', color: '#B42318', borderRadius: 8, fontSize: 14 },
  ok: { marginTop: 10, padding: '10px 12px', background: '#E7F8EF', color: '#198754', borderRadius: 8, fontSize: 14 },
};
