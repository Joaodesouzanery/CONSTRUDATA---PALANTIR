# Onboarding do Cliente — Manual Detalhado

> **Status:** SOP operacional v2 — manual a ser usado em TODA obra fechada
> **Versão:** 2.0 — 2026-04-08
> **Tempo médio:** 1-3 dias úteis para popular a plataforma com botão "Importar"
> **Tempo médio antes do botão "Importar":** 5 dias úteis (manual)

Este documento responde 4 perguntas críticas:

1. **Que documentos exatos** o cliente precisa me passar
2. **O que é template Atlântico** vs. o que ele já tem (e como converter)
3. **A estrutura sugerida de apresentação** dos módulos numa reunião rápida
4. **Onde colocar o botão "Padronizar"** — recomendação final

---

## Sumário

1. [Documentos mínimos do cliente](#1-documentos-mínimos-do-cliente)
2. [Templates Atlântico — 2 cenários (já tem ou não tem)](#2-templates-atlântico--dois-cenários)
3. [Botões "Importar" agora estão na plataforma](#3-botões-importar-agora-estão-na-plataforma)
4. [Estrutura de apresentação dos módulos (reunião rápida)](#4-estrutura-de-apresentação-dos-módulos-em-reunião-rápida)
5. [Padronização: Minha Rotina ou módulo separado?](#5-padronização-minha-rotina-ou-módulo-separado)
6. [Checklist do dia a dia](#6-checklist-do-dia-a-dia)

---

## 1) Documentos mínimos do cliente

> ⚡ Mande este checklist por e-mail ou WhatsApp **assim que o contrato for assinado**, com link do Drive compartilhado da pasta `01_recebido/`.

### 1.1 Bloco MÍNIMO ESSENCIAL (sem isso a plataforma não roda)

| # | Documento | Por que | Plataforma |
|---|---|---|---|
| 1 | **Lista de usuários** (Excel/CSV ou texto) com: nome, e-mail corporativo, cargo, role pretendida (engenheiro, gerente, diretor, qualidade, comprador) | Para criar contas e enviar convites de acesso | Auth (Supabase quando entrar) |
| 2 | **Lista de obras**: código, nome, endereço completo, cidade, estado, lat/lng (se tiver), tipo, status, data início, data fim | Popular Torre de Controle e Plan. Mestre | Torre de Controle |
| 3 | **Orçamento da obra atual**: pode ser Excel, PDF, planilha do escritório (qualquer formato) | Popular Quantitativos e calcular CPI/SPI depois | Quantitativos |
| 4 | **Cronograma atual**: MS Project (.mpp), Primavera (.xer), Excel ou PDF | Popular Plan. Mestre e gerar baseline | Planejamento |
| 5 | **Lista de funcionários ativos** com: nome, função, CPF, status, valor hora, NRs vencidas se souber | Popular Mão de Obra | Mão de Obra |
| 6 | **Contrato com cliente final** (PDF) | Extrair marcos contratuais e prazo | Torre + Plan. Mestre |
| 7 | **Lista de fornecedores principais**: nome, CNPJ se tiver, contato, prazo de pagamento | Popular Suprimentos | Suprimentos |
| 8 | **5 a 10 fotos** atuais do canteiro (com data e local se possível) | Popular RDOs históricos para o cliente "ver dados" desde o dia 1 | RDO |

### 1.2 Bloco RECOMENDADO (deixa o onboarding ainda mais rico)

| # | Documento | Quando vale a pena |
|---|---|---|
| 9 | Lista de equipamentos próprios + alugados (placa, modelo, tipo, alocação atual) | Sempre que tem frota |
| 10 | FVS preenchidas dos últimos 30 dias (PDFs/scans) | Para popular histórico de qualidade |
| 11 | Matriz de risco atual da obra | Popular módulo de Riscos da Torre |
| 12 | Documentação técnica: BIM (.ifc, .rvt), projeto executivo (PDFs) | Mostrar ao engenheiro o "como era antes do digital" |
| 13 | Orçamentos de obras anteriores (mesmo padrão) | Para reuso e comparação |
| 14 | NCs (Não Conformidades) abertas hoje | Popular fluxo da Qualidade desde o início |
| 15 | Tabela de produtividade média do time (m³/dia, m²/dia, etc.) | Calibrar engine de cronograma |

### 1.3 Bloco INSTITUCIONAL (uma vez, não muda)

| # | Documento | Onde usa |
|---|---|---|
| 16 | Logo da empresa em PNG ou SVG (fundo transparente preferencial) | Aparece nos PDFs de FVS, RDO, relatórios |
| 17 | Cores institucionais (hex) e fontes preferidas | Customização visual |
| 18 | Razão social, CNPJ, endereço sede, responsável técnico, CREA | Para os PDFs oficiais |

### 1.4 Como pedir tudo isso ao cliente (template e-mail)

> **Assunto:** [Atlântico] Onboarding — checklist de documentos
>
> Olá [Nome],
>
> Para começarmos seu onboarding na Atlântico, preciso dos documentos abaixo. **Pode mandar tudo do jeito que está**, sem se preocupar com formato ou padronização — eu cuido disso.
>
> 📁 Pasta compartilhada (Drive/OneDrive): [LINK]
>
> **Essencial (sem isso não rolamos):**
> 1. Lista de usuários da plataforma (nome, e-mail, cargo)
> 2. Lista de obras (Excel ou só texto)
> 3. Orçamento atual da obra (Excel, PDF ou planilha)
> 4. Cronograma atual (MS Project, Excel, ou PDF)
> 5. Lista de funcionários ativos (nome, função, CPF)
> 6. Contrato com o cliente final (PDF)
> 7. Lista de fornecedores principais
> 8. 5-10 fotos atuais do canteiro
>
> **Recomendado (deixa o onboarding mais rico):**
> 9. Lista de equipamentos
> 10. FVS preenchidas dos últimos 30 dias
> 11. Matriz de risco
> 12. BIM ou projeto executivo
>
> **Institucional (uma vez):**
> 13. Logo PNG/SVG
> 14. Cores e fontes da marca
> 15. CNPJ, razão social, responsável técnico
>
> **Prazo sugerido:** essa semana. Quanto antes você mandar, antes a plataforma fica operacional.
>
> Qualquer dúvida me chama no WhatsApp: [seu número]
>
> Abraço,
> João — Atlântico

---

## 2) Templates Atlântico — Dois cenários

A plataforma agora aceita **2 caminhos**:

### 🟢 Cenário A — Cliente já tem o documento

**Fluxo:** receber → padronizar → importar.

| Documento do cliente | Você converte para… | Você importa em… |
|---|---|---|
| Excel de orçamento (qualquer formato) | `orcamento.xlsx` (template Atlântico) | Quantitativos → botão **Importar** |
| MS Project / Excel cronograma | `trechos.xlsx` (template Atlântico) | Planejamento → botão **Importar Trechos** |
| Planilha de obras | `obras.csv` ou `.xlsx` | Torre de Controle → botão **Importar** |
| Lista de funcionários do RH | `funcionarios.xlsx` | Mão de Obra → botão **Importar Funcionários** |
| Lista de fornecedores | `fornecedores.xlsx` | Suprimentos → botão **Importar Fornecedores** |

**Como você converte:** abre o arquivo do cliente, copia coluna por coluna no template Atlântico, valida campos. **A plataforma já valida o formato durante o import** (aceita aliases em PT-BR como "código", "descrição", etc.).

### 🟢 Cenário B — Cliente NÃO tem o documento

**Fluxo:** baixar template → preencher junto com o cliente → importar.

A nova feature de **Importar** tem um botão **"Baixar template Atlântico"** dentro do modal — o cliente baixa o XLSX com:
- 1 aba "Template" com cabeçalhos PT-BR + 1 linha de exemplo
- 1 aba "Instruções" com tipo, obrigatoriedade e descrição de cada campo

**Vantagem:** o cliente preenche **uma única vez**, no padrão certo, e você importa direto.

### Schemas dos templates (resumo)

#### `orcamento.xlsx` — Quantitativos
| Coluna | Tipo | Obrigatório | Exemplo |
|---|---|---|---|
| `code` (código) | string | sim | `SINAPI-93358` |
| `description` (descrição) | string | sim | `Escavação mecanizada de vala` |
| `unit` (unidade) | string | sim | `m³` |
| `quantity` (quantidade) | número | sim | `480` |
| `unit_cost` (custo unitário) | número | sim | `23.15` |
| `bdi` | número 0-100 | não (default 25) | `25` |
| `category` (categoria) | string | sim | `Escavação` |
| `source` (fonte) | sinapi/seinfra/custom/manual | não (default sinapi) | `sinapi` |
| `notes` (observações) | string | não | `Solo categoria 1` |

#### `trechos.xlsx` — Planejamento
| Coluna | Tipo | Obrigatório | Exemplo |
|---|---|---|---|
| `code` (código) | string | sim | `T01` |
| `description` (descrição) | string | sim | `Rede de água — Av. Principal trecho 1` |
| `lengthM` (comprimento m) | número | sim | `80` |
| `depthM` (profundidade m) | número | sim | `1.5` |
| `diameterMm` (diâmetro mm) | número | sim | `200` |
| `soilType` (tipo solo) | normal/rocky/mixed | não (default normal) | `normal` |
| `requiresShoring` (escoramento) | true/false | não (default false) | `false` |
| `unitCostBRL` (custo R$) | número | não | `145.50` |

#### `obras.csv` — Torre de Controle
| Coluna | Tipo | Obrigatório | Exemplo |
|---|---|---|---|
| `code` | string | sim | `OBR-001` |
| `name` | string | sim | `Torre Residencial Paulista` |
| `company` | string | não | `Construtora ABC` |
| `manager` | string | não | `João Silva` |
| `status` | active/planning/paused/completed | não | `active` |
| `street`, `number`, `district` | string | não | `Av. Paulista`, `1500`, `Bela Vista` |
| `city` | string | sim | `São Paulo` |
| `state` | string (2 letras) | sim | `SP` |
| `cep` | string | não | `01310-100` |
| `buildingType` | string | não | `Residencial` |
| `totalArea` (área m²) | número | não | `2400` |
| `floors` (andares) | número | não | `12` |
| `startDate` (yyyy-MM-dd) | data | não | `2026-03-15` |
| `expectedEnd` (yyyy-MM-dd) | data | não | `2027-09-30` |
| `lat`, `lng` | números | não | `-23.5649`, `-46.6527` |

#### `funcionarios.csv` — Mão de Obra
| Coluna | Tipo | Obrigatório | Exemplo |
|---|---|---|---|
| `name` (nome) | string | sim | `Carlos Mendes` |
| `role` (função/cargo) | string | sim | `Encarregado` |
| `cpf` | string | não (mascarado automaticamente) | `12345678900` → vira `***.***.***-00` |
| `crewId` (equipe) | string | não | `crew-A` |
| `status` | active/inactive | não (default active) | `active` |
| `hourlyRate` (R$/h) | número | não | `28.50` |
| `admissionDate` (yyyy-MM-dd) | data | não | `2024-03-15` |
| `contractType` | clt/pj/freelancer/apprentice | não | `clt` |
| `phone` | string | não | `(11) 99999-9999` |

> ⚠️ **LGPD:** o CPF é **mascarado automaticamente** na importação — só os 2 últimos dígitos ficam visíveis. O CPF completo nunca é armazenado.

#### `fornecedores.csv` — Suprimentos
| Coluna | Tipo | Obrigatório | Exemplo |
|---|---|---|---|
| `cnpj` | string | não | `12.345.678/0001-90` |
| `name` (razão social) | string | sim | `Cimpor Brasil` |
| `category` (categoria) | string | não | `Concreto` |
| `contactName` (contato) | string | não | `Ana Ribeiro` |
| `phone` | string | não | `(11) 99999-9999` |
| `email` | string | não | `vendas@cimpor.com.br` |
| `paymentTerms` (prazo) | string | não | `30 dias` |

---

## 3) Botões "Importar" agora estão na plataforma

Acabei de implementar **importação CSV/XLSX nos 5 módulos**. Funciona offline, valida cada linha e mostra os erros antes de gravar.

### Onde está cada botão

| Módulo | Onde clicar | O que importa |
|---|---|---|
| **Quantitativos** | Header → botão `📤 Importar` (ao lado de "Criar Orçamento") | Itens de orçamento |
| **Planejamento** | Header → botão `📤 Importar Trechos` (ao lado de "Gerar Planejamento") | Trechos |
| **Torre de Controle** | Lista de Projetos → ícone `📤` ao lado de "+ Nova Obra" | Obras / Sites |
| **Mão de Obra** | Header → botão `📤 Importar Funcionários` (canto superior direito) | Funcionários |
| **Suprimentos** | Header (qualquer aba) → botão `📤 Importar Fornecedores` (canto direito da tab bar) | Fornecedores |

### Como o cliente (ou você) usa

1. Clica em **Importar**
2. Modal abre com 2 opções:
   - **Drag & drop** ou clique para escolher arquivo (.xlsx, .xls, .csv)
   - **Baixar template Atlântico** se não tiver o arquivo ainda
3. Plataforma processa em ~1s e mostra:
   - **Total processado** (linhas no arquivo)
   - **Válidas** (verdes) — quantas vão entrar
   - **Erros** (vermelhas) — linha + coluna + motivo
4. Se tiver erros, **corrige no Excel e tenta de novo** — não persiste nada
5. Se tudo OK, clica **"Importar X linhas"** → modal fecha e os dados aparecem no módulo

### Validações automáticas

- **Tamanho máximo:** 5 MB / 5.000 linhas (anti-DoS)
- **Tipos aceitos:** `.xlsx`, `.xls`, `.csv`
- **Aliases em português:** "código" / "code" / "cod" → todos viram `code`
- **Coerção de tipos:** "1.234,56" e "1,234.56" viram `1234.56`. "12/04/2026" vira `2026-04-12`
- **Validação Zod por linha:** se um campo obrigatório está vazio, a linha é rejeitada e mostrada na lista de erros
- **Hash do arquivo:** cada importação gera um hash mostrado no rodapé do modal — útil para audit log
- **Sem byte para servidor:** parsing é 100% local no navegador (FileReader + SheetJS)

---

## 4) Estrutura de apresentação dos módulos em reunião rápida

> ⚡ **Cenário:** você está na sala de reunião com o diretor e o gerente de obra do cliente. 30 minutos no máximo. O que mostrar, em qual ordem, para fechar?

### Tempo total: 30 min · Diferentes versões para diferentes audiências

### 🎯 Versão "Diretor" (para quem decide rápido) — 15 min

| Tempo | Módulo | O que mostrar | Frase de fechamento |
|---|---|---|---|
| 0-2 min | **Landing** | Abrir landing page no celular ou notebook. Mostrar a Hero, ler em voz alta os números (80% / 3-5% / R$200k) | *"Não estamos vendendo software. Estamos vendendo decisão antes de relatório."* |
| 2-7 min | **Torre de Controle** | Abrir no celular. Mostrar lista de obras, clicar em uma → mostrar CPI/SPI, alertas, mapa | *"Você abre 30 segundos de manhã e sabe exatamente qual obra está em risco. Sem reunião."* |
| 7-11 min | **Gestão 360** | Mostrar dashboard executivo: curva S, KPIs financeiros, EVM | *"O que você precisa pra reunião de quinta-feira já está aqui — não precisa pedir pra ninguém."* |
| 11-13 min | **Plan. Mestre** (Macro) | Mostrar o Gantt do "Longo Prazo" — uma WBS hierárquica colorida | *"Cada barra colorida tem CPI/SPI ligado em tempo real. Sem ETL, sem sync."* |
| 13-15 min | **Investimento + CTA** | Mostrar a faixa R$ 8.500-12.000 + frase "garantia de economia ou devolvo" | *"Vamos colocar uma obra sua piloto em 4 semanas. Se não pagar o próprio custo em 90 dias, eu devolvo."* |

### 👷 Versão "Gerente de obra" (para quem usa) — 15 min

| Tempo | Módulo | O que mostrar |
|---|---|---|
| 0-3 min | **RDO** | Abrir como engenheiro de campo. Criar um RDO de teste com fotos, equipe, equipamentos. Salvar |
| 3-5 min | **Qualidade / FVS** | Criar uma FVS Solda PEAD. Mostrar como exporta PDF (mostra a paridade com FOR-FVS-02) |
| 5-7 min | **LPS / Lean** | Mostrar look-ahead 6 semanas + Constraint Register. Abrir uma restrição. Mostrar PPC |
| 7-10 min | **Plan. Trechos / Gantt** | Mostrar um trecho com produtividade. Editar inline. Rodar cronograma. Mostrar como o atraso de um material no Suprimentos vai afetar o cronograma |
| 10-13 min | **Suprimentos — 3-Way Match** | Abrir uma exceção. Mostrar como divergência PO×NF vira alerta automático com R$ de variância |
| 13-15 min | **Mão de Obra — Certificações** | Mostrar lista de NRs vencidas + alerta automático antes do trabalhador entrar em altura |

### 🎬 Versão "Reunião Express" — 5 min

Quando você só tem 5 min:

1. **30s** — landing + tagline
2. **2 min** — Torre de Controle no celular + CPI
3. **1 min** — RDO + foto + atualização da curva S em tempo real
4. **1 min** — FVS digital exportada em PDF
5. **30s** — preço + garantia + CTA (Calendly)

**Última frase:** *"Eu tenho 20 minutos no Calendly. Vamos marcar pra próxima semana e fazer no SEU cronograma, com SEUS dados?"*

### 🪄 Os 5 módulos-âncora (que você SEMPRE mostra)

Pra qualquer reunião, esses 5 são os que prova que a Atlântico não é dashboard:

| # | Módulo | Por que é âncora |
|---|---|---|
| 1 | **Torre de Controle** | "Wow factor" no celular — diretor entende em 30s |
| 2 | **Plan. Mestre** | Mostra que tem metodologia (WBS hierárquica, baselines) |
| 3 | **RDO** | Mostra ontologia: o que o engenheiro registra atualiza tudo |
| 4 | **Qualidade / FVS** | Mostra que tem DOC OFICIAL pronto (FOR-FVS-02) |
| 5 | **Quantitativos** | Mostra que aceita SINAPI e tem o wizard |

Os outros 14 módulos viram extensão. Esses 5 fazem o cliente fechar.

---

## 5) Padronização: Minha Rotina ou módulo separado?

### Minha recomendação: **NÃO colocar em Minha Rotina** — criar um módulo `/admin/importar` dedicado.

#### Por quê NÃO em Minha Rotina

**Minha Rotina** é a "tela inicial personalizada por persona". Tem 1 propósito: **lembrar o usuário do que ele faz no dia a dia** (RDO, FVS, Look-ahead, etc.). Misturar "Padronização" lá quebra o conceito porque:

| Problema | Detalhe |
|---|---|
| **Frequência diferente** | Padronização acontece **uma vez** no início (e raramente depois). RDO acontece **todo dia**. Não cabem na mesma tela |
| **Persona diferente** | Padronização é feita pelo **operador da plataforma** (você ou um diretor de TI do cliente). RDO/Qualidade são da equipe de campo |
| **Confusão visual** | Misturar "criar RDO" com "importar planilha de 50 obras" gera ruído cognitivo |
| **Reuso** | Padronização é só na primeira semana — depois disso só seria distração permanente na home |

#### Recomendação: **`/admin/importar` — Página unificada**

Ao invés disso, criar **uma página dedicada** acessível:

- **Pelo menu lateral** sob um grupo "ADMIN" (visível só para owner/diretor)
- **Pela primeira vez** que o cliente loga (onboarding wizard que abre automaticamente)
- **Pelo botão "Importar"** já existente em cada módulo (para casos pontuais)

**O que essa página teria:**

```
┌─────────────────────────────────────────────────────┐
│ 📤 Importar Dados                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Importe os arquivos da sua obra de uma vez só.    │
│  A ordem é importante: comece pelas obras.          │
│                                                     │
│  ┌─────────────────────────────────┐                │
│  │ 1. Obras                        │ [📤 Importar]  │
│  │    Status: ✓ 3 obras importadas │                │
│  └─────────────────────────────────┘                │
│                                                     │
│  ┌─────────────────────────────────┐                │
│  │ 2. Trechos / Cronograma         │ [📤 Importar]  │
│  │    Status: ⏳ Aguardando arquivo│                │
│  └─────────────────────────────────┘                │
│                                                     │
│  ┌─────────────────────────────────┐                │
│  │ 3. Orçamento                    │ [📤 Importar]  │
│  └─────────────────────────────────┘                │
│                                                     │
│  ┌─────────────────────────────────┐                │
│  │ 4. Funcionários                 │ [📤 Importar]  │
│  └─────────────────────────────────┘                │
│                                                     │
│  ┌─────────────────────────────────┐                │
│  │ 5. Fornecedores                 │ [📤 Importar]  │
│  └─────────────────────────────────┘                │
│                                                     │
│  ─── ou ───                                         │
│                                                     │
│  📦 [ Baixar pacote completo de templates ]         │
│      (1 arquivo .zip com os 5 templates)            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Por que isso é melhor:**
- **Onboarding linear** e óbvio — o usuário sabe a ordem
- **Status visível** — quantas linhas em cada módulo
- **Não polui Minha Rotina**, que continua focada no dia a dia
- **Pode ser acessado depois** quando precisar atualizar uma planilha
- **Botão único de "Baixar pacote completo"** para o cliente que ainda nem começou

#### A "exportação automática para PDF/Excel" que você pediu

Você perguntou: *"o cliente coloca o documento dele, vira padronizado, exporta em PDF ou Excel..."*

Essa parte é complementar e **já existe parcialmente**:

| Módulo | Já exporta? |
|---|---|
| Quantitativos | ✅ Botões CSV e Excel (.xlsx) no header |
| Qualidade / FVS | ✅ Botão "Exportar PDF" no padrão FOR-FVS-02 |
| Planejamento | ✅ Botão "Exportar CSV" |
| RDO | ✅ Botão "Exportar PDF" |
| Torre de Controle | ⚠️ Não tem ainda |
| Mão de Obra | ⚠️ Não tem ainda |
| Suprimentos | ⚠️ Não tem ainda |

**Próxima feature pra completar:** botão "Exportar PDF/XLSX" nos 3 que faltam. Tempo: 2-3h por módulo. Depois disso, o ciclo "importar caos do cliente → padronizar → exportar PDF/Excel limpo" fica completo.

---

## 6) Checklist do dia a dia

### Dia 0 — Cliente assina contrato
- [ ] Criar pasta no Drive: `clientes/YYYY-MM-nome-curto/`
- [ ] Mandar e-mail com checklist (template seção 1.4)
- [ ] Marcar kick-off de 1h no Calendly
- [ ] Adicionar cliente em planilha de "Obras Ativas"

### Dia 1 — Kick-off
- [ ] Reunião de 1h por video
- [ ] Apresentar a versão "Diretor" (15 min) + "Gerente" (15 min) + perguntas (30 min)
- [ ] Confirmar checklist + prazo de envio dos arquivos
- [ ] Salvar ata em `00_contrato/ata-kickoff.pdf`

### Dia 2 — Recebimento
- [ ] Cliente envia arquivos no Drive
- [ ] Você salva tudo em `01_recebido/` (intocado)
- [ ] Anota no log o que veio e o que faltou
- [ ] Se faltar coisa crítica: WhatsApp imediato pedindo

### Dia 3 — Padronização (CENÁRIO A: cliente já tinha)
- [ ] Abrir orçamento do cliente, copiar pra `02_padronizado/orcamento.xlsx`
- [ ] Abrir cronograma, exportar/copiar pra `02_padronizado/trechos.xlsx`
- [ ] Preencher `obras.csv` a partir da lista
- [ ] Preencher `funcionarios.csv` a partir do RH
- [ ] Preencher `fornecedores.csv`
- [ ] Validar visualmente cada arquivo

### Dia 3 alternativo — Cenário B (cliente NÃO tinha)
- [ ] Baixar templates Atlântico via plataforma (botão "Baixar template" em cada modal)
- [ ] Marcar call de 2h com cliente para preencher juntos
- [ ] Salvar versão final em `02_padronizado/`

### Dia 4 — Importação
- [ ] Logar como owner do cliente na plataforma
- [ ] Importar **na ordem**:
  1. Torre de Controle → Obras
  2. Mão de Obra → Funcionários
  3. Suprimentos → Fornecedores
  4. Quantitativos → Orçamento
  5. Planejamento → Trechos
- [ ] Print de cada tela populada → salvar em `03_importado/screenshot-X.png`
- [ ] Validar com cliente por video de 15 min

### Dia 5 — Treinamento + começa operação
- [ ] Treinamento RDO (engenheiros) — 1h
- [ ] Treinamento FVS (qualidade) — 30 min
- [ ] Treinamento LPS (planejador) — 1h
- [ ] Cliente está oficialmente operando

---

## Documentos relacionados

- [estrategia-organizacao.md](./estrategia-organizacao.md) — estratégia geral + onboarding 4 semanas
- [processo-padronizacao-materiais.md](./processo-padronizacao-materiais.md) — workflow detalhado de pasta
- [checklist-materiais-onboarding.md](./checklist-materiais-onboarding.md) — auditoria do que precisa criar
- [database-architecture.md](./database-architecture.md) — schema do banco (depois do Supabase)
