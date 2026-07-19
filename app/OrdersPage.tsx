'use client'
import { useState, useEffect, useRef } from 'react'
import { C, SB_KEY, FL_LOGO, Pill, StatCard, sbFetchAll, netPaise, useIsMobile, formatMoney, formatMoneyBag, currencySymbol, addToBag, currenciesIn, soleCurrency, type MoneyBag } from './lib/dashboard-shared'

// ─── Searchable machine picker ───────────────────────────────────────
// Defined outside OrdersPage: a component declared inside the render body is a
// new type every render, so React remounts it and the search input loses focus
// on the first keystroke. At 500 machines a <select> is unusable, so this filters
// on name / SN / location and never renders more than the matches.
function MachineCombobox({ machines, value, onChange, wide }: any) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const sel = machines.find((m: any) => m.id === value)
  const label = value === 'all' ? 'All machines' : (sel?.display_name || 'Unknown machine')
  const ql = q.trim().toLowerCase()
  const list = ql
    ? machines.filter((m: any) => [m.display_name, m.sn, m.location].some((s: any) => String(s || '').toLowerCase().includes(ql)))
    : machines
  const shown = list.slice(0, 60)

  const pick = (id: string) => { onChange(id); setOpen(false); setQ('') }

  return (
    <div ref={wrap} style={{ position: 'relative', width: wide ? '100%' : 250, minWidth: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        borderRadius: 9, border: '1px solid ' + (open ? C.orange : C.border), background: C.surface,
        cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: C.text, textAlign: 'left', outline: 'none',
      }}>
        <span style={{ fontSize: 13 }}>🖥</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 10, color: C.text3 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: C.surface, border: '1px solid ' + C.border, borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid ' + C.border }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, SN or location…" style={{
              width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid ' + C.border,
              fontSize: 12.5, color: C.text, background: C.surface2, outline: 'none', boxSizing: 'border-box' as const,
            }} />
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <div onClick={() => pick('all')} style={{
              padding: '9px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
              color: value === 'all' ? C.orange : C.text, background: value === 'all' ? C.orangeBg : 'transparent',
              borderBottom: '1px solid ' + C.border,
            }}>All machines <span style={{ color: C.text3, fontWeight: 600 }}>({machines.length})</span></div>
            {shown.map((m: any) => (
              <div key={m.id} onClick={() => pick(m.id)} style={{
                padding: '8px 12px', cursor: 'pointer',
                background: value === m.id ? C.orangeBg : 'transparent',
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: value === m.id ? C.orange : C.text }}>{m.display_name || m.sn || m.id.slice(0, 8)}</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{[m.sn, m.location].filter(Boolean).join(' · ')}</div>
              </div>
            ))}
            {shown.length === 0 && <div style={{ padding: '14px 12px', fontSize: 12, color: C.text3 }}>No machines match "{q}"</div>}
            {list.length > shown.length && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: C.text3, borderTop: '1px solid ' + C.border }}>
                Showing 60 of {list.length} — keep typing to narrow
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Seg({ options, value, onChange }: any) {
  return (
    <div style={{ display: 'flex', background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: 3, flexWrap: 'wrap' as const }}>
      {options.map(([v, l]: any) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: value === v ? C.orange : 'transparent', color: value === v ? '#fff' : C.text2, transition: 'all .15s',
          whiteSpace: 'nowrap' as const,
        }}>{l}</button>
      ))}
    </div>
  )
}

const PAGE_SIZE = 25

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
  // presentation-only state
  const [mrQuery, setMrQuery] = useState('')       // revenue-by-machine search
  const [mrMode, setMrMode] = useState<'machine' | 'site'>('machine')
  const [oQuery, setOQuery] = useState('')          // order list search
  const [page, setPage] = useState(0)
  const isMobile = useIsMobile()

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
      const scoped = uRole !== 'super_admin' && !!uOpId
      if (scoped) {
        const mo = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machine_operators?operator_id=eq.' + uOpId + '&select=machine_id'), { headers: h }).then(r => r.json())
        ids = Array.isArray(mo) ? mo.map((r: any) => r.machine_id) : []
      }
      const f = ids.length > 0 ? '&machine_id=in.(' + ids.join(',') + ')' : ''
      setAllowedIds(ids)
      // An operator with zero machine grants must see zero orders. Without this
      // guard `f` is empty and the query becomes unscoped — every tenant's
      // revenue, to a user entitled to none of it.
      if (scoped && ids.length === 0) { setOrders([]); setLoading(false); return }
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
  // Whole units, ungrouped — the format this page has always shown.
  const FMT = { maxDigits: 0, grouping: false } as const
  const fmtAmt = (p: number, cur = 'INR') => formatMoney(p, cur, FMT)
  // A total that may span currencies renders as one figure per currency
  // ('₹5,270 · R450'), never as a sum. With one currency in scope — every scope
  // today — this is character-for-character what fmtAmt produced.
  const fmtBag = (bag: MoneyBag) => formatMoneyBag(bag, FMT)
  const fmtTime = (t: string) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fmtAgo = (t: string) => { const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m/60) + 'h ago'; return Math.floor(m/1440) + 'd ago' }

  // Machines this user is entitled to. allowedIds is every visible machine for a
  // super_admin and only the granted set otherwise, so this is the same scope the
  // order query runs under — counts and the picker can never imply machines whose
  // orders were filtered out.
  const scopedMachines = allowedIds.length > 0 ? machines.filter((m: any) => allowedIds.includes(m.id)) : (uRole === 'super_admin' ? machines : [])

  // Field reconciliation: these columns are used by the existing exports but are
  // not written anywhere else in this codebase. Rather than render an always-empty
  // column, detect them in the rows actually returned and drop the UI that depends
  // on them when the data does not have them.
  const hasField = (k: string) => orders.some((o: any) => o[k] !== undefined && o[k] !== null)
  const hasDelivery = hasField('delivery_state')
  const hasTxnId = hasField('mihpayid')

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

  // ── Revenue, per currency, never across ──────────────────────────
  // "All machines" is a fleet total, and a fleet can straddle countries. Money
  // is therefore accumulated into a bag keyed by the order's own currency: an
  // INR order and a ZAR order can never land in the same accumulator, so there
  // is no place a conversion could hide. See MoneyBag in dashboard-shared.
  const netBag: MoneyBag = {}
  const grossBag: MoneyBag = {}
  const paidCountByCur: Record<string, number> = {}
  paidOrders.forEach((o: any) => {
    const c = o.currency || 'INR'
    addToBag(netBag, c, netPaise(o))
    addToBag(grossBag, c, o.amount_paise || 0)
    paidCountByCur[c] = (paidCountByCur[c] || 0) + 1
  })
  const refundBag: MoneyBag = {}
  Object.keys(grossBag).forEach(c => { const r = grossBag[c] - (netBag[c] || 0); if (r > 0) refundBag[c] = r })
  const avgBag: MoneyBag = {}
  Object.keys(netBag).forEach(c => { if (paidCountByCur[c]) avgBag[c] = netBag[c] / paidCountByCur[c] })

  // Ratios, rankings and bar heights compare magnitudes, and magnitudes across
  // currencies do not compare. They are therefore all measured inside one
  // currency: the heaviest in scope, which is the only currency in scope today.
  // Rows in other currencies keep their own amounts and simply carry no share.
  const scopeCurs = currenciesIn(netBag)
  const mixedCurs = scopeCurs.length > 1
  const viewCur = scopeCurs[0] || 'INR'
  const totalRevenue = netBag[viewCur] || 0
  const grossRevenue = grossBag[viewCur] || 0
  const refundedPaise = refundBag[viewCur] || 0

  const totalCups = paidOrders.reduce((s: number, o: any) => s + (o.cup_num || 1), 0)
  const convRate = periodOrders.length > 0 ? (paidOrders.length / periodOrders.length * 100) : 0
  const periodLabel = period === 'today' ? 'today' : period === 'week' ? 'last 7 days' : period === 'custom' ? customFrom + ' to ' + customTo : 'last 30 days'

  // Revenue per machine. Each row carries a bag, not a number — a machine sits
  // in exactly one country so its bag holds one currency, but building it this
  // way means the site rollup below cannot silently add two of them together.
  // `revenue` is the row's total in the view currency and exists only so rows
  // can be ranked against each other; rows in another currency rank at 0 and
  // are sorted after, never interleaved by raw magnitude.
  const machineRevenue = scopedMachines.map((m: any) => {
    const mOrders = paidOrders.filter((o: any) => o.machine_id === m.id)
    const bag: MoneyBag = {}
    mOrders.forEach((o: any) => addToBag(bag, o.currency, netPaise(o)))
    const cups = mOrders.reduce((s: number, o: any) => s + (o.cup_num || 1), 0)
    return { ...m, bag, revenue: bag[viewCur] || 0, cups, orders: mOrders.length }
  }).sort((a: any, b: any) => b.revenue - a.revenue)

  // Roll the same numbers up per location for the "By site" view. A site is a
  // location, and one location is one country, but the bags are merged per
  // currency regardless so a shared-name site spanning borders reports
  // "₹X · RY" rather than a meaningless single figure.
  const siteRevenue = (() => {
    const acc: any = {}
    machineRevenue.forEach((m: any) => {
      const key = (m.location || '').trim() || 'Unassigned'
      if (!acc[key]) acc[key] = { id: 'site:' + key, display_name: key, sn: '', location: key, bag: {} as MoneyBag, revenue: 0, cups: 0, orders: 0, machines: 0 }
      Object.keys(m.bag).forEach(c => addToBag(acc[key].bag, c, m.bag[c]))
      acc[key].cups += m.cups; acc[key].orders += m.orders; acc[key].machines++
    })
    Object.values(acc).forEach((r: any) => { r.revenue = r.bag[viewCur] || 0 })
    return Object.values(acc).sort((a: any, b: any) => b.revenue - a.revenue) as any[]
  })()

  // Concentration is measured on the full ranked list, never the filtered view —
  // "top machine = 94% of revenue" must not change because someone typed a search.
  // Both shares are shares of the view currency's revenue only; a fleet spanning
  // currencies gets one concentration reading per currency, not a blended one.
  const concRows = mrMode === 'site' ? siteRevenue : machineRevenue
  const topShare = totalRevenue > 0 && concRows.length > 0 ? (concRows[0].revenue / totalRevenue * 100) : 0
  const top5Share = totalRevenue > 0 ? (concRows.slice(0, 5).reduce((s: number, r: any) => s + r.revenue, 0) / totalRevenue * 100) : 0

  const mrq = mrQuery.trim().toLowerCase()
  const mrFiltered = mrq
    ? concRows.filter((r: any) => [r.display_name, r.sn, r.location].some((s: any) => String(s || '').toLowerCase().includes(mrq)))
    : concRows
  const mrVisible = (showAllMachines || mrq) ? mrFiltered : mrFiltered.slice(0, 8)

  // Daily revenue chart — one bar per calendar day in the selected period, so the
  // chart and the KPI strip always describe the same window.
  const rangeStart = period === 'today' ? istToday : period === 'week' ? weekFloor : period === 'custom' ? new Date(customFrom + 'T00:00:00+05:30') : monthFloor
  const rangeEnd = period === 'custom' ? new Date(customTo + 'T00:00:00+05:30') : istToday
  const dayCount = Math.min(Math.max(Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1, 1), 120)
  const days = Array.from({ length: dayCount }, (_, i) => istKey(new Date(rangeStart.getTime() + i * 86400000)))
  // A bar's height is a magnitude, so each day is measured in the view currency
  // alone. The tooltip still shows the day's full bag, so money in another
  // currency is disclosed rather than dropped — it is simply not drawn to a
  // scale it does not share.
  const dailyData = days.map(day => {
    const dayOrders = scopedOrders.filter((o: any) => istKey(o.created_at) === day && o.pay_state === 1)
    const bag: MoneyBag = {}
    dayOrders.forEach((o: any) => addToBag(bag, o.currency, netPaise(o)))
    return { key: day, day: new Date(day + 'T00:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }), short: new Date(day + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }), bag, revenue: bag[viewCur] || 0, cups: dayOrders.reduce((s: number, o: any) => s + (o.cup_num || 1), 0) }
  })
  const maxRev = Math.max(...dailyData.map(d => d.revenue), 1)
  const dense = dayCount > 14
  const labelEvery = Math.ceil(dayCount / (isMobile ? 5 : 10))

  // Tab filter for order list
const filtered = scopedOrders.filter((o: any) => {
    if (filter === 'paid') return o.pay_state === 1
    if (filter === 'failed') return o.pay_state === 1 && o.delivery_state === 2
    if (filter === 'delivered') return o.delivery_state === 1
    if (filter === 'refunded') return (o.refund_state || 0) >= 1
    return o.pay_state !== 0
  })
  // Search across order code, machine name/location and (when present) the gateway txn id.
  const oq = oQuery.trim().toLowerCase()
  const searched = oq ? filtered.filter((o: any) => {
    const m = getMachine(o.machine_id)
    return [o.order_code, m.display_name, m.location, m.sn, o.mihpayid].some((s: any) => String(s || '').toLowerCase().includes(oq))
  }) : filtered
  const pageCount = Math.max(1, Math.ceil(searched.length / PAGE_SIZE))
  const pageSafe = Math.min(page, pageCount - 1)
  const pageRows = searched.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE)
  useEffect(() => { setPage(0) }, [filter, oQuery, machineSel, view])

  const PAY_STATE: any = { 0: { label: 'Pending', color: C.amber, bg: C.amberBg }, 1: { label: 'Paid', color: C.green, bg: C.greenBg }, 2: { label: 'Failed', color: C.red, bg: C.redBg } }
  const DEL_STATE: any = { 0: { label: 'Pending', color: C.amber, bg: C.amberBg }, 1: { label: 'Delivered', color: C.green, bg: C.greenBg }, 2: { label: 'Failed', color: C.red, bg: C.redBg } }
  const REFUND_STATE: any = { 0: { label: '—', color: C.text3, bg: 'transparent' }, 1: { label: 'Refunded', color: C.green, bg: C.greenBg }, 2: { label: 'Manual', color: C.amber, bg: C.amberBg }, 3: { label: 'Processing', color: C.amber, bg: C.amberBg } }
  const isRefundView = filter === 'refunded'
  const filterTabs: any[] = [['all', 'All Orders'], ['paid', 'Paid']]
  if (hasDelivery) { filterTabs.push(['failed', 'Failed']); filterTabs.push(['delivered', 'Delivered']) }
  filterTabs.push(['refunded', 'Refunded'])
  // ─── Export: CSV (all rows) + PDF (summary). Pulls fresh from DB for the chosen range ───
  const _esc = (v: any) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const _istLabel = (t: string) => t ? new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  const _payLabel = (s: number) => s === 1 ? 'Paid' : s === 0 ? 'Pending' : 'Failed'
  // A missing delivery_state is not a failed delivery. The old `else -> 'Failed'`
  // stamped "Failed" on every row of a CSV whenever the column was absent or null,
  // which reads as a fleet-wide dispensing fault that never happened. Absent stays blank.
  const _delLabel = (s: number) => s == null ? '' : s === 1 ? 'Delivered' : s === 0 ? 'Pending' : 'Failed'

  const fetchRange = async () => {
    const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    const startISO = new Date(exFrom + 'T00:00:00+05:30').toISOString()
    const endISO = new Date(exTo + 'T23:59:59.999+05:30').toISOString()
    // Same guard as the page load: an operator scoped to no machines exports
    // nothing, never everything.
    if (uRole !== 'super_admin' && uOpId && allowedIds.length === 0) return []
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
      // Amount stays a bare number so spreadsheets can sum it, but a bare number
      // is only meaningful next to its unit: the header no longer claims INR,
      // and each row carries the currency it was actually taken in. Summing the
      // Amount column across currencies is now visibly the reader's error to
      // make, not one the file quietly invites.
      const head = ['Order Code', 'Machine', 'Location', 'Amount', 'Currency', 'Payment', 'Delivery', 'Cups', 'Created (IST)', 'Paid (IST)', 'Delivered (IST)', 'PayU ID']
      const lines = [head.join(',')]
      rows.filter((o: any) => o.pay_state === 1).forEach((o: any) => {
        const m = getMachine(o.machine_id)
        lines.push([o.order_code, m.display_name || '', m.location || '', ((o.amount_paise || 0) / 100).toFixed(2), o.currency || 'INR', _payLabel(o.pay_state), _delLabel(o.delivery_state), o.cup_num || 1, _istLabel(o.created_at), _istLabel(o.paid_at), _istLabel(o.delivered_at), o.mihpayid || ''].map(_esc).join(','))
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
      const cups = paid.reduce((s: number, o: any) => s + (o.cup_num || 1), 0)
      const conv = rows.length ? (paid.length / rows.length * 100) : 0
      const _isTest = (n: string) => /test/i.test(n || '')
      const sumP = (a: any[]) => a.reduce((s: number, o: any) => s + (o.amount_paise || 0), 0) / 100

      // jsPDF's built-in Helvetica is Latin-1 and cannot draw ₹, so money here
      // is written with an ASCII tag: the familiar "Rs" for INR, the ISO code
      // for anything else. A report is read months later by someone who cannot
      // ask what unit it was in, so every figure states its own.
      const _cur = (o: any) => o.currency || 'INR'
      const _pdfMoney = (major: number, cur: string) => (cur === 'INR' ? 'Rs ' : cur + ' ') + major.toFixed(0)
      const _statsFor = (cur: string) => {
        const p = paid.filter((o: any) => _cur(o) === cur)
        const inCur = rows.filter((o: any) => _cur(o) === cur)
        const refDone = inCur.filter((o: any) => o.refund_state === 1)
        const refGenuine = refDone.filter((o: any) => !_isTest(o.refund_note))
        const refTest = refDone.filter((o: any) => _isTest(o.refund_note))
        const refFailed = inCur.filter((o: any) => o.refund_state === 2)
        const revenue = sumP(p)
        const refGenuineAmt = sumP(refGenuine)
        return { revenue, refGenuine, refGenuineAmt, refTest, refTestAmt: sumP(refTest), refFailed, refFailedAmt: sumP(refFailed), netRevenue: revenue - refGenuineAmt, avg: p.length ? revenue / p.length : 0 }
      }
      // Heaviest currency first. One currency - every export today - reproduces
      // the previous report line for line.
      const pdfCurs = Array.from(new Set(rows.map(_cur))).sort((a: any, b: any) => sumP(paid.filter((o: any) => _cur(o) === b)) - sumP(paid.filter((o: any) => _cur(o) === a)))
      const multiCur = pdfCurs.length > 1
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
      // Money lines repeat per currency and are never combined; the counts below
      // them are counts of orders and cups, which cross borders happily.
      const kpis: string[][] = []
      const _tag = (cur: string) => multiCur ? ' (' + cur + ')' : ''
      pdfCurs.forEach((cur: string) => {
        const s = _statsFor(cur)
        kpis.push(['Gross Revenue (paid)' + _tag(cur), _pdfMoney(s.revenue, cur)])
        kpis.push(['Less: Refunds (genuine)' + _tag(cur), '- ' + _pdfMoney(s.refGenuineAmt, cur) + '  (' + s.refGenuine.length + ' orders)'])
        kpis.push(['Net Revenue' + _tag(cur), _pdfMoney(s.netRevenue, cur)])
      })
      kpis.push(['Paid Orders', String(paid.length)], ['Orders Placed', String(rows.length)], ['Conversion', conv.toFixed(0) + '%'], ['Cups Served', String(cups)])
      pdfCurs.forEach((cur: string) => kpis.push(['Avg Order Value' + _tag(cur), _pdfMoney(_statsFor(cur).avg, cur)]))
      pdfCurs.forEach((cur: string) => {
        const s = _statsFor(cur)
        if (s.refTest.length > 0) kpis.push(['Test refunds (excl.)' + _tag(cur), _pdfMoney(s.refTestAmt, cur) + '  (' + s.refTest.length + ' orders)'])
        if (s.refFailed.length > 0) kpis.push(['FAILED refunds - owed' + _tag(cur), _pdfMoney(s.refFailedAmt, cur) + '  (' + s.refFailed.length + ' customers)'])
      })
      kpis.forEach(k => { doc.text(k[0] + ':', 16, y); doc.setFont('helvetica', 'bold'); doc.text(k[1], 80, y); doc.setFont('helvetica', 'normal'); y += 6 })
      y += 8
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(28, 35, 51)
      doc.text('By Machine', 14, y); y += 7
      doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text('Machine', 16, y); doc.text('Placed', 74, y); doc.text('Paid', 94, y); doc.text('Cups', 112, y); doc.text('Gross', 130, y); doc.text('Refunds', 152, y); doc.text('Net', 178, y); y += 5
      doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal')
      const byM: any = {}
      // A machine sits in one country, so its row has one currency: the row
      // labels itself and nothing is added across.
      rows.forEach((o: any) => { const id = o.machine_id; if (!byM[id]) byM[id] = { placed: 0, paid: 0, cups: 0, rev: 0, net: 0, cur: _cur(o) }; byM[id].placed++; if (o.pay_state === 1) { byM[id].paid++; byM[id].cups += (o.cup_num || 1); byM[id].rev += (o.amount_paise || 0) / 100; byM[id].net += netPaise(o) / 100 } })
      Object.keys(byM).forEach(id => { const m = getMachine(id); const r = byM[id]; const ref = r.rev - r.net; doc.text(String(m.display_name || id.slice(0, 8)).slice(0, 24), 16, y); doc.text(String(r.placed), 74, y); doc.text(String(r.paid), 94, y); doc.text(String(r.cups), 112, y); doc.text(_pdfMoney(r.rev, r.cur), 130, y); doc.text(ref > 0 ? '- ' + _pdfMoney(ref, r.cur) : '-', 152, y); doc.text(_pdfMoney(r.net, r.cur), 178, y); y += 5; if (y > 270) { doc.addPage(); y = 20 } })
      y += 8
      if (y > 250) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(28, 35, 51)
      doc.text('Daily Breakdown (paid)', 14, y); y += 7
      doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text('Date', 16, y); doc.text('Paid', 76, y); doc.text('Cups', 100, y); doc.text('Gross', 126, y); doc.text('Refunds', 150, y); doc.text('Net', 178, y); y += 5
      doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal')
      const byD: any = {}
      // A day can span countries, so a day is one line per currency rather than
      // one line hiding a sum. With a single currency the keys collapse back to
      // plain dates and the table is exactly as it was.
      paid.forEach((o: any) => { const day = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); const cur = _cur(o); const key = day + '|' + cur; if (!byD[key]) byD[key] = { day, cur, paid: 0, cups: 0, rev: 0, net: 0 }; byD[key].paid++; byD[key].cups += (o.cup_num || 1); byD[key].rev += (o.amount_paise || 0) / 100; byD[key].net += netPaise(o) / 100 })
      Object.keys(byD).sort().forEach(key => { const r = byD[key]; const ref = r.rev - r.net; doc.text(multiCur ? r.day + '  ' + r.cur : r.day, 16, y); doc.text(String(r.paid), 76, y); doc.text(String(r.cups), 100, y); doc.text(_pdfMoney(r.rev, r.cur), 126, y); doc.text(ref > 0 ? '- ' + _pdfMoney(ref, r.cur) : '-', 150, y); doc.text(_pdfMoney(r.net, r.cur), 178, y); y += 5; if (y > 280) { doc.addPage(); y = 20 } })

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
        const amt = _pdfMoney((o.amount_paise || 0) / 100, _cur(o))
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

  const card = { background: C.surface, border: '1px solid ' + C.border, borderRadius: 14 }
  const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }
  const dateInput = { padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: C.surface2, outline: 'none' }

  return (
    <div style={{ padding: isMobile ? '16px 14px' : '24px 28px' }}>
      {/* ── Title + tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 12, flexDirection: isMobile ? 'column' as const : 'row' as const, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Revenue &amp; Orders</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{orders.length} orders · {scopedMachines.length} machines</div>
        </div>
        <Seg options={[['analytics', '📊 Analytics'], ['orders', '📋 Orders']]} value={view} onChange={(v: any) => setView(v)} />
      </div>

      {/* ── Controls: machine picker + period ────────────────────── */}
      <div style={{ ...card, padding: isMobile ? '12px 14px' : '12px 16px', marginBottom: 12, display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' }}>
        <MachineCombobox machines={scopedMachines} value={machineSel} onChange={(id: string) => { setMachineSel(id); setShowAllMachines(false) }} wide={isMobile} />
        <Seg options={[['today', 'Today'], ['week', '7 Days'], ['month', '30 Days'], ['custom', 'Custom']]} value={period} onChange={(p: any) => setPeriod(p)} />
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...dateInput, fontSize: 12, padding: '5px 8px', borderRadius: 6 }} />
            <span style={{ fontSize: 11, color: C.text3 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...dateInput, fontSize: 12, padding: '5px 8px', borderRadius: 6 }} />
          </div>
        )}
        {view === 'analytics' && <div style={{ fontSize: 11, color: C.text3, marginLeft: isMobile ? 0 : 'auto' }}>Revenue is net of refunds · paid orders only</div>}
      </div>

      {/* ── Export bar ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-end', gap: 10, background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: isMobile ? '12px 14px' : '12px 16px', marginBottom: 18 }}>
        <div>
          <label style={labelStyle}>From</label>
          <input type="date" value={exFrom} onChange={e => setExFrom(e.target.value)} style={dateInput} />
        </div>
        <div>
          <label style={labelStyle}>To</label>
          <input type="date" value={exTo} onChange={e => setExTo(e.target.value)} style={dateInput} />
        </div>
        <button onClick={exportCSV} disabled={!!exporting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: exporting ? 0.6 : 1 }}>{exporting === 'csv' ? 'Exporting…' : '⬇ CSV (all rows)'}</button>
        <button onClick={exportPDF} disabled={!!exporting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: exporting ? 0.6 : 1 }}>{exporting === 'pdf' ? 'Building…' : '⬇ PDF (summary)'}</button>
        <div style={{ fontSize: 11, color: C.text3, marginLeft: isMobile ? 0 : 'auto', alignSelf: 'center' }}>Pulls fresh from database for the chosen dates</div>
      </div>

      {loadError && (
        <div style={{ padding: '14px 18px', background: C.redBg, borderRadius: 12, border: '1px solid ' + C.red, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.red, marginBottom: 4 }}>Couldn't load orders</div>
          <div style={{ fontSize: 12.5, color: C.text2 }}>{loadError}</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 6 }}>Figures on this page are incomplete. Reload before trusting any number.</div>
        </div>
      )}

      {view === 'analytics' ? (
        <div>
          {/* ── KPI strip ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 10 : 14, marginBottom: 18 }}>
            <StatCard label="Total Revenue" value={fmtBag(netBag)} sub={currenciesIn(refundBag).length > 0 ? periodLabel + ' · net of ' + fmtBag(refundBag) + ' refunds' : periodLabel} color={C.green} icon={currencySymbol(viewCur)} meter={grossRevenue > 0 ? (totalRevenue / grossRevenue) * 100 : 0} />
            <StatCard label="Paid Orders" value={paidOrders.length.toString()} sub={periodOrders.length + ' placed · ' + convRate.toFixed(0) + '% paid'} color={C.blue} icon="✅" meter={convRate} />
            <StatCard label="Avg Order Value" value={fmtBag(avgBag)} sub={mixedCurs ? 'per paid transaction, each currency' : 'per paid transaction'} color={C.orange} icon="📈" />
            <StatCard label="Cups Served" value={totalCups.toString()} sub={paidOrders.length > 0 ? (totalCups / paidOrders.length).toFixed(2) + ' cups per order' : 'juice cups'} color={C.amber} icon="🥤" />
          </div>

          {/* ── Daily revenue ──────────────────────────────────── */}
          <div style={{ ...card, padding: isMobile ? '16px 14px' : '20px 24px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' as const, gap: 8, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>Daily Revenue</div>
                <div style={{ fontSize: 12, color: C.text3 }}>Paid orders only · {dayCount === 1 ? 'today' : dayCount + ' days'}{mixedCurs ? ' · bars in ' + viewCur : ''}</div>
              </div>
              <div style={{ fontSize: 12, color: C.text3 }}>Peak day <b style={{ color: C.text2 }}>{fmtAmt(maxRev, viewCur)}</b></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: dense ? 2 : 8, height: 180, overflowX: 'auto' }}>
              {dailyData.map((d, i) => {
                const h = Math.max((d.revenue / maxRev) * 130, d.revenue > 0 ? 6 : 0)
                const showLabel = !dense || i % labelEvery === 0 || i === dailyData.length - 1
                return (
                  <div key={d.key} title={d.short + ' — ' + fmtBag(d.bag) + ' · ' + d.cups + ' cups'} style={{ flex: 1, minWidth: dense ? 6 : 18, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%' }}>
                    {!dense && d.revenue > 0 && (
                      <div style={{ textAlign: 'center' as const, lineHeight: 1.25 }}>
                        <div style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>{fmtAmt(d.revenue, viewCur)}</div>
                        {d.cups > 0 && <div style={{ fontSize: 10, color: C.orange, fontWeight: 700 }}>{d.cups}🥤</div>}
                      </div>
                    )}
                    <div style={{ width: '100%', height: h, background: d.revenue > 0 ? C.orange : C.border, borderRadius: dense ? '2px 2px 0 0' : '4px 4px 0 0', transition: 'height .4s' }} />
                    <div style={{ fontSize: dense ? 9 : 12, color: C.text3, textAlign: 'center' as const, fontWeight: 500, height: 14, whiteSpace: 'nowrap' as const }}>{showLabel ? (dense ? d.short.split(' ')[0] : d.day) : ''}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Revenue by machine / site ──────────────────────── */}
          <div style={{ ...card, padding: isMobile ? '16px 14px' : '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>Revenue by {mrMode === 'site' ? 'Site' : 'Machine'}</div>
                <div style={{ fontSize: 12, color: C.text3 }}>{concRows.length} {mrMode === 'site' ? 'sites' : 'machines'} · {periodLabel}{mixedCurs ? ' · ranked within ' + viewCur : ''}</div>
              </div>
              <Seg options={[['machine', 'By machine'], ['site', 'By site']]} value={mrMode} onChange={(m: any) => { setMrMode(m); setShowAllMachines(false) }} />
            </div>

            {/* Concentration callout — one machine carrying the fleet is the single
                most important fact on this page, so it is stated, not inferred. */}
            {totalRevenue > 0 && concRows.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 200, background: topShare >= 60 ? C.amberBg : C.surface2, border: '1px solid ' + (topShare >= 60 ? C.amber + '55' : C.border), borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Top {mrMode === 'site' ? 'site' : 'machine'}</div>
                  <div style={{ fontSize: 13.5, color: C.text }}>
                    <b>{topShare.toFixed(0)}%</b> of {mixedCurs ? viewCur + ' revenue' : 'all revenue'} — <span style={{ color: C.text2 }}>{concRows[0].display_name}</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Top 5 combined</div>
                  <div style={{ fontSize: 13.5, color: C.text }}><b>{top5Share.toFixed(0)}%</b> of {mixedCurs ? viewCur + ' revenue' : 'all revenue'}</div>
                </div>
              </div>
            )}

            <input value={mrQuery} onChange={e => setMrQuery(e.target.value)} placeholder={mrMode === 'site' ? 'Search sites…' : 'Search name, SN or site…'} style={{
              width: '100%', boxSizing: 'border-box' as const, padding: '8px 12px', borderRadius: 9,
              border: '1px solid ' + C.border, fontSize: 12.5, color: C.text, background: C.surface2, outline: 'none', marginBottom: 16,
            }} />

            {mrVisible.length === 0 ? (
              <div style={{ color: C.text3, fontSize: 13, padding: '12px 0' }}>{mrq ? 'Nothing matches "' + mrQuery + '"' : 'No revenue data for this period'}</div>
            ) : mrVisible.map((m: any, i: number) => {
              const rank = concRows.indexOf(m) + 1
              // A row's share is measured against its own currency's total, which
              // is well defined for any single-currency row even in a mixed fleet
              // ("40% of the ZAR revenue"). A site straddling currencies has no
              // single share to state, so it states none rather than a wrong one.
              const rowCur = soleCurrency(m.bag)
              const rowTotal = rowCur ? (netBag[rowCur] || 0) : 0
              const pct = rowTotal > 0 ? ((m.bag[rowCur!] || 0) / rowTotal * 100) : 0
              const shareLabel = !rowCur ? 'mixed currencies' : mixedCurs ? pct.toFixed(1) + '% of ' + rowCur : pct.toFixed(1) + '% of total'
              return (
                <div key={m.id} style={{ marginBottom: i < mrVisible.length - 1 ? 16 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        background: rank <= 3 ? C.orange : C.orangeBg, color: rank <= 3 ? '#fff' : C.orange,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800,
                      }}>{rank}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{m.display_name || m.sn || '—'}</div>
                        <div style={{ fontSize: 12, color: C.text3 }}>
                          {m.orders} orders · {m.cups} cups{mrMode === 'site' ? ' · ' + m.machines + ' machine' + (m.machines === 1 ? '' : 's') : (m.location ? ' · ' + m.location : '')}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                      <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: C.green }}>{fmtBag(m.bag)}</div>
                      <div style={{ fontSize: 12, color: C.text3 }}>{shareLabel}</div>
                    </div>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                    <div style={{ height: '100%', background: C.orange, borderRadius: 3, width: pct + '%', transition: 'width .6s' }} />
                  </div>
                </div>
              )
            })}

            {!mrq && mrFiltered.length > 8 && (
              <button onClick={() => setShowAllMachines(!showAllMachines)} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface2, color: C.text2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {showAllMachines ? 'Show top 8' : `Show all ${mrFiltered.length} ${mrMode === 'site' ? 'sites' : 'machines'}`}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* ── Order filters + search ─────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 16 }}>
            <Seg options={filterTabs} value={filter} onChange={(f: any) => setFilter(f)} />
            <input value={oQuery} onChange={e => setOQuery(e.target.value)} placeholder={hasTxnId ? 'Search order code, machine or txn id…' : 'Search order code or machine…'} style={{
              flex: 1, minWidth: isMobile ? '100%' : 240, boxSizing: 'border-box' as const,
              padding: '8px 12px', borderRadius: 9, border: '1px solid ' + C.border,
              fontSize: 12.5, color: C.text, background: C.surface, outline: 'none',
            }} />
          </div>

          {loadError ? null : loading ? (
            <div style={{ textAlign: 'center' as const, padding: 60, color: C.text3 }}>Loading orders...</div>
          ) : searched.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: 60, background: C.surface, borderRadius: 16, border: '1px solid ' + C.border }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No orders found</div>
              {oq && <div style={{ fontSize: 12.5, color: C.text3, marginTop: 6 }}>Nothing matches "{oQuery}"</div>}
            </div>
          ) : (
            <div style={{ background: C.surface, borderRadius: 16, border: '1px solid ' + C.border, overflow: 'hidden' }}>
              {isMobile ? (
                /* Mobile: one card per order */
                <div>
                  {pageRows.map((o: any) => {
                    const m = getMachine(o.machine_id)
                    const ps = PAY_STATE[o.pay_state] || PAY_STATE[0]
                    const ds = DEL_STATE[o.delivery_state] || DEL_STATE[0]
                    const rs = REFUND_STATE[o.refund_state] || REFUND_STATE[0]
                    return (
                      <div key={o.id} style={{ padding: '12px 14px', borderBottom: '1px solid ' + C.border }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.blue }}>{o.order_code}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 3 }}>{m.display_name || '--'}</div>
                            <div style={{ fontSize: 12, color: C.text3 }}>{m.location || ''}</div>
                          </div>
                          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: isRefundView && o.refund_state !== 1 ? C.red : C.green }}>{fmtAmt(o.amount_paise || 0, o.currency)}</div>
                            <div style={{ fontSize: 11.5, color: C.text3 }}>{o.cup_num || '--'} cups</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center', marginTop: 8 }}>
                          <Pill color={ps.color} bg={ps.bg}>{ps.label}</Pill>
                          {hasDelivery && <Pill color={ds.color} bg={ds.bg}>{ds.label}</Pill>}
                          {(o.refund_state || 0) >= 1 && <Pill color={rs.color} bg={rs.bg}>{rs.label}</Pill>}
                          <span style={{ fontSize: 11.5, color: C.text3, marginLeft: 'auto' }}>{fmtTime(o.created_at)}</span>
                        </div>
                        {isRefundView && o.refund_note && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 5 }}>{o.refund_note}</div>}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13, minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: C.surface2, borderBottom: '2px solid ' + C.border }}>
                      {(isRefundView
                        ? ['Order Code', 'Machine', 'Refunded', 'Status', 'Cups', 'Time']
                        : ['Order Code', 'Machine', 'Amount', 'Payment', ...(hasDelivery ? ['Delivery'] : []), 'Refund', 'Cups', 'Time']
                      ).map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left' as const, fontWeight: 700, color: C.text3, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((o: any, i: number) => {
                      const m = getMachine(o.machine_id)
                      const ps = PAY_STATE[o.pay_state] || PAY_STATE[0]
                      const ds = DEL_STATE[o.delivery_state] || DEL_STATE[0]
                      const rs = REFUND_STATE[o.refund_state] || REFUND_STATE[0]
                      return (
                        <tr key={o.id} style={{ borderBottom: '1px solid ' + C.border, background: i % 2 === 0 ? C.surface : C.surface2 }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.blue }}>{o.order_code}</div>
                            {hasTxnId && o.mihpayid && <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: C.text3, marginTop: 2 }}>{o.mihpayid}</div>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{m.display_name || '--'}</div>
                            <div style={{ fontSize: 12, color: C.text3, marginTop: 1 }}>{m.location || ''}</div>
                          </td>
                          {isRefundView ? (
                            <>
                              <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 700, color: o.refund_state === 1 ? C.green : C.red, fontSize: 14 }}>{fmtAmt(o.amount_paise || 0, o.currency)}</div></td>
                              <td style={{ padding: '12px 16px' }}>
                                <Pill color={rs.color} bg={rs.bg}>{rs.label}</Pill>
                                {o.refund_note && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{o.refund_note}</div>}
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 700, color: C.green, fontSize: 14 }}>{fmtAmt(o.amount_paise || 0, o.currency)}</div></td>
                              <td style={{ padding: '12px 16px' }}>
                                <Pill color={ps.color} bg={ps.bg}>{ps.label}</Pill>
                                {o.pay_type && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{o.pay_type.toUpperCase()}</div>}
                              </td>
                              {hasDelivery && <td style={{ padding: '12px 16px' }}><Pill color={ds.color} bg={ds.bg}>{ds.label}</Pill></td>}
                              <td style={{ padding: '12px 16px' }}>
                                {(o.refund_state || 0) >= 1 ? <Pill color={rs.color} bg={rs.bg}>{rs.label}</Pill> : <span style={{ color: C.text3 }}>—</span>}
                              </td>
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
              )}

              {/* ── Pagination ───────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' as const, padding: '10px 16px', borderTop: '1px solid ' + C.border, background: C.surface2 }}>
                <div style={{ fontSize: 11.5, color: C.text3 }}>
                  {pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, searched.length)} of {searched.length}{searched.length !== orders.length ? ' filtered · ' + orders.length + ' loaded' : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[['‹ Prev', pageSafe - 1, pageSafe === 0], ['Next ›', pageSafe + 1, pageSafe >= pageCount - 1]].map(([l, p, dis]: any) => (
                    <button key={l} onClick={() => setPage(p)} disabled={dis} style={{
                      padding: '5px 12px', borderRadius: 7, border: '1px solid ' + C.border,
                      background: dis ? C.surface2 : C.surface, color: dis ? C.text3 : C.text2,
                      fontSize: 12, fontWeight: 600, cursor: dis ? 'default' : 'pointer', opacity: dis ? 0.5 : 1,
                    }}>{l}</button>
                  ))}
                  <span style={{ fontSize: 11.5, color: C.text3, minWidth: 70, textAlign: 'center' as const }}>Page {pageSafe + 1} / {pageCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
