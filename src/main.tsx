import { StrictMode, useEffect, useState, FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Dashboard from './Dashboard'
import BenefitsApp from './BenefitsApp'
import BenefitsDashboard from './BenefitsDashboard'
import {
  login,
  logout,
  getSession,
  type AuthUser,
} from './lib/auth'
import {
  loginBenefits,
  logoutBenefits,
  getBenefitsSession,
  isBenefitsEmail,
  type BenefitsUser,
} from './lib/benefitsAuth'
import './index.css'

type AnyUser =
  | { system: 'flow'; user: AuthUser }
  | { system: 'benefits'; user: BenefitsUser }

function LoginScreen({ onLogin }: { onLogin: (u: AnyUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (isBenefitsEmail(email)) {
      const user = loginBenefits(email, password)
      if (!user) {
        setError('Incorrect benefits email or password.')
        return
      }
      setError(null)
      onLogin({ system: 'benefits', user })
      return
    }
    const user = login(email, password)
    if (!user) {
      setError('Incorrect email or password.')
      return
    }
    setError(null)
    onLogin({ system: 'flow', user })
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell-bg" aria-hidden="true" />
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card-logo">
          <img
            src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
            alt="Global Care"
            width={52}
            height={52}
          />
        </div>
        <h1 className="auth-card-title">Welcome back</h1>
        <p className="auth-card-sub">Sign in to GCare PhilHealth systems</p>

        <div className="auth-field">
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

        <div className="auth-field">
          <label htmlFor="auth-pass">Password</label>
          <div className="auth-pass-wrap">
            <input
              id="auth-pass"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className="auth-show-pass"
              onClick={() => setShowPass((v) => !v)}
              tabIndex={-1}
            >
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-submit">
          Sign in
        </button>

      </form>
    </div>
  )
}

function Root() {
  const [session, setSession] = useState<AnyUser | null>(() => {
    const b = getBenefitsSession()
    if (b) return { system: 'benefits', user: b }
    const f = getSession()
    if (f) return { system: 'flow', user: f }
    return null
  })

  useEffect(() => {
    if (!session) return
    if (session.system === 'benefits') {
      const want = session.user.role === 'admin' ? 'benefits-monitor' : 'benefits'
      if (window.location.hash.replace(/^#\/?/, '') !== want) {
        window.location.hash = `#${want}`
      }
    } else if (session.user.role === 'admin') {
      if (window.location.hash.replace(/^#\/?/, '') !== 'monitor') {
        window.location.hash = '#monitor'
      }
    } else {
      const h = window.location.hash.replace(/^#\/?/, '')
      if (h === 'monitor' || h.startsWith('benefits')) {
        window.location.hash = '#/'
      }
    }
  }, [session])

  const handleLogout = () => {
    logout()
    logoutBenefits()
    setSession(null)
    window.location.hash = '#/'
  }

  if (!session) {
    return (
      <LoginScreen
        onLogin={(u) => {
          setSession(u)
          if (u.system === 'benefits') {
            window.location.hash = u.user.role === 'admin' ? '#benefits-monitor' : '#benefits'
          } else {
            window.location.hash = u.user.role === 'admin' ? '#monitor' : '#/'
          }
        }}
      />
    )
  }

  if (session.system === 'benefits') {
    if (session.user.role === 'admin') {
      return (
        <BenefitsDashboard
          onLogout={handleLogout}
          adminEmail={session.user.email}
          siteCode={session.user.siteCode}
          siteName={session.user.siteName}
        />
      )
    }
    return (
      <BenefitsApp
        onLogout={handleLogout}
        staffEmail={session.user.email}
        siteCode={session.user.siteCode}
        siteName={session.user.siteName}
      />
    )
  }

  if (session.user.role === 'admin') {
    return (
      <Dashboard
        onLogout={handleLogout}
        adminEmail={session.user.email}
        siteCode={session.user.siteCode}
        siteName={session.user.siteName}
        siteLocation={session.user.siteLocation}
      />
    )
  }

  return (
    <App
      onLogout={handleLogout}
      staffEmail={session.user.email}
      siteCode={session.user.siteCode}
      siteName={session.user.siteName}
      siteLocation={session.user.siteLocation}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
