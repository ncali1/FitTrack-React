/**
 * The Library grid's picture: a 3D snapshot when it can be drawn, the still 2D diagram
 * otherwise. WebGL and the snapshot renderer are mocked — happy-dom can't draw either.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { FigureThumbnail } from './FigureThumbnail'
import { supportsWebGL } from '@/services/webgl'

vi.mock('@/services/webgl', () => ({ supportsWebGL: vi.fn(() => true) }))
const snapshot = vi.hoisted(() => ({ figureSnapshot: vi.fn() }))
vi.mock('./figureSnapshot', () => snapshot)

describe('FigureThumbnail', () => {
  beforeEach(() => {
    vi.mocked(supportsWebGL).mockReturnValue(true)
    snapshot.figureSnapshot.mockReset().mockResolvedValue('blob:figure')
    // No observer: draws straight away, the same path older browsers take.
    vi.stubGlobal('IntersectionObserver', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a snapshot of the 3D character for an exercise with a movement pattern', async () => {
    const { container } = render(<FigureThumbnail targetMuscleGroups={['Chest']} pattern="press" />)

    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:figure'))
    expect(snapshot.figureSnapshot).toHaveBeenCalledWith('press', ['Chest'])
    expect(container.querySelector('[data-region-active]')).toBeNull()
  })

  it('poses a custom exercise (no movement pattern) standing, like every other tile', async () => {
    const { container } = render(<FigureThumbnail targetMuscleGroups={['Chest']} />)

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    expect(snapshot.figureSnapshot).toHaveBeenCalledWith('stand', ['Chest'])
  })

  it('uses the still 2D diagram when the device has no WebGL', () => {
    vi.mocked(supportsWebGL).mockReturnValue(false)
    const { container } = render(<FigureThumbnail targetMuscleGroups={['Chest']} pattern="press" />)

    expect(container.querySelector('[data-region-active="true"]')).not.toBeNull()
    expect(snapshot.figureSnapshot).not.toHaveBeenCalled()
  })

  it('falls back to the 2D diagram if the snapshot fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    snapshot.figureSnapshot.mockRejectedValue(new Error('context lost'))
    const { container } = render(<FigureThumbnail targetMuscleGroups={['Chest']} pattern="press" />)

    await waitFor(() => expect(container.querySelector('[data-region-active="true"]')).not.toBeNull())
    expect(container.querySelector('img')).toBeNull()
    expect(error).toHaveBeenCalled()
  })
})
