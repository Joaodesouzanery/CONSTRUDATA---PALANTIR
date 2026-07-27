# Financeiro (EVM · DRE · Fluxo · Pagamentos · Distribuição)

> **Rota(s):** `/app/evm` — `/app/financeiro` redireciona para `/app/evm` (`src/App.tsx:150` e `src/App.tsx:152`) · **Store(s):** `evmStore`, `financeiroStore`, `financeiroTitulosStore`, `manejoFinanceiroStore` · **Grupo na sidebar:** **PLANEJAMENTO** → item "Financeiro" (ícone `TrendingUp`, `src/components/shared/Sidebar.tsx:50`)

---

## O que é / problema que resolve

O módulo Financeiro é o painel único de **gestão financeira do contrato de obra**, unindo dois mundos que normalmente ficam em planilhas separadas: (1) a contabilidade gerencial da execução — entradas, saídas, DRE, fluxo de caixa, contas a pagar/receber — e (2) o controle de desempenho por **EVM (Earned Value Management / Gerenciamento do Valor Agregado)** com CPI, SPI, curva S, BAC/EAC e cenários de estouro. O cabeçalho da tela se identifica como "Financeiro — Gestão Financeira do Contrato · EVM" (`src/features/evm/components/EvmHeader.tsx:75-78`).

A tela é montada pelo `EvmPage` (`src/features/evm/index.tsx:72`), que organiza tudo em **7 abas** de topo (`EvmHeader.tsx:15-23`). Várias abas usam um `SubTabHost` interno para agrupar painéis legados como sub-abas — o cabeçalho do arquivo deixa claro que a reorganização foi só de navegação: "nenhum store/tabela foi alterado, só a navegação" (`index.tsx:1-7`).

O problema concreto que resolve: substituir o vaivém de planilhas de medição, folha, notas fiscais e controle de contrato por **um dado único, multi-tenant e em tempo real**, no qual o custo realizado nasce automaticamente do chão de obra (um RDO finalizado lança materiais + mão de obra como saídas via `financeiroStore.syncRdoToFinanceiro`, `financeiroStore.ts:179-209`) e a baixa de um título de pagamento vira automaticamente um lançamento que aparece no Fluxo de Caixa e na DRE (`financeiroTitulosStore.ts:180-200`).

## Para quem (papéis / persona)

- **Gerente / Diretor / Owner de contrato** — leem os KPIs de saúde (semáforo azul/amarelo/vermelho), CPI/SPI, cenários de EAC e o resultado por obra para decidir intervenções.
- **Planejador / Engenheiro de planejamento** — mantêm a matriz de medição ponderada, o plano de contas orçado×real e as autorizações orçamentárias (Manejo).
- **Administrativo / Financeiro de obra** — operam contas a pagar/receber, dão baixa em títulos, lançam entradas/saídas e configuram a DRE.
- As políticas RLS de escrita nas tabelas de Manejo, Títulos e Impostos restringem `insert`/`update` aos papéis `planejador`, `engenheiro`, `gerente`, `diretor`, `owner` (`supabase/migrations/20260612120000_financeiro_manejo.sql:61-68`, `20260723120000_financeiro_titulos.sql:27-36`). [código]

---

## Funcionalidades detalhadas

O `renderPanel` (`index.tsx:27-70`) mapeia cada aba. Cabeçalho fixo (`EvmHeader`) exibe 5 KPI cards — **CPI**, **SPI**, **Orçamento planejado (BAC)**, **EAC (R$)** e **VAC (R$)** (`EvmHeader.tsx:103-107`) — mais botões **Carregar Demo** (`loadDemoData`) e **Recalcular** (`recalculateMetrics`) (`EvmHeader.tsx:84-97`) e um `SyncBadge`.

### Aba 1 — Visão Geral (`SubTabHost` com 3 sub-abas, `index.tsx:31-35`)

**Análise (`VisaoGeralPanel`)** — análise financeira derivada de `financeiroStore.entries`, sem alterar dado (`VisaoGeralPanel.tsx:1-6`). Barra de filtros avançados (`FinanceiroFilterBar`): presets "Este mês / Este ano / 12 meses / Tudo", intervalo livre de datas, obra, categoria e tipo (entrada/saída/ambos) (`FinanceiroFilterBar.tsx:21-108`). Entrega 4 KPIs (Entradas, Saídas, Resultado, Margem = resultado/entradas·100, `VisaoGeralPanel.tsx:31-51`), gráfico de barras Receita×Despesa mensal, linha SVG de saldo acumulado, quebra por categoria (entrada e saída), "Resultado por obra" (barras por obra via `aggregateObra`) e tabela de resumo mensal com saldo acumulado (`VisaoGeralPanel.tsx:60-133`).

**Dashboard EVM (`DashboardPanel`)** — semáforo de saúde (azul "Obra Eficiente — IDP>1 e IDC>1", amarelo "Atenção", vermelho "Risco Crítico", `DashboardPanel.tsx:44-66`), **Curva S Multidimensional** com 4 linhas (PV — Planejado Financeiro, AC — Físico Realizado, EV — Valor Agregado, AC — Custo Real) a partir de `sCurveData` (`DashboardPanel.tsx:18-28`), painel de **Análise de Causa Raiz** (barra empilhada de desvio por pilar, só aparece quando CPI<1, `DashboardPanel.tsx:242-299`), 3 cards de **Cenários de EAC** (Otimista/Tendência/Pessimista com % de overshoot, `DashboardPanel.tsx:301-354`), tabela de **Estoque Imobilizado Crítico** (`stockAlerts`, `DashboardPanel.tsx:356-419`) e alert cards de custo/prazo.

**Comparativo (`ComparativoNucleosPanel`)** — consolidado por núcleo financeiro. Soma PV, EV, AC e orçamento de todos os núcleos ativos e só então recalcula CPI/SPI consolidados (`ComparativoNucleosPanel.tsx:35-43`); tabela por núcleo com Orçamento, PV, EV, AC, CPI, SPI e EAC (`ComparativoNucleosPanel.tsx:74-88`).

### Aba 2 — Por Obra (`PorObraPanel`, painel único)

Cruza as obras cadastradas no **Torre de Controle** (`torreDeControleStore.sites`) com os lançamentos do Financeiro (`PorObraPanel.tsx:23-50`). Para cada obra: orçamento (soma de `budgetLines[].amount`), entradas, saídas e saldo dos lançamentos marcados com aquela obra; lançamentos sem obra caem em "Não atribuído" (`PorObraPanel.tsx:38-48`). Cards de total (Orçamento Torre, Entradas, Saídas, Saldo) e tabela com coluna "Disp. vs orç." = orçamento − saídas (`PorObraPanel.tsx:117-131`).

### Aba 3 — Resultados (`SubTabHost` com 4 sub-abas, `index.tsx:41-46`)

**DRE (`DrePanel`)** — Demonstração de Resultados simplificada, auto-calculada dos lançamentos, com **colunas por mês + Total** (`DrePanel.tsx:1-6, 90-96`). Respeita filtro de período e obra, mas ignora tipo/categoria porque precisa de receitas e despesas juntas (`DrePanel.tsx:42-47`). Linhas: Receita Bruta, (−)Deduções/Impostos, (=)Receita Líquida, (−)Custos Diretos, (=)Lucro Bruto, (−)Despesas Adm, (−)Outras Despesas, (=)Resultado Líquido, além de Margem bruta e Margem líquida (`DrePanel.tsx:23-32, 140-149`). Cada linha expande para o detalhamento por categoria (`DrePanel.tsx:126-135`). Botão **Configurar** abre o `DreConfigPanel`: alíquota de deduções/impostos sobre a receita + remapeamento categoria→linha da DRE (persistido em `financeiroStore.dreConfig`, `DrePanel.tsx:168-231`).

**Entradas / Saídas (`EntradasPanel` / `SaidasPanel`, mesmo componente `LancamentosPanel`)** — CRUD de lançamentos. Filtra pelo tipo, pela obra ativa (`activeObraStore`) e por categoria; mostra total e resumo clicável por categoria (`EntradasSaidasPanel.tsx:24-69`). Modal cria/edita com descrição, valor, data, categoria, referência e obra (`EntradasSaidasPanel.tsx:136-209`). Categorias de entrada: Medição, Adiantamento, Reajuste, Outro; de saída: Materiais, Mão de Obra, Equipamentos, Subempreiteiros, Administrativo, Outro (`EntradasSaidasPanel.tsx:11-19`).

**Fluxo de Caixa (`FluxoCaixaPanel`)** — fluxo mensal **realizado × previsto × saldo projetado** (`FluxoCaixaPanel.tsx:1-8`). Realizado vem dos lançamentos; previsto vem das obrigações **ativas com saldo restante** do Manejo Financeiro, distribuídas do mês atual até o fim do período de execução (obrigação sem fim definido → espalhada em 12 meses; obrigação vencida → tudo no mês atual) (`FluxoCaixaPanel.tsx:57-73`). Como as obrigações são da empresa toda (sem obra), a previsão só aparece quando nenhuma obra está filtrada (`FluxoCaixaPanel.tsx:51`). Colunas: Entradas, Saídas, Resultado, Saldo realizado, Saída prevista, Saldo projetado; linhas futuras marcadas "prev" (`FluxoCaixaPanel.tsx:130-156`). A entrada prevista de títulos ainda é `0` (comentário "Fase C", `FluxoCaixaPanel.tsx:92`). [código]

### Aba 4 — Pagamentos e Cobranças (`PagamentosPanel`, painel único)

Contas a pagar / a receber (títulos), do `financeiroTitulosStore` (`PagamentosPanel.tsx:1-6`). 4 stat cards sobre os **pendentes**: A pagar, A receber, Vencidos (contagem+valor), A vencer em 7 dias (`PagamentosPanel.tsx:76-94`). Filtros: tipo, status (com "vencido" derivado = pendente com vencimento < hoje, `PagamentosPanel.tsx:26-31`), obra, intervalo de vencimento e busca por parceiro/descrição/nº doc. Tabela com tipo, descrição, parceiro, obra, vencimento, parcela, valor e status; ações: **Baixar** (gera lançamento), **Desfazer baixa**, editar, excluir (`PagamentosPanel.tsx:168-178`). O modal de título permite gerar **parcelas mensais** (até 60) — o valor é dividido e a última parcela absorve o arredondamento (`PagamentosPanel.tsx:257-273`), e escolher a categoria do lançamento que a baixa vai gerar (ou "Automática", `PagamentosPanel.tsx:323-329`).

### Aba 5 — Medição Ponderada (`SubTabHost` com 2 sub-abas, `index.tsx:51-55`)

**Medição (`MedicaoPonderadaPanel`)** — matriz de medição ponderada (CRUD de `measurements` no `evmStore`). Colunas editáveis inline: Peso Financeiro, Peso Duração, Peso Econômico, Peso Específico (em %), mais o **Score Composto** calculado (`MedicaoPonderadaPanel.tsx:77-82, 239-243`). Clicar numa atividade abre drawer com as **atividades do Planejamento vinculadas** (busca por `activityId`, `workPackageId` ou nome no `planejamentoMestreStore`, `MedicaoPonderadaPanel.tsx:84-90, 259-288`).

**Índices (`IndicesPanel`)** — tabela de **Desagregação de Custo por Pillar** (Orçado, Real, Desvio, % do desvio total, `IndicesPanel.tsx:148-229`) e tabela de **Índices de Desempenho IDC(CPI)/IDP(SPI)** por atividade, com semáforo de saúde, cores por faixa (≥1,00 verde; 0,90–0,99 amarelo; <0,90 vermelho), interpretação textual, sparklines e linha "Geral do Projeto" (`IndicesPanel.tsx:19-53, 231-404`). Observação do código: os CPI/SPI por atividade e as sparklines são **sintéticos/demonstrativos**, derivados do score composto (`IndicesPanel.tsx:96-106, 128-142`). [código]

### Aba 6 — Plano de Contas (`PlanoContasPanel`, painel único)

Plano de contas **orçado × real** (`PlanoContasPanel.tsx:1-7`). Filtro de obra no topo. Resumo geral: Receita orçada×real, Custo orçado×real, Margem orçada, Resultado real (`PlanoContasPanel.tsx:179-184`). Seção **Receitas** (orçado = valor de contrato da obra `site.orcamentoBRL`; real = soma das entradas, `PlanoContasPanel.tsx:113-121`) e **4 pilares de custo** — Material, Equipamentos, Mão de Obra (soma `mao_de_obra`+`subempreiteiros`), Impostos/Indiretos (soma `administrativo`+`outro`) (`PlanoContasPanel.tsx:27-32`). Orçado de cada pilar vem dos `costAccounts` do `evmStore`; real vem dos lançamentos por categoria; cada seção mostra a barra de variância e um **DreBadge** ligando o pilar à linha da DRE (`PlanoContasPanel.tsx:69-75, 220-248`). CRUD de itens orçados por pilar (descrição, custo unitário, quantidade, obra; total = unitário×qtd). Seção final **Impostos Notas Fiscais** — tabela 100% editável, pré-populada na primeira visita via `seedImpostosNF` (ISS, PIS, COFINS, INSS Retido, CSLL, IRRF, Retenção Técnica, `evmStore.ts:641-650`; UI em `PlanoContasPanel.tsx:392-511`).

### Aba 7 — Distribuição (`SubTabHost` com 3 sub-abas, `index.tsx:61-66`)

**Distribuição (`DistribuicaoPanel`)** — distribui um orçamento (opcionalmente por obra) entre funcionários, terceiros e tarefas, com cálculo ao vivo de alocado, restante, % do orçamento, total por pessoa e totais separados Funcionários×Terceiros (`DistribuicaoPanel.tsx:52-64`). Puxa funcionários do `maoDeObraStore`, terceiros do `contractorStore` e tarefas do `planejamentoMestreStore` (autocomplete via `datalist`). Botões **Salvar distribuição** (`upsertDistribuicao`) e **Lançar como saídas** — cada linha vira um `FinanceiroEntry` de saída, categoria `mao_de_obra` (funcionário) ou `subempreiteiros` (terceiro) (`DistribuicaoPanel.tsx:97-112`).

**Manejo Financeiro (`ManejoFinanceiroPanel`)** — inbox de **obrigações de contratos** (`manejoFinanceiroStore.contratos`). 3 zonas: filtros (status, faixa de valor restante, dias após fim de execução, motivo de sinalização), estatísticas + mini-gráfico de desobrigado por ano, e tabela de contratos com drawer de detalhes e anexos (`ManejoFinanceiroPanel.tsx:1-4, 42-115`). Contratos podem ser sinalizados pelo modelo (motivos: período encerrado, sem movimentação, saldo residual) e "desobrigados" (`manejoFinanceiroStore.ts:147-149`). São esses contratos que alimentam a coluna "previsto" do Fluxo de Caixa.

**Manejo Orçamento (`ManejoOrcamentoPanel`)** — gestão de **autorizações orçamentárias** em 4 colunas/categorias: Códigos de Fundo, Códigos de Interesse Especial, Elementos de Orçamento e Autorizações de Custo (`ManejoOrcamentoPanel.tsx:17-22`). Cada card tem valor total, valor alocado e **vínculos** para itens de outras categorias (grafo de alocação); totais por categoria mostram alocado e não alocado (`ManejoOrcamentoPanel.tsx:66-142`). CRUD completo com modal; excluir um item também limpa os vínculos que apontavam para ele (`manejoFinanceiroStore.ts:173-184`).

---

## Dados que gera

Tabelas Supabase (todas com `organization_id`, `created_at`, `updated_at`, `deleted_at` e RLS por tenant):

| Entidade | Tabela | Migração | Campos-chave |
|---|---|---|---|
| Lançamentos (entradas/saídas) | `financeiro_entries` | `20260610120000_financeiro_tables.sql:5-20` | `tipo` ('entrada'/'saida'), `descricao`, `valor`, `data`, `categoria`, `referencia`, `obra_id`, `payload` jsonb |
| Distribuições de orçamento | `financeiro_distribuicoes` | `20260610120000_financeiro_tables.sql:59-70` | `obra_id`, `titulo`, `orcamento`, `payload` (linhas) |
| Contratos/obrigações (Manejo Fin.) | `financeiro_contratos` | `20260612120000_financeiro_manejo.sql:11-19` | `payload` jsonb (título, valorTotalObrigado, valorRestante, status, motivoSinalizacao, anexos) |
| Autorizações orçamentárias (Manejo Orç.) | `financeiro_orcamentos` | `20260612120000_financeiro_manejo.sql:24-32` | `payload` jsonb (categoria, codigo, valorTotal, valorAlocado, vinculos) |
| Impostos de NF (Plano de Contas) | `financeiro_impostos_nf` | `20260612120000_financeiro_manejo.sql:37-45` | `payload` jsonb (nome, aliquota, observacao) |
| Contas a pagar/receber (Pagamentos) | `financeiro_titulos` | `20260723120000_financeiro_titulos.sql:7-15` | `payload` jsonb (tipo, valor, vencimento, parceiro, parcela, status, entryId) |
| Work packages (EVM) | `evm_work_packages` | `0032_sprint6_final.sql:10-23` | `project_id`, `code`, `name`, `total_budget_brl`, `is_template`, `payload` |
| Contas de custo (EVM / Plano de Contas orçado) | `evm_cost_accounts` | `0032_sprint6_final.sql:29-41` | `work_package_id`, `activity_id`, `pillar`, `total_cost_brl`, `payload` |
| Medições ponderadas (EVM) | `evm_measurements` | `0032_sprint6_final.sql:48-59` | `work_package_id`, `activity_id`, `composite_score`, `payload` |

Tipos-fonte no cliente: `FinanceiroEntry` (`src/types/index.ts:2662-2674`, inclui `sourceRdoId` para idempotência RDO→Financeiro), `FinanceiroTitulo` (`:2728-2746`, com `entryId` para rastrear/estornar a baixa), `ManejoContrato` (`:2629-2642`), `ManejoOrcamentoItem` (`:2648-2657`), `Distribuicao`/`DistribuicaoLinha` (`:2704-2721`), `DreConfig` (`:2696-2701`).

Dados **locais sem migração**: `dreConfig` (alíquota + mapeamento da DRE) é persistido só no `localStorage` (`financeiroStore.ts:99-100, 329-336`); os **núcleos financeiros**, o **contrato demo** e a **curva S** vivem só no estado persistido do `evmStore` (`evmStore.ts:895-906`) — não têm tabela própria e são alimentados por `loadDemoData` (`evmStore.ts:827-843`). [inferido] a camada de núcleos é primariamente demonstrativa; os dados EVM realmente sincronizados são work packages, cost accounts e measurements.

---

## Cálculos, KPIs e regras de negócio

### EVM por portfólio de núcleos — `computeFinancialPortfolio` (`evmStore.ts:358-386`)

- **BAC** = Σ `bacAlocado` dos núcleos ativos.
- **PV** = Σ `pv` do último período EVM de cada núcleo.
- **EV** = Σ `evReconhecido` dos work packages, onde `evReconhecido = bacWP × (progFisico/100) × pesoFinanceiro` (`evmStore.ts:177`).
- **AC** = Σ `valor` das saídas dos núcleos.
- **CPI** = EV/AC · **SPI** = EV/PV · **CV** = EV−AC · **SV** = EV−PV.
- **IDC ajustado (idc)** = `max(0.35, (CPI||0.8) × max(0.5, ppcMédio))` — usa o PPC (Percentual do Planejado Concluído / Last Planner) como fator de eficiência operacional.
- **EAC** = BAC/idc · **ETC** = EAC−AC · **VAC** = BAC−EAC.
- **TCPI** = (BAC−EV)/(BAC−AC).
- **costBreakdown** por percentuais fixos (material 45%, equipamento 25%, mão de obra 25%, impostos indiretos 5%).
- **eacScenarios**: otimista = BAC/max(0.6, idc·1.12); tendência = EAC; pessimista = BAC/max(0.35, idc·0.86).
- **healthStatus**: azul se CPI≥1 e SPI≥1; vermelho se CPI<0.9 ou SPI<0.9; senão amarelo.

### EVM por contas de custo — fallback de `recalculateMetrics` (`evmStore.ts:695-823`)

Se não há núcleos, calcula a partir dos `costAccounts`: BAC = Σ `totalCostBRL`; AC e orçado por pilar; escala PV/EV pela razão do novo BAC; EAC = BAC/CPI; pessimista = (BAC/CPI)·1.15; `pillarDeviations` (orçado×real por pilar) e `stockAlerts` importados do `suprimentosStore` para itens com `qtdDisponivel > estoqueMinimo × 2`, calculando quantidade imobilizada e custo imobilizado (`evmStore.ts:779-798`).

### Score composto de medição — `computeCompositeScore` (`evmStore.ts:144-151`)

`score = pesoFinanceiro·0.3 + pesoDuração·0.25 + pesoEconômico·0.3 + pesoEspecífico·0.15` (mesma fórmula para work packages, `evmStore.ts:153-155`).

### DRE simplificada — `computeDre` (`src/features/financeiro/lib/financeiroCalc.ts:209-253`)

Mapeia cada categoria para uma linha (default em `DEFAULT_MAP`, `financeiroCalc.ts:69-82`): entradas → `receita_bruta`; materiais/MO/equipamentos/subempreiteiros → `custo`; administrativo → `despesa_adm`; saída "outro" → `despesa_outra`. Deduções em 3 modos: `lancada` (soma dos lançamentos mapeados como dedução), `pct` (`deducaoPct` sobre a receita bruta) ou `auto` (`lancada` se houver dedução, senão `pct`). Depois: `receitaLiquida = receitaBruta − deduções`; `lucroBruto = receitaLiquida − custos`; `resultado = lucroBruto − despesaAdm − despesaOutra`; `margemBruta = lucroBruto/receitaBruta·100`; `margemLiquida = resultado/receitaBruta·100`. As colunas mensais usam um **modo de dedução fixo** para reconciliarem exatamente com o Total (`financeiroCalc.ts:199-208`, `DrePanel.tsx:50-59`).

### Fluxo de caixa projetado (`FluxoCaixaPanel.tsx:75-100`)

`saldoProjetado` acumulado = saldo realizado − saídas previstas (obrigações ativas com saldo restante distribuídas por mês via `spreadValue`, `financeiroCalc.ts:172-178`). Rodapé documenta a fórmula (`FluxoCaixaPanel.tsx:162-168`).

### Regras de negócio-chave

- **Baixa de título** gera um lançamento (`saida` para "pagar", `entrada` para "receber") com `respectObra:true` (usa a obra do título, não a ativa) e guarda `entryId` para estorno; **desfazer baixa** remove o lançamento (`financeiroTitulosStore.ts:180-207`).
- **Editar um título já pago** propaga valor/categoria/descrição/obra/nº doc para o lançamento vinculado (`financeiroTitulosStore.ts:120-132`).
- **Feed RDO→Financeiro é idempotente**: o id do lançamento é um UUID determinístico `seededUuid('rdo-fin:{rdoId}:{categoria}')`, então re-finalizar substitui via upsert em vez de duplicar; rascunho/exclusão remove (`financeiroStore.ts:21-34, 179-209`). Receita fica na Medição, não é duplicada aqui.

---

## Integrações — a "camada única"

**O que CONSOME de outros módulos:**
- **RDO → Financeiro (custos realizados):** ao finalizar/editar um RDO, o `rdoStore` chama `syncRdoToFinanceiro`, lançando materiais (Compizzo usa `compizzo.materiais`; regular usa `rdo.materials`) e mão de obra (custo/dia por funcionário presente, via `custoDiaWorker`) como saídas (`store/rdoStore.ts:323, 369` → `financeiroStore.ts:179-209`); excluir RDO chama `removeRdoEntries` (`rdoStore.ts:390`).
- **Torre de Controle:** obras (`sites`, `budgetLines`, `orcamentoBRL`) alimentam Por Obra, Plano de Contas (orçado de receita) e os seletores de obra.
- **Mão de Obra / Contractors / Planejamento Mestre:** listas de beneficiários e tarefas na Distribuição, e atividades vinculadas na Medição Ponderada.
- **Suprimentos:** alertas de estoque imobilizado no Dashboard (`evmStore.ts:779-798`).
- **Manejo Financeiro → Fluxo de Caixa:** obrigações ativas viram a coluna "previsto".

**O que ALIMENTA outros módulos / o servidor:**
- **Baixa de título** e **Lançar como saídas** (Distribuição) escrevem em `financeiro_entries`, refletindo em Fluxo, DRE, Por Obra e Plano de Contas — dado único, sem redigitar.
- **PO fechada → EVM (custo real):** o trigger de servidor `sync_po_to_evm` insere um `evm_cost_accounts` (pilar `material`, `payload.source='po_auto'`, idempotente por `po_id`) quando uma purchase order vai para `closed` (`supabase/migrations/0035_cross_module_triggers.sql:69-109`).

**eventBus (`src/lib/eventBus.ts`):** o `evmStore` escuta `po.closed` e `realtime.row_changed` (quando muda `evm_cost_accounts`/`evm_work_packages`), fazendo `pull()` + `recalculateMetrics()` para refletir o novo AC (`evmStore.ts:922-935`). O RDO emite `rdo.finalized`/`rdo.closed` (`rdoStore.ts:365`) — o feed de custo em si é via chamada direta `syncRdoToFinanceiro` (não pelo bus).

**Realtime (`src/lib/realtime.ts`):** o canal por organização observa, entre as tabelas deste módulo, `evm_work_packages` e `evm_cost_accounts` (`realtime.ts:51-52`), com coalescing de 350 ms para não re-puxar em rajada. [inferido] as tabelas puramente locais-first deste módulo — `financeiro_entries`, `financeiro_titulos`, `financeiro_contratos`, `financeiro_orcamentos` — **não** estão na lista `WATCHED_TABLES`, então sua propagação entre dispositivos depende do `pull()` (montagem do painel / reconexão), não de push instantâneo.

**RPC:** `recompute_project_kpis(project_id)` consolida BAC (dos work packages), AC (cost accounts), % de progresso e restrições/NCs abertas num snapshot de saúde (`0035_cross_module_triggers.sql:213-287`). [inferido] disponível como função callable, ainda não amarrada ao painel.

---

## Eficiência gerada

- **Fim de planilhas paralelas de custo:** o custo realizado de materiais e mão de obra **nasce do RDO** finalizado, sem redigitação — o mesmo dado alimenta DRE, Fluxo, Por Obra e Plano de Contas [código: `financeiroStore.ts:179-209`]. [inferido] elimina a reconciliação manual "diário de obra × contas".
- **Um clique fecha o ciclo contas→caixa:** a baixa de um título vira lançamento e aparece imediatamente no Fluxo e na DRE, mantendo título e movimento em sincronia e permitindo estorno rastreável (`entryId`) [código: `financeiroTitulosStore.ts:180-207`].
- **DRE e EVM automáticos:** DRE mensal, curva S, CPI/SPI, EAC e cenários de estouro são recalculados dos mesmos lançamentos/contas — [inferido] substitui modelos de EVM em Excel e dá leitura de saúde em tempo quase real.
- **Rastreabilidade e dado único multi-tenant:** idempotência determinística (RDO→Financeiro) e upsert por id evitam duplicidade mesmo entre dispositivos; RLS garante que cada organização só vê o seu (`financeiroStore.ts:21-34`).
- **Previsão de caixa a partir de obrigações reais:** o Fluxo projeta o saldo usando os contratos em aberto do Manejo, sem planilha de projeção separada (`FluxoCaixaPanel.tsx:57-100`). [inferido]

---

## Como sincroniza

**Local-first com fila de operações.** Todos os 4 stores usam o middleware `persist` do Zustand (chaves `cdata-evm`, `cdata-financeiro`, `cdata-financeiro-titulos`, `cdata-manejo-financeiro`) e o mesmo padrão `storeSync`: cada CRUD atualiza o estado local, enfileira uma `PendingOp` (`makeOp`) e chama `flush()` (`flushQueue`); `pull()` traz o servidor via `pullTable`, **sem sobrescrever tabela que ainda tem op pendente** (`financeiroStore.ts:314-323`, `evmStore.ts:878-891`).

**Realtime seletivo.** Somente `evm_work_packages` e `evm_cost_accounts` estão no canal Realtime; o `evmStore` reage a `realtime.row_changed`/`po.closed` re-puxando e recalculando (`evmStore.ts:922-935`). As demais tabelas do módulo são local-first e reconciliam no `pull()` (montagem/reconexão). [inferido]

**RLS / multi-tenant.** Todas as tabelas filtram por `organization_id = public.user_org()`. `financeiro_entries`/`financeiro_distribuicoes` permitem delete físico (`20260610120000_financeiro_tables.sql:52-54, 99-101`); já `financeiro_contratos`, `financeiro_orcamentos`, `financeiro_impostos_nf` e `financeiro_titulos` usam **soft delete** (update de `deleted_at`) e têm o DELETE bloqueado por policy, com insert/update restritos a papéis via `has_role` (`20260612120000_financeiro_manejo.sql:55-104`, `20260723120000_financeiro_titulos.sql:20-39`). Cada store faz `ensureTenantScope(organizationId)` — ao trocar de organização, limpa os dados locais para não vazar entre tenants (`financeiroStore.ts:277-289`, `manejoFinanceiroStore.ts:198-205`).

**Offline.** `flush()` marca `syncStatus:'offline'` quando `navigator.onLine` é falso e re-tenta no evento `online` da janela (`financeiroStore.ts:296-345`, presente nos 4 stores). Ops erradas incrementam `retries` e permanecem na fila.
