/**
 * O diálogo de desligar × excluir — com a conta do que se perde.
 *
 * ─── POR QUE NÃO É UM `window.confirm` ────────────────────────────────────────
 * Porque o nativo só tem **duas** saídas, e aqui são três: desligar, excluir mesmo assim,
 * cancelar. Antes apareciam dois avisos seguidos e contraditórios — um dizia "apontamentos e
 * turnos já lançados continuam no histórico", o outro dizia "esta ação não pode ser desfeita" —
 * e nenhum dos dois mencionava que dava para só desligar.
 *
 * ─── AS TRÊS SITUAÇÕES ────────────────────────────────────────────────────────
 * Escolha do cliente: **contar o que se perde, e bloquear quando for muito**.
 *
 *  - **livre** — a pessoa não tem um único registro. Cadastro duplicado, erro de digitação.
 *    Excluir é a ação em destaque, sem sermão.
 *  - **avisar** — tem histórico, mas pouco. Mostra a conta, recomenda desligar, e ainda deixa
 *    excluir.
 *  - **bloquear** — a partir de 30 registros excluir sai da tela. Não é teimosia: sem chave
 *    estrangeira, o rastro vira órfão e o estrago é retroativo e silencioso — o holerite antigo
 *    passa a mostrar o código interno no lugar do nome, e o custo por departamento de março muda
 *    de forma hoje.
 */
import { useState } from 'react'
import { AlertTriangle, UserMinus, Trash2, X } from 'lucide-react'
import type { HistoricoDoFuncionario, DecisaoDeExclusao } from '@/lib/funcionarioAtivo'
import { HISTORICO_QUE_BLOQUEIA_EXCLUSAO } from '@/lib/funcionarioAtivo'

const hoje = () => new Date().toISOString().slice(0, 10)

/** `2024-03-05` → `03/2024`. O mês basta: o dia exato não ajuda a decidir. */
function mesAno(iso: string | null): string | null {
  if (!iso || iso.length < 7) return null
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

interface Props {
  nome: string
  historico: HistoricoDoFuncionario
  decisao: DecisaoDeExclusao
  onDesligar: (dados: { data: string; motivo: string }) => void
  onExcluir: () => void
  onCancelar: () => void
}

export function DesligarOuExcluirDialog({
  nome, historico, decisao, onDesligar, onExcluir, onCancelar,
}: Props) {
  const [data, setData] = useState(hoje())
  const [motivo, setMotivo] = useState('')

  const de = mesAno(historico.primeiraData)
  const ate = mesAno(historico.ultimaData)
  const podeExcluir = decisao !== 'bloquear'

  const itens = ([
    { n: historico.turnos,       rotulo: historico.turnos === 1 ? 'turno na Escala' : 'turnos na Escala' },
    { n: historico.apontamentos, rotulo: historico.apontamentos === 1 ? 'apontamento' : 'apontamentos', deRdo: historico.apontamentosDeRdo },
    { n: historico.faltas,       rotulo: historico.faltas === 1 ? 'registro de falta' : 'registros de falta' },
    { n: historico.avaliacoes,   rotulo: historico.avaliacoes === 1 ? 'avaliação' : 'avaliações' },
  ]).filter((i) => i.n > 0)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.72)' }}
         onClick={(e) => { if (e.target === e.currentTarget) onCancelar() }}>
      <div className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#333333] shadow-2xl"
           onClick={(e) => e.stopPropagation()}>

        <div className="flex items-start justify-between gap-3 border-b border-[#525252] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              decisao === 'livre' ? 'bg-[#ef4444]/15 text-[#ef4444]' : 'bg-[#f97316]/15 text-[#f97316]'}`}>
              {decisao === 'livre' ? <Trash2 size={16} /> : <AlertTriangle size={16} />}
            </span>
            <h3 className="text-sm font-bold text-[#f5f5f5]">
              {decisao === 'livre' ? `Excluir ${nome}?` : `${nome} saiu da empresa?`}
            </h3>
          </div>
          <button onClick={onCancelar} aria-label="Fechar"
                  className="text-[#a3a3a3] transition-colors hover:text-[#f5f5f5]">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          {decisao === 'livre' ? (
            <p className="text-[13px] leading-relaxed text-[#d4d4d4]">
              Esta pessoa não tem nenhum turno, apontamento, falta ou avaliação no sistema — excluir
              não perde nada. Se ela apenas saiu da empresa, <b>desligar</b> mantém o cadastro para
              uma recontratação.
            </p>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-[#d4d4d4]">
                Excluir apaga o cadastro, mas <b>não</b> apaga o rastro dele — que fica sem dono:
              </p>

              <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2.5">
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {itens.map((i) => (
                    <li key={i.rotulo} className="text-[12px] text-[#e5e5e5]">
                      <b className="font-mono text-[#f5f5f5]">{i.n}</b> {i.rotulo}
                      {/* Apontamento vindo de RDO não foi digitado por ninguém — some junto e não
                          tem como ser relançado à mão. */}
                      {(i.deRdo ?? 0) > 0 && <span className="text-[#a3a3a3]"> ({i.deRdo} de RDO)</span>}
                    </li>
                  ))}
                </ul>
                {de && (
                  <p className="mt-2 border-t border-[#525252] pt-2 text-[11px] text-[#a3a3a3]">
                    Trabalhou de <b className="text-[#d4d4d4]">{de}</b>
                    {ate && ate !== de ? <> a <b className="text-[#d4d4d4]">{ate}</b></> : null}.
                  </p>
                )}
              </div>

              <p className="text-[12px] leading-relaxed text-[#d4d4d4]">
                O holerite desse período passa a mostrar o código interno no lugar do nome, e o custo
                por departamento dos meses passados muda de forma — sem nada ter acontecido na obra.
                <b> Desligar mantém tudo isso de pé</b> e tira a pessoa da folha, do custo e da escala
                daqui para a frente.
              </p>

              {decisao === 'bloquear' && (
                <p className="rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
                  <b>Excluir não está disponível</b> para quem tem {HISTORICO_QUE_BLOQUEIA_EXCLUSAO}{' '}
                  registros ou mais ({historico.total} aqui). Desligue; se precisar mesmo apagar,
                  apague antes o histórico nas telas de origem.
                </p>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-2 border-t border-[#525252] pt-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Data da saída</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                     className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-2.5 py-1.5 text-[12px] text-[#f5f5f5]" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Motivo (opcional)</span>
              <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                     placeholder="Pedido de demissão, fim de obra…"
                     className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-2.5 py-1.5 text-[12px] text-[#f5f5f5] placeholder:text-[#9a9a9a]" />
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#525252] px-5 py-4 sm:flex-row sm:justify-end">
          <button onClick={onCancelar}
                  className="min-h-10 rounded-lg border border-[#525252] px-4 py-2 text-xs font-medium text-[#d4d4d4] transition-colors hover:text-[#f5f5f5]">
            Cancelar
          </button>
          {podeExcluir && (
            <button onClick={onExcluir}
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs transition-colors ${
                      decisao === 'livre'
                        ? 'bg-[#ef4444] font-semibold text-white hover:bg-[#dc2626]'
                        : 'border border-[#ef4444]/50 font-medium text-[#fca5a5] hover:bg-[#ef4444]/10'}`}>
              <Trash2 size={13} /> {decisao === 'livre' ? 'Excluir' : 'Excluir mesmo assim'}
            </button>
          )}
          <button onClick={() => onDesligar({ data, motivo })}
                  className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs transition-colors ${
                    decisao === 'livre'
                      ? 'border border-[#525252] font-medium text-[#d4d4d4] hover:text-[#f5f5f5]'
                      : 'bg-[#f97316] font-semibold text-white hover:bg-[#ea580c]'}`}>
            <UserMinus size={13} /> Desligar{decisao === 'livre' ? '' : ' (recomendado)'}
          </button>
        </div>
      </div>
    </div>
  )
}
