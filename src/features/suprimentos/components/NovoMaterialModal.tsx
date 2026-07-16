import { useState } from 'react'
import { X, Package } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { buildFrenteOptions, resolveFrenteDeposito } from '../utils/frentes'

interface Props {
  onClose: () => void
}

const UNIDADE_OPTIONS = ['un', 'sc', 'm³', 'br', 'm²', 'm', 'kg', 't', 'l', 'cx', 'pç', 'rlo']
const CATEGORIA_OPTIONS = [
  'Cimento e Argamassa',
  'Aço / Vergalhão',
  'Concreto Usinado',
  'Tubulação e Saneamento',
  'Impermeabilização',
  'Elétrico',
  'Hidráulico',
  'Outros',
]

const inp = (err?: boolean) =>
  cn(
    'w-full rounded-lg px-3 py-2 text-xs bg-[#484848] border text-[#f5f5f5] placeholder-[#6b6b6b] outline-none focus:ring-1 focus:ring-[#f97316]/40 transition-all',
    err ? 'border-[#ef4444]' : 'border-[#525252] focus:border-[#f97316]/60',
  )

export function NovoMaterialModal({ onClose }: Props) {
  const { depositos, addItemEstoque, addDeposito } = useSuprimentosStore(
    useShallow((s) => ({ depositos: s.depositos, addItemEstoque: s.addItemEstoque, addDeposito: s.addDeposito })),
  )
  const sites = useTorreStore((s) => s.sites)
  const frenteOptions = buildFrenteOptions(depositos, sites)

  const [form, setForm] = useState({
    descricao: '',
    unidade: '',
    depositoId: depositos[0]?.id ?? '',
    qtdDisponivel: '',
    estoqueMinimo: '',
    custoUnitario: '',
    categoria: '',
    fornecedorPrincipal: '',
    codigoReferencia: '',
    dataUltimoPedido: '',
    // Embalagem (facilitador) — estoque é sempre em UNIDADES; a caixa só facilita o lançamento.
    unidadeEmbalagem: '',
    qtdPorEmbalagem: '',
    numEmbalagens: '',
    valorPorEmbalagem: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }

  // Facilitador de embalagem: quando preenchido, deriva as unidades e o custo unitário.
  const porEmb = parseLocaleNumber(form.qtdPorEmbalagem)
  const numEmb = parseLocaleNumber(form.numEmbalagens)
  const valorEmb = parseLocaleNumber(form.valorPorEmbalagem)
  const qtdUnDerivada = porEmb > 0 && numEmb > 0 ? porEmb * numEmb : parseLocaleNumber(form.qtdDisponivel)
  const custoUnDerivado = valorEmb > 0 && porEmb > 0
    ? valorEmb / porEmb
    : (form.custoUnitario ? parseLocaleNumber(form.custoUnitario) : undefined)
  const usaEmbalagem = porEmb > 0 && (numEmb > 0 || valorEmb > 0)

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.descricao.trim()) errs.descricao = 'Obrigatório'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const resolved = form.depositoId ? resolveFrenteDeposito(form.depositoId, depositos, sites, addDeposito) : { id: '', siteId: null }
    addItemEstoque({
      // Reusa um depósito existente para "Estoque geral" (evita criar "Almoxarifado Central" duplicado).
      depositoId:           resolved.id || depositos[0]?.id || '',
      siteId:               resolved.siteId,
      descricao:            form.descricao.trim(),
      unidade:              form.unidade.trim(),
      qtdDisponivel:        qtdUnDerivada,
      qtdReservada:         0,
      qtdTransito:          0,
      estoqueMinimo:        parseLocaleNumber(form.estoqueMinimo),
      custoUnitario:        custoUnDerivado,
      categoria:            form.categoria || undefined,
      fornecedorPrincipal:  form.fornecedorPrincipal || undefined,
      qtdPorEmbalagem:      porEmb > 0 ? porEmb : undefined,
      unidadeEmbalagem:     form.unidadeEmbalagem.trim().replace(/^\s*[\d.,]+\s*/, '') || undefined,
      codigoReferencia:     form.codigoReferencia.trim() || undefined,
      dataUltimoPedido:     form.dataUltimoPedido || undefined,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2">
            <Package size={15} className="text-[#f97316]" />
            <h2 className="text-[#f5f5f5] font-bold text-sm">Adicionar Material</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Frente / Depósito (inclui obras da Torre de Controle) */}
          <div>
            <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
              Frente / Depósito
            </label>
            <select
              value={form.depositoId}
              onChange={(e) => set('depositoId', e.target.value)}
              className={inp()}
            >
              <option value="">Estoque geral (sem frente específica)</option>
              {frenteOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
              Descrição *
            </label>
            <input
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Ex: Tubo PVC 100mm JE 6m"
              className={inp(!!errors.descricao)}
            />
            {errors.descricao && <p className="text-[10px] text-[#ef4444] mt-0.5">{errors.descricao}</p>}
          </div>

          {/* Unidade + Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Unidade
              </label>
              <select
                value={form.unidade}
                onChange={(e) => set('unidade', e.target.value)}
                className={inp()}
              >
                <option value="">Sem unidade</option>
                {UNIDADE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Categoria
              </label>
              <select
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
                className={inp()}
              >
                <option value="">— Selecione —</option>
                {CATEGORIA_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Qtd Disponível + Estoque Mínimo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Qtd. Disponível
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.qtdDisponivel}
                onChange={(e) => set('qtdDisponivel', e.target.value)}
                placeholder="0"
                className={inp()}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Estoque Mínimo
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.estoqueMinimo}
                onChange={(e) => set('estoqueMinimo', e.target.value)}
                placeholder="0"
                className={inp()}
              />
            </div>
          </div>

          {/* Custo Unitário + Fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Custo Unit. (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.custoUnitario}
                onChange={(e) => set('custoUnitario', e.target.value)}
                placeholder="0,00"
                className={inp()}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Fornecedor Principal
              </label>
              <input
                value={form.fornecedorPrincipal}
                onChange={(e) => set('fornecedorPrincipal', e.target.value)}
                placeholder="Ex: TIGRE"
                className={inp()}
              />
            </div>
          </div>

          {/* Código de Referência + Data do último pedido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Código (referência)
              </label>
              <input
                value={form.codigoReferencia}
                onChange={(e) => set('codigoReferencia', e.target.value)}
                placeholder="Ex: FT48X24"
                className={inp()}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Data do último pedido
              </label>
              <input
                type="date"
                value={form.dataUltimoPedido}
                onChange={(e) => set('dataUltimoPedido', e.target.value)}
                className={inp()}
              />
            </div>
          </div>

          {/* Embalagem (facilitador) — comprou por caixa/fardo? Converte para unidades. */}
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c]/60 p-3 flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">
              Embalagem <span className="normal-case font-normal text-[#6b6b6b]">(facilitador — o estoque é sempre em unidades)</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[9px] text-[#6b6b6b] mb-0.5">Rótulo</label>
                <input
                  value={form.unidadeEmbalagem}
                  onChange={(e) => set('unidadeEmbalagem', e.target.value)}
                  placeholder="caixa"
                  className={inp()}
                />
              </div>
              <div>
                <label className="block text-[9px] text-[#6b6b6b] mb-0.5">Un/embalagem</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.qtdPorEmbalagem}
                  onChange={(e) => set('qtdPorEmbalagem', e.target.value)}
                  placeholder="96"
                  className={inp()}
                />
              </div>
              <div>
                <label className="block text-[9px] text-[#6b6b6b] mb-0.5">Nº embalagens</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.numEmbalagens}
                  onChange={(e) => set('numEmbalagens', e.target.value)}
                  placeholder="10"
                  className={inp()}
                />
              </div>
              <div>
                <label className="block text-[9px] text-[#6b6b6b] mb-0.5">R$/embalagem</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.valorPorEmbalagem}
                  onChange={(e) => set('valorPorEmbalagem', e.target.value)}
                  placeholder="346,56"
                  className={inp()}
                />
              </div>
            </div>
            {usaEmbalagem && (
              <p className="text-[10px] text-[#22c55e]">
                = {qtdUnDerivada.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un
                {custoUnDerivado !== undefined && ` · custo unit. R$ ${custoUnDerivado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                {' '}<span className="text-[#6b6b6b]">(preenche a Qtd. Disponível e o Custo Unit.)</span>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#525252] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
          >
            Adicionar Material
          </button>
        </div>
      </div>
    </div>
  )
}
