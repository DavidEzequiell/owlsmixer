// Arquitectura de iconos SVG vectoriales para esferas 3D.
// Para usar tus propios archivos .svg externos:
//   1. Guardalos en ./assets/icons/<iconKey>.svg (ej: kick.svg, guitar.svg, vocal.svg)
//   2. Activá USE_EXTERNAL_SVG_ASSETS = true, o agregá rutas puntuales en EXTERNAL_SVG_OVERRIDES.

export const USE_EXTERNAL_SVG_ASSETS = false;
export const EXTERNAL_SVG_BASE_PATH = "./assets/icons/";
export const EXTERNAL_SVG_OVERRIDES = {
  // Ejemplo: kick: "./assets/icons/kick.svg",
};

const wrapSvg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// Placeholders SVG limpios (trazo blanco minimalista de alta legibilidad sobre cualquier color)
export const DEFAULT_ROLE_SVGS = {
  sub: wrapSvg(`
    <rect x="14" y="10" width="36" height="44" rx="6"/>
    <circle cx="32" cy="36" r="11"/>
    <circle cx="32" cy="36" r="3.5" fill="#ffffff"/>
    <circle cx="32" cy="18" r="3"/>
  `),
  kick: wrapSvg(`
    <circle cx="32" cy="31" r="19"/>
    <circle cx="32" cy="31" r="12" stroke-opacity="0.7"/>
    <path d="M18 47l-5 8M46 47l5 8"/>
    <circle cx="32" cy="34" r="3" fill="#ffffff"/>
    <path d="M32 37v17"/>
  `),
  bass: wrapSvg(`
    <path d="M22 44c-6 0-10-4-10-9 0-4 3-7 7-8 1-4 4-6 8-6 4 0 7 3 8 7l13-13 5 5-13 13c2 6-3 11-10 11h-8z"/>
    <path d="M46 11l7 7M49 8l3 3M53 12l3 3"/>
    <circle cx="25" cy="35" r="2.2" fill="#ffffff"/>
  `),
  snare: wrapSvg(`
    <ellipse cx="32" cy="24" rx="20" ry="7"/>
    <path d="M12 24v16c0 3.9 9 7 20 7s20-3.1 20-7V24"/>
    <path d="M20 30v14M32 31v16M44 30v14" stroke-opacity="0.75"/>
    <path d="M14 11l16 11M50 11L34 22"/>
  `),
  tom: wrapSvg(`
    <ellipse cx="32" cy="20" rx="17" ry="6"/>
    <path d="M15 20v22c0 3.3 7.6 6 17 6s17-2.7 17-6V20"/>
    <path d="M22 25v20M42 25v20" stroke-opacity="0.65"/>
  `),
  drums: wrapSvg(`
    <circle cx="32" cy="39" r="13"/>
    <path d="M22 49l-4 6M42 49l4 6"/>
    <path d="M10 22h16M38 22h16"/>
    <path d="M18 22v26M46 22v26" stroke-opacity="0.75"/>
    <ellipse cx="32" cy="21" rx="8" ry="3.5"/>
  `),
  guitar: wrapSvg(`
    <path d="M20 46c-5 0-9-3.5-9-8.5 0-3.5 2.4-6 5.6-7 .8-3.6 3.5-5.8 7-5.8 3.3 0 6 2.1 7 5.3L45 15l5 5-14.5 14.5c1.6 5.6-2.7 11.5-9.5 11.5h-6z"/>
    <circle cx="23" cy="37" r="2.8"/>
    <path d="M43 13l8 8"/>
  `),
  vocal: wrapSvg(`
    <rect x="24" y="10" width="16" height="24" rx="8"/>
    <path d="M18 27a14 14 0 0 0 28 0"/>
    <path d="M32 41v12M23 53h18"/>
    <path d="M25 18h14M25 24h14" stroke-opacity="0.7"/>
  `),
  backing_vox: wrapSvg(`
    <rect x="14" y="14" width="12" height="19" rx="6"/>
    <path d="M20 33v15M15 48h10"/>
    <rect x="38" y="14" width="12" height="19" rx="6"/>
    <path d="M44 33v15M39 48h10"/>
    <path d="M29 22c2-2 4-2 6 0M29 28c2 2 4 2 6 0" stroke-opacity="0.8"/>
  `),
  keys: wrapSvg(`
    <rect x="9" y="16" width="46" height="32" rx="4"/>
    <path d="M20 16v32M32 16v32M44 16v32"/>
    <path d="M16 16v18h6V16M29 16v18h6V16M41 16v18h6V16" fill="#ffffff"/>
  `),
  synth: wrapSvg(`
    <rect x="9" y="14" width="46" height="36" rx="5"/>
    <path d="M15 30c3-9 7-9 10 0s7 9 10 0 7-9 10 0"/>
    <circle cx="20" cy="42" r="2.5" fill="#ffffff"/>
    <circle cx="32" cy="42" r="2.5" fill="#ffffff"/>
    <circle cx="44" cy="42" r="2.5" fill="#ffffff"/>
  `),
  hihat: wrapSvg(`
    <path d="M14 25h36M16 30h32"/>
    <path d="M32 12v42M24 54h16"/>
  `),
  cymbal: wrapSvg(`
    <ellipse cx="32" cy="26" rx="22" ry="6"/>
    <path d="M27 24c1.5-3 8.5-3 10 0"/>
    <path d="M32 32v22M24 54h16"/>
  `),
  bus: wrapSvg(`
    <path d="M10 18a4 4 0 0 1 4-4h12l5 5h19a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V18z"/>
    <path d="M22 39V28M32 39V25M42 39V31"/>
  `),
  other: wrapSvg(`
    <path d="M26 44V18l22-5v26"/>
    <circle cx="20" cy="45" r="6"/>
    <circle cx="42" cy="40" r="6"/>
  `),
};

const iconImageCache = new Map();

function loadImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function getInlineDataUrl(iconKey) {
  const svg = DEFAULT_ROLE_SVGS[iconKey] || DEFAULT_ROLE_SVGS.other;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// Carga y cachea el HTMLImageElement del icono SVG (intenta externo si está habilitado, fallback a inline)
export function loadRoleIconImage(iconKey = "other") {
  const key = DEFAULT_ROLE_SVGS[iconKey] ? iconKey : "other";
  if (iconImageCache.has(key)) return iconImageCache.get(key);

  const externalUrl =
    EXTERNAL_SVG_OVERRIDES[key] ||
    (USE_EXTERNAL_SVG_ASSETS ? `${EXTERNAL_SVG_BASE_PATH}${key}.svg` : null);

  const promise = (async () => {
    if (externalUrl) {
      try {
        return await loadImageUrl(externalUrl);
      } catch {
        // Fallback silencioso al placeholder SVG vectorial si el asset externo no existe todavía
      }
    }
    return await loadImageUrl(getInlineDataUrl(key));
  })();

  iconImageCache.set(key, promise);
  return promise;
}