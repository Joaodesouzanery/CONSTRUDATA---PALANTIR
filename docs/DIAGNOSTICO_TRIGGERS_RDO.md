# Dois gates de servidor que aceitam RDO em rascunho

**Estado:** diagnosticado, **não corrigido**. Os dois exigem migração, e migração aqui roda no
banco de produção — quero sua decisão antes.

O cliente trata rascunho com rigor: um RDO em rascunho não emite evento, não lança no Financeiro,
não baixa estoque e não avança o Planejamento Mestre. Dois gatilhos no servidor não respeitam isso.

---

## 1. Rascunho já alimenta a Medição

**Onde:** `supabase/migrations/0048_rdo_quality_measurement_sync.sql:276`, na função
`sync_regular_rdo_to_measurement`, disparada por `trg_rdo_measurement_sync` em todo INSERT/UPDATE
da tabela `rdo`.

O gate é:

```sql
IF v_rdo.deleted_at IS NOT NULL OR v_rdo.closed IS NOT TRUE THEN RETURN 0;
```

A intenção era clara: só RDO fechado alimenta medição. O problema é que **o cliente grava
`closed: true` em TODO RDO**, inclusive rascunho — `src/store/rdoStore.ts:129`. Então
`closed IS NOT TRUE` nunca é verdadeiro e o gate nunca barra nada.

**Efeito:** um RDO regular salvo em rascunho, com serviços preenchidos, já cria linhas em
`measurement_sources`. Se ele for editado ou abandonado, a medição já contou.

**Por que o Compizzo escapa:** por acidente. O painel Compizzo grava `services: []`
(`RdoCompizzoPanel.tsx`), e a função itera justamente sobre `payload.services`. Nada garante que
continue assim.

**Correção proposta** — trocar o gate para ler o status real, que é onde a verdade mora:

```sql
IF v_rdo.deleted_at IS NOT NULL
   OR COALESCE(v_rdo.payload->>'status', 'finalizado') <> 'finalizado' THEN
  RETURN 0;
END IF;
```

O `COALESCE` com `'finalizado'` preserva o comportamento dos RDOs antigos, que não têm `status` no
payload — ausência sempre significou finalizado, e é assim que `isRdoFinalized` lê no cliente.

**Antes de aplicar, conferir o estrago existente:**

```sql
-- Quantas linhas de medição vieram de RDO que hoje está em rascunho?
select count(*) as linhas_de_rascunho
from public.measurement_sources ms
join public.rdo r on r.id = ms.rdo_id
where ms.deleted_at is null
  and coalesce(r.payload->>'status', 'finalizado') <> 'finalizado';
```

---

## 2. Rascunho já move os metros de trecho, e isso não volta

**Onde:** `supabase/migrations/0035_cross_module_triggers.sql:20-60`, função
`sync_rdo_to_planejamento`, disparada em todo INSERT/UPDATE de `rdo`.

A função **não olha status nenhum** — só `executedMeters > 0`. Um rascunho com trechos preenchidos
já move `plan_trechos.executed_meters` no servidor.

**Agravante:** a atualização usa `GREATEST`, tanto no gatilho quanto no cliente
(`rdoStore.syncExecutionToPlanejamento`). `GREATEST` nunca regride. Então despromover o RDO para
rascunho, apagar o trecho ou corrigir o número **não baixa** o executado. O erro fica.

Isso é o outro lado da tabela que te mostrei: das cinco pontes do RDO, quatro revertem e a de
trechos não.

**Correção proposta** — duas partes, e a segunda é a que dói:

1. Acrescentar o mesmo gate de status da função anterior.
2. Trocar o `GREATEST` por recomputação a partir da soma dos RDOs finalizados daquele trecho. É a
   única forma de o número voltar quando o RDO é corrigido. Mais invasivo, e por isso quero
   conversar antes: existe a hipótese de alguém ter lançado avanço de trecho **à mão**, e uma
   recomputação cega apagaria esse lançamento.

**Antes de aplicar, medir a divergência:**

```sql
-- Trechos cujo executado no servidor é MAIOR que a soma dos RDOs finalizados.
-- A diferença é o resíduo de rascunho e de correção que nunca regrediu.
with soma_rdo as (
  select (t->>'trechoCode') as codigo,
         sum((t->>'executedMeters')::numeric) as metros_finalizados
  from public.rdo r,
       lateral jsonb_array_elements(coalesce(r.payload->'trechos', '[]'::jsonb)) t
  where r.deleted_at is null
    and coalesce(r.payload->>'status', 'finalizado') = 'finalizado'
  group by 1
)
select pt.codigo, pt.executed_meters as no_servidor,
       coalesce(s.metros_finalizados, 0) as soma_dos_rdos,
       pt.executed_meters - coalesce(s.metros_finalizados, 0) as diferenca
from public.plan_trechos pt
left join soma_rdo s on s.codigo = pt.codigo
where pt.deleted_at is null
  and pt.executed_meters > coalesce(s.metros_finalizados, 0)
order by diferenca desc;
```

---

## Por que não fiz junto

Os dois consertos são de banco, aplicados à mão, e mexem em dado que já existe. O primeiro é
seguro e pequeno. O segundo pode apagar avanço lançado manualmente, e isso é decisão sua, não
minha. Rode os dois SELECTs acima e me diga o tamanho do problema — com o número na mão a escolha
fica fácil.

No cliente, o que dependia só de mim já está feito: rascunho deixou de contaminar o Plano de
Execução, e as quatro pontes do RDO passaram a refazer e reverter na edição.
