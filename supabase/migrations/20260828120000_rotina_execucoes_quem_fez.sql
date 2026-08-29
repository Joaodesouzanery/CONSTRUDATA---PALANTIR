-- 20260828120000_rotina_execucoes_quem_fez.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
-- IDEMPOTENTE: pode rodar duas vezes. Termina com um select de conferência.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- QUEM MARCOU A ROTINA
--
-- A `20260823120000_rotinas_da_empresa` escreveu na cara (decisão 1) que NÃO se guardaria quem
-- marcou: a empresa opera com uma conta só, e o `created_by` registraria a CONTA — "feito por
-- contato@compizzo", que é verdade e não serve para nada.
--
-- Aquela decisão continua de pé para o `created_by`. O que muda é que agora se PERGUNTA: quem
-- marca escolhe ou digita o próprio nome. Continua sendo texto DECLARADO, como o `responsavel` da
-- rotina, e por isso não vira FK para `auth.users`. Mas é a diferença entre não ter dado nenhum e
-- ter o que a equipe declarou — e `responsavel` responde "de quem é a tarefa", não "quem fez".
--
-- ─── POR QUE COLUNA NOVA, E NÃO A `observacao` QUE JÁ EXISTE ────────────────────
-- `observacao` nasceu nesta tabela e nenhuma tela jamais a escreveu. Seria tentador enfiar o nome
-- nela. Mas os dois campos respondem perguntas diferentes e vão ser preenchidos juntos: "quem fez"
-- é um NOME, que se agrupa e se conta; "observação" é frase livre ("faltou material"). Numa coluna
-- só, ou se inventa um separador — que quebra no primeiro texto com dois-pontos — ou se perde um
-- dos dois.
--
-- ─── O `payload` QUE FALTAVA ────────────────────────────────────────────────────
-- `rotina_execucoes` é a ÚNICA tabela do projeto sem `payload jsonb`, o escape hatch que o resto
-- usa para campo novo sem migração (ver `rotinas.payload`, na migração de 23/08). Ele entra junto
-- aqui para o próximo campo desta tabela não custar outra ida ao SQL Editor.
--
-- ─── ENQUANTO ISTO NÃO FOR APLICADO ────────────────────────────────────────────
-- O cliente já escreve `quem_fez`. O PostgREST devolve PGRST204 ("could not find the column"), que
-- `lib/storeSync.ts` classifica como 'aguardando-servidor': a op FICA na fila, não vira erro na
-- tela, e sobe sozinha quando este SQL rodar. Marcar continua funcionando no aparelho o tempo
-- todo — mas até rodar, **nenhuma marcação nova chega ao servidor nem aos colegas**.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.rotina_execucoes
  add column if not exists quem_fez text;

alter table public.rotina_execucoes
  add column if not exists payload jsonb not null default '{}'::jsonb;

comment on column public.rotina_execucoes.quem_fez is
  'Nome DECLARADO de quem fez a tarefa. Texto, nao FK: a empresa opera com uma conta so.';

-- Nenhuma policy muda: a RLS de `rotina_execucoes` e por tabela, nao por coluna, e as policies da
-- migracao de 23/08 ja cobrem a linha inteira.

-- ── Conferência ─────────────────────────────────────────────────────────────────
select
  case when count(*) = 2
       then 'OK — quem_fez e payload existem'
       else '❌ FALTA(M) ' || (2 - count(*))::text || ' coluna(s)'
  end as situacao
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'rotina_execucoes'
  and column_name in ('quem_fez', 'payload');
