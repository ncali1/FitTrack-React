import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import figureUrl from '@/assets/models/exercise-figure.glb?url'
import { activeRegionsFor } from '@/utils/muscleRegions'
import type { MovementPattern, RegionId } from '@/utils/muscleRegions'
import { peakSeconds, poseAt } from '@/utils/exercisePoses'
import type { Joint } from '@/utils/exercisePoses'
import { BONE_FOR_JOINT, JOINT_ORDER, PARENT_JOINT, regionForVertex } from '@/utils/figureRig'

/** Reads a theme colour token — WebGL materials can't use Tailwind classes. */
function themeColor(token: string): THREE.Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return new THREE.Color(value || 'grey')
}

/** Turns the model's T-pose arms (pointing out along ±X) down to hang at its sides —
 *  the rest pose the keyframes in exercisePoses are written against. */
const ARMS_DOWN: Partial<Record<Joint, THREE.Quaternion>> = {
  shoulderL: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
  elbowL: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
  shoulderR: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
  elbowR: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
}

/**
 * Paints each vertex of the character by the muscle region it belongs to, so the
 * targeted muscles show in the highlight colour and move with the skin. Runs once on the
 * rest pose, before any bone is moved.
 */
function paintMuscles(mesh: THREE.SkinnedMesh, active: Set<RegionId>, body: THREE.Color, muscle: THREE.Color) {
  const { geometry, skeleton } = mesh
  const position = geometry.getAttribute('position')
  const skinIndex = geometry.getAttribute('skinIndex')
  const skinWeight = geometry.getAttribute('skinWeight')
  const jointPositions = skeleton.bones.map((bone) => bone.getWorldPosition(new THREE.Vector3()))
  // Where each bone ends: its first child bone's joint, if it has one.
  const childJointPositions = skeleton.bones.map((bone) => {
    const child = bone.children.find((c): c is THREE.Bone => c instanceof THREE.Bone)
    return child ? child.getWorldPosition(new THREE.Vector3()) : null
  })

  const colors = new Float32Array(position.count * 3)
  const p = new THREE.Vector3()
  const onBone = new THREE.Vector3()
  const segment = new THREE.Line3()
  for (let i = 0; i < position.count; i++) {
    let strongest = 0
    for (let k = 1; k < 4; k++) {
      if (skinWeight.getComponent(i, k) > skinWeight.getComponent(i, strongest)) strongest = k
    }
    const boneIndex = skinIndex.getComponent(i, strongest)
    // Through the skeleton, not just matrixWorld: the GLB's positions are quantized, and
    // for a skinned mesh the dequantizing scale lives in the bind matrices.
    mesh.applyBoneTransform(i, p.fromBufferAttribute(position, i)).applyMatrix4(mesh.matrixWorld)
    const joint = jointPositions[boneIndex]
    const childJoint = childJointPositions[boneIndex]
    // Front/back relative to the bone's own axis, so it holds for any limb direction.
    if (childJoint) segment.set(joint, childJoint).closestPointToPoint(p, true, onBone)
    else onBone.copy(joint)
    const region = regionForVertex(
      skeleton.bones[boneIndex].name,
      p.z > onBone.z,
      onBone.distanceTo(joint),
      childJoint ? p.distanceTo(childJoint) : Infinity
    )
    const color = region && active.has(region) ? muscle : body
    color.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/**
 * A real-time 3D character looping one rep of the exercise, with the targeted muscles
 * highlighted — the 3D counterpart to MuscleBodyDiagram. The character is Quaternius's
 * CC0 "Universal Base Characters" male body, slimmed to a ~290 KB GLB (no textures:
 * colour comes from the muscle painting). Each movement is two keyframes in
 * utils/exercisePoses, retargeted onto the model's bones every frame. The figure sways on
 * a slow turntable so muscles on the back come into view too.
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
  pattern: MovementPattern
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

    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.8)
    key.position.set(-2, 4, 3)
    scene.add(key)

    const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })
    const eyes = new THREE.MeshStandardMaterial({ color: themeColor('--color-canvas-950'), roughness: 0.3 })
    const floorMaterial = new THREE.MeshStandardMaterial({ color: themeColor('--color-figure-floor'), roughness: 1 })

    const turntable = new THREE.Group()
    scene.add(turntable)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    turntable.add(floor)

    // Framed to fit the tallest pose (arms locked out overhead, ~2.25 high) without cropping.
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
    camera.position.set(0, 1.2, 4.7)
    camera.lookAt(0, 1.08, 0)

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

    let frame = 0
    let disposed = false
    let model: THREE.Object3D | null = null
    const bones = {} as Record<Joint, THREE.Bone>
    /** Each driven bone's rest orientation (arms hanging) relative to the turntable. */
    const rest = {} as Record<Joint, THREE.Quaternion>
    const poseWorld = {} as Record<Joint, THREE.Quaternion>
    for (const joint of JOINT_ORDER) poseWorld[joint] = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const local = new THREE.Quaternion()
    const parentWorld = new THREE.Quaternion()
    const turntableWorld = new THREE.Quaternion()

    const renderAt = (seconds: number, sway: boolean) => {
      // A three-quarter view reads most movements best; the sway reveals the back,
      // kept short of fully side-on, where the arms hide behind the body.
      turntable.rotation.y = 0.5 + (sway ? Math.sin(seconds * 0.5) * 0.7 : 0)
      turntable.updateMatrixWorld()

      const pose = model && poseAt(pattern, seconds)
      if (model && pose) {
        turntable.getWorldQuaternion(turntableWorld)
        for (const joint of JOINT_ORDER) {
          // The pose data's rig rotates each joint relative to its parent joint; build
          // that up into a world rotation, then solve for the bone's local rotation.
          const [x, y, z] = pose.joints[joint] ?? [0, 0, 0]
          local.setFromEuler(euler.set(x, y, z))
          const parent = PARENT_JOINT[joint]
          poseWorld[joint].copy(parent ? poseWorld[parent] : turntableWorld).multiply(local)

          const bone = bones[joint]
          bone.parent!.updateWorldMatrix(true, false)
          bone.parent!.getWorldQuaternion(parentWorld)
          bone.quaternion.copy(parentWorld.invert().multiply(poseWorld[joint]).multiply(rest[joint]))
        }
        model.position.y = pose.root?.y ?? 0
        model.position.z = pose.root?.z ?? 0
      }
      renderer.render(scene, camera)
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
      model = gltf.scene
      // Measure the rest pose with the turntable square-on, so world space is turntable
      // space for the front/back painting and the bones' rest orientations below.
      turntable.rotation.y = 0
      turntable.add(model)
      turntable.updateMatrixWorld(true)

      const active = activeRegionsFor(muscleKey ? muscleKey.split('|') : [])
      const body = themeColor('--color-figure-body')
      const muscle = themeColor('--color-figure-muscle')
      model.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh) {
          // The eyes are their own small mesh; everything else is skin.
          if (object.geometry.getAttribute('position').count < 1000) {
            object.material = eyes
          } else {
            paintMuscles(object, active, body, muscle)
            object.material = skin
          }
        }
      })

      for (const joint of JOINT_ORDER) {
        const bone = model.getObjectByName(BONE_FOR_JOINT[joint])
        if (!(bone instanceof THREE.Bone)) throw new Error(`Character is missing bone ${BONE_FOR_JOINT[joint]}`)
        bones[joint] = bone
        rest[joint] = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(ARMS_DOWN[joint] ?? new THREE.Quaternion())
      }
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
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose()
      })
      skin.dispose()
      eyes.dispose()
      floorMaterial.dispose()
      renderer.dispose()
      // Release the context now rather than at GC — browsers cap live WebGL contexts.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [pattern, muscleKey, onError])

  return <div ref={mountRef} className="w-full h-full [&>canvas]:w-full [&>canvas]:h-full" />
}
