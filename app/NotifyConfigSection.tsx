'use client';
import { useState, useEffect } from 'react';

const C = {
  bg: '#f4f5f9', surface: '#ffffff', border: '#e8eaf0', border2: '#dcdfe9',
  text: '#1f2533', text2: '#5b6478', text3: '#9099ac',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  orange: '#FE6505', blue: '#0D6EFD',
};

const FRUITLINK_ID = '0c1bd083-682a-4913-ac37-08c85ef94b41';

type Row = {
  machine_id: string; machine_name: string; owner_id: string | null;
  mode: string; notify_numbers: string[]; source: string;
};
type Tenant = { id: string; name: string; email: string; role: string; max_notify_numbers: number };

export default function NotifyConfigSection() {
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

  const tenantOf = (ownerId: string | null) => tenants.find(t => t.id === ownerId);
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
      setMsg('Saved.'); await load();
    } catch { setErr('Network problem'); }
    setSavingId('');
  }

  function addNumber(row: Row) {
    const raw = (newNum[row.machine_id] || '').trim();
    if (!raw) return;
    const limit = limitFor(row);
    if (limit != null && row.notify_numbers.length >= limit) {
      setErr(`Limit is ${limit} numbers for this tenant. Raise the limit below first.`); return;
    }
    const nums = [...row.notify_numbers, raw];
    setNewNum({ ...newNum, [row.machine_id]: '' });
    saveRow(row, nums, row.mode);
  }
  const removeNumber = (row: Row, idx: number) => saveRow(row, row.notify_numbers.filter((_, i) => i !== idx), row.mode);
  const setMode = (row: Row, mode: string) => saveRow(row, row.notify_numbers, mode);

  async function setLimit(t: Tenant, max: number) {
    setErr(''); setMsg('');
    try {
      const r = await fetch('/api/notify-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_limit: { owner_id: t.id, max } }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Limit update failed'); return; }
      setMsg('Limit updated.'); await load();
    } catch { setErr('Network problem'); }
  }

  if (forbidden) return <div style={{ padding: 60, textAlign: 'center', color: C.text3 }}>Access restricted to Super Admins only.</div>;
  if (loading) return <div style={{ padding: 40, color: C.text2 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100%', overflow: 'auto' }}>
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>WhatsApp Notifications</div>
        <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5 }}>
          Manage which numbers receive visit &amp; status updates per machine. Fruitlink-owned machines have no limit; each tenant is capped (default 5). Delivery method can change later without reconfiguring.
        </div>
        {err && <div style={{ marginTop: 12, padding: '10px 12px', background: C.redBg, color: C.red, borderRadius: 8, fontSize: 14 }}>{err}</div>}
        {msg && <div style={{ marginTop: 12, padding: '10px 12px', background: C.greenBg, color: C.green, borderRadius: 8, fontSize: 14 }}>{msg}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18, marginBottom: 18 }}>
        {rows.map(row => {
          const limit = limitFor(row);
          return (
            <div key={row.machine_id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <b style={{ fontSize: 15, color: C.text }}>{row.machine_name}</b>
                <span style={{ fontSize: 12, color: C.text2, background: '#f0f1f5', padding: '3px 11px', borderRadius: 20 }}>
                  {row.owner_id === FRUITLINK_ID ? 'Fruitlink' : (tenantOf(row.owner_id)?.name || 'Tenant')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(['self_service', 'fruitlink_service'] as const).map(m => (
                  <button key={m} onClick={() => setMode(row, m)} disabled={savingId === row.machine_id}
                    style={{ flex: 1, padding: '9px', fontSize: 12.5, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                      border: '1px solid ' + (row.mode === m ? C.orange : C.border2),
                      background: row.mode === m ? C.orange : '#fff', color: row.mode === m ? '#fff' : C.text }}>
                    {m === 'self_service' ? 'Self-service' : 'Fruitlink service'}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Notify numbers {limit != null ? `(${row.notify_numbers.length}/${limit})` : '(unlimited)'}
              </div>
              {row.notify_numbers.length === 0 && <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>No numbers yet.</div>}
              {row.notify_numbers.map((n, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 11px', background: '#f7f8fb', borderRadius: 8, marginBottom: 6, fontSize: 14 }}>
                  <span>{n}</span>
                  <button onClick={() => removeNumber(row, i)} disabled={savingId === row.machine_id}
                    style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Remove</button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={newNum[row.machine_id] || ''} placeholder="+9198…"
                  onChange={e => setNewNum({ ...newNum, [row.machine_id]: e.target.value })}
                  style={{ flex: 1, padding: '10px', fontSize: 14, border: '1px solid ' + C.border2, borderRadius: 8, boxSizing: 'border-box' }} />
                <button onClick={() => addNumber(row)} disabled={savingId === row.machine_id}
                  style={{ padding: '10px 18px', background: C.orange, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Add</button>
              </div>
              {row.source === 'owner_default' && <div style={{ fontSize: 12, color: C.text3, marginTop: 8, fontStyle: 'italic' }}>Using owner default. Adding a number here creates a machine-specific list.</div>}
            </div>
          );
        })}
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Tenant number limits</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>Only super admin can change a tenant's cap. Fruitlink itself is unlimited.</div>
        {tenants.filter(t => t.role !== 'super_admin').map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #eef0f5' }}>
            <span><b style={{ color: C.text }}>{t.name}</b> <span style={{ color: C.text3, fontSize: 13 }}>{t.email}</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setLimit(t, Math.max(0, t.max_notify_numbers - 1))} style={stepBtn}>−</button>
              <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 16, color: C.text }}>{t.max_notify_numbers}</span>
              <button onClick={() => setLimit(t, t.max_notify_numbers + 1)} style={stepBtn}>+</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#ffffff', borderRadius: 12, padding: 18, border: '1px solid #e8eaf0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const stepBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: '1px solid #dcdfe9', background: '#fff', fontSize: 18, cursor: 'pointer', color: '#1f2533' };
