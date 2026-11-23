/** Small dependency-free SVG/CSS charts for the admin pages. */
import { useState } from 'react'

/* ---------- Smooth area chart (daily trend) ---------- */
export type AreaPoint = {
  label: string
  value: number
  highlight?: boolean
  /** Longer label for the hover tip (e.g. "Nov 3"). */
  tip?: string
  /** Same position in the comparison period (null = no data for that day). */
  prev?: number | null
  prevTip?: string
}

function smoothPath(pts: Array<[number, number]>): string {
  if (!pts.length) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = (x0 + x1) / 2
    d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`
  }
  return d
}

export function AreaChart({ points, height = 190 }: { points: AreaPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = points.length
  const max = Math.max(1, ...points.map((p) => Math.max(p.value, p.prev ?? 0)))
  const W = 100
  const H = 40
  const xy: Array<[number, number]> = points.map((p, i) => [
    n === 1 ? W / 2 : (i / (n - 1)) * W,
    H - (p.value / max) * (H - 4) - 2,
  ])
  const line = smoothPath(xy)
  // Comparison line: drawn in separate runs so a missing day leaves a gap.
  const prevRuns: Array<Array<[number, number]>> = []
  points.forEach((p, i) => {
    if (p.prev == null) {
      prevRuns.push([])
      return
    }
    const y = H - (p.prev / max) * (H - 4) - 2
    if (!prevRuns.length) prevRuns.push([])
    prevRuns[prevRuns.length - 1].push([xy[i][0], y])
  })
  const prevPaths = prevRuns.filter((r) => r.length > 1).map((r) => smoothPath(r))
  const area = n ? `${line} L ${xy[n - 1][0]} ${H} L ${xy[0][0]} ${H} Z` : ''
  const every = n > 20 ? Math.max(5, Math.ceil(n / 7)) : n > 10 ? 2 : 1
  const hi = points.findIndex((p) => p.highlight)
  const hp = hover !== null ? points[hover] : null
  return (
    <div className="dx-area" style={{ minHeight: height }}>
      <span className="dx-area-max">{max}</span>
      <div className="dx-area-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="dxAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="dx-area-grid" />
          ))}
          <path d={area} fill="url(#dxAreaFill)" />
          {prevPaths.map((d, i) => (
            <path key={i} d={d} className="dx-area-prev" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={line} className="dx-area-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {hover !== null && hp && hp.prev != null && (
          <span
            className="dx-area-dot dx-area-dot-prev"
            style={{
              left: `${(xy[hover][0] / W) * 100}%`,
              top: `${((H - (hp.prev / max) * (H - 4) - 2) / H) * 100}%`,
            }}
          />
        )}
        {hover !== null && (
          <span
            className="dx-area-dot"
            style={{ left: `${(xy[hover][0] / W) * 100}%`, top: `${(xy[hover][1] / H) * 100}%` }}
          />
        )}
        <div className="dx-area-hits" onMouseLeave={() => setHover(null)}>
          {points.map((p, i) => (
            <span
              key={i}
              onMouseEnter={() => setHover(i)}
              title={`${p.tip ?? p.label}: ${p.value}${p.prev != null ? ` (previous: ${p.prev})` : ''}`}
            />
          ))}
        </div>
        {hp && hover !== null && (
          <div
            className={`dx-area-tip${hover < n * 0.18 ? ' dx-tip-l' : hover > n * 0.82 ? ' dx-tip-r' : ''}`}
            style={{ left: `${(xy[hover][0] / W) * 100}%`, top: `${(xy[hover][1] / H) * 100}%` }}
          >
            <div>
              <strong>{hp.value}</strong> {hp.tip ?? hp.label}
            </div>
            {hp.prev != null && (
              <div className="dx-tip-prev">
                <strong>{hp.prev}</strong> {hp.prevTip ?? 'previous'}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="dx-area-x">
        {points.map((p, i) => (
          <span key={i} className={p.highlight ? 'dx-today' : undefined}>
            {p.highlight || (i % every === 0 && (hi < 0 || Math.abs(i - hi) >= Math.ceil(every / 2))) ? p.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- Heatmap (weekday x hour) ---------- */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'p' : 'a'}`

export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(0, ...grid.flat())
  // Show the working range that has data (at least 7am–6pm).
  let from = 7
  let to = 18
  grid.forEach((row) =>
    row.forEach((v, h) => {
      if (v > 0) {
        from = Math.min(from, h)
        to = Math.max(to, h)
      }
    }),
  )
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <div className="dx-heat" role="img" aria-label="Completions by weekday and hour">
      <div className="dx-heat-row dx-heat-head">
        <span />
        {hours.map((h) => (
          <span key={h}>{hourLabel(h)}</span>
        ))}
      </div>
      {grid.map((row, d) => (
        <div className="dx-heat-row" key={d}>
          <span className="dx-heat-day">{DAYS[d]}</span>
          {hours.map((h) => {
            const v = row[h]
            const a = v > 0 && max > 0 ? 0.14 + 0.86 * (v / max) : 0
            return (
              <i
                key={h}
                className={v > 0 ? 'dx-heat-on' : undefined}
                style={v > 0 ? { background: `rgba(29,78,216,${a.toFixed(2)})` } : undefined}
                title={`${DAYS[d]} ${hourLabel(h)}: ${v} completed`}
              />
            )
          })}
        </div>
      ))}
      <div className="dx-heat-legend">
        <span>Less</span>
        {[0.14, 0.35, 0.6, 0.85, 1].map((a) => (
          <i key={a} style={{ background: `rgba(29,78,216,${a})` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

/* ---------- Ring gauge ---------- */
export type RingSeg = { label: string; value: number; color: string }

export function Ring({ segs, big, small }: { segs: RingSeg[]; big: string; small: string }) {
  const total = segs.reduce((s, x) => s + x.value, 0)
  const r = 15.9155 // circumference ~100
  let acc = 0
  return (
    <svg className="dx-ring" viewBox="0 0 42 42" role="img" aria-label={`${big} ${small}`}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="#eef1f5" strokeWidth="5" />
      {total > 0 &&
        segs.map((s) => {
          const len = (s.value / total) * 100
          const el = (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="5"
              strokeDasharray={`${Math.max(len - 0.8, 0)} ${100 - Math.max(len - 0.8, 0)}`}
              strokeDashoffset={25 - acc}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          )
          acc += len
          return el
        })}
      <text x="21" y="21.5" textAnchor="middle" className="dx-ring-big">
        {big}
      </text>
      <text x="21" y="27" textAnchor="middle" className="dx-ring-small">
        {small}
      </text>
    </svg>
  )
}

/* ---------- Lollipop (median vs average) ---------- */
export type LollipopRow = { label: string; count: number; median: number; avg: number }

export function Lollipop({
  rows,
  format,
}: {
  rows: LollipopRow[]
  format: (m: number) => string
}) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.median, r.avg)))
  // Log scale so a 1-minute and a 3-day program can both be read on one track.
  const pos = (m: number) => (Math.log1p(Math.max(m, 0)) / Math.log1p(max)) * 100
  return (
    <div className="dx-lolli">
      <div className="dx-lolli-legend">
        <span><i className="dx-dot-median" /> Median</span>
        <span><i className="dx-dot-avg" /> Average</span>
        <em>log scale</em>
      </div>
      {rows.map((r) => {
        const a = pos(r.avg)
        const m = pos(r.median)
        return (
          <div className="dx-lolli-row" key={r.label}>
            <div className="dx-lolli-name">
              <strong>{r.label}</strong>
              <span>{r.count} {r.count === 1 ? 'case' : 'cases'}</span>
            </div>
            <div className="dx-lolli-track" title={`Median ${format(r.median)} · Average ${format(r.avg)}`}>
              <b style={{ left: `${Math.min(a, m)}%`, width: `${Math.abs(a - m)}%` }} />
              <i className="dx-dot-avg" style={{ left: `${a}%` }} />
              <i className="dx-dot-median" style={{ left: `${m}%` }} />
            </div>
            <div className="dx-lolli-val">
              <strong>{format(r.median)}</strong>
              <span>avg {format(r.avg)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Segmented stacked bar (outcomes) ---------- */
export function OutcomeBar({ segs, unit }: { segs: RingSeg[]; unit: string }) {
  const total = segs.reduce((s, x) => s + x.value, 0)
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const lead = segs[0]
  return (
    <div className="dx-ob">
      <div className="dx-ob-head">
        <strong>{total > 0 ? `${pct(lead.value)}%` : '—'}</strong>
        <span>
          {lead.label.toLowerCase()} · {lead.value} of {total} {unit}
        </span>
      </div>
      <div className="dx-ob-bar" role="img" aria-label={segs.map((g) => `${g.label} ${g.value}`).join(', ')}>
        {total > 0 &&
          segs
            .filter((g) => g.value > 0)
            .map((g) => (
              <span key={g.label} style={{ width: `${(g.value / total) * 100}%`, background: g.color }} title={`${g.label}: ${g.value} (${pct(g.value)}%)`} />
            ))}
      </div>
      <ul className="dx-ob-list">
        {segs.map((g) => (
          <li key={g.label}>
            <i style={{ background: g.color }} />
            <span>{g.label}</span>
            <strong>{g.value}</strong>
            <em>{pct(g.value)}%</em>
          </li>
        ))}
      </ul>
    </div>
  )
}
