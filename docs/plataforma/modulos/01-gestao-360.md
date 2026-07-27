# Gestão de Projeto 360

> **Rota(s):** `/app/gestao-360` (`src/App.tsx:139`) · rota legada `/app/relatorio360` → redireciona para `/app/gestao-360` (`src/App.tsx:123`) · **Store(s):** `gestao360Store` (`src/store/gestao360Store.ts`), `relatorio360Store` (`src/store/relatorio360Store.ts`), + hook `useRelatorio360` (`src/hooks/useRelatorio360.ts`) e `operacaoCampoStore` (LPS/PPC) · **Grupo na sidebar:** GESTÃO (`src/components/shared/Sidebar.tsx:36-42`)

## O que é / problema que resolve

O Gestão 360 é o **centro de comando executivo** da obra: consolida em uma só tela o que está espalhado nos demais módulos (RDO, Suprimentos, Mão de Obra, Equipamentos, Medição, Planejamento, EVM, Qualidade) e transforma isso em indicadores de custo e prazo em tempo real. O subtítulo do cabeçalho resume a proposta: "Centro de Comando · Custo em Tempo Real · Ordens de Mudança" (`src/features/gestao-360/components/Gestao360Header.tsx:128`).

O problema que resolve é a fragmentação do controle de projeto. Em vez de o engenheiro/gerente montar planilhas de acompanhamento cruzando lançamentos de folha, notas fiscais, medições e diários de obra, o módulo monta automaticamente um **livro-razão de custos por evento** (apontamento, recebimento, NF, consumo de estoque, RDO, medição, avanço físico) e recalcula CPI/SPI, EAC e variação de orçamento a cada render (`src/features/gestao-360/components/JobCostingPanel.tsx:155-378`). Também formaliza mudanças de escopo/custo/prazo/segurança como **Ordens de Mudança** rastreáveis com fluxo de aprovação.

A aba **Relatório 360** (feature `src/features/relatorio360`) é o Relatório Diário de Obra (RDO gerencial) que vive embutido dentro do Gestão 360 — foi promovida de módulo independente para aba (comentário em `src/App.tsx:122`).

## Para quem (papéis / persona)

- **Gerente de projeto / Diretor / Owner** — leem os KPIs de topo (EAC, Δ Orçamento, CPI, SPI, alertas críticos) e aprovam/rejeitam Ordens de Mudança.
- **Engenheiro / Planejador** — abrem Ordens de Mudança, alimentam o Daily Report e o Relatório 360.
- Na "Minha Rotina" o módulo é sugerido como leitura **diária** e **semanal** para persona engenheiro/gerente (`src/store/userRoutineStore.ts:49,59`; `src/features/minha-rotina/moduleRegistry.ts:26-31`).
- **RLS/permissão** [schema]: `INSERT`/`UPDATE` em `change_orders` exigem papel em `['engenheiro','planejador','gerente','diretor','owner']` (`supabase/migrations/0033_sprint6_rls.sql:91-98`); o *delete* de Ordem de Mudança exige `gerente` via aprovação (`supabase/migrations/0034_sprint6_rpcs.sql:83`).

## Funcionalidades detalhadas

O cabeçalho fixo (`Gestao360Header`) sempre exibe: título, **seletor de projeto/núcleo** (`select` que alterna entre "Todos os projetos/nucleos (360)" e um projeto específico — `src/features/gestao-360/components/Gestao360Header.tsx:134-147`), uma faixa de **6 KPIs** e a barra de 5 abas. As abas são (`Gestao360Header.tsx:11-17`):

### 1. Dashboard de Obras (`activeTab: 'dashboard'`)
Renderiza `Gestao360MapDashboard` (`src/features/gestao-360/components/Gestao360MapDashboard.tsx`), que é o componente compartilhado `ControlMap` recebendo a lista de projetos **mesclada com os canteiros** (`mergeProjectsWithSites` une `projetosStore.projects` + `torreDeControleStore.sites` — `src/features/gestao-360/utils/siteProjects.ts:52-63`). Mapa geográfico das obras com status/risco.

### 2. Daily Report (`activeTab: 'daily-report'`)
Painel `DailyReportPanel` (`src/features/gestao-360/components/DailyReportPanel.tsx`) — consolidação diária de UMA obra numa data:
- **Seletor de data** (`<input type="date">`, default = hoje — `DailyReportPanel.tsx:74,168-176`).
- **4 KPIs do dia**: "RDOs do dia" (RDOs regulares + RDOs Sabesp), "Atividades", "Fotos", "NCs abertas" (`DailyReportPanel.tsx:179-184`).
- **Radar 360 compacto** (`Ecosystem360Panel` em modo `compact` — `DailyReportPanel.tsx:186`).
- **Seção "Atividades e RDOs"**: junta, para a obra/data, tarefas da Agenda, atividades do Relatório 360, serviços dos RDOs regulares e atividades executadas dos RDOs Sabesp (`DailyReportPanel.tsx:116-147`). O casamento obra↔registro é textual/heurístico via `sameProject` (nome, código ou primeira palavra do nome — `DailyReportPanel.tsx:47-51`).
- **Seção "Alertas 360"**: Manutenções do dia, Requisições/OCs, FVS/Qualidade, e **Impacto financeiro** = soma de `impactCostBRL` das Ordens de Mudança daquela obra submetidas na data (`DailyReportPanel.tsx:157-159,222-224`).
- **Seção "Registro fotográfico"**: até 8 fotos dos relatórios 360 da data (`DailyReportPanel.tsx:148,229-242`).

### 3. Custo em Tempo Real (`activeTab: 'jobacosting'`)
Painel `JobCostingPanel` (`src/features/gestao-360/components/JobCostingPanel.tsx`) — o "job costing" / **livro-razão de custo**. É a aba mais rica:
- **4 KPIs de topo**: Orçamento planejado, Realizado (AC), Comprometido, EAC/Variação (`JobCostingPanel.tsx:475-491`).
- **Cartão "Livro razão de custo"** listando as tags dos módulos que geraram eventos (chips) (`JobCostingPanel.tsx:494-514`).
- **Cartão "Eventos de custo"** com contagem de eventos Reais / Comprometidos / Físicos (`JobCostingPanel.tsx:516-535`).
- **"Custo por Categoria"** — barras Orçado × Realizado × EAC por linha de orçamento (`labor`, `equipment`, `materials`, `subcontract`, `overhead`, `other` — `JobCostingPanel.tsx:88-126,538-558`).
- **"Índices de Desempenho"** — dois medidores circulares (gauges) CPI e SPI, com faixas Bom (≥0,9) / Atenção (≥0,7) / Crítico (`JobCostingPanel.tsx:48-86,560-569`).
- **Tabela "Eventos do Livro Razão"** (até 80 linhas): Data, Módulo, Projeto/Núcleo, Evento, Tipo (`real`/`comprometido`/`físico`/`orçamento`), Valor (`JobCostingPanel.tsx:572-617`).
- **"Progresso das Fases"** — barras por fase de planejamento/execução com % e dias restantes/atraso, com link para "Ver em Projetos" (`/app/torre-de-controle?aba=projetos`) (`JobCostingPanel.tsx:619-656`).

### 4. Ordens de Mudança (`activeTab: 'changeorders'`)
Painel `ChangeOrderPanel` (`src/features/gestao-360/components/ChangeOrderPanel.tsx`) — CRUD completo de OMs:
- **Faixa de contadores** por status: Rascunho, Aguard. Aprovação, Aprovada, Rejeitada (`ChangeOrderPanel.tsx:346-366`).
- **Lista** filtrada pelo projeto selecionado (`ChangeOrderPanel.tsx:340-342`).
- **Formulário "Nova OM"** (`NewCOForm`): título*, tipo (`Escopo`/`Custo`/`Prazo`/`Segurança` — `ChangeOrderPanel.tsx:19-24`), descrição, impacto de custo (R$), impacto de prazo (dias), engenheiro responsável* → cria com status `draft` (`ChangeOrderPanel.tsx:254-268`).
- **Detalhe** (`CODetail`): mostra impacto de custo (vermelho se ≥0, verde se negativo) e de prazo, fotos, metadados de submissão/revisão e origem (`linkedModule`). Ações conforme status:
  - `draft` → botão **"Enviar para Aprovação"** (`submitChangeOrder` → status `submitted`).
  - `submitted` → campos Revisor + Notas e botões **Aprovar/Rejeitar** (`reviewChangeOrder` → status `approved`/`rejected`, grava `reviewedBy`, `reviewedAt`, `reviewNotes`) (`ChangeOrderPanel.tsx:199-229`).
  - **Adicionar foto** (draft ou submitted): lê o arquivo como base64 via `FileReader` e chama `addPhoto` (versão local, sem upload — `ChangeOrderPanel.tsx:83-97`). Obs.: existe também `uploadPhoto` no store (upload real ao Storage), mas o botão do painel usa a variante `addPhoto` local.

### 5. Relatório 360 (`activeTab: 'relatorio360'`)
Renderiza `Relatorio360Page` (`src/features/relatorio360/index.tsx`) full-bleed. É o RDO gerencial diário navegável por data:
- **`ReportHeader`** — navegação de dia (anterior/próximo/date picker), **exportação PDF do dia** e **exportação por período** (com seletor de projeto/núcleo e checkboxes de áreas: Atividades, Equipes/M.O., Equipamentos, Materiais, Fotos, LPS/PPC, Planejamento, Suprimentos, Qualidade, Financeiro/EVM, Mão de Obra) via `printRelatorio360PDF` (`src/features/relatorio360/components/ReportHeader.tsx:34-46,74-90`).
- **`SummaryRow`** — 7 StatCards: Atividades, Apontamentos, Horas M.O. (+custo), Equipamentos, Custo Total (M.O.+Equip.), PPC Semanal, Desvio Acumulado (`src/features/relatorio360/components/SummaryRow.tsx:44-100`).
- **`Ecosystem360Panel` ("Radar 360")** — ver seção Integrações.
- **`KanbanBoard`** — atividades do dia arrastáveis entre colunas `planned` → `in_progress` → `completed` (drag por *pointer events*), com modal de edição (`src/features/relatorio360/components/kanban/KanbanBoard.tsx:12,135-149`); salvar a atividade tenta **propagar o progresso** para a fase correspondente em `projetosStore` (`KanbanBoard.tsx:99-118`).
- **`CrewsPanel`** — equipes e cartões de ponto (timecards) com CRUD inline: editar encarregado/tipo, adicionar/editar/excluir apontamento (`src/features/relatorio360/components/CrewsPanel.tsx`).
- **`EquipmentPanel`** — logs de equipamento; edição das horas de utilização (recalcula custo = horas × tarifa/h) (`src/features/relatorio360/components/EquipmentPanel.tsx:20-23,78-80`).
- **`MaterialsPanel`** — logs de material; edição de quantidade.
- **`PhotosPanel`** — grade de fotos com upload, remover e renomear rótulo (base64) (`src/features/relatorio360/components/PhotosPanel.tsx`).
- **`LpsPccPanel`** — "LPS / PPC — Previsto × Realizado": lista de PPC por semana, **Curva S** (planejado × realizado, com destaque de atraso) e barras de "Serviços Notáveis"; dados de `operacaoCampoStore` (`src/features/relatorio360/components/LpsPccPanel.tsx:164-217`).

> **Nota de código** [código]: existe `SimulacaoAtrasoPanel.tsx` (`src/features/gestao-360/components/SimulacaoAtrasoPanel.tsx`) — simulação "what-if" de atraso — mas ele **não está montado** em nenhuma aba nem importado pelo `index.tsx`; é código órfão no momento.

## Dados que gera

**Ordens de Mudança** — tabela `change_orders` [schema] (`supabase/migrations/0032_sprint6_final.sql:97-118`). Campos-chave: `id`, `organization_id`, `project_id`, `project_code`, `title`, `type`, `status` (default `'draft'`), `impact_cost_brl` (`numeric(14,2)`), `impact_days` (`integer`), `submitted_at`, `payload` (jsonb — o objeto `ChangeOrder` inteiro), `created_by`, `deleted_at` (soft delete). O mapeamento objeto→linha está em `changeOrderToRow` (`src/store/gestao360Store.ts:19-34`).

**Fotos de OM** — tabela `change_order_photos` [schema] (`0032_sprint6_final.sql:120-134`): `change_order_id`, `storage_path` (o binário vai para o bucket **`project-documents`** sob o prefixo **`change-orders/{orderId}`** — `src/store/gestao360Store.ts:162,189`).

**Relatório 360 (RDO gerencial)** — 4 tabelas [schema] (`supabase/migrations/0019_grupo_operacional.sql:270-329`), todas com `report_date` + `payload` jsonb + soft delete:
- `daily_report_activities`
- `daily_report_equipment_logs`
- `daily_report_material_logs`
- `daily_report_photos`

No estado local do `relatorio360Store`, o dado é um `Record<string, DailyReport>` indexado por data (`src/store/relatorio360Store.ts:18`), onde cada `DailyReport` aninha `activities`, `crews` (com `timecards`), `equipmentLogs`, `materialLogs`, `photos`.

## Cálculos, KPIs e regras de negócio

**KPIs do cabeçalho** (`src/features/gestao-360/components/Gestao360Header.tsx`) — todos sobre `scopeProjects` (projeto selecionado ou todos):
- `EAC Projetado` = Σ `budgetLines.projected`, exibido em milhões (`Gestao360Header.tsx:41,79`).
- `Δ Orçamento` = `(eac − budgeted) / budgeted × 100` (`:42`).
- `avgProgress` = média de `executionPhases.progress` (`:46-48`).
- `plannedPct` = `elapsedMs / totalMs × 100` (tempo decorrido entre menor `startDate` e maior `endDate` do escopo) (`:50-59`).
- `SPI` = `plannedPct > 0 ? avgProgress / plannedPct : 1` (`:61`).
- `CPI` = `spent > 0 ? (budgeted × (avgProgress/100)) / spent : 1` — i.e. **EV/AC** com EV = orçamento × %físico (`:62`).
- `OMs em Aprovação` = nº de OMs com status `submitted` (`:68`).
- `Alertas Críticos` = equipamentos críticos/altos (só em modo demo) + riscos críticos ativos dos canteiros (`:65-67`).
- Cores por faixa: CPI/SPI verde ≥0,9, amarelo ≥0,7, vermelho abaixo (`:70-74`).

**Job Costing / Livro-razão** (`JobCostingPanel.tsx`), classificação por tipo de evento (`LedgerType = actual | committed | earned | baseline`):
- `AC` (Realizado) = Σ eventos `actual` (`:430`).
- `Comprometido` = Σ eventos `committed` (`:431`).
- `EAC` = `max(Σ projected, spent + committed + saldo×0,35)` (`:435`).
- `Variação` = `EAC − budgeted`; `variancePct = variance/budgeted×100` (`:436-437`).
- CPI/SPI recalculados com o mesmo racional do cabeçalho, porém `spent` = AC do livro-razão (`:465-466,567`).

Regras de **conversão de eventos em custo** (função `buildLedger`, `:155-378`) [código]:
- **Mão de obra** (timecards): `hoursWorked × hourlyRate` do trabalhador (`:194-200`).
- **Ordens de compra**: Σ `items.totalPrice`; tipo `actual` se OC `closed`, senão `committed` (`:206-218`).
- **Notas fiscais**: `totalAmount`; `actual` se NF `approved`/`pre_approved`, senão `committed` (`:221-236`).
- **Consumo de estoque** (movimentações de saída): `quantidade × custoUnitario` (`:255-272`).
- **RDO — equipe**: `foreman×8×65 + oficial×8×48 + ajudante×8×34 + operador×8×58` (tarifas-padrão por função) (`:292-296`).
- **RDO — equipamento**: `quantity × hours × 180` (tarifa referência) (`:312`).
- **Manutenção de equipamento** (OS): `actualCost ?? estimatedCost`; `actual` se OS `completed`, senão `committed` (`:329-343`).
- **Medição / avanço físico** e **recebimentos**: eventos `earned` com `amountBRL = 0` (alimentam EV/físico sem duplicar custo) (`:238-253,346-360`).
- **EVM AC**: importa `evmMetrics.AC` como evento `actual` consolidado (`:362-375`).

**Radar 360 / EVM** (`Ecosystem360Panel.tsx`): usa `evmStore.evmMetrics` (BAC, VAC, CPI, SPI) e `medicaoStore.getGlobalKpis()` (`pctExec`, `kmExec`, `kmPend`) — tons de alerta por limiares (`:186-197`).

**PPC / Curva S** (`LpsPccPanel.tsx`, `SummaryRow.tsx`): PPC semanal e desvio acumulado (real − planejado) vêm de `operacaoCampoStore` (`weeklyPpcResults`, `trendPoints`); faixas de cor 80%/60% (`SummaryRow.tsx:23-42`, `LpsPccPanel.tsx:14-24`).

## Integrações — a "camada única"

**O que CONSOME** (leitura direta de outros stores — este é o coração do "360"):
- `JobCostingPanel` puxa `.getState()` de `maoDeObraStore`, `gestaoEquipamentosStore`, `suprimentosStore`, `rdoStore`, `medicaoStore`, `evmStore` para montar o livro-razão a cada render (`JobCostingPanel.tsx:160-165`).
- `Ecosystem360Panel` ("Radar 360") lê **10 domínios**: RDO (`rdoStore` + RDO Sabesp local), Qualidade (`qualidadeStore` — FVS/NCs), Suprimentos (`suprimentosStore` — OCs, requisições, rupturas de estoque), Equipamentos (`gestaoEquipamentosStore`), Mão de obra (`maoDeObraStore` — ativos, apontamentos, alertas CLT), Planejamento (`planejamentoStore` — trechos), Financeiro/EVM (`evmStore`), Medição (`medicaoStore`), Rede 360 (`rede360Store`), Campo/PPC (`operacaoCampoStore`) (`Ecosystem360Panel.tsx:82-212`).
- `DailyReportPanel` cruza `agendaStore`, `relatorio360Store`, `rdoStore`, RDO Sabesp local, `qualidadeStore`, `gestaoEquipamentosStore`, `suprimentosStore` (`DailyReportPanel.tsx:60-77`).
- O cabeçalho lê `projetosStore`, `torreDeControleStore` (canteiros) e `otimizacaoFrotaStore` (health scores) (`Gestao360Header.tsx:3-8`).
- Sites do `torreDeControleStore` são convertidos em "projetos virtuais" e mesclados (`mergeProjectsWithSites` — `siteProjects.ts:52-63`).

**O que ALIMENTA (para fora):**
- O contador de OMs `submitted` vira **badge de alerta na sidebar** para `/app/gestao-360` (`src/hooks/useAlertCounts.ts:34-35,81`).
- Editar uma atividade no Kanban do Relatório 360 **atualiza o progresso da fase** correspondente em `projetosStore.updatePhase` (casamento por nome) (`KanbanBoard.tsx:99-118`).

**eventBus** (`src/lib/eventBus.ts`): nem `gestao360Store` nem `relatorio360Store` emitem/assinam eventos do bus diretamente [código]. A atualização "em tempo real" do custo acontece de forma **derivada**: os módulos-fonte (RDO, Suprimentos, EVM, etc.) escutam `realtime.row_changed` e re-puxam seus dados; como o Job Costing recomputa o livro-razão a partir do `.getState()` desses stores em cada render, ele reflete a mudança automaticamente [inferido].

**realtime** (`src/lib/realtime.ts`): as tabelas `change_orders`, `change_order_photos` e as `daily_report_*` **não** estão na lista `WATCHED_TABLES` [código]. Ou seja, não há push cross-cliente dedicado para OMs e para o RDO gerencial; a sincronização deles é via *pull* no mount (ver "Como sincroniza"). As tabelas-fonte do custo que SÃO observadas incluem `rdo`, `purchase_orders`, `invoices`, `suprimentos_estoque_*`, `evm_work_packages`, `evm_cost_accounts`, `projects` (`realtime.ts` — lista `WATCHED_TABLES`).

## Eficiência gerada

- **Fim das planilhas de acompanhamento de custo**: o livro-razão é montado por evento a partir dos módulos operacionais, sem redigitação — cada apontamento, NF, consumo e RDO já lançado no seu módulo vira automaticamente um lançamento de custo classificado (real/comprometido/físico) [inferido, a partir de `buildLedger` `JobCostingPanel.tsx:155-378`].
- **CPI/SPI/EAC vivos**: os índices que normalmente exigem fechamento manual de EVM são recalculados na hora (`Gestao360Header.tsx:61-62`, `JobCostingPanel.tsx:465-466`), permitindo detectar estouro de orçamento/prazo cedo [inferido].
- **Rastreabilidade das mudanças**: Ordens de Mudança guardam autor, revisor, notas, impacto de custo/prazo e fotos, com fluxo formal draft→submitted→approved/rejected e *delete* protegido por aprovação (`0034_sprint6_rpcs.sql:83`) — trilha de auditoria em vez de e-mail/WhatsApp [inferido].
- **Dado único para o RDO/PDF**: o Relatório 360 gera PDF do dia ou do período consolidando 11 áreas num só documento (`ReportHeader.tsx:34-46`), eliminando a montagem manual do relatório diário [inferido].
- **Radar 360**: uma tela concentra 10 sinais de saúde da obra com semáforo, reduzindo o tempo de varredura entre módulos [inferido].

## Como sincroniza

**Local-first.** Ambos os stores usam `zustand/persist` no `localStorage` — chaves `cdata-gestao-360` (`src/store/gestao360Store.ts:271`) e `cdata-relatorio360` (`src/store/relatorio360Store.ts:363`). Mutações escrevem no estado local imediatamente e enfileiram operações em `pendingSync`; `flush()` envia a fila via `flushQueue` do `storeSync` (`gestao360Store.ts:236-252`).

**Ciclo no mount:** `Gestao360Page` chama, para `projetosStore`/`torreDeControleStore`/`gestao360Store`, primeiro `ensureTenantScope(orgId)`, depois `flush()` e em seguida `pull()` (`src/features/gestao-360/index.tsx:33-55`). Enquanto o `activeOrgId` de qualquer um dos três não bate com a org do perfil, mostra "Carregando dados da empresa ativa..." (`index.tsx:57-66`).

**Pull:** `gestao360Store.pull` puxa `change_orders` e hidrata `changeOrders` a partir de `payload` — mas **preserva** o estado local se houver op pendente na tabela (sem *blanking* preemptivo, `gestao360Store.ts:254-267`). O `relatorio360Store.pull` é **parcial** por design: puxa as 4 tabelas para diagnóstico/timestamp, mas a re-hidratação completa do `reports` aninhado "fica para uma futura iteração" (comentário `relatorio360Store.ts:350-360`).

**Multi-tenant / RLS** [schema]: todas as tabelas têm `organization_id` com RLS `FORCE`. `SELECT` só na própria org e `deleted_at IS NULL`; `INSERT`/`UPDATE` exigem org + papel autorizado; `DELETE` direto é **bloqueado** (`USING (false)`) — remoções passam por RPC de aprovação com soft delete de 30 dias (`0033_sprint6_rls.sql:85-117`, `0034_sprint6_rpcs.sql:83,87,90`). `ensureTenantScope` zera o estado local ao trocar de organização (`gestao360Store.ts:106-116`).

**Offline:** `flush()` marca `syncStatus='offline'` quando `navigator.onLine` é falso e a fila fica pendente; um listener de `window 'online'` dispara `flush()` ao reconectar (`gestao360Store.ts:239,283-287`; `relatorio360Store.ts:335,374-378`).
