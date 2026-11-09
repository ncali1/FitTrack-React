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
  'ankleL',
  'hipR',
  'kneeR',
  'ankleR',
] as const
export type Joint = (typeof JOINTS)[number]

/** Euler rotation in radians, applied in three.js's default XYZ order. */
export type Rotation = [x: number, y: number, z: number]

export interface Pose {
  joints: Partial<Record<Joint, Rotation>>
  /**
   * Whole-body offset (figure units, ~1.8 tall) — e.g. dropping into a squat — and rotation
   * about the feet, for movements done on the floor: `pitch` about X (−π/2 lies face up,
   * +π/2 face down), `roll` about Z (+π/2 lies on the right side).
   */
  root?: { x?: number; y?: number; z?: number; pitch?: number; roll?: number }
}

interface Movement {
  from: Pose
  to: Pose
  /** One full rep, start → end → start. */
  seconds: number
  /** Turntable angle to view it from, when the default three-quarter view doesn't read. */
  view?: number
}

const HALF_PI = Math.PI / 2

/** Mirrors left-side rotations onto the right: Z (sideways) flips, X (fore/aft) doesn't. */
function bothSides(left: Partial<Record<'shoulder' | 'elbow' | 'hip' | 'knee' | 'ankle', Rotation>>): Pose['joints'] {
  const joints: Pose['joints'] = {}
  for (const [part, [x, y, z]] of Object.entries(left) as [string, Rotation][]) {
    joints[`${part}L` as Joint] = [x, y, z]
    joints[`${part}R` as Joint] = [x, -y, -z]
  }
  return joints
}

/** Torso lean for the bent-over row; the arms counter-rotate by it to hang plumb. */
const ROW_LEAN = 0.9
/** Torso lean for the hip hinge; the arms counter-rotate by it to hang plumb. */
const HINGE_LEAN = 1.1
/** Thigh and shin pose for sitting on the floor with the feet planted. */
const SEATED_LEGS = { hip: [-2, 0, 0], knee: [1, 0, 0], ankle: [1, 0, 0] } satisfies Partial<Record<'hip' | 'knee' | 'ankle', Rotation>>
/** Arms reaching forward with the hands together, as if holding a weight. */
const ARMS_HOLDING = { shoulder: [-0.7, 0, -0.25], elbow: [-0.6, 0, 0] } satisfies Partial<Record<'shoulder' | 'elbow', Rotation>>
/** Forearm plank with the body tipped `lean` off the floor, upper arms plumb and forearms flat. */
function plankPose(lean: number): Pose {
  return {
    joints: bothSides({ shoulder: [lean - HALF_PI, 0, 0], elbow: [-HALF_PI, 0, 0] }),
    root: { pitch: HALF_PI - lean, y: 0.16, z: -0.85 },
  }
}
/** Side plank on the right forearm, tipped `lean` off the floor, top arm reaching straight up. */
function sidePlankPose(lean: number): Pose {
  return {
    joints: {
      shoulderR: [0, 0, lean - HALF_PI],
      elbowR: [-HALF_PI, 0, 0],
      shoulderL: [0, 0, HALF_PI + lean],
      ...bothSides({ hip: [0, 0, -0.1] }),
    },
    root: { roll: HALF_PI - lean, x: 0.8, y: 0.08 },
  }
}
/** Kneeling with the shins flat on the floor behind the knees, given the thigh's total tilt. */
const kneeling = (thighTilt: number) => ({ knee: [HALF_PI - thighTilt, 0, 0], ankle: [HALF_PI, 0, 0] }) satisfies Partial<Record<'knee' | 'ankle', Rotation>>
/** Flat on the back with the pelvis near the middle of the floor disc. */
const LYING_ON_BACK = { pitch: -HALF_PI, y: 0.12, z: 1.25 }
/** A dead bug's reaching arm and low leg on one side, the opposite side stacked over the hips. */
const ARM_OVERHEAD: Rotation = [-2.8, 0, 0]
const ARM_UP: Rotation = [-HALF_PI, 0, 0]
const LEG_LOW = { hip: [-0.25, 0, 0], knee: [0.1, 0, 0] } satisfies Record<string, Rotation>
const LEG_TABLETOP = { hip: [-HALF_PI, 0, 0], knee: [HALF_PI, 0, 0] } satisfies Record<string, Rotation>
/** Walking stride height and leg angles, front leg first. */
const STRIDE_DROP = -0.03
const LEG_FORWARD = { hip: [-0.35, 0, 0], knee: [0.2, 0, 0] } satisfies Record<string, Rotation>
const LEG_BEHIND = { hip: [0.3, 0, 0], knee: [0.5, 0, 0] } satisfies Record<string, Rotation>
const ARMS_LOADED = bothSides({ shoulder: [0, 0, 0.08] })
/** Hands held by the head while kneeling, as if gripping the cable's rope. */
const HANDS_BY_HEAD = { shoulder: [-2.1, 0, 0.2], elbow: [-2.3, 0, 0] } satisfies Partial<Record<'shoulder' | 'elbow', Rotation>>
/** The default three-quarter view of the figure. */
const DEFAULT_VIEW = 0.5

/**
 * What the 3D figure can be posed doing: a catalog movement, or `stand` — a still,
 * relaxed stance for custom exercises, which don't have a movement of their own yet.
 */
export type FigurePose = MovementPattern | 'stand'

const MOVEMENTS: Record<FigurePose, Movement> = {
  // Relaxed stance: both ends at rest, so only the turntable moves.
  stand: { from: { joints: {} }, to: { joints: {} }, seconds: 4 },
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
  // Hip hinge: standing → torso tipped forward with soft knees, arms hanging plumb. The
  // root shifts back so the feet stay planted as the hips push behind them.
  lean: {
    from: { joints: bothSides({ shoulder: [-0.05, 0, 0.05] }) },
    to: {
      joints: { spine: [HINGE_LEAN, 0, 0], ...bothSides({ shoulder: [-HINGE_LEAN, 0, 0], hip: [-0.35, 0, 0], knee: [0.45, 0, 0] }) },
      root: { y: -0.03, z: -0.1 },
    },
    seconds: 2.8,
    view: 1,
  },
  // Glute bridge: lying face up with knees bent and feet planted → hips driven up until
  // shoulders, hips and knees line up. Viewed side-on, since it would otherwise be end-on.
  bridge: {
    from: {
      joints: bothSides({ shoulder: [0, 0, 0.15], hip: [-1.1, 0, 0], knee: [2.3, 0, 0], ankle: [0.37, 0, 0] }),
      root: { pitch: -HALF_PI, y: 0.12, z: 1.25 },
    },
    to: {
      joints: { spine: [0.2, 0, 0], ...bothSides({ shoulder: [0, 0, 0.15], knee: [2.08, 0, 0], ankle: [-0.06, 0, 0] }) },
      root: { pitch: -HALF_PI - 0.45, y: 0.76, z: 1.16 },
    },
    seconds: 2.6,
    view: 1.2,
  },
  // Calf raise: flat-footed → up on the balls of the feet, which stay planted.
  rise: {
    from: { joints: bothSides({ shoulder: [0, 0, 0.1] }) },
    to: { joints: bothSides({ shoulder: [0, 0, 0.1], ankle: [0.55, 0, 0] }), root: { y: 0.08, z: 0.02 } },
    seconds: 2,
  },
  // Russian twist: seated, leaning back, with the hands carried from one side to the other.
  twist: {
    from: { joints: { spine: [-0.5, 0.55, 0], ...bothSides({ ...SEATED_LEGS, ...ARMS_HOLDING }) }, root: { y: -0.81, z: -0.35 } },
    to: { joints: { spine: [-0.5, -0.55, 0], ...bothSides({ ...SEATED_LEGS, ...ARMS_HOLDING }) }, root: { y: -0.81, z: -0.35 } },
    seconds: 2.4,
  },
  // Plank: an isometric hold, so only a slow, slight rise and settle shows it's alive.
  plank: { from: plankPose(0.09), to: plankPose(0.12), seconds: 4, view: 1.2 },
  // Side plank: likewise a hold, seen from the front so the stacked side reads.
  sidePlank: { from: sidePlankPose(0.27), to: sidePlankPose(0.3), seconds: 4, view: 0.25 },
  // Ab wheel: kneeling with hips flexed and hands under the shoulders → hips opened and
  // arms reaching far out, knees and hands staying on the floor as the wheel rolls.
  rollout: {
    from: {
      joints: { spine: [1.1, 0, 0], ...bothSides({ shoulder: [-1.645, 0, 0], hip: [-0.3, 0, 0], ...kneeling(0) }) },
      root: { pitch: 0.3, y: -0.42, z: -0.58 },
    },
    to: {
      joints: bothSides({ shoulder: [-2.44, 0, 0], hip: [-0.15, 0, 0], ...kneeling(1.2) }),
      root: { pitch: 1.35, y: 0.01, z: -0.83 },
    },
    seconds: 3.2,
    view: 1.2,
  },
  // Dead bug: lying face up, one arm overhead and the opposite leg low, then swapping sides.
  deadBug: {
    from: {
      joints: {
        shoulderL: ARM_UP,
        shoulderR: ARM_OVERHEAD,
        hipL: LEG_LOW.hip,
        kneeL: LEG_LOW.knee,
        hipR: LEG_TABLETOP.hip,
        kneeR: LEG_TABLETOP.knee,
      },
      root: LYING_ON_BACK,
    },
    to: {
      joints: {
        shoulderL: ARM_OVERHEAD,
        shoulderR: ARM_UP,
        hipL: LEG_TABLETOP.hip,
        kneeL: LEG_TABLETOP.knee,
        hipR: LEG_LOW.hip,
        kneeR: LEG_LOW.knee,
      },
      root: LYING_ON_BACK,
    },
    seconds: 3.2,
    view: 1.2,
  },
  // Farmer's carry: walking in place, arms straight at the sides under the load.
  carry: {
    from: {
      joints: { ...ARMS_LOADED, hipL: LEG_FORWARD.hip, kneeL: LEG_FORWARD.knee, hipR: LEG_BEHIND.hip, kneeR: LEG_BEHIND.knee },
      root: { y: STRIDE_DROP },
    },
    to: {
      joints: { ...ARMS_LOADED, hipL: LEG_BEHIND.hip, kneeL: LEG_BEHIND.knee, hipR: LEG_FORWARD.hip, kneeR: LEG_FORWARD.knee },
      root: { y: STRIDE_DROP },
    },
    seconds: 1.4,
    view: 0.9,
  },
  // Cable crunch: kneeling tall, hands by the head → ribs curled down toward the hips.
  crunch: {
    from: { joints: { spine: [0.1, 0, 0], ...bothSides({ ...HANDS_BY_HEAD, ...kneeling(0) }) }, root: { y: -0.46, z: 0.15 } },
    to: { joints: { spine: [0.9, 0, 0], ...bothSides({ ...HANDS_BY_HEAD, ...kneeling(0) }) }, root: { y: -0.46, z: 0.15 } },
    seconds: 2.4,
    view: 0.9,
  },
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The pose `seconds` into an endlessly repeating rep, eased so each end of the movement
 * slows to a stop like a controlled rep rather than bouncing. Joints missing from a
 * keyframe count as rest (zero rotation).
 */
export function poseAt(pattern: FigurePose, seconds: number): Pose {
  const movement = MOVEMENTS[pattern]

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
      x: lerp(from.root?.x ?? 0, to.root?.x ?? 0, t),
      y: lerp(from.root?.y ?? 0, to.root?.y ?? 0, t),
      z: lerp(from.root?.z ?? 0, to.root?.z ?? 0, t),
      pitch: lerp(from.root?.pitch ?? 0, to.root?.pitch ?? 0, t),
      roll: lerp(from.root?.roll ?? 0, to.root?.roll ?? 0, t),
    },
  }
}

/** Seconds into the rep at its far end — the most telling still frame when motion is off. */
export function peakSeconds(pattern: FigurePose): number {
  return MOVEMENTS[pattern].seconds / 2
}

/** The turntable angle a movement reads best from. */
export function viewAngle(pattern: FigurePose): number {
  return MOVEMENTS[pattern].view ?? DEFAULT_VIEW
}
