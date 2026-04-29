/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  MessageSquare,
  Loader2,
  FileDown,
  Save,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  GitCompareArrows,
  ImagePlus,
  Trash2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  SERVICOS_ESGOTO,
  SERVICOS_AGUA,
  CARGOS_PADRAO,
  EQUIPAMENTOS_PADRAO,
} from "../lib/rdoSabespCatalog";
import {
  COMPARISON_GROUPS,
  compareRdoSabespData,
  type ComparisonGroupId,
  type RdoSabespDivergence,
  type RdoSabespStatus,
} from "../lib/rdoSabespUtils";
import { RdoSabespSheet, getMissingRequired, REQUIRED_LABELS } from "./RdoSabespSheet";
import { downloadRdoSabespWhatsappTemplate, parseRdoSabespWhatsappText } from "../lib/rdoSabespWhatsapp";
import {
  isLocalRdoSabespId,
  removeLocalRdoSabesp,
  stripLocalRdoSabespFields,
  upsertLocalRdoSabesp,
} from "../lib/rdoSabespLocalStore";

interface Props {
  initialData?: any;
  initialStep?: Step;
  onSaved?: () => void;
}

type Step = "import" | "edit" | "review";

const defaultCompareGroups = COMPARISON_GROUPS.map((group) => group.id);

const empty = () => ({
  project_id: null,
  report_date: new Date().toISOString().slice(0, 10),
  encarregado: "",
  rua_beco: "",
  criadouro: "",
  criadouro_outro: "",
  epi_utilizado: null as boolean | null,
  condicoes_climaticas: { manha: "", tarde: "", noite: "" },
  qualidade: { ordem_servico: false, bandeirola: false, projeto: false, obs: "" },
  paralisacoes: [] as any[],
  paralisacao_outro: "",
  horarios: { diurno: { inicio: "", fim: "" }, noturno: { inicio: "", fim: "" } },
  mao_de_obra: CARGOS_PADRAO.map((cargo) => ({ cargo, terc: 0, contrat: 0 })),
  equipamentos: EQUIPAMENTOS_PADRAO.map((descricao) => ({ descricao, terc: 0, contrat: 0 })),
  servicos_esgoto: SERVICOS_ESGOTO.map((servico) => ({ ...servico, quantidade: 0, opcoes: [] as string[] })),
  servicos_agua: SERVICOS_AGUA.map((servico) => ({ ...servico, quantidade: 0, opcoes: [] as string[] })),
  observacoes: "",
  responsavel_empreiteira: "",
  responsavel_consorcio: "",
  assinatura_empreiteira_url: null as string | null,
  assinatura_consorcio_url: null as string | null,
  assinatura_empreiteira_path: null as string | null,
  assinatura_consorcio_path: null as string | null,
  photo_paths: [] as string[],
  planilha_foto_url: null as string | null,
  planilha_foto_path: null as string | null,
  include_planilha_foto_no_pdf: true,
  whatsapp_text: null as string | null,
  status: "draft" as RdoSabespStatus,
  finalized_at: null as string | null,
});

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string) => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const AI_IMAGE_MAX_SIDE = 1400;
const AI_IMAGE_MAX_BYTES = 850_000;
const AI_IMAGE_QUALITIES = [0.82, 0.72, 0.62, 0.52];

const blobToDataUrl = (blob: Blob) => toDataUrl(blob);

const dataUrlByteSize = (dataUrl: string) => {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
};

const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

const prepareImageForAi = async (file: File) => {
  const original = await toDataUrl(file);
  const image = await loadImage(original);
  const maxSide = AI_IMAGE_MAX_SIDE;
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largestSide > maxSide ? maxSide / largestSide : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) return { original, aiImage: original };

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.22 + 128));
    const cleaned = contrast > 242 ? 255 : contrast;
    pixels[index] = cleaned;
    pixels[index + 1] = cleaned;
    pixels[index + 2] = cleaned;
  }
  context.putImageData(imageData, 0, 0);

  for (const quality of AI_IMAGE_QUALITIES) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (!blob) continue;
    const aiImage = await blobToDataUrl(blob);
    if (dataUrlByteSize(aiImage) <= AI_IMAGE_MAX_BYTES || quality === AI_IMAGE_QUALITIES[AI_IMAGE_QUALITIES.length - 1]) {
      return { original, aiImage };
    }
  }

  return { original, aiImage: original };
};

const prepareBlobForAi = async (blob: Blob, name = "rdo-sabesp.jpg") => {
  const file = new File([blob], name, { type: blob.type || "image/jpeg" });
  return prepareImageForAi(file);
};

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const makeImageFileName = (name: string, ext = "jpg") =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) + `.${ext}`;

const resizeImageForStorage = async (file: File) => {
  const original = await toDataUrl(file);
  const image = await loadImage(original);
  const maxSide = 2200;
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largestSide > maxSide ? maxSide / largestSide : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) return { blob: file, preview: original, fileName: file.name };

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) return { blob: file, preview: original, fileName: file.name };

  return {
    blob,
    preview: await toDataUrl(blob),
    fileName: makeImageFileName(file.name || `foto-${Date.now()}`),
  };
};

const parserErrorMessage = (error: any) => {
  const rawMessage = String(error?.message || error || "");
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("failed to send a request") ||
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("edge function") ||
    lower.includes("functions.invoke")
  ) {
    return "Nao foi possivel conectar ao parser de IA. A foto foi mantida para revisao manual; verifique a Edge Function parse-rdo-sabesp e tente novamente depois.";
  }

  if (lower.includes("timeout")) {
    return "O parser demorou demais para responder. Tente novamente ou envie uma foto mais nítida/leve.";
  }

  return rawMessage || "Erro desconhecido no parser de IA.";
};

const invokeRdoSabespParser = async (body: Record<string, unknown>) => {
  const invokeVercelParser = async () => {
    const apiResponse = await withTimeout(
      fetch("/api/parse-rdo-sabesp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      75_000,
      "timeout ao chamar /api/parse-rdo-sabesp",
    );

    let payload: any = null;
    try {
      payload = await apiResponse.json();
    } catch {
      payload = null;
    }

    if (!apiResponse.ok) throw new Error(payload?.error || `Erro ${apiResponse.status} no parser Vercel`);
    if (payload?.error) throw new Error(payload.error);
    return payload?.data || {};
  };

  let response: any;
  try {
    response = await withTimeout(
      supabase.functions.invoke("parse-rdo-sabesp", { body }),
      75_000,
      "timeout ao chamar parse-rdo-sabesp",
    );
  } catch (error) {
    console.warn("Parser Supabase indisponivel; tentando parser Vercel:", error);
    return invokeVercelParser();
  }

  if (response.error) {
    console.warn("Parser Supabase retornou erro; tentando parser Vercel:", response.error);
    return invokeVercelParser();
  }
  if (response.data?.error) throw new Error(response.data.error);
  return response.data?.data || {};
};

const makePhotoParserFallback = (current: any, planilhaFotoUrl: string, reason: string) => ({
  report_date: current?.report_date || "",
  encarregado: current?.encarregado || "",
  rua_beco: current?.rua_beco || "",
  criadouro: current?.criadouro || "",
  criadouro_outro: current?.criadouro_outro || "",
  condicoes_climaticas: current?.condicoes_climaticas,
  qualidade: current?.qualidade,
  paralisacoes: current?.paralisacoes || [],
  paralisacao_outro: current?.paralisacao_outro || "",
  horarios: current?.horarios,
  mao_de_obra: [],
  equipamentos: [],
  servicos_esgoto: [],
  servicos_agua: [],
  observacoes:
    current?.observacoes ||
    `Foto da planilha importada para revisao manual. Parser de IA indisponivel: ${reason}`,
  responsavel_empreiteira: current?.responsavel_empreiteira || "",
  responsavel_consorcio: current?.responsavel_consorcio || "",
  planilha_foto_url: planilhaFotoUrl,
  confidence_by_field: { fallback_local: 0 },
});

const isPhotoParserFallback = (snapshot: any) => snapshot?.confidence_by_field?.fallback_local === 0;

const parseTextLocally = (text: string) => {
  const parsed = parseRdoSabespWhatsappText(text);
  const legacy = parseTextLocallyLegacy(text);
  return {
    ...legacy,
    ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => {
      if (value === "" || value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    })),
  };
};

const cropImageByPercent = async (
  src: string,
  region: { x: number; y: number; width: number; height: number },
) => {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  const sx = image.naturalWidth * region.x;
  const sy = image.naturalHeight * region.y;
  const sw = image.naturalWidth * region.width;
  const sh = image.naturalHeight * region.height;

  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));

  const context = canvas.getContext("2d");
  if (!context) return src;

  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

const parseTextLocallyLegacy = (text: string) => {
  const getLineValue = (labels: string[]) => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = text.match(new RegExp(`${escaped}\\s*[:\\-]\\s*(.+)`, "i"));
      if (match?.[1]) return match[1].split(/\n/)[0].trim();
    }
    return "";
  };

  const dateMatch =
    text.match(/(\d{4}-\d{2}-\d{2})/) ||
    text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  const reportDate = dateMatch
    ? dateMatch[1].includes("-") && dateMatch[1].length === 10
      ? dateMatch[1]
      : `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
    : "";
  const criadouroText = getLineValue(["criadouro", "local", "nucleo", "núcleo"]).toLowerCase();
  const criadouro = criadouroText.includes("manoel")
    ? "sao_manoel"
    : criadouroText.includes("teteu")
      ? "morro_do_teteu"
      : criadouroText.includes("joao") || criadouroText.includes("joão")
        ? "joao_carlos"
        : criadouroText.includes("pantanal")
          ? "pantanal_baixo"
          : criadouroText.includes("israel")
            ? "vila_israel"
            : "";

  return {
    ...(reportDate ? { report_date: reportDate } : {}),
    encarregado: getLineValue(["encarregado", "responsavel", "responsável"]),
    rua_beco: getLineValue(["rua", "beco", "endereco", "endereço"]),
    criadouro,
    criadouro_outro: criadouro ? "" : getLineValue(["criadouro", "local", "nucleo", "núcleo"]),
    observacoes: getLineValue(["observacoes", "observações", "obs"]),
  };
};

const extractSignatureCrops = async (src: string) => ({
  empreiteira: await cropImageByPercent(src, { x: 0.05, y: 0.74, width: 0.38, height: 0.18 }),
  consorcio: await cropImageByPercent(src, { x: 0.57, y: 0.74, width: 0.38, height: 0.18 }),
});

const normalizeBbox = (bbox: any, fallback: { x: number; y: number; width: number; height: number }) => {
  if (!bbox || typeof bbox !== "object") return fallback;
  const x = Number(bbox.x);
  const y = Number(bbox.y);
  const width = Number(bbox.width);
  const height = Number(bbox.height);
  if (![x, y, width, height].every(Number.isFinite)) return fallback;
  if (width <= 0 || height <= 0) return fallback;
  return {
    x: Math.min(0.98, Math.max(0, x)),
    y: Math.min(0.98, Math.max(0, y)),
    width: Math.min(1, Math.max(0.01, width)),
    height: Math.min(1, Math.max(0.01, height)),
  };
};

const extractSignatureCropsFromSnapshot = async (src: string, snapshot: any) => ({
  empreiteira: await cropImageByPercent(
    src,
    normalizeBbox(snapshot?.assinatura_empreiteira_bbox, { x: 0.05, y: 0.74, width: 0.38, height: 0.18 }),
  ),
  consorcio: await cropImageByPercent(
    src,
    normalizeBbox(snapshot?.assinatura_consorcio_bbox, { x: 0.57, y: 0.74, width: 0.38, height: 0.18 }),
  ),
});

export function RdoSabespForm({ initialData, initialStep = "import", onSaved }: Props) {
  const orgId = useAuth((state) => state.profile?.organization_id);
  const [data, setData] = useState<any>(() => initialData || empty());
  const [step, setStep] = useState<Step>(initialData ? "edit" : initialStep);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");
  const [sourceSnapshot, setSourceSnapshot] = useState<any | null>(null);
  const [compareGroups, setCompareGroups] = useState<ComparisonGroupId[]>(defaultCompareGroups);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [divergences, setDivergences] = useState<RdoSabespDivergence[]>([]);
  const [pdfPreviewPages, setPdfPreviewPages] = useState<string[]>([]);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Array<{ path: string; url: string }>>([]);

  const set = (path: string, value: any) => {
    setData((current: any) => {
      const copy = JSON.parse(JSON.stringify(current));
      const parts = path.split(".");
      let node = copy;
      for (let index = 0; index < parts.length - 1; index += 1) {
        if (node[parts[index]] === undefined || node[parts[index]] === null) node[parts[index]] = {};
        node = node[parts[index]];
      }
      node[parts[parts.length - 1]] = value;
      return copy;
    });
  };

  const appendPhotoPaths = (paths: string[]) => {
    if (!paths.length) return;
    setData((current: any) => ({
      ...current,
      photo_paths: [...(Array.isArray(current.photo_paths) ? current.photo_paths : []), ...paths],
    }));
  };

  const uploadRdoImage = async (folder: string, fileName: string, blob: Blob) => {
    const path = `${folder}/${crypto.randomUUID()}_${fileName}`;
    const { error } = await supabase.storage.from("rdo-sabesp-photos").upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });
    if (error) throw error;
    return path;
  };

  const getOrganizationId = async () => {
    const currentOrgId = orgId || useAuth.getState().profile?.organization_id;
    if (currentOrgId) return currentOrgId;

    await useAuth.getState().refreshProfile().catch((error) => {
      console.warn("Nao foi possivel recarregar a organizacao para upload de fotos:", error);
    });

    return useAuth.getState().profile?.organization_id || null;
  };

  const mergeExtracted = (extracted: any) => {
    setData((current: any) => {
      const merged = { ...current };

      for (const key of Object.keys(extracted || {})) {
        const value = extracted[key];
        if (value === "" || value === null || value === undefined) continue;

        if (key === "servicos_esgoto" || key === "servicos_agua") {
          const rows = [...current[key]];
          for (const service of value) {
            const index = rows.findIndex(
              (item: any) =>
                (service.codigo && item.codigo === service.codigo) ||
                (service.descricao && item.descricao?.toLowerCase().includes(service.descricao.toLowerCase().slice(0, 15))),
            );
            if (index >= 0) {
              rows[index] = {
                ...rows[index],
                quantidade: Number(service.quantidade) || 0,
                opcoes: Array.isArray(service.opcoes) ? service.opcoes : rows[index].opcoes || [],
              };
            } else {
              rows.push({
                ...service,
                quantidade: Number(service.quantidade) || 0,
                opcoes: Array.isArray(service.opcoes) ? service.opcoes : [],
              });
            }
          }
          merged[key] = rows;
        } else if (key === "mao_de_obra" || key === "equipamentos") {
          const rows = [...current[key]];
          for (const item of value) {
            const referenceKey = key === "mao_de_obra" ? "cargo" : "descricao";
            const index = rows.findIndex((row: any) => row[referenceKey]?.toUpperCase() === item[referenceKey]?.toUpperCase());
            if (index >= 0) rows[index] = { ...rows[index], terc: Number(item.terc) || 0, contrat: Number(item.contrat) || 0 };
            else rows.push(item);
          }
          merged[key] = rows;
        } else {
          merged[key] = value;
        }
      }

      return merged;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadPhotoPreviews = async () => {
      const photoPaths = Array.isArray(data.photo_paths) ? data.photo_paths.filter(Boolean) : [];

      if (!photoPaths.length) {
        setPhotoPreviewUrls([]);
        return;
      }

      const previews = await Promise.all(
        photoPaths.map(async (path: string) => {
          try {
            if (path.startsWith("data:") || /^https?:\/\//i.test(path)) {
              return { path, url: path };
            }
            const { data: signed } = await supabase.storage
              .from("rdo-sabesp-photos")
              .createSignedUrl(path, 60 * 60);

            return signed?.signedUrl ? { path, url: signed.signedUrl } : null;
          } catch (error) {
            console.error("Erro ao gerar preview da foto do RDO Sabesp:", error);
            return null;
          }
        }),
      );

      if (!cancelled) {
        setPhotoPreviewUrls(previews.filter((preview): preview is { path: string; url: string } => Boolean(preview)));
      }
    };

    loadPhotoPreviews();

    return () => {
      cancelled = true;
    };
  }, [data.photo_paths]);

  useEffect(() => {
    let cancelled = false;
    const refreshSourcePhotoUrl = async () => {
      if (!data.planilha_foto_path || data.planilha_foto_url?.startsWith("data:")) return;
      try {
        const { data: signed } = await supabase.storage
          .from("rdo-sabesp-photos")
          .createSignedUrl(data.planilha_foto_path, 60 * 60);
        if (!cancelled && signed?.signedUrl && signed.signedUrl !== data.planilha_foto_url) {
          set("planilha_foto_url", signed.signedUrl);
        }
      } catch (error) {
        console.warn("Erro ao assinar foto original do RDO Sabesp:", error);
      }
    };

    void refreshSourcePhotoUrl();
    return () => {
      cancelled = true;
    };
  }, [data.planilha_foto_path]);

  useEffect(() => {
    let cancelled = false;
    const refreshSignatureUrls = async () => {
      const pairs = [
        ["assinatura_empreiteira_path", "assinatura_empreiteira_url"],
        ["assinatura_consorcio_path", "assinatura_consorcio_url"],
      ] as const;

      for (const [pathKey, urlKey] of pairs) {
        const path = data[pathKey];
        if (!path || data[urlKey]?.startsWith("data:")) continue;
        try {
          const { data: signed } = await supabase.storage.from("rdo-sabesp-photos").createSignedUrl(path, 60 * 60);
          if (!cancelled && signed?.signedUrl && signed.signedUrl !== data[urlKey]) set(urlKey, signed.signedUrl);
        } catch (error) {
          console.warn("Erro ao assinar assinatura do RDO Sabesp:", error);
        }
      }
    };

    void refreshSignatureUrls();
    return () => {
      cancelled = true;
    };
  }, [data.assinatura_empreiteira_path, data.assinatura_consorcio_path]);

  const handleAdditionalPhotos = async (files: FileList | null) => {
    if (!files?.length) return;

    setUploadingPhotos(true);
    try {
      const currentOrgId = await getOrganizationId();
      const folder = currentOrgId ? `${currentOrgId}/no-project` : null;
      const uploadedPaths: string[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} nao parece ser uma imagem.`);
          continue;
        }

        const prepared = await resizeImageForStorage(file);
        if (!folder) {
          uploadedPaths.push(prepared.preview);
          continue;
        }

        const path = `${folder}/attachments/${crypto.randomUUID()}_${prepared.fileName}`;
        const { error } = await supabase.storage.from("rdo-sabesp-photos").upload(path, prepared.blob, {
          contentType: prepared.blob.type || "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

        if (error) {
          console.error("Erro ao subir foto do RDO Sabesp:", error);
          toast.error(`Não foi possível enviar ${file.name}.`);
          continue;
        }

        uploadedPaths.push(path);
      }

      if (uploadedPaths.length > 0) {
        appendPhotoPaths(uploadedPaths);
        toast.success(
          folder
            ? `${uploadedPaths.length} foto(s) adicionada(s) ao RDO.`
            : `${uploadedPaths.length} foto(s) adicionada(s) localmente. Salve o RDO quando a organizacao carregar.`,
        );
      }
    } catch (error: any) {
      toast.error("Erro ao adicionar fotos: " + (error?.message || "tente novamente."));
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = async (path: string) => {
    try {
      if (!path.startsWith("data:") && !/^https?:\/\//i.test(path)) {
        const { error } = await supabase.storage.from("rdo-sabesp-photos").remove([path]);
        if (error) throw error;
      }

      set(
        "photo_paths",
        (Array.isArray(data.photo_paths) ? data.photo_paths : []).filter((photoPath: string) => photoPath !== path),
      );
      toast.success("Foto removida do RDO.");
    } catch (error: any) {
      toast.error("Erro ao remover foto: " + (error.message || error));
    }
  };

  const extractFromPhotoUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Não foi possível abrir a foto original da planilha.");
    const blob = await response.blob();
    const { aiImage } = await prepareBlobForAi(blob);

    try {
      return await invokeRdoSabespParser({ mode: "image", image_base64: aiImage });
    } catch (error) {
      return makePhotoParserFallback(data, url, parserErrorMessage(error));
    }
  };

  const refreshComparison = async () => {
    if (!data.planilha_foto_url) {
      setComparisonError("Envie uma foto da planilha para ativar a comparação automática.");
      setDivergences([]);
      return;
    }

    setComparisonLoading(true);
    try {
      const snapshot = sourceSnapshot || await extractFromPhotoUrl(data.planilha_foto_url);
      if (!sourceSnapshot) setSourceSnapshot(snapshot);
      if (isPhotoParserFallback(snapshot)) {
        setComparisonError("Comparação automática indisponível porque o parser de IA não respondeu. Confira a foto anexada manualmente.");
        setDivergences([]);
        return;
      }
      setDivergences(compareRdoSabespData(data, snapshot, compareGroups));
      setComparisonError(null);
    } catch (error: any) {
      setComparisonError(error.message || "Não foi possível comparar a planilha com o RDO.");
      setDivergences([]);
    } finally {
      setComparisonLoading(false);
    }
  };

  const refreshPdfPreview = async () => {
    setPdfPreviewLoading(true);
    try {
      const { renderRdoSabespPdfPreviewPages } = await import("../lib/rdoSabespPdfGenerator");
      const pages = await renderRdoSabespPdfPreviewPages(data);
      setPdfPreviewPages(pages);
    } catch (error: any) {
      setPdfPreviewPages([]);
      toast.error("Erro ao montar pré-visualização do PDF: " + (error.message || error));
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (step !== "review") return;

    let active = true;

    (async () => {
      await Promise.all([
        (async () => {
          setPdfPreviewLoading(true);
          try {
            const { renderRdoSabespPdfPreviewPages } = await import("../lib/rdoSabespPdfGenerator");
            const pages = await renderRdoSabespPdfPreviewPages(data);
            if (active) setPdfPreviewPages(pages);
          } catch (error: any) {
            if (active) {
              setPdfPreviewPages([]);
              toast.error("Erro ao montar pré-visualização do PDF: " + (error.message || error));
            }
          } finally {
            if (active) setPdfPreviewLoading(false);
          }
        })(),
        (async () => {
          if (!data.planilha_foto_url) {
            if (active) {
              setComparisonError("Envie uma foto da planilha para ativar a comparação automática.");
              setDivergences([]);
            }
            return;
          }

          setComparisonLoading(true);
          try {
            const snapshot = sourceSnapshot || await extractFromPhotoUrl(data.planilha_foto_url);
            if (active && !sourceSnapshot) setSourceSnapshot(snapshot);
            if (active) {
              if (isPhotoParserFallback(snapshot)) {
                setComparisonError("Comparação automática indisponível porque o parser de IA não respondeu. Confira a foto anexada manualmente.");
                setDivergences([]);
                return;
              }
              setDivergences(compareRdoSabespData(data, snapshot, compareGroups));
              setComparisonError(null);
            }
          } catch (error: any) {
            if (active) {
              setComparisonError(error.message || "Não foi possível comparar a planilha com o RDO.");
              setDivergences([]);
            }
          } finally {
            if (active) setComparisonLoading(false);
          }
        })(),
      ]);
    })();

    return () => {
      active = false;
    };
  }, [step, data, compareGroups, sourceSnapshot]);

  const handlePhoto = async (file: File) => {
    setParsing(true);
    try {
      const { original, aiImage } = await prepareImageForAi(file);
      let planilhaFotoPath: string | null = null;
      let planilhaFotoUrl = original;
      const currentOrgId = await getOrganizationId();

      if (currentOrgId) {
        try {
          const folder = `${currentOrgId}/no-project`;
          const prepared = await resizeImageForStorage(file);
          planilhaFotoPath = await uploadRdoImage(`${folder}/source`, prepared.fileName, prepared.blob);
          const { data: signed } = await supabase.storage.from("rdo-sabesp-photos").createSignedUrl(planilhaFotoPath, 60 * 60);
          planilhaFotoUrl = signed?.signedUrl || prepared.preview;
        } catch (error) {
          console.warn("Nao foi possivel armazenar a foto original do RDO Sabesp; usando preview local:", error);
          toast.warning("Nao consegui subir a foto agora. Ela foi mantida localmente para revisao.");
        }
      }
      set("planilha_foto_path", planilhaFotoPath);
      set("planilha_foto_url", planilhaFotoUrl);

      let extractedSnapshot: any;
      let usedLocalFallback = false;
      let parserFailure: any = null;
      try {
        extractedSnapshot = await invokeRdoSabespParser({ mode: "image", image_base64: aiImage });
      } catch (error) {
        parserFailure = error;
        usedLocalFallback = true;
        extractedSnapshot = makePhotoParserFallback(data, planilhaFotoUrl, parserErrorMessage(error));
        console.warn("Parser de IA do RDO Sabesp indisponivel; usando fallback local:", error);
      }
      setSourceSnapshot(extractedSnapshot);

      const extracted = { ...extractedSnapshot };
      const signatureCrops = await extractSignatureCropsFromSnapshot(original, extractedSnapshot).catch(() => extractSignatureCrops(original)).catch(() => ({
        empreiteira: original,
        consorcio: original,
      }));
      if (extracted.assinatura_empreiteira_presente) {
        extracted.assinatura_empreiteira_url = signatureCrops.empreiteira;
        if (currentOrgId) {
          try {
            const blob = await dataUrlToBlob(signatureCrops.empreiteira);
            const path = await uploadRdoImage(`${currentOrgId}/no-project/signatures`, `assinatura-empreiteira-${Date.now()}.png`, blob);
            extracted.assinatura_empreiteira_path = path;
          } catch (error) {
            console.warn("Nao foi possivel armazenar a assinatura da empreiteira:", error);
          }
        }
      }
      if (extracted.assinatura_consorcio_presente) {
        extracted.assinatura_consorcio_url = signatureCrops.consorcio;
        if (currentOrgId) {
          try {
            const blob = await dataUrlToBlob(signatureCrops.consorcio);
            const path = await uploadRdoImage(`${currentOrgId}/no-project/signatures`, `assinatura-consorcio-${Date.now()}.png`, blob);
            extracted.assinatura_consorcio_path = path;
          } catch (error) {
            console.warn("Nao foi possivel armazenar a assinatura do consorcio:", error);
          }
        }
      }
      delete extracted.assinatura_empreiteira_presente;
      delete extracted.assinatura_consorcio_presente;
      delete extracted.assinatura_empreiteira_bbox;
      delete extracted.assinatura_consorcio_bbox;
      delete extracted.confidence_by_field;

      mergeExtracted(extracted);
      if (usedLocalFallback) {
        toast.warning(
          "Nao consegui conectar ao parser de IA. Mantive a foto da planilha e abri o RDO para preenchimento/conferencia manual.",
        );
        console.warn("Falha original do parser de foto:", parserFailure);
      } else {
        toast.success("Foto processada! Confira os dados.");
      }
      setStep("edit");
    } catch (error: any) {
      toast.error("Erro ao processar foto: " + parserErrorMessage(error));
    } finally {
      setParsing(false);
    }
  };

  const handleWhatsapp = async () => {
    if (!whatsappText.trim()) return;
    setParsing(true);
    try {
      set("whatsapp_text", whatsappText);
      const extracted = await invokeRdoSabespParser({ mode: "text", text: whatsappText });
      mergeExtracted(extracted);
      toast.success("Texto interpretado! Confira os dados.");
      setStep("edit");
    } catch (error: any) {
      const fallback = parseTextLocally(whatsappText);
      mergeExtracted(fallback);
      toast.warning("Parser de IA indisponivel. Apliquei uma leitura basica do texto para voce revisar.");
      console.error("Erro ao interpretar texto:", error);
      setStep("edit");
    } finally {
      setParsing(false);
    }
  };

  const persist = async (nextStatus: RdoSabespStatus) => {
    setSaving(true);
    const finalizedAt = nextStatus === "finalized" ? new Date().toISOString() : null;
    const localRecord = upsertLocalRdoSabesp({
      ...data,
      id: data.id || initialData?.id,
      whatsapp_text: data.whatsapp_text || whatsappText || null,
      status: nextStatus,
      finalized_at: finalizedAt,
      _localOnly: true,
      _syncError: null,
    });

    setData((current: any) => ({
      ...current,
      ...localRecord,
      status: nextStatus,
      finalized_at: finalizedAt,
    }));

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Usuário não autenticado");
      const currentOrgId = await getOrganizationId();
      if (!currentOrgId) throw new Error("Organizacao nao carregada.");

      const payload = stripLocalRdoSabespFields({
        ...localRecord,
        organization_id: currentOrgId,
        project_id: null,
        created_by: authData.user.id,
        status: nextStatus,
        finalized_at: finalizedAt,
      });
      let response;
      const removeDurableAssetColumns = (record: Record<string, any>) => {
        const legacy = { ...record };
        delete legacy.planilha_foto_path;
        delete legacy.assinatura_empreiteira_path;
        delete legacy.assinatura_consorcio_path;
        delete legacy.include_planilha_foto_no_pdf;
        return legacy;
      };
      const isMissingDurableAssetColumnError = (error: any) => {
        const message = String(error?.message || error?.details || "");
        return /planilha_foto_path|assinatura_empreiteira_path|assinatura_consorcio_path|include_planilha_foto_no_pdf/i.test(message);
      };

      if (localRecord.id && !isLocalRdoSabespId(localRecord.id)) {
        const rest = { ...payload };
        delete rest.id;
        delete rest.created_at;
        delete rest.updated_at;
        delete rest.created_by;
        delete rest.organization_id;
        response = await supabase.from("rdo_sabesp" as any).update(rest).eq("id", localRecord.id).select("*").single();
        if (response.error && isMissingDurableAssetColumnError(response.error)) {
          response = await supabase
            .from("rdo_sabesp" as any)
            .update(removeDurableAssetColumns(rest))
            .eq("id", localRecord.id)
            .select("*")
            .single();
        }
      } else {
        const rest = { ...payload };
        delete rest.id;
        delete rest.created_at;
        delete rest.updated_at;
        response = await supabase.from("rdo_sabesp" as any).insert(rest).select("*").single();
        if (response.error && isMissingDurableAssetColumnError(response.error)) {
          response = await supabase.from("rdo_sabesp" as any).insert(removeDurableAssetColumns(rest)).select("*").single();
        }
      }

      if (response.error) throw response.error;
      const savedRecord = response.data || {
        ...localRecord,
        _localOnly: false,
        _syncError: null,
      };
      if (savedRecord.id !== localRecord.id) removeLocalRdoSabesp(localRecord.id);
      upsertLocalRdoSabesp({
        ...savedRecord,
        _localOnly: false,
        _syncError: null,
      });
      setData((current: any) => ({
        ...current,
        ...savedRecord,
        status: nextStatus,
        finalized_at: finalizedAt,
      }));
      toast.success(
        nextStatus === "draft"
          ? initialData?.id || data.id
            ? "Rascunho atualizado!"
            : "Rascunho salvo!"
          : initialData?.id || data.id
            ? "RDO finalizado atualizado!"
            : "RDO Sabesp finalizado!",
      );
      onSaved?.();
    } catch (error: any) {
      upsertLocalRdoSabesp({
        ...localRecord,
        _localOnly: true,
        _syncError: error.message || String(error),
      });
      toast.warning("RDO salvo localmente. Ele continuara disponivel neste navegador mesmo sem resposta do Supabase.");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    await persist("draft");
  };

  const finalizeRdo = async () => {
    if (uniqueMissingLabels.length > 0) {
      toast.error(`Preencha os ${uniqueMissingLabels.length} campo(s) obrigatorios(s) antes de finalizar o RDO.`);
      return;
    }

    await persist("finalized");
  };

  const toggleCompareGroup = (groupId: ComparisonGroupId, checked: boolean) => {
    setCompareGroups((current) => {
      if (checked) {
        return current.includes(groupId) ? current : [...current, groupId];
      }
      return current.filter((id) => id !== groupId);
    });
  };

  const missing = getMissingRequired(data);
  const missingLabels = Array.from(missing).map((key) => REQUIRED_LABELS[key] || key);
  const uniqueMissingLabels = Array.from(new Set(missingLabels));
  const photoCount = Array.isArray(data.photo_paths) ? data.photo_paths.length : 0;
  const currentStatus: RdoSabespStatus = data.status === "finalized" ? "finalized" : "draft";
  const selectedGroups = useMemo(
    () => COMPARISON_GROUPS.filter((group) => compareGroups.includes(group.id)),
    [compareGroups],
  );
  const reviewBusy = pdfPreviewLoading || (Boolean(data.planilha_foto_url) && comparisonLoading);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        {[
          { key: "import", label: "1. Importar (opcional)" },
          { key: "edit", label: "2. Preencher" },
          { key: "review", label: "3. Revisar e exportar" },
        ].map((item, index, items) => (
          <div key={item.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(item.key as Step)}
              className={`rounded-full px-3 py-1.5 font-medium ${step === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {item.label}
            </button>
            {index < items.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === "import" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preenchimento automático (opcional)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Envie uma foto da planilha preenchida ou cole um texto do WhatsApp. A IA preenche os campos para você revisar.
              Você também pode pular esta etapa e preencher manualmente.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="foto">
              <TabsList className="flex h-auto w-full flex-wrap gap-2">
                <TabsTrigger value="foto"><Upload className="mr-1 h-4 w-4" /> Foto da planilha</TabsTrigger>
                <TabsTrigger value="texto"><MessageSquare className="mr-1 h-4 w-4" /> Texto WhatsApp</TabsTrigger>
              </TabsList>
              <TabsContent value="foto" className="space-y-2 pt-3">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#525252] bg-[#333333] px-4 py-8 text-center text-sm text-[#d4d4d4] transition-colors hover:border-[#f97316]/60 hover:bg-[#3d3d3d]">
                  {parsing ? <Loader2 className="h-6 w-6 animate-spin text-[#f97316]" /> : <Upload className="h-6 w-6 text-[#f97316]" />}
                  <span className="font-semibold text-white">Importar foto da planilha RDO Sabesp</span>
                  <span className="max-w-md text-xs text-[#a3a3a3]">
                    Use uma foto nítida. O sistema reduz o tamanho da imagem antes de enviar para evitar travamentos.
                  </span>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={parsing}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handlePhoto(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                {parsing && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Lendo planilha com IA...
                  </p>
                )}
              </TabsContent>
              <TabsContent value="texto" className="space-y-2 pt-3">
                <Textarea rows={6} placeholder="Cole aqui a mensagem do WhatsApp com os dados do RDO..." value={whatsappText} onChange={(event) => setWhatsappText(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleWhatsapp} disabled={parsing || !whatsappText.trim()}>
                    {parsing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1 h-4 w-4" />}
                    Interpretar texto
                  </Button>
                  <Button size="sm" variant="outline" type="button" onClick={downloadRdoSabespWhatsappTemplate}>
                    <FileText className="mr-1 h-4 w-4" />
                    Baixar modelo
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setStep("edit")}>
                Pular e preencher manualmente <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "edit" && (
        <>
          <RdoSabespSheet data={data} set={set} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fotos do RDO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  As fotos ficam anexadas ao RDO e entram no PDF/exportação logo depois das assinaturas.
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
                    <ImagePlus className="h-4 w-4" />
                    <span>Adicionar fotos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploadingPhotos}
                      onChange={(event) => {
                        handleAdditionalPhotos(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {uploadingPhotos && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>

              {photoCount > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {photoPreviewUrls.map((photo, index) => (
                    <div key={photo.path} className="overflow-hidden rounded-md border bg-muted/20">
                      <img src={photo.url} alt={`Foto do RDO ${index + 1}`} className="h-48 w-full object-cover" />
                      <div className="flex items-center justify-between gap-2 p-3">
                        <span className="text-xs text-muted-foreground">Foto {index + 1}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleRemovePhoto(photo.path)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma foto adicionada ao RDO.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t bg-background py-3">
            <Button variant="outline" onClick={() => setStep("import")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                Salvar rascunho
              </Button>
              <Button onClick={() => setStep("review")}>
              Pré-visualização e revisão <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          {uniqueMissingLabels.length > 0 ? (
            <div className="rounded border-l-4 border-destructive bg-destructive/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {uniqueMissingLabels.length} campo(s) obrigatório(s) faltando
              </div>
              <ul className="ml-6 mt-1 list-disc text-xs text-destructive">
                {uniqueMissingLabels.map((label) => <li key={label}>{label}</li>)}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Os campos faltantes estão destacados em vermelho na planilha abaixo. Volte para "Preencher" para corrigir.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded border-l-4 border-green-500 bg-green-500/10 p-3 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-semibold">Tudo preenchido.</span> Você pode revisar a comparação e gerar o PDF.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={currentStatus === "draft" ? "secondary" : "default"}>
              {currentStatus === "draft" ? "Rascunho" : "Finalizado"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Rascunhos podem ficar incompletos e ser retomados depois. Finalizados entram prontos para controle e exportacao.
            </span>
          </div>

          <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Card>
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Comparação automática</CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void Promise.all([refreshPdfPreview(), refreshComparison()]);
                    }}
                    disabled={reviewBusy}
                  >
                    {reviewBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                    Atualizar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Escolha quais blocos do modelo entram na validação antes de exportar. A checagem aponta divergências de conteúdo;
                  assinatura, alinhamento e quebra de linha continuam validados no preview lado a lado.
                </p>
                {data.planilha_foto_url && (
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Checkbox
                      checked={data.include_planilha_foto_no_pdf !== false}
                      onCheckedChange={(checked) => set("include_planilha_foto_no_pdf", checked === true)}
                    />
                    Incluir foto original da planilha no PDF
                  </label>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {COMPARISON_GROUPS.map((group) => (
                    <label key={group.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={compareGroups.includes(group.id)}
                        onCheckedChange={(checked) => toggleCompareGroup(group.id, checked === true)}
                      />
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{group.label}</div>
                        <div className="text-xs text-muted-foreground">{group.description}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedGroups.map((group) => (
                    <Badge key={group.id} variant="secondary">{group.label}</Badge>
                  ))}
                </div>

                {!data.planilha_foto_url ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Envie uma foto da planilha no passo 1 para liberar a detecção automática de divergência.
                  </div>
                ) : comparisonLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Comparando a planilha original com o RDO preenchido...
                  </div>
                ) : comparisonError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                    {comparisonError}
                  </div>
                ) : divergences.length === 0 ? (
                  <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-4 text-sm text-green-700">
                    Nenhuma divergência encontrada nos grupos selecionados.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                      <GitCompareArrows className="h-4 w-4" />
                      {divergences.length} divergência(s) encontrada(s)
                    </div>
                    <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                      {divergences.map((divergence) => (
                        <div key={`${divergence.group}-${divergence.label}`} className="rounded-lg border p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{COMPARISON_GROUPS.find((group) => group.id === divergence.group)?.label}</Badge>
                            <span className="text-sm font-medium">{divergence.label}</span>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div>
                              <div className="font-semibold text-muted-foreground">Planilha original</div>
                              <div className="rounded bg-muted/60 p-2">{divergence.original}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-muted-foreground">RDO preenchido / PDF</div>
                              <div className="rounded bg-muted/60 p-2">{divergence.current}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">Pré-visualização lado a lado</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Use este comparativo visual para conferir assinatura, campos marcados e quebras de linha antes da exportação.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Foto original</div>
                    {data.planilha_foto_url ? (
                      <img
                        src={data.planilha_foto_url}
                        alt="Foto original da planilha"
                        className="max-h-[72vh] w-full rounded-lg border bg-muted/30 object-contain"
                      />
                    ) : (
                      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        Sem foto original vinculada a este RDO.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">PDF gerado</div>
                    {pdfPreviewLoading ? (
                      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando preview do PDF...
                      </div>
                    ) : pdfPreviewPages.length ? (
                      <div className="max-h-[72vh] space-y-3 overflow-auto pr-1">
                        {pdfPreviewPages.map((page, index) => (
                          <img
                            key={`page-${index + 1}`}
                            src={page}
                            alt={`Prévia do PDF - página ${index + 1}`}
                            className="w-full rounded-lg border bg-muted/30"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        A pré-visualização do PDF não pôde ser montada.
                      </div>
                    )}
                  </div>
                </div>

                {(data.assinatura_empreiteira_url || data.assinatura_consorcio_url) && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.assinatura_empreiteira_url && (
                      <div className="rounded-lg border p-3">
                        <div className="mb-2 text-sm font-medium">Assinatura extraída - empreiteira</div>
                        <img src={data.assinatura_empreiteira_url} alt="Assinatura empreiteira extraída" className="h-24 w-full rounded-md bg-muted/30 object-contain" />
                      </div>
                    )}
                    {data.assinatura_consorcio_url && (
                      <div className="rounded-lg border p-3">
                        <div className="mb-2 text-sm font-medium">Assinatura extraída - consórcio</div>
                        <img src={data.assinatura_consorcio_url} alt="Assinatura consórcio extraída" className="h-24 w-full rounded-md bg-muted/30 object-contain" />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planilha preenchida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RdoSabespSheet data={data} readOnly missing={missing} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fotos do RDO</CardTitle>
            </CardHeader>
            <CardContent>
              {photoCount > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {photoPreviewUrls.map((photo, index) => (
                    <div key={photo.path} className="overflow-hidden rounded-md border bg-muted/20">
                      <img src={photo.url} alt={`Foto do RDO ${index + 1}`} className="h-48 w-full object-cover" />
                      <div className="p-3 text-xs text-muted-foreground">Foto {index + 1}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Este RDO ainda não possui fotos anexadas.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t bg-background py-3">
            <Button variant="outline" onClick={() => setStep("edit")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar e editar
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  if (uniqueMissingLabels.length > 0) {
                    toast.error(`Preencha os ${uniqueMissingLabels.length} campo(s) obrigatórios(s) antes de gerar o PDF.`);
                    return;
                  }
                  try {
                    const { downloadRdoSabespPdf } = await import("../lib/rdoSabespPdfGenerator");
                    await downloadRdoSabespPdf(data);
                    toast.success("PDF do RDO gerado com sucesso.");
                  } catch (error: any) {
                    console.error("Erro ao gerar PDF do RDO Sabesp na revisÃ£o:", error);
                    toast.error("Erro ao gerar PDF: " + (error?.message || "Erro desconhecido."));
                  }
                }}
                disabled={uniqueMissingLabels.length > 0 || reviewBusy}
                title={uniqueMissingLabels.length > 0 ? "Complete os campos obrigatórios" : ""}
              >
                {reviewBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
                Gerar PDF
              </Button>
              <Button variant="outline" onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                Salvar rascunho
              </Button>
              <Button onClick={finalizeRdo} disabled={saving || reviewBusy}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                {currentStatus === "finalized" ? "Atualizar finalizado" : "Finalizar e salvar"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
