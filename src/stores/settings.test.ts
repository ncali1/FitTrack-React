/**
 * Unit tests for the settings store: weight unit toggle and the reminders
 * opt-in/opt-out preference, both persisted to localStorage via zustand/persist.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSettingsStore } from './settings'

const INITIAL_STATE = useSettingsStore.getState()

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState(INITIAL_STATE, true)
  })

  it('defaults to kg and remindersEnabled=null (never asked)', () => {
    const state = useSettingsStore.getState()
    expect(state.weightUnit).toBe('kg')
    expect(state.remindersEnabled).toBeNull()
  })

  it('toggleWeightUnit flips between kg and lb', () => {
    useSettingsStore.getState().toggleWeightUnit()
    expect(useSettingsStore.getState().weightUnit).toBe('lb')
    useSettingsStore.getState().toggleWeightUnit()
    expect(useSettingsStore.getState().weightUnit).toBe('kg')
  })

  it('persists weightUnit to localStorage', () => {
    useSettingsStore.getState().toggleWeightUnit()
    const raw = localStorage.getItem('fittrack-settings')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).state.weightUnit).toBe('lb')
  })

  it('persists an explicit reminders opt-in and opt-out', () => {
    useSettingsStore.getState().setRemindersEnabled(true)
    expect(useSettingsStore.getState().remindersEnabled).toBe(true)
    expect(JSON.parse(localStorage.getItem('fittrack-settings')!).state.remindersEnabled).toBe(true)

    useSettingsStore.getState().setRemindersEnabled(false)
    expect(useSettingsStore.getState().remindersEnabled).toBe(false)
  })

  it('defaults the Library to the list layout and persists a switch to grid', () => {
    expect(useSettingsStore.getState().libraryView).toBe('list')
    useSettingsStore.getState().setLibraryView('grid')
    expect(useSettingsStore.getState().libraryView).toBe('grid')
    expect(JSON.parse(localStorage.getItem('fittrack-settings')!).state.libraryView).toBe('grid')
  })

  describe('backup tracking', () => {
    const NOW = new Date(2026, 10, 11, 9, 0, 0)

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('starts with no backup and no snooze recorded', () => {
      expect(useSettingsStore.getState().lastBackupAt).toBeNull()
      expect(useSettingsStore.getState().backupReminderSnoozedAt).toBeNull()
    })

    it('records and persists when a backup was made', () => {
      useSettingsStore.getState().markBackedUp()
      expect(useSettingsStore.getState().lastBackupAt).toBe(NOW.getTime())
      expect(JSON.parse(localStorage.getItem('fittrack-settings')!).state.lastBackupAt).toBe(NOW.getTime())
    })

    it('records when the reminder was put off', () => {
      useSettingsStore.getState().snoozeBackupReminder()
      expect(useSettingsStore.getState().backupReminderSnoozedAt).toBe(NOW.getTime())
    })
  })
})
