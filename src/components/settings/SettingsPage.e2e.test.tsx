/**
 * End-to-end tests for SettingsPage: each preference control, and both the export and
 * import outcomes of the backup flow.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from './SettingsPage'
import { useSettingsStore } from '@/stores/settings'
import { BACKUP_VERSION } from '@/utils/exportData'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveExercise: vi.fn(async () => {}),
    getExercise: vi.fn(async () => undefined),
    getAllExercises: vi.fn(async () => []),
    deleteExercise: vi.fn(async () => {}),
    saveRoutine: vi.fn(async () => {}),
    getAllRoutines: vi.fn(async () => []),
    deleteRoutine: vi.fn(async () => {}),
    saveWorkoutSession: vi.fn(async () => {}),
    getWorkoutSession: vi.fn(async () => undefined),
    getWorkoutSessionByDate: vi.fn(async () => undefined),
    getAllWorkoutSessions: vi.fn(async () => []),
    deleteWorkoutSession: vi.fn(async () => {}),
    saveBodyWeightLog: vi.fn(async () => {}),
    getAllBodyWeightLogs: vi.fn(async () => []),
    deleteBodyWeightLog: vi.fn(async () => {}),
    clearAllData: vi.fn(async () => {}),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { storageService } from '@/services/storage'
import { toast } from 'sonner'

const mockedStorage = vi.mocked(storageService)
const mockedToast = vi.mocked(toast)

const INITIAL_SETTINGS = useSettingsStore.getState()

function makeFile(contents: string, name = 'backup.json'): File {
  return new File([contents], name, { type: 'application/json' })
}

describe('E2E: Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState(INITIAL_SETTINGS, true)
  })

  it('toggles the weight unit', async () => {
    const user = userEvent.setup()
    render(<SettingsPage onClose={() => {}} />)

    expect(useSettingsStore.getState().weightUnit).toBe('kg')
    await user.click(screen.getByRole('button', { name: /pounds \(lb\)/i }))
    expect(useSettingsStore.getState().weightUnit).toBe('lb')

    await user.click(screen.getByRole('button', { name: /kilograms \(kg\)/i }))
    expect(useSettingsStore.getState().weightUnit).toBe('kg')
  })

  it('sets the default rest timer duration from presets', async () => {
    const user = userEvent.setup()
    render(<SettingsPage onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: '120s' }))
    expect(useSettingsStore.getState().restDuration).toBe(120)

    await user.click(screen.getByRole('button', { name: '30s' }))
    expect(useSettingsStore.getState().restDuration).toBe(30)
  })

  it('toggles workout reminders enabled/disabled', async () => {
    const user = userEvent.setup()
    render(<SettingsPage onClose={() => {}} />)

    expect(screen.getByRole('button', { name: /disabled/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /disabled/i }))
    expect(useSettingsStore.getState().remindersEnabled).toBe(true)
    expect(screen.getByRole('button', { name: /enabled/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /enabled/i }))
    expect(useSettingsStore.getState().remindersEnabled).toBe(false)
  })

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SettingsPage onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exports a backup and shows a success toast', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<SettingsPage onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => {
      expect(mockedToast.success).toHaveBeenCalledWith(expect.stringMatching(/downloaded/i))
    })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('imports a valid backup, restores it, reloads every store, and shows a success toast with counts', async () => {
    const exercise = { id: 'ex-1', name: 'Squats', targetSets: 4, targetReps: 12, targetMuscleGroups: ['Legs'], createdAt: 1, updatedAt: 1 }
    const backupJson = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      exercises: [exercise],
      routines: [],
      workoutSessions: [],
      bodyWeightLogs: [],
    }
    const file = makeFile(JSON.stringify(backupJson))

    const user = userEvent.setup()
    render(<SettingsPage onClose={() => {}} />)

    const input = screen.getByLabelText(/import backup file/i)
    await user.upload(input, file)

    await waitFor(() => {
      expect(mockedStorage.saveExercise).toHaveBeenCalledWith(exercise)
    })

    await waitFor(() => {
      expect(mockedToast.success).toHaveBeenCalledWith(expect.stringMatching(/1 exercises/))
    })

    expect(mockedStorage.getAllExercises).toHaveBeenCalled()
    expect(mockedStorage.getAllRoutines).toHaveBeenCalled()
    expect(mockedStorage.getAllWorkoutSessions).toHaveBeenCalled()
    expect(mockedStorage.getAllBodyWeightLogs).toHaveBeenCalled()
  })

  it('shows an error toast and restores nothing when the imported file is malformed', async () => {
    const file = makeFile('{not valid json')

    const user = userEvent.setup()
    render(<SettingsPage onClose={() => {}} />)

    const input = screen.getByLabelText(/import backup file/i)
    await user.upload(input, file)

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalled()
    })
    expect(mockedStorage.saveExercise).not.toHaveBeenCalled()
  })
})
