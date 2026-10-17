import { useMemo } from "react";
import { staticPreview } from "../utils/htmlPreview";
export { staticPreview } from "../utils/htmlPreview";
export function StaticHtmlFrame({ html }: { html: string }) {
  const source = useMemo(() => staticPreview(html), [html]);
  return (
    <iframe
      title="입력 HTML 정적 미리보기"
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={source}
    />
  );
}
