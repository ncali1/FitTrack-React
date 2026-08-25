import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WeightUnit } from '@/utils/units'

const DEFAULT_REST_SECONDS = 90

interface SettingsState {
  weightUnit: WeightUnit
  restDuration: number
  /** `null` means the user has never been asked yet (first-run state). */
  remindersEnabled: boolean | null

  toggleWeightUnit: () => void
  setRestDuration: (seconds: number) => void
  setRemindersEnabled: (enabled: boolean) => void
}

/**
 * Small persisted user preferences: weight display unit, default rest timer duration,
 * and whether local workout reminders are enabled. Persisted to localStorage (not
 * IndexedDB) since these are per-device display preferences, not workout data.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      weightUnit: 'kg',
      restDuration: DEFAULT_REST_SECONDS,
      remindersEnabled: null,

      toggleWeightUnit: () => set((state) => ({ weightUnit: state.weightUnit === 'kg' ? 'lb' : 'kg' })),
      setRestDuration: (seconds) => set({ restDuration: seconds }),
      setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),
    }),
    { name: 'fittrack-settings' }
  )
)
