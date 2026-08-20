/**
 * parseExcelEstoque.ts — Excel/CSV parsing utilities for Materiais & Estoque import.
 * Reuses the xlsx library already present in package.json.
 */
import * as XLSX from 'xlsx'
import type { ItemEstoque } from '@/types'
import { parseLocaleNumber } from '@/lib/numberFormat'

export interface ExcelPreview {
  headers: string[]
  /**
   * TODAS as linhas da planilha, como texto cru.
   *
   * Isto era `raw.slice(0, 20)` — e a mesma lista truncada era usada para GRAVAR, não só para a
   * prévia. Uma planilha de 80 produtos importava 20, e o contador na tela mostrava "20 itens",
   * então nem dava para perceber que faltava. Quem precisa de amostra visual corta na hora de
   * renderizar (o modal já corta em 5).
   */
  rows: Record<string, string>[]
}

// Known field names for auto-suggest mapping
const FIELD_HINTS: Record<string, string[]> = {
  descricao:           ['descrição', 'descricao', 'description', 'material', 'item', 'nome', 'produto'],
  unidade:             ['unidade', 'un', 'unit', 'und', 'medida'],
  qtdDisponivel:       ['qtd disponivel', 'quantidade disponivel', 'disponivel', 'estoque', 'saldo', 'quantidade', 'qtd', 'qty', 'qtdatual'],
  estoqueMinimo:       ['estoque minimo', 'minimo', 'min', 'estoque_min', 'qtd_minima', 'qtd min', 'quantidade critica', 'qtd critica', 'critica'],
  codigoReferencia:    ['codigo de referencia', 'codigo referencia', 'codigo', 'cod ref', 'ref', 'sku', 'referencia'],
  dataUltimoPedido:    ['data ultimo pedido', 'ultimo pedido', 'data pedido', 'data do ultimo pedido'],
  custoUnitario:       ['custo unitario', 'valor unitario', 'unitario', 'custo', 'preco unitario', 'preço unitário', 'price', 'unit cost', 'custounit'],
  valorTotal:          ['valor total', 'total', 'custo total', 'preco total', 'preço total'],
  categoria:           ['categoria', 'category', 'grupo', 'tipo', 'class'],
  fornecedorPrincipal: ['fornecedor', 'supplier', 'vendor', 'fornecedorprincipal', 'fornec'],
  // Embalagem (facilitador) — a caixa/fardo é só para lançar; o estoque fica em unidades.
  unidadeEmbalagem:    ['embalagem', 'tipo embalagem', 'rotulo embalagem', 'unidade embalagem'],
  qtdPorEmbalagem:     ['un por embalagem', 'unidades por embalagem', 'un por caixa', 'un/caixa', 'qtd por embalagem', 'itens por caixa', 'por caixa', 'conteudo'],
  numEmbalagens:       ['num embalagens', 'numero de embalagens', 'qtd embalagens', 'qtde caixas', 'numero de caixas', 'caixas', 'fardos'],
  valorPorEmbalagem:   ['valor embalagem', 'valor por embalagem', 'valor caixa', 'valor por caixa', 'preco caixa', 'preco embalagem', 'preco por caixa'],
  // Duas colunas da planilha do almoxarifado que não tinham par no modelo. Vivem no `metadata`
  // jsonb do item, sem migração. "Realizar Pedido" estava caindo em `estoqueMinimo` — é uma
  // marcação de comprar ("SIM"/"X"), não uma quantidade, e virava mínimo 0 em todo item.
  linkProduto:         ['link do produto', 'link produto', 'link', 'url', 'site do produto'],
  realizarPedido:      ['realizar pedido', 'fazer pedido', 'comprar', 'pedir', 'repor'],
}

/** "SIM", "X", "1", "true" → true. Vazio, "NAO", "-" → false. */
function parseSimNao(raw: string): boolean {
  const v = normalize(raw)
  if (!v) return false
  return ['sim', 's', 'x', '1', 'true', 'ok', 'sim!', 'urgente'].includes(v)
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Quebra a quantidade quando a embalagem vem embutida numa c\u00e9lula s\u00f3.
 * "9 cx (24un)" \u2192 { num:9, unidadeExterna:'cx', porEmb:24, unidadeInterna:'un' }
 * "14 rolos"    \u2192 { num:14, unidadeExterna:'rolos' }
 * "1 un" / "216" \u2192 { num:1|216 }
 */
function parseQuantidadeEmbalagem(raw: string): { num: number; unidadeExterna?: string; porEmb?: number; unidadeInterna?: string } {
  const s = (raw ?? '').trim()
  if (!s) return { num: 0 }
  const emb = s.match(/^([\d.,]+)\s*([a-z\u00e7]+)?\s*\(\s*([\d.,]+)\s*([a-z\u00e7\u00b2]+)?\s*\)/i)
  if (emb) {
    return { num: parseLocaleNumber(emb[1]), unidadeExterna: emb[2]?.toLowerCase() || undefined, porEmb: parseLocaleNumber(emb[3]), unidadeInterna: emb[4]?.toLowerCase() || undefined }
  }
  const simp = s.match(/^([\d.,]+)\s*([a-z\u00e7\u00b2]+)?/i)
  if (simp) return { num: parseLocaleNumber(simp[1]), unidadeExterna: simp[2]?.toLowerCase() || undefined }
  return { num: parseLocaleNumber(s) }
}

/** "dd/mm/yyyy" \u2192 "yyyy-MM-dd". Placeholder ("dd/mm/yyyy") e vazio \u2192 undefined. */
function parseDataBR(raw: string): string | undefined {
  const s = (raw ?? '').trim()
  if (!s || /[a-z]/i.test(s.replace(/\//g, ''))) return undefined   // "dd/mm/yyyy" e afins
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return undefined
}

/**
 * Adivinha a qual campo do sistema um cabeçalho da planilha corresponde.
 *
 * ─── POR QUE ISTO NÃO É UM `includes` ─────────────────────────────────────────────────────────
 * Era: percorria os campos na ordem do objeto e devolvia o PRIMEIRO cuja dica estivesse contida no
 * cabeçalho. Duas colunas da planilha real do cliente caíam no campo errado, e o efeito era
 * destrutivo:
 *
 *   "Quantidade Crítica"  → `qtdDisponivel`, porque a dica 'quantidade' está contida nela e
 *                           `qtdDisponivel` é testado antes de `estoqueMinimo`
 *   "Link do Produto"     → `descricao`,     porque a dica 'produto' está contida nela e
 *                           `descricao` é o primeiro campo do objeto
 *
 * Somado ao fato de que o mapa invertido deixava a ÚLTIMA coluna vencer, importar a planilha
 * gravava o nome do produto como "[URL]" e o saldo como a quantidade crítica — que naquela planilha
 * está vazia, ou seja, zero. Vinte e três produtos chamados "[URL]" com saldo zero.
 *
 * Agora a decisão é por PONTUAÇÃO, e a dica mais específica vence:
 *
 *   1000  o cabeçalho é IGUAL à dica            ("quantidade critica" = 'quantidade critica')
 *    100  a dica aparece como palavra inteira   ("qtd critica no dep" contém 'qtd critica')
 *     50  a dica CONTÉM o cabeçalho             ("fornec" dentro de 'fornecedorprincipal')
 *
 * Empate é desfeito pelo tamanho da dica, então 'quantidade critica' (18) ganha de 'quantidade'
 * (10) no mesmo cabeçalho. É isso que conserta os dois casos acima.
 */
export function autoSuggestField(header: string): string {
  const n = normalize(header)
  if (!n) return 'ignorar'

  let melhorCampo = 'ignorar'
  let melhorNota = 0

  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    for (const h of hints) {
      let nota = 0
      if (n === h) nota = 1000 + h.length
      else if (contemPalavraInteira(n, h)) nota = 100 + h.length
      else if (h.includes(n)) nota = 50 + n.length
      if (nota > melhorNota) { melhorNota = nota; melhorCampo = field }
    }
  }
  return melhorCampo
}

/**
 * A dica aparece no cabeçalho delimitada por não-alfanumérico?
 *
 * Fronteira de caractere, não `includes`: assim 'quantidade' casa em "quantidade (un)" e NÃO casa
 * dentro de outra palavra. É a mesma regra que `custoLedger.matchesProject` usa para não deixar
 * "OBRA-1" casar com "OBRA-10".
 */
function contemPalavraInteira(texto: string, dica: string): boolean {
  const escapada = dica.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escapada}([^a-z0-9]|$)`, 'i').test(texto)
}

/**
 * Duas colunas disputando o mesmo campo.
 *
 * Antes isso passava calado — `inv[campo] = cabecalho` deixava a última coluna do arquivo vencer, e
 * era exatamente assim que "Link do Produto" roubava o lugar de "Produto". A tela precisa mostrar.
 */
export interface ConflitoDeColuna {
  campo: string
  cabecalhos: string[]
}

export function detectarConflitos(mapping: Record<string, string>): ConflitoDeColuna[] {
  const porCampo = new Map<string, string[]>()
  for (const [cabecalho, campo] of Object.entries(mapping)) {
    if (campo === 'ignorar') continue
    porCampo.set(campo, [...(porCampo.get(campo) ?? []), cabecalho])
  }
  return [...porCampo.entries()]
    .filter(([, cabecalhos]) => cabecalhos.length > 1)
    .map(([campo, cabecalhos]) => ({ campo, cabecalhos }))
}

/** Read an Excel/CSV file and return headers + first 20 rows. */
export function previewExcel(file: File): Promise<ExcelPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb   = XLSX.read(data, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

        if (raw.length === 0) {
          resolve({ headers: [], rows: [] })
          return
        }

        // `Object.keys(raw[0])` não bastava: o `sheet_to_json` omite a chave quando a célula está
        // vazia, então uma coluna preenchida só a partir da linha 30 ficava invisível no
        // mapeamento. Varrer todas as linhas resolve.
        const headers = [...new Set(raw.flatMap((r) => Object.keys(r)))]
        const rows    = raw.map((r) =>
          Object.fromEntries(headers.map((h) => [h, String(r[h] ?? '')]))
        )
        resolve({ headers, rows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}

/** Apply a header→field mapping to raw rows and produce ItemEstoque shapes. */
/**
 * Item vindo da planilha, já mapeado.
 *
 * `qtdDisponivel` e `estoqueMinimo` são OPCIONAIS de propósito, e a diferença importa:
 * `undefined` quer dizer "a planilha não falou sobre isso"; `0` quer dizer "a planilha disse zero".
 * Antes os dois viravam `0`, e como zero passa no filtro de gravação, uma célula em branco
 * **apagava** o estoque mínimo que já existia no sistema. Na planilha do cliente as colunas
 * Fornecedor, Código de Referência e Quantidade Crítica estão vazias nas 23 linhas.
 */
export type ItemImportado = Omit<
  ItemEstoque, 'id' | 'depositoId' | 'qtdReservada' | 'qtdTransito' | 'qtdDisponivel' | 'estoqueMinimo'
> & {
  qtdDisponivel?: number
  estoqueMinimo?: number
}

export function applyColumnMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>,   // excelHeader → fieldName (or 'ignorar')
): ItemImportado[] {
  // fieldName → excelHeader. A PRIMEIRA coluna que reivindica um campo vence — antes era a última,
  // e era assim que "Link do Produto" tomava o lugar de "Produto". Disputa é sinalizada na tela
  // por `detectarConflitos`, não resolvida em silêncio aqui.
  const inv: Record<string, string> = {}
  for (const [header, field] of Object.entries(mapping)) {
    if (field !== 'ignorar' && !inv[field]) inv[field] = header
  }

  return rows
    .filter((row) => {
      const descCol = inv['descricao']
      return descCol ? row[descCol]?.trim() !== '' : true
    })
    .map((row) => {
      const str = (field: string) => (inv[field] ? row[inv[field]]?.trim() ?? '' : '')
      /** A planilha falou sobre este campo? Coluna não mapeada ou célula em branco = não falou. */
      const informado = (field: string) => str(field) !== ''
      /** Número quando informado; `undefined` quando a planilha não disse nada. */
      const numOpt = (field: string) => (informado(field) ? parseLocaleNumber(str(field)) : undefined)
      /** Número para as contas internas, onde ausente pode virar zero sem prejuízo. */
      const num = (field: string) => numOpt(field) ?? 0

      const valorTotal = num('valorTotal')
      // Embalagem: colunas dedicadas têm prioridade; senão parseia a string "9 cx (24un)" da Quantidade.
      const embStr = parseQuantidadeEmbalagem(str('qtdDisponivel'))
      const colPorEmb = num('qtdPorEmbalagem')
      const porEmb = colPorEmb > 0 ? colPorEmb : (embStr.porEmb ?? 0)
      const numEmb = colPorEmb > 0 ? num('numEmbalagens') : (embStr.porEmb ? embStr.num : 0)
      const valorEmb = num('valorPorEmbalagem')

      // A quantidade só existe se ALGUMA fonte falou dela. Sem isso, "31un" e célula vazia
      // produziam o mesmo `0`, e a gravação zerava o saldo do item.
      const quantidade: number | undefined =
        porEmb > 0 && numEmb > 0 ? porEmb * numEmb
        : informado('qtdDisponivel') ? (embStr.num || num('qtdDisponivel'))
        : undefined

      const custoUnitario =
        num('custoUnitario') ||
        (valorEmb > 0 && porEmb > 0 ? valorEmb / porEmb : 0) ||
        ((quantidade ?? 0) > 0 && valorTotal > 0 ? valorTotal / (quantidade as number) : 0)
      // Unidade base: só sobrescreve com a de dentro dos parênteses quando a embalagem veio da STRING
      // ("9 cx (24un)"). Se veio de colunas dedicadas, respeita a coluna "Unidade" mapeada.
      const embFromString = colPorEmb === 0 && (embStr.porEmb ?? 0) > 0
      const unidadeBase = embFromString ? (embStr.unidadeInterna || 'un') : (str('unidade') || embStr.unidadeExterna || '')
      const unidadeEmb = str('unidadeEmbalagem') || (embFromString ? embStr.unidadeExterna : undefined) || undefined

      return {
        descricao:           str('descricao')           || '—',
        unidade:             unidadeBase,
        qtdDisponivel:       quantidade,
        estoqueMinimo:       numOpt('estoqueMinimo'),
        custoUnitario:       custoUnitario || undefined,
        categoria:           str('categoria')           || undefined,
        fornecedorPrincipal: str('fornecedorPrincipal') || undefined,
        qtdPorEmbalagem:     porEmb > 0 ? porEmb : undefined,
        unidadeEmbalagem:    unidadeEmb,
        codigoReferencia:    str('codigoReferencia')    || undefined,
        dataUltimoPedido:    parseDataBR(str('dataUltimoPedido')),
        linkProduto:         str('linkProduto')          || undefined,
        // Quando a COLUNA existe, `false` é resposta e precisa ser gravado — é assim que a
        // marcação se apaga depois que o pedido foi feito. Antes `false` virava `undefined`,
        // era descartado no patch, e a marcação ficava acesa para sempre.
        realizarPedido:      inv['realizarPedido'] ? parseSimNao(str('realizarPedido')) : undefined,
      }
    })
}
