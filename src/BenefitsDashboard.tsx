import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import {
  fetchBenefitsCompletions,
  formatDuration,
  listBenefitsSessions,
  type BenefitsCompletion,
  type BenefitsSession,
} from './lib/benefitsStore'

type Props = {
  onLogout?: () => void
  adminEmail?: string
  siteCode?: string
  siteName?: string
}

type AdminPage = 'dashboard' | 'patients'

const PAGE_SIZE = 5
const LIST_BATCH = 15
const LEGEND_SLOTS = 5

const COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#22c55e',
  '#94a3b8',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
]

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function formatMonthLabel(d: Date) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function inMonth(iso: string, month: Date | null) {
  if (!month) return true
  const t = new Date(iso)
  return t.getFullYear() === month.getFullYear() && t.getMonth() === month.getMonth()
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function BenefitsDashboard({
  onLogout,
  adminEmail,
  siteCode = 'gcmcc',
  siteName = 'Global Care',
}: Props) {
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard')
  const [patientListTab, setPatientListTab] = useState<'ongoing' | 'done'>('ongoing')
  const [visibleOngoing, setVisibleOngoing] = useState(LIST_BATCH)
  const [visibleDone, setVisibleDone] = useState(LIST_BATCH)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<BenefitsCompletion[]>([])
  const [sessions, setSessions] = useState<BenefitsSession[]>([])
  const [loading, setLoading] = useState(true)
  const [monthCursor, setMonthCursor] = useState<Date | null>(() => startOfMonth(new Date()))
  const [progressPage, setProgressPage] = useState(0)
  const [donePage, setDonePage] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [hoverTip, setHoverTip] = useState<{
    name: string
    count: number
    pct: number
    color: string
    x: number
    y: number
  } | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const locationLabel = siteName.replace(/^Global Care\s*/i, '') || siteName

  useEffect(() => {
    const logoPath = `${import.meta.env.BASE_URL}global-care-logo.svg`
    document.documentElement.style.setProperty('--logo-url', `url("${logoPath}")`)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [comp, sess] = await Promise.all([
      fetchBenefitsCompletions(siteCode),
      listBenefitsSessions(siteCode),
    ])
    setRows(comp.data)
    setSessions(sess)
    setLoading(false)
  }, [siteCode])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(t)
  }, [load])


  useEffect(() => {
    if (!profileOpen) return
    const onDoc = (e: globalThis.MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [profileOpen])

  const filtered = useMemo(
    () => rows.filter((r) => inMonth(r.created_at, monthCursor)),
    [rows, monthCursor],
  )

  useEffect(() => {
    setVisibleOngoing(LIST_BATCH)
    setVisibleDone(LIST_BATCH)
  }, [patientListTab, sessions.length, filtered.length])

  const onTableScroll = useCallback(() => {
    const el = tableScrollRef.current
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80
    if (!nearBottom) return
    if (patientListTab === 'ongoing') {
      setVisibleOngoing((n) => Math.min(n + LIST_BATCH, sessions.length))
    } else {
      setVisibleDone((n) => Math.min(n + LIST_BATCH, filtered.length))
    }
  }, [patientListTab, sessions.length, filtered.length])

  const byProgram = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filtered) {
      const k = r.program_name || r.program_id || 'Unknown'
      map.set(k, (map.get(k) || 0) + 1)
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  const total = filtered.length

  const todayCount = useMemo(() => {
    const now = new Date()
    return rows.filter((r) => {
      const t = new Date(r.created_at)
      return (
        t.getFullYear() === now.getFullYear() &&
        t.getMonth() === now.getMonth() &&
        t.getDate() === now.getDate() &&
        (!siteCode || r.site_code === siteCode)
      )
    }).length
  }, [rows, siteCode])

  const top = byProgram[0]
  const maxProg = Math.max(1, ...byProgram.map((p) => p.count), 1)

  const donutSegments = useMemo(() => {
    const topN = byProgram.slice(0, LEGEND_SLOTS)
    const rest = byProgram.slice(LEGEND_SLOTS)
    const restCount = rest.reduce((s, x) => s + x.count, 0)
    const segs =
      restCount > 0
        ? [...topN, { name: `Others (${rest.length})`, count: restCount }]
        : topN
    let offset = 0
    return segs.map((f, i) => {
      const pct = total > 0 ? (f.count / total) * 100 : 0
      const seg = { ...f, pct, color: COLORS[i % COLORS.length], offset }
      offset += pct
      return seg
    })
  }, [byProgram, total])

  const pathwayShare = donutSegments

  const programA = byProgram[0] ?? null
  const programB = byProgram[1] ?? null
  const programRest = byProgram.slice(2)
  const programRestCount = programRest.reduce((s, e) => s + e.count, 0)
  const programRestLabel =
    programRest.length === 0
      ? '—'
      : programRest.length === 1
        ? programRest[0].name
        : `${programRest.length} others`

  const pathwaySlots = [
    byProgram[0] ?? null,
    byProgram[1] ?? null,
    byProgram[2] ?? null,
    byProgram[3] ?? null,
    byProgram[4] ?? null,
  ]

  const monthlyTrend = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; count: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: monthKey(d),
        label: d.toLocaleString('en-US', { month: 'short' }),
        count: 0,
      })
    }
    const map = new Map(months.map((m) => [m.key, m]))
    for (const r of rows) {
      if (siteCode && r.site_code && r.site_code !== siteCode) continue
      const t = new Date(r.created_at)
      const k = monthKey(t)
      const m = map.get(k)
      if (m) m.count += 1
    }
    return months
  }, [rows, siteCode])

  const maxMonth = Math.max(1, ...monthlyTrend.map((m) => m.count))

  const barPrograms = byProgram.slice(0, 6)
  const maxBar = Math.max(1, ...barPrograms.map((p) => p.count), 1)

  const progressTotalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE))
  const doneTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const progressSafe = Math.min(progressPage, progressTotalPages - 1)
  const doneSafe = Math.min(donePage, doneTotalPages - 1)
  const progressSlice = sessions.slice(progressSafe * PAGE_SIZE, progressSafe * PAGE_SIZE + PAGE_SIZE)
  const doneSlice = filtered.slice(doneSafe * PAGE_SIZE, doneSafe * PAGE_SIZE + PAGE_SIZE)

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const d = new Date(r.created_at)
      set.add(`${d.getFullYear()}-${d.getMonth()}`)
    }
    return [...set]
      .map((k) => {
        const [y, m] = k.split('-').map(Number)
        return new Date(y, m, 1)
      })
      .sort((a, b) => b.getTime() - a.getTime())
  }, [rows])

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
          <strong>GLOBAL CARE · {locationLabel}</strong>
        </div>
        <nav className="dash-nav" aria-label="Benefits admin">
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
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span className="dash-avatar">A</span>
              <div className="dash-user-meta">
                <span className="dash-user-name">{adminEmail || 'Admin'}</span>
                <span className="dash-user-role">BENEFITS ADMIN</span>
              </div>
              <span className="dash-profile-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {profileOpen && (
              <>
                <div
                  className="dash-profile-backdrop"
                  onClick={() => setProfileOpen(false)}
                  aria-hidden="true"
                />
                <div className="dash-profile-dropdown" role="menu">
                  <div className="dash-profile-head">
                    <span className="dash-avatar dash-avatar-lg">A</span>
                    <div>
                      <strong>{adminEmail || 'Admin'}</strong>
                      <em>Benefits Programs</em>
                    </div>
                  </div>
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
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {hoverTip && (
        <div
          className="dash-float-tip dash-float-tip-fixed"
          style={{ left: hoverTip.x + 14, top: hoverTip.y + 14 }}
        >
          <span className="dash-float-tip-dot" style={{ background: hoverTip.color }} />
          <div>
            <strong>{hoverTip.name}</strong>
            <em>
              {hoverTip.count}
              {hoverTip.pct > 0 ? ` · ${Math.round(hoverTip.pct)}%` : ''}
            </em>
          </div>
        </div>
      )}

      {adminPage === 'dashboard' && (
        <>
          <div className="dash-toolbar">
            <div className="dash-toolbar-inner">
              <div className="dash-toolbar-title">
                <h1>Dashboard</h1>
                <p className="dash-period-text">
                  {monthCursor ? formatMonthLabel(monthCursor) : 'All months'}
                </p>
              </div>
              <div className="dash-toolbar-actions">
                <div className="dash-month-filter">
                  <span className="dash-filter-label">Period</span>
                  <select
                    className="dash-month-select"
                    value={
                      monthCursor
                        ? `${monthCursor.getFullYear()}-${monthCursor.getMonth()}`
                        : 'all'
                    }
                    onChange={(e) => {
                      if (e.target.value === 'all') setMonthCursor(null)
                      else {
                        const [y, m] = e.target.value.split('-').map(Number)
                        setMonthCursor(new Date(y, m, 1))
                      }
                    }}
                  >
                    <option value="all">All months</option>
                    {months.map((d) => (
                      <option key={d.toISOString()} value={`${d.getFullYear()}-${d.getMonth()}`}>
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

          <main className="dash-main">
            <div className={`dash-content${loading ? ' dash-content-refreshing' : ''}`}>
              <section className="dash-kpi-grid" aria-label="Key metrics">
                <article className="dash-kpi dash-kpi-purple dash-card-hover" title="Total census">
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Total census</span>
                    <strong className="dash-kpi-value">{total}</strong>
                    <span className="dash-kpi-sub">completed programs</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-blue dash-card-hover" title="Completed today">
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Today</span>
                    <strong className="dash-kpi-value">{todayCount}</strong>
                    <span className="dash-kpi-sub">completed today</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-peach dash-card-hover" title="Programs used">
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Programs used</span>
                    <strong className="dash-kpi-value">{byProgram.length}</strong>
                    <span className="dash-kpi-sub">different packages</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-mint dash-card-hover" title="Top program">
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Top program</span>
                    <strong className="dash-kpi-value">{top ? top.count : 0}</strong>
                    <span className="dash-kpi-sub dash-kpi-sub-ellipsis">
                      {top ? top.name : 'No data yet'}
                    </span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
              </section>

              <section className="dash-board-grid" aria-label="Dashboard panels">
                <div className="dash-board-col">
                  <article className="dash-card dash-card-hover">
                    <h2>Program breakdown</h2>
                    <div className="dash-donut-solo">
                      {total === 0 ? (
                        <div className="dash-donut dash-donut-lg" style={{ background: '#e2e8f0' }}>
                          <div className="dash-donut-hole">
                            <strong>0</strong>
                            <span>programs</span>
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
                            aria-label="Program breakdown chart"
                          >
                            {(() => {
                              const outerR = 54
                              const innerR = 32
                              const cx = 60
                              const cy = 60
                              const toRad = (deg: number) => (deg * Math.PI) / 180
                              const raw = donutSegments.map((seg) => Math.max(seg.pct, 0))
                              const sum = raw.reduce((a, b) => a + b, 0) || 1
                              const sweeps = raw.map((p) => (p / sum) * 360)
                              let angle = -90
                              return donutSegments.map((seg, i) => {
                                // Full ring: draw as filled annulus via two arcs (CSS .dash-slice forces stroke white)
                                let sweep = sweeps[i]
                                if (sweep >= 359.9) sweep = 359.99
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
                                  setHoverTip({
                                    name: seg.name,
                                    count: seg.count,
                                    pct: seg.pct,
                                    color: seg.color,
                                    x: e.clientX,
                                    y: e.clientY,
                                  })
                                }
                                const d = [
                                  `M ${x1o} ${y1o}`,
                                  `A ${outerR} ${outerR} 0 ${large} 1 ${x2o} ${y2o}`,
                                  `L ${x1i} ${y1i}`,
                                  `A ${innerR} ${innerR} 0 ${large} 0 ${x2i} ${y2i}`,
                                  'Z',
                                ].join(' ')
                                return (
                                  <path
                                    key={`${seg.name}-${i}`}
                                    d={d}
                                    fill={seg.color}
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
                              census
                            </text>
                          </svg>
                        </div>
                      )}
                      <ul
                        className="dash-donut-legend"
                        aria-label="Program legend"
                        onMouseLeave={() => setHoverTip(null)}
                      >
                        {donutSegments.map((seg) => (
                          <li
                            key={seg.name}
                            onMouseEnter={(ev) =>
                              setHoverTip({
                                name: seg.name,
                                count: seg.count,
                                pct: seg.pct,
                                color: seg.color,
                                x: ev.clientX,
                                y: ev.clientY,
                              })
                            }
                            onMouseMove={(ev) =>
                              setHoverTip({
                                name: seg.name,
                                count: seg.count,
                                pct: seg.pct,
                                color: seg.color,
                                x: ev.clientX,
                                y: ev.clientY,
                              })
                            }
                          >
                            <span
                              className="dash-legend-dot"
                              style={{ background: seg.color }}
                            />
                            <span className="dash-legend-name">{seg.name}</span>
                            <strong className="dash-legend-count">{seg.count}</strong>
                            <em className="dash-legend-pct">{Math.round(seg.pct)}%</em>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>

                  <article className="dash-card dash-card-hover">
                    <h2>By program</h2>
                    <p className="dash-card-sub">Completed patients by benefit program</p>
                    <div className="dash-cat-bars" onMouseLeave={() => setHoverTip(null)}>
                      {(barPrograms.length ? barPrograms : [{ name: 'No data', count: 0 }]).map(
                        (e) => {
                          const pct = total > 0 ? (e.count / total) * 100 : 0
                          const show = (ev: MouseEvent<HTMLDivElement>) =>
                            setHoverTip({
                              name: e.name,
                              count: e.count,
                              pct,
                              color: '#7c3aed',
                              x: ev.clientX,
                              y: ev.clientY,
                            })
                          return (
                            <div
                              key={e.name}
                              className="dash-cat-col"
                              onMouseEnter={show}
                              onMouseMove={show}
                            >
                              <strong className="dash-cat-val">{e.count}</strong>
                              <div className="dash-cat-track">
                                <div
                                  className="dash-cat-fill"
                                  style={{
                                    height: `${Math.max(6, (e.count / maxBar) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="dash-cat-label">{e.name}</span>
                            </div>
                          )
                        },
                      )}
                    </div>
                  </article>
                </div>

                <div className="dash-board-col dash-board-col-center">
                  <article className="dash-card dash-card-hover dash-card-entry" title="Program spotlight">
                    <h2>Program spotlight</h2>
                    <div className="dash-priority-grid">
                      <div
                        className={`dash-spot dash-spot-urgent${programA ? '' : ' dash-spot-empty'}`}
                        onMouseEnter={(ev) =>
                          programA &&
                          setHoverTip({
                            name: programA.name,
                            count: programA.count,
                            pct: total > 0 ? (programA.count / total) * 100 : 0,
                            color: '#dc2626',
                            x: ev.clientX,
                            y: ev.clientY,
                          })
                        }
                        onMouseMove={(ev) =>
                          programA &&
                          setHoverTip({
                            name: programA.name,
                            count: programA.count,
                            pct: total > 0 ? (programA.count / total) * 100 : 0,
                            color: '#dc2626',
                            x: ev.clientX,
                            y: ev.clientY,
                          })
                        }
                        onMouseLeave={() => setHoverTip(null)}
                      >
                        <strong>{programA?.count ?? 0}</strong>
                        <span>{programA ? programA.name : 'Top program'}</span>
                      </div>
                      <div
                        className={`dash-spot dash-spot-high${programB ? '' : ' dash-spot-empty'}`}
                        onMouseEnter={(ev) =>
                          programB &&
                          setHoverTip({
                            name: programB.name,
                            count: programB.count,
                            pct: total > 0 ? (programB.count / total) * 100 : 0,
                            color: '#ea580c',
                            x: ev.clientX,
                            y: ev.clientY,
                          })
                        }
                        onMouseMove={(ev) =>
                          programB &&
                          setHoverTip({
                            name: programB.name,
                            count: programB.count,
                            pct: total > 0 ? (programB.count / total) * 100 : 0,
                            color: '#ea580c',
                            x: ev.clientX,
                            y: ev.clientY,
                          })
                        }
                        onMouseLeave={() => setHoverTip(null)}
                      >
                        <strong>{programB?.count ?? 0}</strong>
                        <span>{programB ? programB.name : '2nd program'}</span>
                      </div>
                      <div
                        className={`dash-spot dash-spot-mid${programRest.length ? '' : ' dash-spot-empty'}`}
                        onMouseEnter={(ev) =>
                          programRest.length > 0 &&
                          setHoverTip({
                            name: programRestLabel,
                            count: programRestCount,
                            pct: total > 0 ? (programRestCount / total) * 100 : 0,
                            color: '#2563eb',
                            x: ev.clientX,
                            y: ev.clientY,
                          })
                        }
                        onMouseMove={(ev) =>
                          programRest.length > 0 &&
                          setHoverTip({
                            name: programRestLabel,
                            count: programRestCount,
                            pct: total > 0 ? (programRestCount / total) * 100 : 0,
                            color: '#2563eb',
                            x: ev.clientX,
                            y: ev.clientY,
                          })
                        }
                        onMouseLeave={() => setHoverTip(null)}
                      >
                        <strong>{programRestCount}</strong>
                        <span>
                          {programRest.length
                            ? programRest.length === 1
                              ? programRest[0].name
                              : 'Other programs'
                            : 'Other programs'}
                        </span>
                      </div>
                    </div>
                  </article>

                  <article className="dash-card dash-card-hover dash-card-share">
                    <h2>Program share</h2>
                    <p className="dash-card-sub">Top programs in this period</p>
                    <div className="dash-stack-wrap">
                      <div className="dash-stack-bar" role="img" aria-label="Program share">
                        {total === 0 ? (
                          <div className="dash-stack-empty" />
                        ) : (
                          pathwayShare.map((s) => {
                            const show = (ev: MouseEvent<HTMLDivElement>) =>
                              setHoverTip({
                                name: s.name,
                                count: s.count,
                                pct: s.pct,
                                color: s.color,
                                x: ev.clientX,
                                y: ev.clientY,
                              })
                            return (
                              <div
                                key={s.name}
                                className="dash-stack-seg"
                                style={{
                                  width: `${Math.max(s.pct, 2)}%`,
                                  background: s.color,
                                }}
                                onMouseEnter={show}
                                onMouseMove={show}
                                onMouseLeave={() => setHoverTip(null)}
                              />
                            )
                          })
                        )}
                      </div>
                      <ul className="dash-stack-legend">
                        {pathwayShare.map((s) => (
                          <li key={s.name}>
                            <span
                              className="dash-legend-dot"
                              style={{ background: s.color }}
                            />
                            <span>{s.name}</span>
                          </li>
                        ))}
                        {pathwayShare.length === 0 && (
                          <li className="dash-muted">No data yet</li>
                        )}
                      </ul>
                    </div>
                  </article>
                </div>

                <div className="dash-board-col">
                  <article className="dash-card dash-card-hover" title="Top programs">
                    <h2>Top programs</h2>
                    <ul className="dash-assigned">
                      {pathwaySlots.map((f, i) =>
                        f ? (
                          <li
                            key={f.name}
                            onMouseEnter={(ev) =>
                              setHoverTip({
                                name: f.name,
                                count: f.count,
                                pct: total > 0 ? (f.count / total) * 100 : 0,
                                color: '#7c3aed',
                                x: ev.clientX,
                                y: ev.clientY,
                              })
                            }
                            onMouseMove={(ev) =>
                              setHoverTip({
                                name: f.name,
                                count: f.count,
                                pct: total > 0 ? (f.count / total) * 100 : 0,
                                color: '#7c3aed',
                                x: ev.clientX,
                                y: ev.clientY,
                              })
                            }
                            onMouseLeave={() => setHoverTip(null)}
                          >
                            <span className="dash-assigned-name">{f.name}</span>
                            <div className="dash-bar-track">
                              <div
                                className="dash-bar-fill"
                                style={{
                                  width: `${Math.max(8, (f.count / maxProg) * 100)}%`,
                                }}
                              />
                            </div>
                            <strong className="dash-assigned-count">{f.count}</strong>
                          </li>
                        ) : (
                          <li key={`empty-path-${i}`} className="dash-slot-empty">
                            <span className="dash-assigned-name">—</span>
                            <div className="dash-bar-track">
                              <div
                                className="dash-bar-fill dash-bar-empty"
                                style={{ width: '8%' }}
                              />
                            </div>
                            <strong className="dash-assigned-count">0</strong>
                          </li>
                        ),
                      )}
                    </ul>
                  </article>

                  <article className="dash-card dash-card-hover">
                    <h2>12-month census</h2>
                    <p className="dash-card-sub">Completed programs per month</p>
                    <div className="dash-trend">
                      <svg
                        className="dash-trend-svg"
                        viewBox="0 0 240 90"
                        preserveAspectRatio="none"
                      >
                        {(() => {
                          const w = 240
                          const h = 90
                          const padX = 8
                          const padY = 12
                          const pts = monthlyTrend.map((m, i) => {
                            const x =
                              padX +
                              (i * (w - padX * 2)) / Math.max(monthlyTrend.length - 1, 1)
                            const y =
                              h - padY - (m.count / maxMonth) * (h - padY * 2)
                            return { x, y, ...m }
                          })
                          const line = pts
                            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                            .join(' ')
                          const area = `${line} L ${pts[pts.length - 1]?.x ?? 0} ${h - padY} L ${pts[0]?.x ?? 0} ${h - padY} Z`
                          return (
                            <>
                              <path d={area} className="dash-trend-area" />
                              <path d={line} className="dash-trend-line" fill="none" />
                              {pts.map((p) => {
                                const show = (ev: MouseEvent<SVGCircleElement>) =>
                                  setHoverTip({
                                    name: p.label,
                                    count: p.count,
                                    pct: 0,
                                    color: '#7c3aed',
                                    x: ev.clientX,
                                    y: ev.clientY,
                                  })
                                return (
                                  <circle
                                    key={p.key}
                                    cx={p.x}
                                    cy={p.y}
                                    r="5"
                                    className="dash-trend-dot"
                                    onMouseEnter={show}
                                    onMouseMove={show}
                                    onMouseLeave={() => setHoverTip(null)}
                                  />
                                )
                              })}
                            </>
                          )
                        })()}
                      </svg>
                      <div className="dash-trend-labels">
                        {monthlyTrend.map((m, i) =>
                          i % 2 === 0 || i === monthlyTrend.length - 1 ? (
                            <span key={m.key}>{m.label}</span>
                          ) : (
                            <span key={m.key} />
                          ),
                        )}
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </div>
          </main>
        </>
      )}

      {adminPage === 'patients' && (
        <>
          <div className="dash-toolbar">
            <div className="dash-toolbar-inner">
              <div className="dash-toolbar-title">
                <h1>Patient List</h1>
                <p className="dash-period-text">
                  {patientListTab === 'ongoing'
                    ? `${sessions.length} ongoing`
                    : `${filtered.length} completed`}
                </p>
              </div>
              <div className="dash-toolbar-actions">
                <button type="button" className="dash-btn-primary" onClick={() => void load()}>
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <main className="dash-main dash-main-patients">
            <div className="dash-patient-tabs" role="tablist" aria-label="Patient status">
              <button
                type="button"
                role="tab"
                className={patientListTab === 'ongoing' ? 'dash-patient-tab dash-patient-tab-active' : 'dash-patient-tab'}
                aria-selected={patientListTab === 'ongoing'}
                onClick={() => {
                  setPatientListTab('ongoing')
                  setProgressPage(0)
                }}
              >
                Ongoing
                <span className="dash-patient-tab-count">{sessions.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                className={patientListTab === 'done' ? 'dash-patient-tab dash-patient-tab-active' : 'dash-patient-tab'}
                aria-selected={patientListTab === 'done'}
                onClick={() => {
                  setPatientListTab('done')
                  setDonePage(0)
                }}
              >
                Done
                <span className="dash-patient-tab-count">{filtered.length}</span>
              </button>
            </div>

            {patientListTab === 'ongoing' && (
              <section className="dash-patient-section">
                <div
                  className="dash-patient-table-wrap"
                  ref={tableScrollRef}
                  onScroll={onTableScroll}
                >
                  <table className="dash-patient-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Program / path</th>
                        <th>Started</th>
                        <th>Updated</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="dash-patient-empty-line">
                            No ongoing patients right now.
                          </td>
                        </tr>
                      ) : (
                        sessions.slice(0, visibleOngoing).map((sess) => (
                          <tr key={sess.id}>
                            <td className="dash-patient-name">{sess.patientName}</td>
                            <td className="dash-patient-path-cell">
                              {sess.snapshot.programName || 'Programs list'} · step{' '}
                              {(sess.snapshot.stepIndex || 0) + 1}
                            </td>
                            <td className="dash-patient-time">
                              {new Date(sess.createdAt).toLocaleString()}
                            </td>
                            <td className="dash-patient-time">
                              {new Date(sess.updatedAt).toLocaleString()}
                            </td>
                            <td>
                              <span className="dash-patient-status">Ongoing</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {sessions.length > visibleOngoing && (
                    <div className="dash-patient-load-more">Scroll for more…</div>
                  )}
                </div>
              </section>
            )}

            {patientListTab === 'done' && (
              <section className="dash-patient-section">
                <div
                  className="dash-patient-table-wrap"
                  ref={tableScrollRef}
                  onScroll={onTableScroll}
                >
                  <table className="dash-patient-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Program</th>
                        <th>Path</th>
                        <th>Finished</th>
                        <th>Duration</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="dash-patient-empty-line">
                            No completed records yet.
                          </td>
                        </tr>
                      ) : (
                        filtered.slice(0, visibleDone).map((r) => (
                          <tr key={r.id}>
                            <td className="dash-patient-name">{r.patient_name}</td>
                            <td>{r.program_name}</td>
                            <td className="dash-patient-path-cell" title={r.path}>
                              {r.path}
                            </td>
                            <td className="dash-patient-time">
                              {new Date(r.created_at).toLocaleString()}
                            </td>
                            <td className="dash-patient-duration">
                              {formatDuration(r.started_at || r.created_at, r.created_at)}
                            </td>
                            <td>
                              <span className="dash-patient-status dash-patient-status-done">
                                Done
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {filtered.length > visibleDone && (
                    <div className="dash-patient-load-more">Scroll for more…</div>
                  )}
                </div>
              </section>
            )}
          </main>        </>
      )}
    </div>
  )
}
