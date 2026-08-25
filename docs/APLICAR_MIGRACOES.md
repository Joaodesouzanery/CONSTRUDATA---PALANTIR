# Como aplicar migrações no Supabase

## O problema

Este projeto **não tem etapa de migração no CI**. O deploy da Vercel sobe só o front-end; as
migrações em `supabase/migrations/` **só chegam ao banco se alguém colar no Supabase SQL Editor**.
Quando uma fica para trás, o app tenta gravar numa tabela ou coluna que não existe e o Supabase
responde:

> `Could not find the table 'public.economy_baselines' in the schema cache`
> (PGRST205 = tabela faltando · PGRST204 = coluna faltando)

O indicador de sincronização mostra isso como **"não salvo · erro"**.

## ⛔ Não rode mais o `APPLY_PENDENTE_20260722.sql`

A regra antiga era "toda migração nova entra no bundle". Ela foi abandonada na prática — **19
migrações vieram depois de 22/07/2026 e nenhuma entrou** — e hoje o bundle é **perigoso**:

Ele contém a versão antiga de `baixar_estoque_item`, com 5 parâmetros. A função foi reescrita em
22/08 com 9 parâmetros (para gravar a ficha de retirada) e em 24/08 ganhou checagem de papel.
Rodar o bundle de novo criaria **duas funções de mesmo nome**, e o PostgREST escolheria entre elas
conforme os argumentos da chamada — a ambiguidade que aquelas migrações existiram para evitar.

O arquivo fica no repositório como histórico do que foi aplicado até 22/07, com o aviso no topo.

## Como aplicar hoje

Uma migração por vez, na ordem do nome (que é a data). Todas têm o cabeçalho
`⚠️ APLICAR MANUALMENTE` e **terminam com um `select` de conferência** que imprime `OK` ou o que
faltou — rode o arquivo inteiro e leia a última linha do resultado.

Todas são idempotentes (`CREATE TABLE / ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`,
`DROP POLICY IF EXISTS`): rodar duas vezes não dói.

## O que está pendente

Não existe tabela de controle, então o repositório não sabe o que o banco tem. Para descobrir, rode
**`docs/DIAGNOSTICO_SCHEMA.sql`** (somente leitura).

Confirmadas como **aplicadas** pelo João: `20260623120000_security_role_guard`,
`20260805120000_storage_buckets_missing_rls`, `20260805120100_financeiro_obra_same_org`,
`20260808120000_boletos_bucket`, `20260808130000_predial_chamados_publicos`,
`20260817140000_work_posts_occurrences`, `20260820120000_obra_dias_sem_producao`,
`20260821120000_worker_absences_site_id_insurance`, `20260822120000_estoque_ficha_de_retirada`,
`20260823120000_rotinas_da_empresa`, `20260824130000_desfazer_exclusao`.

### 🔴 Rode esta primeiro: `20260825120000_soft_delete_resto_do_schema`

**Sem ela, apagar continua falhando em 72 tabelas.** A `20260824130000` (que você já aplicou)
consertou 18, e eu tratei aquilo como se fosse o problema inteiro. Não era: levantando de novo, com
o app na mão, são **75 tabelas** com `deleted_at IS NULL` na policy de leitura e escritas pelo app.

O defeito é sempre o mesmo, e foi medido em PostgreSQL 16.15 — inclusive o detalhe que faltava:

```sql
update t set deleted_at = now();               -- sem WHERE  → passa
update t set deleted_at = now() where id = 1;  -- com WHERE  → ERROR: new row violates RLS
```

Com `WHERE`, o Postgres precisa **ler** a linha, e aí aplica a policy de SELECT também ao
resultado. Como marcar `deleted_at` torna a linha invisível, o comando é recusado. E o app
**sempre** usa `WHERE` (`.eq('id', …)`).

Esta migração é **gerada a partir das policies reais**, não digitada — foi assim que sobraram
tabelas nas duas vezes anteriores (`20260518160000` fez 3 em maio, `20260824130000` fez 18 ontem).
Testada em Postgres 16 real: reproduz o erro antes, funciona depois, é idempotente, e o isolamento
entre empresas continua intacto.

**Já aplicadas por você:** `20260824130000_desfazer_exclusao` (24/08).

Antes de aplicar, vale rodar **`docs/CONFERIR_EXCLUSAO.sql`** (somente leitura).

Pendentes conhecidas:

| Migração | O que quebra sem ela |
|---|---|
| **`20260825120000_soft_delete_resto_do_schema`** | **Apagar continua falhando em 72 tabelas** (manutenções, equipamentos, laudos, lançamentos financeiros, frota, LPS, quantitativos…). Ver acima. |
| `20260824120000_baixar_estoque_confere_papel` | A baixa de estoque continua contornando a RLS: um `visualizador` consegue dar baixa. Não quebra nada — é fechar uma brecha. |
| `20260808140000_lgpd_direitos_titular` | A página "Direitos do Titular" dá erro (RPCs de exportar/anonimizar não existem). |
| `20260808150000_user_role_predial` | Atribuir os papéis `sindico`/`zelador`/`morador` falha no banco. |
| `20260814120000_idempotencia_financeira` | Índices únicos parciais contra cobrança duplicada. **Não falha nunca**: se houver duplicata, avisa e não cria o índice — limpe e rode de novo. |
| `20260817120000_platform_admins` | Tira o e-mail do administrador global de dentro de `is_global_admin()`. Segura nos dois sentidos: o cliente funciona com a função antiga e com a nova. |
| `20260817130000_convite_valido` | Validação de convite. |

## Ações que NÃO são migração — só o painel resolve

- **Domínio de produção + `/redefinir-senha`** na allow-list de redirect
  (Authentication › URL Configuration). Sem isso o e-mail de recuperação não funciona.
- **Política de senha no servidor** (Authentication › Policies): mínimo 10, maiúscula/minúscula/
  número. Hoje o servidor ainda aceita 6 — o `problemaNaSenha` do cliente é só cortesia.
- **`APPROVAL_TOKEN_SECRET`** nas Edge Functions `notify-approval` e `handle-approval`, com o MESMO
  valor (`openssl rand -hex 32`). Sem ele a aprovação por e-mail fica desligada de propósito.
- `supabase/config.toml` é o **template padrão do CLI** (`site_url = http://127.0.0.1:3000`):
  governa o stack local, não o projeto hospedado.

## Para não repetir

O caminho definitivo é o **Supabase CLI** linkado ao projeto, com `supabase db push` no deploy —
aplica as pendentes automaticamente e elimina o passo manual. Enquanto isso não acontece, esta
página é a lista, e o `select` de conferência no fim de cada migração é a prova.
