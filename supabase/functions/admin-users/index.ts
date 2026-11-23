// =====================================================================
//  admin-users  —  Supabase Edge Function (one copy per branch project)
//
//  Lets a Benefits ADMIN manage the logins of THEIR OWN branch:
//    list · create · reset_password · set_role · remove
//
//  Why a server function? Creating/deleting logins needs the Supabase
//  "service_role" key, which must NEVER be put in the website. This
//  function holds it safely on Supabase's server (it is provided to the
//  function automatically — you do not copy any key anywhere).
//
//  Safety rules enforced here (not in the browser):
//    • the caller must be signed in AND have role = 'admin' in benefits_profiles
//    • every action only touches users of the caller's own branch (site_code)
//    • an admin can't remove or change the role of their OWN account
//    • passwords must be 8+ characters
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLES = ['staff', 'admin']

// deno-lint-ignore no-explicit-any
type Admin = any

async function allAuthUsers(admin: Admin) {
  // deno-lint-ignore no-explicit-any
  const out: any[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    out.push(...(data?.users ?? []))
    if ((data?.users?.length ?? 0) < 1000) break
  }
  return out
}

export async function handle(req: Request, admin: Admin): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  // ---- who is calling? -------------------------------------------------
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: 'Please sign in again.' })
  const { data: au, error: auErr } = await admin.auth.getUser(token)
  if (auErr || !au?.user) return json(401, { error: 'Please sign in again.' })
  const callerId: string = au.user.id
  const { data: me, error: meErr } = await admin
    .from('benefits_profiles')
    .select('role, site_code')
    .eq('user_id', callerId)
    .maybeSingle()
  if (meErr) return json(500, { error: `Could not read benefits_profiles: ${meErr.message}` })
  if (!me) return json(403, { error: 'Only a Benefits admin can manage users. (No branch profile was found for this login in this Supabase project.)' })
  if (me.role !== 'admin') return json(403, { error: `Only a Benefits admin can manage users. (This login's role here is "${me.role}".)` })
  const site: string = me.site_code

  // deno-lint-ignore no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Bad request.' })
  }
  const action = String(body?.action ?? '')

  // A target user must belong to the caller's branch.
  const targetProfile = async (id: unknown) => {
    if (typeof id !== 'string' || !id) return null
    const { data } = await admin
      .from('benefits_profiles')
      .select('user_id, email, role, site_code')
      .eq('user_id', id)
      .eq('site_code', site)
      .maybeSingle()
    return data ?? null
  }
  // Audit trail (non-fatal: a logging problem never blocks the action).
  const logAudit = async (action: string, detail: Record<string, unknown>) => {
    try {
      await admin.from('benefits_audit').insert({
        site_code: site,
        action,
        actor_email: au.user.email ?? null,
        detail,
      })
    } catch (_e) { /* ignore */ }
  }
  const validPassword = (p: unknown) => typeof p === 'string' && p.length >= 8 && p.length <= 72

  try {
    // ---- list ----------------------------------------------------------
    if (action === 'list') {
      const { data: profs, error } = await admin
        .from('benefits_profiles')
        .select('user_id, email, role, created_at')
        .eq('site_code', site)
      if (error) return json(500, { error: error.message })
      const auth = await allAuthUsers(admin)
      const byId = new Map(auth.map((u) => [u.id, u]))
      const users = (profs ?? [])
        // deno-lint-ignore no-explicit-any
        .map((p: any) => ({
          id: p.user_id,
          email: p.email ?? byId.get(p.user_id)?.email ?? '',
          role: p.role,
          created_at: p.created_at,
          last_sign_in_at: byId.get(p.user_id)?.last_sign_in_at ?? null,
          is_me: p.user_id === callerId,
        }))
        // deno-lint-ignore no-explicit-any
        .sort((a: any, b: any) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'admin' ? -1 : 1))
      return json(200, { ok: true, users })
    }

    // ---- create --------------------------------------------------------
    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const role = String(body.role ?? '')
      const password = body.password
      if (!EMAIL_RE.test(email)) return json(400, { error: 'Enter a valid email address.' })
      if (!ROLES.includes(role)) return json(400, { error: 'Choose Staff or Admin.' })
      if (!validPassword(password)) return json(400, { error: 'Password must be at least 8 characters.' })

      const auth = await allAuthUsers(admin)
      const existing = auth.find((u) => (u.email ?? '').toLowerCase() === email)
      let userId: string
      let adopted = false
      let createdNew = false
      if (existing) {
        const { data: p } = await admin
          .from('benefits_profiles')
          .select('user_id, site_code')
          .eq('user_id', existing.id)
          .maybeSingle()
        if (p) {
          return json(409, {
            error: p.site_code === site ? 'This email already has an account.' : 'This email is already used by another branch.',
          })
        }
        // A login that was created by hand in Supabase but has no branch/role yet: adopt it.
        const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
        if (error) return json(400, { error: error.message })
        userId = existing.id
        adopted = true
      } else {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
        if (error || !data?.user) return json(400, { error: error?.message ?? 'Could not create the account.' })
        userId = data.user.id
        createdNew = true
      }
      const { error: pErr } = await admin
        .from('benefits_profiles')
        .upsert({ user_id: userId, email, role, site_code: site }, { onConflict: 'user_id' })
      if (pErr) {
        if (createdNew) await admin.auth.admin.deleteUser(userId)
        return json(500, { error: pErr.message })
      }
      await logAudit('user_create', { email, role })
      return json(200, { ok: true, adopted, user: { id: userId, email, role } })
    }

    // ---- reset_password ------------------------------------------------
    if (action === 'reset_password') {
      const t = await targetProfile(body.user_id)
      if (!t) return json(404, { error: 'User not found in this branch.' })
      if (!validPassword(body.password)) return json(400, { error: 'Password must be at least 8 characters.' })
      const { error } = await admin.auth.admin.updateUserById(t.user_id, { password: body.password })
      if (error) return json(400, { error: error.message })
      await logAudit('user_reset', { email: t.email })
      return json(200, { ok: true })
    }

    // ---- set_role ------------------------------------------------------
    if (action === 'set_role') {
      const t = await targetProfile(body.user_id)
      if (!t) return json(404, { error: 'User not found in this branch.' })
      if (t.user_id === callerId) return json(400, { error: "You can't change your own role." })
      if (!ROLES.includes(String(body.role))) return json(400, { error: 'Choose Staff or Admin.' })
      const { error } = await admin.from('benefits_profiles').update({ role: body.role }).eq('user_id', t.user_id)
      if (error) return json(500, { error: error.message })
      await logAudit('user_role', { email: t.email, role: body.role })
      return json(200, { ok: true })
    }

    // ---- remove --------------------------------------------------------
    if (action === 'remove') {
      const t = await targetProfile(body.user_id)
      if (!t) return json(404, { error: 'User not found in this branch.' })
      if (t.user_id === callerId) return json(400, { error: "You can't remove your own account." })
      const { error } = await admin.auth.admin.deleteUser(t.user_id) // profile row is deleted by cascade
      if (error) return json(500, { error: error.message })
      await logAudit('user_remove', { email: t.email, role: t.role })
      return json(200, { ok: true })
    }

    return json(400, { error: 'Unknown action.' })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Something went wrong.' })
  }
}

// ---- start the function (Supabase provides these 2 values automatically) ----
Deno.serve((req: Request) =>
  handle(
    req,
    createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  ),
)
