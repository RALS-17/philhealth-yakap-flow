import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { fetchFlowCompletions, type FlowCompletionRow } from './lib/flowMonitor'

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

type Props = {
  onLogout?: () => void
}

export default function Dashboard({ onLogout }: Props) {
  const [rows, setRows] = useState<FlowCompletionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** null = All months */
  const [monthCursor, setMonthCursor] = useState<Date | null>(() => startOfMonth(new Date()))
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

  useEffect(() => {
    void load()
  }, [load])

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
        <nav className="dash-nav">
          <a className="dash-nav-active" href="#monitor">
            Dashboard
          </a>
          <a href="#/">Guide App</a>
        </nav>
        <div className="dash-top-right">
          {onLogout && (
            <button type="button" className="dash-logout-btn" onClick={onLogout}>
              Log out
            </button>
          )}
          <span className="dash-avatar">G</span>
          <div className="dash-user-meta">
            <span className="dash-user-name">Monitor</span>
            <span className="dash-user-role">ADMIN</span>
          </div>
        </div>
      </header>

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
    </div>
  )
}
