# Predial (Manutenção · Ativos · CapEx · Rateio)

> **Rota(s):** `/app/predial` ([código] `src/App.tsx:126`) · redireciona legados `/app/equipamentos`, `/app/gestao-equipamentos` → `/app/predial?tab=equipamentos` (`src/App.tsx:127-128`) e `/app/manutencoes` → `/app/predial?tab=manutencoes` (`src/App.tsx:136`). A aba ativa é persistida na URL via `?tab=` (`src/features/predial/index.tsx:24-31`).
> **Store(s):** `manutencoesStore`, `gestaoEquipamentosStore`, `equipamentosStore`, `otimizacaoFrotaStore`, `rateioConsumoStore` (todos em `src/store/`).
> **Grupo na sidebar:** `PREDIAL` → item "Predial" ([código] `src/components/shared/Sidebar.tsx:63-66`, ícone `Building2`).

---

## O que é / problema que resolve

O **Predial** é um *container de abas* que reúne, sob uma única "torre de controle" de manutenção do edificado/frota, features que já existiam soltas na plataforma: Manutenções, Gestão de Equipamentos e a Manutenção Preditiva (health scores). O próprio código descreve a reorganização como "de apresentação — nenhum store/tabela é alterado" ([código] `src/features/predial/index.tsx:1-6`). Além disso, adiciona quatro painéis novos e específicos do módulo: **Visão Geral** (control tower), **CapEx/ROI** (substituir × reparar), **Workbench** (chamados similares + manuais) e **Rateio de Consumo** (água/energia → cobranças no Financeiro).

O problema que resolve é o de gestão de ativos físicos e sua manutenção sem depender de planilhas paralelas: cadastro de ativos com criticidade/QR, planos de manutenção preventiva, ordens de serviço (OS) com kanban/calendário, pontos de monitoramento (sensores/medidores), análise financeira de CapEx a partir do histórico real de OS, uma base de conhecimento (manuais + chamados similares por heurística, sem IA) e o rateio de faturas de utilidades entre unidades/obras que vira automaticamente títulos a receber no Financeiro.

Tudo é isolado por empresa (multi-tenant por `organization_id` via RLS) e, no caso de Manutenções, também filtrável pela obra ativa.

## Para quem (papéis / persona)

- **Gestor de facilities / manutenção predial**: cadastra ativos, planos e OS; acompanha o painel e o kanban.
- **Equipe de manutenção / técnicos**: executam OS, atualizam progresso, registram evidências, consultam manuais e chamados similares no Workbench.
- **Gestor de frota / equipamentos**: usa a aba Equipamentos & Chamados (mapa, alertas, utilização, custos) e a Saúde & Preditiva.
- **Planejamento / engenharia / gerência / diretoria / owner**: a criação/edição de Rateio de Consumo é gated por papel na RLS — `planejador`, `engenheiro`, `gerente`, `diretor`, `owner` ([schema] `supabase/migrations/20260724120000_rateio_consumo.sql:26-35`).
- **Controladoria / financeiro**: consome as cobranças geradas pelo Rateio.

## Funcionalidades detalhadas

O container renderiza 7 abas ([código] `src/features/predial/tabs.ts:4-12`), despachadas em `src/features/predial/index.tsx:37-43`:

### 1. Visão Geral (control tower) — `PredialVisaoGeralPanel`
Painel **somente leitura** que agrega os stores existentes sem alterá-los ([código] `src/features/predial/components/PredialVisaoGeralPanel.tsx:1-6`).
- **5 KPIs clicáveis** (cada um navega para a aba correspondente): OS abertas, OS vencidas, Custo manutenção (mês) com sparkline, Saúde crítica, Equip. em manutenção (`PredialVisaoGeralPanel.tsx:98-104`).
- **Cartão de valor (12 meses)**: Custo de manutenção, CapEx em análise ("ativos onde substituir compensa") e Economia estimada/ano ("trocando os ativos indicados") (`:106-117`).
- **Gráficos** (SVG próprios, sem lib — `src/features/predial/components/charts.tsx`): Donut "OS por status" e LineChart "Custo de manutenção mensal" (`:119-127`).
- **Listas**: "Ordens de serviço — próximas e atrasadas" (ordenadas por `dueDate`, 6 itens, `:89-92`,`:131-151`) e "Ativos com risco de saúde" (risk `critical`/`high`, `:153-170`).
- **Chips de ativos críticos** (`criticality === 'critica'`, `:173-184`).

### 2. Manutenções — `ManutencoesPage`
Feature completa (`src/features/manutencoes/index.tsx`) com 7 sub-abas ([código] `:52-60`): Painel, Ativos, Monitoramento, Tarefas Manutenções, Ordens de Serviço, Kanban, Calendário. Escopo por **obra ativa** (`activeObraId`): `null` = todas; legado sem obra só aparece em "Todas as obras" (`:762-768`). Cabeçalho com badge de tenant ("Tenant seguro" / "Trocando empresa"), botão Atualizar (pull) e "Nova OS" (`:880-892`). Busca textual + filtro de escopo (Todos / Corporativo-Geral / Com obra-projeto) + Limpar (`:915-929`).

- **Painel**: 9 StatCards (OSs em Processo/Verificação/Concluídas, Tarefas atrasadas, Ativos cadastrados, Sensores habilitados, Ativos parados, Paradas planejadas/não planejadas) + 2 Donuts (planejadas vs. não; % de cumprimento) + barras "OS por status" (`:937-970`).
- **Ativos** (CRUD): tabela Código/Ativo/Tipo/Escopo/Localização/Responsável/Criticidade + Novo/Editar/Excluir via `AssetModal` (`:973-1004`, modal `:319-381`). Campos: código, nome, tipo, status (`active/idle/maintenance/alert/offline`), criticidade, responsável, localização, QR, e escopo Projeto/Obra (`ScopeFields`, `:248-304`).
- **Monitoramento** (CRUD): pontos de sensor/medidor em dois modos (Lista / Avançado). Tabela larga com Localização, Descrição, Estado do dispositivo, Habilitado, Nº série, "É contador/acumulado", Unidade, Última data/leitura; no modo Avançado acrescenta Faixa (min/max), Ativo e Observações + 4 StatCards (`:1006-1092`). Modal em `:602-697`.
- **Tarefas Manutenções** (= planos, CRUD): cards com código, título, prioridade, frequência, próxima data, nº de ativos; botões **Gerar OS**, Editar, Excluir (`:1095-1123`). "Gerar OS" chama `generateWorkOrderFromPlan` (`store:633-652`). Modal `PlanModal` com checklist (uma linha por item), duração, ativos vinculados, "Plano ativo" (`:383-454`).
- **Ordens de Serviço** (CRUD): tabela OS ID/Status/Código/Ativos/Fora de serviço/Dependências/Tarefa/Vencimento (`:1126-1163`). Modal `OrderModal` (`:456-600`) com status, prioridade, severidade, planejada, progresso %, datas programada/vencimento, responsável/solicitante, custo previsto/real, checklist, evidências, campos **PMBOK** (Escopo/Riscos/Lições) e **Lean/LPS** (Restrição + checkbox "Sinalizar para Lean/LPS"), e "Plano de origem" que auto-preenche a OS (`applyPlan`, `:490-505`).
- **Kanban**: colunas por status (Pendente, Em processo, Em verificação, Concluída, Cancelada) com drag-and-drop (`@dnd-kit`); soltar em "concluída" seta progresso 100, em "pendente" 0 (`:845-851`,`:1165-1186`).
- **Calendário**: grade mensal com OS por `scheduledDate`/`dueDate` (`:858-871`,`:1188-1215`).

### 3. Equipamentos & Chamados — `GestaoEquipamentosPage`
Feature `src/features/gestao-equipamentos/index.tsx` com 6 sub-abas ([código] `GestaoHeader.tsx:9-16`): Equipamentos, Dashboard, Manutenções, Utilização, Custos, Frotas.
- **Equipamentos** = feature `equipamentos` (`src/features/equipamentos/index.tsx`): lista + mapa interativo (`EquipmentMap`) + barra de alertas (`AlertsPanel`) + diálogo de edição. Store `equipamentosStore` (perfil de equipamento com `lat/lng`, `status`, `alerts` no payload).
- **Dashboard** (`FleetDashboard`), **Manutenções** (`MaintenancePanel` — OS de equipamento com filtros scheduled/in_progress/completed/cancelled), **Utilização** (`UtilizacaoPanel` — "Taxa de Utilização da Frota (%) — Últimas 8 Semanas"), **Custos** (`CustosPanel` — distribuição de custo por tipo de equipamento, custo/hora, custo mensal, export CSV), **Frotas** (reusa `GestaoFrotasPanel` de mão-de-obra).

### 4. Saúde & Preditiva — `ManutencaoPreditivaPanel`
Importado de `otimizacao-frota` (`src/features/predial/index.tsx:40`). Health scores por equipamento com gauge SVG, faixa de falha prevista, fatores principais, ação recomendada, parada/custo estimados (`src/features/otimizacao-frota/components/ManutencaoPreditivaPanel.tsx`). Botões **Adicionar Equipamento** (form manual) e **Rodar Engine** (`runHealthEngine`). Alerta de fila crítica quando há risco `critical`/`high` (`:335-347`). Cards ordenados do menor score ao maior (`:307-309`).

### 5. CapEx / ROI — `CapexRoiPanel`
Análise **substituir × reparar** por ativo, derivada das OS reais ([código] `src/features/predial/components/CapexRoiPanel.tsx:1-8`). Lista lateral de ativos ordenada por custo de reparo 12m com badge Substituir/Reparar e mini-colunas Custo anual / CapEx prop. / ROI (`:62-91`). Detalhe do ativo: cards de Recomendação, faixa de recomendação textual, **metadados persistidos** editáveis (custo de reposição, modelo, nº de série — gravados no payload jsonb do ativo via `updateAsset`, sem migração, `:158-165`), gráfico de custo de reparo mensal (`MonthlyBars`) e **chamados similares** de outros ativos por heurística (`:176-201`).

### 6. Workbench — `PredialWorkbenchPanel`
Versão *code-only* (sem IA/LLM) de um "Maintenance Workbench" ([código] `src/features/predial/components/PredialWorkbenchPanel.tsx:1-7`):
- Lista de chamados (OS) com busca; alterna visão **Chamado** (descrição + passos de troubleshooting = checklist da OS) × **Detalhado** (todos os campos da OS + histórico de OS do mesmo ativo) (`:79-116`,`:147-187`).
- **Chamados similares** por Jaccard (`:38-42`).
- **Repositório de Manuais** anexados ao ativo, com **seções/notas navegáveis** e busca por palavra-chave em nome/tags/seções (`ManuaisSection`, `:189-278`). Manuais e seções persistem no payload jsonb do ativo via `updateAsset` (`:137`), sem migração.

### 7. Rateio de Consumo — `RateioConsumoPanel`
Kanban de 3 colunas: **Processando · Ação necessária (revisar) · Aprovado** ([código] `src/features/predial/components/RateioConsumoPanel.tsx:17-21`). Cada card mostra tipo (água/energia), descrição, período, nº de unidades, fatura total, aviso "rateio não fecha com a fatura" e badge de nº de cobranças no Financeiro (`:99-121`). Modal de criação/edição com tipo, período (yyyy-MM), fatura total, fornecedor, base do rateio, descrição e lista de unidades (nome + obra opcional + valor da base) (`:215-307`). Detalhe com tabela Unidade / base / % / Valor rateado, **reconciliação** vs a fatura e ações de fluxo (`:123-210`):
- Processando → "Enviar p/ revisão".
- Revisar → "Aprovar sem cobrança" ou **"Aprovar e gerar cobranças"** (só habilitado se o rateio fechar com a fatura).
- Aprovado → "Desfazer cobranças" (se houver) ou "Reabrir".
- Editar um rateio que já gerou cobranças primeiro **desfaz** as cobranças (evita cobranças órfãs/defasadas) (`:33-41`).

## Dados que gera

### Manutenções — `manutencoesStore` (queries diretas ao Supabase, colunas tipadas + `payload` jsonb)
Tabelas criadas em [schema] `supabase/migrations/20260520124500_manutencoes_core_tables.sql`:
- **`equipamentos`** (reaproveitada como registro de *ativos*): a migração adiciona colunas `construction_site_id`, `criticality` (check baixa/media/alta/critica), `responsible`, `location`, `qr_code` (`:49-63`). Mapeada por `asAsset` (`store:262-279`).
- **`maintenance_plans`** (`:65-87`): code, title, description, frequency (check unica…anual), priority, estimated_duration_minutes, checklist jsonb, next_due_date, last_generated_at, active, payload.
- **`maintenance_plan_assets`** (N:N plano↔ativo, `:89-101`) com índice único ativo `(organization_id, plan_id, asset_id) where deleted_at is null`.
- **`maintenance_work_orders`** (`:103-140`): status (check pendente/em_processo/em_verificacao/concluida/cancelada), priority, severity, planned, progress (check 0–100), scheduled_date, due_date, started_at, completed_at, assignee, requester, estimated/actual_duration_minutes, estimated/actual_cost numeric(12,2), checklist/evidence jsonb, **pmbok** jsonb, **lean_lps** jsonb, plan_id.
- **`maintenance_work_order_assets`** (N:N OS↔ativo, `:142-154`).
- **`maintenance_monitoring_points`** (`:156-180`): location_part, description, device_state, enabled, serial_number, is_counter, unit, last_reading_date, last_reading_value, min_value/max_value numeric(14,4), notes, asset_id.
- Metadados de CapEx/Workbench (`replacementCostBRL`, `modelo`, `serial`, `manuais[]` com `secoes[]`) **não têm coluna** — vivem no `payload` jsonb do ativo ([código] `src/store/manutencoesStore.ts:40-45`).

### Equipamentos / frota
- **`equipamentos`** e **`equipamentos_manutencoes`** definidas em [schema] `supabase/migrations/0029_frotas_geo.sql:17-66` (padrão payload jsonb + soft-delete). `equipamentosStore` → `equipamentos`; `gestaoEquipamentosStore` → `equipamentos_manutencoes`.
- **`otimizacao_routing_recommendations`**, **`otimizacao_health_scores`**, **`otimizacao_buy_lease_analyses`** (série 0029/0030/0031) para `otimizacaoFrotaStore`.

### Rateio de Consumo — `rateioConsumoStore` → tabela **`rateio_consumo`**
[schema] `supabase/migrations/20260724120000_rateio_consumo.sql`: `id`, `organization_id`, `payload` jsonb, `created_by`, timestamps, `deleted_at`. Payload = entidade `RateioConsumo` ([schema] `src/types/index.ts:2762-2774`): periodo (yyyy-MM), tipo (`agua`/`energia`), descricao?, fornecedor?, valorTotalFatura, base (`leitura`/`area`/`proporcao`), itens[] (`RateioItem`: unidade, obraId?, base), status, `cobrancaTituloIds[]` (títulos gerados no Financeiro para idempotência/undo), createdAt.

## Cálculos, KPIs e regras de negócio

- **CapEx — substituir × reparar** ([código] `CapexRoiPanel.tsx:15-56`, `VIDA_UTIL_ANOS = 5`):
  - `repair12m` = soma do custo das OS do ativo nos últimos 12 meses (custo = `actualCost || estimatedCost`).
  - `replacement` = `asset.replacementCostBRL` OU padrão `defaultReplacement = round(repair12m × 3 / 100) × 100` (≈ 3× o reparo anual, arredondado à centena, `:20`).
  - `ROI` (economia Ano 1) = `repair12m − replacement / 5`.
  - `substituir = ROI > 0`. Recomenda substituir quando o reparo anual supera a reposição amortizada em 5 anos (`:150-153`).
- **Visão Geral — cartão de valor 12m** (`PredialVisaoGeralPanel.tsx:75-87`): por ativo, `econ = repair12m − replacement/5`; se `econ > 0` soma `replacement` a "CapEx em análise" e `econ` a "Economia estimada/ano". `custoAno` = OS de manutenção + OS de equipamento nos últimos 12 meses.
- **Rateio — alocação de maior resto** ([código] `rateioConsumoStore.ts:33-46`): `valorRateado_i = fatura × base_i / Σ base`; converte para centavos, dá o piso a cada item e distribui os centavos restantes aos maiores fracionários → **Σ dos valores == valorTotalFatura exatamente** (sem residual de arredondamento). A fórmula é a mesma para as três bases (leitura/área/proporção). Reconciliação `reconc` marca "fecha" quando `totalBase > 0 && fatura > 0` (`RateioConsumoPanel.tsx:91-97`).
- **Rateio — geração de cobranças** (`rateioConsumoStore.ts:129-157`): um título `receber` por unidade com valor > 0; vencimento = **dia 10 do mês seguinte** ao período; categoria `outro`, referência `Rateio <id[0:8]>`. Idempotente por dispositivo (guard em `cobrancaTituloIds`); ids **aleatórios** (títulos usam soft-delete, então re-gerar após desfazer cria ids novos).
- **Health score** ([código] `otimizacaoFrotaStore.ts:71-110`): começa em 100 e subtrai — dias desde última manutenção /3 (máx 30); atraso da próxima manutenção ×2 (máx 25); alertas críticos ×20; alertas de aviso ×10; idade ×1.6 (máx 16). Faixas de risco: `<30 critical`, `<50 high`, `<70 medium`, senão `low` (`:98-103`). Janela de falha derivada do score (`:105-110`).
- **Buy vs Lease** (`otimizacaoFrotaStore.ts:114-122`): `breakEvenMonths = purchasePrice / ((annualRental − annualMaintenance)/12)`; recomendação por dias projetados (`≥180 buy`, `≤60 lease`, senão neutral). (Motor vive na feature `otimizacao-frota`, não é renderizado dentro do Predial.)
- **Roteamento de frota** (`otimizacaoFrotaStore.ts:174-256`): casa equipamento ocioso ao canteiro ativo mais próximo por **Haversine** (`:58-67`), descarta > 100 km, estima ganho de utilização e prioridade.
- **Similaridade de chamados — Jaccard** ([código] `src/features/predial/lib/similarity.ts`): tokeniza sem acentos/stopwords (tokens ≥3 chars), `jaccard = |A∩B| / |A∪B|`, filtra score > 0.05 e ordena topN. Usada no Workbench (topN 6) e no CapEx (topN 5). **Sem IA.**
- **Painel de Manutenções** (`manutencoes/index.tsx:821-839`): `compliance = concluídas/total × 100`; `plannedPercent = planejadas/total × 100`; contagem de atrasadas (`status ≠ concluída && dueDate < hoje`), ativos parados (`offline`/`maintenance`), etc.
- **Regra de status de OS** (`store:733-734`): ao marcar `concluida` seta `completedAt`; ao marcar `em_processo` seta `startedAt` (se ainda vazios).

## Integrações — a "camada única"

- **Registro de ativos compartilhado**: `manutencoesStore` (ativos de manutenção) e `equipamentosStore` (frota) leem/gravam a **mesma tabela física `equipamentos`**, mapeando-a de formas diferentes ([código] `manutencoesStore.ts:437,509` vs `equipamentosStore.ts:170`). Um ativo cadastrado na aba Manutenções e um equipamento da aba Equipamentos vivem no mesmo dado-fonte.
- **Visão Geral consome (só leitura)** três stores: `manutencoesStore` (workOrders, assets), `gestaoEquipamentosStore` (orders) e `otimizacaoFrotaStore` (healthScores) — sem mutação (`PredialVisaoGeralPanel.tsx:39-42`).
- **CapEx e Workbench alimentam o ativo**: gravam `replacementCostBRL`/`modelo`/`serial`/`manuais` no payload do ativo via `updateAsset`, tornando esses dados disponíveis a qualquer aba que leia o ativo.
- **Rateio → Financeiro (cross-store direto)**: `gerarCobrancas` chama `useFinanceiroTitulosStore.getState().upsertTitulos(...)` e `desfazerCobrancas`/`removeRateio` chamam `removeTitulos(...)` ([código] `rateioConsumoStore.ts:155,162,118`). É a integração de negócio mais forte do módulo — o rateio aprovado vira títulos a receber no módulo Financeiro. Usa `useTorreStore.sites` para vincular unidades a obras (`RateioConsumoPanel.tsx:217,285`).
- **Manutenções → Torre/Projetos**: `ManutencoesPage` puxa `projetosStore` e `torreDeControleStore` para popular os selects de escopo Projeto/Obra e filtra pela **obra ativa** (`activeObraStore`) (`manutencoes/index.tsx:752-795`).
- **Saúde/Preditiva ← Equipamentos + OS**: `runHealthEngine` lê `equipamentosStore.equipamentos` e `gestaoEquipamentosStore.orders` (OS concluídas) para calcular os scores (`otimizacaoFrotaStore.ts:284-346`).
- **eventBus / realtime**: uma busca nos stores e features do módulo **não encontrou** uso de `eventBus` nem de `realtime.ts`/canais Supabase ([inferido] a partir de grep). A propagação entre módulos é feita por *cross-store calls* diretos (Rateio→Financeiro) e por leitura compartilhada de stores/tabelas, não por eventos.
- **Triggers de servidor**: gatilhos `set_maintenance_updated_at` (updated_at) e vários `enforce_same_organization_fk` que impedem vincular FK de outra organização (projeto/obra/plano/ativo) — [schema] `20260520124500_manutencoes_core_tables.sql:194-377`.

## Eficiência gerada

- **Menos planilha**: cadastro de ativos, planos, OS, sensores, manuais e rateios em um só lugar, tenant-isolado, substitui controles em Excel [inferido].
- **CapEx orientado por dado real**: a decisão substituir × reparar sai do histórico de OS do próprio ativo, não de estimativa manual (`CapexRoiPanel.tsx:42-56`) [código] — reduz o retrabalho de compilar custos por equipamento [inferido].
- **Rateio automatizado e auditável**: o algoritmo de maior resto garante que a soma bata **exatamente** com a fatura (`rateioConsumoStore.ts:33-46`), e a aprovação gera cobranças no Financeiro de forma idempotente e reversível — elimina o rateio manual de faturas de água/energia e o risco de cobrança órfã [inferido].
- **Base de conhecimento sem IA**: chamados similares por Jaccard e manuais com seções buscáveis aceleram o diagnóstico reaproveitando OS passadas, com custo computacional trivial e sem dependência de LLM ([código] `similarity.ts`, `PredialWorkbenchPanel.tsx`).
- **Dado único / rastreabilidade**: ativos de manutenção e equipamentos de frota compartilham a tabela `equipamentos`; a Visão Geral consolida OS, custo, saúde e CapEx de três stores em uma tela, com KPIs que fazem *drill-down* para a aba de origem [código/inferido].
- **Preditiva proativa**: health scores priorizam intervenção antes da falha (fila crítica), reduzindo paradas não planejadas [inferido].

## Como sincroniza

- **Local-first (Zustand `persist`)** em todos os stores: `cdata-manutencoes`, `cdata-equipamentos`, `cdata-gestao-equipamentos`, `cdata-otimizacao-frota`, `cdata-rateio-consumo`. A UI lê do estado local; a sincronização acontece em background.
- **Dois padrões de sync**:
  - `manutencoesStore` usa **queries diretas ao Supabase** com CRUD otimista (upsert/update por `id` + `organization_id`) e `pull()` que busca as 6 tabelas em paralelo; em falha, **não zera o estado local** para não perder dados ([código] `manutencoesStore.ts:427-470`).
  - `equipamentosStore`, `gestaoEquipamentosStore`, `otimizacaoFrotaStore` e `rateioConsumoStore` usam a fila **`storeSync`** (`pendingSync` → `flushQueue`/`pullTable`), com estados `idle/syncing/offline/unauth/error`.
- **Offline**: se `navigator.onLine` é falso, `pull` marca `offline` e `flush` adia o envio; ao voltar online, um listener `window 'online'` dispara `pull()` (Manutenções, `:886-890`) ou `flush()` (demais stores). As operações ficam enfileiradas em `pendingSync` (persistido) até sincronizar.
- **Multi-tenant / RLS**: todas as tabelas são `organization_id = public.user_org()` com `FORCE ROW LEVEL SECURITY`; DELETE é **bloqueado** (`using (false)`) — exclusão é sempre **soft-delete** via `UPDATE deleted_at` ([schema] `20260520124500_...:232-306`, `20260724120000_...:19-38`). `rateio_consumo` ainda exige papel na escrita (`has_role([...])`). Ao trocar de empresa, `ensureTenantScope(organizationId)` limpa os arrays locais para não vazar dados entre tenants ([código] `manutencoesStore.ts:399-412`, `rateioConsumoStore.ts:170-174`).
- **Realtime**: **não há** assinatura realtime para as tabelas deste módulo ([inferido] por ausência de referências em `src/lib/realtime.ts`); a atualização cross-usuário depende de `pull` (botão Atualizar / mount / reconexão).
