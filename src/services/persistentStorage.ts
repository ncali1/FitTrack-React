import { Capacitor } from '@capacitor/core'

/**
 * Whether the browser has promised to keep this site's storage:
 * - `protected` — it won't be cleared unless the user clears it themselves.
 * - `unprotected` — "best effort": the browser may evict it when the device runs low on
 *   space, and Safari clears it after a few weeks without a visit unless the app is installed.
 * - `unsupported` — there's nothing to ask (no Storage API), or it doesn't apply (the
 *   native app, whose data belongs to the app and isn't subject to browser eviction).
 */
export type StorageProtection = 'protected' | 'unprotected' | 'unsupported'

function storageManager(): StorageManager | null {
  if (Capacitor.isNativePlatform()) return null
  if (typeof navigator === 'undefined' || !navigator.storage) return null
  if (typeof navigator.storage.persisted !== 'function' || typeof navigator.storage.persist !== 'function') return null
  return navigator.storage
}

/** Reads the current state without asking for anything. Never throws. */
export async function getStorageProtection(): Promise<StorageProtection> {
  const storage = storageManager()
  if (!storage) return 'unsupported'
  try {
    return (await storage.persisted()) ? 'protected' : 'unprotected'
  } catch (err) {
    console.error('Failed to read storage persistence:', err)
    return 'unsupported'
  }
}

/**
 * Asks the browser to make this site's storage persistent. Everything the user logs lives
 * only in IndexedDB unless they sign in, so eviction would mean losing their history.
 *
 * Chrome and Safari decide silently (installing the app or using it regularly is what gets
 * a yes); Firefox shows a permission prompt. Asking again after a "no" is allowed and is
 * how a later install gets picked up. Never throws.
 */
export async function requestStorageProtection(): Promise<StorageProtection> {
  const storage = storageManager()
  if (!storage) return 'unsupported'
  try {
    if (await storage.persisted()) return 'protected'
    return (await storage.persist()) ? 'protected' : 'unprotected'
  } catch (err) {
    console.error('Failed to request persistent storage:', err)
    return 'unprotected'
  }
}

let requestedThisLoad = false

/**
 * Requests protection at most once per page load, fire-and-forget. Called after a
 * successful write rather than on launch: that's the moment there is something worth
 * keeping, and it follows a tap, so Firefox's prompt doesn't greet a first-time visitor.
 */
export function protectStorageOnce(): void {
  if (requestedThisLoad) return
  requestedThisLoad = true
  void requestStorageProtection()
}

/** Test hook: lets each test start as a fresh page load. */
export function resetStorageProtectionRequest(): void {
  requestedThisLoad = false
}
