import type { ConstructionSite, Project } from '@/types'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function siteToProject(site: ConstructionSite): Project {
  const startDate = site.startDate || todayIso()
  const endDate = site.expectedEnd || startDate
  const address = [site.street, site.number, site.district, site.city, site.state].filter(Boolean).join(', ')

  return {
    id: `site:${site.id}`,
    code: site.code || `OBRA-${site.id.slice(0, 6).toUpperCase()}`,
    name: site.name,
    owner: site.owner || site.company || '',
    manager: site.manager || '',
    description: site.description || site.serviceScope || site.buildingType || '',
    status: site.status === 'completed' ? 'completed' : site.status === 'paused' ? 'on_hold' : site.status === 'planning' ? 'planning' : 'active',
    startDate,
    endDate,
    planningPhases: [
      { id: `${site.id}-planejamento`, name: 'Planejamento', status: site.status === 'planning' ? 'in_progress' : 'completed', progress: site.status === 'planning' ? 25 : 100, startDate, endDate: startDate },
    ],
    executionPhases: [
      { id: `${site.id}-execucao`, name: 'Execução', status: site.status === 'completed' ? 'completed' : site.status === 'paused' ? 'delayed' : 'in_progress', progress: site.status === 'completed' ? 100 : 0, startDate, endDate },
    ],
    budgetLines: (site.budgetLines ?? []).map((line, index) => ({
      id: `${site.id}-budget-${index}`,
      type: index === 0 ? 'other' : 'materials',
      description: line.label,
      budgeted: line.amount,
      projected: line.projected,
      spent: 0,
    })),
    demands: [],
    documents: [],
    lat: site.lat ?? undefined,
    lng: site.lng ?? undefined,
    address,
    clientName: site.owner || site.company || '',
    projectManager: site.manager || '',
    riskLevel: site.risks.some((risk) => risk.level === 'critical' && risk.status === 'active')
      ? 'critical'
      : site.risks.some((risk) => risk.level === 'high' && risk.status === 'active')
        ? 'high'
        : 'low',
    priority: site.risks.some((risk) => risk.status === 'active') ? 'high' : 'medium',
  }
}

export function mergeProjectsWithSites(projects: Project[], sites: ConstructionSite[]) {
  const realKeys = new Set(projects.flatMap((project) => [
    project.code.toLowerCase(),
    project.name.toLowerCase(),
    project.address?.toLowerCase() ?? '',
  ]))
  const siteProjects = sites
    .filter((site) => !realKeys.has(site.code.toLowerCase()) && !realKeys.has(site.name.toLowerCase()))
    .map(siteToProject)

  return [...projects, ...siteProjects]
}
