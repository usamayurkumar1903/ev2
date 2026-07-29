import { lazy, Suspense } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Plus, LayoutDashboard, ArrowLeftRight, BookOpen, Settings, Wallet } from 'lucide-react';
import { useState } from 'react';
import BottomNav from './components/BottomNav';
import TransactionModal from './components/TransactionModal';
import LockScreen from './components/LockScreen';
import { isPinLockEnabled } from './utils/pin';

const Dashboard    = lazy(function() { return import('./pages/Dashboard'); });
const Transactions = lazy(function() { return import('./pages/Transactions'); });
const Books        = lazy(function() { return import('./pages/Books'); });
const SettingsPage = lazy(function() { return import('./pages/Settings'); });

const NAV = [
  { to: '/',             end: true, label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/transactions',             label: 'History',   Icon: ArrowLeftRight },
  { to: '/books',                    label: 'Books',     Icon: BookOpen },
  { to: '/settings',                 label: 'Settings',  Icon: Settings },
];

function Fallback() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[100,70,85,60,90].map(function(w, i) {
        return <div key={i} style={{ height: 14, width: w + '%', background: '#2C2C2E', borderRadius: 7, animation: 'none', opacity: 0.5 }} />;
      })}
    </div>
  );
}

export default function App() {
  var lockedS = useState(function () { return isPinLockEnabled(); });
  var locked = lockedS[0]; var setLocked = lockedS[1];
  const [addOpen, setAddOpen] = useState(false);
  const location = useLocation();
  const showFab = location.pathname === '/' || location.pathname === '/transactions';

  if (locked) {
    return <LockScreen onUnlock={function () { setLocked(false); }} />;
  }

  return (
    <div className="app">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Wallet size={18} color="#fff" strokeWidth={2} />
          </div>
          <span className="sidebar-logo-text">Expenses</span>
        </div>

        {NAV.map(function(item) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={function(p) { return 'sidebar-nav-item' + (p.isActive ? ' active' : ''); }}
            >
              {function(p) {
                return (
                  <>
                    <item.Icon size={18} strokeWidth={p.isActive ? 2.2 : 1.7} />
                    {item.label}
                  </>
                );
              }}
            </NavLink>
          );
        })}

        <div className="sidebar-spacer" />

        <button
          className="btn btn-primary btn-full"
          onClick={function() { setAddOpen(true); }}
          style={{ gap: 8 }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Add Transaction
        </button>
      </aside>

      {/* Main content */}
      <div className="app-body">
        <main className="main">
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/"             element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/books"        element={<Books />} />
              <Route path="/settings"     element={<SettingsPage />} />
              <Route path="*"             element={<Dashboard />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* FAB (mobile only) */}
      {showFab && (
        <button
          className="fab"
          onClick={function() { setAddOpen(true); }}
          aria-label="Add transaction"
          style={{ display: 'flex' }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      <style>{`
        @media (min-width: 768px) {
          .fab { display: none !important; }
        }
      `}</style>

      <TransactionModal open={addOpen} onClose={function() { setAddOpen(false); }} />
    </div>
  );
}
