'use client'
import { useState } from 'react'
import { C, FL_LOGO, Dot, Pill } from './lib/dashboard-shared'

// ─── Alerts Page ─────────────────────────────────────────────────
export function AlertsPage({ machines, alerts, loading, fetchAlerts }: any) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active')
  const [sevFilter, setSevFilter] = useState('all')
  const [machineSel, setMachineSel] = useState('all')
  const [expandedM, setExpandedM] = useState<Record<string, boolean>>({})
  const [exFrom, setExFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })
  const [exTo, setExTo] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })
  const [exporting, setExporting] = useState(false)
  const SEVERITY_COLOR: any = { CRITICAL: C.red, HIGH: C.amber, MEDIUM: C.blue, LOW: C.green }
  const SEVERITY_BG: any = { CRITICAL: C.redBg, HIGH: C.amberBg, MEDIUM: C.blueBg, LOW: C.greenBg }
  const ALERT_LABELS: any = {
    machine_offline: 'Machine Offline', temperature_high: 'High Temperature', temperature_low: 'Low Temperature',
    temperature_stop: 'Temp — Stop Selling', stock_empty_l1: 'Layer 1 Empty', stock_empty_l2: 'Layer 2 Empty',
    stock_empty_l3: 'Layer 3 Empty', stock_low_l1: 'Layer 1 Low', stock_low_l2: 'Layer 2 Low',
    stock_low_l3: 'Layer 3 Low', door_open: 'Door Open', vend_failure: 'Vend Failure',
    cup_empty: 'Cups Empty', film_empty: 'Film Empty', cooling_off: 'Cooling Off',
    newsaier_fault_stock: 'Stock Fault', newsaier_fault_mechanical: 'Mechanical Fault',
    waste_bin_full: 'Waste Bin Full', power_loss: 'Power Loss', unusual_access: 'Unusual Access',
  }
  const getMachine = (id: string) => machines.find((m: any) => (m.machine_id || m.id) === id) || {} as any
  const fmtTime = (t: string) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fmtAgo = (t: string) => {
    const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000)
    if (m < 60) return `${m}m ago`
    if (m < 1440) return `${Math.floor(m / 60)}h ago`
    return `${Math.floor(m / 1440)}d ago`
  }
  // Span between open and close (or open→now if still active). ~2–4 min granularity (polling interval).
  const fmtDuration = (from: string, to?: string | null) => {
    const end = to ? new Date(to).getTime() : Date.now()
    let mins = Math.round((end - new Date(from).getTime()) / 60000)
    if (mins < 1) mins = 1
    if (mins < 60) return mins + ' min'
    const h = Math.floor(mins / 60), mm = mins % 60
    if (h < 24) return mm ? h + 'h ' + mm + 'm' : h + 'h'
    const d = Math.floor(h / 24), hh = h % 24
    return hh ? d + 'd ' + hh + 'h' : d + 'd'
  }
  // Effective start of an alert. For offline alerts, back-date to the last heartbeat
  // (created_at minus the gap stated in the message) so the duration shows TRUE downtime,
  // not just how long the alert row was open (which omits the 15-min detection delay).
  const alertStartMs = (a: any) => {
    if (a.alert_type === 'machine_offline') {
      const mm = /(\d+)\s*minutes/.exec(a.message || '')
      if (mm) return new Date(a.created_at).getTime() - parseInt(mm[1], 10) * 60000
    }
    return new Date(a.created_at).getTime()
  }
  const fmtDurationMs = (startMs: number, endMs: number) => {
    let mins = Math.round((endMs - startMs) / 60000)
    if (mins < 1) mins = 1
    if (mins < 60) return mins + ' min'
    const h = Math.floor(mins / 60), mm = mins % 60
    if (h < 24) return mm ? h + 'h ' + mm + 'm' : h + 'h'
    const d = Math.floor(h / 24), hh = h % 24
    return hh ? d + 'd ' + hh + 'h' : d + 'd'
  }
  const openText = (a: any) => {
    const offline = a.alert_type === 'machine_offline'
    const verb = a.resolved_at ? (offline ? 'was offline' : 'was open') : (offline ? 'offline' : 'open')
    const endMs = a.resolved_at ? new Date(a.resolved_at).getTime() : Date.now()
    return verb + ' ' + fmtDurationMs(alertStartMs(a), endMs)
  }
  const loadJsPDF = () => new Promise<any>((resolve, reject) => {
    if ((window as any).jspdf) return resolve((window as any).jspdf)
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
    s.onload = () => resolve((window as any).jspdf)
    s.onerror = () => reject(new Error('Could not load PDF library'))
    document.body.appendChild(s)
  })
  const exportPDF = async () => {
    if (exFrom > exTo) { alert('From date is after To date'); return }
    setExporting(true)
    try {
      const fromMs = new Date(exFrom + 'T00:00:00+05:30').getTime()
      const toMs = new Date(exTo + 'T23:59:59.999+05:30').getTime()
      const rows = alerts.filter((a: any) => { const t = new Date(a.created_at).getTime(); return t >= fromMs && t <= toMs })
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      if (rows.length === 0) { alert('No alerts in that date range.'); setExporting(false); return }
      const lib = await loadJsPDF()
      const doc = new lib.jsPDF({ unit: 'mm', format: 'a4' })
      const sevCount: any = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
      rows.forEach((a: any) => { sevCount[a.severity] = (sevCount[a.severity] || 0) + 1 })
      const active = rows.filter((a: any) => !a.resolved_at).length
      doc.addImage(FL_LOGO, 'JPEG', 14, 8, 50, 21.4)
      doc.setTextColor(28, 35, 51); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
      doc.text('Alert & Downtime Report', 196, 16, { align: 'right' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text('Fruitlink Technologies Pvt Ltd', 196, 22, { align: 'right' })
      doc.setDrawColor(249, 115, 22); doc.setLineWidth(0.6); doc.line(14, 31, 196, 31)
      let y = 40
      doc.setTextColor(40, 40, 40); doc.setFontSize(10)
      doc.text('Period:  ' + exFrom + '  to  ' + exTo, 14, y)
      doc.text('Generated:  ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 14, y + 5)
      y += 16
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(28, 35, 51)
      doc.text('Summary', 14, y); y += 8
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40)
      const kpis = [['Total alerts', String(rows.length)], ['Active (unresolved)', String(active)], ['Resolved', String(rows.length - active)], ['Critical', String(sevCount.CRITICAL || 0)], ['High', String(sevCount.HIGH || 0)], ['Medium', String(sevCount.MEDIUM || 0)], ['Low', String(sevCount.LOW || 0)]]
      kpis.forEach(k => { doc.text(k[0] + ':', 16, y); doc.setFont('helvetica', 'bold'); doc.text(k[1], 80, y); doc.setFont('helvetica', 'normal'); y += 6 })
      doc.addPage(); y = 20
      doc.setFillColor(249, 115, 22); doc.rect(0, 0, 210, 16, 'F')
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
      doc.text('Alert Log', 14, 11)
      y = 26
      const drawHeader = (yy: number) => {
        doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'bold')
        doc.text('Opened (IST)', 12, yy); doc.text('Closed (IST)', 50, yy); doc.text('Machine', 88, yy)
        doc.text('Type', 118, yy); doc.text('Sev', 158, yy); doc.text('Duration', 176, yy)
        doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40)
        return yy + 5
      }
      y = drawHeader(y); doc.setFontSize(7)
      rows.forEach((a: any) => {
        const m = getMachine(a.machine_id)
        const opened = a.created_at ? new Date(alertStartMs(a)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
        const closed = a.resolved_at ? new Date(a.resolved_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'active'
        const dur = fmtDurationMs(alertStartMs(a), a.resolved_at ? new Date(a.resolved_at).getTime() : Date.now())
        doc.setTextColor(40, 40, 40)
        doc.text(opened, 12, y); doc.text(closed, 50, y)
        doc.text(String(m.display_name || '').slice(0, 16), 88, y)
        doc.text(String(ALERT_LABELS[a.alert_type] || a.alert_type || '').slice(0, 20), 118, y)
        if (a.severity === 'CRITICAL') doc.setTextColor(220, 53, 69)
        else if (a.severity === 'HIGH') doc.setTextColor(201, 138, 0)
        else doc.setTextColor(13, 110, 253)
        doc.text(String(a.severity || '').slice(0, 4), 158, y)
        doc.setTextColor(40, 40, 40); doc.text(dur, 176, y)
        y += 4.5
        if (y > 285) { doc.addPage(); y = 20; y = drawHeader(y); doc.setFontSize(7) }
      })
      doc.setFontSize(8); doc.setTextColor(150, 150, 150)
      doc.text('Total alerts listed: ' + rows.length, 12, y + 4)
      doc.text('Fruitlink Technologies Pvt Ltd - Confidential', 14, 290)
      doc.save('Fruitlink_Alerts_' + exFrom + '_to_' + exTo + '.pdf')
    } catch (e: any) { alert('PDF export failed: ' + (e?.message || e)) }
    setExporting(false)
  }
  const scopedAlerts = machineSel === 'all' ? alerts : alerts.filter((a: any) => a.machine_id === machineSel)
  const counts: any = {
    CRITICAL: scopedAlerts.filter((a: any) => !a.resolved_at && a.severity === 'CRITICAL').length,
    HIGH: scopedAlerts.filter((a: any) => !a.resolved_at && a.severity === 'HIGH').length,
    MEDIUM: scopedAlerts.filter((a: any) => !a.resolved_at && a.severity === 'MEDIUM').length,
    LOW: scopedAlerts.filter((a: any) => !a.resolved_at && a.severity === 'LOW').length,
    active: scopedAlerts.filter((a: any) => !a.resolved_at).length,
    resolved: scopedAlerts.filter((a: any) => a.resolved_at).length,
  }
  const fromMs = new Date(exFrom + 'T00:00:00+05:30').getTime()
  const toMs = new Date(exTo + 'T23:59:59.999+05:30').getTime()
  const filtered = alerts.filter((a: any) => {
    if (filter === 'active' && a.resolved_at) return false
    if (filter === 'resolved' && !a.resolved_at) return false
    if (sevFilter !== 'all' && a.severity !== sevFilter) return false
    if (machineSel !== 'all' && (a.machine_id !== machineSel)) return false
    const t = new Date(a.created_at).getTime()
    if (t < fromMs || t > toMs) return false
    return true
  })

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Alert Center</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{counts.active} active · {counts.resolved} resolved</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={machineSel} onChange={e => setMachineSel(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, fontWeight: 600, color: C.text, background: C.surface, cursor: 'pointer', outline: 'none' }}>
            <option value="all">All machines</option>
            {machines.map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
          <button onClick={fetchAlerts} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: C.orange, color: '#fff',
            border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* Date range + PDF export */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-end', gap: 10, background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '12px 16px', marginBottom: 18 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>From</label>
          <input type="date" value={exFrom} onChange={e => setExFrom(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: C.surface2, outline: 'none' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>To</label>
          <input type="date" value={exTo} onChange={e => setExTo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: C.surface2, outline: 'none' }} />
        </div>
        <button onClick={exportPDF} disabled={exporting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: exporting ? 0.6 : 1 }}>{exporting ? 'Building…' : '⬇ PDF report'}</button>
        <div style={{ fontSize: 11, color: C.text3, marginLeft: 'auto', alignSelf: 'center' }}>Filters the list below and the PDF to the selected dates</div>
      </div>

      {/* Severity cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
          <div key={s} onClick={() => setSevFilter(sevFilter === s ? 'all' : s)} style={{
            background: sevFilter === s ? SEVERITY_BG[s] : C.surface,
            border: `1px solid ${sevFilter === s ? SEVERITY_COLOR[s] + '60' : C.border}`,
            borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
            borderTop: `3px solid ${SEVERITY_COLOR[s]}`,
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: counts[s] > 0 ? SEVERITY_COLOR[s] : C.border2, letterSpacing: '-0.02em', marginBottom: 4 }}>{counts[s]}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: SEVERITY_COLOR[s], textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{s}</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>Active alerts</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: C.surface2, borderRadius: 10, padding: 4, width: 'fit-content', border: `1px solid ${C.border}` }}>
        {([['active', `Active (${counts.active})`], ['resolved', `Resolved (${counts.resolved})`], ['all', 'All']] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as any)} style={{
            padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: filter === f ? C.orange : 'transparent',
            color: filter === f ? '#fff' : C.text2,
            fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* Grouped by Machine */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading alerts...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>All clear!</div>
          <div style={{ fontSize: 13, color: C.text2 }}>No alerts match your current filters.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {machines.map((m: any) => {
            const machAlerts = filtered.filter((a: any) => a.machine_id === m.id)
            if (machAlerts.length === 0) return null
            const isOpen = expandedM[m.id] !== false
            return (
              <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                {/* Machine header — click to expand/collapse */}
                <div onClick={() => setExpandedM(prev => ({ ...prev, [m.id]: !isOpen }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', background: C.surface2, borderBottom: isOpen ? `1px solid ${C.border}` : 'none', userSelect: 'none' as const }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: m.status === 'online' ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>{m.status === 'online' ? '🟢' : '🔴'}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                    <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace', marginTop: 1 }}>{m.location} · {m.sn}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: C.redBg, color: C.red, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>{machAlerts.length} alert{machAlerts.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 16, color: C.text3, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
                  </div>
                </div>
                {/* Alert rows */}
                {isOpen && (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                      <thead>
                        <tr style={{ background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
                          {['Severity', 'Alert', 'Time', 'Status'].map((h, i) => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: C.text2, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.07em', width: ['12%','52%','18%','18%'][i] }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {machAlerts.map((a: any, i: number) => (
                          <tr key={a.id} style={{ borderBottom: i < machAlerts.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? C.surface : C.surface2 }}>
                            <td style={{ padding: '12px 16px' }}>
                              <Pill color={SEVERITY_COLOR[a.severity] || C.text2} bg={SEVERITY_BG[a.severity] || C.surface2}>{a.severity}</Pill>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'inline-block', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 5, padding: '1px 7px', fontSize: 12, fontFamily: 'monospace', color: C.text2, marginBottom: 4 }}>{ALERT_LABELS[a.alert_type] || a.alert_type}</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ALERT_LABELS[a.alert_type] || a.alert_type}</div>
                              <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{a.message}</div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Opened</div>
                              <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{new Date(alertStartMs(a)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                              {a.resolved_at ? (
                                <>
                                  <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginTop: 6 }}>Closed</div>
                                  <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{fmtTime(a.resolved_at)}</div>
                                </>
                              ) : (
                                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{fmtAgo(new Date(alertStartMs(a)).toISOString())}</div>
                              )}
                            </td>
                           <td style={{ padding: '12px 16px' }}>
                              {!a.resolved_at ? (
                                <>
                                  <Pill color={C.red} bg={C.redBg}><Dot color={C.red} pulse size={5} /> Active</Pill>
                                  <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>{openText(a)}</div>
                                </>
                              ) : (
                                <>
                                  <Pill color={C.green} bg={C.greenBg}>✓ Resolved</Pill>
                                  <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>{openText(a)}</div>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '8px 16px', borderTop: `1px solid ${C.border}`, background: C.surface2, fontSize: 11, color: C.text3 }}>
                      Showing {machAlerts.length} alert{machAlerts.length !== 1 ? 's' : ''} for {m.display_name}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
