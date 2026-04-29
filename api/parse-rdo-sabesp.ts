/* eslint-disable @typescript-eslint/no-explicit-any */

const SCHEMA_DESCRIPTION = `
Extraia os dados de um Relatorio Diario de Obra (RDO) da SABESP - Consorcio Se Liga Na Rede.
Retorne SEMPRE pelo tool call no schema fornecido. Se um campo nao estiver presente, deixe vazio.

Campos:
- report_date: data no formato YYYY-MM-DD
- encarregado, rua_beco
- criadouro: 'sao_manoel' | 'morro_do_teteu' | 'joao_carlos' | 'pantanal_baixo' | 'vila_israel' | 'outro'
- epi_utilizado
- condicoes_climaticas: { manha, tarde, noite }
- qualidade: { ordem_servico, bandeirola, projeto, obs }
- paralisacoes, horarios, mao_de_obra, equipamentos
- servicos_esgoto, servicos_agua
- observacoes, responsavel_empreiteira, responsavel_consorcio
- assinatura_empreiteira_presente, assinatura_consorcio_presente
`

const bboxSchema = {
  type: 'object',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
  },
}

const extractTool = {
  type: 'function',
  function: {
    name: 'extract_rdo_sabesp',
    description: 'Extrai dados estruturados de um RDO Sabesp',
    parameters: {
      type: 'object',
      properties: {
        report_date: { type: 'string' },
        encarregado: { type: 'string' },
        rua_beco: { type: 'string' },
        criadouro: { type: 'string' },
        criadouro_outro: { type: 'string' },
        epi_utilizado: { type: 'boolean' },
        condicoes_climaticas: {
          type: 'object',
          properties: {
            manha: { type: 'string' },
            tarde: { type: 'string' },
            noite: { type: 'string' },
          },
        },
        qualidade: {
          type: 'object',
          properties: {
            ordem_servico: { type: 'boolean' },
            bandeirola: { type: 'boolean' },
            projeto: { type: 'boolean' },
            obs: { type: 'string' },
          },
        },
        paralisacoes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              motivo: { type: 'string' },
              descricao: { type: 'string' },
            },
          },
        },
        paralisacao_outro: { type: 'string' },
        horarios: {
          type: 'object',
          properties: {
            diurno: { type: 'object', properties: { inicio: { type: 'string' }, fim: { type: 'string' } } },
            noturno: { type: 'object', properties: { inicio: { type: 'string' }, fim: { type: 'string' } } },
          },
        },
        mao_de_obra: {
          type: 'array',
          items: { type: 'object', properties: { cargo: { type: 'string' }, terc: { type: 'number' }, contrat: { type: 'number' } } },
        },
        equipamentos: {
          type: 'array',
          items: { type: 'object', properties: { descricao: { type: 'string' }, terc: { type: 'number' }, contrat: { type: 'number' } } },
        },
        servicos_esgoto: {
          type: 'array',
          items: { type: 'object', properties: { codigo: { type: 'string' }, descricao: { type: 'string' }, unidade: { type: 'string' }, quantidade: { type: 'number' }, opcoes: { type: 'array', items: { type: 'string' } } } },
        },
        servicos_agua: {
          type: 'array',
          items: { type: 'object', properties: { codigo: { type: 'string' }, descricao: { type: 'string' }, unidade: { type: 'string' }, quantidade: { type: 'number' }, opcoes: { type: 'array', items: { type: 'string' } } } },
        },
        observacoes: { type: 'string' },
        responsavel_empreiteira: { type: 'string' },
        responsavel_consorcio: { type: 'string' },
        assinatura_empreiteira_presente: { type: 'boolean' },
        assinatura_consorcio_presente: { type: 'boolean' },
        assinatura_empreiteira_bbox: bboxSchema,
        assinatura_consorcio_bbox: bboxSchema,
        confidence_by_field: { type: 'object', additionalProperties: { type: 'number' } },
      },
      required: ['report_date'],
    },
  },
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' })

  const apiKey = process.env.LOVABLE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'LOVABLE_API_KEY nao configurada no Vercel' })
  }

  try {
    const { mode, image_base64, text } = req.body || {}
    const userContent: any[] = []

    if (mode === 'image') {
      if (!image_base64) return res.status(400).json({ error: 'image_base64 e obrigatorio' })
      userContent.push({
        type: 'text',
        text: 'Esta e uma foto de uma planilha RDO Sabesp preenchida a mao. Leia o formulario inteiro, inclusive marcacoes, quantidades manuscritas e observacoes.',
      })
      userContent.push({ type: 'image_url', image_url: { url: image_base64 } })
    } else if (mode === 'text') {
      if (!text) return res.status(400).json({ error: 'text e obrigatorio' })
      userContent.push({ type: 'text', text: `Extraia os campos deste RDO Sabesp enviado por texto:\n\n${text}` })
    } else {
      return res.status(400).json({ error: 'mode invalido' })
    }

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SCHEMA_DESCRIPTION },
          { role: 'user', content: userContent },
        ],
        tools: [extractTool],
        tool_choice: { type: 'function', function: { name: 'extract_rdo_sabesp' } },
      }),
    })

    if (!aiResp.ok) {
      const errText = await aiResp.text()
      return res.status(aiResp.status).json({ error: errText || 'Erro ao processar com IA' })
    }

    const data = await aiResp.json()
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall?.function?.arguments) {
      return res.status(500).json({ error: 'IA nao retornou dados estruturados' })
    }

    return res.status(200).json({ data: JSON.parse(toolCall.function.arguments) })
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro desconhecido' })
  }
}
