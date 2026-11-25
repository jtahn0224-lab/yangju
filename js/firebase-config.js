/**
 * ============================================================
 * Firebase Realtime Database & 앱 기본 설정 파일
 * ============================================================
 *
 * [연동 방법]
 * 1. Firebase 콘솔 (https://console.firebase.google.com) 접속
 * 2. 프로젝트 생성 → Realtime Database 생성 (싱가포르 리전 권장)
 * 3. 프로젝트 설정 > 내 앱 > 웹 앱(</>) 등록 후 발급된 설정값을 아래 FIREBASE_CONFIG에 붙여넣기
 * 4. GitHub에 커밋 & 푸시하면 GitHub Pages에 즉시 반영됩니다!
 *
 * ※ 아래 값이 초기 placeholder 상태 그대로면 자동으로 '로컬 체험 모드'로 실행됩니다.
 */

export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/**
 * 학교 초기 기본값 (최초 접속 후 '명단·설정' 탭에서 언제든 수정 가능)
 */
export const DEFAULT_SETTINGS = {
  schoolName: "OO학교 교문지도",
  lateTime: "08:30",
  defaultPin: "1234",
  guidanceItems: [
    "복장(교복)",
    "두발",
    "명찰 미착용",
    "신발/슬리퍼",
    "화장/장신구",
    "휴대폰/이어폰"
  ]
};

/**
 * Firebase 설정이 실제로 입력되었는지 확인
 */
export function isFirebaseConfigured() {
  const { apiKey, databaseURL, projectId } = FIREBASE_CONFIG;
  if (!apiKey || !databaseURL || !projectId) return false;
  if (apiKey.includes("YOUR_") || databaseURL.includes("YOUR_") || projectId.includes("YOUR_")) {
    return false;
  }
  return databaseURL.startsWith("https://");
}
