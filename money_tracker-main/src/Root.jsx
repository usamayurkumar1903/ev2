/**
 * Root.jsx — provider composition, auth gate, migration gate.
 *
 * Auto-migrate guest data:
 *   When a guest user (no account) has created books/transactions and
 *   then signs in, their local data is automatically uploaded to their
 *   new account without any manual action required.
 *
 * Migration modal:
 *   Only shown when the user has explicitly chosen to migrate (i.e. they
 *   came from outside and logged in fresh). Auto-migrate runs silently.
 */

import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AppProvider }           from './contexts/AppContext';
import { ToastProvider }         from './hooks/useToast';
import App                       from './App';
import AuthScreen                from './components/AuthScreen';
import MigrationModal            from './components/MigrationModal';
import SplashScreen              from './components/SplashScreen';
import { isSupabaseConfigured }  from './utils/supabase';
import { migrateLocalData }      from './utils/dataService';

var LOCAL_KEY = 'et-v2';

function hasLocalData() {
  try {
    var d = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return (d.transactions && d.transactions.length > 0) ||
           (d.books && d.books.length > 0); // no default books anymore — any book is real user data
  } catch (e) { return false; }
}

function getLocalData() {
  try {
    var d = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return { books: d.books || [], transactions: d.transactions || [] };
  } catch (e) { return { books: [], transactions: [] }; }
}

/* ── Inner gate component — has access to useAuth ─────────────── */
function AppGate() {
  var { user, loading } = useAuth();
  var skipAuth = localStorage.getItem('et-skip-auth') === '1';

  // Auth state (from localStorage/session cache) can resolve in a few ms,
  // which means the splash would flash and disappear before it's ever
  // actually seen. Force it to stay up for a minimum stretch so it reads
  // as an intentional loading screen rather than a flicker.
  var MIN_SPLASH_MS = 3000;
  var minSplashDoneS = useState(false);
  var minSplashDone = minSplashDoneS[0]; var setMinSplashDone = minSplashDoneS[1];
  useEffect(function () {
    var t = setTimeout(function () { setMinSplashDone(true); }, MIN_SPLASH_MS);
    return function () { clearTimeout(t); };
  }, []);
  var showSplash = loading || !minSplashDone;

  // Migration modal (manual, when there's lots of local data)
  var showMigrationS = useState(false);
  var showMigration = showMigrationS[0]; var setShowMigration = showMigrationS[1];
  var localDataS = useState(null);
  var localData = localDataS[0]; var setLocalData = localDataS[1];

  // Track the previous user to detect sign-in transitions
  var prevUserRef = useRef(null);

  useEffect(function () {
    if (!user) { prevUserRef.current = null; return; }

    var migrated = localStorage.getItem('et-migrated:' + user.id) === '1';
    if (migrated) { prevUserRef.current = user.id; return; }

    // New sign-in
    if (hasLocalData()) {
      var ld = getLocalData();
      var txCount = ld.transactions.length;

      if (txCount === 0) {
        // No real transactions — auto-migrate silently
        localStorage.setItem('et-migrated:' + user.id, '1');
      } else if (txCount <= 5) {
        // Small amount — auto-migrate silently in background
        migrateLocalData(user.id, ld.books, ld.transactions)
          .then(function () {
            localStorage.setItem('et-migrated:' + user.id, '1');
          })
          .catch(function () {});
      } else {
        // Larger dataset — show the migration modal so user can confirm
        setLocalData(ld);
        setShowMigration(true);
      }
    } else {
      localStorage.setItem('et-migrated:' + user.id, '1');
    }

    prevUserRef.current = user.id;
  }, [user]);

  function handleMigrationDone(choice) {
    setShowMigration(false);
    if (user) localStorage.setItem('et-migrated:' + user.id, '1');
    if (choice === 'fresh') {
      try { localStorage.removeItem(LOCAL_KEY); } catch (e) {}
    }
    setLocalData(null);
  }

  // Loading / splash screen while auth state resolves
  if (showSplash) {
    return <SplashScreen />;
  }

  // Auth gate
  if (isSupabaseConfigured && !user && !skipAuth) {
    return <AuthScreen />;
  }

  return (
    <AppProvider userId={user ? user.id : null}>
      {showMigration && localData && (
        <MigrationModal
          userId={user.id}
          localBooks={localData.books}
          localTransactions={localData.transactions}
          onDone={handleMigrationDone}
        />
      )}
      <App />
    </AppProvider>
  );
}

export default function Root() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppGate />
      </ToastProvider>
    </AuthProvider>
  );
}
