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
  { label: 'Marketing', icon: '◳', key: 'marketing', children: [{ label: 'Ad Campaigns', key: 'ads', icon: '▦' }, { label: 'Machine Screens', key: 'screens', icon: '▧' }] },
  { label: 'Operator Management', icon: '⊕', key: 'operators', children: [{ label: 'Operators', key: 'operators-list', icon: '▥' }] },
  { label: 'Settings', icon: '⊗', key: 'settings' },
];

const AD_MEDIA_BUCKET = 'ad-media';

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
  const [chartRange, setChartRange] = useState('24h');
  const [activeKey, setActiveKey] = useState('console');
  const [expandedKeys, setExpandedKeys] = useState(['equipment', 'marketing']);
  const [collapsed, setCollapsed] = useState(false);
  // ── Marketing / ads state ──
  const [campaigns, setCampaigns] = useState([]);
  const [adForm, setAdForm] = useState<{ name: string; advertiser: string; duration_s: any; machine_sns: string[] }>({ name: '', advertiser: '', duration_s: 15, machine_sns: [] });
  const [adFile, setAdFile] = useState<any>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [adMsg, setAdMsg] = useState('');
  // ── Machine screens state ──
  const [screenMachine, setScreenMachine] = useState(null);
  const [screenBusy, setScreenBusy] = useState('');
  const [screenMsg, setScreenMsg] = useState('');

  const toggleExpand = (key) => setExpandedKeys(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }));
    tick(); const t = setInterval(tick, 1000);
    setOperatorName(getCookie('fl_operator_name') || 'Operator');
    return () => clearInterval(t);
  }, []);

  useEffect(() => { fetchMachines(); const interval = setInterval(fetchMachines, 30000); return () => clearInterval(interval); }, []);
  useEffect(() => { if (selected) { fetchDetail(selected); fetchHistory(selected, chartRange); } }, [selected]);
  useEffect(() => { if (selected) fetchHistory(selected, chartRange); }, [chartRange]);
  useEffect(() => { if (activeKey === 'ads') fetchCampaigns(); }, [activeKey]);
  useEffect(() => { if (activeKey === 'screens' && !screenMachine && machines.length > 0) setScreenMachine(machines[0]); }, [activeKey, machines]);

  async function fetchMachines() {
    const operatorId = getCookie('fl_operator_id');
    let query = supabase.from('machines').select('*');
    if (operatorId) query = query.eq('operator_id', operatorId);
    const { data } = await query;
    if (data) { setMachines(data); if (!selected && data.length > 0) { const online = data.find(m => m.status === 'online'); setSelected(online || data[0]); } }
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

  // ── MARKETING: campaigns ────────────────────────────────────────────────
  async function fetchCampaigns() {
    const operatorId = getCookie('fl_operator_id');
    let query = supabase.from('ad_campaign').select('*').order('created_at', { ascending: false });
    if (operatorId) query = query.eq('operator_id', operatorId);
    const { data } = await query;
    if (data) setCampaigns(data);
  }

  // Upload a file to ad-media under an operator-scoped path, return public URL.
  async function uploadMedia(file) {
    const operatorId = getCookie('fl_operator_id') || 'unknown';
    const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = operatorId + '/' + Date.now() + '_' + clean;
    const { error } = await supabase.storage.from(AD_MEDIA_BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(AD_MEDIA_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, name: clean };
  }

  async function createCampaign() {
    setAdMsg('');
    if (!adForm.name || !adForm.advertiser) { setAdMsg('Name and advertiser are required.'); return; }
    if (!adFile) { setAdMsg('Please choose an image to upload.'); return; }
    if (adForm.machine_sns.length === 0) { setAdMsg('Select at least one machine.'); return; }
    setAdBusy(true);
    try {
      const { url, name } = await uploadMedia(adFile);
      const operatorId = getCookie('fl_operator_id');
      const isSuper = getCookie('fl_role') === 'super_admin';
      const row = {
        name: adForm.name,
        advertiser: adForm.advertiser,
        is_own: true,
        media_type: 'image',
        media_url: url,
        media_name: name,
        duration_s: Number(adForm.duration_s) || 15,
        screen: 'idle',
        machine_sns: adForm.machine_sns,
        days: [0, 1, 2, 3, 4, 5, 6],
        start_hour: 0,
        end_hour: 24,
        weight: 1,
        status: 'active',
        approval: isSuper ? 'approved' : 'approved', // own-brand auto-approves
        operator_id: operatorId,
      };
      const { error } = await supabase.from('ad_campaign').insert(row);
      if (error) throw error;
      setAdMsg('Campaign created and live.');
      setAdForm({ name: '', advertiser: '', duration_s: 15, machine_sns: [] });
      setAdFile(null);
      fetchCampaigns();
    } catch (e) {
      setAdMsg('Error: ' + (e?.message || 'upload/insert failed'));
    } finally {
      setAdBusy(false);
    }
  }

  async function toggleCampaign(c) {
    const next = c.status === 'active' ? 'paused' : 'active';
    await supabase.from('ad_campaign').update({ status: next }).eq('id', c.id);
    fetchCampaigns();
  }

  // ── MARKETING: per-machine screen config (tiles + poster) ───────────────
  async function uploadScreenImage(file, slot) {
    if (!screenMachine) { setScreenMsg('Select a machine first.'); return; }
    setScreenBusy(slot); setScreenMsg('');
    try {
      const { url } = await uploadMedia(file);
      // Read current state, merge screen_config, write back (preserve machine_config).
      const { data: m } = await supabase.from('machines').select('state').eq('id', screenMachine.id).single();
      let state: any = {};
      try { state = m?.state ? JSON.parse(m.state) : {}; } catch { state = {}; }
      const sc = state.screen_config || {};
      if (slot === 'left') sc.bottom_left_url = url;
      if (slot === 'right') sc.bottom_right_url = url;
      state.screen_config = sc;
      await supabase.from('machines').update({ state: JSON.stringify(state) }).eq('id', screenMachine.id);
      setScreenMsg('Updated ' + slot + ' tile. Machine picks it up on next sync.');
    } catch (e) {
      setScreenMsg('Error: ' + (e?.message || 'failed'));
    } finally {
      setScreenBusy('');
    }
  }

  async function uploadPosterCampaign(file) {
    if (!screenMachine) { setScreenMsg('Select a machine first.'); return; }
    setScreenBusy('poster'); setScreenMsg('');
    try {
      const { url, name } = await uploadMedia(file);
      const operatorId = getCookie('fl_operator_id');
      const row = {
        name: (screenMachine.display_name || screenMachine.sn) + ' Poster',
        advertiser: getCookie('fl_operator_name') || 'Operator',
        is_own: true, media_type: 'image', media_url: url, media_name: name,
        duration_s: 15, screen: 'idle', machine_sns: [screenMachine.sn],
        days: [0,1,2,3,4,5,6], start_hour: 0, end_hour: 24, weight: 1,
        status: 'active', approval: 'approved', operator_id: operatorId,
      };
      const { error } = await supabase.from('ad_campaign').insert(row);
      if (error) throw error;
      setScreenMsg('Top poster set (as a campaign). Machine picks it up on next playlist refresh.');
    } catch (e) {
      setScreenMsg('Error: ' + (e?.message || 'failed'));
    } finally {
      setScreenBusy('');
    }
  }

  const getPageLabel = () => { const flat = NAV.flatMap(n => [n, ...(n.children || [])]); return flat.find(n => n.key === activeKey)?.label || 'Console'; };

  const renderPage = () => {
    if (activeKey === 'fleet') return <FleetMap machines={machines} />;

    if (activeKey === 'ads') {
      const lbl = { fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6 };
      const inp = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e8eaed', fontSize: 14, fontFamily: 'inherit' };
      return (
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>Ad Campaigns</h2>
          <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 24px' }}>Upload an image and run it on your machines. Plays in the top ad zone of the idle screen.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', border: '1.5px solid #e8eaed' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Create Campaign</div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>Campaign name</label><input style={inp} value={adForm.name} onChange={e => setAdForm({ ...adForm, name: e.target.value })} placeholder='e.g. Summer Promo' /></div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>Advertiser</label><input style={inp} value={adForm.advertiser} onChange={e => setAdForm({ ...adForm, advertiser: e.target.value })} placeholder='e.g. Fruitlinq' /></div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>Duration (seconds)</label><input type='number' style={inp} value={adForm.duration_s} onChange={e => setAdForm({ ...adForm, duration_s: e.target.value })} /></div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>Machines</label>
                {machines.map(m => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14, cursor: 'pointer' }}>
                    <input type='checkbox' checked={adForm.machine_sns.includes(m.sn)} onChange={e => { const s = e.target.checked ? [...adForm.machine_sns, m.sn] : adForm.machine_sns.filter(x => x !== m.sn); setAdForm({ ...adForm, machine_sns: s }); }} />
                    {m.display_name || m.sn}
                  </label>
                ))}
              </div>
              <div style={{ marginBottom: 16 }}><label style={lbl}>Image</label><input type='file' accept='image/*' onChange={e => setAdFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />{adFile && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 6 }}>{adFile.name}</div>}</div>
              <button disabled={adBusy} onClick={createCampaign} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: adBusy ? '#fcd9b6' : '#f97316', color: '#fff', fontSize: 15, fontWeight: 700, cursor: adBusy ? 'default' : 'pointer' }}>{adBusy ? 'Uploading…' : 'Create Campaign'}</button>
              {adMsg && <div style={{ marginTop: 12, fontSize: 13, color: adMsg.startsWith('Error') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{adMsg}</div>}
            </div>
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e8eaed', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Campaigns</div>
              {campaigns.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>No campaigns yet</div> : (
                <div>{campaigns.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f9fafb' }}>
                    {c.media_url ? <img src={c.media_url} alt='' style={{ width: 54, height: 54, borderRadius: 10, objectFit: 'cover', border: '1px solid #e8eaed' }} /> : <div style={{ width: 54, height: 54, borderRadius: 10, background: '#f3f4f6' }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{c.advertiser} · {c.duration_s}s · {(c.machine_sns || []).length} machine(s)</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.status === 'active' ? '#dcfce7' : '#f3f4f6', color: c.status === 'active' ? '#15803d' : '#6b7280' }}>{c.status}</span>
                    <button onClick={() => toggleCampaign(c)} style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e8eaed', background: '#fff', cursor: 'pointer', color: '#374151' }}>{c.status === 'active' ? 'Pause' : 'Activate'}</button>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeKey === 'screens') {
      const card = { background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1.5px solid #e8eaed' };
      return (
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>Machine Screens</h2>
          <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 24px' }}>Set the bottom signage tiles and top poster for each machine. Updates apply on the machine&apos;s next sync.</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {machines.map(m => (
              <button key={m.id} onClick={() => { setScreenMachine(m); setScreenMsg(''); }} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid ' + (screenMachine?.id === m.id ? '#f97316' : '#e8eaed'), background: screenMachine?.id === m.id ? '#fff7ed' : '#fff', color: screenMachine?.id === m.id ? '#f97316' : '#374151', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{m.display_name || m.sn}</button>
            ))}
          </div>
          {screenMachine && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Bottom-Left Tile</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Juice / brand image (60% width)</div>
                <input type='file' accept='image/*' disabled={screenBusy === 'left'} onChange={e => e.target.files?.[0] && uploadScreenImage(e.target.files[0], 'left')} style={{ fontSize: 13 }} />
                {screenBusy === 'left' && <div style={{ fontSize: 12, color: '#f97316', marginTop: 8 }}>Uploading…</div>}
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Bottom-Right Tile</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>UPI / payment image (40% width)</div>
                <input type='file' accept='image/*' disabled={screenBusy === 'right'} onChange={e => e.target.files?.[0] && uploadScreenImage(e.target.files[0], 'right')} style={{ fontSize: 13 }} />
                {screenBusy === 'right' && <div style={{ fontSize: 12, color: '#f97316', marginTop: 8 }}>Uploading…</div>}
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Top Poster</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Main ad zone (top 80%)</div>
                <input type='file' accept='image/*' disabled={screenBusy === 'poster'} onChange={e => e.target.files?.[0] && uploadPosterCampaign(e.target.files[0])} style={{ fontSize: 13 }} />
                {screenBusy === 'poster' && <div style={{ fontSize: 12, color: '#f97316', marginTop: 8 }}>Uploading…</div>}
              </div>
            </div>
          )}
          {screenMsg && <div style={{ marginTop: 16, fontSize: 14, color: screenMsg.startsWith('Error') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{screenMsg}</div>}
        </div>
      );
    }

    if (activeKey === 'alerts' || activeKey === 'operators-list' || activeKey === 'settings') return (
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
      <div style={{ width: collapsed ? 68 : 270, background: '#fff', borderRight: '1.5px solid #e8eaed', display: 'flex', flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', flexShrink: 0, boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: collapsed ? '16px 0' : '14px 14px', borderBottom: '1.5px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, minHeight: 75 }}>
          <img src='/logo.png' alt='Fruitlink' style={{ height: collapsed ? 34 : 42, width: 'auto', flexShrink: 0, objectFit: 'contain' }} />
          {!collapsed && <div><div style={{ fontWeight: 900, fontSize: 17, letterSpacing: '0.05em', color: '#f97316', lineHeight: 1 }}>FRUITLINK</div><div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>Technologies Pvt Ltd</div><div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} /><span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Online</span></div></div>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {NAV.map(item => (
            <div key={item.key} style={{ marginBottom: 2 }}>
              <div onClick={() => { if (item.children) toggleExpand(item.key); else setActiveKey(item.key); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '11px 0' : '11px 12px', borderRadius: 10, cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', background: activeKey === item.key ? '#fff7ed' : 'transparent', borderLeft: activeKey === item.key && !collapsed ? '3px solid #f97316' : '3px solid transparent', transition: 'all 0.15s' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <><span style={{ fontSize: 15, fontWeight: 600, flex: 1, color: activeKey === item.key ? '#f97316' : '#374151' }}>{item.label}</span>{item.badge && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: '#fef9c3', color: '#a16207', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.badge}</span>}{item.children && <span style={{ fontSize: 10, color: '#9ca3af', transform: expandedKeys.includes(item.key) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>&#9654;</span>}</>}
              </div>
              {item.children && expandedKeys.includes(item.key) && !collapsed && (
                <div style={{ paddingLeft: 16, marginTop: 2, marginBottom: 4 }}>
                  {item.children.map(child => <div key={child.key} onClick={() => setActiveKey(child.key)} style={{ padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: activeKey === child.key ? '#f97316' : '#6b7280', background: activeKey === child.key ? '#fff7ed' : 'transparent', borderLeft: '2px solid ' + (activeKey === child.key ? '#f97316' : '#e8eaed'), marginBottom: 2, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12 }}>{child.icon}</span>{child.label}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1.5px solid #e8eaed', padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 10 }}>
          {!collapsed && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: 10, background: '#fff7ed', border: '1.5px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#f97316', fontWeight: 800 }}>{operatorName.charAt(0).toUpperCase()}</div><div><div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{operatorName}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>Fruitlink</div></div></div>}
          <button onClick={() => setCollapsed(v => !v)} style={{ background: '#f8f9fb', border: '1px solid #e8eaed', borderRadius: 8, color: '#6b7280', cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{collapsed ? '>' : '<'}</button>
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
