'use client';
import { useState } from 'react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleLogin() {
    if (password === 'fruitlink2026') {
      document.cookie = 'fl_auth=fruitlink2026; path=/; max-age=86400';
      window.location.href = '/';
    } else {
      setError('Wrong password');
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 border border-gray-200 w-80">
        <div className="text-center mb-6">
          <div className="text-2xl font-semibold text-amber-600">Fruitlink</div>
          <div className="text-xs text-gray-400 mt-1">Operator Dashboard</div>
        </div>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
        <button
          onClick={handleLogin}
          className="w-full bg-amber-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          Login
        </button>
      </div>
    </div>
  );
}