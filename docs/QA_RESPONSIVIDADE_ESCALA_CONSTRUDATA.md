# QA de Responsividade e Escala - ConstruData

Este checklist deve ser usado antes de cada deploy relevante. O objetivo é confirmar que a plataforma funciona bem em desktop e celular, sem vazamento de dados demo, sem dados de outra empresa e com persistência correta.

## 1. Matriz de Ambientes

- [ ] Produção: empresa real, modo DEMO desligado, sem mocks.
- [ ] Homologação: empresa de teste, modo DEMO desligado, sem mocks.
- [ ] Demo: modo DEMO ligado, mocks permitidos e claramente sinalizados.
- [ ] Troca de empresa: dados de uma organização não aparecem em outra.
- [ ] Logout/login: dados excluídos continuam excluídos após nova sessão.
- [ ] Hard refresh: a tela recarrega com o mesmo estado salvo no Supabase.

## 2. Responsividade Global

Validar em 390x844, 430x932, 768x1024, 1366x768 e 1440x900.

- [ ] Nenhuma página cria scroll horizontal no `body`.
- [ ] Tabelas largas ficam contidas no próprio bloco.
- [ ] Botões têm área de toque confortável no celular.
- [ ] Modais cabem na tela e rolam internamente.
- [ ] Abas e filtros largos são roláveis ou quebram linha.
- [ ] Textos não sobrepõem cards, mapas, tabelas ou botões.
- [ ] Sidebar mobile abre, fecha e não bloqueia o conteúdo após fechar.
- [ ] Header mobile mantém acesso a menu, empresa ativa e modo DEMO.

## 3. Páginas Públicas

- [ ] Landing Page desktop.
- [ ] Landing Page mobile.
- [ ] Hero sem corte ruim em 390px.
- [ ] CTAs da Landing: `Acessar` -> `/login`.
- [ ] CTAs da Landing: `Demo` / `Ver como funciona` -> Calendly.
- [ ] Seções abaixo da Hero empilham corretamente.
- [ ] Formulário de qualificação cabe no celular.
- [ ] Página de autenticação mobile.
- [ ] Página de autenticação desktop.
- [ ] Link de agendar demonstração abre em nova aba.

## 4. CRUD e Persistência por Módulo

Para cada módulo, executar: criar, editar, excluir, recarregar, sair, entrar novamente e trocar de empresa.

- [ ] Torre de Controle.
- [ ] Gestão 360.
- [ ] Relatório 360.
- [ ] RDO.
- [ ] Medição.
- [ ] Planejamento.
- [ ] LPS / Lean.
- [ ] Suprimentos.
- [ ] Estoque / Almoxarifado.
- [ ] Qualidade.
- [ ] Mão de Obra.
- [ ] Equipamentos / Manutenções.
- [ ] Financeiro / EVM.
- [ ] Economia.
- [ ] Quantitativos.
- [ ] Projetos.
- [ ] BIM.
- [ ] Mapa Interativo.
- [ ] Adaptação Rápida.

## 5. Suprimentos e Almoxarifado

- [ ] Com DEMO desligado, não aparecem OCs, materiais, núcleos, frentes, alertas ou estoques mock.
- [ ] Item excluído some imediatamente.
- [ ] Item excluído não volta após refresh.
- [ ] Item excluído não volta após logout/login.
- [ ] Item excluído não aparece em outro usuário da mesma organização.
- [ ] Item de outra organização não aparece.
- [ ] Unidade é opcional.
- [ ] Valor unitário e valor total são calculados corretamente.
- [ ] Entrada aumenta saldo.
- [ ] Saída diminui saldo.
- [ ] Exclusão usa soft delete e não aparece em consultas ativas.
- [ ] Erro de sincronização fica visível para o usuário.

## 6. RDO

- [ ] Novo RDO salva informações gerais.
- [ ] Novo RDO salva serviços executados e medição.
- [ ] Novo RDO salva materiais e consumo.
- [ ] Valor total de material = quantidade x valor unitário.
- [ ] Fotos são anexadas e mantidas.
- [ ] Dashboard lê totais por unidade.
- [ ] Dashboard lê custo de materiais.
- [ ] Dashboard lê etapas aprovadas.
- [ ] Dashboard lê pendências/retrabalho.
- [ ] Histórico exibe o RDO salvo.

## 7. Adaptação Rápida

- [ ] PDF é lido sem erro de worker.
- [ ] XLSX lê todas as abas relevantes.
- [ ] Imagem entra como evidência quando não houver OCR.
- [ ] É possível adicionar informação manualmente.
- [ ] É possível editar informação manual.
- [ ] É possível excluir informação manual.
- [ ] O diagnóstico mostra o que existe.
- [ ] O diagnóstico mostra o que falta.
- [ ] O diagnóstico mostra módulo destino.
- [ ] O diagnóstico mostra como controlar pelo RDO.
- [ ] O pacote de preenchimento é salvo como rascunho.
- [ ] Nenhum dado definitivo é criado sem confirmação humana.

## 8. Critérios de Aceite Para Deploy

- [ ] `npm run build` passa.
- [ ] Landing e Login validados no mobile.
- [ ] Sistema interno validado no mobile em pelo menos cinco módulos críticos: Torre, Gestão 360, RDO, Medição e Suprimentos.
- [ ] DEMO desligado não exibe mocks em homologação/produção.
- [ ] Exclusões persistem após refresh e login novo.
- [ ] Deploy Vercel publicado e domínio validado com hard refresh.
