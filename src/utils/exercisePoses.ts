/**
 * Keyframes for the 3D exercise preview's character: each movement pattern is two poses
 * (start and end of a rep) that the preview eases back and forth between. Kept as plain
 * data, free of three.js, so the animation itself can be unit-tested.
 *
 * Rig conventions (three.js, Y up, the figure facing +Z, every limb hanging along its
 * parent's −Y at rest): a negative X rotation swings a limb forward, a positive one back;
 * a positive Z rotation swings it toward +X, which is the figure's left. So a left-arm
 * lateral raise is `shoulderL.z = +π/2` and the right arm mirrors it with `−π/2`.
 */
import type { MovementPattern } from './muscleRegions'

export const JOINTS = [
  'spine',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
  'hipL',
  'kneeL',
  'hipR',
  'kneeR',
] as const
export type Joint = (typeof JOINTS)[number]

/** Euler rotation in radians, applied in three.js's default XYZ order. */
export type Rotation = [x: number, y: number, z: number]

export interface Pose {
  joints: Partial<Record<Joint, Rotation>>
  /** Whole-body offset (figure units, ~1.8 tall) — e.g. dropping into a squat. */
  root?: { y?: number; z?: number }
}

interface Movement {
  from: Pose
  to: Pose
  /** One full rep, start → end → start. */
  seconds: number
}

const HALF_PI = Math.PI / 2

/** Mirrors left-side rotations onto the right: Z (sideways) flips, X (fore/aft) doesn't. */
function bothSides(left: Partial<Record<'shoulder' | 'elbow' | 'hip' | 'knee', Rotation>>): Pose['joints'] {
  const joints: Pose['joints'] = {}
  for (const [part, [x, y, z]] of Object.entries(left) as [string, Rotation][]) {
    joints[`${part}L` as Joint] = [x, y, z]
    joints[`${part}R` as Joint] = [x, -y, -z]
  }
  return joints
}

/** Torso lean for the bent-over row; the arms counter-rotate by it to hang plumb. */
const ROW_LEAN = 0.9

const MOVEMENTS: Partial<Record<MovementPattern, Movement>> = {
  // Overhead press: hands at the shoulders (upper arms out, forearms up) → arms locked out.
  press: {
    from: { joints: bothSides({ shoulder: [0, 0, HALF_PI], elbow: [0, 0, HALF_PI] }) },
    to: { joints: bothSides({ shoulder: [0, 0, Math.PI - 0.15], elbow: [0, 0, 0] }) },
    seconds: 2.4,
  },
  // Bent-over row: arms hanging plumb from a forward-leaning torso → elbows pulled back.
  row: {
    from: {
      joints: { spine: [ROW_LEAN, 0, 0], ...bothSides({ shoulder: [-ROW_LEAN, 0, 0], hip: [-0.3, 0, 0], knee: [0.3, 0, 0] }) },
    },
    to: {
      joints: { spine: [ROW_LEAN, 0, 0], ...bothSides({ shoulder: [0.2, 0, 0.15], elbow: [-1.1, 0, 0], hip: [-0.3, 0, 0], knee: [0.3, 0, 0] }) },
    },
    seconds: 2.2,
  },
  // Lateral raise: arms by the sides → out to shoulder height, elbows soft.
  raise: {
    from: { joints: bothSides({ shoulder: [0, 0, 0.12], elbow: [0, 0, 0.15] }) },
    to: { joints: bothSides({ shoulder: [0, 0, HALF_PI], elbow: [0, 0, 0.15] }) },
    seconds: 2.4,
  },
  // Curl: forearms hanging → curled up to the shoulders, upper arms still.
  curl: {
    from: { joints: bothSides({ shoulder: [-0.08, 0, 0.05], elbow: [-0.15, 0, 0] }) },
    to: { joints: bothSides({ shoulder: [-0.08, 0, 0.05], elbow: [-2.3, 0, 0] }) },
    seconds: 2,
  },
  // Squat: standing → hips back and down to about parallel, arms forward for balance.
  // The root shifts back as it drops so the feet stay roughly planted.
  bob: {
    from: { joints: bothSides({ shoulder: [-0.2, 0, 0] }) },
    to: {
      joints: { spine: [0.5, 0, 0], ...bothSides({ shoulder: [-1.5, 0, 0], hip: [-1.3, 0, 0], knee: [1.6, 0, 0] }) },
      root: { y: -0.35, z: -0.3 },
    },
    seconds: 2.6,
  },
}

/** Whether a pattern has 3D keyframes yet — the rest keep the 2D diagram. */
export function hasPose3D(pattern: MovementPattern | undefined): pattern is MovementPattern {
  return pattern !== undefined && pattern in MOVEMENTS
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The pose `seconds` into an endlessly repeating rep, eased so each end of the movement
 * slows to a stop like a controlled rep rather than bouncing. Joints missing from a
 * keyframe count as rest (zero rotation). Returns `null` for patterns without keyframes.
 */
export function poseAt(pattern: MovementPattern, seconds: number): Pose | null {
  const movement = MOVEMENTS[pattern]
  if (!movement) return null

  // 0 → 1 → 0 over one rep, cosine-eased.
  const t = (1 - Math.cos((2 * Math.PI * seconds) / movement.seconds)) / 2
  const { from, to } = movement

  const joints: Pose['joints'] = {}
  for (const joint of JOINTS) {
    const a = from.joints[joint]
    const b = to.joints[joint]
    if (!a && !b) continue
    const [ax, ay, az] = a ?? [0, 0, 0]
    const [bx, by, bz] = b ?? [0, 0, 0]
    joints[joint] = [lerp(ax, bx, t), lerp(ay, by, t), lerp(az, bz, t)]
  }

  return {
    joints,
    root: {
      y: lerp(from.root?.y ?? 0, to.root?.y ?? 0, t),
      z: lerp(from.root?.z ?? 0, to.root?.z ?? 0, t),
    },
  }
}

/** Seconds into the rep at its far end — the most telling still frame when motion is off. */
export function peakSeconds(pattern: MovementPattern): number {
  return (MOVEMENTS[pattern]?.seconds ?? 0) / 2
}
