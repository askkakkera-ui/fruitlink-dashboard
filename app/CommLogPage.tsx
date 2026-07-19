'use client'
import React, { useState, useEffect } from 'react'
import { C } from './lib/dashboard-shared'

// ─── Comm Log (super admin only) ─────────────────────────────────
export function CommLogPage({ machines }: any) {
  const [sn, setSn] = useState('')
  const [log, setLog] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [fetchedAt, setFetchedAt] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!sn && machines && machines.length > 0) setSn(machines[0].sn)
  }, [machines])

  const loadLog = async (forSn: string) => {
    if (!forSn) return
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/machine-control?action=commlog&sn=' + encodeURIComponent(forSn))
      const text = await r.text()
      if (!r.ok) { setErr('Error loading log (HTTP ' + r.status + ')'); setLog(''); }
      else if (!text || text.includes('No log entries yet')) { setErr(text || 'No log entries yet.'); setLog(''); }
      else { setLog(text); setFetchedAt(new Date().toLocaleString('en-IN', { hour12: true })); setErr(''); }
    } catch (e: any) { setErr('Network error: ' + e.message); setLog(''); }
    setLoading(false)
  }

  useEffect(() => { if (sn) loadLog(sn) }, [sn])
  useEffect(() => {
    if (!autoRefresh || !sn) return
    const t = setInterval(() => loadLog(sn), 30000)
    return () => clearInterval(t)
  }, [autoRefresh, sn])

  const download = () => {
    const blob = new Blob([log], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = (sn || 'machine') + '_commlog.txt'
    a.click(); URL.revokeObjectURL(url)
  }

  const selected = machines?.find((m: any) => m.sn === sn)
  const lines = log ? log.split('\n').filter((l: string) => l.trim()).reverse() : []
  const filtered = search ? lines.filter((l: string) => l.toLowerCase().includes(search.toLowerCase())) : lines
  const lineCount = lines.length

  const typeColor = (line: string) => {
    if (line.includes('[RX SENSORS')) return '#58A6FF'
    if (line.includes('[RX STOCK  ')) return '#79C0FF'
    if (line.includes('[RX STATES ')) return '#79C0FF'
    if (line.includes('[RX HEALTH ')) return '#58A6FF'
    if (line.includes('[HEARTBEAT ')) return '#58A6FF'
    if (line.includes('[CHANGE    ')) return '#FFA657'
    if (line.includes('[READINESS ')) return line.includes('OK') ? '#3FB950' : '#F0883E'
    if (line.includes('[FAULT     ')) return '#F85149'
    if (line.includes('[ORDER     ')) return '#3FB950'
    if (line.includes('[COMMAND   ')) return '#D29922'
    if (line.includes('[CMD_CREATE')) return '#D29922'
    return '#8B949E'
  }

  const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 13, background: C.surface, color: C.text, cursor: 'pointer' }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Comm Log</div>
        <div style={{ fontSize: 13, color: C.text2 }}>
          Server-side communication log{selected ? ' — ' + (selected.display_name || selected.sn) : ''}
        </div>
      </div>

      {/* Controls — wraps on mobile */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12 }}>
        <select value={sn} onChange={e => setSn(e.target.value)} style={{ ...inp, minWidth: 160, flex: '1 1 160px' }}>
          {(!machines || machines.length === 0) && <option value="">No machines</option>}
          {machines && machines.map((m: any) => (
            <option key={m.sn} value={m.sn}>{m.display_name || m.sn}</option>
          ))}
        </select>
        <input type="text" placeholder="🔍 Filter logs..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: '1 1 140px', minWidth: 120 }} />
        <button onClick={() => loadLog(sn)} disabled={loading || !sn}
          style={{ ...inp, background: C.orange, color: '#fff', border: 'none', fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
          {loading ? '...' : '↻ Refresh'}
        </button>
        <button onClick={() => setAutoRefresh(!autoRefresh)}
          style={{ ...inp, background: autoRefresh ? C.green : C.surface2, color: autoRefresh ? '#fff' : C.text3, border: autoRefresh ? 'none' : '1px solid ' + C.border, fontWeight: 700 }}>
          {autoRefresh ? '⏸ Live' : '▶ Auto'}
        </button>
        <button onClick={download} disabled={!log}
          style={{ ...inp, background: C.surface2, color: log ? C.text2 : C.text3, fontWeight: 600 }}>
          ⬇ Save
        </button>
      </div>

      {/* Stats bar */}
      {sn && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 12, color: C.text3, flexWrap: 'wrap' as const }}>
          <span><b style={{ color: C.text2 }}>SN:</b> <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{sn}</span></span>
          {lineCount > 0 && <span><b style={{ color: C.text2 }}>Lines:</b> {lineCount.toLocaleString('en-IN')}</span>}
          {search && filtered.length !== lineCount && <span><b style={{ color: C.orange }}>Showing:</b> {filtered.length} of {lineCount}</span>}
          {fetchedAt && <span><b style={{ color: C.text2 }}>Updated:</b> {fetchedAt}</span>}
          {autoRefresh && <span style={{ color: C.green, fontWeight: 700 }}>● Live (30s)</span>}
        </div>
      )}

      {/* Log viewer */}
      {err ? (
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 14, padding: '40px 20px', textAlign: 'center', color: C.text3, fontSize: 14 }}>{err}</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading comm log...</div>
      ) : filtered.length > 0 ? (
        <div style={{ background: '#0d1117', borderRadius: 14, border: '1px solid ' + C.border2, overflow: 'hidden' }}>
          <div style={{ maxHeight: '65vh', overflow: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' as any }}>
            {filtered.map((line: string, i: number) => (
              <div key={i} style={{
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                fontSize: 12, lineHeight: 1.6, color: typeColor(line),
                borderBottom: '1px solid #21262d', padding: '3px 0',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all' as const
              }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 14, padding: '40px 20px', textAlign: 'center', color: C.text3, fontSize: 14 }}>
          Select a machine to view its comm log.
        </div>
      )}

      {/* Legend */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: C.text3, flexWrap: 'wrap' as const }}>
          <span><span style={{ color: '#58A6FF' }}>●</span> Sensors</span>
          <span><span style={{ color: '#79C0FF' }}>●</span> Stock/States</span>
          <span><span style={{ color: '#FFA657' }}>●</span> Change</span>
          <span><span style={{ color: '#F0883E' }}>●</span> Readiness</span>
          <span><span style={{ color: '#F85149' }}>●</span> Fault</span>
          <span><span style={{ color: '#3FB950' }}>●</span> Order</span>
          <span><span style={{ color: '#D29922' }}>●</span> Command</span>
        </div>
      )}
    </div>
  )
}
