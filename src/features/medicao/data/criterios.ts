/**
 * criterios.ts — Critérios de Medição Sabesp (Contrato 11481051).
 *
 * Extraído das planilhas de medição. Inclui os principais códigos de serviço
 * visíveis na Planilha de Medição Sabesp (Medição 10 - mar/26).
 *
 * TODO: Importar o PDF completo (435 págs) para expandir este catálogo.
 */

export interface CriterioMedicao {
  nPreco:        string   // ex.: "420009"
  descricao:     string
  unidade:       string
  grupo:         '01' | '02' | '03'
  grupoNome:     string
  compreende:    string
  medicao:       string
  notas:         string
}

export const CRITERIOS_MEDICAO: CriterioMedicao[] = [
  // ── Grupo 01 — Canteiros e Planos ──────────────────────────────────────────
  {
    nPreco:    '500001',
    descricao: 'Canteiro de obras global (GB)',
    unidade:   'GB',
    grupo:     '01',
    grupoNome: 'Canteiros e Planos',
    compreende: 'Implantação, manutenção e desmobilização do canteiro de obras, incluindo alojamentos, escritórios, depósitos, energia e água provisória.',
    medicao:   'Por global (GB), mediante apresentação de cronograma de desembolso aprovado pela fiscalização.',
    notas:     'O canteiro deverá atender às normas de segurança e saúde NR-18.',
  },
  {
    nPreco:    '300001',
    descricao: 'Elaboração de projetos e planos (GB)',
    unidade:   'GB',
    grupo:     '01',
    grupoNome: 'Canteiros e Planos',
    compreende: 'Projetos executivos, planos de controle ambiental, plano de segurança, cadastro as-built e demais documentação técnica exigida.',
    medicao:   'Por global (GB), mediante aprovação dos documentos pela fiscalização Sabesp.',
    notas:     'Inclui ART/RRT do responsável técnico.',
  },

  // ── Grupo 02 — Esgoto ──────────────────────────────────────────────────────
  {
    nPreco:    '410002',
    descricao: 'Rebaixamento de lençol freático (M)',
    unidade:   'M',
    grupo:     '02',
    grupoNome: 'Esgoto',
    compreende: 'Execução de sistema de rebaixamento do lençol freático com ponteiras filtrantes, bombeamento e descarte adequado da água.',
    medicao:   'Por metro linear (M) de rede executada em trecho onde o rebaixamento foi necessário, comprovado por relatório diário assinado pela fiscalização.',
    notas:     'Medição somente para trechos com lençol freático acima da cota de assentamento. Não cumulativo com outros serviços de esgotamento.',
  },
  {
    nPreco:    '420009',
    descricao: 'Assentamento de rede de esgoto PVC DN 150 mm (M)',
    unidade:   'M',
    grupo:     '02',
    grupoNome: 'Esgoto',
    compreende: 'Fornecimento e assentamento de tubo PVC série R DN 150 mm, incluindo escavação, carga e transporte de material, reaterro compactado e recomposição de pavimento.',
    medicao:   'Por metro linear (M) medido entre eixos de PVs/TBs, ao longo do eixo do coletor.',
    notas:     'Profundidade de referência até 2,00 m. Para maiores profundidades aplicar itens específicos de escavação especial.',
  },
  {
    nPreco:    '420010',
    descricao: 'Assentamento de rede de esgoto PVC DN 200 mm (M)',
    unidade:   'M',
    grupo:     '02',
    grupoNome: 'Esgoto',
    compreende: 'Fornecimento e assentamento de tubo PVC série R DN 200 mm, incluindo escavação, carga e transporte de material, reaterro compactado e recomposição de pavimento.',
    medicao:   'Por metro linear (M) medido entre eixos de PVs/TBs, ao longo do eixo do coletor.',
    notas:     'Profundidade de referência até 2,00 m.',
  },
  {
    nPreco:    '420011',
    descricao: 'Assentamento de rede de esgoto PVC DN 250 mm (M)',
    unidade:   'M',
    grupo:     '02',
    grupoNome: 'Esgoto',
    compreende: 'Fornecimento e assentamento de tubo PVC série R DN 250 mm, incluindo escavação, carga e transporte, reaterro e recomposição.',
    medicao:   'Por metro linear (M) medido entre eixos de estruturas.',
    notas:     'Profundidade de referência até 2,00 m.',
  },
  {
    nPreco:    '430001',
    descricao: 'Ramal predial de esgoto — ligação domiciliar (UN)',
    unidade:   'UN',
    grupo:     '02',
    grupoNome: 'Esgoto',
    compreende: 'Execução de ramal predial de esgoto desde o coletor público até a caixa de inspeção do imóvel, incluindo escavação, tubo PVC DN 100 mm, luvas, caps e reaterro.',
    medicao:   'Por unidade (UN) de ramal executado e aceito pela fiscalização, com apresentação da ficha de cadastro.',
    notas:     'Comprimento padrão até 5,00 m. Excedente medido pelo item de extensão de ramal.',
  },
  {
    nPreco:    '430002',
    descricao: 'Ligação predial de esgoto — extensão de ramal (M)',
    unidade:   'M',
    grupo:     '02',
    grupoNome: 'Esgoto',
    compreende: 'Metro excedente ao padrão de 5,00 m no ramal predial de esgoto.',
    medicao:   'Por metro linear (M) de extensão além dos 5,00 m padrão.',
    notas:     'Medição vinculada ao item 430001.',
  },
  {
    nPreco:    '440001',
    descricao: 'Pavimentação — recomposição asfáltica (M²)',
    unidade:   'M²',
    grupo:     '02',
    grupoNome: 'Esgoto',
    compreende: 'Recomposição de pavimento asfáltico após execução de valas, incluindo regularização de base, imprimação e CBUQ conforme especificação.',
    medicao:   'Por metro quadrado (M²) de pavimento recomposto e aceito pela fiscalização.',
    notas:     'Espessura mínima de 5 cm de CBUQ.',
  },
  {
    nPreco:    '450001',
    descricao: 'Esgotamento de valas (M)',
    unidade:   'M',
    grupo:     '02',
    grupoNome: 'Esgoto',
    compreende: 'Esgotamento de valas com emprego de bombas submersíveis ou centrífugas durante todo o período de execução dos serviços, exceto rebaixamento de lençol freático.',
    medicao:   'Por metro linear (M) de trecho onde o esgotamento foi comprovadamente necessário.',
    notas:     'Não acumulável com o item 410002.',
  },

  // ── Grupo 03 — Água ────────────────────────────────────────────────────────
  {
    nPreco:    '120001',
    descricao: 'Assentamento de rede de água PVC DN 50 mm (M)',
    unidade:   'M',
    grupo:     '03',
    grupoNome: 'Água',
    compreende: 'Fornecimento e assentamento de tubulação PVC PBA DN 50 mm, incluindo escavação, reaterro compactado e recomposição de pavimento.',
    medicao:   'Por metro linear (M) ao longo do eixo da tubulação.',
    notas:     'Profundidade mínima de 0,80 m do topo da rede ao nível do pavimento.',
  },
  {
    nPreco:    '120002',
    descricao: 'Assentamento de rede de água PVC DN 75 mm (M)',
    unidade:   'M',
    grupo:     '03',
    grupoNome: 'Água',
    compreende: 'Fornecimento e assentamento de tubulação PVC PBA DN 75 mm, incluindo escavação, reaterro e recomposição.',
    medicao:   'Por metro linear (M) ao longo do eixo da tubulação.',
    notas:     '',
  },
  {
    nPreco:    '120003',
    descricao: 'Assentamento de rede de água PVC DN 100 mm (M)',
    unidade:   'M',
    grupo:     '03',
    grupoNome: 'Água',
    compreende: 'Fornecimento e assentamento de tubulação PVC PBA DN 100 mm, incluindo escavação, reaterro e recomposição.',
    medicao:   'Por metro linear (M) ao longo do eixo da tubulação.',
    notas:     '',
  },
  {
    nPreco:    '130001',
    descricao: 'Ligação predial de água (UN)',
    unidade:   'UN',
    grupo:     '03',
    grupoNome: 'Água',
    compreende: 'Execução de ligação predial de água, incluindo derivação da rede, cavalete, hidrômetro e caixa de proteção.',
    medicao:   'Por unidade (UN) de ligação executada e aceita pela fiscalização.',
    notas:     '',
  },
]

/** Retorna todos os critérios de um grupo */
export function getCriteriosByGrupo(grupo: '01' | '02' | '03'): CriterioMedicao[] {
  return CRITERIOS_MEDICAO.filter((c) => c.grupo === grupo)
}

/** Busca critérios por nPreco ou texto na descrição (case insensitive) */
export function searchCriterios(query: string): CriterioMedicao[] {
  const q = query.toLowerCase().trim()
  if (!q) return CRITERIOS_MEDICAO
  return CRITERIOS_MEDICAO.filter(
    (c) =>
      c.nPreco.includes(q) ||
      c.descricao.toLowerCase().includes(q) ||
      c.compreende.toLowerCase().includes(q)
  )
}
