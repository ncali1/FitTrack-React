import '@testing-library/jest-dom/vitest'

// Node 25+ ships its own `localStorage` global, which is undefined unless Node is started
// with --localstorage-file and shadows the one happy-dom provides. Fall back to a plain
// in-memory Storage so persisted stores work under test on any Node version.
if (typeof globalThis.localStorage === 'undefined') {
  const data = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true })
}
