# Supabase Advisors: plano de ação

Baseado nos CSVs exportados do Supabase para o projeto `wtovivsmvenjbuhdemzv`.

## Resumo dos alertas

### Performance

- `106` avisos de `auth_rls_initplan`.
- O problema é recorrente em políticas RLS que chamam `auth.uid()` ou funções similares diretamente.
- Correção padrão: trocar chamadas como `auth.uid()` por `(select auth.uid())` dentro das policies.
- Prioridade: média. Não é vazamento direto de dados, mas pode degradar bastante em tabelas grandes.

Tabelas impactadas incluem: `profiles`, `invitations`, `audit_log`, `rdo`, `rdo_sabesp`, `quality_non_conformities`, `measurement_bulletins`, `measurement_sources`, `projects`, `suprimentos_*`, `lps_*`, `evm_*`, `workers`, `timecards`, `agenda_*`, `mapas_interativos`, `rede_*` e outras tabelas operacionais.

### Segurança

- `35` funções `SECURITY DEFINER` executáveis por `anon`.
- `35` funções `SECURITY DEFINER` executáveis por `authenticated`.
- `5` funções sem `search_path` fixo.
- `1` extensão `citext` instalada em `public`.
- `1` materialized view `project_dashboard_view` acessível pela API.
- `1` aviso de proteção contra senha vazada desativada no Supabase Auth.

Funções citadas pelos advisors incluem: `accept_invitation`, `invite_org_member`, `set_default_organization`, `has_role`, `has_org_role`, `user_org`, `approve_pending_action`, `reject_pending_action`, `request_action`, `export_organization_data`, `refresh_project_dashboard`, `recompute_project_kpis`, funções de sync entre RDO/Qualidade/Medição e triggers auxiliares.

## Prioridade recomendada

### 1. Segurança de Auth

Ativar no Supabase:

- proteção contra senha vazada;
- política de senha forte;
- MFA para owners, diretores, aprovadores e admin global.

### 2. Funções públicas perigosas

Revisar cada função `SECURITY DEFINER`.

Regra:

- funções que precisam ser chamadas pelo app devem ter validação interna forte por `auth.uid()`, `membership`, `role`, `organization_id` e status ativo;
- funções internas, de trigger ou service role devem ter `REVOKE EXECUTE FROM anon, authenticated`;
- funções de convite podem ser chamadas por usuário logado autorizado, mas não devem ser executáveis por `anon`.

### 3. RLS Performance

Criar uma migration específica para recriar policies usando:

```sql
(select auth.uid())
```

em vez de:

```sql
auth.uid()
```

Isso reduz reavaliação por linha.

### 4. Materialized View

Remover exposição pública da `project_dashboard_view`, ou mover acesso para uma RPC segura que filtre por `organization_id`.

### 5. Extensões e search_path

- Fixar `SET search_path = public` ou schema explícito em todas as funções.
- Avaliar mover extensões para schema dedicado, como `extensions`, quando não quebrar dependências.

## O que não fazer

- Não remover RLS para “resolver performance”.
- Não tornar funções `SECURITY INVOKER` sem testar, porque algumas dependem de permissões elevadas controladas.
- Não apagar dados de empresas para corrigir vínculo ou login.
- Não expor criação pública de empresa.

## Próxima migration recomendada

Criar uma migration chamada algo como:

```text
0051_supabase_advisor_hardening.sql
```

Escopo sugerido:

1. `REVOKE EXECUTE` de funções internas para `anon`.
2. Manter `GRANT EXECUTE` apenas nas RPCs realmente chamadas pelo app.
3. Recriar policies críticas com `(select auth.uid())`.
4. Remover acesso direto à materialized view pela API.
5. Garantir `search_path` fixo nas funções listadas.

