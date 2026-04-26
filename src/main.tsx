import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Toaster } from 'sonner'

// ── Global error display (shows JS crashes before React mounts) ──────────────
const errorOverlay = document.createElement('div')
errorOverlay.style.cssText = [
  'display:none',
  'position:fixed',
  'inset:0',
  'background:#333333',
  'color:#fca5a5',
  'padding:32px',
  'font-family:monospace',
  'font-size:13px',
  'z-index:99999',
  'overflow:auto',
  'white-space:pre-wrap',
  'word-break:break-all',
].join(';')

document.body.appendChild(errorOverlay)

function appendError(msg: string): void {
  errorOverlay.style.display = 'block'
  errorOverlay.textContent += msg + '\n\n'
}

window.addEventListener('error', (e) => {
  appendError(
    `[JS Error] ${e.message}\n` +
    `File: ${e.filename}:${e.lineno}:${e.colno}\n` +
    (e.error?.stack ?? ''),
  )
})

window.addEventListener('unhandledrejection', (e) => {
  appendError(`[Unhandled Promise] ${String(e.reason)}`)
})

// ── Mount ────────────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster richColors position="top-right" theme="dark" />
    </ErrorBoundary>
  </StrictMode>,
)
