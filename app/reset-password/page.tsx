'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

function validatePassword(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must have at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must have at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must have at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must have at least one special character';
  return '';
}

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
    if (t) validateToken(t);
  }, []);

  async function validateToken(t: string) {
    const { data } = await supabase.from('password_reset_tokens').select('*').eq('token', t).eq('used', false).single();
    if (data && new Date(data.expires_at) > new Date()) {
      setTokenValid(true);
    } else {
      setError('This reset link is invalid or has expired. Please request a new one.');
    }
    setChecking(false);
  }

  async function handleReset() {
    const pwdError = validatePassword(password);
    if (pwdError) { setError(pwdError); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');

    const { data: tokenData } = await supabase.from('password_reset_tokens').select('operator_id').eq('token', token).single();
    if (!tokenData) { setError('Invalid token'); setLoading(false); return; }

    await supabase.from('operators').update({ password_hash: password }).eq('id', tokenData.operator_id);
    await supabase.from('password_reset_tokens').update({ used: true }).eq('token', token);

    setDone(true);
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 border border-gray-200 w-80 text-center">
          <div className="text-2xl font-semibold text-amber-600 mb-2">Fruitlink</div>
          <div className="text-xs text-gray-400">Validating reset link...</div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 border border-gray-200 w-80 text-center">
          <div className="text-2xl font-semibold text-amber-600 mb-2">Fruitlink</div>
          <div className="text-green-600 font-medium mb-2">Password reset!</div>
          <div className="text-xs text-gray-400 mb-4">Your password has been updated. You can now login.</div>
          <a href="/login" className="text-amber-600 text-sm font-medium">Go to Login</a>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 border border-gray-200 w-80 text-center">
          <div className="text-2xl font-semibold text-amber-600 mb-2">Fruitlink</div>
          <div className="text-red-500 text-sm mb-4">{error}</div>
          <a href="/forgot-password" className="text-amber-600 text-sm font-medium">Request new link</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 border border-gray-200 w-80">
        <div className="text-center mb-6">
          <div className="text-2xl font-semibold text-amber-600">Fruitlink</div>
          <div className="text-xs text-gray-400 mt-1">Set new password</div>
        </div>
        <div className="text-xs text-gray-400 mb-3 bg-gray-50 p-2 rounded-lg">
          Password must be at least 8 characters with uppercase, lowercase, number and special character.
        </div>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleReset()}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
        <button
          onClick={handleReset}
          disabled={loading}
          className="w-full bg-amber-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          {loading ? 'Updating...' : 'Set new password'}
        </button>
      </div>
    </div>
  );
}