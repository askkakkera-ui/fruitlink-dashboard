'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) { setError('Please fill all required fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');

    const { data: existing } = await supabase.from('operators').select('id').eq('email', email).single();
    if (existing) { setError('Email already registered'); setLoading(false); return; }

    const { error: err } = await supabase.from('operators').insert({
      name: name,
      email: email,
      password_hash: password,
      phone: phone,
    });

    if (err) { setError('Registration failed: ' + err.message); setLoading(false); return; }
    setSuccess(true);
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
          placeholder="Password * (min 6 chars)"
          value={password}
          onChange={e => setPassword(e.target.value)}
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