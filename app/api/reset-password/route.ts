import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SUPABASE_URL = 'https://fpwvutdvwnvrunviporz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk';

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
      const res = await fetch(SUPABASE_URL + '/rest/v1/password_reset_tokens?token=eq.' + token + '&used=eq.false&select=id,operator_id,expires_at&limit=1', { headers });
      const data = await res.json();
      if (!data || data.length === 0) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
      if (new Date(data[0].expires_at) < new Date()) return NextResponse.json({ error: 'Token expired' }, { status: 400 });

      await fetch(SUPABASE_URL + '/rest/v1/operators?id=eq.' + data[0].operator_id, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ password_hash: password })
      });

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