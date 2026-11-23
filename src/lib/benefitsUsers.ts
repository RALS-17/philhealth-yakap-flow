/**
 * Admin user management. Creating / deleting logins needs the Supabase service_role key,
 * which must never be in the website — so this talks to the `admin-users` Edge Function
 * (see supabase/functions/admin-users/index.ts) running in THIS branch's Supabase project.
 */
import { supabase } from './supabase'

export type BenefitsUser = {
  id: string
  email: string
  role: 'staff' | 'admin'
  created_at: string | null
  last_sign_in_at: string | null
  is_me: boolean
}

export const NOT_DEPLOYED_MSG =
  'User management is not set up in this branch\'s Supabase yet. Deploy the "admin-users" function (see ADMIN-USERS-SETUP.md).'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Not connected to Supabase.')
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context as Response | undefined
    if (ctx && typeof ctx.json === 'function') {
      let msg: string | undefined
      try {
        msg = ((await ctx.json()) as { error?: string })?.error
      } catch {
        /* not JSON */
      }
      if (msg) throw new Error(msg)
      if (ctx.status === 404) throw new Error(NOT_DEPLOYED_MSG)
      if (ctx.status === 401) throw new Error('Your login was rejected. If it keeps happening, turn OFF "Verify JWT" for the admin-users function (see ADMIN-USERS-SETUP.md).')
    }
    if (/Failed to send a request|fetch/i.test(error.message)) throw new Error(NOT_DEPLOYED_MSG)
    throw new Error(error.message)
  }
  const res = data as { ok?: boolean; error?: string } & T
  if (res?.error) throw new Error(res.error)
  return res
}

export async function listBenefitsUsers(): Promise<BenefitsUser[]> {
  return (await call<{ users: BenefitsUser[] }>({ action: 'list' })).users
}

export async function createBenefitsUser(email: string, role: 'staff' | 'admin', password: string) {
  return call<{ adopted: boolean }>({ action: 'create', email, role, password })
}

export async function resetBenefitsUserPassword(userId: string, password: string) {
  await call({ action: 'reset_password', user_id: userId, password })
}

export async function setBenefitsUserRole(userId: string, role: 'staff' | 'admin') {
  await call({ action: 'set_role', user_id: userId, role })
}

export async function removeBenefitsUser(userId: string) {
  await call({ action: 'remove', user_id: userId })
}

/** Easy-to-read random password (no look-alike characters), always mixed case + digits. */
export function generatePassword(length = 12): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digit = '23456789'
  const all = lower + upper + digit
  const pick = (set: string) => {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return set[buf[0] % set.length]
  }
  const chars = [pick(lower), pick(upper), pick(digit)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const j = buf[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
