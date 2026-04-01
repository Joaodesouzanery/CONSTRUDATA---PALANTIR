/**
 * queryEngine.ts — Rule-based query engine for AIP (no external API required).
 * Parses user input, detects intent by keywords, and returns structured
 * responses built from live Zustand store data.
 */
import { useRdoStore } from '@/store/rdoStore'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useLpsStore } from '@/store/lpsStore'
import { useTorreStore } from '@/store/torreDeControleStore'

// ─── Normalise text for matching ─────────────────────────────────────────────

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
}

function has(input: string, ...terms: string[]) {
  const n = norm(input)
  return terms.some((t) => n.includes(norm(t)))
}

// ─── Data accessors ───────────────────────────────────────────────────────────

function getRdos() { return useRdoStore.getState().rdos }
function getProjects() { return useProjetosStore.getState().projects }
function getReports() { return useRelatorio360Store.getState().reports }
function getLpsActivities() { return useLpsStore.getState().activities }
function getSites() { return useTorreStore.getState().sites }

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('pt-BR')
  } catch {
    return d
  }
}

function bullet(items: string[]) {
  return items.map((i) => `• ${i}`).join('\n')
}

// ─── Intent handlers ─────────────────────────────────────────────────────────

function handleRdoCount(): string {
  const rdos = getRdos()
  if (rdos.length === 0) return 'Nenhum RDO registrado ainda.'
  const sorted = [...rdos].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  return (
    `📋 **Total de RDOs registrados: ${rdos.length}**\n\n` +
    `Mais recente: RDO #${latest.number} — ${formatDate(latest.date)}\n` +
    `Local: ${latest.local ?? '—'} | OS: ${latest.numeroOS ?? '—'}\n` +
    `Responsável: ${latest.responsible || '—'}`
  )
}

function handleRdoRecent(): string {
  const rdos = getRdos()
  if (rdos.length === 0) return 'Nenhum RDO registrado ainda.'
  const sorted = [...rdos].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  return (
    `📋 **Últimos ${sorted.length} RDOs:**\n\n` +
    bullet(sorted.map((r) =>
      `RDO #${r.number} | ${formatDate(r.date)} | ${r.local ?? '—'} | OS: ${r.numeroOS ?? '—'}`
    ))
  )
}

function handleClima(): string {
  const rdos = getRdos()
  if (rdos.length === 0) return 'Nenhum RDO registrado para verificar clima.'
  const sorted = [...rdos].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  return (
    `🌤️ **Condições climáticas (últimos 3 RDOs):**\n\n` +
    bullet(sorted.map((r) =>
      `${formatDate(r.date)}: Manhã: ${r.climaManha ?? '—'} | Tarde: ${r.climaTarde ?? '—'} | Noite: ${r.climaNoite ?? '—'}`
    ))
  )
}

function handleManpower(): string {
  const rdos = getRdos()
  if (rdos.length === 0) return 'Nenhum RDO com dados de mão de obra.'
  const sorted = [...rdos].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  const totalDiretos = sorted.slice(0, 5).reduce((s, r) => s + (r.funcionariosDiretos ?? 0), 0)
  const totalIndiretos = sorted.slice(0, 5).reduce((s, r) => s + (r.funcionariosIndiretos ?? 0), 0)
  return (
    `👷 **Mão de obra — RDO mais recente (${formatDate(latest.date)}):**\n\n` +
    `• Funcionários Diretos: ${latest.funcionariosDiretos ?? '—'}\n` +
    `• Funcionários Indiretos: ${latest.funcionariosIndiretos ?? '—'}\n` +
    `• Qtd. Equipamentos: ${latest.qtdEquipamentosFerramentas ?? '—'}\n\n` +
    `Média dos últimos 5 RDOs:\n` +
    `• Diretos: ~${Math.round(totalDiretos / Math.min(sorted.length, 5))}\n` +
    `• Indiretos: ~${Math.round(totalIndiretos / Math.min(sorted.length, 5))}`
  )
}

function handleContratos(): string {
  const rdos = getRdos()
  if (rdos.length === 0) return 'Nenhum RDO com dados de contrato.'
  const comContrato = rdos.filter((r) => r.numeroContrato && r.numeroContrato !== 'Não informado')
  if (comContrato.length === 0) return 'Nenhum RDO com número de contrato preenchido.'
  const unique = [...new Map(comContrato.map((r) => [r.numeroContrato, r])).values()].slice(0, 5)
  return (
    `📄 **Contratos nos RDOs:**\n\n` +
    bullet(unique.map((r) =>
      `Contrato: ${r.numeroContrato} | OS: ${r.numeroOS ?? '—'} | Empreiteira: ${r.nomeEmpreiteira ?? '—'}`
    ))
  )
}

function handleProjetos(): string {
  const projects = getProjects()
  if (projects.length === 0) return 'Nenhum projeto cadastrado.'
  const active = projects.filter((p) =>
    p.status === 'active' || p.status === 'planning'
  )
  const list = (active.length > 0 ? active : projects).slice(0, 6)
  return (
    `🏗️ **Projetos${active.length > 0 ? ' ativos' : ''}: ${list.length} de ${projects.length}**\n\n` +
    bullet(list.map((p) =>
      `[${p.code}] ${p.name} | ${p.status} | Gerente: ${p.manager}`
    ))
  )
}

function handlePPC(): string {
  const reports = getReports()
  const dates = Object.keys(reports).sort().reverse()
  if (dates.length === 0) return 'Nenhum relatório 360 registrado para calcular PPC.'
  const recent = dates.slice(0, 7).map((d) => {
    const rep = reports[d]
    const acts = rep.activities ?? []
    const done = acts.filter((a) => a.status === 'completed').length
    const total = acts.length
    const ppc = total > 0 ? Math.round((done / total) * 100) : 0
    return { d, done, total, ppc }
  })
  const avgPPC = Math.round(recent.reduce((s, r) => s + r.ppc, 0) / recent.length)
  const trend = avgPPC >= 70 ? '✅ Bom' : avgPPC >= 50 ? '⚠️ Atenção' : '🔴 Crítico'
  return (
    `📊 **PPC — Relatório 360 (últimos ${recent.length} dias):**\n\n` +
    bullet(recent.map((r) => `${formatDate(r.d)}: ${r.done}/${r.total} ativ. = **${r.ppc}%**`)) +
    `\n\nMédia: **${avgPPC}%** — ${trend}`
  )
}

function handleLPSPPC(): string {
  const activities = getLpsActivities()
  if (activities.length === 0) return 'Nenhuma atividade LPS registrada.'
  const now = new Date()
  const yr = now.getFullYear()
  const w = Math.ceil(((now.getTime() - new Date(yr, 0, 1).getTime()) / 86400000 + 1) / 7)
  const currentWeek = `${yr}-W${String(w).padStart(2, '0')}`
  const past = activities.filter((a) => a.week < currentWeek && a.planned).slice(-20)
  if (past.length === 0) return 'Nenhuma semana passada registrada no LPS.'
  const done = past.filter((a) => a.completed).length
  const ppc = Math.round((done / past.length) * 100)
  const trend = ppc >= 70 ? '✅ Bom' : ppc >= 50 ? '⚠️ Atenção' : '🔴 Crítico'
  return (
    `📐 **PPC LPS/Lean (últimas semanas):**\n\n` +
    `• Atividades avaliadas: ${past.length}\n` +
    `• Concluídas: ${done}\n` +
    `• PPC: **${ppc}%** — ${trend}`
  )
}

function handleRiscos(): string {
  const sites = getSites()
  const allRisks = sites.flatMap((s) =>
    (s.risks ?? []).map((r) => ({ site: s.name, ...r }))
  )
  const active = allRisks.filter((r) => r.status === 'active' || r.status === 'identified')
  if (active.length === 0) return '✅ Nenhum risco ativo identificado na Torre de Controle.'
  const critical = active.filter((r) => r.level === 'critical' || r.level === 'high')
  return (
    `⚠️ **Riscos ativos: ${active.length}** (${critical.length} críticos/altos)\n\n` +
    bullet(active.slice(0, 6).map((r) =>
      `[${r.level.toUpperCase()}] ${r.site} — ${r.title}`
    ))
  )
}

function handleObras(): string {
  const sites = getSites()
  if (sites.length === 0) return 'Nenhuma obra cadastrada na Torre de Controle.'
  const active = sites.filter((s) => s.status === 'active')
  return (
    `🏗️ **Obras na Torre de Controle: ${sites.length}** (${active.length} ativas)\n\n` +
    bullet(sites.slice(0, 6).map((s) =>
      `[${s.code}] ${s.name} | ${s.status} | ${s.city}/${s.state}`
    ))
  )
}

function handleServicos(): string {
  const rdos = getRdos()
  if (rdos.length === 0) return 'Nenhum RDO com serviços registrados.'
  const sorted = [...rdos].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  if (!latest.services || latest.services.length === 0) {
    return `RDO #${latest.number} (${formatDate(latest.date)}) não tem serviços detalhados.`
  }
  return (
    `🔧 **Serviços no RDO #${latest.number} (${formatDate(latest.date)}):**\n\n` +
    bullet(latest.services.slice(0, 8).map((s) => s.description || '—'))
  )
}

function handleHelp(): string {
  return (
    `🤖 **AIP — Assistente de Dados CONSTRUDATA**\n\n` +
    `Posso responder perguntas sobre:\n\n` +
    bullet([
      '"rdos" / "quantos rdos" — total e últimos RDOs',
      '"clima" / "tempo" — condições climáticas dos RDOs',
      '"mão de obra" / "equipe" — funcionários por RDO',
      '"contratos" / "OS" — contratos e ordens de serviço',
      '"projetos" / "obras ativas" — lista de projetos',
      '"ppc" — indicador PPC do Relatório 360',
      '"lps" — PPC do módulo LPS/Lean',
      '"riscos" — riscos ativos na Torre de Controle',
      '"serviços" — serviços do último RDO',
      '"obras" — obras na Torre de Controle',
    ])
  )
}

// ─── Main query dispatcher ────────────────────────────────────────────────────

export function queryLocal(input: string): string {
  const i = input.trim()
  if (!i) return handleHelp()

  if (has(i, 'ajuda', 'help', 'o que', 'como usar', 'comandos', 'perguntas'))
    return handleHelp()

  if (has(i, 'clima', 'tempo', 'chuva', 'sol', 'manha', 'tarde', 'noite'))
    return handleClima()

  if (has(i, 'mão de obra', 'mao de obra', 'equipe', 'funcionario', 'trabalhador', 'direto', 'indireto'))
    return handleManpower()

  if (has(i, 'contrato', 'ordem de servico', 'OS', 'empreiteira'))
    return handleContratos()

  if (has(i, 'servico', 'serviço', 'atividade executada'))
    return handleServicos()

  if (has(i, 'quantos rdo', 'total rdo', 'rdo total', 'rdo registrado'))
    return handleRdoCount()

  if (has(i, 'ultimos rdo', 'últimos rdo', 'recentes rdo', 'rdo recente'))
    return handleRdoRecent()

  if (has(i, 'rdo'))
    return handleRdoCount()

  if (has(i, 'ppc lps', 'lps ppc', 'lean ppc', 'lps'))
    return handleLPSPPC()

  if (has(i, 'ppc', 'percent plan', 'planejado concluido', 'performance'))
    return handlePPC()

  if (has(i, 'risco', 'alerta', 'critico', 'perigo'))
    return handleRiscos()

  if (has(i, 'projeto', 'ativo', 'em andamento', 'obras ativas'))
    return handleProjetos()

  if (has(i, 'obra', 'torre', 'canteiro'))
    return handleObras()

  if (has(i, 'relatorio', 'report', 'status'))
    return handlePPC()

  // Fallback
  return (
    `Não encontrei dados específicos para "${i}".\n\n` +
    `Tente perguntas como:\n` +
    `• "quantos rdos temos?"\n` +
    `• "qual o clima dos últimos rdos?"\n` +
    `• "projetos ativos"\n` +
    `• "riscos críticos"\n` +
    `• "ppc desta semana"\n\n` +
    `Digite "ajuda" para ver todos os comandos disponíveis.`
  )
}
