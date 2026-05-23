// TODO: Add rate limiting (e.g. upstash/ratelimit)
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
export const runtime = 'nodejs';
const SUPABASE_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || '';
const SUPABASE_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || '';
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    const res = await fetch(SUPABASE_URL + '/rest/v1/operators?email=eq.' + encodeURIComponent(email) + '&select=id,name,email,password_hash,role,state,country&limit=1', { headers });
    const data = await res.json();
    if (!data || data.length === 0) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    const operator = data[0];
    const valid = await bcrypt.compare(password, operator.password_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    return NextResponse.json({ success: true, id: operator.id, name: operator.name, email: operator.email, role: operator.role || 'operator', state: operator.state || '', country: operator.country || 'India' });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}