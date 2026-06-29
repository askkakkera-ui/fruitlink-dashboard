'use client';
import { useState, useEffect } from 'react';

const LOGO = 'https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 860);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  async function handleLogin() {
    setError('');
    // Inline email validation — fail fast before hitting the server
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
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
      // "Remember me": 30 days when ticked, 24h otherwise. Cookie names/values unchanged.
      const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
      document.cookie = 'fl_auth=fl_secure_2026; path=/; max-age=' + maxAge;
      document.cookie = 'fl_operator_id=' + data.id + '; path=/; max-age=' + maxAge;
      document.cookie = 'fl_operator_name=' + data.name + '; path=/; max-age=' + maxAge;
      document.cookie = 'fl_role=' + data.role + '; path=/; max-age=' + maxAge;
      document.cookie = 'fl_state=' + data.state + '; path=/; max-age=' + maxAge;
      document.cookie = 'fl_country=' + data.country + '; path=/; max-age=' + maxAge;
      window.location.href = '/';
    } catch (e) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  }

  const orange = '#E2640A';
  const amber = '#F59E0B';
  const ink = '#1A1A1A';
  const grey = '#6B7280';
  const line = '#E5E7EB';
  const display = '"Bricolage Grotesque", system-ui, sans-serif';

  const inputStyle: any = {
    width: '100%', height: '48px', border: '1.5px solid ' + line, background: '#fff',
    borderRadius: '11px', padding: '0 14px', fontSize: '15px', color: ink, outline: 'none',
    transition: '.18s', boxSizing: 'border-box',
  };
  const focusOn = (e: any) => { e.target.style.borderColor = orange; e.target.style.boxShadow = '0 0 0 4px rgba(226,100,10,.14)'; };
  const focusOff = (e: any) => { e.target.style.borderColor = line; e.target.style.boxShadow = 'none'; };

  // Feature highlights for the hero — software promise, no machine data shown
  const features: [string, string][] = [
    ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z|circle:12,12,3', 'Live machine monitoring'],
    ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 0 1-3.46 0', 'Instant alerts when something needs you'],
    ['M3 3v18h18|M7 14l3-3 3 3 5-5', 'Sales & inventory analytics'],
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', color: ink }}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap');
@keyframes fl-spin{to{transform:rotate(360deg)}}
.fl-input::placeholder{color:#9CA3AF}
`}</style>

      {/* ── LEFT HERO (desktop only) ── */}
      {!isMobile && (
        <div style={{
          flex: '1.15', position: 'relative', overflow: 'hidden', color: '#fff',
          background: 'linear-gradient(150deg,#F59E0B 0%,#E2640A 45%,#C2410C 100%)',
          display: 'flex', alignItems: 'center', padding: '64px 56px',
        }}>
          <div style={{ position: 'absolute', width: '520px', height: '520px', top: '-160px', left: '-120px', borderRadius: '50%', background: 'rgba(255,255,255,.10)' }} />
          <div style={{ position: 'absolute', width: '360px', height: '360px', bottom: '-120px', right: '-80px', borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />

          <div style={{ position: 'relative', zIndex: 2, maxWidth: '560px', width: '100%' }}>
            {/* Brand — single integrated logo */}
            <div style={{ display: 'inline-flex', background: '#fff', borderRadius: '14px', padding: '12px 18px', marginBottom: '44px', boxShadow: '0 10px 30px rgba(120,40,0,.18)' }}>
              <img src={LOGO} alt="Fruitlink Technologies" style={{ width: '170px', objectFit: 'contain', display: 'block' }} />
            </div>

            <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: '46px', lineHeight: 1.04, letterSpacing: '-1.2px', marginBottom: '18px' }}>
              Smart vending,<br />real-time control,<br />everywhere.
            </h1>
            <p style={{ fontSize: '16px', lineHeight: 1.5, opacity: .92, maxWidth: '430px', marginBottom: '36px' }}>
              Monitor your fresh juice machines, track orders, and act on alerts the moment they happen.
            </p>

            {/* Feature highlights (no machine data) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {features.map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {icon.split('|').map((seg, i) => {
                        if (seg.startsWith('circle:')) { const [cx, cy, r] = seg.slice(7).split(','); return <circle key={i} cx={cx} cy={cy} r={r} />; }
                        return <path key={i} d={seg} />;
                      })}
                    </svg>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RIGHT FORM PANEL ── */}
      <div style={{
        width: isMobile ? '100%' : '460px', flexShrink: 0, background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '2.5rem 1.25rem' : '48px 44px',
      } as any}>
        <div style={{ width: '100%', maxWidth: '360px' }}>

          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <img src={LOGO} alt="Fruitlink" style={{ width: '100%', maxWidth: '210px', objectFit: 'contain', marginBottom: '14px' }} />
            <h1 style={{ fontFamily: display, fontWeight: 700, fontSize: '26px', color: ink, margin: '4px 0 6px' }}>Welcome back</h1>
            <p style={{ fontSize: '14px', color: grey }}>Sign in to your operator account</p>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '7px' }}>Email address</label>
            <input
              className="fl-input"
              type="email"
              autoFocus
              placeholder="you@fruitlinktech.in"
              value={email}
              onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={inputStyle}
              onFocus={focusOn}
              onBlur={focusOff}
            />
          </div>

          {/* Password with show/hide */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '7px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="fl-input"
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ ...inputStyle, padding: '0 46px 0 14px' }}
                onFocus={focusOn}
                onBlur={focusOff}
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '34px', height: '34px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '8px', display: 'grid', placeItems: 'center', color: grey }}
              >
                {showPw ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: orange }} />
              Remember me
            </label>
            <a href="/forgot-password" style={{ color: orange, fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>Forgot password?</a>
          </div>

          {error && (
            <div style={{ color: '#B42318', fontSize: '13px', marginBottom: '14px', padding: '10px 12px', background: '#FFF5F5', borderRadius: '8px', border: '1px solid #FED7D7' }}>{error}</div>
          )}

          {/* Sign in */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', height: '50px', border: 'none', borderRadius: '11px',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg,' + amber + ',' + orange + ')', color: '#fff',
              fontWeight: 600, fontSize: '15px', fontFamily: 'inherit',
              boxShadow: '0 8px 20px rgba(226,100,10,.28)', transition: '.18s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              opacity: loading ? .85 : 1,
            } as any}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            {loading && <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'fl-spin .7s linear infinite' }} />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {/* Security cue */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginTop: '16px', color: grey, fontSize: '12px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Secure, encrypted sign-in
          </div>

          {/* Provisioned access, not open signup */}
          <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '13px', color: grey }}>
            Need operator access? <a href="mailto:support@fruitlinktech.in" style={{ color: orange, fontWeight: 500, textDecoration: 'none' }}>Contact us</a>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: '18px', justifyContent: 'center', marginBottom: '8px' }}>
              <a href="/privacy" style={{ color: grey, fontSize: '12px', textDecoration: 'none' }}>Privacy</a>
              <a href="/terms" style={{ color: grey, fontSize: '12px', textDecoration: 'none' }}>Terms</a>
              <a href="mailto:support@fruitlinktech.in" style={{ color: grey, fontSize: '12px', textDecoration: 'none' }}>Support</a>
            </div>
            <div style={{ color: '#9CA3AF', fontSize: '11px' }}>Fruitlink Technologies Pvt Ltd · Hyderabad</div>
          </div>

        </div>
      </div>
    </div>
  );
}
