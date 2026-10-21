export const graphActions = {modify:'수정',new:'신규 생성',check:'확인만'};
export const legacyActions = ['direct_change','related_change','optional_change','verify_only','excluded','undetermined'];
export const normalizeAction = (action:string): GraphAction => action === 'new' ? 'new' : ['check','verify_only','excluded','undetermined'].includes(action) ? 'check' : 'modify';
export type GraphAction = keyof typeof graphActions;
export interface GraphEvidence {id:string;sourcePackageId:string;sourceHash:string;path:string;archiveEntryPath:string|null;symbol:string|null;lineStart:number|null;lineEnd:number|null;snippet:string|null;method:string;note:string}
export interface GraphNode {id:string;groupId:string;order:number;title:string;subtitle:string|null;resourceType:string;kind:string;impactId:string|null;action:GraphAction;external?:boolean;displayPath?:string;changes?:string[];relatedTo?:string[];access?:{label:string;value:string;note:string}[];actionReason:string;evidenceIds:string[]}
export interface GraphEdge {id:string;sourceId:string;targetId:string;relation:string;direction:'directed'|'undirected';assessment:'observed_static'|'inferred'|'runtime_verified';evidenceIds:string[];note:string}
export interface ImpactGraph {schemaVersion:'impact-graph-v1'|'impact-graph-v3';id:string;revision:number;analysisId:string;generatedAt:string;groups:{id:string;label:string;order:number}[];nodes:GraphNode[];edges:GraphEdge[];evidence:GraphEvidence[];coverage:{status:string;methods:string[];runtimeVerified:boolean;limits:{scope:string;returnedCount:number;limit:number;totalCount:number|null;truncated:boolean}[];warnings:{code:string;message:string}[]}}
export function validateImpactGraph(value: unknown, analysisId?:string, sources?:{id:string;sha256:string}[]): string | null {
  if (!value || typeof value !== 'object') return 'GRAPH_INVALID';
  const g = value as ImpactGraph;
  if (!['impact-graph-v1','impact-graph-v3'].includes(g.schemaVersion)) return 'GRAPH_UNSUPPORTED';
  if (new TextEncoder().encode(JSON.stringify(g)).length>1048576) return 'GRAPH_LIMIT_EXCEEDED';
  const text=(v:unknown)=>typeof v==='string';
  const arrays=[g.groups,g.nodes,g.edges,g.evidence];
  if(arrays.some(a=>!Array.isArray(a)))return 'GRAPH_INVALID';
  if(g.nodes.length>100||g.edges.length>200||g.evidence.length>500)return 'GRAPH_LIMIT_EXCEEDED';
  if(arrays.some(a=>a.some(v=>!v||!text(v.id))||new Set(a.map(v=>v.id)).size!==a.length))return 'GRAPH_INVALID';
  if(!text(g.id)||!Number.isInteger(g.revision)||g.revision<1||!text(g.analysisId)||(analysisId&&g.analysisId!==analysisId)||!Number.isFinite(Date.parse(g.generatedAt)))return 'GRAPH_INVALID';
  const ids=(a:{id:string}[])=>new Set(a.map(x=>x.id)),groups=ids(g.groups),nodes=ids(g.nodes),evidence=ids(g.evidence);
  const refs=(v:unknown)=>Array.isArray(v)&&v.every(id=>text(id)&&evidence.has(id));
  if(g.groups.some(v=>!text(v.label)||!Number.isFinite(v.order)))return 'GRAPH_INVALID';
  if(g.nodes.some(n=>!groups.has(n.groupId)||!Number.isFinite(n.order)||!text(n.title)||!text(n.actionReason)||!(Object.hasOwn(graphActions,n.action)||(g.schemaVersion==='impact-graph-v1'&&legacyActions.includes(n.action)))||!refs(n.evidenceIds)))return 'GRAPH_INVALID';
  if(g.edges.some(e=>!nodes.has(e.sourceId)||!nodes.has(e.targetId)||!['directed','undirected'].includes(e.direction)||!['observed_static','inferred','runtime_verified'].includes(e.assessment)||!['calls','navigates_to','imports','returns','uses_type','loads_style','tests','paired_with','similar_name','other'].includes(e.relation)||!refs(e.evidenceIds)||!text(e.note)))return 'GRAPH_INVALID';
  if(g.evidence.some(e=>!text(e.path)||/^(?:[a-z]:|\/|\\)|(?:^|[\\/])\.\.(?:[\\/]|$)/i.test(e.path)||!text(e.sourcePackageId)||!(/^[a-f0-9]{64}$/i.test(e.sourceHash))||!['text_search','parser','runtime_trace','manual'].includes(e.method)||!text(e.note)||(e.snippet!==null&&(!text(e.snippet)||e.snippet.length>2000))||!((e.lineStart===null&&e.lineEnd===null)||(Number.isInteger(e.lineStart)&&Number(e.lineStart)>0&&Number.isInteger(e.lineEnd)&&Number(e.lineEnd)>=Number(e.lineStart)))))return 'GRAPH_INVALID';
  if(!g.coverage||!['complete','partial','unknown'].includes(g.coverage.status)||typeof g.coverage.runtimeVerified!=='boolean'||!Array.isArray(g.coverage.methods)||!Array.isArray(g.coverage.limits)||!Array.isArray(g.coverage.warnings)||g.coverage.warnings.some(w=>!w||!text(w.code)||!text(w.message)))return 'GRAPH_INVALID';
  if(sources && g.evidence.some(e=>!sources.some(s=>s.id===e.sourcePackageId&&s.sha256===e.sourceHash)))return 'GRAPH_INVALID';
  if(g.nodes.some(n=>!['UI','Logic','API','DB','Permission','Other'].includes(n.resourceType)||!['component','function','endpoint','model','style','test','route','file','other'].includes(n.kind)||!(n.subtitle===null||text(n.subtitle))||!(n.impactId===null||text(n.impactId))))return 'GRAPH_INVALID';
  if(g.coverage.limits.some(l=>!l||!text(l.scope)||!Number.isFinite(l.returnedCount)||!Number.isFinite(l.limit)||typeof l.truncated!=='boolean'))return 'GRAPH_INVALID';
  if(g.nodes.some(n=>(n.relatedTo!==undefined&&(!Array.isArray(n.relatedTo)||new Set(n.relatedTo).size!==n.relatedTo.length||n.relatedTo.some(id=>id===n.id||!nodes.has(id))))||(n.external!==undefined&&typeof n.external!=='boolean')||(n.displayPath!==undefined&&!text(n.displayPath))||(n.changes!==undefined&&(!Array.isArray(n.changes)||n.changes.some(v=>!text(v))))||(n.access!==undefined&&(!Array.isArray(n.access)||n.access.some(a=>!a||!text(a.label)||!text(a.value)||!text(a.note))))))return 'GRAPH_INVALID';
  if(g.edges.some(e=>e.assessment==='runtime_verified'&&!e.evidenceIds.some(id=>g.evidence.find(v=>v.id===id)?.method==='runtime_trace')))return 'GRAPH_INVALID';
  return null;
}
