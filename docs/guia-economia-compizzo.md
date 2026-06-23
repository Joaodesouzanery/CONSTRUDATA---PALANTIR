# Guia — Como medir Economia/Eficiência e testar na Compizzo

Este guia explica **como a plataforma mede economia/eficiência** (módulo "Prova de Valor")
e dá um **passo-a-passo para um primeiro teste na organização Compizzo**.

Referências de código: [src/features/economia/](../src/features/economia/) ·
engine [economiaEngine.ts](../src/features/economia/utils/economiaEngine.ts) ·
store [economiaStore.ts](../src/store/economiaStore.ts) ·
Dossiê PDF [economiaReportExport.ts](../src/features/economia/utils/economiaReportExport.ts) ·
tabelas [0054_economia_roi.sql](../supabase/migrations/0054_economia_roi.sql).

---

## 1. Como a medição funciona (visão geral)

A lógica é **conservadora e auditável** — só conta o que pode ser comprovado:

1. **Baseline ("semana 0")** — você registra os números de partida da empresa/obra:
   PPC (% do planejado cumprido), desvio de material (%), horas gastas em relatórios,
   paralisações por trimestre, nº de trabalhadores, custo/dia por pessoa, orçamento de
   material/mês, mensalidade da plataforma, custo/hora do gestor, custo diário de equipamento.
   É a régua contra a qual o ganho é medido.

2. **Detecção automática de eventos** — ao clicar **"Atualizar eventos"**, a plataforma
   varre **7 módulos** e gera "eventos de economia" com uma estimativa de impacto em R$:
   - **Suprimentos** — desperdício de material evitado (delta de quantidade/preço em 3-way match)
   - **LPS / Planejamento** — restrições removidas, alertas de cronograma
   - **RDO** — paradas de produção, equipamento ocioso
   - **Equipamentos** — ociosidade / manutenção preditiva
   - **EVM (Financeiro)** — desvio de custo (CPI/SPI)
   - **Medição** — divergências e horas de gestão economizadas
   - **Manual** — horas de gestão (baseline × atual)

3. **Validação humana** — cada evento nasce como **"detectado"** (impacto não entra na conta
   ainda). Você revisa, ajusta o R$ se quiser e **valida**. Só eventos **validados** somam.

4. **ROI** — a fórmula é:
   ```
   ROI (%) = (economia validada no período − mensalidade da plataforma) / mensalidade × 100
   Payback = economia validada / mensalidade
   ```
   Indicadores "puros" (PPC, alerta de cronograma) não viram R$ direto, para **evitar dupla contagem**.

5. **Dossiê PDF** — botão "Dossiê PDF" gera um relatório branded (capa, hero com R$/ROI,
   de onde vem a economia, antes/depois, top evidências, metodologia) para diretoria/cliente.

> 🔗 Importante: o coletor de RDO depende dos RDOs salvos. Com o **fix de persistência do RDO
> Compizzo** (feito agora), os eventos de origem RDO na Compizzo passam a ser confiáveis.

---

## 2. Passo-a-passo: primeiro teste na Compizzo

**Pré-requisitos:** estar logado numa conta com acesso à org **Compizzo** (`compizzo-homologacao`,
projeto **Brasal Inc24**) e com papel `engenheiro`/`planejador`/`gerente`/`diretor`/`owner`.

> Hoje as tabelas de economia da Compizzo estão **vazias** (sem baseline/eventos). O teste abaixo
> cria o mínimo para o painel mostrar números reais. Tempo estimado: ~20 min.

### Passo 1 — Criar a baseline
1. Abra o módulo **Economia → aba "Baseline"**.
2. Clique em **Criar baseline** e preencha (valores de exemplo para a Brasal Inc24):
   - Obra: **Brasal Inc24** (ou "Carteira de obras")
   - PPC: `54%` · Desvio material: `8%` · Meta desvio material: `3%`
   - Horas de relatório/semana: `6` · Paralisações/trimestre: `4`
   - Trabalhadores: `80` · Custo/dia por pessoa: `R$ 160`
   - Orçamento material/mês: `R$ 300.000`
   - Mensalidade da plataforma: `R$ 5.000`
   - Custo/hora do gestor: `R$ 120` · Custo diário de equipamento: `R$ 1.200`
3. Salvar.

### Passo 2 — Alimentar 2–3 módulos com dados reais
Para a detecção encontrar economia, registre alguns eventos operacionais. Exemplos mínimos:
- **RDO** (aba Compizzo): crie 1 RDO do dia com **1 parada** (ex.: "falta de material", 2h) e
  **1 equipamento** com baixa utilização. Salve.
- **Suprimentos**: registre 1 pedido/recebimento com **divergência** de preço/quantidade (3-way match).
- *(Opcional)* **Equipamentos**: 1 manutenção com data vencida.

### Passo 3 — Detectar
1. Vá em **Economia → "Prova de valor"**.
2. Clique em **"Atualizar eventos"** e aguarde alguns segundos.
3. Os eventos detectados aparecem na aba **"Eventos"** (status "Detectado", R$ a confirmar).

### Passo 4 — Validar
1. Na aba **"Eventos"**, filtre por status **"Detectado"**.
2. Abra um evento (ex.: "Equipamento ocioso"), ajuste o **impacto em R$** se necessário
   (ex.: `R$ 1.200` = 1 dia × custo diário) e clique em **validar** (✓).

### Passo 5 — Ver o painel e exportar
1. Volte para **"Prova de valor"**: o hero mostra **Economia (R$)**, **ROI%** e **Payback**.
   Com poucos eventos, o ROI pode ser negativo — é esperado num teste inicial pequeno.
2. Use o **filtro de obra** (ex.: "Brasal Inc24") e o **mês** para conferir os recortes.
3. Clique em **"Dossiê PDF"** → abre a versão para impressão → **Imprimir / Salvar como PDF**.

---

## 3. Dicas e cuidados
- **Conservadorismo**: só eventos **validados** entram no ROI; ajuste o R$ para refletir a realidade.
- **Sem dupla contagem**: indicadores sem R$ direto (PPC, alerta de cronograma) ficam fora da soma.
- **Mais dados = números melhores**: quanto mais módulos alimentados (Suprimentos, RDO, Medição, EVM),
  mais completa e crível fica a Prova de Valor.
- **Homologação**: a Compizzo é ambiente de homologação — ideal para esse primeiro teste sem risco.
