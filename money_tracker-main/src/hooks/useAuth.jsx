import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { flushQueue } from '../utils/offlineQueue';

var AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  var sessionS = useState(null); var session = sessionS[0]; var setSession = sessionS[1];
  var loadingS = useState(true); var loading = loadingS[0]; var setLoading = loadingS[1];
  var userS    = useState(null); var user = userS[0];       var setUser    = userS[1];

  useEffect(function () {
    if (!isSupabaseConfigured) { setLoading(false); return; }

    supabase.auth.getSession().then(function (res) {
      var s = res.data && res.data.session;
      setSession(s);
      setUser(s ? s.user : null);
      setLoading(false);
    });

    var sub = supabase.auth.onAuthStateChange(function (event, s) {
      setSession(s);
      setUser(s ? s.user : null);
      if (s) {
        flushQueue(supabase, s.user.id).catch(function () {});
      }
    });
    return function () {
      sub.data && sub.data.subscription && sub.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(function () {
    function onOnline() {
      if (user) flushQueue(supabase, user.id).catch(function () {});
    }
    window.addEventListener('online', onOnline);
    return function () { window.removeEventListener('online', onOnline); };
  }, [user]);

  var signInWithGoogle = useCallback(async function () {
    var { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  var signInWithEmail = useCallback(async function (email, password) {
    var { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  var signUpWithEmail = useCallback(async function (email, password) {
    var { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }, []);

  var signOut = useCallback(async function () {
    // ── SECURITY: wipe local data so the next user can't see it ──
    try { localStorage.removeItem('et-v2'); } catch (e) {}
    try { localStorage.removeItem('et-offline-queue'); } catch (e) {}
    // Clear the session-unlock flag so PIN is required again
    try { sessionStorage.removeItem('et-pin-unlocked'); } catch (e) {}
    // Reset skip-auth so the login screen shows again
    localStorage.removeItem('et-skip-auth');
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthCtx.Provider value={{
      session, user, loading,
      signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  var ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
