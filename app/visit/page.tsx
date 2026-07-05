'use client';
import { useState, useEffect } from 'react';

const LOGO = 'https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/logo.png';

type Machine = { id: string; display_name?: string; sn?: string; location?: string };
type Visit = {
  id: string; machine_id: string; visit_type: string; note?: string;
  oranges_loaded?: number; oranges_damaged?: number; oranges_net?: number;
  created_at: string;
};

const TYPES = [
  { v: 'cleaning', label: 'Cleaning' },
  { v: 'loading', label: 'Loading' },
  { v: 'maintenance', label: 'Maintenance' },
  { v: 'other', label: 'Other' },
];

export default function VisitPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState('');
  const [visitType, setVisitType] = useState('cleaning');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState('');
  const [damaged, setDamaged] = useState('');
  const [cups, setCups] = useState('');
  const [lids, setLids] = useState('');
  const [film, setFilm] = useState('');
  const [straws, setStraws] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [visits, setVisits] = useState<Visit[]>([]);

  const net = (() => {
    const l = parseInt(loaded), d = parseInt(damaged);
    if (isNaN(l)) return '';
    return String((isNaN(d) ? 0 : d) > l ? 0 : l - (isNaN(d) ? 0 : d));
  })();

  async function loadMachines() {
    try {
      const r = await fetch('/api/visit?machines=1', { cache: 'no-store' });
      const d = await r.json();
      const list = Array.isArray(d) ? d : (d.machines || []);
      setMachines(list);
      if (list.length && !machineId) setMachineId(list[0].id);
    } catch { /* ignore */ }
  }
  async function loadVisits() {
    try {
      const r = await fetch('/api/visit', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) setVisits(d);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadMachines(); loadVisits(); }, []);
  useEffect(() => {
    const onFocus = () => loadVisits();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  function consumablesObj() {
    const c: Record<string, number> = {};
    const add = (k: string, v: string) => { const n = parseInt(v); if (!isNaN(n) && n > 0) c[k] = n; };
    add('cups', cups); add('lids', lids); add('film', film); add('straws', straws);
    return Object.keys(c).length ? c : null;
  }

  async function submit() {
    setErr(''); setMsg('');
    if (!machineId) { setErr('Please select a machine'); return; }
    setSaving(true);
    try {
      const payload: any = {
        machine_id: machineId,
        visit_type: visitType,
        note: note.trim() || null,
        consumables: consumablesObj(),
      };
      if (visitType === 'loading') {
        if (loaded !== '') payload.oranges_loaded = parseInt(loaded);
        if (damaged !== '') payload.oranges_damaged = parseInt(damaged);
      }
      const r = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Could not save visit'); setSaving(false); return; }
      setMsg('Visit saved.');
      setNote(''); setLoaded(''); setDamaged(''); setCups(''); setLids(''); setFilm(''); setStraws('');
      loadVisits();
    } catch (e: any) {
      setErr('Network problem — please try again.');
    }
    setSaving(false);
  }

  const machineLabel = (m: Machine) => m.display_name || m.sn || m.id;
  const machineById = (id: string) => machines.find(m => m.id === id);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <img src={LOGO} alt="Fruitlink" style={{ height: 34 }} />
          <span style={S.title}>Visit Update</span>
        </div>

        <label style={S.label}>Machine</label>
        <select style={S.input} value={machineId} onChange={e => setMachineId(e.target.value)}>
          {machines.length === 0 && <option value="">No machines available</option>}
          {machines.map(m => <option key={m.id} value={m.id}>{machineLabel(m)}</option>)}
        </select>

        <label style={S.label}>Visit type</label>
        <div style={S.typeRow}>
          {TYPES.map(t => (
            <button key={t.v} type="button"
              onClick={() => setVisitType(t.v)}
              style={{ ...S.typeBtn, ...(visitType === t.v ? S.typeBtnOn : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        {visitType === 'loading' && (
          <div style={S.loadBox}>
            <label style={S.label}>Oranges loaded</label>
            <input style={S.input} type="number" inputMode="numeric" value={loaded}
              onChange={e => setLoaded(e.target.value)} placeholder="e.g. 100" />
            <label style={S.label}>Damaged / rejected</label>
            <input style={S.input} type="number" inputMode="numeric" value={damaged}
              onChange={e => setDamaged(e.target.value)} placeholder="e.g. 2" />
            <div style={S.netRow}>Net loaded: <b>{net === '' ? '—' : net}</b></div>

            <label style={S.label}>Consumables refilled (optional)</label>
            <div style={S.consRow}>
              <input style={S.consInput} type="number" inputMode="numeric" value={cups} onChange={e => setCups(e.target.value)} placeholder="Cups" />
              <input style={S.consInput} type="number" inputMode="numeric" value={lids} onChange={e => setLids(e.target.value)} placeholder="Lids" />
            </div>
            <div style={S.consRow}>
              <input style={S.consInput} type="number" inputMode="numeric" value={film} onChange={e => setFilm(e.target.value)} placeholder="Film" />
              <input style={S.consInput} type="number" inputMode="numeric" value={straws} onChange={e => setStraws(e.target.value)} placeholder="Straws" />
            </div>
          </div>
        )}

        <label style={S.label}>Note (optional)</label>
        <textarea style={{ ...S.input, height: 70, resize: 'vertical' }} value={note}
          onChange={e => setNote(e.target.value)} placeholder="Anything worth recording..." />

        {err && <div style={S.err}>{err}</div>}
        {msg && <div style={S.ok}>{msg}</div>}

        <button type="button" onClick={submit} disabled={saving} style={{ ...S.submit, ...(saving ? { opacity: 0.6 } : {}) }}>
          {saving ? 'Saving…' : 'Submit visit'}
        </button>
      </div>

      <div style={S.card}>
        <div style={S.subTitle}>My recent visits</div>
        {visits.length === 0 && <div style={S.muted}>No visits yet.</div>}
        {visits.map(v => {
          const m = machineById(v.machine_id);
          return (
            <div key={v.id} style={S.visitRow}>
              <div>
                <b>{m ? machineLabel(m) : v.machine_id.slice(0, 8)}</b>
                <span style={S.badge}>{v.visit_type}</span>
              </div>
              {v.visit_type === 'loading' && v.oranges_net != null &&
                <div style={S.muted}>Loaded net {v.oranges_net}{v.oranges_damaged ? ` (${v.oranges_damaged} damaged)` : ''}</div>}
              {v.note && <div style={S.muted}>{v.note}</div>}
              <div style={S.time}>{new Date(v.created_at).toLocaleString('en-IN')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F4F5F9', padding: '16px', maxWidth: 520, margin: '0 auto', boxSizing: 'border-box' },
  card: { background: '#fff', borderRadius: 14, padding: 18, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: 700, color: '#1F2533' },
  subTitle: { fontSize: 16, fontWeight: 700, color: '#1F2533', marginBottom: 10 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#5B6478', margin: '12px 0 5px' },
  input: { width: '100%', padding: '12px 12px', fontSize: 16, border: '1px solid #D8DCE6', borderRadius: 10, boxSizing: 'border-box', background: '#fff', color: '#1F2533' },
  typeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  typeBtn: { padding: '12px 8px', fontSize: 15, border: '1px solid #D8DCE6', borderRadius: 10, background: '#fff', color: '#1F2533', cursor: 'pointer', fontWeight: 600 },
  typeBtnOn: { background: '#FE6505', borderColor: '#FE6505', color: '#fff' },
  loadBox: { background: '#FFF7F0', borderRadius: 10, padding: 12, marginTop: 6 },
  netRow: { fontSize: 15, color: '#1F2533', margin: '8px 0' },
  consRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 },
  consInput: { width: '100%', padding: '10px', fontSize: 15, border: '1px solid #D8DCE6', borderRadius: 8, boxSizing: 'border-box' },
  submit: { width: '100%', marginTop: 16, padding: '14px', fontSize: 17, fontWeight: 700, color: '#fff', background: '#FE6505', border: 'none', borderRadius: 12, cursor: 'pointer' },
  err: { marginTop: 12, padding: '10px 12px', background: '#FDEEEE', color: '#B42318', borderRadius: 8, fontSize: 14 },
  ok: { marginTop: 12, padding: '10px 12px', background: '#E7F8EF', color: '#198754', borderRadius: 8, fontSize: 14 },
  visitRow: { padding: '10px 0', borderBottom: '1px solid #EEF0F5' },
  badge: { marginLeft: 8, fontSize: 12, padding: '2px 8px', background: '#F0F1F5', borderRadius: 20, color: '#5B6478' },
  muted: { fontSize: 13, color: '#5B6478', marginTop: 3 },
  time: { fontSize: 12, color: '#98A0B0', marginTop: 4 },
};
