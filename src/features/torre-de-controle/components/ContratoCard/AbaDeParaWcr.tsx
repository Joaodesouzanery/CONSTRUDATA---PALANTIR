/**
 * Aba DE-PARA — de que item do contrato cada sigla do apontamento WCR fala.
 *
 * ─── POR QUE ISTO É UMA TELA E NÃO UMA TABELA NO CÓDIGO ───────────────────────
 * `PV` casa com cinco itens do contrato (aduela mecânica, aduela manual, plástico em três
 * profundidades) e o apontamento colado não diz a profundidade. `PRA` casa com três diâmetros.
 * A máquina não tem como saber — e chutar aqui é pôr dinheiro errado numa medição.
 *
 * ⚠️ **Sigla sem mapa não recebe valor.** A quantidade é gravada no RDO do mesmo jeito; o que não
 * acontece é a conversão em reais. A tela diz quantas faltam, e o RDO diz de novo. É o mesmo
 * princípio de `categoriaAprendida.ts`: a sugestão nunca se aplica em silêncio.
 *
 * ⚠️ **E é por OBRA.** Medido nas duas tabelas de preço deste cliente: 163 códigos aparecem nas
 * duas cidades e nenhum tem o mesmo valor — a ligação de água mais comum custa R$ 60,95 numa e
 * R$ 56,90 na outra. Um mapa global aplicaria o preço da cidade errada sem avisar ninguém.
 */
import { Fragment, useMemo } from 'react'
import { AlertTriangle, Link2, Calculator } from 'lucide-react'
import { SIGLAS_WCR } from '@/features/rdo/utils/apontamentoWcr'
import { conferirDeParaSiglas, previaDoDePara } from '@/features/rdo/utils/servicoDaSigla'
import { useRdoStore } from '@/store/rdoStore'
import type { ObraContrato } from '@/types'
import { TXT, brl } from './formato'

export function AbaDeParaWcr({ contrato, salvar, siteId }: {
  contrato: ObraContrato
  salvar: (patch: Partial<ObraContrato>) => void
  /** A obra dona deste contrato — a prévia só olha os RDOs dela. */
  siteId?: string
}) {
  const rdos = useRdoStore((s) => s.rdos)
  const servicos = contrato.services ?? []
  const mapa = contrato.deParaSiglas ?? {}
  const mapeadas = SIGLAS_WCR.filter((s) => mapa[s.sigla]).length
  const faltam = SIGLAS_WCR.length - mapeadas

  // ⚠️ A conferência de unidade fecha uma armadilha cara: o `<select>` abaixo lista TODOS os itens
  // do contrato sem filtro, e `precoEfetivo × quantidade` multiplica sem olhar unidade. Ver o
  // docblock de `conferirDeParaSiglas`.
  const divergencias = useMemo(() => conferirDeParaSiglas(contrato), [contrato])
  const porSigla = useMemo(() => new Map(divergencias.map((d) => [d.sigla, d])), [divergencias])
  const previa = useMemo(
    () => (siteId ? previaDoDePara(rdos, siteId, contrato) : null),
    [rdos, siteId, contrato],
  )

  function definir(sigla: string, servicoId: string) {
    // Relê do contrato corrente a cada gravação: o mapa inteiro viaja no payload da obra, e montar
    // o objeto a partir de uma cópia velha apagaria o que outra pessoa mapeou enquanto isso.
    const atual = { ...(contrato.deParaSiglas ?? {}) }
    if (servicoId) atual[sigla] = servicoId
    else delete atual[sigla]
    salvar({ deParaSiglas: atual })
  }

  if (!servicos.length) {
    return (
      <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
        <p className={`text-[11px] ${TXT.normal}`}>
          Este contrato ainda não tem itens cadastrados. Cadastre a composição primeiro — é dela que
          sai a lista de serviços para o de-para apontar.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-2.5">
        <p className={`text-[11px] ${TXT.normal}`}>
          <b>Cada sigla do apontamento aponta para um item deste contrato.</b> É o que permite
          converter “LA - 3” em dinheiro. Você faz isso <b>uma vez</b>; os RDOs seguintes já saem
          valorados.
        </p>
        {faltam > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#fbbf24]">
            <AlertTriangle size={12} />
            {faltam} de {SIGLAS_WCR.length} siglas ainda sem item. Elas continuam sendo contadas no
            RDO — só não viram valor.
          </p>
        )}
        {divergencias.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-1.5 text-[11px] text-[#fca5a5]">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              <b>{divergencias.length} mapeamento(s) com unidade incompatível.</b> Confira as linhas
              marcadas abaixo — a unidade da sigla e a do item não combinam, e a conta multiplicaria
              uma pela outra sem avisar.
            </span>
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#525252] text-left text-[#6b6b6b]">
              <th className="py-1.5 pr-3 font-medium">Sigla</th>
              <th className="py-1.5 pr-3 font-medium">Serviço</th>
              <th className="py-1.5 pr-3 font-medium">Un.</th>
              <th className="py-1.5 pr-3 font-medium">Item do contrato</th>
              <th className="py-1.5 text-right font-medium">Preço unit.</th>
            </tr>
          </thead>
          <tbody>
            {SIGLAS_WCR.map((s) => {
              const id = mapa[s.sigla] ?? ''
              const servico = servicos.find((x) => x.id === id) ?? null
              const divergente = porSigla.get(s.sigla)
              return (
                <Fragment key={s.sigla}>
                <tr className={`border-b border-[#3d3d3d]${divergente ? ' bg-[#ef4444]/5' : ''}`}>
                  <td className="py-1.5 pr-3 font-semibold text-[#f5f5f5]">{s.sigla}</td>
                  <td className="py-1.5 pr-3 text-[#a3a3a3]">{s.rotulo}</td>
                  <td className="py-1.5 pr-3 text-[#6b6b6b]">{s.unidade === 'M' ? 'm' : 'un'}</td>
                  <td className="py-1.5 pr-3">
                    <select
                      value={id}
                      onChange={(e) => definir(s.sigla, e.target.value)}
                      className="w-full min-w-[180px] rounded border border-[#525252] bg-[#1f1f1f] px-1.5 py-1 text-[11px] text-[#f5f5f5] focus:border-[#f97316]/50 focus:outline-none"
                    >
                      <option value="">— falta mapear —</option>
                      {servicos.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.descricao}{x.unidade ? ` (${x.unidade})` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 text-right">
                    {servico
                      ? <span className={divergente ? 'text-[#fca5a5]' : 'text-[#f5f5f5]'}>{brl(servico.valorUnitario)}</span>
                      : <span className="text-[#6b6b6b]">—</span>}
                  </td>
                </tr>
                {divergente && (
                  <tr className="border-b border-[#3d3d3d] bg-[#ef4444]/5">
                    <td />
                    <td colSpan={4} className="pb-1.5 pr-3 text-[10px] leading-4 text-[#fca5a5]">
                      ⚠️ {divergente.explicacao}
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── A prévia: o que este de-para produziria. NÃO lança nada. ─────────── */}
      {previa && previa.linhas.length > 0 && (
        <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#f5f5f5]">
            <Calculator size={12} /> Com este de-para, a produção já lançada valeria
          </p>
          <p className="text-lg font-bold text-[#ffa055]">{brl(previa.valorTotal)}</p>
          <p className="text-[10px] text-[#6b6b6b]">
            sobre {previa.rdos} RDO(s) WCR finalizado(s) desta obra
            {previa.siglasSemMapa > 0 && (
              <> · <span className="text-[#fbbf24]">{previa.siglasSemMapa} sigla(s) com produção e sem item</span></>
            )}
          </p>

          <table className="mt-2 w-full text-[11px]">
            <tbody>
              {previa.linhas.map((l) => (
                <tr key={l.sigla} className="border-t border-[#3d3d3d]">
                  <td className="py-1 pr-2 font-semibold text-[#f5f5f5]">{l.sigla}</td>
                  <td className="py-1 pr-2 text-right font-mono text-[#c9c9c9]">
                    {l.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {l.unidade === 'M' ? 'm' : 'un'}
                  </td>
                  <td className="py-1 pr-2 text-[#6b6b6b]">
                    {l.servico?.descricao ?? <span className="text-[#fbbf24]">falta mapear</span>}
                  </td>
                  <td className="py-1 text-right font-mono">
                    {l.divergente
                      ? <span className="text-[#fca5a5]">unidade incompatível</span>
                      : l.servico
                        ? <span className="text-[#f5f5f5]">{brl(l.valor)}</span>
                        : <span className="text-[#6b6b6b]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ⚠️ A frase que impede a prévia de ser confundida com medição. */}
          <p className="mt-2 text-[10px] leading-4 text-[#6b6b6b]">
            <b>Este número não é lançado em lugar nenhum</b> — nem na medição, nem no Financeiro,
            nem no Fluxo de Caixa Projetado. Ele existe para você conferir o mapeamento antes de o
            mapeamento valer alguma coisa. Sigla com unidade incompatível fica sem valor de
            propósito: mostrar o número seria convidar a confiar nele.
          </p>
        </div>
      )}

      {/* O vínculo com o Fluxo de Caixa Projetado */}
      <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#f5f5f5]">
          <Link2 size={12} /> Esta obra no Fluxo de Caixa Projetado
        </p>
        <input
          value={contrato.fcpCidadeId ?? ''}
          onChange={(e) => salvar({ fcpCidadeId: e.target.value.trim() || undefined })}
          placeholder="ex.: bertioga"
          className="w-full max-w-xs rounded border border-[#525252] bg-[#1f1f1f] px-2 py-1 text-[11px] text-[#f5f5f5] placeholder:text-[#525252] focus:border-[#f97316]/50 focus:outline-none"
        />
        <p className="mt-1.5 text-[10px] text-[#6b6b6b]">
          {/* ⚠️ Um plano do FCP cobre VÁRIAS cidades e guarda uma obra só, então não dá para
              descobrir a cidade a partir da obra. Casar por nome quebraria no primeiro “Santos”
              que fosse sobrenome — e a planilha de caixa deste cliente tem três, nenhum a cidade. */}
          Sem isto preenchido, os RDOs desta obra <b>não</b> aparecem na conferência do Fluxo de
          Caixa Projetado. O valor é o identificador da cidade no plano (o nome em minúsculas, sem
          acento).
        </p>
      </div>
    </div>
  )
}
