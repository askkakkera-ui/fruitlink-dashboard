'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const LOGO = 'https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/logo.png';

// Bump on every visit-page change. Shown on the mode screen so a stale cached
// build can be identified in one glance instead of three rounds of guessing.
const BUILD = '2026-07-09-a';

type Machine = { id: string; display_name?: string; sn?: string; location?: string; location_id?: string };
type Verdict = 'inside' | 'outside' | 'uncertain' | 'unknown';
type Loc = {
  id: string; name: string; address?: string;
  lat?: number | null; lng?: number | null;
  geofence_radius_m: number; is_office: boolean;
  distance_meters: number | null; accuracy_m: number | null;
  verdict: Verdict; reason: string | null;
};
type Gps = { lat: number; lng: number; accuracy: number; addr: string };
type Attendance = { id: string; check_in_at?: string };

const TYPES = [
  { v: 'cleaning', label: 'Cleaning' },
  { v: 'loading', label: 'Loading' },
  { v: 'maintenance', label: 'Maintenance' },
  { v: 'other', label: 'Other' },
];

const C = {
  orange: '#FE6505', text: '#1F2533', text2: '#5B6478', text3: '#8B93A5',
  border: '#E4E7EE', surface: '#FFFFFF', surface2: '#F6F7FA',
  green: '#198754', greenBg: '#E8F5EC', red: '#DC3545', redBg: '#FDECEE',
  amber: '#B8860B', amberBg: '#FFF6E0', blue: '#0D6EFD', blueBg: '#E8F0FE',
};

// ── helpers ──────────────────────────────────────────────────────
function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(file);
  });
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('image load failed'));
    img.src = src;
  });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fmtDistance(m: number | null): string {
  if (m == null) return '—';
  return m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km';
}

/** How the geofence reads to a human. It never blocks; it only describes. */
function verdictChip(l: Loc): { text: string; color: string; bg: string } {
  const d = fmtDistance(l.distance_meters);
  switch (l.verdict) {
    case 'inside':
      return { text: '✓ You are here · ' + d, color: C.green, bg: C.greenBg };
    case 'outside':
      // Stated as a measurement, not an accusation — the pin is as likely wrong as the person.
      return { text: d + ' from saved pin', color: C.amber, bg: C.amberBg };
    case 'uncertain':
      // The phone cannot pin us down — usually indoors. Say so plainly and move on.
      return { text: 'Around ' + d + ' · indoors?', color: C.amber, bg: C.amberBg };
    default:
      return { text: l.reason === 'no GPS fix' ? 'No GPS yet' : 'No coordinates set', color: C.text3, bg: C.surface2 };
  }
}

// ── page ─────────────────────────────────────────────────────────
export default function VisitPage() {
  // mode + step. step is the no-skip spine of the machine flow.
  //   1 location · 2 check in · 3 machine & type · 4 photo · 5 details · 6 done
  const [mode, setMode] = useState<'office' | 'machine' | null>(null);
  const [step, setStep] = useState(1);

  const [gps, setGps] = useState<Gps | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'getting' | 'ok' | 'error'>('idle');
  const [gpsErr, setGpsErr] = useState('');
  const gpsRef = useRef<Gps | null>(null);
  useEffect(() => { gpsRef.current = gps; }, [gps]);

  const [locations, setLocations] = useState<Loc[]>([]);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [reason, setReason] = useState('');

  // The chosen location is a snapshot. When a new GPS fix re-scores every
  // location, re-adopt the fresh copy of the one we picked — otherwise the
  // chip keeps reporting the distance from the moment it was tapped.
  useEffect(() => {
    if (!loc) return;
    const fresh = locations.find((l) => l.id === loc.id);
    if (fresh && (fresh.distance_meters !== loc.distance_meters || fresh.verdict !== loc.verdict)) {
      setLoc(fresh);
    }
  }, [locations, loc]);

  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState('');
  const [visitType, setVisitType] = useState('cleaning');

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [processing, setProcessing] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState('');
  const [damaged, setDamaged] = useState('');
  const [cups, setCups] = useState('');
  const [lids, setLids] = useState('');
  const [film, setFilm] = useState('');
  const [straws, setStraws] = useState('');
  const [visitCount, setVisitCount] = useState(0);

  const machine = machines.find((m) => m.id === machineId);

  // Name is a plain (non-HttpOnly) cookie set at login — safe to read here.
  const [whoName, setWhoName] = useState('');
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)fl_operator_name=([^;]*)/);
    if (m) { try { setWhoName(decodeURIComponent(m[1])); } catch { /* ignore */ } }
  }, []);

  // The session cookie is HttpOnly, so only the server can clear it.
  async function logout() {
    try { await fetch('/api/logout', { method: 'POST' }); } catch { /* clear anyway */ }
    window.location.href = '/login';
  }

  // ── data ───────────────────────────────────────────────────────
  const loadAttendance = useCallback(async () => {
    try {
      const r = await fetch('/api/attendance?current=1', { cache: 'no-store' });
      if (!r.ok) { setAttendance(null); return; }
      const d = await r.json();
      setAttendance(d && d.id ? d : null);
    } catch { setAttendance(null); }
  }, []);

  const loadMachines = useCallback(async () => {
    try {
      const r = await fetch('/api/visit?machines=1', { cache: 'no-store' });
      const d = await r.json();
      setMachines(Array.isArray(d) ? d : (d.machines || []));
    } catch { setMachines([]); }
  }, []);

  useEffect(() => { loadAttendance(); loadMachines(); }, [loadAttendance, loadMachines]);

  /** Ask the server where we are. Distance is computed server-side so the record
   *  means something; the client only reports its raw fix. */
  const fetchLocations = useCallback(async (fix: Gps | null) => {
    try {
      const r = await fetch('/api/attendance/verify-gps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fix ? { lat: fix.lat, lng: fix.lng, accuracy: Math.round(fix.accuracy) } : {}),
      });
      const d = await r.json();
      setLocations(Array.isArray(d.locations) ? d.locations : []);
    } catch { setLocations([]); }
  }, []);

  // GPS is requested on demand — never on page load. Android blocks silent asks.
  //
  // Two things matter here and both bit us in the field:
  //
  //   maximumAge: 0   A cached fix is often a coarse Wi-Fi estimate from before
  //                   the GPS chip locked on. Accepting a 30s-old one made the
  //                   office read "110m from pin" when it was really 17m.
  //
  //   watchPosition   The FIRST fix is almost always the worst. Accuracy
  //                   improves over a few seconds as satellites are acquired,
  //                   so we watch, keep the best reading, and stop early once
  //                   it is good enough. This is the difference between a
  //                   geofence that works and one that cries wolf.
  const GOOD_ENOUGH_M = 20;
  const MAX_WAIT_MS = 12000;

  const getGps = useCallback(() => {
    if (!('geolocation' in navigator)) { setGpsState('error'); setGpsErr('This device has no GPS.'); return; }
    setGpsState('getting'); setGpsErr('');

    let best: { lat: number; lng: number; accuracy: number } | null = null;
    let watchId: number | null = null;
    let settled = false;

    const stop = () => {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    };

    const finish = async () => {
      if (settled) return;
      settled = true;
      stop();
      clearTimeout(timer);

      if (!best) {
        setGpsState('error');
        setGpsErr('Could not get a location. Step outside or near a window, then retry.');
        fetchLocations(null); // never strand: show the list anyway
        return;
      }
      let addr = best.lat.toFixed(4) + 'N ' + best.lng.toFixed(4) + 'E';
      try {
        const r = await fetch('https://api.fruitlinktech.in/rest/app/geocode?lat=' + best.lat + '&lng=' + best.lng, { cache: 'no-store' });
        const d = await r.json();
        if (d && d.addr) addr = d.addr;
      } catch { /* address is a nicety, not a requirement */ }
      const fix: Gps = { lat: best.lat, lng: best.lng, accuracy: best.accuracy, addr };
      setGps(fix); gpsRef.current = fix; setGpsState('ok');
      fetchLocations(fix);
    };

    const timer = setTimeout(finish, MAX_WAIT_MS);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy);
        if (!best || acc < best.accuracy) {
          best = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc };
        }
        if (best.accuracy <= GOOD_ENOUGH_M) finish(); // tight lock, no need to wait
      },
      (e: GeolocationPositionError) => {
        if (best) return; // we already have something usable
        if (settled) return;
        settled = true; stop(); clearTimeout(timer);
        setGpsState('error');
        if (e.code === 1) setGpsErr('Location blocked. Settings → Apps → Chrome → Permissions → Location → Allow.');
        else if (e.code === 2) setGpsErr('Location unavailable. Step near a window and retry.');
        else setGpsErr('Location timed out. Tap retry.');
        fetchLocations(null);
      },
      { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 0 }
    );
  }, [fetchLocations]);

  // ── photo ──────────────────────────────────────────────────────
  function stampPhoto(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const now = new Date();
    const fix = gpsRef.current;
    const lines = ['Fruitlink Visit'];
    const who = (machine && (machine.display_name || machine.sn)) || '';
    lines.push((who ? who + '  ' : '') + now.toLocaleString('en-IN'));
    if (loc) lines.push(loc.name);
    if (fix) {
      lines.push('GPS ' + fix.lat.toFixed(5) + ', ' + fix.lng.toFixed(5) + '  ±' + fix.accuracy + 'm');
      lines.push(fix.addr.length > 55 ? fix.addr.slice(0, 55) + '…' : fix.addr);
    }
    const pad = Math.round(w * 0.02);
    const fs = Math.max(12, Math.round(w * 0.028));
    ctx.font = fs + 'px sans-serif';
    const lineH = fs + 6;
    const boxH = lineH * lines.length + pad;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, h - boxH, w, boxH);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    lines.forEach((ln, i) => ctx.fillText(ln, pad, h - boxH + pad / 2 + i * lineH));
  }

  async function onPhotoPicked(file: File) {
    setErr(''); setUploadFailed(false); setProcessing(true);
    try {
      const img = await loadImage(await readFile(file));
      const MAX = 960;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = Math.round((h * MAX) / w); w = MAX; }
      else if (h >= w && h > MAX) { w = Math.round((w * MAX) / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      stampPhoto(ctx, w, h);
      setPhotoPreview(canvas.toDataURL('image/jpeg', 0.5));
      canvas.toBlob((b) => { if (b) setPhotoBlob(b); }, 'image/jpeg', 0.5);
    } catch {
      setErr('Could not process that photo. Take it again.');
    }
    setProcessing(false);
  }

  function clearPhoto() {
    setPhotoBlob(null); setPhotoPreview(''); setUploadFailed(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  /** A photo is required, so losing one is not acceptable. Retry with backoff;
   *  the blob stays in memory so a failed upload never costs a re-shoot. */
  async function uploadPhoto(blob: Blob, attempts = 3): Promise<string> {
    let lastErr: any = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const presign = await fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: 'visit.jpg', contentType: 'image/jpeg', operator_id: 'visits' }),
        });
        const p = await presign.json();
        if (!p.uploadUrl || !p.publicUrl) throw new Error(p.error || 'upload not configured');
        const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
        if (!put.ok) throw new Error('upload rejected (' + put.status + ')');
        return p.publicUrl as string;
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) await sleep(1200 * (i + 1)); // 1.2s, then 2.4s
      }
    }
    throw lastErr || new Error('photo upload failed');
  }

  // ── actions ────────────────────────────────────────────────────
  // Only ask when the fix is confident AND says he is far. An 'uncertain' fix
  // means the phone cannot see satellites (indoors) — that is not his fault,
  // and prompting on it would fire on every honest visit until it means nothing.
  const needsReason = !!loc && loc.verdict === 'outside';

  async function checkIn(visitMode: 'office' | 'machine') {
    if (!loc) { setErr('Pick a location first.'); return; }
    // No geofence gate. The reason is recorded when offered and skipped when not.
    setBusy(true); setErr('');
    try {
      const fix = gpsRef.current;
      const r = await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machineId || null, location_id: loc.id, visit_mode: visitMode,
          lat: fix ? fix.lat : null, lng: fix ? fix.lng : null, address: fix ? fix.addr : null,
          gps_accuracy_m: fix ? fix.accuracy : null,
          distance_meters: loc.distance_meters, geofence_verdict: loc.verdict,
          override_reason: needsReason ? reason.trim() : null,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!d || !d.id) {
        // Say exactly what the server said, and its status. "Check in failed"
        // on its own is unactionable from a mall.
        const detail = (d && (d.error || d.message)) || 'no response body';
        setErr('Check in failed — HTTP ' + r.status + ': ' + detail);
        setBusy(false); return;
      }
      setAttendance({ id: d.id, check_in_at: d.check_in_at });
      setMsg(d.already_open ? 'You were already checked in.' : '✓ Checked in');
      setTimeout(() => setMsg(''), 2500);
      if (visitMode === 'machine') setStep(3);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function checkOut() {
    if (!attendance) return;
    setBusy(true); setErr('');
    try {
      const fix = gpsRef.current;
      const r = await fetch('/api/attendance?id=' + attendance.id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: fix ? fix.lat : null, lng: fix ? fix.lng : null, address: fix ? fix.addr : null }),
      });
      const d = await r.json();
      if (d && d.error) { setErr(d.error); setBusy(false); return; }
      setAttendance(null);
      setStep(6);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  function consumablesObj() {
    const c: Record<string, number> = {};
    const add = (k: string, v: string) => { const n = parseInt(v); if (!isNaN(n) && n > 0) c[k] = n; };
    add('cups', cups); add('lids', lids); add('film', film); add('straws', straws);
    return Object.keys(c).length ? c : null;
  }

  async function submitVisit() {
    if (!machineId) { setErr('Choose a machine.'); return; }
    if (!photoBlob) { setErr('A photo is required.'); return; }
    setBusy(true); setErr(''); setUploadFailed(false);
    try {
      let photo_url = '';
      try {
        photo_url = await uploadPhoto(photoBlob);
      } catch {
        // Photo is kept. He retries when signal returns; he never re-shoots.
        setUploadFailed(true);
        setErr('Photo upload failed after 3 tries. Your photo is safe — tap Retry when you have signal.');
        setBusy(false); return;
      }
      const fix = gpsRef.current;
      const payload: any = {
        machine_id: machineId, visit_type: visitType, location_id: loc ? loc.id : null,
        note: note.trim() || null, consumables: consumablesObj(), photo_url,
        lat: fix ? fix.lat : null, lng: fix ? fix.lng : null, address: fix ? fix.addr : null,
        gps_accuracy_m: fix ? fix.accuracy : null,
      };
      if (visitType === 'loading') {
        if (loaded !== '') payload.oranges_loaded = parseInt(loaded);
        if (damaged !== '') payload.oranges_damaged = parseInt(damaged);
      }
      const r = await fetch('/api/visit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setErr(
          d.error === 'not_checked_in' ? 'You are not checked in. Go back and check in first.'
          : d.error === 'photo_required' ? 'A photo is required.'
          : (d.message || d.error || 'Could not save visit.')
        );
        setBusy(false); return;
      }
      setVisitCount((n) => n + 1);
      setMsg('✓ Visit saved');
      setNote(''); setLoaded(''); setDamaged(''); setCups(''); setLids(''); setFilm(''); setStraws('');
      clearPhoto(); setMachineId('');
      setStep(6);
    } catch { setErr('Network problem. Try again.'); }
    setBusy(false);
  }

  // ── ui atoms ───────────────────────────────────────────────────
  const inputStyle: any = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid ' + C.border, fontSize: 15, color: C.text, boxSizing: 'border-box', outline: 'none' };

  const Card = ({ children }: any) => (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 18, marginBottom: 14 }}>{children}</div>
  );
  const H = ({ n, children }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{children}</div>
    </div>
  );
  const Btn = ({ onClick, disabled, children, kind }: any) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '13px 16px', borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        border: kind === 'ghost' ? '1px solid ' + C.border : 'none',
        background: disabled ? '#C9CDD6'
          : kind === 'ghost' ? C.surface
          : kind === 'danger' ? C.red
          : kind === 'go' ? C.green   // the fence confirms you are on site
          : C.orange,
        color: kind === 'ghost' ? C.text2 : '#fff', opacity: disabled ? 0.75 : 1,
      }}>{children}</button>
  );

  const STEPS = ['Location', 'Check in', 'Machine', 'Photo', 'Details'];
  const Progress = () => (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
      {STEPS.map((s, i) => {
        const n = i + 1;
        const done = step > n, now = step === n;
        return (
          <div key={s} style={{ flex: 1, textAlign: 'center' as const }}>
            <div style={{ height: 4, borderRadius: 2, background: done ? C.green : now ? C.orange : C.border, marginBottom: 5 }} />
            <div style={{ fontSize: 9.5, fontWeight: 700, color: done ? C.green : now ? C.orange : C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.03em' }}>{s}</div>
          </div>
        );
      })}
    </div>
  );

  const GpsPanel = () => (
    <div style={{ background: C.surface2, borderRadius: 11, padding: 12, marginBottom: 12 }}>
      {gpsState === 'ok' && gps ? (
        <div style={{ fontSize: 12, color: C.text2 }}>📍 {gps.addr}</div>
      ) : gpsState === 'getting' ? (
        <div style={{ fontSize: 13, color: C.text2 }}>Getting a precise location… <span style={{ color: C.text3 }}>(a few seconds)</span></div>
      ) : gpsState === 'error' ? (
        <div style={{ fontSize: 12, color: C.red }}>{gpsErr}</div>
      ) : (
        <div style={{ fontSize: 13, color: C.text2 }}>Location not captured yet.</div>
      )}
      <button onClick={getGps} disabled={gpsState === 'getting'}
        style={{ marginTop: 9, width: '100%', padding: '9px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface, fontSize: 13, fontWeight: 700, color: C.text, cursor: 'pointer' }}>
        {gpsState === 'getting' ? '…' : gpsState === 'ok' ? '🔄 Refresh location' : '📍 Capture my location'}
      </button>
    </div>
  );

  const Banner = () => (
    <>
      {err && <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: '10px 13px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
      {msg && <div style={{ background: C.greenBg, color: C.green, borderRadius: 10, padding: '10px 13px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{msg}</div>}
    </>
  );

  const machinesHere = loc ? machines.filter((m) => m.location_id === loc.id) : machines;
  useEffect(() => {
    if (machinesHere.length === 1 && !machineId) setMachineId(machinesHere[0].id);
  }, [machinesHere, machineId]);
  const officeLoc = locations.find((l) => l.is_office) || null;

  function pickLocation(l: Loc) { setLoc(l); setReason(''); setErr(''); setStep(2); }

  const LocationList = ({ only }: { only?: 'office' | 'machine' }) => {
    const list = only === 'office' ? locations.filter((l) => l.is_office)
      : only === 'machine' ? locations.filter((l) => !l.is_office)
        : locations;
    if (!list.length) return <div style={{ fontSize: 13, color: C.text3, padding: 16, textAlign: 'center' as const }}>No locations found for your account.</div>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
        {list.map((l) => {
          const chip = verdictChip(l);
          const sel = !!loc && loc.id === l.id;
          return (
            <div key={l.id} onClick={() => pickLocation(l)}
              style={{ border: '1px solid ' + (sel ? C.orange : C.border), background: sel ? '#FFF7F2' : C.surface, borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{l.is_office ? '🏢 ' : '🖥 '}{l.name}</div>
              {l.address && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{l.address}</div>}
              <span style={{ display: 'inline-block', marginTop: 7, fontSize: 11, fontWeight: 700, color: chip.color, background: chip.bg, padding: '3px 9px', borderRadius: 20 }}>{chip.text}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const ReasonBox = () =>
    needsReason && loc ? (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: C.text2, fontWeight: 600, marginBottom: 7 }}>
          GPS places you {fmtDistance(loc.distance_meters)} from the saved pin for {loc.name}.
          You can check in either way — a note just helps us fix the pin. <span style={{ color: C.text3, fontWeight: 500 }}>(optional)</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 }}>
          {['At the machine', 'Inside the building', 'Just arrived, outside', 'Pin looks wrong'].map((r) => (
            <button key={r} onClick={() => setReason(reason === r ? '' : r)}
              style={{
                fontSize: 11.5, fontWeight: 700, padding: '6px 10px', borderRadius: 20, cursor: 'pointer',
                border: '1px solid ' + (reason === r ? C.orange : C.border),
                background: reason === r ? C.orange : C.surface, color: reason === r ? '#fff' : C.text2,
              }}>{r}</button>
          ))}
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="or type a note" style={{ ...inputStyle, fontSize: 14 }} />
      </div>
    ) : null;

  // ── render ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.surface2, padding: '18px 14px 40px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <img src={LOGO} alt="" style={{ height: 30 }} />
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>Field Visit</div>
          {attendance && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: C.green, background: C.greenBg, padding: '4px 10px', borderRadius: 20 }}>● Checked in</span>}
        </div>

        {!mode && (
          <>
            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>What are you doing?</div>
              <div style={{ fontSize: 12.5, color: C.text2, marginBottom: 14 }}>Pick one to begin. Every step is recorded.</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                <Btn onClick={() => { setMode('machine'); setStep(1); getGps(); }}>🖥 &nbsp;Machine visit</Btn>
                <Btn kind="ghost" onClick={() => { setMode('office'); setStep(1); getGps(); }}>🏢 &nbsp;Office check in / out</Btn>
              </div>
            </Card>
            {attendance && (
              <Card>
                <div style={{ fontSize: 13, color: C.text2, marginBottom: 10 }}>You have an open check-in from earlier.</div>
                <Btn kind="danger" onClick={checkOut} disabled={busy}>{busy ? '…' : '🔴 Check out now'}</Btn>
              </Card>
            )}
            {/* Logout lives here and nowhere else: this is the only screen with
                no photo in memory and no half-finished visit to lose. */}
            <div style={{ textAlign: 'center' as const, marginTop: 18, fontSize: 12, color: C.text3 }}>
              <div style={{ fontSize: 10, color: C.text3, marginBottom: 6, fontFamily: 'monospace' }}>build {BUILD}</div>
              {whoName ? 'Signed in as ' + whoName : 'Signed in'}
              {' · '}
              <button
                onClick={() => { if (confirm(attendance ? 'You are still checked in. Log out anyway?' : 'Log out?')) logout(); }}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: C.text2, textDecoration: 'underline', cursor: 'pointer' }}>
                Log out
              </button>
            </div>
          </>
        )}

        {mode === 'machine' && (
          <>
            {step <= 5 && <Progress />}
            <Banner />

            {step === 1 && (
              <Card>
                <H n={1}>Where are you?</H>
                <GpsPanel />
                <div style={{ fontSize: 11.5, color: C.text3, marginBottom: 8 }}>Nearest first. Distance is measured, not assumed.</div>
                <LocationList only="machine" />
                <div style={{ marginTop: 10 }}><Btn kind="ghost" onClick={() => setMode(null)}>← Back</Btn></div>
              </Card>
            )}

            {step === 2 && loc && (
              <Card>
                <H n={2}>Check in at {loc.name}</H>
                <GpsPanel />
                <div style={{ background: verdictChip(loc).bg, color: verdictChip(loc).color, borderRadius: 10, padding: '10px 13px', fontSize: 13, fontWeight: 600 }}>
                  {verdictChip(loc).text}
                </div>
                <ReasonBox />
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                  <Btn kind={loc.verdict === 'inside' ? 'go' : undefined} onClick={() => checkIn('machine')} disabled={busy}>
                    {busy ? '…' : loc.verdict === 'inside' ? '✓ Check in here' : 'Check in'}
                  </Btn>
                  <Btn kind="ghost" onClick={() => { setStep(1); setLoc(null); }}>← Different location</Btn>
                </div>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <H n={3}>Which machine?</H>
                {machinesHere.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.text3, padding: 14, textAlign: 'center' as const }}>
                    No machines listed at {loc ? loc.name : 'this location'}. Ask your operator to assign one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 14 }}>
                    {machinesHere.map((m) => (
                      <div key={m.id} onClick={() => {
                      setMachineId(m.id);
                      // Update attendance with the selected machine
                      if (attendance) {
                        fetch('/api/attendance?id=' + attendance.id, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ machine_id: m.id, updated_at: new Date().toISOString() }),
                        }).catch(() => {});
                      }
                    }}
                        style={{ border: '1px solid ' + (machineId === m.id ? C.orange : C.border), background: machineId === m.id ? '#FFF7F2' : C.surface, borderRadius: 11, padding: '11px 13px', cursor: 'pointer' }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>🖥 {m.display_name || m.sn}</div>
                        <div style={{ fontSize: 11, color: C.text3, fontFamily: 'monospace' }}>{m.sn}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Visit type</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {TYPES.map((t) => (
                    <div key={t.v} onClick={() => setVisitType(t.v)}
                      style={{
                        textAlign: 'center' as const, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
                        border: '1px solid ' + (visitType === t.v ? C.orange : C.border),
                        background: visitType === t.v ? C.orange : C.surface, color: visitType === t.v ? '#fff' : C.text2,
                      }}>{t.label}</div>
                  ))}
                </div>
                <Btn onClick={() => { setErr(''); setStep(4); }} disabled={!machineId}>Next → Photo</Btn>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <H n={4}>Photo of {(machine && (machine.display_name || machine.sn)) || 'the machine'}</H>
                <div style={{ fontSize: 12.5, color: C.text2, marginBottom: 12 }}>Required. Time, GPS and machine name are stamped onto the image.</div>
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 10 }} />
                    <label style={{ display: 'block', width: '100%', padding: '10px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface, fontSize: 13, fontWeight: 700, color: C.text2, cursor: 'pointer', marginBottom: 12, textAlign: 'center' as const, boxSizing: 'border-box' as const }}>
                      Retake
                      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onPhotoPicked(f); }} />
                    </label>
                  </>
                ) : (
                  <label style={{ display: 'block', border: '2px dashed ' + C.border, borderRadius: 12, padding: '38px 12px', textAlign: 'center' as const, cursor: 'pointer', marginBottom: 12 }}>
                    <div style={{ fontSize: 30 }}>📷</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text2, marginTop: 6 }}>{processing ? 'Processing…' : 'Tap to take the photo'}</div>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onPhotoPicked(f); }} />
                  </label>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                  <Btn onClick={() => { setErr(''); setStep(5); }} disabled={!photoBlob || processing}>Next → Details</Btn>
                  <Btn kind="ghost" onClick={() => setStep(3)}>← Back</Btn>
                </div>
              </Card>
            )}

            {step === 5 && (
              <Card>
                <H n={5}>Visit details</H>
                {visitType === 'loading' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>Oranges loaded</label>
                      <input value={loaded} onChange={(e) => setLoaded(e.target.value)} type="number" inputMode="numeric" style={{ ...inputStyle, marginTop: 5 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>Damaged</label>
                      <input value={damaged} onChange={(e) => setDamaged(e.target.value)} type="number" inputMode="numeric" style={{ ...inputStyle, marginTop: 5 }} />
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Consumables added (optional)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 7, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: C.text3, fontWeight: 700 }}>Cups</label>
                    <input value={cups} onChange={(e) => setCups(e.target.value)} type="number" inputMode="numeric" style={{ ...inputStyle, padding: '9px 8px', fontSize: 13, marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.text3, fontWeight: 700 }}>Lids</label>
                    <input value={lids} onChange={(e) => setLids(e.target.value)} type="number" inputMode="numeric" style={{ ...inputStyle, padding: '9px 8px', fontSize: 13, marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.text3, fontWeight: 700 }}>Film</label>
                    <input value={film} onChange={(e) => setFilm(e.target.value)} type="number" inputMode="numeric" style={{ ...inputStyle, padding: '9px 8px', fontSize: 13, marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: C.text3, fontWeight: 700 }}>Straws</label>
                    <input value={straws} onChange={(e) => setStraws(e.target.value)} type="number" inputMode="numeric" style={{ ...inputStyle, padding: '9px 8px', fontSize: 13, marginTop: 4 }} />
                  </div>
                </div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>Note (optional)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...inputStyle, marginTop: 5, marginBottom: 14, resize: 'vertical' as const }} />
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                  <Btn onClick={submitVisit} disabled={busy}>{busy ? 'Saving…' : uploadFailed ? '🔄 Retry upload & save' : 'Submit visit'}</Btn>
                  <Btn kind="ghost" onClick={() => setStep(4)}>← Back</Btn>
                </div>
              </Card>
            )}

            {step === 6 && (
              <Card>
                <div style={{ textAlign: 'center' as const, padding: '10px 0 18px' }}>
                  <div style={{ fontSize: 40 }}>✓</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginTop: 6 }}>{attendance ? 'Visit saved' : 'Checked out'}</div>
                  <div style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>
                    {visitCount} visit{visitCount === 1 ? '' : 's'} logged{loc ? ' at ' + loc.name : ''}.
                  </div>
                </div>
                {attendance ? (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    <Btn onClick={() => { setErr(''); setMsg(''); setStep(3); }}>➕ Another visit here</Btn>
                    <Btn kind="danger" onClick={checkOut} disabled={busy}>{busy ? '…' : '🔴 Done — check out'}</Btn>
                  </div>
                ) : (
                  <Btn kind="ghost" onClick={() => { setMode(null); setStep(1); setLoc(null); setVisitCount(0); }}>Start again</Btn>
                )}
              </Card>
            )}
          </>
        )}

        {mode === 'office' && (
          <>
            <Banner />
            {!attendance && step === 1 && (
              <Card>
                <H n={1}>Office check in</H>
                <GpsPanel />
                {officeLoc ? (
                  <>
                    <div onClick={() => { setLoc(officeLoc); setReason(''); }}
                      style={{ border: '1px solid ' + (loc && loc.id === officeLoc.id ? C.orange : C.border), background: loc && loc.id === officeLoc.id ? '#FFF7F2' : C.surface, borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>🏢 {officeLoc.name}</div>
                      <span style={{ display: 'inline-block', marginTop: 7, fontSize: 11, fontWeight: 700, color: verdictChip(officeLoc).color, background: verdictChip(officeLoc).bg, padding: '3px 9px', borderRadius: 20 }}>{verdictChip(officeLoc).text}</span>
                    </div>
                    <ReasonBox />
                    <div style={{ marginTop: 14 }}>
                      <Btn kind={loc && loc.verdict === 'inside' ? 'go' : undefined} onClick={() => checkIn('office')} disabled={busy || !loc}>
                        {busy ? '…' : loc && loc.verdict === 'inside' ? '✓ Check in here' : 'Check in'}
                      </Btn>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: C.text3, padding: 14, textAlign: 'center' as const }}>No office location set for your operator.</div>
                )}
                <div style={{ marginTop: 8 }}><Btn kind="ghost" onClick={() => setMode(null)}>← Back</Btn></div>
              </Card>
            )}

            {attendance && (
              <Card>
                <div style={{ textAlign: 'center' as const, padding: '8px 0 16px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>🏢 At the office</div>
                  {attendance.check_in_at && (
                    <div style={{ fontSize: 12.5, color: C.text2, marginTop: 5 }}>
                      Since {new Date(attendance.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                <GpsPanel />
                <Btn kind="danger" onClick={checkOut} disabled={busy}>{busy ? '…' : '🔴 Check out'}</Btn>
              </Card>
            )}

            {!attendance && step === 6 && (
              <Card>
                <div style={{ textAlign: 'center' as const, padding: '10px 0 18px' }}>
                  <div style={{ fontSize: 40 }}>✓</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginTop: 6 }}>Checked out</div>
                </div>
                <Btn kind="ghost" onClick={() => { setMode(null); setStep(1); setLoc(null); }}>Start again</Btn>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
