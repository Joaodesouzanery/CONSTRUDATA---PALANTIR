/**
 * DashboardSuprimentosPanel — o painel de Suprimentos, com números em vez de fluxograma.
 *
 * ─── O QUE ESTAVA AQUI, E POR QUE SAIU ────────────────────────────────────────────────────────
 * A aba "Dashboard" mostrava oito cartões descrevendo as etapas do módulo ("1. Inteligência de
 * Demanda", "2. Lista de Compras"…) e cinco indicadores. O texto dos cartões não vinha de dado
 * nenhum — era a mesma frase para toda empresa, todo dia. E dos cinco indicadores, TRÊS liam
 * coleções que nunca chegam a sincronizar com o servidor (`exceptions`, `reservas`,
 * `supplyChainAlerts`): em produção mostravam zero, sempre, dando a impressão tranquilizadora de
 * que não havia exceção nem alerta nenhum.
 *
 * Ficou o que é medido de verdade: estoque, movimentação e pedido — as três coleções que o
 * `pull()` deste módulo realmente traz do Supabase.
 *
 * A navegação que os cartões ofereciam não se perdeu: as abas estão logo acima, agora na ordem em
 * que a operação usa o módulo.
 */
import { useState } from 'react'
import { AlertTriangle, PackageMinus, ShoppingCart, Boxes, TrendingDown, ExternalLink } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { cn, formatCurrency, dataLocalISO } from '@/lib/utils'
import type { SuprimentosTab } from './SuprimentosHeader'

interface Props {
  onNavigate: (tab: SuprimentosTab) => void
  onRegistrarRetirada?: () => void
}

const PERIODOS = [
  { dias: 7,  rotulo: '7 dias'   },
  { dias: 15, rotulo: '15 dias'  },
  { dias: 30, rotulo: '30 dias'  },
  { dias: 90, rotulo: '90 dias'  },
] as const

function Kpi({ label, value, hint, tone = 'text-[#f5f5f5]', icon: Icon }: {
  label: string; value: string | number; hint?: string; tone?: string
  icon: typeof Boxes
}) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <div className="flex items-center gap-1.5">
        <Icon size={13} className="text-[#6b6b6b]" />
        <p className="text-xs text-[#a3a3a3]">{label}</p>
      </div>
      <p className={cn('mt-2 text-xl font-bold tabular-nums', tone)}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-[#6b6b6b]">{hint}</p>}
    </div>
  )
}

export function DashboardSuprimentosPanel({ onNavigate, onRegistrarRetirada }: Props) {
  const { estoqueItens, movimentacoes, purchaseOrders } = useSuprimentosStore(
    useShallow((s) => ({
      estoqueItens:   s.estoqueItens,
      movimentacoes:  s.movimentacoes,
      purchaseOrders: s.purchaseOrders,
    })),
  )
  const sites = useTorreStore((s) => s.sites)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const [dias, setDias] = useState<number>(30)

  const nomeDaObra = (id?: string | null) => sites.find((s) => s.id === id)?.name ?? '—'

  // A obra da barra lateral manda aqui também: `null` é "todas".
  const itens = activeObraId ? estoqueItens.filter((i) => i.siteId === activeObraId) : estoqueItens

  // Data de corte pelo relógio LOCAL. Com `toISOString()` o corte pula um dia depois das 21h no
  // Brasil, e o painel some com o dia mais recente justamente para quem confere à noite.
  const corte = new Date()
  corte.setDate(corte.getDate() - dias)
  const desde = dataLocalISO(corte)

  const movsDoPeriodo = movimentacoes.filter((m) => {
    if (m.dataMovimento < desde) return false
    if (!activeObraId) return true
    // A movimentação pode não ter obra (registro antigo); nesse caso vale a obra do item.
    return (m.siteId ?? itens.find((i) => i.id === m.itemId)?.siteId ?? null) === activeObraId
  })

  const custoDaMov = (m: typeof movimentacoes[number]) =>
    // O custo congelado na movimentação vence. O custo atual do item é só o resgate para linhas
    // antigas, gravadas antes de a coluna existir — e é justamente ele que faz o histórico mudar
    // quando o preço muda, então nunca deve ser a primeira escolha.
    m.custoUnitario ?? estoqueItens.find((i) => i.id === m.itemId)?.custoUnitario ?? 0

  const saidas = movsDoPeriodo.filter((m) => m.tipo === 'saida')
  const consumoBRL = saidas.reduce((s, m) => s + m.quantidade * custoDaMov(m), 0)
  const entradasBRL = movsDoPeriodo.filter((m) => m.tipo === 'entrada')
    .reduce((s, m) => s + m.quantidade * custoDaMov(m), 0)

  const valorEmEstoque = itens.reduce((s, i) => s + i.qtdDisponivel * (i.custoUnitario ?? 0), 0)
  const precisaPedir = itens
    .filter((i) => (i.estoqueMinimo > 0 && i.qtdDisponivel <= i.estoqueMinimo) || i.realizarPedido)
    .sort((a, b) => (a.qtdDisponivel - a.estoqueMinimo) - (b.qtdDisponivel - b.estoqueMinimo))

  // "Chegando perto": ainda acima do mínimo, mas a menos de 25% dele. Sem isso, o alerta só
  // aparece quando o material JÁ acabou — tarde demais para um pedido com prazo de entrega.
  const chegandoPerto = itens.filter((i) =>
    i.estoqueMinimo > 0
    && i.qtdDisponivel > i.estoqueMinimo
    && i.qtdDisponivel <= i.estoqueMinimo * 1.25,
  )

  const ultimasRetiradas = [...saidas]
    .sort((a, b) => (b.dataMovimento + (b.horaMovimento ?? '')).localeCompare(a.dataMovimento + (a.horaMovimento ?? '')))
    .slice(0, 12)

  // Consumo por obra: só faz sentido quando a barra lateral está em "todas as obras".
  const consumoPorObra = [...saidas.reduce((mapa, m) => {
    const obra = m.siteId ?? estoqueItens.find((i) => i.id === m.itemId)?.siteId ?? null
    const chave = obra ?? 'sem-obra'
    mapa.set(chave, (mapa.get(chave) ?? 0) + m.quantidade * custoDaMov(m))
    return mapa
  }, new Map<string, number>()).entries()]
    .map(([id, valor]) => ({ id, nome: id === 'sem-obra' ? 'Sem obra definida' : nomeDaObra(id), valor }))
    .filter((o) => o.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const pedidosAbertos = purchaseOrders.filter((po) => po.status !== 'closed' && po.status !== 'cancelled').length

  return (
    <div className="flex flex-col gap-4">
      {/* Período */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Período</span>
        <div className="flex gap-1 rounded-lg border border-[#525252] bg-[#3d3d3d] p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                dias === p.dias ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-[#6b6b6b]">
          desde {desde.split('-').reverse().join('/')}
          {activeObraId && <> · obra <span className="text-[#f5f5f5]">{nomeDaObra(activeObraId)}</span></>}
        </span>
        {onRegistrarRetirada && (
          <button
            onClick={onRegistrarRetirada}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
          >
            <PackageMinus size={13} /> Registrar retirada
          </button>
        )}
      </div>

      {/* Os quatro números */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Boxes}
          label="Valor em estoque"
          value={formatCurrency(valorEmEstoque)}
          hint={`${itens.length} ite${itens.length !== 1 ? 'ns' : 'm'} cadastrado${itens.length !== 1 ? 's' : ''}`}
          tone="text-[#4ade80]"
        />
        <Kpi
          icon={TrendingDown}
          label={`Consumo em ${dias} dias`}
          value={formatCurrency(consumoBRL)}
          hint={`${saidas.length} retirada${saidas.length !== 1 ? 's' : ''}${entradasBRL > 0 ? ` · entradas ${formatCurrency(entradasBRL)}` : ''}`}
          tone={consumoBRL > 0 ? 'text-[#fb923c]' : 'text-[#6b6b6b]'}
        />
        <Kpi
          icon={AlertTriangle}
          label="Precisam de pedido"
          value={precisaPedir.length}
          hint={chegandoPerto.length > 0 ? `+${chegandoPerto.length} chegando perto do mínimo` : 'nenhum no limite'}
          tone={precisaPedir.length ? 'text-[#fbbf24]' : 'text-[#4ade80]'}
        />
        <Kpi
          icon={ShoppingCart}
          label="Pedidos em aberto"
          value={pedidosAbertos}
          hint={`${purchaseOrders.length} no total`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Precisa comprar */}
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Precisa comprar</h3>
            <button onClick={() => onNavigate('almoxarifado')} className="flex items-center gap-1 text-[10px] text-[#6b6b6b] transition-colors hover:text-[#f97316]">
              Almoxarifado <ExternalLink size={10} />
            </button>
          </div>
          {precisaPedir.length === 0 && chegandoPerto.length === 0 ? (
            <p className="mt-3 text-xs text-[#6b6b6b]">
              Nenhum item no mínimo. Isto só é informativo se os mínimos estiverem preenchidos —{' '}
              {itens.filter((i) => i.estoqueMinimo > 0).length} de {itens.length} têm mínimo definido.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-1.5">
              {precisaPedir.slice(0, 8).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#333333] px-2.5 py-1.5">
                  <span className="truncate text-xs text-[#f5f5f5]" title={i.descricao}>
                    {i.realizarPedido && <span className="mr-1.5 rounded bg-[#f97316]/20 px-1 py-0.5 text-[9px] text-[#fb923c]">marcado</span>}
                    {i.descricao}
                  </span>
                  <span className="shrink-0 font-mono text-[11px]">
                    <span className={i.qtdDisponivel <= 0 ? 'text-[#f87171]' : 'text-[#fbbf24]'}>{i.qtdDisponivel}</span>
                    <span className="text-[#6b6b6b]">/{i.estoqueMinimo || '—'} {i.unidade || 'un'}</span>
                  </span>
                </div>
              ))}
              {chegandoPerto.slice(0, 4).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#333333]/50 px-2.5 py-1.5">
                  <span className="truncate text-xs text-[#a3a3a3]" title={i.descricao}>{i.descricao}</span>
                  <span className="shrink-0 font-mono text-[11px] text-[#6b6b6b]">
                    {i.qtdDisponivel}/{i.estoqueMinimo} {i.unidade || 'un'} · perto
                  </span>
                </div>
              ))}
              {precisaPedir.length > 8 && (
                <p className="pt-1 text-[10px] text-[#6b6b6b]">e mais {precisaPedir.length - 8} no mínimo ou abaixo.</p>
              )}
            </div>
          )}
        </div>

        {/* Consumo por obra */}
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <h3 className="text-sm font-bold text-[#f5f5f5]">Consumo por obra · {dias} dias</h3>
          {consumoPorObra.length === 0 ? (
            <p className="mt-3 text-xs text-[#6b6b6b]">
              Nenhuma saída registrada no período. As retiradas passam a aparecer aqui assim que forem
              registradas na ficha.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {consumoPorObra.slice(0, 8).map((o) => {
                const pct = consumoBRL > 0 ? (o.valor / consumoBRL) * 100 : 0
                return (
                  <div key={o.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs text-[#f5f5f5]">{o.nome}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#fb923c]">{formatCurrency(o.valor)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[#2c2c2c]">
                      <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quem retirou, quanto e quando */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#f5f5f5]">Últimas retiradas</h3>
          <span className="text-[10px] text-[#6b6b6b]">{saidas.length} no período</span>
        </div>
        {ultimasRetiradas.length === 0 ? (
          <p className="mt-3 text-xs text-[#6b6b6b]">
            Nenhuma retirada nos últimos {dias} dias.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">
                  {['Data', 'Hora', 'Material', 'Qtd.', 'Retirou', 'Obra', 'Valor'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultimasRetiradas.map((m) => {
                  const item = estoqueItens.find((i) => i.id === m.itemId)
                  return (
                    <tr key={m.id} className="border-t border-[#525252]">
                      <td className="whitespace-nowrap px-2 py-1.5 text-[#a3a3a3]">{m.dataMovimento.split('-').reverse().join('/')}</td>
                      <td className="px-2 py-1.5 font-mono text-[#6b6b6b]">{m.horaMovimento ?? '—'}</td>
                      <td className="max-w-[220px] truncate px-2 py-1.5 text-[#f5f5f5]" title={item?.descricao}>{item?.descricao ?? '(item removido)'}</td>
                      <td className="px-2 py-1.5 font-mono text-[#f5f5f5]">{m.quantidade} {item?.unidade || ''}</td>
                      {/* "Entregue por" é o outro lado da assinatura da ficha de papel. Era
                          capturado no formulário e não podia ser lido em tela nenhuma. */}
                      <td className="px-2 py-1.5 text-[#a3a3a3]">
                        {m.retiradoPor ?? <span className="text-[#6b6b6b]">não registrado</span>}
                        {m.entreguePor && <span className="block text-[10px] text-[#6b6b6b]">entregue por {m.entreguePor}</span>}
                      </td>
                      <td className="max-w-[140px] truncate px-2 py-1.5 text-[#6b6b6b]">{nomeDaObra(m.siteId ?? item?.siteId)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[#fb923c]">
                        {custoDaMov(m) > 0 ? formatCurrency(m.quantidade * custoDaMov(m)) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
