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

4. **MFA/TOTP obrigatório** para roles `owner` e `diretor`.

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

## 🧪 Antes de cada commit

- [ ] Não há vars `VITE_*` apontando para chaves sensíveis
- [ ] Tabelas novas têm RLS habilitado
- [ ] `git status` não mostra `.env.local` ou dumps
- [ ] `npm run build` e grep no `dist/` por `service_role` retorna zero matches

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
