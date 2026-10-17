import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  FileText,
  ChevronRight,
  Download,
  ArrowLeft,
} from "lucide-react";
import { activeConfirmation, type Registration } from "../domain/types";
import { displayDate, downloadMarkdown } from "../utils/downloads";
import { Empty, Tag } from "../components/shared";
export function HistoryPage({
  items,
  id,
}: {
  items: Registration[];
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const detail = id ? items.find((i) => i.id === id) : undefined;
  const filtered = items.filter((i) =>
    i.request.title.toLowerCase().includes(query.toLowerCase()),
  );
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
                  <pre>
                    {
                      activeConfirmation(detail.request)!.documentSnapshot
                        .markdown
                    }
                  </pre>
                  <pre>
                    {JSON.stringify(
                      activeConfirmation(detail.request)!.agreementSnapshot,
                      null,
                      2,
                    )}
                  </pre>
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
            <pre>
              {detail.request.report?.markdown || detail.request.agreement}
            </pre>
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
      <div className="archive-banner">
        <div>
          <span className="section-kicker">KNOWLEDGE ARCHIVE</span>
          <h2>이번의 검토가, 다음의 근거로.</h2>
          <p>확정된 협의와 검토 결과를 찾아 업무에 활용하세요.</p>
        </div>
        <div className="archive-count">
          <b>{items.length}</b>
          <span>누적 검토 리포트</span>
        </div>
      </div>
      <div className="list-toolbar">
        <h3>
          검토 리포트 <span>{filtered.length}</span>
        </h3>
        <label className="search">
          <Search size={15} />
          <input
            aria-label="리포트 제목 검색"
            placeholder="리포트 제목으로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {filtered.length ? (
        <div className="report-list">
          {filtered.map((i) => (
            <Link className="report-row" key={i.id} to={`/history/${i.id}`}>
              <span className="report-icon">
                <FileText size={24} />
              </span>
              <div>
                <Tag green>검토 등록</Tag>
                <h3>{i.request.title}</h3>
                <p>{i.request.text.slice(0, 100)}</p>
                <small>
                  {displayDate(i.registeredAt)} · v{i.request.revision} · 시연용
                  로컬 기록
                </small>
              </div>
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty>
          {query
            ? "검색 결과가 없습니다. 다른 제목으로 검색해주세요."
            : "등록한 검토 리포트가 없습니다. 요청 작업실에서 첫 검토를 완료해주세요."}
        </Empty>
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
export function TeamPage() {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("전체"),
    [selected, setSelected] = useState("");
  const rows = teamRows.filter(
    (r) =>
      r.title.includes(query) && (filter === "전체" || r.status === filter),
  );
  const detail = teamRows.find((r) => r.id === selected);
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>전체 요청</span>
          <strong>4</strong>
          <small>시연 데이터</small>
        </div>
        <div className="stat">
          <span>진행 중</span>
          <strong>3</strong>
          <small>완료 1건 제외</small>
        </div>
        <div className="stat">
          <span>희망일 경과</span>
          <strong>1</strong>
          <small>기준일 2026-10-17</small>
        </div>
        <div className="stat">
          <span>검토 완료</span>
          <strong>1</strong>
          <small>샘플 상태</small>
        </div>
      </div>
      <div className="info-strip">
        읽기 전용 샘플 현황 · 기준일 2026-10-17. 실제 SR·일정·메일은 연결하지
        않았습니다.
      </div>
      <section className="panel">
        <div className="list-toolbar padded">
          <h3>팀 요청 현황</h3>
          <div className="toolbar">
            <label className="search">
              <Search size={14} />
              <input
                aria-label="팀 요청 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="요청 제목 검색"
              />
            </label>
            <select
              aria-label="요청 상태"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["전체", "협의 중", "검토 중", "작업 중", "완료"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>요청</th>
                <th>담당자</th>
                <th>상태</th>
                <th>희망일</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <small>{r.id}</small>
                    <b>{r.title}</b>
                  </td>
                  <td>{r.owner}</td>
                  <td>
                    <Tag green={r.status === "완료"}>{r.status}</Tag>
                  </td>
                  <td>
                    {r.due}
                    {r.due < "2026-10-17" && r.status !== "완료" && (
                      <small className="warning-text">희망일 경과</small>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => setSelected(selected === r.id ? "" : r.id)}
                      aria-expanded={selected === r.id}
                    >
                      상세 보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty>조건에 맞는 요청이 없습니다.</Empty>}
        </div>
      </section>
      {detail && (
        <section className="panel panel-content" aria-label="선택 요청 상세">
          <Tag>{detail.id}</Tag>
          <h2>{detail.title}</h2>
          <p>
            {detail.owner} · {detail.status} · 희망일 {detail.due}
          </p>
          <p>
            표준 공기와 실제 납기 가능성은 업무 달력·인원 정책 확정 후
            검토합니다.
          </p>
          <button onClick={() => setSelected("")}>상세 닫기</button>
        </section>
      )}
    </>
  );
}
