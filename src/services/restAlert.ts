import { Capacitor } from '@capacitor/core'
import { Haptics, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useSettingsStore } from '@/stores/settings'

/**
 * "Rest is over" alerting, shared by the app-wide rest timer store and the guided
 * session's own countdown. Which channel fires depends on where the app is when the
 * rest ends:
 *
 * - In the foreground: a short two-tone beep (if enabled in Settings) plus a haptic —
 *   the native Haptics plugin on iOS/Android, `navigator.vibrate` on the web.
 * - In the background / screen locked: a system notification. JS timers are throttled
 *   or suspended there, so on native it's handed to the OS as a scheduled local
 *   notification the moment the app is hidden (and cancelled again on return); on the
 *   web it's a best-effort `Notification` fired if the page still gets to run.
 *
 * Callers `armRestAlert(endsAt)` when a rest starts (or its end time changes),
 * `fireRestAlert()` when their countdown reaches zero, and `disarmRestAlert()` if the
 * rest is skipped. Only one rest is tracked at a time — the latest arm wins.
 */

const NOTIFICATION_ID = 7001
const NOTIFICATION_TITLE = 'Rest over'
const NOTIFICATION_BODY = 'Time for your next set.'
/** A countdown that only "finishes" this long after its real end time (the app was
 *  suspended and has just come back) skips the beep/haptic — it's no longer news. */
const STALE_AFTER_MS = 3000

let pendingEndsAt: number | null = null
let audioCtx: AudioContext | null = null
let listenersInstalled = false
let nativePermissionRequested = false

const isNative = () => Capacitor.isNativePlatform()
const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

/** Creates/resumes the audio context. Browsers only allow this close to a user gesture,
 *  which is why it's done up front when a rest starts rather than when it ends. */
function primeAudio() {
  if (!useSettingsStore.getState().restSoundEnabled) return
  if (typeof window === 'undefined' || !('AudioContext' in window)) return
  try {
    audioCtx ??= new AudioContext()
    if (audioCtx.state !== 'running') void audioCtx.resume().catch(() => {})
  } catch {
    audioCtx = null
  }
}

function playBeep() {
  if (!audioCtx || !useSettingsStore.getState().restSoundEnabled) return
  try {
    if (audioCtx.state !== 'running') void audioCtx.resume().catch(() => {})
    const startAt = audioCtx.currentTime
    for (const [offset, frequency] of [
      [0, 880],
      [0.22, 1175],
    ] as const) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, startAt + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, startAt + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.18)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(startAt + offset)
      osc.stop(startAt + offset + 0.2)
    }
  } catch (err) {
    console.error('Failed to play rest alert sound:', err)
  }
}

function buzz() {
  if (isNative()) {
    void Haptics.notification({ type: NotificationType.Success }).catch(() => {})
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200])
  }
}

/** Asks for notification permission once per app run, the first time a rest starts. */
async function ensureNativePermission() {
  if (nativePermissionRequested) return
  nativePermissionRequested = true
  try {
    const status = await LocalNotifications.checkPermissions()
    if (status.display === 'prompt' || status.display === 'prompt-with-rationale') {
      await LocalNotifications.requestPermissions()
    }
  } catch (err) {
    console.error('Failed to request notification permission:', err)
  }
}

async function scheduleNativeNotification(endsAt: number) {
  if (endsAt <= Date.now()) return
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: NOTIFICATION_TITLE,
          body: NOTIFICATION_BODY,
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
        },
      ],
    })
  } catch (err) {
    console.error('Failed to schedule rest notification:', err)
  }
}

async function cancelNativeNotification() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] })
  } catch {
    // Nothing scheduled, or the plugin isn't available — either way nothing to cancel.
  }
}

/** Web-only, and only if permission was already granted (e.g. via workout reminders). */
async function showWebNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    // Chrome on Android rejects `new Notification()` outright — notifications there
    // have to go through the service worker registration.
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(NOTIFICATION_TITLE, { body: NOTIFICATION_BODY, tag: 'rest-over' })
    } else {
      new Notification(NOTIFICATION_TITLE, { body: NOTIFICATION_BODY, tag: 'rest-over' })
    }
  } catch (err) {
    console.error('Failed to show rest notification:', err)
  }
}

function handleVisibilityChange() {
  if (!isNative()) return
  if (isHidden()) {
    if (pendingEndsAt !== null) void scheduleNativeNotification(pendingEndsAt)
  } else {
    void cancelNativeNotification()
  }
}

function installListeners() {
  if (listenersInstalled || typeof document === 'undefined') return
  listenersInstalled = true
  document.addEventListener('visibilitychange', handleVisibilityChange)
  // The audio context can get suspended while the app is backgrounded; any later tap
  // is a chance to wake it again before the rest ends.
  document.addEventListener('pointerdown', () => {
    if (audioCtx && audioCtx.state !== 'running') void audioCtx.resume().catch(() => {})
  })
}

/** Registers a rest ending at `endsAt` (Unix ms). Call again if the end time changes. */
export function armRestAlert(endsAt: number) {
  pendingEndsAt = endsAt
  installListeners()
  primeAudio()
  if (isNative()) {
    void ensureNativePermission()
    // Re-arming while already hidden replaces the previously scheduled notification
    // (same id), so an adjusted end time doesn't leave a stale one behind.
    if (isHidden()) void scheduleNativeNotification(endsAt)
  }
}

/** Forgets the pending rest without alerting (the user skipped it). */
export function disarmRestAlert() {
  pendingEndsAt = null
  if (isNative()) void cancelNativeNotification()
}

/** Alerts that the pending rest has ended. No-op if nothing is armed. */
export function fireRestAlert() {
  if (pendingEndsAt === null) return
  const endsAt = pendingEndsAt
  pendingEndsAt = null

  if (isHidden()) {
    // On native the OS-scheduled notification covers this case.
    if (!isNative()) void showWebNotification()
    return
  }

  if (isNative()) void cancelNativeNotification()
  if (Date.now() - endsAt > STALE_AFTER_MS) return
  playBeep()
  buzz()
}
