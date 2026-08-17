/**
 * checar-segredos-no-bundle.mjs — falha se algum segredo de servidor foi parar no `dist/`.
 *
 * POR QUE ISTO EXISTE. O `SECURITY.md` pede, na lista "antes de cada commit", um grep no
 * `dist/` por `service_role`. A conferência nunca esteve automatizada — dependia de alguém
 * lembrar. A `service_role` ignora todas as policies de RLS: se ela chegar ao bundle, qualquer
 * visitante da landing lê e escreve os dados de qualquer empresa. É o pior incidente possível
 * neste projeto, e o tipo de coisa que se descobre tarde.
 *
 * POR QUE NÃO É SÓ UM GREP. A chave `anon` também é um JWT e **precisa** estar no bundle — é
 * assim que o Supabase funciona. Um regex de "parece um JWT" acusaria ela em todo build, o
 * alarme viraria ruído e alguém acabaria desligando a checagem. Então aqui cada token achado é
 * decodificado e julgado pelo que ele **é**: `role: "anon"` passa, qualquer outro papel reprova.
 *
 * Uso: node scripts/checar-segredos-no-bundle.mjs [diretório]   (padrão: dist)
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const RAIZ = process.argv[2] ?? 'dist'
const EXTENSOES = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.map'])

/** Trechos que nunca têm razão de existir num arquivo servido ao navegador. */
const PROIBIDOS = [
  { termo: 'service_role', motivo: 'nome da chave que ignora o RLS' },
  { termo: 'SUPABASE_SERVICE_ROLE', motivo: 'variável de ambiente da chave de servidor' },
  { termo: 'SUPABASE_DB_PASSWORD', motivo: 'senha do banco' },
  { termo: 'ADMIN_PROVISION_SECRET', motivo: 'segredo de provisionamento de empresa' },
  { termo: 'CRON_SECRET', motivo: 'segredo do cron' },
  { termo: 'APPROVAL_TOKEN_SECRET', motivo: 'segredo que assina os links de aprovação' },
  // O e-mail do administrador da plataforma esteve no bundle até 2026-08: quem administra a
  // plataforma agora é dado do banco (`platform_admins`), consultado pela RPC is_global_admin().
  // Se este endereço reaparecer aqui, alguém voltou a decidir permissão no cliente.
  { termo: 'joaoneryflu', motivo: 'e-mail do administrador da plataforma — a decisão é do servidor' },
]

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g

async function* arquivos(dir) {
  let entradas
  try { entradas = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entradas) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) yield* arquivos(caminho)
    else if (EXTENSOES.has(extname(e.name))) yield caminho
  }
}

/** Papel declarado no JWT, ou null se não der para ler (token truncado, base64 quebrado). */
function papelDoToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch { return null }
}

const achados = []
let arquivosLidos = 0

for await (const caminho of arquivos(RAIZ)) {
  arquivosLidos += 1
  const conteudo = await readFile(caminho, 'utf8')

  for (const { termo, motivo } of PROIBIDOS) {
    if (conteudo.includes(termo)) achados.push(`${caminho}: contém "${termo}" (${motivo})`)
  }

  for (const token of conteudo.match(JWT) ?? []) {
    const papel = papelDoToken(token)
    if (papel === 'anon') continue                       // esperado: é a chave pública
    achados.push(papel
      ? `${caminho}: JWT com role "${papel}" — só "anon" pode ir para o navegador`
      : `${caminho}: JWT que não deu para decodificar — confira à mão (${token.slice(0, 24)}…)`)
  }
}

if (arquivosLidos === 0) {
  console.error(`✗ nada para checar em "${RAIZ}/" — o build rodou antes disto?`)
  process.exit(1)
}

if (achados.length > 0) {
  console.error(`✗ segredo de servidor no bundle (${achados.length} ocorrência(s)):\n`)
  for (const a of achados) console.error(`   ${a}`)
  console.error('\nRotacione a chave exposta ANTES de publicar. Ver SECURITY.md, "Se vazou".')
  process.exit(1)
}

console.log(`✓ ${arquivosLidos} arquivo(s) em ${RAIZ}/ — nenhum segredo de servidor.`)
