import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    )

    expect(screen.getByText('All good')).toBeTruthy()
  })

  it('shows a recovery screen instead of crashing when a descendant throws', () => {
    // React logs the caught error to console.error (and, in dev, a second time via its
    // own reporting) — expected noise for this test, not a real assertion target.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(screen.queryByText('All good')).toBeNull()
  })
})
