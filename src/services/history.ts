import { localMockSettings } from "../mocks/fixtures";
import { backendApi } from "./backendApi";
import { registrationFromWire } from "./serverWorkspace";
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
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, localMockSettings.timing.historyDelayMs);
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

export function createHistoryService(localItems:Registration[]):HistoryService {
  if(!backendApi)return createMockHistoryService(localItems);
  const api=backendApi;
  return {
    async list(signal){
      const items:Registration[]=[];let cursor:string|undefined;const seen=new Set<string>();
      do{const page=await api.registrations({cursor},signal);
        for(const row of page.items)items.push(registrationFromWire(row.confirmationSnapshot ? row : await api.registration(row.id,signal)));
        cursor=page.nextCursor;if(cursor && seen.has(cursor))throw new Error("이력 페이지가 반복됩니다.");if(cursor)seen.add(cursor);
      }while(cursor);
      return {items,nextCursor:null};
    },
    async get(id,signal){try{return registrationFromWire(await api.registration(id,signal));}catch(e){if(e instanceof Error && "status" in e && e.status===404)return undefined;throw e;}}
  };
}
