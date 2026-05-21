import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
const PASSWORD = 'fruitlink2026';
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/api/forgot-password', '/api/reset-password', '/api/login'];
export function middleware(request: NextRequest) {
  const auth = request.cookies.get('fl_auth')?.value;
  const pathname = request.nextUrl.pathname;
  if (auth === PASSWORD) return NextResponse.next();
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
}
export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};