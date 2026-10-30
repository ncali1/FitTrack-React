/**
 * How the 3D exercise preview's character model (src/assets/models/exercise-figure.glb,
 * an Unreal-style skeleton) maps onto the pose data in exercisePoses and onto the muscle
 * regions it highlights. Kept free of three.js so the mapping can be unit-tested.
 */
import type { Joint } from './exercisePoses'
import type { RegionId } from './muscleRegions'

/** The model bone each pose joint drives. Bones in between (spine_02/03, clavicles)
 *  keep their rest pose and simply follow along. */
export const BONE_FOR_JOINT: Record<Joint, string> = {
  spine: 'spine_01',
  shoulderL: 'upperarm_l',
  elbowL: 'lowerarm_l',
  shoulderR: 'upperarm_r',
  elbowR: 'lowerarm_r',
  hipL: 'thigh_l',
  kneeL: 'calf_l',
  hipR: 'thigh_r',
  kneeR: 'calf_r',
}

/** Joints in parent-before-child order, so each bone is posed after the bones it hangs from. */
export const JOINT_ORDER: Joint[] = ['spine', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'hipL', 'kneeL', 'hipR', 'kneeR']

/** The joint whose world rotation a joint's rotation is relative to — matching the pose
 *  data's rig, where the arms hang from the spine and the legs from the hips. */
export const PARENT_JOINT: Partial<Record<Joint, Joint>> = {
  shoulderL: 'spine',
  shoulderR: 'spine',
  elbowL: 'shoulderL',
  elbowR: 'shoulderR',
  kneeL: 'hipL',
  kneeR: 'hipR',
}

/** How close to the shoulder joint (metres) a clavicle-weighted vertex must be to count
 *  as deltoid — measured on the model, where the clavicle joint sits ~0.18 in from it. */
const DELTOID_REACH = 0.13
/** How far down the upper arm's axis (metres) the deltoid cap reaches before the biceps
 *  and triceps take over; the model's upper arm is ~0.25 long. */
const DELTOID_LENGTH = 0.07
/** How far down the back of the thigh's axis (metres) still counts as glute. */
const GLUTE_LENGTH = 0.1

/**
 * The muscle region a vertex of the character belongs to, or `null` for parts no
 * exercise targets (head, hands, feet). Decided by the bone that moves the vertex most,
 * split front/back where one bone carries two muscle groups (biceps vs triceps, quads
 * vs hamstrings, chest vs upper back).
 *
 * @param bone - Name of the vertex's most heavily weighted bone.
 * @param facesFront - Whether the vertex sits in front of its bone's axis in the rest pose.
 * @param distanceAlongBone - Rest-pose distance (metres) down the bone's axis from its
 * own joint to the point level with the vertex.
 * @param distanceToChildJoint - Rest-pose distance (metres) to the joint at the bone's
 * far end (e.g. the shoulder, for a clavicle), or `Infinity` for an end bone.
 */
export function regionForVertex(
  bone: string,
  facesFront: boolean,
  distanceAlongBone: number,
  distanceToChildJoint = Infinity
): RegionId | null {
  // The clavicle bones carry the upper chest and traps as well as the deltoid; only the
  // part around the shoulder joint is deltoid — the rest would read as "chest".
  if (/^clavicle_/.test(bone)) return distanceToChildJoint < DELTOID_REACH ? 'shoulders' : null
  if (/^upperarm_/.test(bone)) {
    if (distanceAlongBone < DELTOID_LENGTH) return 'shoulders'
    return facesFront ? 'biceps' : 'triceps'
  }
  if (/^lowerarm_/.test(bone)) return 'forearms'
  if (bone === 'spine_03') return facesFront ? 'chest' : 'back'
  if (bone === 'spine_01' || bone === 'spine_02') return facesFront ? 'core' : 'back'
  if (bone === 'pelvis') return facesFront ? null : 'glutes'
  if (/^thigh_/.test(bone)) {
    if (facesFront) return 'quadriceps'
    return distanceAlongBone < GLUTE_LENGTH ? 'glutes' : 'hamstrings'
  }
  if (/^calf_/.test(bone)) return facesFront ? null : 'calves'
  return null
}
