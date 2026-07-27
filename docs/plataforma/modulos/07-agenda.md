# Agenda

> **Rota(s):** `/app/agenda` (`src/App.tsx:124`, lazy em `src/App.tsx:10`) · **Store(s):** `useAgendaStore` (`src/store/agendaStore.ts`) — lê também `usePlanejamentoMestreStore`, `usePlanejamentoStore`, `useProjetosStore` · **Grupo na sidebar:** `PLANEJAMENTO` (`src/components/shared/Sidebar.tsx:49`, ícone `Calendar`)

## O que é / problema que resolve

A Agenda é o **calendário operacional de recursos** da obra. Ela responde à pergunta "qual equipe/equipamento está fazendo o quê, e quando?", posicionando tarefas ao longo do tempo em duas visualizações: uma **linha do tempo estilo Gantt por recurso** (raias horizontais, uma por equipe/equipamento) e um **calendário de 6 semanas** (grade mensal). O foco não é o cronograma de escopo (isso é o Planejamento), e sim a **alocação de recursos no calendário** — quem opera a retroescavadeira na semana X, quando a Equipe Civil A está livre, etc. `[inferido]`

O problema concreto que resolve é a fragmentação típica de planilhas de alocação: cada encarregado com sua própria grade de Excel, sem visão única de disponibilidade de máquinas e equipes, sem detecção de sobreposição e sem ligação com o planejamento de escopo. A Agenda unifica isso numa tela só, com arrastar-e-soltar (drag/resize das barras) e com **as atividades do Planejamento aparecendo automaticamente como uma raia somente-leitura** (`src/features/agenda/useAgendaData.ts:1-6`), de modo que o operacional enxerga o planejado sem precisar redigitar.

A entidade central é uma **tarefa** (`AgendaTask`) — um bloco de trabalho com título, recurso, datas início/fim, cor, status, prioridade e metadados (responsável, encarregado, local, horas estimadas, % conclusão, projeto vinculado) — definida em `src/types/index.ts:258-274`.

## Para quem (papéis / persona)

- **Planejador / Engenheiro de planejamento:** monta a alocação de equipes e equipamentos na linha do tempo, arrasta barras para reprogramar, importa datas de cenários de planejamento.
- **Encarregado / Gestor de obra:** consulta rapidamente o que cada recurso faz na semana (calendário de 6 semanas), marca conclusão.
- **Gerente/Diretor:** aprova exclusões de tarefa/recurso (fluxo de aprovação — a exclusão exige papel `gerente` por padrão, `supabase/migrations/0034_sprint6_rpcs.sql:84`).

Pela RLS, **criar/editar** tarefas e recursos exige um destes papéis: `engenheiro`, `planejador`, `gerente`, `diretor`, `owner` (`supabase/migrations/0033_sprint6_rls.sql:131` e `:148`). Papéis abaixo disso têm acesso somente-leitura (o SELECT é liberado a qualquer autenticado da organização).

## Funcionalidades detalhadas

A página (`src/features/agenda/index.tsx`) é composta por cabeçalho + barra de ferramentas + área central (Gantt **ou** Calendário) + barra inferior (só no Gantt) + modal de edição.

### 1. Cabeçalho (`AgendaHeader.tsx`)
Título "Agenda" e dois botões de ação:
- **Executar Cenários** (`AgendaHeader.tsx:21-27`) → abre o `ScenarioCompareModal`.
- **Visão do Modelo** (`AgendaHeader.tsx:28-34`) → abre o `ModelViewPanel` (painel de simulação de execução).

### 2. Barra de ferramentas (`AgendaToolbar.tsx`)
- **Busca de recurso** (`AgendaToolbar.tsx:47-53`): filtra as raias por `name` ou `code`; a filtragem em si é feita no `index.tsx:16-26` (`filteredResourceIds`).
- **Alternância Gantt / Calendário** (`AgendaToolbar.tsx:60-83`): dispara `setDisplayView('gantt'|'calendar')`.
- **Navegação temporal:** botões recuar/avançar (`panLeft`/`panRight`) e rótulo do intervalo visível formatado por `formatViewRangeByDays` (`AgendaToolbar.tsx:32-33`, `:87-105`). O passo de navegação depende do modo de visualização (ver `PAN_DAYS` em `agendaStore.ts:14-22`).
- **Ir para data** (`AgendaToolbar.tsx:109-114`): um `<input type="date">` que "salta" para a segunda-feira da semana escolhida (`startOfWeek ... weekStartsOn: 1`, `:35-40`).
- **Semanas visíveis** (`AgendaToolbar.tsx:122-132`): campo numérico 1–52 (`setVisibleWeeks`); no modo `sixWeeks` vira um badge fixo "6 sem.".
- **Nova Tarefa** (`AgendaToolbar.tsx:137-143`) → `handleAddTask` que chama `setEditingTask('new')`.
- **Seletor de zoom temporal** (`AgendaToolbar.tsx:146-166`, só no Gantt): 7 modos — **Dia, Semana, 6 Semanas, Mês, Trimestre, Semestre, Ano** (`:14-22`) — cada um com parâmetros de densidade em `getViewParams` (`utils.ts:32-43`).

### 3. Gantt por recurso (`GanttChart.tsx` → `GanttTimeHeader`, `GanttRow`, `GanttBar`)
- **Cabeçalho temporal de duas linhas** (`GanttTimeHeader.tsx`): a linha de cima agrupa colunas por mês/ano (`buildTopSegments`, `:14-35`) e a de baixo rotula cada coluna (semana ISO, dia, "T1 2025", "S1 2025", etc., conforme `getColumnLabel`/`getTopHeaderLabel` em `utils.ts:46-82`). É *sticky* no topo.
- **Raia por recurso** (`GanttRow.tsx`): célula fixa à esquerda (largura `SIDEBAR_W=240`, `utils.ts:20`) com `code`, badge Ativo/Inativo e `name`; à direita a faixa de tempo com grade de fundo em CSS `repeating-linear-gradient` (`GanttChart.tsx:32-43`).
- **Barra de tarefa arrastável** (`GanttBar.tsx`): posição/largura calculadas por `getBarStyle` (`utils.ts:120-141`). Interações via `pointer events`:
  - **Arrastar (mover):** move a tarefa em passos de 1 semana (snap semanal); ao soltar chama `moveTask(id, newStart, newEnd)` preservando a duração (`applyDragDelta`, `utils.ts:224-229`). Um clique sem movimento **seleciona e abre o editor** (`GanttBar.tsx:103-109`).
  - **Redimensionar à esquerda/direita:** alças de 8px que alteram `startDate`/`endDate` (também com snap semanal) via `updateTask`, com guarda para não inverter as datas (`applyResizeLeft`/`applyResizeRight`, `utils.ts:231-245`).
  - Tarefa `completed` renderiza com opacidade 0.65 (`GanttBar.tsx:222`); a selecionada ganha borda branca.
- **Indicador "Hoje"** (`GanttChart.tsx:83-114`): linha vertical laranja quando a data atual cai na janela visível (`getTodayOffset`, `utils.ts:185-196`).
- Estado vazio: "Nenhum recurso encontrado" (`GanttChart.tsx:73-80`).

### 4. Calendário 6 semanas (`ThreeDWallCalendar.tsx`)
Grade de 42 dias (6×7) começando na segunda-feira da `viewStart` (`:20-21`). Cabeçalho mostra o intervalo e a **contagem total de atividades** do período (`:22-23`, `:47-49`). Cada célula-dia lista até 4 tarefas do dia (bolinha colorida + título + nome do recurso) e um "+N atividade(s)" quando excede (`:114-137`). Tarefas `unscheduled` são omitidas do calendário (`calendarUtils.ts:18`). Clicar numa tarefa abre o editor; clicar no dia vazio abre "Nova Tarefa" (`:95`, `:119`). Navegação por semana e botão "Hoje" (`:54-77`). O dia atual é destacado em laranja (`:97-99`).

### 5. Barra inferior (`AgendaBottomBar.tsx`, só no Gantt)
Mostra o **contador de "Não agendados"** (`getUnscheduledCount`, `agendaStore.ts:290-292`) e botões de UI: "Re-avaliar regras", "Changelog", Desfazer/Refazer (desabilitados — "full undo history is a future feature", `AgendaBottomBar.tsx:34`), "Resetar" e "Revisar alterações". **Observação `[código]`:** exceto o contador, esses botões são visuais/placeholder — não têm handler ligado nesta versão.

### 6. Modal Nova/Editar Tarefa (`TaskEditDialog.tsx`)
Formulário `react-hook-form` + validação Zod (`schemas.ts`). Campos: **Título** (2–100 chars), **Recurso** (select das raias), **Prioridade** (baixa/média/alta/crítica), **Data Início/Fim** (com regra fim ≥ início, `schemas.ts:23-29`), **Status** (agendado/não agendado/concluído), **Cor** (5 opções: azul/laranja/verde/vermelho/roxo), e bloco "Detalhes": Responsável, Encarregado, Localização, Horas Estimadas, % de Conclusão (0–100), **Projeto Vinculado** (select de `projetosStore`, `TaskEditDialog.tsx:339-344`) e Observações (≤500 chars).
- **Criar** → `addTask`; **Salvar** → `updateTask`; **Excluir** → confirmação em 2 passos → `deleteTask` (`:120-124`).
- **Tarefas do Planejamento são somente-leitura:** se o `editingTaskId` começa com `plan-`, o modal exibe apenas um aviso explicando que a edição deve ser feita no módulo Planejamento (`TaskEditDialog.tsx:132-154`).

### 7. Cenários de Planejamento (`ScenarioCompareModal.tsx`)
Lista os cenários salvos no `usePlanejamentoStore` (`.scenarios`). Permite:
- **CRUD de cenário:** criar (`saveScenario`), renomear (`renameScenario`), excluir com confirmação (`removeScenario`) — `:200-204`, `:268-302`, `:336-359`.
- **Comparar dois lado a lado** (`ComparePanel`, `:113-145`): tabela com Extensão total, Custo estimado, Duração (dias), nº de Trechos, nº de Equipes, Início/Fim previsto — diferenças destacadas em laranja.
- **Aplicar à Agenda** (`handleApply`, `:218-237`): para cada tarefa da Agenda, procura um trecho do cenário cujo `code`/`description` casa com o título da tarefa e, se houver, sobrescreve `startDate`/`endDate` e marca `status: 'scheduled'` via `updateTask`. Estatísticas calculadas em `scenarioStats` (`:16-27`).

### 8. Visão do Modelo / Execução (`ModelViewPanel.tsx`)
Painel lateral de **simulação animada da execução do cronograma**, baseado em `ganttRows` do `usePlanejamentoStore`. KPIs de topo: Fim Previsto, Custo Total, data da Simulação (`:143-162`). Um "scrubber" 0–100% com Play/Pause/Reset percorre a linha do tempo do projeto e calcula o progresso por trecho (`rowProgress`, `:93-104`) e a contagem de concluídos (`:106-111`). Auto-carrega dados demo só em modo demo (`:42-48`). Link para "Abrir Planejamento".

## Dados que gera

Duas tabelas Supabase (criadas em `supabase/migrations/0032_sprint6_final.sql:137-177`):

**`agenda_resources`** (`0032:140-152`) — recursos (equipes/equipamentos):
- `id` (uuid PK), `organization_id` (FK organizations, multi-tenant), `code`, `name`, `type` (`'equipment'|'crew'|'other'`), `status`, `payload` (jsonb com o objeto `AgendaResource` completo), `created_by`, `created_at`, `updated_at`, `deleted_at` (soft delete).
- Mapeamento app→linha em `agendaStore.ts:93-104` (`resourceToRow`). Índices por org, org+created, org ativo (`0032:153-155`).

**`agenda_tasks`** (`0032:157-171`) — tarefas alocadas:
- `id` (uuid PK), `organization_id`, `resource_id` (uuid), `start_date` (date), `end_date` (date), `status`, `priority`, `linked_project_id` (FK `projects`, `ON DELETE SET NULL`, `0032:165`), `payload` (jsonb com o `AgendaTask` inteiro), `created_by`, timestamps, `deleted_at`.
- Mapeamento em `agendaStore.ts:79-92` (`taskToRow`). Índices por org, resource, datas e projeto (`0032:172-177`).

**Padrão colunas + payload `[schema]`:** os campos "de busca/junção" (datas, status, prioridade, resource_id, linked_project_id) viram colunas dedicadas (para índice/RLS), enquanto o objeto de domínio completo é guardado em `payload` jsonb. No `pull`, a UI reconstrói a partir de `payload` (`agendaStore.ts:248-251`), passando por `safeTask`/`safeResource` que saneiam/validam cada registro (`agendaStore.ts:39-76`).

**Nota `[código]`:** apesar de existir `resourceToRow`, o store hoje **não faz CRUD de recursos** — a linha `void resourceToRow` (`agendaStore.ts:287`) marca isso como reservado para o futuro. Os recursos padrão vêm do mock (`src/data/mockAgenda.ts`) em modo demo; em produção, `agenda_resources` só é populada se algo inserir (fora do fluxo atual da UI). `[inferido]`

## Cálculos, KPIs e regras de negócio

- **Posicionamento da barra no Gantt** (`getBarStyle`, `utils.ts:120-141`): `left = diasDeslocamento × pixelsPerDay + 4`; `width = max(20, duraçãoDias × pixelsPerDay − 8)`; visível se a barra intersecta a janela. `pixelsPerDay`/`totalDays`/`columnDays` variam por modo (`getViewParams`, `utils.ts:32-43`).
- **Snap semanal** de arrastar/redimensionar: os deltas de pixel são convertidos em semanas inteiras (`weekPx`, `utils.ts:250-252`) — a Agenda opera em granularidade de semana.
- **Duração de tarefa preservada no mover** (`applyDragDelta`, `utils.ts:224-229`): nova data-fim = novo início + duração original.
- **Contador de não agendados** (`getUnscheduledCount`): `tasks.filter(status === 'unscheduled').length` (`agendaStore.ts:290-292`).
- **Tarefas por dia** (`getTasksForDate`, `calendarUtils.ts:16-23`): tarefa aparece no dia se `dia ∈ [start, end]` e `status ≠ 'unscheduled'`.
- **Estatísticas de cenário** (`scenarioStats`, `ScenarioCompareModal.tsx:16-27`): `totalMeters = Σ lengthM`; `totalCost = Σ (unitCostBRL × lengthM)`; `durationDays = ceil((maxFim − minInício)/86.400.000)`.
- **Progresso simulado por trecho** (`rowProgress`, `ModelViewPanel.tsx:93-104`): mapeia o % do scrubber (`simStep`) para milissegundos do intervalo total do projeto e calcula 0/parcial/100% por trecho.
- **Regra de negócio principal:** exclusão de tarefa/recurso **não é DELETE direto** — é uma **ação sujeita a aprovação** (`delete_agenda_task`/`delete_agenda_resource`, papel `gerente` por padrão; `0034:84-85`, `:104-105`), e o efeito real no servidor é **soft delete** (`UPDATE ... SET deleted_at = now()`, `0034:202-203`).

## Integrações — a "camada única"

**O que a Agenda CONSOME de outros módulos:**
- **Planejamento (atividades mestre)** → `useAgendaData` (`useAgendaData.ts:25-59`) injeta as atividades do `usePlanejamentoMestreStore` como tarefas de uma raia virtual "Planejamento" (`PLAN_RESOURCE_ID = 'planejamento-mestre'`). Filtra `level ≥ 1`, não-marcos, com datas planejadas; mapeia cor por `networkType` (água→laranja, esgoto→verde, civil→roxo…, `:14-23`) e `status`/`% conclusão`. **São somente-leitura na Agenda** e refletem em tempo real (o Planejamento Mestre é realtime — ver abaixo).
- **Planejamento (Trechos/Cenários)** → `usePlanejamentoStore` no `ScenarioCompareModal` e no `ModelViewPanel` (cenários, `ganttRows`, custo/fim do projeto).
- **Projetos** → `useProjetosStore` para o select "Projeto Vinculado" (`TaskEditDialog.tsx:35`, `:341`), gravado em `agenda_tasks.linked_project_id`.

**O que a Agenda ALIMENTA:**
- **Relatório 360 / Diário de Obra** → `mergeAgendaIntoReport` (`src/hooks/useRelatorio360.ts:13-55`) converte as tarefas da Agenda do dia em atividades e equipes do relatório diário (id `agenda-...`, `crew` `agenda-resource-...`), inferindo `plannedQty`/`actualQty` a partir de `estimatedHours`/`completionPct`. Consumido em `ReportHeader.tsx:84` e no `DailyReportPanel` da **Gestão 360** (`src/features/gestao-360/components/DailyReportPanel.tsx:109-151`), que cruza tarefas com o projeto e as inclui no consolidado do dia.

**Barramento / servidor:**
- **eventBus** (`src/lib/eventBus.ts`): a Agenda **não emite nem escuta** eventos do eventBus nesta versão (`[código]` — não há `eventBus.on`/`emit` no `agendaStore.ts` nem na feature). Ela depende do pull global e do realtime dos stores que consome.
- **Realtime** (`src/lib/realtime.ts`): as tabelas `agenda_tasks`/`agenda_resources` **não constam** em `WATCHED_TABLES` (`realtime.ts:31-61`) — ou seja, **não há push realtime cross-usuário para a Agenda em si**. Já `master_activities` (fonte da raia Planejamento) está entre as tabelas observadas, então mudanças de planejamento feitas por outro usuário chegam à Agenda em tempo real através do `usePlanejamentoMestreStore`. `[inferido]`
- **Triggers de servidor:** as migrações de trigger cross-módulo (`0035`) não referenciam a Agenda; a exclusão passa pela RPC `request_action` (`src/lib/storeSync.ts:208-215`) e a materialização final é a RPC de aprovação que faz o soft-delete (`0034:202-203`).

## Eficiência gerada

- **Fim das planilhas de alocação:** uma única grade de recursos (equipes + equipamentos) com arrastar-e-soltar substitui múltiplos Excel de disponibilidade. `[inferido]`
- **Dado único / sem redigitação:** o que foi planejado (Planejamento Mestre) aparece sozinho na Agenda como raia somente-leitura; o que está na Agenda flui para o Diário/Gestão 360 sem recontagem (`useRelatorio360.ts`, `DailyReportPanel.tsx`). Um dado, várias telas. `[código]`
- **Reprogramação rápida:** mover/redimensionar barra recalcula datas e persiste na hora (`moveTask`/`updateTask` → flush imediato), em vez de editar célula por célula.
- **Rastreabilidade e governança:** cada tarefa carrega responsável, encarregado, local, projeto vinculado; exclusões passam por aprovação (papel `gerente`) e soft-delete, preservando histórico. `[código]`
- **Importação de cenários:** aplicar um cenário de planejamento reprograma em lote as datas das tarefas casadas por código/descrição (`ScenarioCompareModal.handleApply`), poupando ajuste manual. `[inferido]`

## Como sincroniza

- **Local-first (Zustand + persist):** o estado vive em `localStorage` sob a chave `cdata-agenda` (`agendaStore.ts:257`), com `partialize` guardando `tasks`, `resources`, `pendingSync` e `lastSyncedAt` (`:258-263`). Estado de UI (viewMode, viewStart, seleção) **não** é sincronizado ao servidor. Toda mutação (`addTask`/`updateTask`/`moveTask`/`deleteTask`) atualiza o local **imediatamente** e enfileira uma op em `pendingSync` (`:166-210`).
- **Fila de sincronização (`storeSync`):** `flush()` sobe a fila via `flushQueue` (`agendaStore.ts:228-244`); trata offline (`syncStatus:'offline'`) e ausência de perfil (`'unauth'`). `pull()` traz do servidor **apenas as tabelas sem pendências** na fila, para nunca sobrescrever dado local ainda não enviado (`agendaStore.ts:246-253`, guard `pendingTables`).
- **Orquestração global:** no login/troca de organização, `syncAllTenantStores` faz *flush* de todos os stores tenant-scoped e depois *pull* onde a fila esvaziou (`src/store/appModeStore.ts:234-239`, `211`); a Agenda está registrada como store tenant `key:'agenda'` (`appModeStore.ts:140`). Também há reflush automático ao voltar `online` (`agendaStore.ts:302-306`).
- **Multi-tenant / RLS:** todas as linhas carregam `organization_id`; as políticas de RLS (`0033_sprint6_rls.sql:123-155`) exigem `organization_id = user_org()` no SELECT (só ativos, `deleted_at IS NULL`), papel adequado no INSERT/UPDATE, e **bloqueiam DELETE direto** (`USING (false)`) — a exclusão real é sempre soft-delete via aprovação.
- **Offline:** suportado — as ops ficam em `pendingSync` e sobem quando a conexão volta; deletes são idempotentes no servidor (`storeSync.ts:216-229`).
- **Realtime cross-usuário:** **não** para as tabelas da Agenda (fora de `WATCHED_TABLES`); a atualização entre usuários da Agenda depende do próximo pull (login/troca de org). A raia "Planejamento", por vir do Planejamento Mestre, **é** realtime. `[inferido]`
