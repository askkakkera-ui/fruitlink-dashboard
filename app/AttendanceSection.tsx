'use client';
import { useState, useEffect } from 'react';

const C = {
  bg: '#f4f5f9', surface: '#ffffff', surface2: '#f7f8fb', border: '#e8eaf0', border2: '#dcdfe9',
  text: '#1f2533', text2: '#5b6478', text3: '#9099ac',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  orange: '#FE6505', orangeBg: '#fff3ea', blue: '#0D6EFD', blueBg: '#e7f0ff',
  amber: '#c98a00', amberBg: '#fff6e6',
};
const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #e8eaf0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

function fmtDate(t?: string) {
  if (!t) return '—';
  try { return new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }); } catch { return t; }
}
function fmtDuration(inT?: string, outT?: string) {
  if (!inT || !outT) return '—';
  const mins = Math.round((new Date(outT).getTime() - new Date(inT).getTime()) / 60000);
  if (mins < 60) return mins + ' min';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h + 'h ' + (m > 0 ? m + 'm' : '');
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

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

const LOGO_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAoACgDASIAAhEBAxEB/8QAGgAAAgMBAQAAAAAAAAAAAAAAAAYEBQcDAv/EACwQAAIBAwMDAwMFAQAAAAAAAAECAwQFEQASITFBBhNRYSJxgZHBFCOR/8QAGAEAAwEBAAAAAAAAAAAAAAAAAgMEAQX/xAAfEQACAgMBAQEBAAAAAAAAAAABAgADERIhMUFR/9oADAMBAAIRAxEAPwDzJp9xJaXSspYKxAbHTP7VnaydmMi4Uk5Ax0ro7OGFbcStGOZ+pjnpxx0qnGNhHzFg5GVwO9TlHJpFT2TkU1ZQyS3CRiQg5P1HOR7VaGlmK3jVJAVK5O09s+v5qs6TvNpuUhWZGcY+YZP9VpuZVW4MaKo2nI465HX9K0QklWEKRs2VbizW/eFAijPHYd+avxWxvJfmJjBXkBjOfX7Cpq1geS7LqhkijXIUcEE96pNpVoJTJPfuzO2WEa4Ax5nrVqe3uJJBDSqQW5Gq2ywafqFxBPaiWaNlkZWGVzjIx7VoWsLW7y3RJjVSjEkA57Y9K5xrFjLaXJWVgzBhuZSCDkf5W/wAFQxW8e5Q2GB74z9qz5ItbFKbFm1nfXdxcaVdXiyJbOJkgKkBfPHWrXaR/Rq+oLfRiGSI8SFMo+eTk+hFZ9FJYEWkrOXyRJStui5caBa2Ek9nbPcCTf8AzVSQpHp2+lXrS9MtbW3SaA3BUjOJGLJn0HkK574BqxpEsMskiPGu8DkFc5HpSL';

export default function AttendanceSection() {
  const [records, setRecords] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [staffFilter, setStaffFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = '/api/attendance?report=1&from=' + from + 'T00:00:00Z&to=' + to + 'T23:59:59Z';
      if (staffFilter !== 'all') url += '&staff_id=' + staffFilter;
      if (machineFilter !== 'all') url += '&machine_id=' + machineFilter;
      const [rRes, sRes, mRes] = await Promise.all([
        fetch(url),
        fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?select=id,name,email,role,designation&role=in.(field_staff,sub_operator,staff)&order=name.asc')),
        fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name&order=display_name.asc')),
      ]);
      const r = await rRes.json(); setRecords(Array.isArray(r) ? r : []);
      const s = await sRes.json(); setStaff(Array.isArray(s) ? s : []);
      const m = await mRes.json(); setMachines(Array.isArray(m) ? m : []);
    } catch { setRecords([]); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const preset = (days: number) => {
    setFrom(daysAgoISO(days)); setTo(todayISO());
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
      doc.text('Attendance Report', M, 16);
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
        const inDate = r.check_in_at ? new Date(r.check_in_at) : null;
        const vals = [
          String(r.staff_name || '—').slice(0, 20),
          String(r.machine_name || 'Office').slice(0, 22),
          inDate ? inDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—',
          inDate ? inDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—',
          r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'Still in',
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

      doc.save('Fruitlink_Attendance_' + from + '_to_' + to + '.pdf');
    } catch (e) { console.error('PDF error:', e); }
    setExporting(false);
  };

  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 };
  const chip = (active: boolean) => ({ padding: '5px 12px', borderRadius: 20, border: '1px solid ' + (active ? C.orange : C.border), background: active ? C.orangeBg : '#fff', color: active ? C.orange : C.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer' });

  const checkedOut = records.filter(r => r.check_out_at).length;
  const stillIn = records.filter(r => !r.check_out_at).length;

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>Attendance</div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>Field staff check-in / check-out records</div>
        </div>
        <button onClick={exportPDF} disabled={exporting || records.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: exporting || records.length === 0 ? C.border : C.orange, color: '#fff', fontWeight: 700, fontSize: 13, cursor: exporting || records.length === 0 ? 'not-allowed' : 'pointer' }}>
          {exporting ? '⏳ Generating...' : '📄 Export PDF'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Records', value: records.length, color: C.blue, bg: C.blueBg, icon: '📋' },
          { label: 'Completed', value: checkedOut, color: C.green, bg: C.greenBg, icon: '✅' },
          { label: 'Still Checked In', value: stillIn, color: C.orange, bg: C.orangeBg, icon: '🟢' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.text2, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...card, padding: '18px 22px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
          <div>
            <div style={lbl}>Date Range</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text }} />
              <span style={{ color: C.text2 }}>to</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const }}>
              {[['Today', 0], ['7 days', 7], ['30 days', 30]].map(([l, n]) => (
                <button key={String(l)} onClick={() => preset(Number(n))} style={chip(false)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={lbl}>Staff</div>
            <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: '#fff', cursor: 'pointer', minWidth: 160 }}>
              <option value="all">All staff</option>
              {staff.map((s: any) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>Machine</div>
            <select value={machineFilter} onChange={e => setMachineFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, color: C.text, background: '#fff', cursor: 'pointer', minWidth: 160 }}>
              <option value="all">All machines</option>
              {machines.map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>
          <button onClick={fetchData} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', height: 36 }}>
            Generate
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.surface2, borderBottom: '1px solid ' + C.border }}>
                {['Staff', 'Team', 'Machine', 'Date', 'Check In', 'Check Out', 'Duration', 'Check-in GPS', 'Check-out GPS', 'Status'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: C.text3 }}>Loading…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: C.text3 }}>No attendance records for this period.</td></tr>
              ) : records.map((r, i) => {
                const done = !!r.check_out_at;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid ' + C.border, background: i % 2 === 0 ? '#fff' : C.surface2 }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: C.text, fontSize: 13 }}>
                      {r.staff_name || '—'}
                      {r.staff_designation && <div style={{ fontSize: 11, color: C.text3, fontWeight: 400 }}>{r.staff_designation}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12 }}>
                      <span style={{ fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontSize: 11, background: r.team_name === 'Fruitlink' ? '#f5f3ff' : C.blueBg, color: r.team_name === 'Fruitlink' ? '#7c3aed' : C.blue }}>
                        {r.team_name || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: C.text, fontSize: 13 }}>{r.machine_name || 'Office'}</td>
                    <td style={{ padding: '12px 14px', color: C.text, fontSize: 13, whiteSpace: 'nowrap' }}>{r.check_in_at ? new Date(r.check_in_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td style={{ padding: '12px 14px', color: C.text, fontSize: 13, whiteSpace: 'nowrap' }}>{fmtDate(r.check_in_at)}</td>
                    <td style={{ padding: '12px 14px', color: C.text, fontSize: 13, whiteSpace: 'nowrap' }}>{r.check_out_at ? fmtDate(r.check_out_at) : <span style={{ color: C.orange, fontWeight: 600 }}>Still in</span>}</td>
                    <td style={{ padding: '12px 14px', color: C.text, fontSize: 13, whiteSpace: 'nowrap' }}>{fmtDuration(r.check_in_at, r.check_out_at)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12 }}>
                      {r.check_in_lat != null ? <a href={'https://maps.google.com/?q=' + r.check_in_lat + ',' + r.check_in_lng} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>📍 View</a> : <span style={{ color: C.text3 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12 }}>
                      {r.check_out_lat != null ? <a href={'https://maps.google.com/?q=' + r.check_out_lat + ',' + r.check_out_lng} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>📍 View</a> : <span style={{ color: C.text3 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: done ? C.greenBg : C.orangeBg, color: done ? C.green : C.orange }}>
                        {done ? '✓ Done' : '● Active'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
