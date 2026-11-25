# 교문지도 실시간 체크 웹앱

**GitHub Pages**로 코드를 간편하게 업데이트하고, **Firebase Realtime Database**로 여러 선생님의 스마트폰·PC 간 교문지도 내역을 0.1초 만에 실시간 동기화하는 순수 HTML/CSS/JS 웹앱입니다. (빌드 도구 불필요)

---

## 주요 기능

- **교사 이름 + 간편 PIN 접속**: 교문 현장에서 빠르게 접속하며, 로그인 유지 및 최근 접속 교사 원터치 선택 지원 (초기 PIN: `1234`, 설정 탭에서 SHA-256 해시로 안전하게 변경 가능)
- **초고속 학생 검색**: 학번(`10101`), 이름(`김민수`), **한글 초성(`ㄱㅁㅅ`)**, 반(`1-2`)으로 즉시 검색
- **지각 체크 (시각 자동 기록)**: 지각 기준 시각(기본 `08:30`) 초과 여부 표시 및 클릭 즉시 시각(`HH:MM:SS`)·담당 교사 자동 기록
- **복장·두발·명찰 등 생활규정 지도**: 다중 항목 선택 + 메모 기록, 학교 규정에 맞게 지도 항목 자유롭게 추가/삭제
- **등교 출석 · 미등교 확인**: 학년·반별 등교율 진행바, 미등교 학생 필터, **미등교 명단 원클릭 복사**(담임 선생님 공유용), 반 전체 일괄 등교 처리
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
│   ├── db.js                   # Firebase Realtime Database 실시간 연동 & 로컬 폴백
│   ├── hangul.js               # 한글 초성 검색 및 학번 파싱 유틸
│   ├── roster.js               # 엑셀(.xlsx)/CSV 명단 파싱 및 CSV 내보내기
│   └── app.js                  # 전체 UI 컨트롤러
├── firebase/
│   └── database.rules.json     # Firebase Realtime Database 보안 규칙
├── sample-students.csv         # 업로드 테스트용 샘플 학생 명단
└── .nojekyll                   # GitHub Pages 정적 파일 그대로 배포
```

---

## 1단계: Firebase Realtime Database 설정

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 새 프로젝트를 생성합니다.
2. 왼쪽 메뉴 **빌드 → Realtime Database → 데이터베이스 만들기**를 클릭합니다.
   - 위치(리전): **싱가포르 (`asia-southeast1`)** 권장 (한국에서 가장 빠름)
   - 초기 시작 모드: **잠금 모드**로 시작해도 아래 규칙을 붙여넣으면 바로 동작합니다.
3. 왼쪽 메뉴 **빌드 → Authentication → 시작하기 → 로그인 방법**에서 **익명(Anonymous)**을 **사용 설정** 후 저장합니다.
4. 다시 **Realtime Database → 규칙(Rules)** 탭으로 이동하여 `firebase/database.rules.json` 내용을 그대로 붙여넣고 **게시**합니다.
5. 왼쪽 상단 톱니바퀴 **프로젝트 설정 → 내 앱 → 웹(`</>`) 아이콘**을 눌러 앱을 등록하고, 표시되는 `firebaseConfig` 값을 복사합니다.
6. 이 프로젝트의 `js/firebase-config.js` 파일을 열어 `FIREBASE_CONFIG`에 붙여넣습니다.

```js
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "my-school-gate.firebaseapp.com",
  databaseURL: "https://my-school-gate-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "my-school-gate",
  storageBucket: "my-school-gate.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

> **보안 안내**: `database.rules.json`은 익명 인증(`auth != null`)된 사용자에게 읽기/쓰기를 허용하고 데이터 스키마를 검증합니다. 학교 내부망 외에서 더 엄격한 접근 제어가 필요하면 추후 Firebase Authentication(이메일/구글 교사 계정 승인 방식)으로 확장할 수 있습니다.

---

## 2단계: GitHub에 업로드 및 GitHub Pages 자동 배포

1. GitHub에서 새 저장소(예: `school-gate-app`)를 생성합니다.
2. 이 폴더의 모든 파일(`index.html`, `css/`, `js/`, `firebase/`, `.nojekyll` 등)을 저장소에 업로드(또는 `git push`)합니다.
3. GitHub 저장소 상단 **Settings → Pages**로 이동합니다.
4. **Build and deployment → Source**를 `Deploy from a branch`로 두고, Branch를 `main` / `/ (root)` 선택 후 **Save**를 누릅니다.
5. 약 1~2분 뒤 `https://<깃허브아이디>.github.io/<저장소이름>/` 주소가 생성됩니다!

### 이후 코드 업데이트 방법
- GitHub 웹 화면이나 PC에서 코드를 수정해 `main` 브랜치에 커밋/푸시하면 **약 1분 내에 GitHub Pages 주소에 자동 반영**됩니다.
- 모든 교사 스마트폰에서 브라우저 새로고침만 하면 최신 버전이 적용됩니다.
- 스마트폰에서 **홈 화면에 추가**를 해두면 일반 앱처럼 전체 화면으로 편하게 사용할 수 있습니다.
