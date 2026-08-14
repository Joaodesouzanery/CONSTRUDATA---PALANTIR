-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO DE SCHEMA — o que já está aplicado em produção?
--
-- POR QUE ISTO EXISTE: as migrations deste projeto são aplicadas à mão no SQL Editor
-- (ver docs/APLICAR_MIGRACOES.md) e não há tabela de controle. Não dá para saber pelo
-- repositório o que o banco realmente tem. Este script responde isso.
--
-- COMO USAR: cole tudo no Supabase SQL Editor (produção) e rode. Ele NÃO altera nada —
-- é só leitura. Copie o resultado e mande de volta.
--
-- O QUE OLHAR PRIMEIRO: as duas linhas marcadas [ISOLAMENTO]. Se qualquer uma vier
-- "FALTA", há risco de vazamento de dado entre empresas e a correção é urgente. As duas
-- migrations correspondentes são idempotentes — dá para aplicar sem medo de rodar duas vezes.
-- ═══════════════════════════════════════════════════════════════════════════════

with checagens(ordem, item, migration, existe) as (

  -- ── [ISOLAMENTO] os dois mais importantes ──────────────────────────────────
  select 1, '[ISOLAMENTO] Buckets bim-uploads e project-documents são PRIVADOS',
         '20260805120000_storage_buckets_missing_rls',
         (select count(*) = 2 from storage.buckets
           where id in ('bim-uploads','project-documents') and public = false)
  union all
  select 2, '[ISOLAMENTO] RLS por organização nos dois buckets (8 policies)',
         '20260805120000_storage_buckets_missing_rls',
         (select count(*) >= 8 from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and (policyname like 'bim_uploads%' or policyname like 'project_documents%'))
  union all
  select 3, '[ISOLAMENTO] Trigger que impede lançamento apontar para obra de outra empresa',
         '20260805120100_financeiro_obra_same_org',
         (select count(*) = 2 from pg_trigger
           where tgname in ('tenant_fk_financeiro_entries_obra','tenant_fk_financeiro_distribuicoes_obra'))

  -- ── Tabelas ────────────────────────────────────────────────────────────────
  union all select 10, 'Tabela app_state', '20260710130000_app_state',
    (select to_regclass('public.app_state') is not null)
  union all select 11, 'Tabela financeiro_titulos (boletos e pagamentos)', '20260723120000_financeiro_titulos',
    (select to_regclass('public.financeiro_titulos') is not null)
  union all select 12, 'Tabela rateio_consumo (condomínio)', '20260724120000_rateio_consumo',
    (select to_regclass('public.rateio_consumo') is not null)
  union all select 13, 'Tabela predial_laudos', '20260803130000_predial_laudos',
    (select to_regclass('public.predial_laudos') is not null)
  union all select 14, 'Tabela predial_chamados_publicos (QR público)', '20260808130000_predial_chamados_publicos',
    (select to_regclass('public.predial_chamados_publicos') is not null)

  -- ── Funções e triggers ─────────────────────────────────────────────────────
  union all select 20, 'Numeração de RDO atribuída pelo servidor', '20260728120000_rdo_number_server_assign',
    (select count(*) = 1 from pg_proc where proname = 'assign_rdo_number')
  union all select 21, 'Numeração de FVS atribuída pelo servidor', '20260728120200_fvs_number_server_assign',
    (select count(*) = 1 from pg_proc where proname = 'assign_fvs_number')
  union all select 22, 'Numeração de não conformidade pelo servidor', '20260728120300_quality_nc_number_server_assign',
    (select count(*) = 1 from pg_proc where proname = 'assign_quality_nc_number')
  union all select 23, 'RPC do chamado público (com rate limit e honeypot)', '20260808130000_predial_chamados_publicos',
    (select count(*) = 1 from pg_proc where proname = 'abrir_chamado_publico')
  union all select 24, 'RPCs de direitos do titular (LGPD)', '20260808140000_lgpd_direitos_titular',
    (select count(*) = 2 from pg_proc where proname in ('export_dados_titular','anonimizar_dados_titular'))
  union all select 25, 'Trava contra auto-promoção de papel', '20260623120000_security_role_guard',
    (select count(*) >= 1 from pg_trigger where tgname like '%profile_self_privilege%')

  -- ── Buckets de storage ─────────────────────────────────────────────────────
  union all select 30, 'Bucket rdo-photos', '20260722130000_rdo_photos_bucket',
    (select count(*) = 1 from storage.buckets where id = 'rdo-photos')
  union all select 31, 'Bucket predial-ativos', '20260803120000_predial_ativos_bucket',
    (select count(*) = 1 from storage.buckets where id = 'predial-ativos')
  union all select 32, 'Bucket boletos', '20260808120000_boletos_bucket',
    (select count(*) = 1 from storage.buckets where id = 'boletos')
  union all select 33, 'TODOS os buckets são privados', '(vários)',
    (select count(*) = 0 from storage.buckets where public = true)

  -- ── Papéis e realtime ──────────────────────────────────────────────────────
  union all select 40, 'Papéis prediais (sindico/zelador/morador) no enum', '20260808150000_user_role_predial',
    (select count(*) = 3 from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'user_role' and e.enumlabel in ('sindico','zelador','morador'))
  union all select 41, 'Realtime habilitado nas tabelas previstas', '20260711120000_enable_realtime',
    (select count(*) > 0 from pg_publication_tables where pubname = 'supabase_realtime')
)
select
  case when existe then '  OK  ' else '❌ FALTA' end as situacao,
  item,
  migration
from checagens
order by (case when existe then 1 else 0 end), ordem;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEGUNDA PARTE — duplicatas financeiras já existentes
--
-- A próxima etapa do trabalho cria índices únicos para impedir cobrança duplicada.
-- Se já houver duplicata no banco, a criação do índice FALHA. Isto lista o que teria
-- de ser limpo antes. Resultado vazio = pode criar os índices tranquilo.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Lançamentos gerados por baixa de título: mais de um lançamento para o mesmo título
select 'lançamento duplicado por baixa de título' as problema,
       organization_id, payload->>'referencia' as referencia,
       payload->>'valor' as valor, count(*) as vezes
  from public.financeiro_entries
 where deleted_at is null and coalesce(payload->>'referencia','') <> ''
 group by organization_id, payload->>'referencia', payload->>'valor', payload->>'data'
having count(*) > 1
 order by vezes desc
 limit 50;

-- Cobranças de rateio: mais de um título para a mesma unidade no mesmo rateio
select 'cobrança de rateio duplicada' as problema,
       organization_id, payload->>'descricao' as descricao,
       payload->>'parceiro' as unidade, count(*) as vezes
  from public.financeiro_titulos
 where deleted_at is null and payload->>'descricao' ilike '%rateio%'
 group by organization_id, payload->>'descricao', payload->>'parceiro', payload->>'vencimento'
having count(*) > 1
 order by vezes desc
 limit 50;

-- Boletos: mesma linha digitável cadastrada mais de uma vez
select 'mesma linha digitável em títulos diferentes' as problema,
       organization_id, payload->>'codigoBoleto' as linha_digitavel, count(*) as vezes
  from public.financeiro_titulos
 where deleted_at is null and coalesce(payload->>'codigoBoleto','') <> ''
 group by organization_id, payload->>'codigoBoleto'
having count(*) > 1
 order by vezes desc
 limit 50;
