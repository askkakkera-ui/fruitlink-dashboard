
## UPDATE 23 Jul — uncounted loading visits (NEW factor, PARTIAL — not a supersession)
NOT known on 16–18 Jul. The loading form accepts a visit with oranges_loaded / oranges_net
/ fruit_count all NULL — no client or server validation (dashboard repo:
visit/route.ts:253, visit/page.tsx:445-446; see docs/FINDINGS-staff-role-tenant-overload.md §8).
F4 has 5 such NULL loading visits (2026-07-10 → 23), all F4 (sn 3A6C8FFB69). Content, not count:
- 10 Jul 13:09  "Filled 88c 2 boxes" + consumables -> ONE GENUINE uncounted load ~= 176 oranges
  (count went in the note, structured field left blank).
- 10 Jul 13:06 & 17 Jul 08:05  blank everything (no oranges/consumables/note) -> accidental/empty
  submits, ~0 oranges. (Each sits minutes-to-an-hour before a real load at the same spot.)
- 10 Jul 14:04 & 23 Jul 07:43  {straws:20} only -> consumables restock or uncounted; ~0 each, ambiguous.

ARITHMETIC (corrects a "5 loads x ~90 ~= 450" reading): confirmed uncounted ~= 176 (ONE load);
max plausible ~= 350 if both straws-only rows were real loads. F4 now reads -349 vs physical ~170
= ~519 gap. So uncounted loads are a NEWLY IDENTIFIED CONTRIBUTOR (~1/3, up to ~2/3) — NOT the
primary cause and NOT a supersession. The OPC 5-vs-4 over-consumption (below, 18 Jul) and the
dispatch-vs-rack measurement factors STILL STAND; ~519 is not explained by uncounted loads alone.
F4 swung from +47 OVER (18 Jul) to ~519 UNDER (now); uncounted loads push model below physical,
consistent with this being real but partial.
DO NOT reconcile from records — needs a PHYSICAL RECOUNT at F4 (Ashok on-site), then a calibration row.
Second bug to fix in the form: reject fully-blank loading visits + require an orange count.

PATTERN (record for the form fix): F4's true number keeps landing in FREE TEXT instead of a column.
Twice now:
  - 10 Jul 13:09 loading  — real count in note "Filled 88c 2 boxes" (=176); oranges_loaded blank.
  - 13 Jul 04:17 calibration — "physical 225 vs system 247" written as a note; stored only as a
    -22 delta (oranges_net=-22), never as an absolute count.
When the form doesn't fit what staff actually know (boxes/cups instead of a loose count; an
absolute physical count for calibration), they put it in the note and the ledger loses it. The
form fix must give these a STRUCTURED HOME, not merely make the existing field required — otherwise
the number keeps escaping into notes.

BLOCKING INPUT — FIELD TASK, NOT CODE: reconciling F4 and the -349 now depends on Ashok physically
recounting F4 on-site, then writing a calibration row. No query or code change can produce this
number. Flagged as a field task so it is not left waiting on a coding session that cannot do it.

## UPDATE 18 Jul — carry_forward fix + open items
FIXED (committed 54225fa, machine-api routes/machine.js):
- carry_forward had a SEPARATE un-anchored formula (loadedBeforeToday) that
  summed every loading visit ever and ignored the calibration anchor. F4 read
  carry_forward 3576 on a 310-cap machine. Now:
    carryForward = Math.max(0, balance - (loadedToday - consumedToday))
  Reuses the anchored balance so it can't drift. F4 3576 -> 262. Others that
  were inflated by history (F2 484, F3 256) now read 0 honestly.

STILL OPEN — the real accuracy gap (this fix did NOT touch it):
- F4: model balance 242 vs physical 195 (39 racks x 5). 47 oranges OVER.
  Over ~58 cups that's ~0.8 orange/cup overstatement = the yield loss (bad
  cups burn 5-6 not 4). Model undercounts consumption -> overstates stock.
  NOTE: 17 Jul drift test is VOID — F4 got a 264-orange top-up mid-window
  (yesterday: loaded 264, cups 53). Snapshot gap is still valid; drift RATE is not.
- F5: reads opc 5 / count 100, but was migrated holding 88s (?). opc config
  MAY be wrong. DO NOT fix blind — owner to physically check whether F5 is
  loaded with 88s or 100s first. Verify before changing.
- F1: balance -30, needs_recount. F5: balance -30, needs_recount. Both flagged.

NEXT STOCK STEP: a CLEAN all-machine recount. Physically count each machine,
write fresh calibration rows (visit_type='calibration', oranges_net = real
count, fruit_count = actual fruit size), then a drift watch with a no-top-up
window agreed with Sri IN ADVANCE. No measurement is trustworthy while anyone
can load mid-window.

## F5 OBSERVATION — 19 Jul (recorded, NOT calibrated)
F5 (SAS iTower) reported ~54 racks available "before it stopped" (racks x 5 =
270 oranges). System stock model at time of check (19 Jul ~15:47 IST) showed:
balance 210, remaining_cups 42, stock_pct 68%, carry_forward 225, cups_today 3,
consumed_today 15, needs_recount false. Gap: model 210 vs physical ~270 =
~60 oranges (~12 racks) UNDER-counted. Likely the known opc drift — F5 tuning
has oranges_per_cup 5 / count 100, but if it's running 88s (4/cup) the model
over-charges consumption and drifts the balance low. NOT calibrated: unclear
whether "54 racks" was the count RIGHT NOW or when it stopped on 18 Jul (cups
vended since Sai brought it back — cups_today 3, yesterday 11 — so a stale
count would anchor wrong). To reconcile later: get Sai's CURRENT rack count,
then anchor F5 to (racks x 5) via a calibration visit. Context: F5 was offline
18 Jul 19:56 IST -> recovered ~13:08 IST 19 Jul (site network drop; see comm log).
