# Empresas, usuários, RDO Sabesp e Medição

Este documento define o processo padrão para cada novo cliente/empresa no Construdata 360.

## Modelo de Conta

O sistema usa um modelo multiempresa:

- `organizations`: cada empresa/cliente contratante.
- `auth.users`: cada pessoa que faz login.
- `profiles`: dados pessoais e empresa padrão do usuário.
- `memberships`: vínculo entre usuário e empresa, com papel e status.
- Tabelas de módulos: sempre filtradas por `organization_id`.

Um usuário pode pertencer a mais de uma empresa. A empresa ativa/default fica em `profiles.organization_id`, e pode ser trocada com `set_default_organization`.

## Papéis Atuais

Roles disponíveis no banco:

- `owner`: dono da conta da empresa.
- `diretor`: diretoria, aprova ações críticas.
- `gerente`: gerente de obra/operação.
- `engenheiro`: usuário operacional de RDO, campo e engenharia.
- `qualidade`: responsável pelo módulo Qualidade.
- `planejador`: planejamento e cronograma.
- `comprador`: suprimentos/compras.
- `visualizador`: somente leitura.

Quando for necessário separar financeiro/medição com mais precisão, criar novo enum ou mapear provisoriamente em `comprador`, `gerente` ou `visualizador`, conforme o nível de acesso.

## Criar Nova Empresa

Fluxo recomendado para B2B privado:

1. Visitante clica em `Acessar` na Landing Page e entra em `/login`.
2. O login publico nao cria empresa.
3. Voce provisiona a empresa por fluxo administrativo privado.
4. O primeiro owner recebe link `/aceitar-convite?token=TOKEN`.
5. O convidado cria senha ou usa senha existente.
6. Ao aceitar convite, o banco cria:
   - `organizations`
   - `profiles`
   - `memberships` com role `owner`
   - registro em `audit_log`

Edge Function administrativa criada:

```text
admin-provision-company
```

Secrets necessarios:

```text
ADMIN_PROVISION_SECRET
PLATFORM_ADMIN_PROFILE_ID
SUPABASE_SERVICE_ROLE_KEY
APP_URL
```

Exemplo de chamada administrativa:

```bash
curl -X POST "https://PROJECT_REF.supabase.co/functions/v1/admin-provision-company" \
  -H "x-admin-secret: ADMIN_PROVISION_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "organization_name": "Construtora Alfa",
    "owner_email": "owner@construtoraalfa.com.br",
    "plan": "free",
    "max_users": 5,
    "max_projects": 3
  }'
```

Retorno esperado:

```json
{
  "organization": {
    "id": "...",
    "name": "Construtora Alfa",
    "slug": "construtora-alfa"
  },
  "invitation_id": "...",
  "owner_email": "owner@construtoraalfa.com.br",
  "invitation_url": "https://app.../aceitar-convite?token=..."
}
```

O RPC `signup_with_org` fica desativado para cadastro publico. Empresas novas devem nascer por provisionamento privado.

## Fluxo Supabase Dashboard

Evitar criar usuarios manualmente apenas no Supabase Auth, porque isso cria o login sem garantir:

- empresa correta;
- `profile`;
- `membership`;
- role;
- auditoria;
- convite rastreavel.

O Dashboard pode ser usado em emergencia, mas o caminho operacional padrao e: criar empresa por `admin-provision-company`, enviar convite, usuario aceitar.
})
```

## Convidar Usuários

Somente `gerente`, `diretor` e `owner` podem convidar membros.

```ts
const { data, error } = await supabase.rpc("invite_org_member", {
  p_email: "engenheiro@cliente.com",
  p_role: "engenheiro",
})
```

O retorno contém:

- `invitation_id`
- `invitation_token`

O app deve enviar um link parecido com:

```text
https://app.construdata.com/aceitar-convite?token=TOKEN
```

O envio do email pode ser feito depois por Edge Function, Vercel Function ou integração de email transacional.

## Aceitar Convite

O convidado abre `/aceitar-convite?token=TOKEN`. A tela permite criar senha ou usar a senha existente.

O convidado precisa ficar autenticado com o mesmo email do convite antes de aceitar.

```ts
await supabase.rpc("accept_invitation", {
  p_token: token,
  p_full_name: "Maria Souza",
})
```

O banco valida:

- token existente;
- token não expirado;
- convite não aceito;
- convite não revogado;
- email do usuário autenticado igual ao email convidado.

Depois cria ou reativa a `membership` da pessoa naquela empresa.

## Trocar Empresa Ativa

Para usuário que pertence a mais de uma empresa:

```ts
await supabase.rpc("set_default_organization", {
  p_org_id: organizationId,
})
```

Essa troca atualiza `profiles.organization_id` e faz as policies legadas continuarem usando a empresa correta.

## Trocar Função

Somente `diretor` e `owner` podem trocar função.

```ts
await supabase.rpc("change_member_role", {
  p_membership_id: membershipId,
  p_role: "qualidade",
})
```

Toda troca é registrada em `audit_log`.

## Bloquear Sem Apagar Histórico

Para desligamento, inadimplência interna ou acesso suspenso:

```ts
await supabase.rpc("block_member", {
  p_membership_id: membershipId,
  p_reason: "Desligamento da equipe",
})
```

Isso altera `memberships.status` para `blocked`.

Não apagar:

- RDOs criados pelo usuário;
- registros de qualidade;
- medições;
- anexos;
- logs.

O histórico continua íntegro porque os registros mantêm `created_by`.

## Reativar Usuário

```ts
await supabase.rpc("reactivate_member", {
  p_membership_id: membershipId,
})
```

## RDO Sabesp: Leitura da Foto

Fluxo esperado:

1. Usuário envia foto da planilha/RDO.
2. Foto original é salva no bucket privado `rdo-sabesp-photos`.
3. Registro auditável é criado em `rdo_sabesp_assets`.
4. Edge Function `parse-rdo-sabesp` lê a imagem com IA.
5. Resultado é salvo como tentativa em `rdo_sabesp_parser_runs`.
6. Campos extraídos preenchem o formulário.
7. Usuário revisa antes de finalizar.
8. Foto original permanece no histórico e pode entrar no PDF.

A foto original é a evidência principal. A IA ajuda a preencher, mas não substitui a validação humana.

## Assinatura Presente

Manter o comportamento:

- Detectar `assinatura_empreiteira_presente`.
- Detectar `assinatura_consorcio_presente`.
- Tentar recortar a assinatura quando a IA retorna bbox.
- Salvar recortes quando possível.
- Preservar sempre a foto original da planilha.

Se o recorte falhar, o RDO ainda fica válido para consulta porque a foto original contém a assinatura.

## Serviços Não Cadastrados

Quando a IA identificar um serviço que não existe no catálogo fixo:

- não descartar;
- adicionar como nova linha em `servicos_esgoto` ou `servicos_agua`;
- manter `codigo`, `descricao`, `unidade`, `quantidade` e `opcoes`;
- deixar visível para revisão;
- contar normalmente nos totais e no envio para Medição.

O formulário atual já adiciona linhas novas retornadas pelo parser em vez de ignorá-las.

## Contagem e Conferência

Campos que devem alimentar indicadores:

- quantidade de RDOs por período;
- quantidade por núcleo/criadouro;
- serviços executados por código;
- quantidades de água e esgoto;
- mão de obra;
- equipamentos;
- presença de assinatura;
- divergências entre foto original e RDO preenchido.

Campos de baixa confiança devem ficar em revisão antes de finalização.

## RDO e Qualidade Para Medição

O destino operacional da Medição é `measurement_sources`.

RDO Sabesp deve gerar linhas em `measurement_sources` para cada serviço executado:

- `source_kind`: `rdo_sabesp`
- `rdo_type`: `sabesp`
- `rdo_id`: id do RDO
- `service_code`
- `service_description`
- `unit`
- `quantity`
- `source_payload`: dados originais do serviço, data, núcleo, encarregado e referência da foto

Qualidade deve impactar a Medição como bloqueio, glosa, pendência ou observação de aceite, nunca apagando medição automaticamente.

Regras recomendadas:

- RDO finalizado gera fonte de medição.
- RDO em rascunho não entra na Medição.
- RDO reaberto ou alterado recalcula as linhas vinculadas.
- Não conformidade aberta pode marcar item como pendente.
- Não conformidade concluída libera ou registra aceite.
- Glosa/desconto deve passar por ajuste auditável, não delete.

Rotina técnica criada na migração `0048_rdo_quality_measurement_sync.sql`:

```text
rdo_sabesp finalized -> measurement_sources
rdo closed -> measurement_sources
quality_non_conformities -> measurement_quality_flags + status na fonte de medição vinculada
```

Depois de aplicar essa migração, a sincronização acontece automaticamente por triggers. Também é possível refazer manualmente:

```ts
await supabase.rpc("sync_rdo_sabesp_to_measurement", { p_rdo_id: rdoSabespId })
await supabase.rpc("sync_regular_rdo_to_measurement", { p_rdo_id: rdoId })
await supabase.rpc("sync_quality_nc_to_measurement", { p_nc_id: ncId })
```

As rotinas são idempotentes: antes de recriar as linhas de uma fonte, as linhas anteriores são marcadas com `deleted_at`, preservando histórico e evitando duplicidade ativa.

## Segurança

Regras obrigatórias:

- Toda tabela de domínio deve ter `organization_id`.
- RLS sempre ativo.
- `DELETE` direto bloqueado em dados importantes.
- Usar `deleted_at` para soft delete.
- Toda ação crítica registrada em `audit_log`.
- Chaves sensíveis apenas em Supabase Secrets/Vercel env, nunca no frontend.
- Arquivos privados em buckets privados.
- URLs assinadas com expiração curta.
- Usuário bloqueado não perde histórico, apenas perde acesso.

## Checklist Por Novo Cliente

1. Criar primeiro usuário owner.
2. Provisionar empresa por `admin-provision-company`.
3. Conferir `organizations`, `profiles` e `memberships`.
4. Convidar equipe por email.
5. Atribuir roles corretas.
6. Testar login de um usuário não-admin.
7. Criar um RDO Sabesp de teste.
8. Conferir upload da foto original.
9. Conferir parser e `rdo_sabesp_parser_runs`.
10. Finalizar RDO somente após revisão.
11. Conferir envio/sincronização para Medição quando a rotina estiver ativada.
