/**
 * A lista de notas fiscais — o arquivo, e a porta para o Financeiro.
 *
 * Molde: `BoletosPanel`. Seletores por CAMPO do store, não o objeto inteiro: sem
 * isso, cada transição de `syncStatus` re-renderiza todos os cards.
 *
 * ⚠️ **Lançar no Financeiro é botão, nunca automático.** A nota fica arquivada
 * com todos os dados, e a despesa só entra na DRE quando alguém manda. Foi
 * escolha explícita de quem usa: muita nota entra antes de ser conferida.
 */
import { useMemo, useState } from 'react'
import {
  ArrowUpRight, BadgeDollarSign, FileText, Plus, Receipt, Search, Trash2, Undo2,
} from 'lucide-react'
import type { NotaFiscal, SaidaCategoria } from '@/types'
import { SAIDA_CAT_LABELS, SAIDA_CATS, fmtBRL } from '@/features/financeiro/lib/financeiroCalc'
import { useNotasFiscaisStore } from '@/store/notasFiscaisStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useAuth } from '@/lib/auth'
import { canWriteTitulos } from '@/lib/roles'
import { StatCard } from '@/components/shared/StatCard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatarChave } from '../utils/chaveNfe'
import { ImportarNotaModal } from './ImportarNotaModal'

const BTN_P = 'inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:opacity-40'
const BTN_S = 'inline-flex items-center gap-1.5 rounded-lg border border-[#525252] bg-[#2c2c2c] px-2.5 py-1.5 text-[11px] font-semibold text-[#a3a3a3] transition-colors hover:border-[#f97316]/50 hover:text-[#f97316] disabled:opacity-40'

const cnpjBonito = (c: string) =>
  c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

export function NotasFiscaisPanel() {
  const notas = useNotasFiscaisStore((s) => s.notas)
  const salvarNota = useNotasFiscaisStore((s) => s.salvarNota)
  const lancar = useNotasFiscaisStore((s) => s.lancarNoFinanceiro)
  const desfazer = useNotasFiscaisStore((s) => s.desfazerLancamento)
  const remover = useNotasFiscaisStore((s) => s.removerNota)
  const sites = useTorreStore((s) => s.sites)
  const orgId = useAuth((s) => s.profile?.organization_id)
  const podeEscrever = canWriteTitulos(useAuth((s) => s.profile?.role))

  const [importando, setImportando] = useState(false)
  const [busca, setBusca] = useState('')
  const [fCategoria, setFCategoria] = useState<SaidaCategoria | ''>('')
  const [fStatus, setFStatus] = useState<'' | NotaFiscal['status']>('')
  const [apagando, setApagando] = useState<NotaFiscal | null>(null)

  const nomeDaObra = useMemo(
    () => new Map(sites.map((s) => [s.id, s.name])),
    [sites],
  )

  /**
   * Os KPIs somam TODAS as notas, não o filtro. Um cartão que muda quando você
   * digita na busca não é indicador, é resultado de pesquisa.
   */
  const kpis = useMemo(() => {
    const validas = notas.filter((n) => n.status !== 'cancelada')
    const total = validas.reduce((s, n) => s + n.valor, 0)
    const naoLancadas = validas.filter((n) => n.status !== 'lancada')
    return {
      quantidade: validas.length,
      total,
      ticket: validas.length ? total / validas.length : 0,
      naoLancadas: naoLancadas.length,
      naoLancadasBRL: naoLancadas.reduce((s, n) => s + n.valor, 0),
    }
  }, [notas])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const digitos = busca.replace(/\D/g, '')
    return notas
      .filter((n) => {
        if (fCategoria && n.categoria !== fCategoria) return false
        if (fStatus && n.status !== fStatus) return false
        if (!q) return true
        return (
          (n.emitente ?? '').toLowerCase().includes(q) ||
          (n.etiqueta ?? '').toLowerCase().includes(q) ||
          (digitos.length >= 3 && (n.chaveAcesso.includes(digitos) || n.cnpjEmitente.includes(digitos))) ||
          n.numero.includes(digitos)
        )
      })
      .sort((a, b) => (b.dataEmissao ?? b.createdAt).localeCompare(a.dataEmissao ?? a.createdAt))
  }, [notas, busca, fCategoria, fStatus])

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Notas arquivadas" value={String(kpis.quantidade)} icon={FileText} />
        <StatCard label="Total no arquivo" value={fmtBRL(kpis.total)} icon={BadgeDollarSign} variant="accent" />
        <StatCard label="Ticket médio" value={fmtBRL(kpis.ticket)} icon={Receipt} />
        {/* O único número acionável da tela: o que ainda não chegou na DRE. */}
        <StatCard
          label="Ainda não lançadas"
          value={String(kpis.naoLancadas)}
          sub={fmtBRL(kpis.naoLancadasBRL)}
          icon={ArrowUpRight}
          variant={kpis.naoLancadas > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Fornecedor, etiqueta, CNPJ ou número"
            className="w-full rounded-lg border border-[#525252] bg-[#2c2c2c] py-2 pl-8 pr-3 text-xs text-white outline-none focus:border-[#f97316]/60"
          />
        </div>
        <select
          value={fCategoria} onChange={(e) => setFCategoria(e.target.value as SaidaCategoria | '')}
          className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-2.5 py-2 text-xs text-white outline-none"
        >
          <option value="">Todas as categorias</option>
          {SAIDA_CATS.map((c) => <option key={c} value={c}>{SAIDA_CAT_LABELS[c]}</option>)}
        </select>
        <select
          value={fStatus} onChange={(e) => setFStatus(e.target.value as NotaFiscal['status'] | '')}
          className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-2.5 py-2 text-xs text-white outline-none"
        >
          <option value="">Todas</option>
          <option value="arquivada">Não lançadas</option>
          <option value="lancada">Lançadas</option>
        </select>
        {podeEscrever && (
          <button type="button" onClick={() => setImportando(true)} className={BTN_P}>
            <Plus size={14} /> Nova nota
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#525252] p-10 text-center">
          <FileText size={24} className="mx-auto mb-2 text-[#525252]" />
          <p className="text-sm text-[#a3a3a3]">
            {notas.length === 0 ? 'Nenhuma nota importada ainda.' : 'Nenhuma nota com esse filtro.'}
          </p>
          {notas.length === 0 && (
            <p className="mx-auto mt-1.5 max-w-md text-xs text-[#6b6b6b]">
              Fotografe o cupom: o QR Code preenche sozinho o fornecedor, a data, a série e o
              número — com o dígito verificador conferido. O valor você digita.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtradas.map((n) => (
            <article key={n.id} className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#f5f5f5]">
                    {n.emitente || cnpjBonito(n.cnpjEmitente)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6b6b6b]">
                    {n.modelo === '65' ? 'NFC-e' : 'NF-e'} nº {n.numero} · série {n.serie} · {n.uf}
                    {n.dataEmissao && ` · ${n.dataEmissao.split('-').reverse().join('/')}`}
                  </p>
                </div>
                <p className="shrink-0 text-base font-bold tabular-nums text-[#f5f5f5]">{fmtBRL(n.valor)}</p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md border border-[#525252] bg-[#2c2c2c] px-2 py-0.5 text-[10px] text-[#a3a3a3]">
                  {SAIDA_CAT_LABELS[n.categoria]}
                </span>
                {n.etiqueta && (
                  <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                    {n.etiqueta}
                  </span>
                )}
                {n.obraId && nomeDaObra.get(n.obraId) && (
                  <span className="rounded-md border border-[#525252] bg-[#2c2c2c] px-2 py-0.5 text-[10px] text-[#a3a3a3]">
                    {nomeDaObra.get(n.obraId)}
                  </span>
                )}
                {n.status === 'lancada' && (
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                    lançada no Financeiro
                  </span>
                )}
              </div>

              <p className="mt-2 font-mono text-[9px] leading-4 text-[#525252]">{formatarChave(n.chaveAcesso)}</p>

              {podeEscrever && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {n.status === 'lancada' ? (
                    <button type="button" onClick={() => desfazer(n.id)} className={BTN_S}>
                      <Undo2 size={12} /> Desfazer lançamento
                    </button>
                  ) : (
                    <button type="button" onClick={() => lancar(n.id)} className={BTN_S}>
                      <ArrowUpRight size={12} /> Lançar no Financeiro
                    </button>
                  )}
                  <button type="button" onClick={() => setApagando(n)} className={`${BTN_S} ml-auto hover:border-red-500/50 hover:text-red-300`}>
                    <Trash2 size={12} /> Apagar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {importando && (
        <ImportarNotaModal
          notas={notas} orgId={orgId}
          onSalvar={salvarNota}
          onClose={() => setImportando(false)}
        />
      )}

      {apagando && (
        <ConfirmDialog
          open
          title="Apagar esta nota?"
          message={
            apagando.status === 'lancada'
              ? `A nota de ${fmtBRL(apagando.valor)} e o lançamento que ela gerou no Financeiro serão removidos juntos.`
              : `A nota de ${fmtBRL(apagando.valor)} sai do arquivo. Nada é apagado do Financeiro.`
          }
          confirmLabel="Apagar"
          onConfirm={() => { remover(apagando.id); setApagando(null) }}
          onCancel={() => setApagando(null)}
        />
      )}
    </div>
  )
}
