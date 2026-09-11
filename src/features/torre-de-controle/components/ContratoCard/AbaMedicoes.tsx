/**
 * Aba MEDIÇÕES — o extrato de faturamento, igual ao da planilha do cliente.
 *
 * Data · NF · Valor · Descrição · Retenção · Situação. A **entrada é uma linha marcada**, não um
 * campo à parte: na planilha ela já é o primeiro faturamento ("Entrada Serviço", "entrada 40%"),
 * e um campo separado daria dois lugares para digitar o mesmo número.
 *
 * A nota também diz **de qual saldo abate**: serviço ou material. É isso que faz o saldo do
 * contrato bater com o que o cliente controla à mão — na planilha BSB o saldo é sempre contra o
 * serviço, e o material é faturado à parte.
 */
import { useState } from 'react'
import { Plus, Trash2, Save, X, Pencil } from 'lucide-react'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { fmtDataBR, hojeLocalISO } from '@/lib/utils'
import type { ObraContrato, ObraFaturamento } from '@/types'
import type { ResumoFaturamento } from '@/features/torre-de-controle/utils/obraMedicao'
import { TXT, brl, inputCls, numCls } from './formato'
import { Th, BotaoSec, Aviso } from './ui'

const optNum = (v: string): number | undefined => (v.trim() === '' ? undefined : parseLocaleNumber(v))

export function AbaMedicoes({ contrato, resumo, hoje, salvar, obraId }: {
  /** A obra dona deste contrato. Só serve de gatilho para o reset acima. */
  obraId: string
  contrato: ObraContrato
  resumo: ResumoFaturamento
  hoje: string
  salvar: (patch: Partial<ObraContrato>) => void
}) {
  const [editando, setEditando] = useState(false)
  const [notas, setNotas] = useState<ObraFaturamento[]>([])

  /**
   * ⚠️ CINTO E SUSPENSÓRIO, e o suspensório é este.
   *
   * O `ContratoCard` é montado com `key={site.id}`, então trocar de obra já remonta esta aba. Isto
   * existe porque `key` é fácil de alguém remover num refactor sem entender o que segurava — e o
   * preço do descuido aqui é o contrato de um cliente gravado dentro do de outro.
   *
   * ⚠️ Ajuste DURANTE O RENDER, não num `useEffect`. Com efeito, o rascunho da obra antiga chega a
   * renderizar um quadro antes de ser limpo — e um quadro basta para alguém clicar em Salvar.
   * Este é o padrão que o próprio React documenta para redefinir estado quando uma prop muda.
   *
   * ⚠️ E o gatilho é o ID DA OBRA, não o objeto `contrato`: em obra sem contrato o pai monta
   * `site.contrato ?? { services: [] }`, objeto novo a cada render — vigiar a identidade dele
   * cancelaria a edição a cada tecla.
   */
  const [obraDoRascunho, setObraDoRascunho] = useState(obraId)
  if (obraId !== obraDoRascunho) {
    setObraDoRascunho(obraId)
    setEditando(false)
    setNotas([])
  }

  const atuais = contrato.faturamentos ?? []
  // Mais recente em cima — é como se lê um extrato.
  const ordenadas = [...atuais].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

  function abrir() { setNotas(structuredClone(atuais)); setEditando(true) }
  function confirmar() { salvar({ faturamentos: notas }); setEditando(false) }

  const set = (id: string, patch: Partial<ObraFaturamento>) =>
    setNotas((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  const adicionar = () => setNotas((ns) => [...ns, {
    id: crypto.randomUUID(), data: hojeLocalISO(), valor: 0, situacao: 'recebido' as const,
    categoria: 'servico' as const,
    // A primeira nota de uma obra é, quase sempre, a entrada. Quem não quiser, desmarca.
    entrada: ns.length === 0,
  }])
  const remover = (id: string) => setNotas((ns) => ns.filter((n) => n.id !== id))

  if (editando) {
    return (
      <div className="flex flex-col gap-2 pt-1">
        {notas.length === 0 && (
          <p className={`py-2 text-[11px] ${TXT.fraco}`}>
            Nenhuma nota lançada. A entrada da obra, quando houver, é a primeira — marque a caixa “é a entrada”.
          </p>
        )}
        {notas.map((n) => (
          <div key={n.id} className="flex flex-col gap-1.5 rounded-lg border border-[#525252] bg-[#2c2c2c] p-2">
            <div className="flex flex-wrap gap-1.5">
              <input type="date" className={`${inputCls} w-36`} value={n.data}
                     onChange={(e) => set(n.id, { data: e.target.value })} />
              <input className={`${inputCls} w-24`} value={n.nf ?? ''} placeholder="NF"
                     onChange={(e) => set(n.id, { nf: e.target.value })} />
              <input className={`${inputCls} min-w-[160px] flex-1`} value={n.descricao ?? ''}
                     placeholder="Descrição (ex.: Entrada Serviço, 2ª medição)"
                     onChange={(e) => set(n.id, { descricao: e.target.value })} />
              <button onClick={() => remover(n.id)} title="Remover nota"
                      className="shrink-0 rounded px-2 text-[#a3a3a3] hover:bg-[#ef4444]/15 hover:text-[#ef4444]">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] ${TXT.fraco}`}>Valor (R$)</span>
                <input className={numCls} inputMode="decimal" value={n.valor || ''}
                       onChange={(e) => set(n.id, { valor: parseLocaleNumber(e.target.value) })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] ${TXT.fraco}`}>Retenção (R$)</span>
                <input className={numCls} inputMode="decimal" value={n.retencaoTecnica ?? ''} placeholder="0"
                       onChange={(e) => set(n.id, { retencaoTecnica: optNum(e.target.value) })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] ${TXT.fraco}`}>Abate de</span>
                <select className={inputCls} value={n.categoria ?? 'servico'}
                        onChange={(e) => set(n.id, { categoria: e.target.value as 'servico' | 'material' })}>
                  <option value="servico">Serviço</option>
                  <option value="material">Material</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] ${TXT.fraco}`}>Situação</span>
                <select className={inputCls} value={n.situacao}
                        onChange={(e) => {
                          const situacao = e.target.value as ObraFaturamento['situacao']
                          set(n.id, situacao === 'recebido'
                            ? { situacao, dataRecebimento: n.dataRecebimento ?? hojeLocalISO() }
                            : { situacao })
                        }}>
                  <option value="recebido">Recebido</option>
                  <option value="a_receber">A receber</option>
                </select>
              </label>
              {n.situacao === 'a_receber' && (
                <label className="flex flex-col gap-1">
                  <span className={`text-[11px] ${TXT.fraco}`}>Previsão</span>
                  <input type="date" className={inputCls} value={n.previsaoRecebimento ?? ''}
                         onChange={(e) => set(n.id, { previsaoRecebimento: e.target.value })} />
                </label>
              )}
              {n.situacao === 'recebido' && (
                <label className="flex flex-col gap-1">
                  <span className={`text-[11px] ${TXT.fraco}`}>Recebido em</span>
                  <input type="date" className={inputCls} value={n.dataRecebimento ?? n.data}
                         onChange={(e) => set(n.id, { dataRecebimento: e.target.value })} />
                </label>
              )}
            </div>
            <label className={`flex items-center gap-1.5 text-[11px] ${TXT.normal}`}>
              <input type="checkbox" checked={!!n.entrada} onChange={(e) => set(n.id, { entrada: e.target.checked })} />
              É a entrada da obra (primeira parcela / sinal)
            </label>
          </div>
        ))}
        <div><BotaoSec onClick={adicionar}><Plus size={11} /> Adicionar nota</BotaoSec></div>
        <div className="flex items-center gap-2">
          <button onClick={confirmar}
            className="inline-flex items-center gap-1 rounded-lg bg-[#f97316] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#ea580c]">
            <Save size={12} /> Salvar medições
          </button>
          <BotaoSec onClick={() => setEditando(false)}><X size={12} /> Cancelar</BotaoSec>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      {ordenadas.length === 0 ? (
        <p className={`py-2 text-[11px] ${TXT.fraco}`}>
          Nenhuma nota lançada ainda. É aqui que entra cada faturamento contra este contrato — inclusive a entrada.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead>
              <tr>
                <Th>Data</Th><Th>NF</Th><Th>Descrição</Th>
                <Th alinha="right">Valor</Th><Th alinha="right">Retenção</Th><Th alinha="right">Situação</Th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((n) => {
                const vencida = n.situacao === 'a_receber' && !!n.previsaoRecebimento && n.previsaoRecebimento < hoje
                return (
                  <tr key={n.id} className="border-t border-[#3d3d3d]">
                    <td className={`py-1.5 pr-2 ${TXT.normal}`}>{n.data ? fmtDataBR(n.data) : '—'}</td>
                    <td className={`py-1.5 pr-2 ${TXT.normal}`}>{n.nf || '—'}</td>
                    <td className={`py-1.5 pr-2 ${TXT.forte}`}>
                      {n.descricao || '—'}
                      {n.entrada && <span className="ml-1.5 rounded bg-[#f97316]/20 px-1 text-[11px] text-[#fdba74]">entrada</span>}
                      {n.categoria === 'material' && <span className={`ml-1.5 rounded bg-[#484848] px-1 text-[11px] ${TXT.fraco}`}>material</span>}
                    </td>
                    <td className={`py-1.5 text-right font-mono tabular-nums ${TXT.forte}`}>{brl(n.valor)}</td>
                    <td className={`py-1.5 text-right font-mono tabular-nums ${TXT.normal}`}>{n.retencaoTecnica ? brl(n.retencaoTecnica) : '—'}</td>
                    {/* Na planilha o "a receber" pendente é vermelho. Aqui o vermelho fica para o
                        que JÁ VENCEU; o que ainda está no prazo é âmbar — a diferença importa. */}
                    <td className={`py-1.5 text-right ${n.situacao === 'recebido' ? TXT.positivo : vencida ? `${TXT.erro} font-bold` : TXT.atencao}`}>
                      {n.situacao === 'recebido'
                        ? `recebido${n.dataRecebimento ? ` ${fmtDataBR(n.dataRecebimento)}` : ''}`
                        : `a receber${n.previsaoRecebimento ? ` ${fmtDataBR(n.previsaoRecebimento)}` : ''}${vencida ? ' · vencida' : ''}`}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-[#525252]">
                <td className={`py-2 font-bold ${TXT.forte}`} colSpan={3}>TOTAL FATURADO</td>
                <td className={`py-2 text-right font-mono font-bold tabular-nums ${TXT.destaque}`}>{brl(resumo.faturado)}</td>
                <td className={`py-2 text-right font-mono font-bold tabular-nums ${TXT.normal}`}>{brl(resumo.retencao)}</td>
                <td className={`py-2 text-right text-[11px] ${TXT.fraco}`}>
                  {brl(resumo.recebido)} recebido{resumo.aReceber > 0 && ` · ${brl(resumo.aReceber)} a receber`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {resumo.vencidas.length > 0 && (
        <Aviso tom="erro">
          {resumo.vencidas.length} nota(s) com recebimento previsto para antes de hoje e ainda em aberto,
          somando {brl(resumo.vencidas.reduce((s, n) => s + n.valor, 0))}.
        </Aviso>
      )}
      {resumo.retencao > 0 && (
        <Aviso>
          <b>{brl(resumo.retencao)} de retenção</b> — dinheiro seu que o cliente está segurando como
          garantia e libera depois da entrega. Não entra no saldo e aparece na Carteira como “a liberar”.
        </Aviso>
      )}

      <div><BotaoSec onClick={abrir}><Pencil size={11} /> {ordenadas.length ? 'Editar medições' : 'Lançar nota'}</BotaoSec></div>
    </div>
  )
}
