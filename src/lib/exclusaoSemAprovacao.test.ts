/**
 * A aprovação não pode voltar — e o teste varre o código-fonte para garantir.
 *
 * Contexto: `request_action` NUNCA apagou nada. Ele só insere uma linha em `pending_actions`; o
 * registro sumia da tela, voltava no pull seguinte, e o pedido ia para uma fila que não tem link
 * em menu nenhum e que o próprio autor não pode aprovar (o servidor proíbe autoaprovação, mesmo
 * para o dono). Numa empresa de conta única, era um buraco negro.
 *
 * Pior: em três dos quatro usos a intenção não era nem apagar — `type: 'delete'` era só o veículo
 * para chamar o RPC. Resolver uma restrição do LPS e editar uma ordem de compra fechada
 * simplesmente não gravavam.
 *
 * Este teste lê os arquivos e falha se alguém reintroduzir o padrão.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// `fileURLToPath`, não `URL.pathname`: o caminho deste projeto tem espaço ("VS CODE") e o
// pathname devolveria "%20", que o `readdirSync` não encontra.
const RAIZ = fileURLToPath(new URL('../..', import.meta.url))
const SRC = join(RAIZ, 'src')

/** Todos os .ts/.tsx de src/, menos os próprios testes. */
function fontes(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) fontes(p, acc)
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) acc.push(p)
  }
  return acc
}

/** Tira comentários de linha e de bloco — o padrão antigo é documentado em ~45 comentários. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const ARQUIVOS = fontes(SRC)

test('nenhum store enfileira op com approvalActionType', () => {
  const culpados = ARQUIVOS.filter((f) => /approvalActionType\s*:/.test(semComentarios(readFileSync(f, 'utf8'))))
  assert.deepEqual(
    culpados.map((f) => f.replace(RAIZ, '')), [],
    'approvalActionType voltou a ser preenchido. Ele não apaga nada — é um pedido numa fila que '
    + 'ninguém vê e que o autor não pode aprovar. Use soft delete (deleted_at) direto.',
  )
})

test('nenhuma tela ou store chama o RPC request_action', () => {
  // A definição de tipo gerada do banco (database.ts) pode continuar citando o RPC: ela descreve
  // o que o servidor oferece, não o que o app usa.
  const culpados = ARQUIVOS
    .filter((f) => !f.endsWith('database.ts'))
    .filter((f) => /rpc\(\s*['"]request_action['"]/.test(semComentarios(readFileSync(f, 'utf8'))))
  assert.deepEqual(
    culpados.map((f) => f.replace(RAIZ, '')), [],
    'request_action voltou. Ele só cria uma linha em pending_actions — não altera o registro.',
  )
})

test('o storeSync ainda reconhece ops de aprovação antigas, para poder descartá-las', () => {
  // O campo continua declarado de propósito: quem tem uma op dessas presa no localStorage precisa
  // que ela SAIA da fila. Se este teste falhar, alguém removeu o campo e essas ops vão girar para
  // sempre num app que não sabe mais o que elas são.
  const src = readFileSync(join(SRC, 'lib/storeSync.ts'), 'utf8')
  assert.match(src, /approvalActionType\?:\s*string/, 'o campo legado sumiu de PendingOp')
  assert.match(semComentarios(src), /op\.approvalActionType/, 'o storeSync não descarta mais a op legada')
})

test('o soft delete confere o deleted_at, não a visibilidade da linha', () => {
  // A conferência antiga perguntava "a linha ainda aparece?". A migração 20260824130000 tira o
  // filtro `deleted_at IS NULL` do SELECT de 18 tabelas — porque era ELE que impedia o soft delete
  // (o Postgres recusa um UPDATE que torne a linha invisível ao próprio SELECT). Com o filtro
  // fora, "ainda aparece" virou o normal, e a pergunta antiga daria falso positivo para sempre.
  const src = semComentarios(readFileSync(join(SRC, 'lib/storeSync.ts'), 'utf8'))
  assert.match(src, /\.select\('deleted_at'\)/, 'a conferência não lê mais o deleted_at')
  assert.doesNotMatch(src, /aindaVisivel/, 'a conferência por visibilidade voltou')
})
