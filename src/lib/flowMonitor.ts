import { supabase, isSupabaseConfigured } from './supabase'

export type FlowCompletion = {
  flow_name: string
  branch?: string | null
  entry_type?: string | null
}

export type FlowCompletionRow = FlowCompletion & {
  id: number
  created_at: string
}

/**
 * Saves one completed patient-guidance event to Supabase.
 * Safe to call when Supabase is not configured (no-op).
 * Does not store patient names or PhilHealth numbers.
 */
export async function saveFlowCompletion(payload: FlowCompletion): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    if (import.meta.env.DEV) {
      console.info('[flowMonitor] Supabase not configured — skip log', payload)
    }
    return false
  }

  const row = {
    flow_name: payload.flow_name,
    branch: payload.branch ?? null,
    entry_type: payload.entry_type ?? null,
  }

  const { error } = await supabase.from('flow_completions').insert([row])

  if (error) {
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
    return { data: [], error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' }
  }

  const { data, error } = await supabase
    .from('flow_completions')
    .select('id, created_at, flow_name, branch, entry_type')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { data: [], error: error.message }
  }
  return { data: (data as FlowCompletionRow[]) || [], error: null }
}
