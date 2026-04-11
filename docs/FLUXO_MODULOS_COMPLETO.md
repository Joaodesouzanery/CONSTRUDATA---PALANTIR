# Atlântico ConstruData — Fluxo Completo de Cada Módulo

> Guia operacional para implementação. Para cada módulo: fluxo do usuário, templates disponíveis, e como adaptar dados existentes do cliente.

---

## Como Usar Este Documento

1. **Identifique o módulo** que o cliente vai usar
2. **Siga o fluxo** passo a passo
3. **Baixe o template** (se disponível) e preencha com os dados do cliente
4. **Importe na plataforma** — o sistema mapeia colunas automaticamente

---

## Índice

| # | Módulo | Template | Tipo de Fluxo |
|---|--------|----------|---------------|
| 1 | [Planejamento Mestre](#1-planejamento-mestre) | `atlantico-planejamento-mestre-template.xlsx` | Sequencial (8 passos) |
| 2 | [Planejamento Trechos](#2-planejamento-trechos) | `atlantico-trechos-template.xlsx` | Sequencial (6 passos) |
| 3 | [Medição](#3-medicao) | `atlantico-medicao-template.xlsx` | Stepper (6 passos) |
| 4 | [Suprimentos](#4-suprimentos) | `atlantico-fornecedores-template.xlsx` | Pipeline (7 passos) |
| 5 | [Projetos](#5-projetos) | — | Multi-aba (6 abas) |
| 6 | [LPS / Lean](#6-lps-lean) | `atlantico-lps-atividades-template.xlsx` | Ciclo contínuo (6 passos) |
| 7 | [Quantitativos](#7-quantitativos) | `atlantico-orcamento-template.xlsx` | Sequencial (4 passos) |
| 8 | [RDO](#8-rdo) | — | Diário (4 passos) |
| 9 | [Qualidade (FVS)](#9-qualidade) | — | Por inspeção (3 passos) |
| 10 | [Mão de Obra](#10-mao-de-obra) | `atlantico-mao-de-obra-template.xlsx` | Cadastro + alocação |
| 11 | [Relatório 360](#11-relatorio-360) | — | Diário + exportação |
| 12 | [Gestão 360](#12-gestao-360) | — | Dashboard (consulta) |
| 13 | [Financeiro / EVM](#13-financeiro-evm) | — | Automático |
| 14 | [Torre de Controle](#14-torre-de-controle) | — | Dashboard (consulta) |

---

## 1. PLANEJAMENTO MESTRE

### Fluxo
```
Criar Cronograma → Estruturar WBS → Definir Marcos → Salvar Baseline → Look-ahead → Prog. Semanal → What-if → Exportar
```

### Template: `atlantico-planejamento-mestre-template.xlsx`

| Coluna | Obrigatório | Exemplo |
|--------|-------------|---------|
| WBS / Código | Recomendado | 1.2.1 |
| Nome da Atividade | **SIM** | Rede DN 200mm - Rua A |
| Data Início | Recomendado | 01/04/2026 |
| Data Fim | Recomendado | 30/06/2026 |
| Duração (dias) | Opcional | 91 |
| Progresso (%) | Opcional | 25 |
| Responsável / Equipe | Opcional | Equipe A |
| Tipo de Rede | Opcional | agua / esgoto / civil |
| Núcleo / Frente | Opcional | Vila Norte |
| Local / Rua | Opcional | Rua Principal |
| Comprimento (m) | Opcional | 450 |
| Qtd Ligações | Opcional | 12 |
| Peso / Prioridade | Opcional | 3 |
| Marco (S/N) | Opcional | N |

### Como adaptar dados do cliente
- **Se tem MS Project/Primavera:** Exporte para Excel, renomeie colunas conforme template
- **Se tem planilha própria:** Garanta coluna "Nome" e datas — o sistema detecta o resto
- **Se não tem planejamento:** Use o wizard "Criar do Zero" (3 passos na plataforma)
- O sistema auto-detecta hierarquia WBS (1.2 é pai de 1.2.1)

### Download
Na plataforma: Planejamento Mestre → tela inicial → "Baixar template padronizado (.xlsx)"

---

## 2. PLANEJAMENTO TRECHOS

### Fluxo
```
Configurar → Importar Trechos → Gerar Cronograma → Analisar (Curva S/ABC) → Acompanhar → Exportar
```

### Template: `atlantico-trechos-template.xlsx`

| Coluna | Obrigatório | Exemplo |
|--------|-------------|---------|
| Código | **SIM** | TR-001 |
| Descrição | **SIM** | Rede esgoto Rua Principal |
| Extensão (m) | **SIM** | 125.5 |
| Diâmetro (mm) | Recomendado | 200 |
| Tipo de Solo | Opcional | argiloso |
| Escoramento | Opcional | sim / não |
| Custo Unitário (R$/m) | Opcional | 350.00 |

### Como adaptar
- **Se tem planilha de trechos:** Renomeie colunas para o formato acima
- **Se tem só mapa/CAD:** Extraia coordenadas para planilha de trechos
- O sistema importa via ImportModal com mapeamento automático

---

## 3. MEDIÇÃO

### Fluxo (Stepper obrigatório)
```
Criar Boletim → Planilha Sabesp → Critérios → Subempreiteiros + Fornecedores → Conferência Auto → PDF Final
```

### Template: `atlantico-medicao-template.xlsx`

| Coluna | Obrigatório | Exemplo |
|--------|-------------|---------|
| nPreço | **SIM** | 05.01.001 |
| Descrição | **SIM** | Escavação mecânica em vala |
| Unidade | **SIM** | m³ |
| Qtd Contratada | **SIM** | 1200 |
| Qtd Medida | **SIM** | 850 |
| Valor Unitário (R$) | **SIM** | 32.50 |
| Grupo | Recomendado | 01 / 02 / 03 |

### Como adaptar
- **Se tem planilha Sabesp:** Use diretamente — as colunas já são compatíveis
- **Se tem outro formato:** Garanta nPreço + Descrição + Unidade + Quantidades
- O sistema faz auto-lookup do catálogo de critérios pelo nPreço

---

## 4. SUPRIMENTOS

### Fluxo (Pipeline)
```
Previsão → Requisição → OC/PO → Recebimento + NF → Conciliação 3-Way → Exceções → Estoque
```

### Template: `atlantico-fornecedores-template.xlsx`

| Coluna | Obrigatório | Exemplo |
|--------|-------------|---------|
| CNPJ | Recomendado | 12.345.678/0001-90 |
| Nome | **SIM** | Materiais ABC Ltda |
| Categoria | Opcional | Tubulação |
| Contato | Opcional | João Silva |
| Telefone | Opcional | (11) 99999-0000 |
| Email | Opcional | joao@abc.com |
| Condições de Pagamento | Opcional | 30/60 dias |

### Template Consolidado: `atlantico-suprimentos-consolidado-template.xlsx`

| Coluna | Exemplo |
|--------|---------|
| Código | MAT-001 |
| Descrição | Tubo PVC DN 200mm |
| Unidade | m |
| Qtd Total | 2500 |
| Qtd Pedida | 1800 |
| Saldo | 700 |
| Valor Unitário | 78.40 |
| Fornecedor | ABC Ltda |
| Status | parcial |

### Como adaptar
- **Se tem lista de fornecedores:** Use template de fornecedores
- **Se tem planilha de compras:** Use template consolidado — vira OCs automaticamente
- **Se não tem controle:** Comece pela Previsão de Demanda no módulo

---

## 5. PROJETOS

### Fluxo (Multi-aba)
```
Criar Projeto → Definir Fases → Orçamento → Acompanhar Execução → BIM 3D/4D/5D → Documentos
```

### Sem template — criação direta na plataforma
- Clique "Novo Projeto" → código, nome, gerente
- Adicione fases e marcos na aba Planejamento
- O resto se alimenta automaticamente dos outros módulos

---

## 6. LPS / LEAN

### Fluxo (Ciclo contínuo)
```
Criar Atividades → Identificar Restrições → Look-ahead → Plano Semanal → Executar → Medir PPC → (volta ao início)
```

### Template: `atlantico-lps-atividades-template.xlsx`

| Coluna | Obrigatório | Exemplo |
|--------|-------------|---------|
| Nome | **SIM** | Rede esgoto Rua A |
| Descrição | Opcional | Assentamento DN 200mm PVC |
| Responsável | Recomendado | Mestre João |
| Semana ISO | Opcional | 2026-W15 |
| Status | Opcional | planned / ready / blocked |
| Tipo de Rede | Opcional | esgoto |

### Como adaptar
- **Se já faz LPS:** Transfira atividades para o template
- **Se não faz LPS:** Use o módulo diretamente — comece criando atividades no Semáforo
- O PPC é calculado automaticamente a cada semana

---

## 7. QUANTITATIVOS

### Fluxo
```
Escolher Base (SINAPI/SEINFRA/Custom) → Montar Orçamento → Calcular BDI → Exportar
```

### Template: `atlantico-orcamento-template.xlsx`

| Coluna | Obrigatório | Exemplo |
|--------|-------------|---------|
| Código | Opcional | SINAPI-93358 |
| Descrição | **SIM** | Escavação mecânica em vala |
| Unidade | **SIM** | m³ |
| Quantidade | **SIM** | 500 |
| Custo Unitário (R$) | **SIM** | 32.50 |
| BDI (%) | Opcional | 25 |
| Categoria | Opcional | Escavação |
| Fonte | Opcional | sinapi / seinfra / manual |
| Observações | Opcional | Orçamento fornecedor X |

### Como adaptar
- **Se tem orçamento em Excel:** Renomeie colunas conforme template e importe
- **Se tem lista de materiais do fornecedor:** Preencha Descrição + Quantidade + Custo
- **Se não tem nada:** Use o wizard "Criar do Zero" com itens iniciais da base SINAPI
- O sistema aplica BDI automaticamente sobre cada item

---

## 8. RDO

### Fluxo (Diário)
```
Criar RDO → Registrar Equipes + Trechos → Fotos + Ocorrências → Fechar + PDF
```

### Sem template — registro direto na plataforma
- Cada dia gera um RDO novo
- Dados integram automaticamente com Planejamento e Qualidade

---

## 9. QUALIDADE

### Fluxo (Por inspeção)
```
Criar FVS → Preencher Checklist → Tratar NCs → Fechar
```

### Sem template — checklist digital na plataforma
- FVS vinculada ao trecho/serviço
- NC aberta bloqueia fechamento do RDO

---

## 10. MÃO DE OBRA

### Fluxo
```
Cadastrar Funcionários → Alocar por Frente → Acompanhar Produtividade
```

### Template: `atlantico-mao-de-obra-template.xlsx`

| Coluna | Obrigatório | Exemplo |
|--------|-------------|---------|
| Nome | **SIM** | João Silva |
| Função | **SIM** | Encanador |
| CPF | Recomendado | ***.***.***-00 |
| Equipe | Opcional | Equipe A |
| Status | Opcional | ativo |
| Taxa (R$/h) | Opcional | 35.00 |
| Departamento | Opcional | Produção |
| Email | Opcional | joao@obra.com |
| Telefone | Opcional | (11) 99999 |
| Data Admissão | Opcional | 01/01/2026 |
| Tipo Contrato | Opcional | CLT |
| Frente de Obra | Opcional | Vila Norte |

---

## 11. RELATÓRIO 360

### Fluxo (Diário + Exportação)
```
Selecionar Data → Kanban de Atividades → Equipes/Recursos → Fotos → PDF (período + áreas)
```

### Sem template — dados vêm do registro diário
- Exporta PDF customizável: selecione período e áreas (11 checkboxes)

---

## 12. GESTÃO 360

### Dashboard de consulta
- CPI/SPI em tempo real
- Curva S de progresso
- Alertas integrados
- Dados alimentados automaticamente pelos outros módulos

---

## 13. FINANCEIRO / EVM

### Automático
- Earned Value Management calculado em tempo real
- Alimentado por: Planejamento + RDO + Medição + Suprimentos
- KPIs: CPI, SPI, EAC, ETC, VAC, TCPI

---

## 14. TORRE DE CONTROLE

### Dashboard de consulta
- War room multiportfólio
- Drill-down: portfólio → projeto → frente → atividade
- Alertas em tempo real
- Matriz RAG

---

## Como Adaptar Dados Existentes do Cliente

### Cenário 1: Cliente tem planilhas Excel
1. Identifique qual módulo vai usar
2. Baixe o template correspondente
3. Copie os dados do cliente para as colunas do template
4. Importe na plataforma — mapeamento automático

### Cenário 2: Cliente tem MS Project / Primavera
1. Exporte para Excel (.xlsx)
2. Use o template de Planejamento Mestre
3. Mapeie: Task Name → Nome, Start → Início, Finish → Fim, WBS → Código
4. Importe na plataforma

### Cenário 3: Cliente não tem nada digital
1. Use os wizards "Criar do Zero" em cada módulo
2. Preencha diretamente na plataforma
3. Os templates servem como guia de quais informações coletar

### Cenário 4: Cliente tem sistema legado
1. Exporte dados do sistema antigo para Excel
2. Use os templates como referência de formato
3. Renomeie colunas para match com o template
4. Importe — o sistema aceita variações de nome de coluna (aliases)

---

## Formatos Aceitos

Todos os módulos aceitam:
- `.xlsx` (Excel moderno — recomendado)
- `.xls` (Excel legado)
- `.csv` (separado por vírgula, UTF-8)

Limite: 5MB por arquivo, 5.000 linhas por importação.

---

## Suporte

- Template não importou? Verifique se a coluna obrigatória "Nome/Descrição" existe
- Números com vírgula? O sistema aceita formato BR (1.234,56) e US (1,234.56)
- Datas? Aceita dd/MM/yyyy, yyyy-MM-dd, e números seriais do Excel
