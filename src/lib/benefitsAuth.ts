/**
 * Separate credentials for the PhilHealth Benefits Programs system.
 * Does not share session with the main flow guide auth.
 */

export type BenefitsRole = 'admin' | 'staff'

export type BenefitsUser = {
  email: string
  role: BenefitsRole
  siteCode: string
  siteName: string
}

const SESSION_KEY = 'gcare-benefits-auth-v1'
const ADMIN_PW_KEY = 'gcare-benefits-admin-pw-v1'

export const BENEFITS_STAFF_PASSWORD = 'benefitsStaff2026'
export const BENEFITS_ADMIN_PASSWORD = 'benefitsAdmin2026'

const SITES: Record<string, string> = {
  gcmcc: 'Global Care Canlubang',
  gcmcl: 'Global Care Cabuyao',
  gcmct: 'Global Care Talisay',
  gcmcb: 'Global Care Bay',
  gcci: 'Global Care Cancer Institute',
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function parseBenefitsEmail(email: string): { role: BenefitsRole; siteCode: string } | null {
  const e = normalizeEmail(email)
  const m = e.match(/^(benefitsstaff|benefitsadmin)@([a-z0-9]+)\.com$/)
  if (!m) return null
  const role: BenefitsRole = m[1] === 'benefitsadmin' ? 'admin' : 'staff'
  const siteCode = m[2]
  if (!SITES[siteCode]) return null
  return { role, siteCode }
}

function readAdminPassword(siteCode: string): string {
  try {
    const raw = localStorage.getItem(`${ADMIN_PW_KEY}-${siteCode}`)
    if (raw && raw.length >= 8) return raw
  } catch {
    /* ignore */
  }
  return BENEFITS_ADMIN_PASSWORD
}

export function loginBenefits(email: string, password: string): BenefitsUser | null {
  const parsed = parseBenefitsEmail(email)
  if (!parsed) return null
  const e = normalizeEmail(email)
  const { role, siteCode } = parsed

  if (role === 'admin') {
    if (password !== readAdminPassword(siteCode)) return null
  } else {
    if (password !== BENEFITS_STAFF_PASSWORD) return null
  }

  const user: BenefitsUser = {
    email: e,
    role,
    siteCode,
    siteName: SITES[siteCode] || siteCode,
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
  return user
}

export function getBenefitsSession(): BenefitsUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as BenefitsUser
    if (u?.email && (u.role === 'admin' || u.role === 'staff') && u.siteCode) return u
  } catch {
    /* ignore */
  }
  return null
}

export function logoutBenefits(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** True if email looks like a benefits-system account */
export function isBenefitsEmail(email: string): boolean {
  return /^benefits(staff|admin)@[a-z0-9]+\.com$/i.test(email.trim())
}
