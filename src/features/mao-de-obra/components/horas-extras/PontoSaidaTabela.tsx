/**
 * "Ausência ponto saída" — a devolução de hora descontada por ponto não batido.
 *
 * ⚠️ Esta aba **devolve** dinheiro, não desconta. Quem esqueceu de bater o ponto na saída teve
 * horas cortadas pelo relógio; a empresa confere que a pessoa estava lá e paga essas horas de
 * volta, SOMADAS à hora extra do mesmo dia. Por isso a coluna TOTAL soma as duas parcelas.
 * A conta está em `horaExtraCalculo.ts` e fecha ao centavo com as 10 linhas de agosto do cliente.
 *
 * As colunas calculadas são só leitura — quem digita informa salário, horas descontadas e horas
 * extras; o resto é consequência. Editar um resultado à mão é como a planilha do cliente ganhou
 * as 4 linhas que não seguem a própria fórmula.
 */
import { useMemo, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { CLTSettings, HoraExtra, Worker } from '@/types'
import { AcoesDaLinha } from '../AcoesDaLinha'
import { calcularPontoSaida, chaveDaPessoa, fatorDoAdicional, idDaHoraExtra } from '../../utils/horaExtraCalculo'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const h = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

interface Props {
  workers: Worker[]
  horasExtras: HoraExtra[]
  cltSettings: CLTSettings
  mes: number
  ano: number
  podeEscrever: boolean
  upsertHoraExtra: (he: HoraExtra) => void
  removeHoraExtra: (id: string) => void
  marcarPaga: (id: string) => void
  desmarcarPaga: (id: string) => void
}

interface Rascunho {
  id?: string
  workerId?: string
  workerNome: string
  cargo?: string
  data: string
  salario: string
  horasDescontadas: string
  horasExtras: string
  diasTexto: string
}

export function PontoSaidaTabela(props: Props) {
  const { workers, horasExtras, cltSettings, mes, ano, podeEscrever } = props
  const fator = fatorDoAdicional(cltSettings.overtimeRate)
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)

  const linhas = useMemo(
    () => horasExtras
      .filter((x) => x.tipo === 'ponto-saida' && x.data.startsWith(prefixo))
      .sort((a, b) => a.workerNome.localeCompare(b.workerNome, 'pt-BR')),
    [horasExtras, prefixo],
  )

  const total = linhas.reduce((s, x) => s + x.valor, 0)
  const pago = linhas.filter((x) => x.pago).reduce((s, x) => s + x.valor, 0)

  function salvar(r: Rascunho) {
    const salario = Number(r.salario.replace(',', '.')) || 0
    const conta = calcularPontoSaida({
      salario,
      horasDescontadas: Number(r.horasDescontadas.replace(',', '.')) || 0,
      horasExtras: Number(r.horasExtras.replace(',', '.')) || 0,
      fatorAdicional: fator,
    })
    if (!r.workerNome.trim() || !r.data) return
    const id = r.id ?? idDaHoraExtra(
      chaveDaPessoa({ workerId: r.workerId, workerNome: r.workerNome }), r.data, 'ponto-saida',
    )
    const existente = horasExtras.find((x) => x.id === id)
    props.upsertHoraExtra({
      id,
      workerId: r.workerId,
      workerNome: r.workerNome.trim(),
      cargo: r.cargo,
      data: r.data,
      tipo: 'ponto-saida',
      valor: conta.total,
      pago: existente?.pago ?? false,
      pagoEm: existente?.pagoEm,
      pagoPor: existente?.pagoPor,
      entryId: existente?.entryId,
      origem: existente?.origem ?? 'manual',
      detalhe: {
        horasDescontadas: Number(r.horasDescontadas.replace(',', '.')) || 0,
        horasExtras: Number(r.horasExtras.replace(',', '.')) || 0,
        salario,
        fatorAdicional: fator,
        diasTexto: r.diasTexto.trim() || undefined,
      },
      createdAt: existente?.createdAt ?? new Date().toISOString(),
    })
    setRascunho(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-[#adadad]">A devolver no mês <b className="ml-1 text-[#f5f5f5]">{brl(total)}</b></span>
          <span className="text-[#adadad]">Já pago <b className="ml-1 text-[#4ade80]">{brl(pago)}</b></span>
          <span className="text-[#adadad]">Adicional aplicado <b className="ml-1 text-[#f5f5f5]">{Math.round((fator - 1) * 100)}%</b></span>
        </div>
        {podeEscrever && (
          <button
            type="button"
            onClick={() => setRascunho({ workerNome: '', data: `${prefixo}-01`, salario: '', horasDescontadas: '', horasExtras: '', diasTexto: '' })}
            className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#ea580c]"
          >
            <Plus size={14} /> Lançar devolução
          </button>
        )}
      </div>

      <p className="rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-3 py-2 text-[11px] leading-5 text-[#93c5fd]">
        Esta tabela <b>devolve</b> horas descontadas por ponto não batido — ela não desconta nada. O
        total soma as horas extras (valor-hora + {Math.round((fator - 1) * 100)}%) com as horas
        descontadas (valor-hora simples, sem adicional). Valor-hora = salário ÷ 220.
      </p>

      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr className="bg-[#484848] text-[#adadad]">
              {['Nome', 'Dias', 'Salário', 'H. desc.', 'H. extras', 'Valor hora', `Hora +${Math.round((fator - 1) * 100)}%`, 'Valor extras', 'Valor devolvido', 'Total', 'Pago', ''].map((t, i) => (
                <th key={t + i} className={`px-3 py-2 font-medium ${i >= 2 && i <= 9 ? 'text-right' : 'text-left'}`}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!linhas.length && (
              <tr><td colSpan={12} className="px-3 py-6 text-center text-[#adadad]">Nenhuma devolução lançada neste mês.</td></tr>
            )}
            {linhas.map((x) => {
              const d = x.detalhe
              const conta = calcularPontoSaida({
                salario: d?.salario ?? 0,
                horasDescontadas: d?.horasDescontadas ?? 0,
                horasExtras: d?.horasExtras ?? 0,
                fatorAdicional: d?.fatorAdicional ?? fator,
              })
              return (
                <tr key={x.id} className="border-t border-[#525252]">
                  <td className="px-3 py-1.5 font-medium text-[#f5f5f5]">{x.workerNome}</td>
                  <td className="px-3 py-1.5 text-[#adadad]">{d?.diasTexto || x.data.slice(8, 10) + '/' + x.data.slice(5, 7)}</td>
                  <td className="px-3 py-1.5 text-right text-[#adadad]">{brl(d?.salario ?? 0)}</td>
                  <td className="px-3 py-1.5 text-right text-[#adadad]">{h(d?.horasDescontadas ?? 0)}</td>
                  <td className="px-3 py-1.5 text-right text-[#adadad]">{h(d?.horasExtras ?? 0)}</td>
                  <td className="px-3 py-1.5 text-right text-[#8a8a8a]">{brl(conta.valorHora)}</td>
                  <td className="px-3 py-1.5 text-right text-[#8a8a8a]">{brl(conta.valorHoraComAdicional)}</td>
                  <td className="px-3 py-1.5 text-right text-[#adadad]">{brl(conta.valorHorasExtras)}</td>
                  <td className="px-3 py-1.5 text-right text-[#adadad]">{brl(conta.valorHorasDescontadas)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-[#f5f5f5]">{brl(x.valor)}</td>
                  <td className="px-3 py-1.5">
                    {x.pago ? (
                      <button
                        type="button" disabled={!podeEscrever}
                        onClick={() => confirm(`Desmarcar o pagamento de ${brl(x.valor)}?\n\nA despesa gerada no Controle de Caixa será apagada.`) && props.desmarcarPaga(x.id)}
                        title={`Pago${x.pagoPor ? ` por ${x.pagoPor}` : ''} — clique para desmarcar`}
                        className="flex items-center gap-1 rounded border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-0.5 text-[11px] font-semibold text-[#4ade80]"
                      >
                        <Check size={11} /> Pago
                      </button>
                    ) : podeEscrever ? (
                      <button
                        type="button" onClick={() => props.marcarPaga(x.id)}
                        title="Marcar como pago — gera a despesa no Controle de Caixa"
                        className="rounded border border-[#525252] px-2 py-0.5 text-[11px] text-[#adadad] transition-colors hover:border-[#22c55e]/40 hover:text-[#4ade80]"
                      >
                        Marcar
                      </button>
                    ) : <span className="text-[#8a8a8a]">—</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    <AcoesDaLinha
                      descricao={`a devolução de ${x.workerNome}`}
                      podeEscrever={podeEscrever && !x.pago}
                      onEditar={() => setRascunho({
                        id: x.id, workerId: x.workerId, workerNome: x.workerNome, cargo: x.cargo, data: x.data,
                        salario: String(d?.salario ?? ''), horasDescontadas: String(d?.horasDescontadas ?? ''),
                        horasExtras: String(d?.horasExtras ?? ''), diasTexto: d?.diasTexto ?? '',
                      })}
                      onExcluir={() => props.removeHoraExtra(x.id)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rascunho && (
        <DialogoDevolucao
          rascunho={rascunho} setRascunho={setRascunho} workers={workers} fator={fator}
          onSalvar={() => salvar(rascunho)} onFechar={() => setRascunho(null)}
        />
      )}
    </div>
  )
}

function DialogoDevolucao({ rascunho, setRascunho, workers, fator, onSalvar, onFechar }: {
  rascunho: Rascunho
  setRascunho: (r: Rascunho) => void
  workers: Worker[]
  fator: number
  onSalvar: () => void
  onFechar: () => void
}) {
  const previa = calcularPontoSaida({
    salario: Number(rascunho.salario.replace(',', '.')) || 0,
    horasDescontadas: Number(rascunho.horasDescontadas.replace(',', '.')) || 0,
    horasExtras: Number(rascunho.horasExtras.replace(',', '.')) || 0,
    fatorAdicional: fator,
  })
  const campo = 'w-full rounded-lg border border-[#525252] bg-[#484848] px-3 py-2 text-sm text-[#f5f5f5]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onFechar}>
      <div className="w-full max-w-lg rounded-xl border border-[#525252] bg-[#3d3d3d] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#f5f5f5]">{rascunho.id ? 'Editar devolução' : 'Lançar devolução de ponto saída'}</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-[#adadad] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs text-[#adadad]">
            Funcionário
            <select
              className={`${campo} mt-1`}
              value={rascunho.workerId ?? ''}
              onChange={(e) => {
                const w = workers.find((x) => x.id === e.target.value)
                setRascunho({ ...rascunho, workerId: w?.id, workerNome: w?.name ?? '', cargo: w?.role,
                  salario: w?.grossSalary ? String(w.grossSalary) : rascunho.salario })
              }}
            >
              <option value="">Selecione…</option>
              {workers.filter((w) => w.status === 'active').map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>

          <label className="text-xs text-[#adadad]">
            Primeiro dia
            <input type="date" className={`${campo} mt-1`} value={rascunho.data} onChange={(e) => setRascunho({ ...rascunho, data: e.target.value })} />
          </label>
          <label className="text-xs text-[#adadad]">
            Dias (como escrever no extrato)
            {/* O arquivo do cliente agrega dois dias numa linha ("13 e 20/08") com as horas já
                somadas. Repartir seria inventar; então o texto vai junto. */}
            <input className={`${campo} mt-1`} placeholder="13 e 20/08" value={rascunho.diasTexto} onChange={(e) => setRascunho({ ...rascunho, diasTexto: e.target.value })} />
          </label>

          <label className="text-xs text-[#adadad]">
            Salário mensal (R$)
            <input type="number" min={0} step={0.01} className={`${campo} mt-1`} value={rascunho.salario} onChange={(e) => setRascunho({ ...rascunho, salario: e.target.value })} />
          </label>
          <label className="text-xs text-[#adadad]">
            Horas descontadas
            <input type="number" min={0} step={0.01} className={`${campo} mt-1`} value={rascunho.horasDescontadas} onChange={(e) => setRascunho({ ...rascunho, horasDescontadas: e.target.value })} />
          </label>
          <label className="text-xs text-[#adadad]">
            Horas extras
            <input type="number" min={0} step={0.01} className={`${campo} mt-1`} value={rascunho.horasExtras} onChange={(e) => setRascunho({ ...rascunho, horasExtras: e.target.value })} />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-[#525252] bg-[#484848] px-3 py-2 text-[11px] text-[#adadad]">
          <div className="flex justify-between"><span>Valor hora (salário ÷ 220)</span><span className="text-[#f5f5f5]">{brl(previa.valorHora)}</span></div>
          <div className="flex justify-between"><span>Horas extras × hora +{Math.round((fator - 1) * 100)}%</span><span className="text-[#f5f5f5]">{brl(previa.valorHorasExtras)}</span></div>
          <div className="flex justify-between"><span>Horas devolvidas × hora simples</span><span className="text-[#f5f5f5]">{brl(previa.valorHorasDescontadas)}</span></div>
          <div className="mt-1 flex justify-between border-t border-[#525252] pt-1 font-semibold"><span className="text-[#f5f5f5]">Total a devolver</span><span className="text-[#f5f5f5]">{brl(previa.total)}</span></div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#adadad] hover:text-[#f5f5f5]">Cancelar</button>
          <button
            type="button" onClick={onSalvar} disabled={!rascunho.workerNome.trim() || previa.total <= 0}
            className="rounded-lg bg-[#f97316] px-3 py-2 text-xs font-medium text-white hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
