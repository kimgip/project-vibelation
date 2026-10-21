import { reviewSummary } from "../domain/reviewSummary";
import { useState } from "react";
import { activeConfirmation, requestTitle, type WorkRequest } from "../domain/types";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { LaneBadge, Tag, UnderlineTabs } from "../components/shared";
import { ConfirmedMaterials } from "./ConfirmedMaterials";
import { cases } from "../mocks/download-center";
export function ReviewContent({ r, historical = false, summary, similarCases }: {
  r: WorkRequest; historical?: boolean; summary?: string;
  similarCases?: { title: string; reason: string; difference: string }[];
}) {
  const [tab, setTab] = useState("summary");
  const analysis = r.analysis;
  return <>
    <UnderlineTabs tabs={[{ id: "summary", label: "검토 요약" }, { id: "resources", label: "영향 범위" }, { id: "cases", label: "유사사례" }]} value={tab} onChange={setTab} label="검토 결과" idPrefix="review-" />
    <div className="review-content" role="tabpanel" id={`review-panel-${tab}`} aria-labelledby={`review-tab-${tab}`}>
      {tab === "summary" ? <>
        <h2>{requestTitle(r)}, 붓기 준비를 확인해요</h2>
        <section><h3>합의한 요구사항</h3><MarkdownPreview markdown={historical ? summary || "등록 당시 검토 요약이 없습니다." : reviewSummary(r)} /></section>
        <section><h3>손댈 곳</h3><div className="resource-counts">{(["UI", "Logic", "API", "DB", "Permission"] as const).map(type => <Tag key={type}>{type} {analysis?.impacts.filter(i => i.type === type).length ?? 0}</Tag>)}</div></section>
      </> : tab === "resources" ? <div className="table-scroll"><table className="impact-table"><thead><tr><th>자원</th><th>유형</th><th>변경 방향 · 근거</th><th>예상 공수</th></tr></thead><tbody>{analysis?.impacts.map(item => <tr key={item.id}><td>{item.name}<small className="impact-path">{item.path}</small></td><td><LaneBadge type={item.type} compact /></td><td>{item.proposed}<small>{item.reason}</small></td><td>{item.days}일</td></tr>)}</tbody>{!!analysis?.impacts.length && <tfoot><tr><td colSpan={3}>합계</td><td>{Math.round(analysis.impacts.reduce((sum, i) => sum + i.days, 0) * 10) / 10}일</td></tr></tfoot>}</table>{!analysis && <p>분석 자료가 없습니다.</p>}</div>
      : (historical ? similarCases || [] : analysis?.source === "server" ? analysis.similarCases || [] : cases).map(item => <section className="similar-case" key={item.title}><h3>{item.title}</h3><p>{item.reason}</p><small>차이점: {item.difference}</small></section>)}
      {tab === "cases" && historical && !similarCases?.length && <p>등록 당시 유사사례 자료가 없습니다.</p>}
    </div>
    <ConfirmedMaterials key={activeConfirmation(r)?.id || "none"} confirmation={activeConfirmation(r)} />
  </>;
}
