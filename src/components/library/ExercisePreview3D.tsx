import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { activeRegionsFor } from '@/utils/muscleRegions'
import type { MovementPattern, RegionId } from '@/utils/muscleRegions'
import { JOINTS, peakSeconds, poseAt } from '@/utils/exercisePoses'
import type { Joint } from '@/utils/exercisePoses'

/** Mannequin proportions, in figure units (~1.8 tall, feet at y = 0). */
const HIP_HEIGHT = 0.95
const THIGH = 0.45
const SHIN = 0.45
const UPPER_ARM = 0.3
const FOREARM = 0.28
const SHOULDER_HEIGHT = 0.5
const SHOULDER_WIDTH = 0.2
const HIP_WIDTH = 0.1

/** Reads a theme colour token — WebGL materials can't use Tailwind classes. */
function themeColor(token: string): THREE.Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return new THREE.Color(value || 'grey')
}

/** A limb that pivots at its group's origin and hangs along −Y, like every joint in the rig. */
function limb(length: number, radius: number, material: THREE.Material): { pivot: THREE.Group; mesh: THREE.Mesh } {
  const pivot = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 6, 12), material)
  mesh.position.y = -length / 2
  pivot.add(mesh)
  return { pivot, mesh }
}

/** An ellipsoid body part — the torso is built from a few of these. */
function blob(scale: [number, number, number], position: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material)
  mesh.scale.set(...scale)
  mesh.position.set(...position)
  return mesh
}

/**
 * Builds the mannequin, colouring each part by whether its muscle region is targeted.
 * Returns the root (moved for whole-body motion like squatting) and every posable joint.
 */
function buildFigure(active: Set<RegionId>, body: THREE.Material, muscle: THREE.Material) {
  const mat = (...regions: RegionId[]) => (regions.some((r) => active.has(r)) ? muscle : body)

  const root = new THREE.Group()
  root.position.y = HIP_HEIGHT
  root.add(blob([0.17, 0.12, 0.12], [0, 0, -0.01], mat('glutes')))

  const spine = new THREE.Group()
  root.add(spine)
  spine.add(blob([0.15, 0.14, 0.1], [0, 0.15, 0], mat('core')))
  spine.add(blob([0.2, 0.2, 0.07], [0, 0.38, 0.04], mat('chest')))
  spine.add(blob([0.2, 0.21, 0.07], [0, 0.38, -0.04], mat('back')))
  spine.add(blob([0.11, 0.13, 0.11], [0, 0.7, 0.01], body))

  const joints = { spine } as Record<Joint, THREE.Group>

  for (const [side, x] of [['L', SHOULDER_WIDTH], ['R', -SHOULDER_WIDTH]] as const) {
    const shoulder = limb(UPPER_ARM, 0.05, mat('biceps', 'triceps'))
    shoulder.pivot.position.set(x, SHOULDER_HEIGHT, 0)
    shoulder.pivot.add(blob([0.07, 0.07, 0.07], [0, 0, 0], mat('shoulders')))
    spine.add(shoulder.pivot)

    const elbow = limb(FOREARM, 0.042, mat('forearms'))
    elbow.pivot.position.y = -UPPER_ARM
    shoulder.pivot.add(elbow.pivot)

    const hip = limb(THIGH, 0.07, mat('quadriceps', 'hamstrings'))
    hip.pivot.position.set(side === 'L' ? HIP_WIDTH : -HIP_WIDTH, -0.05, 0)
    root.add(hip.pivot)

    const knee = limb(SHIN, 0.055, mat('calves'))
    knee.pivot.position.y = -THIGH
    hip.pivot.add(knee.pivot)

    joints[`shoulder${side}`] = shoulder.pivot
    joints[`elbow${side}`] = elbow.pivot
    joints[`hip${side}`] = hip.pivot
    joints[`knee${side}`] = knee.pivot
  }

  return { root, joints }
}

/**
 * A real-time 3D mannequin looping one rep of the exercise, with the targeted muscles
 * highlighted — the 3D counterpart to MuscleBodyDiagram. Built from primitive shapes in
 * code rather than a model file, so it adds no assets, works offline, and every pattern is
 * just two keyframes in utils/exercisePoses. The figure sways on a slow turntable so
 * muscles on the back come into view too.
 *
 * Loaded lazily (three.js is large) and only mounted by ExercisePreview, which falls back
 * to the 2D diagram when WebGL is missing or `onError` fires. Pauses on the rep's far end
 * when the OS asks for reduced motion.
 */
export default function ExercisePreview3D({
  pattern,
  targetMuscleGroups,
  onError,
}: {
  pattern: MovementPattern
  targetMuscleGroups: string[]
  /** Renderer creation failed (e.g. the browser is out of WebGL contexts). */
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

    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.8)
    key.position.set(-2, 4, 3)
    scene.add(key)

    const body = new THREE.MeshStandardMaterial({ color: themeColor('--color-figure-body'), roughness: 0.55 })
    const muscle = new THREE.MeshStandardMaterial({ color: themeColor('--color-figure-muscle'), roughness: 0.45 })
    const floorMaterial = new THREE.MeshStandardMaterial({ color: themeColor('--color-figure-floor'), roughness: 1 })

    const turntable = new THREE.Group()
    scene.add(turntable)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    turntable.add(floor)

    const { root, joints } = buildFigure(activeRegionsFor(muscleKey ? muscleKey.split('|') : []), body, muscle)
    turntable.add(root)

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
    // Framed to fit the tallest pose (arms locked out overhead, ~2.05 high) without cropping.
    camera.position.set(0, 1.15, 4.2)
    camera.lookAt(0, 1, 0)

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = mount
      if (width === 0 || height === 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    const renderAt = (seconds: number, sway: boolean) => {
      const pose = poseAt(pattern, seconds)
      if (pose) {
        for (const joint of JOINTS) {
          const [x, y, z] = pose.joints[joint] ?? [0, 0, 0]
          joints[joint].rotation.set(x, y, z)
        }
        root.position.y = HIP_HEIGHT + (pose.root?.y ?? 0)
        root.position.z = pose.root?.z ?? 0
      }
      // A three-quarter view reads most movements best; the sway reveals the back.
      // Kept short of fully side-on, where the arms hide behind the body.
      turntable.rotation.y = 0.5 + (sway ? Math.sin(seconds * 0.5) * 0.7 : 0)
      renderer.render(scene, camera)
    }

    let frame = 0
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduceMotion) {
      renderAt(peakSeconds(pattern), false)
    } else {
      const start = performance.now()
      const loop = () => {
        renderAt((performance.now() - start) / 1000, true)
        frame = requestAnimationFrame(loop)
      }
      loop()
    }

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose()
      })
      body.dispose()
      muscle.dispose()
      floorMaterial.dispose()
      renderer.dispose()
      // Release the context now rather than at GC — browsers cap live WebGL contexts.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [pattern, muscleKey, onError])

  return <div ref={mountRef} className="w-full h-full [&>canvas]:w-full [&>canvas]:h-full" />
}
