import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
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

/**
 * ⚠️ A guarda que faltava: soltar arquivo FORA de uma área de soltar não pode matar a sessão.
 *
 * O padrão do navegador para um arquivo solto numa página é NAVEGAR PARA ELE. Sem estes dois
 * listeners, errar a mira por alguns pixels — ou soltar a planilha no meio da tela achando que
 * "o sistema vê" — descarta a aplicação inteira: formulário aberto, RDO em digitação, fila de
 * sincronização ainda não gravada. Tudo perdido, sem confirmação e sem volta.
 *
 * É pré-requisito de qualquer área de soltar: sem isto, ampliar as zonas só diminui a chance do
 * acidente.
 *
 * E não atrapalha as zonas de verdade: o React ouve no elemento raiz, então o handler da zona roda
 * enquanto o evento sobe, ANTES de chegar ao `window`. Quando chega aqui, o arquivo já foi lido —
 * o `preventDefault` só repete o que a própria zona já faz.
 */
window.addEventListener('dragover', (event) => { event.preventDefault() })
window.addEventListener('drop', (event) => { event.preventDefault() })

const container = document.getElementById('root')!

const tree = (
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster richColors position="top-right" theme="dark" />
    </ErrorBoundary>
  </StrictMode>
)

/* A landing vai pré-renderizada no HTML (data-prerendered, ver scripts/prerender.mjs): nesse
   caso HIDRATAMOS o markup existente em vez de recriá-lo — o conteúdo já visível não pisca.
   Nas demais rotas (app atrás de login) o HTML vem vazio e seguimos com createRoot normal.
   Se a hidratação divergir, o React descarta o markup e renderiza do zero — o pior caso é
   exatamente o comportamento anterior. */
if (container.dataset.prerendered === 'true' && window.location.pathname === '/') {
  hydrateRoot(container, tree)
} else {
  container.innerHTML = ''
  createRoot(container).render(tree)
}
