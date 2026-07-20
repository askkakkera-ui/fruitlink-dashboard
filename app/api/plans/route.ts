import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { listPlans } from '@/lib/entitlements';

const NO_STORE = { 'Cache-Control': 'no-store' };

// GET /api/plans — the plan catalogue (reference data, no tenant column).
// Read-only and authenticated. The `plans` table is deliberately absent from
// /api/sb's allowlists: this is the only way the browser sees it, and there is
// no write path at all — plans are changed in the database, not from a page.
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    return NextResponse.json(await listPlans(), { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
