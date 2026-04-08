# Atlântico — Estratégia & Organização da Empresa

> **Status:** documento vivo — revisar semanalmente
> **Atualizado em:** 2026-04-08
> **Meta imediata:** **10 obras assinadas até a próxima semana**
>
> Este documento é a **estratégia única** para construir, vender, entregar e operar a Atlântico. Todo o resto (`linkedin-posts.md`, `database-architecture.md`, `audit-planejamento-qualidade.md`) é tático e deriva daqui.

---

## Sumário

1. [Resumo executivo](#1-resumo-executivo)
2. [As duas plataformas](#2-as-duas-plataformas)
3. [Marketing — pipeline LinkedIn 3x/dia](#3-marketing--pipeline-linkedin-3xdia)
4. [Frentes paralelas](#4-frentes-paralelas)
5. [Argumentário de venda](#5-argumentário-de-venda)
6. [Materiais padronizados](#6-materiais-padronizados)
7. [Onboarding do cliente em 4 semanas](#7-onboarding-do-cliente-em-4-semanas)
8. [Onboarding por perfil/role](#8-onboarding-por-perfilrole)
9. [Governança e segurança de dados](#9-governança-e-segurança-de-dados)
10. [Prevenção de churn e feedback](#10-prevenção-de-churn-e-feedback)
11. [Integração entre módulos e Ontologia](#11-integração-entre-módulos-e-ontologia)
12. [6 pilares de confiança](#12-6-pilares-de-confiança)
13. [Revisão dos módulos Palantir-like](#13-revisão-dos-módulos-palantir-like)
14. [Proposta comercial](#14-proposta-comercial)
15. [Decisões abertas](#15-decisões-abertas)

---

## 1) Resumo executivo

**O que é:** Atlântico é uma plataforma de inteligência operacional para construção e saneamento, **inspirada na Palantir**: não armazena dados, **transforma dados em decisões acionáveis**.

**Como ganhamos dinheiro:** dois produtos paralelos.

| # | Produto | O que vende | Faixa de preço |
|---|---|---|---|
| 1 | **Atlântico Gestão** (SaaS) | Acesso à plataforma + suporte + consultoria contínua | R$ 8.500 a R$ 12.000 / mês por obra |
| 2 | **Atlântico Serviços + Empreita** | Execução de obra (empreita) usando a plataforma como diferencial | a definir por escopo |

**Meta imediata (próxima semana):** 10 obras assinadas no Atlântico Gestão.

**Frentes ativas em paralelo:**
1. Vendas (cold outreach + LinkedIn + demos)
2. Marketing de conteúdo (3 posts/dia/frente no LinkedIn)
3. HuB de Notícias e Licitações (geração de pipeline)
4. Demo Engeneves (cliente prioritário — fechar essa)
5. Produto (banco de dados + módulos faltando)
6. Operações (onboarding padronizado para entrega após assinatura)

---

## 2) As duas plataformas

### 2.1 Atlântico Gestão (atual, em produção)

**O que é:** plataforma SaaS já no ar, com 19 módulos integrados (RDO, Qualidade, Plan. Mestre, Quantitativos, Suprimentos, Mão de Obra, Equipamentos, Frota, Mapa Interativo, BIM, Torre de Controle, etc.).

**Status hoje:**
- ✅ 100% web, dark mode, responsivo
- ✅ Wizards "Criar do Zero" em Plan. Mestre e Quantitativos
- ✅ Módulo Minha Rotina personalizado por persona
- ✅ Módulo Qualidade com FVS pixel-perfect ao FOR-FVS-02
- ⏳ Banco de dados Supabase (próximo grande passo)
- ⏳ Sistema de aprovação hierárquica (planejado em [database-architecture.md](./database-architecture.md))

**Quem compra:** Gerente de obra, dono de construtora, diretor de engenharia.

### 2.2 Atlântico Serviços + Empreita (a estruturar)

**O que é:** vamos **executar obras** (ou pacotes de serviços) usando a Atlântico Gestão como diferencial técnico. Empreita = vender o serviço pronto, não o software.

**Por que isso importa:**
- Margem por obra é maior do que SaaS recorrente
- Cada empreita vira **case real** (provando que funciona) → vende mais SaaS
- Acelera fechamento porque o cliente não precisa "adotar tecnologia" — só recebe a obra pronta
- Permite testar o produto em escala real

#### 📍 Pergunta respondida: como vender empreita?

Existem 3 modelos clássicos. A escolha depende do tipo de obra e do perfil do cliente:

| Modelo | Como funciona | Quando usar | Risco |
|---|---|---|---|
| **Empreita global (preço fechado)** | Você fecha um valor único pela obra inteira. Lucro = preço − custo real. | Obra com escopo bem definido (saneamento, pavimentação curta, reforma simples) | Alto (você assume estouro de orçamento) |
| **Preço unitário** | Você fecha um valor por unidade (R$/m², R$/m linear, R$/PV instalado). | Obra linear ou repetitiva onde o quantitativo final ainda flutua (rede de água, pavimentação extensa) | Médio (cliente paga o que executou) |
| **Por administração** | Você cobra um % sobre o custo real (geralmente 15-20%) + reembolso de despesas. | Obra complexa, escopo aberto, cliente quer transparência total | Baixo (sem risco de margem, mas margem menor) |

**Recomendação por cenário:**

| Cenário | Modelo | Por quê |
|---|---|---|
| Primeira obra com cliente novo | **Por administração 18%** | Sem risco, margem garantida, mostra transparência |
| Obra de saneamento bem dimensionada | **Preço unitário** | Tabela SINAPI cobre o cálculo, e o cliente tem segurança |
| Obra pequena/reforma | **Empreita global** | Margem maior, fechamento rápido |

**Pacote inicial sugerido (1ª empreita):**
- **Modelo:** por administração 18%
- **Escopo:** obra de saneamento de 1-3 km, ticket entre R$ 200k e R$ 800k
- **Diferencial:** "você vai receber a obra com 100% de rastreabilidade técnica via plataforma — todos os RDOs, FVS, fotos georreferenciadas, baseline planejado vs. executado, consolidados em 1 dashboard que você acessa 24/7"
- **Resultado pro cliente:** ele tem a obra pronta E a auditoria pronta para fiscal/órgão público

**Próximo passo:** estruturar um **catálogo de serviços** que vamos vender via empreita. Mínimo viável:
- Rede de água (DN 50-300mm)
- Rede de esgoto sanitário (DN 100-400mm)
- Drenagem pluvial
- Pavimentação asfáltica (CBUQ)
- Recomposição de pavimento

Cada um com: composição padrão, produtividade média, preço SINAPI atualizado, BDI sugerido, prazo típico por km.

---

## 3) Marketing — pipeline LinkedIn 3x/dia

### Estrutura

**Cadência:** 3 posts por dia, em **3 frentes**:

| Frente | Persona alvo | O que destacar |
|---|---|---|
| **Atlântico Gestão (SaaS)** | Gerente/diretor de construtora | Dores, números, ontologia, integração de módulos |
| **Atlântico Empreita (Serviços)** | Dono de construtora pequena, cliente público, prefeitura | Resultados de obra real, prazos cumpridos, transparência |
| **HuB de Notícias e Licitações** | Construtoras de saneamento que disputam licitações | Insights de mercado, oportunidades, regulação |

**Total:** 9 posts/dia (3 por frente). É muito? **Sim, mas é o necessário para gerar pipeline em <1 semana.** Reduzir para 2/dia/frente se virar inviável.

### Template de produção (cada post)

```
┌─────────────────────────────────────────────┐
│ HOOK (1ª linha — agressiva, gancho de dor) │
│ "Toda obra tem um ritual silencioso às 18h."│
├─────────────────────────────────────────────┤
│ BODY (3-6 parágrafos)                       │
│ • Contexto                                  │
│ • Dor concreta                              │
│ • Solução / insight                         │
│ • Prova (número, caso, dado real)           │
├─────────────────────────────────────────────┤
│ CTA (1 frase + link)                        │
│ "Marque uma demonstração de 20 min: [link]" │
├─────────────────────────────────────────────┤
│ Hashtags (4-5)                              │
│ #construção #engenharia #leanconstruction   │
└─────────────────────────────────────────────┘
```

### Métricas de sucesso (revisar segunda)

| Métrica | O que mede | Meta semanal |
|---|---|---|
| **Impressões** | Quantas pessoas viram | >20k/semana/frente |
| **Engajamento** (likes + comments) | Qualidade do conteúdo | Top post >100 reações |
| **DMs recebidas** | Conversa privada gerada | >5/semana |
| **Calls agendadas** | Conversão real | >2/semana |
| **Obras assinadas** | O que importa | Meta = 10 na próxima |

### 📍 Loop de aprendizado semanal

Toda **segunda-feira de manhã**:

1. Olho os 21 posts da semana anterior (3/dia × 7 dias)
2. Identifico os **3 top performers** (mais reações + DMs)
3. Olho o que eles têm em comum: tema, hook, formato, hora de publicação
4. Mando para o Claude o seguinte prompt:

```
"Esses 3 posts performaram melhor essa semana:
[colar os 3 textos completos]

Eles bateram em [tema X]. Crie 9 posts novos para a próxima semana
seguindo o MESMO padrão de Hook/Body/CTA, mantendo o tema central
mas variando o ângulo. Cada post deve:
- Começar com hook agressivo de 1 linha
- Ter 4-6 parágrafos no body
- Terminar com CTA explícito para [link calendly]
- Ter 4-5 hashtags B2B
- Ser autêntico, sem buzzword vazia
- Mencionar números reais quando possível"
```

5. Recebo os 9 posts, ajusto, agendo na semana
6. Ciclo se repete

**Resultado:** o conteúdo melhora exponencialmente porque cada semana parte do que já funcionou.

### HuB de Notícias — como integrar

O HuB é uma **fonte de munição** para os posts. Toda matéria nova vira:

1. **Post de comentário rápido** ("Saiu hoje no Valor: [matéria]. O que isso significa para construtoras de saneamento? [opinião com 2 parágrafos] [CTA]")
2. **Newsletter semanal** (compilado das 5 matérias mais relevantes — gera autoridade)
3. **DM proativa** para clientes em pipeline ("Vi essa notícia e me lembrei do seu projeto…")

**Próximo passo:** cadeia única do HuB → LinkedIn → Newsletter → DMs. Não fragmentar.

### Posts já prontos

20 posts B2B já estão escritos em [linkedin-posts.md](./linkedin-posts.md), com sugestão de cadência semanal. Use como base nas primeiras 2-3 semanas até o loop de aprendizado começar a render conteúdo próprio.

---

## 4) Frentes paralelas

### 4.1 HuB de Notícias e Licitações
- **Cadência:** verificar diariamente sites de licitação (Comprasnet, ComprasGov, BEC-SP, portais municipais relevantes)
- **Output:** 1 newsletter semanal + DMs proativas para construtoras na sua lista
- **Meta:** virar **a fonte** que pequenas/médias construtoras consultam

### 4.2 Demo Engeneves
**Decidir já:** vídeo gravado OU demo ao vivo?

| Opção | Quando usar | Esforço |
|---|---|---|
| **Vídeo gravado (5-7 min)** | Cliente está com agenda apertada, ou quer mostrar pra equipe | 1 dia para gravar + editar |
| **Demo ao vivo (30 min)** | Cliente quente, decisor presente, espaço para perguntas | 1h por sessão, mas converte mais |

**Recomendação:** **fazer os 2**. Gravar o vídeo essa semana (serve para todos os outros leads), e oferecer demo ao vivo para a Engeneves especificamente.

**Roteiro do vídeo (5-7 min):**
1. (15s) Hook: "Toda obra perde 30% de produtividade procurando informação que já existe"
2. (1 min) Apresentação: "Atlântico — plataforma de inteligência operacional"
3. (4 min) Demo de 4 fluxos:
   - Engenheiro registrando RDO no celular → atualizando curva S em tempo real
   - Gerente vendo Torre de Controle no celular
   - Diretor abrindo Gestão 360 com CPI/SPI
   - Qualidade preenchendo FVS digital → exportando PDF
4. (1 min) Diferencial: "Não é dashboard. É ontologia. Cada dado conversa com todos os outros"
5. (30s) CTA: "Quer ver isso na sua obra? [link calendly]"

### 4.3 Material de apresentação padronizado
Ver seção [6 — Materiais padronizados](#6-materiais-padronizados).

---

## 5) Argumentário de venda

> Esta seção vira a base da **landing page**, da **apresentação comercial** e do **roteiro da demo**.

### 5.1 O que o cliente ganha em eficiência?

> ⚡ **Cada item abaixo deve aparecer com o número EM DESTAQUE na landing.**

| Benefício | Número | Como acontece |
|---|---|---|
| **Redução no tempo de orçamentação** | **80%** | Wizard "Criar Orçamento do Zero" + base SINAPI atualizada + reuso de orçamentos anteriores |
| **Mitigação proativa de multas contratuais** | — | Alertas automáticos de prazo no LPS e Torre de Controle, com 2-3 semanas de antecedência |
| **Redução de perdas por erros de faturamento** | **3 a 5%** | Three-Way Match automático em Suprimentos (PO × GRN × NF) |
| **Antecipação de estouros de orçamento** | em **semanas** | CPI/SPI calculados em tempo real a partir do RDO + Suprimentos + planejamento |
| **Comunicação com stakeholders** | — | Relatório 360 e Torre de Controle no celular, sem reunião |
| **Erros de execução** | — | RDO digital com fotos georreferenciadas, FVS amarrada ao trecho, BIM 4D sobreposto à execução |
| **Otimização de planejamento e acompanhamento** | — | LPS / Last Planner nativo, PPC automático, Constraint Register integrado |

### 5.2 Garantia de fidelidade dos dados

> ⚡ Esta é a principal objeção do cliente desconfiado. Resposta clara, 5 pontos.

1. **Multi-tenant com isolamento físico no banco** (Postgres + RLS) — nenhum cliente vê dados de outro, **garantido pelo banco**, não por código
2. **Validação Zod em todas as entradas** — campo errado = rejeitado antes de entrar no banco
3. **Audit log imutável** — toda ação crítica fica registrada com autor, timestamp e payload. Auditor externo pode pedir o histórico de qualquer FVS dos últimos 5 anos
4. **Workflow de aprovação humana** — edição/exclusão de FVS, RDO antigo, orçamento aprovado, baseline → exigem aprovação de gerente/diretor. Nada importante muda sem 2 pares de olhos
5. **Backup em 7 camadas** — desde localStorage do navegador até backup cifrado semanal off-site (detalhes em [database-architecture.md](./database-architecture.md))

**Mensagem para o cliente:**
> "Os seus dados ficam mais seguros conosco do que nas suas planilhas atuais. Seu Excel pode sumir num crash do Windows. Nosso banco tem 7 camadas de proteção e replicação automática."

### 5.3 Metodologia da plataforma

> ⚡ Diferencial único: **todo mundo tem acesso a código, mas nem todo mundo tem metodologia**.

A Atlântico não é "mais um software de gestão". É uma **metodologia operacional** com 4 conceitos centrais:

1. **Ontologia da Construção** — todos os módulos compartilham 1 só "modelo mental" da obra. RDO conhece o trecho do planejamento, que conhece o item de orçamento, que conhece o BIM. Não tem ETL nem sync — é **uma só base semântica** (igual Palantir Foundry).
2. **Loop de feedback rápido** — o que o engenheiro registra à tarde já está no CPI do diretor antes do café da manhã do dia seguinte. Não tem reunião de status.
3. **Last Planner System nativo** — Lean Construction não é palestra, é o jeito da plataforma planejar. PPC, look-ahead 6 semanas, Constraint Register, Pareto de causas — tudo embutido no fluxo.
4. **Decisão antes de relatório** — a IA Copilot da plataforma cruza dados entre módulos para **gerar a decisão pronta**, não o gráfico. Exemplo: "T07 com SPI 0,71 há 5 dias. Realocar 2 oficiais da T03."

#### 📍 Pergunta respondida: como provar a economia de R$ 200k em obra de R$ 20M?

A frase "se a plataforma evitar 1% do desperdício, gera R$ 200k" só convence quando vira **medição concreta**. Plano:

**Antes da venda — projeção:**
1. Pegue **1 indicador** que o cliente já mede hoje (ex.: % de retrabalho, % de atraso médio, custo por m² de pavimentação)
2. Mostre o número médio do mercado vs. o número dele
3. Diga: **"se você reduzir esse número em 1 ponto percentual, vira R$ X. Nossa plataforma tem case de cliente que reduziu em Y pontos."**
4. Mostre o cálculo no Quantitativos da plataforma (na demo)

**Durante a venda — compromisso:**
> "Vamos colocar a plataforma na sua obra por 90 dias. No fim do trimestre, **eu te entrego um relatório** comparando os 3 KPIs principais antes/depois. Se a economia for menor que o valor da plataforma, eu devolvo."

**Depois da venda — prova:**
- Mês 1: dashboard de baseline (mede onde estava)
- Mês 3: comparação baseline vs. atual + relatório PDF assinado
- Esse PDF vira **case study** para vender as próximas 10 obras

**Por que isso funciona:** você não vende "uma promessa", você vende "uma medição". Cliente compra por menos risco.

### 5.4 9 perguntas irrecusáveis (template copy)

Inspirado em copy clássico (Schwartz, Halbert) — para usar em landing, email frio e apresentação.

1. **Quanto** você gastaria para evitar 1 multa contratual?
2. **Quantas vezes** essa semana sua equipe gastou tempo procurando uma planilha antiga?
3. **Quanto** custou o último estouro de orçamento que você descobriu tarde demais?
4. **Quem** na sua obra é o "guardião" de uma planilha crítica que ninguém entende?
5. **Quanto vale** saber o CPI real da sua obra **hoje**, no celular, em 5 segundos?
6. **Quantos** RDOs você assinou esse mês sem realmente conferir o conteúdo?
7. **Quando** foi a última vez que sua equipe de qualidade encontrou rapidamente uma FVS de 6 meses atrás?
8. **Se** sua principal fonte de dados sumir hoje (planilha corrompida, computador roubado), em quanto tempo você reconstrói?
9. **Quanto** um concorrente seu economizaria se ele tivesse 20 horas/semana a mais por engenheiro?

Cada pergunta termina com:
> "**A Atlântico responde isso pra você. Vamos marcar 20 minutos?**"

### 5.5 Vender impacto, não módulo

> ⚡ Regra de ouro do pitch: **NUNCA** comece falando de funcionalidade.

**Errado:** "Nossa plataforma tem 19 módulos: BIM, RDO, FVS, LPS…"
**Certo:** "Sua obra perde R$ 200k por ano em retrabalho. A gente para isso."

**Analogia Palantir:**
> "A Palantir não vende dashboards para o exército americano. Vende **decisões antecipadas** baseadas em ontologia de dados. Salvou vidas porque conectou informação que vivia em silos. A Atlântico faz isso para construção: conecta o RDO do engenheiro com o cronograma do diretor com o orçamento do dono, em tempo real, na mesma base. Não é dashboard. É **inteligência operacional**."

**Frase de fechamento que funciona:**
> "Você não está comprando um software. Está comprando autonomia para a sua cadeia inteira. O engenheiro decide melhor no canteiro. O gerente decide melhor no escritório. O diretor decide melhor no celular. **A obra inteira fica mais inteligente.**"

---

## 6) Materiais padronizados

> ⚡ Essa seção é o **kit do vendedor**: tudo que você usa em uma reunião com cliente novo.

### 6.1 Kit obrigatório (criar essa semana)

| Material | Formato | Quem cria | Quando |
|---|---|---|---|
| **One-pager Atlântico** (1 página, frente e verso) | PDF | Você | Antes da próxima reunião |
| **Apresentação comercial** (10-12 slides) | Google Slides / Keynote | Você | Antes da próxima reunião |
| **Vídeo demo curto** (5-7 min) | MP4 + YouTube unlisted | Você | Essa semana |
| **Proposta comercial template** | Google Docs / Notion | Você | Já |
| **Modelo de contrato/MSA** | PDF assinável (DocuSign / Clicksign) | Advogado | 1 semana |
| **Case study #1 (Engeneves)** | PDF 2 páginas | Após 30 dias do piloto | Quando tiver dado |

### 6.2 Estrutura sugerida da apresentação (10 slides)

1. **Capa** — logo Atlântico + tagline ("Inteligência operacional para construção e saneamento")
2. **A dor** — 1 frase grande: "Toda obra perde 30% do tempo procurando informação que já existe"
3. **A consequência** — números: estouros de orçamento, retrabalho, multas, atrasos
4. **A solução** — 1 frase + screenshot da Torre de Controle
5. **Como funciona** — ontologia: 4 quadrantes (RDO ↔ BIM ↔ Cronograma ↔ Orçamento) com setas
6. **Os 5 módulos-âncora** — ícones + 1 linha cada
7. **A metodologia** — Ontologia + Lean nativo + IA Copilot + Loop de feedback
8. **Resultados** — 80% / 3-5% / R$200k / 38→72% PPC (use os números do brain dump)
9. **Como começamos** — 4 semanas de onboarding (resumo da seção 7)
10. **Investimento** — R$ 8.500 a R$ 12.000 + "garantia de economia ou devolvo"
11. **CTA** — agendar piloto

### 6.3 Padronização de materiais que o cliente já tem

Quando o cliente assinar, ele vai te mandar um caos: **Excel de 14 abas, PDF do cronograma, fotos no WhatsApp, planilha de medição da empreiteira anterior**.

**Sua resposta:** *"Me manda tudo do jeito que está. Eu transformo em 1 padrão."*

**Plano de padronização (template para cada cliente):**

```
01_recebido/        ← arquivos brutos do cliente, NUNCA mexer
02_padronizado/     ← arquivos no template Atlântico
   ├── orcamento.xlsx        (template Quantitativos)
   ├── cronograma.xlsx       (template Plan. Mestre)
   ├── obras.csv             (template Torre de Controle)
   ├── trabalhadores.csv     (template Mão de Obra)
   └── fvs/                  (PDFs FOR-FVS-02 padronizados)
03_importado/       ← prova de que entrou na plataforma
   └── log-importacao-DD-MM-YYYY.txt
```

**Próximo passo:** criar **3 templates Excel** (orçamento, cronograma, obras) na pasta `/templates-cliente/` do Drive — pode ser usado tanto pra apresentar (mostra que tem método) quanto pra preencher (não tem cara de improviso).

---

## 7) Onboarding do cliente em 4 semanas

> ⚡ **Padrão único** que se repete em toda obra fechada. Não improvisar — virar checklist.

### Objetivo

Em **28 dias** depois da assinatura: cliente vendo dashboards reais com dados reais da própria obra, usando a plataforma diariamente.

### Cronograma

#### **Semana 1 — Configuração e Carga Inicial**

| Dia | Atividade | Responsável | Entregável |
|---|---|---|---|
| 1 | Kick-off de 1h por videoconferência: apresentar o time, alinhar expectativas, confirmar escopo | Você + cliente | Ata de kick-off |
| 2 | Cliente envia tudo (Excel, cronograma, fotos, contratos) | Cliente | Pasta `01_recebido/` populada |
| 3 | Você cria a `organization` no Supabase + convida usuários (owner, diretor, gerente, engenheiros) | Você | Usuários ativos com MFA configurado |
| 4 | Você importa os dados padronizados: orçamento, cronograma, obras, trabalhadores | Você | Plataforma com dados reais carregados |
| 5 | Validação cruzada: cliente abre a plataforma, confere se está tudo certo | Cliente + você | Lista de ajustes |

**Marco da semana:** plataforma populada com dados reais da obra; usuários conseguindo logar.

#### **Semana 2 — Treinamento e Operação de Campo**

| Dia | Atividade | Quem participa | Entregável |
|---|---|---|---|
| 1 | Treinamento RDO (2h presencial OU vídeo conferência) | Engenheiros de campo | Engenheiro consegue criar RDO sozinho |
| 2 | Treinamento Qualidade / FVS (1h) | Engenheiros + responsáveis qualidade | 1ª FVS criada |
| 3 | Treinamento Suprimentos (1h) | Comprador / almoxarife | 1ª Ordem de Compra criada |
| 4-5 | Operação assistida — você fica disponível por WhatsApp/call para tirar dúvidas em tempo real | Todos | RDOs/FVS sendo criados rotineiramente |

**Marco da semana:** equipe de campo usando a plataforma todo dia.

#### **Semana 3 — Controle e Integração**

| Dia | Atividade | Entregável |
|---|---|---|
| 1-2 | Treinamento LPS / Lean (2h) — reunião semanal de planejamento usando a plataforma | 1ª reunião LPS rodada na plataforma |
| 3 | Verificação cruzada: o que o RDO registra bate com o que o planejamento esperava? | Lista de divergências resolvidas |
| 4 | Análise dos primeiros gráficos: curva S, dashboard de obras, primeiros indicadores | Print dos dashboards já populados |
| 5 | Ajuste fino do cronograma com base na produtividade real registrada | Plano replanejado se necessário |

**Marco da semana:** plataforma virou ferramenta de decisão, não só de registro.

#### **Semana 4 — Governança, Suporte e Dashboards**

| Dia | Atividade | Entregável |
|---|---|---|
| 1 | Treinamento da Diretoria — uso da Torre de Controle e Gestão 360 no celular | Diretor consegue abrir e ler |
| 2 | Configuração de alertas e roles de aprovação | Workflow de aprovação ativo |
| 3 | Revisão dos índices: CPI, SPI, EVM | Análise compartilhada |
| 4 | Identificação de gargalos: o que está atrasando, o que tem desvio | Lista de ações corretivas |
| 5 | **Reunião de fechamento de onboarding** — apresentação dos resultados, definição da rotina permanente, cadência de suporte | Ata de encerramento + acordo de nível de serviço |

**Marco da semana:** cliente operacional 100% sozinho. Suporte vira reativo, não diário.

### O que o cliente precisa entregar (checklist)

```
☐ Lista de usuários com email + cargo + role pretendida
☐ Orçamento atual (Excel, PDF ou cópia da planilha)
☐ Cronograma atual (MS Project, Excel ou PDF)
☐ Endereço da(s) obra(s) — para Torre de Controle
☐ Lista de trabalhadores (CPF, função, certificações)
☐ Lista de equipamentos próprios + alugados
☐ Contrato com cliente final (para extrair marcos)
☐ 5-10 fotos da obra atual (para popular RDOs históricos se quiser)
☐ Lista de fornecedores principais
☐ Documentação técnica (BIM se houver, projeto executivo)
```

### O que **você** entrega no final do onboarding

```
☐ Plataforma populada e ativa
☐ Todos os usuários logando com MFA
☐ Dashboard inicial validado pelo cliente
☐ Treinamento completo das 4 personas
☐ Manual de uso PDF (15 páginas) — feito uma vez, reusado por cliente
☐ WhatsApp de suporte direto
☐ Cronograma de revisão mensal
☐ Acesso ao "espelho" Calendly para o cliente agendar suporte
```

---

## 8) Onboarding por perfil/role

> ⚡ Cada cargo recebe uma **trilha personalizada** dos 30 primeiros dias. Não joga manual genérico de 80 páginas.

### Engenheiro de campo
- **Dia 1:** Instala Atlântico no celular, faz primeiro login, cria RDO de teste
- **Dia 7:** Já criou 5+ RDOs, sabe registrar fotos georreferenciadas, sabe abrir FVS
- **Dia 30:** Vê os próprios indicadores no app, sabe alertar restrições no LPS

**Material:** vídeo de 8 min "Como usar a Atlântico no canteiro" + cheat sheet 1 página

### Coordenador / Planejador
- **Dia 1:** Acessa Plan. Mestre, valida WBS importada
- **Dia 7:** Roda 1ª reunião LPS na plataforma, atualiza look-ahead
- **Dia 30:** Compara baseline vs. tendência, ajusta cronograma com base no PPC real

**Material:** vídeo de 12 min "Planejamento Lean na Atlântico" + workshop ao vivo de 1h

### Gerente de obra
- **Dia 1:** Vê dashboard de obras na Torre de Controle
- **Dia 7:** Aprova primeira FVS de exceção via workflow
- **Dia 30:** Identifica gargalos pelo CPI/SPI semanal, age proativamente

**Material:** demo individual de 30 min mostrando o painel + tutorial PDF de 5 páginas

### Diretor / Dono
- **Dia 1:** Abre Torre de Controle no celular, vê todas as obras
- **Dia 7:** Recebe primeiro relatório semanal automático por email
- **Dia 30:** Já usa a plataforma para reuniões executivas

**Material:** demo individual de 15 min focada no celular + onboarding presencial de 30 min

### Qualidade
- **Dia 1:** Cria FVS de teste, exporta PDF, valida visualmente
- **Dia 7:** Tem rotina de FVS por trecho/equipe
- **Dia 30:** Rastreabilidade total, fluxo de NCs ativo

**Material:** vídeo de 10 min "FVS digital" + comparação lado-a-lado com formulário antigo

### Comprador / Almoxarife
- **Dia 1:** Cria primeira PO no módulo Suprimentos
- **Dia 7:** Three-Way Match rodando, scorecard de fornecedores ativo
- **Dia 30:** Identifica divergências de R$/insumo automaticamente

**Material:** vídeo de 8 min "Suprimentos sem dor de cabeça" + template Excel de PO

---

## 9) Governança e segurança de dados

### 9.1 Multi-tenant — como funciona

Está documentado em detalhe em [database-architecture.md](./database-architecture.md). Resumo:

- Cada cliente vira uma **organization** no banco
- Toda linha de qualquer tabela tem `organization_id`
- O **Postgres** (não o React) recusa qualquer query que tente cruzar orgs
- Cliente A nem consegue saber que cliente B existe

### 9.2 📍 Pergunta respondida: posso ter um banco de dados POR EMPRESA?

**Resposta curta:** sim, é possível, mas eu **não recomendo** — e vou explicar por quê em linguagem simples.

**As 3 abordagens existentes:**

| Abordagem | Como funciona | Custo mensal Supabase | Esforço para você |
|---|---|---|---|
| **1. RLS (planejado)** | 1 banco, todas as orgs separadas por `organization_id` + Postgres recusa cross-org | US$0 → US$25 → US$599 | **Baixo** — 1 migration faz tudo |
| **2. Schema-per-tenant** | 1 banco, 1 schema Postgres por org | Igual RLS | **Médio** — toda nova org cria schema novo + roda migration |
| **3. Database-per-tenant** | 1 projeto Supabase **inteiro** por cliente | **US$25/mês × 10k clientes = US$250.000/mês** 😱 | **Inviável** — 10k migrations toda vez que mudar schema |

**Por que RLS (opção 1) é o padrão da indústria:**
- ✅ Custo fixo (escala bem com qualquer número de clientes)
- ✅ 1 migration roda em todas as orgs
- ✅ Backup unificado
- ✅ Postgres + RLS é o que **Stripe, Linear, Notion, Vercel** usam
- ⚠️ Requer rigor extremo para nunca esquecer o `organization_id` em uma query — mas isso é resolvido com testes automatizados de leak

**Por que database-per-tenant (opção 3) é uma armadilha:**
- ❌ Custo cresce linearmente: 100 clientes = US$2.500/mês, 1.000 = US$25.000/mês
- ❌ Impossível fazer backup unificado
- ❌ Cada migration precisa rodar **N vezes** (1 por cliente) — quebra fácil
- ❌ Joins entre clientes (para você ver "quanto vendi este mês total") viram impossíveis
- ❌ Manutenção/monitoring vira pesadelo

**Conclusão:** RLS é o caminho. Quando **um cliente Enterprise específico** pedir banco isolado por compliance, aí sim você cria um Supabase próprio para ele e cobra a mais por isso (modelo "Enterprise Dedicated"). Mas isso é exceção, não regra.

**Mensagem para o cliente desconfiado:**
> "Seus dados ficam no MESMO cluster Postgres do Stripe, da Linear e da Notion — empresas que processam bilhões de dólares e dados ultra-sensíveis. A separação não é por arquivo separado: é por uma regra do banco que NÃO TEM como falhar. Mesmo se um hacker pegar o seu login, ele só vê os dados da sua empresa. Mesmo se um bug do nosso código tentar cruzar organizações, o Postgres recusa."

### 9.3 📍 Pergunta respondida: se sumirem os dados, é minha culpa?

**Resposta curta:** **sim, contratualmente é responsabilidade sua.** Você é o operador. Mas com as proteções certas, **a probabilidade de isso acontecer é praticamente zero**.

**O que dizer no contrato (cláusula obrigatória):**

> "A CONTRATADA é responsável pela manutenção da disponibilidade e integridade dos dados da CONTRATANTE, mantendo backups automatizados em camadas redundantes. A CONTRATADA não se responsabiliza por perdas decorrentes de:
> (i) ações deliberadas de usuários autenticados da CONTRATANTE (exclusões com aprovação válida);
> (ii) incidentes em provedores terceiros (Supabase, AWS) cobertos pelas SLAs daquelas plataformas;
> (iii) ataques cibernéticos contra credenciais comprometidas pela CONTRATANTE.
> Em caso de perda atribuível à CONTRATADA, ela compromete-se a restaurar os dados a partir do backup mais recente em até 24 (vinte e quatro) horas úteis e a indenizar a CONTRATANTE em até 1 (uma) mensalidade do serviço."

**As 7 camadas de proteção** (já documentadas em [database-architecture.md seção 8](./database-architecture.md)):

1. localStorage do navegador (cópia local automática)
2. Supabase Postgres com replicação síncrona
3. Backup diário automático (a partir do plano Pro)
4. Point-in-Time Recovery 7 dias (a partir do plano Pro)
5. `pg_dump` semanal cifrado para storage seu
6. Export por organização (mensal)
7. Botão "Exportar tudo" sob demanda do cliente (LGPD)

**Cenário de perda total** (Supabase fora + backup local seu corrompido + a Vercel desaparecer): essa é a **probabilidade combinada de catástrofes**, próxima de zero. Mesmo assim, o cliente pode levar os próprios dados embora pelo botão LGPD a qualquer momento — então **ele também tem cópia**.

**O que fazer hoje (no plano Free):**
- ⚠️ Botão `/app/admin/backup` que **VOCÊ clica toda segunda** e salva o JSON em 2 lugares: Google Drive E HD externo
- ⚠️ Comunicar ao cliente: "no plano Free não temos backup automático, mas eu mantenho cópia semanal pessoalmente"
- ⚠️ Migrar para Pro logo que tiver 5-10 clientes pagantes

### 9.4 Workflow de aprovação

Já documentado em detalhe em [database-architecture.md seção 4](./database-architecture.md).

**Resumo:** edição/exclusão de FVS, RDO antigo, orçamento aprovado, baseline → cria um `pending_action` que **só Gerente/Diretor** podem aprovar. Auto-aprovação proibida (você não pode aprovar seu próprio pedido).

---

## 10) Prevenção de churn e feedback

> ⚡ Vender é difícil. Reter é mais difícil. **Sem retenção, você precisa fechar 10 obras por mês para sobreviver.**

### NPS automático (rodada mensal)

- Email automático no dia 1 de cada mês
- 1 pergunta: "De 0 a 10, quanto você recomendaria a Atlântico?"
- 1 pergunta aberta: "O que faríamos para virar 10?"

**Quem responde 9-10:** vira candidato a depoimento + indicação
**Quem responde 7-8:** acompanhar, ainda OK
**Quem responde 0-6:** **alarme vermelho** — call de retenção em até 48h

### Revisão trimestral (QBR — Quarterly Business Review)

A cada 3 meses, **VOCÊ marca uma call de 30 min** com cada cliente:

1. Mostra o que ele economizou vs. mês anterior (números reais)
2. Pergunta o que está incomodando
3. Compromete uma melhoria/feature pra próxima rodada
4. Reforça o ROI

**Resultado:** cliente sente que o relacionamento é vivo, não só uma fatura.

### Sinais precoces de churn

| Sinal | O que significa | Ação |
|---|---|---|
| Login cai >50% em uma semana | Pessoa parou de usar | Call em 48h |
| 0 RDOs criados em 7 dias úteis | Equipe abandonou | Call em 24h |
| Reclamação no WhatsApp sem resposta | Frustração crescente | Resposta em 1h |
| Pediu fatura adiantada / "cancela" | Já decidiu sair | Call no mesmo dia, oferecer pause em vez de cancel |
| NPS 6 ou menor | Insatisfação grave | Call no mesmo dia |

### Ofertas de retenção (use com critério)

- **Pause de 30 dias** (em vez de cancelar)
- **Mês grátis** se renovar por 6 meses
- **Workshop dedicado de 2h** com a equipe técnica do cliente
- **Migração assistida de mais 1 obra** sem custo

---

## 11) Integração entre módulos e Ontologia

### 11.1 O que conversa com o quê (mapa atual)

```
                          ┌─────────────┐
                          │  Projetos   │
                          └──────┬──────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   ┌────▼─────┐           ┌──────▼──────┐          ┌─────▼──────┐
   │ Plan.    │           │   Obras /   │          │ Orçamento  │
   │ Mestre   │◄──────────│   Sites     │─────────►│ (Quant.)   │
   │ (WBS)    │           └──────┬──────┘          └─────┬──────┘
   └────┬─────┘                  │                       │
        │                        │                       │
        │                ┌───────▼────────┐              │
        │                │  Torre de      │              │
        │                │  Controle      │              │
        │                └────────────────┘              │
        │                                                │
   ┌────▼─────┐                                  ┌──────▼──────┐
   │   LPS    │                                  │ Suprimentos │
   │  (Lean)  │                                  │  (3-Way)    │
   └────┬─────┘                                  └─────────────┘
        │
   ┌────▼─────┐         ┌──────────┐         ┌──────────────┐
   │   RDO    │────────►│  Quali-  │────────►│     NCs      │
   │  (campo) │         │  dade    │         │              │
   └────┬─────┘         │  (FVS)   │         └──────────────┘
        │               └──────────┘
        │
   ┌────▼─────┐                              ┌──────────────┐
   │ Mão de   │                              │     BIM      │
   │  Obra    │                              │  3D/4D/5D    │
   └──────────┘                              └──────────────┘
```

### 11.2 O que JÁ funciona (integrações reais hoje)

| Origem | → | Destino | Como |
|---|---|---|---|
| Planejamento | → | RDO | RDO importa lista de trechos do cronograma |
| RDO | → | Planejamento | Avanço físico do RDO atualiza % do trecho |
| Pré-Construção | → | Planejamento | Importa quantitativos como trechos |

### 11.3 O que FALTA integrar (auditoria já apontou)

| Integração ausente | Por que importa | Prioridade |
|---|---|---|
| **Qualidade ↔ RDO** | RDO não pode fechar se houver FVS pendente do dia | 🔴 ALTA |
| **Planejamento ↔ Suprimentos** | "Atraso de material recalcula cronograma" — promessa da landing | 🔴 ALTA |
| **Planejamento ↔ BIM 4D** | Ter timeline 4D real, não 2 mundos paralelos | 🟡 MÉDIA |
| **Qualidade ↔ Mapa Interativo** | Amarrar FVS ao trecho da rede no mapa | 🟡 MÉDIA |
| **Qualidade ↔ BIM** | Amarrar FVS ao elemento BIM (pilar P-12) | 🟡 MÉDIA |
| **Qualidade ↔ Planejamento (LPS)** | NC aberta vira restrição automática no Constraint Register | 🟡 MÉDIA |
| **Suprimentos ↔ Quantitativos** | Custo unitário do orçamento alimenta o PO | 🟢 BAIXA |
| **Mão de Obra ↔ Planejamento** | Equipes do plano = trabalhadores reais (com certificação válida) | 🟢 BAIXA |

Detalhes em [audit-planejamento-qualidade.md](./audit-planejamento-qualidade.md).

### 11.4 📍 Pergunta respondida: como começar a Ontologia de Dados?

**O que é uma ontologia, em 1 frase:** é o "modelo mental" único da plataforma — um glossário compartilhado de conceitos onde **cada coisa só tem uma definição**.

**Exemplo concreto:**
- Hoje: o conceito "trecho" existe em 3 lugares (Planejamento, RDO, Mapa) com 3 definições diferentes
- Com ontologia: existe 1 só "Trecho" — uma entidade com `id`, `código`, `comprimento`, `localização`, `status`. Todo módulo referencia o mesmo `Trecho` por `id`.

**Como começar (3 passos práticos):**

1. **Listar as entidades centrais** que aparecem em mais de 1 módulo:
   - Obra / Projeto / Site
   - Trecho / Atividade
   - Equipe / Trabalhador
   - Equipamento
   - Material / Item de orçamento
   - Documento (FVS, RDO, NF)
   - Localização (lat/lng)

2. **Definir 1 só schema TypeScript** para cada entidade (em `src/types/ontology/`). Hoje cada módulo tem o seu schema próprio — vamos consolidar.

3. **Refatorar 1 módulo por vez** para usar os tipos da ontologia, em vez dos próprios. Começar pelo `Trecho` (mais reusado).

**Quanto isso leva:** ~2 semanas de refatoração focada. Não bloqueia outras coisas — é incremental.

**Por que vale o investimento:**
- Cliente experimentando vê **a mesma "Obra A"** em todos os módulos com os mesmos números
- Auditoria vira possível ("me mostra tudo da Obra A: planejamento, gastos, FVS, equipe, riscos")
- IA Copilot consegue cruzar dados sem ETL

**Próximo passo:** começar com a entidade `Site` (Obra) no Sprint 2 do Supabase. Já vai ser fonte única no banco — só falta os módulos referenciarem ela em vez de ter cópias locais.

---

## 12) 6 pilares de confiança

> ⚡ Use isso como **eixo do pitch** e **eixo do roadmap**.

| Pilar | O que significa | Status hoje | Próxima ação |
|---|---|---|---|
| **1. Metodologia** | Não é só software, é jeito de operar. Lean + Ontologia + Loop de feedback | ✅ Documentado e implementado parcialmente | Refinar copy de venda + workshop interno |
| **2. Segurança** | Multi-tenant, RLS, audit log, MFA, backup 7 camadas | 🔴 Planejado, não implementado (vai com Supabase) | **Sprint 1 do Supabase** (próximo) |
| **3. Dados / Banco** | Postgres + Supabase + ontologia unificada | 🔴 Planejado | **Sprint 1 do Supabase** (próximo) |
| **4. Cálculos corretos** | CPI/SPI/EVM/curva S/PPC validados | 🟡 Engines existem, **sem testes automatizados** | Adicionar Vitest para `scheduleEngine`, `analysisEngine`, `fvsPdfExport` |
| **5. Suporte** | WhatsApp direto, QBR trimestral, NPS mensal | 🔴 Não estruturado | Criar canal WhatsApp + agenda Calendly de suporte |
| **6. Padronização** | Onboarding em 4 semanas, materiais reutilizáveis, processo único | 🟡 Documentado neste arquivo, mas não materializado | Criar templates Excel/Slides e estruturar pasta `/templates-cliente/` |

---

## 13) Revisão dos módulos Palantir-like

> ⚡ Lista de gaps por módulo, do mais maduro ao menos maduro. Detalhes em [audit-planejamento-qualidade.md](./audit-planejamento-qualidade.md).

| Módulo | Maturidade | Principais gaps |
|---|---|---|
| **RDO** | 🟢 Alta | Falta integração formal com FVS (bloqueio se FVS pendente) |
| **Qualidade (FVS)** | 🟢 Alta | Falta integração com Mapa, BIM e LPS (NC → restrição) |
| **Plan. Mestre** | 🟡 Média | Sem persistência localStorage, sem testes, falta integração com Suprimentos |
| **Plan. Trechos** | 🟡 Média | Mesmas faltas + Gantt mobile precisa ajuste |
| **Quantitativos** | 🟡 Média | Sem persistência, Wizard recém-criado, falta integração com Suprimentos |
| **Suprimentos** | 🟡 Média | Sem integração com Planejamento/Quantitativos |
| **Mão de Obra** | 🟡 Média | Sem integração com Planejamento (validação de equipe) |
| **Torre de Controle** | 🟡 Média | Bug de mapa recém-corrigido, falta integração com indicadores reais por obra |
| **BIM 3D/4D/5D** | 🟡 Média | Roda mas isolado — não puxa cronograma do Planejamento |
| **Mapa Interativo** | 🟢 Alta | Funciona bem, falta integração com FVS/RDO por trecho |
| **LPS / Lean** | 🟡 Média | Funciona, falta integração com RDO (PPC automático) |
| **Gestão 360** | 🟡 Média | KPIs calculados, mas precisa puxar números reais quando o Supabase entrar |
| **Relatório 360** | 🟡 Média | Idem |
| **Equipamentos** | 🟢 Alta | OK, isolado |
| **Frota** | 🟢 Alta | OK, isolado |
| **Pré-Construção** | 🟢 Alta | OK |
| **Agenda** | 🟢 Alta | OK |
| **Rede 360** | 🟢 Alta | OK |
| **Projetos** | 🟡 Média | Falta ser a entidade-âncora da ontologia |

**Top 5 prioridades para os próximos 30 dias:**
1. Sprint 1 Supabase (auth + orgs + perfis + RLS)
2. Migração da Qualidade para o Supabase
3. Integração Qualidade ↔ RDO
4. Persistência localStorage do Planejamento
5. Adicionar Vitest e cobrir os engines puros

---

## 14) Proposta comercial

### Faixa de preço

**R$ 8.500 a R$ 12.000 / mês por obra**

**O que justifica a faixa:**
- Tamanho da obra (ticket do contrato)
- Número de usuários
- Quantidade de módulos ativados
- Nível de suporte (básico vs. consultoria intensa)

| Tamanho da obra | Mensalidade sugerida | Inclui |
|---|---|---|
| **Pequena** (até R$ 3M) | R$ 8.500 | Plataforma + 5 usuários + suporte WhatsApp |
| **Média** (R$ 3M – R$ 10M) | R$ 10.000 | Plataforma + 10 usuários + suporte WhatsApp + 1 QBR/mês |
| **Grande** (R$ 10M+) | R$ 12.000 | Plataforma + usuários ilimitados + suporte 24/7 + consultoria semanal |

### O que está incluído

| Item | Descrição |
|---|---|
| **Acesso à plataforma** | Todos os 19 módulos, sem limite de RDOs/FVS |
| **Suporte dedicado** | WhatsApp direto, resposta < 2h em horário comercial |
| **Consultoria contínua** | Reunião quinzenal de 30 min para revisar uso |
| **Onboarding completo** | 4 semanas com treinamento das 4 personas |
| **Customização leve** | Logos, cabeçalhos, terminologia da empresa |
| **Backup** | Manual semanal (Free) ou automático (Pro+) |
| **Garantia de economia** | "Se a plataforma não pagar o próprio custo em 90 dias, devolvo o investimento" |

### Como provar economia ANTES da venda

Já documentado na [seção 5.3](#53-metodologia-da-plataforma). Resumo:

1. Pegue 1 KPI do cliente hoje
2. Projete a economia se reduzir 1-3% naquele KPI
3. Compare com o preço da plataforma
4. **Compromisso por escrito:** "se eu não provar essa economia em 90 dias, devolvo"

### Modelo de SLA (Service Level Agreement) simples

```
1. DISPONIBILIDADE
   • Uptime mensal: ≥ 99.5% (15 min de downtime aceitável/mês)
   • Janela de manutenção: domingo 02h-06h, com aviso de 48h

2. RESPOSTA AO SUPORTE
   • Crítico (plataforma fora): 1h
   • Alto (módulo importante quebrado): 4h
   • Médio (bug visual): 1 dia útil
   • Baixo (sugestão): 3 dias úteis

3. BACKUP E RECUPERAÇÃO
   • Backup: semanal manual (Free) → diário automático (Pro)
   • Recuperação em caso de perda atribuível à CONTRATADA: 24h úteis

4. GARANTIA
   • Garantia de economia: se em 90 dias o ROI não for positivo,
     devolução integral dos valores pagos
```

---

## 15) Decisões abertas

Lista do que ainda precisa de decisão sua **antes** dos próximos passos:

| # | Decisão | Quando precisa | Minha recomendação |
|---|---|---|---|
| 1 | Criar conta Supabase Free e me passar URL + anon key | Para começar Sprint 1 | **Hoje** — leva 5 min |
| 2 | Comprar domínio próprio (`atlantico.com.br`?) | Antes de fechar 1ª venda | Comprar essa semana, ~R$ 50/ano |
| 3 | Email profissional (`contato@atlantico.com.br`) | Antes de fechar 1ª venda | Google Workspace R$ 35/usuário/mês |
| 4 | Calendly profissional ou gratuito? | Para campanha LinkedIn | Gratuito serve no início |
| 5 | Como vai assinar contratos? | Antes de 1ª venda | Clicksign (R$ 35/doc) ou D4Sign |
| 6 | CNPJ / abrir empresa? | Antes de receber 1ª fatura | MEI até R$ 81k/ano, depois Simples Nacional |
| 7 | Conta PJ separada | Antes de receber 1ª fatura | Inter PJ ou C6 PJ (gratuitas) |
| 8 | Apólice de seguro de responsabilidade técnica | Quando passar de 5 clientes | Cotar com Tokio Marine ou Porto Seguro (~R$ 200/mês) |
| 9 | LGPD: contratar DPO terceirizado? | Antes de fechar primeira obra com órgão público | Pode ser eu mesmo no início, terceirizar quando >10 clientes |
| 10 | Definir nome final do produto | Já | "Atlântico" — manter |

---

## Próximos passos imediatos (essa semana)

**Ordem sugerida:**

1. **Hoje:** criar conta Supabase Free → me mandar URL e anon key
2. **Hoje:** comprar domínio + criar email profissional
3. **Amanhã:** gravar vídeo demo de 5 min (roteiro na seção 4.2)
4. **Amanhã:** criar one-pager + apresentação 10 slides (estrutura na seção 6.2)
5. **Quarta:** publicar 3 posts LinkedIn (usar [linkedin-posts.md](./linkedin-posts.md)) por frente
6. **Quarta:** Sprint 1 Supabase rodando (eu entrego)
7. **Quinta:** primeira reunião com Engeneves (apresentar + agendar piloto)
8. **Sexta:** revisar pipeline, identificar 5 leads quentes pra próxima semana
9. **Sábado:** contrato + SLA + checklist de onboarding revisados
10. **Domingo:** descansar (importante)

---

## Documentos relacionados

- [database-architecture.md](./database-architecture.md) — Arquitetura técnica de banco, multi-tenant, RLS, backup
- [linkedin-posts.md](./linkedin-posts.md) — 20 posts B2B prontos para publicar
- [audit-planejamento-qualidade.md](./audit-planejamento-qualidade.md) — Auditoria técnica dos módulos
- [PLATFORM.md](./PLATFORM.md) — Visão geral da plataforma

---

> **Lembrete final:** este documento é vivo. Toda segunda-feira, abra, releia o sumário, marque o que andou, repriorize. Se ele virar estático, perde o valor.
