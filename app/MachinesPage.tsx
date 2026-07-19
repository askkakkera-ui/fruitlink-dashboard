'use client'
import { useState, useEffect } from 'react'
import { C, SB_KEY, getCookie, Dot, Pill, StatCard } from './lib/dashboard-shared'

// ─── Machine Grouped List ────────────────────────────────────────
export function MachineRow({ m, expandedId, setExpandedId, stockData, canEdit, openEdit, fmtTime, getCoords, sendCommand, cmdMenu, setCmdMenu, cmdSending }: any) {
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

export function MachineGroupedList({ machines, search, expandedId, setExpandedId, stockData, role, canEdit, openEdit, fmtTime, getCoords, sendCommand, cmdMenu, setCmdMenu, cmdSending }: any) {
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

export function MachinesPage({ machines, loading, fetchData }: any) {
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

// ─── Command History (recent remote commands across all machines) ──────────
export function CommandHistory({ machines }: { machines: any[] }) {
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
