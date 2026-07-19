'use client'
import { useState, useEffect } from 'react'
import { C, SB_KEY, getCookie, Dot, Badge, Pill, StatCard } from './lib/dashboard-shared'

// ═══════════════════════════════════════════════════════════════════════
//  AdsPage — DROP-IN REPLACEMENT for the existing AdsPage in dashboard.tsx
//
//  Replace your current `function AdsPage({ machines }...) { ... }` block
//  with everything below (up to the matching closing brace).
//
//  Uses: the new ad_campaign schema, the /api/sb proxy, your C.* tokens,
//  and your Pill / Badge / StatCard / Dot components (already in the file).
//  Signature is unchanged, so the line
//      ads: <AdsPage machines={machines} />
//  in the pages map keeps working with no edit.
// ═══════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
//  BottomTilesPanel — per-machine idle-screen bottom tiles (left 60% / right 40%)
//  These are the two fixed signage images below the top ad zone. They are NOT
//  ad campaigns: they live in machines.state.screen_config.bottom_left_url /
//  bottom_right_url and are read by the machine app's BottomTilesLoader.
//  Uploading reuses the same /api/upload presigned-PUT flow as ad media.
// ─────────────────────────────────────────────────────────────────────────────
export function BottomTilesPanel({ machines }: { machines: any[] }) {
  const parseSC = (m: any) => {
    try { const st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}); return st.screen_config || {} } catch { return {} }
  }
  const [sel, setSel] = useState<string>(machines[0]?.sn || '')
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [busy, setBusy] = useState<'' | 'left' | 'right' | 'save'>('')
  const [savedAt, setSavedAt] = useState<number>(0)
  const [dirty, setDirty] = useState(false)

  const machine = machines.find(m => m.sn === sel)

  // Load the selected machine's current tile URLs whenever the selection changes.
  useEffect(() => {
    if (!machine) return
    const sc = parseSC(machine)
    setLeft(sc.bottom_left_url || '')
    setRight(sc.bottom_right_url || '')
    setDirty(false)
  }, [sel])

  const upload = async (which: 'left' | 'right', file: File) => {
    const MAX_MB = 100
    if (file.size > MAX_MB * 1024 * 1024) { alert('That file is ' + (file.size / 1048576).toFixed(1) + ' MB. Keep tile images under ' + MAX_MB + ' MB.'); return }
    setBusy(which)
    try {
      const presignRes = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', operator_id: getCookie('fl_operator_id') || 'shared' }),
      })
      const presign = await presignRes.json()
      if (!presign.uploadUrl) { alert('Upload failed: ' + (presign.error || 'no upload url')); setBusy(''); return }
      const put = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!put.ok) { alert('Upload to storage failed (' + put.status + ')'); setBusy(''); return }
      if (which === 'left') setLeft(presign.publicUrl); else setRight(presign.publicUrl)
      setDirty(true)
    } catch (e: any) { alert('Upload failed: ' + (e?.message || e)) }
    setBusy('')
  }

  const save = async () => {
    if (!machine) return
    setBusy('save')
    try {
      const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
      // Read the freshest row so we never clobber other screen_config keys.
      const rows = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=state&sn=eq.' + machine.sn), { headers }).then(r => r.json())
      let st: any = {}
      try { const raw = rows?.[0]?.state; st = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {}) } catch { st = {} }
      st.screen_config = st.screen_config || {}
      st.screen_config.bottom_left_url = left || ''
      st.screen_config.bottom_right_url = right || ''
      await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?sn=eq.' + machine.sn),
        { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ state: JSON.stringify(st) }) })
      // reflect locally so a re-select shows the saved values
      if (machine) machine.state = JSON.stringify(st)
      setDirty(false); setSavedAt(Date.now())
    } catch (e: any) { alert('Save failed: ' + (e?.message || e)) }
    setBusy('')
  }

  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }

  const tile = (which: 'left' | 'right', url: string, setUrl: (s: string) => void, label: string, pct: string) => (
    <div style={{ flex: which === 'left' ? 3 : 2, minWidth: 0 }}>
      <label style={lbl}>{label} <span style={{ color: C.text3, fontWeight: 600 }}>· {pct}</span></label>
      <div style={{ width: '100%', aspectRatio: which === 'left' ? '16/10' : '10/10', borderRadius: 10, border: '1px dashed ' + C.border, background: url ? '#000' : C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 }}>
        {url
          ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ color: C.text3, fontSize: 12 }}>No image set</span>}
      </div>
      <input id={'tile-file-' + which} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) upload(which, f); (e.target as HTMLInputElement).value = '' }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" disabled={busy === which} onClick={() => document.getElementById('tile-file-' + which)?.click()}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.orange, background: busy === which ? C.surface2 : C.orangeBg, color: C.orange, fontSize: 12.5, fontWeight: 700, cursor: busy === which ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
          {busy === which ? 'Uploading...' : '⬆ Upload image'}
        </button>
        {url && <button type="button" onClick={() => { setUrl(''); setDirty(true) }}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface, color: C.text2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Clear</button>}
      </div>
      <input style={inp} value={url} onChange={e => { setUrl(e.target.value); setDirty(true) }} placeholder="Upload above, or paste an image URL" />
    </div>
  )

  if (machines.length === 0) return null

  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 20, marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Bottom Tiles <span style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>· idle-screen signage</span></div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>The two fixed images below the ad zone. Left is wide (60%), right is square (40%). Set per machine.</div>
        </div>
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + C.border, background: C.surface2, color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {machines.map((m: any) => <option key={m.sn} value={m.sn}>{m.display_name || m.sn}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 14 }}>
        {tile('left', left, setLeft, 'Left tile', '60% · wide')}
        {tile('right', right, setRight, 'Right tile', '40% · square')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button type="button" disabled={!dirty || busy === 'save'} onClick={save}
          style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: (!dirty || busy === 'save') ? C.surface2 : C.orange, color: (!dirty || busy === 'save') ? C.text3 : '#fff', fontSize: 13, fontWeight: 700, cursor: (!dirty || busy === 'save') ? 'default' : 'pointer' }}>
          {busy === 'save' ? 'Saving...' : 'Save tiles'}
        </button>
        {dirty && <span style={{ fontSize: 12, color: C.amber, fontWeight: 700 }}>Unsaved changes</span>}
        {!dirty && savedAt > 0 && <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>✓ Saved — appears on the machine at its next config sync</span>}
      </div>
    </div>
  )
}

export function AdsPage({ machines, permissions = {}, role: roleProp = '', operatorId = '', ownerId = '' }: { machines: any[]; permissions?: Record<string, boolean>; role?: string; operatorId?: string; ownerId?: string }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const SCREENS = ['idle', 'ordering', 'dispensing', 'thanks']
  const role = roleProp || getCookie('fl_role') || 'operator'
  // Who may manage ads: super_admin always; operator/sub_operator only with the
  // can_manage_ads permission. Others get a read-only view.
  const canManageAds = role === 'super_admin' || permissions.can_manage_ads === true
  // The operator that owns campaigns created here: self for operator,
  // parent for sub_operator, '' for super_admin (server stamps nothing extra).
  const myAdOwnerId = role === 'sub_operator' ? (ownerId || '') : (operatorId || '')

  const [campaigns, setCampaigns] = useState<any[]>([])
  const [perf, setPerf] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [machineFilter, setMachineFilter] = useState('all')
  const [editing, setEditing] = useState<any>(null)   // campaign being edited, or {} for new
  const [saving, setSaving] = useState(false)

  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?select=*&order=created_at.desc'), { headers })
        .then(r => r.json()).then(d => Array.isArray(d) ? d : []),
      fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign_performance?select=*'), { headers })
        .then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
    ]).then(([camps, perfRows]) => {
      setCampaigns(camps)
      const pm: Record<string, any> = {}
      perfRows.forEach((p: any) => { pm[p.campaign_id] = p })
      setPerf(pm)
      setLoading(false)
    }).catch(e => { console.error('ads load error', e); setCampaigns([]); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const visible = machineFilter === 'all'
    ? campaigns
    : campaigns.filter(c => (c.machine_sns || []).includes(machineFilter))

  // KPIs
  const activeCount = campaigns.filter(c => c.status === 'active').length
    const pendingCount = campaigns.filter(c => c.approval === 'pending').length
  const totalImpr = Object.values(perf).reduce((s: number, p: any) => s + (p.impressions || 0), 0)
  const totalRev = Object.values(perf).reduce((s: number, p: any) => s + (Number(p.revenue) || 0), 0)

  const fmtK = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : '' + n
  const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
  const hh = (h: number) => String(h).padStart(2, '0') + ':00'
  const snName = (sn: string) => machines.find(m => m.sn === sn)?.display_name || sn

  const save = async (c: any) => {
    if (!canManageAds) { alert('You have view-only access to ads. Ask Fruitlink to enable ad management.'); return }
    setSaving(true)
    try {
      const isOwn = (c.advertiser || '').trim().toLowerCase() === 'fruitlink'
      const body: any = {
        name: c.name, advertiser: c.advertiser, is_own: isOwn,
        media_type: c.media_type, media_url: c.media_url || null, media_name: c.media_name || null,
        duration_s: c.duration_s || 15, screen: c.screen,
        machine_sns: c.machine_sns || [], days: c.days || [],
        start_hour: c.start_hour, end_hour: c.end_hour, weight: c.weight,
        status: c.status, rate_cpm: isOwn ? null : (c.rate_cpm ? Number(c.rate_cpm) : null),
      }
      // Stamp ownership for operator-created campaigns (super_admin leaves as-is /
      // may target any machine). The server re-validates and overrides this anyway.
      if (role !== 'super_admin' && myAdOwnerId) body.operator_id = myAdOwnerId
      if (c.id) {
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?id=eq.' + c.id),
          { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
      } else {
        // approval defaulting is handled by the DB trigger (own->approved, third-party->pending)
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign'),
          { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
      }
      setEditing(null); load()
    } catch (e: any) { alert('Save failed: ' + (e?.message || e)) }
    setSaving(false)
  }

  const setStatus = async (id: string, status: string) => {
    await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?id=eq.' + id),
      { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ status }) })
    load()
  }
  const setApproval = async (id: string, approval: string) => {
    await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?id=eq.' + id),
      { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ approval }) })
    load()
  }
  const remove = async (id: string) => {
    if (!confirm('Delete this campaign permanently?')) return
    // Find this campaign's media URL, and check whether any OTHER campaign
    // still uses the same file before deleting it from storage.
    const target = campaigns.find(c => c.id === id)
    const url = target?.media_url || ''
    const sharedByOthers = !!url && campaigns.some(c => c.id !== id && c.media_url === url)
    // Delete the campaign row first.
    await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/ad_campaign?id=eq.' + id), { method: 'DELETE', headers })
    // Then remove the stored file, but only if nothing else references it.
    if (url && !sharedByOthers) {
      try {
        await fetch('/api/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      } catch (e) { /* file cleanup is best-effort; ignore */ }
    }
    setEditing(null); load()
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>Ad Manager</div>
          <div style={{ fontSize: 13, color: C.text2 }}>In-machine advertising — schedule by machine, screen, time &amp; day</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pendingCount > 0 && (
            <Pill color={C.amber} bg={C.amberBg}><Dot color={C.amber} pulse size={5} /> {pendingCount} pending approval</Pill>
          )}
          {canManageAds ? (
            <button onClick={() => setEditing({ _new: true, name: '', advertiser: role === 'super_admin' ? 'Fruitlink' : '', media_type: 'image', media_url: '', media_name: '', duration_s: 15, screen: 'idle', machine_sns: machines.map((m: any) => m.sn), days: [0, 1, 2, 3, 4], start_hour: 9, end_hour: 18, weight: 1, status: 'active', rate_cpm: '' })}
              style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ New Campaign</button>
          ) : (
            <Pill color={C.text3} bg={C.surface2}>View only — ask Fruitlink for ad access</Pill>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Active Campaigns" value={activeCount} sub={campaigns.length + ' total'} color={C.orange} icon="🎬" pct={campaigns.length ? (activeCount / campaigns.length) * 100 : 0} />
        <StatCard label="Impressions" value={fmtK(totalImpr)} sub="all-time plays" color={C.blue} icon="👁" pct={70} />
        <StatCard label="Ad Revenue" value={fmtINR(totalRev)} sub="third-party brands" color={C.green} icon="₹" pct={60} />
        <StatCard label="Pending Approval" value={pendingCount} sub={pendingCount ? 'needs review' : 'all clear'} color={pendingCount ? C.amber : C.green} icon="⏳" pct={pendingCount ? 100 : 0} />
      </div>

      {/* Bottom tiles (per-machine idle-screen signage) — super_admin only for now,
          pending verification of server-side write-scoping in /api/sb. */}
      {role === 'super_admin' && <BottomTilesPanel machines={machines} />}

      {/* Machine filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' as const }}>
        <button onClick={() => setMachineFilter('all')} style={chip(machineFilter === 'all')}>All Machines</button>
        {machines.map((m: any) => (
          <button key={m.id} onClick={() => setMachineFilter(m.sn)} style={chip(machineFilter === m.sn)}>{m.display_name}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.text3 }}>Loading campaigns...</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.surface, borderRadius: 16, border: '1px solid ' + C.border }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No campaigns yet</div>
          <div style={{ fontSize: 13, color: C.text2 }}>Create your first campaign to monetize the machine screen</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((c: any) => {
            const p = perf[c.id] || {}
            return (
              <div key={c.id} onClick={() => setEditing({ ...c, rate_cpm: c.rate_cpm ?? '' })}
                style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: C.orangeBg, border: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {c.media_type === 'video' ? '🎥' : '🖼'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</span>
                    {!c.is_own && <Badge color={C.blue}>{c.advertiser}</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3 }}>
                    {(c.machine_sns || []).length === 0 ? 'No machines' : (c.machine_sns || []).map(snName).join(', ')}
                    {' · '}{c.screen}{' · '}{hh(c.start_hour)}–{hh(c.end_hour)}
                    {' · '}{(c.days || []).length === 7 ? 'every day' : (c.days || []).map((d: number) => DAYS[d]).join(' ')}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 3, display: 'flex', gap: 12 }}>
                    <span>{fmtK(p.impressions || 0)} impressions</span>
                    {!c.is_own && c.rate_cpm && <span style={{ color: C.green }}>{fmtINR(Number(p.revenue) || 0)} · ₹{c.rate_cpm} CPM</span>}
                    <span>weight {c.weight}×</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {c.approval === 'pending' ? (
                    <>
                      <Pill color={C.amber} bg={C.amberBg}>Pending</Pill>
                      {role === 'super_admin' && (
                        <button onClick={() => setApproval(c.id, 'approved')} style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Approve</button>
                      )}
                    </>
                  ) : c.approval === 'rejected' ? (
                    <Pill color={C.red} bg={C.redBg}>Rejected</Pill>
                  ) : (
                    <Pill color={c.status === 'active' ? C.green : C.text3} bg={c.status === 'active' ? C.greenBg : C.surface2}>{c.status === 'active' ? 'Active' : 'Paused'}</Pill>
                  )}
                  <div onClick={() => setStatus(c.id, c.status === 'active' ? 'paused' : 'active')}
                    style={{ width: 36, height: 20, borderRadius: 10, background: c.status === 'active' ? C.orange : C.border2, cursor: 'pointer', position: 'relative' as const, transition: 'background .2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute' as const, top: 2, left: c.status === 'active' ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor drawer */}
      {editing && (
        <AdEditor
          campaign={editing} machines={machines} saving={saving}
          onClose={() => setEditing(null)} onSave={save} onDelete={remove}
        />
      )}
    </div>
  )

  function chip(on: boolean) {
    return { padding: '6px 14px', borderRadius: 8, border: '1px solid ' + (on ? C.orange : C.border), background: on ? C.orange : C.surface2, color: on ? '#fff' : C.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const
  }
}

// ── Ad editor drawer (right-side slide-over) ──
export function AdEditor({ campaign, machines, saving, onClose, onSave, onDelete }: any) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const SCREENS = ['idle', 'ordering', 'dispensing', 'thanks']
  const [f, setF] = useState<any>(campaign)
  const [uploading, setUploading] = useState(false)
  const isNew = !!campaign._new
  const isOwn = (f.advertiser || '').trim().toLowerCase() === 'fruitlink'
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const tDay = (d: number) => setF((s: any) => ({ ...s, days: (s.days || []).includes(d) ? s.days.filter((x: number) => x !== d) : [...(s.days || []), d].sort() }))
  const tMac = (sn: string) => setF((s: any) => ({ ...s, machine_sns: (s.machine_sns || []).includes(sn) ? s.machine_sns.filter((x: string) => x !== sn) : [...(s.machine_sns || []), sn] }))
  const valid = (f.name || '').trim() && (f.machine_sns || []).length > 0 && f.end_hour > f.start_hour

  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: C.surface2, boxSizing: 'border-box' as const }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(31,37,51,0.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '95vw', height: '100%', background: C.surface, borderLeft: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px #00000040' }}>
        {/* head */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid ' + C.border }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.orange, fontWeight: 700 }}>{isNew ? 'New Campaign' : 'Edit Campaign'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2 }}>{f.name || 'Untitled campaign'}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, background: C.surface2, border: '1px solid ' + C.border, color: C.text, cursor: 'pointer' }}>✕</button>
        </div>

        {/* body */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {!isNew && f.approval === 'pending' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', background: C.amberBg, border: '1px solid ' + C.amber + '40', borderRadius: 10, fontSize: 12.5, color: C.text, marginBottom: 16 }}>
              <Dot color={C.amber} pulse size={6} /> Third-party ad awaiting approval before it serves.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
            <div><label style={lbl}>Campaign name</label><input style={inp} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Summer Fresh Push" /></div>
            <div><label style={lbl}>Advertiser</label><input style={inp} value={f.advertiser} onChange={e => set('advertiser', e.target.value)} placeholder="Fruitlink or brand name" /></div>
          </div>
          <div style={{ fontSize: 11, color: isOwn ? C.green : C.blue, marginTop: -6, marginBottom: 14 }}>
            {isOwn ? '✓ Own-brand — auto-approved, no ad revenue' : '◷ Third-party — needs approval, earns CPM revenue'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
            <div><label style={lbl}>Media type</label>
              <select style={inp as any} value={f.media_type} onChange={e => set('media_type', e.target.value)}>
                <option value="image">Image (JPEG/PNG)</option>
                <option value="video">Video (MP4)</option>
              </select>
            </div>
            <div><label style={lbl}>Show on screen</label>
              <select style={inp as any} value={f.screen} onChange={e => set('screen', e.target.value)}>
                {SCREENS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Ad image / video</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input id="ad-file-input" type="file" accept="image/*,video/*" style={{ display: 'none' }}
                onChange={async e => {
                  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
                  const MAX_MB = 100
                  if (file.size > MAX_MB * 1024 * 1024) {
                    alert('That file is ' + (file.size / 1048576).toFixed(1) + ' MB. Please keep ad media under ' + MAX_MB + ' MB.')
                    ;(e.target as HTMLInputElement).value = ''
                    return
                  }
                  const isVid = (file.type || '').startsWith('video')
                  setUploading(true)
                  try {
                    // Step 1: ask our API for a presigned PUT URL (tiny request, no file).
                    const presignRes = await fetch('/api/upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        filename: file.name,
                        contentType: file.type || 'application/octet-stream',
                        operator_id: getCookie('fl_operator_id') || 'shared',
                      }),
                    })
                    const presign = await presignRes.json()
                    if (!presign.uploadUrl) { alert('Upload failed: ' + (presign.error || 'no upload url')); setUploading(false); return }
                    // Step 2: PUT the file bytes straight to R2 (no size limit through our server).
                    const put = await fetch(presign.uploadUrl, {
                      method: 'PUT',
                      headers: { 'Content-Type': file.type || 'application/octet-stream' },
                      body: file,
                    })
                    if (!put.ok) { alert('Upload to storage failed (' + put.status + ')'); setUploading(false); return }
                    // Step 3: save the public URL on the campaign.
                    set('media_url', presign.publicUrl); set('media_name', presign.name); set('media_type', isVid ? 'video' : 'image')
                  } catch (err: any) { alert('Upload failed: ' + (err?.message || err)) }
                  setUploading(false)
                }} />
              <button type="button" onClick={() => document.getElementById('ad-file-input')?.click()} disabled={uploading}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid ' + C.orange, background: uploading ? C.surface2 : C.orangeBg, color: C.orange, fontSize: 13, fontWeight: 700, cursor: uploading ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                {uploading ? 'Uploading...' : '⬆ Upload image / video'}
              </button>
              {f.media_url && (f.media_type === 'video'
                ? <video src={f.media_url} muted style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid ' + C.border }} />
                : <img src={f.media_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid ' + C.border }} />)}
            </div>
            <div style={{ fontSize: 10.5, color: C.text3, marginBottom: 8 }}>Images or videos · max 100 MB per file. Keep videos short (10-30s) for fast machine loading.</div>
            <label style={lbl}>Media URL</label>
            <input style={inp} value={f.media_url} onChange={e => set('media_url', e.target.value)} placeholder="Upload above, or paste a URL" />
          </div>
          <div style={{ marginBottom: 14 }}><label style={lbl}>Media filename (label)</label><input style={inp} value={f.media_name} onChange={e => set('media_name', e.target.value)} placeholder="summer_orange_15s.jpg" /></div>

          {!isOwn && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
              <div><label style={lbl}>Rate (₹ CPM)</label><input type="number" style={inp} value={f.rate_cpm} onChange={e => set('rate_cpm', e.target.value)} placeholder="e.g. 300" /></div>
              <div><label style={lbl}>Ad duration (sec)</label><input type="number" style={inp} value={f.duration_s} onChange={e => set('duration_s', +e.target.value)} /></div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Target machines</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {machines.map((m: any) => {
                const on = (f.machine_sns || []).includes(m.sn)
                return (
                  <button key={m.id} onClick={() => tMac(m.sn)} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 1, padding: '9px 12px', cursor: 'pointer', textAlign: 'left' as const, background: on ? C.orangeBg : C.surface2, border: '1px solid ' + (on ? C.orange : C.border), borderRadius: 9, color: C.text }}>
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>{m.display_name}</span>
                    <span style={{ fontSize: 10, color: C.text3 }}>{m.location || m.sn}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Days</label>
            <div style={{ display: 'flex', gap: 5 }}>
              {DAYS.map((d, i) => {
                const on = (f.days || []).includes(i)
                return <button key={d} onClick={() => tDay(i)} style={{ flex: 1, height: 36, fontSize: 12, fontWeight: 700, background: on ? C.orange : C.surface2, color: on ? '#fff' : C.text2, border: '1px solid ' + (on ? C.orange : C.border), borderRadius: 8, cursor: 'pointer' }}>{d}</button>
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
            <div><label style={lbl}>Start hour · {String(f.start_hour).padStart(2, '0')}:00</label><input type="range" min={0} max={23} value={f.start_hour} onChange={e => set('start_hour', Math.min(+e.target.value, f.end_hour - 1))} style={{ width: '100%', accentColor: C.orange }} /></div>
            <div><label style={lbl}>End hour · {String(f.end_hour).padStart(2, '0')}:00</label><input type="range" min={1} max={24} value={f.end_hour} onChange={e => set('end_hour', Math.max(+e.target.value, f.start_hour + 1))} style={{ width: '100%', accentColor: C.orange }} /></div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={lbl}>Rotation weight · {f.weight}× {f.weight >= 4 ? '(shows often)' : f.weight === 1 ? '(shows rarely)' : ''}</label>
            <input type="range" min={1} max={5} value={f.weight} onChange={e => set('weight', +e.target.value)} style={{ width: '100%', accentColor: C.orange }} />
          </div>
        </div>

        {/* foot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 22px', borderTop: '1px solid ' + C.border }}>
          {!isNew && <button onClick={() => onDelete(f.id)} style={{ padding: '9px 15px', background: 'transparent', border: '1px solid ' + C.red + '44', borderRadius: 9, color: C.red, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Delete</button>}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '9px 15px', background: C.surface2, border: '1px solid ' + C.border, borderRadius: 9, color: C.text2, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => valid && onSave(f)} disabled={!valid || saving} style={{ padding: '9px 20px', background: C.orange, border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (valid && !saving) ? 1 : 0.45 }}>
            {saving ? 'Saving...' : isNew ? 'Create campaign' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
