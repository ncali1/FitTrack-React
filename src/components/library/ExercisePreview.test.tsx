import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import { ExercisePreview } from './ExercisePreview'
import { supportsWebGL } from '@/services/webgl'

vi.mock('@/services/webgl', () => ({ supportsWebGL: vi.fn(() => true) }))

/** Stand-in for the WebGL scene, which happy-dom can't draw; `fail` simulates a renderer error. */
const scene = vi.hoisted(() => ({ fail: false }))
vi.mock('./ExercisePreview3D', () => ({
  default: function FakeScene({ onError }: { onError: () => void }) {
    useEffect(() => {
      if (scene.fail) onError()
    }, [onError])
    return <span>3D scene</span>
  },
}))

describe('ExercisePreview', () => {
  beforeEach(() => {
    scene.fail = false
    vi.mocked(supportsWebGL).mockReturnValue(true)
  })

  it('shows the 3D scene for a pattern with 3D keyframes', async () => {
    render(<ExercisePreview targetMuscleGroups={['Biceps']} pattern="curl" />)
    expect(await screen.findByText('3D scene')).toBeTruthy()
    expect(screen.getByRole('img', { name: /3D preview/ })).toBeTruthy()
  })

  it('keeps the 2D diagram for patterns without 3D keyframes yet', () => {
    render(<ExercisePreview targetMuscleGroups={['Core']} pattern="twist" />)
    expect(screen.getByText('Front')).toBeTruthy()
    expect(screen.queryByRole('img', { name: /3D preview/ })).toBeNull()
  })

  it('keeps the 2D diagram for exercises with no movement pattern', () => {
    render(<ExercisePreview targetMuscleGroups={['Chest']} />)
    expect(screen.getByText('Front')).toBeTruthy()
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
