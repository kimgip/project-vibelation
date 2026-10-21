import { createHistoryService } from "../services/history";
import { ReviewContent } from "./ReviewContent";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import {
  activeConfirmation,
  appliedDocument,
  requestTitle,
  type Registration,
} from "../domain/types";
import { DEMO_LEGACY } from "../domain/legacySources";
import { legacyRepository } from "../storage/legacySources";
import { ScreenTitle } from "../components/WorkflowShell";
import { displayDate, dotDate, downloadRequirement } from "../utils/downloads";
import { Empty, LaneBadge, Tag } from "../components/shared";
export function HistoryPage({ items, id }: { items: Registration[]; id?: string }) {
  const [result, setResult] = useState<{items: Registration[]; id?: string; source: Registration[]} | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const service = createHistoryService(items);
    setError("");
    setResult(null);
    const operation = id ? service.get(id, controller.signal).then(item => item ? [item] : []) : service.list(controller.signal).then(page => page.items);
    operation.then(rows => { if (!controller.signal.aborted) setResult({items: rows, id, source: items}); }).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "이력을 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [items, id, retry]);
  if (error) return <div role="alert">{error}<button onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></div>;
  if (!result || result.id !== id || result.source !== items) return <p role="status">검토 이력을 불러오는 중입니다…</p>;
  return <HistoryContent key={id || "list"} items={result.items} id={id} />;
}
const laneOrder = ["UI", "Logic", "API", "DB", "Permission"] as const;
/** 틀 id → display name: built-in demo plus ZIP references saved in this browser. */
function useLegacyNames() {
  const [names, setNames] = useState<Record<string, string>>({
    [DEMO_LEGACY.id]: DEMO_LEGACY.name,
  });
  useEffect(() => {
    let cancelled = false;
    legacyRepository
      .references()
      .then((rows) => {
        if (!cancelled)
          setNames((current) => ({
            ...current,
            ...Object.fromEntries(rows.map((ref) => [ref.id, ref.name])),
          }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return names;
}
function HistoryContent({
  items,
  id,
}: {
  items: Registration[];
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const legacyNames = useLegacyNames();
  const detail = id ? items.find((i) => i.id === id) : undefined;
  const needle = query.trim().toLowerCase();
  const filtered = items
    .map((item) => ({
      item,
      legacy:
        legacyNames[item.request.legacyVersion] || item.request.legacyVersion,
    }))
    .filter(
      ({ item, legacy }) =>
        !needle ||
        [requestTitle(item.request), legacy].some((text) =>
          text.toLowerCase().includes(needle),
        ),
    )
    .sort((a, b) => b.item.registeredAt.localeCompare(a.item.registeredAt));
  if (id)
    return detail ? (
      <>
        <Link className="back-link" to="/history">
          <ArrowLeft size={14} />
          리포트 목록
        </Link>
        <ScreenTitle title={detail.request.title || "과거 검토 이력"} description={`${displayDate(detail.registeredAt)} 등록`} />
        <ReviewContent r={detail.request} historical summary={detail.reviewSummarySnapshot} similarCases={detail.similarCasesSnapshot} />
        <div className="document-actions">
          <button onClick={() => { document.querySelector<HTMLElement>(".confirmed-materials")?.focus(); document.querySelector(".confirmed-materials")?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>현업 요구사항 다운로드</button>
          <button disabled={!activeConfirmation(detail.request)} onClick={() => { const c = activeConfirmation(detail.request); if (c) downloadRequirement(c.documentSnapshot); }}>확정 요구사항 MD 다운로드</button>
        </div>
      </>
    ) : (
      <Empty>
        해당 이력을 찾을 수 없습니다. 리포트 목록에서 다시 선택해주세요.
      </Empty>
    );
  return (
    <>
      <ScreenTitle
        title="[검토 이력]"
        description="붓기 준비를 마친 요청이 모여 있어요. 비슷한 요청이 오면 지난 검토의 영향 범위를 참고하세요."
      />
      <div className="history-toolbar">
        <h2>
          검토 이력 <span>{filtered.length}건</span>
        </h2>
        <label className="history-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="검토 이력 검색"
            placeholder="제목이나 시스템으로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {filtered.length ? (
        <div className="history-cards">
          {filtered.map(({ item, legacy }) => {
            const r = item.request;
            const doc = appliedDocument(r);
            const impacts = r.analysis?.impacts || [];
            const lanes = laneOrder.filter((lane) =>
              (r.analysis?.impactGraph?.nodes || impacts).some((i) => ("resourceType" in i ? i.resourceType : i.type) === lane),
            );
            const meta = [
              legacy,
              doc && `협의 기준 ${doc.generationNumber}차안`,
              dotDate(item.registeredAt),
            ].filter(Boolean);
            return (
              <Link
                className="history-card"
                key={item.id}
                to={`/history/${item.id}`}
              >
                <span className="history-card-title">
                  {requestTitle(r)}
                  <ChevronRight size={18} aria-hidden="true" />
                </span>
                <span className="history-card-meta">{meta.join(" · ")}</span>
                {(lanes.length > 0 || impacts.length > 0) && (
                  <span className="history-card-scope">
                    <span className="history-card-lanes">
                      {lanes.map((lane) => (
                        <LaneBadge key={lane} type={lane} compact />
                      ))}
                    </span>

                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="history-empty">
          {query
            ? `'${query}'와 맞는 검토 이력이 없어요.`
            : "아직 검토 이력이 없어요. 붓기 준비 완료에서 이력에 등록하면 여기에 모여요."}
        </p>
      )}
    </>
  );
}
