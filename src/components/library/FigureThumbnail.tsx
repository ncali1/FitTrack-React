import { useEffect, useRef, useState } from 'react'
import type { MovementPattern } from '@/utils/muscleRegions'
import { supportsWebGL } from '@/services/webgl'
import { MuscleBodyDiagram } from './MuscleBodyDiagram'

/**
 * A Library grid tile's picture: a still of the 3D character, drawn once the tile scrolls
 * near the screen so a long list doesn't render every snapshot up front. Custom exercises,
 * which have no movement pattern, get the standing pose. Falls back to the still 2D diagram
 * when there's no WebGL or the snapshot fails. three.js is only fetched when first needed.
 */
export function FigureThumbnail({
  targetMuscleGroups,
  pattern,
}: {
  targetMuscleGroups: string[]
  pattern?: MovementPattern
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const muscleKey = targetMuscleGroups.join('|')
  const pose = pattern ?? 'stand'
  const canRender = supportsWebGL()

  useEffect(() => {
    const el = ref.current
    if (!canRender || !el) return
    let cancelled = false
    const load = () => {
      import('./figureSnapshot')
        .then(({ figureSnapshot }) => figureSnapshot(pose, muscleKey ? muscleKey.split('|') : []))
        .then((url) => !cancelled && setSrc(url))
        .catch((err: unknown) => {
          console.error('Failed to draw the exercise thumbnail:', err)
          if (!cancelled) setFailed(true)
        })
    }
    if (typeof IntersectionObserver === 'undefined') {
      load()
      return () => {
        cancelled = true
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect()
          load()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [canRender, pose, muscleKey])

  if (!canRender || failed) {
    return (
      <div className="py-2">
        <MuscleBodyDiagram targetMuscleGroups={targetMuscleGroups} still />
      </div>
    )
  }

  return (
    <div ref={ref} className="aspect-[8/9] bg-canvas-800 rounded-sm overflow-hidden">
      {src && <img src={src} alt="" className="w-full h-full object-contain" />}
    </div>
  )
}
