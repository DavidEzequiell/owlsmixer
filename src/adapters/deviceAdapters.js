// Patrón Adapter para plugins en Ableton Live (Reverb Return A, EQ y Dinámica por pista).
// Nota AbletonJS v5: param.raw no incluye min/max; se leen una vez vía hydrateParamBounds().

import { abletonVolToDb, dbToAbletonVol } from "../engine/psychoacoustics.js";

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
// EQ ADAPTERS & CONVERSIÓN LOGARÍTMICA EXACTA
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

// FabFilter Pro-Q 3/4 opera entre 10 Hz y 30.000 Hz
function proQNormToHz(norm) {
  const n = Math.max(0, Math.min(1, Number(norm) || 0));
  return 10 * Math.pow(3000, n);
}
function hzToProQNorm(hz) {
  const f = Math.max(10, Math.min(30000, Number(hz) || 1000));
  return Math.log(f / 10) / Math.log(3000);
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
    gainParamToDb: (_param, raw) => Number(raw) || 0,
    dbToGainParam: (param, db) => {
      const min = param?._bounds?.min ?? -15;
      const max = param?._bounds?.max ?? 15;
      return Math.max(min, Math.min(max, db));
    },
    getBandParamNames: (n) => ({
      on: [`${n} filter on a`],
      type: [`${n} filter type a`],
      freq: [`${n} frequency a`],
      gain: [`${n} gain a`],
      q: [`${n} resonance a`],
    }),
  },
  {
    id: "fabfilter_pro_q",
    label: "FabFilter Pro-Q",
    bandCount: 8,
    matchDevice: (name) => name.includes("pro-q") || name.includes("pro q"),
    freqToNorm: hzToProQNorm,
    normToFreq: proQNormToHz,
    gainParamToDb: (param, raw) => {
      const min = param?._bounds?.min ?? 0;
      const max = param?._bounds?.max ?? 1;
      // Si VST3 expone 0..1, 0.5 = 0 dB (-30..+30 dB); si expone dB directos, devolver tal cual
      if (min >= 0 && max <= 1.01) return (paramToNorm(param, raw) - 0.5) * 60;
      return Number(raw) || 0;
    },
    dbToGainParam: (param, db) => {
      const min = param?._bounds?.min ?? 0;
      const max = param?._bounds?.max ?? 1;
      if (min >= 0 && max <= 1.01) {
        return normToParam(param, Math.max(0, Math.min(1, db / 60 + 0.5)));
      }
      return Math.max(min, Math.min(max, db));
    },
    getBandParamNames: (n) => ({
      on: [`band ${n} used`, `band ${n} enabled`],
      type: [`band ${n} shape`],
      freq: [`band ${n} frequency`],
      gain: [`band ${n} gain`],
      q: [`band ${n} q`],
    }),
  },
  {
    id: "ableton_eq_three",
    label: "EQ Three",
    bandCount: 3,
    matchDevice: (name) => name === "eq three" || name.includes("eq three"),
    freqToNorm: hzToEqNorm,
    normToFreq: eqNormToHz,
    gainParamToDb: (_param, raw) => {
      const db = abletonVolToDb(Number(raw) || 0);
      return Number.isFinite(db) ? Math.max(-18, Math.min(6, db)) : -18;
    },
    dbToGainParam: (_param, db) => dbToAbletonVol(Math.max(-18, Math.min(6, db))),
    getBandParamNames: (n) => {
      if (n === 1) return { on: ["lowon", "low on"], type: [], freq: ["freqlo", "freq lo"], gain: ["gainlo", "gain lo", "low gain"], q: [] };
      if (n === 2) return { on: ["midon", "mid on"], type: [], freq: [], gain: ["gainmid", "gain mid", "mid gain"], q: [] };
      return { on: ["highon", "high on"], type: [], freq: ["freqhi", "freq hi"], gain: ["gainhi", "gain hi", "high gain"], q: [] };
    },
  },
];

// =========================================================================
// DYNAMICS / COMPRESSOR ADAPTERS (Detección rápida + Sidechain badge)
// =========================================================================
// =========================================================================
// DYNAMICS / COMPRESSOR ADAPTERS (Detección rápida + Sidechain + Ducking)
// =========================================================================
export const DYNAMICS_ADAPTERS = [
  {
    id: "ableton_compressor",
    label: "Compressor",
    matchDevice: (name) => name === "compressor" || (name.includes("compressor") && !name.includes("glue") && !name.includes("multiband")),
    sidechainNames: ["s/c on", "sidechain", "s/c listen", "external"],
    thresholdNames: ["threshold"],
    ratioNames: ["ratio"],
    gainNames: ["output gain", "gain"],
  },
  {
    id: "ableton_glue_comp",
    label: "Glue Compressor",
    matchDevice: (name) => name.includes("glue compressor"),
    sidechainNames: ["s/c on", "sidechain", "external"],
    thresholdNames: ["threshold"],
    ratioNames: ["ratio"],
    gainNames: ["makeup", "output gain"],
  },
  {
    id: "fabfilter_pro_c",
    label: "FabFilter Pro-C",
    matchDevice: (name) => name.includes("pro-c") || name.includes("pro c"),
    sidechainNames: ["side chain", "sidechain", "ext"],
    thresholdNames: ["threshold"],
    ratioNames: ["ratio"],
    gainNames: ["output level", "gain"],
  },
  {
    id: "ableton_multiband",
    label: "Multiband Dynamics",
    matchDevice: (name) => name.includes("multiband"),
    sidechainNames: [],
    thresholdNames: [],
    ratioNames: [],
    gainNames: ["output"],
  },
  {
    id: "generic_limiter",
    label: "Limiter",
    matchDevice: (name) => name.includes("limiter") || name.includes("pro-l"),
    sidechainNames: [],
    thresholdNames: ["ceiling", "gain"],
    ratioNames: [],
    gainNames: ["gain"],
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

function findParamByNames(params, candidates = []) {
  const list = Array.isArray(candidates) ? candidates : [candidates];
  for (const cand of list) {
    if (!cand) continue;
    const hit = params.find((p) => (p.raw?.name || "").toLowerCase().trim() === cand);
    if (hit) return hit;
  }
  for (const cand of list) {
    if (!cand) continue;
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
  const fetches = [];
  if (typeof min !== "number") {
    fetches.push(param.get("min").then((v) => { min = v; }).catch(() => { min = 0; }));
  }
  if (typeof max !== "number") {
    fetches.push(param.get("max").then((v) => { max = v; }).catch(() => { max = 1; }));
  }
  if (fetches.length > 0) await Promise.all(fetches);

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

    const [decayParam, predelayParam] = await Promise.all([
      hydrateParamBounds(findParamByNames(params, adapter.decayNames)),
      hydrateParamBounds(findParamByNames(params, adapter.predelayNames)),
    ]);

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

// Detección rápida en scanAll() sin bajar todos los parámetros de EQ todavía
export async function findTrackEqDevice(track, cachedDevices = null) {
  if (!track) return null;
  let devices = cachedDevices;
  if (!devices) {
    try {
      devices = await track.get("devices");
    } catch {
      return null;
    }
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

// Detección rápida de Compresor / Dinámica / Sidechain para badges en la lista de pistas
// Detección rápida de Compresor / Dinámica / Sidechain para badges y Ducking
export async function findTrackDynamicsDevice(track, cachedDevices = null) {
  if (!track) return null;
  let devices = cachedDevices;
  if (!devices) {
    try {
      devices = await track.get("devices");
    } catch {
      return null;
    }
  }

  for (const dev of devices) {
    const rawName = (dev.raw?.name || "").trim();
    const lowerName = rawName.toLowerCase();
    const adapter = DYNAMICS_ADAPTERS.find((a) => a.matchDevice(lowerName));
    if (!adapter) continue;

    let hasSidechain = false;
    if (adapter.sidechainNames?.length) {
      try {
        const params = await dev.get("parameters");
        const scParam = findParamByNames(params, adapter.sidechainNames);
        if (scParam) {
          const val = await scParam.get("value");
          hasSidechain = Boolean(val >= 0.5);
        }
      } catch {}
    }

    return {
      device: dev,
      deviceName: rawName,
      adapter,
      adapterName: adapter.label,
      hasSidechain,
      canDuck: Boolean(adapter.thresholdNames?.length),
    };
  }
  return null;
}

// Binding on-demand de Compressor/Dinámica para aplicar Ducking desde Priorizar
export async function bindDynamicsDevice(device, adapter) {
  if (!device || !adapter) return null;
  let params = [];
  try {
    params = await device.get("parameters");
  } catch {
    return null;
  }

  const [thresholdParam, ratioParam, gainParam, sidechainParam] = await Promise.all([
    hydrateParamBounds(findParamByNames(params, adapter.thresholdNames)),
    hydrateParamBounds(findParamByNames(params, adapter.ratioNames)),
    hydrateParamBounds(findParamByNames(params, adapter.gainNames)),
    hydrateParamBounds(findParamByNames(params, adapter.sidechainNames)),
  ]);

  return {
    device,
    adapter,
    thresholdParam,
    ratioParam,
    gainParam,
    sidechainParam,
  };
}

// Binding completo on-demand (paralelo para máxima velocidad)
export async function bindEqDevice(device, adapter) {
  if (!device || !adapter) return null;
  let params = [];
  try {
    params = await device.get("parameters");
  } catch {
    return null;
  }

  const bandNumbers = Array.from({ length: adapter.bandCount }, (_, i) => i + 1);
  const bands = await Promise.all(
    bandNumbers.map(async (n) => {
      const names = adapter.getBandParamNames(n);
      const onParam = findParamByNames(params, names.on);
      const typeParam = findParamByNames(params, names.type);
      const [freqParam, gainParam, qParam] = await Promise.all([
        hydrateParamBounds(findParamByNames(params, names.freq)),
        hydrateParamBounds(findParamByNames(params, names.gain)),
        hydrateParamBounds(findParamByNames(params, names.q)),
      ]);

      return {
        bandNum: n,
        onParam,
        typeParam,
        freqParam,
        gainParam,
        qParam,
      };
    })
  );

  const [outputGainParam, scaleParam] = await Promise.all([
    hydrateParamBounds(findParamByNames(params, ["output gain"])),
    hydrateParamBounds(findParamByNames(params, ["scale"])),
  ]);

  return {
    device,
    adapter,
    outputGainParam,
    scaleParam,
    bands,
  };
}