/**
 * approvalToken.ts — assina e confere o token dos links "Aprovar / Rejeitar" do e-mail.
 *
 * ─── O QUE ESTAVA ERRADO ──────────────────────────────────────────────────────────────────
 * O token era `btoa(JSON.stringify({action_id, org_id, exp}))`: base64 puro, sem assinatura.
 * O próprio código que o gerava admitia, em comentário, que era provisório. Do outro lado, a
 * `handle-approval` decodificava, conferia só a validade, e chamava
 * `approve_pending_action_service` **com a service_role** — que executa
 * `EXECUTE format('DELETE FROM public.%I WHERE id = $1', ...)`.
 *
 * Ou seja: qualquer pessoa que soubesse o UUID de uma pendência montava o link à mão, sem
 * sessão e sem segredo, e aprovava — inclusive de outra organização. E quem já tivesse
 * recebido um e-mail legítimo podia decodificar o próprio token, esticar o `exp` para daqui a
 * dez anos e reusá-lo à vontade. O que segurava era o UUID não ser enumerável pela API (o RLS
 * de `pending_actions` cobre) e a checagem de `status <> 'pending'`, que impede reaprovar o
 * que já foi processado. Barreira fina demais para uma operação que roda com service_role.
 *
 * ─── COMO FICA ────────────────────────────────────────────────────────────────────────────
 * `<payload em base64url>.<HMAC-SHA256 do payload em base64url>`, com um segredo que só o
 * servidor conhece (`APPROVAL_TOKEN_SECRET`). Sem o segredo não dá para forjar, e mexer em
 * qualquer campo — inclusive no `exp` — invalida a assinatura.
 *
 * Duas decisões que valem explicação:
 *
 *  - **A comparação é de tempo constante.** Um `===` entre strings sai no primeiro byte
 *    diferente, e essa diferença de tempo, medida muitas vezes, revela a assinatura byte a
 *    byte. Aqui o XOR percorre o comprimento inteiro sempre.
 *
 *  - **Sem o segredo configurado, tudo é recusado.** É deliberado: um token de aprovação que
 *    "funciona mesmo sem chave" é exatamente o buraco que estamos fechando. A função avisa nos
 *    logs; a alternativa (aceitar sem verificar) reproduziria o problema em silêncio.
 *
 * ─── ATENÇÃO NA VIRADA ────────────────────────────────────────────────────────────────────
 * Os e-mails já enviados carregam token antigo, sem assinatura, e passam a ser recusados —
 * eles valiam sete dias. É o comportamento correto (falhar fechado), mas quem receber um
 * desses vê um erro. `parecerTokenAntigo` existe só para a tela dizer "use a plataforma" em
 * vez de "token inválido", que mandaria a pessoa procurar defeito onde não há.
 */

const codificador = new TextEncoder()

function paraBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(texto: string): Uint8Array {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const preenchido = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const bruto = atob(preenchido)
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0))
}

async function assinar(dados: string, segredo: string): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey(
    'raw', codificador.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', chave, codificador.encode(dados)))
}

/** Compara sem vazar, pelo tempo de execução, quantos bytes bateram. */
function iguaisEmTempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i]
  return diferenca === 0
}

export type ConteudoAprovacao = {
  action_id: string
  org_id: string
  exp: number
}

export async function gerarTokenAprovacao(conteudo: ConteudoAprovacao, segredo: string): Promise<string> {
  if (!segredo) throw new Error('APPROVAL_TOKEN_SECRET ausente — não é possível assinar o link de aprovação')
  const corpo = paraBase64Url(codificador.encode(JSON.stringify(conteudo)))
  return `${corpo}.${paraBase64Url(await assinar(corpo, segredo))}`
}

export type ResultadoVerificacao =
  | { ok: true; conteudo: ConteudoAprovacao }
  | { ok: false; motivo: 'sem-segredo' | 'formato' | 'assinatura' | 'expirado' }

export async function verificarTokenAprovacao(token: string, segredo: string): Promise<ResultadoVerificacao> {
  if (!segredo) return { ok: false, motivo: 'sem-segredo' }

  const partes = token.split('.')
  if (partes.length !== 2) return { ok: false, motivo: 'formato' }
  const [corpo, assinaturaRecebida] = partes

  let esperada: Uint8Array
  let recebida: Uint8Array
  try {
    esperada = await assinar(corpo, segredo)
    recebida = deBase64Url(assinaturaRecebida)
  } catch {
    return { ok: false, motivo: 'formato' }
  }
  // A assinatura é conferida ANTES de olhar o conteúdo: sem isso, um payload forjado já teria
  // sido lido (e talvez usado numa mensagem de erro) antes de ser rejeitado.
  if (!iguaisEmTempoConstante(esperada, recebida)) return { ok: false, motivo: 'assinatura' }

  let conteudo: ConteudoAprovacao
  try {
    conteudo = JSON.parse(new TextDecoder().decode(deBase64Url(corpo)))
  } catch {
    return { ok: false, motivo: 'formato' }
  }
  if (typeof conteudo?.action_id !== 'string' || typeof conteudo?.exp !== 'number') {
    return { ok: false, motivo: 'formato' }
  }
  if (conteudo.exp < Date.now()) return { ok: false, motivo: 'expirado' }

  return { ok: true, conteudo }
}

/**
 * O token veio de um e-mail gerado antes da assinatura existir? Serve só para escolher a
 * mensagem na tela — nunca para aceitar o token.
 */
export function parecerTokenAntigo(token: string): boolean {
  if (token.includes('.')) return false
  try {
    const conteudo = JSON.parse(atob(token))
    return typeof conteudo?.action_id === 'string'
  } catch {
    return false
  }
}
