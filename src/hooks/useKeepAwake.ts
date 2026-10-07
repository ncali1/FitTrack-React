import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { KeepAwake } from '@capacitor-community/keep-awake'

// Module-level so several mounted components (the guided session, the floating rest
// timer) can each ask for the screen to stay on without releasing each other's hold.
let holders = 0
let sentinel: WakeLockSentinel | null = null
let listenerInstalled = false

/** Brings the actual wake lock in line with whether anyone currently wants it. */
async function sync() {
  const wanted = holders > 0
  try {
    if (Capacitor.isNativePlatform()) {
      await (wanted ? KeepAwake.keepAwake() : KeepAwake.allowSleep())
      return
    }
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    if (!wanted) {
      const held = sentinel
      sentinel = null
      await held?.release()
      return
    }
    if (sentinel || document.visibilityState !== 'visible') return

    const acquired = await navigator.wakeLock.request('screen')
    acquired.addEventListener('release', () => {
      if (sentinel === acquired) sentinel = null
    })
    sentinel = acquired
    // The last holder may have gone away while the request was in flight.
    if (holders === 0) void sync()
  } catch {
    // Denied (e.g. battery saver) or unsupported — the screen just dims as usual.
  }
}

function installListener() {
  if (listenerInstalled || typeof document === 'undefined') return
  listenerInstalled = true
  // Browsers drop a screen wake lock whenever the page is hidden; take it back on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && holders > 0) void sync()
  })
}

/**
 * Keeps the screen from dimming/locking while `active` is true and the calling component
 * is mounted — used mid-workout so the phone doesn't sleep between sets. Uses the native
 * keep-awake plugin in the iOS/Android builds and the Screen Wake Lock API on the web;
 * silently does nothing where neither is available.
 */
export function useKeepAwake(active = true) {
  useEffect(() => {
    if (!active) return
    installListener()
    holders++
    void sync()
    return () => {
      holders--
      void sync()
    }
  }, [active])
}
