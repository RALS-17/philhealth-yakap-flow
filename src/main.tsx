import { StrictMode, useEffect, useState, FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Dashboard from './Dashboard'
import {
  login,
  logout,
  getSession,
  type AuthUser,
} from './lib/auth'
import './index.css'

function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const user = login(email, password)
    if (!user) {
      setError('Incorrect email or password.')
      return
    }
    setError(null)
    onLogin(user)
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
        <p className="auth-card-sub">Sign in to GCare PhilHealth Benefits</p>

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

        <p className="auth-footer-hint">Staff opens pathways · Admin opens dashboard</p>
      </form>
    </div>
  )
}

function Root() {
  const [user, setUser] = useState<AuthUser | null>(() => getSession())

  useEffect(() => {
    if (!user) return
    if (user.role === 'admin') {
      if (window.location.hash.replace(/^#\/?/, '') !== 'monitor') {
        window.location.hash = '#monitor'
      }
    } else {
      if (window.location.hash.replace(/^#\/?/, '') === 'monitor') {
        window.location.hash = '#/'
      }
    }
  }, [user])

  const handleLogout = () => {
    logout()
    setUser(null)
    window.location.hash = '#/'
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={(u) => {
          setUser(u)
          window.location.hash = u.role === 'admin' ? '#monitor' : '#/'
        }}
      />
    )
  }

  if (user.role === 'admin') {
    return (
      <Dashboard
        onLogout={handleLogout}
        adminEmail={user.email}
        siteCode={user.siteCode}
        siteName={user.siteName}
        siteLocation={user.siteLocation}
      />
    )
  }

  return (
    <App
      onLogout={handleLogout}
      staffEmail={user.email}
      siteCode={user.siteCode}
      siteName={user.siteName}
      siteLocation={user.siteLocation}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
