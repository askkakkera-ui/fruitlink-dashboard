'use client'
import { useState, useEffect } from 'react'
import { C, SB_URL, SB_KEY, getCookie, currencySymbol, machineCurrency } from './lib/dashboard-shared'

export function MachineConfigSection({ role, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const canEdit = role === 'super_admin'
  const [machines, setMachines] = useState<any[]>([])
  const [config, setConfig] = useState<Record<string, any>>({})

  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,status,location,state'), {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setMachines(Array.isArray(d) ? d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true }) : [])
        const c: Record<string, any> = {}
        d.forEach((m: any) => {
          try {
            const st = m.state ? JSON.parse(m.state) : {}
            const mc = st.machine_config || {}
            c[m.id] = {
              price_200ml: mc.price_200ml ?? 80,
              price_250ml: mc.price_250ml ?? 100,
              price_300ml: mc.price_300ml ?? 120,
              default_volume: mc.default_volume ?? 250,
              max_daily_cups: mc.max_daily_cups ?? 200,
              maintenance_mode: mc.maintenance_mode ?? false
            }
          } catch {
            c[m.id] = {
              price_200ml: 80, price_250ml: 100, price_300ml: 120,
              default_volume: 250, max_daily_cups: 200, maintenance_mode: false
            }
          }
        })
        setConfig(c)
      }
    })
  }, [])

  const save = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
      const hg = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
        await Promise.all(machines.map(async (m: any) => {
        // Merge pricing/volume into existing machine_config so thresholds & notifications survive
        const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id + '&select=state'), { headers: hg }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
        let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
        const mc = st.machine_config || {}
        const incoming = config[m.id] || {}
        st.machine_config = { ...mc, ...incoming }
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id), { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify(st) }) })
      }))
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Machine Config</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Remote pricing and volume settings{canEdit ? ' — changes apply instantly, no engineer visit needed' : ' · view only'}</div>
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.blueBg, border: '1px solid ' + C.blue + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 16 }}>
          🔒 Pricing and machine settings are managed by the Super Admin. You can view them but not change them.
        </div>
      )}

      {machines.map((m: any) => (
        <div key={m.id} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: m.status === 'online' ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {m.status === 'online' ? '🟢' : '🔴'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.display_name}</div>
              <div style={{ fontSize: 12, color: C.text2, fontFamily: 'monospace' }}>{m.sn} · {m.location}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: C.text2 }}>Maintenance mode</span>
              <div onClick={() => canEdit && setConfig({ ...config, [m.id]: { ...config[m.id], maintenance_mode: !config[m.id]?.maintenance_mode } })}
                style={{ width: 36, height: 20, borderRadius: 10, background: config[m.id]?.maintenance_mode ? C.red : C.border2, cursor: canEdit ? 'pointer' : 'not-allowed', position: 'relative' as const, transition: 'background .2s', flexShrink: 0, opacity: canEdit ? 1 : 0.6 }}>
                <div style={{ position: 'absolute' as const, top: 2, left: config[m.id]?.maintenance_mode ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            {/* Prices are per machine, so the symbol is the machine's, from its
                country. This page does not load `countries`, so machineCurrency
                returns INR — right for every machine while all are country_code
                'IN'. Pass a country -> currency map here to make it real. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Cup Pricing ({currencySymbol(machineCurrency(m))})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[['200ml', 'price_200ml'], ['250ml', 'price_250ml'], ['300ml', 'price_300ml']].map(([label, key]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 11, color: C.text2, marginBottom: 4, fontWeight: 600 }}>{label}</label>
                  <div style={{ position: 'relative' as const }}>
                    <span style={{ position: 'absolute' as const, left: 9, top: 9, fontSize: 12, color: C.text3, fontWeight: 600 }}>{currencySymbol(machineCurrency(m))}</span>
                    <input type="number" value={config[m.id]?.[key] ?? ''} disabled={!canEdit} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], [key]: +e.target.value } })}
                      style={{ width: '100%', padding: '8px 8px 8px 22px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Default Cup Size</label>
              <select value={config[m.id]?.default_volume ?? 250} disabled={!canEdit} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], default_volume: +e.target.value } })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'pointer' : 'not-allowed' }}>
                {[200, 250, 300].map(v => <option key={v} value={v}>{v}ml</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Max Daily Cups</label>
              <input type="number" value={config[m.id]?.max_daily_cups ?? 200} disabled={!canEdit} onChange={e => setConfig({ ...config, [m.id]: { ...config[m.id], max_daily_cups: +e.target.value } })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
            </div>
          </div>
        </div>
      ))}

      {canEdit && <button onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saved ? '✓ Saved!' : '⚡ Apply Config Remotely'}
      </button>}
      <div style={{ marginTop: 10, fontSize: 11, color: C.text3 }}>Changes take effect on next machine sync cycle (~2 min)</div>
    </div>
  )
}

export function ThresholdsSection({ role, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const canEdit = role === 'super_admin'
  const [machines, setMachines] = useState<any[]>([])
  const [thresholds, setThresholds] = useState<Record<string, any>>({})
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,state'))
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          const visible = d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true })
          setMachines(visible)
          const t: Record<string, any> = {}
          visible.forEach((m: any) => {
            let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {}
            const th = (st.machine_config && st.machine_config.thresholds) || {}
            t[m.id] = { temp_high: th.temp_high ?? 16, temp_low: th.temp_low ?? 2, temp_stop: th.temp_stop ?? 20 }
          })
          setThresholds(t)
        }
      })
  }, [])
  const save = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const h = { ...headers, Prefer: 'return=minimal' }
      await Promise.all(machines.map(async (m: any) => {
        // Merge thresholds into existing machine_config without wiping other keys
        const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id + '&select=state'), { headers }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
        let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
        const mc = st.machine_config || {}
        mc.thresholds = thresholds[m.id] || {}
        st.machine_config = mc
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id), { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify(st) }) })
      }))
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Thresholds</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Temperature alert thresholds per machine{!canEdit && ' · view only'}</div>
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.blueBg, border: '1px solid ' + C.blue + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 16 }}>
          🔒 These values are managed by the Super Admin. You can view them but not change them.
        </div>
      )}
      {machines.map(m => (
        <div key={m.id} style={{ marginBottom: 18, padding: 16, background: C.surface2, borderRadius: 12, border: '1px solid ' + C.border }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>{m.display_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Temp High Alert (°C)', key: 'temp_high', desc: 'Alert when above this' },
              { label: 'Temp Low Alert (°C)', key: 'temp_low', desc: 'Alert when below this' },
              { label: 'Temp Stop Selling (°C)', key: 'temp_stop', desc: 'Stop vending above this' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{f.label}</label>
                <input type="number" value={thresholds[m.id]?.[f.key] ?? ''} disabled={!canEdit} onChange={e => setThresholds({ ...thresholds, [m.id]: { ...thresholds[m.id], [f.key]: +e.target.value } })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
                <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {canEdit && <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Thresholds'}</button>}
    </div>
  )
}

export function NotificationsSection({ role, operatorId, SB_URL, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const canEdit = role === 'super_admin'
  const DEFAULT_ALERTS: Record<string, boolean> = {
    machine_offline: true, temperature_high: true, temperature_low: true,
    temperature_stop: true, stock_empty: true, stock_low: false,
    door_open: true, vend_failure: true, cup_empty: true, film_empty: true,
    waste_bin_full: true, power_loss: true, unusual_access: true,
  }
  const [phone, setPhone] = useState('')
  const [emails, setEmails] = useState('')
  const [telegramIds, setTelegramIds] = useState('')
  const [alerts, setAlerts] = useState<Record<string, boolean>>(DEFAULT_ALERTS)
  const [channels, setChannels] = useState<Record<string, boolean>>({ telegram: true, whatsapp: true, email: true })
  const [primaryId, setPrimaryId] = useState<string>('')
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,state&order=created_at.asc&limit=1'))
      .then(r => r.json()).then(d => {
        if (Array.isArray(d) && d[0]) {
          setPrimaryId(d[0].id)
          let st: any = {}; try { st = typeof d[0].state === 'string' ? JSON.parse(d[0].state || '{}') : (d[0].state || {}) } catch (e) {}
          const n = (st.machine_config && st.machine_config.notifications) || {}
          if (n.phone) setPhone(n.phone)
          if (n.telegram_chat_ids) setTelegramIds(Array.isArray(n.telegram_chat_ids) ? n.telegram_chat_ids.join(', ') : String(n.telegram_chat_ids))
          if (n.emails) setEmails(Array.isArray(n.emails) ? n.emails.join(', ') : String(n.emails)); else if (n.email) setEmails(String(n.email))
          if (n.alerts) setAlerts({ ...DEFAULT_ALERTS, ...n.alerts })
          if (n.channels) setChannels({ telegram: true, whatsapp: true, email: true, ...n.channels })
        }
      })
  }, [])
  const save = async () => {
    if (!canEdit || !primaryId) return
    setSaving(true)
    try {
      const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + primaryId + '&select=state'), { headers }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
      let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
      const mc = st.machine_config || {}
      mc.notifications = { phone, emails: emails.split(',').map(s => s.trim()).filter(Boolean), telegram_chat_ids: telegramIds.split(',').map(s => s.trim()).filter(Boolean), alerts, channels }
      st.machine_config = mc
      await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + primaryId), { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ state: JSON.stringify(st) }) })
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Notifications</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>WhatsApp alert notifications{!canEdit && ' · view only'}</div>
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.blueBg, border: '1px solid ' + C.blue + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 16 }}>
          🔒 These values are managed by the Super Admin. You can view them but not change them.
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>WhatsApp Number</label>
        <input value={phone} disabled={!canEdit} onChange={e => setPhone(e.target.value)} placeholder="+91 89771 10142"
          style={{ width: '100%', maxWidth: 300, padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
        <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Alerts will be sent via Twilio WhatsApp</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Alert Email(s)</label>
        <input value={emails} disabled={!canEdit} onChange={e => setEmails(e.target.value)} placeholder="ops@fruitlinktech.in, owner@fruitlinktech.in"
          style={{ width: '100%', maxWidth: 420, padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
        <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Comma-separated. Sent via Resend. Leave blank to use the default address.</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Telegram Chat IDs</label>
        <input value={telegramIds} disabled={!canEdit} onChange={e => setTelegramIds(e.target.value)} placeholder="8562917946, 8977110142"
          style={{ width: '100%', maxWidth: 420, padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed', boxSizing: 'border-box' as const }} />
        <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Comma-separated Telegram user/group IDs. Message @userinfobot on Telegram to get your ID.</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Channels</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
          {[['telegram', 'Telegram', '✈️'], ['whatsapp', 'WhatsApp', '💬'], ['email', 'Email', '✉️']].map(([key, label, icon]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: channels[key] ? C.orangeBg : C.surface2, border: '1px solid ' + (channels[key] ? C.orange : C.border), borderRadius: 10, cursor: canEdit ? 'pointer' : 'not-allowed', minWidth: 140 }}>
              <input type="checkbox" checked={channels[key] !== false} disabled={!canEdit} onChange={e => setChannels({ ...channels, [key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: C.orange }} />
              <span style={{ fontSize: 16 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
                <div style={{ fontSize: 11, color: C.text3 }}>{channels[key] !== false ? 'On' : 'Off'}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>Turn whole channels on/off. Individual alert types are controlled below.</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Alert Types</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Object.entries(alerts).map(([key, val]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: val ? C.orangeBg : C.surface2, border: '1px solid ' + (val ? C.orange : C.border), borderRadius: 10, cursor: canEdit ? 'pointer' : 'not-allowed' }}>
              <input type="checkbox" checked={val} disabled={!canEdit} onChange={e => setAlerts({ ...alerts, [key]: e.target.checked })} style={{ width: 16, height: 16, accentColor: C.orange }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{key.replace(/_/g, ' ').replace(/\w/g, l => l.toUpperCase())}</div>
                <div style={{ fontSize: 12, color: C.text3 }}>{val ? 'Enabled' : 'Disabled'}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      {canEdit && <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Notifications'}</button>}
    </div>
  )
}

export function CooldownsSection({ role, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const canEdit = role === 'super_admin'
  // The 17 standard alert types + their default cooldown hours and severity.
  const DEFAULTS: { type: string, label: string, severity: string, hours: number }[] = [
    { type: 'machine_offline', label: 'Machine Offline', severity: 'CRITICAL', hours: 1 },
    { type: 'temperature_high', label: 'High Temperature', severity: 'CRITICAL', hours: 1 },
    { type: 'temperature_low', label: 'Low Temperature', severity: 'HIGH', hours: 2 },
    { type: 'temperature_stop', label: 'Temp Stop Selling', severity: 'CRITICAL', hours: 1 },
    { type: 'stock_empty_l1', label: 'Layer 1 Empty', severity: 'HIGH', hours: 4 },
    { type: 'stock_empty_l2', label: 'Layer 2 Empty', severity: 'HIGH', hours: 4 },
    { type: 'stock_empty_l3', label: 'Layer 3 Empty', severity: 'HIGH', hours: 4 },
    { type: 'stock_low_l1', label: 'Layer 1 Low', severity: 'MEDIUM', hours: 6 },
    { type: 'stock_low_l2', label: 'Layer 2 Low', severity: 'MEDIUM', hours: 6 },
    { type: 'stock_low_l3', label: 'Layer 3 Low', severity: 'MEDIUM', hours: 6 },
    { type: 'door_open', label: 'Door Open', severity: 'HIGH', hours: 1 },
    { type: 'vend_failure', label: 'Vend Failure', severity: 'HIGH', hours: 0.5 },
    { type: 'cup_empty', label: 'Cups Empty', severity: 'HIGH', hours: 2 },
    { type: 'film_empty', label: 'Film Empty', severity: 'HIGH', hours: 2 },
    { type: 'waste_bin_full', label: 'Waste Bin Full', severity: 'HIGH', hours: 4 },
    { type: 'power_loss', label: 'Power Loss', severity: 'CRITICAL', hours: 0.5 },
    { type: 'unusual_access', label: 'Unusual Cabinet Access', severity: 'HIGH', hours: 1 },
  ]
  const SEV_COLOR: any = { CRITICAL: C.red, HIGH: C.amber, MEDIUM: C.blue }
  const SEV_BG: any = { CRITICAL: C.redBg, HIGH: C.amberBg, MEDIUM: C.blueBg }
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }

  const [machines, setMachines] = useState<any[]>([])
  const [cooldowns, setCooldowns] = useState<Record<string, any>>({})
  const [openM, setOpenM] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,state'))
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          const visible = d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true })
          setMachines(visible)
          const c: Record<string, any> = {}
          visible.forEach((m: any) => {
            let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {}
            const saved = (st.machine_config && st.machine_config.cooldowns) || {}
            const row: Record<string, number> = {}
            DEFAULTS.forEach(d => { row[d.type] = Number.isFinite(saved[d.type]) ? saved[d.type] : d.hours })
            c[m.id] = row
          })
          setCooldowns(c)
        }
      })
  }, [])

  const save = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const h = { ...headers, Prefer: 'return=minimal' }
      await Promise.all(machines.map(async (m: any) => {
        const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id + '&select=state'), { headers }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
        let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
        const mc = st.machine_config || {}
        mc.cooldowns = cooldowns[m.id] || {}
        st.machine_config = mc
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id), { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify(st) }) })
      }))
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }

  const setVal = (mid: string, type: string, v: number) => setCooldowns(prev => ({ ...prev, [mid]: { ...prev[mid], [type]: v } }))
  const resetMachine = (mid: string) => { const row: Record<string, number> = {}; DEFAULTS.forEach(d => row[d.type] = d.hours); setCooldowns(prev => ({ ...prev, [mid]: row })) }

  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Alert Cooldowns</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>How long before the same alert can fire again, per machine{!canEdit && ' · view only'}. Lower = more frequent reminders; higher = less spam.</div>
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.blueBg, border: '1px solid ' + C.blue + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 16 }}>
          🔒 Cooldowns are managed by the Super Admin. You can view them but not change them.
        </div>
      )}
      {machines.map(m => {
        const isOpen = openM[m.id] === true
        return (
          <div key={m.id} style={{ marginBottom: 14, background: C.surface, borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden' }}>
            <div onClick={() => setOpenM(prev => ({ ...prev, [m.id]: !isOpen }))}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer', background: C.surface2, userSelect: 'none' as const, borderBottom: isOpen ? '1px solid ' + C.border : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.display_name}</div>
                <div style={{ fontSize: 11, color: C.text3, fontFamily: 'monospace', marginTop: 1 }}>{m.sn}</div>
              </div>
              {canEdit && isOpen && <button onClick={(e) => { e.stopPropagation(); resetMachine(m.id) }} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 600, color: C.text2, cursor: 'pointer' }}>↺ Reset to defaults</button>}
              <span style={{ fontSize: 16, color: C.text3, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
            </div>
            {isOpen && (
              <div style={{ padding: '14px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {DEFAULTS.map(d => (
                    <div key={d.type} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.surface2, borderRadius: 9, border: '1px solid ' + C.border }}>
                      <span style={{ background: SEV_BG[d.severity], color: SEV_COLOR[d.severity], padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{d.severity}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{d.label}</div>
                        <div style={{ fontSize: 10.5, color: C.text3, fontFamily: 'monospace' }}>{d.type}</div>
                      </div>
                      <input type="number" step="0.5" min="0" value={cooldowns[m.id]?.[d.type] ?? d.hours} disabled={!canEdit}
                        onChange={e => setVal(m.id, d.type, parseFloat(e.target.value))}
                        style={{ width: 64, padding: '6px 8px', borderRadius: 7, border: '1px solid ' + C.border, fontSize: 13, textAlign: 'right', color: C.text, background: canEdit ? C.surface : C.surface2, cursor: canEdit ? 'text' : 'not-allowed' }} />
                      <span style={{ fontSize: 12, color: C.text3, flexShrink: 0 }}>h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {canEdit && <button onClick={save} disabled={saving} style={{ marginTop: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Cooldowns'}</button>}
      <div style={{ marginTop: 10, fontSize: 11, color: C.text3 }}>Changes apply on the next alert cycle (~2 min). Cooldown = minimum gap before the same alert repeats for that machine.</div>
    </div>
  )
}

export function StockTuningSection({ role, SB_KEY, showSaved, showErr, saving, setSaving, saved }: any) {
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
  const [machines, setMachines] = useState<any[]>([])
  const [tune, setTune] = useState<Record<string, any>>({})
  const DEF = { box_kg: 15, count: 100, capacity: 310, tare_g: 235, service_level: 90, open_hour: 9, close_hour: 22 }
  const hourLabel = (h: number) => h === 24 || h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? (h - 12) + ' PM' : h + ' AM'

  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,state'), { headers })
      .then(r => r.json()).then(d => {
        if (!Array.isArray(d)) return
        const visible = d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true })
        setMachines(visible)
        const t: Record<string, any> = {}
        visible.forEach((m: any) => {
          let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {}
          const s = (st.machine_config && st.machine_config.stock_tuning) || {}
          t[m.id] = { ...DEF, ...s }
        })
        setTune(t)
      })
  }, [])

  const setV = (mid: string, k: string, v: any) => setTune(prev => ({ ...prev, [mid]: { ...prev[mid], [k]: v } }))

  const save = async () => {
    setSaving(true)
    try {
      const h = { ...headers, Prefer: 'return=minimal' }
      await Promise.all(machines.map(async (m: any) => {
        const cur = await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id + '&select=state'), { headers }).then(r => r.json()).then(d => Array.isArray(d) && d[0] ? d[0] : {})
        let st: any = {}; try { st = typeof cur.state === 'string' ? JSON.parse(cur.state || '{}') : (cur.state || {}) } catch (e) {}
        const mc = st.machine_config || {}
        mc.stock_tuning = tune[m.id] || DEF
        st.machine_config = mc
        await fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?id=eq.' + m.id), { method: 'PATCH', headers: h, body: JSON.stringify({ state: JSON.stringify(st) }) })
      }))
      showSaved()
    } catch { showErr('Save failed') }
    setSaving(false)
  }

  const gpo = (t: any) => t && t.count > 0 ? Math.round((Number(t.box_kg || 15) * 1000) / Number(t.count)) : '—'
  const lbl: any = { display: 'block', fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const inputStyle: any = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid ' + C.border, fontSize: 14, outline: 'none', color: C.text, background: C.surface, boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Fruit &amp; Stock Tuning</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 18 }}>Tells the Console how to turn machine weight and sales into oranges, cups, runway and restock numbers. Set these to the box <b>count</b> you load — the panel does the rest.</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 14px', background: C.orangeBg, border: '1px solid ' + C.orange + '40', borderRadius: 10, fontSize: 12.5, color: C.text2, marginBottom: 18 }}>
        🍊 <div>Oranges come in a 15 kg box. The <b>count</b> is how many are in it (printed on the box). Lower count (<b>88</b>) = bigger oranges = about <b>4</b> per 250 ml cup. Higher count (<b>100</b>) = smaller = about <b>5</b> per cup. Set both and the maths follows your fruit.</div>
      </div>
      {machines.map((m: any) => {
        const t = tune[m.id] || DEF
        return (
          <div key={m.id} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{m.display_name}</div>
            <div style={{ fontSize: 11.5, color: C.text3, fontFamily: 'monospace', marginBottom: 14 }}>{m.sn}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>Box weight (kg)</label><input type="number" value={t.box_kg ?? ''} onChange={e => setV(m.id, 'box_kg', e.target.value === '' ? '' : +e.target.value)} style={inputStyle} /></div>
              <div><label style={lbl}>Orange count / box</label><input type="number" value={t.count ?? ''} onChange={e => setV(m.id, 'count', e.target.value === '' ? '' : +e.target.value)} style={inputStyle} /><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>≈ {gpo(t)} g per orange</div></div>
              <div><label style={lbl}>Oranges per 250 ml cup</label><div style={{ ...inputStyle, background: C.surface2, color: C.text2, display: 'flex', alignItems: 'center', fontWeight: 700 }}>{(Number(t.count) > 0 ? Number(t.count) : 100) <= 88 ? 4 : 5} per cup</div><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Follows the count · 80 or 88 → 4 · larger → 5</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <div><label style={lbl}>Machine capacity (oranges)</label><input type="number" value={t.capacity ?? ''} onChange={e => setV(m.id, 'capacity', e.target.value === '' ? '' : +e.target.value)} style={inputStyle} /><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Most it physically holds. F3/4/5 ≈ 310 · F1/2 ≈ 500</div></div>
              <div><label style={lbl}>Empty tray weight (g)</label><input type="number" value={t.tare_g ?? ''} onChange={e => setV(m.id, 'tare_g', e.target.value === '' ? '' : +e.target.value)} style={inputStyle} /><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Subtracted from scale</div></div>
              <div><label style={lbl}>Service level</label>
                <select value={t.service_level ?? 90} onChange={e => setV(m.id, 'service_level', +e.target.value)} style={inputStyle}>
                  {[['85', '85% — leaner buffer'], ['90', '90% — balanced'], ['95', '95% — safer']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Restock safety margin</div></div>
              <div><label style={lbl}>Open / close hour</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={t.open_hour ?? 9} onChange={e => setV(m.id, 'open_hour', +e.target.value)} style={{ ...inputStyle, padding: '9px 6px' }}>{Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
                  <select value={t.close_hour ?? 22} onChange={e => setV(m.id, 'close_hour', +e.target.value)} style={{ ...inputStyle, padding: '9px 6px' }}>{Array.from({ length: 24 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
                </div><div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>Machine running hours</div></div>
            </div>
          </div>
        )
      })}
      <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saved ? '✓ Saved!' : 'Save Fruit & Stock Settings'}</button>
      <div style={{ marginTop: 10, fontSize: 11, color: C.text3 }}>The Console reads these on its next refresh (~2 min) or when reopened.</div>
    </div>
  )
}

export function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [active, setActive] = useState('machine_config')
  const role = getCookie('fl_role') || 'operator'
  const operatorId = getCookie('fl_operator_id') || ''

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const showErr = () => { setErr(true); setTimeout(() => setErr(false), 3000) }

  const tabs = [
    { id: 'machine_config', label: 'Machine Config', icon: '⚙️' },
    { id: 'thresholds', label: 'Thresholds', icon: '🌡️' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'cooldowns', label: 'Alert Cooldowns', icon: '⏱️' },
    { id: 'stock', label: 'Fruit & Stock', icon: '🍊' },
    { id: 'billing', label: 'Billing', icon: '💳' },
    ...(role === 'super_admin' ? [{ id: 'danger', label: 'Danger Zone', icon: '⚠️' }] : []),
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      {saved && <div style={{ position: 'fixed', top: 20, right: 24, background: C.green, color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, zIndex: 9999 }}>✓ Saved!</div>}
      {err && <div style={{ position: 'fixed', top: 20, right: 24, background: C.red, color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, zIndex: 9999 }}>✗ Error saving</div>}
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 18 }}>Settings</div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' as const }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            style={{ padding: '7px 16px', borderRadius: 9, border: '1px solid ' + (active === t.id ? C.orange : C.border), background: active === t.id ? C.orange : C.surface, color: active === t.id ? '#fff' : C.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {active === 'machine_config' && <MachineConfigSection role={role} SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'thresholds' && <ThresholdsSection role={role} SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'notifications' && <NotificationsSection role={role} operatorId={operatorId} SB_URL={SB_URL} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'cooldowns' && <CooldownsSection role={role} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'stock' && <StockTuningSection role={role} SB_KEY={SB_KEY} showSaved={showSaved} showErr={showErr} saving={saving} setSaving={setSaving} saved={saved} />}
      {active === 'billing' && <BillingSection role={role} />}
      {active === 'danger' && role === 'super_admin' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.red, marginBottom: 16 }}>⚠️ Danger Zone</div>
          <div style={{ background: C.surface, border: '1px solid ' + C.red + '40', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>Destructive actions. Cannot be undone.</div>
            <button onClick={() => { if (confirm('Clear ALL alerts from database?')) { fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/alerts'), { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' } }).then(() => showSaved()).catch(() => showErr()) } }}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.red, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🗑️ Clear All Alerts
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function BillingSection({ role }: any) {
  const [machines, setMachines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const PLANS: any = {
    starter: { name: 'Starter', color: C.green, bg: C.greenBg, icon: '🟢', features: ['Live Console + Machine List + Fleet Map','Revenue & P&L Analytics','17 WhatsApp alert types','Remote machine config','UPI + NFC payments (0% MDR)','Up to 2 operators'] },
    professional: { name: 'Professional', color: C.orange, bg: C.orangeBg, icon: '⭐', features: ['Everything in Starter','Ad Content Manager','Loyalty Programme','Operators Management + RBAC','Up to 10 operators'] },
    enterprise: { name: 'Enterprise', color: C.blue, bg: C.blueBg, icon: '🏢', features: ['Everything in Professional','REST API + Webhooks','SAML SSO','Dedicated infrastructure','Unlimited operators'] },
  }
  useEffect(() => {
    fetch('/api/sb?path=' + encodeURIComponent('/rest/v1/machines?select=id,display_name,sn,status,location,state'))
      .then(r => r.json()).then(d => { setMachines(Array.isArray(d) ? d.filter((m: any) => { let st: any = {}; try { st = typeof m.state === 'string' ? JSON.parse(m.state || '{}') : (m.state || {}) } catch (e) {} return st.hidden !== true }) : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 2 }}>Billing & Plans</div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 22 }}>Manage subscription plan per machine</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 26 }}>
        {Object.entries(PLANS).map(([key, p]: any) => (
          <div key={key} style={{ background: C.surface, border: '2px solid ' + (key === 'professional' ? C.orange : C.border), borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ background: key === 'professional' ? C.orange : C.surface2, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: key === 'professional' ? '#fff' : C.text }}>{p.name}</span>
              </div>
              {key === 'professional' && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 8px' }}>POPULAR</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: p.color, fontWeight: 700, marginBottom: 10 }}>Pricing TBD per machine/month</div>
              {p.features.map((f: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: C.text2, marginBottom: 5 }}>
                  <span style={{ color: p.color, fontWeight: 700 }}>✓</span><span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Your Machines</div>
      {loading ? (
        <div style={{ color: C.text3 }}>Loading...</div>
      ) : machines.map((m: any) => (
        <div key={m.id} style={{ background: C.surface, border: '2px solid ' + (m.status === 'online' ? C.green + '50' : C.red + '50'), borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: 4, background: m.status === 'online' ? C.green : C.red }} />
          <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 16 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: m.status === 'online' ? C.greenBg : C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖥️</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 4 }}>{m.display_name}</div>
                <div style={{ fontSize: 13, color: C.text2, fontFamily: 'monospace', marginBottom: 4 }}>SN: {m.sn}</div>
                <div style={{ fontSize: 13, color: C.text2 }}>{m.location || '--'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>Starter Plan</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => alert('Razorpay coming soon')} style={{ padding: '7px 16px', borderRadius: 9, border: '2px solid ' + C.orange, background: C.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Upgrade to Professional</button>
                <button onClick={() => alert('Razorpay coming soon')} style={{ padding: '7px 16px', borderRadius: 9, border: '2px solid ' + C.blue, background: 'transparent', color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Upgrade to Enterprise</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
