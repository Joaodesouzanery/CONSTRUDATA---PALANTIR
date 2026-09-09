/**
 * Medição — o boletim do contrato: quanto foi executado, quanto isso vale, e o que não pode ser
 * faturado ainda.
 *
 * ⚠️ **Não confundir com "Avanço Ponderado"**, ao lado. Aquela é a matriz de peso do EVM
 * (`0,30·financeiro + 0,25·duração + 0,30·econômico + 0,15·específico`) e responde "quanto da obra
 * andou". Esta responde "quanto disso vira dinheiro, item por item do contrato".
 *
 * ─── A REGRA QUE A TELA INTEIRA SERVE ─────────────────────────────────────────
 * Item com preço a conferir **nunca** entra no total. Ele aparece numa lista à parte, com o valor
 * que teria e o motivo escrito — e enquanto houver um, a medição não fecha. Medido no arquivo real
 * do contrato ZN: são R$ 339.210,56 (10,4% da medição) sobre preços que a própria planilha manda
 * conferir com a fiscalização.
 *
 * ⚠️ A importação segue o padrão do Controle de Caixa: a tela não pergunta "importar?" — ela
 * responde "o que muda se eu importar isto?". Nada é gravado antes do clique.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Ruler, AlertTriangle, CheckCircle2, Upload, X, RefreshCw, Building2 } from 'lucide-react'
import type { CatalogoDoContrato, MedicaoImportada } from '@/types'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useAuth } from '@/lib/auth'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'
import { validateFileBeforeParse } from '@/lib/importEngine'
import { lerCatalogoZn, lerQuantidadesZn, type LeituraDoCatalogo, type LeituraDasQuantidades } from '../utils/medicao/importarCatalogoZn'
import { lerCatalogo, gravarCatalogo, lerMedicao, gravarMedicao } from '../utils/medicao/catalogoStorage'
import { calcularMedicao, cadeiaDeRepasse, porCategoria, type ResultadoDaMedicao } from '../utils/medicao/motorDaMedicao'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

const ROTULO_FLAG: Record<string, string> = {
  bloco_deslocado_pdf: 'bloco deslocado no PDF',
  preco_regional_divergente: 'preço próprio de uma região',
  descricao_truncada_ambigua: 'descrição truncada, preço ambíguo',
}

interface Lido { catalogo: LeituraDoCatalogo; quantidades: LeituraDasQuantidades; arquivo: string }

export function MedicaoPanel() {
  const sites = useTorreStore((s) => s.sites)
  const profile = useAuth((s) => s.profile)
  const quem = profile?.full_name ?? profile?.email ?? 'alguém'

  const contratos = useMemo(
    () => [...new Set(sites.map((s) => s.numeroContrato).filter((n): n is string => !!n && n.trim() !== ''))],
    [sites],
  )
  const [numeroContrato, setNumeroContrato] = useState('')
  const [catalogo, setCatalogo] = useState<CatalogoDoContrato | null>(null)
  const [medicao, setMedicao] = useState<MedicaoImportada | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [lido, setLido] = useState<Lido | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)

  useEffect(() => { if (!numeroContrato && contratos.length > 0) setNumeroContrato(contratos[0]) }, [contratos, numeroContrato])

  const carregar = useCallback(async (ct: string) => {
    if (!ct.trim()) { setCatalogo(null); setMedicao(null); return }
    setCarregando(true)
    try {
      const [c, m] = await Promise.all([lerCatalogo(ct), lerMedicao(ct)])
      setCatalogo(c); setMedicao(m)
    } finally { setCarregando(false) }
  }, [])

  useEffect(() => { void carregar(numeroContrato) }, [numeroContrato, carregar])

  async function lerArquivo(f: File) {
    setAviso(null)
    const guarda = validateFileBeforeParse(f)
    if (!guarda.ok) { setAviso(guarda.error ?? 'Arquivo recusado.'); return }
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true })
      const abas: Record<string, never> = {}
      for (const nome of wb.SheetNames) {
        abas[nome] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null }) as never
      }
      const cat = lerCatalogoZn(abas, { numeroContrato, orgId: profile?.organization_id })
      const qts = lerQuantidadesZn(abas, cat.catalogo)
      setLido({ catalogo: cat, quantidades: qts, arquivo: f.name })
    } catch (err) {
      setAviso(`Não consegui ler o arquivo: ${err instanceof Error ? err.message : 'erro desconhecido'}`)
    }
  }

  async function gravar() {
    if (!lido) return
    setGravando(true)
    try {
      // A região de cada obra é preservada de uma importação para a outra: ela é escolha humana,
      // e a planilha não a traz.
      const regiaoPorObra: Record<string, string> = { ...(medicao?.regiaoPorObra ?? {}) }
      const okCatalogo = await gravarCatalogo({ ...lido.catalogo.catalogo, importadoEm: new Date().toISOString(), importadoPor: quem, arquivo: lido.arquivo })
      const okMedicao = await gravarMedicao({
        numeroContrato,
        obras: lido.quantidades.obras,
        regiaoPorObra,
        quantidades: lido.quantidades.quantidades,
        valorDeclarado: lido.quantidades.valorDeclarado,
        importadaEm: new Date().toISOString(),
        importadaPor: quem,
        arquivo: lido.arquivo,
      })
      if (!okCatalogo || !okMedicao) { setAviso('Não consegui salvar — verifique a conexão e tente de novo. Nada foi perdido.'); return }
      setLido(null)
      await carregar(numeroContrato)
      setAviso('Catálogo e medição gravados.')
    } finally { setGravando(false) }
  }

  async function escolherRegiao(obra: string, regiao: string) {
    if (!medicao) return
    const atualizada = { ...medicao, regiaoPorObra: { ...medicao.regiaoPorObra, [obra]: regiao } }
    setMedicao(atualizada)
    if (!(await gravarMedicao(atualizada))) setAviso('A região foi trocada na tela, mas não consegui salvar.')
  }

  const resultados = useMemo<ResultadoDaMedicao[]>(() => {
    if (!catalogo || !medicao) return []
    return medicao.obras
      .filter((o) => medicao.regiaoPorObra[o])
      .map((o) => calcularMedicao(catalogo, o, medicao.regiaoPorObra[o], medicao.quantidades))
  }, [catalogo, medicao])

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <Ruler size={18} className="text-[#f97316]" />
        <h2 className="text-sm font-bold text-[#f5f5f5]">Medição do contrato</h2>
        <label className="ml-auto flex items-center gap-2 text-[11px] text-[#a3a3a3]">
          Contrato
          <input
            list="contratos-medicao"
            value={numeroContrato}
            onChange={(e) => setNumeroContrato(e.target.value)}
            placeholder="13.546/25-00"
            className="w-44 rounded-lg border border-[#525252] bg-[#1f1f1f] px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/50"
          />
          <datalist id="contratos-medicao">{contratos.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
      </header>

      {aviso && (
        <p className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs ${aviso.startsWith('Não')
          ? 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#fca5a5]'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          {aviso.startsWith('Não') ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />} {aviso}
        </p>
      )}

      {/* ── Importação ────────────────────────────────────────────────────── */}
      {!lido && (
        <section className="rounded-xl border border-[#525252] bg-[#333333] p-4">
          <p className="text-xs font-semibold text-[#f5f5f5]">
            {catalogo ? 'Atualizar com uma planilha nova' : 'Importar a planilha de medição'}
          </p>
          <p className="mt-1 text-[11px] text-[#a3a3a3]">
            Nada é gravado ao soltar o arquivo: primeiro eu mostro o que li e o que muda.
            {!numeroContrato.trim() && <strong className="text-[#fbbf24]"> Escolha o contrato acima antes.</strong>}
          </p>
          <div className="mt-3">
            <AreaDeSoltar
              compacto aceita=".xlsx,.xls"
              desabilitado={!numeroContrato.trim()}
              titulo="Arraste a planilha de medição ou clique"
              aoEscolher={(fs) => { const f = fs[0]; if (f) void lerArquivo(f) }}
            />
          </div>
        </section>
      )}

      {lido && (
        <ConferenciaDaImportacao
          lido={lido} gravando={gravando}
          onCancelar={() => setLido(null)} onGravar={() => void gravar()}
        />
      )}

      {carregando && <p className="text-xs text-[#6b6b6b]">Carregando…</p>}

      {!carregando && !catalogo && !lido && (
        <p className="rounded-xl border border-dashed border-[#525252] p-6 text-center text-xs text-[#6b6b6b]">
          Nenhum catálogo importado para este contrato ainda.
        </p>
      )}

      {catalogo && <CardDoCatalogo catalogo={catalogo} />}

      {catalogo && medicao && medicao.obras.map((obra) => (
        <MedicaoDaObra
          key={obra}
          obra={obra}
          catalogo={catalogo}
          regiao={medicao.regiaoPorObra[obra]}
          resultado={resultados.find((r) => r.obra === obra)}
          onEscolherRegiao={(r) => void escolherRegiao(obra, r)}
        />
      ))}

      {catalogo && medicao && (
        <p className="text-[11px] text-[#6b6b6b]">
          Medição importada em {new Date(medicao.importadaEm).toLocaleString('pt-BR')}
          {medicao.importadaPor && <> por {medicao.importadaPor}</>}
          {medicao.arquivo && <> · {medicao.arquivo}</>}
          {' · '}a planilha declara <strong className="text-[#a3a3a3]">{brl(medicao.valorDeclarado)}</strong> na coluna VALOR MEDIÇÃO.
        </p>
      )}
    </div>
  )
}

// ─── "O que muda se eu importar isto?" ────────────────────────────────────────

function ConferenciaDaImportacao({ lido, gravando, onCancelar, onGravar }: {
  lido: Lido; gravando: boolean; onCancelar: () => void; onGravar: () => void
}) {
  const { resumo, problemas } = lido.catalogo
  const q = lido.quantidades
  const linha = 'flex justify-between gap-3 text-[11px]'
  return (
    <section className="rounded-xl border border-[#f97316]/40 bg-[#333333] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#f5f5f5]">O que eu li em "{lido.arquivo}"</p>
        <button onClick={onCancelar} className="text-[#6b6b6b] hover:text-[#f5f5f5]" aria-label="Cancelar"><X size={15} /></button>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className={linha}><span className="text-[#a3a3a3]">Serviços do catálogo</span><strong className="text-[#f5f5f5]">{resumo.servicos}</strong></p>
          <p className={linha}><span className="text-[#a3a3a3]">— do contrato</span><span className="text-[#c9c9c9]">{resumo.porParte.contrato}</span></p>
          <p className={linha}><span className="text-[#a3a3a3]">— do apostilamento</span><span className="text-[#c9c9c9]">{resumo.porParte.apostilamento}</span></p>
          <p className={linha}><span className="text-[#a3a3a3]">Regiões</span><span className="text-[#c9c9c9]">{resumo.regioes}</span></p>
          <p className={linha}><span className="text-[#a3a3a3]">Repasse lido da planilha</span><strong className="text-[#f5f5f5]">{(lido.catalogo.catalogo.fatorPadrao * 100).toFixed(0)}%</strong></p>
        </div>
        <div className="space-y-1">
          <p className={linha}><span className="text-[#a3a3a3]">Obras com quantidade</span><strong className="text-[#f5f5f5]">{q.obras.join(' · ') || '—'}</strong></p>
          <p className={linha}><span className="text-[#a3a3a3]">Lançamentos de quantidade</span><span className="text-[#c9c9c9]">{q.quantidades.length}</span></p>
          <p className={linha}><span className="text-[#a3a3a3]">Total declarado na planilha</span><strong className="text-[#f5f5f5]">{brl(q.valorDeclarado)}</strong></p>
          {Object.entries(resumo.subtotaisDeclarados).map(([parte, v]) => v != null && (
            <p key={parte} className={linha}><span className="text-[#a3a3a3]">— subtotal {parte}</span><span className="text-[#c9c9c9]">{brl(v)}</span></p>
          ))}
        </div>
      </div>

      {Object.keys(resumo.porFlag).length > 0 && (
        <div className="mt-3 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 p-3">
          <p className="text-[11px] font-semibold text-[#fbbf24]">Exceções que a planilha documenta</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-[#fbbf24]">
            {Object.entries(resumo.porFlag).map(([f, n]) => (
              <li key={f}>{n} item(ns) — {ROTULO_FLAG[f] ?? f}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-[#a3a3a3]">
            Só o bloco deslocado barra a medição: ali o preço pode estar errado, não só diferente.
          </p>
        </div>
      )}

      {problemas.length > 0 && (
        <div className="mt-3 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 p-3 text-[11px] text-[#fca5a5]">
          <p className="font-semibold">Não consegui ler tudo</p>
          <ul className="mt-1 space-y-0.5">{problemas.map((p) => <li key={p}>· {p}</li>)}</ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={onGravar} disabled={gravando || resumo.servicos === 0}
          className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
          <Upload size={14} /> {gravando ? 'Gravando…' : 'Gravar catálogo e medição'}
        </button>
        <button onClick={onCancelar} className="rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">
          Cancelar
        </button>
      </div>
    </section>
  )
}

// ─── O catálogo em vigor ──────────────────────────────────────────────────────

function CardDoCatalogo({ catalogo }: { catalogo: CatalogoDoContrato }) {
  const [aberto, setAberto] = useState(false)
  const bloqueados = catalogo.servicos.filter((s) => s.bloqueadoParaMedicao)
  const porFlag = catalogo.servicos.reduce<Record<string, number>>((acc, s) => {
    if (s.flag !== 'ok') acc[s.flag] = (acc[s.flag] ?? 0) + 1
    return acc
  }, {})
  const semQtdContratada = catalogo.servicos.filter((s) => s.qtdContratada == null).length

  return (
    <section className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold text-[#f5f5f5]">Catálogo do contrato</p>
        <span className="text-[11px] text-[#a3a3a3]">
          {catalogo.servicos.length} serviços · {catalogo.regioes.length} regiões · repasse de {(catalogo.fatorPadrao * 100).toFixed(0)}%
        </span>
        {Object.keys(porFlag).length > 0 && (
          <button onClick={() => setAberto((v) => !v)} className="ml-auto text-[11px] text-[#ffa055] hover:underline">
            {aberto ? 'ocultar' : 'ver'} {Object.values(porFlag).reduce((a, b) => a + b, 0)} exceção(ões)
          </button>
        )}
      </div>

      {catalogo.importadoEm && (
        <p className="mt-1 text-[10px] text-[#6b6b6b]">
          Importado em {new Date(catalogo.importadoEm).toLocaleDateString('pt-BR')}
          {catalogo.importadoPor && <> por {catalogo.importadoPor}</>}
        </p>
      )}

      {semQtdContratada === catalogo.servicos.length && (
        <p className="mt-2 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
          ⚠️ Nenhum item tem <strong>quantidade contratada</strong>. Ela vem da planilha de
          balanceamento, que não faz parte deste arquivo — por isso não dá para dizer quanto
          <em> falta </em>medir de cada item. O que já foi medido aparece normalmente.
        </p>
      )}

      {aberto && (
        <div className="mt-3 space-y-2">
          {Object.entries(porFlag).map(([f, n]) => (
            <p key={f} className="text-[11px] text-[#c9c9c9]">
              <strong className={f === 'bloco_deslocado_pdf' ? 'text-[#fca5a5]' : 'text-[#fbbf24]'}>{n}</strong>{' '}
              {ROTULO_FLAG[f] ?? f}
              {f === 'bloco_deslocado_pdf' && <span className="text-[#6b6b6b]"> — estes não podem ser medidos até alguém confirmar</span>}
            </p>
          ))}
          <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-[#525252] bg-[#2c2c2c] p-2">
            {bloqueados.map((s) => (
              <li key={s.id} className="border-l-2 border-[#ef4444] pl-2 text-[11px]">
                <span className="text-[#f5f5f5]">{s.descricao}</span>
                <span className="text-[#6b6b6b]"> · {s.unidade} · {brl(s.precoZn)}</span>
                {s.motivoFlag && <p className="text-[10px] text-[#a3a3a3]">{s.motivoFlag}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ─── A medição de uma obra ────────────────────────────────────────────────────

function MedicaoDaObra({ obra, catalogo, regiao, resultado, onEscolherRegiao }: {
  obra: string
  catalogo: CatalogoDoContrato
  regiao?: string
  resultado?: ResultadoDaMedicao
  onEscolherRegiao: (regiao: string) => void
}) {
  const cadeia = resultado ? cadeiaDeRepasse(resultado.total, catalogo.fatorPadrao) : null
  const cats = resultado ? porCategoria(resultado) : []

  return (
    <section className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Building2 size={14} className="text-[#f97316]" />
        <p className="text-xs font-bold text-[#f5f5f5]">{obra}</p>
        <label className="ml-auto flex items-center gap-2 text-[11px] text-[#a3a3a3]">
          Região do contrato
          <select
            value={regiao ?? ''}
            onChange={(e) => onEscolherRegiao(e.target.value)}
            className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/50"
          >
            <option value="">— escolha —</option>
            {catalogo.regioes.map((r) => <option key={r.codigo} value={r.codigo}>{r.codigo} — {r.nome}</option>)}
          </select>
        </label>
      </div>

      {!regiao && (
        <p className="mt-3 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] text-[#fbbf24]">
          Escolha a região para eu poder valorar: é ela que decide o código e o preço de cada serviço.
          O mesmo item custa diferente em Mairiporã.
        </p>
      )}

      {resultado && (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Pode medir</p>
              <p className="text-sm font-bold text-emerald-300">{brl(resultado.total)}</p>
              <p className="text-[10px] text-[#6b6b6b]">{resultado.linhas.length} item(ns) com preço confirmado</p>
            </div>
            <div className={`rounded-lg border p-3 ${resultado.pendentes.length > 0 ? 'border-[#ef4444]/40 bg-[#ef4444]/5' : 'border-[#525252]'}`}>
              <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Barrado</p>
              <p className={`text-sm font-bold ${resultado.pendentes.length > 0 ? 'text-[#fca5a5]' : 'text-[#6b6b6b]'}`}>{brl(resultado.totalPendente)}</p>
              <p className="text-[10px] text-[#6b6b6b]">{resultado.pendentes.length} item(ns) esperando conferência</p>
            </div>
            <div className="rounded-lg border border-[#525252] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Cadeia do repasse</p>
              {cadeia ? (
                <>
                  <p className="text-sm font-bold text-[#f5f5f5]">{brl(cadeia.brutoConsorcio)}</p>
                  <p className="text-[10px] text-[#6b6b6b]">o consórcio recebe · retém {brl(cadeia.retido)}</p>
                </>
              ) : <p className="text-sm text-[#6b6b6b]">—</p>}
            </div>
          </div>

          {resultado.pendentes.length > 0 && (
            <div className="mt-3 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/5 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#fca5a5]">
                <AlertTriangle size={12} /> Não entra na soma até alguém confirmar
              </p>
              <ul className="mt-2 space-y-1.5">
                {resultado.pendentes.map((l) => (
                  <li key={l.servicoCatalogoId} className="border-l-2 border-[#ef4444] pl-2 text-[11px]">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-[#f5f5f5]">{l.descricao}</span>
                      <span className="font-mono text-[#fca5a5]">{brl(l.valor)}</span>
                    </div>
                    <p className="text-[10px] text-[#a3a3a3]">
                      {num(l.quantidade)} {l.unidade} × {brl(l.precoComFator)} · {l.motivo}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-[#6b6b6b]">
                Enquanto houver pendência, esta medição não fecha — e portanto não vira nota.
              </p>
            </div>
          )}

          {cats.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Por categoria do contrato</p>
              <div className="mt-1 space-y-1">
                {cats.map((c) => (
                  <div key={c.categoria} className="flex items-center gap-2 text-[11px]">
                    <span className="w-56 truncate text-[#c9c9c9]" title={c.categoria}>{c.categoria}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#2c2c2c]">
                      <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${resultado.total > 0 ? (c.valor / resultado.total) * 100 : 0}%` }} />
                    </div>
                    <span className="w-28 text-right font-mono text-[#f5f5f5]">{brl(c.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#6b6b6b]">
            <RefreshCw size={11} />
            Este número é calculado item a item, não digitado. Gerar a Entrada no Financeiro a
            partir dele é o próximo passo — e só vai ser oferecido com a medição sem pendência.
          </p>
        </>
      )}
    </section>
  )
}
