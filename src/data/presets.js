// Presets calibrados con David Gibson — "The Art of Mixing" (4th Ed., 2026)
// pdfPage = número exacto de página en el PDF (Static Resource: assets/art_of_mixing.pdf)
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
    desc: "Volúmenes parejos + Wall of Sound. Lead Gtr estéreo, voz integrada en Nivel 3-4 (Pearl Jam / Smashing Pumpkins) y low end limpio.",
    reverb: { decay: 0.48, predelay: 0.25 },
    roles: {
      kick:         { pan:  0.00, vol: 0.83, sendA: 0.06, y: -2.35, shape: "sphere" },
      bass:         { pan: -0.05, vol: 0.84, sendA: 0.05, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.04, vol: 0.82, sendA: 0.36, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: 0.82, sendA: 0.24, y: -0.90, shape: "sphere" },
      tom:          { pan: -0.25, vol: 0.78, sendA: 0.22, y: -0.60, shape: "sphere" },
      floor_tom:    { pan:  0.45, vol: 0.78, sendA: 0.22, y: -1.15, shape: "sphere" },
      hihat:        { pan: -0.65, vol: 0.73, sendA: 0.14, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: 0.74, sendA: 0.25, y:  2.55, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.79, sendA: 0.32, y:  0.55, shape: "sphere" },
      backing_vox:  { pan: -0.50, vol: 0.71, sendA: 0.48, y:  1.35, shape: "oblong" },
      rhythm_gtr_l: { pan: -0.78, vol: 0.79, sendA: 0.28, y:  0.10, shape: "sphere" },
      rhythm_gtr_r: { pan:  0.80, vol: 0.79, sendA: 0.28, y:  0.15, shape: "sphere" },
      guitar:       { pan: -0.45, vol: 0.78, sendA: 0.30, y:  0.25, shape: "oblong" },
      lead_gtr:     { pan:  0.12, vol: 0.84, sendA: 0.32, y:  0.85, shape: "oblong" },
      piano_keys:   { pan:  0.00, vol: 0.72, sendA: 0.42, y:  0.65, shape: "oblong" },
      synth_pad:    { pan:  0.00, vol: 0.70, sendA: 0.55, y:  1.10, shape: "oblong" },
    }
  },

  owls_sonic_youth: {
    name: "Owls & Sticks — Sonic Youth / Diamond Sea",
    ref: "Wall of Sound · p. 206 (PDF p. 229)",
    pdfPage: 229,
    desc: "Paredes de guitarras abiertas con overlap estéreo, bajo firme al centro, voz sumergida en textura y sintes/coros profundos.",
    reverb: { decay: 0.68, predelay: 0.30 },
    roles: {
      kick:         { pan:  0.00, vol: 0.82, sendA: 0.12, y: -2.35, shape: "sphere" },
      bass:         { pan:  0.00, vol: 0.85, sendA: 0.10, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.10, vol: 0.80, sendA: 0.38, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: 0.80, sendA: 0.30, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.55, vol: 0.70, sendA: 0.24, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: 0.74, sendA: 0.42, y:  2.55, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.77, sendA: 0.45, y:  0.55, shape: "sphere" },
      backing_vox:  { pan:  0.55, vol: 0.69, sendA: 0.72, y:  1.45, shape: "oblong" },
      rhythm_gtr_l: { pan: -0.88, vol: 0.83, sendA: 0.44, y:  0.15, shape: "oblong" },
      rhythm_gtr_r: { pan:  0.90, vol: 0.83, sendA: 0.48, y:  0.35, shape: "oblong" },
      guitar:       { pan: -0.68, vol: 0.81, sendA: 0.50, y:  0.25, shape: "oblong" },
      lead_gtr:     { pan:  0.48, vol: 0.82, sendA: 0.58, y:  1.15, shape: "sphere" },
      piano_keys:   { pan: -0.35, vol: 0.72, sendA: 0.60, y:  0.70, shape: "oblong" },
      synth_pad:    { pan:  0.00, vol: 0.74, sendA: 0.82, y:  1.15, shape: "oblong" },
    }
  },

  owls_lou_reed_dry: {
    name: "Owls & Sticks — Lou Reed Dry (105 BPM)",
    ref: "Maximum Presence · p. 220 (PDF p. 243)",
    pdfPage: 243,
    desc: "Voz principal ultra seca en Nivel 2 pegada a la cara, bajo protagonista, guitarra staccato seca al costado y susurros atrás en reverb.",
    reverb: { decay: 0.55, predelay: 0.42 },
    roles: {
      kick:         { pan:  0.00, vol: 0.82, sendA: 0.02, y: -2.35, shape: "sphere" },
      bass:         { pan:  0.00, vol: 0.86, sendA: 0.03, y: -1.95, shape: "sphere" },
      snare:        { pan:  0.05, vol: 0.79, sendA: 0.07, y: -0.35, shape: "sphere" },
      drums:        { pan:  0.00, vol: 0.79, sendA: 0.06, y: -0.90, shape: "sphere" },
      hihat:        { pan: -0.40, vol: 0.68, sendA: 0.04, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: 0.68, sendA: 0.08, y:  2.55, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.89, sendA: 0.03, y:  0.55, shape: "sphere" },
      backing_vox:  { pan:  0.00, vol: 0.66, sendA: 0.72, y:  1.50, shape: "oblong" },
      rhythm_gtr_l: { pan: -0.62, vol: 0.75, sendA: 0.08, y:  0.10, shape: "sphere" },
      rhythm_gtr_r: { pan:  0.65, vol: 0.75, sendA: 0.10, y:  0.15, shape: "sphere" },
      guitar:       { pan:  0.58, vol: 0.76, sendA: 0.08, y:  0.25, shape: "sphere" },
      lead_gtr:     { pan: -0.45, vol: 0.78, sendA: 0.16, y:  0.90, shape: "sphere" },
      synth_pad:    { pan:  0.00, vol: 0.64, sendA: 0.78, y:  1.10, shape: "oblong" },
    }
  },

  visual_e_heavy_metal: {
    name: "Heavy Metal (Visual E)",
    ref: "Visual E · p. 7 (PDF p. 30)",
    pdfPage: 30,
    desc: "Muro masivo y denso. Hi-Hat Nivel 2, Snare y Lead Guitar bien al frente, múltiples guitarras en estéreo y low end clarísimo.",
    reverb: { decay: 0.38, predelay: 0.22 },
    roles: {
      kick:         { pan:  0.00, vol: 0.86, sendA: 0.04, y: -2.35, shape: "sphere" },
      bass:         { pan: -0.08, vol: 0.83, sendA: 0.03, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.05, vol: 0.86, sendA: 0.26, y: -0.35, shape: "sphere" },
      tom:          { pan: -0.30, vol: 0.80, sendA: 0.20, y: -0.60, shape: "sphere" },
      floor_tom:    { pan:  0.50, vol: 0.80, sendA: 0.20, y: -1.15, shape: "sphere" },
      hihat:        { pan: -0.72, vol: 0.82, sendA: 0.08, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: 0.76, sendA: 0.16, y:  2.55, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.84, sendA: 0.22, y:  0.55, shape: "sphere" },
      rhythm_gtr_l: { pan: -0.88, vol: 0.83, sendA: 0.14, y:  0.10, shape: "sphere" },
      rhythm_gtr_r: { pan:  0.88, vol: 0.83, sendA: 0.14, y:  0.15, shape: "sphere" },
      guitar:       { pan:  0.75, vol: 0.82, sendA: 0.15, y:  0.25, shape: "sphere" },
      lead_gtr:     { pan:  0.28, vol: 0.88, sendA: 0.24, y:  0.85, shape: "sphere" },
    }
  },

  visual_i_folk: {
    name: "Folk / Acoustic Clarity (Visual I)",
    ref: "Visual I · p. 9 (PDF p. 32)",
    pdfPage: 32,
    desc: "Limpio, claro y casi sin efectos. Voz al frente (Nivel 2), guitarras acústicas paneadas 100% L/R y batería/bajo contenidos.",
    reverb: { decay: 0.28, predelay: 0.18 },
    roles: {
      kick:         { pan:  0.00, vol: 0.74, sendA: 0.02, y: -2.35, shape: "sphere" },
      bass:         { pan:  0.00, vol: 0.75, sendA: 0.02, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.18, vol: 0.69, sendA: 0.10, y: -0.35, shape: "sphere" },
      tom:          { pan: -0.60, vol: 0.68, sendA: 0.08, y: -0.60, shape: "sphere" },
      floor_tom:    { pan:  0.45, vol: 0.68, sendA: 0.08, y: -1.15, shape: "sphere" },
      hihat:        { pan: -0.50, vol: 0.64, sendA: 0.04, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: 0.68, sendA: 0.08, y:  2.55, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.89, sendA: 0.10, y:  0.55, shape: "sphere" },
      backing_vox:  { pan:  0.00, vol: 0.74, sendA: 0.16, y:  1.35, shape: "oblong" },
      rhythm_gtr_l: { pan: -0.86, vol: 0.81, sendA: 0.08, y:  0.20, shape: "sphere" },
      rhythm_gtr_r: { pan:  0.86, vol: 0.81, sendA: 0.08, y:  0.20, shape: "sphere" },
      guitar:       { pan: -0.78, vol: 0.80, sendA: 0.08, y:  0.25, shape: "sphere" },
    }
  },

  visual_b_blues: {
    name: "Blues Mix (Visual B)",
    ref: "Visual B · p. 6 (PDF p. 29)",
    pdfPage: 29,
    desc: "Limpio y al frente. Bajo grande (Nivel 2), Lead Gtr derecha y Rítmica izquierda bien presentes, Piano estéreo más atrás.",
    reverb: { decay: 0.35, predelay: 0.20 },
    roles: {
      kick:         { pan:  0.00, vol: 0.84, sendA: 0.05, y: -2.35, shape: "sphere" },
      bass:         { pan: -0.05, vol: 0.88, sendA: 0.04, y: -1.95, shape: "sphere" },
      snare:        { pan:  0.12, vol: 0.72, sendA: 0.22, y: -0.35, shape: "sphere" },
      hihat:        { pan: -0.55, vol: 0.70, sendA: 0.12, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: 0.70, sendA: 0.16, y:  2.55, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.81, sendA: 0.22, y:  0.55, shape: "sphere" },
      rhythm_gtr_l: { pan: -0.72, vol: 0.83, sendA: 0.18, y:  0.15, shape: "sphere" },
      guitar:       { pan: -0.70, vol: 0.82, sendA: 0.18, y:  0.20, shape: "sphere" },
      lead_gtr:     { pan:  0.38, vol: 0.87, sendA: 0.22, y:  0.75, shape: "sphere" },
      piano_keys:   { pan:  0.00, vol: 0.73, sendA: 0.34, y:  0.80, shape: "oblong" },
    }
  },

  visual_h_acoustic_jazz: {
    name: "Acoustic Jazz · Asymmetrical (Visual H)",
    ref: "Visual H · p. 9 (PDF p. 32)",
    pdfPage: 32,
    desc: "Máxima claridad y paneo asimétrico natural: Bajo a la derecha, Piano a la izquierda, Guitarra frente derecha, Hi-Hat frente izquierda.",
    reverb: { decay: 0.24, predelay: 0.15 },
    roles: {
      kick:         { pan: -0.35, vol: 0.78, sendA: 0.03, y: -2.35, shape: "sphere" },
      bass:         { pan:  0.32, vol: 0.83, sendA: 0.03, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.10, vol: 0.72, sendA: 0.05, y: -0.35, shape: "sphere" },
      hihat:        { pan: -0.78, vol: 0.80, sendA: 0.04, y:  2.25, shape: "sphere" },
      overhead:     { pan: -0.35, vol: 0.74, sendA: 0.08, y:  2.55, shape: "sphere" },
      piano_keys:   { pan: -0.60, vol: 0.83, sendA: 0.08, y:  0.40, shape: "sphere" },
      guitar:       { pan:  0.70, vol: 0.82, sendA: 0.08, y:  0.10, shape: "sphere" },
      lead_gtr:     { pan:  0.30, vol: 0.80, sendA: 0.10, y:  0.80, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.84, sendA: 0.10, y:  0.55, shape: "sphere" },
    }
  },

  visual_a_electronica: {
    name: "Electronica Mix (Visual A)",
    ref: "Visual A · p. 5 (PDF p. 28)",
    pdfPage: 28,
    desc: "808 Boom gigante al frente, Bass con fattening estéreo, Hi-Hat bien a la izquierda, Snare contenido y sintes/strings espaciales arriba.",
    reverb: { decay: 0.62, predelay: 0.35 },
    roles: {
      sub_808:      { pan:  0.00, vol: 0.92, sendA: 0.02, y: -2.65, shape: "sphere" },
      kick:         { pan: -0.05, vol: 0.88, sendA: 0.04, y: -2.25, shape: "sphere" },
      bass:         { pan:  0.00, vol: 0.85, sendA: 0.08, y: -1.90, shape: "oblong" },
      snare:        { pan:  0.05, vol: 0.74, sendA: 0.28, y: -0.35, shape: "sphere" },
      hihat:        { pan: -0.82, vol: 0.80, sendA: 0.16, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.72, vol: 0.74, sendA: 0.32, y:  2.45, shape: "sphere" },
      piano_keys:   { pan: -0.55, vol: 0.78, sendA: 0.38, y:  0.75, shape: "oblong" },
      synth_pad:    { pan:  0.00, vol: 0.80, sendA: 0.56, y:  1.85, shape: "oblong" },
      lead_vox:     { pan:  0.00, vol: 0.82, sendA: 0.38, y:  0.60, shape: "sphere" },
    }
  },

  visual_c_rap: {
    name: "Rap / Hip-Hop Mix (Visual C)",
    ref: "Visual C · p. 6 (PDF p. 29)",
    pdfPage: 29,
    desc: "808 Boom Nivel 1-2 + Lead Vocal potente al frente (Nivel 2), Hi-Hat y Clap agresivos a la izquierda, Synth a la derecha.",
    reverb: { decay: 0.26, predelay: 0.20 },
    roles: {
      sub_808:      { pan:  0.00, vol: 0.93, sendA: 0.00, y: -2.65, shape: "sphere" },
      kick:         { pan:  0.00, vol: 0.89, sendA: 0.02, y: -2.30, shape: "sphere" },
      bass:         { pan:  0.00, vol: 0.86, sendA: 0.02, y: -1.90, shape: "sphere" },
      snare:        { pan: -0.30, vol: 0.84, sendA: 0.14, y: -0.25, shape: "sphere" },
      hihat:        { pan: -0.80, vol: 0.83, sendA: 0.05, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.72, vol: 0.72, sendA: 0.08, y:  2.45, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.90, sendA: 0.12, y:  0.50, shape: "sphere" },
      piano_keys:   { pan: -0.55, vol: 0.75, sendA: 0.22, y:  0.30, shape: "oblong" },
      guitar:       { pan:  0.65, vol: 0.74, sendA: 0.20, y:  0.25, shape: "oblong" },
      synth_pad:    { pan:  0.62, vol: 0.77, sendA: 0.30, y:  1.25, shape: "sphere" },
    }
  },

  visual_d_reggae: {
    name: "Reggae Mix (Visual D)",
    ref: "Visual D · p. 7 (PDF p. 30)",
    pdfPage: 30,
    desc: "Bajo colosal (Nivel 2), Kick pegado detrás, Voz bien al frente, Guitarras y Skank Keys solapados en estéreo, Snare con reverb dub.",
    reverb: { decay: 0.65, predelay: 0.38 },
    roles: {
      bass:         { pan:  0.00, vol: 0.92, sendA: 0.04, y: -1.95, shape: "sphere" },
      kick:         { pan:  0.00, vol: 0.84, sendA: 0.05, y: -2.35, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.88, sendA: 0.28, y:  0.55, shape: "sphere" },
      snare:        { pan:  0.05, vol: 0.74, sendA: 0.52, y: -0.35, shape: "sphere" },
      hihat:        { pan: -0.68, vol: 0.80, sendA: 0.14, y:  2.25, shape: "sphere" },
      guitar:       { pan: -0.35, vol: 0.78, sendA: 0.34, y:  0.35, shape: "oblong" },
      piano_keys:   { pan:  0.35, vol: 0.78, sendA: 0.36, y:  0.55, shape: "oblong" },
      lead_gtr:     { pan: -0.40, vol: 0.80, sendA: 0.28, y:  0.90, shape: "sphere" },
    }
  },

  visual_f_new_age: {
    name: "New Age / Dreamy Wall (Visual F)",
    ref: "Visual F · p. 8 (PDF p. 31)",
    pdfPage: 31,
    desc: "Extremadamente lleno y suave, sin filos. Bajo grande, Keys y Sintes Flanged en elipsoides gigantes cubriendo todo, batería suave (Nivel 4).",
    reverb: { decay: 0.82, predelay: 0.32 },
    roles: {
      bass:         { pan:  0.05, vol: 0.86, sendA: 0.14, y: -1.95, shape: "sphere" },
      kick:         { pan:  0.00, vol: 0.70, sendA: 0.12, y: -2.35, shape: "sphere" },
      snare:        { pan: -0.05, vol: 0.68, sendA: 0.56, y: -0.35, shape: "sphere" },
      hihat:        { pan: -0.70, vol: 0.62, sendA: 0.35, y:  2.25, shape: "sphere" },
      overhead:     { pan:  0.00, vol: 0.68, sendA: 0.52, y:  2.55, shape: "sphere" },
      piano_keys:   { pan: -0.25, vol: 0.81, sendA: 0.68, y:  0.20, shape: "oblong" },
      synth_pad:    { pan:  0.15, vol: 0.83, sendA: 0.76, y:  1.25, shape: "oblong" },
      lead_vox:     { pan:  0.00, vol: 0.78, sendA: 0.58, y:  0.65, shape: "sphere" },
      backing_vox:  { pan:  0.00, vol: 0.74, sendA: 0.74, y:  1.50, shape: "oblong" },
    }
  },

  visual_y_indie_ballad: {
    name: "Indie / Pop Ballad (Visual Y)",
    ref: "Visual Y · p. 17 (PDF p. 40)",
    pdfPage: 40,
    desc: "Voz protagonista al centro, acústicas abiertas a L/R, eléctrica chispeante a la derecha, bajo y bombo cálidos abajo.",
    reverb: { decay: 0.52, predelay: 0.28 },
    roles: {
      kick:         { pan:  0.00, vol: 0.80, sendA: 0.08, y: -2.35, shape: "sphere" },
      bass:         { pan: -0.08, vol: 0.79, sendA: 0.06, y: -1.95, shape: "sphere" },
      snare:        { pan: -0.14, vol: 0.76, sendA: 0.36, y: -0.35, shape: "sphere" },
      overhead:     { pan: -0.55, vol: 0.68, sendA: 0.24, y:  2.55, shape: "sphere" },
      lead_vox:     { pan:  0.00, vol: 0.88, sendA: 0.30, y:  0.55, shape: "sphere" },
      rhythm_gtr_l: { pan: -0.65, vol: 0.78, sendA: 0.26, y:  0.60, shape: "oblong" },
      rhythm_gtr_r: { pan:  0.65, vol: 0.78, sendA: 0.26, y:  0.60, shape: "oblong" },
      lead_gtr:     { pan:  0.82, vol: 0.74, sendA: 0.34, y:  1.15, shape: "sphere" },
      synth_pad:    { pan: -0.45, vol: 0.70, sendA: 0.45, y:  0.10, shape: "oblong" },
    }
  }
};