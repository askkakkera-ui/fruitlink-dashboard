'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!email) { setError('Please enter your email'); return; }
    setLoading(true);
    setError('');

    const { data: operator } = await supabase.from('operators').select('id, name').eq('email', email).single();
    if (!operator) { setError('No account found with this email'); setLoading(false); return; }

    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expires_at = new Date(Date.now() + 3600000).toISOString();

    await supabase.from('password_reset_tokens').insert({ operator_id: operator.id, token, expires_at });

    const resetLink = 'https://www.fruitlinktech.in/reset-password?token=' + token;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer re_S867dxa9_Kr4q4RsK7NEuQfYWQ5mP86KS', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'alerts@resend.dev',
        to: email,
        subject: 'Fruitlink — Reset your password',
        html: '<h2>Password Reset</h2><p>Hello ' + operator.name + ',</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="' + resetLink + '">Reset Password</a></p><p>If you did not request this, ignore this email.</p><p>Fruitlink Technologies</p>'
      })
    });

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 border border-gray-200 w-80 text-center">
          <div className="text-2xl font-semibold text-amber-600 mb-2">Fruitlink</div>
          <div className="text-green-600 font-medium mb-2">Email sent!</div>
          <div className="text-xs text-gray-400 mb-4">Check your inbox at {email} for the reset link. It expires in 1 hour.</div>
          <a href="/login" className="text-amber-600 text-sm font-medium">Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 border border-gray-200 w-80">
        <div className="text-center mb-6">
          <div className="text-2xl font-semibold text-amber-600">Fruitlink</div>
          <div className="text-xs text-gray-400 mt-1">Reset your password</div>
        </div>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-amber-600 text-white rounded-lg py-2 text-sm font-medium mb-3"
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
        <div className="text-center text-xs text-gray-400">
          <a href="/login" className="text-amber-600">Back to Login</a>
        </div>
      </div>
    </div>
  );
}