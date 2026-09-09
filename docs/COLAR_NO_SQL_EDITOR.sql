-- ═══════════════════════════════════════════════════════════════════════════════
-- COLAR NO SUPABASE → SQL EDITOR, rodar, e me mandar o resultado.
--
-- ⚠️ SOMENTE LEITURA. Não cria, não altera, não apaga nada.
--
-- (O conteúdo anterior — a tabela `app_state` — não era necessário: você rodou o
--  diagnóstico em 09/09/2026 e deu OK nos quatro itens. A tabela sempre esteve
--  aplicada; o alarme foi meu, de um `grep` estreito demais. Registrado agora em
--  `docs/APLICAR_MIGRACOES.md` na lista de confirmadas.)
--
-- O QUE ISTO RESPONDE: o módulo Medição tem dado real de cliente?
--
-- Ele é o segundo maior do sistema (13.060 linhas, 4 stores) e 11 pontos de
-- outros módulos dependem dele. Decidimos NÃO apagá-lo — mas ainda não sabemos
-- se as tabelas dele estão cheias ou vazias, e isso muda o quanto ele pesa nas
-- próximas decisões.
--
-- E tem uma pergunta de bônus, que vale para a Medição nova: a tabela
-- `contract_price_items` existe no banco e NENHUMA linha de código a usa. Se ela
-- estiver vazia, está livre.
--
-- ⚠️ Consulta ÚNICA (o SQL Editor só mostra o resultado da última), e ela pula
-- sozinha qualquer tabela que não exista — não quebra.
-- ═══════════════════════════════════════════════════════════════════════════════

with alvo(ordem, tabela, papel) as (
  values
    -- Escritas pelo app hoje. Se tiverem linha, há dado de cliente.
    (1, 'measurement_billing_boletins',   'Boletim inteiro (jsonb) — módulo Medição'),
    (2, 'measurement_periods',            'Período de medição — camada unificada'),
    (3, 'measurement_contract_items',     'Item contratual — camada unificada'),
    (4, 'measurement_memory_lines',       'Memória de cálculo — camada unificada'),
    (5, 'measurement_financial_entries',  'Retenções/descontos/NF — camada unificada'),
    (6, 'measurement_sources',            'Fonte da quantidade (RDO/planilha)'),
    -- Escrita pelo módulo de empreiteiros, fora da Medição.
    (7, 'measurement_adjustments',        'Ajuste por empreiteiro (contractorStore)'),
    -- Schema sem nenhum caminho de escrita no front.
    (8, 'contract_price_items',           'ORFA — catálogo de preços que ninguém usa'),
    (9, 'measurement_bulletins',          'ORFA — boletim da Fase 1, abandonada'),
    (10,'measurement_bulletin_items',     'ORFA — linhas do boletim Fase 1')
)
select
  a.ordem,
  a.tabela,
  a.papel,
  -- `query_to_xml` conta sem precisar que a tabela exista em tempo de parse.
  (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from public.%I', a.tabela),
                      false, true, '')))[1]::text::bigint as linhas,
  case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = a.tabela
           and column_name = 'organization_id')
       then (xpath('/row/c/text()',
              query_to_xml(format('select count(distinct organization_id) as c from public.%I', a.tabela),
                           false, true, '')))[1]::text::bigint
       else null end as empresas
from alvo a
where to_regclass('public.' || a.tabela) is not null
order by a.ordem;
