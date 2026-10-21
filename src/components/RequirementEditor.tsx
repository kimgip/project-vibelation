import { useState } from "react";
import { MarkdownPreview } from "./MarkdownPreview";
import { requirementsService } from "../services/requirements";
import type { RequirementDocument } from "../domain/types";

export function RequirementEditor({ document, onSaved, onDirty }: { document: RequirementDocument; onSaved: (doc: RequirementDocument) => void; onDirty: (dirty: boolean) => void }) {
  const [code, setCode] = useState(false), [draft, setDraft] = useState(document.markdown);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dirty = draft !== document.markdown;
  async function save() {
    if (!draft.trim() || new TextEncoder().encode(draft).length > 1048576) { setError("MD는 빈 내용 없이 1MiB 이하로 입력해주세요."); return; }
    setBusy(true); setError("");
    try { const result = await requirementsService.saveDocument(document, draft, new AbortController().signal); onSaved(result); onDirty(false); }
    catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); }
    finally { setBusy(false); }
  }
  return <div>
    <div className="code-toggle" role="group" aria-label="MD 보기 방식"><button aria-pressed={code} onClick={() => setCode(true)}>Code</button><button aria-pressed={!code} onClick={() => setCode(false)}>Preview</button></div>
    {dirty && <p role="status">저장하지 않은 수정 내용이 있습니다. 저장하면 같은 버전에 반영됩니다.</p>}
    {code ? <textarea aria-label="요구사항 MD 코드" spellCheck={false} disabled={busy} className="code" style={{width:"100%",minHeight:450}} value={draft} onChange={e => {setDraft(e.target.value); onDirty(e.target.value !== document.markdown);}} /> : <MarkdownPreview markdown={draft} />}
    {(code || dirty) && <div className="code-toggle"><button disabled={!dirty || busy} onClick={() => void save()}>{busy ? "저장 중…" : "저장"}</button><button disabled={!dirty || busy} onClick={() => {setDraft(document.markdown); onDirty(false); setError("");}}>수정 취소</button></div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
