/**
 * "Quando foi a última vez que alguém trouxe a planilha?" — o registro de importação.
 *
 * ─── POR QUE É UM DOCUMENTO À PARTE ────────────────────────────────────────────
 * Nada no dado responde isso. `criadoEm` do plano é da PRIMEIRA importação (a reimportação o
 * preserva); `createdAt` do lançamento idem; `lastSyncedAt` é do Supabase, não da planilha. E
 * carimbar só nas linhas gravadas não serve: reimportar um arquivo SEM mudança não regrava linha
 * nenhuma — e a data não avançaria justamente no caso mais comum.
 *
 * Por isso vive em `app_state` (um jsonb por empresa e chave), via `pushBlob`/`pullBlob` — o mesmo
 * mecanismo que o Planejamento usa. Visível a todos da empresa, não só a quem importou.
 */
import { pushBlob, pullBlob } from '@/lib/blobSync'

export type TipoDeImportacao = 'caixa' | 'fcp'

export interface ImportacaoRegistrada {
  em: string
  por: string
  arquivo?: string
  /** Linhas gravadas (caixa) ou "plano criado/atualizado" (fcp). */
  linhas?: number
}

export type RegistroDeImportacoes = Partial<Record<TipoDeImportacao, ImportacaoRegistrada>>

export const CHAVE_IMPORTACOES = 'financeiro-importacoes'

/** Lê o registro da empresa. `null` = nunca importou (ou sem rede). */
export async function lerImportacoes(): Promise<RegistroDeImportacoes | null> {
  const r = await pullBlob<RegistroDeImportacoes>(CHAVE_IMPORTACOES)
  return r?.payload ?? null
}

/** Grava a importação de agora por cima da anterior do mesmo tipo. Falha em silêncio offline. */
export async function registrarImportacao(tipo: TipoDeImportacao, dados: Omit<ImportacaoRegistrada, 'em'>): Promise<void> {
  const atual = (await lerImportacoes()) ?? {}
  await pushBlob(CHAVE_IMPORTACOES, { ...atual, [tipo]: { ...dados, em: new Date().toISOString() } })
}

/** Tom do card: 14 dias sem planilha é atenção, 35 é grave. Nunca importou é "sem dado". */
export function tomDaImportacao(dias: number | null): 'ok' | 'atencao' | 'grave' | 'sem-dado' {
  if (dias === null) return 'sem-dado'
  if (dias >= 35) return 'grave'
  if (dias >= 14) return 'atencao'
  return 'ok'
}
