# VIBELATION

React + Vite + TypeScript 기반 한국어 프런트엔드 시연 앱입니다.

## 실행·검증

Node.js 24.15 이상을 권장합니다.

```sh
npm ci
npm run dev
npm test
npm run build
```

개발 주소: http://127.0.0.1:5173/project-vibelation/

## 3단계 사용법

1. Step 01 자료 입력·확정: 입력 → 요구사항 MD 생성 → ‘이 문서로 협의하기’로 기준 선택.
2. 필요하면 Step 01 안에서 시스템 적용 Mock을 생성하고 선택·언어·검증·성공/실패 안내를 확인합니다. Mock 생성·확인과 생략 이유는 필수가 아닙니다.
3. 합의 범위·수용 기준·제외 범위·미확정 사항을 정리하고 ‘Mock 없이 요구사항 확정’ 또는 ‘요구사항 확정 후 분석하기’를 누릅니다. 빈 협의 항목도 허용합니다.
4. Step 02 레거시 영향도 분석: 확정 묶음을 기준으로 자원·근거·사례·공수를 확인합니다.
5. Step 03 최종 검토: 리포트 생성 → 두 최종 검토 체크 → 등록합니다.

확정 묶음은 MD·선택 Mock(없음 가능)·Mock 확인 여부·협의 내용의 불변 스냅샷입니다. 입력·기준 문서·포함 Mock·협의 내용 변경 후에는 재확정해야 합니다. 생성 완료나 과거 문서 열람만으로 확정 내용이 바뀌지 않습니다. 새 분석을 실행하면 이전 분석을 사용한 리포트는 등록할 수 없습니다.

기존 `/agreement`·`/mock` 링크는 Step 01로 안내합니다. 기존 요청·등록 이력은 보존하고 3단계에서 새로 확정한 것으로 변환하지 않습니다.

## 서버 연결과 Mock

기본값은 서버 미연결 Mock입니다. 실제 AI 추출·첨부 내용 분석·이전 MD 종합은 수행하지 않습니다. 파일은 실제 File 객체로 어댑터에 전달되지만 Mock은 읽기·메타 응답만 시연합니다. BE 연결 시 `.env.example`을 참고하여 `VITE_REQUIREMENTS_API_URL`을 설정하고 서버를 다시 실행합니다.

`src/services/requirements.ts`의 HTTP 어댑터는 파일 multipart 업로드, 생성 POST와 Idempotency-Key, 작업 상태 조회, 문서 목록의 페이지 조회, 결과 문서 상세 조회, 적용 문서 PUT을 제공합니다. 서버는 아래 타입과 계약을 구현하고 요청 ID 생성/저장·인증·권한·CORS·파일 보존 정책을 맞춰야 합니다. 실제 BE 통합 테스트는 아직 수행하지 않았습니다. 요구사항 확정·선택적 시스템 Mock·Step 02~03은 로컬 시연 Mock입니다.

- 업로드 응답: `serverFileId, name, size, type`
- 생성 시작/상태 응답: `RequirementGeneration` (id, idempotencyKey, generationNumber, status, inputSnapshot, createdAt, error?). 완료 시 `document` 또는 `documentId`를 반환합니다.
- 목록 응답: `{ items: RequirementDocument[], nextCursor? }`
- 문서 응답: `RequirementDocument` (id, generationId, generationNumber, inputRevision, inputSnapshot, markdown, createdAt, source, formatVersion)
- 적용 요청: `{ documentId, expectedInputRevision }` → 200 JSON 또는 204

FE는 현재 입력 전체와 요청 ID를 전달합니다. 같은 요청의 이전 MD를 조회·종합하는 기능은 향후 BE 책임이며 FE가 기존 본문들을 합쳐 보내지 않습니다.

## 시스템 적용 동작 Mock

`src/services/systemMocks.ts`는 사전 작성된 다운로드 센터 시연 컴포넌트를 반환하는 로컬 Mock입니다. 임의의 AI 생성 HTML/JavaScript를 앱 DOM이나 기존 정적 Preview에서 실행하지 않습니다. 샘플 데이터로 선택·검색·언어·10개 상한·성공/부분 누락/실패 안내를 시연합니다. 실제 레거시 분석·서버 AI 코드 생성·운영 API는 연결하지 않았습니다.

서버 생성 코드를 실행하려면 기술설계 v0.9/API IF의 별도 출처·검증된 런타임·CSP·단기 Preview 세션이 필요하며 아직 미연결입니다. 기존 `VITE_REQUIREMENTS_API_URL`은 v0.8 요구사항 생성 어댑터용으로, 새 확정/영향도/등록 API 전체 연결을 의미하지 않습니다.

## 첨부·미리보기

초기 시연의 FE 제한은 파일당 5MiB·최대 5개이며 TXT/MD/HTML/PDF/DOCX/PPTX/PNG/JPG를 받습니다. 운영 지원 형식·용량은 BE와 별도 합의가 필요합니다. 업로드 중·실패·재선택 상태에서는 첨부를 포함한 생성을 차단합니다. 실패 파일의 재시도·제외가 가능합니다. 파일 binary는 localStorage에 넣지 않으므로 업로드 전 새로고침한 파일은 다시 선택해야 합니다.

HTML은 DOMPurify와 CSSOM으로 정리한 뒤 빈 sandbox iframe과 CSP로 격리합니다. 정적 CSS는 유지하고 JavaScript·이벤트·외부 자원·폼 제출·팝업은 차단합니다. 원문은 별도로 보존하여 서버 전달 시 사용합니다. MD는 읽기 전용 텍스트로 표시해 원시 HTML을 실행하지 않습니다.

## 구조·저장

- `src/domain/types.ts`: 입력 revision·생성 이력·적용 문서·분석 기준
- `src/features/RequestInput.tsx`, `useRequirements.ts`: Step 01과 생성/업로드 작업
- `src/features/SystemMockPanel.tsx`, `RequirementConfirmationPanel.tsx`: 선택적 동작 Mock·협의·확정
- `src/services/systemMocks.ts`: 선택 Mock 생성·복원용 로컬 시연 서비스
- `src/services/requirements.ts`: RequirementsService·HTTP·Mock 어댑터
- `src/services/contract.ts`: 후속 단계 시연 서비스
- `src/storage/repositories.ts`: 스키마 검증·이전 자료 마이그레이션·등록 스냅샷
- `src/utils/htmlPreview.ts`: HTML/CSS 정적 표시 정리
- `tests/`: 버전/문서 선택·지연 응답·복구·멱등성·업로드/API 계약 테스트

새 저장 키는 `vibelation.requests.v4`, `vibelation.history.v4`입니다. v1/v2/v3 키는 읽어 변환하고 원본을 보존합니다. 이전 단일 초안은 ‘이전 로컬 초안’으로 표시하며 자동 적용하지 않습니다. Mock 생성 작업은 `vibelation.mock.requirement-jobs.v1`에 저장해 생성 중 새로고침과 화면 재진입 후 복구합니다.

입력·등록 이력은 기기·브라우저별이며 암호화 저장소가 아닙니다. 실제 개인정보나 기밀 코드를 시연에 입력하지 마세요. 저장 실패 시 메모리 입력을 유지하고 재시도·JSON 복구용 내보내기를 제공합니다. 기술설계서는 로컬 전용으로 Git·배포에서 제외합니다.

## 배포

기존 HashRouter와 `/project-vibelation/` base, GitHub Pages 워크플로를 유지합니다. 이 작업에서는 커밋·push·배포하지 않습니다.
