import productPreview from "./product-preview.json" with { type: "json" };
import team from "./team.json" with { type: "json" };
import localSettings from "./local-settings.json" with { type: "json" };
import downloadCenter from "./download-center.json" with { type: "json" };
import requirements from "./step01-requirements.json" with { type: "json" };
import systemMock from "./step01-system-mock.json" with { type: "json" };
import analysis from "./step02-analysis.json" with { type: "json" };
import report from "./step03-report.json" with { type: "json" };
import type {
  Analysis,
  RequirementDocument,
  MockArtifact,
  Impact,
} from "../domain/types";

// Check discriminators rather than casting edited JSON to a trusted domain type.
if (requirements.source !== "mock")
  throw new Error("요구사항 Mock source는 mock이어야 합니다.");
if (
  systemMock.source !== "mock" ||
  systemMock.renderer !== "download-center-demo"
)
  throw new Error("예상 화면 Mock의 source/renderer를 확인해주세요.");
export const downloadCenterFixture = downloadCenter;
export const requirementFixture: Pick<
  RequirementDocument,
  "source" | "formatVersion"
> & { markdownTemplate: string } = {
  ...requirements,
  source: requirements.source,
};
export const systemMockFixture: Pick<
  MockArtifact,
  "source" | "renderer" | "behaviors" | "assumptions" | "unconnectedFeatures"
> & { html: string } = {
  ...systemMock,
  source: systemMock.source,
  renderer: systemMock.renderer,
};
export const analysisFixture: Omit<Analysis, "id" | "basis"> = {
  ...analysis,
  impacts: analysis.impacts.map((item): Impact => {
    const type = item.type;
    if (
      type !== "UI" &&
      type !== "Logic" &&
      type !== "API" &&
      type !== "DB" &&
      type !== "Permission"
    )
      throw new Error(`지원하지 않는 Mock 자원 유형: ${type}`);
    return { ...item, type };
  }),
};
export const reportFixture = report;

if (!Number.isFinite(Date.parse(team.referenceDate)) || !team.statusFilters.includes(team.completedStatus) ||
    team.items.some(row=>!team.statusFilters.includes(row.status) || !Number.isFinite(Date.parse(row.due))))
  throw new Error("팀 현황 Mock JSON의 상태·날짜를 확인해주세요.");
if (!localSettings.legacy.version || localSettings.filePolicy.maxBytes<=0 || localSettings.filePolicy.maxCount<=0 ||
    Object.values(localSettings.timing).some(value=>!Number.isFinite(value) || value<0))
  throw new Error("로컬 Mock 설정 JSON의 코드 기준·정책·지연을 확인해주세요.");
export const teamFixture = team;
export const localMockSettings = localSettings;

if (!productPreview.categories.length || !productPreview.languages.length || productPreview.maxSelection<1)
  throw new Error("제품 화면 Mock JSON의 카테고리·언어·선택 한도를 확인해주세요.");
export const productPreviewFixture = productPreview;

if(localSettings.screenTypes.some(item=>!["new","modify"].includes(item.value)))
  throw new Error("화면 종류 Mock 값은 new 또는 modify여야 합니다.");
