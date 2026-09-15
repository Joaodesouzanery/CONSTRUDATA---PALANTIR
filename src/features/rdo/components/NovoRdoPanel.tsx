/**
 * NovoRdoPanel — 8-section collapsible form for creating a new RDO.
 * Sections: Informações Gerais, Condições Climáticas, Mão de Obra,
 *           Equipamentos, Serviços Executados, Avanço por Trecho,
 *           Georreferenciamento, Observações e Ocorrências.
 * Plus: photo upload (base64, max 20 files, 5 MB each).
 */
import { useEffect, useState, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ChevronDown, ChevronRight, Plus, Trash2, MapPin, X,
  CloudSun, Users, Wrench, ClipboardList, Route, Camera, Pencil, ClipboardPaste, FileText,
  ShieldCheck, Info, CheckSquare, Package, Calculator,
} from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useCompanySettingsStore } from '@/store/companySettingsStore'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { checkPendingFvsForDate, getCompletedFvsForDate } from '@/store/crossModuleSync'
import { compressImageToBlob } from '@/lib/imageCompression'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { uploadRdoPhoto, blobToDataUrl, leanPhotosForPersist, removeRdoPhoto } from '../utils/rdoPhotoStorage'
import { RdoPhotoImg } from './RdoPhotoImg'
import { rdoSchema } from '../schemas'
import type { RdoFormData } from '../schemas'
import type { RdoEquipmentEntry, RdoMaterialConsumptionEntry, RdoServiceEntry, RdoTrechoEntry, RdoPhoto, RdoTrechoStatus, RdoStoppageEntry, RdoWorkforceRow } from '@/types'
import { hojeLocalISO } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { obraEstaAtiva } from '@/lib/obraAtiva'
import { TextParseModal } from './TextParseModal'
import type { ParsedRdoData } from '../utils/parseRdoText'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEATHER_OPTIONS = [
  { value: 'good',   label: 'Bom' },
  { value: 'cloudy', label: 'Nublado' },
  { value: 'rain',   label: 'Chuva' },
  { value: 'storm',  label: 'Tempestade' },
] as const

const LOCAL_TIPOS = ['Frente principal', 'Rua / beco', 'Trecho', 'Edificacao', 'Infraestrutura', 'Outro']
const STOPPAGE_REASONS = ['Chuva', 'Falta de material', 'Falta de equipe', 'Interferencia', 'Aguardando liberacao', 'Outro']
const ACTIVITY_STAGES = [
  { stage: 'Lixamento', unit: 'm²', weight: 15.5, weightWithoutMaterial: 12.4, materials: ['Disco diamantado', 'Disco fibra', 'Lixa ferro'] },
  { stage: 'Primeira demão de primer', unit: 'm²', weight: 10, weightWithoutMaterial: 8, materials: ['Primer', 'Rolo 9cm', 'Pincel'] },
  { stage: 'Segunda demão de primer', unit: 'm²', weight: 10, weightWithoutMaterial: 8, materials: ['Primer', 'Rolo 9cm', 'Pincel'] },
  { stage: 'Raspadinha', unit: 'm²', weight: 10, weightWithoutMaterial: 8, materials: ['Disco fibra', 'Lixa ferro'] },
  { stage: 'Polimento', unit: 'm²', weight: 8, weightWithoutMaterial: 6.4, materials: ['Disco fibra', 'Panos'] },
  { stage: 'Pintura', unit: 'm²', weight: 15.5, weightWithoutMaterial: 12.4, materials: ['Epóxi', 'Concrecor', 'Rolo 9cm'] },
  { stage: 'Demarcação', unit: 'ml', weight: 15.5, weightWithoutMaterial: 12.4, materials: ['Fita crepe', 'Trena'] },
  { stage: 'Pintura da demarcação', unit: 'ml', weight: 15.5, weightWithoutMaterial: 12.4, materials: ['Tinta de demarcação', 'Pincel'] },
] as const
const MATERIAL_SOURCES = [
  { value: 'almoxarifado', label: 'Almoxarifado' },
  { value: 'compra_direta', label: 'Compra direta' },
  { value: 'apoio', label: 'Apoio / evidência' },
] as const

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_PHOTOS   = 20
const MAX_SIZE_MB  = 5

// `hojeLocalISO()`, não `toISOString()`: o UTC no Brasil já é AMANHÃ depois das 21h — e é
// justamente no fim da tarde que o encarregado preenche o RDO. Com a data em UTC, o RDO salvo
// carimbava o dia seguinte e o painel de alertas acusaria "sem RDO hoje" numa obra que apontou.
function todayStr() {
  return hojeLocalISO()
}

// ─── Section component ────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-[#3d3d3d] rounded-xl overflow-hidden border border-[#525252]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2.5 text-gray-100 font-medium text-sm">
          {icon}
          {title}
        </div>
        {open ? <ChevronDown size={16} className="text-[#a3a3a3]" /> : <ChevronRight size={16} className="text-[#a3a3a3]" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-red-400 text-xs mt-1">{msg}</p>
}

const inputCls = 'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 transition-colors'
const selectCls = 'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#f97316]/50 transition-colors'

// ─── Integração Qualidade↔RDO: banner informativo de FVS ───────────────────
//
// Auditoria #Q5 — integração Qualidade ↔ RDO.
// Mostra o status das FVS da data do RDO de forma PURAMENTE INFORMATIVA.
// Não bloqueia o salvamento do RDO em hipótese alguma.

function FvsIntegrationBanner({ date }: { date: string }) {
  // Subscribe ao store de Qualidade — força re-render quando FVS muda
  const fvss = useQualidadeStore((s) => s.fvss)

  const { pending, completed } = useMemo(() => {
    if (!date) return { pending: { hasPending: false, pendingCount: 0, pendingFvss: [], ncOpen: 0 }, completed: [] }
    return {
      pending:   checkPendingFvsForDate(date),
      completed: getCompletedFvsForDate(date),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, fvss])

  if (!date) return null
  if (!pending.hasPending && completed.length === 0) {
    // Nenhuma FVS — info leve, sem alarme
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg border border-[#525252] bg-[#3d3d3d]">
        <Info size={16} className="text-[#a3a3a3] shrink-0 mt-0.5" />
        <div className="text-xs text-[#a3a3a3] leading-relaxed">
          Nenhuma FVS registrada para esta data — sem problema para salvar o RDO.
        </div>
      </div>
    )
  }

  if (pending.hasPending) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-700/40 bg-blue-900/15">
        <Info size={18} className="text-blue-300 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm text-blue-200 font-semibold mb-1">
            {pending.pendingCount} FVS {pending.pendingCount === 1 ? 'em aberto' : 'em aberto'} nesta data
            {completed.length > 0 && ` · ${completed.length} concluída${completed.length > 1 ? 's' : ''}`}
          </div>
          <div className="text-xs text-blue-200/85 leading-relaxed mb-2">
            Estas fichas de verificação ainda têm itens em aberto. Sem problema
            para salvar o RDO — só fica como lembrete para o time de qualidade fechar quando puder.
          </div>
          <ul className="text-xs text-blue-200/80 space-y-0.5 mb-2">
            {pending.pendingFvss.slice(0, 5).map((f) => (
              <li key={f.id}>
                • <span className="font-mono">{f.identificationNo}</span> — {f.responsibleLeader || 'sem responsável'}
                {f.ncRequired && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-200 text-[9px] font-bold">NC</span>}
              </li>
            ))}
            {pending.pendingFvss.length > 5 && (
              <li className="italic">... e mais {pending.pendingFvss.length - 5}</li>
            )}
          </ul>
          <a
            href="/app/qualidade"
            className="inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 underline"
          >
            Abrir Qualidade →
          </a>
        </div>
      </div>
    )
  }

  // completed > 0 && !pending — tudo OK
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-700/40 bg-emerald-900/15">
      <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
      <div className="text-xs text-emerald-300 leading-relaxed">
        ✓ {completed.length} FVS {completed.length === 1 ? 'concluída' : 'concluídas'} nesta data —
        rastreabilidade de qualidade em dia.
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NovoRdoPanel() {
  const { rdos, addRdo, updateRdo, setActiveTab, loadTrechosFromPlanejamento, editingRdoId, setEditingRdoId } = useRdoStore()
  const editing = editingRdoId ? rdos.find((r) => r.id === editingRdoId && (r.template === 'padrao' || !r.template)) ?? null : null
  const planningActivities = usePlanejamentoMestreStore((s) => s.activities)
  const logos = useCompanySettingsStore((s) => s.logos)
  const equipamentosCadastrados = useEquipamentosStore((s) => s.equipamentos)
  const estoqueItens = useSuprimentosStore((s) => s.estoqueItens)
  const trabalhadores = useMaoDeObraStore((s) => s.workers)
  const equipes = useMaoDeObraStore((s) => s.crews)
  const nextNumber = rdos.length + 1

  // react-hook-form for core fields (rdoSchema)
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<RdoFormData>({
    resolver: zodResolver(rdoSchema),
    defaultValues: {
      date:        todayStr(),
      responsible: '',
      weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 25 },
      manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
      observations: '',
      incidents: '',
    },
  })

  // Dynamic arrays (not validated by rdoSchema directly — validated per-row below)
  const [equipment, setEquipment] = useState<Omit<RdoEquipmentEntry, 'id'>[]>([])
  const [services,  setServices]  = useState<Omit<RdoServiceEntry,  'id'>[]>([])
  const [materials, setMaterials] = useState<Omit<RdoMaterialConsumptionEntry, 'id'>[]>([])
  const [trechos,   setTrechos]   = useState<Omit<RdoTrechoEntry,   'id'>[]>([])
  const [photos,    setPhotos]    = useState<Omit<RdoPhoto,         'id'>[]>([])
  const [employeeNames, setEmployeeNames] = useState<string[]>([])
  const [employeeInput, setEmployeeInput] = useState('')
  const [geolocation, setGeolocation] = useState<{ lat: string; lng: string } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [loadingTrechos, setLoadingTrechos] = useState(false)
  const [submitError, setSubmitError]     = useState<string | null>(null)
  const [rdoNumber, setRdoNumber]         = useState(nextNumber)
  const [rdoTitle, setRdoTitle]           = useState('')
  const [showBaseMaterials, setShowBaseMaterials] = useState(false)
  const [showTextParse, setShowTextParse]   = useState(false)
  const [selectedLogoId, setSelectedLogoId] = useState<string | undefined>(undefined)

  // ── Extra identification fields (not in rdoSchema Zod) ────────────────────
  /**
   * A obra do RDO. Isto FALTAVA: só o RDO Compizzo tinha seletor de obra; aqui o `siteId` caía
   * silenciosamente em `activeObraId ?? null` (rdoStore), e como o padrão do seletor da Sidebar é
   * "Todas as obras", todo RDO regular nascia ÓRFÃO — sem obra nenhuma. Isso quebra o escopo por
   * obra, a medição por contrato e o alerta diário, que não consegue saber de que obra é o RDO.
   */
  const sites = useTorreStore((s) => s.sites)
  const [obraSiteId, setObraSiteId] = useState<string | null>(() => useActiveObraStore.getState().activeObraId)
  const [rdoLocal,            setRdoLocal]            = useState('')
  const [rdoGerenteContrato,  setRdoGerenteContrato]  = useState('')
  const [rdoTecnicoSeg,       setRdoTecnicoSeg]       = useState('')
  const [rdoEmpreiteira,      setRdoEmpreiteira]      = useState('')
  const [rdoServico,          setRdoServico]          = useState('')
  const [rdoOcorrencias,      setRdoOcorrencias]      = useState('')
  const [rdoFuncDiretos,      setRdoFuncDiretos]      = useState(0)
  const [rdoFuncIndiretos,    setRdoFuncIndiretos]    = useState(0)
  const [rdoQtdEquip,         setRdoQtdEquip]         = useState(0)
  const [rdoNumeroOS,         setRdoNumeroOS]         = useState('')
  const [rdoContrato,         setRdoContrato]         = useState('')
  const [rdoClimaManha,       setRdoClimaManha]       = useState('')
  const [rdoClimaTarde,       setRdoClimaTarde]       = useState('')
  const [rdoClimaNoite,       setRdoClimaNoite]       = useState('')
  const [rdoLocalTipo,        setRdoLocalTipo]        = useState('Frente principal')
  const [epiUtilizado,        setEpiUtilizado]        = useState<boolean | null>(null)
  const [qualityChecklist,    setQualityChecklist]    = useState({ ordemServico: false, bandeirola: false, projeto: false, obs: '' })
  const [stoppages,           setStoppages]           = useState<RdoStoppageEntry[]>([
    { period: 'morning', reason: '', start: '', end: '' },
    { period: 'afternoon', reason: '', start: '', end: '' },
    { period: 'night', reason: '', start: '', end: '' },
  ])
  const [activityHours,       setActivityHours]       = useState({ dayStart: '', dayEnd: '', nightStart: '', nightEnd: '' })
  const [workforceRows,       setWorkforceRows]       = useState<Omit<RdoWorkforceRow, 'id'>[]>([
    { role: 'Encarregado', outsourced: 0, direct: 0, hoursWorked: 8 },
    { role: 'Oficial', outsourced: 0, direct: 0, hoursWorked: 8 },
    { role: 'Ajudante', outsourced: 0, direct: 0, hoursWorked: 8 },
    { role: 'Operador', outsourced: 0, direct: 0, hoursWorked: 8 },
  ])
  useEffect(() => {
    if (!editing) return
    reset({ date: editing.date, responsible: editing.responsible, weather: editing.weather, manpower: editing.manpower, observations: editing.observations, incidents: editing.incidents })
    const semId = <T extends { id: string }>(x: T): Omit<T, 'id'> => {
      const copia: Partial<T> = { ...x }
      delete copia.id
      return copia as Omit<T, 'id'>
    }
    setEquipment(editing.equipment.map(semId))
    setServices(editing.services.map(semId))
    setMaterials((editing.materials ?? []).map(semId))
    setTrechos(editing.trechos.map(semId))
    setPhotos(editing.photos.map(semId))
    setEmployeeNames(editing.manpower.employeeNames ?? [])
    setGeolocation(editing.geolocation ? { lat: String(editing.geolocation.lat), lng: String(editing.geolocation.lng) } : null)
    setRdoNumber(editing.number); setRdoTitle(editing.title ?? ''); setSelectedLogoId(editing.logoId)
    setObraSiteId(editing.siteId ?? null); setRdoLocal(editing.local ?? ''); setRdoGerenteContrato(editing.gerenteContrato ?? '')
    setRdoTecnicoSeg(editing.tecnicoSeguranca ?? ''); setRdoEmpreiteira(editing.nomeEmpreiteira ?? ''); setRdoServico(editing.servicoExecutar ?? '')
    setRdoOcorrencias(editing.ocorrencias ?? ''); setRdoFuncDiretos(editing.funcionariosDiretos ?? 0); setRdoFuncIndiretos(editing.funcionariosIndiretos ?? 0)
    setRdoQtdEquip(editing.qtdEquipamentosFerramentas ?? 0); setRdoNumeroOS(editing.numeroOS ?? ''); setRdoContrato(editing.numeroContrato ?? '')
    setRdoClimaManha(editing.climaManha ?? ''); setRdoClimaTarde(editing.climaTarde ?? ''); setRdoClimaNoite(editing.climaNoite ?? '')
    setRdoLocalTipo(editing.localTipo ?? 'Frente principal'); setEpiUtilizado(editing.epiUtilizado ?? null)
    if (editing.qualityChecklist) setQualityChecklist({ ordemServico: editing.qualityChecklist.ordemServico, bandeirola: editing.qualityChecklist.bandeirola, projeto: editing.qualityChecklist.projeto, obs: editing.qualityChecklist.obs ?? '' })
    if (editing.stoppages) setStoppages(editing.stoppages)
    if (editing.activityHours) setActivityHours({ dayStart: editing.activityHours.dayStart ?? '', dayEnd: editing.activityHours.dayEnd ?? '', nightStart: editing.activityHours.nightStart ?? '', nightEnd: editing.activityHours.nightEnd ?? '' })
    if (editing.workforceRows) setWorkforceRows(editing.workforceRows.map(semId))
  }, [editing, reset])

  useEffect(() => () => setEditingRdoId(null), [setEditingRdoId])
  const executablePlanningActivities = useMemo(
    () => planningActivities.filter((activity) => activity.level >= 1 && !activity.isMilestone),
    [planningActivities],
  )

  // ── Equipment helpers ──────────────────────────────────────────────────────
  function addEquipmentRow() {
    setEquipment((prev) => [...prev, { name: '', quantity: 1, hours: 8, operator: '', front: rdoLocalTipo || '', notes: '' }])
  }
  function patchEquipment(i: number, patch: Partial<Omit<RdoEquipmentEntry, 'id'>>) {
    setEquipment((prev) => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }
  function linkEquipment(i: number, equipmentId: string) {
    const eq = equipamentosCadastrados.find((item) => item.id === equipmentId)
    if (!eq) {
      patchEquipment(i, { equipmentId: undefined, code: undefined, type: undefined })
      return
    }
    patchEquipment(i, {
      equipmentId: eq.id,
      code: eq.code,
      type: eq.type,
      name: eq.name,
      operator: eq.operator ?? equipment[i]?.operator ?? '',
      front: eq.siteName ?? equipment[i]?.front ?? rdoLocalTipo ?? '',
    })
  }
  function removeEquipment(i: number) {
    setEquipment((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Service helpers ────────────────────────────────────────────────────────
  function addServiceRow(stageName?: string) {
    const stage = ACTIVITY_STAGES.find((item) => item.stage === stageName)
    setServices((prev) => [...prev, {
      contractItemCode: '',
      description: stage?.stage ?? '',
      activityStage: stage?.stage ?? '',
      front: rdoLocalTipo || '',
      quantity: 0,
      unit: stage?.unit ?? 'm²',
      measurementWeightPct: stage?.weight,
      measurementWeightWithoutMaterialPct: stage?.weightWithoutMaterial,
      dailyProgressPct: 0,
      accumulatedProgressPct: 0,
      measurementCriterion: stage ? `Executado conforme critério de medição da etapa ${stage.stage}.` : '',
      qualityStatus: 'pending',
      evidenceRequired: true,
    }])
  }
  function addActivityTemplate() {
    setServices((prev) => [
      ...prev,
      ...ACTIVITY_STAGES.map((stage) => ({
        contractItemCode: '',
        description: stage.stage,
        activityStage: stage.stage,
        front: rdoLocalTipo || '',
        quantity: 0,
        unit: stage.unit,
        measurementWeightPct: stage.weight,
        measurementWeightWithoutMaterialPct: stage.weightWithoutMaterial,
        dailyProgressPct: 0,
        accumulatedProgressPct: 0,
        measurementCriterion: `Executado conforme critério de medição da etapa ${stage.stage}.`,
        qualityStatus: 'pending' as const,
        evidenceRequired: true,
      })),
    ])
  }
  function updateService(i: number, field: keyof Omit<RdoServiceEntry, 'id'>, val: string | number) {
    setServices((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }
  function patchService(i: number, patch: Partial<Omit<RdoServiceEntry, 'id'>>) {
    setServices((prev) => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }
  function linkPlanningActivity(i: number, activityId: string) {
    const activity = executablePlanningActivities.find((item) => item.id === activityId)
    if (!activity) {
      patchService(i, { planningActivityId: undefined, operationalKey: undefined })
      return
    }
    patchService(i, {
      planningActivityId: activity.id,
      operationalKey: activity.operationalKey || `${activity.wbsCode}|${activity.name}`.toLowerCase(),
      contractItemCode: services[i]?.contractItemCode || activity.wbsCode,
      description: services[i]?.description || activity.name,
      front: activity.local || services[i]?.front || rdoLocalTipo || '',
      unit: activity.unidade || services[i]?.unit || 'un',
      quantity: services[i]?.quantity ?? 0,
      accumulatedProgressPct: activity.percentComplete ?? services[i]?.accumulatedProgressPct ?? 0,
    })
  }
  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i))
  }

  // â”€â”€ Material helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function addMaterialRow(materialName = '') {
    setMaterials((prev) => [...prev, {
      material: materialName,
      quantity: 0,
      unit: '',
      unitCostBRL: 0,
      totalCostBRL: 0,
      source: 'almoxarifado',
      activityStage: '',
      front: rdoLocalTipo || '',
      notes: '',
      isBaseTemplate: false,
    }])
  }
  function toggleMaterialTemplate() {
    if (showBaseMaterials) {
      setMaterials((prev) => prev.filter((row) => !row.isBaseTemplate))
      setShowBaseMaterials(false)
      return
    }
    const materialNames = [...new Set(ACTIVITY_STAGES.flatMap((stage) => stage.materials))]
    setMaterials((prev) => [
      ...prev,
      ...materialNames.map((material) => ({
        material,
        quantity: 0,
        unit: '',
        unitCostBRL: 0,
        totalCostBRL: 0,
        source: 'almoxarifado' as const,
        activityStage: '',
        front: rdoLocalTipo || '',
        notes: '',
        isBaseTemplate: true,
      })),
    ])
    setShowBaseMaterials(true)
  }
  function patchMaterial(i: number, patch: Partial<Omit<RdoMaterialConsumptionEntry, 'id'>>) {
    setMaterials((prev) => prev.map((row, idx) => {
      if (idx !== i) return row
      const next = { ...row, ...patch }
      const quantity = Number(next.quantity) || 0
      const unitCost = Number(next.unitCostBRL) || 0
      const shouldRecalculate = 'quantity' in patch || 'unitCostBRL' in patch || next.totalCostBRL === undefined
      return shouldRecalculate ? { ...next, totalCostBRL: quantity * unitCost } : next
    }))
  }
  function removeMaterial(i: number) {
    setMaterials((prev) => prev.filter((_, idx) => idx !== i))
  }

  function linkStockItem(i: number, stockItemId: string) {
    const item = estoqueItens.find((stock) => stock.id === stockItemId)
    if (!item) {
      patchMaterial(i, { stockItemId: undefined, depositoId: undefined, availableQtyAtSelection: undefined })
      return
    }
    patchMaterial(i, {
      stockItemId: item.id,
      depositoId: item.depositoId,
      material: item.descricao,
      unit: item.unidade,
      unitCostBRL: item.custoUnitario ?? 0,
      availableQtyAtSelection: item.qtdDisponivel,
      source: 'almoxarifado',
    })
  }

  function updateStoppage(i: number, patch: Partial<RdoStoppageEntry>) {
    setStoppages((prev) => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }

  function addWorkforceRow() {
    setWorkforceRows((prev) => [...prev, { role: '', outsourced: 0, direct: 0, hoursWorked: 8 }])
  }

  function updateWorkforceRow(i: number, patch: Partial<Omit<RdoWorkforceRow, 'id'>>) {
    setWorkforceRows((prev) => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }

  function toggleWorkerInRow(i: number, workerId: string) {
    setWorkforceRows((prev) => prev.map((row, idx) => {
      if (idx !== i) return row
      const workerIds = row.workerIds ?? []
      const nextWorkerIds = workerIds.includes(workerId)
        ? workerIds.filter((id) => id !== workerId)
        : [...workerIds, workerId]
      return { ...row, workerIds: nextWorkerIds }
    }))
  }

  function removeWorkforceRow(i: number) {
    setWorkforceRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Trecho helpers ─────────────────────────────────────────────────────────
  function addTrechoRow() {
    setTrechos((prev) => [...prev, {
      trechoCode: '', trechoDescription: '',
      plannedMeters: 0, executedMeters: 0,
      status: 'not_started', source: 'manual',
    }])
  }
  function updateTrecho(i: number, updates: Partial<Omit<RdoTrechoEntry, 'id'>>) {
    setTrechos((prev) => prev.map((row, idx) => {
      if (idx !== i) return row
      const updated = { ...row, ...updates }
      // Auto-compute status from meters
      const exec = updated.executedMeters
      const plan = updated.plannedMeters
      if ('executedMeters' in updates || 'plannedMeters' in updates) {
        if (exec === 0) updated.status = 'not_started' as RdoTrechoStatus
        else if (plan > 0 && exec >= plan) updated.status = 'completed' as RdoTrechoStatus
        else updated.status = 'in_progress' as RdoTrechoStatus
      }
      return updated
    }))
  }
  function removeTrecho(i: number) {
    setTrechos((prev) => prev.filter((_, idx) => idx !== i))
  }
  async function handleLoadTrechos() {
    setLoadingTrechos(true)
    try {
      const loaded = await loadTrechosFromPlanejamento()
      if (loaded.length > 0) {
        setTrechos(loaded.map((trecho) => {
          const { id, ...rest } = trecho
          void id
          return rest
        }))
      }
    } finally {
      setLoadingTrechos(false)
    }
  }

  // ── Text paste auto-fill ─────────────────────────────────────────────────
  const NI = 'Não informado'

  function handleApplyParsed(data: ParsedRdoData) {
    if (data.date)                       setValue('date', data.date)
    if (data.responsible)                setValue('responsible', data.responsible)
    if (data.manpower.foremanCount)      setValue('manpower.foremanCount',  data.manpower.foremanCount)
    if (data.manpower.officialCount)     setValue('manpower.officialCount', data.manpower.officialCount)
    if (data.manpower.helperCount)       setValue('manpower.helperCount',   data.manpower.helperCount)
    if (data.manpower.operatorCount)     setValue('manpower.operatorCount', data.manpower.operatorCount)
    if (data.observations)               setValue('observations', data.observations)
    if (data.ocorrencias && data.ocorrencias !== NI) setValue('incidents', data.ocorrencias)
    setEquipment((prev) => [...prev, ...data.equipment])
    setServices((prev)  => [...prev, ...data.services])
    setTrechos((prev)   => [...prev, ...data.trechos])
    setEmployeeNames((prev) => [...new Set([...prev, ...data.employeeNames])])
    // Extra fields
    if (data.local !== NI)              setRdoLocal(data.local)
    if (data.gerenteContrato !== NI)    setRdoGerenteContrato(data.gerenteContrato)
    if (data.tecnicoSeguranca !== NI)   setRdoTecnicoSeg(data.tecnicoSeguranca)
    if (data.nomeEmpreiteira !== NI)    setRdoEmpreiteira(data.nomeEmpreiteira)
    if (data.servicoExecutar !== NI)    setRdoServico(data.servicoExecutar)
    if (data.ocorrencias !== NI)        setRdoOcorrencias(data.ocorrencias)
    if (data.funcionariosDiretos > 0)   setRdoFuncDiretos(data.funcionariosDiretos)
    if (data.funcionariosIndiretos > 0) setRdoFuncIndiretos(data.funcionariosIndiretos)
    if (data.qtdEquipamentosFerramentas > 0) setRdoQtdEquip(data.qtdEquipamentosFerramentas)
    if (data.numeroOS !== NI)           setRdoNumeroOS(data.numeroOS)
    if (data.numeroContrato !== NI)     setRdoContrato(data.numeroContrato)
    if (data.climaManha !== NI)         setRdoClimaManha(data.climaManha)
    if (data.climaTarde !== NI)         setRdoClimaTarde(data.climaTarde)
    if (data.climaNoite !== NI)         setRdoClimaNoite(data.climaNoite)
    setShowTextParse(false)
  }

  // ── GPS ───────────────────────────────────────────────────────────────────
  function handleGetGps() {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não suportada pelo navegador.')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocation({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        })
        setGeoLoading(false)
      },
      () => {
        setGeoError('Não foi possível obter localização. Verifique as permissões.')
        setGeoLoading(false)
      },
      { timeout: 10000 },
    )
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotoError(null)

    if (photos.length + files.length > MAX_PHOTOS) {
      setPhotoError(`Máximo ${MAX_PHOTOS} fotos permitidas.`)
      return
    }

    files.forEach(async (file) => {
      if (!ALLOWED_MIME.includes(file.type)) {
        setPhotoError('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.')
        return
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setPhotoError(`"${file.name}" excede ${MAX_SIZE_MB} MB.`)
        return
      }
      // Comprime, mostra o thumbnail JÁ (base64) e sobe pro Storage EM BACKGROUND —
      // não trava a tela em rede ruim. Ao terminar, anexa o storagePath (casa pelo
      // base64, único). Offline/demo/erro fica só o base64 (fallback).
      try {
        const blob = await compressImageToBlob(file)
        const base64 = await blobToDataUrl(blob)
        setPhotos((prev) => [
          ...prev,
          { base64, label: file.name, uploadedAt: new Date().toISOString() },
        ])
        if (!isNonProductionDataMode()) {
          void uploadRdoPhoto(blob)
            .then((storagePath) => setPhotos((prev) => prev.map((p) => (p.base64 === base64 ? { ...p, storagePath } : p))))
            .catch(() => { /* offline/sem org: mantém o base64 como fallback */ })
        }
      } catch {
        setPhotoError(`Não foi possível processar "${file.name}".`)
      }
    })
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function removePhoto(i: number) {
    const p = photos[i]
    if (p?.storagePath) void removeRdoPhoto(p.storagePath)
    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
  }
  function updatePhotoLabel(i: number, label: string) {
    setPhotos((prev) => prev.map((p, idx) => idx === i ? { ...p, label } : p))
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function onValid(data: RdoFormData) {
    setSubmitError(null)
    const savedTitle = rdoTitle.trim()
    const payload = {
      // Status EXPLÍCITO: o cliente trata ausência como finalizado (isRdoFinalized), mas o
      // trigger de estoque no servidor exige payload->>'status' = 'finalizado' EXATO — sem
      // isto, RDO regular com material de almoxarifado nunca baixava estoque.
      status:      editing?.status ?? 'finalizado' as const,
      title:       savedTitle || undefined,
      date:        data.date,
      responsible: data.responsible,
      weather:     data.weather,
      manpower:    { ...data.manpower, employeeNames },
      observations: data.observations,
      incidents:   data.incidents,
      equipment:   equipment.map((e) => ({ ...e, id: crypto.randomUUID() })),
      services:    services.map((s) => ({ ...s, id: crypto.randomUUID() })),
      materials:   materials.map((m) => ({
        ...m,
        id: crypto.randomUUID(),
        totalCostBRL: m.totalCostBRL ?? ((Number(m.quantity) || 0) * (Number(m.unitCostBRL) || 0)),
      })),
      trechos:     trechos.map((t) => ({ ...t, id: crypto.randomUUID() })),
      photos:      leanPhotosForPersist(photos.map((p) => ({ ...p, id: crypto.randomUUID() }))),
      geolocation,
      logoId:      selectedLogoId,
      // Identification fields
      siteId:                     obraSiteId,
      local:                      rdoLocal || (obraSiteId ? sites.find((st) => st.id === obraSiteId)?.name : undefined) || undefined,
      gerenteContrato:            rdoGerenteContrato || undefined,
      tecnicoSeguranca:           rdoTecnicoSeg || undefined,
      nomeEmpreiteira:            rdoEmpreiteira || undefined,
      servicoExecutar:            rdoServico || undefined,
      ocorrencias:                rdoOcorrencias || undefined,
      funcionariosDiretos:        rdoFuncDiretos || undefined,
      funcionariosIndiretos:      rdoFuncIndiretos || undefined,
      qtdEquipamentosFerramentas: rdoQtdEquip || undefined,
      numeroOS:                   rdoNumeroOS || undefined,
      numeroContrato:             rdoContrato || undefined,
      climaManha:                 rdoClimaManha || undefined,
      climaTarde:                 rdoClimaTarde || undefined,
      climaNoite:                 rdoClimaNoite || undefined,
      localTipo:                  rdoLocalTipo || undefined,
      epiUtilizado:               epiUtilizado ?? undefined,
      qualityChecklist,
      stoppages,
      activityHours,
      workforceRows:              workforceRows.map((row) => ({ ...row, id: crypto.randomUUID() })),
    }
    if (editing) updateRdo(editing.id, payload)
    else addRdo(payload)
    // A baixa de estoque agora é feita no SERVIDOR (trigger trg_rdo_to_estoque),
    // de forma idempotente por rdo_id — não consumir no cliente para não duplicar.
    // (Requer a migration 20260625120000_rdo_estoque_integration.sql aplicada.)
    // Os apontamentos NÃO são criados aqui. Eram, com id aleatório e sem `sourceRdoId` — então
    // duplicavam a cada re-save e o reconcile do pull (que casa por `sourceRdoId`) nunca os
    // encontrava. Agora o `addRdo` do rdoStore deriva os apontamentos das `workforceRows` deste
    // mesmo RDO, com id determinístico por (rdo, trabalhador).
    setActiveTab('historico')
  }

  function handleClear() {
    if (!confirm('Limpar todos os dados do formulário?')) return
    reset()
    setEquipment([])
    setServices([])
    setMaterials([])
    setTrechos([])
    setPhotos([])
    setEmployeeNames([])
    setEmployeeInput('')
    setGeolocation(null)
    setGeoError(null)
    setPhotoError(null)
    setSubmitError(null)
    setSelectedLogoId(undefined)
    setRdoTitle('')
    setShowBaseMaterials(false)
    setRdoLocal(''); setRdoGerenteContrato(''); setRdoTecnicoSeg('')
    setRdoEmpreiteira(''); setRdoServico(''); setRdoOcorrencias('')
    setRdoFuncDiretos(0); setRdoFuncIndiretos(0); setRdoQtdEquip(0)
    setRdoNumeroOS(''); setRdoContrato('')
    setRdoClimaManha(''); setRdoClimaTarde(''); setRdoClimaNoite('')
    setRdoLocalTipo('Frente principal')
    setEpiUtilizado(null)
    setQualityChecklist({ ordemServico: false, bandeirola: false, projeto: false, obs: '' })
    setStoppages([
      { period: 'morning', reason: '', start: '', end: '' },
      { period: 'afternoon', reason: '', start: '', end: '' },
      { period: 'night', reason: '', start: '', end: '' },
    ])
    setActivityHours({ dayStart: '', dayEnd: '', nightStart: '', nightEnd: '' })
    setWorkforceRows([
      { role: 'Encarregado', outsourced: 0, direct: 0, hoursWorked: 8 },
      { role: 'Oficial', outsourced: 0, direct: 0, hoursWorked: 8 },
      { role: 'Ajudante', outsourced: 0, direct: 0, hoursWorked: 8 },
      { role: 'Operador', outsourced: 0, direct: 0, hoursWorked: 8 },
    ])
    setRdoNumber(rdos.length + 1)
  }

  // Watch da data do RDO para alimentar o banner de integração com Qualidade
  const watchedDate = useWatch({ control, name: 'date' }) as string

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-white font-semibold text-lg">{rdoTitle.trim() || 'Novo RDO'}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTextParse(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#f97316]/40 bg-[#f97316]/10 text-[#f97316] hover:bg-[#f97316]/20 transition-colors"
          >
            <ClipboardPaste size={13} />
            Preencher com Texto
          </button>
          <span className="text-[#a3a3a3] text-sm">RDO #{rdoNumber}</span>
        </div>
      </div>

      {/* Integração Qualidade ↔ RDO — banner de FVS pendentes na data */}
      <FvsIntegrationBanner date={watchedDate} />

      <form onSubmit={handleSubmit(onValid)} className="space-y-4">

        {/* 1. Informações Gerais */}
        <Section title="Informações Gerais" icon={<ClipboardList size={16} className="text-[#f97316]" />}>
          <div className="mb-4">
            <label className="block text-[#a3a3a3] text-xs mb-1">Nome do RDO</label>
            <input
              type="text"
              value={rdoTitle}
              onChange={(e) => setRdoTitle(e.target.value)}
              placeholder="Ex: Concretagem Torre A - Pavimento 3"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Data</label>
              <input type="date" {...register('date')} className={inputCls} />
              <FieldError msg={errors.date?.message} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Nº RDO</label>
              <input
                type="number"
                value={rdoNumber}
                onChange={(e) => setRdoNumber(Number(e.target.value))}
                className={inputCls}
                min={1}
              />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Responsável</label>
              <input type="text" {...register('responsible')} placeholder="Nome do responsável" className={inputCls} />
              <FieldError msg={errors.responsible?.message} />
            </div>
          </div>

          {/* Logo selector */}
          {logos.length > 0 && (
            <div className="mt-4">
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">
                Logo para o PDF
              </label>
              <div className="flex flex-wrap gap-2">
                {/* No logo option */}
                <button
                  type="button"
                  onClick={() => setSelectedLogoId(undefined)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    selectedLogoId === undefined
                      ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                      : 'border-[#525252] text-[#6b6b6b] hover:border-[#404040]'
                  }`}
                >
                  Sem logo
                </button>
                {logos.map((logo) => (
                  <button
                    key={logo.id}
                    type="button"
                    onClick={() => setSelectedLogoId(logo.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      selectedLogoId === logo.id
                        ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                        : 'border-[#525252] text-[#a3a3a3] hover:border-[#404040] hover:text-[#f5f5f5]'
                    }`}
                  >
                    <div className="w-8 h-5 bg-white rounded flex items-center justify-center overflow-hidden shrink-0">
                      <img src={logo.base64} alt={logo.name} className="max-h-4 max-w-full object-contain" />
                    </div>
                    {logo.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* 1b. Identificação do Contrato */}
        <Section title="Identificação do Contrato" icon={<FileText size={16} className="text-[#f97316]" />} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">
                Obra (Torre de Controle)
                {!obraSiteId && <span className="ml-1 text-[10px] text-[#fdba74]">— sem obra, o RDO não entra no escopo de nenhuma</span>}
              </label>
              <select
                value={obraSiteId ?? ''}
                onChange={(e) => setObraSiteId(e.target.value || null)}
                className={inputCls}
              >
                <option value="">Selecione a obra…</option>
                {/* Arquivadas continuam selecionáveis: pode ser preciso lançar um RDO atrasado de
                    uma obra que acabou de ser arquivada. */}
                {sites.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.code ? `${st.code} — ` : ''}{st.name}{obraEstaAtiva(st) ? '' : ' (arquivada)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Local / endereço</label>
              <input type="text" value={rdoLocal} onChange={(e) => setRdoLocal(e.target.value)} placeholder="Ex: Rua das Palmeiras, 100 — Centro" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Tipo de local</label>
              <select value={rdoLocalTipo} onChange={(e) => setRdoLocalTipo(e.target.value)} className={selectCls}>
                {LOCAL_TIPOS.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Nº Ordem de Serviço</label>
              <input type="text" value={rdoNumeroOS} onChange={(e) => setRdoNumeroOS(e.target.value)} placeholder="Ex: 2024/0587" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">N° do Contrato</label>
              <input type="text" value={rdoContrato} onChange={(e) => setRdoContrato(e.target.value)} placeholder="Ex: CT-2024-123" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Nome da Empreiteira</label>
              <input type="text" value={rdoEmpreiteira} onChange={(e) => setRdoEmpreiteira(e.target.value)} placeholder="Ex: Construtora ABC Ltda" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Gerente de Contrato</label>
              <input type="text" value={rdoGerenteContrato} onChange={(e) => setRdoGerenteContrato(e.target.value)} placeholder="Nome do gerente" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Técnico de Segurança</label>
              <input type="text" value={rdoTecnicoSeg} onChange={(e) => setRdoTecnicoSeg(e.target.value)} placeholder="Nome do técnico de segurança" className={inputCls} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Func. Diretos</label>
              <input type="number" value={rdoFuncDiretos} onChange={(e) => setRdoFuncDiretos(Number(e.target.value))} min={0} className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Func. Indiretos</label>
              <input type="number" value={rdoFuncIndiretos} onChange={(e) => setRdoFuncIndiretos(Number(e.target.value))} min={0} className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Qtd. Equipamentos</label>
              <input type="number" value={rdoQtdEquip} onChange={(e) => setRdoQtdEquip(Number(e.target.value))} min={0} className={inputCls} />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-[#a3a3a3] text-xs mb-1">Serviço a ser Executado</label>
            <textarea value={rdoServico} onChange={(e) => setRdoServico(e.target.value)} placeholder="Descrição do serviço principal a executar" rows={2} className={`${inputCls} resize-y`} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Clima Manhã</label>
              <input type="text" value={rdoClimaManha} onChange={(e) => setRdoClimaManha(e.target.value)} placeholder="Ex: Ensolarado" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Clima Tarde</label>
              <input type="text" value={rdoClimaTarde} onChange={(e) => setRdoClimaTarde(e.target.value)} placeholder="Ex: Nublado" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Clima Noite</label>
              <input type="text" value={rdoClimaNoite} onChange={(e) => setRdoClimaNoite(e.target.value)} placeholder="Ex: Limpo" className={inputCls} />
            </div>
          </div>
        </Section>

        {/* 2. Condições Climáticas */}
        <Section title="Condições Climáticas" icon={<CloudSun size={16} className="text-[#f97316]" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['morning', 'afternoon', 'night'] as const).map((period) => {
              const labels = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' }
              return (
                <div key={period}>
                  <label className="block text-[#a3a3a3] text-xs mb-1">{labels[period]}</label>
                  <select {...register(`weather.${period}`)} className={selectCls}>
                    {WEATHER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Temperatura (°C)</label>
              <input
                type="number"
                step="0.1"
                {...register('weather.temperatureC', { valueAsNumber: true })}
                className={inputCls}
                placeholder="25"
              />
              <FieldError msg={errors.weather?.temperatureC?.message} />
            </div>
          </div>
        </Section>

        <Section title="Controle Operacional e Qualidade" icon={<CheckSquare size={16} className="text-[#f97316]" />}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#e5e5e5]">
                <input
                  type="checkbox"
                  checked={epiUtilizado === true}
                  onChange={(e) => setEpiUtilizado(e.target.checked ? true : null)}
                  className="h-4 w-4 accent-[#f97316]"
                />
                EPI utilizado
              </label>
              {([
                ['ordemServico', 'Ordem de serviço'],
                ['bandeirola', 'Bandeirola'],
                ['projeto', 'Projeto'],
              ] as const).map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#e5e5e5]">
                  <input
                    type="checkbox"
                    checked={qualityChecklist[field]}
                    onChange={(e) => setQualityChecklist((prev) => ({ ...prev, [field]: e.target.checked }))}
                    className="h-4 w-4 accent-[#f97316]"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Observação de qualidade</label>
              <textarea
                value={qualityChecklist.obs}
                onChange={(e) => setQualityChecklist((prev) => ({ ...prev, obs: e.target.value }))}
                rows={2}
                className={`${inputCls} resize-y`}
                placeholder="Pendências, liberações ou evidências de controle"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Início diurno</label>
                <input type="time" value={activityHours.dayStart} onChange={(e) => setActivityHours((prev) => ({ ...prev, dayStart: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Fim diurno</label>
                <input type="time" value={activityHours.dayEnd} onChange={(e) => setActivityHours((prev) => ({ ...prev, dayEnd: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Início noturno</label>
                <input type="time" value={activityHours.nightStart} onChange={(e) => setActivityHours((prev) => ({ ...prev, nightStart: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Fim noturno</label>
                <input type="time" value={activityHours.nightEnd} onChange={(e) => setActivityHours((prev) => ({ ...prev, nightEnd: e.target.value }))} className={inputCls} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[#a3a3a3] text-xs">Paralisações por período</div>
              {stoppages.map((row, i) => {
                const labels = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' }
                return (
                  <div key={row.period} className="grid grid-cols-1 sm:grid-cols-[90px_1fr_120px_120px] gap-2 items-center">
                    <div className="text-sm text-[#e5e5e5]">{labels[row.period]}</div>
                    <select value={row.reason} onChange={(e) => updateStoppage(i, { reason: e.target.value })} className={selectCls}>
                      <option value="">Sem paralisação</option>
                      {STOPPAGE_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                    </select>
                    <input type="time" value={row.start} onChange={(e) => updateStoppage(i, { start: e.target.value })} className={inputCls} />
                    <input type="time" value={row.end} onChange={(e) => updateStoppage(i, { end: e.target.value })} className={inputCls} />
                  </div>
                )
              })}
            </div>
          </div>
        </Section>

        {/* 3. Mão de Obra */}
        <Section title="Mão de Obra" icon={<Users size={16} className="text-[#f97316]" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {([
              ['foremanCount',  'Encarregado'],
              ['officialCount', 'Oficial'],
              ['helperCount',   'Ajudante'],
              ['operatorCount', 'Operador'],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-[#a3a3a3] text-xs mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  {...register(`manpower.${field}`, { valueAsNumber: true })}
                  className={inputCls}
                  placeholder="0"
                />
                <FieldError msg={errors.manpower?.[field]?.message} />
              </div>
            ))}
          </div>
          <div className="mb-4 rounded-lg border border-[#525252] bg-[#1f1f1f]/70 p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[#e5e5e5] text-sm font-medium">Mão de obra detalhada</div>
              <button
                type="button"
                onClick={addWorkforceRow}
                className="flex items-center gap-1.5 text-[#f97316] hover:text-[#ea580c] text-sm"
              >
                <Plus size={14} /> Adicionar cargo
              </button>
            </div>
            <div className="space-y-2">
              {workforceRows.map((row, i) => (
                <div key={i} className="rounded-lg border border-[#525252] bg-[#2c2c2c]/60 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_110px_32px] gap-2 items-end">
                    <div>
                      <label className="block text-[#a3a3a3] text-xs mb-1">Cargo</label>
                      <input
                        type="text"
                        value={row.role}
                        onChange={(e) => updateWorkforceRow(i, { role: e.target.value })}
                        placeholder="Cargo"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[#a3a3a3] text-xs mb-1">Terceir.</label>
                      <input
                        type="number"
                        value={row.outsourced}
                        onChange={(e) => updateWorkforceRow(i, { outsourced: Number(e.target.value) })}
                        min={0}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[#a3a3a3] text-xs mb-1">Diretos</label>
                      <input
                        type="number"
                        value={row.direct}
                        onChange={(e) => updateWorkforceRow(i, { direct: Number(e.target.value) })}
                        min={0}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[#a3a3a3] text-xs mb-1">Horas</label>
                      <input
                        type="number"
                        value={row.hoursWorked ?? 8}
                        onChange={(e) => updateWorkforceRow(i, { hoursWorked: Number(e.target.value) })}
                        min={0}
                        max={24}
                        step={0.5}
                        className={inputCls}
                      />
                    </div>
                    <button type="button" onClick={() => removeWorkforceRow(i)} className="text-red-400 hover:text-red-300 p-2">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[#a3a3a3] text-xs mb-1">Atividade vinculada</label>
                      <input
                        type="text"
                        value={row.activityDescription ?? ''}
                        onChange={(e) => updateWorkforceRow(i, { activityDescription: e.target.value })}
                        placeholder="Ex: assentamento, acabamento, apoio"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[#a3a3a3] text-xs mb-1">Observação</label>
                      <input
                        type="text"
                        value={row.notes ?? ''}
                        onChange={(e) => updateWorkforceRow(i, { notes: e.target.value })}
                        placeholder="Apontamento, frente ou turno"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  {trabalhadores.length > 0 && (
                    <div>
                      <label className="block text-[#a3a3a3] text-xs mb-2">Trabalhadores do módulo Mão de Obra</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {trabalhadores.filter((worker) => worker.status === 'active').map((worker) => (
                          <label key={worker.id} className="flex items-center gap-2 rounded border border-[#525252] bg-[#1f1f1f]/70 px-2 py-1.5 text-xs text-[#d4d4d4]">
                            <input
                              type="checkbox"
                              checked={(row.workerIds ?? []).includes(worker.id)}
                              onChange={() => toggleWorkerInRow(i, worker.id)}
                              className="h-4 w-4 accent-[#f97316]"
                            />
                            <span className="truncate">{worker.name}</span>
                            <span className="ml-auto truncate text-[#6b6b6b]">{worker.role}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Employee name chips */}
          <div>
            <label className="block text-[#a3a3a3] text-xs mb-1">Funcionários Presentes</label>
            {equipes.length > 0 && (
              <select
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316] mb-2"
                value=""
                onChange={(e) => {
                  const crew = equipes.find((c) => c.id === e.target.value)
                  if (!crew) return
                  const names = crew.workerIds
                    .map((id) => trabalhadores.find((w) => w.id === id)?.name)
                    .filter((n): n is string => Boolean(n))
                  if (crew.foreman) names.unshift(crew.foreman)
                  setEmployeeNames((prev) => [...new Set([...prev, ...names])])
                }}
              >
                <option value="">— Adicionar equipe completa (módulo Mão de Obra) —</option>
                {equipes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.projectRef ? ` — ${c.projectRef}` : ''} ({c.workerIds.length} membro{c.workerIds.length !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {employeeNames.map((name, i) => (
                <span key={i} className="flex items-center gap-1 bg-sky-900/30 border border-sky-700/40 text-[#ea580c] text-xs px-2 py-0.5 rounded-full">
                  {name}
                  <button
                    type="button"
                    onClick={() => setEmployeeNames((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-[#f97316] hover:text-red-400 ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={employeeInput}
                onChange={(e) => setEmployeeInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ',') && employeeInput.trim()) {
                    e.preventDefault()
                    const name = employeeInput.trim()
                    if (name && !employeeNames.includes(name)) {
                      setEmployeeNames((prev) => [...prev, name])
                    }
                    setEmployeeInput('')
                  }
                }}
                placeholder="Nome + Enter para adicionar"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() => {
                  const name = employeeInput.trim()
                  if (name && !employeeNames.includes(name)) {
                    setEmployeeNames((prev) => [...prev, name])
                  }
                  setEmployeeInput('')
                }}
                className="px-3 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-sm transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {employeeNames.length > 0 && (
              <p className="text-gray-600 text-xs mt-1">{employeeNames.length} funcionário{employeeNames.length !== 1 ? 's' : ''} registrado{employeeNames.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </Section>

        {/* 4. Equipamentos */}
        <Section title="Equipamentos" icon={<Wrench size={16} className="text-[#f97316]" />}>
          <div className="space-y-2">
            {equipment.length === 0 && (
              <p className="text-[#6b6b6b] text-sm italic">Nenhum equipamento adicionado.</p>
            )}
            {equipment.map((row, i) => (
              <div key={i} className="rounded-lg border border-[#525252] bg-[#1f1f1f]/70 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px_100px_32px] gap-2 items-end">
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Cadastro</label>
                    <select value={row.equipmentId ?? ''} onChange={(e) => linkEquipment(i, e.target.value)} className={selectCls}>
                      <option value="">Manual / sem cadastro</option>
                      {equipamentosCadastrados.map((eq) => (
                        <option key={eq.id} value={eq.id}>{eq.code} - {eq.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Equipamento utilizado</label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => patchEquipment(i, { name: e.target.value })}
                      placeholder="Ex: Retroescavadeira, compactador"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Qtd.</label>
                    <input
                      type="number"
                      value={row.quantity}
                      onChange={(e) => patchEquipment(i, { quantity: Number(e.target.value) })}
                      min={0}
                      max={99}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Horas usadas</label>
                    <input
                      type="number"
                      value={row.hours}
                      onChange={(e) => patchEquipment(i, { hours: Number(e.target.value) })}
                      min={0}
                      max={24}
                      step={0.5}
                      className={inputCls}
                    />
                  </div>
                  <button type="button" onClick={() => removeEquipment(i)} className="text-red-400 hover:text-red-300 p-2">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Tipo / código</label>
                    <input
                      type="text"
                      value={[row.code, row.type].filter(Boolean).join(' - ')}
                      readOnly
                      placeholder="Preenchido pelo cadastro"
                      className={`${inputCls} opacity-80`}
                    />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Operador</label>
                    <input type="text" value={row.operator ?? ''} onChange={(e) => patchEquipment(i, { operator: e.target.value })} placeholder="Nome do operador" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Frente / observação</label>
                    <input type="text" value={row.notes ?? ''} onChange={(e) => patchEquipment(i, { notes: e.target.value })} placeholder="Local, turno, condição" className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
            {equipment.length > 0 && (
              <p className="text-[#6b6b6b] text-xs">
                Total: {equipment.reduce((s, r) => s + r.quantity * r.hours, 0).toFixed(1)} h·equip
              </p>
            )}
            <button
              type="button"
              onClick={addEquipmentRow}
              className="flex items-center gap-1.5 text-[#f97316] hover:text-[#ea580c] text-sm mt-1"
            >
              <Plus size={14} /> Adicionar Equipamento
            </button>
          </div>
        </Section>

        {/* 5. Serviços Executados */}
        <Section title="Serviços Executados e Medição" icon={<ClipboardList size={16} className="text-[#f97316]" />}>
          <div className="space-y-3">
            <div className="rounded-lg border border-[#525252] bg-[#1f1f1f]/70 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-[#f5f5f5] text-sm font-medium">Controle por etapa do serviço</div>
                  <p className="text-[#a3a3a3] text-xs mt-1">
                    Lance a frente, unidade, quantidade executada, peso de medição e status de aceite. Esses dados alimentam o dashboard do RDO.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={addActivityTemplate} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#f97316]/40 bg-[#f97316]/10 text-[#f97316] hover:bg-[#f97316]/20 text-xs font-medium">
                    <Calculator size={14} /> Etapas padrão
                  </button>
                  <button type="button" onClick={() => addServiceRow()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#525252] text-[#f5f5f5] hover:border-[#f97316]/50 text-xs font-medium">
                    <Plus size={14} /> Etapa avulsa
                  </button>
                </div>
              </div>
            </div>
            {services.length === 0 && (
              <p className="text-[#6b6b6b] text-sm italic">Nenhum serviço adicionado.</p>
            )}
            {services.map((row, i) => (
              <div key={i} className="rounded-lg border border-[#525252] bg-[#1f1f1f]/70 p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="text"
                  value={row.contractItemCode ?? ''}
                  onChange={(e) => updateService(i, 'contractItemCode', e.target.value)}
                  placeholder="Código / Nº preço"
                  className={`${inputCls} sm:w-40`}
                  title="Código ou Nº preço para Medição"
                />
                <input
                  type="text"
                  value={row.description}
                  onChange={(e) => updateService(i, 'description', e.target.value)}
                  placeholder="Descrição do serviço"
                  className={`${inputCls} flex-1`}
                />
                <input
                  type="number"
                  value={row.quantity}
                  onChange={(e) => updateService(i, 'quantity', Number(e.target.value))}
                  min={0}
                  className={`${inputCls} w-24`}
                  title="Quantidade"
                />
                <input
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateService(i, 'unit', e.target.value)}
                  placeholder="un"
                  className={`${inputCls} w-16`}
                  title="Unidade"
                />
                <button type="button" onClick={() => removeService(i)} className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 size={15} />
                </button>
                </div>

                <div>
                  <label className="block text-[#a3a3a3] text-xs mb-1">Atividade do Planejamento</label>
                  <select
                    value={row.planningActivityId ?? ''}
                    onChange={(e) => linkPlanningActivity(i, e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Sem vínculo com Planejamento</option>
                    {executablePlanningActivities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.wbsCode} - {activity.name}
                        {activity.local ? ` (${activity.local})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Etapa padrão</label>
                    <select
                      value={row.activityStage ?? ''}
                      onChange={(e) => {
                        const stage = ACTIVITY_STAGES.find((item) => item.stage === e.target.value)
                        patchService(i, {
                          activityStage: e.target.value,
                          description: stage?.stage ?? row.description,
                          unit: stage?.unit ?? row.unit,
                          measurementWeightPct: stage?.weight ?? row.measurementWeightPct,
                          measurementWeightWithoutMaterialPct: stage?.weightWithoutMaterial ?? row.measurementWeightWithoutMaterialPct,
                        })
                      }}
                      className={selectCls}
                    >
                      <option value="">Sem etapa padrão</option>
                      {ACTIVITY_STAGES.map((stage) => <option key={stage.stage} value={stage.stage}>{stage.stage}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Frente / local</label>
                    <input
                      type="text"
                      value={row.front ?? ''}
                      onChange={(e) => updateService(i, 'front', e.target.value)}
                      placeholder="Ex: garagem, subsolo 1, setor B"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Peso medição %</label>
                    <input type="number" value={row.measurementWeightPct ?? 0} onChange={(e) => updateService(i, 'measurementWeightPct', Number(e.target.value))} min={0} step="0.01" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Sem material %</label>
                    <input type="number" value={row.measurementWeightWithoutMaterialPct ?? 0} onChange={(e) => updateService(i, 'measurementWeightWithoutMaterialPct', Number(e.target.value))} min={0} step="0.01" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">% dia</label>
                    <input type="number" value={row.dailyProgressPct ?? 0} onChange={(e) => updateService(i, 'dailyProgressPct', Number(e.target.value))} min={0} step="0.01" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">% acumulado</label>
                    <input type="number" value={row.accumulatedProgressPct ?? 0} onChange={(e) => updateService(i, 'accumulatedProgressPct', Number(e.target.value))} min={0} step="0.01" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Aceite</label>
                    <select value={row.qualityStatus ?? 'pending'} onChange={(e) => patchService(i, { qualityStatus: e.target.value as RdoServiceEntry['qualityStatus'] })} className={selectCls}>
                      <option value="pending">Pendente</option>
                      <option value="approved">Aprovado</option>
                      <option value="rework">Retrabalho</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[#a3a3a3] text-xs mb-1">Critério / observação da medição</label>
                  <input
                    type="text"
                    value={row.measurementCriterion ?? ''}
                    onChange={(e) => updateService(i, 'measurementCriterion', e.target.value)}
                    placeholder="Ex: medir após cura, limpeza, aceite técnico e evidência fotográfica"
                    className={inputCls}
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[#d4d4d4]">
                  <input
                    type="checkbox"
                    checked={row.evidenceRequired ?? false}
                    onChange={(e) => patchService(i, { evidenceRequired: e.target.checked })}
                    className="h-4 w-4 accent-[#f97316]"
                  />
                  Exigir foto/evidência para esta etapa
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addServiceRow()}
              className="flex items-center gap-1.5 text-[#f97316] hover:text-[#ea580c] text-sm mt-1"
            >
              <Plus size={14} /> Adicionar Serviço
            </button>
          </div>
        </Section>

        <Section title="Materiais e Consumo" icon={<Package size={16} className="text-[#f97316]" />}>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-[#525252] bg-[#1f1f1f]/70 p-3">
              <p className="text-[#a3a3a3] text-xs leading-relaxed">
                Registre material usado no dia, origem, valor unitário e total. O total é calculado automaticamente por quantidade x valor unitário.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={toggleMaterialTemplate} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium ${
                  showBaseMaterials
                    ? 'border-[#f97316]/60 bg-[#f97316]/20 text-[#f97316]'
                    : 'border-[#f97316]/40 bg-[#f97316]/10 text-[#f97316] hover:bg-[#f97316]/20'
                }`}>
                  <Package size={14} /> Insumos base
                </button>
                <button type="button" onClick={() => addMaterialRow()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#525252] text-[#f5f5f5] hover:border-[#f97316]/50 text-xs font-medium">
                  <Plus size={14} /> Material avulso
                </button>
              </div>
            </div>
            {materials.length === 0 && (
              <p className="text-[#6b6b6b] text-sm italic">Nenhum material adicionado.</p>
            )}
            {materials.map((row, i) => (
              <div key={i} className="rounded-lg border border-[#525252] bg-[#1f1f1f]/70 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_150px_32px] gap-2 items-end">
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Insumo do Suprimentos</label>
                    <select value={row.stockItemId ?? ''} onChange={(e) => linkStockItem(i, e.target.value)} className={selectCls}>
                      <option value="">Manual / sem estoque</option>
                      {estoqueItens.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.descricao} ({item.qtdDisponivel} {item.unidade})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Material</label>
                    <input type="text" value={row.material} onChange={(e) => patchMaterial(i, { material: e.target.value })} placeholder="Ex: disco diamantado, fita crepe, rolo 9cm" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Origem</label>
                    <select value={row.source ?? 'almoxarifado'} onChange={(e) => patchMaterial(i, { source: e.target.value as RdoMaterialConsumptionEntry['source'] })} className={selectCls}>
                      {MATERIAL_SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => removeMaterial(i)} className="text-red-400 hover:text-red-300 p-2">
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Quantidade</label>
                    <input type="number" value={row.quantity} onChange={(e) => patchMaterial(i, { quantity: Number(e.target.value) })} min={0} step="0.01" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Unidade</label>
                    <input type="text" value={row.unit ?? ''} onChange={(e) => patchMaterial(i, { unit: e.target.value })} placeholder="Opcional" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Valor unitário</label>
                    <input type="number" value={row.unitCostBRL ?? 0} onChange={(e) => patchMaterial(i, { unitCostBRL: Number(e.target.value) })} min={0} step="0.01" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Valor total</label>
                    <input type="number" value={row.totalCostBRL ?? 0} readOnly className={`${inputCls} opacity-80`} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Etapa vinculada</label>
                    <select value={row.activityStage ?? ''} onChange={(e) => patchMaterial(i, { activityStage: e.target.value })} className={selectCls}>
                      <option value="">Sem vínculo</option>
                      {ACTIVITY_STAGES.map((stage) => <option key={stage.stage} value={stage.stage}>{stage.stage}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Frente / local</label>
                    <input type="text" value={row.front ?? ''} onChange={(e) => patchMaterial(i, { front: e.target.value })} placeholder="Ex: garagem, subsolo 1" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[#a3a3a3] text-xs mb-1">Observação</label>
                    <input type="text" value={row.notes ?? ''} onChange={(e) => patchMaterial(i, { notes: e.target.value })} placeholder="Nota, pedido, evidência ou comentário" className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
            {materials.length > 0 && (
              <div className="text-right text-sm text-[#f5f5f5]">
                Total de materiais no RDO: <strong className="text-[#f97316]">
                  {materials.reduce((sum, item) => sum + (Number(item.totalCostBRL) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
            )}
          </div>
        </Section>

        {/* 6. Avanço por Trecho */}
        <Section title="Avanço por Trecho" icon={<Route size={16} className="text-[#f97316]" />}>
          <div className="space-y-3">
            {trechos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#a3a3a3] text-xs">
                      <th className="text-left pb-2 font-medium">Código</th>
                      <th className="text-left pb-2 font-medium">Descrição</th>
                      <th className="text-left pb-2 font-medium">Planejado (m)</th>
                      <th className="text-left pb-2 font-medium">Executado (m)</th>
                      <th className="text-left pb-2 font-medium">Sistema</th>
                      <th className="text-left pb-2 font-medium">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {trechos.map((row, i) => (
                      <tr key={i} className="border-t border-[#525252]">
                        <td className="py-1.5 pr-2">
                          <input
                            type="text"
                            value={row.trechoCode}
                            onChange={(e) => updateTrecho(i, { trechoCode: e.target.value })}
                            className={`${inputCls} w-20`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="text"
                            value={row.trechoDescription}
                            onChange={(e) => updateTrecho(i, { trechoDescription: e.target.value })}
                            className={`${inputCls} w-36`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            value={row.plannedMeters}
                            onChange={(e) => updateTrecho(i, { plannedMeters: Number(e.target.value) })}
                            min={0} className={`${inputCls} w-24`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            value={row.executedMeters}
                            onChange={(e) => updateTrecho(i, { executedMeters: Number(e.target.value) })}
                            min={0} className={`${inputCls} w-24`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select
                            value={row.system ?? ''}
                            onChange={(e) => updateTrecho(i, { system: (e.target.value as RdoTrechoEntry['system']) || undefined })}
                            className="bg-[#3d3d3d] border border-[#1f3c5e] rounded px-2 py-1 text-xs text-[#f5f5f5]"
                          >
                            <option value="">Sistema...</option>
                            <option value="agua">Água</option>
                            <option value="esgoto">Esgoto</option>
                            <option value="drenagem">Drenagem</option>
                            <option value="estrutura">Estrutura</option>
                            <option value="pavimentacao">Pavimentação</option>
                            <option value="outro">Outro</option>
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            row.status === 'completed'   ? 'bg-emerald-900/50 text-emerald-300' :
                            row.status === 'in_progress' ? 'bg-yellow-900/50 text-yellow-300'  :
                                                           'bg-[#484848] text-[#a3a3a3]'
                          }`}>
                            {row.status === 'completed'   ? 'Concluído'     :
                             row.status === 'in_progress' ? 'Em Execução'  :
                                                            'Não Iniciado'}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <button type="button" onClick={() => removeTrecho(i)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {trechos.length === 0 && (
              <p className="text-[#6b6b6b] text-sm italic">Nenhum trecho adicionado.</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={addTrechoRow}
                className="flex items-center gap-1.5 text-[#f97316] hover:text-[#ea580c] text-sm"
              >
                <Plus size={14} /> Adicionar Trecho
              </button>
              <button
                type="button"
                onClick={handleLoadTrechos}
                disabled={loadingTrechos}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-sm transition-colors disabled:opacity-50"
              >
                {loadingTrechos ? 'Carregando...' : '↓ Carregar da Rede'}
              </button>
            </div>
          </div>
        </Section>

        {/* 7. Georreferenciamento */}
        <Section title="Georreferenciamento" icon={<MapPin size={16} className="text-[#f97316]" />} defaultOpen={false}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Latitude</label>
                <input
                  type="text"
                  value={geolocation?.lat ?? ''}
                  onChange={(e) => setGeolocation((g) => ({ lat: e.target.value, lng: g?.lng ?? '' }))}
                  placeholder="-23.550520"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Longitude</label>
                <input
                  type="text"
                  value={geolocation?.lng ?? ''}
                  onChange={(e) => setGeolocation((g) => ({ lat: g?.lat ?? '', lng: e.target.value }))}
                  placeholder="-46.633308"
                  className={inputCls}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleGetGps}
              disabled={geoLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-sm transition-colors disabled:opacity-50"
            >
              <MapPin size={14} />
              {geoLoading ? 'Obtendo...' : 'Obter GPS'}
            </button>
            {geoError && <p className="text-red-400 text-sm">{geoError}</p>}
          </div>
        </Section>

        {/* 8. Observações e Ocorrências */}
        <Section title="Observações e Ocorrências" icon={<Pencil size={16} className="text-[#f97316]" />} defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Observações Gerais</label>
              <textarea
                {...register('observations')}
                rows={4}
                placeholder="Descreva as atividades realizadas, condições do local, etc."
                className={`${inputCls} resize-none`}
              />
              <FieldError msg={errors.observations?.message} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Ocorrências / Incidentes</label>
              <textarea
                {...register('incidents')}
                rows={4}
                placeholder="Registre acidentes, interrupções, ocorrências relevantes..."
                className={`${inputCls} resize-none`}
              />
              <FieldError msg={errors.incidents?.message} />
            </div>
          </div>
        </Section>

        {/* Photo upload */}
        <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-5 space-y-4">
          <div className="flex items-center gap-2.5 text-gray-100 font-medium text-sm">
            <Camera size={16} className="text-[#f97316]" />
            Registro Fotográfico
            <span className="text-[#6b6b6b] text-xs font-normal">({photos.length}/{MAX_PHOTOS})</span>
          </div>

          {/* ⚠️ Este quadro EXISTIA e era só decorativo: tinha cara de área de soltar e só
              respondia ao clique. Quem arrastava a foto para cá saía do aplicativo. */}
          <AreaDeSoltar
            varios
            aceita="image/jpeg,image/png,image/webp,image/gif"
            titulo="Arraste as fotos aqui ou clique para selecionar"
            ajuda={`JPEG, PNG, WebP, GIF · máx. ${MAX_SIZE_MB} MB por arquivo · ${MAX_PHOTOS} fotos`}
            aoEscolher={(arquivos) => {
              handleFileSelect({ target: { files: arquivos, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>)
            }}
          />
          {photoError && <p className="text-red-400 text-sm">{photoError}</p>}

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo, i) => (
                <div key={i} className="relative group">
                  <RdoPhotoImg
                    photo={photo}
                    alt={photo.label}
                    className="w-full h-28 object-cover rounded-lg border border-[#525252]"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-[#2c2c2c]/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={13} className="text-red-400" />
                  </button>
                  <input
                    type="text"
                    value={photo.label}
                    onChange={(e) => updatePhotoLabel(i, e.target.value)}
                    placeholder="Legenda"
                    className="mt-1.5 w-full bg-[#484848] border border-[#5e5e5e] rounded text-xs text-[#f5f5f5] px-2 py-1 focus:outline-none focus:border-[#f97316]/50"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg bg-[#484848] px-4 py-2 text-sm font-medium text-[#f5f5f5] transition-colors hover:bg-[#525252]"
          >
            Limpar
          </button>
          <button
            type="submit"
            className="rounded-lg px-6 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            Salvar RDO
          </button>
        </div>
      </form>

      {showTextParse && (
        <TextParseModal
          onClose={() => setShowTextParse(false)}
          onApply={handleApplyParsed}
        />
      )}
    </div>
  )
}
