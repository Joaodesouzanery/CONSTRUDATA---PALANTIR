/**
 * importarPlanilha.ts — do arquivo `.xlsx` até a conferência, num lugar só.
 *
 * Junta o leitor (`leitorPlanilha`/`leitorPlanilhaZip`) com a conferência
 * (`conferenciaOperacional`) e devolve o que a tela precisa mostrar ANTES de gravar. Nada aqui
 * escreve no store: a gravação é um gesto do usuário, depois de ver a lista.
 */
import * as XLSX from 'xlsx'
import {
  lerAba, lerConfiguracoes, chaveDaColuna,
  type ValidacaoLida, type ColunaLida, type ParametroDeConfiguracao,
} from './leitorPlanilha'
import { lerValidacoes } from './leitorPlanilhaZip'
import {
  conferirAba, valorFinalDaLinha, resumir,
  type LinhaConferida, type LinhaExistente, type ResumoDaConferencia,
} from './conferenciaOperacional'
import {
  SABESP_SHEETS, idDaLinha, type SabespSheetId, type AbaNoSistema, type LinhaOperacional,
  type SabespGuide,
} from './sabespStore'

export interface PreviaDaImportacao {
  arquivo: string
  /** Abas que foram lidas, com as colunas e as regras de cada uma. */
  abas: Partial<Record<SabespSheetId, AbaNoSistema>>
  configuracoes: ParametroDeConfiguracao[]
  guias: { rapido?: SabespGuide; leiaMe?: SabespGuide }
  /** A conferência linha a linha — é o que a tela mostra. */
  conferencia: LinhaConferida[]
  resumo: ResumoDaConferencia
  /** As linhas já prontas para gravar, se o usuário confirmar. */
  paraGravar: LinhaOperacional[]
  /** Abas que o arquivo não tinha ou cujo cabeçalho não bateu. Avisa, não bloqueia. */
  naoLidas: string[]
  listas: number
  regras: number
  diagnostico: { abasReconhecidas: number; registros: number; estruturais: number; formulas: number; rejeitadas: number }
}

const textoDaAba = (ws: XLSX.WorkSheet | undefined, titulo: string): SabespGuide | undefined => {
  if (!ws) return undefined
  const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  // ⚠️ Sem `Set`: o guia tem linhas legitimamente repetidas (marcadores, separadores), e o
  // de-duplicador anterior comia parte do texto. Só tira as vazias.
  const linhas = m.map((l) => (l ?? []).map((c) => String(c ?? '').trim()).filter(Boolean).join('  ·  '))
    .filter(Boolean)
  return linhas.length ? { titulo, linhas } : undefined
}

const matrizDaAba = (ws: XLSX.WorkSheet): string[][] =>
  XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
    .map((linha) => (linha ?? []).map((c) => String(c ?? '').trim()))

const colunasBancoCustos: ColunaLida[] = ['Contrato', 'Item', 'Quantidade', 'Valor unitário', 'Total mensal', 'Fonte']
  .map((titulo, indice) => ({ titulo, indice, temTitulo: true }))

export function lerBancoCustos(matriz: string[][]): Array<Record<string, string>> {
  let contrato = ''
  const out: Array<Record<string, string>> = []
  for (const linha of matriz) {
    const titulo = linha[0]?.toUpperCase() ?? ''
    if (titulo.includes('CUSTO MENSAL') && titulo.includes('BERTIOGA')) { contrato = 'BERTIOGA'; continue }
    if (titulo.includes('CUSTO MENSAL') && titulo.includes('SANTOS')) { contrato = 'SANTOS'; continue }
    const item = linha[1]?.trim()
    if (!contrato || !item || item === 'ITEM' || item.startsWith('TOTAL MENSAL')) continue
    out.push({ Contrato: contrato, Item: item, Quantidade: linha[2] ?? '', 'Valor unitário': linha[3] ?? '', 'Total mensal': linha[4] ?? '', Fonte: linha[5] ?? '' })
  }
  return out
}

export function ehRegistroReal(aba: SabespSheetId, valores: Record<string, string>): boolean {
  const tem = (...nomes: string[]) => nomes.every((nome) => !!valorPorRotulo(valores, nome))
  if (aba === 'configuracoes' || aba === 'carteira_ticket' || aba === 'resumo' || aba === 'dashboard' || aba === 'planejado_realizado') return false
  if (aba === 'tabela_precos') return /^(BER|SAN)-\d+$/i.test(valorPorRotulo(valores, 'CHAVE'))
  if (aba === 'cadastro_servicos') return tem('ID', 'CONTRATO')
  if (aba === 'programacao') return tem('DATA', 'CONTRATO', 'ID DO SERVIÇO')
  if (aba === 'ordens_servico') return tem('ID DO SERVIÇO', 'CONTRATO', 'Nº OS SABESP')
  if (aba === 'apontamento') return tem('DATA', 'CONTRATO')
  if (aba === 'materiais') return tem('DATA', 'ID DO SERVIÇO / OS', 'MATERIAL', 'MOVIMENTO')
  if (aba === 'equipe') return tem('MATRÍCULA', 'CONTRATO')
  if (aba === 'medicao') return tem('ID DO SERVIÇO', 'CÓD. PREÇO (CHAVE)')
  if (aba === 'diario_obra') return tem('Nº DO RDO', 'CONTRATO')
  if (aba === 'ocorrencias') return tem('Nº', 'CONTRATO')
  if (aba === 'faturamento') return tem('MÊS', 'CONTRATO')
  if (aba === 'atas') return tem('Nº DA ATA', 'PENDÊNCIA / AÇÃO')
  if (aba === 'lookahead' || aba === 'plano_semanal') return tem('SEMANA (2ª FEIRA)', 'CONTRATO', 'ID DO SERVIÇO')
  return true
}

const normalizarRotulo = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

function valorPorRotulo(valores: Record<string, string>, procurado: string): string {
  const alvo = normalizarRotulo(procurado)
  for (const [k, v] of Object.entries(valores)) {
    const nk = normalizarRotulo(k)
    if (nk === alvo || nk.startsWith(alvo)) return String(v ?? '').trim()
  }
  return ''
}

/** A chave de identidade da linha: as colunas-chave da aba, na ordem, mais um contador. */
function chaveDaLinha(valores: Record<string, string>, colunasChave: readonly string[], jaVistas: Map<string, number>): string {
  const base = colunasChave.map((c) => valorPorRotulo(valores, c)).filter(Boolean).join('|')
  // ⚠️ Sem coluna-chave preenchida, a identidade cai no conteúdo inteiro da linha — e aí editar
  // qualquer campo criaria "outra" linha. Duas das 20 abas estão nesse caso (01A e 13), e por isso
  // a tela marca essas linhas como "identidade fraca" em vez de fingir que está tudo bem.
  const semiChave = base || JSON.stringify(valores)
  const n = (jaVistas.get(semiChave) ?? 0) + 1
  jaVistas.set(semiChave, n)
  return n === 1 ? semiChave : `${semiChave}#${n}`
}

export async function prepararImportacao(
  arquivo: File,
  orgId: string | null | undefined,
  existentes: readonly LinhaOperacional[],
): Promise<PreviaDaImportacao> {
  const buffer = await arquivo.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  let validacoes: ValidacaoLida[] = []
  // Só `.xlsx` carrega validação (é XML dentro do zip). `.csv`/`.ods` continuam importando os
  // dados — sem dropdown, o que é honesto: a informação não está no arquivo.
  if (/\.xlsx$/i.test(arquivo.name)) {
    try { validacoes = await lerValidacoes(buffer, wb) } catch { validacoes = [] }
  }

  const abas: Partial<Record<SabespSheetId, AbaNoSistema>> = {}
  const conferencia: LinhaConferida[] = []
  const paraGravar: LinhaOperacional[] = []
  const naoLidas: string[] = []
  let totalRegistros = 0
  let totalEstruturais = 0
  let totalFormulas = 0
  const porAbaExistente = new Map<SabespSheetId, LinhaOperacional[]>()
  for (const l of existentes) {
    const lista = porAbaExistente.get(l.aba)
    if (lista) lista.push(l); else porAbaExistente.set(l.aba, [l])
  }

  for (const def of SABESP_SHEETS) {
    const ws = wb.Sheets[def.sheetName]
    if (!ws) { naoLidas.push(`${def.label}: aba não encontrada`); continue }
    const lida = lerAba(ws, def.sheetName, def.keyColumns, validacoes)
    if (!lida) { naoLidas.push(`${def.label}: cabeçalho não reconhecido`); continue }

    const matriz = matrizDaAba(ws)
    totalFormulas += Object.keys(ws).filter((k) => !k.startsWith('!') && !!ws[k]?.f).length
    let colunas: ColunaLida[] = lida.colunas
    let linhasLidas = lida.linhas
    if (def.id === 'configuracoes' || def.id === 'carteira_ticket' || def.id === 'resumo' || def.id === 'dashboard' || def.id === 'planejado_realizado') linhasLidas = []
    if (def.id === 'banco_custos') { colunas = colunasBancoCustos; linhasLidas = lerBancoCustos(matriz) }
    const registros = linhasLidas.filter((valores) => ehRegistroReal(def.id, valores))
    totalRegistros += registros.length
    totalEstruturais += Math.max(0, lida.linhas.length - registros.length)
    abas[def.id] = {
      colunas, ordemDasChaves: [], matriz, linhaDoCabecalho: lida.linhaDoCabecalho,
      registros: registros.length, estruturais: Math.max(0, lida.linhas.length - registros.length),
    }

    const jaVistas = new Map<string, number>()
    const doArquivo = colunas.map(chaveDaColuna)
    const colunasChave = def.id === 'banco_custos' ? ['Contrato', 'Item'] : def.keyColumns
    const daPlanilha = registros.map((valores) => ({
      chave: chaveDaLinha(valores, colunasChave, jaVistas),
      valores,
    }))

    const existentesDaAba = porAbaExistente.get(def.id) ?? []
    const comoExistente: LinhaExistente[] = existentesDaAba.map((l) => ({
      chave: l.chave, valores: l.valores, origem: l.origem,
      editadoPor: l.editadoPor, editadoEm: l.editadoEm,
    }))
    const conferidas = conferirAba(def.label, daPlanilha, comoExistente, doArquivo)
    conferencia.push(...conferidas)
    abas[def.id]!.ordemDasChaves = daPlanilha.map((l) => l.chave)

    const porChave = new Map(existentesDaAba.map((l) => [l.chave, l]))
    for (const nova of daPlanilha) {
      const antiga = porChave.get(nova.chave)
      paraGravar.push({
        id: idDaLinha(orgId, def.id, nova.chave),
        aba: def.id,
        chave: nova.chave,
        valores: valorFinalDaLinha(nova.valores, antiga?.valores, doArquivo),
        // ⚠️ Volta a ser 'planilha': a planilha venceu esta linha, e a PRÓXIMA reimportação não
        // deve chamá-la de conflito de novo. O conflito é sempre sobre a edição que ainda está
        // por resolver.
        origem: 'planilha',
        editadoPor: undefined,
        editadoEm: undefined,
        ativa: true,
      })
    }
    // A linha que sumiu da planilha não é apagada: fica marcada como inativa, visível na tela.
    for (const l of existentesDaAba) {
      const aindaExiste = daPlanilha.some((x) => x.chave === l.chave)
      if (!aindaExiste && l.ativa) paraGravar.push({ ...l, ativa: false })
    }
  }

  return {
    arquivo: arquivo.name,
    abas,
    configuracoes: wb.Sheets['01. CONFIGURAÇÕES'] ? lerConfiguracoes(wb.Sheets['01. CONFIGURAÇÕES']) : [],
    guias: {
      rapido: textoDaAba(wb.Sheets['GUIA RÁPIDO'], 'Guia Rápido'),
      leiaMe: textoDaAba(wb.Sheets['00. LEIA-ME'], 'Leia-me'),
    },
    conferencia,
    resumo: resumir(conferencia),
    paraGravar,
    naoLidas,
    listas: validacoes.filter((v) => v.tipo === 'lista').length,
    regras: validacoes.filter((v) => v.tipo !== 'lista').length,
    diagnostico: {
      abasReconhecidas: Object.keys(abas).length + (wb.Sheets['GUIA RÁPIDO'] ? 1 : 0) + (wb.Sheets['00. LEIA-ME'] ? 1 : 0),
      registros: totalRegistros, estruturais: totalEstruturais, formulas: totalFormulas, rejeitadas: naoLidas.length,
    },
  }
}
