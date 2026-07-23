'use client';
import { useState, useEffect, useMemo } from 'react';
import { useIsMobile } from './lib/dashboard-shared';

// Shared date-grouped accordion for the two attendance pages (Operator Attendance
// = AttendanceSection, Team Attendance = InternalAttendanceSection). Owns ONLY the
// grouped-list body: grouping, the group header (weekday label + count + chevron),
// the single-open accordion, and the per-group table / mobile-card rendering with
// the "+1d" cross-midnight marker and the amber >12h duration badge. Each page keeps
// its own chrome (title, summary cards, filters, PDF, data fetch, loading/empty).
//
// The group key is byte-identical to each page's DATE cell — dayLabel(check_in_at,
// tz) — so grouping moves zero rows. Verified live on Operator Attendance (c29cd58);
// this extraction must not change that page's behaviour.

// Tokens mirror _ds/tokens/colors.css (ground truth: dashboard.tsx `C`).
const C = {
  bg: '#f4f5f9', surface: '#ffffff', surface2: '#f7f8fb', border: '#e8eaf0', border2: '#dcdfe9',
  text: '#1f2533', text2: '#5b6478', text3: '#9099ac',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  orange: '#FE6505', orangeBg: '#fff3ea', blue: '#0D6EFD', blueBg: '#e7f0ff',
  amber: '#c98a00', amberBg: '#fff6e6',
  indigo: '#423A8E', indigoBg: '#efeefc', purple: '#7C3AED', purpleBg: '#EDE9FE',
};
const SHADOW_CARD = '0 1px 3px rgba(0,0,0,0.04)';
const MONO = 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)';
const cardStyle: React.CSSProperties = { background: C.surface, borderRadius: 14, border: '1px solid ' + C.border, boxShadow: SHADOW_CARD };

// ── formatting helpers ────────────────────────────────────────────────
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
// Sortable calendar day in the SAME tz used by dayLabel — parallel derivation
// of the grouping key, never the group key itself (that must stay byte-identical
// to the DATE cell = dayLabel). 'en-CA' yields YYYY-MM-DD, lexicographically sortable.
function isoDay(t?: string, tz = 'Asia/Kolkata'): string {
  if (!t) return '';
  try { return new Date(t).toLocaleDateString('en-CA', { timeZone: tz }); } catch { return ''; }
}
// Whole-day difference between two YYYY-MM-DD strings (b - a). Used for the "+Nd"
// check-out marker so a 01:58 am next-day check-out can't read as before a 15:16 in.
function dayDiff(isoA: string, isoB: string): number {
  if (!isoA || !isoB) return 0;
  return Math.round((Date.parse(isoB + 'T00:00:00Z') - Date.parse(isoA + 'T00:00:00Z')) / 86400000);
}
const LONG_SHIFT_MS = 12 * 3600e3; // >12h → amber, flags likely-unclosed sessions
function initialA(s?: string) { return (s || '?').charAt(0).toUpperCase(); }

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

function StatusBadge({ active, durMs, elapsedMs }: { active: boolean; durMs?: number | null; elapsedMs?: number | null }) {
  if (active) {
    // An open session past the same >12h bar is a data problem (forgotten check-out).
    // Static amber + elapsed time — no pulse: a 7-day-open row would pulse forever on
    // every load, and motion is noise, not signal. Distinct from the closed "⚠ <dur>"
    // badge via colour + the "open" suffix.
    if (elapsedMs != null && elapsedMs > LONG_SHIFT_MS) return <Pill color={C.amber} bg={C.amberBg} style={{ fontWeight: 800 }}>{durLabel(elapsedMs)} open</Pill>;
    return <Pill color={C.orange} bg={C.orangeBg} dot pulse style={{ fontWeight: 800 }}>Active</Pill>;
  }
  // >12h almost always means an unclosed session (check-out == next check-in), so
  // surface it in amber rather than a reassuring green "Done" or a bogus day-total.
  if (durMs != null && durMs > LONG_SHIFT_MS) return <Pill color={C.amber} bg={C.amberBg} style={{ fontWeight: 800 }}>⚠ {durLabel(durMs)}</Pill>;
  return <Pill color={C.green} bg={C.greenBg} style={{ fontWeight: 800 }}>✓ Done</Pill>;
}

// "+Nd" marker when a check-out lands on a later calendar day than its group.
function PlusDay({ n }: { n: number }) {
  return <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 800, color: C.amber, background: C.amberBg, borderRadius: 5, padding: '1px 5px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>+{n}d</span>;
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

// groupIso = the group's YYYY-MM-DD (check-in day). Rendered inside an open group,
// so the DATE column is dropped (redundant under the header).
function RecordRow({ r, zebra, groupIso, now }: { r: any; zebra: boolean; groupIso: string; now: number }) {
  const active = !r.check_out_at;
  const durMs = durationMs(r.check_in_at, r.check_out_at);
  const tz = r.tenant_timezone || 'Asia/Kolkata';
  const outDiff = !active && r.check_out_at ? dayDiff(groupIso, isoDay(r.check_out_at, tz)) : 0;
  // Open session: elapsed = now - check-in. Past the >12h bar it's a stale/forgotten
  // check-out (a data problem), flagged amber like the closed-row treatment.
  const elapsedMs = active && r.check_in_at ? now - new Date(r.check_in_at).getTime() : null;
  const staleOpen = elapsedMs != null && elapsedMs > LONG_SHIFT_MS;
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
      <td style={{ ...td, fontSize: 13, color: C.text, fontWeight: 700, whiteSpace: 'nowrap' }}>{timeLabel(r.check_in_at, tz)}</td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>{active ? <span style={{ fontSize: 12.5, fontWeight: 800, color: staleOpen ? C.amber : C.orange }}>Still in</span> : <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{timeLabel(r.check_out_at, tz)}{outDiff > 0 && <PlusDay n={outDiff} />}</span>}</td>
      <td style={{ ...td, fontSize: 13, fontWeight: 800, color: active ? (staleOpen ? C.amber : C.text3) : durMs == null ? C.text3 : durMs > LONG_SHIFT_MS ? C.amber : C.text, whiteSpace: 'nowrap' }}>{active ? (staleOpen ? durLabel(elapsedMs) : '—') : durLabel(durMs)}</td>
      <td style={td}><GpsLink lat={r.check_in_lat} lng={r.check_in_lng} /></td>
      <td style={td}><GpsLink lat={r.check_out_lat} lng={r.check_out_lng} /></td>
      <td style={td}><StatusBadge active={active} durMs={durMs} elapsedMs={elapsedMs} /></td>
    </tr>
  );
}

function RecordCardM({ r, groupIso, now }: { r: any; groupIso: string; now: number }) {
  const active = !r.check_out_at;
  const durMs = durationMs(r.check_in_at, r.check_out_at);
  const tz = r.tenant_timezone || 'Asia/Kolkata';
  const outDiff = !active && r.check_out_at ? dayDiff(groupIso, isoDay(r.check_out_at, tz)) : 0;
  // Open session: elapsed = now - check-in; amber past the >12h bar (forgotten check-out).
  const elapsedMs = active && r.check_in_at ? now - new Date(r.check_in_at).getTime() : null;
  const staleOpen = elapsedMs != null && elapsedMs > LONG_SHIFT_MS;
  // Date subtitle dropped — the group header already carries the day (redundant here).
  const tiles: { l: string; v: string; c: string; plus: number }[] = [
    { l: 'Check In', v: timeLabel(r.check_in_at, tz), c: C.text, plus: 0 },
    { l: 'Check Out', v: active ? 'Still in' : timeLabel(r.check_out_at, tz), c: active ? (staleOpen ? C.amber : C.orange) : C.text, plus: outDiff },
    { l: 'Duration', v: active ? (staleOpen ? durLabel(elapsedMs) : '—') : durLabel(durMs), c: active ? (staleOpen ? C.amber : C.text3) : durMs == null ? C.text3 : durMs > LONG_SHIFT_MS ? C.amber : C.text, plus: 0 },
  ];
  return (
    <div style={{ ...cardStyle, borderRadius: 13, overflow: 'hidden' }}>
      <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0 }}>
            <AvatarA name={r.staff_name} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{r.staff_name || '—'}</div>
              {r.staff_designation && <div style={{ fontSize: 12, color: C.text3 }}>{r.staff_designation}</div>}
            </div>
          </div>
          <StatusBadge active={active} durMs={durMs} elapsedMs={elapsedMs} />
        </div>
        <div style={{ fontSize: 12.5, color: C.text2, fontWeight: 600, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <TeamPill team={r.team_name} />
          <span style={{ color: C.blue, fontFamily: MONO, fontWeight: 700 }}>{r.machine_name || 'Office'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {tiles.map(t => (
            <div key={t.l} style={{ background: C.surface2, border: '1px solid ' + C.border, borderRadius: 9, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.text3, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{t.l}</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: t.c }}>{t.v}{t.plus > 0 && <PlusDay n={t.plus} />}</div>
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

// Date column dropped from the grouped table — the group header carries the day.
const COLS = ['Staff', 'Team', 'Machine', 'Check In', 'Check Out', 'Duration', 'Check-in GPS', 'Check-out GPS', 'Status'];

export default function AttendanceDayGroups({ records }: { records: any[] }) {
  const isMobile = useIsMobile();

  // Single "now" per render for open-session elapsed time. No ticking interval —
  // elapsed is allowed to be slightly stale on a page left open; it refreshes on any
  // re-render this page already does (accordion toggle, filter / Generate, reload).
  const now = Date.now();

  // Client-side day grouping. Key is byte-identical to the DATE cell
  // (dayLabel(check_in_at, tz)) so grouping moves zero rows. `iso` is a parallel
  // YYYY-MM-DD (same tz) used only for sorting + the "+Nd" check-out diff.
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of records) {
      const tz = r.tenant_timezone || 'Asia/Kolkata';
      const key = dayLabel(r.check_in_at, tz);
      const bucket = map.get(key);
      if (bucket) bucket.push(r); else map.set(key, [r]);
    }
    return Array.from(map.entries())
      .map(([key, rows]) => {
        const tz = rows[0].tenant_timezone || 'Asia/Kolkata';
        let weekday = '';
        try { weekday = new Date(rows[0].check_in_at).toLocaleDateString('en-IN', { weekday: 'short', timeZone: tz }); } catch {}
        return { key, rows, iso: isoDay(rows[0].check_in_at, tz), tz, label: weekday ? weekday + ', ' + key : key };
      })
      .sort((a, b) => b.iso.localeCompare(a.iso)); // newest day first
  }, [records]);

  // Signature of the day-set — changes only when the set of days changes.
  const groupSig = useMemo(() => groups.map(g => g.key).join('|'), [groups]);

  // undefined = user hasn't chosen → show the derived default (today, else newest).
  // A concrete string|null means the user explicitly opened / closed a group.
  const [openKey, setOpenKey] = useState<string | null | undefined>(undefined);

  // Default open group, DERIVED during render so it can't be missed by effect
  // timing: today's group if in range, else the newest. Pure fn of the day-set.
  const defaultOpenKey = useMemo(() => {
    if (groups.length === 0) return null;
    const todayKey = dayLabel(new Date().toISOString(), groups[0].tz);
    return groups.some(g => g.key === todayKey) ? todayKey : groups[0].key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSig]);

  // When the day-set changes (new fetch / filter / quick-range Generate), drop the
  // user's manual choice so the default takes over again. On mount openKey is already
  // undefined, so the default shows immediately — no post-fetch setState required.
  useEffect(() => { setOpenKey(undefined); }, [groupSig]);

  const openGroup = openKey === undefined ? defaultOpenKey : openKey;
  const toggleGroup = (key: string) =>
    setOpenKey(prev => ((prev === undefined ? defaultOpenKey : prev) === key ? null : key));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map(g => {
        const open = openGroup === g.key;
        return (
          <div key={g.key} style={{ ...cardStyle, overflow: 'hidden' }}>
            {/* Whole header row is the click target */}
            <div role="button" tabIndex={0} aria-expanded={open}
              onClick={() => toggleGroup(g.key)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(g.key); } }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', userSelect: 'none', background: open ? C.surface2 : C.surface, borderBottom: open ? '1px solid ' + C.border : 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text, whiteSpace: 'nowrap' }}>{g.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text2, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>{g.rows.length} record{g.rows.length !== 1 ? 's' : ''}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: C.text3, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▸</span>
            </div>
            {open && (isMobile
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px' }}>{g.rows.map(r => <RecordCardM key={r.id} r={r} groupIso={g.iso} now={now} />)}</div>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
                    <thead>
                      <tr style={{ background: C.surface2, borderBottom: '1px solid ' + C.border }}>
                        {COLS.map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 800, color: C.text3, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>{g.rows.map((r, i) => <RecordRow key={r.id} r={r} zebra={i % 2 === 1} groupIso={g.iso} now={now} />)}</tbody>
                  </table>
                </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
