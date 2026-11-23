import { useEffect, useState } from 'react'
import { getSyncStatus, startBenefitsSync, subscribeSync, type SyncStatus } from './benefitsStore'

/** Live sync status (pending / failed / online) + starts the automatic retries. */
export function useBenefitsSync(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus())
  useEffect(() => {
    startBenefitsSync()
    setStatus(getSyncStatus())
    return subscribeSync(setStatus)
  }, [])
  return status
}
