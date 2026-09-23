/**
 * Os testes 🔴 do ponto eletrônico: identidade, sequência e o que vai para o banco.
 *
 * A cerca virtual é testada à parte, em `src/lib/geo.test.ts` (13 casos, com coordenadas reais de
 * Bertioga e Santos). Aqui está o resto do que precisa valer em juízo.
 *
 * Os gates de papel e a fiação do store são verificados pelo TEXTO dos arquivos — é o padrão do
 * projeto para store com persist + auth + fila (ver `financeiroTitulosStore.test.ts`). Montar o
 * zustand inteiro para checar uma guarda custaria mais do que vale; o que NÃO se verifica por
 * texto (a identidade, a linha do banco, a sequência) está testado de verdade, com as funções
 * puras extraídas justamente para isso.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  SEQUENCIA_DA_JORNADA, ROTULO_DA_BATIDA, HORAS_ENTRE_JORNADAS,
  proximaBatida, jornadaAberta, dataDaJornada,
  montarBatida, montarAjuste, batidaParaRow,
} from './batida'
import type { RegistroDePonto } from '@/types'

const CARIMBO = {
  authUserId: 'conta-do-joao',
  id: 'batida-1',
  agora: '2026-09-19T11:02:31.000Z',
  data: '2026-09-19',
}

const DADOS = {
  workerId: 'worker-joao',
  siteId: 'obra-bertioga',
  tipo: 'entrada' as const,
  lat: -23.8531,
  lng: -46.1390,
  precisaoM: 12,
  distanciaM: 340,
  dentroDaCerca: true,
}

function batida(over: Partial<RegistroDePonto> = {}): RegistroDePonto {
  return { ...montarBatida(DADOS, CARIMBO), ...over }
}

// ─── Identidade: a prova de quem bateu ────────────────────────────────────────

test('🔴 a identidade é a conta LOGADA, não o que a tela mandou', () => {
  // Uma tela adulterada (console do navegador, extensão, celular compartilhado) pode mandar
  // qualquer coisa. `montarBatida` ignora: quem assina é o carimbo.
  const falsificada = { ...DADOS, authUserId: 'conta-de-outro' } as never
  const r = montarBatida(falsificada, CARIMBO)
  assert.equal(r.authUserId, 'conta-do-joao')
})

test('🔴 a batida carrega workerId E authUserId — os dois, sempre', () => {
  const r = batida()
  assert.equal(r.workerId, 'worker-joao')
  assert.equal(r.authUserId, 'conta-do-joao')
})

test('🔴 a autoria NÃO depende de created_by — o fixOrg reescreve esse campo', () => {
  const r = batida()
  // Simula o flush feito por OUTRA sessão (o encarregado sincronizando o celular do canteiro):
  // `created_by` sai com o id de quem sincroniza, e é exatamente isso que o `fixOrg` faz.
  const linhaDoJoao   = batidaParaRow(r, 'org-wcr', 'conta-do-joao')
  const linhaDoOutro  = batidaParaRow(r, 'org-wcr', 'conta-do-encarregado')

  assert.notEqual(linhaDoJoao.created_by, linhaDoOutro.created_by, 'o created_by muda, e isso é esperado')
  assert.equal(linhaDoJoao.auth_user_id, linhaDoOutro.auth_user_id, 'a autoria NÃO pode mudar')
  assert.equal(linhaDoOutro.auth_user_id, 'conta-do-joao')
  assert.equal(linhaDoOutro.worker_id, 'worker-joao')
  // E no payload também, para a leitura que não passa pelas colunas promovidas.
  const payload = linhaDoOutro.payload as unknown as RegistroDePonto
  assert.equal(payload.authUserId, 'conta-do-joao')
})

// ─── A linha do banco ─────────────────────────────────────────────────────────

test('🔴 o cliente NÃO manda momento_servidor nem nsr — são do servidor', () => {
  const linha = batidaParaRow(batida({ momentoServidor: '2026-09-19T11:02:35Z', nsr: 41 }), 'org', 'quem-sincroniza')
  assert.ok(!('momento_servidor' in linha), 'a hora do servidor é do Postgres (default now())')
  assert.ok(!('nsr' in linha), 'o NSR é do gatilho — deixar o aparelho numerar a própria prova não serve')
})

test('a linha tem created_by: sem ela o fixOrg devolve PGRST204 e a fila trava em silêncio', () => {
  const linha = batidaParaRow(batida(), 'org', 'alguem')
  assert.equal(linha.created_by, 'alguem')
})

test('as colunas promovidas existem — a RLS não consegue filtrar dentro do jsonb com índice', () => {
  const linha = batidaParaRow(batida(), 'org-wcr', 'alguem')
  for (const coluna of ['worker_id', 'auth_user_id', 'organization_id', 'tipo', 'data', 'momento_dispositivo', 'origem']) {
    assert.ok(coluna in linha, `falta a coluna ${coluna}`)
  }
  assert.equal(linha.organization_id, 'org-wcr')
})

test('a hora do aparelho vai inteira, com segundos — arredondar apagaria a divergência', () => {
  const linha = batidaParaRow(batida(), 'org', 'alguem')
  assert.equal(linha.momento_dispositivo, '2026-09-19T11:02:31.000Z')
})

// ─── A sequência do dia ───────────────────────────────────────────────────────

test('dia vazio: a próxima é a entrada', () => {
  assert.equal(proximaBatida([]), 'entrada')
})

test('a sequência anda na ordem dos quatro momentos', () => {
  const feitas: RegistroDePonto[] = []
  const esperado = ['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida']
  for (const tipo of esperado) {
    assert.equal(proximaBatida(feitas), tipo)
    feitas.push(batida({ tipo: tipo as RegistroDePonto['tipo'], id: `b-${tipo}` }))
  }
  // Depois das quatro o dia NÃO fecha — ver o teste da hora extra abaixo.
  assert.equal(proximaBatida(feitas), 'entrada')
})

test('🔴 depois da 4ª batida o registro NÃO fecha — hora extra chamada à noite tem como ser marcada', () => {
  const jornadaCheia = ['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida']
    .map((t, i) => batida({ tipo: t as RegistroDePonto['tipo'], id: `b${i}` }))
  // Travar aqui produziria trabalho sem registro nenhum — exatamente o que o art. 74 impede.
  assert.equal(proximaBatida(jornadaCheia), 'entrada', 'a 5ª é o retorno ao trabalho')
  assert.equal(proximaBatida([...jornadaCheia, batida({ id: 'b4' })]), 'saida', 'a 6ª fecha o retorno')
})

test('🔴 quem esqueceu a volta do intervalo NÃO fica travado no canteiro', () => {
  // Três batidas feitas, qualquer que tenha sido a ordem real: a quarta continua disponível.
  // Travar produziria o pior dos dois mundos — um dia sem saída E alguém sem como registrar.
  const feitas = [batida({ id: 'a' }), batida({ id: 'b' }), batida({ id: 'c' })]
  assert.equal(proximaBatida(feitas), 'saida')
})

test('🔴 ajuste do gestor não mexe no botão de quem está trabalhando', () => {
  // O gestor lançou um ajuste às 10h. Se ele contasse, o funcionário que bateu só a entrada
  // veria "volta do intervalo" como próxima — e bateria a coisa errada.
  const feitas = [
    batida({ id: 'real' }),
    montarAjuste(
      { ...DADOS, authUserId: 'conta-do-joao', data: '2026-09-19', momentoDispositivo: '2026-09-19T13:00:00.000Z', tipo: 'inicio_intervalo', motivoAjuste: 'esqueceu' },
      { id: 'aj', agora: '2026-09-19T18:00:00.000Z', ajustadoPor: 'Willian' },
    ),
  ]
  assert.equal(proximaBatida(feitas), 'inicio_intervalo')
})

test('todo tipo da sequência tem rótulo em português', () => {
  for (const { tipo, rotulo } of SEQUENCIA_DA_JORNADA) {
    assert.equal(ROTULO_DA_BATIDA[tipo], rotulo)
    assert.ok(rotulo.length > 0)
  }
})

// ─── A jornada, e a meia-noite ────────────────────────────────────────────────

/** Batida com hora explícita, para montar turnos que atravessam o dia. */
function em(isoLocal: string, tipo: RegistroDePonto['tipo'], data: string, id = isoLocal): RegistroDePonto {
  return batida({ id, tipo, data, momentoDispositivo: isoLocal })
}

test('🔴 turno da noite: a jornada NÃO zera à meia-noite', () => {
  // Entrada 22h de segunda; agora são 2h da terça. Pelo dia civil, a lista estaria vazia e o
  // próximo toque voltaria a ser "Entrada" — a saída da madrugada viraria entrada de um dia novo.
  const feitas = [em('2026-09-14T22:00:00.000Z', 'entrada', '2026-09-14')]
  const aberta = jornadaAberta(feitas, '2026-09-15T02:00:00.000Z')
  assert.equal(aberta.length, 1, 'a batida das 22h continua na jornada às 2h')
  assert.equal(proximaBatida(aberta), 'inicio_intervalo')
})

test('🔴 a batida da madrugada pertence ao dia em que a jornada COMEÇOU', () => {
  const feitas = [em('2026-09-14T22:00:00.000Z', 'entrada', '2026-09-14')]
  const aberta = jornadaAberta(feitas, '2026-09-15T06:00:00.000Z')
  assert.equal(dataDaJornada(aberta, '2026-09-15'), '2026-09-14',
    'saída às 6h é jornada de ONTEM — é assim que se conta noturno e interjornada')
})

test('🔴 a jornada de ontem NÃO cola na de hoje', () => {
  // Saiu às 17h de segunda, entra às 7h de terça: 14 h de folga. Se colasse, o toque da manhã
  // seria a 5ª batida do turno anterior em vez da entrada de um dia novo.
  const ontem = ['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map((t, i) =>
    em(`2026-09-14T${String(7 + i * 3).padStart(2, '0')}:00:00.000Z`, t as RegistroDePonto['tipo'], '2026-09-14'))
  const aberta = jornadaAberta(ontem, '2026-09-15T07:00:00.000Z')
  assert.equal(aberta.length, 0)
  assert.equal(proximaBatida(aberta), 'entrada')
  assert.equal(dataDaJornada(aberta, '2026-09-15'), '2026-09-15')
})

test('o almoço longo continua sendo a MESMA jornada', () => {
  const feitas = [
    em('2026-09-14T07:00:00.000Z', 'entrada', '2026-09-14'),
    em('2026-09-14T11:00:00.000Z', 'inicio_intervalo', '2026-09-14'),
  ]
  // 4 h parado: menos que o corte, então ainda é o mesmo turno.
  const aberta = jornadaAberta(feitas, '2026-09-14T15:00:00.000Z')
  assert.equal(aberta.length, 2)
  assert.equal(proximaBatida(aberta), 'fim_intervalo')
})

test('o corte entre jornadas fica abaixo da interjornada do art. 66 e acima de qualquer intervalo', () => {
  assert.ok(HORAS_ENTRE_JORNADAS < 11, 'acima de 11h começaria a colar dois dias de trabalho')
  assert.ok(HORAS_ENTRE_JORNADAS > 3, 'abaixo disso um almoço longo partiria a jornada no meio')
})

test('batida com hora ilegível não arrasta a jornada inteira', () => {
  const feitas = [
    em('2026-09-14T07:00:00.000Z', 'entrada', '2026-09-14'),
    batida({ id: 'quebrada', momentoDispositivo: 'nao-e-data', data: '2026-09-14' }),
  ]
  // Não pode lançar nem devolver lista com lixo; o pior aceitável é parar ali.
  const aberta = jornadaAberta(feitas, '2026-09-14T08:00:00.000Z')
  assert.ok(Array.isArray(aberta))
})

// ─── O ajuste ─────────────────────────────────────────────────────────────────

test('🔴 ajuste é registro NOVO e marcado — nunca a edição da original', () => {
  const original = batida()
  const ajuste = montarAjuste(
    {
      workerId: original.workerId, authUserId: original.authUserId, siteId: original.siteId,
      tipo: 'saida', data: original.data, momentoDispositivo: '2026-09-19T20:10:00.000Z',
      motivoAjuste: 'bateu a saída no relógio da portaria',
    },
    { id: 'ajuste-1', agora: '2026-09-20T08:00:00.000Z', ajustadoPor: 'Willian Rezende' },
  )
  assert.notEqual(ajuste.id, original.id, 'id próprio: a original continua existindo')
  assert.equal(ajuste.origem, 'ajuste')
  assert.equal(ajuste.ajustadoPor, 'Willian Rezende')
  assert.equal(ajuste.motivoAjuste, 'bateu a saída no relógio da portaria')
  assert.equal(ajuste.authUserId, original.authUserId, 'o dono da jornada continua sendo o funcionário')
})

// ─── Gates e fiação, conferidos no texto ──────────────────────────────────────

async function fonte(caminho: string): Promise<string> {
  const bruto = await readFile(new URL(caminho, import.meta.url), 'utf8')
  return bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

test('🔴 colaborador pode registrar ponto — o gate de Mão de Obra o barraria', async () => {
  const src = await fonte('../../store/pontoStore.ts')
  assert.match(src, /ROLES_PONTO_REGISTRAR[^=]*=\s*\n?\s*\[[^\]]*'colaborador'/,
    'sem `colaborador` em ROLES_PONTO_REGISTRAR o funcionário clica e nada acontece — nem localmente')
  assert.doesNotMatch(src, /podeEscreverMaoDeObra/,
    'o ponto NÃO pode usar o gate de Mão de Obra: ele exclui o colaborador de propósito')
})

test('🔴 colaborador NÃO pode gerir ponto nem escrever em nenhum outro módulo', async () => {
  const ponto = await fonte('../../store/pontoStore.ts')
  const gerir = ponto.match(/ROLES_PONTO_GERIR[^=]*=\s*\n?\s*\[([^\]]*)\]/)
  assert.ok(gerir, 'ROLES_PONTO_GERIR precisa existir')
  assert.ok(!gerir![1].includes('colaborador'), 'quem bate o ponto não ajusta o ponto dos outros')

  const roles = await fonte('../../lib/roles.ts')
  for (const lista of roles.matchAll(/export const (ROLES_\w+_WRITE)[^=]*=\s*([\s\S]*?)\n\n/g)) {
    assert.ok(!lista[2].includes("'colaborador'"),
      `${lista[1]} não pode conter 'colaborador' — a lista existe para espelhar uma policy de escrita`)
  }
})

test('🔴 a fila NÃO é zerada ao trocar de empresa — batida offline não pode morrer', async () => {
  const src = await fonte('../../store/pontoStore.ts')
  // ⚠️ `[\s\S]*?` e não `[^}]*`: o corpo do clearData tem objeto aninhado (`parametros: {}`),
  // e parar no primeiro `}` fazia o teste não achar a função e falhar por engano.
  const clear = src.match(/clearData:\s*\(\)\s*=>\s*set\(\{([\s\S]*?)\n\s*\}\)/)
  assert.ok(clear, 'clearData precisa existir')
  assert.ok(!clear![1].includes('pendingSync'),
    'zerar pendingSync no clearData apagaria a batida feita sem rede antes de ela subir')
})

test('🔴 o store está registrado nos três lugares, ou a batida offline fica invisível', async () => {
  const auth = await fonte('../../lib/auth.ts')
  assert.match(auth, /pontoStore/, 'sem isto, trocar de empresa deixa a batida da anterior na tela')

  const appMode = await fonte('../../store/appModeStore.ts')
  assert.match(appMode, /'cdata-ponto'/, 'sem a chave em STORE_KEYS, ligar o Modo Demo apaga as batidas')
  assert.match(appMode, /key: 'ponto'[\s\S]{0,200}pontoStore/,
    'sem entrar em TENANT_STORE_DEFS, o indicador de sincronização não conta a batida pendente, '
    + '"Tentar novamente" não a reenvia e o pull do login não a baixa')
})

test('🔴 a rota /app/ponto existe e o colaborador não alcança o resto do sistema', async () => {
  const app = await fonte('../../App.tsx')
  assert.match(app, /path="\/app\/ponto"/)
  const papeis = app.match(/PAPEIS_DO_SISTEMA[^=]*=\s*\[([\s\S]*?)\]/)
  assert.ok(papeis, 'PAPEIS_DO_SISTEMA precisa existir')
  assert.ok(!papeis![1].includes('colaborador'),
    'com colaborador na lista, o AuthGuard deixaria ele entrar em todos os módulos')
  assert.match(app, /redirecionarPara="\/app\/ponto"/,
    'sem redirecionar para o ponto, o guard manda o colaborador para minha-rotina — que ele também '
    + 'não pode ver — e vira laço')
})

test('🔴 o AuthGuard lê a MEMBERSHIP da empresa ativa, não profiles.role', async () => {
  const guard = await fonte('../../lib/AuthGuard.tsx')
  assert.match(guard, /papelDaOrgAtiva/,
    'profiles.role é a sombra do papel na empresa ativa daquela pessoa; quem trabalha em duas '
    + 'empresas carrega o papel da outra, e o guard deixaria passar ou barraria a pessoa errada')
  assert.doesNotMatch(guard, /roles\.includes\(profile\.role\)/)
})

test('🔴 a migration derruba cada policy antes de criar — rodar duas vezes não pode quebrar', async () => {
  const sql = await readFile(
    new URL('../../../supabase/migrations/20260918150000_ponto_registros.sql', import.meta.url), 'utf8')
  const criadas = [...sql.matchAll(/create policy (\w+) on/gi)].map((m) => m[1])
  const dropadas = new Set([...sql.matchAll(/drop policy if exists (\w+) on/gi)].map((m) => m[1]))
  assert.ok(criadas.length >= 4, `esperava ao menos 4 policies, achei ${criadas.length}`)
  for (const p of criadas) {
    assert.ok(dropadas.has(p), `a policy ${p} não tem "drop policy if exists"`)
  }
})

test('🔴 a policy de DELETE do ponto bloqueia — registro de jornada não se apaga', async () => {
  const sql = await readFile(
    new URL('../../../supabase/migrations/20260918150000_ponto_registros.sql', import.meta.url), 'utf8')
  const del = sql.match(/create policy \w*delete\w* on public\.ponto_registros[\s\S]*?;/i)
  assert.ok(del, 'precisa existir uma policy de DELETE explícita')
  assert.match(del![0], /using \(false\)/i, 'DELETE precisa ser negado — CLT art. 74, inalterabilidade')
})

async function sqlDoPonto(): Promise<string> {
  return readFile(
    new URL('../../../supabase/migrations/20260918150000_ponto_registros.sql', import.meta.url), 'utf8')
}

/**
 * SQL sem comentários.
 *
 * ⚠️ Necessário porque esta migração EXPLICA nos comentários as formas erradas que ela evita
 * ("não use `for update` com agregação"). Procurar a forma errada no texto cru acharia a
 * explicação dela — um teste que falha justamente por o código estar bem documentado.
 */
function semComentarios(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, '')
}

test('🔴 o insert do colaborador exige que a batida seja DELE — conta E cadastro', async () => {
  const sql = await sqlDoPonto()
  const ins = semComentarios(sql).match(/create policy ponto_insert on public\.ponto_registros[\s\S]*?\n {2}\);/i)
  assert.ok(ins, 'precisa existir a policy ponto_insert')
  assert.match(ins![0], /auth_user_id\s*=\s*auth\.uid\(\)/i,
    'sem isto, um colaborador insere batida no nome de qualquer um pela API')
  // ⚠️ `auth_user_id` sozinho não protege o que importa: a batida sairia com a conta certa e o
  // FUNCIONÁRIO errado, e é `worker_id` que nomeia a pessoa no espelho, na folha e no relatório.
  assert.match(ins![0], /from public\.workers[\s\S]*payload->>'authUserId'\s*=\s*auth\.uid\(\)::text/i,
    'o worker_id precisa ser amarrado ao vínculo daquela conta')
})

test('🔴 o NSR não usa `for update` com agregação — essa forma nem roda no Postgres', async () => {
  const sql = await sqlDoPonto()
  const fn = semComentarios(sql).match(/function public\.ponto_atribuir_nsr\(\)[\s\S]*?\$fn\$;/i)
  assert.ok(fn, 'o gatilho de NSR precisa existir')
  assert.doesNotMatch(fn![0], /for update/i,
    '"FOR UPDATE is not allowed with aggregate functions" — TODO insert falharia')
  assert.match(fn![0], /pg_advisory_xact_lock/i,
    'a serialização por organização tem de existir, ou dois celulares colidem no índice único')
})

test('🔴 um gatilho congela a prova — UPDATE não reescreve hora, tipo nem dono', async () => {
  const sql = await sqlDoPonto()
  const fn = semComentarios(sql).match(/function public\.ponto_congelar_prova\(\)[\s\S]*?\$fn\$;/i)
  assert.ok(fn, 'sem este gatilho, "inalterável" é só um comentário')
  for (const col of ['worker_id', 'auth_user_id', 'tipo', 'data', 'momento_dispositivo', 'nsr', 'origem']) {
    assert.ok(fn![0].includes(`new.${col}`) && fn![0].includes(`old.${col}`),
      `${col} tem de ser devolvido ao valor antigo em todo UPDATE`)
  }
  assert.match(sql, /create trigger trg_ponto_congelar before update/i)
})

test('🔴 o autor pode reenviar a própria batida — o upsert da fila vira UPDATE', async () => {
  const sql = await sqlDoPonto()
  assert.match(sql, /create policy ponto_update_autor_reenvio/i,
    'todo insert do storeSync é upsert: sem policy de UPDATE para o autor, um ACK perdido vira '
    + '42501 eterno numa batida que JÁ está gravada no servidor')
})

test('🔴 a cerca de leitura do colaborador existe e não deixa `workers` aberto', async () => {
  const sql = await readFile(
    new URL('../../../supabase/migrations/20260918160000_colaborador_so_o_ponto.sql', import.meta.url), 'utf8')
  assert.match(sql, /as restrictive for select/i,
    'tem de ser RESTRITIVA: permissiva seria somada com OR e não barraria nada')
  assert.match(sql, /create policy colaborador_so_o_proprio_cadastro on public\.workers[\s\S]*?payload->>'authUserId'\s*=\s*auth\.uid\(\)::text/i,
    '`workers` carrega grossSalary e hourlyRate de toda a empresa dentro do payload')
  // A lista de exceções não pode conter tabela de dado da empresa.
  const liberadas = sql.match(/liberadas text\[\] := array\[([\s\S]*?)\]/i)
  assert.ok(liberadas, 'a lista de exceções precisa estar explícita')
  for (const proibida of ['financeiro', 'medicao', 'rdo', 'notas_fiscais', 'timecards', 'shifts']) {
    assert.ok(!liberadas![1].includes(proibida), `${proibida} não pode estar liberada ao colaborador`)
  }
})

test('🔴 o cliente não puxa a empresa inteira para o celular do colaborador', async () => {
  const appMode = await fonte('../../store/appModeStore.ts')
  assert.match(appMode, /function defsDoPapel[\s\S]*?colaborador[\s\S]*?key === 'ponto'/,
    'sem o recorte, abrir a tela do ponto baixa cadastro com salário, financeiro e medições')
})
