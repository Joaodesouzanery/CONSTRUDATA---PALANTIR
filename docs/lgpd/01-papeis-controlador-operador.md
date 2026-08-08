# Papéis de Tratamento — Controlador e Operador

_Rascunho-modelo. Não constitui aconselhamento jurídico definitivo: é um template para o jurídico do cliente adaptar à sua realidade contratual e operacional._

> **Template — revisar com o jurídico.** Este documento define os papéis de tratamento de dados pessoais (controlador e operador) entre o **CLIENTE** (construtora, condomínio ou administradora) e o **fornecedor** da plataforma **{{NOME_FANTASIA}}** ("ConstruData"). Os placeholders no formato `{{MAIUSCULO}}` devem ser preenchidos e todas as decisões sinalizadas em **"Lacunas a preencher"** confirmadas antes da publicação/assinatura. Nada aqui substitui o contrato de prestação de serviços nem o DPA (Acordo de Tratamento de Dados) firmado entre as partes; em caso de conflito, prevalece o instrumento contratual.

| Campo | Valor |
|---|---|
| **Versão** | `{{VERSAO}}` (ex.: 1.0) |
| **Vigência** | `{{DATA_VIGENCIA}}` |
| **Responsável** | `{{DPO_NOME}}` — `{{DPO_EMAIL}}` |
| **Fornecedor (Operador)** | `{{RAZAO_SOCIAL}}` — CNPJ `{{CNPJ}}` — `{{ENDERECO}}` |
| **Produto** | {{NOME_FANTASIA}} ("ConstruData") — `{{SITE}}` |

---

## 1. Objetivo e escopo

Este documento formaliza **quem decide** e **quem executa** o tratamento de dados pessoais no uso da plataforma ConstruData, para fins de conformidade com a Lei nº 13.709/2018 (LGPD). Aplica-se a todos os dados pessoais tratados pelo CLIENTE dentro do seu ambiente (organização/*tenant*) na plataforma.

A ConstruData é um **SaaS multi-tenant** (React + Supabase — Postgres, Auth e Storage — hospedado na Vercel). Cada CLIENTE opera em uma **organização isolada logicamente** das demais por *Row-Level Security* (RLS) baseada em `organization_id`. A plataforma atende dois domínios: **obras** (construção civil) e **prédios/condomínios** (módulo "Predial": ativos, manutenções, laudos, chamados).

---

## 2. Definições (LGPD, art. 5º)

- **Dado pessoal** — informação relacionada a pessoa natural identificada ou identificável (art. 5º, I).
- **Titular** — a pessoa natural a quem se referem os dados (art. 5º, V).
- **Controlador** — a quem competem as decisões referentes ao tratamento (art. 5º, VI). Aqui, o **CLIENTE**.
- **Operador** — quem realiza o tratamento em nome do controlador (art. 5º, VII). Aqui, `{{RAZAO_SOCIAL}}`.
- **Tratamento** — toda operação com dados pessoais (coleta, armazenamento, uso, compartilhamento, eliminação etc.) (art. 5º, X).
- **Suboperador (subprocessador)** — terceiro contratado pelo operador para tratar dados em nome do controlador (Seção 7).

---

## 3. Identificação dos papéis

| Parte | Papel LGPD | Fundamento |
|---|---|---|
| **CLIENTE** (construtora / condomínio / administradora) | **Controlador** | Decide finalidade e meios do tratamento no seu ambiente (art. 5º, VI) |
| **`{{RAZAO_SOCIAL}}`** (fornecedor da ConstruData) | **Operador** | Trata dados **em nome do** controlador, conforme instruções e contrato (arts. 5º, VII e 39) |
| **Subprocessadores** (Seção 7) | **Suboperadores** | Contratados pelo operador para prestar infraestrutura, mediante mesmas obrigações |

**Regra de fronteira:** entre CLIENTES distintos, os ambientes são **isolados** (multi-tenant, RLS por `organization_id`). O operador **não** cruza, combina ou reaproveita dados de uma organização para outra.

**Nota sobre o operador como controlador de dados próprios:** para dados administrativos do relacionamento comercial (cadastro do CLIENTE, faturamento, contatos do contrato, logs técnicos de operação), `{{RAZAO_SOCIAL}}` atua como **controlador** desses dados específicos — e não como operador. Este documento trata apenas do tratamento **em nome do CLIENTE**.

---

## 4. Matriz de responsabilidades

Legenda: **D** = decide/responde · **E** = executa/apoia · **—** = não se aplica.

| Atividade | Controlador (CLIENTE) | Operador (`{{RAZAO_SOCIAL}}`) |
|---|---|---|
| Definir a **finalidade** do tratamento | **D** | — |
| Definir a **base legal** de cada tratamento (Seção 6) | **D** | E (fornece bases mapeadas) |
| Determinar **quais dados** são inseridos na plataforma | **D** | E (limita campos a "dados mínimos") |
| Garantir licitude da coleta na origem (ex.: contatos de fornecedores) | **D** | — |
| Disponibilizar **funcionalidades** de tratamento (RDO, OS, laudos, medições, chamados) | E | **D** (arquitetura do produto) |
| **Segurança** da infraestrutura (RLS, MFA, TLS, criptografia em repouso, backups, `audit_log`, menor privilégio) | E (uso correto) | **D** |
| Gestão de **usuários e perfis** dentro da organização | **D** | E (ferramentas de RBAC) |
| Contratar/gerenciar **subprocessadores** (Seção 7) | E (aprova/objeta) | **D** |
| Atender **direitos do titular** (Seção 8) | **D** | E (recursos de exportação/apoio) |
| **Notificação de incidente** à ANPD e aos titulares | **D** | E (notifica o controlador — Seção 9) |
| Registro das **operações de tratamento** (art. 37) | **D** (do seu ambiente) | E (fornece subsídios técnicos) |
| Realizar **RIPD/DPIA** quando cabível | **D** | E (informações técnicas) |
| **Retenção e eliminação** ao fim da relação | **D** (instrui) | E (executa devolução/eliminação) |

---

## 5. Obrigações do operador (art. 39)

`{{RAZAO_SOCIAL}}`, na qualidade de operador, compromete-se a:

1. **Tratar conforme instruções** documentadas e lícitas do controlador (arts. 39 e 6º, I), abstendo-se de tratar dados para finalidade própria ou diversa. Havendo instrução que repute ilegal, comunicará o controlador.
2. Aplicar e manter **medidas de segurança** técnicas e administrativas (art. 46): isolamento por RLS (`organization_id`), autenticação com **MFA**, **TLS** em trânsito, **criptografia em repouso**, `audit_log`, **princípio do menor privilégio** e **backups gerenciados**.
3. **Subprocessadores** — utilizar apenas suboperadores previstos (Seção 7), sob obrigações equivalentes às deste documento, e informar previamente alterações relevantes, facultada objeção do controlador.
4. **Sigilo e confidencialidade** — assegurar que pessoas com acesso aos dados estejam sob dever de confidencialidade (art. 46).
5. **Apoiar os direitos do titular** — disponibilizar recursos técnicos que permitam ao controlador atender aos pedidos dos titulares (art. 18; Seção 8).
6. **Notificar incidentes** de segurança ao controlador sem demora indevida, para que este avalie comunicação à ANPD e aos titulares (arts. 48 e 39; Seção 9).
7. **Responsabilidade solidária** — reconhecer que responde solidariamente quando descumprir instruções ou a LGPD (art. 42, §1º, I).
8. **Devolução/eliminação** dos dados ao término do contrato, conforme instrução do controlador e ressalvadas hipóteses legais de guarda.

---

## 6. Instruções documentadas do controlador

As instruções do controlador são materializadas por: (i) este documento; (ii) o contrato/DPA; e (iii) a **configuração do próprio ambiente** na plataforma (usuários, perfis, módulos ativados, dados inseridos). O operador trata os dados **apenas** dentro desses limites.

**Bases legais mapeadas na plataforma (regra — não consentimento):**

- **Execução de contrato** (art. 7º, V) — gestão de obras, ativos, manutenções, medições, chamados e financeiro no interesse do CLIENTE.
- **Cumprimento de obrigação legal/regulatória** (art. 7º, II) — ex.: laudos e AVCB obrigatórios, documentação técnica exigível.
- **Legítimo interesse** (art. 7º, IX), com teste de proporcionalidade — ex.: segurança da informação, prevenção a fraude e gestão do edificado.
- **Consentimento** (art. 7º, I) — **residual**, apenas para casos específicos (ex.: comunicações de marketing). Não é a base padrão.

**Dados pessoais tratados (princípio dos "dados mínimos"):**

- Membros da organização: nome, e-mail, papel/perfil.
- Autores de registros: RDO, OS, laudos, medições.
- Contatos de fornecedores/prestadores/beneficiários — inclusive **fotos de boletos** no Financeiro.
- **Chamado via QR público** (módulo Predial, **em produção**): rota anônima `/chamado/:slug`, na qual o solicitante abre um chamado **sem login**; grava em tabela de *staging* via RPC `SECURITY DEFINER` que resolve a organização pelo `slug`; anti-spam por *honeypot* + *rate-limit*. **Os campos de contato do solicitante são OPCIONAIS.**

> Como **regra**, a plataforma **não** trata dados sensíveis (art. 5º, II). Se o CLIENTE inserir tais dados (ex.: em campo livre), passa a ser responsável por instruir base legal adequada (art. 11) — vide "Lacunas a preencher".

---

## 7. Subprocessadores (suboperadores)

O operador utiliza os seguintes suboperadores para prestar a infraestrutura da plataforma. Alterações relevantes serão comunicadas ao controlador.

| Subprocessador | Serviço prestado | Dados envolvidos | Transferência internacional | Base contratual |
|---|---|---|---|---|
| **Supabase** | Banco de dados (Postgres), autenticação e Storage | Todos os dados do ambiente | `{{SUPABASE_REGIAO}}` — confirmar (art. 33) | Contrato/DPA do subprocessador |
| **Vercel** | Hospedagem da aplicação (front-end/edge) | Metadados de requisição, logs técnicos | `{{VERCEL_REGIAO}}` — confirmar (art. 33) | Contrato/DPA do subprocessador |
| **Resend** | E-mail transacional (**quando ativado**) | Nome e e-mail de destinatários | `{{RESEND_REGIAO}}` — confirmar (art. 33) | Contrato/DPA do subprocessador |

> Havendo **transferência internacional de dados**, indicar o mecanismo de adequação aplicável (arts. 33 a 36) em `{{MECANISMO_TRANSFERENCIA}}`.

---

## 8. Direitos do titular (art. 18)

Os pedidos dos titulares são **respondidos pelo controlador (CLIENTE)**, com **apoio operacional** da plataforma:

| Direito | Como é atendido hoje |
|---|---|
| Acesso, correção, informação sobre compartilhamento | Consulta/edição no próprio ambiente; **exportação por organização já existe** |
| Portabilidade | Exportação por organização |
| Anonimização, eliminação | Instruída pelo controlador; execução com apoio do operador |

> **Roadmap (ainda não disponível):** exportação/eliminação/anonimização **por titular individual** é item de roadmap. Enquanto não implementado, esses pedidos são atendidos por processo manual/exportação por organização. **Não prometer ao titular capacidade que a plataforma ainda não oferece.**

---

## 9. Incidentes de segurança (arts. 48 e 39)

1. Detectado incidente que possa acarretar risco ou dano relevante, o **operador notifica o controlador sem demora indevida**, prazo-alvo `{{PRAZO_NOTIFICACAO_INCIDENTE}}` (ex.: até 24/48h da ciência).
2. A notificação inclui, na medida do conhecido: natureza dos dados, titulares afetados, medidas técnicas adotadas e riscos.
3. A **comunicação à ANPD e aos titulares** é decisão e responsabilidade do **controlador**, com apoio de informações do operador.

---

## 10. Cláusulas mínimas a constar no contrato/DPA

O contrato de prestação de serviços e/ou o DPA devem contemplar, no mínimo:

1. **Objeto e duração** do tratamento; natureza e finalidade; tipos de dados e categorias de titulares.
2. **Papéis**: CLIENTE como controlador; `{{RAZAO_SOCIAL}}` como operador (arts. 5º VI/VII e 39).
3. **Instruções documentadas** e vedação de uso para finalidade própria/diversa.
4. **Medidas de segurança** mínimas (art. 46) e confidencialidade.
5. **Subprocessadores**: autorização, obrigações equivalentes e informação de alterações.
6. **Apoio aos direitos do titular** e aos deveres do controlador (RIPD, registro de operações).
7. **Notificação de incidentes** (prazo e conteúdo).
8. **Transferência internacional** e mecanismo de adequação (arts. 33–36).
9. **Devolução/eliminação** ao término e período de retenção `{{PRAZO_RETENCAO}}`.
10. **Responsabilidade e ressarcimento** (arts. 42–44); **auditoria/evidências** de conformidade.
11. **Foro/lei aplicável** e vigência.

---

## 11. Lacunas a preencher

**Placeholders a completar:**
`{{NOME_FANTASIA}}` · `{{RAZAO_SOCIAL}}` · `{{CNPJ}}` · `{{ENDERECO}}` · `{{SITE}}` · `{{DPO_NOME}}` · `{{DPO_EMAIL}}` · `{{VERSAO}}` · `{{DATA_VIGENCIA}}` · `{{SUPABASE_REGIAO}}` · `{{VERCEL_REGIAO}}` · `{{RESEND_REGIAO}}` · `{{MECANISMO_TRANSFERENCIA}}` · `{{PRAZO_NOTIFICACAO_INCIDENTE}}` · `{{PRAZO_RETENCAO}}`

**Decisões que o jurídico precisa tomar:**

1. **Instrumento contratual** — confirmar se haverá DPA autônomo ou anexo ao contrato, e qual prevalece.
2. **Regiões e transferência internacional** — confirmar a localização de Supabase, Vercel e Resend e o mecanismo de adequação (arts. 33–36).
3. **Resend** — indicar se o e-mail transacional está ativado para este CLIENTE.
4. **Dados sensíveis** (art. 11) — definir política caso campos livres recebam dados sensíveis; a regra é **não tratar**.
5. **QR público / chamado anônimo** — validar que os campos de contato do solicitante permanecem **opcionais** e a base legal aplicável (legítimo interesse / execução de contrato).
6. **Direitos do titular** — alinhar o discurso ao roadmap: hoje há exportação **por organização**; por titular ainda **não**.
7. **Prazos** de notificação de incidente e de retenção/eliminação.
8. **DPO/Encarregado** — confirmar se `{{DPO_NOME}}` é o encarregado do controlador, do operador, ou ambos, e publicar o canal (art. 41).
9. **Aprovação de subprocessadores** — definir o fluxo de objeção do controlador a novos suboperadores.

