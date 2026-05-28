import { ControlMap } from '@/components/shared/ControlMap'
import { useProjetosStore } from '@/store/projetosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { mergeProjectsWithSites } from '../utils/siteProjects'

export function Gestao360MapDashboard() {
  const baseProjects = useProjetosStore((s) => s.projects)
  const sites = useTorreStore((s) => s.sites)
  const projects = mergeProjectsWithSites(baseProjects, sites)
  return <ControlMap projects={projects} sites={sites} />
}
