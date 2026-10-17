import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Layers3,
  Plus,
  History,
  Users,
  ChevronRight,
  CircleHelp,
  Sparkles,
  ArrowLeft,
  FileText,
  Download,
} from "lucide-react";
import {
  blankRequest,
  editRequest,
  basisOf,
  sameBasis,
  isCurrent,
  hasConfirmedRequirement,
  activeConfirmation,
  appliedDocument,
  statusOf,
  type WorkRequest,
  type Registration,
} from "./domain/types";
import { repository, REQUEST_KEY, HISTORY_KEY } from "./storage/repositories";
import { mockService } from "./services/contract";
import {
  InputPage,
  AnalysisPage,
  ReviewPage,
  type WorkspaceProps,
} from "./features/workspace";
import { HistoryPage, TeamPage } from "./features/history";
import { Empty, Tag } from "./components/shared";
import "./style.css";
const steps = [
  ["input", "자료 입력·확정", "자료와 화면으로 함께 협의"],
  ["analysis", "레거시 분석", "변경 범위와 근거 탐색"],
  ["review", "최종 검토", "결론을 다음 경험으로"],
];
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
function App() {
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
  const isHistory = parts[1] === "history",
    isTeam = parts[1] === "team";
  const id = parts[2];
  const r = requests.find((x) => x.id === id);
  const step = ["mock", "agreement"].includes(parts[3])
    ? "input"
    : parts[3] || "input";
  const index = steps.findIndex((s) => s[0] === step);
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
  useEffect(() => () => active.current?.controller.abort(), []);
  const commit = (next: WorkRequest) => {
    const items = [
      next,
      ...requestsRef.current.filter((x) => x.id !== next.id),
    ];
    requestsRef.current = items;
    setRequests(items);
    if (storageBlockedRef.current) {
      setSaved(false);
      return;
    }
    try {
      repository.saveRequest(next);
      setSaved(true);
    } catch (e) {
      setSaved(false);
      setMessage(
        e instanceof Error
          ? e.message
          : "브라우저 저장 공간이 부족합니다. 입력을 유지했습니다. 저장을 재시도해주세요.",
      );
    }
  };
  const edit = (patch: Partial<WorkRequest>) => {
    if (!r) return;
    active.current?.controller.abort();
    active.current = null;
    setBusy("");
    commit(editRequest(r, patch));
  };
  const create = () => {
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
    commit(next);
    navigate(`/requests/${next.id}/input`);
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
      navigate(`/requests/${r.id}/input`, {
        replace: true,
        state: { focusMock: parts[3] === "agreement" },
      });
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
  const go = (target: string) => r && navigate(`/requests/${r.id}/${target}`);
  async function run(kind: "analysis" | "report") {
    if (!r || active.current) return;
    const snapshot = structuredClone(r),
      controller = new AbortController(),
      token = ++serial.current;
    active.current = { id: token, controller };
    setBusy(kind);
    setMessage("");
    try {
      const result =
        kind === "analysis"
          ? await mockService.analyze(snapshot, controller.signal)
          : await mockService[kind](snapshot, controller.signal);
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
      setMessage(
        "현재 버전의 시연용 결과를 준비했습니다. 실제 AI 분석은 연결하지 않았습니다.",
      );
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
  const register = () => {
    if (!r || busy || !saved || storageBlocked) return;
    try {
      const result = repository.register(r);
      setHistory(repository.history());
      setMessage("현재 버전의 검토 리포트를 로컬 이력에 등록했습니다.");
      navigate(`/history/${result.id}`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "등록에 실패했습니다. 입력을 보존했습니다.",
      );
    }
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
    setMessage("저장 자료를 다시 불러왔습니다.");
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
    a.download = "vibelation-recovery.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        busy,
        go,
        register,
        saved: saved && !storageBlocked,
      }
    : undefined;
  return (
    <div className="app">
      <aside>
        <Link className="brand" to="/requests">
          <Layers3 size={28} />
          <div>
            VIBELATION<small>상상을 현실로, 경험을 울림으로</small>
          </div>
        </Link>
        <div className="team-switch">
          <span className="avatar">V</span>
          <div>
            팀 워크스페이스<small>운영 · 개발 협업 공간</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        {[
          ["/requests", "요청 작업실", Layers3],
          ["/history", "과거 검토 이력", History],
          ["/team", "팀 진행 현황", Users],
        ].map(([path, label, Icon]) => {
          const I = Icon as typeof Layers3;
          return (
            <Link
              key={String(path)}
              title={String(label)}
              aria-label={String(label)}
              aria-current={
                location.pathname.startsWith(String(path)) ? "page" : undefined
              }
              className={`nav-item ${location.pathname.startsWith(String(path)) ? "active" : ""}`}
              to={String(path)}
            >
              <I size={18} />
              <span>{String(label)}</span>
            </Link>
          );
        })}
        <div className="aside-project">
          <small>분석 대상 프로젝트</small>
          <b>다운로드 센터</b>
          <span>DEMO-2026.10 · 샘플 참조</span>
        </div>
        <div className="aside-bottom">
          <div className="help-box">
            <CircleHelp size={18} />
            <b>같이 보고, 근거로 판단해요.</b>
            <p>
              이번의 검토가 다음 업무의
              <br />
              좋은 시작이 됩니다.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">김</span>
            <div>
              운영 담당자<small>로컬 시연 워크스페이스</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="body">
        <header>
          <span>
            워크스페이스 <ChevronRight size={12} />{" "}
            <b>
              {isHistory
                ? "과거 검토 이력"
                : isTeam
                  ? "팀 진행 현황"
                  : "요청 작업실"}
            </b>
          </span>
          <span className="demo-label">
            LOCAL MOCK <span className="avatar">김</span>
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">FROM IDEAS TO IMPACT</span>
              <h1>
                {isHistory
                  ? "과거 검토 이력"
                  : isTeam
                    ? "팀 진행 현황"
                    : "요청 작업실"}
              </h1>
              <p>
                {isHistory
                  ? "함께 검토한 근거와 결론이, 다음 요청의 시작이 됩니다."
                  : isTeam
                    ? "함께하는 업무의 흐름과 놓치기 쉬운 일정을 한눈에 확인하세요."
                    : "흩어진 요구사항을 모으고, 우리 시스템에 맞는 변화로 연결합니다."}
              </p>
            </div>
            <button className="primary" onClick={create}>
              <Plus size={16} />새 개선 요청
            </button>
          </div>
          {message && (
            <div className="toast" role="status">
              <Sparkles size={16} />
              <span>{message}</span>
              <button aria-label="알림 닫기" onClick={() => setMessage("")}>
                ×
              </button>
            </div>
          )}
          {(!saved || storageBlocked) && (
            <div className="stale-warning" role="alert">
              <span>
                {storageBlocked
                  ? "저장 충돌·손상 확인 필요"
                  : "변경사항 미저장 · 입력은 메모리에 유지됩니다."}
              </span>
              {!storageBlocked && r && (
                <button onClick={() => commit(r)}>저장 재시도</button>
              )}
              <button onClick={reload}>저장 자료 다시 불러오기</button>
              <button onClick={backup}>
                <Download size={13} />
                복구용 내보내기
              </button>
            </div>
          )}
          {isHistory ? (
            <HistoryPage items={history} id={id} />
          ) : isTeam ? (
            <TeamPage />
          ) : r && props ? (
            <>
              <div className="request-banner">
                <div className="request-meta">
                  <Tag>{statusOf(r)}</Tag>
                  <span>
                    입력 v{r.inputRevision} · 검토 v{r.revision}
                  </span>
                  <span>{r.legacyVersion}</span>
                  {activeConfirmation(r) && (
                    <span>
                      확정 v{activeConfirmation(r)!.version}
                      {hasConfirmedRequirement(r)
                        ? ""
                        : " · 변경 후 재확정 필요"}
                    </span>
                  )}
                  {appliedDocument(r) && (
                    <span>
                      적용 MD 생성 {appliedDocument(r)!.generationNumber} · 입력
                      v{appliedDocument(r)!.inputRevision}
                    </span>
                  )}
                </div>
                <label className="title-label">
                  요청 제목
                  <input
                    className="title-input"
                    value={r.title}
                    maxLength={160}
                    placeholder="새 개선 요청의 제목을 입력해주세요"
                    onChange={(e) => edit({ title: e.target.value })}
                  />
                </label>
                <div className="banner-bottom">
                  <label>
                    희망 완료일{" "}
                    <input
                      aria-label="희망 완료일"
                      type="date"
                      value={r.dueDate}
                      onChange={(e) => edit({ dueDate: e.target.value })}
                    />
                  </label>
                  <small aria-live="polite">
                    {saved ? "브라우저에 자동 저장" : "미저장 변경사항 있음"}
                  </small>
                </div>
              </div>
              <nav className="stepper" aria-label="요구사항 검토 단계">
                {steps.map(([key, label, desc], i) => (
                  <Link
                    key={key}
                    to={`/requests/${r.id}/${key}`}
                    aria-current={step === key ? "step" : undefined}
                    className={`step ${step === key ? "active" : ""}`}
                  >
                    <span className="step-number">{i + 1}</span>
                    <span>
                      <b>{label}</b>
                      <small>{desc}</small>
                    </span>
                    {i < 2 && <ChevronRight size={14} />}
                  </Link>
                ))}
              </nav>
              {[r.analysis, r.report].some((a) => a && !isCurrent(r, a)) && (
                <div className="stale-warning">
                  입력 또는 적용 문서가 변경되었습니다. 요구사항 확정 → 레거시
                  분석 → 리포트를 현재 확정 기준으로 갱신해주세요.
                </div>
              )}
              {step === "input" ? (
                <InputPage {...props} />
              ) : step === "analysis" ? (
                <AnalysisPage {...props} />
              ) : step === "review" ? (
                <ReviewPage {...props} />
              ) : (
                <Empty>해당 단계를 찾을 수 없습니다.</Empty>
              )}
              <div className="workflow-footer">
                <small>협의 중 언제든 이전 단계로 돌아갈 수 있어요</small>
                <div>
                  {index > 0 && (
                    <button onClick={() => go(steps[index - 1][0])}>
                      <ArrowLeft size={14} />
                      이전 단계
                    </button>
                  )}
                  {index >= 0 && index < 2 && (
                    <button
                      className="primary"
                      disabled={index === 0 && !hasConfirmedRequirement(r)}
                      onClick={() => go(steps[index + 1][0])}
                    >
                      다음 단계
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : id && id !== "new" ? (
            <Empty>
              해당 요청을 찾을 수 없습니다. 요청 작업실 목록에서 다시
              선택해주세요.
            </Empty>
          ) : (
            <>
              <div className="archive-banner">
                <div>
                  <span className="section-kicker">REQUEST WORKSPACE</span>
                  <h2>아이디어에서, 함께 정한 방향으로.</h2>
                  <p>
                    같은 화면을 보고, 변경의 근거를 확인하고, 경험을 남깁니다.
                  </p>
                </div>
                <div className="archive-count">
                  <b>{requests.length}</b>
                  <span>검토 중인 요청</span>
                </div>
              </div>
              <div className="section-caption">
                <h2>최근 작업</h2>
                <small>브라우저에 저장된 요청</small>
              </div>
              {requests.length ? (
                <div className="report-list">
                  {requests.map((x) => (
                    <Link
                      className="report-row"
                      key={x.id}
                      to={`/requests/${x.id}/input`}
                    >
                      <span className="report-icon">
                        <FileText size={24} />
                      </span>
                      <div>
                        <Tag>{statusOf(x)}</Tag>
                        <h3>{x.title || "제목 없는 요청"}</h3>
                        <p>
                          {x.text.slice(0, 100) || "원본 자료를 입력해주세요."}
                        </p>
                        <small>
                          요구사항 v{x.revision} · {x.legacyVersion}
                        </small>
                      </div>
                      <ChevronRight size={18} />
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty>새 개선 요청을 만들고 샘플을 불러와 시작해보세요.</Empty>
              )}
            </>
          )}
          <footer>
            <b>VIBELATION</b>
            <span>상상을 현실로, 경험을 울림으로</span>
            <span>로컬 Mock · 실제 AI 분석 및 외부 시스템 연동 전</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
