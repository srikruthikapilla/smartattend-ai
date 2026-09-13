import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawUrl && rawUrl.startsWith('http') ? rawUrl : '';
const supabaseAnonKey = rawKey && rawKey.length > 10 ? rawKey : '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase Config] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.');
}

// Use environment values or safe placeholder to avoid module loading crashes
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export default supabase;
