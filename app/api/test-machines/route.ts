import { NextResponse } from 'next/server';
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3Z1dGR2d252cnVudmlwb3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTQ4NSwiZXhwIjoyMDk0Nzg1NDg1fQ.q65HEk_-yOlTfy4dpDE7BqcDjkyePJeHr8faWR_A6kk';
export async function GET() {
  try {
    const res = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,status', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    const data = await res.json();
    return NextResponse.json({ ok: true, url: SB_URL, key_prefix: SB_KEY.substring(0,20), machines: data });
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
