/**
 * planilhaFiel.ts — reescrever a planilha do cliente SEM reconstruí-la.
 *
 * ─── O PROBLEMA, MEDIDO ───────────────────────────────────────────────────────
 * A exportação que existia montava um `.xlsx` novo a partir do que o sistema guardou. O cliente
 * comparou os dois arquivos e a conta dele estava certa em todos os pontos:
 *
 * | | original | reconstruído |
 * |---|---|---|
 * | fórmulas | **50.838** | 0 |
 * | Medição | 1.512 × 28 | 54 × 21 |
 * | Programação Diária | 904 × 26 | 45 × 19 |
 * | Cadastro de Serviços | 604 × 32 | 55 × 25 |
 * | ordem das abas | do `xl/workbook.xml` | do agrupamento da tela |
 *
 * E isso **não tem conserto pela via da reconstrução**: a edição community do SheetJS não escreve
 * validação de dados, nem formatação condicional, nem estilo de célula (`xlsx.js:14781` é
 * literalmente um comentário `TODO: cell style`). Reconstruir é perder, por definição.
 *
 * ─── A SAÍDA: CIRURGIA ────────────────────────────────────────────────────────
 * O arquivo original fica guardado byte a byte no bucket. Para exportar "a planilha atual", abre-se
 * aquele ZIP e reescreve-se **apenas o `<v>` das células que mudaram**. Tudo o mais — as 50.838
 * fórmulas, as 55 listas, as 13 regras, os nomes definidos, a ordem das abas, as colunas sem
 * título, as linhas vazias, os zeros, a formatação — continua exatamente onde estava, porque
 * ninguém tocou nelas.
 *
 * Este módulo é a parte PURA (string de XML entra, string de XML sai) e tem teste de mesa. O
 * encanamento do `jszip` mora em `planilhaFielZip.ts`, pela mesma razão que separa
 * `leitorPlanilha` de `leitorPlanilhaZip`: o `jszip` não carrega no resolver de testes, e deixar a
 * regra junto dele deixaria a regra sem teste.
 */
import { chaveDaColuna, type ColunaLida } from './leitorPlanilha'
import { COLUNAS_DE_IDENTIDADE, chaveDaLinha } from './chaveDaLinha'
import { ehRegistroReal } from './importarPlanilha'
import type { AbaNoSistema, LinhaOperacional, SabespSheetId } from './sabespStore'

// ─── Endereço de célula ───────────────────────────────────────────────────────

export function letraDaColuna(indice: number): string {
  let n = indice + 1
  let s = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    s = String.fromCharCode(65 + resto) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function indiceDaLetra(letra: string): number {
  let n = 0
  for (const c of letra.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/** `(0, 0)` → `A1`. Os dois índices são 0-based, como a matriz guardada. */
export const refDaCelula = (linha: number, coluna: number): string => `${letraDaColuna(coluna)}${linha + 1}`

/**
 * De onde a matriz começa dentro da aba.
 *
 * ⚠️ As 22 abas deste arquivo começam em `A1`, conferido uma a uma — mas uma revisão futura pode
 * vir com a primeira célula em outro canto, e aí TODA célula escrita cairia deslocada, em silêncio.
 * Por isso a origem é lida do XML, não presumida.
 */
export function origemDaAba(xmlDaAba: string): { linha: number; coluna: number } {
  const dim = xmlDaAba.match(/<dimension\s+ref="([A-Z]+)(\d+)/)
  if (dim) return { linha: Number(dim[2]) - 1, coluna: indiceDaLetra(dim[1]) }
  const primeira = xmlDaAba.match(/<row[^>]*\sr="(\d+)"/)
  return { linha: primeira ? Number(primeira[1]) - 1 : 0, coluna: 0 }
}

// ─── Qual linha da planilha é qual registro ───────────────────────────────────

/**
 * A chave de cada registro → o índice da linha dele NA MATRIZ da aba.
 *
 * Reproduz passo a passo o que a importação fez (mesmo cabeçalho, mesmo filtro, mesma chave, mesmo
 * contador de repetição) — é o único jeito de saber em que linha do arquivo original escrever.
 *
 * ⚠️ Se o cliente mandar uma revisão com as linhas em outra ordem e reimportar, a matriz guardada
 * é a da revisão nova, e o mapa acompanha. O que NÃO pode acontecer é escrever no arquivo antigo
 * com o mapa novo — por isso a cirurgia só roda sobre o original do MESMO lote.
 */
export function linhasDaAbaNaMatriz(
  aba: SabespSheetId,
  colunas: readonly ColunaLida[],
  matriz: readonly string[][],
  linhaDoCabecalho: number,
): Map<string, number> {
  const identidade = COLUNAS_DE_IDENTIDADE[aba]
  const jaVistas = new Map<string, number>()
  const out = new Map<string, number>()
  for (let r = linhaDoCabecalho + 1; r < matriz.length; r++) {
    const crua = matriz[r] ?? []
    const valores: Record<string, string> = {}
    for (const c of colunas) valores[chaveDaColuna(c)] = String(crua[c.indice] ?? '').trim()
    // `lerAba` descarta a linha inteiramente vazia antes do filtro de negócio. A ordem importa:
    // ela conta para o `jaVistas`, e pular na ordem errada desloca todos os `#n` seguintes.
    if (!Object.values(valores).some((v) => v)) continue
    if (!ehRegistroReal(aba, valores)) continue
    out.set(chaveDaLinha(valores, identidade, jaVistas), r)
  }
  return out
}

export interface CelulaAlterada {
  /** Índice da linha na matriz da aba (0-based), somado à origem vira a linha do XML. */
  linha: number
  /** Índice da coluna na matriz (0-based). */
  coluna: number
  valor: string
  /** Para a tela dizer o que mudou, sem o usuário ter que abrir o arquivo. */
  de: string
  chave: string
  titulo: string
}

/**
 * O que o sistema tem de diferente do que o arquivo trazia, célula a célula.
 *
 * ⚠️ Compara contra a MATRIZ GUARDADA NA IMPORTAÇÃO, não contra o que a tela mostra. A matriz é o
 * arquivo; a diferença entre ela e a linha do sistema é exatamente o conjunto de edições feitas
 * desde então — nem uma célula a mais.
 */
export function celulasAlteradas(
  aba: SabespSheetId,
  meta: AbaNoSistema,
  linhas: readonly LinhaOperacional[],
): CelulaAlterada[] {
  const matriz = meta.matriz
  if (!matriz || meta.linhaDoCabecalho === undefined) return []
  const mapa = linhasDaAbaNaMatriz(aba, meta.colunas, matriz, meta.linhaDoCabecalho)
  const out: CelulaAlterada[] = []
  for (const linha of linhas) {
    if (linha.aba !== aba) continue
    const r = mapa.get(linha.chave)
    // Linha criada no sistema (ou cuja chave já não existe no arquivo) não tem onde ser escrita
    // sem inventar estrutura. A cirurgia não inventa: quem quiser ver isso usa a exportação
    // derivada, que declara que é derivada.
    if (r === undefined) continue
    for (const c of meta.colunas) {
      const campo = chaveDaColuna(c)
      const novo = String(linha.valores[campo] ?? '').trim()
      const velho = String(matriz[r]?.[c.indice] ?? '').trim()
      if (novo === velho) continue
      out.push({ linha: r, coluna: c.indice, valor: novo, de: velho, chave: linha.chave, titulo: c.titulo || `Coluna ${c.indice + 1}` })
    }
  }
  return out
}

// ─── A escrita no XML ─────────────────────────────────────────────────────────

export const escaparXml = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Número de verdade, ou texto?
 *
 * ⚠️ `'0001'` e `'09/2026'` NÃO são números. Gravá-los como número transformaria o código do
 * serviço em `1` dentro do arquivo do cliente — e a planilha inteira depende desses códigos para
 * o PROCV. O teste da ida e volta (`String(Number(v)) === v`) é o que separa os dois casos.
 */
export const ehNumero = (v: string): boolean => v !== '' && Number.isFinite(Number(v)) && String(Number(v)) === v

export interface ResultadoDaEscrita {
  xml: string
  escritas: number
  /** Células que são FÓRMULA no original e por isso não foram tocadas. */
  formulas: string[]
  /** Células cuja linha não existe no XML — não há onde escrever sem inventar estrutura. */
  semLugar: string[]
}

/**
 * Escreve valores em células de uma aba, preservando tudo o mais do XML.
 *
 * ⚠️ **Fórmula nunca é sobrescrita.** Trocar `<f>` por um literal apagaria a conta e deixaria um
 * número solto no lugar dela — e são 50.838 delas neste arquivo. Quando alguém edita no sistema
 * uma célula que lá é calculada, a edição não entra no arquivo fiel e a tela DIZ isso; escrever
 * por cima em silêncio seria pior que não escrever.
 *
 * ⚠️ O `s=` (índice de estilo) da célula original é preservado. Sem ele, a célula reescrita perde
 * formato de moeda, data e alinhamento — e o arquivo "fiel" volta com buracos visuais.
 */
export function escreverCelulas(
  xmlDaAba: string,
  celulas: ReadonlyArray<{ ref: string; valor: string }>,
): ResultadoDaEscrita {
  let xml = xmlDaAba
  let escritas = 0
  const formulas: string[] = []
  const semLugar: string[] = []

  // Da última linha para a primeira: escrever desloca os índices do que vem DEPOIS no texto, e ir
  // de trás para a frente mantém válidas as posições ainda não usadas.
  const ordenadas = [...celulas].sort((a, b) => {
    const la = Number(a.ref.match(/\d+/)![0]); const lb = Number(b.ref.match(/\d+/)![0])
    if (la !== lb) return lb - la
    return indiceDaLetra(b.ref.match(/[A-Z]+/)![0]) - indiceDaLetra(a.ref.match(/[A-Z]+/)![0])
  })

  for (const { ref, valor } of ordenadas) {
    const numeroDaLinha = Number(ref.match(/\d+/)![0])
    const bloco = acharLinha(xml, numeroDaLinha)
    if (!bloco) { semLugar.push(ref); continue }
    xml = bloco.xml

    const conteudo = xml.slice(bloco.conteudoIni, bloco.conteudoFim)
    const existente = acharCelula(conteudo, ref)
    if (existente && /<f[\s/>]/.test(existente.inteiro)) { formulas.push(ref); continue }

    const estilo = existente?.inteiro.match(/\ss="(\d+)"/)?.[1]
    const nova = montarCelula(ref, valor, estilo)
    const novoConteudo = existente
      ? conteudo.slice(0, existente.ini) + nova + conteudo.slice(existente.fim)
      : inserirEmOrdem(conteudo, ref, nova)
    xml = xml.slice(0, bloco.conteudoIni) + novoConteudo + xml.slice(bloco.conteudoFim)
    escritas++
  }
  return { xml, escritas, formulas, semLugar }
}

function montarCelula(ref: string, valor: string, estilo?: string): string {
  const s = estilo ? ` s="${estilo}"` : ''
  if (valor === '') return `<c r="${ref}"${s}/>`
  if (ehNumero(valor)) return `<c r="${ref}"${s}><v>${valor}</v></c>`
  // `inlineStr` em vez de mexer em `xl/sharedStrings.xml`: a tabela compartilhada é indexada por
  // posição e é referenciada por milhares de células — inserir uma entrada nela para escrever uma
  // célula é risco desproporcional. O Excel lê `inlineStr` igual.
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`
}

/**
 * Acha a linha no XML e devolve onde o conteúdo dela começa e termina.
 *
 * ⚠️ Devolve o XML junto porque uma linha declarada vazia (`<row r="7"/>`) precisa ser ABERTA
 * antes de receber célula, e isso muda o texto. Quem chama tem de adotar o `xml` devolvido — usar
 * o antigo com os índices novos escreveria no meio de outra célula.
 */
function acharLinha(
  xml: string,
  numero: number,
): { xml: string; conteudoIni: number; conteudoFim: number } | null {
  const abre = new RegExp(`<row[^>]*\\sr="${numero}"[^>]*>`)
  const m = abre.exec(xml)
  if (!m) return null
  if (m[0].endsWith('/>')) {
    // Linha vazia vira linha com conteúdo, preservando os atributos (altura, estilo) que ela tinha.
    const aberta = `${m[0].slice(0, -2)}></row>`
    const expandido = xml.slice(0, m.index) + aberta + xml.slice(m.index + m[0].length)
    const conteudoIni = m.index + aberta.length - '</row>'.length
    return { xml: expandido, conteudoIni, conteudoFim: conteudoIni }
  }
  const conteudoIni = m.index + m[0].length
  const conteudoFim = xml.indexOf('</row>', conteudoIni)
  if (conteudoFim < 0) return null
  return { xml, conteudoIni, conteudoFim }
}

function acharCelula(conteudo: string, ref: string): { ini: number; fim: number; inteiro: string } | null {
  const re = new RegExp(`<c[^>]*\\sr="${ref}"(?:\\s[^>]*)?(?:/>|>[\\s\\S]*?</c>)`)
  const m = re.exec(conteudo)
  return m ? { ini: m.index, fim: m.index + m[0].length, inteiro: m[0] } : null
}

/** O Excel exige as células em ordem crescente de coluna dentro da linha. */
function inserirEmOrdem(conteudo: string, ref: string, nova: string): string {
  const alvo = indiceDaLetra(ref.match(/[A-Z]+/)![0])
  for (const m of conteudo.matchAll(/<c[^>]*\sr="([A-Z]+)\d+"/g)) {
    if (indiceDaLetra(m[1]) > alvo) return conteudo.slice(0, m.index) + nova + conteudo.slice(m.index)
  }
  return conteudo + nova
}

/**
 * Manda o Excel recalcular ao abrir.
 *
 * ⚠️ Sem isto o arquivo abre com o **valor em cache** das fórmulas que dependem das células
 * reescritas: a célula editada mostra o número novo e o total logo abaixo continua mostrando o
 * velho. O usuário vê uma planilha que não fecha consigo mesma, e culpa o sistema.
 */
export function marcarRecalculo(workbookXml: string): string {
  if (/<calcPr[^>]*\bfullCalcOnLoad="1"/.test(workbookXml)) return workbookXml
  if (/<calcPr\b/.test(workbookXml)) {
    return workbookXml.replace(/<calcPr\b([^>]*?)\/?>/, (_m, attrs: string) => `<calcPr${attrs} fullCalcOnLoad="1"/>`)
  }
  return workbookXml.replace(/<\/workbook>/, '<calcPr fullCalcOnLoad="1"/></workbook>')
}
