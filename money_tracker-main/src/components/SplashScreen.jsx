import { Wallet } from 'lucide-react';

/**
 * SplashScreen — shown while auth/session state is resolving on boot.
 * Purely presentational; does not read or change any app state.
 */
export default function SplashScreen() {
  return (
    <div className="splash-root">
      <div className="splash-logo">
        <Wallet size={30} color="#fff" strokeWidth={2} />
      </div>
      <div className="splash-title">Expenses</div>
      <div className="splash-ring" aria-hidden="true">
        <span></span>
      </div>

      <style>{`
        .splash-root {
          position: fixed;
          inset: 0;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          z-index: 9999;
          animation: splash-fade-in 260ms ease both;
        }
        .splash-logo {
          width: 68px;
          height: 68px;
          border-radius: 20px;
          background: var(--accent-gradient, var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 28px var(--accent-glow, rgba(124,58,237,0.3));
          animation: splash-pop 420ms cubic-bezier(0.34,1.26,0.64,1) both;
        }
        .splash-title {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.2px;
          color: var(--text);
          opacity: 0;
          animation: splash-fade-up 380ms ease 120ms both;
        }
        .splash-ring {
          width: 26px;
          height: 26px;
          position: relative;
          opacity: 0;
          animation: splash-fade-up 380ms ease 220ms both;
        }
        .splash-ring span {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2.5px solid var(--border-light);
          border-top-color: var(--accent);
          animation: splash-spin 0.8s linear infinite;
        }
        @keyframes splash-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes splash-pop {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
