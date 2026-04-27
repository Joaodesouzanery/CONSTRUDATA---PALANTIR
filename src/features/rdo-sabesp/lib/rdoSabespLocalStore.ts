/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RdoSabespData } from "./rdoSabespPdfGenerator";

export const RDO_SABESP_LOCAL_STORAGE_KEY = "cdata-rdo-sabesp";

export type LocalRdoSabespRecord = Partial<RdoSabespData> & {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  _localOnly?: boolean;
  _syncError?: string | null;
};

const canUseLocalStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

export const isLocalRdoSabespId = (id?: string | null) => Boolean(id?.startsWith("local-rdo-sabesp-"));

export const makeLocalRdoSabespId = () => {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  return `local-rdo-sabesp-${random}`;
};

export function readLocalRdoSabesp(includeDeleted = false): LocalRdoSabespRecord[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(RDO_SABESP_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    return rows
      .filter((row) => row?.id)
      .filter((row) => includeDeleted || !row.deleted_at)
      .sort(sortRdoSabespRecords);
  } catch (error) {
    console.warn("[rdo-sabesp] nao foi possivel ler cache local", error);
    return [];
  }
}

export function writeLocalRdoSabesp(rows: LocalRdoSabespRecord[]) {
  if (!canUseLocalStorage()) return;

  const cleaned = rows
    .filter((row) => row?.id)
    .sort(sortRdoSabespRecords);

  try {
    window.localStorage.setItem(RDO_SABESP_LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (error) {
    console.warn("[rdo-sabesp] nao foi possivel gravar cache local", error);
  }
}

export function upsertLocalRdoSabesp(record: Partial<LocalRdoSabespRecord>) {
  const now = new Date().toISOString();
  const id = record.id || makeLocalRdoSabespId();
  const rows = readLocalRdoSabesp(true);
  const existing = rows.find((item) => item.id === id);
  const next: LocalRdoSabespRecord = {
    ...existing,
    ...record,
    id,
    created_at: record.created_at || existing?.created_at || now,
    updated_at: now,
  };

  writeLocalRdoSabesp([next, ...rows.filter((item) => item.id !== id)]);
  return next;
}

export function removeLocalRdoSabesp(id: string) {
  writeLocalRdoSabesp(readLocalRdoSabesp(true).filter((item) => item.id !== id));
}

export function mergeRdoSabespRemoteWithLocal(remoteRows: any[], localRows = readLocalRdoSabesp(true)) {
  const remote = (remoteRows || []).filter((row) => row?.id && !row.deleted_at);
  const remoteIds = new Set(remote.map((row) => row.id));
  const pendingById = new Map(
    localRows
      .filter((row) => row?.id && !row.deleted_at && row._localOnly)
      .map((row) => [row.id, row]),
  );
  const remoteWithPendingLocalChanges = remote.map((row) => pendingById.get(row.id) || row);
  const localOnly = localRows.filter((row) => {
    if (row.deleted_at) return false;
    if (isLocalRdoSabespId(row.id)) return true;
    return !remoteIds.has(row.id) && row._localOnly;
  });

  return [...remoteWithPendingLocalChanges, ...localOnly].sort(sortRdoSabespRecords);
}

export function stripLocalRdoSabespFields(record: Record<string, any>) {
  const clean = { ...record };
  delete clean._localOnly;
  delete clean._syncError;
  return clean;
}

function sortRdoSabespRecords(a: LocalRdoSabespRecord, b: LocalRdoSabespRecord) {
  const dateCompare = String(b.report_date || "").localeCompare(String(a.report_date || ""));
  if (dateCompare !== 0) return dateCompare;
  return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
}
