/**
 * Controle de Caixa — o livro-caixa da obra, alimentado pela planilha.
 *
 * ⚠️ **A via principal de lançamento é a planilha, não esta tela.** A equipe mexe no arquivo o mês
 * inteiro e joga no sistema; o formulário daqui existe para correção pontual, e diz isso na cara.
 * É por essa razão que o botão de importar fica no topo, sempre visível, e o de lançar à mão vive
 * dentro da sub-aba.
 *
 * Os lançamentos são `FinanceiroEntry` — os mesmos do resto do módulo. Não há tabela paralela: o
 * que entra aqui aparece sozinho no DRE, no Fluxo de Caixa, na Visão Geral, no Por Obra e no
 * Plano de Contas, porque essas telas leem a mesma lista.
 */
import { Fragment, useMemo, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, CheckCheck, Download, Plus, Trash2, Upload, Wallet, X,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { SubTabHost } from '@/components/shared/SubTabHost'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useAuth } from '@/lib/auth'
import { useEnvioUnico } from '@/hooks/useEnvioUnico'
import { fmtBRL } from '@/features/financeiro/lib/financeiroCalc'
import { fmtDataBR, hojeLocalISO } from '@/lib/utils'
import { Autoria } from '@/components/shared/Autoria'
import { ImportarCaixaModal } from './ImportarCaixaModal'
import { baixarPlanilhaModelo, rotuloDaCategoria, CATEGORIAS_DA_PLANILHA } from '../utils/controleDeCaixaModelo'
import type { EntradaCategoria, FinanceiroEntry, SaidaCategoria } from '@/types'

const INPUT = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#f97316]/60'
const LABEL = 'block text-[10px] text-[#6b6b6b] uppercase mb-1'
const BTN_PRIMARIO = 'px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-40'
const BTN_SECUNDARIO = 'inline-flex items-center gap-1.5 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-xs font-semibold text-[#e5e5e5] hover:border-[#f97316]/50 hover:text-[#f97316] transition-colors disabled:opacity-40'

const ROTULO_ORIGEM: Record<string, string> = {
  planilha: 'Planilha',
  manual: 'Lançado na tela',
  'horas-extras': 'Hora extra',
}

/** Só o que passou pelo Controle de Caixa. O resto do Financeiro tem suas próprias telas. */
function ehDoCaixa(e: FinanceiroEntry): boolean {
  return e.origem === 'planilha' || e.origem === 'manual' || e.origem === 'horas-extras'
}

export function ControleDeCaixaPanel() {
  const { entries, addEntry, updateEntry, removeEntry } = useFinanceiroStore(
    useShallow((s) => ({
      entries: s.entries, addEntry: s.addEntry, updateEntry: s.updateEntry, removeEntry: s.removeEntry,
    })),
  )
  const sites = useTorreStore((s) => s.sites)
  const workers = useMaoDeObraStore((s) => s.workers)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const profile = useAuth((s) => s.profile)

  const [importando, setImportando] = useState(false)

  const doCaixa = useMemo(
    () => entries.filter(ehDoCaixa).sort((a, b) => b.data.localeCompare(a.data)),
    [entries],
  )

  const hoje = hojeLocalISO()
  const mesCorrente = Number(hoje.slice(5, 7))
  const anoCorrente = Number(hoje.slice(0, 4))

  function baixarModelo() {
    baixarPlanilhaModelo({
      entries: doCaixa,
      pessoas: workers
        .filter((w) => w.status !== 'inactive')
        .map((w) => ({ nome: w.name, cargo: w.role })),
      mes: mesCorrente,
      ano: anoCorrente,
    })
  }

  function gravarImportados(lancamentos: FinanceiroEntry[]) {
    // `addEntry` é UPSERT por id — reimportar substitui, não duplica.
    for (const l of lancamentos) addEntry(l, { respectObra: true })
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* A regra do cliente, dita na tela */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15 shrink-0">
          <Wallet size={18} className="text-[#f97316]" />
        </div>
        <div className="min-w-0">
          <p className="text-[#f5f5f5] text-sm font-semibold leading-none">A planilha é a via principal</p>
          <p className="text-[#6b6b6b] text-[11px] mt-1">
            Preencha o arquivo durante o mês e jogue aqui quantas vezes quiser. Nada é gravado sem
            você conferir, e nada é apagado. Lançar na tela é para correção pontual.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={baixarModelo} className={BTN_SECUNDARIO}>
            <Download size={13} /> Baixar planilha
          </button>
          <button type="button" onClick={() => setImportando(true)} className={`${BTN_PRIMARIO} inline-flex items-center gap-1.5`}>
            <Upload size={13} /> Importar planilha
          </button>
        </div>
      </div>

      <SubTabHost
        tabs={[
          { key: 'lancamentos', label: 'Lançamentos', render: () => (
            <LancamentosSub
              doCaixa={doCaixa} sites={sites} addEntry={addEntry} removeEntry={removeEntry} hoje={hoje}
            />
          ) },
          { key: 'horas-extras', label: 'Horas Extras', render: () => (
            <HorasExtrasSub doCaixa={doCaixa} mes={mesCorrente} ano={anoCorrente} />
          ) },
          { key: 'conferencia', label: 'Conferência', render: () => (
            <ConferenciaSub
              doCaixa={doCaixa} updateEntry={updateEntry}
              quem={profile?.full_name ?? profile?.email ?? 'alguém'}
            />
          ) },
          { key: 'relatorios', label: 'Relatórios', render: () => (
            <RelatoriosSub doCaixa={doCaixa} sites={sites} />
          ) },
        ]}
      />

      {importando && (
        <ImportarCaixaModal
          entries={entries}
          orgId={profile?.organization_id}
          obraId={activeObraId ?? undefined}
          onGravar={gravarImportados}
          onClose={() => setImportando(false)}
        />
      )}
    </div>
  )
}

// ─── Lançamentos ──────────────────────────────────────────────────────────────

function LancamentosSub({
  doCaixa, sites, addEntry, removeEntry, hoje,
}: {
  doCaixa: FinanceiroEntry[]
  sites: Array<{ id: string; name: string }>
  addEntry: (e: FinanceiroEntry, o?: { respectObra?: boolean }) => void
  removeEntry: (id: string) => void
  hoje: string
}) {
  const [origem, setOrigem] = useState('')
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)

  const filtrados = useMemo(() => doCaixa.filter((e) => {
    if (origem && e.origem !== origem) return false
    if (tipo && e.tipo !== tipo) return false
    if (busca) {
      const alvo = `${e.descricao} ${(e.solicitantes ?? []).join(' ')} ${e.funcionarioNome ?? ''}`.toLowerCase()
      if (!alvo.includes(busca.toLowerCase())) return false
    }
    return true
  }), [doCaixa, origem, tipo, busca])

  const receitas = filtrados.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0)
  const despesas = filtrados.filter((e) => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0)
  const nomeDaObra = (id?: string) => sites.find((s) => s.id === id)?.name ?? '—'

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Indicador rotulo="Receitas" valor={fmtBRL(receitas)} icone={<ArrowUpCircle size={14} className="text-emerald-400" />} />
        <Indicador rotulo="Despesas" valor={fmtBRL(despesas)} icone={<ArrowDownCircle size={14} className="text-red-400" />} />
        <Indicador rotulo="Saldo" valor={fmtBRL(receitas - despesas)} icone={<Wallet size={14} className="text-[#f97316]" />} />
        <Indicador rotulo="Lançamentos" valor={String(filtrados.length)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição ou solicitante…"
          className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60 min-w-[220px]"
        />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60">
          <option value="">Receitas e despesas</option>
          <option value="entrada">Só receitas</option>
          <option value="saida">Só despesas</option>
        </select>
        <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60">
          <option value="">Toda origem</option>
          {Object.entries(ROTULO_ORIGEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" onClick={() => setNovo(true)} className={`${BTN_SECUNDARIO} ml-auto`}>
          <Plus size={13} /> Correção pontual
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm rounded-xl border border-dashed border-[#525252]">
          {doCaixa.length === 0
            ? 'Nenhum lançamento ainda. Baixe a planilha, preencha e importe.'
            : 'Nada com esses filtros.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-left">Solicitante</th>
                <th className="px-3 py-2 text-left">Obra</th>
                <th className="px-3 py-2 text-left">Origem</th>
                <th className="px-3 py-2 text-left">Conferido</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {filtrados.slice(0, 500).map((e) => (
                <Fragment key={e.id}>
                <tr
                  onClick={() => setAberto(aberto === e.id ? null : e.id)}
                  className="hover:bg-white/[0.02] group cursor-pointer"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-[#a3a3a3]">
                    {fmtDataBR(e.data)}
                    {e.dataFim && <span className="text-[#6b6b6b]"> a {fmtDataBR(e.dataFim)}</span>}
                  </td>
                  <td className="px-3 py-2 text-[#f5f5f5] max-w-md truncate">{e.descricao}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${e.tipo === 'entrada' ? 'text-emerald-300' : 'text-[#f5f5f5]'}`}>
                    {e.tipo === 'entrada' ? '+' : '−'} {fmtBRL(e.valor)}
                  </td>
                  <td className="px-3 py-2 text-[#a3a3a3]">{rotuloDaCategoria(e.categoria)}</td>
                  <td className="px-3 py-2 text-[#a3a3a3]">
                    {(e.solicitantes ?? []).join(' + ') || e.funcionarioNome || '—'}
                  </td>
                  <td className="px-3 py-2 text-[#a3a3a3]">{nomeDaObra(e.obraId)}</td>
                  <td className="px-3 py-2 text-[10px] text-[#6b6b6b]">{ROTULO_ORIGEM[e.origem ?? ''] ?? '—'}</td>
                  <td className="px-3 py-2">
                    {e.conferido
                      ? <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Conferido</span>
                      : <span className="text-[10px] text-[#6b6b6b]">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        type="button"
                        title={`Excluir ${e.descricao}`}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          if (confirm(`Excluir “${e.descricao}”?\n\nO lançamento sai do caixa e do DRE.`)) removeEntry(e.id)
                        }}
                        className="text-[#6b6b6b] hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                {aberto === e.id && (
                  <tr>
                    <td colSpan={9} className="px-3 py-2 bg-[#262626]">
                      {/* Quem lançou e quem alterou. Num livro-caixa é a pergunta que mais aparece
                          quando um número não fecha — e o Histórico mostra a edição campo a campo. */}
                      <Autoria tabela="financeiro_entries" registroId={e.id} />
                      {e.conferido && e.conferidoPor && (
                        <p className="text-[11px] text-[#6b6b6b] mt-1">
                          Conferido por <span className="text-[#a3a3a3]">{e.conferidoPor}</span>
                          {e.conferidoEm ? ` em ${fmtDataBR(e.conferidoEm.slice(0, 10))}` : ''}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtrados.length > 500 && (
        <p className="text-[11px] text-[#6b6b6b]">Mostrando 500 de {filtrados.length}. Use os filtros para estreitar.</p>
      )}

      {novo && (
        <FormularioDeCorrecao
          sites={sites} hoje={hoje}
          onSalvar={(e) => { addEntry(e, { respectObra: true }); setNovo(false) }}
          onClose={() => setNovo(false)}
        />
      )}
    </div>
  )
}

// ─── Correção pontual ─────────────────────────────────────────────────────────

function FormularioDeCorrecao({
  sites, hoje, onSalvar, onClose,
}: {
  sites: Array<{ id: string; name: string }>
  hoje: string
  onSalvar: (e: FinanceiroEntry) => void
  onClose: () => void
}) {
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hoje)
  const [categoria, setCategoria] = useState<string>('outro')
  const [solicitante, setSolicitante] = useState('')
  const [obraId, setObraId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const travarEnvio = useEnvioUnico()

  const categorias = tipo === 'entrada' ? CATEGORIAS_DA_PLANILHA.entrada : CATEGORIAS_DA_PLANILHA.saida

  function salvar() {
    const n = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!descricao.trim()) return setErro('Escreva a descrição — sem ela não dá para conferir depois.')
    if (!Number.isFinite(n) || n <= 0) return setErro('O valor precisa ser maior que zero.')
    if (!data) return setErro('Escolha a data.')
    if (!travarEnvio()) return

    onSalvar({
      id: crypto.randomUUID(),
      tipo,
      descricao: descricao.trim(),
      valor: n,
      data,
      categoria: (categorias.includes(categoria as never) ? categoria : 'outro') as EntradaCategoria | SaidaCategoria,
      obraId: obraId || undefined,
      solicitantes: solicitante.trim() ? solicitante.split('/').map((s) => s.trim()).filter(Boolean) : undefined,
      origem: 'manual',
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg rounded-xl border border-[#525252] bg-[#2d2d2d] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div>
            <p className="text-sm font-semibold text-white">Correção pontual</p>
            {/* A frase é a política do cliente, e ela vive aqui de propósito: é o momento em que
                alguém está prestes a usar a tela como via principal. */}
            <p className="text-[11px] text-[#9ca3af] mt-0.5">
              A via principal é a planilha. Use isto só para corrigir uma linha.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="inline-flex rounded-lg border border-[#525252] overflow-hidden self-start">
            {(['saida', 'entrada'] as const).map((t) => (
              <button
                key={t} type="button" onClick={() => { setTipo(t); setCategoria('outro') }}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${tipo === t ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-white bg-[#2c2c2c]'}`}
              >
                {t === 'saida' ? 'Despesa' : 'Receita'}
              </button>
            ))}
          </div>

          <div>
            <label className={LABEL}>Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={INPUT} placeholder="Ex.: Diesel — máquina do Jailton" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Valor (R$)</label>
              <input value={valor} onChange={(e) => setValor(e.target.value)} className={INPUT} placeholder="1.000,00" inputMode="decimal" />
            </div>
            <div>
              <label className={LABEL}>Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={INPUT}>
                {categorias.map((c) => <option key={c} value={c}>{rotuloDaCategoria(c)}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Obra</label>
              <select value={obraId} onChange={(e) => setObraId(e.target.value)} className={INPUT}>
                <option value="">Sem obra</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Solicitante (separe por barra para mais de um)</label>
            <input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} className={INPUT} placeholder="DAMIÃO/WELLINGTON" />
          </div>

          {erro && <p className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-[11px] text-red-300">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#525252]">
          <button type="button" onClick={onClose} className={BTN_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={salvar} className={BTN_PRIMARIO}>Lançar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Horas Extras ─────────────────────────────────────────────────────────────

function HorasExtrasSub({ doCaixa, mes, ano }: { doCaixa: FinanceiroEntry[]; mes: number; ano: number }) {
  const [periodo, setPeriodo] = useState(`${ano}-${String(mes).padStart(2, '0')}`)

  const doMes = useMemo(
    () => doCaixa.filter((e) => e.origem === 'horas-extras' && e.data.startsWith(periodo)),
    [doCaixa, periodo],
  )
  const dias = useMemo(
    () => [...new Set(doMes.map((e) => Number(e.data.slice(8, 10))))].sort((a, b) => a - b),
    [doMes],
  )
  const pessoas = useMemo(() => {
    const m = new Map<string, { nome: string; cargo?: string; porDia: Map<number, number> }>()
    for (const e of doMes) {
      const nome = e.funcionarioNome ?? e.descricao
      const p = m.get(nome) ?? { nome, cargo: e.cargo, porDia: new Map<number, number>() }
      const dia = Number(e.data.slice(8, 10))
      p.porDia.set(dia, (p.porDia.get(dia) ?? 0) + e.valor)
      m.set(nome, p)
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [doMes])

  const total = doMes.reduce((s, e) => s + e.valor, 0)

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] text-[#6b6b6b] uppercase">Mês</label>
        <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60" />
        <span className="ml-auto text-xs text-[#a3a3a3]">
          {pessoas.length} pessoa(s) · <strong className="text-[#f5f5f5] tabular-nums">{fmtBRL(total)}</strong>
        </span>
      </div>

      {/* A regra que a planilha do cliente prova, dita na tela. */}
      <p className="text-[11px] text-[#6b6b6b]">
        Só entra aqui a hora extra marcada como <strong className="text-[#a3a3a3]">PG</strong> na planilha —
        a lançada e não paga é previsão, e não move o caixa. O valor é o que está escrito na célula:{' '}
        <strong className="text-[#a3a3a3]">não é deduzido do cargo</strong>, porque na planilha real o mesmo
        cargo aparece com valores diferentes.
      </p>

      {pessoas.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm rounded-xl border border-dashed border-[#525252]">
          Nenhuma hora extra paga neste mês. Importe a planilha com a aba de horas extras preenchida.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Cargo</th>
                {dias.map((d) => <th key={d} className="px-3 py-2 text-right">{String(d).padStart(2, '0')}</th>)}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {pessoas.map((p) => {
                const t = [...p.porDia.values()].reduce((a, b) => a + b, 0)
                return (
                  <tr key={p.nome} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-[#f5f5f5]">{p.nome}</td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{p.cargo ?? '—'}</td>
                    {dias.map((d) => (
                      <td key={d} className="px-3 py-2 text-right tabular-nums text-[#a3a3a3]">
                        {p.porDia.has(d) ? fmtBRL(p.porDia.get(d)!) : '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5] font-semibold">{fmtBRL(t)}</td>
                  </tr>
                )
              })}
              <tr className="bg-[#1f1f1f]">
                <td className="px-3 py-2 font-semibold text-[#a3a3a3]" colSpan={2}>TOTAIS</td>
                {dias.map((d) => (
                  <td key={d} className="px-3 py-2 text-right tabular-nums text-[#a3a3a3]">
                    {fmtBRL(doMes.filter((e) => Number(e.data.slice(8, 10)) === d).reduce((s, e) => s + e.valor, 0))}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5] font-bold">{fmtBRL(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Conferência ──────────────────────────────────────────────────────────────

function ConferenciaSub({
  doCaixa, updateEntry, quem,
}: {
  doCaixa: FinanceiroEntry[]
  updateEntry: (id: string, patch: Partial<FinanceiroEntry>) => void
  quem: string
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const pendentes = useMemo(() => doCaixa.filter((e) => !e.conferido), [doCaixa])
  const conferidos = doCaixa.length - pendentes.length

  function conferir(ids: string[]) {
    const agora = new Date().toISOString()
    for (const id of ids) updateEntry(id, { conferido: true, conferidoPor: quem, conferidoEm: agora })
    setMarcados(new Set())
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Indicador rotulo="A conferir" valor={String(pendentes.length)} />
        <Indicador rotulo="Já conferidos" valor={String(conferidos)} icone={<CheckCheck size={14} className="text-emerald-400" />} />
        <Indicador rotulo="Valor a conferir" valor={fmtBRL(pendentes.reduce((s, e) => s + e.valor, 0))} />
      </div>

      {pendentes.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm rounded-xl border border-dashed border-[#525252]">
          Tudo conferido. {doCaixa.length > 0 && `${doCaixa.length} lançamento(s) no caixa.`}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMarcados(marcados.size === pendentes.length ? new Set() : new Set(pendentes.map((e) => e.id)))}
              className={BTN_SECUNDARIO}
            >
              {marcados.size === pendentes.length ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
            <button
              type="button" disabled={marcados.size === 0}
              onClick={() => conferir([...marcados])}
              className={`${BTN_PRIMARIO} inline-flex items-center gap-1.5`}
            >
              <CheckCheck size={13} /> Conferir {marcados.size > 0 ? marcados.size : ''}
            </button>
            <span className="text-[11px] text-[#6b6b6b] ml-auto">
              Fica registrado quem conferiu e quando.
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#525252]">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-left">Solicitante</th>
                  <th className="px-3 py-2 text-left">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2937]">
                {pendentes.slice(0, 300).map((e) => (
                  <tr key={e.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox" checked={marcados.has(e.id)}
                        onChange={() => setMarcados((s) => {
                          const n = new Set(s)
                          if (n.has(e.id)) n.delete(e.id); else n.add(e.id)
                          return n
                        })}
                        className="accent-[#f97316]"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-[#a3a3a3]">{fmtDataBR(e.data)}</td>
                    <td className="px-3 py-2 text-[#f5f5f5] max-w-md truncate">{e.descricao}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">{fmtBRL(e.valor)}</td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{(e.solicitantes ?? []).join(' + ') || '—'}</td>
                    <td className="px-3 py-2 text-[10px] text-[#6b6b6b]">{ROTULO_ORIGEM[e.origem ?? ''] ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Relatórios ───────────────────────────────────────────────────────────────

function RelatoriosSub({ doCaixa, sites }: { doCaixa: FinanceiroEntry[]; sites: Array<{ id: string; name: string }> }) {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const noPeriodo = useMemo(() => doCaixa.filter((e) => {
    if (de && e.data < de) return false
    if (ate && e.data > ate) return false
    return true
  }), [doCaixa, de, ate])

  const agrupar = (chave: (e: FinanceiroEntry) => string[]) => {
    const m = new Map<string, { receitas: number; despesas: number; n: number }>()
    for (const e of noPeriodo) {
      for (const k of chave(e)) {
        const v = m.get(k) ?? { receitas: 0, despesas: 0, n: 0 }
        if (e.tipo === 'entrada') v.receitas += e.valor; else v.despesas += e.valor
        v.n++
        m.set(k, v)
      }
    }
    return [...m.entries()].sort((a, b) => (b[1].despesas + b[1].receitas) - (a[1].despesas + a[1].receitas))
  }

  const porCategoria = agrupar((e) => [rotuloDaCategoria(e.categoria)])
  const porObra = agrupar((e) => [sites.find((s) => s.id === e.obraId)?.name ?? 'Sem obra'])
  // ⚠️ Um lançamento com dois solicitantes entra nos DOIS — o gasto foi pedido pelos dois. Por
  // isso a soma desta tabela pode passar do total do período, e a tela diz isso.
  const porSolicitante = agrupar((e) => (e.solicitantes?.length ? e.solicitantes : ['Sem solicitante']))

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] text-[#6b6b6b] uppercase">De</label>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60" />
        <label className="text-[10px] text-[#6b6b6b] uppercase">Até</label>
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60" />
        <span className="ml-auto text-xs text-[#a3a3a3]">{noPeriodo.length} lançamento(s)</span>
      </div>

      <Tabela titulo="Por categoria" linhas={porCategoria} />
      <Tabela titulo="Por obra" linhas={porObra} />
      <Tabela
        titulo="Por solicitante"
        linhas={porSolicitante}
        nota="Um gasto pedido por duas pessoas entra nas duas linhas — por isso a soma daqui pode passar do total do período."
      />
    </div>
  )
}

function Tabela({
  titulo, linhas, nota,
}: {
  titulo: string
  linhas: Array<[string, { receitas: number; despesas: number; n: number }]>
  nota?: string
}) {
  const totalD = linhas.reduce((s, [, v]) => s + v.despesas, 0)
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-[#a3a3a3]">{titulo}</p>
      {nota && <p className="text-[10px] text-[#6b6b6b]">{nota}</p>}
      {linhas.length === 0 ? (
        <p className="text-[11px] text-[#6b6b6b] py-4">Sem dados no período.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">{titulo.replace('Por ', '')}</th>
                <th className="px-3 py-2 text-right">Lançamentos</th>
                <th className="px-3 py-2 text-right">Receitas</th>
                <th className="px-3 py-2 text-right">Despesas</th>
                <th className="px-3 py-2 text-right">% das despesas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {linhas.map(([k, v]) => (
                <tr key={k} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-[#f5f5f5]">{k}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#a3a3a3]">{v.n}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-300">{v.receitas ? fmtBRL(v.receitas) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">{v.despesas ? fmtBRL(v.despesas) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#a3a3a3]">
                    {totalD > 0 && v.despesas ? `${((v.despesas / totalD) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Peças ────────────────────────────────────────────────────────────────────

function Indicador({ rotulo, valor, icone }: { rotulo: string; valor: string; icone?: React.ReactNode }) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#6b6b6b]">
        {icone}{rotulo}
      </p>
      <p className="mt-1 text-lg font-bold text-[#f5f5f5] tabular-nums">{valor}</p>
    </div>
  )
}
