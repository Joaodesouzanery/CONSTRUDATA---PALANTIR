# Operação de Campo & Rede 360

> **Rota(s):** `/app/rede-360` (declarada no `moduleRegistry`, mas **não montada** em `App.tsx`) · Operação e Campo **sem rota registrada** — ver nota abaixo · **Store(s):** `operacaoCampoStore` (`src/store/operacaoCampoStore.ts`), `rede360Store` (`src/store/rede360Store.ts`) · **Grupo na sidebar:** Rede 360 → `analytics` (`src/features/minha-rotina/moduleRegistry.ts:145-150`); Operação e Campo → sem entrada de registry/rota

> ⚠️ **Nota de estado de integração [código].** As páginas `OperacaoCampoPage` (`src/features/operacao-campo/index.tsx:12`) e `Rede360Page` (`src/features/rede-360/index.tsx:20`) estão implementadas por completo (stores, componentes, migrações, RLS e RPCs de aprovação), porém **não há `<Route>` correspondente em `src/App.tsx`** — não existe `path="rede-360"` nem `path="operacao-campo"` no bloco de rotas (`src/App.tsx:110-154`). Não há import de nenhuma das duas páginas fora dos próprios `index.tsx` (o único import cruzado é o `fieldEngine` reutilizado pelo store, `src/store/operacaoCampoStore.ts:16`). Portanto, hoje os dois módulos são **features "prontas mas desconectadas do roteador"**: o back-end (tabelas + RLS + soft-delete via aprovação) já existe e as telas renderizam a partir dos stores, mas o usuário final não alcança as telas por navegação padrão. Este documento descreve o comportamento **como codificado**, marcando [inferido] onde a intenção de produto é interpretação.

---

## O que é / problema que resolve

Estes são dois módulos operacionais irmãos, ambos voltados à **camada de campo/rede** da ConstruData, mas com focos distintos:

- **Operação e Campo** é um *cockpit de produção diária* (`OperacaoCampoHeader.tsx:33` descreve como "Cockpit de produção diária"). Resolve o problema do acompanhamento **planejado × realizado no chão de obra**, dia a dia, por atividade/frente. O engenheiro de campo lança a quantidade realizada de cada serviço em cada dia útil (Linha B), e o sistema compara automaticamente contra o planejado (Linha A), calculando PPC semanal (Percentual de Programação Concluída, indicador Lean/Last Planner), curva de tendência (Curva S) e curvas de serviços notáveis. Substitui a clássica "planilha A/B de frente" que se perde entre equipes.

- **Rede 360** é um *Common Operating Picture* (COP) de redes de distribuição — saneamento (água/esgoto/drenagem) e infraestrutura civil (`moduleRegistry.ts:149`). Reúne, num mapa único georreferenciado + grades tabulares, o inventário de ativos de rede, ordens de serviço, interrupções ao vivo (outages) e análise de risco. É inspirado no padrão Palantir/utility-COP: camadas ligáveis, drill-down por ativo, geração de OS a partir de risco. Resolve a fragmentação entre GIS, manutenção e centro de operações.

Ambos são **local-first sobre Supabase** (Zustand + `persist` + fila de sync), multi-tenant por `organization_id`, seguindo o mesmo padrão dos demais stores migrados (Sprint 3 para Operação e Campo; Sprint 5 para Rede 360 — ver cabeçalhos dos stores).

## Para quem (papéis / persona)

- **Operação e Campo:** engenheiro/encarregado de campo e planejador de produção (lançamento do realizado diário e leitura de PPC/tendência). O ator que aprova exclusões é o papel **`gerente`** (matriz de aprovação, ver seção de cálculos). [inferido] persona-alvo: quem hoje mantém a planilha "Linha A/Linha B" de acompanhamento físico.
- **Rede 360:** operador de centro de controle de rede / despachante de manutenção (mapa + outages + OS), engenheiro de ativos (drill-down, inspeções, risco) e gestor de manutenção (kanban de OS). [inferido] alinhado a operadoras de saneamento (persona Sabesp-like, dado o vocabulário "esgoto/água/drenagem" e a existência do RDO-Sabesp no mesmo projeto).

---

## Funcionalidades detalhadas

### A) Operação e Campo

Layout: split-view no desktop (Calendário à esquerda, Dashboards à direita) e alternância por abas no mobile (`operacao-campo/index.tsx:27-58`). No topo há uma faixa de KPIs (`OperacaoCampoHeader`).

**Faixa de KPIs (`OperacaoCampoHeader.tsx`)** — 4 métricas calculadas ao vivo a partir do store:
- **PPC Semanal** — último PPC da lista `weeklyPpcResults` (`OperacaoCampoHeader.tsx:14`); cor verde ≥80%, amarelo ≥60%, vermelho abaixo (`:39`).
- **Dias Restantes** — nº de datas futuras distintas com dado no calendário (`:22-23`).
- **Desvio Acumulado** — `actualCumulativePct − plannedCumulativePct` do último ponto de tendência, com sinal e cor (`:17-19,41`).
- **Atividades Hoje** — nº de linhas de calendário cuja `date` == hoje (`:15,42`).

**Painel Calendário (`CalendarioPanel.tsx`)** — grade tipo cronograma físico:
- Alternância de visão **15 dias / Mensal** (30 dias) via `viewMode` (`:64-77`); as datas visíveis pulam sábados e domingos (`:44-51`, só dias úteis).
- Navegação por `‹ / ›` que desloca o cursor em ±15 ou ±30 dias (`:80-88`) e botão **Hoje** (`:91-96`).
- Para cada atividade, **duas linhas**: **Linha A = Planejado** (somente leitura, mostra `plannedQty`, `:129-136`) e **Linha B = Realizado** (célula editável `<input type=number>` que chama `updateCalendarDay(date, activityId, {actualQty})`, `:155-165`). Só é editável em datas passadas ou hoje (`isPast || date === today`, `:145,154`); datas futuras exibem `—`.
- **Semáforo por célula:** realizado ≥ planejado → fundo verde; realizado < planejado → fundo vermelho (`:147-150`).
- **Linha PPC** no rodapé da grade: para cada sexta-feira visível exibe o PPC (`:180-199`); cor verde ≥80 / amarelo ≥60 / vermelho (`:191`). Observação [código]: a implementação atual mostra sempre o **último** PPC calculado em cada sexta (`idx === weeklyPpcResults.length - 1`, `:186-189`), não o PPC específico daquela semana.

**Painel Dashboards (`DashboardsPanel.tsx`)** — dois blocos:
- **Curvas de Serviços Notáveis** — até 3 mini-gráficos SVG (planejado tracejado × realizado laranja) por atividade (`ServiceChart`, `:11-60`; fonte de dados limitada às 3 primeiras atividades em `fieldEngine.ts:77`).
- **Tendência — Curva S** (`TrendMiniSCurve`, `:64-129`) — curva acumulada planejado × realizado em %, com **detecção de atraso**: se o realizado acumulado ficar >2 p.p. abaixo do previsto, marca "Atraso detectado" e pinta uma área vermelha de desvio (`:83-92,104-113`).

### B) Rede 360

Header próprio (`Rede360Header.tsx`) com marca "Rede 360", **busca global** na rede (`searchQuery`, `:32-38` — estado existe no store porém [código] não é aplicado como filtro nos painéis atuais), selo "Dados Nacionais" e badge de **Interrupções Ativas** contando outages com `status==='active'` (`:23,41-46`). Quatro abas (`Rede360Tab`, `types/index.ts:2001`):

**1. Início / `home` (`MapaOperacionalPanel` + `GridBottomPanel`)** — o COP propriamente dito:
- **Mapa Leaflet** (`MapaOperacionalPanel.tsx`) centrado em São Paulo (`[-23.55,-46.63]`, `:70`), com 4 basemaps selecionáveis: Dark, Ruas, Satélite, Light (CartoDB/Esri, `:26-31,234-242`).
- Renderiza camadas condicionadas a `layerVisibility`: polilinhas e centróides de **circuitos** coloridos por tipo de rede/risco (`:77-112`), **ativos de rede** (cor por risco, `:115-135`), **dispositivos** (`:138-154`), **estações meteorológicas NWS** (`:157-176`), **ordens de serviço** ancoradas no ativo com offset e cor por prioridade (`:179-200`) e **overlays de interrupção** (círculo vermelho translúcido, `:203-229`).
- Clique no ativo/circuito seleciona (`setSelectedAssetId` / `setSelectedCircuitId`) e abre o **drill-down**. Legenda de risco fixa no canto (`:246-268`).
- **Grade inferior (`GridBottomPanel.tsx`)** — painel recolhível (`bottomPanelOpen`) com 7 abas de ativos, cada uma com contagem: **Circuit Asset, Device Asset, NWS Weather Station, Customer, Structure Asset, Vegetation Management Point Activity, System Hardening Point Activity** (`:48-56`). Cada aba renderiza uma tabela densa própria (colunas em `:101-272`), com badge de risco reutilizado (`RiskBadge`).

**Painel de drill-down do ativo (`AtivoDrillDownPanel.tsx`)** — abre sobre o mapa quando há `selectedAssetId`; 4 sub-abas (`:12-17`):
- **Geral** — tipo, rede, datas de instalação/última/próxima inspeção (com alerta ⚠ se vencida), material, diâmetro, comprimento, clientes, notas (`:138-168`).
- **Monitoramento** — vazão (L/min), pressão (bar), perda (% com alerta se >10), qualidade da água, e tabela de leituras de sensores (`:170-233`).
- **Histórico** — timeline de inspeções (mock derivado de `lastInspection`, `:77-91,235-252`).
- **OS** — ordens de serviço vinculadas ao ativo (`assetOrders`, `:75,254-284`).

**2. Mapa de Interrupções / `outages` (`LiveOutagePanel.tsx`)** — sala de crise:
- Barra de KPIs: nº de interrupções **Ativas** (com bolinha pulsante), **Em Monitoramento** e **total de clientes afetados** somando outages não resolvidas (`:13-17,31-47`).
- Mapa (55% da altura) com marcadores por outage — vermelho se ativo, amarelo se monitorando; raio maior para ativos; tooltip permanente com o tipo (`:50-71`).
- Tabela de outages: ID, Tipo, Status, nº de ativos afetados, clientes, Início, ETR (tempo estimado de restabelecimento), Causa (`:74-107`).

**3. Planejamento Integrado / `planning` (`OrdensServicoPanel.tsx`)** — **Kanban de Ordens de Serviço** com 4 colunas: Pendente → Em Execução → Concluída → Cancelada (`:11-16`):
- **Nova OS** (modal, `:116-175`): campos Ativo (opcional, vincula a um `NetworkAsset`), Tipo (Inspeção/Manutenção/Emergência/Troca/Outro), Prioridade (Baixa/Média/Alta/Emergência), Responsável, Data Prevista, Horas Estimadas e Descrição (obrigatória). Gera `code` automático `OS-<ano>-<4 dígitos>` (`:85`).
- **Cards**: prioridade com badge colorido, descrição, ativo, equipe, data prevista; botão **"Avançar →"** que promove o status conforme `STATUS_NEXT` (pending→in_progress→completed, `:34-39,212-218`) e **excluir** com `ConfirmDialog` (`:220-235`).

**4. Gestão de Risco / `risk` (`RiscoPanel.tsx`)**:
- **4 cartões de KPI** contando ativos por nível: Crítico / Alto / Médio / Baixo (`:60-96`).
- **Lista "Ativos em Risco"** ordenada por severidade (`:65-67,105-141`), com data da próxima inspeção (⚠ vermelho se vencida) e botão **"Gerar OS"** — só para ativos `critical`/`high` — que cria automaticamente uma OS de Inspeção prioridade alta (`code` `OS-AUTO-<4 dígitos>`, `:123-137`).
- **Gráfico de barras empilhadas** "Distribuição por Tipo": para cada `NetworkAssetType`, empilha a contagem por nível de risco (`:144-206`).

**Painel de ativos completo (`AtivosPanel.tsx`)** — [código] componente implementado (busca por nome/código; filtros por tipo, status, risco e rede; **exportação CSV** `ativos-rede360.csv` via Blob, `:96-110`; clique abre o drill-down na aba Início), **porém não é referenciado no `rede-360/index.tsx`** — nenhuma das 4 abas o renderiza. É funcionalidade pronta mas atualmente não plugada [inferido].

---

## Dados que gera

### Operação e Campo — 2 tabelas (`0019_grupo_operacional.sql:162-192`)

- **`operacao_campo_activities`** — atividades/frentes. Colunas top-level: `id, organization_id, name, trecho_code, payload jsonb, created_by, created_at, updated_at, deleted_at`. O objeto de domínio (`FieldCalendarActivity`, `types/index.ts:2296`) traz `id, name, masterActivityId, trechoCode, responsible` — o `masterActivityId` [inferido] é o gancho para amarrar a frente de campo a uma atividade do Planejamento Mestre.
- **`operacao_campo_days`** — lançamentos diários. Top-level: `id, organization_id, date, activity_id, payload jsonb, created_by, timestamps, deleted_at`. Domínio (`FieldCalendarDay`, `:2304`): `date, activityId, plannedQty, plannedUnit, actualQty (nullable), notes`. Índices por `date` e `activity_id` (`:191-192`). Padrão do projeto: **payload jsonb completo + colunas indexáveis** (cabeçalho do store, `operacaoCampoStore.ts:5-6`). O `id` da linha-dia é derivado como `${date}_${activityId}` quando não vem UUID (`dayToRow`, `:20-27`), e `activity_id` só é gravado se for UUID válido (`:24`).

### Rede 360 — 3 tabelas (`0029_frotas_geo.sql:303-362`)

- **`rede_ativos`** — tabela **polimórfica** via `asset_type` ('network' | 'circuit' | 'device' | 'weather' | 'customer' | 'structure' | 'vegetation' | 'hardening', comentário em `:307`). Colunas: `id, organization_id, project_id, asset_type, code, name, lat, lng, network_type, status, risk_level, payload jsonb, created_by, timestamps, deleted_at`. Índices por org, `asset_type` e `status`. [código] Hoje o store só materializa `asset_type='network'` na tabela ao dar `pull` (`rede360Store.ts:239-243`); os demais tipos (circuito, device, etc.) vivem em arrays locais de mock (`circuitAssets`, `deviceAssets`, `weatherStations`, `customers`, `structureAssets`, `vegetationPoints`, `hardeningPoints`) e **não têm mapper de escrita** — só o array `assets` (network) e as OS sincronizam.
- **`rede_service_orders`** — `id, organization_id, asset_id, code, status, priority, scheduled_date, payload jsonb, created_by, timestamps, deleted_at`. Domínio `Rede360ServiceOrder` (`types/index.ts:2033`).
- **`rede_outages`** — `id, organization_id, type, status, start_time, resolved_time, payload jsonb, created_by, timestamps, deleted_at`. [código] Marcada como **local-only por enquanto** (cabeçalho do store, `rede360Store.ts:6`): sem CRUD/sync no store; as outages vêm de mock e são persistidas só no `localStorage`.

Entidades de domínio somente-local (mock, `mockRede360.ts`): `CircuitAsset, DeviceAsset, NWSWeatherStation, CustomerRecord, StructureAsset, VegetationPoint, HardeningPoint` (`types/index.ts:2061-2153`).

---

## Cálculos, KPIs e regras de negócio

Toda a matemática de Operação e Campo está em `fieldEngine.ts` (funções puras):

- **PPC (Percentual de Programação Concluída)** por semana ISO: `PPC = round(Σ realizado / Σ planejado × 100)`, considerando só dias com `actualQty ≠ null` (`fieldEngine.ts:18-29`). Semana ISO calculada em `getIsoWeek` (`:6-13`). `computeAllWeeklyPpc` gera um resultado por semana com lançamento (`:34-42`).
- **Curva de Tendência (Curva S)**: acumula planejado e realizado ao longo das datas ordenadas e converte em % do total planejado, com teto em 100% (`computeTrendFromDays`, `:47-68`).
- **Curvas de Serviços Notáveis**: para as **3 primeiras atividades**, série `{date, planned, actual}` por data (`computeNotableServiceData`, `:73-95`).
- **Detecção de atraso** (`DashboardsPanel.tsx:85`): `actualCumulativePct < plannedCumulativePct − 2` no último ponto realizado.
- **Desvio acumulado** (KPI header): `actualCumulativePct − plannedCumulativePct` do último ponto (`OperacaoCampoHeader.tsx:17-19`).

Rede 360:
- **Contagens de risco** por nível e por tipo (`RiscoPanel.tsx:60-77`), base dos KPIs e do gráfico empilhado.
- **Vencimento de inspeção**: `isOverdue = nextInspectionDue < hoje` (`AtivoDrillDownPanel.tsx:55-58`, `AtivosPanel.tsx:64-67`, `RiscoPanel.tsx:47-50`).
- **Regra de negócio "Gerar OS por risco"**: apenas ativos `critical`/`high` habilitam a geração automática de OS de inspeção (`RiscoPanel.tsx:107,123-137`).
- **Perda de água crítica**: alerta visual quando `lossPercent > 10` (`AtivoDrillDownPanel.tsx:187`).
- **Total de clientes afetados** = Σ `affectedCustomers` das outages não resolvidas (`LiveOutagePanel.tsx:15-17`).

**Regra de exclusão via aprovação (matriz):** exclusões não apagam direto — passam pela matriz de aprovação com papel default **`gerente`**. Ações registradas: `delete_operacao_campo_activity`, `delete_operacao_campo_day` e `delete_rede_service_order` (`0034_sprint6_rpcs.sql:36-37,76`). O soft-delete real (`SET deleted_at = now()`) só ocorre quando a ação é aprovada (`0034_sprint6_rpcs.sql:158-159,193`). No cliente, `removeServiceOrder` enfileira a op com `approvalActionType: 'delete_rede_service_order'` (`rede360Store.ts:166`), que o `storeSync` traduz em `supabase.rpc('request_action', …)` (`storeSync.ts:208-210`) em vez de DELETE direto — coerente com as políticas RLS que **bloqueiam DELETE** (`FOR DELETE … USING (false)`, `0020…:226`, `0030…:314`).

---

## Integrações — a "camada única"

**O que estes módulos consomem hoje [código]:** essencialmente nada em runtime além da infraestrutura compartilhada (`useAuth` para `organization_id`/`user.id`, `storeSync`, `supabase`). Não há assinatura de `eventBus` nem publicação de eventos nos stores/componentes (grep sem resultados em `src/store/rede360Store.ts`, `operacaoCampoStore.ts` e nas duas features). Não há entradas destes módulos em `src/lib/realtime.ts` (nenhum canal `rede_*`/`operacao_campo_*`). O `masterActivityId` em `FieldCalendarActivity` e o `project_id` em `rede_ativos` são **pontos de junção previstos** com Planejamento Mestre e Projetos, mas [inferido] ainda não há código que os popule/consulte cruzando módulos.

**O que alimentam:** as tabelas participam da **matriz de aprovação e auditoria** compartilhada (RPCs `request_action`/soft-delete em `0034_sprint6_rpcs.sql`), portanto exclusões aparecem no fluxo de Aprovações/Auditoria do app. O `pullTable` filtra sempre por `organization_id` e `deleted_at IS NULL` (`storeSync.ts:363-367`), então os dados respeitam a mesma fronteira multi-tenant dos demais módulos.

**Camada única — estado atual [inferido]:** a arquitetura já está pronta para plugar (tabelas `rede_ativos.project_id`, `operacao_campo_activities` ligada a atividade mestre; fila de sync padronizada), mas a integração viva com eventBus/realtime e o roteamento ainda **não foram conectados**. São módulos "de vitrine técnica" prontos para ativação.

## Eficiência gerada

- **Operação e Campo:** elimina a planilha "Linha A / Linha B" de acompanhamento físico — o lançamento do realizado por célula recalcula PPC, Curva S e desvio em tempo real (recompute a cada `updateCalendarDay`, `operacaoCampoStore.ts:98`), com semáforo verde/vermelho por dia. [inferido] Ganho: o encarregado vê na hora se a frente está atrasada, sem consolidação manual semanal; o PPC (indicador Last Planner) sai automático em vez de ser tabulado à mão.
- **Rede 360:** consolida GIS + manutenção + outages + risco numa tela só (COP), com drill-down por ativo e geração automática de OS a partir de risco/inspeção vencida. [inferido] Ganho: menos troca de sistemas para o despachante, rastreabilidade ativo→OS→status, e priorização objetiva (ativos críticos viram OS num clique). Exportação CSV dá ponte para relatórios externos sem retrabalho.
- **Rastreabilidade/dado único:** ambos escrevem `payload jsonb` completo + colunas indexáveis por org, com soft-delete auditado por aprovação — o mesmo dado serve tela, auditoria e (futuramente) cruzamento com Planejamento/Projetos.

## Como sincroniza

**Local-first + fila de operações**, idêntico ao restante da plataforma:

- Estado em Zustand com `persist` em `localStorage` (`cdata-operacao-campo` e `cdata-rede-360`, registrados no `tenantCache.ts:29-30` para limpeza por tenant). Só um subconjunto é persistido (`partialize`): dados + `pendingSync` + `lastSyncedAt`.
- Cada mutação (`updateCalendarDay`, `addServiceOrder`, `updateServiceOrder`, `removeServiceOrder`, `updateAsset`) atualiza o estado **e** enfileira um `PendingOp` via `makeOp`, depois chama `flush()` (`operacaoCampoStore.ts:79-100`, `rede360Store.ts:141-181`).
- **`flush()`** (`…Store` + `storeSync.flushQueue`): se offline → status `offline` e mantém fila; sem `profile` → `unauth`; senão faz **upsert** por `id` (`onConflict:'id'`) nas tabelas, ou **`request_action` RPC** quando a op tem `approvalActionType` (`storeSync.ts:172-210`). Ops concluídas saem da fila; ops com erro incrementam `retries`.
- **Reprocesso automático ao voltar online:** listener `window 'online'` chama `flush()` (`operacaoCampoStore.ts:180-184`, `rede360Store.ts:269-272`).
- **`pull()`**: `pullTable` traz linhas da org (`eq organization_id`) com `deleted_at IS NULL`, remapeando `payload` de volta ao domínio; pula tabelas que ainda têm ops pendentes para não sobrescrever escrita local não confirmada (`operacaoCampoStore.ts:158-166`, `rede360Store.ts:235-246`).
- **RLS multi-tenant:** todas as tabelas têm `ENABLE`/`FORCE ROW LEVEL SECURITY`, SELECT/INSERT/UPDATE restritos à própria org (com checagem de papel no insert/update) e **DELETE bloqueado** (`USING (false)`) — exclusão só por soft-delete via RPC aprovada (`0020_grupo_operacional_rls.sql`, `0030_frotas_geo_rls.sql`).
- **Offline:** suportado por design (fila persistida + retry no online). **Realtime:** **não** — nenhum canal Supabase Realtime está registrado para `rede_*`/`operacao_campo_*`, então a propagação cross-usuário depende de `pull()` (não há push ao vivo hoje) [código].
- **Modo demo:** ambos carregam dados de mock quando não há dados e o modo demo está ligado (`isDemoModeEnabled`/`loadDemoData`), e `pullTable` retorna `null` em modo não-produção (`storeSync.ts:357`).
