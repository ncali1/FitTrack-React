/**
 * End-to-end tests for cardio logging: the Train tab's day card and form (log, validate,
 * edit, delete, km/mi), and the Progress tab's weekly summary.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardioDayCard } from './CardioDayCard'
import { CardioSummary } from './CardioSummary'
import { useCardioStore } from '@/stores/cardio'
import { useSettingsStore } from '@/stores/settings'
import { addDays, getWeekStart } from '@/utils/calculations'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveCardioSession: vi.fn(async () => {}),
    getAllCardioSessions: vi.fn(async () => []),
    deleteCardioSession: vi.fn(async () => {}),
  },
}))

const INITIAL_CARDIO = useCardioStore.getState()
const INITIAL_SETTINGS = useSettingsStore.getState()
const DATE = '2026-10-20'

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('E2E: cardio logging', () => {
  beforeEach(() => {
    useCardioStore.setState(INITIAL_CARDIO, true)
    useSettingsStore.setState(INITIAL_SETTINGS, true)
  })

  const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /log cardio/i }))
    return screen.getByRole('dialog', { name: 'Log cardio' })
  }

  it('logs a run for the selected day, showing its pace while typing', async () => {
    const user = userEvent.setup()
    render(<CardioDayCard date={DATE} />)
    expect(screen.getByText('No cardio logged for this day.')).toBeTruthy()

    const form = await openForm(user)
    await user.type(within(form).getByLabelText('Minutes'), '25')
    await user.type(within(form).getByLabelText(/distance/i), '5')
    expect(within(form).getByTestId('cardio-pace')).toHaveTextContent('5:00 /km')
    await user.type(within(form).getByLabelText(/avg heart rate/i), '150')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useCardioStore.getState().sessions).toHaveLength(1)
    })
    expect(useCardioStore.getState().sessions[0]).toMatchObject({
      date: DATE,
      type: 'run',
      durationSeconds: 1500,
      distanceKm: 5,
      avgHeartRate: 150,
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('25:00 · 5 km · 5:00 /km')).toBeTruthy()
    expect(screen.getByText('150 bpm')).toBeTruthy()
  })

  it('logs other types, with distance optional', async () => {
    const user = userEvent.setup()
    render(<CardioDayCard date={DATE} />)

    const form = await openForm(user)
    await user.click(within(form).getByRole('button', { name: 'HIIT' }))
    await user.type(within(form).getByLabelText('Minutes'), '20')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useCardioStore.getState().sessions[0]).toMatchObject({ type: 'hiit', durationSeconds: 1200 })
    })
    expect(useCardioStore.getState().sessions[0]).not.toHaveProperty('distanceKm')
  })

  it('refuses to save without a duration, or with an unrealistic heart rate', async () => {
    const user = userEvent.setup()
    render(<CardioDayCard date={DATE} />)

    const form = await openForm(user)
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    expect(within(form).getByRole('alert')).toHaveTextContent(/how long/i)

    await user.type(within(form).getByLabelText('Minutes'), '30')
    await user.type(within(form).getByLabelText(/avg heart rate/i), '400')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    expect(within(form).getByRole('alert')).toHaveTextContent(/heart rate/i)
    expect(useCardioStore.getState().sessions).toEqual([])
  })

  it('takes distance in miles when that is the chosen unit, storing km', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ distanceUnit: 'mi' })
    render(<CardioDayCard date={DATE} />)

    const form = await openForm(user)
    expect(within(form).getByLabelText('Distance (mi)')).toBeTruthy()
    await user.type(within(form).getByLabelText('Minutes'), '30')
    await user.type(within(form).getByLabelText(/distance/i), '3')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useCardioStore.getState().sessions[0]?.distanceKm).toBeCloseTo(4.828, 2)
    })
    expect(screen.getByText(/3 mi · 10:00 \/mi/)).toBeTruthy()
  })

  it('only lists the selected day, and edits or deletes a session from its row', async () => {
    const user = userEvent.setup()
    const { saveSession } = useCardioStore.getState()
    await saveSession({ date: '2026-10-19', type: 'cycle', durationSeconds: 3600, distanceKm: 30 })
    const walk = await saveSession({ date: DATE, type: 'walk', durationSeconds: 1800 })
    render(<CardioDayCard date={DATE} />)

    expect(screen.queryByText('Cycle')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Edit Walk cardio' }))
    const form = screen.getByRole('dialog', { name: 'Edit cardio' })
    expect(within(form).getByLabelText('Minutes')).toHaveValue(30)
    await user.clear(within(form).getByLabelText('Minutes'))
    await user.type(within(form).getByLabelText('Minutes'), '40')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useCardioStore.getState().sessions.find((s) => s.id === walk.id)?.durationSeconds).toBe(2400)
    })

    vi.stubGlobal('confirm', vi.fn(() => true))
    await user.click(screen.getByRole('button', { name: 'Edit Walk cardio' }))
    await user.click(screen.getByRole('button', { name: 'Delete cardio session' }))
    vi.unstubAllGlobals()

    await waitFor(() => {
      expect(useCardioStore.getState().sessions.map((s) => s.type)).toEqual(['cycle'])
    })
    expect(screen.getByText('No cardio logged for this day.')).toBeTruthy()
  })

  describe('Progress summary', () => {
    it('shows an empty state before any cardio is logged', () => {
      render(<CardioSummary />)
      expect(screen.getByText('No cardio logged yet')).toBeTruthy()
    })

    it("totals this week's sessions against last week's and lists recent ones", async () => {
      const weekStart = getWeekStart(todayString())
      const { saveSession } = useCardioStore.getState()
      await saveSession({ date: weekStart, type: 'run', durationSeconds: 1800, distanceKm: 5 })
      await saveSession({ date: weekStart, type: 'cycle', durationSeconds: 3600, distanceKm: 20 })
      await saveSession({ date: addDays(weekStart, -3), type: 'walk', durationSeconds: 1200, distanceKm: 2 })
      render(<CardioSummary />)

      const tile = (label: string) => screen.getByTestId(`cardio-stat-${label}`)
      expect(within(tile('sessions')).getByText('2')).toBeTruthy()
      expect(within(tile('sessions')).getByText('Last week 1')).toBeTruthy()
      expect(within(tile('time')).getByText('1h 30m')).toBeTruthy()
      expect(within(tile('distance')).getByText('25 km')).toBeTruthy()
      // Dates read as "Today" / "Yesterday" / "Mon, Oct 19", never as raw YYYY-MM-DD.
      expect(screen.queryByText(/^\d{4}-\d{2}-\d{2}$/)).toBeNull()
      expect(screen.getAllByText(/^(Today|Yesterday|(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2})$/)).toHaveLength(3)
      expect(screen.getAllByRole('button', { name: /^Edit .* cardio$/ })).toHaveLength(3)
    })
  })
})
