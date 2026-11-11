const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const configured = env?.VITE_API_URL || env?.VITE_REQUIREMENTS_API_URL || env?.VITE_GENERATION_API_URL || "";
export const apiBase = configured.replace(/\/$/, "").replace(/\/api$/, "");
export const serverMode = !!configured;
export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  retryAfter: string | null;
  constructor(status: number, code: string, message: string,
    details: Record<string, unknown> = {}, retryAfter: string | null = null) {
    super(message); this.status = status; this.code = code; this.details = details; this.retryAfter = retryAfter;
  }
}
export function createApiClient(base: string, fetcher: typeof fetch = (...args) => fetch(...args)) {
  const root = base.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
  return async function request<T = Record<string, any>>(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<T> {
    signal.throwIfAborted();
    const response = await fetcher(root + path, { ...init, signal, credentials: "same-origin" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = data.error || data.detail?.error || data;
      throw new ApiError(response.status, error.code || "HTTP_ERROR",
        error.message || (typeof data.detail === "string" ? data.detail : `서버 오류 (${response.status})`),
        error.details || {}, response.headers.get("Retry-After"));
    }
    return response.status === 204 ? undefined as T : response.json();
  };
}
export const apiJson = createApiClient(apiBase);
export function jsonPost(body: unknown, key: string): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) };
}
/** Persist keys across transport failures; acknowledge only after the server accepts the operation. */
export function operationKey(operation: string, base = apiBase) {
  const name = `soetmul.api-key:${base.replace(/\/api\/?$/, "")}:${operation}`;
  let key = localStorage.getItem(name);
  if (!key) { key = crypto.randomUUID(); localStorage.setItem(name, key); }
  return { key, done: () => localStorage.removeItem(name) };
}
