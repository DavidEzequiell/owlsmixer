// Motor Psicoacústico — v0.0.8
// Grounded en David Gibson ("The Art of Mixing" 4th Ed.), ITU-R BS.1770-4 (K-Weighting exacto),
// Glasberg & Moore (ERB), Terhardt / ITU-R BS.1387 (enmascaramiento asimétrico en Bark),
// BMLD (desenmascaramiento binaural) y DRR (relación Directo/Reverberante).

export const HALF_W = 5; // X: -5 (L) .. +5 (R)
export const HALF_H = 3; // Y: -3 (20Hz) .. +3 (20kHz)
export const HALF_D = 4; // Z: +4 (+6dB / LVL 1) .. -4 (-36dB / LVL 6)

export const DB_MIN = -36; // Pared trasera (VOL LVL 6)
export const DB_MAX = 6;   // Pared frontal (VOL LVL 1)
export const DB_SPAN = DB_MAX - DB_MIN; // 42 dB = 7 dB por cada uno de los 6 niveles

export const FREQ_MIN = 20;
export const FREQ_MAX = 20000;
export const BOX_VOLUME = (HALF_W * 2) * (HALF_H * 2) * (HALF_D * 2); // 480 u³

export const LUFS_TARGETS = {
  streaming: { label: "Streaming (-14 LUFS)", targetLufs: -14, spaceBudget: 0.62 },
  indie:     { label: "Indie / Alt Rock (-10 LUFS)", targetLufs: -10, spaceBudget: 0.78 },
  heavy:     { label: "Wall / Club (-8 LUFS)", targetLufs: -8, spaceBudget: 0.90 },
  acoustic:  { label: "Acoustic / Jazz (-16 LUFS)", targetLufs: -16, spaceBudget: 0.48 },
};

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// =========================================================================
// 1. CURVA EXACTA DE FADER DE ABLETON LIVE (Invertible 1:1)
//    0.85 = 0.0 dB | 1.0 = +6.0 dB | <0.85 = curva exponencial (47*log10)
// =========================================================================
export function abletonVolToDb(v) {
  if (v <= 0.0005) return -Infinity;
  if (v >= 0.85) return ((v - 0.85) / 0.15) * 6.0;
  return 47.0 * Math.log10(v / 0.85);
}

export function dbToAbletonVol(db) {
  if (!Number.isFinite(db) || db <= -70) return 0;
  if (db >= 0) return clamp(0.85 + (db / 6.0) * 0.15, 0.85, 1.0);
  return clamp(0.85 * Math.pow(10, db / 47.0), 0.0, 0.85);
}

// =========================================================================
// 2. ESCALA Z LOGARÍTMICA (6 Apparent Volume Levels de Gibson, Chart 12)
// =========================================================================
export function dbToZ(db) {
  const clampedDb = Number.isFinite(db) ? clamp(db, DB_MIN, DB_MAX) : DB_MIN;
  const norm = (clampedDb - DB_MIN) / DB_SPAN; // 0 (-36dB) .. 1 (+6dB)
  return -HALF_D + norm * (HALF_D * 2);
}

export function zToDb(z) {
  const norm = clamp((z + HALF_D) / (HALF_D * 2), 0, 1);
  return DB_MIN + norm * DB_SPAN;
}

export function volToZLog(vol) {
  return dbToZ(abletonVolToDb(vol));
}

export function zToVolLog(z) {
  const db = zToDb(z);
  if (db <= DB_MIN + 0.15) return 0; // En el borde trasero permite llevar a silencio
  return dbToAbletonVol(db);
}

export function getApparentVolumeLevel(db) {
  if (!Number.isFinite(db) || db < -29) return { lvl: 6, label: "LVL 6 · Subliminal" };
  if (db < -22) return { lvl: 5, label: "LVL 5 · Fondo / FX" };
  if (db < -15) return { lvl: 4, label: "LVL 4 · Camas / Pads" };
  if (db < -8)  return { lvl: 3, label: "LVL 3 · Base Rítmica" };
  if (db < -1)  return { lvl: 2, label: "LVL 2 · Lead / Frente" };
  return { lvl: 1, label: "LVL 1 · Extremo" };
}

// =========================================================================
// 3. ESCALA Y LOGARÍTMICA REAL EN HERTZ (20 Hz .. 20 kHz = 3 décadas)
// =========================================================================
export function freqToY(hz) {
  const f = clamp(hz, FREQ_MIN, FREQ_MAX);
  const norm = Math.log10(f / FREQ_MIN) / 3.0; // log10(20000/20) = 3
  return -HALF_H + norm * (HALF_H * 2);
}

export function yToFreq(y) {
  const norm = clamp((y + HALF_H) / (HALF_H * 2), 0, 1);
  return FREQ_MIN * Math.pow(10, norm * 3.0);
}

export function formatFreq(hz) {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz`;
  return `${Math.round(hz)} Hz`;
}

// =========================================================================
// 4. K-WEIGHTING EXACTO (ITU-R BS.1770-4) + ERB (Glasberg & Moore)
// =========================================================================
const KW_HS_F0 = 1681.974450955533;
const KW_HS_Q  = 0.7071752369554196;
const KW_HS_A  = Math.pow(10, 3.999843853973347 / 40); // sqrt(gain lineal +4 dB)
const KW_HP_F0 = 38.13547087602444;
const KW_HP_Q  = 0.5003270373238773;

// Magnitud analítica exacta de los 2 filtros en cascada de ITU-R BS.1770-4:
// Stage 1: High-Shelf (+4 dB @ 1681.97 Hz, efecto acústico de cabeza/oído externo)
// Stage 2: High-Pass RLB (38.14 Hz, atenuación sub-grave)
export function kWeightDb(hz) {
  const f = clamp(Number(hz) || 1000, 10, 22000);

  // Stage 1: High-Shelf analógico de 2do orden (DC = 0 dB, inf = +4 dB)
  const r1 = f / KW_HS_F0;
  const r1Sq = r1 * r1;
  const mid1 = (KW_HS_A / (KW_HS_Q * KW_HS_Q)) * r1Sq;
  const num1 = (1 - KW_HS_A * r1Sq) ** 2 + mid1;
  const den1 = (KW_HS_A - r1Sq) ** 2 + mid1;
  const mag1Sq = (KW_HS_A * KW_HS_A) * (num1 / den1);

  // Stage 2: High-Pass RLB de 2do orden
  const r2 = f / KW_HP_F0;
  const r2Sq = r2 * r2;
  const mag2Sq = (r2Sq * r2Sq) / ((1 - r2Sq) ** 2 + (r2 / KW_HP_Q) ** 2);

  return 10 * Math.log10(Math.max(1e-12, mag1Sq * mag2Sq));
}

// Ancho de banda rectangular equivalente (ERB en Hz, Glasberg & Moore 1990)
export function hzToErb(hz) {
  const f = clamp(Number(hz) || 1000, 20, 20000);
  return 24.7 * (0.00437 * f + 1.0);
}

// Conversión a Escala Bark de Zwicker (24 bandas críticas del oído humano)
export function hzToBark(hz) {
  const f = clamp(Number(hz) || 1000, 20, 20000);
  return 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan(Math.pow(f / 7500, 2));
}

// Estimación de relación Directo/Reverberante (DRR en dB) según Send A y Decay
export function directToReverbRatioDb(sendA = 0, reverbDecay = 0.45) {
  const wetGain = clamp(sendA, 0, 1) * (0.45 + clamp(reverbDecay, 0, 1) * 0.95);
  if (wetGain <= 0.005) return 30;
  return clamp(-20 * Math.log10(wetGain), -6, 30);
}

// Huella física de enmascaramiento por frecuencia (graves largos = esferas grandes; agudos = chicas)
export function freqMaskingFootprint(hz) {
  const f = clamp(hz, 30, 16000);
  const normF = Math.log10(f / 30) / Math.log10(16000 / 30); // 0..1
  return 1.58 - Math.pow(normF, 0.72) * 1.18; // ~1.58 (30Hz) .. ~0.40 (16kHz)
}

export function computePsychoRadius(item, { freqSizing = true, roleSizeFactor = 1.0, autoSize = true, lowCutScale = 1.0 } = {}) {
  const hz = yToFreq(item.y);
  const db = abletonVolToDb(item.vol);
  const clampedDb = Number.isFinite(db) ? clamp(db, DB_MIN, DB_MAX) : DB_MIN;

  const apparentDb = clamp(clampedDb + kWeightDb(hz) * 0.25, DB_MIN, DB_MAX + 3);
  const volFactor = 0.36 + ((apparentDb - DB_MIN) / (DB_SPAN + 3)) * 0.76;

  const physFootprint = freqSizing ? (freqMaskingFootprint(hz) * 0.75 + roleSizeFactor * 0.25) : 0.85;
  const manualScale = item.sizeScale ?? 1.0;
  const energyScale = autoSize ? (item.crestScale ?? 1.0) * clamp(lowCutScale, 0.58, 1.05) : 1.0;

  return clamp(volFactor * physFootprint * manualScale * energyScale, 0.18, 2.45);
}

// =========================================================================
// 5. ANALIZADOR DE ESPACIO 3D & ENMASCARAMIENTO ASIMÉTRICO (BARK + BMLD + DRR)
// =========================================================================
const ROLE_CARVE_PRIORITY = {
  lead_vox: 100,
  kick: 95,
  bass: 85,
  sub_808: 85,
  snare: 80,
  lead_gtr: 72,
  drums: 68,
  rhythm_gtr_l: 55,
  rhythm_gtr_r: 55,
  guitar: 55,
  piano_keys: 50,
  tom: 48,
  floor_tom: 48,
  backing_vox: 42,
  synth_pad: 38,
  hihat: 35,
  overhead: 35,
  bus: 30,
  other: 25,
};

export function pickSuggestedWinner(a, b) {
  const pa = ROLE_CARVE_PRIORITY[a.role] ?? 25;
  const pb = ROLE_CARVE_PRIORITY[b.role] ?? 25;
  if (pa !== pb) return pa > pb ? a : b;
  return (a.vol ?? 0) >= (b.vol ?? 0) ? a : b;
}

// Calcula cuánto alivio aporta un recorte Bell/Shelf ya hecho cerca del choque
function getCarveRelief(trackA, trackB, targetHz) {
  const targetBark = hzToBark(targetHz);
  let relief = 0;
  for (const t of [trackA, trackB]) {
    if (!Array.isArray(t.eqCuts)) continue;
    for (const cut of t.eqCuts) {
      if (cut.gainDb >= -0.5) continue;
      const distBark = Math.abs(hzToBark(cut.freqHz) - targetBark);
      if (distBark < 0.95) {
        const proximity = 1 - distBark / 0.95;
        relief += clamp((-cut.gainDb / 6.0) * proximity * 0.72, 0, 0.75);
      }
    }
  }
  return clamp(relief, 0, 0.78);
}

// Modelo direccional de enmascaramiento (Terhardt / BS.1387 + BMLD + DRR)
// Devuelve el margen de enmascaramiento en dB (> 0 indica degradación de claridad)
export function computeDirectionalMasking(masker, target, reverbDecay = 0.45) {
  const dBark = target.bark - masker.bark;
  const absBark = Math.abs(dBark);

  // Ancho espectral intrínseco de fuentes musicales (complejas vs puntuales)
  const isWideSource = masker.item.shape === "oblong" || target.item.shape === "oblong";
  const sourceBwBark = isWideSource ? 1.15 : 0.85;
  const effectiveBarkGap = Math.max(0, absBark - sourceBwBark);

  // Nivel SPL estimado en escucha de estudio (referencia 83 dB SPL @ 0 dBFS)
  const maskerSpl = clamp(83 + masker.db, 38, 92);

  // Pendiente de dispersión auditiva:
  // Upward spread (graves -> agudos): más plana y dependiente de nivel (Terhardt / BS.1387)
  // Downward spread (agudos -> graves): muy empinada (~27 dB/Bark)
  const isUpward = dBark >= 0;
  const slopeDbPerBark = isUpward
    ? clamp(24 + 230 / Math.max(masker.hz, 40) - 0.2 * maskerSpl, 6.5, 22.0)
    : 27.0;

  const freqAttenDb = effectiveBarkGap * slopeDbPerBark;

  // Desenmascaramiento binaural (BMLD): separar en pan libera hasta ~11.5 dB,
  // pero las colas de reverb difunden la localización estéreo (DRR)
  const panDiff = Math.abs((masker.item.pan ?? 0) - (target.item.pan ?? 0)); // 0..2
  const avgSend = ((masker.item.sendA || 0) + (target.item.sendA || 0)) * 0.5;
  const reverbBlur = clamp(avgSend * (0.65 + reverbDecay * 0.75), 0, 0.85);
  const effectivePanSep = clamp(panDiff * 0.5, 0, 1) * (1 - reverbBlur * 0.65);

  const bmldFreqFactor = target.hz < 1500 ? 1.12 : 0.92;
  const bmldReleaseDb = effectivePanSep * 11.0 * bmldFreqFactor;

  // Margen de claridad (+6 dB): si la excitación del masker entra a menos de 6 dB del target, empieza el eclipse
  const effectiveMaskerDb = masker.apparentDb - freqAttenDb - bmldReleaseDb;
  const maskingDb = effectiveMaskerDb - target.apparentDb + 6.0;

  return {
    maskingDb,
    isUpward: isUpward && absBark > 0.45,
    reverbBlur,
    bmldReleaseDb,
  };
}

// Plan agnóstico de recorte quirúrgico calibrado con ERB de Glasberg & Moore
export function computeCarvePlan(winner, loser, collision) {
  const winnerHz = yToFreq(winner.y);
  const avgHz = collision?.avgHz || Math.sqrt(winnerHz * yToFreq(loser.y));
  const freqHz = Math.round(clamp(Math.sqrt(winnerHz * avgHz), 40, 14000));
  const isLow = freqHz < 250;

  // Q proporcional a la selectividad coclear (f / ERB(f)), mapeada al rango musical de EQ Eight (0..1)
  const erbRatio = freqHz / hzToErb(freqHz); // ~2.5 en graves .. ~9 en agudos
  const q = Number(clamp(0.46 + erbRatio * 0.022 + (isLow ? 0.06 : 0), 0.48, 0.70).toFixed(2));

  // Atenuación proporcional al enmascaramiento detectado (entre -2.0 y -4.5 dB)
  const maskDb = collision?.maskingDb ?? 4.5;
  const baseCut = isLow ? 3.0 : 2.2;
  const dynamicExtra = clamp((maskDb - 2.0) * 0.22, 0, 1.5);
  const gainDb = -Number(clamp(baseCut + dynamicExtra, 2.0, 4.5).toFixed(1));

  return { freqHz, gainDb, q, isLow };
}

export function analyzeMixSpace(tracks, orbsMap, reverbDecay = 0.45, lufsTargetKey = "indie") {
  const targetCfg = LUFS_TARGETS[lufsTargetKey] || LUFS_TARGETS.indie;
  const anySolo = tracks.some((t) => t.solo);

  // Solo pistas audibles, visibles y que no sean Buses (para no contar doble)
  const active = [];
  let totalGeoVol = 0;
  let lowEndGeoVol = 0;

  // Energía perceptual acumulada por 4 bandas estándar (Low, Low-Mid, High-Mid, High)
  const bandEnergy = { low: 0, lowMid: 0, highMid: 0, high: 0 };
  const lowEndStereoWarnings = [];

  for (const t of tracks) {
    if (t.isGroup || t.hidden) continue;
    const isSilent = t.mute || (anySolo && !t.solo) || t.vol <= 0.01;
    if (isSilent) continue;

    const orb = orbsMap.get(t.id);
    if (!orb || !orb.group.visible) continue;

    const pos = orb.mesh.position;
    const rx = orb.mesh.scale.x;
    const ry = orb.mesh.scale.y;
    const rz = orb.mesh.scale.z;
    const hz = yToFreq(t.y);
    const db = abletonVolToDb(t.vol);
    const clampedDb = Number.isFinite(db) ? clamp(db, DB_MIN, DB_MAX) : DB_MIN;
    const apparentDb = clampedDb + kWeightDb(hz) * 0.35;
    const bark = hzToBark(hz);

    // Volumen de elipsoide = (4/3) * pi * rx * ry * rz
    const sphereVol = (4 / 3) * Math.PI * rx * ry * rz;
    // La reverb (Visual 36, p. 54) ocupa espacio real adicional en la caja según DRR
    const reverbVol = t.sendA > 0.04 ? sphereVol * t.sendA * (0.65 + reverbDecay * 0.85) : 0;
    const itemVol = sphereVol + reverbVol;

    totalGeoVol += itemVol;
    if (hz < 250) lowEndGeoVol += itemVol;

    // Acumular balance espectral ponderado por potencia aparente
    const energy = Math.pow(10, apparentDb / 10);
    if (hz < 250) bandEnergy.low += energy;
    else if (hz < 1000) bandEnergy.lowMid += energy;
    else if (hz < 5000) bandEnergy.highMid += energy;
    else bandEnergy.high += energy;

    // Chequeo de compatibilidad mono en sub-graves (<150 Hz fuera del centro)
    if (hz < 150 && Math.abs(t.pan ?? 0) > 0.22 && clampedDb > -24) {
      lowEndStereoWarnings.push({
        id: t.id,
        name: t.name,
        hz,
        pan: t.pan ?? 0,
        db: clampedDb,
      });
    }

    active.push({ item: t, pos, rx, ry, rz, hz, db: clampedDb, apparentDb, bark });
  }

  // Ocupación relativa al presupuesto geométrico del target de LUFS elegido
  const usableBudget = BOX_VOLUME * 0.24 * (targetCfg.spaceBudget / 0.78);
  const occupancyPct = Math.round(clamp((totalGeoVol / usableBudget) * 100, 0, 140));
  const lowEndPct = totalGeoVol > 0 ? Math.round((lowEndGeoVol / totalGeoVol) * 100) : 0;

  const totalEnergy = bandEnergy.low + bandEnergy.lowMid + bandEnergy.highMid + bandEnergy.high;
  const spectralBalance = totalEnergy > 0
    ? {
        low: Math.round((bandEnergy.low / totalEnergy) * 100),
        lowMid: Math.round((bandEnergy.lowMid / totalEnergy) * 100),
        highMid: Math.round((bandEnergy.highMid / totalEnergy) * 100),
        high: Math.round((bandEnergy.high / totalEnergy) * 100),
      }
    : { low: 0, lowMid: 0, highMid: 0, high: 0 };

  let densityZone = "Sparse";
  let densityClass = "zone-sparse";
  if (occupancyPct >= 85) {
    densityZone = "Mudd City!";
    densityClass = "zone-mudd";
  } else if (occupancyPct >= 55) {
    densityZone = "Wall of Sound";
    densityClass = "zone-wall";
  } else if (occupancyPct >= 22) {
    densityZone = "Balanced";
    densityClass = "zone-balanced";
  }

  // Detector de Enmascaramiento Psicoacústico Direccional + Geometría 3D ("Solar Eclipse")
  const collisions = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      const mAB = computeDirectionalMasking(a, b, reverbDecay);
      const mBA = computeDirectionalMasking(b, a, reverbDecay);

      const aIsMasker = mAB.maskingDb >= mBA.maskingDb;
      const dominant = aIsMasker ? mAB : mBA;
      const secondary = aIsMasker ? mBA : mAB;

      if (dominant.maskingDb <= 0.5) continue;

      // Solapamiento geométrico 3D normalizado (refleja tamaño visual / crest / reverb)
      const dx = (a.pos.x - b.pos.x) / Math.max(0.1, a.rx + b.rx);
      const dyGeo = Math.abs(a.pos.y - b.pos.y) / Math.max(0.1, a.ry + b.ry);
      const dz = (a.pos.z - b.pos.z) / Math.max(0.1, a.rz + b.rz);
      const normDist = Math.sqrt(dx * dx + dyGeo * dyGeo + dz * dz);
      const geoOverlap = normDist < 0.85 ? 1 - normDist / 0.85 : 0;

      const avgHz = Math.sqrt(a.hz * b.hz);
      const isLowMud = a.hz < 380 && b.hz < 380;
      const isReverbMud = dominant.reverbBlur >= 0.35 && Math.abs((a.item.pan ?? 0) - (b.item.pan ?? 0)) > 0.35;
      const relief = getCarveRelief(a.item, b.item, avgHz);

      const psychoSev = clamp(dominant.maskingDb / 13.5, 0, 1);
      const combinedSev = psychoSev * 0.80 + geoOverlap * 0.20;
      const severity = clamp(combinedSev * (isLowMud ? 1.18 : 1.0) * (1 - relief), 0, 1);

      if (severity >= 0.28) {
        const suggested = pickSuggestedWinner(a.item, b.item);
        const masker = aIsMasker ? a.item : b.item;
        const masked = aIsMasker ? b.item : a.item;
        const isMutual = Math.abs(dominant.maskingDb - secondary.maskingDb) < 2.2;

        collisions.push({
          a: a.item,
          b: b.item,
          maskerId: masker.id,
          maskedId: masked.id,
          isMutual,
          suggestedWinnerId: suggested.id,
          severity,
          maskingDb: Number(dominant.maskingDb.toFixed(1)),
          overlapPct: Math.round(severity * 100),
          avgHz,
          isLowMud,
          isUpward: dominant.isUpward,
          isReverbMud,
          posA: a.pos.clone(),
          posB: b.pos.clone(),
        });
      }
    }
  }

  collisions.sort((x, y) => y.severity - x.severity);

  return {
    occupancyPct,
    lowEndPct,
    spectralBalance,
    lowEndStereoWarnings,
    densityZone,
    densityClass,
    activeCount: active.length,
    collisions: collisions.slice(0, 6),
  };
}

// =========================================================================
// 6. ESTIMADOR SHORT-TERM LUFS (Ventana 3s desde Master Meter de Ableton)
// =========================================================================
export class MasterLoudnessTracker {
  constructor(windowMs = 3000) {
    this.windowMs = windowMs;
    this.samples = []; // [{ t, p }]
    this.peakDb = -Infinity;
    this.lastPeakTime = 0;
    this.shortTermLufs = -Infinity;
    this.clipping = false;
  }

  pushMeter(left01, right01) {
    const now = performance.now();
    const l = Math.max(0, left01 || 0);
    const r = Math.max(0, right01 || 0);

    // Peak & Clipping: toma el canal más alto (0.85 ≈ 0 dBFS en output_meter de Live)
    const peakLinear = Math.max(l, r);
    const instPeakDb = abletonVolToDb(peakLinear);

    // Energía estéreo real (promedio de potencia L y R; evita sesgo de +3 dB en panes extremos)
    const dbL = abletonVolToDb(l);
    const dbR = abletonVolToDb(r);
    const pL = Number.isFinite(dbL) && dbL > -70 ? Math.pow(10, dbL / 10) : 0;
    const pR = Number.isFinite(dbR) && dbR > -70 ? Math.pow(10, dbR / 10) : 0;
    const stereoPower = (pL + pR) * 0.5;

    this.samples.push({ t: now, p: stereoPower });
    const cutoff = now - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }

    if (instPeakDb >= this.peakDb || now - this.lastPeakTime > 1800) {
      this.peakDb = instPeakDb;
      this.lastPeakTime = now;
    }
    this.clipping = instPeakDb >= -0.3;

    if (this.samples.length > 0) {
      let sumP = 0;
      for (let i = 0; i < this.samples.length; i++) sumP += this.samples[i].p;
      const avgP = sumP / this.samples.length;
      // Calibración BS.1770 (-0.691 dB) + compensación típica de balística peak-meter -> Short-Term LUFS (-2.2 dB)
      this.shortTermLufs = avgP > 1e-8 ? 10 * Math.log10(avgP) - 2.9 : -Infinity;
    } else {
      this.shortTermLufs = -Infinity;
    }
  }

  reset() {
    this.samples = [];
    this.peakDb = -Infinity;
    this.shortTermLufs = -Infinity;
    this.clipping = false;
  }
}