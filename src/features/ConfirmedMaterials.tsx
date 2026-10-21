import { useEffect, useRef, useState } from "react";
import type { RequirementConfirmation } from "../domain/types";
import { listMaterials, materialBlob, type Material } from "../services/materials";
import { downloadBlob } from "../utils/downloads";
export function ConfirmedMaterials({ confirmation: c }: { confirmation?: RequirementConfirmation }) {
  const [rows, setRows] = useState<Material[]>();
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    setRows(undefined); setError(""); setErrors({}); setBusy([]);
    if (c) listMaterials(c, abort.signal).then(result => {
      if (!abort.signal.aborted) { setRows(result.items); setAvailable(result.available); }
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [c?.id, retry]);
  async function download(item: Material) {
    const abort = controller.current;
    if (!c || !abort || abort.signal.aborted || busy.includes(item.id)) return;
    setBusy(v => [...v, item.id]); setErrors(v => ({ ...v, [item.id]: "" }));
    try {
      const blob = await materialBlob(c, item, abort.signal);
      if (!abort.signal.aborted) downloadBlob(item.fileName, blob);
    } catch (e) {
      if (!abort.signal.aborted) setErrors(v => ({ ...v, [item.id]: e instanceof Error ? e.message : "다운로드 실패" }));
    } finally { if (!abort.signal.aborted) setBusy(v => v.filter(id => id !== item.id)); }
  }
  return <section className="workflow-card confirmed-materials" aria-label="확정 요구사항 입력 자료" tabIndex={-1}>
    <h3>확정 요구사항 입력 자료</h3>
    {c ? <><p>협의 기준 {c.documentSnapshot.generationNumber}차안 · {new Date(c.confirmedAt).toLocaleString("ko-KR")}</p>
      {error ? <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></p> : !rows ? <p role="status">자료를 불러오는 중…</p> : !available ? <p>확정 당시 자료를 확인할 수 없습니다.</p> : !rows.length ? <p>입력 자료가 없습니다.</p> : <ul className="material-download-list">{rows.map(item => <li key={item.id}>
        <span><strong>{item.fileName}</strong><small>{item.kind === "teams" ? "Teams 텍스트 내보내기" : item.kind === "html" ? "HTML 입력 내보내기" : "첨부 원본"} · {item.sizeBytes === null ? "—" : `${item.sizeBytes.toLocaleString()} bytes`}</small>{item.downloadStatus !== "available" && <small>{item.downloadStatus === "blocked" ? "다운로드 차단됨" : "원본 없음"}</small>}</span>
        <button aria-label={`${item.fileName} 다운로드`} disabled={item.downloadStatus !== "available" || busy.includes(item.id)} onClick={() => void download(item)}>{busy.includes(item.id) ? "다운로드 중…" : "다운로드"}</button>
        {errors[item.id] && <p role="alert">{errors[item.id]}</p>}
      </li>)}</ul>}
    </> : <p>확정한 요구사항이 없습니다.</p>}
  </section>;
}
