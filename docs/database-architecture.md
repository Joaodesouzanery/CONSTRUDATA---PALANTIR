# Arquitetura de Banco de Dados — Atlântico

> **Status:** Planejamento (não implementado ainda)
> **Data:** 2026-04-07
> **Stack-alvo:** Supabase (PostgreSQL 15+) com Auth, Row Level Security e Realtime
> **Escala-alvo:** 10.000 clientes simultâneos
> **Modelo:** Multi-tenant com isolamento por organização + hierarquia interna por empresa

Este documento é a fonte de verdade da arquitetura de dados antes da migração de
in-memory/localStorage para Supabase. Aprovação dele desbloqueia a implementação.

---

## Sumário

1. [Princípios fundamentais](#1-princípios-fundamentais)
2. [Modelo multi-tenant](#2-modelo-multi-tenant)
3. [Hierarquia, perfis e permissões](#3-hierarquia-perfis-e-permissões)
4. [Workflow de aprovação para ações críticas](#4-workflow-de-aprovação-para-ações-críticas)
5. [Schema completo (tabelas)](#5-schema-completo-tabelas)
6. [Row Level Security (RLS)](#6-row-level-security-rls)
7. [Estratégia local-first + sync](#7-estratégia-local-first--sync)
8. [Backup e disaster recovery](#8-backup-e-disaster-recovery)
9. [Performance para 10k clientes](#9-performance-para-10k-clientes)
10. [Segurança ponta-a-ponta](#10-segurança-ponta-a-ponta)
11. [Plano de migração faseado](#11-plano-de-migração-faseado)

---

## 1) Princípios fundamentais

| # | Princípio | Implicação técnica |
|---|---|---|
| **P1** | **Tenant isolation desde a primeira linha** | Toda tabela tem `organization_id NOT NULL`. RLS policies forçam o filtro automaticamente. Zero queries sem `organization_id`. |
| **P2** | **Princípio do menor privilégio** | Cada role recebe só o que precisa. Diretor pode tudo; engenheiro só lê e cria certos tipos. |
| **P3** | **Soft-delete por padrão, hard-delete só por diretor** | Toda exclusão é marcada como `deleted_at = now()`. Recuperação trivial em 30 dias. Hard-delete manual e auditado. |
| **P4** | **Local-first, eventually consistent** | Zustand persist (localStorage) é a fonte primária do UI. Sync com Supabase em background. Offline funciona. |
| **P5** | **Audit trail em tudo** | `created_by`, `updated_by`, `created_at`, `updated_at` em **todas** as tabelas. Eventos críticos registrados em `audit_log`. |
| **P6** | **Aprovação humana para mudanças críticas** | Edição/exclusão de FVS, RDO assinado, baseline de planejamento e orçamento aprovado exigem aprovação de role superior. |
| **P7** | **RLS no banco, nunca só no client** | Toda regra de autorização vive em SQL (Postgres policies). O frontend não decide quem pode o quê — só renderiza o que recebe. |
| **P8** | **Backup é não-negociável** | Snapshot diário automático + point-in-time recovery + export semanal para storage redundante. |

---

## 2) Modelo multi-tenant

### Por que `organization_id` em vez de schemas separados

| Abordagem | Prós | Contras |
|---|---|---|
| **Schema por tenant** | Isolamento físico forte | Migrations 10k vezes, joins cross-tenant impossíveis, complexidade altíssima |
| **Database por tenant** | Isolamento máximo | Custo: pagar 10k bancos, impossível na prática |
| **`organization_id` + RLS** ✅ | 1 banco, 1 schema, queries simples, escala bem | Exige rigor: TODO insert precisa do tenant_id correto, RLS precisa estar 100% certo |

**Decisão:** **`organization_id` + RLS** é o padrão Supabase oficial e o que escala melhor para 10k tenants.

### Modelo de organizações

```
organizations
├── id (uuid pk)
├── name
├── slug (unique, ex: "construtora-abc")
├── plan ('starter' | 'pro' | 'enterprise')
├── max_users
├── max_projects
├── created_at
├── owner_id (fk → profiles.id)
└── settings (jsonb — branding, logos, BDI default, etc.)

profiles (extension de auth.users)
├── id (uuid pk = auth.users.id)
├── organization_id (fk → organizations.id)
├── full_name
├── email
├── role ('owner' | 'diretor' | 'gerente' | 'engenheiro' | 'qualidade' | 'comprador' | 'planejador' | 'visualizador')
├── job_title
├── phone
├── avatar_url
├── invited_by (fk → profiles.id)
├── invited_at
├── activated_at
├── last_seen_at
└── deleted_at (soft delete)
```

**Cada usuário pertence a UMA organização.** Se uma pessoa trabalha em 2 empresas, ela tem 2 contas (uma por email da empresa). É o modelo padrão de SaaS B2B.

---

## 3) Hierarquia, perfis e permissões

### Roles definidas (enum em Postgres)

```sql
CREATE TYPE user_role AS ENUM (
  'owner',         -- dono da conta, único que pode deletar a organização
  'diretor',       -- C-level, aprova tudo
  'gerente',       -- gerente de obra, aprova FVS e RDO
  'engenheiro',    -- engenheiro de campo, cria RDO/FVS, edita os próprios
  'qualidade',     -- responsável de qualidade, abre/fecha NCs
  'planejador',    -- mexe em planejamento e cronograma
  'comprador',     -- mexe em suprimentos
  'visualizador'   -- read-only (auditor externo, cliente)
);
```

### Matriz de permissões (alto nível)

| Recurso \ Ação | Visualizador | Engenheiro | Qualidade | Comprador | Planejador | Gerente | Diretor | Owner |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Ver** todos os módulos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Criar** RDO | — | ✅ | — | — | — | ✅ | ✅ | ✅ |
| **Editar** RDO próprio (mesmo dia) | — | ✅ | — | — | — | ✅ | ✅ | ✅ |
| **Editar** RDO de outro / antigo | — | — | — | — | — | 🟡 aprovação | ✅ | ✅ |
| **Excluir** RDO | — | — | — | — | — | 🟡 aprovação | ✅ | ✅ |
| **Criar** FVS | — | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| **Editar** FVS própria (24h) | — | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| **Editar** FVS após 24h | — | — | — | — | — | 🟡 aprovação | ✅ | ✅ |
| **Excluir** FVS | — | — | — | — | — | — | ✅ | ✅ |
| **Abrir/fechar** NC | — | — | ✅ | — | — | ✅ | ✅ | ✅ |
| **Salvar baseline** Plan. Mestre | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| **Aprovar** orçamento | — | — | — | — | — | 🟡 aprovação | ✅ | ✅ |
| **Editar** orçamento aprovado | — | — | — | — | — | — | 🟡 aprovação | ✅ |
| **Convidar** usuário | — | — | — | — | — | ✅ | ✅ | ✅ |
| **Mudar role** de usuário | — | — | — | — | — | — | ✅ | ✅ |
| **Excluir** organização | — | — | — | — | — | — | — | ✅ |

🟡 = ação cria um `pending_action` e fica aguardando aprovação de role superior.

### Função SQL para checar permissões

```sql
-- Helper: pega a role do usuário corrente
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role
LANGUAGE sql STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Helper: pega a organization_id do usuário corrente
CREATE OR REPLACE FUNCTION auth.user_org()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: verifica se a role está em pelo menos uma das permitidas
CREATE OR REPLACE FUNCTION auth.has_role(allowed user_role[])
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT auth.user_role() = ANY (allowed)
$$;
```

---

## 4) Workflow de aprovação para ações críticas

### A tabela `pending_actions`

```sql
CREATE TABLE pending_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  action_type     text NOT NULL,                  -- 'edit_fvs' | 'delete_rdo' | 'approve_budget' | etc.
  resource_table  text NOT NULL,                  -- 'fvs' | 'rdo' | 'orcamento'
  resource_id     uuid NOT NULL,
  payload         jsonb NOT NULL,                 -- a mudança proposta (diff ou novo estado)
  reason          text,                           -- justificativa do solicitante
  requested_by    uuid NOT NULL REFERENCES profiles(id),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  required_role   user_role NOT NULL,             -- role mínima que pode aprovar
  status          text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'expired'
  reviewed_by     uuid REFERENCES profiles(id),
  reviewed_at     timestamptz,
  review_notes    text,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_pending_actions_org_status ON pending_actions(organization_id, status);
CREATE INDEX idx_pending_actions_required_role ON pending_actions(required_role) WHERE status = 'pending';
```

### Fluxo

1. **Engenheiro** clica em "Editar FVS" de uma FVS de 3 dias atrás
2. Frontend chama RPC `request_fvs_edit(fvs_id, new_payload, reason)`
3. RPC cria um `pending_action` com `required_role = 'gerente'` e dispara realtime para todos os gerentes da org
4. **Gerente** vê notificação na UI ("1 ação aguardando sua aprovação")
5. Abre o painel `/app/aprovacoes`, vê o diff lado a lado (atual vs. proposta), justificativa, autor
6. Clica **Aprovar** → RPC `approve_pending_action(id)` aplica o payload e marca como `approved`
7. Ou clica **Rejeitar** → status `rejected` + `review_notes`
8. **Engenheiro** recebe notificação do resultado

### Por que essa abordagem (e não permitir o write direto e rollback)

- **Transparência total**: cada mudança crítica fica auditada com solicitante, aprovador, justificativa e resultado
- **Compliance** (ISO 9001, CONAMA, contratos públicos): o auditor pode pedir o histórico de aprovações de qualquer FVS
- **Segurança**: nem o engenheiro nem o atacante (caso conta seja invadida) consegue mexer em registros antigos sem o segundo par de olhos
- **Reversibilidade**: aprovações não-aplicadas ainda estão na tabela — fácil revisitar

### RPC SQL do approve

```sql
CREATE OR REPLACE FUNCTION approve_pending_action(p_action_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action pending_actions%ROWTYPE;
  v_user_role user_role;
BEGIN
  -- Carrega a ação
  SELECT * INTO v_action FROM pending_actions WHERE id = p_action_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ação não encontrada'; END IF;
  IF v_action.status != 'pending' THEN RAISE EXCEPTION 'Ação já processada (status: %)', v_action.status; END IF;

  -- Tenant check: aprovador na mesma org
  IF v_action.organization_id != auth.user_org() THEN
    RAISE EXCEPTION 'Acesso negado: organização diferente';
  END IF;

  -- Role check: aprovador tem role suficiente
  v_user_role := auth.user_role();
  IF NOT (v_user_role = ANY(ARRAY['gerente'::user_role, 'diretor', 'owner'])) THEN
    RAISE EXCEPTION 'Acesso negado: role insuficiente (% requerido)', v_action.required_role;
  END IF;

  -- Auto-aprovação proibida (não pode aprovar a própria solicitação)
  IF v_action.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode aprovar uma ação solicitada por você mesmo';
  END IF;

  -- Aplica a ação (dispatch por tipo)
  CASE v_action.action_type
    WHEN 'edit_fvs' THEN
      UPDATE fvs SET
        items = v_action.payload->'items',
        problems = v_action.payload->'problems',
        updated_at = now(),
        updated_by = v_action.requested_by
      WHERE id = v_action.resource_id;
    WHEN 'delete_rdo' THEN
      UPDATE rdo SET deleted_at = now(), updated_by = auth.uid()
      WHERE id = v_action.resource_id;
    -- ... outros tipos
  END CASE;

  -- Marca como aprovada
  UPDATE pending_actions SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_action_id;

  -- Audit log
  INSERT INTO audit_log (organization_id, user_id, action, resource_table, resource_id, payload)
  VALUES (v_action.organization_id, auth.uid(), 'approve_' || v_action.action_type,
          v_action.resource_table, v_action.resource_id, v_action.payload);
END;
$$;
```

---

## 5) Schema completo (tabelas)

> Todas as tabelas têm: `id uuid PK`, `organization_id uuid NOT NULL`, `created_at`, `updated_at`,
> `created_by uuid REFERENCES profiles(id)`, `updated_by uuid REFERENCES profiles(id)`,
> `deleted_at timestamptz` (soft delete).

### Núcleo (multi-tenancy + auth)

| Tabela | Propósito |
|---|---|
| `organizations` | Empresas clientes (tenants) |
| `profiles` | Usuários, role, dados pessoais (extends `auth.users`) |
| `invitations` | Convites pendentes para novos usuários |
| `audit_log` | Log de toda ação crítica (read-only após insert) |
| `pending_actions` | Ações aguardando aprovação humana (workflow) |

### Projetos e Obras

| Tabela | Propósito |
|---|---|
| `projects` | Projetos / contratos da organização |
| `construction_sites` | Obras (Torre de Controle) — endereço, lat/lng, status, gerente |
| `site_milestones` | Marcos contratuais por obra |
| `site_risks` | Riscos identificados por obra (Torre de Controle) |
| `site_budget_lines` | Linhas de orçamento contratual macro por obra |

### Operação de campo

| Tabela | Propósito |
|---|---|
| `rdo` | Relatórios Diários de Obra |
| `rdo_photos` | Fotos do RDO (ou URL para storage Supabase) |
| `rdo_equipment_entries` | Equipamentos no RDO |
| `rdo_service_entries` | Serviços executados no RDO |
| `rdo_trecho_entries` | Avanço por trecho no RDO |

### Qualidade

| Tabela | Propósito |
|---|---|
| `fvs` | Ficha de Verificação de Serviço (cabeçalho) |
| `fvs_items` | Itens da FVS (1..N por FVS) |
| `fvs_problems` | Problemas e ações corretivas |
| `non_conformities` | NCs abertas (linkadas à FVS via `fvs.nc_number`) |

### Planejamento

| Tabela | Propósito |
|---|---|
| `master_activities` | WBS hierárquica (Plan. Mestre) |
| `master_baselines` | Snapshots aprovados de cronograma |
| `master_baseline_activities` | Atividades dentro de uma baseline |
| `plan_trechos` | Trechos do planejamento operacional |
| `plan_teams` | Equipes do planejamento |
| `plan_scenarios` | Cenários "what-if" salvos |
| `plan_holidays` | Feriados |

### LPS / Lean

| Tabela | Propósito |
|---|---|
| `lps_lookahead_weeks` | Look-ahead semanal |
| `lps_commitments` | Compromissos da semana (PPC) |
| `lps_constraints` | Constraint Register |
| `lps_root_causes` | Causas-raiz Pareto |

### Quantitativos

| Tabela | Propósito |
|---|---|
| `orcamentos` | Orçamentos de obra (cabeçalho) |
| `orcamento_items` | Itens do orçamento |
| `orcamento_versions` | Versões/snapshots de orçamento |
| `custom_cost_base` | Base de custos customizada da empresa |

### Suprimentos

| Tabela | Propósito |
|---|---|
| `purchase_orders` | Pedidos de compra (PO) |
| `goods_receipts` | Recebimentos (GRN) |
| `invoices` | Notas fiscais (NF) |
| `three_way_matches` | Resultados de Three-Way Match (PO×GRN×NF) |
| `suppliers` | Cadastro de fornecedores |

### Mão de Obra

| Tabela | Propósito |
|---|---|
| `workers` | Funcionários (CPF, CTPS, role) |
| `worker_certifications` | NRs, ASO, validades |
| `worker_allocations` | Alocação diária trabalhador→atividade |
| `payroll_runs` | Folha de pagamento (mensal) |
| `payroll_lines` | Linhas da folha por trabalhador |

### Equipamentos / Frota

| Tabela | Propósito |
|---|---|
| `equipment` | Cadastro de equipamentos fixos |
| `equipment_logs` | Horímetros e utilizações |
| `equipment_maintenance` | Manutenções preventivas/corretivas |
| `vehicles` | Veículos da frota |
| `vehicle_fuel` | Abastecimentos |
| `vehicle_routes` | Roteirizações |

### Configurações compartilhadas

| Tabela | Propósito |
|---|---|
| `company_logos` | Logos PNG/JPG do projeto (multiple) |
| `user_routine` | Persona + módulos fixados (Minha Rotina) |
| `app_settings` | Settings por usuário (tema, idioma, notificações) |

**Total estimado:** ~50 tabelas no v1, ~80 no v2 (incluindo BIM e Mapa Interativo).

### Exemplo concreto: tabela `fvs`

```sql
CREATE TABLE fvs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  number             integer NOT NULL,                             -- sequencial por org
  document_code      text NOT NULL DEFAULT 'FOR-FVS-02',
  revision           text NOT NULL DEFAULT '00',
  identification_no  text NOT NULL,
  contract_no        text NOT NULL,
  fvs_date           date NOT NULL,
  ncRequired         boolean NOT NULL DEFAULT false,
  nc_number          text,
  responsible_leader text NOT NULL,
  weld_tracking_no   text,
  welder_signature   text,
  quality_signature  text,
  logo_id            uuid REFERENCES company_logos(id),
  project_id         uuid REFERENCES projects(id),
  site_id            uuid REFERENCES construction_sites(id),

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid NOT NULL REFERENCES profiles(id),
  updated_by         uuid REFERENCES profiles(id),
  deleted_at         timestamptz,

  UNIQUE (organization_id, number)
);

CREATE INDEX idx_fvs_org_date ON fvs(organization_id, fvs_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_fvs_site ON fvs(site_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fvs_project ON fvs(project_id) WHERE deleted_at IS NULL;

CREATE TABLE fvs_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fvs_id          uuid NOT NULL REFERENCES fvs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),  -- desnormalizado para RLS
  item_number     integer NOT NULL,
  item_group      text NOT NULL,                               -- 'verificacao_solda' | 'controle_parametros'
  description     text NOT NULL,
  criteria        text,
  conformity      text,                                         -- 'conforme' | 'nao_conforme' | 'reinspecao_ok' | null
  item_date       date,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fvs_items_fvs ON fvs_items(fvs_id);
```

---

## 6) Row Level Security (RLS)

### Política universal (template)

Para **toda** tabela com `organization_id`:

```sql
-- Habilita RLS
ALTER TABLE fvs ENABLE ROW LEVEL SECURITY;

-- Política 1: ler só dados da própria org
CREATE POLICY "fvs_select_own_org"
  ON fvs FOR SELECT
  USING (organization_id = auth.user_org() AND deleted_at IS NULL);

-- Política 2: inserir só na própria org E só se tiver role permitida
CREATE POLICY "fvs_insert_with_role"
  ON fvs FOR INSERT
  WITH CHECK (
    organization_id = auth.user_org()
    AND auth.has_role(ARRAY['engenheiro', 'qualidade', 'gerente', 'diretor', 'owner']::user_role[])
  );

-- Política 3: editar só se for o autor E dentro de 24h, OU role gerente+
CREATE POLICY "fvs_update_author_or_manager"
  ON fvs FOR UPDATE
  USING (
    organization_id = auth.user_org()
    AND (
      (created_by = auth.uid() AND created_at > now() - interval '24 hours')
      OR auth.has_role(ARRAY['gerente', 'diretor', 'owner']::user_role[])
    )
  );

-- Política 4: excluir só diretor+ (e mesmo assim faz soft-delete via RPC)
CREATE POLICY "fvs_delete_director_only"
  ON fvs FOR DELETE
  USING (
    organization_id = auth.user_org()
    AND auth.has_role(ARRAY['diretor', 'owner']::user_role[])
  );
```

### Por que `organization_id` desnormalizado em `fvs_items`

Sem `organization_id` na tabela filha, a RLS teria que fazer JOIN com `fvs` toda vez.
Com `organization_id` desnormalizado:

- ✅ RLS é uma comparação simples (rápida)
- ✅ Sem JOIN no critical path
- ⚠️ Risco: o `organization_id` da `fvs_items` precisa SEMPRE bater com o do `fvs` pai. Solução: trigger.

```sql
CREATE OR REPLACE FUNCTION enforce_org_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id != (SELECT organization_id FROM fvs WHERE id = NEW.fvs_id) THEN
    RAISE EXCEPTION 'organization_id inconsistente entre fvs e fvs_items';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fvs_items_org_check
  BEFORE INSERT OR UPDATE ON fvs_items
  FOR EACH ROW EXECUTE FUNCTION enforce_org_consistency();
```

### Teste de leak de tenant (deve ser obrigatório no CI)

```sql
-- Sob a sessão do user A (org X), tentar ler dados do user B (org Y)
SET request.jwt.claim.sub = 'user-a-uuid';
SELECT count(*) FROM fvs WHERE organization_id = 'org-y-uuid';
-- Esperado: 0
```

---

## 7) Estratégia local-first + sync

### Por que local-first

- **Offline funciona** (engenheiro de campo no canteiro sem 4G)
- **UI responsiva** (mutações são instantâneas no UI, sync em background)
- **Resiliência** (perda de conexão não corrompe nada)

### Arquitetura

```
┌─────────────────────────────────┐
│  React UI (componentes)         │
└──────────────┬──────────────────┘
               │ read/write
               ▼
┌─────────────────────────────────┐
│  Zustand store (in-memory)      │
└──────────────┬──────────────────┘
               │ persist middleware
               ▼
┌─────────────────────────────────┐
│  localStorage / IndexedDB       │ ← FONTE PRIMÁRIA do UI
└──────────────┬──────────────────┘
               │ sync queue (background)
               ▼
┌─────────────────────────────────┐
│  Supabase client (postgrest)    │
└──────────────┬──────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────┐
│  Supabase Postgres + RLS        │ ← FONTE DE VERDADE
└─────────────────────────────────┘
```

### Padrão de sync (cada store ganha)

```typescript
interface SyncableStore<T> {
  // Estado local
  items: T[]
  pendingSync: PendingChange[]      // mudanças não sincronizadas
  lastSyncedAt: string | null
  syncStatus: 'idle' | 'syncing' | 'error'
  syncError: string | null

  // Ações
  add: (item: Omit<T, 'id'>) => void           // optimistic + queue
  update: (id: string, patch: Partial<T>) => void
  remove: (id: string) => void

  // Sync engine
  flush: () => Promise<void>                    // envia pending para Supabase
  pull: (since?: string) => Promise<void>       // baixa mudanças remotas
  resolveConflict: (local: T, remote: T) => T   // estratégia de conflito
}
```

### Fila de mudanças pendentes

```typescript
interface PendingChange {
  id: string                       // UUID do registro
  table: string                    // 'fvs' | 'rdo' | etc
  operation: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  attemptedAt: string
  retries: number
  error?: string
}
```

### Estratégia de conflito (last-write-wins por enquanto, CRDT depois)

- Cada registro tem `updated_at` (server-side)
- Ao puxar do servidor, comparar `local.updated_at` vs `remote.updated_at`
- Mais novo ganha
- **Para v1**: simples last-write-wins
- **Para v2**: CRDT (Yjs) em campos críticos como FVS items, para suportar 2 engenheiros editando o mesmo RDO simultaneamente sem conflito

### Quando o sync acontece

| Trigger | Comportamento |
|---|---|
| Mutação local | Grava no localStorage **imediatamente**, enfileira no sync queue |
| Online detectado | Flush automático |
| A cada 30s (foreground) | Pull de mudanças remotas |
| Realtime push (Supabase channel) | Pull imediato do registro afetado |
| Manual ("sync now") | Flush + Pull |

---

## 8) Backup e disaster recovery

### Camadas de proteção

| # | Camada | Escopo | Frequência | Retenção | Quem opera |
|---|---|---|---|---|---|
| **1** | localStorage no navegador do usuário | Dados do usuário ativo | Tempo real | Até limpar cache | Automático |
| **2** | Supabase Postgres (multi-AZ) | Banco vivo | Replicação síncrona | — | Supabase |
| **3** | Supabase Daily Backup automático | Banco completo | Diário | 7 dias (Pro) / 30 dias (Team) | Supabase |
| **4** | Point-in-Time Recovery (PITR) | Banco completo | Contínuo (WAL) | 7 dias (Pro) | Supabase |
| **5** | Export semanal pg_dump → S3 (próprio) | Banco completo | Semanal (cron) | 90 dias | Job próprio |
| **6** | Export por org → JSON em S3 | Por organização | Mensal | 1 ano | Job próprio |
| **7** | Export sob demanda (UI) | Por organização | Sob clique do owner | — | Cliente |

### Por que 7 camadas

Cada uma cobre um cenário diferente de falha:

- **Camada 1** (localStorage): proteção contra perda de conexão e bugs de sync
- **Camadas 2-4**: cenários típicos de falha do banco — Supabase resolve sozinho
- **Camadas 5-6**: proteção contra **apagar conta inteira no Supabase** ou perder a conta admin
- **Camada 7**: cliente quer levar seus dados embora (LGPD: direito à portabilidade)

### Job de export semanal (próprio, fora do Supabase)

Rode em uma máquina sob seu controle (Vercel cron, GitHub Actions agendado, ou VPS):

```bash
# Diariamente, 03h UTC
0 3 * * * /scripts/backup-atlantico.sh
```

```bash
#!/bin/bash
# backup-atlantico.sh
DATE=$(date +%F)
PGPASSWORD=$SUPABASE_DB_PASSWORD pg_dump \
  --host=$SUPABASE_HOST \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --no-owner --no-acl --format=custom \
  --file=/tmp/atlantico-$DATE.dump

# Cifra com GPG (chave pública do owner)
gpg --encrypt --recipient owner@construdata.com /tmp/atlantico-$DATE.dump

# Upload para S3 (bucket cross-region)
aws s3 cp /tmp/atlantico-$DATE.dump.gpg s3://atlantico-backups/$DATE.dump.gpg \
  --storage-class STANDARD_IA

# Limpa local
rm /tmp/atlantico-$DATE.dump*

# Notificação Slack
curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"✅ Backup Atlântico $DATE concluído\"}" \
  $SLACK_WEBHOOK
```

### Runbook de disaster recovery

**Cenário 1: usuário perdeu localStorage (limpou cache)**
- Solução: ao logar, o store puxa tudo do Supabase via `pull()`
- Tempo de recuperação: ~10 segundos
- Perda: zero (se o sync estava em dia)

**Cenário 2: usuário fez merda — apagou uma FVS importante**
- Solução: a FVS está com `deleted_at` setado, não foi hard-deleted
- Owner pode restaurar via UI: `/app/lixeira`
- Tempo: instantâneo
- Perda: zero

**Cenário 3: organização inteira acidentalmente apagada**
- Solução: usar Supabase PITR para restaurar até o ponto antes do delete
- Tempo: 15-30 minutos (Supabase faz)
- Perda: tudo entre o ponto restaurado e o agora — geralmente <1h

**Cenário 4: catástrofe — Supabase fora do ar / conta admin perdida**
- Solução: restaurar do `pg_dump` semanal no S3 em uma instância Postgres nova
- Tempo: 2-4 horas
- Perda: até 1 semana de dados (intervalo entre backups)
- **Mitigação**: rodar export DIÁRIO em vez de semanal quando o cliente passar de 100 orgs

**Cenário 5: cliente pede LGPD — quero meus dados**
- Solução: botão "Exportar tudo" no perfil do owner — gera JSON com todas as tabelas filtradas por `organization_id`
- Tempo: minutos
- Como: RPC SQL específico que junta tudo

```sql
CREATE OR REPLACE FUNCTION export_organization_data(p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result jsonb;
BEGIN
  -- Verifica que o caller é owner da org
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = p_org_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'organization', (SELECT row_to_json(o) FROM organizations o WHERE id = p_org_id),
    'profiles',     (SELECT jsonb_agg(row_to_json(p)) FROM profiles p WHERE organization_id = p_org_id),
    'projects',     (SELECT jsonb_agg(row_to_json(p)) FROM projects p WHERE organization_id = p_org_id),
    'fvs',          (SELECT jsonb_agg(row_to_json(f)) FROM fvs f WHERE organization_id = p_org_id),
    'rdo',          (SELECT jsonb_agg(row_to_json(r)) FROM rdo r WHERE organization_id = p_org_id),
    -- ... todas as tabelas
    'exported_at',  now(),
    'exported_by',  auth.uid()
  ) INTO result;

  -- Audit
  INSERT INTO audit_log (organization_id, user_id, action, payload)
  VALUES (p_org_id, auth.uid(), 'export_organization_data', jsonb_build_object('size_kb', length(result::text) / 1024));

  RETURN result;
END;
$$;
```

---

## 9) Performance para 10k clientes

### Premissas de carga

| Métrica | Estimativa |
|---|---|
| Organizações ativas | 10.000 |
| Usuários por org (média) | 8 |
| **Total de usuários** | **80.000** |
| Pico simultâneo (5%) | 4.000 conexões |
| FVS por dia / org | 5 |
| RDO por dia / org | 2 |
| Inserts/s no pico | ~100 |
| Reads/s no pico | ~2.000 |

### Plano de Supabase recomendado

| Fase | Plano | Custo/mês | Limites |
|---|---|---|---|
| **0-100 orgs** | Pro | US$25 | 8GB DB, 50GB egress |
| **100-1.000 orgs** | Team | US$599 | 100GB DB, 250GB egress, daily backups, PITR |
| **1.000-10k orgs** | Enterprise (custom) | $$$ | Multi-region, dedicated, 24/7 SLA |

### Índices essenciais (em todas as tabelas com `organization_id`)

```sql
-- Padrão obrigatório
CREATE INDEX idx_<table>_org ON <table>(organization_id);
CREATE INDEX idx_<table>_org_created ON <table>(organization_id, created_at DESC);

-- Quando há soft delete
CREATE INDEX idx_<table>_org_active ON <table>(organization_id) WHERE deleted_at IS NULL;
```

### Particionamento (>1M registros / tabela)

Quando uma tabela passar de 1M linhas (ex.: `audit_log`), particionar por `organization_id` ou por mês:

```sql
CREATE TABLE audit_log (
  id bigserial,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_q1 PARTITION OF audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
-- ... etc
```

### Connection pooling

Supabase já usa **PgBouncer em modo transaction** por padrão. Para 10k conexões, configurar `max_connections = 200` no banco e deixar o pool fazer o resto. **Nunca** abrir conexão direta do client — sempre via PostgREST/RPC.

### Caching

- **PostgREST `Cache-Control`**: 30s para queries de leitura comum (Dashboard KPIs)
- **Supabase Realtime** para dados que mudam (notificações, pending_actions)
- **Vercel Edge Cache** para assets estáticos

---

## 10) Segurança ponta-a-ponta

### Camadas de defesa

| # | Camada | Implementação |
|---|---|---|
| **1** | **HTTPS** | Vercel + Supabase forçam TLS 1.3 |
| **2** | **Auth** | Supabase Auth com email+password, magic link, OAuth (Google/Microsoft) |
| **3** | **MFA** | TOTP obrigatório para `diretor` e `owner` (configurável) |
| **4** | **Session** | JWT curto (1h) + refresh token rotativo |
| **5** | **RLS** | TODA tabela tem políticas — testes automatizados de leak |
| **6** | **Service role NUNCA no client** | Frontend só usa anon key. Service role só em RPCs server-side e jobs cron |
| **7** | **Validação Zod** | Todo payload validado no client antes de enviar e re-validado no server (RPC) |
| **8** | **Rate limiting** | Supabase Edge Functions + headers `X-RateLimit-*` |
| **9** | **Audit log imutável** | `audit_log` sem UPDATE/DELETE policy — só INSERT |
| **10** | **Secrets** | Variáveis em Vercel/Supabase, **nunca** em código. `.env.local` no `.gitignore` |
| **11** | **CORS estrito** | Só `https://app.atlantico.com.br` |
| **12** | **CSP estrito** | `Content-Security-Policy` no Vercel headers |
| **13** | **Sanitização HTML** | Já temos `escapeHtml()` no PDF — aplicar em qualquer outro local de injeção |
| **14** | **Backups cifrados** | GPG com chave do owner antes de subir para S3 |
| **15** | **Pen test anual** | Externo, antes de cada release de Enterprise |

### O que NUNCA fazer

- ❌ Salvar `service_role_key` no client
- ❌ Usar `anon_key` para escrever sem RLS configurada
- ❌ Confiar em validação só no client
- ❌ Logar payload sensível em `console.log` em produção
- ❌ Fazer hard delete sem soft delete antes
- ❌ Permitir cross-org JOIN sem RLS

### Variáveis de ambiente

```bash
# Vercel (front)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # OK no client

# Supabase Edge Functions (server)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NUNCA no client
SUPABASE_DB_PASSWORD=...          # só nos jobs cron
GPG_PUBLIC_KEY=...                # para cifrar backups
S3_BACKUP_BUCKET=atlantico-backups
```

---

## 11) Plano de migração faseado

A migração é grande. Vou fasear em 5 sprints:

### Sprint 1 — Fundação (1 semana)
- Criar projeto Supabase
- Aplicar schemas: `organizations`, `profiles`, `audit_log`, `pending_actions`, `invitations`
- Configurar Supabase Auth (email + magic link)
- Página de signup/login no front
- RLS básica de orgs
- **Entrega:** alguém consegue criar conta + ver perfil

### Sprint 2 — Migração da Qualidade (1 semana)
- Schemas: `fvs`, `fvs_items`, `fvs_problems`, `non_conformities`, `company_logos`
- RLS completa
- Triggers de consistência
- Refatorar `qualidadeStore` para sync local↔remoto
- Testes de leak de tenant
- **Entrega:** Qualidade roda 100% no Supabase, multi-tenant

### Sprint 3 — Migração do RDO + Planejamento (2 semanas)
- Schemas: `rdo*`, `master_*`, `plan_*`, `lps_*`
- Sync engines
- Workflow de aprovação para edição/exclusão
- **Entrega:** RDO + Plan. Mestre + LPS no Supabase

### Sprint 4 — Migração do resto (2 semanas)
- Schemas: `orcamentos*`, `purchase_orders*`, `workers*`, `equipment*`, `vehicles*`, `construction_sites*`
- **Entrega:** plataforma 100% online, sem mocks no app

### Sprint 5 — Hardening (1 semana)
- Job de backup semanal cifrado para S3
- Página `/app/lixeira` (recuperar soft-deleted)
- Página `/app/aprovacoes` (workflow visual)
- Página `/app/auditoria` (audit log)
- Página `/app/exportar-dados` (LGPD)
- MFA obrigatório para diretor+
- Pen test interno
- **Entrega:** pronto para clientes pagantes

**Total estimado:** 7 semanas para uma stack production-ready.

---

## Decisões pendentes (precisam da sua resposta antes de implementar)

1. **Plano Supabase inicial:** começamos no **Pro (US$25/mês)** ou já no **Team (US$599/mês)**? Recomendação: Pro nos primeiros 100 clientes, Team quando passar de 100.

2. **MFA obrigatório:** ativar no primeiro dia para todos, ou só para diretor+? Recomendação: só para diretor+ no v1, todos no v2.

3. **Soft delete retention:** 30 dias é suficiente, ou querem 90? Recomendação: 30 dias com possibilidade de owner estender por registro.

4. **Magic link vs senha:** os 2 ou só magic link? Recomendação: os 2, com magic link em destaque.

5. **Backup cifrado para S3 próprio:** quem opera (você, terceirizado, eu instruo via runbook)? Recomendação: GitHub Actions agendado, configurado por mim, secrets seus.

6. **Bucket S3 / equivalente:** já tem? Senão, recomendação: AWS S3 ou Backblaze B2 (mais barato), na mesma região que o Supabase.

7. **Roles customizadas por org:** o usuário pediu "ou o cargo que eu selecionar durante a implementação". Vamos com a lista fixa de 8 roles que propus, ou cada org pode criar suas próprias roles? Recomendação: começar com a lista fixa, adicionar custom roles no v2 (custom roles em SaaS são uma dor de cabeça enorme).

8. **Tabela de "approval policies" configurável:** quer que cada org possa configurar quais ações exigem aprovação e qual role aprova? Ou regras fixas no código? Recomendação: regras fixas no v1 (mais simples), configurável no v2.

9. **Dados que ficam no localStorage:** TUDO, ou só o que o usuário criou (sem dados de outros usuários)? Recomendação: só o que o usuário pode ver via RLS — senão dá pra extrair dados de outras orgs do localStorage (se ele tiver acesso).

10. **Idioma:** SQL e código em inglês, mensagens de erro/UI em português? Recomendação: sim.

---

## Próximos passos

1. **Você revisa** este documento e responde as 10 decisões pendentes
2. **Eu refino** o plano com base nas respostas
3. **Eu crio** uma issue/PR com as migrations SQL do Sprint 1
4. **Você cria** o projeto Supabase e me passa as URLs/keys (anon key, service role only para mim configurar)
5. **Implementamos** o Sprint 1 (auth + orgs + perfis)
6. **Validamos** que multi-tenant funciona com 2 orgs de teste
7. **Avançamos** sprint a sprint

**Antes da implementação começar, NADA muda na plataforma atual.** O documento serve apenas para alinhamento e contrato.
