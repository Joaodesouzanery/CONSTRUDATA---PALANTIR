/**
 * RdoCompizzoPanel — variante de RDO no formato do "Diário de Obra" da Compizzo
 * (demarcação e pintura de piso industrial). Replica os campos do documento e
 * reaproveita campos do Novo RDO (mão de obra, equipamentos, fotos). Salva no
 * mesmo store de RDO (template 'compizzo') e exporta PDF idêntico ao documento.
 */
import { toast } from 'sonner'
import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardList, Plus, Trash2, Printer, Save, FileText, Sun, Cloud,
  CloudRain, Wrench, Camera, X, ScanText, CheckCircle2, Users, Building2, PackageSearch, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { useRdoStore, AVISO_SEM_PERMISSAO } from '@/store/rdoStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { custoDiaWorker, matchWorkerByName } from '@/features/mao-de-obra/utils/custoMaoObra'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { FASES_PADRAO } from '../data/fasesPadrao'
import type { FaseDaObra } from '@/types'
import { idDaFasePadrao } from '../data/idDaFase'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { usePlanoExecucaoStore } from '@/store/planoExecucaoStore'
import { faturamento } from '@/features/planejamento/utils/planoExecucao'
import { useStoreSync } from '@/lib/useStoreSync'
import { margemPorServico } from '../utils/margemPorServico'
import { MetasDaObraSection } from '@/features/torre-de-controle/components/MetasDaObraSection'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { compressImageToBlob } from '@/lib/imageCompression'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { hojeLocalISO, cn } from '@/lib/utils'
import { uploadRdoPhoto, blobToDataUrl, leanPhotosForPersist, removeRdoPhoto } from '../utils/rdoPhotoStorage'
import { RdoPhotoImg } from './RdoPhotoImg'
import { parseCompizzoText } from '../utils/parseCompizzoText'
import { abrirJanelaRelatorio, imprimirRelatorioRdos } from '../utils/rdosReportExport'
import { precoEfetivo, medidoAutoPorServico, saldoQtd, qtdMedida } from '@/features/torre-de-controle/utils/obraMedicao'
import { obraBacFromSite } from '@/features/torre-de-controle/utils/obraBudget'
import { ehVerba, ROTULO_UNIDADE, classificarUnidade } from '@/lib/unidadesMedida'
import { ehLinhaDeArea, unidadeDaLinha, OPCAO_AVULSO, classificacaoDaLinha, linhaVazia, linhasSemDestino } from '../utils/producaoCompizzo'
import type { HorasPorOcorrencia, MotivoDeParada } from '@/types'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'
import type {
  RdoCompizzoData, RdoCompizzoServicos, RdoCompizzoOcorrencias,
  RdoCompizzoProducaoRow, RdoCompizzoMaterialRow, RdoCompizzoServicoExtra,
  RdoEquipmentEntry, RdoPhoto, RdoWeatherCondition, RdoMaterialConsumptionEntry,
} from '@/types'

function stripEquipId(e: RdoEquipmentEntry): Omit<RdoEquipmentEntry, 'id'> {
  return {
    name: e.name, quantity: e.quantity, hours: e.hours, equipmentId: e.equipmentId,
    code: e.code, type: e.type, operator: e.operator, front: e.front, notes: e.notes,
  }
}

const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60 placeholder:text-[#525252]'
const labelCls = 'block text-[#a3a3a3] text-xs mb-1'


const OCORRENCIA_ITEMS: Array<[keyof RdoCompizzoOcorrencias, string]> = [
  ['semOcorrencias', 'Sem ocorrências'],
  ['chuva', 'Chuva'],
  ['areaNaoLiberada', 'Área não liberada'],
  ['interferenciaTerceiros', 'Interferência de terceiros'],
  ['faltaEnergia', 'Falta de energia'],
  ['equipamentoDefeito', 'Equipamento com defeito'],
  ['outros', 'Outros'],
]

/**
 * Com o que um RDO novo abre.
 *
 * ⚠️ Eram SEIS linhas com nome ("Pintura Vermelha (m²)", "Faixa Branca (m)"…) — o modelo de antes
 * das Fases. Todas nasciam avulsas e, por isso, **nenhuma alimentava a meta da obra**: o caminho
 * padrão produzia exatamente as linhas que a meta não enxerga. Agora abre com UMA linha por
 * classificar, e as oito fases da obra estão no alto do `<select>`.
 *
 * ⚠️ Nada foi apagado: quem quiser lançar "Pintura Vermelha" escolhe "serviço avulso" e digita,
 * como sempre — e o RDO antigo reabre exatamente como foi salvo (ver `classificacaoDaLinha`).
 */
/**
 * O gabarito das colunas da grade de fases.
 *
 * ⚠️ UMA constante para o cabeçalho e para a linha. Estavam duplicados literalmente; duplicados,
 * divergem na primeira vez que alguém mexe num — e aí o cabeçalho passa a rotular a coluna errada,
 * sem nenhum erro na tela.
 */
const COLUNAS_DA_FASE = 'minmax(0,1.6fr) 84px 64px 84px 32px'

const PRODUCAO_INICIAL: RdoCompizzoProducaoRow[] = [
  { servico: '', quantidade: '', classificacao: 'nao-escolhida' },
]

const DEFAULT_MATERIAIS: RdoCompizzoMaterialRow[] = [
  { material: 'Tinta Amarela', quantidade: '' },
  { material: 'Tinta Vermelha', quantidade: '' },
  { material: 'Solvente', quantidade: '' },
  { material: 'Fita Crepe', quantidade: '' },
]

const emptyServicos = (): RdoCompizzoServicos => ({
  limpezaArea: false, isolamentoArea: false, preparacaoPiso: false,
  tintaVermelha: false, tintaAmarela: false, faixaBranca: false,
  faixaAmarela: false, faixaVermelha: false, vagasPCD: false,
  retoques: false, limpezaFinal: false,
})

const emptyOcorrencias = (): RdoCompizzoOcorrencias => ({
  semOcorrencias: false, chuva: false, areaNaoLiberada: false,
  interferenciaTerceiros: false, faltaEnergia: false,
  equipamentoDefeito: false, outros: false,
})

const climaToWeather = (c: RdoCompizzoData['condicaoClimatica']): RdoWeatherCondition =>
  c === 'chuva' ? 'rain' : c === 'nublado' ? 'cloudy' : 'good'

export function CompizzoWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight text-[#1f6fd1] ${className}`} style={{ fontFamily: 'Arial, sans-serif' }}>
      compizzo
    </span>
  )
}

export function RdoCompizzoPanel() {
  const addRdo = useRdoStore((s) => s.addRdo)
  const updateRdo = useRdoStore((s) => s.updateRdo)
  const setActiveTab = useRdoStore((s) => s.setActiveTab)
  const setEditingRdoId = useRdoStore((s) => s.setEditingRdoId)
  // Para o saldo por serviço: o medido acumulado sai dos RDOs finalizados da obra.
  const todosRdos = useRdoStore((s) => s.rdos)
  // `hojeLocalISO()`, não `toISOString()`: o UTC no Brasil já é AMANHÃ depois das 21h — e é
  // justamente no fim da tarde que o encarregado preenche o RDO. Com a data em UTC, o RDO salvo
  // carimbava o dia seguinte e o painel de alertas acusaria "sem RDO hoje" numa obra que apontou.
  const today = hojeLocalISO()

  // Funcionários e equipes cadastrados no módulo Mão de Obra (sincroniza ao abrir).
  useStoreSync(useMaoDeObraStore)
  const workers = useMaoDeObraStore((s) => s.workers)
  const crews = useMaoDeObraStore((s) => s.crews)
  const cltSettings = useMaoDeObraStore((s) => s.cltSettings)
  // Suprimentos: estoque + reservas/requisições/previsão (filtrados pela obra do RDO).
  const estoqueItens = useSuprimentosStore((s) => s.estoqueItens)
  const reservas = useSuprimentosStore((s) => s.reservas)
  const requisitions = useSuprimentosStore((s) => s.requisitions)
  const forecasts = useSuprimentosStore((s) => s.forecasts)
  // Atividades do Planejamento (para vincular a produção do dia e avançar o %).
  const masterActivities = usePlanejamentoMestreStore((s) => s.activities)
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)
  const addItemEstoque = useSuprimentosStore((s) => s.addItemEstoque)
  // Obras da Torre (fonte da obra do RDO) + plano de execução (contrato/meta).
  const sites = useTorreStore((s) => s.sites)
  const setActiveObra = useActiveObraStore((s) => s.setActiveObra)
  const planos = usePlanoExecucaoStore((s) => s.planos)
  const [crewPick, setCrewPick] = useState('')
  const [materialPick, setMaterialPick] = useState('')

  // RDO em edição (definido pela tela de Histórico). Lido uma vez na montagem.
  const editing = useMemo(() => {
    const st = useRdoStore.getState()
    return st.editingRdoId ? st.rdos.find((r) => r.id === st.editingRdoId) ?? null : null
  }, [])
  const c0 = editing?.compizzo

  // Obra do RDO (Torre). Prefill: siteId do RDO editado → obra ativa global → match por nome (legado).
  const [obraSiteId, setObraSiteId] = useState<string | null>(() =>
    editing?.siteId ?? c0?.siteId
      ?? useActiveObraStore.getState().activeObraId
      ?? (c0?.obra ? (useTorreStore.getState().sites.find((s) => s.name === c0.obra)?.id ?? null) : null),
  )
  const selectedSite = useMemo(() => (obraSiteId ? sites.find((s) => s.id === obraSiteId) ?? null : null), [sites, obraSiteId])

  /**
   * As fases que esta obra oferece.
   *
   * ⚠️ Obra sem catálogo cai nas oito padrão — mas com `id` derivado do NOME, não aleatório. Se
   * fosse `crypto.randomUUID()`, cada abertura da tela geraria ids novos e o `faseId` gravado ontem
   * não casaria com o de hoje: a meta da Torre veria zero para sempre, sem erro nenhum na tela.
   */
  const fasesDaObra = useMemo<FaseDaObra[]>(() => {
    const doCadastro = selectedSite?.fases?.filter((f) => f.ativa)
    if (doCadastro && doCadastro.length > 0) return [...doCadastro].sort((a, b) => a.ordem - b.ordem)
    return FASES_PADRAO.map((f, i) => ({
      id: idDaFasePadrao(f.nome), nome: f.nome, unidade: f.unidade,
      ordem: i + 1, ativa: true, pesoPct: f.pesoPct,
    }))
  }, [selectedSite])

  // Plano de execução da obra (ativo, senão o mais recente) → serviço/preço/período/BAC.
  const activePlano = useMemo(() => {
    const list = planos.filter((p) => (p.siteId ?? null) === obraSiteId)
    return list.find((p) => p.status === 'ativo')
      ?? [...list].sort((a, b) => (b.periodoInicio || '').localeCompare(a.periodoInicio || ''))[0]
      ?? null
  }, [planos, obraSiteId])
  const numeroContrato    = selectedSite?.numeroContrato ?? ''
  const servicoContratado = activePlano?.servico ?? ''
  // A OBRA é a fonte da verdade do preço; o Plano de Execução continua podendo sobrescrever,
  // porque é ele que conhece o recorte do período. Antes o preço só existia no plano — obra sem
  // plano cadastrado ficava sem preço nenhum no RDO.
  const precoM2           = activePlano?.precoM2 || selectedSite?.precoM2 || 0
  const periodoInicio     = activePlano?.periodoInicio ?? ''
  const periodoFim        = activePlano?.periodoFim ?? ''
  // O BAC segue a mesma precedência da Carteira e do Plano de Contas (`obraBacFromSite`:
  // contrato → linha 'Total' → soma → orçamento do cadastro). Antes esta tela tinha uma cadeia
  // própria que pulava o contrato e ia direto no `orcamentoBRL` — a terceira resposta diferente
  // para "quanto vale a obra" dentro do mesmo sistema.
  const bacObra           = (activePlano ? faturamento(activePlano) : 0)
    || obraBacFromSite(selectedSite)
    || (selectedSite ? (selectedSite.totalArea || 0) * (selectedSite.precoM2 || 0) : 0)
  const hasContratoMeta   = Boolean(numeroContrato || servicoContratado || precoM2 || bacObra || periodoInicio)

  /**
   * As atividades do Planejamento desta obra.
   *
   * ⚠️ **O único consumidor agora é `buildProducaoFinal`** — a coluna "Atividade" saiu da tela em
   * 23/09/2026 e o vínculo passou a ser criado sozinho, pelo NOME da fase, no salvar.
   *
   * ⚠️ Não remover achando que virou código morto: é por esta lista que `buildProducaoFinal`
   * reaproveita a atividade existente. Sem ela, cada salvar criaria uma atividade NOVA com o mesmo
   * nome, e o Previsto × Realizado da obra se repartiria entre dezenas de "Pintura".
   */
  const obraAtividades = useMemo(
    () => masterActivities.filter((a) => a.level >= 1 && !a.isMilestone && (!obraSiteId || (a.obraId ?? null) === obraSiteId)),
    [masterActivities, obraSiteId],
  )
  // Sugestões de "Responsável": funcionários cadastrados (nome) + gestor/dono da obra (Torre).
  const responsavelOptions = useMemo(
    () => [...new Set(
      [...workers.map((w) => w.name), selectedSite?.manager, selectedSite?.owner]
        .filter((x): x is string => Boolean(x && x.trim())),
    )],
    [workers, selectedSite],
  )
  // Estoque geral (siteId null) + estoque da obra selecionada. Só oculta itens de OUTRA obra.
  const estoqueDaObra = useMemo(
    () => (obraSiteId ? estoqueItens.filter((it) => (it.siteId ?? null) === null || it.siteId === obraSiteId) : estoqueItens),
    [estoqueItens, obraSiteId],
  )
  const reservasDaObra = useMemo(
    () => (obraSiteId ? reservas.filter((r) => (r.siteId ?? estoqueItens.find((i) => i.id === r.itemId)?.siteId ?? null) === obraSiteId) : []),
    [reservas, estoqueItens, obraSiteId],
  )
  const requisicoesDaObra = useMemo(
    () => (obraSiteId ? requisitions.filter((r) => (r.siteId ?? null) === obraSiteId || (selectedSite != null && (r.projectRef === selectedSite.code || r.projectRef === selectedSite.name))) : []),
    [requisitions, obraSiteId, selectedSite],
  )
  const previsoesDaObra = useMemo(
    () => (obraSiteId ? forecasts.filter((f) => (f.siteId ?? null) === obraSiteId) : []),
    [forecasts, obraSiteId],
  )

  const [obra, setObra] = useState(c0?.obra ?? '')

  function handleObraChange(id: string) {
    const next = id || null
    setObraSiteId(next)
    setActiveObra(next)                       // alinha o seletor global (Planejamento/Suprimentos seguem a mesma obra)
    const site = next ? sites.find((s) => s.id === next) : null
    if (site) setObra(site.name)
    // Remove as linhas de contrato auto-carregadas VAZIAS da obra anterior (evita órfãs que
    // poluiriam a nova obra/Planejamento); mantém as preenchidas e as não-contratuais. O
    // efeito abaixo recarrega os serviços da nova obra.
    setProducao((rows) => rows.filter((r) => !r.contractServiceId || (r.quantidade ?? '').trim() !== ''))
  }
  const [data, setData] = useState(editing?.date ?? today)
  const [diaObra, setDiaObra] = useState(c0?.diaObra ?? '')
  const [diaObraTouched, setDiaObraTouched] = useState(Boolean(c0?.diaObra))
  const [responsavel, setResponsavel] = useState(editing?.responsible ?? '')
  const [condicao, setCondicao] = useState<RdoCompizzoData['condicaoClimatica']>(c0?.condicaoClimatica ?? 'sol')
  const [condicaoOutros, setCondicaoOutros] = useState(c0?.condicaoClimaticaOutros ?? '')
  const [employeeNames, setEmployeeNames] = useState<string[]>(editing?.manpower.employeeNames ?? [])
  const [employeeInput, setEmployeeInput] = useState('')
  const [workerPick, setWorkerPick] = useState('')
  const [servicos] = useState<RdoCompizzoServicos>(c0?.servicos ?? emptyServicos())
  // Legado: o RDO antigo tem estes campos e o PDF/detalhe ainda os lê. A tela não os EDITA
  // mais (viraram fases), mas o valor que veio é preservado ao salvar — editar um RDO de
  // agosto não pode apagar o que foi apontado nele.
  const [servicosExtra] = useState<RdoCompizzoServicoExtra[]>(c0?.servicosExtra ?? [])
  const [descricao, setDescricao] = useState(c0?.descricaoServicos ?? '')
  const [producao, setProducao] = useState<RdoCompizzoProducaoRow[]>(() => {
    const base = c0?.producao ?? PRODUCAO_INICIAL
    // Retrocompat: o vínculo único legado (cz.planningActivityId) somava TODAS as linhas em m²
    // naquela atividade. Migramos vinculando a atividade a TODAS as linhas em m² (preserva a soma);
    // se não houver linha em m², vincula a 1ª linha.
    if (c0?.planningActivityId && !base.some((r) => r.planningActivityId)) {
      const temM2 = base.some((r) => ehLinhaDeArea(r))   // pela UNIDADE, não pelo nome
      if (temM2) return base.map((r) => (/m²|m2/i.test(r.servico) ? { ...r, planningActivityId: c0.planningActivityId } : r))
      return base.map((r, i) => (i === 0 ? { ...r, planningActivityId: c0.planningActivityId } : r))
    }
    return base
  })

  /** A próxima fase da ordem que ainda não foi apontada hoje — o atalho de um toque. */
  /**
   * As linhas com quantidade digitada e sem nada a que atribuí-la.
   *
   * ⚠️ Marcadas em vermelho ANTES do salvar. Bloquear no clique sem ter marcado antes faz a pessoa
   * procurar o erro numa tela de trinta campos.
   */
  const faltaClassificar = useMemo(() => linhasSemDestino(producao), [producao])

  /** A meta nasce recolhida: quem lança o RDO está preenchendo o dia, não editando a meta do mês. */
  const [verMeta, setVerMeta] = useState(false)

  const faseNaoApontada = useMemo(
    () => fasesDaObra.find((f) => !producao.some((r) => r.faseId === f.id)),
    [fasesDaObra, producao],
  )
  const [horasTrabalhadas, setHorasTrabalhadas] = useState<string>(c0?.horasTrabalhadas != null ? String(c0.horasTrabalhadas) : '')
  const [horasIndiretas, setHorasIndiretas] = useState<string>(c0?.indiretoDoDia?.horas != null ? String(c0.indiretoDoDia.horas) : '')
  const [motivoIndireto, setMotivoIndireto] = useState<string>(c0?.indiretoDoDia?.motivo ?? '')
  const updateProducao = (i: number, patch: Partial<RdoCompizzoProducaoRow>) =>
    setProducao((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const [materiais, setMateriais] = useState<RdoCompizzoMaterialRow[]>(c0?.materiais ?? DEFAULT_MATERIAIS)
  const [equipment, setEquipment] = useState<Array<Omit<RdoEquipmentEntry, 'id'>>>(editing?.equipment.map(stripEquipId) ?? [])
  const [ocorrencias, setOcorrencias] = useState<RdoCompizzoOcorrencias>(c0?.ocorrencias ?? emptyOcorrencias())
  const [horasOcorrencia, setHorasOcorrencia] = useState<HorasPorOcorrencia>(c0?.horasOcorrencia ?? {})
  const [observacoes, setObservacoes] = useState(c0?.observacoes ?? editing?.observations ?? '')
  const [planejamento, setPlanejamento] = useState(c0?.planejamentoProximoDia ?? '')
  const [respNome, setRespNome] = useState(c0?.responsavelNome ?? '')
  const [respData, setRespData] = useState(c0?.responsavelData ?? today)
  const [photos, setPhotos] = useState<RdoPhoto[]>(editing?.photos ?? [])

  // "Dia da Obra" automático = dias corridos desde o início da obra (Torre) até a data do RDO
  // (início = dia 1). Preenche sozinho até o usuário editar (diaObraTouched).
  const diaObraSugerido = useMemo(() => {
    if (!selectedSite?.startDate || !data) return null
    const start = new Date(selectedSite.startDate + 'T00:00:00').getTime()
    const cur = new Date(data + 'T00:00:00').getTime()
    if (Number.isNaN(start) || Number.isNaN(cur)) return null
    return Math.max(1, Math.floor((cur - start) / 86400000) + 1)
  }, [selectedSite?.startDate, data])
  useEffect(() => {
    if (!diaObraTouched && diaObraSugerido != null) setDiaObra(String(diaObraSugerido))
  }, [diaObraSugerido, diaObraTouched])

  // Contrato da obra (Torre): auto-carrega os serviços do contrato como linhas de Produção do Dia
  // (ADITIVO — somadas às existentes, nunca substitui), com vínculo contractServiceId → o que for
  // produzido aqui alimenta o Controle de Medição da obra.
  useEffect(() => {
    const services = selectedSite?.contrato?.services ?? []
    if (services.length === 0) return
    setProducao((rows) => {
      const have = new Set(rows.map((r) => r.contractServiceId).filter(Boolean))
      const add = services
        .filter((svc) => !have.has(svc.id))
        .map((svc) => ({
          // meta undefined de propósito: buildProducaoFinal só cria/vincula atividade de
          // Planejamento quando há qtd do dia (>0) — evita poluir o Planejamento com um
          // serviço do contrato que não foi trabalhado neste RDO.
          servico: svc.descricao, quantidade: '', unidade: svc.unidade,
          quantidadePrevista: undefined, contractServiceId: svc.id,
          // Explícito: linha do contrato é serviço avulso, não fase. Não depender da derivação.
          classificacao: 'avulso' as const,
        }))
      return add.length ? [...rows, ...add] : rows
    })
  }, [selectedSite?.contrato])

  const [showText, setShowText] = useState(false)
  const [textValue, setTextValue] = useState('')
  const [saved, setSaved] = useState(false)
  // Id do RDO já criado nesta sessão de edição — evita que re-salvar (rascunho)
  // crie um RDO novo a cada clique. Começa com o RDO em edição, se houver.
  const [savedId, setSavedId] = useState<string | null>(editing?.id ?? null)

  // Sai do modo edição ao desmontar (reabrir a aba volta a criar novo).
  useEffect(() => () => setEditingRdoId(null), [setEditingRdoId])

  function addEmployee(name: string) {
    const v = name.trim()
    if (v) setEmployeeNames((p) => (p.includes(v) ? p : [...p, v]))
  }

  function buildCompizzo(prod: RdoCompizzoProducaoRow[] = producao): RdoCompizzoData {
    return {
      obra: selectedSite?.name ?? obra,
      siteId: obraSiteId,
      numeroContrato: numeroContrato || undefined,
      bacOrcamentoBRL: bacObra || undefined,
      servicoContratado: servicoContratado || undefined,
      precoM2: precoM2 || undefined,
      periodoInicio: periodoInicio || undefined,
      periodoFim: periodoFim || undefined,
      diaObra, condicaoClimatica: condicao, condicaoClimaticaOutros: condicaoOutros || undefined,
      servicos, servicosExtra: servicosExtra.filter((s) => s.nome.trim()),
      // ⚠️ O descarte é AQUI, no payload, e não em `buildProducaoFinal`: `handleSave` devolve o
      // resultado daquela para a tela (`setProducao`), então descartar lá faria as linhas sumirem
      // sob os dedos de quem clicou em "Salvar Rascunho".
      descricaoServicos: descricao, producao: prod.filter((r) => !linhaVazia(r)),
      horasTrabalhadas: parseLocaleNumber(horasTrabalhadas) || undefined,
      indiretoDoDia: parseLocaleNumber(horasIndiretas) > 0
        ? { horas: parseLocaleNumber(horasIndiretas), motivo: motivoIndireto.trim() || undefined }
        : undefined,
      materiais, ocorrencias, horasOcorrencia,
      observacoes, planejamentoProximoDia: planejamento,
      responsavelNome: respNome || responsavel, responsavelData: respData,
    }
  }

  // Materiais viram entradas de consumo no payload. Itens do estoque (stockItemId) dão baixa via
  // trigger `sync_rdo_to_estoque`; manuais (compra direta) são CONTABILIZADOS, sem baixa em estoque.
  function buildMaterials(): RdoMaterialConsumptionEntry[] {
    return materiais
      .filter((m) => m.material.trim() && parseLocaleNumber(m.quantidade) > 0)
      .map((m) => {
        const qty = parseLocaleNumber(m.quantidade)
        const unit = m.custoUnitario ?? 0
        const fromStock = Boolean(m.stockItemId)
        return {
          id: crypto.randomUUID(),
          material: m.material,
          quantity: qty,
          source: (fromStock ? 'almoxarifado' : 'compra_direta') as RdoMaterialConsumptionEntry['source'],
          stockItemId: m.stockItemId,
          depositoId: m.depositoId,
          unitCostBRL: unit,
          totalCostBRL: unit * qty,
        }
      })
  }

  function handleApplyText() {
    const p = parseCompizzoText(textValue)
    if (p.obra) setObra(p.obra)
    if (p.data) setData(p.data)
    if (p.diaObra) setDiaObra(p.diaObra)
    if (p.responsavelNome) { setResponsavel(p.responsavelNome); setRespNome(p.responsavelNome) }
    if (p.responsavelData) setRespData(p.responsavelData)
    if (p.condicaoClimatica) setCondicao(p.condicaoClimatica)
    // O checklist virou fases em 20/09/2026: o que o parser reconhece de serviço já vem em
    // `p.producao`, que é lido logo abaixo. Nada se perde.
    if (p.descricaoServicos) setDescricao(p.descricaoServicos)
    if (p.producao.length) setProducao(p.producao)
    if (p.materiais.length) setMateriais(p.materiais)
    if (Object.keys(p.ocorrencias).length) setOcorrencias((o) => ({ ...o, ...p.ocorrencias }))
    if (p.observacoes) setObservacoes(p.observacoes)
    if (p.planejamentoProximoDia) setPlanejamento(p.planejamentoProximoDia)
    if (p.employeeNames.length) setEmployeeNames((prev) => [...new Set([...prev, ...p.employeeNames])])
    setShowText(false)
    setTextValue('')
  }

  async function handlePhotos(files: FileList | null) {
    if (!files) return
    // Comprime (canvas → JPEG, ~4 MB → ~200 KB), mostra o thumbnail JÁ (base64) e sobe
    // pro Supabase Storage EM BACKGROUND — não trava a tela em rede de canteiro ruim.
    // Ao terminar o upload, anexa o storagePath; offline/demo/erro fica só o base64.
    for (const file of Array.from(files).slice(0, 20)) {
      if (file.size > 30 * 1024 * 1024) continue
      try {
        const blob = await compressImageToBlob(file)
        const base64 = await blobToDataUrl(blob)
        const id = crypto.randomUUID()
        setPhotos((prev) => [...prev, { id, base64, label: file.name, uploadedAt: new Date().toISOString() }])
        if (!isNonProductionDataMode()) {
          void uploadRdoPhoto(blob)
            .then((storagePath) => setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, storagePath } : p))))
            .catch(() => { /* offline/sem org: mantém o base64 como fallback */ })
        }
      } catch {
        // ignora imagem inválida/corrompida
      }
    }
  }

  function buildRdoPayload(prod: RdoCompizzoProducaoRow[] = producao) {
    const w = climaToWeather(condicao)
    const nomeObra = selectedSite?.name ?? obra
    return {
      title: `RDO Compizzo${nomeObra ? ' — ' + nomeObra : ''}`,
      date: data || today,
      responsible: respNome || responsavel || '',
      weather: { morning: w, afternoon: w, night: w, temperatureC: 0 },
      manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0, employeeNames },
      equipment: equipment.map((e) => ({ ...e, id: crypto.randomUUID() })),
      services: [],
      materials: buildMaterials(),
      trechos: [],
      geolocation: null,
      observations: observacoes,
      incidents: '',
      photos: leanPhotosForPersist(photos),
      siteId: obraSiteId,
      numeroContrato: numeroContrato || undefined,
      template: 'compizzo' as const,
      compizzo: buildCompizzo(prod),
    }
  }

  // Infere a unidade a partir do texto do serviço ("(m²)", "(m)", "(un)"…) quando não informada.
  // Ao salvar: cada linha de produção com serviço e SEM vínculo CRIA (ou reusa por nome) uma
  // atividade no Planejamento da obra e se vincula — o sync depois avança o %. Precisa de obra.
  function buildProducaoFinal(): RdoCompizzoProducaoRow[] {
    if (!obraSiteId) return producao
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const criadasNesteSave = new Map<string, string>()   // nome normalizado → id criado neste save
    return producao.map((row) => {
      if (row.planningActivityId) return row
      const nome = row.servico.trim()
      const qtdDia = parseLocaleNumber(row.quantidade)
      const meta = row.quantidadePrevista ?? 0
      if (!nome || (qtdDia <= 0 && meta <= 0)) return row
      const chave = norm(nome)
      const existente = obraAtividades.find((a) => norm(a.name) === chave)
      // ⚠️ `unidade: unidadeDaLinha(row)` em todos os retornos: a linha padrão traz a unidade
      // DENTRO do nome ("Faixa Branca (m)") e o campo vem vazio. Sem gravar de volta, a tela e o
      // PDF caíam num "m²" literal e metro linear virava metro quadrado.
      if (existente) return { ...row, unidade: unidadeDaLinha(row), planningActivityId: existente.id, quantidadePrevista: existente.plannedQuantity ?? (meta || undefined) }
      // Outra linha do MESMO save já criou esta atividade? Reusa (evita duplicata; a soma vai p/ uma só).
      const jaCriada = criadasNesteSave.get(chave)
      if (jaCriada) return { ...row, unidade: unidadeDaLinha(row), planningActivityId: jaCriada, quantidadePrevista: meta || undefined }
      const id = addActivity({
        wbsCode: '', name: nome, parentId: null, level: 1,
        plannedStart: data || today, plannedEnd: data || today, trendStart: data || today, trendEnd: data || today,
        durationDays: 1, percentComplete: 0, status: 'not_started', isMilestone: false,
        obraId: obraSiteId, plannedQuantity: meta > 0 ? meta : qtdDia, unidade: unidadeDaLinha(row),
        operationalKey: `|${nome}`.toLowerCase(),
      })
      criadasNesteSave.set(chave, id)
      return { ...row, unidade: unidadeDaLinha(row), planningActivityId: id, quantidadePrevista: meta > 0 ? meta : qtdDia }
    })
  }

  function handleSave(status: 'rascunho' | 'finalizado' = 'finalizado') {
    // ⚠️ Quantidade sem destino BLOQUEIA o finalizar, e só o finalizar.
    //
    // Um número sem fase e sem nome é gravado, é impresso, e o sistema não sabe explicá-lo: não
    // entra na meta (`realizadoPorFaseNoPeriodo` exige `faseId`) nem no Planejamento
    // (`buildProducaoFinal` exige nome). Rascunho passa porque rascunho é "ainda vou preencher" —
    // e a meta já ignora rascunho por conta própria.
    if (status === 'finalizado' && faltaClassificar.length > 0) {
      toast.error(
        `Linha ${faltaClassificar.map((i) => i + 1).join(', ')}: escolha a fase, ou marque `
        + '"serviço avulso" e dê um nome. Quantidade sem serviço não entra na meta da obra nem no '
        + 'Planejamento, e sai em branco no PDF.',
      )
      return
    }
    const producaoFinal = buildProducaoFinal()   // cria atividades no Planejamento p/ linhas novas
    if (producaoFinal !== producao) setProducao(producaoFinal)
    const payload = { ...buildRdoPayload(producaoFinal), status }
    // Já salvo nesta sessão? Atualiza. Senão cria e guarda o id (rascunho não duplica).
    const rdoId = savedId ? (updateRdo(savedId, payload), savedId) : addRdo(payload)
    // ⚠️ `addRdo` devolve '' quando o papel não pode gravar (o gate espelha a policy do servidor).
    // Ignorar isso fazia a tela dizer "salvo" e mandar o usuário para um histórico sem o RDO.
    if (!rdoId) { toast.error(AVISO_SEM_PERMISSAO); return }
    if (!savedId) setSavedId(rdoId)
    // A ponte RDO → Mão de Obra saiu daqui: agora ela roda dentro do `addRdo`/`updateRdo` do
    // rdoStore, junto das outras três. Enquanto morava neste botão, editar o RDO pelo Histórico
    // não refazia os apontamentos, e despromover para rascunho não os removia.
    setSaved(true)
    // Rascunho mantém o usuário na tela para continuar preenchendo depois;
    // o salvamento definitivo volta ao histórico.
    if (status === 'finalizado') setTimeout(() => setActiveTab('historico'), 900)
    else setTimeout(() => setSaved(false), 1600)
  }

  function handlePrint() {
    const now = new Date().toISOString()
    // `photos` (state da tela) tem base64 → preview imprime sem ir à rede; o gerador
    // resolve pra base64 quando a foto só tiver storagePath (ex.: RDO em edição).
    // A janela abre SÍNCRONA no clique — depois de um await o navegador bloqueia o pop-up.
    const janela = abrirJanelaRelatorio()
    void imprimirRelatorioRdos(
      [{ tipo: 'torre', rdo: { id: 'preview', number: 0, createdAt: now, updatedAt: now, ...buildRdoPayload(), photos } }],
      'Pré-visualização',
      obra || null,
      janela,
    )
  }

  const totalColab = employeeNames.length
  const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  /**
   * Quanto o dia produziu, em R$.
   *
   * ─── O QUE ESTAVA ERRADO ───────────────────────────────────────────────────────────────────
   * Somava TODOS os m² do dia e multiplicava por UM preço — o `precoM2` global da obra —, mesmo
   * quando cada linha já sabia a qual serviço do contrato pertence (`contractServiceId`) e cada
   * serviço tem o seu preço. Num contrato de pintura real: piso a R$ 28,94/m², parede a R$ 27,65/m²
   * e demarcação a R$ 8,75 por metro LINEAR.
   *
   * Num dia de 200 m² de piso + 150 m² de parede + 80 m de demarcação, o certo é R$ 10.635,50. Com
   * um preço só saía R$ 10.129,00 (erro de 4,8%) ou R$ 9.677,50 (9,0%), conforme qual preço
   * estivesse cadastrado — e os R$ 700 da demarcação ficavam fora da conta, porque metro linear era
   * descartado.
   *
   * ─── COMO É AGORA ──────────────────────────────────────────────────────────────────────────
   * Cada linha vale pelo preço do SERVIÇO dela, seja qual for a unidade. O `precoM2` da obra vira
   * o recurso para linha solta — a que não está vinculada a serviço nenhum —, e aí a regra antiga
   * continua valendo: só área, porque o preço é por m².
   */
  const producaoDoDia = useMemo(() => {
    const ehArea = (u?: string) => /^\s*(m²|m2|metro quadrado|metros quadrados)\s*$/i.test(u ?? '')
    const porServico = new Map(
      (selectedSite?.contrato?.services ?? []).map((s) => [s.id, s]),
    )

    let valor = 0
    let m2 = 0
    let foraDaConta = 0
    let comPrecoProprio = 0

    for (const linha of producao) {
      const qtd = parseLocaleNumber(linha.quantidade) || 0
      if (qtd <= 0) continue
      if (ehArea(linha.unidade)) m2 += qtd

      const servico = linha.contractServiceId ? porServico.get(linha.contractServiceId) : undefined
      if (servico) {
        // Preço efetivo = preço cheio × (% aplicado). Mesma conta da medição, para o valor do dia
        // e o valor medido no fim do mês não discordarem.
        valor += qtd * precoEfetivo(servico)
        comPrecoProprio++
        continue
      }

      // Sem serviço vinculado: cai no preço por m² da obra, e só se a linha for em área.
      if (ehArea(linha.unidade) && precoM2 > 0) valor += qtd * precoM2
      else foraDaConta++
    }

    return { m2, valor, foraDaConta, comPrecoProprio }
  }, [producao, precoM2, selectedSite])

  /**
   * O outro lado da conta: quanto ainda falta executar de cada serviço tocado hoje.
   *
   * O valor do dia já saía certo, mas sozinho ele não diz nada sobre o andamento — quem preenche o
   * RDO no canteiro precisa ver que aqueles 320 m² de piso são os últimos, ou que ainda faltam
   * 4.000. `medidoAutoPorServico` soma os RDOs FINALIZADOS da obra; o RDO em edição é descontado
   * para a quantidade de hoje não ser contada duas vezes.
   */
  const avancoPorServico = useMemo(() => {
    const services = selectedSite?.contrato?.services ?? []
    if (services.length === 0) return []
    const porServico = new Map(services.map((sv) => [sv.id, sv]))

    // Quantidade lançada hoje, por serviço.
    const hoje = new Map<string, number>()
    for (const linha of producao) {
      if (!linha.contractServiceId || !porServico.has(linha.contractServiceId)) continue
      const q = parseLocaleNumber(linha.quantidade) || 0
      if (q > 0) hoje.set(linha.contractServiceId, (hoje.get(linha.contractServiceId) ?? 0) + q)
    }
    if (hoje.size === 0) return []

    const jaMedido = medidoAutoPorServico(
      todosRdos.filter((r) => r.id !== editing?.id),
      selectedSite?.id,
    )

    return [...hoje.entries()].map(([id, qtdHoje]) => {
      const sv = porServico.get(id)!
      const unidade = ehVerba(sv.unidade) ? '' : (sv.unidade || ROTULO_UNIDADE[classificarUnidade(sv.unidade)])
      const acumulado = qtdMedida(sv, jaMedido) + qtdHoje
      return {
        id,
        descricao: sv.descricao || 'Serviço sem descrição',
        unidade,
        qtdHoje,
        contratada: sv.qtdContrato || 0,
        // `saldoQtd` já desconta o `qtdAnterior` do contrato (o medido antes de o sistema entrar).
        saldo: saldoQtd(sv, acumulado),
        valorHoje: qtdHoje * precoEfetivo(sv),
        semMetragem: ehVerba(sv.unidade),
      }
    })
  }, [producao, selectedSite, todosRdos, editing])
  // Custo de mão de obra do dia = Σ custo/dia dos presentes (match normalizado, igual à ponte de apontamentos).
  const custoMaoObraDia = useMemo(
    () => employeeNames.reduce((s, name) => { const w = matchWorkerByName(name, workers); return s + (w ? custoDiaWorker(w, { settings: cltSettings }) : 0) }, 0),
    [employeeNames, workers, cltSettings],
  )
  const updateMaterial = (i: number, patch: Partial<RdoCompizzoMaterialRow>) =>
    setMateriais((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  // "Cadastrar no Estoque": cria o item na obra e vincula (passa a dar baixa nos próximos).
  function cadastrarNoEstoque(i: number) {
    const m = materiais[i]
    if (!m.material.trim()) return
    const qty = parseLocaleNumber(m.quantidade)
    const id = addItemEstoque({
      descricao: m.material.trim(), unidade: '',
      qtdDisponivel: qty > 0 ? qty : 0, qtdReservada: 0, qtdTransito: 0, estoqueMinimo: 0,
      custoUnitario: m.custoUnitario ?? 0, siteId: obraSiteId ?? null, depositoId: '',
    })
    updateMaterial(i, { stockItemId: id })
  }
  // Materiais com quantidade (do estoque ou manuais) — custo do dia; quais dão baixa.
  const materiaisComQtd = useMemo(() => materiais.filter((m) => m.material.trim() && parseLocaleNumber(m.quantidade) > 0), [materiais])
  const materiaisDoEstoque = useMemo(() => materiaisComQtd.filter((m) => m.stockItemId), [materiaisComQtd])
  const custoMateriaisDia = useMemo(
    () => materiaisComQtd.reduce((s, m) => s + (m.custoUnitario ?? 0) * parseLocaleNumber(m.quantidade), 0),
    [materiaisComQtd],
  )

  // ⚠️ Margem DERIVADA EM TELA, nunca lançamento. Uma saída por serviço exigiria uma família de
  // ids por `contractServiceId`, e `removeRdoEntries` apaga exatamente dois ids conhecidos —
  // despromover o RDO para rascunho deixaria lançamentos órfãos no Financeiro.
  const margem = useMemo(
    () => margemPorServico(
      avancoPorServico.map((a) => ({
        id: a.id, descricao: a.descricao, unidade: a.unidade, qtdHoje: a.qtdHoje, valorHoje: a.valorHoje,
      })),
      {
        materiais: custoMateriaisDia,
        maoDeObra: custoMaoObraDia,
        horasIndiretas: parseLocaleNumber(horasIndiretas) || undefined,
        horasTrabalhadas: parseLocaleNumber(horasTrabalhadas) || undefined,
      },
    ),
    [avancoPorServico, custoMateriaisDia, custoMaoObraDia, horasIndiretas, horasTrabalhadas],
  )

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#1f6fd1]/15">
            <ClipboardList size={18} className="text-[#1f6fd1]" />
          </div>
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base flex items-center gap-2">{editing ? 'Editar RDO' : 'RDO'} <CompizzoWordmark /></h2>
            <p className="text-[#6b6b6b] text-xs">Diário de Obra — demarcação e pintura de piso industrial{editing ? ` · Nº ${editing.number}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowText(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors">
            <ScanText size={14} /> Preencher com Texto
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors">
            <Printer size={14} /> Imprimir / PDF
          </button>
          <button onClick={() => handleSave('rascunho')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#f97316]/50 text-[#f97316] hover:bg-[#f97316]/10 transition-colors">
            <Save size={14} /> Salvar Rascunho
          </button>
          <button onClick={() => handleSave('finalizado')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors">
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />} {saved ? 'Salvo!' : editing ? 'Salvar alterações' : 'Salvar RDO'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Informações Gerais */}
        <Section title="Informações Gerais" icon={<FileText size={16} className="text-[#1f6fd1]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}><Building2 size={11} className="inline mr-1 text-[#1f6fd1]" />Obra (Torre de Controle)</label>
              {sites.length > 0 ? (
                <select className={inputCls} value={obraSiteId ?? ''} onChange={(e) => handleObraChange(e.target.value)}>
                  <option value="">— Selecione a obra —</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <input className={inputCls} value={obra} onChange={(e) => setObra(e.target.value)} placeholder="Cadastre a obra na Torre de Controle" />
              )}
              {!obraSiteId && obra && (
                <p className="mt-1 text-[10px] text-[#fdba74]">Obra do RDO (texto legado): “{obra}”. Selecione a obra da Torre para vincular contrato, planejamento e estoque.</p>
              )}
              {hasContratoMeta && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2">
                  {numeroContrato && <Meta label="Contrato" value={numeroContrato} />}
                  {servicoContratado && <Meta label="Serviço" value={servicoContratado} />}
                  {precoM2 > 0 && <Meta label="Preço/m²" value={brl(precoM2)} />}
                  {bacObra > 0 && <Meta label="BAC (faturamento previsto)" value={brl(bacObra)} />}
                  {(periodoInicio || periodoFim) && <Meta label="Período" value={`${periodoInicio || '—'} a ${periodoFim || '—'}`} />}
                  {activePlano && (activePlano.areaM2 ?? 0) > 0 && <Meta label="Meta (m²)" value={String(activePlano.areaM2)} />}
                </div>
              )}
              {/* Basta HAVER valor. A condição era `precoM2 > 0 && m2 > 0`, que escondia o bloco
                  justamente nos dois casos novos: obra que só tem preço por serviço (sem `precoM2`
                  cadastrado) e dia produzido só em metro linear. */}
              {producaoDoDia.valor > 0 && (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-[#f97316]/30 bg-[#f97316]/[0.07] px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#fdba74]">Produzido hoje</span>
                  <span className="text-sm font-bold tabular-nums text-[#f5f5f5]">{brl(producaoDoDia.valor)}</span>
                  <span className="text-[10px] text-[#a3a3a3]">
                    {producaoDoDia.comPrecoProprio > 0
                      // Com serviços do contrato vinculados, a conta é linha a linha e não cabe numa
                      // multiplicação só — dizer "N m² × R$/m²" ali seria mentir sobre como saiu.
                      ? `${producaoDoDia.comPrecoProprio} serviço(s) do contrato, cada um pelo seu preço`
                      : `${producaoDoDia.m2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m² × ${brl(precoM2)}/m²`}
                  </span>
                  {producaoDoDia.foraDaConta > 0 && (
                    <span className="text-[10px] text-[#6b6b6b]">
                      · {producaoDoDia.foraDaConta} linha(s) fora da conta (sem serviço do contrato e não medidas em m²)
                    </span>
                  )}
                </div>
              )}
              {/* Avanço contra a metragem contratada, serviço a serviço. */}
              {avancoPorServico.length > 0 && (
                <div className="mt-2 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9a9a9a]">Avanço do dia por serviço</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {avancoPorServico.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                        <span className="text-[#e5e5e5]">{a.descricao}</span>
                        <span className="tabular-nums font-semibold text-[#f5f5f5]">
                          +{a.qtdHoje.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {a.unidade}
                        </span>
                        <span className="tabular-nums text-[#fdba74]">{brl(a.valorHoje)}</span>
                        {(() => {
                          const m = margem.linhas.find((x) => x.id === a.id)
                          if (!m) return null
                          if (m.foraDoRateio) {
                            return <span className="text-[10px] text-[#9a9a9a]">· sem preço no contrato, fora do rateio</span>
                          }
                          return (
                            <>
                              <span className="tabular-nums text-[#9a9a9a]">− {brl(m.custo)} de custo</span>
                              <span className={`tabular-nums font-semibold ${m.margem < 0 ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
                                = {brl(m.margem)}{m.margemPct != null && ` (${m.margemPct.toFixed(0)}%)`}
                              </span>
                            </>
                          )
                        })()}
                        {!a.semMetragem && a.contratada > 0 && (
                          <span className={`tabular-nums ${a.saldo < 0 ? 'text-[#f87171]' : 'text-[#9a9a9a]'}`}>
                            · {a.saldo < 0 ? 'passou em ' : 'faltam '}
                            {Math.abs(a.saldo).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {a.unidade}
                            {' '}de {a.contratada.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 border-t border-[#3d3d3d] pt-1.5 text-[10px] leading-4 text-[#9a9a9a]">
                    <p>
                      Custo do dia <span className="tabular-nums text-[#c9c9c9]">{brl(margem.custoTotal)}</span>
                      {' '}(materiais {brl(custoMateriaisDia)} + mão de obra {brl(custoMaoObraDia)}), rateado
                      entre os serviços <b>pelo valor produzido</b> — não pela quantidade, que não soma
                      entre m², metro e unidade.
                    </p>
                    <p className="mt-0.5">
                      Sem produzir nada mensurável:{' '}
                      {/* ⚠️ "—" e não zero: zero diria "o dia inteiro produziu". */}
                      {margem.custoIndireto == null
                        ? <span className="text-[#fbbf24]">— (informe as horas do dia para separar)</span>
                        : <span className="tabular-nums text-[#c9c9c9]">{brl(margem.custoIndireto)}</span>}
                    </p>
                    {/* ⚠️ A nota fixa: sem ela, "margem de 40%" lê-se como número completo. */}
                    <p className="mt-0.5 text-[#fbbf24]">
                      ⚠️ Custo de equipamento não incluso — não há tarifa cadastrada no produto.
                      A margem acima é otimista nessa medida.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div><label className={labelCls}>Data</label><input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className={labelCls}>Dia da Obra{diaObraSugerido != null && <span className="text-[9px] text-[#6b6b6b]"> · auto {diaObraSugerido}</span>}</label><input className={inputCls} value={diaObra} onChange={(e) => { setDiaObra(e.target.value); setDiaObraTouched(true) }} placeholder="03" /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Responsável</label><input className={inputCls} list="compizzo-responsaveis" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Selecione ou digite (funcionário / gestor da obra)" /><datalist id="compizzo-responsaveis">{responsavelOptions.map((n) => <option key={n} value={n} />)}</datalist></div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>Condições Climáticas</label>
            <div className="flex flex-wrap gap-2">
              {([['sol', 'Sol', Sun], ['nublado', 'Nublado', Cloud], ['chuva', 'Chuva', CloudRain], ['outros', 'Outros', Cloud]] as const).map(([val, lbl, Icon]) => (
                <button key={val} type="button" onClick={() => setCondicao(val)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${condicao === val ? 'bg-[#1f6fd1] text-white border-[#1f6fd1]' : 'bg-transparent text-[#a3a3a3] border-[#525252] hover:text-[#f5f5f5]'}`}>
                  <Icon size={13} /> {lbl}
                </button>
              ))}
              {condicao === 'outros' && (
                <input className={`${inputCls} max-w-[180px]`} value={condicaoOutros} onChange={(e) => setCondicaoOutros(e.target.value)} placeholder="Especifique" />
              )}
            </div>
          </div>
        </Section>

        {/* Mão de Obra */}
        <Section title={`Mão de Obra (${totalColab})`} icon={<FileText size={16} className="text-[#1f6fd1]" />}>
          {/* Selecionar uma equipe inteira configurada no módulo Mão de Obra */}
          {crews.length > 0 && (
            <div className="mb-2">
              <label className={labelCls}><Users size={11} className="inline mr-1 text-[#1f6fd1]" />Adicionar equipe completa</label>
              <select
                className={inputCls}
                value={crewPick}
                onChange={(e) => {
                  const crew = crews.find((c) => c.id === e.target.value)
                  if (crew) {
                    const names = crew.workerIds
                      .map((id) => workers.find((w) => w.id === id)?.name)
                      .filter((n): n is string => Boolean(n))
                    if (crew.foreman) names.unshift(crew.foreman)
                    setEmployeeNames((prev) => [...new Set([...prev, ...names])])
                  }
                  setCrewPick('')
                }}
              >
                <option value="">— Selecione uma equipe (adiciona todos os membros) —</option>
                {crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.projectRef ? ` — ${c.projectRef}` : ''} ({c.workerIds.length} membro{c.workerIds.length !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Selecionar funcionário cadastrado no módulo Mão de Obra */}
          {workers.length > 0 && (
            <div className="mb-2">
              <label className={labelCls}><Users size={11} className="inline mr-1 text-[#1f6fd1]" />Selecionar funcionário cadastrado</label>
              <select
                className={inputCls}
                value={workerPick}
                onChange={(e) => { addEmployee(e.target.value); setWorkerPick('') }}
              >
                <option value="">— Selecione um funcionário —</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.name} disabled={employeeNames.includes(w.name)}>
                    {w.name}{w.role ? ` — ${w.role}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={employeeInput}
              onChange={(e) => setEmployeeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmployee(employeeInput); setEmployeeInput('') } }}
              placeholder="Ou digite um nome (Enter para adicionar)"
            />
            <button type="button" onClick={() => { addEmployee(employeeInput); setEmployeeInput('') }} className="px-3 rounded-lg bg-[#1f6fd1] text-white"><Plus size={15} /></button>
          </div>
          {employeeNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {employeeNames.map((nme, i) => {
                const w = matchWorkerByName(nme, workers)
                const custo = w ? custoDiaWorker(w, { settings: cltSettings }) : 0
                return (
                  <span key={`${nme}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3d3d3d] text-[#f5f5f5] text-xs">
                    <span>{nme}
                      {w?.role && <span className="text-[#a3a3a3]"> · {w.role}</span>}
                      {custo > 0 && <span className="text-[#6b6b6b]"> · {brl(custo)}/dia</span>}
                    </span>
                    <button onClick={() => setEmployeeNames((p) => p.filter((_, idx) => idx !== i))} className="text-[#6b6b6b] hover:text-[#ef4444]"><X size={12} /></button>
                  </span>
                )
              })}
            </div>
          )}
          {custoMaoObraDia > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-xs">
              <span className="text-[#a3a3a3]">Custo de mão de obra do dia (presentes):</span>
              <strong className="text-[#f5f5f5]">{brl(custoMaoObraDia)}</strong>
              <span className="text-[#6b6b6b]">· salário bruto + encargos ÷ 22 dias úteis</span>
            </div>
          )}
        </Section>

        {/* ─── Fases do Dia ────────────────────────────────────────────────────────────
            Substituiu o checklist "Serviços Executados no Dia" em 20/09/2026, e ABSORVEU a antiga
            "Produção do Dia". Eram duas seções descrevendo o mesmo trabalho: uma com onze
            caixinhas sem número nenhum, outra com a metragem que de fato alimenta a medição, o
            planejamento e agora a meta da obra. Ter as duas significava digitar o mesmo serviço
            duas vezes, e só uma das digitações contava.

            ⚠️ As fases são a produção INTEIRA, em ordem, ao longo de semanas — não um checklist
            diário. Por isso a tela abre só com o que foi apontado e um "+ fase" que oferece o
            catálogo da obra: ninguém digita zero em sete linhas todo dia. */}
        <Section title="Fases do Dia" icon={<ClipboardList size={16} className="text-[#1f6fd1]" />}>
          <div className="space-y-2">
            <div className="hidden sm:grid gap-2 px-1" style={{ gridTemplateColumns: COLUNAS_DA_FASE }}>
              <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">Fase / serviço</span>
              <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">Qtd. dia</span>
              <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">Un.</span>
              <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">Meta</span>
              <span />
            </div>
            {producao.map((row, i) => {
              const act = row.planningActivityId ? obraAtividades.find((a) => a.id === row.planningActivityId) : undefined
              const cls = classificacaoDaLinha(row)
              return (
                <div key={i} className="grid gap-2 items-start" style={{ gridTemplateColumns: COLUNAS_DA_FASE }}>
                  <div>
                    <select
                      className={cn(inputCls, faltaClassificar.includes(i) && 'border-[#ef4444]/70')}
                      value={cls === 'fase' ? row.faseId! : cls === 'avulso' ? OPCAO_AVULSO : ''}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === OPCAO_AVULSO) {
                          updateProducao(i, { faseId: undefined, classificacao: 'avulso' })
                          return
                        }
                        if (v === '') {
                          // ⚠️ O nome só é limpo quando a linha NÃO veio do contrato: a descrição
                          // de uma linha com `contractServiceId` pertence ao contrato, e apagá-la
                          // deixaria a medição com um vínculo sem nome.
                          updateProducao(i, row.contractServiceId
                            ? { faseId: undefined, classificacao: 'nao-escolhida' }
                            : { faseId: undefined, classificacao: 'nao-escolhida', servico: '', unidade: undefined })
                          return
                        }
                        const f = fasesDaObra.find((x) => x.id === v)
                        // A unidade vem da FASE, não é digitada: é ela que decide se a metragem é
                        // área, comprimento ou contagem — e daí depende a meta e o preço.
                        if (f) updateProducao(i, { faseId: f.id, servico: f.nome, unidade: f.unidade, classificacao: 'fase' })
                      }}
                    >
                      <option value="">Selecionar Fase</option>
                      {fasesDaObra.map((f) => (
                        <option key={f.id} value={f.id}>{f.ordem}. {f.nome} ({f.unidade})</option>
                      ))}
                      {/* ⚠️ O ÚLTIMO da lista, por decisão do cliente. A opção continua existindo:
                          há serviço no canteiro que não é fase nenhuma. */}
                      <option value={OPCAO_AVULSO}>— serviço avulso (digite abaixo) —</option>
                    </select>
                    {cls === 'avulso' && (
                      <input
                        className={`${inputCls} mt-1`} value={row.servico} placeholder="Serviço avulso"
                        onChange={(e) => updateProducao(i, { servico: e.target.value })}
                      />
                    )}
                    {/* O vínculo com o Planejamento continua existindo — deixou de ser editável
                        aqui e passou a seguir o nome da fase. Esta linha é o rastro dele. */}
                    {act && (
                      <p className="mt-0.5 truncate text-[10px] text-[#6b6b6b]"
                         title={`Previsto ${act.plannedQuantity ?? '—'} · realizado ${act.executedQuantity ?? 0} (${Math.round(act.percentComplete ?? 0)}%)`}>
                        → planej. {act.name}
                      </p>
                    )}
                  </div>
                  <input className={inputCls} value={row.quantidade} placeholder="Qtd" inputMode="decimal" onChange={(e) => updateProducao(i, { quantidade: e.target.value })} />
                  <input className={inputCls} value={row.unidade ?? ''} placeholder="m²" list="compizzo-unidades" onChange={(e) => updateProducao(i, { unidade: e.target.value })} />
                  <input className={inputCls} value={row.quantidadePrevista != null ? String(row.quantidadePrevista) : ''} placeholder="meta" inputMode="decimal" onChange={(e) => updateProducao(i, { quantidadePrevista: parseLocaleNumber(e.target.value) || undefined })} />
                  <button type="button" onClick={() => setProducao((rows) => rows.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 flex items-center justify-center pt-2"><Trash2 size={14} /></button>
                </div>
              )
            })}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setProducao((rows) => [...rows, { servico: '', quantidade: '', classificacao: 'nao-escolhida' }])} className="flex items-center gap-1.5 text-[#1f6fd1] hover:text-[#1a5cb0] text-sm"><Plus size={14} /> Adicionar fase</button>
              {faseNaoApontada && (
                <button
                  type="button"
                  onClick={() => setProducao((rows) => [...rows, { faseId: faseNaoApontada.id, servico: faseNaoApontada.nome, unidade: faseNaoApontada.unidade, quantidade: '', classificacao: 'fase' }])}
                  className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-2 py-1 text-xs text-[#a3a3a3] hover:border-[#1f6fd1]/50 hover:text-[#f5f5f5]"
                >
                  <Plus size={12} /> {faseNaoApontada.ordem}. {faseNaoApontada.nome}
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-[#6b6b6b]">
            A linha com <strong>fase</strong> alimenta a <strong>Meta de Produção</strong> desta
            obra — a mesma que aparece logo abaixo e na Torre de Controle. A linha com serviço
            avulso continua valendo para o dia, mas não entra na meta: o sistema não tem como saber
            a que fase ela pertence.
            {' '}Ao salvar, a linha também cria (ou reaproveita, pelo nome) a atividade
            correspondente no Planejamento, que é o que move o Previsto × Realizado e o Gestão 360.
            Esse vínculo deixou de ser editável aqui e passou a seguir o nome da fase. Precisa de
            uma obra selecionada.
          </p>

          {/* ─── Metas de Produção ─────────────────────────────────────────────────────────
              ⚠️ É a MESMA seção da Torre de Controle, não uma cópia. Editar aqui grava em
              `useTorreStore.sites` pelo `updateSite`, e a Torre relê do mesmo store — os dois
              lados são a mesma verdade porque não existe cópia local em lugar nenhum. Uma segunda
              implementação da meta dentro do RDO é exatamente como nascem dois números diferentes
              para a mesma pergunta.

              ⚠️ Render CONDICIONAL, não `<details>`/`hidden`: `<details>` monta os filhos mesmo
              fechado, e aí a varredura de TODOS os RDO da empresa (`realizadoPorFaseNoPeriodo`)
              rodaria a cada tecla digitada neste formulário, com a meta escondida. */}
          <div className="mt-4 border-t border-[#525252] pt-3">
            {!selectedSite ? (
              <p className="text-[11px] text-[#6b6b6b]">Selecione a obra para ver a meta de produção.</p>
            ) : (
              <>
                <button
                  type="button" onClick={() => setVerMeta((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#a3a3a3] hover:border-[#1f6fd1]/50 hover:text-[#f5f5f5]"
                >
                  <Target size={13} className="text-[#1f6fd1]" />
                  <span className="font-medium">{verMeta ? 'Ocultar meta' : 'Visualizar meta'}</span>
                  <span className="ml-auto text-[10px] text-[#6b6b6b]">
                    {(selectedSite.metas?.length ?? 0) === 0 ? 'nenhuma meta cadastrada'
                      : `${selectedSite.metas!.length} período(s)`}
                  </span>
                  {verMeta ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {verMeta && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] leading-4 text-[#6b6b6b]">
                      ⚠️ O <strong>Feito</strong> abaixo vem dos RDO <strong>finalizados</strong>{' '}
                      desta obra. O que você está digitando agora só entra na conta depois de
                      finalizar — rascunho não conta.
                    </p>
                    {/* ⚠️ `key` OBRIGATÓRIA. O card guarda a meta em edição num `useState` interno;
                        sem remontar ao trocar de obra, o `onSalvar` grava a meta da obra A dentro
                        do `site.metas` da obra B. É o mesmo remendo que a Torre já documenta. */}
                    <MetasDaObraSection key={`metas-${selectedSite.id}`} site={selectedSite} />
                  </div>
                )}
              </>
            )}
          </div>
          {fasesDaObra.length === 0 && (
            <p className="mt-2 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[10px] leading-4 text-[#fbbf24]">
              ⚠️ Esta obra ainda não tem fases cadastradas — a lista acima está usando as oito
              padrão de piso industrial. Para a meta funcionar, cadastre as fases em
              <strong> Torre de Controle › a obra › Fases</strong>.
            </p>
          )}

          <div className="mt-3">
            <label className={labelCls}>Descrição do que foi executado</label>
            <textarea rows={2} className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Foi dado início ao serviço com a demarcação do piso." />
          </div>
          <datalist id="compizzo-unidades">
            {['m', 'm²', 'm³', 'un', 'kg', 'L', 'h'].map((u) => <option key={u} value={u} />)}
          </datalist>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className={labelCls}>Horas trabalhadas (HH do dia) — usado na produtividade (RUP = HH ÷ m²)</label>
              <input
                className={inputCls}
                value={horasTrabalhadas}
                onChange={(e) => setHorasTrabalhadas(e.target.value)}
                placeholder={totalColab > 0 ? `${totalColab} colab × 8h = ${totalColab * 8}` : 'ex.: 40'}
                inputMode="decimal"
              />
            </div>
            {totalColab > 0 && (
              <button
                type="button"
                onClick={() => setHorasTrabalhadas(String(totalColab * 8))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f6fd1]/50 transition-colors"
              >
                <Users size={13} /> {totalColab} colab × 8h
              </button>
            )}
          </div>

          {/* ⚠️ As horas que não produziram nada mensurável. Sem elas, o rateio do custo empurra o
              deslocamento e a montagem de canteiro para dentro de quem por acaso produziu no dia —
              e num dia de serviço único a margem dele vira ficção. */}
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-end">
            <div>
              <label className={labelCls}>Horas sem produção</label>
              <input
                className={inputCls} value={horasIndiretas} inputMode="decimal"
                onChange={(e) => setHorasIndiretas(e.target.value)} placeholder="ex.: 2"
              />
            </div>
            <div>
              <label className={labelCls}>O que ocupou essas horas (deslocamento, canteiro…)</label>
              <input
                className={inputCls} value={motivoIndireto}
                onChange={(e) => setMotivoIndireto(e.target.value)} placeholder="opcional"
              />
            </div>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-[#6b6b6b]">
            Estas horas saem do rateio do custo por serviço e aparecem à parte.
            {parseLocaleNumber(horasIndiretas) > 0 && parseLocaleNumber(horasTrabalhadas) <= 0 && (
              <span className="text-[#fbbf24]"> ⚠️ Informe também as horas do dia acima — sem o total,
                não dá para saber que fração do dia foi indireta, e o custo inteiro continua rateado.</span>
            )}
          </p>
        </Section>

        {/* Materiais */}
        <Section title="Materiais Utilizados" icon={<ClipboardList size={16} className="text-[#1f6fd1]" />}>
          {/* Puxar item do módulo Suprimentos (estoque filtrado pela obra do RDO) */}
          {estoqueDaObra.length > 0 && (
            <div className="mb-2">
              <label className={labelCls}>Puxar do módulo Suprimentos{obraSiteId ? ' (estoque da obra)' : ''}</label>
              <select
                className={inputCls}
                value={materialPick}
                onChange={(e) => {
                  const item = estoqueDaObra.find((it) => it.id === e.target.value)
                  if (item) {
                    setMateriais((rows) => {
                      // Preenche a primeira linha vazia; senão acrescenta nova.
                      const emptyIdx = rows.findIndex((r) => !r.material.trim() && !r.quantidade.trim())
                      const novo: RdoCompizzoMaterialRow = {
                        material: `${item.descricao}${item.unidade ? ` (${item.unidade})` : ''}`,
                        quantidade: '',
                        stockItemId: item.id,
                        depositoId: item.depositoId,
                        custoUnitario: item.custoUnitario ?? 0,
                      }
                      if (emptyIdx >= 0) return rows.map((r, i) => (i === emptyIdx ? novo : r))
                      return [...rows, novo]
                    })
                  }
                  setMaterialPick('')
                }}
              >
                <option value="">— Selecione um material do estoque —</option>
                {estoqueDaObra.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.descricao} — {it.qtdDisponivel} {it.unidade} disponível
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Linhas de material: do estoque (dão baixa) ou manuais (contabilizadas, com aviso) */}
          <div className="space-y-2">
            <div className="hidden sm:grid gap-2 px-1" style={{ gridTemplateColumns: 'minmax(0,1.4fr) 76px 88px minmax(0,1.2fr) 32px' }}>
              <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">Material</span>
              <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">Qtd.</span>
              <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">R$/un</span>
              <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">Origem</span>
              <span />
            </div>
            {materiais.map((m, i) => {
              const temQtd = parseLocaleNumber(m.quantidade) > 0
              const fromStock = Boolean(m.stockItemId)
              return (
                <div key={i} className="grid gap-2 items-start" style={{ gridTemplateColumns: 'minmax(0,1.4fr) 76px 88px minmax(0,1.2fr) 32px' }}>
                  <input className={inputCls} value={m.material} placeholder="Material" onChange={(e) => updateMaterial(i, { material: e.target.value })} />
                  <input className={inputCls} value={m.quantidade} placeholder="Qtd" inputMode="decimal" onChange={(e) => updateMaterial(i, { quantidade: e.target.value })} />
                  <input className={inputCls} value={m.custoUnitario != null ? String(m.custoUnitario) : ''} placeholder="0,00" inputMode="decimal" onChange={(e) => updateMaterial(i, { custoUnitario: parseLocaleNumber(e.target.value) || undefined })} />
                  <div className="min-w-0">
                    {fromStock ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#16a34a]/15 px-2 py-1 text-[10px] font-semibold text-[#4ade80]"><PackageSearch size={11} /> do estoque · baixa</span>
                    ) : m.material.trim() ? (
                      <div className="flex flex-col gap-1">
                        <span className="rounded-full bg-[#f59e0b]/15 px-2 py-1 text-[10px] font-semibold text-[#fdba74]">fora do estoque · será contabilizado</span>
                        {obraSiteId && temQtd && (
                          <button type="button" onClick={() => cadastrarNoEstoque(i)} className="self-start text-[10px] font-semibold text-[#1f6fd1] hover:underline">+ Cadastrar no Estoque</button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => setMateriais((rows) => rows.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 flex items-center justify-center pt-2"><Trash2 size={14} /></button>
                </div>
              )
            })}
            <button type="button" onClick={() => setMateriais((rows) => [...rows, { material: '', quantidade: '' }])} className="flex items-center gap-1.5 text-[#1f6fd1] hover:text-[#1a5cb0] text-sm"><Plus size={14} /> Adicionar material</button>
          </div>
          {materiaisComQtd.length > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-xs">
              <span className="text-[#a3a3a3]">{materiaisDoEstoque.length} do estoque (dão baixa) · {materiaisComQtd.length - materiaisDoEstoque.length} fora do estoque</span>
              <span className="font-semibold text-[#f5f5f5]">Custo do dia: {brl(custoMateriaisDia)}</span>
            </div>
          )}
        </Section>

        {/* Suprimentos da obra (leitura) — estoque, reservas, requisições e previsão de demanda */}
        <Section title="Suprimentos da obra" icon={<PackageSearch size={16} className="text-[#1f6fd1]" />}>
          {!obraSiteId ? (
            <p className="text-[#6b6b6b] text-sm">Selecione a obra (acima) para ver estoque, reservas, requisições e previsão de demanda dela.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SupplyBlock title={`Estoque disponível (${estoqueDaObra.length})`}>
                {estoqueDaObra.length === 0 ? <Empty>Sem itens no estoque desta obra.</Empty> : estoqueDaObra.slice(0, 6).map((it) => (
                  <Row key={it.id} left={it.descricao} right={`${it.qtdDisponivel} ${it.unidade}`} />
                ))}
              </SupplyBlock>
              <SupplyBlock title={`Reservas (${reservasDaObra.length})`}>
                {reservasDaObra.length === 0 ? <Empty>Nenhuma reserva para esta obra.</Empty> : reservasDaObra.slice(0, 6).map((r) => {
                  const it = estoqueItens.find((i) => i.id === r.itemId)
                  const tone = r.status === 'vermelho' ? 'text-[#ef4444]' : r.status === 'amarelo' ? 'text-[#fdba74]' : 'text-[#22c55e]'
                  return <Row key={r.id} left={`${it?.descricao ?? r.itemId} · sem ${r.semana}`} right={`${r.qtdNecessaria} · ${r.status}`} tone={tone} />
                })}
              </SupplyBlock>
              <SupplyBlock title={`Requisições em aberto (${requisicoesDaObra.length})`}>
                {requisicoesDaObra.length === 0 ? <Empty>Nenhuma requisição para esta obra.</Empty> : requisicoesDaObra.slice(0, 6).map((r) => (
                  <Row key={r.id} left={`${r.code} · ${r.material}`} right={`${r.quantity} ${r.unit} · ${r.status}`} />
                ))}
              </SupplyBlock>
              <SupplyBlock title={`Previsão de demanda (${previsoesDaObra.length})`}>
                {previsoesDaObra.length === 0 ? <Empty>Sem previsão de demanda para esta obra.</Empty> : previsoesDaObra.slice(0, 6).map((f) => (
                  <Row key={f.id} left={`${f.materialCategory} · ${f.weekLabel}`} right={`${f.estimatedQty} ${f.unit}`} />
                ))}
              </SupplyBlock>
            </div>
          )}
        </Section>

        {/* Equipamentos */}
        <Section title="Equipamentos" icon={<Wrench size={16} className="text-[#1f6fd1]" />}>
          {equipment.length === 0 && <p className="text-[#6b6b6b] text-sm italic">Nenhum equipamento adicionado.</p>}
          <div className="space-y-2">
            {equipment.map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_90px_32px] gap-2 items-end">
                <div><label className={labelCls}>Equipamento</label><input className={inputCls} value={row.name} onChange={(e) => setEquipment((eq) => eq.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))} placeholder="Ex.: Maçarico, compactador" /></div>
                <div><label className={labelCls}>Qtd.</label><input type="number" min={0} className={inputCls} value={row.quantity} onChange={(e) => setEquipment((eq) => eq.map((r, idx) => idx === i ? { ...r, quantity: Number(e.target.value) } : r))} /></div>
                <div><label className={labelCls}>Horas</label><input type="number" min={0} step={0.5} className={inputCls} value={row.hours} onChange={(e) => setEquipment((eq) => eq.map((r, idx) => idx === i ? { ...r, hours: Number(e.target.value) } : r))} /></div>
                <button type="button" onClick={() => setEquipment((eq) => eq.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setEquipment((eq) => [...eq, { name: '', quantity: 1, hours: 0 }])} className="flex items-center gap-1.5 text-[#1f6fd1] hover:text-[#1a5cb0] text-sm mt-2"><Plus size={14} /> Adicionar Equipamento</button>
        </Section>

        {/* Ocorrências */}
        <Section title="Ocorrências" icon={<CheckCircle2 size={16} className="text-[#1f6fd1]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {OCORRENCIA_ITEMS.map(([key, lbl]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Checkbox checked={ocorrencias[key]} label={lbl} onChange={(v) => setOcorrencias((o) => ({ ...o, [key]: v }))} />
                </div>
                {/* ⚠️ Quantas horas custou. A lista de motivos já era a certa — faltava a
                    magnitude, e é ela que transforma "teve ocorrência" em "perdemos 14 h
                    esperando liberação de área". O campo só aparece com a caixa marcada, e
                    deixá-lo VAZIO é uma resposta legítima: quer dizer "aconteceu, não medimos".
                    Vazio não é zero — os indicadores contam os dois casos separados. */}
                {key !== 'semOcorrencias' && ocorrencias[key] && (
                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      type="number" min="0" step="0.5" inputMode="decimal"
                      className="w-16 rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs text-white outline-none focus:border-[#f97316]/60"
                      placeholder="h"
                      value={horasOcorrencia[key as MotivoDeParada] ?? ''}
                      onChange={(e) => setHorasOcorrencia((h) => {
                        const v = e.target.value
                        const proximo = { ...h }
                        if (v === '') delete proximo[key as MotivoDeParada]
                        else proximo[key as MotivoDeParada] = Number(v)
                        return proximo
                      })}
                    />
                    <span className="text-[10px] text-[#6b6b6b]">h</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-[#6b6b6b]">
            As horas são opcionais — mas é com elas que o painel consegue dizer <b>qual motivo mais
            custou no mês</b>. Deixar em branco significa “aconteceu, não medimos”, e não zero.
          </p>
          <div className="mt-3">
            <label className={labelCls}>Observações</label>
            <textarea rows={4} className={inputCls} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Descreva as ocorrências do dia..." />
          </div>
        </Section>

        {/* Registro Fotográfico */}
        <Section title={`Registro Fotográfico (${photos.length})`} icon={<Camera size={16} className="text-[#1f6fd1]" />}>
          <AreaDeSoltar
            compacto
            varios
            aceita="image/*"
            titulo="Arraste as fotos ou clique para adicionar"
            aoEscolher={(arquivos) => { void handlePhotos(arquivos as unknown as FileList) }}
          />
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {photos.map((p, i) => (
                <div key={p.id} className="relative group">
                  <RdoPhotoImg photo={p} className="w-full h-24 object-cover rounded-lg border border-[#525252]" />
                  <button onClick={() => { if (p.storagePath) void removeRdoPhoto(p.storagePath); setPhotos((prev) => prev.filter((_, idx) => idx !== i)) }} className="absolute top-1 right-1 bg-black/60 rounded p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Planejamento próximo dia */}
        <Section title="Planejamento para o Próximo Dia" icon={<ClipboardList size={16} className="text-[#1f6fd1]" />}>
          <textarea rows={3} className={inputCls} value={planejamento} onChange={(e) => setPlanejamento(e.target.value)} placeholder="Dar continuidade aos serviços de demarcação nas áreas já liberadas..." />
        </Section>

        {/* Responsável pela Obra */}
        <Section title="Responsável pela Obra" icon={<FileText size={16} className="text-[#1f6fd1]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Nome</label><input className={inputCls} list="compizzo-responsaveis" value={respNome} onChange={(e) => setRespNome(e.target.value)} placeholder="Selecione ou digite" /></div>
            <div><label className={labelCls}>Data</label><input type="date" className={inputCls} value={respData} onChange={(e) => setRespData(e.target.value)} /></div>
          </div>
        </Section>
      </div>

      {/* Modal: Preencher com Texto */}
      {showText && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={(e) => { if (e.target === e.currentTarget) setShowText(false) }}>
          <div className="w-full max-w-2xl rounded-2xl border border-[#525252] bg-[#333333] shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
              <h3 className="text-[#f5f5f5] font-bold text-sm flex items-center gap-2"><ScanText size={16} className="text-[#1f6fd1]" /> Preencher com Texto</h3>
              <button onClick={() => setShowText(false)} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-xs text-[#a3a3a3] mb-2">Cole o texto do Diário de Obra (formato Compizzo). Os checkboxes, tabelas e textos serão preenchidos automaticamente. Campos do Novo RDO (mão de obra) também são reconhecidos.</p>
              <textarea rows={12} className={inputCls} value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder={'Obra: ...\nData: 03/06/2026\nDia da Obra: 03\n...\n2. SERVIÇOS EXECUTADOS NO DIA\nx Preparação do piso\n...'} />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#525252]">
              <button onClick={() => setShowText(false)} className="px-3 py-1.5 rounded-lg border border-[#525252] text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">Cancelar</button>
              <button onClick={handleApplyText} disabled={!textValue.trim()} className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] disabled:opacity-50">Analisar e preencher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Subcomponents ──────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <h3 className="flex items-center gap-2 text-[#f5f5f5] font-semibold text-sm mb-3">{icon}{title}</h3>
      {children}
    </section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-[#6b6b6b]">{label}</p>
      <p className="text-[11px] font-semibold text-[#e5e5e5] truncate" title={value}>{value}</p>
    </div>
  )
}

function SupplyBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
      <p className="text-[11px] font-semibold text-[#a3a3a3] mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ left, right, tone = 'text-[#c9c9c9]' }: { left: string; right: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="truncate text-[#c9c9c9]" title={left}>{left}</span>
      <span className={`tabular-nums shrink-0 ${tone}`}>{right}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[#6b6b6b] italic">{children}</p>
}

function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm text-[#f5f5f5] hover:bg-[#3d3d3d] transition-colors">
      <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? 'bg-[#1f6fd1] border-[#1f6fd1]' : 'border-[#6b6b6b]'}`}>
        {checked && <CheckCircle2 size={11} className="text-white" />}
      </span>
      {label}
    </button>
  )
}

