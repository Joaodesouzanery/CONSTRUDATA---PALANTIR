# O BIM saiu — e o que fazer com o que ficou no banco

Removido em 31/08/2026. Decisão do João: *"não uso para nada"*.

## O que saiu do código

`src/features/bim/` (13 arquivos), `bimStore`, `mockBim.ts`, `projectToBim.ts`, a aba da Torre, a
aba **3D / 4D / 5D** de Projetos, o botão "Importar BIM" do Mapa Interativo, e as dependências
`three`, `@types/three`, `shpjs`, `leaflet.markercluster`.

O chunk `BimCanvas` era **557 KB**, o segundo maior do app. Ele já era carregado sob demanda, então
**o carregamento inicial não muda** — quem ganha é quem abria Projetos → Visualização.

## ⚠️ Por que a "Análise do Prazo" e a "Análise do Custo" foram junto

Elas existiam, e eram exatamente o que você lembrava. Mas os números não eram seus:

- **Dado de exemplo** — `mockBim.ts` tinha três projetos sintéticos com custos escritos à mão
  (`unitCostBRL: 210`).
- **Geometria inventada** — o que a aba de Projetos mostrava vinha do `projectToBim`, que gerava
  *"um andar por fase de execução, num prédio de 20×15m"*. Não era o prédio de ninguém.
- **Custo chutado na importação** — shapefile e DXF entravam com `const unitCost = 85`, literal,
  para qualquer material e qualquer diâmetro.

Os botões "Sincronizar Planejamento / Quantitativos / SINAPI" casavam por texto (`includes`) e
falhavam em silêncio (`catch { }`) quando não achavam.

**O que valia daquilo já existe medido em outro lugar:** o avanço por serviço está na Gestão à
Vista, alimentado pelos RDOs finalizados; o custo por obra está no Custo em Tempo Real e no
Retrato da Obra.

## ⚠️ O lixo no banco — vale conferir

As tabelas **continuam existindo** com RLS e histórico. **Nada foi apagado.** Mas havia um defeito
que gerava linha sozinho: a aba Projetos → Visualização **injetava um projeto BIM sintético a cada
visita**, e isso virava `insert` no Supabase.

Para ver se sobrou lixo:

```sql
-- Quanto existe, e de quantas empresas
select count(*) as projetos,
       count(distinct organization_id) as empresas
  from public.bim_projects
 where deleted_at is null;

-- O que é lixo do injetor × o que alguém importou de verdade
select
  case
    when source_file_path is not null
      or payload->>'shapefileSourceName' is not null then 'importado por alguém'
    when type = 'building' then 'gerado pela aba Visualização (lixo)'
    else 'indefinido'
  end                              as origem,
  count(*)                         as projetos,
  sum((select count(*) from public.bim_segments s
        where s.bim_project_id = p.id and s.deleted_at is null)) as segmentos
  from public.bim_projects p
 where p.deleted_at is null
 group by 1;
```

Se der zero, não há nada a fazer. Se aparecer "gerado pela aba Visualização", é lixo e pode ir —
com **soft delete**, que é o padrão do projeto:

```sql
update public.bim_segments s
   set deleted_at = now()
 where s.deleted_at is null
   and exists (select 1 from public.bim_projects p
                where p.id = s.bim_project_id
                  and p.type = 'building'
                  and p.source_file_path is null
                  and p.payload->>'shapefileSourceName' is null);

update public.bim_projects
   set deleted_at = now()
 where deleted_at is null
   and type = 'building'
   and source_file_path is null
   and payload->>'shapefileSourceName' is null;
```

⚠️ **Rode primeiro o `select`.** Se aparecer "importado por alguém", pare e me avise — aí há modelo
de verdade ali, e a conversa é outra.

## Se um dia voltar

O que faria sentido não é o visualizador 3D, é a **análise por serviço com dado real**: prazo e
custo lidos do contrato e dos RDOs, sem geometria nenhuma. Boa parte já existe na Gestão à Vista —
o que falta é a coluna de *previsto*, que depende de um cronograma por serviço que o produto ainda
não guarda.
