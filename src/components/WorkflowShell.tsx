import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Brand } from "../features/Landing";
import {
  appliedDocument,
  hasAppliedRequirement,
  hasConfirmedRequirement,
  isCurrent,
  type WorkRequest,
} from "../domain/types";

export function AppHeader({ requests }: { requests: WorkRequest[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const location = useLocation();
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [location.key]);
  return (
    <div className="workflow-header">
      <Brand />
      <details
        className="brand-navigation"
        ref={menu}
        onKeyDown={(e) => {
          if (e.key === "Escape" && menu.current) {
            menu.current.open = false;
            menu.current.querySelector("summary")?.focus();
          }
        }}
      >
        <summary>
          작업 메뉴 <span aria-hidden="true">⌄</span>
        </summary>
        <nav aria-label="작업 메뉴">
          <Link to="/">새 쇳물 시작</Link>
          <Link to="/requests">진행 중인 요청 · {requests.length}</Link>
          {requests.slice(0, 4).map((r) => (
            <Link key={r.id} to={`/requests/${r.id}/input`}>
              {r.title || "제목 없는 요청"}
            </Link>
          ))}
          <Link to="/team">팀 진행 현황</Link>
          <Link to="/history">과거 검토 이력</Link>
          <Link to="/settings/legacy">설정 · 레거시 틀 관리</Link>
        </nav>
      </details>
    </div>
  );
}

const screens = [
  ["legacy", "틀 고르기"],
  ["materials", "쇳물 녹이기"],
  ["requirements", "성분 보기"],
  ["preview", "미리 붓기"],
  ["analysis", "탕도 살피기"],
  ["review", "붓기 준비 완료"],
] as const;
export function inputView(r: WorkRequest, query: string) {
  const view = new URLSearchParams(query).get("view");
  if (["legacy", "materials", "requirements", "preview"].includes(view || ""))
    return view!;
  return r.requirements.length ? "requirements" : "materials";
}
export function WorkflowProgress({
  r,
  step,
}: {
  r: WorkRequest;
  step: string;
}) {
  const location = useLocation();
  const view = step === "input" ? inputView(r, location.search) : step;
  const completed = [
    !!r.legacyVersion,
    r.requirements.length > 0,
    hasAppliedRequirement(r),
    r.mocks.some(
      (m) =>
        m.requirementDocumentId === appliedDocument(r)?.id &&
        m.legacyVersion === r.legacyVersion,
    ),
    isCurrent(r, r.analysis),
    isCurrent(r, r.report),
  ];
  return (
    <nav className="workflow-progress" aria-label="쇳물 작업 진행">
      <ol>
        {screens.map(([key, label], index) => {
          const available =
            index < 2 ||
            (index === 2 && r.requirements.length > 0) ||
            (index === 3 && hasAppliedRequirement(r)) ||
            (index >= 4 &&
              hasConfirmedRequirement(r) &&
              (index === 4 || isCurrent(r, r.analysis)));
          const to =
            index < 4
              ? `/requests/${r.id}/input?view=${key}`
              : `/requests/${r.id}/${key}`;
          return (
            <li
              key={key}
              className={`${view === key ? "current" : ""} ${completed[index] ? "complete" : ""}`}
            >
              {available ? (
                <Link
                  to={to}
                  state={location.state}
                  aria-current={view === key ? "step" : undefined}
                >
                  <span>
                    {completed[index] && view !== key ? "✓" : index + 1}
                  </span>
                  {label}
                  {key === "preview" && <small>선택</small>}
                </Link>
              ) : (
                <span aria-disabled="true">
                  <span>{index + 1}</span>
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ScreenTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="workflow-title">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function RequestContext({
  r,
  edit,
}: {
  r: WorkRequest;
  edit: (patch: Partial<WorkRequest>) => void;
}) {
  return (
    <details className="request-context">
      <summary>
        <span>{r.title || "새 개선 요청"}</span>
        <span className="context-version">
          {r.legacyVersion.startsWith("zip:")
            ? "코드 ZIP 기준 선택됨"
            : r.legacyVersion}
        </span>
        <span>요청 정보 수정</span>
      </summary>
      <div className="request-fields">
        <label>
          요청 제목
          <input
            value={r.title}
            maxLength={160}
            onChange={(e) => edit({ title: e.target.value })}
            placeholder="요청 제목을 입력해주세요"
          />
        </label>
        <label>
          희망 완료일
          <input
            type="date"
            value={r.dueDate}
            onChange={(e) => edit({ dueDate: e.target.value })}
          />
        </label>
      </div>
    </details>
  );
}
