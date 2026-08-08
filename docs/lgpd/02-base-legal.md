# Bases Legais do Tratamento — {{NOME_FANTASIA}} (ConstruData)

_Rascunho-modelo, não parecer jurídico definitivo. Serve de base para o jurídico do controlador adaptar à sua operação antes de publicar/assinar._

> **Template — revisar com o jurídico.** Este documento mapeia **finalidade × base legal (LGPD, Lei 13.709/2018)** para o tratamento de dados pessoais na plataforma ConstruData. Todos os campos entre `{{CHAVES}}` são placeholders e devem ser preenchidos pelo controlador. As bases legais e o teste de legítimo interesse aqui indicados são **sugestões técnicas** que precisam ser validadas caso a caso pelo encarregado (DPO) e pelo jurídico. Não publique com placeholders em aberto.

| Metadado | Valor |
|---|---|
| **Documento** | Bases Legais do Tratamento |
| **Versão** | {{VERSAO}} |
| **Vigência** | {{DATA_VIGENCIA}} |
| **Responsável** | {{DPO_NOME}} ({{DPO_EMAIL}}) |
| **Aplica-se a** | Tratamentos realizados na plataforma ConstruData |
| **Classificação** | Interno / anexo ao contrato |

---

## 1. Objetivo e escopo

Este documento registra **por que** cada categoria de dado pessoal é tratada na ConstruData e **em qual base legal** o tratamento se apoia (art. 7º e art. 11 da LGPD). É insumo direto do **Registro das Operações de Tratamento — ROPA** (art. 37) e, quando aplicável, do **Relatório de Impacto — RIPD** (art. 38).

A regra de ouro do produto: **as bases legais aplicáveis são, prioritariamente, execução de contrato, cumprimento de obrigação legal/regulatória e legítimo interesse.** **Consentimento é exceção** e fica reservado a casos residuais (marketing/comunicação opcional). Isso reflete a natureza do produto: a ConstruData é ferramenta de trabalho contratada por uma organização, não um serviço voltado ao consumidor final.

**Fora do escopo:** cookies/rastreamento de marketing, tratamento de dados sensíveis como regra e dados de crianças/adolescentes — a plataforma **não trata dado sensível (art. 5º, II) como regra de operação** e não é destinada a crianças (ver §6).

## 2. Papéis: controlador e operador (art. 5º, VI e VII)

- **Controlador — o CLIENTE** (construtora, condomínio, administradora, incorporadora): define finalidades e meios, escolhe as bases legais deste documento, atende os titulares e é o ponto de contato perante a ANPD.
- **Operadora — {{RAZAO_SOCIAL}}** (ConstruData): trata dados pessoais **em nome do controlador**, seguindo suas instruções e o contrato/DPA. Não usa os dados do controlador para finalidades próprias, exceto as estritamente técnicas de operação e segurança da plataforma descritas aqui.
- **Isolamento entre clientes:** cada organização é um _tenant_ logicamente isolado (RLS por `organization_id`); um controlador **não** acessa dados de outro. A definição dos papéis está detalhada em `01-papeis-e-arquitetura.md` (companion).

> Referência de arquitetura real: SaaS multi-tenant em **React + Supabase (Postgres/Auth/Storage)**, hospedagem **Vercel**; isolamento por **RLS (`organization_id`)**, autenticação com **MFA**, **TLS** em trânsito, **criptografia em repouso**, **`audit_log`**, princípio do **menor privilégio** e **backups gerenciados**.

## 3. Princípio geral: a regra são bases não-consentimento

| Base legal (LGPD) | Papel no produto | Onde se aplica |
|---|---|---|
| **Execução de contrato** (art. 7º, V) | **Regra principal.** Prestar o serviço contratado ao controlador e aos seus usuários. | Contas de membros, registros operacionais (RDO, OS, laudos, medições), e-mail transacional. |
| **Obrigação legal/regulatória** (art. 7º, II) | Regra quando a lei/norma técnica exige o registro. | Laudos/AVCB obrigatórios, guarda de documentos fiscais (fotos de boletos/NF no Financeiro). |
| **Legítimo interesse** (art. 7º, IX + art. 10) | Regra para segurança, prevenção a fraude e gestão do edificado, sempre com **teste de proporcionalidade** (§5). | Isolamento multi-tenant, MFA, `audit_log`, chamados via QR público. |
| **Consentimento** (art. 7º, I) | **Exceção.** Só quando não há outra base e o tratamento é genuinamente opcional. | Comunicações de marketing / newsletter (opt-in). |

**Por que não consentimento como regra?** Em relação de trabalho e prestação de serviço, o consentimento tende a não ser livre nem inequívoco (art. 5º, XII); usá-lo como base para o operacional criaria expectativa falsa de que o titular pode "recusar" o registro de um RDO ou de um laudo obrigatório. O correto é apoiar o operacional nas bases dos incisos II, V e IX, reservando o consentimento ao que é de fato dispensável.

## 4. Mapa: finalidade × base legal

> Dados **mínimos** por finalidade — a plataforma coleta o necessário para a função, sem campos supérfluos (princípio da necessidade, art. 6º, III).

| # | Finalidade | Dados pessoais (mínimos) | Base legal | Observações |
|---|---|---|---|---|
| 1 | **Criar e manter contas de membros** da organização | Nome, e-mail, papel/perfil | Execução de contrato (art. 7º, V) | Titular = usuário indicado pelo próprio controlador. |
| 2 | **Autenticar e proteger o acesso** (login, MFA, sessão) | E-mail, credenciais/segundo fator, metadados de sessão | Legítimo interesse — segurança (art. 7º, IX) + execução de contrato (art. 7º, V) | Ver LIA §5.1. |
| 3 | **Isolar dados entre organizações** (RLS multi-tenant) | `organization_id` vinculado ao titular | Legítimo interesse — segurança e prevenção a fraude (art. 7º, IX) | Ver LIA §5.1. |
| 4 | **Registrar operações e trilha de auditoria** (`audit_log`) | Autor da ação, timestamp, evento | Legítimo interesse — segurança (art. 7º, IX); onde há dever legal de guarda, art. 7º, II | Ver LIA §5.1. |
| 5 | **Registros operacionais de obra** (RDO, OS, medições) | Nome/identificação do autor do registro | Execução de contrato (art. 7º, V) | Autoria é parte da função do registro. |
| 6 | **Laudos e documentos técnicos obrigatórios** (ex.: AVCB, laudos de manutenção) | Autor/responsável técnico, dados do documento | **Obrigação legal/regulatória (art. 7º, II)** como base primária; legítimo interesse (art. 7º, IX) para gestão/histórico que exceda o mínimo legal | Ver LIA §5.3. |
| 7 | **Cadastro e relacionamento com fornecedores/prestadores/beneficiários** | Nome, contato, dados de pagamento | Execução de contrato (art. 7º, V) | Titular normalmente é PJ/representante. |
| 8 | **Guarda de comprovantes financeiros** (fotos de boletos/NF no Financeiro) | Dados constantes do documento fiscal | Obrigação legal — guarda fiscal/contábil (art. 7º, II) + execução de contrato (art. 7º, V) | Retenção conforme prazo legal aplicável. |
| 9 | **Chamados de moradores via QR público** (`/chamado/:slug`) | Descrição/local; **nome e contato OPCIONAIS** | Legítimo interesse — gestão do edificado (art. 7º, IX) | Campos de contato opcionais; grava em _staging_ via RPC `SECURITY DEFINER`; anti-spam por honeypot + rate-limit. Ver LIA §5.2. |
| 10 | **E-mail transacional** (confirmações, notificações do serviço) | E-mail, conteúdo da notificação | Execução de contrato (art. 7º, V) | Subprocessador Resend (quando ativado). Não é marketing. |
| 11 | **Backups e continuidade** | Cópia dos dados acima | Legítimo interesse — segurança/continuidade (art. 7º, IX); guarda legal onde aplicável (art. 7º, II) | Backups gerenciados; retenção definida em política própria. |
| 12 | **Comunicações de marketing / novidades** | Nome, e-mail | **Consentimento (art. 7º, I)** | **Exceção.** Opt-in registrado e revogável a qualquer tempo (art. 8º, §5). |

> **Dados de acesso público / atividade profissional:** parte dos dados de fornecedores e responsáveis técnicos é de natureza profissional e/ou já pública (ex.: registro em conselho, CNPJ). Isso reforça as bases dos incisos II/V/IX e reduz o balanceamento contra o titular, mas **não dispensa** a análise (art. 7º, §§3º e 4º).

## 5. Teste de proporcionalidade do legítimo interesse (LIA — art. 7º, IX e art. 10)

Sempre que a base for **legítimo interesse**, o controlador deve documentar as quatro etapas abaixo. Os testes a seguir são **modelos preenchidos com a realidade do produto** — revisar e ajustar.

### 5.1 Caso A — Segurança e isolamento multi-tenant (finalidades 2, 3, 4)

- **Finalidade (interesse legítimo):** proteger o acesso, isolar dados entre organizações, prevenir fraude e acesso indevido, e manter trilha de auditoria — condição para a própria prestação segura do serviço.
- **Necessidade:** os dados usados são mínimos (identificador do usuário, `organization_id`, metadados de sessão, autor/timestamp no `audit_log`). Não há meio menos invasivo de garantir isolamento e rastreabilidade em um SaaS multi-tenant.
- **Balanceamento (expectativa do titular):** o usuário que acessa uma ferramenta corporativa **espera** controles de segurança, MFA e registro de quem fez o quê. O impacto é baixo e alinhado à expectativa; prevalece o interesse legítimo.
- **Salvaguardas:** RLS por `organization_id`, MFA, TLS em trânsito, criptografia em repouso, menor privilégio, `audit_log`, backups gerenciados; acesso da operadora limitado ao suporte/manutenção mediante contrato.

### 5.2 Caso B — Gestão do edificado e chamados via QR público (finalidade 9)

- **Finalidade (interesse legítimo):** permitir que ocupantes/visitantes de um edifício abram um chamado de manutenção/ocorrência ao síndico/zelador sem barreira de cadastro, viabilizando a gestão predial.
- **Necessidade:** coleta-se o mínimo — descrição e local; **nome e contato são OPCIONAIS** e servem apenas para retorno ao solicitante. Rota anônima `/chamado/:slug` grava em tabela de _staging_ via RPC `SECURITY DEFINER` que resolve a organização pelo `slug`; **sem login**.
- **Balanceamento:** quem escaneia um QR afixado no prédio para reportar um problema **espera** que o chamado chegue à administração; fornecer contato é opcional e sob controle do solicitante. Impacto baixo.
- **Salvaguardas:** contato opcional; **anti-spam por honeypot + rate-limit**; gravação isolada por organização (`slug`); dados de _staging_ com retenção curta e triagem antes de virar registro operacional. Não se coletam dados sensíveis.

### 5.3 Caso C — Laudos e documentos obrigatórios (finalidade 6)

- **Base primária = obrigação legal/regulatória (art. 7º, II).** Quando norma técnica ou lei exige o laudo (ex.: **AVCB**, laudos de manutenção periódica), o tratamento do dado do responsável técnico é imposto pela própria obrigação — **não depende de LIA**.
- **LIA só para o excedente:** onde a plataforma vai **além** do mínimo legal (manter histórico, gestão preventiva, indicadores de manutenção), aplica-se legítimo interesse (art. 7º, IX):
  - **Finalidade:** manter memória técnica e planejar manutenção do edificado.
  - **Necessidade:** guardar autor/responsável, data e conteúdo do laudo — dados que já constam do documento obrigatório.
  - **Balanceamento:** o responsável técnico espera que seu laudo fique registrado e vinculado ao ativo; impacto baixo, dado profissional.
  - **Salvaguardas:** acesso restrito por organização (RLS), trilha de auditoria e retenção conforme prazo legal/técnico aplicável.

## 6. Dados sensíveis e de crianças/adolescentes

- **Sensíveis (art. 11):** a plataforma **não trata dado sensível como regra**. Se um cliente inserir dado sensível em campo livre (ex.: descrição de chamado), isso é uso fora do desenho do produto; o controlador deve orientar seus usuários a **não** inseri-los. Caso um fluxo sensível se torne necessário, **exige base própria do art. 11** e revisão deste documento.
- **Crianças e adolescentes (art. 14):** o produto não é destinado a crianças e não coleta dados dessa população intencionalmente. Chamados via QR podem, em tese, ser abertos por qualquer pessoa — por isso o contato é opcional e o mínimo é coletado.

## 7. Retenção e término do tratamento (arts. 15 e 16)

O tratamento termina quando a finalidade se exaure, quando o controlador solicita ou ao fim do contrato, ressalvada a **guarda para cumprir obrigação legal** (ex.: documentos fiscais/laudos) e a defesa de direitos (art. 16). Os prazos de retenção por finalidade devem ser definidos pelo controlador em política própria — ver `{{DOC_RETENCAO}}`.

## 8. Direitos do titular e base legal

A base legal escolhida determina os direitos aplicáveis (ex.: revogação vale para consentimento; oposição vale para legítimo interesse — art. 18). Os pedidos são atendidos **pelo controlador**, com apoio da plataforma:

- **Já disponível:** exportação de dados **por organização**.
- **Roadmap (ainda não automatizado):** exportação, exclusão e anonimização **por titular** individual. Enquanto não houver ferramenta dedicada, esses pedidos são atendidos por procedimento operacional entre controlador e operadora.

## 9. Subprocessadores

| Subprocessador | Função | Relação com as bases |
|---|---|---|
| **Supabase** | Banco de dados, autenticação, storage | Suporta finalidades 1–11 |
| **Vercel** | Hospedagem da aplicação | Suporta a entrega do serviço |
| **Resend** | E-mail transacional (quando ativado) | Finalidade 10 |

A lista completa e atualizada de subprocessadores consta em `{{DOC_SUBPROCESSADORES}}` e no DPA.

## 10. Revisão

Este mapa deve ser revisado a cada novo fluxo de dados, mudança de finalidade, novo subprocessador ou orientação da ANPD, e **no mínimo** a cada {{PERIODICIDADE_REVISAO}}.

---

## Lacunas a preencher

**Placeholders a substituir:**
- `{{NOME_FANTASIA}}` — nome comercial da plataforma (padrão: ConstruData).
- `{{RAZAO_SOCIAL}}` — razão social da operadora/fornecedor.
- `{{CNPJ}}`, `{{ENDERECO}}`, `{{SITE}}` — dados cadastrais do fornecedor.
- `{{DPO_NOME}}`, `{{DPO_EMAIL}}` — encarregado (DPO) responsável por este documento.
- `{{VERSAO}}`, `{{DATA_VIGENCIA}}` — controle de versão e vigência.
- `{{PERIODICIDADE_REVISAO}}` — ex.: 12 meses.
- `{{DOC_RETENCAO}}`, `{{DOC_SUBPROCESSADORES}}` — referências aos documentos correlatos.

**Decisões que o jurídico/DPO precisa tomar:**
1. **Confirmar a base legal de cada linha do §4**, especialmente as de legítimo interesse (finalidades 2, 3, 4, 9 e o excedente da 6) — o LIA é responsabilidade do controlador.
2. **Definir prazos de retenção por finalidade** (arts. 15–16), incluindo guarda fiscal (finalidade 8) e laudos (finalidade 6).
3. **Validar o tratamento de fornecedores/beneficiários** quando o titular for pessoa física (finalidades 7 e 8) — confirmar dados mínimos e se há dado sensível envolvido.
4. **Política do QR público** (finalidade 9): retenção da tabela de _staging_, triagem, e texto de aviso ao solicitante sobre o caráter opcional do contato.
5. **Consentimento de marketing** (finalidade 12): definir mecanismo de opt-in/opt-out, registro da prova e canal de revogação (art. 8º).
6. **Orientar usuários a não inserir dados sensíveis** em campos livres (chamados, RDO, laudos) e decidir tratamento caso algum fluxo sensível se torne necessário (art. 11).
7. **Confirmar a lista de subprocessadores** e a ativação (ou não) do Resend.
8. **Alinhar com o DPA/contrato** as instruções da operadora e o procedimento para atender direitos por titular enquanto a automação está no roadmap.

