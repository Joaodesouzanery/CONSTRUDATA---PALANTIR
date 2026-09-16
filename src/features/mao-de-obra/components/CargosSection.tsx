/**
 * Cargos — a função de cada pessoa e a diária de hora extra que ela costuma pagar.
 *
 * Fica logo abaixo de Equipes, em Funcionários, e nasce **recolhida**: quase ninguém mexe nisto
 * toda semana, e aberta ela empurraria a lista de funcionários para baixo da dobra.
 *
 * ⚠️ O valor cadastrado é SUGESTÃO. No arquivo real do cliente o mesmo "AJUDANTE GERAL I" recebeu
 * R$ 300 num sábado e R$ 200 no seguinte — o que se paga é o valor daquele dia. Esta tela existe
 * para poupar digitação e para o sistema poder AVISAR quando um lançamento foge do padrão, nunca
 * para decidir a folha sozinha. O texto está na própria tela, não só aqui.
 */
import { useMemo, useState } from 'react'
import { BadgeDollarSign, Plus, X } from 'lucide-react'
import type { Cargo, Worker } from '@/types'
import { AcoesDaLinha } from './AcoesDaLinha'
import { cargosSugeridos, chaveDoCargo, type CargoPadrao } from '../utils/cargosPadrao'

const brl = (v?: number) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null

interface Props {
  cargos: Cargo[]
  workers: Worker[]
  addCargo: (cargo: Omit<Cargo, 'id'>) => void
  updateCargo: (id: string, updates: Partial<Omit<Cargo, 'id'>>) => void
  removeCargo: (id: string) => void
  podeEscrever: boolean
}

export function CargosSection({ cargos, workers, addCargo, updateCargo, removeCargo, podeEscrever }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Cargo | null>(null)
  const [creating, setCreating] = useState(false)

  const sugestoes = useMemo(() => cargosSugeridos(workers, cargos), [workers, cargos])
  /** Quantas pessoas usam cada cargo — cargo sem ninguém é candidato a erro de digitação. */
  const quantosUsam = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of workers) {
      const k = chaveDoCargo(w.role ?? '')
      if (k) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [workers])

  const ordenados = useMemo(
    () => [...cargos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [cargos],
  )

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
          <BadgeDollarSign size={14} className="text-[#ffa055]" />
          Cargos ({cargos.length})
          <span className="text-[11px] font-normal text-[#adadad]">— a diária de hora extra sugerida para cada função</span>
        </span>
        <span className="text-xs text-[#adadad]">{open ? 'Recolher' : 'Expandir'}</span>
      </button>

      {open && (
        <div className="border-t border-[#525252] p-4">
          {/* A ressalva fica ANTES da tabela, não num rodapé: quem cadastra R$ 300 precisa saber,
              na hora de digitar, que aquilo é um chute inicial e não o que a pessoa vai receber. */}
          <p className="mb-3 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
            Estes valores são <strong>sugestão</strong>, não o que será pago. No arquivo de agosto o
            mesmo <em>Ajudante Geral I</em> recebeu R$ 300 num sábado e R$ 200 no seguinte — a diária
            é negociada por dia. O cadastro só preenche o campo por você e permite avisar quando um
            lançamento foge do padrão.
          </p>

          {ordenados.length === 0 ? (
            <p className="mb-3 text-xs text-[#adadad]">
              Nenhum cargo cadastrado ainda. {sugestoes.length > 0 && 'Use as sugestões abaixo para começar.'}
            </p>
          ) : (
            <div className="mb-3 overflow-x-auto rounded-lg border border-[#525252]">
              <table className="w-full text-xs">
                <thead className="bg-[#2c2c2c]">
                  <tr className="text-[10px] uppercase tracking-wide text-[#adadad]">
                    <th className="px-3 py-2 text-left font-semibold">Cargo</th>
                    <th className="px-3 py-2 text-right font-semibold">Sábado</th>
                    <th className="px-3 py-2 text-right font-semibold">Domingo / feriado</th>
                    <th className="px-3 py-2 text-right font-semibold">Pessoas</th>
                    <th className="px-3 py-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d3d3d]">
                  {ordenados.map((c) => {
                    const usam = quantosUsam.get(chaveDoCargo(c.nome)) ?? 0
                    return (
                      <tr key={c.id} className="bg-[#2c2c2c]">
                        <td className="px-3 py-2 font-medium text-[#f5f5f5]">{c.nome}</td>
                        {/* "não configurado" em vez de R$ 0,00: zero é um valor legítimo e não
                            pode significar "ninguém preencheu". */}
                        <td className="px-3 py-2 text-right font-mono text-[#c9c9c9]">
                          {brl(c.valorSabado) ?? <span className="text-[#6b6b6b]">não configurado</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#c9c9c9]">
                          {brl(c.valorDomingo) ?? <span className="text-[#6b6b6b]">não configurado</span>}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${usam === 0 ? 'text-[#fbbf24]' : 'text-[#adadad]'}`}
                            title={usam === 0 ? 'Nenhum funcionário com este cargo — confira a grafia' : undefined}>
                          {usam}
                        </td>
                        <td className="px-3 py-2">
                          {podeEscrever && (
                            <AcoesDaLinha
                              descricao={`o cargo ${c.nome}`}
                              onEditar={() => setEditing(c)}
                              onExcluir={() => removeCargo(c.id)}
                              consequencia="Os funcionários continuam com o cargo escrito no cadastro; some só a diária sugerida."
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {podeEscrever && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#525252] px-3 py-1.5 text-xs font-semibold text-[#c9c9c9] transition-colors hover:border-[#f97316] hover:text-[#ffa055]"
              >
                <Plus size={13} /> Adicionar cargo
              </button>
              {sugestoes.length > 0 && (
                <span className="text-[11px] text-[#adadad]">
                  {sugestoes.length} sugestão(ões) a partir do quadro de pessoal e da tabela de agosto:
                </span>
              )}
            </div>
          )}

          {podeEscrever && sugestoes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sugestoes.map((s) => (
                <button
                  key={s.nome}
                  type="button"
                  onClick={() => addCargo({ nome: s.nome, valorSabado: s.valorSabado, valorDomingo: s.valorDomingo })}
                  title={`Cadastrar ${s.nome}${s.valorSabado ? ` · sábado ${brl(s.valorSabado)}` : ''}${s.valorDomingo ? ` · domingo ${brl(s.valorDomingo)}` : ''}`}
                  className="rounded-full border border-[#525252] bg-[#2c2c2c] px-2.5 py-1 text-[11px] text-[#c9c9c9] transition-colors hover:border-[#f97316] hover:text-[#ffa055]"
                >
                  + {s.nome}
                  {(s.valorSabado ?? s.valorDomingo) != null && (
                    <span className="ml-1 text-[#6b6b6b]">
                      {s.valorSabado ?? '—'}/{s.valorDomingo ?? '—'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(creating || editing) && (
        <CargoDialog
          initial={editing}
          sugestoes={sugestoes}
          existentes={cargos}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(values) => {
            if (editing) updateCargo(editing.id, values)
            else addCargo(values)
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function CargoDialog({ initial, sugestoes, existentes, onClose, onSave }: {
  initial: Cargo | null
  sugestoes: CargoPadrao[]
  existentes: Cargo[]
  onClose: () => void
  onSave: (values: Omit<Cargo, 'id'>) => void
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [sabado, setSabado] = useState(initial?.valorSabado != null ? String(initial.valorSabado) : '')
  const [domingo, setDomingo] = useState(initial?.valorDomingo != null ? String(initial.valorDomingo) : '')

  const input = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]'
  const label = 'block text-[11px] text-[#c9c9c9] uppercase mb-1'

  /** Campo vazio vira `undefined` (= não configurado), nunca 0. Ver o tipo `Cargo`. */
  const numeroOuAusente = (v: string): number | undefined => {
    const t = v.trim().replace(/\./g, '').replace(',', '.')
    if (t === '') return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
  }

  // Duplicata é comparada sem acento e sem caixa — é assim que "ÁGUA I" e "AGUA I" nascem juntos.
  const jaExiste = existentes.some(
    (c) => c.id !== initial?.id && chaveDoCargo(c.nome) === chaveDoCargo(nome),
  )

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md space-y-3 rounded-xl border border-[#525252] bg-[#333333] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{initial ? 'Editar cargo' : 'Novo cargo'}</h3>
          <button type="button" onClick={onClose} className="text-[#adadad] hover:text-white" aria-label="Fechar"><X size={16} /></button>
        </div>

        <div>
          <label className={label}>Nome do cargo *</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={input} placeholder="Ex.: Encanador de Esgoto III" list="cargos-sugeridos" />
          <datalist id="cargos-sugeridos">
            {sugestoes.map((s) => <option key={s.nome} value={s.nome} />)}
          </datalist>
          {jaExiste && (
            <p className="mt-1 text-[11px] text-[#fbbf24]">
              Já existe um cargo com este nome (a comparação ignora acento e maiúscula).
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Diária de HE — sábado</label>
            <input value={sabado} onChange={(e) => setSabado(e.target.value)} className={input} placeholder="deixe vazio se não houver" inputMode="decimal" />
          </div>
          <div>
            <label className={label}>Diária de HE — domingo</label>
            <input value={domingo} onChange={(e) => setDomingo(e.target.value)} className={input} placeholder="deixe vazio se não houver" inputMode="decimal" />
          </div>
        </div>
        <p className="text-[11px] leading-4 text-[#adadad]">
          Feriado paga como domingo. Campo vazio fica <em>não configurado</em> — diferente de R$ 0,00,
          que seria "esta função não recebe".
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg bg-[#484848] px-4 py-2 text-sm font-medium text-[#f5f5f5] hover:bg-[#525252]">Cancelar</button>
          <button
            type="button"
            disabled={!nome.trim() || jaExiste}
            onClick={() => onSave({ nome: nome.trim(), valorSabado: numeroOuAusente(sabado), valorDomingo: numeroOuAusente(domingo) })}
            className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea580c] disabled:opacity-50"
          >
            {initial ? 'Salvar' : 'Criar cargo'}
          </button>
        </div>
      </div>
    </div>
  )
}
