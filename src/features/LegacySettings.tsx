import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ScreenTitle } from "../components/WorkflowShell";
import { legacyRepository } from "../storage/legacySources";
import {
  prepareSourceArchive,
  type LegacySystem,
  type SourceArchive,
  type SourceRole,
} from "../domain/legacySources";

const newSystem = (): LegacySystem => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  archives: [],
  revision: 0,
});
export function LegacySettings() {
  const [systems, setSystems] = useState<LegacySystem[]>([]);
  const [draft, setDraft] = useState(newSystem);
  const [role, setRole] = useState<SourceRole>("frontend");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  async function load() {
    try {
      const rows = await legacyRepository.systems();
      setSystems(rows);
      setDraft((current) => rows.find((s) => s.id === current.id) || current);
      setError("");
      setLoaded(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "코드 보관 공간을 열지 못했습니다.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function select(id: string) {
    setDraft(systems.find((s) => s.id === id) || newSystem());
    setNotice("");
    setError("");
  }
  async function store(next: LegacySystem) {
    const saved = await legacyRepository.save(next, draft.revision);
    setDraft(saved);
    setSystems(await legacyRepository.systems());
    return saved;
  }
  async function act(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "코드 ZIP 처리에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function add(file: File, replace?: SourceArchive) {
    await act(async () => {
      const archive = await prepareSourceArchive(file, replace?.role || role);
      if (
        draft.archives.some(
          (a) =>
            a.sha256 === archive.sha256 &&
            a.role === archive.role &&
            a.id !== replace?.id,
        )
      )
        throw new Error("같은 분류의 동일 ZIP이 이미 보관되어 있습니다.");
      await store({
        ...draft,
        archives: [
          ...draft.archives.filter((a) => a.id !== replace?.id),
          archive,
        ],
      });
      setNotice(
        "코드 ZIP을 브라우저에 보관했습니다. 틀을 적용한 뒤 Mock 생성·분석 요청에서 서버로 전송합니다.",
      );
    });
  }
  async function remove(archive: SourceArchive) {
    if (
      !window.confirm(
        `${archive.name}을 작업 구성에서 제외할까요? 이전 코드 기준과 분석 기록은 보존됩니다.`,
      )
    )
      return;
    await act(async () => {
      await store({
        ...draft,
        archives: draft.archives.filter((a) => a.id !== archive.id),
      });
    });
  }
  async function apply() {
    await act(async () => {
      if (!draft.name.trim() || !draft.archives.length)
        throw new Error("시스템 이름과 코드 ZIP을 1개 이상 입력해주세요.");
      const saved = await store(draft);
      const applied = await legacyRepository.apply(saved);
      setDraft(applied);
      setSystems(await legacyRepository.systems());
      setNotice(
        "새 코드 기준을 적용했습니다. 진행 중인 요청은 틀 고르기에서 새 기준을 직접 선택해주세요.",
      );
    });
  }
  return (
    <>
      <ScreenTitle
        title="⚙ 설정"
        description="기존 코드 ZIP을 보관하고, Mock 생성·레거시 분석에 사용할 틀을 관리합니다."
      />
      <p className="workflow-info">
        ZIP은 이 브라우저에 보관됩니다. 서버 전송은 Mock 생성·분석 시 수행하며,
        코드 내부 검증·정적 분석은 서버의 책임입니다.
      </p>
      {error && (
        <div className="inline-error" role="alert">
          {error}{" "}
          <button disabled={busy} onClick={() => void load()}>
            저장 목록 다시 불러오기
          </button>
        </div>
      )}
      {notice && (
        <p className="workflow-notice" role="status">
          {notice}
        </p>
      )}
      <label className="legacy-system-picker">
        등록된 레거시 틀
        <select
          aria-label="등록된 레거시 틀"
          value={draft.revision ? draft.id : ""}
          disabled={busy || !loaded}
          onChange={(e) => select(e.target.value)}
        >
          <option value="">새 틀 등록</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || "이름 없는 초안"}
              {s.activeReferenceId ? " · 적용됨" : " · 미적용"}
            </option>
          ))}
        </select>
      </label>
      <section className="workflow-card legacy-editor">
        <div className="workflow-card-heading">
          <h2>{draft.revision ? "레거시 틀 수정" : "새 틀 등록"}</h2>
          <button disabled={busy || !loaded} onClick={() => select("")}>
            새 틀
          </button>
        </div>
        <fieldset disabled={busy || !loaded} className="legacy-fields">
          <label>
            시스템 이름
            <input
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="예: My POSCO"
            />
          </label>
          <label>
            어떤 시스템인가요?
            <textarea
              maxLength={2000}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="시스템의 역할과 업무를 한두 문장으로 적어주세요."
            />
          </label>
          <div>
            <h3>소스 압축 파일</h3>
            {draft.archives.map((archive) => (
              <div className="source-package" key={archive.id}>
                <span className={`source-role ${archive.role}`}>
                  {archive.role === "frontend" ? "프론트엔드" : "백엔드"}
                </span>
                <div>
                  <b>{archive.name}</b>
                  <small>
                    {(archive.file.size / 1024 / 1024).toFixed(2)} MiB ·
                    브라우저 보관 완료 · 서버 미전송
                  </small>
                  <small className="source-hash">
                    SHA-256 {archive.sha256.slice(0, 16)}…
                  </small>
                </div>
                <label className="file-action">
                  교체
                  <input
                    type="file"
                    accept=".zip"
                    aria-label={`${archive.name} 교체`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void add(file, archive);
                    }}
                  />
                </label>
                <button onClick={() => void remove(archive)}>삭제</button>
              </div>
            ))}
            <div className="source-upload">
              <div className="source-role-field">
                <span id="source-role-label">코드 분류</span>
                <div
                  className="source-role-toggle"
                  role="group"
                  aria-labelledby="source-role-label"
                >
                  {(
                    [
                      ["frontend", "프론트엔드"],
                      ["backend", "백엔드"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={role === value}
                      onClick={() => setRole(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="zip-picker">
                + 압축 파일 추가 · .zip · GitHub Download ZIP
                <input
                  type="file"
                  accept=".zip"
                  aria-label="코드 ZIP 추가"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void add(file);
                  }}
                />
              </label>
            </div>
            <small>
              브라우저 보관 제한: ZIP 파일당 100MiB. GitHub 계정 연결 없이
              내려받은 ZIP을 선택합니다.
            </small>
          </div>
        </fieldset>
        <div className="workflow-actions">
          <Link className="button" to="/requests">
            작업실로 돌아가기
          </Link>
          <button
            className="primary"
            disabled={
              busy || !loaded || !draft.name.trim() || !draft.archives.length
            }
            onClick={() => void apply()}
          >
            {busy ? "코드 보관 중…" : "틀 등록 · 변경사항 적용"}
          </button>
        </div>
      </section>
    </>
  );
}
