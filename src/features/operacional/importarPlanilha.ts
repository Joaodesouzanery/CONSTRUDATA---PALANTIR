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
  conferirAba, casarPorSemelhanca, valorFinalDaLinha, resumir,
  type LinhaConferida, type LinhaExistente, type ResumoDaConferencia,
} from './conferenciaOperacional'
import { COLUNAS_DE_IDENTIDADE, chaveDaLinha, valorPorRotulo } from './chaveDaLinha'
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

/**
 * A linha é um REGISTRO de negócio, ou é estrutura da planilha (título, total, legenda, nota)?
 *
 * ─── A REGRA: A COLUNA-ÂNCORA ─────────────────────────────────────────────────
 * Basta a **primeira** coluna de identidade estar preenchida. Ela é a que nomeia a linha; as
 * outras completam a identidade e podem chegar depois.
 *
 * ⚠️ Antes exigia-se **todas** as colunas juntas, e isso engolia dado. Medido no arquivo real
 * (rev15), aba por aba, a diferença entre "todas" e "a âncora" é de exatamente duas abas:
 *
 * | aba | com todas | com a âncora | o que são as linhas da diferença |
 * |---|---|---|---|
 * | Medição | 53 | **70** | 17 medições reais (boletim, mês, ID, contrato) **sem `CÓD. PREÇO` ainda** |
 * | Faturamento | 48 | 49 | a linha `TOTAL DO CONTRATO`, que tem `MÊS` vazio — a âncora a rejeita |
 *
 * Nas outras 12 abas com registro o número é **idêntico** nas duas regras. Materiais, Lookahead e
 * Plano Semanal continuam em 0 registros — o que parecia dado comido é bloco lateral
 * ("RESUMO DE SALDO POR MATERIAL", "PPC POR SEMANA") e legenda ("A = segunda-feira da semana").
 * Verificado linha a linha antes de afrouxar; a suspeita anterior estava errada.
 */
export function ehRegistroReal(aba: SabespSheetId, valores: Record<string, string>): boolean {
  // A Tabela de Preços tem regra própria porque a âncora sozinha não basta: `CHAVE` também é
  // preenchida nos blocos de legenda. O formato BER-#### / SAN-#### é o que separa preço de nota.
  if (aba === 'tabela_precos') return /^(BER|SAN)-\d+$/i.test(valorPorRotulo(valores, 'CHAVE'))
  const identidade = COLUNAS_DE_IDENTIDADE[aba]
  // Lista vazia = aba derivada (fórmula na planilha). Não produz registro, por definição.
  if (identidade.length === 0) return false
  return !!valorPorRotulo(valores, identidade[0])
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
    const lida = lerAba(ws, def.sheetName, def.colunasDoCabecalho, validacoes)
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
    // ⚠️ A identidade vem de `COLUNAS_DE_IDENTIDADE`, nunca de `def.colunasDoCabecalho` — aquela
    // lista existe só para o leitor achar a linha do cabeçalho.
    const colunasChave = COLUNAS_DE_IDENTIDADE[def.id]
    const daPlanilha = registros.map((valores) => ({
      chave: chaveDaLinha(valores, colunasChave, jaVistas),
      valores,
    }))

    const existentesDaAba = porAbaExistente.get(def.id) ?? []
    const comoExistente: LinhaExistente[] = existentesDaAba.map((l) => ({
      chave: l.chave, valores: l.valores, origem: l.origem,
      editadoPor: l.editadoPor, editadoEm: l.editadoEm,
    }))
    // Duas passadas: a chave primeiro, o conteúdo depois. É a segunda que transforma
    // "linha nova + linha sumida" em "linha atualizada" quando a identidade muda — e é ela que
    // migra sozinha o que já estava gravado com a chave antiga.
    const conferidas = casarPorSemelhanca(
      conferirAba(def.label, daPlanilha, comoExistente, doArquivo),
      daPlanilha, comoExistente, doArquivo,
    )
    conferencia.push(...conferidas)
    abas[def.id]!.ordemDasChaves = daPlanilha.map((l) => l.chave)

    const porChave = new Map(existentesDaAba.map((l) => [l.chave, l]))
    const conferidaPorChave = new Map(conferidas.filter((l) => l.situacao !== 'ausente').map((l) => [l.chave, l]))
    /** As chaves antigas que a segunda passada reconheceu — não sumiram, mudaram de nome. */
    const reconhecidas = new Set(conferidas.map((l) => l.chaveAnterior).filter(Boolean) as string[])

    for (const nova of daPlanilha) {
      const conferida = conferidaPorChave.get(nova.chave)
      // Pela chave; e, quando a identidade mudou, pela linha que a segunda passada reconheceu.
      const antiga = porChave.get(nova.chave)
        ?? (conferida?.chaveAnterior ? porChave.get(conferida.chaveAnterior) : undefined)
      // ⚠️ Reaproveitar o `id` da linha reconhecida é o que faz a gravação SUBSTITUIR em vez de
      // criar uma paralela: `gravarLinhas` casa por id. Com um id novo, a linha antiga continuaria
      // viva ao lado da nova, com o mesmo conteúdo e outra chave.
      const id = antiga?.id ?? idDaLinha(orgId, def.id, nova.chave)
      // A planilha não mudou nada nesta linha — então ela não venceu nada, e não há por que apagar
      // o carimbo de quem editou no sistema. Zerar aqui era o motivo de "suas edições" aparecer
      // uma vez só: a reimportação seguinte já não sabia que a linha tinha sido editada.
      const inalterada = conferida?.situacao === 'inalterada'
      paraGravar.push({
        id,
        aba: def.id,
        chave: nova.chave,
        valores: valorFinalDaLinha(nova.valores, antiga?.valores, doArquivo),
        // Fora do caso inalterado, volta a ser 'planilha': a planilha venceu esta linha, e a
        // PRÓXIMA reimportação não deve chamá-la de conflito de novo. O conflito é sempre sobre a
        // edição que ainda está por resolver.
        origem: inalterada ? (antiga?.origem ?? 'planilha') : 'planilha',
        editadoPor: inalterada ? antiga?.editadoPor : undefined,
        editadoEm: inalterada ? antiga?.editadoEm : undefined,
        ativa: true,
      })
    }
    // A linha que sumiu da planilha não é apagada: fica marcada como inativa, visível na tela.
    const chavesDaPlanilha = new Set(daPlanilha.map((l) => l.chave))
    for (const l of existentesDaAba) {
      if (chavesDaPlanilha.has(l.chave) || reconhecidas.has(l.chave)) continue
      if (l.ativa) paraGravar.push({ ...l, ativa: false })
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
