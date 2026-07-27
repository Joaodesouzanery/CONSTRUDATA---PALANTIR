# Suprimentos & Estoque

> **Rota(s):** `/app/suprimentos` (`src/App.tsx:135`) · **Store(s):** `useSuprimentosStore` (`src/store/suprimentosStore.ts`, chave de persistência `cdata-suprimentos` em `src/store/suprimentosStore.ts:1571`) · **Grupo na sidebar:** **GESTÃO** (`src/components/shared/Sidebar.tsx:40`, ícone `PackageSearch`)

## O que é / problema que resolve

Módulo que cobre toda a cadeia de suprimentos e o estoque físico da obra: da demanda de material até a compra, o recebimento, a conferência fiscal e a baixa no almoxarifado. Ele centraliza quatro grandes frentes em uma única página com "section switcher" (`src/features/suprimentos/index.tsx:98-132`): **Fluxo da Obra** (operação de compras + estoque), **Análises e Alertas** (materiais, fornecedores, semáforo de prontidão, what-if), **Importação / Transição** (planilhas consolidadas de saneamento — Resumo/Trechos/Materiais Pendentes) e **Cadeia de Suprimentos** (torre de controle logística com mapa, riscos e planos).

O problema concreto que ataca é a fragmentação típica de compras em construção civil/saneamento: pedido de compra numa planilha, recebimento num caderno, nota fiscal no financeiro, e o estoque de campo sem controle. Aqui, a **conferência tripla (three-way match)** entre Ordem de Compra (OC) × Recebimento (RC) × Nota Fiscal (NF) é automática (`src/store/suprimentosStore.ts:73-139`), o estoque é dado único cross-usuário/cross-obra, e a baixa de material acontece sozinha quando o RDO de campo é finalizado (trigger `trg_rdo_to_estoque`, migração `20260625120000`).

O módulo também é o destino da "camada única de demanda": a aba **Inteligência** cruza planejamento, LPS/lookahead, planilhas consolidadas, RDO, quantitativos, estoque e contratos-guarda-chuva para recomendar o que comprar, quanto e quando (`src/features/suprimentos/components/InteligenciaSuprimentosPanel.tsx:283-333`).

## Para quem (papéis / persona)

- **Comprador / Suprimentos:** cria OCs, registra recebimentos e notas, resolve exceções da conferência tripla, mantém contratos-guarda-chuva e fornecedores.
- **Almoxarife / Encarregado de campo:** cadastra materiais, movimenta entradas/saídas, controla estoque mínimo por frente/depósito.
- **Engenheiro / Gestor de obra:** acompanha o "Fluxo completo de Suprimentos" (dashboard), semáforo de prontidão por atividade LPS, previsão de demanda e riscos da cadeia.
- **Planejador:** alimenta requisições a partir do orçamento (Quantitativos) e das planilhas consolidadas.

As políticas RLS de escrita exigem papel em `['comprador','engenheiro','gerente','diretor','owner']` para inserir depósitos, itens e movimentações (`supabase/migrations/20260514090000_suprimentos_almoxarifado.sql:89-96`). A baixa via RDO e a baixa manual têm policies próprias que dispensam papel de compras (autorizadas pelo ato de finalizar o RDO / movimentar), ver `sup_est_mov_insert_rdo` (`supabase/migrations/20260625120000_rdo_estoque_integration.sql:26-33`) e `sup_est_mov_insert_manual` (`supabase/migrations/20260628130000_baixa_estoque_atomica.sql:59-66`).

## Funcionalidades detalhadas

A navegação tem 4 seções e cada uma expõe abas próprias (`src/features/suprimentos/components/SuprimentosHeader.tsx:21-42`). O `SuprimentosHeader` ainda renderiza uma faixa de 4 KPIs que muda conforme a seção ativa (`SuprimentosHeader.tsx:90-115`).

### Seção "Fluxo da Obra" (`section: 'suprimentos'`)

- **Dashboard / Fluxo (`fluxo`)** — `FluxoGestorSuprimentosPanel`. Visão de jornada em 8 etapas clicáveis (Inteligência de Demanda → Lista/BOM → Requisições → Conciliação/Exceções → Contratos/Fornecedores → Estoque → Semáforo → Cadeia) que navegam para a aba correspondente (`FluxoGestorSuprimentosPanel.tsx:10-19`). KPIs: ordens de compra, exceções abertas, itens em ruptura/baixo estoque (`qtdDisponivel <= estoqueMinimo`), reservas LPS e alertas da cadeia (`FluxoGestorSuprimentosPanel.tsx:37-56`).
- **Estoque / Almoxarifado (`almoxarifado`)** — `AlmoxarifadoPanel`. É o núcleo do controle de estoque:
  - CRUD de **frentes/depósitos** (`addDeposito`/`updateDeposito`/`removeDeposito`) com cartões de estatística por frente: nº de itens, itens baixos e valor (`AlmoxarifadoPanel.tsx:195-200`, `587-619`).
  - CRUD de **itens de estoque** com formulário rico: material, categoria, unidade, quantidade, estoque mínimo, valor unitário/total, fornecedor, código de referência e data do último pedido (`AlmoxarifadoPanel.tsx:715-729`).
  - **Embalagem como facilitador** (`AlmoxarifadoPanel.tsx:731-763`): informa "10 caixas × 96 un = 960 un" e o painel reconcilia numa conta só — deriva quantidade em unidades-base, valor unitário e valor por embalagem a partir do valor total da nota (funções `updateQuantity`/`updateUnitValue`/`updatePackageValue`/`updateTotalValue`/`recalcEmbalagem` em `AlmoxarifadoPanel.tsx:287-368`). O estoque é sempre gravado em unidades (`qtdDisponivel = totalUnOf(form)`, `AlmoxarifadoPanel.tsx:257,280-284`).
  - **Movimentação** (modal): "entrada" soma ao saldo e grava `MovimentacaoEstoque` tipo `entrada`; "saída" chama `consumirMaterial` (baixa atômica no servidor) (`AlmoxarifadoPanel.tsx:412-435`).
  - Busca textual, filtro "Estoque Baixo", filtro por categoria/frente/obra e **agrupamento por fornecedor** com subtotais e total geral (`AlmoxarifadoPanel.tsx:147-175`, `438-449`, `800-814`).
  - Filtro por obra ativa: item sem obra é "geral" (aparece em todas); só esconde item de outra obra (`AlmoxarifadoPanel.tsx:151-153`).
  - Banner de status de sincronização (pendências e erro) (`AlmoxarifadoPanel.tsx:516-526`).
- **Conciliação (`conciliacao`)** — `ConciliacaoPanel`. Painel da conferência tripla. Cabeçalho "Three-Way Match — OC · RC · NF" com contagens de OCs/RCs/NFs, somatórios em BRL e status agregado (Conciliado/Parcial/Divergência/Aguardando) (`ConciliacaoPanel.tsx:208-266`). Cada OC é uma linha expansível que mostra item a item Qtd OC × Qtd RC × Preço OC × Preço NF, marcando ✓/✗ por tolerância de 2% (`ConciliacaoPanel.tsx:118-151`). Ações por OC: registrar RC (`ReceiptDialog`), editar OC (`PODialog`), executar match (`runMatch`), excluir OC (`deletePO` com confirm). Botão "Nova OC" abre `PODialog` (`ConciliacaoPanel.tsx:270-317`).
- **Exceções (`excecoes`)** — `ExcecoesPanel`. Gestão das divergências (`MatchException`): tipo (`quantity_diff`/`price_diff`/`item_missing`/`duplicate`), status (`open`/`in_review`/`resolved`/`escalated`), responsáveis (`assignedTo`) e ação sugerida (`ExcecoesPanel.tsx`, tipos em `src/types/index.ts:456-468`).
- **Previsão de Demanda (`previsao`)** — `PrevisaoDemandaPanel`. CRUD de `DemandForecast` (semana, categoria, qtd estimada, data sugerida de pedido, fase relacionada, valor estimado, status `suggested`/`ordered`/`dismissed`). KPI de valor total previsto (`PrevisaoDemandaPanel.tsx:158-179`).
- **Requisições (`requisicoes`)** — `RequisicoesPipeline`. Kanban de 5 colunas que espelha o fluxo `submitted → parsing → ontology_matched → proposals → ordered` (`RequisicoesPipeline.tsx:10-16`; fluxo no store em `suprimentosStore.ts:517-523`). Formulário "Nova Requisição", edição em modal e botão "Avançar" que promove o status (`advanceRequisitionStatus`). Cartão exibe categoria colorida, quantidade, solicitante, projeto, match de ontologia, fornecedores sugeridos e OC vinculada.
- **Inteligência (`inteligencia`)** — `InteligenciaSuprimentosPanel`. Motor de recomendação auditável (detalhado em "Cálculos"). Lista fontes ativas de demanda e, para cada demanda, gera uma recomendação de compra com risco (ok/atenção/crítico), quantidade e data sugeridas. Permite criar `DemandForecast` a partir da recomendação (`addForecast`).
- **Cotações / Lista (`bom`)** — `BomPendentePanel`. Duas funções: (1) **Requisições do planejado** — dispara `gerarRequisicoesDoPlanejado(budgetId)` a partir de um orçamento salvo em Quantitativos, gerando itens pendentes idempotentes (`BomPendentePanel.tsx:85-138`); (2) **Bill of Materials (BOM) global** — deriva materiais de saneamento (tubos PVC/PEAD, anéis, PVs, tampões, escavação, brita, CBUQ…) a partir dos trechos PENDENTES da Medição, aplicando coeficientes por diâmetro/rede (`calcGlobalBom` em `BomPendentePanel.tsx:21-83`).
- **Pedidos / Contratos (`contratos`)** — `ContractPanel`. Gestão de `FrameworkAgreement` (contrato-guarda-chuva): fornecedor, categoria, núcleo, validade, preço unitário acordado, quantidade máxima, lead time, score de confiança, cronogramas de pagamento/entrega, cláusula de rescisão e índice de reajuste (IGP-M/INCC/IPCA/Fixo) (`src/types/index.ts:544-566`). Cadastro rápido por núcleo (`ContractPanel.tsx:110-152`).
- **Mapa de Estoque (`estoque`)** — `MapaEstoquePanel`. Visão consolidada do estoque por núcleo/frente com alerta de compra imediata, tabela de itens e **histórico de movimentações** (marca consumo acima do esperado). Registra entrada com cálculo de lead time entre `dataCompra` e `dataMovimento` (`MapaEstoquePanel.tsx:128-146`).

### Seção "Análises e Alertas" (`section: 'materiais'`)

- **Materiais & Fornecedores (`materiais`)** — `MateriaisOverviewPanel`. Dashboard de gastos: gráfico SVG de gastos mensais a partir das OCs (`buildMonthlyData`), KPIs de total gasto, pedidos em aberto, taxa de entregas no prazo e lead time médio; lista/edição de contratos-guarda-chuva com estrelas de confiança e modal de criação/edição (`MateriaisOverviewPanel.tsx:271-382`).
- **Semáforo de Prontidão (`semaforo`)** — `SemaforoProntidaoPanel`. Matriz atividade LPS (linhas, vindas das `reservas`) × semanas 1–8 (colunas); cada célula é verde/amarelo/vermelho conforme estoque vs. reserva via `calcSemaforo` (`SemaforoProntidaoPanel.tsx:3-4,53-60`). Tabela de lead time por fornecedor e detalhe da reserva ao clicar na célula (`SemaforoProntidaoPanel.tsx:172-227`).
- **What-if Logístico (`whatif`)** — `WhatIfLogisticoPanel`. Simulador: move uma atividade LPS de uma semana para outra e reporta viável / alerta (NFs em trânsito podem cobrir) / inviável (ruptura sem pedido). Resultados não são persistidos (`WhatIfLogisticoPanel.tsx:89-213`; lógica `runWhatIf` em `suprimentosStore.ts:1062-1108`).

### Seção "Importação / Transição" (`section: 'planilhas'`)

Fluxo de migração de planilhas de saneamento (Resumo → Controle → Compras) para tabelas dedicadas.

- **Importação / Entrada (`entrada_dados`)** — `CadastroManualSuprimentosPanel`. CRUD hierárquico Núcleo → Rua → Item (água `AG` / esgoto `ESG`, status `exec`/`pend`/`cad`, km exec/pend) direto no Supabase.
- **Resumo por Núcleo (`resumo_nucleo`)** — `ResumoNucleoPanel`. Totais por núcleo: trechos em obra/executados/pendentes, km executados/obra, ratio.
- **Consolidado Trechos (`consolidado_trechos`)** — `ConsolidadoTrechosPanel`. Tabela de trechos (NS, PVs, DN, extensão, material, execução) com busca e paginação.
- **Materiais Pendentes (`materiais_pendentes`)** — `MateriaisPendentesPanel`. Lista de materiais pendentes por rua/núcleo; permite selecionar itens e **gerar ordem de compra** (`createOrdemSuprimentos`), com histórico de ordens geradas (`MateriaisPendentesPanel.tsx:239-250`).

Modais de importação XLSX: `ImportPlanilhasModal`/`ImportConsolidadoModal`/`ExcelImportModal` (parsers em `src/features/suprimentos/utils/parseExcelEstoque.ts`, `parsePlanilhasConsolidadas.ts`, `parseSuprimentosConsolidado.ts`). Botões de importação por seção em `index.tsx:135-171`.

### Seção "Cadeia de Suprimentos" (`section: 'cadeia'`)

- **Torre de Controle (`cadeia_rede`)**, **Riscos e Alertas (`cadeia_alertas`)** e **Planos de Contingência (`cadeia_planejamento`)** — todos em `CadeiaSuprimentosPanel`. Mapa/lista de nós logísticos (`SupplyChainNode`: fornecedor/planta/CD/cliente com OTIF, uso mensal, capacidade, lead time, lat/long), alertas de risco (`SupplyChainAlert`) e planos S&OE/S&OP (`SupplyChainPlan`) — tipos e mocks em `suprimentosStore.ts:174-238`. KPI de OTIF médio da rede.

## Dados que gera

Todas as tabelas têm `organization_id`, `created_by`, `created_at/updated_at`, `deleted_at` (soft delete) e RLS por `organization_id`.

**Compras / conferência tripla** (`supabase/migrations/0015_suprimentos.sql`):
- `suppliers` — cadastro de fornecedores: `cnpj` (único por org), `name`, `category`, `contact_name`, `phone`, `email` (citext), `payment_terms`, `payload` jsonb (`0015_suprimentos.sql:17-36`).
- `purchase_orders` — OC: `code` (único por org), `supplier` (nome livre v1), `responsible`, `issued_date`, `expected_delivery`, `project_ref`, `status` (enum `po_status`: `open`/`partial`/`closed`/`cancelled`), `total_brl`, `payload.items` = `POItem[]` (`0015_suprimentos.sql:50-72`).
- `goods_receipts` — recebimento (RC): `po_id`, `code`, `received_date`, `received_by`, `payload.items` = `GoodsReceiptItem[]` (`0015_suprimentos.sql:87-101`).
- `invoices` — nota fiscal (NF): `po_id`, `number`, `supplier`, `issue_date`, `due_date`, `total_amount`, `status` (enum `invoice_status`: `pending`/`pre_approved`/`approved`/`rejected`), `payload.items` = `InvoiceItem[]` (`0015_suprimentos.sql:115-133`).

**Estoque / almoxarifado** (`supabase/migrations/20260514090000_suprimentos_almoxarifado.sql`):
- `suprimentos_depositos` — frente/depósito: `frente`, `descricao`, `ativo`, `site_id` (obra) (`20260514090000:3-13`).
- `suprimentos_estoque_itens` — item: `deposito_id`, `descricao`, `unidade`, `qtd_disponivel`, `qtd_reservada`, `qtd_transito`, `estoque_minimo`, `custo_unitario`, `lps_activity_id`, `categoria`, `fornecedor_principal` (`20260514090000:15-33`); + `qtd_por_embalagem`, `unidade_embalagem` (`20260710120000_estoque_embalagem.sql`); + `metadata` jsonb para campos flexíveis como `codigoReferencia`/`dataUltimoPedido` (`20260716120000_estoque_metadata.sql`); + `site_id` (obra scoping).
- `suprimentos_estoque_movimentacoes` — movimentação: `item_id`, `deposito_id`, `tipo` (`entrada`/`saida`/`transferencia`/`ajuste`), `quantidade`, `data_movimento`, `data_compra`, `fornecedor`, `nf`, `lead_time_dias`, `lps_activity_id`, `observacoes` (`20260514090000:35-53`); + colunas de rastreabilidade `origem`/`rdo_id`/`origem_ref` (`20260625120000:14-16`) e `site_id`.

**Planilhas consolidadas de saneamento** (`supabase/migrations/0044_suprimentos_planilhas.sql`):
- `suprimentos_nucleos` — núcleo: `nome`, `tipo` (`AG`/`ESG`), agregados `tr_total/tr_obra/tr_cad/tr_exec/tr_pend`, `km_*`, `ratio`, `pct_exec` (`0044:4-29`).
- `suprimentos_ruas` — rua vinculada ao núcleo (`0044:31-43`).
- `suprimentos_itens` — item planejado/pendente: `rua_id`, `material`, `unidade`, `quantidade`, `rede` (`AG`/`ESG`), `status` (`exec`/`pend`/`cad`), `km_exec/km_pend`, `auxiliares` jsonb, `payload` jsonb; único por `(org, rua, material, rede, status)` (`0044:45-65`); + `origem`/`origem_ref` para requisições idempotentes do planejado (`20260627150000:8-13`).
- `suprimentos_ordens` — OC gerada dos pendentes: `codigo` (único), `status` (`aberta`/`emitida`/`cancelada`), `itens` jsonb, `total_itens` (`0044:67-81`).

**Entidades apenas locais/mock (sem tabela dedicada):** `ThreeWayMatch`, `MatchException`, `DemandForecast`, `Requisition`, `ReservaMaterial`, `LeadTimeRecord`, e os nós/alertas/planos da Cadeia (`SupplyChainNode`/`Alert`/`Plan`). O match é recalculado no cliente; reservas e lead-time alimentam Semáforo/What-if a partir de dados de demonstração [inferido: ainda não têm persistência server-side própria].

## Cálculos, KPIs e regras de negócio

**Three-Way Match** (`src/store/suprimentosStore.ts:73-139`): tolerância `TOLERANCE = 0.02` (2%). Para cada `POItem` compara quantidade (RC vs OC) e preço unitário (NF vs OC). Regras de status: sem divergência → `matched`; alguma divergência com |delta%| > 5 → `discrepancy`; caso contrário → `partial`. Item da OC sem linha no RC gera divergência `missing` (−100%). O match roda automaticamente ao registrar RC ou NF (`addReceipt`/`addInvoice` chamam `runMatch`, `suprimentosStore.ts:744,768`).

**Recomendação de compra (Inteligência)** (`InteligenciaSuprimentosPanel.tsx:283-333`):
- `missingQty = max(0, requiredQty + reservedQty − availableQty − inTransitQty)` (trânsito = estoque em trânsito + qtd de OCs em aberto).
- `suggestedOrderQty = ceil(missingQty × 1.05)` (5% de folga).
- `suggestedOrderDate = plannedDate − (leadTimeDays + 2 dias)` (lead time do contrato-guarda-chuva, senão 10).
- **Risco:** `ok` se `missingQty <= 0`; `crítico` se `daysToBuy <= 0` (já passou da data de comprar); senão `atenção`.
- `estimatedValue = suggestedOrderQty × custo` (preço do contrato, senão custo do estoque).

**Semáforo de prontidão** (`calcSemaforo`, `suprimentosStore.ts:1041-1060`): por reserva de material da atividade/semana — item com `qtdDisponivel >= qtdNecessaria` é ok; se falta mas há `qtdTransito > 0` → amarelo; se falta e nada em trânsito → vermelho. Sem reservas → verde.

**What-if** (`runWhatIf`, `suprimentosStore.ts:1062-1108`): recalcula as reservas da atividade para a semana simulada; retorna `viavel` (tudo disponível), `alerta` (insuficiente mas com NFs em trânsito) ou `inviavel` (ruptura sem pedido), listando déficit e lead time por item.

**Baixa atômica de estoque** (RPC `baixar_estoque_item`, `supabase/migrations/20260628130000_baixa_estoque_atomica.sql:9-54`): subtração atômica no servidor (`qtd_disponivel = qtd_disponivel − p_qtd`) + inserção da movimentação `saida` origem `manual`. **Sem clamp em 0** — saldo negativo é sinal de déficit de inventário, tratado na UI, não bloqueia. Evita last-write-wins entre usuários concorrentes.

**KPIs do header por seção** (`SuprimentosHeader.tsx:70-113`): Suprimentos → Conciliadas/Parciais/Com Exceção/Total OCs; Materiais → Total Itens/Em Ruptura (`qtdDisponivel === 0`)/Em Trânsito/Valor em Estoque (`Σ qtdDisponivel × custoUnitario`); Planilhas → Trechos em Obra/Executados/Pendentes/Progresso Geral (`trExec/trObra`); Cadeia → OTIF médio/Nós/Alertas abertos/Planos ativos.

## Integrações — a "camada única"

**O que CONSOME de outros módulos:**
- **Inteligência** lê 9+ stores para montar demanda: `planejamentoStore` (trechos/núcleos), `planejamentoMestreStore` (`derivedActivities` do lookahead), `medicaoStore` (segments), `rdoStore`, `evmStore`, `projetosStore`, `qualidadeStore` (NCs), `quantitativosStore`, `bimStore` (`InteligenciaSuprimentosPanel.tsx:365-375`). Fontes de demanda: planilhas consolidadas + planejamento + LPS/lookahead, com fallback para previsões manuais (`InteligenciaSuprimentosPanel.tsx:378-422`).
- **BOM / Requisições do planejado** consome `medicaoStore.segments` (trechos pendentes) e `quantitativosStore.savedBudgets` (orçamentos) (`BomPendentePanel.tsx:86-89`). `gerarRequisicoesDoPlanejado` chama a RPC `gerar_requisicoes_suprimentos(p_budget_id)` que transforma `quantitativos_budgets.payload.items[]` em `suprimentos_itens` status `pend`, idempotente por `origem_ref` (`supabase/migrations/20260627150000_suprimentos_requisicoes_b2.sql:16-104`).
- **Almoxarifado** consome as obras da **Torre de Controle** (`useTorreStore.sites`) para montar as opções de frente/depósito (`AlmoxarifadoPanel.tsx:140-145`).

**O que ALIMENTA (eventos emitidos no `src/lib/eventBus.ts`):**
- `po.closed` quando uma OC transita para `closed` — consumido pelo Financeiro/EVM (Actual Cost) (`suprimentosStore.ts:702-709`).
- `supply.receipt_approved` ao registrar RC (`suprimentosStore.ts:736-743`).
- `supply.invoice_approved` ao registrar NF, com `amount` (`suprimentosStore.ts:759-767`).

**O que ESCUTA (`suprimentosStore.ts:1618-1627`):**
- `rdo.finalized` → dispara `pull()` para refletir os saldos após a baixa server-side.
- `realtime.row_changed` para `suprimentos_estoque_itens` / `_movimentacoes` / `_depositos` → re-pull cross-usuário.

**Trigger de servidor — RDO → Estoque** (`sync_rdo_to_estoque` / `trg_rdo_to_estoque`, `supabase/migrations/20260625120000_rdo_estoque_integration.sql:36-117`): `AFTER INSERT OR UPDATE ON rdo`. Baixa **idempotente** por `rdo_id` — estorna (devolve ao estoque + soft-delete) todas as movimentações origem `rdo` do RDO e regrava a partir de `payload.materials` cujo `source = 'almoxarifado'` com `stockItemId` válido, decrementando `qtd_disponivel` atomicamente. Só regrava se o RDO estiver ativo e `payload.status = 'finalizado'`. Material `almoxarifado` sem item de catálogo válido vira linha em `audit_log` (`rdo_material_unmatched`). Cobre re-save, edição de quantidade, remoção de material e soft-delete do RDO.

**Realtime** (`src/lib/realtime.ts:40-42`): as três tabelas de estoque estão no `WATCHED_TABLES`, além de `purchase_orders`/`goods_receipts`/`invoices`. Cada mudança Supabase vira `realtime.row_changed` no eventBus, com coalescer de ~350ms para não re-puxar em rajada (`realtime.ts:67-95`). Habilitação em `supabase/migrations/20260711120000_enable_realtime.sql:13-15`.

## Eficiência gerada

- **Fim da conferência tripla manual:** OC × RC × NF é conferida item a item automaticamente com tolerância de 2%, classificando conciliado/parcial/divergência sem planilha de bater nota (`suprimentosStore.ts:73-139`). [inferido] Elimina horas de conferência fiscal e reduz pagamento indevido de nota divergente.
- **Estoque dá baixa sozinho pelo campo:** ao finalizar o RDO, o material consumido baixa no almoxarifado via trigger idempotente, sem digitação dupla e sem baixa duplicada mesmo re-salvando o RDO (`20260625120000`). [inferido] Estoque em tempo quase real sem retrabalho de almoxarifado.
- **Dado único de estoque, cross-usuário e cross-obra:** baixa atômica no servidor evita perder movimentação quando dois usuários operam o mesmo item ao mesmo tempo (`20260628130000`); realtime propaga a mudança para os outros navegadores (`realtime.ts`). [inferido] Acaba a divergência "cada um com sua planilha".
- **Demanda consolidada em uma tela:** a Inteligência cruza planejamento, LPS, planilhas, RDO, quantitativos, estoque e contratos para dizer o que comprar, quanto e quando com data-limite por lead time (`InteligenciaSuprimentosPanel.tsx`). [inferido] Antecipa ruptura e compra na hora certa.
- **Requisições geradas do orçamento sem duplicar:** RPC idempotente materializa o orçamento de Quantitativos em itens pendentes; re-rodar atualiza em vez de duplicar (`20260627150000`). [inferido] Menos redigitação e sem itens fantasma.
- **Embalagem reconciliada numa conta só:** cadastro traduz "10 caixas × 96 un = R$X" em unidades-base + custo unitário automaticamente (`AlmoxarifadoPanel.tsx:731-763`). [inferido] Reduz erro de conversão no cadastro.
- **Rastreabilidade:** movimentações guardam `origem`/`rdo_id`/`origem_ref`, e materiais sem catálogo caem em `audit_log`. [código: `20260625120000:95-107`]

## Como sincroniza

- **Local-first + fila de operações:** mutações de OCs, recebimentos, notas, fornecedores e estoque geram `PendingOp` na fila `pendingSync` e chamam `flush()` (`flushQueue` em `src/lib/storeSync.ts`); a UI atualiza otimista e o servidor confirma depois (`suprimentosStore.ts:658-975`). `flush` respeita offline (`syncStatus: 'offline'`) e reenvia ao voltar online via listener `window 'online'` (`suprimentosStore.ts:1399-1418,1610-1614`).
- **Baixa de material é servidor-autoritativa:** `consumirMaterial` faz update otimista e chama a RPC atômica; em falha reverte **por delta** (soma a qty de volta) para não sobrescrever baixa concorrente (`suprimentosStore.ts:987-1039`).
- **Pull defensivo por tabela:** `pull()` não zera listas antes de puxar e **pula** tabelas que têm op pendente (evita sobrescrever dado local não sincronizado); ainda filtra linhas com delete pendente local (`suprimentosStore.ts:1420-1567`).
- **Persistência local (`persist`, `partialize`):** só ficam no `localStorage` OCs, recebimentos, notas, matches, contratos, fornecedores, fila e as planilhas consolidadas. **O estoque (depósitos/itens/movimentações/reservas) NÃO é persistido em localStorage** — é cache de sessão puxado do servidor a cada carga; o `migrate` (version 2) apaga esses campos de estados antigos (`suprimentosStore.ts:1572-1605`).
- **Realtime cross-usuário:** mudanças nas tabelas de estoque disparam re-pull (ver Integrações).
- **RLS multi-tenant por `organization_id`:** todas as tabelas têm `ENABLE` + `FORCE ROW LEVEL SECURITY`; SELECT restrito a `organization_id = public.user_org() AND deleted_at IS NULL`; INSERT exige papel via `public.has_role([...])`; DELETE bloqueado (`USING (false)`) — exclusão é **soft** via `deleted_at`, com RPCs dedicadas `soft_delete_suprimentos_deposito`/`_estoque_item` (`supabase/migrations/20260514090000_...:76-154`, `20260518172000_suprimentos_almoxarifado_delete_rpcs.sql`).
- **Isolamento de tenant no cliente:** ao trocar de organização, `ensureTenantScope` zera todas as listas e a fila para não vazar dados entre empresas (`suprimentosStore.ts:1340-1373`); a página bloqueia a renderização até `activeOrgId === profileOrgId` (`index.tsx:84-90`).
- **Planilhas consolidadas:** persistidas server-side (tabelas `suprimentos_*`) via upserts idempotentes por chave natural; carregadas por `pullPlanilhasSupabase` → `loadSuprimentosPlanilhas` (`src/features/suprimentos/utils/suprimentosPlanilhasSupabase.ts:279-426`).
