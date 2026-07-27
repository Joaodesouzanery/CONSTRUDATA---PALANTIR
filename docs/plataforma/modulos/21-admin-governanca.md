# Admin & Governança (Membros · Aprovações · Auditoria · LGPD)

> **Rota(s):** `/app/membros` · `/app/aprovacoes` · `/app/auditoria` · `/app/exportar-dados` · `/app/configuracoes/aprovacoes` · `/app/homologacao` · `/app/adaptacao-rapida` (todas em `src/App.tsx:113-119`)
> **Store(s):** `companySettingsStore` (`src/store/companySettingsStore.ts`) · `appModeStore` (`src/store/appModeStore.ts`) · consome `useAuth` (`src/lib/auth`) e `useManutencoesStore`
> **Grupo na sidebar:** **ADMIN** (`src/components/shared/Sidebar.tsx:75-79`) — apenas **Membros**, **Homologação** e **Adaptação Rápida** aparecem no menu, todos marcados `adminOnly` (só a conta global os vê, filtro em `Sidebar.tsx:109`). As telas **Aprovações**, **Auditoria**, **Exportar dados** e **Matriz de aprovação** existem e estão roteadas, mas **não têm item de menu** — hoje são acessadas por URL direta ou por links de e-mail. [código]

---

## O que é / problema que resolve

O módulo Admin & Governança concentra a **camada de controle e conformidade** da plataforma: quem tem acesso (Membros), qual ambiente a empresa está usando (Homologação/Produção/Demo), como onboardar uma obra existente sem replanilhar tudo do zero (Adaptação Rápida), como frear ações destrutivas com aprovação de duas pessoas (Aprovações + Matriz de aprovação), a **trilha imutável** do que aconteceu (Auditoria) e a **portabilidade de dados** exigida pela LGPD (Exportar dados). [inferido]

Ele resolve três dores clássicas de uma operação multiempresa de construção: (1) **rastreabilidade** — toda ação sensível grava em `audit_log` append-only, então "quem apagou o RDO?" tem resposta ([schema] `supabase/migrations/0006_audit_log.sql:5-17`); (2) **separação de funções (SoD)** — deletar/editar registros fechados não é imediato, vira uma `pending_action` que só outra pessoa com cargo adequado aprova ([schema] `0007_pending_actions.sql`; [código] `0012_rpcs.sql:99`); (3) **saída limpa do cliente** — o owner exporta um JSON completo da organização para portabilidade ou rescisão ([código] `ExportarDadosPage.tsx:19-40`).

Parte do módulo (Membros, Homologação, Adaptação Rápida) é **exclusiva da conta global** `joaoneryflu@gmail.com` — o e-mail está fixo em `src/lib/globalAdmin.ts:4` e validado por `isGlobalAdminUser(profile, user)`. As telas de Aprovações/Auditoria/Exportar/Matriz seguem controle por cargo (`owner`/`diretor`/`gerente`). [código]

## Para quem (papéis / persona)

- **Conta global (super-admin ConstruData)** — `GLOBAL_ADMIN_EMAIL` (`globalAdmin.ts:4`). Único que enxerga **Membros**, **Homologação** e **Adaptação Rápida**. No servidor, `is_global_admin()` dá a essa conta `user_role = 'owner'` e acesso a `user_org()` de qualquer tenant ([schema] `20260525190000_global_admin_all_org_access.sql:8-27`). Persona: time de implantação/suporte que faz onboarding e QA.
- **Owner da organização** — único que pode **Exportar dados** (`ExportarDadosPage.tsx:17`, reforçado na RPC `export_organization_data`, `0012_rpcs.sql:216`) e **editar a Matriz de aprovação** (`MatrizAprovacaoPage.tsx:43`).
- **Diretor / Gerente** (aprovadores) — aparecem na fila de **Aprovações** e só conseguem aprovar ações cujo `required_role` seja compatível com o seu cargo (`AprovacoesPage.tsx:84-86`; regra no servidor `0012_rpcs.sql:131-134`).
- **Qualquer membro autenticado** — pode ver a **Auditoria** da própria org (read-only) e é sujeito das regras de aprovação (suas exclusões críticas viram pendências).

## Funcionalidades detalhadas

### 1. Membros (`/app/membros` · `MembrosPage.tsx`)
Listagem **somente leitura** de quem está cadastrado na organização. [código]
- Gate de acesso: `isGlobalAdminUser` — não-global vê aviso "módulo exclusivo da conta global" (`MembrosPage.tsx:49-58`).
- Carrega os dados **reaproveitando a RPC** `export_organization_data(p_org_id)` e lendo `data.profiles` e `data.invitations` do JSON retornado (`MembrosPage.tsx:35-39`). Ou seja, a mesma função de portabilidade LGPD serve de fonte para a lista de membros.
- Tabela com colunas **Nome · E-mail · Cargo · Função · Status** (`MembrosPage.tsx:78-96`); status exibe "Ativo" se `activated_at` estiver preenchido, senão o campo `status`.
- Bloco **Convites pendentes** lista `invitations` (e-mail · role · status) quando houver (`MembrosPage.tsx:104-115`).
- Botão **Atualizar** re-executa `load()` (`MembrosPage.tsx:67`). O próprio texto orienta: para convidar/remover, usar o painel do Supabase ou suporte (`MembrosPage.tsx:65`) — não há CRUD de membro nesta tela. [código]

### 2. Aprovações pendentes (`/app/aprovacoes` · `AprovacoesPage.tsx`)
Fila das **ações críticas aguardando aprovação**. [código]
- Query direta em `pending_actions` filtrando `status = 'pending'`, ordenado por `created_at desc` (`AprovacoesPage.tsx:50-54`).
- Cada card mostra: rótulo humano do `action_type` (mapa `ACTION_LABELS`, `AprovacoesPage.tsx:26-39`), badge "requer: {required_role}", tabela e ID-alvo truncado, data de solicitação e data de expiração (`AprovacoesPage.tsx:104-123`).
- **Aprovar** → `supabase.rpc('approve_pending_action', { p_action_id })` (`AprovacoesPage.tsx:64`).
- **Rejeitar** → pede motivo via `window.prompt` e chama `reject_pending_action(p_action_id, p_reason)` (`AprovacoesPage.tsx:70-77`).
- Estado vazio: "Nenhuma ação pendente." (`AprovacoesPage.tsx:99`). Erros de RLS/servidor aparecem no topo (`AprovacoesPage.tsx:88-93`).
- Tipos de ação suportados no rótulo: `delete_fvs`, `update_fvs_closed`, `delete_rdo`, `update_rdo_closed`, `delete_po`, `update_po_approved`, `delete_invoice`, `delete_plan_scenario`, `delete_plan_trecho`, `approve_budget`, `delete_project`, `delete_organization` (`AprovacoesPage.tsx:26-39`).

### 3. Matriz de aprovação (`/app/configuracoes/aprovacoes` · `MatrizAprovacaoPage.tsx`)
Onde o **owner** define qual cargo aprova cada tipo de ação. [código]
- Gate: só `owner` (`MatrizAprovacaoPage.tsx:43,86-97`).
- Lê `organizations.settings.approval_matrix` (jsonb) da org ativa (`MatrizAprovacaoPage.tsx:48-57`).
- Um `<select>` por `action_type` com as opções de cargo **`gerente` · `diretor` · `owner`** (`MatrizAprovacaoPage.tsx:33,119-127`); default exibido = `diretor` (`MatrizAprovacaoPage.tsx:120`).
- **Salvar** faz merge do objeto atual de `settings` + `approval_matrix` e `update` em `organizations` (`MatrizAprovacaoPage.tsx:62-83`) — grava a hora do salvamento localmente para feedback.
- Lista de 12 `ACTION_TYPES` agrupada por "sprint/módulo" (Qualidade, RDO, Suprimentos, Planejamento, Globais) (`MatrizAprovacaoPage.tsx:13-31`).
- Regra reforçada no texto e no servidor: **o próprio solicitante nunca aprova** (`MatrizAprovacaoPage.tsx:104-107`).

### 4. Auditoria (`/app/auditoria` · `AuditoriaPage.tsx`)
Visualizador **read-only** do log imutável. [código]
- Lê as **últimas 200** linhas de `audit_log` ordenadas por `created_at desc` (`AuditoriaPage.tsx:26-32`).
- Colunas: **Quando · Ação · Tabela · Registro (12 chars) · Ator (8 chars)** (`AuditoriaPage.tsx:53-77`).
- Sem qualquer ação de edição/exclusão — a tabela é append-only por design (RLS bloqueia UPDATE/DELETE, [schema] `0006_audit_log.sql:29-30`).

### 5. Exportar dados / Portabilidade LGPD (`/app/exportar-dados` · `ExportarDadosPage.tsx`)
Baixa **todos os dados da organização em JSON**. [código]
- Gate: só `owner` (`ExportarDadosPage.tsx:17,42-56`), reforçado na RPC.
- Chama `export_organization_data(p_org_id)` e monta um `Blob` JSON com download automático nomeado `construdata-export-{orgId}-{YYYY-MM-DD}.json` (`ExportarDadosPage.tsx:23-34`).
- A tela lista o conteúdo do arquivo: organização (configs/plano/settings), profiles, convites, FVS, pending_actions e audit_log completo (`ExportarDadosPage.tsx:69-77`), e sinaliza que módulos futuros (RDO, Planejamento, Suprimentos, Mão-de-obra) serão adicionados (`ExportarDadosPage.tsx:78-80`).
- Uso previsto: rescisão de contrato, portabilidade LGPD, backup manual (`ExportarDadosPage.tsx:5`).

### 6. Homologação (`/app/homologacao` · `HomologacaoPage.tsx`)
Painel de **ambiente ativo e atalhos de QA** — exclusivo da conta global (`HomologacaoPage.tsx:30,37-51`). [código]
- Três cards de resumo: **Empresa ativa** (nome + role), **Ambiente** (Produção/Homologação/Demo, com cor por tom — `environmentTone`, `HomologacaoPage.tsx:13-17`) e **Vínculos ativos** (nº de memberships e quantos em homologação) (`HomologacaoPage.tsx:76-92`).
- Deriva o ambiente do `active membership.organization.environment`, default `production` (`HomologacaoPage.tsx:26-29`).
- Se a empresa ativa **não** é de homologação mas existem orgs de homologação nos vínculos, mostra botões **"Usar {org}"** que trocam de organização (`switchOrganization` + `window.location.reload()`) (`HomologacaoPage.tsx:94-115,32-35`).
- Botão **Atualizar vínculos** → `refreshProfile()` (`HomologacaoPage.tsx:67-73`).
- Atalhos rápidos para **RDO Sabesp** e **Medição** (rota de QA do fluxo RDO→Medição) (`HomologacaoPage.tsx:123-138`).

### 7. Adaptação Rápida — import por regras de PDF/XLSX/imagem/Fracttal (`/app/adaptacao-rapida` · `AdaptacaoRapidaPage.tsx`)
Onboarding de obra nova/antiga: sobe documentos, gera **diagnóstico do que existe, do que falta e para qual módulo cada dado vai**, e importa manutenções do Fracttal. Exclusivo da conta global (`AdaptacaoRapidaPage.tsx:494,869-883`). [código]
- **Upload** aceita `.pdf,.xlsx,.xls,.csv,image/*` múltiplos (`AdaptacaoRapidaPage.tsx:902-908`). A leitura é **determinística, sem IA/OCR**: PDF via `pdfjs-dist` (`extractPdfText`, `:217-227`), planilha via `xlsx` (`extractWorkbookText`, `:229-247`), imagem entra como evidência por regras de nome de arquivo (`analyzeImageEvidence`, `:396-441`). O próprio cabeçalho declara "regras programadas e leitura determinística" (`:895-897`).
- **Motor de análise** `analyzeText` (`:325-394`) roda regex sobre o texto normalizado e classifica em grupos ("Identificação da obra", "Quantitativos em m²/ml", "Etapas executivas", "Mão de obra", "Insumos/NF", "Fotos/qualidade", "Prazo/cronograma", "Financeiro"), preenchendo `found`, `destinations` e `rdoMappings`. Há regras especiais **Brasal** (`addBrasalStructuredData`, `:253-284`) e de **etapas de pintura/epóxi** (`addStageData`, `:286-303`), com percentuais e custos de mão de obra por etapa embutidos (`STAGE_PERCENTAGES`, `LABOR_COSTS`, `:127-148`).
- **Checklist de completude** — 12 itens obrigatórios (`REQUIRED_CHECKLIST`, `:69-82`); `buildMissing` (`:305-323`) calcula o que falta cruzando o texto encontrado com cada item.
- **Três cards de resumo**: Informações encontradas · Pendências · Módulos recomendados (`:912-916`).
- **Entrada manual rápida** (`:918-1005`): formulário para adicionar itens (título, detalhe, módulo destino, campo no RDO, "como lançar", obrigatório) com CRUD local (`addManualEntry`/`editManualEntry`/`removeManualEntry`, `:569-621`). Módulos destino e campos de RDO são listas fixas (`MANUAL_DESTINATION_OPTIONS`, `RDO_FIELD_OPTIONS`, `:96-125`).
- **Prévia Fracttal/Valore** (`:1044-1080`): quando um `.xlsx` é reconhecido como export Fracttal (`parseFracttalWorkbook`, `fracttalImport.ts`), mostra contadores de **Ativos · Planos · Monitoramento · OS · Pendentes** e o botão **Importar para Manutenções**.
- **Importação para Manutenções** `importFracttalToMaintenance` (`:698-837`): faz `pull()` do `useManutencoesStore`, e para cada ativo/plano/ponto de monitoramento/OS faz **upsert por código** (cria ou atualiza) chamando `addAsset/updateAsset`, `addPlan/updatePlan`, `addMonitoringPoint/updateMonitoringPoint`, `addWorkOrder/updateWorkOrder`. Vincula planos↔ativos e OS↔planos por chave normalizada (`keyForImport`, `:467-474`), e marca `leanLps.createLookahead` quando a OS está pendente (`:827`). Ao final faz novo `pull()` e reporta a contagem gravada "na empresa ativa".
- **Controle pelo RDO** (`:1082-1097`): traduz cada informação num mapeamento "campo do RDO ↔ como usar", com selo **nativo/adaptado/externo** (`support`).
- **Pacote para preencher módulos** (`moduleFillPlan`, `:517-567,1099-1129`): agrupa tudo por módulo destino (Projetos, Quantitativos, Medição, RDO, Suprimentos, Equipamentos/Manutenções, Gestão 360/EVM) como rascunho conferível antes de virar dado definitivo.
- **Salvar diagnóstico** `saveSession` (`:839-867`): grava em `quick_adaptation_sessions` (`organization_id`, `title`, `status:'draft'`, `source_summary`, `extracted_payload`, `checklist`, `created_by`).

### 8. Configurações da empresa (`companySettingsStore`)
Store de identidade visual/nome da empresa (sem página dedicada neste módulo, mas parte da governança de tenant). [código]
- `companyName` persiste em `organizations.settings.company_name` com debounce de 800ms (`companySettingsStore.ts:138-163`).
- Logos: `uploadLogo` faz upload ao bucket `project-documents/logos/` e enfileira insert em `company_logos`; `removeLogo` marca exclusão **com aprovação** (`approvalActionType: 'delete_company_logo'`, `companySettingsStore.ts:115`); `updateLogoName` faz patch (`:121-136`).

### 9. Modos de execução (`appModeStore` + `runtimeMode`)
Governa se o app mostra **dados reais** ou **dados demo**, e reconhece o **ambiente do tenant**. [código]
- `useAppModeStore.toggleDemoMode` (`appModeStore.ts:254-331`): ao **entrar** em demo, faz `snapshotUserData()` do localStorage de ~40 stores e carrega `loadDemoData()` em cada um; ao **sair**, `restoreUserData()` reidrata do snapshot (ou limpa e faz `pullRealData()`). Sem perda de dados reais.
- `runtimeMode.ts`: `getActiveOrganizationEnvironment()` lê `environment` do membership ativo (fallback por nome/slug contendo "homolog"/"demo") (`runtimeMode.ts:9-26`); `isNonProductionDataMode()` desliga sincronização real em demo/homologação.

## Dados que gera

| Entidade | Tabela / destino | Campos-chave | Origem (migração/código) |
|---|---|---|---|
| Ações críticas pendentes | `pending_actions` | `organization_id`, `requested_by`, `action_type`, `target_table`, `target_id`, `payload`, `required_role`, `status`, `approved_by`, `approved_at`, `rejected_reason`, `expires_at` (default `now()+7d`) | [schema] `0007_pending_actions.sql:6-21` |
| Trilha de auditoria | `audit_log` (bigserial, append-only) | `organization_id`, `actor_id`, `action`, `table_name`, `record_id`, `before`, `after`, `ip`, `user_agent`, `created_at` | [schema] `0006_audit_log.sql:5-17` |
| Convites | `invitations` | `organization_id`, `email` (citext), `role`, `invited_by`, `token` (unique), `accepted_at`, `expires_at`, + `accepted_by`/`revoked_at`/`membership_id` | [schema] `0005_invitations.sql`; `0047_memberships_and_invites.sql:38-45` |
| Vínculos usuário↔empresa | `memberships` | `organization_id`, `user_id`, `role` (default `visualizador`), `status` (`invited`/`active`/`blocked`/`left`), `blocked_at`/`block_reason` | [schema] `0047_memberships_and_invites.sql:4-19` |
| Ambiente do tenant | `organizations.environment` | `production` / `homologation` / `demo` (CHECK) + espelho em `settings.environment` | [schema] `0052_organization_environment.sql:3-21` |
| Matriz de aprovação | `organizations.settings.approval_matrix` (jsonb) | `{ action_type: role }` | [código] `MatrizAprovacaoPage.tsx:62-83`; lido por `required_approver_for` |
| Nome/identidade da empresa | `organizations.settings.company_name` + `company_logos` | `company_name`; logo: `organization_id`, `name`, `storage_path`, `payload`, `created_by` | [schema] `0032_sprint6_final.sql:197-206`; [código] `companySettingsStore.ts` |
| Diagnósticos de onboarding | `quick_adaptation_sessions` (+ `quick_adaptation_files`) | `organization_id`, `title`, `status` (`draft`/`reviewed`/`converted`/`archived`), `source_summary`, `extracted_payload`, `checklist`, `linked_project_id`, `created_by` | [schema] `20260513110000_quick_adaptation.sql:3-32` |
| Export completo (LGPD) | JSON efêmero (não persiste) | `organization`, `profiles`, `invitations`, `fvs`, `pending_actions`, `audit_log`, `exported_at`, `exported_by` | [código] RPC `export_organization_data`, `0012_rpcs.sql:220-229` |

## Cálculos, KPIs e regras de negócio

- **Cargo mínimo para aprovar** — `required_approver_for(action)` lê `settings.approval_matrix->>action`, com **fallback `'diretor'`** se a ação não estiver mapeada ([código] `0008_helpers.sql:28-38`). É esse valor que vira `pending_actions.required_role` no `request_action` (`0012_rpcs.sql:78-84`).
- **Separação de funções (SoD)** na aprovação (`approve_pending_action`, `0012_rpcs.sql:101-161`): valida (a) mesma organização (`42501` se cross-tenant), (b) `status = 'pending'`, (c) **não expirada** — se `expires_at < now()` marca `expired` e falha, (d) **requester ≠ aprovador** (`:127-129`), (e) o aprovador tem o `required_role` **ou** é `owner` (`:131-134`). Só então aplica o efeito por `CASE action_type` (hoje implementa `delete_fvs` = soft-delete e `update_fvs_closed`; demais tipos são aprovados com `RAISE NOTICE`, sem handler ainda, `:149-151`).
- **Expiração** — toda pending_action nasce com `expires_at = now() + 7 dias` (`0007_pending_actions.sql:19`).
- **Export só do owner + só da própria org** — `export_organization_data` levanta `42501` se `user_org() != p_org_id` ou se não `has_role('owner')` (`0012_rpcs.sql:212-218`), e **audita o próprio export** (grava `action='export'`, `:231-232`).
- **Filtro de aprovação no cliente** — a UI só permite aprovar ações cujo `required_role` seja "igual ou inferior ao seu" (`AprovacoesPage.tsx:84-86`); a decisão final é sempre revalidada no servidor.
- **Conta global = owner universal** — `is_global_admin()` (e-mail fixo `joaoneryflu@gmail.com`) faz `user_role()` retornar `'owner'` e `user_org()` resolver qualquer tenant ([schema] `20260525190000_global_admin_all_org_access.sql:8-40`).
- **Análise de documentos (Adaptação Rápida)** — não há cálculo financeiro real; a "confiança" é heurística fixa (0.72 para texto, 0.62 para imagem, ≥0.9 para Fracttal reconhecido — `AdaptacaoRapidaPage.tsx:392,439,671`). Percentuais/custos por etapa são **tabelas de referência hardcoded** (Brasal/epóxi), não derivados do arquivo. [código]

## Integrações — a "camada única"

**O que ALIMENTA (produz para outros):**
- **`audit_log`** é o coletor central: `signup_with_org`, `request_action`, `approve/reject_pending_action` e `export_organization_data` todos gravam nele ([código] `0012_rpcs.sql:48,86,158,194,231`), além dos handlers de e-mail (`0040_approval_email.sql:39,71`). Qualquer módulo que solicite ação crítica deixa rastro aqui.
- **`pending_actions`** é alimentado por **qualquer store** via `storeSync`: quando uma op de `delete` tem `approvalActionType`, o flush chama `request_action` em vez de deletar direto ([código] `src/lib/storeSync.ts:208-215`). Exemplo real: `companySettingsStore.removeLogo` usa `approvalActionType: 'delete_company_logo'` (`companySettingsStore.ts:115`). Assim Qualidade, RDO, Suprimentos, Planejamento etc. empurram suas exclusões críticas para a fila deste módulo.
- **Adaptação Rápida → Manutenções/Equipamentos**: escreve diretamente no `useManutencoesStore` (ativos, planos, monitoramentos, OS), fechando o onboarding de manutenção a partir de exports Fracttal (`AdaptacaoRapidaPage.tsx:698-837`).

**O que CONSOME:**
- **`useAuth`** (`profile`, `user`, `memberships`, `switchOrganization`, `refreshProfile`) em praticamente todas as telas — é a fonte de identidade/tenant/role.
- **`export_organization_data`** é reutilizada pela tela **Membros** como fonte de leitura (`MembrosPage.tsx:35`).

**Eventos / realtime / triggers:**
- **eventBus** (`src/lib/eventBus.ts`): não há evento de domínio específico de governança emitido por estas telas; o barramento é usado pelos módulos operacionais (rdo/po/fvs/lps/medição) que, indiretamente, geram as pendências que caem aqui. [código]
- **Realtime** (`src/lib/realtime.ts`): `pending_actions` e `audit_log` **não** estão em `WATCHED_TABLES` — as telas de Aprovações/Auditoria recarregam por `load()`/refresh manual, não por push. [código]
- **Edge Functions (fluxo de aprovação por e-mail):** `notify-approval` envia e-mail (Resend) ao aprovador quando uma pendência é criada, com botões Aprovar/Rejeitar que apontam para `handle-approval` (`supabase/functions/notify-approval/index.ts:1-6`); `handle-approval` valida o token e chama `approve_pending_action_service` / `reject_pending_action_service` com service_role (bypassa RLS porque o link não carrega sessão), retornando página HTML de confirmação (`supabase/functions/handle-approval/index.ts:1-7`; RPCs de serviço em `0040_approval_email.sql`). A página aponta de volta para `/app/aprovacoes`.
- **`admin-provision-company`** (edge function) provisiona empresas — parte do ciclo de vida de tenant/membros. [código]

## Eficiência gerada

- **Fim do "quem apagou isso?"** — trilha imutável em `audit_log` com ator, tabela, registro e timestamp reduz discussão em fechamento e disputa contratual. [inferido, sobre schema `0006_audit_log.sql`]
- **Governança sem trava operacional** — exclusões/edições de registros fechados viram fila de 2 pessoas (SoD) sem exigir integração externa; a matriz é editável pelo owner sem deploy (é só jsonb em `settings`). Aprovação inclusive **por e-mail**, sem abrir o app. [inferido, sobre `0012_rpcs.sql` + edge functions]
- **Portabilidade LGPD em 1 clique** — um JSON completo da org para rescisão/backup elimina export manual tabela a tabela. [inferido, sobre `ExportarDadosPage.tsx`]
- **Onboarding de obra existente sem replanilhar** — a Adaptação Rápida lê PDF/XLSX e diz "isto já existe, isto falta, isto vai para tal módulo", e importa manutenções Fracttal por upsert idempotente, transformando um acervo legado num rascunho estruturado por módulo. [inferido, sobre `AdaptacaoRapidaPage.tsx`]
- **Ambientes isolados (Produção/Homologação/Demo)** permitem QA e demonstração de vendas sem contaminar dados reais nem disparar sync — `isNonProductionDataMode()` corta a sincronização fora de produção. [inferido, sobre `runtimeMode.ts` + `appModeStore.ts`]

## Como sincroniza

- **Local-first + fila de ops:** `companySettingsStore` usa o padrão `pendingSync`/`flush`/`pull` do `storeSync` — grava local, enfileira e sobe; deletes sensíveis viram `request_action` em vez de DELETE direto (`storeSync.ts:208-215`). Persistência offline em localStorage (`cdata-company-settings`) com listener de `online` que re-tenta o flush (`companySettingsStore.ts:237-241`). [código]
- **Telas de leitura direta:** Aprovações, Auditoria, Membros, Matriz e Exportar **não** são local-first — fazem query/RPC ao Supabase a cada carga e dependem de conexão (não têm cache offline próprio). Aprovar/rejeitar e salvar matriz vão direto ao servidor. [código]
- **RLS / multi-tenant por `organization_id`:** todas as tabelas do módulo têm `organization_id` e RLS. As RPCs de governança são `SECURITY DEFINER SET search_path = public` e derivam a org via `user_org()`, barrando cross-tenant com `42501` (`0012_rpcs.sql:114-116,212-213`). `audit_log` tem RLS que **proíbe UPDATE/DELETE** para todos (`0006_audit_log.sql:29-30`). `quick_adaptation_sessions` restringe SELECT/INSERT/UPDATE a `owner`/`diretor` da org (`20260513110000_quick_adaptation.sql:53-96`).
- **Sync global de tenant:** ao logar/trocar de empresa, `syncAllTenantStores()` faz **flush antes do pull** (nunca sobrescreve local não sincronizado) e é **no-op em demo/homologação** (`appModeStore.ts:228-246,234-236`).
- **Realtime:** ausente para governança — `pending_actions`/`audit_log` não estão nas `WATCHED_TABLES`, então a fila de aprovações não atualiza sozinha entre usuários; é preciso recarregar. A notificação cross-usuário acontece por **e-mail** (edge functions), não por realtime. [código]
- **Conta global multi-org:** enxerga e troca para qualquer tenant sem membership por empresa, via override de `user_org()`/`user_role()` em `is_global_admin()` (`20260525190000_global_admin_all_org_access.sql`). [schema]
