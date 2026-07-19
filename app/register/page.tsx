'use client';
import { useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// See app/orders/page.tsx — createClient at module scope with an unset env var
// throws during prerender and takes `next build` down with it. Built on demand
// from the click handler instead.
let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase is not configured — NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are unset.');
    _sb = createClient(url, key);
  }
  return _sb;
}

function validatePassword(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Must have at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Must have at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Must have at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Must have at least one special character';
  return '';
}

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) { setError('Please fill all required fields'); return; }
    const pwdError = validatePassword(password);
    if (pwdError) { setError(pwdError); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabase();
      const { data: existing } = await supabase.from('operators').select('id').eq('email', email).single();
      if (existing) { setError('Email already registered'); setLoading(false); return; }

      // password_hash used to receive the raw password. The column name was the
      // only thing hashing it. Every other path that writes this column -
      // OperatorsPage, MyStaffSection - bcrypts through /api/hash-password
      // first, and login verifies with bcrypt.compare, so a plaintext row could
      // never log in either: it was both a breach and a broken signup.
      const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (!hashRes.ok) { setError('Registration failed: could not hash password'); setLoading(false); return; }
      const { hash } = await hashRes.json();

      const { error: err } = await supabase.from('operators').insert({
        name, email, password_hash: hash, phone,
      });

      if (err) { setError('Registration failed: ' + err.message); setLoading(false); return; }
      setSuccess(true);
    } catch (e: any) {
      setError('Registration failed: ' + (e?.message || 'error'));
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 border border-gray-200 w-80 text-center">
          <div className="text-2xl font-semibold text-amber-600 mb-2">Fruitlink</div>
          <div className="text-green-600 font-medium mb-2">Registration successful!</div>
          <div className="text-xs text-gray-400 mb-4">Your account is pending approval. We will contact you at {email}.</div>
          <a href="/login" className="text-amber-600 text-sm font-medium">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 border border-gray-200 w-80">
        <div className="text-center mb-6">
          <div className="text-2xl font-semibold text-amber-600">Fruitlink</div>
          <div className="text-xs text-gray-400 mt-1">Create Operator Account</div>
        </div>
        <input
          type="text"
          placeholder="Business name *"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        <input
          type="email"
          placeholder="Email *"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        <input
          type="tel"
          placeholder="Phone (WhatsApp)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        <input
          type="password"
          placeholder="Password *"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-1 outline-none"
        />
        <div className="text-xs text-gray-400 mb-3 px-1">Min 8 chars, uppercase, lowercase, number, special char</div>
        <input
          type="password"
          placeholder="Confirm password *"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRegister()}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-amber-600 text-white rounded-lg py-2 text-sm font-medium mb-3"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
        <div className="text-center text-xs text-gray-400">
          Already have an account? <a href="/login" className="text-amber-600">Login</a>
        </div>
      </div>
    </div>
  );
}