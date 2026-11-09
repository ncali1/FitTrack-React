import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WeightUnit } from '@/utils/units'
import type { DistanceUnit } from '@/utils/cardio'

const DEFAULT_REST_SECONDS = 90

/** How the Library tab lays out exercises: ruled rows, or tiles with a muscle diagram. */
export type LibraryView = 'list' | 'grid'

interface SettingsState {
  weightUnit: WeightUnit
  /** Display unit for cardio distances; stored distances are always km. */
  distanceUnit: DistanceUnit
  restDuration: number
  /** `null` means the user has never been asked yet (first-run state). */
  remindersEnabled: boolean | null
  /** Play a short tone when a rest period ends. */
  restTimerSound: boolean
  /** Vibrate when a rest period ends (on devices that support it). */
  restTimerVibrate: boolean
  /** Keep the screen from sleeping during a guided workout or while a rest timer runs. */
  keepScreenAwake: boolean
  libraryView: LibraryView

  toggleWeightUnit: () => void
  setDistanceUnit: (unit: DistanceUnit) => void
  setRestDuration: (seconds: number) => void
  setRemindersEnabled: (enabled: boolean) => void
  setRestTimerSound: (enabled: boolean) => void
  setRestTimerVibrate: (enabled: boolean) => void
  setKeepScreenAwake: (enabled: boolean) => void
  setLibraryView: (view: LibraryView) => void
}

/**
 * Small persisted user preferences: weight display unit, default rest timer duration,
 * rest-timer alerts, screen wake lock, Library layout, and whether local workout reminders are enabled. Persisted to localStorage (not
 * IndexedDB) since these are per-device display preferences, not workout data.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      weightUnit: 'kg',
      distanceUnit: 'km',
      restDuration: DEFAULT_REST_SECONDS,
      remindersEnabled: null,
      restTimerSound: false,
      restTimerVibrate: true,
      keepScreenAwake: true,
      libraryView: 'list',

      toggleWeightUnit: () => set((state) => ({ weightUnit: state.weightUnit === 'kg' ? 'lb' : 'kg' })),
      setDistanceUnit: (unit) => set({ distanceUnit: unit }),
      setRestDuration: (seconds) => set({ restDuration: seconds }),
      setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),
      setRestTimerSound: (enabled) => set({ restTimerSound: enabled }),
      setRestTimerVibrate: (enabled) => set({ restTimerVibrate: enabled }),
      setKeepScreenAwake: (enabled) => set({ keepScreenAwake: enabled }),
      setLibraryView: (view) => set({ libraryView: view }),
    }),
    { name: 'fittrack-settings' }
  )
)
