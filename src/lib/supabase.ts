import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ACTIVE_BRANCH } from './branchConfig'

// Each branch talks ONLY to its own Supabase project (its own account).
const url = ACTIVE_BRANCH?.supabaseUrl
const anonKey = ACTIVE_BRANCH?.supabaseAnonKey

/**
 * Login tokens are kept in sessionStorage (not localStorage) so closing the tab/browser
 * logs the user out — safer on shared hospital computers.
 */
const authStorage =
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
    ? window.sessionStorage
    : undefined

/** Null when no branch is chosen or its env vars are missing — the app shows a configuration error on the login screen. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          ...(authStorage ? { storage: authStorage } : {}),
        },
      })
    : null

export const isSupabaseConfigured = (): boolean => Boolean(url && anonKey)
