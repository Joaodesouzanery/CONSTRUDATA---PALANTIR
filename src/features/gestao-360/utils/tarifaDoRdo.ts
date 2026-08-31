/**
 * Quanto custou a equipe de um RDO — usando o que está cadastrado, e dizendo quando não está.
 *
 * ⚠️ **O que havia antes:** `custoLedger.ts` valorava a equipe a R$ 65/48/34/58 por hora conforme
 * a função, e qualquer equipamento a R$ 180/h. Nenhum desses números vinha de lugar nenhum — não
 * eram o `hourlyRate` de ninguém, não eram configuráveis, não apareciam em tela. E iam para o
 * "Custo em Tempo Real" e para o PDF da pauta da reunião **sem rótulo**, misturados com valor
 * medido de nota fiscal.
 *
 * É o mesmo defeito que o módulo Economia já corrigiu, e a correção segue a mesma regra: **usar o
 * dado real quando ele existe, e dizer que é referência quando não existe.** Um número estimado
 * pode ficar na tela; o que não pode é ele se passar por medido.
 *
 * A escada, do mais confiável ao menos:
 *
 *  1. **Nome do funcionário no RDO** → o `hourlyRate` dele. É medição.
 *  2. **Mediana do cadastro** para aquela função → derivado do dado do cliente.
 *  3. **Tarifa de referência** → o último recurso, e vai rotulado.
 */
import type { RdoManpower, Worker } from '@/types'
import { matchWorkerByName } from '@/features/mao-de-obra/utils/custoMaoObra'

/** As quatro funções que o RDO conta, e como elas aparecem no cadastro. */
export type FuncaoDoRdo = 'encarregado' | 'oficial' | 'ajudante' | 'operador'

export const ROTULO_FUNCAO: Record<FuncaoDoRdo, string> = {
  encarregado: 'Encarregado', oficial: 'Oficial', ajudante: 'Ajudante', operador: 'Operador',
}

/**
 * Tarifas de último recurso, em R$/hora.
 *
 * ⚠️ **São referência de mercado, não o custo de ninguém.** Existem para a tela não ficar vazia
 * quando não há cadastro — e todo valor que passar por aqui sai marcado como estimado. No dia em
 * que o cliente cadastrar salário, elas param de ser usadas sozinhas.
 */
export const TARIFA_REFERENCIA: Record<FuncaoDoRdo, number> = {
  encarregado: 65, oficial: 48, ajudante: 34, operador: 58,
}

/** Referência de locação por hora. Mesma ressalva. */
export const TARIFA_EQUIPAMENTO_REFERENCIA = 180

/** Como o RDO reconhece a função no cargo cadastrado. Comparação sem acento e sem caixa. */
const PISTAS: Record<FuncaoDoRdo, string[]> = {
  encarregado: ['ENCARREGADO', 'LIDER', 'MESTRE'],
  oficial:     ['OFICIAL', 'PEDREIRO', 'ENCANADOR', 'CARPINTEIRO', 'ARMADOR', 'SOLDADOR', 'ELETRICISTA'],
  ajudante:    ['AJUDANTE', 'AUXILIAR', 'SERVENTE'],
  operador:    ['OPERADOR', 'MOTORISTA'],
}

function semAcento(s: string): string {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

export function funcaoDoCargo(cargo: string): FuncaoDoRdo | null {
  const c = semAcento(cargo)
  for (const [funcao, pistas] of Object.entries(PISTAS) as Array<[FuncaoDoRdo, string[]]>) {
    if (pistas.some((p) => c.includes(p))) return funcao
  }
  return null
}

/** A mediana, e não a média: um diretor cadastrado com salário alto não puxa a tarifa do ajudante. */
function mediana(valores: number[]): number | null {
  const v = valores.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b)
  if (v.length === 0) return null
  const meio = Math.floor(v.length / 2)
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2
}

/** A tarifa horária mediana de cada função, a partir de quem está cadastrado. */
export function tarifasDoCadastro(workers: Array<Pick<Worker, 'role' | 'hourlyRate' | 'status'>>): Partial<Record<FuncaoDoRdo, number>> {
  const porFuncao = new Map<FuncaoDoRdo, number[]>()
  for (const w of workers) {
    if (w.status === 'inactive') continue
    const f = funcaoDoCargo(w.role ?? '')
    if (!f) continue
    const lista = porFuncao.get(f) ?? []
    lista.push(Number(w.hourlyRate) || 0)
    porFuncao.set(f, lista)
  }
  const saida: Partial<Record<FuncaoDoRdo, number>> = {}
  for (const [f, valores] of porFuncao) {
    const m = mediana(valores)
    if (m !== null) saida[f] = m
  }
  return saida
}

export interface CustoDaEquipe {
  valorBRL: number
  /** ⚠️ `true` quando alguma parcela veio de tarifa de referência, e não do cadastro. */
  estimado: boolean
  /** A frase que vai para a tela e para o papel, dizendo de onde veio o número. */
  base: string
}

const HORAS_DIA = 8

/**
 * O custo da equipe de um RDO.
 *
 * ⚠️ Quando o RDO traz os NOMES, eles mandam — é o único caminho que é medição de verdade. As
 * contagens por função são o recurso, porque duas pessoas do mesmo cargo podem custar diferente.
 */
export function custoDaEquipeDoRdo(
  manpower: RdoManpower,
  workers: Array<Pick<Worker, 'name' | 'role' | 'hourlyRate' | 'status'>>,
): CustoDaEquipe {
  const nomes = (manpower.employeeNames ?? []).filter((n) => n?.trim())
  const total = manpower.foremanCount + manpower.officialCount + manpower.helperCount + manpower.operatorCount

  // ── Caminho 1: os nomes ──
  if (nomes.length > 0) {
    let valor = 0
    let comCadastro = 0
    for (const nome of nomes) {
      const w = matchWorkerByName(nome, workers)
      const taxa = Number(w?.hourlyRate) || 0
      if (taxa > 0) { valor += taxa * HORAS_DIA; comCadastro++ }
    }
    if (comCadastro === nomes.length) {
      return {
        valorBRL: valor,
        estimado: false,
        base: `${nomes.length} pessoa(s) × ${HORAS_DIA}h × o valor/hora de cada uma no cadastro`,
      }
    }
    if (comCadastro > 0) {
      // Parte medida, parte não. O que falta entra pela tarifa da função, e o total sai marcado.
      const semCadastro = nomes.length - comCadastro
      const tarifas = tarifasDoCadastro(workers)
      const medianaGeral = mediana(Object.values(tarifas) as number[]) ?? TARIFA_REFERENCIA.ajudante
      return {
        valorBRL: valor + semCadastro * HORAS_DIA * medianaGeral,
        estimado: true,
        base: `${comCadastro} pessoa(s) pelo valor/hora do cadastro; ${semCadastro} sem cadastro, por referência`,
      }
    }
  }

  // ── Caminho 2 e 3: as contagens por função ──
  const doCadastro = tarifasDoCadastro(workers)
  const contagem: Array<[FuncaoDoRdo, number]> = [
    ['encarregado', manpower.foremanCount],
    ['oficial',     manpower.officialCount],
    ['ajudante',    manpower.helperCount],
    ['operador',    manpower.operatorCount],
  ]

  let valor = 0
  let pessoasComCadastro = 0
  let pessoasPorReferencia = 0
  for (const [funcao, qtd] of contagem) {
    if (qtd <= 0) continue
    const doBanco = doCadastro[funcao]
    if (doBanco && doBanco > 0) { valor += qtd * HORAS_DIA * doBanco; pessoasComCadastro += qtd }
    else { valor += qtd * HORAS_DIA * TARIFA_REFERENCIA[funcao]; pessoasPorReferencia += qtd }
  }

  if (total === 0) return { valorBRL: 0, estimado: false, base: 'Sem equipe registrada no RDO' }
  if (pessoasPorReferencia === 0) {
    return {
      valorBRL: valor,
      estimado: false,
      base: `${total} pessoa(s) × ${HORAS_DIA}h × o valor/hora mediano de cada função no cadastro`,
    }
  }
  return {
    valorBRL: valor,
    estimado: true,
    base: pessoasComCadastro > 0
      ? `${pessoasComCadastro} pelo cadastro, ${pessoasPorReferencia} por tarifa de referência (função sem ninguém cadastrado)`
      : `${total} pessoa(s) × ${HORAS_DIA}h × tarifa de REFERÊNCIA — ninguém cadastrado com valor/hora`,
  }
}

/**
 * O custo de um equipamento no RDO.
 *
 * Hoje sempre estimado: não existe cadastro de tarifa de locação no produto. Sai marcado, e é o
 * campo que mais vale a pena passar a coletar — equipamento é o segundo maior custo de uma obra.
 */
export function custoDoEquipamentoNoRdo(quantidade: number, horas: number): CustoDaEquipe {
  const valorBRL = quantidade * horas * TARIFA_EQUIPAMENTO_REFERENCIA
  return {
    valorBRL,
    estimado: valorBRL > 0,
    base: `${quantidade} un × ${horas}h × tarifa de REFERÊNCIA (não há cadastro de locação no sistema)`,
  }
}
