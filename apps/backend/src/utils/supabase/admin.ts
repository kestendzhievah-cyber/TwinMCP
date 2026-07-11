import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

/**
 * Service-role Supabase client for privileged, server-only operations — e.g.
 * fully deleting a user's auth identity (email / password / OAuth links) for
 * GDPR right-to-erasure. This bypasses RLS and must NEVER reach the browser.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not configured, so callers can
 * degrade gracefully (log + alert) instead of crashing or silently claiming a
 * deletion that didn't happen.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  _admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
