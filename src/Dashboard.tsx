import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type FormEvent,
  type MouseEvent,
} from 'react'
import {
  fetchFlowCompletions,
  fetchCompletedPatients,
  type FlowCompletionRow,
} from './lib/flowMonitor'
import { changeAdminPassword } from './lib/auth'
import {
  listSessions,
  pathSummary,
  formatSessionTime,
  type ParkedSession,
} from './lib/sessionStore'

const FLOW_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#22c55e',
  '#94a3b8',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
]

const LEGEND_SLOTS = 5
const PATHWAY_SLOTS = 5

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatMonthLabel(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatMonthValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function entryLabel(entry: string | null | undefined) {
  if (!entry) return '—'
  if (entry === 'er') return 'ER'
  if (entry === 'opd') return 'OPD'
  if (entry === 'direct') return 'Direct'
  return entry
}

/** Elapsed time from start until now (or until endIso if provided). */
function formatDuration(startIso: string, endIso?: string): string {
  try {
    const start = new Date(startIso).getTime()
    const end = endIso ? new Date(endIso).getTime() : Date.now()
    let ms = Math.max(0, end - start)
    const days = Math.floor(ms / (24 * 60 * 60 * 1000))
    ms %= 24 * 60 * 60 * 1000
    const hours = Math.floor(ms / (60 * 60 * 1000))
    ms %= 60 * 60 * 1000
    const mins = Math.floor(ms / (60 * 1000))
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    if (mins > 0) return `${mins}m`
    return '< 1m'
  } catch {
    return '—'
  }
}

function fullPath(snapshot: ParkedSession['snapshot']): string {
  const p = snapshot.path?.filter(Boolean) ?? []
  return p.length ? p.join(' → ') : 'Just started'
}

type AdminPage = 'dashboard' | 'patients'

type Props = {
  onLogout?: () => void
  adminEmail?: string
}

export default function Dashboard({ onLogout, adminEmail }: Props) {
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard')
  const [rows, setRows] = useState<FlowCompletionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patients, setPatients] = useState<ParkedSession[]>([])
  const [donePatients, setDonePatients] = useState<FlowCompletionRow[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [patientsError, setPatientsError] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const PATIENT_PAGE_SIZE = 5
  const [progressPage, setProgressPage] = useState(0)
  const [donePage, setDonePage] = useState(0)
  /** null = All months */
  const [monthCursor, setMonthCursor] = useState<Date | null>(() => startOfMonth(new Date()))
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileView, setProfileView] = useState<'menu' | 'settings'>('menu')
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const [hoverTip, setHoverTip] = useState<{
    name: string
    count: number
    pct: number
    color: string
    x: number
    y: number
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchFlowCompletions()
    setRows(res.data)
    setError(res.error)
    setLoading(false)
  }, [])

  const loadPatients = useCallback(async () => {
    setPatientsLoading(true)
    setPatientsError(null)
    try {
      const [list, done] = await Promise.all([listSessions(), fetchCompletedPatients()])
      setPatients(list)
      setDonePatients(done.data)
      if (done.error) setPatientsError(done.error)
      setProgressPage(0)
      setDonePage(0)
    } catch (e) {
      setPatientsError(e instanceof Error ? e.message : 'Failed to load patients')
      setPatients([])
      setDonePatients([])
      setProgressPage(0)
      setDonePage(0)
    }
    setPatientsLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (adminPage !== 'patients') return
    void loadPatients()
    const tick = window.setInterval(() => setNowTick(Date.now()), 30_000)
    const refresh = window.setInterval(() => void loadPatients(), 60_000)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(refresh)
    }
  }, [adminPage, loadPatients])

  useEffect(() => {
    if (!profileOpen) return
    const onDoc = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
        setProfileView('menu')
        setPwErr(null)
        setPwMsg(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false)
        setProfileView('menu')
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [profileOpen])

  const availableMonths = useMemo(() => {
    const keys = new Set<string>()
    rows.forEach((r) => {
      const d = new Date(r.created_at)
      keys.add(formatMonthValue(d))
    })
    const now = new Date()
    keys.add(formatMonthValue(now))
    return [...keys]
      .sort()
      .reverse()
      .map((k) => {
        const [y, m] = k.split('-').map(Number)
        return startOfMonth(new Date(y, m - 1, 1))
      })
  }, [rows])

  const filteredRows = useMemo(() => {
    if (monthCursor === null) return rows
    const from = startOfMonth(monthCursor).getTime()
    const to = endOfMonth(monthCursor).getTime()
    return rows.filter((r) => {
      const t = new Date(r.created_at).getTime()
      return t >= from && t <= to
    })
  }, [rows, monthCursor])

  const todayCount = useMemo(() => {
    const now = new Date()
    return filteredRows.filter((r) => isSameDay(new Date(r.created_at), now)).length
  }, [filteredRows])

  const byFlow = useMemo(() => {
    const map = new Map<string, number>()
    filteredRows.forEach((r) => map.set(r.flow_name, (map.get(r.flow_name) || 0) + 1))
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredRows])

  const byEntry = useMemo(() => {
    const map = new Map<string, number>()
    filteredRows.forEach((r) => {
      const key = entryLabel(r.entry_type)
      map.set(key, (map.get(key) || 0) + 1)
    })
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredRows])

  const total = filteredRows.length
  const uniqueFlows = byFlow.length
  const topFlow = byFlow[0]
  const maxFlow = byFlow[0]?.count || 1

  const donutSegments = useMemo(() => {
    if (total === 0) return []
    // Show top pathways; fold remainder into "Others" so the ring is always a full circle
    const top = byFlow.slice(0, LEGEND_SLOTS)
    const rest = byFlow.slice(LEGEND_SLOTS)
    const restCount = rest.reduce((s, f) => s + f.count, 0)
    const items =
      restCount > 0
        ? [...top, { name: `Others (${rest.length})`, count: restCount }]
        : top.length > 0
          ? top
          : []
    let offset = 0
    return items.map((f, i) => {
      const pct = (f.count / total) * 100
      const seg = { ...f, pct, color: FLOW_COLORS[i % FLOW_COLORS.length], offset }
      offset += pct
      return seg
    })
  }, [byFlow, total])

  const donutStyle =
    total === 0
      ? { background: '#e2e8f0' }
      : {
          background: `conic-gradient(${donutSegments
            .map((s) => `${s.color} ${s.offset}% ${s.offset + s.pct}%`)
            .join(', ')})`,
        }

  const periodLabel = monthCursor === null ? 'All months' : formatMonthLabel(monthCursor)
  const isCurrentMonth =
    monthCursor !== null &&
    monthCursor.getMonth() === new Date().getMonth() &&
    monthCursor.getFullYear() === new Date().getFullYear()
  const periodSub =
    monthCursor === null ? 'all time' : isCurrentMonth ? 'this month' : 'selected month'

  const pathwaySlots = Array.from({ length: PATHWAY_SLOTS }, (_, i) => byFlow[i] ?? null)
  const entryA = byEntry[0] ?? null
  const entryB = byEntry[1] ?? null
  const entryRest = byEntry.slice(2)
  const entryRestCount = entryRest.reduce((s, e) => s + e.count, 0)
  const entryRestLabel =
    entryRest.length === 0
      ? '—'
      : entryRest.length === 1
        ? entryRest[0].name
        : `${entryRest.length} others`

  return (
    <div className="dash-root">
      <header className="dash-topbar">
        <div className="dash-brand">
          <img
            src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
            alt=""
            width={28}
            height={28}
          />
          <strong>GCare PhilHealth Flow</strong>
        </div>
        <nav className="dash-nav" aria-label="Admin pages">
          <button
            type="button"
            className={adminPage === 'dashboard' ? 'dash-nav-active' : undefined}
            onClick={() => setAdminPage('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={adminPage === 'patients' ? 'dash-nav-active' : undefined}
            onClick={() => setAdminPage('patients')}
          >
            Patient List
          </button>
        </nav>
        <div className="dash-top-right" ref={profileRef}>
          <div className="dash-profile">
            <button
              type="button"
              className="dash-profile-trigger"
              onClick={() => {
                setProfileOpen((v) => !v)
                setProfileView('menu')
                setPwErr(null)
                setPwMsg(null)
              }}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span className="dash-avatar">A</span>
              <div className="dash-user-meta">
                <span className="dash-user-name">{adminEmail || 'Admin'}</span>
                <span className="dash-user-role">ADMIN</span>
              </div>
              <span className="dash-profile-caret" aria-hidden="true">
                ▾
              </span>
            </button>

            {profileOpen && (
              <>
              <div
                className="dash-profile-backdrop"
                onClick={() => {
                  setProfileOpen(false)
                  setProfileView('menu')
                }}
                aria-hidden="true"
              />
              <div className="dash-profile-dropdown" role="menu">
                {profileView === 'menu' ? (
                  <>
                    <div className="dash-profile-head">
                      <span className="dash-avatar dash-avatar-lg">A</span>
                      <div>
                        <strong>{adminEmail || 'Admin'}</strong>
                        <em>Administrator</em>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="dash-profile-item"
                      role="menuitem"
                      onClick={() => {
                        setProfileView('settings')
                        setPwErr(null)
                        setPwMsg(null)
                      }}
                    >
                      Profile settings
                    </button>
                    {onLogout && (
                      <button
                        type="button"
                        className="dash-profile-item dash-profile-logout"
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false)
                          onLogout()
                        }}
                      >
                        Log out
                      </button>
                    )}
                  </>
                ) : (
                  <form
                    className="dash-profile-settings"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault()
                      setPwMsg(null)
                      setPwErr(null)
                      if (pwNext !== pwConfirm) {
                        setPwErr('New passwords do not match.')
                        return
                      }
                      const result = changeAdminPassword(pwCurrent, pwNext)
                      if (!result.ok) {
                        setPwErr(result.error)
                        return
                      }
                      setPwMsg('Password updated on this browser.')
                      setPwCurrent('')
                      setPwNext('')
                      setPwConfirm('')
                    }}
                  >
                    <button
                      type="button"
                      className="dash-profile-back"
                      onClick={() => {
                        setProfileView('menu')
                        setPwErr(null)
                        setPwMsg(null)
                      }}
                    >
                      ← Back
                    </button>
                    <h3>Profile settings</h3>
                    <div className="dash-profile-field">
                      <span>Email</span>
                      <strong>{adminEmail || 'Admin'}</strong>
                    </div>
                    <div className="dash-profile-field">
                      <span>Role</span>
                      <strong>Administrator</strong>
                    </div>
                    <hr className="dash-profile-sep" />
                    <p className="dash-profile-section-label">Change password</p>
                    <input
                      type="password"
                      placeholder="Current password"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      value={pwNext}
                      onChange={(e) => setPwNext(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    {pwErr && <div className="dash-login-error">{pwErr}</div>}
                    {pwMsg && <div className="auth-success-msg">{pwMsg}</div>}
                    <button type="submit" className="dash-btn-primary dash-profile-save">
                      Save password
                    </button>
                  </form>
                )}
              </div>
              </>
            )}
          </div>
        </div>
      </header>

      {adminPage === 'dashboard' && (
      <div className="dash-toolbar">
        <div className="dash-toolbar-inner">
          <div className="dash-toolbar-title">
            <h1>Dashboard</h1>
            <p className="dash-period-text">{periodLabel}</p>
          </div>
          <div className="dash-toolbar-actions">
            <div className="dash-month-filter">
              <label htmlFor="month-filter" className="dash-filter-label">
                Period
              </label>
              <select
                id="month-filter"
                className="dash-month-select"
                value={monthCursor === null ? 'all' : formatMonthValue(monthCursor)}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'all') {
                    setMonthCursor(null)
                  } else {
                    const [y, m] = v.split('-').map(Number)
                    setMonthCursor(startOfMonth(new Date(y, m - 1, 1)))
                  }
                }}
              >
                <option value="all">All months</option>
                {availableMonths.map((d) => (
                  <option key={formatMonthValue(d)} value={formatMonthValue(d)}>
                    {formatMonthLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="dash-btn-primary" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>
      </div>
      )}

      {adminPage === 'patients' && (
        <div className="dash-toolbar">
          <div className="dash-toolbar-inner">
            <div className="dash-toolbar-title">
              <h1>Patient List</h1>
              <p className="dash-period-text">
                {patients.length} in progress · {donePatients.length} done
              </p>
            </div>
            <div className="dash-toolbar-actions">
              <button
                type="button"
                className="dash-btn-primary"
                onClick={() => void loadPatients()}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {adminPage === 'dashboard' && (
      <main className="dash-main">
        {error && (
          <div className="dash-alert">
            <strong>Cannot load data.</strong> {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <p className="dash-muted dash-loading">Loading…</p>
        ) : (
          <div className={`dash-content${loading ? ' dash-content-refreshing' : ''}`}>
            <section className="dash-kpi-grid" aria-label="Key metrics">
              <article className="dash-kpi dash-kpi-purple dash-card-hover" title="Total guided patients">
                <span className="dash-kpi-label">Total guided</span>
                <strong className="dash-kpi-value">{total}</strong>
                <span className="dash-kpi-sub">{periodSub}</span>
              </article>
              <article className="dash-kpi dash-kpi-blue dash-card-hover" title="Completed today">
                <span className="dash-kpi-label">Today</span>
                <strong className="dash-kpi-value">{todayCount}</strong>
                <span className="dash-kpi-sub">completed today</span>
              </article>
              <article className="dash-kpi dash-kpi-peach dash-card-hover" title="Pathways used">
                <span className="dash-kpi-label">Pathways used</span>
                <strong className="dash-kpi-value">{uniqueFlows}</strong>
                <span className="dash-kpi-sub">different flows</span>
              </article>
              <article className="dash-kpi dash-kpi-mint dash-card-hover" title="Top pathway">
                <span className="dash-kpi-label">Top pathway</span>
                <strong className="dash-kpi-value">{topFlow ? topFlow.count : 0}</strong>
                <span className="dash-kpi-sub dash-kpi-sub-ellipsis">
                  {topFlow ? topFlow.name : 'No data yet'}
                </span>
              </article>
            </section>

            <section className="dash-mid-grid">
              <article className="dash-card dash-card-hover">
                <h2>Pathway breakdown</h2>
                <div className="dash-donut-solo">
                  {total === 0 ? (
                    <div className="dash-donut dash-donut-lg" style={{ background: '#e2e8f0' }}>
                      <div className="dash-donut-hole">
                        <strong>0</strong>
                        <span>flows</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="dash-donut-svg-wrap"
                      onMouseLeave={() => setHoverTip(null)}
                    >
                      <svg
                        className="dash-donut-svg"
                        viewBox="0 0 120 120"
                        role="img"
                        aria-label="Pathway breakdown chart"
                      >
                        {(() => {
                          const outerR = 54
                          const innerR = 32
                          const cx = 60
                          const cy = 60
                          const toRad = (deg: number) => (deg * Math.PI) / 180
                          // Normalize sweeps so they always total exactly 360°
                          const raw = donutSegments.map((s) => Math.max(s.pct, 0))
                          const sum = raw.reduce((a, b) => a + b, 0) || 1
                          const sweeps = raw.map((p) => (p / sum) * 360)
                          let angle = -90
                          return donutSegments.map((s, i) => {
                            const sweep = sweeps[i]
                            const start = angle
                            const end = angle + sweep
                            angle = end
                            const large = sweep > 180 ? 1 : 0
                            const x1o = cx + outerR * Math.cos(toRad(start))
                            const y1o = cy + outerR * Math.sin(toRad(start))
                            const x2o = cx + outerR * Math.cos(toRad(end))
                            const y2o = cy + outerR * Math.sin(toRad(end))
                            const x1i = cx + innerR * Math.cos(toRad(end))
                            const y1i = cy + innerR * Math.sin(toRad(end))
                            const x2i = cx + innerR * Math.cos(toRad(start))
                            const y2i = cy + innerR * Math.sin(toRad(start))
                            const showTip = (e: MouseEvent<SVGElement>) => {
                              const rect = (
                                e.currentTarget.ownerSVGElement as SVGSVGElement
                              ).getBoundingClientRect()
                              setHoverTip({
                                name: s.name,
                                count: s.count,
                                pct: s.pct,
                                color: s.color,
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top,
                              })
                            }
                            if (sweep >= 359.9) {
                              // Full ring via two circles (outer fill + inner hole drawn separately)
                              return (
                                <circle
                                  key={s.name}
                                  cx={cx}
                                  cy={cy}
                                  r={(outerR + innerR) / 2}
                                  fill="none"
                                  stroke={s.color}
                                  strokeWidth={outerR - innerR}
                                  className="dash-slice"
                                  onMouseEnter={showTip}
                                  onMouseMove={showTip}
                                />
                              )
                            }
                            // True donut slice: outer arc → inner arc reverse
                            const d = [
                              `M ${x1o} ${y1o}`,
                              `A ${outerR} ${outerR} 0 ${large} 1 ${x2o} ${y2o}`,
                              `L ${x1i} ${y1i}`,
                              `A ${innerR} ${innerR} 0 ${large} 0 ${x2i} ${y2i}`,
                              'Z',
                            ].join(' ')
                            return (
                              <path
                                key={s.name}
                                d={d}
                                fill={s.color}
                                className="dash-slice"
                                onMouseEnter={showTip}
                                onMouseMove={showTip}
                              />
                            )
                          })
                        })()}
                        <circle cx="60" cy="60" r="30" fill="#fff" pointerEvents="none" />
                        <text
                          x="60"
                          y="57"
                          textAnchor="middle"
                          className="dash-svg-total"
                          pointerEvents="none"
                        >
                          {total}
                        </text>
                        <text
                          x="60"
                          y="72"
                          textAnchor="middle"
                          className="dash-svg-label"
                          pointerEvents="none"
                        >
                          flows
                        </text>
                      </svg>
                      {hoverTip && (
                        <div
                          className="dash-float-tip"
                          style={{ left: hoverTip.x + 12, top: hoverTip.y - 8 }}
                        >
                          <span
                            className="dash-float-tip-dot"
                            style={{ background: hoverTip.color }}
                          />
                          <div>
                            <strong>{hoverTip.name}</strong>
                            <em>
                              {hoverTip.count} · {Math.round(hoverTip.pct)}%
                            </em>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="dash-donut-hint">Hover a segment for name & value</p>
                </div>
              </article>

              <article className="dash-card dash-card-hover" title="Entry spotlight">
                <h2>Entry spotlight</h2>
                <div className="dash-priority-grid">
                  <div
                    className={`dash-spot dash-spot-urgent${entryA ? '' : ' dash-spot-empty'}`}
                    title={entryA ? `${entryA.name}: ${entryA.count}` : 'No data'}
                  >
                    <strong>{entryA?.count ?? 0}</strong>
                    <span>{entryA?.name ?? '—'}</span>
                  </div>
                  <div
                    className={`dash-spot dash-spot-high${entryB ? '' : ' dash-spot-empty'}`}
                    title={entryB ? `${entryB.name}: ${entryB.count}` : 'No data'}
                  >
                    <strong>{entryB?.count ?? 0}</strong>
                    <span>{entryB?.name ?? '—'}</span>
                  </div>
                  <div
                    className={`dash-spot dash-spot-mid${entryRest.length ? '' : ' dash-spot-empty'}`}
                    title={entryRest.length ? `${entryRestLabel}: ${entryRestCount}` : 'No data'}
                  >
                    <strong>{entryRestCount}</strong>
                    <span>{entryRestLabel}</span>
                  </div>
                </div>
              </article>

              <article className="dash-card dash-card-hover" title="Top pathways">
                <h2>Top pathways</h2>
                <ul className="dash-assigned">
                  {pathwaySlots.map((f, i) =>
                    f ? (
                      <li key={f.name} title={`${f.name}: ${f.count}`}>
                        <span className="dash-assigned-name">
                          {f.name}
                        </span>
                        <div className="dash-bar-track">
                          <div
                            className="dash-bar-fill"
                            style={{ width: `${Math.max(8, (f.count / maxFlow) * 100)}%` }}
                          />
                        </div>
                        <strong className="dash-assigned-count">{f.count}</strong>
                      </li>
                    ) : (
                      <li key={`empty-path-${i}`} className="dash-slot-empty">
                        <span className="dash-assigned-name">—</span>
                        <div className="dash-bar-track">
                          <div className="dash-bar-fill dash-bar-empty" style={{ width: '8%' }} />
                        </div>
                        <strong className="dash-assigned-count">0</strong>
                      </li>
                    ),
                  )}
                </ul>
              </article>
            </section>
          </div>
        )}
      </main>
      )}

      {adminPage === 'patients' && (() => {
        const progressTotalPages = Math.max(1, Math.ceil(patients.length / PATIENT_PAGE_SIZE))
        const doneTotalPages = Math.max(1, Math.ceil(donePatients.length / PATIENT_PAGE_SIZE))
        const progressSafe = Math.min(progressPage, progressTotalPages - 1)
        const doneSafe = Math.min(donePage, doneTotalPages - 1)
        const progressSlice = patients.slice(
          progressSafe * PATIENT_PAGE_SIZE,
          progressSafe * PATIENT_PAGE_SIZE + PATIENT_PAGE_SIZE,
        )
        const doneSlice = donePatients.slice(
          doneSafe * PATIENT_PAGE_SIZE,
          doneSafe * PATIENT_PAGE_SIZE + PATIENT_PAGE_SIZE,
        )
        return (
        <main className="dash-main dash-main-patients">
          {patientsError && (
            <div className="dash-alert">
              <strong>Cannot load patients.</strong> {patientsError}
            </div>
          )}
          {patientsLoading && patients.length === 0 && donePatients.length === 0 ? (
            <p className="dash-muted dash-loading">Loading patients…</p>
          ) : patients.length === 0 && donePatients.length === 0 ? (
            <div className="dash-patient-empty">
              <p>No patients yet</p>
              <p className="dash-muted">
                In-progress sessions appear when staff start or park guidance. Done records appear
                after a pathway is finished.
              </p>
            </div>
          ) : (
            <div className="dash-patient-sections">
              <section className="dash-patient-section">
                <div className="dash-patient-section-head">
                  <h2 className="dash-patient-section-title">In progress</h2>
                  <span className="dash-patient-count">{patients.length}</span>
                </div>
                {patients.length === 0 ? (
                  <p className="dash-patient-empty-line">No active or parked patients right now.</p>
                ) : (
                  <>
                    <div className="dash-patient-table-wrap">
                      <table className="dash-patient-table">
                        <thead>
                          <tr>
                            <th>Patient</th>
                            <th>Path</th>
                            <th>Started</th>
                            <th>Last activity</th>
                            <th>In process</th>
                            <th>Idle</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progressSlice.map((p) => {
                            void nowTick
                            return (
                              <tr key={p.id}>
                                <td className="dash-patient-name">{p.label}</td>
                                <td className="dash-patient-path-cell" title={fullPath(p.snapshot)}>
                                  {fullPath(p.snapshot)}
                                </td>
                                <td className="dash-patient-time">{formatSessionTime(p.createdAt)}</td>
                                <td className="dash-patient-time">{formatSessionTime(p.updatedAt)}</td>
                                <td className="dash-patient-duration">{formatDuration(p.createdAt)}</td>
                                <td className="dash-patient-idle-cell">{formatDuration(p.updatedAt)}</td>
                                <td>
                                  <span className="dash-patient-status">In progress</span>
                                </td>
                              </tr>
                            )
                          })}
                          {Array.from({
                            length: Math.max(0, PATIENT_PAGE_SIZE - progressSlice.length),
                          }).map((_, i) => (
                            <tr key={`prog-empty-${i}`} className="dash-patient-row-empty">
                              <td colSpan={7}>&nbsp;</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="dash-patient-pager">
                      <button
                        type="button"
                        className="dash-pager-btn"
                        disabled={progressSafe <= 0}
                        onClick={() => setProgressPage((x) => Math.max(0, x - 1))}
                        aria-label="Previous in-progress page"
                      >
                        ‹
                      </button>
                      <span className="dash-pager-label">
                        {progressSafe + 1} / {progressTotalPages}
                      </span>
                      <button
                        type="button"
                        className="dash-pager-btn"
                        disabled={progressSafe >= progressTotalPages - 1}
                        onClick={() =>
                          setProgressPage((x) => Math.min(progressTotalPages - 1, x + 1))
                        }
                        aria-label="Next in-progress page"
                      >
                        ›
                      </button>
                    </div>
                  </>
                )}
              </section>

              <section className="dash-patient-section">
                <div className="dash-patient-section-head">
                  <h2 className="dash-patient-section-title">Done</h2>
                  <span className="dash-patient-count dash-patient-count-done">
                    {donePatients.length}
                  </span>
                </div>
                {donePatients.length === 0 ? (
                  <p className="dash-patient-empty-line">
                    No completed records yet. Finished pathways will show here.
                  </p>
                ) : (
                  <>
                    <div className="dash-patient-table-wrap">
                      <table className="dash-patient-table">
                        <thead>
                          <tr>
                            <th>Patient</th>
                            <th>Path</th>
                            <th>Started</th>
                            <th>Finished</th>
                            <th>Duration</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {doneSlice.map((r) => {
                            const startIso = r.started_at || r.created_at
                            const pathText =
                              r.path ||
                              [r.flow_name, r.branch].filter(Boolean).join(' · ') ||
                              '—'
                            return (
                              <tr key={`done-${r.id}`}>
                                <td className="dash-patient-name">{r.patient_label || 'Patient'}</td>
                                <td className="dash-patient-path-cell" title={pathText}>
                                  {pathText}
                                </td>
                                <td className="dash-patient-time">
                                  {r.started_at ? formatSessionTime(r.started_at) : '—'}
                                </td>
                                <td className="dash-patient-time">{formatSessionTime(r.created_at)}</td>
                                <td className="dash-patient-duration">
                                  {formatDuration(startIso, r.created_at)}
                                </td>
                                <td>
                                  <span className="dash-patient-status dash-patient-status-done">
                                    Done
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                          {Array.from({
                            length: Math.max(0, PATIENT_PAGE_SIZE - doneSlice.length),
                          }).map((_, i) => (
                            <tr key={`done-empty-${i}`} className="dash-patient-row-empty">
                              <td colSpan={6}>&nbsp;</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="dash-patient-pager">
                      <button
                        type="button"
                        className="dash-pager-btn"
                        disabled={doneSafe <= 0}
                        onClick={() => setDonePage((x) => Math.max(0, x - 1))}
                        aria-label="Previous done page"
                      >
                        ‹
                      </button>
                      <span className="dash-pager-label">
                        {doneSafe + 1} / {doneTotalPages}
                      </span>
                      <button
                        type="button"
                        className="dash-pager-btn"
                        disabled={doneSafe >= doneTotalPages - 1}
                        onClick={() => setDonePage((x) => Math.min(doneTotalPages - 1, x + 1))}
                        aria-label="Next done page"
                      >
                        ›
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </main>
        )
      })()}
    </div>
  )
}
