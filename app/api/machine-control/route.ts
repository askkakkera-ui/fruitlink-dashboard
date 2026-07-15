import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { logAudit } from '@/lib/audit';

// Machine-control proxy.
//
// These three calls used to be made DIRECTLY FROM THE BROWSER in dashboard.tsx,
// with the fleet key hardcoded in client-side React. That shipped the key to
// every browser that ever loaded the dashboard - readable with F12, no
// decompiling required - and the key grants reboot / reset_mcu / fault-clear on
// every machine in the fleet.
//
// The key now lives only in server env. The browser calls this route, which is
// already session-authenticated, and the key is attached server-side.

const MACHINE_API = process.env.MACHINE_API_URL || 'https://api.fruitlinktech.in';
const MACHINE_KEY = process.env.MACHINE_KEY || '';
const NO_STORE = { 'Cache-Control': 'no-store' };

export const runtime = 'nodejs';

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

function mkHeaders(json: boolean) {
  const h: Record<string, string> = { 'x-machine-key': MACHINE_KEY };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (!MACHINE_KEY) return NextResponse.json({ error: 'MACHINE_KEY not configured' }, { status: 500, headers: NO_STORE });

    const action = request.nextUrl.searchParams.get('action') || '';
    const sn = request.nextUrl.searchParams.get('sn') || '';
    if (action !== 'commlog') return NextResponse.json({ error: 'unknown action' }, { status: 400, headers: NO_STORE });
    if (!sn) return NextResponse.json({ error: 'sn required' }, { status: 400, headers: NO_STORE });

    const r = await fetch(MACHINE_API + '/api/device/commlog?sn=' + encodeURIComponent(sn), {
      headers: mkHeaders(false),
    });
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...NO_STORE },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (!MACHINE_KEY) return NextResponse.json({ error: 'MACHINE_KEY not configured' }, { status: 500, headers: NO_STORE });

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'command') {
      if (session.role !== 'super_admin') {
        return NextResponse.json({ error: 'Forbidden: machine commands are super admin only' }, { status: 403, headers: NO_STORE });
      }
      const machine_id = String(body.machine_id || '');
      const command = String(body.command || '');
      if (!machine_id || !command) {
        return NextResponse.json({ error: 'machine_id and command required' }, { status: 400, headers: NO_STORE });
      }

      const r = await fetch(MACHINE_API + '/api/device/commands/create', {
        method: 'POST',
        headers: mkHeaders(true),
        body: JSON.stringify({
          machine_id,
          command,
          params: body.params || {},
          created_by: session.name || session.email || 'dashboard',
        }),
      });
      const data = await r.json().catch(() => ({}));

      if (r.ok && data && data.code === 1) {
        await logAudit({
          session,
          action: 'machine_command',
          module: 'machines',
          entity_table: 'machines',
          entity_id: machine_id,
          old_value: null,
          new_value: { command, params: body.params || {} },
          req: request,
        });
      }
      return NextResponse.json(data, { status: r.status, headers: NO_STORE });
    }

    if (action === 'fault_clear') {
      if (session.role !== 'super_admin' && session.role !== 'staff') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
      }
      const sn = String(body.sn || '');
      const fault_code = body.fault_code;
      if (!sn) return NextResponse.json({ error: 'sn required' }, { status: 400, headers: NO_STORE });

      const r = await fetch(MACHINE_API + '/api/device/fault', {
        method: 'POST',
        headers: mkHeaders(true),
        body: JSON.stringify({ sn, event: 'clear', fault_code, resolution: 'manual_dashboard' }),
      });
      const data = await r.json().catch(() => ({}));

      if (r.ok) {
        await logAudit({
          session,
          action: 'fault_clear',
          module: 'machines',
          entity_table: 'machines',
          entity_id: null,
          old_value: { sn, fault_code },
          new_value: null,
          req: request,
        });
      }
      return NextResponse.json(data, { status: r.status, headers: NO_STORE });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
