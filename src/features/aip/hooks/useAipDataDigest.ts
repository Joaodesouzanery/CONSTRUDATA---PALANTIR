/**
 * useAipDataDigest
 * Reads the current state of all major Zustand stores and returns a
 * structured text summary to be injected as AI system context.
 */
import { useRdoStore } from '@/store/rdoStore'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useProjetosStore } from '@/store/projetosStore'

export function useAipDataDigest(): string {
  const rdos     = useRdoStore((s) => s.rdos)
  const reports  = useRelatorio360Store((s) => s.reports)
  const projects = useProjetosStore((s) => s.projects)

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
        `| Serviços: ${r.services.length} | Equipamentos: ${r.equipment.length} ` +
        `| Func. Diretos: ${r.funcionariosDiretos ?? 0} | Indiretos: ${r.funcionariosIndiretos ?? 0} ` +
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
      const activities = latestReport.activities ?? []
      const done  = activities.filter((a) => a.status === 'completed').length
      const total = activities.length
      lines.push(`Último relatório: ${latestDate} | Atividades: ${done}/${total} concluídas`)
    }
  }
  lines.push('')

  // ── Projetos ─────────────────────────────────────────────────────────────────
  lines.push(`## Projetos`)
  lines.push(`Total de projetos: ${projects.length}`)
  if (projects.length > 0) {
    projects.slice(0, 5).forEach((p) => {
      lines.push(
        `  - [${p.code}] ${p.name} | Status: ${p.status} ` +
        `| Início: ${p.startDate} | Fim previsto: ${p.endDate} ` +
        `| Gerente: ${p.manager}`
      )
    })
    if (projects.length > 5) lines.push(`  ... e mais ${projects.length - 5} projetos`)
  }
  lines.push('')

  lines.push(`---`)
  lines.push(`Data/hora da consulta: ${new Date().toLocaleString('pt-BR')}`)

  return lines.join('\n')
}
