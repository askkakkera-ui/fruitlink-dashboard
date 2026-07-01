import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';   // service key, server-only. NEXT_PUBLIC fallback removed on purpose.

const sbHeaders = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

async function allowedMachineIds(operatorId: string): Promise<string[]> {
  const url = SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(operatorId);
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r: any) => r.machine_id).filter(Boolean) : [];
}

export async function GET(request: NextRequest) {
  try {
    // 1) Must be logged in with a valid signed session (not a forgeable cookie).
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2) Preserve the browser's own query (select=, order=, etc.) but strip any
    //    browser-supplied id filter — the SERVER decides scope, not the client.
    const params = new URLSearchParams(request.nextUrl.search || '');
    params.delete('id');           // remove client id=... / id=in.(...) / id=eq.none
    let search = params.toString();
    search = search ? '?' + search : '';

    const role = session.role;
    const sub = String(session.sub || '');

    let scopeFilter = '';
    if (role === 'super_admin') {
      scopeFilter = '';                                   // sees all machines
    } else if (role === 'operator') {
      const ids = await allowedMachineIds(sub);
      if (ids.length === 0) return NextResponse.json([]); // no machines -> empty, never "all"
      scopeFilter = 'id=in.(' + ids.map(encodeURIComponent).join(',') + ')';
    } else {
      // field_staff and unknown roles do not read the machines list here.
      return NextResponse.json([]);
    }

    const url = SB_URL + '/rest/v1/machines' + search + (scopeFilter ? (search ? '&' : '?') + scopeFilter : '');
    const res = await fetch(url, { headers: sbHeaders() });
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (e: any) {
    return NextResponse.json([]);
  }
}
