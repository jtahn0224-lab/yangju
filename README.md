# 교문지도 실시간 체크 웹앱

**GitHub Pages**로 코드를 간편하게 업데이트하고, **Firebase Realtime Database**로 여러 선생님의 스마트폰·PC 간 교문지도 내역을 0.1초 만에 실시간 동기화하는 순수 HTML/CSS/JS 웹앱입니다. (빌드 도구 불필요)

---

## 주요 기능

- **교사 이름 + 간편 PIN 접속**: 교문 현장에서 빠르게 접속하며, 로그인 유지 및 최근 접속 교사 원터치 선택 지원 (초기 PIN: `1234`, 설정 탭에서 SHA-256 해시로 안전하게 변경 가능)
- **초고속 학생 검색**: 학번(`10101`), 이름(`김민수`), **한글 초성(`ㄱㅁㅅ`)**, 반(`1-2`)으로 즉시 검색
- **지각 체크 (시각 자동 기록)**: 지각 기준 시각(기본 `08:30`) 초과 여부 표시 및 클릭 즉시 시각(`HH:MM:SS`)·담당 교사 자동 기록
- **복장·두발·명찰 등 생활규정 지도**: 다중 항목 선택 + 메모 기록, 학교 규정에 맞게 지도 항목 자유롭게 추가/삭제
- **등교 출석 · 미등교 확인**: 학년·반별 등교율 진행바, 미등교 학생 필터, **미등교 명단 원클릭 복사**(담임 선생님 공유용), 반 전체 일괄 등교 처리
- **반복 체크 학생 현황 (집중 지도 대상)**: 최근 7/14/30/60일 또는 전체 기간 동안 **설정한 기준 일수(2·3·4·5·7일 또는 직접 입력)** 이상 반복 체크된 학생을 자동 집계·복사·CSV 내보내기
- **엑셀/CSV 학생 명단 일괄 업로드**: `.xlsx`, `.xls`, `.csv`(UTF-8 / 나이스 EUC-KR 자동 인식) 지원
- **통계 & 엑셀(CSV) 내보내기**: 날짜별 항목 통계, 학급별 현황, 지도 기록/출석 현황 CSV(UTF-8 BOM) 다운로드
- **로컬 체험 모드 내장**: Firebase 키를 입력하기 전에도 브라우저에서 모든 기능을 바로 테스트 가능

---

## 폴더 구조

```text
교문지도/
├── index.html                  # 메인 웹앱 HTML
├── css/style.css               # 모바일 퍼스트 반응형 스타일
├── js/
│   ├── firebase-config.js      # ★ Firebase 설정값 및 기본 설정 파일
│   ├── db.js                   # Firebase Realtime Database 실시간 연동 & 기간별 조회
│   ├── hangul.js               # 한글 초성 검색 및 학번 파싱 유틸
│   ├── roster.js               # 엑셀(.xlsx)/CSV 명단 파싱 및 CSV 내보내기
│   └── app.js                  # 전체 UI 컨트롤러
├── firebase/
│   └── database.rules.json     # Firebase Realtime Database 보안 규칙
├── sample-students.csv         # 업로드 테스트용 샘플 학생 명단
└── .nojekyll                   # GitHub Pages 정적 파일 그대로 배포
```

---

## Firebase 연동 & GitHub Pages 배포 요약

1. Firebase 콘솔에서 **Realtime Database**(싱가포르 리전 권장) 생성 및 **Authentication → 익명(Anonymous)** 사용 설정
2. **Realtime Database → 규칙(Rules)**에 `firebase/database.rules.json` 내용 붙여넣기 후 게시
3. `js/firebase-config.js`에 웹앱 `firebaseConfig` 입력
4. GitHub 저장소 업로드 후 **Settings → Pages → Branch: `main` / `/ (root)`** 저장
