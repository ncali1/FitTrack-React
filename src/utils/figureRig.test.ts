import { describe, it, expect } from 'vitest'
import { BONE_FOR_JOINT, JOINT_ORDER, PARENT_JOINT, regionForVertex } from './figureRig'
import { JOINTS } from './exercisePoses'

describe('figureRig', () => {
  it('drives a bone for every pose joint, posing parents before children', () => {
    expect(new Set(JOINT_ORDER)).toEqual(new Set(JOINTS))
    for (const joint of JOINTS) expect(BONE_FOR_JOINT[joint]).toBeTruthy()
    for (const [child, parent] of Object.entries(PARENT_JOINT)) {
      expect(JOINT_ORDER.indexOf(parent)).toBeLessThan(JOINT_ORDER.indexOf(child as (typeof JOINTS)[number]))
    }
  })

  it('splits the upper arm into deltoid, biceps and triceps', () => {
    expect(regionForVertex('upperarm_l', true, 0.05)).toBe('shoulders')
    expect(regionForVertex('upperarm_r', true, 0.2)).toBe('biceps')
    expect(regionForVertex('upperarm_l', false, 0.2)).toBe('triceps')
    // Clavicles carry the upper chest and traps too; only around the shoulder joint is deltoid.
    expect(regionForVertex('clavicle_r', true, 0.15, 0.2)).toBeNull()
    expect(regionForVertex('clavicle_l', true, 0.2, 0.05)).toBe('shoulders')
  })

  it('splits the torso front and back', () => {
    expect(regionForVertex('spine_03', true, 0.1)).toBe('chest')
    expect(regionForVertex('spine_03', false, 0.1)).toBe('back')
    expect(regionForVertex('spine_01', true, 0.1)).toBe('core')
    expect(regionForVertex('spine_02', false, 0.1)).toBe('back')
    expect(regionForVertex('pelvis', false, 0.1)).toBe('glutes')
    expect(regionForVertex('pelvis', true, 0.1)).toBeNull()
  })

  it('splits the legs into quads, glutes, hamstrings and calves', () => {
    expect(regionForVertex('thigh_l', true, 0.3)).toBe('quadriceps')
    expect(regionForVertex('thigh_l', false, 0.05)).toBe('glutes')
    expect(regionForVertex('thigh_r', false, 0.3)).toBe('hamstrings')
    expect(regionForVertex('calf_l', false, 0.2)).toBe('calves')
    expect(regionForVertex('calf_l', true, 0.2)).toBeNull()
  })

  it('leaves untargeted parts unhighlighted', () => {
    for (const bone of ['Head', 'neck_01', 'hand_l', 'index_02_r', 'foot_l', 'ball_r']) {
      expect(regionForVertex(bone, true, 0.05)).toBeNull()
    }
    expect(regionForVertex('lowerarm_l', true, 0.1)).toBe('forearms')
  })
})
