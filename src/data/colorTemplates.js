// Paleta oficial de colores de Ableton Live (color_index 0..69) + Templates de color por instrumento.

export const ABLETON_COLOR_PALETTE = [
  { index: 0,  hex: "#ff94a6" }, { index: 1,  hex: "#ffa529" }, { index: 2,  hex: "#cc9927" },
  { index: 3,  hex: "#f7f47c" }, { index: 4,  hex: "#bffb00" }, { index: 5,  hex: "#1aff2f" },
  { index: 6,  hex: "#25ffa8" }, { index: 7,  hex: "#5cffe8" }, { index: 8,  hex: "#8bc5ff" },
  { index: 9,  hex: "#5480e4" }, { index: 10, hex: "#92a7ff" }, { index: 11, hex: "#d86ce4" },
  { index: 12, hex: "#e553a0" }, { index: 13, hex: "#ffffff" }, { index: 14, hex: "#ff3636" },
  { index: 15, hex: "#f66c03" }, { index: 16, hex: "#99724b" }, { index: 17, hex: "#fff034" },
  { index: 18, hex: "#87ff67" }, { index: 19, hex: "#3dc300" }, { index: 20, hex: "#00bfaf" },
  { index: 21, hex: "#19e9ff" }, { index: 22, hex: "#10a4ee" }, { index: 23, hex: "#007dc0" },
  { index: 24, hex: "#886ce4" }, { index: 25, hex: "#b677c6" }, { index: 26, hex: "#ff39d4" },
  { index: 27, hex: "#d0d0d0" }, { index: 28, hex: "#e2675a" }, { index: 29, hex: "#ffa374" },
  { index: 30, hex: "#d3ad71" }, { index: 31, hex: "#edffae" }, { index: 32, hex: "#d2e498" },
  { index: 33, hex: "#bad074" }, { index: 34, hex: "#9bc48d" }, { index: 35, hex: "#d4fde1" },
  { index: 36, hex: "#cdf1f8" }, { index: 37, hex: "#b9c1e3" }, { index: 38, hex: "#cdbbe4" },
  { index: 39, hex: "#ae98e5" }, { index: 40, hex: "#e5dce1" }, { index: 41, hex: "#a9a9a9" },
  { index: 42, hex: "#c6928b" }, { index: 43, hex: "#b78256" }, { index: 44, hex: "#99836a" },
  { index: 45, hex: "#bfba69" }, { index: 46, hex: "#a6be00" }, { index: 47, hex: "#7db04d" },
  { index: 48, hex: "#88c2ba" }, { index: 49, hex: "#9bb3c4" }, { index: 50, hex: "#85a5c2" },
  { index: 51, hex: "#8393cc" }, { index: 52, hex: "#a595b5" }, { index: 53, hex: "#bf9fbe" },
  { index: 54, hex: "#bc7196" }, { index: 55, hex: "#7b7b7b" }, { index: 56, hex: "#af3333" },
  { index: 57, hex: "#a95131" }, { index: 58, hex: "#724f41" }, { index: 59, hex: "#dbc300" },
  { index: 60, hex: "#85961f" }, { index: 61, hex: "#539f31" }, { index: 62, hex: "#0a9c8e" },
  { index: 63, hex: "#236384" }, { index: 64, hex: "#1a2f96" }, { index: 65, hex: "#2f52a2" },
  { index: 66, hex: "#624bad" }, { index: 67, hex: "#a34bad" }, { index: 68, hex: "#cc2e6e" },
  { index: 69, hex: "#3c3c3c" },
];

// 14 muestras rápidas 100% oficiales de Ableton para el color picker del sidebar
export const ABLETON_QUICK_SWATCHES = [
  "#ff3636", "#f66c03", "#fff034", "#87ff67",
  "#3dc300", "#00bfaf", "#19e9ff", "#10a4ee",
  "#5480e4", "#886ce4", "#d86ce4", "#e553a0",
  "#ffffff", "#a9a9a9",
];

function hexToRgb(hex) {
  const clean = String(hex || "#3b82f6").replace(/^#+/, "");
  const n = parseInt(clean.length === 6 ? clean : "3b82f6", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Encuentra el color oficial de Ableton Live (index 0..69) más cercano a cualquier hex
export function findNearestAbletonColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  let best = ABLETON_COLOR_PALETTE[22];
  let bestDist = Infinity;
  for (const entry of ABLETON_COLOR_PALETTE) {
    const [er, eg, eb] = hexToRgb(entry.hex);
    const d = (r - er) ** 2 * 0.30 + (g - eg) ** 2 * 0.59 + (b - eb) ** 2 * 0.11;
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best;
}

// Templates predeterminados de color por rol de instrumento (todos calibrados a paleta oficial de Live)
export const COLOR_TEMPLATES = {
  art_of_mixing: {
    name: "The Art of Mixing (Gibson)",
    desc: "Inspirado en los gráficos del libro: graves cálidos (rojo/bordó), batería azul/violeta, platillos amarillo, guitarras naranja/verde, voces rosa y teclados celeste/lavanda.",
    roles: {
      sub_808:      "#af3333",
      kick:         "#cc2e6e",
      bass:         "#ff3636",
      floor_tom:    "#5480e4",
      tom:          "#8bc5ff",
      snare:        "#886ce4",
      drums:        "#5480e4",
      rhythm_gtr_l: "#3dc300",
      rhythm_gtr_r: "#7db04d",
      guitar:       "#f66c03",
      lead_gtr:     "#ffa529",
      lead_vox:     "#e553a0",
      backing_vox:  "#ff94a6",
      piano_keys:   "#10a4ee",
      synth_pad:    "#d86ce4",
      hihat:        "#fff034",
      overhead:     "#f7f47c",
      bus:          "#a9a9a9",
      other:        "#00bfaf",
    },
  },

  studio_standard: {
    name: "Studio Standard (DAW)",
    desc: "Convención clásica de estudio: Drums celeste/azul, Bass rojo, Guitarras verde, Voces rosa/fucsia, Keys/Synths violeta, Platillos amarillo.",
    roles: {
      sub_808:      "#af3333",
      kick:         "#10a4ee",
      bass:         "#ff3636",
      floor_tom:    "#236384",
      tom:          "#5480e4",
      snare:        "#19e9ff",
      drums:        "#007dc0",
      rhythm_gtr_l: "#3dc300",
      rhythm_gtr_r: "#539f31",
      guitar:       "#87ff67",
      lead_gtr:     "#bffb00",
      lead_vox:     "#ff39d4",
      backing_vox:  "#ff94a6",
      piano_keys:   "#886ce4",
      synth_pad:    "#b677c6",
      hihat:        "#fff034",
      overhead:     "#dbc300",
      bus:          "#d0d0d0",
      other:        "#7b7b7b",
    },
  },

  high_contrast: {
    name: "Alto Contraste 3D (por frecuencia)",
    desc: "Colores bien separados por altura espectral para máxima lectura en la caja 3D: graves rojo/naranja, medios verde/cian, voces blanco/rosa, agudos amarillo.",
    roles: {
      sub_808:      "#af3333",
      kick:         "#ff3636",
      bass:         "#f66c03",
      floor_tom:    "#ffa529",
      tom:          "#cc9927",
      snare:        "#886ce4",
      drums:        "#5480e4",
      rhythm_gtr_l: "#00bfaf",
      rhythm_gtr_r: "#25ffa8",
      guitar:       "#3dc300",
      lead_gtr:     "#19e9ff",
      lead_vox:     "#ffffff",
      backing_vox:  "#ff94a6",
      piano_keys:   "#10a4ee",
      synth_pad:    "#d86ce4",
      hihat:        "#fff034",
      overhead:     "#edffae",
      bus:          "#a9a9a9",
      other:        "#8bc5ff",
    },
  },

  custom: {
    name: "Personalizado (Mis colores)",
    desc: "Elegí tu propio color para cada rol de instrumento. Se guarda automáticamente en el navegador.",
    roles: {},
  },
};

export function resolveColorTemplateMap(templateKey, customRoleColors = {}) {
  if (templateKey === "custom") {
    return {
      ...COLOR_TEMPLATES.art_of_mixing.roles,
      ...(customRoleColors || {}),
    };
  }
  const tpl = COLOR_TEMPLATES[templateKey] || COLOR_TEMPLATES.art_of_mixing;
  return { ...tpl.roles };
}