/**
 * A conferência: o que muda no sistema se esta planilha for importada.
 *
 * ⚠️ **Nada grava antes de a pessoa confirmar.** Este arquivo só compara e classifica; quem grava
 * é o painel, depois do "confirmar".
 *
 * O gesto que o cliente vai repetir é **reimportar o mesmo arquivo, cada vez mais cheio**. Por
 * isso a pergunta que este motor responde não é "quais linhas existem", e sim "quais linhas são
 * NOVAS em relação ao que já está no sistema" — e a resposta tem de ser estável: importar duas
 * vezes seguidas o mesmo arquivo precisa dar "nada mudou" na segunda.
 */
import { seededId } from '@/lib/seededId'
import type { FinanceiroEntry, EntradaCategoria, SaidaCategoria } from '@/types'
import type { HoraExtraLida, LinhaLida, ProblemaNaLinha } from './controleDeCaixaPlanilha'
import { normalizarTexto } from './controleDeCaixaPlanilha'

export type Situacao = 'novo' | 'valor-alterado' | 'cadastro-alterado' | 'inalterado' | 'duplicado'

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  'novo':              'Novo',
  'valor-alterado':    'Valor alterado',
  'cadastro-alterado': 'Cadastro alterado',
  'inalterado':        'Inalterado',
  'duplicado':         'Duplicado no arquivo',
}

export interface MudancaDeCampo {
  campo: string
  rotulo: string
  antes: unknown
  depois: unknown
}

export interface LinhaConferida {
  situacao: Situacao
  /** O id que este lançamento terá — determinístico, e é o que impede a duplicata. */
  id: string
  lida: LinhaLida
  /** O lançamento que já existe no sistema, quando existe. */
  existente?: FinanceiroEntry
  mudancas: MudancaDeCampo[]
}

export interface AusenteDaPlanilha {
  entry: FinanceiroEntry
  /** Por que estamos apontando — e por que NÃO vamos apagar. */
  observacao: string
}

export interface Conferencia {
  linhas: LinhaConferida[]
  /** Está no sistema, não veio no arquivo. ⚠️ NUNCA é apagado — só apontado. */
  ausentes: AusenteDaPlanilha[]
  problemas: ProblemaNaLinha[]
  resumo: Record<Situacao, number>
  /** Período que o arquivo cobre. É ele que limita o escopo dos "ausentes". */
  periodo: { de: string; ate: string } | null
  /** A soma do sistema contra a que a planilha declara no rodapé. */
  divergenciaDeTotais: Array<{ oQue: string; calculado: number; declarado: number }>
  /**
   * A conferência COMPLETA dos totais — inclusive quando ela fecha.
   *
   * ⚠️ `divergenciaDeTotais` só existe quando algo está errado, e por isso a tela nunca teve como
   * dizer "deu certo". Foi essa ausência que fez o cliente concluir que a importação tinha
   * descartado R$ 112.050,00 quando ela estava correta ao centavo. Aqui vem sempre — bata ou não.
   */
  totaisConferidos: Array<{
    oQue: string
    linhas: number
    calculado: number
    /** `null` quando a planilha não traz linha de total para conferir contra. */
    declarado: number | null
    bate: boolean
  }>
  /**
   * O que a pessoa precisa saber e que não é erro de linha.
   *
   * Hoje: texto na coluna OBRA que não casa com obra cadastrada. Não bloqueia a importação e não
   * vira palpite — o lançamento entra sem obra, e a frase diz qual texto e quantas linhas.
   */
  avisos: string[]
}

/**
 * O id de um lançamento vindo de planilha.
 *
 * Determinístico a partir da chave de conteúdo, porque `addEntry` é UPSERT por id
 * (`financeiroStore.ts:130`): mesmo id → o lançamento é substituído, não duplicado. É esta linha
 * que faz a reimportação ser segura.
 */
export function idDoLancamento(orgId: string | null | undefined, chave: string): string {
  return seededId(orgId, 'caixa-planilha', chave)
}

const CAMPOS_DE_CADASTRO: Array<[keyof FinanceiroEntry, string]> = [
  ['descricao', 'Descrição'],
  ['data', 'Data'],
  ['dataFim', 'Fim do período'],
  ['categoria', 'Categoria'],
  ['classificacao', 'Classificação'],
  ['obraId', 'Obra'],
  ['conferido', 'Conferido'],
  ['fornecedor', 'Fornecedor'],
]

/**
 * Qual coluna da planilha alimenta cada campo de cadastro.
 *
 * ⚠️ **Este mapa conserta um defeito que estava apagando dado em produção.** A comparação abaixo
 * confrontava `existente[campo]` com `novo[campo]` sem perguntar se o arquivo trazia aquela coluna.
 * Como o arquivo do cliente **não tem** OBRA nem CONFERIDO, toda reimportação gerava a mudança
 * `{ obraId: <a que havia> → undefined }` e gravava — porque `cadastro-alterado` está em
 * `SITUACOES_QUE_GRAVAM`. Medido: com a barra em "Todas as obras" (o padrão do `ObraSwitcher`), a
 * obra era **apagada** de todos os lançamentos, e junto com ela o `conferido` marcado à mão na
 * sub-aba Conferência.
 *
 * Os campos de fora deste mapa (descrição, data) vêm de colunas obrigatórias — sem elas o
 * cabeçalho nem é reconhecido, então não há o que preservar.
 */
const COLUNA_DO_CAMPO: Partial<Record<keyof FinanceiroEntry, string>> = {
  categoria:  'categoria',
  // ⚠️ Mesma coluna, e por isso mesmo precisa estar aqui: planilha SEM a coluna CLASSIFICAÇÃO não
  // pode apagar a palavra já gravada. É letra por letra o defeito que apagou `obraId` em produção.
  classificacao: 'categoria',
  obraId:     'obra',
  conferido:  'conferido',
  fornecedor: 'fornecedor',
}

/**
 * Os campos que este arquivo **não informou** — e que portanto têm de ser preservados como estão.
 *
 * Sem `colunas` (chamada antiga), devolve vazio: o comportamento é o de antes, e nenhum chamador
 * quebra por não ter sido atualizado.
 */
export function camposNaoInformados(colunas?: readonly string[]): Set<keyof FinanceiroEntry> {
  const fora = new Set<keyof FinanceiroEntry>()
  if (!colunas) return fora
  const tem = new Set(colunas)
  for (const [campo, coluna] of Object.entries(COLUNA_DO_CAMPO)) {
    if (!tem.has(coluna)) fora.add(campo as keyof FinanceiroEntry)
  }
  return fora
}

/** O mínimo que este módulo precisa saber de uma obra. Evita depender do tipo inteiro. */
export interface ObraParaCasar {
  id: string
  name: string
  code?: string
  /** Ausente = ativa, como manda `obraEstaAtiva`. */
  ativa?: boolean
}

/**
 * O texto da coluna OBRA vira a obra do cadastro — ou não vira nada.
 *
 * ⚠️ **Casamento exato, nunca aproximado.** A tentação de casar "parecido" é grande e o preço é
 * dinheiro na obra errada: no arquivo deste cliente a palavra "SANTOS" aparece três vezes na
 * coluna DESCRIÇÃO e **nenhuma** delas é a cidade. Aqui só casa `name` ou `code` idênticos depois
 * de normalizar; qualquer outra coisa devolve `undefined` e a tela avisa.
 *
 * A obra ativa tem precedência sobre a arquivada com o mesmo nome — mas a arquivada casa, porque
 * lançamento antigo de obra encerrada continua sendo daquela obra.
 */
export function acharObra(texto: string | undefined, obras: readonly ObraParaCasar[]): string | undefined {
  const alvo = normalizarTexto(texto ?? '')
  if (!alvo) return undefined
  const casa = (o: ObraParaCasar) =>
    normalizarTexto(o.name) === alvo || (o.code ? normalizarTexto(o.code) === alvo : false)
  return (obras.find((o) => o.ativa !== false && casa(o)) ?? obras.find(casa))?.id
}

/** Categoria padrão de quem chega sem classificação — e ela diz "não classificado", não chuta. */
export const CATEGORIA_PADRAO: { entrada: EntradaCategoria; saida: SaidaCategoria } = {
  entrada: 'outro',
  saida: 'outro',
}

const CATEGORIAS_VALIDAS = new Set<string>([
  'medicao', 'adiantamento', 'reajuste', 'outro',
  'materiais', 'mao_de_obra', 'equipamentos', 'subempreiteiros', 'administrativo',
])

const ROTULO_CATEGORIA: Record<string, string> = {
  medicao: 'Medição', adiantamento: 'Adiantamento', reajuste: 'Reajuste',
  materiais: 'Materiais', mao_de_obra: 'Mão de obra', equipamentos: 'Equipamentos',
  subempreiteiros: 'Subempreiteiros', administrativo: 'Administrativo', outro: 'Outro',
}

/** O nome do enum em português — é o que o modelo escreve na coluna CLASSIFICAÇÃO. */
export function rotuloDaCategoria(c: string | undefined): string {
  return c ? ROTULO_CATEGORIA[c] ?? c : ''
}

/** Aceita a categoria escrita na planilha em várias grafias; o que não reconhece vira "outro". */
export function lerCategoria(bruta: string | undefined, tipo: 'entrada' | 'saida'): EntradaCategoria | SaidaCategoria {
  if (!bruta) return tipo === 'entrada' ? CATEGORIA_PADRAO.entrada : CATEGORIA_PADRAO.saida
  const n = normalizarTexto(bruta).replace(/[\s-]+/g, '_').toLowerCase()
  const apelidos: Record<string, string> = {
    medicao: 'medicao', medicoes: 'medicao',
    adiantamento: 'adiantamento', reajuste: 'reajuste',
    material: 'materiais', materiais: 'materiais',
    mao_de_obra: 'mao_de_obra', maodeobra: 'mao_de_obra', pessoal: 'mao_de_obra',
    equipamento: 'equipamentos', equipamentos: 'equipamentos',
    subempreiteiro: 'subempreiteiros', subempreiteiros: 'subempreiteiros',
    administrativo: 'administrativo', administracao: 'administrativo',
    outro: 'outro', outros: 'outro',
    // ── As palavras do arquivo real do cliente ──
    // ⚠️ Medido: sem estas 12 linhas, 194 das 219 despesas caíam em `outro`. Com elas, 29.
    // O que NÃO tem correspondente honesto entre as 6 categorias continua em `outro` de
    // propósito — e a palavra original fica guardada em `classificacao`.
    folha_pagamento: 'mao_de_obra', folha_de_pagamento: 'mao_de_obra',
    transporte_equipe: 'mao_de_obra', alimentacao: 'mao_de_obra',
    material_obras: 'materiais', material_obra: 'materiais', mat_obras: 'materiais',
    frota: 'equipamentos', combustivel: 'equipamentos', locacao: 'equipamentos',
    mat_escritorio: 'administrativo', material_escritorio: 'administrativo',
  }
  const alvo = apelidos[n] ?? n
  if (!CATEGORIAS_VALIDAS.has(alvo)) return tipo === 'entrada' ? CATEGORIA_PADRAO.entrada : CATEGORIA_PADRAO.saida
  return alvo as EntradaCategoria | SaidaCategoria
}

/** O que a conversão precisa saber além da linha. */
export interface OpcoesDoLancamento {
  /**
   * A obra de quem **não veio identificada na planilha**.
   *
   * ⚠️ É *fallback declarado*, não carimbo. Antes este valor era aplicado a TODAS as linhas, o que
   * fazia os 147 lançamentos herdarem a obra que por acaso estava selecionada na barra lateral no
   * momento do clique — e nenhuma obra, quando a barra estava em "Todas as obras". A obra de
   * verdade vem da coluna OBRA; esta só preenche o silêncio.
   */
  obraId?: string
  agora: string
  conferidoPor?: string
  /** Para resolver a coluna OBRA. Passada por parâmetro: util puro não lê store. */
  obras?: readonly ObraParaCasar[]
}

/** Converte a linha lida no lançamento que será gravado. */
export function lancamentoDaLinha(
  l: LinhaLida,
  orgId: string | null | undefined,
  opcoes: OpcoesDoLancamento,
): FinanceiroEntry {
  return {
    id: l.idExterno || idDoLancamento(orgId, l.chave),
    tipo: l.tipo === 'receita' ? 'entrada' : 'saida',
    descricao: l.descricao,
    valor: l.valor,
    data: l.data,
    dataFim: l.dataFim,
    categoria: lerCategoria(l.categoria, l.tipo === 'receita' ? 'entrada' : 'saida'),
    // A palavra do cliente, crua. ⚠️ Nunca derivada de `categoria`: o caminho é só de ida, e
    // reconstruir a partir do enum devolveria "Outro" para 194 linhas.
    classificacao: l.categoria?.trim() || undefined,
    obraId: acharObra(l.obra, opcoes.obras ?? []) ?? opcoes.obraId,
    fornecedor: l.fornecedor,
    solicitantes: l.solicitantes.length > 0 ? l.solicitantes : undefined,
    conferido: l.conferido || undefined,
    // ⚠️ Quem e quando, junto do "sim". Os campos existiam e só a sub-aba Conferência os
    // preenchia; vindo da planilha, o lançamento ficava marcado como conferido sem nenhum rastro
    // de quem conferiu — que é o mesmo que não estar conferido, com a aparência de estar.
    conferidoPor: l.conferido ? (opcoes.conferidoPor || undefined) : undefined,
    conferidoEm: l.conferido ? opcoes.agora : undefined,
    origem: 'planilha',
    chavePlanilha: l.chave,
    createdAt: opcoes.agora,
  }
}

function comparavel(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') return v.toFixed(2)
  if (Array.isArray(v)) return v.map((x) => normalizarTexto(x)).sort().join('+')
  if (typeof v === 'string') return normalizarTexto(v)
  return String(v)
}

/**
 * Compara o que veio na planilha com o que já está no sistema.
 *
 * `existentes` deve ser a lista COMPLETA de lançamentos do Financeiro — o filtro por origem e por
 * período é feito aqui dentro, onde as regras estão escritas.
 */
export function conferir(
  lidas: LinhaLida[],
  existentes: FinanceiroEntry[],
  problemas: ProblemaNaLinha[],
  orgId: string | null | undefined,
  opcoes: {
    obraId?: string
    agora: string
    totaisDeclarados?: { receitas?: number; despesas?: number } | null
    obras?: readonly ObraParaCasar[]
    /** As colunas que o arquivo trouxe — ver `camposNaoInformados`. */
    colunas?: readonly string[]
  },
): Conferencia {
  const porId = new Map(existentes.map((e) => [e.id, e]))
  const porChave = new Map(existentes.filter((e) => e.chavePlanilha).map((e) => [e.chavePlanilha!, e]))

  const linhas: LinhaConferida[] = []
  const vistos = new Set<string>()
  const naoInformados = camposNaoInformados(opcoes.colunas)
  /** Texto da coluna OBRA que não casou → quantas linhas. Vira aviso no fim. */
  const obrasNaoCasadas = new Map<string, number>()

  for (const l of lidas) {
    const novo = lancamentoDaLinha(l, orgId, opcoes)

    // ⚠️ Duplicado é o mesmo ID duas vezes NO ARQUIVO — acontece quando alguém copia uma linha da
    // planilha que o sistema gerou (o ID vem junto). Duas linhas iguais SEM id não são duplicata:
    // o leitor já as separou por ordem de aparição, porque na planilha real elas são dois gastos.
    if (vistos.has(novo.id)) {
      linhas.push({ situacao: 'duplicado', id: novo.id, lida: l, mudancas: [] })
      continue
    }
    vistos.add(novo.id)

    // A coluna trouxe um texto e ele não virou obra nenhuma. Não é erro de linha — é aviso.
    if (l.obra && !acharObra(l.obra, opcoes.obras ?? [])) {
      obrasNaoCasadas.set(l.obra, (obrasNaoCasadas.get(l.obra) ?? 0) + 1)
    }

    const existente = porId.get(novo.id) ?? (l.idExterno ? undefined : porChave.get(l.chave))
    if (!existente) {
      linhas.push({ situacao: 'novo', id: novo.id, lida: l, mudancas: [] })
      continue
    }

    const mudancas: MudancaDeCampo[] = []
    if (comparavel(existente.valor) !== comparavel(novo.valor)) {
      mudancas.push({ campo: 'valor', rotulo: 'Valor', antes: existente.valor, depois: novo.valor })
    }
    for (const [campo, rotulo] of CAMPOS_DE_CADASTRO) {
      // A planilha não trouxe a coluna: não há mudança a propor, e o valor atual fica de pé.
      if (naoInformados.has(campo)) continue
      // ⚠️ A ida-e-volta do modelo: um lançamento digitado na tela não tem `classificacao`, e o
      // modelo exporta o RÓTULO do enum na coluna. Comparar direto (`undefined` × `'Medição'`)
      // marcaria as 219 linhas como alteradas sem nada ter mudado.
      const antes = campo === 'classificacao' && existente.classificacao === undefined
        ? rotuloDaCategoria(existente.categoria)
        : existente[campo]
      if (comparavel(antes) !== comparavel(novo[campo])) {
        mudancas.push({ campo, rotulo, antes, depois: novo[campo] })
      }
    }
    if (comparavel(existente.solicitantes) !== comparavel(novo.solicitantes)) {
      mudancas.push({ campo: 'solicitantes', rotulo: 'Solicitante', antes: existente.solicitantes, depois: novo.solicitantes })
    }

    const situacao: Situacao = mudancas.length === 0
      ? 'inalterado'
      : mudancas.some((m) => m.campo === 'valor') ? 'valor-alterado' : 'cadastro-alterado'
    linhas.push({ situacao, id: novo.id, lida: l, existente, mudancas })
  }

  // ── O que sumiu da planilha ──
  // ⚠️ Escopo LIMITADO ao período do arquivo. Sem isso, importar a planilha de julho listaria
  // todo agosto como "sumiu" — e a tela pediria para conferir 200 linhas que estão certas.
  const datas = lidas.map((l) => l.data).sort()
  const periodo = datas.length > 0 ? { de: datas[0], ate: datas[datas.length - 1] } : null

  const ausentes: AusenteDaPlanilha[] = []
  if (periodo) {
    for (const e of existentes) {
      if (e.origem !== 'planilha') continue          // digitado na tela não se espera na planilha
      if (e.data < periodo.de || e.data > periodo.ate) continue
      if (vistos.has(e.id)) continue
      ausentes.push({
        entry: e,
        // A frase é a política, e ela é deliberada: apagar aqui destruiria um lançamento que pode
        // já ter sido conciliado. Quem apaga é a pessoa, uma a uma, na tela.
        observacao: 'Está no sistema e não veio neste arquivo. Não foi apagado — confira se a linha foi removida de propósito.',
      })
    }
  }

  // ── Confere a soma contra o rodapé da própria planilha ──
  const divergenciaDeTotais: Conferencia['divergenciaDeTotais'] = []
  const totaisConferidos: Conferencia['totaisConferidos'] = []
  const t = opcoes.totaisDeclarados
  for (const [oQue, tipo, declaradoBruto] of [
    ['Receitas', 'receita', t?.receitas],
    ['Despesas', 'despesa', t?.despesas],
  ] as const) {
    const doTipo = lidas.filter((l) => l.tipo === tipo)
    const calculado = doTipo.reduce((a, l) => a + l.valor, 0)
    const declarado = declaradoBruto === undefined ? null : declaradoBruto
    const bate = declarado !== null && Math.abs(calculado - declarado) <= 0.01
    totaisConferidos.push({ oQue, linhas: doTipo.length, calculado, declarado, bate })
    if (declarado !== null && !bate) divergenciaDeTotais.push({ oQue, calculado, declarado })
  }

  const resumo: Record<Situacao, number> = {
    'novo': 0, 'valor-alterado': 0, 'cadastro-alterado': 0, 'inalterado': 0, 'duplicado': 0,
  }
  for (const l of linhas) resumo[l.situacao]++

  const avisos: string[] = []
  // ⚠️ Espelha o aviso da coluna OBRA: a classificação que não tem correspondente entre as 6
  // categorias da DRE cai em "Outro" LÁ, e isso precisa ser dito — antes, era silêncio puro.
  const semCorrespondente = new Map<string, number>()
  for (const l of lidas) {
    const palavra = l.categoria?.trim()
    if (!palavra || l.tipo !== 'despesa') continue
    if (lerCategoria(palavra, 'saida') !== 'outro') continue
    if (normalizarTexto(palavra).startsWith('OUTRO')) continue   // "OUTROS" cai em outro, e está certo
    semCorrespondente.set(palavra, (semCorrespondente.get(palavra) ?? 0) + 1)
  }
  for (const [palavra, quantas] of semCorrespondente) {
    avisos.push(
      `"${palavra}" aparece em ${quantas} ${quantas === 1 ? 'linha' : 'linhas'} e não tem `
      + 'correspondente nas 6 categorias da DRE — lá entram como Outro. Nos relatórios do '
      + 'Controle de Caixa continuam aparecendo como ' + `"${palavra}".`,
    )
  }

  // ⚠️ O segundo susto do mesmo cliente, evitado: a primeira reimportação marca muita linha como
  // alterada só para guardar a classificação. NENHUM valor muda, e a tela tem de dizer isso.
  const soPelaPalavra = linhas.filter((l) =>
    l.situacao === 'cadastro-alterado'
    && l.mudancas.every((m) => m.campo === 'classificacao' || m.campo === 'categoria'),
  ).length
  if (soPelaPalavra > 0) {
    avisos.push(
      `${soPelaPalavra} lançamento(s) aparecem como "cadastro alterado" apenas porque o sistema `
      + 'passou a guardar a classificação escrita na planilha. **Nenhum valor muda** — é só a '
      + 'palavra entrando no lugar de "Outro".',
    )
  }

  for (const [texto, quantas] of obrasNaoCasadas) {
    avisos.push(
      `A coluna OBRA diz "${texto}" em ${quantas} ${quantas === 1 ? 'linha' : 'linhas'}, e não existe `
      + 'obra cadastrada com esse nome nem com esse código. Estas linhas entram sem obra — '
      + 'cadastre a obra ou corrija o texto na planilha e importe de novo.',
    )
  }

  return { linhas, ausentes, problemas, resumo, periodo, divergenciaDeTotais, totaisConferidos, avisos }
}

/**
 * As situações que de fato viram gravação.
 *
 * `inalterado` fica de fora porque reescrever o que não mudou geraria uma linha de auditoria vazia
 * a cada importação; `duplicado` fica de fora porque a segunda cópia sobrescreveria a primeira com
 * o mesmo conteúdo — e a pessoa precisa decidir o que fazer com ela, não o sistema.
 */
export const SITUACOES_QUE_GRAVAM: readonly Situacao[] = ['novo', 'valor-alterado', 'cadastro-alterado']

export function linhasAGravar(c: Conferencia): LinhaConferida[] {
  const grava = new Set<Situacao>(SITUACOES_QUE_GRAVAM)
  return c.linhas.filter((l) => grava.has(l.situacao))
}

/**
 * O lançamento como ele vai para o banco — **preservando o que a planilha não disse**.
 *
 * ⚠️ Esta função é a outra metade do conserto. Pular a COMPARAÇÃO de um campo ausente evita
 * mostrar uma mudança falsa na tela, mas não evita nada na gravação: `addEntry` é upsert do objeto
 * inteiro (`financeiroStore.ts:130`), então um `obraId: undefined` construído a partir de uma
 * planilha sem coluna OBRA **sobrescreveria** a obra que já estava lá. É preciso copiar de volta,
 * do que existe, todo campo que o arquivo não informou.
 *
 * Para lançamento novo não há de onde copiar, e aí o fallback declarado (`opcoes.obraId`) é
 * legítimo: é a única obra que alguém afirmou.
 */
export function lancamentoParaGravar(
  linha: LinhaConferida,
  orgId: string | null | undefined,
  opcoes: OpcoesDoLancamento & { colunas?: readonly string[] },
): FinanceiroEntry {
  const novo = lancamentoDaLinha(linha.lida, orgId, opcoes)
  const existente = linha.existente
  if (!existente) return novo

  const preservar = camposNaoInformados(opcoes.colunas)
  if (preservar.size === 0) return novo

  const saida: FinanceiroEntry = { ...novo }
  for (const campo of preservar) {
    // O `as` é inevitável num laço sobre chaves heterogêneas; `preservar` só contém chaves de
    // `COLUNA_DO_CAMPO`, que são campos reais de `FinanceiroEntry`.
    ;(saida as unknown as Record<string, unknown>)[campo] = existente[campo]
  }
  // `conferidoPor`/`conferidoEm` andam junto com `conferido` — restaurar um sem os outros deixaria
  // um "conferido por ninguém", que é o estado que o comentário de `lancamentoDaLinha` já recusa.
  if (preservar.has('conferido')) {
    saida.conferidoPor = existente.conferidoPor
    saida.conferidoEm = existente.conferidoEm
  }
  return saida
}

// ─── Horas extras ─────────────────────────────────────────────────────────────

/**
 * A hora extra vira despesa no Financeiro — mas **só quando marcada como paga**.
 *
 * Enquanto está só lançada na grade, é previsão: a empresa ainda não desembolsou. Jogar tudo no
 * caixa faria a despesa aparecer antes de existir, e o saldo do mês ficaria pior do que é.
 */
export function idDaHoraExtra(orgId: string | null | undefined, chave: string): string {
  return seededId(orgId, 'caixa-hora-extra', chave)
}

/**
 * A chave natural de uma hora extra: **a mesma pessoa, no mesmo dia trabalhado.**
 *
 * ⚠️ É o que impede o caixa de pagar duas vezes. Existem dois caminhos até a mesma despesa —
 * importar a planilha com o "PG" marcado, e clicar "Pago" na grade de Mão de Obra — e eles derivam
 * o `id` de jeitos diferentes (`nome|data|valor#n` aqui; o id do registro `HoraExtra` lá). Ids
 * diferentes para o mesmo pagamento = duas linhas de despesa, sem erro nenhum na tela.
 *
 * ⚠️ O valor NÃO entra na chave: corrigir R$ 300 para R$ 250 é a mesma hora extra, não outra.
 * E o dia é sempre o TRABALHADO, nunca o do pagamento — ver o docblock de `chaveHoraExtra`.
 */
export function chaveNaturalDaHoraExtra(nome: string, dataTrabalhada: string): string {
  return `${normalizarTexto(nome)}|${dataTrabalhada.slice(0, 10)}`
}

/**
 * A despesa que já existe para esta hora extra, tenha vindo da planilha ou da tela.
 *
 * Casa por `chaveHoraExtra`. Para os lançamentos ANTERIORES a este campo (só os da planilha
 * existiam), reconstrói a chave a partir de `funcionarioNome` + `data` — o que é correto ali,
 * porque a planilha grava o dia trabalhado em `data`.
 */
export function despesaDaHoraExtra(
  entries: readonly FinanceiroEntry[],
  nome: string,
  dataTrabalhada: string,
): FinanceiroEntry | undefined {
  const alvo = chaveNaturalDaHoraExtra(nome, dataTrabalhada)
  return entries.find((e) => {
    if (e.origem !== 'horas-extras') return false
    const dela = e.chaveHoraExtra ?? chaveNaturalDaHoraExtra(e.funcionarioNome ?? '', e.data)
    return dela === alvo
  })
}

export function lancamentoDaHoraExtra(
  r: HoraExtraLida,
  orgId: string | null | undefined,
  opcoes: { obraId?: string; agora: string },
): FinanceiroEntry {
  return {
    id: idDaHoraExtra(orgId, r.chave),
    tipo: 'saida',
    descricao: `Hora extra — ${r.nome}`,
    valor: r.valor,
    data: r.data,
    categoria: 'mao_de_obra',
    subcategoria: 'horas_extras',
    obraId: opcoes.obraId,
    origem: 'horas-extras',
    chavePlanilha: r.chave,
    chaveHoraExtra: chaveNaturalDaHoraExtra(r.nome, r.data),
    funcionarioNome: r.nome,
    cargo: r.cargo,
    conferido: true,
    createdAt: opcoes.agora,
  }
}

export function horasExtrasQueViramDespesa(registros: HoraExtraLida[]): HoraExtraLida[] {
  return registros.filter((r) => r.pago)
}
