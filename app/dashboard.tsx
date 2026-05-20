 
'use client';
import { useEffect, useState } from 'react';

const SN = 'C3B31F38D1C07A76';

export default function Dashboard() {
  const [time, setTime] = useState('');
  const [temp] = useState(6);
  const [orders] = useState([
    { code: '1747666123', time: '20:14', amount: 120, status: 'paid' },
    { code: '1747665891', time: '19:58', amount: 120, status: 'paid' },
    { code: '1747665234', time: '19:32', amount: 120, status: 'pending' },
    { code: '1747664801', time: '19:10', amount: 120, status: 'paid' },
  ]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-IN', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-amber-600 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <div className="text-xs opacity-80">SN: {SN}</div>
          <div className="text-xs opacity-70">Fruitful-2 · Hyderabad</div>
        </div>
        <div className="flex gap-6 items-center text-sm">
          <span className="font-semibold">{temp}°C</span>
          <span className="text-xs">{time}</span>
          <span className="text-xs opacity-80">v2.5.4</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Machine status</div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Online
            </span>
            <div className="text-xs text-gray-400 mt-2">Last seen: just now</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Inner temperature</div>
            <div className="text-2xl font-medium">{temp}°C</div>
            <div className="text-xs text-gray-400 mt-1">Threshold: &lt;20°C ✓</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Today orders</div>
            <div className="text-2xl font-medium">12</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Revenue today</div>
            <div className="text-2xl font-medium">₹1,440</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Avg weight</div>
            <div className="text-2xl font-medium">242g</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase mb-3">Stock levels</div>
          {[['L1', 80], ['L2', 45], ['L3', 90]].map(([label, pct]) => (
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
              {orders.map(o => (
                <tr key={o.code} className="border-b border-gray-50">
                  <td className="py-2">#{o.code}</td>
                  <td className="py-2">{o.time}</td>
                  <td className="py-2">₹{o.amount}</td>
                  <td className="py-2">
                    <span className={o.status === 'paid' ? 'bg-green-100 text-green-700 px-2 py-0.5 rounded-full' : 'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full'}>
                      {o.status}
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