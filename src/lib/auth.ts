/**
 * Simple client-side role auth for guide vs dashboard.
 * Admin password can be changed and is stored in localStorage.
 * Not a substitute for full server auth — suitable for internal workstation use.
 */

export type AuthRole = 'admin' | 'staff'

export type AuthUser = {
  email: string
  role: AuthRole
}

const AUTH_SESSION_KEY = 'gcare-auth-session'
const ADMIN_CREDS_KEY = 'gcare-admin-creds'

/** Default admin (changeable) */
export const DEFAULT_ADMIN_EMAIL = 'userAdmin@gmail.com'
export const DEFAULT_ADMIN_PASSWORD = 'userAdmin2026'

/** Default staff / pathway user */
export const DEFAULT_STAFF_EMAIL = 'userStaff@gmail.com'
export const DEFAULT_STAFF_PASSWORD = 'userStaff2026'

type StoredAdminCreds = {
  email: string
  password: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function readAdminCreds(): StoredAdminCreds {
  try {
    const raw = localStorage.getItem(ADMIN_CREDS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredAdminCreds>
      if (parsed.email && parsed.password) {
        return {
          email: normalizeEmail(parsed.email),
          password: String(parsed.password),
        }
      }
    }
  } catch {
    /* use defaults */
  }
  return {
    email: normalizeEmail(DEFAULT_ADMIN_EMAIL),
    password: DEFAULT_ADMIN_PASSWORD,
  }
}

export function getAdminEmail(): string {
  return readAdminCreds().email
}

export function login(email: string, password: string): AuthUser | null {
  const e = normalizeEmail(email)
  const p = password

  const admin = readAdminCreds()
  if (e === admin.email && p === admin.password) {
    const user: AuthUser = { email: admin.email, role: 'admin' }
    persistSession(user)
    return user
  }

  if (e === normalizeEmail(DEFAULT_STAFF_EMAIL) && p === DEFAULT_STAFF_PASSWORD) {
    const user: AuthUser = { email: normalizeEmail(DEFAULT_STAFF_EMAIL), role: 'staff' }
    persistSession(user)
    return user
  }

  return null
}

function persistSession(user: AuthUser) {
  try {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

export function getSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (parsed?.email && (parsed.role === 'admin' || parsed.role === 'staff')) {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

export function logout(): void {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Change admin password. Requires current password.
 * Optionally update admin email (stays same role).
 */
export function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
  newEmail?: string,
): { ok: true } | { ok: false; error: string } {
  const admin = readAdminCreds()
  if (currentPassword !== admin.password) {
    return { ok: false, error: 'Current password is incorrect.' }
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' }
  }
  const next: StoredAdminCreds = {
    email: newEmail ? normalizeEmail(newEmail) : admin.email,
    password: newPassword,
  }
  try {
    localStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify(next))
  } catch {
    return { ok: false, error: 'Could not save new password on this device.' }
  }
  // Refresh session email if admin is logged in
  const session = getSession()
  if (session?.role === 'admin') {
    persistSession({ email: next.email, role: 'admin' })
  }
  return { ok: true }
}
