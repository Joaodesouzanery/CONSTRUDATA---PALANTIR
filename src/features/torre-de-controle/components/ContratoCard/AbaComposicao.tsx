/**
 * Aba COMPOSIÇÃO — a planilha do contrato: como o valor foi formado.
 *
 * Cada linha carrega mão de obra E material, porque é assim que a proposta real do cliente é
 * feita (ITEM · DESCRIÇÃO · UN · QTD · Mão de obra · TOTAL, fechando R$ 183.624,55 de mão de obra
 * + R$ 180.030,00 de material). O contrato da SUPERA é o outro extremo — linhas só de mão de obra
 * e uma só de material — e cabe no mesmo modelo com um dos preços em zero.
 *
 * O subtotal sai **por categoria**, e é ele que confere contra os valores do cabeçalho.
 */
import { useState } from 'react'
import { Plus, Trash2, Save, X, Pencil, Upload } from 'lucide-react'
import { parseLocaleNumber } from '@/lib/numberFormat'
import {
  itensOrdenados, subtotaisComposicao, valoresDaLinha, categoriaDoItem, calcServico,
} from '@/features/torre-de-controle/utils/obraMedicao'
import { UNIDADE_VERBA, ehVerba } from '@/lib/unidadesMedida'
import type { ObraContrato, ObraContratoServico, ObraItemCategoria } from '@/types'
import { TXT, brl, num, inputCls, numCls } from './formato'
import { Th, BotaoSec, Aviso } from './ui'
import { ImportarComposicao } from './ImportarComposicao'

const CATEGORIAS: { v: ObraItemCategoria; label: string }[] = [
  { v: 'servico',     label: 'Serviço' },
  { v: 'material',    label: 'Material' },
  { v: 'frete',       label: 'Frete' },
  { v: 'equipamento', label: 'Equipamento' },
]

export function AbaComposicao({ contrato, medidoAuto, salvar }: {
  contrato: ObraContrato
  medidoAuto: Map<string, number>
  salvar: (patch: Partial<ObraContrato>) => void
}) {
  const [editando, setEditando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [linhas, setLinhas] = useState<ObraContratoServico[]>([])

  const itens = itensOrdenados(contrato.services ?? [])
  const sub = subtotaisComposicao(contrato.services ?? [])

  function abrir() { setLinhas(structuredClone(itens)); setEditando(true) }
  function confirmar() { salvar({ services: linhas }); setEditando(false) }

  const set = (id: string, patch: Partial<ObraContratoServico>) =>
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const adicionar = () => setLinhas((ls) => [...ls, {
    id: crypto.randomUUID(), descricao: '', unidade: 'm²', qtdContrato: 0, valorUnitario: 0,
    ordem: ls.length + 1,
  }])
  const remover = (id: string) => setLinhas((ls) => ls.filter((l) => l.id !== id))

  if (importando) {
    return (
      <ImportarComposicao
        onCancelar={() => setImportando(false)}
        onImportar={(novas) => {
          // Importar SUBSTITUI a composição inteira: é o comportamento que o usuário espera ao
          // subir "a planilha do contrato", e evita duplicar tudo em quem importar duas vezes.
          salvar({ services: novas })
          setImportando(false)
        }}
      />
    )
  }

  if (editando) {
    const subRascunho = subtotaisComposicao(linhas)
    return (
      <div className="flex flex-col gap-2 pt-1">
        {linhas.length === 0 && (
          <p className={`py-2 text-[11px] ${TXT.fraco}`}>Nenhum item. Adicione um, ou importe a planilha da proposta.</p>
        )}
        {linhas.map((l) => (
          <div key={l.id} className="flex flex-col gap-1.5 rounded-lg border border-[#525252] bg-[#2c2c2c] p-2">
            <div className="flex gap-1.5">
              <input className={`${numCls} w-14`} value={l.ordem ?? ''} placeholder="nº"
                     onChange={(e) => set(l.id, { ordem: parseLocaleNumber(e.target.value) || undefined })} />
              <input className={inputCls} value={l.descricao} placeholder="Descrição (ex.: Pintura epóxi em piso)"
                     onChange={(e) => set(l.id, { descricao: e.target.value })} />
              <select className={`${inputCls} w-32`} value={categoriaDoItem(l)}
                      onChange={(e) => set(l.id, { categoria: e.target.value as ObraItemCategoria })}>
                {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
              <button onClick={() => remover(l.id)} title="Remover item"
                      className="shrink-0 rounded px-2 text-[#a3a3a3] hover:bg-[#ef4444]/15 hover:text-[#ef4444]">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] ${TXT.fraco}`}>Unidade</span>
                <input className={inputCls} value={l.unidade} list="contrato-unidades"
                       onChange={(e) => {
                         const unidade = e.target.value
                         // Verba é valor fechado: a quantidade trava em 1 para `qtd × preço`
                         // devolver o valor sem caso especial na conta.
                         set(l.id, ehVerba(unidade) ? { unidade, qtdContrato: 1 } : { unidade })
                       }} />
              </label>
              {!ehVerba(l.unidade) && (
                <label className="flex flex-col gap-1">
                  <span className={`text-[11px] ${TXT.fraco}`}>Quantidade</span>
                  <input className={numCls} value={l.qtdContrato || ''} inputMode="decimal"
                         onChange={(e) => set(l.id, { qtdContrato: parseLocaleNumber(e.target.value) })} />
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] ${TXT.fraco}`}>Mão de obra (R$)</span>
                <input className={numCls} value={l.valorUnitario || ''} inputMode="decimal"
                       onChange={(e) => set(l.id, { valorUnitario: parseLocaleNumber(e.target.value) })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] ${TXT.fraco}`}>Material (R$)</span>
                <input className={numCls} value={l.valorMaterialUnit || ''} inputMode="decimal"
                       onChange={(e) => set(l.id, { valorMaterialUnit: parseLocaleNumber(e.target.value) || undefined })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] ${TXT.fraco}`}>% aplicado</span>
                <input className={numCls} value={l.pctAplicado ?? ''} inputMode="decimal" placeholder="100"
                       onChange={(e) => set(l.id, { pctAplicado: e.target.value.trim() === '' ? undefined : parseLocaleNumber(e.target.value) })} />
              </label>
            </div>
            <p className={`text-[11px] ${TXT.fraco}`}>
              Total da linha: <b className={TXT.normal}>{brl(valoresDaLinha(l).total)}</b>
            </p>
          </div>
        ))}
        <datalist id="contrato-unidades">
          <option value="m²" /><option value="m" /><option value="un" /><option value="kg" /><option value="h" />
          <option value={UNIDADE_VERBA}>verba — valor fechado, sem metragem</option>
        </datalist>

        <div className="flex flex-wrap items-center gap-2">
          <BotaoSec onClick={adicionar}><Plus size={11} /> Adicionar item</BotaoSec>
          <span className={`text-[11px] ${TXT.fraco}`}>
            Subtotal: serviço <b className={TXT.normal}>{brl(subRascunho.servico)}</b> ·
            material <b className={TXT.normal}>{brl(subRascunho.material)}</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={confirmar}
            className="inline-flex items-center gap-1 rounded-lg bg-[#f97316] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#ea580c]">
            <Save size={12} /> Salvar composição
          </button>
          <BotaoSec onClick={() => setEditando(false)}><X size={12} /> Cancelar</BotaoSec>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      {itens.length === 0 ? (
        <p className={`py-2 text-[11px] ${TXT.fraco}`}>
          A composição é a planilha do contrato: cada item com quantidade, preço de mão de obra e de material.
          Você pode digitar item a item ou importar a planilha da proposta.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr>
                <Th>Nº</Th><Th>Item</Th><Th alinha="right">Qtd</Th>
                <Th alinha="right">Mão de obra</Th><Th alinha="right">Material</Th>
                <Th alinha="right">Total</Th><Th alinha="right">Medido</Th><Th alinha="right">Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {itens.map((l, i) => {
                const v = valoresDaLinha(l)
                const c = calcServico(l, medidoAuto)
                const cat = categoriaDoItem(l)
                return (
                  <tr key={l.id} className="border-t border-[#3d3d3d]">
                    <td className={`py-1.5 pr-2 font-mono ${TXT.fraco}`}>{l.ordem ?? i + 1}</td>
                    <td className={`py-1.5 pr-2 ${TXT.forte}`}>
                      {l.descricao || '—'}
                      {cat !== 'servico' && (
                        <span className={`ml-1.5 rounded bg-[#484848] px-1 text-[11px] ${TXT.fraco}`}>
                          {CATEGORIAS.find((c2) => c2.v === cat)?.label}
                        </span>
                      )}
                    </td>
                    <td className={`py-1.5 text-right font-mono tabular-nums ${TXT.normal}`}>
                      {ehVerba(l.unidade) ? '—' : `${num(l.qtdContrato)} ${l.unidade}`}
                    </td>
                    <td className={`py-1.5 text-right font-mono tabular-nums ${TXT.normal}`}>{v.maoDeObra > 0 ? brl(v.maoDeObra) : '—'}</td>
                    <td className={`py-1.5 text-right font-mono tabular-nums ${TXT.normal}`}>{v.material > 0 ? brl(v.material) : '—'}</td>
                    <td className={`py-1.5 text-right font-mono tabular-nums font-semibold ${TXT.forte}`}>{brl(v.total)}</td>
                    <td className={`py-1.5 text-right font-mono tabular-nums ${TXT.normal}`}>
                      {ehVerba(l.unidade) ? '—' : num(c.medido)}
                    </td>
                    <td className={`py-1.5 text-right font-mono tabular-nums font-semibold ${c.saldo < 0 ? TXT.erro : TXT.positivo}`}>
                      {ehVerba(l.unidade) ? '—' : num(c.saldo)}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-[#525252]">
                <td className={`py-2 font-bold ${TXT.forte}`} colSpan={3}>TOTAL</td>
                <td className={`py-2 text-right font-mono font-bold tabular-nums ${TXT.forte}`}>{brl(sub.servico)}</td>
                <td className={`py-2 text-right font-mono font-bold tabular-nums ${TXT.forte}`}>{brl(sub.material)}</td>
                <td className={`py-2 text-right font-mono font-bold tabular-nums ${TXT.destaque}`}>{brl(sub.total)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Subtotal por categoria: frete e equipamento entram do lado do material na conferência
          (são insumos, não trabalho), mas continuam visíveis aqui para nada ficar escondido. */}
      {(sub.porCategoria.frete > 0 || sub.porCategoria.equipamento > 0) && (
        <Aviso>
          Por categoria: serviço {brl(sub.porCategoria.servico)} · material {brl(sub.porCategoria.material)}
          {sub.porCategoria.frete > 0 && <> · frete {brl(sub.porCategoria.frete)}</>}
          {sub.porCategoria.equipamento > 0 && <> · equipamento {brl(sub.porCategoria.equipamento)}</>}.
          Frete e equipamento entram no lado do material na conferência do contrato.
        </Aviso>
      )}

      <div className="flex flex-wrap gap-2">
        <BotaoSec onClick={abrir}><Pencil size={11} /> {itens.length ? 'Editar composição' : 'Lançar itens'}</BotaoSec>
        <BotaoSec onClick={() => setImportando(true)}><Upload size={11} /> Importar planilha ou colar</BotaoSec>
      </div>
      <p className={`text-[11px] ${TXT.fraco}`}>
        “Medido” vem sozinho dos RDOs finalizados desta obra, pelo serviço a que cada linha de produção está vinculada.
      </p>
    </div>
  )
}
