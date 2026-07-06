'use client';
import { useState, useEffect } from 'react';

// Dashboard-native Reports — date-wise branded PDF for visits, stock & warehouse.
// Matches the existing dashboard PDF letterhead style.

const C = {
  bg: '#f4f5f9', surface: '#ffffff', border: '#e8eaf0', border2: '#dcdfe9',
  text: '#1f2533', text2: '#5b6478', text3: '#9099ac',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  orange: '#FE6505', blue: '#0D6EFD',
};

const FL_LOGO = 'data:image/jpeg;base64,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';

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

type ReportType = 'visits' | 'received' | 'dispatched' | 'movements' | 'onhand';

const REPORTS: { key: ReportType; label: string; desc: string }[] = [
  { key: 'visits', label: 'Visits', desc: 'Field-staff visits: machine, type, oranges, GPS, time' },
  { key: 'received', label: 'Stock received', desc: 'Warehouse receipts by item' },
  { key: 'dispatched', label: 'Stock dispatched', desc: 'Dispatches from warehouse to machines' },
  { key: 'movements', label: 'Movement log', desc: 'All warehouse movements (receive/dispatch/adjust)' },
  { key: 'onhand', label: 'On-hand snapshot', desc: 'Current stock levels' },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

export default function ReportsSection() {
  const [type, setType] = useState<ReportType>('visits');
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [machineFilter, setMachineFilter] = useState('all');
  const [machineList, setMachineList] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/visit?machines=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setMachineList(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);
  function preset(days: number) { setFrom(daysAgoISO(days)); setTo(todayISO()); }

  async function fetchRows(): Promise<{ cols: string[]; rows: string[][]; title: string }> {
    const fromTs = from + 'T00:00:00+05:30';
    const toTs = to + 'T23:59:59.999+05:30';

    if (type === 'visits') {
      const [vr, mr] = await Promise.all([
        fetch('/api/visit?report=1&from=' + encodeURIComponent(fromTs) + '&to=' + encodeURIComponent(toTs), { cache: 'no-store' }),
        fetch('/api/visit?machines=1', { cache: 'no-store' }),
      ]);
      let d = await vr.json();
      const machines = await mr.json();
      if (!Array.isArray(d)) d = [];
      if (machineFilter !== 'all') d = d.filter((v: any) => v.machine_id === machineFilter);
      const macName = (id: string) => { const m = Array.isArray(machines) ? machines.find((x: any) => x.id === id) : null; return m ? (m.display_name || m.sn) : (id || '').slice(0, 8); };
      const cols = ['Date', 'Machine', 'Type', 'Field staff', 'Oranges (net)', 'Address'];
      const rows = d.map((v: any) => [
        new Date(v.created_at).toLocaleString('en-IN'),
        macName(v.machine_id),
        v.visit_type || '',
        v.staff_name || '-',
        v.oranges_net != null ? String(v.oranges_net) : '-',
        v.address ? String(v.address).slice(0, 40) : '-',
      ]);
      return { cols, rows, title: 'Visits Report' };
    }

    if (type === 'onhand') {
      const r = await fetch('/api/warehouse?onhand=1', { cache: 'no-store' });
      let d = await r.json(); if (!Array.isArray(d)) d = [];
      const cols = ['Category', 'Item', 'On hand', 'Unit', 'Boxes'];
      const rows = d.map((i: any) => [
        i.category, i.name, String(i.on_hand ?? 0), i.base_unit, i.boxes_equiv != null ? String(i.boxes_equiv) : '-',
      ]);
      return { cols, rows, title: 'On-hand Stock Snapshot' };
    }

    // warehouse movements (received / dispatched / movements)
    let url = '/api/warehouse?movements=1&from=' + encodeURIComponent(fromTs) + '&to=' + encodeURIComponent(toTs);
    if (type === 'received') url += '&type=receive';
    if (type === 'dispatched') url += '&type=dispatch';
    const r = await fetch(url, { cache: 'no-store' });
    let d = await r.json(); if (!Array.isArray(d)) d = [];
    if (machineFilter !== 'all') d = d.filter((mv: any) => mv.machine_id === machineFilter);
    // fetch items + machines to resolve names
    const [ir, mr] = await Promise.all([
      fetch('/api/warehouse?items=1', { cache: 'no-store' }),
      fetch('/api/visit?machines=1', { cache: 'no-store' }),
    ]);
    const items = await ir.json(); const machines = await mr.json();
    const itemName = (id: string) => (Array.isArray(items) ? items.find((x: any) => x.id === id) : null)?.name || id.slice(0, 6);
    const macName = (id: string) => { const m = Array.isArray(machines) ? machines.find((x: any) => x.id === id) : null; return m ? (m.display_name || m.sn) : '-'; };

    const cols = ['Date', 'Type', 'Item', 'Qty', 'Machine', 'By', 'Note'];
    const rows = d.map((m: any) => [
      new Date(m.created_at).toLocaleString('en-IN'),
      m.movement_type,
      itemName(m.item_id),
      (m.qty_base >= 0 ? '+' : '') + m.qty_base,
      m.machine_id ? macName(m.machine_id) : '-',
      m.created_by_name || '-',
      m.note ? String(m.note).slice(0, 30) : '-',
    ]);
    const titles: any = { received: 'Stock Received Report', dispatched: 'Stock Dispatched Report', movements: 'Warehouse Movement Log' };
    return { cols, rows, title: titles[type] };
  }

  async function generatePDF() {
    setErr(''); setMsg('');
    if (from > to) { setErr('From date is after To date'); return; }
    setBusy(true);
    try {
      const { cols, rows, title } = await fetchRows();
      if (rows.length === 0) { setErr('No data in that date range.'); setBusy(false); return; }

      const lib = await loadJsPDF();
      const doc = new lib.jsPDF({ unit: 'mm', format: 'a4' });

      // letterhead
      doc.addImage(FL_LOGO, 'JPEG', 14, 8, 50, 21.4);
      doc.setTextColor(28, 35, 51); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text(title, 196, 16, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text('Fruitlink Technologies Pvt Ltd', 196, 22, { align: 'right' });
      doc.setDrawColor(254, 101, 5); doc.setLineWidth(0.6); doc.line(14, 31, 196, 31);

      let y = 40;
      doc.setTextColor(40, 40, 40); doc.setFontSize(10);
      if (type !== 'onhand') doc.text('Period:  ' + from + '  to  ' + to, 14, y);
      else doc.text('As of:  ' + new Date().toLocaleDateString('en-IN'), 14, y);
      doc.text('Generated:  ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 14, y + 5);
      doc.text('Total records:  ' + rows.length, 14, y + 10);
      y += 20;

      // table header
      const drawHeader = (yy: number) => {
        doc.setFillColor(254, 101, 5); doc.rect(14, yy - 5, 182, 7, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        const widths = colWidths(cols.length);
        let x = 16;
        cols.forEach((c, i) => { doc.text(c, x, yy); x += widths[i]; });
        doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
      };
      const colWidths = (n: number) => {
        // distribute 182mm across columns
        if (n === 5) return [34, 34, 30, 40, 44];
        if (n === 6) return [34, 30, 26, 24, 34, 34];
        if (n === 7) return [30, 20, 28, 16, 28, 26, 34];
        return new Array(n).fill(182 / n);
      };

      drawHeader(y); y += 6;
      doc.setFontSize(7.5);
      const widths = colWidths(cols.length);
      rows.forEach((row) => {
        if (y > 285) { doc.addPage(); y = 20; drawHeader(y); y += 6; doc.setFontSize(7.5); }
        let x = 16;
        row.forEach((cell, i) => { doc.text(String(cell).slice(0, 34), x, y); x += widths[i]; });
        y += 5.5;
      });

      doc.save('Fruitlink_' + type + '_' + from + '_to_' + to + '.pdf');
      setMsg('PDF generated (' + rows.length + ' records).');
    } catch (e: any) {
      setErr(e.message || 'Could not generate report');
    }
    setBusy(false);
  }

  async function generateCSV() {
    setErr(''); setMsg('');
    if (from > to) { setErr('From date is after To date'); return; }
    setBusy(true);
    try {
      const { cols, rows } = await fetchRows();
      if (rows.length === 0) { setErr('No data in that date range.'); setBusy(false); return; }
      const esc = (s: string) => '"' + String(s).replace(/"/g, '""') + '"';
      const csv = [cols.map(esc).join(',')].concat(rows.map(r => r.map(esc).join(','))).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Fruitlink_' + type + '_' + from + '_to_' + to + '.csv';
      a.click();
      setMsg('CSV downloaded (' + rows.length + ' records).');
    } catch (e: any) { setErr(e.message || 'Could not export'); }
    setBusy(false);
  }

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100%', overflow: 'auto' }}>
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Reports</div>
        <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5, marginBottom: 16 }}>
          Generate date-wise PDF reports with the Fruitlink letterhead. Pick a report type and date range.
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>Report type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 18 }}>
          {REPORTS.map(rt => (
            <button key={rt.key} onClick={() => setType(rt.key)}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid ' + (type === rt.key ? C.orange : C.border2),
                background: type === rt.key ? '#fff7f0' : '#fff' }}>
              <div style={{ fontWeight: 700, color: type === rt.key ? C.orange : C.text, fontSize: 14 }}>{rt.label}</div>
              <div style={{ fontSize: 11.5, color: C.text3, marginTop: 3, lineHeight: 1.35 }}>{rt.desc}</div>
            </button>
          ))}
        </div>

        {type !== 'onhand' && (<>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>Date range</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: C.text2 }}>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={dateInp} /></label>
            <label style={{ fontSize: 13, color: C.text2 }}>To <input type="date" value={to} onChange={e => setTo(e.target.value)} style={dateInp} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {[['Today', 0], ['7 days', 7], ['30 days', 30], ['90 days', 90]].map(([l, n]) => (
              <button key={l as string} onClick={() => preset(n as number)}
                style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid ' + C.border2, background: '#fff', color: C.text2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </>)}

        {type !== 'onhand' && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>Machine</div>
            <select value={machineFilter} onChange={e => setMachineFilter(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border2, fontSize: 13.5, background: '#fff', color: C.text, cursor: 'pointer', minWidth: 200 }}>
              <option value="all">All machines</option>
              {machineList.map((m: any) => <option key={m.id} value={m.id}>{m.display_name || m.sn}</option>)}
            </select>
          </div>
        )}
        {err && <div style={{ padding: '10px 12px', background: C.redBg, color: C.red, borderRadius: 8, fontSize: 14, marginBottom: 12 }}>{err}</div>}
        {msg && <div style={{ padding: '10px 12px', background: C.greenBg, color: C.green, borderRadius: 8, fontSize: 14, marginBottom: 12 }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={generatePDF} disabled={busy}
            style={{ padding: '12px 26px', border: 'none', borderRadius: 9, background: C.orange, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Working…' : 'Generate PDF'}
          </button>
          <button onClick={generateCSV} disabled={busy}
            style={{ padding: '12px 26px', border: '1px solid ' + C.border2, borderRadius: 9, background: '#fff', color: C.text, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#ffffff', borderRadius: 12, padding: 18, border: '1px solid #e8eaf0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const dateInp: React.CSSProperties = { marginLeft: 6, padding: '8px 10px', fontSize: 14, border: '1px solid #dcdfe9', borderRadius: 8 };
