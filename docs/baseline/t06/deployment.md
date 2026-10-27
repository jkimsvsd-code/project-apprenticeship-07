> 과제6 기준 커밋 `53ee04f3d3865e89fde664f56bca93d614057560`의 보존 문서입니다. 과제7의 구현·검증 결과를 의미하지 않습니다. 상대 링크는 현재 보존 위치에 맞게 조정했습니다.

# 배포 상태와 공개 범위

확인일: 2026-10-27 (Asia/Seoul)

- 공개 앱: [틈 · Plan Do See Diary](https://pds-diary-apprenticeship-06-m2021.happybay512.chatgpt.site)
- 공개 소스: [jkimsvsd-code/project-apprenticeship-06](https://github.com/jkimsvsd-code/project-apprenticeship-06)
- 호스팅: Sites의 Cloudflare Worker와 D1(SQLite)
- 접근 범위: 로그인 없이 링크를 아는 누구나 조회·수정 가능

사용자가 논문 계획과 실행 기록을 포함한 앱의 공개 조회·수정을 명시적으로 승인했고, Sites 접근 설정을 public으로 변경했습니다. 인증 정보나 쿠키가 없는 요청으로 화면·데이터 조회, 기존 할 일의 동일 내용 저장, 전체 내보내기 성공을 확인했습니다. 저장 검증은 사용자가 입력한 제목·날짜·태그·예상 시간 등의 값을 유지한 채 수행했습니다.

로컬 DB와 배포 DB는 별개입니다. GitHub 소스에는 DB 스키마·마이그레이션·검증 자료만 포함하며, 원본 DB나 서비스 인증값은 포함하지 않습니다. 새 체크아웃은 빈 로컬 다이어리로 시작합니다.

공개 앱은 로그인·개인별 공간 구분이 없는 공동 다이어리입니다. 다른 사람이 기록을 변경할 수도 있으며, 로그인과 잠금은 과제7에서 다룹니다.
