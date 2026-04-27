import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { AlertTriangle, Database, Plus, Trash2 } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { useAppModeStore } from '@/store/appModeStore'
import { cn } from '@/lib/utils'

type RedeTipo = 'Esgoto' | 'Água' | 'Drenagem'
type MaterialTubo = 'PVC PBA' | 'PEAD' | 'PVC Ocre' | 'FoFo' | 'Concreto' | 'Outro'
type SoloTipo = 'Argila' | 'Areia' | 'Rocha' | 'Outro'
type SuperficieTipo = 'Terra' | 'Asfalto' | 'Concreto' | 'Bloco'
type PvTipo = 'PV Circular' | 'CI' | 'Caixa de válvula' | 'Outro'
type ParamUnit = '%' | 'm' | 'adim' | 'un/100m' | 'kg/m³' | 'm³/equipe.dia' | 'm/equipe.dia' | 'm²/equipe.dia' | 'un/equipe.dia' | 'outro'

interface ParamRow {
  id: string
  parametro: string
  valor: number
  unidade: ParamUnit
  comentario: string
}

interface TrechoRow {
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
  fatorEmpolamento: number
  superficie: SuperficieTipo
  larguraRecomposicao: string
  escoramento: 'Sim' | 'Não'
  espBerco: number
  alturaEnvolvimento: number
  reaproveitamento: string
  observacoes: string
  fatorCompactacao: number
  curvasAuto: number
  tesAuto: number
  registrosAuto: number
  ventosasAuto: number
  observacaoPlanejamento: string
  folgaAmpliacao: string
}

interface PvRow {
  id: string
  nome: string
  tipo: PvTipo
  diametroInterno: number
  espParede: number
  folgaEscavacao: number
  profundidadeTotal: number
  espBase: number
  tampoes: number
  degraus: number
  observacoes: string
  diasExecucao: number
}

interface AccessoryRow {
  id: string
  rede: RedeTipo
  item: string
  unidade: string
  quantidade: number
  codigoRef: string
  observacoes: string
}

interface PriceRef {
  id: string
  grupo: string
  codigo: string
  descricao: string
  unidade: string
  puDireto: number
  fonte: string
  situacao: 'Automático' | 'Revisar'
}

interface BudgetRow {
  id: string
  grupo: string
  subgrupo: string
  item: string
  unidade: string
  origem: string
  quantidade: number
  codigoRef: string
  puDireto: number
  fonte: string
  situacao: 'Automático' | 'Revisar'
  observacao: string
}

const STORAGE_KEY = 'cdata-quantitativo-personalizado'

const steps = [
  'Instruções',
  'Parâmetros e Premissas',
  'Trechos Rede',
  'PVs',
  'Acessórios Manuais',
  'Produção',
  'Resumo Quantitativos',
  'Lista de Materiais',
  'Orçamento',
  'Resumo',
  'BDI e Indiretos',
  'SINAPI / SEINFRA / Base Própria',
  'Levantamento e Orçamento',
  'Curva ABC',
]

const unitOptions: ParamUnit[] = ['%', 'm', 'adim', 'un/100m', 'kg/m³', 'm³/equipe.dia', 'm/equipe.dia', 'm²/equipe.dia', 'un/equipe.dia', 'outro']

const priceRefs: PriceRef[] = [
  { id: 'ref-esc-1', grupo: 'Valas', codigo: '74066/001', descricao: 'Escavação mecânica em vala até 1,50 m', unidade: 'm³', puDireto: 28.5, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-esc-2', grupo: 'Valas', codigo: '74066/002', descricao: 'Escavação mecânica em vala de 1,50 m a 3,00 m', unidade: 'm³', puDireto: 35.8, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-rea-1', grupo: 'Valas', codigo: '72887', descricao: 'Reaterro compactado mecanicamente', unidade: 'm³', puDireto: 18.4, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-escor-1', grupo: 'Valas', codigo: '74209', descricao: 'Escoramento metálico em vala', unidade: 'm²', puDireto: 22.1, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-tubo-200', grupo: 'Tubulação', codigo: '89764', descricao: 'Tubo PVC PBA DN 200 mm, fornecimento e assentamento', unidade: 'm', puDireto: 95.3, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-tubo-150', grupo: 'Tubulação', codigo: '89765', descricao: 'Tubo PVC PBA DN 150 mm, fornecimento e assentamento', unidade: 'm', puDireto: 72.6, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-bf-1', grupo: 'Valas', codigo: '74157', descricao: 'Bota-fora de material excedente', unidade: 'm³', puDireto: 19.2, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-pav-1', grupo: 'Pavimento', codigo: '97645', descricao: 'Recomposição de pavimento asfáltico e=5 cm', unidade: 'm²', puDireto: 88.4, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-pv-1', grupo: 'Estruturas', codigo: '72020', descricao: 'Poço de visita circular D=1,20 m até H=3,00 m', unidade: 'un', puDireto: 2850, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
  { id: 'ref-berco-1', grupo: 'Berço', codigo: '74151', descricao: 'Berço em areia', unidade: 'm³', puDireto: 145, fonte: 'SINAPI 07/2025 - amostra local', situacao: 'Revisar' },
]

const demoParams: ParamRow[] = [
  { id: 'p-1', parametro: 'BDI Obras', valor: 25, unidade: '%', comentario: 'Conforme BDI aprovado na plataforma' },
  { id: 'p-2', parametro: 'Fator empolamento padrão', valor: 1.3, unidade: 'adim', comentario: 'Aplicado ao bota-fora' },
  { id: 'p-3', parametro: '% Reaproveitamento solo', valor: 80, unidade: '%', comentario: 'Valor padrão dos trechos' },
  { id: 'p-4', parametro: 'Perda de tubo', valor: 3, unidade: '%', comentario: 'Cortes, sobras e ajustes' },
  { id: 'p-5', parametro: 'Espessura berço', valor: 0.1, unidade: 'm', comentario: 'Camada inferior em areia' },
  { id: 'p-6', parametro: 'Altura envolvimento', valor: 0.15, unidade: 'm', comentario: 'Acima do topo do tubo' },
  { id: 'p-7', parametro: 'Produtividade escavação', valor: 150, unidade: 'm³/equipe.dia', comentario: 'Equipe padrão' },
  { id: 'p-8', parametro: 'Produtividade assentamento', valor: 80, unidade: 'm/equipe.dia', comentario: 'DN até 300 mm' },
  { id: 'p-9', parametro: 'Produtividade recomposição', valor: 200, unidade: 'm²/equipe.dia', comentario: 'Pavimento padrão' },
  { id: 'p-10', parametro: 'Produtividade PV', valor: 1, unidade: 'un/equipe.dia', comentario: 'Estruturas simples' },
  { id: 'p-11', parametro: 'Armadura estimada PV', valor: 80, unidade: 'kg/m³', comentario: 'Estimativa paramétrica' },
]

const demoTrechos: TrechoRow[] = [
  {
    id: 'tr-1',
    nome: 'Trecho 1',
    rede: 'Esgoto',
    material: 'PVC Ocre',
    dn: 200,
    de: 218,
    comprimento: 120,
    profInicial: 1.5,
    profFinal: 2.1,
    larguraAdotada: '',
    solo: 'Argila',
    fatorEmpolamento: 1.3,
    superficie: 'Asfalto',
    larguraRecomposicao: '',
    escoramento: 'Sim',
    espBerco: 0.1,
    alturaEnvolvimento: 0.15,
    reaproveitamento: '',
    observacoes: 'Trecho sob via local',
    fatorCompactacao: 0.85,
    curvasAuto: 0,
    tesAuto: 0,
    registrosAuto: 0,
    ventosasAuto: 0,
    observacaoPlanejamento: 'Executar em frente de 40 m',
    folgaAmpliacao: 'Reservar derivação futura',
  },
  {
    id: 'tr-2',
    nome: 'Trecho 2',
    rede: 'Água',
    material: 'PVC PBA',
    dn: 150,
    de: 160,
    comprimento: 90,
    profInicial: 1.2,
    profFinal: 1.4,
    larguraAdotada: '',
    solo: 'Areia',
    fatorEmpolamento: 1.2,
    superficie: 'Terra',
    larguraRecomposicao: '',
    escoramento: 'Não',
    espBerco: 0.1,
    alturaEnvolvimento: 0.15,
    reaproveitamento: '',
    observacoes: '',
    fatorCompactacao: 0.85,
    curvasAuto: 2,
    tesAuto: 1,
    registrosAuto: 1,
    ventosasAuto: 0,
    observacaoPlanejamento: '',
    folgaAmpliacao: '',
  },
]

const demoPvs: PvRow[] = [
  { id: 'pv-1', nome: 'PV-01', tipo: 'PV Circular', diametroInterno: 1.2, espParede: 0.12, folgaEscavacao: 0.1, profundidadeTotal: 2.5, espBase: 0.2, tampoes: 1, degraus: 4, observacoes: '', diasExecucao: 1 },
]

const demoAccessories: AccessoryRow[] = [
  { id: 'ac-1', rede: 'Água', item: 'Registro de gaveta DN 150', unidade: 'un', quantidade: 1, codigoRef: '', observacoes: '' },
]

const num = (value: unknown, digits = 3) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Number(parsed.toFixed(digits)) : 0
}

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = (value: number, digits = 2) => value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function widthByDn(dn: number) {
  if (dn <= 200) return 0.7
  if (dn <= 300) return 0.9
  if (dn <= 400) return 1.1
  if (dn <= 600) return 1.4
  return 1.8
}

function calcTrecho(t: TrechoRow, defaults: { perdaTubo: number; prodEscav: number; prodAssent: number; prodRecomp: number; reaproveitamento: number }) {
  const profMedia = num((Number(t.profInicial) + Number(t.profFinal)) / 2)
  const larguraAuto = widthByDn(Number(t.dn))
  const larguraUtilizada = num(Number(t.larguraAdotada) || larguraAuto)
  const larguraRecompUtil = num(Number(t.larguraRecomposicao) || larguraUtilizada)
  const areaSecaoVala = num(larguraUtilizada * profMedia)
  const volumeEscavacao = num(areaSecaoVala * t.comprimento)
  const areaEscoramento = t.escoramento === 'Sim' ? num(2 * profMedia * t.comprimento) : 0
  const volumeBerco = num(larguraUtilizada * t.espBerco * t.comprimento)
  const volumeEnvolvimento = num(larguraUtilizada * t.alturaEnvolvimento * t.comprimento)
  const deM = t.de / 1000
  const volumeTubo = num((Math.PI / 4) * deM ** 2 * t.comprimento)
  const volumeLiquido = Math.max(0, num(volumeEscavacao - volumeBerco - volumeEnvolvimento - volumeTubo))
  const reaproveitamentoUsado = num(Number(t.reaproveitamento) || defaults.reaproveitamento, 1)
  const reaterroReaproveitado = num(volumeLiquido * (reaproveitamentoUsado / 100))
  const reaterroImportado = num(volumeLiquido - reaterroReaproveitado)
  const botaForaInSitu = num(volumeEscavacao - reaterroReaproveitado)
  const botaForaEmpolado = num(botaForaInSitu * t.fatorEmpolamento)
  const areaRecompTotal = num(larguraRecompUtil * t.comprimento)
  const areaAsfalto = t.superficie === 'Asfalto' ? areaRecompTotal : 0
  const areaConcreto = t.superficie === 'Concreto' ? areaRecompTotal : 0
  const areaBloco = t.superficie === 'Bloco' ? areaRecompTotal : 0
  const volumeSubBase = num(areaRecompTotal * 0.15)
  const volumeRevestimento = num(areaRecompTotal * 0.05)
  const tuboComPerdas = num(t.comprimento * (1 + defaults.perdaTubo / 100))
  const testeDesinfeccao = t.rede === 'Água' ? t.comprimento : 0
  const botaForaCompactado = num(botaForaInSitu * t.fatorCompactacao)
  const diasEscavacao = defaults.prodEscav > 0 ? num(volumeEscavacao / defaults.prodEscav, 1) : 0
  const diasAssentamento = defaults.prodAssent > 0 ? num(t.comprimento / defaults.prodAssent, 1) : 0
  const diasRecomposicao = defaults.prodRecomp > 0 ? num(areaRecompTotal / defaults.prodRecomp, 1) : 0
  return {
    profMedia,
    larguraAuto,
    larguraUtilizada,
    larguraRecompUtil,
    areaSecaoVala,
    volumeEscavacao,
    areaEscoramento,
    volumeBerco,
    volumeEnvolvimento,
    volumeTubo,
    volumeLiquido,
    reaproveitamentoUsado,
    reaterroReaproveitado,
    reaterroImportado,
    botaForaInSitu,
    botaForaEmpolado,
    areaRecompTotal,
    areaAsfalto,
    areaConcreto,
    areaBloco,
    volumeSubBase,
    volumeRevestimento,
    tuboComPerdas,
    testeDesinfeccao,
    botaForaCompactado,
    diasEscavacao,
    diasAssentamento,
    diasRecomposicao,
  }
}

function calcPv(pv: PvRow, armaduraKgM3: number) {
  const dimensaoExterna = num(pv.diametroInterno + 2 * pv.espParede)
  const ladoEscavacao = num(dimensaoExterna + 2 * pv.folgaEscavacao)
  const volumeEscavacao = num((Math.PI / 4) * ladoEscavacao ** 2 * pv.profundidadeTotal)
  const volumeBase = num((Math.PI / 4) * ladoEscavacao ** 2 * pv.espBase)
  const alturaUtilParede = num(Math.max(0, pv.profundidadeTotal - pv.espBase))
  const areaParede = num(Math.PI * dimensaoExterna * alturaUtilParede)
  const volumeParedesConcreto = num((Math.PI / 4) * (dimensaoExterna ** 2 - pv.diametroInterno ** 2) * alturaUtilParede)
  const areaForma = num(areaParede + (Math.PI / 4) * dimensaoExterna ** 2 * 2)
  const armadura = num(volumeParedesConcreto * armaduraKgM3)
  const volumeReaterroExterno = Math.max(0, num(volumeEscavacao - volumeBase - volumeParedesConcreto - (Math.PI / 4) * pv.diametroInterno ** 2 * pv.profundidadeTotal))
  return { dimensaoExterna, ladoEscavacao, volumeEscavacao, volumeBase, alturaUtilParede, areaParede, volumeParedesConcreto, areaForma, armadura, volumeReaterroExterno }
}

function usePersistedRows<T>(key: string, fallback: T[], demoRows: T[]) {
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const [realRows, setRealRows] = useState<T[]>(() => {
    if (typeof window === 'undefined') return fallback
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) as T[] : fallback
    } catch {
      return fallback
    }
  })
  const [demo, setDemo] = useState<T[]>(demoRows)
  useEffect(() => {
    if (!isDemoMode) window.localStorage.setItem(key, JSON.stringify(realRows))
  }, [isDemoMode, key, realRows])
  const rows = isDemoMode ? demo : realRows
  const setRows: Dispatch<SetStateAction<T[]>> = isDemoMode ? setDemo : setRealRows
  return [rows, setRows, isDemoMode] as const
}

function SmallInput({ value, onChange, type = 'text', className }: { value: string | number; onChange: (value: string) => void; type?: string; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn('h-8 w-full min-w-[86px] rounded border border-[#525252] bg-[#2f2f2f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#8b5cf6]/70', className)}
    />
  )
}

function SmallSelect<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-8 w-full min-w-[110px] rounded border border-[#525252] bg-[#2f2f2f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#8b5cf6]/70">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#525252] bg-[#333333]">
      <table className="w-full min-w-max border-collapse text-xs">{children}</table>
    </div>
  )
}

function Th({ children }: { children?: ReactNode }) {
  return <th className="border-b border-[#525252] bg-[#3d3d3d] px-3 py-2 text-left font-semibold text-[#a3a3a3]">{children}</th>
}

function Td({ children, right }: { children?: ReactNode; right?: boolean }) {
  return <td className={cn('border-b border-[#525252]/50 px-3 py-2 text-[#e5e5e5]', right && 'text-right tabular-nums')}>{children}</td>
}

function Kpi({ label, value, tone = 'text-[#f5f5f5]' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

export function QuantitativoPersonalizadoPanel() {
  const bdiGlobal = useQuantitativosStore((s) => s.bdiGlobal)
  const setBdiGlobal = useQuantitativosStore((s) => s.setBdiGlobal)
  const customBase = useQuantitativosStore((s) => s.customBase)
  const [step, setStep] = useState(0)
  const [params, setParams, isDemoMode] = usePersistedRows<ParamRow>(`${STORAGE_KEY}-params`, [], demoParams)
  const [trechos, setTrechos] = usePersistedRows<TrechoRow>(`${STORAGE_KEY}-trechos`, [], demoTrechos)
  const [pvs, setPvs] = usePersistedRows<PvRow>(`${STORAGE_KEY}-pvs`, [], demoPvs)
  const [acessorios, setAcessorios] = usePersistedRows<AccessoryRow>(`${STORAGE_KEY}-acessorios`, [], demoAccessories)

  const param = (name: string, fallback: number) => params.find((item) => item.parametro === name)?.valor ?? fallback
  const defaults = {
    perdaTubo: param('Perda de tubo', 3),
    prodEscav: param('Produtividade escavação', 150),
    prodAssent: param('Produtividade assentamento', 80),
    prodRecomp: param('Produtividade recomposição', 200),
    prodPv: param('Produtividade PV', 1),
    reaproveitamento: param('% Reaproveitamento solo', 80),
    armaduraPv: param('Armadura estimada PV', 80),
  }

  const trechoCalcs = useMemo(() => trechos.map((trecho) => calcTrecho(trecho, defaults)), [trechos, defaults.perdaTubo, defaults.prodEscav, defaults.prodAssent, defaults.prodRecomp, defaults.reaproveitamento])
  const pvCalcs = useMemo(() => pvs.map((pv) => calcPv(pv, defaults.armaduraPv)), [pvs, defaults.armaduraPv])

  const totals = useMemo(() => {
    const sumTrecho = (key: keyof ReturnType<typeof calcTrecho>) => trechoCalcs.reduce((total, row) => total + Number(row[key] ?? 0), 0)
    const sumPv = (key: keyof ReturnType<typeof calcPv>) => pvCalcs.reduce((total, row) => total + Number(row[key] ?? 0), 0)
    return {
      comprimento: trechos.reduce((total, item) => total + Number(item.comprimento || 0), 0),
      escavacao: sumTrecho('volumeEscavacao') + sumPv('volumeEscavacao'),
      reaterroImportado: sumTrecho('reaterroImportado'),
      botaFora: sumTrecho('botaForaEmpolado'),
      berco: sumTrecho('volumeBerco'),
      envolvimento: sumTrecho('volumeEnvolvimento'),
      escoramento: sumTrecho('areaEscoramento'),
      recomposicao: sumTrecho('areaRecompTotal'),
      tubo: sumTrecho('tuboComPerdas'),
      pvVolumeConcreto: sumPv('volumeBase') + sumPv('volumeParedesConcreto'),
      pvForma: sumPv('areaForma'),
      pvArmadura: sumPv('armadura'),
    }
  }, [trechoCalcs, pvCalcs, trechos])

  const productionRows = useMemo(() => [
    { grupo: 'Valas', servico: 'Escavação de valas', unidade: 'm³', quantidade: totals.escavacao, produtividade: defaults.prodEscav, equipes: 1 },
    { grupo: 'Tubulação', servico: 'Assentamento de tubos', unidade: 'm', quantidade: totals.comprimento, produtividade: defaults.prodAssent, equipes: 1 },
    { grupo: 'Pavimento', servico: 'Recomposição de superfície', unidade: 'm²', quantidade: totals.recomposicao, produtividade: defaults.prodRecomp, equipes: 1 },
    { grupo: 'Estruturas', servico: 'Execução de PVs e caixas', unidade: 'un', quantidade: pvs.length, produtividade: defaults.prodPv, equipes: 1 },
  ].map((row) => ({ ...row, dias: row.produtividade > 0 ? num(row.quantidade / (row.produtividade * row.equipes), 1) : 0 })), [defaults.prodAssent, defaults.prodEscav, defaults.prodPv, defaults.prodRecomp, pvs.length, totals])

  const resumoQuantitativos = useMemo(() => [
    { grupo: 'Valas', descricao: 'Volume de escavação total', unidade: 'm³', quantidade: totals.escavacao, criterio: 'Área da seção da vala x comprimento + PVs' },
    { grupo: 'Valas', descricao: 'Área de escoramento', unidade: 'm²', quantidade: totals.escoramento, criterio: '2 x profundidade média x comprimento quando Sim' },
    { grupo: 'Berço', descricao: 'Volume de berço', unidade: 'm³', quantidade: totals.berco, criterio: 'Largura utilizada x espessura x comprimento' },
    { grupo: 'Tubulação', descricao: 'Tubo com perdas', unidade: 'm', quantidade: totals.tubo, criterio: 'Comprimento x perda configurada' },
    { grupo: 'Reaterro', descricao: 'Reaterro importado', unidade: 'm³', quantidade: totals.reaterroImportado, criterio: 'Volume líquido menos reaproveitamento' },
    { grupo: 'Bota-fora', descricao: 'Bota-fora empolado', unidade: 'm³', quantidade: totals.botaFora, criterio: 'Bota-fora in situ x fator de empolamento' },
    { grupo: 'Pavimento', descricao: 'Área de recomposição total', unidade: 'm²', quantidade: totals.recomposicao, criterio: 'Largura útil x comprimento' },
    { grupo: 'Estruturas', descricao: 'Concreto estimado em PVs', unidade: 'm³', quantidade: totals.pvVolumeConcreto, criterio: 'Base + paredes' },
    { grupo: 'Estruturas', descricao: 'Armadura estimada em PVs', unidade: 'kg', quantidade: totals.pvArmadura, criterio: 'Volume de parede x kg/m³' },
  ], [totals])

  const materialRows = useMemo(() => {
    const pipeRows = trechos.map((trecho, index) => ({
      grupo: 'Tubulação',
      rede: trecho.rede,
      material: trecho.material,
      dn: trecho.dn,
      descricao: `${trecho.material} DN ${trecho.dn} mm - ${trecho.nome}`,
      unidade: 'm',
      quantidade: trechoCalcs[index]?.tuboComPerdas ?? 0,
    }))
    const accessoryRows = acessorios.map((item) => ({
      grupo: 'Acessórios',
      rede: item.rede,
      material: item.item,
      dn: '',
      descricao: item.codigoRef ? `${item.item} (${item.codigoRef})` : item.item,
      unidade: item.unidade,
      quantidade: item.quantidade,
    }))
    return [
      ...pipeRows,
      { grupo: 'Berço', rede: 'Geral', material: 'Areia', dn: '', descricao: 'Areia para berço de assentamento', unidade: 'm³', quantidade: totals.berco },
      { grupo: 'Pavimento', rede: 'Geral', material: 'CBUQ', dn: '', descricao: 'CBUQ para recomposição asfáltica', unidade: 'm²', quantidade: trechoCalcs.reduce((total, row) => total + row.areaAsfalto, 0) },
      { grupo: 'Estruturas', rede: 'Geral', material: 'Concreto', dn: '', descricao: 'Concreto para PVs e caixas', unidade: 'm³', quantidade: totals.pvVolumeConcreto },
      ...accessoryRows,
    ]
  }, [acessorios, trechoCalcs, trechos, totals.berco, totals.pvVolumeConcreto])

  const budgetRows: BudgetRow[] = useMemo(() => [
    { id: 'b-esc', grupo: 'Valas', subgrupo: 'Escavação', item: 'Escavação mecânica em vala', unidade: 'm³', origem: 'SINAPI', quantidade: totals.escavacao, codigoRef: '74066/001', puDireto: priceRefs[0].puDireto, fonte: priceRefs[0].fonte, situacao: priceRefs[0].situacao, observacao: 'Gerado por trechos e PVs' },
    { id: 'b-rea', grupo: 'Valas', subgrupo: 'Reaterro', item: 'Reaterro compactado mecanicamente', unidade: 'm³', origem: 'SINAPI', quantidade: totals.reaterroImportado, codigoRef: '72887', puDireto: priceRefs[2].puDireto, fonte: priceRefs[2].fonte, situacao: priceRefs[2].situacao, observacao: 'Volume importado' },
    { id: 'b-escor', grupo: 'Valas', subgrupo: 'Escoramento', item: 'Escoramento metálico em vala', unidade: 'm²', origem: 'SINAPI', quantidade: totals.escoramento, codigoRef: '74209', puDireto: priceRefs[3].puDireto, fonte: priceRefs[3].fonte, situacao: priceRefs[3].situacao, observacao: '' },
    { id: 'b-tubo', grupo: 'Tubulação', subgrupo: 'Tubos', item: 'Fornecimento e assentamento de tubos', unidade: 'm', origem: 'SINAPI', quantidade: totals.tubo, codigoRef: '89764', puDireto: priceRefs[4].puDireto, fonte: priceRefs[4].fonte, situacao: priceRefs[4].situacao, observacao: 'Código deve ser revisado por DN/material' },
    { id: 'b-bf', grupo: 'Bota-fora', subgrupo: 'Transporte/Destinação', item: 'Bota-fora de material excedente', unidade: 'm³', origem: 'SINAPI', quantidade: totals.botaFora, codigoRef: '74157', puDireto: priceRefs[6].puDireto, fonte: priceRefs[6].fonte, situacao: priceRefs[6].situacao, observacao: '' },
    { id: 'b-pav', grupo: 'Pavimento', subgrupo: 'Recomposição', item: 'Recomposição de pavimento asfáltico', unidade: 'm²', origem: 'SINAPI', quantidade: trechoCalcs.reduce((total, row) => total + row.areaAsfalto, 0), codigoRef: '97645', puDireto: priceRefs[7].puDireto, fonte: priceRefs[7].fonte, situacao: priceRefs[7].situacao, observacao: '' },
    { id: 'b-pv', grupo: 'Estruturas', subgrupo: 'PVs', item: 'Poço de visita circular', unidade: 'un', origem: 'SINAPI', quantidade: pvs.length, codigoRef: '72020', puDireto: priceRefs[8].puDireto, fonte: priceRefs[8].fonte, situacao: priceRefs[8].situacao, observacao: 'Estimativa por unidade' },
    { id: 'b-berco', grupo: 'Berço', subgrupo: 'Assentamento', item: 'Berço em areia', unidade: 'm³', origem: 'SINAPI', quantidade: totals.berco, codigoRef: '74151', puDireto: priceRefs[9].puDireto, fonte: priceRefs[9].fonte, situacao: priceRefs[9].situacao, observacao: '' },
  ], [pvs.length, totals, trechoCalcs])

  const budgetTotal = useMemo(() => budgetRows.reduce((total, row) => total + row.quantidade * row.puDireto * (1 + bdiGlobal / 100), 0), [budgetRows, bdiGlobal])
  const abcRows = useMemo(() => {
    let accumulated = 0
    return [...budgetRows]
      .map((row) => ({ ...row, totalBdi: row.quantidade * row.puDireto * (1 + bdiGlobal / 100) }))
      .sort((a, b) => b.totalBdi - a.totalBdi)
      .map((row) => {
        accumulated += row.totalBdi
        const part = budgetTotal > 0 ? (row.totalBdi / budgetTotal) * 100 : 0
        const accumulatedPct = budgetTotal > 0 ? (accumulated / budgetTotal) * 100 : 0
        return { ...row, part, accumulatedPct, classe: accumulatedPct <= 80 ? 'A' : accumulatedPct <= 95 ? 'B' : 'C' }
      })
  }, [budgetRows, budgetTotal, bdiGlobal])

  function updateParam(id: string, patch: Partial<ParamRow>) {
    setParams((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function updateTrecho(id: string, patch: Partial<TrechoRow>) {
    setTrechos((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function updatePv(id: string, patch: Partial<PvRow>) {
    setPvs((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function updateAccessory(id: string, patch: Partial<AccessoryRow>) {
    setAcessorios((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  return (
    <div className="h-full overflow-auto bg-[#1f1f1f] p-5 text-[#f5f5f5]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Quantitativo Personalizado</h2>
          <p className="text-sm text-[#a3a3a3]">Redes de esgoto, água e drenagem com propagação automática para materiais, orçamento, levantamento e curva ABC.</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase', isDemoMode ? 'bg-[#f97316]/15 text-[#f97316]' : 'bg-[#16a34a]/15 text-[#4ade80]')}>
          {isDemoMode ? 'Modo DEMO' : 'Dados reais'}
        </span>
      </div>

      <div className="mb-4 overflow-x-auto rounded-xl border border-[#525252] bg-[#2c2c2c] p-2">
        <div className="flex min-w-max gap-1">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                step === index ? 'bg-[#8b5cf6] text-white' : 'text-[#a3a3a3] hover:bg-[#3d3d3d] hover:text-white',
              )}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Kpi label="Comprimento total" value={`${decimal(totals.comprimento, 1)} m`} tone="text-[#38bdf8]" />
        <Kpi label="Escavação total" value={`${decimal(totals.escavacao, 1)} m³`} tone="text-[#f97316]" />
        <Kpi label="Custo c/ BDI" value={brl(budgetTotal)} tone="text-[#4ade80]" />
        <Kpi label="Itens ABC" value={abcRows.length} tone="text-[#a78bfa]" />
      </div>

      {step === 0 && (
        <section className="rounded-xl border border-[#525252] bg-[#2f2f2f] p-5">
          <h3 className="mb-3 text-lg font-bold">Instruções</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {steps.slice(1).map((item, index) => (
              <div key={item} className="rounded-lg border border-[#525252] bg-[#333333] p-3">
                <p className="text-sm font-semibold text-[#f5f5f5]">{index + 2}. {item}</p>
                <p className="mt-1 text-xs text-[#a3a3a3]">Preencha ou revise os dados. As etapas posteriores são recalculadas automaticamente.</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setParams((rows) => [...rows, { id: makeId('param'), parametro: 'Novo parâmetro', valor: 0, unidade: 'outro', comentario: '' }])} className="inline-flex items-center gap-2 rounded-lg bg-[#8b5cf6] px-3 py-2 text-sm font-semibold text-white">
              <Plus size={15} /> Novo parâmetro
            </button>
          </div>
          <Table>
            <thead><tr><Th>Parâmetro</Th><Th>Valor</Th><Th>Unidade</Th><Th>Comentário</Th><Th /></tr></thead>
            <tbody>
              {params.map((row) => (
                <tr key={row.id}>
                  <Td><SmallInput value={row.parametro} onChange={(value) => updateParam(row.id, { parametro: value })} /></Td>
                  <Td><SmallInput type="number" value={row.valor} onChange={(value) => updateParam(row.id, { valor: Number(value) })} /></Td>
                  <Td><SmallSelect value={row.unidade} options={unitOptions} onChange={(value) => updateParam(row.id, { unidade: value })} /></Td>
                  <Td><SmallInput value={row.comentario} onChange={(value) => updateParam(row.id, { comentario: value })} className="min-w-[220px]" /></Td>
                  <Td><button type="button" onClick={() => setParams((rows) => rows.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#a3a3a3] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
                </tr>
              ))}
              {params.length === 0 && <tr><Td>Nenhum parâmetro cadastrado.</Td><Td /><Td /><Td /><Td /></tr>}
            </tbody>
          </Table>
        </section>
      )}

      {step === 2 && (
        <section>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setTrechos((rows) => [...rows, { ...demoTrechos[0], id: makeId('tr'), nome: `Trecho ${rows.length + 1}` }])} className="inline-flex items-center gap-2 rounded-lg bg-[#8b5cf6] px-3 py-2 text-sm font-semibold text-white">
              <Plus size={15} /> Novo trecho
            </button>
          </div>
          <Table>
            <thead>
              <tr>
                {['Trecho', 'Rede', 'Material Tubo', 'DN nominal (mm)', 'DE externo (mm)', 'Comprimento (m)', 'Prof. inicial (m)', 'Prof. final (m)', 'Prof. média (m)', 'Largura auto (m)', 'Largura adotada (m)', 'Largura utilizada (m)', 'Tipo solo', 'Fator Empolamento', 'Superfície', 'Largura recomposição (m)', 'Largura recomp. útil (m)', 'Área seção vala (m²)', 'Volume Escavação (m³)', 'Escoramento', 'Área Escoramento (m²)', 'Esp. berço (m)', 'Volume berço (m³)', 'Altura envolvimento (m)', 'Volume envolvimento (m³)', 'Volume tubo deslocado (m³)', 'Volume líquido a reaterrar (m³)', '% Reaproveitamento', '% reaproveitamento usado', 'Reaterro reaproveitado (m³)', 'Reaterro importado (m³)', 'Bota-fora in situ (m³)', 'Bota-fora empolado (m³)', 'Área recomp. total (m²)', 'Área recomp. asfalto (m²)', 'Área recomp. concreto (m²)', 'Área recomp. bloco (m²)', 'Volume sub-base (m³)', 'Volume revestimento (m³)', 'Tubo c/ perdas (m)', 'Teste/desinf. (m)', 'Observações', 'Fator compactação', 'Bota-fora compactado (m³)', 'Curvas auto (un)', 'Tês auto (un)', 'Registros auto (un)', 'Ventosas auto (un)', 'Dias escavação', 'Dias assentamento', 'Dias recomposição', 'Observação planejamento', 'Folga para futuras ampliações', ''].map((head) => <Th key={head}>{head}</Th>)}
              </tr>
            </thead>
            <tbody>
              {trechos.map((row, index) => {
                const calc = trechoCalcs[index]
                return (
                  <tr key={row.id}>
                    <Td><SmallInput value={row.nome} onChange={(value) => updateTrecho(row.id, { nome: value })} /></Td>
                    <Td><SmallSelect value={row.rede} options={['Esgoto', 'Água', 'Drenagem']} onChange={(value) => updateTrecho(row.id, { rede: value })} /></Td>
                    <Td><SmallSelect value={row.material} options={['PVC PBA', 'PEAD', 'PVC Ocre', 'FoFo', 'Concreto', 'Outro']} onChange={(value) => updateTrecho(row.id, { material: value })} /></Td>
                    <Td><SmallInput type="number" value={row.dn} onChange={(value) => updateTrecho(row.id, { dn: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={row.de} onChange={(value) => updateTrecho(row.id, { de: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={row.comprimento} onChange={(value) => updateTrecho(row.id, { comprimento: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={row.profInicial} onChange={(value) => updateTrecho(row.id, { profInicial: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={row.profFinal} onChange={(value) => updateTrecho(row.id, { profFinal: Number(value) })} /></Td>
                    <Td right>{decimal(calc.profMedia)}</Td>
                    <Td right>{decimal(calc.larguraAuto)}</Td>
                    <Td><SmallInput type="number" value={row.larguraAdotada} onChange={(value) => updateTrecho(row.id, { larguraAdotada: value })} /></Td>
                    <Td right>{decimal(calc.larguraUtilizada)}</Td>
                    <Td><SmallSelect value={row.solo} options={['Argila', 'Areia', 'Rocha', 'Outro']} onChange={(value) => updateTrecho(row.id, { solo: value })} /></Td>
                    <Td><SmallInput type="number" value={row.fatorEmpolamento} onChange={(value) => updateTrecho(row.id, { fatorEmpolamento: Number(value) })} /></Td>
                    <Td><SmallSelect value={row.superficie} options={['Terra', 'Asfalto', 'Concreto', 'Bloco']} onChange={(value) => updateTrecho(row.id, { superficie: value })} /></Td>
                    <Td><SmallInput type="number" value={row.larguraRecomposicao} onChange={(value) => updateTrecho(row.id, { larguraRecomposicao: value })} /></Td>
                    <Td right>{decimal(calc.larguraRecompUtil)}</Td>
                    <Td right>{decimal(calc.areaSecaoVala)}</Td>
                    <Td right>{decimal(calc.volumeEscavacao)}</Td>
                    <Td><SmallSelect value={row.escoramento} options={['Sim', 'Não']} onChange={(value) => updateTrecho(row.id, { escoramento: value })} /></Td>
                    <Td right>{decimal(calc.areaEscoramento)}</Td>
                    <Td><SmallInput type="number" value={row.espBerco} onChange={(value) => updateTrecho(row.id, { espBerco: Number(value) })} /></Td>
                    <Td right>{decimal(calc.volumeBerco)}</Td>
                    <Td><SmallInput type="number" value={row.alturaEnvolvimento} onChange={(value) => updateTrecho(row.id, { alturaEnvolvimento: Number(value) })} /></Td>
                    <Td right>{decimal(calc.volumeEnvolvimento)}</Td>
                    <Td right>{decimal(calc.volumeTubo)}</Td>
                    <Td right>{decimal(calc.volumeLiquido)}</Td>
                    <Td><SmallInput type="number" value={row.reaproveitamento} onChange={(value) => updateTrecho(row.id, { reaproveitamento: value })} /></Td>
                    <Td right>{decimal(calc.reaproveitamentoUsado, 1)}%</Td>
                    <Td right>{decimal(calc.reaterroReaproveitado)}</Td>
                    <Td right>{decimal(calc.reaterroImportado)}</Td>
                    <Td right>{decimal(calc.botaForaInSitu)}</Td>
                    <Td right>{decimal(calc.botaForaEmpolado)}</Td>
                    <Td right>{decimal(calc.areaRecompTotal)}</Td>
                    <Td right>{decimal(calc.areaAsfalto)}</Td>
                    <Td right>{decimal(calc.areaConcreto)}</Td>
                    <Td right>{decimal(calc.areaBloco)}</Td>
                    <Td right>{decimal(calc.volumeSubBase)}</Td>
                    <Td right>{decimal(calc.volumeRevestimento)}</Td>
                    <Td right>{decimal(calc.tuboComPerdas)}</Td>
                    <Td right>{decimal(calc.testeDesinfeccao)}</Td>
                    <Td><SmallInput value={row.observacoes} onChange={(value) => updateTrecho(row.id, { observacoes: value })} className="min-w-[180px]" /></Td>
                    <Td><SmallInput type="number" value={row.fatorCompactacao} onChange={(value) => updateTrecho(row.id, { fatorCompactacao: Number(value) })} /></Td>
                    <Td right>{decimal(calc.botaForaCompactado)}</Td>
                    <Td><SmallInput type="number" value={row.curvasAuto} onChange={(value) => updateTrecho(row.id, { curvasAuto: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={row.tesAuto} onChange={(value) => updateTrecho(row.id, { tesAuto: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={row.registrosAuto} onChange={(value) => updateTrecho(row.id, { registrosAuto: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={row.ventosasAuto} onChange={(value) => updateTrecho(row.id, { ventosasAuto: Number(value) })} /></Td>
                    <Td right>{decimal(calc.diasEscavacao, 1)}</Td>
                    <Td right>{decimal(calc.diasAssentamento, 1)}</Td>
                    <Td right>{decimal(calc.diasRecomposicao, 1)}</Td>
                    <Td><SmallInput value={row.observacaoPlanejamento} onChange={(value) => updateTrecho(row.id, { observacaoPlanejamento: value })} className="min-w-[180px]" /></Td>
                    <Td><SmallInput value={row.folgaAmpliacao} onChange={(value) => updateTrecho(row.id, { folgaAmpliacao: value })} className="min-w-[180px]" /></Td>
                    <Td><button type="button" onClick={() => setTrechos((rows) => rows.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#a3a3a3] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
                  </tr>
                )
              })}
              {trechos.length === 0 && <tr><Td>Nenhum trecho cadastrado.</Td></tr>}
            </tbody>
          </Table>
        </section>
      )}

      {step === 3 && (
        <section>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setPvs((rows) => [...rows, { ...demoPvs[0], id: makeId('pv'), nome: `PV-${rows.length + 1}` }])} className="inline-flex items-center gap-2 rounded-lg bg-[#8b5cf6] px-3 py-2 text-sm font-semibold text-white">
              <Plus size={15} /> Novo PV / Estrutura
            </button>
          </div>
          <Table>
            <thead><tr>{['PV/Estrutura', 'Tipo', 'Diâmetro Interno (m)', 'Esp. parede (m)', 'Folga escav. (m)', 'Profundidade Total (m)', 'Dimensão externa (m)', 'Lado escavação (m)', 'Volume Escavação (m³)', 'Espaçamento base (m)', 'Volume base concreto (m³)', 'Altura útil parede (m)', 'Área parede/anéis (m²)', 'Nº tampões', 'Nº degraus', 'Volume reaterro externo (m³)', 'Observações', 'Volume paredes concreto (m³)', 'Área de forma (m²)', 'Armadura estimada (kg)', 'Dias execução PV', ''].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
            <tbody>
              {pvs.map((pv, index) => {
                const calc = pvCalcs[index]
                return (
                  <tr key={pv.id}>
                    <Td><SmallInput value={pv.nome} onChange={(value) => updatePv(pv.id, { nome: value })} /></Td>
                    <Td><SmallSelect value={pv.tipo} options={['PV Circular', 'CI', 'Caixa de válvula', 'Outro']} onChange={(value) => updatePv(pv.id, { tipo: value })} /></Td>
                    <Td><SmallInput type="number" value={pv.diametroInterno} onChange={(value) => updatePv(pv.id, { diametroInterno: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={pv.espParede} onChange={(value) => updatePv(pv.id, { espParede: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={pv.folgaEscavacao} onChange={(value) => updatePv(pv.id, { folgaEscavacao: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={pv.profundidadeTotal} onChange={(value) => updatePv(pv.id, { profundidadeTotal: Number(value) })} /></Td>
                    <Td right>{decimal(calc.dimensaoExterna)}</Td>
                    <Td right>{decimal(calc.ladoEscavacao)}</Td>
                    <Td right>{decimal(calc.volumeEscavacao)}</Td>
                    <Td><SmallInput type="number" value={pv.espBase} onChange={(value) => updatePv(pv.id, { espBase: Number(value) })} /></Td>
                    <Td right>{decimal(calc.volumeBase)}</Td>
                    <Td right>{decimal(calc.alturaUtilParede)}</Td>
                    <Td right>{decimal(calc.areaParede)}</Td>
                    <Td><SmallInput type="number" value={pv.tampoes} onChange={(value) => updatePv(pv.id, { tampoes: Number(value) })} /></Td>
                    <Td><SmallInput type="number" value={pv.degraus} onChange={(value) => updatePv(pv.id, { degraus: Number(value) })} /></Td>
                    <Td right>{decimal(calc.volumeReaterroExterno)}</Td>
                    <Td><SmallInput value={pv.observacoes} onChange={(value) => updatePv(pv.id, { observacoes: value })} className="min-w-[180px]" /></Td>
                    <Td right>{decimal(calc.volumeParedesConcreto)}</Td>
                    <Td right>{decimal(calc.areaForma)}</Td>
                    <Td right>{decimal(calc.armadura)}</Td>
                    <Td><SmallInput type="number" value={pv.diasExecucao} onChange={(value) => updatePv(pv.id, { diasExecucao: Number(value) })} /></Td>
                    <Td><button type="button" onClick={() => setPvs((rows) => rows.filter((item) => item.id !== pv.id))} className="rounded p-1 text-[#a3a3a3] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
                  </tr>
                )
              })}
              {pvs.length === 0 && <tr><Td>Nenhum PV cadastrado.</Td></tr>}
            </tbody>
          </Table>
        </section>
      )}

      {step === 4 && (
        <section>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setAcessorios((rows) => [...rows, { id: makeId('ac'), rede: 'Água', item: '', unidade: 'un', quantidade: 0, codigoRef: '', observacoes: '' }])} className="inline-flex items-center gap-2 rounded-lg bg-[#8b5cf6] px-3 py-2 text-sm font-semibold text-white">
              <Plus size={15} /> Novo acessório
            </button>
          </div>
          <Table>
            <thead><tr>{['Rede', 'Item', 'Unidade', 'Quantidade', 'Código Ref.', 'Observações', ''].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
            <tbody>
              {acessorios.map((row) => (
                <tr key={row.id}>
                  <Td><SmallSelect value={row.rede} options={['Água', 'Esgoto', 'Drenagem']} onChange={(value) => updateAccessory(row.id, { rede: value })} /></Td>
                  <Td><SmallInput value={row.item} onChange={(value) => updateAccessory(row.id, { item: value })} className="min-w-[220px]" /></Td>
                  <Td><SmallInput value={row.unidade} onChange={(value) => updateAccessory(row.id, { unidade: value })} /></Td>
                  <Td><SmallInput type="number" value={row.quantidade} onChange={(value) => updateAccessory(row.id, { quantidade: Number(value) })} /></Td>
                  <Td><SmallInput value={row.codigoRef} onChange={(value) => updateAccessory(row.id, { codigoRef: value })} /></Td>
                  <Td><SmallInput value={row.observacoes} onChange={(value) => updateAccessory(row.id, { observacoes: value })} className="min-w-[220px]" /></Td>
                  <Td><button type="button" onClick={() => setAcessorios((rows) => rows.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#a3a3a3] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
                </tr>
              ))}
              {acessorios.length === 0 && <tr><Td>Nenhum acessório cadastrado.</Td><Td /><Td /><Td /><Td /><Td /><Td /></tr>}
            </tbody>
          </Table>
        </section>
      )}

      {step === 5 && (
        <Table>
          <thead><tr>{['Grupo', 'Serviço', 'Unidade', 'Quantidade', 'Produtividade (unidade/equipe.dia)', 'Nº equipes', 'Dias estimados'].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
          <tbody>{productionRows.map((row) => <tr key={row.servico}><Td>{row.grupo}</Td><Td>{row.servico}</Td><Td>{row.unidade}</Td><Td right>{decimal(row.quantidade)}</Td><Td right>{decimal(row.produtividade)}</Td><Td right>{row.equipes}</Td><Td right>{decimal(row.dias, 1)}</Td></tr>)}</tbody>
        </Table>
      )}

      {step === 6 && <SimpleRows rows={resumoQuantitativos} headers={['Grupo', 'Descrição', 'Unidade', 'Quantidade', 'Critério']} />}
      {step === 7 && <SimpleRows rows={materialRows} headers={['Grupo', 'Rede', 'Material', 'DN (mm)', 'Descrição', 'Unidade', 'Quantidade']} />}
      {step === 8 && <BudgetTable rows={budgetRows} bdi={bdiGlobal} total={budgetTotal} compact />}

      {step === 9 && (
        <section>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Kpi label="Custo total c/ BDI" value={brl(budgetTotal)} tone="text-[#4ade80]" />
            <Kpi label="Custo por metro" value={totals.comprimento > 0 ? brl(budgetTotal / totals.comprimento) : brl(0)} tone="text-[#38bdf8]" />
            <Kpi label="PVs / Estruturas" value={pvs.length} tone="text-[#a78bfa]" />
          </div>
          <SimpleRows rows={[
            { indicador: 'Comprimento total de rede', unidade: 'm', valor: decimal(totals.comprimento, 1), observacao: 'Soma dos trechos' },
            { indicador: 'Volume total de escavação', unidade: 'm³', valor: decimal(totals.escavacao, 1), observacao: 'Trechos + PVs' },
            { indicador: 'Reaterro importado', unidade: 'm³', valor: decimal(totals.reaterroImportado, 1), observacao: 'Após reaproveitamento' },
            { indicador: 'Bota-fora empolado', unidade: 'm³', valor: decimal(totals.botaFora, 1), observacao: 'Com fator de empolamento' },
            { indicador: 'BDI aplicado', unidade: '%', valor: decimal(bdiGlobal, 1), observacao: 'Vem da plataforma' },
          ]} headers={['Indicador', 'Unidade', 'Valor', 'Observação']} />
        </section>
      )}

      {step === 10 && (
        <section className="rounded-xl border border-[#525252] bg-[#2f2f2f] p-5">
          <h3 className="mb-3 text-lg font-bold">BDI e Indiretos</h3>
          <div className="max-w-md">
            <label className="text-xs font-semibold text-[#a3a3a3]">BDI global da plataforma (%)</label>
            <SmallInput type="number" value={bdiGlobal} onChange={(value) => setBdiGlobal(Number(value))} className="mt-2" />
            <p className="mt-3 text-sm text-[#a3a3a3]">O BDI já existe na plataforma e é aplicado nas etapas Orçamento, Levantamento e Curva ABC.</p>
          </div>
        </section>
      )}

      {step === 11 && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[#ca8a04]/40 bg-[#ca8a04]/10 p-4 text-sm text-[#fbbf24]">
            <AlertTriangle size={16} className="mr-2 inline" />
            A base local usada nesta tela é uma amostra SINAPI 07/2025. Como a data atual do sistema é 27/04/2026, ela está desatualizada há mais de 30 dias e os itens ficam marcados como “Revisar”. Para usar valores atualizados, importe a planilha oficial em Quantitativos &gt; Banco de Dados &gt; Base Própria.
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
              <Database size={18} className="mb-2 text-[#38bdf8]" />
              <p className="font-semibold">SINAPI</p>
              <p className="text-sm text-[#a3a3a3]">Pull atual: constante `priceRefs` neste componente, com fonte “SINAPI 07/2025 - amostra local”. A atualização fiel depende do arquivo mensal oficial da CAIXA importado como Base Própria ou de conector backend para download/API.</p>
              <a className="mt-2 inline-block text-xs text-[#8b5cf6]" href="https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx" target="_blank" rel="noreferrer">Fonte oficial CAIXA/SINAPI</a>
            </div>
            <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
              <Database size={18} className="mb-2 text-[#fbbf24]" />
              <p className="font-semibold">SEINFRA</p>
              <p className="text-sm text-[#a3a3a3]">Estrutura pronta para origem SEINFRA; sem tabela oficial carregada neste repositório para estes itens.</p>
            </div>
            <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
              <Database size={18} className="mb-2 text-[#4ade80]" />
              <p className="font-semibold">Base Própria</p>
              <p className="text-sm text-[#a3a3a3]">Puxa de `useQuantitativosStore.customBase`, alimentada pelo Banco de Dados/importações da plataforma. Entradas atuais: {customBase.length}.</p>
            </div>
          </div>
          <SimpleRows rows={priceRefs} headers={['Código', 'Descrição', 'Unidade', 'PU direto', 'Fonte', 'Situação']} />
        </section>
      )}

      {step === 12 && <BudgetTable rows={budgetRows} bdi={bdiGlobal} total={budgetTotal} />}
      {step === 13 && <AbcTable rows={abcRows} total={budgetTotal} />}

      <div className="mt-5 flex items-center justify-between border-t border-[#525252] pt-4">
        <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} className="rounded-lg border border-[#525252] px-4 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#333333]">Anterior</button>
        <span className="text-xs text-[#a3a3a3]">Etapa {step + 1} de {steps.length} - {steps[step]}</span>
        <button type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))} className="rounded-lg bg-[#8b5cf6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7c3aed]">Próxima</button>
      </div>
    </div>
  )
}

function SimpleRows({ rows, headers }: { rows: object[]; headers: string[] }) {
  const keys = Object.keys(rows[0] ?? {})
  return (
    <Table>
      <thead><tr>{headers.map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => {
          const record = row as Record<string, unknown>
          return (
          <tr key={String(record.id ?? index)}>
            {keys.map((key) => {
              return <Td key={key} right={typeof record[key] === 'number'}>{typeof record[key] === 'number' ? decimal(record[key] as number) : String(record[key] ?? '')}</Td>
            })}
          </tr>
        )})}
        {rows.length === 0 && <tr><Td>Nenhum dado cadastrado.</Td></tr>}
      </tbody>
    </Table>
  )
}

function BudgetTable({ rows, bdi, total, compact }: { rows: BudgetRow[]; bdi: number; total: number; compact?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          {(compact ? ['Grupo', 'Código ref.', 'Descrição', 'Unidade', 'Quantidade', 'Preço Unitário (R$)', 'Total (R$)'] : ['Seção', 'Subgrupo', 'Item', 'Unidade', 'Origem', 'Quantidade', 'Código ref.', 'PU direto (R$)', 'Custo direto (R$)', 'BDI', 'PU c/BDI (R$)', 'Total c/ BDI (R$)', 'Participação', 'Observação', 'Fonte', 'Situação']).map((head) => <Th key={head}>{head}</Th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const custoDireto = row.quantidade * row.puDireto
          const puBdi = row.puDireto * (1 + bdi / 100)
          const totalBdi = row.quantidade * puBdi
          const part = total > 0 ? (totalBdi / total) * 100 : 0
          return compact ? (
            <tr key={row.id}>
              <Td>{row.grupo}</Td><Td>{row.codigoRef}</Td><Td>{row.item}</Td><Td>{row.unidade}</Td><Td right>{decimal(row.quantidade)}</Td><Td right>{brl(row.puDireto)}</Td><Td right>{brl(totalBdi)}</Td>
            </tr>
          ) : (
            <tr key={row.id}>
              <Td>{row.grupo}</Td><Td>{row.subgrupo}</Td><Td>{row.item}</Td><Td>{row.unidade}</Td><Td>{row.origem}</Td><Td right>{decimal(row.quantidade)}</Td><Td>{row.codigoRef}</Td><Td right>{brl(row.puDireto)}</Td><Td right>{brl(custoDireto)}</Td><Td right>{decimal(bdi, 1)}%</Td><Td right>{brl(puBdi)}</Td><Td right>{brl(totalBdi)}</Td><Td right>{decimal(part, 1)}%</Td><Td>{row.observacao}</Td><Td>{row.fonte}</Td><Td>{row.situacao}</Td>
            </tr>
          )
        })}
      </tbody>
      <tfoot><tr><Td>Total</Td><Td right>{brl(total)}</Td></tr></tfoot>
    </Table>
  )
}

function AbcTable({ rows, total }: { rows: Array<BudgetRow & { totalBdi: number; part: number; accumulatedPct: number; classe: string }>; total: number }) {
  return (
    <section>
      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        <Kpi label="Total" value={brl(total)} tone="text-[#4ade80]" />
        <Kpi label="Classe A" value={brl(rows.filter((row) => row.classe === 'A').reduce((sum, row) => sum + row.totalBdi, 0))} tone="text-[#f87171]" />
        <Kpi label="Classe B" value={brl(rows.filter((row) => row.classe === 'B').reduce((sum, row) => sum + row.totalBdi, 0))} tone="text-[#fbbf24]" />
        <Kpi label="Classe C" value={brl(rows.filter((row) => row.classe === 'C').reduce((sum, row) => sum + row.totalBdi, 0))} tone="text-[#a3a3a3]" />
      </div>
      <Table>
        <thead><tr>{['Item', 'Unidade', 'Quantidade', 'Código', 'PU c/BDI (R$)', 'Total c/ BDI (R$)', '% Part.', '% Acum.', 'Classe'].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.id}><Td>{row.item}</Td><Td>{row.unidade}</Td><Td right>{decimal(row.quantidade)}</Td><Td>{row.codigoRef}</Td><Td right>{brl(row.puDireto)}</Td><Td right>{brl(row.totalBdi)}</Td><Td right>{decimal(row.part, 1)}%</Td><Td right>{decimal(row.accumulatedPct, 1)}%</Td><Td>{row.classe}</Td></tr>)}
        </tbody>
      </Table>
    </section>
  )
}
