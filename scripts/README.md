# 보조 명령

- `test.mjs`: TypeScript 검증 소스를 로컬 임시 경로에서 실행
- `migrate-local.mjs`: Wrangler의 로컬 마이그레이션 적용
- `schema-contract.mjs`: 최종 스키마 계약 작성·일치 확인
- 나머지 설치·빌드·Vite·Worker 보조 스크립트는 Sites 공식 starter의 런타임 통합입니다.

`.sites-runtime`과 `.wrangler`는 로컬 도구 상태이며 공개 소스에서 제외됩니다. 인증값은 스크립트나 명령 인자로 보관하지 않습니다.

과제7은 `setup-local.mjs`로 로컬 전용 `.dev.vars`를 생성합니다. `tests/integration/http-auth.mjs`는 실행 중인 로컬 Worker에서만 폐기용 A/B 계정과 요청·응답을 검증합니다. 실제 사용 날짜를 만드는 도구가 아닙니다. 현재 계약은 `contracts/pds-schema-v3.json`입니다.
