# 인증 구현 설명서

## ① 무엇으로 붙였나

Better Auth **1.7.14**를 기존 Drizzle **0.45.2**·Cloudflare D1에 연결했습니다. 실제 설치 버전은 `package-lock.json`에 고정했습니다. DB 기반 세션을 사용하고 604,800초(7일) 뒤 고정 만료하며 자동 갱신과 쿠키 세션 캐시는 사용하지 않습니다.

비밀번호는 Better Auth가 제공하는 scrypt에 맡겼습니다. 설치된 유틸리티의 매개변수는 N=16384, r=16, p=1, 파생 키 64바이트, 무작위 salt 16바이트입니다. 저장 형태는 `saltHex:keyHex`입니다. 직접 암호 알고리즘을 만들지 않았습니다.

쿠키는 HttpOnly·SameSite=Lax이며 HTTPS 배포에서는 Secure를 사용합니다. 비밀키는 로컬 `.dev.vars`와 호스팅의 비밀 환경변수 `BETTER_AUTH_SECRET`에만 둡니다. `BETTER_AUTH_URL`은 고정한 앱 출처입니다. Sites 외곽 접근 정책은 호스팅이 담당하고, 과제에서 요구한 자체 가입·비밀번호·이전 인증값 폐기 검증은 앱 인증으로 구현했습니다. 플랫폼의 임의 사용자 헤더는 앱 인증 근거로 쓰지 않습니다.

## ② 왜 그걸 골랐나

기존 D1·Drizzle을 유지하면서 가입·로그인·scrypt·DB 세션을 검증할 수 있고, 로그아웃·비밀번호 변경 뒤 기존 값 거절을 직접 입증할 수 있어 선택했습니다. 비밀번호 저장은 계정별 무작위 salt와 검증된 라이브러리에 맡기고, DB의 실제 저장 형태를 폐기용 계정에서 확인했습니다.

대안으로 비밀번호·세션을 직접 구성하는 방식을 검토했습니다. 구현·유지해야 할 인증 코드 범위가 늘어나므로 선택하지 않았습니다. 외부 인증 서비스는 저장 해시와 즉시 폐기 동작의 증거를 직접 확보하는 방법을 추가로 확인해야 하므로 이번 과제에서는 자체 DB를 쓰는 라이브러리를 선택했습니다.

참고: [Better Auth Drizzle](https://better-auth.com/docs/adapters/drizzle), [세션 관리](https://better-auth.com/docs/concepts/session-management), [Cloudflare node:crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).

## ③ 어디를 어떻게 고쳤나

| 흐름 | 코드 경로 |
| --- | --- |
| 가입 | `app/signup/page.tsx` → `src/features/auth/AuthForm.tsx` → `app/api/auth/[action]/route.ts`의 signup → `src/server/auth/config.ts` → auth_users/auth_accounts/auth_sessions |
| 로그인 | `app/login/page.tsx` → AuthForm → login API → Better Auth 검증·DB 세션·서명된 쿠키. 응답 JSON은 `{ok:true}`만 제공 |
| 로그아웃 | 계정 화면 → logout API → 라이브러리 쿠키 해제와 명시적 DB 현재 세션 삭제. 서버 삭제 실패를 성공으로 보고하지 않음 |
| 자료 조회 | `app/page.tsx` 또는 `app/api/diary/route.ts` → `src/server/runtime.ts`의 requireIdentity → `src/server/store.ts`의 소유자 범위 조회 |
| 소유권 | `src/server/access-control/index.ts`의 ownerCondition. 계획 소유자를 기준으로 자식·목록·내보내기 분리, 변경 전 requireRow로 거절 |
| 비밀번호 변경 | password API → Better Auth changePassword, revokeOtherSessions=true → 이전 현재 세션까지 폐기하고 새 현재 세션 발급 |
| 자료 이전 | `src/features/migration/MigrationView.tsx` → import API → `src/server/migration/index.ts`. 계정별 ID 매핑·원본 관계/시각 보존·중복 방지·원자적 batch |
| 내보내기·삭제 | `src/features/account/AccountView.tsx` → export/account API → `src/server/accounts/index.ts`. 비밀번호 재확인, 연관 자료 전체 batch 삭제와 인증값 폐기 |
| 만료 복귀 | `src/features/auth/Workspace.tsx`가 401을 받아 재로그인 창 표시. 같은 계정은 일반 메모리 입력을 보존하되 비밀번호 입력칸은 만료 시 비웁니다. 다른 계정은 전체 화면 갱신. 탭 간 인증 변경 알림 |

기존 T06 마이그레이션은 수정하지 않고 `drizzle/0001_orange_aaron_stack.sql`을 추가했습니다. 기존 계획과 중복 요청 행은 `__legacy_unclaimed__`로 보존하며 일반 사용자에게 보이지 않습니다. 새 API는 반드시 인증 계정 ID를 서버 함수에 전달합니다. T06 기본 동작은 별도 회귀 테스트로 유지합니다.

## ④ 안 열리는 것을 확인한 기록

실제 로컬 Worker·D1의 [요청·응답 61건](evidence/authentication/http-results.json), 배포 후 [운영 검증 73건](evidence/authentication/deployment-http-results.json)과 [검증 결과](evidence/verification-results.md)를 남겼습니다. 가입/접근·비밀번호·세션·계정 분리·자료 관리의 다섯 묶음입니다.

본인 요청과 타 계정 거절을 함께 확인했고, 로그아웃 전후는 같은 URL·GET·같은 원문 쿠키를 재사용했습니다. 공개 기록의 `cookie-ref-N`은 원문을 가린 동일 값 별칭입니다. A→B/B→A 읽기·수정·삭제는 모두 404이며 거절 전후 상대 내용과 건수가 같습니다. 실제 비밀번호·토큰·세션·비밀키는 증거에서 제외했습니다.

## ⑤ AI와 나

- AI에게 맡긴 일: 요구사항 분석, T06 계승, 인증·서버 소유권·자료 이전·5일 실험·계정 관리 구현, 로컬/브라우저 검증과 문서화.
- 내가 직접 판단한 일: 필수 단계 전체와 UX A1~A7 채택, 기존 기능과 자료 보존, 구현·검증 및 실제 사용 절차 정리 요청.
- AI 제안을 따르지 않은 일: 현재 과제7 대화에서 확인된 반대 결정은 없습니다. 이후 실제 지표·규칙·비교 해석에서 내린 판단을 추가합니다. 본인 계정 비밀번호와 실제 5일 활동은 AI가 대신 만들지 않았습니다.

## ⑥ 아직 못 막은 것

- 이메일 주소 소유 확인과 비밀번호 찾기·복구가 없습니다. 다른 사람이 먼저 주소로 가입하거나 비밀번호를 잊으면 정상 사용자가 계정을 사용하지 못할 수 있습니다. 민감하거나 중요한 서비스의 완성된 계정 복구 체계로 간주하지 않습니다.
- MFA와 분산 무차별 대입/봇 방어를 구현하지 않았습니다. 라이브러리의 메모리 기반 제한 설정을 분산 차단 보장으로 주장하지 않습니다. 자격 증명을 추측·유출당했을 때 추가 인증 수단이 없습니다.
- 로그아웃은 현재 세션, 비밀번호 변경은 이전 모든 세션을 폐기합니다. 기기별 세션 목록·사용자가 선택하는 원격 로그아웃 UI는 제공하지 않습니다.
- 저장하지 않은 입력 복귀는 같은 열린 화면의 메모리 범위입니다. 새로고침·탭 닫기·브라우저 종료 뒤 복구는 보장하지 않습니다. 비밀번호는 복구용 저장소에 보관하지 않습니다.
- 계획 규칙 문장의 의미상 조건을 정확히 하나만 바꿨는지는 사용자가 판단해야 합니다. 시스템은 변경 횟수·순서·기록 연결을 검증합니다.
- 입력 확정 후 일별 값은 수정하지 않습니다. 오입력은 실제 검산/제출 설명에 그대로 남겨야 하며 사후에 사용 날짜를 꾸며 수정하는 기능은 없습니다.
- 별도 보안 감사·공격 부하·다중 리전·모바일 실제 기기 전체 검증은 하지 않았습니다. 실제 5일 사용과 최종 제출 확인은 남아 있습니다.

공개 증거의 저장 해시는 일부만 표시합니다. 실제로 비교한 폐기용 계정의 전체 해시는 Git 제외 파일 `.local/qa-password-hashes.json`에만 보관하며 원문 비밀번호는 보관하지 않습니다.
