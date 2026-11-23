import { FormEvent, useCallback, useEffect, useState } from 'react'
import Icon from './AdminIcons'
import {
  BenefitsUser,
  createBenefitsUser,
  generatePassword,
  listBenefitsUsers,
  removeBenefitsUser,
  resetBenefitsUserPassword,
  setBenefitsUserRole,
} from './lib/benefitsUsers'

type Role = 'staff' | 'admin'

type Modal =
  | { kind: 'reset'; user: BenefitsUser; password: string }
  | { kind: 'remove'; user: BenefitsUser }
  | { kind: 'role'; user: BenefitsUser; role: Role }
  | null

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : null

export default function UsersAdmin({ siteName }: { siteName: string }) {
  const [users, setUsers] = useState<BenefitsUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [password, setPassword] = useState(() => generatePassword())
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string; role: Role; adopted: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  const [modal, setModal] = useState<Modal>(null)
  const [modalBusy, setModalBusy] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await listBenefitsUsers())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the text is on screen to copy by hand */
    }
  }

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setFormError('Enter a valid email address.')
    if (password.length < 8) return setFormError('Password must be at least 8 characters.')
    setCreating(true)
    try {
      const res = await createBenefitsUser(em, role, password)
      setCreated({ email: em, password, role, adopted: res.adopted })
      setEmail('')
      setPassword(generatePassword())
      void load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the account.')
    } finally {
      setCreating(false)
    }
  }

  const runModal = async () => {
    if (!modal) return
    setModalBusy(true)
    setModalError(null)
    try {
      if (modal.kind === 'reset') {
        if (modal.password.length < 8) throw new Error('Password must be at least 8 characters.')
        await resetBenefitsUserPassword(modal.user.id, modal.password)
        setCreated({ email: modal.user.email, password: modal.password, role: modal.user.role, adopted: false })
        setNotice(`New password set for ${modal.user.email}.`)
      } else if (modal.kind === 'remove') {
        await removeBenefitsUser(modal.user.id)
        setNotice(`${modal.user.email} was removed.`)
      } else {
        await setBenefitsUserRole(modal.user.id, modal.role)
        setNotice(`${modal.user.email} is now ${modal.role === 'admin' ? 'an admin' : 'staff'}.`)
      }
      setModal(null)
      void load()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setModalBusy(false)
    }
  }

  const admins = users.filter((u) => u.role === 'admin').length

  return (
    <>
      <div className="dash-toolbar">
        <div className="dash-toolbar-inner">
          <div className="dash-toolbar-title">
            <h1>Users</h1>
            <p className="dash-period-text">Logins for {siteName}</p>
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
        <div className="dash-content ux-grid">
          <section className="dash-card ux-form-card" aria-label="Add a user">
            <h2>
              <Icon name="users" size={16} />
              Add a user
            </h2>
            <p className="dash-card-sub">Creates a login for {siteName} only.</p>

            <form className="ux-form" onSubmit={submitCreate}>
              <label className="ux-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="off"
                  required
                />
              </label>

              <div className="ux-field">
                <span>Role</span>
                <div className="ux-seg" role="radiogroup" aria-label="Role">
                  {(['staff', 'admin'] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={role === r}
                      className={role === r ? 'ux-seg-on' : undefined}
                      onClick={() => setRole(r)}
                    >
                      {r === 'staff' ? 'Staff' : 'Admin'}
                    </button>
                  ))}
                </div>
                <small>
                  {role === 'staff'
                    ? 'Staff can run benefit programs and edit recent entries.'
                    : 'Admins also see the dashboard, patient list, insights and this Users page.'}
                </small>
              </div>

              <label className="ux-field">
                <span>Password</span>
                <div className="ux-pw">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    minLength={8}
                    required
                  />
                  <button type="button" className="ux-btn" onClick={() => setPassword(generatePassword())}>
                    Generate
                  </button>
                </div>
                <small>At least 8 characters. Give it to the person — it is not shown again later.</small>
              </label>

              {formError && <p className="ux-error" role="alert">{formError}</p>}

              <button type="submit" className="dash-btn-primary ux-submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create account'}
              </button>
            </form>

            {created && (
              <div className="ux-created" role="status">
                <strong>{created.adopted ? 'Account linked to this branch' : 'Credentials ready'}</strong>
                <dl>
                  <dt>Email</dt>
                  <dd>{created.email}</dd>
                  <dt>Password</dt>
                  <dd>{created.password}</dd>
                  <dt>Role</dt>
                  <dd>{created.role === 'admin' ? 'Admin' : 'Staff'}</dd>
                </dl>
                <div className="ux-created-actions">
                  <button
                    type="button"
                    className="ux-btn"
                    onClick={() => void copy(`Email: ${created.email}\nPassword: ${created.password}`)}
                  >
                    {copied ? 'Copied ✓' : 'Copy email + password'}
                  </button>
                  <button type="button" className="ux-btn ux-btn-ghost" onClick={() => setCreated(null)}>
                    Hide
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="dash-card ux-list-card" aria-label="Branch users">
            <h2>
              <Icon name="list" size={16} />
              Branch users
              {!loading && !error && <span className="ux-count">{users.length}</span>}
            </h2>
            <p className="dash-card-sub">
              {admins} admin{admins === 1 ? '' : 's'} · {users.length - admins} staff
            </p>

            {notice && (
              <p className="ux-notice" role="status">
                {notice}
                <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
              </p>
            )}
            {error && <p className="ux-error" role="alert">{error}</p>}

            {loading && users.length === 0 && !error ? (
              <p className="dash-muted">Loading users…</p>
            ) : (
              <ul className="ux-users">
                {users.map((u) => (
                  <li key={u.id}>
                    <span className="ux-av" aria-hidden="true">{(u.email[0] || '?').toUpperCase()}</span>
                    <div className="ux-who">
                      <b>
                        {u.email}
                        {u.is_me && <em className="ux-me">You</em>}
                      </b>
                      <span>
                        Last sign-in: {fmtDate(u.last_sign_in_at) ?? 'never'}
                      </span>
                    </div>
                    <span className={`ux-role ux-role-${u.role}`}>{u.role === 'admin' ? 'Admin' : 'Staff'}</span>
                    <div className="ux-actions">
                      <button
                        type="button"
                        className="ux-btn"
                        onClick={() => { setModalError(null); setModal({ kind: 'reset', user: u, password: generatePassword() }) }}
                      >
                        Reset password
                      </button>
                      {!u.is_me && (
                        <>
                          <button
                            type="button"
                            className="ux-btn"
                            onClick={() => { setModalError(null); setModal({ kind: 'role', user: u, role: u.role === 'admin' ? 'staff' : 'admin' }) }}
                          >
                            {u.role === 'admin' ? 'Make staff' : 'Make admin'}
                          </button>
                          <button
                            type="button"
                            className="ux-btn ux-btn-danger"
                            onClick={() => { setModalError(null); setModal({ kind: 'remove', user: u }) }}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
                {users.length === 0 && !error && <li className="ux-empty">No users yet.</li>}
              </ul>
            )}
          </section>
        </div>
      </main>

      {modal && (
        <div className="ux-modal-back" role="dialog" aria-modal="true" onClick={() => !modalBusy && setModal(null)}>
          <div className="ux-modal" onClick={(e) => e.stopPropagation()}>
            {modal.kind === 'reset' && (
              <>
                <h3>Reset password</h3>
                <p>New password for <b>{modal.user.email}</b>.</p>
                <div className="ux-pw">
                  <input
                    type="text"
                    value={modal.password}
                    onChange={(e) => setModal({ ...modal, password: e.target.value })}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button type="button" className="ux-btn" onClick={() => setModal({ ...modal, password: generatePassword() })}>
                    Generate
                  </button>
                </div>
              </>
            )}
            {modal.kind === 'remove' && (
              <>
                <h3>Remove this user?</h3>
                <p>
                  <b>{modal.user.email}</b> will no longer be able to sign in. Their past entries stay in the records.
                </p>
              </>
            )}
            {modal.kind === 'role' && (
              <>
                <h3>Change role?</h3>
                <p>
                  <b>{modal.user.email}</b> will become {modal.role === 'admin' ? 'an admin' : 'staff'}.
                </p>
              </>
            )}
            {modalError && <p className="ux-error" role="alert">{modalError}</p>}
            <div className="ux-modal-actions">
              <button type="button" className="ux-btn ux-btn-ghost" disabled={modalBusy} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`dash-btn-primary${modal.kind === 'remove' ? ' ux-danger-fill' : ''}`}
                disabled={modalBusy}
                onClick={() => void runModal()}
              >
                {modalBusy ? 'Working…' : modal.kind === 'reset' ? 'Set password' : modal.kind === 'remove' ? 'Remove' : 'Change role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
