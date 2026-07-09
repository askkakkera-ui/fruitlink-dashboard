import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || ''; // service key only — never anon
const sbH = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const NO_STORE = { 'Cache-Control': 'no-store' };

// GET /api/my-team
// Returns the sub_operators and field_staff belonging to the calling operator,
// each enriched with their current permission flags.
// super_admin may pass ?owner_id=<id> to inspect any operator's team.
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    let parentId: string;
    if (session.role === 'super_admin') {
      parentId = request.nextUrl.searchParams.get('owner_id') || '';
      if (!parentId) return NextResponse.json({ error: 'owner_id required' }, { status: 400, headers: NO_STORE });
    } else if (session.role === 'operator') {
      parentId = String(session.sub);
    } else {
      // sub_operator and field_staff have no team
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }

    // Bulk fetch: team members + my own permissions (the grant ceiling), in parallel
    const [teamRes, myPermRes] = await Promise.all([
      fetch(
        SB_URL + '/rest/v1/operators?select=id,name,email,role,state,country,created_at' +
        '&owner_id=eq.' + encodeURIComponent(parentId) + '&order=created_at.desc',
        { headers: sbH() }
      ),
      fetch(
        SB_URL + '/rest/v1/operator_permissions?select=*&operator_id=eq.' + encodeURIComponent(parentId) + '&limit=1',
        { headers: sbH() }
      ),
    ]);

    const team = await teamRes.json();
    const myPermRows = await myPermRes.json();
    const myPermissions = Array.isArray(myPermRows) && myPermRows[0] ? myPermRows[0] : null;

    if (!Array.isArray(team) || team.length === 0) {
      return NextResponse.json({ team: [], my_permissions: myPermissions }, { headers: NO_STORE });
    }

    // One bulk query for every team member's permissions — no N+1
    const ids = team.map((t: any) => t.id);
    const permRes = await fetch(
      SB_URL + '/rest/v1/operator_permissions?select=*&operator_id=in.(' + ids.map(encodeURIComponent).join(',') + ')',
      { headers: sbH() }
    );
    const permRows = await permRes.json();

    const permByOp: Record<string, any> = {};
    (Array.isArray(permRows) ? permRows : []).forEach((p: any) => { permByOp[p.operator_id] = p; });

    const enriched = team.map((t: any) => ({ ...t, permissions: permByOp[t.id] || null }));

    return NextResponse.json({ team: enriched, my_permissions: myPermissions }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
