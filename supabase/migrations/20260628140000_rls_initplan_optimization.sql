-- 20260628140000_rls_initplan_optimization.sql
-- Tier 3a: otimização de RLS por InitPlan (recomendação oficial do Supabase/Postgres).
--
-- Hoje as policies usam `organization_id = public.user_org()` (e auth.uid()/user_role())
-- na forma INLINE — o Postgres reavalia a função UMA VEZ POR LINHA varrida.
-- Envolvendo num scalar subquery `(SELECT public.user_org())`, o planner avalia
-- UMA VEZ POR QUERY (InitPlan, cacheado), o que acelera muito tabelas grandes.
--
-- Por que é SEGURO:
--   • A transformação é SEMANTICAMENTE IDÊNTICA (mesmo valor escalar).
--   • Roda num DO block TRANSACIONAL: se qualquer ALTER POLICY falhar, faz
--     rollback de TUDO — nunca fica meio-migrado nem tranca acesso.
--   • IDEMPOTENTE: primeiro "desembrulha" as já-envolvidas, depois envolve —
--     pode reaplicar sem dobrar.
--   • Só toca policies que contêm essas funções; as demais ficam intactas.
--
-- ⚠️ APLICAR PRIMEIRO EM HOMOLOGAÇÃO. Depois de aplicar, confirme acesso normal
--    (abrir os módulos, listar obras/RDOs) antes de levar para produção.
--    Rollback no fim do arquivo (comentado).

DO $$
DECLARE
  r          record;
  q          text;
  c          text;
  q0         text;
  c0         text;
  -- funções sem argumento, STABLE, seguras de envolver em (SELECT ...).
  -- `\m` = início de palavra (Postgres): evita casar dentro de identificadores
  -- como super_user_org() ou get_uid().
  fns        text[][] := ARRAY[
                 ARRAY['public.user_org',  '\m(public\.)?user_org'],
                 ARRAY['public.user_role', '\m(public\.)?user_role'],
                 ARRAY['auth.uid',         '\m(auth\.)?uid']
               ];
  qualified  text;
  pat        text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '(user_org|user_role|uid)\s*\('
  LOOP
    q  := r.qual;
    c  := r.with_check;
    q0 := q;
    c0 := c;

    FOR i IN 1 .. array_length(fns, 1) LOOP
      qualified := fns[i][1];                 -- ex.: public.user_org
      pat       := fns[i][2];                 -- ex.: (public\.)?user_org

      -- 1) normaliza já-envolvidas de volta para a forma base (idempotência)
      IF q IS NOT NULL THEN
        q := regexp_replace(q, '\(\s*SELECT\s+' || pat || '\s*\(\s*\)\s*\)', qualified || '()', 'gi');
      END IF;
      IF c IS NOT NULL THEN
        c := regexp_replace(c, '\(\s*SELECT\s+' || pat || '\s*\(\s*\)\s*\)', qualified || '()', 'gi');
      END IF;

      -- 2) envolve cada chamada base em (SELECT schema.fn())
      IF q IS NOT NULL THEN
        q := regexp_replace(q, pat || '\s*\(\s*\)', '(SELECT ' || qualified || '())', 'gi');
      END IF;
      IF c IS NOT NULL THEN
        c := regexp_replace(c, pat || '\s*\(\s*\)', '(SELECT ' || qualified || '())', 'gi');
      END IF;
    END LOOP;

    -- Só altera se algo mudou (evita churn em policies sem essas funções).
    IF q IS DISTINCT FROM q0 OR c IS DISTINCT FROM c0 THEN
      IF q IS NOT NULL AND c IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', r.policyname, r.tablename, q, c);
      ELSIF q IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, q);
      ELSIF c IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, c);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ── Verificação (rodar depois, como usuário autenticado normal) ──
--   SELECT count(*) FROM public.rdo;                 -- deve retornar normalmente
--   SELECT count(*) FROM public.construction_sites;  -- idem
--   EXPLAIN SELECT * FROM public.rdo;                -- o filtro de RLS deve aparecer como InitPlan
--   -- Conferir quantas policies já estão na forma (SELECT ...):
--   SELECT count(*) FROM pg_policies WHERE schemaname='public' AND qual ILIKE '%(select%user_org%';

-- ── Rollback (se necessário) — reaplica a forma inline ──
--   Rodar o mesmo DO block trocando o passo (2) por nada e mantendo só o passo (1)
--   "normaliza" desembrulha tudo de volta. (Guardado fora desta migration para
--   não executar acidentalmente.)
