# Planejamento de Trechos (Rede)

> **Rota(s):** `/app/planejamento` (`src/App.tsx:141`, lazy em `src/App.tsx:18`) · **Store(s):** `planejamentoStore` (principal), `servicosStore` (catálogo de serviços — usado pelo sub-painel de Execução), lê `activeObraStore`, `rdoStore`, `preConstrucaoStore` · **Grupo na sidebar:** PLANEJAMENTO › **Trechos** (`src/components/shared/Sidebar.tsx:45-48`, ícone `CalendarClock`)

---

## O que é / problema que resolve

Módulo de **planejamento de execução de redes lineares** (saneamento: água, esgoto, drenagem; e infra/edificação por extensão). O objeto central é o **trecho** — um segmento de rede com comprimento, profundidade, diâmetro, tipo de solo e necessidade de escoramento. A partir da lista de trechos, das **equipes** de produção e de uma **tabela de produtividade**, o módulo gera automaticamente um **cronograma (Gantt), Curva S, Curva ABC, histograma de recursos e plano diário/semanal** — substituindo a montagem manual de cronograma em planilha/MS Project. [código: `src/features/planejamento/index.tsx`, `scheduleEngine.ts`, `analysisEngine.ts`]

O ganho de "camada única" está em fechar o ciclo **planejado → executado**: o RDO de campo (metros escavados por trecho) volta para cá e atualiza o percentual físico do trecho, tanto pelo cliente (eventBus) quanto por **trigger SQL no servidor** (`sync_rdo_to_planejamento`, `supabase/migrations/0035_cross_module_triggers.sql:20`). Assim, o mesmo trecho é a fonte da verdade para prazo, custo e progresso, sem re-digitação.

O cabeçalho do header descreve o módulo como "Cronograma e análise de trechos" (`PlanejamentoHeader.tsx:56`). A cor de destaque é laranja `#f97316`.

> **Nota de escopo:** a pasta `src/features/planejamento/` também hospeda o `ExecucaoPanel.tsx` ("Planejamento de Execução / modo Compizzo", dirigido por `planoExecucaoStore` + `servicosStore` + `maoDeObraStore`). Esse painel **não está ligado à barra de abas** deste módulo (o `switch` de `index.tsx` não inclui `execucao`, embora o tipo `PlanejamentoTab` o preveja — `planejamentoStore.ts:57-68`). Ele é documentado à parte; aqui o foco é o **módulo de Trechos/Rede** e suas 10 abas. [código]

---

## Para quem (papéis / persona)

- **Planejador / Engenheiro de planejamento** — monta trechos, equipes, produtividade, calendário; gera cronograma, cenários e baselines. É o papel-alvo primário.
- **Gerente / Diretor / Owner** — leem KPIs (prazo, custo, curva ABC), aprovam cenários.
- **Encarregado / equipe de campo** — consumem a **Programação Semanal** (aba `daily`) impressa/exportada; alimentam execução via RDO (que retorna para cá).

O controle de escrita é reforçado no servidor: `INSERT`/`UPDATE` em `plan_trechos` exige papel em `['planejador','engenheiro','gerente','diretor','owner']` e em `plan_teams`/`plan_holidays`/`plan_scenarios` em `['planejador','gerente','diretor','owner']` via `public.has_role(...)` (`supabase/migrations/0016_rls_batch1.sql:56-62,88-94,120-125`). [schema]

---

## Funcionalidades detalhadas

A navegação é por **10 abas** definidas em `PlanejamentoHeader.tsx:12-23` e roteadas no `switch` de `index.tsx:31-43`. Ao trocar de obra ativa, o `useEffect` de `index.tsx:26-28` chama `runSchedule()` para reagendar só a obra atual.

**Ações globais do header** (`PlanejamentoHeader.tsx:60-91`):
- **Gerar Planejamento** — dispara `runSchedule()` (recalcula Gantt/Curvas/Histograma).
- **Importar Trechos** — abre `ImportModal` com `TRECHO_IMPORT_CONFIG` (aceita `.xlsx/.xls/.csv`, "template Atlântico"), e cada linha vira `addTrecho()` (`PlanejamentoHeader.tsx:94-105`).
- **Exportar CSV** — `exportFullProjectCsv(ganttRows, teamNames, abcItems, projectEndDate)`.
- **Imprimir PDF** — `window.print()`.
- Aviso "**Configurações alteradas**" quando `isScheduleDirty` (`PlanejamentoHeader.tsx:107-112`).

### 1. Configuração (`config` → `ConfigPanel.tsx`)
Sete seções colapsáveis (`ConfigPanel.tsx:600-611`):
- **Dados do Projeto** — cartões de nº de trechos, metros totais e **orçamento total** editável inline (`setProjectBudget`); botão **"Carregar Trechos da Plataforma"** que chama `importTrechosFromPlatform()` (importa itens da Pré-Construção com unidade `ml`/`m`). [código `ConfigPanel.tsx:69-128`]
- **Equipes** — CRUD de equipes: composição (encarregados/trabalhadores/auxiliares/operadores), equipamentos (retro, compactador, caminhão basculante), custos (R$/h de MO, R$/dia de equipamento) e **profundidade máx. de escavação manual (m)** — acima dela há penalidade de 30% na escavação. [código `ConfigPanel.tsx:141-213`]
- **Produtividade** — tabela editável: escavação (m/dia), assentamento (m/dia), reaterro (m³/dia), escoramento (m²/dia), pavimentação (m²/dia); fonte marcada "SINAPI" (badge fixa). [código `ConfigPanel.tsx:217-269`]
- **Parâmetros de Produtividade** — modo de agrupamento do Gantt (`daily_segment` / `by_trecho` / `trecho_activity`), toggle "agrupar por proximidade", e indicador de **gargalo** = `min(escavação, assentamento)`. [código `ConfigPanel.tsx:273-323`]
- **Período e Calendário** — data de início, data-alvo de conclusão, horas/dia, semana de trabalho (`mon_fri`/`mon_sat`) e **feriados** (add/remove). [código `ConfigPanel.tsx:327-426`]
- **Regras Técnicas** — tabela de regras (nome, condição textual ex. `soilType === 'rocky'`, multiplicador de produtividade e de custo). Duas regras vêm pré-carregadas: "Solo Rochoso — penalidade" (0,6× prod / 1,4× custo) e "Escoramento — restrição" (0,75× / 1,25×). [código `planejamentoStore.ts:358-361`, `ConfigPanel.tsx:508-596`] ⚠️ **Nota técnica:** essas regras são editáveis mas **não são aplicadas** pelo `scheduleEngine` (que usa multiplicadores fixos de solo/escoramento próprios); são metadados/parâmetros de referência. [inferido — o engine não lê `technicalRules`]
- **Calculadora Inversa** — dada uma data-alvo, estima se o prazo é viável: `requiredDays = ceil(totalMeters / avgMPerDay / nº equipes)` e sugere equipes extras se inviável. [código `ConfigPanel.tsx:430-504`]

### 2. Trechos (`trechos` → `TrechosPanel.tsx`)
Tabela editável dos segmentos, **filtrada pela obra ativa** (`siteId === activeObraId`; `null` = todas — `TrechosPanel.tsx:87-92`). Edição inline por célula (código, descrição, comprimento, profundidade, diâmetro, solo, escoramento, R$/m), **drag-and-drop** para reordenar (preservando trechos de outras obras — `TrechosPanel.tsx:99-113`), coluna **Executado** com barra de progresso (`executedMeters/lengthM`) e badge de **Zona ABC** (A/B/C). Botões "Novo Trecho" (código autogerado `T01…`) e "Importar da Pré-Construção". [código `TrechosPanel.tsx`]

### 3. Cronograma (`gantt` → `GanttPanel.tsx`)
Gantt em **grid de divs HTML** (não SVG), com coluna de trecho fixa (sticky) e cabeçalho fixo. Células azuis = execução (metros/dia), célula amarela "T" = **teste hidrostático** (1 dia após execução). Cores por equipe (5 cores cíclicas). Faixa de KPIs: nº trechos, metros totais, dias úteis, início, **término previsto** (fica vermelho se `> targetEndDate`), data-alvo, custo total. Editor rápido do trecho ao clicar no lápis (`TrechoQuickEdit`, salva via `updateTrecho`). Rótulo da linha muda conforme `ganttGroupingMode`. [código `GanttPanel.tsx`]

### 4. Curva S (`scurve` → `SCurvePanel.tsx`)
Gráfico SVG com duas linhas: **físico previsto** (metros acumulados %, azul sólido) e **financeiro previsto** (custo acumulado %, laranja tracejado), eixo X com ticks mensais. Cartões-resumo (dias úteis, custo total, metros totais, físico final) e export CSV (`exportSCurveCsv`). [código `SCurvePanel.tsx`]

### 5. Curva ABC (`abc` → `AbcPanel.tsx`)
Análise de Pareto por **custo do trecho**. Barras por trecho + linha de % acumulado, linhas de referência em 75% (A) e 95% (B). Resumo por zona (A ≤75%, B 75–95%, C >95%) com valor e % do total, e tabela detalhada. Export `exportAbcCsv`. [código `AbcPanel.tsx`]

### 6. Histograma (`histogram` → `HistogramPanel.tsx`)
Histograma diário de recursos: **mão de obra (pessoas/dia)** e **equipamentos (unid./dia)**, em barras agrupadas, paginado de 30 em 30 dias. Cartões: pico de MO, média diária, total Hh, equipamentos×dias. Export `exportHistogramCsv`. [código `HistogramPanel.tsx`]

### 7. Programação Semanal (`daily` → `DailyPlanPanel.tsx`)
Tabela dia-a-dia achatada a partir de `ganttRows`, com filtros por período/trecho/equipe/**núcleo**. Cada linha permite editar inline **Previsto** e **Realizado** (overrides locais em memória) e escolher **Status** (não iniciado/em andamento/concluído/bloqueado). Calcula **% realizado** por linha e um **resumo semanal por núcleo** (planejado × realizado × %). Export CSV próprio e layout de impressão dedicado. [código `DailyPlanPanel.tsx`]

### 8. RDO × Planejamento (`rdo` → `IntegracaoPanel.tsx`, reusada de `src/features/rdo/`)
Três sub-abas (`IntegracaoPanel.tsx:33-37`):
- **Dashboard Integrado** — cruza trechos do plano com metros executados vindos dos RDOs (merge por `trechoCode`), KPIs de planejado/executado/progresso/produtividade média e **atraso estimado**; tabela por trecho com fonte (RDO/Manual) e status.
- **Curva S Comparativa** — PV (planejado), EV (valor agregado) e AC (custo real) montados de RDOs + lançamentos financeiros; alternância físico/financeiro/ambos.
- **Análise de Atrasos** — compara `plannedEndDate` com "hoje" para trechos não concluídos e classifica em No Prazo / Atraso Leve (≤5d) / Em Atraso. [código `IntegracaoPanel.tsx:317-439`]
Faz **auto-sync** ao mudar RDOs (`syncExecutionToPlanejamento()` em `useEffect`, `IntegracaoPanel.tsx:478-480`).

### 9. Notas de Serviço (`notes` → `NotesPanel.tsx`)
CRUD de notas amarradas a trecho + equipe: tipo (instrução/segurança/material/vistoria/outro), prioridade (alta/média/baixa), status (pendente/em andamento/concluída), autor, responsável. Filtros por tipo/prioridade/status/trecho + busca textual. Validação Zod (`serviceNoteSchema`). [código `NotesPanel.tsx`]

### 10. Planejamentos Salvos (`scenarios` → `ScenariosPanel.tsx`)
Snapshots **what-if**: salva/carrega/renomeia/exclui cenários (cada um = cópia de trechos, teams, produtividade, config, feriados). Cartão de "configuração atual (não salva)" + cards por cenário com trechos/metros/equipes/início. Carregar substitui o estado atual (`loadScenario`). Validação Zod (`planScenarioSchema`). [código `ScenariosPanel.tsx`, `planejamentoStore.ts:812-886`]

**Fluxos de criação de plano no store (não expostos como aba própria):**
- `initBlankPlan(nome)` — plano em branco (`planejamentoStore.ts:375-397`).
- `createGuidedPlan(input)` — wizard: cria **contrato**, **núcleos** (com orçamento rateado por `bacWeightPct`), trechos e uma equipe-padrão por núcleo, e grava **Baseline Rev.0** + `auditLog` (`planejamentoStore.ts:399-462`).
- `importScheduleRows(rows)` — importa atividades de cronograma externo mapeando para trechos (`planejamentoStore.ts:504-540`).
- `createBaseline(reason)` / `addNucleus(...)` / `reassignTrechoTeam(...)` — revisões e ajustes com trilha de auditoria.

---

## Dados que gera

Entidades e tabelas Supabase (migração `supabase/migrations/0014_planejamento.sql`; coluna `site_id` adicionada em `20260627140000_obra_scoping_fase3.sql:29-47`):

**`plan_trechos`** (`0014_planejamento.sql:9-41`) — 1 linha por trecho. Campos-chave: `code` (único por org — `UNIQUE(organization_id, code)`), `description`, `length_m`, `depth_m`, `diameter_mm`, `soil_type` (`normal`/`mixed`/`rocky`), `requires_shoring`, `unit_cost_brl`, `notes`. **Derivados** (schedule engine ou RDO): `assigned_team_index`, `planned_start_date`, `planned_end_date`, `abc_zone`, `executed_meters` (default 0), `execution_status` (`not_started`/`in_progress`/`completed`), `last_rdo_date`, `site_id`. Extras em `payload` jsonb: `nucleusId`, `activityType`, `financialWeightPct`, `plannedProgressPct`, `physicalProgressPct`, `financialProgressPct`, `estimatedHH`, `equipmentDemand` (mapeamento em `planejamentoStore.ts:189-222`). Soft-delete via `deleted_at`; `updated_at` por trigger.

**`plan_teams`** (`0014_planejamento.sql:55-77`) — equipes: `name`, `foreman_count`, `worker_count`, `helper_count`, `operator_count`, `retroescavadeira`, `compactador`, `caminhao_basculante`, `labor_hourly_rate_brl`, `equipment_daily_rate_brl`, `max_manual_excav_depth_m` (default 1.5); `payload` guarda `nucleusId` e `capacity`.

**`plan_holidays`** (`0014_planejamento.sql:90-103`) — `date` (única por org), `description`, `recurring`.

**`plan_scenarios`** (`0014_planejamento.sql:117-132`) — snapshot completo em `payload` (trechos, teams, productivityTable, scheduleConfig, holidays); `is_baseline`.

**`servicos`** (`supabase/migrations/20260706120000_servicos.sql:8-18`) — **catálogo de serviços por organização** gerido pelo `servicosStore`: `nome`, `unidade` + `payload` jsonb com o objeto `Servico` (`rendimento`, `rendimentoBase`, `custoDiaPessoa`, `ordem`). Multi-tenant, soft-delete. É consumido pelo `ExecucaoPanel` (modo Execução/Compizzo), não pelas abas de Trechos. [schema/código `servicosStore.ts`]

**Slice local-only** (não em tabela dedicada; via `app_state`/blob): `contract`, `nuclei`, `projectBudget`, `scenarios`, `baselines`, `notes`, `technicalRules`, `auditLog` (`planejamentoStore.ts:1088-1092`).

---

## Cálculos, KPIs e regras de negócio

Toda a matemática está em funções **puras** (`scheduleEngine.ts`, `analysisEngine.ts`), sem efeitos colaterais.

**Produtividade efetiva do trecho** (`effectiveMPerDay`, `scheduleEngine.ts:106-128`) — é o **gargalo** entre as atividades concorrentes:
- Escavação: `max(1, escavacao) × max(1, nº retro) × depthPenalty × soilMult`
- Assentamento: `max(1, assentamento) × soilMult`
- Reaterro: `(max(1, reaterro) / (depth × 0,8)) × soilMult` (0,8 = `SOIL_SWELL_FACTOR`)
- Escoramento: `(max(1, escoramento) / depth) × soilMult` se `requiresShoring`, senão `Infinity`
- Resultado = `max(0,1, min(...))`.
- `depthPenalty = 0,7` se `depthM > maxManualExcavDepthM`, senão 1,0.
- `soilMult` (produtividade): normal 1,0 · mixed 0,8 · rocky 0,6 (`SOIL_PROD_MULTIPLIER`, `scheduleEngine.ts:28-32`).

**Duração e custo do trecho** (`generateSchedule`, `scheduleEngine.ts:160-272`):
- `durationDays = max(1, ceil(lengthM / mPerDay))`; **+1 dia** de teste hidrostático após execução.
- Alocação de equipe **round-robin**: `teamIndex = ti % teams.length`; sequencial dentro da equipe (`teamNextDay[teamIndex] = startDayIndex + durationDays + 1`).
- `dailyCost = headcount × laborHourlyRate × workHoursPerDay + equipmentDailyRate` (`teamDailyCost`, `scheduleEngine.ts:145-150`).
- `materialCost = unitCostBRL × lengthM × soilCostMult` (custo do solo: normal 1,0 · mixed 1,2 · rocky 1,4 — `SOIL_COST_MULTIPLIER`, `scheduleEngine.ts:33-37`).
- `totalCost = dailyCost × durationDays + materialCost`.
- Cap de segurança `MAX_WORK_DAYS = 1000` para evitar loops (`scheduleEngine.ts:24,63`).

**Calendário** (`buildWorkDays`, `scheduleEngine.ts:56-83`) — pula domingo sempre, sábado se `mon_fri`, e feriados.

**Curva ABC** (`computeAbcCurve`, `analysisEngine.ts:24-45`) — ordena trechos por custo desc., acumula % e classifica: **A ≤75%**, **B ≤95%**, **C >95%**.

**Curva S** (`computeSCurve`, `analysisEngine.ts:54-90`) — por dia útil: `cumulativePhysicalPct = min(100, cumMeters/totalMeters)` e `cumulativeFinancialPct = min(100, cumCost/totalCostBRL)` (teste hidrostático não conta metros/custo).

**Histograma** (`computeHistogram`, `analysisEngine.ts:98-141`) — por dia: soma `headcount`, `equipmentUnits` e `dailyCostBRL` das equipes ativas naquele dia.

**Progresso físico do trecho** — `physicalProgressPct = min(100, executedMeters/lengthM × 100)` (calculado em `runSchedule` e em `syncExecutionFromRdo`, `planejamentoStore.ts:773,915`).

**Takt teórico do contrato** — `calcTaktDays = round(dias / nº núcleos)` (`planejamentoStore.ts:262-267`); orçamento do núcleo = `round(bacTotal × bacWeightPct/100)`.

---

## Integrações — a "camada única"

**Consome de outros módulos:**
- **Pré-Construção** — `importTrechosFromPlatform()` puxa `takeoffItems` com unidade `ml`/`m` e cria trechos (import preguiçoso p/ evitar dependência circular; fica local, não enfileira INSERT — `planejamentoStore.ts:600-645`).
- **RDO** — `rdoStore.syncExecutionToPlanejamento()` agrega metros executados por `trechoCode` (só RDOs finalizados, com reconciliação p/ evitar dupla contagem) e injeta em `usePlanejamentoStore.syncExecutionFromRdo(entries)` (`rdoStore.ts:431-507`). O `syncExecutionFromRdo` (`planejamentoStore.ts:901-919`) casa por `code`, grava `executedMeters`/`executionStatus`/`lastRdoDate`/`physicalProgressPct`.
- **Obra ativa** — `runSchedule()` agenda **só a obra ativa** (`activeObraStore`), preservando trechos das demais fora do Gantt (`planejamentoStore.ts:737-790`); novos trechos herdam `siteId` da obra ativa (`planejamentoStore.ts:548`).

**Alimenta / é consumido por:**
- A `IntegracaoPanel` (aba RDO e reusada pelo próprio RDO) lê `trechos` + `workDays` do store para Dashboard/Curva S/Atrasos.
- Trechos com `plannedStart/EndDate`, `executedMeters` e `abcZone` ficam disponíveis para dashboards (ex.: `recompute_project_kpis` lê `plan_trechos`, `0035_cross_module_triggers.sql:244-246`).

**eventBus** (`src/lib/eventBus.ts`) — listeners registrados em `planejamentoStore.ts:1102-1146`:
- `rdo.closed` → `pull()` (re-puxa trechos após trigger do servidor).
- `measurement.approved` → casa trechos por `code`/`description` com a `operationalKey` da medição, roda `syncExecutionFromRdo` + `runSchedule`; se nada casar, `pull()`.
- `realtime.row_changed` para `plan_trechos`, `measurement_sources/memory_lines/financial_entries`, `lps_activities/restrictions` → `pull()`.

**Trigger de servidor** — `sync_rdo_to_planejamento()` (`0035_cross_module_triggers.sql:20-60`): `AFTER INSERT/UPDATE ON rdo`, varre `payload->'trechos'` e faz `UPDATE plan_trechos SET payload.executedMeters = GREATEST(atual, valorRDO)` na mesma org (nunca regride), tocando `updated_at` para acionar Realtime. É a **verdade única no servidor**, independente do cliente que fechou o RDO.

**Realtime** (`src/lib/realtime.ts:31-62`) — `plan_trechos` está na lista `WATCHED_TABLES`; mudanças (inclusive as do trigger) viram `realtime.row_changed` (com coalescência de ~350ms), disparando `pull()`.

---

## Eficiência gerada

- **Fim da planilha de cronograma:** trechos + equipes + produtividade geram Gantt, Curva S, ABC, histograma e plano diário automaticamente — o que normalmente é feito à mão em Excel/MS Project. [inferido]
- **Dado único planejado↔executado:** o mesmo trecho carrega o previsto e o realizado; o RDO de campo atualiza o % físico sem re-digitação, por eventBus **e** por trigger SQL (robusto a offline/multi-cliente). [código]
- **Análise de decisão embutida:** Curva ABC destaca onde está 75% do custo; calculadora inversa responde "dá para entregar até a data X?" e sugere equipes extras. [código]
- **What-if barato:** cenários salvos permitem comparar "3 equipes vs 4" sem perder o plano atual; baselines + auditLog dão rastreabilidade de revisões. [código/inferido]
- **Rastreabilidade e governança:** RLS por papel + org, soft-delete e trilha de auditoria (`auditLog`) registram quem criou/alterou o quê. [schema]

---

## Como sincroniza

**Local-first + fila de operações.** O store persiste no `localStorage` (`persist`, chave `cdata-planejamento`, `partialize` em `planejamentoStore.ts:1066-1083`) e mantém uma fila `pendingSync` de `PendingOp`. Mutações de trechos/teams/holidays/scenarios geram `makeOp(...)` e chamam `flush()` → `flushQueue()` para `plan_trechos`/`plan_teams`/`plan_holidays`/`plan_scenarios` (`planejamentoStore.ts:544-596,975-994`). O `pull()` re-hidrata do servidor, **mas nunca sobrescreve tabela com op pendente** (`pendingTables` guard, `planejamentoStore.ts:996-1001`).

**Slice não-tabelado (contrato/núcleos/cenários/orçamento/baselines/notas/regras/auditoria)** sincroniza como **blob** em `app_state` via `attachBlobSync` (`planejamentoStore.ts:1087-1092`).

**Realtime:** `plan_trechos` observada (`realtime.ts:33`); UPDATE (inclusive via trigger) → `realtime.row_changed` → `pull()`.

**RLS / multi-tenant:** `plan_*` com `ENABLE`+`FORCE ROW LEVEL SECURITY`, escopo `organization_id = user_org()` e escrita condicionada a `has_role(...)`; **DELETE bloqueado** (`USING (false)`) — exclusão é soft-delete por `deleted_at` (`supabase/migrations/0016_rls_batch1.sql:46-176`). Separação **por obra** via coluna `site_id` (legado `NULL` = "todas as obras", `20260627140000_obra_scoping_fase3.sql`).

**Offline:** `flush()` verifica `navigator.onLine` e marca `syncStatus='offline'`; o listener `window 'online'` re-dispara `flush()` ao reconectar (`planejamentoStore.ts:978-979,1094-1097`). Todas as chaves são `crypto.randomUUID()` e não há chamadas externas fora do pipeline de sync.
