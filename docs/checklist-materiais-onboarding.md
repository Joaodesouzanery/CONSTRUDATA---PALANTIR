# Checklist de Materiais e Prontidão da Plataforma

> **Objetivo:** auditoria honesta de TUDO que você precisa criar (PDFs, vídeos, planilhas, scripts) para virar uma operação de venda + entrega de obras padronizada.
> **Escopo:** o que você listou no brain dump + os gaps que eu identifiquei.
> **Última atualização:** 2026-04-08

---

## 🎯 TL;DR — você listou 4 categorias. Faltam 5 a mais.

| Você listou | Status |
|---|---|
| ✅ **Apresentação 10 slides** (capa, dor, solução, módulos…) | Listado, mas não criado ainda |
| ✅ **Padronização de arquivos do cliente** (5 templates) | Documentado em [processo-padronizacao-materiais.md](./processo-padronizacao-materiais.md), templates ainda não existem |
| ✅ **Onboarding 4 semanas** (Semana 1 a Semana 4) | Documentado em [estrategia-organizacao.md](./estrategia-organizacao.md) seção 7 |
| ✅ **Onboarding por persona** (engenheiro, gerente, etc.) | Documentado, materiais (vídeos/cheat sheets) ainda não criados |

### O que você NÃO listou e precisa (priorizado)

| Categoria | O que falta | Quando precisa |
|---|---|---|
| 🔴 **Comercial obrigatório** | One-pager PDF + Contrato MSA + SLA | **Antes da 1ª venda** |
| 🔴 **Plataforma — features** | Botão "Importar CSV/XLSX" em 5 módulos | **Antes do 1º onboarding** |
| 🟡 **Treinamento** | 6 vídeos (1 por persona) + manual PDF + cheat sheet | **Antes do 1º onboarding** |
| 🟡 **Operação** | 5 templates Excel/CSV físicos no Drive | **Antes do 1º onboarding** |
| 🟢 **Retenção** | Modelo de QBR + NPS + termo de aceite | **Após 30 dias do 1º cliente** |

---

## 1. MATERIAIS DE VENDA (pré-cliente)

> Tudo que vai pro cliente ANTES dele assinar.

### 1.1 Apresentação 10 slides ⚠️

**Sua estrutura (ótima — manter):**

| # | Slide | Status do conteúdo | Ferramenta sugerida |
|---|---|---|---|
| 1 | Capa | ✅ Logo + tagline já estão na landing | Google Slides ou Pitch.com |
| 2 | A dor — "30% do tempo procurando" | ✅ Já está na MethodologySection | — |
| 3 | A consequência (estouros, retrabalho) | ✅ Já está em estrategia-organizacao.md §5.1 | — |
| 4 | A solução — screenshot Torre de Controle | ⚠️ Precisa PRINT da Torre (depois do bug do mapa estar OK) | — |
| 5 | Como funciona — ontologia 4 quadrantes | ⚠️ Precisa criar diagrama (recomendo Excalidraw ou Whimsical) | — |
| 6 | 5 módulos-âncora | ⚠️ Definir os 5 (sugiro: Torre, RDO, FVS, Plan. Mestre, Quantitativos) | — |
| 7 | Metodologia — 4 conceitos | ✅ Já está em MethodologySection.tsx | — |
| 8 | Resultados — 80% / 3-5% / R$200k / 38→72% | ✅ Mesmos números da landing | — |
| 9 | Como começamos — 4 semanas | ✅ Já está em estrategia-organizacao.md §7 | — |
| 10 | Investimento — R$ 8.500 a 12.000 | ✅ Já documentado | — |
| 11 | CTA — agendar piloto | ✅ Calendly link já existe | — |

**Próximo passo:**
1. Criar **template Google Slides** com identidade Atlântico (background `#2c2c2c`, accent `#f97316`, fonte Space Grotesk display + Inter body)
2. Preencher os 11 slides usando o conteúdo já escrito nos docs
3. Salvar como `docs/templates/apresentacao-comercial-v1.pptx` ou exportar PDF

**Tempo estimado:** 4-6h primeira vez, depois 30 min por personalização cliente.

### 1.2 One-pager PDF ❌

Documento de 1 página (frente e verso) que sintetiza tudo. **Único material que cabe no e-mail frio.**

**Estrutura sugerida:**
- **Frente:** logo + tagline + headline grande + 3 KPIs (80%/3-5%/R$200k) + foto/screenshot
- **Verso:** 6 módulos com ícones, 4 conceitos da metodologia, CTA + Calendly + email

**Próximo passo:** criar `docs/templates/one-pager-v1.pdf` (Figma → export PDF).

**Tempo:** 2-3h.

### 1.3 Vídeo demo curto ✅ (acabei de criar — precisa renderizar)

📁 **Já existe** em [`videos/`](../videos/) usando Remotion.

| Vídeo | Onde usar | Como renderizar |
|---|---|---|
| `HeroLoop` (15s, 16:9) | Background do Hero da landing | `cd videos && npm run render:hero` |
| `ProductDemo30s` (30s, 16:9) | Embed na landing, twitter, cold email | `npm run render:demo` |
| `LinkedInTeaser60s` (60s, 9:16) | LinkedIn Reels, Instagram, TikTok | `npm run render:linkedin` |

**Próximo passo (você, hoje):**
1. `cd videos && npm install` (1x só, ~5 min)
2. `npm run render:all` (~5 min)
3. Os 3 MP4 saem em `videos/out/`
4. Para usar no site: copiar `hero-loop.mp4` para `public/videos/`

### 1.4 Vídeo full demo (5 min) ❌

Vídeo de 5 min mostrando uso real da plataforma. **Não programático** — precisa gravar a tela.

**Próximo passo:**
1. Gravar com OBS Studio ou Loom seguindo roteiro abaixo
2. Hospedar no YouTube (unlisted) e linkar do site

**Roteiro de 5 min:**
- 0:00-0:30 — apresentação ("oi, sou João, fundador da Atlântico")
- 0:30-1:30 — abrir landing, mostrar Torre de Controle no celular
- 1:30-2:30 — engenheiro criando RDO
- 2:30-3:30 — qualidade preenchendo FVS, exportando PDF
- 3:30-4:30 — diretor abrindo Gestão 360 e vendo CPI/SPI
- 4:30-5:00 — call to action

**Tempo:** 1 dia (gravar + editar simples).

### 1.5 Hub de Notícias / Newsletter ❌

Já citado em [estrategia-organizacao.md](./estrategia-organizacao.md) §3 (HuB de Notícias). Falta:

- Template de newsletter (Substack ou Mailchimp)
- Lista inicial de inscritos
- Cadência (1x semana, manhã de quinta)

---

## 2. TEMPLATES ATLÂNTICO (para popular plataforma)

> Os 5 templates que você vai entregar ao cliente para ele preencher (ou que você preenche junto com ele).

### Status atual de cada template + estado da plataforma para receber

| Template | Plataforma pronta? | O que falta | Prioridade |
|---|---|---|---|
| **`orcamento.xlsx`** → Quantitativos | 🟡 Wizard "Criar do Zero" pronto, **importação manual** | Botão `+ Importar XLSX` no QuantHeader | 🔴 ALTA |
| **`cronograma.xlsx`** → Plan. Mestre | 🟡 Wizard "Criar do Zero" pronto, **importação manual** | Botão `+ Importar XLSX` no PlanMestreHeader | 🔴 ALTA |
| **`obras.csv`** → Torre de Controle | ⚠️ Só tem `+ Nova Obra` manual | Botão `+ Importar CSV` no Torre | 🟡 MÉDIA |
| **`trabalhadores.csv`** → Mão de Obra | ⚠️ Não verificado — precisa auditoria do módulo | Botão `+ Importar CSV` em Mão de Obra | 🟡 MÉDIA |
| **`fornecedores.csv`** → Suprimentos | ⚠️ Não verificado | Botão `+ Importar CSV` em Suprimentos | 🟡 MÉDIA |
| **`fvs/`** PDFs FOR-FVS-02 → Qualidade | ✅ FVS digital pronta (criação manual) | OCR de PDFs antigos (v2) | 🟢 BAIXA |

### Templates físicos que precisam existir no Drive

| Arquivo | Onde criar | Status |
|---|---|---|
| `templates-cliente/01-orcamento-template.xlsx` | Google Drive | ❌ |
| `templates-cliente/02-cronograma-template.xlsx` | Google Drive | ❌ |
| `templates-cliente/03-obras-template.csv` | Google Drive | ❌ |
| `templates-cliente/04-trabalhadores-template.csv` | Google Drive | ❌ |
| `templates-cliente/05-fornecedores-template.csv` | Google Drive | ❌ |
| `templates-cliente/99-instrucoes-uso.pdf` | Google Drive | ❌ |

> **Schema completo de cada um já está documentado em [processo-padronizacao-materiais.md §3](./processo-padronizacao-materiais.md).**

**Próximo passo (você, ~2h):**
1. Criar pasta `templates-cliente/` no Google Drive da Atlântico
2. Para cada template, criar o XLSX/CSV com:
   - Aba 1: cabeçalhos + 1 linha de exemplo
   - Aba 2: instruções (cada coluna explicada)
3. Para o PDF de instruções, usar Notion → Export PDF

### Gaps que VOCÊ NÃO LISTOU mas precisa cobrir

| Gap | Por que importa | Próximo passo |
|---|---|---|
| **`equipamentos.csv`** | Cliente vai te mandar lista de equipamentos próprios + alugados — sem template, vira caos | Criar template no mesmo padrão |
| **Marcos contratuais** (`marcos.csv`) | Você cita "extrair marcos do contrato" mas não tem template | Schema: `code, name, due_date, contractual_value, status` |
| **Riscos identificados** (`riscos.csv`) | Torre de Controle tem campo de risco — sem template, não popula | Schema: `code, name, level, category, mitigation, status` |
| **Lista de fotos com geocódigo** | Você quer popular RDO histórico com fotos antigas — falta template | Schema: `filename, date, lat, lng, trecho_code, description` |

---

## 3. MATERIAIS DE TREINAMENTO (durante onboarding)

### 3.1 Manual de uso PDF (15 páginas) ❌

Você listou: "Manual de uso PDF (15 páginas) — feito uma vez, reusado por cliente".

**Estrutura sugerida:**

| Página | Conteúdo |
|---|---|
| 1 | Capa + sumário |
| 2 | Login + MFA + primeira tela |
| 3 | Sidebar e Minha Rotina |
| 4-5 | RDO — criar, fotos, salvar |
| 6-7 | Qualidade — FVS, NCs |
| 8-9 | Plan. Mestre — wizard, baseline |
| 10 | Quantitativos — orçamento |
| 11 | Suprimentos — Three-Way Match |
| 12 | Torre de Controle — celular |
| 13 | Como pedir ajuda |
| 14 | FAQ — 10 perguntas comuns |
| 15 | Contato + suporte |

**Próximo passo:** criar em Notion (export PDF) ou Google Docs. Tempo: 4-6h primeira vez.

### 3.2 Vídeos por persona (6 vídeos) ❌

Você listou:

| Persona | Duração | Conteúdo | Status |
|---|---|---|---|
| Engenheiro de campo | 8 min | "Como usar Atlântico no canteiro" | ❌ |
| Coordenador / Planejador | 12 min | "Planejamento Lean na Atlântico" | ❌ |
| Gerente de obra | 30 min | Demo individual + tutorial PDF de 5 páginas | ❌ |
| Diretor / Dono | 15 min | Demo individual focada no celular | ❌ |
| Qualidade | 10 min | "FVS digital" | ❌ |
| Comprador / Almoxarife | 8 min | "Suprimentos sem dor de cabeça" | ❌ |

**Como gravar:** OBS Studio (grátis) + microfone do PC. Hospede no YouTube unlisted. Linke do manual PDF.

**Tempo:** 1 dia para os 6 (com pausa entre eles). Roteiro + take direto.

### 3.3 Cheat sheet 1 página por persona ❌

Resumo visual de "o que apertar e quando" para cada persona. Tipo um keyboard shortcut sheet.

**Próximo passo:** Figma ou Canva → 1 página por persona = 6 PDFs.

### 3.4 Workshop slides (3 sessões) ❌

| Workshop | Duração | Slides |
|---|---|---|
| RDO + Qualidade | 2h | ~20 slides |
| Plan. Mestre + LPS / Lean | 2h | ~20 slides |
| Diretoria — Torre + Gestão 360 | 1h | ~10 slides |

---

## 4. MATERIAIS DE OPERAÇÃO (durante uso da plataforma)

### 4.1 FVS por tipo de obra ⚠️

Hoje só tem FOR-FVS-02 (solda PEAD). Tipos sugeridos para criar:

- **Concretagem** (FCK 25, 30, 40)
- **Alvenaria estrutural**
- **Armação** (espaçamento, bitola)
- **Escoramento e formas**
- **Instalações elétricas**
- **Hidráulica predial**
- **Recomposição de pavimento**

**Plataforma já suporta:** sim (a NovaFvsPanel tem `documentCode` e `revision` editáveis). Falta apenas criar os **templates** com os 9 itens corretos para cada tipo.

**Próximo passo:** criar `templates/fvs/` com 1 JSON por tipo de obra. Importar quando o cliente precisar.

### 4.2 Templates de relatório semanal/mensal ❌

Cliente vai pedir relatório semanal. Hoje a plataforma exporta CSVs e PDFs **por módulo** mas não tem **relatório consolidado**.

**Próximo passo:** criar um módulo `Relatórios Semanais` ou usar a Torre de Controle como base de exportação.

### 4.3 Templates de auditoria ❌

Para o cliente apresentar ao órgão público / fiscal. Estrutura:

- Capa com nº contrato, data, escopo
- Resumo do mês (RDOs, FVS, NCs)
- Anexos: PDFs das FVS críticas + fotos georreferenciadas
- Audit trail: tabela de quem alterou o quê e quando

**Próximo passo:** depois do Supabase entrar (porque depende do `audit_log`).

---

## 5. MATERIAIS COMERCIAIS (pós-venda / retenção)

### 5.1 Modelo de QBR (Quarterly Business Review) ❌

Reunião trimestral de 30 min com cada cliente. Slides com:

- KPIs do trimestre vs. baseline
- O que economizou em R$
- Próximas features / roadmap
- Pedido de feedback

**Próximo passo:** template de slides (10 páginas).

### 5.2 NPS form mensal ❌

Email automático no dia 1 de cada mês: "De 0 a 10, quanto você recomendaria a Atlântico?"

**Ferramenta sugerida:** Typeform (grátis até 100 respostas/mês) ou Google Forms.

### 5.3 Pesquisa de satisfação pós-onboarding ❌

Enviada no dia 30 do onboarding. 5 perguntas:

1. O onboarding foi suficiente?
2. A equipe sente confiança no uso?
3. Quais módulos usam mais?
4. O que está faltando?
5. NPS

### 5.4 Termo de aceite final do onboarding ❌

PDF com checklist + assinatura do cliente confirmando que recebeu tudo. Importante para evitar cobranças do tipo "ah, mas eu pensei que isso vinha junto".

---

## 6. DOCUMENTOS LEGAIS

### 6.1 Contrato MSA (Master Service Agreement) ❌

**Você precisa de um advogado.** Não é minha praia, mas o contrato deve cobrir:

- Escopo do serviço (acesso, suporte, consultoria)
- Mensalidade + reajuste anual (IGPM)
- Prazo (12 meses com renovação automática)
- Rescisão (30 dias de aviso)
- LGPD — quem é controlador, quem é operador
- Cláusula de backup e recuperação
- Cláusula de garantia de economia (sua promessa de devolver se não bater)
- Foro (recomendado: comarca da CONTRATADA)

### 6.2 Termo de responsabilidade LGPD ⚠️

Documenta que o cliente é controlador dos dados pessoais e a Atlântico é operadora. Importante para auditoria.

### 6.3 SLA (Service Level Agreement) ⚠️

**Esboço já existe** em [estrategia-organizacao.md §14](./estrategia-organizacao.md). Falta materializar como PDF assinável.

---

## 7. SCRIPTS E AUTOMAÇÕES (você não pediu, mas vai precisar)

| Script | O que faz | Status |
|---|---|---|
| `setup-hero-image.ps1` | Atualizar imagem do hero da landing | ✅ Existe em [`scripts/`](../scripts/) |
| `commit-hero-image.ps1` | git add+commit+push da imagem | ✅ Existe |
| `validate-import.ts` | Validar templates antes de importar | ❌ Próximo |
| `create-client-folder.ps1` | Cria a estrutura `01_recebido/...` automaticamente | ❌ Próximo |
| `backup-supabase.sh` | Backup semanal do banco (após Supabase) | ❌ Sprint Supabase |

---

## 8. CHECKLIST CONSOLIDADO — O QUE FAZER ESSA SEMANA

> Ordem priorizada por impacto comercial.

### Hoje (~2h)
- [ ] Rodar `cd videos && npm install` (1x só)
- [ ] Rodar `npm run render:all` para gerar os 3 vídeos
- [ ] Copiar `hero-loop.mp4` para `public/videos/` (eu posso fazer a integração no Hero quando você confirmar)

### Amanhã (~4-6h)
- [ ] Criar pasta `templates-cliente/` no Google Drive
- [ ] Criar os 5 templates Excel/CSV (schemas em [processo-padronizacao-materiais.md](./processo-padronizacao-materiais.md))
- [ ] Criar o **one-pager PDF** (frente e verso)

### Esta semana (~16-20h)
- [ ] Criar a **apresentação 10 slides** em Google Slides
- [ ] Gravar o **vídeo full demo de 5 min** (Loom ou OBS)
- [ ] Conversar com advogado sobre contrato MSA + SLA

### Próximas 2 semanas
- [ ] Manual de uso PDF (15 páginas)
- [ ] 6 vídeos por persona (8-30 min cada)
- [ ] Cheat sheet 1 página por persona
- [ ] Pedir Supabase URL + anon key para começar Sprint 1

### Após 1º cliente fechar
- [ ] Modelo de QBR
- [ ] NPS form mensal
- [ ] Termo de aceite do onboarding
- [ ] Caso de sucesso após 30 dias do piloto

---

## 9. PRÓXIMAS FEATURES DA PLATAFORMA QUE DESTRAVAM ISSO TUDO

A maior limitação hoje é **falta de importação CSV/XLSX nos módulos**. Sem isso, o onboarding manual leva ~5 dias por cliente. Com isso, ~1 dia.

**Top 3 features que vou implementar quando você pedir:**

1. **Botão `+ Importar XLSX/CSV` em 5 módulos** (Quantitativos, Plan. Mestre, Torre de Controle, Mão de Obra, Suprimentos)
   - Aceita o template Atlântico padrão
   - Validação Zod antes de inserir
   - Preview da importação
   - Confirmação do usuário
   - Roll-back se der erro
   - **Tempo estimado:** 1 dia (5 módulos × 1-2h cada)

2. **Página `/admin/importar` unificada** que aceita os 5 arquivos de uma vez
   - Drag & drop dos 5 templates
   - Importa em ordem (obras → trabalhadores → orçamento → cronograma → FVS)
   - Mostra progresso de cada um
   - Log final de erros e sucessos
   - **Tempo:** 1 dia adicional

3. **Conversor de MS Project** (`.mpp` ou XML export → cronograma.xlsx Atlântico)
   - **Tempo:** 1-2 dias

Quando você falar **"vamos fechar a 1ª obra"**, esse é o pacote que vai pra implementação imediata.

---

## Documentos relacionados

- [estrategia-organizacao.md](./estrategia-organizacao.md) — estratégia geral
- [processo-padronizacao-materiais.md](./processo-padronizacao-materiais.md) — workflow detalhado de padronização
- [database-architecture.md](./database-architecture.md) — schema do banco (depende dos templates)
- [audit-planejamento-qualidade.md](./audit-planejamento-qualidade.md) — auditoria técnica dos módulos
- [linkedin-posts.md](./linkedin-posts.md) — 20 posts B2B
- [linkedin-posts-ontologia.md](./linkedin-posts-ontologia.md) — 10 posts técnicos
- [`videos/`](../videos/) — Remotion: HeroLoop, ProductDemo30s, LinkedInTeaser60s
- [`scripts/`](../scripts/) — automações de operação
