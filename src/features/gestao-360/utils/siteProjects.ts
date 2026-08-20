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

/**
 * O projeto que corresponde à obra ativa da barra lateral.
 *
 * Três caminhos, e os três precisam existir:
 *
 *   1. A obra virou projeto derivado (`site:<uuid>`) — o caso comum.
 *   2. A obra tem um projeto DE VERDADE cadastrado. Aí `mergeProjectsWithSites` descartou o
 *      derivado, e o elo é o `projectId` da obra.
 *   3. Nem um nem outro, mas o código ou o nome batem exatamente — que é como o merge decidiu
 *      que os dois eram a mesma coisa, na linha 59 deste arquivo.
 *
 * Sem os caminhos 2 e 3, uma obra com projeto cadastrado devolveria `null`, e Gestão 360 leria
 * isso como "todas as obras": o escopo abriria sozinho, em silêncio, bem na obra mais bem
 * cadastrada do cliente.
 *
 * `null` só quando não há obra ativa — aí "todas" é a resposta certa.
 */
export function projetoDaObraAtiva(
  projects: Project[],
  activeObraId: string | null,
  sites: ConstructionSite[] = [],
): Project | null {
  if (!activeObraId) return null

  const derivado = projects.find((p) => p.id === `site:${activeObraId}`)
  if (derivado) return derivado

  const obra = sites.find((s) => s.id === activeObraId)
  if (!obra) return projects.find((p) => p.id === activeObraId) ?? null

  if (obra.projectId) {
    const vinculado = projects.find((p) => p.id === obra.projectId)
    if (vinculado) return vinculado
  }

  const codigo = obra.code?.toLowerCase()
  const nome = obra.name?.toLowerCase()
  return projects.find((p) =>
    (codigo && p.code.toLowerCase() === codigo) || (nome && p.name.toLowerCase() === nome),
  ) ?? null
}
