import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
export const runtime = 'nodejs';
const SUPABASE_URL = 'https://fpwvutdvwnvrunviporz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk';
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    const res = await fetch(SUPABASE_URL + '/rest/v1/operators?email=eq.' + encodeURIComponent(email) + '&select=id,name,email,password_hash&limit=1', { headers });
    const data = await res.json();
    if (!data || data.length === 0) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    const operator = data[0];
    const valid = await bcrypt.compare(password, operator.password_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    return NextResponse.json({ success: true, id: operator.id, name: operator.name, email: operator.email });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}