import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { AlertTriangle, CheckCircle2, Database, Plus, Trash2 } from 'lucide-react'
import { useAppModeStore } from '@/store/appModeStore'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { cn } from '@/lib/utils'
import {
  calculatePersonalizado,
  defaultAccessories,
  defaultBaseRefs,
  defaultBdiComponents,
  defaultParams,
  defaultPvs,
  defaultTrechos,
  qaExpected,
  type AccessoryRow,
  type BaseRef,
  type BdiComponent,
  type MaterialTubo,
  type ParamRow,
  type ParamUnit,
  type PvRow,
  type PvTipo,
  type RedeTipo,
  type SoloTipo,
  type SuperficieTipo,
  type TrechoRow,
} from '../utils/personalizadoEngine'

const STORAGE_KEY = 'cdata-quantitativo-personalizado-v6'
const ACCENT = '#8b5cf6'

const steps = [
  'Instruções',
  'Parâmetros',
  'Trechos de Rede',
  'PVs',
  'Acessórios Manuais',
  'Produção',
  'Quantitativos',
  'Lista de Materiais',
  'Orçamento',
  'Resumo',
  'BDI e Indiretos',
  'Base SINAPI',
  'Levantamento e Orçamento',
  'Curva ABC',
]

const redeOptions: RedeTipo[] = ['Esgoto', 'Água', 'Drenagem']
const materialOptions: MaterialTubo[] = ['PVC PBA', 'PEAD', 'PVC Ocre', 'Tubo Concreto PA-1', 'FoFo', 'Concreto', 'Outro']
const soloOptions: SoloTipo[] = ['Argila', 'Areia', 'Rocha', 'Outro']
const superficieOptions: SuperficieTipo[] = ['Terra', 'Asfalto', 'Concreto', 'Bloco']
const pvOptions: PvTipo[] = ['Circular', 'PV Circular', 'CI', 'Caixa de válvula', 'Outro']
const unitOptions: ParamUnit[] = ['%', 'm', 'adim', 'un/100m', 'kg/m³', 'm³/equipe.dia', 'm/equipe.dia', 'm²/equipe.dia', 'un/equipe.dia', 'outro']

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = (value: number, digits = 2) => value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const percent = (value: number, digits = 1) => `${decimal(value, digits)}%`

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function usePersistedRows<T>(key: string, initialRows: T[]) {
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const [realRows, setRealRows] = useState<T[]>(() => {
    if (typeof window === 'undefined') return initialRows
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) as T[] : initialRows
    } catch {
      return initialRows
    }
  })
  const [demoRows, setDemoRows] = useState<T[]>(initialRows)
  useEffect(() => {
    if (!isDemoMode) window.localStorage.setItem(key, JSON.stringify(realRows))
  }, [isDemoMode, key, realRows])
  return (isDemoMode ? [demoRows, setDemoRows, true] : [realRows, setRealRows, false]) as readonly [T[], Dispatch<SetStateAction<T[]>>, boolean]
}

function SmallInput({ value, onChange, type = 'text', className }: { value: string | number; onChange: (value: string) => void; type?: string; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn('h-8 w-full min-w-[88px] rounded border border-[#525252] bg-[#2f2f2f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#8b5cf6]/80', className)}
    />
  )
}

function SmallSelect<T extends string>({ value, options, onChange, className }: { value: T; options: T[]; onChange: (value: T) => void; className?: string }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn('h-8 w-full min-w-[118px] rounded border border-[#525252] bg-[#2f2f2f] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#8b5cf6]/80', className)}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-[#525252] bg-[#333333]', className)}>
      <table className="w-full min-w-max border-collapse text-xs">{children}</table>
    </div>
  )
}

function Th({ children }: { children?: ReactNode }) {
  return <th className="sticky top-0 z-[1] border-b border-[#525252] bg-[#3d3d3d] px-3 py-2 text-left font-semibold text-[#d4d4d4]">{children}</th>
}

function Td({ children, right }: { children?: ReactNode; right?: boolean }) {
  return <td className={cn('border-b border-[#525252]/60 px-3 py-2 text-[#e5e5e5]', right && 'text-right tabular-nums')}>{children}</td>
}

function Kpi({ label, value, tone = 'text-[#f5f5f5]' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#3d3d3d] p-4">
      <p className="text-xs text-[#b8b8b8]">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

export function QuantitativoPersonalizadoPanel() {
  const setBdiGlobal = useQuantitativosStore((s) => s.setBdiGlobal)
  const [step, setStep] = useState(0)
  const [params, setParams, isDemoMode] = usePersistedRows<ParamRow>(`${STORAGE_KEY}-params`, defaultParams)
  const [trechos, setTrechos] = usePersistedRows<TrechoRow>(`${STORAGE_KEY}-trechos`, defaultTrechos)
  const [pvs, setPvs] = usePersistedRows<PvRow>(`${STORAGE_KEY}-pvs`, defaultPvs)
  const [acessorios, setAcessorios] = usePersistedRows<AccessoryRow>(`${STORAGE_KEY}-acessorios`, defaultAccessories)
  const [bdiComponents, setBdiComponents] = usePersistedRows<BdiComponent>(`${STORAGE_KEY}-bdi`, defaultBdiComponents)
  const [baseRefs, setBaseRefs] = usePersistedRows<BaseRef>(`${STORAGE_KEY}-base`, defaultBaseRefs)

  const calc = useMemo(() => calculatePersonalizado({ params, trechos, pvs, accessorios: acessorios, bdiComponents, baseRefs }), [params, trechos, pvs, acessorios, bdiComponents, baseRefs])

  useEffect(() => {
    setBdiGlobal(calc.bdiTotal)
  }, [calc.bdiTotal, setBdiGlobal])

  const qaRows = [
    { item: 'Extensão de rede de esgoto', esperado: qaExpected.extensaoEsgoto, obtido: calc.totals.extensaoEsgoto, unidade: 'm' },
    { item: 'Extensão de rede de água', esperado: qaExpected.extensaoAgua, obtido: calc.totals.extensaoAgua, unidade: 'm' },
    { item: 'Extensão de rede de drenagem', esperado: qaExpected.extensaoDrenagem, obtido: calc.totals.extensaoDrenagem, unidade: 'm' },
    { item: 'Escavação total', esperado: qaExpected.escavacaoTotal, obtido: calc.totals.escavacaoTotal, unidade: 'm³' },
    { item: 'Tubo total com perdas', esperado: qaExpected.tuboTotalComPerdas, obtido: calc.totals.tuboTotalComPerdas, unidade: 'm' },
    { item: 'BDI adotado', esperado: qaExpected.bdiAdotado, obtido: calc.bdiTotal, unidade: '%' },
    { item: 'Dias totais estimados', esperado: qaExpected.diasTotais, obtido: calc.totals.diasTotais, unidade: 'dias' },
    { item: 'TR-EG-01 - escavação', esperado: qaExpected.trEg01Escavacao, obtido: calc.trechoCalcs[0]?.volumeEscavacao ?? 0, unidade: 'm³' },
    { item: 'TR-EG-01 - escoramento', esperado: qaExpected.trEg01Escoramento, obtido: calc.trechoCalcs[0]?.areaEscoramento ?? 0, unidade: 'm²' },
    { item: 'TR-EG-01 - tubo com perdas', esperado: qaExpected.trEg01TuboPerdas, obtido: calc.trechoCalcs[0]?.tuboComPerdas ?? 0, unidade: 'm' },
  ].map((row) => ({ ...row, ok: Math.abs(row.esperado - row.obtido) < 0.02 }))

  const updateParam = (id: string, patch: Partial<ParamRow>) => setParams((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  const updateTrecho = (id: string, patch: Partial<TrechoRow>) => setTrechos((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  const updatePv = (id: string, patch: Partial<PvRow>) => setPvs((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  const updateAccessory = (id: string, patch: Partial<AccessoryRow>) => setAcessorios((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  const updateBdi = (id: string, patch: Partial<BdiComponent>) => setBdiComponents((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))
  const updateBase = (id: string, patch: Partial<BaseRef>) => setBaseRefs((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row))

  return (
    <div className="p-6 text-[#f5f5f5]">
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quantitativo Personalizado</h2>
          <p className="mt-1 max-w-4xl text-sm text-[#b8b8b8]">
            Substituto funcional da planilha Memorial Cálculo - Quantitativo V6, com entradas editáveis, cálculos automáticos, BDI composto, base de referência, levantamento detalhado e Curva ABC.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#333333] px-3 py-2 text-xs text-[#d4d4d4]">
          {isDemoMode ? 'Modo demonstração' : 'Dados salvos localmente'}
          <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Esgoto" value={`${decimal(calc.totals.extensaoEsgoto, 0)} m`} tone="text-[#38bdf8]" />
        <Kpi label="Água" value={`${decimal(calc.totals.extensaoAgua, 0)} m`} tone="text-[#4ade80]" />
        <Kpi label="Drenagem" value={`${decimal(calc.totals.extensaoDrenagem, 0)} m`} tone="text-[#fbbf24]" />
        <Kpi label="Escavação total" value={`${decimal(calc.totals.escavacaoTotal)} m³`} tone="text-[#f97316]" />
        <Kpi label="Total com BDI" value={brl(calc.totalComBdi)} tone="text-[#a78bfa]" />
      </div>

      <div className="mb-5 overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-lg border border-[#525252] bg-[#2f2f2f] p-1">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={cn(
                'rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                step === index ? 'text-white' : 'text-[#b8b8b8] hover:bg-[#3d3d3d] hover:text-white',
              )}
              style={step === index ? { backgroundColor: ACCENT } : undefined}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      {step === 0 && (
        <section className="space-y-4">
          <div className="rounded-lg border border-[#525252] bg-[#333333] p-5">
            <h3 className="mb-3 text-lg font-bold">Fluxo de uso</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['1. Parâmetros', 'Revise perdas, reaproveitamento, larguras, empolamento, PVs, produtividade e BDI.'],
                ['2. Entradas', 'Lance trechos, PVs e acessórios manuais por rede de esgoto, água ou drenagem.'],
                ['3. Cálculos', 'O sistema calcula quantitativos, materiais, produção e orçamento automaticamente.'],
                ['4. QA', 'Compare o cenário base com os números da planilha enviada no painel Resumo.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-lg border border-[#525252] bg-[#2f2f2f] p-4">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm text-[#b8b8b8]">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[#16a34a]/30 bg-[#16a34a]/10 p-4 text-sm text-[#d1fae5]">
            <CheckCircle2 size={16} className="mr-2 inline text-[#4ade80]" />
            O cenário inicial foi carregado com os mesmos exemplos da planilha: TR-EG-01, TR-AG-01, TR-DR-01, PV-01, PV-DR-01 e acessórios de drenagem.
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setParams((rows) => [...rows, { id: makeId('param'), parametro: 'Novo parâmetro', valor: 0, unidade: 'outro', comentario: '' }])} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
              <Plus size={15} /> Novo parâmetro
            </button>
          </div>
          <Table>
            <thead><tr>{['Parâmetro', 'Valor', 'Unidade', 'Comentário', ''].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
            <tbody>{params.map((row) => (
              <tr key={row.id}>
                <Td><SmallInput value={row.parametro} onChange={(value) => updateParam(row.id, { parametro: value })} className="min-w-[320px]" /></Td>
                <Td><SmallInput type="number" value={row.valor} onChange={(value) => updateParam(row.id, { valor: Number(value) })} /></Td>
                <Td><SmallSelect value={row.unidade} options={unitOptions} onChange={(value) => updateParam(row.id, { unidade: value })} /></Td>
                <Td><SmallInput value={row.comentario} onChange={(value) => updateParam(row.id, { comentario: value })} className="min-w-[300px]" /></Td>
                <Td><button type="button" onClick={() => setParams((rows) => rows.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
              </tr>
            ))}</tbody>
          </Table>
        </section>
      )}

      {step === 2 && (
        <section>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setTrechos((rows) => [...rows, { ...defaultTrechos[0], id: makeId('tr'), nome: `TR-${rows.length + 1}` }])} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
              <Plus size={15} /> Novo trecho
            </button>
          </div>
          <Table>
            <thead>
              <tr>{[
                'Trecho', 'Rede', 'Material tubo', 'DN nominal (mm)', 'DE externo (mm)', 'Comprimento (m)', 'Prof. inicial (m)', 'Prof. final (m)', 'Prof. média (m)', 'Largura auto (m)', 'Largura adotada (m)', 'Largura utilizada (m)', 'Tipo solo', 'Fator empolamento', 'Superfície', 'Largura recomposição (m)', 'Área seção vala (m²)', 'Vol. escavação (m³)', 'Escoramento?', 'Área escoramento (m²)', 'Esp. berço (m)', 'Vol. berço (m³)', 'Alt. envolvimento (m)', 'Vol. envolvimento (m³)', 'Vol. tubo deslocado (m³)', 'Vol. líquido a reaterrar (m³)', '% reaprov.', '% reaprov. usado', 'Reaterro reaprov. (m³)', 'Reaterro importado (m³)', 'Bota-fora in situ (m³)', 'Bota-fora empolado (m³)', 'Área recomp. total (m²)', 'Área asfalto (m²)', 'Área concreto (m²)', 'Área bloco (m²)', 'Vol. sub-base (m³)', 'Vol. revestimento (m³)', 'Tubo c/ perdas (m)', 'Teste / desinf. (m)', 'Observações', 'Fator compactação', 'Bota-fora compactado (m³)', 'Curvas auto', 'Tês auto', 'Registros auto', 'Ventosas auto', 'Dias escavação', 'Dias assentamento', 'Dias recomposição', 'Observação planejamento', 'Folga para futuras ampliações', '',
              ].map((head) => <Th key={head}>{head}</Th>)}</tr>
            </thead>
            <tbody>{trechos.map((row, index) => {
              const c = calc.trechoCalcs[index]
              return (
                <tr key={row.id}>
                  <Td><SmallInput value={row.nome} onChange={(value) => updateTrecho(row.id, { nome: value })} /></Td>
                  <Td><SmallSelect value={row.rede} options={redeOptions} onChange={(value) => updateTrecho(row.id, { rede: value })} /></Td>
                  <Td><SmallSelect value={row.material} options={materialOptions} onChange={(value) => updateTrecho(row.id, { material: value })} /></Td>
                  <Td><SmallInput type="number" value={row.dn} onChange={(value) => updateTrecho(row.id, { dn: Number(value) })} /></Td>
                  <Td><SmallInput type="number" value={row.de} onChange={(value) => updateTrecho(row.id, { de: Number(value) })} /></Td>
                  <Td><SmallInput type="number" value={row.comprimento} onChange={(value) => updateTrecho(row.id, { comprimento: Number(value) })} /></Td>
                  <Td><SmallInput type="number" value={row.profInicial} onChange={(value) => updateTrecho(row.id, { profInicial: Number(value) })} /></Td>
                  <Td><SmallInput type="number" value={row.profFinal} onChange={(value) => updateTrecho(row.id, { profFinal: Number(value) })} /></Td>
                  <Td right>{decimal(c.profMedia)}</Td>
                  <Td right>{decimal(c.larguraAuto)}</Td>
                  <Td><SmallInput type="number" value={row.larguraAdotada} onChange={(value) => updateTrecho(row.id, { larguraAdotada: value })} /></Td>
                  <Td right>{decimal(c.larguraUtilizada)}</Td>
                  <Td><SmallSelect value={row.solo} options={soloOptions} onChange={(value) => updateTrecho(row.id, { solo: value })} /></Td>
                  <Td right>{decimal(c.fatorEmpolamento)}</Td>
                  <Td><SmallSelect value={row.superficie} options={superficieOptions} onChange={(value) => updateTrecho(row.id, { superficie: value })} /></Td>
                  <Td><SmallInput type="number" value={row.larguraRecomposicao} onChange={(value) => updateTrecho(row.id, { larguraRecomposicao: value })} /></Td>
                  <Td right>{decimal(c.areaSecaoVala)}</Td>
                  <Td right>{decimal(c.volumeEscavacao)}</Td>
                  <Td>{c.escoramento}</Td>
                  <Td right>{decimal(c.areaEscoramento)}</Td>
                  <Td right>{decimal(c.espBerco)}</Td>
                  <Td right>{decimal(c.volumeBerco)}</Td>
                  <Td right>{decimal(c.alturaEnvolvimento)}</Td>
                  <Td right>{decimal(c.volumeEnvolvimento)}</Td>
                  <Td right>{decimal(c.volumeTubo)}</Td>
                  <Td right>{decimal(c.volumeLiquido)}</Td>
                  <Td><SmallInput type="number" value={row.reaproveitamento} onChange={(value) => updateTrecho(row.id, { reaproveitamento: value })} /></Td>
                  <Td right>{percent(c.reaproveitamentoUsado)}</Td>
                  <Td right>{decimal(c.reaterroReaproveitado)}</Td>
                  <Td right>{decimal(c.reaterroImportado)}</Td>
                  <Td right>{decimal(c.botaForaInSitu)}</Td>
                  <Td right>{decimal(c.botaForaEmpolado)}</Td>
                  <Td right>{decimal(c.areaRecompTotal)}</Td>
                  <Td right>{decimal(c.areaAsfalto)}</Td>
                  <Td right>{decimal(c.areaConcreto)}</Td>
                  <Td right>{decimal(c.areaBloco)}</Td>
                  <Td right>{decimal(c.volumeSubBase)}</Td>
                  <Td right>{decimal(c.volumeRevestimento)}</Td>
                  <Td right>{decimal(c.tuboComPerdas)}</Td>
                  <Td right>{decimal(c.testeDesinfeccao)}</Td>
                  <Td><SmallInput value={row.observacoes} onChange={(value) => updateTrecho(row.id, { observacoes: value })} className="min-w-[220px]" /></Td>
                  <Td right>{decimal(c.fatorCompactacao)}</Td>
                  <Td right>{decimal(c.botaForaCompactado)}</Td>
                  <Td right>{c.curvasAuto}</Td>
                  <Td right>{c.tesAuto}</Td>
                  <Td right>{c.registrosAuto}</Td>
                  <Td right>{c.ventosasAuto}</Td>
                  <Td right>{decimal(c.diasEscavacao, 2)}</Td>
                  <Td right>{decimal(c.diasAssentamento, 2)}</Td>
                  <Td right>{decimal(c.diasRecomposicao, 2)}</Td>
                  <Td><SmallInput value={row.observacaoPlanejamento} onChange={(value) => updateTrecho(row.id, { observacaoPlanejamento: value })} className="min-w-[220px]" /></Td>
                  <Td><SmallInput value={row.folgaAmpliacao} onChange={(value) => updateTrecho(row.id, { folgaAmpliacao: value })} className="min-w-[220px]" /></Td>
                  <Td><button type="button" onClick={() => setTrechos((rows) => rows.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
                </tr>
              )
            })}</tbody>
          </Table>
        </section>
      )}

      {step === 3 && (
        <section>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setPvs((rows) => [...rows, { ...defaultPvs[0], id: makeId('pv'), nome: `PV-${rows.length + 1}` }])} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
              <Plus size={15} /> Novo PV / Estrutura
            </button>
          </div>
          <Table>
            <thead><tr>{['PV / Estrutura', 'Tipo', 'Diâmetro interno (m)', 'Profundidade total (m)', 'Esp. parede (m)', 'Folga escav. (m)', 'Dimensão externa (m)', 'Lado escavação (m)', 'Vol. escavação (m³)', 'Esp. base (m)', 'Vol. base concreto (m³)', 'Altura útil parede (m)', 'Área parede / anéis (m²)', 'Nº tampões', 'Nº degraus', 'Vol. reaterro externo (m³)', 'Observações', 'Vol. paredes concreto (m³)', 'Área de forma (m²)', 'Armadura estimada (kg)', 'Dias execução PV', ''].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
            <tbody>{pvs.map((row, index) => {
              const c = calc.pvCalcs[index]
              return (
                <tr key={row.id}>
                  <Td><SmallInput value={row.nome} onChange={(value) => updatePv(row.id, { nome: value })} /></Td>
                  <Td><SmallSelect value={row.tipo} options={pvOptions} onChange={(value) => updatePv(row.id, { tipo: value })} /></Td>
                  <Td><SmallInput type="number" value={row.diametroInterno} onChange={(value) => updatePv(row.id, { diametroInterno: Number(value) })} /></Td>
                  <Td><SmallInput type="number" value={row.profundidadeTotal} onChange={(value) => updatePv(row.id, { profundidadeTotal: Number(value) })} /></Td>
                  <Td right>{decimal(c.espParede)}</Td>
                  <Td right>{decimal(c.folgaEscavacao)}</Td>
                  <Td right>{decimal(c.dimensaoExterna)}</Td>
                  <Td right>{decimal(c.ladoEscavacao)}</Td>
                  <Td right>{decimal(c.volumeEscavacao)}</Td>
                  <Td right>{decimal(c.espBase)}</Td>
                  <Td right>{decimal(c.volumeBase)}</Td>
                  <Td right>{decimal(c.alturaUtilParede)}</Td>
                  <Td right>{decimal(c.areaParede)}</Td>
                  <Td right>{c.tampoes}</Td>
                  <Td right>{c.degraus}</Td>
                  <Td right>{decimal(c.volumeReaterroExterno)}</Td>
                  <Td><SmallInput value={row.observacoes} onChange={(value) => updatePv(row.id, { observacoes: value })} className="min-w-[240px]" /></Td>
                  <Td right>{decimal(c.volumeParedesConcreto)}</Td>
                  <Td right>{decimal(c.areaForma)}</Td>
                  <Td right>{decimal(c.armadura)}</Td>
                  <Td right>{decimal(c.diasExecucao, 0)}</Td>
                  <Td><button type="button" onClick={() => setPvs((rows) => rows.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
                </tr>
              )
            })}</tbody>
          </Table>
        </section>
      )}

      {step === 4 && (
        <EditableAccessories rows={acessorios} updateRow={updateAccessory} setRows={setAcessorios} />
      )}

      {step === 5 && <DataTable rows={calc.producao} headers={['Grupo', 'Serviço', 'Unid.', 'Quantidade', 'Produtividade', 'Nº equipes', 'Dias estimados']} />}
      {step === 6 && <DataTable rows={calc.quantitativos} headers={['Grupo', 'Descrição', 'Unid.', 'Quantidade', 'Critério']} />}
      {step === 7 && <DataTable rows={calc.materiais} headers={['Grupo', 'Rede', 'Material', 'DN (mm)', 'Descrição', 'Unid.', 'Quantidade']} />}
      {step === 8 && <DataTable rows={calc.orcamento} headers={['Grupo', 'Código ref.', 'Descrição', 'Unid.', 'Quantidade']} moneyKeys={[]} />}

      {step === 9 && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Custo direto total" value={brl(calc.custoDiretoTotal)} tone="text-[#38bdf8]" />
            <Kpi label="Total com BDI" value={brl(calc.totalComBdi)} tone="text-[#4ade80]" />
            <Kpi label="BDI adotado" value={percent(calc.bdiTotal)} tone="text-[#fbbf24]" />
            <Kpi label="Dias estimados" value={decimal(calc.totals.diasTotais, 2)} tone="text-[#a78bfa]" />
          </div>
          <DataTable rows={calc.resumo} headers={['Indicador', 'Unid.', 'Valor', 'Observação']} moneyKeys={['valor']} />
          <div>
            <h3 className="mb-3 text-lg font-bold">QA do cenário inicial</h3>
            <Table>
              <thead><tr>{['Item', 'Esperado', 'Obtido', 'Unidade', 'Status'].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
              <tbody>{qaRows.map((row) => (
                <tr key={row.item}>
                  <Td>{row.item}</Td>
                  <Td right>{decimal(row.esperado, row.unidade === '%' ? 1 : 2)}</Td>
                  <Td right>{decimal(row.obtido, row.unidade === '%' ? 1 : 2)}</Td>
                  <Td>{row.unidade}</Td>
                  <Td><span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold', row.ok ? 'bg-[#16a34a]/15 text-[#4ade80]' : 'bg-[#dc2626]/15 text-[#f87171]')}>{row.ok ? 'OK' : 'Revisar'}</span></Td>
                </tr>
              ))}</tbody>
            </Table>
          </div>
        </section>
      )}

      {step === 10 && (
        <section className="space-y-4">
          <div className="rounded-lg border border-[#525252] bg-[#333333] p-4">
            <p className="text-lg font-bold">BDI total adotado: <span className="text-[#fbbf24]">{percent(calc.bdiTotal)}</span></p>
            <p className="mt-1 text-sm text-[#b8b8b8]">O orçamento detalhado aplica a soma dos componentes sobre o custo direto, como na aba BDI_E_INDIRETOS da planilha.</p>
          </div>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setBdiComponents((rows) => [...rows, { id: makeId('bdi'), componente: 'Novo componente', percentual: 0, aplicacao: 'Sobre custo direto', observacao: '' }])} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
              <Plus size={15} /> Novo componente
            </button>
          </div>
          <Table>
            <thead><tr>{['Componente', 'Percentual', 'Aplicação', 'Observação', ''].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
            <tbody>{bdiComponents.map((row) => (
              <tr key={row.id}>
                <Td><SmallInput value={row.componente} onChange={(value) => updateBdi(row.id, { componente: value })} className="min-w-[260px]" /></Td>
                <Td><SmallInput type="number" value={row.percentual} onChange={(value) => updateBdi(row.id, { percentual: Number(value) })} /></Td>
                <Td><SmallInput value={row.aplicacao} onChange={(value) => updateBdi(row.id, { aplicacao: value })} className="min-w-[200px]" /></Td>
                <Td><SmallInput value={row.observacao} onChange={(value) => updateBdi(row.id, { observacao: value })} className="min-w-[240px]" /></Td>
                <Td><button type="button" onClick={() => setBdiComponents((rows) => rows.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
              </tr>
            ))}</tbody>
          </Table>
        </section>
      )}

      {step === 11 && (
        <section className="space-y-4">
          <div className="rounded-lg border border-[#ca8a04]/40 bg-[#ca8a04]/10 p-4 text-sm text-[#fbbf24]">
            <AlertTriangle size={16} className="mr-2 inline" />
            Base editável equivalente à BASE_SINAPI da planilha. Os valores são referências iniciais locais; substitua por valores oficiais importados quando necessário.
          </div>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setBaseRefs((rows) => [...rows, { id: makeId('base'), codigo: 'NOVO', grupo: 'Manual', subgrupo: 'Manual', item: 'Novo item', unidade: 'un', precoRef: 0, fonte: 'Manual', observacao: '' }])} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
              <Database size={15} /> Novo item de base
            </button>
          </div>
          <Table>
            <thead><tr>{['Código ref.', 'Grupo', 'Subgrupo', 'Item', 'Unid.', 'Preço ref. (R$)', 'Fonte', 'Observação', ''].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
            <tbody>{baseRefs.map((row) => (
              <tr key={row.id}>
                <Td><SmallInput value={row.codigo} onChange={(value) => updateBase(row.id, { codigo: value })} /></Td>
                <Td><SmallInput value={row.grupo} onChange={(value) => updateBase(row.id, { grupo: value })} className="min-w-[220px]" /></Td>
                <Td><SmallInput value={row.subgrupo} onChange={(value) => updateBase(row.id, { subgrupo: value })} className="min-w-[180px]" /></Td>
                <Td><SmallInput value={row.item} onChange={(value) => updateBase(row.id, { item: value })} className="min-w-[320px]" /></Td>
                <Td><SmallInput value={row.unidade} onChange={(value) => updateBase(row.id, { unidade: value })} /></Td>
                <Td><SmallInput type="number" value={row.precoRef} onChange={(value) => updateBase(row.id, { precoRef: Number(value) })} /></Td>
                <Td><SmallInput value={row.fonte} onChange={(value) => updateBase(row.id, { fonte: value })} className="min-w-[180px]" /></Td>
                <Td><SmallInput value={row.observacao} onChange={(value) => updateBase(row.id, { observacao: value })} className="min-w-[260px]" /></Td>
                <Td><button type="button" onClick={() => setBaseRefs((rows) => rows.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
              </tr>
            ))}</tbody>
          </Table>
        </section>
      )}

      {step === 12 && <LevantamentoTable rows={calc.levantamento} total={calc.totalComBdi} />}
      {step === 13 && <AbcTable rows={calc.curvaAbc} total={calc.totalComBdi} />}

      <div className="mt-5 flex items-center justify-between border-t border-[#525252] pt-4">
        <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} className="rounded-lg border border-[#525252] px-4 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#333333]">Anterior</button>
        <span className="text-xs text-[#b8b8b8]">Etapa {step + 1} de {steps.length} - {steps[step]}</span>
        <button type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>Próxima</button>
      </div>
    </div>
  )
}

function EditableAccessories({ rows, updateRow, setRows }: { rows: AccessoryRow[]; updateRow: (id: string, patch: Partial<AccessoryRow>) => void; setRows: Dispatch<SetStateAction<AccessoryRow[]>> }) {
  return (
    <section>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => setRows((current) => [...current, { id: makeId('ac'), rede: 'Água', item: '', unidade: 'un', quantidade: 0, codigoRef: '', observacoes: '' }])} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
          <Plus size={15} /> Novo acessório
        </button>
      </div>
      <Table>
        <thead><tr>{['Rede', 'Item', 'Unid.', 'Quantidade', 'Código ref.', 'Observações', ''].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <Td><SmallSelect value={row.rede} options={redeOptions} onChange={(value) => updateRow(row.id, { rede: value })} /></Td>
            <Td><SmallInput value={row.item} onChange={(value) => updateRow(row.id, { item: value })} className="min-w-[240px]" /></Td>
            <Td><SmallInput value={row.unidade} onChange={(value) => updateRow(row.id, { unidade: value })} /></Td>
            <Td><SmallInput type="number" value={row.quantidade} onChange={(value) => updateRow(row.id, { quantidade: Number(value) })} /></Td>
            <Td><SmallInput value={row.codigoRef} onChange={(value) => updateRow(row.id, { codigoRef: value })} /></Td>
            <Td><SmallInput value={row.observacoes} onChange={(value) => updateRow(row.id, { observacoes: value })} className="min-w-[260px]" /></Td>
            <Td><button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]"><Trash2 size={14} /></button></Td>
          </tr>
        ))}</tbody>
      </Table>
    </section>
  )
}

function DataTable({ rows, headers, moneyKeys = [] }: { rows: object[]; headers: string[]; moneyKeys?: string[] }) {
  const keys = Object.keys(rows[0] ?? {})
  return (
    <Table>
      <thead><tr>{headers.map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => {
          const record = row as Record<string, unknown>
          return (
          <tr key={String(record.id ?? record.descricao ?? record.item ?? index)}>
            {keys.map((key) => {
              const value = record[key]
              const numeric = typeof value === 'number'
              const display = numeric ? (moneyKeys.includes(key) ? brl(value) : decimal(value)) : String(value ?? '')
              return <Td key={key} right={numeric}>{display}</Td>
            })}
          </tr>
        )})}
        {rows.length === 0 && <tr><Td>Nenhum dado cadastrado.</Td></tr>}
      </tbody>
    </Table>
  )
}

function LevantamentoTable({ rows, total }: { rows: ReturnType<typeof calculatePersonalizado>['levantamento']; total: number }) {
  return (
    <section>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Kpi label="Custo direto" value={brl(rows.reduce((acc, row) => acc + row.custoDireto, 0))} tone="text-[#38bdf8]" />
        <Kpi label="Total com BDI" value={brl(total)} tone="text-[#4ade80]" />
        <Kpi label="Itens detalhados" value={rows.length} tone="text-[#a78bfa]" />
      </div>
      <Table>
        <thead><tr>{['Seção', 'Subgrupo', 'Item', 'Unid.', 'Origem', 'Quantidade', 'Código ref.', 'PU direto', 'Custo direto', 'BDI', 'PU c/ BDI', 'Total c/ BDI', 'Participação', 'Fonte', 'Situação'].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <Td>{row.secao}</Td><Td>{row.subgrupo}</Td><Td>{row.descricao}</Td><Td>{row.unidade}</Td><Td>{row.origem}</Td>
            <Td right>{decimal(row.quantidade)}</Td><Td>{row.codigoRef}</Td><Td right>{brl(row.puDireto)}</Td><Td right>{brl(row.custoDireto)}</Td>
            <Td right>{percent(row.bdi)}</Td><Td right>{brl(row.puBdi)}</Td><Td right>{brl(row.totalBdi)}</Td><Td right>{percent(row.participacao)}</Td><Td>{row.fonte}</Td><Td>{row.situacao}</Td>
          </tr>
        ))}</tbody>
      </Table>
    </section>
  )
}

function AbcTable({ rows, total }: { rows: ReturnType<typeof calculatePersonalizado>['curvaAbc']; total: number }) {
  return (
    <section>
      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        <Kpi label="Total" value={brl(total)} tone="text-[#4ade80]" />
        <Kpi label="Classe A" value={brl(rows.filter((row) => row.classe === 'A').reduce((sum, row) => sum + row.totalBdi, 0))} tone="text-[#f87171]" />
        <Kpi label="Classe B" value={brl(rows.filter((row) => row.classe === 'B').reduce((sum, row) => sum + row.totalBdi, 0))} tone="text-[#fbbf24]" />
        <Kpi label="Classe C" value={brl(rows.filter((row) => row.classe === 'C').reduce((sum, row) => sum + row.totalBdi, 0))} tone="text-[#a3a3a3]" />
      </div>
      <Table>
        <thead><tr>{['Item', 'Unid.', 'Quantidade', 'Código', 'PU c/ BDI', 'Total c/ BDI', '% Part.', '% Acum.', 'Classe'].map((head) => <Th key={head}>{head}</Th>)}</tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <Td>{row.descricao}</Td><Td>{row.unidade}</Td><Td right>{decimal(row.quantidade)}</Td><Td>{row.codigoRef}</Td>
            <Td right>{brl(row.puBdi)}</Td><Td right>{brl(row.totalBdi)}</Td><Td right>{percent(row.participacao)}</Td><Td right>{percent(row.acumulado)}</Td><Td>{row.classe}</Td>
          </tr>
        ))}</tbody>
      </Table>
    </section>
  )
}
