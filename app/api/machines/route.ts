import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || '';
export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.search || '';
    const url = SB_URL + '/rest/v1/machines' + search;
    const res = await fetch(url, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch(e: any) {
    return NextResponse.json([]);
  }
}
