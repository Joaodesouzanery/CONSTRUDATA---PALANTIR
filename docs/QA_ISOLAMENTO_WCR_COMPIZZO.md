# QA de isolamento — WCR Saneamento × Compizzo

Prova, em duas camadas, que o que uma empresa grava (a) chega ao banco inteiro e (b) nunca aparece
para a outra. **Nenhuma camada sozinha prova**: o código pode estar certo e o banco sem uma
migração; o banco pode estar certo e um store guardar o dado da empresa anterior na memória.

## Camada 1 — o código (roda em CI)

```
npm run qa:isolamento
```

Quatro conferências estáticas: todo store da troca de empresa sabe se limpar; toda linha que sobe
carimba `organization_id`; toda escrita direta idem; toda tabela do inventário tem policy de
SELECT por organização. **Exit 0 é pré-requisito** para a camada 2 valer alguma coisa.

## Camada 2 — a tela (você roda, ~20 minutos)

### Antes de começar

- ⚠️ **Modo Demonstração DESLIGADO** nas duas contas. Em demo, a fila, as pendências e os
  diagnósticos são no-op — tudo dá verde por não fazer nada.
- Anote o **slug real da Compizzo de produção**. A migração semeia `compizzo-homologacao`, que é
  fictícia; se a Compizzo real for outra org, é ela que entra aqui.
- Duas contas: um `diretor` da WCR (qualquer dos quatro) e o felipe.nery2, que está nas duas.
- O SQL de conferência abaixo, aberto no SQL Editor.

### Roteiro

**Passo 1 — WCR grava.** Logado como diretor WCR:
1. Controle de Caixa → lançar 1 despesa manual (descrição `QA-ISO-WCR-1`, obra preenchida).
2. RDO → novo RDO WCR, colar um apontamento, finalizar.
3. Financeiro → FCP → importar a planilha → Criar plano.
4. Abrir o indicador de sincronização (barra lateral): **fila zerada**, nenhuma op estacionada.
5. Auditoria (menu, só diretoria): os 3 registros aparecem, com a empresa WCR.
6. SQL Editor: rodar o bloco A. Anotar as contagens da WCR.

**Passo 2 — trocar de empresa.** Logado como felipe.nery2:
1. Ainda na WCR: conferir que vê `QA-ISO-WCR-1`, o RDO e o plano.
2. Trocar para Compizzo (seletor de empresa).
3. **Nada da WCR pode aparecer**: Controle de Caixa sem `QA-ISO-WCR-1`, RDO sem o WCR, FCP sem o
   plano. Percorrer também Medição, Qualidade, Planejamento, Economia e Gestão 360 — são os
   módulos cujos stores dependem só do fallback de limpeza.
4. Controle de Caixa → lançar 1 despesa `QA-ISO-CPZ-1`.
5. Indicador de sincronização: fila zerada, **nenhuma pendência "de outra empresa"**.
6. SQL Editor: bloco A de novo. As contagens da WCR **não mudaram**; a Compizzo ganhou 1 lançamento.

**Passo 3 — voltar.** Trocar para a WCR: os 3 registros continuam lá; `QA-ISO-CPZ-1` não aparece.

**Passo 4 — as duas ao mesmo tempo.** Duas abas do navegador, uma em cada empresa, cada uma cria
um lançamento. Indicador de sincronização nas duas: fila zerada, nenhuma op estacionada. Bloco A:
cada empresa ganhou exatamente 1.

**Passo 5 — limpar.** Excluir os lançamentos `QA-ISO-*` pela tela (o RDO e o plano podem ficar ou
ser excluídos — a exclusão é `deleted_at`, o histórico permanece na Auditoria).

### Bloco A — contagens por empresa (só contagens, nenhum conteúdo)

```sql
with orgs as (
  select id, slug from public.organizations
  where slug in ('wcr-saneamento', '<SLUG-DA-COMPIZZO-REAL>') and deleted_at is null
)
select o.slug,
  (select count(*) from public.financeiro_entries f where f.organization_id = o.id and f.deleted_at is null) as lancamentos,
  (select count(*) from public.rdo r where r.organization_id = o.id and r.deleted_at is null)                 as rdos,
  (select count(*) from public.fcp_planos p where p.organization_id = o.id and p.deleted_at is null)          as planos_fcp,
  (select count(*) from public.audit_log a where a.organization_id = o.id and a.created_at > now() - interval '1 day') as auditoria_24h
from orgs o order by o.slug;
```

### Bloco B — nada sem dono (deve devolver zero linhas)

```sql
select 'financeiro_entries' as tabela, count(*) from public.financeiro_entries where organization_id is null
union all select 'rdo', count(*) from public.rdo where organization_id is null
union all select 'fcp_planos', count(*) from public.fcp_planos where organization_id is null
union all select 'construction_sites', count(*) from public.construction_sites where organization_id is null;
```

### O que fazer se algo falhar

| Sintoma | Onde olhar |
|---|---|
| Dado da WCR aparece na Compizzo depois da troca | o store daquele módulo está na lista "só fallback" do `qa:isolamento` e não exporta `clearData` — é bug, abrir issue com o nome do store |
| Op "estacionada" no indicador | `pendenciasDeOutraEmpresa()` pegou uma escrita com `organization_id` diferente da ativa — **é o detector funcionando**; baixar a fila (botão) e anexar |
| Fila não zera | erro do servidor traduzido no painel; o mais comum é migração não aplicada — ver `docs/APLICAR_MIGRACOES.md` |
| Bloco A: contagem da WCR mudou no passo 2 | escrita cruzou de empresa — grave; guardar o `audit_log` daquela hora |

### Resultado

| Data | Quem rodou | Camada 1 | Passos 1–4 | Observações |
|---|---|---|---|---|
| | | | | |
