# Processo de Padronização de Materiais do Cliente

> **Status:** SOP operacional — usar em toda nova obra fechada
> **Versão:** v1.0 — 2026-04-08
> **Tempo médio:** 3-5 dias úteis por cliente novo

Este é o **manual do operador** para receber o caos de arquivos do cliente
e devolver tudo dentro do padrão Atlântico, importado e validado na plataforma.

> **Filosofia:** o cliente nunca precisa "se adaptar" antes de assinar.
> Você aceita tudo do jeito que está, e transforma em padrão depois. O cliente
> só vê o resultado limpo dentro da plataforma.

---

## Sumário

1. [Visão geral do fluxo](#1-visão-geral-do-fluxo)
2. [Estrutura de pasta padrão por cliente](#2-estrutura-de-pasta-padrão-por-cliente)
3. [Templates Atlântico (3 essenciais + 2 extras)](#3-templates-atlântico-3-essenciais--2-extras)
4. [Workflow de padronização passo a passo](#4-workflow-de-padronização-passo-a-passo)
5. [Validação antes de importar](#5-validação-antes-de-importar)
6. [Importação na plataforma](#6-importação-na-plataforma)
7. [Log e auditoria](#7-log-e-auditoria)
8. [Anti-padrões](#8-anti-padrões-coisas-que-não-fazer)
9. [Próximos passos para automatizar](#9-próximos-passos-para-automatizar)

---

## 1) Visão geral do fluxo

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│   Cliente   │  caos   │  01_recebido│  você   │ 02_padronizado│
│   (Excel,   │ ──────► │  (intocado) │ ──────► │  (template    │
│   PDFs,     │         │             │         │   Atlântico)  │
│  WhatsApp)  │         └─────────────┘         └──────┬───────┘
└─────────────┘                                         │
                                                        │ import
                                                        ▼
                                                ┌──────────────┐
                                                │ 03_importado │
                                                │  (provas)    │
                                                └──────┬───────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │   PLATAFORMA │
                                                │   (Supabase) │
                                                └──────────────┘
```

**Princípios:**
- ❌ **Nunca** alterar o conteúdo de `01_recebido/`. É o original do cliente, intocável.
- ✅ Toda transformação acontece em `02_padronizado/`, **separada** dos originais.
- ✅ `03_importado/` guarda o **log** + screenshots de validação. Se a importação der ruim, dá para auditar o que foi feito.

---

## 2) Estrutura de pasta padrão por cliente

Cada cliente novo ganha **uma pasta na nuvem** (Google Drive ou OneDrive) com a estrutura abaixo. Use **exatamente** essa estrutura — nada de improviso por cliente.

```
clientes/
└── 2026-04-engeneves/                      ← YYYY-MM-nome-curto
    │
    ├── 00_contrato/                        ← contrato + escopo + assinaturas
    │   ├── contrato-msa.pdf
    │   ├── escopo-tecnico.pdf
    │   └── ata-kickoff-DD-MM-YYYY.pdf
    │
    ├── 01_recebido/                        ← INTOCÁVEL — original do cliente
    │   ├── 01_orcamentos/
    │   │   └── orcamento-original-cliente.xlsx
    │   ├── 02_cronograma/
    │   │   ├── cronograma-cliente.mpp
    │   │   └── cronograma-cliente.pdf
    │   ├── 03_obras/
    │   │   └── lista-obras-clientes.xlsx
    │   ├── 04_pessoal/
    │   │   └── lista-funcionarios.xlsx
    │   ├── 05_fvs-historicas/
    │   │   ├── fvs-trecho-A.pdf
    │   │   └── fvs-trecho-B.pdf
    │   ├── 06_fotos/
    │   │   └── canteiro-DD-MM-YYYY/
    │   ├── 07_fornecedores/
    │   │   └── lista-fornecedores.xlsx
    │   └── 99_diversos/
    │       └── (PDFs soltos, e-mails impressos, etc.)
    │
    ├── 02_padronizado/                     ← Template Atlântico
    │   ├── orcamento.xlsx                  (template Quantitativos)
    │   ├── cronograma.xlsx                 (template Plan. Mestre)
    │   ├── obras.csv                       (template Torre de Controle)
    │   ├── trabalhadores.csv               (template Mão de Obra)
    │   ├── fornecedores.csv                (template Suprimentos)
    │   └── fvs/
    │       ├── fvs-001-trecho-A.pdf       (FOR-FVS-02 padronizado)
    │       └── fvs-002-trecho-B.pdf
    │
    ├── 03_importado/                       ← Provas de importação
    │   ├── log-importacao-DD-MM-YYYY.txt
    │   ├── screenshot-quantitativos.png
    │   ├── screenshot-cronograma.png
    │   ├── screenshot-torre-controle.png
    │   └── checklist-validacao.md
    │
    └── 04_treinamento/                     ← Materiais usados no onboarding
        ├── manual-uso-engenheiro.pdf
        └── lista-presença-treinamento.pdf
```

**Naming convention:**
- Datas: sempre `YYYY-MM-DD` (nunca DD-MM ou MM-DD)
- Nomes de arquivo: `kebab-case`, sem acentos, sem espaços
- Pastas numeradas: prefixo `NN_` para forçar ordem alfabética

---

## 3) Templates Atlântico (3 essenciais + 2 extras)

### 3.1 Templates **essenciais** (criar no Drive)

Esses 3 templates ficam em uma pasta **mestre** do Drive (`/templates-atlantico/`) e são copiados para cada cliente novo no início.

#### `orcamento-template.xlsx` — para o módulo Quantitativos

| Col | Header | Tipo | Obrigatório | Exemplo |
|---|---|---|---|---|
| A | `code` | string | sim | `SINAPI-93358` |
| B | `description` | string | sim | `Escavação mecanizada de vala` |
| C | `unit` | string | sim | `m³` |
| D | `quantity` | number | sim | `480` |
| E | `unit_cost` | number | sim | `23.15` |
| F | `bdi` | number | sim | `25` |
| G | `category` | string | sim | `Escavação` |
| H | `source` | enum | sim | `sinapi` |
| I | `notes` | string | não | `Solo categoria 1` |

**Aba 2:** `instructions` com texto explicando cada coluna.

#### `cronograma-template.xlsx` — para o módulo Planejamento Mestre

| Col | Header | Tipo | Obrigatório | Exemplo |
|---|---|---|---|---|
| A | `wbs_code` | string | sim | `1.1.5.1` |
| B | `name` | string | sim | `LA — Ligação de Água` |
| C | `parent_wbs` | string | não | `1.1.5` |
| D | `level` | number | sim | `3` |
| E | `planned_start` | date YYYY-MM-DD | sim | `2026-05-01` |
| F | `planned_end` | date YYYY-MM-DD | sim | `2026-06-15` |
| G | `weight` | number 0-100 | sim | `15` |
| H | `network_type` | enum | não | `agua` |
| I | `responsible_team` | string | não | `Equipe A` |
| J | `is_milestone` | boolean | sim | `false` |

#### `obras-template.csv` — para a Torre de Controle

```csv
code,name,address,number,district,city,state,zip,lat,lng,status,manager,total_area,start_date,end_date
OBR-001,Torre Residencial Paulista,Av. Paulista,1500,Bela Vista,São Paulo,SP,01310-100,-23.5649,-46.6527,active,João Silva,2400,2026-03-15,2027-09-30
```

### 3.2 Templates **extras** (criar quando precisar)

#### `trabalhadores-template.csv` — para Mão de Obra
```csv
cpf,name,role,ctps,nr10_valid_until,nr35_valid_until,aso_valid_until,hourly_rate
123.456.789-00,Carlos Mendes,Encarregado,123456,2027-01-15,2026-12-30,2026-08-10,28.50
```

#### `fornecedores-template.csv` — para Suprimentos
```csv
cnpj,name,category,contact_name,phone,email,score,payment_terms
12.345.678/0001-90,Cimpor Brasil,Concreto,Ana Ribeiro,11999999999,vendas@cimpor.com.br,4.5,30 dias
```

### 3.3 Onde criar e armazenar os templates

**Recomendação:** uma pasta única no Google Drive da Atlântico:

```
Google Drive (Atlântico)
└── templates-atlantico/
    ├── 01-orcamento-template.xlsx       ← XLSX com aba "instructions"
    ├── 02-cronograma-template.xlsx
    ├── 03-obras-template.csv
    ├── 04-trabalhadores-template.csv
    ├── 05-fornecedores-template.csv
    ├── 99-instrucoes-de-uso.pdf         ← Como preencher cada um (visual)
    └── README.md                         ← Versão / changelog
```

Quando um cliente novo assinar, **copie a pasta** para `clientes/2026-04-novocliente/02_padronizado/`.

**Próximo passo:** criar fisicamente os 5 arquivos no seu Drive nessa
estrutura. Tempo estimado: 1-2 horas (uma vez só).

---

## 4) Workflow de padronização passo a passo

> Tempo médio total por cliente: **3-5 dias úteis**.

### Dia 1 — Recebimento (1h)

1. **Criar pasta** do cliente em `clientes/YYYY-MM-nome-curto/`
2. **Copiar** os 5 templates da pasta-mestre para `02_padronizado/`
3. **Pedir ao cliente** os arquivos (use o checklist abaixo)
4. **Salvar** tudo o que ele mandar em `01_recebido/` — sem alterar
5. **Audit:** anotar no `03_importado/log-recebimento.txt` qual arquivo veio de onde

**Checklist do cliente** (mande junto com o convite de Drive):
- [ ] Orçamento atual da obra (Excel/PDF)
- [ ] Cronograma atual (MS Project, Primavera, Excel ou PDF)
- [ ] Lista de obras com endereço (Excel/CSV)
- [ ] Lista de funcionários ativos (CPF, função, NRs vencidas)
- [ ] FVS preenchidas dos últimos 30 dias (PDF/scan)
- [ ] 5-10 fotos atuais do canteiro (com data se possível)
- [ ] Lista de fornecedores principais
- [ ] Cópia do contrato com cliente final (extrai marcos contratuais)
- [ ] Documentação técnica (BIM, projeto executivo) — opcional

### Dia 2 — Triagem do orçamento (2-4h)

1. **Abrir** orçamento original do cliente
2. **Identificar** estrutura: cada linha tem `código`, `descrição`, `unidade`, `quantidade`, `custo unitário`?
3. **Mapear colunas** para as colunas do template Atlântico
4. **Copiar e colar** linha por linha (ou usar fórmulas Excel se for grande)
5. **Verificar SINAPI:** cada item tem código SINAPI? Se não, marcar como `manual`
6. **Calcular BDI** se não estiver explícito
7. **Salvar** em `02_padronizado/orcamento.xlsx`

**Tempo por item:** ~30 segundos manualmente. Para 100 itens = ~50 min.

### Dia 3 — Triagem do cronograma (3-6h)

1. **Abrir** cronograma original (pode ser MS Project ou PDF)
2. Se for **MS Project**: exportar como Excel (`File → Export → Save as Type → Excel Workbook`)
3. **Mapear** WBS hierárquica para o template Atlântico:
   - Identificar atividades de nível 0, 1, 2, 3
   - Atribuir códigos `1`, `1.1`, `1.1.1`, etc.
4. **Validar datas:** todas as `planned_end` são depois das `planned_start`?
5. **Calcular pesos:** distribuir 100 entre os filhos diretos de cada nível
6. **Marcar marcos** (`is_milestone = true`)
7. **Salvar** em `02_padronizado/cronograma.xlsx`

**Tempo:** depende da complexidade. Cronograma de 50 atividades ≈ 3h.

### Dia 4 — Demais arquivos (2-3h)

1. **Obras:** preencher o CSV com endereço completo + lat/lng (use Google Maps)
2. **Trabalhadores:** transformar a planilha do RH no CSV padrão. **Atenção:** validar CPF e datas das NRs
3. **Fornecedores:** lista simples com CNPJ + categoria + contato
4. **FVS históricas:** scanear os PDFs antigos, salvar em `02_padronizado/fvs/` com nome padrão `fvs-NNN-trecho.pdf`

### Dia 5 — Importação + validação (2-4h)

Ver seção 6 abaixo.

---

## 5) Validação antes de importar

**Não importe nada com erro.** Validação previne 80% dos problemas pós-importação.

### Checklist de validação por arquivo

#### `orcamento.xlsx`
- [ ] Todas as linhas têm `code`, `description`, `unit`, `quantity`, `unit_cost`, `bdi`, `category`, `source`?
- [ ] `quantity` e `unit_cost` são números (sem texto, sem `R$`, sem vírgula errada)?
- [ ] `bdi` está entre 0 e 100?
- [ ] `source` é `sinapi`, `seinfra`, `custom` ou `manual`?
- [ ] `unit` é uma das aceitas (`m`, `m²`, `m³`, `un`, `kg`, `t`, `h`, `dia`, `mês`, `verba`)?
- [ ] Total calculado bate com o total do cliente original?

#### `cronograma.xlsx`
- [ ] `wbs_code` é único (não tem duplicado)?
- [ ] `parent_wbs` referencia um WBS que existe na mesma planilha?
- [ ] `planned_end > planned_start` em todas as linhas?
- [ ] Datas no formato YYYY-MM-DD (não DD/MM/YYYY)?
- [ ] Pesos somam 100 nos filhos diretos de cada parent?

#### `obras.csv`
- [ ] `code` é único?
- [ ] `lat` e `lng` são números válidos (não NaN, dentro do território brasileiro: lat -33 a +5, lng -75 a -34)?
- [ ] `status` é `active`, `planning`, `paused` ou `completed`?

#### `trabalhadores.csv`
- [ ] CPF formatado corretamente (`123.456.789-00`)?
- [ ] Datas das NRs no formato YYYY-MM-DD?
- [ ] **Atenção:** alguma NR vencida? Marcar para o cliente atualizar antes do treinamento.

### Script de validação (criar futuro)

**Próximo passo (v2):** criar um script Node `scripts/validate-import.ts` que lê os 5 arquivos e roda os checks acima automaticamente. Por enquanto, validação manual.

---

## 6) Importação na plataforma

### Ordem de importação (importa!)

1. **Obras** (Torre de Controle) — primeiro, porque tudo referencia
2. **Trabalhadores** (Mão de Obra)
3. **Fornecedores** (Suprimentos)
4. **Orçamento** (Quantitativos) — depois das obras
5. **Cronograma** (Plan. Mestre) — depois do orçamento
6. **FVS históricas** — por último

### Como importar (hoje, sem Supabase)

Hoje cada módulo tem mocks. Para cada cliente novo, no Sprint 2 do Supabase, vamos ter botões "Importar CSV" em cada módulo. Por enquanto, edita manualmente os arquivos `mockX.ts` ou usa o wizard "Criar do Zero" + adiciona linha por linha.

**Quando o Supabase entrar (Sprint 2):**
- Cada módulo terá um botão `+ Importar` no header
- Aceita CSV ou XLSX
- Valida o schema antes de inserir
- Mostra preview da importação
- Confirma com o usuário antes de gravar
- Insere em transação (tudo ou nada)
- Loga no `audit_log`

### Após cada importação

1. **Tirar screenshot** do módulo populado
2. **Salvar** em `03_importado/screenshot-X.png`
3. **Anotar** no `log-importacao-DD-MM-YYYY.txt`:
   ```
   2026-04-15 14:32 — orcamento.xlsx importado
     Itens: 87
     Total: R$ 1.245.890,00
     Erros: 0
     Validado por: João Souza
   ```

### Se der erro

1. **Não tente "consertar no banco"** — sempre conserte no arquivo de origem
2. **Anote o erro** no log com o motivo
3. **Comunique o cliente** se for problema dele
4. **Re-importe** depois da correção

---

## 7) Log e auditoria

Toda importação fica registrada em `03_importado/log-importacao-DD-MM-YYYY.txt` com este formato:

```
═══════════════════════════════════════════════════════════
LOG DE IMPORTAÇÃO — Cliente: Engeneves
═══════════════════════════════════════════════════════════
Data: 2026-04-15
Operador: João Souza
Plataforma: Atlântico v0.x

─────────────────────────────────────────────────────────
1. obras.csv
   Hora: 14:30
   Linhas processadas: 3
   Linhas inseridas: 3
   Erros: 0
   Hash do arquivo: a3f2b1c8...
   Validado por screenshot: ✅ screenshot-obras.png

─────────────────────────────────────────────────────────
2. trabalhadores.csv
   Hora: 14:45
   Linhas processadas: 47
   Linhas inseridas: 45
   Erros: 2 (CPFs duplicados — anotar e devolver para o cliente)
   Validado por screenshot: ✅ screenshot-mao-de-obra.png

─────────────────────────────────────────────────────────
... etc
─────────────────────────────────────────────────────────

ASSINATURA: João Souza  /  joao@atlantico.com.br
```

**Por que isso importa:** se um dia o cliente perguntar "cadê meu orçamento de R$ 1,2M?", você abre o log, mostra a hora exata, o hash do arquivo, o screenshot da tela. **Você sabe exatamente o que aconteceu.**

---

## 8) Anti-padrões (coisas que NÃO fazer)

### ❌ Mexer no `01_recebido/`
**Por quê:** se o cliente questionar algo, você precisa do original intocado para comparar. Mexer ali quebra a confiança.

### ❌ Importar sem validar
**Por quê:** dado errado importado vira **muitas horas** de ajuste depois. Sempre valide antes.

### ❌ Padronizar de improviso por cliente
**Por quê:** cada cliente único = caos para você manter. **Use sempre o mesmo template.**

### ❌ Aceitar entrega parcial e depois "completar"
**Por quê:** vira ciclo infinito. Se faltar algo crítico (ex.: cronograma), pause o onboarding e cobre o cliente.

### ❌ Pular o log de importação
**Por quê:** você não vai lembrar daqui 6 meses o que aconteceu. Log sempre.

### ❌ Importar tudo de uma vez sem testar
**Por quê:** se um arquivo der erro no meio, fica difícil descobrir qual quebrou. Importe um por vez.

### ❌ Modificar templates "só pra esse cliente"
**Por quê:** quando você atualizar o template, esse cliente fica órfão. Mantenha o template estável; customizações ficam no `02_padronizado/` específico do cliente.

---

## 9) Próximos passos para automatizar

À medida que você fechar mais clientes, esse processo manual vira gargalo. Plano de evolução:

| Sprint | O que automatizar | Tempo economizado/cliente |
|---|---|---|
| **Sprint 2** (Supabase) | Botão "+ Importar CSV" em cada módulo | 2-3h |
| **Sprint 3** | Validação automática (Zod schema + preview) | 1-2h |
| **Sprint 4** | Conversor `.mpp` → `cronograma.xlsx` automático | 3-6h |
| **Sprint 5** | Conversor `.xer` (Primavera) → `cronograma.xlsx` | 3-6h |
| **Sprint 6** | OCR de FVS antigas em PDF → digitação automática | 2-4h |
| **Sprint 7** | Geocoding automático (endereço → lat/lng) na lista de obras | 30min |
| **Sprint 8** | Wizard guiado de onboarding direto na plataforma | toda a operação manual |

**Meta:** chegar em **<1 dia útil** por cliente novo até o fim do Sprint 8.

---

## Documentos relacionados

- [estrategia-organizacao.md](./estrategia-organizacao.md) — onboarding em 4 semanas (visão geral)
- [database-architecture.md](./database-architecture.md) — schema das tabelas para onde os dados vão
- [audit-planejamento-qualidade.md](./audit-planejamento-qualidade.md) — auditoria técnica dos módulos

---

> **Lembrete:** este documento é o **manual operacional**. Mantenha-o atualizado a cada cliente novo — se descobrir um caso edge novo, **adicione aqui**. Seu eu do futuro vai agradecer.
