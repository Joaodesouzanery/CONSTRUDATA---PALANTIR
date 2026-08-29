/**
 * Auditoria — a tradução entre o `audit_log` do banco e o que a tela mostra.
 *
 * O gatilho `registrar_auditoria` (migração `20260829120000`) grava uma linha por criação, edição
 * e exclusão em toda tabela com `organization_id`. O que chega aqui é cru: `table_name` é o nome
 * da tabela, `action` é 'insert'/'update'/'delete', e `before`/`after` são o registro inteiro em
 * jsonb. Este arquivo é o que transforma isso em "Ana editou o RDO — Efetivo: 12 → 14".
 *
 * É de propósito que a parte difícil aqui seja PURA: `camposAlterados` e os rótulos não tocam em
 * rede nem em React, e por isso têm teste (`auditoria.test.ts`).
 */

// ─── De tabela para módulo ────────────────────────────────────────────────────
// O usuário não sabe o que é `labor_occurrences`. Ele sabe o que é Mão de Obra.
const MODULOS: Record<string, [modulo: string, registro: string]> = {
  agenda_tasks:                       ['Agenda', 'tarefa'],
  bim_projects:                       ['BIM', 'projeto'],
  bim_segments:                       ['BIM', 'segmento'],
  change_orders:                      ['Gestão 360', 'aditivo'],
  change_order_photos:                ['Gestão 360', 'foto de aditivo'],
  clt_settings:                       ['Mão de Obra', 'parâmetro CLT'],
  company_logos:                      ['Configurações', 'logo da empresa'],
  construction_sites:                 ['Torre de Controle', 'obra'],
  contractors:                        ['Empreiteiros', 'empreiteiro'],
  contractor_foremen:                 ['Empreiteiros', 'encarregado'],
  contractor_invoices:                ['Empreiteiros', 'nota do empreiteiro'],
  contractor_invoice_events:          ['Empreiteiros', 'evento de nota'],
  daily_report_photos:                ['Gestão 360', 'foto do relatório'],
  economy_baselines:                  ['Economia', 'linha de base'],
  economy_events:                     ['Economia', 'evento'],
  economy_reports:                    ['Economia', 'relatório'],
  economy_valuation_rules:            ['Economia', 'regra de valoração'],
  equipamentos:                       ['Equipamentos', 'equipamento'],
  equipamentos_manutencoes:           ['Equipamentos', 'manutenção'],
  evm_cost_accounts:                  ['Financeiro', 'conta de custo'],
  evm_measurements:                   ['Financeiro', 'medição'],
  evm_work_packages:                  ['Financeiro', 'pacote de trabalho'],
  financeiro_contratos:               ['Financeiro', 'contrato'],
  financeiro_distribuicoes:           ['Financeiro', 'distribuição'],
  financeiro_entries:                 ['Financeiro', 'lançamento'],
  financeiro_impostos_nf:             ['Financeiro', 'imposto de nota'],
  financeiro_orcamentos:              ['Financeiro', 'orçamento'],
  financeiro_titulos:                 ['Financeiro', 'título'],
  fleet_alerts:                       ['Frota', 'alerta'],
  fleet_drivers:                      ['Frota', 'motorista'],
  fleet_fines:                        ['Frota', 'multa'],
  fleet_fuel_records:                 ['Frota', 'abastecimento'],
  fleet_routes:                       ['Frota', 'rota'],
  fleet_schedules:                    ['Frota', 'agendamento'],
  fleet_service_orders:               ['Frota', 'ordem de serviço'],
  fleet_vehicle_maintenance:          ['Frota', 'manutenção de veículo'],
  fvs:                                ['Qualidade', 'FVS'],
  goods_receipts:                     ['Suprimentos', 'recebimento'],
  invitations:                        ['Membros', 'convite'],
  invoices:                           ['Suprimentos', 'nota fiscal'],
  labor_crews:                        ['Mão de Obra', 'equipe'],
  labor_occurrences:                  ['Mão de Obra', 'ocorrência'],
  lookahead_derived_activities:       ['Planejamento Mestre', 'atividade do lookahead'],
  lps_activities:                     ['Last Planner', 'atividade'],
  lps_restrictions:                   ['Last Planner', 'restrição'],
  lps_takt_zones:                     ['Last Planner', 'zona de takt'],
  maintenance_monitoring_points:      ['Manutenções', 'ponto de monitoramento'],
  maintenance_plans:                  ['Manutenções', 'plano'],
  maintenance_plan_assets:            ['Manutenções', 'ativo do plano'],
  maintenance_work_orders:            ['Manutenções', 'ordem de serviço'],
  maintenance_work_order_assets:      ['Manutenções', 'ativo da OS'],
  mapas_interativos:                  ['Mapa Interativo', 'mapa'],
  master_activities:                  ['Planejamento Mestre', 'atividade'],
  master_baselines:                   ['Planejamento Mestre', 'linha de base'],
  measurement_adjustments:            ['Medição', 'ajuste'],
  measurement_billing_boletins:       ['Medição', 'boletim de faturamento'],
  measurement_sources:                ['Medição', 'origem de medição'],
  memberships:                        ['Membros', 'vínculo'],
  obra_dias_sem_producao:             ['Torre de Controle', 'dia sem produção'],
  operacao_campo_days:                ['Operação de Campo', 'dia de campo'],
  organizations:                      ['Organização', 'organização'],
  otimizacao_buy_lease_analyses:      ['Otimização de Frota', 'análise comprar × alugar'],
  otimizacao_health_scores:           ['Otimização de Frota', 'índice de saúde'],
  otimizacao_routing_recommendations: ['Otimização de Frota', 'recomendação de rota'],
  pending_actions:                    ['Aprovações', 'solicitação'],
  plan_holidays:                      ['Planejamento', 'feriado'],
  plan_scenarios:                     ['Planejamento', 'cenário'],
  plan_teams:                         ['Planejamento', 'equipe'],
  plan_trechos:                       ['Planejamento', 'trecho'],
  plano_execucao:                     ['Plano de Execução', 'plano'],
  preconstrucao_sessions:             ['Pré-Construção', 'sessão'],
  predial_laudos:                     ['Predial', 'laudo'],
  profiles:                           ['Membros', 'pessoa'],
  projects:                           ['Projetos', 'projeto'],
  project_documents:                  ['Projetos', 'documento'],
  purchase_orders:                    ['Suprimentos', 'pedido de compra'],
  quality_non_conformities:           ['Qualidade', 'não conformidade'],
  quantitativos_budgets:              ['Quantitativos', 'orçamento'],
  quantitativos_custom_base:          ['Quantitativos', 'base própria'],
  rateio_consumo:                     ['Rateio de Consumo', 'rateio'],
  rdo:                                ['RDO', 'RDO'],
  rdo_contractor_links:               ['RDO', 'vínculo com empreiteiro'],
  rede_ativos:                        ['Rede 360', 'ativo'],
  rede_service_orders:                ['Rede 360', 'ordem de serviço'],
  rotinas:                            ['Rotinas', 'rotina'],
  rotina_execucoes:                   ['Rotinas', 'execução de rotina'],
  servicos:                           ['Serviços', 'serviço'],
  shifts:                             ['Mão de Obra', 'turno'],
  suppliers:                          ['Suprimentos', 'fornecedor'],
  suprimentos_depositos:              ['Suprimentos', 'depósito'],
  suprimentos_estoque_itens:          ['Suprimentos', 'item de estoque'],
  suprimentos_estoque_movimentacoes:  ['Suprimentos', 'movimentação de estoque'],
  timecards:                          ['Mão de Obra', 'apontamento'],
  user_routines:                      ['Minha Rotina', 'rotina do usuário'],
  veiculos:                           ['Frota', 'veículo'],
  workers:                            ['Mão de Obra', 'funcionário'],
  worker_absences:                    ['Mão de Obra', 'falta'],
  worker_assessments:                 ['Mão de Obra', 'avaliação'],
  work_posts:                         ['Mão de Obra', 'posto de trabalho'],
}

/**
 * Uma tabela que ainda não está no mapa vira o nome humanizado, não o nome cru — e nunca some da
 * tela. O gatilho é aplicado por varredura, então tabela nova começa a aparecer aqui sozinha; o
 * rótulo bonito é que precisa ser escrito à mão depois.
 */
export function humanizar(nome: string): string {
  const s = nome.replace(/_/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function rotuloDoModulo(tabela: string): string {
  return MODULOS[tabela]?.[0] ?? humanizar(tabela)
}

export function rotuloDoRegistro(tabela: string): string {
  return MODULOS[tabela]?.[1] ?? humanizar(tabela).toLowerCase()
}

/** Os módulos distintos, para alimentar o filtro sem repetir nome. */
export function modulosConhecidos(): Array<{ modulo: string; tabelas: string[] }> {
  const porModulo = new Map<string, string[]>()
  for (const [tabela, [modulo]] of Object.entries(MODULOS)) {
    const lista = porModulo.get(modulo) ?? []
    lista.push(tabela)
    porModulo.set(modulo, lista)
  }
  return [...porModulo.entries()]
    .map(([modulo, tabelas]) => ({ modulo, tabelas: tabelas.sort() }))
    .sort((a, b) => a.modulo.localeCompare(b.modulo, 'pt-BR'))
}

// ─── De ação para verbo ───────────────────────────────────────────────────────
// As quatro primeiras vêm do gatilho genérico. As demais já existiam no log, escritas pelas RPCs
// de aprovação, exportação e cadastro — e continuam aparecendo na mesma tela.
const ACOES: Record<string, [verbo: string, cor: string]> = {
  insert:                       ['Criou',             'criar'],
  update:                       ['Editou',            'editar'],
  delete:                       ['Excluiu',           'excluir'],
  restore:                      ['Restaurou',         'restaurar'],
  request_action:               ['Solicitou',         'editar'],
  approve_action:               ['Aprovou',           'criar'],
  approve_via_email:            ['Aprovou por e-mail','criar'],
  reject_action:                ['Recusou',           'excluir'],
  reject_via_email:             ['Recusou por e-mail','excluir'],
  export:                       ['Exportou dados',    'editar'],
  export_titular:               ['Exportou dados do titular', 'editar'],
  anonymize_titular:            ['Anonimizou titular','excluir'],
  signup:                       ['Cadastrou empresa', 'criar'],
  login:                        ['Entrou',            'editar'],
  invite_member:                ['Convidou',          'criar'],
  accept_invitation:            ['Aceitou convite',   'criar'],
  block_member:                 ['Bloqueou',          'excluir'],
  reactivate_member:            ['Reativou',          'restaurar'],
  change_member_role:           ['Mudou o papel',     'editar'],
  worker_absent:                ['Registrou falta',   'editar'],
  set_default_organization:     ['Trocou de empresa', 'editar'],
  global_set_default_organization: ['Trocou de empresa (admin)', 'editar'],
}

export function rotuloDaAcao(acao: string): string {
  return ACOES[acao]?.[0] ?? humanizar(acao)
}

export type CorDeAcao = 'criar' | 'editar' | 'excluir' | 'restaurar'

export function corDaAcao(acao: string): CorDeAcao {
  return (ACOES[acao]?.[1] as CorDeAcao) ?? 'editar'
}

export function acoesConhecidas(): Array<{ acao: string; rotulo: string }> {
  return Object.keys(ACOES).map((acao) => ({ acao, rotulo: rotuloDaAcao(acao) }))
}

// ─── O que de fato mudou ──────────────────────────────────────────────────────

/**
 * Campos que existem para o banco e não dizem nada a ninguém. Ficam de fora do "o que mudou"
 * porque, se entrarem, toda edição parece ter mexido em seis coisas.
 *
 * ⚠️ `updated_by` e `updated_at` são carimbos: o log já mostra QUEM e QUANDO no cabeçalho, então
 * repeti-los como "campo alterado" seria dizer duas vezes a mesma coisa.
 */
const CAMPOS_TECNICOS = new Set([
  'id', 'organization_id', 'created_at', 'created_by', 'updated_at', 'updated_by',
  'deleted_at', 'sync_version', 'search_vector',
])

const CAMPOS: Record<string, string> = {
  name: 'Nome', nome: 'Nome', status: 'Situação', descricao: 'Descrição', description: 'Descrição',
  valor: 'Valor', value: 'Valor', quantidade: 'Quantidade', quantity: 'Quantidade',
  data: 'Data', date: 'Data', obra_id: 'Obra', site_id: 'Obra', project_id: 'Projeto',
  worker_id: 'Funcionário', cargo: 'Cargo', role: 'Papel', email: 'E-mail',
  observacoes: 'Observações', notes: 'Observações', tipo: 'Tipo', type: 'Tipo',
  categoria: 'Categoria', category: 'Categoria', efetivo: 'Efetivo', hours: 'Horas',
}

export function rotuloDoCampo(campo: string): string {
  const semPrefixo = campo.replace(/^payload\./, '')
  return CAMPOS[semPrefixo] ?? humanizar(semPrefixo)
}

export interface MudancaDeCampo {
  campo: string
  rotulo: string
  antes: unknown
  depois: unknown
}

type Registro = Record<string, unknown> | null | undefined

/**
 * Compara os dois lados e devolve só o que mudou.
 *
 * ⚠️ Desce um nível dentro de `payload`, que é onde este projeto guarda quase todo o registro.
 * Sem isso, toda edição diria apenas "Payload mudou" — que é o mesmo que não dizer nada. O gatilho
 * já remove o `payload` dos dois lados quando ele NÃO mudou, então aqui ele só aparece quando
 * realmente há o que mostrar.
 */
export function camposAlterados(antes: Registro, depois: Registro): MudancaDeCampo[] {
  const achatar = (r: Registro): Record<string, unknown> => {
    const saida: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r ?? {})) {
      if (CAMPOS_TECNICOS.has(k)) continue
      if (k === 'payload' && v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
          if (!CAMPOS_TECNICOS.has(pk)) saida[`payload.${pk}`] = pv
        }
      } else {
        saida[k] = v
      }
    }
    return saida
  }

  const a = achatar(antes)
  const b = achatar(depois)
  const mudancas: MudancaDeCampo[] = []

  for (const campo of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const va = a[campo]
    const vb = b[campo]
    if (JSON.stringify(va ?? null) === JSON.stringify(vb ?? null)) continue
    mudancas.push({ campo, rotulo: rotuloDoCampo(campo), antes: va, depois: vb })
  }
  return mudancas
}

/** Um valor jsonb qualquer virando texto de tela — sem `[object Object]` e sem "undefined". */
export function valorLegivel(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') {
    // Data ISO vira data brasileira; o resto passa direto.
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+)?/.exec(v)
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
    return v.length > 120 ? `${v.slice(0, 117)}…` : v
  }
  if (Array.isArray(v)) return v.length === 0 ? '—' : `${v.length} item(ns)`
  const texto = JSON.stringify(v)
  return texto.length > 120 ? `${texto.slice(0, 117)}…` : texto
}
