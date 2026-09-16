import type { ItemEstoque, MovimentacaoEstoque } from '@/types'
import { pullBlob, pushBlob } from '@/lib/blobSync'

export interface EstoqueImportChange {
  itemId: string
  before?: ItemEstoque
  after: ItemEstoque
  created: boolean
}

export interface EstoqueImportBatch {
  id: string
  filename: string
  depositoId: string
  createdAt: string
  revertedAt?: string
  changes: EstoqueImportChange[]
  movementIds: string[]
}

const KEY = 'suprimentos_importacoes_estoque'

export async function loadEstoqueImportBatches(): Promise<EstoqueImportBatch[]> {
  const row = await pullBlob<{ batches?: EstoqueImportBatch[] }>(KEY)
  return row?.payload.batches ?? []
}

export async function saveEstoqueImportBatches(batches: EstoqueImportBatch[]) {
  return pushBlob(KEY, { batches: batches.slice(0, 100) })
}

export function createEstoqueImportBatch(input: Omit<EstoqueImportBatch, 'id' | 'createdAt'>): EstoqueImportBatch {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
}

/** Só restaura uma linha se ninguém a editou desde o lote; conflitos exigem confirmação na UI. */
export function importRollbackConflicts(batch: EstoqueImportBatch, atuais: ItemEstoque[]) {
  const byId = new Map(atuais.map((item) => [item.id, item]))
  return batch.changes.filter((change) => {
    const atual = byId.get(change.itemId)
    return Boolean(atual && JSON.stringify(atual) !== JSON.stringify(change.after))
  })
}

export function movementsFromBatch(batch: EstoqueImportBatch, movements: MovimentacaoEstoque[]) {
  const ids = new Set(batch.movementIds)
  return movements.filter((movement) => ids.has(movement.id))
}
