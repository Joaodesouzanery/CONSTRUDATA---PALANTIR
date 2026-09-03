/**
 * "O que muda se eu gravar isto?" — a conferência da nota fiscal, antes da escrita.
 *
 * Mesma forma do `controleDeCaixaImport`, de propósito: os dois importadores do
 * Financeiro têm de parecer a mesma ideia para quem usa. A tela não pergunta
 * "importar?"; ela responde o que a importação faria.
 *
 * Puro: sem React, sem rede, sem `Date.now()` implícito nas decisões. O `agora`
 * entra por parâmetro para o teste poder fixá-lo.
 */
import type { FinanceiroEntry, ItemDaNota, NotaFiscal, SaidaCategoria } from '@/types'
import { seededId } from '@/lib/seededId'
import { lerChaveNfe, type ChaveNfe } from './chaveNfe'
import type { MudancaDeCampo } from './controleDeCaixaImport'

export type SituacaoNota =
  | 'nova' | 'ja-arquivada' | 'ja-lancada' | 'valor-alterado' | 'duplicada-no-lote'

export const ROTULO_SITUACAO_NOTA: Record<SituacaoNota, string> = {
  'nova':              'Nova',
  'ja-arquivada':      'Já está no sistema',
  'ja-lancada':        'Já lançada no Financeiro',
  'valor-alterado':    'Valor alterado',
  'duplicada-no-lote': 'Repetida neste envio',
}

/** O que a pessoa preencheu na tela, antes de virar `NotaFiscal`. */
export interface RascunhoDeNota {
  chave: string
  valor: number | null
  valorOrigem?: NotaFiscal['valorOrigem']
  valorLidoBruto?: string
  emitente?: string
  dataEmissao?: string
  tributosBRL?: number
  itens?: ItemDaNota[]
  categoria?: SaidaCategoria
  etiqueta?: string
  obraId?: string
  notas?: string
  fotoPath?: string
  fotoNome?: string
}

export interface NotaConferida {
  situacao: SituacaoNota
  /** O id que esta nota terá. Determinístico, e é ele que impede a duplicata. */
  id: string
  rascunho: RascunhoDeNota
  /** O que a chave garante. Ausente só quando a chave não passou. */
  dados?: ChaveNfe
  existente?: NotaFiscal
  mudancas: MudancaDeCampo[]
  /** O que IMPEDE gravar. Vazio = pode. A tela lista isto ao lado do botão. */
  impedimentos: string[]
  avisos: string[]
}

/**
 * O id da nota.
 *
 * ⚠️ **Nunca chame isto com uma chave que não passou pelo `lerChaveNfe`.** Uma
 * chave com um dígito errado produz um id perfeitamente válido para uma nota que
 * não existe — e a partir daí o sistema tem um registro fantasma com CNPJ
 * plausível. A ordem é sempre: ler a chave → `ok: true` → só então o id.
 */
export function idDaNota(orgId: string | null | undefined, chave: string): string {
  return seededId(orgId, 'nota-fiscal', chave)
}

/** O id do lançamento gerado. Espelha `seededId(orgId,'baixa-titulo',id)`. */
export function idDoLancamentoDaNota(orgId: string | null | undefined, notaId: string): string {
  return seededId(orgId, 'nota-fiscal-lancamento', notaId)
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Acima disto, o OCR fundiu números. Abaixo, não é despesa. */
const VALOR_MINIMO = 0.01
const VALOR_MAXIMO = 1_000_000

export interface OpcoesDeConferencia {
  orgId: string | null | undefined
  /** As notas que já existem no sistema. */
  existentes: NotaFiscal[]
  /** Chaves já vistas neste mesmo envio — para pegar a foto repetida do lote. */
  jaNesteLote?: Set<string>
}

export function conferirNota(rascunho: RascunhoDeNota, opcoes: OpcoesDeConferencia): NotaConferida {
  const impedimentos: string[] = []
  const avisos: string[] = []

  const leitura = lerChaveNfe(rascunho.chave)
  if (!leitura.ok) {
    // Sem chave válida não há identidade, e sem identidade não há como impedir a
    // duplicata. Devolvemos cedo, com o id vazio: nada aqui pode gravar.
    return {
      situacao: 'nova',
      id: '',
      rascunho,
      mudancas: [],
      impedimentos: [leitura.detalhe],
      avisos: [],
    }
  }
  const dados = leitura.dados
  avisos.push(...leitura.avisos)

  const valor = rascunho.valor
  if (valor === null || !Number.isFinite(valor)) {
    impedimentos.push('Sem valor. Um arquivo de notas sem valor é uma pilha de fotos.')
  } else if (valor < VALOR_MINIMO) {
    impedimentos.push('O valor precisa ser maior que zero.')
  } else if (valor > VALOR_MAXIMO) {
    impedimentos.push(`R$ ${valor.toLocaleString('pt-BR')} é alto demais para um cupom — confira se dois números não se juntaram.`)
  }
  if (!rascunho.categoria) impedimentos.push('Escolha a categoria — é ela que leva o gasto para a DRE.')

  const id = idDaNota(opcoes.orgId, dados.chave)
  const existente = opcoes.existentes.find((n) => n.id === id || n.chaveAcesso === dados.chave)

  if (opcoes.jaNesteLote?.has(dados.chave)) {
    return { situacao: 'duplicada-no-lote', id, rascunho, dados, existente, mudancas: [], impedimentos, avisos }
  }

  if (!existente) {
    return { situacao: 'nova', id, rascunho, dados, mudancas: [], impedimentos, avisos }
  }

  /**
   * ⚠️ **Nota já lançada nunca é regravada por reimportação.**
   *
   * Ela já virou um `FinanceiroEntry` que está na DRE. Deixar a foto reimportada
   * mudar o valor por baixo de um lançamento existente seria alterar um número
   * contábil sem ninguém pedir. Corrigir é ato separado e deliberado, na tela.
   */
  if (existente.status === 'lancada') {
    return { situacao: 'ja-lancada', id, rascunho, dados, existente, mudancas: [], impedimentos, avisos }
  }

  const mudancas: MudancaDeCampo[] = []
  if (valor !== null && r2(valor) !== r2(existente.valor)) {
    mudancas.push({ campo: 'valor', rotulo: 'Valor', antes: existente.valor, depois: r2(valor) })
  }
  if (rascunho.categoria && rascunho.categoria !== existente.categoria) {
    mudancas.push({ campo: 'categoria', rotulo: 'Categoria', antes: existente.categoria, depois: rascunho.categoria })
  }

  return {
    situacao: mudancas.length ? 'valor-alterado' : 'ja-arquivada',
    id, rascunho, dados, existente, mudancas, impedimentos, avisos,
  }
}

/** As situações que de fato escrevem. `ja-arquivada` não regrava — geraria linha de auditoria vazia. */
export const SITUACOES_QUE_GRAVAM_NOTA: readonly SituacaoNota[] = ['nova', 'valor-alterado']

export function podeGravar(c: NotaConferida): boolean {
  return c.impedimentos.length === 0 && SITUACOES_QUE_GRAVAM_NOTA.includes(c.situacao)
}

export interface ConferenciaDoLote {
  notas: NotaConferida[]
  resumo: Record<SituacaoNota, number>
}

export function conferirLote(
  rascunhos: RascunhoDeNota[],
  opcoes: Omit<OpcoesDeConferencia, 'jaNesteLote'>,
): ConferenciaDoLote {
  const vistas = new Set<string>()
  const notas: NotaConferida[] = []
  const resumo: Record<SituacaoNota, number> = {
    'nova': 0, 'ja-arquivada': 0, 'ja-lancada': 0, 'valor-alterado': 0, 'duplicada-no-lote': 0,
  }
  for (const r of rascunhos) {
    const c = conferirNota(r, { ...opcoes, jaNesteLote: vistas })
    if (c.dados) vistas.add(c.dados.chave)
    notas.push(c)
    resumo[c.situacao]++
  }
  return { notas, resumo }
}

/** Converte o rascunho conferido na `NotaFiscal` que vai para o store. */
export function notaDoRascunho(c: NotaConferida, agoraISO: string): NotaFiscal {
  if (!c.dados || !c.id) throw new Error('Nota sem chave válida não vira registro.')
  const r = c.rascunho
  return {
    id: c.id,
    chaveAcesso: c.dados.chave,
    cnpjEmitente: c.dados.cnpj,
    modelo: c.dados.modelo,
    numero: String(c.dados.numero),
    serie: String(c.dados.serie),
    uf: c.dados.uf,
    competencia: c.dados.competencia,
    emitente: r.emitente?.trim() || undefined,
    dataEmissao: r.dataEmissao,
    valor: r2(r.valor ?? 0),
    valorOrigem: r.valorOrigem ?? 'manual',
    valorLidoBruto: r.valorLidoBruto,
    tributosBRL: r.tributosBRL,
    itens: r.itens?.length ? r.itens : undefined,
    categoria: r.categoria ?? 'outro',
    etiqueta: r.etiqueta?.trim() || undefined,
    // Quem passou pela tela e confirmou a categoria alimenta a sugestão. É o que
    // impede a sugestão de virar evidência de si mesma.
    categoriaConfirmadaEm: agoraISO,
    obraId: r.obraId,
    notas: r.notas?.trim() || undefined,
    fotoPath: r.fotoPath,
    fotoNome: r.fotoNome,
    status: c.existente?.status === 'cancelada' ? 'cancelada' : 'arquivada',
    entryId: c.existente?.entryId,
    lancadaEm: c.existente?.lancadaEm,
    lancadaPor: c.existente?.lancadaPor,
    createdAt: c.existente?.createdAt ?? agoraISO,
  }
}

/** O lançamento que a nota gera no Financeiro, quando alguém manda. */
export function lancamentoDaNota(
  nota: NotaFiscal,
  orgId: string | null | undefined,
  dataISO: string,
): FinanceiroEntry {
  return {
    id: idDoLancamentoDaNota(orgId, nota.id),
    tipo: 'saida',
    descricao: nota.emitente
      ? `${nota.emitente} — NF ${nota.numero}`
      : `Nota fiscal ${nota.numero}`,
    valor: nota.valor,
    data: nota.dataEmissao || dataISO,
    categoria: nota.categoria,
    referencia: nota.chaveAcesso,
    obraId: nota.obraId,
    sourceNotaId: nota.id,
    createdAt: new Date().toISOString(),
  } as FinanceiroEntry
}
