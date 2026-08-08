# LGPD — Pacote de Templates ("dados mínimos")

> **Rascunhos-modelo, não aconselhamento jurídico.** Este pacote é um ponto de partida para o **jurídico do cliente** adaptar à sua realidade. Preencha os placeholders `{{MAIUSCULO}}` e confirme as decisões marcadas em **"Lacunas a preencher"** de cada documento antes de publicar/assinar. Em caso de conflito, prevalece o contrato de prestação de serviços / DPA firmado entre as partes.

## Contexto do produto (para os documentos refletirem a realidade)

- **{{NOME_FANTASIA}} = "ConstruData"** — SaaS **multi-tenant** (React + Supabase: Postgres/Auth/Storage; hospedagem Vercel). Isolamento por organização via **RLS** (`organization_id`), **MFA**, TLS em trânsito, criptografia em repouso, `audit_log`, menor privilégio e backups gerenciados.
- Atende **obras** (construção) e **prédios/condomínios** (módulo "Predial": ativos, manutenções, laudos, chamados).
- **Papéis:** o **CLIENTE** (construtora / condomínio / administradora) é o **CONTROLADOR**; **`{{RAZAO_SOCIAL}}`** (fornecedor) é **OPERADOR** — trata dados em nome do controlador, conforme contrato.
- **Base legal (regra, NÃO consentimento):** execução de contrato (art. 7º V) · obrigação legal/regulatória (art. 7º II — ex.: laudos/AVCB) · legítimo interesse (art. 7º IX — segurança, gestão do edificado), com teste de proporcionalidade. Consentimento só residual (marketing).
- **Coletas de dados pessoais (mínimos):** membros da org (nome, e-mail, papel); autores de registros (RDO/OS/laudos/medições); contatos de fornecedores/beneficiários (+ fotos de boletos no Financeiro); e **nome/contato/local do solicitante de chamado pelo QR público** (rota anônima `/chamado/:slug` — contato é opcional).
- **Subprocessadores:** Supabase (banco/auth/storage), Vercel (hospedagem), Resend (e-mail — quando ativado).

## Documentos

| # | Documento | O que cobre |
|---|---|---|
| 01 | [Papéis — Controlador e Operador](01-papeis-controlador-operador.md) | Quem decide × quem executa; obrigações do operador (art. 39); cláusulas mínimas do DPA |
| 02 | [Bases Legais](02-base-legal.md) | Mapa finalidade × base legal; teste de proporcionalidade do legítimo interesse |
| 03 | [Política de Privacidade](03-politica-de-privacidade.md) | Template para o cliente publicar (dados, finalidades, direitos, contato do encarregado) |
| 04 | [ROPA — Registro das Operações](04-ropa-registro-operacoes.md) | Registro por operação (art. 37): titulares, dados, base, retenção, segurança |
| 05 | [Encarregado (DPO)](05-encarregado-dpo.md) | Papel, canal de contato e SLA (art. 41) |
| 06 | [Política de Segurança](06-politica-de-seguranca.md) | Medidas técnicas/organizacionais reais + resposta a incidente (arts. 46–49) |
| 07 | [Direitos do Titular + Retenção](07-direitos-titular-e-retencao.md) | Procedimento de atendimento (art. 18) + prazos de retenção/eliminação (arts. 15–16) |

## Como usar

1. **Preencha os placeholders** comuns a todos: `{{RAZAO_SOCIAL}}`, `{{CNPJ}}`, `{{ENDERECO}}`, `{{DPO_NOME}}`, `{{DPO_EMAIL}}`, `{{SITE}}`, `{{DATA_VIGENCIA}}`, `{{VERSAO}}`.
2. **Resolva as "Lacunas a preencher"** ao final de cada documento (decisões que dependem do jurídico).
3. **Revise com o jurídico** — estes são rascunhos técnicos; a redação final e a adequação ao contrato são responsabilidade do cliente.

> Parte destes controles já tem suporte no produto (isolamento multi-tenant, `audit_log`, export por organização). O atendimento a direitos **por titular** (export/exclusão/anonimização individual) e o aviso de privacidade no formulário público são itens de roadmap (Fase 3B).
