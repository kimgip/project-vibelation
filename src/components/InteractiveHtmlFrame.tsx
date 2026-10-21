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
  const [source, setSource] = useState(() => sourceDocument(html)), [revision,setRevision] = useState(0);
  return <div><button type="button" onClick={() => {setSource(sourceDocument(html));setRevision(v=>v+1);}}>미리보기 새로고침</button><p>JavaScript 동작 미리보기 · 외부 라이브러리와 서버 통신은 지원하지 않습니다.</p><iframe key={revision} title="입력 HTML 동작 미리보기" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={source} /></div>;
}
