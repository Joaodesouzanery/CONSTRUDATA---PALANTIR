/**
 * storeSync.ts — Helper compartilhado para stores Zustand local-first.
 *
 * Padrão usado por qualidadeStore (v1) e estendido aqui para os stores
 * multi-entidade do Sprint 2 (RDO/Planejamento/Suprimentos).
 *
 * Cada store mantém sua própria fila de pending ops, mas o `flushQueue()`
 * abaixo despacha cada op para o handler correto baseado em `entity`.
 *
 * Conflict resolution v1: last-write-wins por updated_at do servidor.
 * Quando push falha, a operação fica na fila e syncError mostra o motivo.
 */
import { supabase } from './supabase'
import { useAuth } from './auth'
import { isNonProductionDataMode } from './runtimeMode'
import { withTimeout } from './withTimeout'

/**
 * Teto de tempo por requisição de sync. Numa rede de canteiro ruim, uma
 * requisição pode travar indefinidamente — sem isto o status ficava preso em
 * "sincronizando" para sempre (o "rodando azul"). No estouro, aborta o fetch,
 * a op volta pra fila (retry) e o status vira 'error' (dado seguro no aparelho).
 */
const SYNC_TIMEOUT_MS = 20_000

/** Roda uma query do Supabase com AbortController + timeout de segurança. */
async function withAbort<T>(fn: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController()
  const timer = (typeof window !== 'undefined' ? window.setTimeout : setTimeout)(
    () => controller.abort(),
    SYNC_TIMEOUT_MS,
  ) as unknown as number
  try {
    return await withTimeout(
      fn(controller.signal),
      SYNC_TIMEOUT_MS + 2_000,
      'Tempo esgotado ao sincronizar. Salvo no aparelho — vamos reenviar.',
    )
  } finally {
    ;(typeof window !== 'undefined' ? window.clearTimeout : clearTimeout)(timer)
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'unauth' | 'error'

export interface PendingOp<TEntity extends string = string> {
  id:        string
  entity:    TEntity
  type:      'insert' | 'update' | 'delete'
  recordId:  string
  /**
   * Para insert/update: o row já mapeado snake_case pronto pra mandar.
   * O store calcula isso na hora de enfileirar (assim quando flush rodar
   * usa exatamente o mapeamento que o usuário viu).
   */
  row?:      Record<string, unknown>
  /**
   * Patch parcial — apenas campos que mudaram. Para update.
   */
  patch?:    Record<string, unknown>
  /**
   * @deprecated Nenhum store preenche mais este campo (24/08/2026), e ele NÃO deve voltar.
   *
   * A ideia era "exclusão que precisa de aprovação", mas `request_action` só cria uma linha em
   * `pending_actions` — não apaga nada. O registro sumia da tela, voltava no pull seguinte, e o
   * pedido ficava numa fila que não tem link em menu nenhum e que o próprio autor não pode
   * aprovar. Pior: em três dos quatro usos a intenção não era nem apagar — `type: 'delete'` era só
   * o veículo para chamar o RPC (resolver restrição do LPS, editar ordem de compra fechada).
   *
   * Mantido só para reconhecer e descartar ops antigas que ainda estejam em `localStorage`.
   */
  approvalActionType?: string
  /** Tabela alvo no Supabase. */
  table:     string
  retries:   number
  createdAt: string
}

export interface FlushResult {
  completed:  string[]   // ids das ops drenadas com sucesso confirmado
  errored:    string[]   // ids que falharam mas continuam na fila
  /**
   * Ids que já falharam vezes demais e NÃO foram reenviados nesta rodada.
   *
   * Sem isto, uma op barrada pela RLS voltava para a fila e era reenviada em todo mount de
   * módulo, todo login e todo clique em "Tentar novamente" — para sempre, sem backoff, sempre
   * com o mesmo resultado. O `retries` era incrementado pelos stores e **nunca lido por
   * ninguém**. Agora elas param de girar em falso e passam a ser mostradas ao usuário.
   */
  esgotadas:  string[]
  lastError?: string
}

/**
 * Mantido só por compatibilidade de import. NÃO gateia mais nada.
 *
 * Ele já foi um teto de tentativas: passando de 5 falhas, a op era retirada da rodada ANTES de
 * qualquer requisição, e nada no projeto jamais reduzia `retries`. O efeito era o oposto do
 * pretendido — a op não "descansava", ela morria. Pior: nenhuma correção posterior (migração
 * aplicada, permissão concedida, conserto de código) conseguia mais alcançá-la, porque ela nunca
 * mais era enviada. Foi assim que faltas de Mão de Obra e uma execução de Rotina ficaram presas
 * enquanto o reparo que as consertaria já estava no código.
 *
 * @deprecated A fila agora espera por HORÁRIO (ver `proximaTentativa`), nunca por contagem.
 */
export const MAX_TENTATIVAS_SYNC = 5

/**
 * Classes de falha de sync. O que muda entre elas é só o tempo de espera e se o problema pode
 * chegar aos olhos do usuário — **nenhuma delas descarta a op**.
 */
export type ClasseErroSync = 'transitorio' | 'aguardando-servidor' | 'auto-curavel' | 'bloqueante'

/** Códigos do Postgres/PostgREST que dizem "o servidor ainda não tem o que o app espera". */
const CODIGOS_AGUARDANDO_SERVIDOR = new Set(['PGRST204', 'PGRST205', '42P01', '42703'])
/** Conflitos que o próprio flush resolve sem ajuda de ninguém. */
const CODIGOS_AUTO_CURAVEL = new Set(['23505', '23503'])
/** Falta de permissão — o único caso que pode virar um aviso na tela. */
const CODIGOS_BLOQUEANTE = new Set(['42501', 'PGRST301', '401', '403'])

function codigoDoErro(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as { code?: unknown; status?: unknown; statusCode?: unknown }
    if (o.code != null) return String(o.code)
    if (o.status != null) return String(o.status)
    if (o.statusCode != null) return String(o.statusCode)
  }
  return ''
}

/**
 * Diz de que tipo é a falha. Existe porque, antes, uma oscilação de sinal no canteiro e um "sem
 * permissão" gastavam o mesmo orçamento de tentativas: cinco quedas de rede matavam um dado
 * perfeitamente válido.
 *
 * Na dúvida devolve 'bloqueante' — a classe que espera mais e é a única que pode aparecer para o
 * usuário. É a escolha conservadora: um erro que eu não sei classificar merece ser visto, não
 * repetido a cada cinco segundos contra um servidor que já disse não.
 */
export function classificarErroSync(err: unknown): ClasseErroSync {
  const codigo = codigoDoErro(err)
  if (CODIGOS_AGUARDANDO_SERVIDOR.has(codigo)) return 'aguardando-servidor'
  if (CODIGOS_AUTO_CURAVEL.has(codigo)) return 'auto-curavel'
  if (CODIGOS_BLOQUEANTE.has(codigo)) return 'bloqueante'

  // 5xx é servidor fora do ar / gateway — sempre passageiro.
  if (/^5\d\d$/.test(codigo)) return 'transitorio'
  // Classe 08 do Postgres = falha de conexão.
  if (codigo.startsWith('08')) return 'transitorio'

  const msg = (err instanceof Error ? err.message : typeof err === 'string' ? err : (err as { message?: unknown })?.message ?? '')
  const texto = String(msg).toLowerCase()
  if (/failed to fetch|networkerror|network error|load failed|fetch failed|econnreset|etimedout|enotfound/.test(texto)) return 'transitorio'
  if (/abort|timeout|tempo esgotado|signal is aborted/.test(texto)) return 'transitorio'
  // A recusa do soft delete (a linha continua visível depois do UPDATE) é quase sempre papel.
  if (/não foi aceita pelo servidor/.test(texto)) return 'bloqueante'

  return 'bloqueante'
}

/**
 * Espera até a próxima tentativa, em ms. Cresce, mas nunca deixa de existir uma próxima.
 *
 * `transitorio` tem teto próprio e baixo (1min): quem está sem rede não deve esperar meia hora
 * depois que a rede volta — e, de todo modo, o retorno da rede dispara o flush na hora.
 */
const ESCADA_MS = [5_000, 15_000, 45_000, 120_000, 300_000, 900_000]
const TETO_MS = 1_800_000        // 30min
const TETO_TRANSITORIO_MS = 60_000

export function esperaBackoff(falhas: number, classe: ClasseErroSync): number {
  const base = ESCADA_MS[Math.min(Math.max(falhas, 1) - 1, ESCADA_MS.length - 1)] ?? TETO_MS
  const teto = classe === 'transitorio' ? TETO_TRANSITORIO_MS : TETO_MS
  const alvo = Math.min(falhas > ESCADA_MS.length ? TETO_MS : base, teto)
  // Jitter de ±20% para 40 abas não baterem no servidor no mesmo milissegundo.
  return Math.round(alvo * (0.8 + Math.random() * 0.4))
}

/**
 * A partir de quantas falhas um problema BLOQUEANTE pode virar aviso na tela. Com a escada acima
 * dá mais de uma hora tentando antes de incomodar alguém — que é o combinado: o sistema se vira
 * sozinho e só fala quando de fato precisa de uma decisão humana.
 */
export const FALHAS_ATE_AVISAR = 8

export interface AgendamentoOp {
  falhas:           number
  proximaTentativa: number     // epoch ms
  classe:           ClasseErroSync
  motivo:           string
}

/**
 * Agenda das ops que falharam, viva enquanto a aba estiver aberta.
 *
 * Mora aqui, e não dentro da `PendingOp` persistida, de propósito: recarregar a página zera a
 * espera e tudo é tentado de novo na hora. É exatamente o que se quer de um destravamento — o
 * usuário abre o app e as pendências sobem sozinhas, sem refazer nada e sem clicar em nada.
 */
const agenda = new Map<string, AgendamentoOp>()

/**
 * Ops que pertencem a OUTRA organização e estão esperando você voltar para ela.
 *
 * Elas saem da rodada (mandá-las com a sessão errada seria pior — a RLS rejeitaria, ou o `fixOrg`
 * carimbaria a organização errada), mas **não entram em `completed` nem em `errored`**, então os
 * stores nunca as removem da fila. Isso está certo: o dado não pode ser perdido.
 *
 * O que estava errado era o silêncio. Elas contavam como "pendente" no indicador global, que
 * ficava eternamente em "Enviando para a nuvem…" com o ícone girando — sem horário, sem
 * classificação, sem aviso, sem rótulo no painel. Este registro existe para o indicador poder
 * dizer o que elas são.
 */
const estacionadas = new Map<string, { orgId: string; table: string }>()

/** Ids das ops paradas por serem de outra organização. */
export function opsEstacionadas(): Array<{ opId: string; orgId: string; table: string }> {
  return [...estacionadas].map(([opId, v]) => ({ opId, ...v }))
}

/** Quantas ops estão só esperando o horário do backoff (não estão em voo, não estão travadas). */
export function opsEsperando(): number {
  const agora = Date.now()
  let n = 0
  for (const a of agenda.values()) if (a.proximaTentativa > agora) n++
  return n
}

/** Quando a próxima op vence, em epoch ms. `null` se não há nada agendado. */
export function proximoVencimento(): number | null {
  let menor: number | null = null
  for (const a of agenda.values()) {
    if (menor == null || a.proximaTentativa < menor) menor = a.proximaTentativa
  }
  return menor
}

/** Ops bloqueadas há tempo bastante para merecerem um aviso. */
export function opsQuePedemAtencao(): Array<{ opId: string } & AgendamentoOp> {
  const out: Array<{ opId: string } & AgendamentoOp> = []
  for (const [opId, a] of agenda) {
    if (a.classe === 'bloqueante' && a.falhas >= FALHAS_ATE_AVISAR) out.push({ opId, ...a })
  }
  return out
}

/** Consulta a agenda de uma op (para a tela de histórico). */
export function agendamentoDaOp(opId: string): AgendamentoOp | undefined {
  return agenda.get(opId)
}

/**
 * Manda tentar tudo agora, ignorando a espera. É o que um "reenviar" de verdade faz — ao
 * contrário do antigo "Tentar novamente", que caía no mesmo filtro que já havia excluído as ops
 * da rodada e voltava sem ter feito nada.
 */
export function destravarAgenda(): void {
  for (const a of agenda.values()) a.proximaTentativa = 0
}

function rowCount(data: unknown): number {
  return Array.isArray(data) ? data.length : data ? 1 : 0
}

function assertAffectedRows(table: string, op: PendingOp, data: unknown) {
  if (rowCount(data) > 0) return
  throw new Error(`Nenhuma linha confirmada em ${table} para ${op.type} ${op.recordId}. Verifique RLS, organização ativa ou se o registro ainda existe.`)
}

function softDeleteRpcFor(op: PendingOp): 'soft_delete_suprimentos_deposito' | 'soft_delete_suprimentos_estoque_item' | null {
  if (op.type !== 'update' || !op.patch?.deleted_at) return null
  if (op.table === 'suprimentos_depositos') return 'soft_delete_suprimentos_deposito'
  if (op.table === 'suprimentos_estoque_itens') return 'soft_delete_suprimentos_estoque_item'
  return null
}

/**
 * Drena uma fila de pending ops contra o Supabase.
 * Retorna quais ops foram completadas (remover da fila) e quais erraram
 * (incrementar retry e manter na fila para nova tentativa).
 */
export async function flushQueue(queueEntrada: PendingOp[]): Promise<FlushResult> {
  let queue = queueEntrada
  const result: FlushResult = { completed: [], errored: [], esgotadas: [] }

  if (isNonProductionDataMode()) {
    return result
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return result
  }

  const { profile, user } = useAuth.getState()
  if (!profile || !user) {
    return result
  }

  const activeOrgId = profile.organization_id
  const activeUserId = user.id

  // Ops de OUTRA organização ficam estacionadas, nem enviadas nem perdidas.
  //
  // A fila mora no localStorage e sobrevive à troca de empresa. Mandá-las com a sessão atual seria
  // pior do que não mandar: a RLS rejeitaria (e a op giraria em falso) ou, no caso de um insert com
  // `organization_id` nulo, o `fixOrg` carimbaria a organização errada — dado de um cliente
  // aparecendo no outro. Alguns stores "resolviam" isso apagando a fila inteira na troca de
  // empresa, o que perdia o trabalho de quem só tinha trocado de aba. Aqui elas apenas esperam:
  // voltando para a organização de origem, sobem normalmente.
  const orgDaOp = (op: PendingOp): string | null => {
    const v = (op.row?.organization_id ?? op.patch?.organization_id)
    return typeof v === 'string' && v !== 'pending' ? v : null
  }
  const deOutraOrg = queue.filter((op) => { const o = orgDaOp(op); return o != null && o !== activeOrgId })
  if (deOutraOrg.length) {
    for (const op of deOutraOrg) estacionadas.set(op.id, { orgId: orgDaOp(op)!, table: op.table })
    queue = queue.filter((op) => { const o = orgDaOp(op); return o == null || o === activeOrgId })
    if (queue.length === 0) return result
  }
  // Op que voltou a ser da organização ativa deixa de estar estacionada.
  for (const op of queue) estacionadas.delete(op.id)

  // Ops que falharam há pouco esperam a vez — mas NUNCA saem da fila por contagem.
  //
  // Aqui ficava o teto de 5 tentativas, e ele era o defeito: passando dele, a op era removida da
  // rodada antes de qualquer requisição e nada jamais reduzia `retries`. Não era um descanso, era
  // uma sentença — e nenhuma correção posterior (migração aplicada, permissão concedida, conserto
  // no código) conseguia mais alcançar o dado. Agora o critério é HORÁRIO: toda op volta, sempre;
  // o que muda é quando.
  const agora = Date.now()
  const adiadas = queue.filter((op) => {
    const a = agenda.get(op.id)
    return a != null && a.proximaTentativa > agora
  })
  if (adiadas.length) {
    result.esgotadas = adiadas.map((op) => op.id)
    queue = queue.filter((op) => {
      const a = agenda.get(op.id)
      return a == null || a.proximaTentativa <= agora
    })
    if (queue.length === 0) return result
  }

  // Coage colunas terminadas em `_id` com string vazia para null: '' nunca é um uuid
  // válido e o Postgres rejeitaria o insert/update ("invalid input syntax for type uuid"),
  // deixando a op presa em pendingSync. Defesa geral (ex.: funcionário sem equipe → crew_id '').
  const sanitizeIds = (obj: Record<string, unknown>) => {
    let out = obj
    for (const k of Object.keys(obj)) {
      if (k.endsWith('_id') && obj[k] === '') {
        if (out === obj) out = { ...obj }
        out[k] = null
      }
    }
    return out
  }

  // Recupera ops enfileiradas antes do perfil/usuário carregar (organization_id/created_by
  // 'pending') e sanitiza colunas *_id vazias. Sem reparar created_by, a RLS
  // `created_by = auth.uid()` rejeita o insert e a op fica presa para sempre.
  const fixOrg = (row: Record<string, unknown>) => {
    const patch: Record<string, unknown> = {}
    if (row.organization_id === 'pending' || row.organization_id == null) patch.organization_id = activeOrgId
    // `created_by` é reparado em TRÊS casos, não só no 'pending':
    //
    //  - 'pending' ou nulo: op enfileirada antes de o perfil carregar;
    //  - **uuid de OUTRO usuário**: a fila mora no localStorage e a limpeza de cache é por
    //    ORGANIZAÇÃO, nunca por usuário. Alguém cria registros, sai, outra pessoa entra na mesma
    //    empresa no mesmo navegador — e a fila da primeira é drenada com a sessão da segunda.
    //    A RLS exige `created_by = auth.uid()`, então o insert é rejeitado e a op fica presa
    //    PARA SEMPRE. Antes deste reparo, esse dado nunca chegava ao servidor.
    //
    // Atribuir a autoria a quem está sincronizando é uma imprecisão pequena e assumida; a
    // alternativa é perder o registro, que é pior. Quem de fato criou continua no payload.
    if (row.created_by === 'pending' || row.created_by == null || row.created_by !== activeUserId) {
      patch.created_by = activeUserId
    }
    const out = Object.keys(patch).length ? { ...row, ...patch } : row
    return sanitizeIds(out)
  }

  const markOk = (op: PendingOp) => { agenda.delete(op.id); estacionadas.delete(op.id); result.completed.push(op.id) }
  // Erros do Supabase são objetos simples ({message,details,hint,code}), não Error —
  // String() neles daria "[object Object]". Extrai sempre uma mensagem legível.
  const errMessage = (e: unknown): string => {
    if (e instanceof Error) return e.message
    if (Array.isArray(e)) return e.map(errMessage).filter(Boolean).join(' | ') || 'Erro'
    if (e && typeof e === 'object') {
      const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown; error?: unknown }
      const parts = [o.message, o.details, o.hint].filter(Boolean).map(String)
      if (parts.length) return parts.join(' — ')
      if (o.error != null) return errMessage(o.error)   // wrappers { error: {...} }
      if (o.code) return `Erro ${String(o.code)}`
      try { return JSON.stringify(e) } catch { return 'Erro desconhecido' }
    }
    return String(e)
  }
  const markErr = (op: PendingOp, err: unknown) => {
    const msg = errMessage(err)
    const classe = classificarErroSync(err)

    // 23505 num insert quer dizer que a linha JÁ ESTÁ no servidor por outra chave única (o nosso
    // insert é upsert on id, então não é o id que colidiu — é um índice de negócio, como o
    // (rotina_id, periodo) das execuções de rotina). O objetivo da op já está cumprido: registrar
    // como sucesso é o certo. Insistir só produziria o mesmo erro para sempre.
    if (classe === 'auto-curavel' && codigoDoErro(err) === '23505') {
      console.info(`[sync:${op.table}] ${op.type} ${op.recordId} já existia no servidor — considerado sincronizado.`)
      markOk(op)
      return
    }

    const anterior = agenda.get(op.id)
    // Falha passageira não gasta orçamento: rede ruim não pode condenar dado bom.
    const falhas = classe === 'transitorio' ? (anterior?.falhas ?? 0) : (anterior?.falhas ?? 0) + 1
    agenda.set(op.id, {
      falhas,
      proximaTentativa: Date.now() + esperaBackoff(Math.max(falhas, 1), classe),
      classe,
      motivo: msg,
    })

    console.warn(`[sync:${op.table}] op ${op.type} falhou (${classe}, ${falhas}x)`, op, msg)
    // Erro passageiro não vira `lastError`: ele não deve pintar a tela de vermelho enquanto o
    // próprio sistema ainda está resolvendo. Só o que pede decisão humana escapa daqui.
    if (classe === 'bloqueante' && falhas >= FALHAS_ATE_AVISAR) result.lastError = msg
    result.errored.push(op.id)
  }

  // Executa UMA op (insert/update/delete) — lança em falha. Comportamento idêntico
  // ao anterior; é o caminho per-op usado tanto direto quanto no fallback do lote.
  async function applyOp(op: PendingOp) {
    if (op.type === 'insert' && op.row) {
      const { data, error } = await withAbort((signal) => supabase
        .from(op.table)
        .upsert(fixOrg(op.row as Record<string, unknown>) as never, { onConflict: 'id' })
        .select('id')
        .abortSignal(signal))
      if (error) throw error
      assertAffectedRows(op.table, op, data)
    } else if (op.type === 'update' && op.patch) {
      const softDeleteRpc = softDeleteRpcFor(op)
      // Soft-delete via UPDATE deleted_at: o RETURNING é filtrado pela RLS de SELECT
      // (deleted_at IS NULL) e volta 0 linhas MESMO no sucesso → não dá pra usar
      // .select()/assertAffectedRows (a op ficaria presa "para sempre", e o retry
      // após já-deletado casaria 0 linhas de novo). Confia só no erro; idempotente.
      const isSoftDelete = !softDeleteRpc && op.patch.deleted_at != null
      if (softDeleteRpc) {
        const { error } = await withAbort((signal) => supabase.rpc(softDeleteRpc, { p_id: op.recordId }).abortSignal(signal))
        if (error) throw error
      } else if (isSoftDelete) {
        const { error } = await withAbort((signal) => supabase
          .from(op.table)
          .update(sanitizeIds(op.patch as Record<string, unknown>) as never)
          .eq('id', op.recordId)
          .eq('organization_id', activeOrgId)
          .abortSignal(signal))
        if (error) throw error

        // CONFERE se apagou de verdade — olhando o `deleted_at`, não a visibilidade.
        //
        // Sem erro NÃO significa sucesso: quando o `USING` da policy de UPDATE não casa, o
        // Postgres devolve "0 linhas atualizadas" sem erro nenhum. O registro sumia da tela, o
        // servidor continuava intacto, e ele reaparecia no próximo pull, sem aviso.
        //
        // A versão anterior desta conferência perguntava "a linha ainda está visível?", apostando
        // que a policy de SELECT filtra `deleted_at is null`. A migração 20260824130000 tira
        // justamente esse filtro de 18 tabelas — porque ele era o que IMPEDIA o soft delete (o
        // Postgres recusa um UPDATE que torne a linha invisível para o próprio SELECT: "new row
        // violates row-level security policy"). Com o filtro fora, "ainda visível" passou a ser o
        // estado NORMAL de um registro apagado, e a pergunta antiga daria falso positivo eterno.
        //
        // Perguntar pelo `deleted_at` funciona nos dois mundos: com ou sem filtro no SELECT.
        const { data: conferido } = await withAbort((signal) => supabase
          .from(op.table)
          .select('deleted_at')
          .eq('id', op.recordId)
          .eq('organization_id', activeOrgId)
          .abortSignal(signal))
        const linhas = Array.isArray(conferido) ? conferido : conferido ? [conferido] : []
        // Nenhuma linha = apagada de vez ou já não existia (e o delete é idempotente): sucesso.
        // Linha com `deleted_at` preenchido: sucesso. Linha com `deleted_at` nulo: não pegou.
        const naoPegou = linhas.some((r) => (r as { deleted_at?: string | null })?.deleted_at == null)
        if (naoPegou) {
          throw new Error(
            `A exclusão em ${op.table} não foi aceita pelo servidor: o registro continua lá. `
            + 'Normalmente é permissão — o seu papel não autoriza esta exclusão.',
          )
        }
      } else {
        const { data, error } = await withAbort((signal) => supabase
          .from(op.table)
          .update(sanitizeIds(op.patch as Record<string, unknown>) as never)
          .eq('id', op.recordId)
          .eq('organization_id', activeOrgId)
          .select('id')
          .abortSignal(signal))
        if (error) throw error
        assertAffectedRows(op.table, op, data)
      }
    } else if (op.type === 'delete') {
      if (op.approvalActionType) {
        // Op LEGADA: nenhum store cria mais isto (24/08/2026). O caminho antigo chamava
        // `request_action`, que só INSERE uma linha em `pending_actions` — nunca aplicou nada ao
        // registro. Reenviar seria condenar a op a girar para sempre: o pedido nasce numa fila sem
        // link em menu nenhum e o servidor proíbe o próprio autor de aprovar, então numa empresa de
        // conta única ninguém pode. Sai da fila com aviso no console. Nada é perdido que algum dia
        // fosse ser salvo — refazer a ação agora grava de verdade.
        console.warn(
          `[sync:${op.table}] op de aprovação legada descartada (${op.approvalActionType}, registro `
          + `${op.recordId}). Ela nunca chegou a alterar nada no servidor. Refaça a ação: agora salva.`,
        )
        return
      }
      {
        // DELETE é idempotente: 0 linhas afetadas significa que o registro já não
        // existe (ex.: apagado em outro dispositivo) — isso é SUCESSO, não erro.
        // Não usa assertAffectedRows porque prenderia a op para sempre (todo retry
        // voltaria a casar 0 linhas) e, pior, bloquearia o pull da tabela (o guard
        // de pendingTables), deixando os dados obsoletos. Erros reais (RLS que
        // levanta exceção, rede) ainda vêm em `error` e disparam retry. Um delete
        // barrado por RLS que filtra silenciosamente (0 linhas) é reconciliado no
        // próximo pull, que traz a linha de volta — sem op presa.
        const { error } = await withAbort((signal) => supabase
          .from(op.table)
          .delete()
          .eq('id', op.recordId)
          .eq('organization_id', activeOrgId)
          .abortSignal(signal))
        if (error) throw error
      }
    }
  }

  // Coalescing create+delete SENSÍVEL À ORDEM: quando um registro tem insert/update
  // E exclusão acumulados na fila, a ÚLTIMA op decide o estado final:
  //  - termina em EXCLUSÃO (create→delete) → cancela os inserts/updates e roda só a
  //    exclusão (idempotente) → evita ressuscitar a linha.
  //  - termina em INSERT/UPDATE (delete→recria; ex.: rascunho→finaliza de novo com id
  //    determinístico) → cancela as exclusões e roda o insert/update final → evita
  //    perder um lançamento válido.
  // Cobre exclusão hard (type 'delete') e soft (update com deleted_at).
  const opKey = (o: PendingOp) => `${o.table}::${o.recordId}`
  const isDeleteIntent = (o: PendingOp) => o.type === 'delete' || (o.type === 'update' && o.patch?.deleted_at != null)
  const lastOp = new Map<string, PendingOp>()
  const hasDelete = new Set<string>()
  const hasNonDelete = new Set<string>()
  for (const op of queue) {
    const k = opKey(op)
    lastOp.set(k, op)   // sobrescreve → sobra a última op do registro (ordem da fila)
    if (isDeleteIntent(op)) hasDelete.add(k); else hasNonDelete.add(k)
  }
  const mixedKeys = new Set([...hasDelete].filter((k) => hasNonDelete.has(k)))
  const active: PendingOp[] = []
  for (const op of queue) {
    const k = opKey(op)
    if (!mixedKeys.has(k)) { active.push(op); continue }
    const last = lastOp.get(k)!
    // Termina em INSERT (upsert = linha completa) ou EXCLUSÃO → basta a ÚLTIMA op
    // (evita mandar duas linhas com o mesmo id no mesmo upsert). Se terminar em
    // UPDATE parcial (raro), preserva os inserts/updates na ordem e cancela só as
    // exclusões, para o update não rodar sobre linha inexistente.
    if (last.type === 'insert' || isDeleteIntent(last)) {
      if (op === last) active.push(op)
      else result.completed.push(op.id)
    } else {
      if (!isDeleteIntent(op)) active.push(op)
      else result.completed.push(op.id)
    }
  }

  // Despacha a fila preservando a ordem. Inserts CONSECUTIVOS na mesma tabela
  // viram UM upsert em lote (menos round-trips); se o lote falhar, cai pro
  // per-op para isolar a linha ruim e preservar o rastreio completed/errored.
  let i = 0
  while (i < active.length) {
    const op = active[i]
    if (op.type === 'insert' && op.row) {
      const group: PendingOp[] = []
      let j = i
      while (j < active.length && active[j].type === 'insert' && active[j].row && active[j].table === op.table) {
        group.push(active[j])
        j++
      }
      if (group.length === 1) {
        try { await applyOp(group[0]); markOk(group[0]) } catch (e) { markErr(group[0], e) }
      } else {
        try {
          const rows = group.map((g) => fixOrg(g.row as Record<string, unknown>))
          const { data, error } = await withAbort((signal) => supabase
            .from(op.table)
            .upsert(rows as never, { onConflict: 'id' })
            .select('id')
            .abortSignal(signal))
          if (error) throw error
          if (rowCount(data) < rows.length) {
            throw new Error(`Lote em ${op.table}: ${rowCount(data)}/${rows.length} confirmadas.`)
          }
          group.forEach(markOk)
        } catch {
          for (const g of group) {
            try { await applyOp(g); markOk(g) } catch (e) { markErr(g, e) }
          }
        }
      }
      i = j
    } else {
      try { await applyOp(op); markOk(op) } catch (e) { markErr(op, e) }
      i++
    }
  }

  return result
}

/**
 * Patch de campo (anti-clobber, Tier 1c): retorna só as colunas que mudaram
 * entre o row anterior e o novo (ambos mapeados pelo mesmo *ToRow do store).
 * Assim um update toca apenas o que o usuário mexeu — duas pessoas editando
 * campos diferentes do mesmo registro não sobrescrevem uma à outra.
 * Ignora id/organization_id/created_by; compara via JSON (cobre colunas jsonb).
 */
export function changedColumns(
  prevRow: Record<string, unknown>,
  nextRow: Record<string, unknown>,
): Record<string, unknown> {
  const skip = new Set(['id', 'organization_id', 'created_by'])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(nextRow)) {
    if (skip.has(k)) continue
    if (JSON.stringify(prevRow[k]) !== JSON.stringify(v)) out[k] = v
  }
  return out
}

/**
 * Serializador de `flush` — uma drenagem por vez, por store.
 *
 * Sem isto, N chamadas seguidas de `flush` (ex.: um laço que grava 12 parcelas de um carnê)
 * tiram N snapshots da MESMA fila e reenviam as mesmas ops: N(N+1)/2 requisições para uma
 * gravação só, e a primeira op mandada N vezes. Em rede de canteiro isso estoura o timeout
 * e realimenta a fila.
 *
 * Quem chega durante uma drenagem não é descartado: marca `rerun` e recebe a mesma promessa;
 * ao terminar, se ainda houver fila, drena de novo. Nunca rejeita — o estado de erro é
 * responsabilidade do `drain` de cada store (que o expõe em `syncStatus`/`syncError`).
 *
 * Uso: `const serializar = makeFlushSerializer()` no corpo da fábrica do store, e
 * `flush: async () => serializar(async () => { ...corpo... }, () => get().pendingSync.length)`.
 */
export function makeFlushSerializer() {
  let inFlight: Promise<void> | null = null
  let rerun = false
  return function serializar(drain: () => Promise<void>, pendentes: () => number): Promise<void> {
    if (inFlight) { rerun = true; return inFlight }
    inFlight = (async () => {
      try {
        do { rerun = false; await drain() } while (rerun && pendentes() > 0)
      } catch { /* o drain já registra o erro no estado do store */ }
      finally { inFlight = null }
    })()
    return inFlight
  }
}

/**
 * Helper para construir uma PendingOp consistente.
 */
export function makeOp(opts: Omit<PendingOp, 'id' | 'retries' | 'createdAt'>): PendingOp {
  return {
    ...opts,
    id:        crypto.randomUUID(),
    retries:   0,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Merge do pull que PRESERVA os registros com op pendente (Fase 5 — anti "congelamento").
 * O padrão antigo (`pendingTables.has(T) ? null : pull`) pulava a tabela INTEIRA quando havia
 * QUALQUER op pendente — então uma op presa congelava o pull daquela tabela para sempre e o
 * estado local divergia em silêncio. Aqui, em vez de pular tudo, atualizamos com o servidor
 * os registros SEM op pendente e MANTEMOS os COM op pendente (não-sincronizados) do local.
 *  - serverItems null/undefined (offline/erro/non-prod) → mantém o local inteiro.
 *  - nada pendente na tabela → server é a verdade.
 * Assim, uma op presa nunca mais congela o resto da tabela, e nenhum dado local não-sincronizado
 * é apagado por um pull.
 */
/**
 * Igual ao `mergePull`, mas para tabelas cuja identidade NÃO é um `id` no topo do objeto.
 *
 * Existe por causa do "congelamento de pull": três stores pulavam a tabela INTEIRA enquanto
 * houvesse qualquer op pendente nela, porque o `mergePull` não sabia casar o registro local com a
 * op. O efeito era o módulo parar de receber o que os colegas cadastravam, em silêncio. Aqui,
 * quem chama diz como se calcula a chave (ex.: `equipmentId`, ou `date_activityId`), e o merge
 * volta a funcionar: servidor manda nos registros sem op pendente, local manda nos que têm.
 */
export function mergePullPorChave<T>(
  serverItems: T[] | null | undefined,
  localItems: T[],
  pendingSync: PendingOp[],
  table: string,
  chave: (item: T) => string | undefined,
): T[] {
  if (!serverItems) return localItems
  const pendentes = new Set(pendingSync.filter((o) => o.table === table).map((o) => o.recordId))
  if (pendentes.size === 0) return serverItems
  const temOpPendente = (x: T) => {
    const k = chave(x)
    return k != null && pendentes.has(k)
  }
  return [
    ...serverItems.filter((x) => !temOpPendente(x)),
    ...localItems.filter(temOpPendente),
  ]
}

export function mergePull<T extends { id?: string }>(
  serverItems: T[] | null | undefined,
  localItems: T[],
  pendingSync: PendingOp[],
  table: string,
): T[] {
  if (!serverItems) return localItems
  const pendingIds = new Set(pendingSync.filter((o) => o.table === table).map((o) => o.recordId))
  if (pendingIds.size === 0) return serverItems
  return [
    ...serverItems.filter((x) => x.id == null || !pendingIds.has(x.id)),
    ...localItems.filter((x) => x.id != null && pendingIds.has(x.id)),
  ]
}

/**
 * Pull genérico — busca todas as linhas da tabela (filtradas por RLS) e
 * devolve o array. O store decide como mapear pra suas entidades em memória.
 */
export async function pullTable<TRow = unknown>(
  table: string,
  orderBy: { column: string; ascending?: boolean; activeOnly?: boolean } = { column: 'created_at', ascending: false, activeOnly: true },
): Promise<TRow[] | null> {
  if (isNonProductionDataMode()) return null
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  const { profile } = useAuth.getState()
  if (!profile) return null

  const activeOnly = orderBy.activeOnly ?? true
  let query = supabase
    .from(table)
    .select('*')
    .eq('organization_id', profile.organization_id)
  if (activeOnly) query = query.is('deleted_at', null)

  const { data, error } = await query.order(orderBy.column, { ascending: orderBy.ascending ?? false })

  if (error) {
    const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
    if (activeOnly && message.includes('deleted_at')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from(table)
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order(orderBy.column, { ascending: orderBy.ascending ?? false })
      if (!fallbackError) return (fallbackData ?? []) as TRow[]
    }
    console.warn(`[sync:${table}] pull failed`, error)
    return null
  }
  return (data ?? []) as TRow[]
}
