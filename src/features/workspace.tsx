import type { WorkRequest } from "../domain/types";
export interface WorkspaceProps {
  r: WorkRequest;
  update: (change: (latest: WorkRequest) => WorkRequest) => void;
  edit: (patch: Partial<WorkRequest>) => boolean | void;
  check: (patch: Partial<WorkRequest>) => void;
  run: (kind: "analysis" | "similarCaseAnalysis") => void;
  confirmAndAnalyze: (options?: { skipPreview?: boolean }) => void;
  busy: string;
  go: (step: string) => void;
  register: () => void;
  saved: boolean;
}
export { InputPage } from "./RequestInput";
export { AnalysisPage } from "./AnalysisPage";
export { ReviewPage } from "./ReviewPage";
