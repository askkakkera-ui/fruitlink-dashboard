import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

// Same response for every email, whether or not an account exists — never leak
// which addresses are registered.
const GENERIC = { success: true, message: 'If an account exists with that email, a reset link has been sent.' };

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const SUPABASE_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || '';
    const SUPABASE_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || '';

    const opRes = await fetch(SUPABASE_URL + '/rest/v1/operators?email=eq.' + encodeURIComponent(email) + '&select=id,name&limit=1', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const operators = await opRes.json();
    if (!operators || operators.length === 0) {
      return NextResponse.json(GENERIC);
    }
    const operator = operators[0];

    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 3600000).toISOString();

    const insRes = await fetch(SUPABASE_URL + '/rest/v1/password_reset_tokens', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ operator_id: operator.id, token, expires_at })
    });
    if (!insRes.ok) {
      // Don't mail a link we failed to store — it could never be redeemed.
      console.error('Forgot password: token insert failed:', insRes.status, await insRes.text());
      return NextResponse.json(GENERIC);
    }

    const resetLink = 'https://www.fruitlinktech.in/reset-password?token=' + token;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'alerts@resend.dev',
        to: email,
        subject: 'Fruitlink — Reset your password',
        html: '<h2>Password Reset</h2><p>Hello ' + operator.name + ',</p><p>Click below to reset your password. Expires in 1 hour.</p><p><a href="' + resetLink + '" style="background:#d97706;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:10px 0;">Reset Password</a></p><p>Or copy this link:<br>' + resetLink + '</p><p>Fruitlink Technologies</p>'
      })
    });

    return NextResponse.json(GENERIC);

  } catch(e: any) {
    // Log server-side, but keep the client response identical so failures can't
    // be used to probe for registered addresses.
    console.error('Forgot password error:', e.message);
    return NextResponse.json(GENERIC);
  }
}