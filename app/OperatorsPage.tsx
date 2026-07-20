'use client'
import { useState, useEffect } from 'react'
import { C, Pill, useIsMobile } from './lib/dashboard-shared'
import { groupOperatorsByTenant } from './lib/operator-grouping'

// ─── Operators Page (super_admin only) ───────────────────────────
export function AssignMachinesModal({ op, onClose }: any) {
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
export function PermissionsModal({ op, onClose, limitTo = null }: any) {
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
export function LocationsModal({ op, onClose }: any) {
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
// Field-staff add/edit/delete appears only when the operator's PLAN says so and
// they are under their effective seat limit — both read from /api/my-team, both
// re-checked server-side on every write. Nothing here is a number in code: an
// unlimited plan (limit === null) simply never blocks.
export function MyTeamPage() {
  const [team, setTeam] = useState<any[]>([])
  const [myPerms, setMyPerms] = useState<any>(null)
  const [ent, setEnt] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [permsFor, setPermsFor] = useState<any>(null)
  const [err, setErr] = useState('')
  // Add / edit field staff
  const [showForm, setShowForm] = useState(false)
  const [editStaff, setEditStaff] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [formMsg, setFormMsg] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/my-team')
      const d = await r.json()
      if (!r.ok || d.error) { setErr(d.error || 'Failed to load team'); setTeam([]) }
      else {
        setTeam(Array.isArray(d.team) ? d.team : [])
        setMyPerms(d.my_permissions || null)
        setEnt(d.entitlements || null)
        setMe(d.operator || null)
      }
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const subOps = team.filter((t: any) => t.role === 'sub_operator')
  const staff = team.filter((t: any) => t.role === 'field_staff')

  const canManageStaff = ent?.has_team_management === true
  const staffLimit: number | null = ent && ent.field_staff_limit != null ? Number(ent.field_staff_limit) : null
  const staffAtLimit = staffLimit !== null && staff.length >= staffLimit

  const openAddStaff = () => {
    setEditStaff(null); setForm({ name: '', email: '', phone: '', password: '' })
    setFormMsg(''); setShowForm(true)
  }
  const openEditStaff = (m: any) => {
    setEditStaff(m); setForm({ name: m.name || '', email: m.email || '', phone: m.phone || '', password: '' })
    setFormMsg(''); setShowForm(true)
  }

  const saveStaff = async () => {
    if (!form.name.trim()) { setFormMsg('Name is required'); return }
    if (!editStaff && !form.email.trim()) { setFormMsg('Email is required'); return }
    if (!editStaff && !form.password.trim()) { setFormMsg('A password is required'); return }
    setSaving(true); setFormMsg('')
    try {
      const body: any = { name: form.name.trim(), phone: form.phone.trim() }
      if (!editStaff) body.email = form.email.trim()
      if (form.password.trim()) {
        const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: form.password }) })
        if (!hashRes.ok) { setFormMsg('Error: could not hash password'); setSaving(false); return }
        const { hash } = await hashRes.json()
        body.password_hash = hash
      }
      const r = editStaff
        ? await fetch('/api/my-team?id=' + encodeURIComponent(editStaff.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/my-team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) { setFormMsg('Error: ' + (d.error || r.status)); setSaving(false); return }
      setFormMsg('✓ Saved')
      await load()
      setTimeout(() => { setShowForm(false); setFormMsg('') }, 700)
    } catch (e: any) { setFormMsg('Error: ' + e.message) }
    setSaving(false)
  }

  const deleteStaff = async (m: any) => {
    if (!confirm('Remove ' + (m.name || m.email) + ' from your field staff?')) return
    try {
      const r = await fetch('/api/my-team?id=' + encodeURIComponent(m.id), { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) { setErr(d.error || 'Could not remove field staff'); return }
      setErr(''); load()
    } catch (e: any) { setErr(e.message) }
  }

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
        {!isSub && canManageStaff && (
          <>
            <button onClick={() => openEditStaff(m)}
              style={{ background: C.surface2, border: '1px solid ' + C.border, borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: C.text2, cursor: 'pointer', flexShrink: 0 }}>
              ✏️ Edit
            </button>
            <button onClick={() => deleteStaff(m)}
              style={{ background: C.redBg, border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: C.red, cursor: 'pointer', flexShrink: 0 }}>
              🗑
            </button>
          </>
        )}
      </div>
    )
  }

  const Section = ({ title, rows, empty, action, note }: any) => (
    <div style={{ border: '1px solid ' + C.border, borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ padding: '11px 18px', background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.text2, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          {title} <span style={{ color: C.text3, fontWeight: 600 }}>· {rows.length}</span>
        </div>
        {action}
      </div>
      {note}
      {rows.length === 0
        ? <div style={{ padding: 26, textAlign: 'center' as const, color: C.text3, fontSize: 13, background: C.surface }}>{empty}</div>
        : rows.map((m: any) => <Row key={m.id} m={m} />)}
    </div>
  )

  // Shown in the Field Staff header: the add button, or — once the plan's seat
  // limit is reached — the sentence that tells them why it is gone.
  const staffAction = canManageStaff && !staffAtLimit ? (
    <button onClick={openAddStaff}
      style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
      + Add Field Staff
    </button>
  ) : null

  const staffNote = canManageStaff && staffAtLimit ? (
    <div style={{ padding: '10px 18px', background: C.amberBg, color: C.amber, fontSize: 12.5, fontWeight: 600, borderTop: '1px solid ' + C.border }}>
      You&rsquo;ve reached your field staff limit ({staffLimit}). Contact Fruitlink to increase it.
    </div>
  ) : null

  const inp: Record<string, any> = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, color: C.text, background: C.surface, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>My Team</div>
        <div style={{ fontSize: 13, color: C.text2, marginTop: 3 }}>
          People who work under your account. You can grant sub-operators any permission you hold yourself.
        </div>
        {/* The company's own code. Everyone listed below belongs to it via
            owner_id — they don't carry codes of their own. */}
        {me?.operator_code && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '9px 14px', borderRadius: 12, background: C.surface2, border: '1px solid ' + C.border }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Operator Code</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>{me.operator_code}</span>
            {/* Display only — payment verification against this code is a
                future integration and gates nothing today. */}
            <span title="Payment verification is a future integration — this flag gates nothing today"
              style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: me.payment_verified ? C.green : C.text3, background: me.payment_verified ? C.greenBg : C.surface }}>
              {me.payment_verified ? '✓ Payment verified' : 'Payment unverified'}
            </span>
          </div>
        )}
      </div>

      {err && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: C.redBg, color: C.red, fontSize: 13, fontWeight: 600 }}>{err}</div>}

      {loading ? (
        <div style={{ textAlign: 'center' as const, padding: 60, color: C.text3 }}>Loading team…</div>
      ) : (
        <>
          <Section title="Sub-Operators" rows={subOps} empty="No sub-operators yet. Ask Fruitlink to add one under your account." />
          <Section
            title="Field Staff"
            rows={staff}
            action={staffAction}
            note={staffNote}
            empty={canManageStaff
              ? (staffAtLimit ? 'No field staff yet.' : 'No field staff yet. Add your first one above.')
              : 'No field staff yet. Ask Fruitlink to add one under your account.'}
          />
          <div style={{ fontSize: 12, color: C.text3, padding: '0 2px' }}>
            🔒 A permission you don&rsquo;t hold yourself is locked and cannot be granted.
          </div>
        </>
      )}

      {/* Add / edit field staff */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 18, padding: 26, width: 420, maxWidth: '100%', boxShadow: '0 20px 60px #00000030' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 3 }}>{editStaff ? 'Edit Field Staff' : 'Add Field Staff'}</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
              {editStaff ? 'Update their details or set a new password.' : 'They will be able to log in and record machine visits for you.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Email *</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@example.com"
                  disabled={!!editStaff} style={{ ...inp, background: editStaff ? C.surface2 : C.surface }} />
                {editStaff && <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Email is their login and cannot be changed here.</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91…" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>{editStaff ? 'New Password (blank = keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={inp} />
              </div>
            </div>
            {formMsg && <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 8, background: formMsg.startsWith('✓') ? C.greenBg : C.redBg, color: formMsg.startsWith('✓') ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>{formMsg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={saveStaff} disabled={saving} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editStaff ? 'Update' : 'Add Field Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {permsFor && <PermissionsModal op={permsFor} limitTo={myPerms || {}} onClose={() => { setPermsFor(null); load() }} />}
    </div>
  )
}

// ─── Shared card / person-row design system (ported from fl-operators.jsx) ───
// Design tokens come from the live `C` object (colors.css declares C the ground
// truth). The prototype's CSS-var / color-mix references are replaced with the
// concrete equivalents below so nothing depends on a stylesheet the app doesn't
// load. Roles carry concrete hex (not var()) so `color + alpha` tints work.
const IND = '#423A8E', INDBG = '#efeefc', PURPLE = '#7c3aed', PURPLEBG = '#f5f3ff'
const SHADOW_CARD = '0 1px 3px rgba(0,0,0,0.06)'
const SHADOW_BRAND = '0 2px 8px #f9731640'
const a22 = (hex: string) => hex + '38' // ~22% alpha on a 6-digit hex

const OP_ROLES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  super_admin: { label: 'Super Admin', icon: '👑', color: PURPLE, bg: PURPLEBG },
  staff: { label: 'Fruitlink Staff', icon: '🏢', color: '#d97706', bg: '#fff7ed' },
  operator: { label: 'Operator', icon: '🧑‍💼', color: C.blue, bg: C.blueBg },
  sub_operator: { label: 'Sub-Operator', icon: '🧑‍💻', color: '#0891b2', bg: '#e0f7fa' },
  field_staff: { label: 'Field Staff', icon: '👷', color: C.orange, bg: C.orangeBg },
}
// Capability chips (what a person can DO) vs menu visibility (sidebar only).
// Same key sets the PermissionsModal / operator-permissions route enforce.
const CAP_PERMS: [string, string][] = [
  ['can_edit_machine_config', 'Machine config'],
  ['can_manage_field_staff', 'Field staff'],
  ['can_manage_locations', 'Locations'],
  ['can_manage_warehouse', 'Warehouse'],
  ['can_edit_office_location', 'Office pin'],
  ['can_export_data', 'Export'],
  ['can_manage_ads', 'Ads'],
]
const VIEW_KEYS = [
  'can_view_console', 'can_view_orders', 'can_view_alerts', 'can_view_fleet_map',
  'can_view_warehouse', 'can_view_reports', 'can_view_field_staff', 'can_view_attendance',
  'can_view_notify_config', 'can_view_comm_log', 'can_view_ad_manager',
]
const opInitial = (s: string) => (s || '?').charAt(0).toUpperCase()
const joinedStr = (t: string) => t ? new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const viewCount = (p: any) => VIEW_KEYS.filter((k) => p && p[k]).length
const enforcedCaps = (p: any) => CAP_PERMS.filter(([k]) => p && p[k]).map(([k]) => k)

function OpRoleBadge({ role }: any) {
  const r = OP_ROLES[role] || OP_ROLES.operator
  return <Pill color={r.color} bg={r.bg}>{r.icon} {r.label}</Pill>
}
function OpAvatar({ person }: any) {
  const r = OP_ROLES[person.role] || OP_ROLES.operator
  return (
    <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: r.color, background: r.bg, border: '1px solid ' + a22(r.color) }}>
      {opInitial(person.name || person.email)}
    </div>
  )
}
// Capability summary — chips for what they can DO, plus a "menus" count. When we
// have no permission row for a person, we say "View-only" rather than invent.
function PermSummary({ perms }: any) {
  const caps = enforcedCaps(perms)
  const vc = viewCount(perms)
  const capLabel: Record<string, string> = Object.fromEntries(CAP_PERMS)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, alignItems: 'center' }}>
      {caps.length === 0
        ? <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, fontStyle: 'italic' as const }}>View-only</span>
        : caps.slice(0, 4).map((k) => <span key={k} style={{ fontSize: 10.5, fontWeight: 700, color: IND, background: INDBG, border: '1px solid ' + a22(IND), borderRadius: 20, padding: '2px 8px' }}>⚡ {capLabel[k]}</span>)}
      {caps.length > 4 && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.text3 }}>+{caps.length - 4}</span>}
      <span style={{ fontSize: 10.5, fontWeight: 700, color: C.text3, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 20, padding: '2px 8px' }}>👁 {vc} menus</span>
    </div>
  )
}
// Actions. Machines + Locations are operator-level concerns (keyed by the tenant
// owner), so they appear only on the operator row — not on sub_operator /
// field_staff rows, where they'd open an empty owner_id. Perms/Edit/Del on all.
function OpActionBtns({ person, onAction }: any) {
  const isOp = person.role === 'operator'
  const btn = (key: string, label: string, color: string, bg: string) => (
    <button key={key} onClick={() => onAction(key, person)} style={{ font: 'inherit', fontSize: 11.5, fontWeight: 700, border: bg ? 'none' : '1px solid ' + C.border2, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color, background: bg || C.surface, whiteSpace: 'nowrap' as const }}>{label}</button>
  )
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
      {isOp && btn('machines', '🖥 Machines', C.blue, C.blueBg)}
      {btn('perms', '🔐 Perms', PURPLE, PURPLEBG)}
      {isOp && btn('locations', '📍 Locations', C.green, C.greenBg)}
      {btn('edit', '✏️ Edit', C.text2, C.surface2)}
      {btn('del', '🗑 Del', C.red, C.redBg)}
    </div>
  )
}
function PersonRow({ person, onAction, isMobile }: any) {
  if (isMobile) {
    return (
      <div style={{ borderTop: '1px solid ' + C.border, padding: '13px 15px', background: C.surface, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <OpAvatar person={person} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{person.name || '—'}</div>
            <div style={{ fontSize: 12, color: C.text2, wordBreak: 'break-all' as const }}>{person.email}</div>
            <div style={{ marginTop: 6 }}><OpRoleBadge role={person.role} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <PermSummary perms={person.permissions} />
          <span style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>Joined {joinedStr(person.created_at)}</span>
        </div>
        <OpActionBtns person={person} onAction={onAction} />
      </div>
    )
  }
  return (
    <div style={{ borderTop: '1px solid ' + C.border, padding: '12px 18px', background: C.surface, display: 'grid', gridTemplateColumns: 'minmax(180px,1.4fr) 150px minmax(200px,1.6fr) 110px auto', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0 }}>
        <OpAvatar person={person} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const }}>{person.name || '—'}</div>
          <div style={{ fontSize: 12, color: C.text2, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const }}>{person.email}</div>
        </div>
      </div>
      <div><OpRoleBadge role={person.role} /></div>
      <PermSummary perms={person.permissions} />
      <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>{joinedStr(person.created_at)}</span>
      <div style={{ justifySelf: 'end' as const }}><OpActionBtns person={person} onAction={onAction} /></div>
    </div>
  )
}
const opPill = (c: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: c, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap' as const })

// Pinned Fruitlink-internal card (super_admin + staff). No operator_code — a
// code belongs to a tenant, and internal staff are not one.
function FruitlinkCard({ internal, onAction, isMobile }: any) {
  const supers = internal.filter((p: any) => p.role === 'super_admin')
  const staff = internal.filter((p: any) => p.role === 'staff')
  const people = [...supers, ...staff]
  if (people.length === 0) return null
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: SHADOW_CARD, border: '1.5px solid ' + IND, marginBottom: 18 }}>
      <div style={{ background: 'linear-gradient(100deg,' + IND + ',#5a4fb0)', color: '#fff', padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, boxShadow: '0 3px 10px rgba(0,0,0,.25)' }}>F</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '.01em', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' as const }}>
            Fruitlink Technologies
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', background: 'rgba(255,255,255,.22)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 20, padding: '2px 9px' }}>PLATFORM OWNER</span>
          </div>
          <div style={{ fontSize: 12.5, opacity: .85, marginTop: 3, fontWeight: 600 }}>Internal team · {supers.length} super admin{supers.length !== 1 ? 's' : ''} · {staff.length} staff</div>
        </div>
      </div>
      <div style={{ background: C.surface }}>
        {people.map((p: any) => <PersonRow key={p.id} person={p} onAction={onAction} isMobile={isMobile} />)}
      </div>
    </div>
  )
}

// Collapsible tenant card. Header carries operator_code + payment_verified — the
// one place they show (never on nested rows). Nested people sit below the
// operator identity strip.
function TenantCard({ group, open, onToggle, onAction, isMobile }: any) {
  const tenant = group.tenant
  const staffCount = group.sub_operators.length + group.field_staff.length
  const people = [...group.sub_operators, ...group.field_staff]
  const title = tenant.company_name || tenant.name || tenant.email
  const region = [tenant.state, tenant.country].filter(Boolean).join(', ')
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: SHADOW_CARD, border: '1px solid ' + (open ? C.border2 : C.border), marginBottom: 14, background: C.surface }}>
      <div onClick={onToggle} style={{ padding: isMobile ? '13px 15px' : '15px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, background: open ? '#fffaf6' : C.surface, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 13, color: C.text3, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>▸</span>
        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: OP_ROLES.operator.color, background: OP_ROLES.operator.bg, border: '1px solid ' + a22(OP_ROLES.operator.color) }}>{opInitial(title)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const }}>{title}</div>
          <div style={{ fontSize: 12.5, color: C.text2, marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{tenant.name || tenant.email}</span>
            {region && <span style={{ color: C.text3 }}>{region}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
          {tenant.operator_code && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: C.text, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 8, padding: '4px 10px', fontFamily: 'monospace', whiteSpace: 'nowrap' as const }}>{tenant.operator_code}</span>
          )}
          {/* Display-only. payment_verified is written by nothing today and gates
              nothing — a future payment integration verifies against the code. */}
          <span title="Payment verification is a future integration — this flag gates nothing today"
            style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: tenant.payment_verified ? C.green : C.text3, background: tenant.payment_verified ? C.greenBg : C.surface2, border: '1px solid ' + C.border, whiteSpace: 'nowrap' as const }}>
            {tenant.payment_verified ? '✓ Paid' : 'Unverified'}
          </span>
          <span style={opPill(C.text2)}>👥 {staffCount + 1}</span>
        </div>
      </div>
      {open && (
        <div>
          {/* Operator identity strip — the tenant owner + operator actions */}
          <div style={{ borderTop: '1px solid ' + C.border, background: C.surface2, padding: isMobile ? '12px 15px' : '13px 18px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const }}>
            <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0 }}>
              <OpRoleBadge role="operator" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{tenant.name || '—'} <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text3 }}>· tenant owner</span></div>
                <div style={{ fontSize: 12, color: C.text2, wordBreak: 'break-all' as const }}>{tenant.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <PermSummary perms={tenant.permissions} />
              <OpActionBtns person={tenant} onAction={onAction} />
            </div>
          </div>
          {staffCount === 0
            ? <div style={{ borderTop: '1px solid ' + C.border, padding: '18px', textAlign: 'center' as const, fontSize: 12.5, color: C.text3, background: C.surface }}>No sub-operators or field staff under this tenant yet.</div>
            : <div style={{ borderTop: '1px solid ' + C.border, paddingLeft: isMobile ? 0 : 22, background: C.surface2 }}>
                <div style={{ background: C.surface, borderLeft: isMobile ? 'none' : '3px solid ' + C.border }}>
                  {people.map((p: any) => <PersonRow key={p.id} person={p} onAction={onAction} isMobile={isMobile} />)}
                </div>
              </div>}
        </div>
      )}
    </div>
  )
}

// Orphan card — children whose owner_id points at no live operator. Surfaced so
// a dangling row is visible, never silently dropped.
function OrphanCard({ orphans, onAction, isMobile }: any) {
  if (!orphans || orphans.length === 0) return null
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: SHADOW_CARD, border: '1px solid ' + C.amber, marginBottom: 14, background: C.surface }}>
      <div style={{ padding: isMobile ? '12px 15px' : '13px 20px', background: C.amberBg, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>Unassigned · {orphans.length}
          <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text2, marginLeft: 8 }}>owner not a live operator — check data</span>
        </div>
      </div>
      {orphans.map((p: any) => <PersonRow key={p.id} person={p} onAction={onAction} isMobile={isMobile} />)}
    </div>
  )
}

export function OperatorsPage({ myId }: any) {
  const [operators, setOperators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editOp, setEditOp] = useState<any>(null)
  const [delOp, setDelOp] = useState<any>(null)
  const [assignOp, setAssignOp] = useState<any>(null)
  const [permissionsOp, setPermissionsOp] = useState<any>(null)
  const [locationsOp, setLocationsOp] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  // Capability chips need each person's permission row. super_admin has a
  // sanctioned unrestricted read of operator_permissions through /api/sb; we
  // pull the whole table once and index by operator_id. Chips degrade to
  // "View-only" when a person has no row — never invented.
  const [permsByOp, setPermsByOp] = useState<Record<string, any>>({})
  const isMobile = useIsMobile()
  const [q, setQ] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [visible, setVisible] = useState(8)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operator', state: 'Telangana', country: 'India', owner_id: '', company_name: '', billing_address: '', gstin: '', pincode: '', phone: '', plan: '', max_field_staff_override: '', max_sub_operators_override: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const J = { 'Content-Type': 'application/json' }
  // Roles that must belong to a parent operator
  const NEEDS_PARENT = ['sub_operator', 'field_staff']
  // Only true operators can be a parent
  const parentOperators = operators.filter((o: any) => o.role === 'operator')
  // Plan catalogue (read-only reference data from /api/plans). Every limit shown
  // below comes from here or from the operator's own override — never from a
  // constant in this file.
  const planByCode: Record<string, any> = {}
  plans.forEach((p: any) => { planByCode[p.code] = p })
  const selectedPlan = planByCode[form.plan] || null
  const limitLabel = (v: any) => (v === null || v === undefined ? 'unlimited' : String(v))
  const fetchOperators = async () => {
    setLoading(true)
    const res = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?select=id,name,email,role,state,country,owner_id,company_name,billing_address,gstin,pincode,phone,plan,max_field_staff_override,max_sub_operators_override,operator_code,payment_verified,created_at&order=created_at.desc'))
    const data = await res.json()
    setOperators(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  // Bulk permission rows for the capability chips. Best-effort: a failure just
  // leaves everyone showing "View-only", never blocks the page.
  const fetchPerms = async () => {
    try {
      const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operator_permissions?select=*'))
      const d = await r.json()
      const map: Record<string, any> = {}
      if (Array.isArray(d)) d.forEach((p: any) => { if (p && p.operator_id) map[p.operator_id] = p })
      setPermsByOp(map)
    } catch { setPermsByOp({}) }
  }
  useEffect(() => { fetchOperators(); fetchPerms() }, [])
  // Reset the "load more" window whenever the filter changes.
  useEffect(() => { setVisible(8) }, [q, regionFilter])
  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => setPlans(Array.isArray(d) ? d : []))
      .catch(() => setPlans([]))
  }, [])
  // A new operator starts on the lowest-ranked plan the catalogue offers.
  const defaultPlan = () => (plans[0]?.code || '')
  const openAdd = () => { setForm({ name: '', email: '', password: '', role: 'operator', state: 'Telangana', country: 'India', owner_id: '', company_name: '', billing_address: '', gstin: '', pincode: '', phone: '', plan: defaultPlan(), max_field_staff_override: '', max_sub_operators_override: '' }); setEditOp(null); setShowAdd(true); setMsg('') }
  const openEdit = (op: any) => { setForm({ name: op.name || '', email: op.email, password: '', role: op.role, state: op.state || '', country: op.country || 'India', owner_id: op.owner_id || '', company_name: op.company_name || '', billing_address: op.billing_address || '', gstin: op.gstin || '', pincode: op.pincode || '', phone: op.phone || '', plan: op.plan || '', max_field_staff_override: op.max_field_staff_override != null ? String(op.max_field_staff_override) : '', max_sub_operators_override: op.max_sub_operators_override != null ? String(op.max_sub_operators_override) : '' }); setEditOp(op); setShowAdd(true); setMsg('') }
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
    // Blank override = "use the plan default", which is null in the column, NOT
    // zero — zero is a real limit meaning nobody may be added.
    const parseOverride = (raw: string): number | null | undefined => {
      const s = raw.trim()
      if (!s) return null
      const n = Number(s)
      if (!Number.isInteger(n) || n < 0) return undefined // signals invalid
      return n
    }
    const fsOverride = parseOverride(form.max_field_staff_override)
    const soOverride = parseOverride(form.max_sub_operators_override)
    if (form.role === 'operator' && (fsOverride === undefined || soOverride === undefined)) {
      setMsg('Limits must be a whole number of seats, or blank for the plan default'); return
    }
    // Plan and overrides belong to a tenant operator only; other roles inherit
    // their parent's entitlements, so we never stamp these onto their rows.
    const planFields = form.role === 'operator'
      ? { plan: form.plan || null, max_field_staff_override: fsOverride ?? null, max_sub_operators_override: soOverride ?? null }
      : {}
    setSaving(true); setMsg('')
    try {
      if (editOp) {
        const body: any = { name: form.name, role: form.role, state: form.state, country: form.country, owner_id: NEEDS_PARENT.includes(form.role) ? (form.owner_id || null) : null, company_name: form.company_name.trim() || null, billing_address: form.billing_address.trim() || null, gstin: form.gstin.trim().toUpperCase() || null, pincode: form.pincode.trim() || null, phone: form.phone.trim() || null, ...planFields }
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
        const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators'), { method: 'POST', headers: { ...J, Prefer: 'return=minimal' }, body: JSON.stringify({ name: form.name, email: form.email, password_hash: hash, role: form.role, state: form.state, country: form.country, owner_id: NEEDS_PARENT.includes(form.role) ? (form.owner_id || null) : null, company_name: form.company_name.trim() || null, billing_address: form.billing_address.trim() || null, gstin: form.gstin.trim().toUpperCase() || null, pincode: form.pincode.trim() || null, phone: form.phone.trim() || null, ...planFields }) })
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

  // Attach each person's permission row, then group the flat list by owner_id
  // (Tier 1 transform). super_admin reads the full list, so this is the whole org.
  const withPerms = operators.map((o) => ({ ...o, permissions: permsByOp[o.id] || null }))
  const grouped = groupOperatorsByTenant(withPerms)

  const ql = q.trim().toLowerCase()
  const matchPerson = (p: any) => (p.name || '').toLowerCase().includes(ql) || (p.email || '').toLowerCase().includes(ql)
  // Region options come from the real tenant rows, not a hard-coded list.
  const regions = Array.from(new Set(grouped.tenants.map((g) => g.tenant.country).filter(Boolean))) as string[]
  const filteredTenants = grouped.tenants.filter((g) => {
    const t = g.tenant
    if (regionFilter !== 'all' && (t.country || '') !== regionFilter) return false
    if (!ql) return true
    const title = String(t.company_name || t.name || '')
    return title.toLowerCase().includes(ql) || matchPerson(t) || g.sub_operators.some(matchPerson) || g.field_staff.some(matchPerson)
  })
  const shownTenants = filteredTenants.slice(0, visible)

  // Searching auto-opens matching tenants; otherwise honour the per-card toggle.
  const isOpen = (id: string) => (openMap[id] != null ? openMap[id] : ql.length > 0)
  const toggle = (id: string) => setOpenMap((m) => ({ ...m, [id]: !(m[id] != null ? m[id] : ql.length > 0) }))
  const setAll = (val: boolean) => { const m: Record<string, boolean> = {}; filteredTenants.forEach((g) => { m[g.tenant.id] = val }); setOpenMap(m) }

  // Wire the ported card actions to the EXISTING modals — behaviour unchanged.
  const onAction = (key: string, person: any) => {
    if (key === 'perms') setPermissionsOp(person)
    else if (key === 'edit') openEdit(person)
    else if (key === 'del') { setMsg(''); setDelOp(person) }
    else if (key === 'locations') setLocationsOp(person)
    else if (key === 'machines') setAssignOp(person)
  }

  const kpis = [
    { label: 'Total People', value: operators.length, color: IND, icon: '👥' },
    { label: 'Super Admins', value: operators.filter(o => o.role === 'super_admin').length, color: PURPLE, icon: '👑' },
    { label: 'Fruitlink Staff', value: operators.filter(o => o.role === 'staff').length, color: '#d97706', icon: '🏢' },
    { label: 'Operators', value: operators.filter(o => o.role === 'operator').length, color: C.blue, icon: '🧑‍💼' },
    { label: 'Sub-Operators', value: operators.filter(o => o.role === 'sub_operator').length, color: '#0891b2', icon: '🧑‍💻' },
    { label: 'Field Staff', value: operators.filter(o => o.role === 'field_staff').length, color: C.orange, icon: '👷' },
  ]
  const ctlBtn = { font: 'inherit', fontSize: 12.5, fontWeight: 700, color: C.text2, background: C.surface, border: '1.5px solid ' + C.border2, borderRadius: 9, padding: '9px 13px', cursor: 'pointer', whiteSpace: 'nowrap' as const }

  return (
    <div style={{ padding: isMobile ? '18px 16px 40px' : '24px 28px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>Operators &amp; Team</div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 4, fontWeight: 600 }}>{grouped.counts.tenants} tenant{grouped.counts.tenants !== 1 ? 's' : ''} · Fruitlink internal team pinned on top</div>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 800, cursor: 'pointer', fontSize: 13.5, boxShadow: SHADOW_BRAND }}>
          + Add Operator
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(6,1fr)', gap: 12, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, boxShadow: SHADOW_CARD, overflow: 'hidden' }}>
            <div style={{ height: 3, background: k.color }} />
            <div style={{ padding: '13px 15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 20 }}>{k.icon}</span>
                <span style={{ fontSize: 26, fontWeight: 800, color: k.color, letterSpacing: '-.02em' }}>{k.value}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: C.text2, fontWeight: 700 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading...</div>
      ) : (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center', background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 12, boxShadow: SHADOW_CARD }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 190 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.text3 }}>🔍</span>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people by name or email…" style={{ width: '100%', font: 'inherit', fontSize: 13.5, fontWeight: 600, border: '1.5px solid ' + C.border2, borderRadius: 10, padding: '9px 12px 9px 34px', outline: 'none', background: C.surface, color: C.text, boxSizing: 'border-box' }} />
            </div>
            {regions.length > 0 && (
              <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{ font: 'inherit', fontSize: 13, fontWeight: 700, border: '1.5px solid ' + C.border2, borderRadius: 10, padding: '9px 13px', color: C.text2, background: C.surface, cursor: 'pointer', outline: 'none' }}>
                <option value="all">🌐 All regions</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAll(true)} style={ctlBtn}>Expand all</button>
              <button onClick={() => setAll(false)} style={ctlBtn}>Collapse all</button>
            </div>
          </div>

          {/* Pinned Fruitlink-internal card */}
          <FruitlinkCard internal={grouped.internal} onAction={onAction} isMobile={isMobile} />

          {/* Tenant list */}
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '.07em', margin: '4px 2px 12px' }}>Operator Tenants · {filteredTenants.length}</div>
          {filteredTenants.length === 0
            ? <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 14, textAlign: 'center', padding: '44px 20px' }}><div style={{ fontSize: 26, marginBottom: 10 }}>🔍</div><div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>No tenants match</div><div style={{ fontSize: 13, color: C.text3, marginTop: 6 }}>Try a different search or region.</div></div>
            : shownTenants.map(g => <TenantCard key={g.tenant.id} group={g} open={isOpen(g.tenant.id)} onToggle={() => toggle(g.tenant.id)} onAction={onAction} isMobile={isMobile} />)}

          {visible < filteredTenants.length && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={() => setVisible(v => v + 8)} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 800, color: IND, background: INDBG, border: '1px solid ' + a22(IND), borderRadius: 10, padding: '11px 22px', cursor: 'pointer' }}>Load more · {filteredTenants.length - visible} tenants left</button>
            </div>
          )}

          {/* Data-integrity surface: children with a dead owner_id, never hidden */}
          <OrphanCard orphans={grouped.orphans} onAction={onAction} isMobile={isMobile} />
        </>
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
                  <option value="staff">Fruitlink Staff</option>
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
              {/* ── Plan & seat limits ────────────────────────────────
                  The plan sets the defaults; an override is the per-operator
                  exception. Blank means "whatever the plan says", so the plan
                  can be changed later and this operator follows it. */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Plan</label>
                <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: C.surface, color: C.text }}>
                  <option value="">— No plan —</option>
                  {plans.map((p: any) => (
                    <option key={p.code} value={p.code}>{p.code.charAt(0).toUpperCase() + p.code.slice(1)}</option>
                  ))}
                </select>
                {selectedPlan && (
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 5 }}>
                    Field staff: {limitLabel(selectedPlan.max_field_staff)} · Sub-operators: {limitLabel(selectedPlan.max_sub_operators)}
                    {' · '}
                    {[
                      selectedPlan.has_team_management && 'team management',
                      selectedPlan.has_ad_manager && 'ad manager',
                      selectedPlan.has_loyalty && 'loyalty',
                      selectedPlan.has_rest_api && 'REST API',
                      selectedPlan.has_sso && 'SSO',
                    ].filter(Boolean).join(', ') || 'no add-on features'}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Field Staff Limit</label>
                  <input value={form.max_field_staff_override} onChange={e => setForm({ ...form, max_field_staff_override: e.target.value })} type="number" min={0} placeholder="—"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 5 }}>
                    blank = plan default ({selectedPlan ? limitLabel(selectedPlan.max_field_staff) : 'unlimited'})
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Sub-Operator Limit</label>
                  <input value={form.max_sub_operators_override} onChange={e => setForm({ ...form, max_sub_operators_override: e.target.value })} type="number" min={0} placeholder="—"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 5 }}>
                    blank = plan default ({selectedPlan ? limitLabel(selectedPlan.max_sub_operators) : 'unlimited'})
                  </div>
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
      {permissionsOp && <PermissionsModal op={permissionsOp} onClose={() => { setPermissionsOp(null); fetchPerms() }} />}
      {locationsOp && <LocationsModal op={locationsOp} onClose={() => setLocationsOp(null)} />}

      {delOp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 30, width: 360, textAlign: 'center', boxShadow: '0 20px 60px #00000030' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 6 }}>Remove Operator?</div>
            {/* Del is a soft-delete: the /api/sb DELETE handler PATCHes deleted_at
                for the operators table, and the page hides deleted_at rows. The
                record is retained and can be restored — copy must not claim
                "permanent / cannot be undone". */}
            <div style={{ fontSize: 13, color: C.text2, marginBottom: 22, lineHeight: 1.55 }}>
              Remove <b>{delOp.name || delOp.email}</b> from the operators list? This is a soft-delete — the record is retained and can be restored later, not permanently erased.
              {delOp.role === 'operator' && <><br /><span style={{ color: C.text3 }}>Their sub-operators and field staff stay in the database but will show as unassigned until moved to another operator.</span></>}
            </div>
            {msg && <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: C.redBg, color: C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDelOp(null)} style={{ padding: '9px 22px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={deleteOperator} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.red, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
