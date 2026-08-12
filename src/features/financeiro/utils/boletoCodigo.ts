/**
 * boletoCodigo.ts — linha digitável do boleto (aba "Boletos" do Financeiro).
 *
 * O código é GUARDADO limpo (só dígitos) e FORMATADO só na exibição: assim a busca acha o
 * boleto independente de como o usuário digitou/colou (com ou sem pontos e espaços).
 *
 * Dois formatos convivem no Brasil:
 *  · 47 dígitos — cobrança bancária (FEBRABAN): AAAAA.AAAAA BBBBB.BBBBBB CCCCC.CCCCCC D EEEEEEEEEEEEEE
 *  · 48 dígitos — arrecadação/convênio (água, luz, tributos): 4 grupos de 12
 */

/** Só os dígitos — é assim que o código é persistido e comparado. */
export function digitosDe(codigo?: string | null): string {
  return (codigo ?? '').replace(/\D/g, '')
}

/** 47 (bancário) ou 48 (convênio) dígitos. Fora disso, provavelmente falta ou sobra número. */
export function tamanhoValido(codigo?: string | null): boolean {
  const n = digitosDe(codigo).length
  return n === 47 || n === 48
}

/**
 * Formata para leitura. Se o tamanho não for 47/48, devolve o texto como veio — não atrapalha
 * quem ainda está digitando nem mutila um código fora do padrão.
 */
export function formatarCodigo(codigo?: string | null): string {
  const d = digitosDe(codigo)
  if (d.length === 47) {
    return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33)}`
  }
  if (d.length === 48) {
    return `${d.slice(0, 12)} ${d.slice(12, 24)} ${d.slice(24, 36)} ${d.slice(36)}`
  }
  return codigo ?? ''
}

/**
 * Todas as formas de escrever `n` como soma de 47 e 48 — ou null se não der.
 * Serve para descobrir quantos códigos há num trecho colado (ver `separarCodigosColados`).
 */
function decompor(n: number): number[] | null {
  for (let b = 0; b * 48 <= n; b++) {
    const resto = n - b * 48
    if (resto % 47 === 0) return [...Array<number>(resto / 47).fill(47), ...Array<number>(b).fill(48)]
  }
  return null
}

export interface CodigosColados {
  /** Só o que tem cara de linha digitável (47/48 dígitos), na ordem em que apareceu. */
  codigos: string[]
  /** Trechos descartados por não fecharem 47/48 dígitos — a UI avisa em vez de gravar lixo. */
  ignoradas: number
}

/**
 * Lê um texto colado e devolve as linhas digitáveis que ele contém.
 *
 * Colar do PDF do banco raramente sai limpo, então o parser lida com os três casos reais:
 *  · um código por linha (o caso comum);
 *  · um código QUEBRADO em duas linhas pelo PDF (21+26 dígitos) — junta os pedaços;
 *  · dois códigos na MESMA linha, separados por espaço — separa pelos tamanhos possíveis.
 *
 * O que não fechar 47/48 dígitos é DESCARTADO e contado em `ignoradas`: aplicar um fragmento
 * por cima de um código bom seria pior do que não aplicar nada.
 */
export function separarCodigosColados(texto: string): CodigosColados {
  const trechos = texto.split(/[\n\r;\t]+/).map(digitosDe).filter((c) => c.length > 0)
  const codigos: string[] = []
  let ignoradas = 0
  let buffer = ''   // pedaços que ainda não fecharam um código

  for (const trecho of trechos) {
    // Linha que já é um código inteiro: entra direto e o que estava pendente vira descarte
    // (evita que uma linha solta de lixo "engula" todos os códigos seguintes).
    if (tamanhoValido(trecho)) {
      if (buffer) { ignoradas++; buffer = '' }
      codigos.push(trecho)
      continue
    }
    buffer += trecho
    const partes = decompor(buffer.length)
    if (!partes) continue
    let off = 0
    for (const t of partes) { codigos.push(buffer.slice(off, off + t)); off += t }
    buffer = ''
  }
  if (buffer) ignoradas++

  return { codigos, ignoradas }
}
