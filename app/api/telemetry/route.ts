import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MACHINE_API = 'https://api.fruitlinktech.in';

export async function GET(request: NextRequest) {
  try {
    const sn = request.nextUrl.searchParams.get('sn');
    if (!sn) return NextResponse.json({ success: false, error: 'sn required' });
    const res = await fetch(MACHINE_API + '/api/telemetry/' + sn);
    const data = await res.json();
    return NextResponse.json(data);
  } catch(e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
