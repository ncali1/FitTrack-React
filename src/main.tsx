import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toaster
      theme="dark"
      position="top-right"
      // Clear of the status bar / Dynamic Island and the 64px top bar, which the default
      // offset sits underneath on a notched phone.
      offset={{ top: 'calc(env(safe-area-inset-top) + 76px)' }}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 76px)' }}
      closeButton
      toastOptions={{
        classNames: {
          toast: '!bg-surface !border !border-surface-border !text-ink !shadow-card',
          title: '!text-ink',
          description: '!text-ink-muted',
          actionButton: '!bg-accent !text-white',
          cancelButton: '!bg-surface-hover !text-ink-muted',
          closeButton: '!bg-surface-hover !border-surface-border !text-ink-muted',
        },
      }}
    />
  </StrictMode>,
)
