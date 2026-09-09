# Medir o tempo de carga — antes e depois (5 minutos)

O boot fazia ~170 requisições: 41 stores puxavam a tabela inteira, em série dentro de cada store,
e **tudo duas vezes** (o listener de sessão relia o perfil e re-sincronizava). Consertado em
08/09/2026: o boot roda uma vez, as três leituras de auth vão em paralelo, cada store puxa suas
tabelas em paralelo, e um componente que monta não re-puxa o que foi sincronizado há < 30 s.

Só você mede o resultado real, porque depende do volume da empresa. Chrome, logado na empresa:

1. **DevTools → Network**, marque **Preserve log**, filtre por `rest/v1`. Recarregue (F5).
   - Anote: **quantas requisições** até a última terminar, e **o tempo** dela.
   - Antes do conserto apareciam **duas rodadas idênticas** (mesmas tabelas, duas vezes).
2. Ordene por **Size**. As maiores dizem onde o peso está.
   - ⚠️ Se `rdo` vier em **MB**, há foto em base64 dentro do `payload` — acontece quando o upload
     da foto falhou no aparelho e o RDO subiu com a imagem embutida. Isso fica no servidor para
     todo mundo baixar, para sempre. Me mande o tamanho; a limpeza é SQL.
3. **Console**, cole e me mande o resultado (mostra o que o navegador guarda localmente e se
   alguma chave está gorda):
   ```js
   Object.entries(localStorage).map(([k,v])=>[k,(v.length/1024).toFixed(0)+' KB']).sort((a,b)=>parseInt(b[1])-parseInt(a[1])).slice(0,10)
   ```
4. **SQL Editor** (só contagens):
   ```sql
   select 'rdo' t, count(*), pg_size_pretty(sum(pg_column_size(payload))) from public.rdo where deleted_at is null
   union all select 'financeiro_entries', count(*), pg_size_pretty(sum(pg_column_size(payload))) from public.financeiro_entries where deleted_at is null
   union all select 'audit_log', count(*), pg_size_pretty(sum(pg_column_size(before)+pg_column_size(after))) from public.audit_log;
   ```

## O que fica para a segunda rodada (mais ganho, mais risco)
- Pull incremental (`updated_at > lastSyncedAt`) em vez da tabela inteira.
- Puxar no boot só os stores da tela aberta.
- Índices `(organization_id, <coluna de ordenação>)` — `financeiro_entries` não tem nenhum.
