import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { requestTitle, statusOf, type WorkRequest } from "../domain/types";

export type Material = "html" | "text" | "file";
const materials: {
  id: Material;
  name: string;
  icon: string;
  caption: string;
  detail: string;
}[] = [
  {
    id: "html",
    name: "HTML",
    icon: "html",
    caption: "화면 시안 · 퍼블리싱 파일",
    detail:
      "화면 시안을 그대로 넣어주세요. 화면 속 요구사항을 정리하고, 기존 시스템에서 바꿔야 할 부분을 함께 살펴봅니다.",
  },
  {
    id: "text",
    name: "Teams",
    icon: "teams",
    caption: "채팅 · 요청 메시지",
    detail:
      "Teams로 받은 요청 메시지를 붙여넣으세요. 대화 속 요구사항을 정리하고, 모호한 부분과 변경 범위를 확인합니다.",
  },
  {
    id: "file",
    name: "PPT",
    icon: "ppt",
    caption: "기획서 · 화면 설계서",
    detail:
      "기획서와 화면 설계서를 첨부해주세요. 자료를 바탕으로 요구사항을 정리하고, 협의할 내용을 확인합니다.",
  },
];
const stages: [name: string, detail: string][] = [
  ["틀 고르기", "레거시 선택"],
  ["쇳물 녹이기", "Teams·HTML·PPT를 그대로 입력"],
  ["성분 보기", "요구사항으로 정리해 확인"],
  ["미리 붓기", "레거시와 맞춘 Mock-up 확인"],
  ["탕도 살피기", "화면·로직·API·DB 등 수정 범위를 확인"],
  ["붓기 준비 완료", "합의·공수를 굳히기"],
];
export function Brand() {
  return (
    <Link to="/" className="soetmul-brand" aria-label="쇳물 시작 화면">
      <img
        src={`${import.meta.env.BASE_URL}brand/soetmul.svg`}
        alt=""
        width="76"
        height="76"
      />
      <span>쇳물</span>
    </Link>
  );
}
const icon = (name: string) => `${import.meta.env.BASE_URL}brand/${name}.svg`;
const menuLinks = [
  ["/history", "history", "과거 검토 이력", "과거에 준비를 마친 쇳물 기록"],
  ["/team", "team", "팀 진행 현황", "팀원별 진행 중인 SR"],
  ["/settings/legacy", "settings", "설정", "레거시 틀 관리"],
] as const;
export function BrandNavigation({
  requests,
  start,
}: {
  requests: WorkRequest[];
  start: () => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.key]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <div className="landing-navigation">
      <div
        className={`landing-menu-backdrop ${open ? "open" : ""}`}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <Brand />
      <button
        ref={toggle}
        className={`landing-menu-toggle ${open ? "open" : ""}`}
        aria-label="요청 목록 열기"
        aria-expanded={open}
        aria-controls="landing-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <nav
        id="landing-menu"
        className={`landing-menu ${open ? "open" : ""}`}
        aria-label="작업 메뉴"
      >
        <button className="landing-menu-start" onClick={start}>
          <img src={icon("plus")} alt="" width="13.01" height="12.99" />새
          쇳물 시작
        </button>
        <Link className="landing-menu-label" to="/requests">
          진행 중{requests.length > 0 ? ` · ${requests.length}` : ""}
        </Link>
        {requests.length ? (
          requests.slice(0, 3).map((r) => (
            <Link key={r.id} to={`/requests/${r.id}/input`}>
              <span>
                <strong>{requestTitle(r)}</strong>
                <small>{statusOf(r)}</small>
              </span>
            </Link>
          ))
        ) : (
          <p className="landing-menu-empty">진행 중인 쇳물이 없습니다.</p>
        )}
        <hr />
        {menuLinks.map(([to, name, title, detail]) => (
          <Link key={to} to={to}>
            <img src={icon(name)} alt="" width="18" height="18" />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
export function Landing({
  start,
  requests,
}: {
  start: (materials: Material[]) => void;
  requests: WorkRequest[];
}) {
  const [selected, setSelected] = useState<Material[]>([]);
  return (
    <div className="landing">
      <div className="landing-header">
        <BrandNavigation requests={requests} start={() => start([])} />
      </div>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <h1>
            요구사항을 녹여,
            <br /> 기존 틀에 붓다
          </h1>
          <p>
          Teams 메시지, HTML 화면, PPT 기획서를 그대로 받아,
            <br className="desktop-break" /> 우리 시스템에 맞춘 목업과 수정 범위, 공수까지 한 번에 정리해 드립니다.
          </p>
        </div>
        <div className="landing-why">
          <h2 id="landing-why-title">
            왜 <em>쇳물</em>인가요?
          </h2>
          <p>
          제철소는 쇳물의 성분을 맞춘 뒤, 다음 공정이 바로 제품을 만들 수 있게 넘깁니다.
            <br className="desktop-break" /> <em>쇳물</em>은 이 과정을 빌려 요구사항을 녹여, 기존 틀에 맞는지 미리 부어 보고 개발로 넘깁니다.
          </p>
          <ol className="landing-stages">
            {stages.map(([name, detail], index) => (
              <li
                key={name}
                className={index === stages.length - 1 ? "final" : ""}
              >
                <span aria-hidden="true">{index + 1}</span>
                <strong>{name}</strong>
                <small>{detail}</small>
              </li>
            ))}
          </ol>
          {/* <p className="landing-why-close">
            <em>쇳물</em>은 <mark>붓기 직전까지</mark>를 책임집니다.
          </p> */}
        </div>
      </section>
      <section className="material-selector" aria-labelledby="material-title">
        <h2 id="material-title">요구사항이 어떤 형태로 들어오나요?</h2>
        <div className="material-cards">
          {materials.map((item) => (
            <button
              key={item.id}
              className={`material-card ${selected.includes(item.id) ? "selected" : ""}`}
              aria-pressed={selected.includes(item.id)}
              onClick={() =>
                setSelected((current) =>
                  current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id],
                )
              }
            >
              <span className="material-check" aria-hidden="true">
                {selected.includes(item.id) ? "✓" : ""}
              </span>
              <img
                src={`${import.meta.env.BASE_URL}brand/${item.icon}.svg`}
                alt=""
                width="32"
                height="32"
              />
              <strong>{item.name}</strong>
              <span>{item.caption}</span>
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="material-details">
            {materials
              .filter((item) => selected.includes(item.id))
              .map((item) => (
                <article key={item.id}>
                  <small>{item.name} 자료 입력</small>
                  <h3>{item.caption}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
          </div>
        )}
      </section>
      <div className="landing-cta">
        <button
          className="step-button step-button-primary"
          onClick={() => start(selected)}
        >
          {selected.length
            ? `${selected.length}개의 형태로 시작하기`
            : "시작하기"}{" "}
          ›
        </button>
      </div>
    </div>
  );
}
