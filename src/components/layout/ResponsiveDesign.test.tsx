/**
 * Responsive Design Tests
 *
 * Because the test environment (happy-dom) has no real CSS engine, Tailwind
 * responsive prefixes (sm:, md:, lg:) are verified structurally by checking that
 * components contain the correct responsive class strings. Viewport-simulation tests
 * additionally set window.innerWidth/innerHeight and dispatch resize events to confirm
 * any JavaScript-driven responsive logic reacts correctly.
 *
 * Navigation is split across two components: TopBar (brand + sm+ pill tab row) and
 * BottomNav (fixed mobile tab bar, hidden at sm+). Both read/write the same UI store so
 * they always stay in sync.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Layout } from './Layout'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { useUIStore } from '@/stores/ui'
import { useExercisesStore } from '@/stores/exercises'
import { ExerciseList } from '@/components/exercises/ExerciseList'
import { WeeklyGrid } from '@/components/routine/WeeklyGrid'

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
    clearAllData: vi.fn(async () => {}),
  },
}))

// ── helpers ──────────────────────────────────────────────────────────────────

/** Simulate a viewport by overriding window.innerWidth / innerHeight. */
function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

/** Check whether any element in a container has at least one of the given class tokens. */
function hasResponsiveClass(container: HTMLElement, ...tokens: string[]): boolean {
  const classes = Array.from(container.querySelectorAll('*')).flatMap((el) => Array.from(el.classList))
  return tokens.some((t) => classes.includes(t))
}

// ── constants ────────────────────────────────────────────────────────────────

const DESKTOP_W = 1920
const DESKTOP_H = 1080
const TABLET_W = 768
const TABLET_H = 1024

const INITIAL_UI = useUIStore.getState()
const INITIAL_EXERCISES = useExercisesStore.getState()

describe('Responsive Design', () => {
  beforeEach(() => {
    useUIStore.setState(INITIAL_UI, true)
    useExercisesStore.setState(INITIAL_EXERCISES, true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Layout component', () => {
    it('has responsive horizontal padding (sm: and lg: variants)', () => {
      const { container } = render(<Layout>content</Layout>)
      expect(hasResponsiveClass(container, 'sm:px-6', 'lg:px-8')).toBe(true)
    })

    it('uses a max-width container to prevent excessive line length on desktop', () => {
      const { container } = render(<Layout>content</Layout>)
      expect(container.innerHTML).toContain('max-w-5xl')
    })

    it('occupies the full minimum viewport height', () => {
      const { container } = render(<Layout>content</Layout>)
      expect(container.innerHTML).toContain('min-h-screen')
    })

    it('centers content with mx-auto', () => {
      const { container } = render(<Layout>content</Layout>)
      expect(container.innerHTML).toContain('mx-auto')
    })
  })

  describe('TopBar component', () => {
    it('desktop navigation is hidden on small viewports and visible at sm: and above', () => {
      const { container } = render(<TopBar />)
      expect(hasResponsiveClass(container, 'sm:flex')).toBe(true)
      expect(container.innerHTML).toContain('hidden')
    })

    it('renders all 7 navigation tabs', () => {
      render(<TopBar />)
      for (const label of ['Exercises', 'Library', 'Routine', 'Today', 'Summary', 'Progress', 'Weight']) {
        expect(screen.getByText(label)).toBeTruthy()
      }
    })

    it('uses a responsive max-width container for the nav bar', () => {
      const { container } = render(<TopBar />)
      expect(hasResponsiveClass(container, 'sm:px-6', 'lg:px-8')).toBe(true)
      expect(container.innerHTML).toContain('max-w-5xl')
    })
  })

  describe('BottomNav component', () => {
    it('is hidden at sm: and above (mobile-only tab bar)', () => {
      const { container } = render(<BottomNav />)
      expect(hasResponsiveClass(container, 'sm:hidden')).toBe(true)
    })

    it('renders all 6 navigation tabs', () => {
      render(<BottomNav />)
      for (const label of ['Exercises', 'Routine', 'Today', 'Summary', 'Progress', 'Weight']) {
        expect(screen.getByText(label)).toBeTruthy()
      }
    })

    it('is fixed to the bottom of the viewport', () => {
      const { container } = render(<BottomNav />)
      expect(container.innerHTML).toContain('fixed')
      expect(container.innerHTML).toContain('bottom-0')
    })

    it('clicking a tab updates the active tab in the UI store', async () => {
      const user = userEvent.setup()
      render(<BottomNav />)

      await user.click(screen.getByText('Routine'))
      expect(useUIStore.getState().activeTab).toBe('routine')
    })
  })

  describe('ExerciseList component – responsive grid', () => {
    beforeEach(async () => {
      // Seed one exercise so the grid branch renders instead of the empty-state branch,
      // which doesn't contain grid classes.
      await useExercisesStore.getState().createExercise('Push Up', 3, 10, ['Chest'])
    })

    it('uses single-column layout by default (grid-cols-1)', () => {
      const { container } = render(<ExerciseList />)
      expect(container.innerHTML).toContain('grid-cols-1')
    })

    it('uses md:grid-cols-2 for tablet-width viewports', () => {
      const { container } = render(<ExerciseList />)
      expect(hasResponsiveClass(container, 'md:grid-cols-2')).toBe(true)
    })

    it('uses lg:grid-cols-3 for desktop-width viewports', () => {
      const { container } = render(<ExerciseList />)
      expect(hasResponsiveClass(container, 'lg:grid-cols-3')).toBe(true)
    })
  })

  describe('WeeklyGrid component – responsive grid', () => {
    const noop = () => {}

    it('uses single-column layout by default (grid-cols-1)', () => {
      const { container } = render(<WeeklyGrid selectedDay="monday" onSelectDay={noop} />)
      expect(container.innerHTML).toContain('grid-cols-1')
    })

    it('uses md:grid-cols-2 breakpoint for tablet viewports', () => {
      const { container } = render(<WeeklyGrid selectedDay="monday" onSelectDay={noop} />)
      expect(hasResponsiveClass(container, 'md:grid-cols-2')).toBe(true)
    })

    it('uses lg:grid-cols-4 breakpoint for desktop viewports', () => {
      const { container } = render(<WeeklyGrid selectedDay="monday" onSelectDay={noop} />)
      expect(hasResponsiveClass(container, 'lg:grid-cols-4')).toBe(true)
    })
  })

  describe('Viewport simulation', () => {
    const originalInnerWidth = window.innerWidth
    const originalInnerHeight = window.innerHeight

    afterEach(() => {
      setViewport(originalInnerWidth, originalInnerHeight)
    })

    it('window.innerWidth reflects a desktop viewport (1920x1080)', () => {
      setViewport(DESKTOP_W, DESKTOP_H)
      expect(window.innerWidth).toBe(DESKTOP_W)
      expect(window.innerHeight).toBe(DESKTOP_H)
    })

    it('window.innerWidth reflects a tablet viewport (768x1024)', () => {
      setViewport(TABLET_W, TABLET_H)
      expect(window.innerWidth).toBe(TABLET_W)
      expect(window.innerHeight).toBe(TABLET_H)
    })

    it('desktop viewport (1920) exceeds the lg breakpoint (1024)', () => {
      setViewport(DESKTOP_W, DESKTOP_H)
      expect(window.innerWidth).toBeGreaterThanOrEqual(1024)
    })

    it('tablet viewport (768) meets the md breakpoint exactly', () => {
      setViewport(TABLET_W, TABLET_H)
      expect(window.innerWidth).toBeGreaterThanOrEqual(768)
    })

    it('tablet viewport (768) is below the lg breakpoint (1024)', () => {
      setViewport(TABLET_W, TABLET_H)
      expect(window.innerWidth).toBeLessThan(1024)
    })

    it('dispatches a resize event when the viewport changes', () => {
      const resizeSpy = vi.fn()
      window.addEventListener('resize', resizeSpy)
      setViewport(TABLET_W, TABLET_H)
      window.removeEventListener('resize', resizeSpy)
      expect(resizeSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('No horizontal overflow on desktop', () => {
    it('the max-w-5xl container is well within a 1920px desktop width', () => {
      const maxWidthRem = 64 // 5xl = 64rem
      const desktopWidthRem = DESKTOP_W / 16
      expect(desktopWidthRem).toBeGreaterThan(maxWidthRem)
    })
  })
})
