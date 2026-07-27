# RDO SABESP

> **Rota(s):** `/app/rdo-sabesp` (redirect de `/rdo-sabesp`) · **Store(s):** `rdoSabespLocalStore` (localStorage) **+ tabela Supabase `rdo_sabesp`** (NÃO usa o `rdoStore` comum) · **Grupo:** acessado a partir do módulo RDO/Histórico

## O que é / problema que resolve

Variante do RDO feita para o padrão do **consórcio SABESP "Se Liga Na Rede"** (obras de rede coletora de esgoto). O RDO da SABESP tem formato próprio, rígido, e chega da frente muitas vezes como **foto/PDF/mensagem de WhatsApp**. Este módulo digitaliza esse fluxo: um **parser por IA** extrai os campos da imagem/PDF/texto, o engenheiro revisa, e ao finalizar o dado vira **medição faturável** e vínculo com o empreiteiro — eliminando a redigitação manual do relatório da concessionária. [código: `src/features/rdo-sabesp/`, `api/parse-rdo-sabesp.ts`]

É uma implementação **separada** do RDO comum: não passa pelo `rdoStore`; usa um store próprio em `localStorage` (`rdoSabespLocalStore.ts`) e grava direto na tabela `rdo_sabesp` via `supabase`. Status é `'draft' | 'finalized'` (vocabulário próprio, diferente do `'rascunho'|'finalizado'` do RDO comum). [código: `rdoSabespUtils.ts:5` — `type RdoSabespStatus = "draft" | "finalized"`]

## Para quem (papéis / persona)

- **Engenheiro/apontador da frente SABESP** — tira foto do RDO ou cola o texto do WhatsApp; a IA preenche.
- **Gerente/medição** — revisa a extração da IA e finaliza (o que dispara a medição).
- Específico do cliente **Consórcio Se Liga Na Rede** e obras de saneamento no padrão SABESP.

## Funcionalidades detalhadas

Núcleo em `src/features/rdo-sabesp/components/RdoSabespForm.tsx`:

- **Formulário RDO SABESP** — campos do padrão da concessionária (cabeçalho da obra/contrato, serviços/quantidades por catálogo, mão de obra, equipamentos, ocorrências), com `status` inicial `"draft"`. [código: `RdoSabespForm.tsx:93`]
- **Parser por IA** — extrai os campos de **foto, PDF ou texto de WhatsApp**. Roda via rota serverless `api/parse-rdo-sabesp.ts` / Edge Function `supabase/functions/parse-rdo-sabesp/index.ts`, chamando **Gemini** (`gemini-2.5-flash`) direto ou o **gateway Lovable** (`ai.gateway.lovable.dev`). O import de WhatsApp tem lib dedicada (`rdoSabespWhatsapp.ts`). [código]
- **Revisão da IA (AI review)** — checkbox `aiReviewConfirmed`: o usuário precisa **confirmar** que revisou a extração antes de finalizar (quando `requiresAiReview`). [código: `RdoSabespForm.tsx:520`, `:1885`]
- **Gate de finalização** (`finalizeRdo`) — o botão "Finalizar" fica desabilitado até: sem campos obrigatórios faltando, **AI review confirmado** (`requiresAiReview && !aiReviewConfirmed`), e **justificativa D2** preenchida se o relatório estiver atrasado (`reviewD2Overdue && !review_delay_justification`). [código: `RdoSabespForm.tsx:1491`, `:1497`, `:2137`]
- **Geração de PDF** — reconstrói o RDO no layout SABESP para impressão/envio (gerador de PDF dedicado). [código]
- **Catálogo de serviços** — serviços/preços do contrato SABESP para preencher quantidades.

## Dados que gera

- **Tabela `rdo_sabesp`** (Supabase, gravada direto — não é o `rdo`), com o payload do relatório, `status` `draft`/`finalized`, `report_date`, `review_delay_justification`, e assets do parser. [schema: migrações `0041_rdo_sabesp.sql`, `0046_rdo_sabesp_parser_assets.sql`]
- **Espelho local** em `localStorage` via `rdoSabespLocalStore.ts` (o Histórico lê tanto o local quanto o Supabase). [código]

## Cálculos, KPIs e regras de negócio

- **Regra de finalização** = (0 campos obrigatórios faltando) ∧ (AI review confirmado, quando exigido) ∧ (justificativa D2 se atrasado). Enquanto não cumprir, permanece `draft` e **não** alimenta a Medição. [código: `RdoSabespForm.tsx:2137`]
- **D2 / atraso** — `reviewD2Overdue` sinaliza RDO revisado fora do prazo, exigindo justificativa registrada (`review_delay_justification`) — rastreabilidade de auditoria. [código]

## Integrações — a "camada única"

- **→ Medição** — ao finalizar (`persist('finalized')`), chama a **RPC de servidor `sync_rdo_sabesp_to_measurement`** (`p_rdo_id`), que deriva a medição faturável a partir do RDO. [código: `RdoSabespForm.tsx:1446`]
- **→ Empreiteiro** — vincula o RDO ao contratante via `contractorStore.linkRdo({ rdo_id, rdo_type: 'sabesp', ... })`, alimentando o módulo de Empreiteiros/Faturas. [código: `RdoSabespForm.tsx:1341`, `:1435`; `contractorStore.ts:411`]
- **Reação a mudanças** — `medicaoUnificadaStore` também recarrega ao ver mudanças de realtime na tabela `rdo_sabesp` (fonte de medição do tipo `rdo_sabesp`). [código: `medicaoUnificadaStore`]
- **Diferença vs RDO comum** — o RDO SABESP **não** dispara `syncExecutionToPlanejamento`, nem `syncRdoToTimecards`, nem a trigger de estoque. Seu alcance cross-módulo é **Medição + contratante**. [código/inferido]

## Eficiência gerada

- **Foto/WhatsApp → medição** — o relatório da concessionária que chegava como imagem vira dado estruturado e **medição faturável** sem redigitar, com o engenheiro só revisando. [inferido, com base no parser IA + RPC de medição]
- **Trava de qualidade** — o gate (AI review + D2) evita finalizar medição em cima de extração não conferida ou relatório atrasado sem justificativa — reduz erro/glosa. [código/inferido]
- **Rastreabilidade** — vínculo direto RDO↔empreiteiro↔medição facilita a prestação de contas ao consórcio/concessionária. [inferido]

## Como sincroniza

Modelo **próprio**: estado em `localStorage` (`rdoSabespLocalStore`) + gravação direta na tabela `rdo_sabesp` via `supabase` (não usa o padrão `pendingSync`/`flushQueue` do `rdoStore`). O parser roda em servidor (rota Vercel `/api` ou Edge Function). Multi-tenant por `organization_id` + RLS na tabela `rdo_sabesp`. [código: `rdoSabespLocalStore.ts`, `RdoSabespForm.tsx`, migrações `rdo_sabesp`]
