'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SN = 'C3B31F38D1C07A76';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [time, setTime] = useState('');
  const [temp, setTemp] = useState<number | null>(null);
  const [status, setStatus] = useState('offline');
  const [lastSeen, setLastSeen] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-IN', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    const { data: machine } = await supabase
      .from('machines')
      .select('*')
      .eq('sn', SN)
      .single();

    if (machine) {
      setStatus(machine.status || 'offline');
      if (machine.last_seen) {
        const d = new Date(machine.last_seen);
        setLastSeen(d.toLocaleTimeString('en-IN', { hour12: false }));
      }
    }

    const { data: tel } = await supabase
      .from('telemetry')
      .select('*')
      .eq('machine_id', machine?.id)
      .order('ts', { ascending: false })
      .limit(1)
      .single();

    if (tel) {
      setTelemetry(tel);
      setTemp(tel.inner_temp_c);
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('machine_id', machine?.id)
      .gte('created_at', today);

    if (todayOrders) {
      setTodayCount(todayOrders.length);
      setTodayRevenue(todayOrders.reduce((sum, o) => sum + (o.amount_paise || 0), 0) / 100);
    }

    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('machine_id', machine?.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentOrders) setOrders(recentOrders);
  }

  const stocks = [
    ['L1', telemetry?.stock_l1 ? 80 : 0],
    ['L2', telemetry?.stock_l2 ? 80 : 0],
    ['L3', telemetry?.stock_l3 ? 80 : 0],
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-amber-600 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <div className="text-xs opacity-80">SN: {SN}</div>
          <div className="text-xs opacity-70">Fruitful-2 · Hyderabad</div>
        </div>
        <div className="flex gap-6 items-center text-sm">
          <span className="font-semibold">{temp !== null ? ${temp}°C : '--'}</span>
          <span className="text-xs">{time}</span>
          <span className="text-xs opacity-80">v2.5.4</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Machine status</div>
            <span className={inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${status === 'online' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}}>
              <span className={w-2 h-2 rounded-full inline-block ${status === 'online' ? 'bg-green-500' : 'bg-red-500'}}></span>
              {status === 'online' ? 'Online' : 'Offline'}
            </span>
            <div className="text-xs text-gray-400 mt-2">Last seen: {lastSeen || '--'}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Inner temperature</div>
            <div className="text-2xl font-medium">{temp !== null ? temp + '°C' : '--'}</div>
            <div className="text-xs text-gray-400 mt-1">Threshold: &lt;20°C {temp !== null && temp < 20 ? '✓' : '⚠️'}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Today orders</div>
            <div className="text-2xl font-medium">{todayCount}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Revenue today</div>
            <div className="text-2xl font-medium">₹{todayRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Avg weight</div>
            <div className="text-2xl font-medium">242g</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase mb-3">Stock levels</div>
          {stocks.map(([label, pct]) => (
            <div key={String(label)} className="flex items-center gap-3 mb-2">
              <span className="text-xs text-gray-500 w-6">{label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: pct + '%' }}></div>
              </div>
              <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase mb-3">Recent orders</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-2">Order</th>
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Amount</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400">No orders yet</td></tr>
              ) : orders.map(o => (
                <tr key={o.id} className="border-b border-gray-50">
                  <td className="py-2">#{o.order_code}</td>
                  <td className="py-2">{o.created_at ? new Date(o.created_at).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                  <td className="py-2">₹{(o.amount_paise / 100).toFixed(0)}</td>
                  <td className="py-2">
                    <span className={o.pay_state === 1 ? 'bg-green-100 text-green-700 px-2 py-0.5 rounded-full' : 'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full'}>
                      {o.pay_state === 1 ? 'paid' : 'pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}