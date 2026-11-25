/**
 * ============================================================
 * 실시간 데이터 계층 (Firebase Realtime Database + 로컬 데모 폴백)
 * ============================================================
 * - FIREBASE_CONFIG가 설정되어 있으면 Firebase Realtime Database로 실시간 동기화
 * - 미설정 상태이면 localStorage + 브라우저 탭 간 storage 이벤트로 즉시 체험 가능
 * - 기간별(최근 N일 / 전체 기간) 누적 조회 지원 (반복 체크 학생 집계용)
 */

import { FIREBASE_CONFIG, DEFAULT_SETTINGS, isFirebaseConfigured } from "./firebase-config.js";

const FIREBASE_SDK_VERSION = "11.0.2";
const LOCAL_STORAGE_KEY = "gate_guidance_local_db_v1";

/**
 * 간단한 해시 함수 (HTTPS 환경에서는 SHA-256, 비보안 컨텍스트에서도 안전하게 폴백)
 */
export async function hashPin(pin) {
  const text = `gate-pin:${String(pin).trim()}`;
  if (window.crypto && window.crypto.subtle) {
    const bytes = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `fb-${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * YYYY-MM-DD 문자열에서 N일 전 날짜 문자열 계산
 */
function subtractDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function createEmptyLocalStore() {
  return {
    settings: {
      schoolName: DEFAULT_SETTINGS.schoolName,
      lateTime: DEFAULT_SETTINGS.lateTime,
      pinHash: null,
      guidanceItems: [...DEFAULT_SETTINGS.guidanceItems],
      repeatThresholdDays: 3,
      repeatPeriodDays: 30
    },
    students: {},
    daily: {}
  };
}

function readLocalStore() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return createEmptyLocalStore();
    const parsed = JSON.parse(raw);
    return {
      settings: {
        ...createEmptyLocalStore().settings,
        ...(parsed.settings || {})
      },
      students: parsed.students || {},
      daily: parsed.daily || {}
    };
  } catch {
    return createEmptyLocalStore();
  }
}

function writeLocalStore(data) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

function normalizeSettings(raw) {
  const base = {
    schoolName: DEFAULT_SETTINGS.schoolName,
    lateTime: DEFAULT_SETTINGS.lateTime,
    pinHash: null,
    guidanceItems: [...DEFAULT_SETTINGS.guidanceItems],
    repeatThresholdDays: 3,
    repeatPeriodDays: 30
  };
  if (!raw) return base;

  const threshold = Number(raw.repeatThresholdDays);
  const period = raw.repeatPeriodDays === "all" ? "all" : Number(raw.repeatPeriodDays);

  return {
    schoolName: raw.schoolName || base.schoolName,
    lateTime: raw.lateTime || base.lateTime,
    pinHash: raw.pinHash || null,
    guidanceItems:
      Array.isArray(raw.guidanceItems) && raw.guidanceItems.length > 0
        ? raw.guidanceItems
        : base.guidanceItems,
    repeatThresholdDays:
      Number.isInteger(threshold) && threshold >= 1 && threshold <= 365
        ? threshold
        : base.repeatThresholdDays,
    repeatPeriodDays:
      period === "all" || (Number.isInteger(period) && period >= 1 && period <= 365)
        ? period
        : base.repeatPeriodDays
  };
}

export class GateDatabase {
  constructor() {
    this.mode = "demo";
    this.connected = false;
    this.db = null;
    this.fbMod = null;
    this.currentDate = null;

    this._listeners = {
      connection: new Set(),
      settings: new Set(),
      students: new Set(),
      daily: new Set()
    };

    this._unsubDaily = null;
  }

  on(event, callback) {
    this._listeners[event]?.add(callback);
    return () => this._listeners[event]?.delete(callback);
  }

  _emit(event, payload) {
    this._listeners[event]?.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[GateDatabase] listener error (${event}):`, err);
      }
    });
  }

  async init() {
    if (!isFirebaseConfigured()) {
      this._initLocalDemo();
      return { mode: "demo" };
    }

    try {
      const [appMod, dbMod, authMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`)
      ]);

      const app = appMod.initializeApp(FIREBASE_CONFIG);
      this.db = dbMod.getDatabase(app);
      this.fbMod = dbMod;
      this.mode = "firebase";

      try {
        const auth = authMod.getAuth(app);
        await authMod.signInAnonymously(auth);
      } catch (authErr) {
        console.info("[Firebase] 익명 인증 미사용 또는 미활성화 상태로 계속 진행합니다:", authErr?.code || authErr);
      }

      const connRef = dbMod.ref(this.db, ".info/connected");
      dbMod.onValue(connRef, (snap) => {
        this.connected = Boolean(snap.val());
        this._emit("connection", { mode: "firebase", connected: this.connected });
      });

      dbMod.onValue(dbMod.ref(this.db, "settings"), (snap) => {
        this._emit("settings", normalizeSettings(snap.val()));
      });

      dbMod.onValue(dbMod.ref(this.db, "students"), (snap) => {
        this._emit("students", snap.val() || {});
      });

      return { mode: "firebase" };
    } catch (err) {
      console.error("[Firebase] 초기화 실패 — 로컬 체험 모드로 전환합니다:", err);
      this._initLocalDemo(err?.message);
      return { mode: "demo", error: err?.message };
    }
  }

  _initLocalDemo(errorMsg = null) {
    this.mode = "demo";
    this.connected = false;
    this._emit("connection", { mode: "demo", connected: false, error: errorMsg });

    const store = readLocalStore();
    this._emit("settings", normalizeSettings(store.settings));
    this._emit("students", store.students || {});

    window.addEventListener("storage", (e) => {
      if (e.key !== LOCAL_STORAGE_KEY) return;
      const updated = readLocalStore();
      this._emit("settings", normalizeSettings(updated.settings));
      this._emit("students", updated.students || {});
      if (this.currentDate) {
        this._emit("daily", updated.daily[this.currentDate] || { attendance: {}, records: {} });
      }
    });
  }

  subscribeDate(dateStr) {
    this.currentDate = dateStr;

    if (this._unsubDaily) {
      this._unsubDaily();
      this._unsubDaily = null;
    }

    if (this.mode === "firebase" && this.db && this.fbMod) {
      const dailyRef = this.fbMod.ref(this.db, `daily/${dateStr}`);
      this._unsubDaily = this.fbMod.onValue(dailyRef, (snap) => {
        const val = snap.val() || {};
        this._emit("daily", {
          attendance: val.attendance || {},
          records: val.records || {}
        });
      });
    } else {
      const store = readLocalStore();
      const val = store.daily[dateStr] || {};
      this._emit("daily", {
        attendance: val.attendance || {},
        records: val.records || {}
      });
    }
  }

  /**
   * 기간별 일자 데이터 일괄 조회 (반복 체크 학생 통계용)
   * @param {string} endDateStr 기준 종료일 (YYYY-MM-DD)
   * @param {number|"all"} periodDays 최근 며칠(예: 7, 14, 30) 또는 "all"
   */
  async fetchDailyRange(endDateStr, periodDays = 30) {
    const isAll = periodDays === "all" || !Number.isFinite(Number(periodDays));
    const startDateStr = isAll ? null : subtractDays(endDateStr, Math.max(1, Number(periodDays)) - 1);

    if (this.mode === "firebase" && this.db && this.fbMod) {
      const dailyRoot = this.fbMod.ref(this.db, "daily");
      const targetQuery = isAll
        ? dailyRoot
        : this.fbMod.query(
            dailyRoot,
            this.fbMod.orderByKey(),
            this.fbMod.startAt(startDateStr),
            this.fbMod.endAt(endDateStr)
          );
      const snap = await this.fbMod.get(targetQuery);
      return snap.val() || {};
    }

    const store = readLocalStore();
    const result = {};
    for (const [dateKey, val] of Object.entries(store.daily || {})) {
      if (isAll || (dateKey >= startDateStr && dateKey <= endDateStr)) {
        result[dateKey] = val || { attendance: {}, records: {} };
      }
    }
    return result;
  }

  async verifyPin(inputPin, currentSettings) {
    const clean = String(inputPin || "").trim();
    if (!clean) return false;

    const inputHash = await hashPin(clean);
    if (currentSettings && currentSettings.pinHash) {
      return inputHash === currentSettings.pinHash;
    }
    return clean === DEFAULT_SETTINGS.defaultPin;
  }

  async updateSettings(partial) {
    if (this.mode === "firebase" && this.db && this.fbMod) {
      await this.fbMod.update(this.fbMod.ref(this.db, "settings"), partial);
      return;
    }
    const store = readLocalStore();
    store.settings = { ...store.settings, ...partial };
    writeLocalStore(store);
    this._emit("settings", normalizeSettings(store.settings));
  }

  async saveStudents(studentMap, mode = "replace") {
    if (this.mode === "firebase" && this.db && this.fbMod) {
      const studentsRef = this.fbMod.ref(this.db, "students");
      if (mode === "replace") {
        await this.fbMod.set(studentsRef, studentMap);
      } else {
        await this.fbMod.update(studentsRef, studentMap);
      }
      return;
    }

    const store = readLocalStore();
    store.students = mode === "replace" ? { ...studentMap } : { ...store.students, ...studentMap };
    writeLocalStore(store);
    this._emit("students", store.students);
  }

  async upsertStudent(student) {
    const key = String(student.id);
    if (this.mode === "firebase" && this.db && this.fbMod) {
      await this.fbMod.set(this.fbMod.ref(this.db, `students/${key}`), student);
      return;
    }
    const store = readLocalStore();
    store.students[key] = student;
    writeLocalStore(store);
    this._emit("students", store.students);
  }

  async clearStudents() {
    if (this.mode === "firebase" && this.db && this.fbMod) {
      await this.fbMod.remove(this.fbMod.ref(this.db, "students"));
      return;
    }
    const store = readLocalStore();
    store.students = {};
    writeLocalStore(store);
    this._emit("students", {});
  }

  async setAttendance(dateStr, studentId, payload) {
    const sid = String(studentId);
    if (this.mode === "firebase" && this.db && this.fbMod) {
      const targetRef = this.fbMod.ref(this.db, `daily/${dateStr}/attendance/${sid}`);
      if (payload === null) {
        await this.fbMod.remove(targetRef);
      } else {
        await this.fbMod.set(targetRef, payload);
      }
      return;
    }

    const store = readLocalStore();
    if (!store.daily[dateStr]) store.daily[dateStr] = { attendance: {}, records: {} };
    if (payload === null) {
      delete store.daily[dateStr].attendance[sid];
    } else {
      store.daily[dateStr].attendance[sid] = payload;
    }
    writeLocalStore(store);
    if (this.currentDate === dateStr) {
      this._emit("daily", store.daily[dateStr]);
    }
  }

  async bulkSetAttendance(dateStr, attendanceMap) {
    if (this.mode === "firebase" && this.db && this.fbMod) {
      await this.fbMod.update(this.fbMod.ref(this.db, `daily/${dateStr}/attendance`), attendanceMap);
      return;
    }

    const store = readLocalStore();
    if (!store.daily[dateStr]) store.daily[dateStr] = { attendance: {}, records: {} };
    store.daily[dateStr].attendance = {
      ...store.daily[dateStr].attendance,
      ...attendanceMap
    };
    writeLocalStore(store);
    if (this.currentDate === dateStr) {
      this._emit("daily", store.daily[dateStr]);
    }
  }

  async addRecord(dateStr, record) {
    if (this.mode === "firebase" && this.db && this.fbMod) {
      const listRef = this.fbMod.ref(this.db, `daily/${dateStr}/records`);
      const newRef = this.fbMod.push(listRef);
      await this.fbMod.set(newRef, record);
      return newRef.key;
    }

    const store = readLocalStore();
    if (!store.daily[dateStr]) store.daily[dateStr] = { attendance: {}, records: {} };
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    store.daily[dateStr].records[id] = record;
    writeLocalStore(store);
    if (this.currentDate === dateStr) {
      this._emit("daily", store.daily[dateStr]);
    }
    return id;
  }

  async deleteRecord(dateStr, recordId) {
    if (this.mode === "firebase" && this.db && this.fbMod) {
      await this.fbMod.remove(this.fbMod.ref(this.db, `daily/${dateStr}/records/${recordId}`));
      return;
    }

    const store = readLocalStore();
    if (store.daily[dateStr]?.records) {
      delete store.daily[dateStr].records[recordId];
      writeLocalStore(store);
      if (this.currentDate === dateStr) {
        this._emit("daily", store.daily[dateStr]);
      }
    }
  }
}
