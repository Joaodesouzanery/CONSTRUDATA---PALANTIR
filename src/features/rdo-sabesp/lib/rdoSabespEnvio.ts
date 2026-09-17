/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * rdoSabespEnvio.ts — mandar UM RDO Sabesp para o servidor, e reenviar o que ficou para trás.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────
 * Quando o envio falhava, o formulário gravava o RDO em localStorage com `_localOnly: true` e
 * avisava "RDO salvo localmente". Correto — mas **nada nunca mais tentava de novo**. Não há fila
 * (`pendingSync`), não há `flush`, não havia ouvinte de `online`. O aviso dizia "continuará
 * disponível neste navegador", e era literal: ficava ali até alguém limpar o cache do navegador,
 * trocar de aparelho, ou nunca.
 *
 * Todo o resto do sistema tem retry por design — a fila do `storeSync` nem teto de tentativas tem,
 * de propósito. Este módulo era a exceção.
 *
 * ⚠️ O QUE O REENVIO **NÃO** FAZ, e é preciso saber:
 * o `persist` do formulário, além de gravar a linha, vincula o empreiteiro (`contractorStore.linkRdo`),
 * amarra os anexos de auditoria e, num RDO finalizado, chama a RPC de medição. O reenvio aqui
 * refaz a LINHA e a RPC de medição — que são o dado e o dinheiro. O vínculo de empreiteiro e os
 * anexos continuam a cargo do formulário: um RDO recuperado pelo reenvio pode precisar ser aberto
 * e salvo de novo para recuperá-los. É melhor do que perder o RDO, e está dito em vez de escondido.
 */
import { supabase } from '@/lib/supabase'
import {
  isLocalRdoSabespId,
  readLocalRdoSabesp,
  removeLocalRdoSabesp,
  upsertLocalRdoSabesp,
  type LocalRdoSabespRecord,
} from './rdoSabespLocalStore'

/**
 * Colunas que só existem depois das migrações de "durable assets" e do parser.
 *
 * ⚠️ É a armadilha "coluna nova congela o sync" com um escape: o cliente roda antes do banco, e
 * sem esta segunda tentativa o RDO inteiro é recusado por causa de um campo acessório.
 */
function semColunasNovas(record: Record<string, any>) {
  const legacy = { ...record }
  for (const c of [
    'audit_attachments', 'planilha_foto_path', 'assinatura_empreiteira_path',
    'assinatura_consorcio_path', 'include_planilha_foto_no_pdf',
    'review_requested_at', 'review_delay_justification', 'review_status',
    'parser_status', 'parser_provider', 'parser_model', 'parser_result',
    'parser_error', 'parser_ran_at',
  ]) delete legacy[c]
  return legacy
}

export function ehErroDeColunaNova(error: any): boolean {
  const message = String(error?.message || error?.details || '')
  return /planilha_foto_path|assinatura_empreiteira_path|assinatura_consorcio_path|include_planilha_foto_no_pdf|parser_status|parser_provider|parser_model|parser_result|parser_error|parser_ran_at/i.test(message)
}

/** Campos que o servidor gera ou que não podem ser reescritos pelo cliente. */
function semCamposDoServidor(payload: Record<string, any>, ehUpdate: boolean) {
  const rest = { ...payload }
  for (const c of ['id', 'created_at', 'updated_at', 'audit_attachments',
    'review_requested_at', 'review_delay_justification', 'review_status']) delete rest[c]
  if (ehUpdate) { delete rest.created_by; delete rest.organization_id }
  return rest
}

/**
 * Grava a linha do RDO. `id` ausente ou local (`local-rdo-sabesp-…`) = insert; senão, update.
 *
 * Devolve `{ data, error }` no formato do supabase-js — é o que o formulário já esperava.
 */
export async function enviarLinhaRdoSabesp(payload: Record<string, any>, id?: string | null) {
  const ehUpdate = Boolean(id && !isLocalRdoSabespId(id))
  const rest = semCamposDoServidor(payload, ehUpdate)
  const tabela = () => supabase.from('rdo_sabesp' as any)

  let response = ehUpdate
    ? await tabela().update(rest).eq('id', id as string).select('*').single()
    : await tabela().insert(rest).select('*').single()

  if (response.error && ehErroDeColunaNova(response.error)) {
    response = ehUpdate
      ? await tabela().update(semColunasNovas(rest)).eq('id', id as string).select('*').single()
      : await tabela().insert(semColunasNovas(rest)).select('*').single()
  }
  return response
}

export interface ResultadoDoReenvio {
  tentados: number
  enviados: number
  falhas: number
}

/**
 * Reenvia tudo que ficou marcado como `_localOnly`.
 *
 * Idempotente e silencioso quando não há nada: pode ser chamado ao abrir o módulo e no `online`.
 * Um RDO que falha de novo continua marcado — nunca é descartado.
 */
export async function reenviarRdoSabespPendentes(): Promise<ResultadoDoReenvio> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { tentados: 0, enviados: 0, falhas: 0 }
  const pendentes = readLocalRdoSabesp(true).filter(
    (r: LocalRdoSabespRecord) => r._localOnly && !r.deleted_at,
  )
  let enviados = 0
  let falhas = 0

  for (const registro of pendentes) {
    const { _localOnly, _syncError, ...payload } = registro as Record<string, any>
    void _localOnly; void _syncError
    try {
      const { data, error } = await enviarLinhaRdoSabesp(payload, registro.id)
      if (error) throw error
      const salvo = (data as any) ?? { ...payload, id: registro.id }
      // O id muda quando o registro nasceu offline (`local-rdo-sabesp-…` → uuid do servidor).
      if (salvo.id && salvo.id !== registro.id) removeLocalRdoSabesp(registro.id)
      upsertLocalRdoSabesp({ ...salvo, _localOnly: false, _syncError: null })
      // Finalizado precisa chegar à Medição — é a metade do envio que vira dinheiro.
      if (salvo.status === 'finalized' && salvo.id) {
        const { error: erroMedicao } = await (supabase as any)
          .rpc('sync_rdo_sabesp_to_measurement', { p_rdo_id: salvo.id })
        if (erroMedicao) console.warn('[rdo-sabesp] reenvio: medição não sincronizou', erroMedicao)
      }
      enviados++
    } catch (error: any) {
      // Continua pendente, com o motivo atualizado. Nunca descarta.
      upsertLocalRdoSabesp({ ...registro, _localOnly: true, _syncError: error?.message || String(error) })
      falhas++
    }
  }
  return { tentados: pendentes.length, enviados, falhas }
}
