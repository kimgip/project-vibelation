import { useState, useRef, useEffect } from "react";
import {
  Code2,
  Eye,
  FileText,
  Sparkles,
  Upload,
  Download,
  Check,
  RefreshCw,
  X,
} from "lucide-react";
import { applyRequirement, canGenerate } from "../domain/types";
import { sample } from "../mocks/download-center";
import {
  requirementsService,
  pendingFiles,
  FILE_POLICY,
} from "../services/requirements";
import { StaticHtmlFrame } from "../components/StaticHtmlFrame";
import { Tag, Empty } from "../components/shared";
import { downloadMarkdown, displayDate } from "../utils/downloads";
import { useRequirements } from "./useRequirements";
import type { WorkspaceProps } from "./workspace";
export function InputPage({ r, edit, update, go, saved }: WorkspaceProps) {
  const [tab, setTab] = useState("text"),
    [htmlMode, setHtmlMode] = useState("code"),
    [viewId, setViewId] = useState<string>();
  const [applying, setApplying] = useState(false),
    [applyError, setApplyError] = useState("");
  const codeRef = useRef<HTMLTextAreaElement>(null),
    selection = useRef<[number, number]>([0, 0]);
  const { generate, addFiles, upload, retry, error, pending } = useRequirements(
    r,
    update,
    edit,
    saved,
  );
  const doc = r.requirements.find((d) => d.id === viewId) || r.requirements[0];
  async function applyDocument() {
    if (!doc || applying) return;
    setApplying(true);
    setApplyError("");
    try {
      await requirementsService.select(
        r.id,
        doc.id,
        r.inputRevision,
        new AbortController().signal,
      );
      let accepted = false;
      update((latest) => {
        const next = applyRequirement(latest, doc.id);
        accepted = true;
        return next;
      });
      if (accepted) go("analysis");
    } catch (e) {
      setApplyError(
        e instanceof Error ? e.message : "문서 적용에 실패했습니다.",
      );
    } finally {
      setApplying(false);
    }
  }
  useEffect(() => {
    if (htmlMode === "code" && codeRef.current)
      codeRef.current.setSelectionRange(...selection.current);
  }, [htmlMode, tab]);
  const previousFirst = useRef(r.requirements[0]?.id);
  useEffect(() => {
    const id = r.requirements[0]?.id;
    if (id && id !== previousFirst.current) setViewId(id);
    previousFirst.current = id;
  }, [r.requirements]);
  const stateLabels = {
    pending: "업로드 대기",
    uploading: "업로드 중",
    uploaded:
      requirementsService.mode === "mock" ? "Mock 업로드 완료" : "업로드 완료",
    failed: "업로드 실패",
    needsReselect: "파일 재선택 필요",
  };
  return (
    <>
      <div className="section-caption">
        <div>
          <span className="section-kicker">STEP 01</span>
          <h2>현업의 자료에서, 명확한 요구사항으로</h2>
        </div>
        <small>입력을 모으고 생성된 요구사항을 검토합니다.</small>
      </div>
      <div className="info-strip">
        <FileText size={16} />
        <span>
          {requirementsService.mode === "mock"
            ? "서버 미연결 Mock · 파일 내용 분석과 이전 MD 종합은 수행하지 않습니다."
            : "현재 입력 전체를 서버에 전달하여 요구사항을 생성합니다. 후속 단계 분석은 시연 Mock입니다."}
        </span>
      </div>
      <div className="request-input-grid">
        <section className="panel input-panel">
          <div className="panel-heading">
            <span>
              <FileText size={16} />
              요구사항 입력
            </span>
            <Tag>입력 v{r.inputRevision}</Tag>
          </div>
          <div className="input-tabs" role="tablist" aria-label="입력 방식">
            {[
              ["text", "대화 · 텍스트"],
              ["html", "HTML"],
              ["file", "자료 첨부"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="panel-content">
            {tab === "text" ? (
              <>
                <div className="field-line">
                  <label htmlFor="sourceText">대화 · 회의록 · 메일</label>
                  <button
                    className="text-button"
                    onClick={() =>
                      edit({
                        title: sample.title,
                        text: sample.text,
                        agreement: sample.agreement,
                      })
                    }
                  >
                    샘플 불러오기
                  </button>
                </div>
                <textarea
                  id="sourceText"
                  className="conversation"
                  maxLength={40000}
                  value={r.text}
                  onChange={(e) => edit({ text: e.target.value })}
                  placeholder="요구사항과 대화 내용을 입력해주세요."
                />
                <small>
                  탭을 바꿔도 입력은 유지됩니다. 생성 시 모든 탭의 자료를 함께
                  전달합니다.
                </small>
              </>
            ) : tab === "html" ? (
              <>
                <div className="field-line">
                  <label htmlFor="sourceHtml">요구사항 HTML</label>
                  <div
                    className="code-toggle"
                    role="group"
                    aria-label="HTML 보기 방식"
                  >
                    <button
                      aria-pressed={htmlMode === "code"}
                      onClick={() => setHtmlMode("code")}
                    >
                      <Code2 size={14} />
                      Code
                    </button>
                    <button
                      aria-pressed={htmlMode === "preview"}
                      onClick={() => {
                        if (codeRef.current)
                          selection.current = [
                            codeRef.current.selectionStart,
                            codeRef.current.selectionEnd,
                          ];
                        setHtmlMode("preview");
                      }}
                    >
                      <Eye size={14} />
                      Preview
                    </button>
                  </div>
                </div>
                {htmlMode === "code" ? (
                  <textarea
                    ref={codeRef}
                    id="sourceHtml"
                    className="conversation code"
                    maxLength={1000000}
                    spellCheck={false}
                    value={r.html}
                    onChange={(e) => edit({ html: e.target.value })}
                    placeholder="HTML 코드를 입력하고 Preview로 화면을 확인하세요."
                  />
                ) : (
                  <div className="inline-html-preview">
                    <StaticHtmlFrame html={r.html} />
                  </div>
                )}
                <small>
                  프런트엔드에서 HTML/CSS만 표시합니다. JavaScript·외부
                  자원·서버 호출은 차단합니다. 전달되는 원문은 변경하지
                  않습니다.
                </small>
              </>
            ) : (
              <>
                <div className="upload-box">
                  <Upload size={26} />
                  <h3>자료 첨부</h3>
                  <p>
                    모든 첨부를 함께 전달합니다. 실패한 파일은 재시도하거나
                    제외해주세요.
                  </p>
                  <input
                    type="file"
                    aria-label="자료 첨부"
                    multiple
                    accept={FILE_POLICY.extensions
                      .map((e) => "." + e)
                      .join(",")}
                    onChange={(e) => {
                      void addFiles(Array.from(e.target.files || []));
                      e.target.value = "";
                    }}
                  />
                  <small>
                    시연 제한: 파일당 5MiB · 최대 5개
                    <br />
                    지원: TXT, MD, HTML, PDF, DOCX, PPTX, PNG, JPG
                    <br />
                    운영 제한은 BE 계약 확정 후 적용합니다.
                  </small>
                </div>
                <div className="attachment-list">
                  {r.attachments.map((a) => (
                    <div className="attachment-row" key={a.id}>
                      <div>
                        <b>{a.name}</b>
                        <small>
                          {(a.size / 1024).toFixed(1)} KB ·{" "}
                          {stateLabels[a.uploadStatus || "needsReselect"]}
                        </small>
                        {a.error && <small role="alert">{a.error}</small>}
                      </div>
                      {a.uploadStatus === "failed" &&
                        pendingFiles.has(a.id!) && (
                          <button
                            aria-label={`${a.name} 업로드 재시도`}
                            onClick={() => void upload(a)}
                          >
                            <RefreshCw size={13} />
                          </button>
                        )}
                      <button
                        aria-label={`${a.name} 제외`}
                        onClick={() =>
                          edit({
                            attachments: r.attachments.filter(
                              (x) => x.id !== a.id,
                            ),
                          })
                        }
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="input-summary">
            <span>텍스트 {r.text.length.toLocaleString()}자</span>
            <span>HTML {r.html.length.toLocaleString()}자</span>
            <span>첨부 {r.attachments.length}개</span>
          </div>
          <div className="panel-bottom">
            <small>매회 현재 입력 전체를 전달합니다.</small>
            <button
              className="primary"
              disabled={!saved || !!pending || !canGenerate(r)}
              onClick={generate}
            >
              <Sparkles size={14} />
              {pending ? "요구사항 생성 중…" : "요구사항 생성"}
            </button>
          </div>
        </section>
        <section className="panel requirement-history">
          <div className="panel-heading">
            <span>
              <FileText size={16} />
              요구사항 생성 이력 <b>{r.requirements.length}</b>
            </span>
            <Tag>읽기 전용</Tag>
          </div>
          {r.generations
            .filter((g) => g.status !== "succeeded")
            .map((g) => (
              <div className="generation-status" role="status" key={g.id}>
                <span>
                  {g.status === "failed"
                    ? "생성 실패"
                    : g.error
                      ? "연결 확인 필요"
                      : "생성 중"}{" "}
                  · 입력 v{g.inputSnapshot.inputRevision}
                  {g.inputSnapshot.inputRevision !== r.inputRevision
                    ? " · 이전 입력 기준"
                    : ""}
                </span>
                {g.error && <p>{g.error}</p>}
                {g.error && g.status !== "failed" && (
                  <button onClick={() => retry(g.id)}>
                    작업 상태 다시 확인
                  </button>
                )}
                {g.status === "failed" && (
                  <small>
                    현재 입력을 확인한 뒤 요구사항 생성 버튼으로 다시
                    생성해주세요.
                  </small>
                )}
              </div>
            ))}
          {r.requirements.length ? (
            <>
              <div
                className="requirement-list"
                aria-label="생성된 요구사항 목록"
              >
                {r.requirements.map((d) => (
                  <button
                    className={doc?.id === d.id ? "selected" : ""}
                    aria-pressed={doc?.id === d.id}
                    key={d.id}
                    onClick={() => setViewId(d.id)}
                  >
                    <div>
                      <b>요구사항 MD · 생성 {d.generationNumber}</b>
                      <small>
                        {displayDate(d.createdAt)} ·{" "}
                        {new Date(d.createdAt).toLocaleTimeString("ko-KR", {
                          timeZone: "Asia/Seoul",
                        })}{" "}
                        · 입력 v{d.inputRevision}
                      </small>
                    </div>
                    <span className="document-badges">
                      <Tag green={r.selectedRequirementDocumentId === d.id}>
                        {r.selectedRequirementDocumentId === d.id
                          ? "후속 적용"
                          : d.inputRevision === r.inputRevision
                            ? "현재 입력 기준"
                            : "이전 입력 기준"}
                      </Tag>
                      {d.source === "legacy" && <Tag>이전 로컬 초안</Tag>}
                    </span>
                  </button>
                ))}
              </div>
              {doc && (
                <div className="requirement-detail">
                  <div className="document-meta">
                    <b>
                      생성 {doc.generationNumber} · 입력 v{doc.inputRevision}
                    </b>
                    <small>문서 ID: {doc.id}</small>
                  </div>
                  <pre>{doc.markdown}</pre>
                  <div className="document-actions">
                    <button
                      onClick={() =>
                        downloadMarkdown(
                          doc.inputSnapshot.title,
                          `요구사항-생성${doc.generationNumber}-${doc.id.slice(0, 8)}`,
                          doc.inputRevision,
                          doc.markdown,
                        )
                      }
                    >
                      <Download size={14} />
                      요구사항 MD 다운로드
                    </button>
                    <button
                      className="primary"
                      disabled={
                        !saved ||
                        applying ||
                        doc.inputRevision !== r.inputRevision ||
                        r.attachments.some((a) => a.uploadStatus !== "uploaded")
                      }
                      onClick={() => void applyDocument()}
                    >
                      <Check size={14} />이 요구사항으로 다음 단계
                    </button>
                  </div>
                  {applyError && (
                    <p role="alert" className="inline-error">
                      {applyError}
                    </p>
                  )}
                  {doc.inputRevision !== r.inputRevision && (
                    <p className="panel-note">
                      현재 입력과 다른 문서입니다. 현재 입력으로 새로 생성한
                      문서를 적용해주세요.
                    </p>
                  )}
                  <small>
                    목록에서 문서를 보는 것만으로 후속 적용 기준은 바뀌지
                    않습니다.
                  </small>
                </div>
              )}
            </>
          ) : (
            <Empty>
              생성된 요구사항이 없습니다.
              <br />
              자료를 입력하고 요구사항 생성을 눌러주세요.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}
