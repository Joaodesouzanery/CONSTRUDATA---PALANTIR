/**
 * A visão executiva do Operacional — separada por contrato, sempre.
 *
 * ⚠️ Cada número sai de `indicadoresOperacionais.ts`, que é puro e testado. O painel anterior
 * calculava tudo aqui dentro, com o título da coluna casado na mão e `numero()` devolvendo 0 —
 * então uma coluna renomeada pela próxima revisão da planilha zerava o cartão em silêncio. Agora
 * o motor devolve `null` nesse caso e a tela escreve **"coluna não encontrada"**.
 *
 * ⚠️ E o consolidado nunca aparece sozinho. R$ 230.982,81/mês de custo em Bertioga e R$ 273.163,84
 * em Santos somam um número que não é a realidade de nenhuma das duas operações.
 */
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSabespStore, type LinhaOperacional, type SabespSheetId } from '../sabespStore'
import {
  calcularIndicadores, contratosDoDado, producaoPorEquipe, servicosPorStatus,
} from '../indicadoresOperacionais'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pct = (v: number) => `${v.toFixed(0)}%`
const int = (v: number) => v.toLocaleString('pt-BR')

export function PainelIndicadores() {
  const linhas = useSabespStore(useShallow((s) => s.linhas))
  const [contrato, setContrato] = useState('')
  const [aberto, setAberto] = useState(true)

  const porAba = useMemo(() => {
    const m: Partial<Record<SabespSheetId, LinhaOperacional[]>> = {}
    for (const l of linhas) (m[l.aba] ??= []).push(l)
    return m
  }, [linhas])

  const contratos = useMemo(() => contratosDoDado(linhas.filter((l) => l.ativa)), [linhas])
  const i = useMemo(() => calcularIndicadores(porAba, contrato), [porAba, contrato])
  const equipes = useMemo(
    () => producaoPorEquipe(porAba.cadastro_servicos ?? [], { contrato }).slice(0, 6),
    [porAba, contrato],
  )
  const status = useMemo(
    () => servicosPorStatus(porAba.cadastro_servicos ?? [], { contrato }).slice(0, 6),
    [porAba, contrato],
  )

  if (linhas.length === 0) return null

  return (
    <div className="border-b border-[#525252] bg-[#252525] px-6 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setAberto((v) => !v)} className="text-xs font-semibold text-[#f5f5f5]">
          Visão executiva <span className="font-normal text-[#a3a3a3]">— {i.contrato}</span>
        </button>
        <div className="flex flex-wrap items-center gap-1">
          {/* Os contratos vêm do DADO. A versão anterior tinha Bertioga/Santos fixos no código e
              comparava com `===`, então "BERTIOGA/GUARUJÁ" não casava com nada. */}
          <Pilula ativo={contrato === ''} onClick={() => setContrato('')}>Todos</Pilula>
          {contratos.map((c) => (
            <Pilula key={c} ativo={contrato === c} onClick={() => setContrato(c)}>{c}</Pilula>
          ))}
          <button type="button" onClick={() => setAberto((v) => !v)} className="ml-2 text-[11px] text-[#a3a3a3] hover:text-[#f5f5f5]">
            {aberto ? 'recolher' : 'expandir'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Cartao rotulo="Serviços" valor={i.servicos} formato={int} />
        <Cartao rotulo="Em aberto" valor={i.emAberto} formato={int} tom="#fbbf24" />
        <Cartao rotulo="Atrasados" valor={i.atrasados} formato={int} tom={i.atrasados ? '#f87171' : undefined} />
        <Cartao rotulo="Aderência" valor={i.aderencia} formato={pct} tom={i.aderencia != null && i.aderencia >= 80 ? '#4ade80' : '#fbbf24'} />
        <Cartao rotulo="Ocorrências abertas" valor={i.ocorrenciasAbertas} formato={int} tom={i.ocorrenciasAbertas ? '#f87171' : undefined} />
        <Cartao rotulo="Medição aprovada" valor={i.valorAprovado} formato={brl} tom="#60a5fa" />
      </div>

      {aberto && (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Cartao rotulo="Valor medido" valor={i.valorMedido} formato={brl} />
            <Cartao rotulo="Glosado" valor={i.valorGlosado} formato={brl} tom={i.valorGlosado ? '#f87171' : undefined} />
            <Cartao rotulo="Recebido" valor={i.valorRecebido} formato={brl} tom="#4ade80" />
            <Cartao rotulo="Custo do mês" valor={i.custoDoMes} formato={brl} />
            <Cartao rotulo="Resultado" valor={i.resultado} formato={brl} tom={i.resultado != null && i.resultado < 0 ? '#f87171' : '#4ade80'} />
            <Cartao rotulo="Margem" valor={i.margem} formato={pct} tom={i.margem != null && i.margem < 0 ? '#f87171' : undefined} />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Barras titulo="Serviços por status" itens={status.map((s) => ({ rotulo: s.status, n: s.n }))} />
            <Barras
              titulo="Produção por equipe"
              itens={equipes.map((e) => ({ rotulo: e.equipe, n: e.concluidos, de: e.total }))}
            />
          </div>
        </>
      )}
    </div>
  )
}

function Pilula({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn('rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
        ativo ? 'bg-[#f97316] text-white' : 'border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5]')}
    >{children}</button>
  )
}

/**
 * ⚠️ `null` NÃO é zero. Coluna ausente escreve "coluna não encontrada" — um indicador financeiro
 * mostrando R$ 0 afirma que não houve faturamento, e essa é uma afirmação que ninguém fez.
 */
function Cartao({ rotulo, valor, formato, tom }: {
  rotulo: string
  valor: number | null
  formato: (v: number) => string
  tom?: string
}) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[#8a8a8a]">{rotulo}</p>
      {valor === null ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] leading-tight text-[#8a8a8a]" title="A planilha importada não tem a coluna que alimenta este número.">
          <AlertTriangle size={11} className="shrink-0 text-[#fbbf24]" />
          coluna não encontrada
        </p>
      ) : (
        <p className="mt-1 text-lg font-semibold leading-tight" style={{ color: tom ?? '#f5f5f5' }}>{formato(valor)}</p>
      )}
    </div>
  )
}

function Barras({ titulo, itens }: { titulo: string; itens: Array<{ rotulo: string; n: number; de?: number }> }) {
  const maior = Math.max(1, ...itens.map((i) => i.de ?? i.n))
  if (itens.length === 0) return null
  return (
    <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
      <p className="mb-2 text-[11px] font-semibold text-[#a3a3a3]">{titulo}</p>
      <div className="flex flex-col gap-1.5">
        {itens.map((i) => (
          <div key={i.rotulo} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate text-[11px] text-[#d4d4d4]" title={i.rotulo}>{i.rotulo}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#3d3d3d]">
              <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${((i.de ?? i.n) / maior) * 100}%` }} />
              {i.de != null && (
                <div className="-mt-2 h-2 rounded-full bg-[#22c55e]" style={{ width: `${(i.n / maior) * 100}%` }} />
              )}
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-[#a3a3a3]">
              {i.de != null ? `${i.n}/${i.de}` : i.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
