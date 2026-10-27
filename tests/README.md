# 검증

과제6 회귀와 과제7 인증·소유권·이전·계정 삭제·실험을 함께 검증합니다. 단위/SQLite 통합 테스트 22개, 실제 Worker HTTP 증거 61건과 브라우저 관찰은 docs/evidence/verification-results.md에 있습니다. tests/fixtures는 폐기용 자료이고 실제 사용자 백업은 .local에만 둡니다.

- `npm test`: 단위 규칙과 Node SQLite에 실제 SQL을 적용한 저장소 통합 테스트
- `npm run typecheck`: TypeScript 검사
- `npm run db:check`: 스키마 계약 검사
- `npm run test:http:auth`: 실행 중인 로컬 테스트 Worker의 인증·소유권 HTTP 검증. 운영 URL은 거절합니다.
- `npm run test:http -- http://127.0.0.1:5173`: 로컬 전용 동시 요청·HTTP 검증. 브라우저에서 `[검증] 전체 흐름` 계획과 스크립트 문자열 할 일을 만든 검증용 DB에서만 실행합니다.

과제6 브라우저 검증 기록은 `docs/baseline/t06/evidence/verification-results.md`, 과제7 검증 계획은 `docs/verification.md`를 참고합니다. 검증용 자료는 공개 배포 DB에 입력하지 않습니다.
