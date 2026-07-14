import type { NextRequest } from 'next/server';
import type { SessionPayload } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';

const sbH = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json', ...extra,
});

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export type AuditParams = {
  session: SessionPayload;
  action: string;
  module: string;
  entity_table: string;
  entity_id?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  owner_id?: string | null;
  req: NextRequest;
};

// Best-effort, immutable audit write. Never throws to the caller: a failed
// audit write must not break the user action, but it is logged loudly.
export async function logAudit(p: AuditParams): Promise<void> {
  try {
    const row = {
      owner_id: p.owner_id ?? p.session.owner_id ?? null,
      actor_id: p.session.sub ?? null,
      actor_role: p.session.role ?? null,
      action: p.action,
      module: p.module,
      entity_table: p.entity_table,
      entity_id: p.entity_id ?? null,
      old_value: p.old_value ?? null,
      new_value: p.new_value ?? null,
      ip_address: clientIp(p.req),
      user_agent: p.req.headers.get('user-agent'),
    };
    const res = await fetch(SB_URL + '/rest/v1/audit_log', {
      method: 'POST',
      headers: sbH({ Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[audit] write failed', res.status, detail);
    }
  } catch (e) {
    console.error('[audit] write threw', e);
  }
}
