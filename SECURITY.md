# Segurança — ConstruData / Palantir

Este documento lista o que **NUNCA** pode ser commitado no Git, e os princípios
de segurança fundamentais do projeto. Leia antes de qualquer commit ou PR.

## 🚫 Nunca commitar

| Arquivo / Conteúdo | Por quê |
|---|---|
| `.env.local` | Contém URL e chaves do Supabase |
| `.env`, `.env.production`, `.env.development` | Mesmo motivo |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypassa todo o RLS — acesso total ao banco |
| `SUPABASE_DB_PASSWORD` | Acesso direto ao Postgres |
| `*.dump`, `*.sql.gz`, `*.backup` | Podem conter dados reais de clientes (LGPD) |
| `supabase/seed.dev.sql` | Pode ter dados de teste com PII |
| Logs com tokens JWT, e-mails, CPFs | LGPD |
| Credenciais de Autodesk Forge / APS | Configuradas pelo usuário em runtime |

O `.gitignore` já bloqueia tudo isso. Se você for adicionar um novo tipo de
secret, **adicione antes ao `.gitignore`**.

## ⚠️ Risco aceito — planilhas de QA com dado pessoal real (04/09/2026)

Os dois `.xlsx` versionados em `docs/`, que os scripts de QA leem, contêm **dado pessoal real e
identificado**. Medido, não estimado:

| Arquivo | O que contém |
|---|---|
| `docs/FLUXO_CAIXA_PROJETADO_BERTIOGA_SANTOS_v2.xlsx` | abas `CUSTOS BERTIOGA` e `CUSTOS SANTOS`: **14 e 16 pessoas** com nome completo, cargo e **salário, encargos e benefícios individuais** |
| `docs/CONTROLE DE CAIXA-MODELO.xlsx` | aba `HORAS EXTRAS 08`: **52 nomes completos** com valor de hora extra pago; aba `DESPESAS`: ~16 solicitantes nominais |

Entraram no repositório no commit `1bed17c` e já foram enviados ao remoto.

**Decisão do controlador (o cliente), tomada em 04/09/2026: manter os arquivos como estão por
enquanto**, com o risco registrado aqui. A remoção efetiva exigiria reescrever o histórico do Git
(`git filter-repo`), o que invalida todo clone e fork existentes — decisão adiada.

**A regra que passa a valer desde já, e que é obrigatória:**

> ⚠️ **Nenhum script de QA pode imprimir conteúdo de coluna nominal.** Só contagem, soma e nome de
> coluna. `stdout` de script de QA vai para o terminal de quem roda **e para o log de CI**, que é
> mais um lugar guardando os mesmos nomes — cada execução multiplica a exposição em vez de apenas
> mantê-la.

O precedente da casa é `scripts/qa_medicao_xlsx.mjs`, que já faz isso.

Fixture nova **não repete o problema**: a planilha de funcionários do QA é **sintética**
(`docs/FUNCIONARIOS-MODELO.xlsx`), com nomes fictícios. Além de não expor ninguém, ela prova mais —
pode conter os casos adversariais que o arquivo real não tem.

## ✅ O que é seguro commitar

- `.env.example` (apenas com placeholders, nunca valores reais)
- Migrations SQL em `supabase/migrations/` (estrutura, sem dados sensíveis)
- Código TypeScript que **lê** das envs via `import.meta.env.VITE_*`
- Documentação de arquitetura

## 🔐 Princípios não-negociáveis

1. **`anon key` no front, `service_role key` nunca.** Toda var prefixada com
   `VITE_` é embutida no bundle do browser. A `service_role` bypassa RLS e
   só pode existir em scripts Node ou GitHub Actions com secrets.

2. **RLS habilitado em TODA tabela.** Tabela sem `ENABLE ROW LEVEL SECURITY`
   é bug crítico — bloqueia merge. Toda nova migration que cria tabela deve
   ter migration de RLS correspondente no mesmo PR.

3. **Multi-tenant isolation por `organization_id`.** Toda tabela de domínio
   tem coluna `organization_id NOT NULL` + policy que filtra por
   `auth.user_org()`. Cross-tenant leakage é o bug mais grave possível.

4. **MFA/TOTP disponível, ainda NÃO obrigatório.** As telas de ativação e de
   desafio existem (`/mfa/ativar`, `/login/mfa`) e o banco já tem
   `mfa_required_roles`, mas hoje a checagem é decorativa: a sessão do
   `signInWithPassword` **já é válida antes do código**, o `AuthGuard` não
   verifica o nível de autenticação (AAL) e nenhuma policy exige AAL2. Quem
   souber ignorar a tela de desafio entra. Tornar obrigatório significa exigir
   AAL2 no guard e nas policies — está no backlog e **não deve ser descrito
   como pronto em documento nenhum**, contrato incluído.

5. **Audit log append-only.** A tabela `audit_log` não tem policies de UPDATE
   ou DELETE — nem mesmo o owner consegue editar histórico.

6. **Soft-delete via RPC**, não DELETE direto. Registros têm `deleted_at`
   e ficam 30 dias na "lixeira" antes do hard-delete.

7. **Aprovação obrigatória** para ações críticas (DELETE, UPDATE de FVS já
   fechada, aprovação de orçamento). A matriz é configurável por organização
   em `organizations.settings.approval_matrix`.

8. **Export por organização (LGPD).** RPC `export_organization_data(org_id)`
   só pode ser chamada pelo `owner` da org e retorna JSON completo dos
   dados daquela org — usada quando cliente rescinde contrato ou pede
   portabilidade de dados.

## 🔎 Auditoria da autenticação — agosto/2026

Conferência completa da superfície de autenticação. O que estava errado e foi corrigido está
descrito nos commits; o que **continua em aberto** está aqui, para ninguém prometer o que não
existe (foi exatamente esse o problema que a rodada anterior encontrou nos documentos de LGPD).

### O que está bem-feito

Vale registrar, porque uma lista só de furos distorce: PKCE em vez de implicit flow; `signOut`
com escopo global de verdade (revoga os refresh tokens no servidor, conferido na dependência
instalada — não é só limpeza de cliente); o `AuthGuard` não renderiza conteúdo enquanto não sabe
quem você é; a RPC do QR público nunca aceita `organization_id` do cliente, resolve pelo slug no
servidor; as RPCs de exportação e de direitos do titular validam `owner` no banco, não só na
tela; `signup_with_org` está desativada e lança exceção incondicional; as rotas `api/*` são
fail-closed quando falta variável de ambiente; e nenhum `.env` jamais foi commitado.

### Em aberto — com o que cada um custa de verdade

| Pendência | Onde se vê | O que acontece hoje |
|---|---|---|
| **MFA é decorativo** | `AuthPage.tsx` (fluxo de login) | A sessão do `signInWithPassword` já é válida **antes** do código TOTP. O `AuthGuard` não checa nível de autenticação — não há uma única referência a `aal` em código executável — e nenhuma policy exige AAL2. Quem souber ignorar a tela de desafio entra. `organizations.settings.mfa_required_roles` existe semeado em 8 migrations e **nada no código lê esse campo**. E `mfa_enrolled` é auto-declarável: o cliente dá `UPDATE` na própria linha, e o trigger de guarda só protege `role` e `organization_id`. |
| **Sessão não expira** | `supabase/config.toml` | O bloco `[auth.sessions]` está inteiramente comentado: sem `timebox`, sem `inactivity_timeout`. Com `autoRefreshToken`, uma aba esquecida aberta — ou um refresh token copiado do `localStorage` — renova indefinidamente. |
| **Tentativa de login não deixa rastro** | — | Não há registro de login, nem falho nem bem-sucedido, em lugar nenhum. `audit_log` tem as colunas `ip` e `user_agent` desde `0006_audit_log.sql` e **nenhum código as preenche**. Uma campanha de credential stuffing não aparece em nada que a aplicação consiga consultar; o que existe é o log do GoTrue no painel. |
| **Não existe trilha de eventos de plataforma** | `audit_log` | A tabela é por inquilino (`organization_id NOT NULL` com chave estrangeira), então eventos sem organização — uma tentativa recusada de provisionamento, por exemplo — não cabem nela. Hoje vão para o log da Edge Function. |
| **A prop `roles` do `AuthGuard` nunca é usada** | `src/App.tsx` | Zero ocorrências de `roles={`. Todo gate por papel mora dentro dos componentes, então as telas administrativas abrem por URL. O dado está protegido (as RPCs validam no banco); a estrutura e a existência das telas, não. |
| **`api/*` aceita qualquer autenticado de qualquer cliente** | `api/_supabaseAuth.ts` | `isAuthenticated` responde só "é um usuário válido" — sem organização, sem papel, sem limite. Três rotas consomem gateway de IA pago. |
| **Não há captcha** | — | Em nenhuma camada: nem no login, nem no convite, nem na recuperação. O atraso progressivo das telas encarece a repetição pela interface e nada além disso. |
| **CSP não segura XSS** | `vercel.json` | `script-src` inclui `'unsafe-inline'` e `'unsafe-eval'`, e os tokens ficam em `localStorage`. Há exatamente um `dangerouslySetInnerHTML` no projeto (o QR do TOTP, vindo da API do GoTrue) e nenhum sanitizador. |
| **A conta de plataforma continua onipotente** | `platform_admins` | Ela é `owner` de todas as organizações em todas as policies. Desde agosto/2026 isso é dado, não código — dá para revogar e promover sem deploy —, mas o poder é o mesmo, e nenhuma entrada dela em organização de cliente é registrada. |
| **`invitations.token` é legível por toda a organização** | `0009_rls_core.sql` | E `accept_invitation` aceita o ramo `OR token = p_token`. O que impede a escalada é a conferência de e-mail — a defesa está de pé, apoiada numa única linha. |
| **O listener de `onAuthStateChange` nunca é desinscrito** | `src/lib/auth.ts` | Vazamento pequeno, mas real. |

### Ações que só o painel do Supabase resolve

Não dá para versionar em código: `supabase/config.toml` governa o ambiente **local**, e não há
`supabase config push` em CI nenhum.

- [ ] Política de senha no servidor (Authentication › Policies): mínimo 10, maiúscula/minúscula/número. Hoje o servidor ainda aceita 6.
- [ ] Proteção contra senha vazada (HIBP).
- [ ] `timebox` e `inactivity_timeout` de sessão.
- [ ] Domínio de produção + `/redefinir-senha` na allow-list de redirect — sem isso o e-mail de recuperação não funciona.
- [ ] `APPROVAL_TOKEN_SECRET` nas Edge Functions `notify-approval` e `handle-approval`, com o **mesmo** valor. Sem ela a aprovação por e-mail fica desligada, de propósito.
- [ ] Considerar ligar `enable_confirmations`. Hoje desligado, é o que faz o `signUp` responder de formas distinguíveis para e-mail existente e livre. A tela de convite já não expõe isso — a conferência do token vem antes —, mas o endpoint do GoTrue continua respondendo assim para quem chamar direto.

## 🧪 Antes de cada commit

- [ ] Não há vars `VITE_*` apontando para chaves sensíveis
- [ ] Tabelas novas têm RLS habilitado
- [ ] `git status` não mostra `.env.local` ou dumps
- [ ] `npm run check:segredos` passa (roda no CI; varre o `dist/` por `service_role`, senhas,
      segredos de servidor e por qualquer JWT cujo papel não seja `anon`)

## 🆘 Se um secret vazar

1. **Revogar imediatamente** no dashboard do Supabase (Settings → API → Reset)
2. Se a `service_role` vazou: rotacionar a `JWT secret` (invalida TODAS as
   sessões) — Settings → API → JWT Settings
3. Se a `db password` vazou: Settings → Database → Reset password
4. Forçar `git filter-repo` para remover do histórico (não basta deletar
   commit recente — secret fica nos packs)
5. Auditar `audit_log` para ver se houve uso indevido

## 📞 Contato

Para reportar vulnerabilidade: abrir issue privada ou contatar o owner.

## Quadro nominal do FCP na tela — só diretoria (08/09/2026)

A aba **Custos** do Fluxo de Caixa Projetado renderizava nome, cargo e salário individual das
~30 pessoas do quadro para **qualquer papel da organização** — inclusive `visualizador`,
`comprador` e os papéis prediais. A decisão de 04/09 acima era sobre os **arquivos** no Git, não
sobre a tela; as duas coisas não tinham sido decididas juntas.

**Decisão do controlador em 08/09/2026: o quadro nominal aparece só para `owner` e `diretor`** — o
mesmo gate que já protege a Auditoria e a aprovação do plano. Os demais veem o quadro por equipe,
com contagem e total.

⚠️ É gate de **tela**. A policy de `fcp_planos` filtra só por `organization_id`, então o payload
com o quadro continua sendo entregue a qualquer usuário autenticado da org que chame a API
diretamente. Restringir isso no banco exigiria separar o quadro nominal do payload do plano (ou
uma policy que leia o papel), e ficou registrado como pendência.

**Restrição por usuário** (limitar uma pessoa a alguns módulos) **não existe em camada nenhuma**
— nem coluna, nem policy, nem guarda de rota. Decisão de 08/09/2026: controle **só por papel, por
enquanto**. Quando for feita, são três camadas obrigatórias: coluna em `memberships` protegida no
trigger `guard_profile_self_privilege`, filtro no menu, guarda por rota — e, para valer de
verdade, as policies de SELECT lendo a coluna.
