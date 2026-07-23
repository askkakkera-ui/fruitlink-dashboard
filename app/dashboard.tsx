'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import WarehouseSection from './WarehouseSection'
import NotifyConfigSection from './NotifyConfigSection'
import MyStaffSection from './MyStaffSection'
import ReportsSection from './ReportsSection'
import FieldStaffSection from './FieldStaffSection'
import AttendanceSection from './AttendanceSection'
import InternalAttendanceSection from './InternalAttendanceSection'
import { C, SB_KEY, getCookie, useIsMobile, Badge, ErrorBoundary } from './lib/dashboard-shared'
import { SettingsPage } from './SettingsPage'
import { OperatorsPage, MyTeamPage } from './OperatorsPage'
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
    if (r === 'operator' || r === 'sub_operator' || r === 'staff' || r === 'field_staff') {
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
    teamattendance: role === 'super_admin'
      ? <InternalAttendanceSection />
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

          /* Operators & data tables: stack each row as a card on phones.
             Each <td> carries data-label; ::before renders it so rows read as
             labelled cards with no horizontal scroll. Overrides the block/
             overflow + inline min-width that the generic table rule imposes. */
          table.fl-stack { display: block; white-space: normal; overflow-x: visible; min-width: 0 !important; }
          table.fl-stack thead { display: none; }
          table.fl-stack tbody { display: block; }
          table.fl-stack tr { display: block; margin-bottom: 12px; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden; }
          /* Separators as border-top so the last *visible* cell never trails a
             line (the empty Action cell on resolved rows is display:none, so a
             border-bottom on it would still paint a stray rule). */
          table.fl-stack td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px !important; border-top: 1px solid ${C.border}; text-align: right; }
          table.fl-stack td:empty { display: none; }
          table.fl-stack td:first-child { border-top: none; }
          table.fl-stack td::before { content: attr(data-label); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: ${C.text3}; text-align: left; flex-shrink: 0; }
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
