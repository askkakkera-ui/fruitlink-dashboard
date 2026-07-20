// ─── Operator grouping (Tier 1: DATA) ───────────────────────────────────
// Pure, presentation-free transform. Takes the flat operators list exactly as
// /api/sb returns it for a super_admin (unrestricted read) and derives the
// tenant structure the redesigned OperatorsPage renders:
//   • internal team  — super_admin + staff, pinned on top, NO operator_code
//   • one card PER TENANT (role='operator') carrying operator_code +
//     payment_verified, with its sub_operators + field_staff nested under it,
//     matched to the tenant by owner_id (never hand-built).
//
// Isolation note: this runs ONLY in the super_admin OperatorsPage, which the
// server already lets a super_admin read in full. The operator-facing view
// (MyTeamPage) does NOT use this — it consumes /api/my-team, which scopes to a
// single owner_id server-side. Grouping here never widens anyone's data access.

export type Role = 'super_admin' | 'staff' | 'operator' | 'sub_operator' | 'field_staff';

// The columns Tier 1 relies on. The real rows carry more (billing, plan, …);
// this is intentionally a loose superset so the transform never drops fields.
export interface OperatorRow {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role | string;
  owner_id?: string | null;
  operator_code?: string | null;
  payment_verified?: boolean | null;
  [k: string]: any;
}

export interface TenantGroup {
  tenant: OperatorRow;        // the role='operator' row — carries the code/badge
  sub_operators: OperatorRow[];
  field_staff: OperatorRow[];
}

export interface GroupedOperators {
  internal: OperatorRow[];    // super_admin + staff, pinned top (no code)
  tenants: TenantGroup[];     // one per operator, in input order
  // People whose owner_id points at no operator in the list (e.g. the parent
  // was soft-deleted, or bad data). Surfaced, never silently hidden — a leak or
  // a dangling row must be visible, not swallowed.
  orphans: OperatorRow[];
  counts: {
    internal: number;
    tenants: number;
    sub_operators: number;
    field_staff: number;
    orphans: number;
  };
}

const INTERNAL_ROLES = new Set(['super_admin', 'staff']);

/**
 * Group a flat operators list into internal team + per-tenant cards.
 * Order within each bucket is preserved from the input, so the caller controls
 * sort purely through the fetch's `order=` param (today: created_at.desc).
 */
export function groupOperatorsByTenant(rows: OperatorRow[]): GroupedOperators {
  const list = Array.isArray(rows) ? rows : [];

  const internal: OperatorRow[] = [];
  const tenantRows: OperatorRow[] = [];
  const children: OperatorRow[] = []; // sub_operator + field_staff

  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const role = String(r.role || '');
    if (INTERNAL_ROLES.has(role)) internal.push(r);
    else if (role === 'operator') tenantRows.push(r);
    else if (role === 'sub_operator' || role === 'field_staff') children.push(r);
    // Any unknown role is ignored here rather than mis-placed; it would surface
    // in a DB audit, not on a tenant card.
  }

  // Index tenants by id so children attach in one pass (no N² scan).
  const groupById = new Map<string, TenantGroup>();
  const tenants: TenantGroup[] = tenantRows.map((tenant) => {
    const g: TenantGroup = { tenant, sub_operators: [], field_staff: [] };
    groupById.set(String(tenant.id), g);
    return g;
  });

  const orphans: OperatorRow[] = [];
  for (const c of children) {
    const g = c.owner_id != null ? groupById.get(String(c.owner_id)) : undefined;
    if (!g) { orphans.push(c); continue; }
    if (String(c.role) === 'sub_operator') g.sub_operators.push(c);
    else g.field_staff.push(c);
  }

  return {
    internal,
    tenants,
    orphans,
    counts: {
      internal: internal.length,
      tenants: tenants.length,
      sub_operators: tenants.reduce((n, g) => n + g.sub_operators.length, 0),
      field_staff: tenants.reduce((n, g) => n + g.field_staff.length, 0),
      orphans: orphans.length,
    },
  };
}
