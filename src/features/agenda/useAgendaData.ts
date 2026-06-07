/**
 * useAgendaData — fonte combinada da Agenda: tarefas nativas do agendaStore +
 * atividades do Planejamento Mestre exibidas como uma "raia" (recurso) própria,
 * em tempo real. As tarefas de planejamento são somente leitura na Agenda
 * (a edição acontece no módulo Planejamento e reflete aqui automaticamente).
 */
import { useMemo } from 'react'
import { useAgendaStore } from '@/store/agendaStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { AgendaTask, AgendaResource } from '@/types'

export const PLAN_RESOURCE_ID = 'planejamento-mestre'

function agendaColorFor(nt?: string): AgendaTask['color'] {
  switch (nt) {
    case 'agua':       return 'orange'
    case 'esgoto':     return 'green'
    case 'civil':      return 'purple'
    case 'manutencao': return 'blue'
    case 'ambiental':  return 'green'
    default:           return 'blue'
  }
}

export function useAgendaData() {
  const tasks      = useAgendaStore((s) => s.tasks)
  const resources  = useAgendaStore((s) => s.resources)
  const activities = usePlanejamentoMestreStore((s) => s.activities)

  return useMemo(() => {
    const planTasks: AgendaTask[] = activities
      .filter((a) => a.level >= 1 && !a.isMilestone && a.plannedStart && a.plannedEnd)
      .map((a) => ({
        id: `plan-${a.id}`,
        title: a.name,
        resourceId: PLAN_RESOURCE_ID,
        startDate: a.plannedStart,
        endDate: a.plannedEnd,
        color: agendaColorFor(a.networkType),
        status: a.status === 'completed' ? 'completed' : 'scheduled',
        priority: 'medium',
        completionPct: a.percentComplete,
        location: [a.nucleo, a.area].filter(Boolean).join(' / ') || undefined,
        notes: 'Origem: Planejamento',
      }))

    const planResource: AgendaResource = {
      id: PLAN_RESOURCE_ID,
      code: 'PLAN',
      name: 'Planejamento',
      type: 'other',
      status: 'active',
    }

    return {
      tasks: [...tasks, ...planTasks],
      resources: planTasks.length > 0 ? [...resources, planResource] : resources,
    }
  }, [tasks, resources, activities])
}
