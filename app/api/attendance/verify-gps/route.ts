import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || ''; // service key only — never anon
const sbH = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Great-circle distance in metres between two WGS84 points.
 */
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // mean Earth radius, metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/**
 * Accuracy-aware verdict. A GPS fix is a circle, not a point: the device is
 * somewhere within `accuracy` metres of the reported position. So:
 *
 *   inside     the whole uncertainty circle sits within the geofence
 *   outside    the whole uncertainty circle sits beyond the geofence
 *   uncertain  the circle straddles the boundary — we genuinely cannot tell
 *
 * This is advisory only. Nothing here ever blocks a check-in.
 */
function verdictFor(distance: number, accuracy: number, radius: number): 'inside' | 'outside' | 'uncertain' {
  const acc = Math.max(0, accuracy || 0);
  if (distance + acc <= radius) return 'inside';
  if (distance - acc > radius) return 'outside';
  return 'uncertain';
}

/** Which operator's locations should this session see? */
type Scope = { kind: 'all' } | { kind: 'owner'; id: string } | { kind: 'none' };
function scopeOwnerId(session: any): Scope {
  if (session.role === 'super_admin') return { kind: 'all' };   // all locations
  if (session.role === 'operator') return { kind: 'owner', id: String(session.sub) };
  // sub_operator, field_staff, staff: must have a tenant. No tenant, no read.
  return session.owner_id ? { kind: 'owner', id: String(session.owner_id) } : { kind: 'none' };
}

/**
 * POST /api/attendance/verify-gps
 * Body: { lat, lng, accuracy?, location_id? }
 *
 * Returns every location the caller may visit, each annotated with the
 * server-computed distance and an accuracy-aware verdict, nearest first.
 * When location_id is supplied, `target` holds that one location.
 *
 * The geofence exists to record what happened, not to prevent it. This
 * endpoint never returns a refusal — a caller who is 5km away still gets
 * a 200 with verdict:'outside', and the UI asks them why.
 */
const dbg = (why: string, extra: Record<string, unknown> = {}) =>
  console.error('[verify-gps-debug]', JSON.stringify({ why, ...extra }));

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      dbg('no-session', { cookie: request.cookies.get(SESSION_COOKIE) ? 'present' : 'absent' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const body = await request.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const accuracy = body.accuracy != null ? Math.round(Number(body.accuracy)) : null;
    const targetId = body.location_id ? String(body.location_id) : null;

    const hasFix = Number.isFinite(lat) && Number.isFinite(lng);

    const scope = scopeOwnerId(session);
    if (scope.kind === 'none') {
      dbg('scope-none', { role: session.role, sub: String(session.sub), owner_id: session.owner_id ?? null });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }
    let url = SB_URL + '/rest/v1/locations?select=id,name,address,lat,lng,geofence_radius_m,is_office&active=eq.true&order=name.asc';
    if (scope.kind === 'owner') url += '&owner_id=eq.' + encodeURIComponent(scope.id);

    const res = await fetch(url, { headers: sbH() });
    const rows = await res.json();
    if (!Array.isArray(rows)) {
      // TEMP INSTRUMENTATION (remove after diagnosis, 2026-07-23): the Supabase read
      // returned a non-array (error object) and :82 was silently swallowing it into an
      // empty location list — indistinguishable from "no locations". Surface the real
      // status + body so we see the actual failure instead of inferring it. The key
      // lives in headers, not the URL, so nothing secret is logged.
      console.error('[verify-gps-debug]', JSON.stringify({
        why: 'non-array',
        status: res.status,
        ok: res.ok,
        role: session.role,
        sub: String(session.sub),
        owner_id: session.owner_id ?? null,
        scope,
        url,
        body: typeof rows === 'string' ? rows.slice(0, 500) : rows,
      }));
      return NextResponse.json(
        { locations: [], target: null, _debug: { status: res.status, ok: res.ok, body: rows } },
        { headers: NO_STORE }
      );
    }
    if (rows.length === 0) dbg('empty-array', { status: res.status, role: session.role, sub: String(session.sub), scope, url });

    const annotated = rows.map((l: any) => {
      const hasCoords = l.lat != null && l.lng != null;
      if (!hasFix || !hasCoords) {
        // No fix, or the location was never given coordinates. Say so plainly
        // rather than inventing a distance.
        return {
          ...l,
          distance_meters: null,
          accuracy_m: accuracy,
          verdict: 'unknown' as const,
          reason: !hasCoords ? 'location has no GPS coordinates' : 'no GPS fix',
        };
      }
      const distance = haversineMetres(lat, lng, Number(l.lat), Number(l.lng));
      const radius = Number(l.geofence_radius_m) || 100;
      return {
        ...l,
        distance_meters: distance,
        accuracy_m: accuracy,
        verdict: verdictFor(distance, accuracy ?? 0, radius),
        reason: null,
      };
    });

    // Nearest first; locations we cannot measure sink to the bottom.
    annotated.sort((a: any, b: any) => {
      if (a.distance_meters == null && b.distance_meters == null) return 0;
      if (a.distance_meters == null) return 1;
      if (b.distance_meters == null) return -1;
      return a.distance_meters - b.distance_meters;
    });

    const target = targetId ? annotated.find((l: any) => l.id === targetId) || null : null;

    return NextResponse.json(
      {
        locations: annotated,
        target,
        fix: hasFix ? { lat, lng, accuracy_m: accuracy } : null,
      },
      { headers: NO_STORE }
    );
  } catch (e: any) {
    dbg('threw', { name: e?.name ?? null, message: e?.message ?? null });
    return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
  }
}
