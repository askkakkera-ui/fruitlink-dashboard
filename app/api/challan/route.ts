import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

// Challan proxy. The generator lives on machine-api (puppeteer + pdf-lib),
// guarded by the fleet key. The browser calls this session-authenticated route,
// which attaches the key server-side and streams the PDF back. Challans are
// Fruitlink-only, so this requires super_admin (or Fruitlink staff).
const MACHINE_API = process.env.MACHINE_API_URL || 'https://api.fruitlinktech.in';
const MACHINE_KEY = process.env.MACHINE_KEY || '';
const NO_STORE = { 'Cache-Control': 'no-store' };
export const runtime = 'nodejs';

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  try {
    const session: any = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role !== 'super_admin' && session.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    if (!MACHINE_KEY) return NextResponse.json({ error: 'MACHINE_KEY not configured' }, { status: 500, headers: NO_STORE });

    const saleId = request.nextUrl.searchParams.get('sale_id') || '';
    const challanNo = request.nextUrl.searchParams.get('challan_no') || '';
    if (!saleId && !challanNo) {
      return NextResponse.json({ error: 'sale_id or challan_no required' }, { status: 400, headers: NO_STORE });
    }
    const qs = saleId ? 'sale_id=' + encodeURIComponent(saleId) : 'challan_no=' + encodeURIComponent(challanNo);
    const r = await fetch(MACHINE_API + '/api/challan?' + qs, { headers: { 'x-machine-key': MACHINE_KEY } });
    if (!r.ok) {
      const t = await r.text();
      return new NextResponse(t || JSON.stringify({ error: 'challan generation failed' }), {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...NO_STORE },
      });
    }
    const buf = await r.arrayBuffer();
    const disp = r.headers.get('content-disposition') || 'inline; filename="challan.pdf"';
    return new NextResponse(buf, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': disp, ...NO_STORE },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500, headers: NO_STORE });
  }
}
