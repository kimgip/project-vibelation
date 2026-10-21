import { activeConfirmation, type WorkRequest } from "./types";
/** Read-only summary of the agreed functional scope; never renders the whole MD in history. */
export function reviewSummary(r: WorkRequest) {
  const doc = activeConfirmation(r)?.documentSnapshot;
  if (!doc) return "확정한 문서가 없습니다.";
  const section = doc.markdown.match(/^## 기능 요구사항\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1]?.trim();
  return section ? section.slice(0, 1200) : `확정 요구사항 ${doc.generationNumber}차안 기준입니다. 상세 내용은 확정 요구사항 MD에서 확인해주세요.`;
}
