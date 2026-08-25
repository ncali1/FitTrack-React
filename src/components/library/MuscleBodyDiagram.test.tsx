import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MuscleBodyDiagram } from './MuscleBodyDiagram'

describe('MuscleBodyDiagram', () => {
  it('renders a front and back view', () => {
    const { getByRole } = render(<MuscleBodyDiagram targetMuscleGroups={['Chest']} />)
    expect(getByRole('img', { name: /front of body/i })).toBeTruthy()
    expect(getByRole('img', { name: /back of body/i })).toBeTruthy()
  })

  it('highlights a front-visible region (chest) and leaves a back-only region (back) neutral', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={['Chest']} />)
    expect(container.querySelectorAll('[data-region-active="true"]').length).toBeGreaterThan(0)
  })

  it('highlights nothing when given no muscle groups', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={[]} />)
    expect(container.querySelectorAll('[data-region-active="true"]').length).toBe(0)
  })

  it('highlights a back-only region (Back) so a back-targeting exercise is not shown as blank', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={['Back']} />)
    expect(container.querySelectorAll('[data-region-active="true"]').length).toBeGreaterThan(0)
  })

  it('fills an active region with its own instance-scoped active gradient (no id collisions between front/back)', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={['Chest']} />)
    const activeShapes = Array.from(container.querySelectorAll('[data-region-active="true"]'))
    expect(activeShapes.length).toBeGreaterThan(0)
    for (const shape of activeShapes) {
      expect(shape.getAttribute('fill')).toMatch(/^url\(#.+-active\)$/)
    }
    // Every referenced gradient id must actually exist in the document exactly once.
    for (const shape of activeShapes) {
      const id = shape.getAttribute('fill')!.slice(5, -1)
      expect(container.querySelectorAll(`#${CSS.escape(id)}`).length).toBe(1)
    }
  })

  it('applies no rep-loop animation classes when no pattern is given', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={['Chest']} />)
    expect(container.querySelectorAll('[class*="anim-"]').length).toBe(0)
  })

  it('applies a whole-arm animation class to both arms, on both the front and back views, for a "press" pattern', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={['Chest']} pattern="press" />)
    // 2 arms x 2 views (front + back both render arm geometry).
    expect(container.querySelectorAll('.anim-press').length).toBe(4)
  })

  it('applies the elbow-hinge animation only to the forearm sub-group for a "curl" pattern', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={['Biceps']} pattern="curl" />)
    expect(container.querySelector('.anim-curl-left')).toBeTruthy()
    expect(container.querySelector('.anim-curl-right')).toBeTruthy()
    // Curl only bends the forearm — the whole-arm press/row/raise classes should be absent.
    expect(container.querySelectorAll('.anim-press, .anim-row-left, .anim-raise-left').length).toBe(0)
  })

  it('applies a whole-figure animation class to both views for a "bob" pattern', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={['Quadriceps']} pattern="bob" />)
    expect(container.querySelectorAll('.anim-bob').length).toBe(2)
  })

  it('applies the bridge animation to the glutes region for a "bridge" pattern', () => {
    const { container } = render(<MuscleBodyDiagram targetMuscleGroups={['Glutes']} pattern="bridge" />)
    expect(container.querySelector('ellipse.anim-bridge')).toBeTruthy()
  })
})
