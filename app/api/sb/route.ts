import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || '';

function buildUrl(request: NextRequest): string {
  const path = request.nextUrl.searchParams.get('path') || '';
  return SB_URL + path;
}

export async function GET(request: NextRequest) {
  try {
    const url = buildUrl(request);
    const res = await fetch(url, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch(e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const url = buildUrl(request);
    const body = await request.text();
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch(e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const url = buildUrl(request);
    const body = await request.text();
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body
    });
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  } catch(e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = buildUrl(request);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' }
    });
    return new NextResponse(null, { status: res.status });
  } catch(e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
