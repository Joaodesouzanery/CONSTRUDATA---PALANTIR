/**
 * FichaRetiradaModal — a ficha de retirada de material, do papel para a tela.
 *
 * ─── POR QUE ESTA TELA EXISTE ────────────────────────────────────────────────────────────────
 * No almoxarifado a retirada é anotada num formulário com oito campos:
 *
 *     Data · Hora · Colaborador · Obra · Material · Qtd. · Entregue por · Assinatura
 *
 * O sistema registrava quatro. Quem levou o material não existia em lugar nenhum — o registro
 * guarda quem DIGITOU, que é sempre o almoxarife. Sem isso, "quem retirou, quanto e quando" só
 * era respondível folheando o papel.
 *
 * A tela é uma coluna só, com os campos na ordem da ficha, porque quem preenche está no depósito
 * com o celular na mão e o material na outra. Os dois campos que dão trabalho — data e hora —
 * vêm preenchidos com o relógio de quem está registrando, e são editáveis para lançar uma
 * retirada de ontem que ficou no papel.
 *
 * A assinatura não tem par digital, e não vale fingir que tem: quem entregou fica registrado por
 * nome, que é a mesma garantia que a ficha de papel dá de fato.
 */
import { useState } from 'react'
import { X, PackageMinus, AlertTriangle, Search, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useAuth } from '@/lib/auth'
import { cn, formatCurrency, hojeLocalISO, horaLocalHHMM } from '@/lib/utils'
import { usePermissaoEscrita, ROLES_SUPRIMENTOS_WRITE } from '@/lib/roles'
import { parseLocaleNumber } from '@/lib/numberFormat'
import type { ItemEstoque } from '@/types'

interface Props {
  onClose: () => void
  /** Item já escolhido (quando aberta a partir de uma linha do estoque). */
  itemInicial?: ItemEstoque
}

export function FichaRetiradaModal({ onClose, itemInicial }: Props) {
  const { estoqueItens, movimentacoes, consumirMaterial, depositos, selectedDepositoId, addItemEstoque } = useSuprimentosStore(
    useShallow((s) => ({
      estoqueItens:     s.estoqueItens,
      movimentacoes:    s.movimentacoes,
      consumirMaterial: s.consumirMaterial,
      depositos:        s.depositos,
      selectedDepositoId: s.selectedDepositoId,
      addItemEstoque:   s.addItemEstoque,
    })),
  )
  const sites = useTorreStore((s) => s.sites)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const nomeDoUsuario = useAuth((s) => s.profile?.full_name ?? '')

  const [busca, setBusca]       = useState('')
  const [itemId, setItemId]     = useState(itemInicial?.id ?? '')
  const [quantidade, setQtd]    = useState('')
  const [retiradoPor, setRetiradoPor] = useState('')
  const [naoIdentificado, setNaoIdentificado] = useState(false)
  const [entreguePor, setEntreguePor] = useState(nomeDoUsuario)
  const [siteId, setSiteId]     = useState<string>(activeObraId ?? '')
  const [data, setData]         = useState(hojeLocalISO())
  const [hora, setHora]         = useState(horaLocalHHMM())
  const [observacoes, setObs]   = useState('')
  const [salvando, setSalvando] = useState(false)
  const permissao = usePermissaoEscrita(ROLES_SUPRIMENTOS_WRITE)

  const item = estoqueItens.find((i) => i.id === itemId)
  // Onde o item novo nasce: a frente selecionada, senão a primeira ativa.
  const depositoPadrao = selectedDepositoId ?? depositos.find((d) => d.ativo)?.id ?? depositos[0]?.id ?? ''
  const qtd  = parseLocaleNumber(quantidade)

  // Quem já retirou antes vira sugestão. A equipe do depósito é a mesma toda semana, e digitar
  // "Vinicius" por extenso a cada retirada é o tipo de atrito que faz a ficha voltar para o papel.
  const nomesConhecidos = [...new Set(
    movimentacoes.map((m) => m.retiradoPor).filter((n): n is string => Boolean(n?.trim())),
  )].sort()

  const itensFiltrados = estoqueItens
    .filter((i) => !busca.trim() || i.descricao.toLowerCase().includes(busca.trim().toLowerCase()))
    .slice(0, 60)

  const saldoDepois = item ? item.qtdDisponivel - (Number.isFinite(qtd) ? qtd : 0) : 0
  const custoDaSaida = item?.custoUnitario ? (Number.isFinite(qtd) ? qtd : 0) * item.custoUnitario : 0
  const ficaNegativo = Boolean(item) && saldoDepois < 0
  const ficaAbaixoDoMinimo = Boolean(item) && (item?.estoqueMinimo ?? 0) > 0 && saldoDepois <= (item?.estoqueMinimo ?? 0)

  /**
   * O nome deixa de ser obrigatório.
   *
   * A ficha de papel do cliente mostra o custo de exigir: em 2 das 7 retiradas o colaborador ficou
   * como "INDEFINIDO" ou em branco. Bloquear o registro quando não se sabe quem levou significa que
   * a retirada NÃO é registrada — e aí o saldo derrapa, que é pior do que um nome faltando.
   * "Não identificado" vira uma escolha explícita, que também é um dado: dá para contar quantas
   * saíram sem dono.
   */
  const faltaPreencher = !item || !Number.isFinite(qtd) || qtd <= 0 || !permissao.pode
    || (!retiradoPor.trim() && !naoIdentificado)

  function registrar() {
    if (!item || faltaPreencher) return
    setSalvando(true)
    consumirMaterial(item.id, qtd, {
      // "Não identificado" é gravado como texto, não como vazio: assim dá para contar depois
      // quantas retiradas saíram sem dono, que é um número que importa.
      retiradoPor: naoIdentificado ? 'Não identificado' : retiradoPor.trim(),
      entreguePor: entreguePor.trim() || undefined,
      siteId: siteId || null,
      data,
      hora,
      observacoes: observacoes.trim() || undefined,
    })
    setSalvando(false)
    onClose()
  }

  const rotulo = 'text-[10px] uppercase tracking-wide text-[#6b6b6b] mb-1 block'
  const campo  = 'w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-2.5 py-2 text-sm text-[#f5f5f5] focus:border-[#f97316]/50 focus:outline-none'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-2xl border border-[#525252] bg-[#3d3d3d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#525252] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <PackageMinus size={18} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">Retirada de material</h2>
              <p className="text-[10px] text-[#6b6b6b]">Dá baixa no estoque e registra quem levou</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] transition-colors hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-3.5">
            {!permissao.pode && (
              <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2.5 text-[11px] text-[#fbbf24]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Este acesso não dá baixa no estoque.</strong> {permissao.explicacao} O botão
                  está desligado de propósito: descer o saldo na tela e o servidor recusar depois é pior
                  do que avisar agora.
                </span>
              </div>
            )}

            {/* Material */}
            <div>
              <label className={rotulo}>Material</label>
              {!itemInicial && (
                <div className="relative mb-1.5">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Procurar pelo nome…"
                    className={cn(campo, 'pl-8 text-xs')}
                  />
                </div>
              )}
              <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={campo}>
                <option value="">— escolha o material —</option>
                {itensFiltrados.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.descricao} · {i.qtdDisponivel} {i.unidade || 'un'}
                  </option>
                ))}
              </select>
              {!itemInicial && estoqueItens.length > itensFiltrados.length && (
                <p className="mt-1 text-[10px] text-[#6b6b6b]">
                  Mostrando {itensFiltrados.length} de {estoqueItens.length}. Use a busca para achar o resto.
                </p>
              )}
              {/* Sem isto, retirar fita velcro é impossível: a planilha de estoque tem tinta e
                  agregado; a ficha de papel registra consumível e EPI. São dois universos, e o
                  segundo nunca foi cadastrado. Bloquear a retirada por causa disso empurra o
                  almoxarife de volta para o papel. */}
              {!itemInicial && busca.trim() && itensFiltrados.length === 0 && permissao.pode && (
                <button
                  onClick={() => {
                    const id = addItemEstoque({
                      depositoId: depositoPadrao,
                      descricao: busca.trim(),
                      unidade: 'un',
                      qtdDisponivel: 0,
                      qtdReservada: 0,
                      qtdTransito: 0,
                      estoqueMinimo: 0,
                    })
                    if (id) { setItemId(id); setBusca('') }
                  }}
                  className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#525252] px-3 py-2 text-xs text-[#a3a3a3] transition-colors hover:border-[#f97316]/50 hover:text-[#f5f5f5]"
                >
                  <Plus size={13} /> Cadastrar “{busca.trim()}” agora
                </button>
              )}
            </div>

            {/* Quantidade + saldo resultante */}
            <div>
              <label className={rotulo}>Quantidade{item ? ` (${item.unidade || 'un'})` : ''}</label>
              <input
                value={quantidade}
                onChange={(e) => setQtd(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className={cn(campo, 'font-mono')}
              />
              {item && Number.isFinite(qtd) && qtd > 0 && (
                <p className="mt-1.5 text-[11px] text-[#a3a3a3]">
                  Saldo: <span className="font-mono text-[#f5f5f5]">{item.qtdDisponivel}</span> →{' '}
                  <span className={cn('font-mono font-semibold', ficaNegativo ? 'text-[#f87171]' : ficaAbaixoDoMinimo ? 'text-[#fbbf24]' : 'text-[#4ade80]')}>
                    {saldoDepois}
                  </span>
                  {custoDaSaida > 0 && <> · custo da saída <span className="font-mono text-[#f5f5f5]">{formatCurrency(custoDaSaida)}</span></>}
                </p>
              )}
              {ficaNegativo && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#f87171]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  O saldo fica negativo. A baixa é registrada assim mesmo — o material saiu de verdade —,
                  mas isso quer dizer que o estoque estava desatualizado. Vale um inventário deste item.
                </p>
              )}
              {!ficaNegativo && ficaAbaixoDoMinimo && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#fbbf24]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  Fica no mínimo ou abaixo ({item?.estoqueMinimo}). Já é hora de pedir.
                </p>
              )}
            </div>

            {/* Colaborador */}
            <div>
              <label className={rotulo}>Colaborador que retirou</label>
              <input
                value={naoIdentificado ? '' : retiradoPor}
                onChange={(e) => { setRetiradoPor(e.target.value); if (e.target.value) setNaoIdentificado(false) }}
                disabled={naoIdentificado}
                list="nomes-que-ja-retiraram"
                placeholder={naoIdentificado ? 'não identificado' : 'Nome de quem levou o material'}
                className={cn(campo, naoIdentificado && 'opacity-50')}
              />
              <datalist id="nomes-que-ja-retiraram">
                {nomesConhecidos.map((n) => <option key={n} value={n} />)}
              </datalist>
              <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] text-[#a3a3a3]">
                <input
                  type="checkbox"
                  checked={naoIdentificado}
                  onChange={(e) => setNaoIdentificado(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#f97316]"
                />
                Não sei quem levou — registrar assim mesmo
              </label>
              {naoIdentificado && (
                <p className="mt-1 text-[10px] leading-relaxed text-[#6b6b6b]">
                  Melhor registrar sem o nome do que não registrar: sem a baixa, o saldo do sistema
                  fica maior que a prateleira, e a conferência da planilha acusa uma diferença que
                  ninguém explica.
                </p>
              )}
            </div>

            {/* Obra */}
            <div>
              <label className={rotulo}>Obra que recebeu</label>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={campo}>
                <option value="">— sem obra definida —</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Data e hora */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rotulo}>Data</label>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
              </div>
              <div>
                <label className={rotulo}>Hora</label>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={cn(campo, 'font-mono')} />
              </div>
            </div>

            {/* Entregue por */}
            <div>
              <label className={rotulo}>Entregue por</label>
              <input
                value={entreguePor}
                onChange={(e) => setEntreguePor(e.target.value)}
                placeholder="Quem entregou"
                className={campo}
              />
            </div>

            <div>
              <label className={rotulo}>Observações (opcional)</label>
              <input value={observacoes} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: para a frente do Bloco B" className={campo} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#525252] px-5 py-4">
          <button onClick={onClose} className="px-3 py-2 text-xs text-[#6b6b6b] transition-colors hover:text-[#f5f5f5]">
            Cancelar
          </button>
          <button
            onClick={registrar}
            disabled={faltaPreencher || salvando}
            className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PackageMinus size={13} />
            {salvando ? 'Registrando…' : 'Registrar retirada'}
          </button>
        </div>
      </div>
    </div>
  )
}
