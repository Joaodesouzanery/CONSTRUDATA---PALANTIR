/**
 * Imprimir um relatório — a mecânica, sem saber de que módulo ele é.
 *
 * ─── DE ONDE VEIO ─────────────────────────────────────────────────────────────
 * Estas três funções nasceram dentro de `features/financeiro/utils/boletosReportExport.ts`, que é
 * o melhor gerador de relatório do projeto (três outros módulos dizem por escrito que copiaram
 * dele). Foram promovidas para cá quando o Ponto Eletrônico precisou imprimir o espelho: sem isso,
 * Mão de Obra passaria a importar Financeiro só para chamar `window.print()`.
 *
 * O que FICOU no módulo dos boletos: o HTML e o CSS, que são do domínio dele. O que veio para cá é
 * só o encanamento — abrir a janela, esperar as imagens, imprimir, e o plano B do pop-up bloqueado.
 *
 * ⚠️ O projeto NÃO usa jsPDF para relatório (embora ele esteja no `package.json` por outro motivo).
 * O padrão é montar um HTML A4 completo como string e mandar o navegador imprimir. É o que permite
 * o relatório ser uma função pura e testável — `buildXHtml(dados): string` — com a impressão como
 * um detalhe de fora.
 */

/**
 * Abre a janela do relatório.
 *
 * ⚠️ **Chame SÍNCRONA no clique**, antes de qualquer `await`. O navegador bloqueia `window.open`
 * disparado depois de uma promessa — e o sintoma é péssimo de diagnosticar, porque funciona na
 * máquina de quem desenvolve (que já liberou pop-up para o domínio) e falha na do cliente.
 *
 * Devolve `null` quando o bloqueador barrou; nesse caso use `printViaIframe`.
 */
export function openReportWindow(): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.open()
  win.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gerando relatório…</title></head><body style="font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#334155;padding:32px">Gerando o relatório…</body></html>')
  win.document.close()
  return win
}

/** Espera as imagens decodificarem — sem isso o print pode sair com molduras vazias. */
export async function aguardarImagens(doc: Document): Promise<void> {
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)))
}

/** Escreve o HTML na janela já aberta e manda imprimir. */
export async function printHtmlInto(win: Window, html: string): Promise<void> {
  win.document.open()
  win.document.write(html)
  win.document.close()
  await aguardarImagens(win.document)
  win.focus()
  win.print()
}

/**
 * Plano B para quando o pop-up é bloqueado: imprime de um iframe oculto, sem abrir aba.
 *
 * Nenhum outro export do repositório tem isto — todos só avisam "permita pop-ups", que é empurrar
 * para o usuário um problema que dá para resolver.
 */
export async function printViaIframe(html: string): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); throw new Error('Não foi possível preparar a impressão.') }
  doc.open()
  doc.write(html)
  doc.close()
  await aguardarImagens(doc)
  const limpar = () => setTimeout(() => iframe.remove(), 1000)
  win.addEventListener('afterprint', limpar, { once: true })
  win.focus()
  win.print()
  // Safari não dispara afterprint de iframe: rede de segurança para não deixar lixo no DOM.
  setTimeout(limpar, 60_000)
}
