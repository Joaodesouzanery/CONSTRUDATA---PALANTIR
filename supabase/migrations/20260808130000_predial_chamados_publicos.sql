-- QR público em cascata: morador/zelador abre um chamado de manutenção SEM login, via QR do
-- prédio. Grava numa tabela de STAGING por uma RPC anônima (SECURITY DEFINER) que resolve a
-- organização pelo slug DENTRO do servidor (o cliente nunca envia organization_id). O síndico
-- tria depois (logado) e converte em OS. Molde: accept_invitation (grant to anon) + predial_laudos.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

-- 1) Slug público por prédio (coluna REAL — a RPC anônima filtra por SQL/índice; o app também
--    espelha o slug no payload jsonb do site). Único por org ativa (ignora soft-deleted).
alter table public.construction_sites add column if not exists public_slug text;
create unique index if not exists idx_construction_sites_public_slug
  on public.construction_sites(public_slug)
  where public_slug is not null and deleted_at is null;

-- 2) Tabela de staging do chamado público (write-only para anon: só a RPC insere; leitura/edição
--    só para membros autenticados da própria org).
create table if not exists public.predial_chamados_publicos (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  construction_site_id uuid references public.construction_sites(id) on delete set null,
  predio_slug          text not null,
  sistema              text,
  componente           text,
  sintoma              text,
  impacto              text not null default 'media' check (impacto in ('baixa','media','alta')),
  urgencia             text not null default 'media' check (urgencia in ('baixa','media','alta')),
  prioridade           text not null default 'media' check (prioridade in ('baixa','media','alta','critica')),
  descricao            text,
  solicitante_nome     text,
  solicitante_contato  text,
  local_texto          text,
  status               text not null default 'novo' check (status in ('novo','em_triagem','convertido','descartado')),
  work_order_id        uuid references public.maintenance_work_orders(id) on delete set null,
  origem               text not null default 'qr',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_chamados_publicos_org_status  on public.predial_chamados_publicos(organization_id, status, created_at desc);
create index if not exists idx_chamados_publicos_slug_created on public.predial_chamados_publicos(predio_slug, created_at desc);

-- RLS: ENABLE (não FORCE) — a RPC SECURITY DEFINER (dona da tabela) precisa INSERIR contornando
-- as policies; membros autenticados só leem/atualizam a PRÓPRIA org; anon não tem acesso direto
-- (só escreve via a RPC → org confiável, sem enumeração/vazamento entre prédios).
alter table public.predial_chamados_publicos enable row level security;

drop policy if exists "chamados_publicos_select" on public.predial_chamados_publicos;
create policy "chamados_publicos_select" on public.predial_chamados_publicos
  for select to authenticated
  using (organization_id = public.user_org());

drop policy if exists "chamados_publicos_update" on public.predial_chamados_publicos;
create policy "chamados_publicos_update" on public.predial_chamados_publicos
  for update to authenticated
  using (organization_id = public.user_org())
  with check (organization_id = public.user_org());
-- Sem policy de INSERT/DELETE: inserção só pela RPC; sem exclusão direta (o síndico "descarta").

revoke all on public.predial_chamados_publicos from anon;
grant select, update on public.predial_chamados_publicos to authenticated;

-- 3) RPC anônima: resolve o prédio pelo slug (org vem do servidor), aplica anti-spam
--    (honeypot + rate-limit) e insere na staging. NÃO usa auth.uid().
create or replace function public.abrir_chamado_publico(
  p_slug      text,
  p_sistema   text default null,
  p_componente text default null,
  p_sintoma   text default null,
  p_impacto   text default 'media',
  p_urgencia  text default 'media',
  p_descricao text default null,
  p_nome      text default null,
  p_contato   text default null,
  p_local     text default null,
  p_honeypot  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site  record;
  v_id    uuid;
  v_count int;
  v_imp   text := coalesce(nullif(trim(p_impacto), ''), 'media');
  v_urg   text := coalesce(nullif(trim(p_urgencia), ''), 'media');
  v_prio  text;
begin
  -- Honeypot: bot preencheu o campo-armadilha → devolve um id falso, sem inserir.
  if p_honeypot is not null and length(trim(p_honeypot)) > 0 then
    return gen_random_uuid();
  end if;

  if v_imp not in ('baixa','media','alta') then v_imp := 'media'; end if;
  if v_urg not in ('baixa','media','alta') then v_urg := 'media'; end if;

  -- Resolve o prédio pelo slug (a organização NUNCA vem do cliente).
  select cs.id as site_id, cs.organization_id
    into v_site
    from public.construction_sites cs
   where cs.public_slug = p_slug
     and cs.deleted_at is null;
  if not found then
    raise exception 'Prédio inválido.' using errcode = '22023';   -- mensagem genérica (não revela se a org existe)
  end if;

  -- Rate-limit: no máximo 20 chamados por prédio por hora (anti-spam sem captcha).
  select count(*) into v_count
    from public.predial_chamados_publicos
   where predio_slug = p_slug
     and created_at > now() - interval '1 hour';
  if v_count >= 20 then
    raise exception 'Muitas solicitações. Tente novamente mais tarde.' using errcode = '54000';
  end if;

  -- Prioridade = matriz impacto×urgência (equivalente a prioridadeDaMatriz de chamadoCatalogo.ts).
  v_prio := case
    when v_imp = 'alta'  and v_urg = 'alta'  then 'critica'
    when v_imp = 'alta'  and v_urg = 'media' then 'alta'
    when v_imp = 'media' and v_urg = 'alta'  then 'alta'
    when v_imp = 'alta'  and v_urg = 'baixa' then 'media'
    when v_imp = 'media' and v_urg = 'media' then 'media'
    when v_imp = 'baixa' and v_urg = 'alta'  then 'media'
    else 'baixa'
  end;

  insert into public.predial_chamados_publicos(
    organization_id, construction_site_id, predio_slug,
    sistema, componente, sintoma, impacto, urgencia, prioridade,
    descricao, solicitante_nome, solicitante_contato, local_texto
  ) values (
    v_site.organization_id, v_site.site_id, p_slug,
    nullif(trim(p_sistema), ''), nullif(trim(p_componente), ''), nullif(trim(p_sintoma), ''),
    v_imp, v_urg, v_prio,
    nullif(trim(p_descricao), ''), nullif(trim(p_nome), ''), nullif(trim(p_contato), ''), nullif(trim(p_local), '')
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.abrir_chamado_publico(text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.abrir_chamado_publico(text,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;
