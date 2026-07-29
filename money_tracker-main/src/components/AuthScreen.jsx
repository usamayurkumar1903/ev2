import { useState } from 'react';
import { Wallet, Mail, Lock, Eye, EyeOff, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

export default function AuthScreen() {
  var { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  var { toast } = useToast();

  var modeS      = useState('signin'); var mode = modeS[0];       var setMode    = modeS[1];
  var emailS     = useState('');       var email = emailS[0];     var setEmail   = emailS[1];
  var passS      = useState('');       var pass = passS[0];       var setPass    = passS[1];
  var showPS     = useState(false);    var showP = showPS[0];     var setShowP   = showPS[1];
  var busyS      = useState(false);    var busy = busyS[0];       var setBusy    = busyS[1];
  var errS       = useState('');       var err = errS[0];         var setErr     = errS[1];
  var warnS      = useState(false);    var showWarn = warnS[0];   var setShowWarn= warnS[1];

  async function handleGoogle() {
    setBusy(true); setErr('');
    try { await signInWithGoogle(); }
    catch (e) { setErr(e.message || 'Google sign-in failed.'); setBusy(false); }
  }

  async function handleEmail(e) {
    e.preventDefault();
    if (!email || !pass) { setErr('Enter your email and password.'); return; }
    if (pass.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setBusy(true); setErr('');
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, pass);
        toast('Account created! Check your email to confirm.', 'success', 5000);
      } else {
        await signInWithEmail(email, pass);
        toast('Signed in!', 'success');
      }
    } catch (e) {
      setErr(e.message || 'Authentication failed.');
    } finally { setBusy(false); }
  }

  function handleSkipConfirmed() {
    setShowWarn(false);
    localStorage.setItem('et-skip-auth', '1');
    window.location.reload();
  }

  var inputStyle = {
    width: '100%', padding: '12px 14px', background: 'var(--bg-input)',
    border: '1px solid var(--border-light)', borderRadius: 12,
    fontSize: 15, color: 'var(--text)', outline: 'none',
  };

  return (
    <>
      {/* ── Warning modal — "continue without account" ── */}
      {showWarn && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 360,
            border: '1px solid var(--border-light)', padding: '24px 20px',
            animation: 'dialog-in 200ms cubic-bezier(0.34,1.26,0.64,1) forwards',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--danger-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Data Warning</span>
              </div>
              <button onClick={function () { setShowWarn(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 6 }}>
              <strong style={{ color: 'var(--text)' }}>Without signing in, your data is only stored on this device.</strong>
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
              If you clear your browser data, uninstall the app, or switch to another device — <strong style={{ color: 'var(--danger)' }}>all your transactions will be permanently lost.</strong> You cannot recover them without an account.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary btn-full"
                style={{ height: 46 }}
                onClick={function () { setShowWarn(false); }}
                type="button"
              >
                Sign in instead (recommended)
              </button>
              <button
                className="btn btn-full"
                style={{ height: 44, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 13 }}
                onClick={handleSkipConfirmed}
                type="button"
              >
                I understand, continue without account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main auth screen ── */}
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px', overflowY: 'auto',
      }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Wallet size={28} color="#fff" strokeWidth={2} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
          Expense Tracker
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 32, textAlign: 'center' }}>
          Sign in to sync your data across devices
        </p>

        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Google */}
          <button type="button" onClick={handleGoogle} disabled={busy} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            height: 48, borderRadius: 12, border: '1px solid var(--border-light)',
            background: 'var(--bg-input)', fontSize: 14, fontWeight: 600,
            color: 'var(--text)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              <input type="email" placeholder="Email address" value={email}
                onChange={function (e) { setEmail(e.target.value); setErr(''); }}
                style={Object.assign({}, inputStyle, { paddingLeft: 40 })}
                autoComplete="email" disabled={busy} />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              <input type={showP ? 'text' : 'password'} placeholder="Password" value={pass}
                onChange={function (e) { setPass(e.target.value); setErr(''); }}
                style={Object.assign({}, inputStyle, { paddingLeft: 40, paddingRight: 44 })}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} disabled={busy} />
              <button type="button" onClick={function () { setShowP(function (s) { return !s; }); }}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}>
                {showP ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {err && (
              <div style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-dim)', borderRadius: 8, padding: '8px 12px' }}>
                {err}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary btn-full"
              style={{ height: 48, fontSize: 15, fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {/* Toggle */}
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
            {mode === 'signin' ? (
              <>Don't have an account?{' '}
                <button type="button" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  onClick={function () { setMode('signup'); setErr(''); }}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  onClick={function () { setMode('signin'); setErr(''); }}>Sign in</button>
              </>
            )}
          </div>

          {/* Skip — now shows warning first */}
          <button type="button"
            style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={function () { setShowWarn(true); }}>
            Continue without account (local only)
          </button>
        </div>
      </div>
    </>
  );
}
