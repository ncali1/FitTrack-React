import { create } from 'zustand'

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

function todayString(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

/**
 * Zustand store for global UI state: selected date/exercise, progress time range, and
 * the active navigation tab.
 */
export const useUIStore = create<UIState>()((set) => ({
  selectedDate: todayString(),
  selectedExercise: null,
  timeRange: {
    start: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string,
    end: todayString(),
  },
  activeTab: 'exercises',

  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedExercise: (exerciseId) => set({ selectedExercise: exerciseId }),
  setTimeRange: (start, end) => set({ timeRange: { start, end } }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
