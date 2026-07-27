# Pré-Construção & Projetos

> **Rota(s):** `/app/projetos` e `/app/pre-construcao` são hoje redirects para `/app/torre-de-controle?aba=projetos` (`src/App.tsx:129` e `src/App.tsx:134`). O módulo Projetos é renderizado como a aba **"Projetos"** dentro da Torre de Controle (`src/features/torre-de-controle/index.tsx:24-30` e `:139`); a Pré-Construção é a 3ª aba **dentro** do detalhe de um projeto (`src/features/projetos/components/ProjetosDetail.tsx:14-20`, `:63-67`).
> **Store(s):** `useProjetosStore` (`src/store/projetosStore.ts`, chave persist `cdata-projetos`) · `usePreConstrucaoStore` (`src/store/preConstrucaoStore.ts`, chave persist `cdata-preconstrucao`).
> **Grupo na sidebar:** Não há item próprio na sidebar — o acesso é pela **Torre de Controle** (o grupo `PROJETOS` da sidebar contém apenas "Economia", `src/components/shared/Sidebar.tsx:69`). Ambos os módulos foram absorvidos pela Torre de Controle.

---

## O que é / problema que resolve

O par **Projetos + Pré-Construção** é o núcleo de cadastro e concepção de obra da ConstruData. **Projetos** é a entidade central que representa cada empreendimento: guarda identificação, responsáveis, cronograma por fases (planejamento e execução), linhas orçamentárias, documentos, localização geográfica e demandas. Cada projeto é 1 linha na tabela `projects`, com fases/orçamento/documentos serializados no `payload` jsonb (`supabase/migrations/0022_projects.sql:5-19`, `src/store/projetosStore.ts:83-95`).

O papel estratégico de Projetos é ser **a ponte (bridge) entre módulos**: o `id` do projeto (`projectId`) foi retro-adicionado como coluna `project_id` (nullable + FK + índice) a ~28 tabelas de RDO, Planejamento, Suprimentos, Mão de Obra, LPS e Relatório 360 (`supabase/migrations/0023_projects_fk_retro.sql:8-28`). A partir daí, EVM (work packages), agenda, change orders e demais entidades passam a poder amarrar-se a um projeto. A entidade `ConstructionSite` (obra na Torre) também carrega um `projectId` opcional exatamente como "bridge p/ EVM/Change Orders/Agenda" (`src/types/index.ts:207`).

**Pré-Construção** é o fluxo de *estimativa e orçamentação inteligente* que roda antes (ou dentro) de um projeto: um pipeline de 5 passos — Upload → Extração → Normalização → Matching → Proposta — que pega arquivos de projeto (PDF/BIM/planilha), extrai quantitativos (takeoff), normaliza itens, casa cada item com bases de preço (SINAPI/SEINFRA/própria), aplica BDI e emite uma proposta orçamentária imprimível (`src/features/pre-construcao/index.tsx:13-19`). Resolve o problema de sair da planilha manual: a extração de quantitativos, o matching de preços e o cálculo de BDI acontecem em um único fluxo rastreável, com detecção automática de cláusulas de risco no contrato.

## Para quem (papéis / persona)

- **Gerente / Diretor / Owner** — únicos papéis autorizados a **criar/editar/excluir projetos** (RLS `projects_insert_with_role` / `projects_update_role` exige `has_role(['gerente','diretor','owner'])`, `supabase/migrations/0027_grupo_nucleo_rls.sql:14-27`).
- **Engenheiro / Planejador / Orçamentista** — operam a Pré-Construção (takeoff, matching, proposta) e anexam documentos (upload de documentos exige `has_role(['engenheiro','planejador','qualidade','gerente','diretor','owner'])`, `0027_grupo_nucleo_rls.sql:40-45`).
- **Qualidade** — pode anexar/gerir documentos do projeto (mesma policy de documentos).
- Persona típica: quem prepara proposta comercial / orçamento de licitação (Pré-Construção) e quem administra o portfólio de obras e seu ciclo de vida (Projetos).

## Funcionalidades detalhadas

### MÓDULO PROJETOS

#### Layout geral (`src/features/projetos/index.tsx`)
Split **lista (sidebar) + detalhe**. No mobile há uma barra de abas "Lista" / "Detalhes" (`index.tsx:11-14`, `:24-48`). Renderiza condicionalmente 3 modais conforme o estado de edição da store: `ProjectDialog` (editingProjectId), `PhaseDialog` (editingPhase), `BudgetDialog` (editingBudgetLine) (`index.tsx:50-52`).

#### Sidebar de projetos (`ProjetosSidebar.tsx`)
Lista todos os projetos da org com código, nome, badge de status e barra de **"Progresso geral"** = média do `progress` de TODAS as fases (planning + execution) (`ProjetosSidebar.tsx:20-24`). Cabeçalho mostra contagem `Projetos (n)` e botão **"Novo"** → `setEditingProject('new')` (`:41-47`). Cada card exibe o gerente. Vazio → CTA "Criar primeiro projeto" (`:104-113`).

#### Detalhe do projeto — 7 abas (`ProjetosDetail.tsx:12-20`, `:61-71`)
1. **Visão Geral** (`TabVisaoGeral.tsx`) — 4 StatCards: Total Orçado, Gasto Projetado, Utilização (%), Dias Restantes. Card de identificação com botão "Editar Projeto". Resumo de fases (Planejamento + Execução) com barras. Mapa Leaflet (OpenStreetMap) se houver `lat`/`lng`, com marcador laranja customizado (`TabVisaoGeral.tsx:12-20`, `:132-157`).
2. **Planejamento** (`TabPlanejamento.tsx`) — grade de PhaseCards das `planningPhases`; cada card mostra status, responsável, alerta de atraso em dias (`differenceInDays`), barra de progresso, datas e notas; lápis → `setEditingPhase({group:'planning'})` (`TabPlanejamento.tsx:112-130`).
3. **Pré-Construção** — embute a `PreConstrucaoPage` inteira dentro da aba (`ProjetosDetail.tsx:63-67`).
4. **Execução** (`TabExecucao.tsx`) — PhaseCards das `executionPhases` (`group:'execution'`) **+** painel **"Últimos Relatórios Diários"**: puxa do `useRelatorio360Store`, filtra reports cujo `projectName` contém a 1ª palavra do nome do projeto, ordena por data desc e mostra os 5 mais recentes; clicar navega para `/relatorio360` via `goToDate` (`TabExecucao.tsx:101-171`).
5. **Orçamento** (`TabOrcamento.tsx`) — resumo (Total Orçado/Projetado/Gasto/Utilização) + tabela de `budgetLines` (Tipo, Descrição, Orçado, Projetado, Gasto, **Saldo = budgeted − spent**, barra de Utilização com cores por faixa). CRUD de linhas (add/editar/excluir com confirmação inline). Bloco **"Quantitativos Vinculados"**: puxa `currentItems` do `useQuantitativosStore` e filtra por `project.code` presente em description/category/notes (`TabOrcamento.tsx:44-60`, `:178-208`).
6. **3D / 4D / 5D** (`TabVisualizacao.tsx`) — sub-abas 3D/4D/5D. Injeta o projeto convertido em `BimProject` no `useBimStore` via `projectToBim` (`TabVisualizacao.tsx:22-38`); 3D mostra o modelo com "Avanço médio" = média de progresso das fases de execução; 4D força `colorMode='date'` (timeline construtiva); 5D força `colorMode='cost'` (heatmap de custo). BimCanvas e painéis 4D/5D são lazy-loaded (Three.js em chunk próprio). Abaixo, tabela de **Demandas e Custos** (`project.demands`) (`:172-203`).
7. **Documentos** (`TabDocumentos.tsx`) — dropzone (máx. 10 MB/arquivo), leitura via `FileReader` → base64, categorização automática por nome do arquivo (`detectCategory`, `TabDocumentos.tsx:41-48`), chips de filtro por categoria, preview em modal (imagem / iframe PDF / fallback download) e exclusão com confirmação (`:249-306`).

#### Modais
- **ProjectDialog** (`ProjectDialog.tsx`) — formulário react-hook-form + zod (`projectInfoSchema`). Seções: Identificação (código/status/nome), Responsáveis, Cronograma (datas), Descrição, Informações Adicionais (contrato, cliente, gerente de projeto, nível de risco, prioridade) e **Localização** com geocodificação via Nominatim/OpenStreetMap (`handleGeocode`, `ProjectDialog.tsx:150-176`) e mapa Leaflet clicável para fixar lat/lng. **Todos os campos são opcionais** — o `onSubmit` aplica defaults sensatos (código `PRJ-<timestamp>`, nome "Projeto sem título" etc.) (`:178-218`). Ao **criar**, o projeto é semeado com 3 fases de planejamento (Engenharia e Design, Pré-construção, Aquisições) e 3 de execução (Construção, Controle do Projeto, Encerramento), além de arrays vazios de budget/demands/documents (`:200-212`). Excluir com dupla confirmação.
- **PhaseDialog** (`PhaseDialog.tsx`) — edita status, progresso (slider 0–100), datas e notas de uma fase → `updatePhase` (`PhaseDialog.tsx:68-75`).
- **BudgetDialog** (`BudgetDialog.tsx`) — cria/edita/exclui uma linha orçamentária (tipo, descrição, orçado, projetado, gasto) → `addBudgetLine` / `updateBudgetLine` / `deleteBudgetLine` (`BudgetDialog.tsx:78-94`).

### MÓDULO PRÉ-CONSTRUÇÃO

Pipeline de 5 passos guiado pela `PipelineBar` (Upload · Extração · Normalização · Matching · Proposta, `PipelineBar.tsx:9-15`). Barra lateral esquerda `AnalysisHistory` lista análises salvas e permite "Nova Análise" (`resetPipeline`). O passo atual (`currentStep`) escolhe o componente (`pre-construcao/index.tsx:13-19`, `:35`).

1. **Upload** (`UploadZone.tsx`) — drag-and-drop / seleção de arquivos. Aceita `.pdf .ifc .rvt .dwg .xlsx .docx`, máx. 10 arquivos (`UploadZone.tsx:11-13`). "Iniciar Análise" (`initAnalysis`): para cada PDF chama `extractFromPdf`; para os demais formatos usa `mockBimExtraction`; agrega itens, roda `detectClauses` sobre o texto completo e avança para Extração (`:93-121`). Em modo demo há atalho "Carregar Dados de Demonstração".
2. **Extração** (`ExtractionView.tsx`) — tabela editável de itens de takeoff (Descrição, Quantidade, Unidade — edição inline; Confiança com badge por faixa; Arquivo de origem). Adicionar/remover itens. Painel direito **"Cláusulas de Risco"** com badges de severidade (Crítico/Atenção/Info), trecho, explicação e recomendação (`ExtractionView.tsx:198-249`).
3. **Normalização** (`NormalizacaoView.tsx`) — `buildSuggestions` gera sugestões automáticas: conversão de unidade **cm → m** (divide qty por 100), **unificação de itens duplicados** (mesmas 3 primeiras palavras → soma das quantidades) e **limpeza de descrição** (espaços/caixa) (`NormalizacaoView.tsx:18-116`). Aceitar/Rejeitar por item ou em lote ("Aprovar Todos"/"Rejeitar Todos").
4. **Matching** (`CostMatchingView.tsx`) — algoritmo `scoreMatch` = % de palavras em comum entre descrição do item e da base (`CostMatchingView.tsx:12-22`); `findTopMatches` traz os 3 melhores acima de score 20 (`:24-50`). Abas **SINAPI / SEINFRA / Base Própria** (dados de `mockSinapi`/`mockSeinfra`). Seleção por radio, override de preço unitário por linha, e CRUD da base própria. Botão de "atualizar SINAPI" (mock 1.5 s). "Avançar → Proposta" (`handleAdvance`) calcula `totalCost = Σ quantidade × (override ?? unitCost)` das seleções, salva a sessão e avança (`:376-392`).
5. **Proposta** (`ProposalView.tsx`) — monta linhas a partir dos matches selecionados (`directCost = quantidade × unitCost`), painel de **BDI** editável (Administração Central, ISS, PIS/COFINS, Seguro e Garantia, Lucro), KPI cards (Custo Direto Total, BDI R$, Preço Final com BDI, Nº de Itens) e **modal de impressão** (`window.print()`) com layout branco de proposta (`ProposalView.tsx:126-149`, `:31-111`).

#### Histórico (`AnalysisHistory.tsx`)
Coluna à esquerda com as `sessions` salvas: data, nº de arquivos, nº de itens, custo total e badge de status do pipeline. Botão "Nova Análise" reinicia o pipeline mantendo o histórico (`AnalysisHistory.tsx:27-101`).

## Dados que gera

**Tabela `projects`** (`supabase/migrations/0022_projects.sql:5-19`) [schema]: `id uuid`, `organization_id` (FK organizations, ON DELETE CASCADE), `code`, `name`, `status` (default `planning`), `start_date`, `end_date`, **`payload jsonb`** (carrega `planningPhases[]`, `executionPhases[]`, `budgetLines[]`, `demands[]`, `documents[]`, notas), `created_by`, `created_at/updated_at`, `deleted_at` (soft delete). Unicidade `(organization_id, code)`. O mapeamento objeto→linha está em `projectToRow` (`src/store/projetosStore.ts:83-95`) — o objeto `Project` inteiro vai em `payload`.

**Tabela `project_documents`** (`0022_projects.sql:30-43`) [schema]: metadata de anexos — `name`, `mime_type`, `size_bytes`, **`storage_path`** (o binário fica no bucket Storage `project-documents`), `payload jsonb`, `project_id` (FK, ON DELETE CASCADE). URL assinada gerada on-demand (`projetosStore.ts:338-342`, `resolveDocumentUrl`).

**Tabela `preconstrucao_sessions`** (`0025_preconstrucao.sql:6-19`) [schema]: `id`, `organization_id`, **`project_id` nullable** (FK projects, ON DELETE SET NULL), `file_names text[]`, `total_items`, `total_cost numeric(14,2)`, `status` (default `proposal`), **`payload jsonb`** com o snapshot completo (`takeoffItems`, `costMatches`, `clauses`, `bdiConfig`) para auditoria/replay (`src/store/preConstrucaoStore.ts:222-263`). Persiste **apenas sessões finalizadas** — o pipeline em andamento é volátil (comentário do próprio schema, `0025_preconstrucao.sql:2-4`).

**Entidades TypeScript-chave** [código]: `Project`, `ProjectPhase`, `BudgetLine`, `DesignDemand`, `ProjectDocument` (`src/types/index.ts:125-187`); `TakeoffItem`, `CostMatch`, `ContractClause`, `BDIConfig`, `AnalysisSession`, `SinapiEntry`, `PipelineStep` (`src/types/index.ts:305-368`).

## Cálculos, KPIs e regras de negócio

- **Progresso geral do projeto** = `round(Σ progress de todas as fases / nº de fases)` (`ProjetosSidebar.tsx:20-24`) [código].
- **Avanço médio (BIM 3D/4D)** = média de `progress` só das fases de execução (`TabVisualizacao.tsx:43-45`) [código].
- **Utilização orçamentária** = `totalSpent / totalBudgeted × 100`; **Saldo** por linha = `budgeted − spent` (`TabOrcamento.tsx:50-53`, `:95`) [código]. Cores da barra: verde ≤75%, laranja 75–90%, vermelho >90% (`:18-19`).
- **Dias Restantes** = `differenceInCalendarDays(endDate, hoje)` (`TabVisaoGeral.tsx:66-69`) [código].
- **Score de matching** = `(palavras em comum / max(palavras)) × 100`, arredondado (`CostMatchingView.tsx:12-22`) [código].
- **Custo direto** por linha = `quantidade × (overrideUnitCost ?? unitCost)` (`ProposalView.tsx:135-136`, `CostMatchingView.tsx:383`) [código].
- **BDI total** = soma simples de `adminCentral + iss + pisCofins + seguro + lucro` (`calcBDI`, `preConstrucaoStore.ts:353-356`) — defaults 4.0 / 3.0 / 3.65 / 0.8 / 7.5 = **18.95%** (`:85-91`) [código].
- **Preço final** = `custoDireto × (1 + bdiTotal/100)`; **BDI R$** = `custoDireto × bdiTotal/100` (`ProposalView.tsx:147-149`) [código].
- **Normalização**: cm→m divide qty por 100; duplicados (3 primeiras palavras iguais) somam quantidades (`NormalizacaoView.tsx:59-88`) [código].
- **Confiança do takeoff**: PDF gera valor aleatório 70–95; mock BIM 88–96 (`usePdfExtraction.ts:42`, `:101`) [código].
- **Detecção de cláusulas** (`useClauseDetection.ts`): 8 regras regex — *críticas* (multa >1%, rescisão unilateral, responsabilidade ilimitada), *atenção* (ausência de reajuste, prazo de pagamento <30 dias, especificação fechada por marca), *info* (certificações especiais, restrição de origem) (`useClauseDetection.ts:9-127`) [código].
- **`recompute_project_kpis(project_id)`** [schema] — RPC servidor que consolida por projeto: **BAC** = `Σ evm_work_packages.total_budget_brl`, **AC** = `Σ evm_cost_accounts.total_cost_brl`, **% progresso** = `AVG(plan_trechos.payload.percentComplete)`, restrições abertas, NCs abertas, contagem de RDO, e um **health** derivado (red/yellow/green) (`0035_cross_module_triggers.sql:213-285`).

## Integrações — a "camada única"

**O que Projetos ALIMENTA (é a fonte do `projectId`):**
- **Bridge estrutural**: `0023_projects_fk_retro.sql:8-28` adiciona `project_id` a rdo, plan_trechos, plan_teams, suppliers, purchase_orders, invoices, workers, labor_crews, lps_*, master_activities, daily_report_* e mais — costurando o portfólio inteiro ao projeto.
- **BIM**: `projectToBim` (`src/features/projetos/utils/projectToBim.ts:49-132`) converte fases em lajes/pilares/paredes com `constructionDate` e custo rateado, alimentando o `useBimStore` para as views 3D/4D/5D.
- **`project_dashboard_view`** [schema] (`0036_project_dashboard_view.sql:21-134`): materialized view que agrega por projeto BAC, AC, % completo, contagem/última data de RDO, FVS, restrições LPS abertas, workers, ausências abertas, equipamentos alocados e POs abertas + `health`. Exposta via `get_project_dashboard()` SECURITY DEFINER filtrada por `user_org()` (`:148-157`) e recarregada por `refresh_project_dashboard()`.
- **eventBus** (`src/lib/eventBus.ts:61-62`): emite `project.created` e `project.updated` para outros stores reagirem.

**O que os módulos CONSOMEM aqui:**
- **Execução** lê `relatorio360Store` (RDOs vinculados por nome, `TabExecucao.tsx:103-110`).
- **Orçamento** lê `quantitativosStore` (quantitativos vinculados por `project.code`, `TabOrcamento.tsx:56-60`).
- **Pré-Construção** grava `preconstrucao_sessions` com `project_id` (ligação a um projeto; hoje o store envia `project_id: null` por padrão, `preConstrucaoStore.ts:250`).

**Triggers de servidor** (`0035_cross_module_triggers.sql`): embora não disparados diretamente por Projetos, formam a "verdade única" do ecossistema em que o projeto é o eixo — RDO→Planejamento, PO fechada→EVM AC, FVS NC→restrição LPS, ausência→audit_log.

**Realtime** (`src/lib/realtime.ts:53-54`): `projects` e `project_documents` estão na lista `WATCHED_TABLES`; qualquer INSERT/UPDATE/DELETE (filtrado por `organization_id`) emite `realtime.row_changed` no eventBus, com coalescing de ~350 ms para evitar re-pulls em rajada.

## Eficiência gerada

- **Menos planilha em orçamentação**: takeoff (extração de quantitativos do PDF/BIM) + matching contra SINAPI/SEINFRA + BDI + proposta imprimível em um só fluxo, substituindo a planilha orçamentária manual e o cruzamento manual de tabelas de preço. [inferido]
- **Risco contratual antecipado**: as 8 regras de detecção de cláusulas sinalizam multas abusivas, rescisão unilateral e falta de reajuste antes da assinatura — trabalho que normalmente seria leitura jurídica manual. [inferido]
- **Dado único / hub de obra**: com o projeto como âncora (`projectId` em ~28 tabelas + materialized view de dashboard), orçamento, fases, documentos, BIM, RDOs e quantitativos convergem num único registro, eliminando reconciliação entre módulos e permitindo um "Comando Central" com KPIs cross-module já agregados. [inferido]
- **Rastreabilidade/auditoria**: cada proposta finalizada guarda um snapshot completo (`payload` de `preconstrucao_sessions`) que permite replay/auditoria posterior (`preConstrucaoStore.ts:252-256`). [código + inferido]
- **Automação de conversão**: `projectToBim` gera um modelo 3D/4D/5D navegável a partir dos dados de fase/orçamento sem qualquer modelagem manual. [inferido]

## Como sincroniza

**Local-first** via `storeSync`: ambas as stores mantêm uma fila `pendingSync` de operações (`makeOp`) e um par `flush()` (empurra a fila para o Supabase) / `pull()` (traz `payload` de volta). Projetos: 1 op de insert/update/delete por mutação, com `changedColumns` no update para enviar só colunas alteradas (anti-clobber concorrente, `projetosStore.ts:148-161`). Pré-Construção persiste **só** `sessions`, `bdiConfig`, `customBase` e a fila (`partialize`, `preConstrucaoStore.ts:333-340`) — o pipeline em andamento fica em memória.

**Realtime**: `projects`/`project_documents` observadas por org (ver seção acima). O `pull` de Projetos é protegido: se houver op pendente para `projects` (flush falhou/offline), **não** sobrescreve a lista local, evitando que um projeto ainda não sincronizado suma (`projetosStore.ts:368-387`).

**RLS multi-tenant por `organization_id`** (`0027_grupo_nucleo_rls.sql`): SELECT restrito à org do usuário (`user_org()`) e `deleted_at IS NULL`; INSERT/UPDATE gated por `has_role` (projetos: gerente/diretor/owner; documentos: também engenheiro/planejador/qualidade). **DELETE físico é bloqueado** (`USING (false)`, `:29` e `:55`) — a exclusão de projeto/documento passa por soft-delete/aprovação via RPC `request_action` (`approvalActionType: 'delete_project'` / `'delete_project_document'`, `projetosStore.ts:172` e `:307-310`; `src/lib/storeSync.ts:208-210`). Troca de empresa ativa reseta o escopo local (`ensureTenantScope`, `projetosStore.ts:123-137`).

**Offline**: se `navigator.onLine` for falso o `flush` marca `syncStatus: 'offline'` e enfileira; um listener de `window 'online'` re-dispara o flush automaticamente em ambas as stores (`projetosStore.ts:403-407`, `preConstrucaoStore.ts:345-349`).
