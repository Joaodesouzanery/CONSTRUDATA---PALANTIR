# Métricas por módulo, e administração da qualidade

> Pesquisa de referência para a ConstruData. Escrito em 04/09/2026.
>
> **A regra que atravessa o documento inteiro:** todo indicador de desempenho tem um denominador,
> e quem controla o denominador controla o número. Índice de não conformidade melhora se você
> inspecionar menos. *Savings* de compras melhora se você escolher a linha de base. PPC melhora se
> você planejar pacotes menores. **Publique sempre o indicador ao lado do seu denominador de
> esforço** — é a única defesa contra manipulação, inclusive a involuntária.

## Como ler

Cada métrica traz cinco colunas, e duas delas existem para impedir que este documento vire
propaganda:

| Coluna | Para quê |
|---|---|
| **Tem hoje?** | ✅ existe no produto · ⚠️ existe em parte · ❌ não existe |
| **Referência publicada** | fonte que dá para abrir e conferir — ou o silêncio declarado |
| **Como engana** | o modo típico de leitura errada. É a coluna mais importante |

⚠️ **A seção final lista o que NÃO tem referência publicada.** Nada dali pode virar constante
dentro do código. Este produto já teve tarifas inventadas rodando em produção; o documento existe
em parte para isso não se repetir.

---

## 1 · RDO — o módulo que sustenta todos os outros

É o único que registra o que **aconteceu** no dia. Sem RDO preenchido, metade do resto fica vazio:
Gestão à Vista, produção da linha de base, custo em tempo real, avanço por serviço.

| Métrica | Fórmula | Tem hoje? | Como engana |
|---|---|---|---|
| **Horas paradas por motivo** | Hh paradas ÷ Hh disponíveis, por motivo | ✅ *(set/2026)* | Subnotificação é sistemática — parada de 40 min não é registrada. E motivo genérico não gera ação: "falta de material" precisa virar "falta de tinta X por atraso do fornecedor Y" |
| **Aderência de efetivo por função** | presente ÷ previsto, **por função** | ⚠️ conta cabeças, não por função | Contar o total esconde a falta da função gargalo: 1 pintor a menos pesa mais que 3 ajudantes a mais. E 100% de efetivo com PPC baixo significa que o problema é liberação de frente — contratar mais gente piora |
| **Produção do dia (quantidade)** | quantidade concluída **e liberada** | ✅ | Contar m² com 1ª demão como pronto infla a produção; semanas depois a curva trava |
| **RUP — Hh por unidade** | Hh ÷ quantidade executada | ✅ `horasTrabalhadas` + `PrevistoRealizadoPanel` | Ver §2 — são duas RUPs para dois usos, e trocá-las é o erro clássico |
| **Chuva com milímetro** | dias com ≥1 mm vs. Normal Climatológica INMET | ❌ só `sol / nublado / chuva / outros` | "Choveu" sem milímetro e sem hora parada **não sustenta pleito nenhum** |
| **Aderência do executado ao programado** | concluídas ÷ programadas — é o PPC em cadência diária | ⚠️ existe meta por linha | Se o RDO registra texto livre em vez de lista fechada programada na véspera, não existe aderência: existe narrativa |

**Sobre o pleito de chuva.** O método aceito é o de Golbert & L'Astorina, [XIV SINAOP/IBRAOP](http://www.ibraop.org.br/acervo/XIV_sinaop/docs/FernandoGolbert.pdf):
comparar a precipitação medida com a **Normal Climatológica** da estação INMET mais próxima. A
mesma fonte traz a regra que protege você dos dois lados — se a chuva do período ficar **abaixo** da
normal, o pleito deve ser negado, porque o orçamento já contempla chuva normal.

**O que já está bom e não deve ser mexido:** o quadro do topo do Dashboard — *"3 sem RDO · 6 não
cobra hoje"*, com "Fazer RDO" e "Não teve produção" por obra. É aderência de preenchimento
resolvida com a ação ao lado do problema. É o melhor padrão de interface do produto hoje.

---

## 2 · Mão de Obra e produtividade — a RUP

**RUP = Hh ÷ quantidade de serviço.** Menor é melhor. Referência canônica:
[CBIC/Souza, *Manual Básico de Indicadores de Produtividade na Construção Civil*, 2017](https://cbic.org.br/wp-content/uploads/2017/11/Manual_Basico_de_Indicadores_de_Produtividade_na_Construcao_Civil_2017.pdf)
(autoria de Ubiraci Espinelli Lemes de Souza, EPUSP).

**São duas RUPs, para dois usos, e trocá-las é o erro mais comum:**

| | O que é | Serve para |
|---|---|---|
| **cumulativa** | tudo acumulado, com os dias ruins dentro | **orçamento** |
| **potencial** | mediana dos dias em que nada atrapalhou | **dimensionar equipe** |

Orçar com a potencial garante estouro (ela exclui, por definição, as anormalidades que vão se
repetir). Dimensionar com a cumulativa deixa a equipe folgada.

### Referências publicadas que servem para este negócio

Não existe RUP publicada de pintura industrial nem de demarcação de piso. **Mas o SINAPI publica
pintura de piso**, e o contraste é forte:

| Composição SINAPI | RUP total |
|---|---|
| **102491** — pintura de piso, 2 demãos, **aplicação manual** | **≈ 0,390 Hh/m²** |
| **102804** — pintura de piso, 2 demãos, **aplicação mecânica** | **≈ 0,132 Hh/m²** |

Três vezes melhor com aplicação mecânica, em fonte oficial brasileira. É argumento de investimento
em equipamento com lastro, não achismo.

⚠️ **E um número do produto que precisa de fonte.**
`TCPO_RUP_PADRAO = 0.45` ([planoExecucao.ts:12](../src/features/planejamento/utils/planoExecucao.ts))
é descrito como "RUP referência de mercado (TCPO) para piso/pintura industrial" e dispara alerta
amarelo *"RUP real acima do TCPO"*. É **uma constante só para todos os serviços** — retirada de piso
epóxi, faixa de 10 cm e pintura de vaga têm RUPs completamente diferentes —, sem composição citada.
É o mesmo padrão das tarifas inventadas que a auditoria do Gestão 360 corrigiu. As duas composições
acima são o substituto.

### Outras métricas de mão de obra

| Métrica | Fórmula | Tem hoje? | Referência |
|---|---|---|---|
| Absenteísmo | horas de ausência ÷ horas previstas | ⚠️ | 🔴 **sem faixa publicada para a construção brasileira** |
| Rotatividade | método dos mínimos sobre o estoque médio | ❌ | 🟢 Construção 2012: **114% global, 86% descontada** — [DIEESE (2014), base RAIS/MTE](https://www.dieese.org.br/livro/2014/rotatividadeSetorial.pdf) |
| Horas extras % da folha | R$ de HE ÷ folha total | ⚠️ | 🔴 sem benchmark setorial publicado |
| Encargos (grupos A/B/C/D) | estrutura oficial | ✅ | 🟢 [SINAPI/Caixa](http://www1.caixa.gov.br/gov/gov_social/municipal/programa_des_urbano/SINAPI/apresentacao_encargos.asp) — ⚠️ os percentuais mudam **por UF e por data-base**; não crave "110%" |

⚠️ **Absenteísmo cai quando o encarregado deixa de apontar falta.** Se despencar sem intervenção,
suspeite do apontamento, não comemore.

⚠️ **Não existe fórmula única de turnover.** A de RH e a do DIEESE dão números muito diferentes para
a mesma empresa. Comparar o seu com os 114% sem usar o mesmo método é comparação inválida.

---

## 3 · Planejamento / LPS — o único com benchmark nacional publicado

| Métrica | Fórmula | Tem hoje? |
|---|---|---|
| **PPC** | pacotes 100% concluídos ÷ planejados (sem crédito parcial) | ✅ |
| **CNC** — causas de não cumprimento | frequência por categoria fechada | ✅ |
| **IRR** — remoção de restrições | removidas ÷ identificadas | ✅ |
| **TA / TPE** — antecipação e prontidão | ver ressalva | ❌ |

**O benchmark brasileiro publicado é PPC ≈ 70%** — 70,40% de média em **133 obras**, projeto
SISIND-NET/NORIE-UFRGS ([Bortolazza & Formoso, IGLC-14, 2006](https://iglc.net/Papers/Details/415)).
A melhor empresa da amostra fez 80,3%, máximo 93%. No Chile, obras com lookahead formal fizeram 80%
contra 63% das que só tinham LPS básico ([Alarcón et al., IGLC-13](https://leanconstruction.org.uk/wp-content/uploads/2018/10/Alarcon-et-al.-2005-Assessing-the-Impacts-of-Implementing-Lean-Construction.pdf)).

🔴 **"PPC acima de 80% é bom" é folclore** — não localizei entidade nem estudo que estabeleça isso.
Use *"70% é a média nacional publicada; 80% é o que obras com lookahead formal atingem"*.

**Dois achados que mudam conversa de reunião:**

1. **≈70% das causas de atraso são internas.** Clima nunca passou de 14,2% nas 105 obras medidas.
   *"Foi a chuva"* quase nunca é a explicação — e é exatamente por isso que as horas paradas por
   motivo (§1) valem tanto.
2. **Conforme seu PPC sobe, o subempreiteiro vira seu teto.** No Chile, em obras com PPC > 65%,
   atraso de sub virou 24% das causas, o dobro da segunda.

⚠️ **TA tem duas fórmulas publicadas com sinais opostos** — Ballard conta tarefas *não* antecipadas
(menor é melhor); Hamzeh conta as antecipadas (maior é melhor). Se implementarmos, a fórmula vai no
rodapé do relatório.

---

## 4 · Torre de Controle / EVM — onde o produto mais engana

| Métrica | Tem hoje? |
|---|---|
| CPI / SPI · EAC / ETC / VAC | ✅ |
| **TCPI** — a eficiência necessária no resto da obra | ❌ |
| **SPI(t)** — Earned Schedule | ❌ |

Três fatos publicados que valem mais que o módulo inteiro:

**1. O SPI converge para 1,00 no fim, obra atrasada ou não.** É matemático: PV e EV terminam ambos
no BAC. Lipke: *"o projeto terminou atrasado, e os indicadores dizem que o desempenho de prazo foi…
perfeito"* ([Earned Schedule](https://www.earnedschedule.com/Docs/Earned%20Schedule%20-%20schedule%20performance%20analysis%20from%20EVM%20measures.pdf)).
Os indicadores de prazo do EVM **se rompem no último terço**. O substituto é o SPI(t), que dá atraso
**em dias**.

**2. SPI > 1 pode significar obra atrasada** — a equipe faz o que está liberado, não o que trava a
entrega. Rotina em manutenção predial.

**3. O CPI congela em 20–30% de obra** e depois só piora ([Lukas, AACE 2008](https://leanconstruction.org/wp-content/uploads/2022/09/LukasPaper_Earned-Value-Analysis_EVM-1.pdf)).
Com 25% de obra e CPI 0,80, o melhor cenário final é ~0,88 — **estouro mínimo de 13,6%**. Isso é
argumento de aditivo, não de "vamos apertar".

⚠️ **O erro mais caro do controle de obras: medir avanço por dinheiro gasto.** Se
`avanço = AC ÷ orçamento` (método *Level of Effort*), então `EV = AC` por construção, logo
**CPI = 1,00 sempre**, e o EVM perde a capacidade de detectar estouro. Lukas mostra a obra que gastou
R$ 35 dos R$ 50 planejados — parecia economia de R$ 15, e estava com SPI 0,60 e CPI 0,86.

---

## 5 · Financeiro

**O que faz sentido por obra e o que não faz:**

| Por obra ✅ | Só da empresa ❌ |
|---|---|
| fluxo projetado × realizado · medição executada × faturada · saldo a faturar · **margem de contribuição** | NCG · ciclo financeiro (PMR/PME/PMP) · endividamento · **EBITDA** |

⚠️ **"EBITDA por obra" é fabricado pelo critério de rateio** — quem quer mostrar obra boa rateia por
m², quem quer o contrário rateia por faturamento. Use margem de contribuição por obra.

⚠️ **O indicador que mais esconde dinheiro em construtora média:** executou → não mediu → não
faturou → não recebeu. **São três buracos distintos e o painel geralmente mostra um só.**

### Números publicados que podem entrar no produto (com a citação junto)

| Constante | Valor | Fonte |
|---|---|---|
| BDI — Construção de Edifícios | 20,34% / 22,12% / 25,00% (Q1/médio/Q3) | Acórdão 2622/2013-TCU-Plenário |
| Administração local (% do custo direto) | 3,49% / 6,23% / 8,87% | idem |
| Precisão do orçamento por fase | ±30% / ±20% / ±10% / ±5% | [OT-IBR 004/2012](https://www.ibraop.org.br/wp-content/uploads/2013/04/OT_IBR0042012.pdf) |
| Obras públicas BR com aditivo de custo | **61,89%**, média +14,86%, mediana +13,87% | Alvarenga et al. (2021), *Ambiente Construído*, n=2.178 |
| Limite legal de aditivo | 25% (**50% para acréscimo em reforma**) | Lei 14.133/2021, art. 125 |
| Garantia contratual | até 5% (10% justificado) | Lei 14.133/2021, art. 96 e 98 |
| Perdas medianas de material | concreto 9% · aço 11% · blocos 13% · cerâmica 14% | EPUSP/FINEP/ITQC (1998), n=69 canteiros |

⚠️ **O TCU não publica média de aditivos — publica o limite legal.** Quem cita "média do TCU" está
errado. E o Acórdão 2622 **não tem categoria de reforma nem de manutenção predial**: aplicar a faixa
de "Construção de Edifícios" a um contrato de manutenção é analogia defensável, mas é analogia.

---

## 6 · Suprimentos

O **three-way match** (pedido × nota × recebimento) já é o achado mais defensável do produto: pega
pagamento duplicado, sobrepreço contra o pedido, item faturado e não entregue.

⚠️ Mas ele **não pega** o que mais dói: preço combinado alto desde o pedido. E match limpo em 99%
costuma significar que alguém lança o recebimento **a partir da nota**, não da conferência física.

### Sobre "savings" — a métrica mais fraudável de compras

É a única métrica corporativa em que **o avaliado escolhe o denominador**. Cinco formas de
fabricá-la, todas honestas por dentro:

1. **baseline inventada** — a primeira cotação nunca foi o preço de mercado, foi a âncora;
2. **custo evitado vestido de economia** — negociar um reajuste de 12% para 6% **aumenta** o caixa
   em 6%;
3. **mudança de escopo** — comprou especificação mais barata e chamou de negociação;
4. **erosão na fatura** — o preço negociado é R$ 85, a nota chega a R$ 91 com frete e reajuste;
5. **anualização** de contrato que durou quatro meses.

A disciplina que resolve: separar *realized* / *recurring* / *cost avoidance*, validar **na nota
fiscal**, e **cortar o orçamento da área quando o saving for reconhecido** — se o orçamento não cai,
o saving não existiu.

**Faltam no produto:** OTIF medido contra a data **originalmente requisitada** (não a que o
fornecedor reconfirmou três vezes), lead time quebrado em **requisição→pedido** e **pedido→entrega**
(medir só do pedido joga toda a culpa no fornecedor e esconde os dias parados na aprovação interna),
e % de compra emergencial medido em **número de pedidos**, não só em valor.

---

## 7 · Administração da qualidade

### Uma correção de rota, antes de tudo

**PBQP-H/SiAC e NBR 15575 provavelmente não servem para a Compizzo.** O SiAC é passaporte de
**crédito habitacional** (Caixa, BB, MCMV); se o cliente é indústria privada pagando com caixa
próprio, ele não abre porta nenhuma. E a NBR 15575 **exclui explicitamente reforma, retrofit e
edificação concluída antes da vigência**.

### O que serve — e é onde há vantagem competitiva

| Norma | Para quê |
|---|---|
| **PETROBRAS N-13** | norma-mãe de pintura industrial no Brasil; exige inspetor certificado conforme **ABNT NBR 15218** ([PDF público, ABRACO](https://abraco.org.br/src/uploads/2020/05/N-13-REV.-K.pdf)) |
| **SSPC-PA 2 (AMPP)** | conformidade de espessura seca (DFT), regra 80/20, avaliação **estatística por área** — [versão oficial em português](https://content.ampp.org/standards/book/290/Procedimento-para-Determinar-a-Conformidade-com-os) |
| **ISO 8501-1** | graus de limpeza de superfície (Sa 2½ etc.) |
| **NR-26 + ABNT NBR 7195** | base normativa da **demarcação de piso** |
| **NBR 5674 · 14037 · 17170** | manutenção predial e prazos de garantia |

**A oportunidade concreta:** um checklist numérico de pintura industrial (grau de limpeza,
rugosidade, umidade, ponto de orvalho, DFT, aderência) gera **séries numéricas contínuas** que a
maioria dos softwares de construção não sabe tratar. O sistema calcularia média, desvio e % fora da
faixa 80/120 da PA 2. Isso é diferenciação de produto, não commodity.

### As métricas de qualidade

O módulo Qualidade já tem FVS, Não Conformidade, taxa de conformidade e histórico. Faltam os dois
que, **publicados juntos**, são difíceis de manipular:

| Métrica | Fórmula | Tem hoje? | Como engana |
|---|---|---|---|
| **FPY** — aprovação na primeira inspeção | aprovados sem reinspeção ÷ inspecionados | ❌ | Se o app deixa **editar** a FVS reprovada, todo serviço vira "aprovado na primeira". A regra de bloqueio de edição define o valor do indicador |
| **Cobertura de inspeção** | realizadas ÷ previstas no plano | ❌ | Sem ela, **reduzir inspeção "melhora" a qualidade** |
| Índice de não conformidade | 100 − (aprovados ÷ verificados) | ✅ | O denominador é o que você inspecionou, não o que existe |
| **Eficácia de ação corretiva** | NCs sem reincidência ÷ NCs tratadas | ❌ | Só funciona com **taxonomia fechada de causa**. Texto livre destrói a métrica: a mesma falha vira cinco descrições e nunca "reincide" |

⚠️ **90% dos sistemas registram correção e chamam de ação corretiva.** "Refez a demão" é correção
(ISO 9001 8.7); ação corretiva (10.2) é analisar a causa e impedir a recorrência. Aí a NC volta, e o
indicador de eficácia é o único que denuncia.

### Segurança — não existe no produto

**TF = (acidentes × 10⁶) ÷ HHT** e **TG = [(dias perdidos + dias debitados) × 10⁶] ÷ HHT**, conforme
**ABNT NBR 14280** (morte = 6.000 dias debitados).

⚠️ Três armadilhas: a base brasileira é 10⁶ e a americana é 200.000 — comparar sem converter erra
por 5×; **o HHT vem do RDO, e se o efetivo é estimado a taxa é decorativa**; e uma fatalidade injeta
6.000 dias e domina a série por anos.

⚠️ E um mito a não repetir: a **pirâmide de Bird (600:30:10:1)** é hoje amplamente criticada — as
razões variam enormemente por setor, e há evidência de que ela superestima a relação entre
quase-acidentes e fatalidades. Quase-acidente é **insumo de investigação**, não preditor aritmético.

### O custo do retrabalho — a contradição que você precisa conhecer

A literatura de percepção aponta 5–12% do custo da obra. Mas [Love (JCEM, 2026)](https://ascelibrary.org/doi/10.1061/JCEMD4.COENG-17026)
mediu custos **reais** e achou **0,38%** (pré-conclusão) e **0,76%** com correções pós-obra — com
subnotificação de **300%** pelos próprios gestores da qualidade. A tabela consolidada em português
está em [Mello, Bandeira & Brandalise (2018), *Gestão & Produção*](https://www.scielo.br/j/gp/a/8mRPj8fRy7C6qzYQxCQnRqd/?lang=pt).

Nenhum dos dois é o número do seu negócio. E há um efeito perverso: **quando a captura melhora, o
indicador "piora"** — e alguém vai querer punir isso.

---

## 8 · A fronteira: o que software não mede

| O que | Por quê |
|---|---|
| **Custo real do retrabalho** | Retrabalho feito no mesmo dia, pelo mesmo oficial, sem apontamento separado, **não existe no sistema**. Exige apropriação por centro de custo de retrabalho — mudança cultural, não funcionalidade |
| **Causa-raiz** | O sistema registra a causa que alguém escolheu na lista. Sem 5-Porquês de verdade, vira "falha humana" em 80% dos casos |
| **Eficácia da ação corretiva** | Precisa de verificação posterior por pessoa. O software agenda e cobra; não julga se funcionou |
| **Severidade da NC** | "Trinca no revestimento" pode ser cosmética ou estrutural. É julgamento técnico |
| **Calibração de instrumento** | O software controla o vencimento do certificado. Se o medidor está descalibrado dentro do prazo, toda a série de DFT é lixo — e o gráfico sai bonito |
| **NPS com significado** | Com 12 respostas, NPS não é métrica: é anedota com casa decimal |

---

## 9 · 🔴 O que NÃO tem referência publicada

**Nada desta lista pode virar constante dentro do código.**

Absenteísmo na construção brasileira · horas extras como % da folha · % de retrabalho aceitável ·
margem e EBITDA por obra · inadimplência B2B de construtora · concentração por fornecedor · taxa de
sucesso de pleitos · % de glosa aceitável · lead time e giro de estoque na construção · NC/m², FPY e
taxa de reincidência (benchmark brasileiro) · NPS de construção no Brasil · faixas de IRR, TA e TMR ·
**RUP de pintura industrial, demarcação de piso e manutenção predial**.

E três números que circulam com atribuição que não se sustenta:

- **"PPC acima de 80% é bom"** — sem fonte;
- **"pós-obra = até 5% do VGV, 25% em alto padrão"**, atribuído à CBIC — só encontrei citações
  secundárias em sites comerciais, nunca o estudo primário;
- **"R$ 1 em prevenção economiza R$ 4 em falhas"** — regra de bolso repetida, sem estudo rastreável.

---

## 10 · Se fosse escolher três coisas

1. **Horas paradas por motivo no RDO.** ✅ *Entregue em set/2026.* Transforma o CNC do LPS em horas
   e em reais, é diário, e é a ponte que não existia entre planejamento e produtividade.
2. **RUP por serviço e por tipologia de superfície.** Você não tem benchmark externo para pintura
   industrial — por isso medir desde já vale mais para você do que qualquer tabela publicada.
3. **FPY + cobertura de inspeção, publicados juntos.** Subir o FPY afrouxando o critério não engana
   ninguém; subir inspecionando menos aparece na hora na cobertura.

---

## Fontes

**Produtividade e Lean**
[CBIC/Souza (2017) — Manual Básico de Indicadores de Produtividade](https://cbic.org.br/wp-content/uploads/2017/11/Manual_Basico_de_Indicadores_de_Produtividade_na_Construcao_Civil_2017.pdf) ·
[Bortolazza & Formoso (2006), IGLC-14](https://iglc.net/Papers/Details/415) ·
[Alarcón et al. (2005), IGLC-13](https://leanconstruction.org.uk/wp-content/uploads/2018/10/Alarcon-et-al.-2005-Assessing-the-Impacts-of-Implementing-Lean-Construction.pdf) ·
[Ballard & Tommelein (2016), P2SL/Berkeley](https://p2sl.berkeley.edu/wp-content/uploads/2016/10/Ballard_Tommelein-2016-Current-Process-Benchmark-for-the-Last-Planner-System.pdf)

**EVM e prazo**
[Lukas (2008), AACE — Earned Value Analysis: Why it Doesn't Work](https://leanconstruction.org/wp-content/uploads/2022/09/LukasPaper_Earned-Value-Analysis_EVM-1.pdf) ·
[Lipke — Earned Schedule](https://www.earnedschedule.com/Docs/Earned%20Schedule%20-%20schedule%20performance%20analysis%20from%20EVM%20measures.pdf)

**Custo, contrato e mão de obra**
[OT-IBR 004/2012, IBRAOP](https://www.ibraop.org.br/wp-content/uploads/2013/04/OT_IBR0042012.pdf) ·
[Acórdão 2622/2013-TCU-Plenário](https://www.editais.uff.br/sites/default/files/arquivos/Base%20BDI%20-%20Ac%C3%B3rd%C3%A3o-2622-2013.pdf) ·
[Alvarenga et al. (2021), Ambiente Construído](http://www.scielo.br/j/ac/a/h3sVmzBJkSB9rQx8WGdhqBM/?lang=pt) ·
[DIEESE (2014) — Rotatividade setorial](https://www.dieese.org.br/livro/2014/rotatividadeSetorial.pdf) ·
[EPUSP/FINEP/ITQC — Perdas de materiais: a quebra do mito](https://www.sorocaba.unesp.br/Home/Graduacao/EngenhariaAmbiental/SandroD.Mancini/Perdas_na_Construcao_Civil.pdf) ·
[Caixa — Encargos Sociais SINAPI](http://www1.caixa.gov.br/gov/gov_social/municipal/programa_des_urbano/SINAPI/apresentacao_encargos.asp)

**Qualidade, pintura industrial e segurança**
[PETROBRAS N-13 (ABRACO)](https://abraco.org.br/src/uploads/2020/05/N-13-REV.-K.pdf) ·
[SSPC-PA 2, em português (AMPP)](https://content.ampp.org/standards/book/290/Procedimento-para-Determinar-a-Conformidade-com-os) ·
[Love (2026), JCEM — Quantifying the Costs of Field Rework](https://ascelibrary.org/doi/10.1061/JCEMD4.COENG-17026) ·
[Mello, Bandeira & Brandalise (2018), Gestão & Produção](https://www.scielo.br/j/gp/a/8mRPj8fRy7C6qzYQxCQnRqd/?lang=pt) ·
[NR-18 atualizada 2025 (MTE)](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-18-atualizada-2025-1.pdf) ·
[SmartLab / Observatório SST (MPT + OIT)](https://smartlab.mpt.mp.br/)

**Clima e pleito**
[Golbert & L'Astorina (2011), XIV SINAOP/IBRAOP](http://www.ibraop.org.br/acervo/XIV_sinaop/docs/FernandoGolbert.pdf)
