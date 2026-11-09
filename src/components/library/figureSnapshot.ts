import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import figureUrl from '@/assets/models/exercise-figure.glb?url'
import { peakSeconds } from '@/utils/exercisePoses'
import type { FigurePose } from '@/utils/exercisePoses'
import { createFigureStage } from './figureScene'

/** Snapshot size in device pixels — tiles show it at roughly half this, so it stays sharp on 2x screens. */
const WIDTH = 320
const HEIGHT = 360

let renderer: THREE.WebGLRenderer | null = null
let model: Promise<ArrayBuffer> | null = null
const cache = new Map<string, Promise<string>>()
/** Snapshots render one at a time on the single shared renderer. */
let queue: Promise<unknown> = Promise.resolve()

async function render(pattern: FigurePose, targetMuscleGroups: string[]): Promise<string> {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(1)
    renderer.setSize(WIDTH, HEIGHT, false)
  }
  // Fetched once; each snapshot parses its own copy because painting writes into the geometry.
  model ??= fetch(figureUrl).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.arrayBuffer()
  })
  const gltf = await new GLTFLoader().parseAsync(await model, '')

  const stage = createFigureStage()
  try {
    stage.setAspect(WIDTH / HEIGHT)
    stage.addFigure(gltf.scene, targetMuscleGroups)
    stage.pose(pattern, peakSeconds(pattern), false)
    renderer.render(stage.scene, stage.camera)
    // Read back straight after drawing, before the browser can clear the buffer.
    const blob = await new Promise<Blob | null>((resolve) => renderer!.domElement.toBlob(resolve))
    if (!blob) throw new Error('Canvas produced no image')
    return URL.createObjectURL(blob)
  } finally {
    stage.dispose()
  }
}

/**
 * A still image of the 3D character at the far end of the rep, for the Library grid. A
 * grid of live scenes isn't possible — browsers cap live WebGL contexts at around 16 —
 * so one hidden renderer draws each snapshot once and the result is cached for the rest
 * of the session (exercises sharing a movement and muscles share one image).
 */
export function figureSnapshot(pattern: FigurePose, targetMuscleGroups: string[]): Promise<string> {
  const key = `${pattern}:${[...targetMuscleGroups].sort().join('|')}`
  let snapshot = cache.get(key)
  if (!snapshot) {
    snapshot = queue.then(() => render(pattern, targetMuscleGroups))
    queue = snapshot.catch(() => {})
    cache.set(key, snapshot)
  }
  return snapshot
}
