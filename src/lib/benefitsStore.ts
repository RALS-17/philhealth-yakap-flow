/**
 * Benefits Programs storage.
 *
 * - Everything is saved on this device first, then pushed to Supabase through a
 *   persistent SYNC QUEUE that retries automatically (back online, every 20 s, manual).
 * - Completions are protected from duplicates in the database (unique case key + upsert).
 * - Paused sessions expire after 15 days; they can be extended ("Keep").
 * - Finished records can be renamed / reopened for a short window.
 * - Pause / abandon / finish events feed the Insights page.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { BRANCH_CODE } from './branchConfig'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Paused sessions disappear after this long without activity. */
export const SESSION_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000
/** Warn when a paused session has less than this left. */
export const SESSION_WARN_MS = 48 * 60 * 60 * 1000
/** Staff can rename / reopen a finished record for this long (must match the SQL policy). */
export const COMPLETION_EDIT_WINDOW_MS = 30 * 60 * 1000

const MAX_SESSIONS = 80
const SESSIONS_KEY = 'gcare-benefits-sessions-v1' + '-' + BRANCH_CODE
const COMPLETIONS_KEY = 'gcare-benefits-completions-v1' + '-' + BRANCH_CODE
const QUEUE_KEY = 'gcare-benefits-sync-queue-v1' + '-' + BRANCH_CODE
const MAX_ATTEMPTS = 5
const RETRY_INTERVAL_MS = 20_000

export type SyncResult = {
  ok: boolean
  localOnly: boolean
  message?: string
  row?: BenefitsCompletion
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Build a short, readable path for lists (dedupe consecutive, strip stray arrows). */
export function formatBenefitsDisplayPath(raw: string | string[]): string {
  const parts = (Array.isArray(raw) ? raw : raw.split('→')).map((p) =>
    p.replace(/^[\s→]+|[\s→]+$/g, '').trim(),
  )
  const out: string[] = []
  for (const p of parts) {
    if (!p) continue
    if (p.toUpperCase() === 'END') continue
    if (out.length && out[out.length - 1].toLowerCase() === p.toLowerCase()) continue
    out.push(p)
  }
  if (!out.length) return 'END'
  return [...out, 'END'].join(' → ')
}

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
  /** Who finished it / last edited it (filled by the database; empty on old rows). */
  created_by?: string | null
  updated_by?: string | null
  updated_at?: string | null
}

export type BenefitsEventType = 'pause' | 'abandon' | 'finish' | 'reopen'

export type BenefitsEvent = {
  id: string
  site_code: string
  session_id: string | null
  event: BenefitsEventType
  program_id: string | null
  program_name: string | null
  step_index: number | null
  created_at: string
  patient_name?: string | null
  reason?: string | null
  note?: string | null
  actor_email?: string | null
}

export type BenefitsAuditAction =
  | 'complete'
  | 'rename'
  | 'delete'
  | 'pause'
  | 'cancel'
  | 'reopen'
  | 'user_create'
  | 'user_remove'
  | 'user_role'
  | 'user_reset'

export type BenefitsAuditEntry = {
  id: string
  site_code: string
  action: BenefitsAuditAction | string
  actor_email: string | null
  patient_name: string | null
  program_id: string | null
  program_name: string | null
  detail: Record<string, unknown>
  created_at: string
}

/** Reasons offered when staff cancel a patient (shown in Insights). */
export const CANCEL_REASONS = [
  'Patient declined / changed mind',
  'Patient left or did not return',
  'Incomplete documents',
  'Not eligible for the program',
  'Wrong program or wrong patient',
  'Duplicate entry',
  'Transferred / referred elsewhere',
  'Other',
] as const

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
  created_by?: string | null
  updated_by?: string | null
  updated_at?: string | null
}

/* ------------------------------------------------------------------ */
/* Local cache                                                         */
/* ------------------------------------------------------------------ */

function readSessionsLocal(): BenefitsSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as BenefitsSession[]
    const cutoff = Date.now() - SESSION_MAX_AGE_MS
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

/** Removes cached patient data from this browser (call on logout). The unsynced queue is kept. */
export function clearBenefitsLocalCache() {
  try {
    localStorage.removeItem(SESSIONS_KEY)
    localStorage.removeItem(COMPLETIONS_KEY)
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

/* ------------------------------------------------------------------ */
/* Sync queue                                                          */
/* ------------------------------------------------------------------ */

type CompletionKey = {
  site_code: string
  patient_name: string
  program_id: string
  started_at: string
}

type CompletionInsert = CompletionKey & {
  program_name: string
  path: string
  clientCreatedAt: string
}

type EventInsert = {
  site_code: string
  session_id: string | null
  event: BenefitsEventType
  program_id: string | null
  program_name: string | null
  step_index: number | null
  created_at: string
  patient_name?: string | null
  reason?: string | null
  note?: string | null
}

/** Columns added by supabase-update-audit.sql — older databases don't have them yet. */
const EVENT_EXTRA = ['patient_name', 'reason', 'note'] as const

type QueueOp =
  | { kind: 'completion-insert'; row: CompletionInsert }
  | { kind: 'completion-rename'; key: CompletionKey; newName: string; newPath: string }
  | { kind: 'completion-delete'; key: CompletionKey }
  | { kind: 'session-upsert'; session: BenefitsSession; createdKnown: boolean }
  | { kind: 'session-delete'; id: string }
  | { kind: 'event'; event: EventInsert }

type QueueItem = {
  qid: string
  op: QueueOp
  attempts: number
  failed?: boolean
  lastError?: string
}

export type SyncStatus = {
  /** Waiting to upload (will retry automatically). */
  pending: number
  /** Gave up after several server rejections — needs attention / manual retry. */
  failed: number
  syncing: boolean
  online: boolean
  lastError: string | null
}

function newQid(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function readQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as QueueItem[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeQueue(list: QueueItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

let syncing = false
let lastError: string | null = null
const listeners = new Set<(s: SyncStatus) => void>()

export function getSyncStatus(): SyncStatus {
  const q = readQueue()
  return {
    pending: q.filter((i) => !i.failed).length,
    failed: q.filter((i) => i.failed).length,
    syncing,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastError,
  }
}

function emit() {
  const s = getSyncStatus()
  listeners.forEach((fn) => fn(s))
}

export function subscribeSync(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function enqueue(op: QueueOp): string {
  const q = readQueue()
  let qid = newQid()

  if (op.kind === 'session-upsert') {
    // Auto-save fires often: keep only the newest upsert per session.
    const sid = op.session.id
    const idx = q.findIndex((i) => i.op.kind === 'session-upsert' && i.op.session.id === sid)
    if (idx >= 0) {
      q[idx] = { qid, op, attempts: 0 } // fresh qid so an in-flight older send cannot remove it
      writeQueue(q)
      emit()
      return qid
    }
  }

  if (op.kind === 'session-delete') {
    // No point uploading an edit for a session that is being deleted.
    const delId = op.id
    const kept = q.filter((i) => !(i.op.kind === 'session-upsert' && i.op.session.id === delId))
    kept.push({ qid, op, attempts: 0 })
    writeQueue(kept)
    emit()
    return qid
  }

  q.push({ qid, op, attempts: 0 })
  writeQueue(q)
  emit()
  return qid
}

function isQueued(qid: string): boolean {
  return readQueue().some((i) => i.qid === qid)
}

function isMissingColumn(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    /column .*(does not exist|not found)|schema cache/i.test(err.message || '')
  )
}

const COMPLETION_COLS = 'id, patient_name, program_id, program_name, path, site_code, started_at, created_at'
const COMPLETION_AUDIT_COLS = COMPLETION_COLS + ', created_by, updated_by, updated_at'
let completionAuditCols = true
const EVENT_COLS = 'id, site_code, session_id, event, program_id, program_name, step_index, created_at'
const EVENT_AUDIT_COLS = EVENT_COLS + ', patient_name, reason, note, actor_email'
let eventAuditCols = true

/** Runs a completions query with the audit columns; falls back if the DB isn't updated yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryCompletions(build: (cols: string) => PromiseLike<{ data: any; error: any }>) {
  if (completionAuditCols) {
    const r = await build(COMPLETION_AUDIT_COLS)
    if (!r.error || !isMissingColumn(r.error)) return r
    completionAuditCols = false
  }
  return build(COMPLETION_COLS)
}

type OpResult = { ok: true } | { ok: false; transient: boolean; message: string }

function isTransient(err: { message?: string; code?: string }): boolean {
  const code = err.code || ''
  if (!code) return true // fetch failed / offline
  if (/^PGRST00[0-3]$/.test(code) || code === 'PGRST301' || code === 'PGRST303') return true
  if (code.startsWith('08') || code.startsWith('57')) return true
  return /failed to fetch|network|timeout/i.test(err.message || '')
}

async function executeOp(op: QueueOp): Promise<OpResult> {
  if (!supabase) return { ok: false, transient: true, message: 'Server not configured' }
  try {
    const sess = await supabase.auth.getSession()
    if (!sess.data.session) return { ok: false, transient: true, message: 'Not signed in' }

    let error: { message: string; code?: string } | null = null
    switch (op.kind) {
      case 'completion-insert': {
        const r = await supabase.from('benefits_completions').upsert(
          [
            {
              patient_name: op.row.patient_name,
              program_id: op.row.program_id,
              program_name: op.row.program_name,
              path: op.row.path,
              site_code: op.row.site_code,
              started_at: op.row.started_at,
            },
          ],
          { onConflict: 'site_code,patient_name,program_id,started_at', ignoreDuplicates: true },
        )
        error = r.error
        break
      }
      case 'completion-rename': {
        const r = await supabase
          .from('benefits_completions')
          .update({ patient_name: op.newName, path: op.newPath })
          .match(op.key)
        error = r.error
        break
      }
      case 'completion-delete': {
        const r = await supabase.from('benefits_completions').delete().match(op.key)
        error = r.error
        break
      }
      case 'session-upsert': {
        const s = op.session
        const payload: Record<string, unknown> = {
          id: s.id,
          label: s.patientName,
          site_code: s.siteCode,
          snapshot: s.snapshot,
          updated_at: s.updatedAt,
        }
        if (op.createdKnown) payload.created_at = s.createdAt
        const r = await supabase.from('benefits_sessions').upsert(payload, { onConflict: 'id' })
        error = r.error
        break
      }
      case 'session-delete': {
        const r = await supabase.from('benefits_sessions').delete().eq('id', op.id)
        error = r.error
        break
      }
      case 'event': {
        let r = await supabase.from('benefits_events').insert([op.event])
        if (r.error && isMissingColumn(r.error)) {
          // Database not updated yet (supabase-update-audit.sql): save without the new fields.
          const slim: Record<string, unknown> = { ...op.event }
          for (const k of EVENT_EXTRA) delete slim[k]
          r = await supabase.from('benefits_events').insert([slim])
        }
        error = r.error
        break
      }
    }
    if (!error) return { ok: true }
    return { ok: false, transient: isTransient(error), message: error.message }
  } catch (err) {
    return {
      ok: false,
      transient: true,
      message: err instanceof Error ? err.message : 'Network error',
    }
  }
}

async function flushOnce() {
  const tried = new Set<string>()
  for (;;) {
    const item = readQueue().find((i) => !i.failed && !tried.has(i.qid))
    if (!item) break
    tried.add(item.qid)
    const res = await executeOp(item.op)
    if (res.ok) {
      writeQueue(readQueue().filter((i) => i.qid !== item.qid))
      lastError = null
      emit()
      continue
    }
    lastError = res.message
    if (res.transient) break // offline / signed out: stop, retry later
    // Server rejected it (policy / constraint / missing table): count the attempt.
    const q = readQueue()
    const idx = q.findIndex((i) => i.qid === item.qid)
    if (idx >= 0) {
      const attempts = q[idx].attempts + 1
      q[idx] = {
        ...q[idx],
        attempts,
        lastError: res.message,
        failed: attempts >= MAX_ATTEMPTS ? true : undefined,
      }
      writeQueue(q)
    }
    emit()
  }
}

let flushPromise: Promise<void> | null = null
let rerun = false

/** Uploads everything waiting in the queue. Safe to call anytime; calls are coalesced. */
export function flushQueue(): Promise<void> {
  if (flushPromise) {
    rerun = true
    return flushPromise
  }
  syncing = true
  emit()
  flushPromise = (async () => {
    try {
      do {
        rerun = false
        await flushOnce()
      } while (rerun)
    } finally {
      syncing = false
      flushPromise = null
      emit()
    }
  })()
  return flushPromise
}

/** Gives failed items another chance (manual "retry" button). */
export async function retryFailedSync(): Promise<void> {
  writeQueue(
    readQueue().map((i) =>
      i.failed ? { ...i, failed: undefined, attempts: 0, lastError: undefined } : i,
    ),
  )
  emit()
  await flushQueue()
}

let started = false

/** Starts the automatic retries (idempotent). */
export function startBenefitsSync() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => {
    emit()
    void flushQueue()
  })
  window.addEventListener('offline', () => emit())
  window.setInterval(() => {
    if (getSyncStatus().pending > 0 && navigator.onLine) void flushQueue()
  }, RETRY_INTERVAL_MS)
  void flushQueue()
}

/* ------------------------------------------------------------------ */
/* Overlays: show not-yet-uploaded changes in every list               */
/* ------------------------------------------------------------------ */

function overlaySessions(remote: BenefitsSession[], site?: string): BenefitsSession[] {
  const map = new Map(remote.map((s) => [s.id, s]))
  for (const item of readQueue()) {
    const op = item.op
    if (op.kind === 'session-upsert') {
      if (site && op.session.siteCode !== site) continue
      map.set(op.session.id, op.session)
    } else if (op.kind === 'session-delete') {
      map.delete(op.id)
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

function keyOf(c: BenefitsCompletion): CompletionKey {
  return {
    site_code: c.site_code,
    patient_name: c.patient_name,
    program_id: c.program_id,
    started_at: c.started_at,
  }
}

/** Same finished case? (matches the local optimistic row with the server row) */
function sameCompletion(a: BenefitsCompletion, b: BenefitsCompletion): boolean {
  if (a.site_code !== b.site_code || a.patient_name !== b.patient_name) return false
  if (a.program_id !== b.program_id || a.path !== b.path) return false
  const startA = new Date(a.started_at).getTime()
  const startB = new Date(b.started_at).getTime()
  if (Number.isFinite(startA) && Number.isFinite(startB)) {
    return Math.abs(startA - startB) < 1000
  }
  return Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 10000
}

function sameKey(c: BenefitsCompletion, k: CompletionKey): boolean {
  if (c.site_code !== k.site_code || c.patient_name !== k.patient_name) return false
  if (c.program_id !== k.program_id) return false
  const a = new Date(c.started_at).getTime()
  const b = new Date(k.started_at).getTime()
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) < 1000 : false
}

function overlayCompletions(rows: BenefitsCompletion[], site?: string | null): BenefitsCompletion[] {
  let out = [...rows]
  for (const item of readQueue()) {
    const op = item.op
    if (op.kind === 'completion-insert') {
      if (site && op.row.site_code !== site) continue
      const row: BenefitsCompletion = {
        id: `pending-${item.qid}`,
        patient_name: op.row.patient_name,
        program_id: op.row.program_id,
        program_name: op.row.program_name,
        path: op.row.path,
        site_code: op.row.site_code,
        started_at: op.row.started_at,
        created_at: op.row.clientCreatedAt,
      }
      if (!out.some((x) => sameCompletion(x, row))) out = [row, ...out]
    } else if (op.kind === 'completion-rename') {
      out = out.map((x) =>
        sameKey(x, op.key) ? { ...x, patient_name: op.newName, path: op.newPath } : x,
      )
    } else if (op.kind === 'completion-delete') {
      out = out.filter((x) => !sameKey(x, op.key))
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export function newBenefitsSessionId(): string {
  return `ben-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Milliseconds until a paused session expires (negative = already expired). */
export function sessionTimeLeftMs(s: BenefitsSession): number {
  return new Date(s.updatedAt || s.createdAt).getTime() + SESSION_MAX_AGE_MS - Date.now()
}

export function isSessionExpiringSoon(s: BenefitsSession): boolean {
  return sessionTimeLeftMs(s) <= SESSION_WARN_MS
}

/** "5d 3h", "7h", "40m" */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'expired'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

function filterLocalSessions(site?: string): BenefitsSession[] {
  const all = readSessionsLocal()
  if (!site) return all
  return all.filter((s) => !s.siteCode || s.siteCode === site)
}

export async function listBenefitsSessions(siteCode?: string): Promise<BenefitsSession[]> {
  const site = siteCode?.toLowerCase()

  if (isSupabaseConfigured() && supabase) {
    try {
      const cutoff = new Date(Date.now() - SESSION_MAX_AGE_MS).toISOString()
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
        return overlaySessions(filterLocalSessions(site), site)
      }

      const sessions = overlaySessions(((data as SessionDbRow[]) || []).map(rowToSession), site)
      const others = readSessionsLocal().filter((s) => site && s.siteCode && s.siteCode !== site)
      writeSessionsLocal([...sessions, ...others])
      return sessions
    } catch (err) {
      console.error('[benefitsStore] listSessions failed', err)
      return overlaySessions(filterLocalSessions(site), site)
    }
  }
  return filterLocalSessions(site)
}

export async function upsertBenefitsSession(
  id: string,
  patientName: string,
  snapshot: BenefitsSnapshot,
  siteCode: string,
  opts?: { createdAt?: string },
): Promise<BenefitsSession> {
  const now = new Date().toISOString()
  const site = (siteCode || 'gcmcc').toLowerCase()
  const localExisting = readSessionsLocal().find((s) => s.id === id)
  const knownCreated = opts?.createdAt ?? localExisting?.createdAt
  const next: BenefitsSession = {
    id,
    patientName: patientName.trim() || 'Patient',
    snapshot,
    createdAt: knownCreated ?? now,
    updatedAt: now,
    siteCode: site,
  }

  cacheUpsertSession(next)

  if (!isSupabaseConfigured() || !supabase) {
    return Object.assign(next, { localOnly: true as const, syncMessage: 'Server not configured' })
  }

  const qid = enqueue({ kind: 'session-upsert', session: next, createdKnown: Boolean(knownCreated) })
  await flushQueue()
  const pending = isQueued(qid)
  return Object.assign(next, {
    localOnly: pending,
    syncMessage: pending ? lastError || 'Will sync when online' : undefined,
  })
}

/** Resets the 15-day expiry of a paused session ("Keep"). */
export async function extendBenefitsSession(s: BenefitsSession): Promise<BenefitsSession> {
  return upsertBenefitsSession(s.id, s.patientName, s.snapshot, s.siteCode, {
    createdAt: s.createdAt,
  })
}

export async function deleteBenefitsSession(id: string): Promise<void> {
  writeSessionsLocal(readSessionsLocal().filter((s) => s.id !== id))
  if (!isSupabaseConfigured() || !supabase) return
  enqueue({ kind: 'session-delete', id })
  await flushQueue()
}

/* ------------------------------------------------------------------ */
/* Events (pause / abandon / finish / reopen)                          */
/* ------------------------------------------------------------------ */

export function logBenefitsEvent(e: {
  site_code: string
  session_id?: string | null
  event: BenefitsEventType
  program_id?: string | null
  program_name?: string | null
  step_index?: number | null
  patient_name?: string | null
  reason?: string | null
  note?: string | null
}) {
  if (!isSupabaseConfigured() || !supabase) return
  enqueue({
    kind: 'event',
    event: {
      site_code: (e.site_code || 'gcmcc').toLowerCase(),
      session_id: e.session_id ?? null,
      event: e.event,
      program_id: e.program_id ?? null,
      program_name: e.program_name ?? null,
      step_index: e.step_index ?? null,
      patient_name: e.patient_name ?? null,
      reason: e.reason ?? null,
      note: e.note ?? null,
      created_at: new Date().toISOString(),
    },
  })
  void flushQueue()
}

export async function fetchBenefitsEvents(
  siteCode: string,
): Promise<{ data: BenefitsEvent[]; error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: [], error: 'Server not configured' }
  }
  try {
    const build = (cols: string) =>
      supabase!
        .from('benefits_events')
        .select(cols)
        .eq('site_code', siteCode.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(5000)
    let res = await build(eventAuditCols ? EVENT_AUDIT_COLS : EVENT_COLS)
    if (res.error && eventAuditCols && isMissingColumn(res.error)) {
      eventAuditCols = false
      res = await build(EVENT_COLS)
    }
    const { data, error } = res
    if (error) return { data: [], error: error.message }
    return {
      data: ((data as unknown as BenefitsEvent[]) || []).map((r) => ({ ...r, id: String(r.id) })),
      error: null,
    }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Fetch failed' }
  }
}

/* ------------------------------------------------------------------ */
/* Completions                                                         */
/* ------------------------------------------------------------------ */

export async function saveBenefitsCompletion(payload: {
  patient_name: string
  program_id: string
  program_name: string
  path: string
  site_code: string
  started_at?: string
}): Promise<SyncResult> {
  const createdAt = new Date().toISOString()
  const displayPath = formatBenefitsDisplayPath(payload.path)
  const row: BenefitsCompletion = {
    id: `bc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    patient_name: payload.patient_name,
    program_id: payload.program_id,
    program_name: payload.program_name,
    path: displayPath,
    site_code: (payload.site_code || 'gcmcc').toLowerCase(),
    started_at: payload.started_at || createdAt,
    created_at: createdAt,
  }

  const local = readCompletionsLocal()
  if (!local.some((c) => sameCompletion(c, row))) {
    writeCompletionsLocal([row, ...local])
  }

  if (!isSupabaseConfigured() || !supabase) {
    return {
      ok: true,
      localOnly: true,
      message: 'Saved on this device only — server is not configured',
      row,
    }
  }

  const qid = enqueue({
    kind: 'completion-insert',
    row: {
      ...keyOf(row),
      program_name: row.program_name,
      path: row.path,
      clientCreatedAt: row.created_at,
    },
  })
  await flushQueue()
  if (isQueued(qid)) {
    return {
      ok: true,
      localOnly: true,
      message: 'Saved on this device only — will sync automatically when online',
      row,
    }
  }
  return { ok: true, localOnly: false, row }
}

/** Is this finished record still inside the edit / reopen window? */
export function canEditCompletion(c: Pick<BenefitsCompletion, 'created_at'>): boolean {
  const t = new Date(c.created_at).getTime()
  return Number.isFinite(t) && Date.now() - t < COMPLETION_EDIT_WINDOW_MS
}

/** Correct the patient name of a finished record. */
export async function renameBenefitsCompletion(
  c: BenefitsCompletion,
  newName: string,
): Promise<SyncResult> {
  const name = newName.trim()
  if (!name) return { ok: false, localOnly: false, message: 'Name cannot be empty.' }
  const oldName = c.patient_name
  const newPath = formatBenefitsDisplayPath(
    c.path.split('→').map((p) => (p.trim() === oldName ? name : p.trim())),
  )

  writeCompletionsLocal(
    readCompletionsLocal().map((x) =>
      sameKey(x, keyOf(c)) ? { ...x, patient_name: name, path: newPath } : x,
    ),
  )

  const updated: BenefitsCompletion = { ...c, patient_name: name, path: newPath }
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: true, localOnly: true, message: 'Saved on this device only', row: updated }
  }
  const qid = enqueue({ kind: 'completion-rename', key: keyOf(c), newName: name, newPath })
  await flushQueue()
  return isQueued(qid)
    ? { ok: true, localOnly: true, message: 'Name changed here — will sync when online', row: updated }
    : { ok: true, localOnly: false, row: updated }
}

/** Removes a finished record (used when it is reopened). */
export async function deleteBenefitsCompletion(c: BenefitsCompletion): Promise<SyncResult> {
  writeCompletionsLocal(readCompletionsLocal().filter((x) => !sameKey(x, keyOf(c))))
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: true, localOnly: true }
  }
  const qid = enqueue({ kind: 'completion-delete', key: keyOf(c) })
  await flushQueue()
  return { ok: true, localOnly: isQueued(qid) }
}

/** Records finished within `windowMs` (for the "Recently completed" list). */
export async function fetchRecentBenefitsCompletions(
  siteCode: string,
  windowMs: number = COMPLETION_EDIT_WINDOW_MS,
): Promise<BenefitsCompletion[]> {
  const site = siteCode.toLowerCase()
  const sinceMs = Date.now() - windowMs
  let remote: BenefitsCompletion[] = []
  let remoteOk = false

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await queryCompletions((cols) =>
        supabase!
          .from('benefits_completions')
          .select(cols)
          .eq('site_code', site)
          .gte('created_at', new Date(sinceMs).toISOString())
          .order('created_at', { ascending: false })
          .limit(50),
      )
      if (!error && data) {
        remoteOk = true
        remote = (data as CompletionDbRow[]).map(dbToCompletion)
      }
    } catch {
      /* fall back to local */
    }
  }

  const base = remoteOk
    ? remote
    : readCompletionsLocal().filter((c) => c.site_code === site)
  return overlayCompletions(base, site)
    .filter((c) => new Date(c.created_at).getTime() >= sinceMs)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function dbToCompletion(r: CompletionDbRow): BenefitsCompletion {
  return {
    id: String(r.id),
    patient_name: r.patient_name || 'Patient',
    program_id: r.program_id || '',
    program_name: r.program_name || '',
    path: r.path || '',
    site_code: r.site_code || '',
    started_at: r.started_at || r.created_at,
    created_at: r.created_at,
    created_by: r.created_by ?? null,
    updated_by: r.updated_by ?? null,
    updated_at: r.updated_at ?? null,
  }
}

export async function fetchBenefitsCompletions(
  siteCode?: string,
): Promise<{ data: BenefitsCompletion[]; error: string | null }> {
  const site = siteCode?.toLowerCase() || null
  let remote: BenefitsCompletion[] = []
  let remoteOk = false
  let remoteError: string | null = null

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await queryCompletions((cols) => {
        const q = supabase!
          .from('benefits_completions')
          .select(cols)
          .order('created_at', { ascending: false })
          .limit(2000)
        return site ? q.eq('site_code', site) : q
      })

      if (error) {
        remoteError = error.message
        console.warn('[benefitsStore] fetchCompletions remote error', error.message)
      } else if (data) {
        remoteOk = true
        remote = (data as CompletionDbRow[]).map(dbToCompletion)
      }
    } catch (err) {
      remoteError = err instanceof Error ? err.message : 'Fetch failed'
      console.error('[benefitsStore] fetchCompletions failed', err)
    }
  } else {
    remoteError = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  }

  // Server is the truth when reachable; otherwise fall back to this device's copy.
  const base = remoteOk
    ? remote
    : readCompletionsLocal().filter((c) => !site || c.site_code === site)

  // Show anything still waiting in the sync queue (new / renamed / reopened).
  const merged = overlayCompletions(base, site)

  const cleaned: BenefitsCompletion[] = []
  for (const c of merged) {
    if (!cleaned.some((x) => sameCompletion(x, c))) cleaned.push(c)
  }
  cleaned.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { data: cleaned, error: remoteOk ? null : remoteError }
}

export function formatDuration(fromIso: string, toIso?: string): string {
  const start = new Date(fromIso).getTime()
  const end = toIso ? new Date(toIso).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '—'
  // small clock differences between the staff PC and the server must not hide the duration
  if (end < start && start - end > 10 * 60000) return '—'
  const mins = Math.max(0, Math.floor((end - start) / 60000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 24) return `${h}h ${m}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

/* ------------------------------------------------------------------ */
/* Activity log (audit trail)                                          */
/* ------------------------------------------------------------------ */

/** Latest activity of this branch (admins only — enforced by the database). */
export async function fetchBenefitsAudit(
  siteCode: string,
  limit = 600,
): Promise<{ data: BenefitsAuditEntry[]; error: string | null; notReady?: boolean }> {
  if (!isSupabaseConfigured() || !supabase) return { data: [], error: 'Server not configured' }
  try {
    const { data, error } = await supabase
      .from('benefits_audit')
      .select('id, site_code, action, actor_email, patient_name, program_id, program_name, detail, created_at')
      .eq('site_code', siteCode.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      const notReady = error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)
      return { data: [], error: error.message, notReady }
    }
    return {
      data: ((data as unknown as BenefitsAuditEntry[]) || []).map((r) => ({
        ...r,
        id: String(r.id),
        detail: (r.detail ?? {}) as Record<string, unknown>,
      })),
      error: null,
    }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Fetch failed' }
  }
}

/* ------------------------------------------------------------------ */
/* Same patient started twice? (warning only — never blocks)           */
/* ------------------------------------------------------------------ */

/** "Santos, Maria" and "MARIA SANTOS" give the same key. */
export function patientNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

export type SameDayHit = {
  kind: 'completed' | 'paused'
  programName: string
  at: string
  by?: string | null
}

/** Finished today or still open (paused) for a patient with the same name. */
export async function findSameDayRecords(
  siteCode: string,
  name: string,
  openSessions: BenefitsSession[],
): Promise<SameDayHit[]> {
  const key = patientNameKey(name)
  if (!key) return []
  const site = siteCode.toLowerCase()
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const sinceIso = midnight.toISOString()

  let rows: BenefitsCompletion[] = []
  let remoteOk = false
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await queryCompletions((cols) =>
        supabase!
          .from('benefits_completions')
          .select(cols)
          .eq('site_code', site)
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(1000),
      )
      if (!error && data) {
        remoteOk = true
        rows = (data as CompletionDbRow[]).map(dbToCompletion)
      }
    } catch {
      /* offline: use this device's copy */
    }
  }
  if (!remoteOk) rows = readCompletionsLocal().filter((c) => c.site_code === site)
  rows = overlayCompletions(rows, site)

  const hits: SameDayHit[] = []
  for (const c of rows) {
    if (new Date(c.created_at).getTime() < midnight.getTime()) continue
    if (patientNameKey(c.patient_name) !== key) continue
    hits.push({ kind: 'completed', programName: c.program_name, at: c.created_at, by: c.created_by ?? null })
  }
  for (const s of openSessions) {
    if (patientNameKey(s.patientName) !== key) continue
    hits.push({
      kind: 'paused',
      programName: s.snapshot.programName || 'No program chosen yet',
      at: s.updatedAt || s.createdAt,
    })
  }
  return hits.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
