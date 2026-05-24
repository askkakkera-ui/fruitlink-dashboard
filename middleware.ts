import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/api/forgot-password', '/api/reset-password', '/api/login'];

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('fl_auth')?.value;
  const pathname = request.nextUrl.pathname;
  const validAuth = process.env.FL_AUTH_SECRET || 'fl_secure_2026';
  if (auth === validAuth) return NextResponse.next();
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.svg).*)'],
};
