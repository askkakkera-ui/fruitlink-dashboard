const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

router.post('/register', async (req, res) => {
  const { sn, firmware, mac, model } = req.body;
  if (!sn) return res.status(400).json({ error: 'sn required' });
  try {
    const { data: existing } = await supabase.from('machines').select('id,sn,display_name,operator_id').eq('sn', sn).single();
    if (existing) {
      await supabase.from('machines').update({ last_seen: new Date(), status: 'online', firmware: firmware||null, mac: mac||null }).eq('sn', sn);
      return res.json({ success: true, registered: false, machine_id: existing.id, display_name: existing.display_name, operator_id: existing.operator_id });
    }
    const { data: nm, error: err } = await supabase.from('machines').insert({ sn, display_name: model||sn, firmware: firmware||null, mac: mac||null, status: 'online', last_seen: new Date() }).select('id,sn,display_name').single();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, registered: true, machine_id: nm.id, display_name: nm.display_name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/heartbeat', async (req, res) => {
  const { sn, inner_temp, stock_l1, stock_l2, stock_l3, door_open, fault_code } = req.body;
  try {
    const { data: m } = await supabase.from('machines').update({ last_seen: new Date(), status: 'online' }).eq('sn', sn).select('id').single();
    if (!m) return res.status(404).json({ error: 'not found' });
    await supabase.from('telemetry').insert({ machine_id: m.id, inner_temp_c: inner_temp, stock_l1, stock_l2, stock_l3, door_open, fault_bitmap: fault_code||0 });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/config/:sn', async (req, res) => {
  const { data } = await supabase.from('machines').select('*').eq('sn', req.params.sn).single();
  res.json({ success: true, data });
});

router.post('/serial-log', async (req, res) => {
  const { sn, logs } = req.body;
  if (!sn || !Array.isArray(logs)) return res.status(400).json({ error: 'sn and logs required' });
  try {
    const { data: m } = await supabase.from('machines').select('id').eq('sn', sn).single();
    if (!m) return res.status(404).json({ error: 'not found' });
    const rows = logs.map(l => ({ machine_id: m.id, time: l.time||new Date().toISOString(), cmd: l.cmd||'', response: l.response||null }));
    const { error } = await supabase.from('serial_logs').insert(rows);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/fault-log', async (req, res) => {
  const { sn, faults } = req.body;
  if (!sn || !Array.isArray(faults)) return res.status(400).json({ error: 'sn and faults required' });
  try {
    const { data: m } = await supabase.from('machines').select('id').eq('sn', sn).single();
    if (!m) return res.status(404).json({ error: 'not found' });
    const rows = faults.map(f => ({ machine_id: m.id, fault_code: f.fault_code||f.code, fault_name: f.fault_name||f.name||null, is_active: f.is_active!==undefined?f.is_active:true, is_halted: f.is_halted!==undefined?f.is_halted:false, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('faults').upsert(rows, { onConflict: 'machine_id,fault_code' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/serial-log/:sn', async (req, res) => {
  const limit = parseInt(req.query.limit)||50;
  try {
    const { data: m } = await supabase.from('machines').select('id').eq('sn', req.params.sn).single();
    if (!m) return res.status(404).json({ error: 'not found' });
    const { data } = await supabase.from('serial_logs').select('*').eq('machine_id', m.id).order('time', { ascending: false }).limit(limit);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fault-log/:sn', async (req, res) => {
  try {
    const { data: m } = await supabase.from('machines').select('id').eq('sn', req.params.sn).single();
    if (!m) return res.status(404).json({ error: 'not found' });
    let q = supabase.from('faults').select('*').eq('machine_id', m.id).order('updated_at', { ascending: false });
    if (req.query.active === 'true') q = q.eq('is_active', true);
    const { data } = await q.limit(100);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;