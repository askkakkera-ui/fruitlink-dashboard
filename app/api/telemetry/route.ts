import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const MACHINE_API = 'https://api.fruitlinktech.in';
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';

const sbHeaders = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

// Does this SN belong to a machine the operator is granted? (super_admin: always yes)
async function snAllowed(sn: string, session: any): Promise<boolean> {
  if (session.role === 'super_admin') return true;
  if (session.role !== 'operator' && session.role !== 'sub_operator') return false;
  // machine id for this SN
  const mRes = await fetch(SB_URL + '/rest/v1/machines?select=id&sn=eq.' + encodeURIComponent(sn), { headers: sbHeaders() });
  const mRows = mRes.ok ? await mRes.json() : [];
  const mid = Array.isArray(mRows) && mRows[0] ? mRows[0].id : null;
  if (!mid) return false;
  // is it granted to this operator?
  // machine_operators is TENANCY: which operator owns which machine. Field staff
  // and sub-operators inherit their tenant's machines - they never hold rows of
  // their own. Keying on session.sub denied every field staff member once the
  // duplicate assignment rows were removed.
  const tenantId = session.owner_id ? String(session.owner_id) : String(session.sub || '');
  const gRes = await fetch(SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(tenantId) + '&machine_id=eq.' + encodeURIComponent(mid), { headers: sbHeaders() });
  const gRows = gRes.ok ? await gRes.json() : [];
  return Array.isArray(gRows) && gRows.length > 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const sn = request.nextUrl.searchParams.get('sn');
    if (!sn) return NextResponse.json({ success: false, error: 'sn required' });

    if (!(await snAllowed(sn, session))) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const res = await fetch(MACHINE_API + '/api/telemetry/' + encodeURIComponent(sn));
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
