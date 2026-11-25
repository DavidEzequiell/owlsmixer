import { HALF_W, HALF_H, clamp } from "../engine/psychoacoustics.js";
import { EQ_FILTER_TYPES } from "../adapters/deviceAdapters.js";

// Las 7 franjas horizontales del Virtual Mixer (p. 48), de abajo hacia arriba
export const GIBSON_EQ_STRIPS = [
  { index: 0, label: "40 – 100 Hz",  sub: "Bass",       minHz: 40,    maxHz: 100,   centerHz: 65,    color: "#ef4444", defaultType: EQ_FILTER_TYPES.LOW_SHELF },
  { index: 1, label: "100 – 200 Hz", sub: "Warm / Mud", minHz: 100,   maxHz: 200,   centerHz: 145,   color: "#f97316", defaultType: EQ_FILTER_TYPES.BELL },
  { index: 2, label: "200 – 800 Hz", sub: "Oohzone",    minHz: 200,   maxHz: 800,   centerHz: 400,   color: "#a855f7", defaultType: EQ_FILTER_TYPES.BELL },
  { index: 3, label: "800 – 2k Hz",  sub: "Midrange",   minHz: 800,   maxHz: 2000,  centerHz: 1250,  color: "#38bdf8", defaultType: EQ_FILTER_TYPES.BELL },
  { index: 4, label: "2k – 5k Hz",   sub: "Presence",   minHz: 2000,  maxHz: 5000,  centerHz: 3200,  color: "#22d3ee", defaultType: EQ_FILTER_TYPES.BELL },
  { index: 5, label: "5k – 10k Hz",  sub: "Brilliance", minHz: 5000,  maxHz: 10000, centerHz: 7000,  color: "#4ade80", defaultType: EQ_FILTER_TYPES.BELL },
  { index: 6, label: "10k – 20k Hz", sub: "Air / Hi",   minHz: 10000, maxHz: 20000, centerHz: 14000, color: "#facc15", defaultType: EQ_FILTER_TYPES.HIGH_SHELF },
];

export const EQ_X_SPAN = HALF_W - 0.35; // Deja un margen limpio en los bordes L/R
export const STRIP_H = (HALF_H * 2) / GIBSON_EQ_STRIPS.length;

export function eqGainToX(gainDb) {
  return clamp((Number(gainDb) || 0) / 15, -1, 1) * EQ_X_SPAN;
}

export function xToEqGain(x, magneticZero = true) {
  const db = clamp(x / EQ_X_SPAN, -1, 1) * 15;
  if (magneticZero && Math.abs(db) < 0.55) return 0;
  return Math.round(db * 10) / 10;
}

export function stripCenterY(stripIndex) {
  return -HALF_H + (stripIndex + 0.5) * STRIP_H;
}

export function freqToEqY(hz) {
  const f = clamp(Number(hz) || 1000, 15, 22000);
  if (f <= GIBSON_EQ_STRIPS[0].minHz) {
    const t = clamp(Math.log(f / 15) / Math.log(40 / 15), 0, 1);
    return -HALF_H + t * 0.14;
  }
  for (let i = 0; i < GIBSON_EQ_STRIPS.length; i++) {
    const s = GIBSON_EQ_STRIPS[i];
    if (f <= s.maxHz || i === GIBSON_EQ_STRIPS.length - 1) {
      const t = clamp(Math.log(f / s.minHz) / Math.log(s.maxHz / s.minHz), 0, 1.08);
      return -HALF_H + (i + clamp(t, 0, 1)) * STRIP_H;
    }
  }
  return 0;
}

export function eqYToFreq(y) {
  const clampedY = clamp(y, -HALF_H, HALF_H - 0.001);
  const idx = clamp(Math.floor((clampedY + HALF_H) / STRIP_H), 0, GIBSON_EQ_STRIPS.length - 1);
  const s = GIBSON_EQ_STRIPS[idx];
  const localT = clamp(((clampedY + HALF_H) - idx * STRIP_H) / STRIP_H, 0, 1);
  return Math.round(s.minHz * Math.pow(s.maxHz / s.minHz, localT));
}

export function getStripIndexForFreq(hz) {
  const f = Number(hz) || 1000;
  for (let i = 0; i < GIBSON_EQ_STRIPS.length; i++) {
    if (f <= GIBSON_EQ_STRIPS[i].maxHz) return i;
  }
  return GIBSON_EQ_STRIPS.length - 1;
}

export function findBandsInStrip(bands, stripIdx) {
  if (!Array.isArray(bands)) return [];
  return bands
    .map((b, idx) => ({ band: b, idx }))
    .filter(({ band }) => band.on && getStripIndexForFreq(band.freqHz) === stripIdx);
}

// Elige qué banda del EQ Eight (0..7) editar al interactuar con una franja
export function pickBandSlotForStrip(bands, stripIdx) {
  if (!Array.isArray(bands) || bands.length === 0) return 0;
  const strip = GIBSON_EQ_STRIPS[stripIdx];

  // 1) Si ya hay una banda prendida en esa franja, usar la más cercana al centro (priorizando Bell/Shelf sobre HPF/LPF)
  const activeInStrip = findBandsInStrip(bands, stripIdx);
  if (activeInStrip.length > 0) {
    activeInStrip.sort((a, b) => {
      const aGainable = a.band.type >= 2 && a.band.type <= 5 ? 0 : 1;
      const bGainable = b.band.type >= 2 && b.band.type <= 5 ? 0 : 1;
      if (aGainable !== bGainable) return aGainable - bGainable;
      return Math.abs(a.band.freqHz - strip.centerHz) - Math.abs(b.band.freqHz - strip.centerHz);
    });
    return activeInStrip[0].idx;
  }

  // 2) Si hay alguna banda apagada ya ubicada ahí
  const offInStrip = bands.findIndex((b) => !b.on && getStripIndexForFreq(b.freqHz) === stripIdx);
  if (offInStrip !== -1) return offInStrip;

  // 3) Cualquier banda apagada (preferimos 2..7 para dejar banda 1 libre para HPF y banda 8 para LPF)
  for (const idx of [1, 2, 3, 4, 5, 6, 0, 7]) {
    if (bands[idx] && !bands[idx].on) return idx;
  }

  // 4) Fallback: la más cercana en frecuencia
  let bestIdx = 0;
  let bestDist = Infinity;
  bands.forEach((b, idx) => {
    const d = Math.abs(Math.log((b.freqHz || 1000) / strip.centerHz));
    if (d < bestDist) { bestDist = d; bestIdx = idx; }
  });
  return bestIdx;

}

// Recetas Quick EQ basadas en David Gibson — "The Art of Mixing" (Charts 5 & 6)
const QUICK_EQ_PRESETS = {
  sub_808: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 25, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 45, gainDb: 2.0, q: 0.45 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 160, gainDb: -4.0, q: 0.60 },
  ],
  kick: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 30, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 55, gainDb: 2.5, q: 0.45 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 180, gainDb: -7.0, q: 0.72 },
    { bandNum: 4, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 3500, gainDb: 3.0, q: 0.45 },
  ],
  bass: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 32, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 52, gainDb: 2.5, q: 0.45 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 190, gainDb: -3.5, q: 0.60 },
    { bandNum: 4, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 2200, gainDb: 2.5, q: 0.45 },
  ],
  floor_tom: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 45, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 75, gainDb: 2.0, q: 0.45 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 210, gainDb: -5.0, q: 0.65 },
    { bandNum: 4, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 4200, gainDb: 3.0, q: 0.45 },
  ],
  tom: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 70, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 220, gainDb: -5.5, q: 0.65 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 4500, gainDb: 3.5, q: 0.45 },
  ],
  snare: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 90, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 140, gainDb: 2.0, q: 0.50 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 420, gainDb: -3.0, q: 0.65 },
    { bandNum: 4, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 4800, gainDb: 4.0, q: 0.45 },
  ],
  drums: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 35, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 240, gainDb: -2.5, q: 0.55 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.HIGH_SHELF, freqHz: 9000, gainDb: 2.0, q: 0.38 },
  ],
  guitar: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 95, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 220, gainDb: -3.5, q: 0.60 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 2500, gainDb: 2.5, q: 0.45 },
  ],
  lead_gtr: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 100, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 230, gainDb: -3.0, q: 0.60 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 2200, gainDb: 3.0, q: 0.50 },
    { bandNum: 4, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 3800, gainDb: -2.0, q: 0.72 },
  ],
  lead_vox: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 80, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 210, gainDb: -2.5, q: 0.60 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 4500, gainDb: 2.5, q: 0.45 },
    { bandNum: 4, on: true, type: EQ_FILTER_TYPES.HIGH_SHELF, freqHz: 11000, gainDb: 2.0, q: 0.38 },
  ],
  backing_vox: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 140, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 1800, gainDb: -2.0, q: 0.50 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.HIGH_SHELF, freqHz: 10000, gainDb: 2.5, q: 0.38 },
  ],
  piano_keys: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 70, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 200, gainDb: -3.0, q: 0.60 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 800, gainDb: -2.5, q: 0.65 },
    { bandNum: 4, on: true, type: EQ_FILTER_TYPES.HIGH_SHELF, freqHz: 6500, gainDb: 2.5, q: 0.38 },
  ],
  synth_pad: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 110, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 250, gainDb: -3.0, q: 0.55 },
    { bandNum: 3, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 2200, gainDb: -2.0, q: 0.45 },
  ],
  hihat: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 380, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.HIGH_SHELF, freqHz: 12000, gainDb: 3.0, q: 0.38 },
  ],
  overhead: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 320, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.HIGH_SHELF, freqHz: 11000, gainDb: 3.0, q: 0.38 },
  ],
  other: [
    { bandNum: 1, on: true, type: EQ_FILTER_TYPES.HP_12, freqHz: 45, gainDb: 0, q: 0.38 },
    { bandNum: 2, on: true, type: EQ_FILTER_TYPES.BELL, freqHz: 220, gainDb: -2.0, q: 0.55 },
  ],
};
QUICK_EQ_PRESETS.rhythm_gtr_l = QUICK_EQ_PRESETS.guitar;
QUICK_EQ_PRESETS.rhythm_gtr_r = QUICK_EQ_PRESETS.guitar;
QUICK_EQ_PRESETS.bus = QUICK_EQ_PRESETS.other;

export function getGibsonQuickEqForRole(role) {
  const activeBands = QUICK_EQ_PRESETS[role] || QUICK_EQ_PRESETS.other;
  const byNum = new Map(activeBands.map((b) => [b.bandNum, b]));

  // Rellena las 8 bandas para limpiar restos anteriores de EQ
  return Array.from({ length: 8 }, (_, idx) => {
    const bandNum = idx + 1;
    return byNum.get(bandNum) || { bandNum, on: false, gainDb: 0 };
  });
}

// Calcula cuánto desplaza el EQ Eight el centro tonal en el Eje Y del Mix 3D (-1.1 .. +1.1)
export function computeEqYShift(bands) {
  if (!Array.isArray(bands)) return 0;
  let shift = 0;

  for (const b of bands) {
    if (!b.on) continue;
    // HPF alto empuja el centro tonal hacia arriba (saca graves)
    if ((b.type === EQ_FILTER_TYPES.HP_48 || b.type === EQ_FILTER_TYPES.HP_12) && b.freqHz > 55) {
      shift += clamp(Math.log10(b.freqHz / 55) * 0.65, 0, 0.70);
    }
    // LPF empuja hacia abajo (saca agudos)
    else if ((b.type === EQ_FILTER_TYPES.LP_12 || b.type === EQ_FILTER_TYPES.LP_48) && b.freqHz < 12000) {
      shift -= clamp(Math.log10(12000 / Math.max(200, b.freqHz)) * 0.50, 0, 0.65);
    }
    // Cortes/boosts graves vs agudos
    else if (Math.abs(b.gainDb) > 0.2) {
      if (b.freqHz < 300) shift -= (b.gainDb / 15) * 0.45;
      else if (b.freqHz > 2000) shift += (b.gainDb / 15) * 0.45;
    }
  }

  return clamp(shift, -1.1, 1.1);
}
// Estima cuánto achica la huella espacial un recorte de graves (<300 Hz) en EQ Eight
export function computeEqLowCutScale(bands) {
  if (!Array.isArray(bands)) return 1.0;
  let factor = 1.0;

  for (const b of bands) {
    if (!b.on) continue;
    if ((b.type === EQ_FILTER_TYPES.HP_48 || b.type === EQ_FILTER_TYPES.HP_12) && b.freqHz > 50) {
      factor -= clamp(Math.log10(b.freqHz / 50) * 0.42, 0, 0.34);
    } else if (
      (b.type === EQ_FILTER_TYPES.LOW_SHELF || b.type === EQ_FILTER_TYPES.BELL) &&
      b.freqHz <= 300 &&
      b.gainDb < -1.0
    ) {
      factor -= clamp((-b.gainDb / 15) * 0.22, 0, 0.20);
    }
  }
  return clamp(factor, 0.58, 1.05);
  
}

// Elige la mejor banda Bell para hacer Carve (reutiliza si ya hay un recorte cerca)
export function pickCarveBandSlot(bands, targetHz) {
  if (!Array.isArray(bands) || bands.length === 0) return 2;

  // 1) Si ya hay una banda Bell/Shelf activa cerca (±35% en Hz), profundizar esa misma
  const nearIdx = bands.findIndex(
    (b) =>
      b.on &&
      b.type >= EQ_FILTER_TYPES.LOW_SHELF &&
      b.type <= EQ_FILTER_TYPES.HIGH_SHELF &&
      Math.abs(Math.log2(Math.max(20, b.freqHz) / Math.max(20, targetHz))) < 0.45
  );
  if (nearIdx !== -1) return nearIdx;

  // 2) Banda apagada en slots medios (dejando 1 y 8 libres para HPF/LPF)
  for (const idx of [2, 3, 4, 5, 1, 6, 0, 7]) {
    if (bands[idx] && !bands[idx].on) return idx;
  }

  // 3) Fallback: la banda Bell más cercana
  let bestIdx = 2;
  let bestDist = Infinity;
  bands.forEach((b, idx) => {
    if (b.type >= EQ_FILTER_TYPES.LOW_SHELF && b.type <= EQ_FILTER_TYPES.HIGH_SHELF) {
      const d = Math.abs(Math.log2(Math.max(20, b.freqHz) / Math.max(20, targetHz)));
      if (d < bestDist) { bestDist = d; bestIdx = idx; }
    }
  });
  return bestIdx;
}