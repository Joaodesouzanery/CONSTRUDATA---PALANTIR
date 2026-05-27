# Estrutura de Trial Comercial ConstruData

## Objetivo

Permitir que um cliente teste a plataforma por 20 a 30 dias sem risco para dados oficiais, com experiência suficiente para perceber valor e com caminho claro para conversão comercial.

## Ambientes

### 1. Demo

Uso: apresentação comercial, reuniões rápidas e prospecção.

Características:
- Dados fictícios e bem preenchidos.
- Sem dados reais do cliente.
- Pode ser resetado a qualquer momento.
- Acesso controlado pela equipe ConstruData.
- Ideal para mostrar o fluxo completo: RDO, Medição, Planejamento, Qualidade, Suprimentos e dashboards.

No Supabase:
- `organizations.environment = 'demo'`.
- Usuários convidados como `visualizador` ou `gestor`.
- Dados seedados por scripts.

### 2. Trial

Uso: cliente testa com alguns dados reais ou semi-reais por tempo limitado.

Características:
- Duração recomendada: 20 ou 30 dias.
- Limite de usuários, obras e módulos.
- Dados isolados por organização.
- Avisos visuais de ambiente trial.
- Registro de uso para medir engajamento.
- Possibilidade de conversão para produção.

No Supabase:
- Pode usar `organizations.environment = 'demo'` ou criar `trial` no futuro.
- Campos recomendados em `organizations.settings`:
  - `trial_started_at`
  - `trial_ends_at`
  - `trial_status`
  - `enabled_modules`
  - `max_trial_users`
  - `conversion_owner`

### 3. Homologação

Uso: implantação, treinamento e validação antes de operar a conta oficial.

Características:
- Espelha a empresa oficial.
- Permite testes com usuários reais.
- Não impacta cálculo, RDO, medição ou financeiro da produção.
- Pode ser recriada a partir da produção com dados sanitizados.

No Supabase:
- `organizations.environment = 'homologation'`.
- Nome sugerido: `Cliente X - Homologação`.
- Slug sugerido: `cliente-x-homologacao`.

### 4. Produção

Uso: operação oficial do cliente.

Características:
- Dados válidos contratualmente.
- Usuários oficiais.
- Auditoria e permissões mais rígidas.
- Sem dados de teste.

No Supabase:
- `organizations.environment = 'production'`.

## Modelo Comercial

### Trial assistido

Recomendado para contratos maiores.

Fluxo:
1. Diagnóstico de 30 minutos.
2. Criação do ambiente trial.
3. Importação de dados mínimos.
4. Treinamento inicial.
5. Acompanhamento semanal.
6. Reunião de conversão no fim do período.

### Trial self-service controlado

Recomendado para leads menores.

Fluxo:
1. Formulário de interesse.
2. Criação automática da empresa demo/trial.
3. Convite do usuário principal.
4. Limite de módulos.
5. Call-to-action para upgrade.

## Módulos Para Trial

Trial mínimo:
- RDO
- RDO Sabesp, quando aplicável
- Medição
- Minha Rotina
- Qualidade básica

Trial avançado:
- Planejamento
- Medição Unificada
- Suprimentos
- Equipamentos
- Relatório 360
- Torre de Controle

## Limites Recomendados

Para trial de 20 a 30 dias:
- Até 5 usuários.
- Até 1 obra.
- Até 30 RDOs.
- Até 1 boletim de medição.
- Exportações com marca de ambiente trial.
- Sem exclusão definitiva de dados.

## Métricas de Conversão

Medir:
- Usuários ativos por semana.
- RDOs criados.
- RDOs exportados.
- Medições geradas.
- Quantidade de módulos acessados.
- Quantidade de convites enviados.
- Tempo até primeiro valor percebido.

Sinais fortes de conversão:
- Cliente cria mais de 10 RDOs.
- Cliente convida mais de 2 usuários.
- Cliente pede importação de dados reais.
- Cliente usa Medição após RDO.
- Cliente solicita ajustes no fluxo.

## Permissões

Papéis sugeridos:
- `owner`: dono do ambiente.
- `admin`: configura usuários e dados.
- `gestor`: opera módulos e aprova.
- `editor`: preenche dados.
- `visualizador`: consulta.

Conta global ConstruData:
- Deve ter membership `owner` em todas as organizações demo, homologação e produção.
- Não depender apenas de `organizations.owner_id`.

## Conversão Para Produção

Duas opções:

### Converter o trial

Vantagem: preserva tudo que o cliente já fez.

Cuidados:
- Revisar dados de teste.
- Remover usuários temporários.
- Alterar `environment` para `production`.
- Ativar contrato/plano.

### Criar produção limpa

Vantagem: evita herdar bagunça do teste.

Cuidados:
- Migrar apenas configurações úteis.
- Importar dados oficiais.
- Manter trial arquivado para auditoria comercial.

## Automação Recomendada

Criar futuramente uma Edge Function:
- `admin-provision-company`
- `admin-provision-trial`
- `admin-clone-org-to-homologation`
- `admin-expire-trial`

Essas funções devem:
- Criar organização.
- Criar memberships.
- Enviar convites.
- Definir módulos habilitados.
- Registrar auditoria.
- Configurar data de expiração.

## Checklist Para Implantar Trial

1. Criar organização trial/demo.
2. Definir `environment`.
3. Inserir membership do usuário principal.
4. Inserir membership da conta global ConstruData.
5. Definir módulos liberados.
6. Criar dados iniciais ou importar planilha.
7. Ativar aviso visual de ambiente.
8. Agendar follow-up comercial.
9. Monitorar uso semanal.
10. Converter ou arquivar no fim do período.

