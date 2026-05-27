# Levantamento para Cadastrar uma Obra do Zero no ConstruData

Este checklist define tudo que deve ser solicitado ao cliente para cadastrar uma obra nova com dados suficientes para Torre de Controle, Projetos, RDO, Medição, Planejamento, LPS, Suprimentos, Mão de Obra, Qualidade, EVM/Gestão 360, BIM e relatórios executivos.

## Como pedir ao cliente

Peça tudo do jeito que a empresa já usa hoje. Pode ser PDF, XLSX, imagens, MPP, DWG, IFC, prints, contratos, medições antigas ou pastas de fotos. O objetivo inicial não é exigir padrão perfeito; é descobrir o que existe, o que falta e onde cada informação entra no sistema.

Use a estrutura de pastas:

1. `01_empresa`
2. `02_obra_contrato`
3. `03_orcamento_quantitativos`
4. `04_planejamento`
5. `05_rdo_campo`
6. `06_medicao`
7. `07_suprimentos`
8. `08_mao_de_obra`
9. `09_qualidade`
10. `10_bim_projetos`
11. `11_fotos_evidencias`

## Essencial para começar

| Informação | O que pedir | Módulo destino | Obrigatório |
| --- | --- | --- | --- |
| Empresa | Razão social, CNPJ, endereço, responsável, contatos, logo | Organização / PDFs | Sim |
| Usuários | Nome, e-mail, cargo, função na obra, nível de acesso | Auth / Permissões | Sim |
| Obra | Nome oficial, código interno, cliente final, endereço, cidade/UF | Projetos / Torre | Sim |
| Contrato | Contrato final, proposta aprovada, escopo, prazo, regras de medição | Projetos / Medição | Sim |
| Responsáveis | Diretor, gerente, engenheiro, técnico, comprador, qualidade | Projetos / RDO / Workflow | Sim |
| Orçamento | Itens, unidades, quantidades, custos, preços, BDI, impostos | Quantitativos / EVM | Sim |
| Cronograma | MPP, XER, XLSX ou PDF com baseline e marcos | Planejamento / LPS | Sim |
| Frentes | Torres, pavimentos, setores, ruas, trechos, núcleos ou áreas | Torre / RDO / Mapa | Sim |
| RDO atual | Modelo usado hoje, campos obrigatórios, exemplos preenchidos | RDO | Sim |
| Medições | Boletins anteriores, memória de cálculo, critérios e glosas | Medição | Sim |
| Fornecedores | Lista, CNPJ, contato, categoria, prazo de entrega, condição de pagamento | Suprimentos | Sim |
| Equipe | Funções, quantidade prevista, custo, jornada, produtividade | Mão de Obra / RDO | Sim |
| Fotos | Fotos atuais do local, substrato, frentes, pendências e acesso | RDO / Qualidade | Sim |

## Dados da obra

Solicitar:

- Nome oficial da obra.
- Nome comercial ou apelido interno.
- Código interno.
- Cliente/contratante.
- Endereço completo.
- Cidade e UF.
- Coordenadas, se houver.
- Tipo de obra: residencial, industrial, infraestrutura, saneamento, comercial, retrofit etc.
- Status atual: orçamento, mobilização, execução, paralisada, encerramento.
- Data de início prevista.
- Data de término prevista.
- Prazo contratual.
- Escopo resumido.
- Escopo detalhado.
- Restrições de acesso, horário ou operação.
- Responsáveis técnicos.
- Responsáveis pela aprovação de medição, RDO, qualidade e compras.

## Contrato e regras comerciais

Solicitar:

- Contrato assinado.
- Proposta comercial aprovada.
- Anexos contratuais.
- Escopo incluído e excluído.
- Critérios de medição.
- Marcos de pagamento.
- Prazos e multas.
- Garantias.
- Regras de aceite.
- Regras de glosa.
- Aditivos já existentes.
- Condições para paralisação.
- Obrigações do cliente e da contratada.

Destino:

- Projetos/Torre para identificação e obrigações.
- Medição para critérios e fechamento.
- RDO para observações operacionais e evidências.
- Qualidade para aceite técnico.

## Orçamento, quantitativos e EVM

Solicitar:

- Planilha orçamentária final.
- Memória de cálculo.
- Itens com código, descrição, unidade, quantidade, custo unitário, preço unitário e valor total.
- Composições próprias, SINAPI, SEINFRA ou outras.
- BDI, impostos e encargos.
- Curva ABC.
- Centros de custo.
- Serviços por frente/local.
- Orçamento interno, se diferente do orçamento contratual.
- Margem prevista.
- Contingências.

Destino:

- Quantitativos para base de itens.
- EVM/Gestão 360 para previsto, realizado, tendência e margem.
- Medição para itens medíveis.
- Suprimentos para insumos e fornecedores vinculados.

## Planejamento e LPS

Solicitar:

- Cronograma MPP, XER, XLSX ou PDF.
- Baseline oficial.
- WBS/EAP.
- Atividades.
- Datas de início e fim.
- Durações.
- Predecessoras e sucessoras.
- Marcos contratuais.
- Calendário de trabalho.
- Restrições conhecidas.
- Look-ahead de 3 a 6 semanas, se existir.
- Plano semanal.
- Produtividades esperadas.
- Curva S prevista.

Destino:

- Planejamento Mestre para baseline.
- LPS para plano semanal, PPC e restrições.
- Torre de Controle para desvios críticos.
- RDO para atualização de avanço real.

## RDO e campo

Solicitar:

- Modelo atual de RDO.
- RDOs preenchidos dos últimos 15 a 30 dias, se existirem.
- Campos obrigatórios.
- Lista de serviços executados.
- Relação entre serviço, unidade, local e medição.
- Equipe por dia.
- Equipamentos por dia.
- Materiais usados no campo.
- Ocorrências típicas.
- Paralisações.
- Clima e jornada.
- Fotos com data/local.
- Assinaturas obrigatórias.

Destino:

- RDO como fonte diária de execução.
- Medição como evidência de quantidade.
- Qualidade como evidência de aceite.
- Planejamento/LPS como avanço e restrição.

## Medição

Solicitar:

- Boletins anteriores.
- Planilha do mês atual.
- Critério de medição aprovado.
- Memória de cálculo.
- Quantidade anterior, quantidade do período e acumulado.
- Evidências obrigatórias.
- Subempreiteiros.
- Fornecedores.
- Retenções.
- Descontos.
- Notas fiscais.
- Glosas anteriores.
- Responsáveis por conferência e aprovação.

Destino:

- Medição para fechamento.
- RDO para origem das quantidades.
- Qualidade para bloqueios e aceite.
- Financeiro/EVM para faturamento e saldo.

## Suprimentos

Solicitar:

- Lista de fornecedores.
- CNPJ e contatos.
- Categorias de fornecimento.
- Catálogo de materiais.
- Pedidos de compra.
- Requisições.
- Recebimentos.
- Notas fiscais.
- Estoque atual.
- Lead time.
- Condições de pagamento.
- Materiais críticos.
- Itens vinculados ao cronograma.

Destino:

- Suprimentos para pedidos, entregas e notas.
- LPS para restrições de material.
- EVM/Gestão 360 para custo comprometido e realizado.
- RDO apenas como referência operacional quando material impactar o campo.

## Mão de Obra

Solicitar:

- Lista de colaboradores próprios.
- Lista de terceiros/subempreiteiros.
- Função.
- CPF ou identificador interno.
- Jornada.
- Custo por hora, diária ou mês.
- Equipe prevista por frente.
- Produtividade esperada.
- Certificações e NRs.
- Alocações atuais.
- Encarregados e responsáveis.

Destino:

- Mão de Obra para equipe, produtividade e alocação.
- RDO para apontamento diário.
- Planejamento para capacidade produtiva.
- EVM para custo de mão de obra.

## Qualidade

Solicitar:

- FVS.
- Checklists por serviço.
- Critérios de aceite.
- Não conformidades abertas.
- Evidências fotográficas.
- Ensaios e laudos.
- Responsáveis por inspeção.
- Fluxo de aprovação.
- Histórico de reprovação/glosa.

Destino:

- Qualidade para inspeção e aceite.
- RDO para evidências diárias.
- Medição para bloqueios de fechamento.
- Torre para riscos críticos.

## Equipamentos e manutenções

Solicitar:

- Equipamentos próprios.
- Equipamentos alugados.
- Placa, modelo, tipo e capacidade.
- Local/frente de uso.
- Horímetro.
- Custos.
- Manutenções preventivas e corretivas.
- Disponibilidade.
- Operador responsável.

Destino:

- Equipamentos/Manutenções para disponibilidade e custo.
- RDO para uso diário.
- Planejamento/LPS para restrições.
- Gestão 360 para gargalos.

## BIM, projetos e mapa

Solicitar:

- IFC, RVT, DWG, PDF ou modelo federado.
- Projetos executivos.
- Plantas por pavimento/frente.
- Setorização.
- Coordenadas e mapas.
- KML/KMZ, quando houver.
- Relação entre modelo, atividade e item de orçamento.

Destino:

- BIM 3D/4D/5D.
- Mapa Interativo.
- Planejamento.
- Quantitativos.
- Torre de Controle.

## Pendências que devem virar checklist

Se alguma informação não existir, abrir pendência com responsável e prazo:

- Contrato final.
- Endereço completo.
- Cronograma aprovado.
- Baseline.
- Critério de medição.
- Regras de aceite.
- Quantitativos finais.
- Fotos atuais.
- Responsáveis por aprovação.
- Fornecedores definitivos.
- Equipe prevista.
- Insumos críticos.
- Notas fiscais.
- Condições do local/substrato.
- Acessos e restrições.

## Regra de ouro

Toda informação cadastrada deve responder a pelo menos uma pergunta:

- Onde isso acontece?
- Quem é responsável?
- Quando acontece?
- Qual item/serviço isso impacta?
- Qual quantidade foi prevista ou executada?
- Qual evidência comprova?
- Qual módulo deve controlar?
- Isso é obrigatório para medir, faturar, aprovar ou executar?
