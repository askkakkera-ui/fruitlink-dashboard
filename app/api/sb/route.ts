import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || '';

// Tables that only a super_admin may WRITE to (POST/PATCH/DELETE).
// Reads (GET) are allowed for any logged-in user.
const SUPER_ADMIN_WRITE_TABLES = ['operators', 'machines', 'machine_operators'];

function buildUrl(request: NextRequest): string {
  const path = request.nextUrl.searchParams.get('path') || '';
  return SB_URL + path;
}

function pathParam(request: NextRequest): string {
  return request.nextUrl.searchParams.get('path') || '';
}

// Which table does this path target? e.g. /rest/v1/machines?id=eq.x -> 'machines'
function tableOf(path: string): string {
  const m = path.match(/\/rest\/v1\/([a-zA-Z0-9_]+)/);
  return m ? m[1] : '';
}

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

const sbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
  ...extra,
});

// ── GET: any authenticated user may read ──
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = buildUrl(request);
    const res = await fetch(url, { headers: sbHeaders() });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Shared guard for write methods: must be logged in; sensitive tables need super_admin.
async function guardWrite(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const table = tableOf(pathParam(request));
  if (SUPER_ADMIN_WRITE_TABLES.includes(table) && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: super admin only' }, { status: 403 });
  }
  return null; // allowed
}

// ── POST ──
export async function POST(request: NextRequest) {
  try {
    const blocked = await guardWrite(request);
    if (blocked) return blocked;

    const url = buildUrl(request);
    const body = await request.text();
    const res = await fetch(url, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=representation' }),
      body,
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── PATCH ──
export async function PATCH(request: NextRequest) {
  try {
    const blocked = await guardWrite(request);
    if (blocked) return blocked;

    const url = buildUrl(request);
    const body = await request.text();
    const res = await fetch(url, {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=representation' }),
      body,
    });
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE ──
export async function DELETE(request: NextRequest) {
  try {
    const blocked = await guardWrite(request);
    if (blocked) return blocked;

    const url = buildUrl(request);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
    });
    return new NextResponse(null, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
