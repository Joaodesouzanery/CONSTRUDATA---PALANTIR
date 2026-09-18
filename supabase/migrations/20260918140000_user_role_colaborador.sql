-- Ponto eletrônico — o papel do funcionário que só bate o ponto.
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- POR QUE UM PAPEL NOVO
--
-- Hoje NENHUM dos 11 papéis serve: todos os 24 itens do menu aparecem para qualquer usuário
-- autenticado (o filtro da Sidebar só tem 3 flags, todas no grupo ADMIN), e `visualizador` — o mais
-- restrito — vê o sistema inteiro, apenas sem escrever. Para o ponto eletrônico é o contrário do
-- que se precisa: alguém que vê UMA tela e ESCREVE nela.
--
-- ⚠️ `ADD VALUE` é aditivo e seguro, mas o valor novo NÃO pode ser usado na MESMA transação em que
-- é criado. Por isso esta migração só adiciona; as policies que citam 'colaborador' vêm na
-- migração do ponto, depois. Mesmo cuidado de `20260808150000_user_role_predial`.
--
-- Espelhar em `src/types/database.ts` (UserRole) e em `src/lib/roles.ts` (ROLE_LABELS).
-- ═══════════════════════════════════════════════════════════════════════════════

alter type public.user_role add value if not exists 'colaborador';

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 1 then '  OK  ' else '❌ FALTA' end as situacao,
  'valor colaborador no enum user_role' as item
from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'user_role' and e.enumlabel = 'colaborador';
