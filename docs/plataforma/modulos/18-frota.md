# Frota Veicular & Otimização de Frota

> **Rota(s):** `/app/otimizacao-frota` → `OtimizacaoFrotaPage` (`src/App.tsx:138`) · a **Frota Veicular** (Gestão de Frotas) é renderizada como aba dentro do módulo **Predial** (`predial?tab=equipamentos` → `GestaoEquipamentosPage` → aba "frotas") — `src/features/predial/index.tsx:39`, `src/features/gestao-equipamentos/index.tsx:23-27`
> **Store(s):** `otimizacaoFrotaStore` (`src/store/otimizacaoFrotaStore.ts`, persist `cdata-otimizacao-frota`) · `frotaVeicularStore` (`src/store/frotaVeicularStore.ts`, persist `cdata-frota-veicular`)
> **Grupo na sidebar:** não há entrada direta no `Sidebar.tsx`. O acesso se dá por rota direta, pelo `ModuleQuickLinks` (link "Equipamentos" → `/app/gestao-equipamentos`, que redireciona para Predial — `src/components/shared/ModuleQuickLinks.tsx:10`, `src/App.tsx`) e pela **Minha Rotina** semanal (`src/store/userRoutineStore.ts:86` inclui `/app/otimizacao-frota`). No `moduleFlowcharts.ts:651-663` o card aparece como "Frota Veicular".

---

## O que é / problema que resolve

O conjunto Frota resolve dois problemas complementares na operação de máquinas e veículos de uma construtora:

1. **Otimização de Frota e Equipamentos** (`otimizacao-frota`) é a camada analítica/decisória. Roda três "engines" determinísticas sobre dados que já existem em outros módulos e devolve recomendações acionáveis: para onde **realocar** equipamentos ociosos (roteamento), quais máquinas estão prestes a **falhar** (manutenção preditiva via health score) e se vale mais a pena **comprar ou alugar** cada tipo de equipamento (análise financeira BIM 5D). O título da tela é "Otimização de Frota e Equipamentos" e o subtítulo "Roteamento inteligente · Manutenção preditiva · Análise Comprar vs Alugar" (`OtimizacaoHeader.tsx:73-78`) [código].

2. **Frota Veicular / Gestão de Frotas** (`frotaVeicularStore` + `GestaoFrotasPanel`) é a camada operacional de veículos rodoviários (caminhões, utilitários, carros): cadastro, abastecimento, manutenção, rotas, motoristas (CNH), ordens de serviço, multas, custos, agendamento, alertas e relatórios. É a "planilha de frota" trazida para dentro do sistema, com 12 sub-abas e exportação CSV.

Na prática, a Otimização substitui as decisões "no olho" sobre alocação e reposição de máquinas por regras explícitas e reprodutíveis; a Frota Veicular substitui as planilhas paralelas de controle de veículos. As duas convivem: a Otimização trabalha principalmente sobre **equipamentos** (escavadeiras, etc., vindos do `equipamentosStore`), enquanto a Frota Veicular trabalha sobre **veículos** (placa, km, combustível).

## Para quem (papéis / persona)

- **Gestor de equipamentos / logística de máquinas** — usa Roteamento para decidir realocações entre canteiros e Manutenção Preditiva para priorizar intervenções.
- **Diretoria / controladoria (CapEx)** — usa a análise Comprar vs Alugar para decidir aquisição vs locação por tipo de equipamento, ligada à demanda da carteira de obras.
- **Gestor de frota veicular / mecânico responsável** — opera as 12 abas da Gestão de Frotas (abastecimento, OS, multas, CNH).
- **Papéis com permissão de escrita no banco:** as políticas RLS liberam `INSERT`/`UPDATE` para `engenheiro`, `planejador`, `gerente`, `diretor`, `owner` (`0030_frotas_geo_rls.sql`) [schema]. Exclusões exigem aprovação de `gerente` ou `diretor` conforme a matriz (ver Cálculos/Regras).

---

## Funcionalidades detalhadas

### A) Otimização de Frota — `OtimizacaoFrotaPage` (3 abas)

Header fixo com 4 KPIs e barra de abas (`OtimizacaoHeader.tsx`). As 3 abas são `roteamento`, `manutencao`, `buylease` (`OtimizacaoHeader.tsx:14-18`, `index.tsx:20-22`) [código].

**KPIs do header** (`OtimizacaoHeader.tsx:30-63`):
- **Utilização da Frota** = `(totalEquip − idleEquip) / totalEquip` em % (equipamentos do `equipamentosStore`), colorido verde ≥70 / amarelo ≥50 / vermelho abaixo.
- **Equipamentos Ociosos** = contagem de equipamentos com `status === 'idle'`.
- **Alertas Críticos/Altos** = health scores com `riskLevel` `critical` ou `high`.
- **Economia Projetada/mês** = `calcProjectedMonthlySavings(...)`, formatada em `R$…k`.

#### Aba 1 — Roteamento de Frota (`RoteamentoPanel.tsx`)
- **Mapa Leaflet** (`FleetRoutingMap.tsx`) centrado em SP (`[-23.54, -46.63]`, zoom 11), com 3 camadas base (Voyager/Dark Matter/Satélite via CARTO/Esri) e 3 overlays com `LayersControl`: **Canteiros** (marcadores por status da obra), **Equipamentos** (quadrados cinza=ocioso / verde=ativo) e **Rotas Sugeridas** (polilinhas tracejadas coloridas por prioridade; rotas aceitas ganham animação `dashMove` e maior espessura) — `FleetRoutingMap.tsx:104-171` [código].
- **Botão "Rodar Engine"** dispara `runRoutingEngine()`; lista as sugestões separadas em pendentes e resolvidas (`RoteamentoPanel.tsx:134-159`).
- **Cards de recomendação** (`RoutingCard`): badge de prioridade (Crítico/Alto/Médio/Baixo), código+nome do equipamento, rota `de → para`, motivo textual, distância (km), ganho de utilização (+%), data sugerida e tag opcional "BIM 4D" (`rec.bimPhaseRef`). Ações **Aceitar** (`acceptRouting`) / **Dispensar** (`dismissRouting`); aceitas mostram badge "Em execução" (`RoteamentoPanel.tsx:31-119`) [código].

#### Aba 2 — Manutenção Preditiva (`ManutencaoPreditivaPanel.tsx`)
- Título "Saúde da Frota (N equipamentos)"; botões **Adicionar Equipamento** (abre modal) e **Rodar Engine** (`runHealthEngine`).
- **Banner de fila crítica**: se houver equipamentos `critical`/`high`, mostra alerta vermelho com os códigos e "intervenção imediata recomendada" (`ManutencaoPreditivaPanel.tsx:335-347`).
- **HealthCard** por equipamento, ordenado do pior score para o melhor (críticos/altos primeiro — `:307-309`): gauge SVG circular com o score (0-100), badge de risco, janela de falha prevista, até 3 fatores principais, ação recomendada, parada estimada (dias) e custo estimado (R$). Botão de lixeira → `deleteHealthScore`.
- **Modal "Adicionar Equipamento"** (`MaintenanceInputDialog:139`): campos nome, código, data última manutenção, data próxima manutenção (opcional), ano de fabricação, alertas críticos, alertas de aviso, custo de reparo estimado. Ao salvar chama `addHealthScore`, que **calcula** score e risco na hora (`otimizacaoFrotaStore.ts:350-366`).

#### Aba 3 — Comprar vs Alugar (BIM 5D) (`BuyLeasePanel.tsx`)
- Botões **Nova Análise** (modal) e **Rodar Engine** (`runBuyLeaseEngine`).
- **SummaryKPIs** (`:442-493`): Gasto Mensal em Aluguel (soma dos itens `rented`), Economia Anual Projetada, contagem "Comprar" e "Alugar+Neutro".
- **BuyLeaseCard** por análise: tipo de equipamento, status atual (Frota própria/Alugado/Sem ativo), dias/ano projetados, badge de recomendação (COMPRAR/ALUGAR/NEUTRO), **barra de comparação de custos** (aluguel/ano × propriedade/ano) com marcador de break-even, diferença anual "a favor de comprar/alugar", texto de reasoning, e chips de "BIM 5D" (`bimPhases`) e "Projetos" (`relatedProjects`). Botões editar/excluir (`deleteBuyLeaseAnalysis`).
- **Modal Nova/Editar Análise** (`BuyLeaseDialog:127`): tipo, status atual (owned/rented/none), preço de compra, custo mensal de aluguel, custo anual de manutenção, valor residual, dias de uso projetados/ano (com dica "≥180 = comprar · ≤60 = alugar"), projetos relacionados e fases BIM (listas separadas por vírgula). Ao salvar, os campos derivados (custos anuais, break-even, recomendação) são **recalculados no store** (`addBuyLeaseAnalysis`/`updateBuyLeaseAnalysis`).

### B) Frota Veicular — `GestaoFrotasPanel.tsx` (12 sub-abas)

Sub-abas em `FLEET_TABS` (`GestaoFrotasPanel.tsx:1466-1479`) [código]: Veículos, Abastecimento, Manutenção, Rotas, Motoristas, Ordens de Serviço, Multas, Custos, Agendamento, Alertas, Insights, Relatórios.

- **Veículos** (`VeiculosTab:224`): CRUD de veículos (placa, marca/modelo, ano, tipo, combustível, km atual, status, motorista, aquisição). Usa `addVehicle`/`updateVehicle`/`removeVehicle`.
- **Abastecimento** (`AbastecimentoTab:303`): registra abastecimentos (litros, R$/L, km no tanque, tanque cheio, posto); `totalCost` = `liters × pricePerLiter` (`:322`). Tabela com eficiência **km/L** por veículo, calculada com os 2 últimos abastecimentos de tanque cheio: `(kmAtFill₀ − kmAtFill₁) / liters₁` (`:328-342`). KPI de custo do mês corrente.
- **Manutenção** (`ManutencaoTab:448`): manutenções preventivas/corretivas do veículo, com data, próxima data, km, custo, fornecedor, status; separadas em tabelas por rótulo.
- **Rotas** (`RotasTab:686`): viagens (origem/destino, km início/fim, horários, propósito, status); alimentam km rodado usado nos Insights.
- **Motoristas** (`MotoristasTab:595`): CRUD de motoristas com CNH (número, categoria, vencimento) e CPF mascarado; `daysUntil(licenseExpiry)` para sinalizar vencimento (`:603`).
- **Ordens de Serviço** (`OrdensTab:789`): OS com código automático `OS-0001` (gerado no store, `frotaVeicularStore.ts:329`), status e prioridade.
- **Multas** (`MultasTab:902`): infrações (valor, vencimento, pontos, status); soma de multas pendentes (`:913`).
- **Custos** (`CustosTab:1007`): gráfico de barras empilhadas **custo mensal (6 meses)** por combustível/manutenção/multas e **ranking de custo total por veículo** (fuel+maint+fines, ordenado desc) — `:1022-1038`.
- **Agendamento** (`AgendamentoTab:1105`): calendário semanal de eventos (manutenção/inspeção/rota) com navegação por semana (`weekOffset`).
- **Alertas** (`AlertasTab:1218`): contadores por severidade (crítico/alto/médio/baixo), lista de alertas ativos ordenada por severidade, botão **Dispensar** (`dismissAlert`, seta `isActive=false`).
- **Insights** (`InsightsTab:1270`): KPIs **Disponibilidade** (`active/total`), **Média km/L** (encadeando abastecimentos de tanque cheio por veículo), **Custo/km** (`totalFuelCost / totalRouteKm`), **OS em Aberto**; barras de utilização (km rodado) por veículo — `:1275-1338`.
- **Relatórios** (`RelatoriosTab:1344`): exporta CSV filtrado por veículo, intervalo de datas e tipo (combustível / manutenção / multas / completo), gerado **localmente** ("nenhum dado é enviado para servidores externos", `:1455-1457`) via `downloadCSV`; células escapadas com `safeCsvCell`.

---

## Dados que gera

Todas as tabelas seguem o padrão do Sprint 5 (PK uuid, `organization_id` NOT NULL, `project_id` nullable, `created_by`, `created_at/updated_at/deleted_at` soft-delete, `payload jsonb` com a entidade completa) — cabeçalho de `supabase/migrations/0029_frotas_geo.sql:1-12` [schema].

**Frota Veicular — 9 tabelas** (`0029_frotas_geo.sql`) [schema]:
| Tabela | Colunas promovidas (fora do payload) | Migração |
|---|---|---|
| `veiculos` | `plate, make, model, status, current_km` | `:64` |
| `fleet_drivers` | `name, cpf_masked, license_number, license_expiry, status` | `:84` |
| `fleet_fuel_records` | `vehicle_id, date, liters, total_cost` | `:102` |
| `fleet_vehicle_maintenance` | `vehicle_id, service_date, next_service_date, status` | `:120` |
| `fleet_routes` | `vehicle_id, driver_id, date, status` | `:138` |
| `fleet_service_orders` | `vehicle_id, code, status, priority` | `:157` |
| `fleet_fines` | `vehicle_id, driver_id, date, status, due_date` | `:175` |
| `fleet_alerts` | `vehicle_id, severity, is_active` | `:193` |
| `fleet_schedules` | `vehicle_id, scheduled_date, status` | `:209` |

**Otimização — 3 tabelas** ("outputs/histórico das engines", `0029_frotas_geo.sql:226`) [schema]:
- `otimizacao_routing_recommendations` (`equipment_id, priority, accepted`) — `:229`
- `otimizacao_health_scores` (`equipment_id, risk_level, health_score`) — `:245`
- `otimizacao_buy_lease_analyses` (`equipment_type, recommendation`) — `:262`

**Entidades TypeScript** (`src/types/index.ts`): `Vehicle` (`:1015`), `FuelRecord` (`:1032`, com `kmAtFill`/`fullTank`), `VehicleMaintenanceRecord` (`:1046`), `VehicleDriver` (`:1061`, `cpfMasked`/`licenseNumber`), `VehicleRoute` (`:1074`), `VehicleServiceOrder` (`:1090`), `VehicleFine` (`:1108`), `FleetMaintenanceAlert` (`:1123`), `FleetScheduleEntry` (`:1136`); e do lado analítico `RoutingRecommendation` (`:750`), `PredictiveHealth` (`:773`), `BuyLeaseAnalysis` (`:786`).

**Segurança de dados** (cabeçalho `frotaVeicularStore.ts:1-9`) [código]: IDs sempre via `crypto.randomUUID()`; CPF/CNH guardados só na forma mascarada (`cpf_masked`, nunca o número cru); DELETE crítico via RPC de aprovação.

---

## Cálculos, KPIs e regras de negócio

### Health score (manutenção preditiva) — `computeHealthScore` (`otimizacaoFrotaStore.ts:71-96`) [código]
Começa em 100 e subtrai:
- **Tempo desde a última manutenção:** `−min(30, dias/3)`.
- **Manutenção vencida:** se `nextMaintenanceDate` já passou, `−min(25, diasVencido × 2)`.
- **Alertas críticos ativos:** `−20` cada; **alertas de aviso:** `−10` cada.
- **Idade:** `−min(16, (anoAtual − anoFabricação) × 1.6)`.
- Resultado limitado a `[0,100]` e arredondado.

**Risco por faixa** (`healthRiskFromScore:98`): `<30` critical · `<50` high · `<70` medium · caso contrário low.
**Janela de falha prevista** (`failureWindowFromScore:105`): `7–15 / 15–30 / 30–60 / 60+ dias`.
**Parada/custo estimados** mapeados por risco (`runHealthEngine`, `:338-339`): critical 15d/R$40k · high 8d/R$18k · medium 3d/R$7k · low 1d/R$2,5k.
No `runHealthEngine` (`:284-346`) o "última manutenção" usa a OS concluída mais recente do `gestaoEquipamentosStore` (fallback `eq.lastMaintenance`), e conta alertas não reconhecidos do próprio equipamento.

### Roteamento — `runRoutingEngine` (`otimizacaoFrotaStore.ts:174-256`) [código]
- Considera equipamentos com `status === 'idle'` e coordenadas (`equipamentosStore`) e canteiros `active` com coordenadas (`torreDeControleStore`).
- Para cada equipamento ocioso, escolhe o canteiro ativo **mais próximo** (distância **Haversine**, `haversineKm:58`) que seja diferente do canteiro atual; **descarta se >100 km** (`:207`).
- **Ganho de utilização** por faixa de distância: `<10 km → 55%`, `<30 km → 38%`, senão `24%` (limitado 20–65) — `:210`.
- **Prioridade:** ganho `≥50` critical · `≥35` high · senão medium (`:212-215`).
- **Data sugerida:** hoje + 3 (critical) / 7 (high) / 21 (medium) dias (`:217-218`).
- Deduplica equipamentos já com recomendação aceita/dispensada e preserva as já resolvidas (`:220-253`).

### Comprar vs Alugar — `runBuyLeaseEngine` + `computeBreakEven` (`otimizacaoFrotaStore.ts:114-122, 376-413`) [código]
- Lê a carteira (`projetosStore`) somando as linhas de orçamento `type === 'equipment'` → `equipBudget`; `scaleFactor = min(1.5, equipBudget / 2.000.000)` (default 1) — proxy de demanda (`:381-388`).
- `projectedUsageDays = round(usageDays × scaleFactor)`.
- `annualRentalCostBRL = monthlyRentalCostBRL × 12`.
- `annualOwnershipCostBRL = (purchasePrice − residualValue)/120 × 12 + annualMaintenanceCost` — depreciação linear de **10 anos (120 meses)** + manutenção anual (`:393-396, 436`).
- `breakEvenMonths = purchasePrice / ((annualRent − annualMaintenance)/12)`; retorna `999` se não há economia mensal (`computeBreakEven:114`).
- **Recomendação:** `projDays ≥ 180 → buy` · `≤ 60 → lease` · senão `neutral` (`:398-399`).

### Economia projetada — `calcProjectedMonthlySavings` (`otimizacaoFrotaStore.ts:535-556`) [código]
- Cada roteamento **aceito** vale R$ 4.800/mês em locação evitada (constante).
- Para cada análise: se `buy`, `+max(0,(annualRent − annualOwn)/12)`; se `lease`, `+max(0,(annualOwn − annualRent)/12)`.

### Frota Veicular — indicadores
- **km/L** (Abastecimento/Insights): diferença de odômetro entre abastecimentos de tanque cheio ÷ litros (`:337-339`, `:1285-1292`).
- **Custo/km** = custo total de combustível ÷ km de rotas concluídas (`:1294-1296`).
- **Disponibilidade** = veículos `active` ÷ total (`:1276`).
- **Ranking de custo por veículo** = combustível + manutenção + multas (`:1030-1038`).

### Matriz de aprovação de exclusão (`0031_frotas_geo_rpcs.sql:59-101`) [schema]
Exclusões são **soft-delete via aprovação** (`request_action` → `approve_pending_action`, janela `soft_delete_days = 30`). Papel exigido por ação: `delete_veiculo` → **diretor**; `delete_fleet_fine` e `delete_otimizacao_buy_lease` → **diretor**; demais fleet e `delete_otimizacao_routing`/`delete_otimizacao_health` → **gerente**. O aprovador executa `UPDATE … SET deleted_at = now()` na tabela-alvo (`:178-189`).

---

## Integrações — a "camada única"

**O que a Otimização CONSOME de outros módulos** (via import lazy dos stores para evitar dependência circular):
- `equipamentosStore.equipamentos` — status `idle`, coordenadas e `siteName`, base do roteamento e do health engine (`otimizacaoFrotaStore.ts:176, 285`).
- `torreDeControleStore.sites` — canteiros `active` com coordenadas, destino das realocações (`:177`).
- `gestaoEquipamentosStore.orders` — OS concluídas definem a "última manutenção" real no health engine (`:286, 291-295`).
- `projetosStore.projects.budgetLines` — orçamento de equipamentos vira proxy de demanda no Comprar×Alugar (`:377-388`).

**O que a Frota Veicular ALIMENTA:**
- **Badge de alertas na sidebar / contadores globais:** `useAlertCounts` conta alertas de frota ativos com severidade `critical`/`high` (`src/hooks/useAlertCounts.ts:51-55`) [código].
- A **Manutenção Preditiva** (`ManutencaoPreditivaPanel`) também é reaproveitada como aba "Saúde" do módulo **Predial** (`src/features/predial/index.tsx:14, 40`) [código].

**eventBus / triggers / realtime:** este par de módulos **não** emite nem escuta o `eventBus` (`src/lib/eventBus.ts`) e **não** possui assinatura em `src/lib/realtime.ts` — uma busca por `fleet_/veiculos/otimizacao_` nesses arquivos não retorna nada [código]. A integração é feita por **leitura direta de outros stores Zustand** no momento em que cada engine roda, não por eventos. A propagação para o banco é só por `flush`/`pull` do storeSync.

**Observação de cobertura de sync (Otimização)** [código]: o `otimizacaoFrotaStore` só enfileira operações para o Supabase em: `acceptRouting`/`dismissRouting` (UPDATE de `otimizacao_routing_recommendations`), `deleteHealthScore` e `deleteBuyLeaseAnalysis` (DELETE com aprovação). As criações/edições de health scores e de análises Comprar×Alugar (`runHealthEngine`, `addHealthScore`, `runBuyLeaseEngine`, `add/updateBuyLeaseAnalysis`) só alteram o estado local — os mappers `healthToRow`/`buyLeaseToRow` existem mas estão atualmente sem uso (`:521-522`). Ou seja, esses outputs vivem no `localStorage` e são **recalculados** a cada execução, sem push para o banco (exceto o delete). O `frotaVeicularStore`, ao contrário, sincroniza insert/update/delete das 9 entidades.

---

## Eficiência gerada

- **Menos planilha:** as 12 abas da Gestão de Frotas substituem controles paralelos de veículos (abastecimento, OS, multas, CNH, custos) por um cadastro único com KPIs prontos (km/L, custo/km, disponibilidade) [inferido].
- **Decisão baseada em regra, não em achismo:** roteamento, health score e comprar×alugar tornam explícitas fórmulas que normalmente ficam na cabeça do gestor, e são reprodutíveis a cada "Rodar Engine" [inferido].
- **Dado único / rastreabilidade:** como as engines leem `equipamentosStore`, `torreDeControleStore`, `gestaoEquipamentosStore` e `projetosStore`, a recomendação reflete o estado corrente da operação sem redigitação — o mesmo cadastro de equipamento/obra/orçamento alimenta a análise [inferido/código].
- **Priorização automática de manutenção:** o banner de fila crítica e a ordenação dos cards do pior score para o melhor levam a atenção direto ao equipamento em risco (`ManutencaoPreditivaPanel.tsx:307-347`) [código].
- **CapEx defensável:** a análise Comprar×Alugar amarra a decisão à demanda projetada da carteira e exibe break-even/economia anual, gerando um número justificável para diretoria [inferido].
- **Governança de exclusão:** soft-delete com aprovação por papel evita perda acidental de histórico de frota (`0031_frotas_geo_rpcs.sql`) [schema].

## Como sincroniza

- **Local-first:** ambos os stores usam `zustand/persist` (`cdata-frota-veicular` e `cdata-otimizacao-frota`) — a UI lê/escreve no estado local instantaneamente e persiste no `localStorage` (`frotaVeicularStore.ts:487-495`, `otimizacaoFrotaStore.ts:500-509`) [código].
- **Push (flush):** cada mutação relevante empilha uma `PendingOp` em `pendingSync` e chama `flush()`, que envia a fila via `flushQueue` do `storeSync` quando há sessão e conexão; se `offline`/`unauth`, marca o status e mantém a fila para reenvio (`frotaVeicularStore.ts:445-461`; `otimizacaoFrotaStore.ts:471-487`). Há listener de `online` que refaz o flush ao reconectar (`:499-503` / `:513-517`).
- **Pull:** `pull()` recarrega cada tabela via `pullTable`, mas **pula** tabelas que ainda têm operações pendentes na fila (evita sobrescrever escrita local não confirmada) — `frotaVeicularStore.ts:463-484`, `otimizacaoFrotaStore.ts:489-498` [código]. Os stores são registrados na hidratação de tenant do `appModeStore` (`:113, 148, 162`) e resetados na troca de organização/logout (`auth.ts:64-` inclui `frotaVeicularStore`/`otimizacaoFrotaStore`).
- **RLS / multi-tenant:** todas as tabelas têm RLS habilitada com `FORCE` e isolamento por `organization_id = public.user_org()`; `INSERT`/`UPDATE` gated por papel (`engenheiro/planejador/gerente/diretor/owner`) e DELETE bloqueado em favor do fluxo de aprovação (`0030_frotas_geo_rls.sql:59-74` e demais) [schema].
- **Offline:** suportado no sentido de que a fila persiste e o status vira `offline` quando `navigator.onLine` é falso, reenviando ao voltar a conexão. **Não há realtime** (nenhuma assinatura Supabase) — mudanças de outros usuários só chegam no próximo `pull` [código].
