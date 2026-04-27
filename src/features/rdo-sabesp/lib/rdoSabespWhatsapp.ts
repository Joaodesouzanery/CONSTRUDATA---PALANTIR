/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CARGOS_PADRAO,
  CRIADOUROS,
  EQUIPAMENTOS_PADRAO,
  SERVICOS_AGUA,
  SERVICOS_ESGOTO,
} from "./rdoSabespCatalog";

export const RDO_SABESP_WHATSAPP_TEMPLATE = `RDO SABESP - MODELO PADRAO

Data: 2026-04-26
Rua/Beco: Rua Exemplo, 123
Criadouro: Sao Manoel
Encarregado: Nome do encarregado
EPI utilizado: Sim

Clima manha: bom
Clima tarde: chuva
Clima noite: improdutivo

Qualidade ordem de servico: Sim
Qualidade bandeirola: Sim
Qualidade projeto: Sim
Qualidade observacao: Sem observacoes.

Paralisacao manha motivo:
Paralisacao manha inicio:
Paralisacao manha fim:
Paralisacao tarde motivo: Chuva / Alagamento
Paralisacao tarde inicio: 13:00
Paralisacao tarde fim: 15:00
Paralisacao noite motivo:
Paralisacao noite inicio:
Paralisacao noite fim:
Paralisacao outro:

Horario diurno inicio: 07:00
Horario diurno fim: 17:00
Horario noturno inicio:
Horario noturno fim:

Mao de obra:
- ENGENHEIRO | terc: 1 | contrat: 0
- ENCARREGADO DE OBRAS | terc: 1 | contrat: 0
- SERVICOS GERAIS / AJUDANTE | terc: 4 | contrat: 0

Equipamentos:
- RETROESCAVADEIRA | terc: 1 | contrat: 0
- CAMINHAO BASCULANTE | terc: 2 | contrat: 0

Servicos esgoto:
- 420009 | quantidade: 12,5 | unidade: M
- 500019 | quantidade: 3 | unidade: UN

Servicos agua:
- 410355 | quantidade: 25 | unidade: M
- 500033 | quantidade: 2 | unidade: UN

Responsavel empreiteira: Nome da empreiteira
Responsavel consorcio: Nome do consorcio
Observacoes: Campo livre para ocorrencias e comentarios do dia.`;

const SECTION_NAMES = [
  "mao de obra",
  "equipamentos",
  "servicos esgoto",
  "servicos de esgoto",
  "servicos agua",
  "servicos de agua",
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, "")
    .replace(/[^\w\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const normalizeKey = (value: unknown) => normalize(value).replace(/[/_.-]+/g, " ").replace(/\s+/g, " ").trim();

const parseNumber = (value: unknown) => {
  const cleaned = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseBoolean = (value: string) => {
  const v = normalize(value);
  if (/\b(sim|s|yes|true|ok|x)\b/.test(v)) return true;
  if (/\b(nao|n|no|false)\b/.test(v)) return false;
  return null;
};

const parseClimate = (value: string) => {
  const v = normalize(value);
  if (!v) return "";
  if (v.includes("chuva")) return "chuva";
  if (v.includes("improdutivo") || v.includes("parado") || v.includes("sem atividade")) return "improdutivo";
  return "bom";
};

const parseDate = (value: string) => {
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = value.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  return "";
};

const parseLineMap = (text: string) => {
  const map = new Map<string, string>();
  const lines = text.replace(/\r/g, "").split("\n");

  for (const line of lines) {
    const match = line.match(/^\s*([^:]+?)\s*[:：]\s*(.*)$/);
    if (!match) continue;
    const key = normalizeKey(match[1]);
    const value = match[2].trim();
    if (key && !SECTION_NAMES.includes(key)) map.set(key, value);
  }

  return map;
};

const getValue = (map: Map<string, string>, labels: string[]) => {
  for (const label of labels) {
    const exact = map.get(normalizeKey(label));
    if (exact !== undefined) return exact;
  }

  for (const [key, value] of map.entries()) {
    if (labels.some((label) => key.includes(normalizeKey(label)))) return value;
  }

  return "";
};

const getCriadouroValue = (value: string) => {
  const normalized = normalize(value);
  const found = CRIADOUROS.find((item) => normalize(item.label) === normalized || normalized.includes(normalize(item.label)));
  if (found) return { criadouro: found.value, criadouro_outro: found.value === "outro" ? value : "" };

  if (normalized.includes("manoel")) return { criadouro: "sao_manoel", criadouro_outro: "" };
  if (normalized.includes("teteu")) return { criadouro: "morro_do_teteu", criadouro_outro: "" };
  if (normalized.includes("joao") || normalized.includes("carlos")) return { criadouro: "joao_carlos", criadouro_outro: "" };
  if (normalized.includes("pantanal")) return { criadouro: "pantanal_baixo", criadouro_outro: "" };
  if (normalized.includes("israel")) return { criadouro: "vila_israel", criadouro_outro: "" };
  return value.trim() ? { criadouro: "outro", criadouro_outro: value.trim() } : { criadouro: "", criadouro_outro: "" };
};

const getSectionRows = (text: string, names: string[]) => {
  const targetNames = names.map(normalizeKey);
  const rows: string[] = [];
  let active = false;

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^([^:]+?)\s*:\s*$/);
    if (sectionMatch) {
      const sectionName = normalizeKey(sectionMatch[1]);
      active = targetNames.includes(sectionName);
      continue;
    }

    if (active && SECTION_NAMES.includes(normalizeKey(line.replace(/:$/, "")))) break;
    if (active && line) rows.push(line.replace(/^\s*[-*]\s*/, ""));
  }

  return rows;
};

const parseStructuredRow = (line: string) => {
  const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
  const first = parts.shift() || "";
  const values = new Map<string, string>();

  for (const part of parts) {
    const [key, ...rest] = part.split(":");
    if (!key || rest.length === 0) continue;
    values.set(normalizeKey(key), rest.join(":").trim());
  }

  return { first, values };
};

const parsePeopleRows = (text: string) => {
  const base = CARGOS_PADRAO.map((cargo) => ({ cargo, terc: 0, contrat: 0 }));
  const rows = getSectionRows(text, ["Mao de obra", "Mão de obra"]);

  for (const line of rows) {
    const { first, values } = parseStructuredRow(line);
    const cargo = first.trim();
    if (!cargo) continue;
    const index = base.findIndex((item) => normalize(item.cargo) === normalize(cargo));
    const next = {
      cargo,
      terc: parseNumber(values.get("terc")),
      contrat: parseNumber(values.get("contrat") || values.get("contratado")),
    };
    if (index >= 0) base[index] = { ...base[index], ...next };
    else base.push(next);
  }

  return base;
};

const parseEquipmentRows = (text: string) => {
  const base = EQUIPAMENTOS_PADRAO.map((descricao) => ({ descricao, terc: 0, contrat: 0 }));
  const rows = getSectionRows(text, ["Equipamentos"]);

  for (const line of rows) {
    const { first, values } = parseStructuredRow(line);
    const descricao = first.trim();
    if (!descricao) continue;
    const index = base.findIndex((item) => normalize(item.descricao) === normalize(descricao));
    const next = {
      descricao,
      terc: parseNumber(values.get("terc")),
      contrat: parseNumber(values.get("contrat") || values.get("contratado")),
    };
    if (index >= 0) base[index] = { ...base[index], ...next };
    else base.push(next);
  }

  return base;
};

const parseServiceRows = (text: string, sectionNames: string[], catalog: typeof SERVICOS_ESGOTO) => {
  const base = catalog.map((service) => ({ ...service, quantidade: 0, opcoes: [] as string[] }));
  const rows = getSectionRows(text, sectionNames);

  for (const line of rows) {
    const { first, values } = parseStructuredRow(line);
    const codeOrDescription = first.trim();
    if (!codeOrDescription) continue;

    const catalogIndex = base.findIndex((service) => {
      const byCode = service.codigo && normalize(service.codigo) === normalize(codeOrDescription);
      const byDescription = normalize(service.descricao) === normalize(codeOrDescription);
      return byCode || byDescription;
    });
    const catalogService = catalogIndex >= 0 ? base[catalogIndex] : undefined;
    const options = String(values.get("opcoes") || values.get("opcoes selecionadas") || "")
      .split(/[,/;]/)
      .map((item) => item.trim())
      .filter(Boolean);

    const next = {
      ...(catalogService || { codigo: /^\d+$/.test(codeOrDescription) ? codeOrDescription : "", descricao: codeOrDescription, unidade: "UN" as const }),
      quantidade: parseNumber(values.get("quantidade") || values.get("qtd")),
      unidade: (values.get("unidade") || catalogService?.unidade || "UN").toUpperCase(),
      opcoes: options,
    };

    if (catalogIndex >= 0) base[catalogIndex] = next as any;
    else base.push(next as any);
  }

  return base;
};

export function parseRdoSabespWhatsappText(text: string) {
  const map = parseLineMap(text);
  const reportDate = parseDate(getValue(map, ["Data", "Report date"])) || parseDate(text);
  const criadouroText = getValue(map, ["Criadouro", "Local", "Nucleo", "Núcleo"]);
  const criadouro = getCriadouroValue(criadouroText);

  return {
    ...(reportDate ? { report_date: reportDate } : {}),
    rua_beco: getValue(map, ["Rua/Beco", "Rua", "Beco", "Endereco", "Endereço"]),
    encarregado: getValue(map, ["Encarregado", "Responsavel", "Responsável"]),
    ...criadouro,
    epi_utilizado: parseBoolean(getValue(map, ["EPI utilizado", "EPI", "Todos utilizam EPI"])),
    condicoes_climaticas: {
      manha: parseClimate(getValue(map, ["Clima manha", "Clima manhã", "Condicao climatica manha", "Condição climática manhã"])),
      tarde: parseClimate(getValue(map, ["Clima tarde", "Condicao climatica tarde", "Condição climática tarde"])),
      noite: parseClimate(getValue(map, ["Clima noite", "Condicao climatica noite", "Condição climática noite"])),
    },
    qualidade: {
      ordem_servico: parseBoolean(getValue(map, ["Qualidade ordem de servico", "Qualidade OS", "Ordem de servico"])) === true,
      bandeirola: parseBoolean(getValue(map, ["Qualidade bandeirola", "Bandeirola"])) === true,
      projeto: parseBoolean(getValue(map, ["Qualidade projeto", "Projeto"])) === true,
      obs: getValue(map, ["Qualidade observacao", "Qualidade observação", "Observacao qualidade"]),
    },
    paralisacoes: (["manha", "tarde", "noite"] as const).map((period) => ({
      motivo: getValue(map, [`Paralisacao ${period} motivo`, `Paralisação ${period} motivo`]),
      inicio: getValue(map, [`Paralisacao ${period} inicio`, `Paralisação ${period} início`]),
      fim: getValue(map, [`Paralisacao ${period} fim`, `Paralisação ${period} fim`]),
    })),
    paralisacao_outro: getValue(map, ["Paralisacao outro", "Paralisação outro"]),
    horarios: {
      diurno: {
        inicio: getValue(map, ["Horario diurno inicio", "Horário diurno início"]),
        fim: getValue(map, ["Horario diurno fim", "Horário diurno fim"]),
      },
      noturno: {
        inicio: getValue(map, ["Horario noturno inicio", "Horário noturno início"]),
        fim: getValue(map, ["Horario noturno fim", "Horário noturno fim"]),
      },
    },
    mao_de_obra: parsePeopleRows(text),
    equipamentos: parseEquipmentRows(text),
    servicos_esgoto: parseServiceRows(text, ["Servicos esgoto", "Serviços esgoto", "Servicos de esgoto"], SERVICOS_ESGOTO),
    servicos_agua: parseServiceRows(text, ["Servicos agua", "Serviços água", "Servicos de agua"], SERVICOS_AGUA),
    responsavel_empreiteira: getValue(map, ["Responsavel empreiteira", "Responsável empreiteira"]),
    responsavel_consorcio: getValue(map, ["Responsavel consorcio", "Responsável consórcio"]),
    observacoes: getValue(map, ["Observacoes", "Observações", "Obs"]),
  };
}

export function downloadRdoSabespWhatsappTemplate() {
  const blob = new Blob([RDO_SABESP_WHATSAPP_TEMPLATE], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-rdo-sabesp-whatsapp.txt";
  link.click();
  URL.revokeObjectURL(url);
}
