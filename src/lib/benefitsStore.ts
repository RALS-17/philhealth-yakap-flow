/**
 * Benefits Programs storage — same pattern as flow sessionStore + flowMonitor,
 * but isolated tables: benefits_sessions + benefits_completions.
 */

import { supabase, isSupabaseConfigured } from './supabase'

export type BenefitsSnapshot = {
  payType: 'cash' | 'hmo' | null
  patientName: string
  programId: string | null
  programName: string | null
  stepIndex: number
  path: string[]
  startedAt: string
}

export type BenefitsSession = {
  id: string
  patientName: string
  snapshot: BenefitsSnapshot
  createdAt: string
  updatedAt: string
  siteCode: string
}

export type BenefitsCompletion = {
  id: string
  patient_name: string
  program_id: string
  program_name: string
  path: string
  site_code: string
  started_at: string
  created_at: string
}

const SESSIONS_KEY = 'gcare-benefits-sessions-v1'
const COMPLETIONS_KEY = 'gcare-benefits-completions-v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_SESSIONS = 80

type SessionDbRow = {
  id: string
  label: string
  site_code: string | null
  snapshot: BenefitsSnapshot
  created_at: string
  updated_at: string
}

type CompletionDbRow = {
  id: number | string
  patient_name: string | null
  program_id: string | null
  program_name: string | null
  path: string | null
  site_code: string | null
  started_at: string | null
  created_at: string
}

function readSessionsLocal(): BenefitsSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as BenefitsSession[]
    const cutoff = Date.now() - MAX_AGE_MS
    return list.filter((s) => new Date(s.updatedAt).getTime() >= cutoff)
  } catch {
    return []
  }
}

function writeSessionsLocal(list: BenefitsSession[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, MAX_SESSIONS)))
  } catch {
    /* ignore */
  }
}

function readCompletionsLocal(): BenefitsCompletion[] {
  try {
    const raw = localStorage.getItem(COMPLETIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as BenefitsCompletion[]
  } catch {
    return []
  }
}

function writeCompletionsLocal(list: BenefitsCompletion[]) {
  try {
    localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(list.slice(0, 2000)))
  } catch {
    /* ignore */
  }
}

function rowToSession(row: SessionDbRow): BenefitsSession {
  return {
    id: row.id,
    patientName: row.label || 'Patient',
    siteCode: (row.site_code || 'gcmcc').toLowerCase(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    snapshot: row.snapshot || {
      payType: 'cash',
      patientName: row.label || 'Patient',
      programId: null,
      programName: null,
      stepIndex: 0,
      path: ['Start'],
      startedAt: row.created_at,
    },
  }
}

function cacheUpsertSession(session: BenefitsSession) {
  const others = readSessionsLocal().filter((s) => s.id !== session.id)
  writeSessionsLocal([session, ...others])
}

export function newBenefitsSessionId(): string {
  return `ben-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export async function listBenefitsSessions(siteCode?: string): Promise<BenefitsSession[]> {
  const site = siteCode?.toLowerCase()

  if (isSupabaseConfigured() && supabase) {
    try {
      const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString()
      let q = supabase
        .from('benefits_sessions')
        .select('id, label, site_code, snapshot, created_at, updated_at')
        .gte('updated_at', cutoff)
        .order('updated_at', { ascending: false })
        .limit(MAX_SESSIONS)

      if (site) q = q.eq('site_code', site)

      const { data, error } = await q

      if (error) {
        console.warn('[benefitsStore] listSessions remote error', error.message)
        return filterLocalSessions(site)
      }

      const sessions = ((data as SessionDbRow[]) || []).map(rowToSession)
      const others = readSessionsLocal().filter((s) => site && s.siteCode && s.siteCode !== site)
      writeSessionsLocal([...sessions, ...others])
      return sessions
    } catch (err) {
      console.error('[benefitsStore] listSessions failed', err)
      return filterLocalSessions(site)
    }
  }
  return filterLocalSessions(site)
}

function filterLocalSessions(site?: string): BenefitsSession[] {
  const all = readSessionsLocal()
  if (!site) return all
  return all.filter((s) => !s.siteCode || s.siteCode === site)
}

export async function upsertBenefitsSession(
  id: string,
  patientName: string,
  snapshot: BenefitsSnapshot,
  siteCode: string,
): Promise<BenefitsSession> {
  const now = new Date().toISOString()
  const site = (siteCode || 'gcmcc').toLowerCase()
  const localExisting = readSessionsLocal().find((s) => s.id === id)
  const next: BenefitsSession = {
    id,
    patientName: patientName.trim() || 'Patient',
    snapshot,
    createdAt: localExisting?.createdAt ?? now,
    updatedAt: now,
    siteCode: site,
  }

  cacheUpsertSession(next)

  if (isSupabaseConfigured() && supabase) {
    try {
      const payload = {
        id: next.id,
        label: next.patientName,
        site_code: site,
        snapshot: next.snapshot,
        created_at: next.createdAt,
        updated_at: next.updatedAt,
      }
      const { error } = await supabase.from('benefits_sessions').upsert(payload, { onConflict: 'id' })
      if (error) {
        console.warn('[benefitsStore] upsertSession remote error', error.message)
      }
    } catch (err) {
      console.error('[benefitsStore] upsertSession failed', err)
    }
  }

  return next
}

export async function deleteBenefitsSession(id: string): Promise<void> {
  writeSessionsLocal(readSessionsLocal().filter((s) => s.id !== id))

  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('benefits_sessions').delete().eq('id', id)
      if (error) {
        console.warn('[benefitsStore] deleteSession remote error', error.message)
      }
    } catch (err) {
      console.error('[benefitsStore] deleteSession failed', err)
    }
  }
}

export async function saveBenefitsCompletion(payload: {
  patient_name: string
  program_id: string
  program_name: string
  path: string
  site_code: string
  started_at?: string
}): Promise<boolean> {
  const createdAt = new Date().toISOString()
  const row: BenefitsCompletion = {
    id: `bc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    patient_name: payload.patient_name,
    program_id: payload.program_id,
    program_name: payload.program_name,
    path: payload.path,
    site_code: (payload.site_code || 'gcmcc').toLowerCase(),
    started_at: payload.started_at || createdAt,
    created_at: createdAt,
  }

  const local = readCompletionsLocal()
  const recentDup = local.find((c) => {
    if (c.patient_name !== row.patient_name) return false
    if (c.program_id !== row.program_id) return false
    if (c.path !== row.path) return false
    const dt = Math.abs(new Date(c.created_at).getTime() - new Date(row.created_at).getTime())
    return dt < 10_000
  })
  if (!recentDup) {
    writeCompletionsLocal([row, ...local])
  }

  if (!isSupabaseConfigured() || !supabase) {
    if (import.meta.env.DEV) {
      console.info('[benefitsStore] Supabase not configured — local only', row)
    }
    return !recentDup
  }

  try {
    const since = new Date(Date.now() - 10_000).toISOString()
    const { data: existing } = await supabase
      .from('benefits_completions')
      .select('id, created_at')
      .eq('site_code', row.site_code)
      .eq('patient_name', row.patient_name)
      .eq('program_id', row.program_id)
      .eq('path', row.path)
      .gte('created_at', since)
      .limit(1)

    if (existing && existing.length > 0) {
      return true
    }

    const { error } = await supabase.from('benefits_completions').insert([
      {
        patient_name: row.patient_name,
        program_id: row.program_id,
        program_name: row.program_name,
        path: row.path,
        site_code: row.site_code,
        started_at: row.started_at,
      },
    ])

    if (error) {
      console.error('[benefitsStore] Failed to save completion', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[benefitsStore] saveCompletion failed', err)
    return false
  }
}

export async function fetchBenefitsCompletions(
  siteCode?: string,
): Promise<{ data: BenefitsCompletion[]; error: string | null }> {
  const site = siteCode?.toLowerCase() || null
  let remote: BenefitsCompletion[] = []
  let remoteError: string | null = null

  if (isSupabaseConfigured() && supabase) {
    try {
      let q = supabase
        .from('benefits_completions')
        .select('id, patient_name, program_id, program_name, path, site_code, started_at, created_at')
        .order('created_at', { ascending: false })
        .limit(2000)

      if (site) q = q.eq('site_code', site)

      const { data, error } = await q

      if (error) {
        remoteError = error.message
        console.warn('[benefitsStore] fetchCompletions remote error', error.message)
      } else if (data) {
        remote = (data as CompletionDbRow[]).map((r) => ({
          id: String(r.id),
          patient_name: r.patient_name || 'Patient',
          program_id: r.program_id || '',
          program_name: r.program_name || '',
          path: r.path || '',
          site_code: r.site_code || '',
          started_at: r.started_at || r.created_at,
          created_at: r.created_at,
        }))
      }
    } catch (err) {
      remoteError = err instanceof Error ? err.message : 'Fetch failed'
      console.error('[benefitsStore] fetchCompletions failed', err)
    }
  } else {
    remoteError = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  }

  let data =
    remote.length > 0
      ? remote
      : readCompletionsLocal().filter((c) => !site || c.site_code === site)

  if (remote.length > 0) {
    const local = readCompletionsLocal().filter((c) => !site || c.site_code === site)
    const remoteKeys = new Set(
      remote.map((r) => `${r.patient_name}|${r.program_id}|${r.path}|${r.created_at.slice(0, 19)}`),
    )
    for (const c of local) {
      const key = `${c.patient_name}|${c.program_id}|${c.path}|${c.created_at.slice(0, 19)}`
      if (remoteKeys.has(key)) continue
      if (Date.now() - new Date(c.created_at).getTime() < 120_000) {
        data = [c, ...data]
      }
    }
  }

  const cleaned: BenefitsCompletion[] = []
  for (const c of data) {
    const dup = cleaned.find((x) => {
      if (x.patient_name !== c.patient_name) return false
      if (x.program_id !== c.program_id && x.program_name !== c.program_name) return false
      if (x.path !== c.path) return false
      return Math.abs(new Date(x.created_at).getTime() - new Date(c.created_at).getTime()) < 10_000
    })
    if (!dup) cleaned.push(c)
  }

  return { data: cleaned, error: remote.length === 0 ? remoteError : null }
}

export function formatDuration(fromIso: string, toIso?: string): string {
  const start = new Date(fromIso).getTime()
  const end = toIso ? new Date(toIso).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—'
  const mins = Math.floor((end - start) / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 24) return `${h}h ${m}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}
