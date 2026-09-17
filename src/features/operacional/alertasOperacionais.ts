/**
 * alertasOperacionais.ts — o que a planilha diz que está pendente.
 *
 * ─── O PEDIDO ─────────────────────────────────────────────────────────────────
 * "A planilha vai só trazer as informações, e gerar alertas e atividades desses dados."
 *
 * Então os alertas saem do DADO IMPORTADO, não de um cadastro paralelo. Cada regra aqui aponta
 * para uma coluna que existe na planilha do cliente — se a coluna não veio, a regra fica quieta em
 * vez de acusar todo mundo.
 *
 * ⚠️ Puro de propósito: é conta, e conta se testa. A versão anterior montava as regras dentro do
 * `useMemo` do painel, num `for` por aba, sem teste nenhum — e uma delas (`/RESTRI|NÃO|NAO/`)
 * casava com a palavra "NÃO" em QUALQUER situação, inclusive "NÃO HÁ RESTRIÇÃO", que é o oposto.
 */
import type { LinhaOperacional, SabespSheetId } from './sabespStore'

export type GravidadeDoAlerta = 'alta' | 'media'

export interface AlertaOperacional {
  id: string
  aba: SabespSheetId
  chave: string
  gravidade: GravidadeDoAlerta
  titulo: string
  /** A coluna que originou o alerta — para quem confere saber onde olhar na planilha. */
  origem: string
}

/** Lê um campo tolerando variações de acento e caixa no título da coluna. */
function campo(valores: Record<string, string>, ...nomes: string[]): string {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
  const alvos = nomes.map(norm)
  for (const [k, v] of Object.entries(valores)) {
    if (alvos.includes(norm(k))) return (v ?? '').trim()
  }
  return ''
}

const SIM = /^(SIM|S|OK|X)$/i
const VAZIO = (v: string) => !v || /^(-|—|N\/A|NAO INFORMADO)$/i.test(v)

export function alertasDaOperacao(linhas: readonly LinhaOperacional[]): AlertaOperacional[] {
  const out: AlertaOperacional[] = []
  const ativas = linhas.filter((l) => l.ativa)

  for (const l of ativas) {
    const v = l.valores

    // ── OS concluída sem evidência ────────────────────────────────────────────
    if (l.aba === 'ordens_servico') {
      const status = campo(v, 'STATUS DA OS', 'STATUS')
      if (/CONCLU/i.test(status)) {
        const antes = campo(v, 'FOTO ANTES')
        const depois = campo(v, 'FOTO DEPOIS')
        const pavimento = campo(v, 'PAVIMENTO REPOSTO?', 'PAVIMENTO REPOSTO')
        if (VAZIO(antes) || VAZIO(depois)) {
          out.push(alerta(l, 'alta', 'OS concluída sem foto de antes/depois', 'FOTO ANTES / FOTO DEPOIS'))
        }
        // ⚠️ Só acusa quando a coluna EXISTE e diz que não repôs. Coluna ausente é silêncio —
        // acusar por ausência de informação é o erro que enche a tela de alerta falso.
        if (pavimento && !SIM.test(pavimento)) {
          out.push(alerta(l, 'alta', 'OS concluída com pavimento não reposto', 'PAVIMENTO REPOSTO?'))
        }
      }
    }

    // ── Ocorrência em aberto ──────────────────────────────────────────────────
    if (l.aba === 'ocorrencias') {
      const status = campo(v, 'STATUS')
      if (/ABERTA|PENDENTE|EM ANDAMENTO/i.test(status)) {
        out.push(alerta(l, 'media', `Ocorrência ${status.toLowerCase()}`, 'STATUS'))
      }
    }

    // ── Restrição do lookahead ────────────────────────────────────────────────
    if (l.aba === 'lookahead') {
      // ⚠️ A coluna da planilha é "RESTRIÇÃO REMOVIDA?" com SIM/NÃO. A regra antiga procurava
      // /RESTRI|NÃO|NAO/ no texto e acusava "NÃO HÁ RESTRIÇÃO" — o oposto do que queria dizer.
      const removida = campo(v, 'RESTRIÇÃO REMOVIDA?', 'RESTRICAO REMOVIDA?', 'RESTRIÇÃO REMOVIDA')
      const descricao = campo(v, 'RESTRIÇÃO', 'RESTRICAO', 'DESCRIÇÃO DA RESTRIÇÃO')
      if (descricao && removida && !SIM.test(removida)) {
        out.push(alerta(l, 'alta', `Restrição pendente: ${descricao.slice(0, 60)}`, 'RESTRIÇÃO REMOVIDA?'))
      }
    }

    // ── Ata com pendência em aberto ───────────────────────────────────────────
    if (l.aba === 'atas') {
      const status = campo(v, 'STATUS')
      const pendencia = campo(v, 'PENDÊNCIA / AÇÃO', 'PENDENCIA / ACAO', 'PENDÊNCIA')
      if (pendencia && /ABERTA|EM ANDAMENTO/i.test(status)) {
        const prazo = campo(v, 'PRAZO')
        out.push(alerta(l, /URGENTE|ALTA/i.test(campo(v, 'PRIORIDADE')) ? 'alta' : 'media',
          `Ata: ${pendencia.slice(0, 60)}${prazo ? ` (prazo ${prazo})` : ''}`, 'PENDÊNCIA / AÇÃO'))
      }
    }

    // ── Documento de equipe vencendo ──────────────────────────────────────────
    if (l.aba === 'equipe') {
      const alertaDaLinha = campo(v, 'ALERTA', 'SITUAÇÃO', 'SITUACAO')
      if (/VENC|ALERTA|IRREGULAR/i.test(alertaDaLinha)) {
        out.push(alerta(l, 'alta', `${campo(v, 'NOME') || l.chave}: ${alertaDaLinha}`, 'ALERTA'))
      }
    }
  }

  // Alta primeiro; dentro da mesma gravidade, a ordem em que a planilha trouxe.
  return out.sort((a, b) => (a.gravidade === b.gravidade ? 0 : a.gravidade === 'alta' ? -1 : 1))
}

function alerta(l: LinhaOperacional, gravidade: GravidadeDoAlerta, titulo: string, origem: string): AlertaOperacional {
  return { id: `${l.id}:${origem}`, aba: l.aba, chave: l.chave, gravidade, titulo, origem }
}
