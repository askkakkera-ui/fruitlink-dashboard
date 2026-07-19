'use client'
import React, { useState, useEffect } from 'react'

export class ErrorBoundary extends React.Component<{children: React.ReactNode},{error:string|null}> {
  constructor(props: any){super(props);this.state={error:null}}
  static getDerivedStateFromError(e: any){return {error:e?.message||String(e)}}
  render(){
    if(this.state.error) return <div style={{padding:40,color:'#DC3545',background:'#fdeaec',border:'1px solid #f5c2c7',borderRadius:12,margin:20}}><b>Error: </b>{this.state.error}</div>
    return this.props.children
  }
}

export const SB_URL = '/api/sb?path='
export const SB_KEY = ''
export const _SB_REAL_URL = process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co'
export const FL_LOGO = 'data:image/jpeg;base64,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'

// ─── Design Tokens ───────────────────────────────────────────────
export const C = {
  sidebar:   '#e9e7f5',
  sidebarB:  '#dcd9ee',
  sidebarT:  '#dcd9ee',
  active:    '#FE6505',
  activeGlow:'#FE650518',
  bg:        '#f4f5f9',
  surface:   '#ffffff',
  surface2:  '#f4f5f9',
  border:    '#e8eaf0',
  border2:   '#dcdfe9',
  text:      '#1f2533',
  text2:     '#5b6478',
  text3:     '#9099ac',
  textSide:  '#2a2550',
  textSide2: '#3a3560',
  textSide3: '#6b6592',
  green:     '#198754',
  greenBg:   '#e7f8ef',
  red:       '#DC3545',
  redBg:     '#fdeaec',
  amber:     '#c98a00',
  amberBg:   '#fff7e0',
  blue:      '#0D6EFD',
  blueBg:    '#e7f0ff',
  orange:    '#FE6505',
  orangeBg:  '#fff3ea',
  topbar:    '#423A8E',
}

export function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : ''
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

// ─── Tiny Components ─────────────────────────────────────────────
export function Dot({ color, pulse = false, size = 7 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', background: color, flexShrink: 0,
      animation: pulse ? 'fl-pulse 2s infinite' : 'none',
    }} />
  )
}

export function Badge({ children, color = C.orange, bg }: any) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
      padding: '2px 8px', borderRadius: 10,
      background: bg || color + '18', color,
      textTransform: 'uppercase' as const,
      border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

export function Pill({ children, color, bg }: any) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 20, background: bg, color,
      border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

export function SectionLabel({ children }: any) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.07em', color: '#3a3560', padding: '14px 16px 5px', textTransform: 'uppercase' as const }}>{children}</div>
  )
}

// ─── Revenue ─────────────────────────────────────────────────────
// A refunded order is not income. Reports has computed this correctly since it
// was written (netRevenue = revenue - refGenuineAmt); the Console never did, and
// showed gross as if it were earnings - Rs 5,270 over the fortnight to 15 Jul,
// about 5% overstated, growing daily.
//
// Only refund_state === 1 counts: a FAILED refund (state 2) means the money
// never actually left, so it is still revenue. Test refunds are excluded by
// their note, matching Reports.
//
// KNOWN GAP: when PhonePe rejects a refund and we settle the customer in CASH,
// the row stays at refund_state = 2, so this still counts it as revenue when the
// money has in fact gone. Rs 600 on 15 Jul. A settled_cash state belongs in
// Tier 3's refund lifecycle split.
// ─── Fetching ────────────────────────────────────────────────────
// PostgREST caps rows at db-max-rows and returns 200 with no error, so a
// `limit=` above the cap is a request, not a promise. On 16 Jul a Reports PDF
// headed 01 Jul in fact began at 07 Jul: 1,185 orders in the table, exactly
// 1,000 in the document, Rs 14,770 of gross silently absent.
//
// Pages in windows via Range and reads Content-Range for the true total.
// Never returns a short array quietly: if the server has more than we can
// fetch, that is raised, not rounded off.
export async function sbFetchAll(path: string, headers: any, opts: { max?: number } = {}): Promise<any[]> {
  const MAX = opts.max ?? 20000
  const WINDOW = 1000
  const all: any[] = []
  let from = 0
  for (;;) {
    const res = await fetch('/api/sb?path=' + encodeURIComponent(path), {
      headers: { ...headers, 'Range-Unit': 'items', Range: from + '-' + (from + WINDOW - 1), Prefer: 'count=exact' },
    })
    if (!res.ok) throw new Error('sbFetchAll: HTTP ' + res.status + ' on ' + path.slice(0, 80))
    const batch = await res.json()
    if (!Array.isArray(batch)) throw new Error('sbFetchAll: non-array response for ' + path.slice(0, 80))
    all.push(...batch)
    const cr = res.headers.get('content-range') || ''
    const total = Number((cr.split('/')[1] || '').trim())
    if (batch.length < WINDOW) break
    if (Number.isFinite(total) && all.length >= total) break
    from += batch.length
    if (all.length >= MAX) throw new Error('sbFetchAll: exceeded ' + MAX + ' rows for ' + path.slice(0, 80))
  }
  return all
}

export const isTestRefund = (n: string) => /test/i.test(n || '')
export const netPaise = (o: any) =>
  (o.refund_state === 1 && !isTestRefund(o.refund_note)) ? 0 : (o.amount_paise || 0)

// ─── Money ───────────────────────────────────────────────────────
// Amounts are stored in minor units (amount_paise, whatever the currency) and
// the symbol belongs to the currency, not to the page. A ZAR machine must read
// R120, not R120-worth-of-rupee-sign.
//
// `opts` is here because the display it replaced was never one format: Orders
// used .toFixed(0) with no grouping, Console and Ads used Math.round with
// en-IN grouping, Warehouse always showed two decimals. Each call site passes
// the opts that reproduce its own established output byte for byte, so making
// this currency-aware changed no number anyone was already reading. Defaults
// (grouped, 0 to `digits` decimals) are for new call sites.
export const CURRENCY_META: Record<string, { symbol: string; digits: number }> = {
  INR: { symbol: '₹', digits: 2 },
  ZAR: { symbol: 'R', digits: 2 },
  USD: { symbol: '$', digits: 2 },
  AED: { symbol: 'AED ', digits: 2 },
}

export function formatMoney(
  amountMinor: number,
  currency = 'INR',
  opts: { minDigits?: number; maxDigits?: number; grouping?: boolean } = {},
): string {
  const m = CURRENCY_META[currency] || CURRENCY_META.INR
  const major = amountMinor / Math.pow(10, m.digits)
  return m.symbol + major.toLocaleString('en-IN', {
    minimumFractionDigits: opts.minDigits ?? 0,
    maximumFractionDigits: opts.maxDigits ?? m.digits,
    useGrouping: opts.grouping ?? true,
  })
}

export const currencySymbol = (currency = 'INR') =>
  (CURRENCY_META[currency] || CURRENCY_META.INR).symbol

// A machine's currency lives one hop away: machines.country_code -> countries
// .currency_code. Callers that have not loaded `countries` pass nothing and get
// INR, which is correct for every machine today (all country_code = 'IN').
export function machineCurrency(machine: any, countries?: Record<string, string>): string {
  const cc = machine?.country_code
  return (cc && countries?.[cc]) || 'INR'
}

export function StatCard({ label, value, sub, color, icon, pct, meter, attention }: any) {
  return (
    <div style={{
      background: attention ? color + '0e' : C.surface, border: `1px solid ${attention ? color + '55' : C.border}`, borderRadius: 12,
      padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, color: attention ? color : C.text, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{sub}</div>}
      {typeof meter === 'number' && (
        <div style={{ height: 5, background: C.surface2, borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, meter))}%`, background: color, borderRadius: 3 }} />
        </div>
      )}
    </div>
  )
}

export function MachineCard({ machine, stock }: { machine: any, stock?: any }) {
  const online = machine.status === 'online'
  const temp = machine.inner_temp_c
  const tempColor = temp == null ? C.text3 : temp > 18 ? C.red : temp > 12 ? C.amber : temp < 3 ? C.blue : C.green
  const layers = [machine.stock_l1, machine.stock_l2, machine.stock_l3]
  const isNewSaier = (() => { try { const st = typeof machine.state==='string'?JSON.parse(machine.state):(machine.state||{}); return st?.machine_config?.machine_type==='newsaier'; } catch { return false; } })()
  const stockColor = !stock?.stock_known ? C.text3 : stock.cups_remaining <= 10 ? C.red : stock.stock_pct <= 50 ? C.amber : C.green
  const stockBg = !stock?.stock_known ? C.surface2 : stock.cups_remaining <= 10 ? C.redBg : stock.stock_pct <= 50 ? C.amberBg : C.greenBg
  const stockPct = stock?.stock_pct ?? 0
  const daysAgo = stock?.last_loaded_at ? Math.floor((Date.now()-new Date(stock.last_loaded_at).getTime())/86400000) : null

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: 'hidden', transition: 'all 0.2s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border2; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px #00000010' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
    >
      {/* Top stripe */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${online ? C.green : C.border2}, transparent)` }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3 }}>{machine.display_name}</div>
            <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace', letterSpacing: '0.03em' }}>{machine.sn}</div>
          </div>
          {online ? (
            <Pill color={C.green} bg={C.greenBg}><Dot color={C.green} pulse size={5} /> Online</Pill>
          ) : (
            <Pill color={C.red} bg={C.redBg}><Dot color={C.red} pulse size={5} /> Offline</Pill>
          )}
        </div>

        {/* Layers / Stock */}
        {isNewSaier ? (
          <div style={{ marginBottom: 14, background: stockBg, borderRadius: 10, padding: '10px 12px', border: '1px solid ' + C.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>🍊 Est. Stock</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: stockColor }}>{stock?.stock_known ? `${stock.cups_remaining} cups left` : 'No data yet'}</span>
            </div>
            <div style={{ height: 8, background: C.surface2, borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
              <div style={{ height: '100%', width: `${Math.min(100, stockPct)}%`, background: stockColor, borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
            <div style={{ fontSize: 11, color: C.text3 }}>
              {stock?.stock_known ? `${stock.cups_loaded} loaded · ${stock.cups_dispensed} dispensed${daysAgo !== null ? ' · loaded ' + (daysAgo === 0 ? 'today' : daysAgo + 'd ago') : ''}` : 'Log a loading visit to track stock'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {layers.map((has, i) => (
              <div key={i} style={{
                flex: 1, background: C.surface2, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '10px 6px', textAlign: 'center',
                borderTop: `2px solid ${online ? (has ? C.green : C.red) : C.border2}`,
              }}>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, marginBottom: 5, letterSpacing: '0.05em' }}>LAYER {i + 1}</div>
                <div style={{ fontSize: 17, marginBottom: 3 }}>{online ? (has ? '🟢' : '🔴') : '⚫'}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: online ? (has ? C.green : C.red) : C.text3 }}>
                  {online ? (has ? 'Stocked' : 'Empty') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sensors grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Temperature', value: temp != null ? `${temp}°C` : '—', color: tempColor, sub: temp != null ? (temp > 18 ? 'High' : temp > 12 ? 'Warm' : temp < 3 ? 'Low' : 'Normal') : '' },
            { label: 'Location', value: machine.location || '—', color: C.text, sub: '' },
            { label: 'Cup Tray', value: machine.cup_present === true ? 'Present' : machine.cup_present === false ? 'Missing' : '—', color: machine.cup_present ? C.green : machine.cup_present === false ? C.red : C.text3, sub: '' },
            { label: 'App Version', value: machine.app_version ? `v${machine.app_version}` : '—', color: C.blue, sub: 'Fruitlink' },
          ].map(f => (
            <div key={f.label} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.value}</div>
              {f.sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 1 }}>{f.sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
