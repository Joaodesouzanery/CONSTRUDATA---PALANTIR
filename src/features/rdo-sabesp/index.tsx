/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isNonProductionDataMode } from "@/lib/runtimeMode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  FileDown,
  MessageSquare,
  Pencil,
  Trash2,
  Package,
  Loader2,
  Plus,
  Upload,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  ImageOff,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { RdoHeader } from "@/features/rdo/components/RdoHeader";
import { useContractorStore } from "@/store/contractorStore";
import { RdoSabespForm } from "./components/RdoSabespForm";
import { Checkbox } from "@/components/ui/checkbox";
import { getCriadouroLabel, getExecutedActivities, getRdoSabespDashboardMetrics, getRdoSabespExecutedServices, sumExecutedQuantities } from "./lib/rdoSabespUtils";
import {
  isLocalRdoSabespId,
  mergeRdoSabespRemoteWithLocal,
  readLocalRdoSabesp,
  removeLocalRdoSabesp,
  writeLocalRdoSabesp,
} from "./lib/rdoSabespLocalStore";

type PeriodFilter = "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "custom";

const periodLabels: Record<PeriodFilter, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  custom: "Período selecionado",
};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, message: string) => {
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

const getDateRangeForPeriod = (period: PeriodFilter, customStart: string, customEnd: string) => {
  if (period === "custom") {
    if (customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return null;
  }

  const end = getTodayDateString();
  const start = new Date(`${end}T12:00:00`);

  switch (period) {
    case "daily":
      break;
    case "weekly":
      start.setDate(start.getDate() - 6);
      break;
    case "monthly":
      start.setMonth(start.getMonth() - 1);
      break;
    case "quarterly":
      start.setMonth(start.getMonth() - 3);
      break;
    case "semiannual":
      start.setMonth(start.getMonth() - 6);
      break;
    case "annual":
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return {
    start: start.toISOString().slice(0, 10),
    end,
  };
};

export function RdoSabespPage() {
  const [list, setList] = useState<any[]>(() => readLocalRdoSabesp());
  const [editing, setEditing] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [formInitialStep, setFormInitialStep] = useState<"import" | "edit" | "review">("import");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("monthly");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [openedFromQuery, setOpenedFromQuery] = useState(false);
  const contractorStore = useContractorStore();
  const measurementSources = useContractorStore((state) => state.measurementSources);

  useEffect(() => {
    void contractorStore.load();
  }, [contractorStore.load]);

  const load = useCallback(async () => {
    const localRows = readLocalRdoSabesp();
    setList(localRows);

    if (isNonProductionDataMode()) return;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("rdo_sabesp" as any)
          .select("*")
          .is("deleted_at", null)
          .order("report_date", { ascending: false }),
        8_000,
        "timeout ao carregar RDO Sabesp",
      );

      if (error) throw error;
      const merged = mergeRdoSabespRemoteWithLocal(data || [], readLocalRdoSabesp(true));
      writeLocalRdoSabesp(merged);
      setList(merged);
    } catch (error: any) {
      console.warn("[rdo-sabesp] usando cache local", error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openedFromQuery || !list.length) return;
    const rdoId = new URLSearchParams(window.location.search).get("rdo");
    if (!rdoId) return;
    const match = list.find((item) => item.id === rdoId);
    if (!match) return;
    setEditing(match);
    setFormInitialStep("review");
    setShowNew(false);
    setOpenedFromQuery(true);
  }, [list, openedFromQuery]);

  useEffect(() => {
    setSelected(new Set());
    setExpandedActivities(new Set());
  }, [periodFilter, customStart, customEnd]);

  const getFilteredList = () => {
    const range = getDateRangeForPeriod(periodFilter, customStart, customEnd);
    if (!range) return list;

    return list.filter((item) => item.report_date >= range.start && item.report_date <= range.end);
  };

  const filteredList = getFilteredList();
  const summary = getRdoSabespDashboardMetrics(filteredList);
  const measurementCountByRdo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const source of measurementSources) {
      if (!source.rdo_id || source.deleted_at) continue;
      counts.set(source.rdo_id, (counts.get(source.rdo_id) ?? 0) + 1);
    }
    return counts;
  }, [measurementSources]);
  const rdoPendencies = useMemo(() => {
    return filteredList.flatMap((rdo) => {
      if (rdo.status === "draft") {
        const requiresReview = Boolean(rdo.review_requested_at || rdo.parser_ran_at || rdo.parser_result || rdo.parser_status === "success" || rdo.parser_status === "manual_fallback" || rdo.whatsapp_text);
        const reviewStartedAt = rdo.review_requested_at || rdo.parser_ran_at || rdo.updated_at || rdo.created_at;
        const reviewAgeDays = reviewStartedAt
          ? Math.floor((Date.now() - new Date(reviewStartedAt).getTime()) / 86_400_000)
          : 0;
        if (!requiresReview || reviewAgeDays < 2) return [];
        const contractor = contractorStore.resolveRdoContractor({
          rdoId: rdo.id,
          rdoType: "sabesp",
          foremanName: rdo.encarregado,
        });
        return [{
          id: rdo.id,
          date: rdo.report_date,
          rua: rdo.rua_beco || "-",
          encarregado: rdo.encarregado || "-",
          nucleo: getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro),
          contractor: contractor?.name || "-",
          reasons: ["D2 vencido - responsavel precisa preencher"],
          optionalWarnings: ["justificativa do gestor obrigatoria"],
          suggestions: [],
        }];
      }
      const contractor = contractorStore.resolveRdoContractor({
        rdoId: rdo.id,
        rdoType: "sabesp",
        foremanName: rdo.encarregado,
      });
      const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro);
      const sources = measurementSources.filter((source) => source.rdo_id === rdo.id && !source.deleted_at);
      const qualityBlocked = sources.some((source) => source.quality_status === "blocked_by_nc")
        || (rdo.qualidade && !rdo.qualidade.ordem_servico && !rdo.qualidade.bandeirola && !rdo.qualidade.projeto);
      const evidenceMissing = !(Array.isArray(rdo.photo_paths) && rdo.photo_paths.length > 0)
        && !rdo.assinatura_empreiteira_url
        && !rdo.assinatura_consorcio_url;
      const services = getRdoSabespExecutedServices(rdo);
      const missingPrice = services.filter((service) => {
        const candidate = String(service.service_id.split("-")[0] || "").trim();
        return !candidate || candidate === "sem" || candidate === "sem-codigo";
      });
      const reasons: string[] = [];
      const optionalWarnings: string[] = [];
      if (!contractor) reasons.push("sem subempreiteiro");
      if (!nucleo || nucleo === "Não informado" || nucleo === "Nao informado") reasons.push("sem núcleo");
      if (missingPrice.length > 0) reasons.push(`${missingPrice.length} item(ns) sem N. Preço`);
      if (qualityBlocked) reasons.push("bloqueado pela qualidade");
      if (evidenceMissing) reasons.push("sem evidência");
      if (sources.length === 0) reasons.push("nao sincronizado na Medicao");
      const blockingReasons = reasons.filter((reason) => {
        const lower = reason.toLowerCase();
        return !lower.includes("evid") && !lower.includes("pre");
      });
      if (missingPrice.length > 0) optionalWarnings.push(`${missingPrice.length} item(ns) sem N. Preco`);
      if (evidenceMissing) optionalWarnings.push("sem evidencia");
      return blockingReasons.length || optionalWarnings.length ? [{
        id: rdo.id,
        date: rdo.report_date,
        rua: rdo.rua_beco || "-",
        encarregado: rdo.encarregado || "-",
        nucleo,
        contractor: contractor?.name || "-",
        reasons: blockingReasons,
        optionalWarnings,
        suggestions: services.map((service) => String(service.service_id.split("-")[0] || "").trim()).filter((value) => value && value !== "sem" && value !== "sem-codigo"),
      }] : [];
    });
  }, [contractorStore, filteredList, measurementSources]);

  const remove = async (rdo: any) => {
    if (!confirm("Excluir este RDO Sabesp?")) return;

    removeLocalRdoSabesp(rdo.id);
    setList(readLocalRdoSabesp());

    if (isLocalRdoSabespId(rdo.id) || isNonProductionDataMode()) {
      toast.success("RDO Sabesp excluido localmente");
      return;
    }

    const { error } = await supabase
      .from("rdo_sabesp" as any)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", rdo.id);
    if (error) {
      toast.warning("RDO removido localmente. O Supabase nao respondeu para concluir a exclusao remota.");
      return;
    }

    if (Array.isArray(rdo.photo_paths) && rdo.photo_paths.length > 0) {
      const { error: storageError } = await supabase.storage.from("rdo-sabesp-photos").remove(rdo.photo_paths);
      if (storageError) {
        console.error("Erro ao remover fotos do RDO Sabesp:", storageError);
      }
    }

    toast.success("RDO Sabesp excluído");
    load();
  };

  const toggleAll = () => {
    if (selected.size === filteredList.length) {
      setSelected(new Set());
      return;
    }

    setSelected(new Set(filteredList.map((item) => item.id)));
  };

  const exportSelected = async () => {
    if (!selected.size) {
      toast.error("Selecione ao menos um RDO");
      return;
    }

    setBulkLoading(true);
    try {
      const items = filteredList.filter((item) => selected.has(item.id) && item.status !== "draft");
      if (!items.length) {
        toast.error("Selecione ao menos um RDO finalizado para exportar.");
        return;
      }

      const draftCount = filteredList.filter((item) => selected.has(item.id) && item.status === "draft").length;
      const { downloadRdoSabespBatchZip } = await import("./lib/rdoSabespPdfGenerator");
      await downloadRdoSabespBatchZip(items);
      toast.success(
        draftCount > 0
          ? `ZIP gerado com ${items.length} RDO(s) finalizado(s). ${draftCount} rascunho(s) foram ignorados.`
          : "ZIP gerado",
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleActivities = (id: string) => {
    setExpandedActivities((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col bg-gray-950 text-[#f5f5f5]">
      <RdoHeader />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 space-y-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f97316] text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">RDO Sabesp</h2>
                <Badge variant="secondary">Sabesp</Badge>
              </div>
              <p className="text-xs text-[#a3a3a3]">Relatório diário no padrão Consórcio Se Liga Na Rede</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setFormInitialStep("import");
                setShowNew(true);
              }}
            >
              <Upload className="mr-1 h-4 w-4" />
              Importar foto/texto
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormInitialStep("edit");
                setShowNew(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Preencher manual
            </Button>
          </div>
        </div>

        <Tabs
          value={showNew || editing ? "novo" : "lista"}
          onValueChange={(value) => {
            if (value === "lista") {
              setShowNew(false);
              setEditing(null);
            } else {
              setFormInitialStep("import");
              setShowNew(true);
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="lista">Histórico ({filteredList.length})</TabsTrigger>
            <TabsTrigger value="novo">
              {editing ? (
                <Pencil className="w-4 h-4 mr-1" />
              ) : (
                <MessageSquare className="w-4 h-4 mr-1" />
              )}
              {editing ? "Editando" : "Importar / Novo RDO Sabesp"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Período do histórico</CardTitle>
                <CardDescription>
                  Escolha um período rápido ou selecione um intervalo personalizado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Filtro rápido</label>
                    <Select
                      value={periodFilter}
                      onValueChange={(value) => {
                        setPeriodFilter(value as PeriodFilter);
                        if (value !== "custom") {
                          setCustomStart("");
                          setCustomEnd("");
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="semiannual">Semestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                        <SelectItem value="custom">Período selecionado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">De</label>
                      <input
                        type="date"
                        value={customStart}
                        disabled={periodFilter !== "custom"}
                        onChange={(e) => setCustomStart(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-[#525252] bg-[#333333] px-3 py-2 text-sm text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Até</label>
                      <input
                        type="date"
                        value={customEnd}
                        disabled={periodFilter !== "custom"}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-[#525252] bg-[#333333] px-3 py-2 text-sm text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex h-10 w-full items-center rounded-lg border border-dashed border-[#525252] px-3 text-sm text-[#a3a3a3]">
                        <CalendarRange className="mr-2 h-4 w-4" />
                        {periodLabels[periodFilter]}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>RDOs no periodo</CardDescription>
                  <CardTitle>{summary.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Finalizados</CardDescription>
                  <CardTitle>{summary.finalized}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Rascunhos</CardDescription>
                  <CardTitle>{summary.drafts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Com fotos</CardDescription>
                  <CardTitle>{summary.withPhotos}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Atividades executadas</CardDescription>
                  <CardTitle>{summary.totalActivities}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Quantidade total registrada</CardDescription>
                  <CardTitle>{summary.totalExecutedQuantity}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className={rdoPendencies.length ? "border-amber-500/40" : "border-emerald-500/30"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className={rdoPendencies.length ? "h-4 w-4 text-amber-300" : "h-4 w-4 text-emerald-300"} />
                  Pendências para Medição
                </CardTitle>
                <CardDescription>
                  RDOs sem subempreiteiro, núcleo, N. Preço, evidência, sincronização ou liberação de qualidade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rdoPendencies.length === 0 ? (
                  <p className="text-sm text-emerald-300">Nenhuma pendência crítica no período filtrado.</p>
                ) : (
                  rdoPendencies.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#525252] bg-[#252525] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.date} - {item.rua}</p>
                          <p className="mt-1 text-xs text-[#a3a3a3]">
                            {item.contractor} · {item.nucleo} · {item.encarregado}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const match = list.find((rdo) => rdo.id === item.id);
                            if (!match) return;
                            setEditing(match);
                            setFormInitialStep("edit");
                            setShowNew(false);
                          }}
                        >
                          Revisar RDO
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.reasons.map((reason) => (
                          <Badge key={reason} variant="outline" className="border-amber-500/40 text-amber-200">{reason}</Badge>
                        ))}
                        {item.optionalWarnings?.map((warning) => (
                          <Badge key={warning} variant="outline" className="border-sky-500/40 text-sky-200">{warning} (opcional)</Badge>
                        ))}
                      </div>
                      {item.suggestions.length > 0 && (
                        <p className="mt-2 text-xs text-[#a3a3a3]">
                          Sugestões de N. Preço: {Array.from(new Set(item.suggestions)).slice(0, 6).join(", ")}. A aprovação final fica em Medição &gt; Subempreiteiros &gt; Memória.
                        </p>
                      )}
                    </div>
                  ))
                )}
                {rdoPendencies.length > 8 && (
                  <p className="text-xs text-[#a3a3a3]">Mais {rdoPendencies.length - 8} pendência(s) no filtro atual.</p>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={toggleAll}>
                {selected.size === filteredList.length && filteredList.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
              <Button onClick={exportSelected} disabled={bulkLoading || !selected.size}>
                {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
                Exportar selecionados (ZIP)
              </Button>
            </div>

            <Card>
              <CardContent className="p-4 space-y-4">
                {filteredList.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#a3a3a3]">
                    Nenhum RDO Sabesp encontrado para o período selecionado.
                  </p>
                ) : (
                  filteredList.map((rdo) => {
                    const photoCount = Array.isArray(rdo.photo_paths) ? rdo.photo_paths.length : 0;
                    const activities = getExecutedActivities(rdo);
                    const totalQuantity = sumExecutedQuantities(rdo);
                    const isDraft = rdo.status === "draft";
                    const isExpanded = expandedActivities.has(rdo.id);
                    const visibleActivities = isExpanded ? activities : activities.slice(0, 6);
                    const measurementCount = measurementCountByRdo.get(rdo.id) ?? 0;
                    const contractor = contractorStore.resolveRdoContractor({
                      rdoId: rdo.id,
                      rdoType: "sabesp",
                      foremanName: rdo.encarregado,
                    });

                    return (
                      <div key={rdo.id} className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex gap-3">
                            <Checkbox
                              checked={selected.has(rdo.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selected);
                                if (checked) next.add(rdo.id);
                                else next.delete(rdo.id);
                                setSelected(next);
                              }}
                              className="mt-1"
                            />

                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-lg font-semibold">
                                  {new Date(`${rdo.report_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                </span>
                                <Badge variant="secondary">Sabesp</Badge>
                                <Badge variant={isDraft ? "secondary" : "default"}>
                                  {isDraft ? "Rascunho" : "Finalizado"}
                                </Badge>
                                {rdo.criadouro && (
                                  <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-200">
                                    {getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)}
                                  </Badge>
                                )}
                                {photoCount > 0 ? (
                                  <Badge variant="outline" className="gap-1 border-green-500/40 text-green-300">
                                    <ImageIcon className="h-3 w-3" />
                                    {photoCount} foto{photoCount > 1 ? "s" : ""}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1 text-[#a3a3a3]">
                                    <ImageOff className="h-3 w-3" />
                                    Sem foto
                                  </Badge>
                                )}
                                <Badge variant="outline" className={contractor ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}>
                                  {contractor?.name || "Empreiteira nao identificada"}
                                </Badge>
                                <Badge variant="outline" className={measurementCount > 0 ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}>
                                  Medição: {measurementCount} item{measurementCount === 1 ? "" : "s"}
                                </Badge>
                                {rdo.encarregado && <span className="text-sm text-[#a3a3a3]">- {rdo.encarregado}</span>}
                              </div>

                              <p className="text-sm text-[#a3a3a3]">{rdo.rua_beco || "-"}</p>

                              <p className="text-xs text-[#6b6b6b]">
                                {activities.length} atividade(s) com apontamento e {totalQuantity} unidade(s) registradas.
                              </p>
                              {!isDraft && (
                                <p className={`text-xs ${measurementCount > 0 ? "text-emerald-300" : "text-amber-300"}`}>
                                  {measurementCount > 0
                                    ? `Este RDO já alimentou ${measurementCount} fonte(s) da Medição.`
                                    : "Este RDO ainda não aparece em Fontes da Medição; confirme o salvamento remoto e a sincronização."}
                                </p>
                              )}

                              {activities.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    {visibleActivities.map((activity) => (
                                      <Badge
                                        key={activity.id}
                                        variant="outline"
                                        className="h-auto max-w-full rounded-full whitespace-normal break-words px-3 py-1 text-left text-xs font-normal leading-tight"
                                      >
                                        {activity.label}
                                      </Badge>
                                    ))}
                                  </div>
                                  {activities.length > 6 && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-auto px-0 text-sm text-[#f97316]"
                                      onClick={() => toggleActivities(rdo.id)}
                                    >
                                      {isExpanded ? (
                                        <>
                                          <ChevronUp className="mr-1 h-4 w-4" />
                                          Ocultar atividades
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="mr-1 h-4 w-4" />
                                          Visualizar todas as atividades
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-[#a3a3a3]">Nenhuma atividade registrada neste RDO.</p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1 lg:justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isDraft}
                              title={isDraft ? "Finalize o RDO para liberar a exportacao em PDF." : "Baixar PDF"}
                              onClick={async () => {
                                try {
                                  const { downloadRdoSabespPdf } = await import("./lib/rdoSabespPdfGenerator");
                                  await downloadRdoSabespPdf(rdo);
                                  toast.success("PDF do RDO gerado com sucesso.");
                                } catch (error: any) {
                                  console.error("Erro ao baixar PDF do RDO Sabesp:", error);
                                  toast.error("Erro ao baixar PDF: " + (error?.message || "Erro desconhecido."));
                                }
                              }}
                            >
                              <FileDown className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditing(rdo);
                                setFormInitialStep("edit");
                                setShowNew(false);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(rdo)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="novo">
            <RdoSabespForm
              initialData={editing || undefined}
              initialStep={formInitialStep}
              onSaved={() => {
                setShowNew(false);
                setEditing(null);
                load();
              }}
            />
          </TabsContent>
        </Tabs>
        </div>
      </main>
    </div>
  );
}

export default RdoSabespPage
