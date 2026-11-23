import { flushQueue, retryFailedSync } from './lib/benefitsStore'
import { useBenefitsSync } from './lib/useBenefitsSync'

/** Small status pill: "Synced" / "3 unsynced" / "Offline" / "Syncing…". Click to retry now. */
export default function SyncBadge() {
  const s = useBenefitsSync()
  const unsynced = s.pending + s.failed

  let tone = 'ok'
  let text = 'Synced'
  if (!s.online) {
    tone = 'warn'
    text = unsynced > 0 ? `Offline · ${unsynced} unsynced` : 'Offline'
  } else if (s.failed > 0) {
    tone = 'bad'
    text = `${unsynced} unsynced · needs attention`
  } else if (s.syncing && unsynced > 0) {
    tone = 'warn'
    text = `Syncing ${unsynced}…`
  } else if (unsynced > 0) {
    tone = 'warn'
    text = `${unsynced} unsynced`
  }

  const title =
    unsynced > 0
      ? `${unsynced} change(s) saved on this device are waiting to upload.${
          s.lastError ? ` Last error: ${s.lastError}.` : ''
        } Click to retry now.`
      : 'Everything is saved to the server.'

  return (
    <button
      type="button"
      className={`sync-badge sync-badge-${tone}`}
      title={title}
      onClick={() => void (s.failed > 0 ? retryFailedSync() : flushQueue())}
    >
      <span className="sync-badge-dot" aria-hidden="true" />
      <span>{text}</span>
    </button>
  )
}
