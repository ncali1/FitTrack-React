import { useEffect } from 'react'

/**
 * Keeps the screen from dimming or locking while `active` is true, where the Screen Wake
 * Lock API is available (a silent no-op elsewhere). The browser drops the lock whenever
 * the page is hidden, so it is re-requested each time the page becomes visible again.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock.release().catch(() => {})
        else sentinel = lock
      } catch {
        // Refused (e.g. low battery mode) — the screen just follows its normal timeout.
      }
    }

    acquire()
    document.addEventListener('visibilitychange', acquire)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      sentinel?.release().catch(() => {})
    }
  }, [active])
}
