# Qualidade (FVS e Não Conformidades)

> **Rota(s):** `/app/qualidade` ([código] `src/App.tsx:147`, lazy em `src/App.tsx:21`) · **Store(s):** `useQualidadeStore` (`src/store/qualidadeStore.ts`, chave localStorage `cdata-qualidade`) · **Grupo na sidebar:** **CAMPO** ([código] `src/components/shared/Sidebar.tsx:58`, ao lado de RDO e Mão de Obra)

## O que é / problema que resolve

O módulo Qualidade digitaliza dois documentos formais de gestão da qualidade em obra: a **FVS (Ficha de Verificação de Serviço)** e o **Registro de Não Conformidade (RNC/NC)**. A primeira funcionalidade implementada é a FVS de solda PEAD, espelhando pixel-a-pixel o formulário oficial **FOR-FVS-02 Rev 00** do Consórcio Integra (verificação de solda de tubulação de polietileno) — o comentário de topo de `src/features/qualidade/index.tsx:1-6` e `src/features/qualidade/components/NovaFvsPanel.tsx:1-13` deixam isso explícito. Cada FVS registra a inspeção item-a-item (conforme / não conforme / conforme após reinspeção), problemas encontrados com ações corretivas, fotos e as assinaturas de fechamento.

O problema concreto que resolve: em obras de infra/saneamento a FVS costuma viver em papel ou planilha solta, sem rastreabilidade e sem conexão com o resto do controle da obra. Aqui a FVS vira dado estruturado, versionado, exportável em PDF/CSV e — o ponto central — **quando uma FVS abre uma NC, o evento propaga automaticamente para o Planejamento (LPS) e para a Medição**, bloqueando pagamento de produção que está sob não conformidade ([código] `src/store/qualidadeStore.ts:29-53`). O módulo funciona local-first (localStorage + fila de sync), então o inspetor de campo preenche mesmo offline.

O `index.tsx` já sinaliza que "outras funcionalidades virão em iterações futuras (PIT, NC, etc.)" ([código] `src/features/qualidade/index.tsx:5`) — o Registro de NC autônomo (`quality_non_conformities`) já foi entregue; PIT (Plano de Inspeção e Testes) ainda não.

## Para quem (papéis / persona)

- **Inspetor / Técnico de Qualidade** — preenche a FVS em campo, marca conformidade item-a-item, anexa fotos e abre NC quando necessário.
- **Engenheiro de campo / Líder Responsável** — assina o fechamento da FVS (campo "Líder Responsável", obrigatório) e trata as não conformidades.
- **Responsável da Qualidade** — assina o bloco de fechamento (campo "Assinatura Resp. Qualidade") e gerencia o ciclo de vida das NCs (aberta → em tratamento → concluída / ineficaz).
- **Gerente / Diretor / Owner** — aprovam a exclusão de FVS (fluxo de aprovação, ver abaixo) e têm permissão de edição ampla via RLS.

As políticas RLS restringem INSERT de FVS e de NC aos papéis `engenheiro`, `qualidade`, `gerente`, `diretor`, `owner` ([schema] `supabase/migrations/0011_qualidade_rls.sql:14-21` e `0042_quality_non_conformities.sql:44-51`).

## Funcionalidades detalhadas

O módulo tem um cabeçalho fixo (`QualidadeHeader`) com 4 abas ([código] `src/features/qualidade/components/QualidadeHeader.tsx:7-12`) e ações globais, mais o roteamento por aba em `src/features/qualidade/index.tsx:17-25`.

### Cabeçalho / ações globais (`QualidadeHeader.tsx`)
- **Configurar Logo** — abre o `LogoConfigModal` reaproveitado do módulo RDO ([código] `QualidadeHeader.tsx:103`, `156`), permitindo escolher a logomarca que sai nos PDFs.
- **Nova FVS** e **Não Conformidade** — atalhos que trocam a aba ativa.
- **Exportar CSV** — gera um CSV único (com BOM UTF-8) combinando FVS e NCs, com colunas Tipo, Número, Identificação, Contrato, Data, Responsável, Itens Conformes, Itens Não Conformes, NC Aberta, Nº NC ([código] `QualidadeHeader.tsx:29-85`). Há sanitização anti-CSV-injection: células que começam com `= + - @` recebem prefixo `'` e há filtro de caracteres de controle ([código] `QualidadeHeader.tsx:14-23`).

### Aba "Dashboard" (`DashboardPanel.tsx`)
Visão de KPIs calculada em memória sobre `fvss` + `nonConformities` ([código] `DashboardPanel.tsx:41-64`):
- **Total de FVS** — contagem de fichas.
- **Taxa de Conformidade** — `(conformes + reinspecao_ok) / totalItems` arredondado ([código] `DashboardPanel.tsx:59-61`).
- **Não Conformidades** — soma de itens `nao_conforme` + registros de NC autônomos ([código] `DashboardPanel.tsx:91-92`).
- **NCs Abertas** — FVSs com `ncRequired=true` + NCs cujo status ≠ `concluida` ([código] `DashboardPanel.tsx:57-58`).
- **Barra de Distribuição de Conformidade** — barra segmentada verde/azul/vermelha proporcional aos itens conforme / reinspeção OK / não conforme ([código] `DashboardPanel.tsx:106-148`).
- **FVS Recentes** — as 5 últimas por data, com badge de NC quando aplicável ([código] `DashboardPanel.tsx:66-69`, `150-191`).

### Aba "+ Nova FVS" (`NovaFvsPanel.tsx`)
Formulário que reproduz o FOR-FVS-02:
- **Seletor de logo** para o PDF (opcional, lista logos do `companySettingsStore`) ([código] `NovaFvsPanel.tsx:352-388`).
- **Cabeçalho editável** — Código (default `FOR-FVS-02`), Rev (`00`), Nº Identificação FVS (auto: `FVS-00N/ANO`), Contrato (default `00.954/24`), Data (hoje) ([código] `NovaFvsPanel.tsx:149-153`, `391-467`).
- **Tabela principal de 9 itens fixos**, em 2 grupos ([schema/código] `src/features/qualidade/schemas.ts:42-56`):
  - *Verificação de Solda PEAD* (itens 1-4): Condições do Local, Inspeção dos Tubos, Cód. Rastreio dos Tubos, Alinhamento da Máquina.
  - *Controle de Parâmetros de Solda* (itens 5-9): Temperatura da Placa, Tempo de Aquecimento, Pressão de Fusão, Tempo de Resfriamento, Inspeção Visual da Solda.
  - Cada linha tem: critério de aceitação (texto livre), 3 checkboxes mutuamente exclusivos (Conforme / Não conforme / Conforme após reinspeção) e a data da verificação ([código] `NovaFvsPanel.tsx:79-139`). Clicar de novo no mesmo checkbox desmarca (volta a `null`).
- **Descrição do Problema e Ações de Adequação** — lista dinâmica de problemas; cada problema referencia um item (1-9), tem descrição, ação corretiva e **até 6 fotos** comprimidas ([código] `NovaFvsPanel.tsx:188-218`, `508-627`).
- **Linha de NC** — checkbox SIM/NÃO ("Necessário abertura de NC") + campo Nº Não Conformidade (habilitado só quando SIM) ([código] `NovaFvsPanel.tsx:629-661`).
- **Fechamento da FVS** — 4 campos: Líder Responsável (obrigatório), Nº de rastreio da solda, Assinatura soldador, Assinatura Resp. Qualidade ([código] `NovaFvsPanel.tsx:663-710`).
- **Registros Fotográficos** — até **10 fotos** gerais da execução, comprimidas via `compressImage` ([código] `NovaFvsPanel.tsx:238-252`, `712-772`).
- **Validações no submit** ([código] `NovaFvsPanel.tsx:254-312`): identificação, contrato, data e Líder obrigatórios; pelo menos 1 item com conformidade decidida; se NC marcada, Nº NC obrigatório; anti-double-submit por flags `isSubmitting`/`submitSuccess`. Ao salvar, chama `addFvs`, reseta o form e navega para o Histórico após 1,5s.
- **Pré-visualizar PDF** — monta um objeto FVS temporário (id `'preview'`, sem persistir) e abre a janela de impressão A4 via `printFvsPDF` ([código] `NovaFvsPanel.tsx:314-347`; export em `src/features/qualidade/utils/fvsPdfExport.ts`).

### Aba "+ Não Conformidade" (`NaoConformidadePanel.tsx`)
Formulário do **Registro de Não Conformidade (FOR-Q-01)** — entidade própria, independente da FVS ([código] `NaoConformidadePanel.tsx`; seções em `168`, `183`, `247`, `268`):
- **Cabeçalho** — Código (default `for-q-01`), Rev, Responsável pela abertura da RNC (obrigatório).
- **Identificação da Frente** — Empresa (default = nome da empresa), Eng. responsável, Localização (obrigatória).
- **Não Conformidade** — Nº NC (auto, padStart 2 dígitos), Data, LV Nº (default `NA`), Local, Descrição (obrigatória), Requisito não atendido.
- **Evidência objetiva** — até **12 fotos** comprimidas ([código] `NaoConformidadePanel.tsx:91-105`, `207-245`).
- **Plano de Ação** — Ação imediata, Prazo, Responsável, Ação corretiva, Data.
- **Avaliação de Eficácia** — Responsável, **Status** (`aberta` / `em_tratamento` / `concluida` / `ineficaz` — `NaoConformidadePanel.tsx:15-20`), Data final.
- **Pré-visualizar PDF** via `printQualityNonConformityPDF` e **Salvar NC** (validação em `NaoConformidadePanel.tsx:107-115`; navega para Histórico após 900ms).

### Aba "Histórico Qualidade" (`HistoricoPanel.tsx`)
Lista unificada de FVS + NCs em cards expansíveis ([código] `HistoricoPanel.tsx:71-108`):
- **Filtro por obra ativa** — quando há obra selecionada (`activeObraStore.activeObraId`), filtra por `siteId` ([código] `HistoricoPanel.tsx:63`, `73-74`).
- **Busca textual** (responsável, identificação, contrato, Nº NC, localização, empresa, descrição…) e **filtro por data** ([código] `HistoricoPanel.tsx:80-108`).
- **Card de FVS** — badge `FVS #N`, badge de NC quando `ncRequired`, contadores conformes/não-conformes/reinspeção, botão PDF, excluir. Expandido mostra a tabela de itens com badges de conformidade, os problemas/ações com fotos, e os dados de fechamento ([código] `HistoricoPanel.tsx:325-428`).
- **Card de NC** — badge, status colorido, contador de evidências, botão para **adicionar/trocar/remover evidências direto do histórico** (via `updateNonConformity`, `HistoricoPanel.tsx:118-156`, `234-321`), botão PDF, excluir. Expandido mostra descrição, ações imediata/corretiva e avaliação.
- **Exclusão** — pede confirmação inline; FVS chama `removeFvs` (que dispara aprovação — ver "Como sincroniza"), NC chama `removeNonConformity` ([código] `HistoricoPanel.tsx:112-116`).

## Dados que gera

### Tabela `public.fvs` ([schema] `supabase/migrations/0010_qualidade.sql`)
Modelo **desnormalizado v1**: itens e problemas moram em `payload jsonb`. Campos-chave:
- `organization_id` (FK, multi-tenant), `number` (sequencial por org, único — `fvs_unique_number_per_org`), `document_code`, `revision`, `identification_no`, `contract_no`, `date`.
- `nc_required boolean`, `nc_number`.
- Fechamento: `responsible_leader`, `weld_tracking_no`, `welder_signature`, `quality_signature`, `logo_id`.
- `payload jsonb` = `{ items: FvsItem[], problems: FvsProblemAction[], fotos: string[] }` ([código] `src/store/qualidadeStore.ts:73`, `144`).
- `closed boolean` (true após assinatura final — trava edição direta), `site_id` (obra), `created_by`, `created_at`, `updated_at`, `deleted_at` (soft delete).
- Índices multi-tenant: `idx_fvs_org`, `idx_fvs_org_created`, `idx_fvs_org_active` (parcial, `deleted_at IS NULL`), `idx_fvs_org_contract` ([schema] `0010_qualidade.sql:42-45`).

O tipo cliente `FVS` está em `src/types/index.ts:1743-1766`; o item em `1725-1733` e o problema/ação em `1735-1741`.

### Tabela `public.quality_non_conformities` ([schema] `supabase/migrations/0042_quality_non_conformities.sql`)
- `organization_id`, `number` (único por org), `nc_number`, `date`, `location`, `status` (CHECK `aberta|em_tratamento|concluida|ineficaz` — `0042:11-12`), `site_id`.
- `payload jsonb` guarda o restante do formulário (openedBy, company, engineerResponsible, evidencePhotos, immediateAction, correctiveAction, effectiveness…, mapeado em `src/store/qualidadeStore.ts:165-188`).
- `created_by`, timestamps e `deleted_at`. Índices `idx_quality_nc_org`, `_org_date`, `_org_status`, `_org_active`.

O tipo cliente `QualityNonConformity` está em `src/types/index.ts:1770-1797`.

### Tabela `public.measurement_quality_flags` ([schema] `supabase/migrations/0048_rdo_quality_measurement_sync.sql:25-44`)
Gerada **pelo servidor** (não pelo cliente do módulo) quando uma NC é criada/alterada — liga a NC a uma linha de medição sem apagar a produção já medida. Campos: `nc_id` (FK), `source_id` (FK measurement_sources), `rdo_id`, `rdo_type`, `service_code`, `status` (`pending|blocked|released|rejected|glosa_review`), `severity`, `note`, `payload`.

## Cálculos, KPIs e regras de negócio

- **Taxa de Conformidade** = `round((conformes + reinspecao_ok) / totalItems × 100)` ([código] `DashboardPanel.tsx:59-61`). Note que "conforme após reinspeção" conta como aprovado.
- **NCs Abertas** = FVSs com `ncRequired` + NCs com `status ≠ concluida` ([código] `DashboardPanel.tsx:57-58`).
- **Numeração sequencial** por organização, calculada no cliente via `max(number)+1` ([código] `qualidadeStore.ts:244-245`, `299-300`; a constraint UNIQUE por org garante integridade no servidor).
- **Regra "RDO não fecha com FVS pendente"** ([código] `src/store/crossModuleSync.ts:61-95`): `checkPendingFvsForDate(date)` marca uma FVS como pendente se a data bate e existe item com `conformity === null`; `getCompletedFvsForDate` retorna as FVS totalmente decididas do dia (para o RDO mostrar "FVS realizadas hoje: X").
- **NC vira restrição no LPS** ([código] `crossModuleSync.ts:171-191`): `getOpenNcsAsRestrictions()` transforma cada FVS com `ncRequired && ncNumber` numa restrição lógica (descrição derivada do 1º problema).
- **Mapeamento status NC → status de medição** (regra de servidor, [schema] `0048:87-113`):
  - `aberta` → source `blocked_by_nc` / flag `blocked`
  - `em_tratamento` → `pending_quality` / `pending`
  - `concluida` → `released` / `released`
  - `ineficaz` → `glosa_review` / `glosa_review`
- **Detecção de NC nova** ([código] `qualidadeStore.ts:29-53`): `emitNcEventsIfAny` só emite eventos quando `ncRequired && ncNumber` passa de ausente para presente (evita re-emitir em cada update).

## Integrações — a "camada única"

**O que ALIMENTA (produz para fora):**
- **Eventos do eventBus** ([código] `src/lib/eventBus.ts:44-48`): ao criar/atualizar uma FVS que abre NC, o store emite `fvs.nc_opened` e `quality.blocked` (com `operationalKey` construída de contrato/obra/local/período — `qualidadeStore.ts:33-52`, `buildOperationalKey`).
  - **LPS** escuta `fvs.nc_opened` e re-puxa suas restrições ([código] `src/store/lpsStore.ts:620-622`) — a NC aparece no Constraint Register sem F5.
  - **Medição Unificada** escuta `quality.blocked` e `quality.released` e recarrega ([código] `src/store/medicaoUnificadaStore.ts:731-736`).
- **Trigger de servidor** `trg_quality_nc_measurement_sync` na tabela `quality_non_conformities` ([schema] `0048:540-545`) → executa `sync_quality_nc_to_measurement(nc_id)` ([schema] `0048:362-488`): cria/atualiza um `measurement_quality_flag` e marca a `measurement_source` correspondente com o `quality_status` derivado do status da NC, tudo registrado em `audit_log`. É assim que uma NC **bloqueia o pagamento** da produção associada sem apagar o que já foi medido.
- **CSV/PDF** — exportações para uso externo (auditoria, cliente/consórcio).

**O que CONSOME (lê de outros módulos):**
- `companySettingsStore` — logos e nome da empresa para o cabeçalho/PDF ([código] `NovaFvsPanel.tsx:145`, `NaoConformidadePanel.tsx:47`).
- `activeObraStore` — obra ativa para carimbar `siteId` em novas FVS/NC ([código] `qualidadeStore.ts:251`, `306`) e para filtrar o histórico ([código] `HistoricoPanel.tsx:63`).
- `LogoConfigModal` do módulo RDO (reuso de componente — `QualidadeHeader.tsx:4`).

**Funções cross-module centralizadas** em `src/store/crossModuleSync.ts` (o "guardião da ontologia unificada"): integrações Qualidade↔RDO (#Q5), Qualidade↔LPS (#Q8) e `getCrossModuleHealth()` que reporta FVS pendentes e NCs abertas do dia ([código] `crossModuleSync.ts:243-253`).

**Realtime** — a tabela `fvs` está na lista de tabelas observadas (`WATCHED_TABLES`) do wrapper de Supabase Realtime ([código] `src/lib/realtime.ts:43`); mudanças viram `realtime.row_changed` no eventBus interno (a tabela `quality_non_conformities` **não** está nessa lista — a propagação da NC acontece pelos eventos de domínio e pelo trigger de servidor).

## Eficiência gerada

- **Fim da FVS em papel/planilha** [inferido] — o formulário oficial vira dado estruturado, versionado por organização e recuperável, com PDF idêntico ao modelo do consórcio para entregar ao cliente.
- **Bloqueio automático de pagamento sob NC** [código] — a NC propaga para a Medição via trigger e via eventos, marcando a produção como `blocked_by_nc`/`pending_quality` sem intervenção manual. Isso elimina a planilha paralela de "o que pode faturar" e reduz risco de pagar serviço não conforme.
- **NC como restrição de planejamento em tempo real** [código] — o LPS re-puxa e mostra a restrição assim que a FVS abre a NC, conectando qualidade e cronograma.
- **Dado único / rastreabilidade** [inferido] — número sequencial por org, `audit_log` nas sincronizações de qualidade, soft delete e fluxo de aprovação para exclusão dão trilha auditável ponta a ponta.
- **Preenchimento em campo, inclusive offline** [código] — mutações otimistas + fila de sync permitem inspecionar sem conexão; sincroniza ao voltar online.
- **Fotos comprimidas embutidas** [código] — evidências vão no próprio registro (até 6 por problema, 10 na FVS, 12 na NC), sem depender de anexos soltos.

## Como sincroniza

**Local-first com fila otimista** ([código] `src/store/qualidadeStore.ts`):
- Toda mutação (`addFvs`, `updateFvs`, `removeFvs`, `addNonConformity`, `updateNonConformity`, `removeNonConformity`) aplica no estado local imediatamente e enfileira um `PendingOp` em `pendingSync`, então chama `flush()` ([código] `qualidadeStore.ts:242-342`).
- **Persistência** via `persist` do Zustand na chave `cdata-qualidade` (partializa `fvss`, `nonConformities`, `pendingSync`, `lastSyncedAt` — `qualidadeStore.ts:536-544`), funcionando como cache offline.
- **`flush()`** ([código] `qualidadeStore.ts:348-484`): pula sync em modo não-produção; marca `offline` se `!navigator.onLine`; marca `unauth` sem sessão; drena a fila fazendo INSERT/UPDATE/soft-DELETE em `fvs` e `quality_non_conformities`. Retry por op até 5 tentativas antes de descartar com `syncError`.
- **`pull()`** ([código] `qualidadeStore.ts:486-534`): recarrega FVS e NCs da org (`deleted_at IS NULL`, ordenados). É chamado no bootstrap ao carregar/trocar de organização ([código] `src/store/appModeStore.ts:211`, `242`).
- **Auto-flush ao voltar online** — listener de `window 'online'` ([código] `qualidadeStore.ts:549-553`).

**Multi-tenant / RLS** ([schema] `0011_qualidade_rls.sql`, `0042_quality_non_conformities.sql`):
- SELECT: só a própria org e não soft-deleted.
- INSERT: papéis `engenheiro|qualidade|gerente|diretor|owner` e `created_by = auth.uid()`.
- UPDATE (FVS): autor ou gerente+, apenas enquanto `closed = false` e não deletada; FVS fechada só muda via RPC de aprovação.
- **DELETE bloqueado por RLS** (`USING (false)`): a exclusão de FVS não é um DELETE direto — o cliente chama `supabase.rpc('request_action', { p_action_type: 'delete_fvs', p_target_table: 'fvs', ... })` ([código] `qualidadeStore.ts:453-462`), que cria uma `pending_action` exigindo aprovação de papel `diretor` (default configurável por org — [schema] `0003_organizations.sql:16`). Ao aprovar, a RPC seta `deleted_at` na FVS ([schema] `supabase/migrations/0028_grupo_nucleo_rpcs.sql:99-100`). Como a remoção local é otimista, se a aprovação for negada o próximo `pull()` re-traz o registro ([código] `qualidadeStore.ts:284-286`).

**Realtime** — a tabela `fvs` é observada globalmente por organização (`src/lib/realtime.ts`), emitindo `realtime.row_changed` no eventBus; a coalescência de ~350ms evita re-pulls em rajada. A sincronização de qualidade→medição roda no servidor via triggers `SECURITY DEFINER` com escrita em `audit_log`.
