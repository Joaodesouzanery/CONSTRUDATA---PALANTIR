/**
 * O que uma explicação de indicador precisa ter.
 *
 * ⚠️ Arquivo separado do componente por causa do `react-refresh/only-export-components`: um arquivo
 * que exporta componente **e** outra coisa quebra o hot reload da rota inteira. Mesmo motivo pelo
 * qual `useSoltarArquivo` mora fora de `AreaDeSoltar`.
 */
export interface Explicacao {
  /**
   * O que o número quer dizer, em português de obra.
   *
   * ⚠️ Não é para traduzir a sigla. "EVM é a sigla em inglês para Valor Agregado" não ajuda
   * ninguém — a pessoa continua sem saber o que fazer com aquilo. O que ajuda é dizer que pergunta
   * o número responde: *"compara o que a obra já entregou com o que já custou"*.
   */
  oQueE: string
  /** De qual tela ou planilha o dado sai. É por aqui que a pessoa descobre quem alimenta o quê. */
  deOndeVem: string
  /**
   * O que preencher para o indicador passar a existir.
   *
   * **Obrigatório sempre que o valor for "—".** Um card cinza mudo ensina a pessoa a ignorá-lo.
   */
  oQueFalta?: string
}
