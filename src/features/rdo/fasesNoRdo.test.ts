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
