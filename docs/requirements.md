# 과제7 요구사항 대응표

모든 번호는 원문 `T07-` 기준입니다. 아래 위치에 기능과 검증을 구현했습니다. 로컬 실행 결과는 [검증 결과](evidence/verification-results.md), 실제 5일과 최종 제출의 남은 항목은 [진행 상태](roadmap.md)에 구분했습니다.

| 기준 | 요구사항 | 구현 위치 | 검증 위치 |
| --- | --- | --- | --- |
| C77~78, C100 | 최종 과제6 명시·커밋 계승·기존 자료 계정 이전 | Git 이력, `src/server/migration` | `docs/baseline`, `tests/integration/migration` |
| C91~93 | 인증 방식·이름·버전·선택과 탈락 이유 | `docs/authentication.md` | 문서·잠금 파일 대조 |
| C94~99 | 가입·로그인·로그아웃·미로그인 화면 제한·중복 가입·오류 문구 통일 | `app`, `src/features/auth`, `src/server/auth` | `tests/integration/auth`, `tests/e2e` |
| C101~107 | 해시 방식·이유·저장 형태·salt 차이·원문 비노출·라이브러리 사용 | `src/server/auth` | `tests/unit/auth`, `tests/integration/auth`, `docs/evidence/passwords` |
| C108~115 | 인증 방식·동일 요청의 로그아웃 전후·만료·URL 비노출·비밀키 보호·기존 값 폐기·마스킹 | `src/server/auth` | `tests/integration/auth`, `docs/evidence/sessions` |
| C116~122 | A/B 자료·양방향 읽기/수정/삭제 거절·403/404·변경 전후 건수 | `src/server/access-control`, `src/server/store.ts` | `tests/integration/ownership`, `docs/evidence/ownership` |
| C123~126 | URL/헤더/본문 계정 위조·미로그인 요청·목록 분리·거절 소스 위치 | `app/api`, `src/server/access-control` | `tests/integration/ownership`, `docs/evidence/ownership` |
| C127~131 | 설명서 여섯 항목·네 코드 흐름·다섯 검증 묶음·남은 한계와 위험·마스킹 | `docs/authentication.md` | `docs/verification.md`, `docs/evidence` |
| C04~08 | 질문·지표·단위 고정·서울 실제 날짜 정확히 5일·같은 계산 규칙 | `src/features/experiment`, `src/server/experiment` | `tests/unit/experiment`, `tests/integration/experiment`, 실제 사용 증거 |
| C09~12 | 2일차 뒤/3일차 전 규칙 하나 변경·시각·이유·1/2일차 참조 | `src/server/experiment` | `tests/integration/experiment`, `docs/evidence/experiment` |
| C13~15 | 변경 전후 동일 지표·단위·계산 규칙 | `src/shared/experiment`, `src/features/experiment` | `tests/unit/experiment`, `docs/evidence/experiment` |
| C23~27 | 누락·중복·이상값·반올림·주 시작 요일 명시 | `docs/experiment.md`, `src/shared/experiment` | `tests/unit/experiment` |
| C132 | 화면 합계·평균과 수동 계산 일치 | `src/shared/experiment`, `src/features/experiment` | `tests/unit/experiment`, 실제 기록 검산 |
| C133~134 | 본인 자료 파일 하나 내보내기·계정 삭제와 자료 처리 안내 | `src/server/accounts`, `src/features/account`, `app/api/export` | `tests/integration/ownership`, `tests/e2e`, `docs/evidence/data-management` |
| C01, C03 | 시크릿 창에서 결과물 로그인 첫 화면과 소스 공개 접근·개인 기록 비공개 | 배포 설정·GitHub 공개 설정 | 배포 후 수동 확인, `docs/submission.md` |
| C39~40, C46 | 확인 방법 4줄·AI 판단 3줄·공개 자료 비밀값 비노출 | `docs/submission.md` | 공개 전 문서·소스·그림·Git 이력 확인 |

A1~A7의 구현 위치는 [승인 범위](scope.md), 검증 항목은 [검증 계획](verification.md)에 연결합니다. 현재의 과제6 스키마 계약과 테스트 통과만으로 과제7 충족 상태를 표시하지 않습니다.
