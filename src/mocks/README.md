# Mock 데이터 수정 안내

고정 응답과 시연 콘텐츠는 아래 JSON에서 수정합니다. API의 실제 네트워크 응답 파일이 아니라 로컬 Mock 서비스가 읽는 데이터/문서 양식입니다.

| 파일                       | 서비스 위치                     | 수정 대상                                                                 |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| `download-center.json`     | 공통 샘플                       | 입력 샘플(sample), 유사 사례(cases), 자료명(materials)                    |
| `step01-requirements.json` | Step 01 _ 요구사항 문서 생성    | MD 양식(markdownTemplate), 문서 형식 버전                                 |
| `step01-system-mock.json`  | Step 01 _ 시스템 적용 예상 화면 | 시연용 HTML(html), 내부 응답 메타데이터                                   |
| `step02-analysis.json`     | Step 02 _ 레거시 분석           | 영향 자원(impacts), 공수(totalDays), 기간(durationDays), 버퍼(bufferDays) |
| `step03-report.json`       | Step 03 _ 최종 검토 리포트      | 리포트 양식(markdownTemplate), 영향 자원별 표현(impactTemplate)           |

`step01-system-mock.json`의 html은 표시 화면과 다운로드에 공통 사용합니다. 독립 HTML의 자체 자료 목록은 이 html 안에 있으며 `download-center.json`의 materials는 기존 React 시연 화면용입니다. HTML은 검토한 로컬 시연 코드만 작성하고 기존 CSP를 유지합니다.

## 문서 자리표시자

- 요구사항 MD: `{{generationNumber}}`, `{{title}}`, `{{inputRevision}}`, `{{text}}`, `{{html}}`, `{{attachments}}`
- 리포트: `{{title}}`, `{{revision}}`, `{{legacyVersion}}`, `{{documentId}}`, `{{requirements}}`, `{{impacts}}`
- 영향 자원별 표현: `{{type}}`, `{{name}}`, `{{proposed}}`, `{{reason}}`, `{{path}}`, `{{days}}`

JSON 문자열의 줄바꿈은 `\n`, 큰따옴표는 `\"`로 작성합니다. 위 자리표시자만 사용할 수 있으며, 알 수 없는 키는 오류를 표시합니다. 입력값에 포함된 자리표시자나 코드는 재해석하지 않습니다. 숫자·배열 등 기존 JSON 타입을 유지하고 공수 변경 시 리포트의 설명도 함께 수정합니다.

요청 ID·생성 번호·생성 시각·입력 스냅샷·작업 상태·지연·취소·멱등성은 서비스 코드에서 처리합니다. 데이터를 수정해도 기존에 저장된 MD/확정/리포트 이력은 바뀌지 않습니다. MD와 리포트는 새로 생성해야 변경 내용을 확인할 수 있습니다. 예상 화면 HTML은 개발 서버의 갱신 또는 새로고침으로 반영됩니다.

`fixtures.ts`는 JSON을 읽고 자원 유형/고정 식별값을 확인합니다. `template.ts`는 문서 자리표시자만 치환합니다. 기존 `download-center.ts`는 이전 import 경로를 유지하는 호환 모듈입니다.
