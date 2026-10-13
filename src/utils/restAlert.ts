import { useSettingsStore } from '@/stores/settings'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null
  audioContext ??= new window.AudioContext()
  return audioContext
}

/**
 * Readies audio for a later {@link signalRestOver}. Browsers only let a page start audio
 * from a user gesture, and the rest timer ends long after the tap that started it — so
 * call this from that tap. A no-op when the sound setting is off.
 */
export function primeRestAlert() {
  if (!useSettingsStore.getState().restTimerSound) return
  getAudioContext()
    ?.resume()
    .catch(() => {})
}

/** Two short tones, a beat apart. */
function playTone(context: AudioContext) {
  for (const offset of [0, 0.25]) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startAt = context.currentTime + offset
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.25, startAt)
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.18)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + 0.2)
  }
}

/** Signals the end of a rest period with whichever of sound and vibration the user enabled. */
export function signalRestOver() {
  const { restTimerSound, restTimerVibrate } = useSettingsStore.getState()

  if (restTimerVibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200])
  }

  if (restTimerSound) {
    const context = getAudioContext()
    if (context) {
      try {
        playTone(context)
      } catch (err) {
        console.error('Failed to play rest timer sound:', err)
      }
    }
  }
}
