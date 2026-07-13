-- Habilita o Supabase Realtime (publicação supabase_realtime) nas tabelas de
-- Planejamento e Estoque, para que mudanças propaguem entre usuários/navegadores.
-- Idempotente: só adiciona a tabela se ainda não estiver na publicação.
-- (Equivale a ligar "Realtime" dessas tabelas no painel do Supabase.)

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'master_activities',
    'plano_execucao',
    'lookahead_derived_activities',
    'suprimentos_estoque_itens',
    'suprimentos_estoque_movimentacoes',
    'suprimentos_depositos'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
