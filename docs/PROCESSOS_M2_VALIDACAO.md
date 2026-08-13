# Processos M2/M2.5 — registro de validação

Data: 2026-08-13.

Status final: **Complete**. M1, M2 e a correção posterior de privilégios foram
aplicadas manualmente pelo responsável do projeto remoto e conferidas por MCP
read-only. M3 não foi iniciado.

## Artefatos versionados

- M1 preservada: `20260813034218_process_intelligence_m1.sql`.
- SHA-256 M1: `7c832649f1b6c4e4074440402cee8b403321cbda0cb14c9fbf197883c8ded97e`.
- Migration M2: `20260813182714_processos_discovery_m2.sql`.
- Correção posterior de privilégios:
  `20260813192909_processos_service_role_least_privilege.sql`.
- Verificação read-only: `supabase/verification/processos_m2_verification.sql`.
- Testes M2: `supabase/tests/processos_m2.test.sql`.

## Gates locais executados

| Gate | Resultado |
| --- | --- |
| Reset local, ciclo 1 | Passou por toda a cadeia, M1, M2 e correção de privilégios |
| pgTAP, ciclo 1 | 76/76: M1 35 + M2 41 |
| Reset local, ciclo 2 | Passou por toda a cadeia, M1, M2 e correção de privilégios |
| pgTAP, ciclo 2 | 76/76: M1 35 + M2 41 |
| Testes TypeScript | 17/17 |
| ESLint do escopo alterado | Verde |
| `npx tsc -b` | Verde |
| `npm run build` | Verde |
| `git diff --check` | Verde |
| `db lint --level error` | Somente os cinco erros históricos; nenhum erro M1/M2 |

O build cria um chunk lazy próprio do módulo Processos. React Flow, ELK e a
fixture agregada tornam esse chunk grande e o Vite emite o warning de 500 kB;
isso não quebra o build, mas é uma oportunidade de code splitting adicional
antes de M4.

## Validação do dataset e do engine

O seed opt-in foi executado apenas na organização demo local canônica. O
materializador foi executado primeiro em dry-run e depois com `--apply`.

| Evidência | Valor |
| --- | ---: |
| Casos de entrada | 12.483 |
| Eventos de entrada | 153.290 |
| Checksum M1 | `fnv1a64:0e385132416e749b` |
| Checksum de entrada M2 | `fnv1a64:6c6fc21ef80ed19f` |
| Checksum dos parâmetros | `fnv1a64:c2e92a2b6da63c12` |
| Nós | 7 |
| Arestas | 11 |
| Variantes | 7 |
| Casos com loop | 1.498 |
| Casos com retrabalho | 1.498 |
| Casos com desvio proibido | 250 |
| Resumos persistidos | 12.483 |

O mesmo checksum M2 é produzido pela fixture local e pela releitura paginada
dos eventos persistidos. O adapter normaliza timestamps para UTC ISO antes do
checksum, eliminando diferenças de serialização entre `Z` e `+00:00`.

Uma segunda execução idêntica com `--apply` encontrou o snapshot `ready` e não
o recriou, comprovando idempotência. A opção `--force` continua sendo necessária
para apagar e reconstruir explicitamente uma materialização derivada.

## RLS, integridade e performance

A suíte pgTAP executável confirmou:

- `anon` sem leitura;
- `authenticated` lendo apenas snapshot `ready` e resumos da própria organização;
- nenhuma escrita de browser;
- `service_role` capaz de criar materializações;
- FK composta rejeitando referência cross-tenant;
- snapshot `ready` imutável por atualização;
- unicidade por definição, algoritmo, checksum e parâmetros;
- cascade apenas entre snapshot e resumos, sem afetar `process_events`;
- nenhuma carga sintética automática.

Planos observados no dataset completo:

```text
Index Scan using idx_process_events_case_order
Execution Time: 0.065 ms

Index Scan using idx_process_case_summaries_page
Execution Time: 0.031 ms
```

Não houve sequential scan global nem sort evitável nas duas consultas.

## Conferência remota read-only

Projeto confirmado: `wtovivsmvenjbuhdemzv`.

Após a aplicação manual de M1 e M2, a inspeção pelo MCP oficial confirmou:

- as quatro tabelas de Processos existem;
- RLS está habilitada e forçada nas quatro tabelas;
- as políticas tenant-safe de leitura existem e snapshots não `ready` ficam
  invisíveis;
- os índices `idx_process_events_case_order`,
  `idx_process_discovery_snapshots_ready`,
  `idx_process_case_summaries_page` e a unicidade idempotente existem;
- não há findings de segurança do Advisor específicos de Processos;
- os avisos de índices não usados são apenas informativos e coerentes com as
  quatro tabelas ainda vazias;
- não houve seed sintético em produção: 0 definições, 0 eventos, 0 casos,
  0 snapshots e 0 resumos.

O último `EXPLAIN (ANALYZE, BUFFERS)` fornecido pelo responsável confirmou:

```text
Index Scan using idx_process_events_case_order on process_events
Buffers: shared hit=2
Planning Time: 4.463 ms
Execution Time: 0.031 ms
```

Portanto, o índice canônico de reconstrução foi usado sem sequential scan
global ou sort evitável.

### Ajuste de segurança identificado

O catálogo remoto revelou privilégios de tabela herdados por `service_role`,
incluindo `UPDATE`, `DELETE` e `TRUNCATE` em `process_events`. Isso viola o
contrato append-only, embora não exponha escrita aos papéis `anon` ou
`authenticated`.

M1 e M2 já aplicadas não foram alteradas. Foi criada uma migration posterior,
`20260813192909_processos_service_role_least_privilege.sql`, que:

- limita definições a `SELECT`, `INSERT` e `UPDATE`;
- limita eventos a `SELECT` e `INSERT`;
- permite DML server-side nas materializações derivadas;
- remove `TRUNCATE` das quatro tabelas.

A correção passou em dois resets locais e 76 assertions pgTAP em cada ciclo.
Após sua aplicação manual, a conferência MCP read-only confirmou exatamente:

| Tabela | SELECT | INSERT | UPDATE | DELETE | TRUNCATE |
| --- | ---: | ---: | ---: | ---: | ---: |
| `process_definitions` | sim | sim | sim | não | não |
| `process_events` | sim | sim | não | não | não |
| `process_discovery_snapshots` | sim | sim | sim | sim | não |
| `process_case_summaries` | sim | sim | sim | sim | não |

O gate remoto de least privilege está verde.

### Migration history

Como M1 e M2 foram coladas manualmente, seus timestamps não aparecem na tabela
remota de migration history. O schema existe, mas o histórico está divergente.
Não usar `db push --include-all` nem `migration repair` sem auditoria explícita.
Antes de retomar deploy automatizado por migrations, o histórico deve ser
reconciliado separadamente e de forma documentada.

## DEMO e UI

A fixture `processos-demo.json` contém o resultado agregado completo e dez casos
representativos: padrão, fornecedor novo, valor alto, interação tripla,
emergencial, cancelado, desvio proibido e os três tipos de retrabalho. Seu
checksum é `fnv1a64:30f3d639339fbdfa`.

Testes estáticos e de contrato confirmam:

- DEMO e snapshot usam `ResultadoDescoberta`;
- o adapter do browser não contém `insert`, `upsert`, `update` ou `delete`;
- existem sete filtros analíticos independentes;
- onboarding vazio, rota lazy, Sidebar e Minha Rotina estão registrados;
- timeline lê o log original na ordenação canônica;
- a troca de organização invalida o estado anterior antes da nova leitura.

## Lint histórico não corrigido

Os dois ciclos repetiram exatamente os cinco erros anteriores, fora de M1/M2:

1. `approve_pending_action_service`: coluna `pending_actions.updated_at` ausente;
2. `reject_pending_action_service`: coluna `pending_actions.updated_at` ausente;
3. `invite_org_member`: `gen_random_bytes(integer)` não resolvida no search path;
4. `accept_invitation`: `digest(text, unknown)` não resolvida no search path;
5. `recompute_project_kpis`: comparação `text = uuid`.

Eles não afetam as tabelas, políticas, scripts ou consultas de Processos. A
correção deve ser uma migration separada e revisada; nada foi alterado aqui.

## Fechamento

M1, M2 e M2.5 estão concluídos. O histórico remoto continua sem os timestamps
das migrations coladas manualmente; essa dívida operacional deve ser
reconciliada antes de qualquer futuro `db push`, sem `--include-all` ou reparo
automático. Ela não altera o schema, os ACLs ou os gates funcionais validados.
