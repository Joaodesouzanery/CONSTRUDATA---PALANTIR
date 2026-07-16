/**
 * frentes.ts — opções de Frente/Depósito do estoque (depósitos criados + obras da Torre).
 * Compartilhado pelo form inline do Almoxarifado e pelo NovoMaterialModal.
 */
import type { DepositoVirtual, ConstructionSite } from '@/types'

export interface FrenteOption { value: string; label: string }

/** depósitos criados + obras da Torre ainda sem depósito próprio (como `site:<id>`). */
export function buildFrenteOptions(depositos: DepositoVirtual[], sites: ConstructionSite[]): FrenteOption[] {
  const opts: FrenteOption[] = []
  const depoSiteIds = new Set(depositos.map((d) => d.siteId).filter(Boolean))
  for (const dep of depositos) {
    const site = dep.siteId ? sites.find((s) => s.id === dep.siteId) : undefined
    opts.push({ value: dep.id, label: site ? `${dep.frente} · ${site.name}` : dep.frente })
  }
  for (const site of sites) {
    if (depoSiteIds.has(site.id)) continue
    opts.push({ value: `site:${site.id}`, label: `${site.name} (obra)` })
  }
  return opts
}

/** Resolve o valor do seletor para um depositoId real (find-or-create por obra da Torre). */
export function resolveFrenteDeposito(
  raw: string,
  depositos: DepositoVirtual[],
  sites: ConstructionSite[],
  addDeposito: (d: Omit<DepositoVirtual, 'id' | 'ativo'> & { ativo?: boolean }) => string,
): { id: string; siteId: string | null } {
  if (raw.startsWith('site:')) {
    const siteId = raw.slice(5)
    const existing = depositos.find((d) => d.siteId === siteId)
    if (existing) return { id: existing.id, siteId: existing.siteId ?? siteId }
    const site = sites.find((s) => s.id === siteId)
    const id = addDeposito({ frente: site?.name ?? 'Obra', descricao: 'Frente sincronizada da Torre de Controle', ativo: true, siteId })
    return { id, siteId }
  }
  const dep = depositos.find((d) => d.id === raw)
  return { id: raw, siteId: dep?.siteId ?? null }
}
