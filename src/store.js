import { SKINS } from "./data/skins.js";
import {
  HALF_W, HALF_H, HALF_D, clamp,
  abletonVolToDb, dbToAbletonVol,
  volToZLog, zToVolLog,
  freqToY, yToFreq, formatFreq, getApparentVolumeLevel,
} from "./engine/psychoacoustics.js";

export {
  HALF_W, HALF_H, HALF_D, clamp,
  abletonVolToDb, dbToAbletonVol,
  freqToY, yToFreq, formatFreq, getApparentVolumeLevel,
};

export const panToX = (pan) => clamp(pan, -1, 1) * HALF_W;
export const xToPan = (x) => clamp(x / HALF_W, -1, 1);

// Modo Gibson: ahora usa Escala Logarítmica Real en dB (-36 dB .. +6 dB)!
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

const DEFAULT_SETTINGS = {
  volUnit: "db",
  zMode: "gibson",
  showReverbCubes: true,
  showVolLevels: true,
  showFreqBands: true,
  showEqTips: true,
  freqSizing: true,
  showCollisions: true,    // Nuevo: Detector Solar Eclipse en 3D
  lufsTarget: "indie",     // Nuevo: streaming | indie | heavy | acoustic
  skin: "gibson_dark",
};

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem("owls3d_settings_v3") || "{}");
    const merged = { ...DEFAULT_SETTINGS, ...raw };
    if (!SKINS[merged.skin]) merged.skin = "gibson_dark";
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
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

    // Telemetría Master & Análisis Psicoacústico (US-08)
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
    };

    this.undoStack = [];
    this.redoStack = [];
    this.MAX_HISTORY = 40;
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
    this.settings = { ...this.settings, ...patch };
    localStorage.setItem("owls3d_settings_v3", JSON.stringify(this.settings));
    this.emit("settings", this.settings);
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

  buildExportPayload() {
    return {
      app: "Owls3DMixer",
      version: "0.0.5",
      projectTitle: "Mix by OwlsMixer3D",
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      reverb: { decay: this.reverbInfo.decay, predelay: this.reverbInfo.predelay },
      snapshot: this.captureSnapshot(),
    };
  }
}

export const store = new Store();