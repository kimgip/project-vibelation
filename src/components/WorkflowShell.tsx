import { useEffect, useState } from "react";
import {
  MIN_DUE_DATE,
  MAX_DUE_DATE,
  validDueDate,
} from "../domain/requestDetails";
import { Link, useLocation } from "react-router-dom";
import { BrandNavigation } from "../features/Landing";
import {
  appliedDocument,
  hasAppliedRequirement,
  hasConfirmedRequirement,
  isCurrent,
  requestTitle,
  type WorkRequest,
} from "../domain/types";

export function AppHeader({
  requests,
  start,
}: {
  requests: WorkRequest[];
  start: () => void;
}) {
  return (
    <div className="workflow-header">
      <BrandNavigation requests={requests} start={start} />
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
  const previewDone = r.mocks.some(
    (m) =>
      m.requirementDocumentId === appliedDocument(r)?.id &&
      m.legacyVersion === r.legacyVersion,
  );
  const completed = [
    !!r.legacyVersion,
    r.requirements.length > 0,
    hasAppliedRequirement(r),
    previewDone,
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
          const skipped =
            key === "preview" &&
            !!r.previewSkipped &&
            !previewDone &&
            view !== key;
          return (
            <li
              key={key}
              className={`${view === key ? "current" : ""} ${completed[index] ? "complete" : ""} ${skipped ? "skipped" : ""}`}
            >
              {available ? (
                <Link
                  to={to}
                  state={location.state}
                  aria-current={view === key ? "step" : undefined}
                >
                  <span>
                    {skipped
                      ? "–"
                      : completed[index] && view !== key
                        ? "✓"
                        : index + 1}
                  </span>
                  {label}
                  {key === "preview" && (
                    <small>{skipped ? "건너뜀" : "선택"}</small>
                  )}
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

export interface StepAction {
  label: string;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  /** Tooltip shown on hover. */
  title?: string;
  type?: "button" | "submit";
  form?: string;
  name?: string;
}
function StepButton({
  action,
  kind,
}: {
  action: StepAction;
  kind: "primary" | "secondary" | "text";
}) {
  const className = `step-button step-button-${kind}`;
  if (action.to && !action.disabled)
    return (
      <Link className={className} to={action.to} title={action.title}>
        {action.label}
      </Link>
    );
  return (
    <button
      className={className}
      type={action.type || "button"}
      form={action.form}
      name={action.name}
      disabled={action.disabled}
      title={action.title}
      onClick={action.onClick}
    >
      {action.label}
    </button>
  );
}
/** Shared bottom bar for every step: [back, backText] … [nextText, reason, next]. */
export function StepFooter({
  back,
  backText,
  nextText,
  next,
  reason,
}: {
  back?: StepAction;
  backText?: StepAction;
  nextText?: StepAction;
  next?: StepAction;
  /** Shown before the primary button while it is disabled. */
  reason?: string;
}) {
  return (
    <div className="step-footer">
      <div className="step-footer-group">
        {back && <StepButton action={back} kind="secondary" />}
        {backText && <StepButton action={backText} kind="text" />}
      </div>
      <div className="step-footer-group">
        {nextText && <StepButton action={nextText} kind="text" />}
        {next?.disabled && reason && (
          <span className="step-footer-reason">{reason}</span>
        )}
        {next && <StepButton action={next} kind="primary" />}
      </div>
    </div>
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
  initiallyOpen = false,
  onContinue,
}: {
  r: WorkRequest;
  edit: (patch: Partial<WorkRequest>) => void | boolean;
  initiallyOpen?: boolean;
  onContinue?: () => void;
}) {
  const [title, setTitle] = useState(r.title);
  const [dueDate, setDueDate] = useState(r.dueDate);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(initiallyOpen);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setTitle(r.title);
    setDueDate(r.dueDate);
    setError("");
  }, [r.id, r.title, r.dueDate]);
  const dirty = title !== r.title || dueDate !== r.dueDate;
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return (
    <details
      className="request-context"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <span>{requestTitle(r)}</span>
        <span className="context-version">
          {r.legacyVersion.startsWith("zip:")
            ? "코드 ZIP 기준 선택됨"
            : r.legacyVersion}
        </span>
        <span>요청 정보 수정</span>
      </summary>
      <form
        id={`request-details-${r.id}`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setNotice("");
          const dateInput = e.currentTarget.elements.namedItem(
            "dueDate",
          ) as HTMLInputElement;
          if (dateInput.validity.badInput || !validDueDate(dueDate)) {
            setError("희망 완료일은 0001~9999년의 유효한 날짜로 입력해주세요.");
            dateInput.focus();
            return;
          }
          if (dirty && edit({ title: title.trim(), dueDate }) === false) return;
          setError("");
          setNotice("요청 정보를 저장했습니다.");
          const submitter = (e.nativeEvent as SubmitEvent)
            .submitter as HTMLButtonElement | null;
          if (submitter?.name === "continue") onContinue?.();
        }}
      >
        <div className="request-fields">
          <label>
            요청 제목
            <input
              value={title}
              maxLength={160}
              onChange={(e) => {
                setTitle(e.target.value);
                setNotice("");
              }}
              placeholder="요청 제목을 입력해주세요"
            />
          </label>
          <label>
            <span>
              희망 완료일 <small>(선택)</small>
            </span>
            <input
              type="date"
              name="dueDate"
              min={MIN_DUE_DATE}
              max={MAX_DUE_DATE}
              value={dueDate}
              onChange={(e) => {
                setNotice("");
                if (/^\d{5,}-/.test(e.target.value)) {
                  setError("연도는 4자리까지만 입력할 수 있습니다.");
                  return;
                }
                setDueDate(e.target.value);
                setError("");
              }}
            />
          </label>
        </div>
        <div className="request-details-actions">
          <small>
            {dirty ? "입력 중 · 아직 저장되지 않았습니다." : notice}
          </small>
          <button
            type="button"
            onClick={() => {
              setTitle(r.title);
              setDueDate(r.dueDate);
              setError("");
              setNotice("");
            }}
          >
            취소
          </button>
          <button type="submit">요청 정보 저장</button>
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
