# Auditoria — Módulos Planejamento e Qualidade

> Auditoria técnica de segurança, dados, integração, código, mobile e UX.
> Data: 2026-04-06
> Escopo: `src/features/planejamento`, `src/features/planejamento-mestre`,
> `src/features/qualidade`, `src/store/planejamentoStore.ts`,
> `src/store/qualidadeStore.ts`.

---

## Sumário Executivo

| Módulo | Severidade Geral | Itens Críticos | Itens Altos | Itens Médios | Itens Baixos |
|---|---|---|---|---|---|
| **Planejamento** | 🟡 **MÉDIA** | 0 | 3 | 6 | 5 |
| **Qualidade** | 🟢 **BAIXA** | 0 | 1 | 4 | 4 |

**Veredito:**
- **Planejamento** é um módulo robusto e maduro, com boa separação de responsabilidades (store + engines puros). Os principais débitos estão em **mobile**, **persistência** (zero localStorage) e **componentes muito grandes** (`ConfigPanel.tsx` 612 linhas, `PlanejamentoMacroPanel.tsx` 710 linhas).
- **Qualidade** é jovem mas bem estruturado. Acabou de receber persistência (`zustand persist`). Principal débito é **falta de integração** com BIM, RDO e Mapa Interativo (a "ontologia" prometida ainda não acontece para FVS).

---

# 🏗️ Módulo Planejamento

Inclui [src/features/planejamento](../src/features/planejamento), [src/features/planejamento-mestre](../src/features/planejamento-mestre) e [src/store/planejamentoStore.ts](../src/store/planejamentoStore.ts).

## A) Segurança

### ✅ Boas práticas presentes
- **IDs**: usa `crypto.randomUUID()` em todas as criações ([planejamentoStore.ts:182](../src/store/planejamentoStore.ts#L182))
- **Sem `dangerouslySetInnerHTML`** — varredura limpa
- **Sem `eval()`** ou `new Function()`
- **Cross-store reads via dynamic import** (`import('./preConstrucaoStore')`) — evita ciclos
- **Sem chamadas de rede externas** — toda lógica é client-side

### ⚠️ Achados

| # | Severidade | Arquivo | Problema | Recomendação |
|---|---|---|---|---|
| 1 | 🟡 MÉDIO | [planejamentoStore.ts](../src/store/planejamentoStore.ts) | **Sem validação Zod no `addTrecho/updateTrecho`** — qualquer campo pode chegar com tipo errado se vier de import externo (CSV, planilha) | Aplicar `planejamentoSchemas.ts` (já existe!) nas mutações de entrada |
| 2 | 🟡 MÉDIO | [TrechosPanel.tsx](../src/features/planejamento/components/TrechosPanel.tsx) | Inputs numéricos sem `min`/`max` consistentes em todos os campos (apenas alguns têm) | Adicionar `min={0}`, `max={99999}` em todos os `<input type="number">` |
| 3 | 🟢 BAIXO | [exportEngine.ts](../src/features/planejamento/utils/exportEngine.ts) | Geração de CSV usa `escapeCell` em alguns lugares mas não em outros — risco de injeção em planilhas (CVE-2014-3524 / "CSV Formula Injection") | Padronizar uso de `escapeCell()` em **toda** linha exportada |

## B) Dados e Persistência

### ⚠️ Achado CRÍTICO de fluxo

| # | Severidade | Arquivo | Problema | Recomendação |
|---|---|---|---|---|
| 4 | 🔴 **ALTO** | [planejamentoStore.ts:144](../src/store/planejamentoStore.ts#L144) | **Zero persistência**: o store é puramente in-memory. Recarregar a página perde TODO o trabalho de planejamento (trechos, equipes, cronograma rodado, cenários salvos). Em uma plataforma "operacional", isso é inaceitável. | Adicionar `persist` middleware com `partialize` salvando: `trechos`, `teams`, `productivityTable`, `scheduleConfig`, `holidays`, `notes`, `scenarios`, `technicalRules`, `projectBudget`. **Não** persistir os campos computados (`ganttRows`, `scurvePoints`, etc.) — recalcular via `runSchedule()` no startup. |
| 5 | 🟡 MÉDIO | [planejamentoStore.ts](../src/store/planejamentoStore.ts) | **Sem migration** — quando o schema do `PlanTrecho` mudar (e vai mudar), localStorage com versão antiga vai causar runtime errors | Adicionar `version` + `migrate` no persist config quando implementar a persistência |
| 6 | 🟡 MÉDIO | [planejamentoStore.ts:283](../src/store/planejamentoStore.ts#L283) | `runSchedule` é uma operação cara que **bloqueia o thread** para muitos trechos (CPM forward-pass). Em obras reais com 200+ trechos, pode travar a UI por 2-3 segundos. | Mover para `Web Worker` ou ao menos chunkar com `requestIdleCallback`. Curto prazo: adicionar loading state visível durante o cálculo |
| 7 | 🟢 BAIXO | [planejamentoStore.ts:349](../src/store/planejamentoStore.ts#L349) | `saveScenario` usa `structuredClone(trechos)` — operação O(n³) para objetos profundos. Para projetos grandes pode ser lento. | OK por enquanto, mas vigiar se cenários crescerem |

### Tamanho do payload

Estimativa: 1 obra com 100 trechos + 5 equipes + 3 cenários ≈ **180 KB JSON**. Quota localStorage (5 MB) suporta cerca de **27 obras simultâneas** — suficiente para POC mas não para produção real. **Recomendação:** quando ativar persistência, usar **IndexedDB** via [`idb-keyval`](https://github.com/jakearchibald/idb-keyval) em vez de localStorage.

## C) Integração com Outros Módulos

### ✅ Integrações JÁ existentes

| Origem | Destino | Onde |
|---|---|---|
| `preConstrucaoStore` | `planejamentoStore` | [planejamentoStore.ts:200](../src/store/planejamentoStore.ts#L200) — `importTrechosFromPlatform()` |
| `rdoStore` | `planejamentoStore` | [planejamentoStore.ts:405](../src/store/planejamentoStore.ts#L405) — `syncExecutionFromRdo()` |
| `planejamentoStore` | `rdoStore` | [rdoStore.ts:114](../src/store/rdoStore.ts#L114) — `loadTrechosFromPlanejamento()` (bidirecional) |

### ❌ Integrações AUSENTES (mas prometidas pela "ontologia")

| # | Severidade | Integração ausente | Por que importa |
|---|---|---|---|
| 8 | 🔴 **ALTO** | **Planejamento ↔ Suprimentos** | A landing fala em "atraso de material recalcula cronograma na hora" — isso **não existe**. Hoje suprimentos é silo |
| 9 | 🔴 **ALTO** | **Planejamento ↔ BIM 4D** | O BIM tem timeline 4D, mas não puxa o cronograma do planejamento. São dois mundos paralelos. Deveria ser 1 fonte só |
| 10 | 🟡 MÉDIO | **Planejamento ↔ Mão de Obra** | Equipes do planejamento (`PlanTeam`) não estão atreladas aos trabalhadores reais do `maoDeObraStore`. Não dá para bloquear alocação se o oficial está afastado |
| 11 | 🟡 MÉDIO | **Planejamento ↔ Quantitativos** | Custos unitários do planejamento (`unitCostBRL`) deveriam vir do orçamento parametrizado (SINAPI). Hoje são manuais |

### A "ontologia" — verdade ou marketing?

**Verdade parcial.** Os 3 elos existentes (PreConstr → Plan → RDO) são reais e funcionam. Mas a promessa de "tudo integrado" da landing está **70% verdadeira** — os 30% que faltam são justamente as integrações de #8 e #9 acima, que são as mais visíveis para um cliente que pediu uma demo.

## D) Qualidade do Código

### ⚠️ Componentes muito grandes (>500 linhas)

| Arquivo | Linhas | Problema | Recomendação |
|---|---|---|---|
| [PlanejamentoMacroPanel.tsx](../src/features/planejamento-mestre/components/PlanejamentoMacroPanel.tsx) | **710** | Faz tudo: form, tabela, modal, drag&drop, KPIs | Quebrar em `MacroForm`, `MacroTable`, `MacroKpis`, `MacroTimeline` |
| [ConfigPanel.tsx](../src/features/planejamento/components/ConfigPanel.tsx) | **612** | Configurações de calendário, equipes, produtividade, BDI, regras técnicas — tudo em uma só tela | Quebrar em sub-tabs internas |
| [DerivacaoPanel.tsx](../src/features/planejamento-mestre/components/DerivacaoPanel.tsx) | **487** | Lógica de derivação macro→detalhe + UI misturadas | Extrair lógica para `derivationEngine.ts` |
| [ProgramacaoSemanalPanel.tsx](../src/features/planejamento-mestre/components/ProgramacaoSemanalPanel.tsx) | **424** | OK no limite |

### ✅ Excelente: separação de engines

A pasta `src/features/planejamento/utils/` tem 3 engines puros (sem React):
- `scheduleEngine.ts` — CPM forward-pass
- `analysisEngine.ts` — S-curve, ABC, histograma
- `exportEngine.ts` — CSV/JSON

Isso é **a maneira certa** de estruturar lógica de negócio. Ela é testável (embora **não haja testes**, ver E) e reutilizável.

### ❌ Falta de testes

Nenhum arquivo `.test.ts` no módulo. Os engines (`scheduleEngine.ts`) são puros e seriam **trivialmente testáveis**. Recomendação: adicionar Vitest com pelo menos:
- `scheduleEngine.test.ts` — testar CPM com cenário conhecido
- `analysisEngine.test.ts` — testar curva S e ABC
- Snapshot de exports (CSV/JSON)

### Magic numbers

| Onde | Valor | Recomendação |
|---|---|---|
| [GanttPanel.tsx:14](../src/features/planejamento/components/GanttPanel.tsx#L14) | `CELL_W = 44` | Mover para constantes nomeadas se for reutilizado |
| `TEAM_BG` array literal | hex hardcoded | OK por enquanto |

## E) Responsividade Mobile

### 🔴 ACHADO ALTO

| # | Severidade | Arquivo | Problema |
|---|---|---|---|
| 12 | 🔴 **ALTO** | [GanttPanel.tsx](../src/features/planejamento/components/GanttPanel.tsx) | **Sem `overflow-x-auto`** no container do Gantt. No celular, o Gantt explode a viewport e cria scroll horizontal da página inteira |
| 13 | 🟡 MÉDIO | [PlanejamentoMacroPanel.tsx](../src/features/planejamento-mestre/components/PlanejamentoMacroPanel.tsx) | Tabelas largas sem wrapper `overflow-x-auto` |
| 14 | 🟡 MÉDIO | [ConfigPanel.tsx](../src/features/planejamento/components/ConfigPanel.tsx) | Grids `grid-cols-3` sem variants `sm:grid-cols-1` — quebram no celular |

**Correção rápida do Gantt** (item 12):
```tsx
<div className="overflow-x-auto -mx-4 px-4">
  <div style={{ minWidth: TRECHO_COL_W + workDays.length * CELL_W }}>
    {/* gantt content */}
  </div>
</div>
```

### Inputs em mobile (zoom no iOS)

Inputs com `text-xs` (= 12px) **causam zoom automático** no Safari iOS quando o usuário foca. Solução: usar `text-base` (16px) em mobile via `text-base sm:text-xs`.

## F) UI/UX

### ✅ Pontos fortes
- Cores e acento consistentes (`#f97316` orange) — bate com a sidebar
- Sticky header/column no Gantt — boa decisão
- Inline editing no Gantt (clique no trecho → edita) — UX rica
- Tabs internas bem organizadas

### ⚠️ Achados

| # | Severidade | Onde | Problema | Recomendação |
|---|---|---|---|---|
| 15 | 🟡 MÉDIO | Geral | Botão **"Rodar Cronograma"** não tem **loading visual**. Em projetos grandes pode parecer travado | Adicionar spinner + disabled enquanto `runSchedule()` executa |
| 16 | 🟡 MÉDIO | [TrechosPanel.tsx](../src/features/planejamento/components/TrechosPanel.tsx) | **Empty state genérico** quando não há trechos. Falta CTA "Importar do CSV" / "Importar de Pré-Construção" | Adicionar empty state acionável |
| 17 | 🟢 BAIXO | Geral | Sem **toasts/notifications** após save de cenário, import de trechos, etc. — usuário não sabe se deu certo | Adicionar `react-hot-toast` ou similar |
| 18 | 🟢 BAIXO | [ConfigPanel.tsx](../src/features/planejamento/components/ConfigPanel.tsx) | Acessibilidade: vários inputs sem `<label htmlFor>` | Adicionar labels acessíveis |

---

# 🛡️ Módulo Qualidade

Inclui [src/features/qualidade](../src/features/qualidade) e [src/store/qualidadeStore.ts](../src/store/qualidadeStore.ts).

## A) Segurança

### ✅ Boas práticas
- IDs via `crypto.randomUUID()`
- Função `escapeHtml()` em [fvsPdfExport.ts:29](../src/features/qualidade/utils/fvsPdfExport.ts#L29) — escape correto antes de injetar em HTML
- Sem `dangerouslySetInnerHTML`, sem `eval`
- Anti-duplicate submit no `NovaFvsPanel` (após o fix recente)
- File uploads (logo) validam MIME e tamanho ≤ 1 MB
- PDF export força `color-scheme: light` — evita auto-invert do navegador

### ⚠️ Achados

| # | Severidade | Arquivo | Problema | Recomendação |
|---|---|---|---|---|
| Q1 | 🟡 MÉDIO | [fvsPdfExport.ts:38](../src/features/qualidade/utils/fvsPdfExport.ts#L38) | `buildLogoHtml` injeta `${logoBase64}` direto no `src` sem validar prefixo `data:image/`. Se um logo malformado for salvo, pode virar XSS via atributo | Validar prefixo: `if (!logoBase64.startsWith('data:image/')) return fallback` |
| Q2 | 🟢 BAIXO | [NovaFvsPanel.tsx](../src/features/qualidade/components/NovaFvsPanel.tsx) | Validação no submit é **manual** (lista de `if`s). Frágil. | Migrar para Zod schema (já existe `fvsSchema` — só não está sendo usado depois do redesign) |

## B) Dados e Persistência

### ✅ Acabou de ser corrigido

| Item | Status |
|---|---|
| Persistência localStorage via `zustand persist` | ✅ Adicionada (`cdata-qualidade`) |
| Anti-duplicate submit | ✅ Adicionado (`isSubmitting` guard) |
| Store inicia vazio (mocks só via Demo Mode) | ✅ Corrigido |
| Schema migration | ⚠️ **Ausente** — quando os campos `documentCode`/`revision` foram adicionados, FVSs antigas no localStorage podem quebrar |

### ⚠️ Achados

| # | Severidade | Problema | Recomendação |
|---|---|---|---|
| Q3 | 🟡 MÉDIO | Sem `version` + `migrate` no persist | Adicionar versão 1, e migrate que define `documentCode='FOR-FVS-02'` e `revision='00'` para FVSs sem esses campos |
| Q4 | 🟢 BAIXO | Tamanho: 1 FVS ≈ 6 KB. 100 FVSs ≈ 600 KB. Aceitável | OK |

## C) Integração com Outros Módulos

### ❌ Quase nenhuma integração

| # | Severidade | Integração ausente | Por que importa |
|---|---|---|---|
| Q5 | 🔴 **ALTO** | **Qualidade ↔ RDO** | Uma FVS aprovada deveria desbloquear etapas no RDO. Hoje não há sinal entre os dois. |
| Q6 | 🟡 MÉDIO | **Qualidade ↔ Mapa Interativo** | FVS de solda PEAD deveria ser amarrada ao trecho da rede no Mapa. Hoje é texto livre. |
| Q7 | 🟡 MÉDIO | **Qualidade ↔ BIM** | Uma FVS de armadura deveria ser amarrada ao elemento BIM (pilar P-12, viga V-3). Hoje não. |
| Q8 | 🟡 MÉDIO | **Qualidade ↔ Planejamento** | NC aberta deveria gerar restrição automática no LPS (Constraint Register). Hoje não há sinal. |
| Q9 | 🟢 BAIXO | **Qualidade ↔ Suprimentos** | NC por material divergente deveria abrir scorecard negativo no fornecedor. Hoje não. |

### Verdade ou marketing?

A "ontologia" da Qualidade é **30% verdade**. Hoje o módulo é uma ilha — bem feita, mas isolada. Esse é o débito técnico mais visível para um cliente que vai usar a Qualidade junto com o RDO.

**Recomendação prioritária:** implementar Q5 (Qualidade ↔ RDO) primeiro, porque é o caso de uso mais óbvio: "RDO de hoje só pode fechar se as FVS pendentes do dia foram preenchidas".

## D) Qualidade do Código

### ✅ Pontos fortes
- [fvsPdfExport.ts](../src/features/qualidade/utils/fvsPdfExport.ts) é **bem isolado** — função pura que recebe FVS e gera HTML. Reutilizável e testável.
- Tipos TypeScript fortes em [types/index.ts](../src/types/index.ts) (FVS, FvsItem, FvsProblemAction)
- Sem `any` espalhado

### ⚠️ Achados

| # | Severidade | Arquivo | Problema | Recomendação |
|---|---|---|---|---|
| Q10 | 🟡 MÉDIO | [NovaFvsPanel.tsx](../src/features/qualidade/components/NovaFvsPanel.tsx) | **612 linhas** com lógica de form, validação manual, render de tabela, render de checkboxes — tudo no mesmo arquivo | Quebrar em `FvsHeader.tsx` (cabeçalho da ficha), `FvsItemsTable.tsx`, `FvsProblemsTable.tsx`, `FvsClosure.tsx` |
| Q11 | 🟢 BAIXO | [schemas.ts](../src/features/qualidade/schemas.ts) | Schema Zod definido mas **não usado** depois do redesign do NovaFvsPanel | Reincorporar Zod ou apagar o schema (atualmente é dead code) |
| Q12 | 🟢 BAIXO | Geral | Sem testes | Adicionar Vitest para `fvsPdfExport.ts` (snapshot de HTML gerado) |

## E) Responsividade Mobile

### Análise

O `NovaFvsPanel` foi desenhado para espelhar **pixel-a-pixel** o formulário oficial FOR-FVS-02. Isso é **bom para o cliente que viu a foto**, mas **ruim para mobile** — formulários A4 simplesmente não cabem em 375px de largura.

| # | Severidade | Arquivo | Problema | Recomendação |
|---|---|---|---|---|
| Q13 | 🟡 MÉDIO | [NovaFvsPanel.tsx](../src/features/qualidade/components/NovaFvsPanel.tsx) | A tabela principal de itens tem 7 colunas + checkboxes — quebra horrivelmente em 375px (mesmo com `overflow-x-auto`) | **Renderização condicional**: em mobile (`<sm`) renderizar como **lista de cards** ao invés de tabela. Cada item vira um card com label + 3 botões + data |
| Q14 | 🟢 BAIXO | [HistoricoPanel.tsx](../src/features/qualidade/components/HistoricoPanel.tsx) | A linha principal tem 8 elementos lado-a-lado — em mobile precisa quebrar | Adicionar `flex-wrap` (já tem em alguns lugares mas não consistente) |

### ✅ Já está OK
- Sidebar é mobile-friendly (sheet overlay)
- Header é responsivo (`flex-wrap`)
- Botões têm tamanho adequado para touch (≥36px)

## F) UI/UX

### ✅ Pontos fortes
- O formulário é **fiel ao papel oficial** — engenheiro reconhece de imediato
- Checkboxes de conformidade são **visualmente claros** (verde ✓ / vermelho ✗ / azul ✓)
- Empty state no histórico mostra ícone + mensagem
- Persona orange/dark consistente com o resto da plataforma
- Botão **"Salvar FVS"** agora tem feedback (`Salvando…` + `disabled`)

### ⚠️ Achados

| # | Severidade | Onde | Problema | Recomendação |
|---|---|---|---|---|
| Q15 | 🟡 MÉDIO | [NovaFvsPanel.tsx](../src/features/qualidade/components/NovaFvsPanel.tsx) | **Sem auto-save** durante o preenchimento. Se o usuário fechar a aba sem salvar, perde tudo | Auto-save em rascunho a cada 5 segundos no localStorage (chave `cdata-qualidade-draft`) |
| Q16 | 🟡 MÉDIO | NC line | Os "checkboxes" SIM/NÃO são **dois checkboxes independentes** — usuário pode marcar os dois | Trocar por radio buttons (mutuamente exclusivos) |
| Q17 | 🟢 BAIXO | [DashboardPanel.tsx](../src/features/qualidade/components/DashboardPanel.tsx) | Quando 0 FVSs, mostra "Nenhuma FVS registrada" — falta CTA "+ Criar primeira FVS" | Adicionar botão de ação no empty state |
| Q18 | 🟢 BAIXO | Histórico | Sem **paginação** — se houver 500 FVSs, lista vai ficar lenta | Implementar virtual scroll ou paginação a partir de 50 itens |

---

## 🎯 Plano de Ação Recomendado

### Sprint 1 (Crítico — 1 semana)
1. **#4** Adicionar persistência localStorage no `planejamentoStore` (✅ Qualidade já tem)
2. **#12** Corrigir Gantt mobile (`overflow-x-auto` wrapper)
3. **Q13** Renderização condicional mobile da tabela FVS (cards no lugar de tabela)
4. **Q16** Trocar checkboxes SIM/NÃO da NC por radios

### Sprint 2 (Alto — 2 semanas)
5. **#8 / #9** Integração Planejamento ↔ Suprimentos + Planejamento ↔ BIM 4D
6. **Q5** Integração Qualidade ↔ RDO (FVS bloqueia/desbloqueia etapas)
7. **#15** Loading state visual no `runSchedule()`
8. **#7** Mover `runSchedule` para Web Worker
9. **Q15** Auto-save de rascunho de FVS

### Sprint 3 (Médio — 2 semanas)
10. **#10** Integração Planejamento ↔ Mão de Obra (validação de equipe)
11. **#11** Integração Planejamento ↔ Quantitativos (custos via SINAPI)
12. **Q6 / Q7** Integração Qualidade ↔ Mapa + Qualidade ↔ BIM
13. Quebrar componentes >500 linhas em sub-componentes

### Sprint 4 (Baixo — 1 semana)
14. Adicionar **Vitest** + testes para engines puros (scheduleEngine, analysisEngine, fvsPdfExport)
15. Adicionar **react-hot-toast** para feedback consistente
16. Migration do persist (Q3)
17. Empty states acionáveis em vários módulos

---

## Veredito Final

A plataforma tem uma **arquitetura sólida** (Zustand + engines puros + tipos fortes) e uma **UX visual madura**. Os principais débitos são:

1. **Persistência inconsistente** — Qualidade tem, Planejamento (e provavelmente outros 70% dos módulos) não. Isso é um **deal-breaker** para uma plataforma "operacional".
2. **Integração entre módulos é menor do que a landing promete** — a "ontologia unificada" funciona em alguns lugares (RDO ↔ Planejamento) e está ausente em outros (Qualidade ↔ tudo). Cliente vai cobrar isso na primeira semana de uso.
3. **Mobile precisa de carinho específico** — não basta colocar `overflow-x-auto`; tabelas precisam de versões "card" para 375px.

Boas notícias:
- **Zero CRÍTICO de segurança** — código é defensivo e bem escrito
- **Engines de planejamento são impressionantes** — CPM, S-curve, ABC, simulação tudo funcionando
- **Tipos fortes** — refatoração futura vai ser indolor
- **Sem dependência de backend externo** — facilita demos e POCs offline

**Pontuação geral:** 7.5/10 — pronto para POC com clientes piloto, com débitos acionáveis bem mapeados.
