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

  // ── Extraídos do PDF "Critério de Medição" (CT 11481051, 435 págs) ────────

  // Grupo 03 — Água (série 410xxx)
  {
    nPreco: '410002',
    descricao: 'Rebaixamento de lençol freático por conjunto de ponteiras até 2,00 m',
    unidade: 'M',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Fornecimento de todos os materiais, equipamentos e mão-de-obra necessários à completa execução do rebaixamento; Instalação do sistema de rebaixamento, incluindo execução de pré-furo e filtro para instalação de ponteiras; Operação e manutenção do sistema de rebaixamento, dando destinação adequada às águas resultantes; Fornecimento de água e energia elétrica.',
    medicao: 'Por extensão de vala rebaixada, em metro.',
    notas: '1. As profundidades indicadas referem-se às profundidades das valas. 2. No preço está compreendida a instalação de 1 linha de rebaixamento ao longo da vala.',
  },
  {
    nPreco: '410005',
    descricao: 'Mobilização de equipe e equipamentos para rebaixamento de ponteiras filtrantes',
    unidade: 'UN',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Mobilização, transporte e desmobilização de todos os equipamentos, tais como bombas de vácuo, ponteiras, perfuratrizes, tubos metálicos e PVC, braçadeiras, tanques de apoio, inclusive a mão-de-obra especializada.',
    medicao: 'Por unidade de mobilização efetuada.',
    notas: 'Este preço só deverá ser utilizado para mobilização de equipe e equipamentos no início dos serviços ou frentes de serviços distintas.',
  },
  {
    nPreco: '410007',
    descricao: 'Sondagem em leito (vala seca) c/ LPB do leito (A) - Água',
    unidade: 'UN',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Fornecimento de todos os recursos de mão de obra, materiais e equipamentos para execução de Sondagem com preparação de base no leito com Complexidade A-SP: liberação de via, mobilização, sinalização, levantamento de pavimentação, escavação manual ou mecânica, troca de solo, reaterro compactado, ensaios DCP, reposição da base, selagem, carga e transporte.',
    medicao: 'Será por sondagem executada, em unidade.',
    notas: '1. Utilizado para reparo de vazamentos não visíveis detectados pela SABESP. 2. Todos os materiais fornecidos pela CONTRATADA, exceto reparador asfáltico.',
  },
  {
    nPreco: '410072',
    descricao: 'Ligação/subst ligação avulsa de água até 32mm - MND - qualquer prof/dist s/ repos pav',
    unidade: 'UN',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Ligação de água avulsa ou substituição pelo método não destrutivo em tubo PEAD até 32mm: mobilização, pesquisa de interferências, locação da rede, sinalização, escavação de cavas, perfuração com equipamento apropriado, passagem do ramal, instalação/troca da tomada de água, conexão à rede e cavalete, envoltório de areia, instalação e lacração de hidrômetro, cadastro, reaterro compactado, ensaios DCP.',
    medicao: 'Será por ligação avulsa ou substituição de ligação de água executada em MND, em unidade.',
    notas: '1. Todos os materiais fornecidos pela CONTRATADA, exceto hidrômetro e lacre antifraude. 2. Supressão remunerada pelo preço 72000243.',
  },
  {
    nPreco: '410073',
    descricao: 'Ligação água suces / passagem de ligação de água - MND - s/ repos pav',
    unidade: 'UN',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Ligação de água sucessiva ou passagem para rede nova sem aproveitamento do ramal antigo pelo método não destrutivo em tubo PEAD até 32mm: mobilização, perfuração, passagem do ramal, instalação da tomada de água, conexão à rede e cavalete, instalação e lacração de hidrômetro.',
    medicao: 'Será por ligação sucessiva ou passagem de ligação de água efetuada, em unidade.',
    notas: '1. Todos os materiais fornecidos pela CONTRATADA, exceto hidrômetro e lacre antifraude.',
  },
  {
    nPreco: '410221',
    descricao: 'Adicional para inclusão de ligação em UMA múltipla',
    unidade: 'UN',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Retirada do hidrômetro e dispositivo de medição simples existentes, montagem de dispositivo de medição (simples ou duplo), instalação do(s) hidrômetro(s), conexão do tubo de polietileno ao ramal existente, fixação na Unidade de Medição, fechamento e lacração.',
    medicao: 'Será por inclusão de ligação em UMA múltipla efetuada, em unidade.',
    notas: '1. Todos os materiais fornecidos pela CONTRATADA, exceto hidrômetro, dispositivo de medição e lacres.',
  },
  {
    nPreco: '410222',
    descricao: 'Adicional para instalação de caixa para Unidade de Medição de Água',
    unidade: 'UN',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Corte da alvenaria, disposição provisória do material, instalação da caixa e tubo camisa em alvenaria, fixação, acabamento com argamassa desempenada, carga e transporte de material excedente.',
    medicao: 'Será por Instalação de Caixa para Unidade de Medição efetuada, em unidade.',
    notas: '1. Argamassa com aditivos de acelerador de pega. 2. Todos os materiais pela CONTRATADA, exceto a Caixa para UMA.',
  },
  {
    nPreco: '410355',
    descricao: 'Assentamento de rede de água em PEAD 32mm - c/ repos do pav',
    unidade: 'M',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Assentamento de tubos PEAD DN 32mm: mobilização, acompanhamento por topógrafo, locação conforme projeto, sinalização, pesquisa de interferências, passadiços, levantamento de pavimento, escavação, esgotamento, assentamento, envoltório em areia, interligação, troca de solo, reaterro compactado, ensaios DCP, cadastro e reposição do pavimento.',
    medicao: 'Será pela extensão de rede assentada, em metros.',
    notas: '1. Todos os materiais pela CONTRATADA, exceto hidrantes e válvulas. 2. Derivações, válvulas, hidrantes em marcha inclusos.',
  },
  {
    nPreco: '410356',
    descricao: 'Assentamento de rede de água em PEAD de 63 a 125mm - s/ repos do pav',
    unidade: 'M',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Assentamento de tubos PEAD DN 63 a 125mm: mobilização, acompanhamento topógrafo, locação, sinalização, tapume contínuo, passadiços, escavação, escoramento para prof >1.25m, esgotamento, assentamento, envoltório em areia, troca de solo, reaterro compactado, ensaios DCP.',
    medicao: 'Será pela extensão de rede assentada, em metros.',
    notas: '1. Todos os materiais pela CONTRATADA, exceto hidrantes e válvulas. 2. Interligações remuneradas pelos preços 72000389-91.',
  },
  {
    nPreco: '410394',
    descricao: 'Adicional para furação em carga de redes de água DN até 400mm - Interligações',
    unidade: 'UN',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Posicionamento e montagem da conexão, posicionamento e montagem da máquina elétrica de perfuração, perfuração do tubo e retirada da máquina.',
    medicao: 'Será por unidade de interligação executada, em unidade.',
    notas: 'Vinculado aos serviços de interligação (preços 72000389-91).',
  },
  {
    nPreco: '410419',
    descricao: 'Adicional para instalação de selas eletrossoldáveis para tubos de 40 a 90mm',
    unidade: 'UN',
    grupo: '03',
    grupoNome: 'Água',
    compreende: 'Raspagem e limpeza da zona de fusão, posicionamento, alinhamento e fixação do tê de serviço, conexão dos cabos da unidade de controle, entrada dos dados de fusão, aplicação do ciclo de fusão, verificação dos indicadores e espera de resfriamento.',
    medicao: 'Será por Instalação de sela Eletrossoldável, em unidade.',
    notas: '1. Todos os materiais hidráulicos serão fornecidos pela Sabesp.',
  },

  // Grupo 02 — Esgoto (série 420xxx / 500xxx esgoto)
  {
    nPreco: '420001',
    descricao: 'Caixa de inspeção (0,60 x 0,60 m)',
    unidade: 'UN',
    grupo: '02',
    grupoNome: 'Esgoto',
    compreende: 'Escavação, reaterro, lastro de brita, lastro de concreto magro, paredes de alvenaria, revestimento interno com argamassa impermeabilizante, chapisco externo, grade e/ou tampa, enchimento conforme projeto.',
    medicao: 'Por unidade de caixa executada.',
    notas: 'Não estão inclusos os elementos externos à caixa.',
  },
  {
    nPreco: '420009',
    descricao: 'Assentamento mecanizado de rede coletora de esgoto em PVC DN 150mm, prof até 2,0m (SFMH)',
    unidade: 'M',
    grupo: '02',
    grupoNome: 'Esgoto',
    compreende: 'Mobilização e deslocamento de equipe; locação e cadastro; sinalização de trânsito; tapume contínuo com iluminação; levantamento e reposição de passeio; escavação mecanizada exceto rocha; escoramento para prof >1.25m; esgotamento; lastro em brita/laje; manuseio e transporte de tubos; assentamento; troca de solo; envoltório em areia e reaterro com controle (GC≥95%); regularização; limpeza.',
    medicao: 'Será por metro de rede coletora de esgoto executada, medida entre os eixos das singularidades.',
    notas: 'Estão inclusos todos os custos diretos e indiretos, Encargos Sociais e B.D.I. Não inclui a execução dos poços de visita.',
  },
  {
    nPreco: '420010',
    descricao: 'Assentamento mecanizado de rede coletora de esgoto em PVC DN 200mm, prof até 2,0m (SFMH)',
    unidade: 'M',
    grupo: '02',
    grupoNome: 'Esgoto',
    compreende: 'Mobilização; locação e cadastro; sinalização; tapume contínuo; levantamento e reposição de passeio; escavação mecanizada exceto rocha; escoramento >1.25m; esgotamento; lastro; manuseio e transporte de tubos; assentamento; troca de solo; envoltório em areia e reaterro (GC≥95%); regularização; limpeza.',
    medicao: 'Será por metro de rede coletora de esgoto executada, medida entre os eixos das singularidades.',
    notas: 'Não inclui a execução dos poços de visita.',
  },

  // Grupo 01 — Canteiros (série 500xxx canteiro)
  {
    nPreco: '500001',
    descricao: 'Canteiro de Obras Esgoto - Implantação',
    unidade: 'GB',
    grupo: '01',
    grupoNome: 'Canteiros e Planos',
    compreende: 'Disponibilização de imóvel e/ou construção de escritórios, vestiários, sanitários, alojamentos, almoxarifados, refeitórios; ligações de energia, telefonia, água e esgoto; placas de obra; 2 veículos para fiscalização; 2 notebooks + 2 impressoras; 2 smartphones; fogões, geladeiras, micro-ondas; segurança e vigilância; equipamentos contrafogo; posterior desmobilização.',
    medicao: 'Pelo preço global: 90% após conclusão da instalação; 10% após desmobilização e devolução dos imóveis.',
    notas: 'O Canteiro deve ter espaço para 100% do material de fornecimento da SABESP. Deverá estar conforme NR-18.',
  },
  {
    nPreco: '500003',
    descricao: 'Plano de Comercialização de Ligações',
    unidade: 'UN',
    grupo: '01',
    grupoNome: 'Canteiros e Planos',
    compreende: 'Visita avulsa para conscientizar clientes sobre adesão ao sistema de esgotamento sanitário: programação, mobilização de mão de obra em comunicação social, sensibilização da população, produção de materiais informativos, relatório fotográfico, preenchimento de formulários com assinatura do morador.',
    medicao: 'Por unidade de ligação efetivamente executada e cadastrada no Sistema CSI. Etapa de visita: 30%; Adicional por imóvel conectado: 70%.',
    notas: 'Estão inclusos todos os custos diretos e indiretos.',
  },
  {
    nPreco: '500004',
    descricao: 'Plano de Qualidade Total',
    unidade: 'MÊS',
    grupo: '01',
    grupoNome: 'Canteiros e Planos',
    compreende: 'Fornecimento de materiais, equipamentos e mão de obra para o Plano de Qualidade Total: Coordenador nível superior (5 anos exp.), técnicos de laboratório, profissional ambiental e de comunicação social, agentes socioambientais, veículos, equipamentos de ensaio e instrumentação.',
    medicao: 'Em parcelas mensais.',
    notas: 'Será considerado "atendido" quando cumpridos TODOS os itens: Plano da Qualidade Técnica, Plano Ambiental, Plano do Sistema Viário, Plano de Comunicação. Não sendo corrigidos os apontamentos, o serviço não será medido.',
  },
  {
    nPreco: '500007',
    descricao: 'Rede coletora de esgoto Beira de rio DN 300mm',
    unidade: 'M',
    grupo: '02',
    grupoNome: 'Esgoto',
    compreende: 'Assentamento de rede coletora PVC DN 300 em trechos paralelos a corpos d\'água, com envelopamento em concreto armado: mobilização, construção de caixas de inspeção, roçada, ensecadeira, esgotamento, pilares e fundações.',
    medicao: 'Será por metro de rede coletora executada, medida entre os eixos das singularidades.',
    notas: 'Todos os materiais, inclusive hidráulicos, pela Contratada. Não inclui PVs.',
  },
  {
    nPreco: '500008',
    descricao: 'PV em tubo de concreto PBJE - Prof até 2,00m (escavação mecanizada)',
    unidade: 'UN',
    grupo: '02',
    grupoNome: 'Esgoto',
    compreende: 'Construção do poço de visita: escavação, sinalização, execução de lastro e lajes em concreto armado, fornecimento e assentamento dos tubos PBJE, canaleta de fundo, cintas de amarração, aterro compactado, fornecimento e assentamento de tampão em ferro fundido.',
    medicao: 'Será por poço de visita executado.',
    notas: 'Os tubos devem estar de acordo com a Especificação Técnica e com a aprovação da FISCALIZAÇÃO.',
  },
  {
    nPreco: '500009',
    descricao: 'PV em tubo de concreto PBJE - Prof até 2,00m (escavação manual)',
    unidade: 'UN',
    grupo: '02',
    grupoNome: 'Esgoto',
    compreende: 'Construção do poço de visita com escavação manual: escavação, sinalização, lastro e lajes em concreto armado, tubos PBJE, canaleta de fundo, cintas, aterro compactado, tampão em ferro fundido.',
    medicao: 'Será por poço de visita executado.',
    notas: 'Os tubos devem estar de acordo com a Especificação Técnica.',
  },
  {
    nPreco: '500010',
    descricao: 'Complemento para Escavação de Cavas de 4,01m até 6,00m de Profundidade',
    unidade: 'M3',
    grupo: '02',
    grupoNome: 'Esgoto',
    compreende: 'Complemento de escavação de cavas de 4,01m até 6,00m: escavação em qualquer terreno exceto rocha, escoramento contínuo, inspeção e manutenção permanente, desmonte e remoção, reaterro com lançamento em camadas de 0,20m e compactação com controle.',
    medicao: 'Pelo volume escavado de 4,01m até 6,00m, em M3 medido no local pela FISCALIZAÇÃO.',
    notas: 'Este serviço somente será medido a critério da FISCALIZAÇÃO.',
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
