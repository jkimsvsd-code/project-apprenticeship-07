# 인증 API 진입점

상태: 구현 또는 검증 계약을 추가했습니다. 실제 실행 결과와 검증 한계는 프로젝트 루트 docs/evidence/verification-results.md를 참고합니다.

가입·로그인·로그아웃·비밀번호 변경을 연결합니다. 비밀번호 처리와 인증값 만료·폐기는 src/server/auth에서 담당합니다. 실제 경로와 HTTP 방식은 구현 시 확정합니다.
