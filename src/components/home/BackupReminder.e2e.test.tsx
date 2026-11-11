/**
 * Home's backup reminder: shown when an account-less device has gone a month without an
 * export, hidden for signed-in users and new users, and dismissed by exporting or "Later".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupReminder } from './BackupReminder'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useCardioStore } from '@/stores/cardio'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { createMockWorkoutSession } from '@/tests/factories'

vi.mock('@/services/storage', () => ({
  storageService: {
    getAllExercises: vi.fn(async () => []),
    getAllRoutines: vi.fn(async () => []),
    getAllWorkoutTemplates: vi.fn(async () => []),
    getAllWorkoutSessions: vi.fn(async () => []),
    getAllBodyWeightLogs: vi.fn(async () => []),
    getAllCardioSessions: vi.fn(async () => []),
  },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()
const INITIAL_CARDIO = useCardioStore.getState()
const INITIAL_BODY_WEIGHT = useBodyWeightStore.getState()
const INITIAL_SETTINGS = useSettingsStore.getState()
const INITIAL_AUTH = useAuthStore.getState()

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 10, 11, 9, 0, 0)

/** A logged session created `daysAgo` days before NOW. */
function sessionFrom(daysAgo: number) {
  const at = NOW.getTime() - daysAgo * DAY
  return createMockWorkoutSession({ createdAt: at, updatedAt: at })
}

describe('BackupReminder', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    localStorage.clear()
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useCardioStore.setState(INITIAL_CARDIO, true)
    useBodyWeightStore.setState(INITIAL_BODY_WEIGHT, true)
    useSettingsStore.setState(INITIAL_SETTINGS, true)
    useAuthStore.setState(INITIAL_AUTH, true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows nothing for a new user', () => {
    useWorkoutSessionsStore.setState({ sessions: [sessionFrom(3)] })
    render(<BackupReminder />)

    expect(screen.queryByRole('heading', { name: /back up your log/i })).toBeNull()
  })

  it('reminds an account-less user whose history is a month old and was never exported', () => {
    useWorkoutSessionsStore.setState({ sessions: [sessionFrom(45), sessionFrom(1)] })
    render(<BackupReminder />)

    expect(screen.getByRole('heading', { name: /back up your log/i })).toBeInTheDocument()
    expect(screen.getByText(/last backup · never/i)).toBeInTheDocument()
  })

  it('shows nothing when signed in, since the cloud already holds a copy', () => {
    useWorkoutSessionsStore.setState({ sessions: [sessionFrom(45)] })
    useAuthStore.setState({ cloudEnabled: true, user: { id: 'u1' } as never })
    render(<BackupReminder />)

    expect(screen.queryByRole('heading', { name: /back up your log/i })).toBeNull()
  })

  it('hides for a week after "Later"', async () => {
    useWorkoutSessionsStore.setState({ sessions: [sessionFrom(45)] })
    const user = userEvent.setup()
    render(<BackupReminder />)

    await user.click(screen.getByRole('button', { name: /later/i }))

    expect(screen.queryByRole('heading', { name: /back up your log/i })).toBeNull()
    expect(useSettingsStore.getState().backupReminderSnoozedAt).toBe(NOW.getTime())
  })

  it('exports a backup, records when, and goes away', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    useWorkoutSessionsStore.setState({ sessions: [sessionFrom(45)] })
    const user = userEvent.setup()
    render(<BackupReminder />)

    await user.click(screen.getByRole('button', { name: /export backup/i }))

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('heading', { name: /back up your log/i })).toBeNull())
    expect(useSettingsStore.getState().lastBackupAt).toBe(NOW.getTime())
  })
})
