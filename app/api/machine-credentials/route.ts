import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import crypto from 'crypto';

// Device credential lifecycle: rotate a machine's signing secret, or reset its
// replay counter.
//
// Why these exist: per-machine secrets are only worth having because they are
// revocable. Without rotation they are as permanent as the shared key they
// replace - better isolated, but no more recoverable.
//
// The counter reset closes a promise the device spec already makes: "if the
// counter is lost, recovery is resetting last_counter from the dashboard".

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const MACHINE_API = process.env.MACHINE_API_URL || 'https://api.fruitlinktech.in';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const NO_STORE = { 'Cache-Control': 'no-store' };

export const runtime = 'nodejs';

// Generous by default. A long window costs little: a leaked secret is an
// emergency you rotate again anyway. A SHORT window costs a machine returning
// from repair that cannot authenticate and needs a physical visit.
const DEFAULT_WINDOW_DAYS = 30;

const sbH = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json', ...extra,
});

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: super admin only' }, { status: 403, headers: NO_STORE });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const machine_id = String(body.machine_id || '');
    if (!machine_id) return NextResponse.json({ error: 'machine_id required' }, { status: 400, headers: NO_STORE });

    const mRes = await fetch(
      SB_URL + '/rest/v1/machines?select=id,sn,name,auth_mode,deleted_at&id=eq.' +
        encodeURIComponent(machine_id) + '&limit=1',
      { headers: sbH() }
    );
    const mRows = await mRes.json();
    const machine = Array.isArray(mRows) ? mRows[0] : null;
    if (!machine || machine.deleted_at) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404, headers: NO_STORE });
    }

    const cRes = await fetch(
      SB_URL + '/rest/v1/machine_credentials?select=machine_id,device_secret,last_counter&machine_id=eq.' +
        encodeURIComponent(machine_id) + '&limit=1',
      { headers: sbH() }
    );
    const cRows = await cRes.json();
    const cred = Array.isArray(cRows) ? cRows[0] : null;
    if (!cred) {
      return NextResponse.json({
        error: 'Machine has no credentials. Provision it first.',
      }, { status: 409, headers: NO_STORE });
    }

    if (action === 'rotate_secret') {
      const windowDays = Number(body.window_days) > 0 ? Number(body.window_days) : DEFAULT_WINDOW_DAYS;
      const newSecret = crypto.randomBytes(32).toString('base64url');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + windowDays * 86400 * 1000).toISOString();

      const upRes = await fetch(
        SB_URL + '/rest/v1/machine_credentials?machine_id=eq.' + encodeURIComponent(machine_id),
        {
          method: 'PATCH',
          headers: sbH({ Prefer: 'return=minimal' }),
          body: JSON.stringify({
            device_secret: newSecret,
            previous_secret: cred.device_secret,
            previous_secret_expires_at: expiresAt,
            secret_rotated_at: now.toISOString(),
            updated_at: now.toISOString(),
          }),
        }
      );
      if (!upRes.ok) {
        const detail = await upRes.text().catch(() => '');
        return NextResponse.json({ error: 'Rotation failed', detail }, { status: 500, headers: NO_STORE });
      }

      let delivered = false;
      if (INTERNAL_API_SECRET) {
        try {
          const dRes = await fetch(MACHINE_API + '/api/provision/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_API_SECRET },
            body: JSON.stringify({
              sn: machine.sn,
              name: machine.name + ' (rotated secret)',
              claim_code: newSecret,
              expires_at: 'old secret valid until ' + expiresAt,
            }),
          });
          delivered = dRes.ok;
        } catch (e: any) {
          console.error('[rotate] delivery threw', e && e.message);
        }
      }

      await logAudit({
        session,
        action: 'secret_rotated',
        module: 'machines',
        entity_table: 'machines',
        entity_id: machine_id,
        old_value: null,
        new_value: { sn: machine.sn, window_days: windowDays, previous_secret_expires_at: expiresAt, delivered },
        req: request,
      });

      return NextResponse.json({
        success: true,
        sn: machine.sn,
        delivered: delivered ? 'telegram' : 'FAILED - re-rotate once delivery is configured',
        previous_secret_expires_at: expiresAt,
        window_days: windowDays,
        note: 'New secret sent to Telegram, not shown here. The old secret keeps working until the window closes.',
      }, { headers: NO_STORE });
    }

    if (action === 'reset_counter') {
      const prev = Number(cred.last_counter || 0);
      const upRes = await fetch(
        SB_URL + '/rest/v1/machine_credentials?machine_id=eq.' + encodeURIComponent(machine_id),
        {
          method: 'PATCH',
          headers: sbH({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ last_counter: 0, updated_at: new Date().toISOString() }),
        }
      );
      if (!upRes.ok) {
        const detail = await upRes.text().catch(() => '');
        return NextResponse.json({ error: 'Reset failed', detail }, { status: 500, headers: NO_STORE });
      }

      await logAudit({
        session,
        action: 'counter_reset',
        module: 'machines',
        entity_table: 'machines',
        entity_id: machine_id,
        old_value: { last_counter: prev },
        new_value: { last_counter: 0 },
        req: request,
      });

      return NextResponse.json({
        success: true,
        sn: machine.sn,
        previous_counter: prev,
        note: 'Counter reset to 0. Replay protection for this machine is open until its next request lands.',
      }, { headers: NO_STORE });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
