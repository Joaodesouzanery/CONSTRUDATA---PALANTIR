# CONSTRUDATA — LinkedIn Posts

10 posts for LinkedIn covering platform features and institutional story.

---

## Post 1 — Platform Overview (Institutional)

**Title:** Construímos o "Palantir" da Construção Civil Brasileira

---

Há 2 anos, toda vez que entrava em uma reunião de obra, a mesma cena se repetia: planilha no Excel, PDF do cronograma, grupo de WhatsApp com fotos do campo, nota fiscal escaneada em papel. Cada dado em um lugar diferente, nenhum dado conversando com o outro.

Decidimos mudar isso.

Apresento o **CONSTRUDATA** — uma plataforma integrada de gestão de obras que reúne BIM 3D/4D/5D, mapa interativo de redes, planejamento Lean, controle de suprimentos com Three-Way Match, folha de pagamento, e análise de atrasos em uma única interface.

16 módulos. Uma fonte da verdade. Zero planilha paralela.

A ideia não é substituir o engenheiro — é dar a ele a visibilidade que ele merece para tomar decisões rápidas e baseadas em dados reais.

Se você é gestor de obras, diretor de construtora, ou engenheiro de planejamento e quer conhecer o projeto, manda mensagem.

**#ConstruteCivil #BIM #GestãoDeObras #inovação #EngenhariaCivil #AEC #Construtech**

---

## Post 2 — Platform Overview (Technical)

**Title:** Por que construímos 16 módulos integrados em vez de usar 16 sistemas separados?

---

Quando falamos com gestores de obras, descobrimos que uma empresa média de médio porte usa:

— MS Project para cronograma
— Excel para folha de pagamento
— SAP (ou ERP genérico) para suprimentos
— AutoCAD/Revit para projetos
— WhatsApp para comunicação de campo
— Google Sheets para RDO
— Mais 3-4 sistemas de nicho

O resultado? **Cada sistema tem dados diferentes. Nenhum dado é confiável.** E o gestor passa 40% do tempo reconciliando informações entre sistemas.

No CONSTRUDATA, cada módulo compartilha o mesmo estado: quando você registra um atraso na Simulação de Atrasos (Gestão 360), o Gantt do Planejamento atualiza. Quando você importa pontos UTM no Mapa Interativo, a elevação aparece no perfil 3D automaticamente.

Construímos com React, Zustand, Three.js e Leaflet. Sem banco de dados externo para o MVP — tudo na memória do browser com exportação local. Isso reduz o custo de deploy a praticamente zero.

Integração não é luxo. É a única forma de ter dados que você pode confiar.

**#Construtech #SoftwareDeEngenharia #BIM #React #Inovação #DigitalTransformation**

---

## Post 3 — Feature: BIM 4D Simulation

**Title:** Você já "caminhou" pela sua obra antes de ela começar?

---

BIM 4D significa adicionar o tempo ao modelo 3D. Na prática: você move um slider de data, e os andares do edifício aparecem na tela conforme o cronograma prevê que serão construídos.

No módulo de Projetos do CONSTRUDATA, implementamos isso com Three.js diretamente no browser. Nenhum plugin, nenhum Navisworks, nenhuma licença cara.

**O que isso resolve na prática:**

1. **Revisão de sequência construtiva** — identificar conflitos de acesso entre frentes de trabalho antes da mobilização
2. **Apresentação para cliente** — mostrar "veja como o seu prédio vai crescer" em uma reunião de aprovação
3. **Treinamento de equipe** — novos engenheiros entendem a lógica construtiva em minutos
4. **Detecção de pico de mão de obra** — ver graficamente onde múltiplas frentes se sobrepõem

O mesmo modelo 3D serve para o BIM 5D: cada elemento ganha uma cor proporcional ao seu custo unitário. Vermelho = caro. Verde = barato. O heatmap de custo revela instantaneamente onde está o dinheiro da obra.

BIM acessível não é mais utopia. É decisão de arquitetura de software.

**#BIM4D #BIM5D #ConstruçãoCivil #Inovação #ThreeJS #Construtech**

---

## Post 4 — Feature: UTM Import + Mapa Interativo

**Title:** 39 pontos topográficos importados, rede de esgoto desenhada, perfil de elevação calculado. Em 30 segundos.

---

Um engenheiro de saneamento me enviou um arquivo `.txt` com 39 pontos de levantamento topográfico. Cada linha era algo assim:

```
358129.1978,7353581.4981,-0.8630
358145.2341,7353602.1124,-1.2100
```

Coordenadas UTM. Easting, northing, elevação. Sem cabeçalho.

No sistema antigo dele: abrir QGIS, importar, projetar para WGS84, exportar como GeoJSON, colar em outro sistema, desenhar a rede manualmente. 2 horas de trabalho.

No CONSTRUDATA:
1. Clicar em "Importar" no Mapa Interativo
2. Selecionar o arquivo
3. O sistema detecta automaticamente que são coordenadas UTM (porque os valores excedem o range de lat/lng)
4. Confirmar zona (24S, padrão para SP/MG/RJ) e hemisfério
5. Marcar "Conectar como sequência de trechos"
6. Clicar Importar

Resultado: 39 nós aparecem no mapa nas posições corretas. 38 trechos de esgoto conectados em sequência. Perfil de elevação SVG gerado automaticamente na aba "Análise 3D/4D/5D".

A conversão usa a aproximação de Karney para UTM→WGS84 — precisa a ~1cm para coordenadas brasileiras.

O que antes levava 2 horas agora leva 30 segundos.

**#TopografiaDigital #SaneamentoBásico #UTM #GIS #Construtech #EngenhariaCivil**

---

## Post 5 — Feature: Simulação de Atrasos

**Title:** "Se o PVC atrasar 3 dias, o que acontece com a obra?" — Agora você responde em tempo real.

---

Essa pergunta é feita em toda reunião de obra. E na maioria das vezes, a resposta é: "Deixa eu refazer o cronograma no MS Project e te mando amanhã."

No módulo **Simulação de Atrasos** do CONSTRUDATA (dentro do Gestão 360), a resposta é imediata.

**Como funciona:**

Você seleciona o trecho afetado (ex: "TR-04 — Assentamento de PVC DN200"), digita quantos dias de atraso, e clica em adicionar. O sistema:

1. Executa o algoritmo CPM duas vezes — uma vez sem atraso (base) e uma vez com o atraso configurado
2. Calcula a diferença: quantos dias o projeto vai atrasar, qual o impacto financeiro estimado (R$)
3. Mostra um Gantt comparativo SVG: barras cinzas (plano base) vs. barras laranjas (com atraso)

Você pode empilhar múltiplos atrasos — "e se o concreto atrasar 2 dias E a escavação atrasar 5 dias?" — e ver o impacto acumulado em tempo real.

Esse tipo de análise é especialmente crítico quando há **cláusula de multa por atraso** no contrato. Com dados na mão, a negociação com o fornecedor é diferente.

**#GestãoDeObras #PlanejamentoDeCronograma #CPM #Construtech #Inovação**

---

## Post 6 — Feature: Three-Way Match (Suprimentos)

**Title:** Você já pagou uma nota fiscal de material que não chegou? O Three-Way Match evita isso.

---

No módulo de Suprimentos do CONSTRUDATA, implementamos o **Three-Way Match** — uma prática padrão de grandes ERPs (SAP, Oracle) que raramente existe em construtoras menores.

**O que é:**
Antes de aprovar o pagamento de uma nota fiscal, o sistema verifica automaticamente três documentos:

1. **PO (Pedido de Compra)** — o que foi pedido e ao que preço
2. **GRN (Recibo de Entrega)** — o que efetivamente chegou no canteiro
3. **NF (Nota Fiscal)** — o que o fornecedor está cobrando

Se o que chegou é diferente do que foi pedido, ou se o preço cobrado é diferente do PO, o sistema gera um alerta automático de discrepância:

🟡 *"Item Areia Fina: PO 50t / GRN 48t / NF 50t — Variação de quantidade detectada"*

Isso parece óbvio. Mas sem o sistema, essa conferência é feita à mão, comparando três PDFs. Na pressa da obra, ela muitas vezes não é feita.

Resultado médio em empresas que implementam Three-Way Match: **3-5% de redução nos custos de materiais** por prevenção de pagamentos indevidos.

**#Suprimentos #ThreeWayMatch #GestãoDeCustos #Construtech #FinançasDaObra**

---

## Post 7 — Feature: LPS / Last Planner System

**Title:** Por que o PPC (Percent Plan Complete) é o indicador mais importante da sua obra — e você provavelmente não está medindo.

---

O **PPC** mede a porcentagem dos compromissos semanais que foram de fato cumpridos. Se a equipe se comprometeu a concretar 3 pilares esta semana e concretou 2, o PPC é 67%.

Parece simples. E é. Mas as implicações são profundas.

Um PPC consistentemente abaixo de 70% é um preditor confiável de atrasos futuros — geralmente 4-6 semanas antes que o atraso apareça no cronograma oficial. Porque o que está falhando não é a execução em si, mas o planejamento de curto prazo: faltou material, faltou desenho aprovado, o equipamento não estava disponível.

No módulo **LPS / Lean** do CONSTRUDATA:

- O **LookAhead** de 6 semanas torna visíveis os comprometimentos futuros e as restrições que os bloqueiam
- O **Registro de Restrições** registra cada obstáculo com responsável e prazo de resolução
- O gráfico de **PPC semanal** mostra a tendência das últimas 12 semanas com análise de causa raiz das falhas

Empresas que adotam LPS reportam melhora de 15-25% no PPC em 3 meses — o que se traduz diretamente em prazo e custo.

**#LastPlannerSystem #Lean #PPC #GestãoDeObras #Construtech #EngenhariaLean**

---

## Post 8 — Feature: Perfil 3D de Elevação (Mapa Interativo)

**Title:** Visualizar o perfil de elevação de uma rede de esgoto em 30 segundos — sem AutoCAD

---

No saneamento básico, o perfil longitudinal de uma rede coletora é um dos documentos mais críticos do projeto. Ele mostra a variação de cota entre os poços de visita, a profundidade de escavação em cada ponto, e a viabilidade da solução por gravidade.

Tradicionalmente, esse perfil é gerado no AutoCAD ou no Civil 3D a partir de pontos topográficos. Processo que demanda horas de trabalho especializado.

No **CONSTRUDATA Mapa Interativo**, depois de importar um arquivo de pontos topográficos UTM, você clica em "Análise 3D/4D/5D" e imediatamente vê:

- Perfil SVG com eixo X = distância acumulada ao longo da rede (km)
- Eixo Y = elevação (m)
- Pontos de cota conectados por linha com área preenchida
- KPIs: elevação mínima, máxima, média, e comprimento total da rede

O sistema segue automaticamente a topologia da rede (qual poço conecta a qual) para desenhar o perfil na sequência correta.

Não substitui o projeto executivo. Mas dá uma visão instantânea de viabilidade que antes levava horas.

Menos tempo no AutoCAD. Mais tempo na tomada de decisão.

**#SaneamentoBásico #PerfilLongitudinal #TopografiaDigital #Construtech #EngenhariaCivil**

---

## Post 9 — Institutional Story

**Title:** O momento em que percebi que a construção civil precisava de uma plataforma diferente

---

Estava em uma visita técnica a uma obra de drenagem urbana em uma cidade do interior de SP. O engenheiro responsável — com 20 anos de experiência, extremamente competente — carregava uma prancheta com um cronograma impresso na semana anterior.

O cronograma estava desatualizado. Ele sabia disso. "A gente atualiza no final do mês", disse ele.

Perguntei sobre o custo da atividade que estavam executando naquele dia. Ele estimou. "Mas o exato eu não sei, precisa ver com o pessoal do escritório."

Perguntei se eles tinham dados de elevação dos pontos topográficos. "Tem, no laptop do topógrafo, em Excel."

Três perguntas básicas. Três fontes diferentes. Nenhuma resposta imediata.

Esse não é um problema de competência. É um problema de ferramentas. As ferramentas que existem foram construídas por engenheiros de software que nunca pisaram em uma obra. São complexas demais, caras demais, e não se comunicam entre si.

O CONSTRUDATA nasceu da crença de que o engenheiro de campo merece a mesma qualidade de informação que um analista de investimentos tem na Bloomberg. Em tempo real. No campo. No bolso.

Ainda estamos construindo. Mas já conseguimos dar uma resposta.

**#Construtech #Inovação #EngenhariaCivil #Infraestrutura #GestãoDeObras #PropTech**

---

## Post 10 — Institutional / Call to Action

**Title:** Para os engenheiros que estão cansados de gestão de obras no WhatsApp

---

Se você reconhece alguma dessas situações, este post é para você:

✅ Você tem um grupo de WhatsApp "OBRA XYZ" com 47 mensagens por dia, e ninguém sabe o que foi decidido na semana passada

✅ Seu cronograma está em um Excel compartilhado que 3 pessoas editam simultaneamente e ninguém sabe qual versão é a atual

✅ Você já chegou em uma reunião de medição com o cliente sem saber o custo real do que foi executado

✅ Você já pagou uma nota fiscal e ficou em dúvida se o material tinha chegado mesmo

✅ Você já ouviu "o cronograma está ok" numa segunda-feira e na sexta-feira soube que a entrega vai atrasar 30 dias

Construímos o CONSTRUDATA exatamente para esses problemas. Não é um ERP genérico adaptado para obras. É uma plataforma construída do zero para a realidade do canteiro brasileiro.

16 módulos integrados. Interface dark-mode pensada para uso no campo. Import de arquivos UTM de instrumentos topográficos. BIM 3D/4D/5D que roda no browser sem instalação.

Se você quer conhecer, testar, ou discutir como o sistema pode se encaixar na sua operação — manda uma mensagem direta. Vamos conversar.

**#Construtech #GestãoDeObras #Engenharia #Inovação #SaúdeFinanceiraDaObra #BIM**

---

*CONSTRUDATA — Palantir for Construction*
*contato@construdata.com.br*
