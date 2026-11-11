import type { RequirementConfirmation } from "../domain/types";
import { readMaterialFile } from "../storage/materialFiles";
import { requirementsService } from "./requirements";
export interface Material {
  id: string;
  kind: "teams" | "html" | "attachment";
  fileName: string;
  mediaType: string;
  sizeBytes: number | null;
  sha256?: string | null;
  downloadStatus: "available" | "unavailable" | "blocked";
}
const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const base = (env?.VITE_API_URL || env?.VITE_REQUIREMENTS_API_URL || "").replace(/\/$/, "");
// Existing REQUIREMENTS base can be host-only; unified API base includes /api.
const root = base.endsWith("/api") ? base : `${base}/api`;
const path = (c: RequirementConfirmation) => `${root}/requests/${encodeURIComponent(c.requestId)}/requirement-confirmations/${encodeURIComponent(c.id)}/materials`;
async function response(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal, credentials: "same-origin" });
  if (!res.ok) throw new Error(res.status === 410 ? "원본 파일이 보관되어 있지 않습니다." : `자료를 가져오지 못했습니다 (${res.status}).`);
  return res;
}
export async function listMaterials(c: RequirementConfirmation, signal: AbortSignal): Promise<{ items: Material[]; available: boolean }> {
  if (requirementsService.mode === "server") {
    const data = await (await response(path(c), signal)).json();
    if (data.confirmationId !== c.id || data.requestId !== c.requestId || data.requirementDocumentId !== c.documentSnapshot.id || !Array.isArray(data.items))
      throw new Error("확정 자료의 기준이 일치하지 않습니다.");
    if (!data.items.every((m: Material) => typeof m.id === "string" && typeof m.fileName === "string" && typeof m.mediaType === "string" && ["teams", "html", "attachment"].includes(m.kind) && ["available", "unavailable", "blocked"].includes(m.downloadStatus)))
      throw new Error("확정 자료 목록 형식을 확인해주세요.");
    return { items: data.items, available: data.sourceMaterialsAvailable !== false };
  }
  const s = c.documentSnapshot.inputSnapshot;
  if (!s || s.unavailable) return { items: [], available: false };
  const items: Material[] = [];
  for (const [kind, text, fileName, mediaType] of [["teams", s.text, "teams.txt", "text/plain;charset=utf-8"], ["html", s.html, "requirements.html", "text/html;charset=utf-8"]] as const) {
    if (text?.trim()) items.push({ id: kind, kind, fileName, mediaType, sizeBytes: new Blob([text]).size, downloadStatus: "available" });
  }
  for (let i = 0; i < s.attachmentNames.length; i++) {
    const id = s.attachmentIds[i];
    const file = id ? await readMaterialFile(id) : undefined;
    const a = s.attachments?.find(a => a.serverFileId === id);
    items.push({ id: id || `missing:${i}`, kind: "attachment", fileName: s.attachmentNames[i], mediaType: file?.type || a?.type || "application/octet-stream", sizeBytes: file?.size ?? a?.size ?? null, downloadStatus: file ? "available" : "unavailable" });
  }
  signal.throwIfAborted();
  return { items, available: true };
}
export async function materialBlob(c: RequirementConfirmation, item: Material, signal: AbortSignal) {
  if (item.downloadStatus !== "available") throw new Error("원본 파일이 없습니다.");
  if (requirementsService.mode === "server") {
    const res = await response(`${path(c)}/${encodeURIComponent(item.id)}/content`, signal);
    if (res.headers.get("content-type")?.includes("application/json") && !item.mediaType.includes("application/json")) throw new Error("다운로드 응답 형식이 올바르지 않습니다.");
    const blob = await res.blob();
    if (item.sizeBytes !== null && blob.size !== item.sizeBytes) throw new Error("원본 파일 크기가 목록과 다릅니다.");
    if (item.sha256) {
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, "0")).join("");
      if (hash !== item.sha256) throw new Error("원본 파일 해시가 목록과 다릅니다.");
    }
    return blob;
  }
  const s = c.documentSnapshot.inputSnapshot;
  if (item.kind !== "attachment") return new Blob([item.kind === "teams" ? s.text : s.html], { type: item.mediaType });
  const file = await readMaterialFile(item.id);
  if (!file) throw new Error("원본 파일이 없습니다.");
  signal.throwIfAborted();
  return file;
}
