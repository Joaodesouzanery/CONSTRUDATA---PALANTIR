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
| OP-09 | Cadastro de mão de obra própria e terceirizada (Mão de Obra) | Execução de contrato de trabalho (V) · Obrigação legal trabalhista (II) |
| OP-10 | Registro eletrônico de jornada com geolocalização (Ponto Eletrônico) | Obrigação legal trabalhista (II) — CLT art. 74 §2º |

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
| **Compartilhamento/Subprocessadores** | Supabase (infraestrutura da plataforma; backup gerenciado conforme o plano contratado — ver `06-politica-de-seguranca.md` §8). |
| **Transferência internacional** | Conforme região/armazenamento de backup do provedor ({{REGIAO_BACKUP}}); se fora do Brasil, art. 33. |
| **Prazo de retenção** | Janela de retenção de backup {{RETENCAO_BACKUP}}. Exclusões pontuais podem persistir em backup até a rotação da janela — informar ao controlador. |
| **Medidas de segurança** | Criptografia em repouso, TLS, acesso restrito, soft-delete e export por organização sob demanda. Backup gerenciado pelo provedor conforme o plano contratado — ver `06-politica-de-seguranca.md` §8. |

---

## 4. Direitos dos titulares e incidentes

- **Direitos do titular** (art. 18) — acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento: **atendidos pelo controlador**, com apoio operacional da plataforma.
  - **Já existe:** export **por organização** (RPC `export_organization_data(org_id)`, restrita ao `owner`) — apoia portabilidade/rescisão no nível da organização.
  - **Roadmap:** export / exclusão / anonimização **por titular individual** — ainda **não** operacionalizado; enquanto isso, atendimento por processo manual do controlador com suporte do operador. {{STATUS_ROADMAP_TITULAR}}
- **Incidentes de segurança** (art. 48): o operador comunica o controlador **sem demora injustificada** ao tomar conhecimento; a comunicação à ANPD e aos titulares é responsabilidade do **controlador**. Canal do operador: {{DPO_EMAIL}}. Prazo contratual de notificação: {{PRAZO_NOTIFICACAO_INCIDENTE}}.
- **Instruções do controlador** (art. 39): o operador trata os dados somente conforme instruções documentadas e o contrato/DPA.

---


### OP-09 — Cadastro de mão de obra própria e terceirizada

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Manter o cadastro dos trabalhadores da obra para escalar equipes, apontar horas, calcular custo de mão de obra, controlar jornada (CLT) e produzir a folha. Alimentado pela tela e pela **importação de planilha** (`.xlsx`) do próprio controlador. |
| **Categorias de titulares** | Trabalhadores próprios e terceirizados do controlador. |
| **Categorias de dados** | Nome, cargo/função, equipe, frente de trabalho, telefone, e-mail, matrícula, data de admissão, tipo de contrato, salário/valor-hora, benefícios (VA/VT), dependentes para IRRF, **categoria** de habilitação (A/B) e observações operacionais. **Sem dado sensível.** |
| **⚠️ O que é DELIBERADAMENTE não coletado** | **CPF completo, RG, número da CNH, título de eleitor, CTPS, PIS, conta bancária, antecedentes criminais e resultado de exame ocupacional (ASO).** A importação de planilha **barra esses campos em tempo de execução** (`src/lib/funcionarioImportado.ts`), com teste que falha se algum voltar. O CPF existe no cadastro **manual**, mascarado nos dois últimos dígitos. Antecedentes e ASO seriam dado sensível (art. 11) e exigiriam base própria — não há fluxo que os use. |
| **Base legal** | Execução do contrato de trabalho e obrigações dele decorrentes (art. 7º, V) e obrigação legal trabalhista/previdenciária (art. 7º, II) — CLT art. 74 §2º (registro de jornada), FGTS e eSocial. |
| **Compartilhamento/Subprocessadores** | Supabase (Postgres). Sem compartilhamento comercial. |
| **Transferência internacional** | Conforme a região do projeto Supabase ({{REGIAO_SUPABASE}}). |
| **Prazo de retenção** | ⚠️ **Assimétrico, de propósito.** Nome, cargo, equipe e datas seguem os prazos trabalhistas/previdenciários aplicáveis ({{RETENCAO_TRABALHISTA}}) e **não são apagados** na anonimização — art. 16, II. Telefone, e-mail, observações e local são apagados a pedido do titular, porque **não têm base de retenção**. |
| **Direitos do titular** | Atendidos por `export_dados_titular` (chaves `funcionarios` e `equipes_como_encarregado`) e `anonimizar_dados_titular`, que redige os campos sem retenção e **também redige o `audit_log`** — o gatilho de auditoria grava o registro inteiro, então sem essa redação anonimizar espalharia o dado que deveria remover. |
| **Medidas de segurança** | RLS por `organization_id`, escrita gateada por papel, TLS, criptografia em repouso, soft-delete, `audit_log`. Filtro de campos na importação, com lista exaustiva verificada em compilação. |

### OP-10 — Registro eletrônico de jornada com geolocalização (Ponto Eletrônico)

| Campo | Descrição |
|---|---|
| **Operação/Finalidade** | Registrar a jornada de trabalho (entrada, intervalo e saída) em sistema eletrônico, como exige o **CLT art. 74 §2º**, e comprovar que a marcação foi feita no local de trabalho. A posição do aparelho é usada para uma única decisão: a batida está dentro do raio da obra ou não. |
| **Categorias de titulares** | Trabalhadores do controlador que registram ponto pelo aplicativo. |
| **Categorias de dados** | Identificação do trabalhador (`worker_id`) e da conta que bateu (`auth_user_id`), tipo e instante da batida (hora do aparelho **e** hora do servidor), obra, **latitude, longitude e precisão do GPS no instante da marcação**, distância até a obra, resultado da cerca, justificativa escrita pelo próprio trabalhador quando a localização não pôde ser confirmada, e NSR (número sequencial de registro). |
| **⚠️ O que é DELIBERADAMENTE não coletado** | **Rastreamento contínuo.** A posição é lida **apenas no toque do botão de bater ponto** — não há `watchPosition`, não há coleta em segundo plano, não há histórico de deslocamento. Fora desse instante o sistema não sabe onde o trabalhador está, e não tem como saber. Também **não** há biometria, foto, reconhecimento facial nem captura de rede/Wi-Fi. |
| **Base legal** | **Obrigação legal** (art. 7º, II) — CLT art. 74 §2º e Portaria MTP 671/2021, que impõem o controle de jornada e a inalterabilidade do registro. A geolocalização apoia essa mesma obrigação (comprovação do local da marcação) e é **minimizada ao instante do evento** (art. 6º, III). |
| **⚠️ Decisão do controlador registrada aqui** | O controlador optou por **bloquear** a marcação fora do raio configurado (padrão 5 km, ajustável por obra). O sistema **nunca bloqueia quando não sabe onde a pessoa está**: GPS negado, posição indisponível, precisão pior que o raio ou obra sem coordenada **registram a batida**, marcada para conferência e com justificativa do trabalhador. Bloquear nesses casos criaria buraco no registro de jornada — o oposto do que o art. 74 exige. |
| **Compartilhamento/Subprocessadores** | Supabase (Postgres). Os relatórios de jornada são exportados **pelo controlador** (PDF/Excel) e por ele encaminhados à contabilidade; a plataforma não envia nada a terceiros por conta própria. |
| **Transferência internacional** | Conforme a região do projeto Supabase ({{REGIAO_SUPABASE}}). |
| **Prazo de retenção** | O registro de jornada segue o prazo trabalhista aplicável ({{RETENCAO_TRABALHISTA}}; a referência usual é **5 anos**, art. 7º XXIX da CF c/c CLT art. 11). ⚠️ **Retenção assimétrica:** a batida (quem, quando, onde-sim/onde-não) é prova e **não é apagada** a pedido — art. 16, II. A **coordenada bruta** (lat/lng/precisão) não é exigida pela lei trabalhista e pode ser eliminada antes, mantendo-se o resultado da cerca; essa política é decisão do controlador (ver §5). |
| **Direitos do titular** | O trabalhador vê o próprio espelho de ponto no aplicativo (a policy de SELECT recorta pelas batidas dele) e pode **solicitar ajuste**, que nunca apaga a marcação original: o ajuste entra como registro novo, marcado, com autor e motivo. Acesso e portabilidade pelos mesmos canais das demais operações. |
| **Medidas de segurança** | RLS por `organization_id` **e por titular**: o papel `colaborador` só insere batida com `auth_user_id = auth.uid()` **e** `worker_id` igual ao cadastro vinculado àquela conta, e só lê as próprias marcações. **DELETE bloqueado por policy**; UPDATE passa por gatilho que congela identidade, tipo e horas — nem o gestor reescreve a prova. NSR sequencial atribuído **pelo servidor**; hora do servidor gravada pelo Postgres no `insert` ao lado da hora do aparelho, com a diferença entre as duas registrada em coluna própria. `audit_log`, TLS e criptografia em repouso. |
| **⚠️ Minimização, aplicada no banco** | O `colaborador` é a primeira conta do sistema que não é da gestão, e o padrão de leitura do projeto é amplo (policy de SELECT só por organização). Por isso existe uma **cerca de leitura** própria (`20260918160000_colaborador_so_o_ponto.sql`): policies restritivas fecham toda tabela com RLS para esse papel, menos as que ele precisa para trabalhar — e em `workers`, que carrega salário e valor-hora de toda a empresa, ele enxerga **apenas o próprio cadastro**. Sem isso, abrir a tela do ponto copiaria a base da empresa para o `localStorage` de um celular de canteiro, muitas vezes compartilhado. |

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
9. **Geolocalização no ponto (OP-10)**: (a) confirmar a retenção da **coordenada bruta** — se ela cai antes dos 5 anos da batida, fixar o prazo e o rotineiro de eliminação; (b) aprovar o **aviso ao trabalhador** e, se o controlador entender aplicável, colher ciência formal (a base é obrigação legal, não consentimento — mas a transparência do art. 9º continua devida); (c) decidir se a política de **bloqueio fora do raio** consta do regulamento interno, já que ela pode impedir a marcação de quem trabalha legitimamente fora do canteiro.
10. **Alinhar este ROPA do operador com o ROPA de cada controlador**, evitando duplicidade ou contradição de responsabilidades.

