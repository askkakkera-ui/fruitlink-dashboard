'use client';
import { useState } from 'react';

// The page no longer talks to Supabase at all — signup goes through
// /api/register, which holds the service key server-side.

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
      // Duplicate check, bcrypt and the operators INSERT all happen in
      // /api/register now. Doing them here meant the browser picked the columns
      // it wrote (role included) over the anon key, and needed a world-readable
      // /api/hash-password to do it.
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Registration failed'); setLoading(false); return; }
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