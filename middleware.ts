import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'fl_session';
const secretKey = process.env.SESSION_SECRET || '';
const encodedKey = new TextEncoder().encode(secretKey);

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
const FIELD_STAFF_ALLOWED_PREFIXES = ['/visit'];

async function readSession(request: NextRequest): Promise<{ role: string; sub: string } | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !secretKey) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    return { role: String(payload.role || ''), sub: String(payload.sub || '') };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/')) return NextResponse.next();
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  const session = await readSession(request);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (session.role === 'field_staff') {
    const allowed = FIELD_STAFF_ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/visit';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|manifest.json|sw.js|.*\\.png|.*\\.svg|.*\\.ico|.*\\.webmanifest).*)'],
};
