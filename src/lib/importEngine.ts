/**
 * importEngine.ts — Importador genérico XLSX/CSV reusável por TODOS os módulos.
 *
 * Padrão: cada módulo passa um `ImportConfig<T>` declarativo e a engine
 * cuida do parse, validação Zod, normalização e relatório de erros.
 *
 * Por que centralizar:
 *  - 1 lugar para corrigir bugs de parse (SheetJS edge cases)
 *  - validação Zod uniforme por linha
 *  - error reporting consistente (linha + coluna + motivo)
 *  - aceita .xlsx, .xls, .csv (text com vírgula ou ponto-e-vírgula)
 *  - funciona offline (sem upload pra servidor)
 *
 * Segurança:
 *  - Limite de 5MB e 5000 linhas para evitar DoS
 *  - Parsing local (FileReader); nenhum byte sai do navegador
 *  - Sem eval, sem dangerouslySetInnerHTML
 *  - Usa SheetJS read() em modo "binary" / "string" — opções seguras
 */
import * as XLSX from 'xlsx'
import { z, type ZodTypeAny } from 'zod'

const MAX_FILE_SIZE_MB = 5
const MAX_ROWS = 5000

// ─── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Define UMA coluna do template: como mapear da planilha para o objeto T.
 * O usuário pode usar headers em PT-BR no Excel; nós aceitamos qualquer alias.
 */
export interface ImportColumn<T, K extends keyof T = keyof T> {
  /** Chave do objeto destino (ex: "code") */
  key: K
  /** Header esperado na planilha (case-insensitive). Pode ser array de aliases */
  headerAliases: string[]
  /** Coerção: por padrão é string. Pode ser 'number', 'boolean', 'date' (yyyy-MM-dd) */
  type?: 'string' | 'number' | 'boolean' | 'date'
  /** Valor padrão se a célula estiver vazia */
  defaultValue?: T[K]
  /** Se verdadeiro, valor obrigatório (linha rejeitada se vazia) */
  required?: boolean
  /** Transformer custom — recebe o valor cru e retorna o final */
  transform?: (raw: unknown) => T[K]
}

export interface ImportConfig<T extends Record<string, unknown>> {
  /** Schema Zod para validar a linha já normalizada */
  schema: ZodTypeAny
  /** Mapeamento das colunas */
  columns: ImportColumn<T>[]
  /** Templates de exemplo que podem ser baixados pelo usuário (opcional) */
  exampleHeaders?: string[]
  exampleRow?: Record<string, string | number>
}

export interface ImportResult<T> {
  /** Linhas válidas e normalizadas, prontas para inserir no store */
  validRows: T[]
  /** Erros por linha (1-indexed, considerando cabeçalho como linha 1) */
  errors: ImportError[]
  /** Total de linhas processadas (válidas + inválidas) */
  totalProcessed: number
  /** Hash SHA-1 simplificado do arquivo (para audit log) */
  fileHash: string
}

export interface ImportError {
  /** Linha do arquivo (2 = primeira linha de dados) */
  rowNumber: number
  /** Coluna que falhou (header original) */
  column?: string
  /** Mensagem amigável */
  message: string
  /** Dados crus da linha (para o usuário entender o que falhou) */
  rawRow?: Record<string, unknown>
}

// ─── Validações de pré-processamento ──────────────────────────────────────────

export function validateFileBeforeParse(file: File): { ok: true } | { ok: false; error: string } {
  const ext = file.name.toLowerCase().split('.').pop()
  if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
    return { ok: false, error: 'Tipo de arquivo não suportado. Use .xlsx, .xls ou .csv.' }
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { ok: false, error: `Arquivo muito grande. Máximo ${MAX_FILE_SIZE_MB} MB.` }
  }
  return { ok: true }
}

// ─── Hash leve para audit log ────────────────────────────────────────────────

function quickHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(16)
}

// ─── Coerção de tipos ────────────────────────────────────────────────────────

function coerceValue<T, K extends keyof T>(
  raw: unknown,
  col: ImportColumn<T, K>,
): T[K] | undefined {
  // Empty handling
  if (raw == null || raw === '') {
    if (col.defaultValue !== undefined) return col.defaultValue
    if (col.required) return undefined as T[K]
    return undefined
  }

  // Custom transform always wins
  if (col.transform) return col.transform(raw)

  const type = col.type ?? 'string'

  switch (type) {
    case 'string':
      return String(raw).trim() as T[K]

    case 'number': {
      // Aceita "1.234,56" (BR) e "1,234.56" (US)
      const str = String(raw).trim()
      const normalized = str.includes(',') && !str.includes('.')
        ? str.replace(',', '.')
        : str.replace(/\./g, '').replace(',', '.')
      const n = Number(normalized)
      return (Number.isFinite(n) ? n : undefined) as T[K]
    }

    case 'boolean': {
      const str = String(raw).toLowerCase().trim()
      if (['true', 'sim', 'yes', '1', 'verdadeiro'].includes(str)) return true as T[K]
      if (['false', 'nao', 'não', 'no', '0', 'falso'].includes(str)) return false as T[K]
      return undefined as T[K]
    }

    case 'date': {
      // Aceita yyyy-MM-dd, dd/MM/yyyy, dd-MM-yyyy, ou serial Excel
      const str = String(raw).trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str as T[K]
      const brMatch = str.match(/^(\d{2})[/\\-](\d{2})[/\\-](\d{4})$/)
      if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}` as T[K]
      // Excel serial
      if (typeof raw === 'number') {
        const date = XLSX.SSF.parse_date_code(raw)
        if (date) {
          const yyyy = String(date.y).padStart(4, '0')
          const mm = String(date.m).padStart(2, '0')
          const dd = String(date.d).padStart(2, '0')
          return `${yyyy}-${mm}-${dd}` as T[K]
        }
      }
      return undefined as T[K]
    }
  }
}

// ─── Mapeamento de colunas: encontra o header certo na planilha ──────────────

function findHeaderKey(rowKeys: string[], aliases: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
  const normalizedRowKeys = rowKeys.map((k) => ({ raw: k, norm: norm(k) }))
  for (const alias of aliases) {
    const aliasN = norm(alias)
    const found = normalizedRowKeys.find((rk) => rk.norm === aliasN)
    if (found) return found.raw
  }
  return null
}

// ─── Função principal: parsear + validar ────────────────────────────────────

export async function parseAndValidate<T extends Record<string, unknown>>(
  file: File,
  config: ImportConfig<T>,
): Promise<ImportResult<T>> {
  const validation = validateFileBeforeParse(file)
  if (!validation.ok) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: validation.error }],
      totalProcessed: 0,
      fileHash: '',
    }
  }

  // Lê o arquivo
  const arrayBuffer = await file.arrayBuffer()
  const fileText = new TextDecoder('utf-8').decode(arrayBuffer.slice(0, 4096))
  const fileHash = quickHash(file.name + file.size + fileText.slice(0, 200))

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })
  } catch (e) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: `Falha ao ler arquivo: ${e instanceof Error ? e.message : 'erro desconhecido'}` }],
      totalProcessed: 0,
      fileHash,
    }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: 'Arquivo sem nenhuma aba.' }],
      totalProcessed: 0,
      fileHash,
    }
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })

  if (rows.length === 0) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: 'Arquivo sem nenhuma linha de dados.' }],
      totalProcessed: 0,
      fileHash,
    }
  }

  if (rows.length > MAX_ROWS) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: `Arquivo com ${rows.length} linhas excede o máximo de ${MAX_ROWS}.` }],
      totalProcessed: rows.length,
      fileHash,
    }
  }

  // Mapeia headers da planilha → keys do objeto T
  const firstRow = rows[0]
  const sheetHeaders = Object.keys(firstRow)
  const headerMap = new Map<keyof T, string>()
  const missingRequired: string[] = []

  for (const col of config.columns) {
    const found = findHeaderKey(sheetHeaders, col.headerAliases)
    if (found) {
      headerMap.set(col.key, found)
    } else if (col.required) {
      missingRequired.push(col.headerAliases[0] ?? String(col.key))
    }
  }

  if (missingRequired.length > 0) {
    return {
      validRows: [],
      errors: [{
        rowNumber: 1,
        message: `Cabeçalhos obrigatórios ausentes: ${missingRequired.join(', ')}. Verifique se sua planilha bate com o template.`,
      }],
      totalProcessed: 0,
      fileHash,
    }
  }

  const validRows: T[] = []
  const errors: ImportError[] = []

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2 // +2 porque idx começa em 0 e linha 1 é o header
    const obj: Partial<T> = {}

    let rowError = false
    for (const col of config.columns) {
      const sheetKey = headerMap.get(col.key)
      const rawValue = sheetKey ? row[sheetKey] : undefined
      const coerced = coerceValue(rawValue, col)

      if (coerced === undefined && col.required) {
        errors.push({
          rowNumber,
          column: sheetKey ?? col.headerAliases[0],
          message: `Campo obrigatório vazio ou inválido: "${col.headerAliases[0]}"`,
          rawRow: row,
        })
        rowError = true
        break
      }
      ;(obj as Record<string, unknown>)[col.key as string] = coerced
    }

    if (rowError) return

    // Valida com Zod
    const result = config.schema.safeParse(obj)
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      errors.push({
        rowNumber,
        column: firstIssue?.path[0] ? String(firstIssue.path[0]) : undefined,
        message: firstIssue?.message ?? 'Erro de validação',
        rawRow: row,
      })
    } else {
      validRows.push(result.data as T)
    }
  })

  return {
    validRows,
    errors,
    totalProcessed: rows.length,
    fileHash,
  }
}

// ─── Geração de template Excel para download ─────────────────────────────────

/**
 * Gera um arquivo .xlsx de exemplo baseado no ImportConfig e dispara download.
 * Útil para o cliente que clica "Baixar template" antes de preencher.
 */
export function downloadTemplate<T extends Record<string, unknown>>(
  config: ImportConfig<T>,
  filename: string,
): void {
  const headers = config.exampleHeaders ?? config.columns.map((c) => c.headerAliases[0])
  const exampleRow = config.exampleRow
    ? headers.map((h) => config.exampleRow?.[h] ?? '')
    : headers.map(() => '')

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])

  // Set widths
  ws['!cols'] = headers.map(() => ({ wch: 18 }))

  XLSX.utils.book_append_sheet(wb, ws, 'Template')

  // Aba de instruções
  const instructions = [
    ['INSTRUÇÕES DE PREENCHIMENTO'],
    [''],
    ['Coluna', 'Tipo', 'Obrigatório', 'Descrição'],
    ...config.columns.map((c) => [
      c.headerAliases[0],
      c.type ?? 'string',
      c.required ? 'Sim' : 'Não',
      c.headerAliases.length > 1 ? `Aliases aceitos: ${c.headerAliases.slice(1).join(', ')}` : '',
    ]),
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(instructions)
  ws2['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Instruções')

  XLSX.writeFile(wb, filename)
}

// ─── Re-export Zod helpers úteis ─────────────────────────────────────────────

export { z }
