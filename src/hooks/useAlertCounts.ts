/**
 * Aggregates critical alert counts per module for sidebar badges.
 * Reads from stores with lightweight selectors — zero extra subscriptions
 * beyond what CommandCenterPanel already uses.
 */
import { useMemo } from 'react'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useTorreStore }           from '@/store/torreDeControleStore'
import { useGestao360Store }       from '@/store/gestao360Store'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useMaoDeObraStore }       from '@/store/maoDeObraStore'
import { useFrotaVeicularStore }   from '@/store/frotaVeicularStore'
import { useEconomiaStore }        from '@/store/economiaStore'
import { usePlanoExecucaoStore }   from '@/store/planoExecucaoStore'
import { useRdoStore }             from '@/store/rdoStore'
import { useFinanceiroTitulosStore } from '@/store/financeiroTitulosStore'
import { useManutencoesStore }     from '@/store/manutencoesStore'
import { useLaudosStore }          from '@/store/laudosStore'
import { laudoDiasRestantes }      from '@/features/predial/utils/laudos'
import { alertasDoPlano }          from '@/features/planejamento/utils/planoExecucao'
import { hojeLocalISO }            from '@/lib/utils'

/** Dias de antecedência para um título "a vencer" virar lembrete. */
const TITULO_ALERTA_DIAS = 7

export interface AlertCounts {
  [route: string]: number
}

export function useAlertCounts(): AlertCounts {
  const healthAlerts = useOtimizacaoFrotaStore((s) =>
    s.healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high').length
  )
  const siteRisks = useTorreStore((s) =>
    s.sites.reduce((acc, site) =>
      acc + site.risks.filter((r) => r.status === 'active' && (r.level === 'critical' || r.level === 'high')).length, 0)
  )
  const changeOrders = useGestao360Store((s) =>
    s.changeOrders.filter((co) => co.status === 'submitted').length
  )
  const maintOrders = useGestaoEquipamentosStore((s) =>
    s.orders.filter((o) => {
      if (o.status === 'completed' || o.status === 'cancelled') return false
      return new Date(o.scheduledDate + 'T00:00:00') < new Date()
    }).length
  )
  // Manutenções (OS abertas vencidas) — o módulo Predial agrega isso + equipamentos + saúde.
  const manutVencidas = useManutencoesStore((s) => {
    const hoje = hojeLocalISO()
    return s.workOrders.filter((w) => w.status !== 'concluida' && w.status !== 'cancelada' && !!w.dueDate && w.dueDate < hoje).length
  })
  // Compliance de Laudos: obrigações vencidas ou vencendo em ≤30 dias (crítico p/ o síndico).
  const laudosCriticos = useLaudosStore((s) =>
    s.laudos.filter((l) => { const d = laudoDiasRestantes(l.validade); return d != null && d <= 30 }).length
  )
  const occurrences = useMaoDeObraStore((s) =>
    s.occurrences.filter((o) => o.type === 'accident').length
  )
  const fleetAlerts = useFrotaVeicularStore((s) =>
    s.alerts.filter(
      (a) => a.isActive && (a.severity === 'critical' || a.severity === 'high'),
    ).length
  )
  const economyEvents = useEconomiaStore((s) =>
    s.events.filter((event) => event.status === 'detected' && event.impactBRL > 0).length
  )
  // Planejamento de Execução: planos ativos com alerta (atraso, RUP > TCPO, preço não confirmado).
  const planos = usePlanoExecucaoStore((s) => s.planos)
  const planoAbsences = useMaoDeObraStore((s) => s.absences)
  const planoRdos = useRdoStore((s) => s.rdos)
  const hoje = hojeLocalISO()   // local, não UTC: às 21h no BRT o UTC já virou amanhã
  // `alertasDoPlano` varre TODOS os RDOs por plano — O(planos × RDOs). Sem memo isso rodava
  // a cada render da Sidebar (qualquer mutação em qualquer store), travando a navegação.
  const planoAlerts = useMemo(
    () => planos.filter((p) => p.status === 'ativo' && alertasDoPlano(p, planoAbsences, hoje, planoRdos).length > 0).length,
    [planos, planoAbsences, planoRdos, hoje],
  )

  // Pagamentos e Cobranças: títulos pendentes vencidos ou dentro da própria antecedência.
  // Cada parcela de boleto pode ter o seu `alertaDias` (o usuário informa no cadastro);
  // usar 7 fixo para todas fazia o campo não valer nada fora do card.
  const titulosAlerta = useFinanceiroTitulosStore((s) =>
    s.titulos.filter((t) => {
      if (t.status !== 'pendente') return false
      const dias = Math.round(
        (new Date(t.vencimento + 'T12:00:00').getTime() - new Date(hoje + 'T12:00:00').getTime()) / 86_400_000,
      )
      return dias <= (t.alertaDias ?? TITULO_ALERTA_DIAS)
    }).length
  )

  // RDOs em rascunho (ainda não alimentam planejamento/financeiro/estoque).
  const rdoRascunhos = planoRdos.filter((r) => r.status === 'rascunho').length

  // Objeto memoizado: retornar um literal novo a cada chamada invalidava qualquer
  // memoização a jusante (a Sidebar re-renderizava mesmo com as contagens iguais).
  return useMemo(
    () => ({
      '/app/torre-de-controle':   siteRisks,
      '/app/gestao-360':          changeOrders,
      // Predial agrega: equipamentos vencidos + OS de manutenção vencidas + saúde crítica + laudos críticos.
      '/app/predial':             maintOrders + manutVencidas + healthAlerts + laudosCriticos,
      '/app/mao-de-obra':         occurrences + fleetAlerts,
      '/app/economia':            economyEvents,
      '/app/planejamento':        planoAlerts,
      '/app/evm':                 titulosAlerta,
      '/app/rdo':                 rdoRascunhos,
    }),
    [siteRisks, changeOrders, maintOrders, manutVencidas, healthAlerts, laudosCriticos,
     occurrences, fleetAlerts, economyEvents, planoAlerts, titulosAlerta, rdoRascunhos],
  )
}
