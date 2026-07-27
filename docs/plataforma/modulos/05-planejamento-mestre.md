# Planejamento (Mestre + LPS/Lean)

> **Rota(s):** `/app/planejamento-mestre` · `/app/lps-lean` → redireciona para `/app/planejamento-mestre` (`src/App.tsx:140,143`) [código]
> **Store(s):** `planejamentoMestreStore` · `planoExecucaoStore` · `planejamentoRestricoesStore` · `lpsStore` (+ `operacaoCampoStore` no Curto Prazo, `rdoStore` na ponte de execução) [código]
> **Grupo na sidebar:** **PLANEJAMENTO** — item "Planejamento", ícone `BrainCircuit` (`src/components/shared/Sidebar.tsx:45-52`) [código]

---

## O que é / problema que resolve

O módulo **Planejamento** é o cronograma-mestre da obra e o motor de derivação de horizontes. Ele parte de um **cronograma macro (WBS + curva S)** e "cascateia" automaticamente para os horizontes mais curtos: **Longo → Médio (look-ahead 6 semanas) → Curto (15 dias) → Execução → Programação Semanal**. O fluxo é apresentado como um pipeline visual (`PipelineStepper`) com "acendedores" verdes por etapa que já tem dado (`src/features/planejamento-mestre/index.tsx:475,684-714`) [código].

A partir da reorganização recente, o antigo módulo **LPS / Lean Construction (Last Planner System)** deixou de ser uma rota separada e passou a viver **embutido dentro das abas do Planejamento como sub-abas** (`SubTabHost`), preservando os dados no `lpsStore` e apenas unificando a navegação — a rota `/app/lps-lean` agora só redireciona (`src/App.tsx:143`; comentário em `index.tsx:716-720`) [código]. Assim, cada horizonte abre com sua visão nativa e oferece as camadas Lean correspondentes: look-ahead/make-ready no Médio, semáforo/CAN no Curto, PPC e Pareto de CNC no Semanal.

O problema que resolve é a fragmentação típica de planejamento de obra em várias planilhas desconectadas (cronograma no MS Project, look-ahead numa planilha, programação semanal noutra, PPC calculado à mão). Aqui é **um único conjunto de atividades** que alimenta todos os horizontes, recebe o **executado real do RDO** de volta (`syncExecutionToPlanejamento`) e sincroniza em tempo real entre usuários da mesma organização.

## Para quem (papéis / persona)

- **Planejador / Engenheiro de planejamento** — monta o cronograma macro (WBS, datas, pesos, baseline), deriva o look-ahead, faz what-if e mantém a programação semanal. [inferido]
- **Coordenador de frente / Gerente de obra** — usa Médio e Curto Prazo para gerir restrições (make-ready) e acompanhar PPC por equipe. [inferido]
- **Last Planner / líder de produção** — opera as sub-abas LPS: semáforo CAN, análise de restrições, reunião semanal, Pareto de CNC. [inferido]
- **Encarregado / apontador** — preenche Previsto × Realizado por dia na Programação Semanal, ou deixa que o RDO puxe o realizado automaticamente. [inferido]

## Funcionalidades detalhadas

### Cabeçalho e navegação
- **KPI strip** no header: nº de atividades (nível ≥ 1, não-marco), % concluído médio ponderado por peso, e "Dias p/ fim" (`PlanejamentoMestreHeader.tsx:121-131`) [código].
- **Baselines**: dropdown para carregar/excluir baseline salva e botão "Salvar Baseline" (modal com nome) — `saveBaseline`/`loadBaseline`/`removeBaseline` (`PlanejamentoMestreHeader.tsx:78-108,181-197`) [código].
- **Importar Excel/XML MS Project** e **Criar Planejamento** (`PlanejamentoMestreHeader.tsx:181-207`) [código].
- **SyncBadge** de status de sincronização via `useStoreSync` (`PlanejamentoMestreHeader.tsx:119,148`) [código].
- Abas do header: apenas `macro`, `derivacao`, `whatif`, `semanal`, `execucao` são renderizadas como abas visíveis (`PlanejamentoMestreHeader.tsx:214`); o conjunto completo de chaves inclui ainda `integrada`, `restricoes`, `operacional`, `medicao-planejamento` (`PlanejamentoMestreHeader.tsx:13-23`) [código].
- **Pipeline stepper** (Longo → Médio → Curto → Execução → Prog. Semanal) com bolinha verde por etapa que tem dado (`index.tsx:475,684-714`) [código].

### Estado vazio e criação de cronograma
Quando não há atividades, mostra empty-state com três caminhos (`index.tsx:408-469`) [código]:
1. **Criar Cronograma do Zero** — abre o `CriarCronogramaWizard` (wizard de 4 etapas: `step` 1..4, barra de progresso `(step/4)*100%`; chama `createGuidedPlan` ao gerar — `CriarCronogramaWizard.tsx:152,217,232-238,303-304`) [código].
2. **Carregar Exemplo** — `loadDemoData` importa `@/data/mockPlanejamentoMestre` (`store planejamentoMestreStore.ts:570-587`) [código].
3. **Importar MS Project** — aceita `.mpp`, `.xml`, `.xlsx`, `.xls`, `.csv` (`index.tsx:462`) [código].
   - `.mpp`: envia base64 para o backend `POST /api/import-mpp` (conversor MPXJ ou fallback textual), abre **modal de prévia** com núcleos detectados, avisos, críticos, e só então confirma como "Cronograma-base" via `addActivity` (`index.tsx:164-189,500-589`) [código].
   - `.xml` (MS Project): faz parse de `<Task>` (UID/WBS/Start/Finish/PercentComplete/OutlineLevel/predecessores/Critical/TotalSlack) e cria atividades (`index.tsx:201-258`) [código].
   - `.xlsx/.csv`: detecção heurística de colunas por aliases normalizados (nome, WBS, início, fim, duração, progresso, previsão, responsável, tipo/rede, peso, núcleo, área, local, serviço, crítico, predecessor, comprimento, ligações, marco), parse de datas (`dd/MM/yyyy`, `yyyy-MM-dd`, serial Excel), inferência de tipo de rede e **detecção automática de hierarquia pai-filho pelo código WBS** (`index.tsx:259-405`) [código].
- **Baixar template padronizado (.xlsx)** — gera planilha com 22 colunas + aba de instruções (`downloadTemplate`, `index.tsx:75-151`) [código].

### Ponte RDO ↔ Cronograma (banner)
Em todas as abas exceto Execução, um painel (`RdoPlanningBridgePanel`) cruza RDOs SABESP finalizados com as atividades por núcleo/data/rua/descrição/N.Preço e mostra KPIs: **Vinculados, Pendências, Sem foto** (`index.tsx:482,609-681`) [código].

---

### Aba 1 — Longo Prazo (`macro`) → `PlanejamentoMacroPanel`
Visão estratégica com três sub-visões alternáveis + Plano de Execução embutido (`PlanejamentoMacroPanel.tsx:236,541-566`) [código]:
- **Matriz mensal ("Gestão à Vista")** — atividade × mês com % físico (`MatrizMensalPanel`).
- **Tabela 360** — visão de orçamento (`Tabela360Panel`).
- **Takt Time** — embute o `TaktTimePanel` do LPS (`PlanejamentoMacroPanel.tsx:555`) [código].
- **CRUD de atividade**: "Nova Atividade" (formulário com pai/WBS/tipo de rede/datas/equipe/unidade/quantidade planejada/peso/% previsto/marco/`operationalKey` para vincular RDO — `PlanejamentoMacroPanel.tsx:40-172`), edição inline e exclusão com `ConfirmDialog` (avisa que remove de todos os horizontes — linha 572) [código].
- **Baseline** (salvar/selecionar), **export PDF** (`window.print`) e **Excel** (`exportExcel`), filtros por busca/status/rede/serviço/núcleo (`PlanejamentoMacroPanel.tsx:177-197,251-260,429-504`) [código].
- **Escopo por obra**: usa `byActiveObra` + `activeObraId`; KPIs de contrato (contratante, orçamento/BAC da Torre, núcleos, takt teórico, físico/financeiro médio, **EAC por PPC**) (`PlanejamentoMacroPanel.tsx:266-324`) [código].
- **Backfill de obra**: destaca atividades "sem obra" (legadas) e permite vincular uma a uma, em lote (`backfillObraId`) ou excluir (`PlanejamentoMacroPanel.tsx:263-300,507-536`) [código].
- **Plano de Execução (por obra)** embutido no rodapé (`ExecucaoPanel`), só com obra selecionada (`PlanejamentoMacroPanel.tsx:558-566`) [código].

### Aba 2 — Médio Prazo (`derivacao`) → `MedioPrazoTab` (SubTabHost)
Sub-abas (`index.tsx:750-760`) [código]:
- **Derivação (6 semanas)** → `DerivacaoPanel`: grade look-ahead (linhas = atividades agrupadas por categoria de rede; colunas = 6 semanas ISO). **Cascata automática**: re-deriva sempre que o mestre muda via `useEffect` sobre `activities` (`DerivacaoPanel.tsx:419-422`) [código]. Cada célula é status (Planejado/Pronto/Bloqueado/Executado) editável em modal, que também edita a atividade-mestre (nome/rede/datas), cria Plano de Execução, e mostra restrições vinculadas (`DerivacaoPanel.tsx:170-304`) [código]. Linha **PPC por semana** por bloco de categoria (`DerivacaoPanel.tsx:366-400`) [código]. Botão **"Enviar ao Look-ahead"** empurra as derivadas para o `lpsStore` (idempotente por `sourceMasterId` = `masterActivityId:weekIso`) (`DerivacaoPanel.tsx:471-494`) [código]. Strip fixo de 6 semanas garantido mesmo sem atividade (`isoWeekStrip`, `DerivacaoPanel.tsx:428-434`) [código].
- **Look-ahead (LPS)** → `LookAheadPanel`.
- **Restrições (LPS)** → `RestricoesPanel` (make-ready) — recebe `obraName` (`index.tsx:756`) [código].
- **Timeline de restrições** → `TimelineRestricoesPanel`.

### Aba 3 — Curto Prazo (`whatif`) → `CurtoPrazoTab` (SubTabHost)
Sub-abas (`index.tsx:764-774`) [código]:
- **Produção 15 dias** → `CurtoPrazoPanel`: consome `operacaoCampoStore`. Calendário de **15 dias úteis** (linhas Previsto/Realizado por atividade, Realizado editável para dias passados/hoje), **PPC diário** no rodapé, **PPC semanal** (últimas 6), **Curva S previsto × realizado** (SVG com zona vermelha de atraso), **tabela de impacto/atrasos** (rate < 0.85) e **serviços notáveis** (`CurtoPrazoPanel.tsx:202-438`) [código].
- **Simulador What-if** → `WhatIfPanel`: ajustes transitórios de datas/duração e **dupla curva S** original × simulada (`WhatIfPanel.tsx:13-80`; motor `applyWhatIfAdjustments`/`runWhatIfSimulation`) [código].
- **Semáforo (LPS)** → `SemaforoPanel`: tabela pronto/não-pronto (verde/amarelo/vermelho = CAN) com **edição inline de CNC** (categoria + descrição) (`SemaforoPanel.tsx:11-107`) [código].
- **Mão de obra (LPS)** → `MaoDeObraLpsPanel`.
- **Alertas (LPS)** → `AlertasPanel`.

### Aba 4 — Execução (`execucao`) → `ExecucaoTab` (SubTabHost)
Sub-abas (`index.tsx:777-784`) [código]:
- **Execução** → `ExecucaoPanel` (feature `planejamento`): o **Plano de Execução** (modo Compizzo) — cabeçalho da obra + cronograma/equipe/bonificação/condições, faturamento previsto (`planoExecucaoStore`) [código].
- **Integrações (LPS)** → `IntegracoesPanel`: status dos feeds cross-módulo (Suprimentos, Mão de Obra, RDO, Qualidade, Equipamentos, Medição) (`lpsStore.ts:207-214,354-372`) [código].

### Aba 5 — Prog. Semanal (`semanal`) → `SemanalTab` (SubTabHost)
Sub-abas (`index.tsx:787-796`) [código]:
- **Programação** → `ProgramacaoSemanalPanel`: tabela Previsto × Realizado por dia (Seg–Dom) e atividade, com colunas de identificação (item/núcleo/local/atividade/comprimento/qtd.ligações/%peso/coordenador/ação-restrição/unidade) todas **editáveis inline** e acumulados (Prev Sem., Real Sem., Acum. Anterior, Acum. Atual, Acum. Total) (`ProgramacaoSemanalPanel.tsx:154-600`) [código]. Ações: navegação por semana ISO, filtro por núcleo, adicionar/excluir atividade, **"Gerar da derivação"** (distribui a quantidade das derivadas da semana entre Seg–Sex), **"Puxar realizado (RDO)"** (produção m² dos RDOs Compizzo vinculados por `planningActivityId`), export Excel (`ProgramacaoSemanalPanel.tsx:199-344`) [código].
- **Modo reunião (LPS)** → `ReuniaoSemanalPanel`.
- **PPC (LPS)** → `PpcDashboard` (recebe `activeObraId`, `index.tsx:793`) [código].
- **Pareto CNC (LPS)** → `LpsAnalyticsPanel`.

### Abas auxiliares (chaves existentes, não no stepper)
- **Visão Integrada** (`integrada`) → `VisaoIntegradaPanel`: os 3 horizontes empilhados em blocos colapsáveis + export combinado em PDF (`VisaoIntegradaPanel.tsx:50-141`) [código].
- **Planejamento por Restrições** (`restricoes`) → `PlanejamentoRestricoesPanel` (store `planejamentoRestricoesStore`).
- **Planejamento Operacional** (`operacional`) → `PlanejamentoOperacionalPanel` (reúne LookAhead/Reunião/PPC do LPS — `PlanejamentoOperacionalPanel.tsx:10-12`) [código].
- **Medição → Planejamento TESTE** (`medicao-planejamento`) → `MedicaoPlanejamentoTestePanel`.

### Sub-abas LPS soltas (rota antiga, ainda no `LpsPage`)
O `LpsPage` (`src/features/lps-lean/index.tsx`) mantém as abas: Modo Reunião, Semáforo, Look-ahead, PPC Dashboard, Takt Time, Restrições, Pareto (analytics), Timeline Restrições, Alertas, Mão de Obra, Integrações (`LpsHeader.tsx:21-33`) — hoje acessível apenas via redirect (`App.tsx:143`) [código].

## Dados que gera

Padrão de todas as tabelas do grupo (migração `0019_grupo_operacional.sql`): PK `uuid`, `organization_id` FK NOT NULL, `created_by` FK `auth.users`, `created_at/updated_at/deleted_at` (soft-delete), **`payload jsonb` com a entidade completa** + colunas top-level só para campos indexáveis (`0019_grupo_operacional.sql:1-12`) [schema].

**Planejamento-Mestre (4 tabelas)** (`0019:196-264`) [schema]:
- `master_activities` — `wbs_code, name, parent_id, level, planned_start, planned_end, status` + payload (`MasterActivity`). Índice por `parent_id`. Mapeada em `masterActivityToRow` (`planejamentoMestreStore.ts:38-52`) [código].
- `master_baselines` — `name` + payload (snapshot das atividades) (`0019:219-231`; `masterBaselineToRow` linha 53-61) [schema/código].
- `lookahead_derived_activities` — `master_activity_id, week_iso, status` + payload; id estável `derived-<masterId>` para upsert idempotente (`0019:233-248`; `lookaheadToRow` 62-72; `deriveFromMaster` 512-537) [schema/código].
- `programacao_diaria` — `activity_id, date` + payload (`0019:250-264`) [schema]. Observação: o slice `programacaoSemanal` é hoje sincronizado como blob via `app_state` (ver abaixo), não linha-a-linha.

**LPS-Lean (3 tabelas)** (`0019:104-156`) [schema]:
- `lps_activities` — `week, trecho_code, ready_status` + payload (`LpsActivity`: planned/completed/committed/readyStatus/cncCategory/cncDescription/plannedMeters/executedMeters…) (`activityToRow`, `lpsStore.ts:59-69`) [código].
- `lps_restrictions` — `tema, categoria, status, prazo_remocao, resolved_at` + payload (`restrictionToRow`, 70-82) [código].
- `lps_takt_zones` — `code` + payload (zona: lengthM/taktDays/actualDays) (`taktZoneToRow`, 83-91) [código].

**Plano de Execução (1 tabela)** — `plano_execucao` (`20260702120000_plano_execucao.sql:7-28`): `site_id` FK `construction_sites` (ON DELETE SET NULL), `periodo_inicio, periodo_fim, area_m2, servico, preco_m2, faturamento_previsto, status` + payload (cronograma/equipe/bonificação/condições) (`planoToRow`, `planoExecucaoStore.ts:54-69`) [schema/código].

**Restrições de Planejamento** — `planejamentoRestricoesStore` persiste `PlanejamentoRestricao` (título, descrição, horizonte, categoria, status, responsável, prazo, plano de remoção, impactoDias/impactoPpc/impactoCurvaS, vínculos `atividadeMestreId`/`lookaheadId`/`lpsRestrictionId`) localmente + blob em `app_state` (`planejamentoRestricoesStore.ts:13-33,175-179`) [código].

## Cálculos, KPIs e regras de negócio

Motor puro em `masterEngine.ts` (sem efeitos colaterais) [código]:
- **Curva S mestre** (`computeMasterSCurve`, linhas 19-59): progresso cumulativo dia-a-dia; cada atividade contribui `peso/pesoTotal × 100`, interpolado linearmente entre `trendStart` e `trendEnd`; teto de 100% e limite de 730 dias [código].
- **Look-ahead** (`deriveLookahead`, 101-144): filtra atividades não-marco, `level ≥ 1`, cujo intervalo `trendStart..trendEnd` sobrepõe a janela de N semanas a partir de hoje; classifica status: `completed` se concluída, `ready` se `percentComplete ≥ 50`, `blocked` se `delayed`, senão `planned`; atribui semana ISO (`getIsoWeek`) [código].
- **What-if** (`applyWhatIfAdjustments`, 72-93): desloca `trendStart` por `deltaStartDays` e recalcula `trendEnd` com `durationDays + deltaDurationDays` (mín. 1), sem mutar o array original [código].
- **PPC (LPS)** (`computeWeeklyPPC`, `lpsStore.ts:37-54`): por semana, `PPC = round(concluídas / planejadas × 100)`; **meta = 80%** (`PpcDashboard.tsx:34`); cores verde ≥80 / amarelo 60-80 / vermelho <60; média móvel de 4 semanas e PPC por equipe (`PpcDashboard.tsx:51-109`) [código].
- **PPC no Médio** (`DerivacaoPanel PpcRow`): concluídas ÷ total da semana no bloco de categoria [código].
- **Pareto de CNC** — contagem de `cncCategory` das atividades não-concluídas, ordenada desc (`PpcDashboard.tsx:68-77`) [código]. Analytics adicionais (`LpsAnalyticsPanel`): restrições por tipo/status/responsável, **tempo médio de resolução** (`resolvedAt − createdAt`), críticas (prazo vencido e não resolvida) (`LpsAnalyticsPanel.tsx:40-67`) [código].
- **Takt Time** (`recalculateTakt`, `lpsStore.ts:266-283`; `TaktTimePanel.tsx:20-34`): `taktPorZona = round(taktTotalDays / nºZonas)`; on-time se `actualDays ≤ taktDays`. Takt teórico do contrato: `calcTaktDays = round(dias / max(1, nºNúcleos))` (`planejamentoMestreStore.ts:74-79`) [código].
- **EAC por PPC** (Longo Prazo): `IDC = max(0.35, físicoMédio/100)`; `EAC = BAC / IDC`, com BAC vindo da Torre por obra (`obraBacFromSite`) (`PlanejamentoMacroPanel.tsx:283-284`) [código].
- **% concluído no header**: média ponderada por peso `Σ(peso×%)/Σ(peso)` (`PlanejamentoMestreHeader.tsx:122-125`) [código].
- **Reconciliação RDO → % físico** (`rdoStore.syncExecutionToPlanejamento`, `rdoStore.ts:431-555`): só RDOs finalizados contribuem; acumula por `planningActivityId`/`operationalKey`, global e por obra (evita contaminação cross-obra). `percentComplete = min(100, quantidade/plannedQuantity)`; se sem `plannedQuantity`, usa meta m² da obra (caso Compizzo) ou `progressPct`. **Reconcilia sempre**: atividade que perdeu vínculo com RDO (`lastRdoDate` setada) é **zerada**, evitando dupla contagem; progresso manual (sem `lastRdoDate`) fica intacto (`rdoStore.ts:519-552`) [código].

## Integrações — a "camada única"

**Eventos do `eventBus`** (`src/lib/eventBus.ts`) [código]:
- **Consome** `planning.activity_imported`: um Plano de Execução vira atividade no Mestre (`sourceExecucaoId = planoId:atividadeId`, idempotente) e uma `LpsActivity` no look-ahead do LPS (`planejamentoMestreStore.ts:669-696`; `lpsStore.ts:637-656`) [código].
- **Consome** `master_activity.delayed`: mover a atividade ligada no Mestre desloca o Plano de Execução original (`applyExecucaoFromEvent` suprime o eco — `planoExecucaoStore.ts:267-290`) [código].
- **Emite** `master_activity.delayed` quando uma atividade com `sourceExecucaoId` muda de data (guarda anti-eco `suppressMasterEmit`, `planejamentoMestreStore.ts:29-35,229-233`) [código].
- **Emite** `planning.activity_imported` quando o Plano de Execução muda um campo de cronograma (`PLANO_SYNC_KEYS`, `planoExecucaoStore.ts:26-32,161`) [código].
- **LPS consome** `rdo.finalized` → `syncPlatformFlow` (puxa execução do RDO/RDO SABESP, abre restrições de Qualidade/Suprimentos/Equipamentos/Medição bloqueada — `lpsStore.ts:374-531,633-635`) [código]; e `fvs.nc_opened`, `measurement.approved/blocked`, `lps.commitment_updated` → re-pull (`lpsStore.ts:619-631`) [código].

**Triggers de servidor** (`0035_cross_module_triggers.sql`) [schema]:
- `sync_rdo_to_planejamento` (RDO → executed meters em plan_trechos) [schema].
- `sync_fvs_nc_to_lps`: FVS com `ncRequired=true` insere `lps_restrictions` idempotente (`0035:112-141`) — por isso o `lpsStore` re-puxa ao ouvir `fvs.nc_opened` [schema/código].

**Realtime** (`src/lib/realtime.ts`): channel por organização escuta INSERT/UPDATE/DELETE (com coalescing de ~350 ms) e reemite `realtime.row_changed`. Tabelas observadas incluem `master_activities`, `lookahead_derived_activities`, `plano_execucao`, `lps_restrictions`, `lps_activities` (`realtime.ts:31-62`) [código]. Os stores reagem re-puxando: Mestre em `master_activities`/`lookahead_derived_activities` (`planejamentoMestreStore.ts:662-666`); LPS em `lps_*`/`measurement_*`/`plan_trechos` (`lpsStore.ts:657-667`); Execução em `plano_execucao` (`planoExecucaoStore.ts:262-264`) [código].

**O que alimenta / o que consome (resumo):**
- **Consome de:** RDO/RDO SABESP (executado, m², CNC), Qualidade (NC/FVS → restrições), Suprimentos, Equipamentos, Medição (bloqueios), Torre de Controle (BAC/obra), Mão de Obra (staffing).
- **Alimenta:** LPS (look-ahead, atividades), Plano de Execução (Mestre ↔ Execução bidirecional), Programação Semanal (previsto/realizado), e a própria curva S / % físico consumida por outros dashboards. [inferido]

## Eficiência gerada

- **Dado único em vez de N planilhas**: uma atividade-mestre cascateia para Médio/Curto/Semanal automaticamente; excluir/mover no Longo Prazo reflete em todos os horizontes (avisos explícitos nos `ConfirmDialog`) — elimina reconciliação manual entre planilhas de cronograma, look-ahead e programação. [inferido, apoiado em `index.tsx:716-720`, `DerivacaoPanel.tsx:419-422`]
- **PPC e Pareto de CNC automáticos**: PPC diário/semanal/por equipe e Pareto de causas saem direto das marcações de conclusão/CNC, sem cálculo manual (`PpcDashboard.tsx`, `computeWeeklyPPC`) [código].
- **Realizado sem redigitação**: o RDO devolve o executado ao cronograma (`syncExecutionToPlanejamento`) e à Programação Semanal ("Puxar realizado (RDO)") — o apontador registra uma vez e o número aparece no planejamento. [inferido, apoiado em `rdoStore.ts:431`, `ProgramacaoSemanalPanel.tsx:224-254`]
- **Tempo real cross-usuário**: mudança de outro navegador atualiza a tela sem F5 (realtime + re-pull), com coalescing para não gerar op-storm em importações em lote (`realtime.ts:67-95`) [código].
- **Rastreabilidade**: baseline (Rev.0 automático no wizard), `auditLog` de eventos de planejamento, e restrições com vínculo `lpsRestrictionId`/`atividadeMestreId` fecham o rastro make-ready → produção. [inferido, apoiado em `planejamentoMestreStore.ts:417-437`]
- **Import de MS Project** (.mpp/.xml) com prévia — traz cronogramas legados sem retrabalho manual. [inferido, apoiado em `index.tsx:164-405`]

## Como sincroniza

- **Local-first**: cada store usa `persist` (localStorage: `cdata-planejamento-mestre`, `cdata-lps`, `cdata-plano-execucao`, `cdata-planejamento-restricoes`) e enfileira operações (`makeOp`/`pendingSync`) que são drenadas por `flush()` via `flushQueue`; a UI responde imediatamente e o backend sincroniza em segundo plano (`planejamentoMestreStore.ts:161-164,598-627,629-644`) [código].
- **Pull com guarda anti-perda**: `pull()` não sobrescreve tabela que tem op pendente (`pendingTables.has(...)`), evitando perder edição local não sincronizada (`planejamentoMestreStore.ts:616-626`; `lpsStore.ts:585-594`; `planoExecucaoStore.ts:236-242`) [código].
- **Offline**: `flush` detecta `navigator.onLine` e marca status `offline`; ao voltar online (`window 'online'`) re-drena a fila (`planejamentoMestreStore.ts:601,656-659`) [código].
- **RLS / multi-tenant por `organization_id`**: `ensureTenantScope` limpa o local ao trocar de organização (usa `getTenantMarker`), garantindo isolamento; RLS é aplicada na migração `0020` e as tabelas exigem `organization_id` (`planejamentoMestreStore.ts:192-204`; `0019:12`) [código/schema].
- **Aprovações em DELETE crítico**: exclusões passam por `request_action` (approvalActionType), ex.: `delete_master_activity`, `delete_master_baseline`, `delete_lps_activity`, `delete_lps_restriction`, `mark_restriction_resolved`, `delete_plano_execucao` (`planejamentoMestreStore.ts:239,494`; `lpsStore.ts:245,300,312,547`; `planoExecucaoStore.ts` soft-delete) [código].
- **Blob sync via `app_state`**: o slice local-only do Mestre (contrato, núcleos, `programacaoSemanal`, `auditLog`) e as restrições de planejamento sincronizam por empresa como blob (`attachBlobSync`) (`planejamentoMestreStore.ts:650-654`; `planejamentoRestricoesStore.ts:175-179`) [código].
- **Realtime**: canal por org (ver seção Integrações) fecha o loop de atualização entre clientes (`realtime.ts`) [código].
