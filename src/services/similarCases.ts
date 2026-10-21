import { apiJson, jsonPost, serverMode } from './api';
import { waitForPoll } from './generationTransport';
import { cases } from '../mocks/download-center';
import { basisOf, readyForReview, activeConfirmation, type WorkRequest, type SimilarCaseAnalysis } from '../domain/types';
export async function analyzeSimilarCases(r:WorkRequest,signal:AbortSignal):Promise<SimilarCaseAnalysis>{
  if(!readyForReview(r)||!r.analysis?.id)throw new Error('현재 확정과 일치하는 영향도 분석이 필요합니다.');
  const basis=basisOf(r);
  if(!serverMode){await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,500);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('취소','AbortError'))},{once:true})});return{id:crypto.randomUUID(),analysisId:r.analysis.id,basis,cases:structuredClone(cases),status:'ready',source:'mock'}}
  const doc=activeConfirmation(r)!.documentSnapshot;
  const hash=doc.contentHash||[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(doc.markdown)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const body={confirmationId:r.activeConfirmationId,requirementDocumentId:doc.id,expectedDocumentContentHash:hash,analysisResultId:r.analysis.id};
  const ticketKey=`soetmul.sim-job:${JSON.stringify(body)}`;
  const ticket=JSON.parse(localStorage.getItem(ticketKey)||'null')||{key:crypto.randomUUID()};
  localStorage.setItem(ticketKey,JSON.stringify(ticket));
  let job=ticket.id?await apiJson(`/similar-case-analysis-jobs/${encodeURIComponent(ticket.id)}`,signal):await apiJson(`/requests/${encodeURIComponent(r.id)}/similar-case-analysis-jobs`,signal,jsonPost(body,ticket.key));
  if(typeof job.id!=='string')throw new Error('유사사례 작업 ID가 없습니다.');
  ticket.id=job.id;localStorage.setItem(ticketKey,JSON.stringify(ticket));
  for(let n=0;n<600;n++){
    if(job.status==='failed'){localStorage.removeItem(ticketKey);throw new Error(job.error?.message||'유사사례 분석 실패');}
    if(job.status==='succeeded'){
      const result=job.result||(job.similarCaseAnalysisId?await apiJson(`/similar-case-analysis-results/${encodeURIComponent(job.similarCaseAnalysisId)}`,signal):null);
      const map=result?.similarCaseMap;
      if(!result||typeof result.id!=='string'||result.requestId!==r.id||result.confirmationId!==r.activeConfirmationId||result.requirementDocumentId!==doc.id||result.requirementDocumentContentHash!==hash||result.analysisResultId!==r.analysis.id||result.legacyVersion!==r.legacyVersion||result.screenType!==r.screenType||!map||!['ready','no_matches','insufficient_data'].includes(map.status)||!Array.isArray(map.cases))throw new Error('유사사례 결과의 기준 또는 형식이 올바르지 않습니다.');
      const rows=map.cases.map((c:any)=>{if(typeof c.historyId!=='string'||typeof c.title!=='string'||typeof c.summary!=='string')throw new Error('유사사례 항목 형식 오류');for(const type of ['business','resource']){const score=c[type]?.score;if(score!==null&&(typeof score!=='number'||!Number.isFinite(score)||score<0||score>1))throw new Error('유사도 점수 오류');}return{historyId:c.historyId,title:c.title,registeredAt:c.registeredAt,reason:c.summary,difference:(c.business.differences||[]).join('\n'),business:c.business.score,resource:c.resource.score,resources:[]};});
      if(map.status==='no_matches'&&rows.length)throw new Error('유사사례 상태와 목록이 다릅니다.');
      localStorage.removeItem(ticketKey);return{rawResult:result,id:result.id,analysisId:result.analysisResultId,basis,cases:rows,status:map.status,source:'server'};
    }
    if(!['queued','running'].includes(job.status))throw new Error('유사사례 작업 상태 오류');
    await waitForPoll(signal);job=await apiJson(`/similar-case-analysis-jobs/${encodeURIComponent(job.id)}`,signal);
  }
  throw new Error('유사사례 분석 대기 중입니다. 같은 작업을 다시 확인해주세요.');
}
