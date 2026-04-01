# CONSTRUDATA — Manual de Inserção de Dados

**Versão:** 1.0 · **Data:** Abril 2026  
**Plataforma:** CONSTRUDATA Atlântico · **Ambiente:** Gestão de Obras de Saneamento

---

## Visão Geral

Este documento descreve a **ordem de inserção de dados**, as **rotinas de preenchimento** e a **frequência recomendada** para cada módulo da plataforma CONSTRUDATA. O objetivo é garantir que os dados fluam corretamente pela cadeia de construção — do planejamento macro até o fechamento de obra.

> **Princípio fundamental:** Os dados devem seguir a ordem natural da construção.  
> Planejamento → Contratação → Execução → Medição → Gestão → Análise.

---

## Ordem de Inserção por Importância

### Fase 0 — Configuração Inicial (antes de qualquer obra)

| Prioridade | Módulo | O que inserir |
|-----------|--------|---------------|
| 1 | **Projetos** | Cadastrar cada obra (Morro do Tetéu, Pantanal Baixo, São Manoel, João Carlos, Vila Israel, Vila dos Criadores) com código, gerente, datas e orçamento total |
| 2 | **Pré-Construção** | Importar o edital/contrato em PDF para extração automática de quantitativos; revisar itens extraídos e mapear ao SINAPI/SEINFRA |
| 3 | **Quantitativos** | Confirmar orçamento resultante; ajustar BDI global; salvar orçamento como referência |
| 4 | **Plan. Mestre (Longo Prazo)** | Cadastrar o cronograma macro da obra; definir WBS (entregáveis por obra); salvar Baseline com nome da obra |

---

### Fase 1 — Pré-Execução (semanas antes do início do campo)

| Prioridade | Módulo | O que inserir | Frequência |
|-----------|--------|---------------|-----------|
| 5 | **Plan. Trechos** | Importar trechos do projeto (código, extensão, diâmetro, profundidade, tipo de solo) e configurar equipes com produtividade diária | Única vez por obra |
| 6 | **Mão de Obra** | Cadastrar trabalhadores (nome, matrícula, função, certif. NR-10/NR-35); definir equipes (líder + membros); configurar turnos e postos de trabalho | Antes do início; atualizar conforme contratações |
| 7 | **Suprimentos** | Criar Requisições de Compra para os materiais críticos (tubos, conexões, caixas); acompanhar geração de POs; registrar framework agreements com fornecedores | Semanal ou conforme necessidade |
| 8 | **Gestão Equip.** | Cadastrar ordens de manutenção preventiva para equipamentos (escavadeiras, retroescavadeiras, compressores); vincular ao cronograma de entrada em campo | Antes do início e mensal |
| 9 | **LPS/Lean** | Inserir as atividades do look-ahead (6 semanas à frente); identificar restrições por categoria (material, mão de obra, projeto, equipamento) | Semanal — toda segunda-feira |

---

### Fase 2 — Execução Diária (rotina de campo)

| Prioridade | Módulo | O que inserir | Frequência | Responsável |
|-----------|--------|---------------|-----------|------------|
| 10 | **RDO** | Registrar diariamente: data, local, OS, responsável, clima (manhã/tarde/noite), serviços executados por trecho (metragem), equipe (diretos/indiretos), equipamentos, observações | **Diário** — até 18h | Fiscal / Engenheiro de campo |
| 11 | **Relatório 360** | Mover atividades no kanban (a fazer → em andamento → concluído); registrar fotos; adicionar timecards de equipe; registrar consumo de material e horas de equipamento | **Diário** | Engenheiro residente |
| 12 | **Mão de Obra** | Registrar ponto dos trabalhadores (horas trabalhadas por função por dia); registrar ocorrências de segurança; registrar ausências e substitutos | **Diário** | Técnico de segurança / RH de campo |
| 13 | **Plan. Trechos** | Sincronizar execução: ao fechar o RDO, confirmar se a metragem executada foi importada automaticamente para o planejamento; ajustar produtividade se necessário | **Diário** (automático via pipeline) | Sistema automático |

---

### Fase 3 — Rotinas Semanais

| Ação | Módulo | Detalhes |
|------|--------|---------|
| **Segunda-feira** | **LPS/Lean** | Atualizar PPC da semana anterior; revisar e replanejar look-ahead 6 semanas; limpar restrições resolvidas |
| **Segunda-feira** | **Prog. Semanal** | Preencher Previsto para cada atividade de cada dia da semana corrente |
| **Sexta-feira** | **Prog. Semanal** | Preencher Realizado de cada dia; calcular desvio semanal |
| **Quinta-feira** | **Suprimentos** | Revisar status de POs; registrar recebimento de materiais (nota fiscal → entrada em estoque) |
| **Qualquer dia** | **Torre Controle** | Verificar riscos ativos; atualizar status (identificado → em resolução → resolvido); registrar planos de ação |
| **Quinzenal** | **Gestão Equip.** | Registrar manutenções concluídas; criar novas OMs corretivas conforme necessidade; atualizar custo real |

---

### Fase 4 — Rotinas Mensais

| Ação | Módulo | Detalhes |
|------|--------|---------|
| **Medição mensal** | **Quantitativos** | Registrar quantitativos medidos no mês; comparar com previsto; gerar relatório de avanço físico-financeiro |
| **Atualização de cronograma** | **Plan. Mestre** | Atualizar % de conclusão de cada atividade; revisar tendências (trendStart/trendEnd); salvar nova baseline se houver desvio relevante (>5 dias) |
| **Fechamento de mão de obra** | **Mão de Obra** | Gerar folha de pagamento; validar conformidade CLT (horas extras, descanso); arquivar |
| **Análise de fornecedores** | **Suprimentos** | Rodar relatório de três vias (PO × Recebimento × NF); resolver exceções; atualizar lead times |
| **Relatório gerencial** | **AIP (Assistente)** | Consultar "resumo geral" para obter KPIs consolidados de todos os módulos em uma só resposta |

---

### Fase 5 — Encerramento de Obra

| Prioridade | Módulo | O que inserir |
|-----------|--------|---------------|
| Final-1 | **Plan. Mestre** | Marcar todas as atividades como "concluída" (100%); salvar baseline de encerramento com nome da obra |
| Final-2 | **P6 CPM** | Exportar cronograma final em .xer para arquivo histórico e entrega ao cliente |
| Final-3 | **Quantitativos** | Registrar orçamento final realizado; comparar com baseline inicial; salvar orçamento de encerramento |
| Final-4 | **Projetos** | Atualizar status do projeto para "completed"; registrar lições aprendidas em notas |
| Final-5 | **Documentação** | Exportar RDOs (Excel), Relatório 360 (PDF), Prog. Semanal (Excel) para arquivo físico/digital |

---

## Rotinas Automáticas (AIP Pipeline)

Os seguintes dados são **propagados automaticamente** entre módulos pelo Integration Pipeline — não exigem inserção manual duplicada:

| Gatilho | De | Para | O que acontece |
|---------|-----|------|----------------|
| Novo RDO salvo | RDO | Torre Controle | Incidentes viram riscos automaticamente |
| Novo RDO com metragem | RDO | Rede 360 | Trechos executados marcados como "operacional" |
| Novo RDO com equipe | RDO | Mão de Obra | Timecard diário criado automaticamente |
| Novo RDO com equipe | RDO | Relatório 360 | Registro de equipe no relatório do dia |
| Novo RDO com serviços | RDO | Quantitativos | Itens orçados marcados como "executado no campo" |
| PPC < 60% no LPS | LPS/Lean | Torre Controle | Risco de atraso de produção gerado automaticamente |
| Projeto em "on_hold" | Projetos | Torre Controle | Risco de suspensão gerado automaticamente |
| Atividade "delayed" | Plan. Mestre | Torre Controle | Risco de atraso no cronograma gerado automaticamente |
| Nova atividade macro | Plan. Mestre | LPS/Lean | Atividade inserida no look-ahead das próximas 6 semanas |

---

## Resumo por Módulo — Quem Insere e Quando

| Módulo | Responsável | Quando | Dados Críticos |
|--------|------------|--------|---------------|
| **Projetos** | Gerente de contratos | Antes da obra | Código, orçamento, datas |
| **Pré-Construção** | Coordenador de planejamento | Antes da obra | PDF do edital/projeto |
| **Quantitativos** | Orçamentista | Antes da obra + mensal | Itens, quantidades, preços SINAPI |
| **Plan. Mestre** | Coordenador de planejamento | Antes + mensal | WBS, datas, % avanço, baseline |
| **Plan. Trechos** | Coordenador de planejamento | Antes da obra | Trechos, equipes, produtividade |
| **Mão de Obra** | RH de campo / Técnico | Antes + diário | Trabalhadores, ponto, ocorrências |
| **Suprimentos** | Comprador / Almoxarife | Semanal | Requisições, POs, recebimentos, estoque |
| **Gestão Equip.** | Mecânico / Encarregado | Mensal + avulso | OMs preventivas e corretivas |
| **LPS/Lean** | Engenheiro de produção | **Semanal** | Look-ahead, restrições, PPC |
| **RDO** | Fiscal / Engenheiro campo | **Diário** | Serviços, equipe, clima |
| **Relatório 360** | Engenheiro residente | **Diário** | Kanban, fotos, timecards |
| **Prog. Semanal** | Encarregado / Engenheiro | **Semanal** | Previsto seg/ter/qua/qui/sex, realizado |
| **Torre Controle** | Gerente de obra | Semanal | Status de riscos, planos de ação |
| **AIP** | Qualquer usuário | Sob demanda | Consulta por linguagem natural |

---

## Notas Importantes

1. **Nunca pule o RDO diário.** É o documento de lastro legal de toda a execução. Lacunas no RDO invalidam medições.
2. **Baseline deve ser salva antes de qualquer alteração relevante** no cronograma. Uma baseline salva = comparação histórica preservada.
3. **O LPS semanal é a engrenagem do sistema.** Sem o look-ahead atualizado, os pipelines de suprimentos e mão de obra ficam cegos.
4. **Fotos são obrigatórias** no Relatório 360 para trechos com interferência, afundamento ou serviço não padrão. Servem de evidência em contestações.
5. **O AIP (Assistente)** pode ser consultado a qualquer momento para obter um resumo de todos os KPIs sem precisar navegar módulo a módulo.

---

*CONSTRUDATA Atlântico · Gestão Inteligente de Obras de Saneamento*
