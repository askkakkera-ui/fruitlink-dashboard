import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

const sbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
  ...extra,
});

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

// Machines this tenant is granted, from the authoritative join table.
// Service key, server-side: the browser never gets to say which machines are its own.
async function allowedMachineIds(operatorId: string): Promise<string[]> {
  const url = SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(operatorId);
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r: any) => r.machine_id).filter(Boolean) : [];
}

// PostgREST ANDs repeated filters, so a scope filter appended after the caller's
// query string can only narrow the result — never widen it.
function appendFilter(search: string, filter: string): string {
  return search + (search.startsWith('?') ? '&' : '?') + filter;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    const role = session.role;
    let search = request.nextUrl.search || '';

    // Scope model mirrors app/api/sb/route.ts, where `alerts` is a MACHINE_SCOPED_TABLE:
    //   super_admin / staff -> fleet-wide (staff are Fruitlink's fleet-service team)
    //   operator            -> their own machines
    //   sub_operator        -> their parent operator's machines
    //   anything else       -> refuse (field_staff read visits/machines, never alerts)
    if (role !== 'super_admin' && role !== 'staff') {
      let tenantId = '';
      if (role === 'operator') tenantId = String(session.sub || '');
      else if (role === 'sub_operator') tenantId = String(session.owner_id || '');
      else return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

      // A tenant-scoped role with no tenant is a malformed session, not a licence
      // to read everything. Fail closed.
      if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

      const ids = await allowedMachineIds(tenantId);
      // No machines -> no alerts. Never fall through to an unfiltered query.
      if (ids.length === 0) return NextResponse.json([], { headers: NO_STORE });
      const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
      search = appendFilter(search, 'machine_id=in.' + inList);
    }

    const res = await fetch(SB_URL + '/rest/v1/alerts' + search, { headers: sbHeaders() });
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : [], { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json([], { headers: NO_STORE });
  }
}
