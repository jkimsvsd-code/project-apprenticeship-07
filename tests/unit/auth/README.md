# 인증 단위 검증 위치

인증의 주요 요구사항은 tests/integration/auth의 실제 Better Auth·SQLite 검증과 tests/integration/http-auth.mjs의 실제 Worker 검증에서 확인합니다. 라이브러리 내부 동작을 복제하는 단위 테스트는 추가하지 않았습니다. 독립된 순수 함수가 생기면 이 위치에서 검증합니다.
