import { StrictMode, useEffect, useState, FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import BenefitsApp from './BenefitsApp'
import BenefitsDashboard from './BenefitsDashboard'
import {
  loginBenefits,
  logoutBenefits,
  restoreBenefitsSession,
  onBenefitsSignedOut,
  type BenefitsUser,
} from './lib/benefitsAuth'
import { ACTIVE_BRANCH, BRANCHES, BRANCH_NAME, branchPath } from './lib/branchConfig'
import './index.css'

/**
 * Benefits Programs only. Sign-in is verified by Supabase Auth; the role and branch come
 * from the server (benefits_profiles), never from the URL or browser storage.
 * (The old flow-guide App / Dashboard / lib/auth.ts are no longer loaded.)
 */

function LoginScreen({ onLogin }: { onLogin: (u: BenefitsUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const res = await loginBenefits(email, password)
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onLogin(res.user)
  }

  const hero = ACTIVE_BRANCH?.heroImage
  return (
    <div className="lg-split">
      <section className="lg-form-side">
        {hero && (
          <div className="lg-banner" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}${hero}`} alt="" onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')} />
          </div>
        )}
        <form className="lg-form" onSubmit={(e) => void submit(e)}>
          <div className="lg-brand">
            <img
              src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
              alt=""
              width={40}
              height={40}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <span>GCare Benefits</span>
          </div>
          <h1 className="lg-title">Welcome back</h1>
          <p className="lg-sub">Sign in to manage PhilHealth Benefits Programs.</p>

          <div className="lg-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
              placeholder="you@branch.com"
              autoFocus
              required
            />
          </div>

          <div className="lg-field">
            <label htmlFor="auth-pass">Password</label>
            <div className="lg-pass">
              <input
                id="auth-pass"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                placeholder="Enter your password"
                required
              />
              <button type="button" onClick={() => setShowPass((v) => !v)} tabIndex={-1}>
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && <div className="lg-error" role="alert">{error}</div>}

          <button type="submit" className="lg-submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="lg-note">Accounts are created by your branch admin.</p>
        </form>
      </section>

      <aside className="lg-hero" aria-hidden="true">
        {hero && (
          <img src={`${import.meta.env.BASE_URL}${hero}`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
        )}
        <div className="lg-hero-text">
          <strong>GCare PhilHealth Benefits Programs</strong>
          <span>{BRANCH_NAME} · Guide patients through every benefits program, step by step.</span>
        </div>
      </aside>
    </div>
  )
}

/** Shown at the bare address (or an unknown one): choose which branch to open. */
function BranchPicker() {
  return (
    <div className="auth-shell">
      <div className="auth-shell-bg" aria-hidden="true" />
      <div className="auth-card">
        <div className="auth-card-logo">
          <img
            src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
            alt="Global Care"
            width={52}
            height={52}
          />
        </div>
        <h1 className="auth-card-title">Select your branch</h1>
        <p className="auth-card-sub">GCare PhilHealth Benefits Programs</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          {BRANCHES.map((b) => (
            <a key={b.code} className="auth-submit" href={branchPath(b)} style={{ textAlign: 'center', textDecoration: 'none' }}>
              {b.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function hashFor(user: BenefitsUser): string {
  return user.role === 'admin' ? 'benefits-monitor' : 'benefits'
}

function Root() {
  const [session, setSession] = useState<BenefitsUser | null>(null)
  const [booting, setBooting] = useState(true)

  // Restore a valid login after refresh, and react when the login expires / is revoked.
  useEffect(() => {
    let alive = true
    void restoreBenefitsSession().then((u) => {
      if (!alive) return
      setSession(u)
      setBooting(false)
    })
    const off = onBenefitsSignedOut(() => {
      if (alive) setSession(null)
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  // The URL hash is cosmetic only — what you can see is decided by your server-side role.
  useEffect(() => {
    if (!session) return
    const want = hashFor(session)
    const fix = () => {
      if (window.location.hash.replace(/^#\/?/, '') !== want) {
        window.location.hash = `#${want}`
      }
    }
    fix()
    window.addEventListener('hashchange', fix)
    return () => window.removeEventListener('hashchange', fix)
  }, [session])

  const handleLogout = () => {
    void logoutBenefits().then(() => {
      setSession(null)
      window.location.hash = '#/'
    })
  }

  if (booting) {
    return (
      <div className="auth-shell">
        <div className="auth-shell-bg" aria-hidden="true" />
        <div className="auth-card" role="status">
          <p className="auth-card-sub">Loading…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onLogin={(u) => setSession(u)} />
  }

  if (session.role === 'admin') {
    return (
      <BenefitsDashboard
        onLogout={handleLogout}
        adminEmail={session.email}
        siteCode={session.siteCode}
        siteName={session.siteName}
      />
    )
  }
  return (
    <BenefitsApp
      onLogout={handleLogout}
      staffEmail={session.email}
      siteCode={session.siteCode}
      siteName={session.siteName}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {ACTIVE_BRANCH ? <Root /> : <BranchPicker />}
  </StrictMode>,
)
