# Mock 데이터 수정 안내

고정 응답과 시연 콘텐츠는 아래 JSON에서 수정합니다. API의 실제 네트워크 응답 파일이 아니라 로컬 Mock 서비스가 읽는 데이터/문서 양식입니다.

| 파일                       | 서비스 위치                     | 수정 대상                                                                 |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| `local-settings.json` | 로컬 Mock 공통 | 시연 레거시 기준, 화면 종류 선택지, 첨부 정책·안내 양식, 작업 지연, 빈 입력 대체문 |
| `team.json` | 팀 현황 | 기준일, 상태 목록, 요청·담당자·희망일 목록 (통계는 목록에서 계산) |
| `product-preview.json` | React 제품 화면 시연 | 카테고리·언어·선택 한도·문구·성공/부분 실패/실패 안내 양식 |
| `history.json` | 과거 검토 이력 | 목록·상세의 불변 등록 스냅샷 |
| `download-center.json`     | 공통 샘플                       | 입력 샘플(sample), 유사 사례(cases), 자료명(materials)                    |
| `step01-requirements.json` | Step 01 _ 요구사항 문서 생성    | MD 양식(markdownTemplate), 문서 형식 버전                                 |
| `step01-system-mock.json`  | Step 01 _ 시스템 적용 예상 화면 | 시연용 HTML(html), 내부 응답 메타데이터                                   |
| `step02-analysis.json`     | Step 02 _ 레거시 분석           | 영향 자원(impacts), 공수(totalDays), 기간(durationDays), 버퍼(bufferDays) |
| `step03-report.json`       | Step 03 _ 최종 검토 리포트      | 리포트 양식(markdownTemplate), 영향 자원별 표현(impactTemplate)           |

`step01-system-mock.json`의 html은 표시 화면과 다운로드에 공통 사용합니다. 독립 HTML의 자체 자료 목록은 이 html 안에 있으며 `download-center.json`의 materials는 기존 React 시연 화면용입니다. HTML은 검토한 로컬 시연 코드만 작성하고 기존 CSP를 유지합니다.

## 문서 자리표시자

- 요구사항 MD: `{{generationNumber}}`, `{{title}}`, `{{screenType}}`, `{{text}}`, `{{html}}`, `{{attachments}}`
- 리포트: `{{title}}`, `{{revision}}`, `{{legacyVersion}}`, `{{documentId}}`, `{{requirements}}`, `{{impacts}}`
- 영향 자원별 표현: `{{type}}`, `{{name}}`, `{{proposed}}`, `{{reason}}`, `{{path}}`, `{{days}}`

JSON 문자열의 줄바꿈은 `\n`, 큰따옴표는 `\"`로 작성합니다. 위 자리표시자만 사용할 수 있으며, 알 수 없는 키는 오류를 표시합니다. 입력값에 포함된 자리표시자나 코드는 재해석하지 않습니다. 숫자·배열 등 기존 JSON 타입을 유지하고 공수 변경 시 리포트의 설명도 함께 수정합니다.

요청 ID·생성 번호·생성 시각·입력 스냅샷·작업 상태 전환·취소·멱등성은 서비스 코드에서 처리합니다. 시연 지연 시간은 `local-settings.json`의 timing을 사용합니다. 데이터를 수정해도 기존에 저장된 MD/확정/리포트 이력은 바뀌지 않습니다. MD와 리포트는 새로 생성해야 변경 내용을 확인할 수 있습니다. 예상 화면 HTML은 개발 서버의 갱신 또는 새로고침으로 반영됩니다.

`fixtures.ts`는 JSON을 읽고 자원 유형/고정 식별값을 확인합니다. `template.ts`는 문서 자리표시자만 치환합니다. 기존 `download-center.ts`는 이전 import 경로를 유지하는 호환 모듈입니다.

## 과거 검토 이력 Mock

`history.json`의 `items`는 과거 검토 이력 목록·상세 조회용 등록 스냅샷입니다. `src/services/history.ts`의 `createMockHistoryService`가 비동기로 목록(`list`)과 상세(`get`)를 반환합니다. 서버 HTTP 요청은 하지 않습니다. 화면에는 JSON 샘플과 직접 등록한 로컬 이력을 함께 표시하고 같은 ID는 로컬 이력을 우선합니다. 샘플은 localStorage에 저장하지 않습니다. JSON을 수정한 후 이력 페이지를 다시 열면 반영됩니다. 데이터의 `request`는 등록 당시 스냅샷이므로 요구사항·확정·리포트 ID의 연결 관계와 기존 필드 타입을 유지해주세요.


모든 고정 Mock 콘텐츠는 JSON을 정적 import합니다. 네트워크로 별도 JSON을 가져오는 방식은 아니며 빌드에 포함됩니다. 배포된 데이터를 바꾸려면 JSON 수정 후 다시 빌드·배포해야 합니다. 실행 시 생성되는 ID·시각·입력 스냅샷과 사용자가 등록한 이력은 고정 fixture가 아니므로 서비스가 구성하고 저장합니다. 화면의 일반 버튼·레이블과 업무 규칙은 코드에 유지합니다.

`step01-system-mock.json`은 독립 실행 문서 전체를 포함하며, HTML 내부의 시연 데이터도 이 JSON에서 관리합니다. `product-preview.json`은 기존 React ProductPreview용이며 두 화면의 실행 구조는 별개입니다.


최신 UX 재통합: step01-requirements.json은 requirement-mock-v4이며 vN 제목 표기를 유지하고 화면 종류(new/modify의 표시명)를 본문에 반영합니다. 이전에 생성한 문서는 변경하지 않습니다. local-settings.json의 screenTypes가 선택 버튼과 MD 표시명을 함께 제공합니다. 팀/이력 샘플 내용은 ebcc983과 대조해 동일함을 확인했으며, 새 팀 통계 버튼/필터/상세 펼침은 team.json의 목록·기준일을 읽습니다.
