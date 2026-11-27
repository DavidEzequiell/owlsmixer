import { SKINS } from "./data/skins.js";
import {
  HALF_W, HALF_H, HALF_D, clamp,
  abletonVolToDb, dbToAbletonVol,
  volToZLog, zToVolLog,
  freqToY, yToFreq, formatFreq, getApparentVolumeLevel,
} from "./engine/psychoacoustics.js";
import { ROLES } from "./data/roles.js";

export {
  HALF_W, HALF_H, HALF_D, clamp,
  abletonVolToDb, dbToAbletonVol,
  freqToY, yToFreq, formatFreq, getApparentVolumeLevel,
};

export const panToX = (pan) => clamp(pan, -1, 1) * HALF_W;
export const xToPan = (x) => clamp(x / HALF_W, -1, 1);

// Modo Gibson: Escala Logarítmica Real en dB (-36 dB .. +6 dB)
export const volToZ = (vol) => volToZLog(vol);
export const zToVol = (z) => zToVolLog(z);

// Modo Espacial: Z = Send A Reverb (+4 seco .. -4 húmedo)
export const sendToZ = (send) => HALF_D - clamp(send, 0, 1) * (HALF_D * 2);
export const zToSend = (z) => clamp((HALF_D - z) / (HALF_D * 2), 0, 1);

export function formatVolume(v, unit = "db") {
  if (unit === "pct") return `${Math.round(clamp(v, 0, 1) * 100)}%`;
  const db = abletonVolToDb(v);
  if (!Number.isFinite(db) || db <= -69.5) return "-∞ dB";
  return `${db > 0.05 ? "+" : ""}${db.toFixed(1)} dB`;
}

export function formatPan(pan) {
  if (Math.abs(pan) < 0.01) return "C";
  return pan < 0 ? `${Math.round(-pan * 50)}L` : `${Math.round(pan * 50)}R`;
}

export const APP_VERSION = "0.0.9";

const SETTINGS_KEY = "owls3d_settings_v3";
const SESSIONS_INDEX_KEY = "owls3d_sessions_index_v1";
const SESSION_PREFIX = "owls3d_session_v1_";
const MAX_SAVED_SESSIONS = 15;

const DEFAULT_SETTINGS = {
  volUnit: "db",
  zMode: "gibson",
  showReverbCubes: true,
  showVolLevels: true,
  showFreqBands: true,
  showFloorShadows: true,
  showDropLines: true,
  showTrackIcons: true,    // Iconos de instrumento en el 3D
  showTrackNames: true,    // Nombres de pista en texto en el 3D
  autoFadeSilent: false,   // Atenuar/ocultar pistas sin señal durante Play
  presetRelativeVol: false,// Aplicar presets conservando volumen promedio actual
  colorTemplate: "art_of_mixing",
  customRoleColors: {},    // Colores personalizados por rol
  showEqTips: true,
  freqSizing: true,
  showCollisions: true,    // Detector Solar Eclipse en 3D
  lufsTarget: "indie",     // streaming | indie | heavy | acoustic
  autoSize: true,          // Crest Factor + corte <300Hz en EQ
  skin: "gibson_dark",
};

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const merged = { ...DEFAULT_SETTINGS, ...raw };
    if (!SKINS[merged.skin]) merged.skin = "gibson_dark";
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Hash FNV-1a 32-bit para huella determinista de sesión
function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function normalizeTrackSigName(name) {
  return String(name || "").trim().toLowerCase();
}

function jaccardSimilarity(listA, listB) {
  const setA = new Set(listA);
  const setB = new Set(listB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const item of setA) {
    if (setB.has(item)) inter++;
  }
  return inter / (setA.size + setB.size - inter);
}

class Store extends EventTarget {
  constructor() {
    super();
    this.tracks = [];
    this.virtualGroups = [];
    this.collapsedGroups = new Set();
    this.selectedIds = new Set();
    this.isPlaying = false;
    this.showBuses = true;
    this.settings = loadSettings();

    this.reverbInfo = {
      connected: false,
      deviceName: "Sin Return A",
      adapterName: null,
      decay: 0.45,
      predelay: 0.2,
      decayParam: null,
      predelayParam: null,
    };

    this.viewMode = "mix"; // "mix" | "eq"

    // Telemetría Master & Análisis Psicoacústico
    this.masterStats = {
      connected: false,
      shortTermLufs: -Infinity,
      peakDb: -Infinity,
      clipping: false,
    };
    this.mixAnalysis = {
      occupancyPct: 0,
      lowEndPct: 0,
      densityZone: "Sparse",
      densityClass: "zone-sparse",
      activeCount: 0,
      collisions: [],
      lowEndStereoWarnings: [],
      spectralBalance: { low: 0, lowMid: 0, highMid: 0, high: 0 },
    };

    this.undoStack = [];
    this.redoStack = [];
    this.MAX_HISTORY = 40;

    // Bancos rápidos A/B/C/D y estado DRY (Bypass espacial/EQ)
    this.banks = { A: null, B: null, C: null, D: null };
    this.activeBank = null;
    this.isDryBypass = false;
    this.dryReturnSnapshot = null;
    this.flashFreeze = false;
    this.scenes = [];
    this.scenesAutoEnabled = false;
    this.currentSongBeat = 0;
    this.lastSceneRuleId = null;

    // Autoguardado por sesión
    this._restoredSessionKey = null;
    this._autosaveTimer = null;
    this.lastAutosaveAt = null;
    this.lastSessionRestored = false;

    // Se registra primero para restaurar metadata 3D/roles/bancos ANTES de que la UI y el 3D rendericen
    this.on("tracks-loaded", () => {
      this.restoreSessionForCurrentTracks();
    });

    const autosaveEvents = [
      "history",
      "groups",
      "banks-changed",
      "scenes-changed",
      "snapshot-applied",
      "track-renamed",
    ];
    autosaveEvents.forEach((ev) => {
      this.on(ev, () => this.scheduleSessionSave());
    });

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        if (this._autosaveTimer) {
          clearTimeout(this._autosaveTimer);
          this._autosaveTimer = null;
          this.saveSessionNow();
        }
      });
    }
  }

  emit(eventName, detail = null) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  on(eventName, handler) {
    const wrapped = (e) => handler(e.detail);
    this.addEventListener(eventName, wrapped);
    return () => this.removeEventListener(eventName, wrapped);
  }

  updateSettings(patch) {
    if (!patch || typeof patch !== "object") return;
    const safe = { ...patch };
    if (safe.skin && !SKINS[safe.skin]) delete safe.skin;
    this.settings = { ...this.settings, ...safe };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {}
    this.emit("settings", this.settings);
  }
  // Limpia el estado efímero de sesión (al cambiar Demo ↔ Live o cambiar de proyecto)
  resetSessionState() {
    clearTimeout(this._autosaveTimer);
    this._autosaveTimer = null;
    this.undoStack = [];
    this.redoStack = [];
    this.banks = { A: null, B: null, C: null, D: null };
    this.activeBank = null;
    this.isDryBypass = false;
    this.dryReturnSnapshot = null;
    this.virtualGroups = [];
    this.collapsedGroups.clear();
    this.selectedIds.clear();
    this.scenes = [];
    this.scenesAutoEnabled = false;
    this.lastSceneRuleId = null;
    this._restoredSessionKey = null;
    this.lastAutosaveAt = null;
    this.lastSessionRestored = false;
    this.emit("history");
    this.emit("banks-changed");
    this.emit("scenes-changed");
    this.emit("selection");
  }

  pruneInvalidSelection() {
    const validIds = new Set(this.tracks.map((t) => t.id));
    let changed = false;
    for (const id of Array.from(this.selectedIds)) {
      if (!validIds.has(id)) {
        this.selectedIds.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit("selection");
  }

  getTrackById(id) {
    return this.tracks.find((t) => t.id === String(id)) || null;
  }

  getSelectedTracks() {
    return this.tracks.filter((t) => this.selectedIds.has(t.id));
  }

  setSelection(ids) {
    this.selectedIds = new Set(ids.map(String));
    this.emit("selection");
  }

  setViewMode(mode) {
    const next = mode === "eq" ? "eq" : "mix";
    if (this.viewMode === next) return;
    this.viewMode = next;
    this.emit("view-mode", next);
  }

  toggleInSelection(id) {
    const sid = String(id);
    if (this.selectedIds.has(sid)) this.selectedIds.delete(sid);
    else this.selectedIds.add(sid);
    this.emit("selection");
  }

  captureSnapshot() {
    return {
      reverb: { decay: this.reverbInfo.decay, predelay: this.reverbInfo.predelay },
      virtualGroups: this.virtualGroups.map((g) => ({ ...g })),
      tracks: this.tracks.map((t) => ({
        id: t.id,
        index: t.index,
        name: t.name,
        colorHex: t.colorHex,
        pan: t.pan,
        vol: t.vol,
        sendA: t.sendA,
        y: t.y,
        mute: t.mute,
        solo: t.solo,
        role: t.role,
        shape: t.shape,
        sizeScale: t.sizeScale ?? 1.0,
        hidden: t.hidden,
        locked: t.locked,
        vGroupId: t.vGroupId,
        eqBands: t.eq?.bound
          ? t.eq.bands.map((b) => ({
              bandNum: b.bandNum,
              on: b.on,
              type: b.type,
              freqHz: b.freqHz,
              gainDb: b.gainDb,
              q: b.q,
            }))
          : null,
      })),
    };
  }

  toggleFlashFreeze() {
    this.flashFreeze = !this.flashFreeze;
    this.emit("flash-changed", this.flashFreeze);
  }

  pushHistory(beforeSnapshot) {
    if (!beforeSnapshot) return;
    this.undoStack.push(beforeSnapshot);
    if (this.undoStack.length > this.MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.emit("history");
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  popUndo() {
    if (!this.canUndo()) return null;
    this.redoStack.push(this.captureSnapshot());
    const snap = this.undoStack.pop();
    this.emit("history");
    return snap;
  }

  popRedo() {
    if (!this.canRedo()) return null;
    this.undoStack.push(this.captureSnapshot());
    const snap = this.redoStack.pop();
    this.emit("history");
    return snap;
  }

  createVirtualGroup(name) {
    const palette = ["#f472b6", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185"];
    const vg = {
      id: "vg_" + Date.now().toString(36),
      name: name.trim(),
      color: palette[this.virtualGroups.length % palette.length],
    };
    this.virtualGroups.push(vg);
    this.emit("groups");
    return vg;
  }

  assignTrackToVirtualGroup(trackId, vGroupId) {
    const t = this.getTrackById(trackId);
    if (!t || t.isGroup) return;
    const before = this.captureSnapshot();
    t.vGroupId = vGroupId || null;
    this.pushHistory(before);
    this.emit("groups");
    this.emit("tracks");
  }

  toggleCollapseGroup(groupId) {
    const gid = String(groupId);
    if (this.collapsedGroups.has(gid)) this.collapsedGroups.delete(gid);
    else this.collapsedGroups.add(gid);
    this.emit("groups");
  }

  saveBank(slot) {
    if (!["A", "B", "C", "D"].includes(slot)) return;
    this.banks[slot] = this.captureSnapshot();
    this.activeBank = slot;
    this.isDryBypass = false;
    this.dryReturnSnapshot = null;
    this.emit("banks-changed");
  }

  clearBank(slot) {
    if (!["A", "B", "C", "D"].includes(slot)) return;
    this.banks[slot] = null;
    if (this.activeBank === slot) this.activeBank = null;
    this.emit("banks-changed");
  }

  buildDrySnapshot(baseSnap) {
    return {
      reverb: baseSnap.reverb,
      virtualGroups: baseSnap.virtualGroups,
      tracks: baseSnap.tracks.map((t) => ({
        ...t,
        pan: 0,
        vol: 0.85, // 0.0 dB neutro de Ableton Live
        sendA: 0,
        y: ROLES[t.role]?.defaultY ?? 0,
        shape: "sphere",
        sizeScale: 1.0,
        eqBands: Array.isArray(t.eqBands)
          ? t.eqBands.map((b) => ({ ...b, on: false }))
          : null,
      })),
    };
  }

  backfillBankEq(trackItem) {
    if (!trackItem?.eq?.bound) return;
    const eqSnapshot = trackItem.eq.bands.map((b) => ({
      bandNum: b.bandNum,
      on: b.on,
      type: b.type,
      freqHz: b.freqHz,
      gainDb: b.gainDb,
      q: b.q,
    }));
    const targets = [
      ...Object.values(this.banks),
      this.dryReturnSnapshot,
      ...this.undoStack,
      ...this.redoStack,
    ];
    for (const snap of targets) {
      if (!snap || !Array.isArray(snap.tracks)) continue;
      const entry = snap.tracks.find((t) => t.id === trackItem.id);
      if (entry && entry.eqBands === null) {
        entry.eqBands = eqSnapshot.map((b) => ({ ...b }));
      }
    }
  }

  addSceneRule(beat = 0, bank = "A", label = "") {
    const cleanBeat = Math.max(0, Math.round((Number(beat) || 0) * 4) / 4);
    const bar = Math.floor(cleanBeat / 4) + 1;
    const rule = {
      id: "sc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      beat: cleanBeat,
      bar,
      bank: ["A", "B", "C", "D"].includes(bank) ? bank : "A",
      label: (label || "").trim() || `Compás ${bar}`,
    };
    this.scenes.push(rule);
    this.scenes.sort((a, b) => a.beat - b.beat);
    this.emit("scenes-changed");
    return rule;
  }

  updateSceneRule(id, patch) {
    const r = this.scenes.find((s) => s.id === id);
    if (!r) return;
    if (typeof patch.beat === "number") {
      r.beat = Math.max(0, patch.beat);
      r.bar = Math.floor(r.beat / 4) + 1;
    }
    if (patch.bank && ["A", "B", "C", "D"].includes(patch.bank)) r.bank = patch.bank;
    if (typeof patch.label === "string") r.label = patch.label;
    this.scenes.sort((a, b) => a.beat - b.beat);
    this.emit("scenes-changed");
  }

  removeSceneRule(id) {
    this.scenes = this.scenes.filter((s) => s.id !== id);
    this.emit("scenes-changed");
  }

  getActiveSceneForBeat(beat) {
    let active = null;
    for (const r of this.scenes) {
      if (beat + 0.05 >= r.beat) active = r;
      else break;
    }
    return active;
  }

  // =========================================================================
  // AUTOGUARDADO POR SESIÓN (LocalStorage con huella + tolerancia de pistas)
  // =========================================================================
  computeSessionSignature() {
    const names = this.tracks.map((t) => `${t.isGroup ? "G" : "T"}:${normalizeTrackSigName(t.name)}`);
    const sorted = [...names].sort();
    return {
      key: "sess_" + hashStr(sorted.join("|")),
      names: sorted,
    };
  }

  _readSessionsIndex() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SESSIONS_INDEX_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  _writeSessionsIndex(index) {
    try {
      const sorted = [...index].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const kept = sorted.slice(0, MAX_SAVED_SESSIONS);
      const dropped = sorted.slice(MAX_SAVED_SESSIONS);
      for (const old of dropped) {
        try { localStorage.removeItem(SESSION_PREFIX + old.key); } catch {}
      }
      localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(kept));
    } catch {}
  }

  scheduleSessionSave(delayMs = 700) {
    if (this.tracks.length === 0 || this.isDryBypass) return;
    clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => {
      this._autosaveTimer = null;
      this.saveSessionNow();
    }, delayMs);
  }

  saveSessionNow() {
    if (this.tracks.length === 0 || this.isDryBypass) return false;
    const { key, names } = this.computeSessionSignature();
    const now = Date.now();

    const payload = {
      version: APP_VERSION,
      updatedAt: now,
      virtualGroups: this.virtualGroups.map((g) => ({ ...g })),
      collapsedGroups: Array.from(this.collapsedGroups),
      banks: this.banks,
      activeBank: this.activeBank,
      scenes: this.scenes,
      scenesAutoEnabled: this.scenesAutoEnabled,
      tracksMeta: this.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        isGroup: t.isGroup,
        role: t.role,
        y: t.y,
        shape: t.shape,
        sizeScale: t.sizeScale ?? 1.0,
        hidden: Boolean(t.hidden),
        locked: Boolean(t.locked),
        vGroupId: t.vGroupId || null,
      })),
    };

    const storageKey = SESSION_PREFIX + key;
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Si se llena la cuota de localStorage, guarda sin snapshots pesados de bancos
      try {
        const slim = { ...payload, banks: { A: null, B: null, C: null, D: null }, activeBank: null };
        localStorage.setItem(storageKey, JSON.stringify(slim));
      } catch {
        return false;
      }
    }

    const index = this._readSessionsIndex().filter((e) => e.key !== key);
    index.unshift({ key, updatedAt: now, trackNames: names });
    this._writeSessionsIndex(index);

    this._restoredSessionKey = key;
    this.lastAutosaveAt = now;
    this.emit("session-autosaved", { key, updatedAt: now });
    return true;
  }

  _applySavedSessionData(data) {
    if (!data || !Array.isArray(data.tracksMeta)) return false;

    if (Array.isArray(data.virtualGroups)) {
      this.virtualGroups = data.virtualGroups.map((g) => ({ ...g }));
    }
    const validVGroups = new Set(this.virtualGroups.map((g) => g.id));

    if (Array.isArray(data.collapsedGroups)) {
      this.collapsedGroups = new Set(data.collapsedGroups.map(String));
    }

    const unusedMeta = [...data.tracksMeta];
    const takeMatch = (track) => {
      let idx = unusedMeta.findIndex((m) => String(m.id) === String(track.id));
      if (idx === -1) {
        const targetName = normalizeTrackSigName(track.name);
        idx = unusedMeta.findIndex(
          (m) => Boolean(m.isGroup) === Boolean(track.isGroup) && normalizeTrackSigName(m.name) === targetName
        );
      }
      if (idx === -1) return null;
      return unusedMeta.splice(idx, 1)[0];
    };

    for (const t of this.tracks) {
      const meta = takeMatch(t);
      if (!meta) continue;
      if (meta.role && ROLES[meta.role]) t.role = meta.role;
      if (typeof meta.y === "number" && Number.isFinite(meta.y)) {
        t.y = clamp(meta.y, -HALF_H + 0.25, HALF_H - 0.25);
      }
      if (meta.shape === "sphere" || meta.shape === "oblong") t.shape = meta.shape;
      if (typeof meta.sizeScale === "number" && Number.isFinite(meta.sizeScale)) {
        t.sizeScale = clamp(meta.sizeScale, 0.4, 2.4);
      }
      t.hidden = Boolean(meta.hidden);
      t.locked = Boolean(meta.locked);
      t.vGroupId = meta.vGroupId && validVGroups.has(meta.vGroupId) ? meta.vGroupId : null;
    }

    if (data.banks && typeof data.banks === "object") {
      for (const slot of ["A", "B", "C", "D"]) {
        if (data.banks[slot]?.tracks) this.banks[slot] = data.banks[slot];
      }
      if (data.activeBank && this.banks[data.activeBank]) {
        this.activeBank = data.activeBank;
      }
    }

    if (Array.isArray(data.scenes)) {
      this.scenes = data.scenes.map((s) => ({ ...s }));
      this.scenesAutoEnabled = Boolean(data.scenesAutoEnabled);
    }

    this.lastAutosaveAt = data.updatedAt || Date.now();
    this.lastSessionRestored = true;
    this.emit("session-restored", { updatedAt: this.lastAutosaveAt });
    return true;
  }

  restoreSessionForCurrentTracks() {
    if (this.tracks.length === 0) return false;
    const { key, names } = this.computeSessionSignature();

    // Evita pisar el estado vivo en memoria al hacer Rescan (↻) dentro de la misma sesión
    if (this._restoredSessionKey === key) return false;

    let raw = null;
    try {
      raw = localStorage.getItem(SESSION_PREFIX + key);
    } catch {}

    // Fallback inteligente: si agregaste/renombraste 1-2 pistas, busca sesión con >=70% coincidencia
    if (!raw && names.length >= 2) {
      const index = this._readSessionsIndex();
      let bestEntry = null;
      let bestScore = 0;
      for (const entry of index) {
        if (!Array.isArray(entry.trackNames)) continue;
        const score = jaccardSimilarity(names, entry.trackNames);
        if (score >= 0.70 && score > bestScore) {
          bestScore = score;
          bestEntry = entry;
        }
      }
      if (bestEntry) {
        try { raw = localStorage.getItem(SESSION_PREFIX + bestEntry.key); } catch {}
      }
    }

    this._restoredSessionKey = key;
    if (!raw) {
      this.lastSessionRestored = false;
      return false;
    }

    try {
      return this._applySavedSessionData(JSON.parse(raw));
    } catch (err) {
      console.warn("No se pudo restaurar autoguardado de sesión:", err);
      return false;
    }
  }

  getSavedSessionsCount() {
    return this._readSessionsIndex().length;
  }

  listSavedSessions() {
    const currentKey = this.tracks.length > 0 ? this.computeSessionSignature().key : null;
    return this._readSessionsIndex()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((entry) => {
        const rawNames = Array.isArray(entry.trackNames) ? entry.trackNames : [];
        const cleanNames = rawNames
          .map((n) => String(n).replace(/^[GT]:/, ""))
          .filter(Boolean);
        return {
          key: entry.key,
          updatedAt: entry.updatedAt || 0,
          trackCount: cleanNames.length,
          previewNames: cleanNames.slice(0, 4).join(", ") + (cleanNames.length > 4 ? "…" : ""),
          isCurrent: Boolean(currentKey && entry.key === currentKey),
        };
      });
  }

  loadSavedSessionByKey(key) {
    if (!key || this.tracks.length === 0) return false;
    let raw = null;
    try {
      raw = localStorage.getItem(SESSION_PREFIX + key);
    } catch {}
    if (!raw) return false;
    try {
      const ok = this._applySavedSessionData(JSON.parse(raw));
      if (ok) {
        this.emit("groups");
        this.emit("banks-changed");
        this.emit("scenes-changed");
        this.emit("snapshot-applied");
      }
      return ok;
    } catch (err) {
      console.warn("Error aplicando sesión guardada:", err);
      return false;
    }
  }

  deleteSavedSession(key) {
    if (!key) return false;
    try {
      localStorage.removeItem(SESSION_PREFIX + key);
    } catch {}
    const nextIndex = this._readSessionsIndex().filter((e) => e.key !== key);
    this._writeSessionsIndex(nextIndex);
    if (this._restoredSessionKey === key) {
      this.lastAutosaveAt = null;
      this.lastSessionRestored = false;
    }
    this.emit("session-cleared", { scope: "single", key });
    return true;
  }

  clearCurrentSavedSession() {
    clearTimeout(this._autosaveTimer);
    this._autosaveTimer = null;
    if (this.tracks.length === 0) return false;
    const { key } = this.computeSessionSignature();
    return this.deleteSavedSession(key);
  }

  clearAllSavedSessions() {
    clearTimeout(this._autosaveTimer);
    this._autosaveTimer = null;
    const index = this._readSessionsIndex();
    for (const entry of index) {
      try {
        localStorage.removeItem(SESSION_PREFIX + entry.key);
      } catch {}
    }
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SESSION_PREFIX)) localStorage.removeItem(k);
      }
      localStorage.removeItem(SESSIONS_INDEX_KEY);
    } catch {}
    this.lastAutosaveAt = null;
    this.lastSessionRestored = false;
    this.emit("session-cleared", { scope: "all" });
    return true;
  }

  buildExportPayload() {
    return {
      app: "Owls3DMixer",
      version: APP_VERSION,
      projectTitle: "Mix by OwlsMixer3D",
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      reverb: { decay: this.reverbInfo.decay, predelay: this.reverbInfo.predelay },
      snapshot: this.captureSnapshot(),
      scenes: this.scenes,
    };
  }
}

export const store = new Store();