// Presets calibrados con David Gibson — "The Art of Mixing" (4th Ed., 2026)
// Rango limpio de consola con headroom real en Ableton Live (cero clipping en Master):
//   Protagonistas / Frente:  -1.5 .. -2.5 dB
//   Base Rítmica / Drums:    -2.0 .. -3.8 dB
//   Rítmicas / Soporte:      -3.0 .. -5.2 dB
//   Planos medios:           -4.5 .. -7.5 dB
//   Camas / Pads / Fondo:    -7.0 .. -10.8 dB + Reverb Send A

import { dbToAbletonVol, abletonVolToDb, clamp } from "../engine/psychoacoustics.js";

const db = (val) => Number(dbToAbletonVol(val).toFixed(3));

export const PRESETS = {
  default_dry: {
    name: "Default / Neutro (Dry · 0 dB)",
    ref: "Estado inicial de Ableton",
    pdfPage: null,
    isDefaultDry: true,
    desc: "Resetea todas las pistas desbloqueadas al estado neutro de Ableton: Paneo Centro (C), Volumen 0.0 dB, Reverb 0%, EQ Eight apagado y forma Esfera 1.00x.",
    roles: {},
  },

  visual_g_alt_rock: {
    name: "Alternative Rock (Visual G)",
    ref: "Visual G · p. 8 (PDF p. 31)",
    pdfPage: 31,
    lufsTarget: "indie",
    desc: "Volúmenes parejos + Wall of Sound con headroom limpio. Lead Gtr al frente, voz integrada en el muro, camas atrás en reverb y low end firme.",
    reverb: { decay: 0.48, predelay: 0.25 },
    roles: {
      kick:         { pan:  0.00, vol: db(-2.5), sendA: 0.06, y: -2.35, shape: "sphere" },
      bass:         { pan: -0.04, vol: db(-2.2), sendA: 0.05, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.04, vol: db(-2.8), sendA: 0.34, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-2.8), sendA: 0.22, y: -0.90, shape: "sphere" },
      tom:          { pan: -0.28, vol: db(-5.2), sendA: 0.22, y: -0.75, shape: "sphere" },
      floor_tom:    { pan:  0.45, vol: db(-5.2), sendA: 0.22, y: -1.20, shape: "sphere" },
      hihat:        { pan: -0.65, vol: db(-6.5), sendA: 0.14, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: db(-6.2), sendA: 0.25, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-4.0), sendA: 0.32, y:  0.55, shape: "sphere" },
      backing_vox:  { pan: -0.50, vol: db(-7.8), sendA: 0.48, y:  1.35, shape: "oblong" },
      rhythm_gtr_l: { pan: -0.80, vol: db(-3.8), sendA: 0.26, y:  0.10, shape: "sphere" },
      rhythm_gtr_r: { pan:  0.82, vol: db(-3.8), sendA: 0.26, y:  0.16, shape: "sphere" },
      guitar:       { pan: -0.45, vol: db(-4.2), sendA: 0.28, y:  0.25, shape: "oblong" },
      lead_gtr:     { pan:  0.14, vol: db(-1.8), sendA: 0.32, y:  0.85, shape: "oblong" },
      piano_keys:   { pan:  0.00, vol: db(-7.0), sendA: 0.42, y:  0.65, shape: "oblong" },
      synth_pad:    { pan:  0.00, vol: db(-9.0), sendA: 0.55, y:  1.10, shape: "oblong" },
    }
  },

  owls_sonic_youth: {
    name: "Owls & Sticks — Sonic Youth / Diamond Sea",
    ref: "Wall of Sound · p. 206 (PDF p. 229)",
    pdfPage: 229,
    lufsTarget: "indie",
    desc: "Paredes de guitarras abiertas con overlap estéreo, bajo firme al centro, voz sumergida en textura y sintes/coros profundos en reverb.",
    reverb: { decay: 0.68, predelay: 0.30 },
    roles: {
      kick:         { pan:  0.00, vol: db(-2.8), sendA: 0.12, y: -2.35, shape: "sphere" },
      bass:         { pan:  0.00, vol: db(-2.0), sendA: 0.10, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.10, vol: db(-3.2), sendA: 0.38, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-3.2), sendA: 0.30, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.55, vol: db(-7.2), sendA: 0.24, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: db(-6.5), sendA: 0.42, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-4.8), sendA: 0.45, y:  0.55, shape: "sphere" },
      backing_vox:  { pan:  0.55, vol: db(-9.2), sendA: 0.72, y:  1.45, shape: "oblong" },
      rhythm_gtr_l: { pan: -0.88, vol: db(-2.6), sendA: 0.44, y:  0.15, shape: "oblong" },
      rhythm_gtr_r: { pan:  0.90, vol: db(-2.6), sendA: 0.48, y:  0.35, shape: "oblong" },
      guitar:       { pan: -0.68, vol: db(-3.5), sendA: 0.50, y:  0.25, shape: "oblong" },
      lead_gtr:     { pan:  0.48, vol: db(-3.0), sendA: 0.58, y:  1.15, shape: "sphere" },
      piano_keys:   { pan: -0.35, vol: db(-7.5), sendA: 0.60, y:  0.70, shape: "oblong" },
      synth_pad:    { pan:  0.00, vol: db(-8.0), sendA: 0.80, y:  1.15, shape: "oblong" },
    }
  },

  owls_lou_reed_dry: {
    name: "Owls & Sticks — Lou Reed Dry (105 BPM)",
    ref: "Maximum Presence · p. 220 (PDF p. 243)",
    pdfPage: 243,
    lufsTarget: "streaming",
    desc: "Voz principal ultra seca pegada a la cara, bajo protagonista, guitarra staccato seca al costado y susurros atrás en reverb.",
    reverb: { decay: 0.55, predelay: 0.42 },
    roles: {
      kick:         { pan:  0.00, vol: db(-2.8), sendA: 0.02, y: -2.35, shape: "sphere" },
      bass:         { pan:  0.00, vol: db(-2.2), sendA: 0.03, y: -1.95, shape: "sphere" },
      snare:        { pan:  0.05, vol: db(-3.5), sendA: 0.07, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-3.2), sendA: 0.06, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.40, vol: db(-7.5), sendA: 0.04, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: db(-7.5), sendA: 0.08, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-1.5), sendA: 0.03, y:  0.55, shape: "sphere" },
      backing_vox:  { pan:  0.00, vol: db(-10.0), sendA: 0.72, y:  1.50, shape: "oblong" },
      rhythm_gtr_l: { pan: -0.62, vol: db(-5.2), sendA: 0.08, y:  0.10, shape: "sphere" },
      rhythm_gtr_r: { pan:  0.65, vol: db(-5.2), sendA: 0.10, y:  0.16, shape: "sphere" },
      guitar:       { pan:  0.58, vol: db(-4.8), sendA: 0.08, y:  0.25, shape: "sphere" },
      lead_gtr:     { pan: -0.45, vol: db(-4.2), sendA: 0.16, y:  0.90, shape: "sphere" },
      synth_pad:    { pan:  0.00, vol: db(-10.8), sendA: 0.78, y:  1.10, shape: "oblong" },
    }
  },

  visual_e_heavy_metal: {
    name: "Heavy Metal (Visual E)",
    ref: "Visual E · p. 7 (PDF p. 30)",
    pdfPage: 30,
    lufsTarget: "heavy",
    desc: "Muro masivo y denso sin saturar el bus. Snare, Kick y Lead Guitar al frente, Hi-Hat presente, guitarras abiertas en estéreo y low end claro.",
    reverb: { decay: 0.38, predelay: 0.22 },
    roles: {
      kick:         { pan:  0.00, vol: db(-2.0), sendA: 0.04, y: -2.35, shape: "sphere" },
      bass:         { pan: -0.04, vol: db(-3.0), sendA: 0.03, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.05, vol: db(-2.0), sendA: 0.26, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-2.2), sendA: 0.18, y: -0.90, shape: "sphere" },
      tom:          { pan: -0.30, vol: db(-4.5), sendA: 0.20, y: -0.75, shape: "sphere" },
      floor_tom:    { pan:  0.50, vol: db(-4.5), sendA: 0.20, y: -1.20, shape: "sphere" },
      hihat:        { pan: -0.72, vol: db(-3.8), sendA: 0.08, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: db(-6.0), sendA: 0.16, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-2.4), sendA: 0.22, y:  0.55, shape: "sphere" },
      rhythm_gtr_l: { pan: -0.90, vol: db(-2.8), sendA: 0.14, y:  0.10, shape: "sphere" },
      rhythm_gtr_r: { pan:  0.90, vol: db(-2.8), sendA: 0.14, y:  0.16, shape: "sphere" },
      guitar:       { pan:  0.75, vol: db(-3.2), sendA: 0.15, y:  0.25, shape: "sphere" },
      lead_gtr:     { pan:  0.26, vol: db(-1.5), sendA: 0.24, y:  0.85, shape: "sphere" },
    }
  },

  visual_i_folk: {
    name: "Folk / Acoustic Clarity (Visual I)",
    ref: "Visual I · p. 9 (PDF p. 32)",
    pdfPage: 32,
    lufsTarget: "acoustic",
    desc: "Limpio, espacioso y casi sin efectos. Voz protagonista al frente, guitarras acústicas abiertas L/R y batería/bajo contenidos.",
    reverb: { decay: 0.28, predelay: 0.18 },
    roles: {
      kick:         { pan:  0.00, vol: db(-5.5), sendA: 0.02, y: -2.35, shape: "sphere" },
      bass:         { pan:  0.00, vol: db(-5.0), sendA: 0.02, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.18, vol: db(-6.8), sendA: 0.10, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-5.8), sendA: 0.08, y: -0.90, shape: "sphere" },
      tom:          { pan: -0.60, vol: db(-7.5), sendA: 0.08, y: -0.75, shape: "sphere" },
      floor_tom:    { pan:  0.45, vol: db(-7.5), sendA: 0.08, y: -1.20, shape: "sphere" },
      hihat:        { pan: -0.50, vol: db(-8.5), sendA: 0.04, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: db(-7.5), sendA: 0.08, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-1.5), sendA: 0.10, y:  0.55, shape: "sphere" },
      backing_vox:  { pan:  0.00, vol: db(-6.0), sendA: 0.16, y:  1.35, shape: "oblong" },
      rhythm_gtr_l: { pan: -0.88, vol: db(-3.2), sendA: 0.08, y:  0.20, shape: "sphere" },
      rhythm_gtr_r: { pan:  0.88, vol: db(-3.2), sendA: 0.08, y:  0.24, shape: "sphere" },
      guitar:       { pan: -0.78, vol: db(-3.5), sendA: 0.08, y:  0.25, shape: "sphere" },
    }
  },

  visual_b_blues: {
    name: "Blues Mix (Visual B)",
    ref: "Visual B · p. 6 (PDF p. 29)",
    pdfPage: 29,
    lufsTarget: "streaming",
    desc: "Limpio y al frente. Bajo grande, Lead Gtr derecha y Rítmica izquierda bien presentes, Snare contenido y Piano estéreo más atrás.",
    reverb: { decay: 0.35, predelay: 0.20 },
    roles: {
      kick:         { pan:  0.00, vol: db(-2.4), sendA: 0.05, y: -2.35, shape: "sphere" },
      bass:         { pan: -0.04, vol: db(-1.8), sendA: 0.04, y: -1.95, shape: "sphere" },
      snare:        { pan:  0.12, vol: db(-5.2), sendA: 0.22, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-3.8), sendA: 0.16, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.55, vol: db(-7.0), sendA: 0.12, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: db(-7.0), sendA: 0.16, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-3.2), sendA: 0.22, y:  0.55, shape: "sphere" },
      rhythm_gtr_l: { pan: -0.72, vol: db(-3.0), sendA: 0.18, y:  0.15, shape: "sphere" },
      guitar:       { pan: -0.70, vol: db(-3.0), sendA: 0.18, y:  0.20, shape: "sphere" },
      lead_gtr:     { pan:  0.38, vol: db(-2.0), sendA: 0.22, y:  0.75, shape: "sphere" },
      piano_keys:   { pan:  0.00, vol: db(-6.5), sendA: 0.34, y:  0.80, shape: "oblong" },
    }
  },

  visual_h_acoustic_jazz: {
    name: "Acoustic Jazz · Asymmetrical (Visual H)",
    ref: "Visual H · p. 9 (PDF p. 32)",
    pdfPage: 32,
    lufsTarget: "acoustic",
    desc: "Máxima claridad y escena asimétrica de club: Contrabajo a la derecha, Piano a la izquierda, Guitarra frente derecha y Hi-Hat/Ride abiertos.",
    reverb: { decay: 0.24, predelay: 0.15 },
    roles: {
      kick:         { pan: -0.32, vol: db(-4.2), sendA: 0.03, y: -2.35, shape: "sphere" },
      bass:         { pan:  0.30, vol: db(-2.4), sendA: 0.03, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.10, vol: db(-6.2), sendA: 0.05, y: -0.35, shape: "sphere" },
      drums:        { pan: -0.20, vol: db(-4.5), sendA: 0.06, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.78, vol: db(-3.5), sendA: 0.04, y:  2.25, shape: "sphere" },
      overhead:     { pan: -0.35, vol: db(-5.8), sendA: 0.08, y:  2.45, shape: "sphere" },
      piano_keys:   { pan: -0.60, vol: db(-2.5), sendA: 0.08, y:  0.40, shape: "sphere" },
      guitar:       { pan:  0.70, vol: db(-3.0), sendA: 0.08, y:  0.10, shape: "sphere" },
      lead_gtr:     { pan:  0.30, vol: db(-3.8), sendA: 0.10, y:  0.80, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-2.0), sendA: 0.10, y:  0.55, shape: "sphere" },
    }
  },

  visual_a_electronica: {
    name: "Electronica Mix (Visual A)",
    ref: "Visual A · p. 5 (PDF p. 28)",
    pdfPage: 28,
    lufsTarget: "heavy",
    desc: "808 Boom protagonista al frente con headroom limpio, Bass con ancho estéreo, Hi-Hat a la izquierda, Snare contenido y sintes arriba.",
    reverb: { decay: 0.62, predelay: 0.35 },
    roles: {
      sub_808:      { pan:  0.00, vol: db(-1.5), sendA: 0.02, y: -2.65, shape: "sphere" },
      kick:         { pan:  0.00, vol: db(-2.0), sendA: 0.04, y: -2.25, shape: "sphere" },
      bass:         { pan:  0.00, vol: db(-2.8), sendA: 0.08, y: -1.90, shape: "oblong" },
      snare:        { pan:  0.05, vol: db(-5.2), sendA: 0.28, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-3.0), sendA: 0.16, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.82, vol: db(-4.0), sendA: 0.16, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.72, vol: db(-6.5), sendA: 0.32, y:  2.45, shape: "sphere" },
      piano_keys:   { pan: -0.55, vol: db(-5.0), sendA: 0.38, y:  0.75, shape: "oblong" },
      synth_pad:    { pan:  0.00, vol: db(-4.5), sendA: 0.56, y:  1.85, shape: "oblong" },
      lead_vox:     { pan:  0.00, vol: db(-3.2), sendA: 0.38, y:  0.60, shape: "sphere" },
    }
  },

  visual_c_rap: {
    name: "Rap / Hip-Hop Mix (Visual C)",
    ref: "Visual C · p. 6 (PDF p. 29)",
    pdfPage: 29,
    lufsTarget: "heavy",
    desc: "808 Boom + Lead Vocal dominando el frente, Drums y Kick secos con pegada, Hi-Hat agresivo a la izquierda y camas armónicas contenidas.",
    reverb: { decay: 0.26, predelay: 0.20 },
    roles: {
      sub_808:      { pan:  0.00, vol: db(-1.5), sendA: 0.00, y: -2.65, shape: "sphere" },
      kick:         { pan:  0.00, vol: db(-2.2), sendA: 0.02, y: -2.30, shape: "sphere" },
      bass:         { pan:  0.00, vol: db(-3.0), sendA: 0.02, y: -1.90, shape: "sphere" },
      snare:        { pan: -0.25, vol: db(-2.8), sendA: 0.14, y: -0.25, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-2.6), sendA: 0.08, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.80, vol: db(-3.5), sendA: 0.05, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.72, vol: db(-7.2), sendA: 0.08, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-1.8), sendA: 0.12, y:  0.50, shape: "sphere" },
      piano_keys:   { pan: -0.55, vol: db(-7.0), sendA: 0.22, y:  0.30, shape: "oblong" },
      guitar:       { pan:  0.65, vol: db(-7.2), sendA: 0.20, y:  0.25, shape: "oblong" },
      synth_pad:    { pan:  0.62, vol: db(-6.5), sendA: 0.30, y:  1.25, shape: "sphere" },
    }
  },

  visual_d_reggae: {
    name: "Reggae Mix (Visual D)",
    ref: "Visual D · p. 7 (PDF p. 30)",
    pdfPage: 30,
    lufsTarget: "streaming",
    desc: "Bajo colosal al frente, Kick pegado detrás, Voz protagonista, Guitarras y Skank Keys balanceados en estéreo y Snare con reverb dub.",
    reverb: { decay: 0.65, predelay: 0.38 },
    roles: {
      bass:         { pan:  0.00, vol: db(-1.5), sendA: 0.04, y: -1.95, shape: "sphere" },
      kick:         { pan:  0.00, vol: db(-2.8), sendA: 0.05, y: -2.35, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-2.0), sendA: 0.28, y:  0.55, shape: "sphere" },
      snare:        { pan:  0.05, vol: db(-5.2), sendA: 0.52, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-3.5), sendA: 0.28, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.68, vol: db(-3.8), sendA: 0.14, y:  2.25, shape: "sphere" },
      guitar:       { pan: -0.38, vol: db(-4.5), sendA: 0.34, y:  0.35, shape: "oblong" },
      piano_keys:   { pan:  0.38, vol: db(-4.5), sendA: 0.36, y:  0.55, shape: "oblong" },
      lead_gtr:     { pan: -0.40, vol: db(-3.5), sendA: 0.28, y:  0.90, shape: "sphere" },
    }
  },

  visual_f_new_age: {
    name: "New Age / Dreamy Wall (Visual F)",
    ref: "Visual F · p. 8 (PDF p. 31)",
    pdfPage: 31,
    lufsTarget: "acoustic",
    desc: "Envuelto y sin filos. Bajo grande, Keys y Sintes en elipsoides húmedos cubriendo todo, voz flotante y batería suave atrás.",
    reverb: { decay: 0.82, predelay: 0.32 },
    roles: {
      bass:         { pan:  0.04, vol: db(-2.0), sendA: 0.14, y: -1.95, shape: "sphere" },
      kick:         { pan:  0.00, vol: db(-6.8), sendA: 0.12, y: -2.35, shape: "sphere" },
      snare:        { pan: -0.05, vol: db(-7.5), sendA: 0.56, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-7.0), sendA: 0.42, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.70, vol: db(-9.0), sendA: 0.35, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: db(-7.5), sendA: 0.52, y:  2.45, shape: "sphere" },
      piano_keys:   { pan: -0.25, vol: db(-3.0), sendA: 0.68, y:  0.20, shape: "oblong" },
      synth_pad:    { pan:  0.15, vol: db(-2.6), sendA: 0.76, y:  1.25, shape: "oblong" },
      lead_vox:     { pan:  0.00, vol: db(-3.8), sendA: 0.58, y:  0.65, shape: "sphere" },
      backing_vox:  { pan:  0.00, vol: db(-5.8), sendA: 0.74, y:  1.50, shape: "oblong" },
    }
  },

  visual_y_indie_ballad: {
    name: "Indie / Pop Ballad (Visual Y)",
    ref: "Visual Y · p. 17 (PDF p. 40)",
    pdfPage: 40,
    lufsTarget: "streaming",
    desc: "Voz protagonista al centro, acústicas abiertas a L/R, eléctrica chispeante a la derecha, bajo y bombo cálidos abajo y pad contenido.",
    reverb: { decay: 0.52, predelay: 0.28 },
    roles: {
      kick:         { pan:  0.00, vol: db(-3.0), sendA: 0.08, y: -2.35, shape: "sphere" },
      bass:         { pan: -0.06, vol: db(-3.2), sendA: 0.06, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.14, vol: db(-4.5), sendA: 0.36, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: db(-3.5), sendA: 0.24, y: -0.90, shape: "sphere" },
      overhead:     { pan: -0.55, vol: db(-7.2), sendA: 0.24, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: db(-1.5), sendA: 0.30, y:  0.55, shape: "sphere" },
      rhythm_gtr_l: { pan: -0.68, vol: db(-4.0), sendA: 0.26, y:  0.60, shape: "oblong" },
      rhythm_gtr_r: { pan:  0.68, vol: db(-4.0), sendA: 0.26, y:  0.64, shape: "oblong" },
      lead_gtr:     { pan:  0.82, vol: db(-5.0), sendA: 0.34, y:  1.15, shape: "sphere" },
      synth_pad:    { pan: -0.45, vol: db(-7.8), sendA: 0.45, y:  0.10, shape: "oblong" },
    }
  }
};

// Calcula el desplazamiento en dB para preservar el volumen promedio actual de la sesión
export function computePresetRelativeOffsetDb(preset, tracks = []) {
  if (!preset || preset.isDefaultDry || !preset.roles) {
    return { offsetDb: 0, avgCurrentDb: null, avgPresetDb: null, matchedCount: 0 };
  }

  let sumCur = 0;
  let sumPre = 0;
  let count = 0;

  for (const t of tracks) {
    if (!t || t.locked || t.isGroup) continue;
    const cfg = preset.roles[t.role];
    if (!cfg) continue;

    const curDb = abletonVolToDb(t.vol);
    const preDb = abletonVolToDb(cfg.vol);
    if (!Number.isFinite(curDb) || curDb <= -55 || !Number.isFinite(preDb)) continue;

    sumCur += curDb;
    sumPre += preDb;
    count++;
  }

  if (count === 0) {
    return { offsetDb: 0, avgCurrentDb: null, avgPresetDb: null, matchedCount: 0 };
  }

  const avgCurrentDb = sumCur / count;
  const avgPresetDb = sumPre / count;
  return {
    offsetDb: clamp(avgCurrentDb - avgPresetDb, -30, 12),
    avgCurrentDb,
    avgPresetDb,
    matchedCount: count,
  };
}

export function resolvePresetTrackVol(targetVol, offsetDb = 0) {
  if (!offsetDb || Math.abs(offsetDb) < 0.01) return targetVol;
  const baseDb = abletonVolToDb(targetVol);
  if (!Number.isFinite(baseDb)) return targetVol;
  return dbToAbletonVol(clamp(baseDb + offsetDb, -42, 5.5));
}