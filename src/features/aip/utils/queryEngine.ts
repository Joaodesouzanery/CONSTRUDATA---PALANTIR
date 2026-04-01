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
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'

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
function getEquipOrders() { return useGestaoEquipamentosStore.getState().orders }
function getSuprimentos() {
  const s = useSuprimentosStore.getState()
  return {
    purchaseOrders: s.purchaseOrders ?? [],
    requisitions:   s.requisitions   ?? [],
    estoqueItens:   s.estoqueItens   ?? [],
  }
}
function getQuantitativos() { return useQuantitativosStore.getState().currentItems ?? [] }
function getMasterActivities() { return usePlanejamentoMestreStore.getState().activities ?? [] }

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

function handleEquipamentos(): string {
  const orders = getEquipOrders()
  if (orders.length === 0) return 'Nenhuma ordem de manutenção registrada.'
  const inProgress = orders.filter((o) => o.status === 'in_progress')
  const scheduled  = orders.filter((o) => o.status === 'scheduled')
  const recent     = [...orders].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 5)
  return (
    `🔩 **Gestão de Equipamentos:**\n\n` +
    `• Total de ordens: ${orders.length}\n` +
    `• Em andamento: ${inProgress.length}\n` +
    `• Agendadas: ${scheduled.length}\n\n` +
    `Próximas ordens:\n` +
    bullet(recent.map((o) => `[${o.type.toUpperCase()}] ${o.equipmentId} — ${o.description.slice(0, 60)} (${o.status})`))
  )
}

function handleMateriais(): string {
  const { purchaseOrders, requisitions, estoqueItens } = getSuprimentos()
  const openPOs    = purchaseOrders.filter((p) => p.status === 'open')
  const partialPOs = purchaseOrders.filter((p) => p.status === 'partial')
  const recentReqs = requisitions.slice(0, 5)
  return (
    `📦 **Suprimentos / Materiais:**\n\n` +
    `• Ordens de compra: ${purchaseOrders.length} (${openPOs.length} abertas, ${partialPOs.length} parciais)\n` +
    `• Requisições: ${requisitions.length}\n` +
    `• Itens em estoque: ${estoqueItens.length}\n\n` +
    (openPOs.length > 0
      ? `POs abertas:\n` + bullet(openPOs.slice(0, 5).map((p) =>
          `${p.code} — ${p.supplier} | Entrega: ${p.expectedDelivery}`
        ))
      : (recentReqs.length > 0
          ? `Requisições:\n` + bullet(recentReqs.map((r) => `${r.status} — ${r.id?.slice(0, 8)}`))
          : '✅ Nenhuma PO aberta no momento.')
    )
  )
}

function handleOrcamento(): string {
  const items = getQuantitativos()
  if (items.length === 0) return 'Nenhum item orçado registrado.'
  const total = items.reduce((s, i) => s + (i.totalCost ?? 0), 0)
  const byType = items.reduce((acc, i) => {
    const t = i.unit ?? 'outro'
    acc[t] = (acc[t] ?? 0) + (i.totalCost ?? 0)
    return acc
  }, {} as Record<string, number>)
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 4)
  return (
    `💰 **Orçamento / Quantitativos:**\n\n` +
    `• Total de itens: ${items.length}\n` +
    `• Custo total orçado: R$ ${total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}\n\n` +
    `Por unidade (top 4):\n` +
    bullet(topTypes.map(([u, v]) => `${u}: R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`))
  )
}

function handleCronograma(): string {
  const acts = getMasterActivities()
  if (acts.length === 0) return 'Nenhuma atividade no Planejamento Mestre.'
  const delayed   = acts.filter((a) => a.status === 'delayed')
  const inProgress = acts.filter((a) => a.status === 'in_progress')
  const critical  = acts.filter((a) => a.isCritical)
  const avgComplete = acts.length > 0
    ? Math.round(acts.reduce((s, a) => s + a.percentComplete, 0) / acts.length)
    : 0
  return (
    `📅 **Cronograma / Planejamento Mestre:**\n\n` +
    `• Total de atividades: ${acts.length}\n` +
    `• Em andamento: ${inProgress.length}\n` +
    `• Atrasadas: ${delayed.length}${delayed.length > 0 ? ' ⚠️' : ' ✅'}\n` +
    `• Caminho crítico (CPM): ${critical.length} atividades\n` +
    `• Avanço médio: ${avgComplete}%\n\n` +
    (delayed.length > 0
      ? `Atividades atrasadas:\n` + bullet(delayed.slice(0, 4).map((a) => `${a.name} (${a.percentComplete}% concluído)`))
      : '')
  )
}

function handleResumo(): string {
  const rdos     = getRdos()
  const projects = getProjects()
  const sites    = getSites()
  const acts     = getMasterActivities()
  const orders   = getEquipOrders()
  const items    = getQuantitativos()
  const { purchaseOrders } = getSuprimentos()

  const activeProjects = projects.filter((p) => p.status === 'active').length
  const activeRisks    = sites.flatMap((s) => s.risks ?? []).filter((r) => r.status === 'active' || r.status === 'identified').length
  const criticalRisks  = sites.flatMap((s) => s.risks ?? []).filter((r) => (r.status === 'active' || r.status === 'identified') && (r.level === 'critical' || r.level === 'high')).length
  const delayedActs    = acts.filter((a) => a.status === 'delayed').length
  const openOrders     = orders.filter((o) => o.status === 'in_progress' || o.status === 'scheduled').length
  const pendingPOs     = purchaseOrders.filter((p) => p.status === 'open' || p.status === 'partial').length
  const totalBudget    = items.reduce((s, i) => s + (i.totalCost ?? 0), 0)

  return (
    `🏗️ **Visão Geral — CONSTRUDATA**\n\n` +
    `**Projetos:** ${projects.length} total | ${activeProjects} ativos\n` +
    `**RDOs:** ${rdos.length} registrados\n` +
    `**Cronograma:** ${acts.length} atividades | ${delayedActs} atrasadas\n` +
    `**Riscos:** ${activeRisks} ativos (${criticalRisks} críticos/altos)\n` +
    `**Equipamentos:** ${orders.length} ordens | ${openOrders} abertas\n` +
    `**Suprimentos:** ${purchaseOrders.length} POs | ${pendingPOs} pendentes\n` +
    `**Orçamento:** R$ ${totalBudget.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} (${items.length} itens)\n\n` +
    (criticalRisks > 0 ? `⚠️ Atenção: ${criticalRisks} risco(s) crítico(s)/alto(s) requerem ação.\n` : '') +
    (delayedActs > 0   ? `⏰ ${delayedActs} atividade(s) do cronograma com status "atrasado".\n` : '')
  )
}

function handleHelp(): string {
  return (
    `🤖 **AIP — Assistente de Dados CONSTRUDATA**\n\n` +
    `Posso responder perguntas sobre:\n\n` +
    bullet([
      '"resumo" / "visão geral" — painel de todos os módulos',
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
      '"equipamentos" / "manutenção" — ordens de manutenção',
      '"materiais" / "suprimentos" — POs e estoque',
      '"orçamento" / "custo" — itens orçados',
      '"cronograma" / "planejamento mestre" — atividades e CPM',
    ])
  )
}

// ─── Suggestion chips by intent ───────────────────────────────────────────────

const FOLLOW_UP: Record<string, string[]> = {
  rdo:        ['Clima dos últimos RDOs', 'Mão de obra no RDO', 'Serviços do último RDO'],
  clima:      ['Mão de obra no campo', 'Resumo geral'],
  manpower:   ['Contratos e OS', 'Projetos ativos'],
  contratos:  ['Projetos ativos', 'Riscos críticos'],
  projetos:   ['Cronograma e prazos', 'Riscos críticos'],
  ppc:        ['PPC do LPS', 'Riscos críticos'],
  lps:        ['PPC do Relatório 360', 'Cronograma mestre'],
  riscos:     ['Obras ativas', 'Resumo geral'],
  obras:      ['Riscos críticos', 'Projetos ativos'],
  servicos:   ['Mão de obra no RDO', 'Equipamentos'],
  equipamentos: ['Suprimentos e POs', 'Orçamento'],
  materiais:  ['Orçamento e custos', 'Equipamentos'],
  orcamento:  ['Suprimentos e POs', 'Cronograma mestre'],
  cronograma: ['Riscos críticos', 'PPC do LPS'],
  resumo:     ['Riscos críticos', 'PPC desta semana'],
}

function getSuggestions(intentKey: string): string[] {
  return FOLLOW_UP[intentKey] ?? ['Resumo geral', 'Riscos críticos']
}

// ─── Main query dispatcher ────────────────────────────────────────────────────

export interface QueryResult {
  text: string
  suggestions: string[]
}

export function queryLocal(input: string): string {
  return queryLocalFull(input).text
}

export function queryLocalFull(input: string): QueryResult {
  const i = input.trim()

  if (!i || has(i, 'ajuda', 'help', 'o que', 'como usar', 'comandos', 'perguntas'))
    return { text: handleHelp(), suggestions: ['Resumo geral', 'Riscos críticos', 'Quantos RDOs?'] }

  if (has(i, 'resumo', 'geral', 'overview', 'visao geral', 'dashboard', 'painel'))
    return { text: handleResumo(), suggestions: getSuggestions('resumo') }

  if (has(i, 'clima', 'tempo', 'chuva', 'sol', 'manha', 'tarde', 'noite'))
    return { text: handleClima(), suggestions: getSuggestions('clima') }

  if (has(i, 'mão de obra', 'mao de obra', 'equipe', 'funcionario', 'trabalhador', 'direto', 'indireto'))
    return { text: handleManpower(), suggestions: getSuggestions('manpower') }

  if (has(i, 'contrato', 'ordem de servico', 'empreiteira'))
    return { text: handleContratos(), suggestions: getSuggestions('contratos') }

  if (has(i, 'servico', 'serviço', 'atividade executada'))
    return { text: handleServicos(), suggestions: getSuggestions('servicos') }

  if (has(i, 'quantos rdo', 'total rdo', 'rdo total', 'rdo registrado'))
    return { text: handleRdoCount(), suggestions: getSuggestions('rdo') }

  if (has(i, 'ultimos rdo', 'recentes rdo', 'rdo recente'))
    return { text: handleRdoRecent(), suggestions: getSuggestions('rdo') }

  if (has(i, 'rdo'))
    return { text: handleRdoCount(), suggestions: getSuggestions('rdo') }

  if (has(i, 'ppc lps', 'lps ppc', 'lean ppc', 'lps'))
    return { text: handleLPSPPC(), suggestions: getSuggestions('lps') }

  if (has(i, 'ppc', 'percent plan', 'planejado concluido', 'performance'))
    return { text: handlePPC(), suggestions: getSuggestions('ppc') }

  if (has(i, 'risco', 'alerta', 'perigo'))
    return { text: handleRiscos(), suggestions: getSuggestions('riscos') }

  if (has(i, 'projeto', 'obras ativas'))
    return { text: handleProjetos(), suggestions: getSuggestions('projetos') }

  if (has(i, 'obra', 'torre', 'canteiro'))
    return { text: handleObras(), suggestions: getSuggestions('obras') }

  if (has(i, 'relatorio', 'report', 'status'))
    return { text: handlePPC(), suggestions: getSuggestions('ppc') }

  if (has(i, 'equipamento', 'maquina', 'frota', 'manutencao', 'veiculo', 'ordem de manutencao'))
    return { text: handleEquipamentos(), suggestions: getSuggestions('equipamentos') }

  if (has(i, 'material', 'estoque', 'suprimento', 'compra', 'po', 'purchase', 'requisicao', 'fornecedor'))
    return { text: handleMateriais(), suggestions: getSuggestions('materiais') }

  if (has(i, 'orcamento', 'custo', 'budget', 'bdi', 'valor', 'investimento', 'preco'))
    return { text: handleOrcamento(), suggestions: getSuggestions('orcamento') }

  if (has(i, 'cronograma', 'prazo', 'planejamento mestre', 'baseline', 'caminho critico', 'cpm'))
    return { text: handleCronograma(), suggestions: getSuggestions('cronograma') }

  // Fallback
  return {
    text: (
      `Não encontrei dados específicos para "${i}".\n\n` +
      `Tente perguntas como:\n` +
      `• "resumo geral"\n` +
      `• "quantos rdos temos?"\n` +
      `• "riscos críticos"\n` +
      `• "ppc desta semana"\n` +
      `• "equipamentos em manutenção"\n\n` +
      `Digite "ajuda" para ver todos os comandos disponíveis.`
    ),
    suggestions: ['Resumo geral', 'Riscos críticos', 'Ajuda'],
  }
}
