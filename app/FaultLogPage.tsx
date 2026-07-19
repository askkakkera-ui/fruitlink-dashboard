'use client'
import React, { useState, useEffect } from 'react'
import { C, SB_KEY } from './lib/dashboard-shared'

export function FaultLogPage({ machines }: { machines: any[] }) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [machineFilter, setMachineFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [dateRange, setDateRange] = useState('7d')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [autoRefresh, setAutoRefresh] = useState(true)

  const machineMap: Record<string, string> = {}
  const machineSnMap: Record<string, string> = {}
  machines.forEach(m => { machineMap[m.id] = m.display_name || m.sn; machineSnMap[m.id] = m.sn })

  const resolveFault = async (machineId: string, faultCode: string) => {
    const sn = machineSnMap[machineId]
    if (!sn) { alert('Machine SN not found'); return }
    if (!confirm('Resolve fault ' + faultCode + ' on ' + (machineMap[machineId] || sn) + '?')) return
    try {
      const r = await fetch('/api/machine-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fault_clear', sn, fault_code: faultCode })
      })
      const data = await r.json()
      if (data.code === 1) { loadEvents() } else { alert('Failed: ' + (data.msg || 'unknown error')) }
    } catch (e: any) { alert('Error: ' + e.message) }
  }

  const loadEvents = async () => {
    setLoading(true)
    setPage(0)
    try {
      const cutoff = new Date()
      if (dateRange === '24h') cutoff.setHours(cutoff.getHours() - 24)
      else if (dateRange === '7d') cutoff.setDate(cutoff.getDate() - 7)
      else if (dateRange === '30d') cutoff.setDate(cutoff.getDate() - 30)
      else cutoff.setFullYear(cutoff.getFullYear() - 1)
      const machineIds = machines.map((m: any) => m.id).filter(Boolean)
      const midFilter = machineIds.length > 0 ? '&machine_id=in.(' + machineIds.join(',') + ')' : ''
      const path = '/rest/v1/fault_events?select=*&order=opened_at.desc&limit=200&opened_at=gte.' + cutoff.toISOString() + midFilter
      const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
      const r = await fetch('/api/sb?path=' + encodeURIComponent(path), { headers })
      const data = await r.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch (e) { console.error('FaultLog load error:', e) }
    setLoading(false)
  }

  useEffect(() => { loadEvents() }, [dateRange])
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => { loadEvents() }, 60000)
    return () => clearInterval(timer)
  }, [autoRefresh, dateRange])

  const filtered = events.filter(e => {
    if (machineFilter && e.machine_id !== machineFilter) return false
    if (severityFilter && e.severity !== severityFilter) return false
    return true
  })

  const active = filtered.filter(e => !e.cleared_at)
  const resolved = filtered.filter(e => e.cleared_at)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const fmtTime = (iso: string) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  const fmtDur = (s: number | null) => {
    if (!s && s !== 0) return '—'
    if (s < 60) return s + 's'
    if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's'
    return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm'
  }
  const sevColor = (sev: string) => sev === 'critical' ? '#E53935' : sev === 'warning' ? '#F9A825' : C.text2

  const inp: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: C.surface2, cursor: 'pointer' }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Fault Log</div>
          <div style={{ fontSize: 13, color: C.text2 }}>Machine faults — every open, clear, and duration</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <select value={machineFilter} onChange={e => setMachineFilter(e.target.value)} style={inp}>
            <option value="">All machines</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.display_name || m.sn}</option>)}
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={inp}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </select>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={inp}>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <button onClick={loadEvents} style={{ ...inp, background: C.orange, color: '#fff', border: 'none', fontWeight: 700 }}>↻ Refresh</button>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ ...inp, background: autoRefresh ? C.green : C.surface2, color: autoRefresh ? '#fff' : C.text3, border: autoRefresh ? 'none' : '1px solid ' + C.border, fontWeight: 700 }}>{autoRefresh ? '⏸ Live' : '▶ Auto'}</button>
        </div>
      </div>

      {active.length > 0 && (
        <div style={{ background: '#FBEAE9', border: '1px solid #E53935', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: '#E53935', marginBottom: 8 }}>🔴 {active.length} Active Fault{active.length > 1 ? 's' : ''}</div>
          {active.map((e, i) => (
            <div key={e.id || i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', flexWrap: 'wrap' as const, borderTop: i ? '1px solid #F5C6C6' : 'none' }}>
              <span style={{ fontWeight: 700, color: '#E53935', minWidth: 60, fontFamily: 'monospace', fontSize: 13 }}>{e.fault_code}</span>
              <span style={{ fontWeight: 700, color: C.text, flex: 1 }}>{machineMap[e.machine_id] || '?'}</span>
              <span style={{ color: C.text2, fontSize: 13 }}>{e.fault_name || '—'}</span>
              <span style={{ color: C.text3, fontSize: 12 }}>since {fmtTime(e.opened_at)}</span>
              {e.order_code && <span style={{ color: C.orange, fontSize: 12, fontFamily: 'monospace' }}>order {e.order_code}</span>}
              <button onClick={() => resolveFault(e.machine_id, e.fault_code)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#E53935', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Resolve</button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>Loading fault events...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>No fault events found for this period.</div>
      ) : (
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Machine</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Code</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Fault</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Severity</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Opened</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Cleared</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Duration</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Resolution</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Order</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text, fontSize: 11, whiteSpace: 'nowrap' as const }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((e, i) => (
                <tr key={e.id || i} style={{ background: !e.cleared_at ? '#FFF4E5' : i % 2 ? C.surface2 : C.surface, borderBottom: '1px solid ' + C.border }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 12 }}>{machineMap[e.machine_id] || '?'}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: C.orange, fontSize: 12 }}>{e.fault_code}</td>
                  <td style={{ padding: '10px 12px' }}>{e.fault_name || '—'}</td>
                  <td style={{ padding: '10px 12px' }}><span style={{ fontWeight: 700, color: sevColor(e.severity), fontSize: 12, textTransform: 'uppercase' as const }}>{e.severity}</span></td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{fmtTime(e.opened_at)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{e.cleared_at ? fmtTime(e.cleared_at) : <span style={{ color: '#E53935', fontWeight: 700 }}>ACTIVE</span>}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.cleared_at ? fmtDur(e.duration_s) : '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{e.resolution || '—'}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: C.text3 }}>{e.order_code || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{!e.cleared_at && <button onClick={() => resolveFault(e.machine_id, e.fault_code)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: C.orange, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Resolve</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button disabled={page === 0} onClick={() => setPage(page - 1)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: page === 0 ? C.surface2 : C.surface, color: page === 0 ? C.text3 : C.text, fontWeight: 700, cursor: page === 0 ? 'default' : 'pointer', fontSize: 13 }}>← Prev</button>
          <span style={{ fontSize: 13, color: C.text2 }}>Page {page + 1} of {totalPages} ({filtered.length} events)</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: page >= totalPages - 1 ? C.surface2 : C.surface, color: page >= totalPages - 1 ? C.text3 : C.text, fontWeight: 700, cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 13 }}>Next →</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' as const }}>
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 16, flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Summary</div>
          <div style={{ fontSize: 12, color: C.text2 }}>Total events: <strong style={{ color: C.text }}>{filtered.length}</strong></div>
          <div style={{ fontSize: 12, color: C.text2 }}>Active now: <strong style={{ color: active.length > 0 ? '#E53935' : C.green }}>{active.length}</strong></div>
          <div style={{ fontSize: 12, color: C.text2 }}>Resolved: <strong style={{ color: C.text }}>{resolved.length}</strong></div>
        </div>
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 16, flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>By Fault Code</div>
          {Object.entries(filtered.reduce((acc: Record<string, number>, e) => { acc[e.fault_code] = (acc[e.fault_code] || 0) + 1; return acc }, {})).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5).map(([code, count]) => (
            <div key={code} style={{ fontSize: 12, color: C.text2, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', color: C.orange }}>{code}</span>
              <strong style={{ color: C.text }}>{count as number}×</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
