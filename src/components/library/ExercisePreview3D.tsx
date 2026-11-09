import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import figureUrl from '@/assets/models/exercise-figure.glb?url'
import { peakSeconds } from '@/utils/exercisePoses'
import type { FigurePose } from '@/utils/exercisePoses'
import { createFigureStage } from './figureScene'

/**
 * A real-time 3D character looping one rep of the exercise, with the targeted muscles
 * highlighted — the 3D counterpart to MuscleBodyDiagram. The character is Quaternius's
 * CC0 "Universal Base Characters" male body, slimmed to a ~290 KB GLB (no textures:
 * colour comes from the muscle painting). The scene itself (lighting, posing, muscle
 * painting) lives in figureScene, shared with the Library grid's still snapshots. The
 * figure sways on a slow turntable so muscles on the back come into view too.
 *
 * Loaded lazily (three.js and the model are large) and only mounted by ExercisePreview,
 * which falls back to the 2D diagram when WebGL is missing or `onError` fires. Pauses on
 * the rep's far end when the OS asks for reduced motion.
 */
export default function ExercisePreview3D({
  pattern,
  targetMuscleGroups,
  onError,
}: {
  pattern: FigurePose
  targetMuscleGroups: string[]
  /** The renderer couldn't start or the model couldn't load. */
  onError: () => void
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const muscleKey = targetMuscleGroups.join('|')

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch (err) {
      console.error('Failed to start the 3D preview:', err)
      onError()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const stage = createFigureStage()

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = mount
      if (width === 0 || height === 0) return
      renderer.setSize(width, height, false)
      stage.setAspect(width / height)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    let frame = 0
    let disposed = false
    const renderAt = (seconds: number, sway: boolean) => {
      stage.pose(pattern, seconds, sway)
      renderer.render(stage.scene, stage.camera)
    }

    const start = () => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      if (reduceMotion) {
        renderAt(peakSeconds(pattern), false)
        return
      }
      const startedAt = performance.now()
      const loop = () => {
        renderAt((performance.now() - startedAt) / 1000, true)
        frame = requestAnimationFrame(loop)
      }
      loop()
    }

    const fail = (err: unknown) => {
      if (disposed) return
      console.error('Failed to load the 3D character:', err)
      onError()
    }

    const setUp = (gltf: { scene: THREE.Group }) => {
      stage.addFigure(gltf.scene, muscleKey ? muscleKey.split('|') : [])
      start()
    }

    new GLTFLoader().load(
      figureUrl,
      (gltf) => {
        if (disposed) return
        try {
          setUp(gltf)
        } catch (err) {
          fail(err)
        }
      },
      undefined,
      fail
    )
    renderAt(0, false)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      stage.dispose()
      renderer.dispose()
      // Release the context now rather than at GC — browsers cap live WebGL contexts.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [pattern, muscleKey, onError])

  return <div ref={mountRef} className="w-full h-full [&>canvas]:w-full [&>canvas]:h-full" />
}
