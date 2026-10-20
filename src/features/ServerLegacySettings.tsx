import { useEffect, useRef, useState } from "react";
import { backendApi, apiBase, operationKey, type Wire } from "../services/backendApi";
import { waitForPoll } from "../services/generationTransport";
/** Optional §20 server management; browser ZIP storage remains available under §21. */
export function ServerLegacySettings() {
    const [systemId, setSystemId] = useState(() => localStorage.getItem(`soetmul.system:${apiBase}`) || "");
    const [row, setRow] = useState<Wire>();
    const [name, setName] = useState(""), [description, setDescription] = useState("");
    const [role, setRole] = useState<"frontend" | "backend">("frontend");
    const [replacement, setReplacement] = useState("");
    const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    const active = useRef<AbortController | null>(null);
    useEffect(() => () => active.current?.abort(), []);
    const api = backendApi!;
    function show(value: Wire) { setRow(value); setName(value.name || ""); setDescription(value.description || ""); }
    async function act(fn: (s: AbortSignal) => Promise<void>) {
        if (busy)
            return;
        const controller = new AbortController();
        active.current = controller;
        setBusy(true);
        setMessage("");
        try {
            await fn(controller.signal);
        }
        catch (e) {
            if (!controller.signal.aborted)
                setMessage(e instanceof Error ? e.message : "서버 코드 관리 실패");
        }
        finally {
            if (!controller.signal.aborted)
                setBusy(false);
        }
    }
    async function refresh(id: string, s: AbortSignal) { show(await api.system(id, s)); localStorage.setItem(`soetmul.system:${apiBase}`, id); setSystemId(id); }
    const packages: Wire[] = row?.packages || row?.sourcePackages || row?.draftPackages || [];
    return <section className="workflow-card">
    <h2>서버 레거시 코드 관리</h2>
    <p>서버에 시스템과 ZIP 구성을 저장합니다. 서버가 아직 지원하지 않으면 오류를 표시하며 입력은 보존합니다.</p>
    <fieldset disabled={busy}>
      <label>시스템 ID <input value={systemId} onChange={e => setSystemId(e.target.value)}/></label>
      <button disabled={!systemId} onClick={() => void act(s => refresh(systemId, s))}>시스템 불러오기</button>
      <button onClick={() => { setRow(undefined); setSystemId(""); setName(""); setDescription(""); }}>새 시스템</button>
      <label>서버 시스템 이름 <input maxLength={120} value={name} onChange={e => setName(e.target.value)}/></label>
      <label>설명 <textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></label>
      <button disabled={!name.trim()} onClick={() => void act(async (s) => {
            if (row) {
                const body = { expectedSystemRevision: row.systemRevision, action: "save-draft", name, description };
                const op = operationKey(`system-save:${systemId}:${JSON.stringify(body)}`);
                await api.patchSystem(systemId, body, op.key, s);
                op.done();
                await refresh(systemId, s);
            }
            else {
                const body = { name, description };
                const op = operationKey(`system-create:${JSON.stringify(body)}`);
                const created = await api.createSystem(body, op.key, s);
                op.done();
                await refresh(created.systemId, s);
            }
            setMessage("서버 초안을 저장했습니다.");
        })}>초안 저장</button>
      {row && <>
        <p>리비전 {row.systemRevision} · 활성 기준 {row.activeLegacyReferenceId || "미적용"}</p>
        {row.uploadPolicy && <p>ZIP 최대 {row.uploadPolicy.maxArchiveBytes} bytes · 최대 파일 수 {row.uploadPolicy.maxFileCount} · 최대 패키지 {row.uploadPolicy.maxPackages}</p>}
        <label>서버 코드 분류 <select value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="frontend">프론트엔드</option><option value="backend">백엔드</option></select></label>
        <label>교체 대상 <select value={replacement} onChange={e => setReplacement(e.target.value)}><option value="">새 ZIP 추가</option>{packages.map(p => <option key={p.id || p.packageId} value={p.id || p.packageId}>{p.name}</option>)}</select></label>
        <label>ZIP 업로드 <input type="file" accept=".zip" onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file)
                    return;
                void act(async (s) => {
                    if (!file.name.toLowerCase().endsWith(".zip") || !file.size || file.size > row.uploadPolicy?.maxArchiveBytes)
                        throw new Error("서버 ZIP 업로드 정책을 확인해주세요.");
                    const op = operationKey(`source:${systemId}:${row.systemRevision}:${replacement}:${role}:${file.name}:${file.size}:${file.lastModified}`);
                    let p = await api.uploadSource(systemId, file, role, row.systemRevision, op.key, replacement || undefined, s);
                    const packageId = p.packageId || p.id;
                    for (let n = 0; !["ready", "failed", "rejected"].includes(p.status); n++) {
                        if (n >= 600)
                            throw new Error("ZIP 검사가 진행 중입니다. 시스템을 다시 불러와주세요.");
                        await waitForPoll(s, Math.min(30000, Math.max(500, p.pollAfterMs || 1000)));
                        p = await api.sourceStatus(systemId, packageId, s);
                    }
                    if (p.status !== "ready")
                        throw new Error(p.error?.message || "ZIP 검증에 실패했습니다.");
                    op.done();
                    await refresh(systemId, s);
                    setReplacement("");
                    setMessage("ZIP 검증을 완료했습니다.");
                });
            }}/></label>
        {packages.map(p => <div key={p.id || p.packageId} className="source-package"><span>{p.name} · {p.role} · {p.status}</span>
          <button onClick={() => void act(async (s) => { const status = await api.sourceStatus(systemId, p.id || p.packageId, s); setMessage(`${p.name}: ${status.status}`); await refresh(systemId, s); })}>상태 조회</button>
          <button onClick={() => void act(async (s) => { await api.removeSource(systemId, p.id || p.packageId, row.systemRevision, s); await refresh(systemId, s); })}>초안에서 제외</button>
        </div>)}
        <button disabled={!packages.length || packages.some(p => p.status !== "ready")} onClick={() => void act(async (s) => {
                const body = { expectedSystemRevision: row.systemRevision, action: "apply" };
                const op = operationKey(`system-apply:${systemId}:${row.systemRevision}`);
                await api.patchSystem(systemId, body, op.key, s);
                op.done();
                await refresh(systemId, s);
                setMessage("새 서버 코드 기준을 적용했습니다.");
            })}>검증된 구성 적용</button>
      </>}
    </fieldset>
    {busy && <p role="status">서버 처리 중…</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
