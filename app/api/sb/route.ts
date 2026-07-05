import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';

// Tables only a super_admin may WRITE to (POST/PATCH/DELETE).
const SUPER_ADMIN_WRITE_TABLES = ['operators', 'machines', 'machine_operators'];

// ── Read scoping model ────────────────────────────────────────────────
// Tables that are scoped to an operator's own machines (by machine_id column).
const MACHINE_SCOPED_TABLES = ['orders', 'alerts', 'telemetry', 'stock_events', 'faults', 'serial_logs', 'ad_machine_state'];
// Tables scoped to the operator's own machine rows (by the machines.id column).
const MACHINE_ID_TABLES = ['machines'];
// Tables an operator may read fully (non-sensitive shared/reference data).
const OPERATOR_READABLE_ALL = ['ad_campaign', 'ad_campaign_performance', 'ads', 'ad_impression', 'loyalty', 'machine_config', 'role_permissions'];
// Tables where a plain operator may only see their own row(s).
// operators -> own row (id = sub); machine_operators -> own grants (operator_id = sub)

function pathParam(request: NextRequest): string {
  return request.nextUrl.searchParams.get('path') || '';
}
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

// Prevent iOS Safari (and any intermediary) from caching/replaying GET responses.
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

// Resolve the machine_ids this operator is granted, from the authoritative join table.
// Uses the service key server-side (never trusts the browser).
async function allowedMachineIds(operatorId: string): Promise<string[]> {
  const url = SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(operatorId);
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r: any) => r.machine_id).filter(Boolean) : [];
}

// Append a PostgREST filter to the target path string, preserving existing query params.
function appendFilter(path: string, filter: string): string {
  return path + (path.includes('?') ? '&' : '?') + filter;
}

// Build the tenant-scoped target path for a GET, based on the verified session.
// Returns { path } to forward, or { block:true } to refuse, or { empty:true } for a guaranteed-empty result.
async function scopeGetPath(request: NextRequest, session: any): Promise<{ path?: string; block?: boolean; empty?: boolean }> {
  const rawPath = pathParam(request);

  // Storage (comm logs) — super_admin only. Handled by caller.
  if (rawPath.startsWith('/storage/')) {
    return session.role === 'super_admin' ? { path: rawPath } : { block: true };
  }

  const role = session.role;
  const sub = String(session.sub || '');
  const table = tableOf(rawPath);

  // super_admin: unrestricted read.
  if (role === 'super_admin') return { path: rawPath };

  // field_staff (future): only visit-related tables; everything financial blocked.
  if (role === 'field_staff') {
    const FIELD_STAFF_READABLE = ['visits', 'machines']; // machines needed for the dropdown (id/name/sn only ideally)
    if (!FIELD_STAFF_READABLE.includes(table)) return { block: true };
    // field staff only see visits they created
    if (table === 'visits') return { path: appendFilter(rawPath, 'staff_id=eq.' + encodeURIComponent(sub)) };
    // machines: restrict to the servicer's machines (future: via servicer link). For now, block detail beyond dropdown.
    return { path: rawPath };
  }

  // operator: scope to their own machines / rows.
  if (role === 'operator') {
    // operators table -> only their own row
    if (table === 'operators') return { path: appendFilter(rawPath, 'id=eq.' + encodeURIComponent(sub)) };
    // machine_operators -> only their own grants
    if (table === 'machine_operators') return { path: appendFilter(rawPath, 'operator_id=eq.' + encodeURIComponent(sub)) };
    // fully-readable reference/shared tables
    if (OPERATOR_READABLE_ALL.includes(table)) return { path: rawPath };

    // machine-scoped tables need the allowed machine id list
    if (MACHINE_ID_TABLES.includes(table) || MACHINE_SCOPED_TABLES.includes(table)) {
      const ids = await allowedMachineIds(sub);
      if (ids.length === 0) return { empty: true }; // operator with no machines -> empty, not "all"
      const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
      if (MACHINE_ID_TABLES.includes(table)) return { path: appendFilter(rawPath, 'id=in.' + inList) };
      return { path: appendFilter(rawPath, 'machine_id=in.' + inList) };
    }

    // Unknown / unlisted table -> refuse by default (allowlist posture).
    return { block: true };
  }

  // Unknown role -> refuse.
  return { block: true };
}

// ── GET: authenticated + tenant-scoped ──
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    const scoped = await scopeGetPath(request, session);
    if (scoped.block) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    if (scoped.empty) return NextResponse.json([], { headers: NO_STORE }); // guaranteed-empty, never "all"

    const path = scoped.path!;
    // Storage returns raw text.
    if (path.startsWith('/storage/')) {
      const res = await fetch(SB_URL + path, { headers: sbHeaders() });
      const text = await res.text();
      return new NextResponse(text, { status: res.status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...NO_STORE } });
    }
    const res = await fetch(SB_URL + path, { headers: sbHeaders() });
    const data = await res.json();
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// Shared write guard: logged in; sensitive tables need super_admin.
const FIELD_STAFF_WRITE_TABLES = ['visits'];

async function guardWrite(request: NextRequest, method: string) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const table = tableOf(pathParam(request));
  if (SUPER_ADMIN_WRITE_TABLES.includes(table) && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: super admin only' }, { status: 403 });
  }
  if (session.role === 'field_staff') {
    if (method !== 'POST' || !FIELD_STAFF_WRITE_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const blocked = await guardWrite(request, 'POST'); if (blocked) return blocked;
    const url = SB_URL + pathParam(request);
    const body = await request.text();
    const res = await fetch(url, { method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const blocked = await guardWrite(request, 'PATCH'); if (blocked) return blocked;
    const url = SB_URL + pathParam(request);
    const body = await request.text();
    const res = await fetch(url, { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }), body });
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const blocked = await guardWrite(request, 'DELETE'); if (blocked) return blocked;
    const url = SB_URL + pathParam(request);
    const res = await fetch(url, { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) });
    return new NextResponse(null, { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
