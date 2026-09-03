/**
 * Importar uma nota fiscal a partir da foto.
 *
 * ─── A ORDEM DA TELA É DELIBERADA ─────────────────────────────────────────────
 * Primeiro o que é CERTO, depois o que é PROPOSTA, e o botão só acende quando não
 * há impedimento. É a mesma disciplina do `ImportarCaixaModal`: a tela não
 * pergunta "importar?", ela responde **o que muda se eu gravar isto**.
 *
 *   1. a foto            — `capture="environment"` abre a câmera do celular
 *   2. o QR              — automático, e é o único passo que produz certeza
 *   3. o valor           — botão explícito, porque OCR custa download e erra
 *   4. a classificação   — sugerida pelo histórico do mesmo CNPJ, nunca aplicada calada
 *   5. a conferência     — situação, diff e impedimentos, antes de gravar
 *
 * ⚠️ **Não existe scanner de QR ao vivo, e não é esquecimento.** O `vercel.json`
 * manda `Permissions-Policy: camera=()`, então `getUserMedia()` está bloqueado em
 * produção. `capture="environment"` funciona porque delega ao app de câmera do
 * sistema. Quem for "melhorar" isto com um scanner vai descobrir em produção.
 *
 * ⚠️ **O QR é lido da imagem ORIGINAL, não da comprimida.** O `compressImage` é
 * para o armazenamento; a 1400px, num cupom inteiro, os módulos do QR podem não
 * fechar. A ordem é: ler o QR → comprimir → subir.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, Loader2, ScanLine, Sparkles, X } from 'lucide-react'
import type { NotaFiscal, SaidaCategoria } from '@/types'
import { SAIDA_CAT_LABELS, SAIDA_CATS, fmtBRL } from '@/features/financeiro/lib/financeiroCalc'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useEnvioUnico } from '@/hooks/useEnvioUnico'
import { compressImageToBlob } from '@/lib/imageCompression'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { formatarChave, lerChaveNfe, type ChaveNfe } from '../utils/chaveNfe'
import { lerQrDaImagem } from '../utils/lerQrDaImagem'
import { leitorLocal } from '../utils/ocrCupom'
import { uploadNotaFile } from '../utils/notaFiscalStorage'
import {
  conferirNota, notaDoRascunho, podeGravar, ROTULO_SITUACAO_NOTA,
  type RascunhoDeNota,
} from '../utils/notaFiscalConferencia'
import { etiquetasUsadas, normalizarEtiqueta, sugerirClassificacao } from '../utils/categoriaAprendida'

const INPUT = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]/60'
const LABEL = 'block text-[10px] text-[#6b6b6b] uppercase tracking-wide mb-1'
const BTN_P = 'px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const BTN_S = 'px-3 py-2 rounded-lg border border-[#525252] bg-[#2c2c2c] text-xs font-semibold text-[#e5e5e5] hover:border-[#f97316]/50 hover:text-[#f97316] transition-colors disabled:opacity-40'

/** Mesma paleta do `ImportarCaixaModal`, para as duas importações se lerem igual. */
const COR_SITUACAO: Record<string, string> = {
  'nova': 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  'valor-alterado': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  'ja-arquivada': 'border-[#525252] bg-[#2c2c2c] text-[#a3a3a3]',
  'ja-lancada': 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  'duplicada-no-lote': 'border-red-500/40 bg-red-500/10 text-red-300',
}

interface Props {
  notas: NotaFiscal[]
  orgId: string | null | undefined
  onSalvar: (nota: NotaFiscal) => void
  onClose: () => void
}

export function ImportarNotaModal({ notas, orgId, onSalvar, onClose }: Props) {
  const sites = useTorreStore((s) => s.sites)
  const travar = useEnvioUnico()

  const [foto, setFoto] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [lendoQr, setLendoQr] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [avisoQr, setAvisoQr] = useState<string | null>(null)

  const [chaveDigitada, setChaveDigitada] = useState('')
  const [chave, setChave] = useState<ChaveNfe | null>(null)

  const [valor, setValor] = useState('')
  const [emitente, setEmitente] = useState('')
  const [categoria, setCategoria] = useState<SaidaCategoria | ''>('')
  const [etiqueta, setEtiqueta] = useState('')
  const [obraId, setObraId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [tributos, setTributos] = useState('')
  const [salvando, setSalvando] = useState(false)

  /** O OCR é opcional e explícito — a aba funciona inteira sem ele. */
  const [lendoValor, setLendoValor] = useState(false)
  const [ocrBruto, setOcrBruto] = useState<string | null>(null)
  const [ocrAvisos, setOcrAvisos] = useState<string[]>([])
  const [valorOrigem, setValorOrigem] = useState<'manual' | 'ocr'>('manual')

  /** O caminho já enviado ao bucket nesta sessão — apagado se fechar sem salvar. */
  const enviadoRef = useRef<string | null>(null)

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])

  const sugestao = useMemo(
    () => (chave ? sugerirClassificacao(chave.cnpj, notas) : null),
    [chave, notas],
  )

  // A sugestão preenche o que ainda está vazio — nunca sobrescreve escolha de gente.
  useEffect(() => {
    if (!sugestao) return
    setCategoria((c) => c || sugestao.categoria)
    setEtiqueta((e) => e || sugestao.etiqueta || '')
  }, [sugestao])

  // O emitente conhecido também vem do histórico: já foi digitado uma vez.
  useEffect(() => {
    if (!chave || emitente) return
    const anterior = notas.find((n) => n.cnpjEmitente === chave.cnpj && n.emitente)
    if (anterior?.emitente) setEmitente(anterior.emitente)
  }, [chave, notas, emitente])

  const valorNumero = useMemo(() => {
    const limpo = valor.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
    const n = Number(limpo)
    return valor.trim() && Number.isFinite(n) ? n : null
  }, [valor])

  const rascunho: RascunhoDeNota = useMemo(() => ({
    chave: chave?.chave ?? chaveDigitada,
    valor: valorNumero,
    valorOrigem,
    valorLidoBruto: ocrBruto ?? undefined,
    tributosBRL: Number(tributos.replace(',', '.')) || undefined,
    emitente,
    dataEmissao: undefined,
    categoria: categoria || undefined,
    etiqueta: etiqueta ? normalizarEtiqueta(etiqueta) : undefined,
    obraId: obraId || undefined,
    notas: observacao,
    fotoPath: enviadoRef.current ?? undefined,
  }), [chave, chaveDigitada, valorNumero, valorOrigem, ocrBruto, tributos, emitente, categoria, etiqueta, obraId, observacao])

  const conferencia = useMemo(
    () => conferirNota(rascunho, { orgId, existentes: notas }),
    [rascunho, orgId, notas],
  )

  async function escolherFoto(file: File) {
    setErro(null)
    setAvisoQr(null)
    setFoto(file)
    if (previa) URL.revokeObjectURL(previa)
    setPrevia(URL.createObjectURL(file))
    setLendoQr(true)
    try {
      const achado = await lerQrDaImagem(file)
      if (!achado) {
        setAvisoQr('Não achei o QR Code nesta foto. Enquadre o rodapé do cupom, com luz e sem dobrar o papel — ou digite os 44 dígitos abaixo.')
      } else if (!achado.chaves.length) {
        setAvisoQr('Achei um QR Code, mas ele não é de nota fiscal (pode ser Pix, cardápio ou wi-fi). Digite os 44 dígitos abaixo.')
      } else {
        const r = lerChaveNfe(achado.chaves[0])
        if (r.ok) {
          setChave(r.dados)
          setChaveDigitada(r.dados.chave)
          if (r.avisos.length) setAvisoQr(r.avisos.join(' '))
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir esta imagem.')
    } finally {
      setLendoQr(false)
    }
  }

  /** A chave digitada à mão — o caminho de saída quando o cupom está amassado. */
  function digitarChave(bruto: string) {
    setChaveDigitada(bruto)
    const r = lerChaveNfe(bruto)
    setChave(r.ok ? r.dados : null)
  }

  /**
   * Ler o valor da foto. Botão, nunca automático — e o custo é dito ANTES, que é
   * o que torna honesto chamar isto de opcional.
   */
  async function lerValorDaFoto() {
    if (!foto) return
    setLendoValor(true)
    setOcrAvisos([])
    setErro(null)
    try {
      if (!(await leitorLocal.disponivel())) {
        throw new Error('O leitor de valores não está disponível neste servidor. Digite o valor — o resto da nota já está lido.')
      }
      const p = await leitorLocal.ler(foto, { cnpj: chave?.cnpj, competencia: chave?.competencia })
      setOcrBruto(p.valor.bruto || null)
      setOcrAvisos(p.valor.avisos)
      if (p.valor.valor !== null) {
        setValor(p.valor.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
        setValorOrigem('ocr')
      }
      // ⚠️ A data da CHAVE manda sobre a lida pelo OCR. A chave passou pelo
      // dígito verificador; o OCR, não.
      if (p.tributos !== null) setTributos(String(p.tributos))
    } catch (e) {
      // OCR falhar não pode bloquear o arquivamento: a nota já tem tudo o que é certo.
      setOcrAvisos([e instanceof Error ? e.message : 'Não consegui ler o valor. Digite-o.'])
    } finally {
      setLendoValor(false)
    }
  }

  async function salvar() {
    if (!travar()) return
    if (!podeGravar(conferencia)) return
    setSalvando(true)
    setErro(null)
    try {
      let fotoPath = enviadoRef.current
      if (foto && !fotoPath && !isNonProductionDataMode()) {
        // Comprime só agora: o QR já foi lido da original.
        const blob = await compressImageToBlob(foto, 1600, 0.82)
        const arquivo = new File([blob], foto.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
        fotoPath = await uploadNotaFile(arquivo)
        enviadoRef.current = fotoPath
      }
      const final = conferirNota({ ...rascunho, fotoPath: fotoPath ?? undefined, fotoNome: foto?.name }, { orgId, existentes: notas })
      onSalvar(notaDoRascunho(final, new Date().toISOString()))
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar a nota.')
      setSalvando(false)
    }
  }

  const etiquetas = useMemo(() => etiquetasUsadas(notas), [notas])
  const pronto = podeGravar(conferencia)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-[#525252] bg-[#3d3d3d] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#525252] px-5 py-4">
          <ScanLine size={18} className="text-[#f97316]" />
          <h2 className="text-base font-semibold text-[#f5f5f5]">Importar nota fiscal</h2>
          <button type="button" onClick={onClose} className="ml-auto text-[#a3a3a3] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {erro && (
            <p className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{erro}</p>
          )}

          {/* ── 1. A foto ── */}
          <div>
            <label className={LABEL}>1 · A foto do cupom</label>
            <div className="flex flex-wrap items-center gap-3">
              <label className={`${BTN_P} inline-flex cursor-pointer items-center gap-2`}>
                <Camera size={15} /> {foto ? 'Trocar foto' : 'Fotografar ou escolher'}
                <input
                  type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void escolherFoto(f); e.target.value = '' }}
                />
              </label>
              {lendoQr && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#a3a3a3]">
                  <Loader2 size={13} className="animate-spin" /> procurando o QR Code…
                </span>
              )}
              {previa && <img src={previa} alt="" className="h-16 w-16 rounded-lg border border-[#525252] object-cover" />}
            </div>
            <p className="mt-1 text-[10px] text-[#6b6b6b]">
              A foto é opcional — dá para digitar os 44 dígitos da chave direto.
            </p>
          </div>

          {/* ── 2. A chave: a única certeza da tela ── */}
          <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
            <label className={LABEL}>2 · A chave de acesso</label>
            <input
              value={chave ? formatarChave(chave.chave) : chaveDigitada}
              onChange={(e) => digitarChave(e.target.value)}
              placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
              inputMode="numeric"
              className={`${INPUT} font-mono text-xs`}
            />
            {avisoQr && (
              <p className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                <AlertTriangle size={11} className="mr-1 inline" />{avisoQr}
              </p>
            )}
            {chave ? (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
                <p className="col-span-full flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 size={12} /> A chave confere no dígito verificador
                </p>
                {[
                  ['CNPJ', chave.cnpjFormatado], ['Documento', `${chave.modeloNome} nº ${chave.numero}`],
                  ['Série', String(chave.serie)], ['Competência', chave.competencia],
                  ['Estado', chave.uf],
                ].map(([r, v]) => (
                  <p key={r} className="text-[#a3a3a3]">{r}: <span className="text-[#f5f5f5]">{v}</span></p>
                ))}
              </div>
            ) : chaveDigitada.replace(/\D/g, '').length > 0 && (
              <p className="mt-1.5 text-[11px] text-red-300">
                {lerChaveNfe(chaveDigitada).ok ? '' : (lerChaveNfe(chaveDigitada) as { detalhe: string }).detalhe}
              </p>
            )}
          </div>

          {/* ── 3. O valor: proposta, sempre confirmada ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>3 · Valor da nota</label>
              <input
                value={valor}
                onChange={(e) => { setValor(e.target.value); setValorOrigem('manual') }}
                placeholder="0,00" inputMode="decimal" className={INPUT}
              />
              {foto && (
                <button
                  type="button" onClick={() => void lerValorDaFoto()} disabled={lendoValor}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#f97316] hover:underline disabled:opacity-50"
                >
                  {lendoValor
                    ? <><Loader2 size={12} className="animate-spin" /> lendo a foto…</>
                    : <><Sparkles size={12} /> Tentar ler o valor da foto (baixa ~4,8 MB na primeira vez)</>}
                </button>
              )}
              {/* ⚠️ A prova do que a máquina viu. Quando a pessoa enxerga o trecho cru,
                  ela corrige em dois segundos; com o campo sozinho, ela confia cego. */}
              {ocrBruto && (
                <p className="mt-1 font-mono text-[10px] text-[#6b6b6b]">li: “{ocrBruto}”</p>
              )}
              {ocrAvisos.map((a, i) => (
                <p key={i} className="mt-1 text-[10px] text-amber-300">{a}</p>
              ))}
              <p className="mt-0.5 text-[10px] text-[#6b6b6b]">
                O valor não está no QR Code — só o emitente, a data e o número estão.
              </p>
            </div>
            <div>
              <label className={LABEL}>Fornecedor</label>
              <input value={emitente} onChange={(e) => setEmitente(e.target.value)} className={INPUT} placeholder="Nome do estabelecimento" />
            </div>
          </div>

          {/* ── 4. A classificação ── */}
          <div>
            <label className={LABEL}>4 · Categoria (é ela que leva o gasto para a DRE)</label>
            <div className="flex flex-wrap gap-1.5">
              {SAIDA_CATS.map((c) => (
                <button
                  key={c} type="button" onClick={() => setCategoria(c)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    categoria === c ? 'bg-[#f97316] text-white' : 'border border-[#525252] bg-[#2c2c2c] text-[#a3a3a3] hover:text-white'
                  }`}
                >
                  {SAIDA_CAT_LABELS[c]}
                </button>
              ))}
            </div>
            {sugestao && (
              /* ⚠️ A sugestão nunca se aplica calada: a frase diz em quantas notas ela se baseia,
                 para a pessoa julgar a força sozinha. */
              <p className="mt-1.5 text-[10px] text-[#6b6b6b]">{sugestao.motivo}</p>
            )}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Etiqueta (só para o painel)</label>
                <input
                  value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}
                  list="etiquetas-de-nota" className={INPUT}
                  placeholder="alimentação, combustível, EPI…"
                />
                <datalist id="etiquetas-de-nota">
                  {etiquetas.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>
              <div>
                <label className={LABEL}>Obra</label>
                <select value={obraId} onChange={(e) => setObraId(e.target.value)} className={INPUT}>
                  <option value="">Sem obra</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className={LABEL}>Observação</label>
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={INPUT} />
            </div>
          </div>

          {/* ── 5. O que muda se eu gravar isto ── */}
          {chave && (
            <div className={`rounded-xl border px-3 py-2.5 text-xs ${COR_SITUACAO[conferencia.situacao] ?? COR_SITUACAO['ja-arquivada']}`}>
              <p className="font-semibold">{ROTULO_SITUACAO_NOTA[conferencia.situacao]}</p>
              {conferencia.mudancas.map((m) => (
                <p key={m.campo} className="mt-1">
                  {m.rotulo}: <span className="line-through opacity-60">{String(m.antes)}</span> → <b>{String(m.depois)}</b>
                </p>
              ))}
              {conferencia.situacao === 'ja-lancada' && (
                <p className="mt-1 opacity-90">
                  Esta nota já virou lançamento no Financeiro. Reimportar a foto não mexe num número
                  que já está na DRE — corrija pelo card da nota, se for o caso.
                </p>
              )}
              {conferencia.avisos.map((a, i) => <p key={i} className="mt-1 opacity-90">{a}</p>)}
            </div>
          )}

          {conferencia.impedimentos.length > 0 && chaveDigitada && (
            <ul className="space-y-1 rounded-xl border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-[11px] text-[#a3a3a3]">
              {conferencia.impedimentos.map((i, k) => <li key={k}>· {i}</li>)}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[#525252] px-5 py-4">
          <button type="button" onClick={onClose} className={BTN_S}>Cancelar</button>
          <span className="ml-auto text-xs text-[#6b6b6b]">
            {pronto ? `Vai gravar ${fmtBRL(valorNumero ?? 0)}` : 'Preencha o que falta acima'}
          </span>
          <button type="button" disabled={!pronto || salvando} onClick={() => void salvar()} className={BTN_P}>
            {salvando ? 'Salvando…' : 'Arquivar nota'}
          </button>
        </div>
      </div>
    </div>
  )
}
