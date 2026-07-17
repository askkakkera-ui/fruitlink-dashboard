import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

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

// GET /api/locations — list locations
// ?owner_id=  filter by operator (super_admin only)
// ?with_machines=1  include machine count per location
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role === 'field_staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    const params = request.nextUrl.searchParams;
    const withMachines = params.get('with_machines') === '1';

    let ownerFilter = '';
    if (session.role === 'super_admin') {
      const ownerId = params.get('owner_id');
      if (ownerId) ownerFilter = '&owner_id=eq.' + encodeURIComponent(ownerId);
    } else if (session.role === 'sub_operator') {
      ownerFilter = '&owner_id=eq.' + encodeURIComponent(String(session.owner_id || session.sub));
    } else {
      ownerFilter = '&owner_id=eq.' + encodeURIComponent(session.sub);
    }

    const locRes = await fetch(
      SB_URL + '/rest/v1/locations?select=*&order=name.asc' + ownerFilter,
      { headers: sbH() }
    );
    const locations = await locRes.json();
    if (!Array.isArray(locations)) return NextResponse.json([], { headers: NO_STORE });

    if (!withMachines) return NextResponse.json(locations, { headers: NO_STORE });

    // Bulk fetch machines + staff counts
    const locIds = locations.map((l: any) => l.id);
    if (locIds.length === 0) return NextResponse.json([], { headers: NO_STORE });

    const idList = '(' + locIds.map(encodeURIComponent).join(',') + ')';
    const machRes = await fetch(SB_URL + '/rest/v1/machines?select=id,display_name,sn,status,location_id&location_id=in.' + idList, { headers: sbH() });
    const machines = await machRes.json();

    // Build machine map
    const machByLoc: Record<string, any[]> = {};
    (Array.isArray(machines) ? machines : []).forEach((m: any) => {
      if (!machByLoc[m.location_id]) machByLoc[m.location_id] = [];
      machByLoc[m.location_id].push(m);
    });

    const result = locations.map((l: any) => ({
      ...l,
      machines: machByLoc[l.id] || [],
      machine_count: (machByLoc[l.id] || []).length,
    }));

    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// POST /api/locations — create location
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role === 'field_staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    // Operators need can_manage_locations permission
    if (session.role === 'operator') {
      const permRes = await fetch(SB_URL + '/rest/v1/operator_permissions?select=can_manage_locations&operator_id=eq.' + encodeURIComponent(session.sub) + '&limit=1', { headers: sbH() });
      const perms = await permRes.json();
      if (!Array.isArray(perms) || !perms[0]?.can_manage_locations) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403, headers: NO_STORE });
      }
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400, headers: NO_STORE });

    // Determine owner_id
    let owner_id = String(session.sub);
    if (session.role === 'super_admin' && body.owner_id) {
      owner_id = String(body.owner_id);
    }

    const row = {
      owner_id,
      name,
      address: body.address ? String(body.address).trim() : null,
      lat: body.lat != null ? parseFloat(body.lat) : null,
      lng: body.lng != null ? parseFloat(body.lng) : null,
      geofence_radius_m: body.geofence_radius_m ? parseInt(body.geofence_radius_m) : 100,
      is_office: body.is_office === true || body.is_office === 'true',
    };

    const res = await fetch(SB_URL + '/rest/v1/locations', {
      method: 'POST', headers: sbH(),
      body: JSON.stringify(row),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'Create failed', detail: data }, { status: 500, headers: NO_STORE });

    return NextResponse.json(Array.isArray(data) ? data[0] : data, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// PATCH /api/locations?id= — update location
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role === 'field_staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: NO_STORE });

    // Verify ownership
    const locRes = await fetch(SB_URL + '/rest/v1/locations?select=id,owner_id,is_office&id=eq.' + encodeURIComponent(id) + '&limit=1', { headers: sbH() });
    const locs = await locRes.json();
    if (!Array.isArray(locs) || !locs[0]) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
    const loc = locs[0];

    // Operators can only edit their own locations if they have permission
    if (session.role === 'operator') {
      if (loc.owner_id !== session.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
      // Check if editing office location (special permission)
      const permField = loc.is_office ? 'can_edit_office_location' : 'can_manage_locations';
      const permRes = await fetch(SB_URL + '/rest/v1/operator_permissions?select=' + permField + '&operator_id=eq.' + encodeURIComponent(session.sub) + '&limit=1', { headers: sbH() });
      const perms = await permRes.json();
      if (!Array.isArray(perms) || !perms[0]?.[permField]) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403, headers: NO_STORE });
      }
    }

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.address != null) patch.address = String(body.address).trim() || null;
    if (body.lat != null) patch.lat = parseFloat(body.lat);
    if (body.lng != null) patch.lng = parseFloat(body.lng);
    if (body.geofence_radius_m != null) patch.geofence_radius_m = parseInt(body.geofence_radius_m);
    if (body.is_office != null) patch.is_office = body.is_office === true || body.is_office === 'true';
    if (body.active != null) patch.active = body.active === true || body.active === 'true';

    const res = await fetch(SB_URL + '/rest/v1/locations?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: sbH(),
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'Update failed', detail: data }, { status: 500, headers: NO_STORE });

    return NextResponse.json(Array.isArray(data) ? data[0] : data, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}

// DELETE /api/locations?id= — soft delete (set active=false)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (session.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: NO_STORE });

    // Soft delete — unassign machines first, then deactivate
    await fetch(SB_URL + '/rest/v1/machines?location_id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: sbH(),
      body: JSON.stringify({ location_id: null }),
    });

    const res = await fetch(SB_URL + '/rest/v1/locations?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: sbH(),
      body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return NextResponse.json({ error: 'Delete failed' }, { status: 500, headers: NO_STORE });

    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
