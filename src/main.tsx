import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Dashboard from './Dashboard'
import './index.css'

function Root() {
  const [view, setView] = useState<'app' | 'monitor'>(() =>
    window.location.hash.replace(/^#\/?/, '') === 'monitor' ? 'monitor' : 'app',
  )

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace(/^#\/?/, '')
      setView(h === 'monitor' ? 'monitor' : 'app')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return view === 'monitor' ? <Dashboard /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
