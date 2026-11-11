/**
 * Unit tests for persistent-storage requests: reading the state, asking only when needed,
 * asking at most once per page load, and never throwing when the API is missing or fails.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getStorageProtection,
  requestStorageProtection,
  protectStorageOnce,
  resetStorageProtectionRequest,
} from './persistentStorage'

/** Installs a fake `navigator.storage` and returns its spies. */
function stubStorage({ persisted, grants }: { persisted: boolean; grants: boolean }) {
  const storage = {
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => grants),
  }
  vi.stubGlobal('navigator', { storage })
  return storage
}

describe('persistentStorage', () => {
  beforeEach(() => {
    resetStorageProtectionRequest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reports unsupported when the browser has no Storage API', async () => {
    vi.stubGlobal('navigator', {})
    expect(await getStorageProtection()).toBe('unsupported')
    expect(await requestStorageProtection()).toBe('unsupported')
  })

  it('reads the current state without requesting anything', async () => {
    const storage = stubStorage({ persisted: false, grants: true })
    expect(await getStorageProtection()).toBe('unprotected')
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('does not ask again when storage is already protected', async () => {
    const storage = stubStorage({ persisted: true, grants: true })
    expect(await requestStorageProtection()).toBe('protected')
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('reports the browser’s answer to a request', async () => {
    stubStorage({ persisted: false, grants: true })
    expect(await requestStorageProtection()).toBe('protected')

    stubStorage({ persisted: false, grants: false })
    expect(await requestStorageProtection()).toBe('unprotected')
  })

  it('degrades to unprotected instead of throwing when the request fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = stubStorage({ persisted: false, grants: true })
    storage.persist.mockRejectedValue(new Error('SecurityError'))

    expect(await requestStorageProtection()).toBe('unprotected')
    expect(consoleError).toHaveBeenCalled()
  })

  it('asks at most once per page load however many saves follow', async () => {
    const storage = stubStorage({ persisted: false, grants: false })

    protectStorageOnce()
    protectStorageOnce()
    protectStorageOnce()

    await vi.waitFor(() => expect(storage.persist).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })
})
