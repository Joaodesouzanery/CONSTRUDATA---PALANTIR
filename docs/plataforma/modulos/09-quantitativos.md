# Quantitativos e Orçamento

> **Rota(s):** `/app/quantitativos` (registrada em `src/App.tsx:148`, lazy import em `src/App.tsx:22`) · **Store(s):** `quantitativosStore` (`src/store/quantitativosStore.ts`) + estado local do painel Personalizado em `localStorage` (`cdata-quantitativo-personalizado-v6-*`) · **Grupo na sidebar:** **PLANEJAMENTO** (`src/components/shared/Sidebar.tsx:51`, ícone `Calculator`)

---

## O que é / problema que resolve

O módulo Quantitativos e Orçamento é a ferramenta de **levantamento de quantidades (BOQ — Bill of Quantities)** e **composição de orçamento** da ConstruData. Ele substitui a planilha de orçamento tradicional: o usuário monta a lista de serviços/materiais de uma obra, associa custos unitários vindos de bases de referência (SINAPI, SEINFRA ou base própria), aplica o BDI (Benefícios e Despesas Indiretas) e obtém o custo total da obra com rastreabilidade por item e por fonte. O cabeçalho declara o posicionamento: "SINAPI · SEINFRA · Base Própria" (`QuantHeader.tsx:44`).

O módulo cobre dois níveis de trabalho. Um nível **simples/rápido** (aba Composição), onde cada linha do orçamento é `quantidade × custo unitário × (1 + BDI/100)` — adequado para qualquer tipo de obra (saneamento, edificação, pavimentação, geral). E um nível **profundo de engenharia** (aba Quantitativo Personalizado), que é um substituto funcional completo de uma planilha "Memorial Cálculo - Quantitativo V6" (`QuantitativoPersonalizadoPanel.tsx:172`): a partir de trechos de rede e poços de visita, o sistema **deriva automaticamente** volumes de escavação, escoramento, berço, envolvimento, reaterro/bota-fora, recomposição de pavimento, listas de materiais com perdas, dias de produção e Curva ABC — tudo com fórmulas de geometria de vala explícitas em código.

O dado gerado aqui não fica isolado: um orçamento salvo alimenta requisições de compra (Suprimentos), custos 5D do BIM e a aba de orçamento de projeto (Projetos). É, na prática, a origem do "quanto vai custar" e do "quanto vamos comprar" da obra.

## Para quem (papéis / persona)

- **Orçamentista / Engenheiro de custos:** monta a composição, escolhe a base de custos, ajusta BDI, exporta e salva o orçamento.
- **Planejador / Engenheiro de projeto:** usa o Quantitativo Personalizado para dimensionar redes de saneamento/drenagem trecho a trecho e transformar isso em orçamento.
- **Gerente / Diretor:** consome o Resumo de Custos (distribuição por categoria e por fonte, meta orçamentária) e aprova exclusões de orçamentos/base própria (matriz de aprovação).
- **Suprimentos:** consome orçamentos salvos para gerar requisições de material (BOM pendente).

Do lado de escrita no servidor, o RLS exige papel em `['planejador','engenheiro','gerente','diretor','owner']` para insert/update (`0027_grupo_nucleo_rls.sql:70,96`); a exclusão de orçamento/base é bloqueada por policy direta e passa por aprovação de `gerente` por padrão (`0028_grupo_nucleo_rpcs.sql:47-48`). [schema]

---

## Funcionalidades detalhadas

O módulo tem 5 abas (`QuantHeader.tsx:14-20`), navegadas por `activeTab` no store. Além delas, o cabeçalho traz ações globais e há dois wizards modais.

### Cabeçalho global (`QuantHeader.tsx`)
- Título "Quantitativos e Orçamento", accent violeta `#8b5cf6`.
- **Calcular** (`QuantHeader.tsx:50`): abre o `CalcWizardModal` (fluxo estilo OrçaFácio, 3 passos — ver abaixo).
- **Criar Orçamento** (`QuantHeader.tsx:58`): abre o `CriarOrcamentoWizard` (só aparece quando `onCreateBudget` é passado).
- **Importar** (`QuantHeader.tsx:68`): abre `ImportModal` genérico com `ORCAMENTO_IMPORT_CONFIG` — aceita `.xlsx/.xls/.csv` no template Atlântico, mapeia colunas por aliases e faz commit via `addItems` (`QuantHeader.tsx:96-105`).
- **CSV** e **Excel (.xlsx)** (`QuantHeader.tsx:76,83`): exportam a composição atual via `exportEngine`.

### Empty state (`index.tsx:62-135`)
Quando não há itens e a aba é Composição, mostra um fluxo visual de 4 passos ("Escolher Base → Montar Itens → Calcular BDI → Exportar") e três caminhos de entrada: **Criar Orçamento do Zero** (wizard), **Importar Orçamento Existente** (dispara o input de import via `[data-quant-import]`), **Carregar Exemplo** (`loadDemoData`). Há ainda um botão para baixar o template `.xlsx` padronizado com abas "Orçamento" + "Instruções" (`index.tsx:37-59`).

### Aba 1 — Composição (`ComposicaoPanel.tsx`)
Tabela editável dos itens do orçamento (`currentItems`). É o coração CRUD do módulo.
- **Tabela com edição inline** (`ComposicaoPanel.tsx:782-817`): cada célula (código, descrição, unidade, quantidade, custo unitário, BDI%, categoria) é um `EditCell` clicável; ao salvar quantidade/custo/BDI o `totalCost` é recalculado. Coluna "Total c/ BDI" e badge de "Fonte" (SINAPI/SEINFRA/CUSTOM/MANUAL, cores em `SOURCE_BADGE`). Rodapé com "TOTAL GERAL".
- **Ordenação** por código, descrição, total ou categoria (`handleSort`, `ComposicaoPanel.tsx:651`).
- **Adicionar Item** (`ComposicaoPanel.tsx:700`): abre o `SinapiSearchDialog` — busca em `mockSinapi` por código/descrição, define quantidade e adiciona o item com o custo unitário da base e o BDI global (`ComposicaoPanel.tsx:84-96`).
- **Importar Rede** (`ComposicaoPanel.tsx:707`): abre o `NetworkImportModal`, com 2 sub-abas:
  - *Redes Prontas:* templates de `NETWORK_TEMPLATES` (`src/data/mockNetworks.ts`), definidos por 100 m; o usuário informa o comprimento e as quantidades são **escaladas proporcionalmente** (`scale = length / template.perMeters`, `ComposicaoPanel.tsx:477`). Mostra prévia com total já com BDI.
  - *Importar Arquivo* (`FileUploadTab`): parsers próprios para `.txt`/`.csv` (`parseTxt`), `.dxf` (`parseDxf` — soma comprimentos de `LINE` e `LWPOLYLINE` para gerar quantidades lineares em metros) e `.shp` (`parseShp` — lê o header binário do shapefile e estima extensão pela diagonal do bounding box). `.dwg` é recusado com orientação de converter para DXF (`ComposicaoPanel.tsx:335`).
- **Importar da Pré-Construção** e **Importar do Suprimentos** (`ComposicaoPanel.tsx:713,720`): puxam itens de outros stores (ver Integrações).
- **Salvar Orçamento** (`ComposicaoPanel.tsx:727`): abre `SaveDialog` (nome obrigatório + descrição) e persiste via `saveBudget`.
- Exportações **CSV / Excel / PDF** (`window.print()`) e **Reiniciar** (limpa `currentItems` com confirmação). Há cabeçalho/rodapé específicos para impressão (`ComposicaoPanel.tsx:693,833`).

### Aba 2 — Quantitativo Personalizado (`QuantitativoPersonalizadoPanel.tsx` + `personalizadoEngine.ts`)
O motor de engenharia. Um wizard de **14 etapas** (`QuantitativoPersonalizadoPanel.tsx:32-47`): Instruções, Parâmetros, Trechos de Rede, PVs, Acessórios Manuais, Produção, Quantitativos, Lista de Materiais, Orçamento, Resumo, BDI e Indiretos, Base SINAPI, Levantamento e Orçamento, Curva ABC.

Estado próprio, persistido em `localStorage` chaveado por `cdata-quantitativo-personalizado-v6-*` (params/trechos/pvs/acessorios/bdi/base) via `usePersistedRows` — com bypass em modo demo (`QuantitativoPersonalizadoPanel.tsx:64-80`). KPIs de topo: Esgoto, Água, Drenagem, Escavação total e Total com BDI.

Entradas editáveis:
- **Parâmetros** (`step 1`): ~40 premissas editáveis (perdas de tubo, % reaproveitamento, larguras mínimas de vala por DN, folgas laterais, fatores de empolamento/compactação por solo, espessuras de berço/envolvimento/base de PV, produtividades, taxa de aço, acessórios por 100 m). Defaults em `defaultParams` (`personalizadoEngine.ts:237-280`).
- **Trechos de Rede** (`step 2`): a maior tabela do sistema — o usuário informa nome, rede (Esgoto/Água/Drenagem), material do tubo, DN, DE, comprimento, profundidades, solo, superfície etc.; ~40 colunas **calculadas** são derivadas por trecho (`personalizadoEngine.ts:265`).
- **PVs / Estruturas** (`step 3`): diâmetro interno, profundidade → volumes de escavação/base/paredes, área de forma, armadura estimada, tampões, degraus.
- **Acessórios Manuais** (`step 4`): registros, ventosas, bocas de lobo, sarjetas etc. por rede.
- **BDI e Indiretos** (`step 10`): componentes editáveis (Adm. central, impostos, seguros, riscos…) somados no BDI total.
- **Base SINAPI** (`step 11`): base de preços de referência editável (`defaultBaseRefs`), vinculada aos itens por código.

Saídas calculadas (somente leitura): Produção (dias por serviço), Quantitativos (lista de serviços com critério), Lista de Materiais (tubos agregados por rede+material+DN com perdas, PVs, acessórios), Orçamento (linhas com código de referência), Resumo (indicadores) com um **painel de QA** que compara o cenário-exemplo contra valores esperados (`qaExpected`, `personalizadoEngine.ts:709`), Levantamento detalhado (PU direto, custo direto, PU c/ BDI, participação) e **Curva ABC** (classes A/B/C por acumulado). O BDI total calculado aqui é propagado ao store global via `setBdiGlobal(calc.bdiTotal)` (`QuantitativoPersonalizadoPanel.tsx:142`).

### Aba 3 — Resumo de Custos (`ResumoPanel.tsx`)
Análise agregada da composição da aba 1.
- **Configuração do BDI decomposto** em 5 componentes (Adm. Central, ISS, PIS/COFINS, Seguro, Lucro — `DEFAULT_BDI`, `ResumoPanel.tsx:21`); soma → "BDI Total Calculado"; botão **Aplicar a todos os itens** grava o BDI em cada item e no `bdiGlobal` (`handleApplyBdiToAll`, `ResumoPanel.tsx:57`).
- **Gráfico de barras** de distribuição por categoria (SVG, top 10).
- **Tabela Resumo por Categoria** com subtotal s/ BDI, BDI médio, total c/ BDI e % do total; linhas expansíveis editam qtd/custo/BDI item a item (`ResumoPanel.tsx:183-199`).
- **Card de Total Geral** com subtotal, valor de BDI, e uma **meta orçamentária (budget cap)** persistida em `sessionStorage` que mostra o delta (Δ R$ e %) contra o total (`ResumoPanel.tsx:248-256`).
- **Donut de distribuição por Fonte** (SINAPI/SEINFRA/Personalizada/Manual, SVG, `ResumoPanel.tsx:261-318`).

### Aba 4 — Banco de Dados (`BancoDadosPanel.tsx`)
Gestão das bases de custo.
- Seletor de base ativa (`costBase`): **SINAPI** (`mockSinapi`), **SEINFRA** (`mockSeinfra`) ou **Base Própria** (`customBase`), cada card mostrando a contagem de entradas.
- **Aviso de auditoria de fonte** (`sourceAudit`, `BancoDadosPanel.tsx:128`): deixa explícito que SINAPI/SEINFRA aqui são **amostras locais** (mock), não o download oficial da CAIXA, orientando a importar o XLSX oficial como Base Própria para preços atualizados. Para SINAPI, link à fonte oficial CAIXA.
- Para Base Própria: **importar Excel/CSV** (`parseExcelToCustomBase`, com detecção de colunas por aliases), **exportar CSV/Excel** e CRUD inline de entradas (`EntryRow` editável + `AddEntryRow`). Busca por código/descrição/categoria.

### Aba 5 — Histórico (`HistoricoPanel.tsx`)
Grade de orçamentos salvos (`savedBudgets`), ordenados por `updatedAt` desc. Cada card mostra nome, badge da base, total (R$), nº de itens, BDI global, data de referência e data de atualização. Ações: **Carregar** (substitui a composição atual com confirmação e volta para a aba Composição) e **Excluir** (com confirmação → `deleteBudget`). Botão "Salvar Orçamento Atual" reabre o `SaveDialog`.

### Wizard "Criar Orçamento do Zero" (`CriarOrcamentoWizard.tsx`)
Modal de 3 passos (accent laranja `#f97316`): (1) tipo de obra — saneamento/edificação/pavimentação/geral; (2) base de custo + BDI (slider 0–50, input 0–100) + checkbox "incluir 5 itens iniciais"; (3) confirmação. Ao criar, chama `createBlankBudget`, que **substitui** `currentItems` por itens placeholder (qtd=0, custo=0) do tipo de obra escolhido (templates em `quantitativosStore.ts:189-218`) — o usuário só preenche números. Avisa que a ação substitui o orçamento em edição.

### Wizard "Calcular Quantitativo" (`CalcWizardModal.tsx`)
Modal de 3 passos estilo OrçaFácio: (1) escolher base de custo (com opção de importar planilha de preços como Base Própria, parsing por aliases de coluna e `toNum` que trata formatos BR/US de número — `CalcWizardModal.tsx:23-34`); (2) revisar itens com qtd/custo editáveis e subtotal s/ BDI; (3) BDI global (slider) → resumo (subtotal, BDI, total) + breakdown por categoria (mini Curva ABC). Ao calcular, aplica `setBdiGlobal` + `calculateBudget` e permite **salvar como orçamento** direto do modal.

---

## Dados que gera

### Entidades no cliente (tipos em `src/types/index.ts:1799-1839`)
- **`OrcamentoItem`** (`types/index.ts:1804`): `id, code, description, unit, quantity, unitCost, bdi, totalCost, category, source (CostBaseSource), notes?`. `totalCost = quantity × unitCost × (1 + bdi/100)`.
- **`OrcamentoBudget`** (`types/index.ts:1818`): `id, name, description?, costBase, items[], bdiGlobal, totalBRL, referenceDate (yyyy-MM), createdAt, updatedAt`.
- **`CustomBaseEntry`** (`types/index.ts:1831`): `id, code, description, unit, unitCost, category, source` (ex.: "Importado Excel" / "Manual").
- `CostBaseSource = 'sinapi' | 'seinfra' | 'custom' | 'manual'`; `QuantTab = 'composicao' | 'personalizado' | 'resumo' | 'banco' | 'historico'`.

### Tabelas Supabase (migração `0024_quantitativos.sql`) [schema]
- **`public.quantitativos_budgets`** (`0024_quantitativos.sql:6`): 1 linha por orçamento. Colunas-chave: `id (uuid PK)`, `organization_id (FK organizations, ON DELETE CASCADE)`, `project_id (FK projects, ON DELETE SET NULL)`, `name`, `cost_base`, `bdi_global (numeric 5,2)`, `total_brl (numeric 14,2)`, `reference_date`, `payload (jsonb)` — guarda `items[]` e `description`, `created_by`, `created_at/updated_at`, `deleted_at` (soft delete). Índices por org, org+created_at, org parcial ativo e project.
- **`public.quantitativos_custom_base`** (`0024_quantitativos.sql:26`): entradas reutilizáveis cross-orçamento. `id, organization_id, code, description, unit, unit_cost (numeric 12,2), category, payload (jsonb), created_by, timestamps, deleted_at`. Constraint `UNIQUE (organization_id, code)` (`0024_quantitativos.sql:39`).

O mapeamento cliente→linha está em `budgetToRow` / `customBaseToRow` (`quantitativosStore.ts:25-51`), com o objeto de domínio inteiro serializado em `payload`.

---

## Cálculos, KPIs e regras de negócio

### Composição (fórmula base)
`totalCost = quantity × unitCost × (1 + bdi/100)` — em `calcTotal` (`quantitativosStore.ts:120`) e reaplicada em `updateItem`/`calculateBudget`. `setBdiGlobal` é clampeado em `[0,100]` (`quantitativosStore.ts:388`).

### BDI decomposto (Resumo)
`BDI total = Adm.Central + ISS + PIS/COFINS + Seguro + Lucro` (defaults 4 + 3 + 3,65 + 0,8 + 7,5 = 18,9%; `ResumoPanel.tsx:21`). No `CalcWizardModal`, o BDI é aplicado de forma multiplicativa simples: `total = subtotal × (1 + bdi/100)`.

### Curva ABC (Quantitativo Personalizado, `makeCurvaAbc`, `personalizadoEngine.ts:629`)
Ordena as linhas do levantamento por `totalBdi` desc, acumula o percentual e classifica: **A** (acumulado ≤ 80%), **B** (≤ 95%), **C** (> 95%).

### Motor de quantitativos de rede (`personalizadoEngine.ts`) — regras de engenharia
Por trecho (`calcTrecho`, `personalizadoEngine.ts:348`):
- **Largura da vala**: `larguraAuto = max(DE/1000 + 2×folga, larguraMin)`, com folga/largura mínima escalonadas por faixa de DN (≤150 / 200–400 / >400).
- **Seção e volume**: `áreaSeção = largura × profMédia`; `volEscavação = comprimento × áreaSeção`.
- **Escoramento**: aciona ("SIM") quando `profMédia ≥ 1,25 m` (parâmetro); `áreaEscoramento = 2 × comprimento × profMédia`.
- **Berço/Envolvimento**: `vol = comprimento × largura × espessura` (espessura por rede).
- **Volume de tubo** (deslocado): `π × (DE/1000)²/4 × comprimento`.
- **Volume líquido a reaterrar** = escavação − berço − envolvimento − tubo (mín. 0).
- **Reaterro reaproveitado / importado** por `% reaproveitamento`; **bota-fora empolado** = importado × fator de empolamento (Argila 1,25 / Areia 1,15 / Rocha 1,5).
- **Recomposição de pavimento**: área e volumes de sub-base/revestimento por tipo de superfície (Asfalto/Concreto/Bloco).
- **Tubo com perdas** = comprimento × (1 + % perda); **teste/desinfecção** só para rede de Água.
- **Acessórios automáticos** (curvas/tês/registros/ventosas) por regra "por 100 m".
- **Dias**: escavação = volEscavação / produtividade; assentamento = comprimento / produtividade; recomposição = área / 80.

Por PV (`calcPv`, `personalizadoEngine.ts:425`): dimensão externa = `Ø interno + 2×esp. parede`; lado de escavação = `+ 2×folga`; volumes de escavação/base/paredes cilíndricas, área de forma, `armadura = volParedes × taxa de aço`, degraus = `ceil((prof − 1)/0,3)`. PV de drenagem é detectado por "DR" no nome (`isDrenagem`).

### Levantamento e totais (`calculatePersonalizado`, `personalizadoEngine.ts:641`)
`custoDiretoTotal = Σ custoDireto`; `totalComBdi = Σ (quantidade × PU × (1 + BDI/100))`; PU c/ BDI = `PU × (1 + bdiTotal/100)`. `Totals` agrega extensões por rede, escavação total, reaterro, bota-fora, recomposição, contagem de PVs, tubo total com perdas e dias totais. O painel de **QA** valida o cenário-exemplo contra `qaExpected` (ex.: extensão esgoto 120 m, escavação total 422,1 m³, BDI 27,5%, dias 24,18; tolerância 0,02 — `QuantitativoPersonalizadoPanel.tsx:157`).

---

## Integrações — a "camada única"

### O que este módulo CONSOME de outros módulos
- **Pré-Construção** (`importFromPreConstrucao`, `quantitativosStore.ts:236`): lê `preConstrucaoStore` (lazy, read-only) e traz os `costMatches` marcados como `selected`, casando com `takeoffItems` (usa `normalizedQuantity`), gerando itens de orçamento na categoria "Pré-Construção" com o BDI global corrente.
- **Suprimentos** (`importFromSuprimentos`, `quantitativosStore.ts:274`): achata `purchaseOrders[].items` de `suprimentosStore` em itens de orçamento (categoria "Suprimentos", fonte "manual").
- **Bases de referência**: `mockSinapi`, `mockSeinfra`, `NETWORK_TEMPLATES` — dados locais consumidos nas abas Composição/Banco.

### O que este módulo ALIMENTA
- **Suprimentos (requisições do planejado)** — a integração de servidor mais forte. A RPC `gerar_requisicoes_suprimentos(p_budget_id)` (`APPLY_PENDENTE_20260722.sql:558`) lê `quantitativos_budgets.payload.items[]` e faz **upsert idempotente** em `suprimentos_itens` com `status='pend'`, chaveado por `origem='quantitativos'` + `origem_ref` (`budget_id:item_id`) — re-rodar **atualiza, não duplica** (`APPLY_PENDENTE_20260722.sql:620-641`). Cria automaticamente núcleo/rua "Planejamento" se não existirem. A UI está em `BomPendentePanel.tsx` (Suprimentos): seleciona um orçamento salvo e chama `gerarRequisicoesDoPlanejado` (`BomPendentePanel.tsx:100`), reportando `created/updated/skipped`.
- **BIM 5D** (`bimStore.syncWithQuantitativos`, `bimStore.ts:470`): casa segmentos BIM com `currentItems` por `dn{diameter}` na descrição ou por `trechoCode == code`, e grava `unitCostBRL`/`totalCostBRL` no segmento (custo 5D). Disparado pelo botão "Quantitativos" no `Bim5DPanel.tsx:12,94`.
- **Projetos → aba Orçamento** (`TabOrcamento.tsx:46,56`): filtra `currentItems` que referenciam o código do projeto (na descrição, categoria ou notas) e exibe como "Quantitativos Vinculados".
- **Custo estimado no wizard de Pré-Construção / matriz de KPIs**: o Quantitativo Personalizado propaga seu `bdiTotal` ao `bdiGlobal` global, base para os cálculos das outras abas.

### eventBus / triggers / realtime
- **eventBus** (`src/lib/eventBus.ts`): este módulo **não** publica nem assina eventos — não há referências a `eventBus` em `features/quantitativos` nem em `quantitativosStore` (grep vazio). A propagação para Suprimentos/BIM é feita por leitura direta cross-store (lazy import) ou por RPC de servidor, não por eventos.
- **realtime** (`src/lib/realtime.ts`): as tabelas `quantitativos_*` **não** têm subscription de realtime (grep = 0 ocorrências). A sincronização é local-first com push/pull sob demanda (ver abaixo). [código]
- **Triggers de servidor**: exclusões passam pela RPC de aprovação `request_action` → `process_action`, que faz o soft-delete (`0028_grupo_nucleo_rpcs.sql:171-174`). O snapshot do tenant (`0028`/`0034`) inclui `quantitativos_budgets` e `quantitativos_custom_base` no export (`0028_grupo_nucleo_rpcs.sql:250-251`).

---

## Eficiência gerada

- **Menos planilha / dado único:** o Quantitativo Personalizado é declaradamente um "substituto funcional da planilha Memorial Cálculo - Quantitativo V6" (`QuantitativoPersonalizadoPanel.tsx:172`) — as ~40 colunas derivadas por trecho e a Curva ABC que antes eram fórmulas de Excel viram cálculo versionado em código, com painel de QA embutido. [código]
- **Automação do levantamento:** a partir de poucos inputs por trecho (rede, DN, comprimento, profundidade, solo, superfície), o sistema deriva automaticamente volumes de escavação, escoramento, reaterro, bota-fora, recomposição, listas de materiais com perdas e dias de produção — eliminando o cálculo manual de geometria de vala. [inferido — ganho de tempo]
- **Rastreabilidade de custo por fonte:** cada item carrega `source` (SINAPI/SEINFRA/CUSTOM/MANUAL) e o donut de fontes torna auditável de onde veio cada real do orçamento; o aviso de auditoria no Banco de Dados evita que amostra mock seja confundida com base oficial. [código]
- **Do orçamento à compra, sem redigitar:** um orçamento salvo vira requisição de material em Suprimentos por RPC idempotente (`gerar_requisicoes_suprimentos`) — o "planejado" alimenta o "comprado" sem duplicar itens ao reprocessar. [código]
- **Um número, vários módulos:** o mesmo orçamento alimenta custo 5D no BIM e a aba de orçamento em Projetos, garantindo que planejamento, custo e compras falem o mesmo total. [inferido]
- **Importação flexível:** templates de rede escaláveis, importação de CAD (DXF/SHP) e Excel/CSV com mapeamento automático de colunas reduzem o retrabalho de digitação a partir de fontes existentes. [código]

## Como sincroniza

**Local-first.** O `quantitativosStore` usa `persist` do Zustand na chave `cdata-quantitativos` (`quantitativosStore.ts:447`), persistindo `currentItems, savedBudgets, customBase, costBase, bdiGlobal, pendingSync, lastSyncedAt` (`partialize`, `quantitativosStore.ts:448`). O estado da aba Quantitativo Personalizado é persistido separadamente em `localStorage` (`cdata-quantitativo-personalizado-v6-*`).

**Push (flush) via fila de operações.** Escritas que devem ir ao servidor — `saveBudget`, `deleteBudget`, `importCustomBase`, `addCustomEntry`, `removeCustomEntry` — enfileiram `PendingOp` com `makeOp` (`storeSync.ts`) e chamam `flush()`. O `flush` respeita offline (`navigator.onLine` → status `offline`) e ausência de auth (status `unauth`), despachando via `flushQueue` para `upsert(onConflict:'id')` nas tabelas `quantitativos_budgets` / `quantitativos_custom_base` (`quantitativosStore.ts:419-435`). Um listener de `window 'online'` re-dispara o flush ao reconectar (`quantitativosStore.ts:461-464`). Observação: a **edição inline de itens da composição** (`updateItem`) e o `calculateBudget` alteram apenas o estado local — só são persistidos no servidor quando o orçamento é salvo como `OrcamentoBudget`. [código]

**Exclusão gated por aprovação.** `deleteBudget`/`removeCustomEntry` não deletam direto: enfileiram um op de `type:'delete'` com `approvalActionType` (`delete_quantitativo_budget` / `delete_quantitativo_custom_base`), que no servidor vira uma chamada `request_action` (`storeSync.ts:208-211`) — a policy de DELETE das tabelas é `USING (false)` (`0027_grupo_nucleo_rls.sql:81,107`), e o soft-delete (`deleted_at = now()`) só acontece via `process_action` após aprovação do papel exigido (default `gerente`). [schema]

**Pull.** `pull()` (`quantitativosStore.ts:437`) reidrata `savedBudgets` e `customBase` a partir de `pullTable(...)`, pulando tabelas que ainda têm ops pendentes (evita sobrescrever escrita local não sincronizada). No boot/login, o cascade de auth aplica `ensureTenantScope` ou, na ausência dele, `clearData()` — como este store **não** expõe `ensureTenantScope`, ele cai no `clearData` ao trocar de contexto (`auth.ts:105-115`); a reidratação depende do snapshot/pull. [inferido]

**RLS multi-tenant.** Todas as linhas são isoladas por `organization_id = public.user_org()` com `deleted_at IS NULL` no SELECT; INSERT/UPDATE exigem `organization_id` do usuário, `created_by = auth.uid()` e papel em `['planejador','engenheiro','gerente','diretor','owner']` (`0027_grupo_nucleo_rls.sql:60-107`). `FORCE ROW LEVEL SECURITY` está ativo em ambas as tabelas.

**Offline.** Suportado: os dados vivem no `localStorage`, ops ficam na fila até haver rede/auth; o `flush` marca status (`idle/syncing/offline/unauth/error`) e há timeout de segurança por requisição em `storeSync` para não travar o indicador de sincronização em rede de canteiro ruim.
