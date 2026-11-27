import { ROLES } from "../data/roles.js";
import { store, clamp } from "../store.js";
import {
  createDefaultEqBands, eqNormToHz, hzToEqNorm, EQ_FILTER_TYPES,
} from "../adapters/deviceAdapters.js";
import { computeEqYShift, computeEqLowCutScale } from "../data/eqBands.js";
import {
  dbToAbletonVol, abletonVolToDb, dbToAbletonMeter, MasterLoudnessTracker,
} from "../engine/psychoacoustics.js";

const db = (v) => Number(dbToAbletonVol(v).toFixed(3));

const DEMO_TRACKS_BLUEPRINT = [
  { id: "demo_bus_drums", name: "Drums",       color: "#ff5c5c", isGroup: true,  role: "drums",        pan:  0.00, vol: db(-2.6), sendA: 0.14, y: -0.90, shape: "sphere", pattern: "bus",
    dynInit: { deviceName: "Glue Compressor", adapterName: "Glue Compressor", hasSidechain: false, canDuck: true } },
  { id: "demo_kick",      name: "Kick",        color: "#ef4444", groupId: "demo_bus_drums", role: "kick",      pan:  0.00, vol: db(-2.4), sendA: 0.05, y: -2.35, shape: "sphere", pattern: "kick",
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 32, gainDb: 0, q: 0.35 }] },
  { id: "demo_snare",     name: "Snare",       color: "#f97316", groupId: "demo_bus_drums", role: "snare",     pan: -0.04, vol: db(-2.8), sendA: 0.34, y: -0.35, shape: "sphere", pattern: "snare",
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 110, gainDb: 0, q: 0.38 }] },
  { id: "demo_hihat",     name: "Hi-Hat",      color: "#eab308", groupId: "demo_bus_drums", role: "hihat",     pan: -0.62, vol: db(-6.5), sendA: 0.14, y:  2.25, shape: "sphere", pattern: "hihat",
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 380, gainDb: 0, q: 0.40 }] },
  { id: "demo_oh",        name: "Overheads",   color: "#facc15", groupId: "demo_bus_drums", role: "overhead",  pan:  0.00, vol: db(-6.2), sendA: 0.24, y:  2.45, shape: "oblong", pattern: "oh",
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 280, gainDb: 0, q: 0.38 }] },

  { id: "demo_bass",      name: "Bass P-Bass", color: "#22c55e", role: "bass", pan: -0.02, vol: db(-2.2), sendA: 0.04, y: -1.95, shape: "sphere", pattern: "bass",
    dynInit: { deviceName: "Compressor", adapterName: "Compressor", hasSidechain: true, canDuck: true },
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 35, gainDb: 0, q: 0.35 }] },

  { id: "demo_bus_gtrs",  name: "Guitars",     color: "#38bdf8", isGroup: true,  role: "guitar",       pan:  0.00, vol: db(-3.2), sendA: 0.22, y:  0.20, shape: "oblong", pattern: "bus" },
  { id: "demo_gtr_l",     name: "Rhythm Gtr L",color: "#0ea5e9", groupId: "demo_bus_gtrs", role: "rhythm_gtr_l", pan: -0.78, vol: db(-3.8), sendA: 0.28, y:  0.12, shape: "oblong", pattern: "gtr",
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 105, gainDb: 0, q: 0.40 }] },
  { id: "demo_gtr_r",     name: "Rhythm Gtr R",color: "#0284c7", groupId: "demo_bus_gtrs", role: "rhythm_gtr_r", pan:  0.80, vol: db(-3.8), sendA: 0.28, y:  0.18, shape: "oblong", pattern: "gtr",
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 110, gainDb: 0, q: 0.40 }] },
  { id: "demo_lead_gtr",  name: "Lead Guitar", color: "#6366f1", groupId: "demo_bus_gtrs", role: "lead_gtr",     pan:  0.22, vol: db(-2.6), sendA: 0.38, y:  0.88, shape: "sphere", pattern: "lead",
    dynInit: { deviceName: "Compressor", adapterName: "Compressor", hasSidechain: false, canDuck: true },
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 140, gainDb: 0, q: 0.40 }] },

  { id: "demo_vox",       name: "Lead Vocal",  color: "#ec4899", role: "lead_vox",    pan:  0.00, vol: db(-1.8), sendA: 0.30, y:  0.58, shape: "sphere", pattern: "vox",
    dynInit: { deviceName: "Compressor", adapterName: "Compressor", hasSidechain: false, canDuck: true },
    eqInit: [
      { idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 95, gainDb: 0, q: 0.40 },
      { idx: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 3200, gainDb: 1.8, q: 0.46 },
    ] },
  { id: "demo_bvox",      name: "Backing Vox", color: "#f472b6", role: "backing_vox", pan: -0.45, vol: db(-7.2), sendA: 0.52, y:  1.38, shape: "oblong", pattern: "pad",
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 180, gainDb: 0, q: 0.42 }] },
  { id: "demo_pad",       name: "Analog Pad",  color: "#a855f7", role: "synth_pad",   pan:  0.00, vol: db(-8.5), sendA: 0.62, y:  1.05, shape: "oblong", pattern: "pad",
    dynInit: { deviceName: "Compressor", adapterName: "Compressor", hasSidechain: true, canDuck: true },
    eqInit: [{ idx: 0, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 160, gainDb: 0, q: 0.38 }] },
];

function createMockParam(bounds = { min: 0, max: 1 }) {
  return {
    _bounds: bounds,
    get: async () => 0,
    set: async () => {},
    addListener: async () => () => {},
  };
}

function createDemoEqBinding(bands) {
  const adapter = {
    label: "EQ Eight · Demo",
    normToFreq: eqNormToHz,
    freqToNorm: hzToEqNorm,
  };
  return {
    adapter,
    bands: bands.map(() => ({
      onParam: createMockParam({ min: 0, max: 1 }),
      typeParam: createMockParam({ min: 0, max: 7 }),
      freqParam: createMockParam({ min: 0, max: 1 }),
      gainParam: createMockParam({ min: -15, max: 15 }),
      qParam: createMockParam({ min: 0, max: 1 }),
    })),
  };
}

class DemoService {
  constructor() {
    this.active = false;
    this.timer = null;
    this.bpm = 112;
    this.lastTickAt = 0;
    this.masterTracker = new MasterLoudnessTracker(3000);
    this.lastMasterEmit = 0;
    this.lastSongEmit = 0;
  }

  start() {
    this.stop();
    this.active = true;
    this.loadDemoSession();
    this.setPlaying(true);
    this._startLoop();
  }

  stop() {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.masterTracker.reset();
    store.isPlaying = false;
    store.emit("playstate", false);
  }

  loadDemoSession() {
    store._restoredSessionKey = null;
    store.banks = { A: null, B: null, C: null, D: null };
    store.activeBank = null;
    store.isDryBypass = false;
    store.dryReturnSnapshot = null;
    store.virtualGroups = [];
    store.scenes = [];
    store.currentSongBeat = 0;

    const demoTracks = DEMO_TRACKS_BLUEPRINT.map((bp, idx) => {
      const bands = createDefaultEqBands(8);
      if (Array.isArray(bp.eqInit)) {
        for (const cfg of bp.eqInit) {
          const b = bands[cfg.idx];
          if (!b) continue;
          b.on = Boolean(cfg.on);
          b.type = cfg.type;
          b.freqHz = cfg.freqHz;
          b.gainDb = cfg.gainDb;
          b.q = cfg.q;
        }
      }

      const eqBinding = createDemoEqBinding(bands);
      const roleCfg = ROLES[bp.role] || ROLES.other;
      const item = {
        id: bp.id,
        index: idx,
        name: bp.name,
        colorHex: bp.color,
        isGroup: Boolean(bp.isGroup),
        isGrouped: Boolean(bp.groupId),
        groupId: bp.groupId || null,
        vGroupId: null,
        role: bp.role,
        shape: bp.shape || roleCfg.shape || "sphere",
        sizeScale: 1.0,
        pan: bp.pan,
        vol: bp.vol,
        sendA: bp.sendA,
        y: bp.y,
        mute: false,
        solo: false,
        hidden: false,
        locked: false,
        meter: 0,
        smoothMeter: 0,
        peakEnv: 0,
        rmsEnv: 0,
        crestScale: 1.0,
        _eqLowCutScale: computeEqLowCutScale(bands),
        _lastEqYShift: computeEqYShift(bands),
        _demoPattern: bp.pattern || "gtr",
        _lastCarve: null,
        eqCuts: bands
          .filter((b) => b.on && b.gainDb < -0.5 && b.type >= 2 && b.type <= 5)
          .map((b) => ({ freqHz: b.freqHz, gainDb: b.gainDb })),
        isDragging: false,
        eq: {
          hasDevice: true,
          bound: true,
          loading: false,
          deviceName: "EQ Eight (Demo)",
          adapterName: "EQ Eight · Demo",
          bands,
        },
        dynamics: {
          hasDevice: Boolean(bp.dynInit),
          deviceName: bp.dynInit?.deviceName || null,
          adapterName: bp.dynInit?.adapterName || null,
          hasSidechain: Boolean(bp.dynInit?.hasSidechain),
          canDuck: Boolean(bp.dynInit?.canDuck),
          duckSteps: 0,
        },
        _ableton: null,
      };

      item._ableton = {
        track: { raw: { id: bp.id, name: bp.name, has_audio_output: true }, set: async () => {}, get: async () => null },
        volParam: createMockParam({ min: 0, max: 1 }),
        panParam: createMockParam({ min: -1, max: 1 }),
        sendAParam: createMockParam({ min: 0, max: 1 }),
        eqDevice: { raw: { name: "EQ Eight (Demo)" } },
        eqAdapter: eqBinding.adapter,
        eqBinding,
        eqBandSetters: bands.map(() => ({ setFreq: () => {}, setGain: () => {}, setQ: () => {} })),
        eqUnsubs: [],
        setPanLive: (v) => { item.pan = clamp(v, -1, 1); },
        setVolLive: (v) => { item.vol = clamp(v, 0, 1); },
        setSendALive: (v) => { item.sendA = clamp(v, 0, 1); },
      };

      return item;
    });

    store.tracks = demoTracks;
    store.reverbInfo = {
      connected: true,
      deviceName: "Reverb (Demo)",
      adapterName: "Reverb · Sandbox",
      decay: 0.48,
      predelay: 0.24,
      decayParam: createMockParam({ min: 0, max: 1 }),
      predelayParam: createMockParam({ min: 0, max: 1 }),
    };
    store.masterStats = {
      connected: true,
      shortTermLufs: -Infinity,
      peakDb: -Infinity,
      clipping: false,
    };
    this.masterTracker.reset();

    store.emit("reverb-changed");
    store.emit("tracks-loaded");
    if (Object.values(store.banks).every((b) => !b) && store.tracks.length > 0) {
      store.saveBank("A");
    }
    store.emit("banks-changed");
  }

  setPlaying(flag) {
    store.isPlaying = Boolean(flag);
    this.lastTickAt = performance.now();
    if (!store.isPlaying) {
      for (const t of store.tracks) t.meter = 0;
      this.masterTracker.reset();
      store.masterStats.shortTermLufs = -Infinity;
      store.masterStats.peakDb = -Infinity;
      store.masterStats.clipping = false;
      store.emit("master-meter");
      store.lastSceneRuleId = null;
    }
    store.emit("playstate", store.isPlaying);
  }

  togglePlay() {
    this.setPlaying(!store.isPlaying);
  }

  importCueLocators() {
    store.scenes = [];
    const sections = [
      { beat: 0,  bank: "A", label: "Intro" },
      { beat: 16, bank: "A", label: "Verso 1" },
      { beat: 32, bank: "B", label: "Estribillo" },
      { beat: 48, bank: "A", label: "Puente" },
    ];
    sections.forEach((s) => store.addSceneRule(s.beat, s.bank, s.label));
    return sections.length;
  }

  _evalPatternEnv(pattern, beat) {
    const b4 = beat % 4;
    const b8 = beat % 8;
    const frac = beat % 1;
    const eighth = (beat * 2) % 1;

    switch (pattern) {
      case "kick": {
        const hit = (b4 < 0.45) || (b4 >= 2 && b4 < 2.45) || (b8 >= 6.5 && b8 < 6.9);
        const phase = b4 < 1 ? b4 : b4 >= 2 && b4 < 3 ? b4 - 2 : Math.max(0, b8 - 6.5);
        return hit ? Math.exp(-phase * 10.5) * 0.92 : 0.03;
      }
      case "snare": {
        const hit = (b4 >= 1 && b4 < 1.5) || (b4 >= 3 && b4 < 3.5);
        const phase = b4 >= 3 ? b4 - 3 : b4 - 1;
        return hit ? Math.exp(-phase * 9.0) * 0.88 : 0.02;
      }
      case "hihat":
        return Math.exp(-eighth * 11.0) * (frac < 0.5 ? 0.56 : 0.36);
      case "oh":
        return 0.24 + Math.exp(-eighth * 5.0) * 0.30;
      case "bass":
        return 0.42 + Math.exp(-((b4 % 2) * 3.0)) * 0.42;
      case "gtr":
        return 0.54 + Math.sin(beat * Math.PI * 0.5) * 0.14 + Math.exp(-frac * 4.5) * 0.14;
      case "lead": {
        const phrase = Math.sin(beat * 0.42);
        return phrase > -0.15 ? 0.35 + (phrase + 0.15) * 0.42 : 0.05;
      }
      case "vox": {
        const barPhase = (beat % 16) / 16;
        if (barPhase > 0.84) return 0.04; // Respiración entre frases
        return 0.42 + Math.abs(Math.sin(beat * 1.35)) * 0.36;
      }
      case "pad":
        return 0.48 + Math.sin(beat * 0.25) * 0.12;
      default:
        return 0.35;
    }
  }

  _startLoop() {
    this.lastTickAt = performance.now();
    this.timer = setInterval(() => {
      if (!this.active || !store.isPlaying || document.hidden) return;

      const now = performance.now();
      const dtSec = Math.min(0.15, (now - this.lastTickAt) / 1000);
      this.lastTickAt = now;

      store.currentSongBeat = (store.currentSongBeat + dtSec * (this.bpm / 60)) % 64;

      if (now - this.lastSongEmit > 140) {
        this.lastSongEmit = now;
        store.emit("song-time", store.currentSongBeat);
      }

      const anySolo = store.tracks.some((t) => t.solo);
      let sumPowL = 0;
      let sumPowR = 0;

      for (const t of store.tracks) {
        if (t.isGroup) continue;
        const isSilent = t.mute || (anySolo && !t.solo) || t.vol <= 0.005;
        if (isSilent) {
          t.meter = 0;
          continue;
        }

        const env = this._evalPatternEnv(t._demoPattern, store.currentSongBeat);
        const jitter = 0.94 + Math.random() * 0.12;
        const gainDb = abletonVolToDb(t.vol);
        const linGain = Number.isFinite(gainDb) ? Math.pow(10, gainDb / 20) : 0;

        // Meter por pista en la misma escala de vúmetro de Live (0.92 ≈ 0 dBFS)
        const trackLin = env * jitter * linGain * 0.55;
        t.meter = trackLin > 1e-4 ? dbToAbletonMeter(20 * Math.log10(trackLin)) : 0;

        // Suma estéreo (pan law -3 dB) para Master LUFS realista
        const panNorm = (clamp(t.pan, -1, 1) + 1) * 0.5;
        const gainL = Math.cos(panNorm * Math.PI * 0.5);
        const gainR = Math.sin(panNorm * Math.PI * 0.5);
        const trackSig = env * linGain * 0.28;
        sumPowL += (trackSig * gainL) ** 2;
        sumPowR += (trackSig * gainR) ** 2;
      }

      // Actualizar buses con el promedio de sus hijas
      for (const bus of store.tracks) {
        if (!bus.isGroup) continue;
        const kids = store.tracks.filter((c) => c.groupId === bus.id);
        bus.meter = kids.length > 0
          ? clamp(kids.reduce((acc, c) => acc + c.meter, 0) / Math.sqrt(kids.length) * 0.85, 0, 1)
          : 0;
      }

      const rmsL = Math.sqrt(sumPowL);
      const rmsR = Math.sqrt(sumPowR);
      // Convertir RMS lineal a escala real de output_meter de Ableton (0.92 ≈ 0 dBFS)
      const meterL = rmsL > 1e-4 ? dbToAbletonMeter(20 * Math.log10(rmsL)) : 0;
      const meterR = rmsR > 1e-4 ? dbToAbletonMeter(20 * Math.log10(rmsR)) : 0;
      this.masterTracker.pushMeter(meterL, meterR);

      if (now - this.lastMasterEmit > 120) {
        this.lastMasterEmit = now;
        store.masterStats.shortTermLufs = this.masterTracker.shortTermLufs;
        store.masterStats.peakDb = this.masterTracker.peakDb;
        store.masterStats.clipping = this.masterTracker.clipping;
        store.masterStats.rawMeterMax = this.masterTracker.rawMeterMax;
        store.masterStats.crestEstimateDb = this.masterTracker.crestEstimateDb;
        store.emit("master-meter");
      }
    }, 50);
  }
}

export const demoService = new DemoService();