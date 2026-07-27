# Medição

> **Rota(s):** `/app/medicao` ([código] `src/App.tsx:151`, `<MedicaoPage />`) · **Store(s):** `medicaoBillingStore`, `medicaoUnificadaStore` (ativos); `medicaoStore`, `medicaoAssistidaStore` (legado/desligados do fluxo atual) · **Grupo na sidebar:** **GESTÃO** ([código] `src/components/shared/Sidebar.tsx:41`, ícone `Ruler`)

---

## O que é / problema que resolve

O módulo de Medição fecha o **boletim de medição contratual** de obras de saneamento (o caso-modelo é o contrato Sabesp `11481051` — "SE LIGA NA REDE - SANTOS", usado como default no cadastro em [código] `src/features/medicao/index.tsx:206`). Ele responde à pergunta central de todo contrato de empreitada: *quanto foi executado no período, quanto disso vale, quanto vai para a Nota Fiscal do contratante e quanto se repassa a subempreiteiros e fornecedores* — com rastreabilidade e sem depender de planilhas soltas.

A entrega da plataforma aqui é dupla. Existe o **fluxo legado (stepper de boletim)** — 9 passos que reproduzem a planilha Sabesp, os subempreiteiros, os fornecedores, a conferência e a medição final — e existe a **Medição Unificada**, a camada nova onde as quantidades *nascem em fontes auditáveis* (RDO/RDO Sabesp, importação XLSX, suprimentos, retorno de qualidade e lançamento manual), passam por **revisão humana obrigatória**, viram **memória de cálculo**, ganham **preço via item contratual (N. Preço)** e só então entram no **fechamento** ([código] cabeçalho `MedicaoUnificadaPanel`, "RDO → Memória → Itens medidos → Fechamento", `src/features/medicao/components/MedicaoUnificadaPanel.tsx:454`).

O ponto de dor que ele elimina: a medição tradicionalmente é remontada à mão todo mês, o dado do campo (RDO) não conversa com o dado do contrato, e a conferência entre "o que a Sabesp mede" × "o que os subempreiteiros cobram" é feita no olho. Aqui isso vira pipeline com origem única.

## Para quem (papéis / persona)

- **Engenheiro de medição / medidor** — monta a planilha do período, importa RDOs, aprova memórias, roda a conferência.
- **Planejador / técnico de contrato** — cadastra itens contratuais (N. Preço, unidade, preço, regra de retenção/medição).
- **Financeiro / faturamento** — lança descontos, retenções, adiantamentos e NFs; usa o valor líquido previsto para emitir a NF.
- **Qualidade** — bloqueia/glosa fontes via não conformidade (NC), impedindo o fechamento de item com pendência.
- **Gerente / diretor / owner** — aprovam boletins e acompanham saldo contratual.

As escritas nas tabelas do módulo exigem papéis específicos via RLS: `engenheiro`, `qualidade`, `planejador`, `comprador`, `gerente`, `diretor`, `owner` ([schema] `supabase/migrations/0053_unified_measurement_layers.sql:289`; para boletins, `supabase/migrations/20260502175850_measurement_billing_boletins.sql:48`).

## Funcionalidades detalhadas

### A. Fluxo legado — Stepper do Boletim (`medicaoBillingStore`)

O `MedicaoPage` gira em torno de um **boletim** por período. Sem boletim, mostra o *empty state* com botão "Criar Primeiro Boletim" e download de um **template XLSX padronizado** (3 abas: Medição Sabesp, Empreiteiros, Instruções — [código] `index.tsx:93-198`). O modal "Novo Boletim" pede Período, Contrato e Consórcio ([código] `index.tsx:202-267`).

O stepper tem **9 passos** ([código] `EXPANDED_STEPS`, `index.tsx:40-50`; `renderStep`, `index.tsx:458-471`):

1. **Resumo** — embute `MedicaoUnificadaPanel` na aba `resumo` (KPIs operacional-financeiros do período).
2. **Planilha Sabesp** — `SabespPlanilhaPanel`: itens contratuais (`ItemContrato`: itemEAP, nPreço, descrição, unidade, grupo 01/02/03, qtd contratada/anterior/medida, valor unitário). Importa XLSX e salva um *snapshot* (`planilhaBase`) que passa a ser a base de cálculo travada ([código] `getItensBaseCalculoFromBoletim`, `medicaoBillingStore.ts:511-516`).
3. **Critérios** — `CriteriosMedicaoPanel`: visualizador de referência dos critérios de medição do contrato (dados em `src/features/medicao/data/criterios.ts` e `criteriosPdfExtraidos.ts`).
4. **Memória** — `MedicaoUnificadaPanel` aba `memoria`: quantidades detalhadas por serviço/local/trecho/evidência/N. Preço.
5. **Empreiteiros** — `SubempreiteirosPanel`: fichas de subempreiteiro com abas internas **Resumo Fechamento, Auditoria e Exceções, Memória, Parâmetros, Descontos, RH, Agregados, Materiais, Máquinas, Serviços, Veículos, Combustível, Retenções, NFs, Detalhado** ([código] `TabId`, `SubempreiteirosPanel.tsx:39-51`). Importa XLSX (`parseSubempreiteiroSheet`) e **puxa serviços executados de RDOs Sabesp locais** para sincronizar itens/memória do subempreiteiro ([código] `readLocalRdoSabesp` + `syncRdoSabespSubempreiteiros`, `SubempreiteirosPanel.tsx:2401,2490`).
6. **Fornecedores** — `FornecedoresPanel`: medição de fornecedores (`Fornecedor`: valorAprovado, descontos, adiantamento, retenção, itens de medição, pacote, memória, etapas de aprovação — [código] `medicaoBillingStore.ts:309-344`). Status `rascunho|pendente|aprovado|glosado|pago`.
7. **Descontos / Retenções / NFs (Financeiro)** — `MedicaoUnificadaPanel` aba `financeiro`.
8. **Conferência** — `ConferenciaPanel`: cruza qtd Sabesp × qtd somada dos subempreiteiros por N. Preço (ver Cálculos).
9. **Medição Final** — `MedicaoFinalPanel`: resumo + export PDF (`src/features/medicao/utils/exportPdf.ts`).

Ações do cabeçalho do stepper ([código] `StepperHeader`, `index.tsx:271-402`): seletor de boletim, botão **Histórico** (`HistoricoPanel`), **Gerar Próximo Mês** (rola o acumulado — ver Cálculos) e **Novo Boletim**. Status do boletim: `rascunho | em_conferencia | finalizado`.

CRUD do boletim no store: `createBoletim`, `createNextBoletimFromBoletim`, `setActiveBoletim`, `removeBoletim`, itens (`addItemContrato`/`update`/`remove`), subempreiteiros, fornecedores, imports em massa (`importItensContrato`, `importSubempreiteiroItems`, `importSubempreiteiroDetalhado`, `importFornecedores`), `computeConferencia`, `computeMedicaoFinal`, `fecharBoletim` ([código] `medicaoBillingStore.ts:640-713`).

### B. Medição Unificada (`medicaoUnificadaStore`)

Acessível embutida nos passos 1/4/7 do stepper e como tela cheia. Cabeçalho com seletor de **Período** e botões **+ Período / + Fonte / + Memória / Recarregar**. Sete abas ([código] `tabs`, `MedicaoUnificadaPanel.tsx:44-52`):

- **Resumo** — KPIs: Fontes recebidas / aguardando revisão, Memórias aprovadas / pendentes, Valor bruto aprovado, Valor líquido prévio, Medições geradas, Linhas automáticas, Bloqueios do fechamento; painel "Fluxo de aprovação" (RDO/importação → Revisão humana → N. Preço → Fechamento) e "Pendências críticas".
- **Fontes** — cartões `SourceCard` por fonte (`measurement_sources`): status, tipo (RDO automático / Importação XLSX / manual / ajuste / suprimentos / glosa-qualidade), qtd, valor, N. Preço, foto/assinaturas do RDO para auditoria; botão **Gerar memória** e **Marcar problema** ([código] `SourceCard`, `MedicaoUnificadaPanel.tsx:163-216`).
- **Memória** — linhas `measurement_memory_lines` com N. Preço, trecho, NS, RDO de origem; botões **Aprovar memória** / **Bloquear** ([código] `reviewMemoryLine`, linha 670-671).
- **Itens Medidos** — consolida memórias **aprovadas** por N. Preço/serviço/parceiro/núcleo; sinaliza "Pendente de classificação" quando falta N. Preço.
- **Financeiro** — lançamentos `measurement_financial_entries` por tipo (retenção, desconto, RH, máquinas, veículos, combustível, materiais, EPI, serviços terceiros, NF, adiantamento, fechamento anterior, outros, ajuste manual); KPIs Abatimentos/NFs/Líquido; **Aprovar** / **Glosar**.
- **Conferência** — 4 semáforos (fontes em revisão, memórias sem aprovação, itens sem N. Preço, bloqueios de qualidade) + **checklist automático por subempreiteiro** com exceções (blocker/warning).
- **Fechamento** — pré-fechamento (só libera sem pendência crítica) e **export de pacote XLSX por subempreiteiro** com abas Resumo Geral, Fechamento, Parâmetros, NFs, Medição, Memória, Descontos e abas operacionais ([código] `exportSubempreiteiroWorkbook`, `measurementGeneration.ts:271-355`).

Formulários manuais criam Período, Fonte, Memória, Item contratual e Lançamento financeiro; toda fonte/memória/financeiro manual exige **motivo** ("IA nunca fecha sozinha", [código] `MedicaoUnificadaPanel.tsx:616`).

### C. Componentes legado desligados

`MedicaoDashboard`, `ConsolidadoPanel`, `MedicaoHeader` e o `medicaoStore` (segmentos consolidados executado×projetado×cadastro por núcleo) e o `medicaoAssistidaStore`/`MedicaoAssistidaPanel` **não são importados pelo `index.tsx` atual** ([código] verificado por busca de import). São a versão anterior do módulo, mantida no repositório mas fora da rota. `ResumoNucleoPanel` e `MateriaisPendentesPanel` migraram para Suprimentos. [inferido] estão preservados para referência/rollback.

## Dados que gera

### Fluxo unificado (normalizado) — migração `0053_unified_measurement_layers.sql`

- **`measurement_periods`** — período mensal (period_label, starts_on/ends_on, contract_no, status `draft|in_review|closed|canceled`) [schema] `0053:60-76`.
- **`measurement_sources`** — fonte auditável de quantidade. Criada em `0045` e estendida em `0048`/`0053`: `source_kind` (rdo, rdo_sabesp, spreadsheet, manual, manual_entry, engineering_adjustment, financial_adjustment, suprimentos, quality_return), `source_uid` (idempotência), `source_date`, quantity, unit_price, amount, `status` de revisão, `quality_status` (clear/pending_quality/blocked_by_nc/released/glosa_review), `blocking_issues[]`, `import_warnings[]`, `parse_confidence`, `source_payload` (jsonb com foto/assinaturas do RDO) [schema] `0053:5-58`, `0048:4-11`.
- **`measurement_contract_items`** — catálogo contratual que dá preço/unidade/regra: item_code, n_preco, contracted_quantity, previous_quantity, unit_price, retention_percent, retention_rule, measurement_rule [schema] `0053:78-98`.
- **`measurement_memory_lines`** — memória de cálculo auditável: service_description, quantity, unit_price, nucleo, location_text, trecho_inicial/final, pv_pi_estaca, service_order, croqui, evidence_url, `review_status` (draft/pending_review/approved/rejected/blocked), rdo_id/rdo_type/source_id [schema] `0053:100-140`.
- **`measurement_financial_entries`** — lançamentos de fechamento: entry_type (14 tipos), amount, competence, invoice_number, status (draft/pending_review/approved/paid/glossed/blocked) [schema] `0053:142-182`.
- **`measurement_quality_flags`** — impactos de qualidade ligados a fontes/NCs, sem apagar produção medida [schema] `0048:25-44`.

### Fluxo legado (boletim JSON)

- **`measurement_billing_boletins`** — 1 linha por boletim; o boletim inteiro (itens, subempreiteiros, fornecedores, conferência, medicaoFinal) vive no campo `payload jsonb`; colunas planas: periodo, contrato, consorcio, status, `environment` (production/homologation/demo) [schema] `20260502175850_measurement_billing_boletins.sql:4-21`.

### Fase 1 (catálogo/boletins normalizados) — `0037_medicao_tables.sql`

- **`contract_price_items`** (código, unit_price, contract_quantity, grupo/subgrupo/frente, measurement_rule), **`measurement_bulletins`**, **`measurement_bulletin_items`** [schema] `0037:7-48`. O `contract_price_items` é consultado pelas *triggers* de RDO para atribuir `unit_price`/`amount` às fontes (ver Integrações).

## Cálculos, KPIs e regras de negócio

**Boletim legado (`medicaoBillingStore`):**

- Item de contrato computado ([código] comentários `medicaoBillingStore.ts:37-40`):
  `qtdAcumulada = qtdAnterior + qtdMedida` · `totalPeriodo = qtdMedida × valorUnitario` · `saldoFinanceiro = (qtdContrato − qtdAnterior − qtdMedida) × valorUnitario`.
- **Conferência** ([código] `computeConferencia`, `medicaoBillingStore.ts:977-1018`): soma qtd de todos os subempreiteiros por `normalizeNPreco(nPrecoSabesp || nPreco)`; `diferenca = item.qtdMedida − qtdSub`; `status = ok` se `|diferenca| < 0.001`, senão `divergencia`. Preserva observações manuais.
- **Medição Final** ([código] `computeMedicaoFinal`, `medicaoBillingStore.ts:1035-1084`):
  `totalMedidoPeriodo = Σ qtdMedida×valorUnitario`; `totalAcumulado = Σ (qtdAnterior+qtdMedida)×valorUnitario`; `saldoContrato = totalContratoValor − totalAcumulado`; `saldoContratante = totalMedidoPeriodo − totalSubempreiteiros − totalFornecedores`. Quando existe `planilhaBase.sourceTotals`, usa os totais-âncora da planilha importada no lugar dos calculados.
- **Trava de fechamento** ([código] `hasCriticalMeasurementBlock`, `medicaoBillingStore.ts:564-568`): `computeMedicaoFinal`/`fecharBoletim` lançam erro se houver memória/item `bloqueado` ou `glosado`.
- **Fechar boletim** ([código] `fecharBoletim`, `1093-1115`) e **Gerar Próximo Mês** ([código] `createNextBoletimFromBoletim`, `806-855`): rolam `qtdAnterior += qtdMedida` e zeram `qtdMedida`, mantendo saldo contratual entre períodos.

**Medição Unificada (`measurementGeneration.ts`):**

- `grossApproved = Σ (memória aprovada) quantity × unit_price` (preço resolvido do item contratual quando a linha não traz preço — [código] `resolvedUnitPrice`, `373-379`).
- `deductions = Σ |amount|` de lançamentos aprovados que são abatimento (retenção, desconto, RH, máquina, veículo, combustível, material, EPI, serviço-terceiro, adiantamento, fechamento-anterior, outros, ajuste) — [código] `FINANCIAL_DEDUCTION_TYPES`, `76-90`.
- `netPreview (valor líquido previsto) = grossApproved − deductions`; `invoiceGap = |netPreview − invoices|`; `evidenceCoveragePercent` = % de memórias com evidência/RDO/fonte.
- **Exceções/bloqueios** ([código] `buildExceptions`, `544-571`): *blocker* — fonte sem subempreiteiro, memória sem N. Preço, memória sem preço unitário, fonte bloqueada pela qualidade, financeiro não aprovado (exceto NF); *warning* — medição aprovada sem NF, divergência líquido×NF.
- Mapeamento NC→status (servidor): `aberta→blocked_by_nc`, `em_tratamento→pending_quality`, `concluida→released`, `ineficaz→glosa_review` ([schema] `measurement_source_quality_from_nc_status`, `0048:87-99`).

## Integrações — a "camada única"

**Consome (alimenta-se de):**

- **RDO regular e RDO Sabesp** — *triggers* de servidor reconstroem `measurement_sources` a cada RDO finalizado/fechado: `sync_rdo_sabesp_to_measurement` e `sync_regular_rdo_to_measurement`, disparadas por `trg_rdo_sabesp_measurement_sync`/`trg_rdo_measurement_sync` ([schema] `0048:134-360,526-538`). Quantidade vem do RDO; `unit_price` vem de `contract_price_items` (join por `code`); contratante vem de `rdo_contractor_links`; a foto/assinaturas viram `source_payload`. No fluxo legado, o `SubempreiteirosPanel` lê RDOs Sabesp locais e chama `syncRdoSabespSubempreiteiros` ([código] `SubempreiteirosPanel.tsx:2490`).
- **Qualidade (NCs)** — `sync_quality_nc_to_measurement` cria `measurement_quality_flags` e marca `quality_status` da fonte, bloqueando o fechamento ([schema] `0048:362-488,540-545`).
- **Suprimentos** — o painel puxa fornecedores (`pullSuprimentos`) e o store recarrega em `supply.receipt_approved`/`supply.invoice_approved` ([código] `medicaoUnificadaStore.ts:737-741`).
- **Contratos/Empreiteiros** — `contractorStore` resolve nomes/links de parceiro ([código] `MedicaoUnificadaPanel.tsx:300`).

**Alimenta (é consumido por):**

- **eventBus** — emite `measurement.draft_created`, `measurement.blocked` e `measurement.approved` (com `operationalKey`) ao criar/aprovar fonte ([código] `medicaoUnificadaStore.ts:501-515,542-550`; tipos em `src/lib/eventBus.ts:49-51`).
- **operationalKey** (a "chave operacional" que costura módulos) — cada fonte gera/valida a chave `contractNo|projectId|nucleo|local|nPreco|period` ([código] `operationalKeyFromSource`, `medicaoUnificadaStore.ts:323-333`; `src/lib/operationalKey.ts`). Falta de contrato/núcleo/local/N.Preço vira `blocking_issues`.
- **Financeiro / EVM / LPS** — a medição é a categoria `medicao` de entradas no Financeiro e fonte da "Medição Ponderada" no EVM e do conector `medicao` no LPS ([código] `financeiroStore.ts:243`, `evm/index.tsx:53`, `lpsStore.ts:213,369`). [inferido] o vínculo hoje é por categoria/label e pela chave operacional, não por gravação automática cruzada disparada por este módulo.

**Realtime** — `measurement_sources/periods/memory_lines/financial_entries/contract_items` estão na lista observada ([código] `src/lib/realtime.ts:46-50`); o store recarrega em `realtime.row_changed` dessas tabelas + `rdo`, `rdo_sabesp`, `goods_receipts`, `invoices`, `quality_non_conformities` ([código] `medicaoUnificadaStore.ts:743-758`). **Reage a `rdo.finalized`** (e a `quality.blocked/released`) recarregando a camada ([código] `medicaoUnificadaStore.ts:728-736`).

## Eficiência gerada

- **Menos planilha, dado único** — RDO finalizado no campo já aparece como fonte de medição, sem redigitar; a planilha Sabesp vira `snapshot` base do cálculo. [inferido] elimina a remontagem manual mensal do boletim.
- **Automação da conferência** — o cruzamento Sabesp × subempreiteiros por N. Preço e o checklist de exceções por subempreiteiro são calculados, não conferidos no olho ([código] `computeConferencia`; `buildExceptions`).
- **Rastreabilidade/auditoria** — toda quantidade tem origem (fonte + `source_uid`), evidência, revisor e `audit_log` no servidor ([schema] `0048:235-243`); complemento manual exige motivo. [inferido] blinda a medição em fiscalização/glosa.
- **Governança financeira** — o fechamento trava com pendência crítica (item glosado/bloqueado, sem N. Preço, sem preço, financeiro não aprovado), evitando NF sobre medição inconsistente.
- **Continuidade entre meses** — "Gerar Próximo Mês" preserva saldo contratual automaticamente.
- **Exportação pronta** — PDF da medição final e pacote XLSX por subempreiteiro com todas as abas operacionais.

## Como sincroniza

- **Local-first (Medição Unificada)** — escritas são otimistas e enfileiradas em `pendingSync`; um `flushQueue` sobe para o Supabase, retenta em falha e mantém registros não sincronizados via `keepUnsynced` no `load` ([código] `medicaoUnificadaStore.ts:349-402,709-715`). Persistência em `localStorage` (`cdata-medicao-unificada`) inclui a fila.
- **Offline** — se `navigator.onLine === false` o flush marca `offline`; ao voltar online, faz `flush()` e depois `load()` em sequência para não descartar a op recém-enviada ([código] `medicaoUnificadaStore.ts:352,717-725`).
- **Boletim legado** — `medicaoBillingStore` persiste em `cdata-medicao-billing` (com `migrate` versão 6) e faz upsert otimista em `measurement_billing_boletins`; `loadRemote` mescla remoto sobre local por `id`/`updatedAt` e é **pulado em modo não-produção** ([código] `medicaoBillingStore.ts:736-767`). Escopo por `environment` (production/homologation/demo — [código] `detectEnvironment`, `548-556`).
- **RLS / multi-tenant** — todas as tabelas do módulo têm RLS `FORCE` por `organization_id = user_org()`, INSERT exige `has_role([...])`, DELETE bloqueado (soft-delete via `deleted_at`) ([schema] `0053:259-308`, `20260502175850...:32-62`, `0048:59-85`).
- **medicaoStore / medicaoAssistidaStore** — apenas `localStorage` (`cdata-medicao`, `cdata-medicao-assistida`), sem Supabase. [inferido] não sincronizam entre dispositivos/usuários; são o resíduo do módulo legado.
