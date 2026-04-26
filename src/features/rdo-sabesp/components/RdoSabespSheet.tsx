/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import type { ReactElement } from "react";
import { Check as CheckIcon } from "lucide-react";
import { CRIADOUROS, MOTIVOS_PARALISACAO } from "../lib/rdoSabespCatalog";
import { cn } from "@/lib/utils";
import logoSabesp from "@/assets/logo-sabesp.png";
import logoCslnr from "@/assets/logo-cslnr.jpg";

interface SheetProps {
  data: any;
  set?: (path: string, val: any) => void;
  readOnly?: boolean;
  missing?: Set<string>;
}

const shell = "border border-black px-2 py-1.5 text-[11px] align-top leading-tight whitespace-normal break-words";
const head = "border border-black px-2 py-1.5 text-[11px] font-bold text-center bg-slate-200 whitespace-normal break-words";
const subhead = "border border-black px-2 py-1.5 text-[10px] font-bold text-center bg-slate-100 whitespace-normal break-words";
const orange = "border border-black px-2 py-1.5 text-[12px] font-bold text-center bg-orange-300";
const blue = "border border-black px-2 py-1.5 text-[12px] font-bold text-center bg-sky-300";

function Field({
  value,
  onChange,
  readOnly,
  missing,
  type = "text",
  className = "",
  placeholder,
}: {
  value: any;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  missing?: boolean;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  if (readOnly) {
    return (
      <div className={cn("min-h-[20px] whitespace-pre-wrap break-words", missing && "rounded bg-red-100 px-1 py-0.5 font-semibold text-red-700", className)}>
        {value || (missing ? "(faltando)" : "")}
      </div>
    );
  }

  return (
    <input
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        "h-8 w-full rounded-sm border border-transparent bg-transparent px-1.5 text-[11px] outline-none transition focus:border-slate-300 focus:bg-slate-50",
        missing && "border-red-400 bg-red-50",
        className,
      )}
    />
  );
}

function MultilineField({
  value,
  onChange,
  readOnly,
  rows = 2,
  missing,
  placeholder,
  className = "",
}: {
  value: any;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  rows?: number;
  missing?: boolean;
  placeholder?: string;
  className?: string;
}) {
  if (readOnly) {
    return (
      <div className={cn("min-h-[40px] whitespace-pre-wrap break-words", missing && "rounded bg-red-100 px-1 py-0.5 font-semibold text-red-700", className)}>
        {value || (missing ? "(faltando)" : "")}
      </div>
    );
  }

  return (
    <textarea
      value={value ?? ""}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        "w-full resize-none rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-[11px] leading-tight outline-none transition focus:border-slate-300 focus:bg-slate-50",
        missing && "border-red-400 bg-red-50",
        className,
      )}
    />
  );
}

function Check({
  checked,
  onToggle,
  readOnly,
  label,
  missing,
  compact = false,
}: {
  checked: boolean;
  onToggle?: () => void;
  readOnly?: boolean;
  label?: string;
  missing?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => !readOnly && onToggle?.()}
      className={cn(
        "inline-flex items-center rounded-md border border-slate-400 bg-white text-slate-700 transition",
        compact ? "gap-1 px-1.5 py-1 text-[10px]" : "gap-2 px-2 py-1 text-[11px]",
        checked && "border-emerald-600 bg-emerald-50 text-emerald-700",
        !readOnly && "hover:border-slate-500 hover:bg-slate-50",
        readOnly && "cursor-default",
        missing && "ring-1 ring-red-500 ring-offset-1",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-sm border transition",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
          checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400 bg-white text-transparent",
        )}
      >
        <CheckIcon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      </span>
      {label && <span className="text-left leading-tight whitespace-normal break-words">{label}</span>}
    </button>
  );
}

function ServiceOptions({
  service,
  readOnly,
  onToggle,
}: {
  service: any;
  readOnly?: boolean;
  onToggle: (option: string) => void;
}) {
  const available = Array.isArray(service?.opcoesDisponiveis) ? service.opcoesDisponiveis : [];
  const selected = Array.isArray(service?.opcoes) ? service.opcoes : [];

  if (!available.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {available.map((option: string) => (
        <Check
          key={option}
          checked={selected.includes(option)}
          onToggle={() => onToggle(option)}
          readOnly={readOnly}
          label={option}
          compact
        />
      ))}
    </div>
  );
}

function SectionTable({
  title,
  rows,
  renderRow,
  headers,
  titleClassName,
}: {
  title: string;
  rows: number;
  headers: string[];
  renderRow: (index: number) => ReactElement;
  titleClassName?: string;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th colSpan={headers.length} className={cn("border border-black px-2 py-1.5 text-center text-[11px] font-bold", titleClassName)}>
            {title}
          </th>
        </tr>
        <tr>
          {headers.map((header) => (
            <th key={header} className={subhead}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{Array.from({ length: rows }).map((_, index) => renderRow(index))}</tbody>
    </table>
  );
}

export function RdoSabespSheet({ data, set, readOnly = false, missing = new Set<string>() }: SheetProps) {
  const m = (key: string) => missing.has(key);
  const cc = data.condicoes_climaticas || {};
  const q = data.qualidade || {};
  const h = data.horarios || {};
  const stoppages = data.paralisacoes || [];
  const workforces = data.mao_de_obra || [];
  const equipments = data.equipamentos || [];
  const esgoto = data.servicos_esgoto || [];
  const agua = data.servicos_agua || [];

  const setClimate = (value: string, period: "manha" | "tarde" | "noite") => {
    if (!set) return;
    set(`condicoes_climaticas.${period}`, cc[period] === value ? "" : value);
  };

  const updateRow = (path: "mao_de_obra" | "equipamentos", index: number, field: string, value: any) => {
    if (!set) return;
    const rows = [...data[path]];
    rows[index] = { ...rows[index], [field]: value };
    set(path, rows);
  };

  const updateService = (path: "servicos_esgoto" | "servicos_agua", index: number, field: string, value: any) => {
    if (!set) return;
    const rows = [...data[path]];
    rows[index] = { ...rows[index], [field]: field === "quantidade" ? Number(value) || 0 : value };
    set(path, rows);
  };

  const toggleServiceOption = (path: "servicos_esgoto" | "servicos_agua", index: number, option: string) => {
    if (!set) return;
    const rows = [...data[path]];
    const row = rows[index] || {};
    const current = Array.isArray(row.opcoes) ? row.opcoes : [];
    rows[index] = {
      ...row,
      opcoes: current.includes(option) ? current.filter((item: string) => item !== option) : [...current, option],
    };
    set(path, rows);
  };

  const addServiceRow = (path: "servicos_esgoto" | "servicos_agua") => {
    if (!set) return;
    const rows = [...data[path]];
    rows.push({
      codigo: "",
      descricao: "",
      unidade: "UN",
      quantidade: 0,
      opcoes: [],
      opcoesDisponiveis: [],
    });
    set(path, rows);
  };

  const maxRows = Math.max(workforces.length, 8);
  const maxEquipments = Math.max(equipments.length, 7);
  const maxServices = Math.max(esgoto.length, agua.length);
  const qualityMissing = m("qualidade.ordem_servico") || m("qualidade.bandeirola") || m("qualidade.projeto");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse bg-white text-black">
          <tbody>
            <tr>
              <td className={shell} colSpan={2}>
                <img src={logoSabesp} alt="Sabesp" className="mx-auto h-12 object-contain" />
              </td>
              <td className="border border-black px-2 py-1.5 text-center text-[15px] font-bold" colSpan={5}>
                RELATÓRIO DIÁRIO DE OBRA (RDO)
              </td>
              <td className={shell} colSpan={5}>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Local / criadouro</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CRIADOUROS.map((item) => (
                      <Check
                        key={item.value}
                        checked={data.criadouro === item.value}
                        onToggle={() => set?.("criadouro", data.criadouro === item.value ? "" : item.value)}
                        readOnly={readOnly}
                        label={item.label}
                        missing={m("criadouro")}
                      />
                    ))}
                  </div>
                </div>
              </td>
              <td className={shell} colSpan={2}>
                <img src={logoCslnr} alt="CSLNR" className="mx-auto h-12 object-contain" />
              </td>
            </tr>

            <tr>
              <td className={cn(shell, "font-bold")} colSpan={1}>RUA / BECO</td>
              <td className={shell} colSpan={5}>
                <Field value={data.rua_beco} onChange={(value) => set?.("rua_beco", value)} readOnly={readOnly} missing={m("rua_beco")} />
              </td>
              <td className={cn(shell, "font-bold")} colSpan={1}>ENCARREGADO</td>
              <td className={shell} colSpan={4}>
                <Field value={data.encarregado} onChange={(value) => set?.("encarregado", value)} readOnly={readOnly} missing={m("encarregado")} />
              </td>
              <td className={cn(shell, "font-bold")} colSpan={1}>DATA</td>
              <td className={shell} colSpan={2}>
                <Field type="date" value={data.report_date} onChange={(value) => set?.("report_date", value)} readOnly={readOnly} missing={m("report_date")} className="min-w-[128px]" />
              </td>
            </tr>

            {data.criadouro === "outro" && (
              <tr>
                <td className={cn(shell, "font-bold")} colSpan={2}>DESCRIÇÃO DO LOCAL</td>
                <td className={shell} colSpan={12}>
                  <Field
                    value={data.criadouro_outro}
                    onChange={(value) => set?.("criadouro_outro", value)}
                    readOnly={readOnly}
                    placeholder="Informe o local quando não estiver na lista."
                  />
                </td>
              </tr>
            )}

            <tr>
              <td className={cn(shell, "font-bold")} colSpan={8}>
                1. TODOS OS FUNCIONÁRIOS DA OBRA DA ATIVIDADE ESTÃO UTILIZANDO OS EPI&apos;s?
              </td>
              <td className={shell} colSpan={4}>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Check checked={data.epi_utilizado === true} onToggle={() => set?.("epi_utilizado", true)} readOnly={readOnly} label="SIM" missing={m("epi_utilizado")} />
                  <Check checked={data.epi_utilizado === false} onToggle={() => set?.("epi_utilizado", false)} readOnly={readOnly} label="NÃO" missing={m("epi_utilizado")} />
                </div>
              </td>
              <td className={shell} colSpan={2}>
                <div className="text-[10px] text-slate-600">
                  {readOnly ? "Revise visualmente assinatura, marcações e quebra de linha no preview." : "Use a revisão para validar antes de exportar."}
                </div>
              </td>
            </tr>

            <tr>
              <td className={head} colSpan={4}>CONDIÇÕES CLIMÁTICAS</td>
              <td className={head} colSpan={3}>QUALIDADE</td>
              <td className={head} colSpan={4}>PARALISAÇÕES DE OBRA</td>
              <td className={head} colSpan={3}>HORÁRIO DAS ATIVIDADES</td>
            </tr>

            <tr>
              <td className={subhead}>PERÍODO</td>
              <td className={subhead}>BOM</td>
              <td className={subhead}>CHUVA</td>
              <td className={subhead}>IMPRODUTIVO</td>
              <td className={shell} colSpan={3} rowSpan={4}>
                <div className={cn("space-y-2 rounded-md border border-dashed border-slate-300 p-2", qualityMissing && "border-red-400 bg-red-50/60")}>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Checklist</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Check checked={!!q.ordem_servico} onToggle={() => set?.("qualidade.ordem_servico", !q.ordem_servico)} readOnly={readOnly} label="Ordem de Serviço" missing={qualityMissing} />
                      <Check checked={!!q.bandeirola} onToggle={() => set?.("qualidade.bandeirola", !q.bandeirola)} readOnly={readOnly} label="Bandeirola" missing={qualityMissing} />
                      <Check checked={!!q.projeto} onToggle={() => set?.("qualidade.projeto", !q.projeto)} readOnly={readOnly} label="Projeto" missing={qualityMissing} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Observação</div>
                    <MultilineField value={q.obs} onChange={(value) => set?.("qualidade.obs", value)} readOnly={readOnly} rows={4} />
                  </div>
                </div>
              </td>
              <td className={subhead}>PERÍODO</td>
              <td className={subhead}>MOTIVO</td>
              <td className={subhead}>INÍCIO</td>
              <td className={subhead}>FIM</td>
              <td className={shell} colSpan={3} rowSpan={4}>
                <div className="space-y-3 rounded-md border border-dashed border-slate-300 p-2">
                  {(["diurno", "noturno"] as const).map((period) => (
                    <div key={period} className="space-y-1 rounded-md border border-slate-200 p-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">{period}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="mb-1 text-[10px] text-slate-500">Início</div>
                          <Field type="time" value={h[period]?.inicio} readOnly={readOnly} onChange={(value) => set?.(`horarios.${period}.inicio`, value)} />
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] text-slate-500">Fim</div>
                          <Field type="time" value={h[period]?.fim} readOnly={readOnly} onChange={(value) => set?.(`horarios.${period}.fim`, value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </td>
            </tr>

            {(["manha", "tarde", "noite"] as const).map((period, index) => {
              const label = period === "manha" ? "Manhã" : period === "tarde" ? "Tarde" : "Noite";
              const stoppage = stoppages[index] || {};

              return (
                <tr key={period}>
                  <td className={cn(shell, "text-center font-bold")}>{label}</td>
                  {(["bom", "chuva", "improdutivo"] as const).map((climate) => (
                    <td key={climate} className={cn(shell, "text-center")}>
                      <div className="flex justify-center">
                        <Check
                          checked={cc[period] === climate}
                          onToggle={() => setClimate(climate, period)}
                          readOnly={readOnly}
                          missing={m(`condicoes_climaticas.${period}`)}
                          compact
                        />
                      </div>
                    </td>
                  ))}
                  <td className={cn(shell, "text-center font-bold")}>{label}</td>
                  <td className={shell}>
                    {readOnly ? (
                      <div className="min-h-[20px] whitespace-pre-wrap break-words">{stoppage.motivo || ""}</div>
                    ) : (
                      <select
                        value={stoppage.motivo || ""}
                        onChange={(e) => {
                          const rows = [...stoppages];
                          while (rows.length <= index) rows.push({});
                          rows[index] = { ...rows[index], motivo: e.target.value };
                          set?.("paralisacoes", rows);
                        }}
                        className="h-8 w-full rounded-sm border border-transparent bg-transparent px-1.5 text-[11px] outline-none transition focus:border-slate-300 focus:bg-slate-50"
                      >
                        <option value="">Selecione</option>
                        {MOTIVOS_PARALISACAO.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className={shell}>
                    <Field
                      type="time"
                      value={stoppage.inicio}
                      readOnly={readOnly}
                      onChange={(value) => {
                        const rows = [...stoppages];
                        while (rows.length <= index) rows.push({});
                        rows[index] = { ...rows[index], inicio: value };
                        set?.("paralisacoes", rows);
                      }}
                    />
                  </td>
                  <td className={shell}>
                    <Field
                      type="time"
                      value={stoppage.fim}
                      readOnly={readOnly}
                      onChange={(value) => {
                        const rows = [...stoppages];
                        while (rows.length <= index) rows.push({});
                        rows[index] = { ...rows[index], fim: value };
                        set?.("paralisacoes", rows);
                      }}
                    />
                  </td>
                </tr>
              );
            })}

            {(stoppages.some((item: any) => item?.motivo === "Outro") || data.paralisacao_outro) && (
              <tr>
                <td className={cn(shell, "font-bold")} colSpan={2}>PARALISAÇÃO - OUTRO</td>
                <td className={shell} colSpan={12}>
                  <MultilineField
                    value={data.paralisacao_outro}
                    onChange={(value) => set?.("paralisacao_outro", value)}
                    readOnly={readOnly}
                    rows={2}
                    placeholder="Descreva aqui o motivo da paralisação."
                  />
                </td>
              </tr>
            )}

            <tr>
              <td className={shell} colSpan={7}>
                <SectionTable
                  title="MÃO DE OBRA"
                  titleClassName="bg-slate-200"
                  headers={["DESCRIÇÃO DE CARGOS", "TERC.", "CONTRAT."]}
                  rows={maxRows}
                  renderRow={(index) => {
                    const row = workforces[index];
                    return (
                      <tr key={`workforce-${index}`}>
                        <td className={shell}>
                          <MultilineField value={row?.cargo} onChange={(value) => updateRow("mao_de_obra", index, "cargo", value)} readOnly={readOnly} rows={2} />
                        </td>
                        <td className={shell}>
                          <Field type="number" value={row?.terc} onChange={(value) => updateRow("mao_de_obra", index, "terc", Number(value) || 0)} readOnly={readOnly} className="text-center" />
                        </td>
                        <td className={shell}>
                          <Field type="number" value={row?.contrat} onChange={(value) => updateRow("mao_de_obra", index, "contrat", Number(value) || 0)} readOnly={readOnly} className="text-center" />
                        </td>
                      </tr>
                    );
                  }}
                />
                {!readOnly && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => addServiceRow("servicos_esgoto")}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Adicionar Atividades
                    </button>
                  </div>
                )}
              </td>
              <td className={shell} colSpan={7}>
                <SectionTable
                  title="EQUIPAMENTOS / VEÍCULOS"
                  titleClassName="bg-slate-200"
                  headers={["DESCRIÇÃO DOS EQUIPAMENTOS", "TERC.", "CONTRAT."]}
                  rows={maxEquipments}
                  renderRow={(index) => {
                    const row = equipments[index];
                    return (
                      <tr key={`equipment-${index}`}>
                        <td className={shell}>
                          <MultilineField value={row?.descricao} onChange={(value) => updateRow("equipamentos", index, "descricao", value)} readOnly={readOnly} rows={2} />
                        </td>
                        <td className={shell}>
                          <Field type="number" value={row?.terc} onChange={(value) => updateRow("equipamentos", index, "terc", Number(value) || 0)} readOnly={readOnly} className="text-center" />
                        </td>
                        <td className={shell}>
                          <Field type="number" value={row?.contrat} onChange={(value) => updateRow("equipamentos", index, "contrat", Number(value) || 0)} readOnly={readOnly} className="text-center" />
                        </td>
                      </tr>
                    );
                  }}
                />
              </td>
            </tr>

            <tr>
              <td className={orange} colSpan={7}>ESGOTO</td>
              <td className={blue} colSpan={7}>ÁGUA</td>
            </tr>
            <tr>
              <td className={shell} colSpan={7}>
                <SectionTable
                  title="ATIVIDADES EXECUTADAS - ESGOTO"
                  titleClassName="bg-orange-100"
                  headers={["CÓDIGO", "ATIVIDADE", "EXECUTADO", "UN"]}
                  rows={maxServices}
                  renderRow={(index) => {
                    const service = esgoto[index];
                    return (
                      <tr key={`esgoto-${index}`}>
                        <td className={shell}>
                          <Field value={service?.codigo} onChange={(value) => updateService("servicos_esgoto", index, "codigo", value)} readOnly={readOnly} className="text-[10px]" />
                        </td>
                        <td className={shell}>
                          <div className="space-y-1">
                            <MultilineField value={service?.descricao} onChange={(value) => updateService("servicos_esgoto", index, "descricao", value)} readOnly={readOnly} rows={3} className="text-[10px]" />
                            <ServiceOptions service={service} readOnly={readOnly} onToggle={(option) => toggleServiceOption("servicos_esgoto", index, option)} />
                          </div>
                        </td>
                        <td className={shell}>
                          <Field type="number" value={service?.quantidade} onChange={(value) => updateService("servicos_esgoto", index, "quantidade", value)} readOnly={readOnly} className="text-center text-[10px]" />
                        </td>
                        <td className={shell}>
                          <Field value={service?.unidade} onChange={(value) => updateService("servicos_esgoto", index, "unidade", value)} readOnly={readOnly} className="text-center text-[10px]" />
                        </td>
                      </tr>
                    );
                  }}
                />
                {!readOnly && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => addServiceRow("servicos_esgoto")}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Adicionar Atividades
                    </button>
                  </div>
                )}
              </td>
              <td className={shell} colSpan={7}>
                <SectionTable
                  title="ATIVIDADES EXECUTADAS - ÁGUA"
                  titleClassName="bg-sky-100"
                  headers={["CÓDIGO", "ATIVIDADE", "EXECUTADO", "UN"]}
                  rows={maxServices}
                  renderRow={(index) => {
                    const service = agua[index];
                    return (
                      <tr key={`agua-${index}`}>
                        <td className={shell}>
                          <Field value={service?.codigo} onChange={(value) => updateService("servicos_agua", index, "codigo", value)} readOnly={readOnly} className="text-[10px]" />
                        </td>
                        <td className={shell}>
                          <div className="space-y-1">
                            <MultilineField value={service?.descricao} onChange={(value) => updateService("servicos_agua", index, "descricao", value)} readOnly={readOnly} rows={3} className="text-[10px]" />
                            <ServiceOptions service={service} readOnly={readOnly} onToggle={(option) => toggleServiceOption("servicos_agua", index, option)} />
                          </div>
                        </td>
                        <td className={shell}>
                          <Field type="number" value={service?.quantidade} onChange={(value) => updateService("servicos_agua", index, "quantidade", value)} readOnly={readOnly} className="text-center text-[10px]" />
                        </td>
                        <td className={shell}>
                          <Field value={service?.unidade} onChange={(value) => updateService("servicos_agua", index, "unidade", value)} readOnly={readOnly} className="text-center text-[10px]" />
                        </td>
                      </tr>
                    );
                  }}
                />
                {!readOnly && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => addServiceRow("servicos_agua")}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Adicionar Atividades
                    </button>
                  </div>
                )}
              </td>
            </tr>

            <tr>
              <td className={head} colSpan={14}>OBSERVAÇÕES</td>
            </tr>
            <tr>
              <td className={shell} colSpan={14}>
                <MultilineField
                  value={data.observacoes}
                  onChange={(value) => set?.("observacoes", value)}
                  readOnly={readOnly}
                  rows={4}
                  placeholder="Observações gerais da frente de serviço."
                />
              </td>
            </tr>

            <tr>
              <td className={shell} colSpan={7}>
                <div className="pt-4 text-center">
                  {data.assinatura_empreiteira_url && (
                    <img src={data.assinatura_empreiteira_url} alt="Assinatura empreiteira" className="mx-auto mb-2 h-14 max-w-full object-contain" />
                  )}
                  <div className="border-t border-black pt-2">
                    <Field value={data.responsavel_empreiteira} onChange={(value) => set?.("responsavel_empreiteira", value)} readOnly={readOnly} className="text-center" placeholder="Nome do responsável" />
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]">Responsável da empreiteira</div>
                  </div>
                </div>
              </td>
              <td className={shell} colSpan={7}>
                <div className="pt-4 text-center">
                  {data.assinatura_consorcio_url && (
                    <img src={data.assinatura_consorcio_url} alt="Assinatura consórcio" className="mx-auto mb-2 h-14 max-w-full object-contain" />
                  )}
                  <div className="border-t border-black pt-2">
                    <Field value={data.responsavel_consorcio} onChange={(value) => set?.("responsavel_consorcio", value)} readOnly={readOnly} className="text-center" placeholder="Nome do responsável" />
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]">Responsável do consórcio</div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function getMissingRequired(data: any): Set<string> {
  const missing = new Set<string>();
  const required: Array<[string, () => boolean]> = [
    ["report_date", () => !data.report_date],
    ["rua_beco", () => !data.rua_beco?.trim()],
    ["encarregado", () => !data.encarregado?.trim()],
    ["criadouro", () => !data.criadouro],
    ["epi_utilizado", () => data.epi_utilizado !== true && data.epi_utilizado !== false],
    ["condicoes_climaticas.manha", () => !data.condicoes_climaticas?.manha],
    ["condicoes_climaticas.tarde", () => !data.condicoes_climaticas?.tarde],
    ["condicoes_climaticas.noite", () => !data.condicoes_climaticas?.noite],
  ];

  for (const [path, predicate] of required) {
    if (predicate()) missing.add(path);
  }

  const quality = data.qualidade || {};
  if (!quality.ordem_servico && !quality.bandeirola && !quality.projeto) {
    missing.add("qualidade.ordem_servico");
    missing.add("qualidade.bandeirola");
    missing.add("qualidade.projeto");
  }

  return missing;
}

export const REQUIRED_LABELS: Record<string, string> = {
  report_date: "Data",
  rua_beco: "Rua / Beco",
  encarregado: "Encarregado",
  criadouro: "Criadouro",
  epi_utilizado: "EPI utilizado (Sim/Nao)",
  "condicoes_climaticas.manha": "Condicao climatica - Manha",
  "condicoes_climaticas.tarde": "Condicao climatica - Tarde",
  "condicoes_climaticas.noite": "Condicao climatica - Noite",
  "qualidade.ordem_servico": "Qualidade (marcar OS, Bandeirola ou Projeto)",
  "qualidade.bandeirola": "Qualidade (marcar OS, Bandeirola ou Projeto)",
  "qualidade.projeto": "Qualidade (marcar OS, Bandeirola ou Projeto)",
};
