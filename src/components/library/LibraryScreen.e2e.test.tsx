/**
 * End-to-end tests for the Library tab's two views: browsing the built-in catalog and
 * managing the user's own exercises (moved here from Profile).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryScreen } from './LibraryScreen'
import { useExercisesStore } from '@/stores/exercises'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveExercise: vi.fn(async () => {}),
    getAllExercises: vi.fn(async () => []),
    deleteExercise: vi.fn(async () => {}),
    getAllRoutines: vi.fn(async () => []),
    getAllWorkoutTemplates: vi.fn(async () => []),
    getAllWorkoutSessions: vi.fn(async () => []),
  },
}))

const INITIAL_EXERCISES = useExercisesStore.getState()

describe('E2E: Library tab', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
  })

  it('opens on the built-in catalog', () => {
    render(<LibraryScreen />)

    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { level: 3, name: 'Barbell Bench Press' })).toBeTruthy()
  })

  it('switches to "My exercises", where a new exercise can be created', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen />)

    await user.click(screen.getByRole('tab', { name: 'My exercises' }))

    expect(screen.getByRole('tab', { name: 'My exercises' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('heading', { level: 3, name: 'Barbell Bench Press' })).toBeNull()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add exercise/i })).toBeTruthy()
    })
  })

  it('lists the user\'s own exercises under "My exercises"', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Cable Fly', 3, 12, ['Chest'])
    vi.mocked((await import('@/services/storage')).storageService.getAllExercises).mockResolvedValue(
      useExercisesStore.getState().exercises
    )
    render(<LibraryScreen />)

    await user.click(screen.getByRole('tab', { name: 'My exercises' }))

    expect(await screen.findByText('Cable Fly')).toBeTruthy()
  })
})
