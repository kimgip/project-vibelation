import { useEffect, useState } from "react";
import {
  canGenerate,
  mergeGeneration,
  snapshotOf,
  type Attachment,
  type RequirementGeneration,
  type WorkRequest,
} from "../domain/types";
import {
  pendingFiles,
  requirementsService,
  validateFiles,
} from "../services/requirements";
export function useRequirements(
  r: WorkRequest,
  update: (change: (latest: WorkRequest) => WorkRequest) => void,
  edit: (patch: Partial<WorkRequest>) => void,
  enabled = true,
) {
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void requirementsService
      .list(r.id, controller.signal)
      .then((documents) => {
        if (controller.signal.aborted || !documents.length) return;
        update((latest) => {
          const unique = new Map(latest.requirements.map((d) => [d.id, d]));
          for (const doc of documents) {
            if (doc.inputSnapshot.requestId === latest.id)
              unique.set(doc.id, doc);
          }
          const ids = new Set(documents.map((d) => d.generationId));
          return {
            ...latest,
            requirements: [...unique.values()].sort(
              (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
            ),
            generations: latest.generations.map((g) =>
              ids.has(g.id)
                ? {
                    ...g,
                    status: "succeeded",
                    document: documents.find((d) => d.generationId === g.id),
                  }
                : g,
            ),
          };
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "생성 이력을 조회하지 못했습니다.",
          );
      });
    return () => controller.abort();
  }, [r.id]);
  const pending = r.generations.find(
    (g) => g.status === "queued" || g.status === "running",
  );
  useEffect(() => {
    if (!enabled || !pending || pending.error) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = pending.id.startsWith("pending:")
          ? await requirementsService.start(
              pending.inputSnapshot,
              pending.idempotencyKey,
              controller.signal,
              r.requirements.find(d => d.id === pending.contextDocumentIds?.[0]),
              pending.generationNumber,
            )
          : await requirementsService.get(r.id, pending.id, controller.signal);
        if (controller.signal.aborted) return;
        update((latest) => ({
          ...mergeGeneration(
            {
              ...latest,
              generations: latest.generations.filter(
                (g) => g.id !== pending.id,
              ),
            },
            { ...pending, ...result, inputSnapshot: result.inputSnapshot || pending.inputSnapshot, contextDocumentIds: result.contextDocumentIds || pending.contextDocumentIds },
          ),
        }));
      } catch (e) {
        if (controller.signal.aborted) return;
        const message =
          e instanceof Error ? e.message : "작업 상태를 확인하지 못했습니다.";
        update((latest) => ({
          ...latest,
          generations: latest.generations.map((g) =>
            g.id === pending.id ? { ...g, error: message } : g,
          ),
        }));
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [r.id, pending, enabled]);
  const generate = () => {
    setError("");
    if (pending || !canGenerate(r)) return;
    const key = crypto.randomUUID();
    const g: RequirementGeneration = {
      id: `pending:${key}`,
      uiInputRevision: r.inputRevision,
      idempotencyKey: key,
      generationNumber:
        Math.max(
          0,
          ...r.generations.map((g) => g.generationNumber),
          ...r.requirements.map((d) => d.generationNumber),
        ) + 1,
      status: "queued",
      phase: "queued",
      displayTitle: r.title || "요구사항",
      contextDocumentIds: r.requirements.length ? [r.requirements.slice().sort((a, b) => b.generationNumber - a.generationNumber)[0].id] : [],
      inputSnapshot: snapshotOf(r),
      createdAt: new Date().toISOString(),
    };
    update((latest) => ({
      ...latest,
      generations: [g, ...latest.generations],
    }));
  };
  const addFiles = async (files: File[]) => {
    setError("");
    const remaining = r.attachments.filter(
      (a) =>
        !files.some((f) => f.name === a.name && a.uploadStatus !== "uploaded"),
    );
    try {
      validateFiles(files, remaining.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 확인해주세요.");
      return;
    }
    const additions: Attachment[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type,
      uploadStatus: "pending",
    }));
    files.forEach((f, i) => pendingFiles.set(additions[i].id!, f));
    edit({ attachments: [...remaining, ...additions] });
    for (const a of additions) await upload(a);
  };
  async function upload(a: Attachment) {
    const file = pendingFiles.get(a.id!);
    if (!file) {
      setError("파일을 다시 선택해주세요.");
      return;
    }
    update((latest) => ({
      ...latest,
      attachments: latest.attachments.map((x) =>
        x.id === a.id
          ? { ...x, uploadStatus: "uploading", error: undefined }
          : x,
      ),
    }));
    try {
      const result = await requirementsService.upload(
        r.id,
        file,
        new AbortController().signal,
      );
      update((latest) => ({
        ...latest,
        attachments: latest.attachments.map((x) =>
          x.id === a.id
            ? {
                ...x,
                uploadStatus: "uploaded",
                serverFileId: result.serverFileId,
                error: undefined,
              }
            : x,
        ),
      }));
      pendingFiles.delete(a.id!);
    } catch (e) {
      update((latest) => ({
        ...latest,
        attachments: latest.attachments.map((x) =>
          x.id === a.id
            ? {
                ...x,
                uploadStatus: "failed",
                error: e instanceof Error ? e.message : "업로드 실패",
              }
            : x,
        ),
      }));
    }
  }
  const retry = (id: string) =>
    update((latest) => ({
      ...latest,
      generations: latest.generations.map((g) =>
        g.id === id ? { ...g, error: undefined } : g,
      ),
    }));
  return { generate, addFiles, upload, retry, error, pending };
}
