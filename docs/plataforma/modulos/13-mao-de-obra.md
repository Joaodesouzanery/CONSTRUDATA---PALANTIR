# Mão de Obra

> **Rota(s):** módulo `MaoDeObraPage` (`src/features/mao-de-obra/index.tsx`) · **Store(s):** `useMaoDeObraStore` (`src/store/maoDeObraStore.ts`), consome `useActiveObraStore`, `useTorreStore`, `useRdoStore`, `usePlanoExecucaoStore`, `useProjetosStore` · **Grupo na sidebar:** Operação / Campo (Mão de Obra) — *o painel de frotas mora nesta pasta mas é servido pelo módulo Gestão de Equipamentos, ver seção "Gestão de Frotas"*

---

## O que é / problema que resolve

Módulo de **RH operacional de obra**: cadastro de funcionários, escala (turno), apontamento de horas/produção, folha de pagamento CLT, ausências/substituições, avaliação de desempenho, custo mensal de mão de obra (CMO), produtividade (RUP) e conformidade trabalhista (CLT). É a "planilha viva" que centraliza quem trabalha, em qual obra, quantas horas, quanto custa e se a escala fere a legislação.

O problema concreto que resolve: no canteiro, essas informações costumam viver em planilhas soltas (efetivo no Excel, ponto no caderno, folha no contador, produtividade no "achismo"). Aqui tudo é dado único: o RDO Compizzo finalizado vira apontamento automático (ponte `syncRdoToTimecards`), o apontamento vira RUP e custo/dia, a escala vira validação CLT e folha, a falta injustificada vira desconto no custo e penalização na avaliação. O `MaoDeObraHeader` já mostra 5 KPIs de topo — Colaboradores Ativos, Faltas esta Semana, HE esta Semana, Postos Descobertos, Violações CLT (`MaoDeObraHeader.tsx:82-113`).

O módulo é **local-first** (Zustand + `persist` em localStorage `cdata-mao-de-obra`, `maoDeObraStore.ts:909`) com sincronização para Supabase por fila de operações e RLS multi-tenant por `organization_id`, escopado por obra ativa via `worker.siteId`.

## Para quem (papéis / persona)

- **Encarregado / mestre de obras / apontador:** lança apontamento de horas e produção, registra ocorrências, marca falta.
- **Engenheiro de campo / planejador:** monta escala (Escala Inteligente), gera escala automática CLT-compliant, acompanha RUP e produtividade, aceita/dispensa sugestões de realocação.
- **RH / DP / administrativo da obra:** cadastra funcionários e certificações, gera folha de pagamento, acompanha RH Financeiro e orçamento, gerencia calendário de ausências.
- **Técnico de segurança (SESMT):** verifica acesso a áreas de risco por certificação (NR), acompanha vencimento de treinamentos.
- **Gerente / diretor:** lê CMO, DRE de RH, tendência de custo e violações CLT.
- No servidor, INSERT/UPDATE em `worker_assessments` exige papel `engenheiro`/`planejador`/`gerente`/`diretor`/`owner` (`20260622120000_worker_assessments.sql:33-47`) — [inferido] as demais tabelas seguem o padrão RLS 0020 do grupo operacional.

## Funcionalidades detalhadas

O módulo tem **14 abas** navegadas por `MaoDeObraHeader` (`MaoDeObraHeader.tsx:14-29`), renderizadas por `switch` em `index.tsx:76-93`. Além do header com 5 KPIs e botão **Importar Funcionários** (`ImportModal` + `WORKER_IMPORT_CONFIG`, CPF mascarado por LGPD, `MaoDeObraHeader.tsx:131-156`) e `SyncBadge`.

### 1. Dashboard (`DashboardPanel.tsx`)
Filtro por período (última semana / último mês / este mês) e por departamento (`DashboardPanel.tsx:320-348`).
- **HRKpiCards** — 6 KPIs: Total Colaboradores (ativos/total), Faltas esta Semana + % presença, HE esta Semana + nº de turnos, Postos Descobertos hoje, **Aderência HH** (`actualHH ÷ plannedHH`, `plannedHH = ativos × 5 × 8`), **Certificações OK** (% sem cert vencida) (`DashboardPanel.tsx:248-296`).
- **RupMiniCard** — RUP do período escopado por obra (`useObraScopedLabor`), com meta TCPO e semáforo (`DashboardPanel.tsx:9-36`).
- **HHBarChart** — HH planejado (referência = maior realizado × 1.15) vs realizado por dia; barra verde se ≥ 85% do planejado, amarela se abaixo (`DashboardPanel.tsx:40-122`). [código] O "planejado" aqui é uma referência derivada, não um plano formal.
- **PhysicalProgressSummary** — progresso físico por atividade (planejado × realizado, pior primeiro) (`DashboardPanel.tsx:126-173`).
- **CertExpiryTable** — certificações a vencer em 60 dias, cor por dias restantes (`DashboardPanel.tsx:177-231`).

### 2. Produtividade (`ProdutividadePanel.tsx`)
RUP por obra vs TCPO, escopo por obra ativa. Campo editável de **Meta TCPO** grava em `cltSettings.rupTargetM2PerHH` (`ProdutividadePanel.tsx:76-77`). Período: última semana / último mês / este mês.
- **KPIs:** RUP atual (HH/m²), Situação vs TCPO (semáforo + nº de apontamentos), Homem-hora total + produtividade (m²/HH), Metragem executada (apontamentos + RDO) (`ProdutividadePanel.tsx:95-120`).
- **Tendência do RUP (6 semanas)** — barras por semana, menor é melhor (`computeRupTrend`).
- **Planejado × Executado** — Σ áreas dos planos de execução que cobrem o período × m² executado (`computeMetragemBalance`).
- **"Vale a pena sábado/domingo?"** — veredito `vale`/`nao_vale`/`neutro` comparando custo de FDS (sábado com prêmio de HE, domingo/feriado 100%), produção marginal e ganho de prazo (`analyzeWeekend`, `produtividade.ts:136-215`).
- **"Como estão escalados?"** — resumo de turnos por tipo + carga de fim de semana (`summarizeEscala`), com atalho para a aba Escala.
- Aviso quando há funcionários sem obra vinculada em modo "Todas as obras" (`ProdutividadePanel.tsx:88-92`).

### 3. Funcionários (`FuncionariosPanel.tsx`)
CRUD completo de `Worker`. Busca por nome/matrícula; filtros por função, setor, status, equipe; toggle **Agrupar por Equipe**; export CSV; expandir linha para detalhe.
- **Modal de funcionário** (`WorkerFormModal`, `FuncionariosPanel.tsx:38-184`): nome*, função*, matrícula, departamento, frente de trabalho, **obra (Torre de Controle)**, local livre, e-mail, telefone, admissão, tipo de contrato (CLT/PJ/Freelancer/Aprendiz), regime (Padrão/6x1/5x2/12x36/Diarista/Custom), equipe, status, **taxa horária**, **salário bruto**, CPF mascarado, certificações.
- **Escopo por obra:** funcionário sem `siteId` = "geral" (aparece em todas as obras); com `siteId` só aparece na obra dele (`FuncionariosPanel.tsx:344-354`). No `addWorker`, `siteId===undefined` cai na obra ativa; `''` = geral; id = aquela obra (`maoDeObraStore.ts:426-431`).
- Excluir usa `window.confirm` e faz **soft-delete** (marca `deleted_at`, `maoDeObraStore.ts:452-457`).

### 4. Escala (Escala Inteligente, `EscalaInteligentePanel.tsx`)
Calendário de turnos com 3 modos: **Mês / Semana / Dia**.
- **Equipes** (seção colapsável `EquipesSection`): CRUD de `LaborCrew` (nome, obra, especialidade, encarregado com datalist de funcionários, seleção de membros por checkbox) para reutilizar times nos RDOs (`EscalaInteligentePanel.tsx:617-775`).
- **ShiftDialog** — add/edit turno: colaborador, data, tipo (regular/HE/noturno/feriado/DSR/falta), início, término, intervalo (min), status (agendado/confirmado/ausente/cancelado), frente, motivo da HE.
- **Gerar Escala Automática** — `generateSchedule(mês)` chama `autoGenerateSchedule` (domingo = folga; Seg–Sáb aloca por posto respeitando papel, menor carga semanal, descanso mínimo e teto semanal) e re-valida CLT (`cltEngine.ts:286-364`).
- **Configurações CLT** (`CLTSettingsModal`) — jornada diária, HE máx/dia, jornada semanal, descanso mín, início/fim noturno, adicional noturno %, taxa HE %.
- **Painel de Alertas CLT** — lista violações (bloqueante/aviso) com descrição e data; overlay de **m² produzidos por dia** no calendário mensal (apontamentos em m² + RDO Compizzo, `EscalaInteligentePanel.tsx:401-412`).
- [código] Turnos gerados pela escala automática recebem id `sh-<8hex>` e **não** entram na `pendingSync` (`maoDeObraStore.ts:679`) — são locais; só turnos add/edit manuais sincronizam.

### 5. Postos (`PostosPanel.tsx`)
CRUD de `WorkPost` (nome, frente, cargo requerido, mín. de trabalhadores, turno manhã/tarde/noite/integral). Grid de **Cobertura Semanal por Posto**: por posto × dia mostra `escalados/requerido` com cor coberto (verde) / parcial (amarelo) / descoberto (vermelho); domingo = DSR (`PostosPanel.tsx:159-185, 339-372`). KPIs de topo: Total de Postos, Cobertos Hoje, Descobertos.
- [código] Postos usam id `wp-<8hex>` e não entram na `pendingSync` (`maoDeObraStore.ts:696-707`) — persistidos só em localStorage.

### 6. Custo Mensal — CMO (`CMOPanel.tsx`)
Projeção de custo mensal via `projectMonthlyCost` (`cltEngine.ts:368-442`). Navegação por mês; toggle **Base / Otimizado**.
- **Cenário Otimizado** — sliders de **Redução de HE** (encurta turnos `overtime` pelo fator) e **Redistribuição Noturno** (simulação), com **Economia estimada** (HE base − otimizado; noturno estimado; total) (`CMOPanel.tsx:117-131, 234-277`).
- **6 KPIs:** Total Bruto, Horas Regulares, Custo Hora Extra, Adicional Noturno, FGTS empregador (`totalCost × 0.08`), Total Geral (`CMOPanel.tsx:160-167`).
- **Custo de M.O. realizado (via RDO)** — soma `laborCostBRL` dos timecards com `sourceRdoId` no mês, escopado por obra; **Desconto de faltas** = faltas injustificadas × `custoDiaWorker`; **Custo líquido** = realizado − desconto; Dias com RDO; Funcionários (`CMOPanel.tsx:176-198`).
- **Custo por Cargo** — tabela (qtd, H.reg, H.E., H.not, total) + gráfico SVG empilhado (regular/HE/noturno).

### 7. Faltas / Subs (`FaltasSubsPanel.tsx`)
Registro de faltas + **sugestão automática de substituto**.
- Stats 30d: Faltas, Cobertas, Descobertas, Em Aberto; breakdown por tipo; **Mais Ausentes (30d)**.
- **AbsenceDialog** — colaborador, data, tipo (atestado/justificada/injustificada/férias/acidente/outro), observações. Ao registrar, mostra **sugestões de substituto** rankeadas por `suggestSubstitutes` (mesmo cargo, ativo, não escalado no dia, descanso CLT OK, menor custo/hora, `cltEngine.ts:453-485`); botão "Atribuir" chama `assignSubstitute`.
- Tabela filtrável (tipo/status) com ação **Resolver** (`resolveAbsence`).

### 8. Avaliações (`AvaliacoesPanel.tsx`)
Ficha de avaliação de desempenho (`WorkerAssessment`).
- **AssessmentDialog** — colaborador, obra, período; **faltas puxadas automaticamente** do registro de faltas (`countAbsencesInPeriod`), atrasos informados manualmente; **8 critérios 0–10** (Qualidade, Retrabalho, Organização, Produtividade, Comprometimento, Orientações, Confiabilidade, Liderança); observações. Nota Final e classificação recalculadas ao vivo.
- Stats: total de avaliações, nota média, "Em atenção"; tabela com CRUD (Editar/Remover soft-delete).

### 9. Folha de Pagamento (`FolhaPagamentoPanel.tsx`)
Geração de folha CLT por mês via `generateMonthPayroll`.
- Botão **Gerar Folha**, **Exportar CSV** (com BOM + `payrollToCSV`), **PDF** (`window.print` com layout print-only detalhado por INSS/IRRF/FGTS, `FolhaPagamentoPanel.tsx:294-340`).
- Cards de resumo: Custo Total Empresa, Total Líquido, Total Bruto, Colaboradores.
- Tabela de holerites expansível (proventos: base + HE + adicional noturno + DSR; deduções: INSS/IRRF/VT/VA do trabalhador + FGTS do empregador; líquido; custo empresa) (`payrollEngine.ts:120-261`).

### 10. RH Financeiro (`RHFinanceiroPanel.tsx`)
Painel financeiro de RH (calcula folha do mês on-the-fly se ainda não gerada, `RHFinanceiroPanel.tsx:112-116`).
- Alerta de **orçamento** (editável); KPIs: Headcount Ativo, Custo RH do mês, Custo Médio/Colaborador, % HE/Total.
- **Custo por Departamento** (tabela + barra %), **Tipos de Contrato** (donut SVG), **Alertas RH** (violações CLT bloqueantes, postos descobertos, faltas descobertas), **Tendência de Custo RH** (line chart, janelas 6m/2a/3a/∞ a partir de `payrollHistory`).

### 11. Calendário de Ausências (`AusenciasCalendarioPanel.tsx`)
Três modos: **Calendário / Timeline / Lista** (date-fns + ptBR). Dashboard: Taxa de Ausência (`ausências ÷ (ativos × dias úteis)`), Ausências na semana/mês, Média por colaborador. Gráficos 30d (por tipo + Top 5 ausentes). Filtros: colaborador, depto, tipo, status, intervalo de datas (na Lista). Export CSV + PDF print-only. Popover por dia com detalhe.

### 12. Apontamentos (`ApontamentosPanel.tsx`)
Lançamento de horas + produção.
- **TimecardDialog** — funcionário*, data*, horas*, atividade*, quantidade produzida, unidade (m²/m³/kg/un/m/serv), observações (`TimecardDialog.tsx`, schema em `schemas.ts:31-41`).
- **Importar Planilha** (.xlsx/.csv) — [código] no estado atual injeta 2 apontamentos-mock após 1,2s (`ApontamentosPanel.tsx:169-179`) — é um stub de importação.
- Tabela de apontamentos (data, funcionário, atividade, HH, qtd, unidade) + **Progresso Físico Acumulado** (planejado/realizado/desvio por atividade).

### 13. Escalamento (`EscalamentoPanel.tsx`)
- **Sugestões de Realocação** — botão **Rodar Engine** (`runReallocationEngine`) analisa `progress` × `crews`: atividades com `reportado/planejado < 0.70` são "atrasadas" e recebem sugestão de reforço com equipe de tarefa com folga (≥ 0.95); Aceitar/Dispensar (`maoDeObraStore.ts:318-384, 575-594`).
- **Registro de Ocorrências** — `OcorrenciaDialog`: data, tipo (clima/atraso material/falha equipamento/feriado/acidente/outro), descrição, horas impactadas, equipes afetadas (`schemas.ts:47-53`).

### 14. Segurança (`SegurancaPanel.tsx`)
- **Verificar Acesso** (`AccessCheckModal`) — funcionário × área de risco → permitido só se ativo + sem cert ausente/vencida entre as exigidas (`checkAccess`, `maoDeObraStore.ts:598-623`).
- Lista de funcionários com pior status de certificação; áreas de risco cadastradas (cert exigidas); **Calendário de Renovação de Treinamentos** em bandas ≤30 / 31–60 / 61–90 dias.
- `WorkerDialog` (cadastro rápido com certificações NR18/NR35/NR10/NR12/CIPA/ASO, validado por `workerSchema`).

### Gestão de Frotas (não é aba deste módulo)
`GestaoFrotasPanel` mora em `src/features/mao-de-obra/components/gestao-frotas/` mas é **importado e renderizado pelo módulo Gestão de Equipamentos** (`src/features/gestao-equipamentos/index.tsx:8,25`), não pelo `index.tsx` da Mão de Obra. Usa store próprio `useFrotaVeicularStore`. Tem sub-abas de Veículos, Abastecimento (km/L), Manutenção preventiva/corretiva, Motoristas (validade CNH), Rotas, Ordens de Serviço, Multas etc. Documentado no módulo de equipamentos; aqui fica só a nota de localização.

## Dados que gera

Tabelas Supabase (todas `id uuid` PK, `organization_id`, `payload jsonb` com a entidade serializada, `created_by`, `created_at/updated_at/deleted_at` soft-delete) — criadas na migração **0019_grupo_operacional.sql** (5 tabelas de Mão de Obra):

| Tabela | Colunas indexáveis top-level | Migração |
|---|---|---|
| `workers` | `name, role, status, crew_id` | `0019_grupo_operacional.sql:18-34` |
| `labor_crews` | `name` | `0019:36-48` |
| `timecards` | `worker_id, date, hours_worked` (+`site_id`) | `0019:50-66` |
| `shifts` | `worker_id, date, type, status` (+`site_id`) | `0019:68-84` |
| `worker_absences` | `worker_id, date, type, status` (+`site_id`) | `0019:86-102` |
| `worker_assessments` | `worker_id` | `20260622120000_worker_assessments.sql:8-21` |
| `clt_settings` | 1 linha/org (`id = organization_id`, `UNIQUE`) | `20260704120000_clt_settings.sql:7-18` |

Campos-chave (do TypeScript, mapeados para `payload`):
- **`Worker`** — name, role, cpfMasked, crewId, status (active/inactive/suspended/pending_approval), hourlyRate, **grossSalary**, siteId, certifications[], contractType, scheduleType, department, workFront, admissionDate, registrationNumber (`schemas.ts:15-25`; mapper `workerToRow` em `maoDeObraStore.ts:184-195`).
- **`TimecardEntry`** — workerId, date, hoursWorked, projectRef, phaseRef, activityDescription, reportedQty, unit, **sourceRdoId** (idempotência da ponte RDO), **siteId**, **laborCostBRL** (`maoDeObraStore.ts:535-548`).
- **`Shift`** — workerId, date, startTime, endTime, breakMinutes, type, status, workFront, overtimeReason.
- **`WorkerAbsence`** — workerId, date, type, status (open/covered/uncovered), substituteWorkerId, registeredAt.
- **`WorkerAssessment`** — workerId, siteId, periodStart/End, absencesCount, lateCount, criteria{8}, notaFinal, classificacao, createdAt.
- **`CLTSettings`** — maxDailyHours, maxOvertimeHours, maxWeeklyHours, minRestMinutes, nightStart, nightEnd, nightDifferential, overtimeRate, **rupTargetM2PerHH**.

**Só em localStorage (partialize, não sincronizam ao Supabase):** `workPosts`, `payrollHistory`, e ainda `cltSettings` local; **derivados recomputáveis (nunca persistidos):** `violations`, `suggestions`, `progress`, `occurrences`, `riskAreas` (`maoDeObraStore.ts:939-952`; `progress`/`occurrences`/`workPosts` não geram op de sync).

Migração de versão do store: v1 (workPosts vazio), v2 (remove dado demo com id curto, mantendo só UUIDs), v3 (adiciona `assessments`) (`maoDeObraStore.ts:910-937`).

## Cálculos, KPIs e regras de negócio

### RUP — Razão Unitária de Produção (`produtividade.ts`)
`RUP = ΣHH ÷ Σm²` (menor é melhor). Fonte = apontamentos com `unit === 'm²' && reportedQty > 0` + extras do RDO Compizzo (`computeRup`, `produtividade.ts:58-68`). RUP é `null` quando não há m² (evita ÷0 e "verde falso"). Meta TCPO padrão **0,45 HH/m²** (`TCPO_RUP_TARGET_DEFAULT`, `produtividade.ts:11`), configurável em `cltSettings.rupTargetM2PerHH`. Semáforo: verde ≤ meta; amarelo ≤ meta×1,15; vermelho acima (`rupSemaforo`, `produtividade.ts:38-43`).

### Folha CLT 2025 (`payrollEngine.ts`)
- **INSS empregado** progressivo: faixas 7,5% / 9% / 12% / 14% (tetos 1.412 / 2.666,68 / 4.000,03 / 7.786,02) + 14% acima do teto (`calcINSS`, `payrollEngine.ts:43-69`).
- **IRRF 2025** simplificado sobre bruto-após-INSS: 0/7,5/15/22,5/27,5% com parcelas a deduzir (`calcIRRF`, `payrollEngine.ts:73-96`).
- **FGTS** empregador 8%; **INSS patronal** 20% (`calcFGTS`, `calcEmployerINSS`).
- **HE** = `overtimeHours × rate × (1 + overtimeRate/100)`; **Adicional Noturno** = `nightHours × rate × (nightDifferential/100)`; **DSR** proporcional a HE (`payrollEngine.ts:180-200`).
- **VT** = 6% da base (teto = base); **VA/VR** = R$ 35 × dias úteis (desconto do trabalhador) (`payrollEngine.ts:222-232`).
- **Líquido** = bruto − deduções do trabalhador; **Custo Empresa** = bruto + FGTS + INSS patronal (`payrollEngine.ts:242-243`).
- CSV com proteção contra injeção de fórmula (prefixo `'` em `=+-@`) (`csvCell`, `payrollEngine.ts:285-291`).

### Custo de mão de obra p/ planejamento (`custoMaoObra.ts`)
- **Custo/mês** = bruto + FGTS(8%) + INSS patronal(20%) (`custoMesWorker`).
- **Custo/dia** = custo-mês ÷ dias úteis (padrão **22**); fallback = `hourlyRate × jornada`(8h) se não houver bruto (`custoDiaWorker`, `custoMaoObra.ts:40-49`).
- **Match por nome** (RDO texto livre → cadastro) via normalização trim/minúsculas/sem acento (`matchWorkerByName`).

### Conformidade CLT (`cltEngine.ts:111-272`)
Valida por funcionário: jornada diária (Art. 58/59, bloqueante acima de `maxDaily+maxOvertime`, aviso acima de `maxDaily`), intervalos (Art. 71: ≥1h se >6h, ≥15min se 4–6h), descanso entre turnos (Art. 66: `minRestMinutes`, padrão 660 = 11h), jornada semanal (44h), DSR (Art. 67: ≥1 folga/semana). Severidades `blocking`/`warning`. Defaults em `MOCK_CLT_SETTINGS` (`mockMaoDeObra.ts:381-391`).

### Avaliação de desempenho (`assessmentEngine.ts`)
`Nota Final = média(8 critérios) − penalização`, penalização = falta injustificada ×0,5 + justificada ×0,15 + atraso ×0,1, teto 3,0 pontos (`PENALTY`, `assessmentEngine.ts:11-16`). Classificação: excelente ≥9, muito_bom ≥7,5, bom ≥6, regular ≥4, atenção <4. Férias não contam como falta.

### Realocação (`maoDeObraStore.ts:318-384`)
Atividade com `reportado/planejado < 0.70` é "atrasada"; recebe sugestão de reforço vinda de tarefa com ratio ≥0,95 (folga). Atraso estimado ≈ `desvio/15` dias.

### "Vale a pena o fim de semana?" (`analyzeWeekend`, `produtividade.ts:136-215`)
Compara R$/m² do FDS (sábado prêmio HE; domingo/feriado 100%) vs dia útil e o ganho de prazo (`m² FDS ÷ produção média dia útil`). Veredito `vale` se custo ≤ 1,6× útil **e** RUP ≤ 1,5× meta; `nao_vale` se RUP ruim ou custo > 2× útil.

## Integrações — a "camada única"

**O que CONSOME de outros módulos:**
- **Torre de Controle / Projetos** (`useTorreStore.sites`, `useProjetosStore.projects`) — dropdown de obra do funcionário/avaliação; nomes de obra.
- **Obra ativa** (`useActiveObraStore`) — carimba `siteId` em novos funcionários e escopa todo o módulo (`useObraScopedLabor.ts`).
- **RDO Compizzo** (`useRdoStore`) — linhas de produção em m² e horas para RUP/overlay de calendário (`useObraScopedLabor.ts:50-77`); dispara a ponte de apontamentos.
- **Planos de Execução** (`usePlanoExecucaoStore`) — áreas planejadas para "Planejado × Executado".

**O que ALIMENTA outros módulos:**
- **Ponte RDO → Apontamentos** `syncRdoToTimecards` (`maoDeObraStore.ts:522-559`): ao **finalizar** um RDO Compizzo, `RdoCompizzoPanel.tsx:400-408` gera 1 timecard por funcionário presente (match por nome), com horas rateadas por cabeça e `laborCostBRL = custoDiaWorker`. **Idempotente por `sourceRdoId`** — re-finalizar substitui os apontamentos daquele RDO (marca antigos `deleted_at`, insere novos) sem duplicar. `unit:'h'`/`reportedQty:0` para **não** dobrar o m² que a RUP já lê do Compizzo.
- **Gestão 360 / Job Costing** (`JobCostingPanel.tsx:160-200`) — lê `workers` + `timecards`, custo = `hoursWorked × hourlyRate`, por projeto/núcleo.
- **Financeiro** (`financeiroStore.ts:198-201`) — usa `matchWorkerByName` + `custoDiaWorker` para custear presença.
- **LPS-Lean** (`lpsStore.ts:322-345`, `MaoDeObraLpsPanel`) — dimensionamento de efetivo: `availableFromMaoDeObra` = funcionários ativos por equipe.
- **Alertas** (`useAlertCounts.ts:48-65`) — ocorrências e ausências alimentam contadores/alertas por obra.
- **EVM / Relatório 360** — consomem o store para distribuição de custo e ecossistema.

**Realtime** (`src/lib/realtime.ts`): `workers`, `worker_absences`, `shifts` estão nas `SYNC_TABLES` que geram evento `realtime.row_changed` (com coalescer ~350ms) org-wide (`realtime.ts:59-61`). Painéis agregados (ex.: Comando Central) re-buscam ao vivo. [inferido] `timecards`, `labor_crews`, `worker_assessments` e `clt_settings` **não** estão na lista de realtime — sincronizam por flush/pull na abertura do módulo, não ao vivo.

**eventBus** (`src/lib/eventBus.ts`): o módulo não emite eventos próprios; o RDO emite `rdo.finalized`/`rdo.closed` e a integração de apontamentos é feita pela chamada direta `syncRdoToTimecards`, não por evento.

## Eficiência gerada

- **Menos planilha:** efetivo, ponto, escala, folha, ausência, avaliação e produtividade num só lugar, com dado único por `organization_id` e obra. [inferido]
- **Automação da folha CLT:** INSS/IRRF/FGTS/HE/noturno/DSR/VT/VA calculados por engine com tabelas 2025 — [inferido] elimina cálculo manual e reduz erro trabalhista.
- **Ponte RDO → apontamento idempotente:** apontar produção no RDO já vira homem-hora, custo/dia e RUP sem redigitação; re-finalizar não duplica (`sourceRdoId`). Rastreabilidade total até o RDO de origem. [código]
- **Prevenção de passivo:** validação CLT (bloqueante/aviso) e verificação de acesso por certificação (NR) antes do fato. [inferido]
- **Decisão de custo:** cenário Otimizado (redução de HE), "vale a pena sábado?", orçamento de RH com alerta de estouro e tendência — apoiam decisão com número, não achismo. [inferido]
- **RUP como termômetro:** produtividade real vs TCPO 0,45 por obra e por semana, com semáforo. [inferido]

## Como sincroniza

- **Local-first:** Zustand + `persist` (localStorage `cdata-mao-de-obra`, versão 3; `partialize` grava workers/crews/timecards/shifts/absences/assessments/workPosts/cltSettings/payrollHistory/pendingSync). Toda mutação atualiza o estado na hora e enfileira uma `PendingOp` (`makeOp`) para `flush()` (`maoDeObraStore.ts:869-885`).
- **Fila de operações + Supabase:** `flush()` chama `flushQueue`; `pull()` só recarrega tabelas **sem** ops pendentes, para não sobrescrever dado local não sincronizado (`maoDeObraStore.ts:887-906`). Ao abrir o módulo: `ensureTenantScope` → `flush()` → `pull()` (`index.tsx:66-74`), pulando quando em modo demo.
- **Multi-tenant / RLS:** `organization_id` obrigatório; RLS por `user_org()` — SELECT filtra `deleted_at IS NULL`, INSERT exige `created_by = auth.uid()`, **DELETE bloqueado** (exclusão é soft-delete via UPDATE de `deleted_at`) (`worker_assessments`/`clt_settings` migrações; padrão 0020 para as demais). `clt_settings` = 1 linha por org com upsert idempotente.
- **Escopo por obra (não é fronteira de segurança):** coluna `site_id` adicionada a `shifts`/`worker_absences`/`timecards` (`20260627120000_obra_scoping_fase1.sql`), NULL = "todas as obras"; o filtro por obra é feito no app (`useObraScopedLabor`) — funcionário sem obra é "geral". RLS não muda por obra.
- **Isolamento de tenant no cliente:** `ensureTenantScope` compara `activeOrgId` com o marcador de tenant e faz `clearData()` se trocou de empresa, evitando vazar dados entre orgs (`maoDeObraStore.ts:834-846`).
- **Offline:** `flush()` marca `syncStatus:'offline'` sem conexão; re-flush automático no evento `window 'online'` (`maoDeObraStore.ts:872, 959-963`). Realtime só para `workers`/`shifts`/`worker_absences`.
