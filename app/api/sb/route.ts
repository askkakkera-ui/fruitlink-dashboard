import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { generateOperatorCode, bumpOperatorCodeSequence, existingOperatorCode, operatorCompanyName, isOperatorCodeCollision, sequenceOf } from '@/lib/operator-code';

// Refused at the two minting points only (POST role=operator, PATCH promoting a
// codeless row). A code built from a personal display name would be wrong on an
// invoice and is unfixable afterwards, so minting without a company name is not
// allowed to happen quietly.
const COMPANY_NAME_REQUIRED = 'Registered Company Name required to create/promote an operator';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';

// Write permissions now live in WRITE_RULES below (deny-by-default allowlist);
// operators/machines/machine_operators stay super_admin-only there.
const SOFT_DELETE_TABLES = ['operators'];
// Tables the browser-facing proxy must NEVER touch, for any role or method.
// machine_credentials holds device signing secrets: service-side only.
const PROXY_FORBIDDEN_TABLES = ['machine_credentials', 'machine_claim_codes'];

// ── Read scoping model ────────────────────────────────────────────────
// Tables that are scoped to an operator's own machines (by machine_id column).
const MACHINE_SCOPED_TABLES = ['orders', 'alerts', 'telemetry', 'stock_events', 'faults', 'serial_logs', 'ad_machine_state'];
// Tables scoped to the operator's own machine rows (by the machines.id column).
const MACHINE_ID_TABLES = ['machines'];
// Tables an operator may read fully (non-sensitive shared/reference data).
// `countries` is the country -> currency/timezone/tax lookup behind machineCurrency():
// four rows of public reference data, no tenant column, nothing to scope. Without it
// here the allowlist posture 403s every non-super-admin and every machine silently
// renders as INR, which is invisible today and wrong the day a ZA machine exists.
const OPERATOR_READABLE_ALL = ['ads', 'ad_impression', 'loyalty', 'machine_config', 'role_permissions', 'countries'];
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
  if (PROXY_FORBIDDEN_TABLES.includes(table)) return { block: true };
  const withDeletedFilter = (pp: string) => table === 'operators' ? appendFilter(pp, 'deleted_at=is.null') : pp;

  // super_admin: unrestricted read.
  if (role === 'super_admin') return { path: withDeletedFilter(rawPath) };

  // Fruitlink internal staff (mechanics, office): fleet-wide READ on operational tables.
  // They service/inspect the whole fleet. Page-level permissions gate WHICH sections
  // they can open; here we grant read on the data those sections need.
  if (role === 'staff') {
    const STAFF_READABLE = ['machines', 'orders', 'alerts', 'telemetry', 'stock_events', 'faults', 'fault_events', 'serial_logs', 'machine_commands', 'ad_machine_state', 'machine_config', 'operators', 'visits', 'attendance', 'ads', 'ad_campaign', 'ad_campaign_performance', 'ad_impression', 'loyalty', 'role_permissions', 'countries'];
    if (!STAFF_READABLE.includes(table)) return { block: true };
    // operators: never show soft-deleted staff
    return { path: withDeletedFilter(rawPath) };
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
    if (table === 'operators') return { path: withDeletedFilter(appendFilter(rawPath, 'id=eq.' + encodeURIComponent(sub))) };
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
    if (table === 'operators') return { path: withDeletedFilter(appendFilter(rawPath, 'id=eq.' + encodeURIComponent(sub))) };
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
    // PostgREST silently caps rows (db-max-rows) and returns 200. A `limit=`
    // above the cap is a request, not a promise: on 16 Jul a Reports PDF headed
    // 01 Jul silently began at 07 Jul - 185 orders and Rs 14,770 dropped, no
    // error. Forward Range/Prefer so callers can page, and echo Content-Range
    // so they can know the true total.
    const fwd: Record<string, string> = {};
    for (const h of ['range', 'range-unit', 'prefer']) {
      const v = request.headers.get(h);
      if (v) fwd[h] = v;
    }
    const res = await fetch(SB_URL + path, { headers: sbHeaders(fwd) });
    const data = await res.json();
    const out: Record<string, string> = { ...NO_STORE };
    const cr = res.headers.get('content-range');
    if (cr) out['Content-Range'] = cr;
    // Pass the real status through. This route previously returned 200 for a
    // PostgREST 400, so a failed query rendered as zero orders - identical to
    // a quiet day.
    return NextResponse.json(data, { status: res.status, headers: out });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// ── Write scoping model ───────────────────────────────────────────────
// Deny-by-default, mirroring scopeGetPath's allowlist posture. Before this,
// GET was allowlisted but WRITE was not: any authenticated operator /
// sub_operator / staff could POST/PATCH/DELETE any table by arbitrary id,
// including operator_permissions (self-grant -> privilege escalation at next
// login). A table absent from WRITE_RULES cannot be written here by anyone.
//
// Derived from the writes the dashboard actually performs today - see
// FIX2_sb_write_guard.md for the enumeration. Adding a table here opens a
// write surface: do it only alongside a row-scope rule.
type WriteRule = {
  methods: string[];         // methods permitted on this table
  roles: string[];           // roles permitted; everything else 403s
  allowUnfiltered?: boolean; // may PATCH/DELETE without targeting specific rows
};

const WRITE_RULES: Record<string, WriteRule> = {
  // Tenancy and fleet administration: super_admin only (unchanged).
  // OperatorsPage Add/Edit/Del + MyStaffSection, MachinesPage edit,
  // SettingsPage machine `state` writes, OperatorsPage machine assignment.
  operators: { methods: ['POST', 'PATCH', 'DELETE'], roles: ['super_admin'] },
  machines: { methods: ['POST', 'PATCH', 'DELETE'], roles: ['super_admin'] },
  machine_operators: { methods: ['POST', 'PATCH', 'DELETE'], roles: ['super_admin'] },
  // Ad campaigns: row scope enforced by the AD_OWNED_TABLES branch below
  // (ownership check, SN validation, forced operator_id, no self-approval).
  ad_campaign: { methods: ['POST', 'PATCH', 'DELETE'], roles: ['super_admin', 'operator', 'sub_operator'] },
  // Loyalty is keyed by customer phone and has NO tenant column, so it cannot
  // be row-scoped without a schema change. Kept writable by the roles that
  // write it today (LoyaltyPage is reachable via can_view_console) and treated
  // as a deliberately shared, fleet-global table. No DELETE: the page has no
  // delete action, and an unfiltered one would empty it.
  loyalty: { methods: ['POST', 'PATCH'], roles: ['super_admin', 'staff', 'operator', 'sub_operator'] },
  // Danger Zone "Clear All Alerts" is an intentional whole-table purge, so it
  // is the one write exempt from the row-filter rule - and now super_admin
  // only. The UI already only offered it to super_admin; the server did not.
  alerts: { methods: ['PATCH', 'DELETE'], roles: ['super_admin'], allowUnfiltered: true },
  // Legacy: no caller in the tree (visits go through /api/visit). Kept for any
  // untracked client, with staff_id stamped so one person cannot file another's.
  visits: { methods: ['POST'], roles: ['super_admin', 'field_staff'] },
};

// Never writable through this browser-facing proxy, by ANY role.
// operator_permissions is the privilege-escalation table: the only sanctioned
// path is /api/operator-permissions, which enforces the escalation ceiling
// (an operator cannot grant a permission they do not hold) and restricts the
// target to their own team. A write here would bypass both.
// ad_campaign_performance is system-written telemetry, read-only to everyone.
const WRITE_FORBIDDEN_TABLES = ['operator_permissions', 'ad_campaign_performance'];

// Does this path target specific rows, or the whole table? PostgREST treats a
// filterless PATCH/DELETE as "every row", so an unscoped one is a table wipe.
const PGRST_OPS = /^(eq|neq|gt|gte|lt|lte|like|ilike|match|imatch|in|is|isdistinct|fts|plfts|phfts|wfts|cs|cd|ov|sl|sr|nxr|nxl|adj|not)\./;
function hasRowFilter(path: string): boolean {
  const q = path.indexOf('?');
  if (q === -1) return false;
  const params = new URLSearchParams(path.slice(q + 1));
  for (const [key, value] of params.entries()) {
    if (key === 'or' || key === 'and') return true;
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(key)) continue;
    if (PGRST_OPS.test(value)) return true;
  }
  return false;
}

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
  const role = String(session.role || '');

  // ── Allowlist gate: table, method, role. Deny-by-default. ──
  // Runs before every table-specific rule below, so nothing reaches PostgREST
  // without first matching an explicit rule.
  if (!table) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (PROXY_FORBIDDEN_TABLES.includes(table)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (WRITE_FORBIDDEN_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Forbidden: not writable through this proxy' }, { status: 403 });
  }
  const rule = WRITE_RULES[table];
  if (!rule) return NextResponse.json({ error: 'Forbidden: table not writable' }, { status: 403 });
  if (!rule.methods.includes(method)) {
    return NextResponse.json({ error: 'Forbidden: method not allowed on ' + table }, { status: 403 });
  }
  if (!rule.roles.includes(role)) {
    return NextResponse.json({ error: 'Forbidden: your role may not write ' + table }, { status: 403 });
  }
  // A filterless PATCH/DELETE hits every row. Only `alerts` opts into that.
  if ((method === 'PATCH' || method === 'DELETE') && !rule.allowUnfiltered && !hasRowFilter(rawPath)) {
    return NextResponse.json({ error: 'Forbidden: ' + method + ' must target specific rows' }, { status: 403 });
  }

  // ── visits: stamp the author, so a session cannot file someone else's visit ──
  if (table === 'visits' && method === 'POST') {
    let body: any = {};
    try { body = JSON.parse(await request.clone().text() || '{}'); } catch { body = {}; }
    const stamp = (r: any) => ({ ...r, staff_id: String(session.sub || '') });
    const stamped = Array.isArray(body) ? body.map(stamp) : stamp(body);
    return { rewriteBody: JSON.stringify(stamped) } as any;
  }

  // ── Ad campaigns: operator-scoped writes (super_admin unrestricted) ──
  if (AD_OWNED_TABLES.includes(table) && role !== 'super_admin') {
    // Only operators / sub_operators with the can_manage_ads permission.
    // (The allowlist has already refused every other non-super_admin role.)
    const perms = session.permissions || {};
    if (perms.can_manage_ads !== true) {
      return NextResponse.json({ error: 'Forbidden: ad management not permitted' }, { status: 403 });
    }
    // The operator whose ads these are: self for operator, parent for sub_operator.
    const ownerOpId = role === 'sub_operator'
      ? String(session.owner_id || session.parent_id || '')
      : String(session.sub || '');
    if (!ownerOpId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  // ── operators: stamp operator_code server-side ──
  // Reached only by super_admin (WRITE_RULES above). Two jobs:
  //   1. strip any client-supplied operator_code — the code is ours to issue,
  //      and it is the reference a future payment integration will verify
  //      against, so a client must never be able to name or change it;
  //   2. issue one for role='operator' rows that have none, both at creation
  //      and at the pending -> operator promotion (approving a signup is just a
  //      role edit through this same PATCH — there is no separate approve route).
  // Team members (sub_operator / field_staff / staff) never get a code.
  if (table === 'operators' && (method === 'POST' || method === 'PATCH')) {
    let body: any = {};
    try { body = JSON.parse(await request.clone().text() || '{}'); } catch { body = {}; }

    const rows: any[] = Array.isArray(body) ? body : [body];
    let issued = 0; // keeps a multi-row insert from reusing one sequence

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      delete row.operator_code;

      if (method === 'POST') {
        if (row.role === 'operator') {
          const company = String(row.company_name || '').trim();
          if (!company) return NextResponse.json({ error: COMPANY_NAME_REQUIRED }, { status: 422 });
          row.operator_code = await generateOperatorCode(company, issued);
          issued = sequenceOf(row.operator_code);
        }
        continue;
      }

      // PATCH: only act when this edit lands the row on role='operator'. A body
      // without `role` isn't a promotion, so it's left alone.
      if (row.role !== 'operator') continue;
      const targetId = idEqOf(rawPath);
      if (!targetId) continue;
      // Never overwrite a code that already exists — it may already be printed
      // on an invoice.
      if (await existingOperatorCode(targetId)) continue;
      // Past this point the row has no code, so this PATCH is a minting event.
      // (A row that already has one returned above: codes are frozen once
      // issued, and a later edit must not re-derive or re-check anything.)
      //
      // Prefer what this edit is setting — approving a signup is the super_admin
      // filling in the company name on the same form that flips the role, so the
      // body holds the newer value; otherwise use the stored one.
      const company = String(row.company_name || '').trim() || (await operatorCompanyName(targetId)).trim();
      if (!company) return NextResponse.json({ error: COMPANY_NAME_REQUIRED }, { status: 422 });
      row.operator_code = await generateOperatorCode(company, issued);
      issued = sequenceOf(row.operator_code);
    }

    return { rewriteBody: JSON.stringify(body) } as any;
  }

  // ── operators DELETE: protect self + the last super_admin (server-enforced) ──
  // These invariants must hold even for a hand-crafted request, not just when the
  // UI hides the button. Evaluate the rows this DELETE actually matches (same
  // filter, non-deleted), never trusting the client. Reached only by super_admin
  // (WRITE_RULES) and only with a row filter (unfiltered DELETE already blocked).
  if (table === 'operators' && method === 'DELETE') {
    const listUrl = SB_URL + rawPath + (rawPath.includes('?') ? '&' : '?') + 'select=id,role&deleted_at=is.null';
    let targets: any[] = [];
    try { const tr = await fetch(listUrl, { headers: sbHeaders() }); if (tr.ok) targets = await tr.json(); } catch { targets = []; }
    if (!Array.isArray(targets)) targets = [];
    // 1) Never remove your own account while logged in.
    if (targets.some((r: any) => String(r.id) === String(session.sub || ''))) {
      return NextResponse.json({ error: 'You cannot remove your own account while logged in.' }, { status: 403 });
    }
    // 2) At least one super_admin must always remain.
    const deletingSupers = targets.filter((r: any) => String(r.role) === 'super_admin').length;
    if (deletingSupers > 0) {
      let liveSupers = 0;
      try {
        const cr = await fetch(SB_URL + '/rest/v1/operators?select=id&role=eq.super_admin&deleted_at=is.null', { headers: sbHeaders() });
        if (cr.ok) { const rows = await cr.json(); liveSupers = Array.isArray(rows) ? rows.length : 0; }
      } catch { liveSupers = 0; }
      if (liveSupers - deletingSupers < 1) {
        return NextResponse.json({ error: 'Cannot remove the last Super Admin — at least one must remain.' }, { status: 403 });
      }
    }
    return null;
  }

  // The allowlist above already enforced what the old trailing rules did:
  // operators/machines/machine_operators are super_admin-only via WRITE_RULES,
  // and field_staff appears in no rule except visits POST.
  return null;
}

// A racing insert can take the sequence we just picked; the unique constraint
// catches it. Re-generate above the taken number and retry.
const CODE_RETRIES = 3;
async function sendWithCodeRetry(
  url: string, method: 'POST' | 'PATCH', headers: Record<string, string>, body: string, table: string,
): Promise<{ res: Response; text: string }> {
  let res = await fetch(url, { method, headers, body });
  let text = await res.text();
  if (table !== 'operators') return { res, text };

  for (let i = 0; i < CODE_RETRIES && isOperatorCodeCollision(res.status, text); i++) {
    let parsed: any;
    try { parsed = JSON.parse(body); } catch { break; }
    const rows: any[] = Array.isArray(parsed) ? parsed : [parsed];
    let bumped = false;
    for (const row of rows) {
      if (!row || !row.operator_code) continue;
      row.operator_code = await bumpOperatorCodeSequence(row.operator_code);
      bumped = true;
    }
    if (!bumped) break;
    body = JSON.stringify(parsed);
    res = await fetch(url, { method, headers, body });
    text = await res.text();
  }
  return { res, text };
}

export async function POST(request: NextRequest) {
  try {
    const g = await guardWrite(request, 'POST');
    if (g instanceof NextResponse) return g;
    const session = await getSession(request);
    const path = pathParam(request);
    const table = tableOf(path);
    const url = SB_URL + path;
    const body = (g && (g as any).rewriteBody) ? (g as any).rewriteBody : await request.text();
    const { res, text } = await sendWithCodeRetry(url, 'POST', sbHeaders({ Prefer: 'return=representation' }), body, table);
    let data: any;
    try { data = JSON.parse(text); } catch { data = null; }
    if (res.ok && session) {
      const created = Array.isArray(data) ? data[0] : data;
      await logAudit({ session, action: 'create', module: table, entity_table: table, entity_id: created && created.id ? String(created.id) : null, old_value: null, new_value: created ?? null, req: request });
    }
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const g = await guardWrite(request, 'PATCH');
    if (g instanceof NextResponse) return g;
    const session = await getSession(request);
    const path = pathParam(request);
    const table = tableOf(path);
    const url = SB_URL + path;
    const body = (g && (g as any).rewriteBody) ? (g as any).rewriteBody : await request.text();
    let before: any = null;
    try { const br = await fetch(SB_URL + path, { headers: sbHeaders() }); if (br.ok) { before = await br.json(); } } catch { /* best-effort */ }
    const { res, text } = await sendWithCodeRetry(url, 'PATCH', sbHeaders({ Prefer: 'return=representation' }), body, table);
    if (res.ok && session) {
      let after: any = null;
      try { after = JSON.parse(text); } catch { after = null; }
      await logAudit({ session, action: 'update', module: table, entity_table: table, entity_id: null, old_value: before, new_value: after, req: request });
    }
    return new NextResponse(text, { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const g = await guardWrite(request, 'DELETE');
    if (g instanceof NextResponse) return g;
    const session = await getSession(request);
    const path = pathParam(request);
    const table = tableOf(path);
    let before: any = null;
    try { const br = await fetch(SB_URL + path, { headers: sbHeaders() }); if (br.ok) { before = await br.json(); } } catch { /* best-effort */ }
    if (SOFT_DELETE_TABLES.includes(table)) {
      const patchBody = JSON.stringify({ deleted_at: new Date().toISOString(), updated_by: session ? String(session.sub) : null });
      const res = await fetch(SB_URL + path, { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }), body: patchBody });
      if (res.ok && session) {
        await logAudit({ session, action: 'delete', module: table, entity_table: table, entity_id: null, old_value: before, new_value: null, req: request });
      }
      return new NextResponse(null, { status: res.ok ? 204 : res.status });
    }
    const url = SB_URL + path;
    const res = await fetch(url, { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) });
    if (res.ok && session) {
      await logAudit({ session, action: 'delete', module: table, entity_table: table, entity_id: null, old_value: before, new_value: null, req: request });
    }
    return new NextResponse(null, { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
