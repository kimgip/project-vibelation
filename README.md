# VIBELATION

한국어 FE 중심 시연용 MVP. React + Vite + TypeScript.

## 실행

Node.js 20.19 이상 또는 22.12 이상 환경에서:

```sh
npm install
npm run dev
```

화면: http://127.0.0.1:5173/project-vibelation/

```sh
npm run build
npm run preview
```

검증: 2026-10-09 Node.js 24.15.0에서 의존성 설치, TypeScript 검사 및 프로덕션 빌드 성공. 브라우저를 통한 시각·사용자 흐름 검증은 아직 수행하지 않았습니다.

## 시연

1. 새 요청 → 샘플 불러오기 → 화면 구체화
2. Mock 화면 생성 → 협의 시작
3. 협의 초안 불러오기 → 두 항목 확인 → 협의사항 확정
4. 검토결과로 이동 → 검토 실행
5. 영향도 노드, 유사사례, 공수·일정, 리포트 탭 확인
6. 검토결과 Markdown 다운로드
7. 협의사항·검토결과 등록 → 이력 상세 조회

협의사항을 새 버전으로 수정하면 이전 결과 등록이 차단됩니다. 분석을 다시 실행해주세요.

## 범위

- 실제 분석은 수행하지 않으며 고정 시나리오의 mock 응답을 반환합니다.
- 전체 예상 공수 8일과 총 기간 10근무일은 샘플 값입니다. 1일 기준시간은 미확정입니다.
- 리포트 목차는 예시자료 수령 후 변경할 임시 mock입니다.
- 다운로드는 검토결과만 제공합니다. SR·운영보고서는 사람이 별도로 작성합니다.
- 등록은 BE 전송을 대신하는 브라우저 로컬 저장입니다.
- 개인정보나 실제 코드를 입력하지 마세요. localStorage는 암호화 저장소가 아닙니다.
- HTML 미리보기는 sandbox와 CSP로 실행·외부 통신을 제한합니다.

## 구조

- `src/domain.ts`: 데이터 타입
- `src/services.ts`: 서비스 인터페이스와 mock 구현, 이력 저장
- `src/main.tsx`: 라우트별 화면과 사용자 흐름
- `src/style.css`: 반응형 UI
- 기술설계서는 로컬에만 보관하며 Git 추적과 배포에서 제외합니다.

## GitHub Pages

`main`에 push하면 `.github/workflows/pages.yml`에서 빌드·배포합니다.
GitHub 저장소 Settings → Pages → Source를 GitHub Actions로 설정하세요.
예상 주소: https://kimgip.github.io/project-vibelation/
HashRouter를 사용하여 하위 화면에서 새로고침해도 정적 호스팅의 404를 피합니다.
입력 내용과 등록 이력은 각 기기·브라우저에만 저장되며 자동 동기화되지 않습니다.

다음 단계: 실제 예시자료로 mock 데이터/리포트 교체, 화면별 모듈 분리, HTTP 서비스 구현, BE API 계약 확정, 브라우저 검증. 현재 그래프는 선택 가능한 SVG 연결 노드이며 확대·이동 기능은 없습니다. 직접 입력한 임의 요청도 같은 샘플 분석을 표시합니다.

로컬 초기화: 브라우저 개발자 도구에서 `vibelation.request.v1`과 `vibelation.history.v1`을 삭제합니다.
