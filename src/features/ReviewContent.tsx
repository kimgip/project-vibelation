import { SimilarCaseMap } from "../components/SimilarCaseMap";
import { ImpactGraph } from "../components/ImpactGraph";
import { reviewSummary } from "../domain/reviewSummary";
import { useState } from "react";
import { activeConfirmation, requestTitle, type SimilarCase, type WorkRequest } from "../domain/types";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { LaneBadge, Tag, UnderlineTabs } from "../components/shared";
import { ConfirmedMaterials } from "./ConfirmedMaterials";
import { cases } from "../mocks/download-center";
export function ReviewContent({ r, historical = false, summary, similarCases }: {
  r: WorkRequest; historical?: boolean; summary?: string;
  similarCases?: SimilarCase[];
}) {
  const [tab, setTab] = useState("summary");
  const analysis = r.analysis;
  return <>
    <UnderlineTabs tabs={[{ id: "summary", label: "검토 요약" }, { id: "resources", label: "영향 범위" }, { id: "cases", label: "유사사례" }]} value={tab} onChange={setTab} label="검토 결과" idPrefix="review-" />
    <div className="review-content" role="tabpanel" id={`review-panel-${tab}`} aria-labelledby={`review-tab-${tab}`}>
      {tab === "summary" ? <>
        <h2>{requestTitle(r)}, 붓기 준비를 확인해요</h2>
        <section><h3>합의한 요구사항</h3><MarkdownPreview markdown={historical ? summary || "등록 당시 검토 요약이 없습니다." : reviewSummary(r)} /></section>
        <section><h3>연관 자원</h3><div className="resource-counts">{(["UI", "Logic", "API", "DB", "Permission", "Other"] as const).map(type => <Tag key={type}>{type === "Other" ? "설정·기타" : type === "Permission" ? "권한" : type} {analysis?.impactGraph ? analysis.impactGraph.nodes.filter(n => n.resourceType === type).length : analysis?.impacts.filter(i => i.type === type).length ?? 0}</Tag>)}</div></section>
      </> : tab === "resources" ? (analysis?.impactGraph ? <ImpactGraph graph={analysis.impactGraph} analysisId={analysis.id} /> : <p>등록된 영향도 지도 자료가 없습니다.</p>)
      : <SimilarCaseMap key={analysis?.id || "cases"} title={requestTitle(r)} items={historical ? similarCases || [] : analysis?.source === "server" ? analysis.similarCases || [] : cases} demo={!historical && analysis?.source !== "server"} /> }
      {tab === "cases" && historical && !similarCases?.length && <p>등록 당시 유사사례 자료가 없습니다.</p>}
    </div>
    <ConfirmedMaterials key={activeConfirmation(r)?.id || "none"} confirmation={activeConfirmation(r)} />
  </>;
}
