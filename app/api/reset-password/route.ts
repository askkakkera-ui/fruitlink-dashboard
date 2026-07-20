import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || '';
const SUPABASE_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || '';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};

export async function POST(req: NextRequest) {
  try {
    const { action, token, password } = await req.json();

    if (action === 'validate') {
      const res = await fetch(SUPABASE_URL + '/rest/v1/password_reset_tokens?token=eq.' + token + '&used=eq.false&select=id,expires_at&limit=1', { headers });
      const data = await res.json();
      if (!data || data.length === 0) return NextResponse.json({ valid: false });
      const expired = new Date(data[0].expires_at) < new Date();
      return NextResponse.json({ valid: !expired });
    }

    if (action === 'reset') {
      if (!password || typeof password !== 'string') return NextResponse.json({ error: 'Password required' }, { status: 400 });

      const res = await fetch(SUPABASE_URL + '/rest/v1/password_reset_tokens?token=eq.' + token + '&used=eq.false&select=id,operator_id,expires_at&limit=1', { headers });
      const data = await res.json();
      if (!data || data.length === 0) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
      if (new Date(data[0].expires_at) < new Date()) return NextResponse.json({ error: 'Token expired' }, { status: 400 });

      // password_hash used to receive the raw password straight from the client:
      // a plaintext store, and the account could never log in again because
      // /api/login verifies with bcrypt.compare. Hash here the same way
      // /api/hash-password does (bcryptjs, cost 10) — this is already a server
      // route, so it hashes directly rather than calling that endpoint.
      const password_hash = await bcrypt.hash(password, 10);

      const patchRes = await fetch(SUPABASE_URL + '/rest/v1/operators?id=eq.' + data[0].operator_id, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ password_hash })
      });
      // Don't burn the token if the password never landed — the user would be
      // locked into requesting a fresh link with no idea why.
      if (!patchRes.ok) {
        console.error('Reset password: operator update failed:', patchRes.status, await patchRes.text());
        return NextResponse.json({ error: 'Could not update password' }, { status: 500 });
      }

      await fetch(SUPABASE_URL + '/rest/v1/password_reset_tokens?id=eq.' + data[0].id, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ used: true })
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch(e: any) {
    console.error('Reset password error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}