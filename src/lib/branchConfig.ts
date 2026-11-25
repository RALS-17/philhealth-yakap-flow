/**
 * ONE app, MANY branches — each branch has its OWN Supabase project (its own account).
 *
 * The branch is chosen by the web address:
 *     https://your-site.com/cabuyao    -> Global Care Cabuyao   (its own Supabase)
 *     https://your-site.com/canlubang  -> Global Care Canlubang (its own Supabase)
 *
 * Each branch's Supabase URL + anon (public) key come from the .env file
 * (see .env.example). NEVER put a service_role key anywhere in this app.
 *
 * To ADD a branch later: add one entry to BRANCHES below + its two values in .env.
 * To make a branch's PROCESS different: use `features` (see hasFeature) — the code is
 * shared, only the settings differ.
 */

export type BranchDef = {
  /** Branch code — must match site_code in that branch's database. */
  code: string
  /** The address segment: /cabuyao */
  slug: string
  name: string
  /** Login-page photo, a file in /public (optional; a plain blue panel shows without it). */
  heroImage?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  /** Per-branch switches for processes that only some branches have. */
  features: Record<string, boolean>
}

/** The order here is the order shown on the home page. */
export const BRANCHES: BranchDef[] = [
  {
    code: 'gcmcc',
    slug: 'canlubang',
    name: 'Global Care Canlubang',
    heroImage: 'login-canlubang.jpg',
    supabaseUrl: import.meta.env.VITE_GCMCC_SUPABASE_URL as string | undefined,
    supabaseAnonKey: import.meta.env.VITE_GCMCC_SUPABASE_ANON_KEY as string | undefined,
    features: {},
  },
  {
    code: 'gcmcl',
    slug: 'cabuyao',
    name: 'Global Care Cabuyao',
    heroImage: 'login-cabuyao.jpg',
    supabaseUrl: import.meta.env.VITE_GCMCL_SUPABASE_URL as string | undefined,
    supabaseAnonKey: import.meta.env.VITE_GCMCL_SUPABASE_ANON_KEY as string | undefined,
    features: {},
  },
  // Later: gcmct (talisay), gcmcb (bay), gcci (cancer-institute)
]

/** Branches shown on the home page as "Coming soon" until they are added above. */
export const COMING_SOON_BRANCHES: { code: string; name: string; heroImage?: string }[] = [
  { code: 'gcmct', name: 'Global Care Talisay', heroImage: 'login-talisay.jpg' },
  { code: 'gcmcb', name: 'Global Care Bay', heroImage: 'login-bay.jpg' },
  { code: 'gcci', name: 'Global Care Cancer Institute', heroImage: 'login-cancer-institute.jpg' },
]

/** Path of the site inside the host (Vite "base"), without a trailing slash. */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

/** Address of a branch's login page. */
export const branchPath = (b: BranchDef): string => `${BASE}/${b.slug}`

function branchFromUrl(): BranchDef | null {
  if (typeof window === 'undefined') return null
  let path = window.location.pathname
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length)
  const first = path.split('/').filter(Boolean)[0]?.toLowerCase()
  if (!first) return null
  return BRANCHES.find((b) => b.slug === first || b.code === first) ?? null
}

/** The branch chosen by the address, or null (then the branch picker is shown). */
export const ACTIVE_BRANCH: BranchDef | null = branchFromUrl()

export const BRANCH_CODE: string = ACTIVE_BRANCH?.code ?? ''
export const BRANCH_NAME: string = ACTIVE_BRANCH?.name ?? ''

/** True when this branch has the named process/feature switched on. */
export const hasFeature = (name: string): boolean => ACTIVE_BRANCH?.features[name] === true
