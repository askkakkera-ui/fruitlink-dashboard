'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Field Staff — view field_staff members and their visit activity (photos, GPS, oranges).
// Data: operators (role=field_staff) + their visits. Super-admin only.
const C = {
  bg: '#f4f5f9', surface: '#ffffff', surface2: '#f7f8fb', border: '#e8eaf0', border2: '#dcdfe9',
  text: '#1f2533', text2: '#5b6478', text3: '#9099ac',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  orange: '#FE6505', blue: '#0D6EFD', blueBg: '#e7f0ff', amber: '#c98a00', amberBg: '#fff6e6',
};

const card: React.CSSProperties = { background: '#ffffff', borderRadius: 14, border: '1px solid #e8eaf0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

type Staff = { id: string; name?: string; email: string; phone?: string; role: string; created_at?: string };
type Visit = { id: string; staff_id: string; machine_id?: string; visit_type?: string; oranges_loaded?: number; oranges_damaged?: number; oranges_net?: number; photo_url?: string; lat?: number; lng?: number; address?: string; created_at: string };

function fmtDate(t?: string) {
  if (!t) return '—';
  try { return new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }); } catch { return t; }
}
function fmtAgo(t?: string) {
  if (!t) return '';
  const mins = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
  return Math.floor(mins / 1440) + 'd ago';
}
function initials(name?: string, email?: string) {
  const s = (name || email || '?').trim();
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}
const VISIT_LABEL: Record<string, string> = { cleaning: 'Cleaning', loading: 'Loading', maintenance: 'Maintenance', other: 'Other' };
const VISIT_COLOR: Record<string, string> = { cleaning: '#0D6EFD', loading: '#FE6505', maintenance: '#c98a00', other: '#5b6478' };

export default function FieldStaffSection() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visitsByStaff, setVisitsByStaff] = useState<Record<string, Visit[]>>({});
  const [visitLoading, setVisitLoading] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<Visit | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const role = document.cookie.match(/fl_role=([^;]+)/)?.[1] || '';
        let staffList: any[] = [];
        const mRes = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn'));
        if (role === 'super_admin' || role === 'staff') {
          // Super admin: all field staff + sub-operators across all tenants
          const sRes = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?select=id,name,email,phone,role,created_at&role=in.(field_staff,sub_operator)&order=created_at.desc'));
          const sData = await sRes.json();
          staffList = Array.isArray(sData) ? sData : [];
        } else {
          // Operator/sub-operator: their own team
          const tRes = await fetch('/api/my-team');
          const tData = await tRes.json();
          staffList = Array.isArray(tData.team) ? tData.team : [];
        }
        const m = await mRes.json();
        setStaff(staffList.map((t: any) => ({ id: t.id, name: t.name, email: t.email, phone: t.phone, role: t.role, created_at: t.created_at })));
        setMachines(Array.isArray(m) ? m : []);
      } catch { setStaff([]); }
      setLoading(false);
    })();
  }, []);

  const macName = (id?: string) => {
    if (!id) return '—';
    const m = machines.find((x: any) => x.id === id);
    return m ? (m.display_name || m.sn) : '—';
  };

  const toggleStaff = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!visitsByStaff[id]) {
      setVisitLoading(prev => ({ ...prev, [id]: true }));
      try {
        const res = await fetch('/api/visit?report=1');
        const d = await res.json();
        const allVisits = Array.isArray(d) ? d : [];
        const staffVisits = allVisits.filter((v: any) => v.staff_id === id).slice(0, 50);
        setVisitsByStaff(prev => ({ ...prev, [id]: staffVisits }));
      } catch { setVisitsByStaff(prev => ({ ...prev, [id]: [] })); }
      setVisitLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>Field Staff</div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>
            {loading ? 'Loading…' : staff.length + ' field staff' + (staff.length === 1 ? ' member' : ' members')}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading field staff…</div>
      ) : staff.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👷</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>No field staff yet</div>
          <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5, maxWidth: 440, margin: '0 auto' }}>
            Add field staff in <b>Operators</b> by creating an account with the <b>Field Staff</b> role.
            Once they log visits from the field app, their activity and proof-of-visit photos will appear here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {staff.map(s => {
            const isOpen = expanded === s.id;
            const visits = visitsByStaff[s.id] || [];
            return (
              <div key={s.id} style={{ ...card, overflow: 'hidden' }}>
                {/* Staff header */}
                <div onClick={() => toggleStaff(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', userSelect: 'none' as const, background: isOpen ? C.surface2 : '#fff' }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,' + C.orange + ',#ff8f4d)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {initials(s.name, s.email)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.name || s.email}</div>
                    <div style={{ fontSize: 12.5, color: C.text2, marginTop: 2 }}>
                      {s.email}{s.phone ? ' · ' + s.phone : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ background: C.blueBg, color: C.blue, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Field Staff</span>
                    <span style={{ fontSize: 16, color: C.text3, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
                  </div>
                </div>

                {/* Visits */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid ' + C.border, padding: '16px 20px' }}>
                    {visitLoading[s.id] ? (
                      <div style={{ textAlign: 'center', padding: 24, color: C.text3, fontSize: 13 }}>Loading visits…</div>
                    ) : visits.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 24, color: C.text3, fontSize: 13 }}>No visits logged yet.</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 12 }}>
                          Recent visits ({visits.length})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                          {visits.map(v => (
                            <div key={v.id} style={{ border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                              {v.photo_url ? (
                                <div onClick={() => setLightbox(v)} style={{ cursor: 'pointer', height: 150, background: C.surface2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={v.photo_url} alt="Visit" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              ) : (
                                <div style={{ height: 150, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, fontSize: 12 }}>No photo</div>
                              )}
                              <div style={{ padding: '10px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: VISIT_COLOR[v.visit_type || ''] || C.text3, padding: '2px 8px', borderRadius: 6 }}>
                                    {VISIT_LABEL[v.visit_type || ''] || (v.visit_type || 'Visit')}
                                  </span>
                                  <span style={{ fontSize: 11, color: C.text3 }}>{fmtAgo(v.created_at)}</span>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{macName(v.machine_id)}</div>
                                <div style={{ fontSize: 11.5, color: C.text2, marginTop: 2 }}>{fmtDate(v.created_at)}</div>
                                {(v.oranges_loaded != null || v.oranges_damaged != null || v.oranges_net != null) && (
                                  <div style={{ fontSize: 12, color: C.text2, marginTop: 4, display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                                    {v.oranges_loaded != null && <span>🍊 Loaded: {v.oranges_loaded}</span>}
                                    {v.oranges_damaged != null && <span>❌ Damaged: {v.oranges_damaged}</span>}
                                    {v.oranges_net != null && <span>✅ Net: {v.oranges_net}</span>}
                                  </div>
                                )}
                                {(v.lat != null && v.lng != null) && (
                                  <a href={'https://maps.google.com/?q=' + v.lat + ',' + v.lng} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11.5, color: C.blue, marginTop: 4, display: 'inline-block', textDecoration: 'none' }}>
                                    📍 View location
                                  </a>
                                )}
                                {v.address && <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{String(v.address).slice(0, 60)}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox rendered via portal to escape overflow:auto container */}
      {lightbox && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16, cursor: 'zoom-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(92vw, 480px)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: C.surface, borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
            {lightbox.photo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={lightbox.photo_url} alt="Visit" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: '#000' }} />
            )}
            <div style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: VISIT_COLOR[lightbox.visit_type || ''] || C.text3, padding: '3px 10px', borderRadius: 6 }}>
                  {VISIT_LABEL[lightbox.visit_type || ''] || (lightbox.visit_type || 'Visit')}
                </span>
                <button onClick={() => setLightbox(null)} style={{ background: C.surface2, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.text2, fontSize: 13, fontWeight: 600 }}>Close ✕</button>
              </div>
              <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7 }}>
                <div>🕐 {new Date(lightbox.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                {typeof lightbox.oranges_loaded === 'number' && lightbox.oranges_loaded > 0 && <div>🍊 Loaded: {lightbox.oranges_loaded}{typeof lightbox.oranges_damaged === 'number' && lightbox.oranges_damaged > 0 ? ' · Damaged: ' + lightbox.oranges_damaged : ''}</div>}
                {lightbox.address && <div>📍 {lightbox.address}</div>}
                {(lightbox.lat && lightbox.lng) && <div style={{ fontSize: 11, color: C.text3 }}>GPS: {Number(lightbox.lat).toFixed(5)}, {Number(lightbox.lng).toFixed(5)}</div>}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
