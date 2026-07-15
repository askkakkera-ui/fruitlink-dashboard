import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import crypto from 'crypto';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const sbH = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json', ...extra,
});
const NO_STORE = { 'Cache-Control': 'no-store' };

export const runtime = 'nodejs';

const CLAIM_TTL_HOURS = 24;

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// A human-transcribable code: 4 groups of 5 from an unambiguous alphabet
// (no O/0, I/1, etc). ~10^28 combinations; the real protection is the
// single-use + 24h expiry + per-machine attempt budget, but there is no
// reason to make it guessable.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateClaimCode(): string {
  const bytes = crypto.randomBytes(20);
  let out = '';
  for (let i = 0; i < 20; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i % 5 === 4 && i !== 19) out += '-';
  }
  return out;
}

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

// POST /api/machine-provision  { machine_id }
// Issues a single-use claim code for one machine. Returns the plaintext ONCE.
// Only the sha256 is stored: nobody, including us, can recover it later.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    // Device provisioning is a fleet-security action: super_admin only.
    if (session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }

    const body = await request.json().catch(() => ({}));
    const machine_id = String(body.machine_id || '');
    if (!machine_id) return NextResponse.json({ error: 'machine_id required' }, { status: 400, headers: NO_STORE });

    // The machine must exist, be live, and be one we actually control.
    const mRes = await fetch(
      SB_URL + '/rest/v1/machines?select=id,sn,name,board_serial,auth_mode,provisioned_at,deleted_at&id=eq.' +
        encodeURIComponent(machine_id) + '&limit=1',
      { headers: sbH() }
    );
    const mRows = await mRes.json();
    const machine = Array.isArray(mRows) ? mRows[0] : null;
    if (!machine || machine.deleted_at) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404, headers: NO_STORE });
    }

    // No board_serial means we cannot bind the code to a physical unit.
    // The New Saier machines have none, and cannot sign anyway.
    if (!machine.board_serial) {
      return NextResponse.json({
        error: 'This machine has no board_serial and cannot be provisioned. Machines running third-party firmware stay on legacy_shared auth.',
      }, { status: 400, headers: NO_STORE });
    }

    // Already provisioned: re-keying is rotation, not provisioning.
    if (machine.provisioned_at) {
      return NextResponse.json({
        error: 'Machine is already provisioned. Use secret rotation instead.',
      }, { status: 409, headers: NO_STORE });
    }

    // Invalidate any existing live code for this machine. The partial unique
    // index allows only one unredeemed row, and issuing a new code must
    // retire the old one rather than leave two valid ways in.
    await fetch(
      SB_URL + '/rest/v1/machine_claim_codes?machine_id=eq.' + encodeURIComponent(machine_id) + '&redeemed_at=is.null',
      { method: 'DELETE', headers: sbH({ Prefer: 'return=minimal' }) }
    );

    const code = generateClaimCode();
    const expiresAt = new Date(Date.now() + CLAIM_TTL_HOURS * 3600 * 1000).toISOString();

    const insRes = await fetch(SB_URL + '/rest/v1/machine_claim_codes', {
      method: 'POST',
      headers: sbH({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        machine_id,
        code_hash: sha256(code),
        expires_at: expiresAt,
        created_by: session.sub,
      }),
    });
    if (!insRes.ok) {
      const detail = await insRes.text().catch(() => '');
      return NextResponse.json({ error: 'Could not issue code', detail }, { status: 500, headers: NO_STORE });
    }

    // Provisioning a device is exactly the kind of act that must be attributable.
    // Note: the code itself is never logged, only the fact that one was issued.
    await logAudit({
      session,
      action: 'provision_code_issued',
      module: 'machines',
      entity_table: 'machines',
      entity_id: machine_id,
      old_value: null,
      new_value: { sn: machine.sn, expires_at: expiresAt },
      req: request,
    });

    return NextResponse.json({
      success: true,
      sn: machine.sn,
      name: machine.name,
      claim_code: code,
      expires_at: expiresAt,
      note: 'Shown once. Put this into the machine config; it cannot be retrieved again.',
    }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
