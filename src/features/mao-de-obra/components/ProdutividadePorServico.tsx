/**
 * Quanto a equipe produz por dia, serviço a serviço.
 *
 * ─── A PERGUNTA QUE O SISTEMA NÃO RESPONDIA ───────────────────────────────────
 * "Quanto uma equipe de 6 faz de piso epóxi por dia?" — a pergunta que o encarregado faz. Os três
 * ingredientes já estavam persistidos **no mesmo objeto RDO** (produção por serviço, contagem de
 * gente, data) e nenhuma linha de código os juntava.
 *
 * A RUP que já existia é HH ÷ m² **agregado**, e depende de `horasTrabalhadas`, um campo digitado
 * à mão. Aqui a conta sai da contagem de pessoas do RDO, e é **por serviço** — porque cada um tem
 * a sua unidade, e m² não se soma com metro linear.
 */
import { useMemo } from 'react'
import { Users } from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { produtividadePorServico, diasParaConcluir } from '@/features/mao-de-obra/utils/produtividadePorServico'
import { saldoQtd, qtdMedida, medidoAutoPorServico } from '@/features/torre-de-controle/utils/obraMedicao'
import { fmtDataBR } from '@/lib/utils'

const num = (n: number, casas = 1) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export function ProdutividadePorServico({ siteId }: { siteId: string | null }) {
  const rdos = useRdoStore((s) => s.rdos)
  const sites = useTorreStore((s) => s.sites)

  const site = siteId ? sites.find((s) => s.id === siteId) ?? null : null
  const servicos = site?.contrato?.services ?? []

  const linhas = useMemo(
    () => produtividadePorServico(rdos, siteId, servicos),
    [rdos, siteId, servicos],
  )
  const medidoAuto = useMemo(() => medidoAutoPorServico(rdos, siteId), [rdos, siteId])

  if (!siteId) {
    return (
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3">
        <p className="text-xs text-[#c9c9c9]">
          Selecione uma obra para ver quanto a equipe produz por dia em cada serviço.
        </p>
      </div>
    )
  }

  if (servicos.length === 0) {
    return (
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3">
        <p className="text-xs text-[#c9c9c9]">
          Esta obra ainda não tem os serviços do contrato cadastrados. Cadastre em{' '}
          <b>Torre de Controle → Detalhes da Obra → Contrato → Composição</b>, e o ritmo por serviço
          aparece aqui sozinho, a partir dos RDOs.
        </p>
      </div>
    )
  }

  if (linhas.length === 0) {
    return (
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3">
        <p className="text-xs text-[#c9c9c9]">
          Nenhum RDO finalizado desta obra tem produção vinculada a um serviço do contrato ainda.
          No RDO, vincule cada linha de produção ao serviço dela — daí o ritmo aparece aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-[#ffa055]" />
        <h3 className="text-sm font-bold text-[#f5f5f5]">Ritmo por serviço</h3>
      </div>
      <p className="mt-0.5 text-[11px] text-[#adadad]">
        Quanto a equipe entrega por pessoa em um dia, a partir dos RDOs finalizados. Cada serviço na
        unidade dele.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-xs">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-[#adadad]">
              <th className="pb-1.5 text-left font-semibold">Serviço</th>
              <th className="pb-1.5 text-right font-semibold">Por pessoa/dia</th>
              <th className="pb-1.5 text-right font-semibold">Total feito</th>
              <th className="pb-1.5 text-right font-semibold">Dias</th>
              <th className="pb-1.5 text-right font-semibold">Melhor dia</th>
              <th className="pb-1.5 text-right font-semibold">Falta</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const svc = servicos.find((s) => s.id === l.servicoId)
              const saldo = svc ? Math.max(0, saldoQtd(svc, qtdMedida(svc, medidoAuto))) : 0
              // Previsão com a equipe MÉDIA dos dias medidos — não com um número inventado.
              const equipeMedia = l.dias.filter((d) => d.pessoas > 0).length > 0
                ? Math.round(l.dias.reduce((s, d) => s + d.pessoas, 0) / l.dias.filter((d) => d.pessoas > 0).length)
                : 0
              const prazo = diasParaConcluir(l, saldo, equipeMedia)
              return (
                <tr key={l.servicoId} className="border-t border-[#525252]">
                  <td className="py-1.5 pr-2 text-[#f5f5f5]">{l.descricao}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums font-semibold text-[#ffa055]">
                    {l.mediaPorPessoaDia != null ? `${num(l.mediaPorPessoaDia)} ${l.unidade}` : '—'}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-[#e5e5e5]">{num(l.total)} {l.unidade}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-[#c9c9c9]">{l.diasComProducao}</td>
                  <td className="py-1.5 text-right text-[#c9c9c9]">
                    {l.melhorDia?.porPessoa != null
                      ? <>{num(l.melhorDia.porPessoa)} <span className="text-[#adadad]">em {fmtDataBR(l.melhorDia.data)}</span></>
                      : '—'}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-[#c9c9c9]">
                    {saldo > 0
                      ? <>{num(saldo)} {l.unidade}{prazo != null && <span className="text-[#adadad]"> · ~{prazo}d</span>}</>
                      : <span className="text-[#4ade80]">concluído</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-[#adadad]">
        A média pondera pelo tamanho da equipe de cada dia — um dia de 10 pessoas pesa mais que um
        de 2. A previsão (“~Nd”) usa a equipe média dos dias já medidos, e só aparece quando há
        ritmo medido e saldo a executar.
      </p>
    </div>
  )
}
