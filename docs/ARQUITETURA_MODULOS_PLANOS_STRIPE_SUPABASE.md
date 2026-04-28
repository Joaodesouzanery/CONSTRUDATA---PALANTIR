# Arquitetura de módulos, planos, Stripe e Supabase

Este documento descreve como vender o ConstruData por módulos, liberar recursos por cliente, controlar permissões no Supabase e sincronizar pagamentos via Stripe.

## 1. Objetivo

A plataforma deve permitir que cada empresa tenha uma combinação própria de módulos. Exemplo:

- Cliente A: Medição + Suprimentos + RDO.
- Cliente B: Gestão 360 + Planejamento + LPS.
- Cliente C: pacote completo.
- Cliente D: apenas um módulo piloto por 30 dias.

Essa divisão não pode ser apenas visual. O menu pode esconder módulos, mas o banco também precisa bloquear leitura/escrita quando a empresa não contratou aquele módulo.

## 2. Responsabilidade de cada sistema

Supabase:

- Login e usuários.
- Organizações/clientes.
- Papéis, permissões e RLS.
- Módulos habilitados por organização.
- Dados operacionais.
- Auditoria.
- Webhook receiver ou Edge Function para receber eventos do Stripe.

Stripe:

- Produtos, preços e assinaturas.
- Checkout.
- Portal do cliente.
- Cobrança recorrente.
- Status de pagamento.
- Entitlements/features, se você quiser mapear módulos diretamente em produtos do Stripe.
- Webhooks avisando mudança de assinatura, pagamento, cancelamento e feature entitlement.

Frontend:

- Lê `organization_modules` e permissões.
- Monta menu e rotas disponíveis.
- Mostra telas de upgrade quando o módulo não estiver ativo.
- Nunca decide sozinho acesso real a dados críticos.

## 3. Modelo de dados recomendado

```sql
create table public.modules (
  key text primary key,
  name text not null,
  description text,
  category text not null,
  active boolean not null default true
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  stripe_product_id text,
  active boolean not null default true
);

create table public.plan_modules (
  plan_id uuid not null references public.plans(id) on delete cascade,
  module_key text not null references public.modules(key),
  limits jsonb not null default '{}'::jsonb,
  primary key (plan_id, module_key)
);

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.plans(id),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.organization_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null references public.modules(key),
  enabled boolean not null default true,
  source text not null default 'subscription',
  limits jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  primary key (organization_id, module_key)
);
```

`organization_modules` é a tabela que o app consulta para saber o que a empresa pode usar. Ela pode ser alimentada por plano, trial, compra avulsa, negociação manual ou feature entitlement do Stripe.

## 4. Como vender módulos

Modelo simples: planos fixos

- Starter: RDO + Medição.
- Obras: Planejamento + LPS + RDO.
- Financeiro: Medição + Financeiro/EVM + Gestão 360.
- Enterprise: tudo.

Modelo modular:

- Produto base: Plataforma ConstruData.
- Add-ons: Suprimentos, Medição, Planejamento, Qualidade, Gestão 360.
- Cada add-on habilita uma linha em `organization_modules`.

Modelo híbrido recomendado:

- Planos principais para simplificar venda.
- Add-ons para módulos extras.
- Overrides manuais para contratos enterprise.

## 5. Stripe Entitlements

O Stripe tem um recurso chamado Entitlements que permite mapear features internas aos produtos vendidos. Exemplo:

- Feature `module_suprimentos`.
- Feature `module_medicao`.
- Feature `module_gestao360`.

Quando uma assinatura muda, o Stripe pode enviar evento de entitlement ativo. O backend recebe o webhook e atualiza `organization_modules`.

Esse caminho reduz acoplamento entre preço e código: você muda quais features pertencem a um produto no Stripe sem precisar redeployar o frontend.

## 6. Webhooks necessários

Eventos úteis:

- `checkout.session.completed`: primeira compra finalizada.
- `customer.subscription.created`: assinatura criada.
- `customer.subscription.updated`: plano trocado, status alterado, trial mudou.
- `customer.subscription.deleted`: assinatura cancelada.
- `invoice.paid`: pagamento renovado com sucesso.
- `invoice.payment_failed`: pagamento falhou.
- `entitlements.active_entitlement_summary.updated`: features ativas mudaram.

O webhook deve:

1. Validar assinatura do evento Stripe.
2. Encontrar `organization_id` pelo `stripe_customer_id` ou metadata.
3. Atualizar `organization_subscriptions`.
4. Recalcular `organization_modules`.
5. Gravar `audit_log`.

## 7. Fluxo de compra

1. Admin da empresa escolhe plano ou módulo.
2. Frontend chama Edge Function `create-checkout-session`.
3. Edge Function cria/recupera `stripe_customer_id`.
4. Stripe Checkout processa pagamento.
5. Stripe envia webhook.
6. Backend atualiza assinatura e módulos.
7. App recarrega permissões/módulos.

Nunca confie em “retorno de sucesso” do Checkout como prova final de pagamento. A confirmação real vem do webhook.

## 8. Portal do cliente

Use Stripe Customer Portal para:

- Atualizar cartão.
- Ver faturas.
- Cancelar plano, se permitido.
- Trocar plano, se a regra comercial permitir.

Mesmo usando portal, o Supabase continua sendo a fonte do que o app libera, atualizado por webhook.

## 9. Controle no frontend

Exemplo conceitual:

```ts
const enabledModules = await loadOrganizationModules(orgId)

const menu = ALL_MODULES.filter((module) =>
  enabledModules.some((m) => m.module_key === module.key && m.enabled)
)
```

Se o usuário abrir rota direta de um módulo bloqueado:

- Mostrar tela de módulo não contratado.
- Botão para solicitar upgrade ou falar com administrador.
- Não buscar dados do módulo.

## 10. Controle no banco

Função auxiliar:

```sql
create or replace function private.has_module(org_id uuid, module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_modules om
    where om.organization_id = org_id
      and om.module_key = module
      and om.enabled = true
      and (om.expires_at is null or om.expires_at > now())
  );
$$;
```

Policy combinando módulo + permissão:

```sql
create policy "read suprimentos if contracted"
on public.suprimentos_purchase_orders
for select
to authenticated
using (
  private.is_org_member(organization_id)
  and private.has_module(organization_id, 'suprimentos')
);
```

Assim, mesmo que alguém tente chamar a API manualmente, o Postgres bloqueia.

## 11. Limites por plano

`organization_modules.limits` pode guardar:

```json
{
  "max_projects": 10,
  "max_users": 50,
  "max_storage_gb": 100,
  "ai_insights": true,
  "pdf_exports_per_month": 500
}
```

Para limites críticos, valide no backend/RPC. O frontend pode mostrar barra de uso, mas não deve ser o guardião final.

## 12. Trial e pilotos

Para piloto:

- Criar `organization_modules` com `source = 'trial'`.
- Definir `expires_at`.
- Mostrar aviso de expiração.
- Ao contratar, webhook muda `source` para `subscription`.

## 13. Contratos enterprise

Alguns clientes não vão comprar por Checkout. Para eles:

- Criar plano `enterprise_custom`.
- Usar `source = 'manual_contract'`.
- Registrar contrato, validade e módulos liberados.
- Pode ainda usar Stripe apenas para cobrança/fatura, mas liberação fica manual.

## 14. Cancelamento e inadimplência

Recomendação:

- `active` e `trialing`: acesso normal.
- `past_due`: manter acesso por período de tolerância e avisar admins.
- `unpaid` ou `canceled`: bloquear módulos pagos, manter acesso a exportação/backup por tempo limitado.
- `paused`: bloquear criação/edição, opcionalmente permitir leitura.

Não apague dados quando cancelar. Apenas bloqueie acesso e mantenha política de retenção contratual.

## 15. Separação por usuário dentro da empresa

Módulo contratado pela empresa não significa que todos os usuários acessam.

Camadas:

1. Empresa contratou módulo? `organization_modules`.
2. Usuário pertence à empresa? `organization_members`.
3. Usuário tem permissão no módulo? `role_permissions` ou override.
4. A ação exige aprovação? `approval_rules`.

Exemplo:

- Empresa tem Medição.
- Analista pode criar medição.
- Gerente pode aprovar medição.
- Diretor pode excluir ou reabrir medição final.

## 16. Integração com o projeto atual

Ordem recomendada:

1. Criar `modules`, `plans`, `plan_modules`, `organization_modules`.
2. Criar hook/store `useCurrentEntitlements`.
3. Ajustar menu lateral e rotas para respeitar módulos ativos.
4. Adicionar guards por módulo nas páginas.
5. Criar migrations das tabelas principais com `organization_id`.
6. Criar RLS com `has_module`.
7. Criar Edge Function para Stripe Checkout.
8. Criar Edge Function para Stripe Webhook.
9. Testar troca/cancelamento de plano.
10. Só depois colocar cobrança real.

## 17. Exemplo de catálogo inicial

```sql
insert into public.modules (key, name, category) values
('medicao', 'Medição', 'obra'),
('suprimentos', 'Suprimentos', 'obra'),
('planejamento', 'Planejamento', 'planejamento'),
('lps', 'LPS/Lean', 'planejamento'),
('rdo', 'RDO', 'campo'),
('gestao360', 'Gestão 360', 'gestao'),
('financeiro', 'Financeiro/EVM', 'financeiro'),
('qualidade', 'Qualidade', 'qualidade'),
('mao_de_obra', 'Mão de Obra', 'campo'),
('equipamentos', 'Equipamentos', 'campo');
```

## 18. Segurança e auditoria

Toda mudança de plano/módulo precisa registrar:

- Quem solicitou.
- Origem: Stripe, trial, contrato manual, suporte.
- Antes/depois.
- Data e IP.
- Evento Stripe relacionado, quando houver.

Para enterprise, alterações manuais de módulo devem exigir permissão `billing.manage` ou `admin.modules.manage`.

## 19. Fontes oficiais

- Stripe Entitlements: https://docs.stripe.com/billing/entitlements
- Stripe subscription webhooks: https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe subscription lifecycle: https://docs.stripe.com/subscriptions/lifecycle
- Stripe Customer Portal/limitar assinaturas duplicadas: https://docs.stripe.com/payments/checkout/limit-subscriptions
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase RBAC/custom claims: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
