import { useState } from 'react'
import { Pencil, Plus, Trash2, AlertTriangle, MapPin, Building2, Users, Calendar, FileText, CalendarDays, CheckCircle2, Circle, Clock, Archive, ArchiveRestore, FileDown, Braces } from 'lucide-react'
import { cn, hojeLocalISO } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useRdoStore } from '@/store/rdoStore'
import { useAuth } from '@/lib/auth'
import { MetasDaObraSection } from './MetasDaObraSection'
import { ContratoCard } from './ContratoCard'
import { metragemContratada, precoMedioM2 } from '@/features/torre-de-controle/utils/obraMedicao'
import {
  openObraDetailWindow, printObraDetailInto, printObraDetailViaIframe, baixarObraDetailJson,
} from '@/features/torre-de-controle/utils/obraDetailExport'
import { formatarMetragem, temUnidadesMistas } from '@/lib/unidadesMedida'
import { obraEstaAtiva } from '@/lib/obraAtiva'
import type { ConstructionRisk, ConstructionSite, ObraStatus, RiskLevel, RiskStatus, MilestoneStatus, ConstructionMilestone } from '@/types'
import { Autoria } from '@/components/shared/Autoria'

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
      <p className="text-[11px] leading-relaxed text-[#a3a3a3]">
        Somada de {services.length} serviço(s) do contrato
        {temUnidadesMistas(m) && ' — em parcelas, porque m² e metro linear não se somam'}
        {m.verbas > 0 && `. ${m.verbas} item(ns) de valor fechado, sem metragem`}.
      </p>
      {medio != null && (
        <p className="text-[11px] leading-relaxed text-[#a3a3a3]">
          Preço médio da área: {medio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })}/m²
          {' '}— é uma média, não o preço de nenhum serviço. Cada um tem o seu.
        </p>
      )}
      {divergeDoCadastro && (
        <p className="text-[11px] leading-relaxed text-[#fbbf24]">
          O cadastro da obra diz {site.totalArea.toLocaleString('pt-BR')} m², e os serviços somam
          {' '}{m.area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m². Vale conferir qual está certo.
        </p>
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



// ─── Milestone Timeline ──────────────────────────────────────────────────────────────

const MILESTONE_ICON: Record<MilestoneStatus, React.ReactNode> = {
  done:    <CheckCircle2 size={11} className="text-[#22c55e] shrink-0" />,
  active:  <Clock        size={11} className="text-[#3b82f6] shrink-0" />,
  pending: <Circle       size={11} className="text-[#a3a3a3] shrink-0" />,
}

function MilestoneTimeline({ label, milestones }: { label: string; milestones: ConstructionMilestone[] }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-[11px] uppercase tracking-widest text-[#a3a3a3] font-semibold mb-1.5">{label}</p>
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {milestones.map((m, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center min-w-[72px]">
              {MILESTONE_ICON[m.status]}
              <span className={cn(
                'text-[11px] mt-0.5 text-center leading-tight',
                m.status === 'done' ? 'text-[#22c55e]' :
                m.status === 'active' ? 'text-[#3b82f6]' : 'text-[#a3a3a3]',
              )}>
                {m.name}
              </span>
              <span className="text-[11px] text-[#a3a3a3] font-mono mt-0.5">{m.date.slice(5)}</span>
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
              className="text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ color, background: color + '15' }}
            >
              {RISK_LEVEL_LABEL[risk.level]}
            </span>
            <span className="text-[11px] text-[#a3a3a3] uppercase tracking-wide">
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
                className="text-[11px] px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] font-semibold hover:bg-[#ef4444]/30"
              >
                Sim
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] px-1.5 py-0.5 rounded bg-[#484848] text-[#a3a3a3]"
              >
                Não
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditingRisk({ siteId: site.id, riskId: risk.id })}
                className="w-6 h-6 flex items-center justify-center rounded text-[#a3a3a3] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={handleDelete}
                className="w-6 h-6 flex items-center justify-center rounded text-[#a3a3a3] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[11px] text-[#a3a3a3] text-left hover:text-[#a3a3a3] transition-colors"
      >
        {expanded ? risk.description : risk.description.slice(0, 90) + (risk.description.length > 90 ? '...' : '')}
        {risk.description.length > 90 && (
          <span className="ml-1 text-[#f97316]">{expanded ? '▲ menos' : '▼ mais'}</span>
        )}
      </button>

      {expanded && risk.notes && (
        <div className="text-[11px] text-[#a3a3a3] bg-[#484848] rounded p-2 border border-[#525252]">
          <span className="text-[11px] uppercase tracking-widest text-[#a3a3a3]">Notas: </span>
          {risk.notes}
        </div>
      )}

      <div className="text-[11px] text-[#a3a3a3]">
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
  const rdos           = useRdoStore((s) => s.rdos)
  const profile        = useAuth((s) => s.profile)

  const updateSiteTopo = useTorreStore((s) => s.updateSite)

  const site = selectedId ? sites.find((s) => s.id === selectedId) ?? null : null

  // ⚠️ Antes era `return null`: a aba renderizava NADA quando não havia obra selecionada. Como
  // painel próprio isso já era ruim; como sub-aba de "Obras" seria uma tela preta.
  if (!site) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-[#a3a3a3]">Nenhuma obra selecionada.</p>
          <p className="mt-1.5 text-xs text-[#6b6b6b]">
            Escolha uma na <strong>Carteira</strong>, ao lado — ou clique num pino do Mapa Geral.
          </p>
        </div>
      </div>
    )
  }

  const ativa = obraEstaAtiva(site)

  const activeRisks   = site.risks.filter((r) => r.status === 'active').length
  const criticalRisks = site.risks.filter((r) => r.level === 'critical').length

  const contextoExportacao = { hoje: hojeLocalISO(), emitidoPor: profile?.full_name || profile?.email || undefined }

  /**
   * `window.open` precisa ser SÍNCRONO no clique — depois de um `await` o navegador bloqueia.
   * Aqui não há nada assíncrono para esperar (nenhuma foto embutida, ver `obraDetailExport.ts`),
   * então o pop-up praticamente nunca é bloqueado; ainda assim o plano B via iframe cobre o caso
   * de um bloqueador de terceiros mais agressivo.
   */
  function exportarPdf() {
    // TS não carrega a narrowing do `if (!site) return` acima para dentro de uma closure — daí
    // a checagem de novo aqui. Na prática nunca é `null`: os dois botões só existem depois dele.
    if (!site) return
    const win = openObraDetailWindow()
    try {
      if (win && !win.closed) printObraDetailInto(win, site, rdos, contextoExportacao)
      else printObraDetailViaIframe(site, rdos, contextoExportacao)
    } catch (e) {
      win?.close()
      alert(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.')
    }
  }

  function exportarJson() {
    if (!site) return
    baixarObraDetailJson(site, contextoExportacao)
  }

  return (
    <div
      className="flex flex-col bg-[#333333] overflow-hidden w-full lg:border-l-0 border-l border-[#525252]"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#525252] shrink-0 gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-[#a3a3a3] bg-[#484848] px-1.5 py-0.5 rounded">{site.code}</span>
            <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide', STATUS_COLOR[site.status])}>
              {STATUS_LABEL[site.status]}
            </span>
            {/* O selo de arquivada é SEPARADO do status, de propósito: a obra continua sendo
                "Concluída" ou "Pausada" — arquivar só a tira das telas de visão geral. */}
            {!ativa && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide border-[#525252] bg-[#484848] text-[#a3a3a3]">
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
              'flex items-center gap-1 text-[11px] transition-colors border rounded-lg px-2.5 py-1.5 whitespace-nowrap',
              ativa
                ? 'text-[#a3a3a3] hover:text-[#fbbf24] border-[#525252] hover:border-[#fbbf24]/30'
                : 'text-[#4ade80] border-[#4ade80]/40 hover:border-[#4ade80]',
            )}
          >
            {ativa ? <Archive size={11} /> : <ArchiveRestore size={11} />}
            {ativa ? 'Arquivar' : 'Reativar'}
          </button>
          <button
            onClick={exportarJson}
            title="Baixa os dados desta obra em JSON — o dado cru, sem formatação"
            className="flex items-center gap-1 text-[11px] text-[#a3a3a3] hover:text-[#f97316] transition-colors border border-[#525252] hover:border-[#f97316]/30 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
          >
            <Braces size={11} />
            JSON
          </button>
          <button
            onClick={exportarPdf}
            title="Gera o dossiê da obra (identificação, resumo, composição, medições e documentos) para imprimir ou salvar em PDF"
            className="flex items-center gap-1 text-[11px] text-[#a3a3a3] hover:text-[#f97316] transition-colors border border-[#525252] hover:border-[#f97316]/30 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
          >
            <FileDown size={11} />
            Exportar PDF
          </button>
          <button
            onClick={() => setEditing(site.id)}
            className="flex items-center gap-1 text-[11px] text-[#a3a3a3] hover:text-[#f97316] transition-colors border border-[#525252] hover:border-[#f97316]/30 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
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
            <Autoria tabela="construction_sites" registroId={site.id} className="mt-2 pt-2 border-t border-[#525252]" />
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

          {/* CONTRATO — um card com quatro abas (Resumo · Composição · Medições · Documentos).
              Aqui existia um bloco "Orçamento" separado, com número do contrato, orçamento
              contratado, preço por m², um editor de valor e a tabela de linhas — e logo abaixo a
              seção "Contrato & Medição". Eram o mesmo objeto em três níveis: o teto, como o teto
              foi formado, e o que já virou nota. Agora são abas de um card só. */}
          {/* ⚠️ `key` OBRIGATÓRIA, e ela segura dado de cliente. Sem ela o card NÃO remonta ao
              trocar de obra: as abas guardam o rascunho em `useState` semeado só ao abrir, então o
              formulário continua na tela com os números da obra anterior enquanto a prop já é
              outra — e o "Salvar" grava o contrato de uma dentro da outra. Ver
              `torreDeControleStore.pull`. */}
          {/* Metas vêm ANTES do contrato: meta é prazo e produção; contrato é dinheiro. */}
          <MetasDaObraSection key={`metas-${site.id}`} site={site} />

          <ContratoCard key={site.id} site={site} />

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
                <AlertTriangle size={12} className="text-[#a3a3a3]" />
                <span className="text-[11px] uppercase tracking-widest font-semibold text-[#a3a3a3]">
                  Riscos
                </span>
                {(activeRisks > 0 || criticalRisks > 0) && (
                  <span className={cn(
                    'text-[11px] font-semibold px-1.5 py-0.5 rounded',
                    criticalRisks > 0 ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-[#f97316] bg-[#f97316]/10'
                  )}>
                    {criticalRisks > 0 ? `${criticalRisks} crítico${criticalRisks > 1 ? 's' : ''}` : `${activeRisks} ativo${activeRisks > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditingRisk({ siteId: site.id, riskId: 'new' })}
                className="flex items-center gap-1 text-[11px] text-[#a3a3a3] hover:text-[#f97316] transition-colors"
              >
                <Plus size={11} />
                Adicionar
              </button>
            </div>

            {site.risks.length === 0 ? (
              <p className="text-[11px] text-[#a3a3a3] text-center py-4">Nenhum risco cadastrado</p>
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
      <div className="flex items-center gap-1.5 text-[#a3a3a3]">
        {icon}
        <span className="text-[11px] uppercase tracking-widest font-semibold">{title}</span>
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
      <span className="text-[11px] text-[#a3a3a3] shrink-0 w-20">{label}</span>
      <span className={cn('text-xs text-[#f5f5f5] flex-1', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  )
}
