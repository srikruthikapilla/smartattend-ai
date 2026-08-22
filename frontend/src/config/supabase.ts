import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawUrl && rawUrl.startsWith('http') 
  ? rawUrl 
  : 'https://[REDACTED_PROJECT_REF].supabase.co';

const supabaseAnonKey = rawKey && rawKey.length > 10 
  ? rawKey 
  : '[REDACTED_SUPABASE_TOKEN]';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
