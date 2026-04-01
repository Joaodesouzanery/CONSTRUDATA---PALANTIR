# AIP — Artificial Intelligence Platform

> Conceito, arquitetura e roadmap para o assistente de dados da plataforma CONSTRUDATA

---

## O que é o AIP?

Inspirado no [Palantir AIP](https://www.palantir.com/platforms/aip/), o AIP da CONSTRUDATA é um assistente de inteligência artificial embutido na plataforma que:

- **Lê os dados reais** de todos os módulos (RDOs, projetos, planejamento, relatórios)
- **Responde em linguagem natural** perguntas sobre o estado das obras
- **Analisa tendências** e identifica riscos com base nos dados registrados
- **Sugere ações** contextualizadas ao histórico da obra

---

## Arquitetura Atual (Sprint 7)

```
┌────────────────────────────────────────────────────────┐
│                    AIP Feature                         │
│                                                        │
│  src/features/aip/                                     │
│  ├── AipPage.tsx           # Página /app/aip           │
│  ├── index.ts                                          │
│  ├── components/                                       │
│  │   └── AipPanel.tsx      # Floating chat panel       │
│  ├── store/                                            │
│  │   └── aipStore.ts       # Zustand: msgs, open state │
│  └── hooks/                                            │
│      └── useAipDataDigest.ts # Data digest builder     │
└────────────────────────────────────────────────────────┘
```

### Fluxo de uma conversa

```
User types message
       │
       ▼
useAipDataDigest() ──► reads rdoStore, relatorio360Store, projetosStore
       │
       ▼
System prompt = "Você é AIP..." + data digest (texto estruturado)
       │
       ▼
Claude API (claude-haiku-4-5-20251001) ──► streaming response
       │
       ▼
addMessage('assistant', reply) ──► aipStore persists to localStorage
```

---

## Configuração

### 1. Obter chave de API
- Acesse [console.anthropic.com](https://console.anthropic.com)
- Crie uma chave de API no projeto desejado

### 2. Adicionar ao .env
```env
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 3. Reiniciar o servidor
```bash
npm run dev
```

> ⚠️ **Segurança**: A chave fica exposta no bundle do cliente. Para uso em produção, implemente um proxy de backend (ex: Supabase Edge Functions) que faça as chamadas à API Claude.

---

## Data Digest — Dados Injetados no Contexto

O hook `useAipDataDigest` monta um texto estruturado com:

| Categoria | Dados |
|-----------|-------|
| RDOs | Total, últimos 3: data, responsável, local, OS, serviços, clima |
| Relatório 360 | Total de dias, último dia: atividades done/total |
| Projetos | Total, top 5: código, nome, status, datas, gerente |

---

## Exemplos de Perguntas

```
"Quantos RDOs foram registrados este mês?"
"Qual o status dos projetos ativos?"
"O RDO mais recente registrou chuva?"
"Quantas atividades foram concluídas no último relatório 360?"
"Qual projeto tem mais risco?"
"Resuma o que aconteceu nos últimos 3 dias de obra."
```

---

## Roadmap — Evolução do AIP

### Fase 2 — Integração completa
- Adicionar todos os stores ao digest (LPS PPC, quantitativos, mão de obra, equipamentos)
- Suporte a upload de fotos de campo para análise visual
- Alertas proativos: AIP notifica quando detecta anomalia (ex: PPC abaixo de 60%)

### Fase 3 — Ações via linguagem natural
- "Crie um RDO para hoje com as seguintes informações..."
- "Marque a atividade T-03 como concluída no relatório de hoje"
- "Gere o relatório PDF do RDO #47"

### Fase 4 — Backend e multiusuário
- Proxy seguro via Supabase Edge Function (API key no servidor)
- Histórico de conversas por usuário no banco de dados
- Compartilhamento de análises entre equipes

### Fase 5 — Modelos especializados
- Fine-tuning em terminologia de construção e saneamento
- Integração com normas técnicas ABNT, SINAPI, FUNASA
- Análise de imagens de campo (fotos de RDO → detecção de não-conformidades)

---

## Componente Técnico — AipPanel

O painel é renderizado como overlay no `AppShell`, sempre disponível em qualquer rota:

```tsx
// AppShell.tsx
<AipPanel />  // Floating button + slide-in panel, z-50
```

### Props/Estado
```typescript
{
  isOpen: boolean       // Controlado pelo aipStore
  messages: AipMessage[] // Persistidos em localStorage
  isLoading: boolean    // Durante chamada à API
}
```

### UX
- Botão flutuante no canto inferior direito
- Painel desliza da direita (400px largura, altura total)
- Sugestões de perguntas na tela vazia
- Enter para enviar, Shift+Enter para nova linha
- Auto-scroll ao receber resposta
- Histórico persiste entre sessões

---

## Integração com Palantir AIP Philosophy

O AIP da CONSTRUDATA segue os mesmos princípios do Palantir AIP:

1. **Data-grounded**: Toda resposta é baseada em dados reais da plataforma, não em suposições genéricas
2. **Ontology-aware**: O sistema entende o domínio (obras, trechos, contratos, PPC, medições)
3. **Action-oriented**: O objetivo é gerar decisões, não apenas informações
4. **Human-in-the-loop**: O AI sugere, o engenheiro decide e confirma
