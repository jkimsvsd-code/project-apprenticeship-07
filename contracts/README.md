# 계약

- `pds-schema-v2.json`: 과제6 보존 계약. 현재 v3 DB 계약으로 오인하지 않습니다.
- `pds-schema-v3.json`: 현재 DB 테이블·필드·관계·제약·날짜·집계 계약.
- `auth/session-v1.json`: 인증·비밀번호·만료·폐기·응답·소유권 경계.
- `experiment/five-days-v1.json`: 실제 5일과 규칙 변경·비교·계산 규약.

스키마는 `db/schema.ts`, `db/auth-schema.ts`, `db/experiment-schema.ts`, 실제 SQL은 `drizzle`에 있습니다. 변경 후 `npm run db:generate` → SQL 검토 → `node scripts/schema-contract.mjs --write` → `npm run db:check`로 확인합니다. 적용한 기존 마이그레이션은 수정하지 않습니다. 계약에 비밀값을 넣지 않습니다.
