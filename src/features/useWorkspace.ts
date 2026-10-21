import { apiJson, jsonPost, serverMode } from "../services/api";
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
  generateReport,
  analysisInput,
  analyzeRequirements,
} from "../services/contract";
import { sourcesForVersion } from "../storage/legacySources";
import type { WorkspaceProps } from "./workspace";
import type { Material } from "./Landing";
function load() {
  try {
    return {
      requests: repository.requests(),
      history: repository.history(),
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
      if (e.key === REQUEST_KEY || e.key === HISTORY_KEY) {
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
    return () => {
      active.current?.controller.abort();
      active.current = null;
    };
  }, [id]);
  const commit = (next: WorkRequest) => {
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
      repository.saveRequest(next);
      setSaved(true);
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
    const next = blankRequest();
    try {
      if (serverMode) {
        const response = await apiJson("/requests", new AbortController().signal, jsonPost({ title: next.title, legacyReferenceId: next.legacyVersion }, crypto.randomUUID()));
        if (typeof response.id !== "string") throw new Error("서버 요청 ID를 확인할 수 없습니다.");
        next.id = response.id;
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "요청 생성 실패"); return; }
    if (!commit(next)) return;
    navigate(`/requests/${next.id}/input?view=legacy`, {
      state: {
        materials: materials.length ? materials : ["text"],
        initialMaterial: materials[0] || "text",
      },
    });
  };
  useEffect(() => {
    if (location.pathname !== "/requests/new") {
      creatingFromRoute.current = false;
      return;
    }
    if (!creatingFromRoute.current) {
      creatingFromRoute.current = true;
      create();
    }
  }, [location.pathname]);
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
  async function run(kind: "analysis" | "report", confirmed?: WorkRequest) {
    if (!r || active.current || !saved || storageBlocked) return;
    const latest = confirmed || requestsRef.current.find((x) => x.id === r.id);
    if (!latest) return;
    if (kind === "report" && isCurrent(latest, latest.report)) {
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
          : await generateReport(snapshot, controller.signal);
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
        ...(kind === "report" || kind === "analysis"
          ? { scopeReviewed: false, estimateReviewed: false }
          : {}),
      });
      if (kind === "report") navigate(`/requests/${snapshot.id}/review`);
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
      let registrationId: string | undefined;
      if (serverMode) {
        setBusy("register");
        const key = `register:${r.id}:${r.activeConfirmationId}:${r.analysis?.id}:${r.report?.id}`;
        const result = await apiJson("/review-registrations", new AbortController().signal, jsonPost({ requestId: r.id, confirmationId: r.activeConfirmationId, analysisResultId: r.analysis?.id, reportId: r.report?.id }, key));
        if (typeof result.id !== "string") throw new Error("등록 결과 ID를 확인할 수 없습니다.");
        registrationId = result.id;
      }
      const result = repository.register(r, registrationId);
      setHistory(repository.history());
      navigate(`/history/${result.id}`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "등록에 실패했습니다. 입력을 보존했습니다.",
      );
    } finally { setBusy(""); }
  };
  const reload = () => {
    if (
      !saved &&
      !window.confirm("메모리의 변경사항 대신 저장 자료를 다시 불러올까요?")
    )
      return;
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
      const confirmed = options.skipPreview
        ? { ...confirmRequirement(latest), previewSkipped: true }
        : confirmRequirement(latest);
      if (serverMode) {
        setBusy("confirm");
        const signal = controller.signal;
        const path = `/requests/${encodeURIComponent(r.id)}`;
        const current = await apiJson(path, signal);
        const c = confirmed.confirmations.find(c => c.id === confirmed.activeConfirmationId)!;
        const remote = await apiJson(`${path}/requirement-confirmations`, signal, jsonPost({ requirementDocumentId: c.documentSnapshot.id, expectedInputRevision: current.inputRevision, expectedRequestRevision: current.requestRevision }, `confirm:${r.id}:${c.draftFingerprint}`));
        if (typeof remote.id !== "string") throw new Error("서버 확정 ID를 확인할 수 없습니다.");
        if ((remote.requestId && remote.requestId !== r.id) || (remote.documentSnapshot && (remote.documentSnapshot.id !== c.documentSnapshot.id || remote.documentSnapshot.markdown !== c.documentSnapshot.markdown))) throw new Error("서버 확정의 요구사항 기준이 다릅니다.");
        confirmed.activeConfirmationId = remote.id;
        confirmed.confirmations = [{ ...c, ...remote, inputRevision: confirmed.inputRevision, documentSnapshot: { ...c.documentSnapshot, ...remote.documentSnapshot, inputSnapshot: remote.documentSnapshot?.inputSnapshot || c.documentSnapshot.inputSnapshot }, draftFingerprint: c.draftFingerprint }, ...confirmed.confirmations.filter(x => x.id !== c.id)];
      }
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
        saved: saved && !storageBlocked,
      }
    : undefined;
  return {
    requests,
    history,
    message,
    setMessage,
    storageBlocked,
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
