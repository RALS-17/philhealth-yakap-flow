import { StrictMode, useEffect, useRef, useState, FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import BenefitsApp from './BenefitsApp'
import BenefitsDashboard from './BenefitsDashboard'
import { AppSkeleton } from './Skeletons'
import { clearAllViewState, readRole, rememberRole } from './lib/viewState'
import {
  loginBenefits,
  logoutBenefits,
  restoreBenefitsSession,
  onBenefitsSignedOut,
  type BenefitsUser,
} from './lib/benefitsAuth'
import { ACTIVE_BRANCH, BRANCHES, BRANCH_NAME, COMING_SOON_BRANCHES, branchPath } from './lib/branchConfig'
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

/**
 * Data privacy notice on the home page. The wording is kept here so the hospital's
 * Data Privacy Officer can review and change it in one place.
 */
const PRIVACY_NOTICE = {
  title: 'Your patients’ data stays in your branch',
  lead:
    'Each Global Care branch works in its own separate workspace with its own database. Patient information entered by a branch is stored in that branch’s database and is available only to that branch’s authorized staff and administrators.',
  points: [
    { h: 'Separate by branch', p: 'One branch cannot open another branch’s records.' },
    { h: 'Authorized access only', p: 'Everyone signs in with a personal account created by their branch administrator.' },
    { h: 'Activity is recorded', p: 'The system keeps a log of who completed, renamed or deleted an entry.' },
  ],
  note: 'For questions about how personal data is handled, please contact your branch’s Data Privacy Officer.',
}

/** Hospital photos, fading from one to the next (inside the hero frame). */
function HeroSlides() {
  const base = import.meta.env.BASE_URL
  const [failed, setFailed] = useState<string[]>([])
  const slides = [...BRANCHES, ...COMING_SOON_BRANCHES].filter((b) => b.heroImage && !failed.includes(b.code))
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const idx = slides.length ? i % slides.length : 0

  useEffect(() => {
    if (paused || slides.length < 2) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setI((n) => n + 1), 5500)
    return () => window.clearInterval(t)
  }, [paused, slides.length])

  if (!slides.length) return <div className="lp-slides lp-slides-empty" aria-hidden="true" />
  const cur = slides[idx]
  const { org, place } = splitName(cur.name)
  return (
    <div className="lp-slides" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((b, n) => (
        <img
          key={b.code}
          className={`lp-slide${n === idx ? ' on' : ''}`}
          src={`${base}${b.heroImage}`}
          alt={n === idx ? b.name : ''}
          aria-hidden={n === idx ? undefined : true}
          onError={() => setFailed((f) => [...f, b.code])}
        />
      ))}
      <div className="lp-slide-ui">
        <div className="lp-slide-name" key={cur.code}>
          <small>{org}</small>
          <strong>{place}</strong>
        </div>
        {slides.length > 1 && (
          <div className="lp-dots" role="tablist" aria-label="Hospital photos">
            {slides.map((b, n) => (
              <button
                key={b.code}
                type="button"
                role="tab"
                aria-selected={n === idx}
                aria-label={b.name}
                className={n === idx ? 'on' : ''}
                onClick={() => setI(n)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** "Global Care Canlubang" -> { org: "Global Care", place: "Canlubang" } */
function splitName(name: string) {
  const m = name.match(/^(Global Care)\s+(.+)$/i)
  return m ? { org: m[1], place: m[2] } : { org: 'Global Care', place: name }
}

/** Shown at the bare address (or an unknown one): choose which branch to open. */
function BranchPicker() {
  const base = import.meta.env.BASE_URL
  const hideOnError = (e: { currentTarget: HTMLImageElement }) => (e.currentTarget.style.display = 'none')
  const year = new Date().getFullYear()
  const liveCount = BRANCHES.length
  const soonCount = COMING_SOON_BRANCHES.length

  const rootRef = useRef<HTMLDivElement>(null)

  // Scroll animations: reveal parts as they enter, a progress bar, a nav shadow and a light parallax.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const els = Array.from(root.querySelectorAll<HTMLElement>('.lp-reveal'))
    const show = (el: Element) => el.classList.add('in')
    let io: IntersectionObserver | null = null
    if (!('IntersectionObserver' in window) || reduce) {
      els.forEach(show)
    } else {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (en.isIntersecting) {
              show(en.target)
              io?.unobserve(en.target)
            }
          }),
        { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
      )
      els.forEach((el) => io!.observe(el))
    }

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
        root.style.setProperty('--sp', String(Math.min(1, y / max)))
        if (!reduce) root.style.setProperty('--sy', String(Math.min(y, 900)))
        root.classList.toggle('lp-scrolled', y > 8)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io?.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="lp" ref={rootRef}>
      <div className="lp-progress" aria-hidden="true" />
      <header className="lp-nav">
        <a className="lp-nav-brand" href="#top">
          <img src={`${base}global-care-logo.svg`} alt="" width={34} height={34} onError={hideOnError} />
          <span>GCare <b>Benefits</b></span>
        </a>
        <nav className="lp-nav-links" aria-label="Sections">
          <a href="#about">Features</a>
        </nav>
      </header>

      <section className="lp-hero" id="top">
        <svg className="lp-ecg" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
          <path
            pathLength="1"
            d="M0 70 H300 L322 70 L338 28 L358 108 L376 46 L388 70 H640 L660 70 L676 36 L694 100 L710 52 L720 70 H1200"
            fill="none"
          />
        </svg>
        <div className="lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-pill">
              <i className="lp-live" aria-hidden="true" />
              Live in {liveCount} branches · {soonCount} more coming
            </span>
            <h1>
              Every PhilHealth benefit,
              <span className="lp-grad"> guided step by step.</span>
            </h1>
            <p>
              Help each patient reach the right benefit with confidence, and give your administrators a
              clear picture of how every branch is doing.
            </p>
            <div className="lp-hero-actions">
              <a className="lp-btn lp-btn-primary" href="#branches">
                Choose your branch
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
              <a className="lp-btn lp-btn-ghost" href="#about">See what's inside</a>
            </div>
            <ul className="lp-trust">
              <li>Pause &amp; resume any patient</li>
              <li>Live dashboard</li>
              <li>Full activity log</li>
            </ul>
          </div>

          <div className="lp-hero-visual">
            <div className="lp-frame">
              <HeroSlides />
            </div>
            <div className="lp-float lp-float-a" aria-hidden="true">
              <span className="lp-float-ico">✓</span>
              <div><strong>Guided steps</strong><small>From start to finish</small></div>
            </div>
            <div className="lp-float lp-float-b" aria-hidden="true">
              <span className="lp-float-ico lp-float-ico-teal">♥</span>
              <div><strong>Right Benefit</strong><small>Right Patient · Right Time</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section" id="branches">
        <div className="lp-section-head lp-reveal">
          <span className="lp-kicker">Branches</span>
          <h2>Select your branch</h2>
          <p>Each branch has its own secure workspace and sign-in.</p>
        </div>
        <div className="lp-grid">
          {BRANCHES.map((b, n) => {
            const { org, place } = splitName(b.name)
            return (
              <a
                key={b.code}
                className="lp-card lp-reveal lp-zoom"
                href={branchPath(b)}
                style={{ transitionDelay: `${n * 80}ms` }}
              >
                <div className="lp-card-media">
                  {b.heroImage && <img src={`${base}${b.heroImage}`} alt="" loading="lazy" onError={hideOnError} />}
                  <span className="lp-card-initial" aria-hidden="true">GC</span>
                </div>
                <div className="lp-card-body">
                  <div className="lp-card-title">
                    <span className="lp-card-org">{org}</span>
                    <strong className="lp-card-place">{place}</strong>
                  </div>
                  <span className="lp-card-go">
                    Open workspace
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </div>
              </a>
            )
          })}
          {COMING_SOON_BRANCHES.map((b, n) => {
            const { org, place } = splitName(b.name)
            return (
              <div
                key={b.code}
                className="lp-card lp-card-soon lp-reveal lp-zoom"
                aria-disabled="true"
                style={{ transitionDelay: `${(n + BRANCHES.length) * 80}ms` }}
              >
                <div className="lp-card-media" aria-hidden="true">
                  {b.heroImage && <img src={`${base}${b.heroImage}`} alt="" loading="lazy" onError={hideOnError} />}
                  <span className="lp-card-initial">GC</span>
                </div>
                <div className="lp-card-body">
                  <div className="lp-card-title">
                    <span className="lp-card-org">{org}</span>
                    <strong className="lp-card-place">{place}</strong>
                  </div>
                  <span className="lp-soon-badge">Coming soon</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="lp-section lp-about" id="about">
        <div className="lp-section-head lp-reveal">
          <span className="lp-kicker">Features</span>
          <h2>Built for the front desk and the office</h2>
          <p>Everything staff and administrators need, in one calm workspace.</p>
        </div>
        <div className="lp-bento">
          <article className="lp-tile lp-tile-wide lp-reveal lp-from-left">
            <div className="lp-tile-text">
              <span className="lp-tile-tag">For administrators</span>
              <h3>A live dashboard that compares</h3>
              <p>Daily census with the previous period, timing, cancellations and insights, filtered by any date range.</p>
            </div>
            <svg className="lp-mini-chart" viewBox="0 0 320 110" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="lpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1d4ed8" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#1d4ed8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 80 C30 60 50 30 80 44 S130 88 160 52 S215 14 245 40 S300 70 320 56 V110 H0 Z" fill="url(#lpFill)" />
              <path className="lp-mc-prev" d="M0 90 C30 78 55 62 85 70 S135 92 165 74 S220 50 250 62 S300 84 320 72" fill="none" />
              <path className="lp-mc-line" pathLength="1" d="M0 80 C30 60 50 30 80 44 S130 88 160 52 S215 14 245 40 S300 70 320 56" fill="none" />
            </svg>
          </article>

          <article className="lp-tile lp-tile-tall lp-reveal lp-from-right">
            <span className="lp-tile-tag">For staff</span>
            <h3>Guided steps</h3>
            <p>Follow each program to the end, and pause or resume any patient.</p>
            <ol className="lp-steps">
              <li className="done"><i>✓</i>Step 1</li>
              <li className="done"><i>✓</i>Step 2</li>
              <li className="done"><i>✓</i>Step 3</li>
              <li className="now"><i>4</i>Step 4</li>
              <li><i>5</i>Step 5</li>
            </ol>
            <div className="lp-prog">
              <span className="lp-prog-bar"><b style={{ width: '60%' }} /></span>
              <span className="lp-prog-txt">60% done</span>
            </div>
          </article>

          <article className="lp-tile lp-reveal lp-from-left" style={{ transitionDelay: '120ms' }}>
            <span className="lp-tile-tag">Accountability</span>
            <h3>Know who did what</h3>
            <ul className="lp-log">
              <li><span className="b b-green">Completed</span><i /></li>
              <li><span className="b b-blue">Renamed</span><i /></li>
              <li><span className="b b-red">Cancelled</span><i /></li>
            </ul>
          </article>

          <article className="lp-tile lp-reveal lp-zoom" style={{ transitionDelay: '220ms' }}>
            <span className="lp-tile-tag">Insights</span>
            <h3>Understand why</h3>
            <ul className="lp-bars">
              <li><span style={{ width: '86%' }} /></li>
              <li><span style={{ width: '58%' }} /></li>
              <li><span style={{ width: '34%' }} /></li>
            </ul>
          </article>
        </div>
      </section>

      <section className="lp-section lp-privacy" id="privacy">
        <div className="lp-privacy-card lp-reveal lp-zoom">
          <div className="lp-privacy-head">
            <span className="lp-privacy-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8.5 12.2l2.4 2.4 4.6-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div>
              <span className="lp-kicker">Data privacy</span>
              <h2>{PRIVACY_NOTICE.title}</h2>
            </div>
          </div>
          <p className="lp-privacy-lead">{PRIVACY_NOTICE.lead}</p>
          <ul className="lp-privacy-points">
            {PRIVACY_NOTICE.points.map((x) => (
              <li key={x.h}>
                <strong>{x.h}</strong>
                <span>{x.p}</span>
              </li>
            ))}
          </ul>
          <p className="lp-privacy-note">{PRIVACY_NOTICE.note}</p>
        </div>
      </section>

      <section className="lp-cta lp-reveal lp-zoom">
        <div>
          <h2>Ready to get started?</h2>
          <p>Pick your branch and sign in with your account.</p>
        </div>
        <a className="lp-btn lp-btn-primary" href="#branches">Choose your branch</a>
      </section>

      <footer className="lp-footer lp-reveal">
        <span>© {year} Global Care · GCare PhilHealth Benefits Programs</span>
        <span>
          <a className="lp-foot-link" href="#privacy">Data privacy</a> · We Care. We Guide. We Serve.
        </span>
      </footer>
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
      // "#benefits-monitor/insights" is fine: the part after the slash is the page the user is on.
      const h = window.location.hash.replace(/^#\/?/, '')
      if (h !== want && !h.startsWith(`${want}/`)) {
        window.location.hash = `#${want}`
      }
    }
    fix()
    window.addEventListener('hashchange', fix)
    return () => window.removeEventListener('hashchange', fix)
  }, [session])

  // Remember which kind of screen to show as a skeleton next time; forget everything when signed out.
  useEffect(() => {
    if (booting) return
    if (session) rememberRole(session.role === 'admin' ? 'admin' : 'staff')
    else clearAllViewState()
  }, [session, booting])

  const handleLogout = () => {
    clearAllViewState()
    void logoutBenefits().then(() => {
      setSession(null)
      window.location.hash = '#/'
    })
  }

  if (booting) {
    return <AppSkeleton kind={readRole()} />
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
