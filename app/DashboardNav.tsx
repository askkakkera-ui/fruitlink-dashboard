'use client'
import { useState, useEffect } from 'react'
import { C, useIsMobile, Dot, Badge, SectionLabel } from './lib/dashboard-shared'

// ─── Sidebar ─────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { key: 'console', label: 'Console', icon: '⊞', badge: 'LIVE', group: '', permission: 'can_view_console' },
  { key: 'machines', label: 'Machine List', icon: '▣', group: 'Equipment Management', permission: 'can_view_console' },
  { key: 'map', label: 'Fleet Map', icon: '◎', group: 'Equipment Management', permission: 'can_view_fleet_map' },
  { key: 'alerts', label: 'Alerts', icon: '◉', group: 'Equipment Management', alertDot: true, permission: 'can_view_alerts' },
  { key: 'orders', label: 'Orders List', icon: '▤', group: 'Order Management', permission: 'can_view_orders' },
  { key: 'warehouse', label: 'Warehouse', icon: '📦', group: 'Order Management', permission: 'can_view_warehouse' },
  { key: 'notifyconfig', label: 'Alert Notifications', icon: '🔔', group: 'System', permission: 'can_view_notify_config', superAdmin: true },
  { key: 'reports', label: 'Reports', icon: '📄', group: 'System', permission: 'can_view_reports', superAdmin: true },
  { key: 'operators', label: 'Operators', icon: '⬡', group: 'Operator Management', superAdminOnly: true },
  { key: 'myteam', label: 'My Team', icon: '👥', group: 'Operator Management', operatorOnly: true },
  { key: 'mystaff', label: 'Fruitlink Team', icon: '🏢', group: 'Fruitlink Internal', superAdminOnly: true },
  { key: 'fieldstaff', label: 'Field Staff', icon: '👷', group: 'Operator Management', permission: 'can_view_field_staff', superAdmin: true },
  { key: 'attendance', label: 'Attendance', icon: '🗓', group: 'Operator Management', permission: 'can_view_attendance', superAdmin: true },
  { key: 'commlog', label: 'Comm Log', icon: '🖧', group: 'Equipment Management', permission: 'can_view_comm_log', superAdmin: true },
  { key: 'faultlog', label: 'Fault Log', icon: '⚠', group: 'Equipment Management', permission: 'can_view_comm_log', superAdmin: true },
  { key: 'ads', label: 'Ad Manager', icon: '🎬', group: 'Marketing', permission: 'can_view_ad_manager' },
  { key: 'loyalty', label: 'Loyalty', icon: '⭐', group: 'Marketing', permission: 'can_view_console' },
  { key: 'settings', label: 'Settings', icon: '◈', group: 'System' },
]

export function Sidebar({ active, setActive, role, name, alertCount, onLogout, permissions = {} }: any) {
  const initials = (name || 'A').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const groups: Record<string, typeof NAV_ITEMS> = {}
  NAV_ITEMS.forEach((item: any) => {
    // superAdminOnly = never visible to non-super-admins
    if (item.superAdminOnly && role !== 'super_admin') return
    // operatorOnly = only true operators (they manage their own team)
    if (item.operatorOnly && role !== 'operator') return
    // Fruitlink staff with no permission key on an item = hide it (purely permission-driven).
    if (role === 'staff' && !item.permission) return
    // permission key = check operator/sub-operator/staff permissions
    if (item.permission && (role === 'operator' || role === 'sub_operator' || role === 'staff' || role === 'field_staff')) {
      if (!permissions[item.permission]) return
    }
    // legacy superAdmin flag = hide from non-super-admins unless they have explicit permission
    if (item.superAdmin && role !== 'super_admin') {
      if (!item.permission) return
    }
    const g = item.group || '__top'
    if (!groups[g]) groups[g] = []
    groups[g].push(item)
  })

  return (
    <div style={{
      width: 230, flexShrink: 0, background: C.sidebar,
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 0,
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
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>FRUITLINK</div>
            <div style={{ fontSize: 10.5, color: C.textSide3, letterSpacing: '0.03em', marginTop: 1, whiteSpace: 'nowrap' }}>TECHNOLOGIES PVT LTD</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: `1px solid ${C.sidebarB}`, borderRadius: 8, padding: '6px 10px' }}>
          <Dot color={C.green} pulse size={6} />
          <span style={{ fontSize: 11, color: C.textSide, fontWeight: 500 }}>Online</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textSide3 }}>System OK</span>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 8px' }}>
        {(() => { const order = ['__top', 'Equipment Management', 'Order Management', 'Operator Management', 'Fruitlink Internal', 'Marketing', 'System']; return Object.entries(groups).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])); })().map(([group, items]) => (
          <div key={group}>
            {group !== '__top' && <SectionLabel>{group}</SectionLabel>}
            {items.map(item => {
              const isActive = active === item.key
              return (
                <button key={item.key} onClick={() => setActive(item.key)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isActive ? C.activeGlow : 'transparent',
                  color: isActive ? C.orange : C.text,
                  fontSize: 15.5, fontWeight: isActive ? 700 : 600,
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
      <div style={{ flexShrink: 0, padding: '12px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', borderTop: `1px solid ${C.sidebarT}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#ffffff', border: `1px solid ${C.sidebarB}`, borderRadius: 9, padding: '8px 10px' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: C.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Admin'}</div>
            <div style={{ fontSize: 11.5, color: C.orange, marginTop: 1 }}>{role === 'super_admin' ? 'Super Admin' : role === 'sub_operator' ? 'Sub-Operator' : role === 'field_staff' ? 'Field Staff' : role === 'staff' ? 'Fruitlink Staff' : 'Operator'}</div>
          </div>
          <button onClick={onLogout} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textSide3, fontSize: 16, padding: 2 }} title="Logout">⏻</button>
        </div>
      </div>
    </div>
  )
}

// ─── Top Bar ─────────────────────────────────────────────────────
export function TopBar({ active }: { active: string }) {
  const [time, setTime] = useState('')
  const isMobile = useIsMobile()
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [])
  const labels: Record<string, string> = { console: 'Console', machines: 'Machine List', alerts: 'Alerts', operators: 'Operators', settings: 'Settings', map: 'Fleet Map', orders: 'Orders List', warehouse: 'Warehouse', notifyconfig: 'WhatsApp Alerts', reports: 'Reports', ads: 'Ad Manager', loyalty: 'Loyalty', commlog: 'Comm Log', faultlog: 'Fault Log', fieldstaff: 'Field Staff', attendance: 'Attendance', myteam: 'My Team', mystaff: 'Fruitlink Team' }
  const shadow = '0 1px 3px rgba(0,0,0,0.35)'
  return (
    <div style={{
      height: 56, background: C.topbar, borderBottom: '1px solid rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 26px', gap: isMobile ? 10 : 16, flexShrink: 0,
      boxShadow: '0 2px 10px #00000028',
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
        {!isMobile && (
          <>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textShadow: shadow, whiteSpace: 'nowrap' }}>FRUITLINK</span>
            <span style={{ color: '#fff', fontSize: 16, opacity: 0.7, textShadow: shadow }}>›</span>
          </>
        )}
        <span style={{ fontSize: isMobile ? 19 : 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', textShadow: shadow, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{labels[active] || active}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', borderRadius: 20, padding: '6px 13px', flexShrink: 0 }}>
        <Dot color={'#fff'} pulse size={7} />
        <span style={{ fontSize: 13, color: '#fff', fontWeight: 700, textShadow: shadow, whiteSpace: 'nowrap' }}>{isMobile ? 'Online' : 'System Online'}</span>
      </div>
      <span style={{ fontSize: isMobile ? 12 : 13, color: '#fff', fontWeight: 700, textShadow: shadow, whiteSpace: 'nowrap', textAlign: 'right', lineHeight: 1.15 }}>{time}</span>
    </div>
  )
}
