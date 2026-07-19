'use client'
import { useState, useEffect, useRef } from 'react'
import { C, Pill } from './lib/dashboard-shared'

export function FleetMapPage({ machines }: { machines: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  // Coordinates pulled straight from Supabase by serial number (no VPS dependency).
  const [dbCoords, setDbCoords] = useState<Record<string, {lat: number, lng: number}>>({})
  const MB = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'NEXT_PUBLIC_MAPBOX_TOKEN_HERE'
  // Hardcoded fallback coords by SN, then by location string
  const MACHINE_COORDS: Record<string, {lat: number, lng: number}> = {
    'C3B31F38D1C07A76': { lat: 17.45437171063268, lng: 78.36593749556503 }, // Fruitful-2 HITEC City, Kondapur exact
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
  // Load saved lat/lng for every machine directly from Supabase (via the working /api/sb proxy)
  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=sn,location_lat,location_lng'))
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d)) return
        const map: Record<string, {lat: number, lng: number}> = {}
        d.forEach((row: any) => {
          if (row && row.sn && row.location_lat != null && row.location_lng != null) {
            map[row.sn] = { lat: Number(row.location_lat), lng: Number(row.location_lng) }
          }
        })
        setDbCoords(map)
      })
      .catch(() => {})
  }, [])
  const getCoords = (m: any) => {
    if (dbCoords[m.sn]) return dbCoords[m.sn]
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
    const esc = (s: any) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
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
  }, [scriptLoaded, machines, dbCoords])
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
            return (
              <div key={m.id} style={{ borderBottom: '1px solid ' + C.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: online ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🖥</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                    <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>📍 {m.location || m.sn}</div>
                  </div>
                  <Pill color={online ? C.green : C.red} bg={online ? C.greenBg : C.redBg}>{online ? 'Online' : 'Offline'}</Pill>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
