import { useState } from 'react'
import { Pencil, Plus, Trash2, AlertTriangle, MapPin, Building2, Users, Calendar, FileText, DollarSign, CalendarDays, CheckCircle2, Circle, Clock, Save, X, Archive, ArchiveRestore } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import { obraBacFromSite, withTotalBudgetLine, bacVemDoContrato } from '@/features/torre-de-controle/utils/obraBudget'
import { ContratoMedicaoSection } from './ContratoMedicaoSection'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { metragemContratada, precoMedioM2, valoresDoContrato } from '@/features/torre-de-controle/utils/obraMedicao'
import { formatarMetragem, temUnidadesMistas } from '@/lib/unidadesMedida'
import { obraEstaAtiva } from '@/lib/obraAtiva'
import type { ConstructionRisk, ConstructionSite, ObraStatus, RiskLevel, RiskStatus, MilestoneStatus, ConstructionMilestone, ConstructionBudgetLine } from '@/types'

const fmtBRL = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// ─── Área / Extensão ──────────────────────────────────────────────────────────
/**
 * A obra tem uma metragem geral, mas ela pode ser dividida por serviço — e é a divisão que
 * importa: cada parcela tem preço próprio e é ela que o RDO usa para cobrar o dia.
 *
 * Quando há serviços no contrato, a metragem vem deles. **Separada por unidade**: o contrato real
 * tem 18.605,01 m² de piso/parede/meio-fio e 6.962,01 m de demarcação, e somar as duas daria
 * 25.567,02 — metro quadrado com metro linear, um número que ninguém consegue conferir.
 *
 * Obra sem serviços cadastrados continua mostrando o campo digitado à mão, como sempre.
 */
function AreaExtensao({ site }: { site: ConstructionSite }) {
  const services = site.contrato?.services ?? []
  if (services.length === 0) {
    return <InfoRow label="Área / Extensão" value={`${site.totalArea.toLocaleString('pt-BR')} m²`} />
  }

  const m = metragemContratada(services)
  const medio = precoMedioM2(services)
  const divergeDoCadastro = site.totalArea > 0 && Math.abs(site.totalArea - m.area) > 1

  return (
    <div className="flex flex-col gap-0.5">
      <InfoRow label="Área / Extensão" value={formatarMetragem(m)} />
      <p className="text-[10px] leading-relaxed text-[#6b6b6b]">
        Somada de {services.length} serviço(s) do contrato
        {temUnidadesMistas(m) && ' — em parcelas, porque m² e metro linear não se somam'}
        {m.verbas > 0 && `. ${m.verbas} item(ns) de valor fechado, sem metragem`}.
      </p>
      {medio != null && (
        <p className="text-[10px] leading-relaxed text-[#6b6b6b]">
          Preço médio da área: {medio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })}/m²
          {' '}— é uma média, não o preço de nenhum serviço. Cada um tem o seu.
        </p>
      )}
      {divergeDoCadastro && (
        <p className="text-[10px] leading-relaxed text-[#fbbf24]">
          O cadastro da obra diz {site.totalArea.toLocaleString('pt-BR')} m², e os serviços somam
          {' '}{m.area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m². Vale conferir qual está certo.
        </p>
      )}
    </div>
  )
}

// ─── Orçamento do contrato (editável) ─────────────────────────────────────────
// Fonte do BAC por obra que o Planejamento consome. Grava/atualiza a linha 'Total'.
function OrcamentoEditor({ site }: { site: ConstructionSite }) {
  const updateSite = useTorreStore((s) => s.updateSite)
  const atual = obraBacFromSite(site)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  // Com contrato cadastrado, o valor vem DE LÁ e este campo só exibe. Eram três lugares para
  // digitar o mesmo número — aqui, no diálogo da obra e no contrato — sem nenhum aviso quando
  // discordavam. Editar em duplicata é o que criava a divergência; então a edição sai.
  if (bacVemDoContrato(site)) {
    const v = valoresDoContrato(site.contrato)
    return (
      <div className="mb-2 rounded-lg border border-[#525252] bg-[#333333] px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">Orçamento do contrato</p>
        <p className="mt-0.5 text-sm font-bold text-[#f59e0b]">{fmtBRL(atual)}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-[#6b6b6b]">
          {v.material > 0
            ? `Serviço ${fmtBRL(v.servico)} + material ${fmtBRL(v.material)}. `
            : ''}
          Vem de "Contrato &amp; Medição", abaixo — é lá que se edita.
        </p>
      </div>
    )
  }

  function open() { setVal(atual ? String(atual) : ''); setEditing(true) }
  function save() {
    const amount = parseLocaleNumber(val) || 0
    updateSite(site.id, { budgetLines: withTotalBudgetLine(site.budgetLines, amount) })
    setEditing(false)
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[#525252] bg-[#333333] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">Orçamento do contrato</p>
        {editing ? (
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            placeholder="Valor total do contrato (R$)"
            className="mt-1 w-full rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
          />
        ) : (
          <p className="mt-0.5 text-sm font-bold text-[#f59e0b]">{atual > 0 ? fmtBRL(atual) : 'Não definido'}</p>
        )}
      </div>
      {editing ? (
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={save} className="rounded-lg bg-[#f97316] px-2 py-1.5 text-white hover:bg-[#ea580c]" title="Salvar"><Save size={13} /></button>
          <button onClick={() => setEditing(false)} className="rounded-lg px-2 py-1.5 text-[#a3a3a3] hover:bg-[#3d3d3d]" title="Cancelar"><X size={13} /></button>
        </div>
      ) : (
        <button onClick={open} className="shrink-0 flex items-center gap-1 rounded-lg border border-[#525252] px-2.5 py-1.5 text-[10px] text-[#6b6b6b] hover:border-[#f97316]/30 hover:text-[#f97316]" title="Editar orçamento">
          <Pencil size={11} /> Editar
        </button>
      )}
    </div>
  )
}

// ─── Config ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ObraStatus, string> = {
  active:    'Ativa',
  planning:  'Planejamento',
  paused:    'Pausada',
  completed: 'Concluída',
}

const STATUS_COLOR: Record<ObraStatus, string> = {
  active:    'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20',
  planning:  'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20',
  paused:    'text-[#eab308] bg-[#eab308]/10 border-[#eab308]/20',
  completed: 'text-[#a3a3a3] bg-[#a3a3a3]/10 border-[#a3a3a3]/20',
}

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  low:      'Baixo',
}

const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  identified: 'Identificado',
  active:     'Ativo',
  mitigated:  'Mitigado',
  resolved:   'Resolvido',
}

// ─── Budget Table ───────────────────────────────────────────────────────────────

function fmtM(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `R$ ${(n / 1_000).toFixed(0)}k`
  return `R$ ${n}`
}

function BudgetTable({ lines }: { lines: ConstructionBudgetLine[] }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[260px] text-[10px]">
      <thead>
        <tr className="text-[#3f3f3f] uppercase tracking-wider">
          <th className="text-left pb-1 font-semibold">Categoria</th>
          <th className="text-right pb-1 font-semibold">Orçado</th>
          <th className="text-right pb-1 font-semibold">Projeção</th>
          <th className="text-right pb-1 font-semibold">Utiliz.</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => {
          const utilization = l.amount > 0 ? (l.projected / l.amount) * 100 : 0
          const over = utilization > 100
          return (
            <tr key={l.label} className="border-t border-[#3d3d3d]">
              <td className={cn('py-1 font-medium', l.label === 'Total' ? 'text-[#f5f5f5]' : 'text-[#a3a3a3]')}>
                {l.label}
              </td>
              <td className="py-1 text-right text-[#a3a3a3] font-mono">{fmtM(l.amount)}</td>
              <td className="py-1 text-right font-mono text-[#f5f5f5]">{fmtM(l.projected)}</td>
              <td className={cn('py-1 text-right font-mono font-bold', over ? 'text-[#ef4444]' : 'text-[#22c55e]')}>
                {utilization.toFixed(0)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table></div>
  )
}

// ─── Milestone Timeline ──────────────────────────────────────────────────────────────

const MILESTONE_ICON: Record<MilestoneStatus, React.ReactNode> = {
  done:    <CheckCircle2 size={11} className="text-[#22c55e] shrink-0" />,
  active:  <Clock        size={11} className="text-[#3b82f6] shrink-0" />,
  pending: <Circle       size={11} className="text-[#3f3f3f] shrink-0" />,
}

function MilestoneTimeline({ label, milestones }: { label: string; milestones: ConstructionMilestone[] }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-[9px] uppercase tracking-widest text-[#3f3f3f] font-semibold mb-1.5">{label}</p>
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {milestones.map((m, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center min-w-[72px]">
              {MILESTONE_ICON[m.status]}
              <span className={cn(
                'text-[9px] mt-0.5 text-center leading-tight',
                m.status === 'done' ? 'text-[#22c55e]' :
                m.status === 'active' ? 'text-[#3b82f6]' : 'text-[#4b5563]',
              )}>
                {m.name}
              </span>
              <span className="text-[8px] text-[#3f3f3f] font-mono mt-0.5">{m.date.slice(5)}</span>
            </div>
            {i < milestones.length - 1 && (
              <div className={cn(
                'h-px w-6 mb-4 shrink-0',
                m.status === 'done' ? 'bg-[#22c55e]/40' : 'bg-[#525252]',
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Risk Card ──────────────────────────────────────────────────────────────────

function RiskCard({ site, risk }: { site: ConstructionSite; risk: ConstructionRisk }) {
  const setEditingRisk  = useTorreStore((s) => s.setEditingRisk)
  const deleteRisk      = useTorreStore((s) => s.deleteRisk)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded]           = useState(false)

  const color = RISK_LEVEL_COLOR[risk.level]

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteRisk(site.id, risk.id)
    setConfirmDelete(false)
  }

  return (
    <div
      className="rounded-lg border bg-[#333333] p-3 flex flex-col gap-2"
      style={{ borderColor: color + '30' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ color, background: color + '15' }}
            >
              {RISK_LEVEL_LABEL[risk.level]}
            </span>
            <span className="text-[9px] text-[#6b6b6b] uppercase tracking-wide">
              {RISK_STATUS_LABEL[risk.status]}
            </span>
          </div>
          <span className="text-xs font-semibold text-[#f5f5f5] leading-snug">{risk.title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] font-semibold hover:bg-[#ef4444]/30"
              >
                Sim
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#484848] text-[#a3a3a3]"
              >
                Não
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditingRisk({ siteId: site.id, riskId: risk.id })}
                className="w-6 h-6 flex items-center justify-center rounded text-[#6b6b6b] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={handleDelete}
                className="w-6 h-6 flex items-center justify-center rounded text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] text-[#6b6b6b] text-left hover:text-[#a3a3a3] transition-colors"
      >
        {expanded ? risk.description : risk.description.slice(0, 90) + (risk.description.length > 90 ? '...' : '')}
        {risk.description.length > 90 && (
          <span className="ml-1 text-[#f97316]">{expanded ? '▲ menos' : '▼ mais'}</span>
        )}
      </button>

      {expanded && risk.notes && (
        <div className="text-[10px] text-[#6b6b6b] bg-[#484848] rounded p-2 border border-[#525252]">
          <span className="text-[9px] uppercase tracking-widest text-[#3f3f3f]">Notas: </span>
          {risk.notes}
        </div>
      )}

      <div className="text-[9px] text-[#3f3f3f]">
        Identificado: {new Date(risk.identifiedAt).toLocaleDateString('pt-BR')}
      </div>
    </div>
  )
}

// ─── Main Panel ────────────────────────────────────────────────────────────────────

export function ObraDetailPanel() {
  const sites          = useTorreStore((s) => s.sites)
  const selectedId     = useTorreStore((s) => s.selectedId)
  const setEditing     = useTorreStore((s) => s.setEditing)
  const setEditingRisk = useTorreStore((s) => s.setEditingRisk)

  const updateSiteTopo = useTorreStore((s) => s.updateSite)

  const site = selectedId ? sites.find((s) => s.id === selectedId) ?? null : null

  if (!site) return null

  const ativa = obraEstaAtiva(site)

  const activeRisks   = site.risks.filter((r) => r.status === 'active').length
  const criticalRisks = site.risks.filter((r) => r.level === 'critical').length

  return (
    <div
      className="flex flex-col bg-[#333333] overflow-hidden w-full lg:border-l-0 border-l border-[#525252]"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#525252] shrink-0 gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] text-[#6b6b6b] bg-[#484848] px-1.5 py-0.5 rounded">{site.code}</span>
            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide', STATUS_COLOR[site.status])}>
              {STATUS_LABEL[site.status]}
            </span>
            {/* O selo de arquivada é SEPARADO do status, de propósito: a obra continua sendo
                "Concluída" ou "Pausada" — arquivar só a tira das telas de visão geral. */}
            {!ativa && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide border-[#525252] bg-[#484848] text-[#a3a3a3]">
                Arquivada
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-[#f5f5f5] leading-snug">{site.name}</h3>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Arquivar tira a obra do mapa e do strip de cards, e não apaga NADA — por isso o
              rótulo fala em "arquivar", não em "excluir". Continua acessível por esta tela,
              que é o único caminho de volta. */}
          <button
            onClick={() => updateSiteTopo(site.id, { ativa: !ativa })}
            title={ativa
              ? 'Arquiva a obra: ela sai do mapa e da lista, mas nada é apagado'
              : 'Reativa a obra: volta a aparecer no mapa e na lista'}
            className={cn(
              'flex items-center gap-1 text-[10px] transition-colors border rounded-lg px-2.5 py-1.5 whitespace-nowrap',
              ativa
                ? 'text-[#6b6b6b] hover:text-[#fbbf24] border-[#525252] hover:border-[#fbbf24]/30'
                : 'text-[#4ade80] border-[#4ade80]/40 hover:border-[#4ade80]',
            )}
          >
            {ativa ? <Archive size={11} /> : <ArchiveRestore size={11} />}
            {ativa ? 'Arquivar' : 'Reativar'}
          </button>
          <button
            onClick={() => setEditing(site.id)}
            className="flex items-center gap-1 text-[10px] text-[#6b6b6b] hover:text-[#f97316] transition-colors border border-[#525252] hover:border-[#f97316]/30 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
          >
            <Pencil size={11} />
            Editar
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0">

          {/* Localização */}
          <Section icon={<MapPin size={12} />} title="Localização">
            <InfoRow label="Endereço" value={`${site.street}, ${site.number}`} />
            <InfoRow label="Bairro"   value={site.district} />
            <InfoRow label="Cidade"   value={`${site.city} / ${site.state}`} />
            <InfoRow label="CEP"      value={site.cep} />
            {site.lat != null && site.lng != null && (
              <InfoRow label="Coordenadas" value={`${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`} mono />
            )}
          </Section>

          {/* Responsáveis */}
          <Section icon={<Users size={12} />} title="Responsáveis">
            <InfoRow label="Empresa" value={site.company} />
            <InfoRow label="Dono"    value={site.owner} />
            <InfoRow label="Gerente" value={site.manager} />
          </Section>

          {/* Edificação */}
          <Section icon={<Building2 size={12} />} title="Edificação">
            <InfoRow label="Tipo"       value={site.buildingType} />
            <AreaExtensao site={site} />
            <InfoRow label="Pavimentos" value={`${site.floors}`} />
          </Section>

          {/* Cronograma */}
          <Section icon={<Calendar size={12} />} title="Cronograma">
            <InfoRow label="Início"    value={site.startDate} />
            <InfoRow label="Previsão"  value={site.expectedEnd} />
          </Section>

          {/* Descrição */}
          {site.description && (
            <Section icon={<FileText size={12} />} title="Descrição">
              <p className="text-xs text-[#a3a3a3] leading-relaxed">{site.description}</p>
            </Section>
          )}

          {/* Orçamento — editável; fonte do BAC por obra no Planejamento */}
          <Section icon={<DollarSign size={12} />} title="Orçamento">
            {/* Estes três só existiam no diálogo de edição: quem abria "Detalhes da Obra" não via
                nenhum deles, nem para conferir. O preço por m² é o que mais pesa — é ele que o RDO
                usa no valor do dia quando a linha não está vinculada a um serviço do contrato. */}
            {(site.numeroContrato || site.orcamentoBRL || site.precoM2) && (
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2">
                {site.numeroContrato && <InfoRow label="Contrato" value={site.numeroContrato} />}
                {typeof site.orcamentoBRL === 'number' && site.orcamentoBRL > 0 && (
                  <InfoRow label="Orçamento contratado" value={site.orcamentoBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                )}
                {typeof site.precoM2 === 'number' && site.precoM2 > 0 && (
                  <InfoRow label="Preço / m²" value={site.precoM2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                )}
              </div>
            )}
            {/* Dois cadastros de preço respondendo a mesma pergunta em telas diferentes. Com
                serviços cadastrados, o preço por m² solto vale só para o que não estiver vinculado. */}
            {typeof site.precoM2 === 'number' && site.precoM2 > 0 && (site.contrato?.services?.length ?? 0) > 0 && (
              <p className="mb-2 text-[10px] leading-relaxed text-[#6b6b6b]">
                Esta obra tem {site.contrato?.services?.length} serviço(s) com preço próprio no contrato.
                O preço por m² acima só é usado no RDO para linha que não estiver vinculada a nenhum deles.
              </p>
            )}
            <OrcamentoEditor site={site} />
            {site.budgetLines && site.budgetLines.length > 0 && (
              <BudgetTable lines={site.budgetLines} />
            )}
          </Section>

          {/* Contrato & Medição por obra (serviços + controle de medição) */}
          <ContratoMedicaoSection site={site} />

          {/* Marcos */}
          {(site.planningMilestones?.length || site.executionMilestones?.length) ? (
            <Section icon={<CalendarDays size={12} />} title="Marcos">
              {site.planningMilestones && site.planningMilestones.length > 0 && (
                <MilestoneTimeline label="Planejamento" milestones={site.planningMilestones} />
              )}
              {site.executionMilestones && site.executionMilestones.length > 0 && (
                <MilestoneTimeline label="Execução" milestones={site.executionMilestones} />
              )}
            </Section>
          ) : null}

          {/* Riscos */}
          <div className="px-4 py-3 border-b border-[#525252]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-[#6b6b6b]" />
                <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6b6b6b]">
                  Riscos
                </span>
                {(activeRisks > 0 || criticalRisks > 0) && (
                  <span className={cn(
                    'text-[9px] font-semibold px-1.5 py-0.5 rounded',
                    criticalRisks > 0 ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-[#f97316] bg-[#f97316]/10'
                  )}>
                    {criticalRisks > 0 ? `${criticalRisks} crítico${criticalRisks > 1 ? 's' : ''}` : `${activeRisks} ativo${activeRisks > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditingRisk({ siteId: site.id, riskId: 'new' })}
                className="flex items-center gap-1 text-[10px] text-[#6b6b6b] hover:text-[#f97316] transition-colors"
              >
                <Plus size={11} />
                Adicionar
              </button>
            </div>

            {site.risks.length === 0 ? (
              <p className="text-[10px] text-[#3f3f3f] text-center py-4">Nenhum risco cadastrado</p>
            ) : (
              <div className="flex flex-col gap-2">
                {[...site.risks]
                  .sort((a, b) => {
                    const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 }
                    return levelOrder[a.level] - levelOrder[b.level]
                  })
                  .map((risk) => (
                    <RiskCard key={risk.id} site={site} risk={risk} />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-[#525252] flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[#6b6b6b]">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold">{title}</span>
      </div>
      <div className="flex flex-col gap-1.5 pl-4">
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] text-[#6b6b6b] shrink-0 w-20">{label}</span>
      <span className={cn('text-xs text-[#f5f5f5] flex-1', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  )
}
