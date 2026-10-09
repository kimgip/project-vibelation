import type { AgreementItem, Registration, Review, WorkRequest } from './domain';
const delay = () => new Promise<void>(resolve => setTimeout(resolve, 650));
export const sample = { title: '차량 운행이력 조회 개선', description: '운행이력에 기간 필터와 엑셀 다운로드 기능을 추가해주세요.', conversation: '현업: 최근 3개월 데이터를 내려받고 싶어요.\n운영: 다운로드는 관리자만 허용하는 것으로 협의해주세요.', dueDate: '2026-11-06', html: '<main><h2>차량 운행이력</h2><label>조회 기간 <input type="date"> ~ <input type="date"></label><button>조회</button><button>엑셀 다운로드</button><table><tr><th>차량</th><th>운행일</th><th>거리</th></tr><tr><td>서울 12가 3456</td><td>2026-10-09</td><td>42 km</td></tr></table></main>' };
export interface VibelationService { generateMock(): Promise<string>; draftAgreement(): Promise<AgreementItem[]>; review(request: WorkRequest): Promise<Review>; register(request: WorkRequest): Promise<Registration>; listHistory(): Registration[] }
const HISTORY = 'vibelation.history.v1';
export const mockService: VibelationService = {
 async generateMock() { await delay(); return sample.html; },
 async draftAgreement() { await delay(); return [
  { id:'period',request:'기간별 운행이력 조회',current:'최근 7일 조회만 제공',difference:'기간 입력 UI와 조회 조건 전달 필요',decision:'최대 3개월 범위로 조회한다.',resolved:false },
  { id:'export',request:'엑셀 다운로드',current:'다운로드 기능 없음',difference:'생성 API와 권한 검증 필요',decision:'관리자만 다운로드할 수 있다.',resolved:false }
 ]; },
 async review(request) { await delay(); if (!request.confirmed) throw new Error('협의사항을 먼저 확정해주세요.');
  const impacts: Review['impacts'] = [
   {id:'ui',name:'운행이력 화면',type:'UI',reason:'기간 필터와 다운로드 버튼 추가',days:2},
   {id:'logic',name:'조회 조건 검증',type:'Logic',reason:'최대 조회 기간 및 입력 검증',days:1},
   {id:'api',name:'운행이력 API',type:'API',reason:'기간 조건과 다운로드 응답 추가',days:2},
   {id:'permission',name:'관리자 다운로드',type:'Permission',reason:'관리자 권한 확인',days:1}
  ];
  const markdown = `# 검토결과 리포트 — 임시 mock\n\n> 실제 분석 결과가 아닙니다. 최종 목차는 예시자료 수령 후 변경 예정입니다.\n\n## 요청\n${request.title}\n\n${request.description}\n\n## 확정 협의사항 v${request.version}\n${request.items.map(i=>'- '+i.decision).join('\n')}\n\n## 영향 자원\n${impacts.map(i=>`- ${i.type}: ${i.name} — ${i.reason} / 예상 공수 ${i.days}일`).join('\n')}\n\n## 유사사례\n운행 현황 다운로드 개선 — 사전 준비된 시연 사례입니다.\n\n## 예상 공수와 일정\n전체 공수: 8일 (자원 작업 6일 + 통합 검증 2일).\n예상 작업 기간: 8근무일, 버퍼: 2근무일, 총 기간: 10근무일.\n1인 순차 작업 가정. 시작일·공휴일·마감 가능성은 산정하지 않았습니다.\n\n## 확인 사항\n1일 기준시간 및 실제 업무 달력은 미확정입니다. SR·운영보고서는 담당자가 별도로 작성합니다.\n`;
  return { agreementVersion:request.version, impacts,totalDays:8,durationDays:8,bufferDays:2,markdown,formatVersion:'mock-v1' };
 },
 async register(request) { await delay(); if (!request.confirmed || !request.review || request.review.agreementVersion !== request.version) throw new Error('현재 확정 버전으로 검토를 실행해주세요.'); const history = this.listHistory(); const existing = history.find(x=>x.request.id===request.id && x.request.version===request.version); if(existing) return existing; const result = {id:crypto.randomUUID(),registeredAt:new Date().toISOString(),request:structuredClone(request)}; localStorage.setItem(HISTORY,JSON.stringify([result,...history])); return result; },
 listHistory() { try { return JSON.parse(localStorage.getItem(HISTORY)||'[]') as Registration[]; } catch { return []; } }
};
