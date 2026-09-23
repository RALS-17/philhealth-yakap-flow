/**
 * Multi-branch client-side auth for guide vs dashboard.
 * Each Global Care site has staff + admin accounts.
 * Admin password can be changed per branch (localStorage).
 */

export type AuthRole = 'admin' | 'staff'

/** Hospital site codes (email domain / acronym) */
export type SiteCode = 'gcmcc' | 'gcmcl' | 'gcmct' | 'gcmcb' | 'gcci'

export type BranchInfo = {
  code: SiteCode
  name: string
  /** Short line under GLOBAL CARE in the header */
  location: string
}

export const BRANCHES: BranchInfo[] = [
  { code: 'gcmcc', name: 'Global Care Canlubang', location: 'Canlubang' },
  { code: 'gcmcl', name: 'Global Care Cabuyao', location: 'Cabuyao' },
  { code: 'gcmct', name: 'Global Care Talisay', location: 'Talisay' },
  { code: 'gcmcb', name: 'Global Care Bay', location: 'Bay' },
  { code: 'gcci', name: 'Global Care Cancer Institute', location: 'Cancer Institute' },
]

export type AuthUser = {
  email: string
  role: AuthRole
  siteCode: SiteCode
  siteName: string
  siteLocation: string
}

const AUTH_SESSION_KEY = 'gcare-auth-session-v2'
const ADMIN_CREDS_PREFIX = 'gcare-admin-creds-'

export const DEFAULT_STAFF_PASSWORD = 'userStaff2026'
export const DEFAULT_ADMIN_PASSWORD = 'userAdmin2026'

type StoredAdminCreds = {
  email: string
  password: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function getBranchByCode(code: string): BranchInfo | null {
  const c = code.trim().toLowerCase() as SiteCode
  return BRANCHES.find((b) => b.code === c) ?? null
}

export function staffEmailFor(code: SiteCode): string {
  return `userstaff@${code}.com`
}

export function adminEmailFor(code: SiteCode): string {
  return `useradmin@${code}.com`
}

function adminCredsKey(code: SiteCode): string {
  return `${ADMIN_CREDS_PREFIX}${code}`
}

function readAdminCreds(code: SiteCode): StoredAdminCreds {
  try {
    const raw = localStorage.getItem(adminCredsKey(code))
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
    /* defaults */
  }
  return {
    email: adminEmailFor(code),
    password: DEFAULT_ADMIN_PASSWORD,
  }
}

/** Parse userStaff@gcmcc.com or userAdmin@gcmcc.com → branch */
function parseBranchEmail(email: string): { role: AuthRole; branch: BranchInfo } | null {
  const e = normalizeEmail(email)
  const m = e.match(/^(userstaff|useradmin)@([a-z0-9]+)\.com$/)
  if (!m) return null
  const role: AuthRole = m[1] === 'useradmin' ? 'admin' : 'staff'
  const branch = getBranchByCode(m[2])
  if (!branch) return null
  return { role, branch }
}

function toAuthUser(email: string, role: AuthRole, branch: BranchInfo): AuthUser {
  return {
    email: normalizeEmail(email),
    role,
    siteCode: branch.code,
    siteName: branch.name,
    siteLocation: branch.location,
  }
}

export function login(email: string, password: string): AuthUser | null {
  const parsed = parseBranchEmail(email)
  if (!parsed) return null

  const { role, branch } = parsed
  const e = normalizeEmail(email)

  if (role === 'admin') {
    const admin = readAdminCreds(branch.code)
    // Accept default admin email or changed email stored for this branch
    const emailOk = e === admin.email || e === adminEmailFor(branch.code)
    if (emailOk && password === admin.password) {
      const user = toAuthUser(admin.email.endsWith(`@${branch.code}.com`) ? admin.email : adminEmailFor(branch.code), 'admin', branch)
      persistSession(user)
      return user
    }
    return null
  }

  // Staff: fixed default password; email must be userstaff@{code}.com
  if (e === staffEmailFor(branch.code) && password === DEFAULT_STAFF_PASSWORD) {
    const user = toAuthUser(e, 'staff', branch)
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
    if (
      parsed?.email &&
      (parsed.role === 'admin' || parsed.role === 'staff') &&
      parsed.siteCode &&
      getBranchByCode(parsed.siteCode)
    ) {
      const branch = getBranchByCode(parsed.siteCode)!
      return {
        email: normalizeEmail(parsed.email),
        role: parsed.role,
        siteCode: branch.code,
        siteName: branch.name,
        siteLocation: branch.location,
      }
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
 * Change admin password for the logged-in admin's branch.
 * Requires current password.
 */
export function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
  siteCode?: SiteCode,
): { ok: true } | { ok: false; error: string } {
  const session = getSession()
  const code = siteCode ?? session?.siteCode
  if (!code) {
    return { ok: false, error: 'No branch context for password change.' }
  }
  const admin = readAdminCreds(code)
  if (currentPassword !== admin.password) {
    return { ok: false, error: 'Current password is incorrect.' }
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' }
  }
  const next: StoredAdminCreds = {
    email: adminEmailFor(code),
    password: newPassword,
  }
  try {
    localStorage.setItem(adminCredsKey(code), JSON.stringify(next))
  } catch {
    return { ok: false, error: 'Could not save new password on this device.' }
  }
  if (session?.role === 'admin' && session.siteCode === code) {
    persistSession(toAuthUser(next.email, 'admin', getBranchByCode(code)!))
  }
  return { ok: true }
}
