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
const OPERATOR_READABLE_ALL = ['ads', 'ad_impression', 'loyalty', 'machine_config', 'role_permissions'];
// Ad tables are operator-scoped by ad_campaign.operator_id (see scopeGetPath / guardWrite).
const AD_OWNED_TABLES = ['ad_campaign', 'ad_campaign_performance'];
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

  // Fruitlink internal staff (mechanics, office): fleet-wide READ on operational tables.
  // They service/inspect the whole fleet. Page-level permissions gate WHICH sections
  // they can open; here we grant read on the data those sections need.
  if (role === 'staff') {
    const STAFF_READABLE = ['machines', 'orders', 'alerts', 'telemetry', 'stock_events', 'faults', 'fault_events', 'serial_logs', 'machine_commands', 'ad_machine_state', 'machine_config', 'operators', 'visits', 'attendance', 'ads', 'ad_campaign', 'ad_campaign_performance', 'ad_impression', 'loyalty', 'role_permissions'];
    if (!STAFF_READABLE.includes(table)) return { block: true };
    // operators table: staff see the fleet's operators list (read-only, for names)
    return { path: rawPath };
  }

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
    // ad tables: operators see only their OWN campaigns (by operator_id).
    if (AD_OWNED_TABLES.includes(table)) {
      return { path: appendFilter(rawPath, 'operator_id=eq.' + encodeURIComponent(sub)) };
    }
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

  // sub_operator: same as operator but scoped to parent operator's machines
  if (role === 'sub_operator') {
    const parentId = String(session.owner_id || '');
    if (!parentId) return { block: true };
    if (table === 'operators') return { path: appendFilter(rawPath, 'id=eq.' + encodeURIComponent(sub)) };
    if (table === 'machine_operators') return { path: appendFilter(rawPath, 'operator_id=eq.' + encodeURIComponent(parentId)) };
    // ad tables: sub-operators see the parent operator's campaigns.
    if (AD_OWNED_TABLES.includes(table)) {
      return { path: appendFilter(rawPath, 'operator_id=eq.' + encodeURIComponent(parentId)) };
    }
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

// Resolve the SNs (not ids) a given operator is allowed to target, for ad
// machine_sns validation. Joins machine_operators -> machines.sn server-side.
async function allowedMachineSns(operatorId: string): Promise<string[]> {
  const ids = await allowedMachineIds(operatorId);
  if (ids.length === 0) return [];
  const inList = '(' + ids.map(encodeURIComponent).join(',') + ')';
  const url = SB_URL + '/rest/v1/machines?select=sn&id=in.' + inList;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r: any) => r.sn).filter(Boolean) : [];
}

// Fetch a campaign's owner (operator_id) by id, to authorise edits/deletes.
async function campaignOwner(campaignId: string): Promise<string | null> {
  const url = SB_URL + '/rest/v1/ad_campaign?select=operator_id&id=eq.' + encodeURIComponent(campaignId) + '&limit=1';
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? String(rows[0].operator_id || '') : null;
}

// Pull the id from a PostgREST filter like ?id=eq.<uuid> (used for PATCH/DELETE).
function idEqOf(path: string): string {
  const m = path.match(/[?&]id=eq\.([^&]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function guardWrite(request: NextRequest, method: string) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rawPath = pathParam(request);
  const table = tableOf(rawPath);

  // ── Ad campaigns: operator-scoped writes (super_admin unrestricted) ──
  if (AD_OWNED_TABLES.includes(table) && session.role !== 'super_admin') {
    // Only operators / sub_operators with the can_manage_ads permission.
    const role = session.role;
    if (role !== 'operator' && role !== 'sub_operator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const perms = session.permissions || {};
    if (perms.can_manage_ads !== true) {
      return NextResponse.json({ error: 'Forbidden: ad management not permitted' }, { status: 403 });
    }
    // The operator whose ads these are: self for operator, parent for sub_operator.
    const ownerOpId = role === 'sub_operator'
      ? String(session.owner_id || session.parent_id || '')
      : String(session.sub || '');
    if (!ownerOpId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // ad_campaign_performance is read-only for operators (written by the system).
    if (table === 'ad_campaign_performance') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // On edit/delete: the target campaign must belong to this operator.
    if (method === 'PATCH' || method === 'DELETE') {
      const cid = idEqOf(rawPath);
      if (!cid) return NextResponse.json({ error: 'Forbidden: campaign id required' }, { status: 403 });
      const owner = await campaignOwner(cid);
      if (owner === null || owner !== ownerOpId) {
        return NextResponse.json({ error: 'Forbidden: not your campaign' }, { status: 403 });
      }
    }

    // On create/edit: validate the body — stamp operator_id, and ensure every
    // targeted machine SN belongs to this operator.
    if (method === 'POST' || method === 'PATCH') {
      let body: any = {};
      try { body = JSON.parse(await request.clone().text() || '{}'); } catch { body = {}; }
      // machine targeting check
      const sns: string[] = Array.isArray(body.machine_sns) ? body.machine_sns.map(String) : [];
      if (sns.length > 0) {
        const allowed = new Set(await allowedMachineSns(ownerOpId));
        const bad = sns.filter((s) => !allowed.has(s));
        if (bad.length > 0) {
          return NextResponse.json({ error: 'Forbidden: machines not yours', machines: bad }, { status: 403 });
        }
      }
      // Force operator_id to the correct owner (ignore any client-supplied value).
      body.operator_id = ownerOpId;
      // Operators may never self-approve third-party ads; approval stays server/DB-driven.
      if ('approval' in body && body.approval === 'approved') delete body.approval;
      // Rewrite the request body with the sanitised version.
      return { rewriteBody: JSON.stringify(body) } as any;
    }
    return null;
  }

  // ── Existing rules ──
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
    const g = await guardWrite(request, 'POST');
    if (g instanceof NextResponse) return g;
    const url = SB_URL + pathParam(request);
    const body = (g && (g as any).rewriteBody) ? (g as any).rewriteBody : await request.text();
    const res = await fetch(url, { method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const g = await guardWrite(request, 'PATCH');
    if (g instanceof NextResponse) return g;
    const url = SB_URL + pathParam(request);
    const body = (g && (g as any).rewriteBody) ? (g as any).rewriteBody : await request.text();
    const res = await fetch(url, { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }), body });
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const g = await guardWrite(request, 'DELETE');
    if (g instanceof NextResponse) return g;
    const url = SB_URL + pathParam(request);
    const res = await fetch(url, { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) });
    return new NextResponse(null, { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
