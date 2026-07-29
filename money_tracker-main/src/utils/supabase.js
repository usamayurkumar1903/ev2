import { createClient } from '@supabase/supabase-js';

var url = import.meta.env.VITE_SUPABASE_URL;
var key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key || url === 'https://placeholder.supabase.co') {
  console.warn(
    '[Supabase] Missing env vars. Copy .env.example → .env.local and add your project credentials.\n' +
    'The app will run in offline-only mode until credentials are configured.'
  );
}

export var supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/** True when Supabase credentials look real (not placeholder). */
export var isSupabaseConfigured = !!(
  url &&
  key &&
  url !== 'https://placeholder.supabase.co' &&
  key !== 'placeholder-key'
);
