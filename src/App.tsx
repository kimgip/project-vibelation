import { Link } from "react-router-dom";
import { Plus, FileText, ChevronRight } from "lucide-react";
import { useWorkspace } from "./features/useWorkspace";
import { Landing } from "./features/Landing";
import { InputPage, AnalysisPage, ReviewPage } from "./features/workspace";
import { HistoryPage, TeamPage } from "./features/history";
import { LegacySettings } from "./features/LegacySettings";
import {
  AppHeader,
  WorkflowProgress,
  ScreenTitle,
} from "./components/WorkflowShell";
import { Empty, Tag } from "./components/shared";
import { isCurrent, statusOf } from "./domain/types";

export function App() {
  const w = useWorkspace();
  const landing = w.location.pathname === "/";
  return (
    <div className="workflow-app">
      {!landing && <AppHeader requests={w.requests} />}
      <main className={landing ? "landing-main" : "workflow-main"}>
        {w.message && (
          <div className="workflow-notice" role="status">
            <span>{w.message}</span>
            <button aria-label="알림 닫기" onClick={() => w.setMessage("")}>
              ×
            </button>
          </div>
        )}
        {(!w.saved || w.storageBlocked) && (
          <div className="stale-warning" role="alert">
            <span>
              {w.storageBlocked
                ? "저장 충돌·손상 확인 필요"
                : "변경사항 미저장"}
            </span>
            {!w.storageBlocked && w.r && (
              <button onClick={() => w.commit(w.r!)}>저장 재시도</button>
            )}
            <button onClick={w.reload}>저장 자료 다시 불러오기</button>
            <button onClick={w.backup}>복구용 내보내기</button>
          </div>
        )}
        {landing ? (
          <Landing start={w.create} count={w.requests.length} />
        ) : w.location.pathname.startsWith("/settings/legacy") ? (
          <LegacySettings />
        ) : w.isHistory ? (
          <HistoryPage items={w.history} id={w.id} />
        ) : w.isTeam ? (
          <TeamPage />
        ) : w.r && w.props ? (
          <>
            <WorkflowProgress r={w.r} step={w.step} />
            {[w.r.analysis, w.r.report].some(
              (a) => a && !isCurrent(w.r!, a),
            ) && (
              <div className="stale-warning">
                입력 또는 선택 기준이 변경됐습니다. 요구사항을 재확정하고
                분석·리포트를 갱신해주세요.
              </div>
            )}
            {w.step === "input" ? (
              <InputPage key={w.r.id} {...w.props} />
            ) : w.step === "analysis" ? (
              <AnalysisPage key={w.r.id} {...w.props} />
            ) : w.step === "review" ? (
              <ReviewPage key={w.r.id} {...w.props} />
            ) : (
              <Empty>해당 화면을 찾을 수 없습니다.</Empty>
            )}
          </>
        ) : w.id && w.id !== "new" ? (
          <Empty>
            해당 요청을 찾을 수 없습니다.{" "}
            <Link to="/requests">요청 목록으로 돌아가기</Link>
          </Empty>
        ) : (
          <>
            <div className="workspace-heading">
              <ScreenTitle
                title="진행 중인 쇳물"
                description="현업의 요청을 이어서 검토하고, 다음 변화로 연결합니다."
              />
              <button className="primary" onClick={() => w.create()}>
                <Plus size={16} />새 쇳물 시작
              </button>
            </div>
            {w.requests.length ? (
              <div className="report-list">
                {w.requests.map((r) => (
                  <Link
                    className="report-row"
                    key={r.id}
                    to={`/requests/${r.id}/input`}
                  >
                    <FileText size={24} />
                    <div>
                      <Tag>{statusOf(r)}</Tag>
                      <h3>{r.title || "제목 없는 요청"}</h3>
                      <p>
                        {r.text.slice(0, 100) || "원본 자료를 입력해주세요."}
                      </p>
                    </div>
                    <ChevronRight size={18} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>새 쇳물을 시작하고 현업의 자료를 넣어주세요.</Empty>
            )}
          </>
        )}
        {!landing && (
          <footer className="workflow-page-footer">
            <b>쇳물</b>
            <span>요구사항을 녹여, 기존 틀에 붓다</span>
            <small>서버 미설정 기능은 로컬 시연으로 동작합니다.</small>
          </footer>
        )}
      </main>
    </div>
  );
}
