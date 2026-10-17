import DOMPurify from "dompurify";
function cleanDeclarations(style: CSSStyleDeclaration) {
  for (const property of Array.from(style)) {
    const value = style.getPropertyValue(property);
    if (
      /\\|url\s*\(|image-set\s*\(|expression\s*\(|@import|behavior|binding/i.test(
        value,
      ) ||
      property.startsWith("--")
    )
      style.removeProperty(property);
  }
  return style.cssText;
}
function cleanSheet(css: string) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    function rules(list: CSSRuleList): string {
      return Array.from(list)
        .map((rule) => {
          if (rule instanceof CSSStyleRule)
            return `${rule.selectorText}{${cleanDeclarations(rule.style)}}`;
          if (rule instanceof CSSMediaRule)
            return `@media ${rule.conditionText}{${rules(rule.cssRules)}}`;
          if (rule instanceof CSSSupportsRule)
            return `@supports ${rule.conditionText}{${rules(rule.cssRules)}}`;
          return "";
        })
        .join("\n");
    }
    return rules(sheet.cssRules);
  } catch {
    return "";
  }
}
export function staticPreview(source: string) {
  const cleaned = DOMPurify.sanitize(source, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "meta",
      "link",
      "base",
      "svg",
      "math",
      "video",
      "audio",
      "img",
      "source",
    ],
    FORBID_ATTR: [
      "src",
      "srcset",
      "href",
      "action",
      "formaction",
      "poster",
      "background",
      "autofocus",
    ],
    ALLOW_DATA_ATTR: false,
  });
  const template = document.createElement("template");
  template.innerHTML = cleaned;
  for (const element of Array.from(
    template.content.querySelectorAll("[style]"),
  ))
    element.setAttribute(
      "style",
      cleanDeclarations((element as HTMLElement).style),
    );
  for (const element of Array.from(template.content.querySelectorAll("style")))
    element.textContent = cleanSheet(element.textContent || "");
  return `<!doctype html><html lang="ko"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font:14px/1.7 system-ui;padding:20px;margin:0;color:#23364e;overflow-wrap:anywhere}input,button{font:inherit}table{max-width:100%}</style></head><body>${template.innerHTML || "<p>HTML 코드를 입력하면 화면을 확인할 수 있습니다.</p>"}</body></html>`;
}
