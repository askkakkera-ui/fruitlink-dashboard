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

## 7. field_staff on the dashboard: Machine List = 0 (not a data-path bug)

**Symptom:** Fruitlinq field_staff (Ashok, Sai Kiran) see Machine List 0/0/0 and Console tiles 0 on the dashboard — even after a fresh PWA install + login with a correct `owner_id` in the token. Stale-session was ruled out.

**Root — verified live with minted tokens, not inference:** `/api/machines:48-49` returns `[]` for any role that isn't super_admin/operator/sub_operator, re-derived from the **JWT** (`:26-27` strips the client `id` filter; `:31` keys on JWT role). The 5 machines are owned by `machine_operators.operator_id = b3a5c89d` (the **operator** account).

| Token | `/api/machines` | note |
|---|---|---|
| operator `b3a5c89d` (owns the 5) | **5** | even with `&id=eq.none` — server ignores the client filter |
| field_staff Ashok | **0** | even with the real machine ids in the query |
| field_staff Ashok → `/api/visit?machines=1` | **5** | check-in path is owner-scoped (`visit/route.ts:141-146`) |

So **the account seeing 0 does not own the machines** — the operator account sees all 5. This is the `cec8b13` routing consequence (field_staff dropped into a dashboard section that returns `[]` for their role), not a broken tenant data path.

**Cosmetic amplifier:** dashboard identity + scoping read client-writable, non-httpOnly cookies — `dashboard.tsx:138` `fl_role || 'operator'`, `:139` `fl_operator_name || 'Admin'`, `:140` `fl_operator_id || ''`. On a fresh PWA where those cookies don't persist, a field_staff session renders as operator **"Admin"** with a My Team + Settings nav and 0 machines — mislabeling the account. No data leak (server re-derives from the JWT), but "Admin" is a fallback string, not an account.

## 8. Loading visits accept null orange counts (data-integrity gap)

**No validation, client or server.** `visit/route.ts:253` stores `oranges_loaded = null` when blank; client `visit/page.tsx:445-446` omits it when empty; Submit (`:770`) is gated only on `busy`. Photo is the only hard requirement (`:234`). Worse, a loading visit can be submitted **fully blank** (no oranges, no consumables, no note — photo + GPS only): two such exist on F4 (10 Jul 13:06, 17 Jul 08:05), each minutes-to-an-hour before a real load at the same spot — the shape of an accidental first submit. So there is a **second gap**: no minimum-content check.

**F4 data (`sn 3A6C8FFB69`, as of 23 Jul):** 5 of 51 loading visits have `oranges_loaded` NULL, all F4, 2026-07-10 → 2026-07-23. Content, not count, is the story:
- 10 Jul 13:09 — *"Filled 88c 2 boxes"*, consumables present → **one genuine uncounted load ≈ 176** (count in the note, field blank).
- 10 Jul 13:06 & 17 Jul 08:05 — blank everything → accidental/empty submits (~0).
- 10 Jul 14:04 & 23 Jul 07:43 — `{straws:20}` only → consumables restock or uncounted; ambiguous (~0 each).

**Arithmetic — corrects the "5 × ~90 ≈ 450" reading:** confirmed uncounted ≈ **176** (one load); at most ~350 if both straws-only rows were real loads. F4's gap is ~519 (reads −349 while physically holding ~170). So these visits are a **real, previously-unknown contributor (~⅓, at most ~⅔) — NOT the primary cause.** The stock model's OPC 5-vs-4 over-consumption and dispatch-vs-rack factors remain in play. Reconciling −349 needs a **physical recount at F4** (Ashok), not a query. See `Fruitlink_Stock_Model_16Jul.md` (UPDATE 23 Jul) — the two docs are kept in agreement on ~176.

## 9. Open items

- [ ] Route fixes (§3, the 7 role-without-owner_id sites + the 3 in §10), one at a time, diff stat each. **#1 (`machine-control` fault_clear) done.**
- [ ] **TRACKED — visit-form validation (two fixes, §8):** (a) require an orange count when `visit_type='loading'`; (b) reject fully-blank visits (minimum-content check). Corollary: give load-count and absolute calibration-count a **structured field**, so the true number stops landing in free-text notes (see stock-model doc UPDATE 23 Jul — it has happened twice on F4).
- [ ] **§7 — give field_staff a Visit/check-in entry** in the dashboard, or don't route them off `/visit` (the `cec8b13` regression).
- [ ] **TRACKED — no self-service password rotation (§13):** no authenticated change-password form exists anywhere; the only reset path is the token-gated email flow, which is dead while the Resend key is invalid. Restore the Resend key **or** build `/api/change-password` + a form. Until then no user can privately rotate their own password.
- [ ] **FIELD TASK — not code:** Ashok physically recounts F4 on-site, then a calibration row. This is the **blocking input** for the F4 / −349 reconciliation; no query or code change can produce it. Flagged so it doesn't sit waiting on a coding session that can't do it. (~176 of the ~519 is accounted for by null-load visits; the rest needs the recount.)
- [ ] Consider a distinct tenant-staff role to end the `role='staff'` overload (durable fix vs. the `owner_id` stopgap).
- [ ] Consider per-user session revocation (session-version column checked on verify, or deny-list) to remove the 7-day live-token gap.
- [ ] Consider read-side audit coverage for `/api/sb` cross-tenant access.

## 10. Wider role-without-owner_id net — 3 more sites (beyond the original 7)

Found by sweep, cross-checked; the original 7 are §2/§3. **Staged, not fixed.**

| Sev | Site | Condition | Impact |
|---|---|---|---|
| **High — tenant-exploitable today** | `locations/route.ts:141→162` (PATCH) — *verified* | ownership/permission checked only for `role==='operator'`; `sub_operator` + `staff` fall through unscoped | edit **any** tenant's location by id — name/address/**lat/lng/geofence/is_office**. Geofence feeds `/api/attendance/verify-gps`. `sub_operator` is always tenant-owned → no mis-owned row needed |
| Med — cross-tenant read | `visit/route.ts:150-157` (`?report=1`) | owner filter applied only for operator/sub_operator; "staff: no filter" | a tenant-owned `staff` reads every tenant's visit history |
| Low — permission bypass | `locations/route.ts:83` (POST) | `can_manage_locations` checked only for `role==='operator'` | `sub_operator`/`staff` create locations without the permission — but row is self-owned (`owner_id = session.sub`), **not** cross-tenant |

**Staged fix for locations PATCH (route-fix #2, not implemented):** replace the operator-only block at `:141` with a tenant check for every non-super_admin — `tenant = role==='operator' ? session.sub : session.owner_id`; require `loc.owner_id === tenant`, then the existing `can_manage_locations`/`can_edit_office_location` check. Scopes operator→own, sub_operator→parent, staff→Fruitlink. **Zero overlap with `/api/warehouse`**, so it cannot re-break Receive. Needs a deploy to bite.

**Lesson — role demotion is not containment when the destination role has its own holes.** On 2026-07-23 wh.flq was demoted `staff → sub_operator` to close fleet-wide reach. That closed the **staff-gated reads** (incl. `visit ?report=1`, now Fruitlinq-scoped) — but `sub_operator` is itself exposed on `locations` PATCH, the *same* reach wh.flq already had as `staff` (both fall through the operator-only check at `:141`). Concrete live target: the one Fruitlink-owned location ("Fruitlonq-1", owner `0c1bd083`). So containment moved wh.flq **sideways on this vector**, not out. Low practical risk (needs a target UUID + intent; no UI exposes it) and it needs a deploy to matter — but the principle stands: check the destination role's own surface before treating a demotion as containment.

## 11. Session handoff — 2026-07-23

**SHAs / branches**
- `origin/main = c635297` — **deployed**. Contains none of this session's fixes.
- `origin/fix/machine-control-fault-clear-owner-scope = f3f9995` (local == origin) — fault_clear fix (#1, tested) + this findings doc. **Not deployed.**
- `local main = 6a292e0` — one commit ahead of `origin/main`: the elapsed-time-amber attendance change, **unverified + unpushed. local-only.**
- `Fruitlink_Stock_Model_16Jul.md` lives at `/root/fruitlink/` — **outside the repo**, updated on disk, not version-controlled.

**Blocking-on matrix**
- *On you (decisions/verify):* A-vs-B routing call; whether locations-PATCH ships with the fix branch or separately; verify + push (or drop) `6a292e0`.
- *On a deploy:* every route fix is inert until the fix branch is deployed — fault_clear #1 (done, tested) and locations-PATCH #2 (staged) both need it. wh.flq's locations-PATCH reach persists until then.
- *On Ashok (field task):* F4 physical recount → calibration row; the blocking input to reconcile −349 (~176 accounted for).

**Open decisions**
1. **Routing A vs B** — A: revert `cec8b13` field_staff routing (always `/visit`; reopens nothing, disables the dashboard-grant feature) vs B: add a field_staff Visit entry (keeps both; more work). Two accounts affected (Ashok self-serves via shortcut, Sai Kiran needs the URL).
2. **locations PATCH ship** — as route-fix #2 on the existing fix branch (deploys with fault_clear #1) vs a separate branch/deploy.

---

## 12. Data-hygiene / audit-scope notes — 2026-07-23 (log only, not acted on)

Two observations surfaced while staging the locations-PATCH fix. Neither is a
security hole; both are recorded so they aren't rediscovered cold.

- **Stray typo'd machine — cleanup item.** `"Fruitlonq-1"` (id `e6c18d18`) is
  owned by `0c1bd083` — **Fruitlink**, not Fruitlinq. The name is a typo
  ("Fruitl**o**nq"); the ownership says it's a Fruitlink-side stray left over
  from setup, not a tenant asset. No scope impact (owner is the platform owner
  either way). Rename or delete during the next data-hygiene pass.

- **Tenant owners are outside the staff audit's role scope.** `b3a5c89d` is
  `askkakkera@gmail.com`, `role=operator` — the **Fruitlinq owner** (the tenant
  `owner_id` that wh.flq's row points at, see §1/§5). It never appeared in this
  morning's audit because that audit filtered `role in ('staff','super_admin')`
  and **operator was out of scope**. This is expected, not a miss: tenant owners
  are a *separate role class* (`operator`) from the staff audit. Stating it so
  the next audit doesn't repeat the gap — a complete tenant/scope review must
  cover `operator`/`sub_operator` rows too, not just the staff/super_admin set.

## 13. A corrupted `password_hash` is invisible — it reads as an ordinary 401 — 2026-07-23

**Incident.** A bad `UPDATE` wrote a literal placeholder (the text `"<new bcrypt
hash>"`, 17 chars) into `anish@fruitlinktech.in`'s `password_hash`
(id `d95f496b…`); the original is unrecoverable. Recovered by overwriting with a
fresh **bcryptjs cost-10** hash (the cost every hash-creation route uses —
`register`, `hash-password`, `reset-password`) via `UPDATE … WHERE id AND email`.

**The trap worth knowing.** `bcrypt.compare` (bcryptjs 3.0.3) returns **`false` on a
malformed hash without throwing** — verified async *and* sync. The **only** reader of
the stored hash is `/api/login:22` (`bcrypt.compare(password, operator.password_hash)`);
nothing else reads it (`machine-api` doesn't password-auth operators at all, and
`my-team`'s bcrypt-regex check is on *incoming* writes, not the stored value). So a
corrupted hash is **indistinguishable from a wrong password**: every attempt —
including the *correct* password — returns the normal `401 {error:'Invalid email or
password'}`. No 500 (the route's `catch` returns 500, but there is no throw to catch),
no distinct log line, no changed status. Someone could burn an afternoon debugging the
login route when the row is the problem.

**Diagnosis rule.** One user "can't log in with the right password," nobody else
affected → **don't debug the login route.** Run
`SELECT length(password_hash), left(password_hash,4) FROM operators WHERE email=…`.
A valid bcrypt hash is **60 chars** and starts `$2a$`/`$2b$`; anything else is
corruption. Fix the data, not the code.

**Gap it exposed (see §9).** Recovery required an admin-side overwrite because there is
**no authenticated self-service change-password form** anywhere: dashboard
`SettingsPage` is machine/threshold/notification/cooldown/stock/billing only, `/visit`
has none, and `reset-password` is fully token-gated (depends on the `forgot-password`
Resend email, whose key is currently invalid). The only email-independent rotation is
admin-mediated (super_admin `OperatorsPage` "New Password", or operator `MyStaffSection`
for their staff) — which still leaks the new plaintext to the admin. Net: today no user
can privately rotate their own password.
