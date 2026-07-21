import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'fl_session';
const secretKey = process.env.SESSION_SECRET || '';
const encodedKey = new TextEncoder().encode(secretKey);

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
const FIELD_STAFF_ALLOWED_PREFIXES = ['/visit'];

// A field_staff member may enter the dashboard shell only if the SIGNED session
// grants at least one viewable section. Read from the verified JWT — never from
// the client-writable fl_role / fl_permissions cookies — so it cannot be spoofed.
const DASHBOARD_VIEW_KEYS = [
  'can_view_console', 'can_view_orders', 'can_view_alerts', 'can_view_fleet_map',
  'can_view_warehouse', 'can_view_reports', 'can_view_field_staff',
  'can_view_attendance', 'can_view_notify_config', 'can_view_comm_log',
  'can_view_ad_manager',
];

async function readSession(request: NextRequest): Promise<{ role: string; sub: string; permissions: Record<string, boolean> } | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !secretKey) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    return {
      role: String(payload.role || ''),
      sub: String(payload.sub || ''),
      permissions: (payload.permissions as Record<string, boolean>) || {},
    };
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
    if (allowed) return NextResponse.next();
    // Not a /visit path: admit to the dashboard only when the signed session
    // actually grants a section. No grant -> back to /visit, exactly as before.
    const hasDashboardGrant = DASHBOARD_VIEW_KEYS.some(k => session.permissions?.[k] === true);
    if (!hasDashboardGrant) {
      const url = request.nextUrl.clone();
      url.pathname = '/visit';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|manifest.json|sw.js|.*\\.png|.*\\.svg|.*\\.ico|.*\\.webmanifest).*)'],
};
