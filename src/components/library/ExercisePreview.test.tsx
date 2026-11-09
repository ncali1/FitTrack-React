import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import { ExercisePreview } from './ExercisePreview'
import { supportsWebGL } from '@/services/webgl'

vi.mock('@/services/webgl', () => ({ supportsWebGL: vi.fn(() => true) }))

/** Stand-in for the WebGL scene, which happy-dom can't draw; `fail` simulates a renderer error. */
const scene = vi.hoisted(() => ({ fail: false }))
vi.mock('./ExercisePreview3D', () => ({
  default: function FakeScene({ onError, pattern }: { onError: () => void; pattern: string }) {
    useEffect(() => {
      if (scene.fail) onError()
    }, [onError])
    return <span data-pose={pattern}>3D scene</span>
  },
}))

describe('ExercisePreview', () => {
  beforeEach(() => {
    scene.fail = false
    vi.mocked(supportsWebGL).mockReturnValue(true)
  })

  it('shows the 3D scene for an exercise with a movement pattern', async () => {
    render(<ExercisePreview targetMuscleGroups={['Biceps']} pattern="curl" />)
    expect(await screen.findByText('3D scene')).toBeTruthy()
    expect(screen.getByRole('img', { name: /3D preview/ })).toBeTruthy()
  })

  it('shows the 3D figure standing for a custom exercise with no movement pattern', async () => {
    render(<ExercisePreview targetMuscleGroups={['Chest']} />)
    expect((await screen.findByText('3D scene')).getAttribute('data-pose')).toBe('stand')
  })

  it('falls back to the 2D diagram on devices without WebGL', () => {
    vi.mocked(supportsWebGL).mockReturnValue(false)
    render(<ExercisePreview targetMuscleGroups={['Biceps']} pattern="curl" />)
    expect(screen.getByText('Front')).toBeTruthy()
    expect(screen.queryByText('3D scene')).toBeNull()
  })

  it('falls back to the 2D diagram when the 3D renderer fails to start', async () => {
    scene.fail = true
    render(<ExercisePreview targetMuscleGroups={['Biceps']} pattern="curl" />)
    expect(await screen.findByText('Front')).toBeTruthy()
    expect(screen.queryByRole('img', { name: /3D preview/ })).toBeNull()
  })
})
