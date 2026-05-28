/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const LOVABLE_MODEL = "google/gemini-2.5-flash";

const SCHEMA_DESCRIPTION = `
Extract data from a SABESP / Consorcio Se Liga Na Rede RDO image.
Always return the exact tool schema. Do not invent data. Empty fields must be
empty strings, false, zero, or empty arrays.

Important visual rules:
- Read handwritten quantities in the executed-services grid.
- Preserve checked pavement options such as DN32, DN63, DN100, DN 50 a 100 and DN 150 a 250.
- Identify the foreman name, nucleus/criadouro, date, services, observations and signatures.
- If a signature is visible, set the signature presence flag and approximate bbox.
`;

const bboxSchema = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
  },
};

const extractTool = {
  type: "function",
  function: {
    name: "extract_rdo_sabesp",
    description: "Extract structured fields from a SABESP RDO.",
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
        paralisacao_outro: { type: "string" },
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
              opcoes: { type: "array", items: { type: "string" } },
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
              opcoes: { type: "array", items: { type: "string" } },
            },
          },
        },
        observacoes: { type: "string" },
        responsavel_empreiteira: { type: "string" },
        responsavel_consorcio: { type: "string" },
        assinatura_empreiteira_presente: { type: "boolean" },
        assinatura_consorcio_presente: { type: "boolean" },
        assinatura_empreiteira_bbox: bboxSchema,
        assinatura_consorcio_bbox: bboxSchema,
        confidence_by_field: {
          type: "object",
          additionalProperties: { type: "number" },
        },
      },
      required: ["report_date"],
    },
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parserProvider = () => (Deno.env.get("GEMINI_API_KEY") ? "google-gemini-api" : "lovable-ai-gateway");
const parserModel = () => Deno.env.get("GEMINI_MODEL") || (Deno.env.get("GEMINI_API_KEY") ? DEFAULT_GEMINI_MODEL : LOVABLE_MODEL);

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return { mimeType: "image/jpeg", base64: dataUrl };
  return { mimeType: match[1] || "image/jpeg", base64: match[2] || "" };
};

const callGeminiParser = async (body: { mode?: "image" | "text"; image_base64?: string; text?: string }) => {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
  const parts: any[] = [
    {
      text:
        SCHEMA_DESCRIPTION +
        "\nReturn only valid JSON matching the schema. No markdown, no comments.",
    },
  ];

  if (body.mode === "image") {
    const parsedImage = parseDataUrl(body.image_base64 || "");
    parts.push({
      inline_data: {
        mime_type: parsedImage.mimeType,
        data: parsedImage.base64,
      },
    });
  } else {
    parts.push({ text: `RDO text:\n\n${body.text || ""}` });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          response_mime_type: "application/json",
          response_schema: extractTool.function.parameters,
        },
      }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini API returned ${response.status}`);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini did not return structured JSON.");
  return JSON.parse(text);
};

const callLovableParser = async (body: { mode?: "image" | "text"; image_base64?: string; text?: string }) => {
  const apiKey = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("AI_GATEWAY_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY or AI_GATEWAY_API_KEY is not configured.");

  const userContent: any[] = [];
  if (body.mode === "image") {
    userContent.push({
      type: "text",
      text: "This is a photo of a handwritten or printed SABESP RDO sheet. Extract all readable fields.",
    });
    userContent.push({ type: "image_url", image_url: { url: body.image_base64 } });
  } else {
    userContent.push({
      type: "text",
      text: `Extract the SABESP RDO fields from this WhatsApp/plain text:\n\n${body.text}`,
    });
  }

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LOVABLE_MODEL,
      messages: [
        { role: "system", content: SCHEMA_DESCRIPTION },
        { role: "user", content: userContent },
      ],
      tools: [extractTool],
      tool_choice: { type: "function", function: { name: "extract_rdo_sabesp" } },
    }),
  });

  if (!aiResp.ok) {
    const errorText = await aiResp.text();
    throw new Error(errorText || `Lovable AI gateway returned ${aiResp.status}`);
  }

  const data = await aiResp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("AI did not return structured tool arguments.");
  return JSON.parse(toolCall.function.arguments);
};

const getRequestContext = async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !serviceRoleKey || !token) return null;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile?.organization_id) return null;

  return {
    admin,
    userId: userData.user.id,
    organizationId: profile.organization_id as string,
  };
};

const createParserRun = async (
  context: Awaited<ReturnType<typeof getRequestContext>>,
  body: Record<string, unknown>,
) => {
  if (!context) return null;

  const { data, error } = await context.admin
    .from("rdo_sabesp_parser_runs")
    .insert({
      organization_id: context.organizationId,
      created_by: context.userId,
      requested_by: context.userId,
      mode: body.mode,
      provider: parserProvider(),
      model: parserModel(),
      status: "pending",
      input_storage_path: body.storage_path || null,
      input_mime_type: body.mime_type || null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Could not create parser audit row:", error);
    return null;
  }

  return data?.id || null;
};

const updateParserRun = async (
  context: Awaited<ReturnType<typeof getRequestContext>>,
  runId: string | null,
  patch: Record<string, unknown>,
) => {
  if (!context || !runId) return;

  const { error } = await context.admin
    .from("rdo_sabesp_parser_runs")
    .update({ ...patch, completed_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("organization_id", context.organizationId);

  if (error) console.warn("Could not update parser audit row:", error);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  if (!Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("LOVABLE_API_KEY") && !Deno.env.get("AI_GATEWAY_API_KEY")) {
    return json({ error: "Configure GEMINI_API_KEY, LOVABLE_API_KEY or AI_GATEWAY_API_KEY in Supabase secrets." }, 500);
  }

  const context = await getRequestContext(req).catch((error) => {
    console.warn("Could not resolve authenticated parser context:", error);
    return null;
  });

  let runId: string | null = null;

  try {
    const body = await req.json();
    const { mode, image_base64, text } = body as {
      mode?: "image" | "text";
      image_base64?: string;
      text?: string;
    };

    if (mode !== "image" && mode !== "text") return json({ error: "Invalid mode." }, 400);
    if (mode === "image" && !image_base64) return json({ error: "image_base64 is required." }, 400);
    if (mode === "text" && !text) return json({ error: "text is required." }, 400);

    runId = await createParserRun(context, body);

    const extracted = Deno.env.get("GEMINI_API_KEY")
      ? await callGeminiParser({ mode, image_base64, text })
      : await callLovableParser({ mode, image_base64, text });

    await updateParserRun(context, runId, {
      status: "success",
      result: extracted,
      duration_ms: Date.now() - startedAt,
    });

    return json({ data: extracted, audit_run_id: runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parser error";
    await updateParserRun(context, runId, {
      status: "failed",
      error_message: message,
      duration_ms: Date.now() - startedAt,
    });

    if (/quota|rate|429/i.test(message)) return json({ error: "Too many requests. Try again shortly.", details: message }, 429);
    if (/billing|credit|payment|402/i.test(message)) return json({ error: "AI credits or billing unavailable.", details: message }, 402);
    return json({ error: message }, 500);
  }
});
