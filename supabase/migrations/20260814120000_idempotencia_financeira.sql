-- 20260814120000_idempotencia_financeira.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (ver docs/APLICAR_MIGRACOES.md).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- REDE DE SEGURANÇA CONTRA COBRANÇA DUPLICADA
--
-- O QUE ISTO RESOLVE. Os stores são local-first: a escrita é otimista e a fila envia
-- `insert` como upsert por id. Isso já protege contra reenviar a mesma operação. O que não
-- protegia era o mesmo fato de negócio nascer em DOIS lugares — dois dispositivos, duas abas,
-- o botão clicado antes do pull chegar. Cada lado sorteava um id diferente e o banco guardava
-- os dois: dinheiro duplicado no Fluxo, na DRE e na cobrança do condomínio.
--
-- A correção principal é no cliente: o id passou a ser DERIVADO da chave de negócio
-- (`src/lib/seededId.ts`), então os dois lados chegam ao mesmo id e o segundo upsert regrava a
-- mesma linha. Este arquivo é a segunda linha de defesa — o banco recusando a duplicata mesmo
-- que um caminho novo esqueça de derivar o id.
--
-- POR QUE ÍNDICE PARCIAL. Exclusão aqui é soft delete (`deleted_at`). Um índice único total
-- impediria recriar algo que foi apagado de propósito; com `WHERE deleted_at IS NULL` a linha
-- apagada sai do índice e o espaço volta a ficar livre.
--
-- ESTA MIGRATION NÃO FALHA. Criar índice único sobre dado que já tem duplicata aborta a
-- transação inteira. Como não dá para saber daqui o que existe em produção, cada índice vem
-- dentro de um bloco que primeiro CONTA as duplicatas: se houver, ele não cria o índice e
-- imprime um aviso com quantas são e como listá-las. Rodar de novo depois da limpeza cria o
-- índice. Rodar duas vezes com tudo limpo não faz nada. Em qualquer cenário, roda até o fim.
--
-- ONDE VER O RESULTADO: a última consulta do arquivo devolve uma tabela dizendo, índice por
-- índice, se ficou criado ou pendente — não dependa dos RAISE NOTICE, que no SQL Editor ficam
-- no painel de mensagens. Para LISTAR as duplicatas que travam um índice pendente, rode a
-- Parte 2 de docs/DIAGNOSTICO_SCHEMA.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Lançamento gerado pela baixa de um título ────────────────────────────────
-- Dar baixa no mesmo título em dois dispositivos criava DOIS lançamentos no Fluxo/DRE. Pior:
-- como o payload é substituído por inteiro (último a escrever vence), o vínculo `entryId` do
-- título apontava só para um deles e o outro virava um fantasma que ninguém conseguia apagar.
-- O cliente agora grava `sourceTituloId` no lançamento; a chave natural é (org, título).
do $$
declare
  duplicatas int;
begin
  if to_regclass('public.financeiro_entries') is null then
    raise notice '[pulado] tabela financeiro_entries não existe';
    return;
  end if;

  select count(*) into duplicatas from (
    select 1 from public.financeiro_entries
     where deleted_at is null and coalesce(payload->>'sourceTituloId', '') <> ''
     group by organization_id, payload->>'sourceTituloId'
    having count(*) > 1
  ) d;

  if duplicatas > 0 then
    raise notice '[NAO criado] uniq_fin_entries_source_titulo — % titulo(s) com mais de um lancamento. Rode a Parte 2 de docs/DIAGNOSTICO_SCHEMA.sql para listar e limpar, depois rode esta migration de novo.', duplicatas;
  else
    create unique index if not exists uniq_fin_entries_source_titulo
      on public.financeiro_entries (organization_id, (payload->>'sourceTituloId'))
      where deleted_at is null and coalesce(payload->>'sourceTituloId', '') <> '';
    raise notice '[ok] uniq_fin_entries_source_titulo';
  end if;
end $$;

-- ── 2. Cobrança de rateio do condomínio ─────────────────────────────────────────
-- Um ITEM do rateio não pode virar duas cobranças. A chave é o item, não a unidade: duas
-- unidades podem ter o mesmo nome de propósito — "Bloco A" com dois hidrômetros são duas
-- cobranças legítimas —, e indexar por (rateio, nome da unidade) rejeitaria a segunda. O
-- INSERT falharia com 23505, a operação ficaria presa na fila de sincronização e o condomínio
-- sairia subfaturado, sem ninguém entender por quê. Por isso o cliente passou a gravar
-- `rateioItemId` no payload (src/store/rateioConsumoStore.ts).
--
-- Desfazer a emissão faz soft delete e avança a geração, então as linhas antigas saem do
-- índice parcial e emitir de novo continua funcionando.
--
-- Cobranças emitidas ANTES desta migration não têm `rateioItemId` e ficam de fora do índice
-- (a condição exige o campo preenchido). É de propósito: elas seguem protegidas pelo id
-- derivado do cliente, e forçá-las para dentro do índice só criaria conflito com dado antigo.
do $$
declare
  duplicatas int;
begin
  if to_regclass('public.financeiro_titulos') is null then
    raise notice '[pulado] tabela financeiro_titulos não existe';
    return;
  end if;

  select count(*) into duplicatas from (
    select 1 from public.financeiro_titulos
     where deleted_at is null and coalesce(payload->>'rateioItemId', '') <> ''
     group by organization_id, payload->>'rateioItemId'
    having count(*) > 1
  ) d;

  if duplicatas > 0 then
    raise notice '[NAO criado] uniq_fin_titulos_rateio_item — % item(ns) de rateio cobrados duas vezes. Rode a Parte 2 de docs/DIAGNOSTICO_SCHEMA.sql para listar e limpar, depois rode esta migration de novo.', duplicatas;
  else
    create unique index if not exists uniq_fin_titulos_rateio_item
      on public.financeiro_titulos (organization_id, (payload->>'rateioItemId'))
      where deleted_at is null and coalesce(payload->>'rateioItemId', '') <> '';
    raise notice '[ok] uniq_fin_titulos_rateio_item';
  end if;
end $$;

-- ── 3. Linha digitável de boleto ────────────────────────────────────────────────
-- A linha digitável é única por definição no sistema bancário: o mesmo código em dois títulos
-- é sempre erro de cadastro — ou a parcela foi lançada duas vezes, ou alguém colou o código
-- errado. Escopo por organização porque um cliente não pode interferir no cadastro do outro.
do $$
declare
  duplicatas int;
begin
  if to_regclass('public.financeiro_titulos') is null then
    return;
  end if;

  select count(*) into duplicatas from (
    select 1 from public.financeiro_titulos
     where deleted_at is null and coalesce(payload->>'codigoBoleto', '') <> ''
     group by organization_id, payload->>'codigoBoleto'
    having count(*) > 1
  ) d;

  if duplicatas > 0 then
    raise notice '[NAO criado] uniq_fin_titulos_codigo_boleto — % linha(s) digitavel(is) repetida(s). Rode a Parte 2 de docs/DIAGNOSTICO_SCHEMA.sql para listar e limpar, depois rode esta migration de novo.', duplicatas;
  else
    create unique index if not exists uniq_fin_titulos_codigo_boleto
      on public.financeiro_titulos (organization_id, (payload->>'codigoBoleto'))
      where deleted_at is null and coalesce(payload->>'codigoBoleto', '') <> '';
    raise notice '[ok] uniq_fin_titulos_codigo_boleto';
  end if;
end $$;

-- ── Veredito, em forma de tabela ────────────────────────────────────────────────
select
  case when i.indexname is not null then '  OK  ' else '❌ pendente (há duplicata)' end as situacao,
  esperado.nome as indice,
  esperado.descricao
from (values
  ('uniq_fin_entries_source_titulo',  'um lançamento por baixa de título'),
  ('uniq_fin_titulos_rateio_item',    'uma cobrança por item de rateio'),
  ('uniq_fin_titulos_codigo_boleto',  'uma linha digitável não se repete')
) as esperado(nome, descricao)
left join pg_indexes i
  on i.schemaname = 'public' and i.indexname = esperado.nome
order by 1 desc, 2;
