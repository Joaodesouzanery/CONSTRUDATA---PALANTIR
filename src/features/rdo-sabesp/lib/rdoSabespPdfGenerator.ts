/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from "jspdf";
import JSZip from "jszip";
import logoSabesp from "@/assets/logo-sabesp.png";
import logoCslnr from "@/assets/logo-cslnr.jpg";
import { CRIADOUROS } from "./rdoSabespCatalog";
import { getServiceDisplayLabel } from "./rdoSabespUtils";
import { supabase } from "@/lib/supabase";

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const loadDataUrlWithImage = (src: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = reject;
    img.src = src;
  });

const loadDataUrl = async (src: string) => {
  if (!src) throw new Error("Imagem vazia.");
  if (src.startsWith("data:")) return src;

  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await blobToDataUrl(await response.blob());
  } catch (error) {
    console.warn("fetch image fail, trying canvas fallback", error);
    return loadDataUrlWithImage(src);
  }
};

const fmtDate = (dateValue: string) => {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
};

const checkbox = (checked: boolean) => (checked ? "[X]" : "[ ]");
let workerConfigured = false;
let pdfjsLibPromise: Promise<any> | null = null;

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const triggerBlobDownload = async (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.appendChild(anchor);

  try {
    await waitForNextFrame();
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
};

const getPdfjsLib = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist");
  }
  return pdfjsLibPromise;
};

const ensurePdfWorker = async () => {
  if (workerConfigured) return;
  const pdfjsLib = await getPdfjsLib();

  try {
    const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  }

  workerConfigured = true;
};

const resolveSabespPhotoUrls = async (photoPaths?: string[] | null) => {
  if (!Array.isArray(photoPaths) || photoPaths.length === 0) return [];

  const signedPhotos = await Promise.all(
    photoPaths.map(async (path) => {
      try {
        if (path.startsWith("data:") || /^https?:\/\//i.test(path)) return path;
        const { data } = await supabase.storage.from("rdo-sabesp-photos").createSignedUrl(path, 60 * 60);
        return data?.signedUrl || null;
      } catch (error) {
        console.error("Erro ao assinar foto do RDO Sabesp:", error);
        return null;
      }
    }),
  );

  return signedPhotos.filter((url): url is string => Boolean(url));
};

type PdfTableColumn = {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
};

type PdfTableOptions = {
  doc: jsPDF;
  startY: number;
  margin: number;
  pageHeight: number;
  columns: PdfTableColumn[];
  rows: string[][];
  fontSize?: number;
  headerFillColor?: [number, number, number];
};

const drawPdfTable = ({
  doc,
  startY,
  margin,
  pageHeight,
  columns,
  rows,
  fontSize = 7,
  headerFillColor = [220, 230, 241],
}: PdfTableOptions) => {
  const bottomMargin = 12;
  const horizontalPadding = 1.2;
  const verticalPadding = 1.2;
  const lineHeight = 3.2;
  const headerHeightMin = 7;
  let y = startY;

  const getLines = (text: string, width: number) =>
    doc.splitTextToSize(String(text || "-"), Math.max(width - horizontalPadding * 2, 4));

  const getRowHeight = (values: string[], isHeader = false) => {
    const maxLines = Math.max(
      1,
      ...values.map((value, index) => getLines(value, columns[index]?.width || 20).length),
    );
    const contentHeight = maxLines * lineHeight + verticalPadding * 2;
    return isHeader ? Math.max(headerHeightMin, contentHeight) : contentHeight;
  };

  const renderHeader = () => {
    renderRow(columns.map((column) => column.header), true);
  };

  const renderRow = (values: string[], isHeader = false) => {
    const rowHeight = getRowHeight(values, isHeader);

    if (y + rowHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = 15;
      if (!isHeader) renderHeader();
    }

    let x = margin;
    doc.setFont("helvetica", isHeader ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);

    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const cellText = values[index] ?? "-";
      const lines = getLines(cellText, column.width);

      if (isHeader) {
        doc.setFillColor(...headerFillColor);
        doc.rect(x, y, column.width, rowHeight, "FD");
      } else {
        doc.rect(x, y, column.width, rowHeight);
      }

      const textX =
        column.align === "center"
          ? x + column.width / 2
          : column.align === "right"
            ? x + column.width - horizontalPadding
            : x + horizontalPadding;
      const textY = y + verticalPadding + lineHeight - 0.4;

      doc.text(lines, textX, textY, {
        align: column.align || (isHeader ? "center" : "left"),
        baseline: "top",
        maxWidth: column.width - horizontalPadding * 2,
      });

      x += column.width;
    }

    y += rowHeight;
  };

  renderHeader();
  rows.forEach((row) => renderRow(row));

  return y + 2;
};

export interface RdoSabespData {
  id?: string;
  status?: "draft" | "finalized";
  report_date: string;
  encarregado?: string | null;
  rua_beco?: string | null;
  criadouro?: string | null;
  criadouro_outro?: string | null;
  epi_utilizado?: boolean | null;
  condicoes_climaticas?: any;
  qualidade?: any;
  paralisacoes?: any[];
  paralisacao_outro?: string | null;
  horarios?: any;
  mao_de_obra?: any[];
  equipamentos?: any[];
  servicos_esgoto?: any[];
  servicos_agua?: any[];
  observacoes?: string | null;
  photo_paths?: string[] | null;
  responsavel_empreiteira?: string | null;
  responsavel_consorcio?: string | null;
  assinatura_empreiteira_url?: string | null;
  assinatura_consorcio_url?: string | null;
  assinatura_empreiteira_path?: string | null;
  assinatura_consorcio_path?: string | null;
  planilha_foto_url?: string | null;
  planilha_foto_path?: string | null;
  include_planilha_foto_no_pdf?: boolean | null;
}

const resolveSabespAssetUrl = async (pathOrUrl?: string | null) => {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("data:") || /^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const { data } = await supabase.storage.from("rdo-sabesp-photos").createSignedUrl(pathOrUrl, 60 * 60);
  return data?.signedUrl || null;
};

export async function generateRdoSabespPdf(rdo: RdoSabespData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  try {
    const sabesp = await loadDataUrl(logoSabesp);
    doc.addImage(sabesp, "PNG", margin, 6, 28, 18);
  } catch {
    // Logo opcional no PDF.
  }

  try {
    const cslnr = await loadDataUrl(logoCslnr);
    doc.addImage(cslnr, "PNG", pageWidth - margin - 22, 6, 22, 22);
  } catch {
    // Logo opcional no PDF.
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RELATORIO DIARIO DE OBRA (RDO)", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.text("SABESP - Consorcio Se Liga Na Rede", pageWidth / 2, 19, { align: "center" });

  let y = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CRIADOUROS:", margin, y);
  doc.setFont("helvetica", "normal");
  let x = margin + 22;
  for (const item of CRIADOUROS.filter((criadouro) => criadouro.value !== "outro")) {
    const selected = rdo.criadouro === item.value;
    doc.text(`${checkbox(selected)} ${item.label}`, x, y);
    x += 32;
  }
  if (rdo.criadouro === "outro" && rdo.criadouro_outro) {
    doc.text(`[X] Outro: ${rdo.criadouro_outro}`, x, y);
  }
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("RUA/BECO:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(rdo.rua_beco || "-", margin + 18, y);
  doc.setFont("helvetica", "bold");
  doc.text("ENCARREGADO:", 90, y);
  doc.setFont("helvetica", "normal");
  doc.text(rdo.encarregado || "-", 117, y);
  doc.setFont("helvetica", "bold");
  doc.text("DATA:", 165, y);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(rdo.report_date), 175, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("1. TODOS OS FUNCIONARIOS ESTAO UTILIZANDO OS EPIs?", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${checkbox(!!rdo.epi_utilizado)} SIM   ${checkbox(rdo.epi_utilizado === false)} NAO`, 105, y);
  y += 4;

  const clima = rdo.condicoes_climaticas || {};
  const qualidade = rdo.qualidade || {};
  const horarios = rdo.horarios || {};
  const paralisacoes = rdo.paralisacoes || [];

  y = drawPdfTable({
    doc,
    startY: y,
    margin,
    pageHeight,
    columns: [
      { header: "CONDICOES CLIMATICAS", width: 45 },
      { header: "QUALIDADE", width: 50 },
      { header: "PARALISACOES", width: 50 },
      { header: "HORARIO", width: 48 },
    ],
    rows: [[
      `Manha: ${clima.manha || "-"}\nTarde: ${clima.tarde || "-"}\nNoite: ${clima.noite || "-"}`,
      `Ordem de Servico: ${checkbox(!!qualidade.ordem_servico)}\nBandeirola: ${checkbox(!!qualidade.bandeirola)}\nProjeto: ${checkbox(!!qualidade.projeto)}\nObs: ${qualidade.obs || "-"}`,
      (() => {
        const lines = paralisacoes.length
          ? paralisacoes.map((item: any) => `* ${item.motivo || "-"}${item.inicio ? ` ${item.inicio}` : ""}${item.fim ? ` -> ${item.fim}` : ""}`)
          : [];
        if (rdo.paralisacao_outro) lines.push(`Outro: ${rdo.paralisacao_outro}`);
        return lines.length ? lines.join("\n") : "-";
      })(),
      `Diurno: ${horarios?.diurno?.inicio || "-"} -> ${horarios?.diurno?.fim || "-"}\nNoturno: ${horarios?.noturno?.inicio || "-"} -> ${horarios?.noturno?.fim || "-"}`,
    ]],
  });

  const maoDeObra = (rdo.mao_de_obra || []).filter((item: any) => item.cargo);
  if (maoDeObra.length > 0) {
    y = drawPdfTable({
      doc,
      startY: y,
      margin,
      pageHeight,
      columns: [
        { header: "MAO DE OBRA - CARGO", width: 144 },
        { header: "TERC.", width: 25, align: "center" },
        { header: "CONTRAT.", width: 25, align: "center" },
      ],
      rows: maoDeObra.map((item: any) => [item.cargo, String(item.terc ?? 0), String(item.contrat ?? 0)]),
    });
  }

  const equipamentos = (rdo.equipamentos || []).filter((item: any) => item.descricao);
  if (equipamentos.length > 0) {
    y = drawPdfTable({
      doc,
      startY: y,
      margin,
      pageHeight,
      columns: [
        { header: "EQUIPAMENTOS / VEICULOS", width: 144 },
        { header: "TERC.", width: 25, align: "center" },
        { header: "CONTRAT.", width: 25, align: "center" },
      ],
      rows: equipamentos.map((item: any) => [item.descricao, String(item.terc ?? 0), String(item.contrat ?? 0)]),
    });
  }

  const renderServicos = (titulo: string, lista: any[]) => {
    const services = (lista || []).filter((item: any) => Number(item.quantidade) > 0);
    if (!services.length) return;

    y = drawPdfTable({
      doc,
      startY: y,
      margin,
      pageHeight,
      headerFillColor: [200, 220, 240],
      columns: [
        { header: `${titulo} - COD.`, width: 22 },
        { header: "ATIVIDADE EXECUTADA", width: 146 },
        { header: "EXEC.", width: 18, align: "center" },
        { header: "UN.", width: 14, align: "center" },
      ],
      rows: services.map((item: any) => [
        item.codigo || "-",
        getServiceDisplayLabel(item) || item.descricao || "-",
        String(item.quantidade),
        item.unidade || "-",
      ]),
    });
  };

  renderServicos("ESGOTO", rdo.servicos_esgoto || []);
  renderServicos("AGUA", rdo.servicos_agua || []);

  if (rdo.observacoes) {
    if (y > 250) {
      doc.addPage();
      y = 15;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("OBSERVACOES:", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(rdo.observacoes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }

  if (y > 260) {
    doc.addPage();
    y = 20;
  }

  y = Math.max(y, 270);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const drawSig = async (url: string | null | undefined, centerX: number) => {
    if (!url) return;
    try {
      const resolvedUrl = await resolveSabespAssetUrl(url);
      if (!resolvedUrl) return;
      const dataUrl = await loadDataUrl(resolvedUrl);
      doc.addImage(dataUrl, "PNG", centerX - 25, y - 18, 50, 16);
    } catch (error) {
      console.warn("sig load fail", error);
    }
  };

  await drawSig(rdo.assinatura_empreiteira_path || rdo.assinatura_empreiteira_url, margin + 40);
  await drawSig(rdo.assinatura_consorcio_path || rdo.assinatura_consorcio_url, pageWidth - margin - 40);
  doc.line(margin + 5, y, margin + 75, y);
  doc.line(pageWidth - margin - 75, y, pageWidth - margin - 5, y);
  doc.text(rdo.responsavel_empreiteira || "RESPONSAVEL DA EMPREITEIRA", margin + 40, y + 4, { align: "center" });
  doc.text(rdo.responsavel_consorcio || "RESPONSAVEL DO CONSORCIO", pageWidth - margin - 40, y + 4, { align: "center" });

  const sourcePhotoUrl = rdo.include_planilha_foto_no_pdf === false
    ? null
    : await resolveSabespAssetUrl(rdo.planilha_foto_path || rdo.planilha_foto_url).catch(() => null);
  if (sourcePhotoUrl) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("FOTO ORIGINAL DA PLANILHA", margin, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Anexo de auditoria usado para preenchimento e conferencia do RDO.", margin, 21);
    doc.setDrawColor(210);
    doc.rect(margin, 26, pageWidth - margin * 2, pageHeight - 38);
    try {
      const dataUrl = await loadDataUrl(sourcePhotoUrl);
      const format = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(dataUrl, format, margin + 2, 28, pageWidth - margin * 2 - 4, pageHeight - 42);
    } catch (error) {
      console.warn("Nao foi possivel carregar foto original do RDO Sabesp para o PDF:", error);
      doc.text("Foto original indisponivel", pageWidth / 2, pageHeight / 2, { align: "center" });
    }
  }

  const photoUrls = await resolveSabespPhotoUrls(rdo.photo_paths);
  if (photoUrls.length > 0) {
    doc.addPage();
    let photoY = 16;
    const gap = 6;
    const photoWidth = (pageWidth - margin * 2 - gap) / 2;
    const photoHeight = 58;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("FOTOS DO RDO", margin, photoY);
    photoY += 6;

    for (let index = 0; index < photoUrls.length; index += 1) {
      if (index > 0 && index % 4 === 0) {
        doc.addPage();
        photoY = 16;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("FOTOS DO RDO", margin, photoY);
        photoY += 6;
      }

      const column = index % 2;
      const row = Math.floor((index % 4) / 2);
      const imageX = margin + column * (photoWidth + gap);
      const imageY = photoY + row * (photoHeight + 14);

      doc.setDrawColor(210);
      doc.rect(imageX, imageY, photoWidth, photoHeight);

      try {
        const dataUrl = await loadDataUrl(photoUrls[index]);
        const format = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(dataUrl, format, imageX + 1, imageY + 1, photoWidth - 2, photoHeight - 2);
      } catch (error) {
        console.warn("Nao foi possivel carregar foto do RDO Sabesp para o PDF:", error);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Foto indisponivel", imageX + photoWidth / 2, imageY + photoHeight / 2, { align: "center" });
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Foto ${index + 1}`, imageX, imageY + photoHeight + 5);
    }
  }

  doc.setFontSize(6);
  doc.setTextColor(120);
  doc.text("Gerado automaticamente pela ConstruData", pageWidth / 2, pageHeight - 5, { align: "center" });

  return doc;
}

export async function downloadRdoSabespPdf(rdo: RdoSabespData) {
  const blob = await generateRdoSabespPdfBlob(rdo);
  await triggerBlobDownload(blob, `RDO-Sabesp_${rdo.report_date || "sem-data"}.pdf`);
}

export async function generateRdoSabespPdfBlob(rdo: RdoSabespData) {
  const doc = await generateRdoSabespPdf(rdo);
  return doc.output("blob");
}

export async function renderRdoSabespPdfPreviewPages(rdo: RdoSabespData, scale = 1.35) {
  await ensurePdfWorker();
  const blob = await generateRdoSabespPdfBlob(rdo);
  return renderPdfBlobToImages(blob, scale);
}

export async function renderPdfBlobToImages(blob: Blob, scale = 1.35) {
  await ensurePdfWorker();
  const pdfjsLib = await getPdfjsLib();

  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const images: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL("image/png"));

    try {
      await (page as any).cleanup?.();
    } catch {
      // ignore cleanup failures
    }
  }

  try {
    await (pdf as any).destroy?.();
  } catch {
    // ignore destroy failures
  }

  return images;
}

export async function mergePdfBlobsIntoSinglePdf(blobs: Blob[]) {
  const merged = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let firstPage = true;

  for (const blob of blobs) {
    const pages = await renderPdfBlobToImages(blob, 1.5);
    for (const page of pages) {
      if (!firstPage) merged.addPage("a4", "portrait");
      firstPage = false;
      merged.addImage(page, "PNG", 0, 0, 210, 297);
    }
  }

  return merged.output("blob");
}

export async function generateRdoSabespCombinedPdfBlob(rdos: RdoSabespData[]) {
  const blobs: Blob[] = [];
  for (const rdo of rdos) {
    blobs.push(await generateRdoSabespPdfBlob(rdo));
  }
  return mergePdfBlobsIntoSinglePdf(blobs);
}

export async function downloadRdoSabespBatchZip(rdos: RdoSabespData[]) {
  const zip = new JSZip();
  for (const rdo of rdos) {
    const doc = await generateRdoSabespPdf(rdo);
    const blob = doc.output("blob");
    zip.file(`RDO-Sabesp_${rdo.report_date}_${(rdo.id || "").slice(0, 8)}.pdf`, blob);
  }
  const content = await zip.generateAsync({ type: "blob" });
  await triggerBlobDownload(content, `RDOs-Sabesp_${new Date().toISOString().slice(0, 10)}.zip`);
}

export async function downloadRdoSabespCombinedPdf(rdos: RdoSabespData[], filename?: string) {
  const blob = await generateRdoSabespCombinedPdfBlob(rdos);
  await triggerBlobDownload(blob, filename || `RDOs-Sabesp_${new Date().toISOString().slice(0, 10)}.pdf`);
}
