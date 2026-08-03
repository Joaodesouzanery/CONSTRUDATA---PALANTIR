-- Predial / Inventário de Ativos: bucket privado `predial-ativos` para a foto da
-- plaqueta e os documentos anexos do ativo (manual, ART, nota). O ativo guarda só o
-- caminho (payload jsonb: fotoPlaquetaPath / anexos[].path). Espelha `rdo-photos`.
-- RLS por organização: a pasta raiz do objeto é o organization_id (user_org()).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

insert into storage.buckets (id, name, public)
values ('predial-ativos', 'predial-ativos', false)
on conflict (id) do nothing;

drop policy if exists "predial_ativos_storage_select" on storage.objects;
drop policy if exists "predial_ativos_storage_insert" on storage.objects;
drop policy if exists "predial_ativos_storage_update" on storage.objects;
drop policy if exists "predial_ativos_storage_delete" on storage.objects;

create policy "predial_ativos_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'predial-ativos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "predial_ativos_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'predial-ativos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "predial_ativos_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'predial-ativos'
    and (storage.foldername(name))[1] = public.user_org()::text
  )
  with check (
    bucket_id = 'predial-ativos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "predial_ativos_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'predial-ativos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );
