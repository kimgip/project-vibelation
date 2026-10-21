const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const configured = env?.VITE_API_URL || env?.VITE_REQUIREMENTS_API_URL || env?.VITE_GENERATION_API_URL || "";
export const apiBase = configured.replace(/\/$/, "").replace(/\/api$/, "");
export const serverMode = !!configured;
export async function apiJson<T = Record<string, any>>(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}/api${path}`, { ...init, signal, credentials: "same-origin" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || data.detail?.error?.message || data.message || `서버 오류 (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}
export function jsonPost(body: unknown, key: string): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) };
}
