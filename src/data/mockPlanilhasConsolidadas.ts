/**
 * mockPlanilhasConsolidadas.ts
 * Dados extraídos dos PDFs: RESUMO_v3, CONSOLIDADO_v3, MATERIAIS_PENDENTES_v4
 * CT 11481051 | 02/04/2026
 */

// ─── TIPOS ──────────────────────────────────────────────────────────────────

export interface ResumoNucleo {
  nucleo: string
  tipo: 'ESGOTO' | 'AGUA'
  trTotal: number
  trObra: number
  trCad: number
  trExec: number
  trPend: number
  kmObra: number
  kmExec: number
  kmPend: number
  kmCad: number
  kmReal: number
  ratio: string
  pctExec: number
}

export interface ConsolidadoTrecho {
  nucleo: string
  tipo: 'ESGOTO' | 'AGUA'
  rua: string
  ns: string
  pvMont: string
  pvJus: string | null
  dnMm: number | null
  extM: number
  mat: string
  ctMont: number | null
  ctJus: number | null
  declPml: number | null
  status: 'EXECUTADO' | 'PENDENTE' | 'CADASTRO'
  dataExec: string | null
}

export interface MaterialItem {
  material: string
  un: string
  rede: string
  qtd: number
  metragem: string | null
  isSubItem: boolean
}

export interface MaterialRua {
  rua: string
  items: MaterialItem[]
}

export interface MaterialNucleo {
  nucleo: string
  ruas: MaterialRua[]
}

// ─── RESUMO POR NÚCLEO (11 registros) ───────────────────────────────────────

export const resumoNucleos: ResumoNucleo[] = [
  { nucleo: 'Joao Carlos',              tipo: 'ESGOTO', trTotal: 55,  trObra: 55,  trCad: 0,  trExec: 42,  trPend: 13,  kmObra: 1.3, kmExec: 0.8, kmPend: 0.5, kmCad: 0,   kmReal: 1.3, ratio: '1.0×', pctExec: 60 },
  { nucleo: 'Morro do Teteu',           tipo: 'AGUA',   trTotal: 336, trObra: 336, trCad: 0,  trExec: 82,  trPend: 254, kmObra: 4.8, kmExec: 1.2, kmPend: 3.6, kmCad: 0,   kmReal: 0,   ratio: '0.0×', pctExec: 25 },
  { nucleo: 'Morro do Teteu v2',        tipo: 'ESGOTO', trTotal: 420, trObra: 420, trCad: 0,  trExec: 136, trPend: 284, kmObra: 5.7, kmExec: 1.9, kmPend: 3.8, kmCad: 0,   kmReal: 4,   ratio: '1.4×', pctExec: 33 },
  { nucleo: 'Pantanal Baixo',           tipo: 'AGUA',   trTotal: 369, trObra: 319, trCad: 50, trExec: 36,  trPend: 283, kmObra: 4.7, kmExec: 0.6, kmPend: 4.1, kmCad: 1.3, kmReal: 2.3, ratio: '2.0×', pctExec: 12 },
  { nucleo: 'Prolongamento Criadores',  tipo: 'ESGOTO', trTotal: 70,  trObra: 17,  trCad: 53, trExec: 1,   trPend: 16,  kmObra: 1.1, kmExec: 0,   kmPend: 1.1, kmCad: 1.6, kmReal: 0,   ratio: '0.0×', pctExec: 2  },
  { nucleo: 'Prolongamento Pantanal',   tipo: 'ESGOTO', trTotal: 25,  trObra: 15,  trCad: 10, trExec: 0,   trPend: 15,  kmObra: 0.7, kmExec: 0,   kmPend: 0.7, kmCad: 0.5, kmReal: 0,   ratio: '0.0×', pctExec: 0  },
  { nucleo: 'Prolongamento Sao Manoel', tipo: 'ESGOTO', trTotal: 79,  trObra: 6,   trCad: 73, trExec: 1,   trPend: 5,   kmObra: 1.2, kmExec: 0.5, kmPend: 0.7, kmCad: 3.9, kmReal: 0,   ratio: '0.0×', pctExec: 38 },
  { nucleo: 'Prolongamento Teteu',      tipo: 'ESGOTO', trTotal: 143, trObra: 121, trCad: 22, trExec: 1,   trPend: 120, kmObra: 5.5, kmExec: 0,   kmPend: 5.4, kmCad: 1,   kmReal: 0,   ratio: '0.0×', pctExec: 0  },
  { nucleo: 'Sao Manoel',               tipo: 'ESGOTO', trTotal: 164, trObra: 79,  trCad: 85, trExec: 52,  trPend: 27,  kmObra: 3,   kmExec: 1.3, kmPend: 1.6, kmCad: 4,   kmReal: 2.3, ratio: '1.3×', pctExec: 44 },
  { nucleo: 'Vila Criadores',           tipo: 'AGUA',   trTotal: 226, trObra: 226, trCad: 0,  trExec: 84,  trPend: 142, kmObra: 6.6, kmExec: 2.1, kmPend: 4.6, kmCad: 0,   kmReal: 2.3, ratio: '2.9×', pctExec: 31 },
  { nucleo: 'Vila Israel',              tipo: 'AGUA',   trTotal: 290, trObra: 279, trCad: 11, trExec: 128, trPend: 151, kmObra: 3.4, kmExec: 1.7, kmPend: 1.7, kmCad: 0.3, kmReal: 1.4, ratio: '2.4×', pctExec: 50 },
]

// ─── CONSOLIDADO TRECHOS (amostra representativa — primeiras ~55 linhas) ─────

export const consolidadoTrechos: ConsolidadoTrecho[] = [
  // Joao Carlos – BECO 10
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'BECO 10', ns: 'NS-0001', pvMont: 'PV-1136 (1)', pvJus: 'PV-1126 (1)', dnMm: 150, extM: 43.97, mat: 'PVC', ctMont: 1.53, ctJus: 1.58, declPml: 1.59, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'BECO 10', ns: 'NS-0002', pvMont: 'PV-10 (CT JÃO CARLOS)', pvJus: 'PV-09 (CT JÃO CARLOS)', dnMm: 300, extM: 30.85, mat: 'PVC', ctMont: 1.9011, ctJus: 1.6587, declPml: 3, status: 'EXECUTADO', dataExec: null },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'BECO 10', ns: 'NS-0003', pvMont: 'PV-09 (CT JÃO CARLOS)', pvJus: 'PV-08 (CT JÃO CARLOS)', dnMm: 300, extM: 17.05, mat: 'PVC', ctMont: 1.6587, ctJus: 1.8599, declPml: 3, status: 'EXECUTADO', dataExec: null },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'BECO 10', ns: 'NS-0004', pvMont: '16 (ESG-FEV-2026)', pvJus: '15 (ESG-FEV-2026)', dnMm: 200, extM: 3.33, mat: 'PVC', ctMont: 1.7408, ctJus: 1.6528, declPml: 5.4, status: 'EXECUTADO', dataExec: '02/02/2026' },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'BECO 10', ns: 'NS-0005', pvMont: 'StartNullStruct14', pvJus: '16 (ESG-FEV-2026)', dnMm: 200, extM: 22.02, mat: 'PVC', ctMont: null, ctJus: 1.7408, declPml: 8.07, status: 'EXECUTADO', dataExec: '02/02/2026' },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'BECO 10', ns: 'NS-0006', pvMont: '15 (ESG-FEV-2026)', pvJus: '14 (ESG-FEV-2026)', dnMm: 200, extM: 12.19, mat: 'PVC', ctMont: 1.6528, ctJus: 1.6587, declPml: 3.47, status: 'EXECUTADO', dataExec: '02/02/2026' },
  // Joao Carlos – Sem Rua
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV-1126 (1)', pvJus: 'EndNullStruct37', dnMm: 150, extM: 28.93, mat: 'PVC', ctMont: null, ctJus: 1.58, declPml: 4.49, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0002', pvMont: 'PV-939 (1)', pvJus: 'PV-1249 (1)', dnMm: 150, extM: 71.42, mat: 'PVC', ctMont: 2.25, ctJus: 2.29, declPml: 5.6, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0003', pvMont: 'PV-1249 (1)', pvJus: 'PV-1081 (1)', dnMm: 150, extM: 71.0, mat: 'PVC', ctMont: 2.29, ctJus: 2.3, declPml: 4.37, status: 'PENDENTE', dataExec: null },
  // Joao Carlos – RUA JOÃO CARLOS DA SILVA
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'RUA JOÃO CARLOS DA SILVA', ns: 'NS-0001', pvMont: 'StartNullStruct11', pvJus: 'PV-1163 (1)', dnMm: 150, extM: 91.14, mat: 'PVC', ctMont: null, ctJus: 1.83, declPml: 4.17, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'RUA JOÃO CARLOS DA SILVA', ns: 'NS-0002', pvMont: 'PV-13 (CT JÃO CARLOS)', pvJus: 'PV-12 (CT JÃO CARLOS)', dnMm: 300, extM: 30.11, mat: 'PVC', ctMont: 2.0513, ctJus: 2.1025, declPml: 3, status: 'EXECUTADO', dataExec: null },
  { nucleo: 'Joao Carlos', tipo: 'ESGOTO', rua: 'RUA JOÃO CARLOS DA SILVA', ns: 'NS-0003', pvMont: 'PV-01 (CT JÃO CARLOS)', pvJus: 'PV-EEE JÃO CARLOS DA SILVA', dnMm: 300, extM: 2.43, mat: 'PVC', ctMont: 1.9577, ctJus: 1.9117, declPml: 3.04, status: 'EXECUTADO', dataExec: null },
  // Sao Manoel – Sem Rua
  { nucleo: 'Sao Manoel', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV-1136 (1)', pvJus: 'PV-1126 (1)', dnMm: 150, extM: 43.97, mat: 'PVC', ctMont: 1.53, ctJus: 1.58, declPml: 1.59, status: 'CADASTRO', dataExec: null },
  { nucleo: 'Sao Manoel', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0002', pvMont: 'StartNullStruct0', pvJus: 'PV-1312 (1)', dnMm: 300, extM: 4.98, mat: 'PVC', ctMont: null, ctJus: 0.725, declPml: null, status: 'CADASTRO', dataExec: null },
  { nucleo: 'Sao Manoel', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0055', pvMont: 'PV-10 (REDE SÃO MANOEL)', pvJus: 'PV-09 (REDE SÃO MANOEL)', dnMm: 300, extM: 461.67, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: null },
  // Morro do Teteu v2 – Sem Rua
  { nucleo: 'Morro do Teteu v2', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV_G192', pvJus: 'PV_G190', dnMm: null, extM: 16.43, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Morro do Teteu v2', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0002', pvMont: 'PV_G190', pvJus: 'PV_G189', dnMm: null, extM: 17.73, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Morro do Teteu v2', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0294', pvMont: 'PV_G192', pvJus: 'PV_G24', dnMm: null, extM: 39.96, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: null },
  // Pantanal Baixo – Sem Rua
  { nucleo: 'Pantanal Baixo', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV_01_3', pvJus: 'PV_01_2', dnMm: 300, extM: 81.22, mat: 'MBV', ctMont: -2.54, ctJus: -2.52, declPml: 2.22, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Pantanal Baixo', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0017', pvMont: 'PV_G34', pvJus: null, dnMm: 200, extM: 6.2, mat: 'PVC', ctMont: -2.0983, ctJus: -2.1957, declPml: 8.07, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Pantanal Baixo', tipo: 'ESGOTO', rua: 'RUA UM VILA PANTANAL', ns: 'NS-0001', pvMont: 'PV_07', pvJus: 'PV_09', dnMm: 300, extM: 29.03, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: '27/02/2026' },
  // Vila Criadores
  { nucleo: 'Vila Criadores', tipo: 'ESGOTO', rua: 'RUA B', ns: 'NS-0001', pvMont: 'PV_G14', pvJus: 'PV_G16', dnMm: null, extM: 16.94, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: '12/02/2026' },
  { nucleo: 'Vila Criadores', tipo: 'ESGOTO', rua: 'RUA B', ns: 'NS-0002', pvMont: 'PV_G33', pvJus: 'PV_G32', dnMm: null, extM: 3.32, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: '12/02/2026' },
  { nucleo: 'Vila Criadores', tipo: 'ESGOTO', rua: 'BECO DA AMIZADE', ns: 'NS-0001', pvMont: 'PV_G67', pvJus: 'PV_G66', dnMm: null, extM: 21.25, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: '27/02/2026' },
  { nucleo: 'Vila Criadores', tipo: 'ESGOTO', rua: 'BECO DA DONA NEIDE', ns: 'NS-0001', pvMont: 'PV_46', pvJus: 'PV_G44', dnMm: null, extM: 13.09, mat: 'PVC', ctMont: null, ctJus: -1.558, declPml: 18.5, status: 'EXECUTADO', dataExec: null },
  // Vila Israel
  { nucleo: 'Vila Israel', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PI_194', pvJus: 'PV_G30', dnMm: 200, extM: 6.9, mat: 'PVC', ctMont: 60.106, ctJus: null, declPml: 5, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Vila Israel', tipo: 'ESGOTO', rua: 'RUA PRINCIPAL', ns: 'NS-0001', pvMont: 'PV_G35', pvJus: 'PV_G36', dnMm: 200, extM: 10.13, mat: 'PVC', ctMont: null, ctJus: 107.216, declPml: 261, status: 'EXECUTADO', dataExec: null },
  { nucleo: 'Vila Israel', tipo: 'ESGOTO', rua: 'BECO 8', ns: 'NS-0001', pvMont: 'PI_85_2', pvJus: 'PV_G35', dnMm: 200, extM: 7.25, mat: 'PVC', ctMont: null, ctJus: 99.614, declPml: 225.9, status: 'EXECUTADO', dataExec: null },
  // Morro do Teteu (AGUA)
  { nucleo: 'Morro do Teteu', tipo: 'AGUA', rua: 'RUA DAS PEDRAS (ASFALTO DANIFICADO)', ns: 'NS-0001', pvMont: 'PV_G192', pvJus: 'PV_G1', dnMm: 160, extM: 81.18, mat: 'PVC', ctMont: null, ctJus: null, declPml: 5.7, status: 'EXECUTADO', dataExec: '26/02/2026' },
  { nucleo: 'Morro do Teteu', tipo: 'AGUA', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV_G1', pvJus: 'PV_G20', dnMm: 160, extM: 29.03, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: '27/02/2026' },
  { nucleo: 'Morro do Teteu', tipo: 'AGUA', rua: 'Sem Rua', ns: 'NS-0007', pvMont: 'PV_G269', pvJus: 'PV_G268', dnMm: 63, extM: 7.25, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Morro do Teteu', tipo: 'AGUA', rua: 'Sem Rua', ns: 'NS-0008', pvMont: 'PV_G268', pvJus: 'PV_G284', dnMm: 63, extM: 5.71, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'PENDENTE', dataExec: null },
  // Prolongamento Criadores
  { nucleo: 'Prolongamento Criadores', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV-59 (LR CRIADORES)', pvJus: 'PV-60 (LR CRIADORES)', dnMm: 200, extM: 18.42, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: null },
  { nucleo: 'Prolongamento Criadores', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0016', pvMont: 'PV-38 (REDE BECO JOÃO PÁ)', pvJus: 'PV-37 (REDE BECO JOÃO PÁ)', dnMm: 300, extM: 42.54, mat: 'PVC', ctMont: null, ctJus: null, declPml: 15.6, status: 'EXECUTADO', dataExec: null },
  { nucleo: 'Prolongamento Criadores', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0040', pvMont: 'PV-26 (REDE RUA A)', pvJus: 'PV-25 (REDE RUA A)', dnMm: 300, extM: 40.18, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: '03/02/2026' },
  { nucleo: 'Prolongamento Criadores', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0047', pvMont: 'PV-18 (REDE RUA B)', pvJus: 'PV-17 (REDE RUA B)', dnMm: 200, extM: 15.75, mat: 'PVC', ctMont: -1.437, ctJus: null, declPml: 180.5, status: 'EXECUTADO', dataExec: null },
  // Prolongamento Teteu
  { nucleo: 'Prolongamento Teteu', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV-382 (CT TETEU)', pvJus: 'PV-401 (CT TETEU)', dnMm: 300, extM: 67.27, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'EXECUTADO', dataExec: null },
  { nucleo: 'Prolongamento Teteu', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0020', pvMont: 'PV-363 (Network)', pvJus: 'PV-349 (Network)', dnMm: 150, extM: 16.3, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Prolongamento Teteu', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0021', pvMont: 'PV-338 (Network)', pvJus: 'PV-351 (Network)', dnMm: 150, extM: 5.4, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'PENDENTE', dataExec: null },
  // Prolongamento Pantanal
  { nucleo: 'Prolongamento Pantanal', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0020', pvMont: 'PV-07 (PRE - PANTANAL BAIXO)', pvJus: 'PV-06 (PRE - PANTANAL BAIXO)', dnMm: 300, extM: 47.72, mat: 'PVC', ctMont: null, ctJus: null, declPml: null, status: 'PENDENTE', dataExec: null },
  { nucleo: 'Prolongamento Pantanal', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV-57 (ESGOTO EXISTENTE)', pvJus: 'PV-83 (ESGOTO EXISTENTE)', dnMm: 150, extM: 36.58, mat: 'MBV', ctMont: 2.852, ctJus: 2.672, declPml: 6.29, status: 'PENDENTE', dataExec: null },
  // Prolongamento Sao Manoel
  { nucleo: 'Prolongamento Sao Manoel', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0001', pvMont: 'PV-1136 (1)', pvJus: 'PV-1126 (1)', dnMm: 150, extM: 43.97, mat: 'PVC', ctMont: 1.53, ctJus: 1.58, declPml: 1.59, status: 'CADASTRO', dataExec: null },
  { nucleo: 'Prolongamento Sao Manoel', tipo: 'ESGOTO', rua: 'Sem Rua', ns: 'NS-0060', pvMont: 'PI-1357 (REDE SÃO MANOEL)', pvJus: 'PI-1358 (REDE SÃO MANOEL)', dnMm: 300, extM: 15.33, mat: 'PVC', ctMont: 1.7786, ctJus: 1.8049, declPml: 3, status: 'EXECUTADO', dataExec: null },
]

// ─── MATERIAIS PENDENTES (por Núcleo > Rua) ─────────────────────────────────

export const materiaisPendentes: MaterialNucleo[] = [
  {
    nucleo: 'Joao Carlos',
    ruas: [
      {
        rua: 'BECO 10',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 44, metragem: '44.0m', isSubItem: false },
          { material: 'Anel de Borracha p/ Tubo PVC DN 200mm', un: 'pc', rede: '', qtd: 9, metragem: null, isSubItem: true },
          { material: 'Pasta Lubrificante p/ Junta Elástica (Bisnaga 1kg)', un: 'un', rede: '', qtd: 1, metragem: null, isSubItem: true },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 2, metragem: null, isSubItem: false },
          { material: 'Tampão FoFo Articulado Completo D=600mm T-300', un: 'pç', rede: '', qtd: 2, metragem: null, isSubItem: true },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 40, metragem: null, isSubItem: false },
          { material: 'Areia Lavada Média (Envoltória)', un: 'm³', rede: 'ESG', qtd: 16, metragem: null, isSubItem: false },
          { material: 'Brita N° 1 ou 2 (Base/Reaterro)', un: 'm³', rede: 'ESG', qtd: 11, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 40, metragem: null, isSubItem: false },
        ],
      },
      {
        rua: 'Sem Rua',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 172, metragem: '171.3m', isSubItem: false },
          { material: 'Anel de Borracha p/ Tubo PVC DN 200mm', un: 'pc', rede: '', qtd: 30, metragem: null, isSubItem: true },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 4, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 155, metragem: null, isSubItem: false },
          { material: 'Areia Lavada Média (Envoltória)', un: 'm³', rede: 'ESG', qtd: 60, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 155, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Morro do Teteu v2',
    ruas: [
      {
        rua: 'Sem Rua',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 3843, metragem: '3842.4m', isSubItem: false },
          { material: 'Anel de Borracha p/ Tubo PVC DN 200mm', un: 'pc', rede: '', qtd: 642, metragem: null, isSubItem: true },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 285, metragem: null, isSubItem: false },
          { material: 'Tampão FoFo Articulado Completo D=600mm T-300', un: 'pç', rede: '', qtd: 285, metragem: null, isSubItem: true },
          { material: 'Degrau de FºFº para PV', un: 'pç', rede: '', qtd: 1425, metragem: null, isSubItem: true },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 3459, metragem: null, isSubItem: false },
          { material: 'Areia Lavada Média (Envoltória)', un: 'm³', rede: 'ESG', qtd: 1345, metragem: null, isSubItem: false },
          { material: 'Brita N° 1 ou 2 (Base/Reaterro)', un: 'm³', rede: 'ESG', qtd: 961, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 3459, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Morro do Teteu',
    ruas: [
      {
        rua: 'Sem Rua',
        items: [
          { material: 'Tubo PEAD PE 100 SDR 17 PN 10 DN 63mm - NTS 194', un: 'm', rede: 'AG', qtd: 2185, metragem: '2184.5m', isSubItem: false },
          { material: 'Luva Eletrofusão PEAD DN 63mm', un: 'pc', rede: '', qtd: 402, metragem: null, isSubItem: true },
          { material: 'Tubo PEAD PE 100 SDR 17 PN 10 DN 110mm - NTS 194', un: 'm', rede: 'AG', qtd: 870, metragem: '869.9m', isSubItem: false },
          { material: 'Luva Eletrofusão PEAD DN 110mm', un: 'pc', rede: '', qtd: 160, metragem: null, isSubItem: true },
          { material: 'Escavação mecânica / manual em vala (Água)', un: 'm³', rede: 'AG', qtd: 1833, metragem: null, isSubItem: false },
          { material: 'Areia Lavada Média (Envoltória - Água)', un: 'm³', rede: 'AG', qtd: 611, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'AG', qtd: 1833, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Prolongamento Teteu',
    ruas: [
      {
        rua: 'Sem Rua',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 5141, metragem: '5141.0m', isSubItem: false },
          { material: 'Anel de Borracha p/ Tubo PVC DN 200mm', un: 'pc', rede: '', qtd: 858, metragem: null, isSubItem: true },
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 300mm - NTS 048', un: 'm', rede: 'ESG', qtd: 295, metragem: '294.8m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 121, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 4893, metragem: null, isSubItem: false },
          { material: 'Areia Lavada Média (Envoltória)', un: 'm³', rede: 'ESG', qtd: 1903, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 4893, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Vila Criadores',
    ruas: [
      {
        rua: 'Sem Rua (AGUA)',
        items: [
          { material: 'Tubo PEAD PE 100 SDR 17 PN 10 DN 63mm - NTS 194', un: 'm', rede: 'AG', qtd: 2777, metragem: '2776.9m', isSubItem: false },
          { material: 'Luva Eletrofusão PEAD DN 63mm', un: 'pc', rede: '', qtd: 510, metragem: null, isSubItem: true },
          { material: 'Tubo PEAD PE 100 SDR 17 PN 10 DN 110mm - NTS 194', un: 'm', rede: 'AG', qtd: 152, metragem: '151.7m', isSubItem: false },
          { material: 'Escavação mecânica / manual em vala (Água)', un: 'm³', rede: 'AG', qtd: 1758, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'AG', qtd: 1758, metragem: null, isSubItem: false },
        ],
      },
      {
        rua: 'BECO DO JOÃO PÃ (ESGOTO)',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 149, metragem: '148.9m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 5, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 135, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 135, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Vila Israel',
    ruas: [
      {
        rua: 'RUA PRINCIPAL (ESGOTO)',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 133, metragem: '133.0m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 12, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 120, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 120, metragem: null, isSubItem: false },
        ],
      },
      {
        rua: 'RUA PRINCIPAL (AGUA)',
        items: [
          { material: 'Tubo PEAD PE 100 SDR 17 PN 10 DN 63mm - NTS 194', un: 'm', rede: 'AG', qtd: 49, metragem: '48.3m', isSubItem: false },
          { material: 'Tubo PEAD PE 100 SDR 17 PN 10 DN 110mm - NTS 194', un: 'm', rede: 'AG', qtd: 161, metragem: '160.1m', isSubItem: false },
          { material: 'Escavação mecânica / manual em vala (Água)', un: 'm³', rede: 'AG', qtd: 126, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'AG', qtd: 126, metragem: null, isSubItem: false },
        ],
      },
      {
        rua: 'BECO 7 (ESGOTO)',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 146, metragem: '145.2m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 15, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 131, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 131, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Pantanal Baixo',
    ruas: [
      {
        rua: 'Sem Rua (ESGOTO)',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 1685, metragem: '1684.2m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 123, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 1516, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 1516, metragem: null, isSubItem: false },
        ],
      },
      {
        rua: 'Sem Rua (AGUA)',
        items: [
          { material: 'Tubo PEAD PE 100 SDR 17 PN 10 DN 63mm - NTS 194', un: 'm', rede: 'AG', qtd: 579, metragem: '578.9m', isSubItem: false },
          { material: 'Tubo PEAD PE 100 SDR 17 PN 10 DN 110mm - NTS 194', un: 'm', rede: 'AG', qtd: 90, metragem: '89.8m', isSubItem: false },
          { material: 'Escavação mecânica / manual em vala (Água)', un: 'm³', rede: 'AG', qtd: 402, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'AG', qtd: 402, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Prolongamento Criadores',
    ruas: [
      {
        rua: 'Sem Rua',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 1100, metragem: '1099.8m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 17, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 990, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 990, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Prolongamento Pantanal',
    ruas: [
      {
        rua: 'Sem Rua',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 750, metragem: '749.1m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 16, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 675, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 675, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Prolongamento Sao Manoel',
    ruas: [
      {
        rua: 'Sem Rua',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 746, metragem: '745.8m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 6, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 672, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 672, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
  {
    nucleo: 'Sao Manoel',
    ruas: [
      {
        rua: 'Sem Rua',
        items: [
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 200mm - NTS 048', un: 'm', rede: 'ESG', qtd: 677, metragem: '676.2m', isSubItem: false },
          { material: 'Tubo PVC Corrugado/Maciço Esgoto JEI DN 300mm - NTS 048', un: 'm', rede: 'ESG', qtd: 551, metragem: '550.4m', isSubItem: false },
          { material: 'Poço de Visita (PV) Pré-Moldado Concreto D=1,20m', un: 'un', rede: 'ESG', qtd: 15, metragem: null, isSubItem: false },
          { material: 'Escavação mecânica / manual em vala', un: 'm³', rede: 'ESG', qtd: 1104, metragem: null, isSubItem: false },
          { material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', rede: 'ESG', qtd: 1104, metragem: null, isSubItem: false },
        ],
      },
    ],
  },
]

// ─── RESUMO GLOBAL ──────────────────────────────────────────────────────────

export const resumoGlobal = {
  execMetros: 10069,
  pendMetros: 28021,
  cadMetros: 12613,
  progressoObra: 26.4,
  dataRef: '02/04/2026',
  contrato: 'CT 11481051',
}
