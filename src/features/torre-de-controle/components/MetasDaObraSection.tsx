/**
 * Metas e Fases da obra — a distribuição no tempo que o contrato nunca teve.
 *
 * `obraMedicao.ts` já dizia, por escrito: *"o contrato guarda quantidade e preço, **não
 * distribuição no tempo**. Preencher aquela metade exigiria um cadastro de cronograma por serviço
 * que ninguém pediu ainda."* Esta tela é aquela metade.
 *
 * ⚠️ **O total nunca é um número só.** Piso é m², demarcação é metro linear, sinalização é
 * unidade — e `1.000 + 340 + 12` não é área, nem comprimento, nem contagem. A tela imprime
 * parcelas, sempre, e é a regra que o cliente fixou em 21/08/2026 depois do contrato da SUPERA.
 *
 * ⚠️ **A meta é independente do contrato, por escolha do cliente** — mas quando a obra TEM
 * contrato, a divergência de preço aparece lado a lado. Dois números em silêncio é como nasce o
 * número que ninguém explica.
 */
import { useMemo, useState } from 'react'
import { Target, Plus, Trash2, AlertTriangle, Layers, Pencil, Check } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useRdoStore } from '@/store/rdoStore'
import { usePermissaoEscrita, ROLES_TORRE_WRITE } from '@/lib/roles'
import { FASES_PADRAO, FASE_POLIMENTO } from '@/features/rdo/data/fasesPadrao'
import { idDaFasePadrao } from '@/features/rdo/data/idDaFase'
import {
  realizadoPorFaseNoPeriodo, resumoDaMeta, conferirCatalogo, ritmoDiarioDaFase, TEXTO_SEM_RECEITA,
} from '../utils/metaDaObra'
import { formatarMetragem } from '@/lib/unidadesMedida'
import { vigenciaDaObra } from '../utils/obraBudget'
import { cn, fmtDataBR, formatCurrency, hojeLocalISO } from '@/lib/utils'
import type { ConstructionSite, FaseDaObra, MetaDoPeriodo, ModoPrecoFases } from '@/types'

const UNIDADES: Array<FaseDaObra['unidade']> = ['m²', 'm', 'un']

export function MetasDaObraSection({ site }: { site: ConstructionSite }) {
  const updateSite = useTorreStore((s) => s.updateSite)
  const rdos = useRdoStore((s) => s.rdos)
  const permissao = usePermissaoEscrita(ROLES_TORRE_WRITE)

  const [abrindoFases, setAbrindoFases] = useState(false)
  const [editandoMeta, setEditandoMeta] = useState<string | null>(null)

  const fases = useMemo(
    () => [...(site.fases ?? [])].sort((a, b) => a.ordem - b.ordem),
    [site.fases],
  )
  const modo: ModoPrecoFases = site.modoPrecoFases ?? 'peso'
  const metas = useMemo(
    () => [...(site.metas ?? [])].sort((a, b) => b.de.localeCompare(a.de)),
    [site.metas],
  )
  const problemas = useMemo(() => (fases.length > 0 ? conferirCatalogo(fases, modo) : []), [fases, modo])

  function salvar(patch: Partial<ConstructionSite>) {
    if (!permissao.pode) return
    updateSite(site.id, patch)
  }

  function criarCatalogoPadrao() {
    salvar({
      fases: FASES_PADRAO.map((f, i) => ({
        id: idDaFasePadrao(f.nome), nome: f.nome, unidade: f.unidade,
        ordem: i + 1, ativa: true, pesoPct: f.pesoPct,
      })),
    })
    setAbrindoFases(true)
  }

  function novaMeta() {
    // A janela padrão vem da vigência da obra (contrato, quando houver; cadastro, como recurso).
    // Sem nenhuma das duas, o mês corrente — que é um palpite honesto e editável.
    const v = vigenciaDaObra(site)
    const hoje = hojeLocalISO()
    salvar({
      metas: [...(site.metas ?? []), {
        id: crypto.randomUUID(),
        de: v?.de ?? `${hoje.slice(0, 7)}-01`,
        ate: v?.ate ?? hoje,
        porFase: {},
      }],
    })
  }

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#525252] px-4 py-3">
        <Target size={15} className="text-[#ffa055]" />
        <span className="text-sm font-semibold text-[#f5f5f5]">Metas de produção</span>
        <span className="text-[11px] text-[#adadad]">— quanto entregar, de tal dia a tal dia</span>
        {fases.length > 0 && (
          <button
            type="button" onClick={() => setAbrindoFases((v) => !v)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#525252] px-2.5 py-1 text-[11px] text-[#adadad] hover:text-[#f5f5f5]"
          >
            <Layers size={12} /> {fases.filter((f) => f.ativa).length} fases
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        {!permissao.pode && (
          <p className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2 text-[11px] text-[#fbbf24]">
            {permissao.explicacao ?? 'Seu acesso não permite alterar metas.'}
          </p>
        )}

        {fases.length === 0 ? (
          <SemCatalogo onCriar={criarCatalogoPadrao} podeEscrever={permissao.pode} />
        ) : (
          <>
            <ModoDePreco
              modo={modo} site={site} problemas={problemas}
              onTrocar={(m) => salvar({ modoPrecoFases: m })}
              podeEscrever={permissao.pode}
            />

            {abrindoFases && (
              <CatalogoDeFases
                fases={fases} modo={modo} podeEscrever={permissao.pode}
                onSalvar={(f) => salvar({ fases: f })}
              />
            )}

            {metas.length === 0 ? (
              <p className="rounded-lg border border-[#525252] bg-[#333] px-3 py-4 text-center text-xs text-[#adadad]">
                Nenhuma meta cadastrada. A meta diz quanto se pretende entregar num período — e é
                contra ela que o RDO do dia é comparado.
              </p>
            ) : metas.map((meta) => (
              <CartaoDaMeta
                key={meta.id}
                meta={meta} fases={fases} site={site} modo={modo} rdos={rdos}
                editando={editandoMeta === meta.id}
                podeEscrever={permissao.pode}
                onEditar={() => setEditandoMeta(editandoMeta === meta.id ? null : meta.id)}
                onSalvar={(m) => salvar({ metas: (site.metas ?? []).map((x) => (x.id === m.id ? m : x)) })}
                onExcluir={() => salvar({ metas: (site.metas ?? []).filter((x) => x.id !== meta.id) })}
              />
            ))}

            {permissao.pode && (
              <button
                type="button" onClick={novaMeta}
                className="flex items-center gap-1.5 self-start rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea6c10]"
              >
                <Plus size={13} /> Nova meta de período
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sem catálogo ─────────────────────────────────────────────────────────────

function SemCatalogo({ onCriar, podeEscrever }: { onCriar: () => void; podeEscrever: boolean }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#333] px-4 py-4 text-xs leading-5 text-[#adadad]">
      <p className="mb-2 text-[#f5f5f5]"><b>Esta obra ainda não tem fases cadastradas.</b></p>
      <p className="mb-3">
        As fases são o processo produtivo, em ordem — do lixamento à pintura das demarcações. O RDO
        aponta a metragem de cada uma no dia, e a meta acompanha. Enquanto não houver catálogo, o
        RDO oferece as oito padrão de piso industrial, mas a meta não tem contra o que comparar.
      </p>
      {podeEscrever && (
        <button
          type="button" onClick={onCriar}
          className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea6c10]"
        >
          <Plus size={13} /> Criar com as 8 fases padrão
        </button>
      )}
    </div>
  )
}

// ─── Modo de preço ────────────────────────────────────────────────────────────

function ModoDePreco({ modo, site, problemas, onTrocar, podeEscrever }: {
  modo: ModoPrecoFases
  site: ConstructionSite
  problemas: ReturnType<typeof conferirCatalogo>
  onTrocar: (m: ModoPrecoFases) => void
  podeEscrever: boolean
}) {
  // ⚠️ A divergência com o contrato, dita. A meta é independente por escolha do cliente — e é
  // justamente por isso que os dois preços precisam aparecer juntos quando existem os dois.
  const precoDoContrato = useMemo(() => {
    const servicos = site.contrato?.services ?? []
    const deArea = servicos.filter((s) => s.unidade === 'm²' && s.valorUnitario > 0)
    if (deArea.length === 0) return null
    const qtd = deArea.reduce((s, x) => s + (x.qtdContrato || 0), 0)
    if (qtd <= 0) return null
    return deArea.reduce((s, x) => s + (x.qtdContrato || 0) * x.valorUnitario, 0) / qtd
  }, [site.contrato])

  const divergente = precoDoContrato != null && site.precoM2 != null
    && Math.abs(precoDoContrato - site.precoM2) > 0.01

  return (
    <div className="rounded-lg border border-[#525252] bg-[#333] p-3">
      <p className="mb-2 text-[11px] text-[#adadad]">Como a metragem das fases vira dinheiro</p>
      <div className="mb-2 flex flex-wrap gap-1">
        {([
          ['peso', 'Peso por fase'],
          ['preco-proprio', 'Preço próprio por fase'],
        ] as const).map(([m, rotulo]) => (
          <button
            key={m} type="button" disabled={!podeEscrever} onClick={() => onTrocar(m)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
              modo === m ? 'bg-[#f97316] text-white' : 'border border-[#525252] text-[#adadad] hover:text-[#f5f5f5]',
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {/* ⚠️ Por EXTENSO, não um ícone. Quem lê o número precisa saber de que conta ele saiu. */}
      <p className="text-[11px] leading-5 text-[#c9c9c9]">
        {modo === 'peso' ? (
          <>
            <b>Valendo agora:</b> cada fase vale a fatia dela do preço do piso pronto
            {site.precoM2 != null ? <> (<b>{formatCurrency(site.precoM2)}/m²</b> da obra)</> : ' (a obra ainda não tem preço por m²)'}.
            Um metro quadrado só vale o preço cheio depois de passar por todas as fases de área.
          </>
        ) : (
          <>
            <b>Valendo agora:</b> cada fase tem o preço dela, por unidade própria. É o modo que
            precisa ser usado quando há demarcação (metro linear) ou sinalização (unidade) — o
            R$/m² do piso não se aplica a elas.
          </>
        )}
      </p>

      {divergente && (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            O contrato desta obra tem preço médio de <b>{formatCurrency(precoDoContrato!)}/m²</b> e o
            cadastro da obra diz <b>{formatCurrency(site.precoM2!)}/m²</b>. A meta usa o da obra.
            Você escolheu meta independente do contrato — este aviso existe para os dois não se
            afastarem em silêncio.
          </span>
        </p>
      )}

      {problemas.map((p) => (
        <p key={p.tipo} className="mt-2 flex items-start gap-2 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>{p.texto}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Catálogo de fases ────────────────────────────────────────────────────────

function CatalogoDeFases({ fases, modo, podeEscrever, onSalvar }: {
  fases: FaseDaObra[]
  modo: ModoPrecoFases
  podeEscrever: boolean
  onSalvar: (f: FaseDaObra[]) => void
}) {
  function altera(id: string, patch: Partial<FaseDaObra>) {
    onSalvar(fases.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const input = 'w-full rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-[11px] text-[#f5f5f5] outline-none focus:border-[#f97316]'

  return (
    <div className="overflow-x-auto rounded-lg border border-[#525252]">
      <table className="w-full min-w-[540px] text-[11px]">
        <thead>
          <tr className="border-b border-[#525252] bg-[#333] text-[10px] uppercase tracking-wider text-[#adadad]">
            <th className="px-2 py-2 text-left">#</th>
            <th className="px-2 py-2 text-left">Fase</th>
            <th className="px-2 py-2 text-left">Un.</th>
            <th className="px-2 py-2 text-right">{modo === 'peso' ? 'Peso %' : 'R$/un.'}</th>
            <th className="px-2 py-2 text-center">Ativa</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {fases.map((f) => (
            <tr key={f.id} className={cn('border-b border-[#525252]/60 last:border-0', !f.ativa && 'opacity-50')}>
              <td className="px-2 py-1.5 text-[#adadad]">{f.ordem}</td>
              <td className="px-2 py-1.5">
                <input className={input} value={f.nome} disabled={!podeEscrever}
                       onChange={(e) => altera(f.id, { nome: e.target.value })} />
              </td>
              <td className="px-2 py-1.5">
                <select className={input} value={f.unidade} disabled={!podeEscrever}
                        onChange={(e) => altera(f.id, { unidade: e.target.value as FaseDaObra['unidade'] })}>
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </td>
              <td className="px-2 py-1.5">
                {modo === 'peso' ? (
                  <input
                    className={`${input} text-right`} type="number" step="0.1" disabled={!podeEscrever}
                    value={f.pesoPct ?? ''} placeholder="—"
                    onChange={(e) => altera(f.id, { pesoPct: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                ) : (
                  <input
                    className={`${input} text-right`} type="number" step="0.01" disabled={!podeEscrever}
                    value={f.precoUnitario ?? ''} placeholder="—"
                    onChange={(e) => altera(f.id, { precoUnitario: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                )}
              </td>
              <td className="px-2 py-1.5 text-center">
                <input type="checkbox" checked={f.ativa} disabled={!podeEscrever} className="accent-[#f97316]"
                       onChange={(e) => altera(f.id, { ativa: e.target.checked })} />
              </td>
              <td className="px-2 py-1.5 text-right">
                {podeEscrever && (
                  <button type="button" title={`Remover ${f.nome}`}
                          onClick={() => onSalvar(fases.filter((x) => x.id !== f.id))}
                          className="text-[#a3a3a3] hover:text-[#fca5a5]">
                    <Trash2 size={12} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {podeEscrever && (
        <div className="flex flex-wrap gap-2 border-t border-[#525252] bg-[#333] px-2 py-2">
          <button
            type="button"
            onClick={() => onSalvar([...fases, {
              id: crypto.randomUUID(), nome: '', unidade: 'm²',
              ordem: Math.max(0, ...fases.map((f) => f.ordem)) + 1, ativa: true,
            }])}
            className="flex items-center gap-1 rounded border border-[#525252] px-2 py-1 text-[10px] text-[#adadad] hover:text-[#f5f5f5]"
          >
            <Plus size={11} /> Fase
          </button>
          {!fases.some((f) => f.nome === FASE_POLIMENTO.nome) && (
            <button
              type="button"
              onClick={() => onSalvar([...fases, {
                id: idDaFasePadrao(FASE_POLIMENTO.nome), nome: FASE_POLIMENTO.nome,
                unidade: FASE_POLIMENTO.unidade,
                ordem: Math.max(0, ...fases.map((f) => f.ordem)) + 1, ativa: true,
                pesoPct: FASE_POLIMENTO.pesoPct,
              }])}
              className="flex items-center gap-1 rounded border border-[#525252] px-2 py-1 text-[10px] text-[#adadad] hover:text-[#f5f5f5]"
            >
              <Plus size={11} /> Polimento
            </button>
          )}
          <span className="self-center text-[10px] text-[#6b6b6b]">
            ⚠️ Acrescentar fase não redistribui os pesos — a soma tem de voltar a 100%.
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Um período ───────────────────────────────────────────────────────────────

function CartaoDaMeta({ meta, fases, site, modo, rdos, editando, podeEscrever, onEditar, onSalvar, onExcluir }: {
  meta: MetaDoPeriodo
  fases: FaseDaObra[]
  site: ConstructionSite
  modo: ModoPrecoFases
  rdos: ReturnType<typeof useRdoStore.getState>['rdos']
  editando: boolean
  podeEscrever: boolean
  onEditar: () => void
  onSalvar: (m: MetaDoPeriodo) => void
  onExcluir: () => void
}) {
  const realizado = useMemo(
    () => realizadoPorFaseNoPeriodo(rdos, site.id, meta.de, meta.ate),
    [rdos, site.id, meta.de, meta.ate],
  )
  const resumo = useMemo(
    () => resumoDaMeta(fases, meta, realizado, modo, site.precoM2),
    [fases, meta, realizado, modo, site.precoM2],
  )

  const input = 'rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-[11px] text-[#f5f5f5] outline-none focus:border-[#f97316]'

  return (
    <div className="rounded-lg border border-[#525252] bg-[#333]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#525252] px-3 py-2">
        {editando ? (
          <>
            <input type="date" className={input} value={meta.de} onChange={(e) => onSalvar({ ...meta, de: e.target.value })} />
            <span className="text-[11px] text-[#adadad]">a</span>
            <input type="date" className={input} value={meta.ate} onChange={(e) => onSalvar({ ...meta, ate: e.target.value })} />
            <input className={`${input} min-w-[120px] flex-1`} value={meta.rotulo ?? ''} placeholder="Rótulo (opcional)"
                   onChange={(e) => onSalvar({ ...meta, rotulo: e.target.value || undefined })} />
          </>
        ) : (
          <span className="text-xs font-semibold text-[#f5f5f5]">
            {meta.rotulo ? `${meta.rotulo} · ` : ''}{fmtDataBR(meta.de)} a {fmtDataBR(meta.ate)}
            <span className="ml-1.5 text-[10px] font-normal text-[#adadad]">{resumo.dias} dias</span>
          </span>
        )}
        {podeEscrever && (
          <div className="ml-auto flex gap-1">
            <button type="button" onClick={onEditar} title={editando ? 'Concluir' : 'Editar'}
                    className="text-[#a3a3a3] hover:text-[#f5f5f5]">
              {editando ? <Check size={13} /> : <Pencil size={12} />}
            </button>
            <button type="button" onClick={onExcluir} title="Excluir meta" className="text-[#a3a3a3] hover:text-[#fca5a5]">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ⚠️ PARCELAS, nunca um total. Ver o docblock do arquivo. */}
      <div className="grid grid-cols-2 gap-3 border-b border-[#525252] px-3 py-2.5 sm:grid-cols-3">
        <Bloco rotulo="Previsto" valor={formatarMetragem(resumo.previsto) || '—'} />
        <Bloco rotulo="Realizado" valor={formatarMetragem(resumo.realizado) || '—'} />
        <Bloco
          rotulo="Receita no período"
          valor={formatCurrency(resumo.receita)}
          nota={resumo.fasesSemReceita > 0 ? `${resumo.fasesSemReceita} fase(s) sem preço` : undefined}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[11px]">
          <thead>
            <tr className="border-b border-[#525252]/60 text-[10px] uppercase tracking-wider text-[#adadad]">
              <th className="px-3 py-1.5 text-left">Fase</th>
              <th className="px-3 py-1.5 text-right">Meta</th>
              <th className="px-3 py-1.5 text-right">Feito</th>
              <th className="px-3 py-1.5 text-right">%</th>
              <th className="px-3 py-1.5 text-right">Por dia</th>
              <th className="px-3 py-1.5 text-right">Receita</th>
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map((l) => (
              <tr key={l.fase.id} className="border-b border-[#525252]/40 last:border-0">
                <td className="px-3 py-1.5 text-[#d4d4d4]">
                  {l.fase.ordem}. {l.fase.nome} <span className="text-[10px] text-[#6b6b6b]">{l.fase.unidade}</span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  {editando && podeEscrever ? (
                    <input
                      type="number" step="0.01" className={`${input} w-20 text-right`}
                      value={meta.porFase[l.fase.id] ?? ''} placeholder="—"
                      onChange={(e) => onSalvar({
                        ...meta,
                        porFase: e.target.value === ''
                          ? Object.fromEntries(Object.entries(meta.porFase).filter(([k]) => k !== l.fase.id))
                          : { ...meta.porFase, [l.fase.id]: Number(e.target.value) },
                      })}
                    />
                  ) : (
                    <span className="tabular-nums text-[#c9c9c9]">{l.previsto > 0 ? l.previsto.toLocaleString('pt-BR') : '—'}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-[#f5f5f5]">
                  {l.realizado > 0 ? l.realizado.toLocaleString('pt-BR') : '—'}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {/* Sem meta, o percentual é "—", não 0% — "0% de nada" leria como atraso. */}
                  {l.pct == null ? <span className="text-[#6b6b6b]">—</span> : (
                    <span className={cn('tabular-nums font-semibold', l.pct >= 100 ? 'text-[#4ade80]' : l.pct >= 60 ? 'text-[#fbbf24]' : 'text-[#fca5a5]')}>
                      {Math.round(l.pct)}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[#adadad]">
                  {l.previsto > 0
                    ? `${ritmoDiarioDaFase(l.previsto, resumo.dias).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${l.fase.unidade}`
                    : '—'}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {l.receita != null ? (
                    <span className="tabular-nums text-[#c9c9c9]">{formatCurrency(l.receita)}</span>
                  ) : (
                    <span className="text-[10px] text-[#fbbf24]" title={l.motivoSemReceita ? TEXTO_SEM_RECEITA[l.motivoSemReceita] : undefined}>
                      sem preço
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-[#525252] px-3 py-2 text-[10px] leading-4 text-[#6b6b6b]">
        O realizado vem dos RDO <b>finalizados</b> desta obra no período — rascunho não conta.
        A coluna "por dia" é a meta dividida pelos {resumo.dias} dias corridos do período.
      </p>
    </div>
  )
}

function Bloco({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#adadad]">{rotulo}</p>
      <p className="text-sm font-bold tabular-nums text-[#f5f5f5]">{valor}</p>
      {nota && <p className="text-[10px] text-[#fbbf24]">{nota}</p>}
    </div>
  )
}
