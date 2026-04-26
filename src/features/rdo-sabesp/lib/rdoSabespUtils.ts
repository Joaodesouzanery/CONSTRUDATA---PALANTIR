/* eslint-disable @typescript-eslint/no-explicit-any */
import { CRIADOUROS } from "./rdoSabespCatalog";
import type { RdoSabespData } from "./rdoSabespPdfGenerator";

export type RdoSabespStatus = "draft" | "finalized";

export type ComparisonGroupId =
  | "header"
  | "epi"
  | "climate"
  | "quality"
  | "stoppages"
  | "hours"
  | "services"
  | "signatures";

export interface ComparisonGroup {
  id: ComparisonGroupId;
  label: string;
  description: string;
}

export interface RdoSabespDivergence {
  group: ComparisonGroupId;
  label: string;
  original: string;
  current: string;
}

export const COMPARISON_GROUPS: ComparisonGroup[] = [
  { id: "header", label: "Cabecalho", description: "Data, rua/beco, encarregado e local." },
  { id: "epi", label: "EPI", description: "Resposta SIM/NAO da pergunta principal." },
  { id: "climate", label: "Clima", description: "Condicoes climaticas por periodo." },
  { id: "quality", label: "Qualidade", description: "OS, bandeirola, projeto e observacao." },
  { id: "stoppages", label: "Paralisacoes", description: "Motivo, inicio, fim e texto livre." },
  { id: "hours", label: "Horarios", description: "Horarios diurnos e noturnos." },
  { id: "services", label: "Servicos", description: "Atividades, quantidades e opcoes selecionadas." },
  { id: "signatures", label: "Assinaturas", description: "Responsaveis e presenca de assinatura." },
];

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const formatBool = (value: boolean | null | undefined) => {
  if (value === true) return "Sim";
  if (value === false) return "Nao";
  return "Nao informado";
};

const formatValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    const cleaned: string[] = value
      .map((item) => formatValue(item))
      .filter(Boolean);
    return cleaned.length ? cleaned.join(", ") : "Nao informado";
  }

  if (value === null || value === undefined || value === "") {
    return "Nao informado";
  }

  if (typeof value === "boolean") {
    return formatBool(value);
  }

  return String(value);
};

const sameValue = (left: unknown, right: unknown) => normalizeText(left) === normalizeText(right);

const pushDiff = (
  divergences: RdoSabespDivergence[],
  group: ComparisonGroupId,
  label: string,
  original: unknown,
  current: unknown,
) => {
  if (sameValue(original, current)) return;
  divergences.push({
    group,
    label,
    original: formatValue(original),
    current: formatValue(current),
  });
};

const getServiceKey = (service: any) =>
  normalizeText(service?.codigo) || normalizeText(service?.descricao) || normalizeText(JSON.stringify(service ?? {}));

export function getCriadouroLabel(value?: string | null, other?: string | null) {
  const found = CRIADOUROS.find((item) => item.value === value);
  if (found?.value === "outro") return other?.trim() || "Outro";
  return found?.label || "Nao informado";
}

export function getServiceOptionLabel(service: any) {
  const options = Array.isArray(service?.opcoes) ? service.opcoes.filter(Boolean) : [];
  return options.length ? ` (${options.join(" / ")})` : "";
}

export function getServiceDisplayLabel(service: any) {
  if (!service) return "";
  const description = String(service.descricao || service.codigo || "").trim();
  if (!description) return "";
  return `${description}${getServiceOptionLabel(service)}`;
}

export function getExecutedActivities(rdo: Partial<RdoSabespData>) {
  return [...(rdo.servicos_esgoto || []), ...(rdo.servicos_agua || [])]
    .filter((service: any) => Number(service?.quantidade) > 0)
    .map((service: any) => ({
      id: `${service.codigo || "sem-codigo"}-${normalizeText(service.descricao)}`,
      label: `${getServiceDisplayLabel(service)} - ${Number(service.quantidade)} ${service.unidade || ""}`.trim(),
    }));
}

export function getRdoSabespExecutedServices(rdo: Partial<RdoSabespData>) {
  return [...(rdo.servicos_esgoto || []), ...(rdo.servicos_agua || [])]
    .filter((service: any) => Number(service?.quantidade) > 0)
    .map((service: any) => ({
      service_id: `${service.codigo || "sem-codigo"}-${normalizeText(service.descricao)}`,
      quantity: Number(service.quantidade) || 0,
      unit: service.unidade || "",
      services_catalog: {
        name: getServiceDisplayLabel(service) || service.descricao || "Servico Sabesp",
        unit: service.unidade || "",
      },
    }));
}

export function countExecutedServices(rdo: Partial<RdoSabespData>) {
  return [...(rdo.servicos_esgoto || []), ...(rdo.servicos_agua || [])].filter(
    (service: any) => Number(service?.quantidade) > 0,
  ).length;
}

export function sumExecutedQuantities(rdo: Partial<RdoSabespData>) {
  return [...(rdo.servicos_esgoto || []), ...(rdo.servicos_agua || [])].reduce(
    (total, service: any) => total + (Number(service?.quantidade) || 0),
    0,
  );
}

export function getRdoSabespDashboardMetrics(rdos: Array<Partial<RdoSabespData> & { status?: string | null }>) {
  const drafts = rdos.filter((rdo) => rdo.status === "draft").length;
  const finalized = rdos.filter((rdo) => rdo.status !== "draft").length;
  const withPhotos = rdos.filter((rdo) => Array.isArray(rdo.photo_paths) && rdo.photo_paths.length > 0).length;
  const totalActivities = rdos.reduce((total, rdo) => total + countExecutedServices(rdo), 0);
  const totalExecutedQuantity = rdos.reduce((total, rdo) => total + sumExecutedQuantities(rdo), 0);

  return {
    total: rdos.length,
    drafts,
    finalized,
    withPhotos,
    totalActivities,
    totalExecutedQuantity,
  };
}

export function compareRdoSabespData(
  current: Partial<RdoSabespData>,
  original: any,
  enabledGroups: ComparisonGroupId[],
) {
  const divergences: RdoSabespDivergence[] = [];
  const groups = new Set(enabledGroups);

  if (groups.has("header")) {
    pushDiff(divergences, "header", "Data", original?.report_date, current.report_date);
    pushDiff(divergences, "header", "Rua / Beco", original?.rua_beco, current.rua_beco);
    pushDiff(divergences, "header", "Encarregado", original?.encarregado, current.encarregado);
    pushDiff(
      divergences,
      "header",
      "Local / criadouro",
      getCriadouroLabel(original?.criadouro, original?.criadouro_outro),
      getCriadouroLabel(current.criadouro, current.criadouro_outro),
    );
  }

  if (groups.has("epi")) {
    pushDiff(divergences, "epi", "Uso de EPI", formatBool(original?.epi_utilizado), formatBool(current.epi_utilizado));
  }

  if (groups.has("climate")) {
    pushDiff(divergences, "climate", "Clima - Manha", original?.condicoes_climaticas?.manha, current.condicoes_climaticas?.manha);
    pushDiff(divergences, "climate", "Clima - Tarde", original?.condicoes_climaticas?.tarde, current.condicoes_climaticas?.tarde);
    pushDiff(divergences, "climate", "Clima - Noite", original?.condicoes_climaticas?.noite, current.condicoes_climaticas?.noite);
  }

  if (groups.has("quality")) {
    pushDiff(divergences, "quality", "Qualidade - Ordem de servico", formatBool(original?.qualidade?.ordem_servico), formatBool(current.qualidade?.ordem_servico));
    pushDiff(divergences, "quality", "Qualidade - Bandeirola", formatBool(original?.qualidade?.bandeirola), formatBool(current.qualidade?.bandeirola));
    pushDiff(divergences, "quality", "Qualidade - Projeto", formatBool(original?.qualidade?.projeto), formatBool(current.qualidade?.projeto));
    pushDiff(divergences, "quality", "Qualidade - Obs.", original?.qualidade?.obs, current.qualidade?.obs);
  }

  if (groups.has("stoppages")) {
    const max = Math.max(original?.paralisacoes?.length || 0, current.paralisacoes?.length || 0, 3);
    for (let index = 0; index < max; index += 1) {
      const originalItem = original?.paralisacoes?.[index];
      const currentItem = current.paralisacoes?.[index];
      pushDiff(divergences, "stoppages", `Paralisacao ${index + 1} - Motivo`, originalItem?.motivo, currentItem?.motivo);
      pushDiff(divergences, "stoppages", `Paralisacao ${index + 1} - Inicio`, originalItem?.inicio, currentItem?.inicio);
      pushDiff(divergences, "stoppages", `Paralisacao ${index + 1} - Fim`, originalItem?.fim, currentItem?.fim);
    }
    pushDiff(divergences, "stoppages", "Paralisacao - Outro", original?.paralisacao_outro, current.paralisacao_outro);
  }

  if (groups.has("hours")) {
    pushDiff(divergences, "hours", "Horario diurno - Inicio", original?.horarios?.diurno?.inicio, current.horarios?.diurno?.inicio);
    pushDiff(divergences, "hours", "Horario diurno - Fim", original?.horarios?.diurno?.fim, current.horarios?.diurno?.fim);
    pushDiff(divergences, "hours", "Horario noturno - Inicio", original?.horarios?.noturno?.inicio, current.horarios?.noturno?.inicio);
    pushDiff(divergences, "hours", "Horario noturno - Fim", original?.horarios?.noturno?.fim, current.horarios?.noturno?.fim);
  }

  if (groups.has("services")) {
    const currentServices = new Map(
      [...(current.servicos_esgoto || []), ...(current.servicos_agua || [])]
        .filter((service: any) => Number(service?.quantidade) > 0 || (service?.opcoes || []).length)
        .map((service: any) => [getServiceKey(service), service]),
    );
    const originalServices = new Map(
      [...(original?.servicos_esgoto || []), ...(original?.servicos_agua || [])]
        .filter((service: any) => Number(service?.quantidade) > 0 || (service?.opcoes || []).length)
        .map((service: any) => [getServiceKey(service), service]),
    );

    const keys = new Set([...currentServices.keys(), ...originalServices.keys()]);
    for (const key of keys) {
      const currentService = currentServices.get(key);
      const originalService = originalServices.get(key);
      const label = getServiceDisplayLabel(currentService || originalService) || "Servico";
      pushDiff(
        divergences,
        "services",
        `${label} - Quantidade`,
        originalService?.quantidade ?? 0,
        currentService?.quantidade ?? 0,
      );
      pushDiff(
        divergences,
        "services",
        `${label} - Opcoes`,
        (originalService?.opcoes || []).join(", "),
        (currentService?.opcoes || []).join(", "),
      );
    }
  }

  if (groups.has("signatures")) {
    pushDiff(divergences, "signatures", "Responsavel da empreiteira", original?.responsavel_empreiteira, current.responsavel_empreiteira);
    pushDiff(divergences, "signatures", "Responsavel do consorcio", original?.responsavel_consorcio, current.responsavel_consorcio);
    pushDiff(
      divergences,
      "signatures",
      "Assinatura da empreiteira",
      formatBool(Boolean(original?.assinatura_empreiteira_presente || original?.assinatura_empreiteira_url)),
      formatBool(Boolean(current.assinatura_empreiteira_url)),
    );
    pushDiff(
      divergences,
      "signatures",
      "Assinatura do consorcio",
      formatBool(Boolean(original?.assinatura_consorcio_presente || original?.assinatura_consorcio_url)),
      formatBool(Boolean(current.assinatura_consorcio_url)),
    );
  }

  return divergences;
}
