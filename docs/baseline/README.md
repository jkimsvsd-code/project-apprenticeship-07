# 과제6 계승 기록

| 항목 | 확인 내용 |
| --- | --- |
| 원본 저장소 | https://github.com/jkimsvsd-code/project-apprenticeship-06 |
| 로컬 기준 커밋 | `53ee04f3d3865e89fde664f56bca93d614057560` |
| 커밋 제목 | `docs: record actual review and linked second paper plan` |
| 확인일 | 2026-10-27 (Asia/Seoul) |
| 원본 작업 트리 | 복제 시 변경 사항 없음 |
| 계승 방식 | 로컬 Git 복제로 소스와 커밋 이력 계승. 파일만 새 이력으로 복사하지 않음 |
| 과제6 실제 최종 제출 커밋과의 일치 | 로컬 최신본을 계승했으나 제출 당시 고정값과 대조는 아직 미완료 |
| 과제7 원격 저장소 | [GitHub public 저장소](https://github.com/jkimsvsd-code/project-apprenticeship-07). 과제6 저장소로 push하는 연결은 없음 |

## 보존 자료

기준 커밋·승인 범위·구현 상태의 기계 판독용 기록은 [provenance.json](provenance.json)에 있습니다.

- [과제6 프로젝트 README](t06/PROJECT_README.md)
- [과제6 제출 문서](t06/submission.md)
- [과제6 요구사항](t06/requirements.md)
- [과제6 구조](t06/architecture.md)
- [과제6 검증 결과](t06/evidence/verification-results.md)

과제6 문서 전체와 그림은 `t06/` 아래로 옮겼고 상대 링크를 조정했습니다. 원래 상태는 기준 커밋에서 확인할 수 있습니다. 앱 소스·DB 스키마·기존 마이그레이션·계약·테스트와 Git 이력을 계승한 뒤 인증과 새 기능을 추가했습니다. 원래 상태는 기준 커밋으로 확인할 수 있습니다.

`.openai/hosting.json`은 과제6과 별개인 과제7 Site ID를 사용합니다. 실제 사용자 계정으로의 자료 이전은 본인이 가입 후 실행합니다. 과제6 공개본에 이미 공개된 자료는 과제7 잠금으로 소급해서 비공개가 되지 않습니다.

최종 제출본과의 대조 후 기준 커밋 확정 상태를 갱신하고, `git merge-base --is-ancestor 53ee04f3d3865e89fde664f56bca93d614057560 HEAD`로 계승 여부를 확인합니다. 이후 다른 기준 커밋이 최종 제출본으로 확인되면 그 커밋도 실제 이력에 포함되는지 검증합니다.
