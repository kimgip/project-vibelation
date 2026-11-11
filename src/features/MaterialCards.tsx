import { InteractiveHtmlFrame } from "../components/InteractiveHtmlFrame";
import { useState } from "react";
import { StaticHtmlFrame } from "../components/StaticHtmlFrame";
import { sample } from "../mocks/download-center";
import { FILE_POLICY, pendingFiles } from "../services/requirements";
import type { WorkRequest } from "../domain/types";
import type { Material } from "./Landing";
import type { useRequirements } from "./useRequirements";
const names = {
  text: "Teams 대화",
  html: "HTML 화면 시안",
  file: "PPT · 자료 첨부",
};
const icons = { text: "teams", html: "html", file: "ppt" };
const states = {
  pending: "업로드 대기",
  uploading: "업로드 중",
  uploaded: "전송 처리 완료",
  failed: "업로드 실패",
  needsReselect: "파일 재선택 필요",
};
export function MaterialCards({
  r,
  edit,
  actions,
  initial,
}: {
  r: WorkRequest;
  edit: (patch: Partial<WorkRequest>) => void;
  actions: ReturnType<typeof useRequirements>;
  initial: Material[];
}) {
  const [opened, setOpened] = useState<Material[]>(() =>
    Array.from(
      new Set([
        ...initial,
        ...(r.text ? ["text" as Material] : []),
        ...(r.html ? ["html" as Material] : []),
        ...(r.attachments.length ? ["file" as Material] : []),
      ]),
    ),
  );
  const [preview, setPreview] = useState(false);
  return (
    <div className="material-editor">
      {opened.map((type) => (
        <section className="workflow-card material-editor-card" key={type}>
          <div className="workflow-card-heading">
            <div className="material-heading">
              <img
                src={`${import.meta.env.BASE_URL}brand/${icons[type]}.svg`}
                alt=""
                width="32"
                height="32"
              />
              <div>
                <h2>{names[type]}</h2>
                <small>
                  {type === "text"
                    ? "채팅 · 요청 메시지 붙여넣기"
                    : type === "html"
                      ? "화면 시안 · 코드와 동작 미리보기"
                      : "기획서 · 화면 설계서 파일 선택"}
                </small>
              </div>
            </div>
            {type === "text" && (
              <button
                onClick={() =>
                  edit({ title: r.title || sample.title, text: sample.text })
                }
              >
                샘플 불러오기
              </button>
            )}
          </div>
          {type === "text" ? (
            <>
              <label className="sr-only" htmlFor="sourceText">
                Teams 대화
              </label>
              <textarea
                id="sourceText"
                maxLength={40000}
                value={r.text}
                onChange={(e) => edit({ text: e.target.value })}
                placeholder="Teams로 받은 요청 메시지를 그대로 붙여넣으세요."
              />
              <small>{r.text.length.toLocaleString()}자 입력됨</small>
            </>
          ) : type === "html" ? (
            <>
              <div
                className="code-toggle"
                role="group"
                aria-label="HTML 보기 방식"
              >
                <button
                  aria-pressed={!preview}
                  onClick={() => setPreview(false)}
                >
                  Code
                </button>
                <button aria-pressed={preview} onClick={() => setPreview(true)}>
                  Preview
                </button>
              </div>
              {preview ? (
                <InteractiveHtmlFrame html={r.html} />
              ) : (
                <>
                  <label className="sr-only" htmlFor="sourceHtml">
                    HTML 코드
                  </label>
                  <textarea
                    id="sourceHtml"
                    maxLength={1000000}
                    spellCheck={false}
                    className="code"
                    value={r.html}
                    onChange={(e) => edit({ html: e.target.value })}
                    placeholder="HTML 코드를 입력해주세요."
                  />
                </>
              )}
              <small>{r.html.split("\n").length}줄</small>
            </>
          ) : (
            <>
              <label className="zip-picker">
                + 요구사항 자료 선택
                <input
                  type="file"
                  aria-label="자료 첨부"
                  multiple
                  accept={FILE_POLICY.extensions.map((e) => "." + e).join(",")}
                  onChange={(e) => {
                    void actions.addFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
              </label>
              <small>
                시연 제한: 파일당 5MiB · 최대 5개 · TXT, MD, HTML, PDF, DOCX,
                PPTX, PNG, JPG. 코드 ZIP은 설정에서 별도로 등록합니다.
              </small>
              {r.attachments.map((a) => (
                <div className="source-package" key={a.id}>
                  <div>
                    <b>{a.name}</b>
                    <small>
                      {(a.size / 1024).toFixed(1)} KB ·{" "}
                      {states[a.uploadStatus || "needsReselect"]}
                    </small>
                    {a.error && <small role="alert">{a.error}</small>}
                  </div>
                  {a.uploadStatus === "failed" && pendingFiles.has(a.id!) && (
                    <button onClick={() => void actions.upload(a)}>
                      재시도
                    </button>
                  )}
                  <button
                    aria-label={`${a.name} 제외`}
                    onClick={() => {
                      edit({
                        attachments: r.attachments.filter((x) => x.id !== a.id),
                      });
                      pendingFiles.delete(a.id!);
                    }}
                  >
                    제외
                  </button>
                </div>
              ))}
            </>
          )}
        </section>
      ))}
      <details className="material-add">
        <summary>+ 자료 추가</summary>
        <div>
          {(["text", "html", "file"] as Material[]).map((type) => (
            <button
              key={type}
              disabled={opened.includes(type)}
              onClick={() => setOpened((current) => [...current, type])}
            >
              {names[type]}
              {opened.includes(type) ? " · 추가됨" : ""}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
