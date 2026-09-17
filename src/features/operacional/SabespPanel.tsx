/**
 * O Operacional — a planilha SABESP como módulo.
 *
 * ─── O QUE MUDOU NO DESENHO, E POR QUÊ ────────────────────────────────────────
 * A versão anterior era uma tira horizontal com as 20 abas em fila, uma tabela que renderizava
 * TODAS as colunas (198 das 513 não têm título na planilha: 40% da largura era vazio), sem busca
 * em abas de 523 linhas, sem indicador de sincronização — justamente no único módulo que não
 * sincronizava — e com `bg-gray-950`, uma paleta que o resto do app não usa.
 *
 * Agora: grupos (Cadastros · Execução · Medição · Gestão) com `SubTabHost`, colunas sem título
 * escondidas por padrão, busca por linha, `SyncBadge`, e a paleta do app.
 */
import { useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AlertTriangle, Eye, EyeOff, HelpCircle, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { SubTabHost } from '@/components/shared/SubTabHost'
import { SyncBadge } from '@/components/shared/SyncBadge'
import { useStoreSync } from '@/lib/useStoreSync'
import { podeEscreverTorre } from '@/lib/roles'
import { cn } from '@/lib/utils'
import {
  useSabespStore, SABESP_SHEETS, GRUPOS, definicaoDaAba, type SabespSheetId,
} from './sabespStore'
import { prepararImportacao, type PreviaDaImportacao } from './importarPlanilha'
import { chaveDaColuna } from './leitorPlanilha'
import { CelulaEditavel } from './components/CelulaEditavel'
import { ConferenciaImportacao } from './components/ConferenciaImportacao'

export function SabespPanel() {
  const { linhas, abas, configuracoes, guias, imports } = useSabespStore(
    useShallow((s) => ({
      linhas: s.linhas, abas: s.abas, configuracoes: s.configuracoes, guias: s.guias, imports: s.imports,
    })),
  )
  const gravarLinhas = useSabespStore((s) => s.gravarLinhas)
  const editarCelula = useSabespStore((s) => s.editarCelula)
  const registrarImportacao = useSabespStore((s) => s.registrarImportacao)
  const activeOrgId = useSabespStore((s) => s.activeOrgId)
  const sync = useStoreSync(useSabespStore)

  const [previa, setPrevia] = useState<PreviaDaImportacao | null>(null)
  const [lendo, setLendo] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const podeEscrever = useMemo(() => podeEscreverTorre().pode, [])

  async function escolherArquivo(arquivo: File) {
    setLendo(true)
    try {
      setPrevia(await prepararImportacao(arquivo, activeOrgId, linhas))
    } catch (e) {
      toast.error(`Não consegui ler o arquivo: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLendo(false)
    }
  }

  function aplicar() {
    if (!previa) return
    gravarLinhas(previa.paraGravar)
    registrarImportacao({
      id: crypto.randomUUID(),
      arquivo: previa.arquivo,
      criadoEm: new Date().toISOString(),
      ...previa.resumo,
      abasLidas: Object.keys(previa.abas).length,
      listas: previa.listas,
      regras: previa.regras,
    }, { abas: previa.abas, configuracoes: previa.configuracoes, guias: previa.guias })
    toast.success(
      `${previa.resumo.novas} nova(s), ${previa.resumo.atualizadas} atualizada(s)`
      + (previa.resumo.conflitos ? `, ${previa.resumo.conflitos} edição(ões) sua(s) sobrescrita(s)` : ''),
    )
    setPrevia(null)
  }

  const ultima = imports[0]
  const semDado = linhas.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#1f1f1f]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#525252] px-6 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Controle Operacional SABESP</h2>
          <p className="text-xs text-[#a3a3a3]">
            {semDado
              ? 'Importe a planilha para começar.'
              : `${linhas.filter((l) => l.ativa).length} linha(s) · ${Object.keys(abas).length} aba(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge {...sync} />
          <input
            ref={input} type="file" accept=".xlsx,.xls,.ods,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void escolherArquivo(f) }}
          />
          <button
            type="button" onClick={() => input.current?.click()} disabled={lendo || !podeEscrever}
            title={podeEscrever ? undefined : 'O seu perfil não pode gravar no Operacional'}
            className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={14} />
            {lendo ? 'Lendo…' : 'Importar planilha'}
          </button>
        </div>
      </div>

      {ultima && (
        <p className="border-b border-[#525252] px-6 py-1.5 text-[11px] text-[#6b6b6b]">
          Última importação: {ultima.arquivo} · {ultima.novas} nova(s) · {ultima.atualizadas} atualizada(s)
          {ultima.conflitos > 0 && ` · ${ultima.conflitos} edição(ões) sobrescrita(s)`}
          {' · '}{ultima.listas} lista(s) e {ultima.regras} regra(s) de preenchimento
        </p>
      )}

      <div className="min-h-0 flex-1">
        <SubTabHost
          tabs={GRUPOS.map((g) => ({
            key: g,
            label: g,
            render: () => <GrupoDeAbas grupo={g} podeEscrever={podeEscrever} onEditar={editarCelula} />,
          }))}
        />
      </div>

      {previa && <ConferenciaImportacao previa={previa} onCancelar={() => setPrevia(null)} onConfirmar={aplicar} />}

      {/* Configurações, Guia Rápido e Leia-me viajam junto e ficam aqui, como pedido. */}
      {(configuracoes.length > 0 || guias.rapido || guias.leiaMe) && (
        <PainelDeConfiguracao configuracoes={configuracoes} guias={guias} />
      )}
    </div>
  )
}

// ─── Um grupo de abas ─────────────────────────────────────────────────────────

function GrupoDeAbas({ grupo, podeEscrever, onEditar }: {
  grupo: string
  podeEscrever: boolean
  onEditar: (id: string, campo: string, valor: string) => void
}) {
  const doGrupo = SABESP_SHEETS.filter((d) => d.grupo === grupo)
  const [ativa, setAtiva] = useState<SabespSheetId>(doGrupo[0].id)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-3">
      <div className="flex flex-wrap gap-1">
        {doGrupo.map((d) => (
          <button
            key={d.id} type="button" onClick={() => setAtiva(d.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              ativa === d.id ? 'bg-[#f97316]/15 text-[#ffa055] ring-1 ring-[#f97316]/40' : 'text-[#a3a3a3] hover:bg-[#3a3a3a]',
            )}
          >
            {d.label}
            {d.readonly && <span className="ml-1 text-[9px] text-[#6b6b6b]">fórmula</span>}
          </button>
        ))}
      </div>
      <GradeDaAba aba={ativa} podeEscrever={podeEscrever} onEditar={onEditar} />
    </div>
  )
}

// ─── A grade ──────────────────────────────────────────────────────────────────

function GradeDaAba({ aba, podeEscrever, onEditar }: {
  aba: SabespSheetId
  podeEscrever: boolean
  onEditar: (id: string, campo: string, valor: string) => void
}) {
  const def = definicaoDaAba(aba)
  const linhas = useSabespStore(useShallow((s) => s.linhas.filter((l) => l.aba === aba)))
  const meta = useSabespStore((s) => s.abas[aba])
  const [busca, setBusca] = useState('')
  const [mostrarSemTitulo, setMostrarSemTitulo] = useState(false)

  const colunas = useMemo(
    () => (meta?.colunas ?? []).filter((c) => mostrarSemTitulo || c.temTitulo),
    [meta, mostrarSemTitulo],
  )
  const escondidas = (meta?.colunas.length ?? 0) - (meta?.colunas.filter((c) => c.temTitulo).length ?? 0)

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return linhas
    return linhas.filter((l) => Object.values(l.valores).some((v) => String(v).toLowerCase().includes(t)))
  }, [linhas, busca])

  if (!meta) {
    return (
      <div className="rounded-xl border border-dashed border-[#525252] px-4 py-12 text-center text-xs text-[#a3a3a3]">
        Esta aba ainda não foi importada.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar linhas…"
            aria-label="Filtrar linhas"
            className="w-56 rounded-lg border border-[#525252] bg-[#2c2c2c] py-1.5 pl-7 pr-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
          />
        </div>
        <span className="text-[11px] text-[#6b6b6b]">{visiveis.length} de {linhas.length}</span>
        {escondidas > 0 && (
          // ⚠️ 198 das 513 colunas da planilha não têm título — são espaçadoras. Renderizá-las
          // fazia 40% da largura da tabela ser vazio. Ficam escondidas, mas alcançáveis.
          <button
            type="button" onClick={() => setMostrarSemTitulo((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#525252] px-2 py-1 text-[11px] text-[#a3a3a3] hover:text-[#f5f5f5]"
          >
            {mostrarSemTitulo ? <EyeOff size={12} /> : <Eye size={12} />}
            {mostrarSemTitulo ? 'Ocultar' : 'Mostrar'} {escondidas} coluna(s) sem título
          </button>
        )}
        {def.readonly && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#6b6b6b]" title="Na planilha esta aba é fórmula; editar aqui seria discordar da fonte.">
            <HelpCircle size={12} /> só leitura — é calculada na planilha
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[#525252]">
        <table className="min-w-max text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#3d3d3d] text-[#a3a3a3]">
            <tr>
              {colunas.map((c) => (
                <th key={c.indice} className="whitespace-nowrap px-3 py-2 font-medium" title={c.regra?.mensagem}>
                  {c.temTitulo ? c.titulo : <span className="text-[#6b6b6b]">col. {c.indice + 1}</span>}
                  {c.regra?.tipo === 'lista' && <span className="ml-1 text-[9px] text-[#f97316]">lista</span>}
                  {c.regra?.tipo === 'data' && <span className="ml-1 text-[9px] text-[#60a5fa]">data</span>}
                  {c.regra?.tipo === 'numero' && <span className="ml-1 text-[9px] text-[#a78bfa]">nº</span>}
                  {c.regra?.obrigatorio && <span className="ml-0.5 text-[#fca5a5]">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.id} className={cn('border-t border-[#525252]', !l.ativa && 'opacity-50')}>
                {colunas.map((c) => {
                  const campo = chaveDaColuna(c)
                  return (
                    <td key={c.indice} className="max-w-64 px-1 py-0.5">
                      <CelulaEditavel
                        valor={l.valores[campo] ?? ''}
                        regra={c.regra}
                        somenteLeitura={!podeEscrever || !!def.readonly || !l.ativa}
                        onGravar={(v) => onEditar(l.id, campo, v)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr><td colSpan={Math.max(1, colunas.length)} className="px-4 py-10 text-center text-[#a3a3a3]">
                {linhas.length ? 'Nenhuma linha bate com o filtro.' : 'Nenhuma linha nesta aba.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {linhas.some((l) => !l.ativa) && (
        <p className="text-[11px] text-[#6b6b6b]">
          <AlertTriangle size={11} className="mr-1 inline text-[#fbbf24]" />
          As linhas esmaecidas não vieram na última planilha. Continuam aqui, marcadas — não foram apagadas.
        </p>
      )}
    </div>
  )
}

// ─── Configurações + guias ────────────────────────────────────────────────────

function PainelDeConfiguracao({ configuracoes, guias }: {
  configuracoes: Array<{ secao?: string; rotulo: string; valor: string }>
  guias: { rapido?: { titulo: string; linhas: string[] }; leiaMe?: { titulo: string; linhas: string[] } }
}) {
  const [aberto, setAberto] = useState(false)
  const [vista, setVista] = useState<'parametros' | 'rapido' | 'leiaMe'>('parametros')

  return (
    <div className="border-t border-[#525252]">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between px-6 py-2.5 text-left">
        <span className="text-xs font-semibold text-[#f5f5f5]">
          Configurações, Guia Rápido e Leia-me
          <span className="ml-2 text-[11px] font-normal text-[#a3a3a3]">— tudo que a planilha explica sobre ela mesma</span>
        </span>
        <span className="text-[11px] text-[#a3a3a3]">{aberto ? 'Recolher' : 'Abrir'}</span>
      </button>
      {aberto && (
        <div className="border-t border-[#525252] px-6 py-3">
          <div className="mb-3 flex gap-1">
            {([['parametros', `Parâmetros (${configuracoes.length})`], ['rapido', 'Guia Rápido'], ['leiaMe', 'Leia-me']] as const).map(([k, rot]) => (
              <button
                key={k} type="button" onClick={() => setVista(k)}
                className={cn('rounded-lg px-3 py-1 text-[11px]', vista === k ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#3a3a3a]')}
              >{rot}</button>
            ))}
          </div>
          <div className="max-h-56 overflow-auto text-xs">
            {vista === 'parametros' && (
              configuracoes.length ? (
                <table className="w-full">
                  <tbody>
                    {configuracoes.map((p, i) => (
                      <tr key={`${p.rotulo}-${i}`} className="border-b border-[#3d3d3d]">
                        <td className="w-1/3 py-1 pr-3 text-[#a3a3a3]">{p.rotulo}</td>
                        <td className="py-1 text-[#f5f5f5]">{p.valor || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-[#a3a3a3]">Importe a planilha para carregar os parâmetros.</p>
            )}
            {vista === 'rapido' && <Guia guia={guias.rapido} />}
            {vista === 'leiaMe' && <Guia guia={guias.leiaMe} />}
          </div>
        </div>
      )}
    </div>
  )
}

function Guia({ guia }: { guia?: { titulo: string; linhas: string[] } }) {
  if (!guia) return <p className="text-[#a3a3a3]">Esta aba não veio na última planilha importada.</p>
  return (
    <div className="whitespace-pre-wrap leading-relaxed text-[#d4d4d4]">
      {guia.linhas.map((l, i) => <p key={`${l}-${i}`} className="mb-1">{l}</p>)}
    </div>
  )
}
