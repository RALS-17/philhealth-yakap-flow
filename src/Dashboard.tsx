import { useCallback, useEffect, useMemo, useState } from 'react'
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

function entryLabel(entry: string | null | undefined) {
  if (!entry) return '—'
  if (entry === 'er') return 'ER'
  if (entry === 'opd') return 'OPD'
  if (entry === 'direct') return 'Direct'
  return entry
}

export default function Dashboard() {
  const [rows, setRows] = useState<FlowCompletionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))

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

  const monthRows = useMemo(() => {
    const from = startOfMonth(monthCursor).getTime()
    const to = endOfMonth(monthCursor).getTime()
    return rows.filter((r) => {
      const t = new Date(r.created_at).getTime()
      return t >= from && t <= to
    })
  }, [rows, monthCursor])

  const todayCount = useMemo(() => {
    const now = new Date()
    return monthRows.filter((r) => isSameDay(new Date(r.created_at), now)).length
  }, [monthRows])

  const byFlow = useMemo(() => {
    const map = new Map<string, number>()
    monthRows.forEach((r) => map.set(r.flow_name, (map.get(r.flow_name) || 0) + 1))
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [monthRows])

  const byEntry = useMemo(() => {
    const map = new Map<string, number>()
    monthRows.forEach((r) => {
      const key = entryLabel(r.entry_type)
      map.set(key, (map.get(key) || 0) + 1)
    })
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [monthRows])

  const total = monthRows.length
  const uniqueFlows = byFlow.length
  const topFlow = byFlow[0]
  const maxFlow = byFlow[0]?.count || 1
  const donutSegments = useMemo(() => {
    if (total === 0) return []
    let offset = 0
    return byFlow.slice(0, 6).map((f, i) => {
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

  const shiftMonth = (dir: number) => {
    setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1))
  }

  const isCurrentMonth =
    monthCursor.getMonth() === new Date().getMonth() &&
    monthCursor.getFullYear() === new Date().getFullYear()

  const entryA = byEntry[0]
  const entryB = byEntry[1]
  const entryRest = byEntry.slice(2)
  const entryRestCount = entryRest.reduce((s, e) => s + e.count, 0)
  const entryRestLabel =
    entryRest.length === 0
      ? null
      : entryRest.length === 1
        ? entryRest[0].name
        : entryRest.map((e) => e.name).join(' & ')

  return (
    <div className="dash-root">
      {/* Top nav — same structure as IT Support */}
      <header className="dash-topbar">
        <div className="dash-brand">
          <img
            src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
            alt=""
            width={34}
            height={34}
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
          <span className="dash-avatar">G</span>
          <div className="dash-user-meta">
            <span className="dash-user-name">Monitor</span>
            <span className="dash-user-role">ADMIN</span>
          </div>
        </div>
      </header>

      <main className="dash-main">
        {/* Title row */}
        <div className="dash-title-row">
          <div>
            <h1>Dashboard</h1>
            <p>Pathway report · {formatMonthLabel(monthCursor)}</p>
          </div>
          <div className="dash-title-actions">
            <div className="dash-month-picker">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                ‹
              </button>
              <span>{formatMonthLabel(monthCursor)}</span>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
                ›
              </button>
            </div>
            {isCurrentMonth && <span className="dash-chip">This month</span>}
            <button type="button" className="dash-btn-primary" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="dash-alert">
            <strong>Cannot load data.</strong> {error}
          </div>
        )}

        {loading ? (
          <p className="dash-muted" style={{ textAlign: 'center', padding: 40 }}>
            Loading…
          </p>
        ) : (
          <>
            {/* KPI row — same card shape as IT Support */}
            <section className="dash-kpi-grid">
              <article className="dash-kpi dash-kpi-purple">
                <span className="dash-kpi-label">Total guided</span>
                <strong className="dash-kpi-value">{total}</strong>
                <span className="dash-kpi-sub">this month</span>
              </article>
              <article className="dash-kpi dash-kpi-blue">
                <span className="dash-kpi-label">Today</span>
                <strong className="dash-kpi-value">{todayCount}</strong>
                <span className="dash-kpi-sub">completed today</span>
              </article>
              <article className="dash-kpi dash-kpi-peach">
                <span className="dash-kpi-label">Pathways used</span>
                <strong className="dash-kpi-value">{uniqueFlows}</strong>
                <span className="dash-kpi-sub">different flows</span>
              </article>
              <article className="dash-kpi dash-kpi-mint">
                <span className="dash-kpi-label">Top pathway</span>
                <strong className="dash-kpi-value">{topFlow ? topFlow.count : 0}</strong>
                <span className="dash-kpi-sub">
                  {topFlow ? topFlow.name : 'No data yet'}
                </span>
              </article>
            </section>

            {/* Mid: Status breakdown | Priority spotlight | Assigned to */}
            <section className="dash-mid-grid">
              <article className="dash-card">
                <h2>Pathway breakdown</h2>
                <div className="dash-donut-wrap">
                  <div className="dash-donut" style={donutStyle}>
                    <div className="dash-donut-hole">
                      <strong>{total}</strong>
                      <span>flows</span>
                    </div>
                  </div>
                  <ul className="dash-legend">
                    {byFlow.length === 0 && <li className="dash-muted">No data</li>}
                    {byFlow.slice(0, 6).map((f, i) => (
                      <li key={f.name}>
                        <span
                          className="dash-dot"
                          style={{ background: FLOW_COLORS[i % FLOW_COLORS.length] }}
                        />
                        <span className="dash-legend-name">{f.name}</span>
                        <span className="dash-legend-nums">
                          <b>{f.count}</b>
                          <em>{total ? `${Math.round((f.count / total) * 100)}%` : ''}</em>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="dash-card">
                <h2>Entry spotlight</h2>
                {byEntry.length === 0 ? (
                  <p className="dash-muted">No data</p>
                ) : byEntry.length === 1 && entryA ? (
                  <div className="dash-priority-grid">
                    <div className="dash-spot dash-spot-mid">
                      <strong>{entryA.count}</strong>
                      <span>{entryA.name}</span>
                    </div>
                  </div>
                ) : (
                  <div className="dash-priority-grid">
                    <div className="dash-priority-top">
                      {entryA && (
                        <div className="dash-spot dash-spot-urgent">
                          <strong>{entryA.count}</strong>
                          <span>{entryA.name}</span>
                        </div>
                      )}
                      {entryB && (
                        <div className="dash-spot dash-spot-high">
                          <strong>{entryB.count}</strong>
                          <span>{entryB.name}</span>
                        </div>
                      )}
                    </div>
                    {entryRestLabel && (
                      <div className="dash-spot dash-spot-mid">
                        <strong>{entryRestCount}</strong>
                        <span>{entryRestLabel}</span>
                      </div>
                    )}
                  </div>
                )}
              </article>

              <article className="dash-card">
                <h2>Top pathways</h2>
                <ul className="dash-assigned">
                  {byFlow.length === 0 && <li className="dash-muted">No data</li>}
                  {byFlow.slice(0, 7).map((f) => (
                    <li key={f.name}>
                      <span className="dash-assigned-name">{f.name}</span>
                      <div className="dash-bar-track">
                        <div
                          className="dash-bar-fill"
                          style={{ width: `${Math.max(10, (f.count / maxFlow) * 100)}%` }}
                        />
                      </div>
                      <strong className="dash-assigned-count">{f.count}</strong>
                    </li>
                  ))}
                </ul>
              </article>
            </section>


          </>
        )}
      </main>
    </div>
  )
}
