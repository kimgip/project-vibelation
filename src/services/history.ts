import historyFixture from "../mocks/history.json" with { type: "json" };
import { validRegistration } from "../storage/repositories";
import type { Registration } from "../domain/types";

export interface HistoryService {
  list(signal: AbortSignal): Promise<{ items: Registration[]; nextCursor: null }>;
  get(id: string, signal: AbortSignal): Promise<Registration | undefined>;
}
const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException("조회 취소", "AbortError"));
  const abort = () => { clearTimeout(timer); reject(new DOMException("조회 취소", "AbortError")); };
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 200);
  signal.addEventListener("abort", abort, { once: true });
});
/** Local registrations override fixtures with the same ID. Fixtures are never persisted. */
export function createMockHistoryService(localItems: Registration[]): HistoryService {
  function rows(): Registration[] {
    const fixtures: unknown[] = historyFixture.items;
    if (!fixtures.every(validRegistration)) throw new Error("검토 이력 Mock JSON 형식을 확인해주세요.");
    const merged = new Map(fixtures.map(item => [item.id, item]));
    localItems.forEach(item => merged.set(item.id, item));
    return structuredClone([...merged.values()].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)));
  }
  return {
    async list(signal) { await wait(signal); return {items: rows(), nextCursor: null}; },
    async get(id, signal) { await wait(signal); return rows().find(item => item.id === id); },
  };
}
