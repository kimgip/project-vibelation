import type { Impact } from "../domain/types";
export const sample = {
  title: "다운로드 센터 다중 선택 및 일괄 다운로드 개선",
  text: "김현업  10:24\n다운로드 센터에서 필요한 자료를 여러 개 선택해서 한 번에 내려받고 싶어요.\n\n박운영  10:27\n현재는 파일마다 KOR / ENG 버튼을 눌러야 합니다. 선택한 자료를 ZIP으로 받는 방식이면 될까요?\n\n김현업  10:32\n네, 언어도 선택하고 싶어요. 최대 10개까지면 충분합니다. 다운로드 이력도 확인할 수 있으면 좋겠어요.",
  agreement:
    "자료를 최대 10개 선택할 수 있다. 선택한 언어의 파일만 ZIP으로 제공한다. 일부 파일이 누락되거나 다운로드에 실패하면 안내한다. 기존 상세 모달 스타일을 재사용한다.\n\n제외 범위: 실제 ZIP 생성과 운영 시스템 반영.\n미확정 사항: ZIP 최대 용량·서버 접근 권한·이력 저장 정책은 운영 연결 전 별도 확정한다.",
};
export const impacts: Impact[] = [
  {
    id: "ui",
    name: "다운로드 센터 화면",
    type: "UI",
    path: "demo/download-center/DownloadList.tsx",
    current: "언어별 개별 다운로드 링크",
    proposed: "자료 선택 체크박스와 선택 다운로드 영역 추가",
    reason: "다중 선택·언어 선택 수용 기준에 연결",
    days: 2,
  },
  {
    id: "logic",
    name: "선택 상태 · 모달",
    type: "Logic",
    path: "demo/download-center/selection.ts",
    current: "개별 파일 링크 · 상세 모달",
    proposed: "최대 10개 검증, 기존 모달 스타일 재사용",
    reason: "선택 상한과 부분 실패 안내 조건에 연결",
    days: 1.5,
  },
  {
    id: "api",
    name: "다운로드 API",
    type: "API",
    path: "demo/api/downloads",
    current: "자료 목록·상세 조회",
    proposed: "일괄 다운로드 요청 및 ZIP 응답 API 검토",
    reason: "언어별 파일 구성·크기 제한 검증 필요",
    days: 2,
  },
  {
    id: "db",
    name: "다운로드 이력",
    type: "DB",
    path: "demo/schema/download_history",
    current: "개별 다운로드 이력 (가정)",
    proposed: "일괄 다운로드와 이력 저장 연계 검토",
    reason: "요청한 이력 확인 기능의 저장 근거 필요",
    days: 1,
  },
  {
    id: "permission",
    name: "파일 접근 권한",
    type: "Permission",
    path: "demo/policies/download",
    current: "기존 개별 파일 권한 (가정)",
    proposed: "선택한 모든 파일의 서버 권한 확인",
    reason: "일괄 처리 시 파일별 접근 범위 보존 필요",
    days: 1,
  },
];
export const cases = [
  {
    title: "검색 조건 및 카테고리 탐색 개선",
    reason: "목록 상태와 공통 검색 UI를 함께 변경",
    difference: "ZIP 처리와 파일 권한은 포함하지 않은 시연 사례",
  },
  {
    title: "고객지원 자료 상세 안내 개선",
    reason: "자료 상세 모달과 파일 정보 표현 개선",
    difference: "다중 선택 기능이 없어 공수를 그대로 적용할 수 없음",
  },
];
export const materials = [
  "열연 제품 카탈로그",
  "냉연 제품 카탈로그",
  "자동차 강판 안내",
  "고강도 강판 가이드",
  "전기강판 제품 소개",
  "스테인리스 제품 안내",
  "제품 인증 자료",
  "가공 기술 가이드",
  "품질 관리 안내",
  "친환경 제품 소개",
  "신제품 기술 자료",
  "고객지원 가이드",
];
