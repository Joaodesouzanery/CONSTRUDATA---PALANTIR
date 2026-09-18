/**
 * O que mudou nesta linha, quem mudou e quando.
 *
 * ⚠️ O histórico já era gravado e já subia para `operacional_historico` — e **nenhuma tela o
 * mostrava**. Guardar auditoria que ninguém consegue ler é o mesmo que não guardar: quando a
 * planilha sobrescreve uma edição, a pergunta "quem tinha mudado isso, e para quê?" não tinha
 * resposta alcançável.
 */
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { History, X } from 'lucide-react'
import { useSabespStore } from '../sabespStore'

const ROTULO: Record<string, string> = {
  editar: 'editou', criar: 'criou', duplicar: 'duplicou',
  arquivar: 'arquivou', restaurar: 'restaurou', importar: 'importou',
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export function HistoricoDaLinha({ linhaId, onFechar }: { linhaId: string; onFechar: () => void }) {
  const historico = useSabespStore(useShallow((s) => s.historico.filter((h) => h.linhaId === linhaId)))
  const linha = useSabespStore((s) => s.linhas.find((l) => l.id === linhaId))

  /** Só os campos que de fato MUDARAM — listar a linha inteira esconde a alteração no meio dela. */
  const eventos = useMemo(() => historico.map((h) => {
    const campos: Array<{ campo: string; de: string; para: string }> = []
    const chaves = new Set([...Object.keys(h.antes ?? {}), ...Object.keys(h.depois ?? {})])
    for (const c of chaves) {
      const de = (h.antes?.[c] ?? '').trim()
      const para = (h.depois?.[c] ?? '').trim()
      if (de !== para) campos.push({ campo: c, de, para })
    }
    return { ...h, campos }
  }), [historico])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onFechar}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-[#525252] bg-[#2c2c2c]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#525252] px-5 py-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#f97316]" />
            <div>
              <h3 className="text-sm font-semibold text-[#f5f5f5]">Histórico da linha</h3>
              <p className="text-[11px] text-[#a3a3a3]">{linha?.chave ?? linhaId}</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-[#a3a3a3] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {eventos.length === 0 ? (
            <p className="rounded-lg border border-[#525252] bg-[#333] px-3 py-6 text-center text-xs text-[#a3a3a3]">
              Esta linha não foi alterada no sistema — está como veio da planilha.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {eventos.map((e) => (
                <li key={e.id} className="rounded-lg border border-[#525252] bg-[#333] p-3">
                  <p className="text-[11px] text-[#a3a3a3]">
                    <b className="text-[#f5f5f5]">{ROTULO[e.acao] ?? e.acao}</b> · {quando(e.criadoEm)}
                  </p>
                  {e.campos.length > 0 && (
                    <table className="mt-1.5 w-full text-[11px]">
                      <tbody>
                        {e.campos.map((c) => (
                          <tr key={c.campo}>
                            <td className="w-1/3 py-0.5 pr-2 text-[#a3a3a3]">{c.campo}</td>
                            <td className="py-0.5 text-[#fca5a5] line-through">{c.de || '—'}</td>
                            <td className="py-0.5 pl-2 text-[#4ade80]">{c.para || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              ))}
            </ol>
          )}
          {/* ⚠️ Honestidade sobre o alcance: o histórico é local até o `pull` passar a lê-lo. */}
          <p className="mt-3 text-[10px] leading-4 text-[#6b6b6b]">
            As alterações sobem para o servidor no momento em que acontecem. Esta lista mostra o que
            foi alterado <b>neste aparelho</b>; a trilha completa da empresa fica em
            {' '}<code className="text-[#8a8a8a]">operacional_historico</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
