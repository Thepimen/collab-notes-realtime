import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Checks whether a real remote Supabase instance is configured via environment variables.
 */
export function isSupabaseConfigured(): boolean {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes('your-project-id.supabase.co') &&
    !SUPABASE_ANON_KEY.includes('your-supabase-anon-public-jwt-key')
  );
}

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Returns the singleton Supabase Client configured with persistent session,
 * automatic JWT refresh, and Elixir/Phoenix WebSocket Realtime events.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    const url = isSupabaseConfigured()
      ? SUPABASE_URL
      : 'https://placeholder-project.supabase.co';
    const key = isSupabaseConfigured()
      ? SUPABASE_ANON_KEY
      : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

    supabaseInstance = createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'collabnotes.supabase.auth.v1'
      },
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      }
    });
  }

  return supabaseInstance;
}
