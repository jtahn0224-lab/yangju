/**
 * ============================================================
 * 교문지도 실시간 웹앱 - 메인 UI 컨트롤러
 * ============================================================
 */

import { GateDatabase, hashPin } from "./db.js";
import { matchStudent, parseStudentId, buildStudentId, formatStudentId } from "./hangul.js";
import {
  getSampleStudentsMap,
  downloadCsv,
  downloadSampleRosterCsv,
  parseRosterFile,
  parseDutyScheduleFile,
  downloadSampleDutyCsv
} from "./roster.js";

const SESSION_KEY = "gate_teacher_session_v1";
const RECENT_TEACHERS_KEY = "gate_recent_teachers_v1";

const db = new GateDatabase();

const state = {
  teacherName: "",
  connection: { mode: "demo", connected: false },
  settings: {
    schoolName: "OO학교 교문지도",
    schoolLogo: "",
    lateTime: "08:30",
    pinHash: null,
    guidanceItems: [],
    repeatThresholdDays: 3,
    repeatPeriodDays: 30
  },
  studentsMap: {},
  studentsList: [],
  activeDate: getTodayDateString(),
  daily: {
    attendance: {},
    records: {}
  },
  rangeDailyMap: {},
  dutySchedule: {},
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth() + 1,
  selectedDutyDate: getTodayDateString(),
  pendingDutyUpload: null,
  repeatCategory: "all", // "all" | "late" | "guidance"
  repeatLoading: false,
  activeTab: "gate",
  gateSearch: "",
  gateGradeFilter: "all",
  attGradeFilter: "all",
  attClassFilter: "all",
  attStatusFilter: "all",
  recordTypeFilter: "all",
  recordSearch: "",
  pendingUpload: null,
  modalStudentId: null
};

let lastFetchedPeriodKey = "";

// DOM 참조 캐싱
const el = {
  loginScreen: document.getElementById("login-screen"),
  loginSyncDot: document.getElementById("login-sync-dot"),
  loginSyncLabel: document.getElementById("login-sync-label"),
  loginLogoImg: document.getElementById("login-logo-img"),
  loginLogoFallback: document.getElementById("login-logo-fallback"),
  loginSchoolName: document.getElementById("login-school-name"),
  loginForm: document.getElementById("login-form"),
  teacherNameInput: document.getElementById("teacher-name-input"),
  recentTeachers: document.getElementById("recent-teachers"),
  pinInput: document.getElementById("pin-input"),
  loginPinHint: document.getElementById("login-pin-hint"),
  rememberLogin: document.getElementById("remember-login"),
  loginError: document.getElementById("login-error"),
  openSetupGuideBtn: document.getElementById("open-setup-guide-btn"),

  appShell: document.getElementById("app-shell"),
  headerLogoImg: document.getElementById("header-logo-img"),
  headerSchoolName: document.getElementById("header-school-name"),
  syncStatusBtn: document.getElementById("sync-status-btn"),
  headerSyncDot: document.getElementById("header-sync-dot"),
  headerSyncText: document.getElementById("header-sync-text"),
  headerTeacherName: document.getElementById("header-teacher-name"),
  liveClock: document.getElementById("live-clock"),
  lateThresholdBadge: document.getElementById("late-threshold-badge"),
  logoutBtn: document.getElementById("logout-btn"),
  demoBanner: document.getElementById("demo-banner"),
  demoGuideBtn: document.getElementById("demo-guide-btn"),

  activeDateInput: document.getElementById("active-date-input"),
  openDutyScheduleBtn: document.getElementById("open-duty-schedule-btn"),
  todayDutyTeachers: document.getElementById("today-duty-teachers"),
  todayDutyNames: document.getElementById("today-duty-names"),
  statPresent: document.getElementById("stat-present"),
  statTotal: document.getElementById("stat-total"),
  statAbsent: document.getElementById("stat-absent"),
  statLate: document.getElementById("stat-late"),
  statGuidance: document.getElementById("stat-guidance"),

  // 탭 1: 빠른 교문지도
  gateSearchInput: document.getElementById("gate-search-input"),
  gateSearchClear: document.getElementById("gate-search-clear"),
  gateGradeFilters: document.getElementById("gate-grade-filters"),
  emptyRosterNotice: document.getElementById("empty-roster-notice"),
  quickLoadSampleBtn: document.getElementById("quick-load-sample-btn"),
  goRosterTabBtn: document.getElementById("go-roster-tab-btn"),
  gateStudentList: document.getElementById("gate-student-list"),
  feedCountBadge: document.getElementById("feed-count-badge"),
  liveFeedList: document.getElementById("live-feed-list"),

  // 탭 2: 등교 출석
  copyAbsentBtn: document.getElementById("copy-absent-btn"),
  markClassPresentBtn: document.getElementById("mark-class-present-btn"),
  attGradeChips: document.getElementById("att-grade-chips"),
  attClassChips: document.getElementById("att-class-chips"),
  attendanceProgressLabel: document.getElementById("attendance-progress-label"),
  attendanceProgressCount: document.getElementById("attendance-progress-count"),
  attendanceProgressBar: document.getElementById("attendance-progress-bar"),
  attendanceGrid: document.getElementById("attendance-grid"),

  // 탭 3: 기록·통계 & 반복 체크 학생
  repeatCountBadge: document.getElementById("repeat-count-badge"),
  repeatRuleSummary: document.getElementById("repeat-rule-summary"),
  copyRepeatBtn: document.getElementById("copy-repeat-btn"),
  exportRepeatCsvBtn: document.getElementById("export-repeat-csv-btn"),
  repeatThresholdButtons: document.getElementById("repeat-threshold-buttons"),
  repeatCustomDaysForm: document.getElementById("repeat-custom-days-form"),
  repeatCustomDaysInput: document.getElementById("repeat-custom-days-input"),
  repeatPeriodButtons: document.getElementById("repeat-period-buttons"),
  repeatCategoryButtons: document.getElementById("repeat-category-buttons"),
  repeatStudentsList: document.getElementById("repeat-students-list"),

  statsDateLabel: document.getElementById("stats-date-label"),
  itemStatsBars: document.getElementById("item-stats-bars"),
  classStatsList: document.getElementById("class-stats-list"),
  exportRecordsCsvBtn: document.getElementById("export-records-csv-btn"),
  exportAttendanceCsvBtn: document.getElementById("export-attendance-csv-btn"),
  recordTypeFilter: document.getElementById("record-type-filter"),
  recordSearchInput: document.getElementById("record-search-input"),
  recordsTableBody: document.getElementById("records-table-body"),

  // 탭 4: 명단·설정
  rosterTotalBadge: document.getElementById("roster-total-badge"),
  rosterDropzone: document.getElementById("roster-dropzone"),
  rosterFileInput: document.getElementById("roster-file-input"),
  uploadPreviewBox: document.getElementById("upload-preview-box"),
  uploadPreviewSummary: document.getElementById("upload-preview-summary"),
  uploadPreviewSample: document.getElementById("upload-preview-sample"),
  confirmUploadBtn: document.getElementById("confirm-upload-btn"),
  cancelUploadBtn: document.getElementById("cancel-upload-btn"),
  downloadSampleCsvBtn: document.getElementById("download-sample-csv-btn"),
  loadSampleRosterBtn: document.getElementById("load-sample-roster-btn"),
  clearRosterBtn: document.getElementById("clear-roster-btn"),
  addStudentForm: document.getElementById("add-student-form"),
  newStudentId: document.getElementById("new-student-id"),
  newStudentName: document.getElementById("new-student-name"),

  schoolSettingsForm: document.getElementById("school-settings-form"),
  settingSchoolName: document.getElementById("setting-school-name"),
  settingLateTime: document.getElementById("setting-late-time"),
  settingNewPin: document.getElementById("setting-new-pin"),
  settingLogoPreview: document.getElementById("setting-logo-preview"),
  settingLogoEmpty: document.getElementById("setting-logo-empty"),
  settingLogoInput: document.getElementById("setting-logo-input"),
  uploadLogoBtn: document.getElementById("upload-logo-btn"),
  removeLogoBtn: document.getElementById("remove-logo-btn"),
  settingsGuidanceItems: document.getElementById("settings-guidance-items"),
  addGuidanceItemForm: document.getElementById("add-guidance-item-form"),
  newItemLabel: document.getElementById("new-item-label"),

  // 모달 & 토스트
  guidanceModal: document.getElementById("guidance-modal"),
  guidanceModalForm: document.getElementById("guidance-modal-form"),
  guidanceModalStudent: document.getElementById("guidance-modal-student"),
  modalIncludeLateCard: document.getElementById("modal-include-late-card"),
  modalIncludeLate: document.getElementById("modal-include-late"),
  modalGuidanceChips: document.getElementById("modal-guidance-chips"),
  modalGuidanceMemo: document.getElementById("modal-guidance-memo"),
  setupGuideModal: document.getElementById("setup-guide-modal"),
  dutyScheduleModal: document.getElementById("duty-schedule-modal"),
  calPrevMonthBtn: document.getElementById("cal-prev-month-btn"),
  calMonthTitle: document.getElementById("cal-month-title"),
  calNextMonthBtn: document.getElementById("cal-next-month-btn"),
  calTodayBtn: document.getElementById("cal-today-btn"),
  dutyCalendarGrid: document.getElementById("duty-calendar-grid"),
  dutyDayEditForm: document.getElementById("duty-day-edit-form"),
  dutyEditDateLabel: document.getElementById("duty-edit-date-label"),
  dutyEditTeachersInput: document.getElementById("duty-edit-teachers-input"),
  dutyEditClearBtn: document.getElementById("duty-edit-clear-btn"),
  downloadSampleDutyBtn: document.getElementById("download-sample-duty-btn"),
  clearDutyScheduleBtn: document.getElementById("clear-duty-schedule-btn"),
  dutyDropzone: document.getElementById("duty-dropzone"),
  dutyFileInput: document.getElementById("duty-file-input"),
  dutyUploadPreviewBox: document.getElementById("duty-upload-preview-box"),
  dutyUploadPreviewSummary: document.getElementById("duty-upload-preview-summary"),
  dutyUploadPreviewSample: document.getElementById("duty-upload-preview-sample"),
  confirmDutyUploadBtn: document.getElementById("confirm-duty-upload-btn"),
  cancelDutyUploadBtn: document.getElementById("cancel-duty-upload-btn"),
  toastContainer: document.getElementById("toast-container")
};

/* ============================================================
   유틸리티 함수
   ============================================================ */

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCurrentTimeString() {
  const d = new Date();
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0")
  ].join(":");
}

function isPastLateThreshold() {
  const lateTime = state.settings.lateTime || "08:30";
  const [h, m] = lateTime.split(":").map(Number);
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins > h * 60 + m;
}

function showToast(message, type = "default") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2600);
}

function getSortedRecords() {
  const entries = Object.entries(state.daily.records || {}).map(([id, rec]) => ({
    id,
    ...rec
  }));
  entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return entries;
}

function getStudentRecordsMap() {
  const map = new Map();
  for (const rec of getSortedRecords()) {
    if (!map.has(rec.studentId)) map.set(rec.studentId, []);
    map.get(rec.studentId).push(rec);
  }
  return map;
}

function sortStudents(studentsMap) {
  return Object.values(studentsMap || {}).sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.classNum !== b.classNum) return a.classNum - b.classNum;
    if (a.number !== b.number) return a.number - b.number;
    return String(a.id).localeCompare(String(b.id));
  });
}

function formatPeriodLabel(periodDays) {
  return periodDays === "all" ? "전체 기간" : `최근 ${periodDays}일`;
}

function formatCategoryLabel(category) {
  if (category === "late") return "지각";
  if (category === "guidance") return "생활규정 지도";
  return "지각·생활규정 지도";
}

function formatShortDate(dateStr) {
  const parts = String(dateStr).split("-");
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : dateStr;
}

/* ============================================================
   교사 접속 / 세션 관리
   ============================================================ */

function loadSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.teacherName) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function saveSession(teacherName, remember) {
  const payload = JSON.stringify({ teacherName, loggedInAt: Date.now() });
  sessionStorage.setItem(SESSION_KEY, payload);
  if (remember) {
    localStorage.setItem(SESSION_KEY, payload);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  saveRecentTeacher(teacherName);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function getRecentTeachers() {
  try {
    const raw = localStorage.getItem(RECENT_TEACHERS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveRecentTeacher(name) {
  const list = getRecentTeachers().filter((t) => t !== name);
  list.unshift(name);
  localStorage.setItem(RECENT_TEACHERS_KEY, JSON.stringify(list.slice(0, 6)));
}

function renderRecentTeachers() {
  const list = getRecentTeachers();
  if (list.length === 0) {
    el.recentTeachers.innerHTML = "";
    return;
  }
  el.recentTeachers.innerHTML = list
    .map((name) => `<button type="button" class="chip" data-recent-teacher="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
    .join("");
}

function enterApp(teacherName) {
  state.teacherName = teacherName;
  el.headerTeacherName.textContent = `${teacherName} 선생님`;
  el.loginScreen.hidden = true;
  el.appShell.hidden = false;
  renderAll();
  refreshRepeatStudentsData(true);
}

function exitApp() {
  clearSession();
  state.teacherName = "";
  el.appShell.hidden = true;
  el.loginScreen.hidden = false;
  el.pinInput.value = "";
  el.loginError.hidden = true;
  renderRecentTeachers();
}

/* ============================================================
   반복 체크 학생 집계 로직
   ============================================================ */

async function refreshRepeatStudentsData(force = false) {
  const period = state.settings.repeatPeriodDays ?? 30;
  const fetchKey = `${state.activeDate}|${period}`;
  if (!force && fetchKey === lastFetchedPeriodKey && Object.keys(state.rangeDailyMap).length > 0) {
    renderRepeatStudents();
    return;
  }

  state.repeatLoading = true;
  renderRepeatStudents();

  try {
    const data = await db.fetchDailyRange(state.activeDate, period);
    state.rangeDailyMap = data || {};
    state.rangeDailyMap[state.activeDate] = state.daily;
    lastFetchedPeriodKey = fetchKey;
  } catch (err) {
    console.error("[RepeatStats] 기간 데이터 조회 실패:", err);
  } finally {
    state.repeatLoading = false;
    renderRepeatStudents();
  }
}

function computeRepeatStudents() {
  const threshold = Number(state.settings.repeatThresholdDays) || 3;
  const category = state.repeatCategory || "all";
  const byStudent = new Map();

  function ensureEntry(rawStudentId, fallback = {}) {
    const rosterInfo =
      state.studentsMap[rawStudentId] ||
      state.studentsMap[formatStudentId(rawStudentId)] ||
      {};
    const normalizedId = formatStudentId({
      id: rawStudentId,
      grade: rosterInfo.grade ?? fallback.grade,
      classNum: rosterInfo.classNum ?? fallback.classNum,
      number: rosterInfo.number ?? fallback.number
    });
    if (!byStudent.has(normalizedId)) {
      byStudent.set(normalizedId, {
        studentId: normalizedId,
        studentName: rosterInfo.name || fallback.studentName || normalizedId,
        grade: rosterInfo.grade ?? fallback.grade ?? "",
        classNum: rosterInfo.classNum ?? fallback.classNum ?? "",
        number: rosterInfo.number ?? fallback.number ?? "",
        lateDates: new Set(),
        guidanceDates: new Set(),
        lateCount: 0,
        guidanceCount: 0,
        itemCounts: new Map()
      });
    }
    return byStudent.get(normalizedId);
  }

  for (const [dateStr, dayData] of Object.entries(state.rangeDailyMap || {})) {
    if (!dayData) continue;

    const records = Object.values(dayData.records || {});
    const attendance = dayData.attendance || {};

    for (const rec of records) {
      if (!rec || !rec.studentId) continue;
      const entry = ensureEntry(String(rec.studentId), rec);
      const isLate = rec.type === "late" || Boolean(rec.includeLate);
      const hasItems = Array.isArray(rec.items) && rec.items.length > 0;
      const isGuidance = rec.type === "guidance" || hasItems;

      if (isLate) {
        entry.lateDates.add(dateStr);
        entry.lateCount++;
      }
      if (isGuidance) {
        entry.guidanceDates.add(dateStr);
        entry.guidanceCount++;
        for (const item of rec.items || []) {
          entry.itemCounts.set(item, (entry.itemCounts.get(item) || 0) + 1);
        }
      }
    }

    // 기록에는 없지만 출석에 지각으로 남아있는 경우 보완
    for (const [sid, att] of Object.entries(attendance)) {
      if (!att || !(att.late || att.status === "late")) continue;
      const entry = ensureEntry(String(sid));
      if (!entry.lateDates.has(dateStr)) {
        entry.lateDates.add(dateStr);
        entry.lateCount++;
      }
    }
  }

  const results = [];
  for (const entry of byStudent.values()) {
    let matchedDates;
    if (category === "late") {
      matchedDates = new Set(entry.lateDates);
    } else if (category === "guidance") {
      matchedDates = new Set(entry.guidanceDates);
    } else {
      matchedDates = new Set([...entry.lateDates, ...entry.guidanceDates]);
    }

    if (matchedDates.size < threshold) continue;

    const sortedDates = [...matchedDates].sort((a, b) => b.localeCompare(a));
    const topItems = [...entry.itemCounts.entries()].sort((a, b) => b[1] - a[1]);

    results.push({
      studentId: entry.studentId,
      studentName: entry.studentName,
      grade: entry.grade,
      classNum: entry.classNum,
      number: entry.number,
      daysCount: matchedDates.size,
      lateDays: entry.lateDates.size,
      guidanceDays: entry.guidanceDates.size,
      lateCount: entry.lateCount,
      guidanceCount: entry.guidanceCount,
      totalCount:
        category === "late"
          ? entry.lateCount
          : category === "guidance"
          ? entry.guidanceCount
          : entry.lateCount + entry.guidanceCount,
      dates: sortedDates,
      topItems
    });
  }

  results.sort((a, b) => {
    if (b.daysCount !== a.daysCount) return b.daysCount - a.daysCount;
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    return String(a.studentId).localeCompare(String(b.studentId));
  });

  return results;
}

function renderRepeatControls() {
  const threshold = Number(state.settings.repeatThresholdDays) || 3;
  const period = state.settings.repeatPeriodDays ?? 30;
  const presets = [2, 3, 4, 5, 7];

  el.repeatThresholdButtons.querySelectorAll("[data-repeat-days]").forEach((btn) => {
    const val = Number(btn.dataset.repeatDays);
    btn.classList.toggle("active", val === threshold);
  });

  if (!presets.includes(threshold)) {
    el.repeatCustomDaysInput.value = String(threshold);
  } else if (document.activeElement !== el.repeatCustomDaysInput) {
    el.repeatCustomDaysInput.value = "";
  }

  el.repeatPeriodButtons.querySelectorAll("[data-repeat-period]").forEach((btn) => {
    const val = btn.dataset.repeatPeriod;
    btn.classList.toggle("active", String(period) === val);
  });

  el.repeatCategoryButtons.querySelectorAll("[data-repeat-category]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.repeatCategory === state.repeatCategory);
  });

  el.repeatRuleSummary.textContent = `${formatPeriodLabel(period)} (기준일 ${state.activeDate}) 동안 ${threshold}일 이상 ${formatCategoryLabel(state.repeatCategory)} 체크된 학생을 표시합니다.`;
}

function renderRepeatStudents() {
  renderRepeatControls();

  if (state.repeatLoading) {
    el.repeatCountBadge.textContent = "집계 중...";
    el.repeatStudentsList.innerHTML = `<div class="empty-state" style="grid-column:1/-1">기간별 기록을 불러오는 중입니다...</div>`;
    return;
  }

  const threshold = Number(state.settings.repeatThresholdDays) || 3;
  const period = state.settings.repeatPeriodDays ?? 30;
  const list = computeRepeatStudents();

  el.repeatCountBadge.textContent = `${list.length}명 해당`;

  if (list.length === 0) {
    el.repeatStudentsList.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <strong>${escapeHtml(formatPeriodLabel(period))} 동안 ${threshold}일 이상 반복 체크된 학생이 없습니다.</strong>
        <p>위의 기준 일수 버튼(예: 2일 이상)이나 집계 기간을 조정해 확인할 수 있습니다.</p>
      </div>
    `;
    return;
  }

  el.repeatStudentsList.innerHTML = list
    .map((item, index) => {
      const isHigh = item.daysCount >= threshold + 2 || item.daysCount >= 5;
      const classText =
        item.grade && item.classNum
          ? `${item.grade}학년 ${item.classNum}반${item.number ? ` ${item.number}번` : ""}`
          : "";

      const pills = [];
      if (item.lateDays > 0 && state.repeatCategory !== "guidance") {
        pills.push(`<span class="pill-mini pill-late">지각 ${item.lateDays}일 (${item.lateCount}건)</span>`);
      }
      if (item.guidanceDays > 0 && state.repeatCategory !== "late") {
        pills.push(`<span class="pill-mini pill-guidance">생활지도 ${item.guidanceDays}일 (${item.guidanceCount}건)</span>`);
      }
      if (state.repeatCategory !== "late") {
        for (const [label, cnt] of item.topItems.slice(0, 3)) {
          pills.push(`<span class="pill-mini pill-neutral">${escapeHtml(label)} ${cnt}회</span>`);
        }
      }

      const shownDates = item.dates.slice(0, 6).map(formatShortDate).join(", ");
      const moreDates = item.dates.length > 6 ? ` 외 ${item.dates.length - 6}일` : "";

      return `
        <div class="repeat-item ${isHigh ? "is-high" : ""}">
          <div class="repeat-item-top">
            <div class="repeat-student-wrap">
              <span class="repeat-rank">#${index + 1}</span>
              <span class="student-id-badge">${escapeHtml(item.studentId)}</span>
              <strong class="student-name">${escapeHtml(item.studentName)}</strong>
              ${classText ? `<span class="text-muted" style="font-size:0.78rem">${escapeHtml(classText)}</span>` : ""}
            </div>
            <span class="repeat-days-badge">${item.daysCount}일 누적</span>
          </div>
          <div class="repeat-tags">${pills.join("")}</div>
          <div class="repeat-dates">체크일: ${escapeHtml(shownDates)}${escapeHtml(moreDates)}</div>
        </div>
      `;
    })
    .join("");
}

/* ============================================================
   실시간 시계 & 연결 상태 표시
   ============================================================ */

function updateClock() {
  const nowStr = getCurrentTimeString();
  el.liveClock.textContent = nowStr;

  const lateTime = state.settings.lateTime || "08:30";
  const isLateNow = isPastLateThreshold();
  el.lateThresholdBadge.textContent = isLateNow
    ? `지각 시간대 (기준 ${lateTime})`
    : `지각 기준 ${lateTime}`;
  el.lateThresholdBadge.classList.toggle("is-late-time", isLateNow);
}

function renderConnectionStatus() {
  const { mode, connected } = state.connection;
  let dotClass = "demo";
  let text = "로컬 체험 모드";

  if (mode === "firebase") {
    if (connected) {
      dotClass = "online";
      text = "Firebase 실시간 동기화";
    } else {
      dotClass = "offline";
      text = "오프라인 (재연결 중)";
    }
  }

  el.loginSyncDot.className = `status-dot ${dotClass}`;
  el.loginSyncLabel.textContent = text;
  el.headerSyncDot.className = `status-dot ${dotClass}`;
  el.headerSyncText.textContent = mode === "firebase" ? (connected ? "실시간 동기화" : "재연결 중") : "로컬 체험";
  el.demoBanner.hidden = mode === "firebase";
}

/* ============================================================
   렌더링 함수
   ============================================================ */

const STATIC_LOGO_PATH = "./assets/school-logo.png";

const DYNAMIC_THEME_VARS = [
  "--bg",
  "--surface-alt",
  "--border",
  "--border-strong",
  "--primary",
  "--primary-hover",
  "--primary-soft",
  "--primary-border",
  "--primary-ring",
  "--header-bg-start",
  "--header-bg-mid",
  "--header-bg-end",
  "--accent-bg",
  "--accent-border",
  "--accent-tag-bg"
];

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function hueDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function resetDynamicTheme() {
  const root = document.documentElement.style;
  for (const key of DYNAMIC_THEME_VARS) {
    root.removeProperty(key);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", "#14532d");
}

/**
 * 업로드된 양주중학교 교표 이미지에서 대표 색상(주색/보조색)을 추출해
 * 대비(WCAG)가 보장되는 앱 테마 색감으로 자동 조화
 */
function applyThemeFromLogoSrc(src) {
  if (!src) {
    resetDynamicTheme();
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const size = 48;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);

      const bins = Array.from({ length: 24 }, () => ({
        weight: 0,
        hSum: 0,
        sSum: 0,
        lSum: 0
      }));

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 160) continue;
        const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        // 흰색/검정/회색 배경 제외
        if (s < 0.22 || l < 0.12 || l > 0.88) continue;

        const binIdx = Math.floor(((h % 360) + 360) % 360 / 15) % 24;
        const weight = s * (1 - Math.abs(l - 0.45));
        bins[binIdx].weight += weight;
        bins[binIdx].hSum += h * weight;
        bins[binIdx].sSum += s * weight;
        bins[binIdx].lSum += l * weight;
      }

      const ranked = bins
        .filter((b) => b.weight > 0.8)
        .map((b) => ({
          weight: b.weight,
          h: Math.round(b.hSum / b.weight),
          s: Math.round((b.sSum / b.weight) * 100),
          l: Math.round((b.lSum / b.weight) * 100)
        }))
        .sort((a, b) => b.weight - a.weight);

      if (ranked.length === 0) {
        resetDynamicTheme();
        return;
      }

      // 노란색(45~65도)만 단독 주색이면 텍스트 대비가 낮으므로 녹/청/남/자주 계열이 함께 있으면 그쪽을 주색, 노랑을 포인트로 사용
      let primary = ranked[0];
      let accent = null;

      if (primary.h >= 38 && primary.h <= 68 && ranked.length > 1) {
        const nonYellow = ranked.find((c) => !(c.h >= 38 && c.h <= 68) && c.weight >= primary.weight * 0.25);
        if (nonYellow) {
          accent = primary;
          primary = nonYellow;
        }
      }

      if (!accent) {
        accent = ranked.find((c) => hueDistance(c.h, primary.h) >= 40 && c.weight >= primary.weight * 0.14) || null;
      }

      const pH = primary.h;
      const pS = clamp(primary.s, 45, 70);
      const root = document.documentElement.style;

      root.setProperty("--bg", `hsl(${pH}, 18%, 96%)`);
      root.setProperty("--surface-alt", `hsl(${pH}, 22%, 98%)`);
      root.setProperty("--border", `hsl(${pH}, 18%, 88%)`);
      root.setProperty("--border-strong", `hsl(${pH}, 16%, 78%)`);

      root.setProperty("--primary", `hsl(${pH}, ${pS}%, 28%)`);
      root.setProperty("--primary-hover", `hsl(${pH}, ${clamp(pS + 4, 48, 76)}%, 22%)`);
      root.setProperty("--primary-soft", `hsl(${pH}, ${clamp(pS, 45, 75)}%, 95%)`);
      root.setProperty("--primary-border", `hsl(${pH}, ${clamp(pS, 40, 68)}%, 79%)`);
      root.setProperty("--primary-ring", `hsla(${pH}, ${pS}%, 30%, 0.18)`);

      root.setProperty("--header-bg-start", `hsl(${pH}, ${clamp(pS + 4, 46, 74)}%, 17%)`);
      root.setProperty("--header-bg-mid", `hsl(${pH}, ${pS}%, 23%)`);
      root.setProperty("--header-bg-end", `hsl(${pH}, ${clamp(pS - 2, 42, 68)}%, 29%)`);

      if (accent) {
        const aH = accent.h;
        const aS = clamp(accent.s, 55, 88);
        const tagL = aH >= 38 && aH <= 68 ? 36 : 38;
        root.setProperty("--accent-bg", `hsl(${aH}, 92%, 96%)`);
        root.setProperty("--accent-border", `hsl(${aH}, ${aS}%, 48%)`);
        root.setProperty("--accent-tag-bg", `hsl(${aH}, ${clamp(aS, 58, 82)}%, ${tagL}%)`);
      } else {
        root.removeProperty("--accent-bg");
        root.removeProperty("--accent-border");
        root.removeProperty("--accent-tag-bg");
      }

      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", `hsl(${pH}, ${pS}%, 23%)`);
    } catch {
      resetDynamicTheme();
    }
  };
  img.onerror = () => resetDynamicTheme();
  img.src = src;
}

function applySchoolLogoUI(logoSrc) {
  const showLogo = (src) => {
    if (el.loginLogoImg) {
      el.loginLogoImg.src = src;
      el.loginLogoImg.hidden = false;
    }
    if (el.loginLogoFallback) el.loginLogoFallback.hidden = true;
    if (el.headerLogoImg) {
      el.headerLogoImg.src = src;
      el.headerLogoImg.hidden = false;
    }
    if (el.settingLogoPreview) {
      el.settingLogoPreview.src = src;
      el.settingLogoPreview.hidden = false;
    }
    if (el.settingLogoEmpty) el.settingLogoEmpty.hidden = true;
    applyThemeFromLogoSrc(src);
  };

  const hideLogo = () => {
    if (el.loginLogoImg) el.loginLogoImg.hidden = true;
    if (el.loginLogoFallback) el.loginLogoFallback.hidden = false;
    if (el.headerLogoImg) el.headerLogoImg.hidden = true;
    if (el.settingLogoPreview) el.settingLogoPreview.hidden = true;
    if (el.settingLogoEmpty) el.settingLogoEmpty.hidden = false;
    resetDynamicTheme();
  };

  if (logoSrc) {
    showLogo(logoSrc);
    return;
  }

  // Firebase에 저장된 로고가 없으면 정적 파일(./assets/school-logo.png) 자동 확인
  const probe = new Image();
  probe.onload = () => {
    if (!state.settings.schoolLogo) showLogo(STATIC_LOGO_PATH);
  };
  probe.onerror = () => {
    if (!state.settings.schoolLogo) hideLogo();
  };
  probe.src = STATIC_LOGO_PATH;
}

/**
 * 업로드한 로고 이미지를 최대 240x240 크기로 최적화해 Data URL 생성
 */
function resizeLogoImageToDataUrl(file, maxSize = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("올바른 이미지 파일이 아닙니다."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderSettingsUI() {
  const s = state.settings;
  document.title = `${s.schoolName} | 실시간 교문지도`;
  el.loginSchoolName.textContent = s.schoolName;
  el.headerSchoolName.textContent = s.schoolName;
  el.settingSchoolName.value = s.schoolName;
  el.settingLateTime.value = s.lateTime;
  applySchoolLogoUI(s.schoolLogo);

  if (s.pinHash) {
    el.loginPinHint.textContent = "학교에서 설정한 교사 접속 PIN을 입력해 주세요.";
  } else {
    el.loginPinHint.innerHTML = '초기 기본 PIN은 <strong>1234</strong>입니다. 접속 후 설정 탭에서 변경할 수 있습니다.';
  }

  el.settingsGuidanceItems.innerHTML = (s.guidanceItems || [])
    .map(
      (item, idx) => `
      <span class="manage-tag">
        ${escapeHtml(item)}
        <button type="button" data-remove-item-idx="${idx}" aria-label="${escapeHtml(item)} 삭제">&times;</button>
      </span>
    `
    )
    .join("");

  updateClock();
  renderRepeatControls();
}

function renderSummaryCounters() {
  const total = state.studentsList.length;
  const attendance = state.daily.attendance || {};
  const records = getSortedRecords();

  let presentCount = 0;
  let lateCount = 0;
  for (const stu of state.studentsList) {
    const att = attendance[stu.id];
    if (att) {
      presentCount++;
      if (att.late || att.status === "late") lateCount++;
    }
  }
  const absentCount = Math.max(0, total - presentCount);
  const guidanceCount = records.filter((r) => r.type === "guidance" || (Array.isArray(r.items) && r.items.length > 0)).length;

  el.statTotal.textContent = String(total);
  el.statPresent.textContent = String(presentCount);
  el.statAbsent.textContent = String(absentCount);
  el.statLate.textContent = String(lateCount);
  el.statGuidance.textContent = String(guidanceCount);
  el.rosterTotalBadge.textContent = `${total}명`;
}

function renderGradeFilters(container, currentGrade, attrName) {
  const grades = [...new Set(state.studentsList.map((s) => s.grade))].sort((a, b) => a - b);
  if (grades.length === 0) {
    container.innerHTML = "";
    return;
  }
  const chips = [
    `<button type="button" class="chip ${currentGrade === "all" ? "active" : ""}" ${attrName}="all">전체 학년</button>`,
    ...grades.map(
      (g) => `<button type="button" class="chip ${String(currentGrade) === String(g) ? "active" : ""}" ${attrName}="${g}">${g}학년</button>`
    )
  ];
  container.innerHTML = chips.join("");
}

function renderGateTab() {
  const hasStudents = state.studentsList.length > 0;
  el.emptyRosterNotice.hidden = hasStudents;
  renderGradeFilters(el.gateGradeFilters, state.gateGradeFilter, "data-gate-grade");

  if (!hasStudents) {
    el.gateStudentList.innerHTML = "";
    renderLiveFeed();
    return;
  }

  const attendance = state.daily.attendance || {};
  const studentRecs = getStudentRecordsMap();

  const filtered = state.studentsList.filter((stu) => {
    if (state.gateGradeFilter !== "all" && String(stu.grade) !== String(state.gateGradeFilter)) {
      return false;
    }
    return matchStudent(stu, state.gateSearch);
  });

  if (filtered.length === 0) {
    el.gateStudentList.innerHTML = `<li class="empty-state">검색 조건에 맞는 학생이 없습니다.</li>`;
  } else {
    const visible = filtered.slice(0, 60);
    el.gateStudentList.innerHTML = visible
      .map((stu) => {
        const att = attendance[stu.id];
        const recs = studentRecs.get(stu.id) || [];
        const isLate = Boolean(att?.late || att?.status === "late");
        const isPresent = Boolean(att);
        const guidanceTags = recs.flatMap((r) => r.items || []);

        const rowClass = isLate ? "is-late" : isPresent ? "is-present" : "";

        const statusPills = [];
        if (isLate) {
          statusPills.push(`<span class="pill-mini pill-late">지각 ${escapeHtml(att.time || "")}</span>`);
        } else if (isPresent) {
          statusPills.push(`<span class="pill-mini pill-present">등교 ${escapeHtml(att.time || "")}</span>`);
        } else {
          statusPills.push(`<span>미등교</span>`);
        }
        if (guidanceTags.length > 0) {
          const uniq = [...new Set(guidanceTags)];
          statusPills.push(`<span class="pill-mini pill-guidance">${escapeHtml(uniq.join(", "))}</span>`);
        }

        return `
          <li class="student-row ${rowClass}" data-student-id="${escapeHtml(stu.id)}">
            <div class="student-info">
              <div class="student-title">
                <span class="student-id-badge">${escapeHtml(formatStudentId(stu))}</span>
                <span class="student-name">${escapeHtml(stu.name)}</span>
                <span class="text-muted" style="font-size:0.8rem">${stu.grade}학년 ${stu.classNum}반 ${stu.number}번</span>
              </div>
              <div class="student-meta">${statusPills.join("")}</div>
            </div>
            <div class="quick-actions">
              <button type="button" class="action-btn present-btn ${isPresent && !isLate ? "active" : ""}" data-action="present" data-id="${escapeHtml(stu.id)}">
                ${isPresent && !isLate ? "등교됨" : "등교"}
              </button>
              <button type="button" class="action-btn late-btn ${isLate ? "active" : ""}" data-action="late" data-id="${escapeHtml(stu.id)}">
                지각
              </button>
              <button type="button" class="action-btn guide-btn" data-action="guide" data-id="${escapeHtml(stu.id)}">
                지도
              </button>
            </div>
          </li>
        `;
      })
      .join("");

    if (filtered.length > 60) {
      el.gateStudentList.innerHTML += `<li class="empty-state">상위 60명만 표시됩니다. 학번이나 초성으로 검색 범위를 좁혀주세요. (전체 ${filtered.length}명)</li>`;
    }
  }

  renderLiveFeed();
}

function renderLiveFeed() {
  const records = getSortedRecords();
  el.feedCountBadge.textContent = `${records.length}건`;

  if (records.length === 0) {
    el.liveFeedList.innerHTML = `<li class="empty-state">아직 기록된 지각·생활지도 내역이 없습니다.<br />좌측에서 학생을 검색해 즉시 체크해 보세요.</li>`;
    return;
  }

  el.liveFeedList.innerHTML = records
    .slice(0, 40)
    .map((rec) => {
      const tags = [];
      if (rec.type === "late" || rec.includeLate) {
        tags.push(`<span class="pill-mini pill-late">지각</span>`);
      }
      if (Array.isArray(rec.items)) {
        for (const item of rec.items) {
          tags.push(`<span class="pill-mini pill-guidance">${escapeHtml(item)}</span>`);
        }
      }

      return `
        <li class="feed-item">
          <div class="feed-item-main">
            <div class="feed-item-top">
              <span class="student-id-badge">${escapeHtml(formatStudentId(rec))}</span>
              <strong>${escapeHtml(rec.studentName)}</strong>
            </div>
            <div class="feed-tags">${tags.join("")}</div>
            ${rec.memo ? `<p class="feed-memo">메모: ${escapeHtml(rec.memo)}</p>` : ""}
            <div class="feed-footer">${escapeHtml(rec.time || "")} · ${escapeHtml(rec.teacher || "")} 선생님</div>
          </div>
          <button type="button" class="btn-delete-mini" data-delete-record="${escapeHtml(rec.id)}" title="기록 삭제">취소</button>
        </li>
      `;
    })
    .join("");
}

function renderAttendanceTab() {
  renderGradeFilters(el.attGradeChips, state.attGradeFilter, "data-att-grade");

  const classCandidates = state.studentsList.filter(
    (s) => state.attGradeFilter === "all" || String(s.grade) === String(state.attGradeFilter)
  );
  const classes = [...new Set(classCandidates.map((s) => s.classNum))].sort((a, b) => a - b);

  if (state.attClassFilter !== "all" && !classes.includes(Number(state.attClassFilter))) {
    state.attClassFilter = "all";
  }

  if (classes.length === 0) {
    el.attClassChips.innerHTML = "";
  } else {
    el.attClassChips.innerHTML = [
      `<button type="button" class="chip ${state.attClassFilter === "all" ? "active" : ""}" data-att-class="all">전체 반</button>`,
      ...classes.map(
        (c) => `<button type="button" class="chip ${String(state.attClassFilter) === String(c) ? "active" : ""}" data-att-class="${c}">${c}반</button>`
      )
    ].join("");
  }

  const attendance = state.daily.attendance || {};
  const studentRecs = getStudentRecordsMap();

  const scopeStudents = state.studentsList.filter((s) => {
    if (state.attGradeFilter !== "all" && String(s.grade) !== String(state.attGradeFilter)) return false;
    if (state.attClassFilter !== "all" && String(s.classNum) !== String(state.attClassFilter)) return false;
    return true;
  });

  const presentInScope = scopeStudents.filter((s) => Boolean(attendance[s.id])).length;
  const pct = scopeStudents.length > 0 ? Math.round((presentInScope / scopeStudents.length) * 100) : 0;
  el.attendanceProgressLabel.textContent = `등교율 ${pct}%`;
  el.attendanceProgressCount.textContent = `${presentInScope} / ${scopeStudents.length}명`;
  el.attendanceProgressBar.style.width = `${pct}%`;

  const visibleStudents = scopeStudents.filter((s) => {
    const att = attendance[s.id];
    const recs = studentRecs.get(s.id) || [];
    if (state.attStatusFilter === "absent") return !att;
    if (state.attStatusFilter === "present") return Boolean(att);
    if (state.attStatusFilter === "late") return Boolean(att?.late || att?.status === "late");
    if (state.attStatusFilter === "guided") return recs.some((r) => Array.isArray(r.items) && r.items.length > 0);
    return true;
  });

  if (visibleStudents.length === 0) {
    el.attendanceGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">해당 조건의 학생이 없습니다.</div>`;
    return;
  }

  el.attendanceGrid.innerHTML = visibleStudents
    .map((s) => {
      const att = attendance[s.id];
      const recs = studentRecs.get(s.id) || [];
      const isLate = Boolean(att?.late || att?.status === "late");
      const isPresent = Boolean(att);
      const guidedCount = recs.reduce((acc, r) => acc + (r.items?.length || 0), 0);

      const cardClass = isLate ? "status-late" : isPresent ? "status-present" : "";
      const statusText = isLate
        ? `지각 ${att.time || ""}`
        : isPresent
        ? `등교 ${att.time || ""}`
        : "미등교";

      return `
        <div class="att-card ${cardClass}">
          <div class="att-card-top">
            <span class="student-id-badge">${escapeHtml(formatStudentId(s))}</span>
            ${guidedCount > 0 ? `<span class="pill-mini pill-guidance">지도 ${guidedCount}</span>` : ""}
          </div>
          <div class="att-card-name">${escapeHtml(s.name)}</div>
          <div class="att-card-time">${escapeHtml(statusText)}</div>
          <div class="att-card-actions">
            <button type="button" class="action-btn present-btn ${isPresent && !isLate ? "active" : ""}" data-action="present" data-id="${escapeHtml(s.id)}">
              ${isPresent ? "출석취소" : "등교체크"}
            </button>
            <button type="button" class="action-btn guide-btn" data-action="guide" data-id="${escapeHtml(s.id)}">
              지각·지도
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderRecordsTab() {
  renderRepeatStudents();

  const records = getSortedRecords();
  el.statsDateLabel.textContent = state.activeDate;

  // 1. 항목별 통계 막대 그래프
  const counts = new Map();
  let lateTotal = 0;
  for (const r of records) {
    if (r.type === "late" || r.includeLate) lateTotal++;
    for (const item of r.items || []) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
  }

  const statEntries = [];
  if (lateTotal > 0) statEntries.push({ label: "지각", count: lateTotal, isLate: true });
  for (const [label, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    statEntries.push({ label, count, isLate: false });
  }

  if (statEntries.length === 0) {
    el.itemStatsBars.innerHTML = `<p class="empty-state">집계된 지도 기록이 없습니다.</p>`;
  } else {
    const maxCount = Math.max(...statEntries.map((e) => e.count), 1);
    el.itemStatsBars.innerHTML = statEntries
      .map((entry) => {
        const width = Math.round((entry.count / maxCount) * 100);
        return `
          <div class="bar-row">
            <span class="bar-label" title="${escapeHtml(entry.label)}">${escapeHtml(entry.label)}</span>
            <div class="bar-track">
              <div class="bar-fill ${entry.isLate ? "is-late" : ""}" style="width:${width}%"></div>
            </div>
            <span class="bar-count">${entry.count}건</span>
          </div>
        `;
      })
      .join("");
  }

  // 2. 학년·반별 현황
  const attendance = state.daily.attendance || {};
  const classGroups = new Map();
  for (const s of state.studentsList) {
    const key = `${s.grade}학년 ${s.classNum}반`;
    if (!classGroups.has(key)) {
      classGroups.set(key, { total: 0, present: 0, late: 0, guided: 0 });
    }
    const g = classGroups.get(key);
    g.total++;
    const att = attendance[s.id];
    if (att) {
      g.present++;
      if (att.late || att.status === "late") g.late++;
    }
  }
  for (const r of records) {
    const key = `${r.grade}학년 ${r.classNum}반`;
    if (classGroups.has(key) && Array.isArray(r.items) && r.items.length > 0) {
      classGroups.get(key).guided++;
    }
  }

  if (classGroups.size === 0) {
    el.classStatsList.innerHTML = `<p class="empty-state">등록된 학급이 없습니다.</p>`;
  } else {
    el.classStatsList.innerHTML = [...classGroups.entries()]
      .map(
        ([label, g]) => `
        <div class="mini-stat-row">
          <strong>${escapeHtml(label)}</strong>
          <span>
            등교 <strong>${g.present}/${g.total}</strong> ·
            <span class="text-danger">지각 ${g.late}</span> ·
            <span class="text-warning">지도 ${g.guided}</span>
          </span>
        </div>
      `
      )
      .join("");
  }

  // 3. 상세 기록 테이블
  const q = state.recordSearch.trim().toLowerCase();
  const filteredRecords = records.filter((r) => {
    if (state.recordTypeFilter === "late" && !(r.type === "late" || r.includeLate)) return false;
    if (state.recordTypeFilter === "guidance" && !(Array.isArray(r.items) && r.items.length > 0)) return false;
    if (!q) return true;
    const hay = [formatStudentId(r), r.studentId, r.studentName, r.teacher, r.memo, ...(r.items || [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  if (filteredRecords.length === 0) {
    el.recordsTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">표시할 기록이 없습니다.</td></tr>`;
    return;
  }

  el.recordsTableBody.innerHTML = filteredRecords
    .map((r) => {
      const typeBadges = [];
      if (r.type === "late" || r.includeLate) typeBadges.push(`<span class="pill-mini pill-late">지각</span>`);
      if (Array.isArray(r.items) && r.items.length > 0) typeBadges.push(`<span class="pill-mini pill-guidance">생활규정</span>`);

      const detailParts = [];
      if (Array.isArray(r.items) && r.items.length > 0) {
        detailParts.push(escapeHtml(r.items.join(", ")));
      }
      if (r.memo) {
        detailParts.push(`<span class="text-muted">(${escapeHtml(r.memo)})</span>`);
      }

      return `
        <tr>
          <td style="font-variant-numeric:tabular-nums">${escapeHtml(r.time || "")}</td>
          <td><strong>${escapeHtml(formatStudentId(r))}</strong></td>
          <td>${escapeHtml(r.studentName)}</td>
          <td>${typeBadges.join(" ")}</td>
          <td>${detailParts.join(" ") || "-"}</td>
          <td>${escapeHtml(r.teacher || "")}</td>
          <td><button type="button" class="btn-delete-mini" data-delete-record="${escapeHtml(r.id)}">삭제</button></td>
        </tr>
      `;
    })
    .join("");
}

/* ============================================================
   교문지도 순번 (오늘 담당 표시 · 월별 달력 · 엑셀 업로드)
   ============================================================ */

function getDutyTeachersForDate(dateStr) {
  const entry = state.dutySchedule?.[dateStr];
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.filter(Boolean);
  if (Array.isArray(entry.teachers)) return entry.teachers.filter(Boolean);
  if (typeof entry === "string") {
    return entry.split(/[,/·|\n]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function renderTodayDutyBadge() {
  if (!el.todayDutyTeachers || !el.todayDutyNames) return;
  const targetDate = state.activeDate || getTodayDateString();
  const isToday = targetDate === getTodayDateString();
  const teachers = getDutyTeachersForDate(targetDate);

  const labelEl = el.todayDutyTeachers.querySelector(".duty-label");
  if (labelEl) {
    labelEl.textContent = isToday ? "오늘 담당" : `${formatShortDate(targetDate)} 담당`;
  }

  if (teachers.length > 0) {
    el.todayDutyNames.textContent = teachers.join(", ");
    el.todayDutyTeachers.classList.remove("is-empty");
    el.todayDutyTeachers.title = `${targetDate} 담당 선생님: ${teachers.join(", ")}`;
  } else {
    el.todayDutyNames.textContent = "미지정 · 눌러서 등록";
    el.todayDutyTeachers.classList.add("is-empty");
    el.todayDutyTeachers.title = `${targetDate} 담당 선생님이 등록되지 않았습니다. 눌러서 등록하세요.`;
  }
}

function syncDutyDayEditBox() {
  const dateStr = state.selectedDutyDate || state.activeDate;
  const teachers = getDutyTeachersForDate(dateStr);
  el.dutyEditDateLabel.textContent = `${dateStr} 담당 선생님`;
  el.dutyEditTeachersInput.value = teachers.join(", ");
}

function renderDutyCalendar() {
  const year = state.calendarYear;
  const month = state.calendarMonth; // 1..12
  el.calMonthTitle.textContent = `${year}년 ${month}월`;

  const todayStr = getTodayDateString();
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const startDow = firstDayOfMonth.getDay(); // 0(일)~6(토)
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const pad2 = (n) => String(n).padStart(2, "0");
  const cells = [];

  for (let i = 0; i < totalCells; i++) {
    let cellYear = year;
    let cellMonth = month;
    let dayNum;
    let isOutside = false;

    if (i < startDow) {
      isOutside = true;
      dayNum = prevMonthDays - startDow + 1 + i;
      cellMonth = month - 1;
      if (cellMonth < 1) {
        cellMonth = 12;
        cellYear = year - 1;
      }
    } else if (i >= startDow + daysInMonth) {
      isOutside = true;
      dayNum = i - (startDow + daysInMonth) + 1;
      cellMonth = month + 1;
      if (cellMonth > 12) {
        cellMonth = 1;
        cellYear = year + 1;
      }
    } else {
      dayNum = i - startDow + 1;
    }

    const dateStr = `${cellYear}-${pad2(cellMonth)}-${pad2(dayNum)}`;
    const dow = i % 7;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === state.selectedDutyDate;
    const teachers = getDutyTeachersForDate(dateStr);

    const classes = ["cal-cell"];
    if (isOutside) classes.push("is-outside");
    if (dow === 0) classes.push("is-sun");
    if (dow === 6) classes.push("is-sat");
    if (isToday) classes.push("is-today");
    if (isSelected) classes.push("is-selected");

    const teacherHtml = teachers
      .slice(0, 3)
      .map((name) => `<span class="cal-teacher-chip" title="${escapeHtml(name)}">${escapeHtml(name)}</span>`)
      .join("");
    const moreHtml =
      teachers.length > 3
        ? `<span class="cal-teacher-chip">+${teachers.length - 3}명</span>`
        : "";

    cells.push(`
      <button type="button" class="${classes.join(" ")}" data-cal-date="${dateStr}">
        <span class="cal-day-num">
          <span>${dayNum}</span>
          ${isToday ? '<span class="cal-today-dot">오늘</span>' : ""}
        </span>
        <span class="cal-teachers">${teacherHtml}${moreHtml}</span>
      </button>
    `);
  }

  el.dutyCalendarGrid.innerHTML = cells.join("");
  syncDutyDayEditBox();
}

function openDutyScheduleModal() {
  const baseDate = state.activeDate || getTodayDateString();
  const [y, m] = baseDate.split("-").map(Number);
  state.calendarYear = y || new Date().getFullYear();
  state.calendarMonth = m || new Date().getMonth() + 1;
  state.selectedDutyDate = baseDate;
  state.pendingDutyUpload = null;
  el.dutyUploadPreviewBox.hidden = true;
  renderDutyCalendar();
  el.dutyScheduleModal.showModal();
}

async function handleDutyFileSelected(file) {
  try {
    const result = await parseDutyScheduleFile(file, state.calendarYear);
    state.pendingDutyUpload = result;
    el.dutyUploadPreviewSummary.textContent = `${result.count}일치 순번 인식됨 (${result.firstDate} ~ ${result.lastDate})${result.skipped ? ` · 제외 ${result.skipped}행` : ""}`;
    const previewItems = Object.entries(result.scheduleMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 5)
      .map(([d, v]) => `${formatShortDate(d)}: ${v.teachers.join(", ")}`)
      .join(" / ");
    el.dutyUploadPreviewSample.textContent = `미리보기: ${previewItems}${result.count > 5 ? " ..." : ""}`;
    el.dutyUploadPreviewBox.hidden = false;
  } catch (err) {
    showToast(err.message || "지도 순번 파일을 읽는 중 오류가 발생했습니다.", "error");
  }
}

function renderAll() {
  renderConnectionStatus();
  renderSettingsUI();
  renderTodayDutyBadge();
  renderSummaryCounters();
  renderGateTab();
  renderAttendanceTab();
  renderRecordsTab();
}

/* ============================================================
   교문지도 핵심 액션 (출석 / 지각 / 생활규정 지도)
   ============================================================ */

async function togglePresent(studentId) {
  const stu = state.studentsMap[studentId];
  if (!stu) return;

  const existing = state.daily.attendance?.[studentId];
  if (existing) {
    await db.setAttendance(state.activeDate, studentId, null);
    showToast(`${stu.name} 등교 체크가 취소되었습니다.`);
  } else {
    const time = getCurrentTimeString();
    await db.setAttendance(state.activeDate, studentId, {
      status: "present",
      late: false,
      time,
      timestamp: Date.now(),
      teacher: state.teacherName
    });
    showToast(`${stu.name} 등교 완료 (${time})`, "success");
  }
}

async function markLateQuick(studentId) {
  const stu = state.studentsMap[studentId];
  if (!stu) return;

  const time = getCurrentTimeString();
  const timestamp = Date.now();

  await db.setAttendance(state.activeDate, studentId, {
    status: "late",
    late: true,
    time,
    timestamp,
    teacher: state.teacherName
  });

  await db.addRecord(state.activeDate, {
    studentId: stu.id,
    studentName: stu.name,
    grade: stu.grade,
    classNum: stu.classNum,
    number: stu.number,
    type: "late",
    includeLate: true,
    items: [],
    memo: "",
    time,
    timestamp,
    teacher: state.teacherName
  });

  showToast(`${stu.name} 지각 처리됨 (${time})`, "error");
}

function syncModalLateCardUI() {
  if (!el.modalIncludeLateCard) return;
  el.modalIncludeLateCard.classList.toggle("is-checked", Boolean(el.modalIncludeLate.checked));
}

function openGuidanceModal(studentId) {
  const stu = state.studentsMap[studentId];
  if (!stu) return;

  state.modalStudentId = studentId;
  el.guidanceModalForm.reset();
  el.guidanceModalStudent.textContent = `${formatStudentId(stu)} ${stu.name} (${stu.grade}학년 ${stu.classNum}반 ${stu.number}번)`;
  el.modalIncludeLate.defaultChecked = false;
  el.modalIncludeLate.checked = false;
  el.modalIncludeLate.removeAttribute("checked");
  syncModalLateCardUI();
  el.modalGuidanceMemo.value = "";

  const items = state.settings.guidanceItems || [];
  el.modalGuidanceChips.innerHTML = items
    .map(
      (item) => `<button type="button" class="select-chip" data-select-item="${escapeHtml(item)}" aria-pressed="false">${escapeHtml(item)}</button>`
    )
    .join("");

  el.guidanceModal.showModal();
}

async function submitGuidanceModal(e) {
  e.preventDefault();
  const stu = state.studentsMap[state.modalStudentId];
  if (!stu) return;

  const selectedItems = [...el.modalGuidanceChips.querySelectorAll(".select-chip.selected")].map(
    (btn) => btn.dataset.selectItem
  );
  const includeLate = el.modalIncludeLate.checked;
  const memo = el.modalGuidanceMemo.value.trim();

  if (!includeLate && selectedItems.length === 0 && !memo) {
    showToast("지각 또는 지도 항목을 1개 이상 선택해 주세요.", "error");
    return;
  }

  const time = getCurrentTimeString();
  const timestamp = Date.now();

  const existingAtt = state.daily.attendance?.[stu.id];
  if (includeLate) {
    await db.setAttendance(state.activeDate, stu.id, {
      status: "late",
      late: true,
      time,
      timestamp,
      teacher: state.teacherName
    });
  } else if (!existingAtt) {
    await db.setAttendance(state.activeDate, stu.id, {
      status: "present",
      late: false,
      time,
      timestamp,
      teacher: state.teacherName
    });
  }

  await db.addRecord(state.activeDate, {
    studentId: stu.id,
    studentName: stu.name,
    grade: stu.grade,
    classNum: stu.classNum,
    number: stu.number,
    type: selectedItems.length > 0 ? "guidance" : "late",
    includeLate,
    items: selectedItems,
    memo,
    time,
    timestamp,
    teacher: state.teacherName
  });

  el.guidanceModal.close();
  showToast(`${stu.name} 지도 기록이 실시간 저장되었습니다.`, "success");
}

/* ============================================================
   탭 전환 & 이벤트 바인딩
   ============================================================ */

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const isTarget = panel.id === `tab-${tabName}`;
    panel.hidden = !isTarget;
    panel.classList.toggle("active", isTarget);
  });
  document.querySelectorAll(".bottom-nav .nav-item").forEach((btn) => {
    const isTarget = btn.dataset.tab === tabName;
    btn.classList.toggle("active", isTarget);
    if (isTarget) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });

  if (tabName === "records") {
    refreshRepeatStudentsData(true);
  }
}

function setupDialogLightDismiss(dialog) {
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
}

async function applyRepeatThresholdDays(days) {
  const num = parseInt(days, 10);
  if (Number.isNaN(num) || num < 1 || num > 365) {
    showToast("반복 기준 일수는 1~365 사이의 숫자로 입력해 주세요.", "error");
    return;
  }
  state.settings.repeatThresholdDays = num;
  renderRepeatStudents();
  try {
    await db.updateSettings({ repeatThresholdDays: num });
    showToast(`반복 기준이 '${num}일 이상'으로 저장되었습니다.`, "success");
  } catch (err) {
    console.error(err);
    showToast("기준 일수 저장 중 오류가 발생했습니다.", "error");
  }
}

async function applyRepeatPeriod(periodValue) {
  const period = periodValue === "all" ? "all" : parseInt(periodValue, 10);
  state.settings.repeatPeriodDays = period;
  try {
    await db.updateSettings({ repeatPeriodDays: period });
  } catch (err) {
    console.error(err);
  }
  await refreshRepeatStudentsData(true);
}

function bindEvents() {
  document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.closeDialog)?.close();
    });
  });
  setupDialogLightDismiss(el.guidanceModal);
  setupDialogLightDismiss(el.setupGuideModal);
  setupDialogLightDismiss(el.dutyScheduleModal);

  // 지도 순번 달력 모달 열기 & 월 이동 & 날짜 편집 & 엑셀 업로드
  el.openDutyScheduleBtn.addEventListener("click", openDutyScheduleModal);
  el.todayDutyTeachers.addEventListener("click", openDutyScheduleModal);
  el.todayDutyTeachers.style.cursor = "pointer";

  el.calPrevMonthBtn.addEventListener("click", () => {
    state.calendarMonth -= 1;
    if (state.calendarMonth < 1) {
      state.calendarMonth = 12;
      state.calendarYear -= 1;
    }
    renderDutyCalendar();
  });

  el.calNextMonthBtn.addEventListener("click", () => {
    state.calendarMonth += 1;
    if (state.calendarMonth > 12) {
      state.calendarMonth = 1;
      state.calendarYear += 1;
    }
    renderDutyCalendar();
  });

  el.calTodayBtn.addEventListener("click", () => {
    const today = getTodayDateString();
    const [y, m] = today.split("-").map(Number);
    state.calendarYear = y;
    state.calendarMonth = m;
    state.selectedDutyDate = today;
    renderDutyCalendar();
  });

  el.dutyCalendarGrid.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-cal-date]");
    if (!cell) return;
    const picked = cell.dataset.calDate;
    const [y, m] = picked.split("-").map(Number);
    state.selectedDutyDate = picked;
    if (y !== state.calendarYear || m !== state.calendarMonth) {
      state.calendarYear = y;
      state.calendarMonth = m;
    }
    renderDutyCalendar();
    el.dutyEditTeachersInput.focus();
  });

  el.dutyDayEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dateStr = state.selectedDutyDate;
    const raw = el.dutyEditTeachersInput.value.trim();
    const teachers = raw
      .split(/[,/·|\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await db.setDutyForDate(dateStr, teachers);
      showToast(
        teachers.length > 0
          ? `${dateStr} 담당 선생님이 저장되었습니다.`
          : `${dateStr} 담당 선생님이 비워졌습니다.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      showToast("지도 순번 저장 중 오류가 발생했습니다.", "error");
    }
  });

  el.dutyEditClearBtn.addEventListener("click", async () => {
    const dateStr = state.selectedDutyDate;
    try {
      await db.setDutyForDate(dateStr, []);
      showToast(`${dateStr} 담당 선생님이 비워졌습니다.`);
    } catch (err) {
      console.error(err);
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  });

  el.downloadSampleDutyBtn.addEventListener("click", () => {
    downloadSampleDutyCsv(state.calendarYear, state.calendarMonth);
    showToast("지도 순번 샘플 CSV 양식이 다운로드되었습니다.");
  });

  el.clearDutyScheduleBtn.addEventListener("click", async () => {
    if (Object.keys(state.dutySchedule || {}).length === 0) return;
    if (!confirm("등록된 모든 날짜의 지도 순번을 삭제하시겠습니까?")) return;
    await db.clearDutySchedule();
    showToast("전체 지도 순번이 삭제되었습니다.");
  });

  el.dutyDropzone.addEventListener("click", () => el.dutyFileInput.click());
  el.dutyDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.dutyDropzone.classList.add("dragover");
  });
  el.dutyDropzone.addEventListener("dragleave", () => {
    el.dutyDropzone.classList.remove("dragover");
  });
  el.dutyDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    el.dutyDropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleDutyFileSelected(file);
  });
  el.dutyFileInput.addEventListener("change", () => {
    const file = el.dutyFileInput.files?.[0];
    if (file) handleDutyFileSelected(file);
    el.dutyFileInput.value = "";
  });

  el.confirmDutyUploadBtn.addEventListener("click", async () => {
    if (!state.pendingDutyUpload) return;
    const mode = document.querySelector('input[name="dutyImportMode"]:checked')?.value || "merge";
    try {
      await db.saveDutySchedule(state.pendingDutyUpload.scheduleMap, mode);
      const firstDate = state.pendingDutyUpload.firstDate;
      if (firstDate) {
        const [y, m] = firstDate.split("-").map(Number);
        state.calendarYear = y;
        state.calendarMonth = m;
        state.selectedDutyDate = firstDate;
      }
      showToast(`${state.pendingDutyUpload.count}일치 지도 순번이 실시간 반영되었습니다!`, "success");
      state.pendingDutyUpload = null;
      el.dutyUploadPreviewBox.hidden = true;
      renderDutyCalendar();
    } catch (err) {
      console.error(err);
      showToast("지도 순번 저장 중 오류가 발생했습니다.", "error");
    }
  });

  el.cancelDutyUploadBtn.addEventListener("click", () => {
    state.pendingDutyUpload = null;
    el.dutyUploadPreviewBox.hidden = true;
  });

  const openGuide = () => el.setupGuideModal.showModal();
  el.openSetupGuideBtn.addEventListener("click", openGuide);
  el.demoGuideBtn.addEventListener("click", openGuide);
  el.syncStatusBtn.addEventListener("click", openGuide);

  el.recentTeachers.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-recent-teacher]");
    if (!btn) return;
    el.teacherNameInput.value = btn.dataset.recentTeacher;
    el.pinInput.focus();
  });

  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const teacherName = el.teacherNameInput.value.trim();
    const pin = el.pinInput.value.trim();

    if (!teacherName) {
      el.loginError.textContent = "담당 교사 성함을 입력해 주세요.";
      el.loginError.hidden = false;
      el.teacherNameInput.focus();
      return;
    }

    const valid = await db.verifyPin(pin, state.settings);
    if (!valid) {
      el.loginError.textContent = "접속 PIN이 일치하지 않습니다. 다시 확인해 주세요.";
      el.loginError.hidden = false;
      el.pinInput.select();
      return;
    }

    el.loginError.hidden = true;
    saveSession(teacherName, el.rememberLogin.checked);
    enterApp(teacherName);
    showToast(`${teacherName} 선생님, 환영합니다!`, "success");
  });

  el.logoutBtn.addEventListener("click", () => {
    if (confirm("교사를 전환하거나 로그아웃하시겠습니까?")) {
      exitApp();
    }
  });

  el.activeDateInput.value = state.activeDate;
  el.activeDateInput.addEventListener("change", () => {
    const nextDate = el.activeDateInput.value || getTodayDateString();
    state.activeDate = nextDate;
    db.subscribeDate(nextDate);
    renderTodayDutyBadge();
    refreshRepeatStudentsData(true);
    showToast(`${nextDate} 기록을 불러왔습니다.`);
  });

  document.querySelectorAll(".bottom-nav .nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // 탭 1: 검색 입력
  el.gateSearchInput.addEventListener("input", () => {
    state.gateSearch = el.gateSearchInput.value;
    el.gateSearchClear.hidden = !state.gateSearch;
    renderGateTab();
  });

  el.gateSearchClear.addEventListener("click", () => {
    state.gateSearch = "";
    el.gateSearchInput.value = "";
    el.gateSearchClear.hidden = true;
    el.gateSearchInput.focus();
    renderGateTab();
  });

  el.gateGradeFilters.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-gate-grade]");
    if (!btn) return;
    state.gateGradeFilter = btn.dataset.gateGrade;
    renderGateTab();
  });

  const handleStudentAction = async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    try {
      if (action === "present") await togglePresent(id);
      else if (action === "late") await markLateQuick(id);
      else if (action === "guide") openGuidanceModal(id);
    } catch (err) {
      console.error(err);
      showToast("저장 중 오류가 발생했습니다. 네트워크나 Firebase 규칙을 확인해 주세요.", "error");
    }
  };
  el.gateStudentList.addEventListener("click", handleStudentAction);
  el.attendanceGrid.addEventListener("click", handleStudentAction);

  const handleDeleteRecord = async (e) => {
    const btn = e.target.closest("[data-delete-record]");
    if (!btn) return;
    const recordId = btn.dataset.deleteRecord;
    if (!confirm("이 지도 기록을 삭제(취소)하시겠습니까?")) return;
    await db.deleteRecord(state.activeDate, recordId);
    showToast("기록이 삭제되었습니다.");
  };
  el.liveFeedList.addEventListener("click", handleDeleteRecord);
  el.recordsTableBody.addEventListener("click", handleDeleteRecord);

  el.modalGuidanceChips.addEventListener("click", (e) => {
    const btn = e.target.closest(".select-chip");
    if (!btn) return;
    const next = !btn.classList.contains("selected");
    btn.classList.toggle("selected", next);
    btn.setAttribute("aria-pressed", String(next));
  });
  el.modalIncludeLate.addEventListener("change", syncModalLateCardUI);
  el.guidanceModalForm.addEventListener("submit", submitGuidanceModal);

  // 탭 2: 출석 필터
  el.attGradeChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-att-grade]");
    if (!btn) return;
    state.attGradeFilter = btn.dataset.attGrade;
    state.attClassFilter = "all";
    renderAttendanceTab();
  });

  el.attClassChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-att-class]");
    if (!btn) return;
    state.attClassFilter = btn.dataset.attClass;
    renderAttendanceTab();
  });

  document.querySelectorAll("[data-att-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.attStatusFilter = btn.dataset.attStatus;
      document.querySelectorAll("[data-att-status]").forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
      renderAttendanceTab();
    });
  });

  el.copyAbsentBtn.addEventListener("click", async () => {
    const attendance = state.daily.attendance || {};
    const absent = state.studentsList.filter((s) => {
      if (state.attGradeFilter !== "all" && String(s.grade) !== String(state.attGradeFilter)) return false;
      if (state.attClassFilter !== "all" && String(s.classNum) !== String(state.attClassFilter)) return false;
      return !attendance[s.id];
    });

    if (absent.length === 0) {
      showToast("미등교 학생이 없습니다! 전원 등교 완료 🎉", "success");
      return;
    }

    const lines = [
      `[${state.activeDate} 미등교 현황 (${absent.length}명)]`,
      ...absent.map((s) => `- ${formatStudentId(s)} ${s.name} (${s.grade}학년 ${s.classNum}반)`)
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast(`미등교 학생 ${absent.length}명 명단이 복사되었습니다.`, "success");
    } catch {
      prompt("아래 미등교 명단을 복사하세요:", text);
    }
  });

  el.markClassPresentBtn.addEventListener("click", async () => {
    if (state.attGradeFilter === "all" || state.attClassFilter === "all") {
      showToast("먼저 학년과 반을 선택해 주세요.", "error");
      return;
    }
    const targets = state.studentsList.filter(
      (s) =>
        String(s.grade) === String(state.attGradeFilter) &&
        String(s.classNum) === String(state.attClassFilter) &&
        !state.daily.attendance?.[s.id]
    );
    if (targets.length === 0) {
      showToast("이미 해당 반 전원 등교 처리되어 있습니다.");
      return;
    }
    if (!confirm(`${state.attGradeFilter}학년 ${state.attClassFilter}반 미등교 학생 ${targets.length}명을 모두 등교 처리할까요?`)) {
      return;
    }
    const time = getCurrentTimeString();
    const timestamp = Date.now();
    const bulk = {};
    for (const s of targets) {
      bulk[s.id] = {
        status: "present",
        late: false,
        time,
        timestamp,
        teacher: state.teacherName
      };
    }
    await db.bulkSetAttendance(state.activeDate, bulk);
    showToast(`${targets.length}명 일괄 등교 처리 완료!`, "success");
  });

  // 탭 3: 반복 체크 학생 컨트롤 (기준 일수 / 기간 / 유형 / 복사 / CSV)
  el.repeatThresholdButtons.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-repeat-days]");
    if (!btn) return;
    applyRepeatThresholdDays(btn.dataset.repeatDays);
  });

  el.repeatCustomDaysForm.addEventListener("submit", (e) => {
    e.preventDefault();
    applyRepeatThresholdDays(el.repeatCustomDaysInput.value);
  });

  el.repeatPeriodButtons.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-repeat-period]");
    if (!btn) return;
    applyRepeatPeriod(btn.dataset.repeatPeriod);
  });

  el.repeatCategoryButtons.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-repeat-category]");
    if (!btn) return;
    state.repeatCategory = btn.dataset.repeatCategory;
    renderRepeatStudents();
  });

  el.copyRepeatBtn.addEventListener("click", async () => {
    const list = computeRepeatStudents();
    const threshold = Number(state.settings.repeatThresholdDays) || 3;
    const period = formatPeriodLabel(state.settings.repeatPeriodDays ?? 30);

    if (list.length === 0) {
      showToast("복사할 반복 체크 대상 학생이 없습니다.", "error");
      return;
    }

    const lines = [
      `[반복 체크 학생 현황 - ${period} / ${threshold}일 이상 (${list.length}명)]`,
      ...list.map((s) => {
        const itemsText = s.topItems.map(([k, v]) => `${k} ${v}회`).join(", ");
        return `- ${s.studentId} ${s.studentName}: 총 ${s.daysCount}일 (지각 ${s.lateDays}일, 생활지도 ${s.guidanceDays}일${itemsText ? ` · ${itemsText}` : ""})`;
      })
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast(`반복 체크 학생 ${list.length}명 명단이 복사되었습니다.`, "success");
    } catch {
      prompt("아래 명단을 복사하세요:", text);
    }
  });

  el.exportRepeatCsvBtn.addEventListener("click", () => {
    const list = computeRepeatStudents();
    const threshold = Number(state.settings.repeatThresholdDays) || 3;
    const period = formatPeriodLabel(state.settings.repeatPeriodDays ?? 30);

    if (list.length === 0) {
      showToast("내보낼 반복 체크 대상 학생이 없습니다.", "error");
      return;
    }

    const rows = list.map((s) => [
      period,
      `${threshold}일 이상`,
      s.studentId,
      s.grade,
      s.classNum,
      s.number,
      s.studentName,
      s.daysCount,
      s.lateDays,
      s.guidanceDays,
      s.topItems.map(([k, v]) => `${k}(${v})`).join(" / "),
      s.dates.join(", ")
    ]);

    downloadCsv(
      `반복체크학생_${state.activeDate}_${threshold}일이상.csv`,
      ["집계기간", "반복기준", "학번", "학년", "반", "번호", "이름", "누적일수", "지각일수", "생활지도일수", "주요지도항목", "체크날짜목록"],
      rows
    );
    showToast("반복 체크 학생 CSV 파일이 다운로드되었습니다.", "success");
  });

  // 탭 3: 상세 기록 필터 & CSV 다운로드
  el.recordTypeFilter.addEventListener("change", () => {
    state.recordTypeFilter = el.recordTypeFilter.value;
    renderRecordsTab();
  });

  el.recordSearchInput.addEventListener("input", () => {
    state.recordSearch = el.recordSearchInput.value;
    renderRecordsTab();
  });

  el.exportRecordsCsvBtn.addEventListener("click", () => {
    const records = getSortedRecords();
    if (records.length === 0) {
      showToast("내보낼 지도 기록이 없습니다.", "error");
      return;
    }
    const rows = records.map((r) => [
      state.activeDate,
      r.time || "",
      formatStudentId(r),
      r.grade,
      r.classNum,
      r.number,
      r.studentName,
      r.type === "late" || r.includeLate ? "지각" : "",
      (r.items || []).join(" / "),
      r.memo || "",
      r.teacher || ""
    ]);
    downloadCsv(
      `교문지도기록_${state.activeDate}.csv`,
      ["날짜", "시각", "학번", "학년", "반", "번호", "이름", "지각여부", "지도항목", "메모", "담당교사"],
      rows
    );
    showToast("지도 기록 CSV 파일이 다운로드되었습니다.", "success");
  });

  el.exportAttendanceCsvBtn.addEventListener("click", () => {
    if (state.studentsList.length === 0) {
      showToast("등록된 학생 명단이 없습니다.", "error");
      return;
    }
    const attendance = state.daily.attendance || {};
    const rows = state.studentsList.map((s) => {
      const att = attendance[s.id];
      const status = att ? (att.late || att.status === "late" ? "지각" : "등교") : "미등교";
      return [
        state.activeDate,
        formatStudentId(s),
        s.grade,
        s.classNum,
        s.number,
        s.name,
        status,
        att?.time || "",
        att?.teacher || ""
      ];
    });
    downloadCsv(
      `등교출석현황_${state.activeDate}.csv`,
      ["날짜", "학번", "학년", "반", "번호", "이름", "출석상태", "확인시각", "확인교사"],
      rows
    );
    showToast("출석 현황 CSV 파일이 다운로드되었습니다.", "success");
  });

  // 탭 4: 샘플 불러오기 & 명단 업로드
  const loadSampleStudents = async () => {
    const sample = getSampleStudentsMap();
    await db.saveStudents(sample, "replace");
    showToast("샘플 학생 명단 30명이 등록되었습니다!", "success");
  };
  el.quickLoadSampleBtn.addEventListener("click", loadSampleStudents);
  el.loadSampleRosterBtn.addEventListener("click", async () => {
    if (state.studentsList.length > 0 && !confirm("기존 학생 명단을 샘플 30명으로 교체할까요?")) return;
    await loadSampleStudents();
  });
  el.goRosterTabBtn.addEventListener("click", () => switchTab("settings"));
  el.downloadSampleCsvBtn.addEventListener("click", () => {
    downloadSampleRosterCsv();
    showToast("샘플 CSV 양식이 다운로드되었습니다.");
  });

  el.rosterDropzone.addEventListener("click", () => el.rosterFileInput.click());
  el.rosterDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.rosterDropzone.classList.add("dragover");
  });
  el.rosterDropzone.addEventListener("dragleave", () => {
    el.rosterDropzone.classList.remove("dragover");
  });
  el.rosterDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    el.rosterDropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleRosterFileSelected(file);
  });
  el.rosterFileInput.addEventListener("change", () => {
    const file = el.rosterFileInput.files?.[0];
    if (file) handleRosterFileSelected(file);
    el.rosterFileInput.value = "";
  });

  el.confirmUploadBtn.addEventListener("click", async () => {
    if (!state.pendingUpload) return;
    const mode = document.querySelector('input[name="importMode"]:checked')?.value || "replace";
    await db.saveStudents(state.pendingUpload.studentMap, mode);
    showToast(`${state.pendingUpload.count}명의 학생 명단이 동기화되었습니다!`, "success");
    state.pendingUpload = null;
    el.uploadPreviewBox.hidden = true;
  });

  el.cancelUploadBtn.addEventListener("click", () => {
    state.pendingUpload = null;
    el.uploadPreviewBox.hidden = true;
  });

  el.clearRosterBtn.addEventListener("click", async () => {
    if (state.studentsList.length === 0) return;
    if (!confirm("등록된 전체 학생 명단을 정말 삭제하시겠습니까?")) return;
    await db.clearStudents();
    showToast("학생 명단이 삭제되었습니다.");
  });

  el.addStudentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rawId = el.newStudentId.value.trim().replace(/[.#$[\]/\s]/g, "");
    const name = el.newStudentName.value.trim();
    if (!rawId || !name) return;

    const parsed = parseStudentId(rawId);
    const normalizedId = buildStudentId(parsed.grade, parsed.classNum, parsed.number) || rawId;
    await db.upsertStudent({
      id: normalizedId,
      grade: parsed.grade,
      classNum: parsed.classNum,
      number: parsed.number,
      name
    });
    el.newStudentId.value = "";
    el.newStudentName.value = "";
    showToast(`${normalizedId} ${name} 학생이 추가되었습니다.`, "success");
  });

  el.uploadLogoBtn.addEventListener("click", () => el.settingLogoInput.click());

  el.settingLogoInput.addEventListener("change", async () => {
    const file = el.settingLogoInput.files?.[0];
    el.settingLogoInput.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일(.png, .jpg, .webp 등)만 업로드할 수 있습니다.", "error");
      return;
    }
    try {
      const dataUrl = await resizeLogoImageToDataUrl(file, 240);
      await db.updateSettings({ schoolLogo: dataUrl });
      showToast("학교 로고가 로그인 화면에 실시간 반영되었습니다!", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "로고 업로드 중 오류가 발생했습니다.", "error");
    }
  });

  el.removeLogoBtn.addEventListener("click", async () => {
    if (!state.settings.schoolLogo) {
      showToast("초기화할 등록 로고가 없습니다.");
      return;
    }
    if (!confirm("등록된 학교 로고를 초기화할까요?")) return;
    await db.updateSettings({ schoolLogo: "" });
    showToast("학교 로고가 초기화되었습니다.");
  });

  el.schoolSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const schoolName = el.settingSchoolName.value.trim();
    const lateTime = el.settingLateTime.value;
    const newPin = el.settingNewPin.value.trim();

    const patch = { schoolName, lateTime };
    if (newPin) {
      if (newPin.length < 4) {
        showToast("접속 PIN은 4자리 이상으로 입력해 주세요.", "error");
        return;
      }
      patch.pinHash = await hashPin(newPin);
    }

    await db.updateSettings(patch);
    el.settingNewPin.value = "";
    showToast("학교 설정이 실시간으로 반영되었습니다.", "success");
  });

  el.addGuidanceItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const label = el.newItemLabel.value.trim();
    if (!label) return;
    const current = state.settings.guidanceItems || [];
    if (current.includes(label)) {
      showToast("이미 등록된 지도 항목입니다.", "error");
      return;
    }
    await db.updateSettings({ guidanceItems: [...current, label] });
    el.newItemLabel.value = "";
    showToast(`'${label}' 항목이 추가되었습니다.`, "success");
  });

  el.settingsGuidanceItems.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-remove-item-idx]");
    if (!btn) return;
    const idx = Number(btn.dataset.removeItemIdx);
    const next = (state.settings.guidanceItems || []).filter((_, i) => i !== idx);
    if (next.length === 0) {
      showToast("최소 1개 이상의 지도 항목이 필요합니다.", "error");
      return;
    }
    await db.updateSettings({ guidanceItems: next });
    showToast("지도 항목이 삭제되었습니다.");
  });
}

async function handleRosterFileSelected(file) {
  try {
    const result = await parseRosterFile(file);
    state.pendingUpload = result;
    el.uploadPreviewSummary.textContent = `${result.count}명 인식됨${result.skipped ? ` (제외 ${result.skipped}행)` : ""}`;
    const previewItems = Object.values(result.studentMap)
      .slice(0, 6)
      .map((s) => `${s.id} ${s.name}`)
      .join(", ");
    el.uploadPreviewSample.textContent = `미리보기: ${previewItems}${result.count > 6 ? " ..." : ""}`;
    el.uploadPreviewBox.hidden = false;
  } catch (err) {
    showToast(err.message || "파일을 읽는 중 오류가 발생했습니다.", "error");
  }
}

/* ============================================================
   앱 초기화
   ============================================================ */

async function bootstrap() {
  renderRecentTeachers();
  bindEvents();

  db.on("connection", (info) => {
    state.connection = info;
    renderConnectionStatus();
  });

  db.on("settings", (settings) => {
    const prevPeriod = state.settings.repeatPeriodDays;
    state.settings = settings;
    renderSettingsUI();
    if (prevPeriod !== settings.repeatPeriodDays) {
      refreshRepeatStudentsData(true);
    } else {
      renderRepeatStudents();
    }
  });

  db.on("students", (studentsMap) => {
    state.studentsMap = studentsMap || {};
    state.studentsList = sortStudents(state.studentsMap);
    renderSummaryCounters();
    renderGateTab();
    renderAttendanceTab();
    renderRecordsTab();
  });

  db.on("daily", (dailyData) => {
    state.daily = dailyData || { attendance: {}, records: {} };
    state.rangeDailyMap[state.activeDate] = state.daily;
    renderSummaryCounters();
    renderGateTab();
    renderAttendanceTab();
    renderRecordsTab();
  });

  db.on("dutySchedule", (scheduleMap) => {
    state.dutySchedule = scheduleMap || {};
    renderTodayDutyBadge();
    if (el.dutyScheduleModal.open) {
      renderDutyCalendar();
    }
  });

  await db.init();
  db.subscribeDate(state.activeDate);

  updateClock();
  setInterval(updateClock, 1000);

  const saved = loadSavedSession();
  if (saved) {
    enterApp(saved.teacherName);
  }
}

bootstrap();
