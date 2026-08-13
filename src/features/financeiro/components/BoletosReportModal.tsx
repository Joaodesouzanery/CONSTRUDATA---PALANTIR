/**
 * BoletosReportModal — opções de exportação da aba "Boletos" (PDF em A4 ou planilha).
 *
 * Recebe os boletos JÁ filtrados pelo painel (tipo/obra/busca) e acrescenta os dois recortes
 * que o painel não tem e sem os quais o documento não serve: **período de vencimento** (senão
 * imprime o carnê inteiro até 2028) e **situação** — é o que separa "o que preciso pagar" de
 * "prestação de contas".
 *
 * O período recorta PARCELAS, não boletos: o boleto entra se tiver ao menos uma parcela na
 * janela, e a ficha mostra só as parcelas dessa janela. Assim o total do topo sempre fecha
 * com o corpo do documento.
 */
import { useMemo, useState } from 'react'
import { X, FileDown, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useCompanySettingsStore } from '@/store/companySettingsStore'
import { getSignedUrl } from '@/lib/storage'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { cn, fmtDataBR } from '@/lib/utils'
import { catLabel } from '../lib/financeiroCalc'
import { digitosDe } from '../utils/boletoCodigo'
import { signedBoletoUrl } from '../utils/boletoStorage'
import {
  openReportWindow, printBoletosReportInto, printViaIframe,
  type BoletoReportItem, type BoletoReportAnexo, type BoletosReportData, type BoletosReportSections,
} from '../utils/boletosReportExport'
import { exportBoletosXlsx } from '../utils/boletosXlsxExport'
import type { FinanceiroTitulo, TituloTipo } from '@/types'

interface BoletoGroup { boletoId: string; parcelas: FinanceiroTitulo[]; head: FinanceiroTitulo }

const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#f97316]/60'
const labelCls = 'block text-[10px] text-[#6b6b6b] uppercase mb-1'

type Situacao = 'todas' | 'aberto' | 'pagas'

const SECOES: { key: keyof BoletosReportSections; label: string; hint: string }[] = [
  { key: 'agenda',       label: 'Agenda de vencimentos', hint: 'parcelas por mês, com subtotal' },
  { key: 'fichas',       label: 'Ficha por boleto',      hint: 'parcelas, situação e pagamento' },
  { key: 'codigos',      label: 'Linhas digitáveis',     hint: 'o código de cada parcela' },
  { key: 'concentracao', label: 'Concentração',          hint: 'top beneficiários em aberto' },
  { key: 'fotos',        label: 'Fotos anexadas',        hint: 'página final de comprovação' },
  { key: 'assinaturas',  label: 'Assinaturas',           hint: 'elaborado / conferido / aprovado' },
]

/** Primeiro e último dia do mês corrente, em yyyy-MM-dd. */
function mesCorrente(hoje: string): [string, string] {
  const [a, m] = hoje.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return [`${hoje.slice(0, 7)}-01`, `${hoje.slice(0, 7)}-${String(ultimo).padStart(2, '0')}`]
}
function somaDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Resolve o logo da empresa: base64 (legado) ou o arquivo no bucket. Sem logo, o relatório usa a marca ConstruData. */
async function resolverLogo(): Promise<string | null> {
  const { logos } = useCompanySettingsStore.getState()
  const l = logos[0]
  if (!l) return null
  if (l.base64) return l.base64
  if (!l.storagePath) return null
  try {
    const url = await getSignedUrl('project-documents', l.storagePath, 3600)
    if (!url) return null
    const blob = await (await fetch(url)).blob()
    return await new Promise<string | null>((res) => {
      const fr = new FileReader()
      fr.onload = () => res(typeof fr.result === 'string' ? fr.result : null)
      fr.onerror = () => res(null)
      fr.readAsDataURL(blob)
    })
  } catch { return null }
}

/**
 * Baixa um anexo e reduz para caber no documento. Uma foto de celular tem ~4 MB; embutida
 * em base64 num HTML de 30 páginas, trava a impressão. 1100 px chega a ~150 kB e continua
 * legível no papel.
 */
async function anexoParaDataUrl(path: string, nome: string): Promise<BoletoReportAnexo> {
  const falha: BoletoReportAnexo = { nome, dataUrl: null }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const url = await signedBoletoUrl(path)          // null em modo Demo
    if (!url) return falha
    const ctrl = new AbortController()
    // O timer só é desarmado depois de LER O CORPO: `fetch` resolve nos cabeçalhos, então
    // cancelar antes deixaria um download travado pendurado para sempre.
    timer = setTimeout(() => ctrl.abort(), 15_000)
    const res = await fetch(url, { signal: ctrl.signal })
    const blob = await res.blob()
    clearTimeout(timer)
    if (!blob.type.startsWith('image/')) return falha   // PDF anexado: vira contagem, não imagem
    const bmp = await createImageBitmap(blob)
    const k = Math.min(1, 1100 / Math.max(bmp.width, bmp.height))
    const cv = document.createElement('canvas')
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k)
    cv.getContext('2d')?.drawImage(bmp, 0, 0, cv.width, cv.height)
    bmp.close()
    return { nome, dataUrl: cv.toDataURL('image/jpeg', 0.82) }
  } catch { return falha } finally { clearTimeout(timer) }
}

/**
 * Timestamp ISO (UTC) → `yyyy-MM-dd` no fuso LOCAL. Fatiar a string daria a data UTC: um
 * boleto cadastrado às 21:30 no BRT sairia impresso com a data do dia seguinte.
 */
function dataLocalDe(iso?: string): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BoletosReportModal({ boletos, siteName, hoje, recorteTela, onClose }: {
  boletos: BoletoGroup[]
  siteName: (id?: string) => string
  hoje: string
  recorteTela: { fTipo: '' | TituloTipo; fObra: string; busca: string }
  onClose: () => void
}) {
  const profile = useAuth((s) => s.profile)
  const memberships = useAuth((s) => s.memberships)
  const companyName = useCompanySettingsStore((s) => s.companyName)
  // Mesmo predicado que `signedBoletoUrl` consulta para recusar o Storage: assim a marca
  // d'água e o bloqueio das fotos concordam sempre com o que o anexo realmente vai fazer.
  // (`getActiveOrganizationEnvironment` só olha o ambiente da org e ignora o botão Demo da barra lateral.)
  const demo = isNonProductionDataMode()

  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('todas')
  const [secoes, setSecoes] = useState<BoletosReportSections>({
    agenda: true, fichas: true, codigos: true, concentracao: true, fotos: false, assinaturas: false,
  })
  const [gerando, setGerando] = useState<'pdf' | 'xlsx' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  /**
   * Boletos recortados por período e situação, no formato que o gerador consome. Guarda o
   * grupo de origem ao lado do item para poder resolver as fotos depois sem casar por nome.
   */
  const pares = useMemo(() => {
    const dentro = (p: FinanceiroTitulo) => {
      if (de && p.vencimento < de) return false
      if (ate && p.vencimento > ate) return false
      if (situacao === 'aberto' && p.status === 'pago') return false
      if (situacao === 'pagas' && p.status !== 'pago') return false
      return true
    }
    return boletos
      .map((g) => ({
        g,
        item: {
          tipo: g.head.tipo,
          descricao: g.head.descricao,
          parceiro: g.head.parceiro,
          obraLabel: g.head.obraId ? siteName(g.head.obraId) : 'Sem obra',
          categoriaLabel: g.head.categoria ? catLabel(g.head.categoria) : undefined,
          notas: g.head.notas,
          criadoEm: dataLocalDe(g.head.createdAt),
          parcelas: g.parcelas.filter(dentro).map((p) => ({
            num: p.parcelaNum, de: p.parcelaDe,
            vencimento: p.vencimento, valor: p.valor, status: p.status,
            dataPagamento: p.dataPagamento, codigo: digitosDe(p.codigoBoleto),
          })),
          parcelasTotais: g.parcelas.length,
          anexos: (g.head.anexos ?? []).map((a) => ({ nome: a.nome, dataUrl: null })),
        } satisfies BoletoReportItem,
      }))
      .filter(({ item }) => item.parcelas.length > 0)
  }, [boletos, siteName, de, ate, situacao])

  const itens = useMemo(() => pares.map((p) => p.item), [pares])

  const totParcelas = itens.reduce((s, i) => s + i.parcelas.length, 0)
  const totAnexos = itens.reduce((s, i) => s + i.anexos.length, 0)
  const pesado = totParcelas > 400 || (secoes.fotos && totAnexos > 20)

  /** O recorte por extenso — é o que torna o documento defensável numa prestação de contas. */
  const recorte = useMemo(() => {
    const r: string[] = []
    if (recorteTela.fTipo) r.push(`Tipo: ${recorteTela.fTipo === 'pagar' ? 'A pagar' : 'A receber'}`)
    r.push(`Obra: ${recorteTela.fObra ? siteName(recorteTela.fObra) : 'todas'}`)
    if (recorteTela.busca.trim()) r.push(`Busca: "${recorteTela.busca.trim()}"`)
    r.push(de || ate
      ? `Vencimentos: ${de ? fmtDataBR(de) : 'início'} a ${ate ? fmtDataBR(ate) : 'sem limite'}`
      : 'Vencimentos: todos')
    r.push(`Situação: ${situacao === 'todas' ? 'todas' : situacao === 'aberto' ? 'só em aberto' : 'só pagas'}`)
    return r
  }, [recorteTela, siteName, de, ate, situacao])

  function montarData(itensFinais: BoletoReportItem[], logoDataUrl: string | null): BoletosReportData {
    const org = memberships.find((m) => m.organization_id === profile?.organization_id)
    return {
      empresa: companyName,
      organizacao: org?.organization?.name,
      obraLabel: recorteTela.fObra ? siteName(recorteTela.fObra) : 'Todas as obras',
      emitidoPor: profile?.full_name ?? profile?.email ?? undefined,
      demo,
      logoDataUrl,
      hoje,
      recorte,
      itens: itensFinais,
      secoes,
    }
  }

  async function gerarPdf() {
    setErro(null); setGerando('pdf')
    // A janela precisa abrir AGORA, no gesto do clique: depois de um await o browser bloqueia.
    const win = openReportWindow()
    try {
      const [logo, comAnexos] = await Promise.all([
        resolverLogo(),
        secoes.fotos ? resolverAnexos() : Promise.resolve(itens),
      ])
      const data = montarData(comAnexos, logo)
      if (win && !win.closed) await printBoletosReportInto(win, data)
      else await printViaIframe(data)   // pop-up bloqueado (ou janela fechada): imprime sem aba
    } catch (e) {
      win?.close()
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.')
      return
    } finally { setGerando(null) }
    onClose()
  }

  /** Resolve as fotos de todos os boletos em paralelo; as que falharem viram contagem no PDF. */
  async function resolverAnexos(): Promise<BoletoReportItem[]> {
    return Promise.all(pares.map(async ({ g, item }) => ({
      ...item,
      anexos: await Promise.all((g.head.anexos ?? []).map((a) => anexoParaDataUrl(a.path, a.nome))),
    })))
  }

  function gerarXlsx() {
    setErro(null); setGerando('xlsx')
    try { exportBoletosXlsx(itens, hoje) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível gerar a planilha.'); return }
    finally { setGerando(null) }
    onClose()
  }

  const [mesDe, mesAte] = mesCorrente(hoje)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg space-y-4 overflow-auto rounded-xl border border-[#525252] bg-[#2c2c2c] p-5 max-h-[90vh]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Exportar boletos</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
        </div>

        <div>
          <label className={labelCls}>Período de vencimento</label>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} title="De" />
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} title="Até" />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setDe(mesDe); setAte(mesAte) }} className="text-[10px] text-[#a3a3a3] hover:text-[#f97316]">este mês</button>
            <button type="button" onClick={() => { setDe(hoje); setAte(somaDias(hoje, 30)) }} className="text-[10px] text-[#a3a3a3] hover:text-[#f97316]">próximos 30 dias</button>
            <button type="button" onClick={() => { setDe(''); setAte('') }} className="text-[10px] text-[#a3a3a3] hover:text-[#f97316]">limpar</button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Situação</label>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#525252]">
            {([['todas', 'Todas'], ['aberto', 'Só em aberto'], ['pagas', 'Só pagas']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setSituacao(k)}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
                  situacao === k ? 'bg-[#f97316] text-white' : 'bg-[#2c2c2c] text-[#a3a3a3] hover:text-white')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Seções do relatório (PDF)</label>
          <div className="grid grid-cols-2 gap-1.5">
            {SECOES.map((s) => {
              const desabilitada = s.key === 'fotos' && (demo || totAnexos === 0)
              return (
                <label key={s.key}
                  title={desabilitada ? (demo ? 'Indisponível no modo Demonstração' : 'Nenhum boleto do recorte tem foto') : s.hint}
                  className={cn('flex cursor-pointer items-start gap-2 rounded-lg border border-[#525252] bg-[#333333] px-2.5 py-2',
                    desabilitada && 'cursor-not-allowed opacity-40')}>
                  <input type="checkbox" checked={secoes[s.key] && !desabilitada} disabled={desabilitada}
                    onChange={(e) => setSecoes((v) => ({ ...v, [s.key]: e.target.checked }))}
                    className="mt-0.5 accent-[#f97316]" />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium text-white">{s.label}</span>
                    <span className="block text-[9px] leading-tight text-[#6b6b6b]">{s.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <p className="rounded-lg border border-[#525252] bg-[#252525] px-3 py-2 text-[11px] text-[#a3a3a3]">
          <strong className="text-white">{itens.length}</strong> boleto(s) · <strong className="text-white">{totParcelas}</strong> parcela(s)
          {totAnexos > 0 && <> · {totAnexos} anexo(s)</>}
          {pesado && <span className="mt-1 block text-amber-400">Recorte grande: o documento vai ficar longo e pode demorar a montar.</span>}
          {itens.length === 0 && <span className="mt-1 block text-amber-400">Nada no recorte — ajuste o período ou a situação.</span>}
        </p>

        {erro && <p className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-[11px] text-red-300">{erro}</p>}

        <div className="flex gap-2">
          <button onClick={() => void gerarPdf()} disabled={itens.length === 0 || gerando !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#f97316] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:opacity-50">
            {gerando === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Exportar PDF
          </button>
          <button onClick={gerarXlsx} disabled={itens.length === 0 || gerando !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#525252] bg-[#333333] px-4 py-2.5 text-xs font-semibold text-[#e5e5e5] transition-colors hover:border-[#f97316]/50 hover:text-[#f97316] disabled:opacity-50">
            {gerando === 'xlsx' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
          </button>
        </div>
      </div>
    </div>
  )
}
