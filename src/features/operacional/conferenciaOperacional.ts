/**
 * conferenciaOperacional.ts — a reimportação que MOSTRA o que vai sobrescrever.
 *
 * ─── A REGRA QUE O CLIENTE DEU ────────────────────────────────────────────────
 * "Se eu alterar direto no sistema e depois colocar a planilha novamente, o sistema precisa
 * identificar o que foi alterado, pois a planilha ainda será a fonte da verdade. Mas nada impede
 * de ir alterando no sistema — quando vier a planilha, ela que manda."
 *
 * Então: a planilha VENCE, sempre. O que não pode é vencer em silêncio. Toda linha em que o valor
 * do sistema diverge do valor da planilha aparece numa lista de conferência, com os dois lados e
 * quem editou — e só então a gravação acontece.
 *
 * ⚠️ E a lição que o importador do Controle de Caixa aprendeu na marra, que vale igual aqui:
 * **"a planilha não disse" ≠ "a planilha disse vazio"**. Coluna que o arquivo não trouxe é
 * PRESERVADA, não apagada. Sem isso, subir uma planilha exportada sem uma coluna limparia esse
 * campo em todas as linhas — foi exatamente o defeito de `CAMPOS_DE_CADASTRO` no caixa.
 */

export type SituacaoDaLinha =
  /** Não existia no sistema. */
  | 'nova'
  /** Existe e a planilha traz os mesmos valores. */
  | 'inalterada'
  /** Existe, a planilha mudou, e ninguém tinha editado no sistema. */
  | 'atualizada'
  /** ⚠️ Existe, foi EDITADA NO SISTEMA, e a planilha discorda. É a que precisa ser vista. */
  | 'conflito'
  /** Está no sistema e sumiu da planilha. */
  | 'ausente'

export interface DivergenciaDeCampo {
  campo: string
  naPlanilha: string
  noSistema: string
}

export interface LinhaConferida {
  aba: string
  chave: string
  situacao: SituacaoDaLinha
  divergencias: DivergenciaDeCampo[]
  /** Quem editou no sistema, quando houver — é o que dá nome ao conflito. */
  editadoPor?: string
  editadoEm?: string
}

export interface LinhaExistente {
  chave: string
  valores: Record<string, string>
  origem: 'planilha' | 'sistema'
  editadoPor?: string
  editadoEm?: string
}

export interface LinhaDaPlanilha {
  chave: string
  valores: Record<string, string>
}

/**
 * As colunas que o ARQUIVO trouxe. Tudo fora desta lista é preservado do que já existe.
 *
 * ⚠️ É esta função que separa "não informado" de "informado vazio". Sem ela, a comparação campo a
 * campo veria `undefined` do lado da planilha e gravaria vazio por cima do que o sistema tinha.
 */
export function camposInformados(colunas: readonly string[]): Set<string> {
  return new Set(colunas)
}

export function conferirAba(
  aba: string,
  daPlanilha: readonly LinhaDaPlanilha[],
  noSistema: readonly LinhaExistente[],
  colunasDoArquivo: readonly string[],
): LinhaConferida[] {
  const informados = camposInformados(colunasDoArquivo)
  const porChave = new Map(noSistema.map((l) => [l.chave, l]))
  const vistas = new Set<string>()
  const out: LinhaConferida[] = []

  for (const nova of daPlanilha) {
    vistas.add(nova.chave)
    const antiga = porChave.get(nova.chave)
    if (!antiga) {
      out.push({ aba, chave: nova.chave, situacao: 'nova', divergencias: [] })
      continue
    }
    const divergencias: DivergenciaDeCampo[] = []
    for (const campo of informados) {
      const naPlanilha = (nova.valores[campo] ?? '').trim()
      const noSist = (antiga.valores[campo] ?? '').trim()
      if (naPlanilha !== noSist) divergencias.push({ campo, naPlanilha, noSistema: noSist })
    }
    if (divergencias.length === 0) {
      out.push({ aba, chave: nova.chave, situacao: 'inalterada', divergencias: [] })
      continue
    }
    // A distinção que o cliente pediu: mexer numa linha que a PLANILHA mudou é rotina; mexer numa
    // que ELE editou no sistema é uma decisão, e tem de aparecer com nome e data.
    out.push({
      aba,
      chave: nova.chave,
      situacao: antiga.origem === 'sistema' ? 'conflito' : 'atualizada',
      divergencias,
      editadoPor: antiga.editadoPor,
      editadoEm: antiga.editadoEm,
    })
  }

  for (const antiga of noSistema) {
    if (!vistas.has(antiga.chave)) {
      out.push({ aba, chave: antiga.chave, situacao: 'ausente', divergencias: [] })
    }
  }
  return out
}

/**
 * O valor final da linha: a planilha manda no que ela trouxe, o sistema mantém o resto.
 *
 * ⚠️ O `...antiga` primeiro e só depois os campos informados. Espalhar a linha da planilha inteira
 * apagaria toda coluna que o arquivo não tem — o defeito documentado do Controle de Caixa.
 */
export function valorFinalDaLinha(
  daPlanilha: Record<string, string>,
  noSistema: Record<string, string> | undefined,
  colunasDoArquivo: readonly string[],
): Record<string, string> {
  const saida: Record<string, string> = { ...(noSistema ?? {}) }
  for (const campo of colunasDoArquivo) saida[campo] = daPlanilha[campo] ?? ''
  return saida
}

export interface ResumoDaConferencia {
  novas: number
  atualizadas: number
  conflitos: number
  inalteradas: number
  ausentes: number
}

export function resumir(linhas: readonly LinhaConferida[]): ResumoDaConferencia {
  const r: ResumoDaConferencia = { novas: 0, atualizadas: 0, conflitos: 0, inalteradas: 0, ausentes: 0 }
  for (const l of linhas) {
    if (l.situacao === 'nova') r.novas++
    else if (l.situacao === 'atualizada') r.atualizadas++
    else if (l.situacao === 'conflito') r.conflitos++
    else if (l.situacao === 'inalterada') r.inalteradas++
    else r.ausentes++
  }
  return r
}
