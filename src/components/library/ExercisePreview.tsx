import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type { ComponentProps, ComponentType } from 'react'
import type { MovementPattern } from '@/utils/muscleRegions'
import { hasPose3D } from '@/utils/exercisePoses'
import { supportsWebGL } from '@/services/webgl'
import { MuscleBodyDiagram } from './MuscleBodyDiagram'
import type Preview3DComponent from './ExercisePreview3D'

type Preview3DProps = ComponentProps<typeof Preview3DComponent>

/** Stands in for the 3D chunk when it couldn't be fetched, reporting it like a renderer failure. */
function LoadFailed({ onError }: Preview3DProps) {
  useEffect(onError, [onError])
  return null
}

// three.js is several hundred KB, so the 3D preview is its own chunk, fetched only when
// a preview is first opened. A failed fetch degrades to the 2D diagram instead of throwing.
const ExercisePreview3D = lazy<ComponentType<Preview3DProps>>(() =>
  import('./ExercisePreview3D').catch((err: unknown) => {
    console.error('Failed to load the 3D preview:', err)
    return { default: LoadFailed }
  })
)

/**
 * The best available exercise preview: a 3D mannequin looping the movement when the
 * pattern has 3D keyframes and the device can draw WebGL, otherwise the animated 2D
 * MuscleBodyDiagram (also shown while the 3D chunk loads).
 */
export function ExercisePreview({
  targetMuscleGroups,
  pattern,
}: {
  targetMuscleGroups: string[]
  pattern?: MovementPattern
}) {
  const [failed, setFailed] = useState(false)
  const handleError = useCallback(() => setFailed(true), [])
  const diagram = <MuscleBodyDiagram targetMuscleGroups={targetMuscleGroups} pattern={pattern} />

  if (failed || !hasPose3D(pattern) || !supportsWebGL()) return diagram

  return (
    <div
      role="img"
      aria-label="3D preview of the movement, with the targeted muscles highlighted"
      className="h-56 rounded-xl bg-canvas-800 border border-surface-border overflow-hidden"
    >
      <Suspense fallback={<div className="h-full flex items-center justify-center">{diagram}</div>}>
        <ExercisePreview3D pattern={pattern} targetMuscleGroups={targetMuscleGroups} onError={handleError} />
      </Suspense>
    </div>
  )
}
