import { useLayoutEffect, useEffect, useRef, useState, useId } from 'react';
import { graphActions, normalizeAction, validateImpactGraph, type ImpactGraph as Graph, type GraphAction } from '../domain/impactGraph';
const colors = {modify:'#e5574e',new:'#3fb67a',check:'#6d97f2'};
export function ImpactGraph({graph,analysisId}:{graph:Graph;analysisId?:string}) {
  const error=validateImpactGraph(graph,analysisId);
  return error?<p role="alert">영향도 지도를 표시할 수 없습니다 ({error}).</p>:<GraphView key={graph.id+':'+graph.revision} graph={{...graph,nodes:graph.nodes.map(n=>({...n,action:normalizeAction(n.action)}))}}/>;
}
function GraphView({graph}:{graph:Graph}) {
  const [selected,setSelected]=useState<string|null>(null),[filters,setFilters]=useState<GraphAction[]>([]),[paths,setPaths]=useState<{id:string;d:string}[]>([]);
  const canvas=useRef<HTMLDivElement>(null), refs=useRef(new Map<string,HTMLButtonElement>()), close=useRef<HTMLButtonElement>(null), marker=useId().replace(/:/g,'');
  const node=graph.nodes.find(n=>n.id===selected);
  function clear(){setSelected(null);if(selected)refs.current.get(selected)?.focus();}
  useEffect(()=>{if(!selected)return;close.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')clear()};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[selected]);
  const related=new Set<string>();
  if(node){
    related.add(node.id);
    if(node.relatedTo?.length)node.relatedTo.forEach(id=>related.add(id));
    else for(const direction of ['up','down']){
      const visited=new Set([node.id]),queue=[node.id];
      while(queue.length){const id=queue.shift()!;for(const e of graph.edges){const next=direction==='down'?(e.sourceId===id?e.targetId:null):(e.targetId===id?e.sourceId:null);if(next&&!visited.has(next)){visited.add(next);related.add(next);queue.push(next)}}}
    }
    graph.nodes.forEach(n=>{if(n.relatedTo?.some(id=>related.has(id)))related.add(n.id)});
  } else if(filters.length)graph.nodes.filter(n=>filters.includes(n.action)).forEach(n=>related.add(n.id));
  const focused=!!node||filters.length>0;
  useLayoutEffect(()=>{
    let frame=0,stopped=false;
    const draw=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(stopped||!canvas.current)return;const base=canvas.current.getBoundingClientRect();setPaths(graph.edges.map(e=>{const a=refs.current.get(e.sourceId)!.getBoundingClientRect(),b=refs.current.get(e.targetId)!.getBoundingClientRect();const same=graph.nodes.find(n=>n.id===e.sourceId)!.groupId===graph.nodes.find(n=>n.id===e.targetId)!.groupId;const forward=b.left>a.right;const x1=(same||forward?a.right:a.left)-base.left,y1=a.top+a.height/2-base.top,x2=(same||!forward?b.right:b.left)-base.left,y2=b.top+b.height/2-base.top;const dx=same?60+Math.abs(y2-y1)*.15:Math.max(60,Math.abs(x2-x1)*.45);return{id:e.id,d:same?`M${x1},${y1} C${x1+dx},${y1} ${x2+dx},${y2} ${x2},${y2}`:`M${x1},${y1} C${x1+(forward?dx:-dx)},${y1} ${x2+(forward?-dx:dx)},${y2} ${x2},${y2}`}}));});};
    const observer=new ResizeObserver(draw);if(canvas.current)observer.observe(canvas.current);refs.current.forEach(n=>observer.observe(n));window.addEventListener('resize',draw);document.fonts.ready.then(()=>{if(!stopped)draw()});draw();return()=>{stopped=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',draw)};
  },[graph]);
  const choose=(id:string)=>setSelected(v=>v===id?null:id);
  const chips=(ids:string[])=>ids.length?ids.map(id=><button className="impact-link" key={id} onClick={()=>{setSelected(id);refs.current.get(id)?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'})}}>{graph.nodes.find(n=>n.id===id)?.title}</button>):<span>없음</span>;
  return <section className="impact-map" aria-label="코드 영향도 지도">
    <div className="impact-toolbar"><span>수정 구분</span><div className="graph-filters" aria-label="조치 분류 필터">{Object.entries(graphActions).map(([key,label])=><button style={{'--status-color':colors[key as GraphAction]} as React.CSSProperties} key={key} aria-pressed={filters.includes(key as GraphAction)} onClick={()=>{setSelected(null);setFilters(v=>v.includes(key as GraphAction)?v.filter(x=>x!==key):[...v,key as GraphAction])}}><i/>{label}<em>{graph.nodes.filter(n=>n.action===key).length}</em></button>)}</div><span className="impact-legend">― 관계 연결</span><span className="impact-hint">카드를 누르면 연결된 자원이 강조되고 상세가 열립니다</span></div>
    <div className="graph-scroll" onClick={e=>{if(!(e.target as Element).closest('button'))setSelected(null)}}><div className="graph-canvas" ref={canvas}>
      <svg className="graph-lines" aria-hidden="true"><defs><marker id={marker} markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="currentColor"/></marker></defs>{paths.map(p=>{const e=graph.edges.find(e=>e.id===p.id)!;const hit=related.has(e.sourceId)&&related.has(e.targetId);return <path key={p.id} d={p.d} markerEnd={e.direction==='directed'?`url(#${marker})`:undefined} className={`${e.assessment==='inferred'?'inferred':''} ${focused&&hit?'highlight':''} ${focused&&!hit?'dim':''}`}/>})}</svg>
      <div className="graph-columns">{[...graph.groups].sort((a,b)=>a.order-b.order).map(group=><div key={group.id}><h3>{group.label}<small>{({entry:'사용자가 닿는 곳',core:'기능의 본체',related:'호출 체인'} as Record<string,string>)[group.id]}</small></h3>{graph.nodes.filter(n=>n.groupId===group.id).sort((a,b)=>a.order-b.order).map(n=><button style={{'--status-color':colors[n.action]} as React.CSSProperties} key={n.id} ref={el=>{if(el)refs.current.set(n.id,el);else refs.current.delete(n.id)}} className={`graph-node ${n.external?'is-external':''} ${focused&&!related.has(n.id)?'dim':''}`} aria-pressed={node?.id===n.id} onClick={()=>choose(n.id)}><b>{n.title}{n.external&&<em>소스 외</em>}</b><small>{n.subtitle}</small><span><strong>{graphActions[n.action]}</strong> · {n.resourceType==='Permission'?'권한':n.resourceType==='Other'&&n.external?'설정':n.resourceType}</span></button>)}</div>)}</div>
    </div></div>
    {node&&<aside className="impact-drawer" aria-label="선택 자원 근거" style={{'--status-color':colors[node.action]} as React.CSSProperties}><button ref={close} className="impact-close" aria-label="상세 닫기" onClick={clear}>×</button><span className="impact-badge">{graphActions[node.action]} · {node.resourceType}</span><h2>{node.title}</h2><p className="impact-path">{node.displayPath}</p><div className="impact-meta"><div>유형<b>{node.resourceType}</b></div><div>연결 범위<b>{related.size-1}개 자원</b></div></div>
      {!!node.access?.length&&<><h3>접근 권한</h3><table>{node.access.map(a=><tbody key={a.label}><tr><th>{a.label}</th><td><b>{a.value}</b><p>{a.note}</p></td></tr></tbody>)}</table></>}
      <h3>변경 내용</h3><ul>{(node.changes?.length?node.changes:node.actionReason.split('\n')).map((text,i)=><li key={i}>{text}</li>)}</ul>
      {node.relatedTo?.length?<><h3>관련 자원</h3>{chips(node.relatedTo)}</>:<><h3>호출하는 쪽 (상류)</h3>{chips(graph.edges.filter(e=>e.targetId===node.id).map(e=>e.sourceId))}<h3>호출되는 쪽 (하류)</h3>{chips(graph.edges.filter(e=>e.sourceId===node.id).map(e=>e.targetId))}</>}
      <h3>코드 근거</h3>{node.evidenceIds.length?node.evidenceIds.map(id=>{const ev=graph.evidence.find(e=>e.id===id)!;return <div key={id}><code>{ev.path}{ev.lineStart?`:${ev.lineStart}`:''}</code>{ev.snippet&&<pre>{ev.snippet}</pre>}</div>}):<p>등록된 코드 근거가 없습니다.</p>}
    </aside>}
  </section>;
}
