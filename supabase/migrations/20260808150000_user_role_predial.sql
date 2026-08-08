-- Predial (Fase 3C) — papéis de acesso do condomínio: síndico, zelador, morador.
-- Adiciona valores ao enum public.user_role. ADD VALUE é aditivo e seguro; NÃO usar os novos
-- valores na MESMA transação em que são criados (por isso esta migração só adiciona — o gating
-- por papel é feito no app e, quando desejado, em policies numa migração posterior).
-- Espelhar os 3 valores em src/types/database.ts (UserRole).
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção).

alter type public.user_role add value if not exists 'sindico';
alter type public.user_role add value if not exists 'zelador';
alter type public.user_role add value if not exists 'morador';
