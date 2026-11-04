# Calmato 기술 분석 문서

- 시작: [HTML 본문](../../CALMATO_WEB_TECHNICAL_DEEP_DIVE.html)
- 원본: [Markdown](../../CALMATO_WEB_TECHNICAL_DEEP_DIVE.md)
- 근거: [줄 번호 소스 스냅샷](sources.html)
- 재현 정보: [파일별 SHA-256](source-manifest.json)

HTML은 외부 CDN, 폰트, JavaScript 라이브러리 없이 읽을 수 있습니다. 전체 문서·근거 링크를 유지하려면 루트 HTML/Markdown과 docs/interview 폴더를 같은 상대 위치로 보관하세요. 검색은 일치하는 절을 표시합니다. `/`는 검색 포커스, `Esc`는 검색 해제입니다. 인쇄 버튼은 검색 필터를 해제하고 전체 본문을 인쇄합니다.

본문 수정 후 `build-html.mjs`를 실행하면 HTML·소스 스냅샷·근거 색인을 다시 만듭니다. 생성기는 이 컴퓨터의 Codex bundled Node/marked 경로를 사용합니다. 다른 환경에서는 import 경로를 설치한 marked 경로로 조정해야 합니다. 생성 HTML을 읽는 데 Node는 필요하지 않습니다.

## 확인 기록 · 2026-10-14

- Chrome 임시 프로필에서 로컬 파일로 실행.
- 1440×1000 데스크톱 및 390×844 모바일: 페이지 전체 가로 넘침 없음.
- 본문 검색, Esc 초기화, 면접 질문 바로가기, 근거 anchor의 파일 자동 펼침 확인.
- 7개 흐름도, 30개 면접 문항, 46개 함수 줄 번호 근거 포함.
- 코드·목차·본문 내부 링크 파일 및 fragment 정적 검사.
- 브라우저 pageerror 없음. print media에서 sidebar 숨김 및 전체 본문 표시 확인.
- 화면 스크린샷을 직접 확인. 운영 로그인, DB/Storage 변경, 이메일 발송, 오디오 청취·성능 테스트는 수행하지 않음.
- 기존 추적 애플리케이션 파일 변경 없음.
