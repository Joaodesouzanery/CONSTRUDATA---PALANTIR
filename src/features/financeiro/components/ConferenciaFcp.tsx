/**
 * A conferência da importação do FCP, em três níveis.
 *
 * ─── O PROBLEMA QUE ESTA TELA RESOLVE ─────────────────────────────────────────
 * A versão anterior mostrava **3 números** para uma planilha de 11 abas, e o dono do produto
 * perguntou, com razão, se não estava faltando "literalmente tudo". Não estava faltando leitura —
 * estava faltando exibição. Mas a resposta óbvia (despejar as 249 células) seria trocar um
 * problema por outro: ninguém confere uma parede de números.
 *
 * ─── O CRITÉRIO DO CORTE ──────────────────────────────────────────────────────
 * **Cada número visível responde uma pergunta que o diretor faria.**
 *  1. "Quanto bate?"        → a contagem e a barra, sempre visíveis
 *  2. "Por que não bate?"   → as causas, com o impacto em R$ de cada uma
 *  3. "Onde exatamente?"    → a grade, recolhida
 *
 * ⚠️ **Linha que fecha nos doze meses não abre.** É essa regra que impede o despejo: só o rótulo e
 * "fecha ✓". E o filtro "só as que divergem" vem LIGADO — desligá-lo mostra as linhas limpas, que
 * são a evidência de saúde.
 *
 * ⚠️ **`semExplicacao` sobe para o topo, em vermelho.** Uma divergência que o sistema não sabe
 * explicar é a informação mais valiosa da tela, e dissolvê-la no total seria o mesmo erro que a
 * conferência agregada cometia.
 */
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { fmtBRL } from '@/features/financeiro/lib/financeiroCalc'
import type { ConferenciaDaGrade, GradeDaAba, LinhaDaGrade } from '../utils/fcp/conferirGrade'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mesCurto = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`

const valor = (n: number, unidade: 'BRL' | 'FRACAO') =>
  unidade === 'FRACAO' ? `${(n * 100).toFixed(2)}%` : fmtBRL(n)

export function ConferenciaFcp({ grade }: { grade: ConferenciaDaGrade }) {
  const [verGrade, setVerGrade] = useState(false)
  const pctFecha = grade.total > 0 ? Math.round((grade.fecham / grade.total) * 100) : 0

  if (grade.total === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {/* ── Nível 1 · quanto bate ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <Numero n={grade.total} rotulo="conferências" />
          <Numero n={grade.fecham} rotulo="fecham ao centavo" cor="text-emerald-300" />
          <Numero n={grade.divergem} rotulo="divergem" cor={grade.divergem > 0 ? 'text-amber-300' : undefined} />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1f1f1f]">
          <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pctFecha}%` }} />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#d4d4d4]">
          {grade.divergem === 0 ? (
            <><CheckCircle2 size={12} className="mr-1 inline text-emerald-400" />
            Tudo bate. As contas da planilha e as do sistema chegam no mesmo número.</>
          ) : (
            <>
              As {grade.divergem} têm {grade.causas.length}{' '}
              {grade.causas.length === 1 ? 'causa' : 'causas'}, e{' '}
              {grade.causas.length === 1 ? 'ela se prova' : 'todas se provam'} dentro da própria
              planilha.{' '}
              {grade.semExplicacao === 0
                ? <b className="text-emerald-300">Nenhuma divergência ficou sem explicação.</b>
                : null}
            </>
          )}
        </p>
      </div>

      {/* ── O que ninguém sabe explicar vem ANTES das causas ──────────────── */}
      {grade.semExplicacao > 0 && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-3">
          <p className="text-[11px] font-semibold text-red-300">
            <AlertTriangle size={12} className="mr-1 inline" />
            {grade.semExplicacao}{' '}
            {grade.semExplicacao === 1 ? 'divergência que o sistema não sabe explicar'
                                       : 'divergências que o sistema não sabe explicar'}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[#d4d4d4]">
            As outras têm causa apontada e conta fechada. {grade.semExplicacao === 1 ? 'Esta' : 'Estas'}{' '}
            não — abra a grade abaixo e procure {grade.semExplicacao === 1 ? 'a célula' : 'as células'}{' '}
            sem causa. É o tipo de coisa que costuma ser fórmula quebrada ou célula digitada por cima.
          </p>
        </div>
      )}

      {/* ── Nível 2 · por que não bate ────────────────────────────────────── */}
      {grade.causas.map((c) => (
        <div key={c.id} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold text-[#f5f5f5]">{c.titulo}</p>
            <span className="text-[10px] text-[#6b6b6b]">
              {c.celulas} {c.celulas === 1 ? 'célula' : 'células'}
            </span>
          </div>
          <p className="mt-1.5 text-[11px]">
            <span className="text-[#a3a3a3]">move o resultado do contrato em </span>
            <b className={c.impactoNoResultado === 0 ? 'text-emerald-300' : 'text-amber-300'}>
              {c.impactoNoResultado === 0 ? 'R$ 0,00 — é rótulo, não é dinheiro' : fmtBRL(c.impactoNoResultado)}
            </b>
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-[#d4d4d4]">{c.explicacao}</p>
          <p className="mt-1.5 border-l-2 border-emerald-500/40 pl-2 text-[11px] leading-5 text-[#a3a3a3]">
            <CheckCircle2 size={11} className="mr-1 inline text-emerald-400" />
            {c.prova}
          </p>
        </div>
      ))}

      {/* ── Nível 3 · onde exatamente, recolhido ──────────────────────────── */}
      <button
        type="button"
        onClick={() => setVerGrade((v) => !v)}
        className="flex items-center gap-1.5 self-start text-[11px] text-[#f97316] hover:underline"
      >
        {verGrade ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {verGrade ? 'Esconder a grade' : `Ver a grade mês a mês (${grade.total} células)`}
      </button>

      {verGrade && grade.grades.map((g) => <Grade key={g.aba} grade={g} />)}
    </div>
  )
}

function Numero({ n, rotulo, cor }: { n: number; rotulo: string; cor?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <b className={`text-lg tabular-nums ${cor ?? 'text-[#f5f5f5]'}`}>{n}</b>
      <span className="text-[11px] text-[#a3a3a3]">{rotulo}</span>
    </span>
  )
}

function Grade({ grade }: { grade: GradeDaAba }) {
  // Ligado por padrão: a pergunta é "onde não fecha", não "me mostre tudo".
  const [soDivergem, setSoDivergem] = useState(true)
  const [aberta, setAberta] = useState<string | null>(null)

  const linhas = soDivergem ? grade.linhas.filter((l) => l.divergem > 0) : grade.linhas

  return (
    <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[#f5f5f5]">{grade.aba}</p>
        <label className="flex items-center gap-1.5 text-[10px] text-[#a3a3a3]">
          <input
            type="checkbox" checked={soDivergem}
            onChange={(e) => setSoDivergem(e.target.checked)}
            className="accent-[#f97316]"
          />
          só as linhas que divergem
        </label>
      </div>

      {grade.rotulosNaoEncontrados.length > 0 && (
        <p className="mb-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
          Não achei {grade.rotulosNaoEncontrados.length} linha(s) nesta aba:{' '}
          {grade.rotulosNaoEncontrados.join(', ')}. Elas não foram conferidas — se o rótulo mudou na
          planilha, o sistema prefere avisar a comparar a linha errada.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-[11px]">
          <thead>
            <tr className="text-[#6b6b6b]">
              <th className="px-1.5 py-1 text-left font-normal">linha</th>
              <th className="px-1.5 py-1 text-left font-normal">rótulo na planilha</th>
              {grade.meses.map((m) => (
                <th key={m} className="px-1 py-1 text-center font-normal">{mesCurto(m).slice(0, 3)}</th>
              ))}
              <th className="px-1.5 py-1 text-right font-normal">resumo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <LinhaDaTabela
                key={l.campo}
                linha={l} meses={grade.meses}
                aberta={aberta === l.campo}
                onAbrir={() => setAberta((a) => (a === l.campo ? null : l.campo))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {grade.mesesSoNaPlanilha.length > 0 && (
        <p className="mt-2 text-[10px] leading-4 text-[#6b6b6b]">
          A planilha tem {grade.mesesSoNaPlanilha.length}{' '}
          {grade.mesesSoNaPlanilha.length === 1 ? 'coluna de mês' : 'colunas de mês'} além do
          horizonte da obra ({grade.mesesSoNaPlanilha.map(mesCurto).join(', ')}). Elas não entram na
          conferência — não há produção nem recebimento nelas.
        </p>
      )}
    </div>
  )
}

function LinhaDaTabela({ linha, meses, aberta, onAbrir }: {
  linha: LinhaDaGrade
  meses: string[]
  aberta: boolean
  onAbrir: () => void
}) {
  const porMes = new Map(linha.celulas.map((c) => [c.mes, c]))
  const fechaTudo = linha.divergem === 0

  return (
    <>
      <tr
        className={`border-t border-[#1f2937] ${fechaTudo ? '' : 'cursor-pointer hover:bg-white/[0.02]'}`}
        onClick={fechaTudo ? undefined : onAbrir}
      >
        <td className="px-1.5 py-1 text-[#6b6b6b] tabular-nums">{linha.linhaNaPlanilha}</td>
        <td className="max-w-[18rem] truncate px-1.5 py-1 text-[#d4d4d4]" title={linha.rotulo}>
          {linha.rotulo}
        </td>
        {meses.map((m) => {
          const c = porMes.get(m)
          return (
            <td key={m} className="px-1 py-1 text-center">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-sm ${
                  !c ? 'bg-[#1f1f1f]'
                  : c.fecha ? 'bg-emerald-500/40'
                  : c.causa ? 'bg-amber-500/70'
                  : 'bg-red-500/80'
                }`}
                title={c ? `${mesCurto(m)} · ${c.fecha ? 'fecha' : `diferença ${valor(c.diferenca, linha.unidade)}`}` : mesCurto(m)}
              />
            </td>
          )
        })}
        <td className="whitespace-nowrap px-1.5 py-1 text-right">
          {/* Linha que fecha nos meses todos NÃO abre. É o que impede a parede de números. */}
          {fechaTudo
            ? <span className="text-emerald-300">fecha ✓</span>
            : <span className="text-amber-300">{linha.divergem} de {linha.celulas.length} {aberta ? '▾' : '▸'}</span>}
        </td>
      </tr>

      {aberta && !fechaTudo && (
        <tr>
          <td colSpan={meses.length + 3} className="px-1.5 pb-2">
            <table className="w-full text-[10px]">
              <thead><tr className="text-[#6b6b6b]">
                <th className="py-1 text-left font-normal">mês</th>
                <th className="py-1 text-right font-normal">planilha</th>
                <th className="py-1 text-right font-normal">sistema</th>
                <th className="py-1 text-right font-normal">diferença</th>
                <th className="py-1 pl-4 text-left font-normal">causa</th>
              </tr></thead>
              <tbody>
                {linha.celulas.filter((c) => !c.fecha).map((c) => (
                  <tr key={c.mes}>
                    <td className="py-0.5 text-[#d4d4d4]">{mesCurto(c.mes)}</td>
                    <td className="py-0.5 text-right tabular-nums text-[#a3a3a3]">{valor(c.naPlanilha, linha.unidade)}</td>
                    <td className="py-0.5 text-right tabular-nums text-[#f5f5f5]">{valor(c.calculado, linha.unidade)}</td>
                    <td className="py-0.5 text-right tabular-nums text-amber-300">{valor(c.diferenca, linha.unidade)}</td>
                    <td className={`py-0.5 pl-4 ${c.causa ? 'text-[#a3a3a3]' : 'font-semibold text-red-300'}`}>
                      {c.causa === 'convencao-da-semana' ? 'convenção da semana'
                        : c.causa === 'arraste-do-acumulado' ? 'arraste do acumulado'
                        : c.causa === 'classificacao-de-custo' ? 'rubrica diferente'
                        : 'sem explicação'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}
