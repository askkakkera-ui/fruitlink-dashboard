import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const { data: operator } = await supabase.from('operators').select('id, name').eq('email', email).single();
    if (!operator) return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });

    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expires_at = new Date(Date.now() + 3600000).toISOString();

    await supabase.from('password_reset_tokens').insert({ operator_id: operator.id, token, expires_at });

    const resetLink = 'https://www.fruitlinktech.in/reset-password?token=' + token;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer re_S867dxa9_Kr4q4RsK7NEuQfYWQ5mP86KS', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'alerts@resend.dev',
        to: email,
        subject: 'Fruitlink — Reset your password',
        html: '<h2>Password Reset</h2><p>Hello ' + operator.name + ',</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="' + resetLink + '" style="background:#d97706;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset Password</a></p><br><p>Or copy this link: ' + resetLink + '</p><p>If you did not request this, ignore this email.</p><p>Fruitlink Technologies</p>'
      })
    });

    const emailData = await emailRes.json();
    console.log('Email result:', JSON.stringify(emailData));

    return NextResponse.json({ success: true });
  } catch(e: any) {
    console.error('Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}