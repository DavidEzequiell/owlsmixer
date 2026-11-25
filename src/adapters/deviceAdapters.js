// Patrón Adapter para plugins de Reverb en Return A.
// Para sumar un plugin nuevo a futuro (ej. FabFilter Pro-R 2, Valhalla VintageVerb),
// solo agregás una entrada en REVERB_ADAPTERS con el nombre real de sus parámetros en Ableton.
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

    const decayParam = findParamByNames(params, adapter.decayNames);
    const predelayParam = findParamByNames(params, adapter.predelayNames);

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

export function paramToNorm(param, val) {
  if (!param) return 0;
  const min = param.raw?.min ?? 0;
  const max = param.raw?.max ?? 1;
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

export function normToParam(param, norm01) {
  if (!param) return 0;
  const min = param.raw?.min ?? 0;
  const max = param.raw?.max ?? 1;
  return min + Math.max(0, Math.min(1, norm01)) * (max - min);
}