import { useCallback, useEffect, useState } from 'react'
import { getStorageProtection, requestStorageProtection, type StorageProtection } from '@/services/persistentStorage'

/**
 * Whether the browser has agreed to keep this device's data, plus a way to ask again.
 * `status` is `null` until the first read resolves, so callers can render nothing rather
 * than flash "not protected".
 */
export function useStorageProtection(): { status: StorageProtection | null; request: () => Promise<StorageProtection> } {
  const [status, setStatus] = useState<StorageProtection | null>(null)

  useEffect(() => {
    let cancelled = false
    void getStorageProtection().then((current) => {
      if (!cancelled) setStatus(current)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const request = useCallback(async () => {
    const result = await requestStorageProtection()
    setStatus(result)
    return result
  }, [])

  return { status, request }
}
