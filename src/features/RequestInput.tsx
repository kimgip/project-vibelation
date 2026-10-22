import { RequirementEditor } from "../components/RequirementEditor";
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
import { MarkdownPreview } from "../components/MarkdownPreview";
import { Empty, Tag } from "../components/shared";
import {
  inputView,
  RequestContext,
  ScreenTitle,
  StepFooter,
} from "../components/WorkflowShell";
import { downloadRequirement, documentName, dotDate } from "../utils/downloads";
import { useRequirements } from "./useRequirements";
import { MaterialCards } from "./MaterialCards";
import { DocumentSources } from "./DocumentSources";
import { LegacyPicker } from "./LegacyPicker";
import { SystemMockPanel, useSystemMock } from "./SystemMockPanel";
// 미리 붓기의 "협의 및 요구사항 확정" 패널은 잠시 숨김 처리. 다시 쓰려면 아래 import와 JSX 주석을 함께 해제하세요.
// import { RequirementConfirmationPanel } from "./RequirementConfirmationPanel";
import type { WorkspaceProps } from "./workspace";
import type { Material } from "./Landing";
export function InputPage(props: WorkspaceProps) {
  const { r, edit, update, go, saved } = props;
  const location = useLocation();
  const view = inputView(r, location.search);
  const actions = useRequirements(r, update, edit, saved);
  const preview = useSystemMock(r, update, saved);
  const [mdDirty, setMdDirty] = useState(false);
  useEffect(() => { if (!mdDirty) return; const guard = (e: BeforeUnloadEvent) => {e.preventDefault(); e.returnValue = "";}; window.addEventListener("beforeunload",guard); return () => window.removeEventListener("beforeunload",guard); }, [mdDirty]);
  const [openingPreview, setOpeningPreview] = useState(false);
  const previewBasis = useRef("");
  const recoveringPreview = useRef(true);
  const currentPreviewBasis = JSON.stringify([r.selectedRequirementDocumentId, r.legacyVersion, r.screenType, r.inputRevision]);
  useEffect(() => {
    if (recoveringPreview.current) {
      recoveringPreview.current = false;
      if (preview.job && ["queued", "running"].includes(preview.job.status) && view === "requirements") {
        previewBasis.current = currentPreviewBasis; setOpeningPreview(true);
      }
    }
    if (openingPreview && previewBasis.current !== currentPreviewBasis) setOpeningPreview(false);
    else if (openingPreview && preview.displayed && saved) {
      setOpeningPreview(false); go("input?view=preview");
    }
  }, [openingPreview, preview.displayed, currentPreviewBasis, saved]);
  useEffect(() => {
    if (view === "preview" && !preview.displayed) go("input?view=requirements");
  }, [view, preview.displayed]);
  const [viewId, setViewId] = useState<string>();
  const [applying, setApplying] = useState(false),
    [applyError, setApplyError] = useState("");
  const previous = useRef(r.requirements[0]?.id),
    showResult = useRef(view === "materials" && !!actions.pending);
  const resultRevision = useRef(actions.pending?.uiInputRevision ?? r.inputRevision);
  const selectionController = useRef<AbortController | null>(null);
  useEffect(() => () => selectionController.current?.abort(), []);
  const [toast, setToast] = useState<{
    version: number;
    name: string;
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
      if (showResult.current && resultRevision.current === r.inputRevision) {
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
      await requirementsService.select(
          r.id,
          previous.selectedRequirementDocumentId || null,
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
              name: documentName(doc),
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
          description="기존 시스템에 적용될 화면을 예상해요."
        />
        <RequestContext r={r} edit={edit} />
        <SystemMockPanel r={r} />
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
            disabled: mdDirty || !saved || !!props.busy || !canConfirmRequirement(r),
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
          actions.pending.error ? <div role="alert" className="workflow-notice">
            <span>{actions.pending.error}</span><button onClick={() => actions.retry(actions.pending!.id)}>작업 상태 다시 확인</button>
          </div> : <div className="agent-progress" role="status" aria-live="polite">
            <strong>{actions.pending.phase === "merging_previous" && actions.pending.contextDocumentIds?.length
              ? "이전 버전과 합치는 중입니다…" : "요구사항 정리 중…"}</strong>
            <progress aria-label="요구사항 생성 진행" />
            <span>처리가 완료되면 결과를 보여드립니다.</span>
          </div>
        )}
        <StepFooter
          back={{
            label: "‹ 틀 고르기",
            onClick: () => go("input?view=legacy"),
          }}
          next={{
            label: "성분 보기 ›",
            disabled: !saved || !!actions.pending || !canGenerate(r) || !r.screenType,
            onClick: () => {
              showResult.current = true;
              resultRevision.current = r.inputRevision;
              actions.generate();
            },
          }}
          reason={
            !saved
              ? "저장이 완료되면 진행할 수 있어요"
              : !r.screenType
                ? "틀 고르기에서 신규 또는 수정을 선택해주세요"
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
        description="정리된 요구사항을 확인해요. md는 새로 생성/수정할 수 있어요."
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
            {g.displayTitle || g.inputSnapshot.title || "요구사항"}_version{g.generationNumber} ·{" "}
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
                {documentName(doc)}.md
                {base?.id === doc.id && (
                  <span className="md-base-badge">✓ 협의 기준</span>
                )}
              </span>
              <button
                onClick={() =>
                  !mdDirty && downloadRequirement(doc)
                }
              >
                MD 다운로드 ↓
              </button>
            </div>
            {base?.id !== doc.id && (
              <div className="md-base-notice">
                <span>
                  {base
                    ? `지금 보는 ${documentName(doc)}은 협의 기준이 아니에요 · 현재 기준 ${documentName(base)}`
                    : "이 MD로 다음 단계를 진행하려면 기준으로 정해 주세요"}
                </span>
                <button
                  className={`md-base-button ${base ? "secondary" : "primary"}`}
                  disabled={
                    mdDirty || !saved ||
                    applying ||
                    r.attachments.some((a) => a.uploadStatus !== "uploaded")
                  }
                  onClick={() => void selectDocument()}
                >
                  {applying
                    ? "적용 중…"
                    : base
                      ? `${documentName(doc)}을 기준으로 정하기`
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
              <RequirementEditor key={doc.id} document={doc} onDirty={setMdDirty} onSaved={document => update(latest => {
                const changed = latest.requirements.find(d => d.id === document.id)?.markdown !== document.markdown;
                const next = {...latest, requirements:latest.requirements.map(d => d.id === document.id ? document : d)};
                if (!changed || latest.selectedRequirementDocumentId !== document.id) return next;
                return {...next, revision:next.revision+1, requirement: next.requirement ? {...next.requirement,markdown:document.markdown} : undefined, activeConfirmationId:undefined, selectedMockId:undefined, mocks:next.mocks.filter(m=>m.requirementDocumentId!==document.id), mockJobs:next.mockJobs.filter(j=>j.requirementDocumentId!==document.id), analysis:undefined, report:undefined, review:undefined, scopeReviewed:false, estimateReviewed:false};
              })} />
            </div>
          </section>
          <div className="document-aside">
            <details className="md-history">
              <summary>
                요구사항 MD 이력 · {r.requirements.length}개 ·{" "}
                {base ? `협의 기준 ${documentName(base)}` : "기준 미선택"}
              </summary>
              <div className="md-history-list">
                {r.requirements.map((d) => (
                  <button
                    key={d.id}
                    aria-pressed={doc.id === d.id}
                    className={doc.id === d.id ? "viewing" : ""}
                    disabled={mdDirty}
                    onClick={() => setViewId(d.id)}
                  >
                    <span className="md-history-title">
                      {documentName(d)}
                      {base?.id === d.id && (
                        <span className="md-base-badge">✓ 협의 기준</span>
                      )}
                    </span>
                    <small>
                      입력된 요구사항_version{d.generationNumber} · {dotDate(d.createdAt)}
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
      {openingPreview && !preview.displayed && (
        preview.job?.error ? <div className="workflow-notice" role="alert">
          <span>{preview.job.error}</span><button onClick={() => preview.start()}>{preview.job.status === "failed" ? "다시 시도" : "작업 상태 다시 확인"}</button>
        </div> : <div className="agent-progress" role="status" aria-live="polite">
          <strong>예상 화면 생성 중…</strong>
          <progress aria-label="예상 화면 생성 진행" />
          <span>처리가 완료되면 결과를 보여드립니다.</span>
        </div>
      )}
      {!r.screenType && <div className="workflow-notice" role="status">
        <span>화면 종류(신규/수정)를 선택해야 다음 단계로 진행할 수 있습니다. 기존 요구사항 MD는 그대로 유지됩니다.</span>
        <button onClick={() => go("input?view=legacy")}>화면 종류 선택하기</button>
      </div>}
      <StepFooter
        back={{
          label: "‹ 쇳물 녹이기",
          onClick: () => go("input?view=materials"),
        }}
        nextText={{
          label: "탕도 살피기로 건너뛰기 ›",
          title:
            "화면 변경이 없거나, 이미 확정된 화면이 있을 때 건너뛸 수 있어요",
          disabled: mdDirty || !saved || !!props.busy || !hasAppliedRequirement(r) || !r.screenType,
          onClick: () => props.confirmAndAnalyze({ skipPreview: true }),
        }}
        next={{
          label: "미리 붓기 ›",
          disabled: mdDirty || !saved || !hasAppliedRequirement(r) || !r.screenType || openingPreview,
          onClick: () => {
            if (preview.displayed) go("input?view=preview");
            else { previewBasis.current = currentPreviewBasis; setOpeningPreview(true); preview.start(); }
          },
        }}
        reason={
          !saved
            ? "저장이 완료되면 진행할 수 있어요"
            : !r.screenType
              ? "화면 종류(신규/수정)를 선택해주세요"
              : openingPreview
                ? preview.job?.error ? "생성 오류를 확인한 뒤 다시 시도해주세요" : "예상 화면 생성이 끝나면 이동합니다"
                : r.selectedRequirementDocumentId && !hasAppliedRequirement(r)
                  ? "입력 기준이 바뀌었습니다. MD를 다시 기준으로 정해주세요"
                  : "기준 MD를 선택하면 진행할 수 있어요"
        }
      />
      {toast && (
        <div className="md-toast" role="status">
          <span>{toast.name}을 협의 기준으로 정했어요</span>
          <button onClick={() => void undoSelection()}>되돌리기</button>
        </div>
      )}
    </>
  );
}
