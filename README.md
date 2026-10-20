# 쇳물

요구사항을 녹여, 기존 틀에 붓다. Figma 시안의 색상·로고·문구를 적용한 요구사항 검토 작업실입니다.

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

## Figma 화면 흐름과 코드 ZIP

시작 → 틀 고르기 → 쇳물 녹이기 → 성분 보기 → 미리 붓기(선택) → 탕도 살피기 → 붓기 준비 완료 순서로 화면을 나눴습니다. 기존 요청·문서·확정·등록 이력은 유지합니다.

설정 · 레거시 틀 관리에서 시스템 이름과 프론트엔드/백엔드 ZIP을 등록합니다. ZIP 실제 bytes는 브라우저 IndexedDB에 보관하며, 적용한 코드 기준은 이전 버전을 보존합니다. 새 기준을 기존 요청에 자동 적용하지 않습니다. 브라우저 보관 상한은 파일당 100MiB이며 ZIP 내부 검증·압축 해제는 수행하지 않습니다.

`VITE_GENERATION_API_URL`(예: `https://server.example/api`)을 설정하면 Mock 생성과 레거시 분석 시점에 MD와 선택 코드 ZIP을 함께 전송합니다. multipart 필드는 `file`(requirements.md), 반복 `sourceFiles`(ZIP), `sourceManifest`(index/id/name/role/sha256/sizeBytes JSON), `legacyVersion`입니다. Mock 생성은 `requirementDocumentId`도 보냅니다. Content-Type은 브라우저가 boundary와 함께 설정합니다. 서버 URL·필드·응답은 BE 합의 전 제안 계약입니다.

미설정 시 실제 서버 전송 없이 기존 로컬 시연을 제공합니다. `VITE_REQUIREMENTS_API_URL`은 기존 MD 생성용 별도 설정이며 두 기능의 서버 설정을 혼동하지 않습니다. 임의 서버 HTML은 스크립트를 차단한 정적 Preview로 표시하며, 사전 작성된 신뢰된 동작 Mock만 기존 격리 실행을 유지합니다.

## 기존 핵심 기능


1. Step 01 자료 입력·확정: 입력 → 요구사항 MD 생성 → ‘이 문서로 협의하기’로 기준 선택.
2. 필요하면 시스템 적용 예상 화면을 생성합니다. 버전 목록 없이 최신 화면만 보여주며 HTML 코드 다운로드로 현업에게 전달합니다.
3. 협의한 사항을 요구사항 MD에 반영한 후 ‘요구사항 확정 후 분석하기’를 누릅니다.
4. Step 02 레거시 분석에는 확정한 requirements.md와 선택한 레거시 코드 ZIP들을 전달합니다. Mock HTML·원본 입력·일반 첨부·별도 협의 필드는 분석 요청에 포함하지 않습니다.
5. Step 03 최종 검토: 리포트 생성 → 두 최종 검토 체크 → 등록합니다.

확정은 요구사항 MD의 불변 스냅샷입니다. Mock 생성·열람은 확정과 분석 결과에 영향을 주지 않습니다. 입력·기준 문서 변경 시 재확정해야 합니다. 이전 확정 이력은 보존하며, 이전 방식의 확정은 MD만 사용하는 기준으로 다시 확정합니다.

기존 `/agreement`·`/mock` 링크는 Step 01로 안내합니다. 기존 요청·등록 이력은 보존하고 3단계에서 새로 확정한 것으로 변환하지 않습니다.

## 서버 연결과 Mock

`.env.local`에 `VITE_API_URL=http://127.0.0.1:8000/api`를 설정하고 Vite를 다시 실행하면 서버 모드로 동작합니다. 미설정 시 기존 로컬 Mock을 사용합니다. 이전 환경변수는 호환 별칭이며 `VITE_API_URL`이 우선합니다. 서버 모드의 실패를 로컬 성공으로 대체하지 않습니다.

현재 계약의 34개 API 호출을 `src/services/backendApi.ts`에 제공합니다. 요청 생성·목록·복원·입력 저장, 첨부 정책·업로드·처리 조회, MD 생성·이력·상세·선택, 선택적 화면 생성, MD 확정·이력, 분석, 리포트, 최종 등록·이력을 화면에 연결했습니다. MD 선택은 이전 PUT 대신 revision을 포함한 요청 PATCH를 사용합니다. Job의 결과 본문과 `{type,id}` 참조 응답을 지원하고 참조는 상세 API로 조회합니다.

서버가 발급한 요청·문서·확정 ID와 서버 revision을 사용합니다. 입력 저장은 변경 후 지연 저장하며 생성·선택·확정 전에 다시 동기화합니다. 동일 요청의 revision 쓰기는 순차 처리합니다. 생성/업로드/확정/등록의 멱등 키와 진행 작업 ID는 재시도에 유지합니다. 서버 모드 캐시는 API base별로 구분하며 기존 로컬 시연 자료를 자동 전송하지 않습니다. 충돌·인증·업로드 오류는 입력을 유지한 채 표시합니다. 명시적인 서버 재조회는 서버 저장 내용을 다시 불러옵니다.

인증 요청은 `credentials: include`로 전송합니다. 서버가 다른 출처이면 정확한 FE origin과 credential CORS를 허용해야 합니다. HTTPS 화면에서 HTTP 서버를 호출하면 브라우저가 차단할 수 있습니다. OIDC 로그인 화면과 운영 CSRF 정책은 서버 인증 계약 확정 후 연결해야 합니다.

## 시스템 적용 화면·레거시 코드

브라우저 코드 ZIP 보관과 선택은 기존 IndexedDB 흐름을 유지합니다. 화면 생성·분석 요청에서 MD와 실제 코드 ZIP, 분류·크기·SHA-256 manifest를 함께 전송합니다. 서버 모드에서는 전송할 ZIP을 먼저 등록·적용하고 요청에서 선택해야 합니다. 반환된 HTML은 정적 격리 Preview로 표시하며 임의 서버 JavaScript를 앱 DOM에서 실행하지 않습니다.

서버 설정 시 레거시 설정 상단에 별도 서버 관리 화면을 제공합니다. SYS/SRC 6개 API로 시스템 생성·조회·초안 저장·적용, ZIP 업로드·교체·상태·구성 제외를 호출합니다. 시스템 목록 API가 없어 시스템 ID로 기존 초안을 불러옵니다. 적용은 revision, 제외는 If-Match를 보냅니다. 현재 Mock 백엔드가 501을 반환하는 경로는 미구현 오류로 표시합니다. 브라우저 코드 보관과 서버 관리의 성공 상태를 혼용하지 않습니다.

서버 MD 응답에 생성 당시 inputSnapshot이 없으면 이 브라우저에 보관한 생성 입력을 복원합니다. 다른 브라우저에서 만든 문서는 당시 입력 자료를 조회할 수 없다고 표시합니다. 첨부 원본 다운로드 API는 현재 계약과 백엔드에 없어 추가하지 않았습니다. 서버의 DB·AI·원본 저장 구현 여부와 API 호출 성공은 별개입니다.

## 첨부·미리보기

초기 시연의 FE 제한은 파일당 5MiB·최대 5개이며 TXT/MD/HTML/PDF/DOCX/PPTX/PNG/JPG를 받습니다. 운영 지원 형식·용량은 BE와 별도 합의가 필요합니다. 업로드 중·실패·재선택 상태에서는 첨부를 포함한 생성을 차단합니다. 실패 파일의 재시도·제외가 가능합니다. 파일 binary는 localStorage에 넣지 않으므로 업로드 전 새로고침한 파일은 다시 선택해야 합니다.

HTML은 DOMPurify와 CSSOM으로 정리한 뒤 빈 sandbox iframe과 CSP로 격리합니다. 정적 CSS는 유지하고 JavaScript·이벤트·외부 자원·폼 제출·팝업은 차단합니다. 원문은 별도로 보존하여 서버 전달 시 사용합니다. MD는 읽기 전용 텍스트로 표시해 원시 HTML을 실행하지 않습니다.

## 구조·저장

- `src/domain/types.ts`: 입력 revision·생성 이력·적용 문서·분석 기준
- `src/features/RequestInput.tsx`, `useRequirements.ts`: Step 01과 생성/업로드 작업
- `src/features/SystemMockPanel.tsx`, `RequirementConfirmationPanel.tsx`: 선택적 동작 Mock·협의·확정
- `src/services/systemMocks.ts`: 선택 Mock 생성·복원·서버 생성 어댑터
- `src/services/requirements.ts`: RequirementsService·HTTP·Mock 어댑터
- `src/services/contract.ts`: 분석 어댑터·로컬 시연 서비스
- `src/services/backendApi.ts`, `serverWorkspace.ts`: 전체 API 클라이언트·서버 응답 매핑·확정·리포트·등록
- `src/storage/repositories.ts`: 스키마 검증·이전 자료 마이그레이션·등록 스냅샷
- `src/utils/htmlPreview.ts`: HTML/CSS 정적 표시 정리
- `tests/`: 버전/문서 선택·지연 응답·복구·멱등성·업로드/API 계약 테스트

새 저장 키는 `vibelation.requests.v4`, `vibelation.history.v4`입니다. v1/v2/v3 키는 읽어 변환하고 원본을 보존합니다. 이전 단일 초안은 ‘이전 로컬 초안’으로 표시하며 자동 적용하지 않습니다. Mock 생성 작업은 `vibelation.mock.requirement-jobs.v1`에 저장해 생성 중 새로고침과 화면 재진입 후 복구합니다.

입력·등록 이력은 기기·브라우저별이며 암호화 저장소가 아닙니다. 실제 개인정보나 기밀 코드를 시연에 입력하지 마세요. 저장 실패 시 메모리 입력을 유지하고 재시도·JSON 복구용 내보내기를 제공합니다. 기술설계서는 로컬 전용으로 Git·배포에서 제외합니다.

## 배포

기존 HashRouter와 `/project-vibelation/` base, GitHub Pages 워크플로를 유지합니다. 이 작업에서는 커밋·push·배포하지 않습니다.

## Mock JSON 데이터

단계별 고정 응답과 문서 양식은 `src/mocks/*.json`에 있습니다. 상세 파일 목록·자리표시자·수정 후 반영 방법은 [Mock 데이터 안내](src/mocks/README.md)를 참고하세요. 생성 ID·상태·입력값 반영은 서비스 코드에서 처리합니다. JSON 수정은 이미 저장된 문서 이력을 변경하지 않으며 새로 생성한 결과에 적용됩니다.

## 리팩터링 구조와 검증

- `src/main.tsx`: React 진입점; `src/App.tsx`: 화면 분기
- `src/features/useWorkspace.ts`: 요청 저장·경합·확정·분석·리포트·등록
- `src/components/WorkflowShell.tsx`: 헤더·진행 표시·요청 컨텍스트
- `src/features/LegacySettings.tsx`, `LegacyPicker.tsx`: 코드 보관·기준 선택
- `src/features/MaterialCards.tsx`, `RequestInput.tsx`: 자료 입력·MD 검토
- `src/features/AnalysisPage.tsx`, `ReviewPage.tsx`: 영향 자원·최종 검토
- `src/domain/legacySources.ts`, `src/storage/legacySources.ts`: ZIP payload·IndexedDB 저장
- `src/services/generationTransport.ts`: 공통 MD+ZIP 전송

`npm test`는 도메인·HTTP 계약 회귀 검증입니다. 브라우저 검증은 `node tests/browser-workflow.mjs`, 서버 응답 대역 검증은 `node tests/browser-generation.mjs`로 실행합니다. Playwright와 Chrome이 필요하며, 번들 런타임 사용 시 `PLAYWRIGHT_MODULE`에 Playwright 패키지 경로를 지정합니다. 두 스크립트는 임시 로컬 Vite 서버와 격리된 브라우저를 사용합니다. 서버 응답은 테스트에서 대체하며 실제 BE 통합 성공을 뜻하지 않습니다. 스크린샷은 Git 제외된 `test-results/`에 저장합니다.

요구사항 문서 이력의 vN을 선택하면 같은 번호의 입력 자료에서 생성 당시 텍스트·HTML 코드/정적 미리보기·첨부 목록을 조회합니다. 열람은 현재 입력과 협의 기준을 바꾸지 않습니다. 버전별 원문 보존 검증은 `node tests/browser-documentVersions.mjs`로 실행합니다.


## 최신 디자인 재통합 (ebcc983)

새 단계 버튼, MD 협의 기준의 4초 알림/되돌리기, 미리보기 생략, 이력 카드와 팀 현황 필터·상세 펼침을 유지하며 API 모드를 연결했습니다. MD 최초 선택 취소도 workingRequirementDocumentId:null PATCH로 서버에 반영합니다. 화면 종류(new/modify)는 입력 스냅샷과 로컬 MD에 보존하며 변경 시 재확정을 요구합니다. 서버에는 input.screenType을 전송하지만 현재 Mock 백엔드 스키마가 이 필드를 저장하지 않으므로 서버 측 필드 추가가 필요합니다. 이전 브라우저의 선택 값은 로컬 복원 정보로 보존하며 다른 기기 복원을 보장하지 않습니다.

샘플 MD는 최신 디자인의 vN 제목과 화면 종류를 담는 requirement-mock-v4 양식입니다. 팀·이력 샘플은 최신 브랜치와 내용이 같아 유지하고 데이터 참조만 JSON으로 분리했습니다. 팀 현황의 실제 서버 API는 아직 없으므로 팀 목록은 계속 샘플이며, 검토 이력 조회는 환경 설정에 따라 서버/로컬 서비스를 사용합니다.
