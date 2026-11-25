/**
 * 한글 초성 검색 및 학생 매칭 유틸리티
 * 예: 'ㄱㅁㅅ' -> '김민수', '102' -> '10201~10230', '1-2' -> 1학년 2반
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

export function matchStudent(student, rawQuery) {
  const q = String(rawQuery || "").trim().toLowerCase();
  if (!q) return true;

  const id = String(student.id || "").toLowerCase();
  const name = String(student.name || "").toLowerCase();
  const classTag = `${student.grade}-${student.classNum}`;
  const classTagAlt = `${student.grade}학년 ${student.classNum}반`;

  if (id.includes(q)) return true;
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
