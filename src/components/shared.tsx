import { useState } from "react";
import { StaticHtmlFrame } from "./StaticHtmlFrame";
import { Download, Search, FileText, Check, Monitor } from "lucide-react";
import { materials } from "../mocks/download-center";
import { downloadMarkdown } from "../utils/downloads";
export function DocumentPanel({
  title,
  markdown,
  revision,
  kind,
}: {
  title: string;
  markdown?: string;
  revision: number;
  kind: string;
}) {
  return (
    <section className="panel document-panel">
      <div className="panel-heading">
        <span>
          <FileText size={16} />
          {kind}
        </span>
        <span className="tag">v{revision}</span>
      </div>
      {markdown ? (
        <>
          <pre>{markdown}</pre>
          <button
            className="text-button"
            onClick={() => downloadMarkdown(title, kind, revision, markdown)}
          >
            <Download size={14} />
            {kind} 다운로드
          </button>
        </>
      ) : (
        <div className="empty">
          아직 문서가 없습니다.
          <br />
          현재 버전으로 구체화를 실행해주세요.
        </div>
      )}
    </section>
  );
}
export function ProductPreview({ applied = false }: { applied?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]),
    [language, setLanguage] = useState("KOR"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("제품 카탈로그"),
    [message, setMessage] = useState("");
  const toggle = (name: string) => {
    setMessage("");
    if (selected.includes(name))
      setSelected(selected.filter((x) => x !== name));
    else if (selected.length >= 10)
      setMessage("최대 10개까지 선택할 수 있습니다.");
    else setSelected([...selected, name]);
  };
  return (
    <div className="product-preview">
      <div className="product-top">
        <b>
          POSCO <span>제품 자료</span>
        </b>
        <small>고객지원 / 다운로드 센터</small>
      </div>
      <div className="product-body">
        <small>CUSTOMER SUPPORT</small>
        <h2>다운로드 센터</h2>
        <p>필요한 제품 자료를 쉽고 빠르게 찾아보세요.</p>
        <div className="mini-tabs" role="tablist" aria-label="자료 종류">
          {["제품 카탈로그", "업무지원자료"].map((c) => (
            <button
              role="tab"
              aria-selected={category === c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
              key={c}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mini-search">
          <Search size={14} />
          <input
            aria-label="자료명 검색"
            placeholder="자료명으로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {applied && (
          <div className="selection-bar">
            <b>선택 자료 {selected.length} / 10</b>
            <select
              aria-label="다운로드 언어"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option>KOR</option>
              <option>ENG</option>
            </select>
            <button
              disabled={!selected.length}
              onClick={() =>
                setMessage(
                  `${selected.length}개 · ${language} ZIP 다운로드 시연입니다. 실제 API는 연결하지 않았습니다.`,
                )
              }
            >
              <Download size={12} />
              선택 다운로드
            </button>
          </div>
        )}
        <div className="material-grid">
          {materials
            .filter(
              (name, index) =>
                name.includes(query) &&
                (category === "제품 카탈로그" ? index < 6 : index >= 6),
            )
            .map((name, index) => (
              <article className="material" key={name}>
                {applied && (
                  <input
                    type="checkbox"
                    aria-label={`${name} 선택`}
                    checked={selected.includes(name)}
                    onChange={() => toggle(name)}
                  />
                )}
                <div className={`cover cover${index % 3}`}>
                  <span>
                    POSCO
                    <br />
                    PRODUCT
                    <br />
                    CATALOG
                  </span>
                  <div />
                  <small>STEEL SOLUTIONS FOR TOMORROW</small>
                </div>
                <b>{name}</b>
                <small>제품 소개 및 기술 자료</small>
                <button
                  className="file-pill"
                  onClick={() =>
                    setMessage(
                      "파일 정보 확인 시연입니다. 실제 파일은 연결하지 않았습니다.",
                    )
                  }
                >
                  PDF · KOR / ENG
                </button>
              </article>
            ))}
        </div>
        {message && (
          <p className="preview-message" role="status">
            {message}
          </p>
        )}
      </div>
      <div className="preview-bottom">
        <span>
          <Monitor size={13} />{" "}
          {applied ? "시스템 적용 제안" : "현업의 원하는 모습"}
        </span>
        <span className="tag blue">신뢰된 샘플 UI</span>
      </div>
    </div>
  );
}
export function HtmlPreview({ html }: { html: string }) {
  // Deliberately display user HTML as inert source text. No user markup is executed or inserted.
  return (
    <div className="html-preview">
      <p className="callout">
        입력 HTML은 실행하지 않습니다. 허용된 기본 요소만 정적으로 표시하며
        스타일·스크립트·외부 통신은 차단합니다.
      </p>
      <StaticHtmlFrame html={html} />
      <details>
        <summary>입력 HTML 원문</summary>
        <pre aria-label="입력 HTML 원문">{html}</pre>
      </details>
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <FileText size={28} />
      <p>{children}</p>
    </div>
  );
}
export function Tag({
  children,
  green = false,
}: {
  children: React.ReactNode;
  green?: boolean;
}) {
  return (
    <span className={`tag ${green ? "green" : "blue"}`}>
      {green && <Check size={11} />} {children}
    </span>
  );
}
