-- Segurança (auditoria): `financeiro_entries.obra_id` e `financeiro_distribuicoes.obra_id`
-- são `uuid` sem FK nem validação de organização — um cliente forjado poderia gravar um
-- registro apontando para uma obra de OUTRA organização. A RLS filtra a LEITURA por org,
-- mas não valida o ponteiro. Adiciona os triggers `enforce_same_organization_fk` (mesmo
-- mecanismo já usado nas tabelas de manutenção) para bloquear referência cruzada entre
-- tenants em INSERT/UPDATE. Idempotente. Só afeta linhas novas/alteradas (não valida as
-- antigas), então é seguro aplicar mesmo com dado histórico.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção).

drop trigger if exists tenant_fk_financeiro_entries_obra on public.financeiro_entries;
create trigger tenant_fk_financeiro_entries_obra
  before insert or update of organization_id, obra_id on public.financeiro_entries
  for each row execute function public.enforce_same_organization_fk('public', 'construction_sites', 'obra_id', 'id');

drop trigger if exists tenant_fk_financeiro_distribuicoes_obra on public.financeiro_distribuicoes;
create trigger tenant_fk_financeiro_distribuicoes_obra
  before insert or update of organization_id, obra_id on public.financeiro_distribuicoes
  for each row execute function public.enforce_same_organization_fk('public', 'construction_sites', 'obra_id', 'id');

-- OPCIONAL (integridade referencial, não segurança): depois de garantir que não há obra_id
-- órfão, dá para adicionar a FK. `not valid` evita checar as linhas existentes na criação:
--   alter table public.financeiro_entries
--     add constraint financeiro_entries_obra_fk foreign key (obra_id)
--     references public.construction_sites(id) on delete set null not valid;
--   alter table public.financeiro_distribuicoes
--     add constraint financeiro_distribuicoes_obra_fk foreign key (obra_id)
--     references public.construction_sites(id) on delete set null not valid;
