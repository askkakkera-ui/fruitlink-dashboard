'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import WarehouseSection from './WarehouseSection'
import NotifyConfigSection from './NotifyConfigSection'
import MyStaffSection from './MyStaffSection'
import ReportsSection from './ReportsSection'
import FieldStaffSection from './FieldStaffSection'
import AttendanceSection from './AttendanceSection'
import { C, SB_URL, SB_KEY, FL_LOGO, getCookie, useIsMobile, Dot, Badge, Pill, SectionLabel, StatCard, MachineCard, sbFetchAll, isTestRefund, netPaise, ErrorBoundary } from './lib/dashboard-shared'
import { AdsPage } from './AdsPage'
import { OrdersPage } from './OrdersPage'
import { AlertsPage } from './AlertsPage'
import { MachinesPage } from './MachinesPage'
import { ConsolePage } from './ConsolePage'
import { CommLogPage } from './CommLogPage'
import { FaultLogPage } from './FaultLogPage'
import { LoyaltyPage } from './LoyaltyPage'
import { FleetMapPage } from './FleetMapPage'
import { Sidebar, TopBar } from './DashboardNav'



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
