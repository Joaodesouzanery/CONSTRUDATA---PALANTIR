/**
 * A identidade da linha na planilha — o que faz a reimportação ATUALIZAR em vez de duplicar.
 *
 * ─── POR QUE ISTO VIROU ARQUIVO PRÓPRIO ───────────────────────────────────────
 * Estava dentro de `importarPlanilha.ts`, sem `export` e **sem um único teste** — ao contrário da
 * função equivalente do Controle de Caixa, que é travada por um teste nomeado. Foi exatamente essa
 * ausência que deixou o commit `cecc4e4` trocar a chave do Banco de Custos sem nada acusar: a
 * interseção entre as chaves velhas e as novas daquela aba é **zero**, e a reimportação seguinte
 * reportou 33 linhas novas e 40 sumidas que eram as mesmas 33 linhas.
 *
 * ─── A REGRA, QUE JÁ CUSTOU CARO UMA VEZ ──────────────────────────────────────
 * ⚠️ **Campo que a pessoa preenche DEPOIS não pode estar na chave.** É a lição que o importador do
 * Controle de Caixa documentou: se o valor entrasse na chave, corrigir R$ 1.000 para R$ 1.500 não
 * seria "valor alterado" — seria uma linha nova mais uma linha sumida.
 *
 * ⚠️ **Mas tirar da chave só vale quando a unicidade sobrevive.** Isso foi MEDIDO contra o arquivo
 * real (rev15), aba por aba, e o resultado desmentiu metade das suspeitas:
 *
 * | aba | campo suspeito | medido | decisão |
 * |---|---|---|---|
 * | Programação | `EQUIPE` | vazia em **44/44** | **fora** — sem ela, 44 distintas e 0 colisões |
 * | Ordens de Serviço | `Nº OS SABESP` | cheia em 44/44 | **fora** — 0 colisões, e o número chega depois |
 * | Apontamento | `EQUIPE` | vazia em **18/18** | **fora** — 6 colisões, resolvidas por posição, igual a hoje |
 * | Medição | `CÓD. PREÇO` | vazia em 17/70 | **FICA.** Sem ela a chave cai de 70 para 44 distintas |
 * | Atas | `PENDÊNCIA / AÇÃO` | `Nº DA ATA` sozinho dá **1 distinta e 11 repetidas** | **FICA.** É o texto que separa as pendências de uma mesma ata |
 *
 * Nos dois últimos casos a chave continua podendo mudar quando alguém preenche ou reescreve o
 * campo — e quem resolve isso **não é a chave, é o casamento por semelhança** da segunda passada
 * em `conferenciaOperacional.ts`. Cirurgia na chave ali destruiria a unicidade.
 */
import type { SabespSheetId } from './sabespStore'

/**
 * As colunas que identificam a linha de cada aba.
 *
 * ⚠️ **Fonte ÚNICA.** Antes existiam duas listas que discordavam entre si: `keyColumns` no
 * `sabespStore` e as exigências de `ehRegistroReal`. Para a Programação, uma pedia `EQUIPE` e a
 * outra não; para a Medição, uma pedia `Nº BOLETIM` e a outra não. Duas verdades sobre o que
 * identifica uma linha é como nasce "33 novas e 386 sumiram".
 */
export const COLUNAS_DE_IDENTIDADE: Record<SabespSheetId, readonly string[]> = {
  // Abas derivadas: são fórmula na planilha e não produzem registro.
  configuracoes:       [],
  carteira_ticket:     [],
  resumo:              [],
  dashboard:           [],
  planejado_realizado: [],

  banco_custos:        ['Contrato', 'Item'],
  tabela_precos:       ['CHAVE'],
  cadastro_servicos:   ['ID', 'CONTRATO'],
  equipe:              ['MATRÍCULA', 'CONTRATO'],
  // ⚠️ `EQUIPE` saiu: designada depois, e vazia em 44/44 hoje.
  programacao:         ['DATA', 'CONTRATO', 'ID DO SERVIÇO'],
  // ⚠️ `Nº OS SABESP` saiu: o número vem da SABESP depois de a linha existir.
  ordens_servico:      ['ID DO SERVIÇO', 'CONTRATO'],
  // ⚠️ `EQUIPE` saiu, mesma razão. Sobram 6 colisões por dia+contrato, desempatadas por posição.
  apontamento:         ['DATA', 'CONTRATO'],
  materiais:           ['DATA', 'ID DO SERVIÇO / OS', 'MATERIAL', 'MOVIMENTO'],
  // ⚠️ `Nº BOLETIM` saiu; `CÓD. PREÇO` FICA — é ela que dá as 70 chaves distintas.
  medicao:             ['ID DO SERVIÇO', 'CÓD. PREÇO (CHAVE)'],
  diario_obra:         ['Nº DO RDO', 'CONTRATO'],
  ocorrencias:         ['Nº', 'CONTRATO'],
  faturamento:         ['MÊS', 'CONTRATO'],
  // ⚠️ O texto FICA: sem ele, as 12 pendências viram 1 chave repetida 12 vezes.
  atas:                ['Nº DA ATA', 'PENDÊNCIA / AÇÃO'],
  lookahead:           ['SEMANA (2ª feira)', 'CONTRATO', 'ID DO SERVIÇO'],
  plano_semanal:       ['SEMANA (2ª feira)', 'CONTRATO', 'ID DO SERVIÇO'],
}

export const normalizarRotulo = (v: string): string =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/**
 * O valor de uma coluna, achada pelo rótulo.
 *
 * ⚠️ **Igualdade primeiro, prefixo só depois.** Antes era prefixo direto, e isso é ambíguo no
 * arquivo real: `'DATA'` casa com `DATA`, `DATA LIMITE` e `DATA DE EXECUÇÃO` na Programação;
 * `'MATERIAL'` casa com `MATERIAL` e `MATERIAL DA SABESP?` nos Materiais. Ganhava o primeiro na
 * ordem das colunas — de modo que **reordenar uma coluna na planilha trocaria a identidade de
 * todas as linhas da aba de uma vez**, sem nada na tela.
 *
 * O prefixo continua como recurso porque rótulos variam entre revisões ("SEMANA (2ª feira)" ganhar
 * um sufixo, por exemplo). Mas só entra quando NÃO existe casamento exato.
 */
export function valorPorRotulo(valores: Record<string, string>, procurado: string): string {
  const alvo = normalizarRotulo(procurado)
  for (const [k, v] of Object.entries(valores)) {
    if (normalizarRotulo(k) === alvo) return String(v ?? '').trim()
  }
  for (const [k, v] of Object.entries(valores)) {
    if (normalizarRotulo(k).startsWith(alvo)) return String(v ?? '').trim()
  }
  return ''
}

/**
 * A chave da linha: as colunas de identidade, na ordem, mais um contador de repetição.
 *
 * ⚠️ **Coluna vazia OCUPA a posição** (`a||c`, não `a|c`). O `.filter(Boolean)` de antes fazia
 * `['a','']` e `['','a']` produzirem a mesma chave `'a'` — duas linhas diferentes com a mesma
 * identidade, uma sobrescrevendo a outra em silêncio.
 *
 * ⚠️ **O contador é por ordem de aparição e é usado de verdade**: 25 chaves da Tabela de Preços se
 * repetem (as duas `BER-72000222` diferem só em `GRUPO`, que não está na chave) e 6 do Apontamento.
 * O preço é conhecido: inserir uma linha no meio desloca o `#n` de todas as seguintes. É a segunda
 * passada da conferência que segura esse caso.
 */
export function chaveDaLinha(
  valores: Record<string, string>,
  colunasChave: readonly string[],
  jaVistas: Map<string, number>,
): string {
  const partes = colunasChave.map((c) => valorPorRotulo(valores, c))
  // Sem nenhuma coluna de identidade com valor, a linha não tem identidade própria: cai no
  // conteúdo. Hoje isso não acontece em nenhuma aba do arquivo real — `ehRegistroReal` barra antes.
  const base = partes.some(Boolean) ? partes.join('|') : JSON.stringify(valores)
  const n = (jaVistas.get(base) ?? 0) + 1
  jaVistas.set(base, n)
  return n === 1 ? base : `${base}#${n}`
}

/** `true` quando a linha tem identidade própria; `false` quando a chave caiu no conteúdo inteiro. */
export function temIdentidadePropria(
  valores: Record<string, string>,
  colunasChave: readonly string[],
): boolean {
  return colunasChave.length > 0 && colunasChave.some((c) => !!valorPorRotulo(valores, c))
}
