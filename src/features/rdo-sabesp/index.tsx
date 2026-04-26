/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
} from "lucide-react";
import { toast } from "sonner";
import { RdoHeader } from "@/features/rdo/components/RdoHeader";
import { RdoSabespForm } from "./components/RdoSabespForm";
import { downloadRdoSabespPdf, downloadRdoSabespBatchZip } from "./lib/rdoSabespPdfGenerator";
import { Checkbox } from "@/components/ui/checkbox";
import { getCriadouroLabel, getExecutedActivities, getRdoSabespDashboardMetrics, sumExecutedQuantities } from "./lib/rdoSabespUtils";

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
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [list, setList] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [formInitialStep, setFormInitialStep] = useState<"import" | "edit" | "review">("import");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("monthly");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (!error && data?.length) setProjects(data);
      setProjectId("__none__");
      setLoading(false);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!projectId) return;

    let query = supabase
      .from("rdo_sabesp" as any)
      .select("*")
      .is("deleted_at", null)
      .order("report_date", { ascending: false });
    query = projectId === "__none__" ? query.is("project_id", null) : query.eq("project_id", projectId);

    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      return;
    }

    setList(data || []);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelected(new Set());
    setExpandedActivities(new Set());
  }, [projectId, periodFilter, customStart, customEnd]);

  const getFilteredList = () => {
    const range = getDateRangeForPeriod(periodFilter, customStart, customEnd);
    if (!range) return list;

    return list.filter((item) => item.report_date >= range.start && item.report_date <= range.end);
  };

  const filteredList = getFilteredList();
  const summary = getRdoSabespDashboardMetrics(filteredList);

  const remove = async (rdo: any) => {
    if (!confirm("Excluir este RDO Sabesp?")) return;

    const { error } = await supabase
      .from("rdo_sabesp" as any)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", rdo.id);
    if (error) {
      toast.error(error.message);
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

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-gray-950">
        <RdoHeader />
        <div className="flex flex-1 items-center justify-center text-[#a3a3a3]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

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

        <Card>
          <CardHeader>
            <CardTitle>Projeto (opcional)</CardTitle>
            <CardDescription>Você pode criar RDOs Sabesp sem vincular a nenhum projeto.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem projeto vinculado</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

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
                                {rdo.encarregado && <span className="text-sm text-[#a3a3a3]">- {rdo.encarregado}</span>}
                              </div>

                              <p className="text-sm text-[#a3a3a3]">{rdo.rua_beco || "-"}</p>

                              <p className="text-xs text-[#6b6b6b]">
                                {activities.length} atividade(s) com apontamento e {totalQuantity} unidade(s) registradas.
                              </p>

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
              projectId={projectId === "__none__" ? null : projectId}
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
