import { Fragment, useState } from "react";
import {
  Sparkles,
  Download,
  FileText,
  ChevronRight,
  Network,
  CheckCircle2,
} from "lucide-react";
import {
  isCurrent,
  hasAppliedRequirement,
  readyForReview,
  canRegister,
  type WorkRequest,
} from "../domain/types";
import { cases } from "../mocks/download-center";
import { agreementMarkdown } from "../services/contract";
import { downloadMarkdown } from "../utils/downloads";
import { ProductPreview, Empty, Tag } from "../components/shared";
export interface WorkspaceProps {
  r: WorkRequest;
  update: (change: (latest: WorkRequest) => WorkRequest) => void;
  edit: (patch: Partial<WorkRequest>) => void;
  check: (patch: Partial<WorkRequest>) => void;
  run: (kind: "analysis" | "systemMock" | "report") => void;
  busy: string;
  go: (step: string) => void;
  register: () => void;
  saved: boolean;
}
export { InputPage } from "./RequestInput";
function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-caption">
      <div>
        <span className="section-kicker">STEP {number}</span>
        <h2>{title}</h2>
      </div>
      <small>{description}</small>
    </div>
  );
}
export function AnalysisPage({ r, edit, run, busy }: WorkspaceProps) {
  const [selected, setSelected] = useState("ui");
  const resources = r.analysis?.impacts || [];
  const item = resources.find((i) => i.id === selected) || resources[0];
  return (
    <>
      <SectionTitle
        number="02"
        title="소스에서 찾는 변경의 근거"
        description="수정할 자원과 확인할 조건을 함께 살펴봅니다."
      />
      <div className="info-strip">
        <Network size={17} />
        <span>
          다운로드 센터 고정 시나리오 · 경로는 예시이며 실제 소스를 분석하지
          않았습니다.
        </span>
        <button
          className="primary"
          disabled={!!busy || !hasAppliedRequirement(r)}
          onClick={() => run("analysis")}
        >
          <Sparkles size={14} />
          {busy === "analysis" ? "분석 중…" : "레거시 분석"}
        </button>
      </div>
      {item ? (
        <div className="analysis-grid">
          <section className="panel">
            <div className="panel-heading">
              <span>수정 · 검토 자원</span>
              <Tag>{resources.length}개 후보</Tag>
            </div>
            {resources.map((i) => (
              <button
                className={`resource ${item.id === i.id ? "selected" : ""}`}
                key={i.id}
                onClick={() => setSelected(i.id)}
              >
                <span className={`type-icon type-${i.type}`}>{i.type}</span>
                <span>
                  <b>{i.name}</b>
                  <small>{i.path}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span>{item.name}</span>
              <Tag>변경 제안 · 미적용</Tag>
            </div>
            <div className="resource-detail">
              <code>{item.path}</code>
              <div className="diff before">
                <b>현재 구조 · 시연 가정</b>
                <p>{item.current}</p>
              </div>
              <div className="diff after">
                <b>변경 방향</b>
                <p>{item.proposed}</p>
              </div>
              <h3>연결 근거</h3>
              <p>{item.reason}</p>
              <p>
                출처: 다운로드 센터 샘플 자원 ·{" "}
                {r.analysis?.basis.legacyVersion}
              </p>
              <Tag>잠정 공수 {item.days}일</Tag>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span>담당자 검토 필요</span>
            </div>
            <div className="panel-content">
              <h3>기존 상세 모달 재사용 범위</h3>
              <p>
                다중 선택 결과와 오류 안내를 기존 모달로 표현할 수 있는지
                확인합니다.
              </p>
              <h3>ZIP 생성과 권한 검증</h3>
              <p>
                최대 용량, 일부 파일 누락, 파일 접근 권한의 서버 검증 정책이
                필요합니다.
              </p>
              <label htmlFor="opinion">검토 의견</label>
              <textarea
                id="opinion"
                value={r.opinion}
                maxLength={4000}
                placeholder="추가 확인할 내용을 기록해주세요."
                onChange={(e) => edit({ opinion: e.target.value })}
              />
              <small>의견을 수정하면 현재 버전으로 다시 분석해야 합니다.</small>
            </div>
          </section>
          <section className="panel impact-map">
            <div className="panel-heading">
              <span>자원 연결 예시</span>
              <Tag>실제 호출 관계 미확인</Tag>
            </div>
            <div className="impact-nodes" aria-label="시연용 영향 자원 연결">
              {resources.map((resource, index) => (
                <Fragment key={resource.id}>
                  {index > 0 && <ChevronRight size={16} aria-hidden="true" />}
                  <button
                    aria-pressed={item.id === resource.id}
                    onClick={() => setSelected(resource.id)}
                  >
                    <span className={`type-icon type-${resource.type}`}>
                      {resource.type}
                    </span>
                    <b>{resource.name}</b>
                  </button>
                </Fragment>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <Empty>
          현재 입력 기준의 요구사항 MD를 생성·적용한 뒤 레거시 분석을
          실행해주세요.
        </Empty>
      )}
    </>
  );
}
export function AgreementPage({ r, edit, run, busy }: WorkspaceProps) {
  const [tab, setTab] = useState("system");
  return (
    <>
      <SectionTitle
        number="03"
        title="같은 화면을 보며 맞추는 구현 방향"
        description="원하는 모습과 시스템 제약을 함께 반영합니다."
      />
      <div className="mock-grid">
        <section className="panel">
          <div className="panel-heading">
            <span>화면으로 협의</span>
            <button
              className="primary"
              disabled={!!busy || !isCurrent(r, r.analysis)}
              onClick={() => run("systemMock")}
            >
              <Sparkles size={14} />
              {busy === "systemMock" ? "생성 중…" : "시스템 Mock 생성"}
            </button>
          </div>
          <div className="preview-toolbar">
            <button
              aria-pressed={tab === "original"}
              className={tab === "original" ? "selected" : ""}
              onClick={() => setTab("original")}
            >
              원하는 화면
            </button>
            <button
              aria-pressed={tab === "system"}
              className={tab === "system" ? "selected" : ""}
              onClick={() => setTab("system")}
            >
              시스템 적용 제안
            </button>
            <span className="tag">
              {isCurrent(r, r.systemMock)
                ? `현재 버전 v${r.revision}`
                : "생성 전 · 시연 예시"}
            </span>
          </div>
          <ProductPreview key={tab} applied={tab === "system"} />
          <p className="panel-note">
            공통 색상·버튼 스타일을 반영한 샘플입니다. 실제 시스템 적용
            전입니다.
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span>화면 협의 노트</span>
            <Tag>협의 v{r.revision}</Tag>
          </div>
          <div className="panel-content">
            <div className="note">
              <span className="avatar">김</span>
              <div>
                <b>
                  운영 담당자 <small>시연 메모</small>
                </b>
                <p>
                  선택 다운로드는 목록 상단에 배치하면 선택 상태를 확인하기
                  좋겠습니다.
                </p>
              </div>
            </div>
            <label htmlFor="agreement">이번 버전 협의사항 · 수용 기준</label>
            <textarea
              id="agreement"
              className="agreement-input"
              maxLength={8000}
              value={r.agreement}
              onChange={(e) => edit({ agreement: e.target.value })}
              placeholder="합의 범위·제외 범위·수용 기준·남은 위험을 적어주세요."
            />
            <div className="callout">
              요구사항이나 의견을 수정하면 이전 분석과 Mock은 재검토 대상으로
              표시됩니다.
            </div>
            <button
              disabled={!r.agreement.trim()}
              onClick={() =>
                downloadMarkdown(
                  r.title,
                  "협의사항",
                  r.revision,
                  agreementMarkdown(r),
                )
              }
            >
              <Download size={14} />
              협의 MD 다운로드
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
export function ReviewPage({
  r,
  run,
  busy,
  register,
  saved,
  check,
}: WorkspaceProps) {
  const [tab, setTab] = useState("summary");
  const reportCurrent = isCurrent(r, r.report);
  return (
    <>
      <SectionTitle
        number="04"
        title="함께 정한 결론을 다음 경험으로"
        description="최종 검토 후 이력에 등록합니다."
      />
      <div className="info-strip">
        <FileText size={17} />
        <span>등록한 리포트는 당시 버전의 기록으로 보관됩니다.</span>
        <button
          className="primary"
          disabled={!!busy || !readyForReview(r)}
          onClick={() => run("report")}
        >
          {busy === "report" ? "리포트 생성 중…" : "검토 리포트 생성"}
        </button>
      </div>
      <section className="panel">
        <div className="report-heading">
          <Tag>검토 리포트 · {reportCurrent ? "현재 버전" : "갱신 필요"}</Tag>
          <h2>{r.title || "새 개선 요청"}</h2>
          <p>
            요구사항 v{r.revision} · {r.legacyVersion} · 실제 AI 분석 미연결
          </p>
        </div>
        <div className="report-tabs" role="tablist" aria-label="리포트 내용">
          {[
            ["summary", "검토 요약"],
            ["resources", "영향 자원"],
            ["cases", "유사 사례"],
            ["report", "리포트 원문"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="report-body">
          {tab === "summary" ? (
            <>
              <div className="report-stats">
                <Stat
                  label="영향 후보"
                  value={String(r.analysis?.impacts.length || 0)}
                  unit="개 자원"
                />
                <Stat
                  label="예상 전체 공수"
                  value={String(r.analysis?.totalDays || "—")}
                  unit="일 · 기준시간 미확정"
                />
                <Stat
                  label="예상 작업 기간"
                  value={String(r.analysis?.durationDays || "—")}
                  unit="근무일 · 시연 가정"
                />
                <Stat
                  label="일정 버퍼"
                  value={String(r.analysis?.bufferDays || "—")}
                  unit="근무일"
                />
              </div>
              <div className="report-columns">
                <div>
                  <h3>확정할 협의 내용</h3>
                  <p className="preserve">
                    {r.agreement || "협의사항을 먼저 입력해주세요."}
                  </p>
                </div>
                <div>
                  <h3>산정 가정과 남은 확인사항</h3>
                  <p>
                    자원 작업 7.5일 + 통합 검증 1일 = 예상 8.5일. 1인 순차
                    작업의 예시 기간 9근무일 + 버퍼 2근무일입니다.
                  </p>
                  <p>
                    실제 공수·과거 실적은 미연결이며, 시작일·휴일·인력 달력
                    미적용으로 희망일 충족 여부는 판단하지 않습니다.
                  </p>
                </div>
              </div>
            </>
          ) : tab === "resources" ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>자원</th>
                    <th>유형</th>
                    <th>변경 방향·근거</th>
                    <th>예상 공수</th>
                  </tr>
                </thead>
                <tbody>
                  {r.analysis?.impacts.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td>
                        <Tag>{i.type}</Tag>
                      </td>
                      <td>
                        {i.proposed}
                        <small>{i.reason}</small>
                      </td>
                      <td>{i.days}일</td>
                    </tr>
                  ))}
                  <tr>
                    <td>통합 검증</td>
                    <td>공통</td>
                    <td>연결 동작·실패 처리 확인</td>
                    <td>1일</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : tab === "cases" ? (
            cases.map((c) => (
              <div className="similar-case" key={c.title}>
                <Tag>시연용 사례</Tag>
                <h3>{c.title}</h3>
                <p>{c.reason}</p>
                <small>차이점: {c.difference}</small>
              </div>
            ))
          ) : r.report ? (
            <>
              <pre>{r.report.markdown}</pre>
              <button
                onClick={() =>
                  downloadMarkdown(
                    r.title,
                    "검토리포트",
                    r.report!.basis.revision,
                    r.report!.markdown,
                  )
                }
              >
                <Download size={14} />
                리포트 다운로드
              </button>
            </>
          ) : (
            <Empty>최신 버전의 검토 리포트를 생성해주세요.</Empty>
          )}
        </div>
      </section>
      <section className="panel confirm-panel">
        <div>
          <CheckCircle2 size={22} />
          <h3>최종 검토 확인</h3>
          <p>두 가지 검토를 마치고 현재 버전의 리포트를 등록합니다.</p>
        </div>
        <div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={r.scopeReviewed}
              disabled={!reportCurrent}
              onChange={(e) => check({ scopeReviewed: e.target.checked })}
            />
            합의 범위와 제외 범위를 확인했습니다.
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={r.estimateReviewed}
              disabled={!reportCurrent}
              onChange={(e) => check({ estimateReviewed: e.target.checked })}
            />
            수정 자원·예상 공수·미확정 사항을 검토했습니다.
          </label>
        </div>
        <button
          className="primary"
          disabled={!!busy || !saved || !canRegister(r)}
          onClick={register}
        >
          <CheckCircle2 size={15} />
          확정 · 리포트 등록
        </button>
      </section>
    </>
  );
}
export function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  );
}
