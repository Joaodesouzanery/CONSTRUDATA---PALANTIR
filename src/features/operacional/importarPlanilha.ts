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

/** A chave de identidade da linha: as colunas-chave da aba, na ordem, mais um contador. */
function chaveDaLinha(valores: Record<string, string>, colunasChave: readonly string[], jaVistas: Map<string, number>): string {
  const base = colunasChave.map((c) => (valores[c] ?? '').trim()).filter(Boolean).join('|')
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

    const colunas: ColunaLida[] = lida.colunas
    abas[def.id] = { colunas, ordemDasChaves: [] }

    const jaVistas = new Map<string, number>()
    const doArquivo = colunas.map(chaveDaColuna)
    const daPlanilha = lida.linhas.map((valores) => ({
      chave: chaveDaLinha(valores, def.keyColumns, jaVistas),
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
  }
}
