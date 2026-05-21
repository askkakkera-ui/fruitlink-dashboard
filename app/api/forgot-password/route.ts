import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const SUPABASE_URL = 'https://fpwvutdvwnvrunviporz.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk';

    const opRes = await fetch(SUPABASE_URL + '/rest/v1/operators?email=eq.' + encodeURIComponent(email) + '&select=id,name&limit=1', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const operators = await opRes.json();
    if (!operators || operators.length === 0) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }
    const operator = operators[0];

    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expires_at = new Date(Date.now() + 3600000).toISOString();

    await fetch(SUPABASE_URL + '/rest/v1/password_reset_tokens', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ operator_id: operator.id, token, expires_at })
    });

    const resetLink = 'https://www.fruitlinktech.in/reset-password?token=' + token;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer re_S867dxa9_Kr4q4RsK7NEuQfYWQ5mP86KS', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'alerts@resend.dev',
        to: email,
        subject: 'Fruitlink — Reset your password',
        html: '<h2>Password Reset</h2><p>Hello ' + operator.name + ',</p><p>Click below to reset your password. Expires in 1 hour.</p><p><a href="' + resetLink + '" style="background:#d97706;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:10px 0;">Reset Password</a></p><p>Or copy this link:<br>' + resetLink + '</p><p>Fruitlink Technologies</p>'
      })
    });

    return NextResponse.json({ success: true });

  } catch(e: any) {
    console.error('Forgot password error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}