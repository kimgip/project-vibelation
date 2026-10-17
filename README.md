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

## Step 01 사용법

1. 새 개선 요청을 만들고 제목·대화/텍스트·HTML·첨부를 입력합니다. 샘플을 불러올 수도 있습니다.
2. HTML 탭의 Code/Preview에서 원문과 정적 HTML/CSS 화면을 전환합니다. 전환은 생성 요청을 보내지 않습니다.
3. ‘요구사항 생성’을 누릅니다. 모든 탭의 현재 입력을 하나의 스냅샷으로 전달합니다.
4. 생성된 MD는 이력 목록에서 확인·다운로드합니다. 같은 입력으로 반복 생성해도 이전 문서가 남습니다.
5. ‘이 요구사항으로 다음 단계’를 눌러 분석에 사용할 문서를 명시적으로 적용합니다.
6. Step 02 레거시 분석 → Step 03 시스템 Mock → Step 04 리포트 생성·두 검토 체크·등록을 진행합니다.

문서 열람·새 문서 생성만으로 후속 적용 문서는 바뀌지 않습니다. 적용 문서를 변경하면 이전 분석·Mock·리포트는 재검토가 필요합니다. 입력이 바뀌면 이전 MD는 보존하되 적용을 차단합니다. 협의 내용만 수정한 경우 적용 MD는 유지하고 후속 결과만 무효화합니다.

## 서버 연결과 Mock

기본값은 서버 미연결 Mock입니다. 실제 AI 추출·첨부 내용 분석·이전 MD 종합은 수행하지 않습니다. 파일은 실제 File 객체로 어댑터에 전달되지만 Mock은 읽기·메타 응답만 시연합니다. BE 연결 시 `.env.example`을 참고하여 `VITE_REQUIREMENTS_API_URL`을 설정하고 서버를 다시 실행합니다.

`src/services/requirements.ts`의 HTTP 어댑터는 파일 multipart 업로드, 생성 POST와 Idempotency-Key, 작업 상태 조회, 문서 목록의 페이지 조회, 결과 문서 상세 조회, 적용 문서 PUT을 제공합니다. 서버는 아래 타입과 계약을 구현하고 요청 ID 생성/저장·인증·권한·CORS·파일 보존 정책을 맞춰야 합니다. 실제 BE 통합 테스트는 아직 수행하지 않았습니다. Step 02~04는 별도 시연 Mock입니다.

- 업로드 응답: `serverFileId, name, size, type`
- 생성 시작/상태 응답: `RequirementGeneration` (id, idempotencyKey, generationNumber, status, inputSnapshot, createdAt, error?). 완료 시 `document` 또는 `documentId`를 반환합니다.
- 목록 응답: `{ items: RequirementDocument[], nextCursor? }`
- 문서 응답: `RequirementDocument` (id, generationId, generationNumber, inputRevision, inputSnapshot, markdown, createdAt, source, formatVersion)
- 적용 요청: `{ documentId, expectedInputRevision }` → 200 JSON 또는 204

FE는 현재 입력 전체와 요청 ID를 전달합니다. 같은 요청의 이전 MD를 조회·종합하는 기능은 향후 BE 책임이며 FE가 기존 본문들을 합쳐 보내지 않습니다.

## 첨부·미리보기

초기 시연의 FE 제한은 파일당 5MiB·최대 5개이며 TXT/MD/HTML/PDF/DOCX/PPTX/PNG/JPG를 받습니다. 운영 지원 형식·용량은 BE와 별도 합의가 필요합니다. 업로드 중·실패·재선택 상태에서는 첨부를 포함한 생성을 차단합니다. 실패 파일의 재시도·제외가 가능합니다. 파일 binary는 localStorage에 넣지 않으므로 업로드 전 새로고침한 파일은 다시 선택해야 합니다.

HTML은 DOMPurify와 CSSOM으로 정리한 뒤 빈 sandbox iframe과 CSP로 격리합니다. 정적 CSS는 유지하고 JavaScript·이벤트·외부 자원·폼 제출·팝업은 차단합니다. 원문은 별도로 보존하여 서버 전달 시 사용합니다. MD는 읽기 전용 텍스트로 표시해 원시 HTML을 실행하지 않습니다.

## 구조·저장

- `src/domain/types.ts`: 입력 revision·생성 이력·적용 문서·분석 기준
- `src/features/RequestInput.tsx`, `useRequirements.ts`: Step 01과 생성/업로드 작업
- `src/services/requirements.ts`: RequirementsService·HTTP·Mock 어댑터
- `src/services/contract.ts`: 후속 단계 시연 서비스
- `src/storage/repositories.ts`: 스키마 검증·이전 자료 마이그레이션·등록 스냅샷
- `src/utils/htmlPreview.ts`: HTML/CSS 정적 표시 정리
- `tests/`: 버전/문서 선택·지연 응답·복구·멱등성·업로드/API 계약 테스트

새 저장 키는 `vibelation.requests.v3`, `vibelation.history.v3`입니다. v1/v2 키는 읽어 변환하고 원본을 보존합니다. 이전 단일 초안은 ‘이전 로컬 초안’으로 표시하며 자동 적용하지 않습니다. Mock 생성 작업은 `vibelation.mock.requirement-jobs.v1`에 저장해 생성 중 새로고침과 화면 재진입 후 복구합니다.

입력·등록 이력은 기기·브라우저별이며 암호화 저장소가 아닙니다. 실제 개인정보나 기밀 코드를 시연에 입력하지 마세요. 저장 실패 시 메모리 입력을 유지하고 재시도·JSON 복구용 내보내기를 제공합니다. 기술설계서는 로컬 전용으로 Git·배포에서 제외합니다.

## 배포

기존 HashRouter와 `/project-vibelation/` base, GitHub Pages 워크플로를 유지합니다. 이 작업에서는 커밋·push·배포하지 않습니다.
