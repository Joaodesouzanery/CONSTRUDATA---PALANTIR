/**
 * notify-approval — Edge Function que envia email ao aprovador quando uma pending_action é criada.
 *
 * Triggered via database webhook (pg_net) ou chamada direta do frontend.
 * Envia email via Resend com botões Aprovar/Rejeitar que apontam para handle-approval.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.construdata.software'

const ACTION_LABELS: Record<string, string> = {
  delete_fvs:           'Excluir FVS (Ficha de Verificação)',
  update_fvs_closed:    'Editar FVS fechada',
  delete_rdo:           'Excluir RDO',
  update_rdo_closed:    'Editar RDO fechado',
  delete_po:            'Excluir Ordem de Compra',
  update_po_approved:   'Editar OC aprovada',
  delete_invoice:       'Excluir Nota Fiscal',
  delete_plan_scenario: 'Excluir cenário de Planejamento',
  delete_plan_trecho:   'Excluir trecho do Planejamento',
  approve_budget:       'Aprovar orçamento',
  delete_project:       'Excluir projeto',
  delete_organization:  'Excluir organização',
}

serve(async (req) => {
  try {
    const { record } = await req.json()
    // record = the newly inserted pending_action row

    if (!record?.id || !record?.organization_id) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Find the requester's name
    const { data: requester } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', record.requested_by)
      .single()

    // 2. Find the approver(s) — profiles with the required role in the same org
    const { data: approvers } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', record.organization_id)
      .eq('role', record.required_role)

    if (!approvers?.length) {
      console.log('No approvers found for role:', record.required_role)
      return new Response(JSON.stringify({ message: 'No approvers found' }), { status: 200 })
    }

    if (!RESEND_API_KEY) {
      console.log('RESEND_API_KEY not configured — skipping email')
      return new Response(JSON.stringify({ message: 'Email not configured' }), { status: 200 })
    }

    // 3. Generate secure token (simple base64 encoding of action_id — in production, use JWT)
    const token = btoa(JSON.stringify({
      action_id: record.id,
      org_id: record.organization_id,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    }))

    const approveUrl = `${SUPABASE_URL}/functions/v1/handle-approval?token=${encodeURIComponent(token)}&action=approve`
    const rejectUrl = `${SUPABASE_URL}/functions/v1/handle-approval?token=${encodeURIComponent(token)}&action=reject`
    const platformUrl = `${APP_URL}/app/aprovacoes`

    const actionLabel = ACTION_LABELS[record.action_type] || record.action_type
    const requesterName = requester?.full_name || 'Um membro da equipe'

    // 4. Send email to each approver
    for (const approver of approvers) {
      if (!approver.email) continue

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #1f1f1f; color: #f5f5f5; border-radius: 12px; overflow: hidden;">
          <div style="background: #2c2c2c; padding: 24px; border-bottom: 2px solid #f97316;">
            <h2 style="margin: 0; font-size: 18px; color: #f97316;">Pedido de Aprovacao</h2>
            <p style="margin: 4px 0 0; font-size: 12px; color: #a3a3a3;">Atlantico ConstruData</p>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px; font-size: 14px; color: #e5e5e5;">
              Ola <strong>${approver.full_name || 'Aprovador'}</strong>,
            </p>
            <p style="margin: 0 0 16px; font-size: 14px; color: #e5e5e5;">
              <strong>${requesterName}</strong> solicitou aprovacao para:
            </p>
            <div style="background: #2c2c2c; border: 1px solid #525252; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #f5f5f5;">${actionLabel}</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #a3a3a3;">
                Tabela: ${record.target_table} | ID: ${record.target_id}
              </p>
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
              <a href="${approveUrl}" style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Aprovar
              </a>
              <a href="${rejectUrl}" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Rejeitar
              </a>
            </div>
            <p style="margin: 0; font-size: 12px; color: #6b6b6b;">
              Ou acesse a plataforma para mais detalhes:
              <a href="${platformUrl}" style="color: #f97316;">${platformUrl}</a>
            </p>
            <p style="margin: 16px 0 0; font-size: 11px; color: #525252;">
              Este pedido expira em 7 dias. Se voce nao reconhece essa solicitacao, ignore este email.
            </p>
          </div>
        </div>
      `

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Atlantico ConstruData <notificacoes@construdata.software>',
          to: [approver.email],
          subject: `Aprovacao necessaria: ${actionLabel}`,
          html,
        }),
      })

      console.log(`Email sent to ${approver.email} for action ${record.id}`)
    }

    return new Response(JSON.stringify({ success: true, sent: approvers.length }), { status: 200 })
  } catch (err) {
    console.error('notify-approval error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
