// Roles basados en David Gibson — "The Art of Mixing" (4th Ed.)
// sizeFactor: espacio de enmascaramiento (graves grandes, agudos chicos — Visuals 24-26, p. 49-50)
// defaultY: altura en la caja (-3 = <40Hz .. +3 = >8kHz — Chart 3, p. 91)
// shape: "sphere" (mono puntual) | "oblong" (stereo / fattening <30ms — Visual 29, p. 52)
export const ROLES = {
  sub_808: {
    label: "808 / Sub",
    iconKey: "sub",
    defaultY: -2.65,
    sizeFactor: 2.05,
    shape: "sphere",
    keywords: ["808", "sub", "boom"],
    eqTip: "Sub (<40-60Hz): Foco en 40-60Hz; en Rap/Electronica suele ocupar Nivel 1-2. Evitá reverb grave (Visual 41)."
  },
  kick: {
    label: "Kick",
    iconKey: "kick",
    defaultY: -2.35,
    sizeFactor: 1.75,
    shape: "sphere",
    keywords: ["kick", "bombo", "bd"],
    eqTip: "Kick (Chart 6): Cortar barro 100-300Hz (-10dB Q fino). +1-3kHz thud, +3-6kHz click. Paneo: Centro."
  },
  bass: {
    label: "Bass",
    iconKey: "bass",
    defaultY: -1.95,
    sizeFactor: 1.85,
    shape: "sphere",
    keywords: ["bass", "bajo"],
    eqTip: "Bass (Chart 6): +40-60Hz cuerpo, cortar barro 100-300Hz (-3dB). +1-5kHz presencia/cuerda. Ojo con enmascarar al Kick."
  },
  floor_tom: {
    label: "Floor Tom",
    iconKey: "tom",
    defaultY: -1.15,
    sizeFactor: 1.15,
    shape: "sphere",
    keywords: ["floor", "fl tom", "chancha"],
    eqTip: "Floor Tom (Chart 4/6): Cuerpo en 40-100Hz, cortar barro 100-300Hz, +3-6kHz ataque."
  },
  tom: {
    label: "Toms",
    iconKey: "tom",
    defaultY: -0.60,
    sizeFactor: 0.95,
    shape: "sphere",
    keywords: ["tom"],
    eqTip: "Toms (Chart 6): Cortar 100-300Hz (-6dB), +3-8dB en 3-6kHz. Panear L→R (baterista) o R→L (público)."
  },
  snare: {
    label: "Snare",
    iconKey: "snare",
    defaultY: -0.35,
    sizeFactor: 1.10,
    shape: "sphere",
    keywords: ["snare", "redoblante", "tacho", "sd", "clap"],
    eqTip: "Snare (Chart 6): +60-150Hz si está flaco, +3-10dB en 3-6kHz brillo/corte. Reverb termina antes del próximo Kick (p. 126)."
  },
  drums: {
    label: "Drums / Kit",
    iconKey: "drums",
    defaultY: -0.90,
    sizeFactor: 1.35,
    shape: "sphere",
    keywords: ["drum", "bata", "bateria", "perc", "conga"],
    eqTip: "Drums Kit: Mantener cohesión de sala; compresión paralela en bus de batería suma presencia (p. 175)."
  },
  rhythm_gtr_l: {
    label: "Guitar L",
    iconKey: "guitar",
    defaultY: 0.10,
    sizeFactor: 1.05,
    shape: "sphere",
    keywords: ["gtr l", "guitar l", "guit l", "ritmica l", "acustica l"],
    eqTip: "Electric/Acoustic Gtr (Chart 6): Cortar barro 100-300Hz. +1-3kHz filo (eléctrica) o +5-8kHz sparkle (acústica)."
  },
  rhythm_gtr_r: {
    label: "Guitar R",
    iconKey: "guitar",
    defaultY: 0.15,
    sizeFactor: 1.05,
    shape: "sphere",
    keywords: ["gtr r", "guitar r", "guit r", "ritmica r", "acustica r"],
    eqTip: "Electric/Acoustic Gtr (Chart 6): Balancear contra Guitar L para mezcla simétrica (Visual 203)."
  },
  guitar: {
    label: "Guitar",
    iconKey: "guitar",
    defaultY: 0.25,
    sizeFactor: 1.05,
    shape: "sphere",
    keywords: ["gtr", "guitar", "guit", "arpeg"],
    eqTip: "Guitar (Chart 6): Staccato → mono puntual; Legato/Acordes → probar Stereo Fattening <30ms (p. 197)."
  },
  lead_gtr: {
    label: "Lead Guitar",
    iconKey: "guitar",
    defaultY: 0.85,
    sizeFactor: 1.15,
    shape: "sphere",
    keywords: ["lead", "solo", "punteo"],
    eqTip: "Lead Guitar: +1-3kHz para cortar en la mezcla (ojo con la irritación en 3-4kHz 'chainsaw'). Compresión suma sustain."
  },
  lead_vox: {
    label: "Lead Vox",
    iconKey: "vocal",
    defaultY: 0.55,
    sizeFactor: 1.20,
    shape: "sphere",
    keywords: ["vox", "voc", "voz", "voice", "cant", "singer"],
    eqTip: "Vocals (Chart 6): HPF <60Hz. Usar 1/6 de EQ normal en medios (somos hipersensibles). +3-6kHz presencia/claridad. Centro."
  },
  backing_vox: {
    label: "Backing Vox",
    iconKey: "backing_vox",
    defaultY: 1.35,
    sizeFactor: 0.90,
    shape: "oblong",
    keywords: ["back", "bgv", "coro", "whisper", "susurr", "harm"],
    eqTip: "BGV (Visual 191-194): Doblar o usar Fattening en estéreo (10:00-2:00 o L/R) para despejar la Lead Vocal en el centro."
  },
  piano_keys: {
    label: "Piano / Keys",
    iconKey: "keys",
    defaultY: 0.65,
    sizeFactor: 1.15,
    shape: "oblong",
    keywords: ["piano", "key", "rhodes", "organ", "clav"],
    eqTip: "Piano/Keys (Chart 6): Cortar barro 100-300Hz y honkiness 600-1kHz; +5-8kHz sparkle. Graves Izq → Agudos Der (p. 196)."
  },
  synth_pad: {
    label: "Synth / Pad",
    iconKey: "synth",
    defaultY: 1.10,
    sizeFactor: 1.15,
    shape: "oblong",
    keywords: ["synth", "sinte", "pad", "string", "drone", "flang"],
    eqTip: "Synths/Pads (Visual F): Suelen ser anchos en estéreo (Elipsoide) y vivir en Nivel 4 para abrazar sin tapar la voz."
  },
  hihat: {
    label: "Hi-Hat",
    iconKey: "hihat",
    defaultY: 2.25,
    sizeFactor: 0.52,
    shape: "sphere",
    keywords: ["hat", "hh", "hihat", "hi-hat", "charles"],
    eqTip: "Hi-Hat (Chart 6): HPF agresivo hasta 300-700Hz (-12dB lows). +3dB @ 12kHz sizzle. Tradicional: mitad entre centro e Izq."
  },
  overhead: {
    label: "OH / Cymbals",
    iconKey: "cymbal",
    defaultY: 2.55,
    sizeFactor: 0.58,
    shape: "sphere",
    keywords: ["oh", "over", "cym", "plat", "ride", "crash", "shaker", "tamb"],
    eqTip: "Overheads/Cymbals (Chart 5/6): Roll-off total <300Hz (-12dB), +3dB @ 8-20kHz. Poco espacio en el mix → esferas chicas arriba."
  },
  bus: {
    label: "Group Bus",
    iconKey: "bus",
    defaultY: 0.0,
    sizeFactor: 1.10,
    shape: "sphere",
    keywords: ["group", "bus", "submix"],
    eqTip: "Group Bus: Representa el fader/pan/send del bus entero en Ableton."
  },
  other: {
    label: "Otro",
    iconKey: "other",
    defaultY: 0.0,
    sizeFactor: 0.90,
    shape: "sphere",
    keywords: [],
    eqTip: "Tip general (p. 104): Escuchá primero 4 cosas: Barro (100-400Hz), Graves (40-60Hz), Irritación (800-5kHz) y Brillo (5-8kHz)."
  }
};

export function getRoleIconKey(role, isGroup = false) {
  if (isGroup) return ROLES.bus.iconKey;
  return ROLES[role]?.iconKey || ROLES.other.iconKey;
}

export function autoDetectRole(name, isGroup = false) {
  if (isGroup) return "bus";
  const lower = (name || "").toLowerCase();
  for (const [key, cfg] of Object.entries(ROLES)) {
    if (key === "bus") continue;
    if (cfg.keywords.some((kw) => lower.includes(kw))) return key;
  }
  return "other";
}