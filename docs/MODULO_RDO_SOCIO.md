# Módulo de RDO - ConstruData

## Resumo executivo

O módulo de RDO transforma o registro diário da obra em uma base operacional rastreável. Ele não é apenas um formulário digital: ele captura campo, equipes, clima, fotos, serviços, trechos executados, ocorrências, evidências e assinaturas, e conecta essas informações com Medição, Qualidade, Planejamento, Gestão 360 e Relatório 360.

Na prática, o RDO deixa de ser um documento isolado e passa a ser a origem diária da verdade operacional da obra.

## Objetivo do módulo

O objetivo é garantir que tudo que acontece no campo seja registrado com contexto, origem e rastreabilidade:

- o que foi executado;
- onde foi executado;
- por quem foi executado;
- com qual equipe;
- com quais equipamentos;
- em qual data;
- com quais fotos e evidências;
- se houve assinatura ou validação;
- quais quantidades devem alimentar a Medição;
- quais restrições ou problemas devem alimentar Qualidade, Planejamento e Gestão.

## Dois fluxos de RDO

### 1. RDO digital

Fluxo usado para criação direta dentro da plataforma.

O usuário preenche o RDO com:

- data;
- responsável;
- obra/projeto;
- contrato;
- ordem de serviço;
- local;
- clima;
- equipes;
- equipamentos;
- serviços executados;
- trechos;
- quantidades;
- fotos;
- geolocalização;
- observações;
- ocorrências;
- incidentes;
- informações de empreiteira e encarregado.

Esse RDO pode ser salvo, consultado no histórico, exportado em PDF e usado como fonte para os outros módulos.

### 2. RDO automático

Fluxo usado para transformar foto, imagem ou boletim físico em dados estruturados.

O usuário envia a foto do RDO. A plataforma preserva a imagem original para auditoria e usa leitura assistida por IA para extrair os campos do documento.

Esse fluxo foi pensado especialmente para boletins de campo que já existem no cliente, como RDOs impressos, planilhas fotografadas, documentos de empreiteira ou registros vindos por WhatsApp.

O sistema busca identificar:

- data do RDO;
- encarregado;
- núcleo/local;
- rua, beco ou trecho;
- serviços executados;
- quantidades;
- equipes;
- observações;
- evidências;
- presença de assinatura;
- campos ausentes ou inconsistentes.

Se a leitura automática não encontrar um campo com segurança, a informação fica para revisão humana. A foto original continua salva no histórico, incluindo a assinatura, para conferência posterior.

## Foto, assinatura e auditoria

O princípio é: nunca depender apenas do texto extraído.

Cada RDO automático deve manter:

- foto original do documento;
- registro do upload;
- usuário responsável;
- data e hora;
- empresa/organização;
- resultado da extração;
- indicação de assinatura presente;
- status de revisão;
- histórico para auditoria.

Assim, mesmo que a IA leia parcialmente algum documento, a evidência original continua disponível para validação.

## Como o RDO alimenta a Medição

O RDO é uma das principais fontes da Medição.

Quando um RDO é finalizado, os serviços e quantidades registrados podem virar fontes de medição com separação por:

- empresa;
- projeto;
- núcleo;
- trecho;
- serviço;
- data;
- quantidade;
- origem do dado;
- responsável;
- empreiteira;
- evidência vinculada.

Exemplo prático:

1. O campo registra no RDO que determinado serviço foi executado.
2. O sistema separa esse serviço por núcleo, trecho, data e quantidade.
3. A Medição recebe essa informação como fonte rastreável.
4. A equipe confere e consolida a medição.
5. O histórico permite voltar até o RDO e a foto original.

Isso reduz retrabalho, evita planilhas paralelas e diminui divergência entre campo e escritório.

## Integração com Qualidade

O RDO conversa com o módulo de Qualidade para cruzar execução com evidência técnica.

Casos esperados:

- serviço executado no RDO exige FVS correspondente;
- não conformidade pode travar ou sinalizar a medição;
- foto de campo pode servir como evidência;
- pendências de qualidade aparecem antes da consolidação final;
- histórico do serviço fica unido ao histórico técnico.

O objetivo é impedir que a obra avance administrativamente sem lastro técnico.

## Integração com Planejamento

O RDO alimenta o planejamento com execução real.

Quando o usuário registra avanço por trecho ou quantidade executada, essa informação pode atualizar:

- avanço físico;
- curva planejado x realizado;
- restrições;
- produtividade;
- desvios por frente de serviço;
- base para look-ahead;
- PPC semanal no Last Planner System.

Isso permite que o planejamento não dependa apenas de reunião ou planilha. O dado nasce no campo e chega ao cronograma com origem definida.

## Integração com Gestão 360

A Gestão 360 usa o RDO como sinal diário da operação.

Com os dados do RDO, a plataforma pode calcular e exibir:

- produção diária;
- avanço acumulado;
- produtividade por equipe;
- produtividade por empreiteira;
- desvios de prazo;
- impacto em CPI/SPI;
- alertas de risco;
- serviços parados;
- frentes sem evolução;
- gargalos por recurso, material ou equipe.

Assim, a diretoria e a gerência enxergam o andamento da obra quase em tempo real, sem esperar o relatório de fechamento.

## Integração com Relatório 360

O Relatório 360 consolida o que o RDO registrou.

O RDO pode alimentar:

- relatório diário;
- relatório semanal;
- relatório mensal;
- fotos e evidências;
- resumo de produção;
- resumo de ocorrências;
- evolução por núcleo;
- pendências de qualidade;
- dados de medição;
- indicadores executivos.

O relatório deixa de ser montado manualmente do zero e passa a ser gerado a partir da própria rotina operacional.

## Segurança e controle de acesso

O módulo foi pensado para operação multiempresa.

Cada empresa tem seus próprios dados isolados por `organization_id`. Um usuário comum vê apenas a empresa em que foi colocado. Um administrador global, como o operador da plataforma, pode ser vinculado às empresas que precisa acompanhar.

Controles previstos:

- cada usuário entra com login individual;
- cada usuário recebe uma função dentro da empresa;
- permissões podem variar por empresa;
- colaborador só vê o que foi autorizado;
- dados sensíveis não devem ser apagados diretamente;
- exclusões críticas usam soft delete ou aprovação;
- ações importantes ficam registradas em `audit_log`;
- fotos e evidências ficam vinculadas ao histórico.

Exemplos de funções:

- owner;
- admin;
- gerente;
- engenheiro;
- qualidade;
- medição;
- financeiro;
- leitura.

## Situação do primeiro cliente

Primeira organização configurada:

```text
Empresa/obra: Consórcio Se Liga Na Rede - Obra Santos
Admin global: joaoneryflu@gmail.com
Organization ID: 4234fff0-3d87-4967-bddd-a86fb2c237d3
```

O print do Supabase confirma que a organização foi criada e que o e-mail global foi vinculado como administrador/owner dessa organização.

Importante: esse vínculo no banco confirma a empresa e o perfil. O acesso pela tela de login ainda depende do usuário existir corretamente em Supabase Auth com senha e provedor `email` configurados.

## Fluxo operacional ideal

1. O administrador da plataforma cria a empresa.
2. O administrador cria ou convida os usuários.
3. Cada usuário recebe uma função.
4. O usuário entra na plataforma.
5. O usuário registra RDO digital ou envia foto para RDO automático.
6. O sistema salva dados estruturados, foto e evidências.
7. O RDO finalizado alimenta Medição, Qualidade, Planejamento e Gestão.
8. O histórico fica disponível para consulta, auditoria e relatórios.

## Valor para o cliente

O módulo de RDO entrega valor porque reduz o intervalo entre o que acontece no campo e o que a gestão consegue enxergar.

Benefícios diretos:

- menos retrabalho administrativo;
- menos planilhas paralelas;
- maior confiança na medição;
- histórico auditável;
- evidências preservadas;
- acompanhamento diário da obra;
- integração com qualidade e planejamento;
- base para indicadores executivos;
- rastreabilidade por empresa, projeto, núcleo, serviço e usuário.

## O que ainda deve ser validado em campo

Para chegar no nível ideal de confiabilidade, é importante validar o RDO automático com documentos reais do cliente.

Checklist de validação:

- testar fotos reais do RDO usado pelo Consórcio Se Liga Na Rede;
- conferir se a IA lê corretamente data, encarregado, núcleo, rua/beco, serviço e quantidade;
- validar se a assinatura é identificada corretamente;
- comparar texto extraído com a foto original;
- ajustar campos obrigatórios;
- revisar serviços que não existem no catálogo;
- confirmar se as quantidades chegam corretamente na Medição;
- criar rotina de revisão humana antes de finalizar o RDO automático.

## Otimizações recomendadas

1. Criar uma tela de revisão do RDO automático antes de salvar como definitivo.
2. Criar status claros: rascunho, extraído, em revisão, finalizado, rejeitado.
3. Exigir conferência humana quando a confiança da leitura for baixa.
4. Manter catálogo de serviços por cliente, contrato e obra.
5. Vincular empreiteira e encarregado automaticamente por nome normalizado.
6. Bloquear medição de serviço sem evidência mínima quando a regra do cliente exigir.
7. Criar indicadores de divergência entre RDO, Qualidade e Medição.
8. Criar exportação por empresa para auditoria.
9. Criar rotina de backup e retenção das fotos originais.
10. Registrar toda alteração crítica em audit log.

## Pitch curto

O RDO da ConstruData transforma o registro diário da obra em inteligência operacional. O campo registra uma vez, com foto, quantidade, equipe, assinatura e contexto. A plataforma preserva a evidência, estrutura os dados e alimenta automaticamente Medição, Qualidade, Planejamento, Gestão 360 e Relatório 360. O resultado é uma obra com menos retrabalho, mais rastreabilidade e decisões mais rápidas.
