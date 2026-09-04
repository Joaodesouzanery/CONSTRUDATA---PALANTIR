-- LGPD — inclui MÃO DE OBRA nos direitos do titular, e redige o próprio log de auditoria.
--
-- ⚠️ POR QUE ESTA MIGRAÇÃO EXISTE. As duas RPCs de direitos do titular cobriam cinco fontes
-- (profiles, chamados públicos, OS, laudos, títulos) e NENHUMA de RH. Com a importação de
-- funcionários, a organização passa a deter dado de dezenas de pessoas que o produto não
-- conseguia nem exportar nem anonimizar — art. 18 sem resposta.
--
-- ⚠️ O CORPO DAS DUAS FUNÇÕES ESTÁ AQUI POR EXTENSO, e tem de continuar assim. `create or replace`
-- substitui a função INTEIRA: um arquivo com só o trecho novo faria as cinco fontes antigas
-- pararem de ser exportadas, sem erro nenhum.
--
-- ⚠️ E não há bloco `do $` nesta migração. Ver `docs/CONTROLE_DE_CAIXA.md` e o histórico: um bloco
-- desses travou uma migração inteira no editor do Supabase. Aqui não há dado antigo para conferir.
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção).

-- 1) EXPORT por titular (read-only) — devolve o "rastro" da pessoa nas fontes desta fase.
create or replace function public.export_dados_titular(p_org_id uuid, p_termo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_termo text := lower(trim(coalesce(p_termo, '')));
  v_result jsonb;
begin
  if public.user_org() is distinct from p_org_id then
    raise exception 'cross-tenant access denied' using errcode = '42501';
  end if;
  if not public.has_role(array['owner']::public.user_role[]) then
    raise exception 'only owner can export titular data' using errcode = '42501';
  end if;
  if v_termo = '' then
    raise exception 'termo obrigatório' using errcode = '22023';
  end if;

  v_result := jsonb_build_object(
    'termo', p_termo,
    'gerado_em', now(),
    'profiles', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role, 'phone', p.phone, 'created_at', p.created_at)), '[]'::jsonb)
      from public.profiles p
      where p.organization_id = p_org_id and (lower(p.email) = v_termo or lower(trim(p.full_name)) = v_termo)
    ),
    'chamados_publicos', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'created_at', c.created_at, 'solicitante_nome', c.solicitante_nome, 'solicitante_contato', c.solicitante_contato, 'local_texto', c.local_texto, 'descricao', c.descricao)), '[]'::jsonb)
      from public.predial_chamados_publicos c
      where c.organization_id = p_org_id and (lower(trim(c.solicitante_nome)) = v_termo or lower(trim(c.solicitante_contato)) = v_termo)
    ),
    'ordens_servico', (
      select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'requester', w.requester, 'assignee', w.assignee)), '[]'::jsonb)
      from public.maintenance_work_orders w
      where w.organization_id = p_org_id and (lower(trim(w.requester)) = v_termo or lower(trim(w.assignee)) = v_termo)
    ),
    'laudos', (
      select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'tipo', l.tipo, 'responsavel', l.responsavel)), '[]'::jsonb)
      from public.predial_laudos l
      where l.organization_id = p_org_id and lower(trim(l.responsavel)) = v_termo
    ),
    'titulos', (
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'descricao', t.payload->>'descricao', 'parceiro', t.payload->>'parceiro')), '[]'::jsonb)
      from public.financeiro_titulos t
      where t.organization_id = p_org_id and lower(trim(t.payload->>'parceiro')) = v_termo
    ),
    -- ── Mão de Obra (acrescentado em 04/09/2026) ────────────────────────────────
    -- ⚠️ SEM filtro `deleted_at is null`: funcionário desligado continua sendo dado que a
    -- organização detém, e o direito de acesso não depende de a pessoa ainda trabalhar lá.
    'funcionarios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', w.id, 'name', w.name, 'role', w.role, 'status', w.status,
        'crew_id', w.crew_id, 'created_at', w.created_at, 'desligado_em', w.deleted_at,
        'telefone', w.payload->>'phone', 'email', w.payload->>'email',
        'observacoes', w.payload->>'observacoes', 'tipo_cnh', w.payload->>'tipoCnh',
        'admissao', w.payload->>'admissionDate',
        -- ⚠️ O token biométrico NUNCA é devolvido: é referência opaca, e exportá-lo seria
        -- entregar num e-mail o que existe justamente para não trafegar. Diz-se que existe.
        'possui_biometria', (w.payload->>'biometricToken') is not null
      )), '[]'::jsonb)
      from public.workers w
      where w.organization_id = p_org_id and lower(trim(w.name)) = v_termo
    ),
    'equipes_como_encarregado', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name)), '[]'::jsonb)
      from public.labor_crews c
      where c.organization_id = p_org_id and lower(trim(c.payload->>'foreman')) = v_termo
    )
  );

  insert into public.audit_log(organization_id, actor_id, action, table_name, record_id, after)
  values (p_org_id, auth.uid(), 'export_titular', 'profiles', left(p_termo, 200), jsonb_build_object('termo', p_termo));

  return v_result;
end;
$$;

-- 2) ANONIMIZAÇÃO por titular (irreversível) — mascara os campos identificáveis nas mesmas fontes.
create or replace function public.anonimizar_dados_titular(p_org_id uuid, p_termo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_termo text := lower(trim(coalesce(p_termo, '')));
  v_counts jsonb;
  n_cham int; n_wo_req int; n_prof int; n_work int; n_crew int;
begin
  if public.user_org() is distinct from p_org_id then
    raise exception 'cross-tenant access denied' using errcode = '42501';
  end if;
  if not public.has_role(array['owner']::public.user_role[]) then
    raise exception 'only owner can anonymize titular data' using errcode = '42501';
  end if;
  if v_termo = '' then
    raise exception 'termo obrigatório' using errcode = '22023';
  end if;

  -- Chamado público: a submissão inteira é do próprio solicitante → redige nome/contato + o
  -- texto livre (descrição/local) que ele forneceu.
  update public.predial_chamados_publicos
     set solicitante_nome    = case when lower(trim(solicitante_nome)) = v_termo then 'Titular anonimizado' else solicitante_nome end,
         solicitante_contato = case when lower(trim(solicitante_contato)) = v_termo then null else solicitante_contato end,
         descricao   = '[removido na anonimização]',
         local_texto = null,
         updated_at = now()
   where organization_id = p_org_id and (lower(trim(solicitante_nome)) = v_termo or lower(trim(solicitante_contato)) = v_termo);
  get diagnostics n_cham = row_count;

  -- OS: mascara só o SOLICITANTE (requester). assignee é executante/prestador (não o titular do
  -- pedido) e title/description podem referir terceiros/ativos → preservados.
  update public.maintenance_work_orders set requester = 'Titular anonimizado', updated_at = now()
   where organization_id = p_org_id and lower(trim(requester)) = v_termo;
  get diagnostics n_wo_req = row_count;

  -- NÃO anonimiza laudos (responsavel = profissional) nem financeiro_titulos (parceiro = terceiro
  -- em documento fiscal): ficam sob RETENÇÃO obrigatória (LGPD art. 7º II / art. 16). Continuam no
  -- export (direito de acesso), mas não são sobrescritos.

  -- Membro (profile): mascara identificadores + soft-delete (mantém integridade de created_by).
  update public.profiles
     set full_name  = 'Titular anonimizado',
         email      = 'anonimizado+' || id::text || '@invalid.local',
         phone      = null,
         job_title  = null,
         avatar_url = null,
         deleted_at = coalesce(deleted_at, now()),
         updated_at = now()
   where organization_id = p_org_id and (lower(email) = v_termo or lower(trim(full_name)) = v_termo);
  get diagnostics n_prof = row_count;

  -- ── Mão de Obra (acrescentado em 04/09/2026) ──────────────────────────────────
  -- ⚠️ O funcionário NÃO é apagado nem tem o nome mascarado. Nome, cargo, equipe e datas são o
  -- registro trabalhista, com retenção obrigatória (CLT art. 74 §2º, FGTS, eSocial) — a LGPD
  -- art. 16 II ressalva exatamente isso. O que sai são os campos SEM base de retenção.
  --
  -- `observacoes` é o mais sensível da lista: é texto livre, pode conter qualquer coisa que
  -- alguém escreveu sobre a pessoa, e nenhuma norma manda guardá-lo.
  update public.workers
     set payload = payload - 'observacoes' - 'phone' - 'email' - 'locationNote' - 'biometricToken',
         updated_at = now()
   where organization_id = p_org_id and lower(trim(name)) = v_termo;
  get diagnostics n_work = row_count;

  update public.labor_crews
     set payload = jsonb_set(payload, '{foreman}', '"Titular anonimizado"'::jsonb),
         updated_at = now()
   where organization_id = p_org_id and lower(trim(payload->>'foreman')) = v_termo;
  get diagnostics n_crew = row_count;

  -- ⚠️ E o próprio rastro de auditoria. `trg_auditoria` grava `to_jsonb(NEW)` inteiro, então cada
  -- update acima ACABA DE COPIAR o nome real para `audit_log.before`/`after`. Sem esta redação,
  -- anonimizar seria a operação que espalha o dado que ela deveria remover.
  update public.audit_log
     set before = before - 'payload' - 'name' - 'full_name',
         after  = after  - 'payload' - 'name' - 'full_name'
   where organization_id = p_org_id
     and table_name in ('workers', 'labor_crews', 'profiles');

  v_counts := jsonb_build_object('chamados_publicos', n_cham, 'os_requester', n_wo_req, 'profiles', n_prof,
    'funcionarios_campos_redigidos', n_work, 'equipes_encarregado', n_crew,
    'funcionarios_mantidos_por_retencao_legal', n_work);

  insert into public.audit_log(organization_id, actor_id, action, table_name, record_id, after)
  values (p_org_id, auth.uid(), 'anonymize_titular', 'profiles', left(p_termo, 200), v_counts);

  return v_counts;
end;
$$;

revoke all on function public.export_dados_titular(uuid, text) from public, anon;
revoke all on function public.anonimizar_dados_titular(uuid, text) from public, anon;
grant execute on function public.export_dados_titular(uuid, text) to authenticated;
grant execute on function public.anonimizar_dados_titular(uuid, text) to authenticated;
