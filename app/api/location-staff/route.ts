import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { logAudit } from '@/lib/audit';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || '';
const sbH = (extra: Record<string, string> = {}) => ({
  apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json', Prefer: 'return=representation', ...extra,
});
const NO_STORE = { 'Cache-Control': 'no-store' };

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

// GET /api/location-staff?location_id= — get staff for a location
// GET /api/location-staff?staff_id= — get locations for a staff member
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    const params = request.nextUrl.searchParams;
    const locationId = params.get('location_id');
    const staffId = params.get('staff_id');

    if (locationId) {
      // Get staff assigned to this location (with staff details)
      const res = await fetch(
        SB_URL + '/rest/v1/location_staff?select=staff_id,operators(id,name,email,role)&location_id=eq.' + encodeURIComponent(locationId),
        { headers: sbH() }
      );
      const rows = await res.json();
      return NextResponse.json(Array.isArray(rows) ? rows : [], { headers: NO_STORE });
    }

    if (staffId) {
      // Get locations assigned to this staff member
      const res = await fetch(
        SB_URL + '/rest/v1/location_staff?select=location_id,locations(id,name,address,lat,lng,is_office)&staff_id=eq.' + encodeURIComponent(staffId),
        { headers: sbH() }
      );
      const rows = await res.json();
      return NextResponse.json(Array.isArray(rows) ? rows : [], { headers: NO_STORE });
    }

    // For field_staff: return their own assigned locations
    if (session.role === 'field_staff') {
      const res = await fetch(
        SB_URL + '/rest/v1/location_staff?select=locations(id,name,address,lat,lng,geofence_radius_m,is_office)&staff_id=eq.' + encodeURIComponent(session.sub),
        { headers: sbH() }
      );
      const rows = await res.json();
      const locs = (Array.isArray(rows) ? rows : []).map((r: any) => r.locations).filter(Boolean);
      return NextResponse.json(locs, { headers: NO_STORE });
    }

    return NextResponse.json({ error: 'location_id or staff_id required' }, { status: 400, headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// POST /api/location-staff — assign staff to location
// Body: { location_id, staff_id }
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role === 'field_staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    // Operators need can_manage_field_staff permission
    if (session.role === 'operator') {
      const permRes = await fetch(SB_URL + '/rest/v1/operator_permissions?select=can_manage_field_staff&operator_id=eq.' + encodeURIComponent(session.sub) + '&limit=1', { headers: sbH() });
      const perms = await permRes.json();
      if (!Array.isArray(perms) || !perms[0]?.can_manage_field_staff) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403, headers: NO_STORE });
      }
    }

    const body = await request.json().catch(() => ({}));
    const { location_id, staff_id } = body;
    if (!location_id || !staff_id) return NextResponse.json({ error: 'location_id and staff_id required' }, { status: 400, headers: NO_STORE });

    const res = await fetch(SB_URL + '/rest/v1/location_staff', {
      method: 'POST', headers: sbH(),
      body: JSON.stringify({ location_id, staff_id }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'Assign failed', detail: data }, { status: 500, headers: NO_STORE });

    await logAudit({
      session,
      action: 'create',
      module: 'staff',
      entity_table: 'location_staff',
      entity_id: null,
      old_value: null,
      new_value: { location_id, staff_id },
      req: request,
    });

    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// DELETE /api/location-staff?location_id=&staff_id= — remove staff from location.
// This is a join/link row: hard delete is correct (soft-delete would block re-adding
// the same pair). The audit_log entry is the durable record that the assignment
// existed and who removed it.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role === 'field_staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    const params = request.nextUrl.searchParams;
    const location_id = params.get('location_id');
    const staff_id = params.get('staff_id');
    if (!location_id || !staff_id) return NextResponse.json({ error: 'location_id and staff_id required' }, { status: 400, headers: NO_STORE });

    const res = await fetch(
      SB_URL + '/rest/v1/location_staff?location_id=eq.' + encodeURIComponent(location_id) + '&staff_id=eq.' + encodeURIComponent(staff_id),
      { method: 'DELETE', headers: sbH() }
    );
    if (!res.ok) return NextResponse.json({ error: 'Remove failed' }, { status: 500, headers: NO_STORE });

    await logAudit({
      session,
      action: 'delete',
      module: 'staff',
      entity_table: 'location_staff',
      entity_id: null,
      old_value: { location_id, staff_id },
      new_value: null,
      req: request,
    });

    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
