import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import {
  extendBenefitsSession,
  fetchBenefitsCompletions,
  fetchBenefitsEvents,
  formatBenefitsDisplayPath,
  formatDuration,
  formatTimeLeft,
  isSessionExpiringSoon,
  listBenefitsSessions,
  sessionTimeLeftMs,
  type BenefitsCompletion,
  type BenefitsEvent,
  type BenefitsSession,
} from './lib/benefitsStore'
import {
  dailyCounts,
  formatHour,
  formatMinutes,
  handlingStats,
  cancelReasons,
  recentCancellations,
  repeatPatients,
  slowestCases,
  stallPoints,
  timingByProgram,
  trendPct,
  weekdayHourGrid,
  type DaySpan,
  type Trend,
} from './lib/benefitsMetrics'
import { AreaChart, Heatmap, Lollipop, OutcomeBar } from './AdminCharts'
import SyncBadge from './SyncBadge'
import UsersAdmin from './UsersAdmin'
import ActivityLog from './ActivityLog'
import Icon from './AdminIcons'

type Props = {
  onLogout?: () => void
  adminEmail?: string
  siteCode?: string
  siteName?: string
}

type AdminPage = 'dashboard' | 'patients' | 'insights' | 'activity' | 'users'

const LIST_BATCH = 15
const LEGEND_SLOTS = 5

const COLORS = [
  '#2563eb',
  '#0d9488',
  '#d97706',
  '#7c3aed',
  '#64748b',
  '#db2777',
  '#16a34a',
  '#dc2626',
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function TrendChip({ t, vs }: { t: Trend; vs: string }) {
  if (t.pct === null) {
    return <>{t.dir === 'up' ? 'first completions' : 'no change'} vs {vs}</>
  }
  const arrow = t.dir === 'up' ? '▲' : t.dir === 'down' ? '▼' : '■'
  return (
    <>
      <span className={`dx-trend dx-${t.dir}`}>
        {arrow} {Math.abs(t.pct)}%
      </span>{' '}
      vs {vs}
    </>
  )
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function formatMonthLabel(d: Date) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

/** What the date filter is set to: everything, one month, or a custom run of days. */
type Period =
  | { mode: 'all' }
  | { mode: 'month'; month: Date }
  | { mode: 'range'; from: string; to: string; preset: '7' | '30' | 'custom' }

type Span = DaySpan

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseYmd = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const dayDiff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000)
const MAX_RANGE_DAYS = 366

/** The days a period covers (end is exclusive); null for "all months". */
function periodSpan(p: Period): Span | null {
  if (p.mode === 'all') return null
  if (p.mode === 'month') {
    return {
      start: new Date(p.month.getFullYear(), p.month.getMonth(), 1),
      end: new Date(p.month.getFullYear(), p.month.getMonth() + 1, 1),
    }
  }
  let from = parseYmd(p.from)
  let to = parseYmd(p.to)
  if (to < from) [from, to] = [to, from]
  return { start: from, end: addDays(to, 1) }
}

/** The period right before this one, for comparison: last month, or the same number of days before. */
function previousSpan(p: Period, span: Span | null): Span | null {
  if (!span) return null
  if (p.mode === 'month') {
    return {
      start: new Date(span.start.getFullYear(), span.start.getMonth() - 1, 1),
      end: span.start,
    }
  }
  const n = dayDiff(span.start, span.end)
  return { start: addDays(span.start, -n), end: span.start }
}

function inSpan(iso: string, span: Span | null) {
  if (!span) return true
  const t = new Date(iso).getTime()
  return t >= span.start.getTime() && t < span.end.getTime()
}

function spanText(s: Span) {
  const last = addDays(s.end, -1)
  const isMonth =
    s.start.getDate() === 1 &&
    s.end.getTime() === new Date(s.start.getFullYear(), s.start.getMonth() + 1, 1).getTime()
  if (isMonth) return formatMonthLabel(s.start)
  const sameYear = s.start.getFullYear() === last.getFullYear()
  const f = (d: Date, y: boolean) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}) })
  if (dayDiff(s.start, s.end) === 1) return f(s.start, true)
  return `${f(s.start, !sameYear)} – ${f(last, true)}`
}

function PeriodFilter({
  period,
  months,
  onChange,
}: {
  period: Period
  months: Date[]
  onChange: (p: Period) => void
}) {
  const value =
    period.mode === 'all'
      ? 'all'
      : period.mode === 'month'
        ? `m:${period.month.getFullYear()}-${period.month.getMonth()}`
        : period.preset === 'custom'
          ? 'custom'
          : `p:${period.preset}`

  const pick = (v: string) => {
    const today = new Date()
    if (v === 'all') onChange({ mode: 'all' })
    else if (v === 'p:7') onChange({ mode: 'range', preset: '7', from: ymd(addDays(today, -6)), to: ymd(today) })
    else if (v === 'p:30') onChange({ mode: 'range', preset: '30', from: ymd(addDays(today, -29)), to: ymd(today) })
    else if (v === 'custom') {
      if (period.mode === 'range') onChange({ ...period, preset: 'custom' })
      else {
        const sp = periodSpan(period)
        const from = sp ? sp.start : new Date(today.getFullYear(), today.getMonth(), 1)
        const to = sp ? addDays(sp.end, -1) : today
        onChange({ mode: 'range', preset: 'custom', from: ymd(from), to: ymd(to > today ? today : to) })
      }
    } else if (v.startsWith('m:')) {
      const [y, m] = v.slice(2).split('-').map(Number)
      onChange({ mode: 'month', month: new Date(y, m, 1) })
    }
  }

  const setDate = (which: 'from' | 'to', v: string) => {
    if (!v || period.mode !== 'range') return
    let from = which === 'from' ? v : period.from
    let to = which === 'to' ? v : period.to
    if (from > to) {
      if (which === 'from') to = from
      else from = to
    }
    // keep the chart readable: at most a year at a time
    if (dayDiff(parseYmd(from), parseYmd(to)) >= MAX_RANGE_DAYS) {
      if (which === 'from') to = ymd(addDays(parseYmd(from), MAX_RANGE_DAYS - 1))
      else from = ymd(addDays(parseYmd(to), -(MAX_RANGE_DAYS - 1)))
    }
    onChange({ mode: 'range', preset: 'custom', from, to })
  }

  return (
    <div className="dash-month-filter dash-period-filter">
      <select
        className="dash-month-select"
        aria-label="Date range"
        value={value}
        onChange={(e) => pick(e.target.value)}
      >
        <option value="all">All months</option>
        <option value="p:7">Last 7 days</option>
        <option value="p:30">Last 30 days</option>
        <option value="custom">Custom range…</option>
        {months.map((d) => (
          <option key={d.toISOString()} value={`m:${d.getFullYear()}-${d.getMonth()}`}>
            {formatMonthLabel(d)}
          </option>
        ))}
        {period.mode === 'month' &&
          !months.some((d) => d.getFullYear() === period.month.getFullYear() && d.getMonth() === period.month.getMonth()) && (
            <option value={value}>{formatMonthLabel(period.month)}</option>
          )}
      </select>
      {period.mode === 'range' && period.preset === 'custom' && (
        <span className="dash-range">
          <input type="date" aria-label="From date" value={period.from} max={period.to} onChange={(e) => setDate('from', e.target.value)} />
          <span>to</span>
          <input type="date" aria-label="To date" value={period.to} min={period.from} onChange={(e) => setDate('to', e.target.value)} />
        </span>
      )}
    </div>
  )
}

function BenefitsPageSkeleton({ page }: { page: AdminPage }) {
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

export default function BenefitsDashboard({
  onLogout,
  adminEmail,
  siteCode = 'gcmcc',
  siteName = 'Global Care',
}: Props) {
  // The dashboard page fits one screen: show as many waiting patients as the window height allows.
  const rowsForHeight = (h: number) => (h >= 1000 ? 6 : h >= 900 ? 5 : h >= 800 ? 4 : h >= 670 ? 3 : 2)
  const [queueRows, setQueueRows] = useState(() => rowsForHeight(typeof window === 'undefined' ? 900 : window.innerHeight))
  useEffect(() => {
    const onResize = () => setQueueRows(rowsForHeight(window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard')
  const [patientListTab, setPatientListTab] = useState<'ongoing' | 'done'>('ongoing')
  const [listSearch, setListSearch] = useState('')
  const [visibleOngoing, setVisibleOngoing] = useState(LIST_BATCH)
  const [visibleDone, setVisibleDone] = useState(LIST_BATCH)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<BenefitsCompletion[]>([])
  const [sessions, setSessions] = useState<BenefitsSession[]>([])
  const [events, setEvents] = useState<BenefitsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [period, setPeriod] = useState<Period>(() => ({ mode: 'month', month: startOfMonth(new Date()) }))
  const [compare, setCompare] = useState(true)
  const span = useMemo(() => periodSpan(period), [period])
  const prevSpan = useMemo(() => previousSpan(period, span), [period, span])
  const periodLabel = span ? spanText(span) : 'All months'
  const [, setProgressPage] = useState(0)
  const [, setDonePage] = useState(0)
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
    try {
      const [comp, sess, ev] = await Promise.all([
        fetchBenefitsCompletions(siteCode),
        listBenefitsSessions(siteCode),
        fetchBenefitsEvents(siteCode),
      ])
      setRows(comp.data)
      setSessions(sess)
      setEvents(ev.data)
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [siteCode])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(t)
  }, [load])


  /** Resets the 15-day expiry of a paused patient. */
  const keepSession = async (sess: BenefitsSession) => {
    await extendBenefitsSession(sess)
    await load()
  }

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
    () => rows.filter((r) => inSpan(r.created_at, span)),
    [rows, span],
  )

  const searchQ = listSearch.trim().toLowerCase()

  const timing = useMemo(() => timingByProgram(filtered), [filtered])
  const monthEvents = useMemo(
    () => events.filter((e) => inSpan(e.created_at, span)),
    [events, span],
  )
  const stalls = useMemo(() => stallPoints(monthEvents), [monthEvents])
  const reasons = useMemo(() => cancelReasons(monthEvents), [monthEvents])
  const cancelled = useMemo(() => recentCancellations(monthEvents, 6), [monthEvents])
  const maxReason = Math.max(1, ...reasons.map((x) => x.count))
  const abandonCount = monthEvents.filter((e) => e.event === 'abandon').length
  const slowest = timing[0] ?? null
  const maxStall = Math.max(1, ...stalls.map((x) => x.total))
  const handling = useMemo(() => handlingStats(filtered), [filtered])
  const heatGrid = useMemo(() => weekdayHourGrid(filtered), [filtered])
  const slow = useMemo(() => slowestCases(filtered, 5), [filtered])
  const repeats = useMemo(() => repeatPatients(filtered), [filtered])
  // Daily census: the chosen days (last 30 when "all"), against the period just before.
  const chartSpan = useMemo<Span>(() => {
    if (span) return span
    const t = new Date()
    const end = addDays(new Date(t.getFullYear(), t.getMonth(), t.getDate()), 1)
    return { start: addDays(end, -30), end }
  }, [span])
  const chartPrev = useMemo<Span>(() => {
    if (prevSpan) return prevSpan
    const n = dayDiff(chartSpan.start, chartSpan.end)
    return { start: addDays(chartSpan.start, -n), end: chartSpan.start }
  }, [prevSpan, chartSpan])
  const daily = useMemo(() => dailyCounts(rows, chartSpan), [rows, chartSpan])
  const dailyPrev = useMemo(() => dailyCounts(rows, chartPrev), [rows, chartPrev])
  const chartPoints = useMemo(
    () =>
      daily.map((d, i) => ({
        label: d.label,
        tip: d.tip,
        value: d.count,
        highlight: d.isToday,
        prev: compare && dailyPrev[i] ? dailyPrev[i].count : null,
        prevTip: dailyPrev[i]?.tip,
      })),
    [daily, dailyPrev, compare],
  )

  // Busiest weekday + hour slot.
  let peakCount = 0
  let peakLabel = '—'
  heatGrid.forEach((row, d) =>
    row.forEach((v, h) => {
      if (v > peakCount) {
        peakCount = v
        peakLabel = `${WEEKDAYS[d]} ${formatHour(h)}`
      }
    }),
  )

  // Open (paused) patients, longest waiting first.
  const waiting = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(a.updatedAt || a.createdAt).getTime() -
          new Date(b.updatedAt || b.createdAt).getTime(),
      ),
    [sessions],
  )
  const staleCount = waiting.filter(
    (x) => Date.now() - new Date(x.updatedAt || x.createdAt).getTime() > 86_400_000,
  ).length

  const searchedSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (!inSpan(s.updatedAt || s.createdAt, span)) return false
      if (!searchQ) return true
      const name = (s.patientName || '').toLowerCase()
      const prog = (s.snapshot.programName || s.snapshot.programId || '').toLowerCase()
      const path = (s.snapshot.path || []).join(' ').toLowerCase()
      return name.includes(searchQ) || prog.includes(searchQ) || path.includes(searchQ)
    })
  }, [sessions, searchQ, span])

  const searchedDone = useMemo(() => {
    const base = filtered
    if (!searchQ) return base
    return base.filter((r) => {
      const name = (r.patient_name || '').toLowerCase()
      const prog = (r.program_name || r.program_id || '').toLowerCase()
      const path = (r.path || '').toLowerCase()
      return name.includes(searchQ) || prog.includes(searchQ) || path.includes(searchQ)
    })
  }, [filtered, searchQ])

  useEffect(() => {
    setVisibleOngoing(LIST_BATCH)
    setVisibleDone(LIST_BATCH)
  }, [patientListTab, searchedSessions.length, searchedDone.length, listSearch, period])

  const onTableScroll = useCallback(() => {
    const el = tableScrollRef.current
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80
    if (!nearBottom) return
    if (patientListTab === 'ongoing') {
      setVisibleOngoing((n) => Math.min(n + LIST_BATCH, searchedSessions.length))
    } else {
      setVisibleDone((n) => Math.min(n + LIST_BATCH, searchedDone.length))
    }
  }, [patientListTab, searchedSessions.length, searchedDone.length])

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

  const prevCount = useMemo(
    () => (prevSpan ? rows.filter((r) => inSpan(r.created_at, prevSpan)).length : 0),
    [rows, prevSpan],
  )

  const yesterdayCount = useMemo(() => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    return rows.filter((r) => {
      const t = new Date(r.created_at)
      return (
        t.getFullYear() === y.getFullYear() &&
        t.getMonth() === y.getMonth() &&
        t.getDate() === y.getDate()
      )
    }).length
  }, [rows])

  const monthTrend = span ? (
    <TrendChip t={trendPct(total, prevCount)} vs={period.mode === 'month' ? 'last month' : 'previous period'} />
  ) : (
    <>all months</>
  )
  const dayTrend = <TrendChip t={trendPct(todayCount, yesterdayCount)} vs="yesterday" />

  const outcomeSegs = [
    { label: 'Completed', value: total, color: '#1d4ed8' },
    { label: 'In progress', value: sessions.length, color: '#d97706' },
    { label: 'Cancelled', value: abandonCount, color: '#dc2626' },
  ]

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
    <div className={`dash-root dash-v2${adminPage === 'dashboard' ? ' dx-fit' : ''}`}>
      <header className="dash-topbar">
        <div className="dash-brand">
          <img
            src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
            alt=""
            width={28}
            height={28}
          />
          <strong>GLOBAL CARE</strong>
          <span className="dash-brand-site">{locationLabel}</span>
        </div>
        <nav className="dash-nav" aria-label="Benefits admin">
          <button
            type="button"
            className={adminPage === 'dashboard' ? 'dash-nav-active' : undefined}
            onClick={() => setAdminPage('dashboard')}
          >
            <Icon name="dashboard" size={16} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={adminPage === 'patients' ? 'dash-nav-active' : undefined}
            onClick={() => setAdminPage('patients')}
          >
            <Icon name="list" size={16} />
            <span>Patient List</span>
          </button>
          <button
            type="button"
            className={adminPage === 'insights' ? 'dash-nav-active' : undefined}
            onClick={() => setAdminPage('insights')}
          >
            <Icon name="insights" size={16} />
            <span>Insights</span>
          </button>
          <button
            type="button"
            className={adminPage === 'activity' ? 'dash-nav-active' : undefined}
            onClick={() => setAdminPage('activity')}
          >
            <Icon name="clock" size={16} />
            <span>Activity</span>
          </button>
          <button
            type="button"
            className={adminPage === 'users' ? 'dash-nav-active' : undefined}
            onClick={() => setAdminPage('users')}
          >
            <Icon name="users" size={16} />
            <span>Users</span>
          </button>
        </nav>
        <div className="dash-top-right" ref={profileRef}>
          <SyncBadge />
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
                  {periodLabel}
                </p>
              </div>
              <div className="dash-toolbar-actions">
                <PeriodFilter period={period} months={months} onChange={setPeriod} />
                <button type="button" className="dash-btn-primary" onClick={() => void load()}><Icon name="refresh" size={15} /><span>Refresh</span></button>
              </div>
            </div>
          </div>

          <main className="dash-main">
            {loading && !hasLoaded ? <BenefitsPageSkeleton page="dashboard" /> : (
            <div className={`dash-content${loading ? ' dash-content-refreshing' : ''}`}>
              <section className="dash-kpi-grid" aria-label="Key metrics">
                <article className="dash-kpi dash-kpi-purple">
                  <span className="dash-kpi-icon" aria-hidden="true"><Icon name="users" size={20} /></span>
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Total census</span>
                    <strong className="dash-kpi-value">{total}</strong>
                    <span className="dash-kpi-sub">{monthTrend}</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-blue">
                  <span className="dash-kpi-icon" aria-hidden="true"><Icon name="calendar" size={20} /></span>
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Today</span>
                    <strong className="dash-kpi-value">{todayCount}</strong>
                    <span className="dash-kpi-sub">{dayTrend}</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-peach">
                  <span className="dash-kpi-icon" aria-hidden="true"><Icon name="layers" size={20} /></span>
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">In progress now</span>
                    <strong className="dash-kpi-value">{sessions.length}</strong>
                    <span className="dash-kpi-sub"><span className={staleCount > 0 ? "dx-trend dx-down" : undefined}>{staleCount > 0 ? `${staleCount} waiting over 24h` : "none waiting long"}</span></span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-mint">
                  <span className="dash-kpi-icon" aria-hidden="true"><Icon name="clock" size={20} /></span>
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Median handling time</span>
                    <strong className="dash-kpi-value">{formatMinutes(handling?.median)}</strong>
                    <span className="dash-kpi-sub">start → finish, all programs</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
              </section>

              <section className="dx-grid dx-grid-wide" aria-label="Trend and mix">
                <article className="dash-card">
                  <h2><Icon name="trend" size={16} />Daily census</h2>
                  <p className="dash-card-sub dx-sub-row">
                    <span>Completed programs per day · {span ? periodLabel : 'last 30 days'}</span>
                    <span className="dx-compare">
                      <label>
                        <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                        Compare
                      </label>
                      {compare && (
                        <>
                          <i className="dx-key dx-key-cur" />
                          <span>{spanText(chartSpan)}</span>
                          <i className="dx-key dx-key-prev" />
                          <span>{spanText(chartPrev)}</span>
                        </>
                      )}
                    </span>
                  </p>
                  <AreaChart height={0} points={chartPoints} />
                </article>
                <article className="dash-card dx-card-mix">
                    <h2><Icon name="pie" size={16} />Program mix</h2>
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
                            aria-label="Program mix chart"
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
              </section>

              <section className="dx-grid dx-grid-even" aria-label="Queue and outcomes">
                <article className="dash-card">
                  <h2><Icon name="pause" size={16} />In progress now</h2>
                  <p className="dash-card-sub">Open patients, longest waiting first</p>
                  {waiting.length === 0 ? (
                    <p className="dash-muted">No patients are waiting. Everything is finished.</p>
                  ) : (
                    <ul className="dx-queue">
                      {waiting.slice(0, queueRows).map((sess) => {
                        const ageMin = (Date.now() - new Date(sess.updatedAt || sess.createdAt).getTime()) / 60000
                        const expiring = isSessionExpiringSoon(sess)
                        return (
                          <li key={sess.id}>
                            <span className="dx-queue-av">{(sess.patientName || '?').trim().charAt(0).toUpperCase()}</span>
                            <div className="dx-queue-main">
                              <strong>{sess.patientName || 'Unnamed patient'}</strong>
                              <span>
                                {sess.snapshot.programName || 'Programs list'}
                                {sess.snapshot.programName ? ` · step ${sess.snapshot.stepIndex + 1}` : ''}
                              </span>
                            </div>
                            <span className={`dx-chip${ageMin > 1440 ? ' dx-chip-warn' : ''}`} title="Time since last activity">
                              {formatMinutes(ageMin)}
                            </span>
                            {expiring && (
                              <button type="button" className="dx-keep" onClick={() => void keepSession(sess)} title={`Expires in ${formatTimeLeft(sessionTimeLeftMs(sess))}. Click to keep.`}>
                                Keep
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {waiting.length > queueRows && (
                    <button type="button" className="dx-link" onClick={() => { setPatientListTab('ongoing'); setAdminPage('patients') }}>
                      View all {waiting.length} in Patient List →
                    </button>
                  )}
                </article>

                <article className="dash-card">
                  <h2><Icon name="activity" size={16} />Outcomes</h2>
                  <p className="dash-card-sub">How cases ended · {span ? periodLabel : 'all months'}</p>
                  <OutcomeBar segs={outcomeSegs} unit="cases" />
                </article>
              </section>
            </div>
            )}
          </main>
        </>
      )}

      {adminPage === 'users' && <UsersAdmin siteName={locationLabel} />}

      {adminPage === 'activity' && <ActivityLog siteCode={siteCode} siteName={locationLabel} />}

      {adminPage === 'insights' && (
        <>
          <div className="dash-toolbar">
            <div className="dash-toolbar-inner">
              <div className="dash-toolbar-title">
                <h1>Insights</h1>
                <p className="dash-period-text">
                  {periodLabel}
                  {' · '}
                  {locationLabel}
                </p>
              </div>
              <div className="dash-toolbar-actions">
                <PeriodFilter period={period} months={months} onChange={setPeriod} />
                <button
                  type="button"
                  className="dash-btn-primary"
                  onClick={() => void load()}
                ><Icon name="refresh" size={15} /><span>Refresh</span></button>
              </div>
            </div>
          </div>

          <main className="dash-main dash-main-insights">
            {loading && !hasLoaded ? <BenefitsPageSkeleton page="insights" /> : (
            <div className={`dash-content${loading ? ' dash-content-refreshing' : ''}`}>
              <section className="dash-kpi-grid" aria-label="Insight highlights">
                <article className="dash-kpi dash-kpi-purple">
                  <span className="dash-kpi-icon" aria-hidden="true"><Icon name="hourglass" size={20} /></span>
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Slowest program</span>
                    <strong className="dash-kpi-value">{slowest ? formatMinutes(slowest.medianMin) : "—"}</strong>
                    <span className="dash-kpi-sub">{slowest ? `${slowest.program} (median)` : "No data yet"}</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-blue">
                  <span className="dash-kpi-icon" aria-hidden="true"><Icon name="activity" size={20} /></span>
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Busiest time</span>
                    <strong className="dash-kpi-value">{peakLabel}</strong>
                    <span className="dash-kpi-sub">{peakCount} completed in that slot</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-peach">
                  <span className="dash-kpi-icon" aria-hidden="true"><Icon name="users" size={20} /></span>
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Repeat patients</span>
                    <strong className="dash-kpi-value">{repeats.length}</strong>
                    <span className="dash-kpi-sub">more than one program</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
                <article className="dash-kpi dash-kpi-mint">
                  <span className="dash-kpi-icon" aria-hidden="true"><Icon name="alert" size={20} /></span>
                  <div className="dash-kpi-body">
                    <span className="dash-kpi-label">Most common stall</span>
                    <strong className="dash-kpi-value">{stalls[0] ? stalls[0].total : 0}</strong>
                    <span className="dash-kpi-sub">{stalls[0] ? stalls[0].label : "No pauses recorded"}</span>
                  </div>
                  <span className="dash-kpi-accent" aria-hidden="true" />
                </article>
              </section>

              <section className="dx-grid dx-grid-even" aria-label="Insights">
                <article className="dash-card">
                  <h2><Icon name="clock" size={16} />Handling time per program</h2>
                  <p className="dash-card-sub">Start → finish. The median ignores cases left paused overnight.</p>
                  {timing.length === 0 ? (
                    <p className="dash-muted">No completed programs in this period.</p>
                  ) : (
                    <Lollipop
                      rows={timing.map((t) => ({ label: t.program, count: t.count, median: t.medianMin, avg: t.avgMin }))}
                      format={formatMinutes}
                    />
                  )}
                </article>

                <article className="dash-card">
                  <h2><Icon name="calendar" size={16} />Busiest days and hours</h2>
                  <p className="dash-card-sub">Completed programs by weekday and hour</p>
                  {peakCount === 0 ? (
                    <p className="dash-muted">No completed programs in this period.</p>
                  ) : (
                    <Heatmap grid={heatGrid} />
                  )}
                </article>
              </section>

              <section className="dx-grid dx-grid-three" aria-label="Problem areas">
                <article className="dash-card">
                  <h2><Icon name="alert" size={16} />Where staff pause or cancel</h2>
                  <p className="dash-card-sub">Program and step</p>
                  {stalls.length === 0 ? (
                    <p className="dash-muted">No paused or cancelled flows recorded in this period.</p>
                  ) : (
                    <ul className="dx-stall">
                      {stalls.slice(0, 6).map((x) => (
                        <li key={x.label}>
                          <div className="dx-stall-head">
                            <span>{x.label}</span>
                            <strong>{x.total}</strong>
                          </div>
                          <div className="dx-stall-bar">
                            <b className="dx-pause" style={{ width: `${(x.pauses / maxStall) * 100}%` }} title={`${x.pauses} paused`} />
                            <b className="dx-abandon" style={{ width: `${(x.abandons / maxStall) * 100}%` }} title={`${x.abandons} cancelled`} />
                          </div>
                        </li>
                      ))}
                      <li className="dx-stall-legend"><i className="dx-pause" /> Paused <i className="dx-abandon" /> Cancelled</li>
                    </ul>
                  )}
                </article>

                <article className="dash-card">
                  <h2><Icon name="hourglass" size={16} />Slowest cases</h2>
                  <p className="dash-card-sub">Longest start → finish</p>
                  {slow.length === 0 ? (
                    <p className="dash-muted">No completed programs in this period.</p>
                  ) : (
                    <ol className="dx-rank">
                      {slow.map((c) => (
                        <li key={c.id}>
                          <div>
                            <strong>{c.patient}</strong>
                            <span>{c.program}</span>
                          </div>
                          <em>{formatMinutes(c.minutes)}</em>
                        </li>
                      ))}
                    </ol>
                  )}
                </article>

                <article className="dash-card">
                  <h2><Icon name="users" size={16} />Repeat patients</h2>
                  <p className="dash-card-sub">Completed more than one program</p>
                  {repeats.length === 0 ? (
                    <p className="dash-muted">No repeat patients in this period.</p>
                  ) : (
                    <ol className="dx-rank">
                      {repeats.slice(0, 5).map((p) => (
                        <li key={p.name}>
                          <div>
                            <strong>{p.name}</strong>
                            <span>{p.programs.join(', ')}</span>
                          </div>
                          <em>{p.count}×</em>
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              </section>

              <section className="dx-grid dx-grid-even" aria-label="Cancellations">
                <article className="dash-card">
                  <h2><Icon name="alert" size={16} />Why cases are cancelled</h2>
                  <p className="dash-card-sub">Reason picked by staff when cancelling a paused patient</p>
                  {reasons.length === 0 ? (
                    <p className="dash-muted">No cancelled cases in this period.</p>
                  ) : (
                    <ul className="dx-reasons">
                      {reasons.map((x) => (
                        <li key={x.reason}>
                          <div className="dx-reason-head">
                            <span>{x.reason}</span>
                            <strong>{x.count}</strong>
                          </div>
                          <div className="dx-reason-bar">
                            <b style={{ width: `${(x.count / maxReason) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="dash-card">
                  <h2><Icon name="list" size={16} />Recent cancellations</h2>
                  <p className="dash-card-sub">Latest first</p>
                  {cancelled.length === 0 ? (
                    <p className="dash-muted">No cancelled cases in this period.</p>
                  ) : (
                    <ol className="dx-rank">
                      {cancelled.map((c) => (
                        <li key={c.id}>
                          <div>
                            <strong>{c.patient}</strong>
                            <span>
                              {c.program}
                              {c.step ? ` · step ${c.step}` : ''} · {c.reason}
                              {c.note ? ` — ${c.note}` : ''}
                            </span>
                          </div>
                          <em title={c.by}>
                            {new Date(c.at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            {c.by ? ` · ${c.by.split('@')[0]}` : ''}
                          </em>
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              </section>
            </div>
            )}
          </main>
        </>
      )}

      {adminPage === 'patients' && (
        <>
          <div className="dash-toolbar">
            <div className="dash-toolbar-inner dash-toolbar-inner-patients">
              <div className="dash-toolbar-title">
                <h1>Patient List</h1>
                <p className="dash-period-text">
                  {periodLabel}
                  {' · '}
                  {patientListTab === 'ongoing'
                    ? `${searchedSessions.length} ongoing`
                    : `${searchedDone.length} completed`}
                </p>
              </div>
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
                <span className="dash-patient-tab-count">{searchedSessions.length}</span>
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
                <span className="dash-patient-tab-count">{searchedDone.length}</span>
              </button>
              </div>

              <div className="dash-toolbar-actions">
                <PeriodFilter period={period} months={months} onChange={setPeriod} />
                <input
                  type="search"
                  className="dash-patient-search"
                  placeholder="Search name or program…"
                  value={listSearch}
                  onChange={(e) => {
                    setListSearch(e.target.value)
                    setVisibleOngoing(LIST_BATCH)
                    setVisibleDone(LIST_BATCH)
                  }}
                  aria-label="Search patients by name or program"
                />
                <button type="button" className="dash-btn-primary" onClick={() => void load()}><Icon name="refresh" size={15} /><span>Refresh</span></button>
              </div>
            </div>
          </div>

          <main className="dash-main dash-main-patients">
            {loading && !hasLoaded ? <BenefitsPageSkeleton page="patients" /> : <>
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
                        <th>Expires</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedSessions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="dash-patient-empty-line">
                            {searchQ ? 'No ongoing patients match your search.' : 'No ongoing patients right now.'}
                          </td>
                        </tr>
                      ) : (
                        searchedSessions.slice(0, visibleOngoing).map((sess) => (
                          <tr key={sess.id}>
                            <td className="dash-patient-name">{sess.patientName}</td>
                            <td
                              className="dash-patient-path-cell"
                              title={formatBenefitsDisplayPath(sess.snapshot.path || [])}
                            >
                              <strong>{sess.snapshot.programName || 'Programs list'}</strong>
                              <span className="dash-patient-path-sub">
                                {formatBenefitsDisplayPath(sess.snapshot.path || [])}
                              </span>
                            </td>
                            <td className="dash-patient-time">
                              {new Date(sess.createdAt).toLocaleString()}
                            </td>
                            <td className="dash-patient-time">
                              {new Date(sess.updatedAt).toLocaleString()}
                            </td>
                            <td className="dash-patient-expiry-cell">
                              <span
                                className={
                                  isSessionExpiringSoon(sess)
                                    ? 'dash-expiry dash-expiry-soon'
                                    : 'dash-expiry'
                                }
                              >
                                {isSessionExpiringSoon(sess) ? '⚠ ' : ''}
                                {formatTimeLeft(sessionTimeLeftMs(sess))}
                              </span>
                              <button
                                type="button"
                                className="dash-keep-btn"
                                onClick={() => void keepSession(sess)}
                                title="Reset the 15-day expiry"
                              >
                                Extend 15 days
                              </button>
                            </td>
                            <td>
                              <span className="dash-patient-status">Ongoing</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {searchedSessions.length > visibleOngoing && (
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
                        <th>Completed by</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedDone.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="dash-patient-empty-line">
                            {searchQ ? 'No completed records match your search.' : 'No completed records yet.'}
                          </td>
                        </tr>
                      ) : (
                        searchedDone.slice(0, visibleDone).map((r) => (
                          <tr key={r.id}>
                            <td className="dash-patient-name">{r.patient_name}</td>
                            <td>{r.program_name}</td>
                            <td
                              className="dash-patient-path-cell"
                              title={r.path}
                            >
                              {formatBenefitsDisplayPath(r.path)}
                            </td>
                            <td className="dash-patient-time">
                              {new Date(r.created_at).toLocaleString()}
                            </td>
                            <td className="dash-patient-duration">
                              {formatDuration(r.started_at || r.created_at, r.created_at)}
                            </td>
                            <td className="dash-patient-by" title={r.created_by ?? ''}>
                              {r.created_by ? r.created_by.split('@')[0] : '—'}
                              {r.updated_by && (
                                <small title={`${r.updated_by}${r.updated_at ? ' · ' + new Date(r.updated_at).toLocaleString() : ''}`}>
                                  edited by {r.updated_by.split('@')[0]}
                                </small>
                              )}
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
                  {searchedDone.length > visibleDone && (
                    <div className="dash-patient-load-more">Scroll for more…</div>
                  )}
                </div>
              </section>
            )}
            </>}
          </main>        </>
      )}
    </div>
  )
}
