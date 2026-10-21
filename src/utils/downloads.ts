export function downloadMarkdown(
  title: string,
  kind: string,
  revision: number,
  markdown: string,
) {
  const name =
    title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80) || "vibelation";
  const url = URL.createObjectURL(
    new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}-${kind}-v${revision}.md`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const displayDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
/** 2026.10.18 in the viewer's local time. */
export const dotDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};
export function downloadHtml(title: string, html: string) {
  const name =
    title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80) || "vibelation";
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}-시스템적용예상화면.html`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
