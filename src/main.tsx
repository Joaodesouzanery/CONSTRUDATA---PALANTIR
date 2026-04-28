import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Toaster } from 'sonner'

function errorText(value: unknown): string {
  if (value instanceof Error) return `${value.message}\n${value.stack ?? ''}`
  return String(value ?? '')
}

function isRecoverableMapError(value: unknown): boolean {
  return /_leaflet_pos|t_rawPanBy|invalidateSize|leaflet/i.test(errorText(value))
}

window.addEventListener('error', (event) => {
  if (isRecoverableMapError(event.error ?? event.message)) {
    event.preventDefault()
    console.warn('[Map recovered]', event.message)
    return
  }
  console.error('[GlobalError]', event.message, event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  if (isRecoverableMapError(event.reason)) {
    event.preventDefault()
    console.warn('[Map promise recovered]', event.reason)
    return
  }
  console.error('[UnhandledPromise]', event.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster richColors position="top-right" theme="dark" />
    </ErrorBoundary>
  </StrictMode>,
)
