# 과제7 공개 증거

[검증 결과](verification-results.md)와 authentication/http-results.json에 로컬 실제 Worker·D1의 마스킹한 요청/응답 61건, authentication/deployment-http-results.json에 운영 검증 73건을 보관했습니다. authentication/deployed-login.png와 deployed-signup.png는 운영의 비어 있는 인증 화면입니다. authentication/login-screen.png는 비밀값 없는 로그인 화면이고, experiment/browser-experiment.png는 폐기용 계정의 UI 검증 화면입니다. 실제 5일 사용 증거는 아직 없으며 사용자가 직접 기록한 뒤 추가합니다. 빈 폴더의 .gitkeep은 통과 증거가 아닙니다.

| 폴더 | 보관할 검토 완료 증거 |
| --- | --- |
| `authentication` | 가입·로그인·미로그인 화면/요청·중복 가입·오류 안내 |
| `passwords` | 폐기용 테스트 계정의 해시 형태·서로 다른 저장값·원문 비노출 |
| `sessions` | 같은 요청의 로그아웃 전후·만료·비밀번호 변경 후 거절 |
| `ownership` | 계정 A/B 양방향 접근·위조·목록·거절 전후 자료 비교·소스 위치 |
| `data-management` | 본인 내보내기·계정 삭제·다른 계정 자료 보존 |
| `experiment` | 실제 5일 기록·규칙 변경 순서·같은 지표의 전후 비교·검산 |

## 공개 전 확인

원시 요청·HAR·로그·DB·개인 내보내기는 `.local/evidence/` 등 Git 제외 위치에서 검토합니다. 마스킹한 사본만 이 폴더에 넣습니다. 실제 비밀번호·토큰·세션·비밀키는 공개하지 않습니다. 비밀번호 증거는 실제 계정이 아닌 폐기용 테스트 계정을 사용합니다.

각 기록에 수행 시각·코드 커밋·전제 조건·마스킹한 요청/응답·상태 코드·결과·관련 소스 위치를 적습니다. 성공과 거절을 함께 보여 주고 미실행·실패·한계를 감추지 않습니다. 과제6 증거는 `../baseline/t06/evidence`에 보존되어 있으며 과제7 통과 근거가 아닙니다.

공개 증거의 저장 해시는 일부만 표시합니다. 실제로 비교한 폐기용 계정의 전체 해시는 Git 제외 파일 `.local/qa-password-hashes.json`에만 보관하며 원문 비밀번호는 보관하지 않습니다.
