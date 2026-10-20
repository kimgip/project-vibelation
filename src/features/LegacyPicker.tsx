import { localMockSettings } from "../mocks/fixtures";
import { backendApi } from "../services/backendApi";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { LegacyReference } from "../domain/legacySources";
import { legacyRepository } from "../storage/legacySources";
import {
  RequestContext,
  ScreenTitle,
  StepFooter,
} from "../components/WorkflowShell";
import type { WorkspaceProps } from "./workspace";

function LegacyCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={`legacy-check ${checked ? "checked" : ""}`}
      aria-hidden="true"
    >
      {checked && (
        <img
          src={`${import.meta.env.BASE_URL}brand/check.svg`}
          alt=""
          width="13.02"
          height="13"
        />
      )}
    </span>
  );
}

export function LegacyPicker({ r, edit, go, saved }: WorkspaceProps) {
  const [serverReferences,setServerReferences]=useState<{id:string;systemName:string;version:string}[]>([]);
  const [references, setReferences] = useState<LegacyReference[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if(backendApi)void backendApi.listLegacyReferences().then(page=>{if(!cancelled)setServerReferences(page.items);}).catch(e=>{if(!cancelled)setError(e.message);});
    void legacyRepository
      .references()
      .then((rows) => {
        if (!cancelled) setReferences(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "코드 기준 조회 실패");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <>
      <ScreenTitle
        title="[틀 고르기]"
        description="수정해야 할 나의 자원을 선택해 주세요."
      />
      <div className="legacy-picker-heading">
        <h2>① 레거시 자원</h2>
        <Link to="/settings/legacy">+ 기존 코드 ZIP 등록</Link>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="legacy-reference-list">
        <button
          className={r.legacyVersion === localMockSettings.legacy.version ? "selected" : ""}
          aria-pressed={r.legacyVersion === localMockSettings.legacy.version}
          onClick={() => edit({ legacyVersion: localMockSettings.legacy.version })}
        >
          <span>
            <b>{localMockSettings.legacy.name}</b>
            <small>{localMockSettings.legacy.description}</small>
          </span>
          <LegacyCheck checked={r.legacyVersion === localMockSettings.legacy.version} />
        </button>
        {serverReferences.map(ref=><div key={ref.id} className="workflow-info"><b>{ref.systemName}</b> · {ref.version}<small>서버 코드 기준 · ZIP 동시 전송은 아래 브라우저 보관 기준을 선택해주세요.</small></div>)}
        {references
          .slice()
          .reverse()
          .map((ref) => (
            <button
              key={ref.id}
              className={r.legacyVersion === ref.id ? "selected" : ""}
              aria-pressed={r.legacyVersion === ref.id}
              onClick={() => edit({ legacyVersion: ref.id })}
            >
              <span>
                <b>{ref.name}</b>
                <small>
                  {ref.archives
                    .map(
                      (a) =>
                        `${a.role === "frontend" ? "프론트" : "백엔드"}: ${a.name}`,
                    )
                    .join(" · ")}
                </small>
                <small>
                  {new Date(ref.createdAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}{" "}
                  · 적용 당시 코드 보존
                </small>
              </span>
              <LegacyCheck checked={r.legacyVersion === ref.id} />
            </button>
          ))}
      </div>
      <h2 className="legacy-request-label">② 화면 종류</h2>
      <div className="screen-type-options">
        {localMockSettings.screenTypes.map(({value, name, detail}) => (
          <button
            key={value}
            className={r.screenType === value ? "selected" : ""}
            aria-pressed={r.screenType === value}
            onClick={() => edit({ screenType: value as "new" | "modify" })}
          >
            <span>{name}</span>
            <small>{detail}</small>
          </button>
        ))}
      </div>
      <h2 className="legacy-request-label">③ 요청 정보</h2>
      <RequestContext
        r={r}
        edit={edit}
        initiallyOpen
        onContinue={() => go("input?view=materials")}
      />
      <StepFooter
        next={{
          label: "쇳물 녹이기 ›",
          disabled: !saved,
          type: "submit",
          form: `request-details-${r.id}`,
          name: "continue",
        }}
        reason="저장이 완료되면 진행할 수 있어요"
      />
    </>
  );
}
