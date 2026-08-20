/**
 * A aba Dashboard de Gestão 360 — a tela que conduz a reunião.
 *
 * Era só o mapa. O mapa mostra ONDE estão as obras; a reunião precisa saber o que ACONTECEU no
 * período — e essa resposta já existia no Radar 360, enterrada dentro do Relatório 360 diário.
 * Agora ela abre a tela, obedecendo ao período e à obra escolhidos no cabeçalho, e o mapa fica
 * logo abaixo.
 */
import { ControlMap } from '@/components/shared/ControlMap'
import { useProjetosStore } from '@/store/projetosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useGestao360Store } from '@/store/gestao360Store'
import { useActiveObraStore } from '@/store/activeObraStore'
import { mergeProjectsWithSites } from '../utils/siteProjects'
import { Ecosystem360Panel } from '@/features/relatorio360/components/Ecosystem360Panel'

export function Gestao360MapDashboard() {
  const baseProjects = useProjetosStore((s) => s.projects)
  const sites = useTorreStore((s) => s.sites)
  const periodo = useGestao360Store((s) => s.periodo)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const projects = mergeProjectsWithSites(baseProjects, sites)
  const obraAtiva = sites.find((s) => s.id === activeObraId)

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <Ecosystem360Panel periodo={periodo} siteId={activeObraId} projectName={obraAtiva?.name} />
      <div className="min-h-[420px]">
        <ControlMap projects={projects} sites={sites} />
      </div>
    </div>
  )
}
