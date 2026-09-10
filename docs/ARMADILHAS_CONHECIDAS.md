# Armadilhas conhecidas

Este documento existe por um motivo específico: **algumas coisas neste sistema funcionam hoje por
sorte, não por desenho.** Nenhuma delas dá erro. Cada uma continua funcionando até alguém escrever
o próximo consumidor sem saber da regra — e aí produz um número errado em silêncio.

Um comentário `⚠️` no código sozinho se perde entre arquivos. Um índice sozinho ninguém acha na hora
certa. Por isso cada item aqui tem **os dois**: a explicação completa neste doc, e um comentário no
código apontando para cá.

Formato de cada item: **o que é · onde mora · quem hoje escapa · o que acontece se alguém não
souber**.

---

## 1. 🔴 A produção do RDO WCR está guardada DUAS VEZES no mesmo RDO

**O que é.** `RdoWcrData` guarda a produção do dia em dois lugares que se sobrepõem:

- `wcr.producao` — a **soma** do dia, todas as equipes juntas;
- `wcr.apontamentos[].producao` — o **detalhe por equipe**, cuja soma é exatamente a de cima.

Não é redundância acidental: o detalhe existe para o PDF poder mostrar quem fez o quê, e a soma
existe porque quase todo consumidor quer o total. Está documentado em `src/types/index.ts`, no
docblock de `RdoWcrData`.

**Onde mora.** `src/types/index.ts` (interface `RdoWcrData`), montado em
`src/features/rdo/components/RdoWcrPanel.tsx` (`montarPayload`).

**Quem hoje escapa.** Os três leitores existentes leem **só** `wcr.producao`:
`src/features/rdo/utils/wcrParaFcp.ts`, `src/features/rdo/utils/rdosReportExport.ts` e
`src/features/rdo/utils/servicoDaSigla.ts` (`previaDoDePara`, que tem teste garantindo isso).

**O que acontece se alguém não souber.** Um consumidor novo que itere os dois — o que é natural,
porque os dois parecem listas de produção — conta **cada metro duas vezes dentro de um único RDO**.
Sem erro, sem aviso. Se esse consumidor for de dinheiro, o valor sai pelo dobro.

**A regra:** ao ler produção do WCR, use `wcr.producao`. O `apontamentos[]` é para exibir detalhe
por equipe, nunca para somar.

---

## 2. `exportSolicitacaoMedicao` não tem nenhum chamador

**O que é.** Uma função que gera o `.xlsx` "Solicitação de Medição" **enviado ao cliente**, com
Medido atual, Saldo, Valor bruto e Medido líquido por item de contrato.

**Onde mora.** `src/features/torre-de-controle/utils/solicitacaoMedicaoXlsx.ts`.

**Quem hoje escapa.** Ninguém a chama — o caminho está morto, então nada sai errado.

**O que acontece se alguém não souber.** Ela lê `calcServico`/`totaisContrato`, que dependem do
filtro do item 3. Se alguém religar o botão **depois** de o filtro mudar, sai um documento
valorado para o cliente com uma regra que ninguém decidiu. Antes de religar: conferir o item 3.

---

## 3. 🔴 A medição da WCR não tem fonte da verdade decidida

**O que é.** A mesma execução física — os mesmos metros de rede, nos mesmos dias, na mesma obra —
é descrita por **duas fontes independentes**:

- a **planilha do contrato** (`BASE MEDIÇÃO`), importada na aba Medição do Financeiro;
- os **RDOs WCR**, apontados pelo campo todo dia.

**Onde mora.** O que hoje separa as duas é um filtro: `src/features/torre-de-controle/utils/obraMedicao.ts`
ignora RDO que não seja `template === 'compizzo'` (em `medidoAutoPorServico` e
`medidoPorServicoPorMes`).

**Quem hoje escapa.** O filtro. Enquanto ele estiver lá, só a planilha vira medição.

**O que acontece se alguém não souber.** Afrouxar esse filtro faz a mesma execução virar dinheiro
em **três lugares**:

1. `medidoBruto` nas telas de Controle de Medição e Composição — só exibição;
2. `calcularMedicao` → **`FinanceiroEntry` de verdade**, gravada (`medicaoParaFinanceiro.ts`);
3. `contrato.faturamentos` → **títulos**, também gravados.

E por baixo, `saldo = qtdContrato − qtdAnterior − medido` (`obraMedicao.ts`) passa a subtrair o
histórico **duas vezes** em qualquer obra onde alguém já digitou `qtdAnterior` à mão.

⚠️ Piorando: `QuantidadeMedida` (`importarCatalogoZn.ts`) **não tem campo de origem**, e
`calcularMedicao` (`motorDaMedicao.ts`) **soma duplicatas de propósito** — porque a planilha pode
repetir o item. Não há como distinguir "veio da planilha" de "veio do RDO" depois de misturado.

**A regra:** não afrouxar o filtro sem antes decidir — e escrever aqui — qual das duas fontes manda,
e o que fazer com a outra.

---

## 4. `deParaSiglas` não valida unidade sozinho

**O que é.** O mapa sigla do apontamento → item do contrato aceita qualquer combinação. Uma sigla
medida em **metro** pode ser mapeada num item cobrado por **unidade**, e `precoEfetivo × quantidade`
multiplica sem olhar.

**Onde mora.** `ObraContrato.deParaSiglas` (`src/types/index.ts`), editado em
`src/features/torre-de-controle/components/ContratoCard/AbaDeParaWcr.tsx`.

**Quem hoje escapa.** `conferirDeParaSiglas` (`src/features/rdo/utils/servicoDaSigla.ts`) reporta a
divergência na tela, e a prévia se recusa a valorar sigla divergente. **Mas reporta, não bloqueia** —
por decisão, porque existe caso legítimo de unidade escrita solta.

**O que acontece se alguém não souber.** Medido com item real deste cliente: `PRA` (rede de água,
metro) mapeada em "Poço de visita pré-moldado D=1000mm", R$ 3.250,00 **por unidade**. Um dia de
120 m vira **R$ 390.000**. Quem ignorar o aviso vermelho leva esse número adiante.
