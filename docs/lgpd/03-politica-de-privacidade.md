# Política de Privacidade — {{RAZAO_SOCIAL}}

*Rascunho-modelo. Este documento é um **template** de referência, não constitui aconselhamento jurídico definitivo e deve ser revisado e adaptado pelo jurídico da sua organização antes de ser publicado.*

> **Template — revisar com o jurídico.** Este é um modelo genérico para a organização **Controladora** publicar aos seus titulares. Preencha todos os campos entre chaves duplas `{{ }}`, confirme as bases legais, os prazos de retenção e a lista de subprocessadores em vigor no seu contrato, e valide a redação com o encarregado (DPO) e o departamento jurídico. Trechos em *itálico* entre colchetes são orientações internas e **devem ser removidos** antes da publicação. Ao longo do texto, `{{RAZAO_SOCIAL}}` refere-se à **organização que publica esta política — o Controlador dos dados** (ex.: a construtora, o condomínio ou a administradora). A **ConstruData** é a plataforma que a organização utiliza, na condição de **operadora**.

| Campo | Valor |
|---|---|
| **Documento** | Política de Privacidade |
| **Versão** | {{VERSAO}} |
| **Vigência (a partir de)** | {{DATA_VIGENCIA}} |
| **Responsável pela publicação** | {{RESPONSAVEL_APROVACAO}} (aprovação jurídica) |
| **Encarregado (DPO)** | {{DPO_NOME}} — {{DPO_EMAIL}} |
| **Última revisão** | {{DATA_ULTIMA_REVISAO}} |

---

## 1. Quem somos e papéis (Controlador e Operador)

Esta Política de Privacidade descreve como a **{{RAZAO_SOCIAL}}**, inscrita no CNPJ sob o nº **{{CNPJ}}**, com sede em **{{ENDERECO}}** ("nós", "Controlador"), trata dados pessoais no contexto do uso da plataforma **ConstruData**, em conformidade com a Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD).

Para prestar seus serviços (gestão de obras e/ou gestão predial e condominial), a {{RAZAO_SOCIAL}} utiliza a **ConstruData**, uma plataforma de software (SaaS) fornecida por **{{FORNECEDOR_RAZAO_SOCIAL}}**, CNPJ **{{FORNECEDOR_CNPJ}}**.

- **Controlador** (art. 5º, VI, da LGPD): é a **{{RAZAO_SOCIAL}}**. Cabe a nós decidir sobre o tratamento dos dados pessoais — quais dados, para quê e por quanto tempo. As decisões e as respostas aos titulares são de nossa responsabilidade.
- **Operador** (art. 5º, VII, da LGPD): é a **{{FORNECEDOR_RAZAO_SOCIAL}}** (ConstruData), que trata os dados **em nosso nome e segundo nossas instruções**, nos limites do contrato firmado entre as partes (art. 39). A ConstruData não usa esses dados para finalidades próprias.

A ConstruData é uma plataforma **multi-tenant**: cada organização cliente opera em um ambiente logicamente isolado. Os dados da {{RAZAO_SOCIAL}} **não são compartilhados com outras organizações clientes** da ConstruData — o isolamento é aplicado por controle de acesso no banco de dados (Row-Level Security, por `organization_id`).

*[Orientação interna: se a mesma organização atua como controladora em obras próprias e como operadora de terceiros — ex.: administradora que gere condomínios de clientes — descreva os dois papéis aqui e mantenha coerência com os contratos.]*

---

## 2. Quais dados pessoais coletamos

Adotamos o princípio da **necessidade** (art. 6º, III): coletamos apenas os **dados mínimos** necessários a cada finalidade. Em regra, **não tratamos dados pessoais sensíveis** (art. 5º, II; art. 11) como parte do funcionamento da plataforma. *[Orientação interna: se houver qualquer exceção — ex.: dado de saúde em laudo, biometria em controle de acesso —, descreva-a expressamente aqui e reavalie a base legal.]*

Os dados variam conforme a **categoria de titular**:

### 2.1. Membros e usuários da organização
Pessoas com acesso à plataforma (equipe própria, prestadores, síndico, zelador, engenheiros, gestores).
- **Dados:** nome, e-mail, papel/perfil de acesso (*role*), organização a que pertence, registros de autenticação e de auditoria (data/hora de acesso e de ações relevantes).
- **Observação:** o acesso é protegido por autenticação com **múltiplo fator (MFA)** e regido pelo princípio do **menor privilégio** (cada perfil enxerga apenas o necessário).

### 2.2. Autores de registros operacionais
Pessoas que criam ou assinam registros na plataforma — como Relatórios Diários de Obra (RDO), Ordens de Serviço (OS), laudos, medições e checklists.
- **Dados:** nome e/ou identificação do autor associada ao registro, data/hora e conteúdo do registro. Eventuais fotos e evidências anexadas ao registro podem, incidentalmente, conter imagens de pessoas presentes na obra ou no edifício.

### 2.3. Fornecedores, prestadores e beneficiários
Contatos de terceiros com quem a organização se relaciona.
- **Dados:** nome, contato (telefone/e-mail), e dados constantes de documentos financeiros anexados (por exemplo, **fotos de boletos** no módulo Financeiro), que podem conter nome, CPF/CNPJ e dados bancários do beneficiário.

### 2.4. Solicitantes de chamado via QR público *(quando o recurso está ativo)*
No módulo **Predial**, a organização pode disponibilizar um QR Code / link público para que moradores ou usuários do edifício abram chamados **sem login** (rota anônima do tipo `/chamado/{{SLUG_DA_ORGANIZACAO}}`).
- **Dados:** descrição e local do chamado; **nome e contato do solicitante são opcionais** — o chamado pode ser aberto sem identificação.
- **Como funciona:** o registro é gravado em uma área de triagem (*staging*) e vinculado à organização correta a partir do identificador (*slug*) do link. Há proteção **anti-spam** (campo-armadilha/*honeypot* e limitação de frequência de envio).
- *[Orientação interna: confirme se este canal está ativo na sua organização. Se não estiver, remova esta seção. Se estiver, avalie exibir um aviso curto de privacidade na própria tela de abertura do chamado.]*

Também podemos tratar dados que você nos fornece diretamente ao entrar em contato pelos canais indicados nesta Política (ex.: para exercer direitos), e dados de telemetria mínima (ver **Seção 10**).

---

## 3. Para que usamos os dados e com qual base legal

Como regra, o tratamento **não depende de consentimento**: ele se apoia em bases legais que autorizam o uso dos dados para operar o serviço e cumprir obrigações. As bases aplicáveis (art. 7º da LGPD) são:

| Finalidade | Base legal (LGPD) |
|---|---|
| Prestar o serviço contratado, dar acesso à plataforma, executar a gestão de obras e/ou predial, processar registros (RDO, OS, medições, laudos) | **Execução de contrato** e procedimentos preliminares (art. 7º, V) |
| Cumprir obrigações legais e regulatórias — por exemplo, elaboração e guarda de **laudos técnicos e AVCB** obrigatórios, guarda de documentos por prazos legais | **Cumprimento de obrigação legal/regulatória** (art. 7º, II) |
| Segurança da informação, prevenção a fraude, registro de auditoria, gestão do edificado e da operação | **Legítimo interesse** (art. 7º, IX), mediante teste de proporcionalidade e salvaguarda dos direitos do titular |
| Abertura e triagem de chamados via QR público (quando ativo) | **Legítimo interesse** (art. 7º, IX) na gestão do edificado / **execução de contrato** (art. 7º, V) com o titular, conforme o caso |
| Comunicações de marketing e novidades (quando houver) | **Consentimento** (art. 7º, I) — residual, revogável a qualquer momento |

Quando nos apoiamos no **legítimo interesse** (art. 7º, IX; art. 10), limitamo-nos ao estritamente necessário para a finalidade e mantemos avaliação da proporcionalidade, considerando as legítimas expectativas do titular. Você pode nos solicitar informações sobre esse tratamento pelos canais da **Seção 11**.

Não utilizamos os dados para decisões automatizadas com efeitos jurídicos sobre os titulares. *[Orientação interna: confirme. Se houver perfilamento ou automação relevante, descreva e informe o direito de revisão — art. 20.]*

---

## 4. Com quem compartilhamos os dados

Não comercializamos dados pessoais. O compartilhamento se restringe ao necessário para operar o serviço e cumprir a lei:

- **{{FORNECEDOR_RAZAO_SOCIAL}} (ConstruData)** — operadora da plataforma, que trata os dados em nosso nome (art. 39).
- **Subprocessadores** contratados pela ConstruData para viabilizar a operação (art. 39), sujeitos a obrigações contratuais de proteção de dados:

  | Subprocessador | Função | Observação |
  |---|---|---|
  | **Supabase** | Banco de dados, autenticação e armazenamento de arquivos | Criptografia em repouso; isolamento por organização |
  | **Vercel** | Hospedagem da aplicação | Tráfego protegido por TLS |
  | **Resend** | Envio de e-mails transacionais | *Apenas quando o recurso está ativado* |

- **Autoridades públicas**, quando houver requisição legal, ordem judicial ou obrigação regulatória.
- **Terceiros em operações societárias** (ex.: reorganização, fusão ou aquisição), com preservação das obrigações desta Política. *[Orientação interna: incluir apenas se aplicável ao seu caso.]*

*[Orientação interna: mantenha esta lista de subprocessadores sincronizada com a que consta no seu contrato / DPA com a ConstruData. Ferramentas adicionais que a sua organização conecte por conta própria devem ser acrescentadas aqui.]*

---

## 5. Transferência internacional de dados

Alguns subprocessadores podem tratar ou armazenar dados em servidores localizados **fora do Brasil**. Nesses casos, a transferência observa as hipóteses e salvaguardas dos arts. 33 a 36 da LGPD.

*[Orientação interna: confirme a região de hospedagem efetivamente contratada dos provedores (Supabase/Vercel/Resend). Se os dados residirem no Brasil, ajuste ou remova esta seção. Se houver transferência internacional, indique o país/região de destino ({{REGIAO_HOSPEDAGEM}}) e a base da transferência — ex.: cláusulas contratuais/garantias adequadas — quando definido pela ANPD.]*

---

## 6. Por quanto tempo guardamos os dados (retenção)

Mantemos os dados pessoais apenas pelo tempo necessário às finalidades desta Política, observados os prazos legais e regulatórios aplicáveis (art. 15 e art. 16 da LGPD). Como referência:

| Categoria | Critério / prazo de retenção |
|---|---|
| Dados de membros e usuários | Enquanto durar o vínculo/acesso, mais o período necessário a obrigações legais |
| Registros operacionais (RDO, OS, medições, laudos) | Pelo prazo exigido pela legislação e pela boa gestão da obra/edifício — {{PRAZO_RETENCAO_REGISTROS}} |
| Documentos financeiros (ex.: boletos) | Pelos prazos fiscais e contábeis aplicáveis — {{PRAZO_RETENCAO_FINANCEIRO}} |
| Chamados via QR público | {{PRAZO_RETENCAO_CHAMADOS}} após o encerramento do chamado |
| Registros de auditoria e segurança | {{PRAZO_RETENCAO_AUDITORIA}} |

Encerrado o prazo ou a finalidade, os dados são **eliminados** ou **anonimizados**, salvo as hipóteses de guarda autorizadas em lei (art. 16). *[Orientação interna: preencha os prazos concretos com o jurídico e o contábil; não publique valores em branco.]*

---

## 7. Direitos do titular e como exercê-los

Nos termos do art. 18 da LGPD, você tem direito a, mediante requisição:

- **Confirmação** da existência de tratamento e **acesso** aos dados;
- **Correção** de dados incompletos, inexatos ou desatualizados;
- **Anonimização, bloqueio ou eliminação** de dados desnecessários, excessivos ou tratados em desconformidade;
- **Portabilidade** a outro fornecedor, mediante requisição expressa;
- **Eliminação** dos dados tratados com base no consentimento;
- **Informação** sobre as entidades com as quais compartilhamos dados;
- **Informação** sobre a possibilidade de não consentir e as consequências;
- **Revogação do consentimento**, quando esta for a base do tratamento.

**Como exercer:** envie sua solicitação para **{{DPO_EMAIL}}** ou pelo canal **{{CANAL_TITULAR}}**. Poderemos solicitar informações para confirmar sua identidade, como medida de segurança. Responderemos nos prazos da LGPD e da regulamentação da ANPD.

Como Controlador, é a **{{RAZAO_SOCIAL}}** quem atende às suas solicitações. A plataforma ConstruData nos dá apoio operacional para isso.

> *[Orientação interna — nota de transparência sobre capacidades atuais da plataforma: a ConstruData já oferece **exportação de dados por organização**. Recursos de **exportação, exclusão e anonimização por titular individual** estão em desenvolvimento (roadmap); até sua disponibilização, essas solicitações podem ser atendidas por processo operacional/manual conduzido pela nossa equipe com apoio do fornecedor. Não prometa ao titular funcionalidades que ainda não existem — descreva o processo real de atendimento.]*

---

## 8. Segurança da informação

Adotamos medidas técnicas e administrativas para proteger os dados (art. 46 a 49 da LGPD), entre elas:

- **Isolamento por organização** no banco de dados (Row-Level Security por `organization_id`);
- **Autenticação com múltiplo fator (MFA)** e **princípio do menor privilégio** por perfil de acesso;
- **Criptografia em trânsito (TLS)** e **criptografia em repouso**;
- **Registro de auditoria** (*audit log*) de acessos e ações relevantes;
- **Backups gerenciados** pela infraestrutura;
- Proteção **anti-spam** no canal público de chamados (*honeypot* e limitação de frequência).

Nenhum sistema é totalmente imune a incidentes. Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, adotaremos as providências cabíveis e faremos as comunicações exigidas à ANPD e aos titulares (art. 48). *[Orientação interna: alinhe o fluxo de notificação de incidentes com o operador — quem detecta, quem comunica, em que prazo.]*

---

## 9. Cookies e telemetria mínima

A plataforma utiliza cookies e tecnologias equivalentes **estritamente necessários** ao funcionamento (por exemplo, para manter a sessão autenticada) e telemetria **mínima** para operação, segurança e estabilidade do serviço. *[Orientação interna: se a sua organização adotar cookies de analytics/marketing, descreva-os aqui e implemente mecanismo de gestão de preferências e a base legal correspondente.]*

---

## 10. Encarregado pelo Tratamento de Dados (DPO)

O canal de comunicação com o nosso **Encarregado** (DPO), nos termos do art. 41 da LGPD, é:

- **Encarregado:** {{DPO_NOME}}
- **E-mail:** {{DPO_EMAIL}}
- **Endereço:** {{ENDERECO}}
- **Site:** {{SITE}}

Você também pode contatar a **Autoridade Nacional de Proteção de Dados (ANPD)** por meio dos canais oficiais (`gov.br/anpd`).

---

## 11. Alterações desta Política

Podemos atualizar esta Política para refletir mudanças legais, regulatórias ou operacionais. A versão vigente é sempre a publicada em **{{SITE}}**, com indicação da data de vigência no topo. Alterações relevantes serão comunicadas pelos meios adequados. Recomendamos a revisão periódica deste documento.

**Vigência a partir de:** {{DATA_VIGENCIA}} — **Versão {{VERSAO}}**.

---

## Lacunas a preencher

**Placeholders a substituir**
- `{{RAZAO_SOCIAL}}`, `{{CNPJ}}`, `{{ENDERECO}}` — identificação do **Controlador** (a organização que publica esta política).
- `{{FORNECEDOR_RAZAO_SOCIAL}}`, `{{FORNECEDOR_CNPJ}}` — identificação da **operadora** (fornecedora da ConstruData).
- `{{DPO_NOME}}`, `{{DPO_EMAIL}}` — encarregado (DPO).
- `{{SITE}}`, `{{CANAL_TITULAR}}` — canais de contato e de exercício de direitos.
- `{{VERSAO}}`, `{{DATA_VIGENCIA}}`, `{{DATA_ULTIMA_REVISAO}}`, `{{RESPONSAVEL_APROVACAO}}` — controle de versão e aprovação.
- `{{SLUG_DA_ORGANIZACAO}}` — identificador do link público de chamados (se o recurso estiver ativo).
- `{{REGIAO_HOSPEDAGEM}}` — região de hospedagem dos subprocessadores (Seção 5).
- `{{PRAZO_RETENCAO_REGISTROS}}`, `{{PRAZO_RETENCAO_FINANCEIRO}}`, `{{PRAZO_RETENCAO_CHAMADOS}}`, `{{PRAZO_RETENCAO_AUDITORIA}}` — prazos concretos de retenção (Seção 6).

**Decisões que o jurídico precisa tomar**
1. **Papel da organização:** confirmar se atua apenas como Controlador ou também como Operador de terceiros; ajustar a Seção 1 conforme os contratos.
2. **Canal QR público (Seção 2.4):** confirmar se está ativo; se sim, avaliar aviso de privacidade na tela de abertura do chamado; se não, remover a seção.
3. **Bases legais (Seção 3):** validar o enquadramento por finalidade, especialmente o **legítimo interesse** (documentar o teste de proporcionalidade) e confirmar se há tratamento com base em consentimento (marketing).
4. **Dados sensíveis (Seção 2):** confirmar que não há tratamento de dados sensíveis; se houver exceção (ex.: dado de saúde em laudo), descrever e reavaliar base legal (art. 11).
5. **Transferência internacional (Seção 5):** confirmar a região efetiva de hospedagem e a base/salvaguarda da transferência (arts. 33–36).
6. **Retenção (Seção 6):** definir prazos concretos com apoio contábil/fiscal e regulatório; não publicar campos em branco.
7. **Direitos por titular (Seção 7):** descrever o processo real de atendimento hoje (exportação por organização existe; export/exclusão/anonimização por titular estão em roadmap) — sem prometer funcionalidade inexistente.
8. **Cookies/telemetria (Seção 9):** confirmar se há cookies de analytics/marketing e, se houver, implementar gestão de preferências e a base legal.
9. **Incidentes (Seção 8):** alinhar com a operadora o fluxo de detecção e comunicação de incidentes (art. 48).
10. **Lista de subprocessadores (Seção 4):** sincronizar com o contrato/DPA vigente e acrescentar ferramentas conectadas pela própria organização.

