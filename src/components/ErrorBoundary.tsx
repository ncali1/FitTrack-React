import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level safety net: catches any render-time error thrown by the component tree
 * (React error boundaries only catch these during class methods — a plain function/hook
 * can't) and shows a recovery screen instead of an unstyled white page. Workout data
 * itself is untouched (it's all in IndexedDB, not React state), so a reload always
 * recovers cleanly.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in component tree:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <div>
            <h2 className="text-ink">Something went wrong</h2>
            <p className="text-ink-muted text-sm mt-1.5 max-w-sm">
              An unexpected error occurred. Your workout data is stored locally and hasn't been affected — reloading
              usually fixes this.
            </p>
          </div>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
