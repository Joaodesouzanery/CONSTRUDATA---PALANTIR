import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ADMIN_PROVISION_SECRET = Deno.env.get('ADMIN_PROVISION_SECRET') ?? ''
const PLATFORM_ADMIN_PROFILE_ID = Deno.env.get('PLATFORM_ADMIN_PROFILE_ID') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.construdata.software'

type Payload = {
  organization_name?: string
  owner_email?: string
  plan?: string
  max_users?: number
  max_projects?: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function slugify(value: string) {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'empresa'
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes = 24) {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return Array.from(data).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const providedSecret = req.headers.get('x-admin-secret') ?? ''
  if (!ADMIN_PROVISION_SECRET || providedSecret !== ADMIN_PROVISION_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PLATFORM_ADMIN_PROFILE_ID) {
    return json({ error: 'missing_server_configuration' }, 500)
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const organizationName = payload.organization_name?.trim()
  const ownerEmail = payload.owner_email?.trim().toLowerCase()
  if (!organizationName || organizationName.length < 2) {
    return json({ error: 'organization_name_required' }, 400)
  }
  if (!ownerEmail || !ownerEmail.includes('@')) {
    return json({ error: 'owner_email_required' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const baseSlug = slugify(organizationName)
  let slug = baseSlug
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingOrg) slug = `${baseSlug}-${randomHex(3)}`

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: organizationName,
      slug,
      plan: payload.plan ?? 'free',
      max_users: payload.max_users ?? 5,
      max_projects: payload.max_projects ?? 3,
    })
    .select('id, name, slug')
    .single()

  if (orgError || !org) {
    console.error('[admin-provision] organization insert failed', orgError)
    return json({ error: 'organization_insert_failed' }, 400)
  }

  const token = randomHex(24)
  const tokenHash = await sha256Hex(token)

  const { data: invitation, error: invitationError } = await supabase
    .from('invitations')
    .insert({
      organization_id: org.id,
      email: ownerEmail,
      role: 'owner',
      invited_by: PLATFORM_ADMIN_PROFILE_ID,
      token: `hash:${tokenHash.slice(0, 48)}`,
      token_hash: tokenHash,
    })
    .select('id')
    .single()

  if (invitationError || !invitation) {
    await supabase.from('organizations').update({ deleted_at: new Date().toISOString() }).eq('id', org.id)
    console.error('[admin-provision] invitation insert failed', invitationError)
    return json({ error: 'invitation_insert_failed' }, 400)
  }

  await supabase.from('audit_log').insert({
    organization_id: org.id,
    actor_id: PLATFORM_ADMIN_PROFILE_ID,
    action: 'admin_provision_company',
    table_name: 'organizations',
    record_id: org.id,
    after: {
      organization_name: organizationName,
      owner_email: ownerEmail,
      invitation_id: invitation.id,
      slug,
    },
  })

  return json({
    organization: org,
    invitation_id: invitation.id,
    owner_email: ownerEmail,
    invitation_url: `${APP_URL}/aceitar-convite?token=${token}`,
  })
})
