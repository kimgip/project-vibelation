import { Link } from "react-router-dom";
import { Plus, FileText, ChevronRight } from "lucide-react";
import { useWorkspace } from "./features/useWorkspace";
import { Landing } from "./features/Landing";
import { InputPage, AnalysisPage, ReviewPage } from "./features/workspace";
import { HistoryPage } from "./features/history";
import { LegacySettings } from "./features/LegacySettings";
import {
  AppHeader,
  WorkflowProgress,
  ScreenTitle,
} from "./components/WorkflowShell";
import { Empty, Tag } from "./components/shared";
import { requestTitle, statusOf } from "./domain/types";

export function App() {
  const w = useWorkspace();
  const landing = w.location.pathname === "/";
  return (
    <div className="workflow-app">
      {!landing && <AppHeader requests={w.requests} start={() => w.create()} />}
      {w.busy && <div className="agent-progress" role="status" aria-live="polite"><strong>{w.busy === "analysis" ? "코드 영향도를 분석하고 있어요" : w.busy === "similarCaseAnalysis" ? "유사사례를 분석하고 있어요" : w.busy === "confirm" ? "요구사항을 확정하고 있어요" : "응답을 기다리고 있어요"}</strong><progress aria-label="에이전트 응답 대기" /><span>처리가 완료되면 결과를 보여드립니다.</span></div>}
      <main aria-busy={!!w.busy} className={landing ? "landing-main" : "workflow-main"}>
        {w.message && (
          <div className="workflow-notice" role="status">
            <span>{w.message}</span>
            <button aria-label="알림 닫기" onClick={() => w.setMessage("")}>
              ×
            </button>
          </div>
        )}
        {landing ? (
          <Landing start={w.create} requests={w.requests} />
        ) : w.location.pathname.startsWith("/settings/legacy") ? (
          <LegacySettings />
        ) : w.isHistory ? (
          <HistoryPage items={w.history} id={w.id} />
        ) : w.r && w.props ? (
          <>
            <WorkflowProgress r={w.r} step={w.step} />
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
                      <h3>{requestTitle(r)}</h3>
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
      </main>
    </div>
  );
}
