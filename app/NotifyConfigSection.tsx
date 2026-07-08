'use client';
import { useState, useEffect } from 'react';

const C = {
  bg: '#f4f5f9', surface: '#ffffff', border: '#e8eaf0', border2: '#dcdfe9',
  text: '#1f2533', text2: '#374151', text3: '#4b5563',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  orange: '#FE6505', blue: '#0D6EFD', purple: '#7C3AED', purpleBg: '#EDE9FE',
};

const FRUITLINK_ID = '0c1bd083-682a-4913-ac37-08c85ef94b41';

type Row = {
  machine_id: string; machine_name: string; owner_id: string | null;
  mode: string; notify_numbers: string[]; telegram_chat_ids: string[]; source: string;
};
type Tenant = { id: string; name: string; email: string; role: string; max_notify_numbers: number; max_telegram_ids: number };

export default function NotifyConfigSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [newNum, setNewNum] = useState<Record<string, string>>({});
  const [newTg, setNewTg] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<Record<string, 'whatsapp' | 'telegram'>>({});

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
  function waLimitFor(row: Row): number | null {
    if (row.owner_id === FRUITLINK_ID) return null;
    const t = tenantOf(row.owner_id);
    return t ? t.max_notify_numbers : 5;
  }
  function tgLimitFor(row: Row): number | null {
    if (row.owner_id === FRUITLINK_ID) return null;
    const t = tenantOf(row.owner_id);
    return t ? (t.max_telegram_ids ?? 3) : 3;
  }

  async function saveRow(row: Row, numbers: string[], telegramIds: string[], mode: string) {
    setSavingId(row.machine_id); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/notify-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_id: row.machine_id, notify_numbers: numbers, telegram_chat_ids: telegramIds, mode }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Save failed'); setSavingId(''); return; }
      setMsg('Saved ✓'); await load();
    } catch { setErr('Network problem'); }
    setSavingId('');
  }

  function addNumber(row: Row) {
    const raw = (newNum[row.machine_id] || '').trim();
    if (!raw) return;
    const limit = waLimitFor(row);
    if (limit != null && row.notify_numbers.length >= limit) {
      setErr(`WhatsApp limit is ${limit} numbers for this tenant.`); return;
    }
    setNewNum({ ...newNum, [row.machine_id]: '' });
    saveRow(row, [...row.notify_numbers, raw], row.telegram_chat_ids, row.mode);
  }

  function addTelegramId(row: Row) {
    const raw = (newTg[row.machine_id] || '').trim();
    if (!raw) return;
    if (!/^-?\d+$/.test(raw)) { setErr('Telegram Chat ID must be a number (e.g. 8562917946). Get it from @userinfobot'); return; }
    const limit = tgLimitFor(row);
    if (limit != null && row.telegram_chat_ids.length >= limit) {
      setErr(`Telegram limit is ${limit} IDs for this tenant.`); return;
    }
    setNewTg({ ...newTg, [row.machine_id]: '' });
    saveRow(row, row.notify_numbers, [...row.telegram_chat_ids, raw], row.mode);
  }

  const removeNumber = (row: Row, idx: number) => saveRow(row, row.notify_numbers.filter((_, i) => i !== idx), row.telegram_chat_ids, row.mode);
  const removeTelegramId = (row: Row, idx: number) => saveRow(row, row.notify_numbers, row.telegram_chat_ids.filter((_, i) => i !== idx), row.mode);
  const setMode = (row: Row, mode: string) => saveRow(row, row.notify_numbers, row.telegram_chat_ids, mode);

  async function setLimit(t: Tenant, field: 'whatsapp' | 'telegram', max: number) {
    setErr(''); setMsg('');
    try {
      const r = await fetch('/api/notify-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_limit: { owner_id: t.id, max, field: field === 'telegram' ? 'telegram' : 'whatsapp' } }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Limit update failed'); return; }
      setMsg('Limit updated ✓'); await load();
    } catch { setErr('Network problem'); }
  }

  const getTab = (machineId: string) => activeTab[machineId] || 'whatsapp';
  const setTab = (machineId: string, tab: 'whatsapp' | 'telegram') => setActiveTab({ ...activeTab, [machineId]: tab });

  if (forbidden) return <div style={{ padding: 60, textAlign: 'center', color: C.text3 }}>Access restricted to Super Admins only.</div>;
  if (loading) return <div style={{ padding: 40, color: C.text2 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100%', overflow: 'auto' }}>
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Alert Notifications</div>
        <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5 }}>
          Manage WhatsApp numbers and Telegram Chat IDs per machine. Super admin has no limit; tenants are capped.
          To get a Telegram Chat ID, open Telegram → search <b>@userinfobot</b> → send /start.
        </div>
        {err && <div style={{ marginTop: 12, padding: '10px 12px', background: C.redBg, color: C.red, borderRadius: 8, fontSize: 14 }}>{err}</div>}
        {msg && <div style={{ marginTop: 12, padding: '10px 12px', background: C.greenBg, color: C.green, borderRadius: 8, fontSize: 14 }}>{msg}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18, marginBottom: 18 }}>
        {rows.map(row => {
          const waLimit = waLimitFor(row);
          const tgLimit = tgLimitFor(row);
          const tab = getTab(row.machine_id);
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

              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid ' + C.border2 }}>
                <button onClick={() => setTab(row.machine_id, 'whatsapp')}
                  style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: tab === 'whatsapp' ? C.orange : '#fff', color: tab === 'whatsapp' ? '#fff' : C.text }}>
                  💬 WhatsApp {row.notify_numbers.length > 0 ? `(${row.notify_numbers.length})` : ''}
                </button>
                <button onClick={() => setTab(row.machine_id, 'telegram')}
                  style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, border: 'none', borderLeft: '1px solid ' + C.border2, cursor: 'pointer',
                    background: tab === 'telegram' ? C.purple : '#fff', color: tab === 'telegram' ? '#fff' : C.text }}>
                  ✈️ Telegram {row.telegram_chat_ids.length > 0 ? `(${row.telegram_chat_ids.length})` : ''}
                </button>
              </div>

              {/* WhatsApp tab */}
              {tab === 'whatsapp' && (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
                    WhatsApp Numbers {waLimit != null ? `(${row.notify_numbers.length}/${waLimit})` : '(unlimited)'}
                  </div>
                  {row.notify_numbers.length === 0 && <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>No numbers yet.</div>}
                  {row.notify_numbers.map((n, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 11px', background: '#f7f8fb', borderRadius: 8, marginBottom: 6, fontSize: 14 }}>
                      <span>📱 {n}</span>
                      <button onClick={() => removeNumber(row, i)} disabled={savingId === row.machine_id}
                        style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Remove</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input value={newNum[row.machine_id] || ''} placeholder="+9198…"
                      onChange={e => setNewNum({ ...newNum, [row.machine_id]: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && addNumber(row)}
                      style={{ flex: 1, padding: '10px', fontSize: 14, border: '1px solid ' + C.border2, borderRadius: 8, boxSizing: 'border-box' as const }} />
                    <button onClick={() => addNumber(row)} disabled={savingId === row.machine_id}
                      style={{ padding: '10px 18px', background: C.orange, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                  </div>
                </>
              )}

              {/* Telegram tab */}
              {tab === 'telegram' && (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
                    Telegram Chat IDs {tgLimit != null ? `(${row.telegram_chat_ids.length}/${tgLimit})` : '(unlimited)'}
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>Get Chat ID: open Telegram → search @userinfobot → send /start</div>
                  {row.telegram_chat_ids.length === 0 && <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>No Telegram IDs yet.</div>}
                  {row.telegram_chat_ids.map((n, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 11px', background: '#f3f0ff', borderRadius: 8, marginBottom: 6, fontSize: 14 }}>
                      <span>✈️ {n}</span>
                      <button onClick={() => removeTelegramId(row, i)} disabled={savingId === row.machine_id}
                        style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Remove</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input value={newTg[row.machine_id] || ''} placeholder="e.g. 8562917946"
                      onChange={e => setNewTg({ ...newTg, [row.machine_id]: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && addTelegramId(row)}
                      style={{ flex: 1, padding: '10px', fontSize: 14, border: '1px solid ' + C.border2, borderRadius: 8, boxSizing: 'border-box' as const }} />
                    <button onClick={() => addTelegramId(row)} disabled={savingId === row.machine_id}
                      style={{ padding: '10px 18px', background: C.purple, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                  </div>
                </>
              )}

              {row.source === 'owner_default' && <div style={{ fontSize: 12, color: C.text3, marginTop: 8, fontStyle: 'italic' }}>Using owner default. Adding here creates a machine-specific list.</div>}
            </div>
          );
        })}
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Tenant notification limits</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>Only super admin can change tenant caps. Fruitlink itself is unlimited.</div>
        {tenants.filter(t => t.role !== 'super_admin').map(t => (
          <div key={t.id} style={{ padding: '12px 0', borderBottom: '1px solid #eef0f5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span><b style={{ color: C.text }}>{t.name}</b> <span style={{ color: C.text3, fontSize: 13 }}>{t.email}</span></span>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: C.text2 }}>💬 WhatsApp:</span>
                <button onClick={() => setLimit(t, 'whatsapp', Math.max(0, t.max_notify_numbers - 1))} style={stepBtn}>−</button>
                <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 15, color: C.text }}>{t.max_notify_numbers}</span>
                <button onClick={() => setLimit(t, 'whatsapp', t.max_notify_numbers + 1)} style={stepBtn}>+</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: C.text2 }}>✈️ Telegram:</span>
                <button onClick={() => setLimit(t, 'telegram', Math.max(0, (t.max_telegram_ids ?? 3) - 1))} style={stepBtn}>−</button>
                <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 15, color: C.text }}>{t.max_telegram_ids ?? 3}</span>
                <button onClick={() => setLimit(t, 'telegram', (t.max_telegram_ids ?? 3) + 1)} style={stepBtn}>+</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#ffffff', borderRadius: 12, padding: 18, border: '1px solid #e8eaf0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const stepBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: '1px solid #dcdfe9', background: '#fff', fontSize: 18, cursor: 'pointer', color: '#1f2533' };
