import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      theme="dark"
      position="top-right"
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
