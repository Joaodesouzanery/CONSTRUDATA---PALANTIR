import { ControlMap } from '@/components/shared/ControlMap'
import { useProjetosStore } from '@/store/projetosStore'

export function Gestao360MapDashboard() {
  const projects = useProjetosStore((s) => s.projects)
  return <ControlMap projects={projects} />
}
