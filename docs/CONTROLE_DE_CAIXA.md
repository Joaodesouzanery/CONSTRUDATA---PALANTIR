# Controle de Caixa

Financeiro → **DRE e Resultado** → **Controle de Caixa**.

## A regra que decide tudo

> "o lançamento de despesa e receita **deve ser feito por meio da planilha modelo em Excel**. O
> lançamento manual na tela existe apenas como correção pontual, nunca como via principal."

A equipe mexe na planilha o mês inteiro e joga o arquivo no sistema **várias vezes**. Por isso o
problema central não é importar — é **reimportar sem duplicar**. Tudo abaixo é consequência disso.

## O fluxo

1. **Baixar planilha** — sai com três abas: `COMO USAR`, `LANÇAMENTOS` e `HORAS EXTRAS <mês>`.
   Se já houver lançamentos no sistema, eles vêm preenchidos, **com a coluna ID**.
2. A equipe preenche durante o mês, no formato que já usa.
3. **Importar planilha** — o sistema mostra o que muda **antes de gravar**.
4. Confirma. Nada é gravado sem isso.

## Identidade: por que reimportar não duplica

**Com a coluna ID** (a planilha que o sistema gera): o casamento é exato. A pessoa pode mudar
descrição, data, valor e a ordem das linhas — continua sendo o mesmo lançamento.

**Sem ID** (o arquivo que a equipe montou sozinha): a identidade é
`tipo + data + descrição`, mais a **ordem de aparição** como desempate.

Duas decisões dentro disso, e as duas vieram do arquivo real:

- **O valor e o solicitante ficam FORA da chave.** São justamente os campos que a pessoa corrige.
  Se entrassem, mudar R$ 1.000 para R$ 1.500 não seria "valor alterado" — seria uma linha nova mais
  uma linha "sumiu".
- **A ordem de aparição é obrigatória.** As linhas 27 e 32 do arquivo do cliente são **idênticas em
  tudo**: mesma descrição (`UBER EQUIPE HUMBERTO - MORRO DOCE PARA CANTEIRO`), mesma data
  (17/07/2026), mesmo valor, mesmo solicitante. São dois Ubers de verdade. Sem o desempate, o
  segundo gasto sumiria.

O preço conhecido: **sem ID**, mudar a descrição ou a data cria uma linha nova e aponta a antiga
como sumida. É por isso que o modelo gerado leva ID.

## O que a conferência mostra

| | |
|---|---|
| **Novo** | não existe no sistema |
| **Valor alterado** | mesma linha, valor diferente — antes e depois lado a lado |
| **Cadastro alterado** | descrição, data, categoria, solicitante ou conferência mudou |
| **Inalterado** | não conta como mudança e **não é regravado** |
| **Duplicado no arquivo** | o mesmo **ID** duas vezes — linha copiada do modelo |
| **Sumiu da planilha** | está no sistema, não veio no arquivo — ⚠️ **não apaga**, só aponta |

Mais: erro linha a linha (data inválida, valor não numérico, despesa sem descrição) e a
**divergência contra o rodapé da própria planilha** — se as linhas somam R$ 106.000 e o rodapé diz
outra coisa, alguém mexeu numa célula sem mexer na fórmula.

**"Sumiu" é limitado ao período do arquivo.** Sem esse corte, importar julho listaria todo agosto
como sumido.

## O que o arquivo real ensinou

Tudo abaixo foi medido em `docs/CONTROLE DE CAIXA-MODELO.xlsx`, não suposto:

- **O cabeçalho não é a linha 1.** A linha 1 traz os rótulos de bloco (`RECEITAS`, `DESPESAS`); o
  cabeçalho está na linha 2.
- **Receitas e despesas são dois blocos lado a lado.** Uma linha pode ter os dois, um, ou nenhum.
- **A coluna "Conferido" não tem cabeçalho.** Os 106 status estão na coluna G e a célula G2 está
  vazia. O leitor acha a coluna pelo conteúdo (exige 80% de marcas de conferência), senão a
  primeira importação jogaria fora a conferência inteira.
- **A linha de fechamento põe o SALDO na coluna do SOLICITANTE.** Lida como lançamento, criaria um
  solicitante chamado "-88000".
- **`01 A 10/07/2026`** é uma data: uma despesa que cobre dez dias. Vira período, com começo e fim.
- **`DAMIÃO/WELLINGTON`** são duas pessoas. Também `JESSÉ / PAULO ZN`, com espaço dos dois lados.
- **Uma despesa não tem solicitante**, e é aceita.
- **Despesa sem data herda a data da linha de cima** — é como a planilha é preenchida.

### Horas extras

- **O valor NÃO sai do cargo.** `AJUDANTE GERAL I` aparece com **250, 300 e 350**; `PEDREIRO I` com
  300 e 350. A tabela por cargo é sugestão na tela; a verdade é a célula.
- **`ÉVERTON SABINO` tem R$ 350 e R$ 300 lançados e nenhum cargo.** Recusar a linha perderia
  dinheiro que a empresa pagou.
- **O cabeçalho `OBS. DIAS 01 E 02` diz a que dias o "PG" se refere.** Fora desses dias, "não
  disse" não é "pago".
- **Só a hora extra marcada `PG` vira despesa no caixa.** A lançada e não paga é previsão; jogá-la
  no caixa faria a despesa aparecer antes do desembolso.
- A soma por dia é conferida contra a linha `TOTAIS` da própria grade.

## Onde o dado vive

**Não há tabela nova e não há migração.** Os lançamentos são `FinanceiroEntry`, os mesmos do resto
do módulo — `financeiro_entries` guarda a entry inteira num `payload jsonb`, então os campos novos
(`solicitantes`, `dataFim`, `conferido`, `origem`, `chavePlanilha`, `funcionarioNome`, `cargo`) são
opcionais e **não exigem alterar o banco**.

Consequência que importa: o que entra no Controle de Caixa **aparece sozinho** no DRE, no Fluxo de
Caixa, na Visão Geral, no Por Obra e no Plano de Contas, porque essas telas leem a mesma lista.

O `id` é determinístico a partir da chave (`seededId`), e `addEntry` é **upsert por id** — é essa
combinação que faz a reimportação substituir em vez de duplicar.

## Categorias

O arquivo do cliente **não tem coluna de categoria**; tudo entra como **Outro**, que quer dizer
*não classificado* — não zero. O modelo gerado traz a coluna, com os valores que a DRE sabe somar:

- Receitas: Medição · Adiantamento · Reajuste · Outro
- Despesas: Materiais · Mão de obra · Equipamentos · Subempreiteiros · Administrativo · Outro
