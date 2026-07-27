# BIM 3D / 4D / 5D

> **Rota(s):** `/app/torre-de-controle?aba=bim` (aba dentro da Torre de Controle) · rota legada `/app/bim` → redireciona para `…?aba=bim` [código: `src/App.tsx:149`] · **Store(s):** `bimStore` (chave localStorage `cdata-bim`) [código: `src/store/bimStore.ts:602`] · **Grupo na sidebar:** **GESTÃO → Torre de Controle** (o BIM não tem item próprio na sidebar; vive como aba `BIM 3D/4D/5D` da Torre) [código: `src/components/shared/Sidebar.tsx:36-39`, `src/features/torre-de-controle/index.tsx:28`]

---

## O que é / problema que resolve

O módulo BIM traz um **visualizador geométrico 3D no browser** para modelos de obra — redes de saneamento (tubulações enterradas), edificações (lajes, pilares, paredes, vigas) e geometria genérica — sem depender de software CAD/BIM desktop. Ele lê arquivos comuns de engenharia brasileira (**DXF/CAD, Shapefile `.shp`, e planilhas de levantamento topográfico `.txt/.csv`**) direto no navegador e os transforma em elementos coloríveis e clicáveis num canvas WebGL (Three.js) [código: `src/features/bim/components/BimUploadModal.tsx:89-93`, `src/features/bim/components/BimCanvas.tsx`].

O diferencial não é só ver o 3D, e sim as camadas **4D (tempo)** e **5D (custo)**: cada elemento geométrico (`BimSegment`) carrega `constructionDate` (prazo) e `unitCostBRL`/`totalCostBRL` (custo), então o mesmo modelo vira uma **simulação temporal de execução** (slider de datas que "acende" trechos concluídos) e um **mapa de calor de custos** [código: `src/features/bim/components/Bim4DPanel.tsx`, `src/features/bim/components/Bim5DPanel.tsx`]. Resolve o problema de o cronograma e o orçamento viverem em planilhas descoladas do desenho: aqui o desenho, o prazo e o custo são a mesma entidade.

Há ainda um segundo motor de visualização opcional, o **Autodesk APS (Forge) Viewer**, para quem quer renderizar modelos BIM nativos (RVT/IFC/NWD/DWG traduzidos via Model Derivative) diretamente no browser, autenticando com credenciais APS do próprio cliente [código: `src/features/bim/components/BimForgeViewer.tsx:186-197`].

## Para quem (papéis / persona)

- **Engenheiros e projetistas** (infra/saneamento/edificação) que precisam inspecionar rede de tubos, profundidades e diâmetros, ou a estrutura por pavimento.
- **Planejadores** que querem enxergar o avanço físico no tempo (4D) casado com o cronograma do módulo Planejamento.
- **Orçamentistas / controle de custos** que querem o 5D — custo por material, por diâmetro/elemento e custo/m linear — sincronizado com Quantitativos e SINAPI.
- **Gestores / diretoria** que consomem os KPIs de topo (trechos, extensão, custo total, % concluído).

A escrita no banco é restrita por papel: `INSERT`/`UPDATE` em `bim_projects`/`bim_segments` exigem papel `engenheiro`, `planejador`, `gerente`, `diretor` ou `owner` [schema: `supabase/migrations/0027_grupo_nucleo_rls.sql:144-149,170-175`].

## Funcionalidades detalhadas

### Cabeçalho (BimHeader) — abas e KPIs
- **Três abas de análise** [código: `src/features/bim/components/BimHeader.tsx:7-11`]:
  - `Visualizador 3D` (`viewer`)
  - `Análise 4D (Prazo)` (`4d`)
  - `Análise 5D (Custo)` (`5d`)
- **Barra de KPIs** calculada sobre os segmentos do projeto ativo [código: `src/features/bim/components/BimHeader.tsx:52-57,133-141`]:
  - **Trechos** = nº de segmentos.
  - **Extensão** = soma de `lengthM` (em metros).
  - **Custo Total** = soma de `totalCostBRL`, formatado abreviado (R$ …k / …M) [código: `BimHeader.tsx:13-17`].
  - **Concluído %** = `completed / totalSegs`, onde `completed` = segmentos com `constructionDate <= activeDate`. Cor muda por faixa (verde 100%, amarelo >50%) [código: `BimHeader.tsx:56-57,136-141`].
  - **Badge de tipo**: "Construção Civil" (building) / "Saneamento" (sanitation) / "Genérico" [código: `BimHeader.tsx:142-154`].
- **Botão "Projetos"** (dropdown): lista projetos do módulo Projetos (`projetosStore`) e, ao escolher, converte o projeto em `BimProject` via `projectToBim` e o adiciona/ativa no BIM [código: `BimHeader.tsx:29-49`].
- **Botão "Importar"**: abre o `BimUploadModal`.

### Aba Visualizador 3D
Toolbar (`BimControls`) com três blocos [código: `src/features/bim/components/BimControls.tsx`]:
- **Toggle de motor de renderização**: `Three.js` ou `Forge APS`.
- **Botão Drone** (só Three.js): ativa navegação em 1ª pessoa (`PointerLockControls`, WASD + Q/E subir/descer, Shift = rápido, ESC sai) [código: `src/features/bim/components/BimCanvas.tsx:229-251,490-509`].
- **Seletor de cor (colorMode)** com 6 modos [código: `BimControls.tsx:6-13`]: `Material` (default), `Profundidade` (depth), `Prazo (4D)` (date), `Custo (5D)` (cost), `Diâmetro`, `Pressão`.

**Canvas Three.js (`BimCanvas`)** — renderer WebGL montado via `useRef`/`useEffect`, com sombras (PCFSoft), tone mapping ACES, fog, grid e plano de chão [código: `BimCanvas.tsx:158-200`]. Detalhes:
- **Geometria por tipo de elemento**: tubos (`TubeGeometry` sobre `CatmullRomCurve3`, com esferas de tampa nas pontas) para saneamento/genérico; `BoxGeometry` para laje/parede/viga e `CylinderGeometry` para pilar em edificações [código: `BimCanvas.tsx:336-401`].
- **Convenção de eixos**: em saneamento, `z` é profundidade e é renderizado como `-z*10` no eixo Y (exagero vertical de 10× para leitura) [código: `BimCanvas.tsx:376-377`]; em building, `z` é altura.
- **Auto-fit de câmera** ao trocar de projeto (`fitCamera`) [código: `BimCanvas.tsx:88-127,291-294`].
- **Presets de câmera** no canto: Topo / Frente / Iso / Ajustar [código: `BimCanvas.tsx:478-488`].
- **Clique-para-selecionar** via `Raycaster`: seleciona o `segId` do mesh clicado (toggle) [código: `BimCanvas.tsx:446-469`]; o elemento selecionado fica âmbar [código: `BimCanvas.tsx:35`].
- **Filtro por camada**: segmentos são ocultados conforme visibilidade das layers por atributo `MATERIAL`/`DIAMETER`/`PHASE` [código: `BimCanvas.tsx:304-328`].

**Painel esquerdo (`BimLeftPanel`)** [código: `src/features/bim/components/BimLeftPanel.tsx`]:
- Switcher de projetos (ícone por tipo), com projeto ativo destacado.
- Info do projeto: Trechos, Extensão, Fonte (`shapefileSourceName`), data de importação.
- Resumo de custo: custo total e **custo/m médio** = `totalCost / totalLength` [código: `BimLeftPanel.tsx:88-91`].
- Lista de **Camadas** com toggle de visibilidade (olho aceso/apagado) [código: `BimLeftPanel.tsx:95-116`].

**Painel direito** (depende do tipo/motor) [código: `src/features/bim/components/BimLayout.tsx:91-95`]:
- **Saneamento (`BimSaneamentoPanel`)** — 3 sub-abas [código: `src/features/bim/components/BimSaneamentoPanel.tsx:291-295`]:
  - **Rede**: tabela dos trechos (até 80 linhas) com DN, comprimento, profundidade, material; rodapé com Total de trechos, Extensão total (km) e DN médio [código: `BimSaneamentoPanel.tsx:11-68`].
  - **Fluxograma**: diagrama de processo de uma ETE (8 etapas: Captação → Grade → Desarenador → Decantador Prim. → Tratamento Bio. → Decantador Sec. → Desinfecção → Efluente Final) + via do lodo [código: `BimSaneamentoPanel.tsx:73-152`].
  - **IoT**: 8 sensores simulados (vazão, pressão, nível, pH, turbidez, DBO, OD, temperatura) com status ok/atenção/crítico; valores mudam por bucket de 30 s (simulação determinística via `Math.sin`) [código: `BimSaneamentoPanel.tsx:156-282`].
- **Propriedades (`BimPropertiesPanel`)** — para building/genérico e para o modo Forge — mostra do trecho selecionado: Geometria (extensão, prof. média, nº de pontos), Atributos (DN, material + todos os `attributes`), Custo (custo/m, total), Cronograma (data de início) e coordenadas dos vértices [código: `src/features/bim/components/BimPropertiesPanel.tsx`].

### Aba Análise 4D (Prazo) — `Bim4DPanel`
[código: `src/features/bim/components/Bim4DPanel.tsx`]
- **Slider de linha do tempo** entre `timelineDateRange.start` e `.end`; arrastar altera `activeDate` e força `colorMode='date'` [código: `Bim4DPanel.tsx:50-54`].
- **Contadores de status**: Não iniciado / Em andamento / Concluído. "Concluído" = `constructionDate <= activeDate`; "Em andamento" = iniciado há menos de 30 dias [código: `Bim4DPanel.tsx:41-46`].
- **Extensão concluída** em metros e % sobre a extensão total.
- Botão **"Sincronizar Planejamento"** → chama `syncWithPlanejamento()` e ativa a cor por prazo [código: `Bim4DPanel.tsx:16-23`].

### Aba Análise 5D (Custo) — `Bim5DPanel`
[código: `src/features/bim/components/Bim5DPanel.tsx`]
- **Total** (soma `totalCostBRL`) e **custo/m** = total / extensão.
- **Por Material**: agrupa custo e contagem por `material` (top 4), com barra proporcional [código: `Bim5DPanel.tsx:59-63,108-115`].
- **Por Diâmetro / Por Elemento**: agrupa por `DN{diameter}` (ou `elementType` em building) [código: `Bim5DPanel.tsx:65-69,120-129`].
- **Heatmap de custo**: legenda de gradiente (baixo→alto por custo/m linear) e botão "Ver heatmap" (aplica `colorMode='cost'`) [código: `Bim5DPanel.tsx:133-148`].
- Dois botões de sincronização de preço: **"Quantitativos"** (`syncWithQuantitativos`) e **"SINAPI"** (`handleSyncSinapi`, casando com `mockSinapi` por DN/material) [código: `Bim5DPanel.tsx:26-45,86-102`].

### Modal de importação (`BimUploadModal`) — 3 abas
[código: `src/features/bim/components/BimUploadModal.tsx`]
- **DXF / CAD**: drag-and-drop de `.dxf`; instruções de exportação do AutoCAD; aviso explícito de que `.DWG` (binário) **não** é suportado. Aceita R12 a 2024; entidades LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, SPLINE, 3DFACE; layers viram tubo/laje/pilar/parede/viga [código: `BimUploadModal.tsx:122-195`].
- **Shapefile (.shp)**: exige `.shp` + `.dbf` (obrigatórios) e `.shx` (opcional); checklist visual dos arquivos [código: `BimUploadModal.tsx:197-247`].
- **Levantamento (.txt/.csv)**: formato `número, nome, northing, easting, profundidade`; prévia das 5 primeiras linhas [código: `BimUploadModal.tsx:249-295`].

### Modo Forge / APS (`BimForgeViewer`)
[código: `src/features/bim/components/BimForgeViewer.tsx`]
- **Setup**: modal que pede **Client ID + Client Secret** (APS) e URN opcional; testa a autenticação antes de salvar [código: `BimForgeViewer.tsx:72-94`].
- **Autenticação 2-legged** `client_credentials` chamada do browser (`scope=viewables:read`), com expiração do token controlada em memória [código: `BimForgeViewer.tsx:49-68`].
- **Viewer**: carrega o SDK da Autodesk (CSS+JS de `developer.api.autodesk.com`), inicializa `GuiViewer3D` e carrega o documento por `urn:...` [código: `BimForgeViewer.tsx:26-45,224-268`].
- Estados de UI: sem credenciais (prompt de setup), conectando, falha de auth, conectado-sem-URN (input de URN) e viewer ativo; trata dica de CORS em erro [código: `BimForgeViewer.tsx:377-449,323-328`].

## Dados que gera

Entidades no domínio (tipos em `src/types/index.ts:1843-1879`):
- **`BimProject`**: `id`, `name`, `type` (`sanitation|building|generic`), `segments[]`, `layers[]`, `uploadedAt`, `shapefileSourceName`.
- **`BimSegment`**: `id`, `vertices` (`[x,y,z][]`), `attributes` (chave→valor livre), `trechoCode?`, `lengthM`, `avgDepthM`, `diameter` (mm), `material`, `unitCostBRL`, `totalCostBRL`, `constructionDate?` (yyyy-MM-dd), `phase?`, `elementType?` (`pipe|slab|column|wall|beam`).
- **`BimLayer`**: `id`, `name`, `visible`, `color`, `attribute?`.

Persistência Supabase (migração `supabase/migrations/0026_bim.sql`):
- **`bim_projects`** — 1 linha por modelo importado. Campos: `id`, `organization_id`, `project_id` (FK opcional para `projects`), `name`, `type`, `source_file_path` (caminho no bucket `bim-uploads/`, opcional), `payload jsonb` (guarda `layers[]`, `uploadedAt`, `shapefileSourceName`), `created_by`, `created_at`, `updated_at`, `deleted_at` (soft delete) [schema: `0026_bim.sql:8-24`].
- **`bim_segments`** — 1 linha por elemento geométrico. Campos: `id`, `organization_id`, `bim_project_id` (FK), `trecho_code`, `diameter numeric(8,2)`, `material`, `payload jsonb` (guarda `vertices`, `attributes`, `lengthM`, custos, datas — o objeto `BimSegment` inteiro), `created_by`, timestamps, `deleted_at` [schema: `0026_bim.sql:26-43`].
- Índices por `organization_id`, por `(organization_id, created_at)`, parcial por `deleted_at IS NULL`, por projeto e por `trecho_code` [schema: `0026_bim.sql:21-43`].
- Observação [schema]: por comentário da migração, **os arquivos-fonte (.shp/.dxf/.ifc) não ficam no banco** — a intenção é o bucket `bim-uploads/` referenciado por `source_file_path`. No código atual o mapper grava `source_file_path: null` [código: `bimStore.ts:20`] — ou seja, hoje só a geometria parseada (payload) é persistida.

## Cálculos, KPIs e regras de negócio

- **Comprimento do trecho** `lengthM = calcLength(vertices)` — soma das distâncias euclidianas 3D entre vértices consecutivos, arredondada [código: `bimStore.ts:49-58`; parser DXF: `dxfParser.ts:26-35`].
- **Profundidade média** `avgDepthM = média(|z|)` dos vértices [código: `bimStore.ts:60-64`].
- **Custo total do trecho** `totalCostBRL = round(lengthM * unitCostBRL)`; nos imports sem preço, `unitCostBRL = 85` (default de saneamento) [código: `bimStore.ts:99-112,351-352`].
- **Custo/m médio (KPIs/painéis)** = `totalCost / totalLength` [código: `BimLeftPanel.tsx:90`, `Bim5DPanel.tsx:84`].
- **% Concluído (4D)** = `nº(constructionDate <= activeDate) / nº segmentos`; **Em andamento** = iniciado há < 30 dias [código: `BimHeader.tsx:56-57`, `Bim4DPanel.tsx:41-46`].
- **`timelineDateRange`** derivado dos `constructionDate` dos segmentos (min/max), com fallback 2025-01-01 → 2025-12-31 [código: `bimStore.ts:66-75`].
- **Coloração por modo** (`colorForSegment`) [código: `BimCanvas.tsx:26-84`]:
  - `depth`: gradiente por `avgDepthM/maxDepth`.
  - `date` (4D): cinza se não iniciado/futuro; âmbar se iniciado há <30 dias; verde se mais antigo.
  - `cost` (5D): gradiente por custo/m relativo ao máximo.
  - `diameter`: azul→ciano→vermelho por DN/800.
  - `pressure`: gradiente simulado a partir da profundidade.
  - `default`: por material (PVC índigo, ferro/fofo âmbar, aço verde) ou, em building, por fase (fundação/estrutura/fechamento/cobertura).
- **Regras de importação/parse**:
  - DXF: heurística `layer → elementType` por nome (TUBO/PIPE→pipe, LAJE/SLAB→slab, PILAR/COLUMN→column, PAREDE/WALL→wall, VIGA/BEAM→beam); limite anti-DoS de **100.000 entidades**; sem `eval`, parsing numérico com guarda de NaN [código: `dxfParser.ts:44-52,17,210-355`].
  - Shapefile: lê `DIAMETER`/`DN`, `MATERIAL`, `TRECHO`, `DATE`/`DATA`, `PHASE`/`FASE` do `.dbf` [código: `bimStore.ts:96-115`].
  - Levantamento: agrupa pontos por sufixo `D`/`E` do nome e liga pontos consecutivos como trechos; normaliza para coordenadas locais [código: `bimStore.ts:322-356`].
  - `projectToBim`: cada fase do Projeto vira um pavimento com **laje (50% do custo da fase) + 4 pilares (12,5% cada) + paredes**; `constructionDate` só é setada se a fase tem progresso/started/completed; custo distribuído a partir de `budgetLines` [código: `projectToBim.ts:49-132`].
- **Normalização de UUID**: antes de enviar ao Supabase, projeto e segmentos ganham UUID válido se ainda não tiverem (ex.: ids `seg-01`, `survey-1`) [código: `bimStore.ts:174-187`].

## Integrações — a "camada única"

**O que CONSUME de outros módulos:**
- **Projetos** (`projetosStore`): importa um projeto e o converte em modelo building via `projectToBim` [código: `BimHeader.tsx:37-49`, `src/features/projetos/utils/projectToBim.ts`].
- **Planejamento** (`planejamentoStore`): `syncWithPlanejamento()` casa `segment.trechoCode` com `trecho.code` e copia `plannedStartDate → constructionDate`, recalculando a janela 4D [código: `bimStore.ts:443-468`].
- **Quantitativos** (`quantitativosStore`): `syncWithQuantitativos()` casa por `dn{diameter}` na descrição do item ou por `code === trechoCode` e atualiza `unitCostBRL`/`totalCostBRL` [código: `bimStore.ts:470-499`].
- **SINAPI** (`mockSinapi`): atualiza custo por DN/material [código: `Bim5DPanel.tsx:26-45`].
- **App Mode** (`appModeStore`): no modo Demo, dispara `useBimStore.getState().loadDemoData()` no cascade global de demos [código: `src/store/appModeStore.ts:279`].

**O que ALIMENTA:** o BIM é hoje **consumidor**, não emissor — a sincronização é *pull* (lê o estado de outras stores sob demanda). **Não há emissão de eventos no `eventBus`** nem publicação para realtime a partir do BIM (grep sem ocorrências em `src/lib/eventBus.ts` e `src/lib/realtime.ts`) [código: `src/features/bim/`, `src/store/bimStore.ts`]. A "camada única" se materializa por chave compartilhada (`trechoCode`) e por escrita no mesmo tenant (`organization_id`), não por barramento de eventos. [inferido] Isso significa que alterações no BIM (ex.: recálculo de custo) ficam locais/persistidas, mas não notificam outros módulos automaticamente.

**Triggers de servidor:** não há RPCs nem triggers específicos do BIM além das políticas RLS; a escrita é `INSERT` direto nas tabelas via outbox genérico (`storeSync`).

## Eficiência gerada

- **Menos planilha / dado único**: prazo (4D) e custo (5D) deixam de viver em planilhas paralelas e passam a ser atributos do próprio elemento geométrico, sincronizáveis com Planejamento, Quantitativos e SINAPI num clique [código: `bimStore.ts:443-499`, `Bim5DPanel.tsx:26-45`]. [inferido]
- **Visualização sem CAD desktop**: abre DXF/Shapefile/levantamento no browser, inclusive com um parser DXF próprio (sem servidor), reduzindo dependência de AutoCAD/GIS para conferência [código: `dxfParser.ts`, `bimStore.ts:79-117`]. [inferido]
- **Simulação de avanço físico**: o slider 4D permite "rodar o cronograma" e ver quanto da rede/estrutura está concluída em qualquer data, útil para medição e reuniões de status [código: `Bim4DPanel.tsx`]. [inferido]
- **Rastreabilidade multi-tenant**: cada modelo e segmento carrega `organization_id`/`created_by`, com soft delete e histórico de timestamps [schema: `0026_bim.sql`]. [inferido]
- **Bundle sob demanda**: Three.js e o SDK Forge só baixam quando a aba BIM é aberta (lazy import), sem pesar o bundle principal [código: `src/features/bim/index.tsx:1-4`, `src/features/torre-de-controle/index.tsx:19`]. [inferido]

## Como sincroniza

- **Local-first**: o estado (projetos, segmentos, `activeProjectId`, `viewerMode`, `forgeClientId`, fila `pendingSync`, `lastSyncedAt`) é persistido no localStorage (`cdata-bim`) via `zustand/persist` [código: `bimStore.ts:601-611`]. Ao adicionar/importar um projeto, os inserts vão para uma **outbox** (`pendingSync`) e são enviados ao Supabase por `flush()` → `flushQueue` (padrão `storeSync`) [código: `bimStore.ts:194-211,551-567`].
- **Offline-aware**: se `navigator.onLine` for falso, `flush()` marca `syncStatus='offline'`; ao voltar a rede (`window 'online'`), refaz o flush automaticamente [código: `bimStore.ts:552-554,615-619`].
- **Hidratação do servidor**: existe `pull()` que lê `bim_projects`/`bim_segments` e reconstrói os projetos (pulando tabelas com ops pendentes para não sobrescrever) [código: `bimStore.ts:569-598`]. [inferido] Não foi encontrado chamador de `pull()` no `src/` — na prática a restauração se apoia principalmente no `persist` local; o `pull` está disponível para bootstrap mas parece não estar ligado ao carregamento inicial.
- **RLS / multi-tenant**: `bim_projects` e `bim_segments` têm RLS `FORCE`; `SELECT` restrito a `organization_id = user_org()` e `deleted_at IS NULL`; `INSERT`/`UPDATE` exigem o org do usuário + papel autorizado; `DELETE` é **bloqueado** (`USING (false)`) — remoção é sempre soft delete via `deleted_at` [schema: `0027_grupo_nucleo_rls.sql:138-185`].
- **Realtime**: **não há** subscription realtime para o BIM (nenhuma referência em `src/lib/realtime.ts`). A colaboração entre usuários se dá por persistência + RLS por organização, não por broadcast em tempo real [código: `src/lib/realtime.ts`, `src/store/bimStore.ts`].
- **Credenciais Forge**: o **Client ID** é persistido (localStorage `aps-client-id`), mas o **Client Secret vive só em memória** (fora do `partialize`) — some ao recarregar a aba, por segurança [código: `bimStore.ts:540-549,603-610`, `BimForgeViewer.tsx:352-371`].
