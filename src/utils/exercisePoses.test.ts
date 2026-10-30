import { describe, it, expect } from 'vitest'
import { hasPose3D, peakSeconds, poseAt } from './exercisePoses'
import type { Rotation } from './exercisePoses'

const closeTo = ([x, y, z]: Rotation) => [expect.closeTo(x, 6), expect.closeTo(y, 6), expect.closeTo(z, 6)]

describe('exercisePoses', () => {
  it('has keyframes for the prototype patterns only', () => {
    for (const pattern of ['press', 'row', 'raise', 'curl', 'bob'] as const) expect(hasPose3D(pattern)).toBe(true)
    for (const pattern of ['lean', 'bridge', 'rise', 'pulse', 'twist'] as const) {
      expect(hasPose3D(pattern)).toBe(false)
      expect(poseAt(pattern, 0)).toBeNull()
    }
    expect(hasPose3D(undefined)).toBe(false)
  })

  it('starts a rep at the start pose and reaches the end pose halfway through', () => {
    expect(poseAt('curl', 0)!.joints.elbowL).toEqual(closeTo([-0.15, 0, 0]))
    expect(poseAt('curl', peakSeconds('curl'))!.joints.elbowL).toEqual(closeTo([-2.3, 0, 0]))
  })

  it('loops back to the start pose after one full rep', () => {
    const rep = peakSeconds('press') * 2
    expect(poseAt('press', rep)!.joints.shoulderL).toEqual(closeTo(poseAt('press', 0)!.joints.shoulderL!))
    expect(poseAt('press', rep * 3.25)!.joints.elbowL).toEqual(closeTo(poseAt('press', rep * 0.25)!.joints.elbowL!))
  })

  it('mirrors sideways rotations onto the right side', () => {
    const peak = poseAt('raise', peakSeconds('raise'))!
    expect(peak.joints.shoulderL![2]).toBeCloseTo(Math.PI / 2)
    expect(peak.joints.shoulderR![2]).toBeCloseTo(-Math.PI / 2)
  })

  it('treats a joint missing from one keyframe as at rest', () => {
    // The squat's start pose leaves the hips at rest; the end pose bends them.
    expect(poseAt('bob', 0)!.joints.hipL).toEqual(closeTo([0, 0, 0]))
    expect(poseAt('bob', peakSeconds('bob'))!.joints.hipL).toEqual(closeTo([-1.3, 0, 0]))
  })

  it('moves the whole body only for movements that need it', () => {
    expect(poseAt('bob', peakSeconds('bob'))!.root).toEqual({ y: expect.closeTo(-0.35, 6), z: expect.closeTo(-0.3, 6) })
    expect(poseAt('curl', peakSeconds('curl'))!.root).toEqual({ y: 0, z: 0 })
  })

  it('eases between the ends, never overshooting them', () => {
    const rep = peakSeconds('curl') * 2
    for (let s = 0; s <= rep; s += rep / 40) {
      const [x] = poseAt('curl', s)!.joints.elbowL!
      expect(x).toBeLessThanOrEqual(-0.15 + 1e-9)
      expect(x).toBeGreaterThanOrEqual(-2.3 - 1e-9)
    }
  })
})
