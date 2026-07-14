import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { logAudit } from '@/lib/audit';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';

// Tables only a super_admin may WRITE to (POST/PATCH/DELETE).
const SUPER_ADMIN_WRITE_TABLES = ['operators', 'machines', 'machine_operators'];

// Tables that soft-delete (DELETE -> set deleted_at) instead of hard delete.
// A deleted person/device must remain resolvable by historical records that
// reference its id (attendance, visits, stock movements, orders).
const SOFT_DELETE_TABLES = ['operators'];

// ── Read scoping model ────────────────────────────────────────────────
const MACHINE_SCOPED_TABLES = ['orders', 'alerts', 'telemetry', 'stock_events', 'faults', 'serial_logs', 'ad_machine_state'];
const MACHINE_ID_TABLES = ['machines'];
const OPERATOR_READABLE_ALL = ['ad_campaign', 'ad_campaign_performance', 'ads', 'ad_impression', 'loyalty', 'machine_config', 'role_permissions'];

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
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

async function allowedMachineIds(operatorId: string): Promise<string[]> {
  const url = SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(operatorId);
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r: any) => r.machine_id).filter(Boolean) : [];
}
function appendFilter(path: string, filter: string): string {
  return path + (path.includes('?') ? '&' : '?') + filter;
}

async function scopeGetPath(request: NextRequest, session: any): Promise<{ path?: string; block?: boolean; empty?: boolean }> {
  const rawPath = pathParam(request);
  if (rawPath.startsWith('/storage/')) {
    return session.role === 'super_admin' ? { path: rawPath } : { block: true };
  }
  const role = session.role;
  const sub = String(session.sub || '');
  const table = tableOf(rawPath);

  // Soft-deleted operators must never appear in any read, for any role
  // (a deleted staff member must not resurface in lists or be login-visible).
  const withDeletedFilter = (p: string) =>
    table === 'operators' ? appendFilter(p, 'deleted_at=is.null') : p;

  if (role === 'super_admin') return { path: withDeletedFilter(rawPath) };

  if (role === 'field_staff') {
    const FIELD_STAFF_READABLE = ['visits', 'machines'];
    if (!FIELD_STAFF_READABLE.includes(table)) return { block: true };
    if (table === 'visits') return { path: appendFilter(rawPath, 'staff_id=eq.' + encodeURIComponent(sub)) };
    return { path: rawPath };
  }

  if (role === 'operator') {
    if (table === 'operators') return { path: withDeletedFilter(appendFilter(rawPath, 'id=eq.' + encodeURIComponent(sub))) };
    if (table === 'machine_operators') return { path: appendFilter(rawPath, 'operator_id=eq.' + encodeURIComponent(sub)) };
    if (OPERATOR_READABLE_ALL.includes(table)) return { path: rawPath };
    if (MACHINE_ID_TABLES.includes(table) || MACHINE_SCOPED_TABLES.includes(table)) {
      const ids = await allowedMachineIds(sub);
      if (ids.length === 0) return { empty: true };
      const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
      if (MACHINE_ID_TABLES.includes(table)) return { path: appendFilter(rawPath, 'id=in.' + inList) };
      return { path: appendFilter(rawPath, 'machine_id=in.' + inList) };
    }
    return { block: true };
  }

  if (role === 'sub_operator') {
    const parentId = String(session.owner_id || '');
    if (!parentId) return { block: true };
    if (table === 'operators') return { path: withDeletedFilter(appendFilter(rawPath, 'id=eq.' + encodeURIComponent(sub))) };
    if (table === 'machine_operators') return { path: appendFilter(rawPath, 'operator_id=eq.' + encodeURIComponent(parentId)) };
    if (OPERATOR_READABLE_ALL.includes(table)) return { path: rawPath };
    if (MACHINE_ID_TABLES.includes(table) || MACHINE_SCOPED_TABLES.includes(table)) {
      const ids = await allowedMachineIds(parentId);
      if (ids.length === 0) return { empty: true };
      const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
      if (MACHINE_ID_TABLES.includes(table)) return { path: appendFilter(rawPath, 'id=in.' + inList) };
      return { path: appendFilter(rawPath, 'machine_id=in.' + inList) };
    }
    return { block: true };
  }
  return { block: true };
}

// ── GET: authenticated + tenant-scoped ──
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    const scoped = await scopeGetPath(request, session);
    if (scoped.block) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    if (scoped.empty) return NextResponse.json([], { headers: NO_STORE });
    const path = scoped.path!;
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
    const session = await getSession(request);
    const path = pathParam(request);
    const table = tableOf(path);
    const url = SB_URL + path;
    const body = await request.text();
    const res = await fetch(url, { method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body });
    const data = await res.json();
    if (res.ok && session) {
      const created = Array.isArray(data) ? data[0] : data;
      await logAudit({
        session,
        action: 'create',
        module: table,
        entity_table: table,
        entity_id: created && created.id ? String(created.id) : null,
        old_value: null,
        new_value: created ?? null,
        req: request,
      });
    }
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const blocked = await guardWrite(request, 'PATCH'); if (blocked) return blocked;
    const session = await getSession(request);
    const path = pathParam(request);
    const table = tableOf(path);
    const url = SB_URL + path;
    const body = await request.text();
    // Capture before-image for audit (best-effort; same filters as the update target).
    let before: any = null;
    try {
      const beforeRes = await fetch(SB_URL + path, { headers: sbHeaders() });
      if (beforeRes.ok) { const arr = await beforeRes.json(); before = Array.isArray(arr) ? arr : arr; }
    } catch { /* best-effort */ }
    const res = await fetch(url, { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }), body });
    const text = await res.text();
    if (res.ok && session) {
      let after: any = null;
      try { after = JSON.parse(text); } catch { after = null; }
      await logAudit({
        session,
        action: 'update',
        module: table,
        entity_table: table,
        entity_id: null,
        old_value: before,
        new_value: after,
        req: request,
      });
    }
    return new NextResponse(text, { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const blocked = await guardWrite(request, 'DELETE'); if (blocked) return blocked;
    const session = await getSession(request);
    const path = pathParam(request);
    const table = tableOf(path);

    // Capture before-image for audit.
    let before: any = null;
    try {
      const beforeRes = await fetch(SB_URL + path, { headers: sbHeaders() });
      if (beforeRes.ok) { const arr = await beforeRes.json(); before = Array.isArray(arr) ? arr : arr; }
    } catch { /* best-effort */ }

    // Soft-delete tables: translate DELETE into a PATCH that stamps deleted_at.
    if (SOFT_DELETE_TABLES.includes(table)) {
      const patchBody = JSON.stringify({
        deleted_at: new Date().toISOString(),
        updated_by: session ? String(session.sub) : null,
      });
      const res = await fetch(SB_URL + path, {
        method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }), body: patchBody,
      });
      if (res.ok && session) {
        await logAudit({
          session,
          action: 'delete',
          module: table,
          entity_table: table,
          entity_id: null,
          old_value: before,
          new_value: null,
          req: request,
        });
      }
      return new NextResponse(null, { status: res.ok ? 204 : res.status });
    }

    // Hard-delete for all other tables (join rows, ephemera).
    const url = SB_URL + path;
    const res = await fetch(url, { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) });
    if (res.ok && session) {
      await logAudit({
        session,
        action: 'delete',
        module: table,
        entity_table: table,
        entity_id: null,
        old_value: before,
        new_value: null,
        req: request,
      });
    }
    return new NextResponse(null, { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
