import { useState } from "react";
import { Link } from "react-router-dom";

export type Material = "html" | "text" | "file";
const materials: { id: Material; name: string; icon: string; caption: string; detail: string }[] = [
  { id: "html", name: "HTML", icon: "html", caption: "화면 시안 · 퍼블리싱 파일", detail: "화면 시안을 그대로 넣어주세요. 화면 속 요구사항을 정리하고, 기존 시스템에서 바꿔야 할 부분을 함께 살펴봅니다." },
  { id: "text", name: "Teams", icon: "teams", caption: "채팅 · 요청 메시지", detail: "Teams로 받은 요청 메시지를 붙여넣으세요. 대화 속 요구사항을 정리하고, 모호한 부분과 변경 범위를 확인합니다." },
  { id: "file", name: "PPT", icon: "ppt", caption: "기획서 · 화면 설계서", detail: "기획서와 화면 설계서를 첨부해주세요. 자료를 바탕으로 요구사항을 정리하고, 협의할 내용을 확인합니다." },
];
export function Brand({ menu = false }: { menu?: boolean }) {
  return <Link to="/" className={`soetmul-brand ${menu ? "brand-menu" : ""}`} aria-label="쇳물 시작 화면">
    <img src={`${import.meta.env.BASE_URL}brand/soetmul.svg`} alt="" width="76" height="76" />
    <span>쇳물</span>
    {menu && <img className="brand-chevron" src={`${import.meta.env.BASE_URL}brand/chevron.svg`} alt="" width="14" height="14" />}
  </Link>;
}
export function Landing({ start, count }: { start: (materials: Material[]) => void; count: number }) {
  const [selected, setSelected] = useState<Material[]>([]);
  return <div className="landing">
    <div className="landing-header"><Brand menu /><nav aria-label="작업 메뉴"><Link to="/requests">요청 작업실{count > 0 ? ` · ${count}` : ""}</Link><Link to="/history">검토 이력</Link></nav></div>
    <section className="landing-hero"><h1>요구사항을 녹여,<br /> 기존 틀에 붓다</h1><p>HTML 화면 시안, Teams 메시지, PPT 기획서 — 현업이 보내는 그대로 받아,<br className="desktop-break" /> 레거시 시스템 어디를 어떻게 고쳐야 하는지 개발 언어로 바꿔 드립니다.</p></section>
    <section className="material-selector" aria-labelledby="material-title"><h2 id="material-title">요구사항이 어떤 형태로 들어오나요?</h2><div className="material-cards">
      {materials.map(item => <button key={item.id} className={`material-card ${selected.includes(item.id) ? "selected" : ""}`} aria-pressed={selected.includes(item.id)} onClick={() => setSelected(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}>
        <span className="material-check" aria-hidden="true">{selected.includes(item.id) ? "✓" : ""}</span><img src={`${import.meta.env.BASE_URL}brand/${item.icon}.svg`} alt="" width="32" height="32" /><strong>{item.name}</strong><span>{item.caption}</span>
      </button>)}
    </div>{selected.length > 0 && <div className="material-details">{materials.filter(item => selected.includes(item.id)).map(item => <article key={item.id}><small>{item.name} 자료 입력</small><h3>{item.caption}</h3><p>{item.detail}</p></article>)}</div>}</section>
    <div className="landing-cta"><button className="primary" onClick={() => start(selected)}>{selected.length ? `${selected.length}개의 형태로 시작하기` : "시작하기"} &gt;</button></div>
  </div>;
}
