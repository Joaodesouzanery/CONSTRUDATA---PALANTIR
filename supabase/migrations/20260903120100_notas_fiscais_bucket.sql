-- Financeiro / Nota Fiscal: bucket privado `notas-fiscais` para as fotos dos cupons e notas
-- importados na aba "Nota Fiscal". A nota guarda só o caminho (payload jsonb: `fotoPath`);
-- exibição via signed URL. Espelha `boletos`.
-- RLS por organização: a pasta raiz do objeto é o organization_id (user_org()).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

insert into storage.buckets (id, name, public)
values ('notas-fiscais', 'notas-fiscais', false)
on conflict (id) do nothing;

drop policy if exists "notas_fiscais_storage_select" on storage.objects;
drop policy if exists "notas_fiscais_storage_insert" on storage.objects;
drop policy if exists "notas_fiscais_storage_update" on storage.objects;
drop policy if exists "notas_fiscais_storage_delete" on storage.objects;

create policy "notas_fiscais_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "notas_fiscais_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "notas_fiscais_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = public.user_org()::text
  )
  with check (
    bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "notas_fiscais_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = public.user_org()::text
  );
