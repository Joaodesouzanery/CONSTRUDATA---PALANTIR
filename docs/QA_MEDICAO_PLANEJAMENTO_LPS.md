# QA - Medição, Planejamento, LPS e Dados em Tempo Real

## Objetivo

Transformar o ConstruData na fonte oficial das medições de fornecedores, subempreiteiros e planejamento operacional. As planilhas continuam importantes como entrada, conferência e exportação, mas a medição deve nascer dentro da plataforma como rascunho conferível, com origem, pendências e aprovação humana antes do fechamento.

Prioridade escolhida: **dados + exportação XLSX compatível**. O sistema não precisa recriar o layout visual das planilhas célula a célula, mas precisa preservar abas principais, totais, memória, origem e rastreabilidade.

## Chave Operacional Comum

Todos os módulos devem conseguir conversar usando a mesma chave:

`contrato + núcleo + rua/local + serviço/N. Preço + período`

Essa chave conecta RDO, RDO Sabesp, Qualidade, Medição, Subempreiteiros, Fornecedores, Suprimentos, Planejamento, LPS/lookahead e Torre de Controle. Rua do cronograma ou da memória é sempre `local` dentro de `núcleo`, nunca um núcleo separado.

## Eventos Entre Módulos

| Evento | Origem | Destino esperado | Resultado |
| --- | --- | --- | --- |
| `rdo.finalized` | RDO/RDO Sabesp | Medição, Planejamento, LPS | Gera rascunho de medição e atualiza avanço realizado quando houver chave operacional suficiente |
| `quality.blocked` | Qualidade/FVS | Medição, LPS | Bloqueia rascunho e cria restrição operacional |
| `quality.released` | Qualidade/FVS | Medição, LPS | Libera pendência de qualidade |
| `supply.receipt_approved` | Suprimentos | Medição, LPS | Alimenta evidência de recebimento/material quando houver vínculo explícito |
| `supply.invoice_approved` | Suprimentos | Medição/Financeiro | Alimenta NF, valor, competência e pendências financeiras |
| `measurement.draft_created` | Medição | Torre de Controle, Planejamento | Mostra produção em conferência, ainda sem alterar baseline |
| `measurement.blocked` | Medição | Torre de Controle, LPS | Expõe bloqueios por falta de preço, vínculo, evidência, NF ou qualidade |
| `measurement.approved` | Medição | Planejamento, LPS, Torre de Controle | Atualiza avanço físico/financeiro e tendência sem alterar baseline oficial |
| `planning.activity_imported` | Planejamento/MPP | RDO, Medição, LPS | Disponibiliza WBS, núcleo, rua/local, serviço, datas e recursos |
| `lps.commitment_updated` | LPS | Planejamento, Torre de Controle | Atualiza compromisso semanal, PPC e restrições |

## Matriz de Dados

| Origem | Abas/campos | Módulo de destino | Campo interno | Status | Aceite |
| --- | --- | --- | --- | --- | --- |
| Fornecedor COMPASS/CALMAQ/APJSERV/ANDRAUS | `Resumo`, boletim, `MC/mc` | Medição unificada + Fornecedores | fornecedor, empreiteiro, núcleo, período, item, descrição, unidade, quantidade, preço unitário, valor mensal, total, arquivo, aba, linha | Parcial | Totais do resumo batem com boletim/memória e pendências aparecem antes do fechamento |
| Subempreiteiro CHIRA/CONSTR. SUL/RK/THL/VF/VIALTA | `RESUMO_FECHAMENTO`, `Resumo Geral/RESUMO`, `PARAMETROS`, `MEDICAO`, `MEMORIA`, `ITENS RETENÇÃO`, `NFS`, `DESCONTOS` | Medição unificada + Subempreiteiros | período, contrato, empreiteiro, núcleo, N. Preço, item, unidade, quantidade, preço, retenção, NF, descontos, total medido, total aprovado | Parcial | Totais de fechamento, medição aprovada, descontos, retenção e NFs batem por competência |
| Memória de subempreiteiro | `MEMORIA`, `ESGOTO`, `ÁGUA`, `MEMORIA S.M`, `MEMORIA J.C` | Memória de medição | rua/local, número, data, trecho inicial/final, PV/PI/estaca, total, croqui, NS, evidência | Parcial | Cada linha de memória aponta serviço/N. Preço, núcleo e rua sem transformar rua em núcleo |
| Custos operacionais | `RH`, `AGREGADOS`, `MATERIAIS`, `MAQUINAS`, `SERVIÇOS`, `VEICULOS`, `COMBUSTIVEL`, `LOC. EQUIPAMENTOS`, `EPI` | Financeiro da medição | entry_type, descrição, quantidade, valor, competência, fornecedor, NF, status | Parcial | Entradas aprovadas viram desconto/custo no fechamento do subempreiteiro |
| RDO Sabesp | Serviço executado, empreiteiro, núcleo, rua, quantidade, evidência, qualidade | Fontes + memória | `source_kind = rdo_sabesp`, contractor_id, núcleo, rua/local, serviço/N. Preço, quantidade, evidência | Parcial | Gera rascunho revisável; bloqueia se faltar vínculo, preço, evidência ou qualidade |
| Suprimentos | Pedido, recebimento, NF, material, locação, serviço | Fontes financeiras | `source_kind = suprimentos`, entry_type, valor, NF, evidência | Parcial | Só mede fornecedor automaticamente quando houver regra explícita de vínculo |
| Cronograma MPP | WBS, datas, predecessoras, recursos, caminho crítico, folga, progresso | Planejamento Mestre/LPS | wbsCode, plannedStart, plannedEnd, predecessors, resources, criticalPath, totalSlack, núcleo, local | Parcial | Com `MPXJ_CONVERTER_URL`, importa fielmente; sem MPXJ, apenas prévia |
| Medição aprovada | Memória aprovada e fechamento | Planejamento/LPS | avanço físico, avanço financeiro, tendência, restrições | Parcial | Atualiza tendência e alertas sem alterar baseline oficial automaticamente |

## Gaps de Implementação

1. **Promover importações para a medição unificada**  
   Cada linha válida deve virar `measurement_sources`, `measurement_memory_lines` e `measurement_financial_entries`, mantendo arquivo, aba, linha, confiança, avisos e bloqueios.

2. **Validar planilhas por totais reais**  
   Criar testes de importação para as planilhas anexadas e comparar medição aprovada, descontos, retenções, NFs e total de memória.

3. **Padronizar a chave operacional em todos os módulos**  
   A mesma chave deve aparecer nos painéis de conferência, no RDO, no cronograma, no LPS e na Torre de Controle.

4. **Cobrir fornecedores via Suprimentos com vínculo explícito**  
   Fornecedor não deve ser medido automaticamente apenas porque apareceu em RDO. É necessário vínculo entre contrato, fornecedor, serviço, núcleo/local e regra de medição.

5. **Importar MPP fiel somente com MPXJ**  
   O fallback textual não deve ser tratado como cronograma confiável. Ele serve apenas para prévia e identificação inicial de núcleos/ruas.

6. **Exportar XLSX compatível**  
   Exportar abas principais: `Resumo Geral`, `RESUMO_FECHAMENTO`, `PARAMETROS`, `MEDICAO`, `MEMORIA`, `NFS`, `DESCONTOS` e abas operacionais relevantes.

## Critérios de QA

- A landing deve manter a estrutura original, mas com fundo da plataforma, contraste alto, português correto e seções reorganizadas.
- Nenhum H1, CTA, card, FAQ ou tabela da landing pode estourar a largura no mobile.
- Toda importação de planilha deve exibir arquivo, aba, linha, confiança e pendências.
- Rascunhos com pendência bloqueante não podem virar fechamento automático.
- RDO finalizado sem N. Preço, preço unitário, empreiteiro, núcleo/local ou evidência deve gerar alerta claro.
- Medição aprovada pode alimentar avanço e tendência do planejamento, mas não muda baseline sem ação humana.
- Supabase Realtime deve atualizar os módulos dependentes sem recarregar a página quando RDO, Qualidade, Suprimentos, Medição, Planejamento ou LPS mudarem.
