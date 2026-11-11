import { apiBase, createApiClient, jsonPost } from "./api";
export { ApiError, operationKey, apiBase } from "./api";
export type Wire = Record<string, any>;
/** Current main contract. No legacy review-report generation endpoints. */
export function createBackendApi(base: string, fetcher?: typeof fetch) {
  const request = createApiClient(base, fetcher);
  const id = encodeURIComponent;
  const req = (r: string) => `/requests/${id(r)}`;
  const sys = (s: string) => `/legacy-systems/${id(s)}`;
  const get = (path: string, signal: AbortSignal) => request(path, signal);
  const json = (path: string, body: Wire, signal: AbortSignal, key?: string) => request(path, signal,
    { method: "PATCH", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) });
  const multipart = (path: string, body: FormData, key: string, signal: AbortSignal) => request(path, signal,
    { method: "POST", headers: { "Idempotency-Key": key }, body });
  return {
    base, request, get,
    createRequest: (body: Wire, key: string, signal: AbortSignal) => request("/requests", signal, jsonPost(body, key)),
    getRequest: (r: string, signal: AbortSignal) => get(req(r), signal),
    patchRequest: (r: string, body: Wire, signal: AbortSignal) => json(req(r), body, signal),
    listLegacyReferences: (signal: AbortSignal) => get("/legacy-references", signal),
    attachmentPolicy: (signal: AbortSignal) => get("/attachment-policy", signal),
    attachmentStatus: (r: string, f: string, signal: AbortSignal) => get(req(r) + `/attachments/${id(f)}`, signal),
    requirementDocument: (r: string, d: string, signal: AbortSignal) => get(req(r) + `/requirement-documents/${id(d)}`, signal),
    confirmation: (r: string, c: string, signal: AbortSignal) => get(req(r) + `/requirement-confirmations/${id(c)}`, signal),
    latestMock: (r: string, signal: AbortSignal) => get(req(r) + "/system-mock", signal),
    analysisResult: (a: string, signal: AbortSignal) => get(`/analysis-results/${id(a)}`, signal),
    similarCaseResult: (a: string, signal: AbortSignal) => get(`/similar-case-analysis-results/${id(a)}`, signal),
    registration: (r: string, signal: AbortSignal) => get(`/review-registrations/${id(r)}`, signal),
    register: (body: Wire, key: string, signal: AbortSignal) => request("/review-registrations", signal, jsonPost(body, key)),
    createSystem: (body: Wire, key: string, signal: AbortSignal) => request("/legacy-systems", signal, jsonPost(body, key)),
    system: (s: string, signal: AbortSignal) => get(sys(s), signal),
    patchSystem: (s: string, body: Wire, key: string, signal: AbortSignal) => json(sys(s), body, signal, key),
    uploadSource: (s: string, file: File, role: "frontend" | "backend", revision: number, key: string, replaces: string | undefined, signal: AbortSignal) => {
      const body = new FormData(); body.append("file", file); body.append("role", role); body.append("expectedSystemRevision", String(revision));
      if (replaces) body.append("replacesSourcePackageId", replaces);
      return multipart(sys(s) + "/source-packages", body, key, signal);
    },
    sourceStatus: (s: string, p: string, signal: AbortSignal) => get(sys(s) + `/source-packages/${id(p)}`, signal),
    removeSource: (s: string, p: string, revision: number, signal: AbortSignal) => request(sys(s) + `/source-packages/${id(p)}`, signal,
      { method: "DELETE", headers: { "If-Match": `"${revision}"` } }),
  };
}
export const backendApi = createBackendApi(apiBase);
export type BackendApi = ReturnType<typeof createBackendApi>;
