'use client'
import { useState, useEffect } from 'react'
import { C, SB_KEY, useIsMobile, Dot, Pill, StatCard, MachineCard, sbFetchAll, netPaise, formatMoney, formatMoneyBag, currencySymbol, addToBag, currenciesIn, type MoneyBag } from './lib/dashboard-shared'

// ─── Console Insights: live sales, scale runway, peak hours, smart restock ───
export function ConsoleInsights({ machines, lackingCard, machineSel, setMachineSel, stockData }: any) {
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
        const path = '/rest/v1/orders?select=created_at,amount_paise,currency,cup_num,pay_state,refund_state,refund_note&pay_state=eq.1&created_at=gte.' + since + machineFilter + '&order=created_at.desc'
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
  // "All machines" on this page can span countries, so revenue is kept per
  // currency and never totalled across. Money in another currency is shown
  // beside, not converted into, the leading one: 'R450' is R450 in Cape Town
  // and there is no exchange rate in this codebase that could make it anything
  // else. Bar heights and the trend maths below compare magnitudes, so they run
  // on the heaviest currency alone - the only currency in scope today.
  const revBagAll: MoneyBag = {}
  orders.forEach(o => addToBag(revBagAll, o.currency, netPaise(o)))
  const scopeCurs = currenciesIn(revBagAll)
  const mixedCurs = scopeCurs.length > 1
  const viewCur = scopeCurs[0] || 'INR'
  // These aggregates arrive in major units already (netPaise / 100), so they go
  // back to minor units for formatMoney. Whole units, grouped — as before.
  const fmt = (rs: number, cur = viewCur) => formatMoney(rs * 100, cur, { maxDigits: 0 })
  const fmtBag = (bag: MoneyBag) => formatMoneyBag(bag, { maxDigits: 0 })
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
  const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)) }
  const wmean = (a: number[]) => { let n = 0, d = 0; a.forEach((x, i) => { const w = i + 1; n += x * w; d += w }); return d ? n / d : 0 }
  const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

  const now = new Date()
  const todayKey = dKey(now)
  const nowHour = dHour(now) + (parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: IST, minute: '2-digit' }).format(now), 10) || 0) / 60

  // dailyRev is the view currency's revenue per day — the series the chart and
  // the forecasts are drawn from. dailyBag keeps the full per-currency picture
  // so a day's label can disclose money the bars cannot represent.
  const dailyCups: Record<string, number> = {}, dailyRev: Record<string, number> = {}
  const dailyBag: Record<string, MoneyBag> = {}
  orders.forEach(o => {
    const k = dKey(o.created_at)
    dailyCups[k] = (dailyCups[k] || 0) + (o.cup_num || 1)
    addToBag(dailyBag[k] || (dailyBag[k] = {}), o.currency, netPaise(o))
    if ((o.currency || 'INR') === viewCur) dailyRev[k] = (dailyRev[k] || 0) + netPaise(o) / 100
  })

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
                <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>{fmtBag(dailyBag[todayKey] || {})}</div>
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
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: C.text3, marginBottom: 12 }}>{machineSel === 'all' ? 'All machines' : machine.display_name} · revenue, last 7 days{mixedCurs ? ' · ' + viewCur : ''}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, minHeight: 104 }}>
                  {week.map((d, i) => {
                    const h = Math.max(Math.round(d.v / maxV * 88), d.v > 0 ? 6 : 3)
                    return <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text2 }}>{d.v > 0 ? currencySymbol(viewCur) + (d.v / 1000).toFixed(1) + 'k' : ''}</div>
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
export function ConsolePage({ machines, alerts, loading }: any) {
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
    { label: machineSel === 'all' ? 'All Equipment' : 'Machine', value: scopedMachines.length.toString(), sub: `${online} online · ${scopedMachines.length - online} offline`, color: C.blue, icon: '🖥', pct: scopedMachines.length > 0 ? (online / scopedMachines.length) * 100 : 0, meter: scopedMachines.length > 0 ? (online / scopedMachines.length) * 100 : 0 },
    { label: 'Online Equipment', value: online.toString(), sub: online > 0 ? scopedMachines.find((m: any) => m.status === 'online')?.display_name || '' : 'None online', color: C.green, icon: '📡', pct: scopedMachines.length > 0 ? (online / scopedMachines.length) * 100 : 0, meter: scopedMachines.length > 0 ? (online / scopedMachines.length) * 100 : 0 },
    { label: 'Active Alerts', value: scopedAlerts.length.toString(), sub: `${critical} critical · ${high} high`, color: scopedAlerts.length > 0 ? C.red : C.green, icon: '🔔', pct: Math.min(scopedAlerts.length * 10, 100), attention: scopedAlerts.length > 0 },
    { label: 'Lacking Materials', value: lacking.toString(), sub: lacking > 0 ? 'Restock needed' : 'All stocked', color: lacking > 0 ? C.orange : C.green, icon: '📦', pct: scopedMachines.length > 0 ? (lacking / scopedMachines.length) * 100 : 0, attention: lacking > 0 },
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
          {machineSel !== 'all' ? (
            <span style={{ fontSize: 12, color: C.text3, cursor: 'pointer' }} onClick={() => setMachineSel('all')}>✕ Clear</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.text2, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 20, padding: '5px 11px' }}>{scopedMachines.length} machines</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.green, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 20, padding: '5px 11px' }}><Dot color={C.green} size={6} />{online} online</span>
              {scopedAlerts.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.red, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 20, padding: '5px 11px' }}>{scopedAlerts.length} alerts</span>
              )}
            </div>
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
