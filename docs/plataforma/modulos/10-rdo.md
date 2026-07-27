# RDO — Relatório Diário de Obra

> **Rota(s):** `/app/rdo` · **Store(s):** `rdoStore` (chave `cdata-rdo`) · **Grupo na sidebar:** CAMPO

## O que é / problema que resolve

O RDO é o **ponto de entrada do dado de campo** na plataforma: o que foi executado no dia (serviços/trechos/produção), quem trabalhou, quais equipamentos e materiais foram usados, clima, ocorrências e fotos. É o documento que, historicamente, vira uma pilha de papel/planilha que chega tarde e divergente ao escritório. Aqui ele é **estruturado e conectado**: ao ser finalizado, o mesmo lançamento alimenta automaticamente Planejamento (avanço físico), Mão de Obra (apontamentos/custo), Estoque (baixa de material), Financeiro (custo realizado) e Medição/LPS — sem redigitar nada. [código]

Há **dois formatos** no mesmo módulo/tabela (`rdo`), distinguidos por `template`: o **RDO padrão** (obra geral, com trechos/serviços) e o **RDO Compizzo** (piso industrial epóxi — serviços em checklist, produção em m², RUP por HH÷m², snapshots de contrato/preço do Plano de Execução). O RDO SABESP é uma variante à parte (ver `11-rdo-sabesp.md`), com store e tabela próprios. [código: `src/store/rdoStore.ts`, `src/features/rdo/components/RdoCompizzoPanel.tsx`]

## Para quem (papéis / persona)

- **Engenheiro / encarregado de campo** — preenche o RDO no dia (canteiro, muitas vezes offline).
- **Gerente de obra** — confere e finaliza; usa Previsto×Realizado.
- **Planejador / diretoria** — consomem o efeito do RDO nos outros módulos (avanço, custo, medição), não o RDO cru.

## Funcionalidades detalhadas

O módulo (`src/features/rdo/index.tsx`) organiza abas via header próprio:

- **Novo RDO** (`NovoRdoPanel.tsx`) — formulário do RDO padrão: data, responsável, obra (herda a obra ativa), clima (manhã/tarde/noite + temperatura), **serviços** (`services[]`: quantidade, unidade, `planningActivityId`/`operationalKey`, `dailyProgressPct`/`accumulatedProgressPct`, `qualityStatus`, `contractItemCode`), **trechos** (`trechos[]`: metros planejados/executados por `trechoCode`), **mão de obra** (`manpower` com headcounts + `employeeNames`, e `workforceRows` com `workerIds`/`hoursWorked`), **equipamentos** (nome, qtd, horas), **materiais** (`materials[]`: qtd, `unitCostBRL`/`totalCostBRL`, `source` almoxarifado/compra_direta, `stockItemId`/`depositoId` para baixa de estoque), fotos, observações, incidentes. Ao salvar cria o RDO já **finalizado** (o formulário padrão não gera rascunho) e cria apontamentos de mão de obra por `workforceRow`. [código: `NovoRdoPanel.tsx` — `addRdo(...)`, loop `addTimecard`]
- **RDO Compizzo** (`RdoCompizzoPanel.tsx`) — formulário do piso industrial: `servicos` (checklist booleano), `producao[]` (serviço + quantidade + `planningActivityId`), `materiais` (com `stockItemId`), `horasTrabalhadas` (RUP), snapshots `numeroContrato`/`bacOrcamentoBRL`/`precoM2` do Plano de Execução, ocorrências, planejamento do próximo dia. Tem **dois botões**: "Salvar Rascunho" (`handleSave('rascunho')`) e "Salvar RDO" (`handleSave('finalizado')`); ao finalizar dispara a ponte de apontamentos (`syncRdoToTimecards`) e pode criar atividades-mestre no Planejamento para linhas de produção novas. [código: `RdoCompizzoPanel.tsx:392`]
- **Histórico** (`HistoricoPanel.tsx`) — lista todos os RDOs (padrão/Compizzo/SABESP) com busca, filtro por data, cartão expansível, impressão (PDF) e exclusão. Para RDOs em **rascunho** exibe a ação **"Finalizar"** com validação leve (`rdoMissingForFinalize`: exige data, responsável, obra e ≥1 serviço/trecho/produção com quantidade). [código: `HistoricoPanel.tsx` — `handleFinalize`, `rdoMissingForFinalize`]
- **Financeiro do RDO** (`FinanceiroPanel.tsx`) — ledger financeiro **local do RDO** (`RdoFinancialEntry[]`, `budgetBRL`) que alimenta um EVM próprio do RDO (`computeEvm`). ⚠️ Isto é separado do módulo Financeiro real (`financeiroStore`); serve como visão rápida dentro do RDO. [código: `rdoStore.ts` — `addFinancialEntry`, `computeEvm`]
- **Previsto × Realizado** (`PrevistoRealizadoPanel.tsx`) — cruza o plano de execução com os RDOs (`planejadoVsExecutado(plano, rdos)`), mostrando m² executado vs planejado por período/obra.
- **Integração** (`IntegracaoPanel.tsx`) — Curva-S / análise de atraso lendo o Planejamento, mostrando como o RDO moveu o cronograma.

## Dados que gera

- **Entidade `RDO`** (`src/types/index.ts`): `id`, `number` (sequencial), `date`, `responsible`, `siteId` (obra), `status?: 'rascunho' | 'finalizado'` (ausente = finalizado), `template?: 'padrao' | 'compizzo'`, `services[]`, `trechos[]`, `materials[]`, `manpower`, `workforceRows[]`, `equipment[]`, `weather`, `photos[]`, `observations`, `incidents`, `compizzo?` (dados Compizzo). [código: `types/index.ts:1587+`]
- **Tabela Supabase `rdo`** (payload jsonb + colunas planas date/responsible/site_id/contract_no/service_order_no; `closed`; soft-delete `deleted_at`). O `status` fica dentro do `payload`. [schema: `rdoStore.ts` — `rdoToRow`/`rowToRdo`]
- **Fotos** em Supabase Storage, bucket **`rdo-photos`** (comprimidas no cliente antes do upload). [schema: migração `20260722130000_rdo_photos_bucket.sql`; código: `rdoPhotoStorage.ts`]

## Cálculos, KPIs e regras de negócio

- **Gate de rascunho (`isRdoFinalized`)** — `rdo.status !== 'rascunho'` (ausência de status = finalizado). Regra central: **rascunho não alimenta nenhum módulo**. Implementação: `syncExecutionToPlanejamento` agrega apenas RDOs finalizados; os eventos `rdo.closed`/`rdo.finalized` só são emitidos quando finalizado. [código: `rdoStore.ts` — `isRdoFinalized`, `syncExecutionToPlanejamento`, `addRdo`/`updateRdo`]
- **RUP (Compizzo)** = HH ÷ m² (`horasTrabalhadas` / produção em m²) — índice de produtividade real. [código: `RdoCompizzoPanel.tsx`]
- **Progresso físico** — `services[].accumulatedProgressPct`/`dailyProgressPct` e metros de trecho viram `percentComplete` das atividades-mestre (via meta da obra quando não há `plannedQuantity`). [código: `syncExecutionToPlanejamento`]
- **Badge de rascunhos** — `useAlertCounts` conta RDOs `status==='rascunho'` no item de menu `/app/rdo`. [código: `useAlertCounts.ts`]

## Integrações — a "camada única"

Ao **finalizar** um RDO, o mesmo dado se propaga (todos idempotentes/reconciliáveis):

| Destino | Mecanismo | Arquivo |
|---|---|---|
| **Planejamento** (executado, %, status) | `syncExecutionToPlanejamento()` (só finalizados; reconcilia-a-zero quem perdeu vínculo) → `planejamentoStore.syncExecutionFromRdo` + `planejamentoMestreStore.updateActivity` | `rdoStore.ts:410` |
| **Mão de Obra** (apontamentos + custo/dia) | `syncRdoToTimecards` — idempotente por `sourceRdoId` | `maoDeObraStore.ts:522` |
| **Estoque** (baixa de material) | **trigger de servidor** `trg_rdo_to_estoque` — idempotente por `rdo_id`, gated em `status='finalizado'` | migração `20260625120000_rdo_estoque_integration.sql` |
| **Financeiro** (custos: materiais + mão de obra) | `financeiroStore.syncRdoToFinanceiro(rdo)` — ids determinísticos por (rdo, categoria), upsert idempotente; receita fica na Medição | `financeiroStore.ts` |
| **Medição / LPS / Suprimentos** | evento `rdo.finalized` (eventBus) → recarregam | `eventBus.ts`; `medicaoUnificadaStore`, `lpsStore`, `suprimentosStore` |

**Reconciliação**: editar um RDO re-propaga; voltar para rascunho ou excluir **remove** as contribuições (planejamento zera, financeiro/timecards removem). O feed do Financeiro **não** lança receita (evita duplicar com Medição/Execução). [código]

## Eficiência gerada

- **Um lançamento, cinco módulos** — o encarregado preenche o RDO uma vez e o avanço físico, o custo de MO, a baixa de estoque, o custo no Financeiro e a medição faturável se atualizam sozinhos, em vez de 5 planilhas redigitadas. [inferido, com base nos elos reais acima]
- **Diretoria em tempo real** — o dado do canteiro chega ao EVM/DRE/Curva-S no mesmo dia, não no fechamento mensal. [inferido]
- **Rascunho seguro** — o encarregado salva o avanço e continua depois sem "sujar" os números da obra (gate). [código/inferido]
- **Menos erro de digitação** — materiais já vêm do almoxarifado com custo unitário; apontamentos herdam o custo/dia do cadastro de trabalhadores. [código]

## Como sincroniza

Local-first: mutações otimistas enfileiradas em `pendingSync[]` e drenadas por `flushQueue` contra o Supabase quando online/autenticado; **funciona offline** (canteiro) e sincroniza depois. Fotos vão comprimidas para o Storage (bucket `rdo-photos`). Multi-tenant por `organization_id` + RLS; exclusão via aprovação (`request_action('delete_rdo')`). Realtime: o app escuta a tabela `rdo` por org e re-puxa em mudanças cross-usuário. [código: `rdoStore.ts`, `storeSync.ts`, `realtime.ts`]
