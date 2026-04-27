import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, ClipboardList, Camera, ShieldAlert, Wrench, PackageCheck, CircleDollarSign } from 'lucide-react'
import { useProjetosStore } from '@/store/projetosStore'
import { useGestao360Store } from '@/store/gestao360Store'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useRdoStore } from '@/store/rdoStore'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useAgendaStore } from '@/store/agendaStore'
import { readLocalRdoSabesp } from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'
import { getExecutedActivities } from '@/features/rdo-sabesp/lib/rdoSabespUtils'
import { Ecosystem360Panel } from '@/features/relatorio360/components/Ecosystem360Panel'

function Kpi({ label, value, icon: Icon, tone = '#f97316' }: {
  label: string
  value: string
  icon: typeof ClipboardList
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-[#a3a3a3]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${tone}18`, color: tone }}>
          <Icon size={15} />
        </span>
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#525252] bg-[#3d3d3d]">
      <div className="border-b border-[#525252] px-4 py-3 text-sm font-semibold text-white">{title}</div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function sameProject(haystack: string, projectName: string, projectCode: string) {
  const text = haystack.toLowerCase()
  const firstName = projectName.split(/\s+/)[0]?.toLowerCase() || ''
  return text.includes(projectName.toLowerCase()) || text.includes(projectCode.toLowerCase()) || (firstName.length > 3 && text.includes(firstName))
}

function happensOnDate(startDate: string, endDate: string | undefined, date: string) {
  if (!startDate) return false
  const end = endDate || startDate
  return startDate <= date && end >= date
}

export function DailyReportPanel() {
  const projects = useProjetosStore((s) => s.projects)
  const selectedProjectId = useGestao360Store((s) => s.selectedProjectId)
  const changeOrders = useGestao360Store((s) => s.changeOrders)
  const reports = useRelatorio360Store((s) => s.reports)
  const rdos = useRdoStore((s) => s.rdos)
  const fvss = useQualidadeStore((s) => s.fvss)
  const nonConformities = useQualidadeStore((s) => s.nonConformities)
  const maintenanceOrders = useGestaoEquipamentosStore((s) => s.orders)
  const requisitions = useSuprimentosStore((s) => s.requisitions)
  const purchaseOrders = useSuprimentosStore((s) => s.purchaseOrders)
  const agendaTasks = useAgendaStore((s) => s.tasks)
  const agendaResources = useAgendaStore((s) => s.resources)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null
  const [sabespRdos] = useState(() => readLocalRdoSabesp())

  const daily = useMemo(() => {
    if (!project) {
      return {
        reports360: [],
        regularRdos: [],
        sabesp: [],
        fvs: [],
        ncs: [],
        maintenance: [],
        reqs: [],
        pos: [],
        agenda: [],
        activities: [],
        photos: [],
      }
    }

    const reports360 = Object.values(reports).filter(
      (report) => report.date === date && sameProject(report.projectName, project.name, project.code),
    )
    const regularRdos = rdos.filter((rdo) => rdo.date === date && sameProject(`${rdo.responsible} ${rdo.observations} ${rdo.incidents}`, project.name, project.code))
    const sabesp = sabespRdos.filter((rdo) => rdo.report_date === date && sameProject(`${rdo.rua_beco} ${rdo.criadouro_outro} ${rdo.encarregado}`, project.name, project.code))
    const fvs = fvss.filter((item) => item.date === date)
    const ncs = nonConformities.filter((item) => item.createdAt.slice(0, 10) === date || item.date === date)
    const maintenance = maintenanceOrders.filter((order) => {
      const scheduledDate = (order as { scheduledDate?: string }).scheduledDate
      return scheduledDate === date
    })
    const reqs = requisitions.filter((req) => req.requestedAt.slice(0, 10) === date)
    const pos = purchaseOrders.filter((po) => po.issuedDate === date)
    const agenda = agendaTasks.filter((task) => {
      if (!happensOnDate(task.startDate, task.endDate, date)) return false
      if (task.linkedProjectId) return task.linkedProjectId === project.id
      const agendaText = `${task.title} ${task.location ?? ''} ${task.notes ?? ''} ${task.assignedTo ?? ''} ${task.teamLeadName ?? ''}`
      return sameProject(agendaText, project.name, project.code) || !task.linkedProjectId
    })
    const resourceById = new Map(agendaResources.map((resource) => [resource.id, resource]))
    const activities = [
      ...agenda.map((task) => {
        const resource = resourceById.get(task.resourceId)
        const detailParts = [
          'Agenda',
          task.startDate === task.endDate ? task.startDate : `${task.startDate} a ${task.endDate}`,
          task.location,
          task.assignedTo || task.teamLeadName,
          resource?.name,
        ].filter(Boolean)
        return {
          label: task.title,
          status: task.status === 'completed' ? 'concluida' : task.status === 'unscheduled' ? 'sem data' : 'agenda',
          detail: detailParts.join(' - '),
        }
      }),
      ...reports360.flatMap((report) => report.activities.map((activity) => ({
        label: activity.name,
        status: activity.status,
        detail: `${activity.actualQty}/${activity.plannedQty} ${activity.unit}`,
      }))),
      ...regularRdos.flatMap((rdo) => rdo.services.map((service) => ({
        label: service.description,
        status: 'rdo',
        detail: `${service.quantity} ${service.unit}`,
      }))),
      ...sabesp.flatMap((rdo) => getExecutedActivities(rdo).map((activity) => ({
        label: activity.label,
        status: rdo.status === 'draft' ? 'rascunho' : 'finalizado',
        detail: 'RDO Sabesp',
      }))),
    ]
    const photos = reports360.flatMap((report) => report.photos).slice(0, 8)

    return { reports360, regularRdos, sabesp, fvs, ncs, maintenance, reqs, pos, agenda, activities, photos }
  }, [project, reports, date, rdos, sabespRdos, fvss, nonConformities, maintenanceOrders, requisitions, purchaseOrders, agendaTasks, agendaResources])

  if (!project) {
    return <div className="text-sm text-[#a3a3a3]">Nenhum projeto disponível.</div>
  }

  const costImpact = changeOrders
    .filter((order) => order.projectId === project.id && order.submittedAt?.slice(0, 10) === date)
    .reduce((sum, order) => sum + order.impactCostBRL, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Daily Report</h2>
          <p className="text-xs text-[#a3a3a3]">{project.name}</p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm text-[#f5f5f5]">
          <CalendarDays size={15} className="text-[#f97316]" />
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="RDOs do dia" value={String(daily.regularRdos.length + daily.sabesp.length)} icon={ClipboardList} />
        <Kpi label="Atividades" value={String(daily.activities.length)} icon={PackageCheck} tone="#22c55e" />
        <Kpi label="Fotos" value={String(daily.photos.length)} icon={Camera} tone="#38bdf8" />
        <Kpi label="NCs abertas" value={String(daily.ncs.length)} icon={ShieldAlert} tone={daily.ncs.length ? '#ef4444' : '#22c55e'} />
      </div>

      <Ecosystem360Panel date={date} projectName={project.name} compact />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Section title="Atividades e RDOs">
          {daily.activities.length ? (
            <div className="space-y-2">
              {daily.activities.slice(0, 12).map((activity, index) => (
                <div key={`${activity.label}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#525252] bg-[#333333] px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{activity.label}</div>
                    <div className="text-xs text-[#a3a3a3]">{activity.detail}</div>
                  </div>
                  <span className="rounded-full bg-[#484848] px-2 py-1 text-[10px] font-semibold uppercase text-[#a3a3a3]">{activity.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[#a3a3a3]">Sem atividades registradas para este projeto na data selecionada.</div>
          )}
        </Section>

        <Section title="Alertas 360">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[#333333] px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[#d4d4d4]"><Wrench size={14} /> Manutenções</span>
              <strong className="text-white">{daily.maintenance.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#333333] px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[#d4d4d4]"><PackageCheck size={14} /> Requisições / OCs</span>
              <strong className="text-white">{daily.reqs.length + daily.pos.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#333333] px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[#d4d4d4]"><ShieldAlert size={14} /> FVS / Qualidade</span>
              <strong className="text-white">{daily.fvs.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#333333] px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[#d4d4d4]"><CircleDollarSign size={14} /> Impacto financeiro</span>
              <strong className="text-white">{costImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Registro fotográfico">
        {daily.photos.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {daily.photos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-lg border border-[#525252] bg-[#333333]">
                <img src={photo.base64} alt={photo.label} className="h-32 w-full object-cover" />
                <div className="truncate px-3 py-2 text-xs text-[#a3a3a3]">{photo.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[#a3a3a3]">Sem fotos no Relatório 360 para a data selecionada.</div>
        )}
      </Section>
    </div>
  )
}
