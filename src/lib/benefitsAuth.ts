/**
 * Real authentication for the PhilHealth Benefits Programs system (Supabase Auth).
 *
 * - Email + password are verified by Supabase — no passwords exist in this bundle.
 * - The user's role and branch come from the `benefits_profiles` table, which the app
 *   cannot write to. Row-Level Security then limits every query to that branch.
 */

import { supabase } from './supabase'
import { clearBenefitsLocalCache, flushQueue } from './benefitsStore'
import { BRANCH_CODE, BRANCH_NAME } from './branchConfig'

export type BenefitsRole = 'admin' | 'staff'

export type BenefitsUser = {
  email: string
  role: BenefitsRole
  siteCode: string
  siteName: string
}

export const BENEFITS_SITES: Record<string, string> = {
  [BRANCH_CODE]: BRANCH_NAME,
}

export type LoginResult = { ok: true; user: BenefitsUser } | { ok: false; error: string }

async function loadProfile(userId: string, email: string): Promise<BenefitsUser | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('benefits_profiles')
    .select('role, site_code')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  const role = (data as { role: string }).role
  const siteCode = String((data as { site_code: string }).site_code || '').toLowerCase()
  // This copy only serves its own branch: an account for any other branch is refused.
  if ((role !== 'admin' && role !== 'staff') || siteCode !== BRANCH_CODE) return null
  return { email, role, siteCode, siteName: BENEFITS_SITES[siteCode] }
}

export async function loginBenefits(email: string, password: string): Promise<LoginResult> {
  if (!supabase) {
    return {
      ok: false,
      error: 'Server connection is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
    }
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error || !data.user) {
      const msg = error?.message || ''
      if (/fetch|network/i.test(msg)) {
        return { ok: false, error: 'Cannot reach the server. Check your internet connection.' }
      }
      return { ok: false, error: 'Incorrect email or password.' }
    }
    const user = await loadProfile(data.user.id, data.user.email ?? email.trim().toLowerCase())
    if (!user) {
      await supabase.auth.signOut()
      return {
        ok: false,
        error: `This account is not set up for ${BRANCH_NAME}. Please contact your administrator.`,
      }
    }
    void flushQueue()
    return { ok: true, user }
  } catch {
    return { ok: false, error: 'Cannot reach the server. Check your internet connection.' }
  }
}

/** Restores a still-valid login (e.g. after a page refresh). */
export async function restoreBenefitsSession(): Promise<BenefitsUser | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    const u = data.session?.user
    if (!u) return null
    return await loadProfile(u.id, u.email ?? '')
  } catch {
    return null
  }
}

/** Calls back when the login ends (logout, or the refresh token is no longer valid). */
export function onBenefitsSignedOut(cb: () => void): () => void {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') cb()
  })
  return () => data.subscription.unsubscribe()
}

export async function logoutBenefits(): Promise<void> {
  // Give unsynced work a short chance to upload before the login is removed.
  try {
    await Promise.race([flushQueue(), new Promise((r) => setTimeout(r, 4000))])
  } catch {
    /* ignore */
  }
  clearBenefitsLocalCache()
  try {
    await supabase?.auth.signOut()
  } catch {
    /* ignore */
  }
}
