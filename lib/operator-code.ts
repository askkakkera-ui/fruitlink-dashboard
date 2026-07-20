// ── operator_code: the per-company reference printed on invoices ─────────────
//
//   {3 LETTERS OF COMPANY NAME}-{GLOBAL SEQ, 3 digits}/{MM}/{YYYY}   e.g. FRU-001/05/2026
//
// Generated SERVER-SIDE ONLY, in /api/sb's operators write guard. The client
// never supplies it — any operator_code in a request body is stripped before
// the row reaches PostgREST.
//
// Only role='operator' rows get one: the code identifies a company. Team
// members (sub_operator / field_staff / staff) reference their operator's code
// through owner_id and never hold their own.

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const sbH = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });

// Fallback prefix when a name carries no letters at all (e.g. "123 Pvt Ltd").
const FALLBACK_PREFIX = 'OPR';
const PAD_CHAR = 'X';

// First 3 alphabetic characters, uppercased, non-letters stripped.
// Shorter names are padded so the prefix is always 3 wide: "Li" -> "LIX".
export function prefixFromName(name: string): string {
  const letters = String(name || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (!letters) return FALLBACK_PREFIX;
  return letters.slice(0, 3).padEnd(3, PAD_CHAR);
}

// The sequence out of a code. Anchored to the prefix so it can never pick up
// the month: FRU-001/05/2026 -> 1.
const SEQ_RE = /^[A-Z]{3}-(\d+)\//;
export function sequenceOf(code: string): number {
  const m = SEQ_RE.exec(String(code || '').trim());
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 0;
}

// MM/YYYY of "now" in Asia/Kolkata — where the business operates. Using UTC
// would file a code created at 00:30 IST on the 1st under the previous month.
function monthYear(now: Date): { mm: string; yyyy: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', month: '2-digit', year: 'numeric',
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return { mm: get('month'), yyyy: get('year') };
}

export function formatOperatorCode(name: string, seq: number, now: Date = new Date()): string {
  const { mm, yyyy } = monthYear(now);
  return prefixFromName(name) + '-' + String(seq).padStart(3, '0') + '/' + mm + '/' + yyyy;
}

// The next global sequence: highest sequence ever issued, + 1.
//
// Deliberately reads EVERY operators row including soft-deleted ones (no
// deleted_at filter) and derives from max(), not count(). A count would reissue
// a number the moment an operator is deleted, and operator_code is unique — the
// insert would fail, or worse, an invoice reference would be ambiguous.
//
// `after` forces the result above a known-taken value, used on collision retry.
export async function nextOperatorSequence(after = 0): Promise<number> {
  let highest = after;
  try {
    const res = await fetch(
      SB_URL + '/rest/v1/operators?select=operator_code&operator_code=not.is.null',
      { headers: sbH() },
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        for (const r of rows) highest = Math.max(highest, sequenceOf(r?.operator_code));
      }
    } else {
      // Guessing 001 here would collide with the very first existing code.
      throw new Error('operators read failed: ' + res.status);
    }
  } catch (e: any) {
    throw new Error('Could not determine the next operator code sequence: ' + (e?.message || e));
  }
  return highest + 1;
}

export async function generateOperatorCode(name: string, afterSeq = 0): Promise<string> {
  return formatOperatorCode(name, await nextOperatorSequence(afterSeq));
}

// Reissue a code above its current sequence, keeping the prefix and the MM/YYYY
// it was minted with. Used on collision retry, where re-deriving from the name
// is not an option: a PATCH that only flips role carries no name, which would
// silently turn FRU- into the OPR- fallback.
export async function bumpOperatorCodeSequence(code: string): Promise<string> {
  const str = String(code || '');
  const slash = str.indexOf('/');
  const dash = str.indexOf('-');
  if (slash === -1 || dash === -1) return code;
  const seq = await nextOperatorSequence(sequenceOf(str));
  return str.slice(0, dash + 1) + String(seq).padStart(3, '0') + str.slice(slash);
}

// Two operators created in the same instant can race to the same sequence; the
// unique constraint is what actually decides it. 23505 = unique_violation.
export function isOperatorCodeCollision(status: number, responseText: string): boolean {
  if (status !== 409 && status !== 400) return false;
  const t = String(responseText || '');
  return t.includes('operator_code') && (t.includes('23505') || t.toLowerCase().includes('duplicate key'));
}

// Does this operators row currently hold a code? Used on the promotion path so
// an existing code is never overwritten.
export async function existingOperatorCode(operatorId: string): Promise<string | null> {
  const res = await fetch(
    SB_URL + '/rest/v1/operators?select=operator_code&id=eq.' + encodeURIComponent(operatorId) + '&limit=1',
    { headers: sbH() },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? (rows[0].operator_code || null) : null;
}

// The stored Registered Company Name — the string the prefix is derived from,
// since the code is a company reference that ends up on invoices.
//
// Read off the row for the promotion path, where the PATCH body may not carry
// one. There is deliberately no fall back to `name`: a code minted from a
// personal display name is wrong on an invoice and cannot be corrected later
// (codes are frozen once issued), so the write is refused instead — see the
// 422 in /api/sb's operators guard.
export async function operatorCompanyName(operatorId: string): Promise<string> {
  const res = await fetch(
    SB_URL + '/rest/v1/operators?select=company_name&id=eq.' + encodeURIComponent(operatorId) + '&limit=1',
    { headers: sbH() },
  );
  if (!res.ok) return '';
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows[0]) return '';
  return String(rows[0].company_name || '');
}
