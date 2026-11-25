/**
 * Remembers "where the user was" so a browser refresh puts them back on the same page.
 * Uses sessionStorage: it survives a refresh in the same tab, but is wiped when the tab is
 * closed and on logout, so a patient's name never lingers on a shared computer.
 * Everything here is only a convenience; the server still decides what each user may see.
 */
const PREFIX = 'pbup:'

export function readView<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Saves a value, or removes it when `value` is null. */
export function writeView(key: string, value: unknown | null): void {
  try {
    if (value === null || value === undefined) window.sessionStorage.removeItem(PREFIX + key)
    else window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage blocked or full: just don't remember */
  }
}

/** Forgets everything (used on logout / expired login). */
export function clearAllViewState(): void {
  try {
    const gone: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k && k.startsWith(PREFIX)) gone.push(k)
    }
    gone.forEach((k) => window.sessionStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

export type RoleHint = 'admin' | 'staff'

/** Only used to pick the right skeleton while the login is being checked; never for access. */
export function rememberRole(role: RoleHint): void {
  writeView('role', role)
}
export function readRole(): RoleHint | null {
  const r = readView<string>('role')
  return r === 'admin' || r === 'staff' ? r : null
}
