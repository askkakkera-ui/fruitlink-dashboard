// ── Plan entitlements ─────────────────────────────────────────────────
// What an operator is allowed to do is a property of their plan row, never a
// number written into code. Two things combine:
//
//   plans          — one row per plan code (starter / professional / …), the
//                    defaults every operator on that plan inherits.
//   operators.*_override — a per-operator escape hatch the super admin sets
//                    when someone negotiates something off-plan.
//
// effective limit = override ?? plan default, and null at either level means
// UNLIMITED, not zero. 0 is a real limit (blocks everything) and must survive
// the ?? — hence ?? and not ||.
//
// The plans table is reference data: a handful of rows that change about never,
// read on every team write. Cached at module scope with a short TTL and
// de-duplicated while in flight, the same shape as the countries/currencies
// lookup on the client.

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const sbH = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json', ...extra,
});

export type Plan = {
  code: string;
  max_field_staff: number | null;   // null = unlimited
  max_sub_operators: number | null; // null = unlimited
  has_ad_manager: boolean;
  has_loyalty: boolean;
  has_team_management: boolean;
  has_rest_api: boolean;
  has_sso: boolean;
  rank: number | null;
};

export const PLAN_FEATURE_KEYS = [
  'has_ad_manager', 'has_loyalty', 'has_team_management', 'has_rest_api', 'has_sso',
] as const;
export type PlanFeature = typeof PLAN_FEATURE_KEYS[number];

export type Entitlements = {
  plan_code: string | null;
  // Plan defaults, so the UI can say "blank = plan default (unlimited)".
  plan_field_staff_limit: number | null;
  plan_sub_operator_limit: number | null;
  // What actually applies: override ?? plan default. null = unlimited.
  field_staff_limit: number | null;
  sub_operator_limit: number | null;
  field_staff_override: number | null;
  sub_operator_override: number | null;
  has_ad_manager: boolean;
  has_loyalty: boolean;
  has_team_management: boolean;
  has_rest_api: boolean;
  has_sso: boolean;
};

let _cache: Record<string, Plan> | null = null;
let _cachedAt = 0;
let _inFlight: Promise<Record<string, Plan>> | null = null;
const TTL_MS = 5 * 60 * 1000;

const toLimit = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null; // null = unlimited
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function normalisePlan(row: any): Plan {
  return {
    code: String(row.code || ''),
    max_field_staff: toLimit(row.max_field_staff),
    max_sub_operators: toLimit(row.max_sub_operators),
    has_ad_manager: row.has_ad_manager === true,
    has_loyalty: row.has_loyalty === true,
    has_team_management: row.has_team_management === true,
    has_rest_api: row.has_rest_api === true,
    has_sso: row.has_sso === true,
    rank: toLimit(row.rank),
  };
}

// Every plan, keyed by code. Never throws: an unreadable plans table returns {}
// and every caller then falls through to the no-plan branch of
// resolveEntitlements, which grants no features. Failing closed on a feature
// flag hides a button; failing open would hand out entitlements nobody paid for.
export async function fetchPlans(force = false): Promise<Record<string, Plan>> {
  if (!force && _cache && Date.now() - _cachedAt < TTL_MS) return _cache;
  if (_inFlight) return _inFlight;
  _inFlight = (async () => {
    try {
      const res = await fetch(SB_URL + '/rest/v1/plans?select=*&order=rank.asc', { headers: sbH() });
      if (!res.ok) throw new Error('plans: HTTP ' + res.status);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error('plans: non-array response');
      const map: Record<string, Plan> = {};
      for (const r of rows) {
        const p = normalisePlan(r);
        if (p.code) map[p.code] = p;
      }
      _cache = map;
      _cachedAt = Date.now();
      return map;
    } catch (e) {
      console.error('[entitlements] could not read plans', e);
      // Deliberately not cached: the next call retries rather than freezing the
      // failure in for the life of the lambda.
      return _cache || {};
    } finally {
      _inFlight = null;
    }
  })();
  return _inFlight;
}

export async function listPlans(): Promise<Plan[]> {
  const map = await fetchPlans();
  return Object.values(map).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.code.localeCompare(b.code));
}

// An operator row (needs: plan, max_field_staff_override, max_sub_operators_override)
// plus the plans map -> what they may actually do.
export function resolveEntitlements(operator: any, plans: Record<string, Plan>): Entitlements {
  const code = operator?.plan ? String(operator.plan) : null;
  const plan = code ? plans[code] : undefined;
  const fsOverride = toLimit(operator?.max_field_staff_override);
  const soOverride = toLimit(operator?.max_sub_operators_override);
  const planFs = plan ? plan.max_field_staff : null;
  const planSo = plan ? plan.max_sub_operators : null;
  return {
    plan_code: code,
    plan_field_staff_limit: planFs,
    plan_sub_operator_limit: planSo,
    // ?? not ||: an override of 0 means "none allowed", not "fall back".
    field_staff_limit: fsOverride ?? planFs,
    sub_operator_limit: soOverride ?? planSo,
    field_staff_override: fsOverride,
    sub_operator_override: soOverride,
    has_ad_manager: plan?.has_ad_manager === true,
    has_loyalty: plan?.has_loyalty === true,
    has_team_management: plan?.has_team_management === true,
    has_rest_api: plan?.has_rest_api === true,
    has_sso: plan?.has_sso === true,
  };
}

// Load one operator's row and resolve their entitlements. Returns null when the
// operator does not exist (or is soft-deleted), so callers can 404/403.
export async function loadEntitlements(operatorId: string): Promise<{ operator: any; entitlements: Entitlements } | null> {
  const [opRes, plans] = await Promise.all([
    fetch(
      SB_URL + '/rest/v1/operators?select=id,name,email,role,plan,max_field_staff_override,max_sub_operators_override' +
      '&id=eq.' + encodeURIComponent(operatorId) + '&deleted_at=is.null&limit=1',
      { headers: sbH() }
    ),
    fetchPlans(),
  ]);
  if (!opRes.ok) return null;
  const rows = await opRes.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  return { operator: rows[0], entitlements: resolveEntitlements(rows[0], plans) };
}

// How many live team members of each role this operator already has. Soft-deleted
// rows do not count against a limit — the seat is free again.
export async function countTeam(operatorId: string): Promise<{ field_staff: number; sub_operators: number }> {
  const res = await fetch(
    SB_URL + '/rest/v1/operators?select=id,role&owner_id=eq.' + encodeURIComponent(operatorId) +
    '&deleted_at=is.null&role=in.(field_staff,sub_operator)',
    { headers: sbH() }
  );
  if (!res.ok) return { field_staff: 0, sub_operators: 0 };
  const rows = await res.json();
  const list = Array.isArray(rows) ? rows : [];
  return {
    field_staff: list.filter((r: any) => r.role === 'field_staff').length,
    sub_operators: list.filter((r: any) => r.role === 'sub_operator').length,
  };
}

// true when `used` has reached an effective limit. A null limit is unlimited.
export function atLimit(used: number, limit: number | null): boolean {
  return limit !== null && used >= limit;
}

// The one sentence the user sees when they are blocked. Kept here so the API
// and the UI cannot drift apart on the wording or on the number.
export function limitMessage(kind: 'field staff' | 'sub-operator', limit: number | null): string {
  return `You've reached your ${kind} limit (${limit ?? '—'}). Contact Fruitlink to increase it.`;
}
