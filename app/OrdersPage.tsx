'use client'
import { useState, useEffect } from 'react'
import { C, SB_KEY, FL_LOGO, Pill, StatCard, sbFetchAll, netPaise } from './lib/dashboard-shared'

export function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('all')
  const [machineSel, setMachineSel] = useState('all')
  const [showAllMachines, setShowAllMachines] = useState(false)
  const [view, setView] = useState<'analytics' | 'orders'>('analytics')
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('week')
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'}) })
  const [customTo, setCustomTo] = useState(() => new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'}))
  const [allowedIds, setAllowedIds] = useState<string[]>([])
  const [exFrom, setExFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })
  const [exTo, setExTo] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })
  const [exporting, setExporting] = useState('')

  const [uRole] = useState(() => typeof document !== 'undefined' ? (document.cookie.match(/fl_role=([^;]+)/)?.[1] || 'operator') : 'operator')
  const [uOpId] = useState(() => { if (typeof document === 'undefined') return ''; const role = document.cookie.match(/fl_role=([^;]+)/)?.[1] || ''; const opId = document.cookie.match(/fl_operator_id=([^;]+)/)?.[1] || ''; const ownerId = document.cookie.match(/fl_owner_id=([^;]+)/)?.[1] || ''; return role === 'sub_operator' ? (ownerId || opId) : opId; })

  useEffect(() => {
    const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    const load = async () => {
      const msRaw = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,location,state'), { headers: h }).then(r => r.json()).then(d => Array.isArray(d) ? d : [])
      const ms = msRaw.filter((m: any) => {
        let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {}
        return st.hidden !== true
      })
      setMachines(ms)
      let ids: string[] = ms.map((m: any) => m.id)
      if (uRole !== 'super_admin' && uOpId) {
        const mo = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machine_operators?operator_id=eq.' + uOpId + '&select=machine_id'), { headers: h }).then(r => r.json())
        ids = Array.isArray(mo) ? mo.map((r: any) => r.machine_id) : []
      }
      const f = ids.length > 0 ? '&machine_id=in.(' + ids.join(',') + ')' : ''
      setAllowedIds(ids)
      const thirtyDaysAgo = new Date(Date.now() - 30*86400000).toISOString();
      // No limit= : PostgREST caps silently and returns 200, so a limit above the
      // cap is a request, not a promise. sbFetchAll pages and throws rather than
      // return a short array that reads as a quiet day.
      try {
        const os = await sbFetchAll('/rest/v1/orders?select=*&order=created_at.desc&created_at=gte.' + thirtyDaysAgo + f, h)
        setOrders(os)
      } catch (e: any) {
        setLoadError(e?.message || 'fetch failed')
        setOrders([])
      }
      setLoading(false)
    }
    load()
  }, [uRole, uOpId])

  const getMachine = (id: string) => machines.find((m: any) => (m.machine_id || m.id) === id) || {} as any
  const fmtAmt = (p: number) => '₹' + (p / 100).toFixed(0)
  const fmtTime = (t: string) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fmtAgo = (t: string) => { const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m/60) + 'h ago'; return Math.floor(m/1440) + 'd ago' }

  // Period filter — calendar-day floors so the KPI totals match the daily chart bars
  const now = new Date()
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
  const istKey = (dt: any) => new Date(dt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const todayKey = istKey(now)
  const istToday = new Date(todayKey + 'T00:00:00+05:30')
  const weekFloor = new Date(istToday.getTime() - 6 * 86400000)
  const monthFloor = new Date(istToday.getTime() - 29 * 86400000)
  const scopedOrders = machineSel === 'all' ? orders : orders.filter((o: any) => o.machine_id === machineSel)
  const periodOrders = scopedOrders.filter((o: any) => {
    const d = new Date(o.created_at)
    if (period === 'today') return istKey(o.created_at) === todayKey
    if (period === 'week') return d >= weekFloor
    if (period === 'custom') return d >= new Date(customFrom + 'T00:00:00+05:30') && d <= new Date(customTo + 'T23:59:59+05:30')
    return d >= monthFloor
  })

  const paidOrders = periodOrders.filter((o: any) => o.pay_state === 1)
  const totalRevenue = paidOrders.reduce((s: number, o: any) => s + netPaise(o), 0)
  const totalCups = paidOrders.reduce((s: number, o: any) => s + (o.cup_num || 1), 0)
  const avgOrder = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0
  const convRate = periodOrders.length > 0 ? (paidOrders.length / periodOrders.length * 100) : 0

  // Revenue per machine
  const machineRevenue = machines.map((m: any) => {
    const mOrders = paidOrders.filter((o: any) => o.machine_id === m.id)
    const rev = mOrders.reduce((s: number, o: any) => s + netPaise(o), 0)
    const cups = mOrders.reduce((s: number, o: any) => s + (o.cup_num || 1), 0)
    return { ...m, revenue: rev, cups, orders: mOrders.length }
  }).sort((a: any, b: any) => b.revenue - a.revenue)

  // Daily revenue chart data (last 7 days)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return istKey(new Date(istToday.getTime() - (6 - i) * 86400000))
  })
  const dailyData = days.map(day => {
    const dayOrders = scopedOrders.filter((o: any) => istKey(o.created_at) === day && o.pay_state === 1)
    return { day: new Date(day + 'T00:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }), revenue: dayOrders.reduce((s: number, o: any) => s + netPaise(o), 0), cups: dayOrders.reduce((s: number, o: any) => s + (o.cup_num || 1), 0) }
  })
  const maxRev = Math.max(...dailyData.map(d => d.revenue), 1)

  // Tab filter for order list
const filtered = scopedOrders.filter((o: any) => {
    if (filter === 'paid') return o.pay_state === 1
    if (filter === 'failed') return o.pay_state === 1 && o.delivery_state === 2
    if (filter === 'delivered') return o.delivery_state === 1
    if (filter === 'refunded') return (o.refund_state || 0) >= 1
    return o.pay_state !== 0
  })

  const PAY_STATE: any = { 0: { label: 'Pending', color: C.amber, bg: C.amberBg }, 1: { label: 'Paid', color: C.green, bg: C.greenBg }, 2: { label: 'Failed', color: C.red, bg: C.redBg } }
  const DEL_STATE: any = { 0: { label: 'Pending', color: C.amber, bg: C.amberBg }, 1: { label: 'Delivered', color: C.green, bg: C.greenBg }, 2: { label: 'Failed', color: C.red, bg: C.redBg } }
  const REFUND_STATE: any = { 0: { label: '—', color: C.text3, bg: 'transparent' }, 1: { label: 'Refunded', color: C.green, bg: C.greenBg }, 2: { label: 'Manual', color: C.amber, bg: C.amberBg }, 3: { label: 'Processing', color: C.amber, bg: C.amberBg } }
  const isRefundView = filter === 'refunded'
  // ─── Export: CSV (all rows) + PDF (summary). Pulls fresh from DB for the chosen range ───
  const _esc = (v: any) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const _istLabel = (t: string) => t ? new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  const _payLabel = (s: number) => s === 1 ? 'Paid' : s === 0 ? 'Pending' : 'Failed'
  const _delLabel = (s: number) => s === 1 ? 'Delivered' : s === 0 ? 'Pending' : 'Failed'

  const fetchRange = async () => {
    const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    const startISO = new Date(exFrom + 'T00:00:00+05:30').toISOString()
    const endISO = new Date(exTo + 'T23:59:59.999+05:30').toISOString()
    const idf = allowedIds.length > 0 ? '&machine_id=in.(' + allowedIds.join(',') + ')' : ''
    // No limit= : PostgREST caps at db-max-rows and returns 200, so limit=10000
    // was a request, not a promise. The 16 Jul PDF headed 01 Jul in fact began at
    // 07 Jul - 1,185 orders in the range, exactly 1,000 in the document, Rs 14,770
    // of gross absent, no error anywhere.
    //
    // sbFetchAll pages and throws rather than return short. Callers must NOT
    // swallow that: a dashboard can be reloaded, a PDF is saved, sent, and
    // believed months later. A report that cannot prove it is complete must not
    // be produced at all.
    const path = '/rest/v1/orders?select=*&created_at=gte.' + startISO + '&created_at=lte.' + endISO + idf + '&order=created_at.desc'
    return await sbFetchAll(path, h)
  }

  const _download = (content: BlobPart, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const exportCSV = async () => {
    if (exFrom > exTo) { alert('From date is after To date'); return }
    setExporting('csv')
    try {
      const rows = await fetchRange()
      if (rows.length === 0) { alert('No orders returned for that range.'); setExporting(''); return }
      const head = ['Order Code', 'Machine', 'Location', 'Amount (INR)', 'Payment', 'Delivery', 'Cups', 'Created (IST)', 'Paid (IST)', 'Delivered (IST)', 'PayU ID']
      const lines = [head.join(',')]
      rows.filter((o: any) => o.pay_state === 1).forEach((o: any) => {
        const m = getMachine(o.machine_id)
        lines.push([o.order_code, m.display_name || '', m.location || '', ((o.amount_paise || 0) / 100).toFixed(2), _payLabel(o.pay_state), _delLabel(o.delivery_state), o.cup_num || 1, _istLabel(o.created_at), _istLabel(o.paid_at), _istLabel(o.delivered_at), o.mihpayid || ''].map(_esc).join(','))
      })
      _download('\uFEFF' + lines.join('\n'), 'Fruitlink_Orders_' + exFrom + '_to_' + exTo + '.csv', 'text/csv;charset=utf-8;')
    } catch (e: any) { alert('Export failed: ' + (e?.message || e)) }
    setExporting('')
  }

  const _loadJsPDF = () => new Promise<any>((resolve, reject) => {
    if ((window as any).jspdf) return resolve((window as any).jspdf)
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
    s.onload = () => resolve((window as any).jspdf)
    s.onerror = () => reject(new Error('Could not load PDF library'))
    document.body.appendChild(s)
  })

  const exportPDF = async () => {
    if (exFrom > exTo) { alert('From date is after To date'); return }
    setExporting('pdf')
    try {
      const rows = await fetchRange()
      if (rows.length === 0) { alert('No orders returned for that range.'); setExporting(''); return }
      const lib = await _loadJsPDF()
      const doc = new lib.jsPDF({ unit: 'mm', format: 'a4' })
      const paid = rows.filter((o: any) => o.pay_state === 1)
      const revenue = paid.reduce((s: number, o: any) => s + (o.amount_paise || 0), 0) / 100
      const cups = paid.reduce((s: number, o: any) => s + (o.cup_num || 1), 0)
      const conv = rows.length ? (paid.length / rows.length * 100) : 0
      const avg = paid.length ? revenue / paid.length : 0
      const _isTest = (n: string) => /test/i.test(n || '')
      const refDone = rows.filter((o: any) => o.refund_state === 1)
      const refGenuine = refDone.filter((o: any) => !_isTest(o.refund_note))
      const refTest = refDone.filter((o: any) => _isTest(o.refund_note))
      const refFailed = rows.filter((o: any) => o.refund_state === 2)
      const sumP = (a: any[]) => a.reduce((s: number, o: any) => s + (o.amount_paise || 0), 0) / 100
      const refGenuineAmt = sumP(refGenuine)
      const refTestAmt = sumP(refTest)
      const refFailedAmt = sumP(refFailed)
      const netRevenue = revenue - refGenuineAmt
      doc.addImage(FL_LOGO, 'JPEG', 14, 8, 50, 21.4)
      doc.setTextColor(28, 35, 51); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
      doc.text('Revenue & Orders Report', 196, 16, { align: 'right' })
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
      const kpis = [['Gross Revenue (paid)', 'Rs ' + revenue.toFixed(0)], ['Less: Refunds (genuine)', '- Rs ' + refGenuineAmt.toFixed(0) + '  (' + refGenuine.length + ' orders)'], ['Net Revenue', 'Rs ' + netRevenue.toFixed(0)], ['Paid Orders', String(paid.length)], ['Orders Placed', String(rows.length)], ['Conversion', conv.toFixed(0) + '%'], ['Cups Served', String(cups)], ['Avg Order Value', 'Rs ' + avg.toFixed(0)]]
      if (refTest.length > 0) kpis.push(['Test refunds (excl.)', 'Rs ' + refTestAmt.toFixed(0) + '  (' + refTest.length + ' orders)'])
      if (refFailed.length > 0) kpis.push(['FAILED refunds - owed', 'Rs ' + refFailedAmt.toFixed(0) + '  (' + refFailed.length + ' customers)'])
      kpis.forEach(k => { doc.text(k[0] + ':', 16, y); doc.setFont('helvetica', 'bold'); doc.text(k[1], 80, y); doc.setFont('helvetica', 'normal'); y += 6 })
      y += 8
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(28, 35, 51)
      doc.text('By Machine', 14, y); y += 7
      doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text('Machine', 16, y); doc.text('Placed', 74, y); doc.text('Paid', 94, y); doc.text('Cups', 112, y); doc.text('Gross', 130, y); doc.text('Refunds', 152, y); doc.text('Net', 178, y); y += 5
      doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal')
      const byM: any = {}
      rows.forEach((o: any) => { const id = o.machine_id; if (!byM[id]) byM[id] = { placed: 0, paid: 0, cups: 0, rev: 0, net: 0 }; byM[id].placed++; if (o.pay_state === 1) { byM[id].paid++; byM[id].cups += (o.cup_num || 1); byM[id].rev += (o.amount_paise || 0) / 100; byM[id].net += netPaise(o) / 100 } })
      Object.keys(byM).forEach(id => { const m = getMachine(id); const r = byM[id]; const ref = r.rev - r.net; doc.text(String(m.display_name || id.slice(0, 8)).slice(0, 24), 16, y); doc.text(String(r.placed), 74, y); doc.text(String(r.paid), 94, y); doc.text(String(r.cups), 112, y); doc.text('Rs ' + r.rev.toFixed(0), 130, y); doc.text(ref > 0 ? '- Rs ' + ref.toFixed(0) : '-', 152, y); doc.text('Rs ' + r.net.toFixed(0), 178, y); y += 5; if (y > 270) { doc.addPage(); y = 20 } })
      y += 8
      if (y > 250) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(28, 35, 51)
      doc.text('Daily Breakdown (paid)', 14, y); y += 7
      doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text('Date', 16, y); doc.text('Paid', 76, y); doc.text('Cups', 100, y); doc.text('Gross', 126, y); doc.text('Refunds', 150, y); doc.text('Net', 178, y); y += 5
      doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal')
      const byD: any = {}
      paid.forEach((o: any) => { const key = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); if (!byD[key]) byD[key] = { paid: 0, cups: 0, rev: 0, net: 0 }; byD[key].paid++; byD[key].cups += (o.cup_num || 1); byD[key].rev += (o.amount_paise || 0) / 100; byD[key].net += netPaise(o) / 100 })
      Object.keys(byD).sort().forEach(key => { const r = byD[key]; const ref = r.rev - r.net; doc.text(key, 16, y); doc.text(String(r.paid), 76, y); doc.text(String(r.cups), 100, y); doc.text('Rs ' + r.rev.toFixed(0), 126, y); doc.text(ref > 0 ? '- Rs ' + ref.toFixed(0) : '-', 150, y); doc.text('Rs ' + r.net.toFixed(0), 178, y); y += 5; if (y > 280) { doc.addPage(); y = 20 } })

      // ── Full transaction list (all orders: paid + failed + refunded) ──
      doc.addPage(); y = 20
      doc.setFillColor(249, 115, 22); doc.rect(0, 0, 210, 16, 'F')
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
      doc.text('Transaction List — Paid, Refunded & Failed', 14, 11)
      y = 26
      const _txnStatus = (o: any) => {
        if (o.refund_state === 1) return 'Refunded'
        if (o.refund_state === 2) return 'Refund Failed'
        if (o.pay_state === 1) return 'Paid'
        if (o.pay_state === 2) return 'Failed'
        return 'Pending'
      }
      // Column header
      const drawTxnHeader = (yy: number) => {
        doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'bold')
        doc.text('Date (IST)', 12, yy)
        doc.text('Txn / Order', 44, yy)
        doc.text('Machine', 84, yy)
        doc.text('Store / Place', 120, yy)
        doc.text('Amount', 162, yy)
        doc.text('Status', 184, yy)
        doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40)
        return yy + 5
      }
      y = drawTxnHeader(y)
      doc.setFontSize(7)
      // Newest first
      const txns = [...rows].filter((o: any) => _txnStatus(o) !== 'Pending').sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      txns.forEach((o: any) => {
        const m = getMachine(o.machine_id)
        const dateStr = o.created_at ? new Date(o.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
        const txnNo = (o.mihpayid || o.order_code || '').toString().slice(0, 20)
        const midShort = String(o.machine_id || '').slice(0, 8)
        const mName = (m.display_name || '').slice(0, 14)
        const store = (m.location || '').slice(0, 22)
        const amt = 'Rs ' + ((o.amount_paise || 0) / 100).toFixed(0)
        const status = _txnStatus(o)
        doc.setTextColor(40, 40, 40)
        doc.text(dateStr, 12, y)
        doc.text(txnNo, 44, y)
        doc.text(midShort + ' ' + mName, 84, y)
        doc.text(store, 120, y)
        doc.text(amt, 162, y)
        // colored status
        if (status === 'Paid') doc.setTextColor(25, 135, 84)
        else if (status === 'Refunded') doc.setTextColor(13, 110, 253)
        else if (status === 'Failed' || status === 'Refund Failed') doc.setTextColor(220, 53, 69)
        else doc.setTextColor(150, 150, 150)
        doc.text(status, 184, y)
        doc.setTextColor(40, 40, 40)
        y += 4.5
        if (y > 285) { doc.addPage(); y = 20; y = drawTxnHeader(y); doc.setFontSize(7) }
      })
      doc.setFontSize(8); doc.setTextColor(150, 150, 150)
      const _pending = rows.length - txns.length
      doc.text('Total listed: ' + txns.length + ' of ' + rows.length + ' orders placed' + (_pending > 0 ? '  ·  ' + _pending + ' pending (payment never completed) not listed' : ''), 12, y + 4)

      doc.setFontSize(8); doc.setTextColor(150, 150, 150)
      doc.text('Fruitlink Technologies Pvt Ltd - Confidential', 14, 290)
      doc.save('Fruitlink_Revenue_' + exFrom + '_to_' + exTo + '.pdf')
    } catch (e: any) { alert('PDF export failed: ' + (e?.message || e)) }
    setExporting('')
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Revenue & Orders</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{orders.length} total orders · {machines.length} machines</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: 3 }}>
            {[['analytics', '📊 Analytics'], ['orders', '📋 Orders']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v as any)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: view === v ? C.orange : 'transparent', color: view === v ? '#fff' : C.text2, transition: 'all .15s' }}>{l}</button>
            ))}
          </div>
{/* Machine selector */}
          <select value={machineSel} onChange={e => { setMachineSel(e.target.value); setShowAllMachines(false) }} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 12.5, fontWeight: 600, color: C.text, background: C.surface, cursor: 'pointer', outline: 'none' }}>
            <option value="all">All machines</option>
            {machines.map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
          {/* Period toggle */}
          {view === 'analytics' && (
            <div style={{ display: 'flex', background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: 3 }}>
              {[['today', 'Today'], ['week', '7 Days'], ['month', '30 Days'], ['custom', 'Custom']].map(([p, l]) => (
                <button key={p} onClick={() => setPeriod(p as any)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: period === p ? C.orange : 'transparent', color: period === p ? '#fff' : C.text2, transition: 'all .15s' }}>{l}</button>
              ))}
              {period === 'custom' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid ' + C.border, color: C.text, background: C.surface }} />
                  <span style={{ fontSize: 11, color: C.text3 }}>to</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid ' + C.border, color: C.text, background: C.surface }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-end', gap: 10, background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '12px 16px', marginBottom: 18 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>From</label>
          <input type="date" value={exFrom} onChange={e => setExFrom(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: C.surface2, outline: 'none' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>To</label>
          <input type="date" value={exTo} onChange={e => setExTo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: C.surface2, outline: 'none' }} />
        </div>
        <button onClick={exportCSV} disabled={!!exporting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: exporting ? 0.6 : 1 }}>{exporting === 'csv' ? 'Exporting…' : '⬇ CSV (all rows)'}</button>
        <button onClick={exportPDF} disabled={!!exporting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: exporting ? 0.6 : 1 }}>{exporting === 'pdf' ? 'Building…' : '⬇ PDF (summary)'}</button>
        <div style={{ fontSize: 11, color: C.text3, marginLeft: 'auto', alignSelf: 'center' }}>Pulls fresh from database for the chosen dates</div>
      </div>

      {view === 'analytics' ? (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
            {[
              { label: 'Total Revenue', value: fmtAmt(totalRevenue), sub: period === 'today' ? 'today' : period === 'week' ? 'last 7 days' : period === 'custom' ? customFrom + ' to ' + customTo : 'last 30 days', color: C.green, icon: '₹', pct: 75 },
              { label: 'Paid Orders', value: paidOrders.length.toString(), sub: periodOrders.length + ' placed · ' + convRate.toFixed(0) + '% paid', color: C.blue, icon: '✅', pct: convRate },
              { label: 'Avg Order Value', value: fmtAmt(avgOrder), sub: 'per transaction', color: C.orange, icon: '📈', pct: 60 },
              { label: 'Cups Served', value: totalCups.toString(), sub: 'juice cups', color: C.amber, icon: '🥤', pct: 80 },
            ].map(s => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Daily Revenue Chart */}
          <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 14, padding: '20px 24px', marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Daily Revenue — Last 7 Days</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 20 }}>Paid orders only</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
              {dailyData.map((d, i) => {
                const h = Math.max((d.revenue / maxRev) * 140, d.revenue > 0 ? 8 : 0)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {d.revenue > 0 && (
                      <div style={{ textAlign: 'center', lineHeight: 1.25 }}>
                        <div style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>{fmtAmt(d.revenue)}</div>
                        {d.cups > 0 && <div style={{ fontSize: 10, color: C.orange, fontWeight: 700 }}>{d.cups}🥤</div>}
                      </div>
                    )}
                    <div style={{ width: '100%', height: h, background: d.revenue > 0 ? C.orange : C.border, borderRadius: '4px 4px 0 0', transition: 'height .4s', position: 'relative' as const }}>
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, textAlign: 'center', fontWeight: 500 }}>{d.day}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Revenue per machine */}
          <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Revenue by Machine</div>
            {machineRevenue.length === 0 ? (
              <div style={{ color: C.text3, fontSize: 13 }}>No revenue data for this period</div>
            ) : (machineSel === 'all' && !showAllMachines ? machineRevenue.slice(0, 10) : machineRevenue).map((m: any, i: number) => {
              const pct = totalRevenue > 0 ? (m.revenue / totalRevenue * 100) : 0
              return (
                <div key={m.id} style={{ marginBottom: i < machineRevenue.length - 1 ? 18 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: C.orangeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🖥</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.display_name}</div>
                        <div style={{ fontSize: 12, color: C.text3 }}>{m.orders} orders · {m.cups} cups</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{fmtAmt(m.revenue)}</div>
                      <div style={{ fontSize: 12, color: C.text3 }}>{pct.toFixed(1)}% of total</div>
                    </div>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                    <div style={{ height: '100%', background: C.orange, borderRadius: 3, width: pct + '%', transition: 'width .6s' }} />
                  </div>
                </div>
              )
            })}
            {machineSel === 'all' && machineRevenue.length > 10 && (
              <button onClick={() => setShowAllMachines(!showAllMachines)} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface2, color: C.text2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {showAllMachines ? 'Show top 10' : `Show all ${machineRevenue.length} machines`}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Order list filter tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: C.surface2, borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid ' + C.border }}>
            {[['all','All Orders'], ['paid','Paid'], ['failed','Failed'], ['delivered','Delivered'], ['refunded','Refunded']].map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', background: filter === f ? C.orange : 'transparent', color: filter === f ? '#fff' : C.text2, fontSize: 12, fontWeight: 600, transition: 'all 0.15s' }}>{label}</button>
            ))}
          </div>

          {loadError ? (
            <div style={{ textAlign: 'center', padding: 40, background: C.redBg, borderRadius: 16, border: '1px solid ' + C.red }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.red, marginBottom: 6 }}>Couldn't load orders</div>
              <div style={{ fontSize: 13, color: C.text2 }}>{loadError}</div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 8 }}>Figures on this page are incomplete. Reload before trusting any number.</div>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading orders...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: C.surface, borderRadius: 16, border: '1px solid ' + C.border }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No orders found</div>
            </div>
          ) : (
            <div style={{ background: C.surface, borderRadius: 16, border: '1px solid ' + C.border, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: C.surface2, borderBottom: '2px solid ' + C.border }}>
                    {(isRefundView ? ['Order Code', 'Machine', 'Refunded', 'Status', 'Cups', 'Time'] : ['Order Code', 'Machine', 'Amount', 'Payment', 'Delivery', 'Cups', 'Time']).map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: C.text3, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o: any, i: number) => {
                    const m = getMachine(o.machine_id)
                    const ps = PAY_STATE[o.pay_state] || PAY_STATE[0]
                    const ds = DEL_STATE[o.delivery_state] || DEL_STATE[0]
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid ' + C.border, background: i % 2 === 0 ? C.surface : C.surface2 }}>
                        <td style={{ padding: '12px 16px' }}><div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.blue }}>{o.order_code}</div></td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{m.display_name || '--'}</div>
                          <div style={{ fontSize: 12, color: C.text3, marginTop: 1 }}>{m.location || ''}</div>
                        </td>
                        {isRefundView ? (
                          <>
                            <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 700, color: o.refund_state === 1 ? C.green : C.red, fontSize: 14 }}>{fmtAmt(o.amount_paise || 0)}</div></td>
                            <td style={{ padding: '12px 16px' }}>
                              {(() => { const rs = REFUND_STATE[o.refund_state] || REFUND_STATE[0]; return <Pill color={rs.color} bg={rs.bg}>{rs.label}</Pill> })()}
                              {o.refund_note && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{o.refund_note}</div>}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 700, color: C.green, fontSize: 14 }}>{fmtAmt(o.amount_paise || 0)}</div></td>
                            <td style={{ padding: '12px 16px' }}>
                              <Pill color={ps.color} bg={ps.bg}>{ps.label}</Pill>
                              <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{o.pay_type?.toUpperCase()}</div>
                            </td>
                            <td style={{ padding: '12px 16px' }}><Pill color={ds.color} bg={ds.bg}>{ds.label}</Pill></td>
                          </>
                        )}
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: C.text }}>{o.cup_num || '--'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 12, color: C.text }}>{fmtTime(o.created_at)}</div>
                          <div style={{ fontSize: 12, color: C.text3, marginTop: 1 }}>{fmtAgo(o.created_at)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid ' + C.border, background: C.surface2, fontSize: 11, color: C.text3 }}>
                Showing {filtered.length} of {orders.length} orders
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
