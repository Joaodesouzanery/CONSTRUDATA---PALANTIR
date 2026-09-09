/**
 * A medição fechada vira Entrada no Financeiro.
 *
 * ─── AS TRÊS REGRAS ───────────────────────────────────────────────────────────
 * **1. É BOTÃO, nunca automático.** É a mesma regra da Nota Fiscal ("lançar no Financeiro é
 * botão"), e pelo mesmo motivo do `wcrParaFcp`: número que muda sozinho entre uma reunião e outra
 * é número em que ninguém confia. Aqui há um motivo a mais — a medição vira nota, e nota é
 * documento fiscal.
 *
 * **2. Medição com pendência NÃO gera.** Item de preço a conferir não entra no total; deixar
 * gerar a Entrada assim faturaria sobre preço que o próprio documento manda conferir. A porta é
 * `podeGerar`, e ela devolve o MOTIVO — a tela precisa dizer por que o botão está apagado.
 *
 * **3. O id é determinístico.** `seededId(org, 'medicao-entrada', contrato, obra, competência)`:
 * gerar duas vezes a mesma medição ATUALIZA a Entrada em vez de criar outra. `addEntry` é upsert
 * por id — o mesmo mecanismo que a ponte RDO→Financeiro usa.
 */
import type { FinanceiroEntry } from '@/types'
import { seededId } from '@/lib/seededId'
import { normalizarTexto } from '../controleDeCaixaPlanilha'
import type { ResultadoDaMedicao } from './motorDaMedicao'

/** O id da Entrada desta medição. Estável por (contrato, obra, competência). */
export function idDaEntradaDaMedicao(
  orgId: string | null | undefined,
  numeroContrato: string,
  obra: string,
  competencia: string,
): string {
  return seededId(orgId, 'medicao-entrada', normalizarTexto(numeroContrato), normalizarTexto(obra), competencia)
}

export interface PodeGerar { pode: boolean; motivo?: string }

/** Pode virar Entrada? Devolve o motivo quando não — a tela mostra isso, não um botão mudo. */
export function podeGerarEntrada(r: ResultadoDaMedicao | undefined, obraId: string | undefined, competencia: string): PodeGerar {
  if (!r) return { pode: false, motivo: 'Escolha a região da obra para eu poder valorar a medição.' }
  if (!obraId) return { pode: false, motivo: 'Escolha a obra cadastrada que recebe este lançamento.' }
  if (!/^\d{4}-\d{2}$/.test(competencia)) return { pode: false, motivo: 'Informe a competência (mês/ano) da medição.' }
  if (r.pendentes.length > 0) {
    return {
      pode: false,
      motivo: `${r.pendentes.length} item(ns) com preço a conferir. Resolva antes — faturar sobre preço que o próprio documento manda conferir é o erro que esta tela existe para impedir.`,
    }
  }
  if (r.total <= 0) return { pode: false, motivo: 'Não há valor medido nesta obra.' }
  return { pode: true }
}

export interface DadosDaEntrada {
  orgId: string | null | undefined
  numeroContrato: string
  obraId: string
  competencia: string
  /** `yyyy-MM-dd` — a data do lançamento. */
  data: string
}

/** A Entrada, montada. Não grava: quem grava é a tela, com `addEntry`. */
export function entradaDaMedicao(r: ResultadoDaMedicao, d: DadosDaEntrada): FinanceiroEntry {
  const id = idDaEntradaDaMedicao(d.orgId, d.numeroContrato, r.obra, d.competencia)
  const mes = d.competencia.slice(5, 7)
  const ano = d.competencia.slice(0, 4)
  return {
    id,
    tipo: 'entrada',
    categoria: 'medicao',
    descricao: `Medição ${mes}/${ano} — ${r.obra}`,
    valor: r.total,
    data: d.data,
    obraId: d.obraId,
    referencia: `Contrato ${d.numeroContrato}`,
    // ⚠️ O que distingue esta Entrada de uma digitada: dá para voltar dela ao item de contrato.
    sourceMedicaoId: id,
    notas: `Calculado item a item: ${r.linhas.length} serviço(s) do contrato, região ${r.regiao}.`,
    createdAt: new Date().toISOString(),
  }
}
