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


### `20260904120000_lgpd_titular_mao_de_obra.sql`

Inclui **Mão de Obra** nos direitos do titular (art. 18) e redige o próprio `audit_log`.

Sem ela, cada funcionário importado é um titular que o produto **não consegue** exportar nem
anonimizar — e a anonimização existente já copia o nome real para o `audit_log`, que ninguém
anonimiza depois.

Não quebra nada se demorar: a importação funciona sem ela. O que falta é a resposta a um pedido
do titular.

⚠️ O corpo das duas funções está **por extenso** no arquivo, e tem de continuar assim:
`create or replace` substitui a função inteira, então rodar um trecho parcial faria as cinco
fontes antigas (profiles, chamados, OS, laudos, títulos) pararem de ser exportadas sem erro nenhum.

Conferência depois de aplicar — testa COMPORTAMENTO, não existência:
```sql
select jsonb_object_keys(export_dados_titular('<org-uuid>', 'um nome que existe'));
-- tem de listar as 7 chaves, incluindo funcionarios e equipes_como_encarregado
```

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

### 🔴 `20260710130000_app_state.sql` — a tabela que ninguém sabia que faltava

Descoberta em 09/09/2026, na auditoria de pré-voo do deploy das cinco fatias. A migração é de
**julho** e mesmo assim ficou fora das duas listas: não está no bundle `APPLY_PENDENTE_20260722`
(conferido, zero ocorrências) nem entre as confirmadas pelo João.

⚠️ **Por que passou tanto tempo despercebida:** `src/lib/blobSync.ts` existia sem **um único
consumidor** — nenhuma tela tocava `app_state`, então nada podia falhar. A partir do deploy de
09/09 ela passa a ser usada pelos cards *"Controle de Caixa — importado há X dias por Fulano"*
da Visão Geral do Financeiro.

**O que acontece sem ela — medido, não suposto:** nada trava. `pushBlob` faz `upsert` direto e
**não passa pela fila de sincronização**, então não existe op presa retentando para sempre (que é
o estrago do PGRST205 nas outras tabelas). No erro ele escreve um aviso no console e devolve
`false`. O sintoma único: importar a planilha e o card continuar dizendo "nenhuma planilha
importada". Parece defeito da tela; é tabela faltando.

Para aplicar: `docs/COLAR_NO_SQL_EDITOR.sql` traz a tabela + as 4 policies e termina numa consulta
única de conferência (`OK` / `FALTA` por item). Idempotente — serve de diagnóstico se já existir.

### `20260829120000_auditoria_generica` — quem criou, quem alterou, quem apagou

Liga a auditoria em **toda tabela de negócio**: gatilho genérico gravando na `audit_log` (que já
existe desde a 0006 e nunca foi usada para isso), `updated_by` em toda tabela que tem `created_by`,
e a RPC `auditoria_da_organizacao` com gate de papel para a tela de Auditoria.

Aplica por varredura do `information_schema`, não por lista — tabela nova entra sozinha.

⚠️ **Quem preenche o `updated_by` é o banco, não o app** (gatilho `trg_updated_by`, no mesmo molde
do `set_updated_at` que já existe em 49 tabelas). Isso é deliberado: se o app mandasse a coluna, toda
escrita voltaria `PGRST204` até esta migração ser aplicada — e `PGRST204` é classificado como
"aguardando servidor" (`storeSync.ts:115`), que **segura a operação na fila**. Como o campo apareceria
em 35 stores, a sincronização inteira do produto ficaria parada entre o deploy e você rodar o SQL,
sem nenhum erro na tela. Preenchendo no banco não existe essa janela — e ainda funciona para quem
escreve sem passar pelo app (o webhook do n8n, um script, o painel do Supabase).

**Testada em Postgres 16 real, 20 casos**, inclusive os três que mais importam: soft delete vira
`delete` (senão a exclusão sumiria no meio das edições), UPDATE que não muda nada **não** entra (o
reenvio da fila viraria ruído), e **com o log quebrado de propósito o cadastro grava mesmo assim** —
auditoria nunca pode impedir a equipe de trabalhar. Zero vazamento entre organizações, conferido
linha a linha. Rodando três vezes: nenhum gatilho duplicado.

⚠️ Ela **aperta a leitura ampla** do log: hoje qualquer membro da organização lê tudo, inclusive
`visualizador`, `zelador` e `morador`. Passa a exigir `diretor` ou `owner`. A leitura **por
registro** continua liberada, senão o "Histórico" dentro de cada tela morre.

### `20260830120000_fcp_planos` — o Fluxo de Caixa Projetado

Cria `fcp_planos`: um plano é um documento de premissas por obra, com a produção realizada. **Só as
entradas são gravadas** — semanal, mensal, econômico, viabilidade e capital são recalculados na
hora. Guardar número calculado é convite para ele envelhecer e discordar da própria conta.

⚠️ **Ela liga a auditoria em si mesma, e isso é regra para toda tabela nova daqui em diante.** A
`20260829120000` aplica os gatilhos por VARREDURA do `information_schema` — e a varredura rodou
naquele momento. Tabela criada depois nasce fora da auditoria, em silêncio. Por isso esta migração
repete as três linhas (`updated_by`, `trg_updated_by`, `trg_auditoria`) para a própria tabela.

⚠️ E **sem `deleted_at is null` na policy de SELECT**: com o filtro ali o soft delete nasceria
quebrado (erro, não "0 linhas"). Foi a causa raiz de "apagar não funciona" em 75 tabelas.

**Testada em Postgres 16 real, 10 casos**, incluindo: a auditoria pega a tabela nova, o
`updated_by` é preenchido pelo banco, o soft delete **com WHERE** funciona, e o `status` fora de
rascunho/enviado/aprovado é recusado.

### `20260903120000_financeiro_notas` + `20260903120100_notas_fiscais_bucket` — a aba Nota Fiscal

Cria `financeiro_notas` (a nota importada por foto) e o bucket privado `notas-fiscais`.

⚠️ **A identidade é a chave de acesso.** O `id` vem pronto do cliente
(`seededId(orgId,'nota-fiscal',chave44)`), então a própria PK impede duplicar: a mesma foto
importada em dois celulares chega ao mesmo id e o segundo upsert regrava a mesma linha. Por isso
**não** há índice único sobre `chave_acesso` — seria um segundo jeito de receber um 23505 sobre o
mesmo fato. A chave só vira id depois de passar pelo dígito verificador.

Repete os três da auditoria (`updated_by`, `trg_updated_by`, `trg_auditoria`), como toda tabela
nova precisa, e a policy de SELECT vai **sem** `deleted_at is null`.

Traz também `uniq_fin_entries_source_nota` — um lançamento por nota.

⚠️ **Correção de 04/09/2026.** A primeira versão criava esse índice dentro de um bloco `do $$` que
contava duplicatas antes, no molde da `20260814120000`. **O editor do Supabase recusou com
`42P01: relation "duplicadas" does not exist` e travou a migração inteira.** O bloco foi removido em
vez de consertado: `sourceNotaId` nasce nesta mesma migração, então nenhuma linha pode tê-lo
preenchido — não havia duplicata possível para contar. Hoje é um `create unique index if not exists`
solto, sem variável, sem `$$` e sem string. Se você já tentou colar a versão antiga e ela falhou,
**cole a atual inteira de novo**: tudo é `if not exists` / `drop policy if exists`, então rodar duas
vezes é inofensivo.

⚠️ Enquanto não for aplicada, a aba **funciona inteira no aparelho** (é local-first) e a fila fica
em backoff — `42P01` está em `CODIGOS_AGUARDANDO_SERVIDOR` (`storeSync.ts`), então nada é
descartado nem vira aviso na tela. Como o store é novo e tem fila própria, **não trava o sync dos
outros módulos**.

### `20260830130000_auditoria_origem` — a integração se identifica no log

Antes: quem escreve pela service role (webhook, script, Edge Function) não tem `auth.uid()`, e a
linha do log sai com ator nulo — na tela vira "sistema", que é verdade e é inútil.

Agora a escrita pode declarar de onde vem:

```sql
select set_config('app.origem', 'n8n:producao-semanal', true);
update ... ;
```

⚠️ **O `true` é obrigatório** — ele dá escopo de TRANSAÇÃO à variável. Sem ele a marca vaza para a
próxima operação da mesma conexão, e o pool do Supabase reusa conexão entre requisições de pessoas
diferentes: uma escrita sua sairia carimbada como n8n. Há teste que trava isso.

A origem é gravada em `user_agent`, que já existe e é exatamente isso. A RPC da tela passa a
devolvê-la, e a Auditoria mostra "integração · n8n:…" ao lado do ator.

**Testada em Postgres 16 real, 7 casos**, incluindo o vazamento e as decisões antigas (o UPDATE
que não muda nada continua fora, o soft delete continua virando `delete`).

### `20260830140000_fcp_webhook` — a porta do n8n

RPC `fcp_lancar_producao`, usada pela Edge Function `fcp-webhook`.

⚠️ **É RPC e não UPDATE direto por uma razão:** a marca de origem só entra no log se o
`set_config` acontecer na MESMA transação do UPDATE, e o supabase-js não dá transação. Uma função
dá, porque o corpo dela é uma.

⚠️ **NÃO liberada para `authenticated`.** Ela é `SECURITY DEFINER` e não checa `user_org()` —
liberá-la daria a qualquer usuário a capacidade de escrever no plano de outra obra. Só service
role. Há teste que confere o grant.

**Testada em Postgres 16 real, 12 casos**: `null` apaga o lançamento (a semana volta ao previsto)
enquanto `0` é zero de verdade, cidade nova não apaga a que existia, plano inexistente e semana
fora da faixa são recusados, e a origem não vaza.

Configuração e uso do webhook: `docs/FCP_WEBHOOK.md`.

### `20260829130000_org_wcr_saneamento` — o cliente novo

Cria só a organização. **Não cria o primeiro usuário** — isso é competência do Supabase Auth, e
migração que escreve em `auth.users` na mão produz conta que não loga.

Se você rodar o `curl` do `admin-provision-company` (linha 65 deste documento), ele faz organização
**e** dono de uma vez e esta migração fica desnecessária. Rodar os dois é seguro: o
`on conflict (slug) do nothing` não duplica.

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
