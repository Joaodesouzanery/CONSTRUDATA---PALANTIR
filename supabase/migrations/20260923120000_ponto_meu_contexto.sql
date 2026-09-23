-- 20260923120000_ponto_meu_contexto.sql
--
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor, DEPOIS de `20260918160000_colaborador_so_o_ponto.sql`.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- OS QUATRO PARÂMETROS E OS FERIADOS QUE NUNCA CHEGAVAM AO CELULAR
--
-- ─── O DEFEITO QUE ESTA MIGRAÇÃO FECHA ─────────────────────────────────────────
-- A cerca de leitura do colaborador (`20260918160000`) varre TODA tabela com RLS e cria uma policy
-- restritiva que devolve vazio, menos sete exceções. Está certo: é o que impede o celular do
-- canteiro de baixar salário dos colegas.
--
-- Só que DUAS tabelas que a tela do ponto precisa caíram na varredura:
--
--   · `clt_settings`  → `raioPontoPadraoM`, `toleranciaPontoMin`, `maxWeeklyHours`, `bancoHorasMeses`
--   · `plan_holidays` → os feriados
--
-- Consequências medidas, as duas silenciosas:
--   1. o raio padrão da empresa NÃO chega — a cerca do celular cai sempre nos 5 km embutidos no
--      código, e configurar 300 m para um canteiro não tem efeito nenhum no aparelho de quem bate;
--   2. o banco de horas do funcionário trata 7 de setembro como dia útil devedor, porque
--      `previstoDoDia` recebe um conjunto de feriados VAZIO. O saldo sai errado para MENOS,
--      exatamente no número que ele usa para conferir se está sendo pago direito.
--
-- ─── POR QUE UMA RPC, E NÃO ABRIR AS DUAS TABELAS ──────────────────────────────
-- Tirar `clt_settings` da varredura devolveria o payload INTEIRO: tabela de INSS e IRRF, RAT/FAP,
-- percentuais de VA/VT e o teto de custo de RH da empresa. Nada disso é da conta de quem bate o
-- ponto, e a cerca existe justamente para isso.
--
-- Esta função devolve QUATRO números e uma lista de datas. Nada mais. É `security definer` porque
-- precisa enxergar por cima da policy restritiva — e é `stable`, sem parâmetro nenhum, lendo
-- sempre a organização de quem chamou via `public.user_org()`.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.ponto_meu_contexto()
returns jsonb
language sql
stable
security definer
-- ⚠️ `search_path` fixo: sem ele, uma função `security definer` pode ser induzida a resolver um
-- nome para um objeto plantado em outro schema pelo chamador.
set search_path = public
as $fn$
  select jsonb_build_object(
    -- ⚠️ SÓ estes quatro. O payload de `clt_settings` carrega as tabelas de imposto e o teto de
    -- custo do RH; devolvê-lo inteiro seria furar a cerca de `20260918160000` por outra porta.
    'parametros', coalesce((
      select jsonb_build_object(
        'raioPontoPadraoM',   s.payload->'raioPontoPadraoM',
        'toleranciaPontoMin', s.payload->'toleranciaPontoMin',
        'maxWeeklyHours',     s.payload->'maxWeeklyHours',
        'bancoHorasMeses',    s.payload->'bancoHorasMeses')
      from public.clt_settings s
      where s.organization_id = public.user_org()
        and s.deleted_at is null
      limit 1), '{}'::jsonb),

    -- Treze meses para trás cobrem o espelho do mês, a conferência do mês anterior e a janela de
    -- vencimento do banco de horas (art. 59 §5º, 6 a 12 meses). Puxar o histórico inteiro seria
    -- mandar anos de datas para um aparelho de canteiro a cada `pull`.
    'feriados', coalesce((
      select jsonb_agg(h.date order by h.date)
      from public.plan_holidays h
      where h.organization_id = public.user_org()
        and h.deleted_at is null
        and h.date >= (current_date - interval '13 months')), '[]'::jsonb)
  );
$fn$;

comment on function public.ponto_meu_contexto() is
  'Os parâmetros do ponto e os feriados da organização, para a tela de bater ponto. Existe porque '
  'clt_settings e plan_holidays estão dentro da cerca restritiva do papel colaborador.';

grant execute on function public.ponto_meu_contexto() to authenticated;

-- ── Conferência ────────────────────────────────────────────────────────────────
do $$
declare r jsonb;
begin
  select public.ponto_meu_contexto() into r;
  raise notice '%  ponto_meu_contexto responde (parametros=%, feriados=%)',
    case when r ? 'parametros' and r ? 'feriados' then '  OK  ' else '❌ FALHA' end,
    r->'parametros', jsonb_array_length(coalesce(r->'feriados', '[]'::jsonb));
end $$;
