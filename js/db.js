/**
 * ============================================================
 * 실시간 데이터 계층 (Firebase Realtime Database + 로컬 데모 폴백)
 * ============================================================
 * - FIREBASE_CONFIG가 설정되어 있으면 Firebase Realtime Database로 실시간 동기화
 * - 미설정 상태이면 localStorage + 브라우저 탭 간 storage 이벤트로 즉시 체험 가능
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
  // Fallback FNV-1a 64-bit style hex hash for non-HTTPS local testing
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

function createEmptyLocalStore() {
  return {
    settings: {
      schoolName: DEFAULT_SETTINGS.schoolName,
      lateTime: DEFAULT_SETTINGS.lateTime,
      pinHash: null,
      guidanceItems: [...DEFAULT_SETTINGS.guidanceItems]
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
    guidanceItems: [...DEFAULT_SETTINGS.guidanceItems]
  };
  if (!raw) return base;
  return {
    schoolName: raw.schoolName || base.schoolName,
    lateTime: raw.lateTime || base.lateTime,
    pinHash: raw.pinHash || null,
    guidanceItems:
      Array.isArray(raw.guidanceItems) && raw.guidanceItems.length > 0
        ? raw.guidanceItems
        : base.guidanceItems
  };
}

/**
 * 실시간 DB 서비스 클래스
 */
export class GateDatabase {
  constructor() {
    this.mode = "demo"; // "firebase" | "demo"
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

      // 익명 인증이 켜져 있으면 자동 인증 시도 (보안 규칙 강화 시 유용)
      try {
        const auth = authMod.getAuth(app);
        await authMod.signInAnonymously(auth);
      } catch (authErr) {
        console.info("[Firebase] 익명 인증 미사용 또는 미활성화 상태로 계속 진행합니다:", authErr?.code || authErr);
      }

      // 실시간 연결 상태 감지
      const connRef = dbMod.ref(this.db, ".info/connected");
      dbMod.onValue(connRef, (snap) => {
        this.connected = Boolean(snap.val());
        this._emit("connection", { mode: "firebase", connected: this.connected });
      });

      // 설정 실시간 구독
      dbMod.onValue(dbMod.ref(this.db, "settings"), (snap) => {
        this._emit("settings", normalizeSettings(snap.val()));
      });

      // 학생 명단 실시간 구독
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

    // 같은 브라우저 내 다른 탭 변경 시 즉시 실시간 동기화
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

  /**
   * 특정 날짜(YYYY-MM-DD)의 출석 및 지도 기록 실시간 구독
   */
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
   * 교사 PIN 검증 (DB에 저장된 해시가 없으면 기본 PIN '1234' 허용)
   */
  async verifyPin(inputPin, currentSettings) {
    const clean = String(inputPin || "").trim();
    if (!clean) return false;

    const inputHash = await hashPin(clean);
    if (currentSettings && currentSettings.pinHash) {
      return inputHash === currentSettings.pinHash;
    }
    return clean === DEFAULT_SETTINGS.defaultPin;
  }

  /**
   * 학교/지각/PIN/지도항목 설정 업데이트
   */
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

  /**
   * 학생 명단 저장 (replace: 덮어쓰기, merge: 병합)
   */
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

  /**
   * 개별 학생 추가/수정
   */
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

  /**
   * 명단 전체 삭제
   */
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

  /**
   * 학생 출석 상태 설정 (present / late) 또는 해제(null)
   */
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

  /**
   * 반 전체 일괄 등교 처리
   */
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

  /**
   * 지각 또는 생활규정 지도 기록 추가
   */
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

  /**
   * 지도 기록 삭제 (실수 취소)
   */
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
