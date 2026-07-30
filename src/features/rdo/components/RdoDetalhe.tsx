/**
 * RdoDetalhe — visão READ-ONLY COMPLETA de um RDO no Histórico, para os dois
 * templates (padrão e Compizzo). Antes o corpo expandido do card só lia os campos
 * "regulares" e nunca `rdo.compizzo`, então um RDO Compizzo expandia praticamente
 * vazio; e mesmo no padrão faltavam progresso %/qualidade por serviço, origem/custo
 * dos materiais, nomes da mão de obra, coordenadas e o bloco de contrato. Aqui tudo
 * é mostrado, sem precisar "Editar". Fotos abrem no PhotoLightbox.
 */
import { useState } from 'react'
import {
  Users, Wrench, Package, ListChecks, Ruler, MapPin, FileText,
  AlertTriangle, Clock, ClipboardCheck, HardHat, CloudSun, Factory, FileSpreadsheet, Image as ImageIcon,
} from 'lucide-react'
import { RdoPhotoImg } from './RdoPhotoImg'
import { PhotoLightbox } from './PhotoLightbox'
import { Section, Meta, Field, Chip, Empty } from './detailPrimitives'
import { fmtDate, weatherIcon, weatherLabel, trechoStatusBadge } from './detailFormatters'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useRdoStore } from '@/store/rdoStore'
import { medidoAutoPorServico, calcServico } from '@/features/torre-de-controle/utils/obraMedicao'
import type { RDO } from '@/types'

// Controle de Medição (read-only) do contrato da obra deste RDO — medido auto dos RDOs finalizados.
function CompizzoMedicaoSection({ rdo }: { rdo: RDO }) {
  const site = useTorreStore((s) => s.sites).find((s) => s.id === rdo.siteId)
  const rdos = useRdoStore((s) => s.rdos)
  const services = site?.contrato?.services ?? []
  const medidoAuto = medidoAutoPorServico(rdos, rdo.siteId ?? null)
  if (!services.length) return null
  const n = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  const money = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const totMedido = services.reduce((a, s) => a + calcServico(s, medidoAuto).valorBruto, 0)
  return (
    <Section title="Controle de Medição" icon={<FileSpreadsheet size={15} className="text-[#f97316]" />}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-xs">
          <thead>
            <tr className="text-[#6b6b6b] text-[10px] uppercase tracking-wider">
              <th className="text-left pb-1 font-medium">Serviço</th>
              <th className="text-right pb-1 font-medium">Contratada</th>
              <th className="text-right pb-1 font-medium">Medido</th>
              <th className="text-right pb-1 font-medium">Saldo</th>
              <th className="text-right pb-1 font-medium">V. bruto</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const c = calcServico(s, medidoAuto)
              return (
                <tr key={s.id} className="border-t border-[#525252]">
                  <td className="py-1 pr-2 text-[#e5e5e5]">{s.descricao || '—'}</td>
                  <td className="py-1 text-right font-mono text-[#a3a3a3]">{n(s.qtdContrato)} {s.unidade}</td>
                  <td className="py-1 text-right font-mono text-[#f5f5f5]">{n(c.medido)}{s.qtdMedidaOverride != null ? ' *' : ''}</td>
                  <td className={`py-1 text-right font-mono font-semibold ${c.saldo < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>{n(c.saldo)}</td>
                  <td className="py-1 text-right font-mono text-[#f97316]">{money(c.valorBruto)}</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-[#525252] font-semibold">
              <td className="py-1 text-[#f5f5f5]" colSpan={4}>TOTAL medido (R$)</td>
              <td className="py-1 text-right font-mono text-[#f97316]">{money(totMedido)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[#6b6b6b] mt-1">Medido = Σ produções dos RDOs finalizados desta obra por serviço. "*" = ajuste manual (Torre).</p>
    </Section>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const brl = (n?: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
// Quantidades vêm como string ("1.200" milhar / "12,5" decimal): usar o MESMO parser
// canônico do resto do app (financeiroStore/RdoCompizzoPanel) p/ não contradizer o custo.

const SOURCE_LABEL: Record<string, string> = { almoxarifado: 'Almoxarifado', compra_direta: 'Compra direta', apoio: 'Apoio' }

function qualityBadge(q?: string) {
  if (q === 'approved') return <Chip tone="on">Qualidade: aprovado</Chip>
  if (q === 'rework')   return <Chip tone="warn">Qualidade: retrabalho</Chip>
  if (q === 'pending')  return <Chip>Qualidade: pendente</Chip>
  return null
}

const COMPIZZO_SERVICOS: Record<string, string> = {
  limpezaArea: 'Limpeza da área', isolamentoArea: 'Isolamento da área', preparacaoPiso: 'Preparação do piso',
  tintaVermelha: 'Tinta vermelha', tintaAmarela: 'Tinta amarela', faixaBranca: 'Faixa branca',
  faixaAmarela: 'Faixa amarela', faixaVermelha: 'Faixa vermelha', vagasPCD: 'Vagas PCD',
  retoques: 'Retoques', limpezaFinal: 'Limpeza final',
}
const COMPIZZO_OCORRENCIAS: Record<string, string> = {
  semOcorrencias: 'Sem ocorrências', chuva: 'Chuva', areaNaoLiberada: 'Área não liberada',
  interferenciaTerceiros: 'Interferência de terceiros', faltaEnergia: 'Falta de energia',
  equipamentoDefeito: 'Equipamento com defeito', outros: 'Outros',
}
const CLIMA_LABEL: Record<string, string> = { sol: 'Sol', nublado: 'Nublado', chuva: 'Chuva', outros: 'Outros' }

// ─── Componente ─────────────────────────────────────────────────────────────

export function RdoDetalhe({ rdo }: { rdo: RDO }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const isCompizzo = rdo.template === 'compizzo' && !!rdo.compizzo
  const cz = rdo.compizzo

  // Identificação/contrato (campos do RDO padrão)
  const contrato = [
    rdo.local, rdo.gerenteContrato, rdo.tecnicoSeguranca, rdo.nomeEmpreiteira,
    rdo.numeroOS, rdo.numeroContrato, rdo.servicoExecutar,
  ].some((v) => (v ?? '').toString().trim() !== '')

  const employeeNames = rdo.manpower.employeeNames ?? []

  return (
    <div className="space-y-4">

      {/* ── Cabeçalho / identificação ─────────────────────────────────────── */}
      <Section title="Identificação" icon={<FileText size={15} className="text-[#f97316]" />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <Meta label="RDO" value={`#${rdo.number}`} />
          <Meta label="Data" value={fmtDate(rdo.date)} />
          <Meta label="Responsável" value={rdo.responsible || '—'} />
          <Meta label="Template" value={isCompizzo ? 'Compizzo' : 'Padrão'} />
          {rdo.local && <Meta label="Local" value={rdo.local} />}
          {rdo.nomeEmpreiteira && <Meta label="Empreiteira" value={rdo.nomeEmpreiteira} />}
          {rdo.gerenteContrato && <Meta label="Gerente do contrato" value={rdo.gerenteContrato} />}
          {rdo.tecnicoSeguranca && <Meta label="Téc. de segurança" value={rdo.tecnicoSeguranca} />}
          {rdo.numeroContrato && <Meta label="Nº contrato" value={rdo.numeroContrato} />}
          {rdo.numeroOS && <Meta label="Nº OS" value={rdo.numeroOS} />}
          {rdo.servicoExecutar && <Meta label="Serviço a executar" value={rdo.servicoExecutar} />}
          {typeof rdo.funcionariosDiretos === 'number' && <Meta label="Func. diretos" value={String(rdo.funcionariosDiretos)} />}
          {typeof rdo.funcionariosIndiretos === 'number' && <Meta label="Func. indiretos" value={String(rdo.funcionariosIndiretos)} />}
          {typeof rdo.qtdEquipamentosFerramentas === 'number' && <Meta label="Equip./ferram." value={String(rdo.qtdEquipamentosFerramentas)} />}
          {typeof rdo.epiUtilizado === 'boolean' && <Meta label="EPI utilizado" value={rdo.epiUtilizado ? 'Sim' : 'Não'} />}
        </div>
        {!contrato && !isCompizzo && <p className="mt-2 text-[11px] text-[#6b6b6b] italic">Sem bloco de contrato preenchido.</p>}
      </Section>

      {/* ── Clima ─────────────────────────────────────────────────────────── */}
      <Section title="Condições Climáticas" icon={<CloudSun size={15} className="text-[#f97316]" />}>
        <div className="flex gap-5 text-sm text-[#f5f5f5] flex-wrap">
          {(['morning', 'afternoon', 'night'] as const).map((p) => {
            const labels = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' }
            return (
              <div key={p} className="flex items-center gap-1.5">
                {weatherIcon(rdo.weather[p])}
                <span className="text-[#6b6b6b]">{labels[p]}:</span>
                <span>{weatherLabel(rdo.weather[p])}</span>
              </div>
            )
          })}
          <span className="text-[#a3a3a3]">{rdo.weather.temperatureC}°C</span>
          {isCompizzo && cz?.condicaoClimatica && (
            <span className="text-[#a3a3a3]">
              · {CLIMA_LABEL[cz.condicaoClimatica] ?? cz.condicaoClimatica}
              {cz.condicaoClimatica === 'outros' && cz.condicaoClimaticaOutros ? ` (${cz.condicaoClimaticaOutros})` : ''}
            </span>
          )}
        </div>
      </Section>

      {/* ── Mão de obra (comum) ───────────────────────────────────────────── */}
      <Section title="Mão de Obra" icon={<Users size={15} className="text-[#f97316]" />}>
        <div className="flex gap-5 text-sm text-[#f5f5f5] flex-wrap">
          <span>Encarregados: <strong>{rdo.manpower.foremanCount}</strong></span>
          <span>Oficiais: <strong>{rdo.manpower.officialCount}</strong></span>
          <span>Ajudantes: <strong>{rdo.manpower.helperCount}</strong></span>
          <span>Operadores: <strong>{rdo.manpower.operatorCount}</strong></span>
        </div>
        {employeeNames.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-[#6b6b6b] mb-1.5">Funcionários presentes ({employeeNames.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {employeeNames.map((n, i) => <Chip key={`${n}-${i}`}>{n}</Chip>)}
            </div>
          </div>
        )}
        {(rdo.workforceRows?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-1">
            {rdo.workforceRows?.map((row) => (
              <div key={row.id} className="text-xs text-[#a3a3a3]">
                <span className="text-[#e5e5e5]">{row.role}</span>: {row.direct} direto(s), {row.outsourced} terceirizado(s)
                {(row.workerIds?.length ?? 0) > 0 && ` · ${row.workerIds?.length} vinculado(s)`}
                {row.hoursWorked ? ` · ${row.hoursWorked}h` : ''}
                {row.activityDescription ? ` · ${row.activityDescription}` : ''}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ══════════════════ Corpo específico do template ══════════════════ */}
      {isCompizzo && cz ? (
        <>
          {/* Contrato / preço (snapshot do Plano de Execução) */}
          <Section title="Contrato & Preço (snapshot)" icon={<FileText size={15} className="text-[#f97316]" />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {cz.numeroContrato && <Meta label="Nº contrato" value={cz.numeroContrato} />}
              {cz.servicoContratado && <Meta label="Serviço contratado" value={cz.servicoContratado} />}
              {typeof cz.precoM2 === 'number' && <Meta label="Preço/m²" value={brl(cz.precoM2)} />}
              {typeof cz.bacOrcamentoBRL === 'number' && <Meta label="Faturamento previsto (BAC)" value={brl(cz.bacOrcamentoBRL)} />}
              {cz.diaObra && <Meta label="Dia da obra" value={cz.diaObra} />}
              {(cz.periodoInicio || cz.periodoFim) && <Meta label="Período" value={`${fmtDate(cz.periodoInicio)} — ${fmtDate(cz.periodoFim)}`} />}
            </div>
          </Section>

          {/* Serviços do dia (checklist + extras + descrição) */}
          <Section title="Serviços Executados no Dia" icon={<ListChecks size={15} className="text-[#f97316]" />}>
            {(() => {
              const marcados = Object.entries(cz.servicos ?? {}).filter(([, v]) => v).map(([k]) => COMPIZZO_SERVICOS[k] ?? k)
              return marcados.length > 0
                ? <div className="flex flex-wrap gap-1.5">{marcados.map((s) => <Chip key={s} tone="on">{s}</Chip>)}</div>
                : <Empty>Nenhum serviço do checklist marcado.</Empty>
            })()}
            {(cz.servicosExtra?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-1">
                {cz.servicosExtra?.map((s, i) => (
                  <div key={`${s.nome}-${i}`} className="flex items-center gap-3 text-sm text-[#f5f5f5]">
                    <span className="flex-1">{s.nome}</span>
                    <span className="text-[#6b6b6b]">{s.quantidade || ''} {s.unidade || ''}</span>
                  </div>
                ))}
              </div>
            )}
            {cz.descricaoServicos?.trim() && <p className="mt-2 text-sm text-[#a3a3a3] whitespace-pre-wrap">{cz.descricaoServicos}</p>}
          </Section>

          {/* Produção + RUP */}
          {(() => {
            const linhas = (cz.producao ?? []).filter((p) => (p.quantidade ?? '').trim() !== '' || (p.servico ?? '').trim() !== '')
            const totalM2 = linhas.reduce((s, p) => s + parseLocaleNumber(p.quantidade), 0)
            const horas = cz.horasTrabalhadas ?? 0
            const rup = totalM2 > 0 && horas > 0 ? horas / totalM2 : null
            return (
              <Section
                title="Produção do Dia"
                icon={<Factory size={15} className="text-[#f97316]" />}
                right={<span className="text-xs text-[#a3a3a3]">{horas > 0 ? `${horas} HH` : ''}{rup != null ? ` · RUP ${rup.toFixed(2)} HH/m²` : ''}</span>}
              >
                {linhas.length > 0 ? (
                  <div className="space-y-1">
                    {linhas.map((p, i) => (
                      <div key={`${p.servico}-${i}`} className="flex items-center gap-3 text-sm text-[#f5f5f5]">
                        <span className="flex-1">{p.servico || '—'}{p.planningActivityId && <span className="ml-2 text-[10px] text-[#6b6b6b]">→ planej.</span>}</span>
                        <span className="text-[#6b6b6b]">
                          {p.quantidade || '0'} {p.unidade || 'm²'}
                          {typeof p.quantidadePrevista === 'number' ? ` / ${p.quantidadePrevista} prev.` : ''}
                        </span>
                      </div>
                    ))}
                    {totalM2 > 0 && (
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-[#525252] text-sm">
                        <span className="text-[#a3a3a3]">Total</span>
                        <span className="text-[#f97316] font-semibold">{totalM2.toLocaleString('pt-BR')} m²</span>
                      </div>
                    )}
                  </div>
                ) : <Empty>Sem itens de produção.</Empty>}
              </Section>
            )
          })()}

          <CompizzoMedicaoSection rdo={rdo} />

          {/* Materiais Compizzo */}
          <Section title="Materiais Utilizados" icon={<Package size={15} className="text-[#f97316]" />}>
            {(cz.materiais ?? []).filter((m) => (m.material ?? '').trim() !== '' || (m.quantidade ?? '').trim() !== '').length > 0 ? (
              <div className="space-y-1">
                {cz.materiais.map((m, i) => (
                  <div key={`${m.material}-${i}`} className="flex items-center gap-3 text-sm text-[#f5f5f5]">
                    <span className="flex-1">
                      {m.material || '—'}
                      {m.stockItemId && <span className="ml-2"><Chip tone="on">↓ estoque</Chip></span>}
                    </span>
                    <span className="text-[#6b6b6b]">{m.quantidade || '0'}</span>
                    {typeof m.custoUnitario === 'number' && m.custoUnitario > 0 && (
                      <span className="text-[#f97316]">{brl(parseLocaleNumber(m.quantidade) * m.custoUnitario)}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : <Empty>Sem materiais lançados.</Empty>}
          </Section>

          {/* Ocorrências Compizzo */}
          <Section title="Ocorrências" icon={<AlertTriangle size={15} className="text-[#f97316]" />}>
            {(() => {
              const flags = Object.entries(cz.ocorrencias ?? {}).filter(([, v]) => v).map(([k]) => ({ k, label: COMPIZZO_OCORRENCIAS[k] ?? k }))
              return flags.length > 0
                ? <div className="flex flex-wrap gap-1.5">{flags.map((f) => <Chip key={f.k} tone={f.k === 'semOcorrencias' ? 'on' : 'warn'}>{f.label}</Chip>)}</div>
                : <Empty>Nenhuma ocorrência marcada.</Empty>
            })()}
          </Section>

          {/* Observações + próximo dia + responsável */}
          {(cz.observacoes?.trim() || cz.planejamentoProximoDia?.trim() || cz.responsavelNome?.trim()) && (
            <Section title="Observações & Planejamento" icon={<HardHat size={15} className="text-[#f97316]" />}>
              {cz.observacoes?.trim() && <Field label="Observações" value={<span className="whitespace-pre-wrap">{cz.observacoes}</span>} />}
              {cz.planejamentoProximoDia?.trim() && <div className="mt-2"><Field label="Planejamento do próximo dia" value={<span className="whitespace-pre-wrap">{cz.planejamentoProximoDia}</span>} /></div>}
              {(cz.responsavelNome?.trim() || cz.responsavelData?.trim()) && (
                <div className="mt-2"><Field label="Responsável" value={`${cz.responsavelNome || '—'}${cz.responsavelData ? ` · ${cz.responsavelData}` : ''}`} /></div>
              )}
            </Section>
          )}
        </>
      ) : (
        <>
          {/* Equipamentos */}
          {rdo.equipment.length > 0 && (
            <Section title="Equipamentos" icon={<Wrench size={15} className="text-[#f97316]" />}>
              <div className="space-y-1">
                {rdo.equipment.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 text-sm text-[#f5f5f5]">
                    <span className="flex-1">
                      {e.name}
                      {(e.code || e.operator || e.front) && (
                        <span className="ml-2 text-[11px] text-[#6b6b6b]">
                          {[e.code, e.operator && `op. ${e.operator}`, e.front].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="text-[#6b6b6b]">{e.quantity}× · {e.hours}h</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Materiais */}
          {(rdo.materials?.length ?? 0) > 0 && (
            <Section title="Materiais e Insumos" icon={<Package size={15} className="text-[#f97316]" />}>
              <div className="space-y-1.5">
                {rdo.materials?.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 text-sm text-[#f5f5f5]">
                    <span className="flex-1">
                      {m.material}
                      <span className="ml-2 inline-flex gap-1.5 align-middle">
                        {m.source && <Chip>{SOURCE_LABEL[m.source] ?? m.source}</Chip>}
                        {m.stockItemId && <Chip tone="on">↓ estoque</Chip>}
                      </span>
                    </span>
                    <span className="text-[#6b6b6b] shrink-0">{m.quantity} {m.unit || ''}</span>
                    {typeof m.unitCostBRL === 'number' && m.unitCostBRL > 0 && (
                      <span className="text-[#6b6b6b] shrink-0 text-[11px]">{brl(m.unitCostBRL)}/un</span>
                    )}
                    <span className="text-[#f97316] shrink-0">{brl(m.totalCostBRL ?? ((Number(m.quantity) || 0) * (m.unitCostBRL ?? 0)))}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Serviços */}
          {rdo.services.length > 0 && (
            <Section title="Serviços Executados" icon={<ListChecks size={15} className="text-[#f97316]" />}>
              <div className="space-y-1.5">
                {rdo.services.map((s) => (
                  <div key={s.id} className="flex items-start gap-3 text-sm text-[#f5f5f5]">
                    <div className="flex-1 min-w-0">
                      <span>{s.description}</span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {(s.planningActivityId || s.operationalKey) && <Chip>→ planej.</Chip>}
                        {s.contractItemCode && <Chip>item {s.contractItemCode}</Chip>}
                        {qualityBadge(s.qualityStatus)}
                        {(typeof s.dailyProgressPct === 'number' || typeof s.accumulatedProgressPct === 'number') && (
                          <span className="text-[11px] text-[#6b6b6b]">
                            {typeof s.dailyProgressPct === 'number' ? `dia ${s.dailyProgressPct}%` : ''}
                            {typeof s.accumulatedProgressPct === 'number' ? `${typeof s.dailyProgressPct === 'number' ? ' · ' : ''}acum ${s.accumulatedProgressPct}%` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[#6b6b6b] shrink-0">{s.quantity} {s.unit}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Trechos */}
          {rdo.trechos.length > 0 && (
            <Section title="Avanço por Trecho" icon={<Ruler size={15} className="text-[#f97316]" />}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#6b6b6b] text-xs">
                      <th className="text-left pb-2 font-medium">Código</th>
                      <th className="text-left pb-2 font-medium">Descrição</th>
                      <th className="text-right pb-2 font-medium">Planejado</th>
                      <th className="text-right pb-2 font-medium">Executado</th>
                      <th className="text-right pb-2 font-medium">%</th>
                      <th className="text-center pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdo.trechos.map((t) => {
                      const pct = t.plannedMeters > 0 ? (t.executedMeters / t.plannedMeters) * 100 : 0
                      return (
                        <tr key={t.id} className="border-t border-[#525252]">
                          <td className="py-1.5 pr-3 text-[#f5f5f5] font-mono text-xs">{t.trechoCode}</td>
                          <td className="py-1.5 pr-3 text-[#a3a3a3]">{t.trechoDescription}</td>
                          <td className="py-1.5 pr-3 text-right text-[#f5f5f5]">{t.plannedMeters.toFixed(1)} m</td>
                          <td className="py-1.5 pr-3 text-right text-[#f5f5f5]">{t.executedMeters.toFixed(1)} m</td>
                          <td className="py-1.5 pr-3 text-right text-[#f5f5f5]">{pct.toFixed(1)}%</td>
                          <td className="py-1.5 text-center">{trechoStatusBadge(t.status)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Qualidade / paradas / horário */}
          {(rdo.qualityChecklist || (rdo.stoppages?.length ?? 0) > 0 || rdo.activityHours) && (
            <Section title="Qualidade, Paradas & Jornada" icon={<ClipboardCheck size={15} className="text-[#f97316]" />}>
              {rdo.qualityChecklist && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Chip tone={rdo.qualityChecklist.ordemServico ? 'on' : 'neutral'}>Ordem de serviço</Chip>
                  <Chip tone={rdo.qualityChecklist.bandeirola ? 'on' : 'neutral'}>Bandeirola</Chip>
                  <Chip tone={rdo.qualityChecklist.projeto ? 'on' : 'neutral'}>Projeto</Chip>
                  {rdo.qualityChecklist.obs && <span className="text-[11px] text-[#a3a3a3] self-center">· {rdo.qualityChecklist.obs}</span>}
                </div>
              )}
              {(rdo.stoppages?.length ?? 0) > 0 && (
                <div className="space-y-1 mb-2">
                  {rdo.stoppages?.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                      <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                      <span className="text-[#e5e5e5]">{s.reason}</span>
                      <span className="text-[#6b6b6b]">({s.period} · {s.start}–{s.end})</span>
                    </div>
                  ))}
                </div>
              )}
              {rdo.activityHours && (
                <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                  <Clock size={12} className="shrink-0" />
                  {[
                    rdo.activityHours.dayStart && `Dia ${rdo.activityHours.dayStart}–${rdo.activityHours.dayEnd ?? ''}`,
                    rdo.activityHours.nightStart && `Noite ${rdo.activityHours.nightStart}–${rdo.activityHours.nightEnd ?? ''}`,
                  ].filter(Boolean).join(' · ') || 'Sem horário registrado'}
                </div>
              )}
            </Section>
          )}

          {/* Observações / ocorrências */}
          {(rdo.observations || rdo.incidents || rdo.ocorrencias) && (
            <Section title="Observações & Ocorrências" icon={<FileText size={15} className="text-[#f97316]" />}>
              {rdo.observations && <Field label="Observações" value={<span className="whitespace-pre-wrap">{rdo.observations}</span>} />}
              {rdo.incidents && <div className="mt-2"><Field label="Ocorrências" value={<span className="whitespace-pre-wrap">{rdo.incidents}</span>} /></div>}
              {rdo.ocorrencias && rdo.ocorrencias !== rdo.incidents && <div className="mt-2"><Field label="Ocorrências (contrato)" value={<span className="whitespace-pre-wrap">{rdo.ocorrencias}</span>} /></div>}
            </Section>
          )}
        </>
      )}

      {/* ── Geolocalização (comum) ────────────────────────────────────────── */}
      {rdo.geolocation && (
        <Section title="Geolocalização" icon={<MapPin size={15} className="text-[#f97316]" />}>
          <p className="text-sm text-[#e5e5e5] font-mono">{rdo.geolocation.lat}, {rdo.geolocation.lng}</p>
        </Section>
      )}

      {/* ── Fotos (comum) — clique amplia ─────────────────────────────────── */}
      {rdo.photos.length > 0 && (
        <Section title={`Registro Fotográfico (${rdo.photos.length})`} icon={<ImageIcon size={15} className="text-[#f97316]" />}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {rdo.photos.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setLightbox(i)} className="group text-left" title="Ampliar">
                <RdoPhotoImg photo={p} className="w-full h-28 object-cover rounded-lg border border-[#525252] group-hover:border-[#f97316] transition-colors" />
                {p.label && <p className="text-xs text-[#6b6b6b] mt-1 text-center truncate">{p.label}</p>}
              </button>
            ))}
          </div>
        </Section>
      )}

      {lightbox !== null && (
        <PhotoLightbox photos={rdo.photos} index={lightbox} onClose={() => setLightbox(null)} onIndexChange={setLightbox} />
      )}
    </div>
  )
}
