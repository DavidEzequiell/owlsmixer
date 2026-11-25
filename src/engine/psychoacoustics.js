// Motor Psicoacústico — US-08
// Grounded en David Gibson ("The Art of Mixing" 4th Ed.), ITU-R BS.1770 (K-Weighting / LUFS)
// y física de enmascaramiento por bandas críticas (ERB / longitud de onda).

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
// 4. K-WEIGHTING (ITU-R BS.1770) + RADIO DE ENMASCARAMIENTO (ERB / Mudd City)
// =========================================================================
export function kWeightDb(hz) {
  // Aproximación analítica de la curva K-Weighting + hipersensibilidad 2-5kHz (Gibson p. 92)
  if (hz < 40) return -5.5;
  if (hz < 100) return -5.5 + ((hz - 40) / 60) * 4.5; // -5.5 -> -1.0 dB
  if (hz < 1000) return -1.0 + ((hz - 100) / 900) * 1.5; // -1.0 -> +0.5 dB
  if (hz < 4000) return 0.5 + ((hz - 1000) / 3000) * 3.5; // +0.5 -> +4.0 dB (presencia)
  if (hz < 12000) return 4.0 - ((hz - 4000) / 8000) * 1.0; // +4.0 -> +3.0 dB
  return 2.5;
}

// Huella física de enmascaramiento por frecuencia (graves largos = esferas grandes; agudos = chicas)
export function freqMaskingFootprint(hz) {
  const f = clamp(hz, 30, 16000);
  const normF = Math.log10(f / 30) / Math.log10(16000 / 30); // 0..1
  return 1.58 - Math.pow(normF, 0.72) * 1.18; // ~1.58 (30Hz) .. ~0.40 (16kHz)
}

export function computePsychoRadius(item, { freqSizing = true, roleSizeFactor = 1.0 } = {}) {
  const hz = yToFreq(item.y);
  const db = abletonVolToDb(item.vol);
  const clampedDb = Number.isFinite(db) ? clamp(db, DB_MIN, DB_MAX) : DB_MIN;

  // Sonoridad aparente combinando nivel en dB + ponderación perceptual K-Weighting
  const apparentDb = clamp(clampedDb + kWeightDb(hz) * 0.25, DB_MIN, DB_MAX + 3);
  const volFactor = 0.36 + ((apparentDb - DB_MIN) / (DB_SPAN + 3)) * 0.76; // 0.36 .. 1.12

  // Huella de frecuencia física (mezclada suave con el roleSizeFactor de Gibson)
  const physFootprint = freqSizing ? (freqMaskingFootprint(hz) * 0.75 + roleSizeFactor * 0.25) : 0.85;
  const manualScale = item.sizeScale ?? 1.0;

  return clamp(volFactor * physFootprint * manualScale, 0.18, 2.25);
}

// =========================================================================
// 5. ANALIZADOR DE ESPACIO 3D & DETECTOR DE COLISIONES ("SOLAR ECLIPSE")
// =========================================================================
export function analyzeMixSpace(tracks, orbsMap, reverbDecay = 0.45, lufsTargetKey = "indie") {
  const targetCfg = LUFS_TARGETS[lufsTargetKey] || LUFS_TARGETS.indie;
  const anySolo = tracks.some((t) => t.solo);

  // Solo pistas audibles, visibles y que no sean Buses (para no contar doble!)
  const active = [];
  let totalGeoVol = 0;
  let lowEndGeoVol = 0;

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

    // Volumen de elipsoide = (4/3) * pi * rx * ry * rz
    const sphereVol = (4 / 3) * Math.PI * rx * ry * rz;
    // La reverb (Visual 36, p. 54) ocupa espacio real adicional en la caja
    const reverbVol = t.sendA > 0.04 ? sphereVol * t.sendA * (0.65 + reverbDecay * 0.85) : 0;
    const itemVol = sphereVol + reverbVol;

    totalGeoVol += itemVol;
    if (hz < 250) lowEndGeoVol += itemVol;

    active.push({ item: t, pos, rx, ry, rz, hz });
  }

  // Ocupación relativa al presupuesto geométrico del target de LUFS elegido
  const usableBudget = BOX_VOLUME * 0.24 * (targetCfg.spaceBudget / 0.78);
  const occupancyPct = Math.round(clamp((totalGeoVol / usableBudget) * 100, 0, 140));
  const lowEndPct = totalGeoVol > 0 ? Math.round((lowEndGeoVol / totalGeoVol) * 100) : 0;

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

  // Detector de Enmascaramiento / Colisiones 3D ("Solar Eclipse", Visual 23, p. 48)
  const collisions = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      // Distancia normalizada por radios de elipsoide en cada eje
      const dx = (a.pos.x - b.pos.x) / (a.rx + b.rx);
      const dy = (a.pos.y - b.pos.y) / (a.ry + b.ry);
      const dz = (a.pos.z - b.pos.z) / (a.rz + b.rz);
      const normDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (normDist < 0.78) {
        // 0 = superpuestos exactos, 0.78 = rozándose
        const rawOverlap = 1 - normDist / 0.78;
        const avgHz = Math.sqrt(a.hz * b.hz);
        const isLowMud = avgHz < 380;
        // Enmascaramiento grave/Oohzone pesa 1.25x más (Gibson p. 49)
        const severity = clamp(rawOverlap * (isLowMud ? 1.25 : 0.95), 0, 1);

        if (severity >= 0.28) {
          collisions.push({
            a: a.item,
            b: b.item,
            severity,
            overlapPct: Math.round(severity * 100),
            avgHz,
            isLowMud,
            posA: a.pos.clone(),
            posB: b.pos.clone(),
          });
        }
      }
    }
  }

  collisions.sort((x, y) => y.severity - x.severity);

  return {
    occupancyPct,
    lowEndPct,
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
    this.samples = []; // [{ t, energy }]
    this.peakDb = -Infinity;
    this.lastPeakTime = 0;
    this.shortTermLufs = -Infinity;
    this.clipping = false;
  }

  pushMeter(left01, right01) {
    const now = performance.now();
    const peakLinear = Math.max(left01 || 0, right01 || 0);
    // En Live, output_meter ≈ 0.85 corresponde a 0 dBFS; > 0.92 es zona roja/clip
    const instDb = abletonVolToDb(peakLinear);
    const linearPower = Number.isFinite(instDb) ? Math.pow(10, instDb / 10) : 0;

    this.samples.push({ t: now, p: linearPower });
    const cutoff = now - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }

    if (instDb >= this.peakDb || now - this.lastPeakTime > 1800) {
      this.peakDb = instDb;
      this.lastPeakTime = now;
    }
    this.clipping = instDb >= -0.3;

    if (this.samples.length > 0) {
      const avgP = this.samples.reduce((acc, s) => acc + s.p, 0) / this.samples.length;
      // Offset aproximado peak-meter -> Short-Term LUFS (-3 dB factor cresta típico)
      this.shortTermLufs = avgP > 1e-8 ? 10 * Math.log10(avgP) - 2.5 : -Infinity;
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