# 앱 소스

현재 실행 소스는 과제6의 기능을 유지하면서 과제7 인증·소유권·자료 이전·실험·계정 관리와 UX A1~A7을 구현한 버전입니다. 역할과 검증 상태는 docs/architecture.md와 docs/evidence/verification-results.md에 있습니다.

`Diary.tsx`가 탐색·서버 상태·저장 및 복구를 연결합니다. `features`에서 계획·할 일·실행·돌아보기·오늘 화면을 관리하고 `components/ui`는 공통 모달·빈 상태·폼 오류를 담당합니다.

서버는 `server/store.ts`, 계산·날짜·정렬 규칙과 타입은 `shared/domain.ts`, 클라이언트 통신은 `shared/client.ts`에 있습니다. 라우팅과 서버 바인딩은 루트 `app`에 둡니다. DB 바인딩과 설정은 클라이언트로 전달하지 않습니다.
