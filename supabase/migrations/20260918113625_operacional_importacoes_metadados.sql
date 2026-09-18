-- Estado estrutural, lotes e auditoria do Controle Operacional SABESP.
-- As linhas continuam em operacional_linhas; estas tabelas guardam o que não cabe em uma linha:
-- cabeçalhos, seções, validações, guias e a trilha de cada importação/edição.

create table if not exists public.operacional_estado (
  id uuid primary key,
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  arquivo_original_path text,
  arquivo_original_nome text,
  -- ⚠️ `created_by` é OBRIGATÓRIO em qualquer tabela que a fila de sincronização toca, mesmo que
  -- esta use `updated_by` na policy. Motivo: `fixOrg` (src/lib/storeSync.ts) repara a autoria de
  -- toda op antes de enviar — e, como o reparo dispara quando o campo é nulo, ele INJETA
  -- `created_by` numa tabela que não o tem. O PostgREST responde PGRST204, que o `storeSync`
  -- classifica como "aguardando-servidor": retry infinito, silencioso, sem aviso na tela. Os
  -- metadados da planilha nunca chegavam ao servidor, e outro aparelho via as 20 abas vazias.
  --
  -- Nullable de propósito: a coluna pode ser acrescentada a uma tabela que já tem linha.
  created_by uuid references auth.users(id),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Para quem já aplicou a versão anterior deste arquivo, sem a coluna.
alter table public.operacional_estado add column if not exists created_by uuid references auth.users(id);

create table if not exists public.operacional_importacoes (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  arquivo text not null,
  arquivo_path text,
  resumo jsonb not null default '{}'::jsonb,
  metadados jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.operacional_historico (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  linha_id uuid references public.operacional_linhas(id) on delete set null,
  aba text not null,
  chave text not null,
  acao text not null check (acao in ('editar','criar','duplicar','arquivar','restaurar','importar')),
  antes jsonb,
  depois jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_op_importacoes_org_data on public.operacional_importacoes(organization_id, created_at desc);
create index if not exists idx_op_historico_org_linha on public.operacional_historico(organization_id, linha_id, created_at desc);

alter table public.operacional_estado enable row level security;
alter table public.operacional_estado force row level security;
alter table public.operacional_importacoes enable row level security;
alter table public.operacional_importacoes force row level security;
alter table public.operacional_historico enable row level security;
alter table public.operacional_historico force row level security;

drop policy if exists op_estado_select on public.operacional_estado;
create policy op_estado_select on public.operacional_estado for select to authenticated
  using (organization_id = public.user_org());
drop policy if exists op_estado_insert on public.operacional_estado;
create policy op_estado_insert on public.operacional_estado for insert to authenticated
  with check (organization_id = public.user_org() and updated_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));
drop policy if exists op_estado_update on public.operacional_estado;
create policy op_estado_update on public.operacional_estado for update to authenticated
  using (organization_id = public.user_org()) with check (organization_id = public.user_org()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

drop policy if exists op_importacoes_select on public.operacional_importacoes;
create policy op_importacoes_select on public.operacional_importacoes for select to authenticated
  using (organization_id = public.user_org());
drop policy if exists op_importacoes_insert on public.operacional_importacoes;
create policy op_importacoes_insert on public.operacional_importacoes for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

drop policy if exists op_historico_select on public.operacional_historico;
create policy op_historico_select on public.operacional_historico for select to authenticated
  using (organization_id = public.user_org());
drop policy if exists op_historico_insert on public.operacional_historico;
create policy op_historico_insert on public.operacional_historico for insert to authenticated
  with check (organization_id = public.user_org() and created_by = auth.uid()
    and public.has_role(array['planejador','engenheiro','gerente','diretor','owner']::public.user_role[]));

grant select, insert, update on public.operacional_estado to authenticated;
grant select, insert on public.operacional_importacoes, public.operacional_historico to authenticated;

insert into storage.buckets (id, name, public)
values ('operacional-planilhas', 'operacional-planilhas', false)
on conflict (id) do nothing;

drop policy if exists operacional_planilhas_select on storage.objects;
create policy operacional_planilhas_select on storage.objects for select to authenticated
  using (bucket_id = 'operacional-planilhas' and (storage.foldername(name))[1] = public.user_org()::text);
drop policy if exists operacional_planilhas_insert on storage.objects;
create policy operacional_planilhas_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'operacional-planilhas' and (storage.foldername(name))[1] = public.user_org()::text);
drop policy if exists operacional_planilhas_update on storage.objects;
create policy operacional_planilhas_update on storage.objects for update to authenticated
  using (bucket_id = 'operacional-planilhas' and (storage.foldername(name))[1] = public.user_org()::text)
  with check (bucket_id = 'operacional-planilhas' and (storage.foldername(name))[1] = public.user_org()::text);

-- DELETE físico permanece indisponível: lotes e arquivos são evidência auditável.
