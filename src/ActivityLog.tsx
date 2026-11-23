import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from './AdminIcons'
import { BenefitsAuditEntry, fetchBenefitsAudit } from './lib/benefitsStore'

type Filter = 'all' | 'complete' | 'rename' | 'delete' | 'pause' | 'cancel' | 'reopen' | 'user'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'complete', label: 'Completed' },
  { id: 'rename', label: 'Renamed' },
  { id: 'delete', label: 'Deleted' },
  { id: 'pause', label: 'Paused' },
  { id: 'cancel', label: 'Cancelled' },
  { id: 'reopen', label: 'Reopened' },
  { id: 'user', label: 'Users' },
]

const LABEL: Record<string, string> = {
  complete: 'Completed',
  rename: 'Renamed',
  delete: 'Deleted',
  pause: 'Paused',
  cancel: 'Cancelled',
  reopen: 'Reopened',
  user_create: 'User added',
  user_remove: 'User removed',
  user_role: 'Role changed',
  user_reset: 'Password reset',
}

const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))

/** Reopening a record deletes + recreates it: show that pair as ONE "Reopened" line. */
function collapseReopens(rows: BenefitsAuditEntry[]): BenefitsAuditEntry[] {
  const out: BenefitsAuditEntry[] = []
  for (const r of rows) {
    if (r.action === 'delete') {
      const t = new Date(r.created_at).getTime()
      const twin = rows.find(
        (x) =>
          x.action === 'reopen' &&
          x.actor_email === r.actor_email &&
          x.patient_name === r.patient_name &&
          Math.abs(new Date(x.created_at).getTime() - t) < 15000,
      )
      if (twin) continue
    }
    out.push(r)
  }
  return out
}

function detailText(r: BenefitsAuditEntry): string {
  const d = r.detail || {}
  switch (r.action) {
    case 'rename':
      return `${str(d.from)} → ${str(d.to)}`
    case 'cancel': {
      const reason = str(d.reason) || 'No reason recorded'
      const note = str(d.note)
      return note ? `${reason} — ${note}` : reason
    }
    case 'pause':
    case 'reopen':
      return d.step_index !== undefined && d.step_index !== null ? `Step ${Number(d.step_index) + 1}` : ''
    case 'delete':
      return d.completed_by ? `Originally completed by ${str(d.completed_by).split('@')[0]}` : ''
    case 'user_create':
    case 'user_remove':
    case 'user_reset':
      return str(d.email)
    case 'user_role':
      return `${str(d.email)} → ${str(d.role)}`
    default:
      return ''
  }
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

export default function ActivityLog({ siteCode, siteName }: { siteCode: string; siteName: string }) {
  const [rows, setRows] = useState<BenefitsAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notReady, setNotReady] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchBenefitsAudit(siteCode)
    setRows(res.data)
    setNotReady(!!res.notReady)
    setError(res.error)
    setLoading(false)
  }, [siteCode])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return collapseReopens(rows).filter((r) => {
      if (filter === 'user' ? !r.action.startsWith('user_') : filter !== 'all' && r.action !== filter) return false
      if (!needle) return true
      return [r.patient_name, r.actor_email, r.program_name, detailText(r)].some((v) => (v || '').toLowerCase().includes(needle))
    })
  }, [rows, filter, q])

  const groups = useMemo(() => {
    const out: { day: string; items: BenefitsAuditEntry[] }[] = []
    for (const r of shown) {
      const d = dayLabel(r.created_at)
      const last = out[out.length - 1]
      if (last && last.day === d) last.items.push(r)
      else out.push({ day: d, items: [r] })
    }
    return out
  }, [shown])

  return (
    <>
      <div className="dash-toolbar">
        <div className="dash-toolbar-inner">
          <div className="dash-toolbar-title">
            <h1>Activity</h1>
            <p className="dash-period-text">Who did what · {siteName}</p>
          </div>
          <div className="dash-toolbar-actions">
            <button type="button" className="dash-btn-primary" onClick={() => void load()}>
              <Icon name="refresh" size={15} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <main className="dash-main">
        <div className="dash-content">
          <section className="dash-card ax-card" aria-label="Activity log">
            <div className="ax-tools">
              <div className="ax-chips" role="group" aria-label="Filter">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={filter === f.id ? 'ax-chip ax-chip-on' : 'ax-chip'}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <input
                type="search"
                className="ax-search"
                placeholder="Search patient, staff or program"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search activity"
              />
            </div>

            {notReady ? (
              <p className="ux-error" role="alert">
                The activity log isn't set up in this Supabase yet. Run <b>supabase-update-audit.sql</b> in the SQL Editor
                (see UPDATE-3-SETUP.md).
              </p>
            ) : error ? (
              <p className="ux-error" role="alert">{error}</p>
            ) : loading && rows.length === 0 ? (
              <p className="dash-muted">Loading activity…</p>
            ) : groups.length === 0 ? (
              <p className="dash-muted">
                {rows.length === 0
                  ? 'Nothing recorded yet. New activity appears here as staff work.'
                  : 'No activity matches this filter.'}
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.day} className="ax-day">
                  <h3>{g.day}</h3>
                  <ul>
                    {g.items.map((r) => (
                      <li key={r.id}>
                        <time>{timeLabel(r.created_at)}</time>
                        <span className={`ax-badge ax-${r.action.startsWith('user_') ? 'user' : r.action}`}>
                          {LABEL[r.action] ?? r.action}
                        </span>
                        <div className="ax-main">
                          <b>{r.patient_name || '—'}</b>
                          <span>{[r.program_name, detailText(r)].filter(Boolean).join(' · ')}</span>
                        </div>
                        <span className="ax-by" title={r.actor_email ?? ''}>
                          {r.actor_email ? r.actor_email.split('@')[0] : 'unknown'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
            {rows.length >= 600 && <p className="dash-muted">Showing the latest 600 entries.</p>}
          </section>
        </div>
      </main>
    </>
  )
}
