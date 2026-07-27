# ConstruData — Plataforma (Visão Geral)

> Documento-mãe da documentação de plataforma. Os módulos individuais ficam em `docs/plataforma/modulos/`.
> **Stack:** React 19 + Zustand (stores local-first) + Supabase (Postgres/Auth/RLS/Realtime/Edge Functions) + Vercel (`/api`). Multi-tenant por `organization_id`.

---

## O que é (a tese "camada única" / connected construction)

O ConstruData é uma **camada operacional única** para gestão de obras brasileiras (infraestrutura, saneamento e edificação). A tese central é a de *connected construction*: em vez de cada área da empresa manter sua própria versão da realidade em planilhas, PDFs, ERPs e grupos de mensagem, o dado **nasce uma vez** (no RDO de campo, na medição, no planejamento ou em suprimentos) e **segue conectado** até a diretoria, sem reconferência manual.

A landing formula isso de forma direta: *"O dado nasce no RDO, na medição, no planejamento ou em suprimentos e segue conectado até a diretoria"* e *"Origem 100% rastreável — Serviço, local, equipe, evidência, material e custo na mesma base, sem versões paralelas"* [código: `src/features/landing/LandingPage.tsx:66-68`]. O produto se descreve como **"20 módulos conectados"** [código: `src/features/landing/LandingPage.tsx:721`].

O whitepaper interno descreve a arquitetura conceitual como uma **ontologia** de quatro camadas — Entidades (obra, contrato, serviço, equipe, fornecedor, material, equipamento, ativo), Eventos (RDO, medição, pedido de compra, NC, checklist, manutenção), Modelos (prazo, custo, produtividade, avanço físico, curva S, EVM) e Ações (aprovar medição, replanejar frente, abrir compra, corrigir NC) [código: `docs/WHITEPAPER_CONSTRUDATA_CONNECTED_CONSTRUCTION.md:103-165`]. O problema que resolve é a **arquitetura operacional fragmentada**: planejamento separado da execução, RDO separado da medição, suprimentos separado do cronograma, financeiro separado do avanço físico [código: `docs/WHITEPAPER_CONSTRUDATA_CONNECTED_CONSTRUCTION.md:56-66`].

No código, essa promessa tem um guardião literal: o arquivo `src/store/crossModuleSync.ts`, descrito em seu cabeçalho como *"o GUARDIÃO da promessa de 'Ontologia Unificada': todas as funções de leitura/escrita entre módulos diferentes vivem aqui, em um único lugar"* [código: `src/store/crossModuleSync.ts:1-16`].

---

## Para quem / ICP (papéis)

A plataforma é modelada em torno de perfis operacionais distintos, cada um enxergando a **mesma base** por um ângulo diferente [código: `docs/WHITEPAPER_CONSTRUDATA_CONNECTED_CONSTRUCTION.md:169-189`; `src/features/landing/LandingPage.tsx:399-403`]:

- **Owner / Diretor** — acompanha portfólio, prazo, custo, risco e avanço físico-financeiro em tempo real, sem consolidação manual; decide sobre novas obras e conversas com clientes pelo celular [código: `LandingPage.tsx:402`].
- **Gerente** — decide realocação de equipe, aprovação de pedido e risco de prazo acompanhando CPI/SPI [código: `LandingPage.tsx:401`].
- **Engenheiro (campo)** — decide o que registrar, medir e qual restrição abrir vendo o impacto no cronograma, medição e qualidade [código: `LandingPage.tsx:400`].
- **Planejador** — entende impacto de atrasos, desvios de produtividade e falta de material no cronograma.
- **Comprador / Suprimentos** — enxerga demanda futura, criticidade por frente, materiais pendentes e risco de parada.
- **Qualidade** — registra FVS, não-conformidades e liberações com rastreabilidade.
- **Visualizador / Cliente** — recebe visões controladas de avanço, evidências e marcos.

Os papéis têm expressão técnica no enum de roles do banco, usado pelas policies de RLS: `owner`, `diretor`, `gerente`, e demais roles operacionais, verificados por `has_role(...)` [código: `supabase/migrations/0008_helpers.sql:18-24`; ver `has_role(ARRAY['gerente','diretor','owner'])` em `0009_rls_core.sql:57-63`]. O ICP comercial cobre construtoras de médio porte, saneamento/infraestrutura, engenharia ambiental, EPC/consórcios e empreiteiras [código: `LandingPage.tsx:391-397`].

---

## Arquitetura em uma página

**Front-end.** SPA React 19 com roteamento por `react-router-dom`. Todo o app autenticado vive sob `/app/*`, protegido por `AuthGuard`, dentro de um `AppShell`; cada módulo é *lazy-loaded* (code-split por rota) [código: `src/App.tsx:10-27,111-154`]. A landing (`/`) e as rotas de auth (`/login`, `/aceitar-convite`, `/mfa/*`) ficam fora do shell [código: `src/App.tsx:99-108`].

**Estado — Zustand local-first.** Há ~40 stores, um por domínio (`src/store/`). O padrão de sincronização está centralizado em três helpers:

1. **`syncableStore.ts`** — factory de store local-first. Cada mutação: (1) aplica imediatamente em memória + `localStorage` (otimista); (2) enfileira uma `PendingOp` em `pendingSync[]`; (3) quando online, drena a fila para o Supabase; (4) *pull* periódico (30s) + push por Realtime. Conflict resolution v1: *last-write-wins* por `updated_at` [código: `src/lib/syncableStore.ts:1-22`].
2. **`storeSync.ts`** — `flushQueue()` drena a fila contra o Supabase com timeout de segurança de 20s por requisição (rede de canteiro ruim não trava o status), *batch upsert* de inserts consecutivos com *fallback* per-op, coalescing sensível à ordem de create+delete, e `pullTable()` genérico filtrado por `organization_id` + `deleted_at IS NULL` [código: `src/lib/storeSync.ts:24-42,100-315,353-385`].
3. **`useStoreSync.ts`** — bootstrap por módulo: ao montar (e quando a org ativa muda) roda `ensureTenantScope(orgId) → flush() → pull()`, e só faz *pull* **se a fila esvaziou**, para nunca sobrescrever dado local ainda não sincronizado [código: `src/lib/useStoreSync.ts:1-13,48-74`].

**Back-end — Supabase.** Postgres com **RLS multi-tenant por `organization_id`**, funções `SECURITY DEFINER` (`user_org()`, `user_role()`, `has_role()`), triggers cross-module server-side, e Realtime por organização. Vercel serve o build estático + funções `/api` (ver `api/`, `vercel.json`).

**Padrão de sync (fluxo de uma escrita):**
```
mutação otimista (memória + localStorage)
   → makeOp() enfileira PendingOp em pendingSync[]
   → flush() → flushQueue() → Supabase (upsert/update/delete, com fixOrg + sanitizeIds)
   → trigger SQL server-side propaga p/ outros módulos (verdade única)
   → Supabase Realtime emite UPDATE
   → realtime.ts coalesce (350ms) → eventBus.emit('realtime.row_changed')
   → store inscrito re-pull → UI atualiza sozinha
```
[código: `src/lib/storeSync.ts:340-347,100-142`; `src/lib/realtime.ts:1-25,85-95`]

**Offline.** `flushQueue` e `pullTable` verificam `navigator.onLine` e retornam cedo se offline — o dado fica seguro no aparelho e a op permanece na fila para *retry* [código: `src/lib/storeSync.ts:107-109,358`]. O timeout de 20s aborta requisições penduradas, devolve a op à fila e marca status `error` (*"Salvo no aparelho — vamos reenviar"*) [código: `src/lib/storeSync.ts:18-24,36-37`].

**Realtime por org.** `subscribeOrgRealtime(organizationId)` abre um único channel `org-changes:${organizationId}` que escuta INSERT/UPDATE/DELETE de uma lista enxuta de tabelas críticas, **sempre filtrado por `organization_id=eq.<org>`** [código: `src/lib/realtime.ts:101-150,121-137`].

---

## A camada única na prática — fluxo do dado ponta a ponta

O caminho canônico do dado atravessa os módulos assim, e cada elo existe de fato no código:

### 1. RDO / campo → Planejamento (executado / progresso)
Ao finalizar um RDO, o `rdoStore` emite os domain events `rdo.closed` e `rdo.finalized` (com uma `operationalKey` que casa contrato/núcleo/local/serviço/período) e agenda `syncExecutionToPlanejamento()` [código: `src/store/rdoStore.ts:297-321,431`]. Essa função reconcilia **sempre** (mesmo com mapa vazio) para zerar contribuições que perderam vínculo — evitando dupla contagem — e alimenta tanto os trechos (`syncExecutionFromRdo`) quanto as atividades-mestre e o Plano de Execução [código: `src/store/rdoStore.ts:431-518`]. Do lado do servidor, o trigger **`trg_rdo_to_planejamento`** faz o mesmo de forma autoritativa: varre `payload->'trechos'` e grava `plan_trechos.payload->>'executedMeters'` com `GREATEST` (não regride) [schema: `supabase/migrations/0035_cross_module_triggers.sql:20-60`].

### 2. RDO → Mão de Obra (apontamentos)
O RDO com apontamento de equipe gera *timecards*: `syncRdoToTimecards` cria uma marcação por funcionário presente, com horas rateadas por *headcount* e `laborCostBRL = custoDiaWorker(...)`, apagando (soft-delete) os timecards antigos do mesmo RDO [código: `src/store/maoDeObraStore.ts:522-560`; chamada em `src/features/rdo/components/RdoCompizzoPanel.tsx:120,401`].

### 3. RDO → Suprimentos (baixa de estoque)
A baixa de estoque de materiais consumidos **não é feita no cliente** — é responsabilidade do trigger de servidor **`trg_rdo_to_estoque`**, gated em `payload.status='finalizado'` [código: `src/features/rdo/components/NovoRdoPanel.tsx:657`; comentário em `src/store/suprimentosStore.ts:1616`; schema: `supabase/migrations/20260625120000_rdo_estoque_integration.sql:114-115`, endurecido em `20260626120000_rdo_estoque_hardening.sql` e `20260628130000_baixa_estoque_atomica.sql`].

### 4. RDO → Financeiro (custo)
`syncRdoToFinanceiro(rdo)` transforma o RDO finalizado em lançamentos de **saída**: materiais (qtd × custo unitário) e mão de obra (custo/dia por funcionário presente), com `sourceRdoId` para rastreio e reversão; se o RDO volta a rascunho, os lançamentos são removidos [código: `src/store/financeiroStore.ts:179-206`; disparado por `rdoStore` em `src/store/rdoStore.ts:323,369,390`].

### 5. Medição (faturável)
O RDO finalizado alimenta a **Medição**: a landing descreve *"O RDO finalizado gera rascunho de medição por empreiteiro, núcleo, serviço e evidência para conferência"* [código: `LandingPage.tsx:396`]. O eventBus carrega os eventos do ciclo de medição: `measurement.draft_created`, `measurement.blocked` (com `blockingIssues[]`) e `measurement.approved` (com `quantity`/`amount`) [código: `src/lib/eventBus.ts:49-51`]. A migração `0048_rdo_quality_measurement_sync.sql` formaliza a sincronização RDO↔Qualidade↔Medição no servidor.

### 6. Suprimentos → Financeiro / EVM (custo real)
Quando uma *purchase order* passa a `status='closed'`, o trigger **`trg_po_to_evm`** insere automaticamente um `evm_cost_accounts` com `source='po_auto'` (idempotente por `po_id`) — é o custo real (AC) entrando no EVM sem digitação [schema: `supabase/migrations/0035_cross_module_triggers.sql:69-109`]. No cliente, o eventBus reflete isso via `po.closed`, `po.received`, `supply.receipt_approved` e `supply.invoice_approved` [código: `src/lib/eventBus.ts:38-42`].

### 7. Qualidade → LPS / Planejamento (restrição)
Uma FVS com NC vira **restrição do LPS**: o trigger **`trg_fvs_nc_to_lps`** varre `payload->'items'`, e para cada item com `ncRequired=true` insere uma `lps_restrictions` com `source='fvs_auto'` (idempotente por `fvs_id`+`nc_number`) [schema: `supabase/migrations/0035_cross_module_triggers.sql:118-172`]. No cliente há o espelho: `getOpenNcsAsRestrictions()` e os eventos `fvs.nc_opened` / `fvs.nc_resolved` / `quality.blocked` / `quality.released` [código: `src/store/crossModuleSync.ts:171-191`; `src/lib/eventBus.ts:44-48`].

### 8. Financeiro / EVM → diretoria (CPI/SPI, DRE, fluxo) → Economia (ROI)
O Financeiro consolida custo previsto × realizado, EVM (CPI/SPI) e DRE; a Gestão 360 e a Torre de Controle leem isso para a visão executiva. O elo final é a **Economia**: mede o ganho da operação conectada em R$ (baseline × realizado), com as tabelas `economy_baselines`, `economy_events`, `economy_reports`, `economy_valuation_rules` [schema: `supabase/migrations/0054_economia_roi.sql`; tabelas em `src/lib/realtime.ts:56-59`].

### Os elos reais (resumo dos "ganchos")
| Elo | Onde vive | Mecanismo |
|---|---|---|
| `rdo.finalized` / `rdo.closed` | `src/store/rdoStore.ts:297-319` | eventBus (cliente) |
| `syncExecutionToPlanejamento` | `src/store/rdoStore.ts:431` | reconciliação cliente |
| `syncRdoToTimecards` | `src/store/maoDeObraStore.ts:522` | ponte cliente |
| `syncRdoToFinanceiro` | `src/store/financeiroStore.ts:179` | ponte cliente |
| `trg_rdo_to_estoque` | `migrations/20260625120000` | trigger servidor |
| `trg_rdo_to_planejamento` | `migrations/0035:56` | trigger servidor |
| `trg_po_to_evm` | `migrations/0035:105` | trigger servidor |
| `trg_fvs_nc_to_lps` | `migrations/0035:168` | trigger servidor |
| `crossModuleSync` | `src/store/crossModuleSync.ts` | funções de leitura/escrita cross-módulo |

---

## Eficiências geradas (o "porquê")

- **Fim do retrabalho de planilha.** O RDO finalizado já produz executado no planejamento, timecards, lançamentos financeiros e rascunho de medição — sem redigitação. A empresa deixa de perguntar *"qual planilha está certa?"* [código: `docs/WHITEPAPER_...:235`]. [inferido] o ganho concreto é eliminar a conferência manual de PO×recebimento×NF e a consolidação de RDO em relatório mensal.
- **Tempo real para a diretoria.** Gestão 360 e Torre de Controle cruzam RDO, medição, planejamento, EVM e pendências em visão executiva única, "em dias, não meses" [código: `LandingPage.tsx:378`].
- **Rastreabilidade / dado único.** Cada número mantém origem (serviço, local, equipe, evidência, material, custo) na mesma base; `sourceRdoId` liga lançamentos financeiros e timecards ao RDO que os gerou [código: `src/store/financeiroStore.ts:182`; `src/store/maoDeObraStore.ts:544`]. [inferido] isso cria uma trilha defensável para auditoria, cliente e fiscalização.
- **Automação server-side.** Triggers garantem "verdade única, não duplicada no cliente" — baixa de estoque, custo real no EVM e restrição de NC acontecem no banco, independentes do dispositivo [código: `supabase/migrations/0035_cross_module_triggers.sql:1-11`].
- **Números de referência (marketing, [inferido] como estimativa, não medição auditada aqui):** redução de 3–5% no custo total, até 80% menos tempo de orçamentação, até 40% menos risco de falta de material, ~6h/dia economizadas só no RDO (CSLNR) [código: `LandingPage.tsx:376-382,410`].

---

## Segurança & multi-tenant

- **`organization_id` em toda entidade.** Todo *pull* filtra por `organization_id = profile.organization_id` e ignora soft-deletados (`deleted_at IS NULL`) [código: `src/lib/storeSync.ts:363-367`]. As escritas reparam `organization_id`/`created_by` `'pending'` antes de subir, senão a RLS rejeitaria o insert [código: `src/lib/storeSync.ts:136-142`].
- **Funções de identidade (`SECURITY DEFINER`).** `user_org()`, `user_role()`, `has_role(roles[])` e `required_approver_for(action)` — todas leem `profiles` por fora da própria policy e são a base das políticas de RLS [schema: `supabase/migrations/0008_helpers.sql:6-44`].
- **RLS `ENABLE` + `FORCE`.** As tabelas ligam `ENABLE ROW LEVEL SECURITY` com policies `USING (organization_id = public.user_org() AND deleted_at IS NULL)`; escritas sensíveis exigem `has_role([...])` (ex.: convites/perfis só por `gerente/diretor/owner`) [schema: `supabase/migrations/0009_rls_core.sql:8-14,57-63,87-96`]. Tabelas de dados de tenant adicionam **`FORCE ROW LEVEL SECURITY`** (RLS vale até para o dono da tabela) — ex.: `0044_suprimentos_planilhas.sql`, `0045_contractors_rdo_measurement.sql`, `0048_rdo_quality_measurement_sync.sql`, `0053_unified_measurement_layers.sql`, `0054_economia_roi.sql` [schema].
- **Aprovações.** Deletes/ações sensíveis passam pela RPC `request_action(p_action_type, p_target_table, p_target_id, p_payload)` em vez de DELETE direto; a matriz de aprovação por org define o role mínimo via `required_approver_for()` [código: `src/lib/storeSync.ts:64-66,207-214`; schema: `0008_helpers.sql:28-38`]. UI em `/app/aprovacoes` e `/app/configuracoes/aprovacoes` [código: `src/App.tsx:113,117`].
- **Auditoria & LGPD.** `audit_log` recebe eventos (ex.: `worker_absent`) via trigger [schema: `0035:180-203`]; há telas de Auditoria e Exportar Dados [código: `src/App.tsx:114-115`].
- **Isolamento no Realtime.** O channel por org filtra `organization_id=eq.<org>` em cada tabela e troca de channel quando a org ativa muda [código: `src/lib/realtime.ts:105-137`].
- **Ressalva do super-admin global.** Existe um e-mail com privilégios globais fora do modelo por-org — `GLOBAL_ADMIN_EMAIL` em `src/lib/globalAdmin.ts:4-12`, com migrações que concedem acesso cross-org (`20260525190000_global_admin_all_org_access.sql`, `20260518184500_global_multi_tenant_isolation.sql`). É uma exceção deliberada à isolação multi-tenant, usada para homologação/adaptação; [inferido] deve ser tratada como conta privilegiada de operação da plataforma, não de cliente.

---

## Como sincroniza (resumo)

**Local-first + Realtime + RLS.** Escrita otimista em memória/`localStorage` → fila `pendingSync[]` → `flushQueue()` (com timeout 20s, batch upsert, coalescing create/delete, soft-delete via `deleted_at`) → Supabase → triggers server-side → Realtime por org (coalesce 350ms) → `eventBus('realtime.row_changed')` → re-pull dos stores inscritos [código: `src/lib/storeSync.ts:100-315`; `src/lib/realtime.ts:67-150`]. **Offline** é de primeira classe: early-return em `!navigator.onLine`, retry na fila, dado seguro no aparelho [código: `src/lib/storeSync.ts:107-109`]. **Multi-tenant** é imposto em três frentes: filtro de query no cliente, RLS no banco e filtro de channel no Realtime.

---

## Módulos (índice)

Cada item aponta para `docs/plataforma/modulos/`. Rotas conforme `src/App.tsx` e agrupamento conforme a sidebar (`src/components/shared/Sidebar.tsx:26-79`).

**Grupo INÍCIO**
- **Início / Minha Rotina** (`/app/minha-rotina`) — home operacional por perfil; ponto de entrada padrão do app. → `modulos/minha-rotina.md`

**Grupo GESTÃO**
- **Gestão 360** (`/app/gestao-360`; absorve o antigo Relatório 360) — visão executiva única: CPI/SPI, curva S, alertas por exceção, job costing e simulação de atrasos. → `modulos/gestao-360.md`
- **Torre de Controle (Obras)** (`/app/torre-de-controle`; abas `?aba=projetos`, `?aba=mapa-interativo`, `?aba=bim`) — *war room* de portfólio; hospeda Projetos, Mapa Interativo e BIM. → `modulos/torre-de-controle.md`
- **Suprimentos & Estoque** (`/app/suprimentos`) — Three-Way Match (pedido×recebimento×NF), almoxarifado, requisições, baixa de estoque via RDO. → `modulos/suprimentos.md`
- **Medição** (`/app/medicao`) — medição defensável por período/frente/empreiteiro, memória de cálculo, pendências bloqueantes, aprovação humana. → `modulos/medicao.md`

**Grupo PLANEJAMENTO**
- **Planejamento (Mestre + LPS/Lean)** (`/app/planejamento-mestre`; `lps-lean` redireciona para cá) — plano mestre, marcos/baseline, look-ahead 6 semanas, PPC, restrições. → `modulos/planejamento-mestre.md`
- **Planejamento de Trechos (Rede)** (`/app/planejamento`) — CPM/Gantt de trechos, curva S, ABC, motor de cronograma e simulação de atraso. → `modulos/planejamento-trechos.md`
- **Agenda** (`/app/agenda`) — agenda operacional por equipe/frente/período a partir do cronograma. → `modulos/agenda.md`
- **Financeiro (EVM · DRE · Fluxo · Pagamentos · Distribuição)** (`/app/evm`; `financeiro` redireciona para cá) — valor agregado, CPI/SPI, DRE, fluxo de caixa, títulos e distribuição de custos. → `modulos/financeiro.md`
- **Quantitativos** (`/app/quantitativos`) — itens, composições, bases SINAPI/SEINFRA, BDI e N. Preço como referência para medição e EVM. → `modulos/quantitativos.md`

**Grupo CAMPO**
- **RDO — Relatório Diário de Obra** (`/app/rdo`) — captura diária (serviço, local, equipe, equipamento, material, foto, ocorrência); origem de medição, custo e avanço. → `modulos/rdo.md`
- **RDO SABESP** (`/app/rdo-sabesp`) — variante de RDO com parser/ativos específicos para o padrão SABESP. → `modulos/rdo-sabesp.md`
- **Qualidade (FVS)** (`/app/qualidade`) — FVS digital, tratamento de NC, liberação de fechamento; gera restrição no LPS. → `modulos/qualidade.md`
- **Mão de Obra** (`/app/mao-de-obra`) — cadastro, alocação, certificações, timecards e produtividade; recebe apontamentos do RDO. → `modulos/mao-de-obra.md`

**Grupo PREDIAL**
- **Predial (Manutenção · Ativos · CapEx · Rateio)** (`/app/predial`; `manutencoes` e `equipamentos`/`gestao-equipamentos` redirecionam para abas) — ativos, planos preventivos, ordens de serviço e rateio de consumo. → `modulos/predial.md`

**Grupo PROJETOS**
- **Economia (ROI / Savings)** (`/app/economia`) — mede economia/eficiência em R$ (baseline × realizado) por obra e iniciativa. → `modulos/economia.md`
- **BIM** (`/app/torre-de-controle?aba=bim`) — visualização 3D/4D/5D (modelo, tempo, custo) ligada a planejamento e orçamento. → `modulos/bim.md`
- **Mapa Interativo** (`/app/torre-de-controle?aba=mapa-interativo`) — editor Leaflet de redes (esgoto/água/drenagem), import UTM, análise 3D/4D/5D. → `modulos/mapa-interativo.md`
- **Frota Veicular & Otimização de Frota** (`/app/otimizacao-frota`) — veículos, viagens, combustível, manutenção e otimização de rotas/alocação. → `modulos/frota.md`
- **Pré-Construção & Projetos** (`/app/torre-de-controle?aba=projetos`; `pre-construcao` redireciona) — dossiê de projeto, viabilidade, dados geotécnicos e registro de obras. → `modulos/pre-construcao-projetos.md`
- **Operação de Campo & Rede 360** (features `operacao-campo`/`rede-360`; [inferido] integradas às telas de Torre/Mapa — sem rota dedicada em `src/App.tsx`) — operação de rede e visão 360 de campo. → `modulos/operacao-campo-rede360.md`

**Grupo ADMIN & Governança**
- **Admin & Governança (Membros · Aprovações · Auditoria · LGPD)** — Membros (`/app/membros`), Aprovações (`/app/aprovacoes`, matriz em `/app/configuracoes/aprovacoes`), Auditoria (`/app/auditoria`), Exportar Dados/LGPD (`/app/exportar-dados`), Homologação (`/app/homologacao`), Adaptação Rápida (`/app/adaptacao-rapida`) — itens `adminOnly` [código: `src/App.tsx:113-119`; `Sidebar.tsx:75-79`]. → `modulos/admin-governanca.md`

---

*Fontes primárias lidas: `README.md`, `src/App.tsx`, `src/components/shared/Sidebar.tsx`, `src/lib/eventBus.ts`, `src/store/crossModuleSync.ts`, `src/lib/realtime.ts`, `src/lib/storeSync.ts`, `src/lib/useStoreSync.ts`, `src/lib/syncableStore.ts`, `src/lib/globalAdmin.ts`, `src/store/rdoStore.ts`, `src/store/financeiroStore.ts`, `src/store/maoDeObraStore.ts`, `src/features/landing/LandingPage.tsx`, `docs/PLATFORM.md`, `docs/WHITEPAPER_CONSTRUDATA_CONNECTED_CONSTRUCTION.md`, e migrações `0008`, `0009`, `0035`, `0054`, `20260625120000`, `20260711120000`.*
