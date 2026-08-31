/**
 * A planilha da linha de base, lida pelo sistema.
 *
 * O dado do período-espelho — o que a obra custou ANTES da plataforma — só existe no controle do
 * cliente: uma planilha, a contabilidade, o caderno do engenheiro. Não há como o sistema medir o
 * passado dele. Então ele importa, no mesmo molde do Controle de Caixa, que já funciona e já é o
 * jeito que este cliente trabalha.
 *
 * ⚠️ **Nada é gravado antes da pessoa confirmar** — mesma regra do resto do módulo.
 */
import { lerValor, normalizarTexto, type Celula, type Matriz } from '@/features/financeiro/utils/controleDeCaixaPlanilha'
import type { MesDaLinhaDeBase } from './linhaDeBaseMedida'

export interface ProblemaNaLinha {
  linha: number
  coluna?: string
  motivo: string
  conteudo?: string
}

export interface LeituraDaLinhaDeBase {
  meses: MesDaLinhaDeBase[]
  problemas: ProblemaNaLinha[]
}

/** As colunas do modelo, e os apelidos que a planilha do cliente pode usar. */
const CABECALHOS: Record<string, string[]> = {
  periodo:    ['MES', 'MÊS', 'PERIODO', 'COMPETENCIA', 'REFERENCIA'],
  quantidade: ['QUANTIDADE', 'QTD', 'EXECUTADO', 'PRODUCAO', 'M2', 'METRAGEM'],
  custo:      ['CUSTO', 'CUSTO TOTAL', 'VALOR', 'GASTO', 'DESPESA'],
  homensHora: ['HOMENS-HORA', 'HOMENS HORA', 'HH', 'HORAS', 'HORAS TRABALHADAS'],
}

export const COLUNAS_MODELO = ['MÊS', 'QUANTIDADE', 'CUSTO', 'HOMENS-HORA'] as const

/**
 * `ago/25`, `08/2025`, `2025-08` → `2025-08`.
 *
 * ⚠️ Aceita as três porque é assim que aparece em planilha de obra, e recusar a escrita do cliente
 * é a forma mais rápida de a importação nunca ser usada.
 */
export function lerCompetencia(v: Celula): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`
  }
  const s = normalizarTexto(v)
  if (!s) return null

  const iso = /^(\d{4})[-/](\d{1,2})/.exec(s)
  if (iso) {
    const m = Number(iso[2])
    return m >= 1 && m <= 12 ? `${iso[1]}-${String(m).padStart(2, '0')}` : null
  }
  const br = /^(\d{1,2})[-/](\d{4})$/.exec(s)
  if (br) {
    const m = Number(br[1])
    return m >= 1 && m <= 12 ? `${br[2]}-${String(m).padStart(2, '0')}` : null
  }
  const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
  const nome = /^([A-Z]{3})[A-Z]*[\s./-]*(\d{2,4})$/.exec(s)
  if (nome) {
    const i = MESES.indexOf(nome[1])
    if (i < 0) return null
    let ano = Number(nome[2])
    if (ano < 100) ano += ano < 70 ? 2000 : 1900
    return `${ano}-${String(i + 1).padStart(2, '0')}`
  }
  return null
}

function acharCabecalho(m: Matriz): { linha: number; mapa: Record<string, number> } | null {
  for (let i = 0; i < Math.min(m.length, 10); i++) {
    const mapa: Record<string, number> = {}
    const celulas = m[i] ?? []
    for (let c = 0; c < celulas.length; c++) {
      const texto = normalizarTexto(celulas[c])
      if (!texto) continue
      for (const [campo, nomes] of Object.entries(CABECALHOS)) {
        if (mapa[campo] === undefined && nomes.includes(texto)) { mapa[campo] = c; break }
      }
    }
    if (mapa.periodo !== undefined && mapa.quantidade !== undefined && mapa.custo !== undefined) {
      return { linha: i, mapa }
    }
  }
  return null
}

export function lerLinhaDeBase(matriz: Matriz): LeituraDaLinhaDeBase {
  const cab = acharCabecalho(matriz)
  if (!cab) {
    return {
      meses: [],
      problemas: [{ linha: 1, motivo: 'Não achei o cabeçalho. A planilha precisa ter as colunas MÊS, QUANTIDADE e CUSTO.' }],
    }
  }

  const meses: MesDaLinhaDeBase[] = []
  const problemas: ProblemaNaLinha[] = []
  const vistos = new Set<string>()

  for (let i = cab.linha + 1; i < matriz.length; i++) {
    const linha = matriz[i] ?? []
    const n = i + 1
    if (linha.every((c) => c === null || c === undefined || c === '')) continue
    // Linha de fechamento não é mês.
    if (linha.some((c) => /^(TOTAIS?|TOTAL|SOMA|M[EÉ]DIA)\b/.test(normalizarTexto(c)))) continue

    const cel = (campo: string) => (cab.mapa[campo] === undefined ? null : linha[cab.mapa[campo]])
    const periodo = lerCompetencia(cel('periodo'))
    if (!periodo) {
      problemas.push({ linha: n, coluna: 'MÊS', motivo: 'Competência não reconhecida.', conteudo: String(cel('periodo') ?? '') })
      continue
    }
    // ⚠️ O mesmo mês duas vezes dobraria a quantidade e o custo — e o R$/unidade nem mudaria,
    // então passaria despercebido.
    if (vistos.has(periodo)) {
      problemas.push({ linha: n, coluna: 'MÊS', motivo: `O mês ${periodo} aparece mais de uma vez.`, conteudo: periodo })
      continue
    }

    const quantidade = lerValor(cel('quantidade'))
    const custo = lerValor(cel('custo'))
    if (quantidade === null) {
      problemas.push({ linha: n, coluna: 'QUANTIDADE', motivo: 'Quantidade não numérica.', conteudo: String(cel('quantidade') ?? '') })
      continue
    }
    if (custo === null) {
      problemas.push({ linha: n, coluna: 'CUSTO', motivo: 'Custo não numérico.', conteudo: String(cel('custo') ?? '') })
      continue
    }
    if (quantidade < 0 || custo < 0) {
      problemas.push({ linha: n, motivo: 'Quantidade ou custo negativo — a linha de base é o que foi executado e gasto.' })
      continue
    }

    const hh = lerValor(cel('homensHora'))
    vistos.add(periodo)
    meses.push({
      periodo,
      quantidadeExecutada: quantidade,
      custoBRL: custo,
      homensHora: hh !== null && hh > 0 ? hh : undefined,
    })
  }

  meses.sort((a, b) => a.periodo.localeCompare(b.periodo))
  return { meses, problemas }
}
