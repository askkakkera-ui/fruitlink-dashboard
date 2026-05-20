import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PASSWORD = 'fruitlink2026';

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('fl_auth')?.value;
  if (auth === PASSWORD) return NextResponse.next();
  if (request.nextUrl.pathname === '/login') return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};