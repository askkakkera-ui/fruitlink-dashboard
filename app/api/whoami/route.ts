import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'no session' }, { status: 401 });
  return NextResponse.json({
    sub: session.sub,
    role: session.role,
    owner_id: session.owner_id ?? null,
    owner_id_type: typeof session.owner_id,
    has_permissions: !!session.permissions,
    raw_keys: Object.keys(session),
  });
}
