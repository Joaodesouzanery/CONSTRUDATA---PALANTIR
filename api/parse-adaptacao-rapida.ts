/* eslint-disable @typescript-eslint/no-explicit-any */

const SCHEMA_DESCRIPTION = `
Você é um assistente de implantação de obras no ConstruData.
Extraia informações de documentos de obra, propostas, planilhas, fotos e prints.
Retorne somente JSON válido, em português do Brasil, com acentos corretos.

Procure especialmente:
- obra, contratante, endereço, cidade, número da proposta/orçamento/contrato
- escopo técnico, etapas executivas, unidades, quantitativos, critérios de medição
- percentuais por etapa, valores por m²/ml/unidade, mão de obra, equipe, insumos, fornecedores
- fotos, condições do local, substrato, liberação de área, aceite e qualidade
- o que precisa ser lançado no RDO e como adaptar quando não houver campo específico

Nunca invente dado ausente. Se algo não estiver no documento, coloque em missing.
`

const rdoMappingSchema = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    field: { type: 'string' },
    howToUse: { type: 'string' },
    required: { type: 'boolean' },
    support: { type: 'string', enum: ['native', 'adapted', 'external'] },
  },
  required: ['item', 'field', 'howToUse', 'required', 'support'],
}

const analysisSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    found: { type: 'array', items: { type: 'string' } },
    missing: { type: 'array', items: { type: 'string' } },
    destinations: { type: 'array', items: { type: 'string' } },
    rdoMappings: { type: 'array', items: rdoMappingSchema },
    confidence: { type: 'number' },
  },
  required: ['summary', 'found', 'missing', 'destinations', 'rdoMappings', 'confidence'],
}

const extractTool = {
  type: 'function',
  function: {
    name: 'extract_quick_adaptation',
    description: 'Extrai diagnóstico de adaptação rápida de obra para o ConstruData',
    parameters: analysisSchema,
  },
}

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) return { mimeType: 'image/jpeg', base64: dataUrl }
  return { mimeType: match[1] || 'image/jpeg', base64: match[2] || '' }
}

const fallbackNoAi = () => ({
  summary: 'Leitura por IA/OCR indisponível. Configure a chave de IA para extrair informações de imagens e complementar documentos.',
  found: [],
  missing: ['Leitura completa por IA/OCR'],
  destinations: ['RDO', 'Qualidade', 'Projetos / Torre de Controle'],
  rdoMappings: [
    {
      item: 'Arquivo enviado',
      field: 'Fotos, anexos ou observações do RDO',
      howToUse: 'Manter o arquivo como evidência e revisar manualmente até a chave de IA/OCR estar configurada.',
      required: false,
      support: 'adapted',
    },
  ],
  confidence: 0,
  aiUnavailable: true,
})

const callGemini = async ({ mode, image_base64, text, filename }: any) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const parts: any[] = [
    {
      text:
        `${SCHEMA_DESCRIPTION}\nArquivo: ${filename}\n` +
        'Retorne somente JSON válido no schema solicitado. Sem markdown.',
    },
  ]

  if (mode === 'image') {
    const image = parseDataUrl(image_base64)
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } })
  } else {
    parts.push({ text: `Texto extraído do documento:\n\n${text}` })
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0,
          response_mime_type: 'application/json',
          response_schema: analysisSchema,
        },
      }),
    },
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error?.message || `Gemini retornou ${response.status}`)
  const jsonText = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!jsonText) throw new Error('Gemini não retornou JSON estruturado')
  return JSON.parse(jsonText)
}

const callLovable = async ({ mode, image_base64, text, filename }: any) => {
  const apiKey = process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_API_KEY
  if (!apiKey) throw new Error('LOVABLE_API_KEY/AI_GATEWAY_API_KEY não configurada')

  const userContent: any[] = []
  if (mode === 'image') {
    userContent.push({
      type: 'text',
      text: `Leia completamente esta imagem de documento/print de obra: ${filename}. Extraia textos, tabelas, valores, percentuais e recomendações de RDO.`,
    })
    userContent.push({ type: 'image_url', image_url: { url: image_base64 } })
  } else {
    userContent.push({ type: 'text', text: `Extraia o diagnóstico deste documento: ${filename}\n\n${text}` })
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
      tool_choice: { type: 'function', function: { name: 'extract_quick_adaptation' } },
    }),
  })

  if (!aiResp.ok) {
    const errText = await aiResp.text()
    throw new Error(errText || 'Erro ao processar com IA')
  }

  const data = await aiResp.json()
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall?.function?.arguments) throw new Error('IA não retornou dados estruturados')
  return JSON.parse(toolCall.function.arguments)
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const { mode, image_base64, text, filename, kind } = req.body || {}

    if (mode === 'image') {
      if (!image_base64) return res.status(400).json({ error: 'image_base64 é obrigatório' })
    } else if (mode === 'text') {
      if (!text) return res.status(400).json({ error: 'text é obrigatório' })
    } else {
      return res.status(400).json({ error: 'mode inválido' })
    }

    if (!process.env.GEMINI_API_KEY && !process.env.LOVABLE_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
      return res.status(200).json({ data: fallbackNoAi() })
    }

    const data = process.env.GEMINI_API_KEY
      ? await callGemini({ mode, image_base64, text, filename, kind })
      : await callLovable({ mode, image_base64, text, filename, kind })

    return res.status(200).json({ data })
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro desconhecido' })
  }
}
