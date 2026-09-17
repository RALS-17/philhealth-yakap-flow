import { supabase, isSupabaseConfigured } from './supabase'

export type FlowCompletion = {
  flow_name: string
  branch?: string | null
  entry_type?: string | null
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
 * Optional patient_label / path / started_at for admin Patient List (Done records).
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
    if (
      error.message?.includes('patient_label') ||
      error.message?.includes('started_at') ||
      error.message?.includes('column')
    ) {
      const basic = {
        flow_name: payload.flow_name,
        branch: payload.branch ?? null,
        entry_type: payload.entry_type ?? null,
      }
      const retry = await supabase.from('flow_completions').insert([basic])
      if (retry.error) {
        console.error('[flowMonitor] Failed to save completion', retry.error.message)
        return false
      }
      console.warn(
        '[flowMonitor] Saved without patient fields — run supabase-flow-completions-patient.sql',
      )
      return true
    }
    console.error('[flowMonitor] Failed to save completion', error.message)
    return false
  }
  return true
}

/** Load completions for the dashboard (newest first). */
export async function fetchFlowCompletions(limit = 2000): Promise<{
  data: FlowCompletionRow[]
  error: string | null
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      data: [],
      error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    }
  }

  const { data, error } = await supabase
    .from('flow_completions')
    .select('id, created_at, flow_name, branch, entry_type, patient_label, path, started_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    const fallback = await supabase
      .from('flow_completions')
      .select('id, created_at, flow_name, branch, entry_type')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (fallback.error) {
      return { data: [], error: fallback.error.message }
    }
    return { data: (fallback.data as FlowCompletionRow[]) || [], error: null }
  }
  return { data: (data as FlowCompletionRow[]) || [], error: null }
}

/**
 * Completed guidance records that have a patient label (admin Patient List — Done).
 * From now on only (rows saved after migration + app update).
 */
export async function fetchCompletedPatients(limit = 500): Promise<{
  data: FlowCompletionRow[]
  error: string | null
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('flow_completions')
    .select('id, created_at, flow_name, branch, entry_type, patient_label, path, started_at')
    .not('patient_label', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

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
