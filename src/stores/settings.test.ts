/**
 * Unit tests for the settings store: weight unit toggle and the reminders
 * opt-in/opt-out preference, both persisted to localStorage via zustand/persist.
 */
import { describe, it, expect, beforeEach } from 'vitest'
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
})
