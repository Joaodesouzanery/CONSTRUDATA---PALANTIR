/**
 * useAipDataDigest
 * Reads the current state of all major Zustand stores and returns a
 * structured text summary used as AIP system context.
 */
import { useRdoStore } from '@/store/rdoStore'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'

export function useAipDataDigest(): string {
  const rdos       = useRdoStore((s) => s.rdos)
  const reports    = useRelatorio360Store((s) => s.reports)
  const projects   = useProjetosStore((s) => s.projects)
  const equipOrders = useGestaoEquipamentosStore((s) => s.orders)
  const masterActs  = usePlanejamentoMestreStore((s) => s.activities)

  const lines: string[] = []

  // ── RDO summary ──────────────────────────────────────────────────────────────
  lines.push(`## RDOs (Relatórios Diários de Obra)`)
  lines.push(`Total registrado: ${rdos.length}`)
  if (rdos.length > 0) {
    const latest = [...rdos].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    lines.push(`Últimos 3 RDOs:`)
    latest.forEach((r) => {
      lines.push(
        `  - RDO #${r.number} | ${r.date} | Responsável: ${r.responsible || '—'} ` +
        `| Local: ${r.local ?? '—'} | OS: ${r.numeroOS ?? '—'} ` +
        `| Serviços: ${r.services.length} | Func. Diretos: ${r.funcionariosDiretos ?? 0} ` +
        `| Clima M/T/N: ${r.climaManha ?? '—'}/${r.climaTarde ?? '—'}/${r.climaNoite ?? '—'}`
      )
    })
  }
  lines.push('')

  // ── Relatório 360 ────────────────────────────────────────────────────────────
  const reportDates = Object.keys(reports)
  lines.push(`## Relatório 360`)
  lines.push(`Dias registrados: ${reportDates.length}`)
  if (reportDates.length > 0) {
    const latestDate = [...reportDates].sort().reverse()[0]
    const latestReport = reports[latestDate]
    if (latestReport) {
      const acts  = latestReport.activities ?? []
      const done  = acts.filter((a) => a.status === 'completed').length
      const total = acts.length
      lines.push(`Último relatório: ${latestDate} | Atividades: ${done}/${total} concluídas`)
    }
  }
  lines.push('')

  // ── Projetos ─────────────────────────────────────────────────────────────────
  lines.push(`## Projetos`)
  lines.push(`Total: ${projects.length} | Ativos: ${projects.filter((p) => p.status === 'active').length}`)
  if (projects.length > 0) {
    projects.slice(0, 5).forEach((p) => {
      lines.push(
        `  - [${p.code}] ${p.name} | ${p.status} | Gerente: ${p.manager}`
      )
    })
  }
  lines.push('')

  // ── Equipamentos ─────────────────────────────────────────────────────────────
  lines.push(`## Gestão de Equipamentos`)
  const openOrders = equipOrders.filter((o) => o.status === 'in_progress' || o.status === 'scheduled')
  lines.push(`Total de ordens: ${equipOrders.length} | Em andamento/Agendadas: ${openOrders.length}`)
  if (openOrders.length > 0) {
    openOrders.slice(0, 3).forEach((o) => {
      lines.push(`  - ${o.equipmentId} | ${o.description ?? o.type ?? '—'} | ${o.status}`)
    })
  }
  lines.push('')

  // ── Planejamento Mestre ───────────────────────────────────────────────────────
  lines.push(`## Planejamento Mestre`)
  const delayed  = masterActs.filter((a) => a.status === 'delayed')
  const critical = masterActs.filter((a) => a.isCritical)
  lines.push(`Total: ${masterActs.length} atividades | Atrasadas: ${delayed.length} | Caminho crítico: ${critical.length}`)
  if (delayed.length > 0) {
    lines.push(`Atrasadas:`)
    delayed.slice(0, 3).forEach((a) => lines.push(`  - ${a.name} (${a.percentComplete}%)`))
  }
  lines.push('')

  lines.push(`---`)
  lines.push(`Consulta: ${new Date().toLocaleString('pt-BR')}`)

  return lines.join('\n')
}
