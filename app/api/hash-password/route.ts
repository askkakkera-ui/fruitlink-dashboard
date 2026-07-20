// bcrypt is deliberately expensive, so an unauthenticated caller here is a free
// CPU-burn primitive. Every remaining caller (OperatorsPage, MyStaffSection) is
// an authenticated dashboard screen; signup and password reset hash inside
// /api/register and /api/reset-password instead of calling this.
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });
    const hash = await bcrypt.hash(password, 10);
    return NextResponse.json({ hash });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
