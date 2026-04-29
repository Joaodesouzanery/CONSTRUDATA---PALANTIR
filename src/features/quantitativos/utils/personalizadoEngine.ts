export type RedeTipo = 'Esgoto' | 'Água' | 'Drenagem'
export type MaterialTubo = 'PVC PBA' | 'PEAD' | 'PVC Ocre' | 'Tubo Concreto PA-1' | 'FoFo' | 'Concreto' | 'Outro'
export type SoloTipo = 'Argila' | 'Areia' | 'Rocha' | 'Outro'
export type SuperficieTipo = 'Terra' | 'Asfalto' | 'Concreto' | 'Bloco'
export type PvTipo = 'Circular' | 'PV Circular' | 'CI' | 'Caixa de válvula' | 'Outro'
export type ParamUnit = '%' | 'm' | 'adim' | 'un/100m' | 'kg/m³' | 'm³/equipe.dia' | 'm/equipe.dia' | 'm²/equipe.dia' | 'un/equipe.dia' | 'outro'

export interface ParamRow {
  id: string
  parametro: string
  valor: number
  unidade: ParamUnit
  comentario: string
}

export interface TrechoRow {
  id: string
  nome: string
  rede: RedeTipo
  material: MaterialTubo
  dn: number
  de: number
  comprimento: number
  profInicial: number
  profFinal: number
  larguraAdotada: string
  solo: SoloTipo
  superficie: SuperficieTipo
  larguraRecomposicao: string
  reaproveitamento: string
  observacoes: string
  observacaoPlanejamento: string
  folgaAmpliacao: string
}

export interface PvRow {
  id: string
  nome: string
  tipo: PvTipo
  diametroInterno: number
  profundidadeTotal: number
  observacoes: string
}

export interface AccessoryRow {
  id: string
  rede: RedeTipo
  item: string
  unidade: string
  quantidade: number
  codigoRef: string
  observacoes: string
}

export interface BdiComponent {
  id: string
  componente: string
  percentual: number
  aplicacao: string
  observacao: string
}

export interface BaseRef {
  id: string
  codigo: string
  grupo: string
  subgrupo: string
  item: string
  unidade: string
  precoRef: number
  fonte: string
  observacao: string
}

export interface OrcamentoLine {
  id: string
  grupo: string
  codigoRef: string
  descricao: string
  unidade: string
  quantidade: number
}

export interface LevantamentoLine extends OrcamentoLine {
  secao: string
  subgrupo: string
  origem: string
  puDireto: number
  custoDireto: number
  bdi: number
  puBdi: number
  totalBdi: number
  participacao: number
  fonte: string
  situacao: 'Automático' | 'Revisar'
}

export interface QuantCalcResult {
  trechoCalcs: TrechoCalc[]
  pvCalcs: PvCalc[]
  quantitativos: QuantRow[]
  materiais: MaterialRow[]
  orcamento: OrcamentoLine[]
  producao: ProductionRow[]
  resumo: SummaryRow[]
  levantamento: LevantamentoLine[]
  curvaAbc: AbcRow[]
  totals: Totals
  bdiTotal: number
  custoDiretoTotal: number
  totalComBdi: number
}

export interface TrechoCalc {
  profMedia: number
  larguraAuto: number
  larguraUtilizada: number
  fatorEmpolamento: number
  larguraRecompUtil: number
  areaSecaoVala: number
  volumeEscavacao: number
  escoramento: 'SIM' | 'NÃO'
  areaEscoramento: number
  espBerco: number
  volumeBerco: number
  alturaEnvolvimento: number
  volumeEnvolvimento: number
  volumeTubo: number
  volumeLiquido: number
  reaproveitamentoUsado: number
  reaterroReaproveitado: number
  reaterroImportado: number
  botaForaInSitu: number
  botaForaEmpolado: number
  areaRecompTotal: number
  areaAsfalto: number
  areaConcreto: number
  areaBloco: number
  volumeSubBase: number
  volumeRevestimento: number
  tuboComPerdas: number
  testeDesinfeccao: number
  fatorCompactacao: number
  botaForaCompactado: number
  curvasAuto: number
  tesAuto: number
  registrosAuto: number
  ventosasAuto: number
  diasEscavacao: number
  diasAssentamento: number
  diasRecomposicao: number
}

export interface PvCalc {
  espParede: number
  folgaEscavacao: number
  dimensaoExterna: number
  ladoEscavacao: number
  volumeEscavacao: number
  espBase: number
  volumeBase: number
  alturaUtilParede: number
  areaParede: number
  tampoes: number
  degraus: number
  volumeReaterroExterno: number
  volumeParedesConcreto: number
  areaForma: number
  armadura: number
  diasExecucao: number
  isDrenagem: boolean
}

export interface QuantRow {
  grupo: string
  descricao: string
  unidade: string
  quantidade: number
  criterio: string
}

export interface MaterialRow {
  grupo: string
  rede: string
  material: string
  dn: string
  descricao: string
  unidade: string
  quantidade: number
}

export interface ProductionRow {
  grupo: string
  servico: string
  unidade: string
  quantidade: number
  produtividade: number
  equipes: number
  dias: number
}

export interface SummaryRow {
  indicador: string
  unidade: string
  valor: number
  observacao: string
}

export interface AbcRow extends LevantamentoLine {
  acumulado: number
  classe: 'A' | 'B' | 'C'
}

export interface Totals {
  extensaoEsgoto: number
  extensaoAgua: number
  extensaoDrenagem: number
  escavacaoTotal: number
  reaterroReaproveitadoTotal: number
  reaterroImportadoTotal: number
  botaForaEmpoladoTotal: number
  recomposicaoTotal: number
  pvsTotal: number
  pvsDrenagem: number
  tuboTotalComPerdas: number
  diasTotais: number
}

const pct = (value: number) => (Math.abs(value) > 1 ? value / 100 : value)
const round = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}
const sum = <T>(rows: T[], pick: (row: T, index: number) => number) => rows.reduce((total, row, index) => total + (Number(pick(row, index)) || 0), 0)

export const defaultParams: ParamRow[] = [
  { id: 'param-perda-tubos', parametro: 'Perda de tubos', valor: 5, unidade: '%', comentario: 'Aplicada ao comprimento para a lista de materiais' },
  { id: 'param-reaproveitamento', parametro: '% de reaproveitamento do material escavado', valor: 90, unidade: '%', comentario: 'Parcela do volume líquido de reaterro reaproveitada do próprio solo' },
  { id: 'param-prof-escoramento', parametro: 'Profundidade limite para escoramento', valor: 1.25, unidade: 'm', comentario: 'Sinalização automática de escoramento a partir desta profundidade' },
  { id: 'param-berco-esgoto', parametro: 'Espessura berço - rede de esgoto', valor: 0.1, unidade: 'm', comentario: 'Premissa inicial' },
  { id: 'param-berco-agua', parametro: 'Espessura berço - rede de água', valor: 0.1, unidade: 'm', comentario: 'Premissa inicial' },
  { id: 'param-env-esgoto', parametro: 'Altura envolvimento selecionado - esgoto', valor: 0.15, unidade: 'm', comentario: 'Premissa inicial' },
  { id: 'param-env-agua', parametro: 'Altura envolvimento selecionado - água', valor: 0.15, unidade: 'm', comentario: 'Premissa inicial' },
  { id: 'param-larg-min-150', parametro: 'Largura mínima de vala para DN <= 150', valor: 0.6, unidade: 'm', comentario: 'Critério base' },
  { id: 'param-larg-min-400', parametro: 'Largura mínima de vala para 200 <= DN <= 400', valor: 0.8, unidade: 'm', comentario: 'Critério base' },
  { id: 'param-larg-min-maior', parametro: 'Largura mínima de vala para DN > 400', valor: 1, unidade: 'm', comentario: 'Critério base' },
  { id: 'param-folga-150', parametro: 'Folga lateral por lado para DN <= 150', valor: 0.2, unidade: 'm', comentario: 'Usada no cálculo automático' },
  { id: 'param-folga-400', parametro: 'Folga lateral por lado para 200 <= DN <= 400', valor: 0.25, unidade: 'm', comentario: 'Usada no cálculo automático' },
  { id: 'param-folga-maior', parametro: 'Folga lateral por lado para DN > 400', valor: 0.35, unidade: 'm', comentario: 'Usada no cálculo automático' },
  { id: 'param-emp-argila', parametro: 'Fator de empolamento - Argila', valor: 1.25, unidade: 'adim', comentario: 'Para volume transportado' },
  { id: 'param-emp-areia', parametro: 'Fator de empolamento - Areia', valor: 1.15, unidade: 'adim', comentario: 'Para volume transportado' },
  { id: 'param-emp-rocha', parametro: 'Fator de empolamento - Rocha', valor: 1.5, unidade: 'adim', comentario: 'Para volume transportado' },
  { id: 'param-subbase-asfalto', parametro: 'Espessura sub-base para recomposição asfáltica', valor: 0.15, unidade: 'm', comentario: 'Se aplicável' },
  { id: 'param-capa-asfalto', parametro: 'Espessura capa asfáltica', valor: 0.05, unidade: 'm', comentario: 'Se aplicável' },
  { id: 'param-pav-concreto', parametro: 'Espessura pavimento em concreto', valor: 0.1, unidade: 'm', comentario: 'Se aplicável' },
  { id: 'param-bloco', parametro: 'Espessura bloco intertravado', valor: 0.06, unidade: 'm', comentario: 'Se aplicável' },
  { id: 'param-colchao-bloco', parametro: 'Espessura colchão de areia para bloco', valor: 0.04, unidade: 'm', comentario: 'Se aplicável' },
  { id: 'param-base-pv', parametro: 'Espessura base de concreto do PV', valor: 0.04, unidade: 'm', comentario: 'Critério usado pela planilha para PVs de água/esgoto' },
  { id: 'param-base-pv-drenagem', parametro: 'Espessura base de concreto do PV de drenagem', valor: 0.15, unidade: 'm', comentario: 'Critério usado pela planilha para estruturas pluviais' },
  { id: 'param-parede-pv', parametro: 'Espessura de parede do PV', valor: 0.15, unidade: 'm', comentario: 'Premissa inicial' },
  { id: 'param-folga-pv', parametro: 'Folga lateral de escavação do PV', valor: 0.3, unidade: 'm', comentario: 'Premissa inicial' },
  { id: 'param-comp-argila', parametro: 'Fator de compactação - Argila', valor: 0.9, unidade: 'adim', comentario: 'Para estimativa de volume compactado' },
  { id: 'param-comp-areia', parametro: 'Fator de compactação - Areia', valor: 0.95, unidade: 'adim', comentario: 'Para estimativa de volume compactado' },
  { id: 'param-comp-rocha', parametro: 'Fator de compactação - Rocha', valor: 1, unidade: 'adim', comentario: 'Para estimativa de volume compactado' },
  { id: 'param-curvas-agua', parametro: 'Acessórios água - curvas por 100 m', valor: 2, unidade: 'un/100m', comentario: 'Premissa automática editável' },
  { id: 'param-tes-agua', parametro: 'Acessórios água - tês por 100 m', valor: 0.5, unidade: 'un/100m', comentario: 'Premissa automática editável' },
  { id: 'param-registros-agua', parametro: 'Acessórios água - registros por 100 m', valor: 0.5, unidade: 'un/100m', comentario: 'Premissa automática editável' },
  { id: 'param-ventosas-agua', parametro: 'Acessórios água - ventosas por 100 m', valor: 0.2, unidade: 'un/100m', comentario: 'Premissa automática editável' },
  { id: 'param-curvas-esgoto', parametro: 'Acessórios esgoto - curvas por 100 m', valor: 1, unidade: 'un/100m', comentario: 'Premissa automática editável' },
  { id: 'param-tes-esgoto', parametro: 'Acessórios esgoto - tês por 100 m', valor: 0.3, unidade: 'un/100m', comentario: 'Premissa automática editável' },
  { id: 'param-aco-pv', parametro: 'Taxa de aço estimada para PV', valor: 90, unidade: 'kg/m³', comentario: 'Estimativa inicial para armadura das estruturas' },
  { id: 'param-prod-escavacao', parametro: 'Produtividade escavação vala', valor: 35, unidade: 'm³/equipe.dia', comentario: 'Premissa para planejamento' },
  { id: 'param-prod-assentamento', parametro: 'Produtividade assentamento de tubulação', valor: 60, unidade: 'm/equipe.dia', comentario: 'Premissa para planejamento' },
  { id: 'param-prod-recomp-asfalto', parametro: 'Produtividade recomposição asfáltica', valor: 80, unidade: 'm²/equipe.dia', comentario: 'Premissa da aba Produção' },
  { id: 'param-prod-recomp-concreto', parametro: 'Produtividade recomposição em concreto', valor: 60, unidade: 'm²/equipe.dia', comentario: 'Premissa da aba Produção' },
  { id: 'param-prod-pv', parametro: 'Produtividade execução de PV', valor: 1, unidade: 'un/equipe.dia', comentario: 'Premissa para planejamento' },
  { id: 'param-berco-drenagem', parametro: 'Espessura berço - rede de drenagem', valor: 0.1, unidade: 'm', comentario: 'Premissa inicial para galerias / rede pluvial' },
  { id: 'param-env-drenagem', parametro: 'Altura envolvimento selecionado - drenagem', valor: 0.2, unidade: 'm', comentario: 'Premissa inicial para rede pluvial' },
]

export const defaultTrechos: TrechoRow[] = [
  { id: 'tr-eg-01', nome: 'TR-EG-01', rede: 'Esgoto', material: 'PVC Ocre', dn: 150, de: 160, comprimento: 120, profInicial: 1.8, profFinal: 2.2, larguraAdotada: '', solo: 'Argila', superficie: 'Asfalto', larguraRecomposicao: '', reaproveitamento: '', observacoes: 'Trecho exemplo de rede coletora', observacaoPlanejamento: '', folgaAmpliacao: '' },
  { id: 'tr-ag-01', nome: 'TR-AG-01', rede: 'Água', material: 'PVC PBA', dn: 100, de: 110, comprimento: 180, profInicial: 1.2, profFinal: 1.4, larguraAdotada: '', solo: 'Areia', superficie: 'Concreto', larguraRecomposicao: '', reaproveitamento: '', observacoes: 'Trecho exemplo de rede de distribuição', observacaoPlanejamento: '', folgaAmpliacao: '' },
  { id: 'tr-dr-01', nome: 'TR-DR-01', rede: 'Drenagem', material: 'Tubo Concreto PA-1', dn: 400, de: 400, comprimento: 85, profInicial: 1.5, profFinal: 2.1, larguraAdotada: '', solo: 'Argila', superficie: 'Terra', larguraRecomposicao: '', reaproveitamento: '', observacoes: 'Trecho exemplo de rede de drenagem pluvial', observacaoPlanejamento: '', folgaAmpliacao: '' },
]

export const defaultPvs: PvRow[] = [
  { id: 'pv-01', nome: 'PV-01', tipo: 'Circular', diametroInterno: 1.2, profundidadeTotal: 2.4, observacoes: 'PV exemplo associado ao trecho de esgoto' },
  { id: 'pv-dr-01', nome: 'PV-DR-01', tipo: 'Circular', diametroInterno: 1.5, profundidadeTotal: 2, observacoes: 'PV exemplo associado à drenagem pluvial' },
]

export const defaultAccessories: AccessoryRow[] = [
  { id: 'ac-agua-1', rede: 'Água', item: 'Registro gaveta', unidade: 'un', quantidade: 1, codigoRef: '', observacoes: 'Exemplo manual para o trecho de água' },
  { id: 'ac-agua-2', rede: 'Água', item: 'Registro de descarga', unidade: 'un', quantidade: 0, codigoRef: '', observacoes: '' },
  { id: 'ac-agua-3', rede: 'Água', item: 'Ventosa', unidade: 'un', quantidade: 0, codigoRef: '', observacoes: '' },
  { id: 'ac-agua-4', rede: 'Água', item: 'Curva / conexão especial', unidade: 'un', quantidade: 0, codigoRef: '', observacoes: '' },
  { id: 'ac-agua-5', rede: 'Água', item: 'Ligações domiciliares', unidade: 'un', quantidade: 0, codigoRef: '', observacoes: '' },
  { id: 'ac-esgoto-1', rede: 'Esgoto', item: 'Poço de visita complementar', unidade: 'un', quantidade: 1, codigoRef: '', observacoes: '' },
  { id: 'ac-dren-1', rede: 'Drenagem', item: 'Boca de lobo', unidade: 'un', quantidade: 2, codigoRef: '', observacoes: '' },
  { id: 'ac-dren-2', rede: 'Drenagem', item: 'Canaleta / sarjeta', unidade: 'm', quantidade: 15, codigoRef: '', observacoes: '' },
  { id: 'ac-dren-3', rede: 'Drenagem', item: 'Dissipador', unidade: 'un', quantidade: 1, codigoRef: '', observacoes: '' },
]

export const defaultBdiComponents: BdiComponent[] = [
  { id: 'bdi-1', componente: 'Administração central', percentual: 5, aplicacao: 'Sobre custo direto', observacao: 'Premissa editável' },
  { id: 'bdi-2', componente: 'Administração local complementar', percentual: 3, aplicacao: 'Sobre custo direto', observacao: 'Premissa editável' },
  { id: 'bdi-3', componente: 'Encargos sociais não apropriados em composição', percentual: 4, aplicacao: 'Sobre custo direto', observacao: 'Premissa editável' },
  { id: 'bdi-4', componente: 'Seguros', percentual: 1, aplicacao: 'Sobre custo direto', observacao: 'Premissa editável' },
  { id: 'bdi-5', componente: 'Garantias contratuais', percentual: 0.5, aplicacao: 'Sobre custo direto', observacao: 'Premissa editável' },
  { id: 'bdi-6', componente: 'Riscos / contingência', percentual: 3, aplicacao: 'Sobre custo direto', observacao: 'Premissa editável' },
  { id: 'bdi-7', componente: 'Despesas financeiras', percentual: 1, aplicacao: 'Sobre custo direto', observacao: 'Premissa editável' },
  { id: 'bdi-8', componente: 'Impostos', percentual: 8, aplicacao: 'Sobre faturamento', observacao: 'Premissa editável' },
  { id: 'bdi-9', componente: 'Reserva técnica', percentual: 2, aplicacao: 'Sobre custo direto', observacao: 'Premissa editável' },
]

export const defaultBaseRefs: BaseRef[] = [
  { id: 'base-pre-001', codigo: 'PRE-001', grupo: 'Serviços iniciais / preliminares', subgrupo: 'Preliminares', item: 'Mobilização de equipe e equipamentos', unidade: 'vb', precoRef: 18000, fonte: 'Referência editável (SINAPI/local)', observacao: 'Revisar com base oficial da contratação.' },
  { id: 'base-pre-002', codigo: 'PRE-002', grupo: 'Serviços iniciais / preliminares', subgrupo: 'Preliminares', item: 'Desmobilização final', unidade: 'vb', precoRef: 12000, fonte: 'Referência editável (SINAPI/local)', observacao: 'Revisar com base oficial da contratação.' },
  { id: 'base-esg-001', codigo: 'ESG-001', grupo: 'Redes', subgrupo: 'Rede coletora', item: 'Extensão de rede de esgoto', unidade: 'm', precoRef: 132, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-agu-001', codigo: 'AGU-001', grupo: 'Redes', subgrupo: 'Rede de água', item: 'Extensão de rede de água', unidade: 'm', precoRef: 145, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-dre-001', codigo: 'DRE-001', grupo: 'Redes', subgrupo: 'Drenagem pluvial', item: 'Extensão de rede de drenagem', unidade: 'm', precoRef: 180, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-val-001', codigo: 'VAL-001', grupo: 'Serviços', subgrupo: 'Valas', item: 'Escavação de vala', unidade: 'm³', precoRef: 38, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-val-002', codigo: 'VAL-002', grupo: 'Serviços', subgrupo: 'Valas', item: 'Escoramento de vala', unidade: 'm²', precoRef: 18, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-val-003', codigo: 'VAL-003', grupo: 'Serviços', subgrupo: 'Valas', item: 'Reaterro compactado', unidade: 'm³', precoRef: 45, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-bf-001', codigo: 'BF-001', grupo: 'Serviços', subgrupo: 'Transporte', item: 'Transporte de bota-fora', unidade: 'm³', precoRef: 32, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-pav-006', codigo: 'PAV-006', grupo: 'Pavimento', subgrupo: 'Asfalto', item: 'CBUQ / PMF / TSD', unidade: 'm³', precoRef: 980, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-pav-008', codigo: 'PAV-008', grupo: 'Pavimento', subgrupo: 'Concreto', item: 'Concreto rígido', unidade: 'm²', precoRef: 210, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-pv-001', codigo: 'PV-001', grupo: 'Estruturas', subgrupo: 'Poços de visita', item: 'Poços de visita / estruturas', unidade: 'un', precoRef: 2850, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-pv-002', codigo: 'PV-002', grupo: 'Estruturas', subgrupo: 'Poços de visita', item: 'Armadura estimada de PV', unidade: 'kg', precoRef: 8.5, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-mat-oc-150', codigo: 'MAT-OC-150', grupo: 'Materiais', subgrupo: 'Tubos', item: 'Tubo PVC Ocre DN 150', unidade: 'm', precoRef: 72, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-mat-pba-100', codigo: 'MAT-PBA-100', grupo: 'Materiais', subgrupo: 'Tubos', item: 'Tubo PVC PBA DN 100', unidade: 'm', precoRef: 82, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
  { id: 'base-mat-dre-400', codigo: 'MAT-DRE-400', grupo: 'Materiais', subgrupo: 'Drenagem', item: 'Tubo Concreto PA-1 DN 400', unidade: 'm', precoRef: 160, fonte: 'BASE_SINAPI', observacao: 'Preço de referência inicial.' },
]

function paramMap(params: ParamRow[]) {
  const map = new Map(defaultParams.map((item) => [item.parametro, item.valor]))
  params.forEach((item) => map.set(item.parametro, item.valor))
  return (name: string) => map.get(name) ?? defaultParams.find((item) => item.parametro === name)?.valor ?? 0
}

function byRede<T>(rede: RedeTipo, esgoto: T, agua: T, drenagem: T) {
  if (rede === 'Água') return agua
  if (rede === 'Drenagem') return drenagem
  return esgoto
}

function calcTrecho(t: TrechoRow, p: (name: string) => number): TrechoCalc {
  const profMedia = round((Number(t.profInicial) + Number(t.profFinal)) / 2, 2)
  const folga = t.dn <= 150 ? p('Folga lateral por lado para DN <= 150') : t.dn <= 400 ? p('Folga lateral por lado para 200 <= DN <= 400') : p('Folga lateral por lado para DN > 400')
  const larguraMin = t.dn <= 150 ? p('Largura mínima de vala para DN <= 150') : t.dn <= 400 ? p('Largura mínima de vala para 200 <= DN <= 400') : p('Largura mínima de vala para DN > 400')
  const larguraAuto = round(Math.max(t.de / 1000 + 2 * folga, larguraMin), 2)
  const larguraUtilizada = Number(t.larguraAdotada) > 0 ? Number(t.larguraAdotada) : larguraAuto
  const fatorEmpolamento = t.solo === 'Argila' ? p('Fator de empolamento - Argila') : t.solo === 'Areia' ? p('Fator de empolamento - Areia') : t.solo === 'Rocha' ? p('Fator de empolamento - Rocha') : 1
  const larguraRecompUtil = Number(t.larguraRecomposicao) > 0 ? Number(t.larguraRecomposicao) : larguraUtilizada
  const areaSecaoVala = larguraUtilizada * profMedia
  const volumeEscavacao = t.comprimento * areaSecaoVala
  const escoramento = profMedia >= p('Profundidade limite para escoramento') ? 'SIM' : 'NÃO'
  const areaEscoramento = escoramento === 'SIM' ? 2 * t.comprimento * profMedia : 0
  const espBerco = byRede(t.rede, p('Espessura berço - rede de esgoto'), p('Espessura berço - rede de água'), p('Espessura berço - rede de drenagem'))
  const volumeBerco = t.comprimento * larguraUtilizada * espBerco
  const alturaEnvolvimento = byRede(t.rede, p('Altura envolvimento selecionado - esgoto'), p('Altura envolvimento selecionado - água'), p('Altura envolvimento selecionado - drenagem'))
  const volumeEnvolvimento = t.comprimento * larguraUtilizada * alturaEnvolvimento
  const volumeTubo = Math.PI * (t.de / 1000) ** 2 / 4 * t.comprimento
  const volumeLiquido = Math.max(volumeEscavacao - volumeBerco - volumeEnvolvimento - volumeTubo, 0)
  const reaproveitamentoUsado = t.reaproveitamento !== '' ? pct(Number(t.reaproveitamento)) : pct(p('% de reaproveitamento do material escavado'))
  const reaterroReaproveitado = volumeLiquido * reaproveitamentoUsado
  const reaterroImportado = volumeLiquido * (1 - reaproveitamentoUsado)
  const botaForaInSitu = reaterroImportado
  const botaForaEmpolado = botaForaInSitu * fatorEmpolamento
  const areaRecompTotal = t.superficie === 'Terra' ? 0 : t.comprimento * larguraRecompUtil
  const areaAsfalto = t.superficie === 'Asfalto' ? areaRecompTotal : 0
  const areaConcreto = t.superficie === 'Concreto' ? areaRecompTotal : 0
  const areaBloco = t.superficie === 'Bloco' ? areaRecompTotal : 0
  const volumeSubBase = areaAsfalto * p('Espessura sub-base para recomposição asfáltica') + areaBloco * p('Espessura colchão de areia para bloco')
  const volumeRevestimento = areaAsfalto * p('Espessura capa asfáltica') + areaConcreto * p('Espessura pavimento em concreto') + areaBloco * p('Espessura bloco intertravado')
  const tuboComPerdas = t.comprimento * (1 + pct(p('Perda de tubos')))
  const testeDesinfeccao = t.rede === 'Água' ? t.comprimento : 0
  const fatorCompactacao = t.solo === 'Argila' ? p('Fator de compactação - Argila') : t.solo === 'Areia' ? p('Fator de compactação - Areia') : t.solo === 'Rocha' ? p('Fator de compactação - Rocha') : 1
  const curvasAuto = t.rede === 'Água' ? Math.round(t.comprimento * p('Acessórios água - curvas por 100 m') / 100) : t.rede === 'Esgoto' ? Math.round(t.comprimento * p('Acessórios esgoto - curvas por 100 m') / 100) : 0
  const tesAuto = t.rede === 'Água' ? Math.round(t.comprimento * p('Acessórios água - tês por 100 m') / 100) : t.rede === 'Esgoto' ? Math.round(t.comprimento * p('Acessórios esgoto - tês por 100 m') / 100) : 0
  const registrosAuto = t.rede === 'Água' ? Math.round(t.comprimento * p('Acessórios água - registros por 100 m') / 100) : 0
  const ventosasAuto = t.rede === 'Água' ? Math.ceil(t.comprimento * p('Acessórios água - ventosas por 100 m') / 100) : 0
  return {
    profMedia: round(profMedia),
    larguraAuto: round(larguraAuto),
    larguraUtilizada: round(larguraUtilizada),
    fatorEmpolamento: round(fatorEmpolamento, 2),
    larguraRecompUtil: round(larguraRecompUtil),
    areaSecaoVala: round(areaSecaoVala),
    volumeEscavacao: round(volumeEscavacao),
    escoramento,
    areaEscoramento: round(areaEscoramento),
    espBerco: round(espBerco, 2),
    volumeBerco: round(volumeBerco),
    alturaEnvolvimento: round(alturaEnvolvimento, 2),
    volumeEnvolvimento: round(volumeEnvolvimento),
    volumeTubo: round(volumeTubo),
    volumeLiquido: round(volumeLiquido),
    reaproveitamentoUsado: round(reaproveitamentoUsado * 100, 1),
    reaterroReaproveitado: round(reaterroReaproveitado),
    reaterroImportado: round(reaterroImportado),
    botaForaInSitu: round(botaForaInSitu),
    botaForaEmpolado: round(botaForaEmpolado),
    areaRecompTotal: round(areaRecompTotal),
    areaAsfalto: round(areaAsfalto),
    areaConcreto: round(areaConcreto),
    areaBloco: round(areaBloco),
    volumeSubBase: round(volumeSubBase),
    volumeRevestimento: round(volumeRevestimento),
    tuboComPerdas: round(tuboComPerdas),
    testeDesinfeccao: round(testeDesinfeccao),
    fatorCompactacao: round(fatorCompactacao, 2),
    botaForaCompactado: round(botaForaInSitu * fatorCompactacao),
    curvasAuto,
    tesAuto,
    registrosAuto,
    ventosasAuto,
    diasEscavacao: round(volumeEscavacao / p('Produtividade escavação vala'), 2),
    diasAssentamento: round(t.comprimento / p('Produtividade assentamento de tubulação'), 2),
    diasRecomposicao: round(areaRecompTotal / 80, 2),
  }
}

function calcPv(pv: PvRow, p: (name: string) => number): PvCalc {
  const isDrenagem = pv.nome.toUpperCase().includes('DR')
  const espParede = p('Espessura de parede do PV')
  const folgaEscavacao = p('Folga lateral de escavação do PV')
  const dimensaoExterna = pv.diametroInterno + 2 * espParede
  const ladoEscavacao = dimensaoExterna + 2 * folgaEscavacao
  const volumeEscavacao = ladoEscavacao * ladoEscavacao * pv.profundidadeTotal
  const espBase = isDrenagem ? p('Espessura base de concreto do PV de drenagem') : p('Espessura base de concreto do PV')
  const volumeBase = ladoEscavacao * ladoEscavacao * espBase
  const alturaUtilParede = Math.max(pv.profundidadeTotal - espBase, 0)
  const areaParede = Math.PI * pv.diametroInterno * alturaUtilParede
  const tampoes = pv.nome ? 1 : 0
  const degraus = Math.ceil(Math.max(pv.profundidadeTotal - 1, 0) / 0.3)
  const volumeReaterroExterno = Math.max(volumeEscavacao - volumeBase - (Math.PI * dimensaoExterna ** 2 / 4 * alturaUtilParede), 0)
  const volumeParedesConcreto = Math.PI * ((dimensaoExterna ** 2 - pv.diametroInterno ** 2) / 4) * alturaUtilParede
  const areaForma = Math.PI * (pv.diametroInterno + dimensaoExterna) * alturaUtilParede
  return {
    espParede,
    folgaEscavacao,
    dimensaoExterna: round(dimensaoExterna),
    ladoEscavacao: round(ladoEscavacao),
    volumeEscavacao: round(volumeEscavacao),
    espBase: round(espBase, 2),
    volumeBase: round(volumeBase),
    alturaUtilParede: round(alturaUtilParede),
    areaParede: round(areaParede),
    tampoes,
    degraus,
    volumeReaterroExterno: round(volumeReaterroExterno),
    volumeParedesConcreto: round(volumeParedesConcreto),
    areaForma: round(areaForma),
    armadura: round(volumeParedesConcreto * p('Taxa de aço estimada para PV')),
    diasExecucao: 1,
    isDrenagem,
  }
}

function quantRows(trechos: TrechoRow[], calcs: TrechoCalc[], pvs: PvRow[], pvCalcs: PvCalc[]): QuantRow[] {
  const by = (rede: RedeTipo, pick: (calc: TrechoCalc, trecho: TrechoRow) => number) => sum(trechos, (trecho, index) => trecho.rede === rede ? pick(calcs[index], trecho) : 0)
  return [
    { grupo: 'Redes', descricao: 'Extensão de rede de esgoto', unidade: 'm', quantidade: by('Esgoto', (_, t) => t.comprimento), criterio: 'Soma do comprimento informado' },
    { grupo: 'Redes', descricao: 'Extensão de rede de água', unidade: 'm', quantidade: by('Água', (_, t) => t.comprimento), criterio: 'Soma do comprimento informado' },
    { grupo: 'Redes', descricao: 'Extensão de rede de drenagem', unidade: 'm', quantidade: by('Drenagem', (_, t) => t.comprimento), criterio: 'Soma do comprimento informado' },
    { grupo: 'Serviços', descricao: 'Escavação de vala - esgoto', unidade: 'm³', quantidade: by('Esgoto', (c) => c.volumeEscavacao), criterio: 'Comprimento x largura utilizada x profundidade média' },
    { grupo: 'Serviços', descricao: 'Escavação de vala - água', unidade: 'm³', quantidade: by('Água', (c) => c.volumeEscavacao), criterio: 'Comprimento x largura utilizada x profundidade média' },
    { grupo: 'Serviços', descricao: 'Escavação de vala - drenagem', unidade: 'm³', quantidade: by('Drenagem', (c) => c.volumeEscavacao), criterio: 'Comprimento x largura utilizada x profundidade média' },
    { grupo: 'Serviços', descricao: 'Escoramento - esgoto', unidade: 'm²', quantidade: by('Esgoto', (c) => c.areaEscoramento), criterio: '2 faces x profundidade x comprimento quando aplicável' },
    { grupo: 'Serviços', descricao: 'Escoramento - água', unidade: 'm²', quantidade: by('Água', (c) => c.areaEscoramento), criterio: '2 faces x profundidade x comprimento quando aplicável' },
    { grupo: 'Serviços', descricao: 'Escoramento - drenagem', unidade: 'm²', quantidade: by('Drenagem', (c) => c.areaEscoramento), criterio: '2 faces x profundidade x comprimento quando aplicável' },
    { grupo: 'Serviços', descricao: 'Berço de areia - esgoto', unidade: 'm³', quantidade: by('Esgoto', (c) => c.volumeBerco), criterio: 'Comprimento x largura utilizada x espessura do berço' },
    { grupo: 'Serviços', descricao: 'Berço de areia - água', unidade: 'm³', quantidade: by('Água', (c) => c.volumeBerco), criterio: 'Comprimento x largura utilizada x espessura do berço' },
    { grupo: 'Serviços', descricao: 'Berço de areia - drenagem', unidade: 'm³', quantidade: by('Drenagem', (c) => c.volumeBerco), criterio: 'Comprimento x largura utilizada x espessura do berço' },
    { grupo: 'Serviços', descricao: 'Envolvimento selecionado - esgoto', unidade: 'm³', quantidade: by('Esgoto', (c) => c.volumeEnvolvimento), criterio: 'Comprimento x largura utilizada x altura de envolvimento' },
    { grupo: 'Serviços', descricao: 'Envolvimento selecionado - água', unidade: 'm³', quantidade: by('Água', (c) => c.volumeEnvolvimento), criterio: 'Comprimento x largura utilizada x altura de envolvimento' },
    { grupo: 'Serviços', descricao: 'Envolvimento selecionado - drenagem', unidade: 'm³', quantidade: by('Drenagem', (c) => c.volumeEnvolvimento), criterio: 'Comprimento x largura utilizada x altura de envolvimento' },
    { grupo: 'Serviços', descricao: 'Reaterro reaproveitado - esgoto', unidade: 'm³', quantidade: by('Esgoto', (c) => c.reaterroReaproveitado), criterio: 'Volume líquido x % reaproveitamento' },
    { grupo: 'Serviços', descricao: 'Reaterro reaproveitado - água', unidade: 'm³', quantidade: by('Água', (c) => c.reaterroReaproveitado), criterio: 'Volume líquido x % reaproveitamento' },
    { grupo: 'Serviços', descricao: 'Reaterro reaproveitado - drenagem', unidade: 'm³', quantidade: by('Drenagem', (c) => c.reaterroReaproveitado), criterio: 'Volume líquido x % reaproveitamento' },
    { grupo: 'Serviços', descricao: 'Reaterro com material importado - esgoto', unidade: 'm³', quantidade: by('Esgoto', (c) => c.reaterroImportado), criterio: 'Parcela não reaproveitada' },
    { grupo: 'Serviços', descricao: 'Reaterro com material importado - água', unidade: 'm³', quantidade: by('Água', (c) => c.reaterroImportado), criterio: 'Parcela não reaproveitada' },
    { grupo: 'Serviços', descricao: 'Reaterro com material importado - drenagem', unidade: 'm³', quantidade: by('Drenagem', (c) => c.reaterroImportado), criterio: 'Parcela não reaproveitada' },
    { grupo: 'Serviços', descricao: 'Transporte de bota-fora - esgoto', unidade: 'm³ emp.', quantidade: by('Esgoto', (c) => c.botaForaEmpolado), criterio: 'Bota-fora x fator de empolamento' },
    { grupo: 'Serviços', descricao: 'Transporte de bota-fora - água', unidade: 'm³ emp.', quantidade: by('Água', (c) => c.botaForaEmpolado), criterio: 'Bota-fora x fator de empolamento' },
    { grupo: 'Serviços', descricao: 'Transporte de bota-fora - drenagem', unidade: 'm³ emp.', quantidade: by('Drenagem', (c) => c.botaForaEmpolado), criterio: 'Bota-fora x fator de empolamento' },
    { grupo: 'Pavimento', descricao: 'Recomposição asfáltica', unidade: 'm²', quantidade: sum(calcs, (c) => c.areaAsfalto), criterio: 'Área de recomposição em superfície asfáltica' },
    { grupo: 'Pavimento', descricao: 'Recomposição em concreto', unidade: 'm²', quantidade: sum(calcs, (c) => c.areaConcreto), criterio: 'Área de recomposição em concreto' },
    { grupo: 'Pavimento', descricao: 'Recomposição em bloco', unidade: 'm²', quantidade: sum(calcs, (c) => c.areaBloco), criterio: 'Área de recomposição em bloco intertravado' },
    { grupo: 'Pavimento', descricao: 'Sub-base de recomposição', unidade: 'm³', quantidade: sum(calcs, (c) => c.volumeSubBase), criterio: 'Para asfalto e bloco, conforme parâmetros' },
    { grupo: 'Pavimento', descricao: 'Camada de revestimento', unidade: 'm³', quantidade: sum(calcs, (c) => c.volumeRevestimento), criterio: 'Asfalto, concreto ou bloco, conforme superfície' },
    { grupo: 'Ensaios', descricao: 'Teste / desinfecção da rede de água', unidade: 'm', quantidade: sum(calcs, (c) => c.testeDesinfeccao), criterio: 'Aplicado aos trechos de água' },
    { grupo: 'Estruturas', descricao: 'Quantidade de PV / estruturas', unidade: 'un', quantidade: pvs.length, criterio: 'Número de linhas preenchidas na aba PVs' },
    { grupo: 'Estruturas', descricao: 'Quantidade de PV de drenagem', unidade: 'un', quantidade: pvCalcs.filter((pv) => pv.isDrenagem).length, criterio: 'Estruturas pluviais identificadas como PV-DR' },
    { grupo: 'Estruturas', descricao: 'Escavação de PV / estruturas', unidade: 'm³', quantidade: sum(pvCalcs, (c) => c.volumeEscavacao), criterio: 'Lado de escavação x lado x profundidade' },
    { grupo: 'Estruturas', descricao: 'Base de concreto de PV / estruturas', unidade: 'm³', quantidade: sum(pvCalcs, (c) => c.volumeBase), criterio: 'Lado de escavação x lado x espessura base' },
    { grupo: 'Estruturas', descricao: 'Área de parede / anéis de PV', unidade: 'm²', quantidade: sum(pvCalcs, (c) => c.areaParede), criterio: 'Circunferência interna x altura útil' },
    { grupo: 'Estruturas', descricao: 'Tampões de PV / estruturas', unidade: 'un', quantidade: sum(pvCalcs, (c) => c.tampoes), criterio: '1 por estrutura lançada' },
    { grupo: 'Estruturas', descricao: 'Degraus de PV / estruturas', unidade: 'un', quantidade: sum(pvCalcs, (c) => c.degraus), criterio: 'Arredondamento por profundidade' },
    { grupo: 'Serviços', descricao: 'Transporte de bota-fora compactado - esgoto', unidade: 'm³ comp.', quantidade: by('Esgoto', (c) => c.botaForaCompactado), criterio: 'Bota-fora in situ x fator de compactação' },
    { grupo: 'Serviços', descricao: 'Transporte de bota-fora compactado - água', unidade: 'm³ comp.', quantidade: by('Água', (c) => c.botaForaCompactado), criterio: 'Bota-fora in situ x fator de compactação' },
    { grupo: 'Serviços', descricao: 'Transporte de bota-fora compactado - drenagem', unidade: 'm³ comp.', quantidade: by('Drenagem', (c) => c.botaForaCompactado), criterio: 'Bota-fora in situ x fator de compactação' },
    { grupo: 'Acessórios auto', descricao: 'Curvas automáticas - esgoto', unidade: 'un', quantidade: by('Esgoto', (c) => c.curvasAuto), criterio: 'Premissa automática por 100 m' },
    { grupo: 'Acessórios auto', descricao: 'Curvas automáticas - água', unidade: 'un', quantidade: by('Água', (c) => c.curvasAuto), criterio: 'Premissa automática por 100 m' },
    { grupo: 'Acessórios auto', descricao: 'Tês automáticos - esgoto', unidade: 'un', quantidade: by('Esgoto', (c) => c.tesAuto), criterio: 'Premissa automática por 100 m' },
    { grupo: 'Acessórios auto', descricao: 'Tês automáticos - água', unidade: 'un', quantidade: by('Água', (c) => c.tesAuto), criterio: 'Premissa automática por 100 m' },
    { grupo: 'Acessórios auto', descricao: 'Registros automáticos - água', unidade: 'un', quantidade: by('Água', (c) => c.registrosAuto), criterio: 'Premissa automática por 100 m' },
    { grupo: 'Acessórios auto', descricao: 'Ventosas automáticas - água', unidade: 'un', quantidade: by('Água', (c) => c.ventosasAuto), criterio: 'Premissa automática por 100 m' },
    { grupo: 'Estruturas', descricao: 'Paredes de concreto de PV', unidade: 'm³', quantidade: sum(pvCalcs, (c) => c.volumeParedesConcreto), criterio: 'Volume de paredes cilíndricas' },
    { grupo: 'Estruturas', descricao: 'Área de forma de PV', unidade: 'm²', quantidade: sum(pvCalcs, (c) => c.areaForma), criterio: 'Área interna + externa estimada' },
    { grupo: 'Estruturas', descricao: 'Armadura estimada de PV', unidade: 'kg', quantidade: sum(pvCalcs, (c) => c.armadura), criterio: 'Volume de concreto x taxa de aço' },
  ].map((row) => ({ ...row, quantidade: round(row.quantidade) }))
}

function materialRows(trechos: TrechoRow[], calcs: TrechoCalc[], pvs: PvRow[], pvCalcs: PvCalc[], accessorios: AccessoryRow[]): MaterialRow[] {
  const pipeMap = new Map<string, MaterialRow>()
  trechos.forEach((trecho, index) => {
    const key = `${trecho.rede}|${trecho.material}|${trecho.dn}`
    const current = pipeMap.get(key)
    const descricao = trecho.material === 'Tubo Concreto PA-1' ? `Tubo Concreto PA-1 DN ${trecho.dn}` : `Tubo ${trecho.material} DN ${trecho.dn}`
    pipeMap.set(key, {
      grupo: 'Tubos',
      rede: trecho.rede,
      material: trecho.material,
      dn: String(trecho.dn),
      descricao,
      unidade: 'm',
      quantidade: round((current?.quantidade ?? 0) + calcs[index].tuboComPerdas),
    })
  })

  const rows = [...pipeMap.values()]
  rows.push({ grupo: 'Estruturas', rede: 'Geral', material: 'PV', dn: '-', descricao: 'Poços de visita / estruturas', unidade: 'un', quantidade: pvs.length })
  rows.push({ grupo: 'Estruturas', rede: 'Geral', material: 'Tampão', dn: '-', descricao: 'Tampões', unidade: 'un', quantidade: sum(pvCalcs, (c) => c.tampoes) })
  rows.push({ grupo: 'Estruturas', rede: 'Geral', material: 'Degrau', dn: '-', descricao: 'Degraus', unidade: 'un', quantidade: sum(pvCalcs, (c) => c.degraus) })
  accessorios.filter((item) => item.item.trim()).forEach((item) => {
    rows.push({ grupo: 'Acessórios', rede: item.rede, material: item.item, dn: '-', descricao: item.item, unidade: item.unidade, quantidade: item.quantidade })
  })
  return rows.filter((row) => row.quantidade > 0)
}

function makeOrcamento(quantitativos: QuantRow[], materiais: MaterialRow[]): OrcamentoLine[] {
  const codeByDescription: Record<string, string> = {
    'Extensão de rede de esgoto': 'ESG-001',
    'Extensão de rede de água': 'AGU-001',
    'Extensão de rede de drenagem': 'DRE-001',
    'Escavação de vala - esgoto': 'VAL-001',
    'Escavação de vala - água': 'VAL-001',
    'Escavação de vala - drenagem': 'VAL-001',
    'Escoramento - esgoto': 'VAL-002',
    'Escoramento - água': 'VAL-002',
    'Escoramento - drenagem': 'VAL-002',
    'Reaterro com material importado - esgoto': 'VAL-003',
    'Reaterro com material importado - água': 'VAL-003',
    'Reaterro com material importado - drenagem': 'VAL-003',
    'Transporte de bota-fora - esgoto': 'BF-001',
    'Transporte de bota-fora - água': 'BF-001',
    'Transporte de bota-fora - drenagem': 'BF-001',
    'Recomposição em concreto': 'PAV-008',
    'Camada de revestimento': 'PAV-006',
    'Quantidade de PV / estruturas': 'PV-001',
    'Armadura estimada de PV': 'PV-002',
  }
  const materialCode = (row: MaterialRow) => {
    if (row.descricao === 'Tubo PVC Ocre DN 150') return 'MAT-OC-150'
    if (row.descricao === 'Tubo PVC PBA DN 100') return 'MAT-PBA-100'
    if (row.descricao === 'Tubo Concreto PA-1 DN 400') return 'MAT-DRE-400'
    return ''
  }
  const qRows = quantitativos
    .filter((row) => row.quantidade > 0)
    .map((row) => ({ id: `orc-${row.descricao}`, grupo: row.grupo, codigoRef: codeByDescription[row.descricao] ?? '', descricao: row.descricao, unidade: row.unidade, quantidade: row.quantidade }))
  const mRows = materiais
    .filter((row) => row.quantidade > 0)
    .map((row) => ({ id: `orc-mat-${row.descricao}`, grupo: 'Materiais', codigoRef: materialCode(row), descricao: row.descricao, unidade: row.unidade, quantidade: row.quantidade }))
  return [...qRows, ...mRows]
}

function producao(quantitativos: QuantRow[], pvs: PvRow[], pvCalcs: PvCalc[], p: (name: string) => number): ProductionRow[] {
  const get = (descricao: string) => quantitativos.find((row) => row.descricao === descricao)?.quantidade ?? 0
  const rows: ProductionRow[] = [
    { grupo: 'Valas', servico: 'Escavação de vala - esgoto', unidade: 'm³', quantidade: get('Escavação de vala - esgoto'), produtividade: p('Produtividade escavação vala'), equipes: 1, dias: 0 },
    { grupo: 'Valas', servico: 'Escavação de vala - água', unidade: 'm³', quantidade: get('Escavação de vala - água'), produtividade: p('Produtividade escavação vala'), equipes: 1, dias: 0 },
    { grupo: 'Tubulação', servico: 'Assentamento de rede de esgoto', unidade: 'm', quantidade: get('Extensão de rede de esgoto'), produtividade: p('Produtividade assentamento de tubulação'), equipes: 1, dias: 0 },
    { grupo: 'Tubulação', servico: 'Assentamento de rede de água', unidade: 'm', quantidade: get('Extensão de rede de água'), produtividade: p('Produtividade assentamento de tubulação'), equipes: 1, dias: 0 },
    { grupo: 'Pavimento', servico: 'Recomposição asfáltica', unidade: 'm²', quantidade: get('Recomposição asfáltica'), produtividade: p('Produtividade recomposição asfáltica'), equipes: 1, dias: 0 },
    { grupo: 'Pavimento', servico: 'Recomposição em concreto', unidade: 'm²', quantidade: get('Recomposição em concreto'), produtividade: p('Produtividade recomposição em concreto'), equipes: 1, dias: 0 },
    { grupo: 'Estruturas', servico: 'Execução de PV', unidade: 'un', quantidade: pvs.length, produtividade: p('Produtividade execução de PV'), equipes: 1, dias: 0 },
    { grupo: 'Valas', servico: 'Escavação de vala - drenagem', unidade: 'm³', quantidade: get('Escavação de vala - drenagem'), produtividade: p('Produtividade escavação vala'), equipes: 1, dias: 0 },
    { grupo: 'Tubulação', servico: 'Assentamento de rede de drenagem', unidade: 'm', quantidade: get('Extensão de rede de drenagem'), produtividade: p('Produtividade assentamento de tubulação'), equipes: 1, dias: 0 },
    { grupo: 'Estruturas', servico: 'Execução de PV de drenagem', unidade: 'un', quantidade: pvCalcs.filter((pv) => pv.isDrenagem).length, produtividade: p('Produtividade execução de PV'), equipes: 1, dias: 0 },
  ]
  return rows.map((row) => ({ ...row, dias: row.produtividade > 0 ? round(row.quantidade / (row.produtividade * row.equipes), 6) : 0 }))
}

function makeLevantamento(orcamento: OrcamentoLine[], refs: BaseRef[], bdiTotal: number): LevantamentoLine[] {
  const preliminares: OrcamentoLine[] = [
    { id: 'lev-pre-001', grupo: 'Serviços iniciais / preliminares', codigoRef: 'PRE-001', descricao: 'Mobilização de equipe e equipamentos', unidade: 'vb', quantidade: 1 },
    { id: 'lev-pre-002', grupo: 'Serviços iniciais / preliminares', codigoRef: 'PRE-002', descricao: 'Desmobilização final', unidade: 'vb', quantidade: 1 },
  ]
  const source = [...preliminares, ...orcamento].filter((line) => line.quantidade > 0)
  const rawRows = source.map((line) => {
    const ref = refs.find((item) => item.codigo === line.codigoRef)
    const puDireto = ref?.precoRef ?? 0
    const custoDireto = line.quantidade * puDireto
    const puBdi = puDireto * (1 + bdiTotal / 100)
    const totalBdi = line.quantidade * puBdi
    return {
      ...line,
      secao: ref?.grupo ?? line.grupo,
      subgrupo: ref?.subgrupo ?? line.grupo,
      origem: ref ? 'BASE_SINAPI' : 'Manual',
      puDireto,
      custoDireto,
      bdi: bdiTotal,
      puBdi,
      totalBdi,
      participacao: 0,
      fonte: ref?.fonte ?? 'Sem código vinculado',
      situacao: ref ? 'Automático' as const : 'Revisar' as const,
    }
  })
  const total = sum(rawRows, (row) => row.totalBdi)
  return rawRows.map((row) => ({ ...row, participacao: total > 0 ? row.totalBdi / total * 100 : 0 }))
}

function makeCurvaAbc(rows: LevantamentoLine[]): AbcRow[] {
  const total = sum(rows, (row) => row.totalBdi)
  let acumulado = 0
  return [...rows]
    .sort((a, b) => b.totalBdi - a.totalBdi)
    .map((row) => {
      const part = total > 0 ? row.totalBdi / total * 100 : 0
      acumulado += part
      return { ...row, participacao: part, acumulado, classe: acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C' }
    })
}

export function calculatePersonalizado(input: {
  params: ParamRow[]
  trechos: TrechoRow[]
  pvs: PvRow[]
  accessorios: AccessoryRow[]
  bdiComponents: BdiComponent[]
  baseRefs: BaseRef[]
}): QuantCalcResult {
  const p = paramMap(input.params)
  const trechoCalcs = input.trechos.map((trecho) => calcTrecho(trecho, p))
  const pvCalcs = input.pvs.map((pv) => calcPv(pv, p))
  const quantitativos = quantRows(input.trechos, trechoCalcs, input.pvs, pvCalcs)
  const materiais = materialRows(input.trechos, trechoCalcs, input.pvs, pvCalcs, input.accessorios)
  const orcamento = makeOrcamento(quantitativos, materiais)
  const productionRows = producao(quantitativos, input.pvs, pvCalcs, p)
  const bdiTotal = round(sum(input.bdiComponents, (row) => row.percentual), 2)
  const levantamento = makeLevantamento(orcamento, input.baseRefs, bdiTotal)
  const curvaAbc = makeCurvaAbc(levantamento)
  const totals: Totals = {
    extensaoEsgoto: quantitativos.find((row) => row.descricao === 'Extensão de rede de esgoto')?.quantidade ?? 0,
    extensaoAgua: quantitativos.find((row) => row.descricao === 'Extensão de rede de água')?.quantidade ?? 0,
    extensaoDrenagem: quantitativos.find((row) => row.descricao === 'Extensão de rede de drenagem')?.quantidade ?? 0,
    escavacaoTotal: sum(quantitativos.filter((row) => row.descricao.startsWith('Escavação de vala')), (row) => row.quantidade),
    reaterroReaproveitadoTotal: sum(quantitativos.filter((row) => row.descricao.startsWith('Reaterro reaproveitado')), (row) => row.quantidade),
    reaterroImportadoTotal: sum(quantitativos.filter((row) => row.descricao.startsWith('Reaterro com material importado')), (row) => row.quantidade),
    botaForaEmpoladoTotal: sum(quantitativos.filter((row) => row.descricao.startsWith('Transporte de bota-fora -')), (row) => row.quantidade),
    recomposicaoTotal: sum(quantitativos.filter((row) => ['Recomposição asfáltica', 'Recomposição em concreto', 'Recomposição em bloco'].includes(row.descricao)), (row) => row.quantidade),
    pvsTotal: input.pvs.length,
    pvsDrenagem: pvCalcs.filter((pv) => pv.isDrenagem).length,
    tuboTotalComPerdas: sum(trechoCalcs, (row) => row.tuboComPerdas),
    diasTotais: round(sum(productionRows, (row) => row.dias), 2),
  }
  const custoDiretoTotal = sum(levantamento, (row) => row.custoDireto)
  const totalComBdi = sum(levantamento, (row) => row.totalBdi)
  const resumo: SummaryRow[] = [
    { indicador: 'Extensão rede de esgoto', unidade: 'm', valor: totals.extensaoEsgoto, observacao: 'Soma dos trechos de esgoto' },
    { indicador: 'Extensão rede de água', unidade: 'm', valor: totals.extensaoAgua, observacao: 'Soma dos trechos de água' },
    { indicador: 'Extensão rede de drenagem', unidade: 'm', valor: totals.extensaoDrenagem, observacao: 'Soma dos trechos de drenagem' },
    { indicador: 'Escavação total de valas', unidade: 'm³', valor: totals.escavacaoTotal, observacao: 'Esgoto + água + drenagem' },
    { indicador: 'Reaterro reaproveitado total', unidade: 'm³', valor: totals.reaterroReaproveitadoTotal, observacao: 'Esgoto + água + drenagem' },
    { indicador: 'Reaterro importado total', unidade: 'm³', valor: totals.reaterroImportadoTotal, observacao: 'Esgoto + água + drenagem' },
    { indicador: 'Bota-fora empolado total', unidade: 'm³ emp.', valor: totals.botaForaEmpoladoTotal, observacao: 'Esgoto + água + drenagem' },
    { indicador: 'Área total de recomposição', unidade: 'm²', valor: totals.recomposicaoTotal, observacao: 'Asfalto + concreto + bloco' },
    { indicador: 'Quantidade de PV / estruturas', unidade: 'un', valor: totals.pvsTotal, observacao: 'Total lançado' },
    { indicador: 'Quantidade de PV de drenagem', unidade: 'un', valor: totals.pvsDrenagem, observacao: 'Estruturas pluviais identificadas como PV-DR' },
    { indicador: 'Tubo total com perdas', unidade: 'm', valor: totals.tuboTotalComPerdas, observacao: 'Para compra' },
    { indicador: 'Dias totais estimados', unidade: 'dias', valor: totals.diasTotais, observacao: 'Escavação + assentamento + recomposição + PV' },
    { indicador: 'Custo direto total', unidade: 'R$', valor: custoDiretoTotal, observacao: 'Soma do custo direto do orçamento detalhado' },
    { indicador: 'Total com BDI', unidade: 'R$', valor: totalComBdi, observacao: 'Soma do orçamento com BDI' },
    { indicador: 'BDI adotado', unidade: '%', valor: bdiTotal, observacao: 'Composição editável na aba BDI e Indiretos' },
  ]
  return {
    trechoCalcs,
    pvCalcs,
    quantitativos,
    materiais,
    orcamento,
    producao: productionRows,
    resumo,
    levantamento,
    curvaAbc,
    totals,
    bdiTotal,
    custoDiretoTotal,
    totalComBdi,
  }
}

export const qaExpected = {
  extensaoEsgoto: 120,
  extensaoAgua: 180,
  extensaoDrenagem: 85,
  escavacaoTotal: 422.1,
  tuboTotalComPerdas: 404.25,
  bdiAdotado: 27.5,
  diasTotais: 24.18,
  trEg01Escavacao: 144,
  trEg01Escoramento: 480,
  trEg01TuboPerdas: 126,
}
