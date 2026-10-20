import { apiBase, createBackendApi } from "./backendApi";
import {
  generationFormData,
  type SourceArchive,
} from "../domain/legacySources";

export function createGenerationTransport(
  base: string,
  fetcher: typeof fetch = fetch,
) {
  const root = base.replace(/\/$/, "");
  async function json(
    path: string,
    signal: AbortSignal,
    init: RequestInit = {},
  ) {
    return createBackendApi(root, fetcher).request(path, signal, init);
  }
  return {
    async start(
      path: string,
      file: File,
      archives: SourceArchive[],
      version: string,
      key: string,
      signal: AbortSignal,
      documentId?: string,
    ) {
      if (!archives.length)
        throw new Error(
          "서버 전송에 사용할 코드 ZIP을 설정에서 등록하고 선택해주세요.",
        );
      const body = generationFormData(file, archives, version);
      if (documentId) body.append("requirementDocumentId", documentId);
      return json(path, signal, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body,
      });
    },
    get: (path: string, signal: AbortSignal) => json(path, signal),
  };
}

export const generationBase = apiBase;
export const generationTransport = generationBase
  ? createGenerationTransport(generationBase)
  : undefined;

export function waitForPoll(signal: AbortSignal, delay = 1000) {
  return new Promise<void>((resolve, reject) => {
    const aborted = () => {
      clearTimeout(timer);
      reject(new DOMException("취소됨", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    }, delay);
    if (signal.aborted) aborted();
    else signal.addEventListener("abort", aborted, { once: true });
  });
}
