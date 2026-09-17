/**
 * leitorPlanilha.ts — ler a planilha SABESP INTEIRA, não só as células.
 *
 * ─── O QUE FALTAVA, MEDIDO NO ARQUIVO REAL (rev15) ────────────────────────────
 * O leitor anterior pegava as 20 abas operacionais e parava aí. Contra
 * `CONTROLE OPERACIONAL SABESP - BERTIOGA GUARUJA E SANTOS - WCR-rev15`:
 *
 *  · 55 listas suspensas — **45 resolvidas, 10 vazias.** As 10 são listas LITERAIS
 *    (`formula1` = `"SIM,NÃO"`), e o código só sabia ler intervalo NOMEADO.
 *  · 7 regras de data + 6 de número — **0 lidas.** O laço descartava tudo que não fosse lista.
 *  · `01. CONFIGURAÇÕES` é um FORMULÁRIO (rótulo na coluna B, valor na C) e era lido como tabela:
 *    o valor `WCR SANEAMENTO` virava NOME DE COLUNA e os parâmetros viravam dados.
 *  · 206 das 513 colunas não têm título e viravam `Coluna N` — 40% da largura da tabela.
 *
 * ⚠️ E a aba era casada com `xl/worksheets/sheetN.xml` pela POSIÇÃO. No arquivo atual coincide,
 * mas o OOXML não garante: a ordem real vem de `xl/workbook.xml` + os rels. Aqui é pelo rel.
 */
import * as XLSX from 'xlsx'

// ─── Regras de preenchimento ──────────────────────────────────────────────────

export type TipoDeCampo = 'texto' | 'lista' | 'data' | 'numero'

export interface RegraDeCampo {
  tipo: TipoDeCampo
  /** Só para `lista`. Vazio quando a planilha declara a lista mas não dá para resolvê-la. */
  opcoes?: string[]
  /** `data` e `numero`: limites declarados na validação. */
  min?: string
  max?: string
  /** `allowBlank="0"` na planilha. */
  obrigatorio: boolean
  /** O texto que o Excel mostra ao clicar na célula (prompt) ou ao errar (error). */
  mensagem?: string
}

export interface ValidacaoLida extends RegraDeCampo {
  aba: string
  /** O `sqref` cru, para conferência. */
  intervalo: string
  /** Índices de coluna (0 = A) cobertos pelo intervalo. */
  colunas: number[]
  /** O nome da lista quando ela é um intervalo nomeado — vazio quando é literal. */
  listaNomeada?: string
}

const LETRAS = /^\$?([A-Z]+)\$?(\d+)$/

function colunaParaIndice(letras: string): number {
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/** `"D5:D604 F5:F604"` → `[3, 5]`. Um sqref pode ter vários blocos separados por espaço. */
export function colunasDoSqref(sqref: string): number[] {
  const cols = new Set<number>()
  for (const bloco of sqref.split(/\s+/).filter(Boolean)) {
    const [de, ate] = bloco.split(':')
    const a = de?.match(LETRAS)
    const b = (ate ?? de)?.match(LETRAS)
    if (!a || !b) continue
    const i = colunaParaIndice(a[1])
    const f = colunaParaIndice(b[1])
    for (let c = Math.min(i, f); c <= Math.max(i, f); c++) cols.add(c)
  }
  return [...cols].sort((x, y) => x - y)
}

/**
 * As opções de uma lista, venha ela como for.
 *
 * ⚠️ São TRÊS formatos, e o leitor anterior só conhecia o primeiro:
 *   1. intervalo nomeado  — `LST_CONTRATO`
 *   2. lista literal      — `"SIM,NÃO"`  ← as 10 que voltavam vazias
 *   3. intervalo direto   — `'01. CONFIGURAÇÕES'!$A$2:$A$10`
 */
export function opcoesDaFormula(formula: string, wb: XLSX.WorkBook): { opcoes: string[]; nomeada?: string } {
  const f = (formula ?? '').trim()
  if (!f) return { opcoes: [] }

  // 2. literal: vem entre aspas, com as aspas escapadas no XML (&quot; já desescapado aqui).
  if (f.startsWith('"') && f.endsWith('"')) {
    const cru = f.slice(1, -1)
    return { opcoes: cru.split(',').map((v) => v.trim()).filter(Boolean) }
  }

  // 3. intervalo direto na fórmula.
  const direto = f.match(/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/)
  if (direto) return { opcoes: valoresDoIntervalo(wb, direto[1], direto[2], Number(direto[3]), Number(direto[5])) }

  // 1. nomeado.
  const ref = wb.Workbook?.Names?.find((n) => n.Name === f)?.Ref
  const m = ref?.match(/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/)
  if (!m) return { opcoes: [], nomeada: f }
  return { opcoes: valoresDoIntervalo(wb, m[1], m[2], Number(m[3]), Number(m[5])), nomeada: f }
}

function valoresDoIntervalo(wb: XLSX.WorkBook, aba: string, colLetra: string, de: number, ate: number): string[] {
  const ws = wb.Sheets[aba]
  if (!ws) return []
  const c = colunaParaIndice(colLetra)
  const out: string[] = []
  for (let r = de - 1; r <= ate - 1; r++) {
    const cel = ws[XLSX.utils.encode_cell({ r, c })]
    const v = cel?.v
    if (v != null && String(v).trim()) out.push(String(v).trim())
  }
  return [...new Set(out)]
}

/**
 * As validações de UMA aba, a partir do XML dela.
 *
 * ⚠️ Puro de propósito: é aqui que mora a regra difícil (os três formatos de lista, o
 * `dataValidation` auto-fechado, os tipos que não são lista), e é isto que o teste exercita. Abrir
 * o `.xlsx` é trabalho de encanamento e vive em `leitorPlanilhaZip.ts` — o `jszip` não carrega no
 * resolver de testes, e prender a regra a ele deixaria a regra sem teste.
 *
 * O `dataValidation` vem em duas formas — com corpo (`<dataValidation …><formula1>…`) e
 * auto-fechado. O leitor anterior só casava a primeira E exigia `formula1`, então descartava as 13
 * regras de data/número, que não têm lista nenhuma.
 */
export function validacoesDoXml(xml: string, aba: string, wb: XLSX.WorkBook): ValidacaoLida[] {
  const out: ValidacaoLida[] = []
  for (const m of xml.matchAll(/<dataValidation\s([^>]*?)(?:\/>|>([\s\S]*?)<\/dataValidation>)/g)) {
    const attrs = m[1]
    const corpo = m[2] ?? ''
    const tipoBruto = attrs.match(/type="([^"]+)"/)?.[1] ?? ''
    const intervalo = desescapar(attrs.match(/sqref="([^"]+)"/)?.[1] ?? '')
    if (!intervalo) continue
    const f1 = desescapar(corpo.match(/<formula1>([\s\S]*?)<\/formula1>/)?.[1] ?? '').trim()
    const f2 = desescapar(corpo.match(/<formula2>([\s\S]*?)<\/formula2>/)?.[1] ?? '').trim()
    const mensagem = desescapar(attrs.match(/prompt="([^"]*)"/)?.[1] ?? attrs.match(/error="([^"]*)"/)?.[1] ?? '') || undefined
    const obrigatorio = /allowBlank="0"/.test(attrs)
    const base = { aba, intervalo, colunas: colunasDoSqref(intervalo), obrigatorio, mensagem }

    if (tipoBruto === 'list') {
      const { opcoes, nomeada } = opcoesDaFormula(f1, wb)
      out.push({ ...base, tipo: 'lista', opcoes, listaNomeada: nomeada })
    } else if (tipoBruto === 'date') {
      out.push({ ...base, tipo: 'data', min: f1 || undefined, max: f2 || undefined })
    } else if (tipoBruto === 'decimal' || tipoBruto === 'whole') {
      out.push({ ...base, tipo: 'numero', min: f1 || undefined, max: f2 || undefined })
    }
  }
  return out
}

/**
 * O mapa REAL nome da aba → arquivo do zip, lido dos rels.
 *
 * ⚠️ NUNCA pela posição. O leitor anterior casava a aba com `xl/worksheets/sheetN.xml` pelo índice
 * em `SheetNames`. No arquivo atual coincide, mas o OOXML não garante — a ordem verdadeira sai de
 * `xl/workbook.xml` + `xl/_rels/workbook.xml.rels`. Quando não coincide, as validações de uma aba
 * são atribuídas a outra, silenciosamente.
 */
export function mapaDasAbas(workbookXml: string, relsXml: string): Map<string, string> {
  const mapa = new Map<string, string>()
  const porId = new Map<string, string>()
  for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="((?:\/xl\/)?worksheets\/sheet\d+\.xml)"/g)) {
    porId.set(m[1], `xl/${m[2].replace(/^\/xl\//, '')}`)
  }
  for (const m of workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
    const alvo = porId.get(m[2])
    if (alvo) mapa.set(desescapar(m[1]), alvo)
  }
  return mapa
}

export const desescapar = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

// ─── Configurações: é FORMULÁRIO, não tabela ──────────────────────────────────

export interface ParametroDeConfiguracao {
  /** A seção do painel ("A · IDENTIFICAÇÃO"), quando a linha estiver sob uma. */
  secao?: string
  rotulo: string
  valor: string
  /** A célula do valor ("C5") — é o que a planilha cita nas próprias instruções. */
  celula: string
}

/**
 * Lê `01. CONFIGURAÇÕES` como rótulo → valor.
 *
 * ⚠️ Não é tabela. A aba tem o rótulo na coluna B e o valor na C, agrupados por seções em A
 * ("A · IDENTIFICAÇÃO", "B · …"). Passá-la pelo parser de tabela produzia um cabeçalho com o
 * VALOR da primeira linha (`WCR SANEAMENTO` virava nome de coluna) e 30 colunas `Coluna N`.
 */
export function lerConfiguracoes(ws: XLSX.WorkSheet): ParametroDeConfiguracao[] {
  const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
  const out: ParametroDeConfiguracao[] = []
  let secao: string | undefined
  m.forEach((linha, i) => {
    const a = String(linha?.[0] ?? '').trim()
    const b = String(linha?.[1] ?? '').trim()
    const c = String(linha?.[2] ?? '').trim()
    // Cabeçalho de seção: texto na coluna A e nada em B.
    if (a && !b) { secao = a; return }
    if (!b) return
    out.push({ secao, rotulo: b, valor: c, celula: `C${i + 1}` })
  })
  return out
}

// ─── Uma aba de tabela ────────────────────────────────────────────────────────

export interface ColunaLida {
  /** O título como está na planilha. Vazio quando a coluna não tem título. */
  titulo: string
  indice: number
  /** `false` quando a coluna não tem título — são espaçadores, e 40% da largura era disso. */
  temTitulo: boolean
  regra?: RegraDeCampo
}

export interface AbaLida {
  nome: string
  /** Índice (0-based) da linha de cabeçalho encontrada. */
  linhaDoCabecalho: number
  colunas: ColunaLida[]
  linhas: Array<Record<string, string>>
}

const norm = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/**
 * Acha a linha de cabeçalho por pontuação contra as colunas-chave esperadas e lê a aba.
 *
 * A regra de campo de cada coluna vem das validações: a validação cobre um intervalo de células
 * (`D5:D604`), e é o índice da COLUNA que liga uma coisa à outra.
 */
export function lerAba(
  ws: XLSX.WorkSheet,
  nome: string,
  colunasChave: readonly string[],
  validacoes: readonly ValidacaoLida[] = [],
): AbaLida | null {
  const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
  let melhor = -1
  let pontos = 0
  m.slice(0, 20).forEach((linha, i) => {
    const celulas = (linha ?? []).map(norm)
    const p = colunasChave.reduce((soma, chave) => {
      const alvo = norm(chave)
      return soma + (celulas.some((c) => c === alvo || c.startsWith(alvo)) ? 1 : 0)
    }, 0)
    if (p > pontos) { pontos = p; melhor = i }
  })
  if (melhor < 0 || pontos === 0) return null

  const daAba = validacoes.filter((v) => v.aba === nome)
  const regraDaColuna = (i: number): RegraDeCampo | undefined => {
    const v = daAba.find((x) => x.colunas.includes(i))
    if (!v) return undefined
    return { tipo: v.tipo, opcoes: v.opcoes, min: v.min, max: v.max, obrigatorio: v.obrigatorio, mensagem: v.mensagem }
  }

  const colunas: ColunaLida[] = (m[melhor] ?? []).map((cel, i) => {
    const titulo = String(cel ?? '').trim()
    return { titulo, indice: i, temTitulo: titulo.length > 0, regra: regraDaColuna(i) }
  })

  const linhas = m.slice(melhor + 1)
    .map((cruas) => {
      const o: Record<string, string> = {}
      colunas.forEach((c, i) => { o[chaveDaColuna(c)] = String(cruas?.[i] ?? '').trim() })
      return o
    })
    .filter((o) => Object.values(o).some((v) => v))

  return { nome, linhaDoCabecalho: melhor, colunas, linhas }
}

/** A chave da coluna no objeto da linha. Coluna sem título vira `col_<índice>`, não `Coluna N`. */
export function chaveDaColuna(c: ColunaLida): string {
  return c.temTitulo ? c.titulo : `col_${c.indice}`
}
