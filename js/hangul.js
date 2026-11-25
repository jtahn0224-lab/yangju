/**
 * 한글 초성 검색 및 학생 매칭 / 학번 포맷 유틸리티
 * 예: 'ㄱㅁㅅ' -> '김민수', '1111' -> 1학년 1반 11번, '1-2' -> 1학년 2반
 */

const CHOSEONG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ",
  "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
];

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

export function extractChoseong(text = "") {
  let result = "";
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code >= HANGUL_START && code <= HANGUL_END) {
      const idx = Math.floor((code - HANGUL_START) / 588);
      result += CHOSEONG_LIST[idx];
    } else {
      result += ch.toLowerCase();
    }
  }
  return result;
}

export function isChoseongOnly(query = "") {
  return /^[ㄱ-ㅎ\s]+$/.test(query);
}

/**
 * 학년·반·번호를 학번 문자열로 포맷팅
 * - 10개 반 미만(1~9반): 4자리 (예: 1학년 1반 11번 -> "1111", 1학년 1반 1번 -> "1101")
 * - 10개 반 이상(10반~): 5자리 (예: 1학년 10반 11번 -> "11011")
 */
export function buildStudentId(grade, classNum, number) {
  const g = Number(grade);
  const c = Number(classNum);
  const n = Number(number);
  if (!Number.isFinite(g) || !Number.isFinite(c) || !Number.isFinite(n) || g <= 0 || c <= 0 || n <= 0) {
    return "";
  }
  const numStr = String(n).padStart(2, "0");
  if (c < 10) {
    return `${g}${c}${numStr}`;
  }
  return `${g}${String(c).padStart(2, "0")}${numStr}`;
}

/**
 * 학생 객체 또는 기록 객체에서 표시용 학번 반환
 * (기존 5자리 '10111' 데이터가 DB에 남아 있어도 10반 미만이면 '1111'로 자동 표시)
 */
export function formatStudentId(studentOrRecord) {
  if (!studentOrRecord) return "";
  if (typeof studentOrRecord === "string" || typeof studentOrRecord === "number") {
    const raw = String(studentOrRecord).trim();
    if (/^[1-9]0[1-9]\d{2}$/.test(raw)) {
      return `${raw[0]}${raw[2]}${raw.slice(3)}`;
    }
    return raw;
  }

  const built = buildStudentId(
    studentOrRecord.grade,
    studentOrRecord.classNum,
    studentOrRecord.number
  );
  if (built) return built;

  const fallback = String(studentOrRecord.id || studentOrRecord.studentId || "").trim();
  if (/^[1-9]0[1-9]\d{2}$/.test(fallback)) {
    return `${fallback[0]}${fallback[2]}${fallback.slice(3)}`;
  }
  return fallback;
}

export function matchStudent(student, rawQuery) {
  const q = String(rawQuery || "").trim().toLowerCase();
  if (!q) return true;

  const rawId = String(student.id || "").toLowerCase();
  const displayId = formatStudentId(student).toLowerCase();
  const name = String(student.name || "").toLowerCase();
  const classTag = `${student.grade}-${student.classNum}`;
  const classTagAlt = `${student.grade}학년 ${student.classNum}반`;

  if (displayId.includes(q) || rawId.includes(q)) return true;
  if (name.includes(q)) return true;
  if (classTag.includes(q) || classTagAlt.includes(q)) return true;

  const compactQuery = q.replace(/\s+/g, "");
  if (isChoseongOnly(compactQuery)) {
    const nameCho = extractChoseong(name).replace(/\s+/g, "");
    if (nameCho.includes(compactQuery)) return true;
  }

  return false;
}

export function parseStudentId(rawId) {
  const digits = String(rawId || "").replace(/\D/g, "");
  if (digits.length === 5) {
    return {
      grade: Number(digits.slice(0, 1)),
      classNum: Number(digits.slice(1, 3)),
      number: Number(digits.slice(3, 5))
    };
  }
  if (digits.length === 4) {
    return {
      grade: Number(digits.slice(0, 1)),
      classNum: Number(digits.slice(1, 2)),
      number: Number(digits.slice(2, 4))
    };
  }
  return { grade: 1, classNum: 1, number: 0 };
}
