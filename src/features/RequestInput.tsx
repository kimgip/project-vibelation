import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  applyRequirement,
  appliedDocument,
  hasAppliedRequirement,
  canGenerate,
  canConfirmRequirement,
  uploadsReady,
  restoreSelection,
  selectionOf,
  type RequirementSelection,
} from "../domain/types";
import { requirementsService } from "../services/requirements";
import { generationBase } from "../services/generationTransport";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { Empty, Tag } from "../components/shared";
import {
  inputView,
  RequestContext,
  ScreenTitle,
  StepFooter,
} from "../components/WorkflowShell";
import { downloadMarkdown, dotDate } from "../utils/downloads";
import { useRequirements } from "./useRequirements";
import { MaterialCards } from "./MaterialCards";
import { DocumentSources } from "./DocumentSources";
import { LegacyPicker } from "./LegacyPicker";
import { SystemMockPanel } from "./SystemMockPanel";
// 미리 붓기의 "협의 및 요구사항 확정" 패널은 잠시 숨김 처리. 다시 쓰려면 아래 import와 JSX 주석을 함께 해제하세요.
// import { RequirementConfirmationPanel } from "./RequirementConfirmationPanel";
import type { WorkspaceProps } from "./workspace";
import type { Material } from "./Landing";
export function InputPage(props: WorkspaceProps) {
  const { r, edit, update, go, saved } = props;
  const location = useLocation();
  const view = inputView(r, location.search);
  const actions = useRequirements(r, update, edit, saved);
  const [viewId, setViewId] = useState<string>();
  const [applying, setApplying] = useState(false),
    [applyError, setApplyError] = useState("");
  const previous = useRef(r.requirements[0]?.id),
    showResult = useRef(false);
  const selectionController = useRef<AbortController | null>(null);
  useEffect(() => () => selectionController.current?.abort(), []);
  const [toast, setToast] = useState<{
    version: number;
    previous: RequirementSelection;
    appliedRevision: number;
  }>();
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const doc = r.requirements.find((d) => d.id === viewId) || r.requirements[0];
  useEffect(() => {
    const id = r.requirements[0]?.id;
    if (id && id !== previous.current) {
      setViewId(id);
      if (showResult.current) {
        showResult.current = false;
        go("input?view=requirements");
      }
    }
    previous.current = id;
  }, [r.requirements]);
  // The current 협의 기준, only while it still matches the current input.
  const base = hasAppliedRequirement(r) ? appliedDocument(r) : undefined;
  async function undoSelection() {
    if (!toast) return;
    const { previous, appliedRevision } = toast;
    setToast(undefined);
    setApplyError("");
    try {
      if (previous.selectedRequirementDocumentId)
        await requirementsService.select(
          r.id,
          previous.selectedRequirementDocumentId,
          r.inputRevision,
          new AbortController().signal,
        );
      update((latest) => restoreSelection(latest, previous, appliedRevision));
    } catch (e) {
      setApplyError(
        e instanceof Error ? e.message : "이전 기준으로 되돌리지 못했습니다.",
      );
    }
  }
  async function selectDocument() {
    if (!doc || applying || !saved) return;
    const controller = new AbortController();
    selectionController.current = controller;
    setApplying(true);
    setApplyError("");
    try {
      await requirementsService.select(
        r.id,
        doc.id,
        r.inputRevision,
        controller.signal,
      );
      if (!controller.signal.aborted)
        update((latest) => {
          const next = applyRequirement(latest, doc.id, r.inputRevision);
          if (next !== latest)
            setToast({
              version: doc.generationNumber,
              previous: selectionOf(latest),
              appliedRevision: next.revision,
            });
          return next;
        });
    } catch (e) {
      if (!controller.signal.aborted)
        setApplyError(
          e instanceof Error ? e.message : "문서 적용에 실패했습니다.",
        );
    } finally {
      if (!controller.signal.aborted) setApplying(false);
    }
  }
  if (view === "legacy") return <LegacyPicker {...props} />;
  if (view === "preview" && hasAppliedRequirement(r))
    return (
      <>
        <ScreenTitle
          title="[미리 붓기]"
          description="레거시 UI에 맞춘 예상 화면을 확인하고, 현업과 요구사항을 협의해 보세요."
        />
        <RequestContext r={r} edit={edit} />
        <p className="workflow-info">
          {generationBase
            ? "생성 시 선택 MD와 코드 ZIP을 서버로 전송합니다."
            : "서버 미설정 · 사전 작성된 화면으로 시연합니다. 실제 코드 분석·서버 전송은 수행하지 않습니다."}
        </p>
        <SystemMockPanel r={r} update={update} saved={saved} />
        {/* <RequirementConfirmationPanel {...props} /> */}
        <StepFooter
          back={{
            label: "‹ 성분 보기",
            onClick: () => go("input?view=requirements"),
          }}
          backText={{
            label: "+ 자료 추가/수정",
            onClick: () => go("input?view=materials"),
          }}
          next={{
            label: "탕도 살피기 ›",
            disabled: !saved || !!props.busy || !canConfirmRequirement(r),
            onClick: () => props.confirmAndAnalyze(),
          }}
          reason={
            !saved
              ? "저장이 완료되면 진행할 수 있어요"
              : props.busy
                ? "진행 중인 작업이 끝나면 진행할 수 있어요"
                : "기준 MD를 선택하면 진행할 수 있어요"
          }
        />
      </>
    );
  if (view === "materials") {
    const values = location.state?.materials;
    const initial: Material[] = Array.isArray(values)
      ? values.filter((v): v is Material =>
          ["text", "html", "file"].includes(v),
        )
      : ["text"];
    return (
      <>
        <ScreenTitle
          title="[쇳물 녹이기]"
          description="선택한 형태별로 요구사항을 넣어주세요. 나중에 자료를 추가/수정할 수 있어요."
        />
        <RequestContext r={r} edit={edit} />
        <MaterialCards
          r={r}
          edit={edit}
          actions={actions}
          initial={initial.length ? initial : ["text"]}
        />
        {actions.error && (
          <p role="alert" className="inline-error">
            {actions.error}
          </p>
        )}
        {actions.pending && (
          <p role="status" className="workflow-notice">
            요구사항을 정리하고 있습니다. 입력과 기존 문서는 보존됩니다.
          </p>
        )}
        <p className="workflow-info">
          {requirementsService.mode === "mock"
            ? "서버 미설정 · 파일 내용 분석과 이전 MD 종합은 수행하지 않는 로컬 시연입니다."
            : "현재 입력 전체를 서버로 전달합니다."}
        </p>
        <StepFooter
          back={{
            label: "‹ 틀 고르기",
            onClick: () => go("input?view=legacy"),
          }}
          next={{
            label: "성분 보기 ›",
            disabled: !saved || !!actions.pending || !canGenerate(r),
            onClick: () => {
              showResult.current = true;
              actions.generate();
            },
          }}
          reason={
            !saved
              ? "저장이 완료되면 진행할 수 있어요"
              : actions.pending
                ? "요구사항 정리가 끝나면 진행할 수 있어요"
                : !r.title.trim()
                  ? "요청 제목을 입력하면 진행할 수 있어요"
                  : !uploadsReady(r)
                    ? "파일 업로드가 끝나면 진행할 수 있어요"
                    : "요구사항을 입력하면 진행할 수 있어요"
          }
        />
      </>
    );
  }
  return (
    <>
      <ScreenTitle
        title="[쇳물 성분 보기]"
        description="정리된 요구사항을 확인하고, 레거시에 맞춘 Mock을 만들어요."
      />
      <RequestContext r={r} edit={edit} />
      {view === "preview" && (
        <p role="status" className="workflow-info">
          Mock을 만들려면 아래에서 기준 MD를 먼저 선택해주세요.
        </p>
      )}
      {actions.error && (
        <p role="alert" className="inline-error">
          {actions.error}
        </p>
      )}
      {r.generations
        .filter((g) => g.status !== "succeeded")
        .map((g) => (
          <div key={g.id} role="status" className="workflow-info">
            v{g.generationNumber} ·{" "}
            {g.status === "failed" ? "생성 실패" : "생성 중"}
            {g.error && (
              <>
                <p>{g.error}</p>
                {g.status !== "failed" && (
                  <button onClick={() => actions.retry(g.id)}>
                    작업 상태 다시 확인
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      {doc ? (
        <div className="requirements-layout">
          <section className="workflow-card requirement-document">
            <div className="workflow-card-heading">
              <span className="md-file-name">
                요구사항_v{doc.generationNumber}.md
                {base?.id === doc.id && (
                  <span className="md-base-badge">✓ 협의 기준</span>
                )}
              </span>
              <button
                onClick={() =>
                  downloadMarkdown(
                    doc.inputSnapshot.title,
                    `요구사항-생성${doc.generationNumber}`,
                    doc.generationNumber,
                    doc.markdown,
                  )
                }
              >
                MD 다운로드 ↓
              </button>
            </div>
            {base?.id !== doc.id && (
              <div className="md-base-notice">
                <span>
                  {base
                    ? `지금 보는 v${doc.generationNumber}은 협의 기준이 아니에요 · 현재 기준 v${base.generationNumber}`
                    : "이 MD로 다음 단계를 진행하려면 기준으로 정해 주세요"}
                </span>
                <button
                  className={`md-base-button ${base ? "secondary" : "primary"}`}
                  disabled={
                    !saved ||
                    applying ||
                    r.attachments.some((a) => a.uploadStatus !== "uploaded")
                  }
                  onClick={() => void selectDocument()}
                >
                  {applying
                    ? "적용 중…"
                    : base
                      ? `v${doc.generationNumber}을 기준으로 정하기`
                      : "기준으로 정하기"}
                </button>
              </div>
            )}
            {applyError && (
              <p role="alert" className="inline-error md-base-error">
                {applyError}
              </p>
            )}
            <div className="document-content">
              <MarkdownPreview markdown={doc.markdown} />
            </div>
          </section>
          <div className="document-aside">
            <details className="md-history">
              <summary>
                요구사항 MD 이력 · {r.requirements.length}개 ·{" "}
                {base ? `협의 기준 v${base.generationNumber}` : "기준 미선택"}
              </summary>
              <div className="md-history-list">
                {r.requirements.map((d) => (
                  <button
                    key={d.id}
                    aria-pressed={doc.id === d.id}
                    className={doc.id === d.id ? "viewing" : ""}
                    onClick={() => setViewId(d.id)}
                  >
                    <span className="md-history-title">
                      요구사항 v{d.generationNumber}
                      {base?.id === d.id && (
                        <span className="md-base-badge">✓ 협의 기준</span>
                      )}
                    </span>
                    <small>
                      입력 자료 v{d.generationNumber} · {dotDate(d.createdAt)}
                    </small>
                  </button>
                ))}
              </div>
            </details>
            <DocumentSources key={doc.id} doc={doc} />
          </div>
        </div>
      ) : (
        <Empty>
          생성된 문서가 없습니다. 자료를 넣고 요구사항을 정리해주세요.
        </Empty>
      )}
      <StepFooter
        back={{
          label: "‹ 쇳물 녹이기",
          onClick: () => go("input?view=materials"),
        }}
        nextText={{
          label: "탕도 살피기로 건너뛰기 ›",
          title:
            "화면 변경이 없거나, 이미 확정된 화면이 있을 때 건너뛸 수 있어요",
          disabled: !saved || !!props.busy || !hasAppliedRequirement(r),
          onClick: () => props.confirmAndAnalyze({ skipPreview: true }),
        }}
        next={{
          label: "미리 붓기 ›",
          disabled: !saved || !hasAppliedRequirement(r),
          onClick: () => go("input?view=preview"),
        }}
        reason={
          !saved
            ? "저장이 완료되면 진행할 수 있어요"
            : "기준 MD를 선택하면 진행할 수 있어요"
        }
      />
      {toast && (
        <div className="md-toast" role="status">
          <span>v{toast.version}을 협의 기준으로 정했어요</span>
          <button onClick={() => void undoSelection()}>되돌리기</button>
        </div>
      )}
    </>
  );
}
