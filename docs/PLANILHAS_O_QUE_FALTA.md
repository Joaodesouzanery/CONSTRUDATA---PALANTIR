# As planilhas — o que falta nelas, e o que cada coluna destrava

Não é teórico: cada indicador que hoje aparece **cinza** no Financeiro tem uma coluna faltando
na planilha por trás. Não é o sistema que está incompleto — é a fonte. Vale incluir estas
colunas no próximo ciclo de coleta em campo, antes de qualquer mudança de código.

## Controle de Caixa

| Adicionar | Por quê | Destrava |
|---|---|---|
| **FORNECEDOR** (separada de SOLICITANTE) | hoje "quem pediu" e "para quem foi pago" são a mesma coluna | B3 · concentração de locador (quanto vai para cada dono de máquina/veículo) |
| **Tabela de diária de HE por cargo** (250/300/350), cadastrada no sistema | hoje o valor vem "da célula"; sem tabela não há como alertar quando um lançamento foge do cargo | B4 · HE lançada vs tabela — nasce na Fatia 3 (Mão de Obra) |
| **Saldo de abertura do caixa** | sem ele o saldo começa do zero, e "quantas semanas o caixa aguenta" não tem base | C2 · runway |
| **ID do RDO de origem** quando o lançamento vier de mão de obra | fecha o círculo produção ↔ custo do mesmo dia | A1 exato por dia |

O modelo que o sistema gera (Controle de Caixa → Baixar modelo) **já traz a coluna FORNECEDOR**
desde 08/09/2026, opcional — a planilha sem ela continua sendo lida.

## Fluxo de Caixa Projetado

| Corrigir | Por quê |
|---|---|
| **"Carro engenheiro" no bloco certo** | o sistema soma em Engenheiro, a planilha em Estrutura e locações. Hoje não move dinheiro (mesmo pagador), mas vira dinheiro no dia em que um dos dois mudar de pagador |
| **13 meses de horizonte de caixa, não 15** | as 2 colunas extras estão zeradas na própria planilha — perseguir 15 é inventar dado. Já corrigido no sistema |
| **Chave única de preço** | `numeroPreco` colide 25× (Santos, 2 com valor divergente). Já corrigido no sistema (`cidade·numeroPreco·item·descrição·unidade#ocorrência`) |
| **Data de recebimento real** por nota, no contrato | é o dado que falta para medir a defasagem real vs a premissa de 20 dias — hoje a régua é a emissão da NF |
| **`revisadoEm` no custo geral recorrente** | o kit ferramenta (R$ 28.800/mês × 2 cidades) é pago todo mês sem ninguém confirmar se ainda faz sentido | D3 · recorrente sem revisão |

Tudo que já entrou no sistema está marcado; o resto depende da planilha chegar com a coluna.
