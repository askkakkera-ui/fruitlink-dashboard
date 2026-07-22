'use client';
import { useState, useEffect } from 'react';

// Fruitlink INTERNAL-team attendance page. Structurally a sibling of
// AttendanceSection: same _ds tokens, same primitives (StatCardA / RecordRow /
// RecordCardM / TeamPill …), same layout — only the data source differs. It
// reads /api/attendance-internal (super_admin-only, internal-scoped server-side)
// so tenant field-staff rows never reach this component. The existing
// Operator-Management Attendance page and its route are left untouched.

// The Fruitlink super_admin operator — used to scope the Staff filter dropdown to
// the internal team only (mirrors the server route's owner_id filter).
const FRUITLINK_OWNER_ID = '0c1bd083-682a-4913-ac37-08c85ef94b41';

// Tokens mirror _ds/tokens/colors.css (ground truth: dashboard.tsx `C`).
const C = {
  bg: '#f4f5f9', surface: '#ffffff', surface2: '#f7f8fb', border: '#e8eaf0', border2: '#dcdfe9',
  text: '#1f2533', text2: '#5b6478', text3: '#9099ac',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  orange: '#FE6505', orangeBg: '#fff3ea', blue: '#0D6EFD', blueBg: '#e7f0ff',
  amber: '#c98a00', amberBg: '#fff6e6',
  indigo: '#423A8E', indigoBg: '#efeefc', purple: '#7C3AED', purpleBg: '#EDE9FE',
};
// The design references var(--shadow-card)/var(--shadow-brand-chip); those CSS
// vars aren't defined in this app, so inline the literals. --font-mono IS defined.
const SHADOW_CARD = '0 1px 3px rgba(0,0,0,0.04)';
const SHADOW_BRAND = '0 2px 8px rgba(254,101,5,0.28)';
const MONO = 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)';
const cardStyle: React.CSSProperties = { background: C.surface, borderRadius: 14, border: '1px solid ' + C.border, boxShadow: SHADOW_CARD };

// ── formatting helpers ────────────────────────────────────────────────
function fmtDuration(inT?: string, outT?: string) {
  if (!inT || !outT) return '—';
  const mins = Math.round((new Date(outT).getTime() - new Date(inT).getTime()) / 60000);
  if (mins < 60) return mins + ' min';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h + 'h ' + (m > 0 ? m + 'm' : '');
}
function durationMs(inT?: string, outT?: string): number | null {
  if (!inT || !outT) return null;
  return new Date(outT).getTime() - new Date(inT).getTime();
}
function durLabel(ms: number | null) {
  if (ms == null) return '—';
  const h = Math.floor(ms / 3600e3), m = Math.round((ms % 3600e3) / 60e3);
  return (h > 0 ? h + 'h ' : '') + m + 'm';
}
function dayLabel(t?: string, tz = 'Asia/Kolkata') {
  if (!t) return '—';
  try { return new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz }); } catch { return '—'; }
}
function timeLabel(t?: string, tz = 'Asia/Kolkata') {
  if (!t) return '—';
  try { return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return '—'; }
}
function initialA(s?: string) { return (s || '?').charAt(0).toUpperCase(); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

function useIsMobile(bp = 860) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < bp);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [bp]);
  return m;
}

function loadJsPDF(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).jspdf) return resolve((window as any).jspdf);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload = () => resolve((window as any).jspdf);
    s.onerror = () => reject(new Error('Could not load PDF library'));
    document.body.appendChild(s);
  });
}

// ── DS primitives (ported from _ds_bundle.js: StatusDot + Pill) ───────
function StatusDot({ color = C.green, size = 7, pulse = false, style }: { color?: string; size?: number; pulse?: boolean; style?: React.CSSProperties }) {
  return (
    <>
      {pulse && <style>{`@keyframes fl-pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>}
      <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, animation: pulse ? 'fl-pulse 2s infinite' : 'none', ...style }} />
    </>
  );
}
function Pill({ children, color = C.green, bg, dot = false, pulse = false, style }: { children: React.ReactNode; color?: string; bg?: string; dot?: boolean; pulse?: boolean; style?: React.CSSProperties }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: bg || 'color-mix(in srgb, ' + color + ' 12%, transparent)', color, border: '1px solid color-mix(in srgb, ' + color + ' 30%, transparent)', ...style }}>
      {dot && <StatusDot color={color} size={5} pulse={pulse} />}
      {children}
    </span>
  );
}

function AvatarA({ name }: { name?: string }) {
  return <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: C.orange, background: C.orangeBg, border: '1px solid color-mix(in srgb, ' + C.orange + ' 22%, transparent)' }}>{initialA(name)}</div>;
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) return <Pill color={C.orange} bg={C.orangeBg} dot pulse style={{ fontWeight: 800 }}>Active</Pill>;
  return <Pill color={C.green} bg={C.greenBg} style={{ fontWeight: 800 }}>✓ Done</Pill>;
}

// Two-population signal: Fruitlink internal (purple) vs tenant operator (blue).
// team_name is already resolved server-side; nothing here filters, only colours.
function TeamPill({ team }: { team?: string }) {
  const isFL = team === 'Fruitlink';
  return <Pill color={isFL ? C.purple : C.blue} bg={isFL ? C.purpleBg : C.blueBg} style={{ fontWeight: 700 }}>{team || '—'}</Pill>;
}

// Older attendance rows predate check-out GPS capture, so lat/lng are null on
// most of them — render an em dash, never a pin that links nowhere.
function GpsLink({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  if (lat == null || lng == null) return <span style={{ fontSize: 12, color: C.text3 }}>—</span>;
  return <a href={'https://www.google.com/maps?q=' + lat + ',' + lng} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: C.blue, textDecoration: 'none' }}>📍 View</a>;
}

function StatCardA({ label, value, sub, color, icon, live = false }: { label: string; value: number; sub: string; color: string; icon: string; live?: boolean }) {
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, boxShadow: SHADOW_CARD, overflow: 'hidden' }}>
      <div style={{ height: 3, background: color }} />
      <div style={{ padding: '15px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: C.text2, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
          <span style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, background: 'color-mix(in srgb, ' + color + ' 14%, transparent)' }}>{icon}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {live && <StatusDot color={color} size={9} pulse />}
          <span style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: '-.02em', lineHeight: 1 }}>{value}</span>
        </div>
        <div style={{ fontSize: 12, color: C.text2, marginTop: 7, fontWeight: 600 }}>{sub}</div>
      </div>
    </div>
  );
}

function RecordRow({ r, zebra }: { r: any; zebra: boolean }) {
  const active = !r.check_out_at;
  const durMs = durationMs(r.check_in_at, r.check_out_at);
  const tz = r.tenant_timezone || 'Asia/Kolkata';
  const td: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'middle' };
  return (
    <tr style={{ borderBottom: '1px solid ' + C.border, background: zebra ? C.surface2 : C.surface }}>
      <td style={td}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <AvatarA name={r.staff_name} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text, whiteSpace: 'nowrap' }}>{r.staff_name || '—'}</span>
              {r.staff_employee_id && <span style={{ fontSize: 10, color: C.text3, fontWeight: 700, background: C.surface2, padding: '1px 6px', borderRadius: 5 }}>{r.staff_employee_id}</span>}
            </div>
            {r.staff_designation && <div style={{ fontSize: 11, color: C.text3 }}>{r.staff_designation}</div>}
          </div>
        </div>
      </td>
      <td style={td}><TeamPill team={r.team_name} /></td>
      <td style={td}><span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.blue }}>{r.machine_name || 'Office'}</span></td>
      <td style={{ ...td, fontSize: 12.5, color: C.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{dayLabel(r.check_in_at, tz)}</td>
      <td style={{ ...td, fontSize: 13, color: C.text, fontWeight: 700, whiteSpace: 'nowrap' }}>{timeLabel(r.check_in_at, tz)}</td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>{active ? <span style={{ fontSize: 12.5, fontWeight: 800, color: C.orange }}>Still in</span> : <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{timeLabel(r.check_out_at, tz)}</span>}</td>
      <td style={{ ...td, fontSize: 13, fontWeight: 800, color: durMs == null ? C.text3 : C.text, whiteSpace: 'nowrap' }}>{durLabel(durMs)}</td>
      <td style={td}><GpsLink lat={r.check_in_lat} lng={r.check_in_lng} /></td>
      <td style={td}><GpsLink lat={r.check_out_lat} lng={r.check_out_lng} /></td>
      <td style={td}><StatusBadge active={active} /></td>
    </tr>
  );
}

function RecordCardM({ r }: { r: any }) {
  const active = !r.check_out_at;
  const durMs = durationMs(r.check_in_at, r.check_out_at);
  const tz = r.tenant_timezone || 'Asia/Kolkata';
  const tiles: [string, string, string][] = [
    ['Check In', timeLabel(r.check_in_at, tz), C.text],
    ['Check Out', active ? 'Still in' : timeLabel(r.check_out_at, tz), active ? C.orange : C.text],
    ['Duration', durLabel(durMs), durMs == null ? C.text3 : C.text],
  ];
  return (
    <div style={{ ...cardStyle, borderRadius: 13, overflow: 'hidden' }}>
      <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0 }}>
            <AvatarA name={r.staff_name} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{r.staff_name || '—'}</div>
              <div style={{ fontSize: 12, color: C.text3 }}>{dayLabel(r.check_in_at, tz)}</div>
            </div>
          </div>
          <StatusBadge active={active} />
        </div>
        <div style={{ fontSize: 12.5, color: C.text2, fontWeight: 600, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <TeamPill team={r.team_name} />
          <span style={{ color: C.blue, fontFamily: MONO, fontWeight: 700 }}>{r.machine_name || 'Office'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {tiles.map(([l, v, c]) => (
            <div key={l} style={{ background: C.surface2, border: '1px solid ' + C.border, borderRadius: 9, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.text3, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: C.text3, fontWeight: 700 }}>GPS:</span>
          <span style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11.5, color: C.text3 }}>In <GpsLink lat={r.check_in_lat} lng={r.check_in_lng} /></span>
          <span style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11.5, color: C.text3 }}>Out <GpsLink lat={r.check_out_lat} lng={r.check_out_lng} /></span>
        </div>
      </div>
    </div>
  );
}

const fLblA: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 };
const fInputA: React.CSSProperties = { font: 'inherit', padding: '9px 11px', borderRadius: 9, border: '1.5px solid ' + C.border2, fontSize: 13, color: C.text, background: C.surface, outline: 'none', boxSizing: 'border-box' };
function chipStyle(active: boolean): React.CSSProperties {
  return { font: 'inherit', fontSize: 12.5, fontWeight: 700, borderRadius: 20, padding: '7px 14px', cursor: 'pointer', color: active ? '#fff' : C.text2, background: active ? C.orange : C.surface2, border: '1px solid ' + (active ? 'transparent' : C.border), whiteSpace: 'nowrap' };
}

export default function InternalAttendanceSection() {
  const isMobile = useIsMobile(860);
  const [records, setRecords] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [staffFilter, setStaffFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [quick, setQuick] = useState('7');
  const [exporting, setExporting] = useState(false);

  // Data source: the internal-only report. The server scopes rows to Fruitlink's
  // own team (super_admin | staff owned by Fruitlink), so tenant field staff can
  // never appear here regardless of filters. The Staff dropdown is likewise
  // scoped to the internal team via owner_id.
  const fetchData = async () => {
    setLoading(true);
    try {
      let url = '/api/attendance-internal?report=1&from=' + from + 'T00:00:00Z&to=' + to + 'T23:59:59Z';
      if (staffFilter !== 'all') url += '&staff_id=' + staffFilter;
      if (machineFilter !== 'all') url += '&machine_id=' + machineFilter;
      const [rRes, sRes, mRes] = await Promise.all([
        fetch(url),
        fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?select=id,name,email,role&role=in.(super_admin,staff)&owner_id=eq.' + FRUITLINK_OWNER_ID + '&order=name.asc')),
        fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name&order=display_name.asc')),
      ]);
      const r = await rRes.json(); setRecords(Array.isArray(r) ? r : []);
      const s = await sRes.json(); setStaff(Array.isArray(s) ? s : []);
      const m = await mRes.json(); setMachines(Array.isArray(m) ? m : []);
    } catch { setRecords([]); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const applyQuick = (key: string, days: number) => {
    setFrom(daysAgoISO(days)); setTo(todayISO()); setQuick(key);
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await loadJsPDF();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const ORANGE = [254, 101, 5], NAVY = [44, 62, 80], GRAY = [91, 100, 120];
      const W = 297, M = 14;

      // Header
      doc.setFillColor(...NAVY); doc.rect(0, 0, W, 22, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
      doc.text('FRUITLINK TECHNOLOGIES PVT LTD', M, 10);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('Team Attendance Report (Internal)', M, 16);
      doc.setFontSize(9);
      doc.text('Period: ' + from + ' to ' + to, W - M, 10, { align: 'right' });
      doc.text('Generated: ' + new Date().toLocaleString('en-IN'), W - M, 16, { align: 'right' });

      // Orange rule
      doc.setFillColor(...ORANGE); doc.rect(0, 22, W, 2, 'F');

      // Summary
      const checked_out = records.filter(r => r.check_out_at).length;
      const still_in = records.filter(r => !r.check_out_at).length;
      doc.setTextColor(...NAVY); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('Total records: ' + records.length + '   |   Completed: ' + checked_out + '   |   Still checked in: ' + still_in, M, 30);

      // Table headers
      const cols = [
        { label: 'Staff', w: 35 },
        { label: 'Machine / Location', w: 40 },
        { label: 'Date', w: 28 },
        { label: 'Check In', w: 32 },
        { label: 'Check Out', w: 32 },
        { label: 'Duration', w: 22 },
        { label: 'Check-in GPS', w: 50 },
        { label: 'Check-out GPS', w: 50 },
      ];
      let x = M, y = 36;
      doc.setFillColor(...NAVY);
      doc.rect(M, y - 4, W - M * 2, 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      cols.forEach(c => { doc.text(c.label, x + 1, y); x += c.w; });
      y += 5;

      // Rows
      records.forEach((r, i) => {
        if (y > 180) { doc.addPage(); y = 20; }
        doc.setFillColor(i % 2 === 0 ? 247 : 255, i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 251 : 255);
        doc.rect(M, y - 4, W - M * 2, 6, 'F');
        doc.setTextColor(...NAVY); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        x = M;
        const tz = r.tenant_timezone || 'Asia/Kolkata';
        const inDate = r.check_in_at ? new Date(r.check_in_at) : null;
        const vals = [
          String(r.staff_name || '—').slice(0, 20),
          String(r.machine_name || 'Office').slice(0, 22),
          inDate ? inDate.toLocaleDateString('en-IN', { timeZone: tz }) : '—',
          inDate ? inDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : '—',
          r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : 'Still in',
          fmtDuration(r.check_in_at, r.check_out_at),
          r.check_in_lat != null ? r.check_in_lat.toFixed(5) + ', ' + r.check_in_lng.toFixed(5) : '—',
          r.check_out_lat != null ? r.check_out_lat.toFixed(5) + ', ' + r.check_out_lng.toFixed(5) : '—',
        ];
        cols.forEach((c, ci) => { doc.text(String(vals[ci]), x + 1, y); x += c.w; });
        y += 6;
      });

      if (records.length === 0) {
        doc.setTextColor(...GRAY); doc.setFontSize(10);
        doc.text('No attendance records found for the selected period.', W / 2, 80, { align: 'center' });
      }

      // Footer
      doc.setFillColor(...NAVY); doc.rect(0, 200, W, 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text('Fruitlink Technologies Pvt Ltd  ·  Confidential', M, 205);
      doc.text('Page 1', W - M, 205, { align: 'right' });

      doc.save('Fruitlink_Team_Attendance_' + from + '_to_' + to + '.pdf');
    } catch (e) { console.error('PDF error:', e); }
    setExporting(false);
  };

  const total = records.length;
  const checkedOut = records.filter(r => r.check_out_at).length;
  const stillIn = records.filter(r => !r.check_out_at).length;
  const pdfDisabled = exporting || records.length === 0;
  const cols = ['Staff', 'Team', 'Machine', 'Date', 'Check In', 'Check Out', 'Duration', 'Check-in GPS', 'Check-out GPS', 'Status'];

  return (
    <div style={{ padding: isMobile ? '18px 16px 40px' : '24px 28px 40px', background: C.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', color: C.text, margin: 0 }}>Team Attendance</h1>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 4, fontWeight: 600 }}>Fruitlink internal team check-in / check-out records</div>
        </div>
        <button onClick={exportPDF} disabled={pdfDisabled}
          style={{ font: 'inherit', padding: '10px 20px', borderRadius: 9, border: 'none', background: pdfDisabled ? C.border : C.orange, color: '#fff', fontWeight: 800, cursor: pdfDisabled ? 'not-allowed' : 'pointer', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, boxShadow: pdfDisabled ? 'none' : SHADOW_BRAND }}>
          {exporting ? '⏳ Generating…' : '⬇ Export PDF'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
        <StatCardA label="Total Records" value={total} sub="in selected range" color={C.indigo} icon="🗂" />
        <StatCardA label="Completed" value={checkedOut} sub="checked out" color={C.green} icon="✅" />
        <StatCardA label="Still Checked In" value={stillIn} sub="on shift now" color={C.orange} icon="🕑" live />
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, borderRadius: 12, padding: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={fLblA}>From</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setQuick(''); }} style={fInputA} />
          </div>
          <div>
            <label style={fLblA}>To</label>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setQuick(''); }} style={fInputA} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={fLblA}>Staff</label>
            <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={{ ...fInputA, width: '100%', cursor: 'pointer' }}>
              <option value="all">All staff</option>
              {staff.map((s: any) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={fLblA}>Machine</label>
            <select value={machineFilter} onChange={e => setMachineFilter(e.target.value)} style={{ ...fInputA, width: '100%', cursor: 'pointer' }}>
              <option value="all">All machines</option>
              {machines.map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>
          <button onClick={fetchData} style={{ font: 'inherit', padding: '10px 22px', borderRadius: 9, border: 'none', background: C.indigo, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13.5, whiteSpace: 'nowrap' }}>Generate</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: C.text3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Quick range</span>
          <button onClick={() => applyQuick('today', 0)} style={chipStyle(quick === 'today')}>Today</button>
          <button onClick={() => applyQuick('7', 7)} style={chipStyle(quick === '7')}>7 days</button>
          <button onClick={() => applyQuick('30', 30)} style={chipStyle(quick === '30')}>30 days</button>
        </div>
      </div>

      {/* Result count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 2px' }}>
        <span style={{ fontSize: 12.5, color: C.text2, fontWeight: 700 }}>Showing <b style={{ color: C.text }}>{total}</b> record{total !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>{from} → {to}</span>
      </div>

      {/* Body */}
      {loading
        ? <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 20px', color: C.text3, fontSize: 14, fontWeight: 600 }}>Loading…</div>
        : total === 0
          ? <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>🕑</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>No attendance records</div>
              <div style={{ fontSize: 13, color: C.text3, marginTop: 6 }}>Adjust the date range or filters, then Generate.</div>
            </div>
          : isMobile
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{records.map(r => <RecordCardM key={r.id} r={r} />)}</div>
            : <div style={{ ...cardStyle, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: C.surface2, borderBottom: '1px solid ' + C.border }}>
                        {cols.map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 800, color: C.text3, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>{records.map((r, i) => <RecordRow key={r.id} r={r} zebra={i % 2 === 1} />)}</tbody>
                  </table>
                </div>
              </div>}
    </div>
  );
}
