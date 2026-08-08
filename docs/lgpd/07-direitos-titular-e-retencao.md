# Atendimento aos Direitos do Titular + Política de Retenção e Eliminação

_Rascunho-modelo (template). Não é aconselhamento jurídico definitivo: os prazos, bases e decisões abaixo devem ser revisados e assumidos pelo jurídico do controlador antes de qualquer publicação ou uso interno._

> **Template — revisar com o jurídico.** Documento genérico para adaptação pelo cliente (controlador). Substitua todos os `{{PLACEHOLDERS}}`, valide prazos de retenção conforme a legislação aplicável ao seu setor e confirme os subprocessadores efetivamente ativos no seu contrato com a **ConstruData**. Não publique com placeholders em aberto.

| Campo | Valor |
|---|---|
| **Documento** | Atendimento aos Direitos do Titular + Política de Retenção e Eliminação |
| **Versão** | `{{VERSAO}}` |
| **Vigência** | `{{DATA_VIGENCIA}}` |
| **Responsável (Encarregado/DPO)** | `{{DPO_NOME}}` — `{{DPO_EMAIL}}` |
| **Controlador** | `{{RAZAO_SOCIAL_CONTROLADOR}}` (`{{CNPJ_CONTROLADOR}}`) |
| **Operadora (plataforma)** | `{{RAZAO_SOCIAL}}` (`{{CNPJ}}`) — nome fantasia **ConstruData** |
| **Próxima revisão** | `{{DATA_PROXIMA_REVISAO}}` |

---

## 1. Objetivo e âmbito

Este documento descreve **(Parte 1)** como o controlador recebe, verifica e atende pedidos de titulares de dados pessoais (art. 18), com o fluxo de apoio da operadora **ConstruData**; e **(Parte 2)** por quanto tempo cada categoria de dado é retida e como é eliminada ou anonimizada ao fim do prazo (arts. 15 e 16).

Aplica-se aos dados pessoais tratados na plataforma **ConstruData**, um SaaS multi-tenant (React + Supabase — Postgres/Auth/Storage; hospedagem Vercel) que atende dois domínios: **obras** (construção civil) e **prédios/condomínios** (módulo Predial — ativos, manutenções, laudos, chamados). O isolamento entre organizações é feito por RLS sobre `organization_id`.

### Papéis (não confundir)

- **Controlador:** o cliente — construtora, condomínio ou administradora — que decide as finalidades e os meios do tratamento. É quem **recebe e responde** ao titular (art. 18, §5º).
- **Operadora:** `{{RAZAO_SOCIAL}}` (**ConstruData**), que trata os dados **em nome do controlador**, seguindo suas instruções e o contrato/DPA (art. 39). A operadora **apoia** o atendimento; **não responde diretamente ao titular**.

> Regra de ouro: se um titular procurar a **ConstruData** diretamente, o pedido é **encaminhado ao controlador competente** (identificado pela organização/tenant) e a operadora **não decide sobre o mérito**.

---

# PARTE 1 — Atendimento aos Direitos do Titular (art. 18)

## 2. Direitos atendidos

O titular pode, mediante requisição gratuita (art. 18, *caput*):

| # | Direito | Base | Como é atendido na ConstruData |
|---|---|---|---|
| 1 | **Confirmação** da existência de tratamento | art. 18, I | Consulta do controlador aos registros da organização |
| 2 | **Acesso** aos dados | art. 18, II | Export por organização (já existe) filtrado ao titular |
| 3 | **Correção** de dados incompletos, inexatos ou desatualizados | art. 18, III | Edição no cadastro/registro pelo controlador |
| 4 | **Anonimização, bloqueio ou eliminação** de dados desnecessários, excessivos ou tratados em desconformidade | art. 18, IV | Ação do controlador; anonimização por titular é **roadmap** |
| 5 | **Portabilidade** a outro fornecedor | art. 18, V; art. 40 | Export em formato estruturado (CSV/JSON) pelo controlador |
| 6 | **Eliminação** dos dados tratados com consentimento | art. 18, VI; art. 16 | Ver ressalvas de retenção (Parte 2) |
| 7 | **Informação sobre compartilhamento** (entidades com quem os dados foram compartilhados) | art. 18, VII | Lista de subprocessadores + registros da organização |
| 8 | **Informação sobre não consentir** e consequências | art. 18, VIII | Aplicável só onde a base é consentimento |
| 9 | **Revogação do consentimento** | art. 18, IX | Aplicável só onde a base é consentimento (ex.: marketing) |
| 10 | **Revisão de decisão automatizada** | art. 20 | Ver seção 6 |

> **Base legal predominante.** Na ConstruData o tratamento é sustentado, como regra, por **execução de contrato** (art. 7º, V), **obrigação legal/regulatória** (art. 7º, II) e **legítimo interesse** (art. 7º, IX). O **consentimento** (art. 7º, I) é residual. Isso significa que os direitos de **revogação de consentimento** e **eliminação por revogação** (itens 6, 8 e 9) só se aplicam aos poucos tratamentos baseados em consentimento (ex.: comunicações de marketing) — e que pedidos de eliminação podem esbarrar em **retenções obrigatórias** (Parte 2, seção 8).

## 3. O que a plataforma JÁ oferece vs. roadmap

Para evitar promessas que a plataforma não cumpre, seja explícito com o titular:

| Capacidade | Situação | Observação |
|---|---|---|
| **Export por organização** (todos os dados do tenant) | **Já existe** | Base para atender acesso e portabilidade; o controlador filtra o recorte do titular |
| **Edição/correção** de cadastros e registros | **Já existe** | Feito pelo controlador na interface |
| **Audit log** (`audit_log`) | **Já existe** | Suporta comprovação e rastreabilidade do atendimento |
| **Export por titular** (recorte automático de um titular específico) | **Roadmap** | Hoje é operação manual do controlador sobre o export por organização |
| **Exclusão por titular** (apagar apenas os dados de um titular) | **Roadmap** | Hoje é operação manual/pontual; sujeita às retenções obrigatórias |
| **Anonimização por titular** | **Roadmap** | Hoje é operação manual/pontual |

> **Enquanto os itens de roadmap não estiverem disponíveis**, o atendimento de acesso/portabilidade/eliminação **por titular** é executado **manualmente** pelo controlador, com apoio da operadora quando necessário (ver seção 5). Não prometa automação inexistente.

## 4. Canal, identificação e verificação de identidade

- **Canal do titular:** `{{CANAL_TITULAR_EMAIL}}` / `{{CANAL_TITULAR_FORMULARIO}}`, sob responsabilidade do Encarregado `{{DPO_NOME}}` (`{{DPO_EMAIL}}`).
- **Verificação de identidade (obrigatória antes de responder):** confirme que o solicitante é o titular (ou representante legal habilitado), de forma **proporcional** ao risco e **sem coletar dados novos além do necessário** ("dados mínimos"). Ex.: conferência do e-mail/telefone já cadastrado, pergunta de verificação sobre registro que só o titular conheceria, ou documento quando estritamente indispensável.
- **Caso de dúvida razoável sobre identidade:** solicite complemento **antes** de qualquer entrega. Não entregue dados a quem não foi verificado.
- **Solicitante de chamado via QR público** (`/chamado/:slug`): como os campos de contato são **opcionais** e a abertura é anônima (sem login), a verificação pode ser inviável quando o titular não forneceu contato. Nesse caso, o atendimento se limita ao que for possível identificar de forma inequívoca; registre a impossibilidade quando aplicável.

## 5. Fluxo controlador ↔ operador

```
Titular  ──►  Controlador (cliente)  ──►  [se precisar de apoio técnico]  ──►  Operadora (ConstruData)
   ▲                    │                                                            │
   └──── resposta ──────┘◄──────────────── dados/export/execução ────────────────────┘
```

1. **Recebimento (controlador).** Registra o pedido, dá protocolo `{{PREFIXO_PROTOCOLO}}-AAAA-NNNN`, classifica o(s) direito(s) e verifica identidade (seção 4).
2. **Triagem de base legal.** Verifica se o dado está sob obrigação legal/contrato/legítimo interesse (pode **limitar** eliminação — Parte 2) ou consentimento.
3. **Execução na plataforma (controlador).** Correção/edição direta; para acesso/portabilidade, gera **export por organização** e recorta o titular; para eliminação/anonimização, executa a ação disponível.
4. **Apoio da operadora (quando necessário).** Se a ação exceder a interface do controlador (ex.: recorte técnico, remoção em `staging` de chamados, dado em Storage), o controlador aciona a **ConstruData** por `{{CANAL_SUPORTE_OPERADORA}}`. A operadora executa **conforme instrução documentada** do controlador (art. 39) e devolve evidência.
5. **Comunicação entre agentes.** Recebido um pedido que afete outro agente de tratamento, o controlador informa **imediatamente** a operadora, e vice-versa (art. 18, §6º).
6. **Resposta ao titular (controlador).** No formato e prazo da seção 7.
7. **Registro.** Fecha o protocolo no controle de pedidos (seção 9) e anexa evidências.

## 6. Revisão de decisões automatizadas (art. 20)

`{{DECLARAR_SE_HA_DECISAO_AUTOMATIZADA}}`

- **Se o controlador NÃO usa decisões unicamente automatizadas** que afetem interesses do titular: declare que a ConstruData é uma ferramenta de **registro e gestão**, sem decisão automatizada de perfil, crédito ou similar — e este direito é **inaplicável**.
- **Se houver** algum tratamento automatizado relevante (ex.: `{{DESCREVER_TRATAMENTO_AUTOMATIZADO}}`): o titular pode solicitar **revisão** e **informações claras** sobre os critérios, observados segredo comercial e industrial. Descreva aqui o procedimento de revisão humana.

## 7. Prazos (art. 19)

| Situação | Prazo |
|---|---|
| Confirmação da existência de tratamento e acesso — **formato simplificado** | **Imediato** (art. 19, I) |
| Declaração **clara e completa** do tratamento (origem, critérios, finalidade) | Até **15 dias** da requisição (art. 19, II) |
| Correção / anonimização / bloqueio / eliminação / portabilidade | `{{PRAZO_INTERNO_DIAS}}` dias (defina prazo interno razoável; comunique o titular se depender de terceiros/subprocessadores) |
| Resposta de recusa (total ou parcial) com **justificativa** | Junto com a resposta, no prazo acima |
| SLA de apoio da operadora ao controlador | `{{SLA_OPERADORA}}` |

> Recusas possíveis: quando o pedido conflita com **obrigação legal de retenção** (Parte 2), com **direitos de terceiros**, ou quando a **identidade não é comprovada**. Toda recusa deve ser **justificada por escrito** e registrada.

## 8. Comunicação de correção/eliminação a terceiros

Quando dados corrigidos, eliminados ou anonimizados tiverem sido compartilhados, o controlador **comunica os agentes envolvidos** (art. 18, §6º), salvo impossibilidade comprovada ou esforço desproporcional. No contexto da ConstruData, os agentes relevantes são os **subprocessadores**:

| Subprocessador | Função | Situação |
|---|---|---|
| **Supabase** | Banco (Postgres) / Auth / Storage | Ativo |
| **Vercel** | Hospedagem | Ativo |
| **Resend** | E-mail transacional | `{{RESEND_ATIVO_SIM_NAO}}` (quando ativado) |

## 9. Registro dos pedidos (art. 37)

Mantenha um **controle de pedidos** com, no mínimo:

- Protocolo, data de recebimento e canal;
- Direito(s) solicitado(s) e organização/tenant;
- Resultado da verificação de identidade;
- Ações executadas (e por quem — controlador/operadora);
- Data e forma da resposta; justificativa em caso de recusa;
- Evidências (referência ao `audit_log`, export gerado, confirmação da operadora).

Sugestão de retenção deste **registro de atendimento**: `{{RETENCAO_REGISTRO_PEDIDOS}}` (ver Parte 2), pois serve de prova de conformidade.

---

# PARTE 2 — Política de Retenção e Eliminação (arts. 15 e 16)

## 10. Princípios

- **Necessidade e finalidade** (art. 6º, III): retém-se o **mínimo** pelo **menor tempo** compatível com a finalidade.
- **Término do tratamento** (art. 15): quando a finalidade é alcançada, o período contratado termina, o titular solicita, ou por determinação da ANPD.
- **Eliminação ao término** (art. 16), com **exceções legais**: cumprimento de obrigação legal/regulatória; transferência a terceiro (respeitados os requisitos); uso exclusivo do controlador, **anonimizado**, vedado o acesso de terceiros.

> Onde a eliminação não for possível por retenção obrigatória, aplica-se **bloqueio** (restrição de acesso e uso) ou **anonimização**.

## 11. Tabela de retenção por categoria

> **Prazos abaixo são placeholders a validar pelo jurídico do controlador.** Os intervalos indicados são meras referências usuais no Brasil e **não** substituem a análise do caso concreto (setor, contratos, legislação trabalhista/fiscal/urbanística aplicável).

| Categoria | Exemplos na ConstruData | Base / motivo da retenção | Prazo (a validar) | Ação ao fim do prazo |
|---|---|---|---|---|
| **Cadastro de membros da organização** | Nome, e-mail, papel/perfil (Supabase Auth + tabelas do tenant) | Execução de contrato (art. 7º, V) | Enquanto **contrato ativo** + `{{PRAZO_POS_CONTRATO_CADASTRO}}` | Eliminar ou anonimizar autoria |
| **Autores de registros operacionais** | Autor de RDO, OS, laudos, medições | Execução de contrato; obrigação legal; prova | Vinculado ao registro-mãe (linhas seguintes) | Anonimizar autoria, preservando o registro |
| **Registros de obra (RDO/medições)** | Diário de obra, medições, apontamentos | Prazos fiscais e **trabalhistas** da obra (art. 7º, II) | `{{PRAZO_OBRA_TRABALHISTA}}` (ex.: 5 anos) | Eliminar/anonimizar conforme o caso |
| **Financeiro** | Contatos de fornecedores/prestadores/beneficiários; **fotos de boletos** (Storage) | Obrigações fiscais/contábeis (art. 7º, II) | `{{PRAZO_FISCAL}}` (ex.: 5 anos) | Eliminar do Storage + tabelas |
| **Laudos técnicos / Predial** | Laudos, AVCB, ART/RRT, manutenções, ativos | Obrigação legal/regulatória (art. 7º, II); vida útil do ativo | `{{PRAZO_LAUDOS}}` (vigência do laudo/vida do ativo + margem) | Eliminar/arquivar conforme norma |
| **Chamados via QR público** | Nome/contato/local do solicitante — **campos opcionais** (tabela `staging` via RPC `SECURITY DEFINER`) | Legítimo interesse — gestão do edificado (art. 7º, IX) | `{{PRAZO_CHAMADO}}` (curto, ex.: 12 meses após conclusão) | Eliminar contato; manter estatística **anonimizada** |
| **Logs de auditoria** | `audit_log` (quem fez o quê, quando) | Legítimo interesse — segurança/prevenção a fraude (art. 7º, IX) | `{{PRAZO_LOGS}}` | Eliminar/anonimizar |
| **Autenticação** | Sessões, MFA, identidades (Supabase Auth) | Segurança; execução de contrato | Enquanto conta ativa + `{{PRAZO_AUTH}}` | Revogar credenciais e eliminar |
| **Backups gerenciados** | Snapshots do banco/Storage | Continuidade e recuperação (legítimo interesse) | Ciclo de retenção do backup: `{{PRAZO_BACKUP}}` | Expira pelo rodízio — dado eliminado **em produção** é removido dos backups ao fim do ciclo |
| **Registro de atendimento a titulares** | Protocolos e evidências (seção 9) | Prova de conformidade (art. 37) | `{{RETENCAO_REGISTRO_PEDIDOS}}` | Eliminar/anonimizar |
| **Dados sob consentimento** | Ex.: lista de marketing | Consentimento (art. 7º, I) | Até revogação (art. 18, IX) | Eliminar prontamente |

> **Dado sensível:** a ConstruData, **como regra, não trata dado pessoal sensível** (art. 5º, II). Se algum controlador o inserir fora do previsto, deve tratá-lo em política específica — este template não o cobre.

## 12. Processo de eliminação / anonimização ao fim do prazo

1. **Gatilho** (art. 15): término de contrato, fim do prazo de retenção, pedido do titular ou determinação da ANPD.
2. **Verificação de exceções** (art. 16): antes de eliminar, checar se há obrigação legal/regulatória, prova em processo ou outra base que **exija reter** — nesse caso, **bloquear** ou **anonimizar** em vez de eliminar.
3. **Escolha da técnica:**
   - **Eliminação:** remoção do dado das tabelas e do **Storage** (fotos de boletos, anexos).
   - **Anonimização:** substituição de identificadores por valor não reversível, **preservando o registro operacional** (ex.: manter o RDO, anonimizando o autor) — assim o dado deixa de ser pessoal (art. 5º, XI) e sai do escopo da LGPD.
   - **Bloqueio:** restrição de acesso/uso quando não se pode eliminar nem anonimizar ainda.
4. **Execução multi-camada:** produção (Postgres + Storage) → propagação para **backups** conforme o ciclo `{{PRAZO_BACKUP}}` → notificação a subprocessadores quando aplicável (seção 8).
5. **Chamados QR público:** eliminar os **contatos** do solicitante na tabela de `staging`/destino; a métrica operacional pode ser mantida **anonimizada**.
6. **Evidência e registro:** anotar no `audit_log` e no controle da seção 9 (o quê, quando, técnica, executor). A operadora, quando executa, devolve confirmação ao controlador (art. 39).
7. **Fim de contrato com a operadora:** ao encerrar a relação, a **ConstruData**, conforme instrução do controlador, **elimina ou devolve** os dados (art. 15, parágrafo único, c/c contrato/DPA), ressalvadas as retenções legais obrigatórias.

---

## 13. Lacunas a preencher

**Placeholders a substituir**

- Identificação: `{{RAZAO_SOCIAL}}`, `{{CNPJ}}`, `{{ENDERECO}}`, `{{RAZAO_SOCIAL_CONTROLADOR}}`, `{{CNPJ_CONTROLADOR}}`, `{{SITE}}`, `{{DPO_NOME}}`, `{{DPO_EMAIL}}`.
- Controle documental: `{{VERSAO}}`, `{{DATA_VIGENCIA}}`, `{{DATA_PROXIMA_REVISAO}}`, `{{PREFIXO_PROTOCOLO}}`.
- Canais: `{{CANAL_TITULAR_EMAIL}}`, `{{CANAL_TITULAR_FORMULARIO}}`, `{{CANAL_SUPORTE_OPERADORA}}`, `{{SLA_OPERADORA}}`, `{{PRAZO_INTERNO_DIAS}}`.
- Retenção: `{{PRAZO_POS_CONTRATO_CADASTRO}}`, `{{PRAZO_OBRA_TRABALHISTA}}`, `{{PRAZO_FISCAL}}`, `{{PRAZO_LAUDOS}}`, `{{PRAZO_CHAMADO}}`, `{{PRAZO_LOGS}}`, `{{PRAZO_AUTH}}`, `{{PRAZO_BACKUP}}`, `{{RETENCAO_REGISTRO_PEDIDOS}}`.
- Subprocessadores: `{{RESEND_ATIVO_SIM_NAO}}`.
- Automatização: `{{DECLARAR_SE_HA_DECISAO_AUTOMATIZADA}}`, `{{DESCREVER_TRATAMENTO_AUTOMATIZADO}}`.

**Decisões do jurídico**

1. **Validar cada prazo** de retenção à luz da legislação fiscal, trabalhista e urbanística/edilícia aplicável ao setor do controlador — os valores sugeridos (ex.: 5 anos) são referência, não regra fechada.
2. **Confirmar a inexistência (ou existência) de decisão automatizada** relevante (art. 20) e preencher a seção 6.
3. **Definir o SLA interno** de resposta e o SLA de apoio da operadora, coerentes com o prazo legal de 15 dias (art. 19, II).
4. **Confirmar subprocessadores ativos** (especialmente Resend) e a lista para o direito de informação sobre compartilhamento (art. 18, VII).
5. **Decidir a técnica-padrão por categoria** (eliminar × anonimizar × bloquear), sobretudo para registros operacionais que precisam sobreviver à saída de um titular.
6. **Alinhar com o contrato/DPA ConstruData** a cláusula de eliminação/devolução ao término (art. 15, parágrafo único).
7. **Registrar a dependência de roadmap:** enquanto export/exclusão/anonimização **por titular** não existirem na plataforma, formalizar o procedimento **manual** e seu responsável.
8. **Verificar a operação de eliminação em backups** (`{{PRAZO_BACKUP}}`) e comunicá-la de forma transparente ao titular quando houver defasagem entre produção e backup.

