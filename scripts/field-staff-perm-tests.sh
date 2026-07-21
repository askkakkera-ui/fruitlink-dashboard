#!/usr/bin/env bash
#
# Field-staff dashboard-permission gate — server-side tests (T4 / T5 / T6).
#
# These assert the API/data boundary and the signed-session middleware gate for
# the "operators can grant field_staff dashboard sections" change. They are the
# curl-runnable half of the commit gate; T3 and the DevTools variant of T5 are
# browser tests you run by hand.
#
# READ-ONLY: the only write attempted (T6) is expected to be REJECTED with 403,
# so a passing run changes nothing in the database.
#
# ── Usage ────────────────────────────────────────────────────────────────────
#   BASE_URL=https://<preview>.vercel.app \
#   FS_SESSION='<fl_session cookie value for an UNGRANTED field_staff>' \
#   [ OP_SESSION='<fl_session for an OPERATOR>' FS_TARGET_ID='<field_staff id on that operator team>' \
#     ESCALATE_KEY='can_view_reports' ] \
#   ./scripts/field-staff-perm-tests.sh
#
# Where to get the cookie value: log in as the user in a browser, open DevTools →
# Application → Cookies → copy the VALUE of `fl_session` (the long HttpOnly JWT).
#
# Inputs (env vars):
#   BASE_URL      (required) Preview origin, no trailing slash needed.
#   FS_SESSION    (required) fl_session for an UNGRANTED field_staff (no can_view_* held).
#   OP_SESSION    (T6, optional) fl_session for an operator.
#   FS_TARGET_ID  (T6, optional) operator_id of a field_staff on THAT operator's own team.
#   ESCALATE_KEY  (T6, optional) a permission key the operator does NOT hold. Default: can_view_reports.
# ─────────────────────────────────────────────────────────────────────────────

set -u

BASE_URL="${BASE_URL:-}"
FS_SESSION="${FS_SESSION:-}"
OP_SESSION="${OP_SESSION:-}"
FS_TARGET_ID="${FS_TARGET_ID:-}"
ESCALATE_KEY="${ESCALATE_KEY:-can_view_reports}"

if [ -z "$BASE_URL" ] || [ -z "$FS_SESSION" ]; then
  echo "ERROR: BASE_URL and FS_SESSION are required. See header for usage." >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

pass=0; fail=0; warn=0
green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
yellow(){ printf '\033[33m%s\033[0m' "$1"; }

# hit METHOD URL [extra curl args...] -> sets HTTP (status) and BODY
hit() {
  local method="$1" url="$2"; shift 2
  HTTP="$(curl -sS -m 30 -X "$method" -o "$TMP" -w '%{http_code}' "$@" "$url")"
  BODY="$(cat "$TMP")"
}

# A response leaks NO data if it is 403/401, or 200 with an empty body / empty array.
no_data() {
  [ "$HTTP" = "403" ] && return 0
  [ "$HTTP" = "401" ] && return 0
  local b; b="$(printf '%s' "$BODY" | tr -d '[:space:]')"
  if [ "$HTTP" = "200" ] && { [ -z "$b" ] || [ "$b" = "[]" ]; }; then return 0; fi
  return 1
}

ok()   { pass=$((pass+1)); printf '  %s %s\n' "$(green PASS)" "$1"; }
bad()  { fail=$((fail+1)); printf '  %s %s\n' "$(red FAIL)" "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; }
note() { warn=$((warn+1)); printf '  %s %s\n' "$(yellow WARN)" "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; }

FS_COOKIE="fl_session=${FS_SESSION}"

echo "=============================================================="
echo " Field-staff permission gate — $BASE_URL"
echo "=============================================================="

# ── Preflight: the field_staff cookie must be VALID, else every 401 below would
#    look like a false pass. Own-visits read should be 200 (possibly empty []). ──
echo
echo "Preflight — FS_SESSION is a valid field_staff session"
hit GET "$BASE_URL/api/sb?path=$(printf '%s' '/rest/v1/visits?select=id&limit=1' | sed 's/?/%3F/; s/&/%26/g')" -H "Cookie: $FS_COOKIE"
if [ "$HTTP" = "200" ]; then
  ok "field_staff cookie accepted (own visits readable)"
elif [ "$HTTP" = "401" ]; then
  bad "FS_SESSION rejected (401) — supply a fresh, valid field_staff fl_session" "$BODY"
  echo; echo "Aborting: cannot trust the rest without a valid cookie."; exit 1
else
  note "unexpected preflight status $HTTP (continuing)" "$BODY"
fi

# ── T4: an ungranted field_staff must get NO section data from the data routes ──
echo
echo "T4 — ungranted field_staff data routes return [] or 403 (never data)"
declare -a T4=(
  "GET|/api/stock|stock (Console/Machines source; owner-scope leak was the fix)"
  "GET|/api/alerts|alerts"
  "GET|/api/attendance?report=1|attendance report"
  "GET|/api/warehouse?onhand=1|warehouse"
)
for row in "${T4[@]}"; do
  IFS='|' read -r m path label <<<"$row"
  hit "$m" "$BASE_URL$path" -H "Cookie: $FS_COOKIE"
  if no_data; then
    ok "$label -> $HTTP $(printf '%s' "$BODY" | tr -d '[:space:]' | cut -c1-40)"
  else
    bad "$label RETURNED DATA -> $HTTP" "$(printf '%s' "$BODY" | cut -c1-200)"
  fi
done

# ── T5 (curl anti-spoof): forged cosmetic cookies must NOT admit an ungranted
#    field_staff. Middleware reads only the signed fl_session, so `/` must still
#    307 -> /visit even with fl_role=super_admin and an all-true fl_permissions. ──
echo
echo "T5 — spoofed fl_role/fl_permissions are ignored; ungranted field_staff still -> /visit"
SPOOF="fl_session=${FS_SESSION}; fl_role=super_admin; fl_permissions=%7B%22can_view_console%22%3Atrue%2C%22can_view_attendance%22%3Atrue%7D"
RES="$(curl -sS -m 30 -o /dev/null -w '%{http_code} %{redirect_url}' -H "Cookie: $SPOOF" "$BASE_URL/")"
T5_CODE="${RES%% *}"; T5_LOC="${RES#* }"
if printf '%s' "$T5_CODE" | grep -qE '^3(0[0-9])$' && printf '%s' "$T5_LOC" | grep -q '/visit'; then
  ok "GET / -> $T5_CODE redirect to $T5_LOC (signed session enforced, cosmetic cookies ignored)"
elif [ "$T5_CODE" = "200" ]; then
  bad "GET / returned 200 — ungranted field_staff reached the dashboard shell" "redirect_url='$T5_LOC'"
else
  note "GET / -> $T5_CODE redirect='$T5_LOC' (expected 3xx to /visit; inspect)"
fi

# ── T6: an operator cannot grant a field_staff a permission the operator lacks.
#    Escalation must be refused server-side with 403. ──
echo
echo "T6 — operator granting beyond own ceiling is rejected (403)"
if [ -z "$OP_SESSION" ] || [ -z "$FS_TARGET_ID" ]; then
  note "skipped — set OP_SESSION and FS_TARGET_ID to run (target must be a field_staff on that operator's team)"
else
  hit PUT "$BASE_URL/api/operator-permissions" \
    -H "Cookie: fl_session=${OP_SESSION}" \
    -H "Content-Type: application/json" \
    --data "{\"operator_id\":\"${FS_TARGET_ID}\",\"permissions\":{\"${ESCALATE_KEY}\":true}}"
  if [ "$HTTP" = "403" ]; then
    ok "grant of '$ESCALATE_KEY' refused -> 403 ($(printf '%s' "$BODY" | cut -c1-120))"
  elif [ "$HTTP" = "200" ]; then
    note "grant SUCCEEDED (200) — operator likely HOLDS '$ESCALATE_KEY'; rerun with ESCALATE_KEY set to one they lack" "$BODY"
  else
    bad "unexpected status $HTTP (expected 403)" "$(printf '%s' "$BODY" | cut -c1-200)"
  fi
fi

# ── Summary ──
echo
echo "=============================================================="
printf ' %s  %s  %s\n' "$(green "PASS: $pass")" "$(yellow "WARN: $warn")" "$(red "FAIL: $fail")"
echo "=============================================================="
if [ "$fail" -gt 0 ]; then
  echo "GATE: NOT MET — do not commit. A grantable section leaked data or the gate was bypassed."
  exit 1
fi
if [ "$warn" -gt 0 ]; then
  echo "GATE: review WARN items (inconclusive) before committing."
  exit 0
fi
echo "GATE: server-side checks PASSED. Still run T3 + the DevTools variant of T5 in a browser before commit."
exit 0
