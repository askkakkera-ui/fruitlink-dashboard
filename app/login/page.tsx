'use client';
import { useState } from 'react';
const LOGO = 'https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/logo.png';
const MACHINE = 'https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/machine.jpg';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid email or password');
        setLoading(false);
        return;
      }
      document.cookie = 'fl_auth=Fruitlink@2026!; path=/; max-age=86400';
      document.cookie = 'fl_operator_id=' + data.id + '; path=/; max-age=86400';
      document.cookie = 'fl_operator_name=' + data.name + '; path=/; max-age=86400';
      document.cookie = 'fl_role=' + data.role + '; path=/; max-age=86400';
      document.cookie = 'fl_state=' + data.state + '; path=/; max-age=86400';
      document.cookie = 'fl_country=' + data.country + '; path=/; max-age=86400';
      window.location.href = '/';
    } catch(e) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  }
  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'sans-serif'}}>
      <div style={{flex:1,background:'linear-gradient(135deg,#E8650A 0%,#BF4F00 100%)',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'3rem',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'-80px',left:'-80px',width:'400px',height:'400px',borderRadius:'50%',border:'50px solid rgba(255,255,255,0.06)'}}/>
        <div style={{position:'absolute',bottom:'-60px',left:'-60px',width:'300px',height:'300px',borderRadius:'50%',border:'40px solid rgba(255,255,255,0.06)'}}/>
        <div style={{position:'relative',zIndex:2}}>
          <div style={{display:'inline-block',background:'rgba(255,255,255,0.15)',borderRadius:'16px',padding:'10px 16px',backdropFilter:'blur(4px)'}}>
            <img src={LOGO} alt="Fruitlink" style={{width:'200px',objectFit:'contain',display:'block'}}/>
          </div>
        </div>
        <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'flex-end',gap:'1rem'}}>
          <div style={{flex:1}}>
            <div style={{color:'#fff',fontSize:'26px',fontWeight:600,lineHeight:1.3,marginBottom:'1rem'}}>Smart Vending.<br/>Real-time Control.<br/>Everywhere.</div>
            <div style={{color:'rgba(255,255,255,0.75)',fontSize:'13px',lineHeight:1.7,marginBottom:'1.5rem'}}>Monitor your fresh juice machines,<br/>track orders and manage alerts.</div>
            <div style={{display:'flex',gap:'0.75rem'}}>
              {[['24/7','Monitoring'],['24','Alert types'],['Live','Telemetry']].map(([n,l])=>(
                <div key={l} style={{background:'rgba(255,255,255,0.12)',borderRadius:'10px',padding:'0.75rem 1rem',textAlign:'center',minWidth:'75px'}}>
                  <div style={{color:'#fff',fontSize:'17px',fontWeight:600}}>{n}</div>
                  <div style={{color:'rgba(255,255,255,0.7)',fontSize:'10px',marginTop:'3px'}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{width:'300px',flexShrink:0,marginBottom:'-3rem'}}>
            <div style={{background:'rgba(255,255,255,0.1)',borderRadius:'20px',padding:'12px',backdropFilter:'blur(4px)'}}>
              <img src={MACHINE} alt="Fruitful Vending Machine" style={{width:'100%',objectFit:'contain',borderRadius:'12px'}}/>
            </div>
          </div>
        </div>
      </div>
      <div style={{width:'420px',background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'3rem 2.5rem'}}>
        <div style={{width:'100%',maxWidth:'340px'}}>
          <div style={{textAlign:'center',marginBottom:'2rem'}}>
            <img src={LOGO} alt="Fruitlink" style={{width:'240px',objectFit:'contain',marginBottom:'0.5rem'}}/>
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