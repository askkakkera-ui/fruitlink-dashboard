import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
const sbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
  ...extra,
});

function actorFor(session: any): string {
  return session.role === 'sub_operator' ? String(session.owner_id || '') : String(session.sub || '');
}

// GET /api/transfer?pending=1   -> transfers awaiting this owner's confirmation
// GET /api/transfer?sent=1      -> transfers this owner has sent (super_admin view)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const role = session.role;
    if (role !== 'super_admin' && role !== 'operator' && role !== 'sub_operator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    const me = actorFor(session);
    const sp = request.nextUrl.searchParams;

    let filter = '';
    if (sp.get('sent') === '1') {
      filter = 'owner_id=eq.' + encodeURIComponent(me);
    } else {
      filter = 'transfer_to_operator_id=eq.' + encodeURIComponent(me) + '&transfer_status=eq.in_transit';
    }
    const url = SB_URL + '/rest/v1/stock_movements?select=*&movement_type=eq.transfer_out&' + filter + '&order=created_at.desc&limit=200';
    const r = await fetch(url, { headers: sbHeaders() });
    const d = await r.json();
    return NextResponse.json(Array.isArray(d) ? d : [], { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE });
  }
}

// POST /api/transfer  { transfer_id, action: 'confirm' | 'reject' }
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const role = session.role;
    if (role !== 'super_admin' && role !== 'operator' && role !== 'sub_operator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    const body = await request.json().catch(() => ({}));
    const transfer_id = String(body.transfer_id || '');
    const action = String(body.action || '');
    if (!transfer_id || (action !== 'confirm' && action !== 'reject')) {
      return NextResponse.json({ error: 'transfer_id and action (confirm|reject) required' }, { status: 400, headers: NO_STORE });
    }
    const fn = action === 'confirm' ? 'confirm_transfer' : 'reject_transfer';
    const res = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_transfer_id: transfer_id, p_actor_id: actorFor(session) }),
    });
    const d = await res.json();
    if (d && d.ok === false) {
      return NextResponse.json({ error: d.error || 'transfer failed' }, { status: 400, headers: NO_STORE });
    }
    return NextResponse.json(d, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE });
  }
}
