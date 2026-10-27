# 호스팅 설정

`hosting.json`에는 과제7 Site ID와 D1 바인딩 `DB`를 보관합니다. Site ID는 공개 가능한 배포 메타데이터이며 비밀키가 아닙니다. 과제6과 별개인 과제7 대상입니다. `hosting.example.json`은 새 프로젝트를 만들 때의 예시입니다.

로컬 비밀값은 `npm run setup:local`이 생성하는 Git 제외 파일 `.dev.vars`, 운영 비밀값은 Sites의 `BETTER_AUTH_SECRET` 비밀 환경변수로 관리합니다. `BETTER_AUTH_URL`에는 고정한 HTTPS 앱 주소를 설정합니다. 실제 인증값을 manifest에 추가하지 않습니다.

Sites의 Worker 배포에는 빌드 출력과 `drizzle` 마이그레이션을 포함합니다. 로컬 DB·개인 백업·`.dev.vars`는 배포하지 않습니다. 원본 과제6 배포 설정은 Git 조상에 남아 있지만 현재 대상은 과제7입니다.
