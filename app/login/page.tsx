[13:39, 21/05/2026] FRUITFUL GLOBAL: 'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleLogin() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('operators')
      .select('id, name, email, password_hash')
      .eq('email', email)
      .eq('password_hash', password)
      .single();
    if (error || !data) {
      setError('Invalid em…
[13:40, 21/05/2026] FRUITFUL GLOBAL: 'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);
const LOGO = 'https://raw.githubusercontent.com/askkakkera-ui/fruitlink-dashboard/main/public/logo.png';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleLogin() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('operators')
      .select('id, name, email, password_hash')
      .eq('email', email)
      .eq('password_hash', password)
      .single();
    if (error || !data) {
      setError('Invalid email or password');
      setLoading(false);
      return;
    }
    document.cookie = 'fl_auth=fruitlink2026; path=/; max-age=86400';
    document.cookie = 'fl_operator_id=' + data.id + '; path=/; max-age=86400';
    document.cookie = 'fl_operator_name=' + data.name + '; path=/; max-age=86400';
    window.location.href = '/';
  }
  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'sans-serif'}}>
      <div style={{flex:1,background:'linear-gradient(135deg,#E8650A 0%,#BF4F00 100%)',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'3rem',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'-80px',left:'-80px',width:'400px',height:'400px',borderRadius:'50%',border:'50px solid rgba(255,255,255,0.06)'}}/>
        <div style={{position:'absolute',bottom:'-60px',right:'-60px',width:'300px',height:'300px',borderRadius:'50%',border:'40px solid rgba(255,255,255,0.06)'}}/>
        <div style={{position:'relative',zIndex:2}}>
          <img src={LOGO} alt="Fruitlink Technologies" style={{width:'280px',objectFit:'contain'}}/>
        </div>
        <div style={{position:'relative',zIndex:2}}>
          <div style={{color:'#fff',fontSize:'28px',fontWeight:600,lineHeight:1.3,marginBottom:'1rem'}}>Smart Vending.<br/>Real-time Control.<br/>Everywhere.</div>
          <div style={{color:'rgba(255,255,255,0.75)',fontSize:'14px',lineHeight:1.7,marginBottom:'2rem'}}>Monitor your fresh juice machines, track orders,<br/>manage alerts — all in one place.</div>
          <div style={{display:'flex',gap:'1rem'}}>
            {[['24/7','Monitoring'],['24','Alert types'],['Live','Telemetry']].map(([n,l])=>(
              <div key={l} style={{background:'rgba(255,255,255,0.12)',borderRadius:'10px',padding:'0.75rem 1rem',textAlign:'center',minWidth:'80px'}}>
                <div style={{color:'#fff',fontSize:'18px',fontWeight:600}}>{n}</div>
                <div style={{color:'rgba(255,255,255,0.7)',fontSize:'11px',marginTop:'3px'}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{width:'420px',background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'3rem 2.5rem'}}>
        <div style={{width:'100%',maxWidth:'340px'}}>
          <div style={{textAlign:'center',marginBottom:'2rem'}}>
            <img src={LOGO} alt="Fruitlink" style={{width:'220px',objectFit:'contain',marginBottom:'1rem'}}/>
            <div style={{fontSize:'20px',fontWeight:600,color:'#D45A00'}}>Welcome back</div>
            <div style={{fontSize:'13px',color:'#999',marginTop:'4px'}}>Sign in to your operator account</div>
          </div>
          <div style={{marginBottom:'1rem'}}>
            <label style={{fontSize:'12px',color:'#888',display:'block',marginBottom:'6px'}}>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{width:'100%',border:'1px solid #E5E5E5',borderRadius:'8px',padding:'11px 14px',fontSize:'14px',outline:'none',boxSizing:'border-box' as any,background:'#FAFAFA'}}
              onFocus={e=>{e.target.style.borderColor='#F5820D';e.target.style.background='#fff'}}
              onBlur={e=>{e.target.style.borderColor='#E5E5E5';e.target.style.background='#FAFAFA'}}
            />
          </div>
          <div style={{marginBottom:'0.5rem'}}>
            <label style={{fontSize:'12px',color:'#888',display:'block',marginBottom:'6px'}}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{width:'100%',border:'1px solid #E5E5E5',borderRadius:'8px',padding:'11px 14px',fontSize:'14px',outline:'none',boxSizing:'border-box' as any,background:'#FAFAFA'}}
              onFocus={e=>{e.target.style.borderColor='#F5820D';e.target.style.background='#fff'}}
              onBlur={e=>{e.target.style.borderColor='#E5E5E5';e.target.style.background='#FAFAFA'}}
            />
          </div>
          {error && <div style={{color:'#e53e3e',fontSize:'12px',marginBottom:'0.75rem',padding:'8px 12px',background:'#FFF5F5',borderRadius:'6px',border:'1px solid #FED7D7'}}>{error}</div>}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{width:'100%',background:loading?'#E8A87C':'#F5820D',color:'#fff',border:'none',borderRadius:'8px',padding:'13px',fontSize:'15px',fontWeight:500,cursor:loading?'not-allowed':'pointer',marginTop:'0.75rem'}}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'1rem'}}>
            <a href="/forgot-password" style={{fontSize:'12px',color:'#F5820D',textDecoration:'none'}}>Forgot password?</a>
            <a href="/register" style={{fontSize:'12px',color:'#F5820D',textDecoration:'none'}}>Create account</a>
          </div>
          <div style={{borderTop:'1px solid #F0F0F0',marginTop:'1.5rem',paddingTop:'1rem',textAlign:'center'}}>
            <div style={{fontSize:'11px',color:'#CCC'}}>Fruitlink Technologies Pvt Ltd · Hyderabad</div>
          </div>
        </div>
      </div>
    </div>
  );
}