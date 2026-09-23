import { supabase, isSupabaseConfigured } from './supabase'
import type { SiteCode } from './auth'

export type FlowCompletion = {
  flow_name: string
  /** Pathway sub-branch (e.g. gamot detail) — not hospital site */
  branch?: string | null
  entry_type?: string | null
  /** Hospital site code (gcmcc, gcmcl, …) */
  site_code?: string | null
  /** Admin Patient List only — from now on */
  patient_label?: string | null
  path?: string | null
  started_at?: string | null
}

export type FlowCompletionRow = FlowCompletion & {
  id: number
  created_at: string
}

/**
 * Saves one completed patient-guidance event to Supabase.
 * Safe to call when Supabase is not configured (no-op).
 */
export async function saveFlowCompletion(payload: FlowCompletion): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    if (import.meta.env.DEV) {
      console.info('[flowMonitor] Supabase not configured — skip log', payload)
    }
    return false
  }

  const row: Record<string, string | null> = {
    flow_name: payload.flow_name,
    branch: payload.branch ?? null,
    entry_type: payload.entry_type ?? null,
    site_code: payload.site_code ?? null,
  }

  if (payload.patient_label != null && payload.patient_label !== '') {
    row.patient_label = payload.patient_label
  }
  if (payload.path != null && payload.path !== '') {
    row.path = payload.path
  }
  if (payload.started_at != null && payload.started_at !== '') {
    row.started_at = payload.started_at
  }

  const { error } = await supabase.from('flow_completions').insert([row])

  if (error) {
    // Retry without optional columns if schema not migrated yet
    if (
      error.message?.includes('patient_label') ||
      error.message?.includes('started_at') ||
      error.message?.includes('site_code') ||
      error.message?.includes('column')
    ) {
      const basic: Record<string, string | null> = {
        flow_name: payload.flow_name,
        branch: payload.branch ?? null,
        entry_type: payload.entry_type ?? null,
      }
      if (payload.site_code) {
        try {
          const withSite = { ...basic, site_code: payload.site_code }
          const r2 = await supabase.from('flow_completions').insert([withSite])
          if (!r2.error) return true
        } catch {
          /* fall through */
        }
      }
      const retry = await supabase.from('flow_completions').insert([basic])
      if (retry.error) {
        console.error('[flowMonitor] Failed to save completion', retry.error.message)
        return false
      }
      console.warn(
        '[flowMonitor] Saved with reduced columns — run supabase-site-code.sql if needed',
      )
      return true
    }
    console.error('[flowMonitor] Failed to save completion', error.message)
    return false
  }
  return true
}

/** Load completions for the dashboard (newest first), optional hospital filter. */
export async function fetchFlowCompletions(
  limit = 2000,
  siteCode?: SiteCode | string | null,
): Promise<{
  data: FlowCompletionRow[]
  error: string | null
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      data: [],
      error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    }
  }

  const site = siteCode?.toLowerCase() || null

  let q = supabase
    .from('flow_completions')
    .select('id, created_at, flow_name, branch, entry_type, site_code, patient_label, path, started_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (site) {
    q = q.eq('site_code', site)
  }

  const { data, error } = await q

  if (error) {
    const msg = error.message || ''
    // Table missing after accidental DROP
    if (
      msg.includes('does not exist') ||
      msg.includes('schema cache') ||
      msg.includes('Could not find the table')
    ) {
      return {
        data: [],
        error:
          'Table flow_completions is missing. Run supabase-recreate-all.sql in the Supabase SQL Editor.',
      }
    }

    // Fallback without site_code / patient columns (older schema)
    const fallback = await supabase
      .from('flow_completions')
      .select('id, created_at, flow_name, branch, entry_type')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (fallback.error) {
      return { data: [], error: fallback.error.message }
    }

    let rows = (fallback.data as FlowCompletionRow[]) || []
    // Client-side site filter only when column existed but select failed for other reasons
    if (site && rows.length && rows.some((r) => r.site_code != null)) {
      rows = rows.filter((r) => (r.site_code || '').toLowerCase() === site)
    }
    return { data: rows, error: null }
  }

  return { data: (data as FlowCompletionRow[]) || [], error: null }
}

/**
 * Completed guidance records that have a patient label (admin Patient List — Done).
 */
export async function fetchCompletedPatients(
  limit = 500,
  siteCode?: SiteCode | string | null,
): Promise<{
  data: FlowCompletionRow[]
  error: string | null
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: [], error: null }
  }

  const site = siteCode?.toLowerCase() || null

  let q = supabase
    .from('flow_completions')
    .select('id, created_at, flow_name, branch, entry_type, site_code, patient_label, path, started_at')
    .not('patient_label', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (site) {
    q = q.eq('site_code', site)
  }

  const { data, error } = await q

  if (error) {
    if (error.message?.includes('patient_label') || error.message?.includes('column')) {
      return { data: [], error: null }
    }
    return { data: [], error: error.message }
  }

  const rows = ((data as FlowCompletionRow[]) || []).filter(
    (r) => r.patient_label && String(r.patient_label).trim() !== '',
  )
  return { data: rows, error: null }
}
