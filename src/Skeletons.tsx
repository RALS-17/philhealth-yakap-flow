import type { ReactNode } from 'react'
import type { RoleHint } from './lib/viewState'

/**
 * Skeleton ("grey placeholder") screens, shown while a page is loading.
 * They copy the real page's layout so nothing jumps when the data arrives.
 */

const logo = () => `${import.meta.env.BASE_URL}global-care-logo.svg`

export function BenefitsPageSkeleton({ page }: { page: string }) {
  return (
    <div className="dash-content dash-skeleton benefits-page-skeleton" role="status" aria-busy="true" aria-label={`Loading ${page === 'patients' ? 'patient list' : page}`}>
      {page !== 'patients' ? (
        <>
          <section className="dash-kpi-grid" aria-label="Loading key metrics">
            {Array.from({ length: 4 }, (_, i) => (
              <article className="dash-kpi sk-card" key={i}>
                <div className="dash-kpi-body sk-lines">
                  <span className="sk-line sk-line-sm" />
                  <span className="sk-line sk-line-lg" />
                  <span className="sk-line sk-line-md" />
                </div>
              </article>
            ))}
          </section>
          <section className="benefits-skeleton-panels" aria-label="Loading dashboard charts">
            {Array.from({ length: 4 }, (_, i) => (
              <div className="benefits-skeleton-panel" key={i}>
                <span className="sk-line sk-line-title" />
                <div className="sk-bars-row">
                  {[55, 85, 65, 95, 72].map((height, j) => (
                    <span className="sk-bar" style={{ height: `${height}%` }} key={j} />
                  ))}
                </div>
                <span className="sk-line sk-line-md" />
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="dash-patient-section benefits-skeleton-table" aria-label="Loading patient records">
          <div className="benefits-skeleton-table-head">
            {Array.from({ length: 5 }, (_, i) => <span className="sk-line sk-line-md" key={i} />)}
          </div>
          {Array.from({ length: 9 }, (_, i) => (
            <div className="sk-table-row" key={i}>
              {Array.from({ length: 5 }, (_, j) => <span className="sk-line" key={j} />)}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

/** Whole-app skeleton shown while the login is being checked after a refresh. */
export function AppSkeleton({ kind }: { kind: RoleHint | null }) {
  if (kind === 'admin') {
    return (
      <div className="dash-root dash-v2 sk-on" role="status" aria-busy="true" aria-label="Loading">
        <header className="dash-topbar">
          <div className="dash-brand">
            <img src={logo()} alt="" width={28} height={28} />
            <strong>GLOBAL CARE</strong>
          </div>
          <nav className="dash-nav" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => <span className="sk-pill" key={i} />)}
          </nav>
          <span className="sk-pill sk-pill-round" aria-hidden="true" />
        </header>
        <main className="dash-main">
          <BenefitsPageSkeleton page="dashboard" />
        </main>
      </div>
    )
  }
  if (kind === 'staff') {
    return (
      <div className="app ben-app sk-on" role="status" aria-busy="true" aria-label="Loading">
        <header className="app-header">
          <div className="header-top">
            <div className="brand">
              <img src={logo()} alt="" />
              <div className="brand-text"><strong>GLOBAL CARE</strong></div>
            </div>
            <div className="header-staff-actions"><span className="sk-pill" aria-hidden="true" /></div>
          </div>
        </header>
        <div className="container">
          <header className="page-title-block">
            <span className="sk-line sk-line-lg" />
            <span className="sk-line sk-line-md" />
          </header>
          <div className="card-grid">
            {[0, 1].map((i) => (
              <div className="sk-choice" key={i}>
                <span className="sk-block sk-block-icon" />
                <span className="sk-line sk-line-lg" />
                <span className="sk-line sk-line-md" />
                <span className="sk-line" />
                <span className="sk-line" />
              </div>
            ))}
          </div>
          <PausedListSkeleton />
        </div>
      </div>
    )
  }
  // Role not known yet: a neutral card on the sign-in background.
  return (
    <div className="auth-shell sk-on" role="status" aria-busy="true" aria-label="Loading">
      <div className="auth-shell-bg" aria-hidden="true" />
      <div className="auth-card">
        <span className="sk-block sk-block-logo" />
        <span className="sk-line sk-line-lg" />
        <span className="sk-line sk-line-md" />
        <span className="sk-block sk-block-field" />
        <span className="sk-block sk-block-field" />
      </div>
    </div>
  )
}

/** Paused patients list on the staff home screen. */
export function PausedListSkeleton() {
  return (
    <ul className="session-list session-list-skeleton sk-on" aria-busy="true" aria-label="Loading paused patients">
      {[0, 1, 2].map((i) => (
        <li key={i} className="session-list-item sk-session-item">
          <div className="session-resume-btn sk-session-btn">
            <span className="sk-line sk-line-md" />
            <span className="sk-line sk-line-sm" />
            <span className="sk-line sk-line-sm" />
          </div>
          <span className="sk-session-remove" />
        </li>
      ))}
    </ul>
  )
}

/** Users page list. */
export function UsersSkeleton() {
  return (
    <ul className="sk-on sk-user-list" aria-busy="true" aria-label="Loading users">
      {[0, 1, 2, 3].map((i) => (
        <li className="sk-user" key={i}>
          <span className="sk-circle sk-circle-sm" />
          <div className="sk-lines">
            <span className="sk-line sk-line-md" />
            <span className="sk-line sk-line-sm" />
          </div>
          <span className="sk-pill" />
        </li>
      ))}
    </ul>
  )
}

/** Activity log rows. */
export function ActivitySkeleton(): ReactNode {
  return (
    <div className="sk-on sk-activity" aria-busy="true" aria-label="Loading activity">
      {[0, 1].map((g) => (
        <div key={g}>
          <span className="sk-line sk-line-title" />
          {[0, 1, 2].map((i) => (
            <div className="sk-user" key={i}>
              <span className="sk-circle sk-circle-sm" />
              <div className="sk-lines">
                <span className="sk-line sk-line-md" />
                <span className="sk-line sk-line-sm" />
              </div>
              <span className="sk-line sk-line-time" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
