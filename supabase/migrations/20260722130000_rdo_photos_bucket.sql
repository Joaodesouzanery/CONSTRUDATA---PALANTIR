-- RDO (Compizzo/normal): bucket privado `rdo-photos` para as fotos do relatório.
-- Antes as fotos iam em base64 dentro do payload jsonb (estourava localStorage e
-- inflava o banco). Agora sobem como arquivo e o RDO guarda só o caminho.
-- RLS por organização: a pasta raiz do objeto é o organization_id (user_org()).
-- Espelha o padrão de `obra-levantamentos` / `rdo-sabesp-photos`.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

insert into storage.buckets (id, name, public)
values ('rdo-photos', 'rdo-photos', false)
on conflict (id) do nothing;

drop policy if exists "rdo_photos_storage_select" on storage.objects;
drop policy if exists "rdo_photos_storage_insert" on storage.objects;
drop policy if exists "rdo_photos_storage_update" on storage.objects;
drop policy if exists "rdo_photos_storage_delete" on storage.objects;

create policy "rdo_photos_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "rdo_photos_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "rdo_photos_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  )
  with check (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "rdo_photos_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'rdo-photos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );
