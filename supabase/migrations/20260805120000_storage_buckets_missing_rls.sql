-- Segurança (auditoria): os buckets `bim-uploads` e `project-documents` são usados pelo app
-- (src/lib/storage.ts) mas não tinham definição nem RLS versionada no repositório — risco de
-- exposição de arquivo entre organizações se algum foi criado público ou sem policy.
-- Cria os dois PRIVADOS + RLS por organização (a pasta raiz do objeto é o organization_id,
-- igual a `rdo-photos`). Idempotente (on conflict / drop policy if exists).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção).

insert into storage.buckets (id, name, public) values ('bim-uploads', 'bim-uploads', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('project-documents', 'project-documents', false)
  on conflict (id) do nothing;

-- Garante privado mesmo se já existiam como públicos.
update storage.buckets set public = false where id in ('bim-uploads', 'project-documents');

-- ── bim-uploads ───────────────────────────────────────────────────────────────
drop policy if exists "bim_uploads_select" on storage.objects;
drop policy if exists "bim_uploads_insert" on storage.objects;
drop policy if exists "bim_uploads_update" on storage.objects;
drop policy if exists "bim_uploads_delete" on storage.objects;

create policy "bim_uploads_select" on storage.objects for select to authenticated
  using (bucket_id = 'bim-uploads' and (storage.foldername(name))[1] = public.user_org()::text);
create policy "bim_uploads_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'bim-uploads' and (storage.foldername(name))[1] = public.user_org()::text);
create policy "bim_uploads_update" on storage.objects for update to authenticated
  using (bucket_id = 'bim-uploads' and (storage.foldername(name))[1] = public.user_org()::text)
  with check (bucket_id = 'bim-uploads' and (storage.foldername(name))[1] = public.user_org()::text);
create policy "bim_uploads_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'bim-uploads' and (storage.foldername(name))[1] = public.user_org()::text);

-- ── project-documents ─────────────────────────────────────────────────────────
drop policy if exists "project_documents_select" on storage.objects;
drop policy if exists "project_documents_insert" on storage.objects;
drop policy if exists "project_documents_update" on storage.objects;
drop policy if exists "project_documents_delete" on storage.objects;

create policy "project_documents_select" on storage.objects for select to authenticated
  using (bucket_id = 'project-documents' and (storage.foldername(name))[1] = public.user_org()::text);
create policy "project_documents_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-documents' and (storage.foldername(name))[1] = public.user_org()::text);
create policy "project_documents_update" on storage.objects for update to authenticated
  using (bucket_id = 'project-documents' and (storage.foldername(name))[1] = public.user_org()::text)
  with check (bucket_id = 'project-documents' and (storage.foldername(name))[1] = public.user_org()::text);
create policy "project_documents_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-documents' and (storage.foldername(name))[1] = public.user_org()::text);
