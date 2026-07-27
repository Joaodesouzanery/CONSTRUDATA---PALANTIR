# Mapa Interativo

> **Rota(s):** `/app/mapa-interativo` → **redireciona** para `/app/torre-de-controle?aba=mapa-interativo` (aba dentro da Torre de Controle) · **Store(s):** `mapaInterativoStore` (`cdata-mapa-interativo`) · **Grupo na sidebar:** `projetos`

## O que é / problema que resolve

O Mapa Interativo é um **editor GIS de redes** sobre mapa Leaflet, voltado a obras de infraestrutura (saneamento) e edificação/civil. Ele permite desenhar, importar, medir, analisar e exportar uma rede de **nós (pontos) e trechos (segmentos)** georreferenciados — poços de visita (PV), estações elevatórias (EE), pontas de rede (EP), tubulações de esgoto/água/drenagem — diretamente sobre imagens de satélite ou cartografia [código: `src/features/mapa-interativo/index.tsx`, `MapaCanvas.tsx`].

O problema que resolve é a **fragmentação entre o cadastro topográfico/CAD e a gestão de obra**. Em vez de manter as coordenadas em planilhas UTM, arquivos DXF do projetista e um cronograma à parte, o módulo unifica: importa coordenadas UTM (com conversão automática para WGS84), lê geometria de DXF/SHP, plota a rede no mapa, e cruza esses trechos com o **Planejamento (cronograma)** e com **custos** por tipo de rede para gerar visões 3D (perfil de elevação), 4D (execução no tempo) e 5D (custo) [código: `MapaAnalyticsPanel.tsx`, `MapaImportModal.tsx`].

Ao abrir pela primeira vez, o módulo exige a escolha de um **modo de trabalho** — Saneamento (esgoto/água/drenagem) ou Construção (civil/genérico) — que pré-configura quais camadas ficam visíveis [código: `index.tsx:16-67`, `mapaInterativoStore.ts:357-373`].

## Para quem (papéis / persona)

- **Engenheiro / Planejador** — cadastram e editam a rede, importam coordenadas do projeto, medem distâncias, exportam para SIG/CAD. São os papéis com permissão de escrita na tabela (RLS) [schema: `0030_frotas_geo_rls.sql:284-292`].
- **Gerente / Diretor / Owner** — também têm escrita pela RLS; tipicamente consomem as análises 4D/5D para acompanhamento de custo e prazo [schema: `0030_frotas_geo_rls.sql:287,291`].
- **Topógrafo / Projetista (indireto)** — fornecem os arquivos `.txt`/`.csv` UTM, `.dxf` e `.shp` que alimentam o mapa via importação.
- Os demais papéis (fora da lista `engenheiro, planejador, gerente, diretor, owner`) só conseguem **ler** o mapa da organização [schema: `0030_frotas_geo_rls.sql:282-283`].

## Funcionalidades detalhadas

### 0. Seletor de modo (overlay inicial)
Quando `mapMode === null`, a página exibe um overlay com dois cartões: **Saneamento** (Droplets — chips Esgoto/Água/Drenagem) e **Construção** (HardHat — chips Civil 3D/Genérico) [código: `index.tsx:16-67`]. Escolher o modo chama `setMapMode`, que liga as camadas correspondentes e desliga as demais (Saneamento → `sewer/water/drainage` visíveis; Construção → `civil/generic` visíveis) [código: `mapaInterativoStore.ts:357-373`]. Após escolher, uma faixa mostra "Modo: Saneamento/Construção" com botão **Trocar Modo** (volta o `mapMode` para `null`) [código: `index.tsx:86-102`].

### 1. Cabeçalho / Barra de ferramentas (`MapaHeader`)
Linha 1 mostra o título e o contador `{n} pts · {m} trechos` [código: `MapaHeader.tsx:165-167`]. Linha 2 é a barra de ferramentas rolável:

- **Demo** — só aparece em modo demo; recarrega os dados de exemplo (`loadDemoData`) [código: `MapaHeader.tsx:173`].
- **Desfazer** — `undo`, desabilitado quando `history` vazio (histórico de até 20 snapshots) [código: `MapaHeader.tsx:174`, `mapaInterativoStore.ts:180-183,313-322`].
- **Limpar** — `clearAll` (esvazia nós e trechos, empurra snapshot pro histórico) [código: `mapaInterativoStore.ts:324-329`].
- **Salvar** / **Carregar** — baixa/abre um `.json` local com `{ nodes, segments }` [código: `MapaHeader.tsx:123-150`].
- **Ferramentas de edição** (togglam `activeTool`): **Adicionar Ponto** (`addNode`), **Ligar Pontos** (`connect`), **Excluir Nós** (`deleteNode`), **Excluir Trechos** (`deleteSegment`), **Medir Distância** (`measure`), **Modo Estrutura** (`structure`) [código: `MapaHeader.tsx:29-36,182-191`].
- **Mover em Massa** — botão presente porém com handler vazio (`onClick={() => {}}`), sem efeito [código: `MapaHeader.tsx:193`]. [inferido] funcionalidade ainda não implementada.
- **Transf. CRS** — abre o modal de conversão UTM↔WGS84 [código: `MapaHeader.tsx:198`].
- **Zona UTM** — `select` com 18S…25N; grava em `state.utmZone` [código: `MapaHeader.tsx:27,199-205`].
- **Basemap** — `select`: Satélite / Ruas (Voyager) / Escuro / Claro / Relevo [código: `MapaHeader.tsx:210-220`].
- **Importar BIM** — puxa `project.segments` do `bimStore`, converte vértices (x,z) para lat/lng (base Salvador + `SCALE 0.00001`) e cria nós+trechos `civil` rotulados por `trechoCode` [código: `MapaHeader.tsx:68-96`].
- **Import. Trechos** — puxa `scenarios[0].trechos` do `planejamentoStore` e plota cada trecho como 2 nós + 1 segmento `sewer` rotulado pelo `code` [código: `MapaHeader.tsx:98-121`].
- **Importar** / **Exportar** — abrem `MapaImportModal` / `MapaExportModal`.
- **Análise 3D/4D/5D** — alterna o painel `MapaAnalyticsPanel` [código: `MapaHeader.tsx:237-242`, `index.tsx:108`].
- **Seletor de projeto** — `select` das obras do `projetosStore`; grava `selectedProjectId` (vai para `project_id` da linha no banco) [código: `MapaHeader.tsx:247-256`, `mapaInterativoStore.ts:205`].
- **Pílulas de Tipo de rede** — Esgoto/Água/Drenagem/Civil/Genérico definem `activeNetworkType`, usado ao criar trechos com a ferramenta Ligar Pontos [código: `MapaHeader.tsx:262-276`, `MapaCanvas.tsx:140`].

### 2. Canvas do mapa (`MapaCanvas`)
Renderiza Leaflet via `react-leaflet` (`MapContainer`, `TileLayer`, `CircleMarker`, `Polyline`) [código: `MapaCanvas.tsx:6`]. Tiles disponíveis: **satellite** (Esri World Imagery), **streets** (Carto Voyager), **dark** e **light** (Carto), **outdoors** (OpenTopoMap) [código: `MapaCanvas.tsx:29-43`].

- Interações por ferramenta (`useMapEvents.click`): `addNode` cria nó `junction`; `structure` cria nó `structure`; `measure` coleta 2 pontos e mostra `alert("Distância: X m")` via Haversine, depois volta a ferramenta pra `idle` [código: `MapaCanvas.tsx:83-107`].
- Clique em nó: `deleteNode` remove o nó (e trechos ligados a ele); `connect` guarda o 1º nó (`pendingConnectNodeId`) e no 2º cria o segmento com `activeNetworkType` [código: `MapaCanvas.tsx:131-145`].
- Clique em trecho: `deleteSegment` remove o segmento [código: `MapaCanvas.tsx:195-201`].
- **Cores** — nós por tipo (junction azul `#3b82f6`, endpoint verde `#22c55e`, structure laranja `#f97316`); trechos por tipo de rede (`sewer` laranja, `water` azul, `drainage` verde, `civil` cinza, `generic` violeta) [código: `MapaCanvas.tsx:13-25`]. Trechos de camadas ocultas não são desenhados [código: `MapaCanvas.tsx:179-180`].
- `FitBoundsOnLoad` enquadra os nós na 1ª carga; o centro-padrão é o centroide dos nós ou o fallback de Salvador (`-12.9714, -38.5014`) [código: `MapaCanvas.tsx:59-76,158-163`].
- O cursor muda conforme a ferramenta (crosshair, cell, not-allowed, grab) [código: `MapaCanvas.tsx:148-156`].

### 3. Painel de camadas (`MapaLayersPanel`)
Painel colapsável no canto superior direito com um checkbox por camada (Esgoto, Água, Drenagem, Civil, Genérico), controlando `layer.visible` via `setLayerVisible` [código: `MapaLayersPanel.tsx:9-53`, `mapaInterativoStore.ts:25-31,333-336`].

### 4. Painel de análise 3D/4D/5D (`MapaAnalyticsPanel`)
Três abas [código: `MapaAnalyticsPanel.tsx:384-424`]:

- **Perfil 3D** — perfil de elevação em SVG. Encadeia os segmentos a partir de um nó inicial (que aparece como `fromNodeId` mas nunca como `toNodeId`) para montar um caminho ordenado; calcula distâncias cumulativas (Haversine) e plota elevação vs. distância, com KPIs de Elevação Mín./Máx./Média e Comprimento Total (km). Exige ≥2 nós com `elevation` definido, senão exibe estado vazio pedindo importar `.txt` com coluna de elevação [código: `MapaAnalyticsPanel.tsx:53-186`].
- **Execução 4D** — timeline tipo Gantt. Casa `segment.label` com `trecho.code` do `planejamentoStore`; usa `lastGanttRows` em cache ou, na falta, gera o cronograma sob demanda via `generateSchedule` (`scheduleEngine`) e desenha barras por `startDate`/`endDate` [código: `MapaAnalyticsPanel.tsx:190-269`].
- **Custo 5D** — quebra de custo por tipo de rede: comprimento (Haversine) × custo/metro, com KPIs de Custo Total, Custo Médio/metro e Extensão Total, gráfico de barras e tabela detalhada por tipo [código: `MapaAnalyticsPanel.tsx:273-380`].

### 5. Modal de Importação (`MapaImportModal`)
Área de drag-and-drop que aceita `.txt .csv .dxf .shp .json .ifc .dwg` [código: `MapaImportModal.tsx:315,322`]:
- **`.txt`/`.csv`** — cada linha `lat,lng` **ou** `easting,northing[,elevação]`. Autodetecta UTM quando `col1 > 360` ou `col2 > 90`, converte via `utmToWgs84` e mostra opções de Zona/Hemisfério/"Conectar como sequência"/Tipo de rede [código: `MapaImportModal.tsx:26-91,327-387`].
- **`.dxf`** — lê entidades `LINE` e `LWPOLYLINE`, gerando nós e trechos `generic` [código: `MapaImportModal.tsx:93-159`].
- **`.shp`** — valida o file code `9994` e importa o **bounding box** como 4 nós de canto ligados em retângulo [código: `MapaImportModal.tsx:161-194`].
- **`.json`** — formato nativo `{ nodes, segments }` [código: `MapaImportModal.tsx:196-208`].
- **`.dwg`/`.ifc`** — não suportados diretamente; exibem mensagem orientando converter para DXF/IFC-JSON [código: `MapaImportModal.tsx:257-266`].
Confirmar chama `importNodes`/`importSegments` [código: `MapaImportModal.tsx:288-293`].

### 6. Modal de Exportação (`MapaExportModal`)
Quatro formatos [código: `MapaExportModal.tsx:118-141`]:
- **GeoJSON** — `FeatureCollection` com `Point` (nós: id, label, nodeType, elevation) e `LineString` (trechos: id, networkType, diameter, material, depth, label) [código: `MapaExportModal.tsx:17-42`].
- **DXF** — entidades `POINT` (nós) + `LINE` (trechos) [código: `MapaExportModal.tsx:46-80`].
- **JSON Plataforma** — `{ nodes, segments }` reimportável [código: `MapaExportModal.tsx:90-93`].
- **PDF (Imprimir)** — `window.print()` da tela atual [código: `MapaExportModal.tsx:84-86`].

### 7. Modal Transformar CRS (`MapaTransformCrsModal`)
Conversor pontual UTM→WGS84 (Zona 1–60, Hemisfério N/S, Easting, Northing → Lat/Lng) para verificação, usando `utmToWgs84` [código: `MapaTransformCrsModal.tsx:22-39`].

## Dados que gera

**Tabela Supabase `public.mapas_interativos`** — 1 linha por mapa; o desenho inteiro fica num único `payload` jsonb [schema: `0029_frotas_geo.sql:281-297`]:

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | igual ao `mapId` do store (`crypto.randomUUID()`) |
| `organization_id` | uuid NOT NULL | FK `organizations`, `ON DELETE CASCADE` |
| `project_id` | uuid | FK `projects`, `ON DELETE SET NULL` (= `selectedProjectId`) |
| `name` | text | fixo `'Mapa principal'` no enqueue |
| `map_mode` | text | `'saneamento' | 'construcao' | null` |
| `basemap` | text | `satellite|streets|dark|light|outdoors` |
| `payload` | jsonb NOT NULL | `{ nodes[], segments[], layers[] }` |
| `created_by` | uuid NOT NULL | FK `auth.users` |
| `created_at`/`updated_at`/`deleted_at` | timestamptz | soft-delete via `deleted_at` |

Índices: por `organization_id`, `(organization_id, created_at DESC)`, parcial `WHERE deleted_at IS NULL`, e por `project_id` [schema: `0029_frotas_geo.sql:294-297`].

**Entidades em memória (payload)** [schema: `src/types/index.ts:1960-1990`]:
- `MapNode`: `id, lat, lng, label?, nodeType (junction|endpoint|structure), elevation?`.
- `MapSegment`: `id, fromNodeId, toNodeId, networkType (sewer|water|drainage|civil|generic), diameter?, material?, depth?, label?, color?`.
- `MapLayer`: `id (=networkType), name, color, visible`.

## Cálculos, KPIs e regras de negócio

- **Distância / comprimento (Haversine)** — `R = 6.371.000 m`; usada na ferramenta Medir, no perfil 3D e no cálculo de custo 5D [código: `MapaCanvas.tsx:47-55`, `MapaAnalyticsPanel.tsx:12-19`].
- **Perfil de elevação 3D** — encadeamento de segmentos por nó-fonte; distâncias cumulativas; KPIs Mín./Máx./Média de elevação e Comprimento Total = soma dos trechos do caminho [código: `MapaAnalyticsPanel.tsx:66-137`].
- **Custo 5D** — `custo_trecho = comprimento_m × custo/m`, com tabela por tipo: **Esgoto R$ 350/m, Água R$ 280/m, Drenagem R$ 320/m, Civil R$ 180/m, Genérico R$ 200/m** (fallback R$ 200/m) [código: `MapaAnalyticsPanel.tsx:27-33,294-303`]. KPIs: Custo Total, Custo Médio/metro (`total / extensão`), Extensão Total (km) [código: `MapaAnalyticsPanel.tsx:312-329`]. [inferido] esses valores/m são **paramétricos internos** (estimativa), não vêm de composições de preço reais.
- **Autodetecção UTM** — trata a linha como UTM quando `|col1| > 360` ou `|col2| > 90` (easting/northing fora da faixa de graus) [código: `MapaImportModal.tsx:46`].
- **Validação lat/lng** — descarta pontos com `lat∉[-90,90]` ou `lng∉[-180,180]` [código: `MapaImportModal.tsx:62`].
- **Histórico/Undo** — pilha de snapshots limitada a 20 (`slice(-20)`) [código: `mapaInterativoStore.ts:180-183`].
- **Modo → camadas** — Saneamento liga `sewer/water/drainage`; Construção liga `civil/generic` [código: `mapaInterativoStore.ts:357-373`].

## Integrações — a "camada única"

**O que CONSOME de outros módulos:**
- **BIM** (`bimStore`) — importa `project.segments` (vértices 3D → lat/lng) como trechos `civil` [código: `MapaHeader.tsx:68-96`].
- **Planejamento** (`planejamentoStore`) — importa `trechos` como nós/segmentos e, na aba 4D, casa `segment.label` com `trecho.code` para desenhar o cronograma, gerando o schedule via `scheduleEngine.generateSchedule` (equipes, produtividade, feriados) [código: `MapaHeader.tsx:98-121`, `MapaAnalyticsPanel.tsx:196-224`].
- **Projetos** (`projetosStore`) — lista de obras para o seletor que preenche `project_id` [código: `MapaHeader.tsx:61,247-256`].

**O que ALIMENTA / expõe:**
- Exporta **GeoJSON / DXF / JSON / PDF** para SIG (QGIS, ArcGIS, Mapbox) e CAD, e JSON reimportável [código: `MapaExportModal.tsx`].
- O `payload` fica na tabela `mapas_interativos`, incluída no **snapshot/backup da organização** pela RPC de dump (`jsonb_agg` de `mapas_interativos`) [schema: `0031_frotas_geo_rpcs.sql:289`, `0034_sprint6_rpcs.sql:299`].

**Eventos / realtime / triggers:**
- **eventBus** (`src/lib/eventBus.ts`) — o módulo **não publica nem consome** eventos (nenhuma referência a "mapa"). [inferido] a integração com outros módulos é por leitura direta de stores, não por eventBus.
- **Realtime** (`src/lib/realtime.ts`) — **não há assinatura** de `mapas_interativos`. O módulo **não é tempo-real**: mudanças de outro usuário só aparecem via `pull()` (reload/hidratação).
- **Trigger de servidor** — a exclusão passa pela RPC `request_action` com `delete_mapa_interativo`, que faz soft-delete (`deleted_at = now()`), respeitando a política que **bloqueia DELETE físico** [schema: `0034_sprint6_rpcs.sql:191`, `0030_frotas_geo_rls.sql:293-294`].

## Eficiência gerada

- **Menos planilha / retrabalho de coordenadas** — importa `.txt/.csv` UTM com conversão automática para WGS84 e plota direto no satélite, eliminando conversão manual em planilha ou GIS externo [código: `MapaImportModal.tsx:48-54`]. [inferido]
- **Ponte projeto↔obra↔custo↔prazo num só lugar** — o mesmo desenho vira perfil 3D, cronograma 4D (via Planejamento) e estimativa de custo 5D, sem exportar/importar entre ferramentas [código: `MapaAnalyticsPanel.tsx`]. [inferido]
- **Interoperabilidade CAD/SIG** — leitura de DXF/SHP e exportação GeoJSON/DXF reduzem o vai-e-vem com projetistas/topografia [código: `MapaImportModal.tsx`, `MapaExportModal.tsx`]. [inferido]
- **Rastreabilidade** — dado único por organização em `mapas_interativos`, versionável no backup da org e protegido contra exclusão física (só soft-delete) [schema: `0030_frotas_geo_rls.sql:293-294`]. [inferido]
- **Dado único** — reaproveita rótulos de trecho do Planejamento para casar mapa e cronograma sem redigitar [código: `MapaAnalyticsPanel.tsx:199-206`]. [inferido]

## Como sincroniza

- **Local-first** — store Zustand com `persist` (chave `cdata-mapa-interativo`), persistindo `mapId, nodes, segments, layers, basemap, mapMode, selectedProjectId, pendingSync, lastSyncedAt` no `localStorage` [código: `mapaInterativoStore.ts:380-393`]. A UI lê/escreve no local instantaneamente.
- **Fila de sincronização (debounced)** — `enqueueMapUpdate` (debounce de 1000 ms) monta a linha completa e enfileira uma op **`update`** em `mapas_interativos` (patch sem `id/organization_id/created_by`), chamando `flush()` [código: `mapaInterativoStore.ts:189-215`]. Só as ações `addNode/removeNodes/addSegment/removeSegments/updateNode` disparam o enqueue. [inferido] `importNodes/importSegments`, `clearAll`, `loadDemoData` e o "Carregar JSON" **não** enfileiram sozinhos — só sincronizam após a próxima edição de nó/trecho.
- **`flush()`** — respeita offline (`navigator.onLine` → `syncStatus: 'offline'`) e não-autenticado (`'unauth'`); drena a fila via `flushQueue`, incrementa retries em falha e grava `lastSyncedAt`/`syncError` [código: `mapaInterativoStore.ts:225-241`]. Um listener de `window 'online'` refaz o flush ao reconectar [código: `mapaInterativoStore.ts:397-401`].
- **`pull()`** — lê `mapas_interativos` (filtrada por RLS) e adota a **1ª linha** (`mapId`, `nodes`, `segments`, `layers`); **pula o pull** se houver ops pendentes dessa tabela, para não sobrescrever edição local [código: `mapaInterativoStore.ts:243-256`]. É registrado no bootstrap de stores em `auth.ts` [código: `src/lib/auth.ts:79`].
- **RLS / multi-tenant** — tabela com `ENABLE`+`FORCE ROW LEVEL SECURITY`; SELECT só da própria org e não deletado; INSERT/UPDATE exigem papel em `{engenheiro, planejador, gerente, diretor, owner}` e `organization_id = user_org()`; DELETE físico bloqueado (`USING false`) [schema: `0030_frotas_geo_rls.sql:279-294`].
- **Offline** — totalmente utilizável offline (persist local); a fila drena quando volta a conexão. **Não** é colaborativo em tempo real (sem realtime).
- **Cache de tenant** — a chave `cdata-mapa-interativo` está listada no `tenantCache` e é limpa ao trocar de organização; em modo demo, `appModeStore` carrega/limpa os dados de exemplo [código: `src/lib/tenantCache.ts:20`, `src/store/appModeStore.ts:281,313`].

> **Nota técnica [inferido]:** o enqueue usa op do tipo `update` (não `insert`) por `id`. Como o caminho de `update` no `flushQueue` faz `UPDATE … WHERE id = recordId` e valida linhas afetadas (`assertAffectedRows`), a persistência depende de já existir a linha correspondente no banco; caso contrário a op pode ficar pendente até a linha existir [código: `src/lib/storeSync.ts:196-206,83-86`].
