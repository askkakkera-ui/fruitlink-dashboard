'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import WarehouseSection from './WarehouseSection'
import NotifyConfigSection from './NotifyConfigSection'
import MyStaffSection from './MyStaffSection'
import ReportsSection from './ReportsSection'
import FieldStaffSection from './FieldStaffSection'
import AttendanceSection from './AttendanceSection'
import { C, SB_URL, SB_KEY, FL_LOGO, getCookie, useIsMobile, Dot, Badge, Pill, SectionLabel, StatCard, MachineCard, sbFetchAll, isTestRefund, netPaise, ErrorBoundary } from './lib/dashboard-shared'
import { Sidebar, TopBar } from './DashboardNav'


// ─── Stat Card ───────────────────────────────────────────────────

// ─── Console Insights: live sales, scale runway, peak hours, smart restock ───
function ConsoleInsights({ machines, lackingCard, machineSel, setMachineSel, stockData }: any) {
  const isMobile = useIsMobile()
  const IND = '#423A8E', INDBG = '#efeefc'
  const visible = (machines || []).filter((m: any) => m && m.sn)
  const machine = (machineSel && machineSel !== 'all'
    ? visible.find((m: any) => m.id === machineSel)
    : (() => {
        // When "All machines": pick the online machine with lowest stock (most urgent)
        const onlineWithStock = visible.filter((m: any) => m.status === 'online' && (stockData || []).find((s: any) => s.machine_id === m.id && s.stock_known))
        if (onlineWithStock.length > 0) {
          return onlineWithStock.sort((a: any, b: any) => {
            const sa = (stockData || []).find((s: any) => s.machine_id === a.id)
            const sb = (stockData || []).find((s: any) => s.machine_id === b.id)
            return (sa?.stock_pct ?? 999) - (sb?.stock_pct ?? 999)
          })[0]
        }
        return visible.find((m: any) => m.status === 'online') || visible[0]
      })()) || visible[0] || null
  // Per-machine fruit/stock tuning from Settings → Fruit & Stock (falls back to defaults)
  const tuning = (() => {
    try {
      const st = typeof machine?.state === 'string' ? JSON.parse(machine.state || '{}') : (machine?.state || {})
      return (st.machine_config && st.machine_config.stock_tuning) || {}
    } catch { return {} }
  })()
  const BOX_KG = Number(tuning.box_kg) > 0 ? Number(tuning.box_kg) : 15
  const COUNT = Number(tuning.count) > 0 ? Number(tuning.count) : 100
  // Oranges per cup is NOT a setting - it follows the fruit size. Sri loads
  // 80, 88, 100, 105 as supply dictates; the count is what changes, and the
  // ratio must follow it. When these were two independent fields, F5 sat at
  // count 100 with 4/cup for who knows how long, and the all-machines view
  // borrowed that 4 for the whole fleet.
  //
  // The rule: 80 or 88 (bigger fruit) take 4 per 250 ml cup, anything smaller
  // takes 5. This is a planning assumption, not a physical claim - the machine
  // juices to a 250 ml target and the funnel carries any excess to the next cup.
  // Better yield than assumed just means more cups out of the same load.
  const OPC = COUNT <= 88 ? 4 : 5
  const CAP = Number(tuning.capacity) > 0 ? Number(tuning.capacity) : 310
  const GPO = Math.round((BOX_KG * 1000) / COUNT)
  const TARE = Number.isFinite(Number(tuning.tare_g)) ? Number(tuning.tare_g) : 235
  const SL = Number(tuning.service_level) > 0 ? Number(tuning.service_level) : 90
  const Z = SL >= 95 ? 1.6449 : SL >= 90 ? 1.2816 : SL >= 85 ? 1.0364 : 0.8416
  const OPEN = Number.isFinite(Number(tuning.open_hour)) ? Number(tuning.open_hour) : 9
  const CLOSE = Number.isFinite(Number(tuning.close_hour)) ? Number(tuning.close_hour) : 22

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    if (!machine) { setLoading(false); return }
    let alive = true
    setLoading(true)
    const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    const since = new Date(Date.now() - 35 * 86400000).toISOString()
    const run = async () => {
      // Resolve the real machines-table id by SN (same id the orders table uses)
      let mid = machine.id
      try {
        const row = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id&sn=eq.' + machine.sn), { headers: h }).then(r => r.json())
        if (Array.isArray(row) && row[0] && row[0].id) mid = row[0].id
      } catch {}
      try {
        const machineFilter = machineSel === 'all' ? '' : '&machine_id=eq.' + mid
        // No limit= : PostgREST caps at db-max-rows and returns 200, so a limit
        // above the cap is a request, not a promise. F4 alone did 632 paid orders
        // in 16 days - this 35-day window crosses 1,000 within a month, and the
        // chart would then under-report silently, exactly as the Console did.
        const path = '/rest/v1/orders?select=created_at,amount_paise,cup_num,pay_state,refund_state,refund_note&pay_state=eq.1&created_at=gte.' + since + machineFilter + '&order=created_at.desc'
        const d = await sbFetchAll(path, h)
        if (alive) { setOrders(d); setLoading(false) }
      } catch (e: any) {
        // Was: silently setOrders([]) - an empty chart reads as a quiet month.
        if (alive) { setLoadError(e?.message || 'fetch failed'); setOrders([]); setLoading(false) }
      }
    }
    run()
    return () => { alive = false }
  }, [machine && machine.sn])

  const IST = 'Asia/Kolkata'
  const dKey = (t: any) => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date(t))
  const dHour = (t: any) => parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', hourCycle: 'h23' }).format(new Date(t)), 10)
  const wdayOfKey = (k: string) => new Date(k + 'T12:00:00+05:30').getDay()
  const fmt = (rs: number) => '₹' + Math.round(rs).toLocaleString('en-IN')
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
  const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)) }
  const wmean = (a: number[]) => { let n = 0, d = 0; a.forEach((x, i) => { const w = i + 1; n += x * w; d += w }); return d ? n / d : 0 }
  const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

  const now = new Date()
  const todayKey = dKey(now)
  const nowHour = dHour(now) + (parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: IST, minute: '2-digit' }).format(now), 10) || 0) / 60

  const dailyCups: Record<string, number> = {}, dailyRev: Record<string, number> = {}
  orders.forEach(o => { const k = dKey(o.created_at); dailyCups[k] = (dailyCups[k] || 0) + (o.cup_num || 1); dailyRev[k] = (dailyRev[k] || 0) + netPaise(o) / 100 })

  const week = Array.from({ length: 7 }, (_, i) => {
    const k = dKey(new Date(now.getTime() - (6 - i) * 86400000))
    return { key: k, day: new Date(k + 'T12:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'short' }), v: dailyRev[k] || 0, c: dailyCups[k] || 0, today: k === todayKey }
  })

  const sevenAgo = new Date(now.getTime() - 7 * 86400000)
  const hourAgg: Record<number, number> = {}
  orders.forEach(o => { const t = new Date(o.created_at); if (t >= sevenAgo) { const hh = dHour(o.created_at); hourAgg[hh] = (hourAgg[hh] || 0) + (o.cup_num || 1) } })
  const hoursList = Array.from({ length: CLOSE - OPEN }, (_, i) => OPEN + i)
  const hVals = hoursList.map(h => hourAgg[h] || 0)
  const hTotal = hVals.reduce((s, x) => s + x, 0)
  let best = { s: -1, i: 0 }
  for (let i = 0; i <= hVals.length - 3; i++) { const s = hVals[i] + hVals[i + 1] + hVals[i + 2]; if (s > best.s) best = { s, i } }
  const peakStart = hoursList[best.i], peakEnd = hoursList[Math.min(best.i + 3, hoursList.length - 1)]
  const peakPct = hTotal > 0 ? Math.round(best.s / hTotal * 100) : 0
  const hLabel = (h: number) => h === OPEN ? h + 'a' : h === 12 ? '12p' : h === CLOSE - 1 ? (h - 12) + 'p' : h > 12 ? (h - 12) + '' : h + ''
  const ampm = (h: number) => { const x = h % 12 === 0 ? 12 : h % 12; return x + (h >= 12 ? ' PM' : ' AM') }

  const overallAvg = () => { const ks = Object.keys(dailyCups).filter(k => k !== todayKey); return ks.length ? ks.reduce((s, k) => s + dailyCups[k], 0) / ks.length : 0 }
  const forecastFor = (wday: number) => {
    const keys = Object.keys(dailyCups).filter(k => k !== todayKey && wdayOfKey(k) === wday).sort()
    const s = keys.slice(-4).map(k => dailyCups[k])
    let mu: number, sigma: number, conf: string
    if (s.length >= 1) { mu = wmean(s); sigma = s.length >= 2 ? sd(s) : mu * 0.15; conf = s.length >= 4 ? 'High conf.' : s.length >= 2 ? 'Building' : 'Low data' }
    else { mu = overallAvg(); sigma = mu * 0.2; conf = 'Low data' }
    const ss = Z * sigma
    return { mu, ss, oranges: Math.ceil((mu + ss) * OPC), conf }
  }

  const cupsToday = dailyCups[todayKey] || 0
  const revToday = dailyRev[todayKey] || 0
  const sw = Number(machine && machine.scale_weight_g)
  const haveScale = Number.isFinite(sw) && sw > TARE
  // Fallback: use IR stock sensors (L1/L2/L3) when scale is unavailable or un-tared
  const stockLayers = [machine?.stock_l1, machine?.stock_l2, machine?.stock_l3].filter(v => v === true).length
  const haveStockSensors = machine && (machine.stock_l1 !== undefined || machine.stock_l2 !== undefined || machine.stock_l3 !== undefined)
  // Fall back to visit-based stock data for NewSaier machines (no hardware scale)
  const visitStock = (stockData || []).find((s: any) => s.machine_id === machine?.id)
  // The API returns needs_recount when its rolling balance has gone negative -
  // loaded minus consumed since the first-ever visit, which drifts because opc
  // is the machine's CONFIGURED fruit size, not what is actually loaded. F4 sat
  // at balance -349 on 16 Jul while physically holding 170 oranges, and the
  // panel read "0 left" and told the operator to send someone to top up a
  // half-full machine.
  //
  // A known-wrong number must not drive an instruction. When the model has
  // drifted, we do not know the stock: leftOranges is null, runReady goes false,
  // and the runway says so instead of guessing.
  const stockDrifted = visitStock?.needs_recount === true
  const leftOranges = stockDrifted
    ? null
    : visitStock?.stock_known
      ? visitStock.remaining_oranges ?? Math.round((visitStock.cups_remaining || 0) * OPC)
      : haveScale
        ? Math.max(0, Math.round((sw - TARE) / GPO))
        : null
  const usedToday = cupsToday * OPC
  const sellThrough = leftOranges != null && (usedToday + leftOranges) > 0 ? Math.round(usedToday / (usedToday + leftOranges) * 100) : null

  const todayWday = wdayOfKey(todayKey)
  const fcToday = forecastFor(todayWday)
  const cumToNow = hoursList.filter(h => h <= Math.floor(nowHour)).reduce((s, h) => s + (hourAgg[h] || 0), 0)
  const elapsedFrac = hTotal > 0 ? cumToNow / hTotal : clamp((nowHour - OPEN) / (CLOSE - OPEN), 0.05, 1)
  const expectedByNow = fcToday.mu * elapsedFrac
  const paceDelta = expectedByNow > 0.5 ? Math.round((cupsToday / expectedByNow - 1) * 100) : null
  const wdayName = new Date(todayKey + 'T12:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'long' })

  const hoursOpen = Math.max(0.4, nowHour - OPEN)
  const cph = cupsToday / hoursOpen
  const oph = cph * OPC
  const runHrs = leftOranges != null && oph > 0 ? leftOranges / oph : null
  const sellAt = runHrs != null ? nowHour + runHrs : null
  const runReady = leftOranges != null && cupsToday > 0 && nowHour > OPEN + 0.3

  const tomKey = dKey(new Date(now.getTime() + 86400000))
  const tomWday = wdayOfKey(tomKey)
  const fcTom = forecastFor(tomWday)
  const tomName = new Date(tomKey + 'T12:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'long' })
  const restCups = Math.max(0, fcToday.mu - cupsToday)
  const projEndLeftover = leftOranges != null ? Math.max(0, Math.round(leftOranges - restCups * OPC)) : null
  // Never ask for more than the machine physically holds. F3/4/5 take 300-310
  // oranges (60-62 racks), F1/F2 400-500. Before this, the plan asked for
  // whatever the forecast wanted - 489 into a 310 machine on 16 Jul. Capacity is
  // a property of the machine, not the fruit: same either way for 88s or 100s.
  const wantOranges = projEndLeftover != null ? Math.max(0, fcTom.oranges - projEndLeftover) : fcTom.oranges
  const roomLeft = Math.max(0, CAP - (projEndLeftover || 0))
  const bring = Math.min(wantOranges, roomLeft)
  const shortBy = Math.max(0, wantOranges - bring)
  const loadedEst = leftOranges != null ? Math.round(leftOranges + cupsToday * OPC) : null

  const card: any = { background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, overflow: 'hidden' }
  const sectit: any = { fontSize: 15, fontWeight: 800, color: C.text, margin: '22px 0 12px', display: 'flex', alignItems: 'center', gap: 8 }
  const lbl: any = { fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: C.text2, display: 'flex', alignItems: 'center', gap: 8 }
  const pos = (t: number) => clamp((t - OPEN) / (CLOSE - OPEN) * 100, 0, 100)
  const runCol = sellAt == null ? C.green : sellAt < peakStart ? C.red : sellAt < peakEnd ? C.amber : C.green
  const maxV = Math.max(...week.map(d => d.v), 1)
  const maxH = Math.max(...hVals, 1)

  if (!machine) return <div style={{ marginBottom: 22 }}><StatCard {...lackingCard} /></div>

  const tStr = sellAt != null ? ampm(Math.floor(sellAt)).replace(/ (AM|PM)/, ':' + String(Math.round((sellAt - Math.floor(sellAt)) * 60)).padStart(2, '0') + ' $1') : ''

  if (loadError) return (
    <div style={{ textAlign: 'center', padding: 40, background: C.redBg, borderRadius: 16, border: '1px solid ' + C.red, marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.red, marginBottom: 6 }}>Couldn't load orders</div>
      <div style={{ fontSize: 13, color: C.text2 }}>{loadError}</div>
      <div style={{ fontSize: 12, color: C.text3, marginTop: 8 }}>Sales, runway and restock figures below are incomplete. Reload before trusting any number.</div>
    </div>
  )
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 14, marginBottom: 14 }}>
        <StatCard {...lackingCard} />
        <div style={card}>
          <div style={{ height: 3, background: 'linear-gradient(90deg,' + C.orange + ',' + IND + ')' }} />
          <div style={{ padding: '18px 22px' }}>
            <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: '215px 1fr', gap: 22 }}>
              <div style={{ marginBottom: isMobile ? 16 : 0 }}>
                <div style={{ ...lbl, marginBottom: 14, justifyContent: 'space-between' }}>
                  <span>Today's Sales</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', color: C.green, background: C.greenBg, border: '1px solid rgba(25,135,84,.25)', borderRadius: 20, padding: '2px 8px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'fl-pulse 1.8s infinite' }} />LIVE</span>
                </div>
                <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>{fmt(revToday)}</div>
                {paceDelta != null && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '3px 10px', marginTop: 10, background: paceDelta >= 0 ? C.greenBg : C.redBg, color: paceDelta >= 0 ? C.green : C.red }}>{(paceDelta >= 0 ? '▲ ' : '▼ ') + Math.abs(paceDelta) + '% vs a typical ' + wdayName}</div>
                )}
                <div style={{ display: 'flex', gap: 16, marginTop: 18 }}>
                  <div><div style={{ fontSize: 17, fontWeight: 800 }}>{cupsToday}</div><div style={{ fontSize: 10.5, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>Cups</div></div>
                  <div><div style={{ fontSize: 17, fontWeight: 800 }}>{cupsToday > 0 ? fmt(revToday / cupsToday) : '—'}</div><div style={{ fontSize: 10.5, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>Avg</div></div>
                  <div><div style={{ fontSize: 17, fontWeight: 800 }}>{sellThrough != null ? sellThrough + '%' : '—'}</div><div style={{ fontSize: 10.5, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>Sell-through</div></div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: C.text3, marginBottom: 12 }}>{machineSel === 'all' ? 'All machines' : machine.display_name} · revenue, last 7 days</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, minHeight: 104 }}>
                  {week.map((d, i) => {
                    const h = Math.max(Math.round(d.v / maxV * 88), d.v > 0 ? 6 : 3)
                    return <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text2 }}>{d.v > 0 ? '₹' + (d.v / 1000).toFixed(1) + 'k' : ''}</div>
                      <div style={{ width: '100%', height: h, borderRadius: '5px 5px 0 0', background: d.today ? C.orange : '#d9d6f0', transition: 'height .5s' }} />
                      <div style={{ fontSize: 10.5, fontWeight: d.today ? 800 : 600, color: d.today ? C.orange : C.text3 }}>{d.day}</div>
                    </div>
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Runway and restock are per-machine physics. The fleet has no single
          answer: F2/F3 load 88s at 4 oranges per cup, F1/F4/F5 load 100s at 5;
          F1/F2 hold 500 oranges, F3/4/5 hold 310. This view used to pick ONE
          machine (lowest stock) and apply its tuning to fleet-wide sales - on
          16 Jul it borrowed F5's ratio, the only mis-tuned one, for everything. */}
      {machineSel === 'all' ? (<>
        <div style={sectit}>⛽ Stock runway &amp; restock</div>
        <div style={{ ...card, padding: '28px 22px', textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text2 }}>Pick a machine to see runway and restock</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 8, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
            Each machine has its own fruit size and capacity — F1 and F2 hold about 500 oranges, F3/F4/F5 about 310, and size 88 takes 4 oranges per cup where 100 takes 5. There is no fleet-wide figure to show. Sales and revenue above are fleet-wide and correct.
          </div>
        </div>
      </>) : (<>
      <div style={sectit}>⛽ Stock runway — today</div>
      <div style={card}>
        <div style={{ height: 3, background: runReady ? runCol : C.border2 }} />
        <div style={{ padding: '18px 22px' }}>
          {!haveScale && !haveStockSensors ? (
            <div style={{ fontSize: 13, color: C.text3 }}>Waiting for a live stock reading from {machine.display_name} to project the runway.</div>
          ) : (<>
            <div style={{ position: 'relative', height: 46, borderRadius: 10, background: '#f1f2f7', border: '1px solid ' + C.border, overflow: 'hidden', margin: '6px 0 4px' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pos(nowHour) + '%', background: 'rgba(25,135,84,.16)' }} />
              {hTotal > 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(peakStart) + '%', width: (pos(peakEnd) - pos(peakStart)) + '%', background: 'repeating-linear-gradient(45deg,rgba(254,101,5,.13),rgba(254,101,5,.13) 6px,rgba(254,101,5,.05) 6px,rgba(254,101,5,.05) 12px)', borderLeft: '1px dashed rgba(254,101,5,.5)', borderRight: '1px dashed rgba(254,101,5,.5)' }} />}
              {sellAt != null && sellAt < CLOSE && <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(nowHour) + '%', width: (pos(Math.min(sellAt, CLOSE)) - pos(nowHour)) + '%', background: runCol, opacity: .9 }} />}
              <div style={{ position: 'absolute', top: -3, bottom: -3, left: pos(nowHour) + '%', width: 2, background: C.text }} />
              {sellAt != null && sellAt < CLOSE && <div style={{ position: 'absolute', top: -3, bottom: -3, left: pos(sellAt) + '%', width: 2, background: runCol }} />}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.text3, fontWeight: 600, marginTop: 4 }}>
              {['9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '10 PM'].map(x => <span key={x}>{x}</span>)}
            </div>
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 8, fontWeight: 600 }}>{leftOranges} oranges left · ~{Math.round(leftOranges / OPC)} cups</div>
            <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5, marginTop: 6 }}>
              {stockDrifted ? <><b style={{ color: C.amber }}>Stock count has drifted {Math.abs(visitStock?.balance ?? 0)} oranges</b> — more cups have been sold than the logged loads can account for, so the machine's stock is unknown. Count the racks and log a calibration visit to re-anchor it. (5 oranges per rack.)</>
              : !runReady ? 'Too early in the day to project a reliable runway — check back after a few sales.'
                : sellAt >= CLOSE ? <>At the current pace (<b>{cph.toFixed(1)} cups/hr</b>), the <b>{leftOranges} oranges</b> left last past closing. <b style={{ color: C.green }}>No refill needed today</b> ✓</>
                  : sellAt < peakStart ? <>At the current pace, stock runs dry near <b style={{ color: C.red }}>{tStr}</b> — <b style={{ color: C.red }}>before the {ampm(peakStart)} peak</b>. Send the boys to top up <b>now</b> ⚠</>
                    : sellAt < peakEnd ? <>At the current pace, stock sells out near <b style={{ color: C.amber }}>{tStr}</b>, <b style={{ color: C.amber }}>mid-peak</b>. Top up before {ampm(peakStart)}.</>
                      : <>At the current pace (<b>{cph.toFixed(1)} cups/hr</b>), stock lasts to ≈ <b>{tStr}</b>. <b style={{ color: C.green }}>Covers tonight's peak</b> ✓</>}
            </div>
          </>)}
        </div>
      </div>

      <div style={sectit}>📈 Sales insights &amp; restock plan</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 1fr', gap: 14, marginBottom: 22 }}>
        <div style={card}>
          <div style={{ height: 3, background: C.orange }} />
          <div style={{ padding: '18px 22px' }}>
            <div style={{ ...lbl, marginBottom: 16 }}>Peak selling hours <span style={{ fontWeight: 600, color: C.text3, textTransform: 'none', letterSpacing: 0 }}>· last 7 days</span></div>
            {hTotal === 0 ? <div style={{ fontSize: 13, color: C.text3, padding: '20px 0' }}>No sales in the last 7 days yet — peak hours appear once orders come in.</div> : <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130, marginBottom: 6 }}>
                {hoursList.map((h, idx) => {
                  const inP = idx >= best.i && idx < best.i + 3
                  const ht = Math.max(Math.round((hourAgg[h] || 0) / maxH * 112), 4)
                  return <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%' }}>
                    <div style={{ width: '100%', height: ht, borderRadius: '4px 4px 0 0', background: inP ? C.orange : '#e3e1ee' }} />
                    <div style={{ fontSize: 9, fontWeight: inP ? 800 : 600, color: inP ? C.orange : C.text3 }}>{hLabel(h)}</div>
                  </div>
                })}
              </div>
              <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.55 }}>Busiest window: <b style={{ color: C.orange, fontWeight: 800 }}>{ampm(peakStart)}–{ampm(peakEnd)}</b> — about <b style={{ color: C.orange, fontWeight: 800 }}>{peakPct}%</b> of the day's cups. Keep the machine full before <b style={{ color: C.orange, fontWeight: 800 }}>{ampm(peakStart)}</b>.</div>
            </>}
          </div>
        </div>

        <div style={card}>
          <div style={{ height: 3, background: 'linear-gradient(90deg,' + C.orange + ',' + IND + ')' }} />
          <div style={{ padding: '18px 22px' }}>
            <div style={{ ...lbl, marginBottom: 14 }}>Smart restock plan</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ borderRadius: 12, padding: '13px 15px', border: '1px solid rgba(254,101,5,.28)', background: C.orangeBg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: C.orange }}>Today's load · {new Date(todayKey + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                  <div><div style={{ fontSize: 18, fontWeight: 800 }}>{loadedEst != null ? loadedEst : '—'}</div><div style={{ fontSize: 10, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 1 }}>Loaded (est.)</div></div>
                  <div><div style={{ fontSize: 18, fontWeight: 800 }}>{cupsToday}</div><div style={{ fontSize: 10, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 1 }}>Cups sold</div></div>
                  <div><div style={{ fontSize: 18, fontWeight: 800 }}>{leftOranges != null ? leftOranges : '—'}</div><div style={{ fontSize: 10, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 1 }}>Oranges left</div></div>
                </div>
              </div>
              <div style={{ borderRadius: 12, padding: '13px 15px', border: '1px solid rgba(66,58,142,.22)', background: INDBG }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: IND }}>Tomorrow am · {tomName}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', background: fcTom.conf === 'High conf.' ? C.greenBg : C.amberBg, color: fcTom.conf === 'High conf.' ? C.green : C.amber }}>{fcTom.conf}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '9px 0 3px' }}>
                  <span style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>{bring > 0 ? '~' + bring : '0'}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text2 }}>{bring > 0 ? 'oranges to bring' : 'enough rolls over — skip'}</span>
                </div>
                <div style={{ fontSize: 12, color: C.text2 }}>Forecast {Math.round(fcTom.mu)} cups (±{Math.round(fcTom.ss)}) = {fcTom.oranges} needed · ~{projEndLeftover != null ? projEndLeftover : 0} rolling over</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 5 }}>{shortBy > 0 ? <>Machine holds {CAP} — <b style={{ color: C.amber }}>{shortBy} short of forecast</b>, expect it to run dry before close. Top up if you can.</> : <>= {fcTom.oranges} target − {projEndLeftover != null ? projEndLeftover : 0} carryover (final on tomorrow's scale)</>}</div>
                {projEndLeftover != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, borderRadius: 8, padding: '6px 9px', marginTop: 9, fontWeight: 600, background: projEndLeftover > 120 ? C.amberBg : C.greenBg, color: projEndLeftover > 120 ? C.amber : C.green }}>
                    🍊 {projEndLeftover > 120 ? 'Heavy rollover — rotate older fruit to the front first.' : 'Freshness OK — light rollover, well inside the 3–4 day window.'}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.5 }}>Forecast = recency-weighted same-weekday demand · safety stock = Z({SL}%)×variability · {OPC} oranges/cup · {GPO} g/orange (count {COUNT}). Tunable in Settings → Fruit &amp; Stock.</div>
            </div>
          </div>
        </div>
      </div>
      </>)}
    </>
  )
}

// ─── Console Page ────────────────────────────────────────────────
function ConsolePage({ machines, alerts, loading }: any) {
const [stockData, setStockData] = useState<any[]>([])
  const [fleetOpen, setFleetOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  useEffect(() => { fetch('/api/stock').then(r=>r.json()).then(d=>setStockData(Array.isArray(d)?d:[])).catch(()=>{}) }, [])
  const [machineSel, setMachineSel] = useState('all')
  const scopedStock = stockData.filter((s: any) => machines.some((m: any) => m.id === s.machine_id))
  const scopedMachines = machineSel === 'all' ? machines : machines.filter((m: any) => m.id === machineSel)
  const online = scopedMachines.filter((m: any) => m.status === 'online').length
  const activeAlerts = alerts.filter((a: any) => !a.resolved_at)
  const scopedAlerts = machineSel === 'all' ? activeAlerts : activeAlerts.filter((a: any) => a.machine_id === machineSel)
  const critical = scopedAlerts.filter((a: any) => a.severity === 'CRITICAL').length
  const high = scopedAlerts.filter((a: any) => a.severity === 'HIGH').length
  const lacking = scopedMachines.filter((m: any) => m.status === 'online' && (!m.stock_l1 || !m.stock_l2 || !m.stock_l3)).length

const stats = [
    { label: machineSel === 'all' ? 'All Equipment' : 'Machine', value: scopedMachines.length.toString(), sub: `${online} online · ${scopedMachines.length - online} offline`, color: C.blue, icon: '🖥', pct: scopedMachines.length > 0 ? (online / scopedMachines.length) * 100 : 0 },
    { label: 'Online Equipment', value: online.toString(), sub: online > 0 ? scopedMachines.find((m: any) => m.status === 'online')?.display_name || '' : 'None online', color: C.green, icon: '📡', pct: scopedMachines.length > 0 ? (online / scopedMachines.length) * 100 : 0 },
    { label: 'Active Alerts', value: scopedAlerts.length.toString(), sub: `${critical} critical · ${high} high`, color: scopedAlerts.length > 0 ? C.red : C.green, icon: '🔔', pct: Math.min(scopedAlerts.length * 10, 100) },
    { label: 'Lacking Materials', value: lacking.toString(), sub: lacking > 0 ? 'Restock needed' : 'All stocked', color: lacking > 0 ? C.orange : C.green, icon: '📦', pct: scopedMachines.length > 0 ? (lacking / scopedMachines.length) * 100 : 0 },
  ]

  const SEVERITY_COLOR: any = { CRITICAL: C.red, HIGH: C.amber, MEDIUM: C.blue, LOW: C.green }
  const SEVERITY_BG: any = { CRITICAL: C.redBg, HIGH: C.amberBg, MEDIUM: C.blueBg, LOW: C.greenBg }
  const ALERT_LABELS: any = {
    machine_offline: 'Machine Offline', temperature_high: 'High Temperature', temperature_low: 'Low Temperature',
    stock_empty_l1: 'Layer 1 Empty', stock_empty_l2: 'Layer 2 Empty', stock_empty_l3: 'Layer 3 Empty',
    stock_low_l1: 'Layer 1 Low', stock_low_l2: 'Layer 2 Low', stock_low_l3: 'Layer 3 Low',
    door_open: 'Door Open', vend_failure: 'Vend Failure', cup_empty: 'Cups Empty',
    film_empty: 'Film Empty', temperature_stop: 'Temp Stop', cooling_off: 'Cooling Off',
  }
  const getMachine = (id: string) => machines.find((m: any) => (m.machine_id || m.id) === id) || {} as any
  const fmtAgo = (t: string) => {
    const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000)
    if (m < 60) return `${m}m ago`
    if (m < 1440) return `${Math.floor(m / 60)}h ago`
    return `${Math.floor(m / 1440)}d ago`
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Machine Picker */}
      {machines.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '12px 18px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text2, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Viewing</span>
          <select value={machineSel} onChange={e => setMachineSel(e.target.value)}
            style={{ fontSize: 14, fontWeight: 700, border: '2px solid ' + (machineSel !== 'all' ? C.orange : C.border), borderRadius: 10, padding: '6px 14px', color: machineSel !== 'all' ? C.orange : C.text, background: C.surface, cursor: 'pointer', outline: 'none' }}>
            <option value="all">All machines</option>
            {machines.filter((m: any) => m && m.id).map((m: any) => (
              <option key={m.id} value={m.id}>{m.display_name || m.sn}{m.location ? ' — ' + m.location : ''}</option>
            ))}
          </select>
          {machineSel !== 'all' && (
            <span style={{ fontSize: 12, color: C.text3, cursor: 'pointer' }} onClick={() => setMachineSel('all')}>✕ Clear</span>
          )}
        </div>
      )}
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
        {stats.slice(0, 3).map(s => <StatCard key={s.label} {...s} />)}
      </div>
      <ConsoleInsights machines={machines} lackingCard={stats[3]} machineSel={machineSel} setMachineSel={setMachineSel} stockData={scopedStock} />

{/* Machine Cards */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: fleetOpen ? 14 : 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Fleet Overview</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Dot color={C.orange} pulse size={6} />
          <span style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Synced · every 2 min</span>
          <button onClick={() => setFleetOpen(v => !v)} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: fleetOpen ? C.orangeBg : C.surface, color: fleetOpen ? C.orange : C.text, cursor: 'pointer' }}>
            {fleetOpen ? '▲ Hide' : '▼ Show'}
          </button>
        </div>
      </div>
      {fleetOpen && (loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading fleet data...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: machineSel === 'all' ? 'repeat(2,1fr)' : '1fr', gap: 16, marginBottom: 22 }}>
          {scopedMachines.map((m: any) => <MachineCard key={m.id} machine={m} stock={scopedStock.find((s: any) => s.machine_id === m.id)} />)}
        </div>
      ))}

      {/* Recent Alerts */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: alertsOpen ? `1px solid ${C.border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Recent Alerts {scopedAlerts.length > 0 && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: C.red, background: C.redBg, padding: '1px 7px', borderRadius: 10 }}>{scopedAlerts.length}</span>}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Dot color={C.orange} pulse size={6} />
            <span style={{ fontSize: 11, color: C.text3 }}>Live feed</span>
            <button onClick={() => setAlertsOpen(v => !v)} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: alertsOpen ? C.redBg : C.surface, color: alertsOpen ? C.red : C.text, cursor: 'pointer' }}>
              {alertsOpen ? '▲ Hide' : '▼ Show'}
            </button>
          </div>
        </div>
        {alertsOpen && (scopedAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>All clear — no active alerts</div>
          </div>
        ) : scopedAlerts.slice(0, 5).map((a: any, i: number) => {
          const m = getMachine(a.machine_id)
          return (
            <div key={a.id} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr auto',
              gap: 16, padding: '14px 20px', alignItems: 'center',
              borderBottom: i < Math.min(activeAlerts.length, 5) - 1 ? `1px solid ${C.border}` : 'none',
              background: i % 2 === 0 ? C.surface : C.surface2,
            }}>
              <Pill color={SEVERITY_COLOR[a.severity] || C.text2} bg={SEVERITY_BG[a.severity] || C.surface2}>
                {a.severity}
              </Pill>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                  {ALERT_LABELS[a.alert_type] || a.alert_type} — {m.display_name || '—'}
                </div>
                <div style={{ fontSize: 11, color: C.text2 }}>{a.message}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: C.text3 }}>{fmtAgo(a.created_at)}</div>
                <div style={{ marginTop: 4 }}>
                  <Pill color={C.red} bg={C.redBg}>Active</Pill>
                </div>
              </div>
            </div>
          )
       }))}
      </div>
    </div>
  )
}

// ─── Alerts Page ─────────────────────────────────────────────────
function AlertsPage({ machines, alerts, loading, fetchAlerts }: any) {
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

// ─── Coming Soon ─────────────────────────────────────────────────
function OrdersPage() {
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


// ─── Machine Grouped List ────────────────────────────────────────
function MachineRow({ m, expandedId, setExpandedId, stockData, canEdit, openEdit, fmtTime, getCoords, sendCommand, cmdMenu, setCmdMenu, cmdSending }: any) {
  const online = m.status === 'online'
  const isExpanded = expandedId === m.id
  const temp = m.inner_temp_c
  const tempColor = temp == null ? C.text3 : temp > 18 ? C.red : temp > 12 ? C.amber : temp < 3 ? C.blue : C.green
  const mStock = stockData.find((s: any) => s.machine_id === m.id)
  const msColor = !mStock?.stock_known ? C.text3 : mStock.cups_remaining <= 10 ? C.red : mStock.stock_pct <= 50 ? C.amber : C.green
  const msBg = !mStock?.stock_known ? C.surface2 : mStock.cups_remaining <= 10 ? C.redBg : mStock.stock_pct <= 50 ? C.amberBg : C.greenBg
  const msDays = mStock?.last_loaded_at ? Math.floor((Date.now()-new Date(mStock.last_loaded_at).getTime())/86400000) : null
  const co = getCoords(m)
  return (
    <div style={{ background: C.surface, borderTop: '1px solid ' + C.border }}>
      <div onClick={() => setExpandedId(isExpanded ? null : m.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', background: isExpanded ? C.surface2 : C.surface }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: online ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🖥</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{m.display_name}</div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2, fontFamily: 'monospace' }}>SN: {m.sn} · ID: {m.id?.slice(0,8)}...</div>
        </div>
        <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}><Dot color={online ? C.green : C.red} pulse={online} size={5} />{online ? 'Online' : 'Offline'}</Pill>
        <span style={{ fontSize: 12, color: C.text3 }}>{isExpanded ? '▲' : '▼'}</span>
      </div>
      {isExpanded && (
        <div style={{ borderTop: '1px solid ' + C.border }}>
          <div style={{ height: 3, background: online ? C.green : C.border2 }} />
          <div style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace', marginTop: 2 }}>{m.sn}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {canEdit && <button onClick={e => { e.stopPropagation(); openEdit(m) }} style={{ background: C.surface2, color: C.text2, border: '1px solid ' + C.border, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>}
                {canEdit && <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button onClick={e => { e.stopPropagation(); setCmdMenu(cmdMenu === m.id ? null : m.id) }} style={{ background: C.surface2, color: C.orange, border: '1px solid ' + C.border, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>⚡ Remote</button>
                  {cmdMenu === m.id && <div style={{ position: 'absolute', right: 0, top: 28, background: C.surface, maxWidth: 180, border: '1px solid ' + C.border, borderRadius: 10, padding: 6, zIndex: 99, minWidth: 150, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                    {[['reboot','🔄 Reboot'],['reset_mcu','⚡ Reset MCU'],['clear_fault','🔧 Clear Fault'],['sync_config','📡 Sync Config'],['maintenance_on','🚧 Maintenance ON'],['maintenance_off','✅ Maintenance OFF'],['run_cleaning','🧹 Run Cleaning']].map(([cmd,label]) =>
                      <button key={cmd} disabled={cmdSending} onClick={e => { e.stopPropagation(); sendCommand(m.id, m.sn, cmd) }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '7px 10px', fontSize: 12, color: C.text, cursor: 'pointer', borderRadius: 6, fontWeight: 600 }}>{label}</button>
                    )}
                  </div>}
                </div>}
                {co && <a href={'https://www.google.com/maps?q=' + co.lat + ',' + co.lng} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.blue, fontWeight: 600, textDecoration: 'none', padding: '4px 10px', background: C.blueBg, borderRadius: 8 }}>🗺 Maps</a>}
              </div>
            </div>
            {mStock?.stock_known ? (
              <div style={{ background: msBg, borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>🍊</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: msColor }}>{mStock.cups_remaining} cups remaining ({mStock.stock_pct}%)</div>
                  {msDays != null && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>Last loaded {msDays === 0 ? 'today' : msDays + 'd ago'}</div>}
                </div>
              </div>
            ) : (
              <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: C.text3 }}>🍊 No stock data — log a loading visit</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {[
                { label: 'Temperature', value: temp != null ? temp + '°C' : '--', color: tempColor },
                { label: 'Last Seen', value: fmtTime(m.last_seen), color: C.text },
                { label: 'Scale', value: m.scale_weight_g != null ? Math.max(0, m.scale_weight_g - 235) + 'g' : '--', color: C.text },
                { label: 'Version', value: m.app_version ? 'v' + m.app_version : '--', color: C.blue },
              ].map(f => (
                <div key={f.label} style={{ background: C.surface2, borderRadius: 8, padding: '7px 10px' }}>
                  <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MachineGroupedList({ machines, search, expandedId, setExpandedId, stockData, role, canEdit, openEdit, fmtTime, getCoords, sendCommand, cmdMenu, setCmdMenu, cmdSending }: any) {
  const [collapsedOps, setCollapsedOps] = useState<Record<string, boolean>>({})

  const filtered = (machines || []).filter((m: any) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (m.display_name || '').toLowerCase().includes(q) ||
      (m.location || '').toLowerCase().includes(q) ||
      (m.sn || '').toLowerCase().includes(q) ||
      (m.owner_name || '').toLowerCase().includes(q)
  })

  // Group by operator → then by location
  const opGroups: Record<string, { name: string; id: string; machines: any[] }> = {}
  filtered.forEach((m: any) => {
    const opName = m.owner_name || 'Unassigned'
    const opId = m.owner_id || 'unassigned'
    if (!opGroups[opId]) opGroups[opId] = { name: opName, id: opId, machines: [] }
    opGroups[opId].machines.push(m)
  })

  const sortedOps = Object.values(opGroups).sort((a, b) =>
    a.name === 'Unassigned' ? 1 : b.name === 'Unassigned' ? -1 : a.name.localeCompare(b.name)
  )

  const toggleOp = (opId: string) => setCollapsedOps(p => ({ ...p, [opId]: !p[opId] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sortedOps.map(opGroup => {
        const isCollapsed = collapsedOps[opGroup.id]
        const onlineCount = opGroup.machines.filter((m: any) => m.status === 'online').length
        const totalSales = opGroup.machines.reduce((sum: number, m: any) => sum + (m.today_revenue || 0), 0)

        // Sub-group by location
        const locGroups: Record<string, any[]> = {}
        opGroup.machines.forEach((m: any) => {
          const loc = m.location || 'Unassigned Location'
          if (!locGroups[loc]) locGroups[loc] = []
          locGroups[loc].push(m)
        })
        const sortedLocs = Object.entries(locGroups).sort(([a], [b]) =>
          a === 'Unassigned Location' ? 1 : b === 'Unassigned Location' ? -1 : a.localeCompare(b)
        )

        return (
          <div key={opGroup.id} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, overflow: 'hidden' }}>
            {/* Operator header — clickable to collapse */}
            <div onClick={() => toggleOp(opGroup.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', background: isCollapsed ? C.surface2 : C.surface, borderBottom: isCollapsed ? 'none' : '1px solid ' + C.border }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f1ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧑‍💼</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{opGroup.name}</div>
                <div style={{ fontSize: 12, color: C.text2, marginTop: 2, display: 'flex', gap: 10 }}>
                  <span>🖥 {opGroup.machines.length} machine{opGroup.machines.length !== 1 ? 's' : ''}</span>
                  <span style={{ color: onlineCount > 0 ? C.green : C.text3 }}>📡 {onlineCount} online</span>
                  {totalSales > 0 && <span style={{ color: C.blue }}>₹{totalSales.toLocaleString('en-IN')} today</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onlineCount > 0 && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green }} />}
                <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>{isCollapsed ? '▼ Show' : '▲ Hide'}</span>
              </div>
            </div>

            {/* Locations + machines — hidden when collapsed */}
            {!isCollapsed && (
              <div>
                {sortedLocs.map(([locName, locMachines], li) => (
                  <div key={locName} style={{ borderBottom: li < sortedLocs.length - 1 ? '1px solid ' + C.border : 'none' }}>
                    {/* Location sub-header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: C.surface2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text2 }}>📍 {locName}</span>
                      <span style={{ fontSize: 11, color: C.text3 }}>{locMachines.length} machine{locMachines.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Machines in this location */}
                    {locMachines.map((m: any) => {
                      const online = m.status === 'online'
                      const isExpanded = expandedId === m.id
                      const temp = m.inner_temp_c
                      const tempColor = temp == null ? C.text3 : temp > 18 ? C.red : temp > 12 ? C.amber : temp < 3 ? C.blue : C.green
                      const mStock = stockData.find((s: any) => s.machine_id === m.id)
                      const msColor = !mStock?.stock_known ? C.text3 : mStock.cups_remaining <= 10 ? C.red : mStock.stock_pct <= 50 ? C.amber : C.green
                      const msBg = !mStock?.stock_known ? C.surface2 : mStock.cups_remaining <= 10 ? C.redBg : mStock.stock_pct <= 50 ? C.amberBg : C.greenBg
                      const msDays = mStock?.last_loaded_at ? Math.floor((Date.now()-new Date(mStock.last_loaded_at).getTime())/86400000) : null
                      const co = getCoords(m)

                      return (
                        <div key={m.id} style={{ background: C.surface, borderTop: '1px solid ' + C.border }}>
                          {/* Compact row */}
                          <div onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', background: isExpanded ? C.surface2 : C.surface }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: online ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🖥</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                              <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>SN: {m.sn}</div>
                            </div>
                            <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}><Dot color={online ? C.green : C.red} pulse={online} size={5} />{online ? 'Online' : 'Offline'}</Pill>
                            <span style={{ fontSize: 12, color: C.text3 }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div style={{ borderTop: '1px solid ' + C.border }}>
                              <div style={{ height: 3, background: online ? C.green : C.border2 }} />
                              <div style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                                    <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace', marginTop: 2 }}>{m.sn}</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    {canEdit && <button onClick={e => { e.stopPropagation(); openEdit(m) }} style={{ background: C.surface2, color: C.text2, border: '1px solid ' + C.border, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>}
                {canEdit && <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button onClick={e => { e.stopPropagation(); setCmdMenu(cmdMenu === m.id ? null : m.id) }} style={{ background: C.surface2, color: C.orange, border: '1px solid ' + C.border, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>⚡ Remote</button>
                  {cmdMenu === m.id && <div style={{ position: 'absolute', right: 0, top: 28, background: C.surface, maxWidth: 180, border: '1px solid ' + C.border, borderRadius: 10, padding: 6, zIndex: 99, minWidth: 150, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                    {[['reboot','🔄 Reboot'],['reset_mcu','⚡ Reset MCU'],['clear_fault','🔧 Clear Fault'],['sync_config','📡 Sync Config'],['maintenance_on','🚧 Maintenance ON'],['maintenance_off','✅ Maintenance OFF'],['run_cleaning','🧹 Run Cleaning']].map(([cmd,label]) =>
                      <button key={cmd} disabled={cmdSending} onClick={e => { e.stopPropagation(); sendCommand(m.id, m.sn, cmd) }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '7px 10px', fontSize: 12, color: C.text, cursor: 'pointer', borderRadius: 6, fontWeight: 600 }}>{label}</button>
                    )}
                  </div>}
                </div>}
                                    {co && <a href={'https://www.google.com/maps?q=' + co.lat + ',' + co.lng} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.blue, fontWeight: 600, textDecoration: 'none', padding: '4px 10px', background: C.blueBg, borderRadius: 8 }}>🗺 Maps</a>}
                                  </div>
                                </div>

                                {/* Stock */}
                                {mStock?.stock_known && (
                                  <div style={{ background: msBg, borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 22 }}>🍊</span>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: msColor }}>{mStock.cups_remaining} cups remaining ({mStock.stock_pct}%)</div>
                                      {msDays != null && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>Last loaded {msDays === 0 ? 'today' : msDays + 'd ago'}</div>}
                                    </div>
                                  </div>
                                )}
                                {!mStock?.stock_known && (
                                  <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: C.text3 }}>🍊 Stock: No data — log a loading visit</div>
                                )}

                                {/* Stats grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                                  {[
                                    { label: 'Temperature', value: temp != null ? temp + '°C' : '--', color: tempColor },
                                    { label: 'Last Seen', value: fmtTime(m.last_seen), color: C.text },
                                    { label: 'Scale', value: m.scale_weight_g != null ? Math.max(0, m.scale_weight_g - 235) + 'g' : '--', color: C.text },
                                    { label: 'Version', value: m.app_version ? 'v' + m.app_version : '--', color: C.blue },
                                  ].map(f => (
                                    <div key={f.label} style={{ background: C.surface2, borderRadius: 8, padding: '7px 10px' }}>
                                      <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


function MachinesPage({ machines, loading, fetchData }: any) {
  const [stockData, setStockData] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  useEffect(() => { fetch('/api/stock').then(r=>r.json()).then(d=>setStockData(Array.isArray(d)?d:[])).catch(()=>{}) }, [])
  const safeMachines = (machines || []).map((m: any) => {
    let st = m.state
    if (typeof st === 'string') { try { st = JSON.parse(st) } catch { st = {} } }
    return { ...m, state: st || {} }
  })
  const fmtTime = (t: string) => { if (!t) return '--'; const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m/60) + 'h ago'; return Math.floor(m/1440) + 'd ago' }
  // ─── Edit machine name + location (super_admin only) ───
  const role = getCookie('fl_role') || 'operator'
  const canEdit = role === 'super_admin'
  const [editM, setEditM] = useState<any>(null)   // machine being edited, or null
  const [eName, setEName] = useState('')
  const [eLoc, setELoc] = useState('')
  const [eLat, setELat] = useState('')
  const [eLng, setELng] = useState('')
  const [eSaving, setESaving] = useState(false)
  const [eErr, setEErr] = useState('')
  const openEdit = (m: any) => { setEditM(m); setEName(m.display_name || ''); setELoc(m.location || ''); setELat(m.location_lat != null ? String(m.location_lat) : ''); setELng(m.location_lng != null ? String(m.location_lng) : ''); setEErr('') }
  const closeEdit = () => { setEditM(null); setEErr(''); setESaving(false) }
  const saveEdit = async () => {
    if (!editM) return
    if (!eName.trim()) { setEErr('Name cannot be empty'); return }
    setESaving(true); setEErr('')
    try {
      const res = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?sn=eq.' + editM.sn), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ display_name: eName.trim(), location: eLoc.trim(), location_lat: eLat.trim() === '' ? null : Number(eLat), location_lng: eLng.trim() === '' ? null : Number(eLng) })
      })
      if (!res.ok) { const t = await res.text().catch(() => ''); setEErr('Save failed: ' + (t || res.status)); setESaving(false); return }
      closeEdit()
      if (typeof fetchData === 'function') fetchData()
    } catch (e: any) { setEErr('Save failed: ' + (e?.message || 'error')); setESaving(false) }
  }
  const [cmdMenu, setCmdMenu] = useState<string | null>(null)
  const [cmdSending, setCmdSending] = useState(false)
  const sendCommand = async (machineId: string, sn: string, command: string, params: any = {}) => {
    const name = safeMachines.find((m: any) => m.id === machineId)?.display_name || sn
    if (!confirm('Send ' + command.toUpperCase() + ' to ' + name + '?')) return
    setCmdSending(true)
    try {
      const r = await fetch('/api/machine-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'command', machine_id: machineId, command, params })
      })
      const data = await r.json()
      if (data.code === 1) { alert(command + ' command sent to ' + name + '. It will execute on the next heartbeat (~5 min).'); setCmdMenu(null) }
      else alert('Failed: ' + (data.msg || 'unknown'))
    } catch (e: any) { alert('Error: ' + e.message) }
    setCmdSending(false)
  }
  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Machine List</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{safeMachines.length} machines · {safeMachines.filter((m: any) => m.status === 'online').length} online</div>
        </div>
        <button onClick={fetchData} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Refresh</button>
      </div>
      <input
        type="text" placeholder="🔍 Search by machine name or location..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid ' + C.border, borderRadius: 10, marginBottom: 18, boxSizing: 'border-box' as const, color: C.text, background: C.surface, outline: 'none' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Machines', value: safeMachines.length, color: C.blue, icon: '🖥', pct: 100 },
          { label: 'Online', value: safeMachines.filter((m: any) => m.status === 'online').length, color: C.green, icon: '📡', pct: safeMachines.length > 0 ? (safeMachines.filter((m: any) => m.status === 'online').length / safeMachines.length) * 100 : 0 },
          { label: 'Offline', value: safeMachines.filter((m: any) => m.status !== 'online').length, color: C.red, icon: '📴', pct: safeMachines.length > 0 ? (safeMachines.filter((m: any) => m.status !== 'online').length / safeMachines.length) * 100 : 0 },
        ].map(s => <StatCard key={s.label} {...s} sub="" />)}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading machines...</div>
      ) : (
        <MachineGroupedList
          machines={safeMachines}
          search={search}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          stockData={stockData}
          role={role}
          canEdit={canEdit}
          openEdit={openEdit}
          sendCommand={sendCommand}
          cmdMenu={cmdMenu}
          setCmdMenu={setCmdMenu}
          cmdSending={cmdSending}
          fmtTime={fmtTime}
          getCoords={(m: any) => { if (m.location_lat != null && m.location_lng != null) return { lat: m.location_lat, lng: m.location_lng }; return null; }}
        />
      )}
      {/* Command History */}
      <div style={{ marginTop: 24, background: C.surface, border: '1px solid ' + C.border, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>📋 Recent Commands</div>
          <div style={{ fontSize: 11, color: C.text3 }}>Auto-refreshes every 30s</div>
        </div>
        <CommandHistory machines={safeMachines} />
      </div>

      {editM && (
        <div onClick={closeEdit} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 24, width: 420, maxWidth: '90vw' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>Edit Machine</div>
            <div style={{ fontSize: 12, color: C.text3, fontFamily: 'monospace', marginBottom: 18 }}>{editM.sn}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Machine Name</label>
              <input value={eName} onChange={e => setEName(e.target.value)} placeholder="e.g. Fruitful-2"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface2, color: C.text, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Location</label>
              <input value={eLoc} onChange={e => setELoc(e.target.value)} placeholder="e.g. SR Nagar, Ameerpet"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface2, color: C.text, fontSize: 14, boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>This is the address label shown on the dashboard.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Latitude</label>
                <input value={eLat} onChange={e => setELat(e.target.value)} placeholder="17.45437"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface2, color: C.text, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Longitude</label>
                <input value={eLng} onChange={e => setELng(e.target.value)} placeholder="78.36594"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface2, color: C.text, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 14, marginTop: -8 }}>Right-click the spot in Google Maps → click the numbers to copy. First is Latitude, second is Longitude. Leave blank to keep the default map position.</div>
            {eErr && <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{eErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={closeEdit} disabled={eSaving} style={{ background: C.surface2, color: C.text2, border: '1px solid ' + C.border, borderRadius: 9, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={saveEdit} disabled={eSaving} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontWeight: 600, cursor: eSaving ? 'default' : 'pointer', fontSize: 13, opacity: eSaving ? 0.6 : 1 }}>{eSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FleetMapPage({ machines }: { machines: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  // Coordinates pulled straight from Supabase by serial number (no VPS dependency).
  const [dbCoords, setDbCoords] = useState<Record<string, {lat: number, lng: number}>>({})
  const MB = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'NEXT_PUBLIC_MAPBOX_TOKEN_HERE'
  // Hardcoded fallback coords by SN, then by location string
  const MACHINE_COORDS: Record<string, {lat: number, lng: number}> = {
    'C3B31F38D1C07A76': { lat: 17.45437171063268, lng: 78.36593749556503 }, // Fruitful-2 HITEC City, Kondapur exact
    '9E3D050CEF2EEC7B': { lat: 17.4702, lng: 78.5607 }, // Fruitful-1 ECIL
  }
  const COORDS: Record<string, {lat: number, lng: number}> = {
    'SR Nagar, Ameerpet': { lat: 17.442822793310572, lng: 78.44438079543997 },
    'SR Nagar': { lat: 17.442822793310572, lng: 78.44438079543997 },
    'Ameerpet': { lat: 17.442822793310572, lng: 78.44438079543997 },
    'Cheeriyal, ECIL': { lat: 17.4702, lng: 78.5607 },
    'ECIL': { lat: 17.4702, lng: 78.5607 },
    'Cheeriyal': { lat: 17.4702, lng: 78.5607 },
  }
  // Load saved lat/lng for every machine directly from Supabase (via the working /api/sb proxy)
  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=sn,location_lat,location_lng'))
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d)) return
        const map: Record<string, {lat: number, lng: number}> = {}
        d.forEach((row: any) => {
          if (row && row.sn && row.location_lat != null && row.location_lng != null) {
            map[row.sn] = { lat: Number(row.location_lat), lng: Number(row.location_lng) }
          }
        })
        setDbCoords(map)
      })
      .catch(() => {})
  }, [])
  const getCoords = (m: any) => {
    if (dbCoords[m.sn]) return dbCoords[m.sn]
    if (MACHINE_COORDS[m.sn]) return MACHINE_COORDS[m.sn]
    if (m.location) {
      if (COORDS[m.location]) return COORDS[m.location]
      // Partial match
      const key = Object.keys(COORDS).find(k => m.location.includes(k) || k.includes(m.location))
      if (key) return COORDS[key]
    }
    return null
  }
  useEffect(() => {
    if ((window as any).mapboxgl) { setScriptLoaded(true); return; }
    if (document.querySelector('script[src*="mapbox-gl"]')) { setScriptLoaded(true); return; }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdn.jsdelivr.net/npm/mapbox-gl@3.3.0/dist/mapbox-gl.css'; document.head.appendChild(link)
    const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/mapbox-gl@3.3.0/dist/mapbox-gl.js'; script.onload = () => setScriptLoaded(true); document.head.appendChild(script)
  }, [])
  useEffect(() => {
    if (!scriptLoaded || !mapRef.current) return
    const mgl = (window as any).mapboxgl
    mgl.accessToken = MB
    const map = new mgl.Map({ container: mapRef.current, style: 'mapbox://styles/mapbox/light-v11', center: [78.44438079543997, 17.442822793310572], zoom: 10.5 })
    const esc = (s: any) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    machines.forEach((m: any) => {
      const co = getCoords(m); if (!co) return
      const online = m.status === 'online'
      const el = document.createElement('div')
      el.style.cssText = 'width:36px;height:36px;border-radius:50%;background:' + (online ? C.green : C.red) + ';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;'
      el.textContent = 'F'
      el.title = m.display_name + ' — click to open in Google Maps'
      el.addEventListener('click', () => {
        window.open('https://www.google.com/maps?q=' + co.lat + ',' + co.lng + '&z=17', '_blank')
      })
      const popup = new mgl.Popup({ offset: 20, closeButton: false }).setHTML('<b>' + m.display_name + '</b><br><small>' + (m.location||'') + '</small><br><small style="color:' + (online ? '#16a34a' : '#dc2626') + '">' + (online ? 'Online' : 'Offline') + '</small>' + (m.inner_temp_c != null ? '<br><small>Temp: ' + m.inner_temp_c + 'C</small>' : '') + '<br><small style="color:#3b82f6;cursor:pointer" onclick="window.open(\"https://www.google.com/maps?q=' + co.lat + ',' + co.lng + '&z=17\",\"_blank\")">📍 Open in Google Maps</small>')
      new mgl.Marker({ element: el }).setLngLat([co.lng, co.lat]).setPopup(popup).addTo(map)
    })
    map.addControl(new mgl.NavigationControl(), 'bottom-right')
    return () => map.remove()
  }, [scriptLoaded, machines, dbCoords])
  const fmtTime = (t: string) => { if (!t) return '--'; const mins = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (mins < 60) return mins + 'm ago'; if (mins < 1440) return Math.floor(mins/60) + 'h ago'; return Math.floor(mins/1440) + 'd ago' }
  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Fleet Map</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{machines.length} machines registered</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, overflow: 'hidden', minHeight: 500, position: 'relative' }}>
          {!scriptLoaded && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface2, flexDirection: 'column', gap: 12, zIndex: 10 }}><div style={{ fontSize: 32 }}>🗺</div><div style={{ fontSize: 13, fontWeight: 600, color: C.text3 }}>Loading Map...</div><div style={{ fontSize: 11, color: C.text3 }}>Powered by Mapbox</div></div>}
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 500 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {machines.map((m: any) => {
            const online = m.status === 'online'
            return (
              <div key={m.id} style={{ borderBottom: '1px solid ' + C.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: online ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🖥</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                    <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>📍 {m.location || m.sn}</div>
                  </div>
                  <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}>{online ? 'Online' : 'Offline'}</Pill>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}




// ═══════════════════════════════════════════════════════════════════════
//  AdsPage — DROP-IN REPLACEMENT for the existing AdsPage in dashboard.tsx
//
//  Replace your current `function AdsPage({ machines }...) { ... }` block
//  with everything below (up to the matching closing brace).
//
//  Uses: the new ad_campaign schema, the /api/sb proxy, your C.* tokens,
//  and your Pill / Badge / StatCard / Dot components (already in the file).
//  Signature is unchanged, so the line
//      ads: <AdsPage machines={machines} />
//  in the pages map keeps working with no edit.
// ═══════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
//  BottomTilesPanel — per-machine idle-screen bottom tiles (left 60% / right 40%)
//  These are the two fixed signage images below the top ad zone. They are NOT
//  ad campaigns: they live in machines.state.screen_config.bottom_left_url /
//  bottom_right_url and are read by the machine app's BottomTilesLoader.
//  Uploading reuses the same /api/upload presigned-PUT flow as ad media.
// ─────────────────────────────────────────────────────────────────────────────
function BottomTilesPanel({ machines }: { machines: any[] }) {
  const parseSC = (m: any) => {
    try { const st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}); return st.screen_config || {} } catch { return {} }
  }
  const [sel, setSel] = useState<string>(machines[0]?.sn || '')
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [busy, setBusy] = useState<'' | 'left' | 'right' | 'save'>('')
  const [savedAt, setSavedAt] = useState<number>(0)
  const [dirty, setDirty] = useState(false)

  const machine = machines.find(m => m.sn === sel)

  // Load the selected machine's current tile URLs whenever the selection changes.
  useEffect(() => {
    if (!machine) return
    const sc = parseSC(machine)
    setLeft(sc.bottom_left_url || '')
    setRight(sc.bottom_right_url || '')
    setDirty(false)
  }, [sel])

  const upload = async (which: 'left' | 'right', file: File) => {
    const MAX_MB = 100
    if (file.size > MAX_MB * 1024 * 1024) { alert('That file is ' + (file.size / 1048576).toFixed(1) + ' MB. Keep tile images under ' + MAX_MB + ' MB.'); return }
    setBusy(which)
    try {
      const presignRes = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', operator_id: getCookie('fl_operator_id') || 'shared' }),
      })
      const presign = await presignRes.json()
      if (!presign.uploadUrl) { alert('Upload failed: ' + (presign.error || 'no upload url')); setBusy(''); return }
      const put = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!put.ok) { alert('Upload to storage failed (' + put.status + ')'); setBusy(''); return }
      if (which === 'left') setLeft(presign.publicUrl); else setRight(presign.publicUrl)
      setDirty(true)
    } catch (e: any) { alert('Upload failed: ' + (e?.message || e)) }
    setBusy('')
  }

  const save = async () => {
    if (!machine) return
    setBusy('save')
    try {
      const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
      // Read the freshest row so we never clobber other screen_config keys.
      const rows = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=state&sn=eq.' + machine.sn), { headers }).then(r => r.json())
      let st: any = {}
      try { const raw = rows?.[0]?.state; st = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {}) } catch { st = {} }
      st.screen_config = st.screen_config || {}
      st.screen_config.bottom_left_url = left || ''
      st.screen_config.bottom_right_url = right || ''
      await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?sn=eq.' + machine.sn),
        { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ state: JSON.stringify(st) }) })
      // reflect locally so a re-select shows the saved values
      if (machine) machine.state = JSON.stringify(st)
      setDirty(false); setSavedAt(Date.now())
    } catch (e: any) { alert('Save failed: ' + (e?.message || e)) }
    setBusy('')
  }

  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }

  const tile = (which: 'left' | 'right', url: string, setUrl: (s: string) => void, label: string, pct: string) => (
    <div style={{ flex: which === 'left' ? 3 : 2, minWidth: 0 }}>
      <label style={lbl}>{label} <span style={{ color: C.text3, fontWeight: 600 }}>· {pct}</span></label>
      <div style={{ width: '100%', aspectRatio: which === 'left' ? '16/10' : '10/10', borderRadius: 10, border: '1px dashed ' + C.border, background: url ? '#000' : C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 }}>
        {url
          ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ color: C.text3, fontSize: 12 }}>No image set</span>}
      </div>
      <input id={'tile-file-' + which} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) upload(which, f); (e.target as HTMLInputElement).value = '' }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" disabled={busy === which} onClick={() => document.getElementById('tile-file-' + which)?.click()}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.orange, background: busy === which ? C.surface2 : C.orangeBg, color: C.orange, fontSize: 12.5, fontWeight: 700, cursor: busy === which ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
          {busy === which ? 'Uploading...' : '⬆ Upload image'}
        </button>
        {url && <button type="button" onClick={() => { setUrl(''); setDirty(true) }}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface, color: C.text2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Clear</button>}
      </div>
      <input style={inp} value={url} onChange={e => { setUrl(e.target.value); setDirty(true) }} placeholder="Upload above, or paste an image URL" />
    </div>
  )

  if (machines.length === 0) return null

  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 20, marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Bottom Tiles <span style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>· idle-screen signage</span></div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>The two fixed images below the ad zone. Left is wide (60%), right is square (40%). Set per machine.</div>
        </div>
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface2, color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {machines.map((m: any) => <option key={m.sn} value={m.sn}>{m.display_name || m.sn}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 14 }}>
        {tile('left', left, setLeft, 'Left tile', '60% · wide')}
        {tile('right', right, setRight, 'Right tile', '40% · square')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button type="button" disabled={!dirty || busy === 'save'} onClick={save}
          style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: (!dirty || busy === 'save') ? C.surface2 : C.orange, color: (!dirty || busy === 'save') ? C.text3 : '#fff', fontSize: 13, fontWeight: 700, cursor: (!dirty || busy === 'save') ? 'default' : 'pointer' }}>
          {busy === 'save' ? 'Saving...' : 'Save tiles'}
        </button>
        {dirty && <span style={{ fontSize: 12, color: C.amber, fontWeight: 700 }}>Unsaved changes</span>}
        {!dirty && savedAt > 0 && <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>✓ Saved — appears on the machine at its next config sync</span>}
      </div>
    </div>
  )
}

function AdsPage({ machines, permissions = {}, role: roleProp = '', operatorId = '', ownerId = '' }: { machines: any[]; permissions?: Record<string, boolean>; role?: string; operatorId?: string; ownerId?: string }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const SCREENS = ['idle', 'ordering', 'dispensing', 'thanks']
  const role = roleProp || getCookie('fl_role') || 'operator'
  // Who may manage ads: super_admin always; operator/sub_operator only with the
  // can_manage_ads permission. Others get a read-only view.
  const canManageAds = role === 'super_admin' || permissions.can_manage_ads === true
  // The operator that owns campaigns created here: self for operator,
  // parent for sub_operator, '' for super_admin (server stamps nothing extra).
  const myAdOwnerId = role === 'sub_operator' ? (ownerId || '') : (operatorId || '')

  const [campaigns, setCampaigns] = useState<any[]>([])
  const [perf, setPerf] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [machineFilter, setMachineFilter] = useState('all')
  const [editing, setEditing] = useState<any>(null)   // campaign being edited, or {} for new
  const [saving, setSaving] = useState(false)

  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?select=*&order=created_at.desc'), { headers })
        .then(r => r.json()).then(d => Array.isArray(d) ? d : []),
      fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign_performance?select=*'), { headers })
        .then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
    ]).then(([camps, perfRows]) => {
      setCampaigns(camps)
      const pm: Record<string, any> = {}
      perfRows.forEach((p: any) => { pm[p.campaign_id] = p })
      setPerf(pm)
      setLoading(false)
    }).catch(e => { console.error('ads load error', e); setCampaigns([]); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const visible = machineFilter === 'all'
    ? campaigns
    : campaigns.filter(c => (c.machine_sns || []).includes(machineFilter))

  // KPIs
  const activeCount = campaigns.filter(c => c.status === 'active').length
    const pendingCount = campaigns.filter(c => c.approval === 'pending').length
  const totalImpr = Object.values(perf).reduce((s: number, p: any) => s + (p.impressions || 0), 0)
  const totalRev = Object.values(perf).reduce((s: number, p: any) => s + (Number(p.revenue) || 0), 0)

  const fmtK = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : '' + n
  const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
  const hh = (h: number) => String(h).padStart(2, '0') + ':00'
  const snName = (sn: string) => machines.find(m => m.sn === sn)?.display_name || sn

  const save = async (c: any) => {
    if (!canManageAds) { alert('You have view-only access to ads. Ask Fruitlink to enable ad management.'); return }
    setSaving(true)
    try {
      const isOwn = (c.advertiser || '').trim().toLowerCase() === 'fruitlink'
      const body: any = {
        name: c.name, advertiser: c.advertiser, is_own: isOwn,
        media_type: c.media_type, media_url: c.media_url || null, media_name: c.media_name || null,
        duration_s: c.duration_s || 15, screen: c.screen,
        machine_sns: c.machine_sns || [], days: c.days || [],
        start_hour: c.start_hour, end_hour: c.end_hour, weight: c.weight,
        status: c.status, rate_cpm: isOwn ? null : (c.rate_cpm ? Number(c.rate_cpm) : null),
      }
      // Stamp ownership for operator-created campaigns (super_admin leaves as-is /
      // may target any machine). The server re-validates and overrides this anyway.
      if (role !== 'super_admin' && myAdOwnerId) body.operator_id = myAdOwnerId
      if (c.id) {
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?id=eq.' + c.id),
          { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
      } else {
        // approval defaulting is handled by the DB trigger (own->approved, third-party->pending)
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign'),
          { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
      }
      setEditing(null); load()
    } catch (e: any) { alert('Save failed: ' + (e?.message || e)) }
    setSaving(false)
  }

  const setStatus = async (id: string, status: string) => {
    await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?id=eq.' + id),
      { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ status }) })
    load()
  }
  const setApproval = async (id: string, approval: string) => {
    await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?id=eq.' + id),
      { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ approval }) })
    load()
  }
  const remove = async (id: string) => {
    if (!confirm('Delete this campaign permanently?')) return
    // Find this campaign's media URL, and check whether any OTHER campaign
    // still uses the same file before deleting it from storage.
    const target = campaigns.find(c => c.id === id)
    const url = target?.media_url || ''
    const sharedByOthers = !!url && campaigns.some(c => c.id !== id && c.media_url === url)
    // Delete the campaign row first.
    await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?id=eq.' + id), { method: 'DELETE', headers })
    // Then remove the stored file, but only if nothing else references it.
    if (url && !sharedByOthers) {
      try {
        await fetch('/api/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      } catch (e) { /* file cleanup is best-effort; ignore */ }
    }
    setEditing(null); load()
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Ad Manager</div>
          <div style={{ fontSize: 13, color: C.text2 }}>In-machine advertising — schedule by machine, screen, time &amp; day</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pendingCount > 0 && (
            <Pill color={C.amber} bg={C.amberBg}><Dot color={C.amber} pulse size={5} /> {pendingCount} pending approval</Pill>
          )}
          {canManageAds ? (
            <button onClick={() => setEditing({ _new: true, name: '', advertiser: role === 'super_admin' ? 'Fruitlink' : '', media_type: 'image', media_url: '', media_name: '', duration_s: 15, screen: 'idle', machine_sns: machines.map((m: any) => m.sn), days: [0, 1, 2, 3, 4], start_hour: 9, end_hour: 18, weight: 1, status: 'active', rate_cpm: '' })}
              style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ New Campaign</button>
          ) : (
            <Pill color={C.text3} bg={C.surface2}>View only — ask Fruitlink for ad access</Pill>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Active Campaigns" value={activeCount} sub={campaigns.length + ' total'} color={C.orange} icon="🎬" pct={campaigns.length ? (activeCount / campaigns.length) * 100 : 0} />
        <StatCard label="Impressions" value={fmtK(totalImpr)} sub="all-time plays" color={C.blue} icon="👁" pct={70} />
        <StatCard label="Ad Revenue" value={fmtINR(totalRev)} sub="third-party brands" color={C.green} icon="₹" pct={60} />
        <StatCard label="Pending Approval" value={pendingCount} sub={pendingCount ? 'needs review' : 'all clear'} color={pendingCount ? C.amber : C.green} icon="⏳" pct={pendingCount ? 100 : 0} />
      </div>

      {/* Bottom tiles (per-machine idle-screen signage) — super_admin only for now,
          pending verification of server-side write-scoping in /api/sb. */}
      {role === 'super_admin' && <BottomTilesPanel machines={machines} />}

      {/* Machine filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' as const }}>
        <button onClick={() => setMachineFilter('all')} style={chip(machineFilter === 'all')}>All Machines</button>
        {machines.map((m: any) => (
          <button key={m.id} onClick={() => setMachineFilter(m.sn)} style={chip(machineFilter === m.sn)}>{m.display_name}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading campaigns...</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.surface, borderRadius: 16, border: '1px solid ' + C.border }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No campaigns yet</div>
          <div style={{ fontSize: 13, color: C.text2 }}>Create your first campaign to monetize the machine screen</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((c: any) => {
            const p = perf[c.id] || {}
            return (
              <div key={c.id} onClick={() => setEditing({ ...c, rate_cpm: c.rate_cpm ?? '' })}
                style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: C.orangeBg, border: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {c.media_type === 'video' ? '🎥' : '🖼'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</span>
                    {!c.is_own && <Badge color={C.blue}>{c.advertiser}</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3 }}>
                    {(c.machine_sns || []).length === 0 ? 'No machines' : (c.machine_sns || []).map(snName).join(', ')}
                    {' · '}{c.screen}{' · '}{hh(c.start_hour)}–{hh(c.end_hour)}
                    {' · '}{(c.days || []).length === 7 ? 'every day' : (c.days || []).map((d: number) => DAYS[d]).join(' ')}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 3, display: 'flex', gap: 12 }}>
                    <span>{fmtK(p.impressions || 0)} impressions</span>
                    {!c.is_own && c.rate_cpm && <span style={{ color: C.green }}>{fmtINR(Number(p.revenue) || 0)} · ₹{c.rate_cpm} CPM</span>}
                    <span>weight {c.weight}×</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {c.approval === 'pending' ? (
                    <>
                      <Pill color={C.amber} bg={C.amberBg}>Pending</Pill>
                      {role === 'super_admin' && (
                        <button onClick={() => setApproval(c.id, 'approved')} style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Approve</button>
                      )}
                    </>
                  ) : c.approval === 'rejected' ? (
                    <Pill color={C.red} bg={C.redBg}>Rejected</Pill>
                  ) : (
                    <Pill color={c.status === 'active' ? C.green : C.text3} bg={c.status === 'active' ? C.greenBg : C.surface2}>{c.status === 'active' ? 'Active' : 'Paused'}</Pill>
                  )}
                  <div onClick={() => setStatus(c.id, c.status === 'active' ? 'paused' : 'active')}
                    style={{ width: 36, height: 20, borderRadius: 10, background: c.status === 'active' ? C.orange : C.border2, cursor: 'pointer', position: 'relative' as const, transition: 'background .2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute' as const, top: 2, left: c.status === 'active' ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor drawer */}
      {editing && (
        <AdEditor
          campaign={editing} machines={machines} saving={saving}
          onClose={() => setEditing(null)} onSave={save} onDelete={remove}
        />
      )}
    </div>
  )

  function chip(on: boolean) {
    return { padding: '6px 14px', borderRadius: 8, border: '1px solid ' + (on ? C.orange : C.border), background: on ? C.orange : C.surface2, color: on ? '#fff' : C.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const
  }
}

// ── Ad editor drawer (right-side slide-over) ──
function AdEditor({ campaign, machines, saving, onClose, onSave, onDelete }: any) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const SCREENS = ['idle', 'ordering', 'dispensing', 'thanks']
  const [f, setF] = useState<any>(campaign)
  const [uploading, setUploading] = useState(false)
  const isNew = !!campaign._new
  const isOwn = (f.advertiser || '').trim().toLowerCase() === 'fruitlink'
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const tDay = (d: number) => setF((s: any) => ({ ...s, days: (s.days || []).includes(d) ? s.days.filter((x: number) => x !== d) : [...(s.days || []), d].sort() }))
  const tMac = (sn: string) => setF((s: any) => ({ ...s, machine_sns: (s.machine_sns || []).includes(sn) ? s.machine_sns.filter((x: string) => x !== sn) : [...(s.machine_sns || []), sn] }))
  const valid = (f.name || '').trim() && (f.machine_sns || []).length > 0 && f.end_hour > f.start_hour

  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '95vw', height: '100%', background: C.surface, borderLeft: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px #00000040' }}>
        {/* head */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid ' + C.border }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.orange, fontWeight: 700 }}>{isNew ? 'New Campaign' : 'Edit Campaign'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2 }}>{f.name || 'Untitled campaign'}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, background: C.surface2, border: '1px solid ' + C.border, color: C.text, cursor: 'pointer' }}>✕</button>
        </div>

        {/* body */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {!isNew && f.approval === 'pending' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', background: C.amberBg, border: '1px solid ' + C.amber + '40', borderRadius: 10, fontSize: 12.5, color: C.text, marginBottom: 16 }}>
              <Dot color={C.amber} pulse size={6} /> Third-party ad awaiting approval before it serves.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
            <div><label style={lbl}>Campaign name</label><input style={inp} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Summer Fresh Push" /></div>
            <div><label style={lbl}>Advertiser</label><input style={inp} value={f.advertiser} onChange={e => set('advertiser', e.target.value)} placeholder="Fruitlink or brand name" /></div>
          </div>
          <div style={{ fontSize: 11, color: isOwn ? C.green : C.blue, marginTop: -6, marginBottom: 14 }}>
            {isOwn ? '✓ Own-brand — auto-approved, no ad revenue' : '◷ Third-party — needs approval, earns CPM revenue'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
            <div><label style={lbl}>Media type</label>
              <select style={inp as any} value={f.media_type} onChange={e => set('media_type', e.target.value)}>
                <option value="image">Image (JPEG/PNG)</option>
                <option value="video">Video (MP4)</option>
              </select>
            </div>
            <div><label style={lbl}>Show on screen</label>
              <select style={inp as any} value={f.screen} onChange={e => set('screen', e.target.value)}>
                {SCREENS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Ad image / video</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input id="ad-file-input" type="file" accept="image/*,video/*" style={{ display: 'none' }}
                onChange={async e => {
                  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
                  const MAX_MB = 100
                  if (file.size > MAX_MB * 1024 * 1024) {
                    alert('That file is ' + (file.size / 1048576).toFixed(1) + ' MB. Please keep ad media under ' + MAX_MB + ' MB.')
                    ;(e.target as HTMLInputElement).value = ''
                    return
                  }
                  const isVid = (file.type || '').startsWith('video')
                  setUploading(true)
                  try {
                    // Step 1: ask our API for a presigned PUT URL (tiny request, no file).
                    const presignRes = await fetch('/api/upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        filename: file.name,
                        contentType: file.type || 'application/octet-stream',
                        operator_id: getCookie('fl_operator_id') || 'shared',
                      }),
                    })
                    const presign = await presignRes.json()
                    if (!presign.uploadUrl) { alert('Upload failed: ' + (presign.error || 'no upload url')); setUploading(false); return }
                    // Step 2: PUT the file bytes straight to R2 (no size limit through our server).
                    const put = await fetch(presign.uploadUrl, {
                      method: 'PUT',
                      headers: { 'Content-Type': file.type || 'application/octet-stream' },
                      body: file,
                    })
                    if (!put.ok) { alert('Upload to storage failed (' + put.status + ')'); setUploading(false); return }
                    // Step 3: save the public URL on the campaign.
                    set('media_url', presign.publicUrl); set('media_name', presign.name); set('media_type', isVid ? 'video' : 'image')
                  } catch (err: any) { alert('Upload failed: ' + (err?.message || err)) }
                  setUploading(false)
                }} />
              <button type="button" onClick={() => document.getElementById('ad-file-input')?.click()} disabled={uploading}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid ' + C.orange, background: uploading ? C.surface2 : C.orangeBg, color: C.orange, fontSize: 13, fontWeight: 700, cursor: uploading ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                {uploading ? 'Uploading...' : '⬆ Upload image / video'}
              </button>
              {f.media_url && (f.media_type === 'video'
                ? <video src={f.media_url} muted style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid ' + C.border }} />
                : <img src={f.media_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid ' + C.border }} />)}
            </div>
            <div style={{ fontSize: 10.5, color: C.text3, marginBottom: 8 }}>Images or videos · max 100 MB per file. Keep videos short (10-30s) for fast machine loading.</div>
            <label style={lbl}>Media URL</label>
            <input style={inp} value={f.media_url} onChange={e => set('media_url', e.target.value)} placeholder="Upload above, or paste a URL" />
          </div>
          <div style={{ marginBottom: 14 }}><label style={lbl}>Media filename (label)</label><input style={inp} value={f.media_name} onChange={e => set('media_name', e.target.value)} placeholder="summer_orange_15s.jpg" /></div>

          {!isOwn && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
              <div><label style={lbl}>Rate (₹ CPM)</label><input type="number" style={inp} value={f.rate_cpm} onChange={e => set('rate_cpm', e.target.value)} placeholder="e.g. 300" /></div>
              <div><label style={lbl}>Ad duration (sec)</label><input type="number" style={inp} value={f.duration_s} onChange={e => set('duration_s', +e.target.value)} /></div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Target machines</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {machines.map((m: any) => {
                const on = (f.machine_sns || []).includes(m.sn)
                return (
                  <button key={m.id} onClick={() => tMac(m.sn)} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 1, padding: '9px 12px', cursor: 'pointer', textAlign: 'left' as const, background: on ? C.orangeBg : C.surface2, border: '1px solid ' + (on ? C.orange : C.border), borderRadius: 9, color: C.text }}>
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>{m.display_name}</span>
                    <span style={{ fontSize: 10, color: C.text3 }}>{m.location || m.sn}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Days</label>
            <div style={{ display: 'flex', gap: 5 }}>
              {DAYS.map((d, i) => {
                const on = (f.days || []).includes(i)
                return <button key={d} onClick={() => tDay(i)} style={{ flex: 1, height: 36, fontSize: 12, fontWeight: 700, background: on ? C.orange : C.surface2, color: on ? '#fff' : C.text2, border: '1px solid ' + (on ? C.orange : C.border), borderRadius: 8, cursor: 'pointer' }}>{d}</button>
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
            <div><label style={lbl}>Start hour · {String(f.start_hour).padStart(2, '0')}:00</label><input type="range" min={0} max={23} value={f.start_hour} onChange={e => set('start_hour', Math.min(+e.target.value, f.end_hour - 1))} style={{ width: '100%', accentColor: C.orange }} /></div>
            <div><label style={lbl}>End hour · {String(f.end_hour).padStart(2, '0')}:00</label><input type="range" min={1} max={24} value={f.end_hour} onChange={e => set('end_hour', Math.max(+e.target.value, f.start_hour + 1))} style={{ width: '100%', accentColor: C.orange }} /></div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={lbl}>Rotation weight · {f.weight}× {f.weight >= 4 ? '(shows often)' : f.weight === 1 ? '(shows rarely)' : ''}</label>
            <input type="range" min={1} max={5} value={f.weight} onChange={e => set('weight', +e.target.value)} style={{ width: '100%', accentColor: C.orange }} />
          </div>
        </div>

        {/* foot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 22px', borderTop: '1px solid ' + C.border }}>
          {!isNew && <button onClick={() => onDelete(f.id)} style={{ padding: '9px 15px', background: 'transparent', border: '1px solid ' + C.red + '44', borderRadius: 9, color: C.red, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Delete</button>}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '9px 15px', background: C.surface2, border: '1px solid ' + C.border, borderRadius: 9, color: C.text2, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => valid && onSave(f)} disabled={!valid || saving} style={{ padding: '9px 20px', background: C.orange, border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (valid && !saving) ? 1 : 0.45 }}>
            {saving ? 'Saving...' : isNew ? 'Create campaign' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}



function LoyaltyPage() {
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


// ─── Fault Log ────────────────────────────────────────────────────────

// ─── Command History (recent remote commands across all machines) ──────────
function CommandHistory({ machines }: { machines: any[] }) {
  const [cmds, setCmds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const machineMap: Record<string, string> = {}
  machines.forEach((m: any) => { machineMap[m.id] = m.display_name || m.sn })

  const load = async () => {
    setLoading(true)
    try {
      const path = '/rest/v1/machine_commands?select=*&order=created_at.desc&limit=20'
      const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
      const r = await fetch('/api/sb?path=' + encodeURIComponent(path), { headers })
      const data = await r.json()
      setCmds(Array.isArray(data) ? data : [])
    } catch (e) { console.error('CmdHistory error:', e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const fmtTime = (iso: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
  }
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = { pending: '#F9A825', sent: '#58A6FF', executed: '#3FB950', failed: '#F85149' }
    return { background: (colors[status] || '#8B949E') + '22', color: colors[status] || '#8B949E', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, display: 'inline-block' }
  }
  const cmdIcon: Record<string, string> = { reboot: '🔄', clear_fault: '🔧', sync_config: '📡', maintenance_on: '🚧', maintenance_off: '✅', run_cleaning: '🧹' }

  if (loading && cmds.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: C.text3, fontSize: 13 }}>Loading commands...</div>
  if (cmds.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: C.text3, fontSize: 13 }}>No commands sent yet.</div>

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
        <thead>
          <tr style={{ background: C.surface2 }}>
            {['Command', 'Machine', 'Status', 'Created', 'Sent', 'Executed', 'Result', 'By'].map(h =>
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.text2, fontSize: 11, whiteSpace: 'nowrap' as const }}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {cmds.map((c: any, i: number) => (
            <tr key={c.id || i} style={{ borderBottom: '1px solid ' + C.border, background: i % 2 ? C.surface2 : C.surface }}>
              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{cmdIcon[c.command] || '⚡'} {c.command}</td>
              <td style={{ padding: '8px 10px' }}>{machineMap[c.machine_id] || '?'}</td>
              <td style={{ padding: '8px 10px' }}><span style={statusBadge(c.status)}>{c.status}</span></td>
              <td style={{ padding: '8px 10px', fontSize: 11, color: C.text2 }}>{fmtTime(c.created_at)}</td>
              <td style={{ padding: '8px 10px', fontSize: 11, color: C.text2 }}>{fmtTime(c.sent_at)}</td>
              <td style={{ padding: '8px 10px', fontSize: 11, color: C.text2 }}>{fmtTime(c.executed_at)}</td>
              <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', color: C.text3 }}>{c.result || '—'}</td>
              <td style={{ padding: '8px 10px', fontSize: 11, color: C.text2 }}>{c.created_by || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FaultLogPage({ machines }: { machines: any[] }) {
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

// ─── Comm Log (super admin only) ─────────────────────────────────
function CommLogPage({ machines }: any) {
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
function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: C.orangeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🚧</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{label}</div>
      <Badge color={C.orange}>Coming soon</Badge>
    </div>
  )
}

// ─── Operators Page (super_admin only) ───────────────────────────
function AssignMachinesModal({ op, onClose }: any) {
  const [machines, setMachines] = useState<any[]>([])
  const [assigned, setAssigned] = useState<string[]>([])
  const [initial, setInitial] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const J = { 'Content-Type': 'application/json' }
  useEffect(() => {
    const load = async () => {
      const [mData, aData] = await Promise.all([
        fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,location,state&order=display_name.asc')).then(r => r.json()).catch(() => []),
        fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + op.id)).then(r => r.json()).catch(() => []),
      ])
      setMachines(Array.isArray(mData) ? mData.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true }) : [])
      const cur = Array.isArray(aData) ? aData.map((r: any) => r.machine_id) : []
      setAssigned(cur); setInitial(cur)
    }
    load()
  }, [])
  const toggle = (mid: string) => setAssigned(prev => prev.includes(mid) ? prev.filter(x => x !== mid) : [...prev, mid])
  const save = async () => {
    setSaving(true); setMsg('')
    try {
      // Diff, do not replace. This used to DELETE every row then INSERT the new
      // set: a failed POST - a blip, a 400 - left the operator with ZERO machines
      // and an error toast. Since field staff inherit their operator's machines,
      // that strips the whole team at once. PostgREST gives us no transaction, so
      // touch only what actually changed and leave the rest alone.
      const toAdd = assigned.filter((mid: string) => !initial.includes(mid))
      const toRemove = initial.filter((mid: string) => !assigned.includes(mid))
      if (toRemove.length === 0 && toAdd.length === 0) { setMsg('\u2713 No changes'); setTimeout(onClose, 800); setSaving(false); return }
      if (toRemove.length > 0) {
        const inList = '(' + toRemove.map(encodeURIComponent).join(',') + ')'
        const delRes = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machine_operators?operator_id=eq.' + op.id + '&machine_id=in.' + inList), { method: 'DELETE', headers: J })
        if (!delRes.ok) { setMsg('Error: could not remove ' + toRemove.length + ' assignment(s) (' + delRes.status + '). Nothing was changed.'); setSaving(false); return }
      }
      if (toAdd.length > 0) {
        const insRes = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machine_operators'), { method: 'POST', headers: { ...J, Prefer: 'return=minimal' }, body: JSON.stringify(toAdd.map((mid: string) => ({ machine_id: mid, operator_id: op.id }))) })
        if (!insRes.ok) {
          const t = await insRes.text().catch(() => '')
          setMsg('Error adding: ' + (t || insRes.status) + (toRemove.length ? ' - the ' + toRemove.length + ' removal(s) did go through.' : ''))
          setSaving(false); return
        }
      }
      setInitial(assigned)
      setMsg('\u2713 Saved'); setTimeout(onClose, 800)
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 420, boxShadow: '0 20px 60px #00000030' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>Assign Machines</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>Assigning to {op.name || op.email}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {machines.map(m => (
            <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${assigned.includes(m.id) ? C.orange : C.border}`, borderRadius: 10, cursor: 'pointer', background: assigned.includes(m.id) ? C.orangeBg : C.surface2 }}>
              <input type="checkbox" checked={assigned.includes(m.id)} onChange={() => toggle(m.id)} style={{ width: 16, height: 16, accentColor: C.orange }} />
              <div>
                <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{m.display_name}</div>
                <div style={{ fontSize: 11, color: C.text3 }}>{m.location}</div>
              </div>
            </label>
          ))}
        </div>
        {msg && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: msg.startsWith('\u2713') ? C.greenBg : C.redBg, color: msg.startsWith('\u2713') ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Permissions Modal ───────────────────────────────────────────
function PermissionsModal({ op, onClose, limitTo = null }: any) {
  // limitTo: when provided (operator managing their own team), a permission can only
  // be granted if the grantor holds it. Revoking is always allowed.
  const canGrant = (key: string) => !limitTo || limitTo[key] === true
  const [perms, setPerms] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const PERM_GROUPS = [
    {
      label: '👁 Can View',
      note: 'Which pages appear in their sidebar. Read-only.',
      items: [
        { key: 'can_view_console', label: 'Console', hint: 'Dashboard home & live sales' },
        { key: 'can_view_orders', label: 'Orders List', hint: 'Customer order history' },
        { key: 'can_view_alerts', label: 'Machine Alerts', hint: 'Fault & temperature alerts' },
        { key: 'can_view_fleet_map', label: 'Fleet Map', hint: 'Machine locations on a map' },
        { key: 'can_view_warehouse', label: 'Warehouse', hint: 'Stock levels & movements' },
        { key: 'can_view_reports', label: 'Reports', hint: 'Analytics & summaries' },
        { key: 'can_view_field_staff', label: 'Field Staff — view list', hint: 'See who the staff are' },
        { key: 'can_view_attendance', label: 'Attendance', hint: 'Staff check-in / check-out records' },
        { key: 'can_view_notify_config', label: 'Notification Settings', hint: 'WhatsApp & Telegram recipients' },
        { key: 'can_view_comm_log', label: 'Comm Log', hint: 'Raw machine messages' },
        { key: 'can_view_ad_manager', label: 'Ad Manager', hint: 'View & manage ad campaigns' },
      ]
    },
    {
      label: '⚡ Can Change',
      note: 'These write data. Grant with care.',
      danger: true,
      items: [
        { key: 'can_edit_machine_config', label: 'Edit machine config', hint: 'Change pricing & machine settings' },
        { key: 'can_manage_field_staff', label: 'Add & edit field staff', hint: 'Create, edit and assign staff' },
        { key: 'can_manage_locations', label: 'Add & edit locations', hint: 'Create, rename, delete locations' },
        { key: 'can_manage_warehouse', label: 'Manage warehouse', hint: 'Receive, dispatch, sale, transfer stock' },
        { key: 'can_edit_office_location', label: 'Edit office location', hint: 'Move the office GPS pin' },
        { key: 'can_export_data', label: 'Export data', hint: 'Download CSV / PDF reports' },
        { key: 'can_manage_warehouse', label: 'Manage warehouse', hint: 'Receive, dispatch, sell, edit stock' },
        { key: 'can_manage_ads', label: 'Manage ads', hint: 'Create & edit ad campaigns on their own machines' },
      ]
    }
  ]

  useEffect(() => {
    fetch('/api/operator-permissions?operator_id=' + op.id)
      .then(r => r.json())
      .then(d => {
        if (d) setPerms(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [op.id])

  const toggle = (key: string) => {
    if (!canGrant(key) && !perms[key]) return // cannot grant what you don't hold
    setPerms(p => ({ ...p, [key]: !p[key] }))
  }

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      const r = await fetch('/api/operator-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: op.id, permissions: perms }),
      })
      const d = await r.json()
      if (!r.ok || d.error) { setMsg('Error: ' + (d.error || r.status)); setSaving(false); return }
      setMsg('✓ Saved')
      setTimeout(() => { setMsg(''); onClose() }, 800)
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px #00000030' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>🔐 Permissions</div>
            <div style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>{op.name || op.email}</div>
          </div>
          <button onClick={onClose} style={{ background: C.surface2, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.text2, fontSize: 13 }}>Close</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>Loading…</div>
        ) : (
          <>
            {PERM_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: (group as any).danger ? C.orange : C.text2, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{group.label}</div>
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{(group as any).note}</div>
                </div>
                <div style={{ background: C.surface2, borderRadius: 12, overflow: 'hidden' }}>
                  {group.items.map((item, i) => (
                    <div key={item.key} onClick={() => toggle(item.key)}
                      title={!canGrant(item.key) && !perms[item.key] ? 'You do not have this permission, so you cannot grant it' : undefined}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: (!canGrant(item.key) && !perms[item.key]) ? 'not-allowed' : 'pointer', opacity: (!canGrant(item.key) && !perms[item.key]) ? 0.45 : 1, borderBottom: i < group.items.length - 1 ? '1px solid ' + C.border : 'none', background: perms[item.key] ? '#f0fdf4' : C.surface2 }}>
                      <div style={{ minWidth: 0, paddingRight: 12 }}>
                        <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>
                          {item.label}{!canGrant(item.key) && !perms[item.key] ? ' 🔒' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{(item as any).hint}</div>
                      </div>
                      <div style={{ width: 40, height: 22, borderRadius: 11, background: perms[item.key] ? C.green : C.border2, position: 'relative' as const, transition: 'background .2s', flexShrink: 0 }}>
                        <div style={{ position: 'absolute' as const, top: 3, left: perms[item.key] ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {msg && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: msg.startsWith('✓') ? C.greenBg : C.redBg, color: msg.startsWith('✓') ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Locations Modal ─────────────────────────────────────────────
function LocationsModal({ op, onClose }: any) {
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editLoc, setEditLoc] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ name: '', address: '', lat: '', lng: '', geofence_radius_m: '100', is_office: false })

  const loadLocations = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/locations?owner_id=' + op.id + '&with_machines=1')
      const d = await r.json()
      setLocations(Array.isArray(d) ? d : [])
    } catch { }
    setLoading(false)
  }

  useEffect(() => { loadLocations() }, [op.id])

  const openAdd = () => {
    setForm({ name: '', address: '', lat: '', lng: '', geofence_radius_m: '100', is_office: false })
    setEditLoc(null); setShowForm(true); setMsg('')
  }

  const openEdit = (loc: any) => {
    setForm({
      name: loc.name || '', address: loc.address || '',
      lat: loc.lat != null ? String(loc.lat) : '',
      lng: loc.lng != null ? String(loc.lng) : '',
      geofence_radius_m: String(loc.geofence_radius_m || 100),
      is_office: loc.is_office || false,
    })
    setEditLoc(loc); setShowForm(true); setMsg('')
  }

  const save = async () => {
    if (!form.name.trim()) { setMsg('Name is required'); return }
    setSaving(true); setMsg('')
    try {
      const body: any = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        geofence_radius_m: parseInt(form.geofence_radius_m) || 100,
        is_office: form.is_office,
        owner_id: op.id,
      }
      let r
      if (editLoc) {
        r = await fetch('/api/locations?id=' + editLoc.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        r = await fetch('/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      const d = await r.json()
      if (!r.ok || d.error) { setMsg('Error: ' + (d.error || r.status)); setSaving(false); return }
      setMsg('✓ Saved'); await loadLocations()
      setTimeout(() => { setShowForm(false); setMsg('') }, 800)
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }

  const deleteLoc = async (loc: any) => {
    if (!confirm('Delete "' + loc.name + '"? Machines will be unassigned.')) return
    try {
      await fetch('/api/locations?id=' + loc.id, { method: 'DELETE' })
      await loadLocations()
    } catch (e: any) { setMsg('Delete failed: ' + e.message) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 580, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px #00000030' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>📍 Locations</div>
            <div style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>{op.name || op.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={openAdd} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Location</button>
            <button onClick={onClose} style={{ background: C.surface2, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.text2, fontSize: 13 }}>Close</button>
          </div>
        </div>

        {msg && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: msg.startsWith('✓') ? C.greenBg : C.redBg, color: msg.startsWith('✓') ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}

        {/* Add/Edit form */}
        {showForm && (
          <div style={{ background: C.surface2, borderRadius: 14, padding: 18, marginBottom: 18, border: '1px solid ' + C.border }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>{editLoc ? 'Edit Location' : 'New Location'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Location Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Boston Living Kondapur"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Latitude</label>
                <input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="e.g. 17.4485" type="number"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Longitude</label>
                <input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="e.g. 78.3908" type="number"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Geofence Radius (m)</label>
                <input value={form.geofence_radius_m} onChange={e => setForm({ ...form, geofence_radius_m: e.target.value })} type="number"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                <div onClick={() => setForm({ ...form, is_office: !form.is_office })}
                  style={{ width: 40, height: 22, borderRadius: 11, background: form.is_office ? C.green : C.border2, position: 'relative' as const, transition: 'background .2s', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ position: 'absolute' as const, top: 3, left: form.is_office ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </div>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>🏢 Office location</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editLoc ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Locations list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>Loading…</div>
        ) : locations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.text3, fontSize: 14 }}>No locations yet. Add one above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {locations.map((loc: any) => (
              <div key={loc.id} style={{ background: C.surface2, borderRadius: 12, padding: '14px 16px', border: '1px solid ' + C.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{loc.name}</span>
                      {loc.is_office && <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 8px', borderRadius: 20 }}>🏢 Office</span>}
                    </div>
                    {loc.address && <div style={{ fontSize: 12, color: C.text2, marginBottom: 4 }}>📍 {loc.address}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.text3 }}>
                      {loc.lat && <span>GPS: {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}</span>}
                      <span>Geofence: {loc.geofence_radius_m}m</span>
                      <span>🖥 {loc.machine_count || 0} machine{loc.machine_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <button onClick={() => openEdit(loc)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: C.text2, cursor: 'pointer' }}>✏️ Edit</button>
                    <button onClick={() => deleteLoc(loc)} style={{ background: C.redBg, border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: C.red, cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
                {/* Machine chips */}
                {loc.machines && loc.machines.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 8 }}>
                    {loc.machines.map((m: any) => (
                      <span key={m.id} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: m.status === 'online' ? C.greenBg : C.surface, color: m.status === 'online' ? C.green : C.text2, border: '1px solid ' + C.border, fontWeight: 600 }}>
                        🖥 {m.display_name || m.sn}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


// ─── My Team (operator manages their own sub-operators & field staff) ───
function MyTeamPage() {
  const [team, setTeam] = useState<any[]>([])
  const [myPerms, setMyPerms] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [permsFor, setPermsFor] = useState<any>(null)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/my-team')
      const d = await r.json()
      if (!r.ok || d.error) { setErr(d.error || 'Failed to load team'); setTeam([]) }
      else { setTeam(Array.isArray(d.team) ? d.team : []); setMyPerms(d.my_permissions || null) }
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const subOps = team.filter((t: any) => t.role === 'sub_operator')
  const staff = team.filter((t: any) => t.role === 'field_staff')

  const Row = ({ m }: any) => {
    const granted = m.permissions ? Object.keys(m.permissions).filter((k) => k.startsWith('can_') && m.permissions[k] === true).length : 0
    const isSub = m.role === 'sub_operator'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: '1px solid ' + C.border, background: C.surface }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: isSub ? '#e0f7fa' : '#fff3ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: isSub ? '#0891b2' : C.orange, flexShrink: 0 }}>
          {(m.name || m.email || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.name || '—'}</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 1 }}>{m.email}</div>
        </div>
        <Pill color={isSub ? '#0891b2' : C.orange} bg={isSub ? '#e0f7fa' : '#fff3ea'}>
          {isSub ? '🧑‍💼 Sub-Operator' : '👷 Field Staff'}
        </Pill>
        <span style={{ fontSize: 12, color: C.text3, minWidth: 92, textAlign: 'right' as const }}>{granted} permission{granted !== 1 ? 's' : ''}</span>
        {isSub && (
          <button onClick={() => setPermsFor(m)}
            style={{ background: '#f5f3ff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#7c3aed', cursor: 'pointer', flexShrink: 0 }}>
            🔐 Perms
          </button>
        )}
      </div>
    )
  }

  const Section = ({ title, rows, empty }: any) => (
    <div style={{ border: '1px solid ' + C.border, borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ padding: '11px 18px', background: C.surface2, fontSize: 12, fontWeight: 800, color: C.text2, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
        {title} <span style={{ color: C.text3, fontWeight: 600 }}>· {rows.length}</span>
      </div>
      {rows.length === 0
        ? <div style={{ padding: 26, textAlign: 'center' as const, color: C.text3, fontSize: 13, background: C.surface }}>{empty}</div>
        : rows.map((m: any) => <Row key={m.id} m={m} />)}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>My Team</div>
        <div style={{ fontSize: 13, color: C.text2, marginTop: 3 }}>
          People who work under your account. You can grant sub-operators any permission you hold yourself.
        </div>
      </div>

      {err && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: C.redBg, color: C.red, fontSize: 13, fontWeight: 600 }}>{err}</div>}

      {loading ? (
        <div style={{ textAlign: 'center' as const, padding: 60, color: C.text3 }}>Loading team…</div>
      ) : (
        <>
          <Section title="Sub-Operators" rows={subOps} empty="No sub-operators yet. Ask Fruitlink to add one under your account." />
          <Section title="Field Staff" rows={staff} empty="No field staff yet." />
          <div style={{ fontSize: 12, color: C.text3, padding: '0 2px' }}>
            🔒 A permission you don&rsquo;t hold yourself is locked and cannot be granted.
          </div>
        </>
      )}

      {permsFor && <PermissionsModal op={permsFor} limitTo={myPerms || {}} onClose={() => { setPermsFor(null); load() }} />}
    </div>
  )
}

function OperatorsPage({ myId }: any) {
  const [operators, setOperators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editOp, setEditOp] = useState<any>(null)
  const [delOp, setDelOp] = useState<any>(null)
  const [assignOp, setAssignOp] = useState<any>(null)
  const [permissionsOp, setPermissionsOp] = useState<any>(null)
  const [locationsOp, setLocationsOp] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operator', state: 'Telangana', country: 'India', owner_id: '', company_name: '', billing_address: '', gstin: '', pincode: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const J = { 'Content-Type': 'application/json' }
  // Roles that must belong to a parent operator
  const NEEDS_PARENT = ['sub_operator', 'field_staff']
  // Only true operators can be a parent
  const parentOperators = operators.filter((o: any) => o.role === 'operator')
  const fetchOperators = async () => {
    setLoading(true)
    const res = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?select=id,name,email,role,state,country,owner_id,company_name,billing_address,gstin,pincode,phone,created_at&order=created_at.desc'))
    const data = await res.json()
    setOperators(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { fetchOperators() }, [])
  const openAdd = () => { setForm({ name: '', email: '', password: '', role: 'operator', state: 'Telangana', country: 'India', owner_id: '', company_name: '', billing_address: '', gstin: '', pincode: '', phone: '' }); setEditOp(null); setShowAdd(true); setMsg('') }
  const openEdit = (op: any) => { setForm({ name: op.name || '', email: op.email, password: '', role: op.role, state: op.state || '', country: op.country || 'India', owner_id: op.owner_id || '', company_name: op.company_name || '', billing_address: op.billing_address || '', gstin: op.gstin || '', pincode: op.pincode || '', phone: op.phone || '' }); setEditOp(op); setShowAdd(true); setMsg('') }
  const saveOperator = async () => {
    if (NEEDS_PARENT.includes(form.role) && !form.owner_id) {
      setMsg('Please select the parent operator for this role'); return
    }
    if (form.role === 'operator') {
      if (!form.company_name.trim()) { setMsg('Registered company name is required for an operator'); return }
      if (!form.billing_address.trim()) { setMsg('Billing address is required for an operator'); return }
      if (!form.pincode.trim()) { setMsg('Pincode is required for an operator'); return }
      if (!form.phone.trim()) { setMsg('Phone is required for an operator'); return }
    }
    setSaving(true); setMsg('')
    try {
      if (editOp) {
        const body: any = { name: form.name, role: form.role, state: form.state, country: form.country, owner_id: NEEDS_PARENT.includes(form.role) ? (form.owner_id || null) : null, company_name: form.company_name.trim() || null, billing_address: form.billing_address.trim() || null, gstin: form.gstin.trim().toUpperCase() || null, pincode: form.pincode.trim() || null, phone: form.phone.trim() || null }
        if (form.password) {
          const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: J, body: JSON.stringify({ password: form.password }) })
          if (hashRes.ok) { const { hash } = await hashRes.json(); body.password_hash = hash }
        }
        const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?id=eq.' + editOp.id), { method: 'PATCH', headers: J, body: JSON.stringify(body) })
        if (!r.ok) { const t = await r.text().catch(() => ''); setMsg('Error: ' + (t || r.status)); setSaving(false); return }
        setMsg('✓ Updated')
      } else {
        const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: J, body: JSON.stringify({ password: form.password }) })
        const { hash } = await hashRes.json()
        const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators'), { method: 'POST', headers: { ...J, Prefer: 'return=minimal' }, body: JSON.stringify({ name: form.name, email: form.email, password_hash: hash, role: form.role, state: form.state, country: form.country, owner_id: NEEDS_PARENT.includes(form.role) ? (form.owner_id || null) : null, company_name: form.company_name.trim() || null, billing_address: form.billing_address.trim() || null, gstin: form.gstin.trim().toUpperCase() || null, pincode: form.pincode.trim() || null, phone: form.phone.trim() || null }) })
        if (!r.ok) { const t = await r.text().catch(() => ''); setMsg('Error: ' + (t || r.status)); setSaving(false); return }
        setMsg('✓ Added')
      }
      await fetchOperators()
      setTimeout(() => { setShowAdd(false); setMsg('') }, 900)
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }
  const deleteOperator = async () => {
    if (!delOp) return
    // Guard: never allow deleting yourself, or the last remaining super admin
    if (delOp.id === myId) { setMsg('You cannot delete your own account while logged in.'); return }
    if (delOp.role === 'super_admin' && operators.filter(o => o.role === 'super_admin').length <= 1) {
      setMsg('Cannot delete the last Super Admin — at least one must remain.'); return
    }
    const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?id=eq.' + delOp.id), { method: 'DELETE', headers: J })
    if (!r.ok) { const t = await r.text().catch(() => ''); setMsg('Delete failed: ' + (t || r.status)); return }
    setDelOp(null); fetchOperators()
  }

  const ROLE_COLOR: any = { super_admin: '#7c3aed', operator: C.blue, sub_operator: '#0891b2', field_staff: C.orange }
  const ROLE_BG: any = { super_admin: '#f5f3ff', operator: C.blueBg, sub_operator: '#e0f7fa', field_staff: '#fff3ea' }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Operators</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{operators.length} operator{operators.length !== 1 ? 's' : ''} registered</div>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13, boxShadow: '0 2px 8px #f9731640' }}>
          + Add Operator
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Operators', value: operators.length, color: C.blue, icon: '👥' },
          { label: 'Super Admins', value: operators.filter(o => o.role === 'super_admin').length, color: '#7c3aed', icon: '👑' },
          { label: 'Operators', value: operators.filter(o => o.role === 'operator').length, color: C.green, icon: '🧑‍💼' },
          { label: 'Sub-Operators', value: operators.filter(o => o.role === 'sub_operator').length, color: '#0891b2', icon: '🧑‍💻' },
          { label: 'Field Staff', value: operators.filter(o => o.role === 'field_staff').length, color: C.orange, icon: '👷' },
        ].map(s => (
<div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: C.text2, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading...</div>
      ) : (
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table className="fl-stack" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surface2, borderBottom: `2px solid ${C.border}` }}>
                {['Operator', 'Email', 'Role', 'Region', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.text3, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.09em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operators.map((op, i) => (
                <tr key={op.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : C.surface2 }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {(op.name || op.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: C.text }}>{op.name || '—'}</div>
                        <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace' }}>{op.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', color: C.text }}>{op.email}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <Pill color={ROLE_COLOR[op.role] || C.text2} bg={ROLE_BG[op.role] || C.surface2}>
                      {op.role === 'super_admin' ? '👑 Super Admin' : op.role === 'field_staff' ? '👷 Field Staff' : op.role === 'sub_operator' ? '🧑‍💼 Sub-Operator' : '🧑‍💼 Operator'}
                    </Pill>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontSize: 13, color: C.text }}>{op.state || '—'}</div>
                    <div style={{ fontSize: 12, color: C.text3 }}>{op.country}</div>
                  </td>
                  <td style={{ padding: '13px 16px', color: C.text3, fontSize: 12 }}>
                    {op.created_at ? new Date(op.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {op.role === 'operator' && <button onClick={() => setAssignOp(op)} style={{ background: C.blueBg, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.blue, cursor: 'pointer' }}>🖥 Machines</button>}
                      <button onClick={() => setPermissionsOp(op)} style={{ background: '#f5f3ff', border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}>🔐 Perms</button>
                      <button onClick={() => setLocationsOp(op)} style={{ background: C.greenBg, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.green, cursor: 'pointer' }}>📍 Locations</button>
                      <button onClick={() => openEdit(op)} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.text2, cursor: 'pointer' }}>✏️ Edit</button>
                      <button onClick={() => { setMsg(''); setDelOp(op) }} style={{ background: C.redBg, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.red, cursor: 'pointer' }}>🗑 Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 30, width: 460, boxShadow: '0 20px 60px #00000030' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 20 }}>{editOp ? 'Edit Operator' : 'Add New Operator'}</div>
            {[
              { label: 'Full Name', key: 'name', type: 'text', placeholder: 'e.g. Ravi Kumar' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'ravi@fruitlink.in', disabled: !!editOp },
              { label: editOp ? 'New Password (blank = keep)' : 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} disabled={f.disabled}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: f.disabled ? C.surface2 : '#fff', color: C.text, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: C.surface, color: C.text }}>
                  <option value="operator">Operator</option>
                  <option value="sub_operator">Sub-Operator</option>
                  <option value="field_staff">Field Staff</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>State</label>
                <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Telangana"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
              </div>
            </div>
            {form.role === 'operator' && (<>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Registered Company Name *</label>
                <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Fruitlinq Agro Private Limited"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Billing Address *</label>
                <input value={form.billing_address} onChange={e => setForm({ ...form, billing_address: e.target.value })} placeholder="Full registered address with pincode"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>GSTIN (optional)</label>
                <input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="e.g. 36ABCDE1234F1Z5"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text, textTransform: 'uppercase' as const }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Pincode *</label>
                  <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} placeholder="500045"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Phone *</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 90000 00000"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
                </div>
              </div>
            </>)}
            {NEEDS_PARENT.includes(form.role) && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Belongs To (Parent Operator) *</label>
                <select value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: C.surface, color: C.text }}>
                  <option value="">— Select operator —</option>
                  {parentOperators.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.name || o.email}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 5 }}>
                  {form.role === 'sub_operator' ? 'Sub-operators manage this operator\u2019s machines.' : 'Field staff log visits for this operator\u2019s machines.'}
                </div>
              </div>
            )}
            {msg && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: msg.startsWith('✓') ? C.greenBg : C.redBg, color: msg.startsWith('✓') ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={saveOperator} disabled={saving} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editOp ? 'Update' : 'Add Operator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignOp && <AssignMachinesModal op={assignOp} onClose={() => setAssignOp(null)} />}
      {permissionsOp && <PermissionsModal op={permissionsOp} onClose={() => setPermissionsOp(null)} />}
      {locationsOp && <LocationsModal op={locationsOp} onClose={() => setLocationsOp(null)} />}

      {delOp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 30, width: 360, textAlign: 'center', boxShadow: '0 20px 60px #00000030' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 6 }}>Delete Operator?</div>
            <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Permanently delete <b>{delOp.name || delOp.email}</b>. Cannot be undone.</div>
            {msg && <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: C.redBg, color: C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDelOp(null)} style={{ padding: '9px 22px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={deleteOperator} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.red, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Settings Page ───────────────────────────────────────────────


function MachineConfigSection({ role, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const canEdit = role === 'super_admin'
  const [machines, setMachines] = useState<any[]>([])
  const [config, setConfig] = useState<Record<string, any>>({})

  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,status,location,state'), {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setMachines(Array.isArray(d) ? d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true }) : [])
        const c: Record<string, any> = {}
        d.forEach((m: any) => {
          try {
            const st = m.state ? JSON.parse(m.state) : {}
            const mc = st.machine_config || {}
            c[m.id] = {
              price_200ml: mc.price_200ml ?? 80,
              price_250ml: mc.price_250ml ?? 100,
              price_300ml: mc.price_300ml ?? 120,
              default_volume: mc.default_volume ?? 250,
              max_daily_cups: mc.max_daily_cups ?? 200,
              maintenance_mode: mc.maintenance_mode ?? false
            }
          } catch {
            c[m.id] = {
              price_200ml: 80, price_250ml: 100, price_300ml: 120,
              default_volume: 250, max_daily_cups: 200, maintenance_mode: false
            }
          }
        })
        setConfig(c)
      }
    })
  }, [])

  const save = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
      const hg = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
        await Promise.all(machines.map(async (m: any) => {
        // Merge pricing/volume into existing machine_config so thresholds & notifications survive
        const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id + '&select=state'), { headers: hg }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
        let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
        const mc = st.machine_config || {}
        const incoming = config[m.id] || {}
        st.machine_config = { ...mc, ...incoming }
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id), { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify(st) }) })
      }))
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Machine Config</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Remote pricing and volume settings{canEdit ? ' — changes apply instantly, no engineer visit needed' : ' · view only'}</div>
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.blueBg, border: '1px solid ' + C.blue + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 16 }}>
          🔒 Pricing and machine settings are managed by the Super Admin. You can view them but not change them.
        </div>
      )}

      {machines.map((m: any) => (
        <div key={m.id} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: m.status === 'online' ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {m.status === 'online' ? '🟢' : '🔴'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.display_name}</div>
              <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace' }}>{m.sn} · {m.location}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: C.text2 }}>Maintenance mode</span>
              <div onClick={() => canEdit && setConfig({ ...config, [m.id]: { ...config[m.id], maintenance_mode: !config[m.id]?.maintenance_mode } })}
                style={{ width: 36, height: 20, borderRadius: 10, background: config[m.id]?.maintenance_mode ? C.red : C.border2, cursor: canEdit ? 'pointer' : 'not-allowed', position: 'relative' as const, transition: 'background .2s', flexShrink: 0, opacity: canEdit ? 1 : 0.6 }}>
                <div style={{ position: 'absolute' as const, top: 2, left: config[m.id]?.maintenance_mode ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Cup Pricing (₹)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[['200ml', 'price_200ml'], ['250ml', 'price_250ml'], ['300ml', 'price_300ml']].map(([label, key]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 11, color: C.text2, marginBottom: 4, fontWeight: 600 }}>{label}</label>
                  <div style={{ position: 'relative' as const }}>
                    <span style={{ position: 'absolute' as const, left: 9, top: 9, fontSize: 12, color: C.text3, fontWeight: 600 }}>₹</span>
                    <input type="number" value={config[m.id]?.[key] ?? ''} disabled={!canEdit} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], [key]: +e.target.value } })}
                      style={{ width: '100%', padding: '8px 8px 8px 22px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Default Cup Size</label>
              <select value={config[m.id]?.default_volume ?? 250} disabled={!canEdit} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], default_volume: +e.target.value } })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'pointer' : 'not-allowed' }}>
                {[200, 250, 300].map(v => <option key={v} value={v}>{v}ml</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Max Daily Cups</label>
              <input type="number" value={config[m.id]?.max_daily_cups ?? 200} disabled={!canEdit} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], max_daily_cups: +e.target.value } })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
            </div>
          </div>
        </div>
      ))}

      {canEdit && <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saved ? '✓ Saved!' : '⚡ Apply Config Remotely'}
      </button>}
      <div style={{ marginTop: 10, fontSize: 11, color: C.text3 }}>Changes take effect on next machine sync cycle (~2 min)</div>
    </div>
  )
}

function ThresholdsSection({ role, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const canEdit = role === 'super_admin'
  const [machines, setMachines] = useState<any[]>([])
  const [thresholds, setThresholds] = useState<Record<string, any>>({})
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,state'))
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          const visible = d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true })
          setMachines(visible)
          const t: Record<string, any> = {}
          visible.forEach((m: any) => {
            let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {}
            const th = (st.machine_config && st.machine_config.thresholds) || {}
            t[m.id] = { temp_high: th.temp_high ?? 16, temp_low: th.temp_low ?? 2, temp_stop: th.temp_stop ?? 20 }
          })
          setThresholds(t)
        }
      })
  }, [])
  const save = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const h = { ...headers, Prefer: 'return=minimal' }
      await Promise.all(machines.map(async (m: any) => {
        // Merge thresholds into existing machine_config without wiping other keys
        const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id + '&select=state'), { headers }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
        let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
        const mc = st.machine_config || {}
        mc.thresholds = thresholds[m.id] || {}
        st.machine_config = mc
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id), { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify(st) }) })
      }))
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Thresholds</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Temperature alert thresholds per machine{!canEdit && ' · view only'}</div>
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.blueBg, border: '1px solid ' + C.blue + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 16 }}>
          🔒 These values are managed by the Super Admin. You can view them but not change them.
        </div>
      )}
      {machines.map(m => (
        <div key={m.id} style={{ marginBottom: 18, padding: 16, background: C.surface2, borderRadius: 12, border: '1px solid ' + C.border }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>{m.display_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Temp High Alert (°C)', key: 'temp_high', desc: 'Alert when above this' },
              { label: 'Temp Low Alert (°C)', key: 'temp_low', desc: 'Alert when below this' },
              { label: 'Temp Stop Selling (°C)', key: 'temp_stop', desc: 'Stop vending above this' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</label>
                <input type="number" value={thresholds[m.id]?.[f.key] ?? ''} disabled={!canEdit} onChange={e => setThresholds({ ...thresholds, [m.id]: { ...thresholds[m.id], [f.key]: +e.target.value } })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
                <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {canEdit && <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Thresholds'}</button>}
    </div>
  )
}

function NotificationsSection({ role, operatorId, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const canEdit = role === 'super_admin'
  const DEFAULT_ALERTS: Record<string, boolean> = {
    machine_offline: true, temperature_high: true, temperature_low: true,
    temperature_stop: true, stock_empty: true, stock_low: false,
    door_open: true, vend_failure: true, cup_empty: true, film_empty: true,
    waste_bin_full: true, power_loss: true, unusual_access: true,
  }
  const [phone, setPhone] = useState('')
  const [emails, setEmails] = useState('')
  const [telegramIds, setTelegramIds] = useState('')
  const [alerts, setAlerts] = useState<Record<string, boolean>>(DEFAULT_ALERTS)
  const [channels, setChannels] = useState<Record<string, boolean>>({ telegram: true, whatsapp: true, email: true })
  const [primaryId, setPrimaryId] = useState<string>('')
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,state&order=created_at.asc&limit=1'))
      .then(r => r.json()).then(d => {
        if (Array.isArray(d) && d[0]) {
          setPrimaryId(d[0].id)
          let st: any = {}; try { st = typeof d[0].state === 'string' ? JSON.parse(d[0].state || '{}') : (d[0].state || {}) } catch (e) {}
          const n = (st.machine_config && st.machine_config.notifications) || {}
          if (n.phone) setPhone(n.phone)
          if (n.telegram_chat_ids) setTelegramIds(Array.isArray(n.telegram_chat_ids) ? n.telegram_chat_ids.join(', ') : String(n.telegram_chat_ids))
          if (n.emails) setEmails(Array.isArray(n.emails) ? n.emails.join(', ') : String(n.emails)); else if (n.email) setEmails(String(n.email))
          if (n.alerts) setAlerts({ ...DEFAULT_ALERTS, ...n.alerts })
          if (n.channels) setChannels({ telegram: true, whatsapp: true, email: true, ...n.channels })
        }
      })
  }, [])
  const save = async () => {
    if (!canEdit || !primaryId) return
    setSaving(true)
    try {
      const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + primaryId + '&select=state'), { headers }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
      let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
      const mc = st.machine_config || {}
      mc.notifications = { phone, emails: emails.split(',').map(s => s.trim()).filter(Boolean), telegram_chat_ids: telegramIds.split(',').map(s => s.trim()).filter(Boolean), alerts, channels }
      st.machine_config = mc
      await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + primaryId), { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ state: JSON.stringify(st) }) })
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Notifications</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>WhatsApp alert notifications{!canEdit && ' · view only'}</div>
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.blueBg, border: '1px solid ' + C.blue + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 16 }}>
          🔒 These values are managed by the Super Admin. You can view them but not change them.
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>WhatsApp Number</label>
        <input value={phone} disabled={!canEdit} onChange={e => setPhone(e.target.value)} placeholder="+91 89771 10142"
          style={{ width: '100%', maxWidth: 300, padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
        <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Alerts will be sent via Twilio WhatsApp</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Alert Email(s)</label>
        <input value={emails} disabled={!canEdit} onChange={e => setEmails(e.target.value)} placeholder="ops@fruitlinktech.in, owner@fruitlinktech.in"
          style={{ width: '100%', maxWidth: 420, padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
        <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Comma-separated. Sent via Resend. Leave blank to use the default address.</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Telegram Chat IDs</label>
        <input value={telegramIds} disabled={!canEdit} onChange={e => setTelegramIds(e.target.value)} placeholder="8562917946, 8977110142"
          style={{ width: '100%', maxWidth: 420, padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
        <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Comma-separated Telegram user/group IDs. Message @userinfobot on Telegram to get your ID.</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Channels</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
          {[['telegram', 'Telegram', '✈️'], ['whatsapp', 'WhatsApp', '💬'], ['email', 'Email', '✉️']].map(([key, label, icon]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: channels[key] ? C.orangeBg : C.surface2, border: '1px solid ' + (channels[key] ? C.orange : C.border), borderRadius: 10, cursor: canEdit ? 'pointer' : 'not-allowed', minWidth: 140 }}>
              <input type="checkbox" checked={channels[key] !== false} disabled={!canEdit} onChange={e => setChannels({ ...channels, [key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: C.orange }} />
              <span style={{ fontSize: 16 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
                <div style={{ fontSize: 11, color: C.text3 }}>{channels[key] !== false ? 'On' : 'Off'}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>Turn whole channels on/off. Individual alert types are controlled below.</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Alert Types</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Object.entries(alerts).map(([key, val]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: val ? C.orangeBg : C.surface2, border: '1px solid ' + (val ? C.orange : C.border), borderRadius: 10, cursor: canEdit ? 'pointer' : 'not-allowed' }}>
              <input type="checkbox" checked={val} disabled={!canEdit} onChange={e => setAlerts({ ...alerts, [key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: C.orange }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{key.replace(/_/g, ' ').replace(/\w/g, l => l.toUpperCase())}</div>
                <div style={{ fontSize: 12, color: C.text3 }}>{val ? 'Enabled' : 'Disabled'}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      {canEdit && <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Notifications'}</button>}
    </div>
  )
}

function CooldownsSection({ role, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const canEdit = role === 'super_admin'
  // The 17 standard alert types + their default cooldown hours and severity.
  const DEFAULTS: { type: string, label: string, severity: string, hours: number }[] = [
    { type: 'machine_offline', label: 'Machine Offline', severity: 'CRITICAL', hours: 1 },
    { type: 'temperature_high', label: 'High Temperature', severity: 'CRITICAL', hours: 1 },
    { type: 'temperature_low', label: 'Low Temperature', severity: 'HIGH', hours: 2 },
    { type: 'temperature_stop', label: 'Temp Stop Selling', severity: 'CRITICAL', hours: 1 },
    { type: 'stock_empty_l1', label: 'Layer 1 Empty', severity: 'HIGH', hours: 4 },
    { type: 'stock_empty_l2', label: 'Layer 2 Empty', severity: 'HIGH', hours: 4 },
    { type: 'stock_empty_l3', label: 'Layer 3 Empty', severity: 'HIGH', hours: 4 },
    { type: 'stock_low_l1', label: 'Layer 1 Low', severity: 'MEDIUM', hours: 6 },
    { type: 'stock_low_l2', label: 'Layer 2 Low', severity: 'MEDIUM', hours: 6 },
    { type: 'stock_low_l3', label: 'Layer 3 Low', severity: 'MEDIUM', hours: 6 },
    { type: 'door_open', label: 'Door Open', severity: 'HIGH', hours: 1 },
    { type: 'vend_failure', label: 'Vend Failure', severity: 'HIGH', hours: 0.5 },
    { type: 'cup_empty', label: 'Cups Empty', severity: 'HIGH', hours: 2 },
    { type: 'film_empty', label: 'Film Empty', severity: 'HIGH', hours: 2 },
    { type: 'waste_bin_full', label: 'Waste Bin Full', severity: 'HIGH', hours: 4 },
    { type: 'power_loss', label: 'Power Loss', severity: 'CRITICAL', hours: 0.5 },
    { type: 'unusual_access', label: 'Unusual Cabinet Access', severity: 'HIGH', hours: 1 },
  ]
  const SEV_COLOR: any = { CRITICAL: C.red, HIGH: C.amber, MEDIUM: C.blue }
  const SEV_BG: any = { CRITICAL: C.redBg, HIGH: C.amberBg, MEDIUM: C.blueBg }
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }

  const [machines, setMachines] = useState<any[]>([])
  const [cooldowns, setCooldowns] = useState<Record<string, any>>({})
  const [openM, setOpenM] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,state'))
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          const visible = d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true })
          setMachines(visible)
          const c: Record<string, any> = {}
          visible.forEach((m: any) => {
            let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {}
            const saved = (st.machine_config && st.machine_config.cooldowns) || {}
            const row: Record<string, number> = {}
            DEFAULTS.forEach(d => { row[d.type] = Number.isFinite(saved[d.type]) ? saved[d.type] : d.hours })
            c[m.id] = row
          })
          setCooldowns(c)
        }
      })
  }, [])

  const save = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const h = { ...headers, Prefer: 'return=minimal' }
      await Promise.all(machines.map(async (m: any) => {
        const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id + '&select=state'), { headers }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
        let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
        const mc = st.machine_config || {}
        mc.cooldowns = cooldowns[m.id] || {}
        st.machine_config = mc
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id), { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify(st) }) })
      }))
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }

  const setVal = (mid: string, type: string, v: number) => setCooldowns(prev => ({ ...prev, [mid]: { ...prev[mid], [type]: v } }))
  const resetMachine = (mid: string) => { const row: Record<string, number> = {}; DEFAULTS.forEach(d => row[d.type] = d.hours); setCooldowns(prev => ({ ...prev, [mid]: row })) }

  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Alert Cooldowns</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>How long before the same alert can fire again, per machine{!canEdit && ' · view only'}. Lower = more frequent reminders; higher = less spam.</div>
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.blueBg, border: '1px solid ' + C.blue + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 16 }}>
          🔒 Cooldowns are managed by the Super Admin. You can view them but not change them.
        </div>
      )}
      {machines.map(m => {
        const isOpen = openM[m.id] === true
        return (
          <div key={m.id} style={{ marginBottom: 14, background: C.surface, borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden' }}>
            <div onClick={() => setOpenM(prev => ({ ...prev, [m.id]: !isOpen }))}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer', background: C.surface2, userSelect: 'none' as const, borderBottom: isOpen ? '1px solid ' + C.border : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                <div style={{ fontSize: 11, color: C.text3, fontFamily: 'monospace', marginTop: 1 }}>{m.sn}</div>
              </div>
              {canEdit && isOpen && <button onClick={(e) => { e.stopPropagation(); resetMachine(m.id) }} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.text2, cursor: 'pointer' }}>↺ Reset to defaults</button>}
              <span style={{ fontSize: 16, color: C.text3, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
            </div>
            {isOpen && (
              <div style={{ padding: '14px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {DEFAULTS.map(d => (
                    <div key={d.type} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.surface2, borderRadius: 9, border: '1px solid ' + C.border }}>
                      <span style={{ background: SEV_BG[d.severity], color: SEV_COLOR[d.severity], padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{d.severity}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{d.label}</div>
                        <div style={{ fontSize: 10.5, color: C.text3, fontFamily: 'monospace' }}>{d.type}</div>
                      </div>
                      <input type="number" step="0.5" min="0" value={cooldowns[m.id]?.[d.type] ?? d.hours} disabled={!canEdit}
                        onChange={e => setVal(m.id, d.type, parseFloat(e.target.value))}
                        style={{ width: 64, padding: '6px 8px', borderRadius: 7, border: '1px solid ' + C.border, fontSize: 13, textAlign: 'right', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed' }} />
                      <span style={{ fontSize: 12, color: C.text3, flexShrink: 0 }}>h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {canEdit && <button onClick={save} disabled={saving} style={{ marginTop: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Cooldowns'}</button>}
      <div style={{ marginTop: 10, fontSize: 11, color: C.text3 }}>Changes apply on the next alert cycle (~2 min). Cooldown = minimum gap before the same alert repeats for that machine.</div>
    </div>
  )
}

function StockTuningSection({ role, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
  const [machines, setMachines] = useState<any[]>([])
  const [tune, setTune] = useState<Record<string, any>>({})
  const DEF = { box_kg: 15, count: 100, capacity: 310, tare_g: 235, service_level: 90, open_hour: 9, close_hour: 22 }
  const hourLabel = (h: number) => h === 24 || h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? (h - 12) + ' PM' : h + ' AM'

  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,state'), { headers })
      .then(r => r.json()).then(d => {
        if (!Array.isArray(d)) return
        const visible = d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true })
        setMachines(visible)
        const t: Record<string, any> = {}
        visible.forEach((m: any) => {
          let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {}
          const s = (st.machine_config && st.machine_config.stock_tuning) || {}
          t[m.id] = { ...DEF, ...s }
        })
        setTune(t)
      })
  }, [])

  const setV = (mid: string, k: string, v: any) => setTune(prev => ({ ...prev, [mid]: { ...prev[mid], [k]: v } }))

  const save = async () => {
    setSaving(true)
    try {
      const h = { ...headers, Prefer: 'return=minimal' }
      await Promise.all(machines.map(async (m: any) => {
        const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id + '&select=state'), { headers }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
        let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
        const mc = st.machine_config || {}
        mc.stock_tuning = tune[m.id] || DEF
        st.machine_config = mc
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id), { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify(st) }) })
      }))
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }

  const gpo = (t: any) => t && t.count > 0 ? Math.round((Number(t.box_kg || 15) * 1000) / Number(t.count)) : '—'
  const lbl: any = { display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const inputStyle: any = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, background: C.surface, boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Fruit &amp; Stock Tuning</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 18 }}>Tells the Console how to turn machine weight and sales into oranges, cups, runway and restock numbers. Set these to the box <b>count</b> you load — the panel does the rest.</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 14px', background: C.orangeBg, border: '1px solid ' + C.orange + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 18 }}>
        🍊 <div>Oranges come in a 15 kg box. The <b>count</b> is how many are in it (printed on the box). Lower count (<b>88</b>) = bigger oranges = about <b>4</b> per 250 ml cup. Higher count (<b>100</b>) = smaller = about <b>5</b> per cup. Set both and the maths follows your fruit.</div>
      </div>
      {machines.map((m: any) => {
        const t = tune[m.id] || DEF
        return (
          <div key={m.id} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{m.display_name}</div>
            <div style={{ fontSize: 11.5, color: C.text3, fontFamily: 'monospace', marginBottom: 14 }}>{m.sn}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>Box weight (kg)</label><input type="number" value={t.box_kg ?? ''} onChange={e => setV(m.id, 'box_kg', e.target.value === '' ? '' : +e.target.value)} style={inputStyle} /></div>
              <div><label style={lbl}>Orange count / box</label><input type="number" value={t.count ?? ''} onChange={e => setV(m.id, 'count', e.target.value === '' ? '' : +e.target.value)} style={inputStyle} /><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>≈ {gpo(t)} g per orange</div></div>
              <div><label style={lbl}>Oranges per 250 ml cup</label><div style={{ ...inputStyle, background: C.surface2, color: C.text2, display: 'flex', alignItems: 'center', fontWeight: 700 }}>{(Number(t.count) > 0 ? Number(t.count) : 100) <= 88 ? 4 : 5} per cup</div><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Follows the count · 80 or 88 → 4 · larger → 5</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <div><label style={lbl}>Machine capacity (oranges)</label><input type="number" value={t.capacity ?? ''} onChange={e => setV(m.id, 'capacity', e.target.value === '' ? '' : +e.target.value)} style={inputStyle} /><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Most it physically holds. F3/4/5 ≈ 310 · F1/2 ≈ 500</div></div>
              <div><label style={lbl}>Empty tray weight (g)</label><input type="number" value={t.tare_g ?? ''} onChange={e => setV(m.id, 'tare_g', e.target.value === '' ? '' : +e.target.value)} style={inputStyle} /><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Subtracted from scale</div></div>
              <div><label style={lbl}>Service level</label>
                <select value={t.service_level ?? 90} onChange={e => setV(m.id, 'service_level', +e.target.value)} style={inputStyle}>
                  {[['85', '85% — leaner buffer'], ['90', '90% — balanced'], ['95', '95% — safer']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Restock safety margin</div></div>
              <div><label style={lbl}>Open / close hour</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={t.open_hour ?? 9} onChange={e => setV(m.id, 'open_hour', +e.target.value)} style={{ ...inputStyle, padding: '9px 6px' }}>{Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
                  <select value={t.close_hour ?? 22} onChange={e => setV(m.id, 'close_hour', +e.target.value)} style={{ ...inputStyle, padding: '9px 6px' }}>{Array.from({ length: 24 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
                </div><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Machine running hours</div></div>
            </div>
          </div>
        )
      })}
      <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Fruit & Stock Settings'}</button>
      <div style={{ marginTop: 10, fontSize: 11, color: C.text3 }}>The Console reads these on its next refresh (~2 min) or when reopened.</div>
    </div>
  )
}

function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [active, setActive] = useState('machine_config')
  const role = getCookie('fl_role') || 'operator'
  const operatorId = getCookie('fl_operator_id') || ''

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const showErr = () => { setErr(true); setTimeout(() => setErr(false), 3000) }

  const tabs = [
    { id: 'machine_config', label: 'Machine Config', icon: '⚙️' },
    { id: 'thresholds', label: 'Thresholds', icon: '🌡️' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'cooldowns', label: 'Alert Cooldowns', icon: '⏱️' },
    { id: 'stock', label: 'Fruit & Stock', icon: '🍊' },
    { id: 'billing', label: 'Billing', icon: '💳' },
    ...(role === 'super_admin' ? [{ id: 'danger', label: 'Danger Zone', icon: '⚠️' }] : []),
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      {saved && <div style={{ position: 'fixed', top: 20, right: 24, background: C.green, color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, zIndex: 9999 }}>✓ Saved!</div>}
      {err && <div style={{ position: 'fixed', top: 20, right: 24, background: C.red, color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, zIndex: 9999 }}>✗ Error saving</div>}
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 18 }}>Settings</div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' as const }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            style={{ padding: '7px 16px', borderRadius: 9, border: '1px solid ' + (active === t.id ? C.orange : C.border), background: active === t.id ? C.orange : C.surface, color: active === t.id ? '#fff' : C.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {active === 'machine_config' && <MachineConfigSection role={role} SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'thresholds' && <ThresholdsSection role={role} SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'notifications' && <NotificationsSection role={role} operatorId={operatorId} SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'cooldowns' && <CooldownsSection role={role} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'stock' && <StockTuningSection role={role} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'billing' && <BillingSection role={role} />}
      {active === 'danger' && role === 'super_admin' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.red, marginBottom: 16 }}>⚠️ Danger Zone</div>
          <div style={{ background: C.surface, border: '1px solid ' + C.red + '40', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>Destructive actions. Cannot be undone.</div>
            <button onClick={() => { if (confirm('Clear ALL alerts from database?')) { fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/alerts'), { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' } }).then(() => showSaved()).catch(() => showErr()) } }}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.red, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🗑️ Clear All Alerts
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


function BillingSection({ role }: any) {
  const [machines, setMachines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const PLANS: any = {
    starter: { name: 'Starter', color: C.green, bg: C.greenBg, icon: '🟢', features: ['Live Console + Machine List + Fleet Map','Revenue & P&L Analytics','17 WhatsApp alert types','Remote machine config','UPI + NFC payments (0% MDR)','Up to 2 operators'] },
    professional: { name: 'Professional', color: C.orange, bg: C.orangeBg, icon: '⭐', features: ['Everything in Starter','Ad Content Manager','Loyalty Programme','Operators Management + RBAC','Up to 10 operators'] },
    enterprise: { name: 'Enterprise', color: C.blue, bg: C.blueBg, icon: '🏢', features: ['Everything in Professional','REST API + Webhooks','SAML SSO','Dedicated infrastructure','Unlimited operators'] },
  }
  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,status,location,state'))
      .then(r => r.json()).then(d => { setMachines(Array.isArray(d) ? d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true }) : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 2 }}>Billing & Plans</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Manage subscription plan per machine</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 26 }}>
        {Object.entries(PLANS).map(([key, p]: any) => (
          <div key={key} style={{ background: C.surface, border: '2px solid ' + (key === 'professional' ? C.orange : C.border), borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ background: key === 'professional' ? C.orange : C.surface2, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: key === 'professional' ? '#fff' : C.text }}>{p.name}</span>
              </div>
              {key === 'professional' && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 8px' }}>POPULAR</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: p.color, fontWeight: 700, marginBottom: 10 }}>Pricing TBD per machine/month</div>
              {p.features.map((f: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: C.text2, marginBottom: 5 }}>
                  <span style={{ color: p.color, fontWeight: 700 }}>✓</span><span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Your Machines</div>
      {loading ? (
        <div style={{ color: C.text3 }}>Loading...</div>
      ) : machines.map((m: any) => (
        <div key={m.id} style={{ background: C.surface, border: '2px solid ' + (m.status === 'online' ? C.green + '50' : C.red + '50'), borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: 4, background: m.status === 'online' ? C.green : C.red }} />
          <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 16 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: m.status === 'online' ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖥️</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 4 }}>{m.display_name}</div>
                <div style={{ fontSize: 13, color: C.text2, fontFamily: 'monospace', marginBottom: 4 }}>SN: {m.sn}</div>
                <div style={{ fontSize: 13, color: C.text2 }}>{m.location || '--'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>Starter Plan</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => alert('Razorpay coming soon')} style={{ padding: '7px 16px', borderRadius: 9, border: '2px solid ' + C.orange, background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Upgrade to Professional</button>
                <button onClick={() => alert('Razorpay coming soon')} style={{ padding: '7px 16px', borderRadius: 9, border: '2px solid ' + C.blue, background: 'transparent', color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Upgrade to Enterprise</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PullToRefresh({ onRefresh, isMobile, children }: any) {
  const ref = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startX = useRef(0)
  const pullRef = useRef(0)
  const THRESHOLD = 70, MAX = 120, RESIST = 0.5

  useEffect(() => {
    const el = ref.current
    if (!el || !isMobile) return
    const setP = (v: number) => { pullRef.current = v; setPull(v) }
    const onStart = (e: TouchEvent) => {
      if (refreshing) { dragging.current = false; return }
      if (el.scrollTop <= 0) { dragging.current = true; startY.current = e.touches[0].clientY; startX.current = e.touches[0].clientX }
      else dragging.current = false
    }
    const onMove = (e: TouchEvent) => {
      if (!dragging.current || refreshing) return
      const dy = e.touches[0].clientY - startY.current
      const dx = e.touches[0].clientX - startX.current
      if (dy > 0 && Math.abs(dy) > Math.abs(dx) && el.scrollTop <= 0) {
        e.preventDefault()
        setP(Math.min(MAX, dy * RESIST))
      } else if (dy < 0) { dragging.current = false; setP(0) }
    }
    const onEnd = async () => {
      if (!dragging.current) return
      dragging.current = false
      if (pullRef.current >= THRESHOLD && !refreshing) {
        setRefreshing(true); setP(THRESHOLD)
        try { await onRefresh() } catch (e) {}
        setRefreshing(false); setP(0)
      } else setP(0)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [isMobile, refreshing, onRefresh])

  const prog = Math.min(1, pull / THRESHOLD)
  return (
    <div ref={ref} style={{ flex: 1, overflowY: 'auto', position: 'relative', WebkitOverflowScrolling: 'touch' } as any}>
      <div style={{
        position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 5, transform: 'translateY(' + (pull - 34) + 'px)',
        opacity: refreshing ? 1 : prog, transition: dragging.current ? 'none' : 'transform .25s ease, opacity .25s ease',
      }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.15)', display: 'grid', placeItems: 'center' }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%', border: '2px solid ' + C.border2, borderTopColor: C.orange,
            transform: refreshing ? 'none' : 'rotate(' + (pull * 4) + 'deg)',
            animation: refreshing ? 'fl-spin .7s linear infinite' : 'none',
          }} />
        </div>
      </div>
      <div style={{ transform: 'translateY(' + pull + 'px)', transition: dragging.current ? 'none' : 'transform .25s ease' }}>
        {children}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [active, setActive] = useState('console')
  const [machines, setMachines] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  const [role, setRole] = useState('operator')
  const [name, setName] = useState('Admin')
  const [operatorId, setOperatorId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [ready, setReady] = useState(false)
  // Attendance gate — Fruitlink staff must check in before using the dashboard
  const [attendanceOpen, setAttendanceOpen] = useState<any>(null)   // open row or null
  const [attnChecked, setAttnChecked] = useState(false)             // have we checked status yet
  const [attnBusy, setAttnBusy] = useState(false)
  const [attnPhoto, setAttnPhoto] = useState<Blob | null>(null)
  const [attnPhotoPreview, setAttnPhotoPreview] = useState('')
  const [attnErr, setAttnErr] = useState('')
  const attnFileRef = useRef<HTMLInputElement>(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [outPhoto, setOutPhoto] = useState<Blob | null>(null)
  const [outPreview, setOutPreview] = useState('')
  const outFileRef = useRef<HTMLInputElement>(null)
  const isStaff = (getCookie('fl_role') || '') === 'staff'
  useEffect(() => {
    setRole(getCookie('fl_role') || 'operator')
    setName(getCookie('fl_operator_name') || 'Admin')
    setOperatorId(getCookie('fl_operator_id') || '')
    setOwnerId(getCookie('fl_owner_id') || '')
    try {
      const raw = getCookie('fl_permissions')
      if (raw) setPermissions(JSON.parse(decodeURIComponent(raw)))
    } catch { setPermissions({}) }
    setReady(true)
    // Staff attendance gate: check if they're currently checked in
    const rr = getCookie('fl_role') || ''
    if (rr === 'staff') {
      fetch('/api/attendance?current=1', { cache: 'no-store' })
        .then(res => res.ok ? res.json() : null)
        .then(row => { setAttendanceOpen(row); setAttnChecked(true) })
        .catch(() => setAttnChecked(true))
    } else {
      setAttnChecked(true)
    }
    // Refresh permissions live from the server so super-admin changes apply without re-login
    const r = getCookie('fl_role') || ''
    if (r === 'operator' || r === 'sub_operator' || r === 'staff') {
      fetch('/api/operator-permissions?my=1', { cache: 'no-store' })
        .then(res => res.ok ? res.json() : null)
        .then(fresh => {
          if (fresh && typeof fresh === 'object' && !fresh.error) {
            const clean: Record<string, boolean> = {}
            Object.entries(fresh).forEach(([k, v]) => { if (k.startsWith('can_')) clean[k] = v === true })
            setPermissions(clean)
          }
        })
        .catch(() => {})
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    let machineIds: string[] = []
    // Fruitlink internal staff service the whole fleet — treat like super_admin for data scope
    const seesAllMachines = role === 'super_admin' || role === 'staff';
    const effectiveOpId = role === 'sub_operator' ? (ownerId || operatorId) : operatorId;
    if (!seesAllMachines && effectiveOpId) {
      const moRes = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machine_operators?operator_id=eq.' + effectiveOpId + '&select=machine_id'), { headers })
      const moData = await moRes.json()
      machineIds = Array.isArray(moData) ? moData.map((r: any) => r.machine_id) : []
    }
    const idFilter = machineIds.length > 0 ? '&id=in.(' + machineIds.join(',') + ')' : (!seesAllMachines ? '&id=eq.none' : '')
    const alertFilter = machineIds.length > 0 ? '&machine_id=in.(' + machineIds.join(',') + ')' : (!seesAllMachines ? '&machine_id=eq.none' : '')

    // Staff use /api/sb for machines (allows fleet-wide read); others use /api/machines
    const machinesFetch = role === 'staff'
      ? fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=*&order=created_at.asc' + idFilter), { headers })
      : fetch('/api/machines?select=*&order=created_at.asc' + idFilter);
    const [mRes, aRes] = await Promise.all([
      machinesFetch,
      fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/alerts?select=*&order=created_at.desc&limit=500&resolved_at=is.null' + alertFilter), { headers }),
    ])
    const [mDataRaw, aData] = await Promise.all([mRes.json(), aRes.json()])

    // Filter out machines flagged hidden in state JSON (e.g. Fruitful-1)
    const mData = Array.isArray(mDataRaw) ? mDataRaw.filter((m: any) => {
      let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {}
      return st.hidden !== true
    }) : []

    // Fetch latest telemetry per machine from VPS API — in parallel (scales to ~100 machines)
    let enriched: any[] = mData
    if (Array.isArray(mData) && mData.length > 0) {
      enriched = await Promise.all(mData.map(async (m: any) => {
        try {
          const tRes = await fetch('/api/telemetry?sn=' + m.sn)
          const tJson = await tRes.json()
          const tel = tJson.success && tJson.data ? tJson.data : {}
          return { ...m, ...tel, id: m.id, machine_id: m.id, state: m.state, telemetry_id: tel.id }
        } catch {
          return m
        }
      }))
    }

        setMachines(enriched)
    setAlerts(Array.isArray(aData) ? aData : [])
    setLoading(false)
  }, [role, operatorId, ownerId])

  useEffect(() => { if (ready) fetchData() }, [ready, fetchData])

  const handleLogout = async () => {
    // fl_session is HttpOnly — document.cookie cannot delete it, so the server
    // must. Without this the session survived "logout" for its full 7 days.
    try { await fetch('/api/logout', { method: 'POST' }) } catch { /* clear locally anyway */ }
    document.cookie.split(';').forEach(c => {
      document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
    })
    window.location.href = '/login'
  }

  // Staff attendance check-in / check-out (GPS-stamped)
  const getGeo = (): Promise<{ lat: number; lng: number } | null> => new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  })
  async function processAttnPhoto(file: File, geo: { lat: number; lng: number } | null) {
    setAttnErr('')
    const readFile = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f) })
    const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src })
    const img = await loadImg(await readFile(file))
    const MAX = 960; let w = img.width, h = img.height
    if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX } else if (h >= w && h > MAX) { w = Math.round(w * MAX / h); h = MAX }
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, w, h)
    // Stamp time + GPS
    const now = new Date(); const lines = ['Fruitlink Attendance', name + '  ' + now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]
    if (geo) lines.push('GPS ' + geo.lat.toFixed(5) + ', ' + geo.lng.toFixed(5))
    const pad = Math.round(w * 0.02), fs = Math.max(12, Math.round(w * 0.028)), lineH = fs + 6
    ctx.font = fs + 'px sans-serif'; const boxH = lineH * lines.length + pad
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, h - boxH, w, boxH)
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'
    lines.forEach((ln, i) => ctx.fillText(ln, pad, h - boxH + pad / 2 + i * lineH))
    setAttnPhotoPreview(canvas.toDataURL('image/jpeg', 0.5))
    await new Promise<void>((res) => canvas.toBlob((b) => { if (b) setAttnPhoto(b); res() }, 'image/jpeg', 0.5))
  }

  async function uploadAttnPhoto(blob: Blob): Promise<string> {
    const presign = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: 'attendance.jpg', contentType: 'image/jpeg', operator_id: 'visits' }) })
    const p = await presign.json()
    if (!p.uploadUrl || !p.publicUrl) throw new Error(p.error || 'upload not configured')
    const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
    if (!put.ok) throw new Error('upload rejected')
    return p.publicUrl
  }

  const staffCheckIn = async () => {
    if (!attnPhoto) { setAttnErr('Please take a photo first.'); return }
    setAttnBusy(true); setAttnErr('')
    try {
      const geo = await getGeo()
      let photo_url = ''
      try { photo_url = await uploadAttnPhoto(attnPhoto) } catch { setAttnErr('Photo upload failed. Try again.'); setAttnBusy(false); return }
      const res = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: geo?.lat ?? null, lng: geo?.lng ?? null, visit_mode: 'office', photo_url }) })
      const d = await res.json()
      if (res.ok) {
        const cur = await fetch('/api/attendance?current=1', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
        setAttendanceOpen(cur || { id: d.id })
        setAttnPhoto(null); setAttnPhotoPreview('')
      } else { setAttnErr('Check-in failed. Try again.') }
    } catch { setAttnErr('Something went wrong. Try again.') }
    setAttnBusy(false)
  }
  async function processOutPhoto(file: File, geo: { lat: number; lng: number } | null) {
    const readFile = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f) })
    const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src })
    const img = await loadImg(await readFile(file))
    const MAX = 960; let w = img.width, h = img.height
    if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX } else if (h >= w && h > MAX) { w = Math.round(w * MAX / h); h = MAX }
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, w, h)
    const now = new Date(); const lines = ['Fruitlink Check-out', name + '  ' + now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]
    if (geo) lines.push('GPS ' + geo.lat.toFixed(5) + ', ' + geo.lng.toFixed(5))
    const pad = Math.round(w * 0.02), fs = Math.max(12, Math.round(w * 0.028)), lineH = fs + 6
    ctx.font = fs + 'px sans-serif'; const boxH = lineH * lines.length + pad
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, h - boxH, w, boxH)
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'
    lines.forEach((ln, i) => ctx.fillText(ln, pad, h - boxH + pad / 2 + i * lineH))
    setOutPreview(canvas.toDataURL('image/jpeg', 0.5))
    await new Promise<void>((res) => canvas.toBlob((b) => { if (b) setOutPhoto(b); res() }, 'image/jpeg', 0.5))
  }

  const staffCheckOut = async () => {
    if (!attendanceOpen) return
    if (!outPhoto) { setAttnErr('Please take a photo to check out.'); return }
    setAttnBusy(true); setAttnErr('')
    try {
      const geo = await getGeo()
      let photo_url = ''
      try { photo_url = await uploadAttnPhoto(outPhoto) } catch { setAttnErr('Photo upload failed.'); setAttnBusy(false); return }
      await fetch('/api/attendance?id=' + attendanceOpen.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: geo?.lat ?? null, lng: geo?.lng ?? null, photo_url }) })
      setAttendanceOpen(null); setShowCheckout(false); setOutPhoto(null); setOutPreview('')
    } catch { setAttnErr('Check-out failed.') }
    setAttnBusy(false)
  }

  const activeAlertCount = alerts.filter(a => !a.resolved_at).length

  const pages: Record<string, React.ReactElement> = {
    console: <ConsolePage machines={machines} alerts={alerts} loading={loading} />,
    alerts: <AlertsPage machines={machines} alerts={alerts} loading={loading} fetchAlerts={fetchData} />,
    operators: role === 'super_admin'
      ? <OperatorsPage myId={operatorId} />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>Access restricted to Super Admins only.</div>,
    myteam: role === 'operator'
      ? <ErrorBoundary><MyTeamPage /></ErrorBoundary>
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>Only operators can manage a team.</div>,
    commlog: (role === 'super_admin' || permissions.can_view_comm_log)
      ? <CommLogPage machines={machines} />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>You don't have permission to view this page.</div>,
    faultlog: (role === 'super_admin' || permissions.can_view_comm_log)
      ? <FaultLogPage machines={machines} />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>You don't have permission to view this page.</div>,
    ads: <AdsPage machines={machines} permissions={permissions} role={role} operatorId={operatorId} ownerId={ownerId} />,
    loyalty: <LoyaltyPage />,
    settings: <SettingsPage />,
    machines: <ErrorBoundary><MachinesPage machines={machines} loading={loading} fetchData={fetchData} /></ErrorBoundary>,
    map: <FleetMapPage machines={machines} />,
    orders: <OrdersPage />,
    warehouse: <WarehouseSection role={role} permissions={permissions} />,
    notifyconfig: (role === 'super_admin' || permissions.can_view_notify_config)
      ? <NotifyConfigSection />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>You don't have permission to view this page.</div>,
    reports: <ReportsSection />,
    mystaff: role === 'super_admin'
      ? <MyStaffSection />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>Access restricted to Super Admins only.</div>,
    fieldstaff: (role === 'super_admin' || permissions.can_view_field_staff)
      ? <FieldStaffSection />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>You don't have permission to view this page.</div>,
    attendance: (role === 'super_admin' || permissions.can_view_attendance)
      ? <AttendanceSection />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>You don't have permission to view this page.</div>,
  }

  // ── STAFF ATTENDANCE GATE ──
  // Fruitlink staff must check in before accessing any dashboard tab.
  if (isStaff && attnChecked && !attendanceOpen) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#312e81 0%,#4338ca 100%)', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '40px 32px', width: 400, maxWidth: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 30 }}>🕐</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>Good day, {name}!</div>
          <div style={{ fontSize: 14, color: C.text3, marginBottom: 22, lineHeight: 1.6 }}>Take a photo to check in and start your work session.</div>

          <input ref={attnFileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const g = await getGeo(); await processAttnPhoto(f, g) } }} />

          {attnPhotoPreview ? (
            <div style={{ marginBottom: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attnPhotoPreview} alt="Check-in" style={{ width: '100%', borderRadius: 12, maxHeight: 240, objectFit: 'cover' }} />
              <button onClick={() => { setAttnPhoto(null); setAttnPhotoPreview(''); if (attnFileRef.current) attnFileRef.current.value = '' }} style={{ marginTop: 8, background: 'none', border: 'none', color: C.orange, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>↺ Retake photo</button>
            </div>
          ) : (
            <button onClick={() => attnFileRef.current?.click()} style={{ width: '100%', padding: '28px 14px', borderRadius: 12, border: '2px dashed ' + C.border2, background: C.surface2, color: C.text2, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 30 }}>📷</span>
              Take Photo
            </button>
          )}

          {attnErr && <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: '#fdeaec', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{attnErr}</div>}

          <button onClick={staffCheckIn} disabled={attnBusy || !attnPhoto} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: (attnBusy || !attnPhoto) ? '#c7cdd6' : C.orange, color: '#fff', fontWeight: 800, fontSize: 16, cursor: (attnBusy || !attnPhoto) ? 'default' : 'pointer' }}>
            {attnBusy ? 'Checking in…' : '✓ Check In'}
          </button>
          <button onClick={handleLogout} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 10, border: '1px solid ' + C.border, background: '#fff', color: C.text3, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Log out</button>
          <div style={{ fontSize: 11, color: C.text3, marginTop: 18 }}>Your photo, time & location are recorded at check-in.</div>
        </div>
      </div>
    )
  }
  // While we're still checking attendance status for staff, show a brief loader
  if (isStaff && !attnChecked) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.text3, fontSize: 15 }}>Loading…</div>
  }

  return (
    <>
      {isStaff && showCheckout && (
        <div onClick={() => !attnBusy && setShowCheckout(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.6)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 26, width: 400, maxWidth: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 6 }}>Check Out</div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 20 }}>Take a photo to end your work session.</div>
            <input ref={outFileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const g = await getGeo(); await processOutPhoto(f, g) } }} />
            {outPreview ? (
              <div style={{ marginBottom: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outPreview} alt="Check-out" style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover' }} />
                <button onClick={() => { setOutPhoto(null); setOutPreview(''); if (outFileRef.current) outFileRef.current.value = '' }} style={{ marginTop: 8, background: 'none', border: 'none', color: C.orange, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>↺ Retake</button>
              </div>
            ) : (
              <button onClick={() => outFileRef.current?.click()} style={{ width: '100%', padding: '24px 14px', borderRadius: 12, border: '2px dashed ' + C.border2, background: C.surface2, color: C.text2, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 28 }}>📷</span> Take Photo
              </button>
            )}
            {attnErr && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#fdeaec', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{attnErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowCheckout(false); setOutPhoto(null); setOutPreview('') }} disabled={attnBusy} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid ' + C.border, background: '#fff', color: C.text2, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={staffCheckOut} disabled={attnBusy || !outPhoto} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: (attnBusy || !outPhoto) ? '#c7cdd6' : '#dc2626', color: '#fff', fontWeight: 800, fontSize: 14, cursor: (attnBusy || !outPhoto) ? 'default' : 'pointer' }}>{attnBusy ? 'Checking out…' : 'Check Out'}</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: ${C.bg}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 3px; }
        @keyframes fl-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes fl-spin { to { transform: rotate(360deg) } }

/* ── Mobile responsive (phones, < 768px) ── */
        @media (max-width: 768px) {
          [style*="padding: 24px 28px"] { padding: 16px 12px !important; }
          [style*="repeat(2,1fr)"], [style*="repeat(2, 1fr)"],
          [style*="repeat(3,1fr)"], [style*="repeat(3, 1fr)"],
          [style*="repeat(4,1fr)"], [style*="repeat(4, 1fr)"],
          [style*="1fr 1fr"] {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          table { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }

          /* Operators & data tables: stack each row as a card on phones */
          table.fl-stack { white-space: normal; }
          table.fl-stack thead { display: none; }
          table.fl-stack tr { display: block; margin-bottom: 12px; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden; }
          table.fl-stack td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px !important; border-bottom: 1px solid ${C.border}; }
          table.fl-stack td:last-child { border-bottom: none; }
        }
      `}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar: fixed drawer on mobile, normal column on desktop */}
        <div style={isMobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1100, height: '100vh',
          transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        } : { height: '100%' }}>
          <Sidebar active={active} setActive={(k: string) => { setActive(k); setMenuOpen(false) }} role={role} name={name} alertCount={activeAlertCount} onLogout={handleLogout} permissions={permissions} />
        </div>
        {/* Dark overlay behind the drawer on mobile */}
        {isMobile && menuOpen && (
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1050 }} />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', position: isMobile ? 'sticky' : 'relative', top: 0, zIndex: 900, flexShrink: 0 }}>
            {isMobile && (
              <button onClick={() => setMenuOpen(true)} aria-label="Open menu" style={{ background: C.topbar, color: '#fff', border: 'none', height: 52, width: 52, fontSize: 24, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>☰</button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}><TopBar active={active} /></div>
            {isStaff && attendanceOpen && (
              <button onClick={() => { setShowCheckout(true); setAttnErr('') }} title="Check out — ends your work session" style={{ background: '#dc2626', color: '#fff', border: 'none', height: 52, padding: isMobile ? '0 12px' : '0 18px', fontSize: isMobile ? 12 : 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {isMobile ? '⏻ Out' : '⏻ Check Out'}
              </button>
            )}
          </div>
          <PullToRefresh onRefresh={fetchData} isMobile={isMobile}>
            {pages[active] || <ComingSoon label={active} />}
          </PullToRefresh>
        </div>
      </div>
    </>
  )
}
