'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

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
  const pts = data.filter(d => d.inner_temp_c !== null).map((d, i, arr) => {
    const x = pad.l + (i / (arr.length - 1)) * iW;
    const y = pad.t + iH - ((d.inner_temp_c - mn) / range) * iH;
    return x + ',' + y;
  }).join(' ');
  const ticks = [mn, Math.round((mn + mx) / 2), mx];
  const filtered = data.filter(d => d.inner_temp_c !== null);
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} className='w-full' style={{height:120}}>
      {ticks.map((t, i) => {
        const y = pad.t + iH - ((t - mn) / range) * iH;
        return <g key={i}><line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke='#f3f4f6' strokeWidth='1'/><text x={pad.l - 4} y={y + 4} textAnchor='end' fontSize='9' fill='#9ca3af'>{t}C</text></g>;
      })}
      <polyline points={pts} fill='none' stroke='#f59e0b' strokeWidth='2' strokeLinejoin='round'/>
      {filtered.filter((_, i) => i % Math.max(1, Math.ceil(filtered.length / 6)) === 0).map((d, i) => {
        const idx = filtered.indexOf(d);
        const x = pad.l + (idx / (filtered.length - 1)) * iW;
        const label = new Date(d.ts).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
        return <text key={i} x={x} y={H - 4} textAnchor='middle' fontSize='9' fill='#9ca3af'>{label}</text>;
      })}
    </svg>
  );
}

function StockChart({ data }) {
  if (!data || data.length < 2) return <div className='text-xs text-gray-400 text-center py-4'>No data yet</div>;
  const W = 600; const H = 80; const pad = { t:8, r:10, b:24, l:10 };
  const iW = W - pad.l - pad.r; const iH = H - pad.t - pad.b;
  const levels = [
    { key: 'stock_l1', color: '#f59e0b', label: 'L1' },
    { key: 'stock_l2', color: '#10b981', label: 'L2' },
    { key: 'stock_l3', color: '#3b82f6', label: 'L3' },
  ];
  return (
    <div>
      <svg viewBox={'0 0 ' + W + ' ' + H} className='w-full' style={{height:80}}>
        {levels.map(lv => {
          const pts = data.map((d, i) => {
            const x = pad.l + (i / (data.length - 1)) * iW;
            const y = pad.t + (d[lv.key] ? 2 : iH);
            return x + ',' + y;
          }).join(' ');
          return <polyline key={lv.key} points={pts} fill='none' stroke={lv.color} strokeWidth='2' strokeLinejoin='round' opacity='0.8'/>;
        })}
        {data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 6)) === 0).map((d, i) => {
          const idx = data.indexOf(d);
          const x = pad.l + (idx / (data.length - 1)) * iW;
          const label = new Date(d.ts).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
          return <text key={i} x={x} y={H - 2} textAnchor='middle' fontSize='9' fill='#9ca3af'>{label}</text>;
        })}
      </svg>
      <div className='flex gap-4 mt-1'>
        {levels.map(lv => <div key={lv.key} className='flex items-center gap-1'><div style={{width:8,height:8,borderRadius:2,background:lv.color}}></div><span className='text-xs text-gray-400'>{lv.label}</span></div>)}
      </div>
    </div>
  );
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
  const [chartRange, setChartRange] = useState('24h');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }));
    tick();
    const t = setInterval(tick, 1000);
    setOperatorName(getCookie('fl_operator_name') || 'Operator');
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchMachines();
    const interval = setInterval(fetchMachines, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (selected) { fetchDetail(selected); fetchHistory(selected, chartRange); } }, [selected]);
  useEffect(() => { if (selected) fetchHistory(selected, chartRange); }, [chartRange]);

  async function fetchMachines() {
    const operatorId = getCookie('fl_operator_id');
    let query = supabase.from('machines').select('*');
    if (operatorId) query = query.eq('operator_id', operatorId);
    const { data } = await query;
    if (data) {
      setMachines(data);
      if (!selected && data.length > 0) {
        const online = data.find(m => m.status === 'online');
        setSelected(online || data[0]);
      }
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

  function isOnline(m) { return m.status === 'online'; }

  function logout() { document.cookie = 'fl_auth=; max-age=0'; document.cookie = 'fl_operator_id=; max-age=0'; document.cookie = 'fl_operator_name=; max-age=0'; window.location.href = '/login'; }

  return (
    <div className='min-h-screen bg-gray-100'>
      <div className='bg-amber-600 text-white px-4 py-3 flex justify-between items-center'>
        <div>
          <div className='font-semibold text-lg'>Fruitlink</div>
          <div className='text-xs opacity-70'>{operatorName}</div>
        </div>
        <div className='flex gap-6 items-center'>
          <span className='text-xs'>{time}</span>
          <a href='/orders' className='text-xs opacity-80 hover:opacity-100'>Orders</a>
          <button onClick={logout} className='text-xs opacity-80 hover:opacity-100'>Logout</button>
        </div>
      </div>
      <div className='max-w-5xl mx-auto p-4'>
        <div className='text-xs font-medium text-gray-500 uppercase mb-3'>Machines</div>
        <div className='grid grid-cols-1 gap-3 mb-6'>
          {machines.map(m => {
            const online = isOnline(m);
            const isSel = selected && selected.id === m.id;
            return (
              <div key={m.id} onClick={() => { setSelected(m); setTelemetry(null); setTelHistory([]); }} className={'bg-white rounded-xl p-4 border cursor-pointer ' + (isSel ? 'border-amber-500' : 'border-gray-200')}>
                <div className='flex justify-between items-start'>
                  <div>
                    <div className='font-medium text-sm'>{m.display_name || m.sn}</div>
                    <div className='text-xs text-gray-400'>{m.location || '--'} - SN: {m.sn}</div>
                  </div>
                  <span className={'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ' + (online ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100')}>
                    <span className={'w-1.5 h-1.5 rounded-full inline-block ' + (online ? 'bg-green-500' : 'bg-red-500')}></span>
                    {online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className='grid grid-cols-3 gap-3 mt-3'>
                  <div><div className='text-xs text-gray-400'>Temperature</div><div className='text-sm font-medium'>{isSel && telemetry ? telemetry.inner_temp_c + 'C' : '--'}</div></div>
                  <div><div className='text-xs text-gray-400'>Today orders</div><div className='text-sm font-medium'>{isSel ? todayCount : '--'}</div></div>
                  <div><div className='text-xs text-gray-400'>Revenue</div><div className='text-sm font-medium'>Rs {isSel ? todayRevenue : '--'}</div></div>
                </div>
              </div>
            );
          })}
        </div>
        {selected && (
          <div>
            <div className='text-xs font-medium text-gray-500 uppercase mb-3'>{selected.display_name || selected.sn} - Detail</div>
            <div className='grid grid-cols-2 gap-3 mb-3'>
              <div className='bg-white rounded-xl p-4 border border-gray-200'>
                <div className='text-xs text-gray-500 mb-1'>Inner temperature</div>
                <div className='text-2xl font-medium'>{telemetry ? telemetry.inner_temp_c + 'C' : '--'}</div>
              </div>
              <div className='bg-white rounded-xl p-4 border border-gray-200'>
                <div className='text-xs text-gray-500 mb-1'>Last seen</div>
                <div className='text-sm font-medium mt-2'>{selected.last_seen ? new Date(selected.last_seen).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) : '--'}</div>
              </div>
            </div>
            <div className='bg-white rounded-xl p-4 border border-gray-200 mb-3'>
              <div className='text-xs font-medium text-gray-500 uppercase mb-3'>Stock levels</div>
              {[['L1', telemetry && telemetry.stock_l1], ['L2', telemetry && telemetry.stock_l2], ['L3', telemetry && telemetry.stock_l3]].map(function(item) {
                return (
                  <div key={item[0]} className='flex items-center gap-3 mb-2'>
                    <span className='text-xs text-gray-500 w-6'>{item[0]}</span>
                    <div className='flex-1 h-2 bg-gray-100 rounded-full overflow-hidden'>
                      <div className='h-full rounded-full bg-amber-500' style={{ width: item[1] ? '80%' : '0%' }}></div>
                    </div>
                    <span className='text-xs text-gray-400 w-16 text-right'>{item[1] ? 'Available' : 'Empty'}</span>
                  </div>
                );
              })}
            </div>
            <div className='bg-white rounded-xl p-4 border border-gray-200 mb-3'>
              <div className='flex justify-between items-center mb-3'>
                <div className='text-xs font-medium text-gray-500 uppercase'>Temperature History</div>
                <div className='flex gap-1'>
                  {['6h','12h','24h'].map(r => (
                    <button key={r} onClick={() => setChartRange(r)} className={'text-xs px-2 py-0.5 rounded ' + (chartRange === r ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500')}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <TempChart data={telHistory} />
            </div>
            <div className='bg-white rounded-xl p-4 border border-gray-200 mb-3'>
              <div className='text-xs font-medium text-gray-500 uppercase mb-3'>Stock History</div>
              <StockChart data={telHistory} />
            </div>
            <div className='bg-white rounded-xl p-4 border border-gray-200'>
              <div className='text-xs font-medium text-gray-500 uppercase mb-3'>Recent orders</div>
              <table className='w-full text-xs'>
                <thead><tr className='text-gray-400 border-b border-gray-100'>
                  <th className='text-left py-2'>Order</th>
                  <th className='text-left py-2'>Time</th>
                  <th className='text-left py-2'>Amount</th>
                  <th className='text-left py-2'>Status</th>
                </tr></thead>
                <tbody>
                  {orders.length === 0 ? (<tr><td colSpan={4} className='py-4 text-center text-gray-400'>No orders yet</td></tr>) : orders.map(o => (
                    <tr key={o.id} className='border-b border-gray-50'>
                      <td className='py-2'>#{o.order_code}</td>
                      <td className='py-2'>{o.created_at ? new Date(o.created_at).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                      <td className='py-2'>Rs {Math.round((o.amount_paise || 0) / 100)}</td>
                      <td className='py-2'><span className={o.pay_state === 1 ? 'bg-green-100 text-green-700 px-2 py-0.5 rounded-full' : 'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full'}>{o.pay_state === 1 ? 'paid' : 'pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}