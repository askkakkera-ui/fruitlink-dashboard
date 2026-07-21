import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const MACHINE_API = process.env.MACHINE_API_URL || 'https://api.fruitlinktech.in';
// Server env, never a literal. This key grants reboot / reset_mcu / fault-clear on
// every machine in the fleet; it was rotated on 15 Jul after being found in six
// APK files and in client-side React, and it was still sitting in git here.
// machine-control/route.ts already reads it from env - this route did not.
const MACHINE_KEY = process.env.MACHINE_KEY || '';
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return await verifySession(token);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    // field_staff get no console/warehouse stock. This route is under /api/*
    // (middleware-exempt), so it must self-enforce: without this, the owner_id
    // scope below returns the field_staff's PARENT operator's stock. Mirrors
    // /api/machines, which returns [] for field_staff.
    if (session.role === 'field_staff') return NextResponse.json([], { headers: NO_STORE });

    // Call VPS stock endpoint (handles ALL machines — JW + NewSaier, cumulative loads)
    if (!MACHINE_KEY) return NextResponse.json({ error: 'MACHINE_KEY not configured' }, { status: 500, headers: NO_STORE });
    const res = await fetch(MACHINE_API + '/api/machine/stock', {
      headers: { 'x-machine-key': MACHINE_KEY },
    });
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
      return NextResponse.json([], { headers: NO_STORE });
    }

    let results = json.data;

    // Operator scoping — filter to only their machines
    if (session.role !== 'super_admin') {
      const ownerId = session.owner_id ? String(session.owner_id) : String(session.sub || '');
      if (ownerId) {
        const moRes = await fetch(
          SB_URL + '/rest/v1/machine_operators?select=machine_id&operator_id=eq.' + encodeURIComponent(ownerId),
          { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
        );
        const moRows = await moRes.json();
        const allowed = Array.isArray(moRows) ? moRows.map((r: any) => r.machine_id) : [];
        results = results.filter((s: any) => allowed.includes(s.machine_id));
      } else {
        results = [];
      }
    }

    // Map to the format the dashboard expects (backward compatible)
    const mapped = results.map((s: any) => ({
      machine_id: s.machine_id,
      sn: s.sn,
      display_name: s.display_name,
      stock_known: true,
      cups_loaded: Math.floor(s.carry_forward / s.oranges_per_cup) + Math.floor(s.loaded_today / s.oranges_per_cup),
      cups_dispensed: s.cups_today,
      cups_remaining: s.remaining_cups,
      stock_pct: s.stock_pct,
      last_loaded_at: null,
      oranges_per_cup: s.oranges_per_cup,
      // Extra fields from VPS
      carry_forward: s.carry_forward,
      loaded_today: s.loaded_today,
      consumed_today: s.consumed_today,
      remaining_oranges: s.remaining,
      // The VPS reports when its rolling balance has gone negative - the model
      // has drifted from the machine and the stock is unknown. This mapping is a
      // whitelist, so anything not named here is silently dropped: needs_recount
      // was returned by the API and never reached the dashboard.
      balance: s.balance,
      needs_recount: s.needs_recount,
      count: s.count,
      capacity: s.capacity,
      machine_type: s.machine_type,
      visits_today: s.visits_today,
      yesterday: s.yesterday,
    }));

    return NextResponse.json(mapped, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
