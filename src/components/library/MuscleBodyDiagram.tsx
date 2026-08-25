import { useId } from 'react'
import { activeRegionsFor } from '@/utils/muscleRegions'
import type { RegionId, MovementPattern } from '@/utils/muscleRegions'

/**
 * Simplified front/back body silhouette that highlights in red whichever muscle
 * regions a set of exercise muscle-group names maps to. Deliberately stylized (basic
 * capsule/ellipse shapes, not anatomically precise) rather than a licensed illustration —
 * consistent with the app's existing "character" illustration style (emoji empty states,
 * soft blobs) rather than realism.
 *
 * Rendered with a pseudo-3D look: glossy radial-gradient fills (a light source top-left,
 * darker toward the edges) give each shape a rounded, volumetric feel, and the whole
 * figure gently rotates in a CSS perspective space like a product shot on a turntable —
 * see index.css's tilt3d-figure. This is a deliberate CSS-only substitute for a real 3D
 * model: no model file, no WebGL, so it stays cheap enough to render inline on every card
 * in the library grid at once, at the cost of true volumetric geometry.
 *
 * Some muscle groups (Back, Triceps, Glutes, Hamstrings) are only visible from behind,
 * so both views are always rendered together — a front-only diagram would show nothing
 * highlighted for a back-targeting exercise like a deadlift.
 *
 * Passing `pattern` turns the silhouette into a short, looping "video-like" preview of
 * the movement (see index.css's anim-* keyframes) — there's no real exercise footage in
 * this app, so this is the self-contained substitute: the same diagram, in motion, rather
 * than a licensed video clip.
 */

/**
 * The rep-loop archetypes a workout's movement can be approximated by. `press`/`row`/
 * `raise` animate a whole arm as one rigid group (shoulder-driven); `curl` animates only
 * the forearm sub-group (elbow-driven); `bob`/`lean`/`rise`/`twist` animate the entire
 * figure together; `bridge`/`pulse` animate a single highlighted region directly.
 */
const FIGURE_PATTERN_CLASS: Partial<Record<MovementPattern, string>> = {
  bob: 'anim-bob',
  lean: 'anim-lean',
  rise: 'anim-rise',
  twist: 'anim-twist',
}

const ARM_PATTERN_CLASS: Partial<Record<MovementPattern, { left: string; right: string }>> = {
  press: { left: 'anim-press', right: 'anim-press' },
  row: { left: 'anim-row-left', right: 'anim-row-right' },
  raise: { left: 'anim-raise-left', right: 'anim-raise-right' },
}

const CURL_PATTERN_CLASS: Record<'left' | 'right', string> = { left: 'anim-curl-left', right: 'anim-curl-right' }

/** ids of the two per-instance <radialGradient>s a FrontBody/BackBody defines in its own <defs>. */
interface GradientIds {
  neutral: string
  active: string
}

const STROKE_NEUTRAL = 'stroke-surface-border'
const STROKE_ACTIVE = 'stroke-red-400'

/** Fill (the glossy gradient) and stroke/transition classes for a region, given whether it's targeted. */
function regionFill(active: Set<RegionId>, region: RegionId, grad: GradientIds): { fill: string; className: string; isActive: boolean } {
  const isActive = active.has(region)
  return {
    fill: `url(#${isActive ? grad.active : grad.neutral})`,
    className: `${isActive ? STROKE_ACTIVE : STROKE_NEUTRAL} stroke-1 transition-colors duration-300`,
    isActive,
  }
}

/** Extra animation class for a region whose own shape (not a whole limb) carries the motion. */
function regionAnimClass(pattern: MovementPattern | undefined, region: RegionId): string {
  if (pattern === 'bridge' && region === 'glutes') return 'anim-bridge'
  if (pattern === 'pulse' && region === 'core') return 'anim-pulse-part'
  return ''
}

/** The two glossy radial gradients (neutral gray, active red) a single Front/BackBody instance paints with. */
function BodyGradientDefs({ grad }: { grad: GradientIds }) {
  return (
    <defs>
      <radialGradient id={grad.neutral} cx="35%" cy="28%" r="75%">
        <stop offset="0%" stopColor="#3d4051" />
        <stop offset="100%" stopColor="#121319" />
      </radialGradient>
      <radialGradient id={grad.active} cx="35%" cy="28%" r="75%">
        <stop offset="0%" stopColor="#ff9a9a" />
        <stop offset="100%" stopColor="#b91c1c" />
      </radialGradient>
    </defs>
  )
}

/** Structural body parts shared by both views — always neutral, never highlightable. */
function BodyBase({ grad }: { grad: GradientIds }) {
  const neutral = `url(#${grad.neutral})`
  const cls = STROKE_NEUTRAL + ' stroke-1'
  return (
    <>
      <circle cx={70} cy={18} r={14} fill={neutral} className={cls} />
      <rect x={63} y={30} width={14} height={10} rx={3} fill={neutral} className={cls} />
      <polygon points="48,40 92,40 88,150 52,150" fill={neutral} className={cls} />
      <polygon points="52,150 88,150 84,168 56,168" fill={neutral} className={cls} />
      <ellipse cx={57} cy={314} rx={14} ry={6} fill={neutral} className={cls} />
      <ellipse cx={83} cy={314} rx={14} ry={6} fill={neutral} className={cls} />
    </>
  )
}

/**
 * One arm: an upper-limb rect (bicep/tricep) plus a forearm sub-group (forearm rect +
 * hand). `whole`-style patterns (press/row/raise) animate the outer <g>, moving the
 * entire arm as one rigid piece; `curl` instead animates only the inner forearm <g>,
 * which bends the elbow while the upper arm stays put — nesting lets the same markup
 * serve both without duplicating the arm's geometry per pattern.
 */
function Arm({
  side,
  upperRegion,
  active,
  pattern,
  grad,
}: {
  side: 'left' | 'right'
  upperRegion: RegionId
  active: Set<RegionId>
  pattern: MovementPattern | undefined
  grad: GradientIds
}) {
  const upperX = side === 'left' ? 18 : 100
  const forearmX = side === 'left' ? 16 : 104
  const handCx = side === 'left' ? 26 : 114

  const wholeArmClass = (pattern && ARM_PATTERN_CLASS[pattern]?.[side]) || ''
  const curlClass = pattern === 'curl' ? CURL_PATTERN_CLASS[side] : ''

  const upper = regionFill(active, upperRegion, grad)
  const forearm = regionFill(active, 'forearms', grad)

  return (
    <g className={wholeArmClass}>
      <rect x={upperX} y={44} width={22} height={62} rx={11} fill={upper.fill} className={upper.className} data-region-active={upper.isActive} />
      <g className={curlClass}>
        <rect
          x={forearmX}
          y={104}
          width={20}
          height={60}
          rx={10}
          fill={forearm.fill}
          className={forearm.className}
          data-region-active={forearm.isActive}
        />
        <circle cx={handCx} cy={168} r={9} fill={`url(#${grad.neutral})`} className={STROKE_NEUTRAL + ' stroke-1'} />
      </g>
    </g>
  )
}

function FrontBody({ active, pattern }: { active: Set<RegionId>; pattern?: MovementPattern }) {
  const rawId = useId().replace(/:/g, '')
  const grad: GradientIds = { neutral: `${rawId}-front-neutral`, active: `${rawId}-front-active` }
  const figureClass = (pattern && FIGURE_PATTERN_CLASS[pattern]) || ''

  const shoulders = regionFill(active, 'shoulders', grad)
  const chest = regionFill(active, 'chest', grad)
  const core = regionFill(active, 'core', grad)
  const quads = regionFill(active, 'quadriceps', grad)
  const calves = regionFill(active, 'calves', grad)

  return (
    <svg
      viewBox="0 0 140 320"
      className="w-full h-auto tilt3d-figure drop-shadow-[0_8px_10px_rgba(0,0,0,0.5)]"
      role="img"
      aria-label="Front of body"
    >
      <BodyGradientDefs grad={grad} />
      <g className={figureClass}>
        <BodyBase grad={grad} />
        <circle cx={42} cy={48} r={14} fill={shoulders.fill} className={shoulders.className} data-region-active={shoulders.isActive} />
        <circle cx={98} cy={48} r={14} fill={shoulders.fill} className={shoulders.className} data-region-active={shoulders.isActive} />
        <ellipse cx={61} cy={62} rx={15} ry={18} fill={chest.fill} className={chest.className} data-region-active={chest.isActive} />
        <ellipse cx={79} cy={62} rx={15} ry={18} fill={chest.fill} className={chest.className} data-region-active={chest.isActive} />
        <rect
          x={54}
          y={82}
          width={32}
          height={64}
          rx={10}
          fill={core.fill}
          className={`${core.className} ${regionAnimClass(pattern, 'core')}`}
          data-region-active={core.isActive}
        />
        <Arm side="left" upperRegion="biceps" active={active} pattern={pattern} grad={grad} />
        <Arm side="right" upperRegion="biceps" active={active} pattern={pattern} grad={grad} />
        <rect x={44} y={168} width={26} height={80} rx={13} fill={quads.fill} className={quads.className} data-region-active={quads.isActive} />
        <rect x={70} y={168} width={26} height={80} rx={13} fill={quads.fill} className={quads.className} data-region-active={quads.isActive} />
        <rect x={47} y={246} width={20} height={64} rx={10} fill={calves.fill} className={calves.className} data-region-active={calves.isActive} />
        <rect x={73} y={246} width={20} height={64} rx={10} fill={calves.fill} className={calves.className} data-region-active={calves.isActive} />
      </g>
    </svg>
  )
}

function BackBody({ active, pattern }: { active: Set<RegionId>; pattern?: MovementPattern }) {
  const rawId = useId().replace(/:/g, '')
  const grad: GradientIds = { neutral: `${rawId}-back-neutral`, active: `${rawId}-back-active` }
  const figureClass = (pattern && FIGURE_PATTERN_CLASS[pattern]) || ''

  const back = regionFill(active, 'back', grad)
  const glutes = regionFill(active, 'glutes', grad)
  const hamstrings = regionFill(active, 'hamstrings', grad)
  const calves = regionFill(active, 'calves', grad)

  return (
    <svg
      viewBox="0 0 140 320"
      className="w-full h-auto tilt3d-figure drop-shadow-[0_8px_10px_rgba(0,0,0,0.5)]"
      role="img"
      aria-label="Back of body"
    >
      <BodyGradientDefs grad={grad} />
      <g className={figureClass}>
        <BodyBase grad={grad} />
        <rect x={48} y={44} width={44} height={80} rx={14} fill={back.fill} className={back.className} data-region-active={back.isActive} />
        <Arm side="left" upperRegion="triceps" active={active} pattern={pattern} grad={grad} />
        <Arm side="right" upperRegion="triceps" active={active} pattern={pattern} grad={grad} />
        <ellipse
          cx={70}
          cy={160}
          rx={24}
          ry={16}
          fill={glutes.fill}
          className={`${glutes.className} ${regionAnimClass(pattern, 'glutes')}`}
          data-region-active={glutes.isActive}
        />
        <rect
          x={44}
          y={168}
          width={26}
          height={80}
          rx={13}
          fill={hamstrings.fill}
          className={hamstrings.className}
          data-region-active={hamstrings.isActive}
        />
        <rect
          x={70}
          y={168}
          width={26}
          height={80}
          rx={13}
          fill={hamstrings.fill}
          className={hamstrings.className}
          data-region-active={hamstrings.isActive}
        />
        <rect x={47} y={246} width={20} height={64} rx={10} fill={calves.fill} className={calves.className} data-region-active={calves.isActive} />
        <rect x={73} y={246} width={20} height={64} rx={10} fill={calves.fill} className={calves.className} data-region-active={calves.isActive} />
      </g>
    </svg>
  )
}

export function MuscleBodyDiagram({
  targetMuscleGroups,
  pattern,
}: {
  targetMuscleGroups: string[]
  pattern?: MovementPattern
}) {
  const active = activeRegionsFor(targetMuscleGroups)

  return (
    <div className="flex gap-3 justify-center">
      <div className="w-16 flex flex-col items-center gap-1 [perspective:500px]">
        <FrontBody active={active} pattern={pattern} />
        <span className="text-[10px] text-ink-faint uppercase tracking-wide">Front</span>
      </div>
      <div className="w-16 flex flex-col items-center gap-1 [perspective:500px]">
        <BackBody active={active} pattern={pattern} />
        <span className="text-[10px] text-ink-faint uppercase tracking-wide">Back</span>
      </div>
    </div>
  )
}
