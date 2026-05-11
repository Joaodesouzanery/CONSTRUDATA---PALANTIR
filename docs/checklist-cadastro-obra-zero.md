# Checklist para Cadastrar uma Obra do Zero no ConstruData

> Objetivo: listar exatamente o que o cliente precisa enviar para uma nova obra entrar no ConstruData com planejamento, orçamento, campo, medição, suprimentos, qualidade, LPS/Lean, BIM e torre de controle conversando entre si.

## Visão Geral

Para cadastrar uma obra do zero, o cliente não precisa mandar tudo perfeito. Ele precisa mandar o que já existe hoje, mesmo que esteja em Excel, PDF, MPP, DWG, IFC, pasta de fotos ou planilha própria.

O trabalho de onboarding é transformar esses arquivos em uma base operacional comum:

`contrato/projeto + núcleo/frente + rua/local + serviço/item + período`

Essa chave permite que RDO, Medição, Planejamento, LPS, Qualidade, Suprimentos, BIM, EVM e Torre de Controle falem a mesma língua.

## 1. Checklist Essencial para Começar

Sem estes itens, a obra até pode ser demonstrada, mas não fica operacional com confiança.

| Prioridade | O que enviar | Formatos aceitos | Para que serve |
| --- | --- | --- | --- |
| Obrigatório | Dados da empresa | PDF, DOCX, XLSX ou texto | Razão social, CNPJ, endereço, responsável técnico, CREA/CAU, contatos oficiais |
| Obrigatório | Lista de usuários | XLSX, CSV ou texto | Criar acessos, perfis e permissões |
| Obrigatório | Dados da obra | XLSX, PDF ou texto | Nome, código, endereço, contrato, cliente final, status, datas, responsáveis |
| Obrigatório | Contrato principal | PDF | Prazos, escopo, obrigações, marcos, medições e regras contratuais |
| Obrigatório | Orçamento/base contratual | XLSX, CSV ou PDF | Itens, unidades, quantidades, preços, BDI, composições e N. Preço |
| Obrigatório | Planejamento existente | MPP, XER, XLSX ou PDF | WBS, datas, predecessoras, recursos, marcos e baseline |
| Obrigatório | Frentes, núcleos, ruas ou locais | XLSX, CSV, KML, DWG, PDF ou mapa | Criar a estrutura espacial e operacional da obra |
| Obrigatório | Fornecedores e subempreiteiros | XLSX, CSV ou contratos PDF | Vincular execução, compras, medições, notas e pagamentos |
| Obrigatório | Modelo de RDO atual | PDF, XLSX, DOCX ou imagem | Entender como o campo registra produção, equipe, material e equipamento |

## 2. Checklist Recomendado por Módulo

### Torre de Controle e Gestão 360

Enviar:

- Lista de obras ou frentes da empresa.
- Código interno da obra.
- Endereço completo e coordenadas, se existirem.
- Cliente final e contrato associado.
- Gerente, engenheiro residente, fiscal e responsáveis por área.
- Status atual: planejamento, em execução, paralisada, concluída.
- Orçamento total, valor contratado, aditivos e saldo.
- Principais riscos conhecidos.
- Relatórios gerenciais existentes.

Resultado esperado:

- Obra aparece na Torre de Controle.
- KPIs iniciais são criados.
- Diretoria consegue navegar da visão geral até frente, local, serviço e pendência.

### Orçamento, Quantitativos e EVM

Enviar:

- Planilha de orçamento contratual.
- Planilha de orçamento interno, se for diferente da contratual.
- Composições SINAPI, SEINFRA, próprias ou de referência.
- BDI, encargos, impostos, administração local e indiretos.
- Curva ABC, se existir.
- Centros de custo.
- Itens com unidade, quantidade, preço unitário e valor total.
- N. Preço ou código contratual usado para medição.

Formatos:

- XLSX preferencial.
- CSV aceito.
- PDF aceito para leitura e estruturação inicial.

Resultado esperado:

- Itens viram base de custo, medição, EVM e planejamento físico-financeiro.
- A plataforma consegue comparar previsto, realizado, medido, faturado e tendência.

### Planejamento Mestre e Planejamento Operacional

Enviar:

- Cronograma MS Project `.mpp`, Primavera `.xer`, Excel ou PDF.
- Baseline oficial, se existir.
- Datas de início e fim.
- Marcos contratuais.
- WBS.
- Predecessoras e sucessoras.
- Duração das atividades.
- Recursos associados.
- Calendário de trabalho.
- Restrições de execução.
- Frentes, núcleos, ruas, trechos ou setores.

Observação importante:

- Para importar `.mpp` com fidelidade total, o ambiente precisa do conversor MPXJ configurado.
- Sem conversor, o arquivo pode ser usado como prévia e base de leitura, mas não deve ser tratado como cronograma definitivo.

Resultado esperado:

- Planejamento vira baseline operacional.
- RDO e Medição conseguem alimentar avanço real.
- LPS consegue montar look-ahead e plano semanal.

### LPS / Lean Construction

Enviar:

- Planejamento de médio prazo, se existir.
- Look-ahead atual.
- Plano semanal.
- Restrições abertas.
- Responsáveis por restrição.
- Causas de não cumprimento usadas pela empresa.
- Reuniões semanais anteriores, se houver atas.
- Produtividades esperadas por frente ou equipe.

Resultado esperado:

- A plataforma cria rotina de planejamento puxado.
- Restrições passam a conversar com suprimentos, qualidade, mão de obra, equipamentos e planejamento.
- PPC e causas de não cumprimento deixam de ser planilha isolada.

### RDO e Campo

Enviar:

- Modelo de RDO atual.
- RDOs dos últimos 15 a 30 dias, se existirem.
- Lista de campos obrigatórios no RDO.
- Serviços executados que costumam aparecer no campo.
- Relação entre serviço, N. Preço, rua/local e empreiteiro.
- Fotos de campo com data e local, se existirem.
- Assinaturas exigidas.
- Ocorrências típicas.
- Controle de clima, jornada e equipes.

Resultado esperado:

- RDO nasce estruturado.
- Produção diária vira fonte para medição.
- Fotos e evidências ficam ligadas ao serviço e ao local.

### Medição, Subempreiteiros e Fornecedores

Enviar:

- Boletins de medição anteriores.
- Planilhas de subempreiteiros.
- Planilhas de fornecedores.
- Memórias de cálculo.
- Resumo de fechamento.
- Notas fiscais.
- Descontos.
- Retenções.
- Critérios de medição.
- Contratos de subempreiteiros e fornecedores.
- Regras de pagamento.
- Competência/período de medição.

Campos importantes:

- Empreiteiro ou fornecedor.
- Contrato.
- Núcleo ou frente.
- Rua/local.
- Serviço.
- N. Preço.
- Unidade.
- Quantidade.
- Preço unitário.
- Valor medido.
- Valor aprovado.
- Desconto.
- Retenção.
- NF.

Resultado esperado:

- Importações viram rascunhos de medição com origem.
- Pendências críticas bloqueiam fechamento.
- Aprovação humana continua obrigatória.

### Suprimentos

Enviar:

- Lista de fornecedores.
- CNPJs e contatos.
- Condições de pagamento.
- Catálogo de materiais.
- Pedidos de compra.
- Requisições.
- Recebimentos.
- Notas fiscais.
- Estoque atual.
- Materiais críticos.
- Lead time por fornecedor.
- Regras para vincular fornecedor a contrato, item, serviço ou local.

Resultado esperado:

- Suprimentos alimenta medição de fornecedor apenas quando houver vínculo explícito.
- LPS recebe alertas de restrição de material.
- EVM recebe custo comprometido, recebido e faturado.

### Qualidade / FVS

Enviar:

- Modelos de FVS.
- Checklists por serviço.
- Não conformidades abertas.
- Evidências fotográficas.
- Responsáveis por inspeção.
- Critérios de aceite.
- Histórico de inspeções, se existir.

Resultado esperado:

- Qualidade libera ou bloqueia avanço e medição.
- Não conformidades viram restrições no LPS.
- Evidências ficam ligadas ao serviço, local e período.

### BIM, Projetos e Mapa

Enviar:

- Projetos executivos em PDF.
- DWG, DXF, IFC, RVT ou modelos equivalentes.
- KML/KMZ, shapefile ou planilha com coordenadas.
- Croquis.
- Plantas por disciplina.
- Lista de revisões de projeto.
- Trechos, redes, PVs, estacas, nós, ligações, ruas e interferências.

Resultado esperado:

- A obra ganha referência visual e espacial.
- Planejamento 4D/5D e mapa passam a conversar com avanço e custo.
- Campo consegue apontar execução por local real.

### Equipamentos, Frota e Mão de Obra

Enviar:

- Lista de colaboradores.
- Função, equipe, matrícula, tipo de contrato e custo/hora.
- Certificações e vencimentos.
- Lista de equipamentos próprios e alugados.
- Placa, modelo, tipo, custo/hora ou custo mensal.
- Manutenções programadas.
- Controle de combustível, se existir.
- Alocação atual por frente.

Resultado esperado:

- RDO registra equipe e equipamento com custo e disponibilidade.
- LPS consegue identificar restrição de recurso.
- EVM calcula custo real com mais precisão.

## 3. Formatos Aceitos

| Tipo | Formatos preferenciais | Observações |
| --- | --- | --- |
| Planilhas | XLSX, XLS, CSV | Melhor formato para orçamento, medição, fornecedores, mão de obra e equipamentos |
| Cronograma | MPP, XER, XLSX, PDF | MPP exige conversor configurado para fidelidade total |
| Documentos | PDF, DOCX | Contratos, critérios, atas e procedimentos |
| Projetos | PDF, DWG, DXF, IFC, RVT | Usados em BIM, mapa e documentação técnica |
| Imagens | JPG, PNG, HEIC | Fotos de campo e evidências |
| Geodados | KML, KMZ, SHP, CSV com coordenadas | Usados no mapa e nas frentes físicas |

## 4. Modelo de Pasta Drive ou OneDrive

Crie uma pasta com o nome da obra e esta estrutura:

```text
00_ADMINISTRATIVO/
01_CONTRATOS/
02_ORCAMENTO_E_QUANTITATIVOS/
03_PLANEJAMENTO/
04_FRENTES_NUCLEOS_RUAS_LOCAIS/
05_RDO_CAMPO/
06_MEDICAO/
07_SUPRIMENTOS/
08_QUALIDADE_FVS/
09_BIM_PROJETOS_MAPA/
10_MAO_DE_OBRA_E_EQUIPAMENTOS/
11_FOTOS_E_EVIDENCIAS/
12_RELATORIOS_EXISTENTES/
99_DUVIDAS_E_PENDENCIAS/
```

Regra simples:

- Não renomear arquivos antes de enviar.
- Não apagar abas.
- Não transformar tudo em PDF se existir Excel.
- Manter versões antigas quando houver dúvida.
- Colocar uma observação em `99_DUVIDAS_E_PENDENCIAS` para qualquer arquivo incompleto.

## 5. Mensagem para Pedir os Arquivos ao Cliente

Assunto: Documentos para cadastrar a obra no ConstruData

Olá, [Nome].

Para cadastrarmos a obra no ConstruData, você pode enviar os arquivos que já existem hoje, sem precisar padronizar antes.

O ideal é subir tudo nesta pasta: [link da pasta]

Prioridade para começarmos:

1. Dados da obra e responsáveis.
2. Contrato principal.
3. Orçamento ou planilha contratual.
4. Cronograma atual, preferencialmente MPP, XER ou Excel.
5. Frentes, núcleos, ruas, locais ou trechos.
6. Lista de fornecedores e subempreiteiros.
7. Modelo de RDO atual.
8. Medições anteriores, se existirem.
9. Projetos, BIM, mapa ou croquis.
10. Lista de mão de obra, equipamentos e materiais críticos.

Pode mandar no formato atual. A organização e padronização ficam por nossa conta.

Quanto mais completo estiver esse pacote, mais rápido conseguimos deixar RDO, Medição, Planejamento, LPS, Suprimentos, Qualidade e Torre de Controle conversando entre si.

Abraço,  
[Seu nome]

## 6. Documento Recebido → Módulo Alimentado

| Documento recebido | Módulos alimentados |
| --- | --- |
| Contrato principal | Torre de Controle, Planejamento, Medição, EVM |
| Orçamento | Quantitativos, Medição, EVM, Planejamento |
| Cronograma | Planejamento, LPS, Torre, RDO |
| Frentes, núcleos e ruas | RDO, Medição, Planejamento, Mapa, LPS |
| RDOs existentes | RDO, Medição, Qualidade, Torre |
| Medições anteriores | Medição, EVM, Torre, Planejamento |
| Lista de fornecedores | Suprimentos, Medição, EVM |
| Pedidos, recebimentos e NFs | Suprimentos, Medição, Financeiro/EVM |
| FVS e não conformidades | Qualidade, Medição, LPS, Torre |
| BIM e projetos | BIM, Mapa, Planejamento, Quantitativos |
| Mão de obra | RDO, LPS, EVM, Planejamento |
| Equipamentos | RDO, LPS, EVM, Suprimentos |
| Fotos de campo | RDO, Qualidade, Medição, Relatórios |

## 7. Prioridades de Onboarding

### Mínimo para rodar

- Dados da obra.
- Usuários.
- Contrato.
- Orçamento.
- Cronograma.
- Frentes/núcleos/locais.
- Fornecedores e subempreiteiros principais.
- Modelo de RDO.

### Ideal para operar

- Medições anteriores.
- RDOs recentes.
- FVS e não conformidades.
- Lista de materiais críticos.
- Pedidos, recebimentos e notas fiscais.
- Mão de obra e equipamentos.
- Fotos de campo.

### Avançado para integração total

- BIM/IFC/DWG/DXF.
- KML/KMZ/SHP ou coordenadas.
- Produtividades históricas.
- Curva ABC.
- Matriz de risco.
- Regras de aprovação.
- Histórico de atrasos, restrições e causas de não cumprimento.

## 8. Critério de Pronto para Começar

A obra está pronta para entrar no ConstruData quando:

- Existe pelo menos um orçamento ou lista de itens.
- Existe pelo menos um cronograma ou lista de atividades.
- Existe uma estrutura de local: obra, núcleo/frente, rua/local ou trecho.
- Existem responsáveis e usuários definidos.
- Existem fornecedores ou subempreiteiros principais.
- Existe um modelo de RDO ou rotina de campo mínima.
- As pendências foram registradas claramente.

Se algum item não existir, a plataforma ainda pode começar com cadastro manual ou template, mas esse ponto deve aparecer como pendência de onboarding.
