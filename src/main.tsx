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
    <div className="dash-login-root">
      <form className="dash-login-card auth-login-card" onSubmit={submit}>
        <img
          src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
          alt="Global Care"
          width={48}
          height={48}
        />
        <h1>GCare PhilHealth</h1>
        <p>Sign in to continue</p>

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
          placeholder="you@email.com"
          autoFocus
          required
        />

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
            placeholder="Enter password"
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

        {error && <div className="dash-login-error">{error}</div>}

        <button type="submit" className="dash-btn-primary">
          Sign in
        </button>

        <p className="auth-hint">
          Staff → Pathways guide · Admin → Dashboard
        </p>
      </form>
    </div>
  )
}

function Root() {
  const [user, setUser] = useState<AuthUser | null>(() => getSession())

  useEffect(() => {
    if (!user) return
    // Route by role
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
      <Dashboard onLogout={handleLogout} adminEmail={user.email} />
    )
  }

  return <App onLogout={handleLogout} staffEmail={user.email} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
