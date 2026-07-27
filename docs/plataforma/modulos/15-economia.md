# Economia (ROI / Prova de Valor)

> **Rota(s):** `/app/economia` (lazy `EconomiaPage`) — `src/App.tsx:133` · registro em `src/features/minha-rotina/moduleRegistry.ts:108-112` · **Store(s):** `useEconomiaStore` (`src/store/economiaStore.ts`) · consome read-only de `suprimentosStore`, `lpsStore`, `rdoStore`, `gestaoEquipamentosStore`, `evmStore`, `medicaoUnificadaStore`, `contractorStore` · **Grupo na sidebar:** `PROJETOS` — `src/components/shared/Sidebar.tsx:68-73`

## O que é / problema que resolve

O módulo Economia é a **camada de prova de valor** da ConstruData: ele não coleta dados operacionais novos — ele **agrega sinais que já existem** nos outros módulos (Suprimentos, LPS, RDO, Equipamentos, EVM, Medição) e os transforma em uma narrativa financeira única — quanto de perda foi evitado, qual o ROI sobre a mensalidade da plataforma, e qual o retorno por real investido. É explicitamente descrito no código como consumidor: `scanEvents` lê o `getState()` de sete stores e nunca escreve neles (`src/store/economiaStore.ts:203-256`).

O problema que resolve é o clássico "por que continuar pagando a plataforma?". Em vez de deixar o ganho implícito, o módulo materializa cada economia como um `EconomyEvent` auditável — com fórmula, premissas e link de volta para a evidência no módulo de origem (`ECONOMY_SOURCE_ROUTE`, `src/features/economia/utils/economiaEngine.ts:80-90`) — e consolida tudo num **dossiê PDF** para cliente/diretoria/comercial e num relatório mensal de ROI.

A filosofia declarada é o **conservadorismo**: só entra no ROI o que foi validado por um humano, indicadores sem R$ direto (ex.: alerta de PPC baixo) ficam com `impactBRL = 0` para evitar dupla contagem, e eventos oriundos de RDO (paralisação) nascem zerados até validação manual (`methodologyFor`, `economiaEngine.ts:93-114`; `collectRdoEvents`, `economiaEngine.ts:446`).

## Para quem (papéis / persona)

- **Diretoria / Owner** — enxerga o ROI consolidado da carteira e usa o dossiê como justificativa de renovação. [inferido]
- **Gerente de contrato / CSM interno** — monta a base de renovação e upsell na aba QBR (o painel se autodescreve como "Base para renovação e upsell", `src/features/economia/index.tsx:670`). [inferido]
- **Comercial** — exporta o "Documento de comprovação de economia e eficiência" para cliente (`printEconomyDossier`, `economiaReportExport.ts:32-37`). [inferido]
- **Engenheiro / planejador / comprador** — validam ou descartam os eventos detectados; a RLS de INSERT exige um desses papéis (`0054_economia_roi.sql:166` — `has_role(['engenheiro','planejador','comprador','gerente','diretor','owner'])`).

## Funcionalidades detalhadas

O cabeçalho fixo (`EconomiaPage`, `index.tsx:162-232`) oferece controles globais que atravessam todas as abas:
- **Seletor de obra/carteira** (`index.tsx:174-184`) — filtra por `event.projectName` exato (sem heurística); `"all"` = carteira inteira. As opções são derivadas dos nomes de obra presentes nos eventos (`obraOptions`, `index.tsx:69-72`).
- **Seletor de período** (`<input type="month">`, `index.tsx:185-190`) — grava `selectedPeriod` no store.
- **Badge de frescor** (`FreshnessBadge`, `index.tsx:463-470`) — mostra a data do último scan.
- **"Atualizar eventos"** (`index.tsx:192-199`) — dispara `store.scanEvents()`.
- **"Dossiê PDF"** (`index.tsx:200-207`) — chama `exportDossier`, que monta um `EconomyReport` "ao vivo" (`id: 'live'`) com exatamente o que está na tela (obra + período) sem precisar persistir um relatório antes (`index.tsx:102-124`).

Ao abrir o módulo, um `useEffect` roda uma vez: cria um baseline default se não houver nenhum, e roda `scanEvents()` se houver baseline mas nenhum evento (`index.tsx:60-65`).

Cinco abas (`TABS`, `index.tsx:37-43`):

### 1. Prova de valor (`overview`) — `ProvaDeValorPanel`, `index.tsx:241-319`
Aba padrão. Se não há eventos no período, mostra empty-state instruindo a alimentar RDO/Suprimentos/LPS/Medição/EVM (`ProofEmptyState`, `index.tsx:451-461`). Caso contrário, exibe:
- **HeroProof** (`index.tsx:325-347`) — número gigante da economia comprovada (`brl(avoidedLossBRL)`), ROI do mês, "Retorno por R$ investido" (`paybackRatio`, com `x`), e a linha "N de M eventos validados · investimento na plataforma R$X/mês", mais o pipeline potencial ainda em análise (não somado).
- **"De onde vem a economia (por módulo)"** e **"Por tipo de ganho"** — barras horizontais somando `impactBRL` por `sourceModule` e por `category` (`groupValue`, `index.tsx:756-762`), apenas dos eventos com `impactBRL > 0`.
- **"Antes e depois (baseline → atual)"** (`index.tsx:282-303`) — três linhas: PPC (`baseline.ppcPercent` → PPC atual vindo do LPS via `latestPpc`), desvio de material (atual → meta), horas em relatório manual (baseline → "automatizado").
- **"Economia validada por mês"** (`TrendBars`, `index.tsx:373-391`) — série dos últimos 6 meses (`monthlySeries`, `economiaEngine.ts:117-132`).
- **"Evidências de maior impacto"** (`EvidenceCard`, `index.tsx:393-429`) — top 6 eventos ranqueados por status validado/reportado e depois por valor; cada card traz pill de confiança, a metodologia da categoria, link "Ver evidência" para o módulo de origem, e um `<details>` "Como calculamos" que expõe `event.formula` e `event.assumptions`.
- **DisclosureNote** (`index.tsx:441-449`) — nota de rodapé reforçando que o ROI só conta eventos validados.

### 2. Eventos (`events`) — `EventsPanel` / `EventEditor`, `index.tsx:484-580`
Lista CRUD dos eventos. Filtros por **módulo** e por **status** (`sourceFilter`, `statusFilter`). Cada `EventEditor` mostra badge de origem + categoria + status, título/descrição, obra, fórmula e confiança, e permite:
- **Editar `impactBRL`** inline via input numérico → `store.updateEvent(id, { impactBRL })` (`index.tsx:559-564`).
- **Validar** → `store.validateEvent(id)` (seta `status: 'validated'` + `validatedAt`).
- **Descartar** → `store.dismissEvent(id)` (seta `status: 'dismissed'`).

### 3. Baseline (`baseline`) — `BaselinePanel`, `index.tsx:582-618`
Edita a "Baseline semana 0" (`baselines[0]`). Se não existir, botão "Criar baseline" chama `addBaseline()`. Doze campos editáveis, cada um persiste via `updateBaseline` (`index.tsx:603-614`): obra/carteira, PPC atual %, desvio material %, horas relatórios/sem, paralisações no trimestre, nº de trabalhadores, custo/dia por pessoa, orçamento material/mês, meta de desvio material %, mensalidade da plataforma, custo-hora do gestor, custo diário de equipamento. Esses valores são as **premissas de monetização** usadas pelos coletores.

### 4. Relatório mensal (`report`) — `ReportPanel`, `index.tsx:620-657`
- **"Gerar relatório do mês"** → `store.generateMonthlyReport()` cria um `EconomyReport` persistido para o período/projeto selecionados.
- Com relatório ativo: **"Imprimir PDF"** (`printEconomyReport`), **"Marcar enviado"** (`markReportSent`).
- KPIs: Eventos, Valor evitado, ROI, Status. O relatório mostrado é buscado por `period` + `projectId` (`currentReport`, `index.tsx:95-98`).

### 5. QBR (`qbr`) — `QbrPanel`, `index.tsx:659-679`
Quarterly Business Review. Pega até 30 eventos não descartados, soma `impactBRL` (valor no trimestre), calcula custo trimestral (`platformMonthlyFeeBRL × 3`) e **ROI trimestral** `((total − fee) / fee) × 100`. Painel "Base para renovação e upsell" compara baseline PPC, desvio de material (atual → meta) e nº de eventos validados/reportados.

## Dados que gera

Quatro entidades, definidas em `src/types/index.ts:2778-2889` e persistidas nas tabelas da **migração `0054_economia_roi.sql`**:

- **`EconomyBaseline`** → `economy_baselines` (`0054:4-19`). Colunas de topo indexadas: `project_id`, `project_name`, `period`, `captured_at`, `ppc_percent`, `material_deviation_percent`, `platform_monthly_fee_brl`; o objeto completo vai no `payload jsonb` (`baselineToRow`, `economiaStore.ts:66-80`). Campos-chave: `workersCount`, `costPerPersonDayBRL`, `materialMonthlyBudgetBRL`, `targetMaterialDeviationPercent`, `managerHourlyCostBRL`, `equipmentDailyCostBRL`, `manualReportHoursPerWeek`, `manualMeasurementHoursPerSub`, `automatedMeasurementHoursPerSub`, `baselineMeasurementErrorRatePercent`.
- **`EconomyEvent`** → `economy_events` (`0054:21-62`). Campos-chave: `sourceModule`, `sourceId`, `category`, `status`, `impactBRL`, `stableKey`, `period`, `date`, `confidence`, `formula`, `assumptions`, `evidence[]`, `validatedAt`, `reportedAt`. **CHECK constraints** restringem `status` a `detected/validated/dismissed/reported`, `category` às 8 categorias e `source_module` aos 9 módulos (`0054:39-60`). **UNIQUE `(organization_id, stable_key)`** (`0054:61`) — chave de idempotência que impede duplicar o mesmo sinal.
- **`EconomyReport`** → `economy_reports` (`0054:64-80`). Campos: `baselineId`, `eventIds[]`, `detectedEvents`, `avoidedLossBRL`, `platformFeeBRL`, `roiPercent`, `ppcBefore/After`, `materialDeviationBefore/After`, `materialSavingsBRL`, `status` (`draft/sent/archived`), `generatedAt`, `sentAt`.
- **`EconomyValuationRule`** → `economy_valuation_rules` (`0054:82-95`). Fórmulas e premissas editáveis por categoria; UNIQUE `(organization_id, category, label)`. Regras default em `defaultEconomyRules` (`economiaEngine.ts:163-221`).

Todas as tabelas têm `organization_id`, `created_by`, `created_at/updated_at` (com trigger `set_updated_at`, `0054:117-135`) e `deleted_at` para soft-delete.

## Cálculos, KPIs e regras de negócio

**Consolidação — `summarizeEconomy`** (`economiaEngine.ts:223-249`), sobre eventos do período, não descartados:
- `avoidedLossBRL` = Σ `max(0, impactBRL)` dos eventos **validados ou reportados** (só o que passou por humano).
- `estimatedPipelineBRL` = Σ dos eventos ainda em `detected` (mostrado à parte, **não somado** ao ROI).
- `platformFeeBRL` = `baseline.platformMonthlyFeeBRL` (default 5000).
- **`roiPercent` = `(avoidedLossBRL − platformFeeBRL) / platformFeeBRL × 100`** (`economiaEngine.ts:236`).
- **`paybackRatio` = `avoidedLossBRL / platformFeeBRL`** (retorno por R$ investido, exibido como `Nx`).

**Fórmulas por coletor** (`generateEconomyEvents` → `collect*`, `economiaEngine.ts:274-659`):
- **Suprimentos — three-way match** (`collectSupplyEvents`, `285`): para `match.status` `discrepancy`/`partial`, `impact = |delta| × quantity` (divergência de preço) ou `|delta| × unitPrice` (divergência de quantidade). Confiança `high` se `|deltaPercent| ≥ 5%`.
- **Suprimentos — ruptura de estoque** (`323`): `deficit × custoUnitário × 0.12` (prêmio de compra emergencial evitado), onde `deficit = estoqueMínimo − (disponível + trânsito − reservado)`.
- **Suprimentos — previsão de demanda** (`351`): forecast `ordered` → `estimatedValue × 0.08`.
- **LPS — restrição resolvida** (`collectLpsEvents`, `378`): `impact = probabilidade(0.35) × custoDiaParada × diasEvitados`, com `custoDiaParada = workersCount × costPerPersonDayBRL` e `diasEvitados` limitado a 1–5.
- **LPS — PPC baixo** (`410`): semanas com PPC < 60% viram `schedule_alert` com **`impactBRL = 0`** (indicador, sem R$, para não dobrar contagem).
- **RDO — paralisação** (`collectRdoEvents`, `432`): `impactBRL = 0` até validação humana (nasce só como evidência de causa raiz).
- **RDO — equipamento ocioso** (`458`): equipamento com `hours ≤ 1` → `equipmentDailyCostBRL × quantity`.
- **Equipamentos — manutenção vencida** (`collectEquipmentEvents`, `481`): OS não concluída/cancelada com `scheduledDate < hoje` → `max(equipmentDailyCostBRL, estimatedCost × 0.25)`.
- **EVM — desvio de custo** (`collectEvmEvents`, `510`): dispara se `CPI < 0.9` **ou** `SPI < 0.9`; `impact = |CV ou VAC| × 0.1` (fator conservador de 10%).
- **Medição — divergência** (`collectMeasurementEvents`, `540`): soma exceções críticas (`missing_n_preco`, `missing_unit_price`, `blocked_quality`, `closing_divergence`), usando `valueBRL` da exceção ou `netPreviewBRL × 0.02` como fallback.
- **Medição — cobertura de evidência** (`582`): ≥80% de linhas com evidência vira indicador de auditoria com `impactBRL = 0`.
- **Medição — horas recuperadas** (`603`): `(manualMeasurementHoursPerSub − automatedMeasurementHoursPerSub) × nº de subs × managerHourlyCostBRL`.
- **Horas de gestão** (`collectManagementHoursEvent`, `636`): `(manualReportHoursPerWeek − horasAtuais) × managerHourlyCostBRL × 4.33` (semanas/mês).

**PPC "antes/depois"**: `latestPpc` (`economiaEngine.ts:679-683`) pega o PPC da semana mais recente com plano a partir de `lpsStore.activities`; `computeWeeklyPpc` = `completed/planned` por semana (`685-700`).

**Idempotência**: cada evento tem `stableKey = source:sourceId:category:period` (`makeStableKey`, `663-665`). No re-scan, se já existe um evento validado com essa chave, o `impactBRL`, `assumptions`, `evidence` e `status` **editados manualmente são preservados** — o rescan só sobrescreve enquanto o evento estiver `detected` (`push`, `economiaEngine.ts:256-272`).

## Integrações — a "camada única"

**Consome (read-only) de 7 stores** no `scanEvents` (`economiaStore.ts:203-241`): `useSuprimentosStore` (POs, matches, forecasts, estoque), `useLpsStore` (activities, restrictions), `useRdoStore` (rdos), `useGestaoEquipamentosStore` (orders), `useEvmStore` (evmMetrics CPI/SPI/CV/VAC), `useMedicaoUnificadaStore` (periods/sources/memoryLines/contractItems/financialEntries, filtrados pelo período ativo) e `useContractorStore`. As medições de subempreiteiro são recalculadas via `generateAllSubempreiteiroMeasurements` (`economiaStore.ts:219-226`) antes de virar eventos. O PPC "depois" também vem do `lpsStore` na hora de gerar o relatório (`economiaStore.ts:292`).

**Alimenta**: o próprio módulo é **terminal** — não escreve em outros stores. Sua saída externa é (1) o badge de alerta na sidebar (`useAlertCounts.ts:56-58, 85` — conta eventos `detected` com `impactBRL > 0`) e (2) os PDFs (dossiê / relatório). Não emite eventos no `eventBus` (nenhuma referência a economia em `src/lib/eventBus.ts`).

**Realtime**: as 4 tabelas estão em `WATCHED_TABLES` (`src/lib/realtime.ts:55-58`). O store assina `realtime.row_changed` via `eventBus` e, quando qualquer uma das tabelas muda, chama `pull()` (`economiaStore.ts:416-427`) — sincronizando o painel entre usuários da mesma org.

**Triggers de servidor**: `set_updated_at` em todas as tabelas (`0054:117-135`); DELETE bloqueado por policy (`0054:176-180`, `USING (false)`), forçando soft-delete via `deleted_at`.

## Eficiência gerada

- **Fim da planilha de ROI** [inferido]: o valor entregue é calculado automaticamente a partir de dados reais dos módulos, não montado à mão em Excel para reuniões de renovação.
- **Rastreabilidade total**: cada real declarado tem fórmula (`event.formula`), premissas (`event.assumptions`) e link direto para a evidência no módulo de origem (`ECONOMY_SOURCE_ROUTE`), o que sustenta o número numa auditoria de cliente.
- **Dado único / sem dupla contagem**: `stableKey` UNIQUE impede contar o mesmo sinal duas vezes, e indicadores sem R$ (PPC, cobertura) ficam zerados de propósito — o número é conservador por construção (`methodologyFor`, `economiaEngine.ts:93-114`).
- **Dossiê em 1 clique**: o "Dossiê PDF" gera um documento branded (capa, hero de ROI, breakdown por módulo, antes/depois, evidências, tendência 6 meses e metodologia) com `report='live'`, sem precisar salvar nada antes (`printEconomyDossier`, `economiaReportExport.ts`; `exportDossier`, `index.tsx:102-124`). [inferido] Economiza horas de montagem manual de apresentação comercial.
- **Governança do número**: como só o que é validado por humano entra no ROI, o valor apresentado ao cliente é defensável — reduz risco de superestimar e perder credibilidade. [inferido]

## Como sincroniza

**Local-first**. O store usa `persist` do Zustand com a chave `cdata-economia` (`economiaStore.ts:394-407`) — baselines, events, reports, rules, período/projeto selecionados, `lastScanAt` e a fila `pendingSync` ficam no `localStorage`. Toda mutação (add/update de baseline, scan de eventos, validar/descartar, gerar/marcar relatório) atualiza o estado local **imediatamente** e enfileira uma `PendingOp` (`makeOp` / `enqueueUpdate`, `economiaStore.ts:130-138`), disparando `flush()` em seguida.

**`flush()`** (`economiaStore.ts:359-375`) drena a fila via `flushQueue` do `storeSync`, tratando `offline`/`unauth`/`error` e incrementando `retries` nas ops que falham. Há listener de `window 'online'` para reprocessar a fila ao reconectar (`economiaStore.ts:411-414`) — portanto **funciona offline** e reconcilia depois.

**`pull()`** (`economiaStore.ts:377-391`) recarrega as tabelas do Supabase, mas **não sobrescreve** uma tabela que tenha op pendente na fila (`pendingTables`), evitando "sumiço" de dado local não sincronizado.

**Multi-tenant / RLS**: a migração `0054` habilita `ROW LEVEL SECURITY` + `FORCE RLS` nas 4 tabelas (`0054:137-145`) com policies geradas em loop (`0054:147-182`): SELECT/UPDATE exigem `organization_id = user_org()`; INSERT exige também `created_by = auth.uid()` e um dos papéis `engenheiro/planejador/comprador/gerente/diretor/owner`; DELETE é bloqueado (`USING (false)`). O isolamento por obra na UI é apenas um filtro por `projectName`; o isolamento por cliente/organização é garantido pela RLS no servidor (comentário em `index.tsx:67-68`).
