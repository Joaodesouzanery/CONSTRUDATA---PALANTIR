/**
 * O painel das notas fiscais — cresce sozinho conforme as notas entram.
 *
 * ⚠️ **Ele conta NOTAS, não lançamentos.** As notas já lançadas também aparecem
 * no Fluxo e na DRE, pelo lançamento delas. Somar os dois seria contar duas
 * vezes, e a linha de texto no rodapé existe para essa dúvida não virar um mês de
 * "os números não batem".
 *
 * ⚠️ **E ele diz o que NÃO sabe.** Quantas notas ainda não foram lançadas,
 * quantas estão sem obra. Um painel de gastos que não conta o que ficou de fora
 * convida a ler o total como se fosse tudo — é a regra que o Economia já segue.
 */
import { useMemo, useState } from 'react'
import { SAIDA_CAT_LABELS, fmtBRL, monthLabel } from '@/features/financeiro/lib/financeiroCalc'
import { useNotasFiscaisStore } from '@/store/notasFiscaisStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { CategoryBars } from './VisaoGeralPanel'

function Card({ title, children, aviso }: { title: string; children: React.ReactNode; aviso?: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">{title}</p>
      {children}
      {aviso && <p className="mt-2.5 text-[10px] text-[#6b6b6b]">{aviso}</p>}
    </div>
  )
}

function agregar<T>(itens: T[], chave: (t: T) => string | undefined, valor: (t: T) => number) {
  const mapa = new Map<string, number>()
  for (const i of itens) {
    const k = chave(i)
    if (!k) continue
    mapa.set(k, (mapa.get(k) ?? 0) + valor(i))
  }
  return [...mapa].map(([key, v]) => ({ key, valor: v })).sort((a, b) => b.valor - a.valor)
}

const MESES_NO_GRAFICO = 6

export function NotasPainelPanel() {
  const notas = useNotasFiscaisStore((s) => s.notas)
  const sites = useTorreStore((s) => s.sites)
  const [meses, setMeses] = useState(MESES_NO_GRAFICO)

  const nomeDaObra = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites])

  const validas = useMemo(() => notas.filter((n) => n.status !== 'cancelada'), [notas])

  const total = useMemo(() => validas.reduce((s, n) => s + n.valor, 0), [validas])
  const tributos = useMemo(
    () => validas.reduce((s, n) => s + (n.tributosBRL ?? 0), 0),
    [validas],
  )

  const porCategoria = useMemo(() => agregar(validas, (n) => n.categoria, (n) => n.valor), [validas])
  const porEtiqueta = useMemo(() => agregar(validas, (n) => n.etiqueta, (n) => n.valor), [validas])
  const porObra = useMemo(() => agregar(validas, (n) => n.obraId, (n) => n.valor), [validas])
  const porFornecedor = useMemo(() => {
    const nomes = new Map<string, string>()
    for (const n of validas) if (n.emitente) nomes.set(n.cnpjEmitente, n.emitente)
    return agregar(validas, (n) => n.cnpjEmitente, (n) => n.valor)
      .slice(0, 10)
      .map((l) => ({ ...l, nome: nomes.get(l.key) ?? l.key }))
  }, [validas])

  /** Por mês, do mais antigo para o mais recente — só uma série, tudo é saída. */
  const porMes = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const n of validas) {
      const m = (n.dataEmissao ?? n.createdAt).slice(0, 7)
      mapa.set(m, (mapa.get(m) ?? 0) + n.valor)
    }
    return [...mapa].sort((a, b) => a[0].localeCompare(b[0])).slice(-meses)
  }, [validas, meses])

  const semObra = validas.filter((n) => !n.obraId).length
  const naoLancadas = validas.filter((n) => n.status !== 'lancada')
  const maxMes = Math.max(1, ...porMes.map(([, v]) => v))

  if (validas.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-[#a3a3a3]">O painel enche sozinho conforme as notas entram.</p>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-[#6b6b6b]">
          Importe a primeira em <b>Notas</b>: fotografe o cupom e o QR Code preenche fornecedor,
          data, série e número.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* ⚠️ O que ficou de fora vem ANTES dos gráficos, não num rodapé. */}
      {(naoLancadas.length > 0 || semObra > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5 text-[11px] leading-5 text-amber-200">
          {naoLancadas.length > 0 && (
            <p>
              <b>{naoLancadas.length}</b> nota(s) somando{' '}
              <b>{fmtBRL(naoLancadas.reduce((s, n) => s + n.valor, 0))}</b> ainda não foram lançadas
              no Financeiro — elas contam aqui e <b>não</b> contam na DRE.
            </p>
          )}
          {semObra > 0 && (
            <p>
              <b>{semObra}</b> nota(s) sem obra. O gasto por obra abaixo não as inclui.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { r: 'Notas', v: String(validas.length) },
          { r: 'Total', v: fmtBRL(total) },
          { r: 'Ticket médio', v: fmtBRL(total / validas.length) },
          { r: 'Tributos declarados', v: tributos > 0 ? fmtBRL(tributos) : 'sem dado' },
        ].map((c) => (
          <div key={c.r} className="rounded-xl border border-[#525252] bg-[#3d3d3d] px-3.5 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">{c.r}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#f5f5f5]">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Gasto por categoria"
          aviso="São as 6 categorias oficiais — as mesmas que alimentam a DRE quando a nota é lançada."
        >
          <CategoryBars
            data={porCategoria} total={total} color="#f97316"
            rotulo={(k) => SAIDA_CAT_LABELS[k as keyof typeof SAIDA_CAT_LABELS] ?? k}
          />
        </Card>

        <Card
          title="Gasto por etiqueta"
          aviso="A sua classificação fina. Ela NÃO entra na DRE — serve para enxergar aqui."
        >
          <CategoryBars
            data={porEtiqueta} total={total} color="#38bdf8" rotulo={(k) => k}
            vazio={<p className="py-6 text-center text-xs text-[#6b6b6b]">Nenhuma etiqueta usada ainda.</p>}
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Por mês (últimos ${meses})`}>
          <div className="space-y-2.5">
            {porMes.map(([mes, v]) => (
              <div key={mes}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-white">{monthLabel(mes)}</span>
                  <span className="tabular-nums text-[#a3a3a3]">{fmtBRL(v)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#2c2c2c]">
                  <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${(v / maxMes) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button" onClick={() => setMeses((m) => (m === 6 ? 12 : 6))}
            className="mt-3 text-[10px] text-[#6b6b6b] underline hover:text-[#f97316]"
          >
            ver {meses === 6 ? '12' : '6'} meses
          </button>
        </Card>

        <Card
          title="Maiores fornecedores"
          aviso="Agrupado pelo CNPJ que veio da chave de acesso — nenhuma outra tela do sistema consegue este corte."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-[#525252]/40">
                {porFornecedor.map((f) => (
                  <tr key={f.key}>
                    <td className="py-1.5 pr-3 text-[#f5f5f5]">{f.nome}</td>
                    <td className="py-1.5 text-right tabular-nums text-[#a3a3a3]">{fmtBRL(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {porObra.length > 0 && (
        <Card title="Gasto por obra">
          <CategoryBars
            data={porObra} total={total} color="#a78bfa"
            rotulo={(k) => nomeDaObra.get(k) ?? 'Obra removida'}
          />
        </Card>
      )}

      <p className="text-[10px] leading-4 text-[#6b6b6b]">
        Este painel conta <b>notas</b>. As que já foram lançadas também aparecem no Fluxo de Caixa e
        na DRE, pelo lançamento que geraram — somar os dois seria contar duas vezes.
      </p>
    </div>
  )
}
