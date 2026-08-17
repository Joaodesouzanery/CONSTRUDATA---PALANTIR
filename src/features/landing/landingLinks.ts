/**
 * landingLinks.ts — destinos e rótulos dos CTAs da landing, num lugar só.
 *
 * POR QUE UM ARQUIVO SÓ PARA ISTO. Duas razões concretas, nenhuma estética.
 *
 * 1. **O mesmo destino tinha dois nomes.** O link do Calendly aparecia como "Falar com
 *    engenharia" em cinco lugares e "Agendar demonstração" num sexto. Para quem lê a página,
 *    isso são duas ofertas diferentes. Com os rótulos aqui, renomear é uma linha e não sobra
 *    ocorrência esquecida.
 *
 * 2. **Evitar ciclo de import.** `CtaBox` precisa dos destinos; `LandingPage` importa
 *    `TypeformPanel` e `HeroCarousel`, que também usam CTA. Se as constantes morassem na
 *    LandingPage, o ciclo seria `LandingPage → TypeformPanel → LandingPage`. Num bundle SSR
 *    isso não dá erro de resolução — dá TDZ na inicialização do módulo, que quebra o
 *    `scripts/prerender.mjs` no build, longe da causa. Mesmo motivo pelo qual `Corners.tsx` foi
 *    extraída. Este arquivo é folha: não importa nada.
 *
 * O `CALENDLY_URL` estava duplicado em `LandingPage.tsx` e `HeroCarousel.tsx` — trocar a agenda
 * exigia lembrar dos dois.
 */

// ── Destinos ──────────────────────────────────────────────────────────────────
export const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'
export const LOGIN_URL = '/login'

/** Âncoras internas. `#qualificacao` é o painel da Typeform na seção final. */
export const TYPEFORM_ANCHOR = '#qualificacao'
export const HOW_ANCHOR = '#como-entramos'
export const FORM_ANCHOR = '#solicitar'

// ── Rótulos ───────────────────────────────────────────────────────────────────
// A versão CURTA existe para caber em duas colunas no celular e no header estreito. Ela é
// escolhida por CSS, nunca por JavaScript: a landing é pré-renderizada e hidratada inteira, e
// decidir o rótulo lendo a largura da janela faria o servidor e o cliente renderizarem textos
// diferentes — o React descartaria a página toda e re-renderizaria.

export const CTA_AGENDAR = 'Agendar demonstração'
export const CTA_AGENDAR_CURTO = 'Agendar'

export const CTA_CONTEXTO = 'Contar o contexto'
export const CTA_CONTEXTO_CURTO = 'Meu contexto'

export const CTA_COMO = 'Ver como funciona'
export const CTA_COMO_CURTO = 'Como funciona'

export const CTA_LOGIN = 'Acessar plataforma'
export const CTA_LOGIN_CURTO = 'Entrar'

/** O submit do formulário nativo posta no Web3Forms — não abre a agenda. Não confundir. */
export const CTA_ENVIAR = 'Enviar contato'
