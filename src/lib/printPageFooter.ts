/**
 * printPageFooter.ts — rodapé impresso em TODAS as páginas: procedência à esquerda, número à
 * direita.
 *
 * ─── POR QUE EXISTE ───────────────────────────────────────────────────────────────────────────
 * Relatório de obra sai da impressora, é grampeado e passa de mão em mão. Uma folha que se
 * solta do maço sem dizer de que documento veio nem que página é vira papel sem valor: ninguém
 * consegue conferir se o relatório está inteiro, nem devolver a folha ao lugar. O rodapé do
 * navegador (aquele "1/4" que a caixa de impressão adiciona) só existe se o usuário deixar a
 * opção "Cabeçalhos e rodapés" ligada — e ele imprime a URL da aba, não a obra.
 *
 * ─── COMO FUNCIONA, E O QUE FOI TESTADO ───────────────────────────────────────────────────────
 * Usa as margin boxes de CSS Paged Media (`@bottom-left` / `@bottom-right`) com `counter(page)`
 * e `counter(pages)`. Três técnicas foram medidas no Chrome headless imprimindo um documento de
 * 4 páginas, extraindo o texto de cada página com pypdf:
 *
 *   - `@page { @bottom-right { content: counter(page) } }` → sai nas 4 páginas ✔ (é esta)
 *   - elemento `position: fixed`                           → sai nas 4 páginas ✔
 *   - `<thead>` de tabela que atravessa páginas            → sai nas 4 páginas ✔
 *
 * A margin box venceu por não ocupar espaço no fluxo (não precisa de `padding-bottom` para o
 * conteúdo não passar por baixo) e por dar acesso ao número da página, que as outras duas não
 * têm. Só o Firefox fica de fora: ele ignora margin boxes e imprime sem rodapé — degradação
 * silenciosa e aceitável, o corpo do documento não muda.
 */

/**
 * Escapa para dentro de uma string CSS. Sem isto, um nome de obra com aspas (`Bloco "A"`)
 * fecharia a string e quebraria a regra inteira — o rodapé sumiria do documento sem aviso.
 * A barra invertida vem primeiro, senão ela escaparia as próprias barras que acabamos de pôr.
 */
function cssString(texto: string): string {
  return '"' + texto
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    + '"'
}

/**
 * Devolve a regra `@page` com o rodapé. Insira DEPOIS do CSS principal do documento, para que a
 * declaração de margem daqui prevaleça: a margem inferior precisa de folga para a caixa caber.
 *
 * @param identificacao  procedência, no canto esquerdo (ex.: "Relatório de RDOs · CD Extrema")
 */
export function pageFooterCss(identificacao: string): string {
  return `@page {
  margin-bottom: 16mm;
  @bottom-left {
    content: ${cssString(identificacao)};
    font: 7pt -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    color: #94a3b8;
    vertical-align: top;
    padding-top: 3mm;
  }
  @bottom-right {
    content: "página " counter(page) " de " counter(pages);
    font: 7pt -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    color: #94a3b8;
    vertical-align: top;
    padding-top: 3mm;
  }
}`
}
