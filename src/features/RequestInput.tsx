import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  applyRequirement,
  appliedDocument,
  hasAppliedRequirement,
  canGenerate,
} from "../domain/types";
import { requirementsService } from "../services/requirements";
import { generationBase } from "../services/generationTransport";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { Empty, Tag } from "../components/shared";
import {
  inputView,
  RequestContext,
  ScreenTitle,
} from "../components/WorkflowShell";
import { downloadMarkdown, displayDate } from "../utils/downloads";
import { useRequirements } from "./useRequirements";
import { MaterialCards } from "./MaterialCards";
import { LegacyPicker } from "./LegacyPicker";
import { SystemMockPanel } from "./SystemMockPanel";
import { RequirementConfirmationPanel } from "./RequirementConfirmationPanel";
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
        update((latest) => applyRequirement(latest, doc.id, r.inputRevision));
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
        <div className="workflow-actions">
          <button onClick={() => go("input?view=materials")}>
            자료 추가/수정하기
          </button>
          <button onClick={() => go("input?view=requirements")}>
            성분 보기로 돌아가기
          </button>
        </div>
        <RequirementConfirmationPanel {...props} />
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
        <div className="workflow-actions">
          <button onClick={() => go("input?view=legacy")}>
            &lt; 틀 고르기
          </button>
          <div>
            {r.requirements.length > 0 && (
              <button onClick={() => go("input?view=requirements")}>
                기존 MD 보기
              </button>
            )}
            <button
              className="primary"
              disabled={!saved || !!actions.pending || !canGenerate(r)}
              onClick={() => {
                showResult.current = true;
                actions.generate();
              }}
            >
              {actions.pending ? "요구사항 정리 중…" : "요구사항 정리하기 >"}
            </button>
          </div>
        </div>
      </>
    );
  }
  const active = appliedDocument(r);
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
      <details className="document-history">
        <summary>
          문서 이력 · {r.requirements.length}개
          {active
            ? ` · 협의 기준: 생성 ${active.generationNumber}`
            : " · 기준 미선택"}
        </summary>
        <div className="requirement-list">
          {r.requirements.map((d) => (
            <button
              key={d.id}
              aria-pressed={doc?.id === d.id}
              className={doc?.id === d.id ? "selected" : ""}
              onClick={() => setViewId(d.id)}
            >
              <span>
                요구사항 MD · 생성 {d.generationNumber}
                <small>
                  {displayDate(d.createdAt)} · 입력 v{d.inputRevision}
                </small>
              </span>
              <Tag>{active?.id === d.id ? "협의 기준" : "열람"}</Tag>
            </button>
          ))}
        </div>
      </details>
      {r.generations
        .filter((g) => g.status !== "succeeded")
        .map((g) => (
          <div key={g.id} role="status" className="workflow-info">
            생성 {g.generationNumber} ·{" "}
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
              <span>요구사항_v{doc.generationNumber}.md</span>
              <button
                onClick={() =>
                  downloadMarkdown(
                    doc.inputSnapshot.title,
                    `요구사항-생성${doc.generationNumber}`,
                    doc.inputRevision,
                    doc.markdown,
                  )
                }
              >
                MD 다운로드 ↓
              </button>
            </div>
            <div className="document-content">
              <MarkdownPreview markdown={doc.markdown} />
            </div>
          </section>
          <div className="document-aside">
            <section className="workflow-card">
              <h3>반영된 자료</h3>
              {doc.inputSnapshot.text && (
                <p>
                  Teams 대화 · {doc.inputSnapshot.text.length.toLocaleString()}
                  자
                </p>
              )}
              {doc.inputSnapshot.html && (
                <p>
                  HTML 시안 · {doc.inputSnapshot.html.length.toLocaleString()}자
                </p>
              )}
              {doc.inputSnapshot.attachmentNames.map((name, i) => (
                <p key={`${i}-${name}`}>{name}</p>
              ))}
              <small>이 문서 생성 당시의 자료입니다.</small>
            </section>
            <section className="workflow-card">
              <h3>분석 기준 MD</h3>
              <Tag green={active?.id === doc.id}>
                {active?.id === doc.id
                  ? "현재 협의 기준"
                  : "열람 중 · 아직 미선택"}
              </Tag>
              {doc.inputRevision !== r.inputRevision && (
                <p className="panel-note">
                  이전 입력 기준 문서입니다. 선택하면 이 MD 원문으로 확정·분석할
                  수 있습니다.
                </p>
              )}
              <button
                className="primary"
                disabled={
                  !saved ||
                  applying ||
                  r.attachments.some((a) => a.uploadStatus !== "uploaded")
                }
                onClick={() => void selectDocument()}
              >
                {applying ? "문서 적용 중…" : "이 문서로 협의하기"}
              </button>
              {applyError && (
                <p role="alert" className="inline-error">
                  {applyError}
                </p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <Empty>
          생성된 문서가 없습니다. 자료를 넣고 요구사항을 정리해주세요.
        </Empty>
      )}
      <div className="workflow-actions">
        <button onClick={() => go("input?view=materials")}>
          &lt; 자료 추가/수정하기
        </button>
        <button
          className="primary"
          disabled={!saved || !hasAppliedRequirement(r)}
          onClick={() => go("input?view=preview")}
        >
          레거시에 맞춰 Mock 만들기 &gt;
        </button>
      </div>
      <RequirementConfirmationPanel {...props} />
    </>
  );
}
