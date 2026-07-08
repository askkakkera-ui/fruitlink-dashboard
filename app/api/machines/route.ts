import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';

const sbH = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });

async function getSession(request: NextRequest) {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}

async function allowedMachineIds(operatorId: string): Promise<string[]> {
  const res = await fetch(SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(operatorId), { headers: sbH() });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r: any) => r.machine_id).filter(Boolean) : [];
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URLSearchParams(request.nextUrl.search || '');
    params.delete('id');
    let search = params.toString();
    search = search ? '?' + search : '';

    const role = session.role;
    const sub = String(session.sub || '');

    let scopeFilter = '';
    if (role === 'super_admin') {
      scopeFilter = '';
    } else if (role === 'operator') {
      const ids = await allowedMachineIds(sub);
      if (ids.length === 0) return NextResponse.json([]);
      scopeFilter = 'id=in.(' + ids.map(encodeURIComponent).join(',') + ')';
    } else {
      return NextResponse.json([]);
    }

    const url = SB_URL + '/rest/v1/machines' + search + (scopeFilter ? (search ? '&' : '?') + scopeFilter : '');
    const res = await fetch(url, { headers: sbH() });
    const data = await res.json();
    if (!Array.isArray(data)) return NextResponse.json([]);

    // For super_admin: enrich machines with owner info in one bulk query
    if (role === 'super_admin' && data.length > 0) {
      const machineIds = data.map((m: any) => m.id);
      const idList = '(' + machineIds.map(encodeURIComponent).join(',') + ')';

      // Bulk fetch: machine_operators + operators in parallel
      const [moRes, opsRes] = await Promise.all([
        fetch(SB_URL + '/rest/v1/machine_operators?select=machine_id,operator_id&machine_id=in.' + idList, { headers: sbH() }),
        fetch(SB_URL + '/rest/v1/operators?select=id,name,role&role=neq.field_staff', { headers: sbH() }),
      ]);
      const [moRows, opsRows] = await Promise.all([moRes.json(), opsRes.json()]);

      // Build lookup maps
      const machineToOp: Record<string, string> = {};
      (Array.isArray(moRows) ? moRows : []).forEach((r: any) => {
        machineToOp[r.machine_id] = r.operator_id;
      });
      const opById: Record<string, any> = {};
      (Array.isArray(opsRows) ? opsRows : []).forEach((r: any) => {
        opById[r.id] = r;
      });

      // Enrich machines with owner_id and owner_name
      const enriched = data.map((m: any) => {
        const opId = machineToOp[m.id];
        const op = opId ? opById[opId] : null;
        return {
          ...m,
          owner_id: opId || null,
          owner_name: op?.name || (op?.role === 'super_admin' ? 'Fruitlink' : 'Unassigned'),
        };
      });

      return NextResponse.json(enriched);
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json([]);
  }
}
