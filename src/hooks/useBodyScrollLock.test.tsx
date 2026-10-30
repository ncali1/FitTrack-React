import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useBodyScrollLock } from './useBodyScrollLock'

function Overlay({ active = true }: { active?: boolean }) {
  useBodyScrollLock(active)
  return null
}

describe('useBodyScrollLock', () => {
  afterEach(cleanup)

  it('locks page scrolling while mounted and unlocks on unmount', () => {
    const { unmount } = render(<Overlay />)
    expect(document.documentElement).toHaveClass('scroll-locked')
    unmount()
    expect(document.documentElement).not.toHaveClass('scroll-locked')
  })

  it('does nothing while inactive', () => {
    render(<Overlay active={false} />)
    expect(document.documentElement).not.toHaveClass('scroll-locked')
  })

  it('stays locked until the last of several stacked overlays closes', () => {
    const sheet = render(<Overlay />)
    const form = render(<Overlay />)

    form.unmount()
    expect(document.documentElement).toHaveClass('scroll-locked')
    sheet.unmount()
    expect(document.documentElement).not.toHaveClass('scroll-locked')
  })
})
