/**
 * fcp-webhook — a porta do n8n para lançar produção realizada no Fluxo de Caixa Projetado.
 *
 * O caso de uso: o cliente já tem um fluxo no n8n que recebe a produção do dia (por planilha, por
 * formulário, por integração com o sistema da concessionária). Em vez de alguém redigitar no app,
 * o n8n bate aqui e o FCP recalcula sozinho — medição, recebimento, capital necessário.
 *
 * ⚠️ **A escrita passa pela RPC `fcp_lancar_producao`, nunca por UPDATE direto.** Só assim a
 * marca de origem entra no `audit_log` na mesma transação: `set_config(..., true)` tem escopo de
 * TRANSAÇÃO, e o supabase-js não dá transação. A função dá, porque o corpo dela é uma. Sem isso a
 * marca vazaria para a próxima requisição da mesma conexão do pool, e a escrita de uma pessoa
 * sairia carimbada como n8n.
 *
 * Configuração (Supabase → Edge Functions → Secrets):
 *   FCP_WEBHOOK_SECRET   segredo compartilhado com o n8n
 *   SUPABASE_URL         (já existe)
 *   SUPABASE_SERVICE_ROLE_KEY (já existe)
 *
 * Chamada:
 *   POST /functions/v1/fcp-webhook
 *   x-webhook-secret: <FCP_WEBHOOK_SECRET>
 *   { "planoId": "uuid", "origem": "n8n:producao-diaria",
 *     "lancamentos": [ { "cidadeId": "bertioga", "semana": 3, "producao": 91.5 } ] }
 *
 *   `producao: null` APAGA o lançamento — a semana volta a usar o previsto. É diferente de 0,
 *   que quer dizer "a equipe não produziu nada".
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

interface Lancamento {
  cidadeId: string
  semana: number
  producao: number | null
}

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Comparação de segredo em tempo constante.
 *
 * `a === b` sai no primeiro byte diferente, e a diferença de tempo entre "errou no 1º caractere" e
 * "errou no 20º" é medível pela rede. Com tentativas suficientes dá para descobrir o segredo
 * caractere a caractere.
 */
function segredoConfere(recebido: string, esperado: string): boolean {
  if (recebido.length !== esperado.length) return false
  let diferenca = 0
  for (let i = 0; i < recebido.length; i++) {
    diferenca |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i)
  }
  return diferenca === 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return responder({ erro: 'Use POST.' }, 405)

  const esperado = Deno.env.get('FCP_WEBHOOK_SECRET') ?? ''
  if (!esperado) {
    // Sem segredo configurado a função fica FECHADA. Abrir por omissão seria deixar qualquer um
    // escrever no fluxo de caixa da empresa.
    return responder({ erro: 'Webhook não configurado: falta FCP_WEBHOOK_SECRET.' }, 503)
  }
  if (!segredoConfere(req.headers.get('x-webhook-secret') ?? '', esperado)) {
    return responder({ erro: 'Segredo inválido.' }, 401)
  }

  let corpo: { planoId?: string; origem?: string; lancamentos?: Lancamento[] }
  try {
    corpo = await req.json()
  } catch {
    return responder({ erro: 'Corpo não é JSON válido.' }, 400)
  }

  const planoId = corpo.planoId
  const lancamentos = corpo.lancamentos
  if (!planoId || !Array.isArray(lancamentos) || lancamentos.length === 0) {
    return responder({ erro: 'Informe planoId e ao menos um lançamento.' }, 400)
  }
  // Teto para uma requisição não virar mil escritas por engano de laço no n8n.
  if (lancamentos.length > 500) {
    return responder({ erro: 'No máximo 500 lançamentos por chamada.' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // A origem chega do n8n para o log dizer QUAL fluxo escreveu — "n8n" sozinho não ajuda quando
  // há três automações mexendo no mesmo plano.
  const origem = (corpo.origem ?? 'n8n').slice(0, 120)

  const aplicados: unknown[] = []
  const falhas: Array<{ lancamento: Lancamento; erro: string }> = []

  for (const l of lancamentos) {
    if (!l || typeof l.cidadeId !== 'string' || !Number.isInteger(l.semana)) {
      falhas.push({ lancamento: l, erro: 'cidadeId e semana (inteiro) são obrigatórios.' })
      continue
    }
    const producao = l.producao === null || l.producao === undefined ? null : Number(l.producao)
    if (producao !== null && !Number.isFinite(producao)) {
      falhas.push({ lancamento: l, erro: 'producao precisa ser número ou null.' })
      continue
    }

    const { data, error } = await supabase.rpc('fcp_lancar_producao', {
      p_plano_id: planoId,
      p_cidade_id: l.cidadeId,
      p_semana: l.semana,
      p_valor: producao,
      p_origem: origem,
    })
    if (error) falhas.push({ lancamento: l, erro: error.message })
    else aplicados.push(data)
  }

  // ⚠️ 207, não 200 nem 400: numa chamada em lote parte pode dar certo e parte não, e devolver
  // 200 faria o n8n marcar como sucesso um lote que falhou pela metade.
  const status = falhas.length === 0 ? 200 : aplicados.length === 0 ? 400 : 207
  return responder({
    plano: planoId,
    origem,
    aplicados: aplicados.length,
    falhas: falhas.length,
    detalhe: { aplicados, falhas },
  }, status)
})
