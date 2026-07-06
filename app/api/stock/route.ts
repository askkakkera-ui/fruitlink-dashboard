import { NextRequest, NextResponse } from 'next/server';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || '';
const NO_STORE = { 'Cache-Control': 'no-store' };

function sbH() {
  return { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
}

export async function GET(req: NextRequest) {
  try {
    // 1. Get all NewSaier machines
    const mRes = await fetch(SB_URL + '/rest/v1/machines?select=id,sn,display_name,state&status=eq.online', { headers: sbH() });
    const allMachines = await mRes.json();
    const machines = (Array.isArray(allMachines) ? allMachines : []).filter((m: any) => {
      try {
        const st = typeof m.state === 'string' ? JSON.parse(m.state) : (m.state || {});
        return st?.machine_config?.machine_type === 'newsaier';
      } catch { return false; }
    });

    if (!machines.length) return NextResponse.json([], { headers: NO_STORE });

    const results = [];

    for (const m of machines) {
      const st = typeof m.state === 'string' ? JSON.parse(m.state) : (m.state || {});
      const mc = st.machine_config || {};
      const oranges_per_cup = mc.oranges_per_cup || 5;

      // 2. Latest loading visit for this machine
      const vRes = await fetch(
        SB_URL + '/rest/v1/visits?select=id,oranges_net,created_at&machine_id=eq.' + m.id +
        '&visit_type=eq.loading&order=created_at.desc&limit=1',
        { headers: sbH() }
      );
      const visits = await vRes.json();
      const latestVisit = Array.isArray(visits) ? visits[0] : null;

      if (!latestVisit || !latestVisit.oranges_net) {
        results.push({
          machine_id: m.id, sn: m.sn, display_name: m.display_name,
          stock_known: false, cups_loaded: null, cups_dispensed: null,
          cups_remaining: null, stock_pct: null, last_loaded_at: null,
          oranges_per_cup,
        });
        continue;
      }

      const cups_loaded = Math.floor(latestVisit.oranges_net / oranges_per_cup);
      const last_loaded_at = latestVisit.created_at;

      // 3. Count cups dispensed since that loading visit (paid orders only)
      const oRes = await fetch(
        SB_URL + '/rest/v1/orders?select=cup_num&machine_id=eq.' + m.id +
        '&pay_state=eq.1&created_at=gt.' + encodeURIComponent(last_loaded_at),
        { headers: sbH() }
      );
      const orders = await oRes.json();
      const cups_dispensed = (Array.isArray(orders) ? orders : [])
        .reduce((sum: number, o: any) => sum + (parseInt(o.cup_num) || 1), 0);

      const cups_remaining = Math.max(0, cups_loaded - cups_dispensed);
      const stock_pct = cups_loaded > 0 ? Math.round((cups_remaining / cups_loaded) * 100) : 0;

      results.push({
        machine_id: m.id, sn: m.sn, display_name: m.display_name,
        stock_known: true, cups_loaded, cups_dispensed, cups_remaining,
        stock_pct, last_loaded_at, oranges_per_cup,
      });
    }

    return NextResponse.json(results, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
