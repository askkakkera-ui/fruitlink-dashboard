'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const MACHINE_COORDS = { 'C3B31F38D1C07A76': { lat: 17.4363, lng: 78.4439 }, '9E3D050CEF2EEC7B': { lat: 17.5006, lng: 78.6199 } };

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function TempChart({ data }) {
  if (!data || data.length < 2) return <div className='text-xs text-gray-400 text-center py-4'>No data yet</div>;
  const W = 600; const H = 120; const pad = { t:10, r:10, b:30, l:36 };
  const iW = W - pad.l - pad.r; const iH = H - pad.t - pad.b;
  const vals = data.map(d => d.inner_temp_c).filter(v => v !== null && v !== undefined);
  if (vals.length < 2) return <div className='text-xs text-gray-400 text-center py-4'>No data yet</div>;
  const mn = Math.min(...vals); const mx = Math.max(...vals);
  const range = mx - mn || 1;
  const filtered = data.filter(d => d.inner_temp_c !== null);
  const pts = filtered.map((d, i) => { const x = pad.l + (i / (filtered.length - 1)) * iW; const y = pad.t + iH - ((d.inner_temp_c - mn) / range) * iH; return x + ',' + y; }).join(' ');
  const ticks = [mn, Math.round((mn + mx) / 2), mx];
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} className='w-full' style={{height:120}}>
      {ticks.map((t, i) => { const y = pad.t + iH - ((t - mn) / range) * iH; return <g key={i}><line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke='#f3f4f6' strokeWidth='1'/><text x={pad.l - 4} y={y + 4} textAnchor='end' fontSize='9' fill='#9ca3af'>{t}C</text></g>; })}
      <polyline points={pts} fill='none' stroke='#f97316' strokeWidth='2' strokeLinejoin='round'/>
      {filtered.filter((_, i) => i % Math.max(1, Math.ceil(filtered.length / 6)) === 0).map((d, i) => { const idx = filtered.indexOf(d); const x = pad.l + (idx / (filtered.length - 1)) * iW; const label = new Date(d.ts).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }); return <text key={i} x={x} y={H - 4} textAnchor='middle' fontSize='9' fill='#9ca3af'>{label}</text>; })}
    </svg>
  );
}

function StockChart({ data }) {
  if (!data || data.length < 2) return <div className='text-xs text-gray-400 text-center py-4'>No data yet</div>;
  const W = 600; const H = 80; const pad = { t:8, r:10, b:24, l:10 };
  const iW = W - pad.l - pad.r; const iH = H - pad.t - pad.b;
  const levels = [{ key: 'stock_l1', color: '#f97316', label: 'L1' }, { key: 'stock_l2', color: '#16a34a', label: 'L2' }, { key: 'stock_l3', color: '#3b82f6', label: 'L3' }];
  return (
    <div>
      <svg viewBox={'0 0 ' + W + ' ' + H} className='w-full' style={{height:80}}>
        {levels.map(lv => { const pts = data.map((d, i) => { const x = pad.l + (i / (data.length - 1)) * iW; const y = pad.t + (d[lv.key] ? 2 : iH); return x + ',' + y; }).join(' '); return <polyline key={lv.key} points={pts} fill='none' stroke={lv.color} strokeWidth='2' strokeLinejoin='round' opacity='0.8'/>; })}
        {data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 6)) === 0).map((d, i) => { const idx = data.indexOf(d); const x = pad.l + (idx / (data.length - 1)) * iW; const label = new Date(d.ts).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }); return <text key={i} x={x} y={H - 2} textAnchor='middle' fontSize='9' fill='#9ca3af'>{label}</text>; })}
      </svg>
      <div className='flex gap-4 mt-1'>{levels.map(lv => <div key={lv.key} className='flex items-center gap-1'><div style={{width:8,height:8,borderRadius:2,background:lv.color}}></div><span className='text-xs text-gray-400'>{lv.label}</span></div>)}</div>
    </div>
  );
}

function FleetMap({ machines }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if ((window as any).mapboxgl) { setScriptLoaded(true); return; }
    if (document.querySelector('script[src*="mapbox-gl"]')) { setScriptLoaded(true); return; }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdn.jsdelivr.net/npm/mapbox-gl@3.3.0/dist/mapbox-gl.css'; document.head.appendChild(link);
    const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/mapbox-gl@3.3.0/dist/mapbox-gl.js'; script.onload = () => setScriptLoaded(true); document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !mapRef.current || mapInstanceRef.current) return;
    const mapboxgl = (window as any).mapboxgl;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({ container: mapRef.current, style: 'mapbox://styles/mapbox/light-v11', center: [78.53, 17.47], zoom: 10.5 });
    mapInstanceRef.current = map;
    map.on('load', () => {
      setMapLoaded(true);
      machines.forEach((machine) => {
        const coords = MACHINE_COORDS[machine.sn];
        if (!coords) return;
        const online = machine.status === 'online';
        const el = document.createElement('div');
        el.style.cssText = 'width:46px;height:46px;border-radius:50%;background:' + (online ? '#f97316' : '#e5e7eb') + ';border:3px solid ' + (online ? '#c2410c' : '#d1d5db') + ';display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;box-shadow:0 4px 12px ' + (online ? 'rgba(249,115,22,0.4)' : 'rgba(0,0,0,0.12)') + ';transition:transform 0.15s;';
        el.innerHTML = '🍊';
        el.onmouseenter = () => { el.style.transform = 'scale(1.15)'; };
        el.onmouseleave = () => { el.style.transform = 'scale(1)'; };
        el.addEventListener('click', () => { setSelected(machine); map.flyTo({ center: [coords.lng, coords.lat], zoom: 14, duration: 1200 }); });
        new mapboxgl.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map);
      });
      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    });
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [scriptLoaded, machines]);

  const flyTo = (machine) => {
    setSelected(machine);
    const coords = MACHINE_COORDS[machine.sn];
    if (mapInstanceRef.current && coords) mapInstanceRef.current.flyTo({ center: [coords.lng, coords.lat], zoom: 14, duration: 1200 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>Fleet Map</h2>
        <p style={{ fontSize: 15, color: '#6b7280', margin: '4px 0 0' }}>{machines.filter(m => m.status === 'online').length} of {machines.length} machines online · Hyderabad</p>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <div ref={mapRef} style={{ flex: 1, borderRadius: 20, overflow: 'hidden', border: '1.5px solid #e8eaed', minHeight: 500, background: '#f1f5f9', position: 'relative' }}>
          {!mapLoaded && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#6b7280', fontSize: 16 }}><div style={{ fontSize: 36 }}>Loading map...</div></div>}
        </div>
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {machines.map((machine) => {
            const online = machine.status === 'online';
            const isSel = selected && selected.id === machine.id;
            return (
              <div key={machine.id} onClick={() => flyTo(machine)} style={{ background: '#fff', border: '1.5px solid ' + (isSel ? '#f97316' : '#e8eaed'), borderRadius: 16, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isSel ? '0 0 0 3px #fed7aa' : '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: online ? '#fff7ed' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍊</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>{machine.display_name || machine.sn}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{machine.location || 'Hyderabad'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: online ? '#dcfce7' : '#f3f4f6', color: online ? '#15803d' : '#6b7280' }}>{online ? 'Online' : 'Offline'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>SN: {machine.sn}</div>
              </div>
            );
          })}
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', marginBottom: 4 }}>Coverage Area</div>
            <div style={{ fontSize: 13, color: '#f97316', lineHeight: 1.6 }}>Ameerpet - SR Nagar<br/>ECIL - Cheeriyal corridor</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { label: 'Console', icon: '⊡', key: 'console', badge: 'live' },
  { label: 'Equipment Management', icon: '⊞', key: 'equipment', children: [{ label: 'Machine List', key: 'machines', icon: '▣' }, { label: 'Fleet Map', key: 'fleet', icon: '◎' }, { label: 'Alerts', key: 'alerts', icon: '!' }] },
  { label: 'Order Management', icon: '⊟', key: 'orders', children: [{ label: 'Orders List', key: 'orders-list', icon: '▤' }] },
  { label: 'Operator Management', icon: '⊕', key: 'operators', children: [{ label: 'Operators', key: 'operators-list', icon: '▥' }] },
  { label: 'Settings', icon: '⊗', key: 'settings' },
];


const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#16a34a',
}
const SEVERITY_BG: Record<string, string> = {
  CRITICAL: '#fff1f2', HIGH: '#fff7ed', MEDIUM: '#fffbeb', LOW: '#f0fdf4',
}
const SEVERITY_ICON: Record<string, string> = {
  CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢',
}
const ALERT_LABELS: Record<string, string> = {
  machine_offline: 'Machine Offline', temperature_high: 'High Temperature',
  temperature_low: 'Low Temperature', temperature_stop: 'Temp — Stop Selling',
  stock_empty_l1: 'Layer 1 Empty', stock_empty_l2: 'Layer 2 Empty', stock_empty_l3: 'Layer 3 Empty',
  stock_low_l1: 'Layer 1 Low Stock', stock_low_l2: 'Layer 2 Low Stock', stock_low_l3: 'Layer 3 Low Stock',
  door_open: 'Door Open', vend_failure: 'Vend Failure', cup_empty: 'Cups Empty',
  film_empty: 'Film Empty', cooling_off: 'Cooling Off', no_orders_4h: 'No Orders (4h)',
}

function AlertsPage({ supabaseUrl, supabaseKey }: { supabaseUrl: string; supabaseKey: string }) {
  const [alerts, setAlerts] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState<'all'|'active'|'resolved'>('active')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [machineFilter, setMachineFilter] = useState<Record<string, 'all'|'active'|'resolved'>>({})

  const fetchAlerts = async () => {
    setLoading(true)
    const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey }
    const [alertRes, machineRes] = await Promise.all([
      fetch(supabaseUrl + '/rest/v1/alerts?select=*&order=created_at.desc&limit=500', { headers }),
      fetch(supabaseUrl + '/rest/v1/machines?select=id,display_name,sn,location', { headers }),
    ])
    const [alertData, machineData] = await Promise.all([alertRes.json(), machineRes.json()])
    const ads = Array.isArray(alertData) ? alertData : []
    const mds = Array.isArray(machineData) ? machineData : []
    setAlerts(ads)
    setMachines(mds)
    // auto-expand machines that have active alerts
    const exp: Record<string, boolean> = {}
    mds.forEach((m: any) => { if (ads.some((a: any) => a.machine_id === m.id && !a.resolved_at)) exp[m.id] = true })
    setExpanded(exp)
    setLoading(false)
  }

  useEffect(() => { fetchAlerts() }, [])

  const getMachine = (id: string) => machines.find((m: any) => m.id === id) || {} as any

  const globalFiltered = alerts.filter((a: any) => {
    if (globalFilter === 'active' && a.resolved_at) return false
    if (globalFilter === 'resolved' && !a.resolved_at) return false
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false
    return true
  })

  const counts: any = {
    CRITICAL: alerts.filter((a: any) => !a.resolved_at && a.severity === 'CRITICAL').length,
    HIGH: alerts.filter((a: any) => !a.resolved_at && a.severity === 'HIGH').length,
    MEDIUM: alerts.filter((a: any) => !a.resolved_at && a.severity === 'MEDIUM').length,
    LOW: alerts.filter((a: any) => !a.resolved_at && a.severity === 'LOW').length,
    active: alerts.filter((a: any) => !a.resolved_at).length,
    resolved: alerts.filter((a: any) => a.resolved_at).length,
  }

  // Group filtered alerts by machine
  const machinesWithAlerts = machines.filter(m => globalFiltered.some((a: any) => a.machine_id === m.id))

  const fmtTime = (t: string) => {
    const d = new Date(t)
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
  const timeAgo = (t: string) => {
    const diff = Date.now() - new Date(t).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return m + 'm ago'
    const h = Math.floor(m / 60)
    if (h < 24) return h + 'h ago'
    return Math.floor(h / 24) + 'd ago'
  }

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))
  const getMachineFilter = (id: string) => machineFilter[id] || 'all'
  const setMachFilter = (id: string, f: 'all'|'active'|'resolved') => setMachineFilter(p => ({ ...p, [id]: f }))

  return (
    <div style={{ padding: '28px 32px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Alert Center</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{counts.active} active alerts across {machines.length} machine{machines.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={fetchAlerts} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1f2e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          <span style={{ fontSize: 15 }}>↻</span> Refresh
        </button>
      </div>

      {/* Severity cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {(['CRITICAL','HIGH','MEDIUM','LOW'] as const).map(s => (
          <div key={s} onClick={() => setSeverityFilter(severityFilter === s ? 'all' : s)}
            style={{ background: severityFilter === s ? SEVERITY_BG[s] : '#fff', border: '1.5px solid ' + (severityFilter === s ? SEVERITY_COLOR[s] : '#e2e8f0'), borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: severityFilter === s ? '0 4px 12px ' + SEVERITY_COLOR[s] + '22' : '0 1px 3px #0000000a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{SEVERITY_ICON[s]}</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: counts[s] > 0 ? SEVERITY_COLOR[s] : '#cbd5e1' }}>{counts[s]}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: SEVERITY_COLOR[s], textTransform: 'uppercase', letterSpacing: 0.8 }}>{s}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Active alerts</div>
          </div>
        ))}
      </div>

      {/* Global filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#fff', borderRadius: 12, padding: 6, border: '1px solid #e2e8f0', width: 'fit-content', boxShadow: '0 1px 3px #0000000a' }}>
        {([['active', '● Active', counts.active], ['resolved', '✓ Resolved', counts.resolved], ['all', 'All', counts.active + counts.resolved]] as const).map(([f, label, count]) => (
          <button key={f} onClick={() => setGlobalFilter(f as any)}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', background: globalFilter === f ? '#1a1f2e' : 'transparent', color: globalFilter === f ? '#fff' : '#64748b' }}>
            {label} <span style={{ opacity: 0.7, fontWeight: 400, fontSize: 12 }}>({count})</span>
          </button>
        ))}
      </div>

      {/* Machine grouped sections */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}><div style={{ fontSize: 32, marginBottom: 8 }}>⟳</div><div>Loading alerts...</div></div>
      ) : machinesWithAlerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>All clear!</div>
          <div style={{ fontSize: 14, color: '#64748b' }}>No alerts match your current filters.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {machinesWithAlerts.map((m: any) => {
            const machAlerts = globalFiltered.filter((a: any) => a.machine_id === m.id)
            const mf = getMachineFilter(m.id)
            const mFiltered = machAlerts.filter((a: any) => {
              if (mf === 'active') return !a.resolved_at
              if (mf === 'resolved') return !!a.resolved_at
              return true
            })
            const mActive = machAlerts.filter((a: any) => !a.resolved_at).length
            const mResolved = machAlerts.filter((a: any) => a.resolved_at).length
            const isOpen = !!expanded[m.id]
            const worstSev = mActive > 0 ? (machAlerts.find((a: any) => !a.resolved_at && a.severity === 'CRITICAL') ? 'CRITICAL' : machAlerts.find((a: any) => !a.resolved_at && a.severity === 'HIGH') ? 'HIGH' : machAlerts.find((a: any) => !a.resolved_at && a.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW') : null

            return (
              <div key={m.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px #0000000a' }}>
                {/* Machine header - clickable to expand */}
                <div onClick={() => toggleExpand(m.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer', background: isOpen ? '#f8fafc' : '#fff', borderBottom: isOpen ? '1px solid #e2e8f0' : 'none', transition: 'background 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {worstSev && <span style={{ fontSize: 20 }}>{SEVERITY_ICON[worstSev]}</span>}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{m.display_name}</div>
                      <div style={{ fontSize: 11, color: '#6366f1', fontFamily: 'monospace', fontWeight: 600, marginTop: 1 }}>{m.sn}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>📍 {m.location || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {mActive > 0 && <span style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: 700, fontSize: 12, borderRadius: 20, padding: '3px 12px' }}>● {mActive} Active</span>}
                    {mResolved > 0 && <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontWeight: 700, fontSize: 12, borderRadius: 20, padding: '3px 12px' }}>✓ {mResolved} Resolved</span>}
                    <span style={{ fontSize: 18, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
                  </div>
                </div>

                {/* Expanded alert list */}
                {isOpen && (
                  <div>
                    {/* Per-machine filter tabs */}
                    <div style={{ display: 'flex', gap: 4, padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {([['all', 'All', machAlerts.length], ['active', '● Active', mActive], ['resolved', '✓ Resolved', mResolved]] as const).map(([f, label, count]) => (
                        <button key={f} onClick={(e) => { e.stopPropagation(); setMachFilter(m.id, f) }}
                          style={{ padding: '4px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', background: mf === f ? '#1a1f2e' : '#fff', color: mf === f ? '#fff' : '#64748b', boxShadow: '0 1px 2px #0000001a' }}>
                          {label} ({count})
                        </button>
                      ))}
                    </div>

                    {/* Alert rows */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          {['Severity', 'Alert & Description', 'Time', 'Status'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mFiltered.map((a: any, i: number) => (
                          <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: SEVERITY_BG[a.severity] || '#f8fafc', border: '1px solid ' + (SEVERITY_COLOR[a.severity] || '#e2e8f0') + '44', borderRadius: 7, padding: '3px 9px' }}>
                                <span style={{ fontSize: 10 }}>{SEVERITY_ICON[a.severity] || '⚪'}</span>
                                <span style={{ fontWeight: 700, fontSize: 11, color: SEVERITY_COLOR[a.severity] || '#666' }}>{a.severity}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'inline-block', background: '#f1f5f9', borderRadius: 5, padding: '2px 7px', fontFamily: 'monospace', fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 4 }}>{a.alert_type}</div>
                              <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{ALERT_LABELS[a.alert_type] || a.alert_type.replace(/_/g, ' ')}</div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{a.message}</div>
                            </td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{fmtTime(a.created_at)}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{timeAgo(a.created_at)}</div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {!a.resolved_at ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '4px 10px' }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Active</span>
                                </div>
                              ) : (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '4px 10px' }}>
                                  <span style={{ fontSize: 11 }}>✓</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>Resolved</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', fontSize: 12, color: '#94a3b8' }}>
                      Showing {mFiltered.length} of {machAlerts.length} alerts for {m.display_name}
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


function AssignMachinesModal({ op, supabaseUrl, supabaseKey, onClose }: { op: any, supabaseUrl: string, supabaseKey: string, onClose: () => void }) {
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
      // Delete all current assignments for this operator
      await fetch(supabaseUrl + '/rest/v1/machine_operators?operator_id=eq.' + op.id, { method: 'DELETE', headers })
      // Insert new assignments
      if (assigned.length > 0) {
        await fetch(supabaseUrl + '/rest/v1/machine_operators', {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(assigned.map(mid => ({ machine_id: mid, operator_id: op.id })))
        })
      }
      setMsg('✓ Machines assigned!')
      setTimeout(onClose, 800)
    } catch(e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 480, boxShadow: '0 20px 60px #0002', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Assign Machines</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>to {op.name || op.email}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 18, color: '#64748b' }}>✕</button>
        </div>
        {machines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No machines found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {machines.map((m: any) => {
              const isChecked = assigned.includes(m.id)
              return (
                <div key={m.id} onClick={() => toggle(m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: '1.5px solid ' + (isChecked ? '#f97316' : '#e2e8f0'), background: isChecked ? '#fff7ed' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid ' + (isChecked ? '#f97316' : '#cbd5e1'), background: isChecked ? '#f97316' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isChecked && <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{m.display_name}</div>
                    <div style={{ fontSize: 11, color: '#6366f1', fontFamily: 'monospace', marginTop: 1 }}>{m.sn}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>📍 {m.location || '—'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {msg && <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, background: msg.startsWith('✓') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✓') ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OperatorsPage({ supabaseUrl, supabaseKey }: { supabaseUrl: string; supabaseKey: string }) {
  const [operators, setOperators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editOp, setEditOp] = useState<any>(null)
  const [delOp, setDelOp] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operator', state: 'Telangana', country: 'India' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [assignOp, setAssignOp] = useState<any>(null)

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
        setMsg('✓ Operator updated')
      } else {
        const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: form.password }) })
        const { hash } = await hashRes.json()
        await fetch(supabaseUrl + '/rest/v1/operators', { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ name: form.name, email: form.email, password_hash: hash, role: form.role, state: form.state, country: form.country }) })
        setMsg('✓ Operator added')
      }
      await fetchOperators()
      setTimeout(() => { setShowAdd(false); setMsg('') }, 1000)
    } catch(e: any) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }

  const deleteOperator = async () => {
    if (!delOp) return
    await fetch(supabaseUrl + '/rest/v1/operators?id=eq.' + delOp.id, { method: 'DELETE', headers })
    setDelOp(null)
    fetchOperators()
  }

  const ROLE_COLOR: any = { super_admin: '#7c3aed', operator: '#0284c7' }
  const ROLE_BG: any = { super_admin: '#f5f3ff', operator: '#f0f9ff' }

  return (
    <div style={{ padding: '28px 32px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Operators</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{operators.length} operator{operators.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          + Add Operator
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Operators', value: operators.length, icon: '👥', color: '#0284c7', bg: '#f0f9ff' },
          { label: 'Super Admins', value: operators.filter(o => o.role === 'super_admin').length, icon: '👑', color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Operators', value: operators.filter(o => o.role === 'operator').length, icon: '🧑‍💼', color: '#16a34a', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 3px #0000000a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px #0000000a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Operator', 'Email', 'Role', 'Region', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '13px 18px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operators.map((op, i) => (
                <tr key={op.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                        {(op.name || op.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{op.name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{op.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#374151' }}>{op.email}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ background: ROLE_BG[op.role] || '#f8fafc', color: ROLE_COLOR[op.role] || '#555', padding: '4px 12px', borderRadius: 8, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {op.role === 'super_admin' ? '👑 Super Admin' : '🧑‍💼 Operator'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontSize: 13, color: '#374151' }}>{op.state || '—'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{op.country || '—'}</div>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#94a3b8', fontSize: 12 }}>
                    {op.created_at ? new Date(op.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setAssignOp(op)} style={{ background: '#eff6ff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>🖥 Machines</button>
                      <button onClick={() => openEdit(op)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>✏️ Edit</button>
                      <button onClick={() => setDelOp(op)} style={{ background: '#fef2f2', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>🗑 Delete</button>
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
        <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 460, boxShadow: '0 20px 60px #0002' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{editOp ? 'Edit Operator' : 'Add New Operator'}</h3>
            {[
              { label: 'Full Name', key: 'name', type: 'text', placeholder: 'e.g. Ravi Kumar' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'ravi@fruitlink.in', disabled: !!editOp },
              { label: editOp ? 'New Password (leave blank to keep)' : 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} disabled={f.disabled}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: f.disabled ? '#f8fafc' : '#fff', color: '#0f172a' }} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#fff', color: '#0f172a' }}>
                  <option value="operator">Operator</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>State</label>
                <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Telangana"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#0f172a' }} />
              </div>
            </div>
            {msg && <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, background: msg.startsWith('✓') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✓') ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={saveOperator} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editOp ? 'Update' : 'Add Operator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {assignOp && <AssignMachinesModal op={assignOp} supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} onClose={() => setAssignOp(null)} />}

      {delOp && (
        <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 380, boxShadow: '0 20px 60px #0002', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗑</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Delete Operator?</h3>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>This will permanently delete <b>{delOp.name || delOp.email}</b>. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDelOp(null)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={deleteOperator} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function ProfileSection({ operatorId, name, role, state, initials, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [form, setForm] = useState({ name, state, country: 'India', org: 'Fruitlink Technologies Pvt Ltd', phone: '+91 89771 10142', email: 'skkakkera@gmail.com' })
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }))
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name: form.name, state: form.state, country: form.country }) })
      if (res.ok) { document.cookie = 'fl_operator_name=' + form.name + '; path=/; max-age=86400'; document.cookie = 'fl_state=' + form.state + '; path=/; max-age=86400'; showSaved() }
      else showErr('Failed to save')
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Profile</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Your account details and contact information</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700 }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{form.name}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{form.email}</div>
          <div style={{ marginTop: 6, display: 'inline-block', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>{role === 'super_admin' ? 'Super Admin' : 'Operator'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {[['Full Name', 'name'], ['Email Address', 'email'], ['WhatsApp Number', 'phone'], ['State / Region', 'state'], ['Country', 'country'], ['Organization', 'org']].map(([label, key]) => (
          <div key={key}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{label}</div>
            <input value={(form as any)[key]} onChange={set(key)} readOnly={key === 'email'} style={{ width: '100%', background: key === 'email' ? '#f1f5f9' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a', outline: 'none' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save changes'}</button>
      </div>
    </div>
  )
}

function SecuritySection({ operatorId, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [pw, setPw] = useState({ current: '', newp: '', confirm: '' })
  const save = async () => {
    if (pw.newp !== pw.confirm) return showErr('Passwords do not match')
    if (pw.newp.length < 6) return showErr('Min 6 characters')
    setSaving(true)
    try {
      const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw.newp }) })
      const { hash } = await hashRes.json()
      const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: hash }) })
      if (res.ok) { setPw({ current: '', newp: '', confirm: '' }); showSaved() } else showErr('Failed to update')
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Security</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Manage your password and active sessions</div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 16 }}>Change Password</div>
        {([['Current password', 'current'], ['New password', 'newp'], ['Confirm new password', 'confirm']] as const).map(([label, key]) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{label}</div>
            <input type="password" value={(pw as any)[key]} onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))} placeholder="••••••••" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          </div>
        ))}
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Updated!' : saving ? 'Saving...' : 'Update password'}</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Active Sessions</div>
        {[['Chrome on Mac · Hyderabad, IN', 'Now', true], ['Chrome on iPhone · Hyderabad, IN', '2h ago', false]].map(([sess, time, current]: any) => (
          <div key={sess} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{sess}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{time} {current && <span style={{ color: '#16a34a', fontWeight: 600 }}>· Current</span>}</div>
            </div>
            {!current && <button style={{ fontSize: 12, color: '#dc2626', border: '1px solid #fecaca', background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Revoke</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function LocationsSection({ SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [machines, setMachines] = useState<any[]>([])
  useEffect(() => {
    fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,location,status', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(r => r.json()).then(d => setMachines(Array.isArray(d) ? d : []))
  }, [])
  const update = (id: string, field: string, val: string) => setMachines(ms => ms.map(m => m.id === id ? { ...m, [field]: val } : m))
  const save = async () => {
    setSaving(true)
    try {
      await Promise.all(machines.map(m => fetch(SB_URL + '/rest/v1/machines?id=eq.' + m.id, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ display_name: m.display_name, location: m.location }) })))
      showSaved()
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Machine Locations</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Update display names and locations for your machines</div>
      {machines.map(m => (
        <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{m.display_name}</div>
            <div style={{ fontSize: 11, color: m.status === 'online' ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{m.status === 'online' ? '● Online' : '○ Offline'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Display Name</div>
              <input value={m.display_name || ''} onChange={e => update(m.id, 'display_name', e.target.value)} style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Location</div>
              <input value={m.location || ''} onChange={e => update(m.id, 'location', e.target.value)} style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Serial Number</div>
              <input value={m.sn || ''} readOnly style={{ width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontFamily: 'monospace', color: '#64748b', outline: 'none' }} />
            </div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save locations'}</button>
      </div>
    </div>
  )
}

function DangerSection({ SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, operatorId }: any) {
  const clearAlerts = async () => {
    if (!window.confirm('Delete ALL alert history? This cannot be undone.')) return
    setSaving(true)
    try {
      await fetch(SB_URL + '/rest/v1/alerts?created_at=gte.2000-01-01', { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      showSaved()
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  const clearTelemetry = async () => {
    if (!window.confirm('Delete ALL telemetry history? This cannot be undone.')) return
    setSaving(true)
    try {
      await fetch(SB_URL + '/rest/v1/telemetry?ts=gte.2000-01-01', { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      showSaved()
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', marginBottom: 4 }}>Danger Zone</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Irreversible actions — proceed with caution</div>
      {[
        { title: 'Clear All Alerts', desc: 'Permanently delete all alert history from the database', btn: 'Clear alerts', red: false, action: clearAlerts },
        { title: 'Reset Telemetry', desc: 'Remove all telemetry history for all machines', btn: 'Reset data', red: false, action: clearTelemetry },
        { title: 'Delete Account', desc: 'Permanently delete your account and all associated data', btn: 'Delete account', red: true, action: () => showErr('Contact support to delete your account') },
      ].map(({ title, desc, btn, red, action }) => (
        <div key={title} style={{ background: '#fff', border: '1px solid ' + (red ? '#fecaca' : '#e2e8f0'), borderRadius: 12, padding: '16px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{desc}</div>
          </div>
          <button onClick={action} disabled={saving} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid ' + (red ? '#fca5a5' : '#e2e8f0'), background: red ? '#fef2f2' : '#fff', color: red ? '#dc2626' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>{btn}</button>
        </div>
      ))}
    </div>
  )
}


function ProfileSection({ operatorId, name, role, state, initials, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [form, setForm] = useState({ name, state, country: 'India', org: 'Fruitlink Technologies Pvt Ltd', phone: '+91 89771 10142', email: 'skkakkera@gmail.com' })
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }))
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name: form.name, state: form.state, country: form.country }) })
      if (res.ok) { document.cookie = 'fl_operator_name=' + form.name + '; path=/; max-age=86400'; document.cookie = 'fl_state=' + form.state + '; path=/; max-age=86400'; showSaved() }
      else showErr('Failed to save')
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Profile</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Your account details and contact information</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700 }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{form.name}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{form.email}</div>
          <div style={{ marginTop: 6, display: 'inline-block', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>{role === 'super_admin' ? 'Super Admin' : 'Operator'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {[['Full Name', 'name'], ['Email Address', 'email'], ['WhatsApp Number', 'phone'], ['State / Region', 'state'], ['Country', 'country'], ['Organization', 'org']].map(([label, key]) => (
          <div key={key}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{label}</div>
            <input value={(form as any)[key]} onChange={set(key)} readOnly={key === 'email'} style={{ width: '100%', background: key === 'email' ? '#f1f5f9' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a', outline: 'none' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save changes'}</button>
      </div>
    </div>
  )
}

function SecuritySection({ operatorId, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [pw, setPw] = useState({ current: '', newp: '', confirm: '' })
  const save = async () => {
    if (pw.newp !== pw.confirm) return showErr('Passwords do not match')
    if (pw.newp.length < 6) return showErr('Min 6 characters')
    setSaving(true)
    try {
      const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw.newp }) })
      const { hash } = await hashRes.json()
      const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: hash }) })
      if (res.ok) { setPw({ current: '', newp: '', confirm: '' }); showSaved() } else showErr('Failed to update')
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Security</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Manage your password and active sessions</div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 16 }}>Change Password</div>
        {([['Current password', 'current'], ['New password', 'newp'], ['Confirm new password', 'confirm']] as const).map(([label, key]) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{label}</div>
            <input type="password" value={(pw as any)[key]} onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))} placeholder="••••••••" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          </div>
        ))}
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Updated!' : saving ? 'Saving...' : 'Update password'}</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Active Sessions</div>
        {[['Chrome on Mac · Hyderabad, IN', 'Now', true], ['Chrome on iPhone · Hyderabad, IN', '2h ago', false]].map(([sess, time, current]: any) => (
          <div key={sess} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{sess}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{time} {current && <span style={{ color: '#16a34a', fontWeight: 600 }}>· Current</span>}</div>
            </div>
            {!current && <button style={{ fontSize: 12, color: '#dc2626', border: '1px solid #fecaca', background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Revoke</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function LocationsSection({ SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const [machines, setMachines] = useState<any[]>([])
  useEffect(() => {
    fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,location,status', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(r => r.json()).then(d => setMachines(Array.isArray(d) ? d : []))
  }, [])
  const update = (id: string, field: string, val: string) => setMachines(ms => ms.map(m => m.id === id ? { ...m, [field]: val } : m))
  const save = async () => {
    setSaving(true)
    try {
      await Promise.all(machines.map(m => fetch(SB_URL + '/rest/v1/machines?id=eq.' + m.id, { method: 'PATCH', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ display_name: m.display_name, location: m.location }) })))
      showSaved()
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Machine Locations</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Update display names and locations for your machines</div>
      {machines.map(m => (
        <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{m.display_name}</div>
            <div style={{ fontSize: 11, color: m.status === 'online' ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{m.status === 'online' ? '● Online' : '○ Offline'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Display Name</div>
              <input value={m.display_name || ''} onChange={e => update(m.id, 'display_name', e.target.value)} style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Location</div>
              <input value={m.location || ''} onChange={e => update(m.id, 'location', e.target.value)} style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Serial Number</div>
              <input value={m.sn || ''} readOnly style={{ width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontFamily: 'monospace', color: '#64748b', outline: 'none' }} />
            </div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save locations'}</button>
      </div>
    </div>
  )
}

function DangerSection({ SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, operatorId }: any) {
  const clearAlerts = async () => {
    if (!window.confirm('Delete ALL alert history? This cannot be undone.')) return
    setSaving(true)
    try {
      await fetch(SB_URL + '/rest/v1/alerts?created_at=gte.2000-01-01', { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      showSaved()
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  const clearTelemetry = async () => {
    if (!window.confirm('Delete ALL telemetry history? This cannot be undone.')) return
    setSaving(true)
    try {
      await fetch(SB_URL + '/rest/v1/telemetry?ts=gte.2000-01-01', { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      showSaved()
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', marginBottom: 4 }}>Danger Zone</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Irreversible actions — proceed with caution</div>
      {[
        { title: 'Clear All Alerts', desc: 'Permanently delete all alert history from the database', btn: 'Clear alerts', red: false, action: clearAlerts },
        { title: 'Reset Telemetry', desc: 'Remove all telemetry history for all machines', btn: 'Reset data', red: false, action: clearTelemetry },
        { title: 'Delete Account', desc: 'Permanently delete your account and all associated data', btn: 'Delete account', red: true, action: () => showErr('Contact support to delete your account') },
      ].map(({ title, desc, btn, red, action }) => (
        <div key={title} style={{ background: '#fff', border: '1px solid ' + (red ? '#fecaca' : '#e2e8f0'), borderRadius: 12, padding: '16px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{desc}</div>
          </div>
          <button onClick={action} disabled={saving} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid ' + (red ? '#fca5a5' : '#e2e8f0'), background: red ? '#fef2f2' : '#fff', color: red ? '#dc2626' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>{btn}</button>
        </div>
      ))}
    </div>
  )
}


function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const operatorId = getCookie('fl_operator_id') || ''
  const name = getCookie('fl_operator_name') || 'Admin'
  const role = getCookie('fl_role') || 'operator'
  const state = getCookie('fl_state') || 'Telangana'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2)
  const SB_URL = 'https://fpwvutdvwnvrunviporz.supabase.co'
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk'
  const sbHeaders = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }

  const navItems = [
    { group: 'Account', items: [{ key: 'profile', label: 'Profile', icon: '👤' }, { key: 'security', label: 'Security', icon: '🔒' }] },
    { group: 'Machines', items: [{ key: 'thresholds', label: 'Thresholds', icon: '🌡' }, { key: 'locations', label: 'Locations', icon: '📍' }] },
    { group: 'Alerts', items: [{ key: 'notifications', label: 'Notifications', icon: '🔔' }, { key: 'cooldowns', label: 'Cooldowns', icon: '⏱' }] },
    { group: 'System', items: [{ key: 'billing', label: 'Billing', icon: '💳' }, { key: 'danger', label: 'Danger Zone', icon: '⚠️' }] },
  ]

  const showSaved = () => { setSaved(true); setErrMsg(''); setTimeout(() => setSaved(false), 2500) }
  const showErr = (msg: string) => { setErrMsg(msg); setTimeout(() => setErrMsg(''), 4000) }

  const handleSave = () => { showSaved() }

  const saveProfile = async (formData: any) => {
    if (!operatorId) return showErr('Not logged in')
    setSaving(true)
    try {
      const body: any = { name: formData.name, state: formData.state, country: formData.country }
      const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, {
        method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        document.cookie = 'fl_operator_name=' + formData.name + '; path=/; max-age=86400'
        document.cookie = 'fl_state=' + formData.state + '; path=/; max-age=86400'
        showSaved()
      } else showErr('Failed to save profile')
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }

  const savePassword = async (current: string, newPass: string, confirm: string) => {
    if (newPass !== confirm) return showErr('Passwords do not match')
    if (newPass.length < 6) return showErr('Password must be at least 6 characters')
    setSaving(true)
    try {
      const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPass }) })
      const { hash } = await hashRes.json()
      const res = await fetch(SB_URL + '/rest/v1/operators?id=eq.' + operatorId, {
        method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ password_hash: hash })
      })
      if (res.ok) showSaved()
      else showErr('Failed to update password')
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }

  const saveLocations = async (machines: any[]) => {
    setSaving(true)
    try {
      await Promise.all(machines.map(m =>
        fetch(SB_URL + '/rest/v1/machines?id=eq.' + m.id, {
          method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ display_name: m.display_name, location: m.location })
        })
      ))
      showSaved()
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }

  const clearAlerts = async () => {
    if (!confirm('Delete ALL alert history? This cannot be undone.')) return
    setSaving(true)
    try {
      const res = await fetch(SB_URL + '/rest/v1/alerts?id=neq.00000000-0000-0000-0000-000000000000', {
        method: 'DELETE', headers: sbHeaders
      })
      if (res.ok) showSaved()
      else showErr('Failed to clear alerts')
    } catch(e: any) { showErr(e.message) } finally { setSaving(false) }
  }

  const sections: any = {
    profile: (
      <ProfileSection operatorId={operatorId} name={name} role={role} state={state} initials={initials} SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />
    ),
    security: (
      <SecuritySection operatorId={operatorId} SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />
    ),
    thresholds: (
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Alert Thresholds</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Configure when alerts are triggered for your machines</div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 0, background: '#f8fafc', padding: '10px 20px', borderBottom: '1px solid #e2e8f0' }}>
            {['Alert Type', 'Warn at', 'Stop at'].map(h => <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>)}
          </div>
          {[['🌡 Temperature High', '15°C', '20°C'], ['❄️ Temperature Low', '2°C', '0°C'], ['📦 Stock Low (per layer)', '20%', '0%'], ['⏰ Machine Offline After', '15 min', '—'], ['🚪 Door Open Alert', '—', 'Immediately']].map(([label, warn, stop]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 0, padding: '12px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: '#0f172a' }}>{label}</div>
              <input defaultValue={warn} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 80, outline: 'none' }} />
              <input defaultValue={stop} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 80, outline: 'none' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saved ? '✓ Saved!' : 'Save thresholds'}</button>
        </div>
      </div>
    ),
    locations: (
      <LocationsSection SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />
    ),
    notifications: (
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Notifications</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Choose which alerts you receive and via which channel</div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 16 }}>Notification Channels</div>
          {[['WhatsApp', 'Instant alerts via WhatsApp message', true], ['Telegram', 'Alerts via Telegram bot', true], ['Email Digest', 'Daily summary at 9am IST', false]].map(([ch, desc, on]: any) => (
            <div key={ch} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{ch}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? '#f97316' : '#e2e8f0', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 3, [on ? 'right' : 'left']: 3 }}></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 16 }}>Alert Types</div>
          {[['Machine Offline', 'CRITICAL', true], ['Temperature High/Stop', 'CRITICAL', true], ['Stock Empty', 'HIGH', true], ['Door Open', 'HIGH', true], ['Vend Failure', 'HIGH', true], ['Stock Low', 'MEDIUM', false], ['No Orders (4h)', 'MEDIUM', false]].map(([label, sev, on]: any) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 13, color: '#0f172a' }}>{label}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: sev === 'CRITICAL' ? '#fff1f2' : sev === 'HIGH' ? '#fff7ed' : '#fffbeb', color: sev === 'CRITICAL' ? '#dc2626' : sev === 'HIGH' ? '#ea580c' : '#d97706' }}>{sev}</span>
              </div>
              <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? '#f97316' : '#e2e8f0', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 3, [on ? 'right' : 'left']: 3 }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    cooldowns: (
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Alert Cooldowns</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>How long to wait before re-sending the same alert</div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', background: '#f8fafc', padding: '10px 20px', borderBottom: '1px solid #e2e8f0' }}>
            {['Alert Type', 'Cooldown', 'Notify'].map(h => <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>)}
          </div>
          {[['Machine Offline', '1h', true], ['Temperature High', '1h', true], ['Temperature Low', '2h', true], ['Temperature Stop', '1h', true], ['Stock Empty L1/L2/L3', '4h', true], ['Stock Low L1/L2/L3', '6h', false], ['Door Open', '1h', true], ['Vend Failure', '0.5h', true], ['Cup / Film Empty', '2h', true]].map(([label, cd, notify]: any) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '11px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: '#0f172a' }}>{label}</div>
              <input defaultValue={cd} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: 64, outline: 'none' }} />
              <div style={{ width: 36, height: 20, borderRadius: 10, background: notify ? '#f97316' : '#e2e8f0', position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 3, [notify ? 'right' : 'left']: 3 }}></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={handleSave} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saved ? '✓ Saved!' : 'Save cooldowns'}</button>
        </div>
      </div>
    ),
    billing: (
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Billing</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Your subscription and usage details</div>
        <div style={{ background: 'linear-gradient(135deg, #1a1f2e, #2d3748)', borderRadius: 16, padding: '24px', marginBottom: 20, color: '#fff' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Current Plan</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Starter</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>2 machines · Unlimited alerts · WhatsApp + Telegram</div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Machines</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>2 / 5</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Next billing</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>Jun 23</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Monthly</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>₹999</div>
            </div>
          </div>
        </div>
        <button style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Upgrade Plan</button>
      </div>
    ),
    danger: (
      <DangerSection SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} operatorId={operatorId} />
    ),
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '20px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Settings</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Fruitlink Dashboard</div>
        </div>
        {navItems.map(group => (
          <div key={group.group}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '12px 16px 4px', textTransform: 'uppercase', letterSpacing: 0.8 }}>{group.group}</div>
            {group.items.map(item => (
              <div key={item.key} onClick={() => setActiveSection(item.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: activeSection === item.key ? 700 : 400, color: activeSection === item.key ? '#f97316' : '#374151', background: activeSection === item.key ? '#fff7ed' : 'transparent', borderRight: activeSection === item.key ? '3px solid #f97316' : '3px solid transparent', transition: 'all 0.1s' }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        {sections[activeSection]}
      </div>
    </div>
  )
}


export default function Dashboard() {
  const [time, setTime] = useState('');
  const [machines, setMachines] = useState([]);
  const [selected, setSelected] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [telHistory, setTelHistory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [operatorName, setOperatorName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [chartRange, setChartRange] = useState('24h');
  const [activeKey, setActiveKey] = useState('console');
  const [expandedKeys, setExpandedKeys] = useState(['equipment']);
  const [collapsed, setCollapsed] = useState(false);

  const toggleExpand = (key) => setExpandedKeys(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }));
    tick(); const t = setInterval(tick, 1000);
    setOperatorName(getCookie('fl_operator_name') || 'Operator');
    setUserRole(getCookie('fl_role') || 'operator');
    return () => clearInterval(t);
  }, []);

  useEffect(() => { fetchMachines(); const interval = setInterval(fetchMachines, 30000); return () => clearInterval(interval); }, []);
  useEffect(() => { if (selected) { fetchDetail(selected); fetchHistory(selected, chartRange); } }, [selected]);
  useEffect(() => { if (selected) fetchHistory(selected, chartRange); }, [chartRange]);

  async function fetchMachines() {
    const operatorId = getCookie('fl_operator_id');
    const role = getCookie('fl_role') || 'operator';
    if (role === 'super_admin') {
      const { data } = await supabase.from('machines').select('*');
      if (data) { setMachines(data); if (data.length > 0 && !selected) { const online = data.find(m => m.status === 'online'); setSelected(online || data[0]); } }
    } else if (operatorId) {
      const { data: asgn } = await supabase.from('machine_operators').select('machine_id').eq('operator_id', operatorId);
      const ids = (asgn || []).map((a) => a.machine_id);
      if (ids.length === 0) { setMachines([]); return; }
      const { data } = await supabase.from('machines').select('*').in('id', ids);
      if (data) { setMachines(data); if (data.length > 0 && !selected) { const online = data.find(m => m.status === 'online'); setSelected(online || data[0]); } }
    } else {
      setMachines([]);
    }
  }

  async function fetchDetail(m) {
    const { data: tel } = await supabase.from('telemetry').select('*').eq('machine_id', m.id).order('ts', { ascending: false }).limit(1).single();
    if (tel) setTelemetry(tel);
    const today = new Date().toISOString().split('T')[0];
    const { data: tod } = await supabase.from('orders').select('*').eq('machine_id', m.id).gte('created_at', today);
    if (tod) { setTodayCount(tod.length); setTodayRevenue(tod.reduce((s, o) => s + (o.amount_paise || 0), 0) / 100); }
    const { data: rec } = await supabase.from('orders').select('*').eq('machine_id', m.id).order('created_at', { ascending: false }).limit(10);
    if (rec) setOrders(rec);
  }

  async function fetchHistory(m, range) {
    const hours = range === '6h' ? 6 : range === '12h' ? 12 : 24;
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const { data } = await supabase.from('telemetry').select('ts, inner_temp_c, stock_l1, stock_l2, stock_l3').eq('machine_id', m.id).gte('ts', since).order('ts', { ascending: true }).limit(200);
    if (data) setTelHistory(data);
  }

  function logout() { document.cookie = 'fl_auth=; max-age=0'; document.cookie = 'fl_operator_id=; max-age=0'; document.cookie = 'fl_operator_name=; max-age=0'; window.location.href = '/login'; }

  const getPageLabel = () => { const flat = NAV.flatMap(n => [n, ...(n.children || [])]); return flat.find(n => n.key === activeKey)?.label || 'Console'; };

  const renderPage = () => {
    if (activeKey === 'fleet') return <FleetMap machines={machines} />;
    if (activeKey === 'operators-list') return <OperatorsPage supabaseUrl='https://fpwvutdvwnvrunviporz.supabase.co' supabaseKey='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk' />
    if (activeKey === 'alerts') return <AlertsPage supabaseUrl='https://fpwvutdvwnvrunviporz.supabase.co' supabaseKey='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk' />
    if (activeKey === 'settings') return <SettingsPage />
    if (activeKey === 'settings_old') return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
        <div style={{ fontSize: 52, opacity: 0.2 }}>...</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#6b7280' }}>{getPageLabel()}</div>
        <div style={{ fontSize: 15, background: '#fff7ed', padding: '6px 16px', borderRadius: 20, color: '#f97316', fontWeight: 600 }}>Coming soon</div>
      </div>
    );

    if (activeKey === 'orders-list') return (
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 20px' }}>Orders List</h2>
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e8eaed', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ background: '#f8f9fb', borderBottom: '1.5px solid #e8eaed' }}>{['Order','Machine','Time','Amount','Status'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>)}</tr></thead>
            <tbody>
              {orders.length === 0 ? <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No orders yet</td></tr> : orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{o.order_code}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{selected?.display_name || selected?.sn || '--'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{o.created_at ? new Date(o.created_at).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>Rs {Math.round((o.amount_paise || 0) / 100)}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: o.pay_state === 1 ? '#dcfce7' : '#fef9c3', color: o.pay_state === 1 ? '#15803d' : '#a16207' }}>{o.pay_state === 1 ? 'Paid' : 'Pending'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
          {[{ label: 'Total Machines', value: machines.length, icon: '🍊' }, { label: 'Online Now', value: machines.filter(m => m.status === 'online').length, icon: '✅' }, { label: "Today's Orders", value: todayCount, icon: '📦' }, { label: 'Revenue Today', value: 'Rs ' + Math.round(todayRevenue), icon: '💰' }].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e8eaed', borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Machines</div>
        {machines.map(m => {
          const online = m.status === 'online';
          const isSel = selected && selected.id === m.id;
          return (
            <div key={m.id} onClick={() => { setSelected(m); setTelemetry(null); setTelHistory([]); setActiveKey('machines'); }} style={{ background: '#fff', border: '1.5px solid ' + (isSel ? '#f97316' : '#e8eaed'), borderRadius: 16, padding: '20px 24px', cursor: 'pointer', marginBottom: 14, boxShadow: isSel ? '0 0 0 3px #fed7aa' : '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{m.display_name || m.sn}</div>
                  <div style={{ fontSize: 14, color: '#6b7280' }}>{m.location || 'Hyderabad'} · SN: {m.sn}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, background: online ? '#dcfce7' : '#f3f4f6', color: online ? '#15803d' : '#6b7280' }}>{online ? '● Online' : '○ Offline'}</span>
              </div>
              <div style={{ display: 'flex', gap: 28 }}>
                {[{ label: 'Temperature', value: isSel && telemetry ? telemetry.inner_temp_c + 'C' : '--' }, { label: "Today's Orders", value: isSel ? todayCount : '--' }, { label: 'Revenue', value: isSel ? 'Rs ' + Math.round(todayRevenue) : '--' }].map(s => (
                  <div key={s.label}><div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div><div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{s.value}</div></div>
                ))}
              </div>
            </div>
          );
        })}
        {selected && activeKey === 'machines' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>{selected.display_name || selected.sn} - Detail</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1.5px solid #e8eaed' }}><div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Inner Temperature</div><div style={{ fontSize: 32, fontWeight: 800, color: '#111827' }}>{telemetry ? telemetry.inner_temp_c + 'C' : '--'}</div></div>
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1.5px solid #e8eaed' }}><div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>Last Seen</div><div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginTop: 4 }}>{selected.last_seen ? new Date(selected.last_seen).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) : '--'}</div></div>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1.5px solid #e8eaed', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Stock Levels</div>
              {[['L1', telemetry && telemetry.stock_l1], ['L2', telemetry && telemetry.stock_l2], ['L3', telemetry && telemetry.stock_l3]].map(item => (
                <div key={item[0]} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, color: '#6b7280', width: 24, fontWeight: 700 }}>{item[0]}</span>
                  <div style={{ flex: 1, height: 10, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 99, background: item[1] ? '#f97316' : '#ef4444', width: item[1] ? '80%' : '5%', transition: 'width 0.5s' }}></div></div>
                  <span style={{ fontSize: 13, color: item[1] ? '#16a34a' : '#dc2626', fontWeight: 700, width: 70, textAlign: 'right' }}>{item[1] ? 'Available' : 'Empty'}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1.5px solid #e8eaed', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Temperature History</div>
                <div style={{ display: 'flex', gap: 4 }}>{['6h','12h','24h'].map(r => <button key={r} onClick={() => setChartRange(r)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: chartRange === r ? '#f97316' : '#f3f4f6', color: chartRange === r ? '#fff' : '#6b7280' }}>{r}</button>)}</div>
              </div>
              <TempChart data={telHistory} />
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1.5px solid #e8eaed', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Stock History</div>
              <StockChart data={telHistory} />
            </div>
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e8eaed', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent Orders</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr style={{ background: '#f8f9fb' }}>{['Order','Time','Amount','Status'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.length === 0 ? <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No orders yet</td></tr> : orders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{o.order_code}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{o.created_at ? new Date(o.created_at).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>Rs {Math.round((o.amount_paise || 0) / 100)}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: o.pay_state === 1 ? '#dcfce7' : '#fef9c3', color: o.pay_state === 1 ? '#15803d' : '#a16207' }}>{o.pay_state === 1 ? 'Paid' : 'Pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8f9fb', fontFamily: "'DM Sans', system-ui, sans-serif", overflow: 'hidden' }}>
      <link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap' />
      <div style={{ width: collapsed ? 68 : 270, background: '#1a1f2e', borderRight: 'none', display: 'flex', flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', flexShrink: 0, boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: collapsed ? '16px 0' : '14px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, minHeight: 75 }}>
          <img src='/logo.png' alt='Fruitlink' style={{ height: collapsed ? 34 : 42, width: 'auto', flexShrink: 0, objectFit: 'contain' }} />
          {!collapsed && <div><div style={{ fontWeight: 900, fontSize: 17, letterSpacing: '0.05em', color: '#f97316', lineHeight: 1 }}>FRUITLINK</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>Technologies Pvt Ltd</div><div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} /><span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>Online</span></div></div>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {NAV.map(item => (
            <div key={item.key} style={{ marginBottom: 2 }}>
              <div onClick={() => { if (item.children) toggleExpand(item.key); else setActiveKey(item.key); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '11px 0' : '11px 12px', borderRadius: 10, cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', background: activeKey === item.key ? 'rgba(249,115,22,0.15)' : 'transparent', borderLeft: activeKey === item.key && !collapsed ? '3px solid #f97316' : '3px solid transparent', transition: 'all 0.15s' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <><span style={{ fontSize: 15, fontWeight: 600, flex: 1, color: activeKey === item.key ? '#f97316' : '#a0aec0' }}>{item.label}</span>{item.badge && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: '#fef9c3', color: '#a16207', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.badge}</span>}{item.children && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', transform: expandedKeys.includes(item.key) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>&#9654;</span>}</>}
              </div>
              {item.children && expandedKeys.includes(item.key) && !collapsed && (
                <div style={{ paddingLeft: 16, marginTop: 2, marginBottom: 4 }}>
                  {item.children.map(child => <div key={child.key} onClick={() => setActiveKey(child.key)} style={{ padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: activeKey === child.key ? '#f97316' : '#8892a4', background: activeKey === child.key ? 'rgba(249,115,22,0.15)' : 'transparent', borderLeft: '2px solid ' + (activeKey === child.key ? '#f97316' : 'rgba(255,255,255,0.1)'), marginBottom: 2, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12 }}>{child.icon}</span>{child.label}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 10 }}>
          {!collapsed && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(249,115,22,0.2)', border: '1.5px solid rgba(249,115,22,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#f97316', fontWeight: 800 }}>{operatorName.charAt(0).toUpperCase()}</div><div><div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>{operatorName}</div><div style={{ fontSize: 11, color: '#8892a4' }}>Fruitlink</div></div></div>}
          <button onClick={() => setCollapsed(v => !v)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#a0aec0', cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{collapsed ? '>' : '<'}</button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 64, background: '#fff', borderBottom: '1.5px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            <span style={{ color: '#9ca3af', fontWeight: 600 }}>FRUITLINK</span>
            <span style={{ color: '#d1d5db' }}>›</span>
            <span style={{ color: '#111827', fontWeight: 700 }}>{getPageLabel()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>{time}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#dcfce7', padding: '6px 14px', borderRadius: 20 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} /><span style={{ fontSize: 13, color: '#15803d', fontWeight: 700 }}>System Online</span></div>
            <button onClick={logout} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>{renderPage()}</div>
      </div>
    </div>
  );
}