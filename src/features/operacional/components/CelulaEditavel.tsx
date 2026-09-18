/**
 * Uma célula da grade — com o controle que a PLANILHA declara para aquela coluna.
 *
 * ⚠️ É aqui que "opções de escolha selecionáveis" deixa de ser texto numa lista e vira interação:
 * onde a planilha tem lista suspensa, a célula é um `select` com as mesmas opções; onde tem regra
 * de data, um date picker com o mesmo mínimo e máximo; onde tem regra de número, um campo numérico.
 * As regras saem de `leitorPlanilha.lerValidacoes` — não são redigitadas aqui.
 */
import { useState } from 'react'
import type { RegraDeCampo } from '../leitorPlanilha'

const BASE = 'w-full bg-transparent px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:bg-[#1f1f1f] focus:ring-1 focus:ring-[#f97316]/60 rounded'

export function CelulaEditavel({ valor, regra, somenteLeitura, onGravar, onColarBloco }: {
  valor: string
  regra?: RegraDeCampo
  somenteLeitura: boolean
  onGravar: (novo: string) => void
  onColarBloco?: (texto: string) => void
}) {
  const [rascunho, setRascunho] = useState<string | null>(null)
  const atual = rascunho ?? valor

  if (somenteLeitura) {
    return <span className="block min-w-24 whitespace-normal break-words px-2 py-1 text-xs leading-5 text-[#d4d4d4]" title={valor}>{valor || '—'}</span>
  }

  const confirmar = (v: string) => { setRascunho(null); if (v !== valor) onGravar(v) }

  /**
   * O valor para o PAPEL.
   *
   * ⚠️ Na impressão o CSS esconde `input` e `select` (controle não é documento) — e, sem isto, a
   * célula editável sairia VAZIA no PDF. O usuário imprimiria uma planilha de colunas em branco.
   * Fica oculto na tela (`hidden`) e visível só no `@media print`.
   */
  const paraImpressao = <span className="celula-valor hidden">{valor}</span>

  if (regra?.tipo === 'lista' && regra.opcoes?.length) {
    return (
      <>
      {paraImpressao}
      <select
        value={valor} onChange={(e) => confirmar(e.target.value)}
        title={regra.mensagem} aria-label="Valor da célula"
        className={`${BASE} cursor-pointer`}
        onPaste={(e) => { if (onColarBloco && /[\t\n]/.test(e.clipboardData.getData('text'))) { e.preventDefault(); onColarBloco(e.clipboardData.getData('text')) } }}
      >
        {/* A opção vazia só existe quando a planilha permite branco — `allowBlank`. */}
        {!regra.obrigatorio && <option value="">—</option>}
        {/* Valor fora da lista continua visível: a planilha do cliente tem células assim, e
            escondê-las faria o dado sumir da tela sem ninguém decidir isso. */}
        {!regra.opcoes.includes(valor) && valor && <option value={valor}>{valor} (fora da lista)</option>}
        {regra.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      </>
    )
  }

  const tipo = regra?.tipo === 'data' ? 'date' : regra?.tipo === 'numero' ? 'number' : 'text'
  return (
    <>
    {paraImpressao}
    <input
      type={tipo} value={atual} title={regra?.mensagem} aria-label="Valor da célula"
      min={regra?.min} max={regra?.max}
      onChange={(e) => setRascunho(e.target.value)}
      onPaste={(e) => { if (onColarBloco && /[\t\n]/.test(e.clipboardData.getData('text'))) { e.preventDefault(); onColarBloco(e.clipboardData.getData('text')) } }}
      onBlur={() => confirmar(atual)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setRascunho(null); e.currentTarget.blur() }
      }}
      className={BASE}
    />
    </>
  )
}
