/**
 * HistoricoPanel — list of all RDOs with search, date filter,
 * expandable detail view, print layout, and delete confirmation.
 */
import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Printer, Trash2, ChevronDown, ChevronRight,
  Cloud, CloudRain, Sun, Zap, Camera, MapPin, Edit3, X,
  Droplets, FileDown, ImageIcon, ImageOff, Pencil, CheckCircle2,
} from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useContractorStore } from '@/store/contractorStore'
import { supabase } from '@/lib/supabase'
import { dataLocalISO } from '@/lib/utils'
import { printRdoPDF } from '../utils/rdoPdfExport'
import { abrirJanelaRelatorio, imprimirRelatorioRdos, type ItemRelatorio } from '../utils/rdosReportExport'
import { printCompizzoPdf } from '../utils/rdoCompizzoPdf'
import { RdoPhotoImg } from './RdoPhotoImg'
import { RdoDetalhe } from './RdoDetalhe'
import { RdoIntegracaoStatus } from './RdoIntegracaoStatus'
import type { RDO, RdoWeatherCondition } from '@/types'
import type { RdoSabespData } from '@/features/rdo-sabesp/lib/rdoSabespPdfGenerator'
import { getCriadouroLabel, getExecutedActivities, getRdoSabespExecutedServices, sumExecutedQuantities } from '@/features/rdo-sabesp/lib/rdoSabespUtils'
import {
  mergeRdoSabespRemoteWithLocal,
  readLocalRdoSabesp,
  writeLocalRdoSabesp,
} from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function rdoTitle(rdo: RDO) {
  return rdo.title?.trim() || `RDO #${rdo.number}`
}

function isLinearMeterUnit(unit: string) {
  const normalized = unit
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  return ['m', 'm.', 'metro', 'metros', 'linear', 'metros lineares'].includes(normalized)
}

function weatherIcon(cond: RdoWeatherCondition) {
  switch (cond) {
    case 'good':   return <Sun size={14} className="text-yellow-400" />
    case 'cloudy': return <Cloud size={14} className="text-[#a3a3a3]" />
    case 'rain':   return <CloudRain size={14} className="text-blue-400" />
    case 'storm':  return <Zap size={14} className="text-purple-400" />
  }
}

function weatherLabel(cond: RdoWeatherCondition) {
  const map: Record<RdoWeatherCondition, string> = {
    good: 'Bom', cloudy: 'Nublado', rain: 'Chuva', storm: 'Tempestade',
  }
  return map[cond]
}

type SabespHistoryRecord = RdoSabespData & {
  id: string
  created_at?: string | null
  updated_at?: string | null
}

// ─── Print layout (hidden on screen, visible when printing) ──────────────────

function PrintLayout({ rdo }: { rdo: RDO }) {
  const totalWorkers = rdo.manpower.foremanCount + rdo.manpower.officialCount
    + rdo.manpower.helperCount + rdo.manpower.operatorCount
  const totalMeters = rdo.trechos.reduce((s, t) => s + t.executedMeters, 0)

  return (
    <div className="hidden print:block print:text-black print:bg-white p-8 font-sans text-sm">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">{rdoTitle(rdo)}</h1>
          <p className="text-gray-600 mt-1">Relatório Diário de Obras</p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>Data: {fmtDate(rdo.date)}</p>
          <p>Responsável: {rdo.responsible}</p>
          {rdo.geolocation && (
            <p>GPS: {rdo.geolocation.lat}, {rdo.geolocation.lng}</p>
          )}
        </div>
      </div>

      {/* Climate */}
      <div className="mb-4">
        <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Condições Climáticas</h2>
        <div className="flex gap-6 text-sm">
          <span>Manhã: {weatherLabel(rdo.weather.morning)}</span>
          <span>Tarde: {weatherLabel(rdo.weather.afternoon)}</span>
          <span>Noite: {weatherLabel(rdo.weather.night)}</span>
          <span>Temperatura: {rdo.weather.temperatureC}°C</span>
        </div>
      </div>

      {/* Manpower */}
      <div className="mb-4">
        <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Mão de Obra</h2>
        <div className="flex gap-6 text-sm">
          <span>Encarregados: {rdo.manpower.foremanCount}</span>
          <span>Oficiais: {rdo.manpower.officialCount}</span>
          <span>Ajudantes: {rdo.manpower.helperCount}</span>
          <span>Operadores: {rdo.manpower.operatorCount}</span>
          <span className="font-medium">Total: {totalWorkers}</span>
        </div>
      </div>

      {/* Equipment */}
      {rdo.equipment.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Equipamentos</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1 text-left">Equipamento</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Qtd</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Horas</th>
              </tr>
            </thead>
            <tbody>
              {rdo.equipment.map((e) => (
                <tr key={e.id}>
                  <td className="border border-gray-300 px-3 py-1">{e.name}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{e.quantity}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{e.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Services */}
      {rdo.services.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Serviços Executados</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1 text-left">Descrição</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Quantidade</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {rdo.services.map((s) => (
                <tr key={s.id}>
                  <td className="border border-gray-300 px-3 py-1">{s.description}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{s.quantity}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{s.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trechos */}
      {rdo.trechos.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">
            Avanço por Trecho — Total: {totalMeters.toFixed(2)} m
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1 text-left">Código</th>
                <th className="border border-gray-300 px-3 py-1 text-left">Descrição</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Planejado (m)</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Executado (m)</th>
                <th className="border border-gray-300 px-3 py-1 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rdo.trechos.map((t) => (
                <tr key={t.id}>
                  <td className="border border-gray-300 px-3 py-1">{t.trechoCode}</td>
                  <td className="border border-gray-300 px-3 py-1">{t.trechoDescription}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{t.plannedMeters.toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{t.executedMeters.toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-1 text-center">
                    {t.status === 'completed' ? 'Concluído' : t.status === 'in_progress' ? 'Em Execução' : 'Não Iniciado'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Observations */}
      {rdo.observations && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Observações Gerais</h2>
          <p className="text-sm whitespace-pre-wrap">{rdo.observations}</p>
        </div>
      )}
      {rdo.incidents && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Ocorrências / Incidentes</h2>
          <p className="text-sm whitespace-pre-wrap">{rdo.incidents}</p>
        </div>
      )}

      {/* Photos */}
      {rdo.photos.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">
            Registro Fotográfico ({rdo.photos.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {rdo.photos.map((p) => (
              <div key={p.id}>
                <RdoPhotoImg photo={p} className="w-full h-32 object-cover border border-gray-300 rounded" />
                {p.label && <p className="text-xs text-gray-600 mt-0.5 text-center">{p.label}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-gray-300 pt-3 text-xs text-[#6b6b6b] flex justify-between">
        <span>Gerado em: {new Date().toLocaleString('pt-BR')}</span>
        <span>ConstruData Palantir</span>
      </div>
    </div>
  )
}

// ─── RDO Card ─────────────────────────────────────────────────────────────────

/** Validação leve para finalizar um RDO — retorna os campos faltantes (labels). */
function rdoMissingForFinalize(rdo: RDO): string[] {
  const missing: string[] = []
  if (!rdo.date) missing.push('Data')
  if (!rdo.responsible?.trim()) missing.push('Responsável')
  if (!rdo.siteId) missing.push('Obra')
  const temServico = (rdo.services ?? []).some((s) => (Number(s.quantity) || 0) > 0)
  const temTrecho = (rdo.trechos ?? []).some((t) => (Number(t.executedMeters) || 0) > 0)
  const temProducao = (rdo.compizzo?.producao ?? []).some((p) => (p.quantidade ?? '').trim() !== '')
  if (!temServico && !temTrecho && !temProducao) missing.push('Pelo menos um serviço/trecho/produção com quantidade')
  return missing
}

function RdoCard({ rdo, onDelete, onEdit, onFinalize }: { rdo: RDO; onDelete: () => void; onEdit: () => void; onFinalize?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  // Colaboradores nominais (RDO Compizzo) também contam como trabalhadores.
  const totalWorkers = rdo.manpower.foremanCount + rdo.manpower.officialCount
    + rdo.manpower.helperCount + rdo.manpower.operatorCount
    + (rdo.manpower.employeeNames?.length ?? 0)
  const totalMeters = rdo.trechos.reduce((s, t) => s + t.executedMeters, 0)
  // O Compizzo guarda os dados em campos próprios (serviços/produção/materiais),
  // não em trechos — o resumo do card precisa ler de lá.
  const isCompizzo = rdo.template === 'compizzo' && !!rdo.compizzo
  const compizzoServicos = isCompizzo
    ? Object.values(rdo.compizzo!.servicos ?? {}).filter(Boolean).length + (rdo.compizzo!.servicosExtra?.length ?? 0)
    : 0
  const compizzoProducao = isCompizzo
    ? (rdo.compizzo!.producao ?? []).filter((p) => (p.quantidade ?? '').trim() !== '').length
    : 0
  const compizzoMateriais = isCompizzo
    ? (rdo.compizzo!.materiais ?? []).filter((m) => (m.quantidade ?? '').trim() !== '').length
    : 0

  function handlePrint() {
    if (rdo.template === 'compizzo' && rdo.compizzo) void printCompizzoPdf(rdo)
    else void printRdoPDF(rdo)
  }

  return (
    <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
      {/* Print layout injected at page level but scoped to this RDO — shows only when printing */}
      <PrintLayout rdo={rdo} />

      {/* Card header — clicar em qualquer ponto (fora dos botões) expande */}
      <div className="px-5 py-4 flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white font-semibold">{rdoTitle(rdo)}</span>
            {rdo.status === 'rascunho' && (
              <span className="rounded border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Rascunho</span>
            )}
            <span className="text-[#6b6b6b] text-xs">RDO #{rdo.number}</span>
            <span className="text-[#a3a3a3] text-sm">{fmtDate(rdo.date)}</span>
            <div className="flex items-center gap-1 text-[#a3a3a3] text-xs">
              {weatherIcon(rdo.weather.morning)}
              <span>{weatherLabel(rdo.weather.morning)}</span>
              <span className="mx-1 text-gray-600">·</span>
              <span>{rdo.weather.temperatureC}°C</span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-1 text-[#a3a3a3] text-sm flex-wrap">
            <span>{rdo.responsible}</span>
            <span className="text-gray-600">·</span>
            {isCompizzo ? (
              <>
                <span>{compizzoServicos} serviço{compizzoServicos !== 1 ? 's' : ''}</span>
                <span className="text-gray-600">·</span>
                <span>{compizzoProducao} item{compizzoProducao !== 1 ? 'ns' : ''} de produção</span>
                <span className="text-gray-600">·</span>
                <span>{compizzoMateriais} materia{compizzoMateriais !== 1 ? 'is' : 'l'}</span>
              </>
            ) : (
              <>
                <span>{rdo.trechos.length} trecho{rdo.trechos.length !== 1 ? 's' : ''}</span>
                <span className="text-gray-600">·</span>
                <span>{totalMeters.toFixed(1)} m executados</span>
              </>
            )}
            <span className="text-gray-600">·</span>
            <span>{totalWorkers} trabalhadores</span>
            {rdo.photos.length > 0 && (
              <>
                <span className="text-gray-600">·</span>
                <span className="flex items-center gap-1">
                  <Camera size={12} />
                  {rdo.photos.length}
                </span>
              </>
            )}
            {rdo.geolocation && (
              <>
                <span className="text-gray-600">·</span>
                <MapPin size={12} className="text-[#f97316]" />
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {rdo.status === 'rascunho' && onFinalize && (
            <button
              onClick={onFinalize}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              title="Finalizar RDO — passa a alimentar planejamento, financeiro e estoque"
            >
              <CheckCircle2 size={13} />
              Finalizar
            </button>
          )}
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-xs transition-colors"
            title="Editar RDO"
          >
            <Edit3 size={13} />
            Editar
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-xs transition-colors"
            title="Imprimir RDO"
          >
            <Printer size={13} />
            Imprimir
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors"
            title="Excluir RDO"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-[#484848] text-[#a3a3a3] transition-colors"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded detail — visão completa read-only + status de integração */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[#525252] space-y-4 pt-4">
          <RdoIntegracaoStatus rdo={rdo} />
          <RdoDetalhe rdo={rdo} />
        </div>
      )}
    </div>
  )
}

function SabespRdoCard({ rdo, onOpen }: { rdo: SabespHistoryRecord; onOpen: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const contractor = useContractorStore((state) =>
    state.resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado }),
  )
  const activities = getExecutedActivities(rdo)
  const services = getRdoSabespExecutedServices(rdo)
  const totalQuantity = sumExecutedQuantities(rdo)
  const linearMeters = services
    .filter((service) => isLinearMeterUnit(service.unit))
    .reduce((sum, service) => sum + service.quantity, 0)
  const photoCount = Array.isArray(rdo.photo_paths) ? rdo.photo_paths.length : 0
  const isDraft = rdo.status === 'draft'
  const visibleActivities = expanded ? activities : activities.slice(0, 6)

  async function handlePdf() {
    try {
      const { downloadRdoSabespPdf } = await import('@/features/rdo-sabesp/lib/rdoSabespPdfGenerator')
      await downloadRdoSabespPdf(rdo)
    } catch (error) {
      console.error('Erro ao baixar PDF do RDO Sabesp:', error)
      alert('Nao foi possivel gerar o PDF do RDO Sabesp.')
    }
  }

  return (
    <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Droplets size={16} className="text-[#38bdf8]" />
            <span className="text-white font-semibold">{fmtDate(rdo.report_date)}</span>
            <span className="rounded-full bg-[#f97316] px-2 py-0.5 text-xs font-semibold text-white">Sabesp</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isDraft ? 'bg-[#484848] text-[#d4d4d4]' : 'bg-blue-600 text-white'}`}>
              {isDraft ? 'Rascunho' : 'Finalizado'}
            </span>
            {rdo.criadouro && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                {getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)}
              </span>
            )}
            {photoCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-xs text-emerald-300">
                <ImageIcon size={12} />
                {photoCount} foto{photoCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#5e5e5e] px-2 py-0.5 text-xs text-[#a3a3a3]">
                <ImageOff size={12} />
                Sem foto
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs ${contractor ? 'border-emerald-500/40 text-emerald-300' : 'border-amber-500/40 text-amber-300'}`}>
              {contractor?.name || 'Empreiteira nao identificada'}
            </span>
            {rdo.encarregado && <span className="text-sm text-[#a3a3a3]">• {rdo.encarregado}</span>}
          </div>

          <p className="text-sm text-[#a3a3a3]">{rdo.rua_beco || '-'}</p>
          <p className="text-xs text-[#6b6b6b]">
            {activities.length} atividade(s), {totalQuantity} unidade(s) registradas
            {linearMeters > 0 ? ` e ${linearMeters.toFixed(2)} m lineares.` : '.'}
          </p>

          {activities.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {visibleActivities.map((activity) => (
                  <span
                    key={activity.id}
                    className="max-w-full rounded-full border border-[#525252] bg-[#2c2c2c] px-3 py-1 text-xs text-[#f5f5f5]"
                  >
                    {activity.label}
                  </span>
                ))}
              </div>
              {activities.length > 6 && (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#f97316] hover:text-[#ea580c]"
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {expanded ? 'Ocultar atividades' : 'Visualizar todas as atividades'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-xs transition-colors"
            title="Abrir RDO Sabesp"
          >
            <Pencil size={13} />
            Abrir
          </button>
          <button
            onClick={handlePdf}
            disabled={isDraft}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] disabled:cursor-not-allowed disabled:opacity-50 text-[#f5f5f5] text-xs transition-colors"
            title={isDraft ? 'Finalize o RDO Sabesp para exportar' : 'Baixar PDF Sabesp'}
          >
            <FileDown size={13} />
            PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function HistoricoPanel() {
  const { rdos, removeRdo, updateRdo, setActiveTab, setEditingRdoId } = useRdoStore()
  const loadContractors = useContractorStore((state) => state.load)
  const navigate = useNavigate()
  const [sabespRdos, setSabespRdos] = useState<SabespHistoryRecord[]>(() => readLocalRdoSabesp() as SabespHistoryRecord[])
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  // Edit state
  const [editingRdo, setEditingRdo] = useState<RDO | null>(null)
  const [editForm, setEditForm]     = useState<Partial<RDO>>({})

  // Period PDF state
  const [pdfPeriodType, setPdfPeriodType] = useState<'semanal' | 'mensal' | 'personalizado' | ''>('')
  const [pdfWeek,   setPdfWeek]   = useState('')
  const [pdfMonth,  setPdfMonth]  = useState('')
  const [pdfFrom,   setPdfFrom]   = useState('')
  const [pdfTo,     setPdfTo]     = useState('')

  const loadSabespHistory = useCallback(async () => {
    const localRows = readLocalRdoSabesp()
    setSabespRdos(localRows as SabespHistoryRecord[])

    try {
      const { data, error } = await supabase
        .from('rdo_sabesp')
        .select('*')
        .is('deleted_at', null)
        .order('report_date', { ascending: false })

      if (error) throw error
      const merged = mergeRdoSabespRemoteWithLocal(data ?? [], readLocalRdoSabesp(true))
      writeLocalRdoSabesp(merged)
      setSabespRdos(merged as SabespHistoryRecord[])
    } catch (error) {
      console.warn('[rdo] nao foi possivel carregar historico Sabesp; usando cache local', error)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSabespHistory()
      void loadContractors()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadSabespHistory, loadContractors])

  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const siteAtivo = useTorreStore((s) => s.sites).find((s) => s.id === activeObraId) ?? null
  const filtered = useMemo(() => {
    return rdos
      .filter((r) => {
        if (activeObraId && (r.siteId ?? null) !== activeObraId) return false
        const q = search.toLowerCase()
        if (q && !String(r.number).includes(q) && !r.responsible.toLowerCase().includes(q) && !(r.title ?? '').toLowerCase().includes(q) && !r.date.includes(q)) return false
        if (dateFrom && r.date < dateFrom) return false
        if (dateTo   && r.date > dateTo)   return false
        return true
      })
      .slice()
      .sort((a, b) => b.number - a.number)
  }, [rdos, search, dateFrom, dateTo, activeObraId])

  const filteredSabesp = useMemo(() => {
    return sabespRdos
      .filter((r) => {
        const q = search.toLowerCase()
        const activityText = getExecutedActivities(r).map((activity) => activity.label).join(' ').toLowerCase()
        const haystack = [
          r.report_date,
          r.encarregado,
          r.rua_beco,
          getCriadouroLabel(r.criadouro, r.criadouro_outro),
          activityText,
        ].join(' ').toLowerCase()
        if (q && !haystack.includes(q)) return false
        if (dateFrom && r.report_date < dateFrom) return false
        if (dateTo && r.report_date > dateTo) return false
        return true
      })
      .slice()
      .sort((a, b) => b.report_date.localeCompare(a.report_date))
  }, [sabespRdos, search, dateFrom, dateTo])

  const historyItems = useMemo(() => {
    const regularItems = filtered.map((rdo) => ({ type: 'regular' as const, date: rdo.date, id: rdo.id, rdo }))
    const sabespItems = filteredSabesp.map((rdo) => ({ type: 'sabesp' as const, date: rdo.report_date, id: rdo.id, rdo }))

    return [...regularItems, ...sabespItems].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return a.type.localeCompare(b.type)
    })
  }, [filtered, filteredSabesp])

  const totalRdoCount = rdos.length + sabespRdos.length
  const sabespHistorySummary = useMemo(() => {
    return filteredSabesp.reduce(
      (acc, rdo) => {
        const services = getRdoSabespExecutedServices(rdo)
        acc.services += services.length
        acc.quantity += sumExecutedQuantities(rdo)
        acc.linearMeters += services
          .filter((service) => isLinearMeterUnit(service.unit))
          .reduce((sum, service) => sum + service.quantity, 0)
        acc.photos += Array.isArray(rdo.photo_paths) ? rdo.photo_paths.length : 0
        if (rdo.status === 'draft') acc.drafts += 1
        else acc.finalized += 1
        return acc
      },
      { services: 0, quantity: 0, linearMeters: 0, photos: 0, drafts: 0, finalized: 0 },
    )
  }, [filteredSabesp])

  function handleDelete(id: string) {
    // O texto dizia que a exclusão "passa por aprovação antes de ser efetivada". Isso era falso das
    // duas maneiras: o pedido nunca era aprovado (a empresa usa uma conta só e quem pede não pode
    // aprovar), então o RDO voltava; e agora, com o soft delete direto, ele some na hora. Prometer
    // um crivo que não existe é pior do que não avisar nada.
    if (!confirm('Excluir este RDO? Ele sai do histórico e deixa de alimentar medição, estoque e Financeiro. Não há aprovação intermediária.')) return
    // NÃO apagar as fotos do bucket aqui: a exclusão só se efetiva após APROVAÇÃO
    // (pending_action). Apagar antes destruiria as evidências de um RDO que pode ser
    // restaurado (aprovação negada → o RDO volta no pull). Após a aprovação, os
    // arquivos ficam órfãos no bucket (best-effort, sem referência quebrada).
    removeRdo(id)
  }

  function handleFinalize(rdo: RDO) {
    const missing = rdoMissingForFinalize(rdo)
    if (missing.length > 0) {
      alert(`Não é possível finalizar o RDO #${rdo.number} — faltam:\n\n• ${missing.join('\n• ')}`)
      return
    }
    if (!confirm(`Finalizar o RDO #${rdo.number}? Ele passará a alimentar planejamento, financeiro e estoque.`)) return
    updateRdo(rdo.id, { status: 'finalizado' })
  }

  function handleSaveEdit() {
    if (!editingRdo) return
    updateRdo(editingRdo.id, editForm)
    setEditingRdo(null)
    setEditForm({})
  }

  const [gerandoPdf, setGerandoPdf] = useState(false)

  function handleBatchPDF() {
    let from = '', to = ''
    if (pdfPeriodType === 'semanal' && pdfWeek) {
      const [year, week] = pdfWeek.split('-W').map(Number)
      const jan4 = new Date(year, 0, 4)
      const startOfWeek1 = new Date(jan4.getTime() - ((jan4.getDay() || 7) - 1) * 86400000)
      const weekStart = new Date(startOfWeek1.getTime() + (week - 1) * 7 * 86400000)
      // `dataLocalISO`, não `toISOString()`: as datas acima são meia-noite LOCAL, e converter
      // para UTC no Brasil (UTC-3) devolve o dia anterior — a semana inteira saía deslocada.
      from = dataLocalISO(weekStart)
      to   = dataLocalISO(new Date(weekStart.getTime() + 6 * 86400000))
    } else if (pdfPeriodType === 'mensal' && pdfMonth) {
      const [y, m] = pdfMonth.split('-').map(Number)
      from = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay = new Date(y, m, 0).getDate()
      to   = `${y}-${String(m).padStart(2, '0')}-${lastDay}`
    } else if (pdfPeriodType === 'personalizado') {
      from = pdfFrom; to = pdfTo
    }

    // Respeita a obra ativa, como a listagem da tela — antes o relatório somava todas as obras
    // enquanto a tela mostrava uma só. E inclui os RDOs Sabesp do período, que ficavam de fora.
    const doPeriodo: ItemRelatorio[] = [
      ...rdos
        .filter((r) => !activeObraId || (r.siteId ?? null) === activeObraId)
        .filter((r) => r.date >= from && r.date <= to)
        .map((rdo) => ({ tipo: 'torre' as const, rdo })),
      ...sabespRdos
        .filter((r) => r.report_date >= from && r.report_date <= to)
        .map((rdo) => ({ tipo: 'sabesp' as const, rdo: rdo as RdoSabespData })),
    ]
    if (doPeriodo.length === 0) { alert('Nenhum RDO no período selecionado.'); return }

    // A janela abre AGORA, ainda dentro do clique: depois do primeiro `await` o navegador
    // trata o `window.open` como pop-up não solicitado e bloqueia.
    const janela = abrirJanelaRelatorio()
    const label = pdfPeriodType === 'mensal' ? pdfMonth : `${fmtDate(from)} a ${fmtDate(to)}`
    setGerandoPdf(true)
    void imprimirRelatorioRdos(doPeriodo, label, siteAtivo?.name ?? null, janela)
      .catch((e) => {
        console.error('[rdo] falha ao gerar o relatório consolidado', e)
        janela?.close()
        alert('Não foi possível gerar o relatório. Tente novamente.')
      })
      .finally(() => setGerandoPdf(false))
  }

  const filterInputCls = 'bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4 print:p-0">
      {/* Filters (hidden when printing) */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, responsável ou data..."
            className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg pl-9 pr-4 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50"
          />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={filterInputCls} title="Data inicial" />
        <span className="text-gray-600 text-sm">até</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={filterInputCls} title="Data final" />
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }} className="text-[#f97316] hover:text-[#ea580c] text-sm">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Period PDF selector */}
      <div className="flex items-center gap-2 flex-wrap print:hidden bg-[#3d3d3d] rounded-lg border border-[#525252] px-4 py-2.5">
        <span className="text-[#a3a3a3] text-xs font-medium">PDF por Período:</span>
        <select
          value={pdfPeriodType}
          onChange={(e) => setPdfPeriodType(e.target.value as typeof pdfPeriodType)}
          className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
        >
          <option value="">-- Selecionar --</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
          <option value="personalizado">Personalizado</option>
        </select>
        {pdfPeriodType === 'semanal' && (
          <input type="week" value={pdfWeek} onChange={(e) => setPdfWeek(e.target.value)} className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none" />
        )}
        {pdfPeriodType === 'mensal' && (
          <input type="month" value={pdfMonth} onChange={(e) => setPdfMonth(e.target.value)} className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none" />
        )}
        {pdfPeriodType === 'personalizado' && (
          <>
            <input type="date" value={pdfFrom} onChange={(e) => setPdfFrom(e.target.value)} className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none" />
            <span className="text-[#6b6b6b] text-xs">até</span>
            <input type="date" value={pdfTo} onChange={(e) => setPdfTo(e.target.value)} className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none" />
          </>
        )}
        {pdfPeriodType && (
          <button
            onClick={handleBatchPDF}
            disabled={gerandoPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 disabled:bg-[#484848] disabled:text-[#8a8a8a] disabled:cursor-wait text-white text-xs font-semibold transition-colors"
          >
            <Printer size={12} />
            {gerandoPdf ? 'Gerando…' : 'Exportar PDF (Período)'}
          </button>
        )}
        {activeObraId && (
          // O relatório segue a obra ativa. Dizer isso aqui evita a dúvida de "por que só
          // apareceram 4 dos 29 RDOs" — antes ele somava todas as obras, silenciosamente.
          <span className="text-[#6b6b6b] text-[11px]">
            Somente a obra {siteAtivo?.name ?? 'selecionada'}
          </span>
        )}
      </div>

      {/* Count */}
      <p className="text-[#6b6b6b] text-sm print:hidden">
        {historyItems.length} RDO{historyItems.length !== 1 ? 's' : ''} encontrado{historyItems.length !== 1 ? 's' : ''}
        {totalRdoCount !== historyItems.length && ` de ${totalRdoCount} total`}
      </p>

      {filteredSabesp.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:hidden">
          <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">RDOs Sabesp</div>
            <div className="mt-1 text-xl font-bold text-white">{filteredSabesp.length}</div>
            <div className="text-xs text-[#6b6b6b]">{sabespHistorySummary.finalized} finalizados</div>
          </div>
          <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">Serviços</div>
            <div className="mt-1 text-xl font-bold text-white">{sabespHistorySummary.services}</div>
            <div className="text-xs text-[#6b6b6b]">no período filtrado</div>
          </div>
          <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">Qtd. Executada</div>
            <div className="mt-1 text-xl font-bold text-[#f97316]">{sabespHistorySummary.quantity.toFixed(2)}</div>
            <div className="text-xs text-[#6b6b6b]">todas as unidades</div>
          </div>
          <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">Metros</div>
            <div className="mt-1 text-xl font-bold text-white">{sabespHistorySummary.linearMeters.toFixed(2)} m</div>
            <div className="text-xs text-[#6b6b6b]">unidade metro</div>
          </div>
          <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">Fotos</div>
            <div className="mt-1 text-xl font-bold text-white">{sabespHistorySummary.photos}</div>
            <div className="text-xs text-[#6b6b6b]">{sabespHistorySummary.drafts} rascunho(s)</div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {historyItems.length === 0 && (
        <div className="text-center py-16 text-[#6b6b6b] print:hidden">
          <p className="text-lg">Nenhum RDO encontrado.</p>
          {totalRdoCount === 0 && (
            <p className="text-sm mt-1">Crie o primeiro RDO pela aba "+ Novo RDO".</p>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {historyItems.map((item) => (
          item.type === 'regular' ? (
            <RdoCard
              key={`regular-${item.id}`}
              rdo={item.rdo}
              onDelete={() => handleDelete(item.rdo.id)}
              onFinalize={() => handleFinalize(item.rdo)}
              onEdit={() => {
                // RDO Compizzo edita no próprio painel Compizzo (todos os campos + fotos)
                if (item.rdo.template === 'compizzo') {
                  setEditingRdoId(item.rdo.id)
                  setActiveTab('compizzo')
                } else {
                  setEditingRdo(item.rdo)
                  setEditForm({ ...item.rdo })
                }
              }}
            />
          ) : (
            <SabespRdoCard
              key={`sabesp-${item.id}`}
              rdo={item.rdo}
              onOpen={() => navigate('/app/rdo-sabesp')}
            />
          )
        ))}
      </div>

      {/* Edit Modal */}
      {editingRdo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
              <span className="text-white font-semibold">Editar {rdoTitle(editingRdo)}</span>
              <button onClick={() => setEditingRdo(null)} className="text-[#a3a3a3] hover:text-[#f5f5f5]">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Nome do RDO</label>
                <input
                  type="text"
                  value={editForm.title ?? editingRdo.title ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={`RDO #${editingRdo.number}`}
                  className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none"
                />
              </div>
              {/* Date + Responsible */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#a3a3a3] text-xs mb-1">Data</label>
                  <input
                    type="date"
                    value={editForm.date ?? editingRdo.date}
                    onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#a3a3a3] text-xs mb-1">Responsável</label>
                  <input
                    type="text"
                    value={editForm.responsible ?? editingRdo.responsible}
                    onChange={(e) => setEditForm((f) => ({ ...f, responsible: e.target.value }))}
                    className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none"
                  />
                </div>
              </div>
              {/* Weather */}
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-2">Condições Climáticas</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['morning', 'afternoon', 'night'] as const).map((p) => {
                    const labels = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' }
                    const weather = (editForm.weather ?? editingRdo.weather)
                    return (
                      <div key={p}>
                        <label className="text-[#6b6b6b] text-xs block mb-1">{labels[p]}</label>
                        <select
                          value={weather[p]}
                          onChange={(e) => setEditForm((f) => ({ ...f, weather: { ...(f.weather ?? editingRdo.weather), [p]: e.target.value } }))}
                          className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1.5 text-xs text-[#f5f5f5]"
                        >
                          <option value="good">Bom</option>
                          <option value="cloudy">Nublado</option>
                          <option value="rain">Chuva</option>
                          <option value="storm">Tempestade</option>
                        </select>
                      </div>
                    )
                  })}
                  <div>
                    <label className="text-[#6b6b6b] text-xs block mb-1">Temp. (°C)</label>
                    <input
                      type="number"
                      value={(editForm.weather ?? editingRdo.weather).temperatureC}
                      onChange={(e) => setEditForm((f) => ({ ...f, weather: { ...(f.weather ?? editingRdo.weather), temperatureC: Number(e.target.value) } }))}
                      className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1.5 text-xs text-[#f5f5f5]"
                    />
                  </div>
                </div>
              </div>
              {/* Manpower */}
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-2">Mão de Obra</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([['foremanCount', 'Encarregado'], ['officialCount', 'Oficial'], ['helperCount', 'Ajudante'], ['operatorCount', 'Operador']] as const).map(([field, label]) => (
                    <div key={field}>
                      <label className="text-[#6b6b6b] text-xs block mb-1">{label}</label>
                      <input
                        type="number"
                        min={0}
                        value={(editForm.manpower ?? editingRdo.manpower)[field]}
                        onChange={(e) => setEditForm((f) => ({ ...f, manpower: { ...(f.manpower ?? editingRdo.manpower), [field]: Number(e.target.value) } }))}
                        className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1.5 text-xs text-[#f5f5f5]"
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Observations */}
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Observações Gerais</label>
                <textarea
                  rows={3}
                  value={editForm.observations ?? editingRdo.observations}
                  onChange={(e) => setEditForm((f) => ({ ...f, observations: e.target.value }))}
                  className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-3 py-2 text-sm text-[#f5f5f5] resize-none focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Ocorrências / Incidentes</label>
                <textarea
                  rows={2}
                  value={editForm.incidents ?? editingRdo.incidents}
                  onChange={(e) => setEditForm((f) => ({ ...f, incidents: e.target.value }))}
                  className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-3 py-2 text-sm text-[#f5f5f5] resize-none focus:outline-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#525252] flex gap-2 shrink-0">
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-semibold transition-colors">Salvar</button>
              <button onClick={() => setEditingRdo(null)} className="px-4 py-2 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-sm transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
