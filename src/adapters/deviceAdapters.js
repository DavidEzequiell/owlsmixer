// Patrón Adapter para plugins en Ableton Live (Reverb en Return A + EQ por pista).
// Nota AbletonJS v5: param.raw no incluye min/max; se leen una vez vía hydrateParamBounds().

export const REVERB_ADAPTERS = [
  {
    id: "ableton_reverb",
    label: "Ableton Reverb",
    matchDevice: (name) => name === "reverb" || name.includes("ableton reverb"),
    decayNames: ["decay time", "decay"],
    predelayNames: ["predelay", "pre-delay"],
  },
  {
    id: "ableton_hybrid_reverb",
    label: "Ableton Hybrid Reverb",
    matchDevice: (name) => name.includes("hybrid reverb"),
    decayNames: ["decay", "algo decay", "ir decay"],
    predelayNames: ["predelay", "pre-delay"],
  },
  {
    id: "fabfilter_pro_r",
    label: "FabFilter Pro-R",
    matchDevice: (name) => name.includes("pro-r") || name.includes("fabfilter"),
    decayNames: ["space", "decay rate", "decay"],
    predelayNames: ["pre-delay", "predelay"],
  },
  {
    id: "valhalla_reverb",
    label: "Valhalla Reverb",
    matchDevice: (name) => name.includes("valhalla"),
    decayNames: ["decay", "decaynow"],
    predelayNames: ["predelay", "pre-delay"],
  },
  {
    id: "generic_reverb",
    label: "Reverb Genérica",
    matchDevice: (name) => name.includes("verb") || name.includes("room") || name.includes("hall") || name.includes("plate"),
    decayNames: ["decay time", "decay", "space", "time", "size", "length"],
    predelayNames: ["predelay", "pre-delay", "pre delay"],
  },
];

// =========================================================================
// EQ ADAPTERS & CONVERSIÓN LOGARÍTMICA EXACTA (10 Hz .. 22.000 Hz)
// =========================================================================
export const EQ_FREQ_MIN = 10;
export const EQ_FREQ_MAX = 22000;
const EQ_FREQ_RATIO = EQ_FREQ_MAX / EQ_FREQ_MIN; // 2200

export function eqNormToHz(norm) {
  const n = Math.max(0, Math.min(1, Number(norm) || 0));
  return EQ_FREQ_MIN * Math.pow(EQ_FREQ_RATIO, n);
}

export function hzToEqNorm(hz) {
  const f = Math.max(EQ_FREQ_MIN, Math.min(EQ_FREQ_MAX, Number(hz) || 1000));
  return Math.log(f / EQ_FREQ_MIN) / Math.log(EQ_FREQ_RATIO);
}

// Índices estándar de EQ Eight Filter Type A (0..7)
export const EQ_FILTER_TYPES = {
  HP_48: 0,
  HP_12: 1,
  LOW_SHELF: 2,
  BELL: 3,
  NOTCH: 4,
  HIGH_SHELF: 5,
  LP_12: 6,
  LP_48: 7,
};

export const EQ_ADAPTERS = [
  {
    id: "ableton_eq_eight",
    label: "EQ Eight",
    bandCount: 8,
    matchDevice: (name) => name === "eq eight" || name.includes("eq eight"),
    freqToNorm: hzToEqNorm,
    normToFreq: eqNormToHz,
    getBandParamNames: (n) => ({
      on: `${n} filter on a`,
      type: `${n} filter type a`,
      freq: `${n} frequency a`,
      gain: `${n} gain a`,
      q: `${n} resonance a`,
    }),
  },
];

export function createDefaultEqBands(count = 8) {
  const defaultFreqs = [30, 100, 250, 800, 2000, 5000, 10000, 16000];
  return Array.from({ length: count }, (_, idx) => ({
    bandNum: idx + 1,
    on: false,
    type: idx === 0 ? EQ_FILTER_TYPES.HP_12 : idx === 7 ? EQ_FILTER_TYPES.LP_12 : EQ_FILTER_TYPES.BELL,
    freqHz: defaultFreqs[idx] || 1000,
    gainDb: 0,
    q: 0.38,
    _localWriteUntil: 0,
  }));
}

function findParamByNames(params, candidates) {
  for (const cand of candidates) {
    const hit = params.find((p) => (p.raw?.name || "").toLowerCase().trim() === cand);
    if (hit) return hit;
  }
  for (const cand of candidates) {
    const hit = params.find((p) => (p.raw?.name || "").toLowerCase().includes(cand));
    if (hit) return hit;
  }
  return null;
}

export async function hydrateParamBounds(param) {
  if (!param) return null;
  if (param._bounds) return param;

  let min = param.raw?.min;
  let max = param.raw?.max;
  if (typeof min !== "number") {
    try { min = await param.get("min"); } catch { min = 0; }
  }
  if (typeof max !== "number") {
    try { max = await param.get("max"); } catch { max = 1; }
  }

  param._bounds = {
    min: typeof min === "number" ? min : 0,
    max: typeof max === "number" ? max : 1,
  };
  return param;
}

export function paramToNorm(param, val) {
  if (!param) return 0;
  const min = param._bounds?.min ?? param.raw?.min ?? 0;
  const max = param._bounds?.max ?? param.raw?.max ?? 1;
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

export function normToParam(param, norm01) {
  if (!param) return 0;
  const min = param._bounds?.min ?? param.raw?.min ?? 0;
  const max = param._bounds?.max ?? param.raw?.max ?? 1;
  return min + Math.max(0, Math.min(1, norm01)) * (max - min);
}

export async function bindReturnAReverb(returnTrack) {
  if (!returnTrack) return null;
  let devices = [];
  try {
    devices = await returnTrack.get("devices");
  } catch {
    return null;
  }

  for (const dev of devices) {
    const rawName = (dev.raw?.name || "").trim();
    const lowerName = rawName.toLowerCase();
    const adapter = REVERB_ADAPTERS.find((a) => a.matchDevice(lowerName));
    if (!adapter) continue;

    let params = [];
    try {
      params = await dev.get("parameters");
    } catch {
      continue;
    }

    const decayParam = await hydrateParamBounds(findParamByNames(params, adapter.decayNames));
    const predelayParam = await hydrateParamBounds(findParamByNames(params, adapter.predelayNames));

    return {
      device: dev,
      deviceName: rawName,
      adapterName: adapter.label,
      decayParam,
      predelayParam,
    };
  }
  return null;
}

// Detección rápida en scanAll() sin bajar los 40+ parámetros todavía
export async function findTrackEqDevice(track) {
  if (!track) return null;
  let devices = [];
  try {
    devices = await track.get("devices");
  } catch {
    return null;
  }

  for (const dev of devices) {
    const rawName = (dev.raw?.name || "").trim();
    const lowerName = rawName.toLowerCase();
    const adapter = EQ_ADAPTERS.find((a) => a.matchDevice(lowerName));
    if (adapter) {
      return { device: dev, deviceName: rawName, adapter };
    }
  }
  return null;
}

// Binding completo on-demand (solo cuando seleccionás la pista / usás EQ Window)
export async function bindEqDevice(device, adapter) {
  if (!device || !adapter) return null;
  let params = [];
  try {
    params = await device.get("parameters");
  } catch {
    return null;
  }

  const byLower = new Map();
  for (const p of params) {
    const key = (p.raw?.name || "").toLowerCase().trim();
    if (key) byLower.set(key, p);
  }

  const bands = [];
  for (let n = 1; n <= adapter.bandCount; n++) {
    const names = adapter.getBandParamNames(n);
    const onParam = byLower.get(names.on) || null;
    const typeParam = byLower.get(names.type) || null;
    const freqParam = await hydrateParamBounds(byLower.get(names.freq) || null);
    const gainParam = await hydrateParamBounds(byLower.get(names.gain) || null);
    const qParam = await hydrateParamBounds(byLower.get(names.q) || null);

    bands.push({
      bandNum: n,
      onParam,
      typeParam,
      freqParam,
      gainParam,
      qParam,
    });
  }

  const outputGainParam = await hydrateParamBounds(byLower.get("output gain") || null);
  const scaleParam = await hydrateParamBounds(byLower.get("scale") || null);

  return {
    device,
    adapter,
    outputGainParam,
    scaleParam,
    bands,
  };
}