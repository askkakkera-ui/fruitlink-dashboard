'use client';
import { useState, useEffect, useRef } from 'react';

const LOGO = 'https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/logo.png';

type Machine = { id: string; display_name?: string; sn?: string; location?: string };
type Visit = {
  id: string; machine_id: string; visit_type: string; note?: string;
  oranges_loaded?: number; oranges_damaged?: number; oranges_net?: number;
  photo_url?: string; address?: string; created_at: string;
};
type GpsResult = { lat: number; lng: number; addr: string };

const TYPES = [
  { v: 'cleaning', label: 'Cleaning' },
  { v: 'loading', label: 'Loading' },
  { v: 'maintenance', label: 'Maintenance' },
  { v: 'other', label: 'Other' },
];

export default function VisitPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState('');
  const [visitType, setVisitType] = useState('cleaning');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState('');
  const [damaged, setDamaged] = useState('');
  const [cups, setCups] = useState('');
  const [lids, setLids] = useState('');
  const [film, setFilm] = useState('');
  const [straws, setStraws] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [processing, setProcessing] = useState(false);
  const [gpsResult, setGpsResult] = useState<GpsResult | null>(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [notify, setNotify] = useState<{ recipients: string[]; message: string } | null>(null);
  const [attendance, setAttendance] = useState<{ id: string; check_in_at: string } | null>(null);
  const [attLoading, setAttLoading] = useState(false);
  // Use a ref to access latest gpsResult inside stamp() without closure issues
  const gpsRef = useRef<GpsResult | null>(null);

  const net = (() => {
    const l = parseInt(loaded), d = parseInt(damaged);
    if (isNaN(l)) return '';
    return String((isNaN(d) ? 0 : d) > l ? 0 : l - (isNaN(d) ? 0 : d));
  })();

  // Keep ref in sync with state
  useEffect(() => { gpsRef.current = gpsResult; }, [gpsResult]);

  async function loadAttendance() {
    try {
      const r = await fetch('/api/attendance?current=1', { cache: 'no-store' });
      if (!r.ok) { setAttendance(null); return; }
      const d = await r.json();
      setAttendance(d && d.id ? d : null);
    } catch { setAttendance(null); }
  }
  async function loadMachines() {
    try {
      const r = await fetch('/api/visit?machines=1', { cache: 'no-store' });
      const d = await r.json();
      const list = Array.isArray(d) ? d : (d.machines || []);
      setMachines(list);
      if (list.length && !machineId) setMachineId(list[0].id);
    } catch { }
  }
  async function loadVisits() {
    try {
      const r = await fetch('/api/visit', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d)) setVisits(d);
    } catch { }
  }

  useEffect(() => { loadMachines(); loadVisits(); loadAttendance(); startGps(); }, []);
  useEffect(() => {
    const onFocus = () => { loadVisits(); loadAttendance(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // GPS runs silently in background — never blocks UI
  function startGps() {
    if (!('geolocation' in navigator)) { setGpsMsg('GPS not available'); return; }
    setGpsMsg('Getting location…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        let addr = lat.toFixed(4) + 'N ' + lng.toFixed(4) + 'E';
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { headers: { 'Accept': 'application/json', 'User-Agent': 'FruitlinkApp/1.0' } }
          );
          const d = await r.json();
          if (d?.address) {
            const a = d.address;
            const area = a.quarter || a.suburb || a.neighbourhood || a.city_district || a.county || a.road || '';
            const city = a.city || a.town || a.state_district || a.village || a.state || '';
            if (area || city) addr = [area, city].filter(Boolean).join(', ');
          } else if (d?.display_name) {
            addr = String(d.display_name).split(',').slice(0, 2).join(',').trim();
          }
        } catch { }
        const res: GpsResult = { lat, lng, addr };
        setGpsResult(res);
        gpsRef.current = res;
        setGpsMsg('📍 ' + addr);
      },
      () => { setGpsMsg('Location unavailable — tap Retry'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function onPhotoPicked(file: File) {
    setErr(''); setProcessing(true);
    // Photo processes immediately — GPS already running in background from page load
    try {
      const dataUrl = await readFile(file);
      const img = await loadImage(dataUrl);
      const MAX = 1280;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      else if (h >= w && h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      stampPhoto(ctx, w, h); // uses gpsRef.current — whatever GPS we have right now
      const dataPreview = canvas.toDataURL('image/jpeg', 0.65);
      setPhotoPreview(dataPreview);
      canvas.toBlob(blob => { if (blob) setPhotoBlob(blob); }, 'image/jpeg', 0.65);
      (img as any).src = '';
    } catch {
      setErr('Could not process photo — try again.');
    }
    setProcessing(false);
  }

  function stampPhoto(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const machine = machines.find(m => m.id === machineId);
    const now = new Date();
    const gps = gpsRef.current; // use ref — always current, no closure issue
    const lines = [
      'Fruitlink Visit',
      (machine?.display_name || machine?.sn || '') + '  ' + now.toLocaleString('en-IN'),
    ];
    if (gps) {
      lines.push('GPS ' + gps.lat.toFixed(5) + ', ' + gps.lng.toFixed(5));
      lines.push(gps.addr.length > 55 ? gps.addr.slice(0, 55) + '…' : gps.addr);
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

  function clearPhoto() {
    setPhotoBlob(null);
    setPhotoPreview('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoBlob) return null;
    const presign = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'visit.jpg', contentType: 'image/jpeg', operator_id: 'visits' }),
    });
    const p = await presign.json();
    if (!p.uploadUrl || !p.publicUrl) throw new Error(p.error || 'upload not configured');
    const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: photoBlob });
    if (!put.ok) throw new Error('photo upload failed');
    return p.publicUrl as string;
  }

  function consumablesObj() {
    const c: Record<string, number> = {};
    const add = (k: string, v: string) => { const n = parseInt(v); if (!isNaN(n) && n > 0) c[k] = n; };
    add('cups', cups); add('lids', lids); add('film', film); add('straws', straws);
    return Object.keys(c).length ? c : null;
  }

  async function submit() {
    setErr(''); setMsg(''); setNotify(null);
    if (!machineId) { setErr('Please select a machine'); return; }
    setSaving(true);
    try {
      let photo_url: string | null = null;
      if (photoBlob) {
        try { photo_url = await uploadPhoto(); }
        catch (e: any) { setErr('Photo upload failed — check network and retry.'); setSaving(false); return; }
      }
      const gps = gpsRef.current;
      const payload: any = {
        machine_id: machineId, visit_type: visitType,
        note: note.trim() || null, consumables: consumablesObj(),
        photo_url, lat: gps?.lat ?? null, lng: gps?.lng ?? null, address: gps?.addr ?? null,
      };
      if (visitType === 'loading') {
        if (loaded !== '') payload.oranges_loaded = parseInt(loaded);
        if (damaged !== '') payload.oranges_damaged = parseInt(damaged);
      }
      const r = await fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Could not save visit'); setSaving(false); return; }
      // Success
      setSaving(false);
      setSubmitted(true);
      setMsg('Visit saved ✓');
      setTimeout(() => { setSubmitted(false); setMsg(''); }, 5000);
      if (d.notify?.method === 'deep_link' && Array.isArray(d.notify.recipients) && d.notify.recipients.length) {
        setNotify({ recipients: d.notify.recipients, message: d.notify.message || '' });
      }
      setNote(''); setLoaded(''); setDamaged(''); setCups(''); setLids(''); setFilm(''); setStraws('');
      clearPhoto();
      loadVisits();
      return;
    } catch { setErr('Network problem — please try again.'); }
    setSaving(false);
  }

  const machineLabel = (m: Machine) => m.display_name || m.sn || m.id;
  const machineById = (id: string) => machines.find(m => m.id === id);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <img src={LOGO} alt="Fruitlink" style={{ height: 34 }} />
          <span style={S.title}>Visit Update</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {attendance ? (
              <button disabled={attLoading} onClick={async () => {
                setAttLoading(true);
                try {
                  const gps = gpsRef.current;
                  await fetch('/api/attendance?id=' + attendance.id, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat: gps?.lat, lng: gps?.lng, address: gps?.addr }),
                  });
                  setAttendance(null); await loadAttendance();
                } catch { } finally { setAttLoading(false); }
              }} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#DC3545', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                {attLoading ? '...' : '🔴 Check Out'}
              </button>
            ) : (
              <button disabled={attLoading} onClick={async () => {
                setAttLoading(true);
                try {
                  const gps = gpsRef.current;
                  const r = await fetch('/api/attendance', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ machine_id: machineId || null, lat: gps?.lat, lng: gps?.lng, address: gps?.addr }),
                  });
                  const d = await r.json();
                  if (d?.id) setAttendance(d);
                } catch { } finally { setAttLoading(false); }
              }} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#198754', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                {attLoading ? '...' : '🟢 Check In'}
              </button>
            )}
            <button onClick={() => {
              ['fl_auth','fl_operator_id','fl_role','fl_operator_name','fl_state','fl_country'].forEach(k => document.cookie = k + '=; max-age=0; path=/');
              window.location.href = '/login';
            }} style={{ fontSize: 12, fontWeight: 600, color: '#5b6478', background: 'none', border: '1px solid #e8eaf0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>

        <label style={S.label}>Machine</label>
        <select style={S.input} value={machineId} onChange={e => setMachineId(e.target.value)}>
          {machines.length === 0 && <option value="">No machines available</option>}
          {machines.map(m => <option key={m.id} value={m.id}>{machineLabel(m)}</option>)}
        </select>

        <label style={S.label}>Visit type</label>
        <div style={S.typeRow}>
          {TYPES.map(t => (
            <button key={t.v} type="button" onClick={() => setVisitType(t.v)}
              style={{ ...S.typeBtn, ...(visitType === t.v ? S.typeBtnOn : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        {visitType === 'loading' && (
          <div style={S.loadBox}>
            <label style={S.label}>Oranges loaded</label>
            <input style={S.input} type="number" inputMode="numeric" value={loaded} onChange={e => setLoaded(e.target.value)} placeholder="e.g. 100" />
            <label style={S.label}>Damaged / rejected</label>
            <input style={S.input} type="number" inputMode="numeric" value={damaged} onChange={e => setDamaged(e.target.value)} placeholder="e.g. 2" />
            <div style={S.netRow}>Net loaded: <b>{net === '' ? '—' : net}</b></div>
            <label style={S.label}>Consumables refilled (optional)</label>
            <div style={S.consRow}>
              <input style={S.consInput} type="number" inputMode="numeric" value={cups} onChange={e => setCups(e.target.value)} placeholder="Cups" />
              <input style={S.consInput} type="number" inputMode="numeric" value={lids} onChange={e => setLids(e.target.value)} placeholder="Lids" />
            </div>
            <div style={S.consRow}>
              <input style={S.consInput} type="number" inputMode="numeric" value={film} onChange={e => setFilm(e.target.value)} placeholder="Film" />
              <input style={S.consInput} type="number" inputMode="numeric" value={straws} onChange={e => setStraws(e.target.value)} placeholder="Straws" />
            </div>
          </div>
        )}

        <label style={S.label}>Photo</label>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onPhotoPicked(f); }} />
        {!photoPreview && (
          <button type="button" onClick={() => fileRef.current?.click()} style={S.photoBtn} disabled={processing}>
            {processing ? 'Processing photo…' : '📷 Take photo'}
          </button>
        )}
        {photoPreview && (
          <div>
            <img src={photoPreview} alt="visit" style={S.preview} />
            <button type="button" onClick={() => { clearPhoto(); fileRef.current?.click(); }} style={S.retake}>Retake</button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' as const }}>
          <span style={S.gps}>{gpsMsg || 'Getting location…'}</span>
          {!gpsResult && <button type="button" onClick={startGps} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #D8DCE6', background: '#fff', color: '#1F2533', cursor: 'pointer' }}>🔄 Retry GPS</button>}
        </div>

        <label style={S.label}>Note (optional)</label>
        <textarea style={{ ...S.input, height: 70, resize: 'vertical' } as React.CSSProperties} value={note}
          onChange={e => setNote(e.target.value)} placeholder="Anything worth recording..." />

        {err && <div style={S.err}>{err}</div>}
        {msg && <div style={S.ok}>{msg}</div>}

        {notify?.recipients && notify.recipients.length > 0 && (
          <div style={S.notifyBox}>
            <div style={S.notifyTitle}>Send WhatsApp update</div>
            <div style={S.notifyHint}>Tap each recipient to send the pre-filled update.</div>
            {notify.recipients.map(num => (
              <a key={num} href={`https://wa.me/${num.replace(/[^\d]/g, '')}?text=${encodeURIComponent(notify.message)}`}
                target="_blank" rel="noopener noreferrer" style={S.waBtn}>📲 Send to {num}</a>
            ))}
          </div>
        )}

        <button type="button" onClick={submit} disabled={saving || processing || submitted}
          style={{ ...S.submit, ...(saving || processing ? { opacity: 0.6 } : {}), ...(submitted ? { background: '#198754' } : {}) }}>
          {saving ? 'Saving…' : submitted ? '✓ Visit Saved' : 'Submit visit'}
        </button>
      </div>

      <div style={S.card}>
        <div style={S.subTitle}>My recent visits</div>
        {visits.length === 0 && <div style={S.muted}>No visits yet.</div>}
        {visits.map(v => {
          const m = machineById(v.machine_id);
          return (
            <div key={v.id} style={S.visitRow}>
              <div><b>{m ? machineLabel(m) : v.machine_id.slice(0, 8)}</b><span style={S.badge}>{v.visit_type}</span></div>
              {v.visit_type === 'loading' && v.oranges_net != null && <div style={S.muted}>Loaded net {v.oranges_net}{v.oranges_damaged ? ` (${v.oranges_damaged} damaged)` : ''}</div>}
              {v.note && <div style={S.muted}>{v.note}</div>}
              {v.photo_url && <img src={v.photo_url} alt="" style={S.thumb} />}
              {v.address && <div style={S.muted}>📍 {v.address.length > 60 ? v.address.slice(0, 60) + '…' : v.address}</div>}
              <div style={S.time}>{new Date(v.created_at).toLocaleString('en-IN')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F4F5F9', padding: '16px', maxWidth: 520, margin: '0 auto', boxSizing: 'border-box' },
  card: { background: '#fff', borderRadius: 14, padding: 18, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: 700, color: '#1F2533' },
  subTitle: { fontSize: 16, fontWeight: 700, color: '#1F2533', marginBottom: 10 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#5B6478', margin: '12px 0 5px' },
  input: { width: '100%', padding: '12px', fontSize: 16, border: '1px solid #D8DCE6', borderRadius: 10, boxSizing: 'border-box', background: '#fff', color: '#1F2533' },
  typeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  typeBtn: { padding: '12px 8px', fontSize: 15, border: '1px solid #D8DCE6', borderRadius: 10, background: '#fff', color: '#1F2533', cursor: 'pointer', fontWeight: 600 },
  typeBtnOn: { background: '#FE6505', borderColor: '#FE6505', color: '#fff' },
  loadBox: { background: '#FFF7F0', borderRadius: 10, padding: 12, marginTop: 6 },
  netRow: { fontSize: 15, color: '#1F2533', margin: '8px 0' },
  consRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 },
  consInput: { width: '100%', padding: '10px', fontSize: 15, border: '1px solid #D8DCE6', borderRadius: 8, boxSizing: 'border-box' },
  photoBtn: { width: '100%', padding: '14px', fontSize: 16, fontWeight: 600, color: '#1F2533', background: '#fff', border: '2px dashed #D8DCE6', borderRadius: 10, cursor: 'pointer' },
  preview: { width: '100%', borderRadius: 10, marginTop: 4, display: 'block' },
  retake: { marginTop: 8, padding: '8px 14px', fontSize: 14, background: '#F0F1F5', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#1F2533' },
  gps: { fontSize: 12, color: '#5B6478' },
  submit: { width: '100%', marginTop: 16, padding: '14px', fontSize: 17, fontWeight: 700, color: '#fff', background: '#FE6505', border: 'none', borderRadius: 12, cursor: 'pointer' },
  err: { marginTop: 12, padding: '10px 12px', background: '#FDEEEE', color: '#B42318', borderRadius: 8, fontSize: 14 },
  ok: { marginTop: 12, padding: '10px 12px', background: '#E7F8EF', color: '#198754', borderRadius: 8, fontSize: 14 },
  visitRow: { padding: '10px 0', borderBottom: '1px solid #EEF0F5' },
  badge: { marginLeft: 8, fontSize: 12, padding: '2px 8px', background: '#F0F1F5', borderRadius: 20, color: '#1F2533' },
  thumb: { width: '100%', maxWidth: 220, borderRadius: 8, marginTop: 6, display: 'block' },
  muted: { fontSize: 13, color: '#1F2533', marginTop: 3 },
  time: { fontSize: 12, color: '#5B6478', marginTop: 4 },
  notifyBox: { marginTop: 14, padding: 14, background: '#F0FBF4', border: '1px solid #B7E4C7', borderRadius: 10 },
  notifyTitle: { fontSize: 15, fontWeight: 700, color: '#198754', marginBottom: 2 },
  notifyHint: { fontSize: 12, color: '#1F2533', marginBottom: 10 },
  waBtn: { display: 'block', textAlign: 'center', padding: '12px', marginBottom: 8, background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 10, textDecoration: 'none' },
};
