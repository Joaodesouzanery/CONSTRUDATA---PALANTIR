# ROPA — Registro das Operações de Tratamento

_Rascunho-modelo. Este documento é um **template** e não constitui aconselhamento jurídico definitivo: as bases legais, os prazos de retenção e o teste de legítimo interesse devem ser validados pelo jurídico e pelo Encarregado do controlador antes do uso._

> **Template — revisar com o jurídico.** Este é o **Registro das Operações de Tratamento do OPERADOR** ({{RAZAO_SOCIAL}}, fornecedora da plataforma **{{NOME_FANTASIA}}** = "ConstruData"), mantido para atender ao art. 37 da LGPD (Lei 13.709/2018). **Cada cliente-CONTROLADOR** (construtora, condomínio ou administradora) **mantém o seu próprio ROPA** — este registro descreve o tratamento que o operador realiza **em nome e sob instrução** do controlador (art. 39). Preencha os placeholders `{{...}}` com dados reais do fornecedor e confirme as bases legais, os prazos e as transferências internacionais antes de publicar.

| Campo | Valor |
|---|---|
| **Documento** | ROPA — Registro das Operações de Tratamento (art. 37, LGPD) |
| **Papel neste registro** | OPERADOR ({{RAZAO_SOCIAL}} / CNPJ {{CNPJ}}) |
| **Produto** | {{NOME_FANTASIA}} ("ConstruData") — SaaS multi-tenant |
| **Versão** | {{VERSAO}} |
| **Vigência** | {{DATA_VIGENCIA}} |
| **Responsável / Encarregado (DPO)** | {{DPO_NOME}} — {{DPO_EMAIL}} |
| **Última revisão** | {{DATA_ULTIMA_REVISAO}} |
| **Aprovado por** | {{APROVADOR_NOME}} — {{APROVADOR_CARGO}} |

---

## 1. Contexto e papéis (LGPD art. 5º, VI e VII)

- **Controlador** (art. 5º, VI): o **cliente** — construtora / condomínio / administradora — que decide as finalidades e os meios do tratamento dos dados inseridos na sua organização (`organization_id`).
- **Operador** (art. 5º, VII): **{{RAZAO_SOCIAL}}**, que trata dados pessoais **em nome do controlador**, seguindo suas instruções e os termos do contrato de prestação de serviço / Adendo de Proteção de Dados (art. 39).
- **Isolamento multi-tenant**: entre si, os clientes-controladores são isolados via **RLS por `organization_id`** (política que filtra por `auth.user_org()`); vazamento cross-tenant é tratado como incidente crítico.
- **Dado sensível** (art. 5º, II): **não** é tratado como regra pela plataforma. Se um controlador inserir dado sensível em campo livre (ex.: anexo, descrição), a decisão e a base legal são do controlador; recomenda-se não fazê-lo.
- **Encarregado** (art. 41): o operador designa {{DPO_NOME}} ({{DPO_EMAIL}}); **cada controlador designa o seu**.

### Como ler as tabelas
Cada operação abaixo é uma **tabela** com os campos: **Operação/Finalidade · Categorias de titulares · Categorias de dados · Base legal · Compartilhamento/Subprocessadores · Transferência internacional · Prazo de retenção · Medidas de segurança**. A "base legal" indicada é a **típica sugerida ao controlador** — a definição final da base frente aos titulares é do controlador.

### Índice das operações

| ID | Operação | Base legal típica (art. 7º) |
|---|---|---|
| OP-01 | Cadastro e gestão de membros da organização | Execução de contrato (V) · Legítimo interesse (IX) |
| OP-02 | Autenticação e MFA | Execução de contrato (V) · Obrigação legal de segurança (II) |
| OP-03 | Registros operacionais de obra (RDO/Relatório 360, OS, medições) | Execução de contrato (V) · Legítimo interesse (IX) |
| OP-04 | Laudos e obrigações técnicas (Predial: laudos, AVCB, manutenções) | Obrigação legal/regulatória (II) |
| OP-05 | Fornecedores / prestadores / beneficiários + fotos de boletos (Financeiro) | Execução de contrato (V) · Obrigação legal fiscal (II) |
| OP-06 | Chamados via QR público (`/chamado/:slug`) — solicitante anônimo | Legítimo interesse (IX), com teste de proporcionalidade |
| OP-07 | Logs de acesso e auditoria (`audit_log`) | Obrigação legal (II) · Legítimo interesse — segurança (IX) |
| OP-08 | Backups gerenciados | Legítimo interesse — continuidade/segurança (IX) |

---

## 2. Subprocessadores (operadores contratados pelo operador)

| Subprocessador | Serviço | Papel | Localização típica do processamento |
|---|---|---|---|
| Supabase | Banco (Postgres), Autenticação, Storage | Suboperador | {{REGIAO_SUPABASE}} (confirmar região do projeto) |
| Vercel | Hospedagem do front-end / edge | Suboperador | {{REGIAO_VERCEL}} (confirmar) |
| Resend | E-mail transacional (**quando ativado**) | Suboperador | {{REGIAO_RESEND}} (confirmar) |

> Manter atualizada a **lista de subprocessadores** no contrato/DPA com o controlador; comunicar alterações conforme a cláusula de aprovação prévia. Se qualquer subprocessador processar dados **fora do Brasil**, aplica-se o regime de **transferência internacional** (art. 33) — ver coluna correspondente em cada operação e a seção "Lacunas a preencher".

---

## 3. Operações de tratamento

### OP-01 — Cadastro e gestão de membros da organização

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Criar e manter contas de usuários da organização e atribuir papéis/perfis (owner, diretor, gerente, engenheiro, planejador, síndico, zelador etc.), para prover e operar a plataforma e aplicar o menor privilégio via RLS. |
| **Categorias de titulares** | Colaboradores e usuários autorizados do controlador (funcionários, prestadores com acesso, síndico, zelador). |
| **Categorias de dados** | Nome, e-mail, papel/perfil, `organization_id`, metadados de conta (criação, último acesso). **Sem dado sensível.** |
| **Base legal** | Execução do contrato de prestação de serviço (art. 7º, V) e legítimo interesse do controlador na gestão de acessos (art. 7º, IX). Base frente ao titular definida pelo controlador. |
| **Compartilhamento/Subprocessadores** | Supabase (Auth/Postgres). Sem compartilhamento comercial nem venda de dados. |
| **Transferência internacional** | Conforme a região do projeto Supabase ({{REGIAO_SUPABASE}}). Se fora do Brasil, art. 33, com cláusulas contratuais específicas. |
| **Prazo de retenção** | Enquanto a conta estiver ativa / vigente o contrato. Após término: {{RETENCAO_POS_CONTRATO}} (art. 15 e 16). Exclusão pode usar soft-delete via RPC (`deleted_at`) com {{JANELA_LIXEIRA_DIAS}} dias na lixeira antes do hard-delete. |
| **Medidas de segurança** | RLS por `organization_id`, menor privilégio, TLS em trânsito, criptografia em repouso, MFA, registro em `audit_log`. |

### OP-02 — Autenticação e MFA

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Autenticar usuários e proteger o acesso com MFA/TOTP (obrigatório para papéis `owner` e `diretor`), garantindo a segurança das contas e do ambiente multi-tenant. |
| **Categorias de titulares** | Usuários autorizados do controlador. |
| **Categorias de dados** | E-mail, credenciais/hashes gerenciados pelo provedor de auth, segredo TOTP/fatores de MFA, tokens de sessão, IP e user-agent de login. |
| **Base legal** | Execução de contrato (art. 7º, V) e cumprimento do dever de segurança da informação (art. 7º, II c/c art. 46-49). |
| **Compartilhamento/Subprocessadores** | Supabase (Auth). E-mails de verificação/reset via Resend **quando ativado**. |
| **Transferência internacional** | Conforme região do provedor de auth ({{REGIAO_SUPABASE}}); se aplicável, art. 33. |
| **Prazo de retenção** | Sessões/tokens conforme expiração configurada ({{TTL_SESSAO}}); registros de login retidos por {{RETENCAO_LOGIN}} para fins de segurança. |
| **Medidas de segurança** | MFA/TOTP, TLS, criptografia em repouso, rotação/revogação de sessões, menor privilégio, `audit_log`. |

### OP-03 — Registros operacionais de obra (RDO / Relatório 360, OS, medições)

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Registrar a execução da obra — Relatório Diário de Obra (RDO/Relatório 360), Ordens de Serviço, medições, avanço físico, apontamentos — para gestão do contrato de construção e prestação de contas ao controlador. |
| **Categorias de titulares** | Autores/responsáveis dos registros (engenheiros, encarregados, medidores) e pessoas eventualmente citadas em anexos/fotos de campo. |
| **Categorias de dados** | Nome e papel do autor, data/hora, conteúdo do registro, anexos e fotos de campo, associação ao projeto/obra. **Dados mínimos**; evitar PII de terceiros em campos livres. |
| **Base legal** | Execução de contrato (art. 7º, V) e legítimo interesse na gestão da obra e rastreabilidade (art. 7º, IX), com teste de proporcionalidade (art. 10). |
| **Compartilhamento/Subprocessadores** | Supabase (Postgres/Storage) para dados e anexos. Sem compartilhamento externo além do controlador. |
| **Transferência internacional** | Conforme região Supabase ({{REGIAO_SUPABASE}}); se aplicável, art. 33. |
| **Prazo de retenção** | Enquanto necessário à gestão/prestação de contas da obra e ao contrato; após, {{RETENCAO_REGISTROS_OPERACIONAIS}}. Registros fechados podem ser append-only por regra de negócio (ex.: FVS já fechada). |
| **Medidas de segurança** | RLS por `organization_id`, TLS, criptografia em repouso, aprovação para edição/exclusão de registros críticos, soft-delete via RPC, `audit_log`. |

### OP-04 — Laudos e obrigações técnicas (Predial: laudos, AVCB, manutenções)

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Manter laudos técnicos, AVCB e registros de manutenção/inspeção de ativos prediais exigidos por norma, para o controlador cumprir obrigações legais e regulatórias de segurança do edificado. |
| **Categorias de titulares** | Responsáveis técnicos e signatários de laudos (nome, registro profissional), síndico/zelador responsáveis pelos ativos. |
| **Categorias de dados** | Nome e registro profissional do responsável técnico, datas de emissão/validade, conteúdo e anexos do laudo, ativo/local vinculado. |
| **Base legal** | Cumprimento de obrigação legal/regulatória (art. 7º, II) — laudos e AVCB obrigatórios. |
| **Compartilhamento/Subprocessadores** | Supabase (Postgres/Storage). Eventual disponibilização a órgãos fiscalizadores é decisão e responsabilidade do controlador. |
| **Transferência internacional** | Conforme região Supabase ({{REGIAO_SUPABASE}}); se aplicável, art. 33. |
| **Prazo de retenção** | Pelo prazo legal/regulatório aplicável ao documento ({{RETENCAO_LAUDOS_LEGAL}}) — definido pelo controlador conforme a norma (ex.: validade do AVCB + guarda). |
| **Medidas de segurança** | RLS por `organization_id`, TLS, criptografia em repouso, controle de acesso por papel, `audit_log`. |

### OP-05 — Fornecedores / prestadores / beneficiários + fotos de boletos (Financeiro)

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Cadastrar fornecedores, prestadores e beneficiários de pagamento e processar contas a pagar/receber, incluindo **fotos de boletos** anexadas no módulo Financeiro, para execução contratual e cumprimento de obrigações fiscais/contábeis do controlador. |
| **Categorias de titulares** | Pessoas de contato de fornecedores/prestadores, beneficiários de pagamento (inclusive pessoa física, quando aplicável). |
| **Categorias de dados** | Nome, contato (e-mail/telefone), dados de identificação/pagamento constantes de boletos e documentos financeiros (podem conter CPF/CNPJ, dados bancários e valores) via **fotos/anexos**. Evitar coleta além do necessário. |
| **Base legal** | Execução de contrato (art. 7º, V) e cumprimento de obrigação legal fiscal/contábil (art. 7º, II). |
| **Compartilhamento/Subprocessadores** | Supabase (Postgres/Storage) para dados e imagens de boletos. Sem compartilhamento externo além do controlador. |
| **Transferência internacional** | Conforme região Supabase ({{REGIAO_SUPABASE}}); se aplicável, art. 33. |
| **Prazo de retenção** | Pelo prazo legal fiscal/contábil aplicável ({{RETENCAO_FISCAL}}) — tipicamente definido pelo controlador. Após, eliminação (art. 16), ressalvada guarda legal. |
| **Medidas de segurança** | RLS por `organization_id`, TLS, criptografia em repouso, acesso restrito ao papel financeiro, soft-delete via RPC, `audit_log`. **Recomendação ao controlador:** não anexar documentos com dados além do necessário à conciliação. |

### OP-06 — Chamados via QR público (`/chamado/:slug`) — solicitante anônimo

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Permitir que morador/visitante abra um chamado predial **sem login**, via rota anônima `/chamado/:slug` (QR público). O envio grava em **tabela de staging** por meio de **RPC `SECURITY DEFINER`** que resolve a organização pelo `slug`, para triagem e conversão em Ordem de Serviço pelo síndico/zelador. **EM PRODUÇÃO.** |
| **Categorias de titulares** | Solicitante do chamado (morador, condômino, visitante) — potencialmente anônimo. |
| **Categorias de dados** | Descrição do problema, local (bloco/unidade/área), `slug` da organização e **dados de contato OPCIONAIS** (nome, telefone/e-mail) fornecidos pelo próprio titular. Metadados anti-abuso (honeypot, sinais de rate-limit). **Contato não é obrigatório.** |
| **Base legal** | Legítimo interesse do controlador na gestão do edificado e atendimento de chamados (art. 7º, IX), com **teste de proporcionalidade** (art. 10). O contato, quando informado, é voluntário e minimizado. |
| **Compartilhamento/Subprocessadores** | Supabase (Postgres — tabela de staging; RPC). Notificação ao síndico/zelador via Resend **quando ativado**. |
| **Transferência internacional** | Conforme região Supabase ({{REGIAO_SUPABASE}}); se aplicável, art. 33. |
| **Prazo de retenção** | Registro de staging mantido até triagem/conversão em OS e por {{RETENCAO_CHAMADO_PUBLICO}} para histórico; após, eliminação (art. 16). Descartes de spam eliminados em {{RETENCAO_SPAM}}. |
| **Medidas de segurança** | RPC `SECURITY DEFINER` com escopo restrito à resolução por `slug` (sem expor dados de outras orgs), **honeypot + rate-limit** anti-spam, TLS, criptografia em repouso, `audit_log`. Coleta de contato **opcional** (minimização). |

### OP-07 — Logs de acesso e auditoria (`audit_log`)

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Registrar eventos e ações relevantes (acessos, criação/edição/exclusão, aprovações) em `audit_log` **append-only**, para segurança, rastreabilidade, apuração de incidentes e prestação de contas (accountability). |
| **Categorias de titulares** | Usuários autorizados que executam ações na plataforma. |
| **Categorias de dados** | Identificador do usuário, `organization_id`, ação/evento, entidade afetada, data/hora e metadados técnicos (ex.: IP, quando registrado). |
| **Base legal** | Legítimo interesse — segurança e prevenção a fraude (art. 7º, IX) e apoio ao cumprimento de obrigações legais e ao dever de segurança (art. 7º, II c/c art. 46-49). |
| **Compartilhamento/Subprocessadores** | Supabase (Postgres). Uso interno para segurança/auditoria. |
| **Transferência internacional** | Conforme região Supabase ({{REGIAO_SUPABASE}}); se aplicável, art. 33. |
| **Prazo de retenção** | {{RETENCAO_AUDIT_LOG}} (definir prazo proporcional à finalidade de segurança/auditoria). |
| **Medidas de segurança** | Tabela **append-only** (sem policies de UPDATE/DELETE — nem o owner edita histórico), RLS por `organization_id`, TLS, criptografia em repouso. |

### OP-08 — Backups gerenciados

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Manter cópias de segurança gerenciadas do banco para continuidade do serviço e recuperação de desastre. |
| **Categorias de titulares** | Todas as categorias acima, na medida em que seus dados constam do banco. |
| **Categorias de dados** | Cópia dos dados persistidos das organizações (espelho das operações OP-01 a OP-07). |
| **Base legal** | Legítimo interesse — continuidade do negócio e segurança da informação (art. 7º, IX). |
| **Compartilhamento/Subprocessadores** | Supabase (backups gerenciados da plataforma). |
| **Transferência internacional** | Conforme região/armazenamento de backup do provedor ({{REGIAO_BACKUP}}); se fora do Brasil, art. 33. |
| **Prazo de retenção** | Janela de retenção de backup {{RETENCAO_BACKUP}}. Exclusões pontuais podem persistir em backup até a rotação da janela — informar ao controlador. |
| **Medidas de segurança** | Criptografia em repouso, TLS, acesso restrito, backups gerenciados pelo provedor. |

---

## 4. Direitos dos titulares e incidentes

- **Direitos do titular** (art. 18) — acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento: **atendidos pelo controlador**, com apoio operacional da plataforma.
  - **Já existe:** export **por organização** (RPC `export_organization_data(org_id)`, restrita ao `owner`) — apoia portabilidade/rescisão no nível da organização.
  - **Roadmap:** export / exclusão / anonimização **por titular individual** — ainda **não** operacionalizado; enquanto isso, atendimento por processo manual do controlador com suporte do operador. {{STATUS_ROADMAP_TITULAR}}
- **Incidentes de segurança** (art. 48): o operador comunica o controlador **sem demora injustificada** ao tomar conhecimento; a comunicação à ANPD e aos titulares é responsabilidade do **controlador**. Canal do operador: {{DPO_EMAIL}}. Prazo contratual de notificação: {{PRAZO_NOTIFICACAO_INCIDENTE}}.
- **Instruções do controlador** (art. 39): o operador trata os dados somente conforme instruções documentadas e o contrato/DPA.

---

## 5. Lacunas a preencher (decisões do jurídico do controlador / fornecedor)

**Placeholders a completar:**
- Identificação do fornecedor-operador: `{{RAZAO_SOCIAL}}`, `{{CNPJ}}`, `{{ENDERECO}}`, `{{SITE}}`.
- Encarregado/aprovação: `{{DPO_NOME}}`, `{{DPO_EMAIL}}`, `{{APROVADOR_NOME}}`, `{{APROVADOR_CARGO}}`.
- Controle de versão: `{{VERSAO}}`, `{{DATA_VIGENCIA}}`, `{{DATA_ULTIMA_REVISAO}}`.
- Localidades de processamento: `{{REGIAO_SUPABASE}}`, `{{REGIAO_VERCEL}}`, `{{REGIAO_RESEND}}`, `{{REGIAO_BACKUP}}`.
- Prazos de retenção: `{{RETENCAO_POS_CONTRATO}}`, `{{JANELA_LIXEIRA_DIAS}}`, `{{TTL_SESSAO}}`, `{{RETENCAO_LOGIN}}`, `{{RETENCAO_REGISTROS_OPERACIONAIS}}`, `{{RETENCAO_LAUDOS_LEGAL}}`, `{{RETENCAO_FISCAL}}`, `{{RETENCAO_CHAMADO_PUBLICO}}`, `{{RETENCAO_SPAM}}`, `{{RETENCAO_AUDIT_LOG}}`, `{{RETENCAO_BACKUP}}`.
- Incidentes/roadmap: `{{PRAZO_NOTIFICACAO_INCIDENTE}}`, `{{STATUS_ROADMAP_TITULAR}}`.

**Decisões que o jurídico precisa tomar:**
1. **Confirmar a base legal de cada operação** frente aos titulares (a base é definida pelo controlador; as sugestões aqui são típicas). Em especial, documentar o **teste de proporcionalidade / LIA** do legítimo interesse (art. 7º, IX c/c art. 10) para OP-03, OP-06 e OP-07.
2. **Transferência internacional** (art. 33): confirmar as regiões reais de Supabase/Vercel/Resend/backup e, se houver transferência para fora do Brasil, o instrumento adequado (cláusulas contratuais-padrão / garantias) e a informação aos titulares.
3. **Prazos de retenção**: fixar prazos legais/contratuais por operação (fiscal, laudos/AVCB, registros de obra, logs, backups) e a política de eliminação (art. 15 e 16), inclusive a persistência residual em **backups**.
4. **Fotos de boletos (OP-05)**: avaliar minimização e mascaramento de dados excedentes; orientar usuários a não anexar PII além do necessário.
5. **Chamado público (OP-06)**: manter o contato como **opcional**; revisar textos de aviso de privacidade exibidos na rota anônima `/chamado/:slug`; definir retenção e descarte de staging e de spam.
6. **Direitos por titular individual**: definir o processo interino (manual) enquanto export/exclusão/anonimização por titular estiver no roadmap; alinhar SLAs de atendimento entre controlador e operador.
7. **Dado sensível**: reforçar por contrato/orientação que a plataforma **não** se destina a dado sensível; tratar exceções caso o controlador decida usá-las.
8. **Lista de subprocessadores**: manter anexo atualizado no DPA e o fluxo de aprovação/comunicação de alterações.
9. **Alinhar este ROPA do operador com o ROPA de cada controlador**, evitando duplicidade ou contradição de responsabilidades.

