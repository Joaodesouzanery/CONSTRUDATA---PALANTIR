/**
 * useActiveObra — leitura da obra ativa + helper de filtragem por obra.
 *
 * `byActiveObra` aceita `siteId` (convenção geral) ou `obraId` (Financeiro) —
 * mesmo valor (id do construction_site). Itens sem obra (nulo) só aparecem em
 * "Todas as obras" (activeObraId === null).
 */
import { useMemo } from 'react'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import type { ConstructionSite } from '@/types'

export function byActiveObra<T extends { siteId?: string | null; obraId?: string | null }>(
  list: T[],
  activeObraId: string | null,
): T[] {
  if (!activeObraId) return list
  return list.filter((x) => (x.siteId ?? x.obraId ?? null) === activeObraId)
}

export function useActiveObra(): {
  activeObraId: string | null
  activeSite: ConstructionSite | null
  isAllObras: boolean
} {
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)
  const activeSite = useMemo(
    () => (activeObraId ? sites.find((s) => s.id === activeObraId) ?? null : null),
    [activeObraId, sites],
  )
  return { activeObraId, activeSite, isAllObras: activeObraId === null }
}
