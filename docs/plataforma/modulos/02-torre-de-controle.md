# Torre de Controle (Obras)

> **Rota(s):** `/app/torre-de-controle` (abas via query param `?aba=`) · redirecionamentos legados `/app/projetos`, `/app/pre-construcao` → `?aba=projetos`; `/app/mapa-interativo` → `?aba=mapa-interativo`; `/app/bim` → `?aba=bim` (`src/App.tsx:129-149`)
> **Store(s):** `torreDeControleStore` (`useTorreStore`), `activeObraStore` (`useActiveObraStore`); consome também `projetosStore` (`src/features/torre-de-controle/index.tsx:9-11`)
> **Grupo na sidebar:** `GESTÃO` — item "Torre de Controle", ícone `Radio` (`src/components/shared/Sidebar.tsx:36-42`)

---

## O que é / problema que resolve

A Torre de Controle é o **cadastro-mestre das obras (canteiros)** da organização e a "war room" de visão de portfólio. Toda obra vira um registro `construction_site` que agrega localização geográfica, responsáveis, dados de edificação/escopo, cronograma macro (datas + marcos), orçamento de contrato (BAC), e a lista de riscos. `[código]` A descrição do módulo no tutorial resume: "War room digital: drill-down do portfólio à atividade. Alertas críticos em tempo real." (`src/components/shared/TutorialModal.tsx:16`).

O papel estrutural desse módulo é ser a **fonte da "obra ativa"**: o cadastro de obras aqui alimenta o seletor global `ObraSwitcher` (barra lateral), que grava `activeObraId` no `activeObraStore`. Esse id é lido por praticamente todos os outros módulos (RDO, Suprimentos, Qualidade, Planejamento, Financeiro, Mão de Obra…) para filtrar seus dados por obra — via `site_id`/`obra_id` nas tabelas e o helper `byActiveObra` (`src/hooks/useActiveObra.ts:13-19`). Sem obra cadastrada aqui, o restante da plataforma não tem por onde segmentar.

Além do cadastro, a página reúne em abas outras visões espaciais/estruturais do empreendimento: o **Mapa Geral** (obras + projetos georreferenciados), a aba **Projetos** (a `ProjetosPage`, com EVM/aditivos por projeto), o **BIM 3D/4D/5D** e o **Mapa Interativo** — de modo que a Torre funciona como hub de entrada de "onde estão minhas obras e como elas estão".

## Para quem (papéis / persona)

- **Diretoria / Gerência de contrato:** visão de portfólio (quantos canteiros, status, riscos críticos) e drill-down por obra.
- **Engenheiro / Planejador:** cadastra e mantém a obra, define orçamento de contrato (BAC) que o Planejamento consome, registra riscos.
- **Papéis com permissão de escrita** no banco: as políticas RLS de `construction_sites` só permitem INSERT/UPDATE para os papéis `engenheiro`, `planejador`, `gerente`, `diretor`, `owner` (`supabase/migrations/0033_sprint6_rls.sql:69-77`). A exclusão exige aprovação (aprovador padrão: `diretor` — ver KPIs/regras).
- **Todos os usuários da empresa:** consomem a obra ativa via `ObraSwitcher` para filtrar os demais módulos.

## Funcionalidades detalhadas

A página tem 5 abas, controladas pelo query param `aba` (`src/features/torre-de-controle/index.tsx:24-36,62,84-86`). "Mapa Geral" é o default (sem param). BIM e Mapa Interativo são carregados sob demanda (`lazy` + `Suspense`) para não baixar Three.js/Forge e Leaflet antes da aba abrir (`index.tsx:17-20,149-163`).

### Aba "Mapa Geral" (`mapa`)
- **Faixa horizontal de obras** no topo (`ObrasListPanel orientation="horizontal"`, `index.tsx:122-124`): cards roláveis com status, código, cidade/UF, gerente e badge de risco.
- **Mapa** abaixo (`ControlMap`, `index.tsx:126-132`): plota obras (`sites`) e projetos (`projects`) georreferenciados; clicar num marcador seleciona a obra (`onSiteSelect → selectSite`), e há atalho de edição (`onEditSite → setEditing`). `[código]` O `ControlMap` é o componente compartilhado (`src/components/shared/ControlMap.tsx:395-407`) que recebe `projects`, `sites`, `selectedSiteId`, `onSiteSelect`, `onEditSite`.

### `ObrasListPanel` (painel de lista de obras) — `src/features/torre-de-controle/components/ObrasListPanel.tsx`
Existe em dois formatos (`orientation`): `horizontal` (faixa de cards no Mapa Geral) e `vertical` (sidebar padrão). Ambos expõem no header:
- Contador **"N canteiro(s)"** (`ObrasListPanel.tsx:92,160`).
- `SyncBadge` com o status de sincronização da store (`ObrasListPanel.tsx:95,163`).
- **Ressincronizar obras** (`handleResync` → `resyncSites()`): reempurra todas as obras locais como upsert carimbando a organização ativa; exibe um `alert` explicando que elas passam a aparecer para todos os usuários da empresa (`ObrasListPanel.tsx:47-50,96-103`).
- **Importar**: abre `ImportModal` com `OBRA_IMPORT_CONFIG` (aceita `.xlsx/.xls/.csv` no "template Atlântico", `atlantico-obras-template.xlsx`); cada linha vira `addSite({...obra, risks: []})` (`ObrasListPanel.tsx:65-83`).
- **Nova Obra** → `setEditing('new')` (abre o `ObraDialog`).
- **Banner de erro** vermelho quando `syncStatus === 'error'`, mostrando o erro real do servidor (`ObrasListPanel.tsx:52-62`).

Cada `ObraCard`/`ObraHorizontalCard` mostra: ponto colorido de status, código, nome, endereço (`street, number — district`, `city/state`), gerente, e **badge de risco** que conta `critical` ativos e `high` não-resolvidos (`ObrasListPanel.tsx:226-227,265-272,289-290`).

### Aba "Projetos" (`projetos`)
Renderiza a `ProjetosPage` do módulo Projetos (`index.tsx:137-141`) — é o mesmo componente do módulo de Projetos/Pré-construção embutido como aba (por isso `/app/projetos` e `/app/pre-construcao` redirecionam para cá).

### Aba "Obras" (`obras`) — sub-abas Carteira + Detalhe

Duas sub-abas: `CarteiraObrasPanel` (todas as obras) e `ObraDetailPanel` (a selecionada).
Clicar numa linha da Carteira seleciona a obra e abre o detalhe. `?aba=carteira` e `?aba=detalhes`
continuam funcionando — o parser redireciona os dois para `obras`.

#### `ObraDetailPanel`
Mostra o dossiê completo da obra selecionada (`selectedId`). Seções (`src/features/torre-de-controle/components/ObraDetailPanel.tsx`):
- **Localização** (`:316-324`): endereço, bairro, cidade/UF, CEP e coordenadas (`lat, lng` com 5 casas).
- **Responsáveis** (`:327-331`): empresa, dono, gerente.
- **Edificação** (`:334-338`): tipo/escopo, área total (m²), pavimentos/frentes.
- **Cronograma** (`:341-344`): data de início e previsão de término.
- **Descrição** (`:347-351`), quando preenchida.
- **Orçamento** (`:354-359`): editor inline `OrcamentoEditor` (grava a linha "Total") + `BudgetTable`.
- **Marcos** (`:362-371`): timelines de marcos de **Planejamento** e **Execução** (`MilestoneTimeline`), cada marco com status `done/active/pending` e data.
- **Riscos** (`:374-413`): lista de `RiskCard` ordenada por nível (crítico→baixo); botão "Adicionar" abre o `RiskDialog`; cada card permite editar/excluir (com confirmação inline) e expandir descrição/notas.
- Botão **Editar** no header abre o `ObraDialog` da obra (`:302-308`).

#### `OrcamentoEditor` (dentro do ObraDetailPanel, `:13-57`)
Campo editável do **orçamento do contrato**. Ao salvar, grava/atualiza a linha `Total` via `withTotalBudgetLine` e persiste com `updateSite(site.id, { budgetLines })`. É explicitamente a **fonte única do BAC por obra que o Planejamento consome** (`:11-12,353`).

#### `BudgetTable` (`:104-135`)
Tabela de linhas de orçamento (`budgetLines`): Categoria, Orçado (`amount`), Projeção (`projected`), Utilização = `projected/amount*100` (vermelho quando > 100%).

### Aba "BIM 3D/4D/5D" (`bim`)
Carrega `BimPage` do módulo BIM sob demanda (`index.tsx:19,149-155`).

### Aba "Mapa Interativo" (`mapa-interativo`)
Carrega `MapaInterativoPage` sob demanda (`index.tsx:20,157-163`).

### Modais globais da página
- **`ObraDialog`** (`src/features/torre-de-controle/components/ObraDialog.tsx`): formulário de criar/editar obra com `react-hook-form` + `zod` (`siteSchema`). Seções: Identificação (código, status, **Nome** obrigatório, **Projeto vinculado**, Tipo/Escopo com `datalist` de sugestões, Área/Extensão, Pavimentos/Frentes), Responsáveis (empresa, dono, gerente), Endereço (rua, número, bairro, cidade, estado com `maxLength=2`, CEP), Cronograma (início, previsão), Coordenadas (lat/lng), Descrição. Regras do submit (`ObraDialog.tsx:94-126`): coordenadas com defesa contra `NaN` (string vazia/valor inválido → `null`); código auto-gerado `OBR-NNN` quando vazio; `serviceScope = buildingType`; `projectId` vazio → `null`; preserva `risks` existentes. Exclusão com confirmação em dois passos (`:128-132,294-307`). Fecha com `Esc` (`:88-92`).
- **`RiskDialog`** (`src/features/torre-de-controle/components/RiskDialog.tsx`): criar/editar risco. Campos: **Título** (≥2), **Descrição** (obrigatória), **Nível** (`critical/high/medium/low`, com legenda de cores), **Status** (`identified/active/mitigated/resolved`), **Notas/Plano de Ação**. Ao criar, carimba `identifiedAt = new Date().toISOString()` (`RiskDialog.tsx:72-83`).

### `ObrasMap` — componente Leaflet do folder `[código]`
`src/features/torre-de-controle/components/ObrasMap.tsx` é um mapa Leaflet completo do módulo (marcadores tipo capacete/prédio por status, círculos de área proporcionais à `totalArea` = `min(800, max(200, sqrt(area)*3))`, marcadores arrastáveis que chamam `updateLocation`, régua de distância via `haversineKm`, contagem de equipamentos por canteiro vinda do `equipamentosStore`, rotas sugeridas do `otimizacaoFrotaStore`, popup com link para o Google Maps). **Observação:** a aba "Mapa Geral" atualmente monta o `ControlMap` compartilhado, não este `ObrasMap` (nenhum outro arquivo o importa) — ele permanece no folder como implementação de mapa específica da Torre. `[inferido]`

### `ObraSwitcher` — seletor de obra ativa (global) — `src/components/shared/ObraSwitcher.tsx`
Dropdown na barra lateral que espelha o seletor de empresa. Lista as obras (`code — name`) mais a opção **"Todas as obras"** (`activeObraId = null`). Troca a obra sem recarregar a página; se a obra tiver `projectId` vinculado, também foca esse projeto nos módulos por-projeto via `selectProject` (`ObraSwitcher.tsx:19-25`). Fica oculto quando não há obras cadastradas (`:27`).

## Dados que gera

### Entidade `ConstructionSite` (app) — `src/types/index.ts:205-235`
Campos: `id`, `projectId?` (vínculo opcional a Project), `code`, `name`, `company`, `owner`, `manager`, `description`, `status` (`ObraStatus`), endereço (`street/number/district/city/state/cep`), `buildingType`, `totalArea` (m²), `floors`, `serviceScope?`, `numeroContrato?`, `orcamentoBRL?`, `startDate`, `expectedEnd`, `lat/lng` (`number|null`), `risks: ConstructionRisk[]`, `budgetLines?`, `planningMilestones?`, `executionMilestones?`.
- `ConstructionRisk` (`:195-203`): `id, title, description, level, status, identifiedAt, notes?`.
- `ConstructionBudgetLine` (`:237-241`): `label, amount, projected`.
- `ConstructionMilestone` (`:245-249`): `name, date, status` (`done/active/pending`).
- Enums: `ObraStatus = active|planning|paused|completed`; `RiskLevel = critical|high|medium|low`; `RiskStatus = identified|active|mitigated|resolved` (`:191-193`).

### Tabela Supabase `construction_sites` — `supabase/migrations/0032_sprint6_final.sql:69-91` `[schema]`
Colunas: `id uuid PK`, `organization_id uuid NOT NULL → organizations(id) ON DELETE CASCADE`, `project_id uuid → projects(id) ON DELETE SET NULL`, `code`, `name`, `status`, `city`, `state`, `lat/lng double precision`, `start_date/expected_end date`, **`payload jsonb NOT NULL DEFAULT '{}'`** (comentário do schema: "company, owner, manager, address, areas, milestones, risks[]"), `created_by uuid NOT NULL → auth.users`, `created_at`, `updated_at`, `deleted_at` (soft-delete).
- Índices: `idx_sites_org`, `idx_sites_org_created` (org, created_at DESC), `idx_sites_org_active` (parcial `WHERE deleted_at IS NULL`), `idx_sites_status` (`:88-91`).
- **Modelo de gravação (`[código]`, `torreDeControleStore.ts:19-40`):** a linha guarda as colunas "quentes" (busca/mapa/RLS) e o objeto `ConstructionSite` **inteiro** no `payload` — inclusive `risks[]` (não há tabela separada de riscos; riscos vivem no JSONB). No pull, o app lê `r.payload` como o site (`store:245-248`). A coluna `project_id` é **sempre gravada como `null`** (o `projectId` real fica preservado no `payload`) para não colidir com o trigger de tenant (ver Integrações).

## Cálculos, KPIs e regras de negócio

- **BAC por obra (orçamento de contrato):** `obraBacFromSite` usa a linha cujo label casa `/total/i`; se não houver, soma todas as linhas (`src/features/torre-de-controle/utils/obraBudget.ts:8-13`). `withTotalBudgetLine` cria/atualiza a linha `Total` preservando as demais (`:16-19`). Esse BAC é a fonte única lida pelo Planejamento (Torre → Frente → Atividade).
- **Utilização de orçamento (BudgetTable):** `utilization = amount>0 ? projected/amount*100 : 0`; sinaliza estouro quando `> 100%` (`ObraDetailPanel.tsx:117-118,126`).
- **Badges de risco:** "críticos" = `level==='critical' && status==='active'`; "altos" = `level==='high' && status!=='resolved'` (`ObrasListPanel.tsx:226-227`). No detalhe: "ativos" = `status==='active'`; "críticos" = `level==='critical'` (`ObraDetailPanel.tsx:284-285`). Ordenação dos riscos por nível: critical(0) < high(1) < medium(2) < low(3) (`:403-407`).
- **Raio de área no mapa (`ObrasMap`):** `min(800, max(200, sqrt(totalArea)*3))` metros (`ObrasMap.tsx:341-342`).
- **Distância (régua):** `haversineKm` entre dois pontos clicados (`ObrasMap.tsx:311-316`).
- **Permissão de escrita (RLS):** INSERT/UPDATE só para papéis `engenheiro|planejador|gerente|diretor|owner` e `organization_id = user_org()` (`0033_sprint6_rls.sql:69-77`).
- **Exclusão via aprovação:** DELETE físico é **bloqueado** por RLS (`USING (false)`, `0033_sprint6_rls.sql:78-79`). O `deleteSite` enfileira uma ação de aprovação `delete_construction_site` (`torreDeControleStore.ts:151`); o aprovador padrão é `diretor` (`0034_sprint6_rpcs.sql:82,101`) e a execução da aprovação faz **soft-delete** (`UPDATE ... SET deleted_at = now()`, `:199`).

## Integrações — a "camada única"

**O que a Torre ALIMENTA (é a fonte de verdade da obra):**
- **Obra ativa global:** `construction_sites` → `ObraSwitcher` → `activeObraStore.activeObraId`. Consumido em todo o app via `useActiveObra`/`byActiveObra` (`src/hooks/useActiveObra.ts`).
- **`site_id` nos demais módulos (scoping por obra):** as migrações de "obra scoping" adicionam `site_id uuid REFERENCES construction_sites(id) ON DELETE SET NULL` (dado legado `NULL` = "Todas as obras"; RLS não muda — a obra é filtro de aplicação, não fronteira de segurança):
  - Fase 1 (`20260627120000_obra_scoping_fase1.sql`): `rdo`, `suprimentos_depositos`, `suprimentos_estoque_itens`, `suprimentos_estoque_movimentacoes`, `suprimentos_ordens`, `purchase_orders`, `goods_receipts`, `invoices`, `shifts`, `worker_absences`.
  - Fase 2 (`20260627130000_obra_scoping_fase2.sql`): `fvs`, `quality_non_conformities`.
  - Fase 3 (`20260627140000_obra_scoping_fase3.sql`): `equipamentos.construction_site_id`, `maintenance_orders`, `plan_trechos`, `plan_teams`, `plan_scenarios`.
- **BAC por obra** → Planejamento (via `obraBudget`).
- **Vínculo a Project** (`projectId`) → ao selecionar a obra no `ObraSwitcher`, os módulos por-projeto (EVM/Financeiro, Aditivos/Change Orders) focam o projeto vinculado (`ObraDialog.tsx:180`, `ObraSwitcher.tsx:19-25`).
- **Snapshot da organização:** o RPC de snapshot inclui `construction_sites` (`0034_sprint6_rpcs.sql:307`).

**O que a Torre CONSOME:**
- **Projetos** (`projetosStore`): para a aba Projetos, para o dropdown "Projeto vinculado" no `ObraDialog` e para plotar projetos no `ControlMap`.
- **`equipamentosStore` / `otimizacaoFrotaStore`** (no `ObrasMap`): contagem de equipamentos por canteiro e rotas sugeridas.

**Eventos / realtime (`src/lib/eventBus.ts`, `src/lib/realtime.ts`):**
- A store reage a `eventBus`: em `measurement.draft_created`, `measurement.blocked`, `measurement.approved` faz `pull()` (`torreDeControleStore.ts:274-282`).
- Também escuta `realtime.row_changed` e re-pulla quando a tabela alterada é `construction_sites`, `projects`, `measurement_sources`, `measurement_memory_lines`, `plan_trechos` ou `lps_restrictions` (`torreDeControleStore.ts:283-294`).
- **Nuance importante `[código]/[inferido]`:** apesar da store estar preparada para reagir a mudanças de `construction_sites` via realtime, **`construction_sites` NÃO está na publicação `supabase_realtime`** (`20260711120000_enable_realtime.sql` só publica tabelas de Planejamento/Estoque) **nem em `WATCHED_TABLES`** de `realtime.ts:31-62`. Ou seja, a propagação cross-usuário de edições de obra hoje se apoia no `pull` ao montar a página, no botão "Ressincronizar obras" e nos eventos de medição/projetos — não em um push ao vivo da própria tabela de obras.
- **Trigger de servidor `enforce_projects_torre_gestao_tenant`** (`20260518153640_tenant_safe_projects_torre_gestao.sql:40-53,100-104`): em INSERT/UPDATE de `construction_sites`, se `project_id` não for `NULL` e o projeto não pertencer à mesma organização, levanta exceção `23514`. Por isso o store envia `project_id = null` e mantém o `projectId` real no `payload` (`torreDeControleStore.ts:22-24`).

## Eficiência gerada

- **Dado único da obra:** cadastra-se a obra uma vez e ela vira o eixo de segmentação de todos os módulos (via `site_id`/obra ativa) — elimina replicar "qual obra" em cada planilha/módulo. `[inferido]`
- **BAC de contrato num só lugar:** o orçamento editado no detalhe é a fonte que o Planejamento lê, evitando divergência de orçamento entre planilhas. `[código]` (`obraBudget.ts:1-13`)
- **Georreferenciamento operacional:** posicionar/arrastar obras no mapa, medir distâncias e ver equipamentos/rotas por canteiro reduz idas a ferramentas externas de mapa. `[inferido]` (`ObrasMap.tsx`)
- **Importação em massa** de obras por Excel/CSV (template Atlântico) acelera o onboarding de portfólio. `[código]` (`ObrasListPanel.tsx:65-83`)
- **Rastreabilidade e governança:** soft-delete + exclusão sob aprovação (`diretor`) e RLS por papel evitam perda acidental e mantêm histórico. `[código]` (`0033_sprint6_rls.sql`, `0034_sprint6_rpcs.sql`)
- **Troca de obra sem reload:** o `ObraSwitcher` reativa os módulos por selector (Zustand), sem recarregar a página. `[código]` (`ObraSwitcher.tsx:11-25`)

## Como sincroniza

- **Local-first (offline-capable):** a store persiste em `localStorage` (`persist`, name `cdata-torre-controle`) com `activeOrgId`, `sites`, `selectedId`, `pendingSync`, `lastSyncedAt` (`torreDeControleStore.ts:255-264`). Escritas mutam o estado local na hora e enfileiram uma `PendingOp` em `pendingSync`; `flush()` sobe a fila via `flushQueue` (`storeSync`). Se `navigator.onLine` for falso, marca `offline`; sem `profile`, marca `unauth`; re-flush automático ao voltar `online` (`:216-232,268-271`).
- **Anti-clobber concorrente:** `updateSite` calcula `changedColumns` e envia só as colunas alteradas (`:129-142`); `deleteSite` vai por aprovação (`delete_construction_site`).
- **Pull com proteção:** `pull()` **não** sobrescreve a lista local se houver op pendente para `construction_sites` (senão uma obra ainda não sincronizada sumiria); caso contrário, lê `payload` de cada linha (`:234-252`). A página dispara `flush()` seguido de `pull()` ao montar (fora do modo demo) (`index.tsx:64-82`).
- **Ressincronização manual:** `resyncSites()` reempurra todas as obras locais como upsert (`onConflict id`) carimbando a org ativa — cura obras que nunca subiram ou foram carimbadas com a org errada (`:199-211`).
- **Multi-tenant / RLS:** `construction_sites` tem `ENABLE`+`FORCE ROW LEVEL SECURITY`; SELECT limitado a `organization_id = user_org() AND deleted_at IS NULL`; INSERT/UPDATE por papel; DELETE bloqueado (`0033_sprint6_rls.sql:64-79`). O trigger de tenant garante que `project_id` não aponte para projeto de outra org (`20260518153640_...:40-53`).
- **Isolamento na troca de empresa:** `ensureTenantScope` zera `sites`/seleção ao mudar de `organization_id`, **preservando `pendingSync`** (obras criadas e ainda não sincronizadas não podem se perder no login) (`:102-115`); o `activeObraStore.ensureTenantScope` zera a obra ativa para não vazar obra entre empresas (`activeObraStore.ts:25-30`).
- **Realtime:** ver a nuance na seção de Integrações — a store reage a eventos de realtime de outras tabelas (medição, projetos, planejamento), mas `construction_sites` não está na publicação/`WATCHED_TABLES` hoje.
