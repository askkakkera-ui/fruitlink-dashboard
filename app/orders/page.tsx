'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('today');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { fetchOrders(); }, [filter, status]);

  async function fetchOrders() {
    setLoading(true);
    const { data: machine } = await supabase.from('machines').select('id').eq('sn', 'C3B31F38D1C07A76').single();
    if (!machine) { setLoading(false); return; }

    let from = new Date();
    if (filter === 'today') { from.setHours(0, 0, 0, 0); }
    else if (filter === 'week') { from.setDate(from.getDate() - 7); }
    else if (filter === 'month') { from.setMonth(from.getMonth() - 1); }

    let query = supabase.from('orders').select('*').eq('machine_id', machine.id).gte('created_at', from.toISOString()).order('created_at', { ascending: false });

    if (status === 'paid') query = query.eq('pay_state', 1);
    if (status === 'pending') query = query.eq('pay_state', 0);

    const { data } = await query;
    if (data) {
      setOrders(data);
      setTotalCount(data.length);
      setTotalRevenue(data.reduce((s, o) => s + (o.amount_paise || 0), 0) / 100);
    }
    setLoading(false);
  }

  function exportCSV() {
    const headers = 'Order Code,Date,Time,Amount,Pay Type,Status';
    const rows = orders.map(o => {
      const d = new Date(o.created_at);
      return o.order_code + ',' + d.toLocaleDateString('en-IN') + ',' + d.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) + ',Rs ' + Math.round((o.amount_paise || 0) / 100) + ',' + o.pay_type + ',' + (o.pay_state === 1 ? 'paid' : 'pending');
    });
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders-' + filter + '.csv';
    a.click();
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-amber-600 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <div className="font-semibold text-lg">Fruitlink</div>
          <div className="text-xs opacity-70">Order Management</div>
        </div>
        <div className="flex gap-4 items-center">
          <a href="/" className="text-xs opacity-80 hover:opacity-100">Dashboard</a>
          <button onClick={() => { document.cookie = 'fl_auth=; max-age=0'; window.location.href = '/login'; }} className="text-xs opacity-80 hover:opacity-100">Logout</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            {['today', 'week', 'month'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={'px-3 py-1 rounded-full text-xs font-medium border ' + (filter === f ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-500 border-gray-200')}>
                {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {['all', 'paid', 'pending'].map(s => (
              <button key={s} onClick={() => setStatus(s)} className={'px-3 py-1 rounded-full text-xs font-medium border ' + (status === s ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200')}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Total orders</div>
            <div className="text-2xl font-medium">{totalCount}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Total revenue</div>
            <div className="text-2xl font-medium">Rs {totalRevenue}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Avg per order</div>
            <div className="text-2xl font-medium">Rs {totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs font-medium text-gray-500 uppercase">Orders</div>
            <button onClick={exportCSV} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-600">Export CSV</button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left py-2">Order code</th>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Pay type</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">No orders found</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-50">
                    <td className="py-2">#{o.order_code}</td>
                    <td className="py-2">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="py-2">{new Date(o.created_at).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2">Rs {Math.round((o.amount_paise || 0) / 100)}</td>
                    <td className="py-2">{o.pay_type || 'upi'}</td>
                    <td className="py-2">
                      <span className={o.pay_state === 1 ? 'bg-green-100 text-green-700 px-2 py-0.5 rounded-full' : 'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full'}>
                        {o.pay_state === 1 ? 'paid' : 'pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}