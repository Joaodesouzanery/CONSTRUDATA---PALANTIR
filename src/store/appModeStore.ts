/**
 * Global application mode store.
 * Controls whether the app shows rich mock/demo data or an empty "live" state.
 *
 * When entering demo mode, the user's real data is snapshot to localStorage
 * so it can be restored when demo mode is turned off — no data loss.
 */
import { create } from 'zustand'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import {
  destravarAgenda, proximoVencimento, opsQuePedemAtencao, agendamentoDaOp,
  opsEstacionadas, opsEsperando,
} from '@/lib/storeSync'

interface AppModeState {
  isDemoMode: boolean
  toggleDemoMode: () => void
}

interface TenantSyncState {
  pendingSync?: unknown[]
  syncStatus?: string
  syncError?: string | null
  flush?: () => Promise<void> | void
  pull?: () => Promise<void> | void
}

export interface ResumoSync {
  /** Tudo que está na fila, some o que for. */
  pending: number
  /** Requisição em voo agora. */
  syncing: boolean
  error: boolean
  /** Ops só esperando o horário da próxima tentativa — não estão travadas nem em voo. */
  esperando: number
  /** Ops de outra organização, paradas até você voltar para ela. */
  estacionadas: number
}

/**
 * Resumo global de sincronização.
 *
 * ─── DUAS CORREÇÕES ───────────────────────────────────────────────────────────
 * 1. **Distingue "em voo" de "esperando" de "estacionada".** Antes devolvia só um `pending`, e o
 *    indicador fazia `syncing || pending > 0` → "Enviando para a nuvem…". Uma op reagendada para
 *    daqui a 30 minutos deixava o ícone girando o tempo todo, dizendo "não precisa fazer nada".
 *    E op de outra organização, que nunca sai da fila, girava para sempre.
 *
 * 2. **Um store que falha ao carregar não derruba mais o resumo.** Era `Promise.all` sem
 *    try/catch por item, e o chamador não tinha `.catch`: um único módulo que não baixasse — o
 *    que acontece logo depois de um deploy, com o índice antigo em cache — fazia a função
 *    rejeitar e o indicador **congelar no último valor**, indefinidamente. As duas funções irmãs
 *    (`getSyncDiagnostics`, `pendenciasQuePedemAtencao`) já tinham a proteção; esta ficou de fora.
 */
export async function getPendingSummary(): Promise<ResumoSync> {
  const vazio: ResumoSync = { pending: 0, error: false, syncing: false, esperando: 0, estacionadas: 0 }
  if (isNonProductionDataMode()) return vazio

  let pending = 0, error = false, syncing = false
  await Promise.all(TENANT_STORE_DEFS.map(async (d) => {
    try {
      const st = (await d.load()).getState()
      pending += st.pendingSync?.length ?? 0
      if (st.syncStatus === 'error') error = true
      if (st.syncStatus === 'syncing') syncing = true
    } catch { /* store não carregou — o resumo segue com o que deu, em vez de sumir */ }
  }))

  return { pending, error, syncing, esperando: opsEsperando(), estacionadas: opsEstacionadas().length }
}

/** As ops paradas por serem de outra empresa, com o nome do módulo, para a tela explicar. */
export async function pendenciasDeOutraEmpresa(): Promise<Array<{ modulo: string; tabela: string; orgId: string }>> {
  if (isNonProductionDataMode()) return []
  const paradas = opsEstacionadas()
  if (paradas.length === 0) return []
  const porOpId = new Map(paradas.map((p) => [p.opId, p]))
  const out: Array<{ modulo: string; tabela: string; orgId: string }> = []
  await Promise.all(TENANT_STORE_DEFS.map(async (d) => {
    try {
      const store = await d.load()
      for (const op of (store.getState().pendingSync ?? []) as Array<{ id?: string }>) {
        const p = porOpId.get(String(op.id ?? ''))
        if (p) out.push({ modulo: d.label, tabela: p.table, orgId: p.orgId })
      }
    } catch { /* store não carregou — ignora */ }
  }))
  return out
}

const STORAGE_KEY = 'cdata-demo'
const SNAPSHOT_KEY = 'cdata-user-snapshot'

// All persist keys used by feature stores (user data that must be preserved)
const STORE_KEYS = [
  'cdata-rdo', 'cdata-suprimentos', 'cdata-agenda', 'cdata-projetos',
  'cdata-planejamento', 'cdata-planejamento-restricoes', 'cdata-quantitativos', 'cdata-relatorio360', 'cdata-bim',
  'cdata-torre-controle', 'cdata-equipamentos', 'cdata-gestao-equipamentos',
  'cdata-preconstrucao', 'cdata-mao-de-obra', 'cdata-otimizacao-frota',
  'cdata-lps', 'cdata-evm', 'cdata-mapa-interativo', 'cdata-gestao-360',
  'cdata-qualidade', 'cdata-medicao', 'cdata-medicao-billing',
  'cdata-medicao-unificada', 'cdata-medicao-assistida',
  'cdata-planejamento-mestre', 'cdata-operacao-campo', 'cdata-rede-360',
  'cdata-frota-veicular', 'cdata-financeiro', 'cdata-financeiro-titulos', 'cdata-rdo-sabesp',
  'cdata-company-settings', 'cdata-contractors', 'cdata-economia',
  'cdata-manutencoes', 'cdata-laudos', 'cdata-dias-sem-producao', 'cdata-user-routine', 'cdata-plano-execucao', 'cdata-servicos',
  'cdata-manejo-financeiro', 'cdata-rotinas', 'cdata-rateio-consumo',
]

function clearLocalOnlyModuleData() {
  localStorage.removeItem('cdata-manutencoes')
  localStorage.removeItem('cdata-laudos')
}

/**
 * Guarda o estado do usuário antes de carregar o demo.
 *
 * O QUE ESTAVA ERRADO, e valia para TODOS os módulos. O laço só guardava a chave que já
 * existia (`if (val)`), e o restore devolvia `true` de qualquer jeito — pulando o `clearData()`
 * de todos os stores. Consequência: qualquer módulo que estivesse **vazio** quando você ligou o
 * Modo Demo ganhava a chave com dado de demonstração, e desligar o Demo não a removia, porque
 * ela não estava no snapshot e o caminho de limpeza nunca rodava. O dado demo ficava, com o
 * Modo Demo desligado.
 *
 * A correção é gravar o "não existia" explicitamente, como `null`. Assim o restore sabe a
 * diferença entre "não guardei isso" e "isso não existia, apague".
 */
function snapshotUserData() {
  const snapshot: Record<string, string | null> = {}
  for (const key of STORE_KEYS) {
    // `null` é informação: significa "esta chave não existia, e precisa deixar de existir".
    snapshot[key] = localStorage.getItem(key)
  }
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage cheio — segue sem snapshot; o restore cai no clearData().
  }
}

/**
 * Devolve o estado do usuário ao desligar o Modo Demo.
 *
 * ── A ORDEM DOS TRÊS PASSOS NÃO É NEGOCIÁVEL ──────────────────────────────────────────────────
 * limpar a memória → restaurar o localStorage → reidratar. Trocar os dois primeiros de lugar
 * DESTRÓI o dado do cliente, e isso foi medido com o zustand 5.0.12 real:
 *
 *   restaurar → limpar → reidratar : o `set()` do `clearData` passa pelo wrapper do persist e
 *     grava VAZIO por cima do que acabou de ser restaurado; a reidratação lê esse vazio. O dado
 *     real do cliente some.
 *   limpar → restaurar → reidratar : o `clearData` também grava vazio, mas o passo seguinte
 *     sobrescreve com o dado real, e a reidratação lê o dado real. Correto.
 *
 * ── POR QUE LIMPAR, SE A REIDRATAÇÃO JÁ DEVERIA BASTAR ────────────────────────────────────────
 * Porque não basta, e isto também foi medido:
 *
 *   merge padrão (36 dos 37 stores), chave AUSENTE no localStorage → o estado vivo INTEIRO
 *     sobrevive. O `middleware.mjs` chama `merge(persistido, get())` mesmo sem chave nenhuma,
 *     com `persistido === undefined`; o merge padrão é `{ ...current, ...persisted }`, e
 *     espalhar `undefined` não faz nada. Sai o dado de demonstração completo.
 *   merge padrão, chave presente com listas vazias → as listas zeram, mas tudo que está fora do
 *     `partialize` (id selecionado, filtros, contadores) continua sendo o do demo.
 *
 * E a chave ausente é justamente o caso de uma organização VAZIA: o snapshot grava `null` para
 * ela e o restore faz `removeItem`. Quem mais precisava da limpeza era quem não a recebia.
 *
 * O `clearData()` sempre existiu para isso, mas só rodava no ramo `!restored` de
 * `toggleDemoMode` — o caminho de exceção. Aqui ele passa a rodar no caminho normal.
 *
 * Seguro para os 34 stores desta lista: todos têm a sua chave em `STORE_KEYS`, então o vazio que
 * o `clearData` grava é sempre sobrescrito no passo 2. Um store fora de `STORE_KEYS` perderia o
 * dado — se algum entrar aqui um dia, a chave dele tem de entrar em `STORE_KEYS` junto.
 */
async function restoreUserData() {
  const raw = localStorage.getItem(SNAPSHOT_KEY)
  if (!raw) return false

  try {
    const snapshot: Record<string, string | null> = JSON.parse(raw)

    // Passo 1: os stores primeiro, porque o passo 2 depende de a memória já estar limpa.
    const stores = await Promise.all([
      import('./projetosStore').then(m => m.useProjetosStore),
      import('./agendaStore').then(m => m.useAgendaStore),
      import('./relatorio360Store').then(m => m.useRelatorio360Store),
      import('./equipamentosStore').then(m => m.useEquipamentosStore),
      import('./gestaoEquipamentosStore').then(m => m.useGestaoEquipamentosStore),
      import('./torreDeControleStore').then(m => m.useTorreStore),
      import('./suprimentosStore').then(m => m.useSuprimentosStore),
      import('./preConstrucaoStore').then(m => m.usePreConstrucaoStore),
      import('./maoDeObraStore').then(m => m.useMaoDeObraStore),
      import('./otimizacaoFrotaStore').then(m => m.useOtimizacaoFrotaStore),
      import('./gestao360Store').then(m => m.useGestao360Store),
      import('./planejamentoStore').then(m => m.usePlanejamentoStore),
      import('./rdoStore').then(m => m.useRdoStore),
      import('./quantitativosStore').then(m => m.useQuantitativosStore),
      import('./bimStore').then(m => m.useBimStore),
      import('./lpsStore').then(m => m.useLpsStore),
      import('./mapaInterativoStore').then(m => m.useMapaInterativoStore),
      import('./evmStore').then(m => m.useEvmStore),
      import('./qualidadeStore').then(m => m.useQualidadeStore),
      import('./planejamentoMestreStore').then(m => m.usePlanejamentoMestreStore),
      import('./operacaoCampoStore').then(m => m.useOperacaoCampoStore),
      import('./rede360Store').then(m => m.useRede360Store),
      import('./frotaVeicularStore').then(m => m.useFrotaVeicularStore),
      import('./medicaoStore').then(m => m.useMedicaoStore),
      import('./medicaoBillingStore').then(m => m.useMedicaoBillingStore),
      import('./financeiroStore').then(m => m.useFinanceiroStore),
      import('./financeiroTitulosStore').then(m => m.useFinanceiroTitulosStore),
      import('./planoExecucaoStore').then(m => m.usePlanoExecucaoStore),
      import('./servicosStore').then(m => m.useServicosStore),
      import('./companySettingsStore').then(m => m.useCompanySettingsStore),
      import('./economiaStore').then(m => m.useEconomiaStore),
      import('./manejoFinanceiroStore').then(m => m.useManejoFinanceiroStore),
      import('./manutencoesStore').then(m => m.useManutencoesStore),
      import('./laudosStore').then(m => m.useLaudosStore),
      import('./diasSemProducaoStore').then(m => m.useDiasSemProducaoStore),
      import('./rotinasStore').then(m => m.useRotinasStore),
    ])
    // Passo 2: zerar a memória. Isto grava vazio no localStorage de cada store — de propósito,
    // porque o passo 3 sobrescreve logo em seguida com o dado real.
    for (const store of stores) {
      const estado = store.getState() as { clearData?: () => void }
      if (typeof estado.clearData === 'function') estado.clearData()
    }

    // Passo 3: devolver o localStorage ao que era antes do Demo.
    for (const [key, val] of Object.entries(snapshot)) {
      // `null` = a chave não existia antes do demo. Removê-la é o que impede o dado de
      // demonstração de sobreviver ao desligamento do Modo Demo.
      if (val === null) localStorage.removeItem(key)
      else localStorage.setItem(key, val)
    }
    // Snapshots antigos (formato sem null) não listavam as chaves ausentes. Para eles, apagar
    // tudo que está fora do snapshot é o que restaura o estado de verdade.
    for (const key of STORE_KEYS) {
      if (!(key in snapshot)) localStorage.removeItem(key)
    }
    localStorage.removeItem(SNAPSHOT_KEY)

    // Passo 4: reidratar. Cada store lê a sua chave restaurada; quem não tem chave fica no
    // estado zerado do passo 2, e o `pullRealData()` seguinte traz o que houver no servidor.
    for (const store of stores) {
      store.persist?.rehydrate?.()
    }
    return true
  } catch {
    return false
  }
}

interface TenantStoreApi {
  getState: () => TenantSyncState
  setState: (partial: Partial<TenantSyncState>) => void
}

// Lista rotulada dos stores tenant-scoped (label amigável p/ o painel de sincronização).
const TENANT_STORE_DEFS: Array<{ key: string; label: string; load: () => Promise<TenantStoreApi> }> = [
  { key: 'projetos', label: 'Projetos', load: () => import('./projetosStore').then(m => m.useProjetosStore as unknown as TenantStoreApi) },
  { key: 'agenda', label: 'Agenda', load: () => import('./agendaStore').then(m => m.useAgendaStore as unknown as TenantStoreApi) },
  { key: 'relatorio360', label: 'Relatório 360', load: () => import('./relatorio360Store').then(m => m.useRelatorio360Store as unknown as TenantStoreApi) },
  { key: 'equipamentos', label: 'Equipamentos', load: () => import('./equipamentosStore').then(m => m.useEquipamentosStore as unknown as TenantStoreApi) },
  { key: 'gestao-equipamentos', label: 'Gestão de Equipamentos', load: () => import('./gestaoEquipamentosStore').then(m => m.useGestaoEquipamentosStore as unknown as TenantStoreApi) },
  { key: 'torre', label: 'Torre de Controle (Obras)', load: () => import('./torreDeControleStore').then(m => m.useTorreStore as unknown as TenantStoreApi) },
  { key: 'suprimentos', label: 'Suprimentos / Estoque', load: () => import('./suprimentosStore').then(m => m.useSuprimentosStore as unknown as TenantStoreApi) },
  { key: 'preconstrucao', label: 'Pré-Construção', load: () => import('./preConstrucaoStore').then(m => m.usePreConstrucaoStore as unknown as TenantStoreApi) },
  { key: 'mao-de-obra', label: 'Mão de Obra', load: () => import('./maoDeObraStore').then(m => m.useMaoDeObraStore as unknown as TenantStoreApi) },
  { key: 'otimizacao-frota', label: 'Otimização de Frota', load: () => import('./otimizacaoFrotaStore').then(m => m.useOtimizacaoFrotaStore as unknown as TenantStoreApi) },
  { key: 'gestao360', label: 'Gestão 360', load: () => import('./gestao360Store').then(m => m.useGestao360Store as unknown as TenantStoreApi) },
  { key: 'planejamento', label: 'Planejamento (Trechos)', load: () => import('./planejamentoStore').then(m => m.usePlanejamentoStore as unknown as TenantStoreApi) },
  { key: 'rdo', label: 'RDO', load: () => import('./rdoStore').then(m => m.useRdoStore as unknown as TenantStoreApi) },
  { key: 'quantitativos', label: 'Quantitativos', load: () => import('./quantitativosStore').then(m => m.useQuantitativosStore as unknown as TenantStoreApi) },
  { key: 'bim', label: 'BIM', load: () => import('./bimStore').then(m => m.useBimStore as unknown as TenantStoreApi) },
  { key: 'lps', label: 'LPS / Lean', load: () => import('./lpsStore').then(m => m.useLpsStore as unknown as TenantStoreApi) },
  { key: 'mapa', label: 'Mapa Interativo', load: () => import('./mapaInterativoStore').then(m => m.useMapaInterativoStore as unknown as TenantStoreApi) },
  { key: 'evm', label: 'Financeiro (EVM)', load: () => import('./evmStore').then(m => m.useEvmStore as unknown as TenantStoreApi) },
  { key: 'qualidade', label: 'Qualidade (FVS)', load: () => import('./qualidadeStore').then(m => m.useQualidadeStore as unknown as TenantStoreApi) },
  { key: 'planejamento-mestre', label: 'Planejamento', load: () => import('./planejamentoMestreStore').then(m => m.usePlanejamentoMestreStore as unknown as TenantStoreApi) },
  { key: 'planejamento-restricoes', label: 'Restrições', load: () => import('./planejamentoRestricoesStore').then(m => m.usePlanejamentoRestricoesStore as unknown as TenantStoreApi) },
  { key: 'operacao-campo', label: 'Operação de Campo', load: () => import('./operacaoCampoStore').then(m => m.useOperacaoCampoStore as unknown as TenantStoreApi) },
  { key: 'rede360', label: 'Rede 360', load: () => import('./rede360Store').then(m => m.useRede360Store as unknown as TenantStoreApi) },
  { key: 'frota-veicular', label: 'Frota Veicular', load: () => import('./frotaVeicularStore').then(m => m.useFrotaVeicularStore as unknown as TenantStoreApi) },
  { key: 'medicao', label: 'Medição', load: () => import('./medicaoStore').then(m => m.useMedicaoStore as unknown as TenantStoreApi) },
  { key: 'financeiro', label: 'Financeiro', load: () => import('./financeiroStore').then(m => m.useFinanceiroStore as unknown as TenantStoreApi) },
  { key: 'plano-execucao', label: 'Planejamento de Execução', load: () => import('./planoExecucaoStore').then(m => m.usePlanoExecucaoStore as unknown as TenantStoreApi) },
  { key: 'servicos', label: 'Catálogo de Serviços', load: () => import('./servicosStore').then(m => m.useServicosStore as unknown as TenantStoreApi) },
  { key: 'company-settings', label: 'Configurações da Empresa', load: () => import('./companySettingsStore').then(m => m.useCompanySettingsStore as unknown as TenantStoreApi) },
  { key: 'economia', label: 'Economia', load: () => import('./economiaStore').then(m => m.useEconomiaStore as unknown as TenantStoreApi) },
  { key: 'manejo-financeiro', label: 'Manejo Financeiro', load: () => import('./manejoFinanceiroStore').then(m => m.useManejoFinanceiroStore as unknown as TenantStoreApi) },
  { key: 'medicao-unificada', label: 'Medição Unificada', load: () => import('./medicaoUnificadaStore').then(m => m.useMedicaoUnificadaStore as unknown as TenantStoreApi) },
  { key: 'contractors', label: 'Empreiteiros / Faturas', load: () => import('./contractorStore').then(m => m.useContractorStore as unknown as TenantStoreApi) },
  { key: 'financeiro-titulos', label: 'Pagamentos e Cobranças', load: () => import('./financeiroTitulosStore').then(m => m.useFinanceiroTitulosStore as unknown as TenantStoreApi) },
  { key: 'rateio-consumo', label: 'Rateio de Consumo', load: () => import('./rateioConsumoStore').then(m => m.useRateioConsumoStore as unknown as TenantStoreApi) },
  { key: 'laudos', label: 'Compliance de Laudos', load: () => import('./laudosStore').then(m => m.useLaudosStore as unknown as TenantStoreApi) },
  { key: 'dias-sem-producao', label: 'Dias sem produção', load: () => import('./diasSemProducaoStore').then(m => m.useDiasSemProducaoStore as unknown as TenantStoreApi) },
  { key: 'manutencoes', label: 'Manutenções', load: () => import('./manutencoesStore').then(m => m.useManutencoesStore as unknown as TenantStoreApi) },
  { key: 'medicao-billing', label: 'Medição (Boletins)', load: () => import('./medicaoBillingStore').then(m => m.useMedicaoBillingStore as unknown as TenantStoreApi) },
  // Faltava. Sem estar aqui, as operações pendentes de rotina eram INVISÍVEIS: o indicador de
  // sincronização não as contava nem listava, "Tentar novamente" não as reenviava e "Baixar cópia"
  // não as encontrava. E os rótulos `rotinas` / `rotinas concluídas` já tinham sido adicionados ao
  // indicador — rótulos que nunca podiam aparecer, porque o store não era consultado.
  { key: 'rotinas', label: 'Rotinas da Empresa', load: () => import('./rotinasStore').then(m => m.useRotinasStore as unknown as TenantStoreApi) },
]

async function getAllTenantStores(): Promise<Array<{ getState: () => TenantSyncState }>> {
  return Promise.all(TENANT_STORE_DEFS.map((d) => d.load()))
}

/** Diagnóstico por módulo: só os que têm pendências ou erro, com a mensagem real. */
export async function getSyncDiagnostics(): Promise<Array<{ key: string; label: string; pending: number; error: boolean; syncError: string | null }>> {
  if (isNonProductionDataMode()) return []
  const out: Array<{ key: string; label: string; pending: number; error: boolean; syncError: string | null }> = []
  await Promise.all(TENANT_STORE_DEFS.map(async (d) => {
    try {
      const store = await d.load()
      const st = store.getState() as TenantSyncState & { syncError?: string | null }
      const pending = st.pendingSync?.length ?? 0
      const error = st.syncStatus === 'error'
      if (pending > 0 || error) out.push({ key: d.key, label: d.label, pending, error, syncError: st.syncError ?? null })
    } catch { /* store não carregou — ignora */ }
  }))
  return out.sort((a, b) => Number(b.error) - Number(a.error) || b.pending - a.pending)
}

/**
 * Reenvia AGORA tudo o que está parado, ignorando a espera do backoff.
 *
 * Antes isto era um apelido puro de `flushAllTenantStores()` — e por isso o botão "Tentar
 * novamente" não resolvia nada: as ops travadas já haviam sido excluídas da rodada pelo teto de
 * tentativas, então o flush voltava sem ter enviado nenhuma delas. `destravarAgenda()` é a parte
 * que faltava: ela zera a espera de todas as ops antes de drenar.
 */
export async function retryAllTenantStores(): Promise<void> {
  destravarAgenda()
  await flushAllTenantStores()
}

/**
 * Lê as operações não salvas de um módulo, para a tela poder DIZER o que está preso.
 *
 * Até aqui o painel mostrava só a contagem e a última mensagem de erro do Postgres, em inglês.
 * Quem via "3 NÃO SALVO(S)" não tinha como saber quais três registros eram.
 */
export async function listarOpsPendentes(storeKey: string): Promise<OpPendenteResumo[]> {
  const def = TENANT_STORE_DEFS.find((d) => d.key === storeKey)
  if (!def) return []
  const store = await def.load()
  const fila = (store.getState().pendingSync ?? []) as Array<Record<string, unknown>>
  return fila.map((op) => {
    const ag = agendamentoDaOp(String(op.id ?? ''))
    return {
      id: String(op.id ?? ''),
      tabela: String(op.table ?? '—'),
      tipo: String(op.type ?? '—') as OpPendenteResumo['tipo'],
      recordId: String(op.recordId ?? ''),
      tentativas: Number(op.retries ?? 0),
      criadaEm: String(op.createdAt ?? ''),
      classe: ag?.classe ?? null,
      motivo: ag?.motivo ?? null,
      proximaTentativa: ag?.proximaTentativa ?? null,
    }
  })
}

export interface OpPendenteResumo {
  id: string
  tabela: string
  tipo: 'insert' | 'update' | 'delete' | string
  recordId: string
  tentativas: number
  criadaEm: string
  /** Classificação da última falha — `null` enquanto a op nunca falhou. */
  classe: 'transitorio' | 'aguardando-servidor' | 'auto-curavel' | 'bloqueante' | null
  motivo: string | null
  proximaTentativa: number | null
}

/**
 * Baixa as operações não salvas de um módulo como JSON.
 *
 * É a rede de proteção do "Descartar". Sem ela, descartar era PERDA SILENCIOSA: a fila era
 * zerada, os registros continuavam na tela, e o próximo `pull` — que roda a cada abertura do
 * módulo — os apagava, porque sem op pendente o `mergePull` devolve a lista do servidor. O
 * usuário não via aviso nenhum e só descobria depois, se descobrisse.
 */
export async function baixarOpsPendentes(storeKey: string): Promise<number> {
  const def = TENANT_STORE_DEFS.find((d) => d.key === storeKey)
  if (!def) return 0
  const store = await def.load()
  const fila = (store.getState().pendingSync ?? []) as unknown[]
  if (fila.length === 0) return 0

  const conteudo = JSON.stringify({ modulo: def.label, chave: def.key, baixadoEm: new Date().toISOString(), operacoes: fila }, null, 2)
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `nao-salvos-${def.key}-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return fila.length
}

/**
 * Escotilha de escape: descarta operações não salvas de um módulo.
 *
 * ⚠️ Esta função PERDE DADO. Ela existia ligada a um botão "Descartar" no painel de
 * sincronização, e o filtro era exatamente ao contrário do que parecia: mantinha só as ops com
 * `retries === 0`, ou seja, jogava fora **precisamente as que estavam travadas** — o trabalho que
 * o usuário tentava salvar. Dos dois botões oferecidos, um não fazia nada e o outro destruía.
 *
 * Agora nada é descartado por contagem de tentativas: quem chama precisa dizer QUAIS ops remover
 * (`opIds`). Sem essa lista a função baixa o JSON e não apaga nada. Como a fila não morre mais
 * sozinha (`storeSync` reagenda para sempre), descartar deixou de ser uma necessidade do dia a
 * dia e virou o que sempre deveria ter sido: uma decisão explícita, item a item.
 */
export async function discardErroredOps(storeKey: string, opIds?: string[]): Promise<number> {
  const def = TENANT_STORE_DEFS.find((d) => d.key === storeKey)
  if (!def) return 0
  const store = await def.load()
  const fila = (store.getState().pendingSync ?? []) as Array<{ id?: string }>
  if (fila.length === 0) return 0

  // Sempre salva uma cópia antes de perder qualquer coisa.
  await baixarOpsPendentes(storeKey)
  if (!opIds || opIds.length === 0) return 0

  const remover = new Set(opIds)
  const restante = fila.filter((op) => !remover.has(String(op.id ?? '')))
  const descartadas = fila.length - restante.length
  store.setState({ pendingSync: restante, syncStatus: 'idle', syncError: null } as Partial<TenantSyncState>)
  return descartadas
}

/**
 * Agendador único de sincronização.
 *
 * Antes, o único gatilho automático era `addEventListener('online')` — repetido em 42 arquivos e
 * disparado só na TRANSIÇÃO de offline para online. Para quem já estava online com uma op presa,
 * ele nunca disparava: o dado ficava parado até alguém abrir o módulo na mão.
 *
 * Aqui há um relógio só, que acorda quando a próxima op vence, mais os três momentos em que faz
 * sentido tentar de novo: a rede voltou, a aba voltou a ficar visível, a janela recebeu foco.
 */
let timerAgendador: number | null = null
let agendadorLigado = false

function reagendarTimer(): void {
  if (typeof window === 'undefined') return
  if (timerAgendador != null) { window.clearTimeout(timerAgendador); timerAgendador = null }
  const vencimento = proximoVencimento()
  if (vencimento == null) return
  // Piso de 1s (evita laço quente) e teto de 60s (o relógio reavalia de tempos em tempos, mesmo
  // que a próxima op só vença daqui a meia hora — assim uma op nova entra no ritmo na hora).
  const espera = Math.min(Math.max(vencimento - Date.now(), 1_000), 60_000)
  timerAgendador = window.setTimeout(() => { void tentarAgora('timer') }, espera) as unknown as number
}

async function tentarAgora(origem: string): Promise<void> {
  if (isNonProductionDataMode()) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) { reagendarTimer(); return }
  try {
    await flushAllTenantStores()
  } catch {
    /* cada store já registra o próprio erro; o agendador só cuida do "quando" */
  } finally {
    if (origem !== 'timer' || proximoVencimento() != null) reagendarTimer()
  }
}

export function iniciarAgendadorDeSync(): () => void {
  if (typeof window === 'undefined' || agendadorLigado) return () => undefined
  agendadorLigado = true

  const aoVoltarRede = () => { destravarAgenda(); void tentarAgora('online') }
  const aoFicarVisivel = () => { if (document.visibilityState === 'visible') void tentarAgora('visibilitychange') }
  const aoFocar = () => { void tentarAgora('focus') }

  window.addEventListener('online', aoVoltarRede)
  document.addEventListener('visibilitychange', aoFicarVisivel)
  window.addEventListener('focus', aoFocar)

  // Destravamento de boot: a espera vive em memória, então abrir o app já tenta tudo de novo.
  // É isto que faz uma pendência antiga subir sozinha, sem o usuário refazer ou clicar em nada.
  void tentarAgora('boot')

  return () => {
    window.removeEventListener('online', aoVoltarRede)
    document.removeEventListener('visibilitychange', aoFicarVisivel)
    window.removeEventListener('focus', aoFocar)
    if (timerAgendador != null) window.clearTimeout(timerAgendador)
    timerAgendador = null
    agendadorLigado = false
  }
}

/**
 * O que de fato precisa da atenção de uma pessoa: só falha BLOQUEANTE que já insistiu bastante.
 * Tudo o mais — rede ruim, migração pendente, conflito que o próprio flush resolve — continua
 * sendo tentado em silêncio, que é o combinado com o usuário.
 */
export interface PendenciaBloqueada {
  opId:     string
  modulo:   string
  motivo:   string
  tabela:   string
  recordId: string
  tipo:     string
}

export async function pendenciasQuePedemAtencao(): Promise<PendenciaBloqueada[]> {
  if (isNonProductionDataMode()) return []
  const bloqueadas = opsQuePedemAtencao()
  if (bloqueadas.length === 0) return []
  const porOpId = new Map(bloqueadas.map((b) => [b.opId, b]))
  const out: PendenciaBloqueada[] = []
  await Promise.all(TENANT_STORE_DEFS.map(async (d) => {
    try {
      const store = await d.load()
      for (const op of (store.getState().pendingSync ?? []) as Array<Record<string, unknown>>) {
        const b = porOpId.get(String(op.id ?? ''))
        if (!b) continue
        out.push({
          opId:     b.opId,
          modulo:   d.label,
          motivo:   b.motivo,
          tabela:   String(op.table ?? ''),
          recordId: String(op.recordId ?? ''),
          tipo:     String(op.type ?? ''),
        })
      }
    } catch { /* store não carregou — ignora */ }
  }))
  return out
}

async function pullRealData() {
  const stores = await getAllTenantStores()
  await Promise.allSettled(stores.map((store) => store.getState().pull?.()))
  const { useMedicaoBillingStore } = await import('./medicaoBillingStore')
  await useMedicaoBillingStore.getState().loadRemote().catch(() => undefined)
}

/**
 * Sincroniza TODOS os stores tenant-scoped quando a organização ativa carrega
 * (login/troca de empresa): primeiro faz flush das ops locais ainda não
 * sincronizadas (recuperando dados criados offline ou antes do perfil), depois
 * faz pull do servidor APENAS onde a fila esvaziou — assim nunca sobrescreve
 * dado local que ainda não subiu. No modo demo/homologação, não sincroniza.
 */
/**
 * Sobe (flush) as ops pendentes de TODOS os stores tenant-scoped ANTES de qualquer
 * limpeza de cache (troca de empresa / logout). Evita perder dados criados e ainda
 * não sincronizados quando os caches locais são apagados. No-op no modo demo/homolog.
 */
export async function flushAllTenantStores(): Promise<void> {
  if (isNonProductionDataMode()) return
  const stores = await getAllTenantStores()
  await Promise.allSettled(stores.map((s) => s.getState().flush?.()))
}

export async function syncAllTenantStores(): Promise<void> {
  if (isNonProductionDataMode()) return
  // Liga o relógio de reenvio. É idempotente, e este é o momento certo: só faz sentido tentar
  // subir alguma coisa depois que existe sessão e organização ativa.
  iniciarAgendadorDeSync()
  const stores = await getAllTenantStores()
  // 1) flush primeiro (sobe o local-only, re-carimbando a organização ativa)
  await Promise.allSettled(stores.map((s) => s.getState().flush?.()))
  // 2) pull SEMPRE — inclusive com fila pendente. Quem protege o dado local é o
  //    `mergePull` de storeSync: ele atualiza os registros sem op pendente e mantém os
  //    pendentes. Pular a tabela quando havia qualquer pendência (a política antiga)
  //    fazia UMA op presa congelar o pull daquela tabela para sempre — o usuário nunca
  //    mais via o que os colegas cadastravam, sem sintoma nenhum.
  await Promise.allSettled(stores.map((s) => s.getState().pull?.()))
  const { useMedicaoBillingStore } = await import('./medicaoBillingStore')
  await useMedicaoBillingStore.getState().loadRemote().catch(() => undefined)
}

const savedRaw = localStorage.getItem(STORAGE_KEY)
const initialDemo: boolean = savedRaw === 'true'

export const useAppModeStore = create<AppModeState>((set) => ({
  isDemoMode: initialDemo,

  toggleDemoMode: () =>
    set((s) => {
      const next = !s.isDemoMode
      localStorage.setItem(STORAGE_KEY, String(next))

      // Cascade to all feature stores — import lazily to avoid circular deps
      if (next) {
        // Snapshot user data before overwriting with demo
        snapshotUserData()

        // Load demo data in each store
        import('./projetosStore').then(({ useProjetosStore }) => useProjetosStore.getState().loadDemoData())
        import('./agendaStore').then(({ useAgendaStore }) => useAgendaStore.getState().loadDemoData())
        import('./relatorio360Store').then(({ useRelatorio360Store }) => useRelatorio360Store.getState().loadDemoData())
        import('./equipamentosStore').then(({ useEquipamentosStore }) => useEquipamentosStore.getState().loadDemoData())
        import('./gestaoEquipamentosStore').then(({ useGestaoEquipamentosStore }) => useGestaoEquipamentosStore.getState().loadDemoData())
        import('./torreDeControleStore').then(({ useTorreStore }) => useTorreStore.getState().loadDemoData())
        import('./suprimentosStore').then(({ useSuprimentosStore }) => useSuprimentosStore.getState().loadDemoData())
        import('./preConstrucaoStore').then(({ usePreConstrucaoStore }) => usePreConstrucaoStore.getState().loadDemoData())
        import('./maoDeObraStore').then(({ useMaoDeObraStore }) => useMaoDeObraStore.getState().loadDemoData())
        import('./otimizacaoFrotaStore').then(({ useOtimizacaoFrotaStore }) => useOtimizacaoFrotaStore.getState().loadDemoData())
        import('./gestao360Store').then(({ useGestao360Store }) => useGestao360Store.getState().loadDemoData())
        import('./planejamentoStore').then(({ usePlanejamentoStore }) => usePlanejamentoStore.getState().loadDemoData())
        import('./rdoStore').then(({ useRdoStore }) => useRdoStore.getState().loadDemoData())
        import('./quantitativosStore').then(({ useQuantitativosStore }) => useQuantitativosStore.getState().loadDemoData())
        import('./bimStore').then(({ useBimStore }) => useBimStore.getState().loadDemoData())
        import('./lpsStore').then(({ useLpsStore }) => useLpsStore.getState().loadDemoData())
        import('./mapaInterativoStore').then(({ useMapaInterativoStore }) => useMapaInterativoStore.getState().loadDemoData())
        import('./evmStore').then(({ useEvmStore }) => useEvmStore.getState().loadDemoData())
        // Stores previously missing from cascade
        import('./qualidadeStore').then(({ useQualidadeStore }) => useQualidadeStore.getState().loadDemoData())
        import('./planejamentoMestreStore').then(({ usePlanejamentoMestreStore }) => usePlanejamentoMestreStore.getState().loadDemoData())
        import('./operacaoCampoStore').then(({ useOperacaoCampoStore }) => useOperacaoCampoStore.getState().loadDemoData())
        import('./rede360Store').then(({ useRede360Store }) => useRede360Store.getState().loadDemoData())
        import('./frotaVeicularStore').then(({ useFrotaVeicularStore }) => useFrotaVeicularStore.getState().loadDemoData())
        import('./medicaoStore').then(({ useMedicaoStore }) => useMedicaoStore.getState().loadDemoData())
        import('./medicaoBillingStore').then(({ useMedicaoBillingStore }) => useMedicaoBillingStore.getState().loadDemoData())
        import('./financeiroStore').then(({ useFinanceiroStore }) => useFinanceiroStore.getState().loadDemoData())
        import('./financeiroTitulosStore').then(({ useFinanceiroTitulosStore }) => useFinanceiroTitulosStore.getState().loadDemoData())
        // Predial (demo isolado): ativos/planos/OS + laudos do "Residencial Modelo".
        import('./manutencoesStore').then(({ useManutencoesStore }) => useManutencoesStore.getState().loadDemoData())
        import('./laudosStore').then(({ useLaudosStore }) => useLaudosStore.getState().loadDemoData())
        import('./diasSemProducaoStore').then(({ useDiasSemProducaoStore }) => useDiasSemProducaoStore.getState().loadDemoData())
        // ⚠️ Quatro stores estavam FORA desta cascata (achado em 25/08/2026 pelo
        // `cascataDemo.test.ts`), todos com `loadDemoData` pronto e nunca chamado. O efeito: com a
        // Demonstração ligada, os outros módulos trocavam para o dado de exemplo e estes quatro
        // continuavam exibindo o dado REAL do cliente, lado a lado. No Economia era pior ainda: a
        // varredura de eventos lê os outros stores, então passava a gerar eventos a partir do dado
        // de demonstração e a misturá-los na lista real, em memória.
        //
        // `cdata-rateio-consumo` também não estava em STORE_KEYS. A ordem do conserto importou:
        // sem a chave no snapshot, pôr o store na cascata apagaria o dado real do cliente sem nada
        // para restaurar depois.
        import('./economiaStore').then(({ useEconomiaStore }) => useEconomiaStore.getState().loadDemoData())
        import('./manejoFinanceiroStore').then(({ useManejoFinanceiroStore }) => useManejoFinanceiroStore.getState().loadDemoData())
        import('./planejamentoRestricoesStore').then(({ usePlanejamentoRestricoesStore }) => usePlanejamentoRestricoesStore.getState().loadDemoData())
        import('./rateioConsumoStore').then(({ useRateioConsumoStore }) => useRateioConsumoStore.getState().loadDemoData())
      } else {
        // Try to restore user data from snapshot; fallback to clearing
        restoreUserData().then((restored) => {
          if (!restored) {
            // No snapshot — clear all stores to empty state (original behavior)
            import('./projetosStore').then(({ useProjetosStore }) => useProjetosStore.getState().clearData())
            import('./agendaStore').then(({ useAgendaStore }) => useAgendaStore.getState().clearData())
            import('./relatorio360Store').then(({ useRelatorio360Store }) => useRelatorio360Store.getState().clearData())
            import('./equipamentosStore').then(({ useEquipamentosStore }) => useEquipamentosStore.getState().clearData())
            import('./gestaoEquipamentosStore').then(({ useGestaoEquipamentosStore }) => useGestaoEquipamentosStore.getState().clearData())
            import('./torreDeControleStore').then(({ useTorreStore }) => useTorreStore.getState().clearData())
            import('./suprimentosStore').then(({ useSuprimentosStore }) => useSuprimentosStore.getState().clearData())
            import('./preConstrucaoStore').then(({ usePreConstrucaoStore }) => usePreConstrucaoStore.getState().clearData())
            import('./maoDeObraStore').then(({ useMaoDeObraStore }) => useMaoDeObraStore.getState().clearData())
            import('./otimizacaoFrotaStore').then(({ useOtimizacaoFrotaStore }) => useOtimizacaoFrotaStore.getState().clearData())
            import('./gestao360Store').then(({ useGestao360Store }) => useGestao360Store.getState().clearData())
            import('./planejamentoStore').then(({ usePlanejamentoStore }) => usePlanejamentoStore.getState().clearData())
            import('./rdoStore').then(({ useRdoStore }) => useRdoStore.getState().clearData())
            import('./quantitativosStore').then(({ useQuantitativosStore }) => useQuantitativosStore.getState().clearData())
            import('./bimStore').then(({ useBimStore }) => useBimStore.getState().clearData())
            import('./lpsStore').then(({ useLpsStore }) => useLpsStore.getState().clearData())
            import('./mapaInterativoStore').then(({ useMapaInterativoStore }) => useMapaInterativoStore.getState().clearData())
            import('./evmStore').then(({ useEvmStore }) => useEvmStore.getState().clearData())
            // Stores previously missing from cascade
            import('./qualidadeStore').then(({ useQualidadeStore }) => useQualidadeStore.getState().clearData())
            import('./planejamentoMestreStore').then(({ usePlanejamentoMestreStore }) => usePlanejamentoMestreStore.getState().clearData())
            import('./operacaoCampoStore').then(({ useOperacaoCampoStore }) => useOperacaoCampoStore.getState().clearData())
            import('./rede360Store').then(({ useRede360Store }) => useRede360Store.getState().clearData())
            import('./frotaVeicularStore').then(({ useFrotaVeicularStore }) => useFrotaVeicularStore.getState().clearData())
            import('./medicaoStore').then(({ useMedicaoStore }) => useMedicaoStore.getState().clearData())
            import('./medicaoBillingStore').then(({ useMedicaoBillingStore }) => useMedicaoBillingStore.getState().clearData())
            import('./financeiroStore').then(({ useFinanceiroStore }) => useFinanceiroStore.getState().clearData())
            import('./financeiroTitulosStore').then(({ useFinanceiroTitulosStore }) => useFinanceiroTitulosStore.getState().clearData())
            import('./manutencoesStore').then(({ useManutencoesStore }) => useManutencoesStore.getState().clearData())
            import('./laudosStore').then(({ useLaudosStore }) => useLaudosStore.getState().clearData())
            import('./diasSemProducaoStore').then(({ useDiasSemProducaoStore }) => useDiasSemProducaoStore.getState().clearData())
            import('./economiaStore').then(({ useEconomiaStore }) => useEconomiaStore.getState().clearData())
            import('./manejoFinanceiroStore').then(({ useManejoFinanceiroStore }) => useManejoFinanceiroStore.getState().clearData())
            import('./planejamentoRestricoesStore').then(({ usePlanejamentoRestricoesStore }) => usePlanejamentoRestricoesStore.getState().clearData())
            import('./rateioConsumoStore').then(({ useRateioConsumoStore }) => useRateioConsumoStore.getState().clearData())
            clearLocalOnlyModuleData()
          }
          void pullRealData()
        })
      }

      return { isDemoMode: next }
    }),
}))
