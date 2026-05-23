'use client'
import { useState, useEffect, useCallback } from 'react'

const SB_URL = 'https://fpwvutdvwnvrunviporz.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk'

// ─── Design Tokens ───────────────────────────────────────────────
const C = {
  sidebar:   '#1c2333',
  sidebarB:  '#161b27',
  sidebarT:  '#2a3649',
  active:    '#f97316',
  activeGlow:'#f9731620',
  bg:        '#f0f2f7',
  surface:   '#ffffff',
  surface2:  '#f8f9fc',
  border:    '#e4e7ef',
  border2:   '#d0d4e4',
  text:      '#0f1117',
  text2:     '#5a6080',
  text3:     '#9099b8',
  textSide:  '#c8cde8',
  textSide2: '#8892b8',
  textSide3: '#5a6090',
  green:     '#16a34a',
  greenBg:   '#dcfce7',
  red:       '#dc2626',
  redBg:     '#fee2e2',
  amber:     '#d97706',
  amberBg:   '#fef3c7',
  blue:      '#2563eb',
  blueBg:    '#dbeafe',
  orange:    '#f97316',
  orangeBg:  '#ffedd5',
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
      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
      padding: '2px 7px', borderRadius: 10,
      background: bg || color + '22', color,
      textTransform: 'uppercase' as const,
    }}>{children}</span>
  )
}

function Pill({ children, color, bg }: any) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 20, background: bg, color,
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
            <div style={{ fontSize: 10.5, color: C.textSide3, letterSpacing: '0.07em', marginTop: 1 }}>TECHNOLOGIES PVT LTD</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff12', borderRadius: 8, padding: '6px 10px' }}>
          <Dot color={C.green} pulse size={6} />
          <span style={{ fontSize: 11, color: C.textSide, fontWeight: 500 }}>Online</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textSide3 }}>System OK</span>
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
                    <span style={{ background: C.red, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{alertCount}</span>
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
      padding: '18px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '14px 14px 0 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: C.text2, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: '-0.03em', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.text3, marginBottom: 10 }}>{sub}</div>
      {pct !== undefined && (
        <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
        </div>
      )}
    </div>
  )
}

// ─── Machine Card ────────────────────────────────────────────────
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
      <div style={{ height: 4, background: online ? C.green : C.border2 }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3 }}>{machine.display_name}</div>
            <div style={{ fontSize: 10, color: C.text3, fontFamily: 'monospace', letterSpacing: '0.03em' }}>{machine.sn}</div>
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
              <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, marginBottom: 5, letterSpacing: '0.05em' }}>LAYER {i + 1}</div>
              <div style={{ fontSize: 17, marginBottom: 3 }}>{online ? (has ? '🟢' : '🔴') : '⚫'}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: online ? (has ? C.green : C.red) : C.text3 }}>
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
              <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.value}</div>
              {f.sub && <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>{f.sub}</div>}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
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
              background: i % 2 === 0 ? '#fff' : C.surface2,
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
          <div key={s} onClick={() => setSevFilter(sevFilter === s ? 'all' : s)} style={{
            background: sevFilter === s ? SEVERITY_BG[s] : C.surface,
            border: `1px solid ${sevFilter === s ? SEVERITY_COLOR[s] + '60' : C.border}`,
            borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
            borderTop: `3px solid ${SEVERITY_COLOR[s]}`,
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: counts[s] > 0 ? SEVERITY_COLOR[s] : C.border2, letterSpacing: '-0.02em', marginBottom: 4 }}>{counts[s]}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: SEVERITY_COLOR[s], textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{s}</div>
            <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>Active alerts</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: C.surface2, borderRadius: 10, padding: 4, width: 'fit-content', border: `1px solid ${C.border}` }}>
        {([['active', `Active (${counts.active})`], ['resolved', `Resolved (${counts.resolved})`], ['all', 'All']] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as any)} style={{
            padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: filter === f ? C.sidebar : 'transparent',
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
                    <div style={{ fontSize: 10, color: C.text3, fontFamily: 'monospace', marginTop: 1 }}>{m.location} · {m.sn}</div>
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
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: C.text2, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.07em', width: ['12%','52%','18%','18%'][i] }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {machAlerts.map((a: any, i: number) => (
                          <tr key={a.id} style={{ borderBottom: i < machAlerts.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? '#fff' : C.surface2 }}>
                            <td style={{ padding: '12px 16px' }}>
                              <Pill color={SEVERITY_COLOR[a.severity] || C.text2} bg={SEVERITY_BG[a.severity] || C.surface2}>{a.severity}</Pill>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'inline-block', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 5, padding: '1px 7px', fontSize: 10, fontFamily: 'monospace', color: C.text2, marginBottom: 4 }}>{a.alert_type}</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ALERT_LABELS[a.alert_type] || a.alert_type}</div>
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

  useEffect(() => {
    const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    Promise.all([
      fetch(SB_URL + '/rest/v1/orders?select=*&order=created_at.desc&limit=200', { headers }).then(r => r.json()),
      fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,location', { headers }).then(r => r.json()),
    ]).then(([o, m]) => {
      setOrders(Array.isArray(o) ? o : [])
      setMachines(Array.isArray(m) ? m : [])
      setLoading(false)
    })
  }, [])

  const getMachine = (id: string) => machines.find((m: any) => m.id === id) || {} as any
  const fmtTime = (t: string) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fmtAgo = (t: string) => { const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m/60) + 'h ago'; return Math.floor(m/1440) + 'd ago' }
  const fmtAmount = (p: number) => '₹' + (p / 100).toFixed(2)

  const PAY_STATE: any = { 0: { label: 'Pending', color: C.amber, bg: C.amberBg }, 1: { label: 'Paid', color: C.green, bg: C.greenBg }, 2: { label: 'Failed', color: C.red, bg: C.redBg } }
  const DEL_STATE: any = { 0: { label: 'Pending', color: C.amber, bg: C.amberBg }, 1: { label: 'Delivered', color: C.green, bg: C.greenBg }, 2: { label: 'Failed', color: C.red, bg: C.redBg } }
  const PAY_TYPE: any = { upi: '📱 UPI', cash: '💵 Cash', card: '💳 Card', qr: '📲 QR' }

  const filtered = orders.filter((o: any) => {
    if (filter === 'paid') return o.pay_state === 1
    if (filter === 'pending') return o.pay_state === 0
    if (filter === 'delivered') return o.delivery_state === 1
    return true
  })

  const totalRevenue = orders.filter((o: any) => o.pay_state === 1).reduce((s: number, o: any) => s + (o.amount_paise || 0), 0)
  const totalOrders = orders.length
  const paid = orders.filter((o: any) => o.pay_state === 1).length
  const pending = orders.filter((o: any) => o.pay_state === 0).length

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Orders</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{totalOrders} total orders across all machines</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Orders', value: totalOrders, color: C.blue, icon: '🧾', pct: 100 },
          { label: 'Total Revenue', value: fmtAmount(totalRevenue), color: C.green, icon: '₹', pct: paid > 0 ? (paid/totalOrders)*100 : 0 },
          { label: 'Paid', value: paid, color: C.green, icon: '✅', pct: totalOrders > 0 ? (paid/totalOrders)*100 : 0 },
          { label: 'Pending Payment', value: pending, color: C.amber, icon: '⏳', pct: totalOrders > 0 ? (pending/totalOrders)*100 : 0 },
        ].map(s => <StatCard key={s.label} {...s} sub="" />)}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: C.surface2, borderRadius: 10, padding: 4, width: 'fit-content', border: `1px solid ${C.border}` }}>
        {[['all','All Orders'], ['paid','Paid'], ['pending','Pending'], ['delivered','Delivered']].map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: filter === f ? C.sidebar : 'transparent',
            color: filter === f ? '#fff' : C.text2,
            fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No orders found</div>
        </div>
      ) : (
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surface2, borderBottom: `2px solid ${C.border}` }}>
                {['Order Code', 'Machine', 'Amount', 'Payment', 'Delivery', 'Cups', 'Time'].map((h, i) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.text2, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any, i: number) => {
                const m = getMachine(o.machine_id)
                const ps = PAY_STATE[o.pay_state] || PAY_STATE[0]
                const ds = DEL_STATE[o.delivery_state] || DEL_STATE[0]
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? '#fff' : C.surface2 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.blue }}>{o.order_code}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{m.display_name || '—'}</div>
                      <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>{m.location || ''}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: C.green, fontSize: 14 }}>{fmtAmount(o.amount_paise || 0)}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Pill color={ps.color} bg={ps.bg}>{ps.label}</Pill>
                      <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>{PAY_TYPE[o.pay_type] || o.pay_type}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Pill color={ds.color} bg={ds.bg}>{ds.label}</Pill>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: C.text }}>{o.cup_num || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 12, color: C.text }}>{fmtTime(o.created_at)}</div>
                      <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>{fmtAgo(o.created_at)}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, background: C.surface2, fontSize: 11, color: C.text3 }}>
            Showing {filtered.length} of {orders.length} orders
          </div>
        </div>
      )}
    </div>
  )
}

function FleetMapPage({ machines }: { machines: any[] }) {
  const coords: any = {
    'SR Nagar, Ameerpet': { lat: 17.4374, lng: 78.4487 },
    'Cheeriyal, ECIL': { lat: 17.4702, lng: 78.5607 },
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Fleet Map</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{machines.length} machines · {machines.filter(m => m.status === 'online').length} online</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', minHeight: 480 }}>
          <iframe
            src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFmBWY&center=17.45,78.49&zoom=12&maptype=roadmap`}
            style={{ width: '100%', height: '100%', minHeight: 480, border: 'none' }}
            title="Fleet Map"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {machines.map((m: any) => {
            const coord = coords[m.location] || null
            const online = m.status === 'online'
            return (
              <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px', borderTop: `3px solid ${online ? C.green : C.border2}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                    <div style={{ fontSize: 10, color: C.text3, fontFamily: 'monospace', marginTop: 2 }}>{m.sn}</div>
                  </div>
                  <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}>
                    <Dot color={online ? C.green : C.red} pulse={online} size={5} />
                    {online ? 'Online' : 'Offline'}
                  </Pill>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.location || '—'}</div>
                    <div style={{ fontSize: 11, color: C.text3 }}>{m.state}, {m.country}</div>
                  </div>
                </div>
                {coord && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, color: C.text3, fontFamily: 'monospace' }}>📌 {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}</span>
                  </div>
                )}
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ background: C.surface2, borderRadius: 7, padding: '6px 10px', fontSize: 11 }}>
                    <div style={{ color: C.text3, marginBottom: 2 }}>Temperature</div>
                    <div style={{ fontWeight: 600, color: m.inner_temp_c > 12 ? C.red : C.green }}>{m.inner_temp_c != null ? m.inner_temp_c + '°C' : '—'}</div>
                  </div>
                  <div style={{ background: C.surface2, borderRadius: 7, padding: '6px 10px', fontSize: 11 }}>
                    <div style={{ color: C.text3, marginBottom: 2 }}>App Version</div>
                    <div style={{ fontWeight: 600, color: C.text }}>{m.app_version ? 'v' + m.app_version : '—'}</div>
                  </div>
                </div>
              </div>
            )
          })}

          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Add GPS Coordinates</div>
            <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>
              To pin machines on the map, update lat/lng in machine settings. Currently showing approximate Hyderabad area.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MachinesPage({ machines, loading, fetchData }: any) {
  const fmtTime = (t: string) => { if (!t) return '—'; const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m/60) + 'h ago'; return Math.floor(m/1440) + 'd ago' }
  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Machine List</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{machines.length} machines registered · {machines.filter((m: any) => m.status === 'online').length} online</div>
        </div>
        <button onClick={fetchData} style={{ background: C.sidebar, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Machines', value: machines.length, color: C.blue, icon: '🖥', pct: 100 },
          { label: 'Online', value: machines.filter((m: any) => m.status === 'online').length, color: C.green, icon: '📡', pct: machines.length > 0 ? (machines.filter((m: any) => m.status === 'online').length / machines.length) * 100 : 0 },
          { label: 'Offline', value: machines.filter((m: any) => m.status === 'offline').length, color: C.red, icon: '📴', pct: machines.length > 0 ? (machines.filter((m: any) => m.status === 'offline').length / machines.length) * 100 : 0 },
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
              <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ height: 4, background: online ? C.green : C.border2 }} />
                <div style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: online ? C.greenBg : C.surface2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖥</div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>{m.display_name}</div>
                        <div style={{ fontSize: 11, color: C.text3, fontFamily: 'monospace', marginTop: 3 }}>{m.sn}</div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>📍 {m.location || '—'} · {m.state}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}>
                        <Dot color={online ? C.green : C.red} pulse={online} size={5} />
                        {online ? 'Online' : 'Offline'}
                      </Pill>
                      {m.app_version && <Badge color={C.blue}>v{m.app_version}</Badge>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr) 2fr 2fr 2fr', gap: 10 }}>
                    {layers.map((has: boolean, i: number) => (
                      <div key={i} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px', textAlign: 'center', borderTop: `2px solid ${online ? (has ? C.green : C.red) : C.border2}` }}>
                        <div style={{ fontSize: 9, color: C.text3, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>LAYER {i + 1}</div>
                        <div style={{ fontSize: 18, marginBottom: 3 }}>{online ? (has ? '🟢' : '🔴') : '⚫'}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: online ? (has ? C.green : C.red) : C.text3 }}>
                          {online ? (has ? 'Stocked' : 'Empty') : '—'}
                        </div>
                      </div>
                    ))}
                    {[
                      { label: 'Temperature', value: temp != null ? temp + '°C' : '—', color: tempColor, sub: temp != null ? (temp > 12 ? 'High ⚠️' : temp < 3 ? 'Low ⚠️' : 'Normal ✓') : '' },
                      { label: 'Cup Tray', value: m.cup_present === true ? 'Present ✓' : m.cup_present === false ? 'Missing ⚠️' : '—', color: m.cup_present ? C.green : m.cup_present === false ? C.red : C.text3, sub: '' },
                      { label: 'Last Seen', value: fmtTime(m.last_seen), color: C.text, sub: online ? 'Active now' : 'Disconnected' },
                    ].map(f => (
                      <div key={f.label} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, color: C.text3, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.value}</div>
                        {f.sub && <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{f.sub}</div>}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {[
                        { label: 'Machine ID', value: m.id.slice(0,8) + '...' },
                        { label: 'Scale Weight', value: m.scale_weight_g != null ? m.scale_weight_g + 'g' : '—' },
                        { label: 'Cooling', value: m.cooling_state === true ? 'Active' : m.cooling_state === false ? 'Off' : '—' },
                      ].map(f => (
                        <div key={f.label}>
                          <div style={{ fontSize: 9, color: C.text3, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: f.label === 'Machine ID' ? 'monospace' : 'inherit' }}>{f.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Badge color={m.machine_halted ? C.red : C.green}>{m.machine_halted ? 'Halted' : 'Running'}</Badge>
                    </div>
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
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.text2, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operators.map((op, i) => (
                <tr key={op.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? '#fff' : C.surface2 }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {(op.name || op.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: C.text }}>{op.name || '—'}</div>
                        <div style={{ fontSize: 10, color: C.text3, fontFamily: 'monospace' }}>{op.id.slice(0, 8)}...</div>
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
                    <div style={{ fontSize: 10, color: C.text3 }}>{op.country}</div>
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
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: '#fff', color: C.text }}>
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
function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const operatorId = getCookie('fl_operator_id') || ''
  const name = getCookie('fl_operator_name') || 'Admin'
  const role = getCookie('fl_role') || 'operator'
  const state = getCookie('fl_state') || 'Telangana'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const SB_URL2 = SB_URL
  const SB_KEY2 = SB_KEY
  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  const showErr = (m: string) => { setErrMsg(m); setTimeout(() => setErrMsg(''), 3000) }

  const navItems = [
    { group: 'Account', items: [{ key: 'profile', label: 'Profile', icon: '👤' }, { key: 'security', label: 'Security', icon: '🔒' }] },
    { group: 'Machines', items: [{ key: 'thresholds', label: 'Thresholds', icon: '🌡' }, { key: 'locations', label: 'Locations', icon: '📍' }] },
    { group: 'Alerts', items: [{ key: 'notifications', label: 'Notifications', icon: '🔔' }, { key: 'cooldowns', label: 'Cooldowns', icon: '⏱' }] },
    { group: 'System', items: [{ key: 'billing', label: 'Billing', icon: '💳' }, { key: 'danger', label: 'Danger Zone', icon: '⚠️' }] },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 20, letterSpacing: '-0.02em' }}>Settings</div>
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Settings Nav */}
        <div style={{ width: 200, flexShrink: 0 }}>
          {navItems.map(group => (
            <div key={group.group} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{group.group}</div>
              {group.items.map(item => (
                <button key={item.key} onClick={() => setActiveSection(item.key)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2,
                  background: activeSection === item.key ? C.orangeBg : 'transparent',
                  color: activeSection === item.key ? C.orange : C.text2,
                  fontSize: 13, fontWeight: activeSection === item.key ? 600 : 400, textAlign: 'left' as const,
                  borderRight: activeSection === item.key ? `3px solid ${C.orange}` : '3px solid transparent',
                  transition: 'all 0.12s',
                }}>
                  <span>{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Settings Content */}
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px' }}>
          {(saved || errMsg) && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 9, background: saved ? C.greenBg : C.redBg, color: saved ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>
              {saved ? '✓ Changes saved successfully' : errMsg}
            </div>
          )}
          {activeSection === 'profile' && (
            <ProfileSection operatorId={operatorId} name={name} role={role} state={state} initials={initials} SB_URL={SB_URL2} SB_KEY={SB_KEY2} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />
          )}
          {activeSection === 'security' && (
            <SecuritySection operatorId={operatorId} SB_URL={SB_URL2} SB_KEY={SB_KEY2} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />
          )}
          {activeSection === 'locations' && (
            <LocationsSection SB_URL={SB_URL2} SB_KEY={SB_KEY2} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />
          )}
          {activeSection === 'danger' && (
            <DangerSection SB_URL={SB_URL2} SB_KEY={SB_KEY2} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} operatorId={operatorId} />
          )}
          {!['profile', 'security', 'locations', 'danger'].includes(activeSection) && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.text3 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>Coming Soon</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>This section is being built</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileSection({ operatorId, name, role, state, initials, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [form, setForm] = useState({ name, state, country: 'India' })
  const save = async () => {
    setSaving(true)
    const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name: form.name, state: form.state, country: form.country }) })
    if (res.ok) { document.cookie = 'fl_operator_name=' + form.name + '; path=/; max-age=86400'; document.cookie = 'fl_state=' + form.state + '; path=/; max-age=86400'; showSaved() }
    else showErr('Failed to save')
    setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Profile</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Your account details and contact info</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderBottom: `1px solid ${C.border}`, marginBottom: 22 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{name}</div>
          <div style={{ marginTop: 5 }}><Badge color={role === 'super_admin' ? '#7c3aed' : C.blue}>{role === 'super_admin' ? 'Super Admin' : 'Operator'}</Badge></div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
        {[['Full Name', 'name', 'text', form.name], ['State / Region', 'state', 'text', form.state], ['Country', 'country', 'text', form.country]].map(([label, key, type, val]) => (
          <div key={key as string}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</label>
            <input type={type as string} value={val as string} onChange={e => setForm({ ...form, [key as string]: e.target.value })}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', color: C.text, boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Changes'}</button>
      </div>
    </div>
  )
}

function SecuritySection({ operatorId, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [pw, setPw] = useState({ cur: '', new: '', confirm: '' })
  const save = async () => {
    if (pw.new !== pw.confirm) { showErr('Passwords do not match'); return }
    if (pw.new.length < 8) { showErr('Minimum 8 characters'); return }
    setSaving(true)
    const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw.new }) })
    if (!hashRes.ok) { showErr('Failed to hash password'); setSaving(false); return }
    const { hash } = await hashRes.json()
    const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: hash }) })
    if (res.ok) showSaved(); else showErr('Failed to update')
    setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Security</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Update your password</div>
      {[['New Password', 'new'], ['Confirm Password', 'confirm']].map(([label, key]) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</label>
          <input type="password" value={(pw as any)[key]} onChange={e => setPw({ ...pw, [key]: e.target.value })} placeholder="••••••••"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', color: C.text, boxSizing: 'border-box' }} />
        </div>
      ))}
      <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Updated!' : 'Update Password'}</button>
    </div>
  )
}

function LocationsSection({ SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [machines, setMachines] = useState<any[]>([])
  useEffect(() => {
    fetch(SB_URL + '/rest/v1/machines?select=id,display_name,location,state', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }).then(r => r.json()).then(d => setMachines(Array.isArray(d) ? d : []))
  }, [])
  const save = async () => {
    setSaving(true)
    for (const m of machines) {
      await fetch(SB_URL + '/rest/v1/machines?id=eq.' + m.id, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ location: m.location, state: m.state }) })
    }
    showSaved(); setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Locations</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Update machine locations</div>
      {machines.map(m => (
        <div key={m.id} style={{ marginBottom: 16, padding: 14, background: C.surface2, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 10 }}>{m.display_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, marginBottom: 4, textTransform: 'uppercase' as const }}>Location</label>
              <input value={m.location || ''} onChange={e => setMachines(machines.map(x => x.id === m.id ? { ...x, location: e.target.value } : x))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none', color: C.text, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, marginBottom: 4, textTransform: 'uppercase' as const }}>State</label>
              <input value={m.state || ''} onChange={e => setMachines(machines.map(x => x.id === m.id ? { ...x, state: e.target.value } : x))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none', color: C.text, boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      ))}
      <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Locations'}</button>
    </div>
  )
}

function DangerSection({ SB_URL, SB_KEY, operatorId }: any) {
  const [confirm, setConfirm] = useState('')
  const deleteAccount = async () => {
    if (confirm !== 'DELETE') return
    await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
    document.cookie.split(';').forEach(c => document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/')
    window.location.href = '/login'
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.red, marginBottom: 4 }}>Danger Zone</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>These actions are irreversible</div>
      <div style={{ background: C.redBg, border: `1px solid ${C.red}40`, borderRadius: 12, padding: 18 }}>
        <div style={{ fontWeight: 700, color: C.red, marginBottom: 6 }}>Delete Account</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>Type DELETE to confirm permanent account deletion.</div>
        <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder='Type "DELETE"'
          style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.red}60`, fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box', background: '#fff', color: C.text }} />
        <button onClick={deleteAccount} disabled={confirm !== 'DELETE'} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.red, color: '#fff', fontSize: 13, fontWeight: 700, cursor: confirm === 'DELETE' ? 'pointer' : 'not-allowed', opacity: confirm === 'DELETE' ? 1 : 0.5 }}>Delete My Account</button>
      </div>
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────
export default function Dashboard() {
  const [active, setActive] = useState('console')
  const [machines, setMachines] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const role = getCookie('fl_role')
  const name = getCookie('fl_operator_name') || 'Admin'
  const operatorId = getCookie('fl_operator_id')

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
        const tRes = await fetch(SB_URL + '/rest/v1/telemetry?select=inner_temp_c,stock_l1,stock_l2,stock_l3,cup_present,cooling_state,scale_weight_g&machine_id=eq.' + m.id + '&order=created_at.desc&limit=1', { headers })
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
