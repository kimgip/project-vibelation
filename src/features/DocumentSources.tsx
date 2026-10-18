import { useState } from "react";
import type { RequirementDocument } from "../domain/types";
import { StaticHtmlFrame } from "../components/StaticHtmlFrame";
import { UnderlineTabs } from "../components/shared";

export function DocumentSources({ doc }: { doc: RequirementDocument }) {
  const snapshot = doc.inputSnapshot;
  const tabs = [
    ["text", "Teams", snapshot.text.trim() ? 1 : 0],
    ["html", "HTML 코드", snapshot.html.trim() ? 1 : 0],
    [
      "files",
      `첨부파일 (${snapshot.attachmentNames.length})`,
      snapshot.attachmentNames.length,
    ],
  ] as const;
  const [tab, setTab] = useState<string>(
    () => tabs.find(([, , count]) => count > 0)?.[0] || "text",
  );
  const [preview, setPreview] = useState(false);
  return (
    <section
      className="workflow-card document-sources"
      aria-label={`입력 자료 v${doc.generationNumber}`}
    >
      <h3>입력 자료 v{doc.generationNumber}</h3>
      <p className="workflow-info">
        요구사항 v{doc.generationNumber}.md 생성에 사용된 내용으로, 현재 편집
        중인 자료와 별도로 보관됩니다.
      </p>
      <UnderlineTabs
        className="document-sources-tabs"
        tabs={tabs.map(([id, label, count]) => ({
          id,
          label,
          disabled: count === 0,
        }))}
        value={tab}
        onChange={setTab}
        label="생성 당시 입력 자료 종류"
      />
      {tab === "text" ? (
        <>
          <div className="source-body-head">
            <label htmlFor={`snapshot-text-${doc.id}`}>생성 당시 텍스트</label>
          </div>
          <textarea
            id={`snapshot-text-${doc.id}`}
            readOnly
            value={snapshot.text}
            placeholder="사용한 텍스트가 없습니다."
          />
        </>
      ) : tab === "html" ? (
        <>
          <div className="source-body-head">
            <label htmlFor={`snapshot-html-${doc.id}`}>
              생성 당시 HTML 코드
            </label>
            <div
              className="source-segment"
              role="group"
              aria-label="생성 당시 HTML 보기 방식"
            >
              <button aria-pressed={!preview} onClick={() => setPreview(false)}>
                코드
              </button>
              <button aria-pressed={preview} onClick={() => setPreview(true)}>
                미리보기
              </button>
            </div>
          </div>
          {preview ? (
            <StaticHtmlFrame html={snapshot.html} />
          ) : (
            <textarea
              id={`snapshot-html-${doc.id}`}
              className="code"
              readOnly
              spellCheck={false}
              value={snapshot.html}
              placeholder="사용한 HTML 코드가 없습니다."
            />
          )}
        </>
      ) : (
        <>
          <div className="source-body-head">
            <label>생성 당시 첨부파일</label>
          </div>
          {snapshot.attachmentNames.length ? (
            <ul className="snapshot-file-list">
              {snapshot.attachmentNames.map((name, index) => (
                <li key={`${index}-${snapshot.attachmentIds[index] || name}`}>
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p>사용한 첨부파일이 없습니다.</p>
          )}
          <small>
            생성 당시 첨부파일 목록입니다. 원본 파일 다운로드는 서버 연결 후
            지원할 수 있습니다.
          </small>
        </>
      )}
      <small>생성 당시 자료 · 읽기 전용</small>
    </section>
  );
}
