'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile, PersonRow } from './lib/dashboard-shared';

// My Staff — super_admin manages internal employees (role='staff') with designations.
// These are Fruitlink's own team (office, technicians, managers) — NOT tenant field staff.
// They get office attendance but don't manage machines or log machine visits.

const C = {
  bg: '#f4f5f9', surface: '#ffffff', surface2: '#f7f8fb', border: '#e8eaf0', border2: '#dcdfe9',
  text: '#1f2533', text2: '#374151', text3: '#4b5563',
  green: '#198754', greenBg: '#e7f8ef', red: '#DC3545', redBg: '#fdeaec',
  orange: '#FE6505', blue: '#0D6EFD', purple: '#7C3AED', purpleBg: '#EDE9FE',
};

const SUPER_ADMIN_ID = '0c1bd083-682a-4913-ac37-08c85ef94b41';

type Staff = { id: string; name: string; email: string; phone?: string; role: string; designation?: string; employee_id?: string; staff_type?: string; created_at: string };

export default function MyStaffSection() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [permsFor, setPermsFor] = useState<Staff | null>(null);
  const isMobile = useIsMobile();

  // Form state
  const [fName, setFName] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fDesignation, setFDesignation] = useState('');
  const [fEmployeeId, setFEmployeeId] = useState('');
  const [fStaffType, setFStaffType] = useState('office');
  const [fPassword, setFPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?select=id,name,email,phone,role,designation,employee_id,staff_type,created_at&role=eq.staff&owner_id=eq.' + SUPER_ADMIN_ID + '&order=created_at.desc'));
      const d = await r.json();
      setStaff(Array.isArray(d) ? d : []);
    } catch { setErr('Could not load staff'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setFName(''); setFEmail(''); setFPhone(''); setFDesignation(''); setFEmployeeId(''); setFStaffType('office'); setFPassword('');
    setFormMsg(''); setShowAdd(true);
  }

  function openEdit(s: Staff) {
    setEditing(s);
    setFName(s.name || ''); setFEmail(s.email || ''); setFPhone(s.phone || '');
    setFDesignation(s.designation || ''); setFEmployeeId(s.employee_id || ''); setFStaffType(s.staff_type || 'office'); setFPassword('');
    setFormMsg(''); setShowAdd(true);
  }

  async function save() {
    if (!fName.trim() || !fEmail.trim()) { setFormMsg('Name and email are required'); return; }
    if (!editing && !fPassword.trim()) { setFormMsg('Password is required for a new staff member'); return; }
    setSaving(true); setFormMsg('');
    try {
      if (editing) {
        // Update existing
        const body: any = { name: fName.trim(), email: fEmail.trim(), phone: fPhone.trim() || null, designation: fDesignation.trim() || null, employee_id: fEmployeeId.trim() || null, staff_type: fStaffType };
        if (fPassword.trim()) {
          const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: fPassword }) });
          if (!hashRes.ok) { setFormMsg('Error: could not hash password'); setSaving(false); return; }
          const { hash } = await hashRes.json();
          body.password_hash = hash;
        }
        const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?id=eq.' + editing.id), {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify(body),
        });
        if (!r.ok) { const e = await r.json().catch(() => ({})); setFormMsg('Error: ' + (e.error || r.status)); setSaving(false); return; }
      } else {
        // Create new: hash password, then insert into operators with role='staff'
        const hashRes = await fetch('/api/hash-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: fPassword }) });
        if (!hashRes.ok) { setFormMsg('Error: could not hash password'); setSaving(false); return; }
        const { hash } = await hashRes.json();
        const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators'), {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ name: fName.trim(), email: fEmail.trim(), phone: fPhone.trim() || null, password_hash: hash, role: 'staff', designation: fDesignation.trim() || null, employee_id: fEmployeeId.trim() || null, staff_type: fStaffType, owner_id: SUPER_ADMIN_ID, state: 'Telangana', country: 'India' }),
        });
        if (!r.ok) { const t = await r.text().catch(() => ''); setFormMsg('Error: ' + (t || r.status)); setSaving(false); return; }
      }
      setFormMsg('✓ Saved');
      setTimeout(() => { setShowAdd(false); load(); }, 700);
    } catch (e: any) { setFormMsg('Error: ' + e.message); }
    setSaving(false);
  }

  async function remove(s: Staff) {
    if (!confirm('Remove ' + (s.name || s.email) + ' from staff?')) return;
    try {
      const r = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/operators?id=eq.' + s.id), {
        method: 'DELETE', headers: { 'Prefer': 'return=minimal' },
      });
      if (r.ok) load();
      else alert('Could not remove');
    } catch { alert('Could not remove'); }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, color: C.text, background: C.surface, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>Fruitlink Team</div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>Fruitlink's own team — office, field, mechanics, and supply staff. Separate from tenant operators and their field staff.</div>
        </div>
        <button onClick={openAdd} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>+ Add Staff</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>Loading…</div>
      ) : err ? (
        <div style={{ padding: 16, background: C.redBg, color: C.red, borderRadius: 10, fontSize: 13 }}>{err}</div>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: C.text3 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧑‍💼</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text2, marginBottom: 6 }}>No staff yet</div>
          <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>Add your internal team members. They can check in and out for attendance without managing machines.</div>
        </div>
      ) : (
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 14, overflow: 'hidden', marginTop: 16 }}>
          {staff.map((s, i) => {
            // Actions: ≥44px tap targets on mobile, and each fills its share of
            // the stacked row (flex:1) so the buttons don't crowd the text.
            const actBtn = (bg: string, brd: string, color: string, fw: number): React.CSSProperties => ({
              background: bg, border: brd, borderRadius: 8, cursor: 'pointer', color, fontSize: 13, fontWeight: fw,
              padding: isMobile ? '11px 14px' : '6px 12px', minHeight: isMobile ? 44 : undefined, flex: isMobile ? 1 : undefined,
            });
            return (
              <PersonRow
                key={s.id}
                isMobile={isMobile}
                divider={i > 0}
                avatar={<div style={{ width: 40, height: 40, borderRadius: '50%', background: C.purpleBg, color: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{(s.name || s.email || '?').slice(0, 2).toUpperCase()}</div>}
                title={s.name || '—'}
                subtitle={`${s.email}${s.designation ? ' · ' + s.designation : ''}`}
                badges={<>
                  {s.employee_id && <span style={{ fontSize: 11, fontWeight: 700, color: C.text3, background: C.surface2, padding: '2px 8px', borderRadius: 6, border: '1px solid ' + C.border }}>{s.employee_id}</span>}
                  {s.staff_type && <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: C.purple, background: C.purpleBg, padding: '4px 12px', borderRadius: 20 }}>{s.staff_type}</span>}
                </>}
                actions={<>
                  <button onClick={() => setPermsFor(s)} style={actBtn(C.purpleBg, 'none', C.purple, 700)}>🔑 Perms</button>
                  <button onClick={() => openEdit(s)} style={actBtn(C.surface2, '1px solid ' + C.border, C.text2, 600)}>Edit</button>
                  <button onClick={() => remove(s)} style={actBtn(C.redBg, 'none', C.red, 600)}>Del</button>
                </>}
              />
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showAdd && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setShowAdd(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(31,37,51,0.5)', zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, padding: 22, width: 440, maxWidth: '100%', boxShadow: '0 20px 60px #00000030', marginTop: 'auto', marginBottom: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 3 }}>{editing ? 'Edit Staff' : 'Add Staff'}</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>{editing ? 'Update details' : 'Create a new internal team member'}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Name *</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Full name" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Email *</label>
                <input value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="email@fruitlinktech.in" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Phone</label>
                <input value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="+91…" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Designation</label>
                <input value={fDesignation} onChange={e => setFDesignation(e.target.value)} placeholder="e.g. Office Manager, Technician, Accountant" style={inp} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Employee ID</label>
                  <input value={fEmployeeId} onChange={e => setFEmployeeId(e.target.value)} placeholder="FLK-001" style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>Type</label>
                  <select value={fStaffType} onChange={e => setFStaffType(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="office">Office</option>
                    <option value="field">Field</option>
                    <option value="mechanic">Mechanic</option>
                    <option value="supply">Supply</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>{editing ? 'New Password (blank = keep)' : 'Password *'}</label>
                <input type="password" value={fPassword} onChange={e => setFPassword(e.target.value)} placeholder={editing ? '••••••••' : 'Login password'} style={inp} />
              </div>
            </div>

            {formMsg && <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 8, background: formMsg.startsWith('✓') ? C.greenBg : C.redBg, color: formMsg.startsWith('✓') ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>{formMsg}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {permsFor && <StaffPermsModal staff={permsFor} onClose={() => setPermsFor(null)} />}
    </div>
  );
}

// Permissions modal for a Fruitlink staff member — grants dashboard section access
function StaffPermsModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const VIEW_PERMS: [string, string][] = [
    ['can_view_console', 'Console'], ['can_view_orders', 'Orders'], ['can_view_alerts', 'Alerts'],
    ['can_view_fleet_map', 'Fleet Map'], ['can_view_warehouse', 'Warehouse'], ['can_view_reports', 'Reports'],
    ['can_view_field_staff', 'Field Staff'], ['can_view_attendance', 'Attendance'], ['can_view_comm_log', 'Comm Log & Fault Log'],
    ['can_view_notify_config', 'Alert Notifications'], ['can_view_ad_manager', 'Ad Manager'],
  ];
  const CHANGE_PERMS: [string, string][] = [
    ['can_edit_machine_config', 'Edit machine config'], ['can_manage_field_staff', 'Manage field staff'],
    ['can_manage_locations', 'Manage locations'], ['can_manage_warehouse', 'Manage warehouse (edit/receive/dispatch)'], ['can_export_data', 'Export data'], ['can_manage_ads', 'Manage ads'], ['can_manage_warehouse', 'Manage warehouse (edit stock)'],
  ];
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/operator-permissions?operator_id=' + staff.id);
        const d = await r.json();
        if (d && typeof d === 'object') setPerms(d);
      } catch {}
      setLoading(false);
    })();
  }, [staff.id]);

  const toggle = (k: string) => setPerms(p => ({ ...p, [k]: !p[k] }));

  async function save() {
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/operator-permissions', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: staff.id, permissions: perms }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setMsg('Error: ' + (d.error || r.status)); setSaving(false); return; }
      setMsg('✓ Saved'); setTimeout(onClose, 700);
    } catch (e: any) { setMsg('Error: ' + e.message); }
    setSaving(false);
  }

  const Row = ({ k, label }: { k: string; label: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
      <span style={{ fontSize: 14, color: C.text2 }}>{label}</span>
      <button onClick={() => toggle(k)} style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: perms[k] ? C.green : C.border2, position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: perms[k] ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </button>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(31,37,51,0.5)', zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, padding: 24, width: 460, maxWidth: '100%', boxShadow: '0 20px 60px #00000030', marginTop: 'auto', marginBottom: 'auto' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{staff.name || staff.email}</div>
        <div style={{ fontSize: 13, color: C.text3, marginBottom: 18 }}>Grant dashboard access. They'll see only what you enable.</div>
        {loading ? <div style={{ padding: 30, textAlign: 'center', color: C.text3 }}>Loading…</div> : (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.blue, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 4 }}>👁 Can View</div>
            {VIEW_PERMS.map(([k, l]) => <Row key={k} k={k} label={l} />)}
            <div style={{ fontSize: 12, fontWeight: 800, color: C.orange, textTransform: 'uppercase' as const, letterSpacing: '0.04em', margin: '16px 0 4px' }}>⚡ Can Change</div>
            {CHANGE_PERMS.map(([k, l]) => <Row key={k} k={k} label={l} />)}
          </>
        )}
        {msg && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: msg.startsWith('✓') ? C.greenBg : C.redBg, color: msg.startsWith('✓') ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid ' + C.border, background: C.surface, color: C.text2, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save Permissions'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
