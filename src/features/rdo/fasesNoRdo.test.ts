/**
 * A troca do checklist pelas Fases — e o que ela NÃO pode ter quebrado.
 *
 * "Serviços Executados no Dia" eram onze booleanos sem número nenhum; "Produção do Dia" era quem
 * tinha a metragem e os vínculos que alimentam medição, planejamento e Gestão 360. Fundir as duas
 * é o certo, mas há quatro fios que passam por ali e que, cortados, apagam a obra de telas inteiras
 * **sem nenhum erro aparecer**. Estes testes são sobre esses fios.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { idDaFasePadrao } from './data/idDaFase'
import { FASES_PADRAO } from './data/fasesPadrao'

async function ler(caminho: string): Promise<string> {
  const bruto = await readFile(new URL(caminho, import.meta.url), 'utf8')
  return bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

// ─── 🔴 Os fios que não podem ser cortados ────────────────────────────────────

test('🔴 a linha de fase PRESERVA contractServiceId — é por ele que a medição vê a obra', async () => {
  const tipos = await readFile(new URL('../../types/index.ts', import.meta.url), 'utf8')
  const bloco = tipos.match(/export interface RdoCompizzoProducaoRow \{[\s\S]*?\n\}/)
  assert.ok(bloco)
  assert.match(bloco![0], /contractServiceId\?/,
    'sem ele, `medidoAutoPorServico` para de enxergar a produção e a medição da obra zera')
  assert.match(bloco![0], /planningActivityId\?/,
    'sem ele, o Previsto × Realizado e o Gestão 360 param de ver a obra')
  assert.match(bloco![0], /faseId\?/)
  assert.match(bloco![0], /classificacao\?/,
    'sem ele, `faseId` vazio volta a significar duas coisas — "não escolhi" e "é avulso"')
})

test('🔴 o checklist saiu da TELA mas os campos continuam no tipo — RDO antigo não pode sumir', async () => {
  const painel = await ler('./components/RdoCompizzoPanel.tsx')
  assert.doesNotMatch(painel, /SERVICO_ITEMS/, 'o checklist de onze caixinhas saiu da edição')
  assert.doesNotMatch(painel, /setServicosExtra/, 'e a lista de serviços livres também')

  const tipos = await readFile(new URL('../../types/index.ts', import.meta.url), 'utf8')
  assert.match(tipos, /servicos:\s*RdoCompizzoServicos/,
    'o campo fica no tipo: o RDO de agosto tem esse dado e o detalhe/PDF ainda o lê')

  // E o painel continua ENVIANDO o que veio, para editar um RDO antigo não apagar o que ele tinha.
  assert.match(painel, /servicos,\s*servicosExtra/)
})

test('🔴 o detalhe e o PDF só mostram o checklist quando ELE EXISTE', async () => {
  const detalhe = await ler('./components/RdoDetalhe.tsx')
  assert.match(detalhe, /temChecklistLegado/,
    'RDO novo com um bloco "nenhum serviço marcado" ensina o leitor a pular seções')

  const pdf = await ler('./utils/rdosReportExport.ts')
  assert.match(pdf, /temLegado/)
  assert.match(pdf, /ehPorFase \? 'Fases do dia' : 'Produção do dia'/,
    'o papel precisa chamar a seção pelo nome certo')
})

test('🔴 a unidade vem da FASE, não é digitada', async () => {
  const painel = await ler('./components/RdoCompizzoPanel.tsx')
  assert.match(painel, /faseId: f\.id, servico: f\.nome, unidade: f\.unidade/,
    'é a unidade que decide se a metragem é área, comprimento ou contagem — e daí dependem a meta '
    + 'e o preço. Deixar digitar abriria a porta para "m2" num dia e "M²" no outro')
})

// ─── 🔴 O id determinístico ───────────────────────────────────────────────────

test('🔴 o id da fase padrão é ESTÁVEL entre chamadas', async () => {
  for (const f of FASES_PADRAO) {
    assert.equal(idDaFasePadrao(f.nome), idDaFasePadrao(f.nome))
  }
  assert.equal(idDaFasePadrao('Lixamento de Piso de Concreto'), 'fase-padrao:lixamento-de-piso-de-concreto')
})

test('🔴 acento e pontuação não mudam o id', () => {
  assert.equal(idDaFasePadrao('Primer 1ª demão'), 'fase-padrao:primer-1-demao')
  assert.equal(idDaFasePadrao('Demarcação — Fita Crepe'), 'fase-padrao:demarcacao-fita-crepe')
  assert.equal(
    idDaFasePadrao('Pintura de Demarcações, Números e Incêndio'),
    'fase-padrao:pintura-de-demarcacoes-numeros-e-incendio',
  )
})

test('🔴 fases diferentes têm ids diferentes', () => {
  const ids = new Set(FASES_PADRAO.map((f) => idDaFasePadrao(f.nome)))
  assert.equal(ids.size, FASES_PADRAO.length,
    'id repetido somaria a metragem de duas fases numa só, em silêncio')
})

test('o painel usa o id determinístico, nunca randomUUID, para as fases padrão', async () => {
  const painel = await ler('./components/RdoCompizzoPanel.tsx')
  const bloco = painel.match(/const fasesDaObra = useMemo[\s\S]*?\}, \[selectedSite\]\)/)
  assert.ok(bloco, 'o derivado das fases precisa existir')
  assert.match(bloco![0], /idDaFasePadrao/)
  assert.doesNotMatch(bloco![0], /randomUUID/,
    'com id aleatório, o faseId gravado ontem não casaria com o de hoje e a meta veria zero '
    + 'para sempre — sem nenhum erro na tela')
})

// ─── 🔴 O select, a coluna e as Metas (23/09/2026) ────────────────────────────

test('🔴 o padrão é "Selecionar Fase" e o avulso é a ÚLTIMA opção', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  const iSelecionar = p.indexOf('>Selecionar Fase<')
  const iFases = p.indexOf('fasesDaObra.map((f) =>')
  const iAvulso = p.indexOf('OPCAO_AVULSO}>')
  assert.ok(iSelecionar > -1, 'a opção padrão precisa existir')
  assert.ok(iSelecionar < iFases && iFases < iAvulso,
    'a ordem das opções é uma decisão do cliente e só existe no JSX — nenhum tipo a protege')
})

test('🔴 o sentinela de avulso NUNCA é gravado em faseId', async () => {
  const painel = await ler('./components/RdoCompizzoPanel.tsx')
  assert.doesNotMatch(painel, /faseId: OPCAO_AVULSO|faseId: '__avulso__'/,
    'o PDF decide o título com `producao.some((p) => !!p.faseId)`: um sentinela ali faria TODO '
    + 'RDO imprimir "Fases do dia". E `realizadoPorFaseNoPeriodo` acumula por `faseId` — criaria '
    + 'uma chave fantasma na meta da obra')
  assert.match(painel, /classificacao: 'avulso'/, 'o avulso é marcado em campo próprio')
})

test('🔴 a coluna Atividade saiu da TELA, e a criação no Planejamento CONTINUA', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  assert.doesNotMatch(p, /value=\{row\.planningActivityId \?\? ''\}/, 'o select da atividade saiu')
  assert.match(p, /const obraAtividades = useMemo/,
    '⚠️ sem ele, `buildProducaoFinal` para de reaproveitar a atividade pelo nome e cria uma NOVA '
    + 'a cada save — o Previsto × Realizado se reparte entre dezenas de "Pintura"')
  assert.match(p, /addActivity\(\{/, 'o Previsto × Realizado e o Gestão 360 dependem disto')
  assert.match(p, /planningActivityId: id/)
})

test('🔴 cabeçalho e linha da grade usam A MESMA constante', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  const bloco = p.slice(p.indexOf('Fases do Dia'), p.indexOf('Materiais Utilizados'))
  assert.equal((bloco.match(/gridTemplateColumns: COLUNAS_DA_FASE/g) ?? []).length, 2)
  assert.doesNotMatch(bloco, /gridTemplateColumns: '/,
    'duplicado, o gabarito diverge e o cabeçalho passa a rotular a coluna errada — sem erro nenhum')
})

test('🔴 o RDO monta a MESMA seção de metas da Torre, não uma cópia', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  assert.match(p, /import \{ MetasDaObraSection \}/)
  assert.match(p, /key=\{`metas-\$\{selectedSite\.id\}`\}/,
    'sem a key o card não remonta ao trocar de obra e grava a meta da obra A dentro da obra B')
  assert.match(p, /verMeta && \(/,
    'render condicional: com <details> os filhos montam fechados e a varredura de TODOS os RDO '
    + 'rodaria a cada tecla digitada no formulário')
  // ⚠️ O placar USA `resumoDaMeta`/`realizadoPorFaseNoPeriodo` — e isso é o certo: são as funções
  // PURAS do motor da Torre, as mesmas que a Torre chama. O que não pode existir é conta própria.
  assert.doesNotMatch(p, /function\s+calcularMeta|const\s+metaCalculada\s*=/,
    'uma segunda IMPLEMENTAÇÃO da meta dentro do RDO é como nascem dois números para a mesma '
    + 'pergunta; reusar a função pura é o contrário disso')
})

// ─── 🔴 Por que a Meta não aparecia (24/09/2026) ──────────────────────────────

test('🔴 o RDO SINCRONIZA o store da Torre — sem isso não há obra, e sem obra não há meta', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  assert.match(p, /useStoreSync\(useTorreStore\)/,
    'o painel lia `useTorreStore.sites` sem bootstrap: o único lugar que sincroniza aquele store é '
    + 'ObrasListPanel, então o RDO só enxergava obra se a pessoa tivesse aberto a Torre antes '
    + 'naquele navegador. O sintoma NÃO era "a meta sumiu" — era "o campo Obra virou caixa de '
    + 'texto", e ninguém liga uma coisa à outra')
  assert.match(p, /useStoreSync\(useMaoDeObraStore\)/, 'o de Mão de Obra continua')
})

test('🔴 "Metas de Produção" é uma SEÇÃO com esse nome, não um botão escondido', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  assert.match(p, /<Section title="Metas de Produção"/,
    'era um botão discreto chamado "Visualizar meta" no rodapé de Fases do Dia — e quem procurava '
    + 'uma seção com este nome não achava, porque o texto só aparecia depois do clique')
  // O placar fica FORA do toggle: é ele que se acompanha enquanto preenche.
  assert.match(p, /<PlacarDaMeta/)
  const secao = p.slice(p.indexOf('<Section title="Metas de Produção"'), p.indexOf('<Section title="Materiais'))
  assert.ok(secao.indexOf('<PlacarDaMeta') < secao.indexOf('verMeta &&'),
    'o placar vem ANTES do bloco recolhido — ele é a parte que se vê sem clicar em nada')
})

test('🔴 o que está sendo digitado NÃO é somado ao realizado', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  assert.match(p, /placarDoDia\(fasesDaObra, metaDoDia, realizadoDaMeta, lancandoHoje, today\)/,
    'o digitado entra como argumento PRÓPRIO — somá-lo ao realizado faria a meta oscilar a cada '
    + 'tecla e mostraria como entregue o que ainda não foi salvo')
  assert.doesNotMatch(p, /\.\.\.realizadoDaMeta,\s*\.\.\.lancandoHoje/,
    'fundir os dois mapas é exatamente o atalho que destrói a distinção')
})

test('🔴 a varredura de todos os RDO é memoizada — o formulário tem trinta campos', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  const bloco = p.match(/const realizadoDaMeta = useMemo\([\s\S]*?\)\n/)
  assert.ok(bloco, '`realizadoPorFaseNoPeriodo` precisa estar dentro de um useMemo')
  assert.doesNotMatch(bloco![0], /producao/,
    'se `producao` entrar nas dependências, a varredura de TODOS os RDO da empresa roda a cada '
    + 'tecla digitada')
})

test('🔴 a permissão das metas continua sendo a da TORRE, mesmo dentro do RDO', async () => {
  const secao = await ler('../torre-de-controle/components/MetasDaObraSection.tsx')
  assert.match(secao, /usePermissaoEscrita\(ROLES_TORRE_WRITE\)/,
    '`updateSite` fecha em `podeEscreverTorre()` e retorna SEM ERRO. Alargar para ROLES_RDO_WRITE '
    + 'faria o papel `qualidade` digitar a meta e nada acontecer — nem gravação, nem aviso')
  assert.doesNotMatch(secao, /ROLES_RDO_WRITE/)
})

test('🔴 quantidade sem destino bloqueia o FINALIZAR, não o rascunho', async () => {
  const p = await ler('./components/RdoCompizzoPanel.tsx')
  assert.match(p, /status === 'finalizado' && faltaClassificar\.length > 0/,
    'rascunho é "ainda vou preencher", e a meta já ignora rascunho por conta própria')
})
