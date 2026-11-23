/** Pure calculations for the Insights page (no network). */

import type { BenefitsCompletion, BenefitsEvent } from './benefitsStore'

export type ProgramTiming = {
  program: string
  count: number
  avgMin: number
  medianMin: number
}

function minutesBetween(startIso: string, endIso: string): number | null {
  const a = new Date(startIso).getTime()
  const b = new Date(endIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  // The server stamps "finished" while the start time comes from the staff computer's clock.
  // A small clock difference can make a quick case look negative: count it as ~0 minutes.
  if (b < a) return a - b <= 10 * 60000 ? 0 : null
  return (b - a) / 60000
}

function median(sorted: number[]): number {
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Average + median handling time per program (slowest first). */
export function timingByProgram(rows: BenefitsCompletion[]): ProgramTiming[] {
  const map = new Map<string, number[]>()
  for (const r of rows) {
    const m = minutesBetween(r.started_at || r.created_at, r.created_at)
    if (m === null) continue
    const k = r.program_name || r.program_id || 'Unknown'
    const arr = map.get(k)
    if (arr) arr.push(m)
    else map.set(k, [m])
  }
  return [...map.entries()]
    .map(([program, mins]) => {
      const sorted = [...mins].sort((a, b) => a - b)
      return {
        program,
        count: mins.length,
        avgMin: mins.reduce((s, x) => s + x, 0) / mins.length,
        medianMin: median(sorted),
      }
    })
    .sort((a, b) => b.medianMin - a.medianMin)
}

/** Completions per hour of day (0–23, browser local time). */
export function completionsByHour(rows: BenefitsCompletion[]): number[] {
  const hours = Array.from({ length: 24 }, () => 0)
  for (const r of rows) {
    const t = new Date(r.created_at)
    if (Number.isFinite(t.getTime())) hours[t.getHours()] += 1
  }
  return hours
}

export type StallPoint = {
  label: string
  program: string
  step: number | null
  pauses: number
  abandons: number
  total: number
}

/** Where flows are paused or abandoned (program + step). */
export function stallPoints(events: BenefitsEvent[]): StallPoint[] {
  const map = new Map<string, StallPoint>()
  for (const e of events) {
    if (e.event !== 'pause' && e.event !== 'abandon') continue
    const program = e.program_name || 'Before choosing a program'
    const step = e.program_name && e.step_index !== null ? e.step_index + 1 : null
    const key = `${program}|${step ?? '-'}`
    let p = map.get(key)
    if (!p) {
      p = {
        label: step ? `${program} · step ${step}` : program,
        program,
        step,
        pauses: 0,
        abandons: 0,
        total: 0,
      }
      map.set(key, p)
    }
    if (e.event === 'pause') p.pauses += 1
    else p.abandons += 1
    p.total += 1
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return '—'
  if (min < 1) return '<1m'
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h < 24) return `${h}h ${m}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export function formatHour(h: number | null | undefined): string {
  if (h === null || h === undefined) return '—'
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh} ${suffix}`
}

/* ------------------------------------------------------------------ */
/* Dashboard additions                                                 */
/* ------------------------------------------------------------------ */

export type Trend = { pct: number | null; dir: 'up' | 'down' | 'flat' }

/** Change of `cur` against `prev`, as a percentage (null when there is nothing to compare). */
export function trendPct(cur: number, prev: number): Trend {
  if (prev <= 0) return { pct: null, dir: cur > 0 ? 'up' : 'flat' }
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

export type DayCount = { key: string; label: string; tip: string; count: number; isToday: boolean }

/** A run of whole days: `end` is exclusive (the first day after the run). */
export type DaySpan = { start: Date; end: Date }

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Completions per day for every day in `span` (max 400 days). */
export function dailyCounts(rows: BenefitsCompletion[], span: DaySpan): DayCount[] {
  const todayKey = dayKey(new Date())
  const monthLike =
    span.start.getDate() === 1 &&
    span.end.getTime() === new Date(span.start.getFullYear(), span.start.getMonth() + 1, 1).getTime()
  const days: DayCount[] = []
  for (
    let d = new Date(span.start.getFullYear(), span.start.getMonth(), span.start.getDate());
    d < span.end && days.length < 400;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    const tip = d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
    days.push({
      key: dayKey(d),
      label: monthLike ? String(d.getDate()) : tip,
      tip,
      count: 0,
      isToday: dayKey(d) === todayKey,
    })
  }
  const map = new Map(days.map((d) => [d.key, d]))
  for (const r of rows) {
    const t = new Date(r.created_at)
    if (!Number.isFinite(t.getTime())) continue
    const d = map.get(dayKey(t))
    if (d) d.count += 1
  }
  return days
}

/** Completions by weekday (0 = Monday … 6 = Sunday) and hour (0–23). */
export function weekdayHourGrid(rows: BenefitsCompletion[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const r of rows) {
    const t = new Date(r.created_at)
    if (!Number.isFinite(t.getTime())) continue
    grid[(t.getDay() + 6) % 7][t.getHours()] += 1
  }
  return grid
}

export type SlowCase = { id: string; patient: string; program: string; minutes: number }

/** The longest start → finish cases. */
export function slowestCases(rows: BenefitsCompletion[], n: number): SlowCase[] {
  const out: SlowCase[] = []
  for (const r of rows) {
    const m = minutesBetween(r.started_at || r.created_at, r.created_at)
    if (m === null) continue
    out.push({
      id: String(r.id),
      patient: r.patient_name,
      program: r.program_name || r.program_id || 'Unknown',
      minutes: m,
    })
  }
  return out.sort((a, b) => b.minutes - a.minutes).slice(0, n)
}

export type RepeatPatient = { name: string; count: number; programs: string[] }

/** Patients who completed more than one program in the period. */
export function repeatPatients(rows: BenefitsCompletion[]): RepeatPatient[] {
  const map = new Map<string, RepeatPatient>()
  for (const r of rows) {
    const key = (r.patient_name || '').trim().toLowerCase()
    if (!key) continue
    let p = map.get(key)
    if (!p) {
      p = { name: r.patient_name.trim(), count: 0, programs: [] }
      map.set(key, p)
    }
    p.count += 1
    const prog = r.program_name || r.program_id || 'Unknown'
    if (!p.programs.includes(prog)) p.programs.push(prog)
  }
  return [...map.values()].filter((p) => p.count > 1).sort((a, b) => b.count - a.count)
}

/** Overall average + median handling time (minutes). */
export function handlingStats(rows: BenefitsCompletion[]): { avg: number; median: number } | null {
  const mins: number[] = []
  for (const r of rows) {
    const m = minutesBetween(r.started_at || r.created_at, r.created_at)
    if (m !== null) mins.push(m)
  }
  if (!mins.length) return null
  mins.sort((a, b) => a - b)
  return { avg: mins.reduce((s, x) => s + x, 0) / mins.length, median: median(mins) }
}

/* ---------- Cancellations ---------- */

export type CancelReasonStat = { reason: string; count: number }

/** Why cases were cancelled (events saved before reasons existed count as "No reason recorded"). */
export function cancelReasons(events: BenefitsEvent[]): CancelReasonStat[] {
  const map = new Map<string, number>()
  for (const e of events) {
    if (e.event !== 'abandon') continue
    const r = (e.reason || '').trim() || 'No reason recorded'
    map.set(r, (map.get(r) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}

export type CancelledCase = {
  id: string
  patient: string
  program: string
  step: number | null
  reason: string
  note: string
  by: string
  at: string
}

export function recentCancellations(events: BenefitsEvent[], n = 6): CancelledCase[] {
  return events
    .filter((e) => e.event === 'abandon')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, n)
    .map((e) => ({
      id: e.id,
      patient: e.patient_name || 'Patient',
      program: e.program_name || 'Before choosing a program',
      step: e.program_name && e.step_index !== null ? e.step_index + 1 : null,
      reason: (e.reason || '').trim() || 'No reason recorded',
      note: (e.note || '').trim(),
      by: e.actor_email || '',
      at: e.created_at,
    }))
}
