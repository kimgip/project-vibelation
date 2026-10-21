import type { LegacyReference, LegacySystem } from "../domain/legacySources";

let opening: Promise<IDBDatabase> | undefined;
function open() {
  if (!opening)
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("soetmul.legacy-sources.v1", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("systems", { keyPath: "id" });
        request.result.createObjectStore("references", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        opening = undefined;
        reject(new Error("코드 ZIP 보관 공간을 열지 못했습니다."));
      };
      request.onblocked = () => {
        opening = undefined;
        reject(new Error("다른 탭의 코드 보관 공간을 닫고 다시 시도해주세요."));
      };
    });
  return opening;
}
async function read<T>(store: string, id?: string): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly"),
      objectStore = tx.objectStore(store);
    const request = id ? objectStore.get(id) : objectStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("저장된 코드 ZIP을 읽지 못했습니다."));
  });
}
export const legacyRepository = {
  systems: () => read<LegacySystem[]>("systems"),
  references: () => read<LegacyReference[]>("references"),
  reference: (id: string) =>
    read<LegacyReference | undefined>("references", id),
  async save(system: LegacySystem, expectedRevision: number) {
    const db = await open();
    return new Promise<LegacySystem>((resolve, reject) => {
      const tx = db.transaction("systems", "readwrite"),
        store = tx.objectStore("systems");
      const request = store.get(system.id);
      let conflict = false;
      const next = { ...system, revision: expectedRevision + 1 };
      request.onsuccess = () => {
        if ((request.result?.revision ?? 0) !== expectedRevision) {
          conflict = true;
          tx.abort();
          return;
        }
        store.put(next);
      };
      tx.oncomplete = () => resolve(next);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            conflict
              ? "다른 탭에서 틀이 변경됐습니다. 다시 불러와주세요."
              : "코드 ZIP 저장에 실패했습니다. 브라우저 저장 공간을 확인해주세요.",
          ),
        );
    });
  },
  async apply(system: LegacySystem) {
    if (!system.name.trim() || !system.archives.length)
      throw new Error("시스템 이름과 코드 ZIP을 1개 이상 등록해주세요.");
    const reference: LegacyReference = {
      id: `zip:${crypto.randomUUID()}`,
      systemId: system.id,
      name: system.name.trim(),
      description: system.description,
      createdAt: new Date().toISOString(),
      archives: system.archives,
    };
    const db = await open();
    return new Promise<LegacySystem>((resolve, reject) => {
      const tx = db.transaction(["systems", "references"], "readwrite"),
        store = tx.objectStore("systems");
      let conflict = false;
      const next = {
        ...system,
        activeReferenceId: reference.id,
        revision: system.revision + 1,
      };
      const request = store.get(system.id);
      request.onsuccess = () => {
        if ((request.result?.revision ?? 0) !== system.revision) {
          conflict = true;
          tx.abort();
          return;
        }
        tx.objectStore("references").add(reference);
        store.put(next);
      };
      tx.oncomplete = () => resolve(next);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            conflict
              ? "다른 탭에서 틀이 변경됐습니다. 다시 불러와주세요."
              : "코드 기준 적용에 실패했습니다. 이전 기준을 유지합니다.",
          ),
        );
    });
  },
};

export async function sourcesForVersion(version: string) {
  if (!version.startsWith("zip:")) return [];
  const reference = await legacyRepository.reference(version);
  if (!reference?.archives.length)
    throw new Error(
      "이 요청의 코드 ZIP을 찾을 수 없습니다. 설정에서 등록하고 틀을 다시 선택해주세요.",
    );
  return reference.archives;
}
