export type SourceRole = "frontend" | "backend";
export interface SourceArchive {
  id: string;
  role: SourceRole;
  name: string;
  sha256: string;
  file: File;
}
export interface LegacyReference {
  id: string;
  systemId: string;
  name: string;
  description: string;
  createdAt: string;
  archives: SourceArchive[];
}
export interface LegacySystem {
  id: string;
  name: string;
  description: string;
  archives: SourceArchive[];
  activeReferenceId?: string;
  revision: number;
}

// This is a browser storage limit, not the server's ZIP processing policy.
export const LOCAL_ZIP_LIMIT = 100 * 1024 * 1024;
export async function prepareSourceArchive(
  file: File,
  role: SourceRole,
): Promise<SourceArchive> {
  if (!file.name.toLowerCase().endsWith(".zip"))
    throw new Error("코드는 .zip 파일로 선택해주세요.");
  if (!file.size || file.size > LOCAL_ZIP_LIMIT)
    throw new Error(
      "브라우저 보관은 ZIP 파일당 100MiB까지 지원합니다. 빈 파일은 사용할 수 없습니다.",
    );
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (
    signature[0] !== 0x50 ||
    signature[1] !== 0x4b ||
    signature[2] !== 0x03 ||
    signature[3] !== 0x04
  )
    throw new Error(
      "비어 있지 않은 ZIP 파일을 선택해주세요. 파일 내부 검증은 서버에서 수행합니다.",
    );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const sha256 = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return { id: crypto.randomUUID(), name: file.name, role, sha256, file };
}

export function sourceManifest(archives: SourceArchive[]) {
  return archives.map((a, index) => ({
    index,
    id: a.id,
    name: a.name,
    role: a.role,
    sha256: a.sha256,
    sizeBytes: a.file.size,
  }));
}

/** Both generation endpoints receive actual ZIP bytes, never just file names. */
export function generationFormData(
  file: File,
  archives: SourceArchive[],
  legacyVersion: string,
): FormData {
  const body = new FormData();
  body.append("file", file);
  if (archives.length) {
    body.append("legacyVersion", legacyVersion);
    body.append("sourceManifest", JSON.stringify(sourceManifest(archives)));
    for (const archive of archives)
      body.append("sourceFiles", archive.file, archive.name);
  }
  return body;
}
