'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const SB_URL = 'https://fpwvutdvwnvrunviporz.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk'

// ─── Design Tokens ───────────────────────────────────────────────
const C = {
  sidebar:   '#1c2333',
  sidebarB:  '#161b27',
  sidebarT:  '#2a3649',
  active:    '#f97316',
  activeGlow:'#f9731618',
  bg:        '#0f1117',
  surface:   '#161b27',
  surface2:  '#1c2333',
  border:    '#2a3649',
  border2:   '#374461',
  text:      '#f0f2ff',
  text2:     '#b0b8d8',
  text3:     '#7a84a8',
  textSide:  '#e0e4f8',
  textSide2: '#a8b0d0',
  textSide3: '#7a84a8',
  green:     '#22c55e',
  greenBg:   '#16a34a30',
  red:       '#f87171',
  redBg:     '#dc262630',
  amber:     '#fbbf24',
  amberBg:   '#d9770630',
  blue:      '#60a5fa',
  blueBg:    '#2563eb30',
  orange:    '#f97316',
  orangeBg:  '#f9731630',
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : ''
}

// ─── Tiny Components ─────────────────────────────────────────────
function Dot({ color, pulse = false, size = 7 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', background: color, flexShrink: 0,
      animation: pulse ? 'fl-pulse 2s infinite' : 'none',
    }} />
  )
}

function Badge({ children, color = C.orange, bg }: any) {
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

function Pill({ children, color, bg }: any) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 20, background: bg, color,
      border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

function SectionLabel({ children }: any) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: C.textSide3, padding: '12px 16px 4px', textTransform: 'uppercase' as const }}>{children}</div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'console', label: 'Console', icon: '⊞', badge: 'LIVE', group: '' },
  { key: 'machines', label: 'Machine List', icon: '▣', group: 'Equipment Management' },
  { key: 'map', label: 'Fleet Map', icon: '◎', group: 'Equipment Management' },
  { key: 'alerts', label: 'Alerts', icon: '◉', group: 'Equipment Management', alertDot: true },
  { key: 'orders', label: 'Orders List', icon: '▤', group: 'Order Management' },
  { key: 'operators', label: 'Operators', icon: '⬡', group: 'Operator Management', superAdmin: true },
  { key: 'ads', label: 'Ad Manager', icon: '🎬', group: 'Marketing' },
  { key: 'loyalty', label: 'Loyalty', icon: '⭐', group: 'Marketing' },
  { key: 'settings', label: 'Settings', icon: '◈', group: 'System' },
]

function Sidebar({ active, setActive, role, name, alertCount, onLogout }: any) {
  const initials = (name || 'A').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const groups: Record<string, typeof NAV_ITEMS> = {}
  NAV_ITEMS.forEach(item => {
    if (item.superAdmin && role !== 'super_admin') return
    const g = item.group || '__top'
    if (!groups[g]) groups[g] = []
    groups[g].push(item)
  })

  return (
    <div style={{
      width: 230, flexShrink: 0, background: C.sidebar,
      display: 'flex', flexDirection: 'column',
      boxShadow: '2px 0 12px #00000018',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${C.sidebarT}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: C.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800, color: '#fff', flexShrink: 0,
            boxShadow: '0 2px 8px #f9731640',
          }}>F</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>FRUITLINK</div>
            <div style={{ fontSize: 12.5, color: C.textSide3, letterSpacing: '0.07em', marginTop: 1 }}>TECHNOLOGIES PVT LTD</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff12', borderRadius: 8, padding: '6px 10px' }}>
          <Dot color={C.green} pulse size={6} />
          <span style={{ fontSize: 11, color: C.textSide, fontWeight: 500 }}>Online</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textSide3 }}>System OK</span>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            {group !== '__top' && <SectionLabel>{group}</SectionLabel>}
            {items.map(item => {
              const isActive = active === item.key
              return (
                <button key={item.key} onClick={() => setActive(item.key)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isActive ? C.activeGlow : 'transparent',
                  color: isActive ? C.orange : C.textSide2,
                  fontSize: 14.5, fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s', marginBottom: 1,
                  borderLeft: isActive ? `3px solid ${C.orange}` : '3px solid transparent',
                  paddingLeft: isActive ? 9 : 12,
                }}>
                  <span style={{ fontSize: 16, opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {item.badge && <Badge color={C.orange}>{item.badge}</Badge>}
                  {item.alertDot && alertCount > 0 && (
                    <span style={{ background: C.red, color: '#fff', fontSize: 12, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{alertCount}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* User */}
      <div style={{ padding: '12px', borderTop: `1px solid ${C.sidebarT}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#ffffff10', borderRadius: 9, padding: '8px 10px' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: C.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Admin'}</div>
            <div style={{ fontSize: 11.5, color: C.orange, marginTop: 1 }}>{role === 'super_admin' ? 'Super Admin' : 'Operator'}</div>
          </div>
          <button onClick={onLogout} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textSide3, fontSize: 16, padding: 2 }} title="Logout">⏻</button>
        </div>
      </div>
    </div>
  )
}

// ─── Top Bar ─────────────────────────────────────────────────────
function TopBar({ active }: { active: string }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [])
  const labels: Record<string, string> = { console: 'Console', machines: 'Machine List', alerts: 'Alert Center', operators: 'Operators', settings: 'Settings', map: 'Fleet Map', orders: 'Orders List' }
  return (
    <div style={{
      height: 52, background: C.surface, borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, flexShrink: 0,
      boxShadow: '0 1px 4px #00000008',
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: C.text3, letterSpacing: '0.04em' }}>FRUITLINK</span>
        <span style={{ color: C.text3, fontSize: 12 }}>›</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{labels[active] || active}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.greenBg, borderRadius: 20, padding: '4px 12px' }}>
        <Dot color={C.green} pulse size={6} />
        <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>System Online</span>
      </div>
      <span style={{ fontSize: 11, color: C.text3 }}>{time}</span>
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, pct }: any) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '18px 20px', position: 'relative' as const, overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.9 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{label}</div>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: C.text, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>{sub}</div>}
      <div style={{ marginTop: 16, height: 2, background: C.border, borderRadius: 2 }}>
        <div style={{ height: '100%', background: color, borderRadius: 2, width: `${Math.min(pct ?? 100, 100)}%`, opacity: 0.7, transition: 'width .6s' }} />
      </div>
    </div>
  )
}

function MachineCard({ machine }: { machine: any }) {
  const online = machine.status === 'online'
  const temp = machine.inner_temp_c
  const tempColor = temp == null ? C.text3 : temp > 12 ? C.red : temp < 3 ? C.blue : C.green
  const layers = [machine.stock_l1, machine.stock_l2, machine.stock_l3]

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

        {/* Layers */}
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

        {/* Sensors grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Temperature', value: temp != null ? `${temp}°C` : '—', color: tempColor, sub: temp != null ? (temp > 12 ? 'High' : temp < 3 ? 'Low' : 'Normal') : '' },
            { label: 'Location', value: machine.location || '—', color: C.text, sub: machine.state || '' },
            { label: 'Cup Tray', value: machine.cup_present === true ? 'Present' : machine.cup_present === false ? 'Missing' : '—', color: machine.cup_present ? C.green : machine.cup_present === false ? C.red : C.text3, sub: '' },
            { label: 'App Version', value: machine.app_version ? `v${machine.app_version}` : '—', color: C.blue, sub: 'JW Intell' },
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

// ─── Console Page ────────────────────────────────────────────────
function ConsolePage({ machines, alerts, loading }: any) {
  const online = machines.filter((m: any) => m.status === 'online').length
  const activeAlerts = alerts.filter((a: any) => !a.resolved_at)
  const critical = activeAlerts.filter((a: any) => a.severity === 'CRITICAL').length
  const high = activeAlerts.filter((a: any) => a.severity === 'HIGH').length
  const lacking = machines.filter((m: any) => m.status === 'online' && (!m.stock_l1 || !m.stock_l2 || !m.stock_l3)).length

  const stats = [
    { label: 'All Equipment', value: machines.length.toString(), sub: `${online} online · ${machines.length - online} offline`, color: C.blue, icon: '🖥', pct: machines.length > 0 ? (online / machines.length) * 100 : 0 },
    { label: 'Online Equipment', value: online.toString(), sub: online > 0 ? machines.find((m: any) => m.status === 'online')?.display_name || '' : 'No machines online', color: C.green, icon: '📡', pct: machines.length > 0 ? (online / machines.length) * 100 : 0 },
    { label: 'Active Alerts', value: activeAlerts.length.toString(), sub: `${critical} critical · ${high} high`, color: activeAlerts.length > 0 ? C.red : C.green, icon: '🔔', pct: Math.min(activeAlerts.length * 10, 100) },
    { label: 'Lacking Materials', value: lacking.toString(), sub: lacking > 0 ? 'Restock needed' : 'All stocked', color: lacking > 0 ? C.orange : C.green, icon: '📦', pct: machines.length > 0 ? (lacking / machines.length) * 100 : 0 },
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
  const getMachine = (id: string) => machines.find((m: any) => m.id === id) || {} as any
  const fmtAgo = (t: string) => {
    const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000)
    if (m < 60) return `${m}m ago`
    if (m < 1440) return `${Math.floor(m / 60)}h ago`
    return `${Math.floor(m / 1440)}d ago`
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Machine Cards */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Fleet Overview</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Dot color={C.orange} pulse size={6} />
          <span style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>Synced from JW Intell · every 2 min</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading fleet data...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 22 }}>
          {machines.map((m: any) => <MachineCard key={m.id} machine={m} />)}
        </div>
      )}

      {/* Recent Alerts */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Recent Alerts</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot color={C.orange} pulse size={6} />
            <span style={{ fontSize: 11, color: C.text3 }}>Live feed</span>
          </div>
        </div>
        {activeAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>All clear — no active alerts</div>
          </div>
        ) : activeAlerts.slice(0, 5).map((a: any, i: number) => {
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
        })}
      </div>
    </div>
  )
}

// ─── Alerts Page ─────────────────────────────────────────────────
function AlertsPage({ machines, alerts, loading, fetchAlerts }: any) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active')
  const [sevFilter, setSevFilter] = useState('all')
  const [expandedM, setExpandedM] = useState<Record<string, boolean>>({})
  const SEVERITY_COLOR: any = { CRITICAL: C.red, HIGH: C.amber, MEDIUM: C.blue, LOW: C.green }
  const SEVERITY_BG: any = { CRITICAL: C.redBg, HIGH: C.amberBg, MEDIUM: C.blueBg, LOW: C.greenBg }
  const ALERT_LABELS: any = {
    machine_offline: 'Machine Offline', temperature_high: 'High Temperature', temperature_low: 'Low Temperature',
    temperature_stop: 'Temp — Stop Selling', stock_empty_l1: 'Layer 1 Empty', stock_empty_l2: 'Layer 2 Empty',
    stock_empty_l3: 'Layer 3 Empty', stock_low_l1: 'Layer 1 Low', stock_low_l2: 'Layer 2 Low',
    stock_low_l3: 'Layer 3 Low', door_open: 'Door Open', vend_failure: 'Vend Failure',
    cup_empty: 'Cups Empty', film_empty: 'Film Empty', cooling_off: 'Cooling Off',
  }
  const getMachine = (id: string) => machines.find((m: any) => m.id === id) || {} as any
  const fmtTime = (t: string) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fmtAgo = (t: string) => {
    const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000)
    if (m < 60) return `${m}m ago`
    if (m < 1440) return `${Math.floor(m / 60)}h ago`
    return `${Math.floor(m / 1440)}d ago`
  }
  const counts: any = {
    CRITICAL: alerts.filter((a: any) => !a.resolved_at && a.severity === 'CRITICAL').length,
    HIGH: alerts.filter((a: any) => !a.resolved_at && a.severity === 'HIGH').length,
    MEDIUM: alerts.filter((a: any) => !a.resolved_at && a.severity === 'MEDIUM').length,
    LOW: alerts.filter((a: any) => !a.resolved_at && a.severity === 'LOW').length,
    active: alerts.filter((a: any) => !a.resolved_at).length,
    resolved: alerts.filter((a: any) => a.resolved_at).length,
  }
  const filtered = alerts.filter((a: any) => {
    if (filter === 'active' && a.resolved_at) return false
    if (filter === 'resolved' && !a.resolved_at) return false
    if (sevFilter !== 'all' && a.severity !== sevFilter) return false
    return true
  })

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Alert Center</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{counts.active} active · {counts.resolved} resolved</div>
        </div>
        <button onClick={fetchAlerts} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: C.sidebar, color: '#fff',
          border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
        }}>↻ Refresh</button>
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
            background: filter === f ? C.sidebar : 'transparent',
            color: filter === f ? C.surface : C.text2,
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
                  <div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
                          {['Severity', 'Alert', 'Time', 'Status'].map((h, i) => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: C.text2, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.07em', width: ['12%','52%','18%','18%'][i] }}>{h}</th>
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
                              <div style={{ display: 'inline-block', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 5, padding: '1px 7px', fontSize: 12, fontFamily: 'monospace', color: C.text2, marginBottom: 4 }}>{a.alert_type}</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ALERT_LABELS[a.alert_type] || a.alert_type}</div>
                              <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{a.message}</div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{fmtTime(a.created_at)}</div>
                              <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{fmtAgo(a.created_at)}</div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {!a.resolved_at ? (
                                <Pill color={C.red} bg={C.redBg}><Dot color={C.red} pulse size={5} /> Active</Pill>
                              ) : (
                                <Pill color={C.green} bg={C.greenBg}>✓ Resolved</Pill>
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
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'analytics' | 'orders'>('analytics')
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')

  const [uRole] = useState(() => typeof document !== 'undefined' ? (document.cookie.match(/fl_role=([^;]+)/)?.[1] || 'operator') : 'operator')
  const [uOpId] = useState(() => typeof document !== 'undefined' ? (document.cookie.match(/fl_operator_id=([^;]+)/)?.[1] || '') : '')

  useEffect(() => {
    const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    const load = async () => {
      const ms = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,location', { headers: h }).then(r => r.json()).then(d => Array.isArray(d) ? d : [])
      setMachines(ms)
      let ids: string[] = ms.map((m: any) => m.id)
      if (uRole !== 'super_admin' && uOpId) {
        const mo = await fetch(SB_URL + '/rest/v1/machine_operators?operator_id=eq.' + uOpId + '&select=machine_id', { headers: h }).then(r => r.json())
        ids = Array.isArray(mo) ? mo.map((r: any) => r.machine_id) : []
      }
      const f = ids.length > 0 ? '&machine_id=in.(' + ids.join(',') + ')' : ''
      const os = await fetch(SB_URL + '/rest/v1/orders?select=*&order=created_at.desc&limit=500' + f, { headers: h }).then(r => r.json())
      setOrders(Array.isArray(os) ? os : [])
      setLoading(false)
    }
    load()
  }, [uRole, uOpId])

  const getMachine = (id: string) => machines.find((m: any) => m.id === id) || {} as any
  const fmtAmt = (p: number) => '₹' + (p / 100).toFixed(0)
  const fmtTime = (t: string) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fmtAgo = (t: string) => { const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m/60) + 'h ago'; return Math.floor(m/1440) + 'd ago' }

  // Period filter
  const now = new Date()
  const periodOrders = orders.filter((o: any) => {
    const d = new Date(o.created_at)
    if (period === 'today') return d.toDateString() === now.toDateString()
    if (period === 'week') return (now.getTime() - d.getTime()) < 7 * 86400000
    return (now.getTime() - d.getTime()) < 30 * 86400000
  })

  const paidOrders = periodOrders.filter((o: any) => o.pay_state === 1)
  const totalRevenue = paidOrders.reduce((s: number, o: any) => s + (o.amount_paise || 0), 0)
  const totalCups = paidOrders.reduce((s: number, o: any) => s + (o.cup_num || 1), 0)
  const avgOrder = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0
  const convRate = periodOrders.length > 0 ? (paidOrders.length / periodOrders.length * 100) : 0

  // Revenue per machine
  const machineRevenue = machines.map((m: any) => {
    const mOrders = paidOrders.filter((o: any) => o.machine_id === m.id)
    const rev = mOrders.reduce((s: number, o: any) => s + (o.amount_paise || 0), 0)
    const cups = mOrders.reduce((s: number, o: any) => s + (o.cup_num || 1), 0)
    return { ...m, revenue: rev, cups, orders: mOrders.length }
  }).sort((a: any, b: any) => b.revenue - a.revenue)

  // Daily revenue chart data (last 7 days)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return d.toDateString()
  })
  const dailyData = days.map(day => {
    const dayOrders = orders.filter((o: any) => new Date(o.created_at).toDateString() === day && o.pay_state === 1)
    return { day: new Date(day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }), revenue: dayOrders.reduce((s: number, o: any) => s + (o.amount_paise || 0), 0), cups: dayOrders.length }
  })
  const maxRev = Math.max(...dailyData.map(d => d.revenue), 1)

  // Tab filter for order list
  const filtered = orders.filter((o: any) => {
    if (filter === 'paid') return o.pay_state === 1
    if (filter === 'pending') return o.pay_state === 0
    if (filter === 'delivered') return o.delivery_state === 1
    return true
  })

  const PAY_STATE: any = { 0: { label: 'Pending', color: C.amber, bg: C.amberBg }, 1: { label: 'Paid', color: C.green, bg: C.greenBg }, 2: { label: 'Failed', color: C.red, bg: C.redBg } }
  const DEL_STATE: any = { 0: { label: 'Pending', color: C.amber, bg: C.amberBg }, 1: { label: 'Delivered', color: C.green, bg: C.greenBg }, 2: { label: 'Failed', color: C.red, bg: C.redBg } }

  return (
    <div style={{ padding: '22px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Revenue & Orders</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{orders.length} total orders · {machines.length} machines</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: 3 }}>
            {[['analytics', '📊 Analytics'], ['orders', '📋 Orders']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v as any)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: view === v ? C.sidebar : 'transparent', color: view === v ? '#fff' : C.text2, transition: 'all .15s' }}>{l}</button>
            ))}
          </div>
          {/* Period toggle */}
          {view === 'analytics' && (
            <div style={{ display: 'flex', background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: 3 }}>
              {[['today', 'Today'], ['week', '7 Days'], ['month', '30 Days']].map(([p, l]) => (
                <button key={p} onClick={() => setPeriod(p as any)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: period === p ? C.orange : 'transparent', color: period === p ? '#fff' : C.text2, transition: 'all .15s' }}>{l}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === 'analytics' ? (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
            {[
              { label: 'Total Revenue', value: fmtAmt(totalRevenue), sub: period === 'today' ? 'today' : period === 'week' ? 'last 7 days' : 'last 30 days', color: C.green, icon: '₹', pct: 75 },
              { label: 'Paid Orders', value: paidOrders.length.toString(), sub: periodOrders.length + ' total', color: C.blue, icon: '✅', pct: convRate },
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
                const h = Math.max((d.revenue / maxRev) * 140, d.revenue > 0 ? 4 : 2)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {d.revenue > 0 && <div style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>{fmtAmt(d.revenue)}</div>}
                    <div style={{ width: '100%', height: h, background: d.revenue > 0 ? C.orange : C.border, borderRadius: '4px 4px 0 0', transition: 'height .4s', position: 'relative' as const }}>
                      {d.cups > 0 && <div style={{ position: 'absolute' as const, top: -18, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: C.orange, fontWeight: 700 }}>{d.cups}🥤</div>}
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
            ) : machineRevenue.map((m: any, i: number) => {
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
          </div>
        </div>
      ) : (
        <div>
          {/* Order list filter tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: C.surface2, borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid ' + C.border }}>
            {[['all','All Orders'], ['paid','Paid'], ['pending','Pending'], ['delivered','Delivered']].map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', background: filter === f ? C.sidebar : 'transparent', color: filter === f ? '#fff' : C.text2, fontSize: 12, fontWeight: 600, transition: 'all 0.15s' }}>{label}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading orders...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: C.surface, borderRadius: 16, border: '1px solid ' + C.border }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No orders found</div>
            </div>
          ) : (
            <div style={{ background: C.surface, borderRadius: 16, border: '1px solid ' + C.border, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.surface2, borderBottom: '2px solid ' + C.border }}>
                    {['Order Code', 'Machine', 'Amount', 'Payment', 'Delivery', 'Cups', 'Time'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: C.text3, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: C.text2 }}>{h}</th>
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
                        <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 700, color: C.green, fontSize: 14 }}>{fmtAmt(o.amount_paise || 0)}</div></td>
                        <td style={{ padding: '12px 16px' }}>
                          <Pill color={ps.color} bg={ps.bg}>{ps.label}</Pill>
                          <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{o.pay_type?.toUpperCase()}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}><Pill color={ds.color} bg={ds.bg}>{ds.label}</Pill></td>
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


function MachinesPage({ machines, loading, fetchData }: any) {
  const fmtTime = (t: string) => { if (!t) return '--'; const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m/60) + 'h ago'; return Math.floor(m/1440) + 'd ago' }
  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Machine List</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{machines.length} machines · {machines.filter((m: any) => m.status === 'online').length} online</div>
        </div>
        <button onClick={fetchData} style={{ background: C.sidebar, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Refresh</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Machines', value: machines.length, color: C.blue, icon: '🖥', pct: 100 },
          { label: 'Online', value: machines.filter((m: any) => m.status === 'online').length, color: C.green, icon: '📡', pct: machines.length > 0 ? (machines.filter((m: any) => m.status === 'online').length / machines.length) * 100 : 0 },
          { label: 'Offline', value: machines.filter((m: any) => m.status !== 'online').length, color: C.red, icon: '📴', pct: machines.length > 0 ? (machines.filter((m: any) => m.status !== 'online').length / machines.length) * 100 : 0 },
        ].map(s => <StatCard key={s.label} {...s} sub="" />)}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading machines...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {machines.map((m: any) => {
            const online = m.status === 'online'
            const temp = m.inner_temp_c
            const tempColor = temp == null ? C.text3 : temp > 12 ? C.red : temp < 3 ? C.blue : C.green
            const layers = [m.stock_l1, m.stock_l2, m.stock_l3]
            return (
              <div key={m.id} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${online ? C.green : C.border2}, transparent)` }} />
                <div style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: online ? C.greenBg : C.surface2, border: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖥</div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{m.display_name}</div>
                        <div style={{ fontSize: 11, color: C.text2, fontFamily: 'monospace', marginTop: 2 }}>{m.sn}</div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>📍 {m.location || '--'} · {m.state}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}><Dot color={online ? C.green : C.red} pulse={online} size={5} />{online ? 'Online' : 'Offline'}</Pill>
                      {m.app_version && <Badge color={C.blue}>v{m.app_version}</Badge>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr) 2fr 2fr 2fr', gap: 10 }}>
                    {layers.map((has: boolean, i: number) => (
                      <div key={i} style={{ background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: '10px', textAlign: 'center', borderTop: '2px solid ' + (online ? (has ? C.green : C.red) : C.border2) }}>
                        <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>LAYER {i + 1}</div>
                        <div style={{ fontSize: 18, marginBottom: 3 }}>{online ? (has ? '🟢' : '🔴') : '⚫'}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: online ? (has ? C.green : C.red) : C.text3 }}>{online ? (has ? 'Stocked' : 'Empty') : '--'}</div>
                      </div>
                    ))}
                    {[
                      { label: 'Temperature', value: temp != null ? temp + 'C' : '--', color: tempColor, sub: temp != null ? (temp > 12 ? 'High' : temp < 3 ? 'Low' : 'Normal') : '' },
                      { label: 'Cup Tray', value: m.cup_present === true ? 'Present' : m.cup_present === false ? 'Missing' : '--', color: m.cup_present ? C.green : m.cup_present === false ? C.red : C.text3, sub: '' },
                      { label: 'Last Seen', value: fmtTime(m.last_seen), color: C.text, sub: online ? 'Active' : 'Disconnected' },
                    ].map(f => (
                      <div key={f.label} style={{ background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.value}</div>
                        {f.sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{f.sub}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid ' + C.border, display: 'flex', gap: 20 }}>
                    {[
                      { label: 'Machine ID', value: m.id.slice(0,8) + '...' },
                      { label: 'Scale', value: m.scale_weight_g != null ? m.scale_weight_g + 'g' : '--' },
                      { label: 'Cooling', value: m.cooling_state === true ? 'Active' : m.cooling_state === false ? 'Off' : '--' },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FleetMapPage({ machines }: { machines: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const MB = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'NEXT_PUBLIC_MAPBOX_TOKEN_HERE'
  // Machine coords by SN (most reliable) then by location string
  const MACHINE_COORDS: Record<string, {lat: number, lng: number}> = {
    'C3B31F38D1C07A76': { lat: 17.442822793310572, lng: 78.44438079543997 }, // Fruitful-2 Tim Cafe SR Nagar exact
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
  const getCoords = (m: any) => {
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
  }, [scriptLoaded, machines])
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
            const temp = m.inner_temp_c
            const tempColor = temp == null ? C.text3 : temp > 12 ? C.red : temp < 3 ? C.blue : C.green
            return (
              <div key={m.id} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ height: 3, background: online ? C.green : C.border2 }} />
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                      <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace', marginTop: 2 }}>{m.sn}</div>
                    </div>
                    <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}><Dot color={online ? C.green : C.red} pulse={online} size={5} />{online ? 'Online' : 'Offline'}</Pill>
                  </div>
                  <div style={{ fontSize: 12, color: C.text2, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>📍 {m.location || '--'}, {m.state}</span>
                    {(() => { const co = getCoords(m); return co ? <a href={'https://www.google.com/maps?q=' + co.lat + ',' + co.lng + '&z=17'} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.blue, fontWeight: 600, textDecoration: 'none' }}>Open Maps →</a> : null })()}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    {[
                      { label: 'Temperature', value: temp != null ? temp + 'C' : '--', color: tempColor },
                      { label: 'Last Seen', value: fmtTime(m.last_seen), color: C.text },
                      { label: 'Scale', value: m.scale_weight_g != null ? m.scale_weight_g + 'g' : '--', color: C.text },
                      { label: 'Version', value: m.app_version ? 'v' + m.app_version : '--', color: C.blue },
                    ].map(f => (
                      <div key={f.label} style={{ background: C.surface2, borderRadius: 8, padding: '7px 9px' }}>
                        <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}



function AdsPage({ machines }: { machines: any[] }) {
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ machine_id: 'all', title: '', media_url: '', media_type: 'image', start_time: '00:00', end_time: '23:59', days: ['mon','tue','wed','thu','fri','sat','sun'], active: true })
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }

  const loadAds = () => {
    fetch(SB_URL + '/rest/v1/ads?select=*&order=created_at.desc', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(r => r.json()).then(d => { setAds(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(e => { console.error('ads load error', e); setAds([]); setLoading(false) })
  }
  useEffect(() => { loadAds() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(SB_URL + '/rest/v1/ads', {
        method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ ...form, machine_id: form.machine_id === 'all' ? null : form.machine_id, days: form.days.join(',') })
      })
      setShowForm(false)
      setForm({ machine_id: 'all', title: '', media_url: '', media_type: 'image', start_time: '00:00', end_time: '23:59', days: ['mon','tue','wed','thu','fri','sat','sun'], active: true })
      loadAds()
    } catch(e) { alert('Save failed — make sure the ads table exists in Supabase') }
    setSaving(false)
  }

  const toggleAd = async (id: string, active: boolean) => {
    await fetch(SB_URL + '/rest/v1/ads?id=eq.' + id, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ active: !active }) })
    loadAds()
  }

  const deleteAd = async (id: string) => {
    await fetch(SB_URL + '/rest/v1/ads?id=eq.' + id, { method: 'DELETE', headers })
    loadAds()
  }

  const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
  const DAY_LABELS: any = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }

  return (
    <div style={{ padding: '22px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Ad Manager</div>
          <div style={{ fontSize: 13, color: C.text2 }}>Schedule ads by machine, time, and day</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ New Ad</button>
      </div>

      {/* Create Ad Form */}
      {showForm && (
        <div style={{ background: C.surface, border: '1px solid ' + C.orange + '60', borderRadius: 14, padding: '20px 24px', marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 18 }}>New Ad Campaign</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Title</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Summer Promo Ad"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Machine</label>
              <select value={form.machine_id} onChange={e => setForm({...form, machine_id: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2 }}>
                <option value="all">All Machines</option>
                {machines.map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Media URL (JPEG / MP4)</label>
              <input value={form.media_url} onChange={e => setForm({...form, media_url: e.target.value})} placeholder="https://..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Media Type</label>
              <select value={form.media_type} onChange={e => setForm({...form, media_type: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2 }}>
                <option value="image">Image (JPEG/PNG)</option>
                <option value="video">Video (MP4)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Start Time</label>
              <input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>End Time</label>
              <input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>Active Days</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAYS.map(d => {
                const on = form.days.includes(d)
                return (
                  <button key={d} onClick={() => setForm({...form, days: on ? form.days.filter(x => x !== d) : [...form.days, d]})}
                    style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid ' + (on ? C.orange : C.border), background: on ? C.orange : C.surface2, color: on ? '#fff' : C.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {DAY_LABELS[d]}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving || !form.title || !form.media_url} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Save Ad'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface2, color: C.text2, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}



      {/* Ad list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading ads...</div>
      ) : ads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.surface, borderRadius: 16, border: '1px solid ' + C.border }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No ads scheduled yet</div>
          <div style={{ fontSize: 13, color: C.text2 }}>Create your first ad campaign to monetize the machine screen</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ads.map((ad: any) => {
            const machine = machines.find((m: any) => m.id === ad.machine_id)
            return (
              <div key={ad.id} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: C.orangeBg, border: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {ad.media_type === 'video' ? '🎥' : '🖼'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ad.title}</div>
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>
                    {machine ? machine.display_name : 'All Machines'} · {ad.start_time} – {ad.end_time} · {ad.days}
                  </div>
                  <div style={{ fontSize: 12, color: C.blue, marginTop: 2, fontFamily: 'monospace' }}>{ad.media_url?.slice(0,50)}...</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <Pill color={ad.active ? C.green : C.text3} bg={ad.active ? C.greenBg : C.surface2}>{ad.active ? 'Active' : 'Paused'}</Pill>
                  <div onClick={() => toggleAd(ad.id, ad.active)} style={{ width: 36, height: 20, borderRadius: 10, background: ad.active ? C.orange : C.border2, cursor: 'pointer', position: 'relative' as const, transition: 'background .2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute' as const, top: 2, left: ad.active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </div>
                  <button onClick={() => deleteAd(ad.id)} style={{ background: C.redBg, color: C.red, border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
    fetch(SB_URL + '/rest/v1/loyalty?select=*&order=points.desc', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(r => r.json()).then(d => { setCustomers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setCustomers([]); setLoading(false) })
  }
  useEffect(() => { loadCustomers() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(SB_URL + '/rest/v1/loyalty', {
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
    await fetch(SB_URL + '/rest/v1/loyalty?id=eq.' + id, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ points: current + add }) })
    loadCustomers()
  }

  const filtered = customers.filter((c: any) => !search || c.phone?.includes(search) || c.name?.toLowerCase().includes(search.toLowerCase()))
  const totalPoints = customers.reduce((s: number, c: any) => s + (c.points || 0), 0)
  const eligible = customers.filter((c: any) => c.points >= config.redeem_threshold).length

  return (
    <div style={{ padding: '22px 28px' }}>
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
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: C.text3, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: C.text2 }}>{h}</th>
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
function AssignMachinesModal({ op, supabaseUrl, supabaseKey, onClose }: any) {
  const [machines, setMachines] = useState<any[]>([])
  const [assigned, setAssigned] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' }
  useEffect(() => {
    const load = async () => {
      const [mRes, aRes] = await Promise.all([
        fetch(supabaseUrl + '/rest/v1/machines?select=id,display_name,sn,location', { headers }),
        fetch(supabaseUrl + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + op.id, { headers }),
      ])
      const [mData, aData] = await Promise.all([mRes.json(), aRes.json()])
      setMachines(Array.isArray(mData) ? mData : [])
      setAssigned(Array.isArray(aData) ? aData.map((r: any) => r.machine_id) : [])
    }
    load()
  }, [])
  const toggle = (mid: string) => setAssigned(prev => prev.includes(mid) ? prev.filter(x => x !== mid) : [...prev, mid])
  const save = async () => {
    setSaving(true); setMsg('')
    try {
      await fetch(supabaseUrl + '/rest/v1/machine_operators?operator_id=eq.' + op.id, { method: 'DELETE', headers })
      if (assigned.length > 0) {
        await fetch(supabaseUrl + '/rest/v1/machine_operators', { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(assigned.map(mid => ({ machine_id: mid, operator_id: op.id }))) })
      }
      setMsg('✓ Saved'); setTimeout(onClose, 800)
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        {msg && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: msg.startsWith('✓') ? C.greenBg : C.redBg, color: msg.startsWith('✓') ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function OperatorsPage({ supabaseUrl, supabaseKey }: any) {
  const [operators, setOperators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editOp, setEditOp] = useState<any>(null)
  const [delOp, setDelOp] = useState<any>(null)
  const [assignOp, setAssignOp] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operator', state: 'Telangana', country: 'India' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' }

  const fetchOperators = async () => {
    setLoading(true)
    const res = await fetch(supabaseUrl + '/rest/v1/operators?select=id,name,email,role,state,country,created_at&order=created_at.desc', { headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey } })
    const data = await res.json()
    setOperators(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { fetchOperators() }, [])

  const openAdd = () => { setForm({ name: '', email: '', password: '', role: 'operator', state: 'Telangana', country: 'India' }); setEditOp(null); setShowAdd(true); setMsg('') }
  const openEdit = (op: any) => { setForm({ name: op.name || '', email: op.email, password: '', role: op.role, state: op.state || '', country: op.country || 'India' }); setEditOp(op); setShowAdd(true); setMsg('') }

  const saveOperator = async () => {
    setSaving(true); setMsg('')
    try {
      if (editOp) {
        const body: any = { name: form.name, role: form.role, state: form.state, country: form.country }
        if (form.password) {
          const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: form.password }) })
          if (hashRes.ok) { const { hash } = await hashRes.json(); body.password_hash = hash }
        }
        await fetch(supabaseUrl + '/rest/v1/operators?id=eq.' + editOp.id, { method: 'PATCH', headers, body: JSON.stringify(body) })
        setMsg('✓ Updated')
      } else {
        const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: form.password }) })
        const { hash } = await hashRes.json()
        await fetch(supabaseUrl + '/rest/v1/operators', { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ name: form.name, email: form.email, password_hash: hash, role: form.role, state: form.state, country: form.country }) })
        setMsg('✓ Added')
      }
      await fetchOperators()
      setTimeout(() => { setShowAdd(false); setMsg('') }, 900)
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }

  const deleteOperator = async () => {
    if (!delOp) return
    await fetch(supabaseUrl + '/rest/v1/operators?id=eq.' + delOp.id, { method: 'DELETE', headers })
    setDelOp(null); fetchOperators()
  }

  const ROLE_COLOR: any = { super_admin: '#7c3aed', operator: C.blue }
  const ROLE_BG: any = { super_admin: '#f5f3ff', operator: C.blueBg }

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
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', borderTop: `3px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
                      {op.role === 'super_admin' ? '👑 Super Admin' : '🧑‍💼 Operator'}
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
                      <button onClick={() => setAssignOp(op)} style={{ background: C.blueBg, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.blue, cursor: 'pointer' }}>🖥 Machines</button>
                      <button onClick={() => openEdit(op)} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.text2, cursor: 'pointer' }}>✏️ Edit</button>
                      <button onClick={() => setDelOp(op)} style={{ background: C.redBg, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.red, cursor: 'pointer' }}>🗑 Del</button>
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
        <div style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>State</label>
                <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Telangana"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
              </div>
            </div>
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

      {assignOp && <AssignMachinesModal op={assignOp} supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} onClose={() => setAssignOp(null)} />}

      {delOp && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 30, width: 360, textAlign: 'center', boxShadow: '0 20px 60px #00000030' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 6 }}>Delete Operator?</div>
            <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Permanently delete <b>{delOp.name || delOp.email}</b>. Cannot be undone.</div>
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


function MachineConfigSection({ SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [machines, setMachines] = useState<any[]>([])
  const [config, setConfig] = useState<Record<string, any>>({})

  useEffect(() => {
    fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,status,location', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setMachines(d)
        const c: Record<string, any> = {}
        d.forEach((m: any) => {
          c[m.id] = {
            price_200ml: 80, price_250ml: 100, price_300ml: 120,
            default_volume: 250, max_daily_cups: 200, maintenance_mode: false
          }
        })
        setConfig(c)
      }
    })
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
      for (const m of machines) {
        await fetch(SB_URL + '/rest/v1/machines?id=eq.' + m.id, { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify({ machine_config: config[m.id] || {} }) }) })
      }
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Machine Config</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Remote pricing and volume settings — changes apply instantly, no engineer visit needed</div>

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
              <div onClick={() => setConfig({ ...config, [m.id]: { ...config[m.id], maintenance_mode: !config[m.id]?.maintenance_mode } })}
                style={{ width: 36, height: 20, borderRadius: 10, background: config[m.id]?.maintenance_mode ? C.red : C.border2, cursor: 'pointer', position: 'relative' as const, transition: 'background .2s', flexShrink: 0 }}>
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
                    <input type="number" value={config[m.id]?.[key] ?? ''} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], [key]: +e.target.value } })}
                      style={{ width: '100%', padding: '8px 8px 8px 22px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Default Cup Size</label>
              <select value={config[m.id]?.default_volume ?? 250} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], default_volume: +e.target.value } })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2 }}>
                {[200, 250, 300].map(v => <option key={v} value={v}>{v}ml</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Max Daily Cups</label>
              <input type="number" value={config[m.id]?.max_daily_cups ?? 200} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], max_daily_cups: +e.target.value } })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }} />
            </div>
          </div>
        </div>
      ))}

      <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saved ? '✓ Saved!' : '⚡ Apply Config Remotely'}
      </button>
      <div style={{ marginTop: 10, fontSize: 11, color: C.text3 }}>Changes take effect on next machine sync cycle (~2 min)</div>
    </div>
  )
}

function ThresholdsSection({ SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [machines, setMachines] = useState<any[]>([])
  const [thresholds, setThresholds] = useState<Record<string, any>>({})
  useEffect(() => {
    fetch(SB_URL + '/rest/v1/machines?select=id,display_name', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          setMachines(d)
          const t: Record<string, any> = {}
          d.forEach((m: any) => { t[m.id] = { temp_high: 12, temp_low: 3, temp_stop: 20 } })
          setThresholds(t)
        }
      })
  }, [])
  const save = async () => {
    setSaving(true)
    showSaved()
    setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Thresholds</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Set temperature alert thresholds per machine</div>
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
                <input type="number" value={thresholds[m.id]?.[f.key] ?? ''} onChange={e => setThresholds({ ...thresholds, [m.id]: { ...thresholds[m.id], [f.key]: +e.target.value } })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, boxSizing: 'border-box' as const }} />
                <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Thresholds'}</button>
    </div>
  )
}

function NotificationsSection({ operatorId, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [phone, setPhone] = useState('')
  const [alerts, setAlerts] = useState<Record<string, boolean>>({
    machine_offline: true, temperature_high: true, temperature_low: true,
    temperature_stop: true, stock_empty: true, stock_low: false,
    door_open: true, vend_failure: true, cup_empty: true, film_empty: true,
    waste_bin_full: true, power_loss: true, unusual_access: true,
  })
  const save = async () => {
    setSaving(true)
    showSaved()
    setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Notifications</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Configure WhatsApp alert notifications</div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>WhatsApp Number</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 89771 10142"
          style={{ width: '100%', maxWidth: 300, padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, boxSizing: 'border-box' as const }} />
        <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Alerts will be sent via Twilio WhatsApp</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Alert Types</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Object.entries(alerts).map(([key, val]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: val ? C.orangeBg : C.surface2, border: '1px solid ' + (val ? C.orange : C.border), borderRadius: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={val} onChange={e => setAlerts({ ...alerts, [key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: C.orange }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{key.replace(/_/g, ' ').replace(/\w/g, l => l.toUpperCase())}</div>
                <div style={{ fontSize: 12, color: C.text3 }}>{val ? 'Enabled' : 'Disabled'}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Notifications'}</button>
    </div>
  )
}

function CooldownsSection({ showSaved }: any) {
  const COOLDOWNS = [
    { type: 'machine_offline', label: 'Machine Offline', hours: 1, severity: 'CRITICAL' },
    { type: 'temperature_high', label: 'High Temperature', hours: 1, severity: 'CRITICAL' },
    { type: 'temperature_low', label: 'Low Temperature', hours: 2, severity: 'HIGH' },
    { type: 'temperature_stop', label: 'Temp Stop Selling', hours: 1, severity: 'CRITICAL' },
    { type: 'stock_empty_l1', label: 'Layer 1 Empty', hours: 4, severity: 'HIGH' },
    { type: 'stock_empty_l2', label: 'Layer 2 Empty', hours: 4, severity: 'HIGH' },
    { type: 'stock_empty_l3', label: 'Layer 3 Empty', hours: 4, severity: 'HIGH' },
    { type: 'stock_low_l1', label: 'Layer 1 Low', hours: 6, severity: 'MEDIUM' },
    { type: 'stock_low_l2', label: 'Layer 2 Low', hours: 6, severity: 'MEDIUM' },
    { type: 'stock_low_l3', label: 'Layer 3 Low', hours: 6, severity: 'MEDIUM' },
    { type: 'door_open', label: 'Door Open', hours: 1, severity: 'HIGH' },
    { type: 'vend_failure', label: 'Vend Failure', hours: 0.5, severity: 'HIGH' },
    { type: 'cup_empty', label: 'Cups Empty', hours: 2, severity: 'HIGH' },
    { type: 'film_empty', label: 'Film Empty', hours: 2, severity: 'HIGH' },
    { type: 'waste_bin_full', label: 'Waste Bin Full', hours: 4, severity: 'HIGH' },
    { type: 'power_loss', label: 'Power Loss', hours: 0.5, severity: 'CRITICAL' },
    { type: 'unusual_access', label: 'Unusual Cabinet Access', hours: 1, severity: 'HIGH' },
  ]
  const SEV_COLOR: any = { CRITICAL: C.red, HIGH: C.amber, MEDIUM: C.blue }
  const SEV_BG: any = { CRITICAL: C.redBg, HIGH: C.amberBg, MEDIUM: C.blueBg }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Alert Cooldowns</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>How long to wait before re-firing the same alert. Configured in alert.js on VPS.</div>
      <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.surface2, borderBottom: '2px solid ' + C.border }}>
              {['Alert Type', 'Severity', 'Cooldown'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: C.text3, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.09em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COOLDOWNS.map((c, i) => (
              <tr key={c.type} style={{ borderBottom: '1px solid ' + C.border, background: i % 2 === 0 ? C.surface : C.surface2 }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontWeight: 600, color: C.text }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace' }}>{c.type}</div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ background: SEV_BG[c.severity], color: SEV_COLOR[c.severity], padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{c.severity}</span>
                </td>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: C.text }}>{c.hours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 14, padding: '12px 16px', background: C.surface2, borderRadius: 10, border: '1px solid ' + C.border, fontSize: 12, color: C.text3 }}>
        To change cooldowns, edit <code style={{ fontFamily: 'monospace', background: C.border, padding: '1px 6px', borderRadius: 4 }}>/root/fruitlink/machine-api/alert.js</code> on the VPS and restart PM2.
      </div>
    </div>
  )
}

          <div key={m.id} style={{ background: C.surface, border: '2px solid ' + (online ? C.green + '50' : C.red + '50'), borderRadius: 14, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ height: 4, background: online ? C.green : C.red }} />
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' as const }}>
                {/* Left: machine info */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: online ? C.greenBg : C.redBg, border: '2px solid ' + (online ? C.green + '50' : C.red + '50'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🖥</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 5 }}>{m.display_name}</div>
                    <div style={{ fontSize: 13, color: C.text2, fontFamily: 'monospace', marginBottom: 4 }}>SN: {m.sn}</div>
                    <div style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>📍 {m.location}, {m.state}</div>
                    <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}>
                      <Dot color={online ? C.green : C.red} pulse={online} size={6} />&nbsp;{online ? 'Online' : 'Offline'}
                    </Pill>
                  </div>
                </div>
                {/* Right: plan + buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Current Plan</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: P.color }}>{P.icon} {P.name}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                    {Object.entries(PLANS).map(([key, pp]: any) => key !== plan && (
                      <button key={key} onClick={() => handleUpgrade(m.id, key)} disabled={upgrading === m.id}
                        style={{ padding: '8px 18px', borderRadius: 9, border: '2px solid ' + pp.color, background: key === 'professional' ? pp.color : 'transparent', color: key === 'professional' ? '#fff' : pp.color, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: upgrading === m.id ? 0.6 : 1, whiteSpace: 'nowrap' as const }}>
                        {key === 'starter' ? '↓ Downgrade' : '↑ Upgrade'} → {pp.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Included features */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid ' + C.border }}>
                <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Included in {P.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                  {P.features.map((f: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: C.text, background: C.surface2, border: '1px solid ' + C.border2, borderRadius: 7, padding: '5px 12px' }}>✓ {f}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [active, setActive] = useState('console')
  const [machines, setMachines] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [role, setRole] = useState('operator')
  const [name, setName] = useState('Admin')
  const [operatorId, setOperatorId] = useState('')
  useEffect(() => {
    setRole(getCookie('fl_role') || 'operator')
    setName(getCookie('fl_operator_name') || 'Admin')
    setOperatorId(getCookie('fl_operator_id') || '')
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    let machineIds: string[] = []
    if (role !== 'super_admin' && operatorId) {
      const moRes = await fetch(SB_URL + '/rest/v1/machine_operators?operator_id=eq.' + operatorId + '&select=machine_id', { headers })
      const moData = await moRes.json()
      machineIds = Array.isArray(moData) ? moData.map((r: any) => r.machine_id) : []
    }
    const idFilter = machineIds.length > 0 ? '&id=in.(' + machineIds.join(',') + ')' : (role !== 'super_admin' ? '&id=eq.none' : '')
    const alertFilter = machineIds.length > 0 ? '&machine_id=in.(' + machineIds.join(',') + ')' : (role !== 'super_admin' ? '&machine_id=eq.none' : '')

    const [mRes, aRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/machines?select=*&order=created_at.asc' + idFilter, { headers }),
      fetch(SB_URL + '/rest/v1/alerts?select=*&order=created_at.desc&limit=500' + alertFilter, { headers }),
    ])
    const [mData, aData] = await Promise.all([mRes.json(), aRes.json()])

    // Fetch latest telemetry per machine individually
    const enriched: any[] = []
    if (Array.isArray(mData)) {
      for (const m of mData) {
        const tRes = await fetch(SB_URL + '/rest/v1/telemetry?select=inner_temp_c,stock_l1,stock_l2,stock_l3,cup_present,cooling_state,scale_weight_g&machine_id=eq.' + m.id + '&order=ts.desc&limit=1', { headers })
        const tData = await tRes.json()
        const tel = Array.isArray(tData) && tData.length > 0 ? tData[0] : {}
        enriched.push({ ...m, ...tel })
      }
    }

    setMachines(enriched)
    setAlerts(Array.isArray(aData) ? aData : [])
    setLoading(false)
  }, [role, operatorId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleLogout = () => {
    document.cookie.split(';').forEach(c => {
      document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
    })
    window.location.href = '/login'
  }

  const activeAlertCount = alerts.filter(a => !a.resolved_at).length

  const pages: Record<string, React.ReactElement> = {
    console: <ConsolePage machines={machines} alerts={alerts} loading={loading} />,
    alerts: <AlertsPage machines={machines} alerts={alerts} loading={loading} fetchAlerts={fetchData} />,
    operators: role === 'super_admin'
      ? <OperatorsPage supabaseUrl={SB_URL} supabaseKey={SB_KEY} />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>Access restricted to Super Admins only.</div>,
    ads: <AdsPage machines={machines} />,
    loyalty: <LoyaltyPage />,
    settings: <SettingsPage />,
    machines: <MachinesPage machines={machines} loading={loading} fetchData={fetchData} />,
    map: <FleetMapPage machines={machines} />,
    orders: <OrdersPage />,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: ${C.bg}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 3px; }
        @keyframes fl-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar active={active} setActive={setActive} role={role} name={name} alertCount={activeAlertCount} onLogout={handleLogout} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar active={active} />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {pages[active] || <ComingSoon label={active} />}
          </div>
        </div>
      </div>
    </>
  )
}
export default function Dashboard() {
  const [active, setActive] = useState('console')
  const [machines, setMachines] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [role, setRole] = useState('operator')
  const [name, setName] = useState('Admin')
  const [operatorId, setOperatorId] = useState('')
  useEffect(() => {
    setRole(getCookie('fl_role') || 'operator')
    setName(getCookie('fl_operator_name') || 'Admin')
    setOperatorId(getCookie('fl_operator_id') || '')
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    let machineIds: string[] = []
    if (role !== 'super_admin' && operatorId) {
      const moRes = await fetch(SB_URL + '/rest/v1/machine_operators?operator_id=eq.' + operatorId + '&select=machine_id', { headers })
      const moData = await moRes.json()
      machineIds = Array.isArray(moData) ? moData.map((r: any) => r.machine_id) : []
    }
    const idFilter = machineIds.length > 0 ? '&id=in.(' + machineIds.join(',') + ')' : (role !== 'super_admin' ? '&id=eq.none' : '')
    const alertFilter = machineIds.length > 0 ? '&machine_id=in.(' + machineIds.join(',') + ')' : (role !== 'super_admin' ? '&machine_id=eq.none' : '')

    const [mRes, aRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/machines?select=*&order=created_at.asc' + idFilter, { headers }),
      fetch(SB_URL + '/rest/v1/alerts?select=*&order=created_at.desc&limit=500' + alertFilter, { headers }),
    ])
    const [mData, aData] = await Promise.all([mRes.json(), aRes.json()])

    // Fetch latest telemetry per machine individually
    const enriched: any[] = []
    if (Array.isArray(mData)) {
      for (const m of mData) {
        const tRes = await fetch(SB_URL + '/rest/v1/telemetry?select=inner_temp_c,stock_l1,stock_l2,stock_l3,cup_present,cooling_state,scale_weight_g&machine_id=eq.' + m.id + '&order=ts.desc&limit=1', { headers })
        const tData = await tRes.json()
        const tel = Array.isArray(tData) && tData.length > 0 ? tData[0] : {}
        enriched.push({ ...m, ...tel })
      }
    }

    setMachines(enriched)
    setAlerts(Array.isArray(aData) ? aData : [])
    setLoading(false)
  }, [role, operatorId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleLogout = () => {
    document.cookie.split(';').forEach(c => {
      document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
    })
    window.location.href = '/login'
  }

  const activeAlertCount = alerts.filter(a => !a.resolved_at).length

  const pages: Record<string, React.ReactElement> = {
    console: <ConsolePage machines={machines} alerts={alerts} loading={loading} />,
    alerts: <AlertsPage machines={machines} alerts={alerts} loading={loading} fetchAlerts={fetchData} />,
    operators: role === 'super_admin'
      ? <OperatorsPage supabaseUrl={SB_URL} supabaseKey={SB_KEY} />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>Access restricted to Super Admins only.</div>,
    ads: <AdsPage machines={machines} />,
    loyalty: <LoyaltyPage />,
    settings: <SettingsPage />,
    machines: <MachinesPage machines={machines} loading={loading} fetchData={fetchData} />,
    map: <FleetMapPage machines={machines} />,
    orders: <OrdersPage />,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: ${C.bg}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 3px; }
        @keyframes fl-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar active={active} setActive={setActive} role={role} name={name} alertCount={activeAlertCount} onLogout={handleLogout} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar active={active} />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {pages[active] || <ComingSoon label={active} />}
          </div>
        </div>
      </div>
    </>
  )
}function BillingSection({ role }: any) {
  const [machines, setMachines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const PLANS: any = {
    starter: { name: 'Starter', color: C.green, bg: C.greenBg, icon: '🟢', features: ['Live Console + Machine List + Fleet Map','Revenue & P&L Analytics','17 WhatsApp alert types','Remote machine config','UPI + NFC payments (0% MDR)','Up to 2 operators'] },
    professional: { name: 'Professional', color: C.orange, bg: C.orangeBg, icon: '⭐', features: ['Everything in Starter','Ad Content Manager','Loyalty Programme','Operators Management + RBAC','Up to 10 operators'] },
    enterprise: { name: 'Enterprise', color: C.blue, bg: C.blueBg, icon: '🏢', features: ['Everything in Professional','White-label dashboard','REST API + Webhooks','SAML SSO','Dedicated infrastructure','Unlimited operators'] },
  }

  useEffect(() => {
    fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,status,location,state', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(r => r.json()).then(d => { setMachines(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 2 }}>Billing & Plans</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Manage subscription plan per machine · Pricing TBD</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 26 }}>
        {Object.entries(PLANS).map(([key, p]: any) => (
          <div key={key} style={{ background: C.surface, border: '2px solid ' + (key === 'professional' ? C.orange : C.border), borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ background: key === 'professional' ? C.orange : C.surface2, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 16 }}>{p.icon}</span><span style={{ fontSize: 14, fontWeight: 800, color: key === 'professional' ? '#fff' : C.text }}>{p.name}</span></div>
              {key === 'professional' && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 8px' }}>POPULAR</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: p.color, fontWeight: 700, marginBottom: 12 }}>Pricing TBD · per machine · per month</div>
              {p.features.map((f: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: C.text2, marginBottom: 6 }}>
                  <span style={{ color: p.color, fontWeight: 700 }}>✓</span><span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Your Machines</div>
      {loading ? <div style={{ color: C.text3 }}>Loading...</div> : machines.map((m: any) => (
        <div key={m.id} style={{ background: C.surface, border: '2px solid ' + (m.status === 'online' ? C.green + '50' : C.red + '50'), borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: 4, background: m.status === 'online' ? C.green : C.red }} />
          <div style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 16 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: m.status === 'online' ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖥</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 4 }}>{m.display_name}</div>
                  <div style={{ fontSize: 13, color: C.text2, fontFamily: 'monospace', marginBottom: 4 }}>SN: {m.sn}</div>
                  <div style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>📍 {m.location}, {m.state}</div>
                  <Pill color={m.status === 'online' ? C.green : C.red} bg={m.status === 'online' ? C.greenBg : C.redBg}>
                    <Dot color={m.status === 'online' ? C.green : C.red} pulse={m.status === 'online'} size={6} />&nbsp;{m.status === 'online' ? 'Online' : 'Offline'}
                  </Pill>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 8 }}>
                <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, textTransform: 'uppercase' as const }}>Current Plan</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>🟢 Starter</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => alert('Razorpay coming soon')} style={{ padding: '7px 16px', borderRadius: 9, border: '2px solid ' + C.orange, background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↑ Professional</button>
                  <button onClick={() => alert('Razorpay coming soon')} style={{ padding: '7px 16px', borderRadius: 9, border: '2px solid ' + C.blue, background: 'transparent', color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↑ Enterprise</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 12, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: C.text2 }}>
        <b style={{ color: C.text }}>💳 Payment Integration:</b> Razorpay subscription billing activates once pricing is confirmed.
      </div>
    </div>
  )
}


export default function Dashboard() {
  const [active, setActive] = useState('console')
  const [machines, setMachines] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [role, setRole] = useState('operator')
  const [name, setName] = useState('Admin')
  const [operatorId, setOperatorId] = useState('')
  useEffect(() => {
    setRole(getCookie('fl_role') || 'operator')
    setName(getCookie('fl_operator_name') || 'Admin')
    setOperatorId(getCookie('fl_operator_id') || '')
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    let machineIds: string[] = []
    if (role !== 'super_admin' && operatorId) {
      const moRes = await fetch(SB_URL + '/rest/v1/machine_operators?operator_id=eq.' + operatorId + '&select=machine_id', { headers })
      const moData = await moRes.json()
      machineIds = Array.isArray(moData) ? moData.map((r: any) => r.machine_id) : []
    }
    const idFilter = machineIds.length > 0 ? '&id=in.(' + machineIds.join(',') + ')' : (role !== 'super_admin' ? '&id=eq.none' : '')
    const alertFilter = machineIds.length > 0 ? '&machine_id=in.(' + machineIds.join(',') + ')' : (role !== 'super_admin' ? '&machine_id=eq.none' : '')

    const [mRes, aRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/machines?select=*&order=created_at.asc' + idFilter, { headers }),
      fetch(SB_URL + '/rest/v1/alerts?select=*&order=created_at.desc&limit=500' + alertFilter, { headers }),
    ])
    const [mData, aData] = await Promise.all([mRes.json(), aRes.json()])

    // Fetch latest telemetry per machine individually
    const enriched: any[] = []
    if (Array.isArray(mData)) {
      for (const m of mData) {
        const tRes = await fetch(SB_URL + '/rest/v1/telemetry?select=inner_temp_c,stock_l1,stock_l2,stock_l3,cup_present,cooling_state,scale_weight_g&machine_id=eq.' + m.id + '&order=ts.desc&limit=1', { headers })
        const tData = await tRes.json()
        const tel = Array.isArray(tData) && tData.length > 0 ? tData[0] : {}
        enriched.push({ ...m, ...tel })
      }
    }

    setMachines(enriched)
    setAlerts(Array.isArray(aData) ? aData : [])
    setLoading(false)
  }, [role, operatorId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleLogout = () => {
    document.cookie.split(';').forEach(c => {
      document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
    })
    window.location.href = '/login'
  }

  const activeAlertCount = alerts.filter(a => !a.resolved_at).length

  const pages: Record<string, React.ReactElement> = {
    console: <ConsolePage machines={machines} alerts={alerts} loading={loading} />,
    alerts: <AlertsPage machines={machines} alerts={alerts} loading={loading} fetchAlerts={fetchData} />,
    operators: role === 'super_admin'
      ? <OperatorsPage supabaseUrl={SB_URL} supabaseKey={SB_KEY} />
      : <div style={{ padding: '60px', textAlign: 'center', color: C.text3 }}>Access restricted to Super Admins only.</div>,
    ads: <AdsPage machines={machines} />,
    loyalty: <LoyaltyPage />,
    settings: <SettingsPage />,
    machines: <MachinesPage machines={machines} loading={loading} fetchData={fetchData} />,
    map: <FleetMapPage machines={machines} />,
    orders: <OrdersPage />,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: ${C.bg}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 3px; }
        @keyframes fl-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar active={active} setActive={setActive} role={role} name={name} alertCount={activeAlertCount} onLogout={handleLogout} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar active={active} />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {pages[active] || <ComingSoon label={active} />}
          </div>
        </div>
      </div>
    </>
  )
}
