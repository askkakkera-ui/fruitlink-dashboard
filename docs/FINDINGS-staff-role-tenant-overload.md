# Findings — `role='staff'` tenant/scope overload

**Date:** 2026-07-23
**Classification:** Latent authorization hole. **Not an incident** — no cross-tenant write or control action occurred (see Audit).
**Reporter:** dashboard investigation (skkakkera@gmail.com, super_admin)
**Trigger:** `wh.flq@fruitlinq.com` reported "You do not service any machines" on Warehouse → Dispatch.

---

## 1. Root cause — one identifier, two meanings

`role='staff'` is overloaded. Across the codebase it simultaneously means:

1. **"Fruitlink internal"** — a member of the platform owner's own fleet-service team (`owner_id = 0c1bd083-682a-4913-ac37-08c85ef94b41`), entitled to fleet-wide scope; and
2. **"office-tier staff"** — an allowlisted account tier that passes the warehouse role gate (as opposed to `field_staff`, which does not).

These are different concepts, but they share one column value. There is **no notion of a tenant's own staff** in the model — nothing represents "Fruitlinq's warehouse worker" as a first-class role.

**How the boundary was crossed:** On 2026-07-22, `wh.flq@fruitlinq.com` was corrected `field_staff → staff/office` to fix an empty warehouse **item dropdown**. `field_staff` is excluded from the warehouse role gate (`warehouse/route.ts:43`), so it 403s and loads no items; `staff` is included, so the dropdown populated. That fix was aimed purely at meaning (2) — the office-tier allowlist. But because the same value also carries meaning (1), it silently granted **fleet-wide Fruitlink-internal scope** on every route that gates on `role` alone.

**The lesson:** a fix to one allowlist crossed a second, unrelated authorization boundary — because a single identifier carried two meanings and only one of them was being looked at. Any future `field_staff → staff` correction reopens this unless the two meanings are separated (a distinct tenant-staff role, or an explicit `owner_id === FRUITLINK_OWNER_ID` check everywhere meaning (1) is intended).

**Blast radius: exactly one row.** `wh.flq@fruitlinq.com` (id `8b3def85-7694-4a0e-aaf3-89ff00e211a5`, `owner_id b3a5c89d` = Fruitlinq, a tenant). All three other `role='staff'` accounts are Fruitlink-owned (`0c1bd083`). The "role=staff ⇒ Fruitlink" assumption held until wh.flq was created at 2026-07-22 12:39:37 UTC — a ~19h exposure window.

---

## 2. Role-only authorization gates (no `owner_id` check)

Every row below gates on `role` being `super_admin`/`staff` and applies **no tenant scoping**, so a `staff` account with a tenant `owner_id` receives fleet-wide reach. Ordered by fix priority (writes/control first, then read blast radius).

| # | Route:line | What it grants | R/W | Blast radius |
|---|---|---|---|---|
| 1 | `machine-control/route.ts:104` | `fault_clear` on any machine by SN | **W (control)** | Fleet-wide device control — highest. (`command` action at :66 is correctly super_admin-only.) |
| 2 | `notify-config/route.ts:34,117` | staff → `myOwnerId=null` (treated as super-admin): list all tenants, PATCH/POST `service_arrangement` (mode + notify numbers) for any machine | **W** | Cross-tenant config; also flips visit-alert routing (`visit/route.ts:67` adds Fruitlink's number on `fruitlink_service`) |
| 3 | `warehouse/route.ts:60,146,164,212` | dispatch machine list + dispatch POST guard on the `fruitlink_service` path | **R/W** | The reported symptom; fails closed (empty list) |
| 4 | `sb/route.ts:113` | fleet-wide READ on ~22 tables: `machines, orders, telemetry, alerts, faults, operators, visits, attendance, loyalty, ads, …` | **R** | Largest read surface; page-permissions are the only other gate |
| 5 | `alerts/route.ts:51` | fleet-wide alerts read (staff/super_admin skip the tenant scoping the else-branch applies) | **R** | All tenants' alerts |
| 6 | `visit/route.ts:114` | `?machines=1` returns the whole fleet's machines | **R** | All machines |
| 7 | `challan/route.ts:22` | generate/read a GST challan (delivery note) for any `sale_id` | **R** | Any sale, unscoped |

**Correctly scoped already (leave as-is / use as reference):**
- `attendance-internal/route.ts:19,44` — the canonical pattern (see §3).
- `attendance/route.ts:124` — staff scoped to their own `staff_id` (self only).
- `warehouse/route.ts:53` — the on-hand READ correctly scopes to `session.owner_id`. Note the asymmetry: same file, the dispatch list two lines later (`:60`) does not.

---

## 3. Fix order and the pattern

Fix in the priority order above (write/control blast radius first): **1 → 7.** These are defense-in-depth — after containment there is no reachable exploiter (§5), but each hole must be closed so the next mis-created account can't reopen it. **Do one at a time, diff stat each, re-verify before moving on.**

**Pattern to apply — `attendance-internal/route.ts:19,44`:**

```ts
// :19  a person is "internal" by role AND owner, never by role alone
const FRUITLINK_OWNER_ID = process.env.FRUITLINK_OWNER_ID || '0c1bd083-682a-4913-ac37-08c85ef94b41';
const INTERNAL_ROLES = ['super_admin', 'staff'];
// :44  resolve the internal set by role IN (...) AND owner_id = Fruitlink;
//      tenant staff (owner_id = a tenant) can never enter it
'/rest/v1/operators?select=id&role=in.(' + INTERNAL_ROLES.join(',') + ')&owner_id=eq.' + FRUITLINK_OWNER_ID
```

For each route: keep the role check, then require `session.owner_id === FRUITLINK_OWNER_ID` before granting the fleet-wide branch; otherwise fall through to tenant scoping keyed on `session.owner_id` (the pattern operator/sub_operator already use). Fail closed on a missing/empty owner.

The durable fix is to stop overloading the value — introduce a distinct tenant-staff role (so meaning (2), the office-tier warehouse allowlist, no longer implies meaning (1), Fruitlink-internal). Until then, the `owner_id === FRUITLINK_OWNER_ID` guard is the stopgap and must be applied at all 7 sites.

---

## 4. Session / JWT revocation gap

`role` (and `permissions`) are baked into the signed session JWT at login (`lib/session.ts:20` `signSession`, `login/route.ts:73`). `verifySession` (`lib/session.ts:28-33`) does a pure `jwtVerify` with **no DB re-read** and **no session/revocation table**. TTL is a **fixed 7 days from login** — `.setExpirationTime('7d')` is stamped at sign time and **nothing re-issues the token** (`middleware.ts` only `jwtVerify`s; `signSession`'s sole caller is `login/route.ts`), so it is *not* sliding. Any currently-valid token is therefore at most 7 days old (cookie `maxAge: 60*60*24*7`, `login:103`). Live-token exposure is bounded at ≤7 days absolute, not open-ended.

**Consequence:** a DB role change (or even a soft-delete — `deleted_at` is not checked per request) does **not** invalidate a live session. It takes effect only when a new token is minted (next login). There is **no per-user revocation mechanism.** The only levers to kill a live token are:
- cooperative logout / cookie clear, or
- rotating `SESSION_SECRET` — which invalidates **every** session platform-wide.

**Deliberate call taken (2026-07-23):** cooperative logout, **not** `SESSION_SECRET` rotation. Justification: audit was clean, no cross-tenant write in the ~19h window, the subject is a trusted tenant employee (not an attacker), and rotation would have logged out the operator's own in-progress session and the entire fleet. Because dispatch only begins working *after* the new token mints, wh.flq has direct incentive to actually re-login — so containment self-completes.

**Caveat for the record:** this was proportionate *only because* the audit was clean and the subject cooperative. A genuine incident — a hostile or unreachable account — would leave the blunt instrument (`SESSION_SECRET` rotation) as the **only** containment, with up to 7 days of live-token exposure otherwise. The absence of a per-user revoke (a session-version column checked on verify, or a deny-list) is itself a gap worth closing.

---

## 5. Audit findings and caveat

`audit_log` (actor_id = session.sub), window 2026-07-22 12:39 UTC → now:

- **wh.flq's only actions:** two `receive` movements (2026-07-23 04:31 & 04:32), both stock into **Fruitlinq's own** warehouse (`owner_id b3a5c89d`, note "ATON"). Legitimate, tenant-scoped. No dispatch, no fault_clear, no cross-tenant write.
- **`service_arrangement`:** unchanged — 5 rows, all `self_service`, all owned by Fruitlinq. No notify-config abuse (a flip would have left a `fruitlink_service` row or a foreign `owner_id`).
- **F1 (SN `9E3D050CEF2EEC7B`):** the only `fault_clear` in the window is the super_admin's own (2026-07-22 15:04:45 UTC, `fault_code 0x1000`). All three `fault_clear`s on record (16/17/22 Jul) are super_admin. **No accidental clear by wh.flq.** F1's mask is untouched.

**Caveat:** `logAudit` (`lib/audit.ts`) records **writes and control actions only** — `sb` and other **reads are not logged**. We can therefore prove no cross-tenant *write or control action*, but **cannot rule out a cross-tenant read** via `/api/sb` during the window. No data was modified. Read-side auditing is a gap.

---

## 6. Containment taken

1. **DB (done, 2026-07-23):** `UPDATE operators SET role='sub_operator' WHERE id='8b3def85-7694-4a0e-aaf3-89ff00e211a5';` — `owner_id b3a5c89d` and `staff_type=office` unchanged (`staff_type` is display-only; nothing gates on it).
2. **Session (in progress):** wh.flq asked to log out and back in. New token mints as `sub_operator`.

**Effect after re-login:**
- Fleet-wide `staff` reach (all 7 gates above) — removed; scoped to Fruitlinq.
- Warehouse **Receive** — retained (`route.ts:43` admits sub_operator; the `can_manage_warehouse` requirement at `:146` is staff-only; the permission row is `operator_id`-keyed and re-fetched at `login:40`).
- Warehouse **Dispatch** — now works. `route.ts:64-71` self_service branch: `tenantId = owner_id = b3a5c89d` → `machine_operators` (5 rows) ∩ `service_arrangement` self_service (5 rows) = **Fruitlinq's 5 machines**.

**Note for Fruitlinq:** tenant warehouse dispatch is a working code path reachable by any tenant-scoped role — this was a **role correction, not a feature build**.

---

## 7. Open items

- [ ] Route fixes #1–#7 (§3), one at a time, diff stat each. **Not yet started.**
- [ ] Consider a distinct tenant-staff role to end the `role='staff'` overload (durable fix vs. the `owner_id` stopgap).
- [ ] Consider per-user session revocation (session-version column checked on verify, or deny-list) to remove the 7-day live-token gap.
- [ ] Consider read-side audit coverage for `/api/sb` cross-tenant access.
