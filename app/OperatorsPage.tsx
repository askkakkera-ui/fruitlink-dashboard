'use client'
import { useState, useEffect } from 'react'
import { C, Pill } from './lib/dashboard-shared'

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
    const res = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?select=id,name,email,role,state,country,owner_id,company_name,billing_address,gstin,pincode,phone,plan,max_field_staff_override,max_sub_operators_override,created_at&order=created_at.desc'))
    const data = await res.json()
    setOperators(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { fetchOperators() }, [])
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

  const ROLE_COLOR: any = { super_admin: '#7c3aed', operator: C.blue, staff: '#d97706', sub_operator: '#0891b2', field_staff: C.orange }
  const ROLE_BG: any = { super_admin: '#f5f3ff', operator: C.blueBg, staff: '#fff7ed', sub_operator: '#e0f7fa', field_staff: '#fff3ea' }

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
          { label: 'Fruitlink Staff', value: operators.filter(o => o.role === 'staff').length, color: '#d97706', icon: '🏢' },
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
                      {op.role === 'super_admin' ? '👑 Super Admin' : op.role === 'staff' ? '🏢 Fruitlink Staff' : op.role === 'field_staff' ? '👷 Field Staff' : op.role === 'sub_operator' ? '🧑‍💼 Sub-Operator' : '🧑‍💼 Operator'}
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
