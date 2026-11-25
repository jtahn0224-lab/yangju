/**
 * 엑셀(.xlsx/.xls) 및 CSV 학생 명단 파싱, 샘플 생성, CSV 내보내기 유틸리티
 */

import { parseStudentId } from "./hangul.js";

export function getSampleStudentsMap() {
  const sample = [
    ["10101", 1, 1, 1, "김민수"],
    ["10102", 1, 1, 2, "이서연"],
    ["10103", 1, 1, 3, "박지훈"],
    ["10104", 1, 1, 4, "최수빈"],
    ["10105", 1, 1, 5, "정우진"],
    ["10106", 1, 1, 6, "강하은"],
    ["10107", 1, 1, 7, "조현우"],
    ["10108", 1, 1, 8, "윤지아"],
    ["10109", 1, 1, 9, "장도윤"],
    ["10110", 1, 1, 10, "임채원"],
    ["10201", 1, 2, 1, "한시우"],
    ["10202", 1, 2, 2, "오서윤"],
    ["10203", 1, 2, 3, "서예준"],
    ["10204", 1, 2, 4, "신다은"],
    ["10205", 1, 2, 5, "권주원"],
    ["10206", 1, 2, 6, "황소율"],
    ["10207", 1, 2, 7, "안건우"],
    ["10208", 1, 2, 8, "송유진"],
    ["10209", 1, 2, 9, "전민재"],
    ["10210", 1, 2, 10, "홍지유"],
    ["20101", 2, 1, 1, "고태양"],
    ["20102", 2, 1, 2, "문하린"],
    ["20103", 2, 1, 3, "양준서"],
    ["20104", 2, 1, 4, "손예린"],
    ["20105", 2, 1, 5, "배시현"],
    ["20106", 2, 1, 6, "백서아"],
    ["20107", 2, 1, 7, "허지호"],
    ["20108", 2, 1, 8, "유나연"],
    ["20109", 2, 1, 9, "남은우"],
    ["20110", 2, 1, 10, "심가은"]
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
    } else if (!Number.isNaN(grade) && !Number.isNaN(classNum) && !Number.isNaN(number)) {
      rawId = `${grade}${String(classNum).padStart(2, "0")}${String(number).padStart(2, "0")}`;
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
