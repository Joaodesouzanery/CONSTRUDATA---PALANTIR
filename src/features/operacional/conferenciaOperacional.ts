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
  /**
   * A chave que a linha tinha no sistema, quando ela foi reconhecida pela SEGUNDA passada.
   *
   * ⚠️ Presente só quando a identidade mudou e a linha foi reconhecida pelo conteúdo. É o que
   * permite a gravação substituir a linha antiga em vez de criar uma paralela — e é o que a tela
   * mostra para o usuário entender por que aquela linha não apareceu como "nova".
   */
  chaveAnterior?: string
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

// ─── A segunda passada ────────────────────────────────────────────────────────

/**
 * Quanto duas linhas se parecem, de 0 a 1, olhando só os campos que o arquivo trouxe.
 *
 * Campo vazio dos dois lados não conta como acerto: numa aba com 30 colunas e 6 preenchidas, contar
 * os 24 vazios daria 80% de semelhança entre QUAISQUER duas linhas.
 */
export function semelhanca(
  a: Record<string, string>,
  b: Record<string, string>,
  campos: readonly string[],
): number {
  let comparaveis = 0
  let iguais = 0
  for (const campo of campos) {
    const x = (a[campo] ?? '').trim()
    const y = (b[campo] ?? '').trim()
    if (!x && !y) continue
    comparaveis++
    if (x === y) iguais++
  }
  return comparaveis === 0 ? 0 : iguais / comparaveis
}

/** Abaixo disto não é a mesma linha — é outra linha parecida, e casar seria pior que não casar. */
export const SEMELHANCA_MINIMA = 0.6
/** E precisa de conteúdo suficiente para a porcentagem significar alguma coisa. */
export const CAMPOS_MINIMOS = 3

/**
 * O par é bom o bastante para ser a MESMA linha?
 *
 * Duas réguas, porque o risco não é o mesmo nos dois lados:
 *  · com 3+ campos comparáveis, 60% de acerto basta — sobra evidência para o resto ser edição;
 *  · com 2, só um casamento **perfeito** conta.
 *
 * ⚠️ A segunda régua não é indulgência: ela é mais dura. Medido na Medição do arquivo real, a linha
 * `BER-0028` tem exatamente dois campos preenchidos (boletim e ID) e bate nos dois — exigir 3
 * campos a deixava de fora e ela voltava como "nova + sumiu". Já um par com 2 campos em que UM
 * difere dá 0,5 e continua recusado, que é o caso perigoso: duas linhas do mesmo boletim com IDs
 * diferentes nunca são a mesma linha.
 */
export function parAceitavel(comparaveis: number, grau: number): boolean {
  if (comparaveis >= CAMPOS_MINIMOS) return grau >= SEMELHANCA_MINIMA
  return comparaveis >= 2 && grau === 1
}

/**
 * A SEGUNDA PASSADA — o que impede "linha nova + linha sumida" quando a identidade muda.
 *
 * ─── POR QUE ELA EXISTE ───────────────────────────────────────────────────────
 * A primeira passada casa por chave, e só. Isso significa que **toda mudança de identidade é
 * obrigatoriamente reportada como um par nova+sumiu** — nunca como "atualizada". Foi essa a
 * assinatura do que o cliente viu: 33 novas, 386 sumidas e **zero** atualizadas.
 *
 * E há dois casos no arquivo real em que a chave PRECISA conter um campo mutável, porque sem ele
 * a unicidade morre (medido): na Medição, `CÓD. PREÇO` está vazio em 17 das 70 linhas e sem ela a
 * chave cai de 70 para 44 distintas; nas Atas, o texto da pendência é o que separa as 12 linhas de
 * uma mesma ata. Nesses dois, cirurgia na chave é impossível — é esta passada que segura.
 *
 * ⚠️ Ela é **conservadora de propósito**: casa uma leftover com no máximo uma leftover, exige
 * `SEMELHANCA_MINIMA` sobre pelo menos `CAMPOS_MINIMOS` campos com conteúdo, e vai do par mais
 * parecido para o menos parecido. Casar errado aqui funde duas linhas de verdade numa só — é pior
 * que o defeito que ela conserta.
 */
export function casarPorSemelhanca(
  conferidas: readonly LinhaConferida[],
  daPlanilha: readonly LinhaDaPlanilha[],
  noSistema: readonly LinhaExistente[],
  colunasDoArquivo: readonly string[],
): LinhaConferida[] {
  const novas = conferidas.filter((l) => l.situacao === 'nova')
  const ausentes = conferidas.filter((l) => l.situacao === 'ausente')
  if (novas.length === 0 || ausentes.length === 0) return [...conferidas]

  const planilhaPorChave = new Map(daPlanilha.map((l) => [l.chave, l]))
  const sistemaPorChave = new Map(noSistema.map((l) => [l.chave, l]))
  const informados = [...camposInformados(colunasDoArquivo)]

  // Todos os pares possíveis, do mais parecido para o menos.
  const pares: Array<{ nova: string; ausente: string; grau: number }> = []
  for (const n of novas) {
    const vn = planilhaPorChave.get(n.chave)
    if (!vn) continue
    for (const a of ausentes) {
      const va = sistemaPorChave.get(a.chave)
      if (!va) continue
      const comparaveis = informados.filter((c) => (vn.valores[c] ?? '').trim() || (va.valores[c] ?? '').trim()).length
      const grau = semelhanca(vn.valores, va.valores, informados)
      if (parAceitavel(comparaveis, grau)) pares.push({ nova: n.chave, ausente: a.chave, grau })
    }
  }
  pares.sort((x, y) => y.grau - x.grau)

  const novaUsada = new Set<string>()
  const ausenteUsada = new Set<string>()
  const casamento = new Map<string, string>()
  for (const p of pares) {
    if (novaUsada.has(p.nova) || ausenteUsada.has(p.ausente)) continue
    novaUsada.add(p.nova)
    ausenteUsada.add(p.ausente)
    casamento.set(p.nova, p.ausente)
  }
  if (casamento.size === 0) return [...conferidas]

  const out: LinhaConferida[] = []
  for (const l of conferidas) {
    // A ausente que foi reconhecida não é ausente: ela virou a linha nova, com outra chave.
    if (l.situacao === 'ausente' && ausenteUsada.has(l.chave)) continue
    if (l.situacao === 'nova' && casamento.has(l.chave)) {
      const chaveAnterior = casamento.get(l.chave)!
      const vn = planilhaPorChave.get(l.chave)!
      const va = sistemaPorChave.get(chaveAnterior)!
      const divergencias: DivergenciaDeCampo[] = []
      for (const campo of informados) {
        const naPlanilha = (vn.valores[campo] ?? '').trim()
        const noSist = (va.valores[campo] ?? '').trim()
        if (naPlanilha !== noSist) divergencias.push({ campo, naPlanilha, noSistema: noSist })
      }
      // ⚠️ Sem divergência, a linha é INALTERADA — o que mudou foi a identidade, não o dado.
      // Chamá-la de "atualizada" encheria a conferência de linhas sem nada para mostrar: na
      // migração das chaves da Medição isso dava 70 "atualizadas" com zero campos diferentes.
      // O que mudou de nome é contado à parte, em `reidentificadas`.
      const situacao: SituacaoDaLinha = divergencias.length === 0
        ? 'inalterada'
        : (va.origem === 'sistema' ? 'conflito' : 'atualizada')
      out.push({
        aba: l.aba,
        chave: l.chave,
        chaveAnterior,
        situacao,
        divergencias,
        editadoPor: va.editadoPor,
        editadoEm: va.editadoEm,
      })
      continue
    }
    out.push(l)
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
  /**
   * Linhas que a SEGUNDA passada reconheceu pelo conteúdo: a identidade mudou, a linha é a mesma.
   *
   * Não é uma sexta situação — cada uma destas já está contada como inalterada, atualizada ou
   * conflito. É o número que responde "por que 70 linhas mexeram se eu não mudei nada?".
   */
  reidentificadas: number
}

export function resumir(linhas: readonly LinhaConferida[]): ResumoDaConferencia {
  const r: ResumoDaConferencia = { novas: 0, atualizadas: 0, conflitos: 0, inalteradas: 0, ausentes: 0, reidentificadas: 0 }
  for (const l of linhas) {
    if (l.situacao === 'nova') r.novas++
    else if (l.situacao === 'atualizada') r.atualizadas++
    else if (l.situacao === 'conflito') r.conflitos++
    else if (l.situacao === 'inalterada') r.inalteradas++
    else r.ausentes++
    if (l.chaveAnterior) r.reidentificadas++
  }
  return r
}

// ─── A conferência aba por aba ────────────────────────────────────────────────

export interface ResumoDaAba extends ResumoDaConferencia {
  aba: string
}

/**
 * O mesmo resumo, quebrado por aba — e é assim que o cliente pediu para ver.
 *
 * ⚠️ Cinco números globais para 20 abas escondem exatamente o caso que importa: "33 novas e 386
 * sumiram" não diz que as 33 eram do Banco de Custos e as 386 vinham de outras cinco abas. Sem a
 * quebra, não dá para olhar o número e saber onde olhar.
 *
 * A ordem é a de aparição na conferência, que é a das abas na planilha — não alfabética.
 */
export function resumirPorAba(linhas: readonly LinhaConferida[]): ResumoDaAba[] {
  const por = new Map<string, ResumoDaAba>()
  for (const l of linhas) {
    let r = por.get(l.aba)
    if (!r) {
      r = { aba: l.aba, novas: 0, atualizadas: 0, conflitos: 0, inalteradas: 0, ausentes: 0, reidentificadas: 0 }
      por.set(l.aba, r)
    }
    if (l.situacao === 'nova') r.novas++
    else if (l.situacao === 'atualizada') r.atualizadas++
    else if (l.situacao === 'conflito') r.conflitos++
    else if (l.situacao === 'inalterada') r.inalteradas++
    else r.ausentes++
    if (l.chaveAnterior) r.reidentificadas++
  }
  return [...por.values()]
}

const campoCsv = (v: string): string => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/**
 * O relatório de divergências em CSV — uma linha por CAMPO divergente, não por registro.
 *
 * ⚠️ Por campo, de propósito: um relatório por registro obriga a abrir o sistema para descobrir o
 * que mudou dentro dele, o que derrota o objetivo de poder conferir a importação fora dele.
 *
 * ⚠️ Separador `;` e BOM: é o que o Excel em pt-BR abre em colunas sem perguntar nada. Com vírgula
 * ele joga a linha inteira na coluna A, e o relatório vira um bloco de texto.
 */
export function relatorioDeDivergencias(linhas: readonly LinhaConferida[]): string {
  const cab = ['Aba', 'Situação', 'Chave', 'Chave anterior', 'Campo', 'No sistema', 'Na planilha', 'Editado por', 'Editado em']
  const out = [cab.join(';')]
  for (const l of linhas) {
    if (l.situacao === 'inalterada' && !l.chaveAnterior) continue
    const base = [l.aba, l.situacao, l.chave, l.chaveAnterior ?? '']
    const fim = [l.editadoPor ?? '', l.editadoEm ?? '']
    if (l.divergencias.length === 0) {
      out.push([...base, '', '', '', ...fim].map(campoCsv).join(';'))
      continue
    }
    for (const d of l.divergencias) {
      out.push([...base, d.campo, d.noSistema, d.naPlanilha, ...fim].map(campoCsv).join(';'))
    }
  }
  return out.join('\r\n')
}
