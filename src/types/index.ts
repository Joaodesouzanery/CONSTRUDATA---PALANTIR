// ─── Activity / Kanban ────────────────────────────────────────────────────────

export type ActivityStatus = 'planned' | 'in_progress' | 'completed'

export interface Activity {
  id: string
  name: string
  plannedQty: number
  actualQty: number
  unit: string
  crewId: string
  status: ActivityStatus
}

// ─── Crews ────────────────────────────────────────────────────────────────────

export interface Timecard {
  id: string
  workerName: string
  role: string
  hoursWorked: number
  hourlyRate: number
}

export interface Crew {
  id: string
  foremanName: string
  crewType: string
  timecards: Timecard[]
  activityIds: string[]
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export interface EquipmentLog {
  id: string
  equipmentId: string
  type: string
  activityId: string
  utilizationHours: number
  hourlyRate: number
}

// ─── Materials ────────────────────────────────────────────────────────────────

export interface MaterialLog {
  id: string
  materialId: string
  projectName: string
  activityId: string
  quantity: number
  unit: string
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export interface ReportPhoto {
  id: string
  base64: string
  label: string
  uploadedAt: string
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface DailyReport {
  id: string
  date: string
  projectName: string
  activities: Activity[]
  crews: Crew[]
  equipmentLogs: EquipmentLog[]
  materialLogs: MaterialLog[]
  photos: ReportPhoto[]
}

// ─── Equipment Profile Module ─────────────────────────────────────────────────

export type EquipmentStatus = 'active' | 'idle' | 'maintenance' | 'alert' | 'offline'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface EquipmentAlert {
  id: string
  equipmentId: string
  severity: AlertSeverity
  type: string
  message: string
  timestamp: string        // ISO string
  acknowledged: boolean
}

export interface EquipmentProfile {
  id: string
  code: string             // e.g. 'EQ-017'
  name: string
  type: string             // e.g. 'Plataforma Elevatória'
  brand: string
  model: string
  year: number
  serialNumber: string
  status: EquipmentStatus
  lat: number | null
  lng: number | null
  siteName: string | null
  siteId?: string | null   // obra vinculada (construction_sites.id); null = todas as obras
  description: string
  maxLoad: string
  lastMaintenance: string  // yyyy-MM-dd
  nextMaintenance: string  // yyyy-MM-dd
  operator: string | null
  contractorName?: string | null
  engineHours: number
  alerts: EquipmentAlert[]
}

// ─── Projetos ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'planning' | 'completed' | 'on_hold'
export type ProjectPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'
export type BudgetLineType = 'labor' | 'equipment' | 'materials' | 'subcontract' | 'overhead' | 'other'
export type DesignViewType = '3D' | '4D' | '5D'
export type DocumentCategory = 'contract' | 'drawing' | 'specification' | 'report' | 'other'

export interface ProjectPhase {
  id: string
  name: string
  status: ProjectPhaseStatus
  progress: number       // 0–100
  startDate: string      // yyyy-MM-dd
  endDate: string        // yyyy-MM-dd
  notes?: string
  responsible?: string   // nome do responsável pela fase
}

export interface BudgetLine {
  id: string
  type: BudgetLineType
  description: string
  budgeted: number       // R$
  projected: number      // R$
  spent: number          // R$
}

export interface DesignDemand {
  id: string
  label: string
  quantity: number
  unit: string
  estimatedCost: number  // R$
}

export interface ProjectDocument {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  base64: string
  uploadedAt: string     // ISO
  uploadedBy: string
  category: DocumentCategory
}

export interface Project {
  id: string
  code: string           // e.g. 'PRJ-001'
  name: string
  owner: string          // dono
  manager: string        // gerente
  description: string
  status: ProjectStatus
  startDate: string      // yyyy-MM-dd
  endDate: string        // yyyy-MM-dd
  planningPhases: ProjectPhase[]   // 3 items: Engenharia e Design, Pré-construção, Aquisições
  executionPhases: ProjectPhase[]  // 3 items: Construção, Controle do Projeto, Encerramento
  budgetLines: BudgetLine[]
  demands: DesignDemand[]
  documents: ProjectDocument[]
  lat?: number        // latitude WGS84
  lng?: number        // longitude WGS84
  address?: string    // endereço textual da obra
  contractNumber?: string   // Nº do contrato
  clientName?: string       // cliente / contratante
  projectManager?: string   // gerente de projeto
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  priority?: 'low' | 'medium' | 'high'
}

// ─── Torre de Controle ────────────────────────────────────────────────────────

export type ObraStatus = 'active' | 'planning' | 'paused' | 'completed'
export type RiskLevel  = 'critical' | 'high' | 'medium' | 'low'
export type RiskStatus = 'identified' | 'active' | 'mitigated' | 'resolved'

export interface ConstructionRisk {
  id: string
  title: string
  description: string
  level: RiskLevel
  status: RiskStatus
  identifiedAt: string  // ISO date string
  notes?: string
}

export interface ConstructionSite {
  id: string
  projectId?: string | null  // vínculo opcional a um Project (bridge p/ EVM/Change Orders/Agenda)
  code: string          // e.g. 'OBR-001'
  name: string          // nome da obra
  company: string       // empresa responsável
  owner: string         // dono da obra
  manager: string       // gerente da construção
  description: string
  status: ObraStatus
  street: string        // rua
  number: string        // número
  district: string      // bairro
  city: string          // cidade
  state: string         // estado (e.g. 'SP')
  cep: string           // CEP
  buildingType: string  // tipo: 'Residencial', 'Comercial', 'Industrial', etc.
  totalArea: number     // m²
  floors: number        // andares / pavimentos
  torres?: number       // (predial) nº de torres/blocos — persiste no payload jsonb, sem migração
  unidades?: number     // (predial) nº de unidades/apartamentos — payload jsonb
  publicSlug?: string   // (predial) slug do QR público de chamados — também gravado na coluna real public_slug
  serviceScope?: string  // escopo genérico: saneamento, água, esgoto, drenagem, edificação etc.
  numeroContrato?: string // nº do contrato da obra (origem oficial p/ RDO/medição)
  /**
   * Região do contrato a que esta obra pertence ('02' = Freguesia). É ela que decide o CÓDIGO e o
   * PREÇO de cada serviço medido aqui — o mesmo serviço custa diferente em Mairiporã.
   * Ausente = obra de contrato sem regiões (a maioria); nada muda para ela.
   */
  regiao?: string
  orcamentoBRL?: number   // orçamento/BAC contratado da obra (R$) — fallback do BAC no RDO/planejamento
  startDate: string     // yyyy-MM-dd
  expectedEnd: string   // yyyy-MM-dd
  lat: number | null
  lng: number | null
  risks: ConstructionRisk[]
  budgetLines?: ConstructionBudgetLine[]
  planningMilestones?: ConstructionMilestone[]
  executionMilestones?: ConstructionMilestone[]
  contrato?: ObraContrato   // contrato & medição por obra (payload jsonb) — "Solicitação de Medição"

  /**
   * Obra arquivada: some do mapa e do strip de cards, mas NADA dela é apagado.
   *
   * É campo próprio, e não um valor novo em `ObraStatus`, por dois motivos. O enum é usado em oito
   * `Record<ObraStatus, …>` EXAUSTIVOS espalhados por quatro arquivos — um valor novo quebra os
   * oito. E, pior, "inativa" apagaria o status real: uma obra Concluída que virasse Inativa perderia
   * a informação de que foi concluída. Arquivar é ortogonal ao ciclo de vida.
   *
   * Ausente = ativa, para as obras que já existem não precisarem de migração de dado. Viaja no
   * payload jsonb, como `torres`/`unidades`/`contrato` — sem migração de schema.
   */
  ativa?: boolean

  /**
   * Preço por m² contratado da obra (R$/m²).
   *
   * Até aqui esse número só existia no Plano de Execução (`PlanoExecucao.precoM2`), cadastrado em
   * Planejamento → Execução. A obra passa a ser a fonte da verdade e o plano continua podendo
   * sobrescrever por período — é o plano que conhece o recorte, a obra que conhece o contrato.
   */
  precoM2?: number
}

/**
 * Natureza de uma linha da composição do contrato.
 *
 * Serve para agrupar o subtotal e para conferir cada parte contra o valor declarado no cabeçalho
 * — e é o que impede o material de ser somado duas vezes.
 */
export type ObraItemCategoria = 'servico' | 'material' | 'frete' | 'equipamento'

export interface ObraContratoServico {
  id: string
  descricao: string
  unidade: string             // 'm²' | 'm' | 'un' | 'vb'…
  qtdContrato: number         // quantidade contratada
  /**
   * Preço cheio da MÃO DE OBRA por unidade. O nome é histórico: antes da separação
   * serviço × material ele era o único preço da linha, e continua sendo lido assim.
   */
  valorUnitario: number
  /**
   * Preço do MATERIAL por unidade, quando a linha carrega os dois.
   *
   * É o formato da proposta real do cliente: 20 linhas com ITEM · DESCRIÇÃO · UN · QTD ·
   * mão de obra · TOTAL, fechando R$ 183.624,55 de mão de obra + R$ 180.030,00 de material.
   * No contrato da SUPERA as linhas têm só mão de obra e o "Faturamento direto" só material —
   * os dois formatos cabem no mesmo modelo, com um dos preços em zero.
   */
  valorMaterialUnit?: number
  /** Ordem de exibição — o "ITEM" numerado da proposta. Ausente = ordem de cadastro. */
  ordem?: number
  /**
   * Natureza da linha. Ausente é lido como `'servico'`, que é o que toda linha já cadastrada é —
   * exceto a de unidade `vb`, tratada como material (ver `categoriaDoItem` em obraMedicao.ts).
   */
  categoria?: ObraItemCategoria
  pctAplicado?: number        // % aplicado (ex.: fase 01) — ausente = 100%
  qtdAnterior?: number        // medido em períodos anteriores (manual)
  qtdMedidaOverride?: number  // sobrepõe a qtd medida AUTO (dos RDOs) quando preenchido
  nPreco?: string
  /**
   * ⚠️ O VÍNCULO COM O CATÁLOGO DO CONTRATO — e a direção de propriedade.
   *
   * Preenchido = esta linha é **projeção** de um `ServicoDoCatalogo` para a região desta obra:
   * é gerada na importação do catálogo e NÃO se edita aqui (edita-se no catálogo, e desce para
   * todas as obras do contrato). Ausente = linha cadastrada à mão (composição colada do Excel),
   * que continua editável exatamente como sempre foi.
   *
   * Existir os dois não é duplicação, é escopo: o catálogo é do CONTRATO (176 serviços × 9
   * regiões, servindo várias obras) e esta lista é da OBRA — e é ela que o de-para de siglas,
   * a medição, o faturamento e os títulos já enxergam. Guardar o catálogo dentro da obra o
   * duplicaria em cada uma.
   */
  servicoCatalogoId?: string
  /** O código do serviço NA REGIÃO desta obra (o mesmo serviço tem código diferente em cada). */
  codigoRegional?: string
  // COMPUTADOS: precoEfetivo = valorUnitario × (pctAplicado/100); medido = Σ produção dos RDOs
  // finalizados dessa obra (por contractServiceId) OU qtdMedidaOverride; saldo = contrato − anterior − medido.
}

// ─── Catálogo de preços do CONTRATO ───────────────────────────────────────────
//
// ⚠️ POR QUE ELE NÃO MORA NA OBRA. Um contrato serve várias obras (o ZN serve Boi Malhado e
// Sakura) e repete cada serviço uma vez por região. Guardar o catálogo dentro de `ObraContrato`
// o copiaria em cada obra — e cópia de preço é exatamente o que o domínio proíbe: medido nas duas
// cidades do contrato Bertioga/Santos, 163 códigos aparecem nas duas e NENHUM tem o mesmo valor.
// Vive em `app_state`, um documento por contrato (ver `utils/medicao/catalogoStorage.ts`).

/** Por que um serviço está marcado para conferência. `ok` = nada a conferir. */
export type FlagDoServico =
  | 'ok'
  /** Uma região tem preço próprio, diferente das demais (Mairiporã, 96 itens). */
  | 'preco_regional_divergente'
  /** O bloco desta região veio deslocado no PDF do apostilamento (Caieiras, 7 itens). */
  | 'bloco_deslocado_pdf'
  /** Descrição truncada em 40 caracteres pelo SAP pode esconder dois serviços diferentes. */
  | 'descricao_truncada_ambigua'

export interface RegiaoDoContrato {
  /** Como aparece no contrato: '01', '02'… É a chave usada em `porRegiao`. */
  codigo: string
  nome: string
  /** Repasse próprio desta região. Ausente = usa o `fatorPadrao` do contrato. */
  fator?: number
}

export interface PrecoRegional {
  /** O código do serviço nesta região ('01030101'). */
  codigo: string
  /** Preço próprio da região. Ausente = usa o `precoZn` do serviço (01–08 são idênticas). */
  precoOverride?: number
}

export interface ServicoDoCatalogo {
  /** Estável e determinístico — ver `idDoServicoDoCatalogo`. */
  id: string
  descricao: string
  unidade: string
  /** Preço cheio do contrato, antes do repasse. */
  precoZn: number
  categoria?: string
  /**
   * Quantidade contratada. ⚠️ Nasce `null`: ela vem da planilha de balanceamento, que ainda não
   * chegou. `null` é "não sei", e a tela mostra "—"; zero seria uma afirmação que ninguém fez.
   */
  qtdContratada: number | null
  flag: FlagDoServico
  /** O texto que explica a flag, para a tela mostrar em vez de um código. */
  motivoFlag?: string
  /**
   * ⚠️ Item marcado assim NUNCA entra na soma da medição — vai para a fila de conferência.
   * É a regra que impede preço não confirmado de virar dinheiro por descuido.
   */
  bloqueadoParaMedicao: boolean
  /** Código (e preço próprio, quando houver) em cada região. Região ausente = não disponível. */
  porRegiao: Record<string, PrecoRegional>
}

/**
 * A última medição importada de um contrato.
 *
 * ⚠️ Documento SEPARADO do catálogo, com chave própria em `app_state`. Catálogo é preço (muda
 * quando o contrato muda); medição é quantidade executada (muda todo mês). Juntar os dois num
 * documento só faria a reimportação de um sobrescrever o outro — que é exatamente o defeito que
 * `planoParaGravar` teve com os preços do FCP.
 */
export interface MedicaoImportada {
  numeroContrato: string
  /** As obras como o cabeçalho da planilha as nomeia. */
  obras: string[]
  /** Região escolhida para cada obra — é ela que decide código e preço. */
  regiaoPorObra: Record<string, string>
  quantidades: Array<{ servicoCatalogoId: string; obra: string; quantidade: number }>
  /** O que a planilha declara na coluna VALOR MEDIÇÃO, para a tela conferir contra o motor. */
  valorDeclarado: number
  importadaEm: string
  importadaPor?: string
  arquivo?: string
}

export interface CatalogoDoContrato {
  numeroContrato: string
  /** Nome do consórcio/cliente, só para a tela. */
  consorcio?: string
  /**
   * Repasse padrão do contrato. No ZN é 0,6 — a Sabesp paga o consórcio pelo preço cheio e a
   * executora recebe 60%. ⚠️ Não é status de aceite: não existe "parcial 60% → aceito 100%".
   */
  fatorPadrao: number
  regioes: RegiaoDoContrato[]
  servicos: ServicoDoCatalogo[]
  importadoEm?: string
  importadoPor?: string
  arquivo?: string
}

/** Contrato & medição por obra (payload da obra) — espelha a planilha "Solicitação de Medição". */
/**
 * Uma linha do extrato de faturamento da obra — uma nota emitida contra o contrato.
 *
 * Espelha a planilha "Obras em Andamento - BSB" linha a linha. O **valor de entrada não é um
 * campo à parte**: é a primeira linha do extrato, marcada com `entrada: true`. Na planilha ela
 * aparece como "Entrada Serviço" / "entrada 40%", ou seja, já é um faturamento — criar um segundo
 * campo para o mesmo número daria dois lugares para digitar e duas versões da verdade.
 */
export interface ObraFaturamento {
  id: string
  data: string              // ISO (yyyy-mm-dd)
  nf?: string               // número da nota
  valor: number
  descricao?: string        // "Entrada Serviço", "2ª medição"…
  /**
   * Retenção (garantia) desta nota — a parte que o cliente não paga na hora.
   *
   * Não é desconto: o dinheiro é seu, fica retido como garantia de que o serviço foi bem feito e
   * é liberado depois da entrega. Some no rodapé e aparece como "a liberar" na carteira; **não**
   * abate do saldo do contrato. Na planilha do cliente só duas notas têm — Parque Nacional
   * R$ 5.091,42 (5,00%) e Brasal R$ 1.070,50 (4,99%), juntas os R$ 6.161,92 do rodapé.
   */
  retencaoTecnica?: number
  /**
   * De qual saldo esta nota abate. Ausente é lido como `'servico'`.
   *
   * É o que separa as duas contas do contrato: o saldo acompanhado é
   * `valorServico − Σ notas de serviço`, e o material é faturado à parte.
   */
  categoria?: 'servico' | 'material'
  /** Data em que o dinheiro entrou. Preenchida quando a nota passa a `'recebido'`. */
  dataRecebimento?: string
  situacao: 'recebido' | 'a_receber'
  /** Quando `situacao === 'a_receber'`: a data prevista (vermelho na planilha do cliente). */
  previsaoRecebimento?: string
  /** Primeira parcela / sinal. É daqui que sai o "valor de entrada" exibido na obra. */
  entrada?: boolean
  observacoes?: string
}

export interface ObraContrato {
  contratanteRazao?: string
  contratanteCnpj?:  string
  contratadoRazao?:  string
  contratadoCnpj?:   string
  contratadoContato?: string
  numeroContrato?:   string
  numeroAditivo?:    string
  objetoAditivo?:    string
  /**
   * @deprecated Use `valorServico` + `valorMaterial`. Continua sendo LIDO como `valorServico`
   * para não quebrar obra já cadastrada — ver `valoresDoContrato()` em `obraMedicao.ts`.
   */
  valorTotal?:       number
  /**
   * Valor de SERVIÇO do contrato — a mão de obra. É contra ele que o saldo é calculado
   * (`saldo = valorServico − Σ faturado`); o material não entra nessa conta.
   */
  valorServico?:     number
  /**
   * Valor de MATERIAL do contrato, faturado à parte.
   *
   * Na planilha BSB da SUPERA são R$ 607.620,00 — exatamente o "Faturamento direto" da cláusula 6
   * do contrato. Era isso que estava modelado como um serviço de unidade `vb`; é um valor de
   * contrato, e agora tem o campo que lhe cabe.
   */
  valorMaterial?:    number
  local?:            string
  numeroMedicao?:    string
  periodoReferencia?: string
  dataSolicitacao?:  string
  /**
   * A VIGÊNCIA do contrato — de quando até quando ele vale. `yyyy-MM-dd`.
   *
   * ⚠️ Não existia, e a falta dela era o buraco por trás de "entrada antiga confrontada com saída
   * de agora": o Financeiro não tinha onde ler o "de X até Y" para recortar a janela. Havia
   * `periodoReferencia`, mas é texto livre que ninguém nunca parseou.
   *
   * Campo OPCIONAL no payload jsonb, então **não precisa de migração**. Vazio, o sistema recorre a
   * `ConstructionSite.startDate` / `expectedEnd`, que já existem e que o Financeiro nunca tinha
   * lido — ver `vigenciaDaObra()` em `obraBudget.ts`.
   */
  vigenciaInicio?:   string
  vigenciaFim?:      string
  /**
   * De-para do RDO WCR: sigla do apontamento → `id` de um `ObraContratoServico` DESTE contrato.
   *
   * ⚠️ **Por que vive aqui e não no plano do FCP.** O plano é reimportado todo mês, e
   * `planoParaGravar` (`fcp/reimportarPlano.ts`) reconstrói o objeto a partir de uma lista FECHADA
   * de campos — qualquer coisa acrescentada ao plano é descartada na reimportação, sem erro. O
   * de-para sumiria em silêncio e as siglas voltariam a "não mapeadas" todo mês.
   *
   * ⚠️ **E por que é por OBRA, não por organização.** Medido nas duas tabelas de preço do cliente:
   * 163 códigos de serviço aparecem nas duas cidades e **nenhum tem o mesmo valor** — a ligação de
   * água mais comum custa R$ 60,95 numa e R$ 56,90 na outra (6,6% de diferença; o pior caso medido
   * chega a 36,9%). Um de-para global aplicaria o preço da cidade errada sem avisar ninguém.
   *
   * Sigla ausente do mapa = ainda não mapeada: a quantidade é gravada e o valor NÃO é calculado.
   * Nunca se escolhe um item por conta própria.
   */
  deParaSiglas?:     Record<string, string>
  /**
   * Qual CIDADE do Fluxo de Caixa Projetado esta obra é (`CidadeFcp.id`, ex.: 'bertioga').
   *
   * ⚠️ Existe porque `PlanoFcp.obraId` é SINGULAR e `premissas.cidades` é plural: um plano só
   * cobre Bertioga e Santos ao mesmo tempo, então não dá para descobrir a cidade a partir da obra
   * sem alguém dizer. Casar por nome pareceria funcionar e quebraria no primeiro "Santos" que for
   * sobrenome — que é literalmente o caso deste cliente, cuja planilha de caixa tem três
   * "Santos" e nenhum é a cidade.
   *
   * Vazio = esta obra não alimenta o FCP, e a tela diz isso em vez de inventar um destino.
   */
  fcpCidadeId?:      string
  /**
   * @deprecated Abatimento percentual cego sobre o medido — a tentativa antiga de separar
   * material. Fica porque obras já cadastradas usam e removê-lo mudaria contrato existente;
   * para separar material, use `valorMaterial`.
   */
  descontoNfPct?:    number
  services:          ObraContratoServico[]
  /** Extrato de faturamento: as notas emitidas contra este contrato. */
  faturamentos?:     ObraFaturamento[]
  /** Contrato assinado, aditivos e propostas. O arquivo vai para o Storage; aqui fica a ficha. */
  documentos?:       ObraDocumento[]
}

/**
 * Um arquivo do contrato — o PDF assinado, um aditivo, a proposta.
 *
 * Só a FICHA mora aqui (no payload da obra); o arquivo vai para o bucket `project-documents`,
 * que já existe e já tem regra por organização. É o padrão de `PlanoAnexo`
 * (`ExecucaoPanel.tsx`), e deliberadamente NÃO o de Projetos, que grava o PDF inteiro em base64
 * dentro do banco — erro que o próprio repositório já teve de reverter no RDO
 * (`20260722130000_rdo_photos_bucket.sql`: "estourava localStorage e inflava o banco").
 */
export interface ObraDocumento {
  id: string
  tipo: 'contrato' | 'aditivo' | 'proposta' | 'art' | 'nf' | 'outro'
  nome: string
  storagePath: string
  mime?: string
  tamanho?: number
  /** ISO. É por ela que as versões são empilhadas — a mais recente em cima. */
  enviadoEm: string
  enviadoPor?: string
}

export interface ConstructionBudgetLine {
  label: string
  amount: number      // valor contratado/orçado
  projected: number   // projeção atualizada
}

export type MilestoneStatus = 'done' | 'active' | 'pending'

export interface ConstructionMilestone {
  name: string
  date: string        // yyyy-MM-dd
  status: MilestoneStatus
}

// ─── Agenda / Gantt ───────────────────────────────────────────────────────────

export type TaskColor    = 'blue' | 'orange' | 'green' | 'red' | 'purple'
export type AgendaPriority = 'low' | 'medium' | 'high' | 'critical'
export type AgendaViewMode = 'day' | 'week' | 'sixWeeks' | 'month' | 'quarter' | 'semester' | 'year'
export type AgendaDisplayView = 'gantt' | 'calendar'

export interface AgendaTask {
  id: string
  title: string
  resourceId: string
  startDate: string   // 'yyyy-MM-dd'
  endDate: string     // 'yyyy-MM-dd'
  color: TaskColor
  status: 'scheduled' | 'unscheduled' | 'completed'
  priority: AgendaPriority   // obrigatório
  assignedTo?: string        // responsável (nome)
  teamLeadName?: string      // encarregado
  location?: string
  estimatedHours?: number
  completionPct?: number     // 0-100
  linkedProjectId?: string
  notes?: string
}

export interface AgendaResource {
  id: string
  code: string
  name: string
  type: 'equipment' | 'crew' | 'other'
  status: 'active' | 'inactive'
}

// ─── Gestão de Equipamentos ───────────────────────────────────────────────────

export type WorkOrderStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type MaintenanceType = 'preventive' | 'corrective' | 'predictive'

export interface MaintenanceOrder {
  id: string
  equipmentId: string
  type: MaintenanceType
  description: string
  scheduledDate: string      // yyyy-MM-dd
  completedDate?: string
  responsible: string
  estimatedCost: number
  actualCost?: number
  status: WorkOrderStatus
  notes?: string
}

// ─── Pré-Construção ───────────────────────────────────────────────────────────

export type PipelineStep   = 'upload' | 'extraction' | 'normalization' | 'matching' | 'proposal'
export type ClauseSeverity = 'critical' | 'warning' | 'info'
export type CostSource     = 'sinapi' | 'seinfra' | 'custom'

export interface TakeoffItem {
  id: string
  description: string
  quantity: number
  unit: string
  confidence: number          // 0–100
  source: string              // filename
  normalized?: boolean
  normalizedDescription?: string
  normalizedQuantity?: number
  normalizedUnit?: string
}

export interface CostMatch {
  takeoffItemId: string
  source: CostSource
  code: string
  description: string
  unit: string
  unitCost: number
  score: number               // 0–100
  selected: boolean
  overrideUnitCost?: number
}

export interface ContractClause {
  id: string
  severity: ClauseSeverity
  type: string
  excerpt: string
  explanation: string
  recommendation: string
}

export interface BDIConfig {
  adminCentral: number
  iss: number
  pisCofins: number
  seguro: number
  lucro: number
}

export interface AnalysisSession {
  id: string
  createdAt: string
  fileNames: string[]
  totalItems: number
  totalCost: number
  status: PipelineStep
}

export interface SinapiEntry {
  code: string
  description: string
  unit: string
  unitCost: number
  category: string
  state: string
  referenceDate: string
}

// ─── Suprimentos / Three-Way Match ────────────────────────────────────────────

export type MatchStatus     = 'matched' | 'partial' | 'discrepancy' | 'pending'
export type ExceptionStatus = 'open' | 'in_review' | 'resolved' | 'escalated'
export type ExceptionType   = 'quantity_diff' | 'price_diff' | 'item_missing' | 'duplicate'
export type POStatus        = 'open' | 'partial' | 'closed' | 'cancelled'
export type InvoiceStatus   = 'pending' | 'pre_approved' | 'approved' | 'rejected'

export interface POItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface PurchaseOrder {
  id: string
  code: string
  supplier: string
  responsible: string
  issuedDate: string
  expectedDelivery: string
  items: POItem[]
  status: POStatus
  projectRef?: string
}

export interface GoodsReceiptItem {
  poItemId: string
  receivedQty: number
  unit: string
  notes?: string
}

export interface GoodsReceipt {
  id: string
  poId: string
  code: string
  receivedDate: string
  receivedBy: string
  items: GoodsReceiptItem[]
}

export interface InvoiceItem {
  poItemId: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface Invoice {
  id: string
  poId: string
  number: string
  supplier: string
  issueDate: string
  dueDate: string
  items: InvoiceItem[]
  totalAmount: number
  status: InvoiceStatus
}

export interface Discrepancy {
  itemId: string
  field: 'quantity' | 'price' | 'missing'
  poValue: number
  receivedValue?: number
  invoicedValue?: number
  delta: number
  deltaPercent: number
}

export interface ThreeWayMatch {
  id: string
  poId: string
  receiptId?: string
  invoiceId?: string
  status: MatchStatus
  matchedAt?: string
  discrepancies: Discrepancy[]
}

export interface MatchException {
  id: string
  matchId: string
  poId: string
  type: ExceptionType
  description: string
  status: ExceptionStatus
  assignedTo: string[]
  suggestedAction: string
  createdAt: string
  resolvedAt?: string
  notes?: string
}

export interface DemandForecast {
  id: string
  siteId?: string | null   // obra (construction_sites.id) — separação por obra
  weekLabel: string
  materialCategory: string
  estimatedQty: number
  unit: string
  suggestedOrderDate: string
  relatedPhase: string
  estimatedValue: number
  status: 'suggested' | 'ordered' | 'dismissed'
}

export type SupplyRiskLevel = 'ok' | 'atenção' | 'crítico'

export interface SupplyIntelligenceDemand {
  id: string
  source: 'planejamento' | 'lookahead' | 'rdo' | 'manual'
  nucleo: string
  local: string
  activityId?: string
  activityName: string
  material: string
  category: string
  unit: string
  requiredQty: number
  plannedDate: string
  executedQty?: number
}

export interface SupplyIntelligenceRecommendation {
  id: string
  demandId: string
  nucleo: string
  material: string
  category: string
  unit: string
  requiredQty: number
  availableQty: number
  reservedQty: number
  inTransitQty: number
  missingQty: number
  suggestedOrderQty: number
  suggestedOrderDate: string
  neededBy: string
  leadTimeDays: number
  preferredSupplier?: string
  estimatedValue: number
  risk: SupplyRiskLevel
  reason: string
}

// ─── Suprimentos: Requisitions & Framework Agreements ────────────────────────

export type RequisitionStatus = 'submitted' | 'parsing' | 'ontology_matched' | 'proposals' | 'ordered'

export interface Requisition {
  id: string
  code: string              // REQ-001
  material: string          // "Cimento CP-II 50kg"
  category: string          // "Cimento / Argamassa"
  quantity: number
  unit: string
  requestedBy: string
  projectRef: string
  siteId?: string | null    // obra (construction_sites.id) — separação por obra
  requestedAt: string       // ISO date
  status: RequisitionStatus
  ontologyMatch?: string    // matched ontology category code
  suggestedSuppliers?: string[]
  linkedPoId?: string
  notes?: string
}

export interface FrameworkAgreement {
  id: string
  code: string              // FA-001
  supplier: string
  category: string
  contractorId?: string | null
  contractorName?: string
  nucleo?: string
  validFrom: string         // yyyy-MM-dd
  validTo: string
  agreedUnitPrice: number
  maxQuantity: number
  unit: string
  leadTimeDays: number
  confidenceScore: number   // 1.0 – 5.0 based on past performance
  status: 'active' | 'expiring' | 'expired'
  terms: string             // short summary of key contract terms
  paymentSchedule?: { dueDate: string; amount: number; status: 'pending' | 'paid' | 'overdue' }[]
  deliverySchedule?: { phase: string; dueDate: string; quantity: number; status: 'on_time' | 'delayed' | 'delivered' }[]
  terminationClause?: string
  priceAdjustmentIndex?: 'IGP-M' | 'INCC' | 'IPCA' | 'Fixo'
  priceAdjustmentPct?: number
}

// ─── Suprimentos & Estoque Inteligente ───────────────────────────────────────

export interface DepositoVirtual {
  id: string
  frente: string           // "Morro do Tetéu", "São Manoel", "Vila dos Criadores", "Escritório"
  descricao?: string
  ativo: boolean
  siteId?: string | null   // obra (construction_sites.id) — separação por obra
}

export interface ItemEstoque {
  id: string
  depositoId: string
  siteId?: string | null   // obra (herda do depósito) — separação por obra
  descricao: string
  unidade: string
  qtdDisponivel: number
  qtdReservada: number
  qtdTransito: number
  estoqueMinimo: number
  custoUnitario?: number
  lpsActivityId?: string
  categoria?: string
  fornecedorPrincipal?: string
  codigoReferencia?: string   // código de referência próprio do usuário (metadata jsonb)
  dataUltimoPedido?: string   // yyyy-MM-dd — data do último pedido (metadata jsonb)
  qtdPorEmbalagem?: number  // un por embalagem (ex.: 96 un/caixa) — facilitador; estoque é sempre em unidades
  unidadeEmbalagem?: string // rótulo da embalagem (ex.: "caixa")
  /** Link do produto no fornecedor (metadata jsonb) — coluna da planilha do almoxarifado. */
  linkProduto?: string
  /** "Realizar Pedido" da planilha (metadata jsonb): marcação manual de que precisa comprar. */
  realizarPedido?: boolean
}

export interface MovimentacaoEstoque {
  id: string
  itemId: string
  depositoId: string
  siteId?: string | null   // obra — separação por obra
  tipo: 'entrada' | 'saida' | 'transferencia' | 'ajuste'
  quantidade: number
  dataMovimento: string
  dataCompra?: string
  fornecedor?: string
  nf?: string
  leadTimeDias?: number
  lpsActivityId?: string
  observacoes?: string
  // ── Ficha de retirada (o formulário de papel do almoxarifado) ─────────────────
  /** Quem LEVOU o material. Não é o `created_by`, que é quem digitou. */
  retiradoPor?: string
  /** Quem entregou — o outro lado da assinatura na ficha. */
  entreguePor?: string
  /** "HH:mm". `dataMovimento` é só a data e não separa duas retiradas do mesmo dia. */
  horaMovimento?: string
  /**
   * Custo unitário congelado no momento da movimentação.
   *
   * Sem ele o valor de uma saída é recalculado com o preço ATUAL do item, e mudar o preço de um
   * produto reescreve retroativamente todo o histórico de consumo dele.
   */
  custoUnitario?: number
}

export interface ReservaMaterial {
  id: string
  itemId: string
  depositoId: string
  siteId?: string | null   // obra (herda do item/depósito) — separação por obra
  lpsActivityId: string
  semana: number
  qtdNecessaria: number
  status: 'verde' | 'amarelo' | 'vermelho'
  nfsEmTransito?: string[]
  previsaoEntrega?: string
  alertaGerado?: boolean
  criadoEm: string
}

export interface LeadTimeRecord {
  id: string
  fornecedor: string
  dataCompra: string
  dataMovimento: string
  nf: string
  leadTimeDias: number
  itemDescricao: string
  categoria?: string
}

// ─── Mão de Obra ──────────────────────────────────────────────────────────────

export type WorkerStatus   = 'active' | 'inactive' | 'suspended' | 'pending_approval'
export type CertStatus     = 'valid' | 'expiring' | 'expired'
export type OccurrenceType = 'weather' | 'material_delay' | 'equipment_failure' | 'holiday' | 'accident' | 'other'

export interface WorkerCertification {
  id: string
  type: string           // 'NR18', 'NR35', 'NR10', 'NR12', 'CIPA', 'ASO', etc.
  issuedDate: string     // yyyy-MM-dd
  expiryDate: string     // yyyy-MM-dd
  status: CertStatus
}

export type ContractType = 'clt' | 'pj' | 'freelancer' | 'apprentice'
export type ScheduleType = 'standard' | '6x1' | '5x2' | '12x36' | 'daily' | 'custom'

export interface Worker {
  id: string
  name: string
  role: string
  cpfMasked: string      // "***.***.***-XX" — last 2 digits only
  crewId: string
  status: WorkerStatus
  certifications: WorkerCertification[]
  hourlyRate: number
  biometricToken?: string  // opaque hash reference — raw biometric never stored
  // Extended HR fields (all optional for backward compatibility)
  registrationNumber?: string   // matrícula
  department?: string
  email?: string
  phone?: string
  admissionDate?: string        // yyyy-MM-dd
  contractType?: ContractType
  scheduleType?: ScheduleType
  workFront?: string            // frente de trabalho
  grossSalary?: number          // salário bruto mensal (R$)
  siteId?: string               // obra cadastrada vinculada (Project.id)
  locationNote?: string         // local — texto livre complementar ao select de obra
  // ── Benefícios: quem tem direito ─────────────────────────────────────────────
  // Antes o cálculo descontava VA e VT de todo mundo, sem perguntar. VT é opção do
  // trabalhador (ele pede) e VA depende do acordo — ausente = não desconta.
  recebeVA?: boolean
  recebeVT?: boolean
  /** Dependentes para a dedução do IRRF. */
  dependentesIRRF?: number
  // ── Desligamento ─────────────────────────────────────────────────────────────
  // Vão no `payload` jsonb da tabela `workers`, sem migração. Só fazem sentido com
  // `status: 'inactive'`; desligar é preferível a excluir porque o rastro da pessoa (turnos,
  // apontamentos, faltas, holerites) não tem chave estrangeira e vira órfão silencioso.
  /** Data do desligamento, `yyyy-MM-dd`. */
  desligamentoData?: string
  /** Motivo, texto livre. Aparece no selo e no cadastro. */
  desligamentoMotivo?: string
  /**
   * CATEGORIA da habilitação: 'A', 'B', 'AB'… — **nunca o número da CNH.**
   *
   * ⚠️ A distinção é o ponto. A categoria diz o que a pessoa pode dirigir, que é a única coisa que
   * a operação precisa saber para escalar um motorizado. O número identifica a pessoa e é dado
   * pessoal sem finalidade aqui. `NSA` na planilha do cliente vira ausente, não string vazia.
   */
  tipoCnh?: string
  /** Observações operacionais sobre o funcionário, texto livre. */
  observacoes?: string
}

export interface TimecardEntry {
  id: string
  workerId: string
  date: string           // yyyy-MM-dd
  hoursWorked: number
  projectRef: string
  phaseRef: string
  activityDescription: string
  reportedQty: number
  unit: string           // 'm²', 'ml', 'un', etc.
  notes?: string
  sourceRdoId?: string   // origem: RDO que gerou este apontamento (idempotência da ponte RDO→timecards)
  siteId?: string | null // obra (herda do worker/RDO) — separação por obra
  laborCostBRL?: number  // custo do dia deste funcionário (salário+encargos ÷ dias/mês)
}

export interface PhysicalProgress {
  id: string
  date: string           // yyyy-MM-dd
  phaseId: string
  activityName: string
  plannedQty: number
  reportedQty: number
  unit: string
}

export interface LaborCrew {
  id: string
  name: string
  foreman: string
  specialty: string
  workerIds: string[]
  /** Rótulo legado, texto livre. Equipes antigas só têm isto; as novas têm `siteId`. */
  projectRef: string
  /** Obra da Torre de Controle (`ConstructionSite.id`). Vai no payload — sem migração. */
  siteId?: string
}

export interface LaborOccurrence {
  id: string
  date: string           // yyyy-MM-dd
  type: OccurrenceType
  description: string
  impactHours: number
  affectedCrewIds: string[]
}

export interface RiskArea {
  id: string
  name: string
  requiredCertTypes: string[]
}

export interface ReallocationSuggestion {
  id: string
  delayedTaskId: string
  delayedTaskName: string
  delayDays: number
  sourceCrew: string
  sourceTaskId: string
  sourceTaskName: string
  sourceTaskFloat: number
  reason: string
  accepted?: boolean
}

// ─── Otimização de Frota e Equipamentos ───────────────────────────────────────

export type RoutingPriority = 'critical' | 'high' | 'medium' | 'low'
export type HealthRisk      = 'critical' | 'high' | 'medium' | 'low'
export type BuyLeaseRec     = 'buy' | 'lease' | 'neutral'

export interface RoutingRecommendation {
  id: string
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  equipmentType: string
  fromSiteId: string
  fromSiteName: string
  fromLat: number | null
  fromLng: number | null
  toSiteId: string
  toSiteName: string
  toLat: number | null
  toLng: number | null
  reason: string
  utilizationGainPct: number     // e.g. 42 = +42% projected utilisation
  estimatedDistanceKm: number
  suggestedDate: string          // yyyy-MM-dd
  priority: RoutingPriority
  bimPhaseRef?: string           // 4D BIM phase name triggering the need
  accepted?: boolean
}

export interface PredictiveHealth {
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  healthScore: number            // 0-100
  riskLevel: HealthRisk
  predictedFailureWindow: string // e.g. "próximos 15 dias"
  mainFactors: string[]
  recommendedAction: string
  estimatedDowntimeDays: number
  estimatedRepairCostBRL: number
}

export interface BuyLeaseAnalysis {
  id: string
  equipmentType: string
  currentStatus: 'owned' | 'rented' | 'none'
  monthlyRentalCostBRL: number
  purchasePriceBRL: number
  annualMaintenanceCostBRL: number
  residualValueBRL: number
  projectedUsageDays: number     // derived from project portfolio
  annualRentalCostBRL: number
  annualOwnershipCostBRL: number
  breakEvenMonths: number
  recommendation: BuyLeaseRec
  reasoning: string
  bimPhases: string[]            // 4D/5D BIM phase names needing this equipment
  relatedProjects: string[]
}

// ─── Gestão de Projeto 360 / Change Orders ────────────────────────────────────

export type ChangeOrderStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type ChangeOrderType   = 'scope' | 'cost' | 'schedule' | 'safety'

export interface ChangeOrderPhoto {
  id: string
  base64: string
  label: string
  capturedAt: string
}

export interface ChangeOrder {
  id: string
  projectId: string
  projectCode: string
  title: string
  type: ChangeOrderType
  status: ChangeOrderStatus
  description: string
  impactCostBRL: number      // positive = cost increase; negative = savings
  impactDays: number         // positive = delay; negative = acceleration
  photos: ChangeOrderPhoto[]
  submittedBy: string
  submittedAt: string        // ISO datetime
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
  linkedModule?: string      // which module surfaced this issue
  linkedEntityId?: string    // e.g. riskId, equipmentId
}

// ─── Mão de Obra — HR Expansion ───────────────────────────────────────────────

export type ShiftType         = 'regular' | 'overtime' | 'night' | 'holiday' | 'day_off'
export type ShiftStatus       = 'scheduled' | 'confirmed' | 'absent' | 'cancelled'
export type AbsenceType       = 'sick_leave' | 'justified' | 'unjustified' | 'vacation' | 'accident' | 'other'
export type CLTViolationLevel = 'blocking' | 'warning' | 'info'
export type CLTViolationType  = 'max_daily_hours' | 'max_weekly_hours' | 'min_rest' | 'max_overtime' | 'missing_dsr' | 'break_required'

export interface Shift {
  id: string
  workerId: string
  date: string          // yyyy-MM-dd
  startTime: string     // "HH:mm"
  endTime: string       // "HH:mm"
  breakMinutes: number
  type: ShiftType
  /**
   * Frente de trabalho, em texto livre. Continua existindo para compatibilidade e para turno que
   * não pertence a posto nenhum — mas o vínculo confiável é o `workPostId`.
   */
  workFront?: string
  /**
   * O posto que este turno cobre.
   *
   * Antes a ligação entre turno e posto era só a igualdade de dois textos livres
   * (`Shift.workFront === WorkPost.workFront`) mais o cargo. Renomear "Bloco A" para "Bloco-A" em
   * um dos lados quebrava a cobertura **em silêncio**: a célula ficava vermelha sem nada ter
   * mudado na obra. Com o id, o vínculo sobrevive ao nome.
   */
  workPostId?: string
  status: ShiftStatus
  overtimeReason?: string
  /**
   * Obra em que o turno aconteceu, carimbada na criação.
   *
   * Antes o vínculo era só o `worker.siteId` ATUAL, e isso reescrevia o passado: transferir
   * alguém de obra em agosto tirava as horas de julho da obra antiga e as somava na nova —
   * trabalho que nunca aconteceu lá. O apontamento já resolvia isso (`TimecardEntry.siteId`);
   * o turno ficou para trás.
   */
  siteId?: string | null
}

export interface CLTViolation {
  id: string
  workerId: string
  workerName: string
  type: CLTViolationType
  severity: CLTViolationLevel
  description: string
  date: string
}

export interface WorkPost {
  id: string
  name: string           // e.g. "Pedreiro — Fundações"
  workFront: string
  role: string
  minWorkers: number
  shift: 'morning' | 'afternoon' | 'night' | 'all'
}

export interface WorkerAbsence {
  id: string
  workerId: string
  date: string
  type: AbsenceType
  description?: string
  substituteWorkerId?: string
  status: 'open' | 'covered' | 'uncovered'
  registeredAt: string
  /**
   * Obra da falta. A COLUNA `site_id` existe na tabela desde a migração de escopo por obra, mas
   * nunca era escrita — então todo indicador de falta somava as faltas de todas as obras.
   */
  siteId?: string | null
}

// ─── Mão de Obra — Ficha de Avaliação de Funcionário ──────────────────────────

export type AssessmentRating = 'excelente' | 'muito_bom' | 'bom' | 'regular' | 'atencao'

/** 8 critérios subjetivos, nota 0–10 cada. */
export interface AssessmentCriteria {
  qualidade:       number
  retrabalho:      number
  organizacao:     number
  produtividade:   number
  comprometimento: number
  orientacoes:     number
  confiabilidade:  number
  lideranca:       number
}

export interface WorkerAssessment {
  id: string
  workerId: string
  siteId?: string            // obra (Project.id) — pode herdar do worker
  periodStart: string        // yyyy-MM-dd
  periodEnd: string          // yyyy-MM-dd
  absencesCount: number      // puxado automaticamente de absences[]
  lateCount: number          // manual (não há fonte de atrasos no sistema)
  criteria: AssessmentCriteria
  notaFinal: number          // 0–10, média penalizada (1 casa decimal)
  classificacao: AssessmentRating
  notes?: string             // observações / orientações livres
  createdAt: string          // ISO datetime
  createdBy?: string
}

/** Uma faixa de tabela progressiva (INSS ou IRRF). `ate` é o topo da faixa. */
export interface FaixaTributaria {
  ate: number
  aliquota: number    // 0.075 = 7,5%
  deduzir?: number    // só IRRF (parcela a deduzir)
}

/** Redutor do IRRF (Lei 15.270/2025). `reducao = constante − coeficiente × rendimento` no trecho parcial. */
export interface RedutorIrrf {
  /** Rendimento mensal até o qual o imposto é zerado (R$). */
  isentoAte: number
  /** Rendimento mensal até o qual há redução parcial (R$). Acima, tabela cheia. */
  parcialAte: number
  /** Parcela fixa da fórmula do trecho parcial (R$). */
  constante: number
  /** Coeficiente sobre o rendimento no trecho parcial (0.133145 = 13,3145%). */
  coeficiente: number
}

export interface CLTSettings {
  maxDailyHours: number      // default 8
  maxOvertimeHours: number   // default 2
  maxWeeklyHours: number     // default 44
  minRestMinutes: number     // default 660 (11h)
  nightStart: number         // hour, default 22
  nightEnd: number           // hour, default 5
  nightDifferential: number  // %, default 20
  overtimeRate: number       // %, default 50
  rupTargetM2PerHH?: number  // meta TCPO de RUP (homem-hora/m²), default 0.45

  // ── Tabelas fiscais ────────────────────────────────────────────────────────
  // Estavam fixas no código, rotuladas "2025" e com os valores de fevereiro/2024.
  // Como mudam por portaria e ninguém aqui é a fonte da verdade tributária, passam a
  // ser dado da organização, editáveis na tela, com a vigência à vista.
  tabelaInss?: FaixaTributaria[]
  tabelaIrrf?: FaixaTributaria[]
  /** Competência a que as tabelas se referem (yyyy-MM). Só rótulo — mas rótulo que evita mentira. */
  tabelasVigenciaEm?: string
  /** Dedução por dependente no IRRF (R$). */
  irrfDeducaoPorDependente?: number
  /**
   * Redutor do IRRF da Lei 15.270/2025 (vigência 2026): isenção até `isentoAte` de rendimento
   * mensal e redução decrescente até `parcialAte`. Ausente = não aplica (tabelas anteriores a 2026).
   * ⚠️ Os quatro números são do contador, não do produto — entram como foram informados.
   */
  irrfRedutor?: RedutorIrrf

  // ── Encargos do empregador ─────────────────────────────────────────────────
  // O custo-empregador era "bruto + 8% + 20%" fixo no código. RAT/FAP e Sistema S variam por
  // empresa (o FAP é da GFIP), e a CPRB troca o patronal sobre a folha por % da receita. São
  // decisões do contador — aqui só há o campo, com padrão declarado na tela.
  /** RAT × FAP, em %. Padrão 1 — "confirme com o contador". */
  ratPct?: number
  /** Terceiros / Sistema S (SESI, SENAI, SEBRAE, INCRA, salário-educação), em %. Padrão 5,8. */
  sistemaSPct?: number
  /** Desoneração (CPRB): recolhe % da receita e NÃO paga os 20% patronais sobre a folha. */
  regimeCprb?: boolean

  // ── Benefícios ─────────────────────────────────────────────────────────────
  // O código descontava R$ 35/dia de VA de TODO mundo e 6% de VT sem teto, sem
  // cadastro de quem tem direito. Agora é opcional e parametrizado.
  /** Valor de face do VA/VR por dia trabalhado (R$). 0 = não há VA. */
  vaValorDia?: number
  /** % de coparticipação do trabalhador no VA. Legalmente limitado a 20%. */
  vaCoparticipacaoPct?: number
  /** % de desconto do VT sobre o salário base. A lei limita a 6%. */
  vtDescontoPct?: number
}

export interface CMORoleItem {
  role: string
  workerCount: number
  regularHours: number
  overtimeHours: number
  nightHours: number
  baseCost: number
  overtimeCost: number
  nightCost: number
  dsrCost: number
  totalCost: number
}

export interface CMOSummary {
  month: string              // "YYYY-MM"
  regularHours: number
  overtimeHours: number
  nightHours: number
  baseCost: number
  overtimeCost: number
  nightCost: number
  dsrCost: number
  totalCost: number
  roleBreakdown: CMORoleItem[]
}

// ─── Folha de Pagamento ────────────────────────────────────────────────────────

export type DeductionType = 'inss' | 'fgts' | 'irrf' | 'vt' | 'va' | 'health' | 'other'
export type AllowanceType = 'overtime' | 'night_diff' | 'dsr' | 'hazard' | 'transport' | 'meal' | 'other'

export interface PayslipDeduction {
  type: DeductionType
  description: string
  amount: number
  /** false = employer-only cost (e.g. FGTS), not deducted from worker's net */
  workerPays: boolean
}

export interface PayslipAllowance {
  type: AllowanceType
  description: string
  amount: number
}

export interface WorkerPayslip {
  id: string
  workerId: string
  month: string              // "YYYY-MM"
  baseSalary: number         // hourlyRate × regular hours
  allowances: PayslipAllowance[]
  deductions: PayslipDeduction[]
  grossTotal: number         // baseSalary + Σ allowances
  netTotal: number           // grossTotal − Σ deductions where workerPays
  employerCost: number       // grossTotal + FGTS + employer-side INSS
  hoursWorked: number
  overtimeHours: number
  /** Horas noturnas JÁ REDUZIDAS (52min30s = 1h, art. 73 §1º). */
  nightHours: number
  workingDays: number
  /** Faltas e turnos cancelados no mês — não pagos, mas o holerite precisa mostrar por quê. */
  absentDays?: number
  /** Os descontos passaram do bruto. O líquido foi limitado a zero; a tela precisa avisar. */
  descontosExcedemBruto?: boolean
  generatedAt: string
}

export interface PayrollMonth {
  month: string
  payslips: WorkerPayslip[]
  totalGross: number
  totalNet: number
  totalEmployerCost: number
  headcount: number
}

// ─── Gestão de Frotas Veicular ────────────────────────────────────────────────

export type VehicleType    = 'car' | 'truck' | 'van' | 'motorcycle' | 'heavy' | 'pickup'
export type VehicleStatus  = 'active' | 'maintenance' | 'inactive' | 'unavailable'
export type FuelType       = 'gasoline' | 'diesel' | 'ethanol' | 'flex' | 'electric' | 'gnv'
export type VehicleMaintenanceType   = 'preventive' | 'corrective'
export type VehicleMaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type ServiceOrderStatus       = 'open' | 'in_progress' | 'awaiting_parts' | 'completed' | 'cancelled'
export type FineStatus               = 'pending' | 'paid' | 'contested'
export type FleetAlertSeverity       = 'critical' | 'high' | 'medium' | 'low'
export type FleetCostType            = 'fuel' | 'maintenance' | 'fine' | 'insurance' | 'tax' | 'other'
export type RouteStatus              = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface Vehicle {
  id: string
  plate: string              // "ABC-1234" or "ABC1D234" (Mercosul)
  make: string               // "Volkswagen"
  model: string              // "Constellation 17.280"
  year: number
  type: VehicleType
  fuelType: FuelType
  currentKm: number
  status: VehicleStatus
  assignedDriverId?: string
  department?: string
  acquisitionDate: string
  acquisitionValue: number
  notes?: string
}

export interface FuelRecord {
  id: string
  vehicleId: string
  driverId?: string
  date: string
  liters: number
  pricePerLiter: number
  totalCost: number
  kmAtFill: number           // odometer reading at time of fill
  fullTank: boolean
  station?: string
  notes?: string
}

export interface VehicleMaintenanceRecord {
  id: string
  vehicleId: string
  type: VehicleMaintenanceType
  description: string
  serviceDate: string
  nextServiceDate?: string
  nextServiceKm?: number
  kmAtService: number
  cost: number
  provider?: string
  status: VehicleMaintenanceStatus
  notes?: string
}

export interface VehicleDriver {
  id: string
  name: string
  cpfMasked: string          // "***.***.**-XX"
  licenseNumber: string      // CNH number (display only — never logged raw)
  licenseCategory: string    // "B", "C", "D", "E", "AB", etc.
  licenseExpiry: string
  phone: string
  email?: string
  status: 'active' | 'inactive' | 'suspended'
  workerId?: string          // optional link to Worker
}

export interface VehicleRoute {
  id: string
  vehicleId: string
  driverId?: string
  date: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime?: string
  startKm: number
  endKm?: number
  purpose: string
  status: RouteStatus
  notes?: string
}

export interface VehicleServiceOrder {
  id: string
  vehicleId: string
  code: string               // "OS-0001"
  type: VehicleMaintenanceType
  description: string
  requestedBy: string
  requestedAt: string
  scheduledDate?: string
  completedDate?: string
  estimatedCost?: number
  finalCost?: number
  provider?: string
  status: ServiceOrderStatus
  priority: 'urgent' | 'high' | 'normal' | 'low'
  notes?: string
}

export interface VehicleFine {
  id: string
  vehicleId: string
  driverId?: string
  date: string
  description: string
  infraction: string
  points?: number
  amount: number
  dueDate: string
  status: FineStatus
  autoNumber?: string
  notes?: string
}

export interface FleetMaintenanceAlert {
  id: string
  vehicleId: string
  title: string
  description: string
  severity: FleetAlertSeverity
  triggerType: 'km' | 'date' | 'both'
  triggerKm?: number
  triggerDate?: string
  isActive: boolean
  createdAt: string
}

export interface FleetScheduleEntry {
  id: string
  vehicleId: string
  type: 'maintenance' | 'inspection' | 'route'
  title: string
  scheduledDate: string
  driverId?: string
  notes?: string
  status: 'scheduled' | 'completed' | 'cancelled'
}

// ─── Planejamento ─────────────────────────────────────────────────────────────

export type WorkWeekMode = 'mon_fri' | 'mon_sat'
export type AbcZone      = 'A' | 'B' | 'C'
export type PlanSoilType = 'normal' | 'rocky' | 'mixed'
export type PlanServiceType = 'agua' | 'esgoto' | 'civil' | 'manutencao' | 'ambiental' | 'drenagem' | 'edificacao' | 'infraestrutura' | 'outro'

export interface PlanningContract {
  contractName: string
  contractor: string
  startDate: string
  endDate: string
  bacTotal: number
  nucleusCount: number
  theoreticalTaktDays: number
}

export interface PlanningNucleus {
  id: string
  name: string
  location: string
  serviceType: PlanServiceType
  bacWeightPct: number
  budgetBRL: number          // orçamento da frente (split manual do total da obra)
  obraId?: string | null     // obra (construction_sites.id) — frentes por obra
  equipmentInventory?: Partial<Record<'retroescavadeira' | 'compactador' | 'caminhaoBasculante', number>>
}

export interface ResourceDemand {
  headcount: number
  retroescavadeira: number
  compactador: number
  caminhaoBasculante: number
}

export interface FinancialProgress {
  physicalPct: number
  financialPct: number
  earnedValueBRL: number
  plannedValueBRL: number
}

export interface BaselineRevision {
  id: string
  name: string
  createdAt: string
  createdBy: string
  reason: string
  trechos: PlanTrecho[]
  teams: PlanTeam[]
  scheduleConfig: PlanScheduleConfig
}

export interface ImportedScheduleRow {
  code: string
  name: string
  startDate?: string
  endDate?: string
  durationDays?: number
  nucleusName?: string
  serviceType?: PlanServiceType
  lengthM?: number
  depthM?: number
  diameterMm?: number
  unitCostBRL?: number
  predecessors?: string
}

export interface PlanningAuditEntry {
  id: string
  createdAt: string
  action: 'baseline_created' | 'team_reassigned' | 'nucleus_added' | 'wizard_generated' | 'schedule_imported'
  summary: string
  payload?: Record<string, unknown>
}

// ─── Planejamento de Execução (modo Compizzo: plano por obra/período) ──────────
export interface PlanoExecucaoDia {
  data: string            // yyyy-MM-dd
  atividade: string
}
export interface PlanoExecucaoMembro {
  id: string
  workerId?: string | null   // vínculo opcional a Mão de Obra (Fase 2)
  nome: string
  funcao: string
  diasTrabalhados?: string[]  // datas (yyyy-MM-dd) em que o funcionário trabalhou (custo real)
}
export interface PlanoExecucaoBonificacao {
  id: string
  workerId?: string | null
  nome: string
  rPorM2: number             // R$/m² (valor = rPorM2 × areaM2, calculado nos utils)
}
/** Base do rendimento de uma atividade: "por pessoa/dia" ou "total da equipe/dia". */
export type PlanoRendimentoBase = 'pessoa' | 'equipe'
/**
 * Atividade produtiva do plano (ex.: Lixamento, Primer, Polimento, Pintura, Demarcação).
 * Custo por "diária por pessoa": custoEstimado = pessoa-dias × custoDiaPessoa.
 * pessoa-dias derivado de rendimento + pessoas (ver utils/planoExecucao.ts).
 */
export interface PlanoAtividade {
  id: string
  nome: string
  areaM2: number             // default = plano.areaM2 (por atividade pode diferir)
  rendimento: number         // m²/dia (interpretado conforme rendimentoBase)
  rendimentoBase: PlanoRendimentoBase   // 'pessoa' = m²/pessoa/dia | 'equipe' = m²/equipe/dia
  pessoas: number            // headcount alocado nesta atividade
  custoDiaPessoa: number     // R$/dia por pessoa (diária)
  servicoId?: string         // vínculo ao catálogo de Serviços (preenche rendimento/custo/unidade)
  ordem?: number
}
/**
 * Catálogo de Serviços por organização (ex.: Lixamento, Primer, Pintura, Piso Epóxi).
 * Reutilizável no Planejamento de Execução: ao escolher um serviço, a atividade herda
 * unidade/rendimento/custo. Espelha os campos de PlanoAtividade.
 */
export interface Servico {
  id: string
  nome: string
  unidade: string            // m², m, un, kg, L, h...
  rendimento: number         // rendimento padrão (por unidade/dia)
  rendimentoBase: PlanoRendimentoBase   // 'pessoa' | 'equipe'
  custoDiaPessoa: number     // diária padrão (R$/dia por pessoa)
  ordem?: number
}
export type PlanoExecucaoStatus = 'rascunho' | 'ativo' | 'concluido'
export interface PlanoExecucao {
  id: string
  siteId?: string | null     // obra (construction_sites.id); null = todas as obras
  obraNome: string
  periodoInicio: string      // yyyy-MM-dd (META início)
  periodoFim: string         // yyyy-MM-dd (META fim)
  areaM2: number
  servico: string
  precoM2: number
  precoConfirmado: boolean
  faturamentoOverride?: number | null   // null = usa areaM2 × precoM2
  status: PlanoExecucaoStatus
  cronograma: PlanoExecucaoDia[]
  equipe: PlanoExecucaoMembro[]
  bonificacao: PlanoExecucaoBonificacao[]
  condicoes: string          // texto editável (defaults do PDF)
  observacoes?: string
  financeiroEnviadoEm?: string | null   // Fase 2: quando lançado no Financeiro (anti-duplicação)
  // ── Fase 4: Produtividade & Custo (tudo em payload jsonb — sem migração) ──
  atividades?: PlanoAtividade[]          // undefined em planos legados
  horasDia?: number                      // jornada diária (default 8) — base do RUP
  custoDiaPessoaPadrao?: number          // diária padrão herdada por novas atividades
  anexos?: PlanoAnexo[]                  // PDFs do planejamento (Storage; só metadata no payload)
  createdAt: string
  updatedAt: string
}

/** Anexo (PDF do planejamento) — binário no Storage, só metadata no payload jsonb. */
export interface PlanoAnexo {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  storagePath: string       // caminho no bucket 'project-documents'
  uploadedAt: string        // ISO
}

export interface PlanTrecho {
  siteId?: string | null   // obra vinculada (construction_sites.id); null = todas as obras
  id: string
  code: string              // 'T01', 'T02' — user-editable
  description: string
  lengthM: number           // meters
  depthM: number            // avg excavation depth (m)
  diameterMm: number        // pipe diameter in mm
  soilType: PlanSoilType
  requiresShoring: boolean
  unitCostBRL?: number      // from SINAPI / custom
  notes?: string
  nucleusId?: string
  activityType?: PlanServiceType | string
  financialWeightPct?: number
  plannedProgressPct?: number
  physicalProgressPct?: number
  financialProgressPct?: number
  estimatedHH?: number
  equipmentDemand?: Partial<ResourceDemand>
  // Derived — set by schedule engine, stored for display
  assignedTeamIndex?: number
  plannedStartDate?: string // yyyy-MM-dd
  plannedEndDate?: string   // yyyy-MM-dd
  abcZone?: AbcZone
  // Execution tracking — synced from RDO
  executedMeters?: number
  executionStatus?: 'not_started' | 'in_progress' | 'completed'
  lastRdoDate?: string      // date of last RDO entry for this trecho
}

export interface PlanTeam {
  id: string
  name: string
  foremanCount: number
  workerCount: number
  helperCount: number
  operatorCount: number
  retroescavadeira: number
  compactador: number
  caminhaoBasculante: number
  laborHourlyRateBRL: number
  equipmentDailyRateBRL: number
  maxManualExcavDepthM: number   // depth above which excavation is mechanical-only (default 1.5m)
  nucleusId?: string
  capacity?: Partial<ResourceDemand>
}

export interface PlanProductivityTable {
  escavacao: number    // m/day
  assentamento: number // m/day
  reaterro: number     // m³/day (converted to m/day via depth × 0.8)
  escoramento: number  // m²/day (converted to m/day via depth)
  pavimentacao: number // m²/day
}

export interface PlanScheduleConfig {
  startDate: string        // yyyy-MM-dd
  workHoursPerDay: number
  workWeekMode: WorkWeekMode
  targetEndDate?: string   // yyyy-MM-dd — optional target for forecast comparison
  ganttGroupingMode?: 'daily_segment' | 'by_trecho' | 'trecho_activity'  // default 'daily_segment'
  groupByProximity?: boolean  // group nearby trechos for sequential execution
}

export interface TechnicalRule {
  id: string
  name: string                     // e.g. "Solo Rochoso — penalidade"
  condition: string                // display label, e.g. "soilType === 'rocky'"
  productivityMultiplier: number   // e.g. 0.6
  costMultiplier: number           // e.g. 1.4
}

export interface PlanHoliday {
  id?: string              // id da linha no servidor (para atualizar/deletar a mesma data)
  date: string             // yyyy-MM-dd
  description: string
}

export interface GanttCell {
  date: string
  trechoId: string
  teamIndex: number
  metersPlanned: number
  isHydroTest: boolean
}

export interface GanttRow {
  trecho: PlanTrecho
  cells: GanttCell[]
  startDate: string
  endDate: string
  hydroTestDate: string
  durationDays: number     // execution days only (excl. hydro test)
  dailyCostBRL: number
  totalCostBRL: number
  teamIndex: number
}

export interface SCurvePoint {
  dayIndex: number
  date: string
  cumulativePhysicalPct: number
  cumulativeFinancialPct: number
  cumulativeMeters: number
  cumulativeCostBRL: number
}

export interface HistogramPoint {
  dayIndex: number
  date: string
  headcount: number
  equipmentUnits: number
  dailyCostBRL: number
}

export interface AbcItem {
  trecho: PlanTrecho
  totalCostBRL: number
  sharePct: number
  cumulativePct: number
  zone: AbcZone
}

export interface ServiceNote {
  id: string
  date: string
  trechoId: string
  teamId: string
  type: 'instruction' | 'safety' | 'material' | 'inspection' | 'other'
  title: string
  body: string             // plain text — no HTML
  createdAt: string
  createdBy: string
  priority?: 'alta' | 'media' | 'baixa'
  status?: 'pendente' | 'em_andamento' | 'concluida'
  responsavel?: string
}

export interface PlanScenario {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  trechos: PlanTrecho[]
  teams: PlanTeam[]
  productivityTable: PlanProductivityTable
  scheduleConfig: PlanScheduleConfig
  holidays: PlanHoliday[]
}

// ─── RDO (Relatório Diário de Obras) ─────────────────────────────────────────

export type RdoWeatherCondition = 'good' | 'rain' | 'cloudy' | 'storm'
export type RdoTrechoStatus     = 'not_started' | 'in_progress' | 'completed'
export type RdoTab = 'dashboard' | 'historico' | 'sabesp' | 'novo' | 'compizzo' | 'wcr' | 'empreiteiros' | 'previsto-realizado'

export interface RdoWeather {
  morning:      RdoWeatherCondition
  afternoon:    RdoWeatherCondition
  night:        RdoWeatherCondition
  temperatureC: number
}

export interface RdoManpower {
  foremanCount:  number   // Encarregado
  officialCount: number   // Oficial
  helperCount:   number   // Ajudante
  operatorCount: number   // Operador
  employeeNames?: string[] // lista de nomes dos funcionários presentes
}

export interface RdoEquipmentEntry {
  id:       string
  name:     string
  quantity: number
  hours:    number
  equipmentId?: string
  code?:        string
  type?:        string
  operator?:    string
  front?:       string
  notes?:       string
}

export interface RdoServiceEntry {
  id:                string
  description:       string
  quantity:          number
  unit:              string
  planningActivityId?: string
  operationalKey?:    string
  activityStage?:    string
  front?:            string
  measurementWeightPct?: number
  measurementWeightWithoutMaterialPct?: number
  dailyProgressPct?: number
  accumulatedProgressPct?: number
  measurementCriterion?: string
  qualityStatus?: 'pending' | 'approved' | 'rework'
  evidenceRequired?: boolean
  contractItemCode?: string   // Fase 2: vínculo com item do catálogo de medição
}

export interface RdoQualityChecklist {
  ordemServico: boolean
  bandeirola:   boolean
  projeto:      boolean
  obs?:         string
}

export interface RdoMaterialConsumptionEntry {
  id:           string
  material:     string
  quantity:     number
  unit?:        string
  unitCostBRL?: number
  totalCostBRL?: number
  source?:      'almoxarifado' | 'compra_direta' | 'apoio'
  activityStage?: string
  front?:       string
  notes?:       string
  stockItemId?: string
  depositoId?:  string
  availableQtyAtSelection?: number
  isBaseTemplate?: boolean
}

export interface RdoStoppageEntry {
  period: 'morning' | 'afternoon' | 'night'
  reason: string
  start:  string
  end:    string
}

export interface RdoWorkforceRow {
  id:         string
  role:       string
  outsourced: number
  direct:     number
  workerIds?: string[]
  hoursWorked?: number
  activityDescription?: string
  notes?: string
}

export interface RdoTrechoEntry {
  id:                string
  trechoCode:        string
  trechoDescription: string
  plannedMeters:     number
  executedMeters:    number
  status:            RdoTrechoStatus
  source:            'rdo' | 'manual'
  system?:           'agua' | 'esgoto' | 'drenagem' | 'estrutura' | 'pavimentacao' | 'outro'
}

export interface RdoPhoto {
  id:          string
  /** data:image/...;base64 — presente enquanto pendente de upload (offline) ou legado. */
  base64?:     string
  /** Caminho no bucket `rdo-photos` (`<orgId>/<uuid>.jpg`) após upload. Render via signed URL. */
  storagePath?: string
  label:       string
  uploadedAt:  string
}

export interface RdoFinancialEntry {
  id:          string
  date:        string   // yyyy-MM-dd
  category:    string
  description: string
  valueBRL:    number
  type:        'expense' | 'revenue'
}

export interface RDO {
  id:           string
  number:       number   // sequential, auto-assigned
  title?:       string
  /** Rascunho permite salvar o avanço e continuar depois; ausente = finalizado. */
  status?:      'rascunho' | 'finalizado'
  date:         string   // yyyy-MM-dd
  responsible:  string
  weather:      RdoWeather
  manpower:     RdoManpower
  equipment:    RdoEquipmentEntry[]
  services:     RdoServiceEntry[]
  materials?:    RdoMaterialConsumptionEntry[]
  trechos:      RdoTrechoEntry[]
  geolocation:  { lat: string; lng: string } | null
  observations: string
  incidents:    string
  photos:       RdoPhoto[]
  logoId?:      string   // ID of the SavedLogo to use in PDF export

  // ── Contrato / Identificação ─────────────────────────────────────────────────
  local?:                       string
  gerenteContrato?:             string
  tecnicoSeguranca?:            string
  nomeEmpreiteira?:             string
  servicoExecutar?:             string
  ocorrencias?:                 string
  funcionariosDiretos?:         number
  funcionariosIndiretos?:       number
  qtdEquipamentosFerramentas?:  number
  numeroOS?:                    string
  numeroContrato?:              string
  climaManha?:                  string
  climaTarde?:                  string
  climaNoite?:                  string
  localTipo?:                   string
  epiUtilizado?:                boolean
  qualityChecklist?:            RdoQualityChecklist
  stoppages?:                   RdoStoppageEntry[]
  activityHours?:               {
    dayStart?:   string
    dayEnd?:     string
    nightStart?: string
    nightEnd?:   string
  }
  workforceRows?:               RdoWorkforceRow[]

  // ── Template / variantes ─────────────────────────────────────────────────────
  template?:    'padrao' | 'compizzo' | 'wcr'
  compizzo?:    RdoCompizzoData
  wcr?:         RdoWcrData

  siteId?:      string | null  // obra (construction_sites.id) — separação por obra

  createdAt:    string
  updatedAt:    string
}

// ─── RDO WCR (saneamento — água e esgoto) ────────────────────────────────────────
//
// O apontamento chega colado do WhatsApp ou numa planilha, e `utils/apontamentoWcr.ts` o lê.
// Aqui fica só o que é GRAVADO.

/**
 * Uma linha de produção do apontamento WCR.
 *
 * ⚠️ **Por que não reusar `RdoCompizzoProducaoRow`**, que tem forma parecida: lá a unidade é
 * OPCIONAL e precisa ser adivinhada do nome do serviço (`unidadeDaLinha`, `unidadeNoNome`), porque
 * a planilha da Compizzo escreve "Faixa Branca (m)". Aqui a unidade é CONHECIDA — vem da tabela de
 * 13 siglas — e é obrigatória. Compartilhar o tipo convidaria alguém a rodar os utilitários de
 * inferência de m² da Compizzo em cima de metro linear de rede, que é exatamente a classe de erro
 * que já custou caro neste módulo.
 */
export interface RdoWcrProducaoRow {
  /** A sigla canônica: 'PRA', 'LA', 'Caixa UMA'… Ver `SIGLAS_WCR`. */
  sigla:      string
  /**
   * ⚠️ String, e vazia quer dizer NÃO INFORMADO — não zero.
   *
   * No apontamento real a equipe só escreve o que fez; as outras 12 siglas vêm em branco. Guardar
   * `0` ali seria afirmar que não se produziu nada daquele serviço, o que ninguém disse.
   */
  quantidade: string
  /** 'M' para rede (PRA/PRE), 'UN' para o resto. Decide o que pode ser somado com o quê. */
  unidade:    'M' | 'UN'
  /** Item do contrato desta obra, vindo do de-para. Ausente = ainda não mapeado, sem valor. */
  contractServiceId?: string
}

/**
 * UM apontamento — uma mensagem do WhatsApp. O dia pode ter vários (uma por equipe/núcleo), e
 * cada um viaja inteiro: quem confere precisa ver o que cada equipe disse, não só a soma.
 */
export interface RdoWcrApontamento {
  /** Campo `Clima:` do apontamento novo. Alimenta o tempo do RDO e o dia parado. */
  clima?: RdoWeatherCondition
  /** Campo `Horas:` — estimado pelo encarregado. Destrava custo/hora; ausente quando não veio. */
  horas?: number
  equipe?:    string
  nucleo?:    string
  imoveis:    string[]
  producao:   RdoWcrProducaoRow[]
  observacoes?: string
  anoInferido?: boolean
  textoOriginal?: string
  naoEntendidas?: string[]
}

export interface RdoWcrPresente {
  nome: string
  /** Como veio escrito ('líder', 'ajudante', 'encanador'). A contagem canônica vai em `manpower`. */
  funcao?: string
}

/** A "LISTA DE PRESENÇA" de uma equipe — a mensagem que chega separada do apontamento. */
export interface RdoWcrPresenca {
  equipe?: string
  pessoas: RdoWcrPresente[]
  textoOriginal?: string
}

export interface RdoWcrData {
  /**
   * ⚠️ Quando há mais de um apontamento no dia, os campos de cima (`equipe`, `nucleo`, `imoveis`,
   * `producao`) são a SOMA/união — é o que a ponte com o FCP, a listagem e o resumo leem. O detalhe
   * por equipe está em `apontamentos`. Um RDO antigo, de um apontamento só, não tem a lista e
   * continua válido.
   */
  apontamentos?: RdoWcrApontamento[]
  /** Quem estava na obra, por equipe. Também preenche `RDO.manpower`. */
  presencas?: RdoWcrPresenca[]
  /** O encarregado que assina o apontamento ('Gilvan'). Com vários: 'Juan · Gilvan'. */
  equipe?:    string
  /** Ponto dentro da obra ('Boi Malhado'). ⚠️ Não é cidade nem obra. */
  nucleo?:    string
  /** Um por endereço atendido no dia. */
  imoveis:    string[]
  producao:   RdoWcrProducaoRow[]
  observacoes?: string
  /**
   * `true` quando o ano da data foi deduzido (o apontamento escreve só "31/08").
   *
   * Viaja junto para a tela e o PDF poderem mostrar a data cheia — quem confere precisa ver o ano
   * que a máquina escolheu, não descobrir depois.
   */
  anoInferido?: boolean
  /** O texto colado, como veio. É a prova do que a máquina leu. */
  textoOriginal?: string
  /** Linhas que o leitor não reconheceu, preservadas para conferência. */
  naoEntendidas?: string[]
  /** O pior clima entre os apontamentos do dia (chuva > nublado > sol). */
  clima?: RdoWeatherCondition
  /** Soma das horas informadas. Só existe quando alguém informou. */
  horas?: number
}

// ─── RDO Compizzo (Demarcação e Pintura de Piso Industrial) ──────────────────────

export interface RdoCompizzoProducaoRow {
  servico:    string
  quantidade: string
  planningActivityId?:  string   // atividade-mestre que ESTA linha avança (várias atividades por RDO)
  quantidadePrevista?:  number   // meta da atividade (plannedQuantity), exibida inline (previsto × realizado por linha)
  unidade?:             string   // 'm²' | 'm' | 'un'… (opcional; não depende do texto do serviço)
  contractServiceId?:   string   // vínculo com um serviço do contrato da obra (ObraContratoServico.id) → alimenta a medição
}

/** Serviço adicional (livre) marcado em "Serviços Executados no Dia". */
export interface RdoCompizzoServicoExtra {
  nome:        string
  quantidade?: string   // opcional
  unidade?:    string   // opcional: m, m², un, kg, L, h...
}

export interface RdoCompizzoMaterialRow {
  material:      string
  quantidade:    string
  stockItemId?:  string        // item do Almoxarifado (dá baixa no estoque ao finalizar)
  depositoId?:   string        // frente/obra de onde saiu
  custoUnitario?: number       // R$/un no momento da seleção (para custo do dia)
}

export interface RdoCompizzoServicos {
  limpezaArea:        boolean
  isolamentoArea:     boolean
  preparacaoPiso:     boolean
  tintaVermelha:      boolean
  tintaAmarela:       boolean
  faixaBranca:        boolean
  faixaAmarela:       boolean
  faixaVermelha:      boolean
  vagasPCD:           boolean
  retoques:           boolean
  limpezaFinal:       boolean
}

export interface RdoCompizzoOcorrencias {
  semOcorrencias:           boolean
  chuva:                    boolean
  areaNaoLiberada:          boolean
  interferenciaTerceiros:   boolean
  faltaEnergia:             boolean
  equipamentoDefeito:       boolean
  outros:                   boolean
}

/** Os motivos de parada, sem o `semOcorrencias` — que é ausência de motivo, não um motivo. */
export type MotivoDeParada = Exclude<keyof RdoCompizzoOcorrencias, 'semOcorrencias'>

/**
 * QUANTAS HORAS cada ocorrência custou.
 *
 * ─── POR QUE ESTE CAMPO EXISTE ────────────────────────────────────────────────
 * A lista de ocorrências acima já era a taxonomia certa: ela bate quase 1:1 com as causas de não
 * cumprimento medidas em 105 obras brasileiras pelo NORIE/UFRGS (mão de obra, materiais,
 * equipamentos, projeto, planejamento, cliente, clima). O que faltava era a **magnitude** — sabia-se
 * que aconteceu, nunca quanto custou.
 *
 * Sem isso, o RDO responde *"teve ocorrência"*. Com isso, responde *"perdemos 14 h esta semana
 * esperando liberação de área do cliente"* — que é uma frase que muda decisão, e que sustenta
 * pleito de prazo.
 *
 * ⚠️ Ausente ≠ zero. Uma ocorrência marcada sem hora preenchida quer dizer "aconteceu, não
 * mediram"; zero quer dizer "aconteceu e não parou ninguém". A tela e os indicadores tratam os dois
 * casos separados — somar ausente como zero faria a obra parecer mais eficiente do que é.
 */
export type HorasPorOcorrencia = Partial<Record<MotivoDeParada, number>>

export interface RdoCompizzoData {
  obra:                  string
  siteId?:               string | null  // obra da Torre (construction_sites.id) escolhida no dropdown
  numeroContrato?:       string         // snapshot do contrato (PDF/histórico estáveis mesmo se o plano mudar)
  bacOrcamentoBRL?:      number         // faturamento previsto / BAC da obra (snapshot)
  servicoContratado?:    string         // serviço do Plano de Execução (snapshot)
  precoM2?:              number         // preço/m² do Plano (snapshot)
  periodoInicio?:        string         // yyyy-MM-dd (snapshot do período do plano)
  periodoFim?:           string         // yyyy-MM-dd
  diaObra:               string
  condicaoClimatica:     'sol' | 'nublado' | 'chuva' | 'outros'
  condicaoClimaticaOutros?: string
  servicos:              RdoCompizzoServicos
  servicosExtra?:        RdoCompizzoServicoExtra[]
  descricaoServicos:     string
  producao:              RdoCompizzoProducaoRow[]
  horasTrabalhadas?:     number   // HH total do dia (nº colab × jornada) p/ RUP real = HH ÷ m²
  planningActivityId?:   string   // vínculo com uma atividade do Planejamento (avança o % dela pelo m² do dia)
  materiais:             RdoCompizzoMaterialRow[]
  ocorrencias:           RdoCompizzoOcorrencias
  /** Horas perdidas por motivo. Ver `HorasPorOcorrencia` — ausente não é zero. */
  horasOcorrencia?:      HorasPorOcorrencia
  observacoes:           string
  planejamentoProximoDia: string
  responsavelNome:       string
  responsavelData:       string
}

// ─── Qualidade / FVS (Ficha de Verificação de Serviço) ──────────────────────

export type FvsConformity = 'conforme' | 'nao_conforme' | 'reinspecao_ok' | null
export type FvsTab        = 'dashboard' | 'novo' | 'nao-conformidade' | 'historico'
export type FvsItemGroup  = 'verificacao_solda' | 'controle_parametros'

export interface FvsItem {
  id:          string
  number:      number          // 1..9
  group:       FvsItemGroup
  description: string          // ex.: "Condições do Local"
  criteria:    string          // critério de aceitação (texto livre)
  conformity:  FvsConformity
  date:        string | null   // yyyy-MM-dd da verificação do item
}

export interface FvsProblemAction {
  id:          string
  itemNumber:  number
  description: string
  action:      string
  photos?:     string[]
}

export interface FVS {
  id:                string
  number:            number    // sequencial, auto-assigned
  documentCode:      string    // ex.: "FOR-FVS-02"
  revision:          string    // ex.: "00"
  identificationNo:  string    // "Nº Identificação FVS"
  contractNo:        string    // ex.: "00.954/24"
  date:              string    // yyyy-MM-dd
  items:             FvsItem[] // 9 itens fixos do formulário
  problems:          FvsProblemAction[]
  ncRequired:        boolean
  ncNumber:          string    // "Nº Não Conformidade"
  // Fechamento da FVS
  responsibleLeader: string    // Líder Responsável
  weldTrackingNo:    string    // N° de rastreio da solda
  welderSignature:   string    // Assinatura soldador (nome)
  qualitySignature:  string    // Assinatura Resp. Qualidade (nome)
  logoId?:           string    // ID da SavedLogo do companySettingsStore (PDF export)
  fotos?:            string[]  // base64 das fotos anexadas (TODO: migrar para Supabase Storage)
  siteId?:           string | null  // obra — separação por obra
  // Metadados
  createdAt: string
  updatedAt: string
}

export type QualityNonConformityStatus = 'aberta' | 'em_tratamento' | 'concluida' | 'ineficaz'

export interface QualityNonConformity {
  id: string
  number: number
  documentCode: string
  revision: string
  openedBy: string
  company: string
  engineerResponsible: string
  location: string
  ncNumber: string
  date: string
  lvNumber: string
  local: string
  description: string
  evidencePhotos: string[]
  unmetRequirement: string
  immediateAction: string
  deadline: string
  actionResponsible: string
  correctiveAction: string
  correctiveActionDate: string
  effectivenessResponsible: string
  status: QualityNonConformityStatus
  effectivenessDate: string
  siteId?: string | null  // obra — separação por obra
  createdAt: string
  updatedAt: string
}

// ─── Quantitativos e Orçamento ────────────────────────────────────────────────

export type CostBaseSource = 'sinapi' | 'seinfra' | 'custom' | 'manual'
export type QuantTab = 'composicao' | 'personalizado' | 'resumo' | 'banco' | 'historico'

export interface OrcamentoItem {
  id:          string
  code:        string          // SINAPI/SEINFRA code or user-defined
  description: string
  unit:        string
  quantity:    number
  unitCost:    number          // from base or overridden
  bdi:         number          // BDI % applied to this item
  totalCost:   number          // quantity × unitCost × (1 + bdi/100)
  category:    string
  source:      CostBaseSource
  notes?:      string
}

export interface OrcamentoBudget {
  id:            string
  name:          string
  description?:  string
  costBase:      CostBaseSource
  items:         OrcamentoItem[]
  bdiGlobal:     number        // global BDI fallback
  totalBRL:      number
  referenceDate: string        // yyyy-MM-dd
  createdAt:     string
  updatedAt:     string
}

export interface CustomBaseEntry {
  id:          string
  code:        string
  description: string
  unit:        string
  unitCost:    number
  category:    string
  source:      string          // "Importado PDF" | "Importado Excel" | "Manual"
}

// ─── BIM 3D/4D/5D ─────────────────────────────────────────────────────────────
//
// O módulo foi removido em 31/08/2026. Os tipos (`BimSegment`, `BimLayer`, `BimProject`,
// `BimColorMode`, `BimTab`) saíram junto — nada mais os usa.
//
// ⚠️ As TABELAS `bim_projects` e `bim_segments` continuam no Supabase, com RLS e histórico
// exportável: remover a tela não apaga dado de ninguém. Elas só param de receber escrita. Por isso
// os rótulos delas seguem em `src/lib/auditoria.ts` — o histórico precisa saber traduzi-las.

// ─── LPS / Lean Construction ──────────────────────────────────────────────────

export type LpsCncCategory = 'weather' | 'external' | 'equipment' | 'labor' | 'material' | 'design' | 'predecessor' | 'planning' | 'other'
export type LpsReadyStatus = 'green' | 'yellow' | 'red'
export type LpsTab = 'reuniao' | 'semaforo' | 'lookahead' | 'ppc' | 'takt' | 'restricoes' | 'analytics' | 'timeline-restricoes' | 'alertas' | 'mao-de-obra' | 'integracoes'

export type LpsRestrictionCategory =
  | 'projeto_engenharia'
  | 'materiais'
  | 'equipamentos'
  | 'mao_de_obra'
  | 'externo'
  | 'outros'

export type LpsRestrictionStatus = 'identificada' | 'em_resolucao' | 'resolvida'

export interface LpsRestriction {
  id: string
  tema: string
  categoria: LpsRestrictionCategory
  descricao: string
  impacto?: string
  responsavel?: string
  prazoRemocao?: string       // 'YYYY-MM-DD'
  nucleo?: string
  obraProjeto?: string
  tipoServico?: string
  dataParaCumprir?: string    // 'YYYY-MM-DD'
  porque?: string
  acoesNecessarias?: string
  tags: string[]
  observacoes?: string
  status: LpsRestrictionStatus
  createdAt: string
  resolvedAt?: string
  linkedActivityIds?: string[]
  linkedMasterActivityIds?: string[]
  alertSentAt?: string
  alertMessage?: string
}

export interface LpsActivity {
  id: string
  week: string              // ISO week e.g. '2025-W12'
  trechoCode: string
  description: string
  planned: boolean
  committed?: boolean
  commitmentNote?: string
  completed: boolean
  readyStatus: LpsReadyStatus
  cncCategory?: LpsCncCategory
  cncDescription?: string
  responsibleTeam?: string
  plannedMeters?: number
  executedMeters?: number
  sourceExecucaoId?: string   // vínculo com uma atividade do Planejamento de Execução (integração)
  sourceMasterId?: string     // vínculo com uma atividade derivada do Planejamento Mestre (Médio Prazo → LPS)
  /**
   * Vínculo com o Fluxo de Caixa Projetado: `planoId:cidadeId:semana`.
   * É por ele que o executado lançado aqui volta para o PLANEJADO × REALIZADO do FCP.
   */
  sourceFcpId?: string
  obraId?: string | null      // obra (construction_sites.id) — PPC por obra
}

export interface LpsWeeklyPPC {
  week: string
  planned: number
  completed: number
  ppc: number               // completed / planned * 100
}

export interface TaktZone {
  id: string
  code: string
  lengthM: number
  taktDays: number
  actualDays?: number
  startDate?: string
}

// ─── Mapa Interativo ──────────────────────────────────────────────────────────

export type MapNodeType    = 'junction' | 'endpoint' | 'structure'
export type MapNetworkType = 'sewer' | 'water' | 'drainage' | 'civil' | 'generic'
export type MapTool        = 'idle' | 'addNode' | 'connect' | 'deleteNode' | 'deleteSegment' | 'measure' | 'structure'

export interface MapNode {
  id: string
  lat: number
  lng: number
  label?: string
  nodeType: MapNodeType
  elevation?: number
}

export interface MapSegment {
  id: string
  fromNodeId: string
  toNodeId: string
  networkType: MapNetworkType
  diameter?: number
  material?: string
  depth?: number
  label?: string
  color?: string
}

export interface MapLayer {
  id: MapNetworkType
  name: string
  color: string
  visible: boolean
}

// ─── Simulação de Atrasos (Gestão 360) ───────────────────────────────────────

export interface TrechoDelay {
  trechoCode: string    // identifies the trecho by its code
  delayDays: number     // extra days to delay the trecho start
}

// ─── Rede 360 ─────────────────────────────────────────────────────────────────

export type Rede360Tab = 'home' | 'outages' | 'planning' | 'risk'
export type NetworkAssetType = 'circuit' | 'pipe' | 'pv' | 'structure' | 'device' | 'vegetation' | 'hardening'
export type NetworkAssetStatus = 'operational' | 'degraded' | 'critical' | 'offline' | 'maintenance'
export type Rede360ServiceOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type ServiceOrderPriority = 'low' | 'medium' | 'high' | 'emergency'
export type OutageStatus = 'active' | 'monitoring' | 'resolved'

export interface NetworkAsset {
  id: string
  type: NetworkAssetType
  networkType: MapNetworkType
  name: string
  code: string
  lat: number
  lng: number
  status: NetworkAssetStatus
  riskLevel: RiskLevel
  installationDate?: string
  lastInspection?: string
  nextInspectionDue?: string
  customerCount?: number
  lengthM?: number
  diameter?: number
  material?: string
  sensorReadings?: { parameter: string; value: number; unit: string; timestamp: string }[]
  flowLMin?: number
  pressureBar?: number
  lossPercent?: number
  waterQuality?: 'good' | 'warning' | 'critical'
  notes?: string
}

export interface Rede360ServiceOrder {
  id: string
  code: string
  assetId: string | null
  type: string
  priority: ServiceOrderPriority
  status: Rede360ServiceOrderStatus
  description: string
  assignedTo?: string
  scheduledDate?: string
  completedDate?: string
  estimatedHours?: number
  createdAt: string
}

export interface Outage {
  id: string
  affectedAssetIds: string[]
  type: string
  status: OutageStatus
  startTime: string
  estimatedRestoreTime?: string
  resolvedTime?: string
  affectedCustomers?: number
  cause?: string
  notes?: string
}

export type GridAssetTab = 'circuit' | 'device' | 'weather' | 'customer' | 'structure' | 'vegetation' | 'hardening'

export interface CircuitAsset {
  id: string
  circuitId: string
  circuitName: string
  circuitClass: 'Distribution' | 'Transmission' | 'Subtransmission'
  riskClassification: string
  riskLevel: RiskLevel
  customerCount: number
  protectedDeviceCount: number
  installedStructureCount: number
  lineSegmentCount: number
  districtName: string
  isInAreaOfInterest: boolean
  networkType: MapNetworkType
  lat: number
  lng: number
  polyline?: [number, number][]
}

export interface DeviceAsset {
  id: string
  deviceId: string
  deviceType: string
  manufacturer?: string
  model?: string
  status: NetworkAssetStatus
  riskLevel: RiskLevel
  lat: number
  lng: number
  circuitId?: string
  installedDate?: string
  lastReading?: string
}

export interface NWSWeatherStation {
  id: string
  stationId: string
  stationName: string
  lat: number
  lng: number
  currentTempC?: number
  windKmh?: number
  precipitationMm?: number
  alerts?: string[]
  lastUpdated: string
}

export interface CustomerRecord {
  id: string
  customerId: string
  address: string
  serviceType: 'residential' | 'commercial' | 'industrial'
  circuitId?: string
  status: 'active' | 'inactive'
}

export interface StructureAsset {
  id: string
  structureId: string
  structureType: string
  condition: 'good' | 'fair' | 'poor' | 'critical'
  inspectionDate?: string
  circuitId?: string
  lat: number
  lng: number
  riskLevel: RiskLevel
}

export interface VegetationPoint {
  id: string
  pointId: string
  address?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'scheduled' | 'completed'
  lastTrimDate?: string
  circuitId?: string
  lat: number
  lng: number
}

export interface HardeningPoint {
  id: string
  pointId: string
  hardeningType: string
  status: 'planned' | 'in_progress' | 'completed'
  completionDate?: string
  circuitId?: string
  lat: number
  lng: number
  riskLevel: RiskLevel
}

// ── Planejamento Mestre ──────────────────────────────────────────────────────

export type PlanejamentoMestreTab = 'macro' | 'derivacao' | 'whatif' | 'integrada' | 'semanal' | 'restricoes' | 'operacional' | 'medicao-planejamento' | 'execucao'

export interface ProgramacaoDiaria {
  previsto:  number
  realizado: number
}
export type MasterActivityStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'

export interface MasterActivity {
  id: string
  wbsCode: string
  name: string
  parentId: string | null
  level: number
  plannedStart: string
  plannedEnd: string
  trendStart: string
  trendEnd: string
  durationDays: number
  percentComplete: number
  status: MasterActivityStatus
  isMilestone: boolean
  responsibleTeam?: string
  linkedTrechoCodes?: string[]
  predecessors?: string[]
  weight?: number
  notes?: string
  networkType?: 'agua' | 'esgoto' | 'civil' | 'manutencao' | 'ambiental' | 'outro' | 'geral'
  serviceCategory?: 'LA' | 'LE' | 'intra' | 'interligacao' | 'reposicao' | 'na_rede' | 'OS' | 'pavimentacao' | 'recomposicao'
  diameterMm?: number
  // Weekly programming extended fields
  nucleo?:             string
  local?:              string
  comprimento?:        number
  quantidadeLigacoes?: number
  pesoMeta1000?:       number
  coordenador?:        string
  unidade?:            string
  nucleusId?: string
  financialWeightPct?: number
  plannedProgressPct?: number
  physicalProgressPct?: number
  financialProgressPct?: number
  estimatedHH?: number
  equipmentDemand?: Partial<ResourceDemand>
  workPackageId?: string
  baselineStart?: string
  baselineEnd?: string
  area?: string
  nPreco?: string
  sourceImportId?: string
  sourceFileName?: string
  sourceImportType?: 'mpp' | 'xml' | 'excel'
  criticalPath?: boolean
  totalSlack?: string | number
  resources?: string[]
  rdoLinkedIds?: string[]
  rdoExecutedQty?: number
  rdoPlannedQty?: number
  plannedQuantity?: number
  executedQuantity?: number
  lastRdoDate?: string
  operationalKey?: string
  sourceExecucaoId?: string   // vínculo com uma atividade do Planejamento de Execução (integração)
  obraId?: string | null      // obra (construction_sites.id) — Planejamento ↔ Torre. null/undefined = sem obra (aparece em "Todas")
  monthlyPhysicalPct?: Record<string, number>  // distribuição de % físico por mês 'YYYY-MM' (matriz Gestão à Vista, payload jsonb)
}

export interface MasterBaseline {
  id: string
  name: string
  createdAt: string
  activities: MasterActivity[]
}

export interface LookaheadDerivedActivity {
  id: string
  masterActivityId: string
  weekIso: string
  name: string
  responsible: string
  status: 'planned' | 'ready' | 'blocked' | 'completed'
  linkedRestrictionIds?: string[]
  notes?: string
  percentComplete?: number
  networkType?: 'agua' | 'esgoto' | 'civil' | 'manutencao' | 'ambiental' | 'outro' | 'geral'
}

export interface WhatIfAdjustment {
  activityId: string
  deltaStartDays: number
  deltaDurationDays: number
}

export interface WhatIfScenario {
  id: string
  name: string
  adjustments: WhatIfAdjustment[]
  createdAt: string
}

// ── LPS Enhancements (Gestão de Restrições e Recursos) ──────────────────────

export interface LpsAlert {
  id: string
  restrictionId: string
  recipientRole: string
  message: string
  sentAt: string
  acknowledged: boolean
  acknowledgedAt?: string
}

export interface StaffingDimension {
  id: string
  activityName: string
  requiredTeams: number
  requiredWorkers: number
  role: string
  availableFromMaoDeObra: number
  gap: number
  status: 'ok' | 'deficit' | 'surplus'
}

export type IntegrationSourceType = 'suprimentos' | 'mao_de_obra' | 'rdo' | 'qualidade' | 'equipamentos' | 'medicao'

export interface IntegrationStatus {
  source: IntegrationSourceType
  label: string
  lastSyncAt: string | null
  itemsLinked: number
  restrictionsAutoClearable: number
  status: 'connected' | 'partial' | 'disconnected'
}

// ── Operação e Campo ─────────────────────────────────────────────────────────

export type OperacaoCampoTab = 'calendario' | 'dashboards'

export interface FieldCalendarActivity {
  id: string
  name: string
  masterActivityId?: string
  trechoCode?: string
  responsible: string
}

export interface FieldCalendarDay {
  date: string
  activityId: string
  plannedQty: number
  plannedUnit: string
  actualQty: number | null
  notes?: string
}

export interface WeeklyPpcResult {
  weekIso: string
  totalPlanned: number
  totalCompleted: number
  ppc: number
}

export interface NotableServiceCurve {
  id: string
  serviceName: string
  unit: string
  dataPoints: { date: string; planned: number; actual: number }[]
}

export interface TrendPoint {
  date: string
  plannedCumulativePct: number
  actualCumulativePct: number
}

// ── EVM (Earned Value Management) ──────────────────────────────────────────

export type EvmTab = 'dashboard' | 'medicao' | 'plano-contas' | 'work-packages' | 'indices'
/**
 * Abas do módulo Financeiro (página EVM). Cada painel legado é sub-aba de uma destas
 * (ver `evm/index.tsx`). `EvmTab`/`FinanceiroTab` seguem existindo para o `activeTab`
 * interno dos stores — não confundir.
 *
 * ⚠️ `medicao` é o BOLETIM DO CONTRATO (quanto foi executado × quanto vale).
 * `avanco-ponderado` é a matriz de peso do EVM, que até 09/09/2026 se chamava
 * "Medição Ponderada" — nome que a fazia parecer a mesma coisa e não é.
 */
export type FinanceiroEvmTab =
  | 'visao-geral'
  | 'por-obra'
  | 'resultados'
  | 'medicao'
  | 'pagamentos'
  | 'documentos'
  | 'avanco-ponderado'
  | 'distribuicao'
  | 'configuracao'

export type CostPillar = 'material' | 'equipamento' | 'mao_de_obra' | 'impostos_indiretos'

export type ServiceCategory = 'LA' | 'LE' | 'intra' | 'interligacao' | 'reposicao' | 'na_rede' | 'OS' | 'pavimentacao' | 'recomposicao'

export type FinanceiroCostPillar = 'material' | 'mao_de_obra' | 'equipamentos' | 'subcontrato' | 'overhead'

export interface ContratoFinanceiro {
  id: string
  numero: string
  descricao: string
  contratante: string
  dataInicio: string
  dataFim: string
  bac: number
}

export interface ItemCustoFinanceiro {
  id: string
  descricao: string
  workPackageRef?: string
  custoUnitario: number
  quantidade: number
  total: number
}

export interface PlanoContasFinanceiro {
  nucleoId: string
  material: ItemCustoFinanceiro[]
  maoDeObra: ItemCustoFinanceiro[]
  equipamentos: ItemCustoFinanceiro[]
  subcontrato: ItemCustoFinanceiro[]
  overhead: ItemCustoFinanceiro[]
  totalOrcado: number
}

export interface FinanceiroWorkPackage {
  id: string
  nucleoId: string
  wbsRef: string
  descricao: string
  bacWP: number
  pesoFinanceiro: number
  pesoDuracao: number
  pesoEconomico: number
  pesoEspecifico: number
  scoreComposto: number
  progFisico: number
  evReconhecido: number
  activityIds?: string[]
}

export interface EvmPeriodoFinanceiro {
  nucleoId: string
  periodo: string
  pv: number
  ev: number
  ac: number
  cpi: number
  spi: number
  cv: number
  sv: number
  eacFormula: number
  eacOtimista: number
  eacPessimista: number
  vac: number
  tcpi: number
  ppcSemana: number[]
  ppcMedio: number
}

export interface EntradaFinanceira {
  id: string
  nucleoId: string
  tipo: 'medicao' | 'antecipacao' | 'reajuste' | 'outro'
  medicaoRef?: string
  descricao: string
  valor: number
  data: string
  status: 'previsto' | 'emitido' | 'aprovado' | 'recebido'
  notaFiscal?: string
  observacoes?: string
}

export interface SaidaFinanceira {
  id: string
  nucleoId: string
  categoria: FinanceiroCostPillar
  workPackageRef?: string
  descricao: string
  fornecedor: string
  valor: number
  data: string
  notaFiscal?: string
  status: 'previsto' | 'pago' | 'pendente'
}

export interface NucleoFinanceiro {
  id: string
  codigo: string
  nome: string
  descricao: string
  contratoId: string
  bacAlocado: number
  bacPercentual: number
  planoContas: PlanoContasFinanceiro
  workPackages: FinanceiroWorkPackage[]
  entradas: EntradaFinanceira[]
  saidas: SaidaFinanceira[]
  evm: EvmPeriodoFinanceiro[]
  ativo: boolean
  cor: string
}

export interface MeasurementTemplate {
  id: string
  nome: string
  tipologia: 'saneamento' | 'edificacao'
  pesos: Array<{
    descricao: string
    pesoFinanceiro: number
    pesoDuracao: number
    pesoEconomico: number
    pesoEspecifico: number
  }>
}

export interface WeightedMeasurement {
  id: string
  activityId: string
  activityName: string
  financialWeight: number
  durationWeight: number
  economicWeight: number
  specificWeight: number
  compositeScore: number
}

export interface CostAccountEntry {
  id: string
  activityId: string
  pillar: CostPillar
  description: string
  unitCostBRL: number
  quantity: number
  totalCostBRL: number
  obraId?: string   // vínculo opcional com a obra (para orçado×real por obra)
}

export interface WorkPackage {
  id: string
  code: string
  name: string
  description: string
  costAccounts: CostAccountEntry[]
  measurements: WeightedMeasurement[]
  totalBudgetBRL: number
  createdAt: string
  isTemplate: boolean
}

export interface EvmMetrics {
  BAC: number
  PV: number
  EV: number
  AC: number
  CPI: number
  SPI: number
  CV: number
  SV: number
  EAC: number
  ETC: number
  VAC: number
  TCPI: number
  costBreakdown: CostBreakdown
  eacScenarios: EacScenarios
  pillarDeviations: PillarDeviation[]
  stockAlerts: StockAlert[]
  /**
   * ⚠️ `'sem-dado'` existe porque a ausência não é um estado de saúde.
   *
   * Antes, a base zerada nascia `'blue'`, e `'blue'` significa "Obra Eficiente — IDP > 1 e IDC > 1".
   * Resultado: uma obra sem orçamento e sem apontamento aparecia com ícone de check e o rótulo de
   * melhor cenário, com a legenda logo abaixo dizendo `CPI = 0.00`. O card desmentia a si mesmo.
   */
  healthStatus: 'sem-dado' | 'blue' | 'yellow' | 'red'
}

export interface CostBreakdown {
  material: number
  equipamento: number
  mao_de_obra: number
  impostos_indiretos: number
}

export interface EacScenarios {
  optimistic: number
  trend: number
  pessimistic: number
}

export interface PillarDeviation {
  pillar: CostPillar
  label: string
  budgeted: number
  actual: number
  deviation: number
  deviationPct: number
}

export interface StockAlert {
  itemId: string
  description: string
  qtdComprada: number
  qtdInstalada: number
  qtdImobilizada: number
  custoImobilizado: number
}

export interface SCurveMultiPoint {
  date: string
  plannedFinancialPct: number
  actualPhysicalPct: number
  earnedValuePct: number
  actualCostPct: number
}

// ─── Medição — Consolidado Executado × Projetado × Cadastro ─────────────────

export type MedicaoTab = 'consolidado' | 'materiais' | 'resumo' | 'dashboard'

export type SegmentStatus = 'EXECUTADO' | 'PENDENTE' | 'CADASTRO'
export type SegmentTipo   = 'ESGOTO' | 'AGUA'

export interface ConsolidatedSegment {
  id:            string
  nucleo:        string
  tipo:          SegmentTipo
  rua:           string
  ns:            string
  pvMont:        string
  pvJus:         string
  dnMm:          number | null
  extM:          number
  material:      string
  ctMont:        number | null
  ctJus:         number | null
  declPerMil:    number | null
  status:        SegmentStatus
  dataExec:      string | null   // dd/MM/yyyy or null
  networkLayer:  string
  analise:       string
}

export interface NucleoSummary {
  nucleo:    string
  tipo:      SegmentTipo
  trTotal:   number
  trObra:    number
  trCad:     number
  trExec:    number
  trPend:    number
  kmObra:    number
  kmExec:    number
  kmPend:    number
  kmCad:     number
  pctExec:   number
}

// ─── Financeiro ─────────────────────────────────────────────────────────────

export type FinanceiroTab = 'visao-geral' | 'entradas' | 'saidas' | 'fluxo-caixa'

/** Imposto/retenção de nota fiscal (Plano de Contas, pré-configurado e editável). */
export interface ImpostoNF {
  id:         string
  nome:       string
  aliquota:   string   // texto livre — ISS é faixa ("2% a 5%")
  observacao: string
  createdAt:  string
}

// ── Manejo Financeiro (inbox de contratos/obrigações) ──

export type ManejoContratoStatus = 'ativo' | 'encerrado' | 'desobrigado'
export type ManejoMotivoSinalizacao = 'periodo-encerrado' | 'sem-movimentacao' | 'saldo-residual'

export interface ManejoContrato {
  id:                   string
  titulo:               string
  inicioContrato:       string        // yyyy-MM-dd
  fimPeriodoExecucao:   string | null // yyyy-MM-dd
  valorTotalObrigado:   number
  valorRestante:        number
  status:               ManejoContratoStatus
  sinalizadoPeloModelo: boolean
  motivoSinalizacao:    ManejoMotivoSinalizacao | null
  anexos:               { id: string; nome: string }[]
  desobrigadoEm:        string | null
  createdAt:            string
}

// ── Manejo Orçamento (autorizações por categoria) ──

export type OrcamentoCategoria = 'fundo' | 'interesse-especial' | 'elemento-orcamento' | 'autorizacao-custo'

export interface ManejoOrcamentoItem {
  id:           string
  categoria:    OrcamentoCategoria
  codigo:       string
  descricao:    string
  valorTotal:   number
  valorAlocado: number
  vinculos:     string[]  // ids de itens de outras categorias
  createdAt:    string
}

export type EntradaCategoria = 'medicao' | 'adiantamento' | 'reajuste' | 'outro'
export type SaidaCategoria   = 'materiais' | 'mao_de_obra' | 'equipamentos' | 'subempreiteiros' | 'administrativo' | 'outro'

export interface FinanceiroEntry {
  id:          string
  tipo:        'entrada' | 'saida'
  descricao:   string
  valor:       number
  data:        string   // yyyy-MM-dd
  categoria:   EntradaCategoria | SaidaCategoria
  referencia?: string   // nº NF, nº medição, etc.
  obraId?:     string   // vínculo com a obra (ConstructionSite) do Torre de Controle
  notas?:      string
  sourceRdoId?: string  // origem: RDO que gerou este lançamento (idempotência RDO→Financeiro)
  sourceTituloId?: string // origem: título cuja baixa gerou este lançamento (idempotência + rastreio)
  sourceNotaId?: string   // origem: nota fiscal lançada. Mesmo papel do acima, outra porta.
  createdAt:   string

  // ── Controle de Caixa ──────────────────────────────────────────────────────
  // Campos OPCIONAIS, e é o que os torna baratos: `financeiro_entries` guarda a entry inteira num
  // `payload jsonb`, então campo novo aqui **não precisa de migração**. Lançamento antigo continua
  // válido sem nenhum deles.
  /** Quem pediu o gasto. É lista porque a planilha tem `DAMIÃO/WELLINGTON` — duas pessoas. */
  solicitantes?: string[]
  /** Fim do período, quando a despesa cobre vários dias (`01 A 10/07/2026` na planilha real). */
  dataFim?: string
  /** Já conferido — a coluna "Conferido" da planilha do cliente. */
  conferido?: boolean
  conferidoPor?: string
  conferidoEm?: string
  /** Por onde entrou. `planilha` é a via principal; `manual` é correção pontual na tela. */
  origem?: 'planilha' | 'manual' | 'horas-extras'
  /**
   * Identidade da linha na planilha, para reimportar sem duplicar.
   * É dela que sai o `id` determinístico — e é o `id` que faz o `addEntry` (upsert) atualizar em
   * vez de criar outro lançamento quando o mesmo arquivo é enviado de novo.
   */
  chavePlanilha?: string
  /** Horas extras: de quem é o lançamento. O cargo é informativo — o valor NÃO sai dele. */
  funcionarioNome?: string
  cargo?: string
  /**
   * Segundo nível da categoria — hoje só Mão de Obra tem: `horas_extras` | `salario` | `diaria`.
   *
   * ⚠️ Não é `origem`. `origem` diz POR ONDE o lançamento entrou (planilha, tela, grade de HE);
   * isto diz O QUE ELE É. Uma hora extra digitada à mão tem `origem: 'manual'` e
   * `subcategoria: 'horas_extras'` — e é a subcategoria que o relatório agrupa. A DRE continua
   * olhando só `categoria`; o segundo nível é leitura, não contabilidade.
   */
  subcategoria?: SubcategoriaSaida
  /** Para quem foi pago — separado de quem pediu (`solicitantes`). Coluna FORNECEDOR da planilha. */
  fornecedor?: string
}

export type SubcategoriaSaida = 'horas_extras' | 'salario' | 'diaria'
// ⚠️ A lista com rótulos vive em `financeiro/lib/financeiroCalc.ts` (`SUBCATEGORIAS_POR_CATEGORIA`):
// este arquivo é só de tipos, e um VALOR aqui quebra quem o importa fora do bundle (os testes).

// ─── DRE simplificada (auto-calculada a partir das entradas/saídas) ───────────
/** Linhas da DRE nas quais cada categoria de lançamento é somada. */
export type DreLineKey =
  | 'receita_bruta'   // entradas (medição, adiantamento, reajuste…)
  | 'deducao'         // impostos/retenções (entradas classificadas como dedução)
  | 'custo'           // custos diretos da obra (materiais, MO, equipamentos, subempreiteiros)
  | 'despesa_adm'     // despesas administrativas
  | 'despesa_outra'   // outras despesas operacionais

export type FinanceiroCategoria = EntradaCategoria | SaidaCategoria

/**
 * Chave de mapeamento da DRE. Desambigua 'outro' (que existe em entrada E saída)
 * em `entrada_outro`/`saida_outro` — as demais categorias são únicas por tipo.
 */
export type DreMappableKey =
  | 'medicao' | 'adiantamento' | 'reajuste' | 'entrada_outro'
  | 'materiais' | 'mao_de_obra' | 'equipamentos' | 'subempreiteiros' | 'administrativo' | 'saida_outro'

/** Config da DRE: alíquota de impostos sobre a receita + overrides de mapeamento. */
export interface DreConfig {
  /** % de impostos/deduções aplicado sobre a Receita Bruta quando não há dedução lançada. */
  deducaoPct: number
  /** Overrides chave→linha (só o que difere do default). */
  mapping: Partial<Record<DreMappableKey, DreLineKey>>
}

// ─── Distribuição de orçamento (por obra) ────────────────────────────────────
export interface DistribuicaoLinha {
  id:               string
  beneficiarioTipo: 'funcionario' | 'terceiro'
  beneficiarioId?:  string
  beneficiarioNome: string
  tarefa?:          string
  valor:            number
}

export interface Distribuicao {
  id:         string
  obraId?:    string
  titulo:     string
  orcamento:  number
  linhas:     DistribuicaoLinha[]
  createdAt:  string
  updatedAt:  string
}

// ─── Pagamentos e Cobranças (contas a pagar / a receber) ─────────────────────
export type TituloTipo   = 'pagar' | 'receber'
/** Status persistido. "vencido" NÃO é persistido — é derivado (pendente + vencimento < hoje). */
export type TituloStatus = 'pendente' | 'pago' | 'cancelado'

/** Anexo (foto/arquivo) de um boleto no bucket `boletos`. */
export interface TituloAnexo {
  path: string   // caminho no bucket (${orgId}/${uuid}.ext)
  nome: string   // nome original do arquivo (exibição)
}

export interface FinanceiroTitulo {
  id:            string
  tipo:          TituloTipo
  descricao:     string
  parceiro:      string          // fornecedor (pagar) ou cliente (receber)
  valor:         number
  vencimento:    string          // yyyy-MM-dd
  emissao?:      string          // yyyy-MM-dd
  obraId?:       string          // vínculo com a obra (ConstructionSite)
  numeroDoc?:    string          // nº NF / boleto / medição
  categoria?:    EntradaCategoria | SaidaCategoria  // categoria do lançamento gerado na baixa
  parcelaNum?:   number          // parcela x
  parcelaDe?:    number          // de n
  status:        TituloStatus
  dataPagamento?: string         // yyyy-MM-dd (preenchido na baixa)
  entryId?:      string          // FinanceiroEntry gerado na baixa (para estorno/rastreio)
  // Item do rateio que originou esta cobrança. É a chave de negócio REAL da cobrança de
  // condomínio, e o que o índice único do banco indexa. Guardar só (rateio, unidade) não
  // serve: duas unidades podem ter o mesmo nome de propósito — "Bloco A" com dois
  // hidrômetros são duas cobranças legítimas, e o índice as trataria como duplicata.
  rateioItemId?: string
  notas?:        string
  // ─── Boleto (aba "Boletos"). Um boleto = N títulos-parcela agrupados por `boletoId`.
  //     COMPARTILHADOS pelo carnê: boletoId e anexos. POR PARCELA: codigoBoleto e alertaDias.
  //     Todos vivem no payload jsonb de financeiro_titulos — sem migração de tabela. ───
  boletoId?:     string          // agrupa as parcelas de um mesmo boleto
  codigoBoleto?: string          // linha digitável DESTA parcela (só dígitos; formatada na exibição)
  anexos?:       TituloAnexo[]   // fotos do boleto (bucket `boletos`)
  alertaDias?:   number          // aviso: dias de antecedência do vencimento desta parcela
  createdAt:     string
}

// ─── Rateio de Consumo (adaptação do submeter-billback: água/energia por unidade) ──
export type RateioTipo   = 'agua' | 'energia'
/** Base do rateio: leitura/consumo, área (m²) ou proporção (%). O cálculo é o mesmo:
 *  valorRateado_i = valorTotalFatura × base_i / Σ base. */
export type RateioBase   = 'leitura' | 'area' | 'proporcao'
export type RateioStatus = 'processando' | 'revisar' | 'aprovado'

export interface RateioItem {
  id:       string
  unidade:  string       // nome da unidade/consumidor (ex.: bloco, obra, inquilino)
  obraId?:  string       // vínculo opcional com a obra (ConstructionSite)
  base:     number       // valor da base (leitura/consumo, m², ou %)
}

export interface RateioConsumo {
  id:               string
  periodo:          string   // yyyy-MM
  tipo:             RateioTipo
  descricao?:       string
  fornecedor?:      string   // concessionária / medidor de origem
  valorTotalFatura: number
  base:             RateioBase
  itens:            RateioItem[]
  status:           RateioStatus
  cobrancaTituloIds?: string[]   // títulos a receber gerados no Financeiro (idempotência/undo)
  /** Quantas vezes as cobranças já foram desfeitas. Entra na semente do id dos títulos: dentro
   *  da mesma geração dois dispositivos produzem o MESMO id (não duplica); ao desfazer e gerar
   *  de novo, a geração muda e os ids também — necessário porque o título é apagado por
   *  soft-delete e a policy de update proíbe reviver uma linha com `deleted_at` preenchido. */
  cobrancaGeracao?: number
  createdAt:        string
}

// ─── Nota Fiscal (aba "Nota Fiscal" do Financeiro) ──────────────────────────
//
// Uma nota fiscal NAO e um titulo, e por isso nao mora em `financeiro_titulos`:
// cupom nao tem vencimento, ja nasce pago, e o `PagamentosPanel` lista todos os
// titulos sem filtro — centenas de cupons de restaurante entrariam la e nos KPIs
// de "a vencer" e "vencidas". Tabela propria, `financeiro_notas`.
//
// ⚠️ A IDENTIDADE E A CHAVE DE ACESSO. O `id` e `seededId(orgId,'nota-fiscal',chave)`,
// entao a propria PK impede duplicar: a mesma foto importada em dois celulares
// chega ao mesmo id e o segundo upsert regrava a mesma linha. Nao ha indice unico
// separado — seria um segundo jeito de receber um 23505 sobre o mesmo fato.

export type NotaStatus = 'arquivada' | 'lancada' | 'cancelada'

/**
 * De onde veio o campo. Vai para a TELA, campo a campo — e essa e a regra que
 * separa o que o sistema garante do que alguem afirmou.
 *
 *  `chave`    o QR, conferido pelo digito verificador. Certeza.
 *  `ocr`      leitura da foto. Proposta, sempre confirmada por gente.
 *  `manual`   digitado.
 *  `sugerida` veio do historico do mesmo CNPJ, e a tela diz de quantas notas.
 */
export type OrigemDoCampo = 'chave' | 'ocr' | 'manual' | 'sugerida'

export interface ItemDaNota {
  descricao: string
  valor:     number
  origem:    OrigemDoCampo
}

export interface NotaFiscal {
  /** `seededId(orgId, 'nota-fiscal', chaveAcesso)` — a identidade E a chave. */
  id:            string
  /** 44 digitos, com o DV ja conferido. Sem isso a nota nao entra. */
  chaveAcesso:   string

  // ── Derivados da chave ────────────────────────────────────────────────────
  // Redundantes de proposito: filtrar e agrupar sem reparsear 44 digitos a cada
  // render, e sem depender de o parser estar carregado.
  cnpjEmitente:  string   // 14 digitos
  modelo:        string   // '65' NFC-e · '55' NF-e
  numero:        string
  serie:         string
  uf:            string
  /** `yyyy-MM`, garantido pela chave. A data COMPLETA nao esta nela. */
  competencia:   string

  emitente?:     string   // do OCR ou digitado; casa com `Supplier.cnpj` quando existe
  /** `yyyy-MM-dd`. Em conflito com a competencia da chave, a CHAVE manda. */
  dataEmissao?:  string

  // ── O que a pessoa confirmou ──────────────────────────────────────────────
  /** Nunca gravado sem confirmacao humana, qualquer que seja a origem. */
  valor:         number
  valorOrigem:   OrigemDoCampo
  /** O trecho cru que o OCR devolveu — a prova do que a maquina viu. */
  valorLidoBruto?: string
  tributosBRL?:  number
  itens?:        ItemDaNota[]

  // ── Classificacao ─────────────────────────────────────────────────────────
  /** Uma das 6 oficiais. E ela que alimenta a DRE quando a nota e lancada. */
  categoria:     SaidaCategoria
  /** Etiqueta fina e livre, normalizada. So para o painel; NUNCA entra na DRE. */
  etiqueta?:     string
  /**
   * ⚠️ Quando um HUMANO confirmou a categoria.
   *
   * So notas com este campo alimentam a sugestao por CNPJ. Sem essa regra, uma
   * sugestao aceita por inercia vira evidencia de si mesma e um erro calcifica.
   */
  categoriaConfirmadaEm?: string

  obraId?:       string
  notas?:        string
  /** Caminho no bucket `notas-fiscais`. So o caminho; a exibicao usa signed URL. */
  fotoPath?:     string
  fotoNome?:     string

  status:        NotaStatus
  /** O lancamento gerado. Vazio = arquivada, nunca lancada. */
  entryId?:      string
  lancadaEm?:    string
  lancadaPor?:   string

  createdAt:     string
  createdBy?:    string
}

// Economia / ROI

export type EconomySourceModule =
  | 'suprimentos'
  | 'lps'
  | 'planejamento'
  | 'rdo'
  | 'relatorio360'
  | 'equipamentos'
  | 'medicao'
  | 'evm'
  | 'manual'

export type EconomyEventCategory =
  | 'material_waste'
  | 'production_stoppage'
  | 'restriction_removed'
  | 'equipment_idle'
  | 'management_hours'
  | 'measurement_discrepancy'
  | 'schedule_alert'
  | 'cost_deviation'

export type EconomyEventStatus = 'detected' | 'validated' | 'dismissed' | 'reported'
export type EconomyReportStatus = 'draft' | 'sent' | 'archived'
export type EconomyConfidence = 'low' | 'medium' | 'high'

// ─── Linha de base MEDIDA (o período-espelho) ────────────────────────────────
//
// As contas vivem em `src/features/economia/utils/linhaDeBaseMedida.ts`, que também re-exporta
// estas formas. Elas moram aqui porque `EconomyBaseline.medida` as guarda.

/** Um mês do período-espelho, com o que o cliente já tem no controle dele. */
export interface MesDaLinhaDeBase {
  /** `yyyy-MM`. */
  periodo: string
  /** Quanto foi executado no mês, na unidade do contrato. */
  quantidadeExecutada: number
  /** Quanto custou — o que saiu, pelo controle do cliente. */
  custoBRL: number
  /** Homens-hora trabalhados no mês. Opcional: nem todo cliente registra. */
  homensHora?: number
}

/**
 * O que torna (ou não) os dois períodos comparáveis.
 *
 * ⚠️ **Isto é declarado ANTES de ver o resultado, e travado.** É a regra que impede o ajuste de
 * virar a alavanca que produz o número desejado — e é a única razão de alguém de fora acreditar.
 */
export interface AjusteAcordado {
  /** A unidade do que se compara: `m²`, `m`, `un`. Comparar m com m² não é comparação. */
  unidade: string
  /** Quais serviços entram. Vazio = todos, e a tela diz que isso é uma escolha. */
  servicos: string[]
  /**
   * Correção de preço entre os dois períodos, em fração (0,08 = 8%).
   * Sem ela, inflação vira "economia" — ou o contrário.
   */
  inflacao: number
  /** O que mudou fora da plataforma no meio do caminho. Texto livre, obrigatório. */
  ressalvas: string
  /** Quem acordou, e quando. Depois disto, mudar o ajuste é um evento, não uma edição. */
  acordadoPor: string
  acordadoEm: string
}

export interface LinhaDeBaseMedida {
  id: string
  obraId: string
  obraNome: string
  meses: MesDaLinhaDeBase[]
  ajuste: AjusteAcordado
  /** De onde veio o dado. Some no papel se ninguém escrever. */
  fonte: string
  criadoEm: string
}

export interface EconomyBaseline {
  id: string
  projectId: string | null
  projectName: string
  /**
   * Alguém confirmou estes números, ou eles nasceram do padrão?
   *
   * A linha de base é criada sozinha na primeira abertura do módulo, preenchida com 80
   * trabalhadores, R$ 160/pessoa-dia e R$ 300 mil/mês de material — números de exemplo. Como quase
   * todo valor em reais do módulo é `dado real × constante × campo da linha de base`, dobrar o
   * custo-dia dobra a "economia". Ausente ou `false` = ninguém confirmou, e a tela precisa dizer
   * isso. Vai no `payload` jsonb, sem migração.
   */
  confirmadaPeloUsuario?: boolean
  capturedAt: string
  period: string
  ppcPercent: number
  materialDeviationPercent: number
  manualReportHoursPerWeek: number
  stoppagesLastQuarter: number
  workersCount: number
  costPerPersonDayBRL: number
  materialMonthlyBudgetBRL: number
  targetMaterialDeviationPercent: number
  platformMonthlyFeeBRL: number
  managerHourlyCostBRL: number
  equipmentDailyCostBRL: number
  manualMeasurementHoursPerSub?: number
  automatedMeasurementHoursPerSub?: number
  baselineMeasurementErrorRatePercent?: number
  costOfCapitalMonthlyPercent?: number
  notes?: string
  /**
   * A linha de base MEDIDA — o periodo-espelho da mesma obra, antes da plataforma.
   *
   * Tudo o que esta acima nesta interface e premissa: alguem digitou um percentual e o motor
   * multiplicou por uma constante. Isto aqui e outra coisa: sao meses medidos, com quantidade
   * executada, custo incorrido e homens-hora, importados do controle que o cliente ja tinha.
   *
   * Fica dentro do `payload` JSONB de `economy_baselines` — sem coluna nova, sem migracao.
   */
  medida?: LinhaDeBaseMedida
  createdAt: string
  updatedAt: string
}

export interface EconomyValuationRule {
  id: string
  category: EconomyEventCategory
  label: string
  formula: string
  assumptions: Record<string, number>
  enabled: boolean
  updatedAt: string
}

export interface EconomyEventEvidence {
  label: string
  value?: string
  url?: string
}

export interface EconomyEvent {
  id: string
  stableKey: string
  sourceModule: EconomySourceModule
  sourceId: string
  category: EconomyEventCategory
  projectId: string | null
  projectName: string
  date: string
  period: string
  title: string
  description: string
  impactBRL: number
  /**
   * Quanto o cálculo estimou, antes de qualquer edição manual.
   *
   * `impactBRL` é um campo editável na tela: dá para digitar qualquer número e validar. Sem
   * guardar o estimado, não havia como a tela separar o que a plataforma calculou do que alguém
   * digitou — e os dois somavam no mesmo total, apresentado como "economia comprovada".
   * Recalculado a cada varredura. Vai no `payload` jsonb, sem migração.
   */
  impactEstimadoBRL?: number
  formula: string
  assumptions: Record<string, number>
  confidence: EconomyConfidence
  status: EconomyEventStatus
  evidence: EconomyEventEvidence[]
  createdAt: string
  updatedAt: string
  validatedAt?: string
  reportedAt?: string
}

export interface EconomyReport {
  id: string
  period: string
  projectId: string | null
  projectName: string
  baselineId: string | null
  eventIds: string[]
  detectedEvents: number
  avoidedLossBRL: number
  platformFeeBRL: number
  roiPercent: number
  ppcBefore: number
  ppcAfter: number
  materialDeviationBefore: number
  materialDeviationAfter: number
  materialSavingsBRL: number
  status: EconomyReportStatus
  generatedAt: string
  sentAt?: string
  notes?: string
}
