import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'no-store' };

// Every cookie the app sets at login. fl_session is HttpOnly, so only the
// server can clear it — document.cookie in the browser cannot touch it.
const COOKIES = [
  SESSION_COOKIE,
  'fl_permissions',
  'fl_role',
  'fl_operator_id',
  'fl_operator_name',
  'fl_owner_id',
];

function clearAll(response: NextResponse) {
  for (const name of COOKIES) {
    response.cookies.set(name, '', {
      httpOnly: name === SESSION_COOKIE,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // expire immediately
    });
  }
  return response;
}

/**
 * POST /api/logout
 *
 * Ends the session for real. The old client-side logout only deleted the
 * cookies JavaScript could see; fl_session is HttpOnly and survived, so on a
 * shared phone the next person was still signed in as the last one.
 */
export async function POST() {
  return clearAll(NextResponse.json({ success: true }, { headers: NO_STORE }));
}

// Allow a plain link/redirect to log out too (e.g. no-JS fallback).
export async function GET(request: Request) {
  const url = new URL('/login', request.url);
  return clearAll(NextResponse.redirect(url, { headers: NO_STORE }));
}
