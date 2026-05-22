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
  CRITICAL: '#dc2626', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}
const SEVERITY_BG: Record<string, string> = {
  CRITICAL: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#fefce8', LOW: '#f0fdf4',
}

function AlertsPage({ supabaseUrl, supabaseKey }: { supabaseUrl: string; supabaseKey: string }) {
  const [alerts, setAlerts] = React.useState<any[]>([])
  const [machines, setMachines] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<'all'|'active'|'resolved'>('active')
  const [severityFilter, setSeverityFilter] = React.useState('all')

  const fetchAlerts = async () => {
    const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey }
    const [alertRes, machineRes] = await Promise.all([
      fetch(supabaseUrl + '/rest/v1/alerts?select=*&order=created_at.desc&limit=200', { headers }),
      fetch(supabaseUrl + '/rest/v1/machines?select=id,display_name,sn', { headers }),
    ])
    const [alertData, machineData] = await Promise.all([alertRes.json(), machineRes.json()])
    setAlerts(Array.isArray(alertData) ? alertData : [])
    setMachines(Array.isArray(machineData) ? machineData : [])
    setLoading(false)
  }

  React.useEffect(() => { fetchAlerts() }, [])

  const getMachineName = (id: string) => machines.find(m => m.id === id)?.display_name || id.slice(0,8)

  const filtered = alerts.filter(a => {
    if (filter === 'active' && a.resolved_at) return false
    if (filter === 'resolved' && !a.resolved_at) return false
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false
    return true
  })

  const counts = {
    all: alerts.length,
    active: alerts.filter(a => !a.resolved_at).length,
    resolved: alerts.filter(a => a.resolved_at).length,
    CRITICAL: alerts.filter(a => !a.resolved_at && a.severity === 'CRITICAL').length,
    HIGH: alerts.filter(a => !a.resolved_at && a.severity === 'HIGH').length,
    MEDIUM: alerts.filter(a => !a.resolved_at && a.severity === 'MEDIUM').length,
  }

  const fmtTime = (t: string) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Loading alerts...</div>

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1f2e' }}>Alerts</h2>
          <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{counts.active} active alerts</div>
        </div>
        <button onClick={fetchAlerts} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>↻ Refresh</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {(['CRITICAL','HIGH','MEDIUM'] as const).map(s => (
          <div key={s} style={{ background: SEVERITY_BG[s], border: '1px solid ' + SEVERITY_COLOR[s] + '33', borderRadius: 10, padding: '14px 18px', cursor: 'pointer', borderLeft: '4px solid ' + SEVERITY_COLOR[s] }}
            onClick={() => setSeverityFilter(severityFilter === s ? 'all' : s)}>
            <div style={{ fontSize: 24, fontWeight: 800, color: SEVERITY_COLOR[s] }}>{counts[s]}</div>
            <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginTop: 2 }}>{s} (Active)</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['active','resolved','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #e5e7eb', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              background: filter === f ? '#1a1f2e' : '#fff', color: filter === f ? '#fff' : '#555' }}>
            {f === 'active' ? `Active (${counts.active})` : f === 'resolved' ? `Resolved (${counts.resolved})` : `All (${counts.all})`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {severityFilter !== 'all' && (
          <button onClick={() => setSeverityFilter('all')}
            style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid ' + SEVERITY_COLOR[severityFilter], background: SEVERITY_BG[severityFilter], color: SEVERITY_COLOR[severityFilter], fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {severityFilter} ✕
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', fontSize: 15 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
          No alerts found
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Severity','Machine','Alert','Message','Time','Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: SEVERITY_BG[a.severity] || '#f3f4f6', color: SEVERITY_COLOR[a.severity] || '#666', padding: '3px 10px', borderRadius: 12, fontWeight: 700, fontSize: 11 }}>
                      {a.severity}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1f2e' }}>{getMachineName(a.machine_id)}</td>
                  <td style={{ padding: '10px 14px', color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>{a.alert_type}</td>
                  <td style={{ padding: '10px 14px', color: '#555', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</td>
                  <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap' }}>{fmtTime(a.created_at)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {a.resolved_at
                      ? <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}>✓ Resolved</span>
                      : <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 12 }}>● Active</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


