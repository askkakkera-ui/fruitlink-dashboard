import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const { data: operator, error: opErr } = await supabase
      .from('operators')
      .select('id, name')
      .eq('email', email)
      .single();

    if (opErr || !operator) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expires_at = new Date(Date.now() + 3600000).toISOString();

    const { error: insertErr } = await supabase
      .from('password_reset_tokens')
      .insert({ operator_id: operator.id, token, expires_at });

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
    }

    const resetLink = 'https://www.fruitlinktech.in/reset-password?token=' + token;

    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer re_S867dxa9_Kr4q4RsK7NEuQfYWQ5mP86KS',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'alerts@resend.dev',
        to: email,
        subject: 'Fruitlink — Reset your password',
        html: '<h2>Password Reset</h2><p>Hello ' + operator.name + ',</p><p>Click below to reset your password. Expires in 1 hour.</p><p><a href="' + resetLink + '">Reset Password</a></p><p>Link: ' + resetLink + '</p><p>Fruitlink Technologies</p>'
      })
    }).catch(e => console.error('Email error:', e.message));

    return NextResponse.json({ success: true });

  } catch(e: any) {
    console.error('Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}