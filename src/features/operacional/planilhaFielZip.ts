/**
 * planilhaFielZip.ts — o encanamento do `.xlsx` para a cirurgia.
 *
 * Abre o ZIP guardado, entrega o XML de cada aba para `planilhaFiel` reescrever e fecha o ZIP de
 * volta. Nenhuma regra mora aqui — ela está em `planilhaFiel.ts`, que é puro e tem teste de mesa.
 * A separação existe porque o `jszip` não carrega no resolver de testes do projeto; é a mesma
 * divisão entre `leitorPlanilha` e `leitorPlanilhaZip`.
 */
import JSZip from 'jszip'
import { mapaDasAbas } from './leitorPlanilha'
import { escreverCelulas, marcarRecalculo, origemDaAba, refDaCelula, type CelulaAlterada } from './planilhaFiel'

/**
 * ⚠️ `createFolders: false`. Sem isto o JSZip acrescenta entradas de diretório (`xl/`,
 * `xl/worksheets/`) que o arquivo do cliente não tinha. O Excel abre assim mesmo, mas o arquivo
 * deixa de ser idêntico ao original naquilo que não mudou — e é justamente essa a promessa aqui.
 */
const SEM_PASTA = { createFolders: false } as const

export interface AbaParaEscrever {
  /** O nome da aba na planilha (`09. MEDIÇÃO`), não o id interno. */
  sheetName: string
  celulas: readonly CelulaAlterada[]
}

export interface ResultadoDaPlanilhaAtual {
  blob: Blob
  /** Células efetivamente reescritas no arquivo do cliente. */
  escritas: number
  /** Edições que caíram sobre uma FÓRMULA e por isso não entraram — a tela precisa dizer quais. */
  formulas: Array<{ aba: string; ref: string }>
  /** Edições sem linha correspondente no XML. */
  semLugar: Array<{ aba: string; ref: string }>
  abasTocadas: string[]
}

/**
 * Reescreve, no arquivo ORIGINAL, apenas as células que o sistema tem diferentes.
 *
 * ⚠️ O `buffer` tem de ser o arquivo do MESMO lote que gerou a matriz guardada. A conta que
 * transforma "registro" em "linha do XML" (`linhasDaAbaNaMatriz`) é feita sobre aquela matriz; usar
 * um arquivo de outra revisão escreveria os valores em linhas erradas, em silêncio. Quem chama
 * garante isso baixando o `arquivoOriginal` do lote corrente.
 */
export async function gerarPlanilhaAtual(
  buffer: ArrayBuffer,
  abas: readonly AbaParaEscrever[],
): Promise<ResultadoDaPlanilhaAtual> {
  const zip = await JSZip.loadAsync(buffer)
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('text')
  const workbookXml = await zip.file('xl/workbook.xml')?.async('text')
  if (!rels || !workbookXml) throw new Error('O arquivo guardado não parece um .xlsx válido.')

  const caminhos = mapaDasAbas(workbookXml, rels)
  let escritas = 0
  const formulas: Array<{ aba: string; ref: string }> = []
  const semLugar: Array<{ aba: string; ref: string }> = []
  const abasTocadas: string[] = []

  for (const { sheetName, celulas } of abas) {
    if (celulas.length === 0) continue
    const caminho = caminhos.get(sheetName)
    const xml = caminho ? await zip.file(caminho)?.async('text') : undefined
    if (!caminho || !xml) {
      for (const c of celulas) semLugar.push({ aba: sheetName, ref: refDaCelula(c.linha, c.coluna) })
      continue
    }
    // A matriz guardada é 0-based a partir do canto da aba; o XML numera a partir da origem real.
    const origem = origemDaAba(xml)
    const refs = celulas.map((c) => ({
      ref: refDaCelula(origem.linha + c.linha, origem.coluna + c.coluna),
      valor: c.valor,
    }))
    const r = escreverCelulas(xml, refs)
    if (r.escritas > 0) { zip.file(caminho, r.xml, SEM_PASTA); abasTocadas.push(sheetName) }
    escritas += r.escritas
    for (const ref of r.formulas) formulas.push({ aba: sheetName, ref })
    for (const ref of r.semLugar) semLugar.push({ aba: sheetName, ref })
  }

  // Mesmo sem nenhuma escrita o recálculo entra: é barato e garante que o arquivo abre coerente.
  zip.file('xl/workbook.xml', marcarRecalculo(workbookXml), SEM_PASTA)

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  })
  return { blob, escritas, formulas, semLugar, abasTocadas }
}
