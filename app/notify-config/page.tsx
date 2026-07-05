'use client';
import { useState, useEffect } from 'react';

type Row = {
  machine_id: string; machine_name: string; owner_id: string | null;
  mode: string; notify_numbers: string[]; source: string;
};
type Tenant = { id: string; name: string; email: string; role: string; max_notify_numbers: number };

const FRUITLINK_ID = '0c1bd083-682a-4913-ac37-08c85ef94b41';

export default function NotifyConfig() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [newNum, setNewNum] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/notify-config', { cache: 'no-store' });
      if (r.status === 403) { setForbidden(true); setLoading(false); return; }
      const d = await r.json();
      if (Array.isArray(d)) setRows(d);
      const t = await fetch('/api/notify-config?tenants=1', { cache: 'no-store' });
      const td = await t.json();
      if (Array.isArray(td)) setTenants(td);
    } catch { setErr('Could not load config'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function tenantOf(ownerId: string | null): Tenant | undefined {
    return tenants.find(t => t.id === ownerId);
  }
  function limitFor(row: Row): number | null {
    if (row.owner_id === FRUITLINK_ID) return null;
    const t = tenantOf(row.owner_id);
    return t ? t.max_notify_numbers : 5;
  }

  async function saveRow(row: Row, numbers: string[], mode: string) {
    setSavingId(row.machine_id); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/notify-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_id: row.machine_id, notify_numbers: numbers, mode }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Save failed'); setSavingId(''); return; }
      setMsg('Saved.');
      await load();
    } catch { setErr('Network problem'); }
    setSavingId('');
  }

  function addNumber(row: Row) {
    const raw = (newNum[row.machine_id] || '').trim();
    if (!raw) return;
    const limit = limitFor(row);
    if (limit != null && row.notify_numbers.length >= limit) {
      setErr(`Limit is ${limit} numbers for this tenant. Raise the limit below first.`);
      return;
    }
    const nums = [...row.notify_numbers, raw];
    setNewNum({ ...newNum, [row.machine_id]: '' });
    saveRow(row, nums, row.mode);
  }
  function removeNumber(row: Row, idx: number) {
    const nums = row.notify_numbers.filter((_, i) => i !== idx);
    saveRow(row, nums, row.mode);
  }
  function setMode(row: Row, mode: string) {
    saveRow(row, row.notify_numbers, mode);
  }

  async function setLimit(t: Tenant, max: number) {
    setErr(''); setMsg('');
    try {
      const r = await fetch('/api/notify-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_limit: { owner_id: t.id, max } }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Limit update failed'); return; }
      setMsg('Limit updated.');
      await load();
    } catch { setErr('Network problem'); }
  }

  if (forbidden) return <div style={S.page}><div style={S.card}>Super admin only.</div></div>;
  if (loading) return <div style={S.page}><div style={S.card}>Loading…</div></div>;

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.h2}>WhatsApp Notifications</h2>
        <p style={S.sub}>Manage which numbers receive visit &amp; status updates per machine. Fruitlink-owned machines have no limit; each tenant is capped (default 5). Change the delivery method later without reconfiguring.</p>
        {err && <div style={S.err}>{err}</div>}
        {msg && <div style={S.ok}>{msg}</div>}
      </div>

      {rows.map(row => {
        const limit = limitFor(row);
        return (
          <div key={row.machine_id} style={S.card}>
            <div style={S.rowHead}>
              <b>{row.machine_name}</b>
              <span style={S.owner}>{row.owner_id === FRUITLINK_ID ? 'Fruitlink' : (tenantOf(row.owner_id)?.name || 'Tenant')}</span>
            </div>

            <div style={S.modeRow}>
              <button onClick={() => setMode(row, 'self_service')}
                style={{ ...S.modeBtn, ...(row.mode === 'self_service' ? S.modeOn : {}) }}
                disabled={savingId === row.machine_id}>Self-service</button>
              <button onClick={() => setMode(row, 'fruitlink_service')}
                style={{ ...S.modeBtn, ...(row.mode === 'fruitlink_service' ? S.modeOn : {}) }}
                disabled={savingId === row.machine_id}>Fruitlink service</button>
            </div>

            <div style={S.numsLabel}>
              Notify numbers {limit != null ? `(${row.notify_numbers.length}/${limit})` : '(unlimited)'}
            </div>
            {row.notify_numbers.length === 0 && <div style={S.muted}>No numbers yet.</div>}
            {row.notify_numbers.map((n, i) => (
              <div key={i} style={S.numRow}>
                <span>{n}</span>
                <button onClick={() => removeNumber(row, i)} style={S.del} disabled={savingId === row.machine_id}>Remove</button>
              </div>
            ))}

            <div style={S.addRow}>
              <input style={S.input} placeholder="+9198…" value={newNum[row.machine_id] || ''}
                onChange={e => setNewNum({ ...newNum, [row.machine_id]: e.target.value })} />
              <button style={S.add} onClick={() => addNumber(row)} disabled={savingId === row.machine_id}>Add</button>
            </div>
            {row.source === 'owner_default' && <div style={S.note}>Currently using the owner default. Adding a number here creates a machine-specific list.</div>}
          </div>
        );
      })}

      <div style={S.card}>
        <h3 style={S.h3}>Tenant number limits</h3>
        <p style={S.sub}>Only you (super admin) can change a tenant's cap. Fruitlink itself is unlimited.</p>
        {tenants.filter(t => t.role !== 'super_admin').map(t => (
          <div key={t.id} style={S.limitRow}>
            <span><b>{t.name}</b> <span style={S.muted}>{t.email}</span></span>
            <span style={S.limitCtrl}>
              <button style={S.stepBtn} onClick={() => setLimit(t, Math.max(0, t.max_notify_numbers - 1))}>−</button>
              <span style={S.limitVal}>{t.max_notify_numbers}</span>
              <button style={S.stepBtn} onClick={() => setLimit(t, t.max_notify_numbers + 1)}>+</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const C = { orange: '#FE6505', text: '#1F2533', text2: '#5B6478', line: '#E4E7EE', bg: '#F4F5F9' };
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: C.bg, padding: 20, maxWidth: 720, margin: '0 auto', boxSizing: 'border-box' },
  card: { background: '#fff', borderRadius: 12, padding: 18, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  h2: { margin: '0 0 6px', fontSize: 20, color: C.text },
  h3: { margin: '0 0 6px', fontSize: 17, color: C.text },
  sub: { margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.5 },
  rowHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  owner: { fontSize: 12, color: C.text2, background: '#F0F1F5', padding: '2px 10px', borderRadius: 20 },
  modeRow: { display: 'flex', gap: 8, marginBottom: 12 },
  modeBtn: { flex: 1, padding: '9px', fontSize: 13, fontWeight: 600, border: '1px solid ' + C.line, borderRadius: 8, background: '#fff', color: C.text, cursor: 'pointer' },
  modeOn: { background: C.orange, borderColor: C.orange, color: '#fff' },
  numsLabel: { fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 },
  numRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#F7F8FB', borderRadius: 8, marginBottom: 6, fontSize: 14 },
  del: { background: 'transparent', border: 'none', color: '#B42318', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  addRow: { display: 'flex', gap: 8, marginTop: 8 },
  input: { flex: 1, padding: '10px', fontSize: 15, border: '1px solid ' + C.line, borderRadius: 8, boxSizing: 'border-box' },
  add: { padding: '10px 18px', background: C.orange, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  note: { fontSize: 12, color: C.text2, marginTop: 8, fontStyle: 'italic' },
  muted: { fontSize: 13, color: '#98A0B0' },
  limitRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #EEF0F5' },
  limitCtrl: { display: 'flex', alignItems: 'center', gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', fontSize: 18, cursor: 'pointer', color: C.text },
  limitVal: { minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 16, color: C.text },
  err: { marginTop: 10, padding: '10px 12px', background: '#FDEEEE', color: '#B42318', borderRadius: 8, fontSize: 14 },
  ok: { marginTop: 10, padding: '10px 12px', background: '#E7F8EF', color: '#198754', borderRadius: 8, fontSize: 14 },
};
