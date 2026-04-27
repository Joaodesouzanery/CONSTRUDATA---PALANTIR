# Auditoria de Escalabilidade - 10.000 usuarios simultaneos

Data: 2026-04-27

## Veredito

O front-end estatico em Vercel esta em boa direcao para muitos acessos simultaneos, porque o app usa Vite, lazy loading por rota e assets estaticos versionados. Mesmo assim, o sistema completo ainda nao deve ser declarado pronto para 10.000 usuarios simultaneos sem teste de carga e dimensionamento do Supabase.

O gargalo principal esperado e o backend de dados: PostgREST/Postgres, Realtime, Auth, Storage e politicas RLS.

## O que esta favoravel

- Rotas principais usam `lazy()` em `src/App.tsx`, reduzindo o custo inicial por usuario.
- A maior parte das telas roda como SPA com Zustand, evitando chamadas repetidas a cada render.
- Vercel entrega arquivos estaticos por CDN; isso ajuda muito para usuarios simultaneos lendo a aplicacao.
- RLS ja esta presente em varios modulos, com separacao por `organization_id`.
- Tabelas recentes usam indices por organizacao e filtros de ativos.

## Riscos atuais para 10.000 simultaneos

- Muitos stores fazem `pull()` de tabelas inteiras por organizacao, sem paginacao ou recorte por periodo.
- Alguns modulos persistem grandes objetos no `localStorage`; isso nao escala bem em navegadores com muita massa de dados.
- Realtime precisa ser usado com parcimonia. 10.000 usuarios conectados podem virar 10.000 conexoes Realtime, mais canais adicionais.
- RLS complexa pode virar gargalo se consultas nao estiverem cobertas por indices.
- Imports grandes, PDFs e XLSX devem ficar fora do fluxo quente de usuarios simultaneos.
- Fotos/base64 em localStorage ou payload JSON grande devem ser evitados; preferir Storage + URLs.

## Checklist antes de prometer 10.000

1. Definir cenario: 10.000 logados lendo dashboard, editando RDO, enviando foto, ou importando planilhas sao cargas muito diferentes.
2. Rodar teste de carga com k6/Artillery em rotas e queries reais.
3. Medir Supabase: CPU, memoria, conexoes DB, latencia PostgREST, Realtime connected clients, e erros RLS.
4. Trocar pulls amplos por views/RPCs agregadas para dashboards.
5. Adicionar paginacao e filtros obrigatorios em historicos, relatorios e tabelas operacionais.
6. Confirmar plano/compute do Supabase e quota de Realtime para o pico real.
7. Validar Storage/CDN para fotos, PDFs e anexos.
8. Criar budgets: p95 < 800 ms para dashboard, erro < 1%, CPU DB < 70% em pico sustentado.

## Recomendacao

Para 10.000 simultaneos reais, tratar como meta de producao com piloto:

- Fase 1: 500 usuarios simultaneos, leitura pesada.
- Fase 2: 2.000 usuarios, leitura + edicoes leves.
- Fase 3: 10.000 usuarios, com plano Supabase dimensionado, queries agregadas e Realtime controlado.

Sem esse ensaio, a resposta correta e: a arquitetura pode evoluir para 10.000, mas ainda nao esta comprovada para 10.000.
