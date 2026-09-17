/**
 * Park/resume patient guidance sessions.
 * Primary: Supabase `flow_sessions` (shared across devices).
 * Fallback: localStorage when Supabase is not configured or offline.
 * No PhilHealth numbers — label only.
 */

import { supabase, isSupabaseConfigured } from './supabase'

export const SESSION_STORE_KEY = 'gcare-flow-sessions-v1'
export const MAX_SESSIONS = 40
/** Auto-remove parked sessions older than this (ms). Default 48 hours. */
export const SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000

/** Serializable copy of App navigation state */
export type FlowSnapshot = {
  screen: 1 | 2 | 3 | 4 | 5 | 6
  path: string[]
  entryType: 'er' | 'opd' | 'direct' | null
  benefitType:
    | 'er'
    | 'yakap'
    | 'daysurgery'
    | 'specialized'
    | 'zbenefit'
    | 'diagnostic'
    | 'consultation'
    | null
  erSub: 'admissible' | 'non-admissible' | null
  specialPkg:
    | 'woundcare'
    | 'endoscopy'
    | 'hsg'
    | 'dialysis'
    | 'chemo'
    | 'radio'
    | 'blood'
    | 'animalbite'
    | 'rehab'
    | 'ami'
    | 'maternity'
    | null
  yakapSub: 'standard' | 'cancer' | 'gamot' | null
  cancerStep:
    | null
    | 'risk'
    | 'screen-type'
    | 'screen-checklist'
    | 'result-normal'
    | 'result-abnormal'
    | 'confirmed'
  oecbTab: 'overview' | 'groups' | 'covered' | 'pathways' | 'exclusions'
  detailView:
    | 'main'
    | 'oecb-tables'
    | 'cancer-flow'
    | 'gamot-flow'
    | 'acr-flow'
    | 'z-flow'
    | 'animal-flow'
    | 'rehab-flow'
    | 'dialysis-flow'
    | 'nbb-flow'
    | 'daysurgery-flow'
  processStep: number
  gamotBranch: string | null
  gamotRx: 'new' | 'existing' | null
  gamotDispensed: 'full' | 'partial' | null
  acrPackage: 'standard' | 'special' | null
  cancerScreenType: string | null
  zQualified: 'yes' | 'no' | null
  nbbAccom: 'basic' | 'nonbasic' | null
  diagnosticBranch: 'laboratory' | 'radiology' | 'heartstation' | null
  heartPath: 'other' | 'nonstress' | null
  consultPatient: 'private' | 'walkin' | 'indigent' | null
  consultRx: 'yes' | 'no' | null
  consultYakapReg: 'yes' | 'no' | null
  consultWantReg: 'yes' | 'no' | null
  consultGamot: 'yes' | 'no' | null
  consultDiag: 'yes' | 'no' | null
  consultCancer: 'yes' | 'no' | null
  chemoZben: 'yes' | 'no' | null
  chemoPhicOk: 'yes' | 'no' | null
  directPay: 'hmo' | 'cash' | null
  bloodPatient: 'hd' | 'onco' | null
  animalVisit: 'first' | 'scheduled' | null
  animalPay: 'hmo' | 'cash' | null
  animalLoa: 'yes' | 'no' | null
  rehabCardio: 'yes' | 'no' | null
  rehabPay: 'hmo' | 'cash' | null
  rehabSchedule: 'yes' | 'no' | null
  rehabLoa: 'yes' | 'no' | null
}

export type ParkedSession = {
  id: string
  label: string
  note?: string
  createdAt: string
  updatedAt: string
  snapshot: FlowSnapshot
}

type DbRow = {
  id: string
  label: string
  note: string | null
  snapshot: FlowSnapshot
  created_at: string
  updated_at: string
}

function safeParseLocal(raw: string | null): ParkedSession[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter(
      (s): s is ParkedSession =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as ParkedSession).id === 'string' &&
        typeof (s as ParkedSession).label === 'string' &&
        typeof (s as ParkedSession).snapshot === 'object',
    )
  } catch {
    return []
  }
}

function prune(sessions: ParkedSession[]): ParkedSession[] {
  const now = Date.now()
  const fresh = sessions.filter((s) => {
    const t = new Date(s.updatedAt).getTime()
    return Number.isFinite(t) && now - t <= SESSION_MAX_AGE_MS
  })
  return fresh
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_SESSIONS)
}

function readLocal(): ParkedSession[] {
  if (typeof localStorage === 'undefined') return []
  return prune(safeParseLocal(localStorage.getItem(SESSION_STORE_KEY)))
}

function writeLocal(sessions: ParkedSession[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(prune(sessions)))
  } catch (err) {
    console.error('[sessionStore] Failed to write local cache', err)
  }
}

function rowToSession(row: DbRow): ParkedSession {
  return {
    id: row.id,
    label: row.label,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    snapshot: row.snapshot,
  }
}

function cacheUpsertLocal(session: ParkedSession) {
  const list = readLocal()
  const idx = list.findIndex((s) => s.id === session.id)
  if (idx >= 0) list[idx] = session
  else list.unshift(session)
  writeLocal(list)
}

function cacheDeleteLocal(id: string) {
  writeLocal(readLocal().filter((s) => s.id !== id))
}

export function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Load sessions from Supabase when configured; otherwise localStorage.
 * Always refreshes local cache from remote when remote succeeds.
 */
export async function listSessions(): Promise<ParkedSession[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const cutoff = new Date(Date.now() - SESSION_MAX_AGE_MS).toISOString()
      const { data, error } = await supabase
        .from('flow_sessions')
        .select('id, label, note, snapshot, created_at, updated_at')
        .gte('updated_at', cutoff)
        .order('updated_at', { ascending: false })
        .limit(MAX_SESSIONS)

      if (error) {
        console.error('[sessionStore] listSessions remote error', error.message)
        return readLocal()
      }

      const sessions = ((data as DbRow[]) || []).map(rowToSession)
      writeLocal(sessions)
      return sessions
    } catch (err) {
      console.error('[sessionStore] listSessions failed', err)
      return readLocal()
    }
  }
  return readLocal()
}

export async function getSession(id: string): Promise<ParkedSession | null> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('flow_sessions')
        .select('id, label, note, snapshot, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('[sessionStore] getSession remote error', error.message)
        return readLocal().find((s) => s.id === id) ?? null
      }
      if (!data) return null
      const session = rowToSession(data as DbRow)
      cacheUpsertLocal(session)
      return session
    } catch (err) {
      console.error('[sessionStore] getSession failed', err)
      return readLocal().find((s) => s.id === id) ?? null
    }
  }
  return readLocal().find((s) => s.id === id) ?? null
}

/** Insert or update a session (remote + local cache). */
export async function upsertSession(
  id: string,
  label: string,
  snapshot: FlowSnapshot,
  note?: string,
): Promise<ParkedSession> {
  const now = new Date().toISOString()
  const localExisting = readLocal().find((s) => s.id === id)
  const next: ParkedSession = {
    id,
    label: label.trim() || 'Patient',
    note,
    createdAt: localExisting?.createdAt ?? now,
    updatedAt: now,
    snapshot,
  }

  // Always update local cache first (fast + offline-safe)
  cacheUpsertLocal(next)

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('flow_sessions')
        .upsert(
          {
            id: next.id,
            label: next.label,
            note: next.note ?? null,
            snapshot: next.snapshot,
            updated_at: now,
            // created_at only on insert — Supabase keeps existing if we omit on conflict
            // but upsert needs full row; use created_at from next
            created_at: next.createdAt,
          },
          { onConflict: 'id' },
        )
        .select('id, label, note, snapshot, created_at, updated_at')
        .maybeSingle()

      if (error) {
        console.error('[sessionStore] upsertSession remote error', error.message)
        return next
      }
      if (data) {
        const remote = rowToSession(data as DbRow)
        cacheUpsertLocal(remote)
        return remote
      }
    } catch (err) {
      console.error('[sessionStore] upsertSession failed', err)
    }
  }

  return next
}

export async function deleteSession(id: string): Promise<void> {
  cacheDeleteLocal(id)

  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('flow_sessions').delete().eq('id', id)
      if (error) {
        console.error('[sessionStore] deleteSession remote error', error.message)
      }
    } catch (err) {
      console.error('[sessionStore] deleteSession failed', err)
    }
  }
}

export function pathSummary(snapshot: FlowSnapshot): string {
  const p = snapshot.path?.filter(Boolean) ?? []
  if (p.length <= 1) return 'Just started'
  const tail = p.slice(-3)
  return tail.join(' → ')
}

export function formatSessionTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * SQL to run once in Supabase SQL editor:
 *
 * create table if not exists public.flow_sessions (
 *   id uuid primary key,
 *   label text not null,
 *   note text,
 *   snapshot jsonb not null default '{}'::jsonb,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * create index if not exists flow_sessions_updated_at_idx
 *   on public.flow_sessions (updated_at desc);
 *
 * alter table public.flow_sessions enable row level security;
 *
 * create policy "Allow anon read flow_sessions"
 *   on public.flow_sessions for select to anon using (true);
 * create policy "Allow anon insert flow_sessions"
 *   on public.flow_sessions for insert to anon with check (true);
 * create policy "Allow anon update flow_sessions"
 *   on public.flow_sessions for update to anon using (true) with check (true);
 * create policy "Allow anon delete flow_sessions"
 *   on public.flow_sessions for delete to anon using (true);
 */
