# Política de Segurança da Informação — Medidas Técnicas e Organizacionais

_Rascunho-modelo (template). Não constitui aconselhamento jurídico definitivo: descreve medidas reais da plataforma para o jurídico do cliente revisar, adaptar e assumir como suas antes de qualquer publicação ou anexação contratual._

> **Template — revisar com o jurídico.** Este documento descreve as medidas de segurança da informação aplicadas ao tratamento de dados pessoais na plataforma **ConstruData** ({{NOME_FANTASIA}}), fornecida por **{{RAZAO_SOCIAL}}** (CNPJ {{CNPJ}}). Os placeholders `{{...}}` devem ser preenchidos pela empresa; prazos, papéis e itens de checklist devem ser confirmados pelo jurídico e pela área de segurança antes da adoção. Base normativa: arts. 46 a 49 da LGPD (Lei nº 13.709/2018) e regulamentação da ANPD.

| Campo | Valor |
|---|---|
| **Versão** | {{VERSAO}} |
| **Vigência** | {{DATA_VIGENCIA}} |
| **Responsável (Encarregado/DPO)** | {{DPO_NOME}} — {{DPO_EMAIL}} |
| **Aprovação** | {{APROVADOR_NOME}} — {{APROVADOR_CARGO}} |
| **Próxima revisão** | {{DATA_PROXIMA_REVISAO}} |

---

## 1. Objetivo e escopo

Esta política descreve as **medidas técnicas e organizacionais** adotadas para proteger dados pessoais tratados na plataforma ConstruData contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão (art. 46). Aplica-se ao ambiente de produção da plataforma, à sua cadeia de subprocessadores e às pessoas com acesso operacional a dados de clientes.

A plataforma é um **SaaS multi-tenant** (React + Supabase — Postgres/Auth/Storage — hospedado na Vercel) que atende dois domínios: **obras** (construção civil) e **prédios/condomínios** (módulo Predial). Os dados pessoais tratados são **mínimos**: membros da organização (nome, e-mail, papel/perfil), autores de registros operacionais (RDO, OS, laudos, medições), contatos de fornecedores/prestadores/beneficiários (incluindo fotos de boletos no Financeiro) e nome/contato/local do solicitante de chamado pelo QR público (campos de contato **opcionais**). A plataforma **não trata dado sensível como regra** (art. 5º, II).

---

## 2. Papéis: operador × controlador (art. 37, 39)

| Papel | Quem | Responsabilidade |
|---|---|---|
| **Controlador** | O CLIENTE — construtora, condomínio ou administradora ({{CLIENTE_RAZAO_SOCIAL}}) | Decide finalidades e meios do tratamento; define bases legais, prazos de retenção e atende titulares. |
| **Operador** | **{{RAZAO_SOCIAL}}** (ConstruData) | Trata os dados **em nome do controlador**, seguindo suas instruções documentadas e o contrato/DPA (art. 39). |
| **Suboperadores** | Supabase, Vercel, Resend | Contratados pelo operador para infraestrutura; ver seção 9. |

Entre si, os clientes são **isolados** (multi-tenant): os dados de uma organização não são acessíveis por outra. A divisão detalhada de tarefas por medida está na seção 11.

---

## 3. Isolamento multi-tenant por RLS (art. 46; art. 49)

O isolamento entre clientes **não depende do front-end esconder dados** — é imposto no banco (Postgres) por **Row Level Security (RLS)**:

- Toda entidade de negócio carrega `organization_id`; toda leitura filtra por `organization_id = user_org()` e ignora registros com *soft-delete* (`deleted_at IS NULL`).
- As tabelas de dados de tenant usam `ENABLE ROW LEVEL SECURITY` e, nas sensíveis, `FORCE ROW LEVEL SECURITY` (a RLS vale inclusive para o dono da tabela).
- As policies apoiam-se em funções de identidade `SECURITY DEFINER` (`user_org()`, `user_role()`, `has_role([...])`) que leem o perfil por fora da própria policy.
- O canal de tempo real (Realtime) também filtra por `organization_id=eq.<org>`, trocando de canal quando a organização ativa muda.
- **Rota pública de chamado** (`/chamado/:slug`, módulo Predial, em produção): grava em **tabela de staging** via RPC `SECURITY DEFINER` que resolve a organização pelo `slug`; protegida por **honeypot + rate-limit** (anti-spam). O solicitante não faz login e os campos de contato são opcionais.

> **Ressalva a documentar:** existe uma conta de **super-admin global** ({{GLOBAL_ADMIN_EMAIL}}) com acesso cross-org para homologação/operação da plataforma — exceção deliberada à isolação, que deve ser tratada como conta privilegiada de operador (não de cliente) e coberta pelos controles das seções 4 e 6.

---

## 4. Autenticação e MFA (art. 46; art. 47)

- Autenticação de usuários via Supabase Auth, com **TLS** em todo o transporte.
- **MFA (autenticação multifator)** disponível e **exigido para contas administrativas e aprovadores**; ações críticas podem exigir nível de garantia elevado (**AAL2**) na própria policy do banco.
- Ações sensíveis (exclusões, alterações críticas) não são executadas diretamente: passam por **fluxo de aprovação** (RPC `request_action(...)`), com o papel mínimo definido por matriz de aprovação por organização.
- Convites e criação de perfis restritos a papéis de gestão ({{PAPEIS_GESTAO}}, ex.: gerente/diretor/owner).

---

## 5. Menor privilégio e perfis (RBAC) (art. 46; art. 50)

- Controle de acesso baseado em papéis (**RBAC**): `owner`, `diretor`, `gerente`, e papéis operacionais, com permissões **granulares** por módulo (ex.: `suprimentos.write`, `medicao.approve`).
- Overrides de permissão por usuário (`allow`/`deny`) para exceções controladas.
- A decisão final de autorização vive **sempre nas policies e funções do banco**, não no menu do front-end.
- Módulos contratados por organização controlam visibilidade e acesso por API a dados de módulos não contratados.
- Chave administrativa `service_role` **nunca** no front-end/código público — apenas em ambiente de servidor/CI.

---

## 6. Criptografia: em trânsito e em repouso (art. 46, §1º)

- **Em trânsito:** TLS entre cliente, Vercel e Supabase.
- **Em repouso:** criptografia gerenciada pela infraestrutura Supabase (Postgres/Storage) e Vercel, conforme os controles dos provedores.
- Cache local (localStorage/IndexedDB) é **cache de conveniência**, não fonte da verdade; não deve armazenar tokens administrativos nem dados sensíveis sem proteção.

> _Confirmar com o jurídico/segurança o padrão criptográfico contratado com cada subprocessador e se há requisito adicional do cliente (ex.: criptografia de campo específico)._

---

## 7. Registro e trilha de auditoria (art. 37; art. 46)

- Tabela `audit_log` registra ações críticas (ator, organização, módulo, ação, dados antes/depois, IP, user-agent, data/hora).
- Para informações críticas, o registro é **append-only** (imutável): ninguém edita nem exclui pelo aplicativo.
- Existem telas administrativas de **Auditoria** e de **Exportação de Dados** por organização.
- Retenção dos registros de auditoria: {{RETENCAO_AUDIT_LOG}} (definir e justificar).

---

## 8. Continuidade, backups e recuperação (art. 46; art. 49)

> ⚠️ **Preencher com o que existe, não com o que se pretende.** Nada abaixo pode ser
> afirmado a um controlador antes de estar contratado e **testado ao menos uma vez**.
> O estado real de cada camada está em `docs/database-architecture.md`, seção 8.

**Implementado hoje:**

- **Soft-delete** em dados operacionais importantes, reduzindo perda por exclusão acidental.
- **Export por organização**, sob demanda do owner pela interface, para recuperação seletiva e para portabilidade (art. 18, V).
- **Cópia local** no navegador do usuário ativo enquanto a sincronização não conclui.

**Pendente de contratação/implementação — não afirmar como existente:**

- [ ] **Backups automáticos** gerenciados pela Supabase (diários, conforme o plano contratado — exige plano pago).
- [ ] **PITR** (recuperação a um ponto no tempo), add-on do plano {{PLANO_SUPABASE}}.
- [ ] **Dumps lógicos** periódicos guardados fora da Supabase ({{PERIODICIDADE_DUMP}}).
- [ ] **Primeiro teste de restauração** — nunca realizado. Backup que nunca foi restaurado não é backup, é hipótese.
- [ ] Objetivos de recuperação: **RPO** {{RPO}} / **RTO** {{RTO}}.

**Runbook de recuperação** (pressupõe PITR contratado; sem ele, os passos 3 e 4 não têm insumo):
congelar escritas → identificar o horário do incidente por `audit_log` → restaurar PITR em ambiente paralelo (não sobrescrever produção) → comparar por `organization_id` → recuperar seletivamente → reabrir após validação.

---

## 9. Gestão de subprocessadores (art. 39; art. 46)

O operador utiliza os seguintes subprocessadores, sob contrato:

| Subprocessador | Função | Dados envolvidos | Localização | Observação |
|---|---|---|---|---|
| **Supabase** | Banco de dados, autenticação e storage | Todos os dados de tenant | {{REGIAO_SUPABASE}} | Fonte da verdade; RLS/backups/PITR |
| **Vercel** | Hospedagem e funções `/api` | Tráfego da aplicação | {{REGIAO_VERCEL}} | Build estático + funções |
| **Resend** | E-mail transacional (quando ativado) | E-mail e conteúdo transacional | {{REGIAO_RESEND}} | Ativado conforme configuração |

- Novos subprocessadores só entram após avaliação de segurança e **comunicação prévia ao controlador**, com prazo de {{PRAZO_OBJECAO_SUBPROCESSADOR}} para objeção (a confirmar no DPA).
- Transferência internacional de dados (se houver), tratar conforme arts. 33 a 36 e a regulamentação da ANPD — **decisão do jurídico** (ver Lacunas).

---

## 10. Resposta a incidentes e comunicação (art. 48)

Em caso de incidente de segurança que possa acarretar **risco ou dano relevante** aos titulares (art. 48):

**Fluxo operador → controlador**
1. **Detecção e contenção** — isolar o vetor, preservar evidências, acionar o time de resposta {{EQUIPE_RESPOSTA}}.
2. **Notificação ao controlador** — o operador comunica o(s) controlador(es) afetado(s) em até **{{PRAZO_NOTIFICACAO_OPERADOR}} horas** da ciência (SLA contratual a definir), com as informações do art. 48, §1º na medida disponível: natureza dos dados, titulares envolvidos, medidas técnicas/de segurança adotadas, riscos e medidas de mitigação.
3. **Apoio à investigação** — o operador fornece logs (`audit_log`), escopo por `organization_id` e suporte técnico.

**Responsabilidade do controlador (cliente)**
4. **Notificação à ANPD e aos titulares** — cabe ao **controlador** comunicar a ANPD e os titulares em prazo razoável, conforme a regulamentação vigente da ANPD (referência atual: **Resolução CD/ANPD nº 15/2024**, que estabelece prazo de **3 dias úteis** contados da ciência para incidentes com risco/dano relevante — **confirmar o prazo e a redação vigentes com o jurídico**).
5. **Registro e lições aprendidas** — documentar o incidente, causa-raiz e plano de ação; revisar controles desta política.

> Prazos e responsáveis internos (quem aciona, quem decide notificar, quem fala com a ANPD) devem constar do plano de resposta do cliente — ver Lacunas.

---

## 11. Divisão de responsabilidade (operador × controlador)

| Medida | Operador ({{RAZAO_SOCIAL}}) | Controlador (cliente) |
|---|---|---|
| Isolamento multi-tenant (RLS) | Implementa e mantém | Não compartilha credenciais entre organizações |
| MFA | Disponibiliza e exige p/ admin | Ativa MFA nos usuários; define quem é admin/aprovador |
| Menor privilégio (RBAC) | Fornece papéis e permissões | Atribui papéis corretos; revisa acessos |
| Criptografia (trânsito/repouso) | Configura TLS e criptografia | — |
| Auditoria | Mantém `audit_log` e telas | Monitora e revisa trilhas |
| Backups / recuperação | Executa e testa | Define retenção/RPO/RTO desejados |
| Subprocessadores | Contrata e comunica | Aprova/objeta; avalia impacto |
| Resposta a incidente | Detecta, contém, notifica o controlador | Notifica ANPD e titulares |
| Atendimento a titulares | Apoio técnico (export por org) | Recebe e responde aos pedidos |
| Retenção e eliminação | Executa conforme instrução | **Define** prazos e gatilhos de eliminação |

> **Atendimento a direitos do titular:** acesso, correção, anonimização, portabilidade, eliminação e informação sobre compartilhamento (arts. 18-19) são atendidos pelo **controlador**, com apoio da plataforma. O **export por organização** já existe; **export/exclusão/anonimização por titular** é item de **roadmap** — enquanto isso, tais pedidos são atendidos por procedimento operacional {{PROCEDIMENTO_DIREITOS_TITULAR}}.

---

## 12. Checklist de hardening

- [ ] RLS habilitado em **todas** as tabelas expostas; `FORCE RLS` nas sensíveis.
- [ ] `organization_id` obrigatório em todo dado de cliente; índices em `organization_id`.
- [ ] Teste de RLS em produção: usuário da org A não enxerga a org B.
- [ ] `service_role` apenas em servidor/CI — nunca no navegador.
- [ ] MFA obrigatório para administradores e aprovadores; AAL2 em ações críticas.
- [ ] Policies com `to authenticated`; funções `SECURITY DEFINER` fora de schemas expostos.
- [ ] Auditoria append-only para insert/update/delete críticos.
- [ ] Soft-delete em dados operacionais importantes.
- [ ] Backups + PITR configurados **antes** de produção; teste de restauração {{PERIODICIDADE_TESTE_RESTORE}}.
- [ ] Ambientes dev/staging/prod separados.
- [ ] Rota pública de chamado: honeypot + rate-limit ativos; RPC de staging revisada.
- [ ] Revisão periódica de acessos e papéis {{PERIODICIDADE_REVISAO_ACESSOS}}.
- [ ] Inventário de subprocessadores atualizado e comunicado ao controlador.
- [ ] Conta de super-admin global monitorada e com MFA.
- [ ] Plano de resposta a incidente testado {{PERIODICIDADE_TESTE_INCIDENTE}}.
- [ ] Política revisada em {{DATA_PROXIMA_REVISAO}}.

---

## 13. Vigência e revisão

Esta política entra em vigor em **{{DATA_VIGENCIA}}** e será revisada periodicamente ({{PERIODICIDADE_REVISAO}}) ou a cada mudança relevante de arquitetura, subprocessadores ou regulamentação. Dúvidas: **{{DPO_NOME}} — {{DPO_EMAIL}}** ({{SITE}}).

---

## 14. Lacunas a preencher (decisões do jurídico e da área de segurança)

**Placeholders a preencher**
- Identificação: `{{NOME_FANTASIA}}`, `{{RAZAO_SOCIAL}}`, `{{CNPJ}}`, `{{ENDERECO}}`, `{{SITE}}`, `{{CLIENTE_RAZAO_SOCIAL}}`.
- Governança: `{{DPO_NOME}}`, `{{DPO_EMAIL}}`, `{{APROVADOR_NOME}}`, `{{APROVADOR_CARGO}}`, `{{VERSAO}}`, `{{DATA_VIGENCIA}}`, `{{DATA_PROXIMA_REVISAO}}`, `{{PERIODICIDADE_REVISAO}}`.
- Infra/subprocessadores: `{{PLANO_SUPABASE}}`, `{{REGIAO_SUPABASE}}`, `{{REGIAO_VERCEL}}`, `{{REGIAO_RESEND}}`, `{{PRAZO_OBJECAO_SUBPROCESSADOR}}`.
- Continuidade: `{{RPO}}`, `{{RTO}}`, `{{PERIODICIDADE_DUMP}}`, `{{PERIODICIDADE_TESTE_RESTORE}}`, `{{RETENCAO_AUDIT_LOG}}`.
- Incidentes: `{{EQUIPE_RESPOSTA}}`, `{{PRAZO_NOTIFICACAO_OPERADOR}}`, `{{PERIODICIDADE_TESTE_INCIDENTE}}`.
- Operação: `{{PAPEIS_GESTAO}}`, `{{GLOBAL_ADMIN_EMAIL}}`, `{{PROCEDIMENTO_DIREITOS_TITULAR}}`, `{{PERIODICIDADE_REVISAO_ACESSOS}}`.

**Decisões a tomar**
1. **Prazo e redação da comunicação de incidente** — confirmar o prazo vigente à ANPD e aos titulares (art. 48) conforme a regulamentação atual da ANPD; definir o SLA interno operador → controlador.
2. **Transferência internacional de dados** — se os subprocessadores processam/armazenam fora do Brasil, definir a base dos arts. 33-36 e a cláusula contratual aplicável.
3. **Retenção e eliminação** — definir prazos de retenção por tipo de dado e gatilhos de eliminação/anonimização (o operador executa; o controlador decide).
4. **Padrões criptográficos** — confirmar os padrões contratados com cada subprocessador e eventuais requisitos adicionais do cliente.
5. **Direitos do titular por indivíduo** — enquanto export/exclusão/anonimização por titular estiver no roadmap, formalizar o procedimento operacional de atendimento.
6. **Conta de super-admin global** — decidir política de uso, registro e revisão dessa conta privilegiada.
7. **RPO/RTO e testes** — homologar objetivos de recuperação e periodicidade de testes de restauração e de resposta a incidente.
8. **Aderência a norma/certificação** (opcional) — decidir se a política referenciará ISO 27001 / boas práticas ANPD e o alcance dessa referência.

