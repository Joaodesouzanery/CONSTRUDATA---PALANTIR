# Apontamento diário pelo WhatsApp — modelo e siglas

**Para a equipe da WCR confirmar.** O sistema lê este texto sozinho; o que ele NÃO sabe é o que
cada sigla significa no contrato — e é isso que decide o preço. A tabela no fim é a nossa leitura.
Se alguma estiver errada, avise: corrige-se o rótulo sem mexer em conta nenhuma.

## A mensagem (botão "Copiar modelo" no RDO WCR)

```
📋 APONTAMENTO DIÁRIO
Data=DD/MM | Equipe=NOME | Núcleo=LOCAL
Clima=sol/nublado/chuva | Horas=8
Imóvel=RUA E NÚMERO
Imóvel=

ÁGUA
PRA=0 | LA=0 | LIA=0 | Caixa UMA=0 | HM=0 | Interligação=0 | Válvula=0

ESGOTO
PRE=0 | LE=0 | LIE=0 | PV=0 | PI=0 | CI=0

Obs=
```

## As regras — e por que existem

| Regra | Por quê |
|---|---|
| **`=0` é zero. `=` em branco é "não informado".** | "Não fez rede hoje" e "esqueci de dizer" são coisas diferentes, e o sistema guarda as duas. Um vazio nunca vira zero na produção nem no faturamento. |
| **Um `Imóvel=` por endereço.** | Todos contam. Dois endereços na mesma linha viram um só. |
| **`Equipe=` é o encarregado.** | Representa a equipe inteira no apontamento. **Quem** estava vem pela lista de presença (mensagem separada) ou pela marcação na tela do RDO. |
| **`Clima=`** sol · nublado · chuva · tempestade | Alimenta o tempo do RDO e o "dia parado". Novo e opcional. |
| **`Horas=`** horas trabalhadas, estimadas | Destrava custo por hora. Novo e opcional. Aceita `6,5`. |
| **O formato antigo continua valendo** (`PRA - 100`, um campo por linha). | Ninguém precisa reaprender no mesmo dia. Os dois dão o mesmo resultado. |
| **Vários campos na mesma linha, separados por ` \| `.** | Mensagem mais curta no celular. |

## Lista de presença (mensagem separada)

```
LISTA DE PRESENÇA 31/08
EQUIPE - Gilvan
Nome Sobrenome - líder
Nome Sobrenome - ajudante
```

Na tela do RDO, cada funcionário **ativo da obra** aparece com um quadradinho: a lista pré-marca
quem casou pelo nome. Nome parecido ("Felipe" com dois Felipes no cadastro) **não é decidido pela
máquina** — a tela pergunta. Ao salvar o RDO, quem ficou desmarcado aparece para conferência
como **falta injustificada**; você confirma um a um. A falta fica editável em Mão de Obra › Faltas/Subs.
**A presença não vira custo** — o custo da WCR entra pelo Controle de Caixa.

## As 13 siglas — confirme

| Sigla | Bloco | Unidade | Nossa leitura | ✔ / ✘ |
|---|---|---|---|---|
| PRA | Água | **metro** | Rede de água (assentamento) | |
| LA | Água | unidade | Ligação de água | |
| LIA | Água | unidade | Ligação intradomiciliar de água | |
| Caixa UMA | Água | unidade | Instalação de caixa UMA | |
| HM | Água | unidade | Substituição de hidrômetro | |
| Interligação | Água | unidade | Interligação de rede | |
| Válvula | Água | unidade | Instalação de válvula | |
| PRE | Esgoto | **metro** | Rede de esgoto (assentamento) | |
| LE | Esgoto | unidade | Ligação de esgoto | |
| LIE | Esgoto | unidade | Ligação intradomiciliar de esgoto | |
| PV | Esgoto | unidade | Poço de visita — **qual?** o contrato tem 5 (aduela mecânica/manual, plástico em 3 profundidades) | |
| PI | Esgoto | unidade | Poço de inspeção | |
| CI | Esgoto | unidade | Caixa de inspeção | |

⚠️ **PRA e PRE são metro; tudo o mais é unidade.** O sistema nunca soma metro com unidade.
⚠️ **PV** precisa do de-para por obra (qual dos 5 itens) — é escolhido uma vez, na tela.
