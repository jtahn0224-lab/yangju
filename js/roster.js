/**
 * 엑셀(.xlsx/.xls) 및 CSV 학생 명단 파싱, 샘플 생성, CSV 내보내기 유틸리티
 */

import { parseStudentId, buildStudentId } from "./hangul.js";

export function getSampleStudentsMap() {
  const sample = [
    ["1101", 1, 1, 1, "김민수"],
    ["1102", 1, 1, 2, "이서연"],
    ["1103", 1, 1, 3, "박지훈"],
    ["1104", 1, 1, 4, "최수빈"],
    ["1105", 1, 1, 5, "정우진"],
    ["1106", 1, 1, 6, "강하은"],
    ["1107", 1, 1, 7, "조현우"],
    ["1108", 1, 1, 8, "윤지아"],
    ["1109", 1, 1, 9, "장도윤"],
    ["1110", 1, 1, 10, "임채원"],
    ["1201", 1, 2, 1, "한시우"],
    ["1202", 1, 2, 2, "오서윤"],
    ["1203", 1, 2, 3, "서예준"],
    ["1204", 1, 2, 4, "신다은"],
    ["1205", 1, 2, 5, "권주원"],
    ["1206", 1, 2, 6, "황소율"],
    ["1207", 1, 2, 7, "안건우"],
    ["1208", 1, 2, 8, "송유진"],
    ["1209", 1, 2, 9, "전민재"],
    ["1210", 1, 2, 10, "홍지유"],
    ["1301", 1, 3, 1, "고태양"],
    ["1302", 1, 3, 2, "문하린"],
    ["1303", 1, 3, 3, "양준서"],
    ["1304", 1, 3, 4, "손예린"],
    ["1305", 1, 3, 5, "배시현"],
    ["2101", 2, 1, 1, "백서아"],
    ["2102", 2, 1, 2, "허지호"],
    ["2103", 2, 1, 3, "유나연"],
    ["2104", 2, 1, 4, "남은우"],
    ["2105", 2, 1, 5, "심가은"]
  ];

  const map = {};
  for (const [id, grade, classNum, number, name] of sample) {
    map[id] = { id, grade, classNum, number, name };
  }
  return map;
}

function csvCell(value) {
  let str = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename, headers, rows) {
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(","))
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSampleRosterCsv() {
  const sampleMap = getSampleStudentsMap();
  const rows = Object.values(sampleMap).map((s) => [s.id, s.grade, s.classNum, s.number, s.name]);
  downloadCsv("학생명단_샘플양식.csv", ["학번", "학년", "반", "번호", "이름"], rows);
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

function decodeCsvBuffer(buffer) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }
  try {
    return new TextDecoder("euc-kr").decode(buffer);
  } catch {
    return utf8;
  }
}

function rowsToStudentMap(rows) {
  if (!rows || rows.length === 0) {
    throw new Error("파일에 데이터가 없습니다.");
  }

  const firstRow = rows[0].map((v) => String(v ?? "").trim().toLowerCase());
  const hasHeader = firstRow.some((cell) =>
    ["학번", "이름", "성명", "학생명", "학년", "반", "번호", "name", "id"].some((k) =>
      cell.includes(k)
    )
  );

  let idxId = -1;
  let idxGrade = -1;
  let idxClass = -1;
  let idxNum = -1;
  let idxName = -1;

  if (hasHeader) {
    firstRow.forEach((col, i) => {
      if (idxId === -1 && (col.includes("학번") || col === "id" || col.includes("student"))) idxId = i;
      else if (idxGrade === -1 && (col === "학년" || col.includes("grade"))) idxGrade = i;
      else if (idxClass === -1 && (col === "반" || col === "학급" || col.includes("class"))) idxClass = i;
      else if (idxNum === -1 && (col === "번호" || col === "출석번호" || col === "no" || col.includes("number"))) idxNum = i;
      else if (idxName === -1 && (col.includes("이름") || col.includes("성명") || col.includes("학생") || col.includes("name"))) idxName = i;
    });
  } else {
    const colCount = rows[0].length;
    if (colCount === 2) {
      idxId = 0;
      idxName = 1;
    } else if (colCount === 4) {
      idxGrade = 0;
      idxClass = 1;
      idxNum = 2;
      idxName = 3;
    } else if (colCount >= 5) {
      idxId = 0;
      idxGrade = 1;
      idxClass = 2;
      idxNum = 3;
      idxName = 4;
    }
  }

  const startRow = hasHeader ? 1 : 0;
  const studentMap = {};
  let skipped = 0;

  for (let r = startRow; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.every((c) => String(c ?? "").trim() === "")) continue;

    const rawName = idxName >= 0 ? String(cols[idxName] ?? "").trim() : "";
    let rawId = idxId >= 0 ? String(cols[idxId] ?? "").trim() : "";
    let grade = idxGrade >= 0 ? parseInt(cols[idxGrade], 10) : NaN;
    let classNum = idxClass >= 0 ? parseInt(cols[idxClass], 10) : NaN;
    let number = idxNum >= 0 ? parseInt(cols[idxNum], 10) : NaN;

    if (!rawName) {
      skipped++;
      continue;
    }

    if (rawId) {
      const parsed = parseStudentId(rawId);
      if (Number.isNaN(grade)) grade = parsed.grade;
      if (Number.isNaN(classNum)) classNum = parsed.classNum;
      if (Number.isNaN(number)) number = parsed.number;
      // 10개 반 미만이면 4자리(예: 1111), 10개 반 이상이면 5자리(예: 11011)로 정규화
      const normalized = buildStudentId(grade, classNum, number);
      if (normalized) rawId = normalized;
    } else if (!Number.isNaN(grade) && !Number.isNaN(classNum) && !Number.isNaN(number)) {
      rawId = buildStudentId(grade, classNum, number);
    } else {
      skipped++;
      continue;
    }

    const safeId = rawId.replace(/[.#$[\]/\s]/g, "");
    if (!safeId) {
      skipped++;
      continue;
    }

    studentMap[safeId] = {
      id: safeId,
      grade: Number.isNaN(grade) ? 1 : grade,
      classNum: Number.isNaN(classNum) ? 1 : classNum,
      number: Number.isNaN(number) ? 0 : number,
      name: rawName
    };
  }

  const count = Object.keys(studentMap).length;
  if (count === 0) {
    throw new Error("인식된 학생이 없습니다. '학번, 이름' 또는 '학년, 반, 번호, 이름' 열이 있는지 확인해 주세요.");
  }

  return { studentMap, count, skipped };
}

export async function parseRosterFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const buffer = await file.arrayBuffer();

  if (ext === "csv") {
    const text = decodeCsvBuffer(buffer);
    const rows = parseCsvText(text);
    return rowsToStudentMap(rows);
  }

  if (ext === "xlsx" || ext === "xls") {
    if (typeof window.XLSX === "undefined") {
      throw new Error("엑셀 파서 라이브러리(SheetJS)를 불러오지 못했습니다. 인터넷 연결을 확인하거나 CSV로 저장해 업로드해 주세요.");
    }
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return rowsToStudentMap(rows);
  }

  throw new Error("지원하지 않는 파일 형식입니다. .xlsx, .xls, .csv 파일을 선택해 주세요.");
}

/* ============================================================
   일자별 교문지도 순번 (담당 선생님) 엑셀/CSV 파싱 및 샘플 양식
   ============================================================ */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * 엑셀 시리얼 날짜, Date 객체, 다양한 한국식 날짜 문자열을 YYYY-MM-DD로 변환
 */
function parseDutyDate(raw, defaultYear) {
  if (raw === null || raw === undefined || raw === "") return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`;
  }

  // Excel serial number (예: 46351)
  if (typeof raw === "number" && raw > 20000 && raw < 90000) {
    const utcMs = Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000;
    const d = new Date(utcMs);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  const str = String(raw).trim();
  if (!str) return null;

  // 순수 5자리 숫자 문자열로 들어온 Excel 시리얼
  if (/^\d{5}$/.test(str)) {
    const serial = Number(str);
    if (serial > 20000 && serial < 90000) {
      const utcMs = Date.UTC(1899, 11, 30) + serial * 86400000;
      const d = new Date(utcMs);
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }
  }

  // YYYYMMDD (8자리)
  let m = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    return validateDateParts(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD / YYYY년 M월 D일
  m = str.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) {
    return validateDateParts(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // MM-DD / MM.DD / MM/DD / M월 D일 (연도 생략)
  m = str.match(/^(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/);
  if (m) {
    return validateDateParts(defaultYear, Number(m[1]), Number(m[2]));
  }

  return null;
}

function validateDateParts(y, m, d) {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function splitTeacherCell(raw) {
  const str = String(raw ?? "").trim();
  if (!str) return [];
  // 요일 한 글자(월~일)나 괄호 요일("(월)")만 들어있는 셀 무시
  if (/^\(?[월화수목금토일]\)?$/.test(str)) return [];
  return str
    .split(/[,/·|\n]+/)
    .map((s) => s.trim())
    .filter((s) => s && !/^\(?[월화수목금토일]\)?$/.test(s));
}

function rowsToDutyScheduleMap(rows, defaultYear) {
  if (!rows || rows.length === 0) {
    throw new Error("파일에 데이터가 없습니다.");
  }

  const firstRow = rows[0].map((v) => String(v ?? "").trim().toLowerCase());
  const hasHeader = firstRow.some((cell) =>
    ["날짜", "일자", "지도일", "담당", "교사", "선생", "성명", "이름", "정문", "후문", "date", "teacher"].some((k) =>
      cell.includes(k)
    )
  );

  let idxDate = -1;
  let teacherCols = [];

  if (hasHeader) {
    firstRow.forEach((col, i) => {
      if (idxDate === -1 && (col.includes("날짜") || col.includes("일자") || col.includes("지도일") || col === "date")) {
        idxDate = i;
      } else if (
        !col.includes("요일") &&
        !col.includes("비고") &&
        !col.includes("메모") &&
        col !== "no" &&
        col !== "번호" &&
        (col.includes("교사") ||
          col.includes("선생") ||
          col.includes("담당") ||
          col.includes("성명") ||
          col.includes("이름") ||
          col.includes("정문") ||
          col.includes("후문") ||
          col.includes("teacher") ||
          col.includes("duty"))
      ) {
        teacherCols.push(i);
      }
    });
  }

  if (idxDate === -1) idxDate = 0;
  if (teacherCols.length === 0) {
    const maxCols = Math.max(...rows.slice(0, 10).map((r) => r.length), 2);
    for (let c = 0; c < maxCols; c++) {
      if (c === idxDate) continue;
      if (hasHeader && (firstRow[c]?.includes("요일") || firstRow[c]?.includes("비고") || firstRow[c]?.includes("메모"))) {
        continue;
      }
      teacherCols.push(c);
    }
  }

  const startRow = hasHeader ? 1 : 0;
  const scheduleMap = {};
  let skipped = 0;

  for (let r = startRow; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.every((c) => String(c ?? "").trim() === "")) continue;

    const dateStr = parseDutyDate(cols[idxDate], defaultYear);
    if (!dateStr) {
      skipped++;
      continue;
    }

    const teachers = [];
    for (const c of teacherCols) {
      teachers.push(...splitTeacherCell(cols[c]));
    }

    if (teachers.length === 0) {
      skipped++;
      continue;
    }

    const existing = scheduleMap[dateStr]?.teachers || [];
    const merged = [...new Set([...existing, ...teachers])];
    scheduleMap[dateStr] = { teachers: merged };
  }

  const dates = Object.keys(scheduleMap).sort();
  if (dates.length === 0) {
    throw new Error("인식된 지도 순번이 없습니다. '날짜, 담당교사' (예: 2026-11-25, 김선생, 이선생) 형식인지 확인해 주세요.");
  }

  return {
    scheduleMap,
    count: dates.length,
    skipped,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1]
  };
}

/**
 * 일자별 담당 교사 명단 엑셀(.xlsx/.xls) 또는 CSV 파싱
 */
export async function parseDutyScheduleFile(file, defaultYear = new Date().getFullYear()) {
  const ext = file.name.split(".").pop().toLowerCase();
  const buffer = await file.arrayBuffer();

  if (ext === "csv") {
    const text = decodeCsvBuffer(buffer);
    const rows = parseCsvText(text);
    return rowsToDutyScheduleMap(rows, defaultYear);
  }

  if (ext === "xlsx" || ext === "xls") {
    if (typeof window.XLSX === "undefined") {
      throw new Error("엑셀 파서 라이브러리(SheetJS)를 불러오지 못했습니다. 인터넷 연결을 확인하거나 CSV로 저장해 업로드해 주세요.");
    }
    const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return rowsToDutyScheduleMap(rows, defaultYear);
  }

  throw new Error("지원하지 않는 파일 형식입니다. .xlsx, .xls, .csv 파일을 선택해 주세요.");
}

/**
 * 지도 순번 샘플 CSV 양식 다운로드 (현재 월 기준 평일 예시)
 */
export function downloadSampleDutyCsv(year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
  const samplePairs = [
    ["김선생", "이선생"],
    ["박선생", "최선생"],
    ["정선생", "강선생"],
    ["조선생", "윤선생"],
    ["장선생", "임선생"]
  ];
  const rows = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  let pairIdx = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue; // 주말 제외
    const [t1, t2] = samplePairs[pairIdx % samplePairs.length];
    pairIdx++;
    rows.push([`${year}-${pad2(month)}-${pad2(d)}`, t1, t2]);
    if (rows.length >= 10) break;
  }

  downloadCsv(`교문지도순번_샘플양식_${year}-${pad2(month)}.csv`, ["날짜", "담당교사1", "담당교사2"], rows);
}
