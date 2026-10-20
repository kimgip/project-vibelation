import { backendApi, apiBase } from "../services/backendApi";
import { createServerRequest, serverRequests, confirmServerRequest, serverReport, registerServerRequest, syncRequest, serverState } from "../services/serverWorkspace";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  blankRequest,
  editRequest,
  basisOf,
  sameBasis,
  confirmRequirement,
  type WorkRequest,
  type Registration,
} from "../domain/types";
import { repository, REQUEST_KEY, HISTORY_KEY } from "../storage/repositories";
import {
  mockService,
  analysisInput,
  analyzeRequirements,
} from "../services/contract";
import { sourcesForVersion } from "../storage/legacySources";
import type { WorkspaceProps } from "./workspace";
import type { Material } from "./Landing";
const dirtyKey=(id:string)=>`soetmul.server-dirty:${apiBase}:${id}`;
function load() {
  try {
    return {
      requests: repository.requests(),
      history: backendApi ? [] : repository.history(),
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
  const [serverLoaded,setServerLoaded]=useState(!backendApi);
  const location = useLocation(),
    navigate = useNavigate();
  const parts = location.pathname.split("/");
  const isHistory = parts[1] === "history",
    isTeam = parts[1] === "team";
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
      setSaved(backendApi ? !localStorage.getItem(dirtyKey(next.id)) : true);
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
    if(backendApi)localStorage.setItem(dirtyKey(r.id),"1");
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
    if(active.current) return;
    const controller=new AbortController(),token=++serial.current;
    active.current={id:token,controller};setBusy("create");
    try {
    const next = backendApi ? await createServerRequest(controller.signal) : blankRequest();
    commit(next);
    navigate(`/requests/${next.id}/input?view=legacy`, {
      state: {
        materials: materials.length ? materials : ["text"],
        initialMaterial: materials[0] || "text",
      },
    });
    } catch(e) {setMessage(e instanceof Error ? e.message : "요청 생성 실패");}
    finally {if(active.current?.id===token){active.current=null;setBusy("");}}
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
          : backendApi ? await serverReport(snapshot, controller.signal) : await mockService[kind](snapshot, controller.signal);
      const current = requestsRef.current.find((x) => x.id === snapshot.id);
      if (
        active.current?.id !== token ||
        !current ||
        current.revision !== snapshot.revision ||
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
    setBusy("register");
    try {
      if(backendApi) await syncRequest(r,new AbortController().signal);
      const result = backendApi ? await registerServerRequest(r,new AbortController().signal) : repository.register(r);
      setHistory(backendApi ? [result,...history.filter(x=>x.id!==result.id)] : repository.history());
      navigate(`/history/${result.id}`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "등록에 실패했습니다. 입력을 보존했습니다.",
      );
    }
    finally {setBusy("");}
  };
  const retrySave=async()=>{
    if(!r)return;
    if(!backendApi){commit(r);return;}
    try{await syncRequest(r,new AbortController().signal);localStorage.removeItem(dirtyKey(r.id));setSaved(true);setMessage("서버 입력을 저장했습니다.");}
    catch(e){setSaved(false);setMessage(e instanceof Error?e.message:"서버 저장 실패");}
  };
  const reload = async () => {
    if(backendApi && !saved && !window.confirm("미저장 입력을 서버에 저장된 내용으로 바꿀까요? 필요하면 먼저 복구용 내보내기를 해주세요."))return;
    if(backendApi){
      try {const rows=await serverRequests(new AbortController().signal);requestsRef.current=rows;setRequests(rows);rows.forEach(row=>localStorage.removeItem(dirtyKey(row.id)));setStorageBlocked(false);setSaved(true);setServerLoaded(true);setMessage("서버 요청을 다시 불러왔습니다.");}
      catch(e){setMessage(e instanceof Error ? e.message : "서버 조회 실패");}return;
    }
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
    try {
      const latest = requestsRef.current.find((x) => x.id === r.id)!;
      setBusy("confirm");
      const result = backendApi ? await confirmServerRequest(latest,new AbortController().signal) : confirmRequirement(latest);
      const confirmed=options.skipPreview ? {...result,previewSkipped:true} : result;
      const current=requestsRef.current.find(x=>x.id===latest.id);
      if(!current || current.revision!==latest.revision)throw new Error("확정 중 입력이 변경되었습니다. 다시 확인해주세요.");
      if (!commit(confirmed)) return;
      navigate(`/requests/${r.id}/analysis`, { state: location.state });
      void run("analysis", confirmed);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "요구사항 확정에 실패했습니다.",
      );
    }
    finally {setBusy(current=>current==="confirm"?"":current);}
  };
  useEffect(()=>{
    if(!backendApi) return;
    const controller=new AbortController();
    const revisions=new Map(requestsRef.current.map(item=>{try{return [item.id,serverState(item.id).row.requestRevision] as const;}catch{return [item.id,undefined] as const;}}));
    void serverRequests(controller.signal).then(rows=>{
      if(controller.signal.aborted)return;
      let conflict=false;
      const merged=rows.map(row=>{
        const local=requestsRef.current.find(x=>x.id===row.id);
        if(local && localStorage.getItem(dirtyKey(row.id))){
          if(revisions.get(row.id)!==serverState(row.id).row.requestRevision)conflict=true;
          return local;
        }
        return row;
      });
      requestsRef.current=merged;setRequests(merged);setServerLoaded(true);
      if(conflict){storageBlockedRef.current=true;setStorageBlocked(true);setSaved(false);setMessage("서버 변경과 이 브라우저의 미저장 입력이 충돌합니다. 입력을 백업하고 서버 자료를 다시 불러와주세요.");}
    }).catch(e=>{if(!controller.signal.aborted)setMessage(e instanceof Error?e.message:"서버 요청 조회 실패");});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(!backendApi || !serverLoaded || !r || storageBlocked || !localStorage.getItem(dirtyKey(r.id)) || r.attachments.some(a=>a.uploadStatus!=="uploaded"))return;
    const snapshot=structuredClone(r);
    setSaved(false);
    const timer=setTimeout(()=>{
      // syncRequest serializes revision-sensitive writes with generation and confirmation.
      void syncRequest(snapshot,new AbortController().signal).then(()=>{
        const current=requestsRef.current.find(x=>x.id===snapshot.id);
        if(current?.inputRevision===snapshot.inputRevision && current.legacyVersion===snapshot.legacyVersion){localStorage.removeItem(dirtyKey(snapshot.id));setSaved(true);}
      }).catch(e=>{
        setMessage(e instanceof Error?e.message:"서버 입력 저장 실패");
      });
    },600);
    return ()=>clearTimeout(timer);
  },[r?.id,r?.inputRevision,r?.legacyVersion,r?.attachments,storageBlocked,serverLoaded]);
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
    isTeam,
    create,
    commit,
    reload,
    retrySave,
    backup,
    props,
  };
}
