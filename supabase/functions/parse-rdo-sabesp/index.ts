/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SCHEMA_DESCRIPTION = `
Extrai os dados de um Relatório Diário de Obra (RDO) da SABESP - Consórcio Se Liga Na Rede.
Retorne SEMPRE no formato exato do schema fornecido. Se um campo não estiver presente, deixe-o vazio (string vazia, false ou array vazio). NUNCA invente dados.

Campos:
- report_date: data no formato YYYY-MM-DD
- encarregado: nome do encarregado
- rua_beco: rua ou beco da obra
- criadouro: um dentre 'sao_manoel' | 'morro_do_teteu' | 'joao_carlos' | 'pantanal_baixo' | 'vila_israel' | 'outro'
- criadouro_outro: texto livre quando criadouro = 'outro'
- epi_utilizado: true se TODOS estão usando EPIs
- condicoes_climaticas: { manha: 'bom'|'chuva'|'improdutivo'|'', tarde: ..., noite: ... }
- qualidade: { ordem_servico: bool, bandeirola: bool, projeto: bool, obs: string }
- paralisacoes: array de { motivo: string, descricao: string } - motivos comuns: 'Intervenção Policial', 'Chuva / Alagamento'
- paralisacao_outro: string com descrição livre quando o motivo for 'Outro'
- horarios: { diurno: { inicio: 'HH:MM', fim: 'HH:MM' }, noturno: { inicio: 'HH:MM', fim: 'HH:MM' } }
- mao_de_obra: array de { cargo: string, terc: number, contrat: number }
- equipamentos: array de { descricao: string, terc: number, contrat: number }
- servicos_esgoto: array de { codigo: string, descricao: string, unidade: string, quantidade: number }
- servicos_agua: idem
- observacoes: string
- responsavel_empreiteira: nome
- responsavel_consorcio: nome
- assinatura_empreiteira_presente: true se há assinatura visível no campo do responsável da empreiteira
- assinatura_consorcio_presente: true se há assinatura visível no campo do responsável do consórcio
`;

const BBOX_SCHEMA = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
  },
};

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_rdo_sabesp",
    description: "Extrai dados estruturados de um RDO Sabesp",
    parameters: {
      type: "object",
      properties: {
        report_date: { type: "string" },
        encarregado: { type: "string" },
        rua_beco: { type: "string" },
        criadouro: { type: "string" },
        criadouro_outro: { type: "string" },
        epi_utilizado: { type: "boolean" },
        condicoes_climaticas: {
          type: "object",
          properties: {
            manha: { type: "string" },
            tarde: { type: "string" },
            noite: { type: "string" },
          },
        },
        qualidade: {
          type: "object",
          properties: {
            ordem_servico: { type: "boolean" },
            bandeirola: { type: "boolean" },
            projeto: { type: "boolean" },
            obs: { type: "string" },
          },
        },
        paralisacoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              motivo: { type: "string" },
              descricao: { type: "string" },
            },
          },
        },
        horarios: {
          type: "object",
          properties: {
            diurno: {
              type: "object",
              properties: {
                inicio: { type: "string" },
                fim: { type: "string" },
              },
            },
            noturno: {
              type: "object",
              properties: {
                inicio: { type: "string" },
                fim: { type: "string" },
              },
            },
          },
        },
        mao_de_obra: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cargo: { type: "string" },
              terc: { type: "number" },
              contrat: { type: "number" },
            },
          },
        },
        equipamentos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              descricao: { type: "string" },
              terc: { type: "number" },
              contrat: { type: "number" },
            },
          },
        },
        servicos_esgoto: {
          type: "array",
          items: {
            type: "object",
            properties: {
              codigo: { type: "string" },
              descricao: { type: "string" },
              unidade: { type: "string" },
              quantidade: { type: "number" },
            },
          },
        },
        servicos_agua: {
          type: "array",
          items: {
            type: "object",
            properties: {
              codigo: { type: "string" },
              descricao: { type: "string" },
              unidade: { type: "string" },
              quantidade: { type: "number" },
            },
          },
        },
        observacoes: { type: "string" },
        responsavel_empreiteira: { type: "string" },
        responsavel_consorcio: { type: "string" },
        paralisacao_outro: { type: "string" },
        assinatura_empreiteira_presente: { type: "boolean" },
        assinatura_consorcio_presente: { type: "boolean" },
        assinatura_empreiteira_bbox: BBOX_SCHEMA,
        assinatura_consorcio_bbox: BBOX_SCHEMA,
        confidence_by_field: {
          type: "object",
          additionalProperties: { type: "number" },
        },
      },
      required: ["report_date"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const { mode, image_base64, text } = body as {
      mode: "image" | "text";
      image_base64?: string;
      text?: string;
    };

    if (mode !== "image" && mode !== "text") {
      return new Response(JSON.stringify({ error: "mode inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [];
    if (mode === "image") {
      if (!image_base64) {
        return new Response(
          JSON.stringify({ error: "image_base64 é obrigatório" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      userContent.push({
        type: "text",
        text:
          "Esta é uma foto de uma planilha de RDO Sabesp preenchida à mão ou impressa. Extraia todos os campos que conseguir ler.",
      });
      userContent.push({
        type: "image_url",
        image_url: { url: image_base64 },
      });
    } else {
      if (!text) {
        return new Response(JSON.stringify({ error: "text é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userContent.push({
        type: "text",
        text:
          "Esta é uma mensagem de WhatsApp com dados de um RDO Sabesp. Extraia os campos:\n\n" +
          text,
      });
    }

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SCHEMA_DESCRIPTION },
            { role: "user", content: userContent },
          ],
          tools: [EXTRACT_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "extract_rdo_sabesp" },
          },
        }),
      },
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Muitas requisições. Tente novamente em instantes.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos da IA esgotados. Adicione créditos em Configurações > Workspace > Uso.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({
          error: "IA não retornou dados estruturados. Tente novamente.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      extracted = {};
    }

    return new Response(JSON.stringify({ data: extracted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-rdo-sabesp error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
