import { create } from 'zustand'
import { addDays, todayString } from '@/utils/calculations'

interface TimeRange {
  start: string
  end: string
}

interface UIState {
  /** Currently viewed date (YYYY-MM-DD), defaults to today. */
  selectedDate: string
  /** ID of the exercise selected in the Progress Graphs view, or null. */
  selectedExercise: string | null
  /** Date range used by the progress graph. */
  timeRange: TimeRange
  /** Identifier of the currently visible navigation tab. */
  activeTab: string

  setSelectedDate: (date: string) => void
  setSelectedExercise: (exerciseId: string | null) => void
  setTimeRange: (start: string, end: string) => void
  setActiveTab: (tab: string) => void
}

/**
 * Zustand store for global UI state: selected date/exercise, progress time range, and
 * the active navigation tab.
 */
export const useUIStore = create<UIState>()((set) => ({
  selectedDate: todayString(),
  selectedExercise: null,
  timeRange: {
    start: addDays(todayString(), -28),
    end: todayString(),
  },
  activeTab: 'home',

  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedExercise: (exerciseId) => set({ selectedExercise: exerciseId }),
  setTimeRange: (start, end) => set({ timeRange: { start, end } }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
