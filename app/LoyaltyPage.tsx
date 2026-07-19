'use client'
import { useState, useEffect } from 'react'
import { C, SB_KEY, Pill, StatCard } from './lib/dashboard-shared'

export function LoyaltyPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ phone: '', name: '', points: 0 })
  const [config, setConfig] = useState({ points_per_cup: 10, redeem_threshold: 100, redeem_discount_pct: 10 })
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }

  const loadCustomers = () => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/loyalty?select=*&order=points.desc'))
      .then(r => r.json()).then(d => { setCustomers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setCustomers([]); setLoading(false) })
  }
  useEffect(() => { loadCustomers() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/loyalty'), {
        method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ phone: form.phone, name: form.name, points: form.points, joined_at: new Date().toISOString() })
      })
      setShowForm(false)
      setForm({ phone: '', name: '', points: 0 })
      loadCustomers()
    } catch { alert('Save failed — make sure the loyalty table exists in Supabase') }
    setSaving(false)
  }

  const addPoints = async (id: string, current: number, add: number) => {
    await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/loyalty?id=eq.' + id), { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ points: current + add }) })
    loadCustomers()
  }

  const filtered = customers.filter((c: any) => !search || c.phone?.includes(search) || c.name?.toLowerCase().includes(search.toLowerCase()))
  const totalPoints = customers.reduce((s: number, c: any) => s + (c.points || 0), 0)
  const eligible = customers.filter((c: any) => c.points >= config.redeem_threshold).length

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Loyalty Programme</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{customers.length} enrolled customers · {config.points_per_cup} pts per cup</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ Add Customer</button>
      </div>

      {/* Config cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Points per Cup', value: config.points_per_cup, color: C.orange, icon: '⭐', pct: 100 },
          { label: 'Redeem Threshold', value: config.redeem_threshold + ' pts', color: C.blue, icon: '🎁', pct: 70 },
          { label: 'Eligible to Redeem', value: eligible, color: C.green, icon: '✅', pct: customers.length > 0 ? (eligible/customers.length)*100 : 0 },
        ].map(s => <StatCard key={s.label} {...s} sub="" />)}
      </div>

      {/* Add customer form */}
      {showForm && (
        <div style={{ background: C.surface, border: '1px solid ' + C.orange + '60', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Add Customer</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
            {[['Phone Number', 'phone', 'tel', '+91 9xxxxxxxxx'], ['Customer Name', 'name', 'text', 'Name'], ['Starting Points', 'points', 'number', '0']].map(([label, key, type, placeholder]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
                <input type={type} value={(form as any)[key]} onChange={e => setForm({...form, [key]: type === 'number' ? +e.target.value : e.target.value})} placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving || !form.phone} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface2, color: C.text2, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}



      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by phone or name..."
          style={{ width: '100%', maxWidth: 320, padding: '9px 14px', borderRadius: 10, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }} />
      </div>

      {/* Customer list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading customers...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.surface, borderRadius: 16, border: '1px solid ' + C.border }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No loyalty customers yet</div>
          <div style={{ fontSize: 13, color: C.text2 }}>Add customers and reward them for repeat purchases</div>
        </div>
      ) : (
        <div style={{ background: C.surface, borderRadius: 14, border: '1px solid ' + C.border, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surface2, borderBottom: '2px solid ' + C.border }}>
                {['Customer', 'Phone', 'Points', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: C.text3, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any, i: number) => {
                const eligible = c.points >= config.redeem_threshold
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid ' + C.border, background: i % 2 === 0 ? C.surface : C.surface2 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.orangeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.orange }}>{(c.name || 'C')[0].toUpperCase()}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.name || 'Customer'}</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: C.text2 }}>{c.phone}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: eligible ? C.green : C.text }}>{c.points || 0}</div>
                      <div style={{ fontSize: 12, color: C.text3 }}>pts</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Pill color={eligible ? C.green : C.amber} bg={eligible ? C.greenBg : C.amberBg}>{eligible ? 'Eligible to redeem' : (config.redeem_threshold - (c.points || 0)) + ' pts to go'}</Pill>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => addPoints(c.id, c.points, config.points_per_cup)} style={{ background: C.orangeBg, color: C.orange, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>+{config.points_per_cup}</button>
                        {eligible && <button onClick={() => addPoints(c.id, c.points, -config.redeem_threshold)} style={{ background: C.greenBg, color: C.green, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Redeem</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid ' + C.border, background: C.surface2, fontSize: 11, color: C.text3 }}>
            {filtered.length} customers · {totalPoints} total points outstanding
          </div>
        </div>
      )}
    </div>
  )
}
