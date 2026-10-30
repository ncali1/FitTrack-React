/**
 * Whether this device can draw WebGL at all — some older phones, locked-down browsers and
 * test environments (happy-dom) can't, and the 3D exercise preview falls back to the 2D
 * diagram there. Checked once and cached: creating a context isn't free, and the answer
 * doesn't change while the app is open.
 */
let cached: boolean | undefined

export function supportsWebGL(): boolean {
  if (cached !== undefined) return cached
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    cached = gl !== null
    // Hand the probe's context straight back — browsers cap how many can be live at once.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch (err) {
    console.error('Failed to check WebGL support:', err)
    cached = false
  }
  return cached
}
