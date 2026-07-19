'use client'
import { useState, useEffect, useMemo } from 'react'
import { C, SB_KEY, getCookie, Dot, Pill, StatCard } from './lib/dashboard-shared'

// ─── Fleet screen: built for 500 machines ────────────────────────
// The old screen rendered every machine's full detail block inside a nested
// operator → location tree. At 30 machines that was merely heavy; at 500 it is
// a wall. Detail is now expand-on-demand (one open machine at a time), the list
// is a dense scannable row, and the work of finding a machine — search, status
// filter, sort — sits in a toolbar above it. Nothing about how a machine is
// read or commanded has changed, only how much of it is on screen at once.

const CMDS: { cmd: string; label: string; danger?: boolean }[] = [
  { cmd: 'reboot', label: '🔄 Reboot', danger: true },
  { cmd: 'reset_mcu', label: '⚡ Reset MCU', danger: true },
  { cmd: 'clear_fault', label: '🔧 Clear Fault' },
  { cmd: 'sync_config', label: '📡 Sync Config' },
  { cmd: 'maintenance_on', label: '🚧 Maintenance ON' },
  { cmd: 'maintenance_off', label: '✅ Maintenance OFF' },
  { cmd: 'run_cleaning', label: '🧹 Run Cleaning' },
]

// Above this width the list is a table of dense rows; below it, cards.
const WIDE = 940
function useWide() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const check = () => setWide(window.innerWidth > WIDE)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return wide
}

// How many rows to paint before the "show more" button. A 500-machine fleet
// filtered to "all" is 500 DOM rows otherwise, and every keystroke in the
// search box re-renders them.
const PAGE = 120

const isOnline = (m: any) => m.status === 'online'
const siteOf = (m: any) => (m.location || '').trim() || 'No site set'

// Sort rank: broken things first. Offline is the thing you act on, so it leads;
// an online machine nobody owns is last because it is an admin chore, not an
// outage. Ownership is only known when the API enriched it (super_admin), which
// is why "unassigned" never removes a machine from the offline count.
const rankOf = (m: any, ownerKnown: boolean) =>
  !isOnline(m) ? 0 : (!ownerKnown || m.owner_id) ? 1 : 2

const stockOf = (stockData: any[], m: any) => stockData.find((s: any) => s.machine_id === m.id)

const stockColors = (s: any) => {
  if (!s?.stock_known) return { color: C.text3, bg: C.surface2 }
  if (s.cups_remaining <= 10) return { color: C.red, bg: C.redBg }
  if (s.stock_pct <= 50) return { color: C.amber, bg: C.amberBg }
  return { color: C.green, bg: C.greenBg }
}

// ─── Compact stock bar for a list row ────────────────────────────
function StockBar({ s }: { s: any }) {
  if (!s?.stock_known) return <span style={{ fontSize: 11.5, color: C.text3 }}>no stock data</span>
  const { color } = stockColors(s)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 56, height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: Math.max(0, Math.min(100, s.stock_pct)) + '%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' as const }}>{s.cups_remaining} cups</span>
    </div>
  )
}

function StatusPill({ m }: { m: any }) {
  const on = isOnline(m)
  return (
    <Pill color={on ? C.green : C.red} bg={on ? C.greenBg : C.redBg}>
      <Dot color={on ? C.green : C.red} pulse={on} size={5} />{on ? 'Online' : 'Offline'}
    </Pill>
  )
}

// ─── Expanded detail (rendered for the open machine only) ────────
export function MachineDetail({ m, stock, canEdit, openEdit, fmtTime, getCoords, sendCommand, cmdMenu, setCmdMenu, cmdSending }: any) {
  const online = isOnline(m)
  const temp = m.inner_temp_c
  const tempColor = temp == null ? C.text3 : temp > 18 ? C.red : temp > 12 ? C.amber : temp < 3 ? C.blue : C.green
  const sc = stockColors(stock)
  const co = getCoords(m)
  const firmware = m.firmware_version || m.fw_version || m.mcu_version || null

  // Only facts the machine actually reports. A grid of "--" tells you nothing
  // and reads as broken telemetry, so absent fields are dropped, not blanked.
  const facts: { label: string; value: string; color?: string }[] = []
  if (temp != null) facts.push({ label: 'Temperature', value: temp + '°C', color: tempColor })
  if (stock?.stock_known) facts.push({ label: 'Stock', value: stock.cups_remaining + ' cups · ' + stock.stock_pct + '%', color: sc.color })
  if (stock?.capacity) facts.push({ label: 'Capacity', value: stock.capacity + ' oranges' })
  if (stock?.stock_known && stock.cups_loaded != null) facts.push({ label: 'Loaded / Dispensed', value: stock.cups_loaded + ' / ' + stock.cups_dispensed + ' cups' })
  if (m.scale_weight_g != null) facts.push({ label: 'Scale', value: Math.max(0, m.scale_weight_g - 235) + 'g' })
  if (m.app_version) facts.push({ label: 'App version', value: 'v' + m.app_version, color: C.blue })
  if (firmware) facts.push({ label: 'Firmware', value: String(firmware), color: C.blue })
  facts.push({ label: 'Last seen', value: fmtTime(m.last_seen), color: online ? C.text : C.red })
  if (co) facts.push({ label: 'Coordinates', value: co.lat + ', ' + co.lng })

  return (
    <div style={{ borderTop: '1px solid ' + C.border, background: C.surface2 }}>
      <div style={{ height: 3, background: online ? C.green : C.border2 }} />
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'center', marginBottom: 12 }}>
          {canEdit && (
            <button onClick={e => { e.stopPropagation(); openEdit(m) }}
              style={{ background: C.surface, color: C.text2, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ Edit machine
            </button>
          )}
          {canEdit && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button onClick={e => { e.stopPropagation(); setCmdMenu(cmdMenu === m.id ? null : m.id) }}
                style={{ background: C.surface, color: C.orange, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ⚡ Remote command {cmdMenu === m.id ? '▲' : '▼'}
              </button>
              {cmdMenu === m.id && (
                <div style={{ position: 'absolute', left: 0, top: 34, background: C.surface, border: '1px solid ' + C.border, borderRadius: 10, padding: 6, zIndex: 99, minWidth: 210, boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}>
                  {CMDS.map(c => (
                    <button key={c.cmd} disabled={cmdSending || !online}
                      onClick={e => { e.stopPropagation(); sendCommand(m.id, m.sn, c.cmd) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left' as const, border: 'none', borderRadius: 6,
                        background: c.danger ? C.redBg : 'none', color: cmdSending || !online ? C.text3 : c.danger ? C.red : C.text,
                        padding: '8px 10px', marginBottom: 2, fontSize: 12.5, fontWeight: 700,
                        cursor: cmdSending || !online ? 'not-allowed' : 'pointer', opacity: cmdSending || !online ? 0.55 : 1,
                      }}>
                      {c.label}
                    </button>
                  ))}
                  <div style={{ fontSize: 11, color: C.text3, padding: '6px 10px 2px', lineHeight: 1.45 }}>
                    {online
                      ? 'Runs on the next heartbeat (~5 min).'
                      : 'Machine is offline — commands are disabled. They queue on the machine only once it reconnects.'}
                  </div>
                </div>
              )}
            </div>
          )}
          {co && (
            <a href={'https://www.google.com/maps?q=' + co.lat + ',' + co.lng} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, color: C.blue, fontWeight: 700, textDecoration: 'none', padding: '6px 12px', background: C.blueBg, borderRadius: 8 }}>
              🗺 Maps
            </a>
          )}
          {!online && <span style={{ fontSize: 11.5, color: C.red, fontWeight: 700 }}>Offline — remote commands unavailable</span>}
        </div>

        {stock?.needs_recount && (
          <div style={{ background: C.amberBg, border: '1px solid ' + C.amber + '40', color: C.amber, borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            ⚠️ Stock balance has gone negative — needs a recount.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {facts.map(f => (
            <div key={f.label} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 9, padding: '8px 11px' }}>
              <div style={{ fontSize: 10.5, color: C.text3, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: f.color || C.text }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── One machine, dense row (desktop) or card (mobile) ───────────
export function MachineRow({ m, wide, expandedId, setExpandedId, stockData, canEdit, openEdit, fmtTime, getCoords, sendCommand, cmdMenu, setCmdMenu, cmdSending }: any) {
  const online = isOnline(m)
  const isExpanded = expandedId === m.id
  const s = stockOf(stockData, m)
  const detail = (
    <MachineDetail m={m} stock={s} canEdit={canEdit} openEdit={openEdit} fmtTime={fmtTime} getCoords={getCoords}
      sendCommand={sendCommand} cmdMenu={cmdMenu} setCmdMenu={setCmdMenu} cmdSending={cmdSending} />
  )
  const toggle = () => setExpandedId(isExpanded ? null : m.id)

  if (!wide) {
    return (
      <div style={{ background: C.surface, border: '1px solid ' + (isExpanded ? C.border2 : C.border), borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
        <div onClick={toggle} style={{ padding: '12px 14px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{m.display_name}</div>
              <div style={{ fontSize: 11, color: C.text2, fontFamily: 'monospace', marginTop: 2 }}>{m.sn}</div>
            </div>
            <StatusPill m={m} />
            <span style={{ fontSize: 11, color: C.text3 }}>{isExpanded ? '▲' : '▼'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>📍 {siteOf(m)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: online ? C.text3 : C.red, whiteSpace: 'nowrap' as const }}>{fmtTime(m.last_seen)}</span>
          </div>
          <div style={{ marginTop: 8 }}><StockBar s={s} /></div>
        </div>
        {isExpanded && detail}
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid ' + C.border, background: C.surface }}>
      <div onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 18px', cursor: 'pointer', background: isExpanded ? C.surface2 : C.surface }}>
        <div style={{ width: 78, flexShrink: 0 }}><StatusPill m={m} /></div>
        <div style={{ width: 230, minWidth: 0, flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{m.display_name}</div>
          <div style={{ fontSize: 11, color: C.text3, fontFamily: 'monospace', marginTop: 1 }}>{m.sn}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {siteOf(m)}
        </div>
        <div style={{ width: 140, flexShrink: 0 }}><StockBar s={s} /></div>
        <div style={{ width: 78, flexShrink: 0, textAlign: 'right' as const, fontSize: 12, fontWeight: 700, color: online ? C.text3 : C.red }}>
          {fmtTime(m.last_seen)}
        </div>
        <span style={{ width: 12, flexShrink: 0, fontSize: 11, color: C.text3, textAlign: 'right' as const }}>{isExpanded ? '▲' : '▼'}</span>
      </div>
      {isExpanded && detail}
    </div>
  )
}

// ─── Grouped-by-site list ────────────────────────────────────────
export function MachineGroupedList({ machines, collapsed, setCollapsed, ...rest }: any) {
  const groups: { site: string; list: any[] }[] = []
  const byName: Record<string, any[]> = {}
  machines.forEach((m: any) => {
    const site = siteOf(m)
    if (!byName[site]) { byName[site] = []; groups.push({ site, list: byName[site] }) }
    byName[site].push(m)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
      {groups.map(g => {
        const on = g.list.filter(isOnline).length
        const off = g.list.length - on
        const shut = collapsed[g.site]
        return (
          <div key={g.site} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
            <div onClick={() => setCollapsed((p: any) => ({ ...p, [g.site]: !p[g.site] }))}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', background: shut ? C.surface2 : C.surface }}>
              <span style={{ fontSize: 11, color: C.text3, width: 10 }}>{shut ? '▶' : '▼'}</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>📍 {g.site}</span>
              <span style={{ fontSize: 12, color: C.text2 }}>· {g.list.length} machine{g.list.length !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>· {on} online</span>
              <span style={{ fontSize: 12, color: off > 0 ? C.red : C.text3, fontWeight: 700 }}>· {off} offline</span>
            </div>
            {!shut && g.list.map((m: any) => <MachineRow key={m.id} m={m} {...rest} />)}
          </div>
        )
      })}
    </div>
  )
}

export function MachinesPage({ machines, loading, fetchData }: any) {
  const [stockData, setStockData] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<'all' | 'online' | 'offline' | 'unassigned'>('all')
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'seen' | 'stock'>('status')
  const [grouped, setGrouped] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [limit, setLimit] = useState(PAGE)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const wide = useWide()
  useEffect(() => { fetch('/api/stock').then(r=>r.json()).then(d=>setStockData(Array.isArray(d)?d:[])).catch(()=>{}) }, [])
  const safeMachines = (machines || []).map((m: any) => {
    let st = m.state
    if (typeof st === 'string') { try { st = JSON.parse(st) } catch { st = {} } }
    return { ...m, state: st || {} }
  })
  const fmtTime = (t: string) => { if (!t) return '--'; const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000); if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m/60) + 'h ago'; return Math.floor(m/1440) + 'd ago' }
  const getCoords = (m: any) => { if (m.location_lat != null && m.location_lng != null) return { lat: m.location_lat, lng: m.location_lng }; return null; }
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

  // Ownership is enriched server-side for super_admin only. For an operator
  // every machine would read "unassigned" — which is not a fact about the
  // fleet, it is a fact about their scope — so the whole notion is hidden
  // rather than shown wrong.
  const ownerKnown = safeMachines.some((m: any) => m.owner_id)
  const counts = {
    all: safeMachines.length,
    online: safeMachines.filter(isOnline).length,
    offline: safeMachines.filter((m: any) => !isOnline(m)).length,
    unassigned: ownerKnown ? safeMachines.filter((m: any) => !m.owner_id).length : 0,
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = safeMachines.filter((m: any) => {
      if (statusF === 'online' && !isOnline(m)) return false
      if (statusF === 'offline' && isOnline(m)) return false
      if (statusF === 'unassigned' && m.owner_id) return false
      if (!q) return true
      return (m.display_name || '').toLowerCase().includes(q) ||
        (m.sn || '').toLowerCase().includes(q) ||
        (m.location || '').toLowerCase().includes(q) ||
        (m.owner_name || '').toLowerCase().includes(q)
    })
    const seen = (m: any) => m.last_seen ? new Date(m.last_seen).getTime() : 0
    const stockPct = (m: any) => { const s = stockOf(stockData, m); return s?.stock_known ? s.stock_pct : 1e9 }
    list = [...list].sort((a: any, b: any) => {
      if (sortBy === 'name') return (a.display_name || '').localeCompare(b.display_name || '')
      if (sortBy === 'seen') return seen(b) - seen(a)
      if (sortBy === 'stock') return stockPct(a) - stockPct(b)
      const r = rankOf(a, ownerKnown) - rankOf(b, ownerKnown)
      return r !== 0 ? r : (a.display_name || '').localeCompare(b.display_name || '')
    })
    return list
  }, [machines, search, statusF, sortBy, stockData, ownerKnown])

  // A new filter should start at the top of its own list, not 300 rows deep.
  useEffect(() => { setLimit(PAGE) }, [search, statusF, sortBy, grouped])

  const shown = grouped ? visible : visible.slice(0, limit)

  const chip = (key: typeof statusF, label: string, n: number, color: string) => {
    const active = statusF === key
    return (
      <button key={key} onClick={() => setStatusF(key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' as const,
          background: active ? color + '18' : C.surface, color: active ? color : C.text2,
          border: '1px solid ' + (active ? color + '60' : C.border),
        }}>
        {label}
        <span style={{ fontSize: 11.5, fontWeight: 800, color: active ? color : C.text3 }}>{n}</span>
      </button>
    )
  }

  const listProps = {
    wide, expandedId, setExpandedId, stockData, canEdit, openEdit, fmtTime, getCoords,
    sendCommand, cmdMenu, setCmdMenu, cmdSending,
  }

  return (
    <div style={{ padding: wide ? '24px 28px' : '18px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Machines</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{counts.all} machines · {counts.online} online · {counts.offline} offline</div>
        </div>
        <button onClick={fetchData} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>Refresh</button>
      </div>

      {/* KPI strip — each card sets the status filter */}
      <div style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(' + (ownerKnown ? 4 : 3) + ',1fr)' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {[
          { key: 'all' as const, label: 'Total', value: counts.all, color: C.blue, icon: '🖥', meter: 100 },
          { key: 'online' as const, label: 'Online', value: counts.online, color: C.green, icon: '📡', meter: counts.all ? counts.online / counts.all * 100 : 0 },
          { key: 'offline' as const, label: 'Offline', value: counts.offline, color: C.red, icon: '📴', meter: counts.all ? counts.offline / counts.all * 100 : 0, attention: counts.offline > 0 },
          ...(ownerKnown ? [{ key: 'unassigned' as const, label: 'Unassigned', value: counts.unassigned, color: C.amber, icon: '🏷', meter: counts.all ? counts.unassigned / counts.all * 100 : 0, attention: counts.unassigned > 0 }] : []),
        ].map(k => (
          <div key={k.key} onClick={() => setStatusF(k.key)} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setStatusF(k.key) }}
            style={{ cursor: 'pointer', borderRadius: 12, outline: statusF === k.key ? '2px solid ' + k.color : 'none', outlineOffset: 1 }}>
            <StatCard label={k.label} value={k.value} color={k.color} icon={k.icon} meter={k.meter} attention={(k as any).attention} sub={statusF === k.key ? 'Filtering by this' : ''} />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 12, marginBottom: 14, display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' }}>
        <input
          type="text" placeholder="🔍 Search name, serial number or location…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 240px', minWidth: 0, padding: '9px 12px', fontSize: 13.5, border: '1px solid ' + C.border, borderRadius: 9, boxSizing: 'border-box' as const, color: C.text, background: C.surface2, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {chip('all', 'All', counts.all, C.blue)}
          {chip('online', 'Online', counts.online, C.green)}
          {chip('offline', 'Offline', counts.offline, C.red)}
          {ownerKnown && chip('unassigned', 'Unassigned', counts.unassigned, C.amber)}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          style={{ padding: '8px 10px', fontSize: 12.5, fontWeight: 600, border: '1px solid ' + C.border, borderRadius: 9, background: C.surface, color: C.text, cursor: 'pointer' }}>
          <option value="status">Sort: Status</option>
          <option value="name">Sort: Name</option>
          <option value="seen">Sort: Last seen</option>
          <option value="stock">Sort: Stock (low first)</option>
        </select>
        <div style={{ display: 'flex', border: '1px solid ' + C.border, borderRadius: 9, overflow: 'hidden' }}>
          {[[false, 'Flat list'], [true, 'Grouped by site']].map(([v, label]) => (
            <button key={String(label)} onClick={() => setGrouped(v as boolean)}
              style={{
                padding: '8px 12px', fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: grouped === v ? C.orangeBg : C.surface, color: grouped === v ? C.orange : C.text2,
              }}>{label as string}</button>
          ))}
        </div>
      </div>

      <div style={{ display: wide ? 'grid' : 'block', gridTemplateColumns: wide ? 'minmax(0,1fr) 340px' : undefined, gap: 18, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center' as const, padding: 60, color: C.text3 }}>Loading machines...</div>
          ) : visible.length === 0 ? (
            <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 40, textAlign: 'center' as const, color: C.text3, fontSize: 13.5 }}>
              No machines match {search.trim() ? '“' + search.trim() + '”' : 'this filter'}.
            </div>
          ) : grouped ? (
            <MachineGroupedList machines={shown} collapsed={collapsed} setCollapsed={setCollapsed} {...listProps} />
          ) : wide ? (
            <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 18px', background: C.surface2, fontSize: 10.5, fontWeight: 800, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                <div style={{ width: 78, flexShrink: 0 }}>Status</div>
                <div style={{ width: 230, flexShrink: 0 }}>Machine</div>
                <div style={{ flex: 1, minWidth: 0 }}>Location</div>
                <div style={{ width: 140, flexShrink: 0 }}>Stock</div>
                <div style={{ width: 78, flexShrink: 0, textAlign: 'right' as const }}>Last seen</div>
                <div style={{ width: 12, flexShrink: 0 }} />
              </div>
              {shown.map((m: any) => <MachineRow key={m.id} m={m} {...listProps} />)}
            </div>
          ) : (
            <div>{shown.map((m: any) => <MachineRow key={m.id} m={m} {...listProps} />)}</div>
          )}

          {!grouped && visible.length > shown.length && (
            <button onClick={() => setLimit(l => l + PAGE)}
              style={{ width: '100%', marginTop: 10, padding: '10px 0', background: C.surface, border: '1px solid ' + C.border, borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: C.text2, cursor: 'pointer' }}>
              Show {Math.min(PAGE, visible.length - shown.length)} more · {visible.length - shown.length} hidden
            </button>
          )}
        </div>

        {/* Command History — sticky rail on desktop, stacked below on mobile */}
        <div style={{ position: wide ? 'sticky' : 'static', top: 16, marginTop: wide ? 0 : 18 }}>
          <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid ' + C.border }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>📋 Recent Commands</div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>Auto-refreshes every 30s</div>
            </div>
            <CommandHistory machines={safeMachines} compact={wide} />
          </div>
        </div>
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

// ─── Command History (recent remote commands across all machines) ──────────
export function CommandHistory({ machines, compact = false }: { machines: any[]; compact?: boolean }) {
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
  const cmdIcon: Record<string, string> = { reboot: '🔄', reset_mcu: '⚡', clear_fault: '🔧', sync_config: '📡', maintenance_on: '🚧', maintenance_off: '✅', run_cleaning: '🧹' }

  if (loading && cmds.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: C.text3, fontSize: 13 }}>Loading commands...</div>
  if (cmds.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: C.text3, fontSize: 13 }}>No commands sent yet.</div>

  // In the sticky rail the eight-column table would be a horizontal scrollbar
  // 340px wide, so the same rows are stacked instead. Same data, same poll.
  if (compact) {
    return (
      <div style={{ maxHeight: '62vh', overflowY: 'auto' as const }}>
        {cmds.map((c: any, i: number) => (
          <div key={c.id || i} style={{ padding: '10px 14px', borderBottom: i < cmds.length - 1 ? '1px solid ' + C.border : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {cmdIcon[c.command] || '⚡'} {c.command}
              </span>
              <span style={statusBadge(c.status)}>{c.status}</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {machineMap[c.machine_id] || '?'} · {fmtTime(c.created_at)}
            </div>
            {(c.result || c.created_by) && (
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {c.result ? <span style={{ fontFamily: 'monospace' }}>{c.result}</span> : null}
                {c.result && c.created_by ? ' · ' : ''}
                {c.created_by || ''}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

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
