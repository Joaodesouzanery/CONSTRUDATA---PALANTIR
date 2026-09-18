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
import { AlertTriangle, Archive, Copy, Download, Expand, FileDown, HelpCircle, Plus, RotateCcw, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { SubTabHost } from '@/components/shared/SubTabHost'
import { SyncBadge } from '@/components/shared/SyncBadge'
import { useStoreSync } from '@/lib/useStoreSync'
import { podeEscreverTorre } from '@/lib/roles'
import { cn } from '@/lib/utils'
import {
  useSabespStore, SABESP_SHEETS, GRUPOS, definicaoDaAba, type SabespSheetId, type AbaNoSistema,
} from './sabespStore'
import { prepararImportacao, type PreviaDaImportacao } from './importarPlanilha'
import { chaveDaColuna } from './leitorPlanilha'
import { alertasDaOperacao } from './alertasOperacionais'
import { CelulaEditavel } from './components/CelulaEditavel'
import { ConferenciaImportacao } from './components/ConferenciaImportacao'
import { baixarArquivoOriginal, enviarArquivoOperacional, exportarAba, exportarWorkbookCompleto } from './arquivoOperacional'

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
  const arquivoPendente = useRef<File | null>(null)
  const podeEscrever = useMemo(() => podeEscreverTorre().pode, [])

  async function escolherArquivo(arquivo: File) {
    setLendo(true)
    try {
      arquivoPendente.current = arquivo
      setPrevia(await prepararImportacao(arquivo, activeOrgId, linhas))
    } catch (e) {
      toast.error(`Não consegui ler o arquivo: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLendo(false)
    }
  }

  async function aplicar() {
    if (!previa) return
    let arquivoPath: string | undefined
    try {
      if (arquivoPendente.current && activeOrgId) arquivoPath = await enviarArquivoOperacional(arquivoPendente.current, activeOrgId)
    } catch (e) {
      // A importação continua local-first. Falha de rede/bucket não pode perder o trabalho;
      // o dado e o lote entram na fila, e a tela deixa claro que só o anexo original faltou.
      toast.warning(`Dados importados, mas o arquivo original não subiu: ${e instanceof Error ? e.message : String(e)}`)
    }
    gravarLinhas(previa.paraGravar)
    registrarImportacao({
      id: crypto.randomUUID(),
      arquivo: previa.arquivo,
      criadoEm: new Date().toISOString(),
      ...previa.resumo,
      abasLidas: Object.keys(previa.abas).length,
      listas: previa.listas,
      regras: previa.regras,
      arquivoPath,
    }, { abas: previa.abas, configuracoes: previa.configuracoes, guias: previa.guias })
    toast.success(
      `${previa.resumo.novas} nova(s), ${previa.resumo.atualizadas} atualizada(s)`
      + (previa.resumo.conflitos ? `, ${previa.resumo.conflitos} edição(ões) sua(s) sobrescrita(s)` : ''),
    )
    setPrevia(null)
    arquivoPendente.current = null
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

      <PainelDeAlertas />

      {!semDado && <ResumoExecutivo linhas={linhas} />}

      {!semDado && (
        <div className="flex flex-wrap justify-end gap-2 border-b border-[#525252] px-6 py-2">
          {useSabespStore.getState().arquivoOriginal && (
            <button type="button" onClick={() => { const a = useSabespStore.getState().arquivoOriginal!; void baixarArquivoOriginal(a.path, a.nome).catch(() => toast.error('Não foi possível baixar o arquivo original.')) }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#d4d4d4] hover:bg-[#333]">
              <Download size={13} /> Arquivo original
            </button>
          )}
          <button type="button" onClick={() => exportarWorkbookCompleto(abas, linhas, guias)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#d4d4d4] hover:bg-[#333]">
            <FileDown size={13} /> Exportar tudo
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#d4d4d4] hover:bg-[#333]">
            <FileDown size={13} /> Imprimir / PDF
          </button>
        </div>
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

// ─── Os alertas que a planilha gera ───────────────────────────────────────────

/**
 * ⚠️ Os alertas saem do DADO IMPORTADO, é o que o cliente pediu ("a planilha vai gerar alertas e
 * atividades desses dados"). A conta mora em `alertasOperacionais.ts`, pura e testada — na versão
 * anterior ela vivia dentro de um `useMemo` do painel, sem teste, e uma das regras acusava
 * "NÃO HÁ RESTRIÇÃO" de ser uma restrição pendente.
 */
function PainelDeAlertas() {
  const linhas = useSabespStore((s) => s.linhas)
  const alertas = useMemo(() => alertasDaOperacao(linhas), [linhas])
  const [aberto, setAberto] = useState(false)
  if (alertas.length === 0) return null

  const altos = alertas.filter((a) => a.gravidade === 'alta').length
  const mostrar = aberto ? alertas : alertas.slice(0, 4)

  return (
    <div className="border-b border-[#525252] bg-[#eab308]/[0.07] px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle size={14} className="text-[#fbbf24]" />
        <span className="text-xs font-semibold text-[#fbbf24]">
          {alertas.length} pendência(s) na planilha
          {altos > 0 && <span className="ml-1 font-normal text-[#fca5a5]">· {altos} de prioridade alta</span>}
        </span>
        {alertas.length > 4 && (
          <button type="button" onClick={() => setAberto((v) => !v)} className="text-[11px] text-[#d1a54a] underline-offset-2 hover:underline">
            {aberto ? 'ver menos' : `ver todas as ${alertas.length}`}
          </button>
        )}
      </div>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {mostrar.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-[11px] leading-5">
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', a.gravidade === 'alta' ? 'bg-[#ef4444]' : 'bg-[#eab308]')} />
            <span className="text-[#e5e5e5]">{a.titulo}</span>
            <span className="text-[#8a8a8a]">— {definicaoDaAba(a.aba).label} · {a.chave}</span>
          </li>
        ))}
      </ul>
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
  const [telaCheia, setTelaCheia] = useState(false)
  const [quebrarTexto, setQuebrarTexto] = useState(false)
  const criarLinha = useSabespStore((s) => s.criarLinha)
  const duplicarLinha = useSabespStore((s) => s.duplicarLinha)
  const alternarLinha = useSabespStore((s) => s.alternarLinha)
  const desfazer = useSabespStore((s) => s.desfazer)

  const colunas = useMemo(() => (meta?.colunas ?? []).filter((c) =>
    c.temTitulo || linhas.some((l) => !!l.valores[chaveDaColuna(c)])), [meta, linhas])

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return linhas
    return linhas.filter((l) => Object.values(l.valores).some((v) => String(v).toLowerCase().includes(t)))
  }, [linhas, busca])

  const colarBloco = (linhaInicial: number, colunaInicial: number, texto: string) => {
    const grade = texto.replace(/\r/g, '').split('\n').filter((r, i, a) => r || i < a.length - 1).map((r) => r.split('\t'))
    grade.forEach((valores, dr) => valores.forEach((v, dc) => {
      const linha = visiveis[linhaInicial + dr]
      const coluna = colunas[colunaInicial + dc]
      if (linha && coluna) onEditar(linha.id, chaveDaColuna(coluna), v)
    }))
    toast.success(`${grade.reduce((n, r) => n + r.length, 0)} célula(s) colada(s)`)
  }

  if (!meta) {
    return (
      <div className="rounded-xl border border-dashed border-[#525252] px-4 py-12 text-center text-xs text-[#a3a3a3]">
        Esta aba ainda não foi importada.
      </div>
    )
  }

  if (aba === 'configuracoes') return <ConfiguracoesEstruturadas />
  if (aba === 'carteira_ticket' || aba === 'resumo' || aba === 'dashboard' || aba === 'planejado_realizado') return <PainelMatriz meta={meta} titulo={def.label} />

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-2', telaCheia && 'fixed inset-4 z-50 rounded-xl border border-[#525252] bg-[#1f1f1f] p-4 shadow-2xl')}>
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
        <button type="button" onClick={() => setQuebrarTexto((v) => !v)} className="rounded-lg border border-[#525252] px-2 py-1 text-[11px] text-[#a3a3a3]">{quebrarTexto ? 'Texto compacto' : 'Mostrar texto completo'}</button>
        <button type="button" onClick={() => setTelaCheia((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-[#525252] px-2 py-1 text-[11px] text-[#a3a3a3]"><Expand size={12} /> {telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}</button>
        <button type="button" onClick={() => exportarAba(aba, meta, visiveis, 'xlsx')} className="inline-flex items-center gap-1 rounded-lg border border-[#525252] px-2 py-1 text-[11px] text-[#a3a3a3]"><FileDown size={12} /> Excel</button>
        <button type="button" onClick={() => exportarAba(aba, meta, visiveis, 'csv')} className="rounded-lg border border-[#525252] px-2 py-1 text-[11px] text-[#a3a3a3]">CSV</button>
        {!def.readonly && podeEscrever && <button type="button" onClick={() => criarLinha(aba)} className="inline-flex items-center gap-1 rounded-lg bg-[#f97316] px-2 py-1 text-[11px] font-semibold text-white"><Plus size={12} /> Linha</button>}
        <button type="button" onClick={desfazer} className="inline-flex items-center gap-1 rounded-lg border border-[#525252] px-2 py-1 text-[11px] text-[#a3a3a3]"><RotateCcw size={12} /> Desfazer</button>
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
                <th key={c.indice} className="min-w-32 resize-x overflow-auto whitespace-nowrap px-3 py-2 font-medium" title={c.regra?.mensagem}>
                  {c.temTitulo ? c.titulo : <span className="text-[#a3a3a3]">Campo auxiliar {c.indice + 1}</span>}
                  {c.regra?.tipo === 'lista' && <span className="ml-1 text-[9px] text-[#f97316]">lista</span>}
                  {c.regra?.tipo === 'data' && <span className="ml-1 text-[9px] text-[#60a5fa]">data</span>}
                  {c.regra?.tipo === 'numero' && <span className="ml-1 text-[9px] text-[#a78bfa]">nº</span>}
                  {c.regra?.obrigatorio && <span className="ml-0.5 text-[#fca5a5]">*</span>}
                </th>
              ))}
              {!def.readonly && <th className="sticky right-0 min-w-20 bg-[#3d3d3d] px-3 py-2">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l, linhaIndex) => (
              <tr key={l.id} className={cn('border-t border-[#525252] odd:bg-white/[0.015] hover:bg-white/[0.035]', !l.ativa && 'opacity-50')}>
                {colunas.map((c, colunaIndex) => {
                  const campo = chaveDaColuna(c)
                  return (
                    <td key={c.indice} className={cn('px-1 py-0.5 align-top', quebrarTexto ? 'max-w-96 whitespace-normal' : 'max-w-64')}>
                      <CelulaEditavel
                        valor={l.valores[campo] ?? ''}
                        regra={c.regra}
                        somenteLeitura={!podeEscrever || !!def.readonly || !l.ativa}
                        onGravar={(v) => onEditar(l.id, campo, v)}
                        onColarBloco={(texto) => colarBloco(linhaIndex, colunaIndex, texto)}
                      />
                    </td>
                  )
                })}
                {!def.readonly && <td className="sticky right-0 bg-[#252525] px-2"><div className="flex gap-1"><button title="Duplicar" onClick={() => duplicarLinha(l.id)} className="p-1 text-[#a3a3a3] hover:text-white"><Copy size={12} /></button><button title={l.ativa ? 'Arquivar' : 'Restaurar'} onClick={() => alternarLinha(l.id)} className="p-1 text-[#a3a3a3] hover:text-white"><Archive size={12} /></button></div></td>}
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

function normalizarCampo(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

function valor(l: { valores: Record<string, string> }, ...nomes: string[]) {
  const alvos = nomes.map(normalizarCampo)
  const achado = Object.entries(l.valores).find(([k]) => alvos.includes(normalizarCampo(k)))
  return achado?.[1] ?? ''
}

function numero(v: string) {
  let limpo = v.replace(/R\$\s?/g, '').replace(/%/g, '').replace(/\s/g, '')
  const ultimaVirgula = limpo.lastIndexOf(',')
  const ultimoPonto = limpo.lastIndexOf('.')
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    limpo = ultimaVirgula > ultimoPonto ? limpo.replace(/\./g, '').replace(',', '.') : limpo.replace(/,/g, '')
  } else if (ultimaVirgula >= 0) limpo = limpo.replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : 0
}

function ResumoExecutivo({ linhas }: { linhas: ReturnType<typeof useSabespStore.getState>['linhas'] }) {
  const [contrato, setContrato] = useState('TODOS')
  const [equipe, setEquipe] = useState('TODAS')
  const [status, setStatus] = useState('TODOS')
  const equipes = useMemo(() => [...new Set(linhas.map((l) => valor(l, 'EQUIPE')).filter(Boolean))].sort(), [linhas])
  const statuses = useMemo(() => [...new Set(linhas.map((l) => valor(l, 'STATUS DA OS', 'STATUS')).filter(Boolean))].sort(), [linhas])
  const ativas = useMemo(() => linhas.filter((l) => l.ativa
    && (contrato === 'TODOS' || normalizarCampo(valor(l, 'CONTRATO')) === contrato)
    && (equipe === 'TODAS' || valor(l, 'EQUIPE') === equipe)
    && (status === 'TODOS' || valor(l, 'STATUS DA OS', 'STATUS') === status)), [linhas, contrato, equipe, status])
  const servicos = ativas.filter((l) => l.aba === 'cadastro_servicos')
  const os = ativas.filter((l) => l.aba === 'ordens_servico')
  const ocorrencias = ativas.filter((l) => l.aba === 'ocorrencias')
  const medicoes = ativas.filter((l) => l.aba === 'medicao')
  const executados = os.filter((l) => /CONCLU|EXECUT/.test(normalizarCampo(valor(l, 'STATUS DA OS', 'STATUS')))).length
  const atrasados = servicos.filter((l) => /VENC|ATRAS/.test(normalizarCampo(valor(l, 'SITUAÇÃO DO PRAZO', 'PENDÊNCIA', 'STATUS')))).length
  const abertos = ocorrencias.filter((l) => /ABERT|PENDENTE|ANDAMENTO/.test(normalizarCampo(valor(l, 'STATUS')))).length
  const medido = medicoes.reduce((s, l) => s + numero(valor(l, 'VALOR MEDIDO', 'VALOR BRUTO', 'VALOR')), 0)
  const cards = [
    ['Serviços', servicos.length.toLocaleString('pt-BR')], ['Executados', executados.toLocaleString('pt-BR')],
    ['Atrasados', atrasados.toLocaleString('pt-BR')], ['Ocorrências abertas', abertos.toLocaleString('pt-BR')],
    ['Valor medido', medido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
  ]
  const totalStatus = Math.max(1, os.length)
  return <div className="border-b border-[#525252] px-6 py-3">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-[#f5f5f5]">Visão executiva</p><div className="flex flex-wrap gap-2"><select value={contrato} onChange={(e) => setContrato(e.target.value)} className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs text-white"><option value="TODOS">Todos os contratos</option><option value="BERTIOGA">Bertioga</option><option value="SANTOS">Santos</option></select><select value={equipe} onChange={(e) => setEquipe(e.target.value)} className="max-w-44 rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs text-white"><option value="TODAS">Todas as equipes</option>{equipes.map((x) => <option key={x}>{x}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-48 rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs text-white"><option value="TODOS">Todos os status</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select></div></div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">{cards.map(([r, v]) => <div key={r} className="rounded-xl border border-[#525252] bg-[#292929] px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-[#8a8a8a]">{r}</p><p className="mt-1 text-lg font-semibold text-[#f5f5f5]">{v}</p></div>)}</div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#333]" title={`${executados} de ${os.length} OS executadas`}><div className="h-full bg-[#22c55e] transition-all" style={{ width: `${Math.min(100, executados / totalStatus * 100)}%` }} /></div>
  </div>
}

function ConfiguracoesEstruturadas() {
  const parametros = useSabespStore((s) => s.configuracoes)
  const porSecao = useMemo(() => {
    const m = new Map<string, typeof parametros>()
    for (const p of parametros) { const k = p.secao || 'Parâmetros gerais'; m.set(k, [...(m.get(k) ?? []), p]) }
    return [...m.entries()]
  }, [parametros])
  return <div className="min-h-0 flex-1 overflow-auto"><div className="grid gap-3 lg:grid-cols-2">{porSecao.map(([secao, itens]) => <section key={secao} className="rounded-xl border border-[#525252] bg-[#292929]"><h3 className="border-b border-[#525252] px-4 py-2 text-xs font-semibold text-[#ffa055]">{secao}</h3><dl>{itens.map((p) => <div key={p.celula} className="grid grid-cols-[minmax(12rem,1fr)_1fr] gap-3 border-b border-[#3d3d3d] px-4 py-2 text-xs last:border-0"><dt className="text-[#a3a3a3]">{p.rotulo}</dt><dd className="break-words text-[#f5f5f5]">{p.valor || '—'}</dd></div>)}</dl></section>)}</div></div>
}

function PainelMatriz({ meta, titulo }: { meta: AbaNoSistema; titulo: string }) {
  const linhas = (meta.matriz ?? []).filter((r) => r.some(Boolean))
  const blocos: Array<{ titulo: string; linhas: string[][] }> = []
  let atual = { titulo, linhas: [] as string[][] }; blocos.push(atual)
  for (const linha of linhas) {
    const primeiro = linha.find(Boolean) ?? ''
    if (/^[A-Z]\s*[·—-]|DASHBOARD|RESUMO|PLANEJADO/i.test(primeiro) && linha.filter(Boolean).length === 1) { atual = { titulo: primeiro, linhas: [] }; blocos.push(atual) }
    else atual.linhas.push(linha)
  }
  return <div className="min-h-0 flex-1 overflow-auto"><div className="grid gap-3 xl:grid-cols-2">{blocos.filter((b) => b.linhas.length).map((b, i) => <section key={`${b.titulo}-${i}`} className="overflow-auto rounded-xl border border-[#525252] bg-[#292929]"><h3 className="sticky left-0 border-b border-[#525252] px-4 py-2 text-xs font-semibold text-[#ffa055]">{b.titulo}</h3><table className="min-w-full text-xs"><tbody>{b.linhas.map((r, ri) => <tr key={ri} className="border-b border-[#3d3d3d] odd:bg-white/[0.015]">{r.filter((v, ci) => v || r.some((x, xi) => xi > ci && x)).map((v, ci) => <td key={ci} className="min-w-28 whitespace-normal break-words px-3 py-2 text-[#d4d4d4]">{v || '—'}</td>)}</tr>)}</tbody></table></section>)}</div></div>
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
