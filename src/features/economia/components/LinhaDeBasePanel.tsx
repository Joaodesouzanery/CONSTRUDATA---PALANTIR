/**
 * A linha de base medida — o único lugar deste módulo que pode virar prova.
 *
 * ⚠️ **A ordem da tela é deliberada, e é ela que separa a prova do número bonito.**
 *
 * Primeiro o ajuste, depois o dado, e só então o resultado. É a regra do protocolo que o mercado
 * usa para exatamente este problema (o IPMVP, de eficiência energética): o que torna dois períodos
 * comparáveis tem de ser **acordado antes**, não escolhido depois de ver o número. Ajuste escolhido
 * depois é a alavanca que produz o resultado desejado — e quem estiver do outro lado da mesa sabe.
 *
 * Por isso o resultado não aparece enquanto houver impedimento, e os impedimentos aparecem no
 * lugar dele, não embaixo: número com ressalva embaixo é lido sem a ressalva.
 */
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertTriangle, CheckCircle2, Download, Ruler, Upload } from 'lucide-react'
import { hojeLocalISO } from '@/lib/utils'
import type { AjusteAcordado, LinhaDeBaseMedida, MesDaLinhaDeBase } from '@/types'
import type { Matriz } from '@/features/financeiro/utils/controleDeCaixaPlanilha'
import { COLUNAS_MODELO, lerLinhaDeBase, type ProblemaNaLinha } from '../utils/lerLinhaDeBase'
import {
  compararComALinhaDeBase, fraseDoResultado, indicadoresDaLinhaDeBase,
} from '../utils/linhaDeBaseMedida'
import { indicadoresDaProducao, type ProducaoDaPlataforma } from '../utils/producaoDaPlataforma'

const INPUT = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#f97316]/60'
const LABEL = 'block text-[10px] text-[#6b6b6b] uppercase mb-1'
const BTN_P = 'px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const BTN_S = 'inline-flex items-center gap-1.5 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-xs font-semibold text-[#e5e5e5] hover:border-[#f97316]/50 hover:text-[#f97316] transition-colors'

const brl = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number | null | undefined, casas = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

interface Props {
  obraId: string | null
  obraNome: string
  /** O que a plataforma mediu na janela — quantidade, custo, HH — já na unidade declarada. */
  producao: ProducaoDaPlataforma
  /** A janela do lado "depois", em meses, e o controle dela. */
  mesesDaJanela: number
  setMesesDaJanela: (n: number) => void
  janela: string[]
  linhaDeBase: LinhaDeBaseMedida | null
  onSalvar: (base: LinhaDeBaseMedida) => void
  /** Muda a unidade lá em cima, porque é ela que define o que a produção soma. */
  unidade: string
  setUnidade: (u: string) => void
}

const AJUSTE_VAZIO: AjusteAcordado = {
  unidade: 'm²', servicos: [], inflacao: 0, ressalvas: '', acordadoPor: '', acordadoEm: '',
}

export function LinhaDeBasePanel({
  obraId, obraNome, producao, mesesDaJanela, setMesesDaJanela, janela,
  linhaDeBase, onSalvar, unidade, setUnidade,
}: Props) {
  const [ajuste, setAjuste] = useState<AjusteAcordado>(() => linhaDeBase?.ajuste ?? AJUSTE_VAZIO)
  const [meses, setMeses] = useState<MesDaLinhaDeBase[]>(() => linhaDeBase?.meses ?? [])
  const [fonte, setFonte] = useState(linhaDeBase?.fonte ?? '')
  const [problemas, setProblemas] = useState<ProblemaNaLinha[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [salvoAgora, setSalvoAgora] = useState(false)

  const ajusteComUnidade = useMemo(() => ({ ...ajuste, unidade }), [ajuste, unidade])

  const rascunho: LinhaDeBaseMedida = useMemo(() => ({
    id: linhaDeBase?.id ?? `base-medida-${obraId ?? 'sem-obra'}`,
    obraId: obraId ?? '',
    obraNome,
    meses,
    ajuste: ajusteComUnidade,
    fonte,
    criadoEm: linhaDeBase?.criadoEm ?? hojeLocalISO(),
  }), [linhaDeBase, obraId, obraNome, meses, ajusteComUnidade, fonte])

  const comparacao = useMemo(
    () => compararComALinhaDeBase(rascunho, indicadoresDaProducao(producao)),
    [rascunho, producao],
  )

  function baixarModelo() {
    const ws = XLSX.utils.aoa_to_sheet([
      [...COLUNAS_MODELO],
      ['jan/25', 1000, 50000, 800],
      ['fev/25', 1200, 58000, 950],
      ['mar/25', 900, 47000, 720],
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'LINHA DE BASE')
    XLSX.writeFile(wb, `Linha_de_base_${(obraNome || 'obra').replace(/\s+/g, '_')}.xlsx`)
  }

  async function importar(file: File) {
    setErro(null)
    setSalvoAgora(false)
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const primeira = wb.Sheets[wb.SheetNames[0]]
      if (!primeira) throw new Error('A planilha não tem nenhuma aba.')
      const m = XLSX.utils.sheet_to_json(primeira, { header: 1, raw: true, defval: null }) as Matriz
      const r = lerLinhaDeBase(m)
      if (!r.meses.length) {
        setErro('Não encontrei nenhum mês nesta planilha. Confira o cabeçalho — baixe o modelo se precisar.')
        setProblemas(r.problemas)
        return
      }
      setMeses(r.meses)
      setProblemas(r.problemas)
      if (!fonte) setFonte(file.name)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler este arquivo.')
    }
  }

  const antes = indicadoresDaLinhaDeBase(rascunho)
  const podeSalvar = meses.length > 0 && !!ajuste.acordadoPor.trim() && !!ajuste.ressalvas.trim()

  if (!obraId) {
    return (
      <div className="p-10 text-center">
        <Ruler size={24} className="mx-auto mb-2 text-[#525252]" />
        <p className="text-sm text-[#a3a3a3]">Escolha uma obra no seletor do cabeçalho.</p>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-[#6b6b6b]">
          A linha de base é por obra: ela compara a MESMA obra antes e depois. Uma média da carteira
          misturaria contratos diferentes e não provaria nada.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* ── O que esta tela é, e o que ela não é ── */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <div className="flex items-center gap-2">
          <Ruler size={16} className="text-[#f97316]" />
          <p className="text-sm font-semibold text-[#f5f5f5]">Linha de base medida — {obraNome}</p>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#a3a3a3]">
          ⚠️ <strong>Economia nunca é medida diretamente.</strong> Ela é a diferença entre o que
          aconteceu e o que <em>teria</em> acontecido, e o segundo lado não existe para ser
          observado. O que dá para fazer é comparar dois períodos <strong>medidos</strong> da mesma
          obra, declarando antes o que os torna comparáveis.
        </p>
        <p className="mt-1.5 text-[11px] text-[#6b6b6b]">
          Este número <strong>não</strong> se soma ao total estimado dos eventos. São duas coisas
          diferentes, e juntá-las repetiria o erro que este módulo já corrigiu.
        </p>
      </div>

      {/* ── 1. O ajuste, ANTES do dado ── */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <p className="mb-1 text-xs font-semibold text-[#a3a3a3]">1 · O que torna os dois períodos comparáveis</p>
        <p className="mb-3 text-[11px] text-[#6b6b6b]">
          Preencha isto <strong>antes</strong> de olhar o resultado. Ajuste escolhido depois de ver
          o número é a alavanca que produz o número desejado.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Unidade comparada</label>
            <input value={unidade} onChange={(e) => setUnidade(e.target.value)} className={INPUT} placeholder="m², m, un" />
            <p className="mt-0.5 text-[10px] text-[#6b6b6b]">Só serviço nesta unidade entra na conta.</p>
          </div>
          <div>
            <label className={LABEL}>Correção de preço no período (%)</label>
            <input
              type="number" step="0.1"
              value={Number((ajuste.inflacao * 100).toFixed(1))}
              onChange={(e) => setAjuste({ ...ajuste, inflacao: (Number(e.target.value) || 0) / 100 })}
              className={INPUT}
            />
            <p className="mt-0.5 text-[10px] text-[#6b6b6b]">Sem ela, inflação vira “economia”.</p>
          </div>
          <div>
            <label className={LABEL}>Quem acordou o critério</label>
            <input
              value={ajuste.acordadoPor}
              onChange={(e) => setAjuste({ ...ajuste, acordadoPor: e.target.value, acordadoEm: hojeLocalISO() })}
              className={INPUT} placeholder="Nome de quem fechou com o cliente"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className={LABEL}>O que mudou fora da plataforma neste período</label>
          <textarea
            value={ajuste.ressalvas} onChange={(e) => setAjuste({ ...ajuste, ressalvas: e.target.value })}
            rows={2} className={INPUT}
            placeholder="Equipe nova, mudança de escopo, clima, troca de fornecedor, aditivo…"
          />
          <p className="mt-0.5 text-[10px] text-[#6b6b6b]">
            É a pergunta que derruba a maioria das provas de economia. Escreva mesmo que seja “nada”.
          </p>
        </div>
      </div>

      {/* ── 2. O período-espelho ── */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-[#a3a3a3]">2 · O período ANTES da plataforma</p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={baixarModelo} className={BTN_S}>
              <Download size={13} /> Baixar modelo
            </button>
            <label className={`${BTN_P} inline-flex cursor-pointer items-center gap-1.5`}>
              <Upload size={13} /> Importar planilha
              <input
                type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void importar(f); e.target.value = '' }}
              />
            </label>
          </div>
        </div>
        <p className="mb-3 text-[11px] text-[#6b6b6b]">
          Este dado só existe no seu controle — o sistema não tem como medir o passado. Uma linha por
          mês: quanto foi executado, quanto custou e, se você registrar, quantas horas.
        </p>

        {erro && <p className="mb-2 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-[11px] text-red-300">{erro}</p>}

        {problemas.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            <p className="mb-1 font-semibold">
              <AlertTriangle size={12} className="mr-1 inline" />
              {problemas.length} linha(s) não foram lidas
            </p>
            <ul className="space-y-0.5 pl-4">
              {problemas.slice(0, 8).map((p, i) => (
                <li key={i}>
                  Linha {p.linha}{p.coluna ? ` · ${p.coluna}` : ''}: {p.motivo}
                  {p.conteudo ? ` (“${p.conteudo}”)` : ''}
                </li>
              ))}
              {problemas.length > 8 && <li className="text-amber-300/70">…e mais {problemas.length - 8}.</li>}
            </ul>
          </div>
        )}

        {meses.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#6b6b6b]">Nenhum mês carregado ainda.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[#525252]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#1f1f1f] text-[10px] uppercase tracking-wider text-[#a3a3a3]">
                    <th className="px-3 py-2 text-left">Mês</th>
                    <th className="px-3 py-2 text-right">Executado ({unidade})</th>
                    <th className="px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2 text-right">Homens-hora</th>
                    <th className="px-3 py-2 text-right">R$/{unidade}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#525252]/40">
                  {meses.map((m) => (
                    <tr key={m.periodo} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-[#f5f5f5]">{m.periodo}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(m.quantidadeExecutada)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(m.custoBRL)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.homensHora ? num(m.homensHora, 0) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">
                        {m.quantidadeExecutada > 0 ? brl(m.custoBRL / m.quantidadeExecutada) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#1f1f1f]">
                    <td className="px-3 py-2 font-semibold text-[#a3a3a3]">{antes.meses} mês(es)</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">{num(antes.quantidade)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">{brl(antes.custoBRL)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">{antes.homensHora ? num(antes.homensHora, 0) : '—'}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-[#f5f5f5]">{brl(antes.custoPorUnidade)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label className={LABEL}>De onde veio este dado</label>
                <input
                  value={fonte} onChange={(e) => setFonte(e.target.value)} className={INPUT}
                  placeholder="Planilha de controle da obra, contabilidade, medições…"
                />
              </div>
              <button
                type="button" disabled={!podeSalvar}
                title={podeSalvar ? undefined : 'Preencha quem acordou e as ressalvas, e importe ao menos um mês'}
                onClick={() => { onSalvar(rascunho); setSalvoAgora(true) }}
                className={BTN_P}
              >
                {salvoAgora ? 'Salvo' : 'Salvar a linha de base'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── 3. O que a plataforma mediu do outro lado ── */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-[#a3a3a3]">3 · O período COM a plataforma</p>
          <label className="ml-auto flex items-center gap-1.5 text-[10px] uppercase text-[#6b6b6b]">
            Janela
            <select
              value={mesesDaJanela}
              onChange={(e) => setMesesDaJanela(Number(e.target.value))}
              className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs normal-case text-white outline-none focus:border-[#f97316]/60"
            >
              {[1, 2, 3, 4, 6, 9, 12].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'}</option>)}
            </select>
          </label>
        </div>
        <p className="mb-3 text-[11px] text-[#6b6b6b]">
          {janela.length ? `${janela[0]} a ${janela[janela.length - 1]}` : '—'} · quantidade dos RDO
          finalizados desta obra, custo das saídas lançadas nela, horas dos turnos da Escala.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { r: `Executado (${unidade})`, v: num(producao.quantidade) },
            { r: 'Custo lançado', v: brl(producao.custoBRL) },
            { r: 'Homens-hora', v: producao.homensHora === null ? 'sem dado' : num(producao.homensHora, 0) },
            { r: `R$ por ${unidade}`, v: producao.quantidade > 0 ? brl(producao.custoBRL / producao.quantidade) : '—' },
          ].map((c) => (
            <div key={c.r} className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2">
              <p className="text-[10px] uppercase text-[#6b6b6b]">{c.r}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#f5f5f5]">{c.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-[#6b6b6b]">
          {producao.rdosLidos} RDO finalizado(s) lido(s)
          {producao.rdosRascunho > 0 && ` · ${producao.rdosRascunho} em rascunho, fora da conta`}
        </p>
        {producao.ignoradoPorUnidade.length > 0 && (
          /* ⚠️ O que não casa com a unidade não some da tela: se ele sumisse, a pessoa nunca saberia
             que metade da produção ficou de fora, e leria o R$/unidade como se fosse tudo. */
          <p className="mt-1.5 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-[10px] text-[#a3a3a3]">
            Fora da conta, por serem de outra unidade:{' '}
            {producao.ignoradoPorUnidade.map((u) => `${num(u.quantidade)} ${u.unidade}`).join(' · ')}.
            Somar unidades diferentes diluiria o R$/{unidade} e pareceria economia.
          </p>
        )}
      </div>

      {/* ── 4. A comparação, por último ── */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <p className="mb-3 text-xs font-semibold text-[#a3a3a3]">4 · A comparação</p>

        {comparacao.impedimentos.length > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-200">
            <p className="mb-1.5 font-semibold">
              <AlertTriangle size={12} className="mr-1 inline" />
              A comparação ainda não se sustenta. Falta:
            </p>
            <ul className="list-disc space-y-1 pl-4">
              {comparacao.impedimentos.map((i, k) => <li key={k}>{i}</li>)}
            </ul>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-[#f97316]/30 bg-[#f97316]/10 px-3 py-2.5">
              <p className="text-sm text-[#f5f5f5]">{fraseDoResultado(comparacao, unidade)}</p>
              <p className="mt-1 text-[10px] text-[#a3a3a3]">
                Antes {brl(comparacao.antes.custoPorUnidade)}/{unidade}
                {ajuste.inflacao !== 0 && <> (corrigido: {brl(comparacao.custoPorUnidadeAntesCorrigido)})</>}
                {' · '}depois {brl(comparacao.depois.custoPorUnidade)}/{unidade}
              </p>
            </div>

            {comparacao.veredictoHh !== 'nao-comparavel' && (
              <p className="mt-2 text-[11px] text-[#a3a3a3]">
                Produtividade: {num(comparacao.antes.hhPorUnidade, 3)} → {num(comparacao.depois.hhPorUnidade, 3)} HH/{unidade}
                {' — '}
                <span className={
                  comparacao.veredictoHh === 'melhorou' ? 'text-emerald-300'
                    : comparacao.veredictoHh === 'piorou' ? 'text-red-300' : ''
                }>
                  {comparacao.veredictoHh === 'melhorou' ? 'menos horas por unidade'
                    : comparacao.veredictoHh === 'piorou' ? 'mais horas por unidade'
                      : 'praticamente igual'}
                </span>
              </p>
            )}

            {/* ⚠️ A ressalva viaja junto com o resultado. É ela que faz a diferença entre um
                argumento e uma peça de propaganda. */}
            <div className="mt-3 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-[11px] text-[#a3a3a3]">
              <p className="mb-1 flex items-center gap-1.5 text-[#6b6b6b]">
                <CheckCircle2 size={12} /> Critério acordado por {ajuste.acordadoPor || '—'}
                {ajuste.acordadoEm && ` em ${ajuste.acordadoEm.split('-').reverse().join('/')}`}
                {fonte && ` · fonte do período anterior: ${fonte}`}
              </p>
              <p>{ajuste.ressalvas}</p>
              <p className="mt-1.5 text-[10px] text-[#6b6b6b]">
                Isto compara dois períodos medidos da mesma obra. <strong>Não é a diferença entre
                ter e não ter a plataforma</strong> — esse número não existe para ser observado, e
                quem disser que mediu está estimando.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
