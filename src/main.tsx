import { StrictMode, useEffect, useState, FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Dashboard from './Dashboard'
import './index.css'

const DASH_PASSWORD = 'GCMCC-2026-PBUP'
const AUTH_KEY = 'gcare-dash-auth'

function isDashAuthed(): boolean {
  try {
    return sessionStorage.getItem(AUTH_KEY) === '1'
  } catch {
    return false
  }
}

function setDashAuthed() {
  try {
    sessionStorage.setItem(AUTH_KEY, '1')
  } catch {
    /* ignore */
  }
}

function clearDashAuthed() {
  try {
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}

function DashLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password === DASH_PASSWORD) {
      setDashAuthed()
      setError(null)
      onSuccess()
    } else {
      setError('Incorrect password. Please try again.')
    }
  }

  return (
    <div className="dash-login-root">
      <form className="dash-login-card" onSubmit={submit}>
        <img
          src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
          alt="Global Care"
          width={48}
          height={48}
        />
        <h1>Flow Monitor Dashboard</h1>
        <p>Enter the access password to continue.</p>
        <label htmlFor="dash-pass">Password</label>
        <input
          id="dash-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
          placeholder="Enter password"
          autoFocus
        />
        {error && <div className="dash-login-error">{error}</div>}
        <button type="submit" className="dash-btn-primary">
          Unlock Dashboard
        </button>
        <a href="#/" className="dash-login-back">
          ← Back to Guide App
        </a>
      </form>
    </div>
  )
}

function Root() {
  const [view, setView] = useState<'app' | 'monitor'>(() =>
    window.location.hash.replace(/^#\/?/, '') === 'monitor' ? 'monitor' : 'app',
  )
  const [authed, setAuthed] = useState(() => isDashAuthed())

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace(/^#\/?/, '')
      setView(h === 'monitor' ? 'monitor' : 'app')
      if (h === 'monitor') {
        setAuthed(isDashAuthed())
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (view === 'monitor') {
    if (!authed) {
      return <DashLogin onSuccess={() => setAuthed(true)} />
    }
    return (
      <Dashboard
        onLogout={() => {
          clearDashAuthed()
          setAuthed(false)
          window.location.hash = '#/'
        }}
      />
    )
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
