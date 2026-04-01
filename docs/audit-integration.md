# CONSTRUDATA — Auditoria de Módulos e Integração de Dados

> Versão: 2026-04-01 | Branch: claude/security-review-UWFy4

---

## Visão Geral da Plataforma

A plataforma CONSTRUDATA é uma SPA React/TypeScript que gerencia obras de construção e saneamento. Toda a persistência de estado é feita via Zustand com `persist` middleware (LocalStorage). Não há backend — todos os dados são cliente-side.

---

## Arquitetura de Dados

```
┌─────────────────────────────────────────────┐
│              Zustand Stores                  │
│  rdoStore · relatorio360Store · gestao360    │
│  projetosStore · lpsStore · suprimentos      │
│  maoDeObraStore · equipamentosStore · ...    │
└────────────────┬────────────────────────────┘
                 │ useStore() hooks
                 ▼
┌─────────────────────────────────────────────┐
│         React Components (TSX)              │
│  Features: /features/*                      │
│  Shared: /components/shared/*               │
└─────────────────────────────────────────────┘
```

---

## Módulos — Status e Integrações

### 1. Dashboard (Gestão 360)
- **Store**: `gestao360Store.ts`, `projetosStore.ts`
- **Status**: Funcional — KPI cards, lista de projetos, progresso
- **Integração**: Lê RDOs via `rdoStore` para métricas de campo
- **Gaps**: Sem integração com módulo Medição; budget baseado em mock data

### 2. RDO (Relatório Diário de Obras)
- **Store**: `rdoStore.ts`
- **Status**: Funcional — CRUD completo, parse de texto, exportação PDF, multi-logo
- **Campos**: 28 campos por RDO incluindo Local, OS, Contrato, Gerente, Técnico Seg., Empreiteira, Serviço, Ocorrências, Func. Diretos/Indiretos, Qtd. Equip., Clima Manhã/Tarde/Noite, geolocalização, fotos
- **Parse de texto**: `parseRdoText.ts` — extração automática de 14+ campos via key-value
- **Exportação PDF**: `rdoPdfExport.ts` — tabela de identificação na capa
- **Gaps**: Fotos armazenadas como base64 in-memory (sem persistência entre sessões)

### 3. Relatório 360
- **Store**: `relatorio360Store.ts`
- **Status**: Funcional — Kanban de atividades, timecards, equipamentos, materiais
- **Integração**: Isolado; poderia receber trechos do RDO automaticamente
- **Gaps**: PPC calculado localmente; não integra com planejamento mestre

### 4. Torre de Controle
- **Store**: `torreDeControleStore.ts`
- **Status**: Funcional — alertas, riscos, KPIs consolidados
- **Integração**: Lê de múltiplos stores via `useAlertCounts`
- **Gaps**: Alertas são estáticos (baseados em thresholds fixos)

### 5. Planejamento Mestre
- **Store**: `planejamentoMestreStore.ts`
- **Status**: Funcional — Gantt, fases, dependências
- **Integração**: Exporta trechos para `rdoStore` via `loadTrechosFromPlanejamento`
- **Gaps**: Sem sincronismo de volta (execução RDO → planejamento não atualiza automaticamente)

### 6. LPS / Lean
- **Store**: `lpsStore.ts`
- **Status**: Funcional — Look-ahead 6 semanas, PPC semanal, restrições
- **Integração**: Independente; PPC não integra com Relatório 360
- **Gaps**: PPC duplicado (LPS e Relatório 360 calculam separadamente)

### 7. Mão de Obra
- **Store**: `maoDeObraStore.ts`
- **Status**: Funcional — timecards, controle de presença, categorias
- **Integração**: Isolado; manpower do RDO não sincroniza com este módulo
- **Gaps**: Sem cálculo de custo de mão de obra

### 8. Gestão de Equipamentos
- **Store**: `gestaoEquipamentosStore.ts` + `equipamentosStore.ts`
- **Status**: Funcional — cadastro, alocação, histórico de uso
- **Integração**: Dados de equipamento do RDO não sincronizam automaticamente
- **Gaps**: Sem cálculo de custo/hora por equipamento

### 9. Quantitativos
- **Store**: `quantitativosStore.ts`
- **Status**: Funcional — itens SINAPI, BDI, totais
- **Integração**: Independente dos RDOs; quantidades executadas no campo não atualizam planilha
- **Gaps**: Gap crítico de integração: RDO.services → Quantitativos

### 10. Suprimentos
- **Store**: `suprimentosStore.ts`
- **Status**: Funcional — solicitações, ordens de compra, estoque
- **Integração**: Independente
- **Gaps**: Materiais usados no RDO não geram solicitação automática de reposição

### 11. Mapa Interativo
- **Store**: `mapaInterativoStore.ts`
- **Status**: Funcional — Leaflet, layers, nós de rede
- **Integração**: RDO com geolocalização poderia marcar ponto no mapa
- **Gaps**: Pins de RDO no mapa não implementados

### 12. Rede 360
- **Store**: `rede360Store.ts`
- **Status**: Funcional — grid de trechos, status, comprimentos
- **Integração**: Trechos do RDO (`trechos`) deveriam atualizar status da Rede 360
- **Gaps**: Sincronismo RDO.trechos → Rede360 não implementado

### 13. BIM 3D/4D/5D
- **Store**: `bimStore.ts`
- **Status**: Funcional — viewer Three.js, timeline 4D, quantitativos 5D
- **Integração**: Independente
- **Gaps**: Sem link com progresso real de campo

### 14. Pré-Construção
- **Store**: `preConstrucaoStore.ts`
- **Status**: Funcional — checklists, licenças, projetos executivos
- **Integração**: Independente
- **Gaps**: Status de licenças não bloqueia início de obras

### 15. Frota de Veículos
- **Store**: `otimizacaoFrotaStore.ts` + `frotaVeicularStore.ts`
- **Status**: Funcional — alocação de veículos, rotas, manutenção
- **Integração**: Independente

### 16. AIP (Artificial Intelligence Platform)
- **Store**: `src/features/aip/store/aipStore.ts`
- **Status**: Novo (Sprint atual) — chat funcional, digest de dados, integração Claude API
- **Integração**: Lê `rdoStore`, `relatorio360Store`, `projetosStore`
- **Configuração**: Requer `VITE_ANTHROPIC_API_KEY` no `.env`

---

## Fluxos de Dados Críticos (Não Implementados)

| Origem | Destino | Dado | Impacto |
|--------|---------|------|---------|
| RDO.services | Quantitativos | Quantidades executadas | Alto |
| RDO.trechos | Rede 360 | Status de execução | Alto |
| RDO.manpower | Mão de Obra | Presença diária | Médio |
| RDO.equipment | Gestão Equipamentos | Horas utilizadas | Médio |
| Planejamento | RDO | Trechos planejados | Médio (parcial) |
| RDO.geolocation | Mapa | Pin de registro | Baixo |

---

## Modelo de Dados Principal

### RDO (interface `RDO` em `src/types/index.ts`)
```typescript
{
  id, number, date, responsible,
  weather: { morning, afternoon, night },
  manpower: { foremanCount, officialCount, helperCount, operatorCount },
  equipment: RdoEquipmentEntry[],
  services: RdoServiceEntry[],
  trechos: RdoTrechoEntry[],
  geolocation: { lat, lng } | null,
  observations, incidents,
  photos: RdoPhoto[],
  logoId?: string,
  // Identificação
  local, gerenteContrato, tecnicoSeguranca, nomeEmpreiteira,
  servicoExecutar, ocorrencias,
  funcionariosDiretos, funcionariosIndiretos, qtdEquipamentosFerramentas,
  numeroOS, numeroContrato,
  climaManha, climaTarde, climaNoite,
  createdAt, updatedAt
}
```

---

## Recomendações Prioritárias

1. **Backend / persistência remota**: Atualmente tudo em LocalStorage. Para uso em produção, implementar Supabase ou Firebase para persistência e sync multi-dispositivo.

2. **Sincronismo RDO → Quantitativos**: Criar uma função `syncRdoToQuantitativos(rdoId)` que mapeia `RDO.services[]` para linhas da planilha quantitativos.

3. **Sincronismo RDO → Rede 360**: `RdoTrechoEntry` já tem `executedMeters` e `status` — criar listener que atualiza `rede360Store` ao salvar um RDO.

4. **PPC unificado**: Criar um hook `usePPCGlobal()` que agrega dados do LPS e Relatório 360 para um único indicador de desempenho.

5. **Upload de fotos na nuvem**: Fotos do RDO em base64 são voláteis. Integrar com Supabase Storage ou similar.
