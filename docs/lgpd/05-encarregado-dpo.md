# Encarregado pelo Tratamento de Dados Pessoais (DPO)

_Rascunho-modelo. Não constitui aconselhamento jurídico definitivo: adapte, valide e aprove com o jurídico antes de publicar ou aplicar._

> **Template — revisar com o jurídico.** Este documento designa o Encarregado pelo Tratamento de Dados Pessoais (art. 5º, VIII, e art. 41 da LGPD — Lei 13.709/2018) de **{{RAZAO_SOCIAL}}** (nome fantasia **{{NOME_FANTASIA}}** — plataforma "ConstruData"), na condição de **OPERADORA**. Os clientes da plataforma (construtoras, condomínios, administradoras) são **CONTROLADORES** e designam os próprios Encarregados. Preencha os `{{PLACEHOLDERS}}` com dados reais e decida os itens da seção "Lacunas a preencher". Não invente dados.

| Campo | Valor |
| --- | --- |
| Versão | {{VERSAO_DOC}} |
| Vigência | {{DATA_VIGENCIA}} |
| Responsável | {{DPO_NOME}} (Encarregado) — {{DPO_EMAIL}} |
| Próxima revisão | {{DATA_PROXIMA_REVISAO}} |
| Aprovação | {{APROVADOR_NOME}} / {{APROVADOR_CARGO}} |

---

## 1. Objetivo

Formalizar quem é o Encarregado de **{{RAZAO_SOCIAL}}**, suas atribuições, o canal de contato e os prazos (SLA) de atendimento a titulares e à ANPD, além de descrever como a Operadora apoia o Encarregado de cada Controlador (cliente). O Encarregado é o canal de comunicação entre a organização, os titulares de dados e a Autoridade Nacional de Proteção de Dados — ANPD (art. 41, *caput*).

## 2. Papéis: Operadora e Controlador

- **{{RAZAO_SOCIAL}} (ConstruData) — OPERADORA.** Trata dados pessoais **em nome e sob as instruções documentadas** de cada cliente Controlador, nos termos do contrato/Acordo de Tratamento de Dados (arts. 5º, VII; 37; 39). Não decide, por conta própria, finalidades de tratamento dos dados dos Controladores.
- **Cliente (construtora / condomínio / administradora) — CONTROLADOR.** Define finalidades e meios do tratamento e é o responsável primário pelo atendimento aos direitos dos titulares (arts. 5º, VI; 18).
- **Isolamento entre clientes.** A arquitetura é SaaS multi-tenant; cada organização é isolada por `organization_id` com RLS (Row-Level Security) no Supabase Postgres. Dados de um Controlador não são acessíveis a outro.

> O Encarregado designado neste documento é o **da Operadora**. Cada Controlador deve manter e divulgar o **seu próprio** Encarregado (art. 41). Registre o contato do Encarregado de cada cliente em `{{DPO_CONTROLADOR_CONTATO}}` (por organização) — ver seção 7.

## 3. Designação do Encarregado (pessoa ou comitê)

O Encarregado pode ser **uma pessoa** ou um **comitê**. Escolha **uma** das opções e apague a outra.

**Opção A — Pessoa física**
- Nome: **{{DPO_NOME}}**
- Cargo/vínculo: {{DPO_CARGO}} ({{DPO_VINCULO}} — ex.: empregado, sócio, prestador terceirizado *as-a-service*)
- Substituto em ausências: {{DPO_SUBSTITUTO_NOME}}

**Opção B — Comitê / Encarregadoria colegiada**
- Denominação: {{COMITE_NOME}} (ex.: "Comitê de Privacidade e Proteção de Dados")
- Ponto focal / porta-voz perante titulares e ANPD: **{{DPO_NOME}}**
- Membros: {{COMITE_MEMBROS}} (ex.: Jurídico, Segurança da Informação, Produto/Engenharia)
- Rito de decisão e quórum: {{COMITE_RITO}}

A identidade e o contato do Encarregado são **de acesso público**, divulgados de forma clara e objetiva no site da organização (art. 41, §1º) — ver seção 5. A ANPD pode estabelecer normas complementares sobre a definição e as atribuições do Encarregado, inclusive hipóteses de dispensa conforme porte da organização (art. 41, §3º); confirmar aplicabilidade em `{{DECISAO_DISPENSA_ANPD}}`.

## 4. Atribuições

Nos termos do art. 41, §2º, e das necessidades operacionais da plataforma, compete ao Encarregado:

1. **Receber e responder** reclamações e comunicações dos titulares, prestar esclarecimentos e adotar providências (art. 41, §2º, I).
2. **Receber comunicações da ANPD** e adotar providências (art. 41, §2º, II).
3. **Orientar** colaboradores e contratados sobre práticas de proteção de dados (art. 41, §2º, III).
4. **Executar as demais atribuições** definidas pela organização ou em normas complementares (art. 41, §2º, IV), entre elas:
   - apoiar a manutenção do **Registro das Operações de Tratamento** (art. 37) e o mapeamento de dados mínimos tratados;
   - apoiar a elaboração de **Relatório de Impacto à Proteção de Dados Pessoais — RIPD** quando cabível (art. 5º, XVII; art. 38);
   - conduzir a resposta a **incidentes de segurança** junto à Segurança da Informação e ao Jurídico (art. 48) — ver seção 6;
   - manter a lista de **subprocessadores** atualizada (Supabase — banco/auth/storage; Vercel — hospedagem; Resend — e-mail transacional, quando ativado);
   - apoiar o atendimento aos direitos dos titulares tratados pela plataforma: membros da organização, autores de registros (RDO, OS, laudos, medições), contatos de fornecedores/prestadores/beneficiários e solicitantes de chamado via QR público.

> **Sem promessas que a plataforma não cumpre.** O Encarregado orienta e coordena; a execução técnica depende dos recursos existentes (ver seção 7) e das instruções do Controlador (art. 39).

## 5. Canal de contato

Contato oficial do Encarregado de **{{RAZAO_SOCIAL}}**, divulgado publicamente (art. 41, §1º):

- **E-mail:** {{DPO_EMAIL}}
- **Encarregado:** {{DPO_NOME}}
- **Página pública:** {{SITE}}/privacidade (ou {{SITE}}/{{PAGINA_DPO}})
- **Endereço postal (opcional):** {{DPO_ENDERECO_POSTAL}} — {{ENDERECO}}
- **Telefone (opcional):** {{DPO_TELEFONE}}

Ao acionar o canal, o titular deve informar dados **mínimos** para identificação e atendimento da solicitação (ex.: e-mail cadastrado e organização/obra relacionada). Não solicitar dados além do necessário para verificar a titularidade e localizar os registros.

> **Titular que usou o QR público de chamados** (rota anônima `/chamado/:slug`): os campos de contato são **opcionais**. Se o solicitante não informou contato, pode não haver como localizá-lo ou retornar; oriente o titular a fornecer os dados mínimos de identificação ao exercer seus direitos.

## 6. SLA de resposta

Prazos-alvo. Confirmar cada número com o jurídico e alinhar ao contrato com o Controlador; a Operadora atua **sob instrução** do Controlador (art. 39).

### 6.1. A titulares

| Etapa | Prazo-alvo | Base / observação |
| --- | --- | --- |
| Confirmação de recebimento (acknowledgment) | {{SLA_ACK_TITULAR}} (ex.: 2 dias úteis) | Boa prática; não é prazo legal fixo |
| Confirmação de existência de tratamento / acesso — formato simplificado | Imediato | Art. 19, §1º |
| Acesso — declaração completa | Até 15 dias | Art. 19, II |
| Correção, anonimização, portabilidade, eliminação e informação sobre compartilhamento | {{SLA_RESPOSTA_TITULAR}} (ex.: 15 dias) | Art. 18; sem prazo fixo único — definir e justificar |

Quando o pedido chegar à Operadora mas a decisão couber ao Controlador, o Encarregado **encaminha** ao Encarregado do Controlador competente sem responder ao mérito (art. 39), registrando data/hora do encaminhamento.

### 6.2. À ANPD

| Situação | Prazo-alvo | Base / observação |
| --- | --- | --- |
| Resposta a requisição da ANPD | No prazo indicado na própria requisição | Art. 41, §2º, II |
| Comunicação de incidente de segurança relevante | {{SLA_INCIDENTE_ANPD}} (ex.: 3 dias úteis) | Art. 48; **confirmar** prazo/critérios na regulamentação vigente da ANPD |

### 6.3. Incidentes de segurança

- A Operadora **comunica o Controlador sem demora injustificada** ao tomar conhecimento de incidente que possa acarretar risco ou dano relevante (art. 48), em até {{SLA_INCIDENTE_CONTROLADOR}} (ex.: 24h), para que o Controlador (via seu Encarregado) avalie a comunicação à ANPD e aos titulares.
- Critérios de relevância, conteúdo mínimo da comunicação e fluxo interno: definir em `{{POLITICA_INCIDENTES}}` (documento próprio) e referenciar aqui.

## 7. Como a Operadora apoia o Encarregado do Controlador

A Operadora não substitui o Encarregado do Controlador; ela o **instrumentaliza** com recursos reais da plataforma:

- **Encaminhamento de solicitações.** Pedidos de titulares recebidos por canais da Operadora (inclusive chamados abertos pelo QR público) são encaminhados ao Controlador competente, identificado pelo `organization_id`.
- **Notificação de incidentes.** Alerta ao Controlador conforme seção 6.3, com as informações disponíveis para que ele cumpra o art. 48.
- **Atendimento a acesso/portabilidade.** **Export por organização já existe** e serve de base para pedidos de acesso e portabilidade; o Encarregado do Controlador solicita à Operadora o conjunto de dados da sua organização.
- **Correção / eliminação / anonimização por titular.** Hoje operadas **por organização**; a operação **por titular** (export/exclusão/anonimização granular) está no **roadmap**. Enquanto isso, atendimento **assistido caso a caso** pela Operadora, sob instrução do Controlador. Não prometer automação inexistente.
- **Registros e rastreabilidade.** Trilha de auditoria (`audit_log`), princípio do **menor privilégio**, autenticação com **MFA**, **TLS** em trânsito, criptografia em repouso e **backups gerenciados** apoiam a demonstração de conformidade (*accountability* — art. 6º, X).
- **Isolamento multi-tenant.** RLS por `organization_id` assegura que dados de um Controlador não sejam expostos a outro.
- **Subprocessadores.** Lista mantida atualizada (Supabase, Vercel, Resend — este quando ativado) para subsidiar o Controlador na informação sobre compartilhamento e eventuais transferências (detalhar em documento de subprocessadores).

Contato do Encarregado de cada Controlador: registrar em `{{DPO_CONTROLADOR_CONTATO}}` (por organização) — nome, e-mail e, se houver, canal público.

## 8. Base legal do tratamento (referência)

O tratamento na plataforma apoia-se, **como regra**, em: execução de contrato (art. 7º, V), cumprimento de obrigação legal/regulatória (art. 7º, II — ex.: laudos e AVCB obrigatórios) e legítimo interesse com teste de proporcionalidade (art. 7º, IX — ex.: segurança, prevenção a fraude, gestão do edificado). **Consentimento** (art. 7º, I) apenas em casos residuais (ex.: comunicações de marketing). O detalhamento por operação consta do Registro de Tratamento (art. 37) e do documento de bases legais do pacote.

## 9. Governança e revisão deste documento

- **Registro das atuações** do Encarregado: manter log de solicitações, encaminhamentos e prazos; atas, se comitê.
- **Revisão:** ao menos anual ou a cada mudança relevante (novo subprocessador, nova funcionalidade que trate dados pessoais, alteração regulatória da ANPD). Próxima revisão: {{DATA_PROXIMA_REVISAO}}.
- **Controle de versões:** manter histórico em `{{CONTROLE_VERSOES}}`.

---

## Lacunas a preencher

**Placeholders (dados da organização e do Encarregado):**
- `{{RAZAO_SOCIAL}}`, `{{CNPJ}}`, `{{ENDERECO}}`, `{{SITE}}`, `{{PAGINA_DPO}}` — dados da Operadora ({{NOME_FANTASIA}} = ConstruData).
- `{{DPO_NOME}}`, `{{DPO_EMAIL}}`, `{{DPO_CARGO}}`, `{{DPO_VINCULO}}`, `{{DPO_SUBSTITUTO_NOME}}`, `{{DPO_TELEFONE}}`, `{{DPO_ENDERECO_POSTAL}}` — Encarregado (Opção A).
- `{{COMITE_NOME}}`, `{{COMITE_MEMBROS}}`, `{{COMITE_RITO}}` — se optar por comitê (Opção B).
- `{{VERSAO_DOC}}`, `{{DATA_VIGENCIA}}`, `{{DATA_PROXIMA_REVISAO}}`, `{{APROVADOR_NOME}}`, `{{APROVADOR_CARGO}}`, `{{CONTROLE_VERSOES}}` — metadados/governança.
- `{{DPO_CONTROLADOR_CONTATO}}` — contato do Encarregado de cada cliente Controlador (por organização).

**SLA a definir e justificar:**
- `{{SLA_ACK_TITULAR}}`, `{{SLA_RESPOSTA_TITULAR}}` — prazos a titulares (confirmar art. 19 para acesso).
- `{{SLA_INCIDENTE_CONTROLADOR}}` — janela para a Operadora avisar o Controlador.
- `{{SLA_INCIDENTE_ANPD}}` — **confirmar** prazo e critérios de incidente na regulamentação vigente da ANPD (art. 48).

**Decisões do jurídico:**
1. **Pessoa ou comitê** (seção 3) — escolher uma opção e remover a outra.
2. **Vínculo do Encarregado** — interno, sócio ou terceirizado (*DPO-as-a-service*); avaliar conflito de interesses e independência.
3. **Dispensa/normas complementares da ANPD** (`{{DECISAO_DISPENSA_ANPD}}`, art. 41, §3º) — verificar aplicabilidade conforme porte.
4. **Fluxo de incidentes** (`{{POLITICA_INCIDENTES}}`) — critérios de relevância, conteúdo mínimo e cadeia de acionamento (art. 48).
5. **Divisão operador/controlador no atendimento a titulares** — quem responde ao mérito e como se dá o encaminhamento (art. 39), refletindo o Acordo de Tratamento de Dados.
6. **Transferência internacional** — confirmar regiões e salvaguardas dos subprocessadores (Supabase, Vercel, Resend) e remeter ao documento próprio (arts. 33–36).
7. **Roadmap de direitos por titular** — enquanto export/exclusão/anonimização granular não estiver disponível, formalizar o procedimento assistido caso a caso e não prometer automação inexistente.

