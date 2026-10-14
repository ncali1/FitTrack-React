import { useEffect } from 'react'

let lockCount = 0

/**
 * Stops the page behind an overlay from scrolling while `active` is true. Without it, a
 * full-screen sheet scrolls in front of a page that also still scrolls: two scrollbars,
 * and on iOS swipes and taps meant for the sheet can go to the page underneath instead.
 * Counted, so stacked overlays (a form opened from a sheet) unlock only when the last
 * one closes.
 */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    lockCount += 1
    document.documentElement.classList.add('scroll-locked')
    return () => {
      lockCount -= 1
      if (lockCount === 0) document.documentElement.classList.remove('scroll-locked')
    }
  }, [active])
}
