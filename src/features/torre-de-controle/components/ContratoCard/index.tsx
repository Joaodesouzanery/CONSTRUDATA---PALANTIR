/**
 * CONTRATO — um card só, com quatro abas.
 *
 * ─── O QUE ISTO SUBSTITUI ─────────────────────────────────────────────────────
 * Havia três blocos soltos no painel da obra que, como o cliente notou, são o mesmo objeto em
 * três níveis:
 *
 *   "Orçamento"              → o teto: quanto a obra vale
 *   "Serviços do Contrato"   → a composição: como o teto foi formado
 *   "Contrato & Medição"     → o realizado: o que já virou nota
 *
 * Agora são abas de um card: Resumo · Composição · Medições · Documentos, com os números que
 * importam fixos no topo.
 *
 * ─── A REGRA QUE EVITA CONTAR DINHEIRO DUAS VEZES ─────────────────────────────
 * O valor no cabeçalho é o DECLARADO; a linha da composição é o mesmo dinheiro visto por dentro.
 * Eles nunca somam — um confere o outro, e **por categoria**:
 *
 *   valorServico  ⟷  Σ mão de obra das linhas   → selo Δ
 *   valorMaterial ⟷  Σ material das linhas      → selo Δ
 *
 * Até 24/08/2026 a conferência comparava o serviço contra a soma de TUDO, e o contrato da SUPERA
 * acusava uma divergência de R$ 607.643,54 que não existia — era o material caindo no lado errado.
 */
import { useState } from 'react'
import { FileSpreadsheet, LayoutList, Receipt, Paperclip, Wallet } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useRdoStore } from '@/store/rdoStore'
import { hojeLocalISO } from '@/lib/utils'
import {
  medidoAutoPorServico, valoresDoContrato, resumoFaturamento, subtotaisComposicao,
} from '@/features/torre-de-controle/utils/obraMedicao'
import {
  titulosDoFaturamento, titulosObsoletos, lancamentosDuplicados, type LancamentoSuspeito,
} from '@/features/torre-de-controle/utils/faturamentoParaFinanceiro'
import { useFinanceiroTitulosStore } from '@/store/financeiroTitulosStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { fmtDataBR } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import type { ConstructionSite, ObraContrato } from '@/types'
import { TXT, brl, pct } from './formato'
import { Kpi } from './ui'
import { AbaResumo } from './AbaResumo'
import { AbaComposicao } from './AbaComposicao'
import { AbaMedicoes } from './AbaMedicoes'
import { AbaDocumentos } from './AbaDocumentos'

type Aba = 'resumo' | 'composicao' | 'medicoes' | 'documentos'

const ABAS: { key: Aba; label: string; icon: typeof Wallet }[] = [
  { key: 'resumo',     label: 'Resumo',     icon: Wallet },
  { key: 'composicao', label: 'Composição', icon: LayoutList },
  { key: 'medicoes',   label: 'Medições',   icon: Receipt },
  { key: 'documentos', label: 'Documentos', icon: Paperclip },
]

export function ContratoCard({ site }: { site: ConstructionSite }) {
  const updateSite = useTorreStore((s) => s.updateSite)
  const rdos = useRdoStore((s) => s.rdos)
  const [aba, setAba] = useState<Aba>('resumo')
  const [duplicados, setDuplicados] = useState<LancamentoSuspeito[]>([])

  const contrato: ObraContrato = site.contrato ?? { services: [] }
  const hoje = hojeLocalISO()
  const medidoAuto = medidoAutoPorServico(rdos, site.id)
  const valores = valoresDoContrato(contrato)
  const fat = resumoFaturamento(contrato, hoje)
  const sub = subtotaisComposicao(contrato.services ?? [])

  /**
   * Salva o contrato e acerta o Financeiro no mesmo passo.
   *
   * A nota é lançada uma vez só, aqui. O que está "a receber" vira título com a obra e a data;
   * o que deixou de existir tem a cobrança removida. Os ids são determinísticos (obra + nota),
   * então salvar de novo ATUALIZA em vez de criar uma segunda cobrança.
   */
  function salvar(patch: Partial<ObraContrato>) {
    const novo: ObraContrato = { ...contrato, ...patch }
    updateSite(site.id, { contrato: novo })

    const comNovo = { ...site, contrato: novo }
    const fin = useFinanceiroTitulosStore.getState()
    const obsoletos = titulosObsoletos(comNovo, fin.titulos)
    if (obsoletos.length) fin.removeTitulos(obsoletos)
    const titulos = titulosDoFaturamento(comNovo)
    if (titulos.length) fin.upsertTitulos(titulos)

    // Trava contra receita dobrada: até agora a nota recebida fazia o título sumir, e o extrato
    // nunca virava receita. Agora vira — então o que já foi lançado à mão em Entradas/Saídas
    // passaria a estar contado duas vezes. Aqui só AVISAMOS; nada é apagado sem a pessoa decidir.
    setDuplicados(lancamentosDuplicados(comNovo, useFinanceiroStore.getState().entries ?? []))
  }

  const executado = valores.servico > 0 ? Math.min(100, (fat.faturado / valores.servico) * 100) : 0

  return (
    <div className="flex flex-col gap-3 border-b border-[#525252] px-4 py-3">
      {/* ── Cabeçalho: identificação + os números que importam ── */}
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={14} className="text-[#f97316]" />
        <h4 className={`text-xs font-bold uppercase tracking-wide ${TXT.forte}`}>
          Contrato{contrato.numeroContrato ? ` nº ${contrato.numeroContrato}` : ''}
        </h4>
      </div>

      {valores.total > 0 || fat.faturado > 0 ? (
        <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2.5">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Kpi
              rotulo="Contratado" valor={brl(valores.total)}
              detalhe={valores.material > 0
                ? <>serviço {brl(valores.servico)} · material {brl(valores.material)}</>
                : undefined}
            />
            <Kpi rotulo="Faturado" valor={brl(fat.faturado)} cor="#f59e0b"
                 detalhe={fat.aReceber > 0 ? <>{brl(fat.aReceber)} a receber</> : undefined} />
            <Kpi rotulo="Saldo do serviço" valor={brl(fat.saldo)} cor={fat.saldo < 0 ? '#f87171' : '#4ade80'}
                 detalhe="o material é faturado à parte" />
            {fat.retencao > 0 && (
              <Kpi rotulo="Retenção a liberar" valor={brl(fat.retencao)} cor="#93c5fd"
                   detalhe="garantia retida pelo cliente" />
            )}
            <Kpi rotulo="Execução" valor={pct(executado)} />
          </div>
          {/* Barra de execução: faturado sobre o valor de serviço. */}
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#484848]">
            <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${executado}%` }} />
          </div>
        </div>
      ) : (
        <p className={`text-[11px] ${TXT.fraco}`}>
          Contrato ainda não cadastrado. Comece pelo <b>Resumo</b>, lançando os valores de serviço e material.
        </p>
      )}

      {duplicados.length > 0 && (
        <div className="rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#fbbf24]">
            <AlertTriangle size={12} /> Este dinheiro pode estar contado duas vezes
          </p>
          <p className={`mt-1 text-[11px] ${TXT.normal}`}>
            A nota recebida agora vira receita pelo contrato. Encontrei lançamento(s) parecido(s) já
            digitado(s) em Entradas/Saídas — se forem o mesmo dinheiro, apague o lançamento manual
            no Financeiro para não somar duas vezes.
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {duplicados.map((d, i) => (
              <li key={i} className={`text-[11px] ${TXT.normal}`}>
                <b>{brl(d.nota.valor)}</b> — nota “{d.nota.descricao || d.nota.nf || 'sem descrição'}”
                {' de '}{fmtDataBR((d.nota.dataRecebimento || d.nota.data).slice(0, 10))}
                {' · lançamento manual “'}{d.entry.descricao}{'” de '}{fmtDataBR(d.entry.data.slice(0, 10))}
                {d.dias > 0 && ` (${d.dias} dia${d.dias > 1 ? 's' : ''} de diferença)`}
              </li>
            ))}
          </ul>
          <button onClick={() => setDuplicados([])}
                  className="mt-1.5 rounded bg-[#eab308]/25 px-2 py-0.5 text-[11px] font-semibold text-[#fde047] hover:bg-[#eab308]/40">
            Já conferi, são diferentes
          </button>
        </div>
      )}

      {/* ── Abas ── */}
      <div className="flex gap-1 border-b border-[#525252]">
        {ABAS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setAba(key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              aba === key
                ? 'border-[#f97316] text-[#f97316]'
                : 'border-transparent text-[#a3a3a3] hover:text-[#f5f5f5]'
            }`}>
            <Icon size={12} /> {label}
            {key === 'composicao' && (contrato.services?.length ?? 0) > 0 && (
              <span className="rounded bg-[#484848] px-1 text-[11px] text-[#d4d4d4]">{contrato.services.length}</span>
            )}
            {key === 'medicoes' && (contrato.faturamentos?.length ?? 0) > 0 && (
              <span className="rounded bg-[#484848] px-1 text-[11px] text-[#d4d4d4]">{contrato.faturamentos!.length}</span>
            )}
            {key === 'documentos' && (contrato.documentos?.length ?? 0) > 0 && (
              <span className="rounded bg-[#484848] px-1 text-[11px] text-[#d4d4d4]">{contrato.documentos!.length}</span>
            )}
          </button>
        ))}
      </div>

      {aba === 'resumo'     && <AbaResumo contrato={contrato} valores={valores} subtotais={sub} salvar={salvar} />}
      {aba === 'composicao' && <AbaComposicao contrato={contrato} medidoAuto={medidoAuto} salvar={salvar} />}
      {aba === 'medicoes'   && <AbaMedicoes contrato={contrato} resumo={fat} hoje={hoje} salvar={salvar} />}
      {aba === 'documentos' && <AbaDocumentos contrato={contrato} salvar={salvar} />}
    </div>
  )
}
