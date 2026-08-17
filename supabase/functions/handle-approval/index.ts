/**
 * handle-approval — Edge Function que processa cliques de Aprovar/Rejeitar vindos do email.
 *
 * O gerente clica no link do email → esta function valida o token,
 * executa approve_pending_action() ou reject_pending_action() no Supabase,
 * e retorna uma página HTML de confirmação.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { parecerTokenAntigo, verificarTokenAprovacao } from '../_shared/approvalToken.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.construdata.software'
/** Mesmo segredo usado por notify-approval para assinar. Sem ele, nada é aceito. */
const APPROVAL_TOKEN_SECRET = Deno.env.get('APPROVAL_TOKEN_SECRET') ?? ''

function htmlPage(title: string, message: string, success: boolean) {
  const color = success ? '#16a34a' : '#dc2626'
  const icon = success ? '&#10003;' : '&#10007;'
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Atlantico ConstruData</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#1f1f1f; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#f5f5f5; }
    .card { background:#2c2c2c; border:1px solid #525252; border-radius:16px; padding:48px; text-align:center; max-width:420px; width:90%; }
    .icon { width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 24px; font-size:28px; color:white; background:${color}; }
    h1 { margin:0 0 8px; font-size:20px; }
    p { color:#a3a3a3; font-size:14px; line-height:1.5; margin:0 0 24px; }
    a { display:inline-block; padding:12px 24px; background:#f97316; color:white; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; }
    a:hover { opacity:0.9; }
    .footer { margin-top:32px; font-size:11px; color:#525252; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${APP_URL}/app/aprovacoes">Abrir Plataforma</a>
    <div class="footer">Atlantico ConstruData</div>
  </div>
</body>
</html>`
}

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const action = url.searchParams.get('action') // 'approve' or 'reject'

    if (!token || !action || !['approve', 'reject'].includes(action)) {
      return new Response(htmlPage('Link Invalido', 'Este link de aprovacao e invalido ou esta incompleto.', false), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Confere a ASSINATURA antes de qualquer outra coisa. Este endpoint é anônimo e o que vem
    // depois roda com service_role — ler o conteúdo de um token não verificado seria confiar
    // em dado do atacante. Ver _shared/approvalToken.ts para o que isto conserta.
    const verificacao = await verificarTokenAprovacao(token, APPROVAL_TOKEN_SECRET)

    if (!verificacao.ok) {
      // Uma mensagem por motivo — mas nenhuma revela se a pendência existe. Quem forja não
      // aprende nada além de "não passou".
      const porMotivo: Record<string, { titulo: string; texto: string; status: number }> = {
        'sem-segredo': {
          titulo: 'Aprovacao indisponivel',
          texto: 'A aprovacao por e-mail nao esta configurada neste ambiente. Aprove pela plataforma.',
          status: 503,
        },
        expirado: {
          titulo: 'Link Expirado',
          texto: 'Este link de aprovacao expirou. Solicite uma nova aprovacao na plataforma.',
          status: 410,
        },
      }
      const padrao = parecerTokenAntigo(token)
        ? {
            titulo: 'Link de uma versao anterior',
            texto: 'Este e-mail foi enviado antes de os links passarem a ser assinados e nao vale mais. '
              + 'Abra a plataforma para aprovar — a pendencia continua la.',
            status: 410,
          }
        : { titulo: 'Token Invalido', texto: 'O token de aprovacao e invalido.', status: 400 }

      const { titulo, texto, status } = porMotivo[verificacao.motivo] ?? padrao
      console.warn(`[handle-approval] token recusado (${verificacao.motivo})`)
      return new Response(htmlPage(titulo, texto, false), {
        status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const payload = verificacao.conteudo

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check if action still exists and is pending
    const { data: pendingAction } = await supabase
      .from('pending_actions')
      .select('id, status, action_type')
      .eq('id', payload.action_id)
      .single()

    if (!pendingAction) {
      return new Response(htmlPage('Acao Nao Encontrada', 'Esta solicitacao de aprovacao nao foi encontrada no sistema.', false), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (pendingAction.status !== 'pending') {
      const statusLabel = pendingAction.status === 'approved' ? 'aprovada' : 'rejeitada'
      return new Response(htmlPage('Ja Processada', `Esta solicitacao ja foi ${statusLabel} anteriormente.`, false), {
        status: 409,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Executa com service_role (ignora RLS de propósito — não há sessão de usuário aqui).
    //
    // NÃO EXISTE MAIS ATALHO EM CASO DE ERRO. Antes, se a RPC falhasse, o código dava um UPDATE
    // direto marcando "approved" e a tela dizia que tinha dado certo. Só que a RPC não é um
    // detalhe de implementação: é ela que APLICA o efeito da aprovação (o DELETE da linha
    // alvo). Marcar o status por fora deixava a pendência como aprovada sem nada ter sido
    // executado — e ninguém ficava sabendo, porque a tela mentia. Falhar visível é melhor.
    const { error } = action === 'approve'
      ? await supabase.rpc('approve_pending_action_service', { p_action_id: payload.action_id })
      : await supabase.rpc('reject_pending_action_service', {
          p_action_id: payload.action_id,
          p_reason: 'Rejeitado via email',
        })

    if (error) {
      console.error(`[handle-approval] RPC ${action} falhou para ${payload.action_id}:`, error.message)
      return new Response(htmlPage(
        'Nao foi possivel concluir',
        'A solicitacao NAO foi processada. Abra a plataforma e conclua por la — a pendencia continua aberta.',
        false,
      ), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new Response(
      action === 'approve'
        ? htmlPage('Acao Aprovada', 'A solicitacao foi aprovada com sucesso. A acao sera executada automaticamente na plataforma.', true)
        : htmlPage('Acao Rejeitada', 'A solicitacao foi rejeitada. O solicitante sera notificado na plataforma.', false),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  } catch (err) {
    console.error('handle-approval error:', err)
    return new Response(htmlPage('Erro', 'Ocorreu um erro ao processar sua solicitacao. Tente novamente na plataforma.', false), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
})
