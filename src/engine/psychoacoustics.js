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
// 1B. CURVA DEL VÚMETRO VISUAL DE ABLETON LIVE (output_meter_left/right)
//     A diferencia del fader (0.85 = 0 dB), el vúmetro de Live ubica
//     0 dBFS en ~0.92, -6 dBFS en ~0.85 y +6 dBFS en 1.00.
// =========================================================================
const ABLETON_METER_TABLE = [
  [0.00, -70],
  [0.10, -64],
  [0.20, -56],
  [0.35, -45],
  [0.50, -34],
  [0.64, -23],
  [0.72, -16],
  [0.78, -12],
  [0.85,  -6],
  [0.92,   0],
  [1.00,   6],
];

export function abletonMeterToDb(m) {
  const v = clamp(Number(m) || 0, 0, 1);
  if (v <= 0.0005) return -Infinity;
  for (let i = 1; i < ABLETON_METER_TABLE.length; i++) {
    const [m0, db0] = ABLETON_METER_TABLE[i - 1];
    const [m1, db1] = ABLETON_METER_TABLE[i];
    if (v <= m1) {
      const t = (v - m0) / (m1 - m0);
      return db0 + t * (db1 - db0);
    }
  }
  return 6;
}

export function dbToAbletonMeter(db) {
  if (!Number.isFinite(db) || db <= -70) return 0;
  if (db >= 6) return 1;
  for (let i = 1; i < ABLETON_METER_TABLE.length; i++) {
    const [m0, db0] = ABLETON_METER_TABLE[i - 1];
    const [m1, db1] = ABLETON_METER_TABLE[i];
    if (db <= db1) {
      const t = (db - db0) / (db1 - db0);
      return clamp(m0 + t * (m1 - m0), 0, 1);
    }
  }
  return 1;
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
// 2B. TRUE DEPTH (Eje Z compuesto: Volumen + Reverb/DRR, 100% bidireccional)
// =========================================================================
export function computeTrueDepthZ(vol, sendA = 0, reverbDecay = 0.45) {
  const volZ = volToZLog(vol);
  const decayFactor = 0.65 + clamp(reverbDecay, 0, 1) * 0.70;
  const revPush = clamp(sendA, 0, 1) * 2.4 * decayFactor;
  return clamp(volZ - revPush, -HALF_D, HALF_D);
}

// Inversa exacta para arrastrar en Z en modo True Depth sin saltos ni desfasajes
export function solveTrueDepthDrag(startVol, startSendA, dz, reverbDecay = 0.45) {
  const decayFactor = 0.65 + clamp(reverbDecay, 0, 1) * 0.70;
  const kRev = 2.4 * decayFactor;
  const startVolZ = volToZLog(startVol);
  const startZ = clamp(startVolZ - clamp(startSendA, 0, 1) * kRev, -HALF_D, HALF_D);
  const targetZ = clamp(startZ + dz, -HALF_D, HALF_D);
  const effectiveDz = targetZ - startZ;

  // 28% del desplazamiento en Z lo absorbe la reverb (DRR) y el resto el nivel directo
  const desiredSendA = clamp(startSendA - (effectiveDz * 0.28) / kRev, 0, 1);
  const neededVolZ = clamp(targetZ + desiredSendA * kRev, -HALF_D, HALF_D);
  const nextVol = zToVolLog(neededVolZ);

  const actualVolZ = volToZLog(nextVol);
  const finalSendA = Math.abs(actualVolZ - neededVolZ) > 0.01
    ? clamp((actualVolZ - targetZ) / kRev, 0, 1)
    : desiredSendA;

  return {
    vol: nextVol,
    sendA: finalSendA,
    z: computeTrueDepthZ(nextVol, finalSendA, reverbDecay),
  };
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
  const volFactor = 0.32 + ((apparentDb - DB_MIN) / (DB_SPAN + 3)) * 0.64;

  const physFootprint = freqSizing ? (freqMaskingFootprint(hz) * 0.75 + roleSizeFactor * 0.25) : 0.80;
  const manualScale = item.sizeScale ?? 1.0;

  // Reducción real de huella física cuando se esculpe con EQ carving o ducking
  let carveCutDb = 0;
  if (Array.isArray(item.eqCuts)) {
    for (const c of item.eqCuts) {
      if (c.gainDb < -0.5) carveCutDb += Math.min(6.5, -c.gainDb);
    }
  }
  carveCutDb += (item.dynamics?.duckSteps || 0) * (item.dynamics?.hasSidechain ? 2.0 : 1.0);
  const carveScale = clamp(1 - carveCutDb * 0.015, 0.80, 1.0);

  const energyScale = autoSize ? (item.crestScale ?? 1.0) * clamp(lowCutScale, 0.60, 1.05) : 1.0;

  return clamp(volFactor * physFootprint * manualScale * energyScale * carveScale, 0.18, 1.65);
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
// Calcula cuánto alivio real en dB aportan recortes EQ o ducking ya hechos cerca del choque
function getCarveRelief(trackA, trackB, targetHz) {
  const targetBark = hzToBark(targetHz);
  let reliefDb = 0;
  const appliedCuts = [];

  for (const t of [trackA, trackB]) {
    if (Array.isArray(t.eqCuts)) {
      for (const cut of t.eqCuts) {
        if (cut.gainDb >= -0.5) continue;
        const distBark = Math.abs(hzToBark(cut.freqHz) - targetBark);
        if (distBark < 1.15) {
          const proximity = 1 - distBark / 1.15;
          const contrib = clamp(-cut.gainDb * proximity * 0.88, 0, 5.5);
          reliefDb += contrib;
          appliedCuts.push({
            trackId: t.id,
            trackName: t.name,
            freqHz: Math.round(cut.freqHz),
            gainDb: Number(cut.gainDb.toFixed(1)),
          });
        }
      }
    }

    const duckSteps = t.dynamics?.duckSteps || 0;
    if (duckSteps > 0) {
      const perStep = t.dynamics?.hasSidechain ? 2.2 : 1.15;
      reliefDb += clamp(duckSteps * perStep, 0, 5.0);
      appliedCuts.push({
        trackId: t.id,
        trackName: t.name,
        isDuck: true,
        hasSidechain: Boolean(t.dynamics?.hasSidechain),
        steps: duckSteps,
      });
    }
  }

  return {
    reliefDb: clamp(reliefDb, 0, 7.5),
    appliedCuts,
  };
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

  // Desenmascaramiento binaural (BMLD): separar en pan libera hasta ~12 dB,
  // pero las colas de reverb difunden la localización estéreo (DRR)
  const panDiff = Math.abs((masker.item.pan ?? 0) - (target.item.pan ?? 0)); // 0..2
  const avgSend = ((masker.item.sendA || 0) + (target.item.sendA || 0)) * 0.5;
  const reverbBlur = clamp(avgSend * (0.65 + reverbDecay * 0.75), 0, 0.85);
  const effectivePanSep = clamp(panDiff * 0.5, 0, 1) * (1 - reverbBlur * 0.65);

  const bmldFreqFactor = target.hz < 1500 ? 1.15 : 0.95;
  const bmldReleaseDb = effectivePanSep * 12.0 * bmldFreqFactor;

  // Evitar falsos positivos gigantes contra pistas dejadas intencionalmente de fondo (LVL 4-6)
  const rawLevelDiff = masker.apparentDb - target.apparentDb;
  const cappedLevelDiff = clamp(rawLevelDiff, -8.0, 9.5);
  const targetBgFactor = target.db < -13 ? clamp((target.db + 28) / 15, 0.22, 1.0) : 1.0;

  // Margen de claridad (+5.5 dB) escalado por relevancia de plano
  const rawMaskingDb = cappedLevelDiff - freqAttenDb - bmldReleaseDb + 5.5;
  const maskingDb = rawMaskingDb > 0 ? rawMaskingDb * targetBgFactor : rawMaskingDb;

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
    if (t.isGroup || t.hidden || t._isSilentHidden) continue;
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
      const { reliefDb, appliedCuts } = getCarveRelief(a.item, b.item, avgHz);

      const effectiveMaskingDb = Math.max(0, dominant.maskingDb - reliefDb);
      if (effectiveMaskingDb <= 0.4) continue;

      const reliefFactor = dominant.maskingDb > 0 ? clamp(effectiveMaskingDb / dominant.maskingDb, 0.15, 1) : 1;
      const psychoSev = clamp(effectiveMaskingDb / 13.0, 0, 1);
      const combinedSev = psychoSev * 0.82 + geoOverlap * 0.18 * reliefFactor;
      const severity = clamp(combinedSev * (isLowMud ? 1.15 : 1.0), 0, 1);

      if (severity >= 0.26) {
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
          rawMaskingDb: Number(dominant.maskingDb.toFixed(1)),
          maskingDb: Number(effectiveMaskingDb.toFixed(1)),
          reliefDb: Number(reliefDb.toFixed(1)),
          appliedCuts,
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
// =========================================================================
// 6. ESTIMADOR SHORT-TERM LUFS (Ventana 3s desde Master Meter de Ableton)
//    Nota: Sin PCM, estima LUFS a partir de la envolvente del vúmetro de Live.
// =========================================================================
export class MasterLoudnessTracker {
  constructor(windowMs = 3000) {
    this.windowMs = windowMs;
    this.samples = []; // [{ t, p, peakDb }]
    this.peakDb = -Infinity;
    this.lastPeakTime = 0;
    this.shortTermLufs = -Infinity;
    this.clipping = false;
    this.clipHoldUntil = 0;
    this.rawMeterMax = 0;
    this.crestEstimateDb = 0;
  }

  pushMeter(left01, right01) {
    const now = performance.now();
    const l = clamp(Number(left01) || 0, 0, 1);
    const r = clamp(Number(right01) || 0, 0, 1);

    const peakMeter = Math.max(l, r);
    this.rawMeterMax = peakMeter;
    const instPeakDb = abletonMeterToDb(peakMeter);

    // Energía estéreo promedio L/R calibrada a la escala real del vúmetro
    const dbL = abletonMeterToDb(l);
    const dbR = abletonMeterToDb(r);
    const pL = Number.isFinite(dbL) && dbL > -68 ? Math.pow(10, dbL / 10) : 0;
    const pR = Number.isFinite(dbR) && dbR > -68 ? Math.pow(10, dbR / 10) : 0;
    const stereoPower = (pL + pR) * 0.5;

    this.samples.push({ t: now, p: stereoPower, peakDb: instPeakDb });
    const cutoff = now - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }

    if (instPeakDb >= this.peakDb || now - this.lastPeakTime > 1800) {
      this.peakDb = instPeakDb;
      this.lastPeakTime = now;
    }

    // Clipping real: 0 dBFS corresponde a ~0.92 en el vúmetro de Live (hold 1.2 s)
    if (instPeakDb >= -0.15) {
      this.clipHoldUntil = now + 1200;
    }
    this.clipping = now < this.clipHoldUntil;

    if (this.samples.length > 0) {
      let sumP = 0;
      let winMaxDb = -Infinity;
      for (let i = 0; i < this.samples.length; i++) {
        sumP += this.samples[i].p;
        if (this.samples[i].peakDb > winMaxDb) winMaxDb = this.samples[i].peakDb;
      }
      const avgP = sumP / this.samples.length;
      if (avgP > 1e-7) {
        const avgEnvDb = 10 * Math.log10(avgP);
        // Compensación adaptativa: el output_meter de Live es peak-envelope suavizado,
        // queda ~2.8 a 5.2 dB arriba del Short-Term LUFS real según la dinámica de la mezcla.
        const envCrest = Number.isFinite(winMaxDb) ? clamp(winMaxDb - avgEnvDb, 0, 14) : 4;
        this.crestEstimateDb = Number(envCrest.toFixed(1));
        const envelopeToLufsOffset = clamp(2.8 + envCrest * 0.24, 2.8, 5.2);
        this.shortTermLufs = avgEnvDb - envelopeToLufsOffset;
      } else {
        this.shortTermLufs = -Infinity;
        this.crestEstimateDb = 0;
      }
    } else {
      this.shortTermLufs = -Infinity;
      this.crestEstimateDb = 0;
    }
  }

  reset() {
    this.samples = [];
    this.peakDb = -Infinity;
    this.lastPeakTime = 0;
    this.shortTermLufs = -Infinity;
    this.clipping = false;
    this.clipHoldUntil = 0;
    this.rawMeterMax = 0;
    this.crestEstimateDb = 0;
  }
}