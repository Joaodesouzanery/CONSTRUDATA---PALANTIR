/**
 * Entry de PRÉ-RENDERIZAÇÃO da landing (SSG no build, sem browser headless).
 *
 * Motivo: o app é um SPA — o servidor entrega `<div id="root"></div>` vazio e o conteúdo só
 * existe depois que o JS roda. Quem não executa JavaScript (Claude, ChatGPT, prévia de link do
 * WhatsApp/LinkedIn, vários crawlers) via uma página em branco. Aqui a landing é renderizada
 * para HTML durante o build e injetada no index.html; o React hidrata por cima no navegador.
 *
 * Só a landing é pré-renderizada: o resto do app está atrás de login e não precisa de SEO.
 * A landing é 100% estática (copy em arrays, sem store/supabase/fetch) e todo acesso a
 * window/document está dentro de effects — que não rodam no servidor.
 */
import { renderToString } from 'react-dom/server'
import { LandingPage } from './features/landing/LandingPage'

export function render(): string {
  return renderToString(<LandingPage />)
}
