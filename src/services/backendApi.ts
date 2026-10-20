/** API v1.6. Base includes /api; never set multipart Content-Type by hand. */
import { generationFormData, type SourceArchive } from "../domain/legacySources";
export type Wire = Record<string, any>;
export class ApiError extends Error {
    status: number;
    code: string;
    details: Wire;
    retryAfter?: string | null;
    constructor(status: number, code: string, message: string, details: Wire = {}, retryAfter?: string | null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.retryAfter = retryAfter;
    }
}
const env = (import.meta as ImportMeta & {
    env?: Record<string, string>;
}).env;
export const apiBase = env?.VITE_API_URL || env?.VITE_GENERATION_API_URL || (env?.VITE_REQUIREMENTS_API_URL ? env.VITE_REQUIREMENTS_API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "") + "/api" : "");
export function createBackendApi(base: string, fetcher: typeof fetch = fetch) {
    const root = base.replace(/\/+$/, "");
    const id = encodeURIComponent;
    async function request<T = Wire>(path: string, signal?: AbortSignal, init: RequestInit = {}): Promise<T> {
        const response = await fetcher(root + path, { credentials: "include", ...init, signal });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const error = body.error || body.detail?.error || body;
            throw new ApiError(response.status, error.code || "HTTP_ERROR", error.message || (typeof body.detail === "string" ? body.detail : `서버 요청 실패 (${response.status})`), error.details, response.headers.get("Retry-After"));
        }
        return response.status === 204 ? undefined as T : response.json();
    }
    const get = (path: string, signal?: AbortSignal) => request(path, signal);
    const json = (path: string, method: string, body: unknown, signal?: AbortSignal, key?: string) => request(path, signal, { method, headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) });
    const post = (path: string, body: unknown, key: string, signal?: AbortSignal) => json(path, "POST", body, signal, key);
    const req = (r: string) => `/requests/${id(r)}`;
    const sys = (s: string) => `/legacy-systems/${id(s)}`;
    const multipart = (path: string, body: FormData, key: string, signal?: AbortSignal) => request(path, signal, { method: "POST", headers: { "Idempotency-Key": key }, body });
    const query = (params: Record<string, string | number | undefined> = {}) => {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined)
            q.set(k, String(v)); });
        return q.size ? `?${q}` : "";
    };
    return {
        request,
        createRequest: (body: {
            title: string;
            legacyReferenceId: string;
        }, key: string, s?: AbortSignal) => post("/requests", body, key, s),
        listRequests: (params?: Record<string, string | number | undefined>, s?: AbortSignal) => get("/requests" + query(params), s),
        getRequest: (r: string, s?: AbortSignal) => get(req(r), s),
        patchRequest: (r: string, body: Wire, s?: AbortSignal) => json(req(r), "PATCH", body, s),
        listLegacyReferences: (s?: AbortSignal) => get("/legacy-references", s),
        attachmentPolicy: (s?: AbortSignal) => get("/attachment-policy", s),
        uploadAttachment: (r: string, file: File, key: string, s?: AbortSignal) => { const b = new FormData(); b.append("file", file); return multipart(req(r) + "/attachments", b, key, s); },
        attachmentStatus: (r: string, f: string, s?: AbortSignal) => get(req(r) + `/attachments/${id(f)}`, s),
        startRequirements: (r: string, body: Wire, key: string, s?: AbortSignal) => post(req(r) + "/requirement-generations", body, key, s),
        requirementJobs: (r: string, s?: AbortSignal) => get(req(r) + "/requirement-generations", s),
        requirementJob: (r: string, j: string, s?: AbortSignal) => get(req(r) + `/requirement-generations/${id(j)}`, s),
        requirementDocuments: (r: string, cursor?: string, s?: AbortSignal) => get(req(r) + "/requirement-documents" + query({ cursor }), s),
        requirementDocument: (r: string, d: string, s?: AbortSignal) => get(req(r) + `/requirement-documents/${id(d)}`, s),
        startMock: (r: string, d: string, file: File, sources: SourceArchive[], version: string, key: string, s?: AbortSignal) => { const b = generationFormData(file, sources, version); b.set("legacyVersion", version); b.set("requirementDocumentId", d); return multipart(req(r) + "/system-mock-generations", b, key, s); },
        mockJob: (r: string, j: string, s?: AbortSignal) => get(req(r) + `/system-mock-generations/${id(j)}`, s),
        latestMock: (r: string, s?: AbortSignal) => get(req(r) + "/system-mock", s),
        confirm: (r: string, body: Wire, key: string, s?: AbortSignal) => post(req(r) + "/requirement-confirmations", body, key, s),
        confirmations: (r: string, s?: AbortSignal) => get(req(r) + "/requirement-confirmations", s),
        confirmation: (r: string, c: string, s?: AbortSignal) => get(req(r) + `/requirement-confirmations/${id(c)}`, s),
        startAnalysis: (r: string, c: string, file: File, sources: SourceArchive[], version: string, key: string, s?: AbortSignal) => { const b = generationFormData(file, sources, version); b.set("legacyVersion", version); return multipart(req(r) + `/requirement-confirmations/${id(c)}/analysis-jobs`, b, key, s); },
        analysisJob: (j: string, s?: AbortSignal) => get(`/analysis-jobs/${id(j)}`, s),
        analysisResult: (a: string, s?: AbortSignal) => get(`/analysis-results/${id(a)}`, s),
        startReport: (body: Wire, key: string, s?: AbortSignal) => post("/review-reports", body, key, s),
        reportJob: (j: string, s?: AbortSignal) => get(`/report-jobs/${id(j)}`, s),
        report: (r: string, s?: AbortSignal) => get(`/review-reports/${id(r)}`, s),
        register: (body: Wire, key: string, s?: AbortSignal) => post("/review-registrations", body, key, s),
        registrations: (params?: Record<string, string | number | undefined>, s?: AbortSignal) => get("/review-registrations" + query(params), s),
        registration: (r: string, s?: AbortSignal) => get(`/review-registrations/${id(r)}`, s),
        createSystem: (body: {
            name: string;
            description: string;
        }, key: string, s?: AbortSignal) => post("/legacy-systems", body, key, s),
        system: (r: string, s?: AbortSignal) => get(sys(r), s),
        patchSystem: (r: string, body: Wire, key: string, s?: AbortSignal) => json(sys(r), "PATCH", body, s, key),
        uploadSource: (r: string, file: File, role: "frontend" | "backend", revision: number, key: string, replaces?: string, s?: AbortSignal) => { const b = new FormData(); b.append("file", file); b.append("role", role); b.append("expectedSystemRevision", String(revision)); if (replaces)
            b.append("replacesSourcePackageId", replaces); return multipart(sys(r) + "/source-packages", b, key, s); },
        sourceStatus: (r: string, p: string, s?: AbortSignal) => get(sys(r) + `/source-packages/${id(p)}`, s),
        removeSource: (r: string, p: string, revision: number, s?: AbortSignal) => request<void>(sys(r) + `/source-packages/${id(p)}`, s, { method: "DELETE", headers: { "If-Match": `"${revision}"` } }),
    };
}
export const backendApi = apiBase ? createBackendApi(apiBase) : undefined;
/** Keep a key across network failures; clear only after the operation is acknowledged. */
export function operationKey(operation: string) {
    const name = `soetmul.api-key:${apiBase}:${operation}`;
    let key = localStorage.getItem(name);
    if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem(name, key);
    }
    return { key, done: () => localStorage.removeItem(name) };
}
