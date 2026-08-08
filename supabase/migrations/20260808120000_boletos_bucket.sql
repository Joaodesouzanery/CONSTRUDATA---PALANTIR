-- Financeiro / Boletos: bucket privado `boletos` para as fotos dos boletos anexados
-- na aba "Boletos". O título-parcela guarda só o caminho (payload jsonb: anexos[].path);
-- exibição via signed URL. Espelha `predial-ativos`.
-- RLS por organização: a pasta raiz do objeto é o organization_id (user_org()).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

insert into storage.buckets (id, name, public)
values ('boletos', 'boletos', false)
on conflict (id) do nothing;

drop policy if exists "boletos_storage_select" on storage.objects;
drop policy if exists "boletos_storage_insert" on storage.objects;
drop policy if exists "boletos_storage_update" on storage.objects;
drop policy if exists "boletos_storage_delete" on storage.objects;

create policy "boletos_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'boletos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "boletos_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'boletos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "boletos_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'boletos'
    and (storage.foldername(name))[1] = public.user_org()::text
  )
  with check (
    bucket_id = 'boletos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "boletos_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'boletos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );
