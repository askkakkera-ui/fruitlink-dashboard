// TODO: Add rate limiting (e.g. upstash/ratelimit)
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signSession, SESSION_COOKIE } from '@/lib/session';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || '';
const SUPABASE_KEY = process.env.SB_KEY || ''; // service key only — never anon
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

    const res = await fetch(SUPABASE_URL + '/rest/v1/operators?email=eq.' + encodeURIComponent(email) + '&select=id,name,email,password_hash,role,state,country,owner_id&deleted_at=is.null&limit=1', { headers });
    const data = await res.json();
    if (!data || data.length === 0) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    const operator = data[0];
    const valid = await bcrypt.compare(password, operator.password_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    // Fail closed on the role. This was `operator.role || 'operator'`, so a row
    // with no role — which is exactly what the old client-side signup created —
    // authenticated as a full operator. Self-service signups now land as
    // 'pending' (see /api/register) and stay locked out until a super_admin
    // gives them a real role; a missing role is treated the same way rather than
    // granting one. Verified 2026-07-20 that no account has a null role, so this
    // locks out nobody. Checked after the bcrypt compare so it never becomes an
    // account-existence oracle.
    const role = String(operator.role || '');
    if (!role || role === 'pending') {
      return NextResponse.json({ error: 'Your account is awaiting approval.' }, { status: 403 });
    }

    // Fetch permissions for operators (not super_admin or field_staff)
    let permissions: Record<string, boolean> = {};
    if (role === 'operator' || role === 'sub_operator' || role === 'staff') {
      try {
        const permRes = await fetch(SUPABASE_URL + '/rest/v1/operator_permissions?operator_id=eq.' + encodeURIComponent(operator.id) + '&limit=1', { headers });
        const permData = await permRes.json();
        if (Array.isArray(permData) && permData[0]) {
          const p = permData[0];
          permissions = {
            can_view_console: p.can_view_console ?? true,
            can_view_orders: p.can_view_orders ?? true,
            can_view_alerts: p.can_view_alerts ?? true,
            can_view_fleet_map: p.can_view_fleet_map ?? true,
            can_view_warehouse: p.can_view_warehouse ?? true,
            can_view_reports: p.can_view_reports ?? false,
            can_view_field_staff: p.can_view_field_staff ?? false,
            can_view_attendance: p.can_view_attendance ?? false,
            can_view_notify_config: p.can_view_notify_config ?? false,
            can_view_comm_log: p.can_view_comm_log ?? false,
            can_edit_machine_config: p.can_edit_machine_config ?? false,
            can_manage_field_staff: p.can_manage_field_staff ?? false,
            can_manage_locations: p.can_manage_locations ?? false,
            can_edit_office_location: p.can_edit_office_location ?? false,
            can_export_data: p.can_export_data ?? false,
            can_view_ad_manager: p.can_view_ad_manager ?? false,
            can_manage_ads: p.can_manage_ads ?? false,
            can_manage_warehouse: p.can_manage_warehouse ?? false,
          };
        }
      } catch { /* permissions default to empty = conservative access */ }
    }

    // Mint a tamper-proof signed session token (role baked into the signature).
    const token = await signSession({
      sub: String(operator.id),
      role,
      name: operator.name || '',
      email: operator.email || '',
      owner_id: operator.owner_id ? String(operator.owner_id) : undefined,
      // sub_operator: parent_operator_id used for machine scoping
      parent_id: role === 'sub_operator' ? (operator.owner_id ? String(operator.owner_id) : undefined) : undefined,
      permissions: Object.keys(permissions).length > 0 ? permissions : undefined,
    });

    // Build the JSON response the dashboard already expects.
    const response = NextResponse.json({
      success: true,
      id: operator.id,
      name: operator.name,
      email: operator.email,
      role,
      state: operator.state || '',
      country: operator.country || 'India',
      permissions,
      owner_id: operator.owner_id || null,
    });

    // Set the signed session as an HttpOnly cookie — browser JS / DevTools cannot
    // read or forge it. THIS is the real auth; the dashboard's plain fl_role cookie
    // is now only cosmetic (used to show the UI label).
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Non-httpOnly cookie for dashboard nav visibility (not security-sensitive)
    if (Object.keys(permissions).length > 0) {
      response.cookies.set('fl_permissions', encodeURIComponent(JSON.stringify(permissions)), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
