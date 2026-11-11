import { serverDraftKey, serverDrafts, saveServerDraft, dirtyKey, syncRequest, createServerRequest, serverRequests, confirmServerRequest, registerServerRequest } from "../services/serverWorkspace";
import { snapshotOf } from "../domain/types";
import { analyzeSimilarCases } from "../services/similarCases";
import { apiBase, serverMode } from "../services/api";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  blankRequest,
  editRequest,
  basisOf,
  sameBasis,
  confirmRequirement,
  isCurrent,
  type WorkRequest,
  type Registration,
} from "../domain/types";
import { repository, REQUEST_KEY, HISTORY_KEY } from "../storage/repositories";
import {
  analysisInput,
  analyzeRequirements,
} from "../services/contract";
import { sourcesForVersion } from "../storage/legacySources";
import type { WorkspaceProps } from "./workspace";
import type { Material } from "./Landing";
function load() {
  try {
    return {
      requests: serverMode ? serverDrafts() : repository.requests(),
      history: serverMode ? [] : repository.history(),
      error: "",
    };
  } catch (e) {
    return {
      requests: [] as WorkRequest[],
      history: [] as Registration[],
      error: e instanceof Error ? e.message : "자료를 불러오지 못했습니다.",
    };
  }
}
export function useWorkspace() {
  const [initial] = useState(load),
    [requests, setRequests] = useState(initial.requests),
    [history, setHistory] = useState(initial.history),
    [message, setMessage] = useState(initial.error),
    [storageBlocked, setStorageBlocked] = useState(!!initial.error),
    [saved, setSaved] = useState(true),
    [busy, setBusy] = useState("");
  const [serverLoaded, setServerLoaded] = useState(!serverMode);
  const location = useLocation(),
    navigate = useNavigate();
  const parts = location.pathname.split("/");
  const isHistory = parts[1] === "history";
  useEffect(() => {
    if (location.pathname === "/team") navigate("/requests", { replace: true });
  }, [location.pathname, navigate]);
  const id = parts[2];
  const r = requests.find((x) => x.id === id);
  const step = ["mock", "agreement"].includes(parts[3])
    ? "input"
    : parts[3] || "input";

  const requestsRef = useRef(requests),
    storageBlockedRef = useRef(storageBlocked),
    active = useRef<{ id: number; controller: AbortController } | null>(null),
    serial = useRef(0),
    creatingFromRoute = useRef(false);
  requestsRef.current = requests;
  storageBlockedRef.current = storageBlocked;
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (serverMode ? e.key === serverDraftKey : e.key === REQUEST_KEY || e.key === HISTORY_KEY) {
        storageBlockedRef.current = true;
        active.current?.controller.abort();
        active.current = null;
        setBusy("");
        setStorageBlocked(true);
        setSaved(false);
        setMessage(
          "다른 탭에서 자료가 변경되었습니다. 충돌을 피하려면 저장 자료를 다시 불러와주세요.",
        );
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!saved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saved]);
  useEffect(() => {
    active.current?.controller.abort();
    active.current = null;
    setBusy("");
    if (serverMode) setSaved(!localStorage.getItem(dirtyKey(id)));
    return () => {
      active.current?.controller.abort();
      active.current = null;
    };
  }, [id]);
  const commit = (next: WorkRequest) => {
    const previous = requestsRef.current.find(x => x.id === next.id);
    const items = [
      next,
      ...requestsRef.current.filter((x) => x.id !== next.id),
    ];
    requestsRef.current = items;
    setRequests(items);
    if (storageBlockedRef.current) {
      setSaved(false);
      return false;
    }
    try {
      if (serverMode) {
        if (previous && JSON.stringify(snapshotOf(previous)) !== JSON.stringify(snapshotOf(next))) localStorage.setItem(dirtyKey(next.id), "1");
        saveServerDraft(next);
      } else repository.saveRequest(next);
      setSaved(!serverMode || !localStorage.getItem(dirtyKey(next.id)));
      return true;
    } catch (e) {
      setSaved(false);
      setMessage(
        e instanceof Error
          ? e.message
          : "브라우저 저장 공간이 부족합니다. 입력을 유지했습니다. 저장을 재시도해주세요.",
      );
      return false;
    }
  };
  const edit = (patch: Partial<WorkRequest>) => {
    if (!r) return;
    active.current?.controller.abort();
    active.current = null;
    setBusy("");
    return commit(editRequest(r, patch));
  };
  const create = async (materials: Material[] = []) => {
    if (storageBlocked) {
      setMessage("저장 자료 충돌 또는 손상을 먼저 해결해주세요.");
      return;
    }
    if (
      !saved &&
      !window.confirm("미저장 변경사항이 있습니다. 새 요청으로 이동할까요?")
    )
      return;
    if (active.current || (serverMode && !serverLoaded)) return;
    const controller = new AbortController(), token = ++serial.current;
    active.current = { id: token, controller }; setBusy("create");
    try {
      const next = serverMode ? await createServerRequest(controller.signal) : blankRequest();
      if (controller.signal.aborted || active.current?.id !== token || !commit(next)) return;
      navigate(`/requests/${next.id}/input?view=legacy`, { state: {
        materials: materials.length ? materials : ["text"], initialMaterial: materials[0] || "text",
      } });
    } catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "요청 생성 실패"); }
    finally { if (active.current?.id === token) { active.current = null; setBusy(""); } }
  };
  useEffect(() => {
    if (location.pathname !== "/requests/new") {
      creatingFromRoute.current = false;
      return;
    }
    if ((!serverMode || serverLoaded) && !creatingFromRoute.current) {
      creatingFromRoute.current = true;
      create();
    }
  }, [location.pathname, serverLoaded]);
  useEffect(() => {
    if (r && ["agreement", "mock"].includes(parts[3]))
      navigate(
        `/requests/${r.id}/input?view=${parts[3] === "mock" ? "preview" : "requirements"}`,
        {
          replace: true,
          state: { focusMock: parts[3] === "agreement" },
        },
      );
  }, [location.pathname]);
  useEffect(() => {
    if (step === "input" && location.state?.focusMock) {
      const frame = requestAnimationFrame(() =>
        document
          .getElementById("system-mock")
          ?.scrollIntoView({ block: "start" }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [location.pathname, location.state]);
  const go = (target: string) =>
    r && navigate(`/requests/${r.id}/${target}`, { state: location.state });
  async function run(kind: "analysis" | "similarCaseAnalysis", confirmed?: WorkRequest) {
    if (!r || active.current || !saved || storageBlocked) return;
    const latest = confirmed || requestsRef.current.find((x) => x.id === r.id);
    if (!latest) return;
    if (kind === "similarCaseAnalysis" && isCurrent(latest, latest.similarCaseAnalysis) && latest.similarCaseAnalysis?.analysisId === latest.analysis?.id) {
      navigate(`/requests/${latest.id}/review`);
      return;
    }
    const snapshot = structuredClone(latest),
      controller = new AbortController(),
      token = ++serial.current;
    active.current = { id: token, controller };
    setBusy(kind);
    try {
      const result =
        kind === "analysis"
          ? await analyzeRequirements(
              analysisInput(
                snapshot,
                await sourcesForVersion(snapshot.legacyVersion),
              ),
              controller.signal,
            )
          : await analyzeSimilarCases(snapshot, controller.signal);
      const current = requestsRef.current.find((x) => x.id === snapshot.id);
      if (
        active.current?.id !== token ||
        !current ||
        !sameBasis(basisOf(current), result.basis)
      )
        return;
      commit({
        ...current,
        [kind]: result,
        ...(kind === "similarCaseAnalysis" || kind === "analysis"
          ? { scopeReviewed: false, estimateReviewed: false }
          : {}),
      });
      if (kind === "similarCaseAnalysis") navigate(`/requests/${snapshot.id}/review`);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setMessage(
          e instanceof Error
            ? e.message
            : "처리에 실패했습니다. 다시 시도해주세요.",
        );
    } finally {
      if (active.current?.id === token) {
        active.current = null;
        setBusy("");
      }
    }
  }
  const register = async () => {
    if (!r || busy || !saved || storageBlocked) return;
    try {
      setBusy("register");
      const result = serverMode ? await registerServerRequest(r, new AbortController().signal) : repository.register(r);
      setHistory(serverMode ? [result, ...history.filter(x => x.id !== result.id)] : repository.history());
      navigate(`/history/${result.id}`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "등록에 실패했습니다. 입력을 보존했습니다.",
      );
    } finally { setBusy(""); }
  };
  const reload = async () => {
    if (
      !saved &&
      !window.confirm("메모리의 변경사항 대신 저장 자료를 다시 불러올까요?")
    )
      return;
    if (serverMode) {
      try {
        const rows = await serverRequests(new AbortController().signal);
        rows.forEach(row => {
          localStorage.removeItem(dirtyKey(row.id));
          // Re-read server revisions before subsequent writes after an explicit reload.
          localStorage.removeItem(`soetmul.server-request:${apiBase}:${row.id}`);
        });
        localStorage.setItem(serverDraftKey, JSON.stringify(rows));
        requestsRef.current = rows; setRequests(rows); setHistory([]);
        storageBlockedRef.current = false; setStorageBlocked(false); setSaved(true); setServerLoaded(true);
        setMessage("서버 저장 자료를 다시 불러왔습니다.");
      } catch (e) { setMessage(e instanceof Error ? e.message : "서버 요청 조회 실패"); }
      return;
    }
    const data = load();
    if (data.error) {
      setMessage(data.error);
      return;
    }
    requestsRef.current = data.requests;
    setRequests(data.requests);
    setHistory(data.history);
    setStorageBlocked(false);
    setSaved(true);
  };
  const backup = () => {
    const data = {
      requests: requestsRef.current,
      stored: Object.fromEntries(
        [
          REQUEST_KEY,
          HISTORY_KEY,
          serverDraftKey,
          "vibelation.requests.v2",
          "vibelation.history.v2",
          "vibelation.request.v1",
          "vibelation.history.v1",
        ].map((k) => [k, localStorage.getItem(k)]),
      ),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "soetmul-recovery.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const confirmAndAnalyze = async (options: { skipPreview?: boolean } = {}) => {
    if (!r || !saved || storageBlocked || active.current) return;
    const controller = new AbortController();
    const token = ++serial.current;
    active.current = { id: token, controller };
    try {
      const latest = requestsRef.current.find((x) => x.id === r.id)!;
      const capturedRevision = latest.revision;
      const result = serverMode ? await confirmServerRequest(latest, controller.signal) : confirmRequirement(latest);
      const confirmed = options.skipPreview ? { ...result, previewSkipped: true } : result;
      if (controller.signal.aborted || active.current?.id !== token || requestsRef.current.find(x => x.id === r.id)?.revision !== capturedRevision) return;
      active.current = null;
      if (!commit(confirmed)) return;
      setBusy("");
      navigate(`/requests/${r.id}/analysis`, { state: location.state });
      void run("analysis", confirmed);
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessage(
        error instanceof Error
          ? error.message
          : "요구사항 확정에 실패했습니다.",
      );
      setBusy("");
    } finally {
      if (active.current?.id === token) { active.current = null; setBusy(""); }
    }
  };
  useEffect(() => {
    if (!serverMode) return;
    const controller = new AbortController();
    const revisions = new Map(requestsRef.current.map(row => [row.id, row.revision]));
    void serverRequests(controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      const local = requestsRef.current;
      const merged = rows.map(row => {
        const draft = local.find(x => x.id === row.id);
        return draft && (localStorage.getItem(dirtyKey(row.id)) || draft.revision !== revisions.get(row.id)) ? draft : row;
      });
      for (const draft of local) if (!merged.some(x => x.id === draft.id) && localStorage.getItem(dirtyKey(draft.id))) merged.push(draft);
      localStorage.setItem(serverDraftKey, JSON.stringify(merged));
      requestsRef.current = merged; setRequests(merged); setServerLoaded(true);
    }).catch(e => { if (!controller.signal.aborted) { setSaved(false); setMessage(e instanceof Error ? e.message : "서버 요청 조회 실패"); } });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!serverMode || !serverLoaded || !r || storageBlocked || !localStorage.getItem(dirtyKey(r.id)) || r.attachments.some(a => a.uploadStatus !== "uploaded")) return;
    const controller = new AbortController(), captured = r;
    const timer = setTimeout(() => {
      void syncRequest(captured, controller.signal).then(() => {
        if (!controller.signal.aborted && requestsRef.current.find(x => x.id === captured.id)?.revision === captured.revision) {
          localStorage.removeItem(dirtyKey(captured.id)); setSaved(true);
        }
      }).catch(e => { if (!controller.signal.aborted) { setSaved(false); setMessage(e instanceof Error ? e.message : "서버 입력 저장 실패"); } });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [r, serverLoaded, storageBlocked]);
  const retrySave = async () => {
    if (!r) return;
    if (!serverMode) { commit(r); return; }
    const captured = r;
    try {
      await syncRequest(captured, new AbortController().signal);
      if (requestsRef.current.find(x => x.id === captured.id)?.revision === captured.revision) {
        localStorage.removeItem(dirtyKey(captured.id)); setSaved(true); setMessage("서버 입력을 저장했습니다.");
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "서버 저장 재시도 실패"); }
  };
  const props: WorkspaceProps | undefined = r
    ? {
        r,
        edit,
        update: (change) => {
          const latest = requestsRef.current.find((x) => x.id === r.id);
          if (latest) commit(change(latest));
        },
        check: (patch) => {
          const latest = requestsRef.current.find((x) => x.id === r.id);
          if (latest) commit({ ...latest, ...patch });
        },
        run,
        confirmAndAnalyze,
        busy,
        go,
        register,
        saved: saved && !storageBlocked && serverLoaded,
      }
    : undefined;
  return {
    requests,
    history,
    message,
    setMessage,
    storageBlocked,
    serverLoaded,
    retrySave,
    saved,
    busy,
    location,
    navigate,
    r,
    id,
    step,
    isHistory,
    create,
    commit,
    reload,
    backup,
    props,
  };
}
