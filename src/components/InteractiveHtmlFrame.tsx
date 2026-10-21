import { useState } from "react";

function sourceDocument(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("meta,base,link,iframe,object,embed,script[src]").forEach(el => el.remove());
  doc.querySelectorAll("*").forEach(el => {
    for (const attr of [...el.attributes]) if (["href","src","srcset","action","formaction","target","ping","xlink:href"].includes(attr.name)) el.removeAttribute(attr.name);
  });
  const policy = doc.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; img-src data: blob:";
  doc.head.prepend(policy);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}

export function InteractiveHtmlFrame({html}: {html:string}) {
  const [source] = useState(() => sourceDocument(html));
  return <div><iframe title="입력 HTML 동작 미리보기" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={source} /></div>;
}
