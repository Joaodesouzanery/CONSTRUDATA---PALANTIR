/**
 * O acesso do colaborador — o teste que faltava, e que teria pego o defeito.
 *
 * ─── O QUE ACONTECEU ──────────────────────────────────────────────────────────
 * `defsDoPapel` (`appModeStore.ts:337`) sincroniza UM store para o papel `colaborador`, e está
 * certo: sem esse recorte, abrir a tela de bater ponto no celular do canteiro baixava a empresa
 * inteira para o `localStorage` — salário dos colegas, financeiro, medições.
 *
 * Só que `PontoPage` procurava a pessoa em `useMaoDeObraStore.workers` e a obra em
 * `useTorreStore.sites` — dois stores que aquele recorte não baixa. O funcionário logava, abria, e
 * lia **"sua conta ainda não está ligada a um cadastro de funcionário"** com o vínculo
 * perfeitamente feito no banco. Para gerente e diretor funcionava, porque esses sincronizam tudo.
 *
 * ⚠️ O teste que já existia (`batida.test.ts`, "o cliente não puxa a empresa inteira para o celular
 * do colaborador") provava que o RECORTE estava lá. Nada provava que **a tela cabia dentro do
 * recorte** — e era aí que estava o defeito. É essa a lacuna que este arquivo fecha.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const ler = (caminho: string) => readFile(new URL(caminho, import.meta.url), 'utf8')

/** Sem comentário: este arquivo e os que ele lê EXPLICAM o defeito, e o texto casaria com a busca. */
async function semComentario(caminho: string): Promise<string> {
  return (await ler(caminho))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

// ─── 🔴 A tela cabe dentro do recorte ─────────────────────────────────────────

test('🔴 a tela do ponto NÃO procura o titular em stores que o colaborador não sincroniza', async () => {
  const tela = await semComentario('./index.tsx')

  assert.doesNotMatch(tela, /useTorreStore/,
    '`torre` não está em defsDoPapel para o colaborador: `sites` chega vazio e a cerca vira '
    + '`obra-sem-coordenada` para sempre')
  assert.doesNotMatch(tela, /workers\.find/,
    '`mao-de-obra` não está em defsDoPapel para o colaborador: `workers` chega vazio, `eu` fica '
    + 'undefined e a tela acusa "conta não ligada" com o vínculo feito no banco')

  assert.match(tela, /const eu = meuCadastro/, 'o titular vem do pontoStore, que ele sincroniza')
  assert.match(tela, /const obra = minhaObra/)
})

test('🔴 o pontoStore busca o contexto por conta própria, com as colunas NOMEADAS', async () => {
  const store = await semComentario('../../store/pontoStore.ts')

  assert.match(store, /puxarMeuContexto: async \(\)/)
  assert.match(store, /from\('workers'\)[\s\S]{0,80}\.select\('id,name,payload'\)/,
    'o worker pede três campos; a RLS já recorta para a própria linha, e pedir menos é a metade '
    + 'do cliente')
  assert.match(store, /\.eq\('payload->>authUserId', user\.id\)/,
    'defesa em profundidade: no dia em que a varredura da cerca ficar desatualizada, este filtro '
    + 'continua devolvendo uma linha só')

  // ⚠️ A obra NÃO pode trazer o payload: ele carrega contrato, orçamento, medições e riscos de
  // TODAS as obras — e `construction_sites` é exceção da cerca restritiva, ou seja, o colaborador
  // enxerga todas. Quatro campos bastam para a cerca.
  const selectDaObra = store.match(/from\('construction_sites'\)[\s\S]{0,140}?\.select\('([^']+)'\)/)
  assert.ok(selectDaObra, 'a consulta das obras precisa existir')
  assert.doesNotMatch(selectDaObra![1], /(^|,)payload(,|$)/,
    'o payload da obra tem contrato e medição de cada uma — a cerca precisa de lat, lng e raio')
  assert.match(selectDaObra![1], /raioPontoM:payload->>raioPontoM/,
    'o raio vem por caminho de json, sozinho')
})

test('🔴 o recorte de sincronização do colaborador continua valendo', async () => {
  // Este conserto NÃO afrouxou o recorte — e é isso que o mantém seguro. Se um dia alguém
  // "resolver" o problema ligando os stores aqui, esta asserção cai junto e obriga a decisão.
  const modo = await semComentario('../../store/appModeStore.ts')
  assert.match(modo, /if \(papel !== 'colaborador'\) return TENANT_STORE_DEFS/)
  assert.match(modo, /TENANT_STORE_DEFS\.filter\(\(d\) => d\.key === 'ponto'\)/,
    'ligar mao-de-obra e torre aqui faz 12 requisições por login no celular do canteiro, 10 delas '
    + 'para receber lista vazia — e passa a depender SÓ da RLS, cuja varredura é um retrato')
})

// ─── 🔴 Não acusar o gestor de um erro que ele não cometeu ────────────────────

test('🔴 "conta não ligada" só aparece quando é REALMENTE isso', async () => {
  const store = await semComentario('../../store/pontoStore.ts')
  for (const motivo of ['carregando', 'sem-rede', 'sem-vinculo', 'erro']) {
    assert.ok(store.includes(`'${motivo}'`), `o motivo ${motivo} precisa existir no store`)
  }

  const tela = await semComentario('./index.tsx')
  assert.match(tela, /motivoSemCadastro === 'carregando'/)
  assert.match(tela, /motivoSemCadastro === 'sem-rede'/)
  assert.match(tela, /motivoSemCadastro === 'erro'/)
  assert.match(tela, /Sua conta ainda não está ligada/,
    'o texto continua existindo — ele é certo no caso em que É o vínculo que falta')
})

test('🔴 sem rede, o cadastro já guardado NÃO é apagado', async () => {
  const store = await semComentario('../../store/pontoStore.ts')
  const bloco = store.match(/if \(typeof navigator[\s\S]{0,320}?\n {10}\}/)
  assert.ok(bloco, 'o ramo de offline precisa existir em puxarMeuContexto')
  assert.match(bloco![0], /s\.meuCadastro \? null : 'sem-rede'/,
    'offline é exatamente o caso em que o cadastro guardado é a única coisa que deixa a pessoa '
    + 'bater o ponto — limpá-lo ali seria o pior momento possível')
})

// ─── 🔴 As duas regras que se contradizem, e as duas estão certas ─────────────

test('🔴 trocar de empresa LIMPA o cadastro; recarregar sem sinal o MANTÉM', async () => {
  const store = await semComentario('../../store/pontoStore.ts')

  const clear = store.match(/clearData: \(\) => set\(\{[\s\S]*?\}\)/)
  assert.ok(clear)
  assert.match(clear![0], /meuCadastro: null/,
    'o cadastro é de outra empresa: ficar com ele faria a batida sair com o worker errado')
  assert.match(clear![0], /obrasDaEmpresa: \[\]/)

  const part = store.match(/partialize: \(s\) => \{[\s\S]*?\n {6}\}/)
  assert.ok(part)
  assert.match(part![0], /meuCadastro: s\.meuCadastro/,
    'e o persist o guarda, porque F5 sem sinal no canteiro não pode perder o vínculo')
  assert.match(part![0], /minhaObra: s\.minhaObra/)
})

// ─── 🔴 O raio da cerca, que não tinha onde ser digitado ──────────────────────

test('🔴 o raio efetivo é obra → empresa → 5 km, nessa ordem', async () => {
  const tela = await semComentario('./index.tsx')
  assert.match(tela, /obra\?\.raioM \?\? cltSettings\.raioPontoPadraoM \?\? RAIO_PADRAO_M/,
    'a obra manda sobre o padrão da empresa, e o padrão sobre a constante — inverter faria o '
    + 'canteiro de 300 m voltar a aceitar batida a 5 km')
})

test('🔴 os três parâmetros do ponto ganharam formulário — eram letra morta', async () => {
  // ⚠️ `raioPontoM`, `raioPontoPadraoM`, `toleranciaPontoMin` e `bancoHorasMeses` existiam no tipo,
  // eram lidos pelo motor, e NENHUMA tela os gravava. Na prática: cerca sempre de 5 km, tolerância
  // sempre zero, prazo sempre de 6 meses — configuráveis só por edição direta do banco.
  const dialogo = await semComentario('../torre-de-controle/components/ObraDialog.tsx')
  assert.match(dialogo, /register\('raioPontoM'\)/, 'o raio POR OBRA, colado nas coordenadas')
  assert.match(dialogo, /raioPontoM,/, 'e ele precisa chegar ao objeto gravado')

  const painel = await semComentario('../mao-de-obra/components/PontoEletronicoPanel.tsx')
  for (const campo of ['raioPontoPadraoM', 'toleranciaPontoMin', 'bancoHorasMeses']) {
    assert.ok(painel.includes(`updateCLTSettings({ ${campo}:`),
      `${campo} precisa ter onde ser digitado — sem isso o motor lê um valor que ninguém escolheu`)
  }
})

test('🔴 raio vazio vira `undefined`, NUNCA 0', async () => {
  const dialogo = await semComentario('../torre-de-controle/components/ObraDialog.tsx')
  assert.match(dialogo, /Number\.isFinite\(parsedRaio\) && parsedRaio > 0 \? parsedRaio : undefined/,
    'raio zero bloquearia todo mundo, inclusive quem está dentro do canteiro')

  const schema = await semComentario('../torre-de-controle/schemas.ts')
  assert.match(schema, /Number\(v\) >= 50 && Number\(v\) <= 50_000/,
    'piso de 50 m: o GPS de celular erra de 10 a 50 m, e `avaliarCerca` recusa quando a precisão '
    + 'é maior que o raio — com 20 m, TODA batida cairia na justificativa obrigatória')
})

test('🔴 a tela de Ajustes abre mesmo sem ninguém vinculado', async () => {
  const painel = await semComentario('../mao-de-obra/components/PontoEletronicoPanel.tsx')
  assert.match(painel, /visao === 'parametros' \? <Parametros \/> : comPonto\.length === 0/,
    'é justamente onde se configura a cerca ANTES de o primeiro funcionário existir — o aviso de '
    + '"nenhum vínculo" bloqueava as quatro visões')
})
