# Atlântico ConstruData — Fluxogramas Detalhados de Cada Módulo

> Documento de referência para produção de vídeos explicativos (Remotion).
> Cada módulo tem: resumo, fluxograma visual, e passo a passo detalhado.

---

## 1. PLANEJAMENTO (Trechos)

**Resumo:** Cronograma detalhado de trechos com Gantt interativo, CPM (Caminho Crítico), simulação de atrasos, e curva ABC.

### Fluxograma
```
[1. Configurar Projeto] → [2. Importar Trechos] → [3. Gerar Cronograma] → [4. Analisar] → [5. Acompanhar] → [6. Exportar]
```

### Passo a Passo

**Passo 1 — Configurar Projeto**
- Abra a aba "Configuração"
- Informe: nome do projeto, data de início, data limite
- Defina as equipes disponíveis e produtividade média (metros/dia)
- Salve a configuração

**Passo 2 — Importar Trechos**
- Clique em "Importar Excel" na aba Trechos
- Use o template `atlantico-trechos-template.xlsx`
- Colunas obrigatórias: código, descrição, extensão (m), diâmetro (mm)
- O sistema valida e mapeia automaticamente as colunas (auto-detect por aliases)
- Confirme a importação — trechos aparecem na tabela com status

**Passo 3 — Gerar Cronograma**
- Clique no botão "Gerar Planejamento"
- O algoritmo ordena trechos por dependências e recursos disponíveis
- Calcula caminho crítico (CPM) automaticamente
- Resultado: Gantt visual com datas de início/fim por trecho
- Trechos no caminho crítico ficam destacados em vermelho

**Passo 4 — Analisar e Ajustar**
- **Curva S:** compare progresso previsto vs realizado acumulado
- **Curva ABC:** identifique os 20% de trechos que representam 80% do esforço
- **Histograma:** verifique distribuição de recursos ao longo do tempo
- **Simulação de atrasos:** arraste datas no Gantt para ver impacto cascata

**Passo 5 — Acompanhar Execução**
- Aba "Plano Diário": registre trechos executados por dia
- Aba "Notas de Serviço": documente ocorrências e decisões
- O Gantt se atualiza com cores (verde = no prazo, vermelho = atrasado)
- Salve cenários para comparar versões do planejamento

**Passo 6 — Exportar**
- CSV: dados tabulares para Excel/BI
- PDF: cronograma visual para impressão/reuniões
- Cenário salvo: para comparar com versões futuras

---

## 2. PLANEJAMENTO MESTRE

**Resumo:** Estrutura macro do projeto: WBS, marcos contratuais, baselines, look-ahead de 6 semanas, e simulação what-if. Três horizontes de planejamento em uma só tela.

### Fluxograma
```
[1. Criar Cronograma] → [2. Estruturar WBS] → [3. Definir Marcos] → [4. Salvar Baseline] → [5. Look-ahead 6 sem] → [6. Programação Semanal] → [7. What-if] → [8. Exportar]
```

### Passo a Passo

**Passo 1 — Criar Cronograma**
- 3 opções de entrada:
  - **"Criar do Zero"** — Wizard de 3 passos (nome, tipo de rede, datas → frentes/comunidades → confirmação)
  - **"Importar Planilha"** — Upload de Excel com colunas: nome/atividade, WBS/código, data início, data fim
  - **"Carregar Exemplo"** — Dados demo para conhecer o módulo
- O sistema auto-gera códigos WBS (1, 1.1, 1.1.1) se não vierem na planilha

**Passo 2 — Estruturar WBS**
- Aba "Longo Prazo" (Macro): Gantt com hierarquia WBS
- Cada atividade tem: código WBS, nome, datas planejadas, datas tendência
- Níveis: Projeto (0) → Frente (1) → Atividade (2+)
- Atividades podem ser marcadas como "Marco" (isMilestone)
- Cores por tipo de rede: Água (azul), Esgoto (roxo), Civil (amarelo)

**Passo 3 — Definir Marcos Contratuais**
- No Gantt, marque atividades como "Marco" (ícone diamante)
- Marcos aparecem destacados na linha do tempo
- Alertas automáticos quando tendência ultrapassa data do marco

**Passo 4 — Salvar Baseline**
- Clique em "Salvar Baseline" no header
- Dê um nome (ex: "Baseline Contratual v1")
- Snapshot completo das atividades é salvo
- Compare baseline com situação atual a qualquer momento

**Passo 5 — Look-ahead 6 Semanas (Médio Prazo)**
- Aba "Médio Prazo" (Derivação)
- O sistema filtra automaticamente atividades das próximas 6 semanas
- Agrupadas por tipo: ÁGUA, ESGOTO, SERVIÇOS CIVIS
- Para cada atividade-semana: status (Planejado, Pronto, Bloqueado, Concluído)
- PPC calculado por seção

**Passo 6 — Programação Semanal**
- Aba "Prog. Semanal": tabela diária (Seg-Dom)
- Para cada atividade: Previsto vs Realizado por dia
- Colunas: Item, Núcleo, Local, Atividade, Comprimento, Qtd Ligações, Coordenador
- Exportável para Excel

**Passo 7 — Simulação What-if (Curto Prazo)**
- Aba "Curto Prazo": quadro de 15 dias
- Curva S dual: planejada (tracejada) vs real (sólida)
- PPC semanal com semáforo (verde ≥80%, amarelo ≥60%, vermelho <60%)
- Adicione ajustes what-if: atrasar início, alterar duração
- Veja impacto imediato na curva S

**Passo 8 — Exportar**
- PDF: visão integrada dos 3 horizontes
- Excel: programação semanal
- PNG: Gantt para apresentações

---

## 3. MEDIÇÃO

**Resumo:** Gestão de medições contratuais em 6 passos sequenciais (stepper). Do preenchimento da planilha até o PDF final.

### Fluxograma
```
[1. Criar Boletim] → [2. Planilha Sabesp] → [3. Critérios] → [4. Subempreiteiros + Fornecedores] → [5. Conferência Auto] → [6. PDF Final]
```

### Passo a Passo

**Passo 1 — Criar Boletim de Medição**
- Clique em "Novo Boletim"
- Informe: período (mês/ano), número do contrato, consórcio
- Defina o número sequencial do boletim
- O sistema cria a estrutura vazia para preenchimento

**Passo 2 — Planilha Sabesp (Step 1 do Stepper)**
- Adicione itens por nPreco (número de preço do contrato)
- O sistema busca automaticamente descrição e unidade do catálogo de critérios
- Informe para cada item: quantidade contratada, quantidade medida, valor unitário
- Itens agrupados por: 01-Canteiros de Serviço, 02-Esgoto Sanitário, 03-Água
- Alternativa: importe tudo de uma vez via Excel

**Passo 3 — Critérios de Medição (Step 2)**
- Consulta ao catálogo de critérios (referência, não editável)
- Verifique como cada serviço deve ser medido

**Passo 4 — Subempreiteiros e Fornecedores (Steps 3 e 4)**
- Step 3: Registre quantidades medidas por subempreiteiro
- Step 4: Registre notas fiscais de fornecedores
- Vincule à planilha Sabesp para rastreabilidade

**Passo 5 — Conferência Automática (Step 5)**
- O sistema cruza automaticamente: Planilha Sabesp vs Subempreiteiros vs Fornecedores
- Identifica divergências (quantidade, valor)
- Sinaliza itens com diferença acima da tolerância
- Corrija itens sinalizados antes de prosseguir ao passo final

**Passo 6 — Medição Final + PDF (Step 6)**
- Resumo completo com totais por grupo de serviço
- Clique "Exportar PDF" para gerar boletim em modo claro (fundo branco)
- PDF inclui: capa, itens detalhados, totais, campos para assinatura
- Boletim fica salvo no histórico para consulta futura

---

## 4. SUPRIMENTOS

**Resumo:** Gestão completa da cadeia de suprimentos: da previsão de demanda ao pagamento. Three-Way Match automático (PO × Recebimento × NF).

### Fluxograma
```
[1. Previsão de Demanda] → [2. Requisição de Compra] → [3. Ordem de Compra (PO)] → [4. Recebimento + NF] → [5. Conciliação 3-Way] → [6. Resolver Exceções] → [7. Gestão de Estoque]
```

### Passo a Passo

**Passo 1 — Previsão de Demanda**
- Aba "Previsão de Demanda" na seção Suprimentos
- Visualize necessidades futuras baseadas no cronograma de planejamento
- Identifique materiais críticos (lead time longo) e prazos necessários
- Dados podem vir do módulo Planejamento (integração cross-module)

**Passo 2 — Requisição de Compra**
- Aba "Requisições": crie nova requisição de material
- Pipeline visual com status: Submetida → Em Análise → Cotação → Pedida
- Defina: prioridade, prazo desejado, especificações técnicas
- Requisição pode ser aprovada conforme Matriz de Aprovação da organização

**Passo 3 — Ordem de Compra (OC/PO)**
- Crie OC com: fornecedor, itens, quantidades, preços unitários, prazo de entrega
- Ou importe via "Importar Consolidado" (planilha Excel com mapeamento de colunas)
- Status da OC: Aberta → Parcial → Fechada/Cancelada
- Cada item tem: descrição, unidade, quantidade, preço unitário, total

**Passo 4 — Recebimento e Nota Fiscal**
- Registre o recebimento físico: quantidade recebida por item
- Registre a nota fiscal: número, valor total, itens discriminados
- Os dados alimentam automaticamente o Three-Way Match
- Divergências são sinalizadas imediatamente

**Passo 5 — Conciliação (Three-Way Match)**
- Aba "Conciliação": status de cada match PO × Recebimento × NF
- **Verde (Matched):** tudo confere dentro da tolerância (2%)
- **Amarelo (Parcial):** divergência pequena (< 5%)
- **Vermelho (Discrepancy):** divergência grande (> 5%)
- Para cada divergência: campo, valor PO, valor recebido/faturado, delta, delta%

**Passo 6 — Resolver Exceções**
- Aba "Exceções": lista todas as discrepâncias abertas
- Para cada exceção: analise causa, resolva (ajustar PO, devolver material, aceitar)
- Documente a resolução com justificativa para auditoria
- Status da exceção: Aberta → Em Análise → Resolvida / Escalada

**Passo 7 — Gestão de Estoque**
- Seção "Materiais & Estoque":
  - **Mapa de Estoque:** disponível, em trânsito, reservado, por depósito virtual
  - **Semáforo de Prontidão:** verde/amarelo/vermelho por material e atividade LPS
  - **What-if Logístico:** simule cenários (antecipar/atrasar compra, trocar fornecedor)
  - **Alertas de Ruptura:** notificação automática quando estoque mínimo é atingido
- Seção "Planilhas Consolidadas":
  - Importe planilhas de Resumo por Núcleo, Consolidado de Trechos, Materiais Pendentes

---

## 5. PROJETOS

**Resumo:** Cadastro mestre de projetos com 6 abas: visão geral, planejamento, execução, orçamento, BIM 3D/4D/5D, e documentos.

### Fluxograma
```
[1. Criar Projeto] → [2. Definir Fases] → [3. Configurar Orçamento] → [4. Acompanhar Execução] → [5. Visualizar 3D/4D/5D] → [6. Documentos]
```

### Passo a Passo

**Passo 1 — Criar Projeto**
- Clique em "Novo Projeto" na sidebar de projetos
- Informe: código do projeto, nome, gerente responsável
- O projeto aparece na lista com status "Planejamento"
- Status possíveis: Planejamento → Ativo → Em Espera → Concluído

**Passo 2 — Definir Fases e Marcos**
- Aba "Planejamento" do projeto
- Adicione fases: pré-obra, mobilização, execução, desmobilização
- Defina marcos contratuais com datas obrigatórias (penalidades)
- Vincule entregáveis a cada fase
- Timeline visual com progresso por fase

**Passo 3 — Configurar Orçamento**
- Aba "Orçamento": adicione linhas de custo
- Categorias: mão de obra, materiais, equipamentos, terceiros, administrativo
- Defina valor previsto para cada linha
- Acompanhe realizado vs orçado em tempo real
- Integra com módulo Financeiro/EVM para cálculo de CPI

**Passo 4 — Acompanhar Execução**
- Aba "Execução": progresso por fase com % concluído
- Dados alimentados automaticamente pelo RDO (se integrado)
- Visualize: pendências, bloqueios, atrasos
- Status do projeto atualizado automaticamente com base no progresso

**Passo 5 — Visualização 3D/4D/5D**
- Aba "3D/4D/5D": visualizador BIM integrado
- **3D:** Modelo geométrico navegável (importa DXF/IFC)
- **4D:** Cronograma sobreposto ao modelo (animação temporal)
- **5D:** Heatmap de custos por elemento (verde = no orçamento, vermelho = estouro)

**Passo 6 — Gestão de Documentos**
- Aba "Documentos": repositório centralizado do projeto
- Upload de: plantas, contratos, licenças, ART, alvarás
- Versionamento automático
- Filtro por tipo de documento e data

---

## 6. LPS / LEAN CONSTRUCTION

**Resumo:** Last Planner System completo. Do look-ahead de 6 semanas ao PPC semanal com Pareto de causas de não-cumprimento. Metodologia Lean integrada ao fluxo.

### Fluxograma
```
[1. Criar Atividades] → [2. Identificar Restrições] → [3. Look-ahead 4-6 sem] → [4. Plano Semanal] → [5. Executar e Registrar] → [6. Medir PPC e Melhorar]
         ↑                                                                                                                                    ↓
         └──────────────────────────────────────── Ciclo contínuo de melhoria ──────────────────────────────────────────────────────────────────┘
```

### Passo a Passo

**Passo 1 — Criar Atividades**
- Aba "Semáforo": crie atividades (pacotes de trabalho)
- Cada atividade tem: nome, descrição, responsável (mestre/encarregado)
- Status inicial: vermelho no semáforo (pendente)
- Atividades representam pacotes de trabalho que serão planejados semanalmente

**Passo 2 — Identificar Restrições**
- Aba "Restrições": registre cada bloqueio que impede o trabalho
- Categorias CNC (Causas de Não-Cumprimento):
  - **Clima** — chuva, calor extremo, vento
  - **Equipamento** — quebra, indisponibilidade
  - **Mão de Obra** — falta, certificação vencida
  - **Material** — atraso de entrega, material errado
  - **Projeto** — indefinição, mudança de escopo
  - **Outro** — licenças, interferências externas
- Para cada restrição: responsável pela remoção + prazo
- Timeline visual mostra evolução das restrições no tempo

**Passo 3 — Look-ahead (4-6 Semanas)**
- Aba "Look-ahead": planejamento de médio prazo
- Distribua atividades pelas próximas 4-6 semanas
- Para cada atividade na semana: verifique se TODAS as restrições foram removidas
- Se há restrição pendente: atividade fica "Bloqueada" (não pode ir para plano semanal)
- Objetivo: preparar atividades para estarem "Prontas" quando a semana chegar

**Passo 4 — Planejamento Semanal (Reunião de Compromisso)**
- Selecione as atividades do look-ahead que são executáveis ESTA semana
- Critério fundamental: só entra no plano semanal se TODAS as restrições foram removidas
- Este é o **compromisso** da equipe — o que será medido no PPC
- Faça na reunião semanal com mestres e encarregados (segunda-feira de manhã)
- Cada mestre confirma: "Eu consigo fazer X esta semana? Sim/Não e por quê"

**Passo 5 — Executar e Registrar**
- Durante a semana: execute as atividades do plano semanal
- No final de cada dia ou no fim da semana:
  - Marque cada atividade como **Concluída** ou **Não Concluída**
  - Para não concluídas: registre o motivo (categoria CNC)
  - Exemplo: "Material não chegou a tempo" → CNC = Material
- Esses dados alimentam automaticamente o cálculo do PPC

**Passo 6 — Medir PPC e Melhorar (Ciclo Contínuo)**
- Aba "PPC Dashboard":
  - **PPC semanal** = atividades concluídas ÷ atividades planejadas × 100
  - Meta: PPC > 80% (benchmark internacional de Lean Construction)
  - Tendência: gráfico das últimas 8 semanas — o PPC deve SUBIR progressivamente
  - **Pareto de causas:** qual categoria CNC aparece mais?
    - Se "Material" é 40% das causas → foque em melhorar Suprimentos
    - Se "Mão de Obra" é 35% → foque em alocação/capacitação
- **O ciclo se repete:** use o Pareto para atacar a causa raiz, reduza as restrições, e o PPC sobe naturalmente
- Aba "Takt Time": ritmo de trabalho por atividade para balancear produção
- Aba "Alertas": escale situações críticas antes que virem problema

---

## 7. RELATÓRIO 360

**Resumo:** Relatório diário completo com kanban de atividades, equipes, equipamentos, materiais e fotos. Exporta PDF customizável por período e áreas.

### Fluxograma
```
[1. Selecionar Data] → [2. Kanban de Atividades] → [3. Registrar Equipes/Recursos] → [4. Adicionar Fotos] → [5. Exportar PDF]
```

### Passo a Passo

**Passo 1 — Navegar para o Dia**
- Use setas (anterior/próximo) ou clique no calendário
- Cada dia tem seu próprio relatório independente

**Passo 2 — Gerenciar Atividades (Kanban)**
- 3 colunas: Planejado → Em Andamento → Concluído
- Arraste cards entre colunas para atualizar status
- Edite cada atividade: nome, quantidade planejada/real, unidade, equipe responsável

**Passo 3 — Registrar Equipes e Recursos**
- **Equipes:** Apontamentos de horas por trabalhador (nome, função, horas, taxa)
- **Equipamentos:** Horas de utilização por equipamento (tipo, horas, custo)
- **Materiais:** Consumo do dia (material, atividade, quantidade, unidade)

**Passo 4 — Adicionar Fotos**
- Upload de fotos com legenda descritiva
- Grid visual com até 18 fotos por dia
- Fotos ficam vinculadas ao relatório do dia

**Passo 5 — Exportar PDF**
- **PDF por dia:** botão "PDF" no header → relatório completo do dia
- **PDF por período:** selecione data inicial e final
- **Seleção de áreas:** checkboxes para incluir/excluir seções:
  - Atividades, Equipes/M.O., Equipamentos, Materiais, Fotos
  - LPS/PPC, Planejamento, Suprimentos, Qualidade, Financeiro/EVM, Mão de Obra
- PDF gerado em modo claro (fundo branco) para impressão

---

## 8. RDO (Relatório Diário de Obra)

**Resumo:** Registro diário digital do canteiro de obras. Substitui o RDO em papel com rastreabilidade total.

### Fluxograma
```
[1. Criar RDO] → [2. Registrar Equipes e Trechos] → [3. Fotos e Ocorrências] → [4. Fechar e Exportar PDF]
```

### Passo a Passo

**Passo 1 — Criar RDO do Dia**
- Clique "Novo RDO" ou selecione a data
- Registre condições climáticas (manhã: sol/nublado/chuva, tarde: idem)
- RDO fica disponível para preenchimento durante todo o dia

**Passo 2 — Registrar Equipes e Trechos Executados**
- Equipes em campo: nome do trabalhador, função, horas
- Trechos executados: código do trecho, metros lineares, material
- Equipamentos utilizados: tipo, horas

**Passo 3 — Fotos e Ocorrências**
- Upload de fotos geolocalizadas (GPS embutido do celular)
- Registre ocorrências: chuva forte, acidente, parada, visita fiscalização
- Tudo fica rastreável e vinculado ao dia

**Passo 4 — Fechar e Exportar**
- Revise todos os dados preenchidos
- Fechar RDO (requer que não haja FVS pendente para o dia — integração Qualidade)
- PDF gerado automaticamente com formatação profissional

---

## 9. QUALIDADE (FVS)

**Resumo:** Ficha de Verificação de Serviço digital. Inspeção de conformidade com registro fotográfico e tratamento de Não Conformidades.

### Fluxograma
```
[1. Criar FVS] → [2. Preencher Checklist] → [3. Tratar NCs] → [4. Fechar FVS]
```

### Passo a Passo

**Passo 1 — Criar FVS**
- Selecione o serviço a inspecionar e o trecho/local
- Defina responsável pela inspeção e data

**Passo 2 — Preencher Checklist**
- Para cada item de verificação: marque Conforme ou Não Conforme
- Adicione fotos como evidência de cada item
- Itens NC geram automaticamente registro de Não Conformidade

**Passo 3 — Tratar Não Conformidades**
- Cada NC tem: descrição do problema, ação corretiva proposta, responsável, prazo
- Acompanhe resolução até fechamento
- NC aberta bloqueia fechamento do RDO do dia (integração cross-module)

**Passo 4 — Fechar FVS**
- Quando todos os itens estão verificados e NCs tratadas
- FVS fechada fica disponível no histórico
- Rastreabilidade completa: quem inspecionou, quando, resultado

---

## 10. QUANTITATIVOS

**Resumo:** Composição de orçamento com base SINAPI/SEINFRA. Calculadora de quantitativos com BDI.

### Fluxograma
```
[1. Selecionar Base] → [2. Montar Orçamento] → [3. Calcular BDI] → [4. Exportar]
```

### Passo a Passo

**Passo 1 — Selecionar Base de Preços**
- SINAPI (federal), SEINFRA (estadual), ou base customizada
- Base determina os preços unitários de referência

**Passo 2 — Montar Orçamento**
- Busque itens por código ou descrição na base selecionada
- Informe quantidades para cada item
- O sistema calcula automaticamente: custo unitário × quantidade = custo total

**Passo 3 — Calcular BDI**
- Defina o BDI global (padrão: 25%)
- O sistema aplica BDI sobre cada item
- Veja o impacto no custo total do orçamento

**Passo 4 — Exportar**
- Excel (.xlsx) com formatação completa e fórmulas
- CSV para integração com outros sistemas
- Salve como template para reutilização em orçamentos futuros

---

## 11. MÃO DE OBRA

**Resumo:** Cadastro de funcionários, alocação por frente de obra, certificações e produtividade.

### Fluxograma
```
[1. Cadastrar Funcionários] → [2. Alocar por Frente] → [3. Acompanhar Produtividade]
```

### Passo a Passo

**Passo 1 — Cadastrar Funcionários**
- Dados: nome, CPF, função, equipe, departamento, tipo de contrato
- Importação em massa via Excel
- Certificações e treinamentos (com data de validade)

**Passo 2 — Alocar por Frente de Obra**
- Dashboard de alocação diária: quem está onde
- Alertas de NR: certificações vencidas ou prestes a vencer
- Histórico de alocação por trabalhador

**Passo 3 — Acompanhar Produtividade**
- Horas trabalhadas por equipe/dia (integrado com RDO)
- Custo de mão de obra integrado com EVM (CPI)
- Relatórios de produtividade por período: m/equipe/dia

---

## 12. GESTÃO 360

**Resumo:** Dashboard executivo com CPI/SPI, curva S e alertas. Não tem fluxo sequencial — é módulo de consulta.

### Uso
- Acesse o módulo para ver todos os indicadores consolidados
- CPI/SPI em tempo real (alimentados por RDO, Planejamento, Suprimentos)
- Curva S de progresso geral
- Alertas integrados de todos os módulos
- Ideal para diretores: 30 segundos para saber o status de tudo

---

## 13. FINANCEIRO / EVM

**Resumo:** Earned Value Management com EAC, ETC, VAC, TCPI. Gráficos de tendência e projeções.

### Uso
- Dados calculados automaticamente a partir de Planejamento + RDO + Medição
- **CPI** (Cost Performance Index): custo realizado vs orçado
- **SPI** (Schedule Performance Index): prazo realizado vs planejado
- **EAC** (Estimate at Completion): projeção de custo final
- **TCPI** (To-Complete Performance Index): esforço necessário para recuperar
- Gráficos de tendência ao longo do tempo

---

## 14. TORRE DE CONTROLE

**Resumo:** War room digital para gestão por exceção. Drill-down do portfólio à atividade.

### Uso
- Visão de todos os projetos/obras em uma tela
- Matriz RAG (Red/Amber/Green) por projeto
- Clique para drill-down: projeto → frente → atividade
- Feed de alertas em tempo real
- Ideal para gerentes e diretores de múltiplas obras

---

## Notas para Produção (Remotion)

- **Cores padrão:** fundo #1f1f1f, accent #f97316 (laranja), texto #f5f5f5
- **Fontes:** Space Grotesk para títulos, sistema para corpo
- **Animações sugeridas:** fade-in por passo, setas animadas no fluxograma
- **Duração sugerida por módulo:** 60-90 segundos (módulos grandes), 30-45 segundos (módulos simples)
- **Módulos prioritários para vídeo:** LPS/Lean, Planejamento, Suprimentos, Medição, RDO
