import { createMockHistoryService } from "../services/history";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Download,
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
import { displayDate, dotDate, downloadMarkdown } from "../utils/downloads";
import { Empty, LaneBadge, Tag } from "../components/shared";
export function HistoryPage({ items, id }: { items: Registration[]; id?: string }) {
  const [result, setResult] = useState<{items: Registration[]; id?: string; source: Registration[]} | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const service = createMockHistoryService(items);
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
        <section className="panel">
          <div className="report-heading">
            <Tag green>등록 스냅샷</Tag>
            <h2>{detail.request.title}</h2>
            <p>
              {displayDate(detail.registeredAt)} · 요구사항 v
              {detail.request.revision} · {detail.request.legacyVersion}
            </p>
          </div>
          <div className="panel-content confirmation-summary">
            {activeConfirmation(detail.request) ? (
              <>
                <b>
                  요구사항 확정 v{activeConfirmation(detail.request)!.version}
                </b>
                <p>
                  MD 생성{" "}
                  {
                    activeConfirmation(detail.request)!.documentSnapshot
                      .generationNumber
                  }{" "}
                  ·{" "}
                  {activeConfirmation(detail.request)!.mockSnapshot
                    ? `Mock 포함 / ${activeConfirmation(detail.request)!.mockReviewed ? "확인 완료" : "미확인"}`
                    : "Mock 없음"}
                </p>
                <details>
                  <summary>당시 확정 문서와 협의 내용</summary>
                  <MarkdownPreview markdown={activeConfirmation(detail.request)!.documentSnapshot.markdown} />
                  {Object.entries(activeConfirmation(detail.request)!.agreementSnapshot).filter(([, value]) => value.trim()).map(([key, value]) => (
                    <div key={key}><h4>{{scope: "합의 범위", acceptanceCriteria: "수용 기준", exclusions: "제외 범위", unresolvedItems: "미확정 사항"}[key]}</h4><MarkdownPreview markdown={value} /></div>
                  ))}
                </details>
              </>
            ) : (
              <p>
                이전 4단계 흐름의 등록 이력입니다. 새 흐름의 요구사항 확정을
                소급 생성하지 않았습니다.
              </p>
            )}
          </div>
          <div className="report-body">
            <MarkdownPreview markdown={detail.request.report?.markdown || detail.request.agreement} />
            <button
              onClick={() =>
                downloadMarkdown(
                  detail.request.title,
                  "검토리포트",
                  detail.request.revision,
                  detail.request.report?.markdown || detail.request.agreement,
                )
              }
            >
              <Download size={14} />
              리포트 다운로드
            </button>
          </div>
        </section>
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
        description="붓기 준비를 마친 요청이 모여 있어요. 비슷한 요청이 오면 지난 검토의 범위와 공수를 참고하세요."
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
              impacts.some((i) => i.type === lane),
            );
            const total =
              Math.round(impacts.reduce((sum, i) => sum + i.days, 0) * 10) /
              10;
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
                    {impacts.length > 0 && <b>총 {total}일</b>}
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
const teamRows = [
  {
    id: "SR-2026-101",
    title: "다운로드 센터 다중 선택 개선",
    owner: "김운영",
    status: "협의 중",
    due: "2026-10-20",
  },
  {
    id: "SR-2026-102",
    title: "고객 문의 접수 데이터 추출",
    owner: "박개발",
    status: "검토 중",
    due: "2026-10-16",
  },
  {
    id: "SR-2026-103",
    title: "자료 상세 안내 개선",
    owner: "김운영",
    status: "완료",
    due: "2026-10-15",
  },
  {
    id: "SR-2026-104",
    title: "고객사 통합 검색조건 추가",
    owner: "이개발",
    status: "작업 중",
    due: "2026-10-28",
  },
];
const TEAM_BASE_DATE = "2026-10-17";
type TeamRow = (typeof teamRows)[number];
const isDone = (r: TeamRow) => r.status === "완료";
const isOverdue = (r: TeamRow) => r.due < TEAM_BASE_DATE && !isDone(r);
const teamFilters = [
  { id: "all", label: "전체", match: () => true },
  { id: "active", label: "진행 중", match: (r: TeamRow) => !isDone(r) },
  { id: "overdue", label: "희망일 경과", match: isOverdue },
  { id: "done", label: "완료", match: isDone },
] as const;
type TeamFilter = (typeof teamFilters)[number]["id"];
export function TeamPage({ history }: { history: Registration[] }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState<TeamFilter>("all"),
    [expanded, setExpanded] = useState("");
  // 검토 이력(샘플 포함)에서 같은 제목의 리포트를 찾아 "검토 이력 보기"를 연결한다.
  const [reports, setReports] = useState<Registration[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    createMockHistoryService(history)
      .list(controller.signal)
      .then((page) => setReports(page.items))
      .catch(() => {});
    return () => controller.abort();
  }, [history]);
  const active = teamFilters.find((f) => f.id === filter)!;
  const needle = query.trim().toLowerCase();
  const rows = teamRows.filter(
    (r) =>
      active.match(r) &&
      (!needle ||
        [r.title, r.id, r.owner].some((t) => t.toLowerCase().includes(needle))),
  );
  const toggle = (id: string) => setExpanded((cur) => (cur === id ? "" : id));
  return (
    <>
      <ScreenTitle
        title="[팀 진행 현황]"
        description="팀원들이 진행 중인 SR 요청과 희망일을 한눈에 확인해요."
      />
      <div className="team-stats">
        {teamFilters.map((f) => {
          const count = teamRows.filter(f.match).length;
          const pressed = f.id !== "all" && filter === f.id;
          return (
            <button
              key={f.id}
              className={`team-stat ${pressed ? "selected" : ""}`}
              aria-pressed={pressed}
              onClick={() => setFilter(pressed || f.id === "all" ? "all" : f.id)}
            >
              <span>{f.label}</span>
              <strong
                className={f.id === "overdue" && count > 0 ? "warning" : ""}
              >
                {count}
              </strong>
              {f.id === "overdue" && (
                <small>
                  기준일 {TEAM_BASE_DATE.slice(5).replace("-", "/")}
                </small>
              )}
            </button>
          );
        })}
      </div>
      <div className="history-toolbar">
        <h2>
          {filter === "all" ? "요청" : active.label} {rows.length}건
        </h2>
        <label className="history-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="팀 요청 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="요청 제목이나 담당자로 검색"
          />
        </label>
      </div>
      <div className="table-scroll">
        <table className="team-table">
          <colgroup>
            <col style={{ width: "46%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>요청</th>
              <th>담당자</th>
              <th>상태</th>
              <th>희망일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const open = expanded === r.id;
              const report = reports.find((x) => x.request.title === r.title);
              return (
                <Fragment key={r.id}>
                  <tr
                    className={open ? "expanded" : ""}
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggle(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(r.id);
                      }
                    }}
                  >
                    <td>
                      <span className="team-title">{r.title}</span>
                      <small>{r.id}</small>
                    </td>
                    <td className="team-muted">{r.owner}</td>
                    <td>
                      <span
                        className={`team-status ${isDone(r) ? "done" : ""}`}
                      >
                        {isDone(r) ? (
                          <span aria-hidden="true">✓</span>
                        ) : (
                          <i aria-hidden="true" />
                        )}
                        {r.status}
                      </span>
                    </td>
                    <td className="team-muted">
                      <span className="team-due">
                        <span>
                          {r.due}
                          {isOverdue(r) && (
                            <em className="team-overdue">경과</em>
                          )}
                        </span>
                        <ChevronDown
                          size={16}
                          className="team-chevron"
                          aria-hidden="true"
                        />
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr className="team-detail">
                      <td colSpan={4}>
                        <div>
                          <div className="team-detail-body">
                            <small>{r.id}</small>
                            <strong>{r.title}</strong>
                            <span>
                              {r.owner} · {r.status} · 희망일 {r.due}
                            </span>
                            <p>
                              표준 공기와 실제 납기 가능성은 업무 달력·인원
                              정책 확정 후 검토합니다.
                            </p>
                          </div>
                          {report && (
                            <Link
                              to={`/history/${report.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              검토 이력 보기 ›
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="history-empty">조건에 맞는 요청이 없어요.</p>
        )}
      </div>
    </>
  );
}
