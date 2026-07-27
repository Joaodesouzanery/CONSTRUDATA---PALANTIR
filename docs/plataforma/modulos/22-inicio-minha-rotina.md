# Início / Minha Rotina

> **Rota(s):** `/app/minha-rotina` · também é a **tela inicial padrão** (todo `/app`, rotas removidas e wildcards caem aqui) · **Store(s):** `userRoutineStore` (persona + pins por frequência), `sidebarPinsStore` (favoritos da sidebar) · **Grupo na sidebar:** `INÍCIO` → item "Rotina / Tutorial"

---

## O que é / problema que resolve

A ConstruData tem quase 20 módulos. Nenhum usuário usa todos: um engenheiro de campo vive no RDO e na FVS; um diretor só quer a Torre de Controle e o Gestão 360. **Minha Rotina** é a resposta a isso — uma tela inicial *personalizada por pessoa* que mostra apenas os módulos que aquele usuário fixou, organizados por **frequência de uso** (HOJE / ESTA SEMANA / ESTE MÊS), em vez de obrigar todo mundo a caçar seus atalhos numa sidebar longa `[inferido]`.

É literalmente a primeira coisa que o usuário vê ao entrar: o roteamento manda `/app` para `/app/minha-rotina` `[código App.tsx:112]`, o `AuthGuard` redireciona para lá quando o usuário já está logado `[código AuthGuard.tsx:53]`, o login/cadastro terminam nela `[código AuthPage.tsx:172,252,309,378]`, e qualquer rota desconhecida (`path="*"`) também `[código App.tsx:153]`. Módulos descontinuados (ex.: `levantamento-obra`) redirecionam para cá `[código App.tsx:132]`.

Além da rotina em si, a página embute um **Tutorial / Guia da Plataforma** — um catálogo de todos os módulos com fluxogramas passo a passo — servindo de onboarding e referência viva. As duas coisas convivem em abas na mesma tela `[código minha-rotina/index.tsx:250,269-290]`.

## Para quem (papéis / persona)

Para **todos os papéis**, com presets prontos por persona. O store define 6 personas + um estado "custom" `[código userRoutineStore.ts:13-20,34-89]`:

| Persona | Emoji | Foco (do preset) |
|---|---|---|
| Engenheiro de Obra | 👷 | RDO, Qualidade, Planejamento Mestre no dia a dia |
| Gerente de Obra | 👔 | Gestão 360, Torre, RDO; EVM/Planejamento na semana |
| Diretor / Dono | 🎯 | Torre de Controle e Relatório 360; visão de portfólio |
| Planejador | 📐 | Planejamento Mestre + Trechos; Agenda/EVM |
| Qualidade / Fiscal | ✅ | Qualidade (FVS) + RDO; Mapa/Torre |
| Comprador / Almoxarife | 📦 | Suprimentos; Equipamentos/Frota |

Cada preset traz três listas de rotas prontas (`daily`, `weekly`, `monthly`) `[código userRoutineStore.ts:24-32,40-42]`. A persona é só um **ponto de partida**: assim que o usuário fixa/desafixa qualquer módulo, o store vira `persona: 'custom'` `[código userRoutineStore.ts:166,174]`.

## Funcionalidades detalhadas

A página tem **duas abas** no topo, alternadas por um tab-bar (`Home` = Minha Rotina, `BookOpen` = Tutorial) `[código minha-rotina/index.tsx:269-290]`.

### Cabeçalho (comum às duas abas)
- **Saudação dinâmica por hora do dia**: `greeting()` retorna "Bom dia" (<12h), "Boa tarde" (<18h) ou "Boa noite" `[código minha-rotina/index.tsx:39-44]`. Na aba Rotina o título é `"{saudação}, {personaLabel}"`; na aba Tutorial vira "Guia da Plataforma" `[código minha-rotina/index.tsx:298]`.
- **Data por extenso em pt-BR**: `fmtToday()` formata `weekday/dia/mês/ano` com `toLocaleDateString('pt-BR', …)` `[código minha-rotina/index.tsx:46-53]`.
- **Emoji + rótulo da persona** ao lado do título (ou ⚙️ + "Personalizada" quando `custom`) `[código minha-rotina/index.tsx:254-256]`.
- **Botão "Trocar persona"**: abre um dropdown com as 6 personas; clicar aplica o preset (`setPersona`) e fecha o menu `[código minha-rotina/index.tsx:307-342]`.

### Aba "Minha Rotina"
1. **Card de introdução** ("Sua rotina, sua tela inicial") com a mensagem "A plataforma tem 19 módulos — mas você só precisa de 4 ou 5 no dia a dia" `[código minha-rotina/index.tsx:355-360]`. Observação: o `MODULE_REGISTRY` tem **17 entradas** de fato `[código moduleRegistry.ts:23-151]`, então o número "19" no texto é fixo/desatualizado `[código]`.
2. **Três seções por frequência**, cada uma um `FrequencySection` `[código minha-rotina/index.tsx:364-395]`, separadas por setas de fluxo (`ArrowDown`) que sugerem a cadência HOJE → SEMANA → MÊS `[inferido]`:
   - **HOJE** (`daily`) — cor laranja `#f97316`, ícone `Sun` `[código minha-rotina/index.tsx:22-26]`.
   - **ESTA SEMANA** (`weekly`) — cor azul `#0ea5e9`, ícone `Calendar` `[código minha-rotina/index.tsx:27-31]`.
   - **ESTE MÊS** (`monthly`) — cor roxa `#a855f7`, ícone `CalendarDays` `[código minha-rotina/index.tsx:32-36]`.
   - Cabeçalho de cada seção mostra o rótulo e a contagem de módulos ("N módulo(s)") `[código minha-rotina/index.tsx:216-218]`.
3. **ModuleCard** (um por módulo fixado): ícone colorido pela frequência, `label`, `description` (2 linhas), botão "Abrir" que navega para `mod.path`; no hover aparece o **X** para **desafixar** `[código minha-rotina/index.tsx:63-102]`. Se o path fixado não existir mais no registro, o card não renderiza (`findModule` retorna `undefined`) `[código minha-rotina/index.tsx:65-66]`.
4. **Card "+ Adicionar"** (borda tracejada) em cada seção → abre o **ModulePicker** para aquela frequência `[código minha-rotina/index.tsx:227-234,367-368]`.
5. **ModulePicker (modal)**: campo de busca que filtra `MODULE_REGISTRY` por `label`/`description`; lista todos os módulos; clicar num item chama `togglePin(path, frequency)` e fecha o modal; itens já fixados exibem um badge com a frequência atual `[código minha-rotina/index.tsx:112-190]`.
6. **Rodapé**: "Suas preferências ficam salvas automaticamente neste navegador." `[código minha-rotina/index.tsx:398-400]`.

### Aba "Tutorial" — Guia da Plataforma (`TutorialPanel`)
Renderizada inline (não é modal) `[código TutorialModal.tsx:1-4,349-350]`:
- **Busca** por módulo (filtra por label + descrição estendida) e **contagem** de módulos encontrados/disponíveis `[código TutorialModal.tsx:141-189]`.
- **Módulos agrupados** por `group` na ordem `gestao → planejamento → campo → projetos → analytics` `[código TutorialModal.tsx:36-40,145-157]`.
- Cada card usa uma **descrição estendida** de `TUTORIAL_CONTENT` (fallback: `description` do registro) `[código TutorialModal.tsx:13-34,217-219]`.
- Módulos com fluxograma disponível (`MODULE_FLOWS`) são clicáveis e mostram "N passos no fluxograma"; os sem fluxo ficam esmaecidos (`opacity-70`) `[código TutorialModal.tsx:197-224]`.
- Ao clicar, abre a **FlowDetailView**: um diagrama visual de etapas (`FlowDiagram`) + cartões passo a passo (`StepCard`, com `label`, `description` e `details[]`) e botão "Voltar ao Tutorial" `[código TutorialModal.tsx:44-137,160-162]`. A fonte dos fluxos é `src/data/moduleFlowcharts.ts` (~20 fluxos, ex.: `/app/rdo`, `/app/qualidade`, `/app/medicao`, `/app/evm`…) `[código TutorialModal.tsx:9,197-198]`.

### Favoritos da sidebar (funcionalidade irmã — `sidebarPinsStore`)
Complementar à rotina, o usuário pode **fixar módulos no topo da sidebar** (seção FAVORITOS) `[código sidebarPinsStore.ts:1-4; Sidebar.tsx:186-196]`:
- Passar o mouse sobre qualquer item da sidebar mostra um ícone de **pin** ("Fixar no topo" / "Desafixar") → `togglePin(path)` `[código Sidebar.tsx togglePin, title "Fixar no topo"]`.
- Itens já fixados aparecem na seção **FAVORITOS** com controles de **subir/descer** (`movePin(path, ±1)`) e **desafixar** `[código Sidebar.tsx movePin/togglePin]`.
- É **puramente ordenação de sidebar**, separado da Minha Rotina (que é por frequência) `[código sidebarPinsStore.ts:2-4]`.

## Dados que gera

### `MODULE_REGISTRY` (fonte de verdade, não é tabela)
Lista única de 17 módulos, cada um com `path`, `label`, `icon` (lucide), `group` (`gestao|planejamento|campo|projetos|analytics`) e `description` `[código moduleRegistry.ts:15-151]`. Helper `findModule(path)` resolve um módulo `[código moduleRegistry.ts:153-155]`. Esse mesmo registro alimenta o picker da rotina **e** o catálogo do tutorial.

### Tabela `user_routines` (Supabase) — escopo USER, 1 linha por usuário
Criada na migração de Sprint 6 `[schema 0032_sprint6_final.sql:183-190]`:

| Campo | Tipo | Observação |
|---|---|---|
| `user_id` | uuid **PK** → `auth.users(id)` ON DELETE CASCADE | 1 row por usuário `[schema 0032:184]` |
| `organization_id` | uuid NOT NULL → `organizations(id)` | multi-tenant `[schema 0032:185]` |
| `persona` | text NOT NULL DEFAULT `'engenheiro'` | `[schema 0032:186]` |
| `payload` | jsonb DEFAULT `{}` | guarda `pinnedDaily`, `pinnedWeekly`, `pinnedMonthly`, `hasOnboarded` `[schema 0032:187]` |
| `created_at` / `updated_at` | timestamptz | `[schema 0032:188-189]` |

Índice `idx_user_routines_org` em `organization_id` `[schema 0032:191]`. A tabela também entra no export completo da organização (`export_organization_data`) `[schema 0034_sprint6_rpcs.sql:315]`.

### Estado local (Zustand persist)
- `userRoutineStore`: `persona`, `pinnedDaily[]`, `pinnedWeekly[]`, `pinnedMonthly[]`, `hasOnboarded`, além de `syncStatus/lastSyncedAt/syncError` — persistido em `localStorage` sob a chave **`cdata-user-routine`** `[código userRoutineStore.ts:91-99,278]`.
- `sidebarPinsStore`: apenas `pinnedPaths[]`, persistido sob **`cdata-sidebar-pins`** — **sem backend** `[código sidebarPinsStore.ts:9-14,44]`.

## Cálculos, KPIs e regras de negócio

Módulo de navegação/preferências — não tem KPI financeiro, mas tem regras de estado bem definidas:

- **`togglePin(path, frequency)`**: primeiro **remove o path de todas as três frequências** (garante que um módulo esteja em no máximo uma), depois decide: se já estava na frequência-alvo, apenas remove (toggle-off); senão, adiciona à alvo. Em qualquer caso marca `persona: 'custom'` `[código userRoutineStore.ts:153-181]`.
- **`isPinned(path)`**: retorna a **frequência** onde o módulo está (`'daily' | 'weekly' | 'monthly'`) ou `null` — não é booleano `[código userRoutineStore.ts:183-189]`.
- **`setPersona(p)`**: aplica as três listas do preset, exceto quando `p === 'custom'` (aí só troca o rótulo) `[código userRoutineStore.ts:139-151]`.
- **`resetToPreset(persona)`**: restaura os pins do preset escolhido `[código userRoutineStore.ts:191-203]`.
- **`markOnboarded()` / `hasOnboarded`**: flag de onboarding no store/payload — presente e persistido, mas **sem consumidores no restante do app** (nenhum outro arquivo lê `hasOnboarded`) `[código userRoutineStore.ts:205-208]`.
- **`clearData()`**: volta ao default (persona `engenheiro` + preset[0]) `[código userRoutineStore.ts:210-219]`.
- **`sidebarPinsStore.movePin(path, ±1)`**: reordena o array de favoritos com bounds-check `[código sidebarPinsStore.ts:33-42]`.

## Integrações — a "camada única"

**O que CONSOME:**
- **`MODULE_REGISTRY`** como fonte única — o mesmo array alimenta o picker da rotina, o catálogo do tutorial e (por `findModule`) o ícone/label dos cards `[código minha-rotina/index.tsx:17,65; TutorialModal.tsx:8,93,150]`.
- **`MODULE_FLOWS`** (`src/data/moduleFlowcharts.ts`) para os fluxogramas do tutorial `[código TutorialModal.tsx:9]`.
- **`react-router`** para navegar a qualquer módulo (é o hub de entrada de toda a plataforma) `[código minha-rotina/index.tsx:85]`.
- **`useAuth`** (`profile.organization_id`, `user.id`) para carimbar o upsert em `user_routines` `[código userRoutineStore.ts:225-241]`.

**O que ALIMENTA:**
- **Sidebar**: `sidebarPinsStore` monta a seção FAVORITOS e a filtragem dos grupos regulares `[código Sidebar.tsx:95,112-117,186-196]`.
- **Rota de entrada padrão** do app inteiro (todos os redirects apontam para cá) `[código App.tsx:112,132,153; AuthGuard.tsx:53; AuthPage.tsx]`.

**Sobre eventBus / triggers / realtime:** este módulo **não** usa o `eventBus` (nenhum import em `minha-rotina/` nem nos dois stores) `[código]`, **não** tem trigger de servidor associado, e `user_routines` **não** está na publicação de realtime (`20260711120000_enable_realtime.sql` não a inclui) `[schema]`. Ou seja: é preferência de usuário, não dado operacional compartilhado — fica fora da malha de eventos cross-módulo por design `[inferido]`.

## Eficiência gerada

- **Menos cliques até o trabalho real**: em vez de percorrer ~17 itens de sidebar, o usuário aterrissa direto nos 4-5 módulos que usa, já separados por HOJE/SEMANA/MÊS `[inferido]`.
- **Onboarding por persona**: escolher "Engenheiro" ou "Diretor" já monta uma rotina coerente sem configuração manual — reduz o atrito de primeiro uso `[inferido]`.
- **Registro único de módulos**: um só `MODULE_REGISTRY` evita listas duplicadas espalhadas (picker, tutorial, cards compartilham a mesma fonte) — menos divergência de manutenção `[inferido; código moduleRegistry.ts]`.
- **Tutorial embutido com fluxogramas**: referência viva de "como cada módulo funciona" dentro do produto, sem depender de manual externo `[inferido; código TutorialModal.tsx]`.
- **Favoritos + rotina**: dois eixos de personalização (ordem na sidebar via `sidebarPinsStore` e frequência via `userRoutineStore`) cobrindo tanto acesso rápido quanto planejamento de cadência `[inferido]`.

## Como sincroniza

**Local-first, com nuance importante.** A UI lê e escreve no **localStorage** (persist Zustand, chave `cdata-user-routine`) — essa é a fonte de verdade para a tela `[código userRoutineStore.ts:126-127,278]`.

- **Escrita para o servidor (`flush`)**: cada mutação (`setPersona`, `togglePin`, `resetToPreset`, `markOnboarded`) agenda um `flush` **debounced em 800 ms** `[código userRoutineStore.ts:117-124,150,180,202,207]`. O `flush` faz `upsert` em `user_routines` (carimbando `user_id` + `organization_id`), com guardas de **offline** (`navigator.onLine` → status `offline`) e **não autenticado** (`unauth`), atualizando `syncStatus/lastSyncedAt/syncError` `[código userRoutineStore.ts:221-249]`. Há também um re-flush no evento `window 'online'` `[código userRoutineStore.ts:283-287]`.
- **Leitura do servidor (`pull`)**: existe (`select … eq user_id eq organization_id maybeSingle`) `[código userRoutineStore.ts:251-275]`, **mas não é invocada em lugar nenhum** — `userRoutineStore` **não** está em `TENANT_STORE_DEFS`, então `syncAllTenantStores` (que faz flush+pull dos módulos tenant) **não o toca** `[código appModeStore.ts:138-174,234-246]`; e em `resetTenantScopedRuntimeStores` o store cai no ramo `clearData()` (não tem `ensureTenantScope`), ou seja, ao **trocar de empresa** a rotina é **resetada para o preset engenheiro** em vez de puxada do servidor `[código auth.ts:105-114; userRoutineStore.ts:210-219]`. **Efeito prático `[inferido]`:** a cópia em `user_routines` funciona como backup/escrita, mas a rotina hoje é efetivamente **por-navegador** — não "segue" o usuário para outro dispositivo/browser via `pull`.
- **RLS / multi-tenant**: `user_routines` tem RLS **por usuário**: políticas `select/insert/update/delete_own` exigem `user_id = auth.uid()` `[schema 0033_sprint6_rls.sql:164-178]`, endurecidas depois para exigir **também** `organization_id = public.user_org()` no isolamento global `[schema 20260518184500_global_multi_tenant_isolation.sql:123-152]`. É a exceção declarada: escopo USER, não ORG `[schema 0033:3]`.
- **`sidebarPinsStore`**: 100% localStorage (`cdata-sidebar-pins`), **sem Supabase, sem realtime, sem RLS** — favoritos vivem apenas naquele navegador `[código sidebarPinsStore.ts:16-46]`.
- **Realtime**: não aplicável — a tabela não está na publicação de realtime `[schema 20260711120000_enable_realtime.sql]`.
