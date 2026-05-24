import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MACHINE_API = 'http://187.127.167.187:3001';

export async function GET(request: NextRequest, { params }: { params: { sn: string } }) {
  try {
    const res = await fetch(MACHINE_API + '/api/telemetry/' + params.sn);
    const data = await res.json();
    return NextResponse.json(data);
  } catch(e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
