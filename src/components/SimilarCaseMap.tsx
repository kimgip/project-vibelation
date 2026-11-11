import { useId, useState } from "react";
import type { SimilarCase } from "../domain/types";
import "./similar-case-map.css";

const colors = { business: "#a67af1", resource: "#6fc79b" };
const CURRENT_COLOR = "#f3a46e";
const resourceColors: Record<string, string> = { UI: "#79a6da", Logic: "#d4a56b", API: "#77c8b3", DB: "#c89bdc", Permission: "#d48d85" };
const scoreValid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
const eligible = (n: unknown) => scoreValid(n) && n >= .6;

export function SimilarCaseMap({ title, items }: { title: string; items: SimilarCase[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const uid = useId().replace(/:/g, "");
  const valid = items.filter(c => typeof c.title === "string" && typeof c.reason === "string");
  const withIds = valid.map((c, index) => ({ ...c, key: c.historyId || `legacy-${index}` }));
  const perspectives = (["business", "resource"] as const).map(type => ({ type, cases: withIds.filter(c => eligible(c[type])).sort((a, b) => (b[type] as number) - (a[type] as number) || (b.registeredAt || "").localeCompare(a.registeredAt || "") || a.key.localeCompare(b.key)).slice(0, 10) }));
  const visible = new Set(perspectives.flatMap(p => p.cases.map(c => c.key)));
  const list = withIds.filter(c => visible.has(c.key)).sort((a, b) => Math.max(b.business || 0, b.resource || 0) - Math.max(a.business || 0, a.resource || 0));
  const scored = withIds.some(c => scoreValid(c.business) || scoreValid(c.resource));
  if (!scored) return <div className="similar-map"><p>관계 지도에 필요한 유사도 자료가 없습니다.</p>{valid.map((c, i) => <section className="similar-case" key={i}><h3>{c.title}</h3><p>{c.reason}</p><small>차이점: {c.difference}</small></section>)}</div>;
  return <div className="similar-map">
    <header className="sc-heading"><div><h2>과거 개선 이력 관계 지도</h2><p>현재 개선건을 기준으로 업무 요구사항과 검토 자원의 연관성을 각각 탐색합니다.</p></div></header>
    <div className="sc-workspace"><div className="sc-graphcard"><div className="sc-toolbar"><strong>관점별 독립 선별</strong><div className="sc-legend"><span style={{ color: CURRENT_COLOR }}>● 현재 개선건</span><span style={{ color: colors.business }}>● 비즈니스 유사</span><span style={{ color: colors.resource }}>● 자원 유사</span></div></div>
      <svg className="sc-svg" viewBox="0 0 950 570" role="group" aria-label="유사사례 관계 지도">
        <defs>{([['orange', '#f3a46e'], ['business', colors.business], ['resource', colors.resource]]).map(([name, color]) => <radialGradient id={`${uid}-${name}`} key={name}><stop offset="0%" stopColor={color} stopOpacity=".96" /><stop offset="100%" stopColor={color} stopOpacity=".62" /></radialGradient>)}</defs>
        {perspectives.map(({ type, cases }) => <g key={type}>
          <ellipse cx={type === "business" ? 237 : 714} cy="289" rx="215" ry="249" fill={colors[type]} fillOpacity=".025" stroke={colors[type]} strokeOpacity=".18" strokeDasharray="2 9" />
          <text x={type === "business" ? 237 : 714} y="32" textAnchor="middle" fill={colors[type]} fontSize="13" fontWeight="700">{type === "business" ? "BUSINESS SIMILARITY" : "RESOURCE SIMILARITY"}</text>
          {cases.map((c, index) => {
            const x = cases.length <= 2 ? (type === "business" ? 303 : 646) : (type === "business" ? 130 : 610) + (index % 2) * 155;
            const y = cases.length === 1 ? 285 : cases.length <= 2 ? 150 + index * 220 : 115 + Math.floor(index / 2) * (350 / Math.max(1, Math.ceil(cases.length / 2) - 1));
            const score = c[type] as number, radius = 7 + Math.pow(score, 2.15) * 33;
            const dim = selected !== null && selected !== c.key;
            return <g key={c.key} opacity={dim ? .16 : 1}>
              <path d={`M475,285 Q${(475 + x) / 2},${(285 + y) / 2 - 12} ${x},${y}`} fill="none" stroke={colors[type]} strokeWidth={selected === c.key ? 2 : 1} opacity={selected === c.key ? .85 : .35} />
              {(c.resources || []).slice(0, 5).map((r, j, resources) => {
                const angle = (type === "business" ? Math.PI : 0) - 1.05 + j * 2.1 / Math.max(1, resources.length - 1);
                const nx = x + Math.cos(angle) * (radius + 36), ny = y + Math.sin(angle) * (radius + 36);
                return <g key={j} aria-hidden="true"><path d={`M${x},${y} L${nx},${ny}`} stroke={colors[type]} opacity=".35" /><circle cx={nx} cy={ny} r="5" fill={resourceColors[r.kind] || "#aaa"}><title>{r.name}</title></circle></g>;
              })}
              <g className="sc-node" role="button" tabIndex={0} aria-pressed={selected === c.key} aria-label={`${c.title} ${type === "business" ? "비즈니스" : "자원"} 유사`} onClick={() => setSelected(c.key)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c.key); } }}>
                <circle cx={x} cy={y} r={radius + 9} fill={colors[type]} opacity=".10" />
                <circle className="sc-main" cx={x} cy={y} r={radius} fill={`url(#${uid}-${type})`} opacity={.13 + .87 * Math.pow(score, 1.45)} stroke={selected === c.key ? "#fff" : colors[type]} strokeWidth={selected === c.key ? 3 : 1.5} />
                <text x={x} y={y + radius + 18} textAnchor="middle" fill="#ded3c9" fontSize="10">{c.title.length > 17 ? `${c.title.slice(0, 16)}…` : c.title}</text>
              </g>
            </g>;
          })}
        </g>)}
        <g><circle className="sc-halo" cx="475" cy="285" r="70" fill="#ed9358" fillOpacity=".08" stroke="#ed9358" strokeOpacity=".3" /><circle cx="475" cy="285" r="49" fill={`url(#${uid}-orange)`} stroke="#ffd2aa" strokeWidth="3" /><text x="475" y="281" textAnchor="middle" fill="#24170e" fontSize="16" fontWeight="800">현재 개선건</text><text x="475" y="301" textAnchor="middle" fill="#24170e" fontSize="10">분석 기준</text><title>{title}</title></g>
      </svg>
      <div className="sc-footer"><span>크기·색 농도 = 관점별 유사도</span><button type="button" onClick={() => setSelected(null)}>선택 초기화</button></div>
    </div><div className="sc-side"><h3>유사 개선 이력</h3><p>비즈니스·자원 관점을 각각 선별합니다.</p>{list.length === 0 && <p>기준을 통과한 유사사례가 없습니다.</p>}{list.map(c => <button type="button" key={c.key} className={`sc-case ${selected === c.key ? 'selected' : ''}`} aria-pressed={selected === c.key} onClick={() => setSelected(c.key)}><strong>{c.title}</strong><small>{c.registeredAt || '등록일 미보유'}</small><span className="sc-pills">{(["business", "resource"] as const).filter(type => eligible(c[type])).map(type => <span key={type} style={{ color: colors[type] }}>{type === 'business' ? '비즈니스' : '자원'} 유사</span>)}</span><span className="sc-kinds">{[...new Set((c.resources || []).map(r => r.kind))].join(' · ')}</span></button>)}</div></div>
  </div>;
}
