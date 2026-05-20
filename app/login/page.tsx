'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('operators')
      .select('id, name, email, password_hash')
      .eq('email', email)
      .eq('password_hash', password)
      .single();

    if (error || !data) {
      setError('Invalid email or password');
      setLoading(false);
      return;
    }

    document.cookie = 'fl_auth=fruitlink2026; path=/; max-age=86400';
    document.cookie = 'fl_operator_id=' + data.id + '; path=/; max-age=86400';
    document.cookie = 'fl_operator_name=' + data.name + '; path=/; max-age=86400';
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 border border-gray-200 w-80">
        <div className="text-center mb-6">
          <div className="text-2xl font-semibold text-amber-600">Fruitlink</div>
          <div className="text-xs text-gray-400 mt-1">Operator Dashboard</div>
        </div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-amber-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </div>
  );
}