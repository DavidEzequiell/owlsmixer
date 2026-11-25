import { store } from "./store.js";
import { abletonService } from "./services/abletonService.js";
import { Stage3D } from "./scene/Stage3D.js";
import { Interaction3D } from "./scene/Interaction3D.js";
import { HudUI } from "./ui/HudUI.js";
import { SidebarUI } from "./ui/SidebarUI.js";
import { PresetsModalUI } from "./ui/PresetsModalUI.js";
import { SettingsModalUI } from "./ui/SettingsModalUI.js";
import { ErrorHandlerUI } from "./ui/ErrorHandlerUI.js";
import { analyzeMixSpace } from "./engine/psychoacoustics.js";
import { PsychoPanelUI } from "./ui/PsychoPanelUI.js";
import { WindowManager } from "./ui/WindowManager.js";

const viewportEl = document.getElementById("viewport");
const sidebarEl = document.getElementById("sidebar");
const resizerEl = document.getElementById("sidebar-resizer");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const errorHandler = new ErrorHandlerUI();

function showLoading(msg = "Cargando...") {
  loadingText.textContent = msg;
  loadingOverlay.classList.remove("hidden");
}
function hideLoading() {
  loadingOverlay.classList.add("hidden");
}
async function withLoading(msg, fn) {
  showLoading(msg);
  try {
    return await fn();
  } finally {
    hideLoading();
  }
}

let stage;
try {
  stage = new Stage3D(viewportEl);
} catch (err) {
  errorHandler.show({
    title: "Error iniciando el visor 3D (WebGL)",
    message: err.message,
    error: err,
    onRetry: () => window.location.reload(),
  });
  throw err;
}

stage.attachContextLossHandler((err) => {
  errorHandler.show({
    title: "Se perdió la aceleración 3D (WebGL)",
    message: err.message,
    error: err,
    onRetry: () => window.location.reload(),
  });
});

stage.onLiveMixTick = () => {
  runMixAnalysis();
  if (store.settings.autoSize && !sidebar.singleSliderBefore && store.getSelectedTracks().length === 1) {
    sidebar.updateInspector();
  }
};

const settingsModal = new SettingsModalUI();

async function performUndo() {
  const snap = store.popUndo();
  if (!snap) return;
  await withLoading("Deshaciendo cambios...", () => abletonService.applySnapshot(snap));
}

async function performRedo() {
  const snap = store.popRedo();
  if (!snap) return;
  await withLoading("Rehaciendo cambios...", () => abletonService.applySnapshot(snap));
}

async function handleImportMix(data) {
  if (!data || !data.snapshot) throw new Error("Formato de mix inválido");
  await withLoading("Cargando Mix Snapshot...", async () => {
    store.pushHistory(store.captureSnapshot());
    if (data.settings) store.updateSettings(data.settings);
    if (Array.isArray(data.scenes)) {
      store.scenes = data.scenes;
      store.emit("scenes-changed");
    }

    await abletonService.applySnapshot(data.snapshot);
    if (data.reverb && store.reverbInfo.connected) {
      if (typeof data.reverb.decay === "number") abletonService.setReverbDecay(data.reverb.decay, true);
      if (typeof data.reverb.predelay === "number") abletonService.setReverbPredelay(data.reverb.predelay, true);
    }
  });
}

const windowManager = new WindowManager();

const presetsModal = new PresetsModalUI({
  windowManager,
  onPresetApplied: () => {
    stage.updateAllOrbs();
    sidebar.updateInspector();
    runMixAnalysis();
  },
});

windowManager.registerWindow("presets", {
  el: document.getElementById("presets-window"),
  handleEl: document.getElementById("presets-drag-handle"),
  closeBtn: document.getElementById("btn-close-presets"),
  defaultPos: { left: 16, top: 64 },
  onOpen: () => presetsModal.refreshMeta(),
});

windowManager.registerWindow("psycho", {
  el: document.getElementById("psycho-window"),
  handleEl: document.getElementById("psycho-drag-handle"),
  closeBtn: document.getElementById("btn-close-psycho"),
  defaultPos: { left: 16, top: 64 },
  onOpen: () => runMixAnalysis(),
});

windowManager.registerWindow("reverb", {
  el: document.getElementById("reverb-window"),
  handleEl: document.getElementById("reverb-drag-handle"),
  closeBtn: document.getElementById("btn-close-reverb"),
  defaultPos: { left: 372, top: 64 },
});

windowManager.registerWindow("scenes", {
  el: document.getElementById("scenes-window"),
  handleEl: document.getElementById("scenes-drag-handle"),
  closeBtn: document.getElementById("btn-close-scenes"),
  defaultPos: { left: 16, top: 340 },
});

windowManager.registerSidebarPanel("groups", document.getElementById("section-groups"));
windowManager.registerSidebarPanel("inspector", document.getElementById("inspector"));

const hud = new HudUI({
  windowManager,
  onRescan: () => rescanAll(),
  onUndo: performUndo,
  onRedo: performRedo,
  onCamera: (cam) => stage.setCameraView(cam),
  onOpenSettings: () => settingsModal.open(),
  onTogglePresets: () => presetsModal.toggle(),
  onImportMix: handleImportMix,
});

windowManager.onChange = () => hud.syncWindowsMenuUI();

const sidebar = new SidebarUI({
  onTrackVisualChanged: (item) => {
    if (item) stage.updateOrb(item);
    else stage.updateAllOrbs();
    runMixAnalysis();
  },
  onOrbLabelChanged: (item) => stage.rebuildOrbLabel(item),
});

const psychoPanel = new PsychoPanelUI();

function runMixAnalysis() {
  // En EQ Window las esferas están ocultas; no recalculamos para no borrar fantasmas de colisión
  if (store.viewMode !== "mix") return;
  store.mixAnalysis = analyzeMixSpace(
    store.tracks,
    stage.orbs,
    store.reverbInfo.decay,
    store.settings.lufsTarget
  );
  stage.updateCollisions(store.mixAnalysis.collisions);
  psychoPanel.updateAnalysis();
}

function bindCollidingRivalsEq(item) {
  if (!item) return;
  for (const c of store.mixAnalysis.collisions || []) {
    const rival = c.a.id === item.id ? c.b : c.b.id === item.id ? c.a : null;
    if (rival && !rival.eq?.bound) abletonService.ensureEqBound(rival);
  }
}

new Interaction3D(stage, {
  onUndo: performUndo,
  onRedo: performRedo,
  onEscape: () => {
    if (hud.hasOpenPopover()) hud.closePopovers();
    else if (presetsModal.isPdfOpen()) presetsModal.closePdf();
    else if (settingsModal.isOpen()) settingsModal.close();
    else if (presetsModal.isOpen()) presetsModal.close();
    else store.setSelection([]);
  },
});


// Resizer de Sidebar
const savedW = parseInt(localStorage.getItem("owls3d_sidebar_w") || "0", 10);
if (savedW >= 290 && savedW <= 680) {
  sidebarEl.style.width = `${savedW}px`;
  stage.resize();
}
let resizing = false;
resizerEl.addEventListener("pointerdown", (e) => {
  resizing = true;
  resizerEl.classList.add("resizing");
  resizerEl.setPointerCapture(e.pointerId);
});
window.addEventListener("pointermove", (e) => {
  if (!resizing) return;
  const w = Math.max(290, Math.min(680, window.innerWidth - e.clientX));
  sidebarEl.style.width = `${w}px`;
  stage.resize();
});
window.addEventListener("pointerup", () => {
  if (!resizing) return;
  resizing = false;
  resizerEl.classList.remove("resizing");
  localStorage.setItem("owls3d_sidebar_w", String(sidebarEl.offsetWidth));
});

// Portal de HelpTexts estilo Salesforce (?)
const tooltipEl = document.getElementById("sf-tooltip-portal");
document.addEventListener("mouseover", (e) => {
  const icon = e.target.closest?.(".help-icon[data-help]");
  if (!icon) return;
  tooltipEl.textContent = icon.dataset.help;
  tooltipEl.classList.remove("hidden");

  const r = icon.getBoundingClientRect();
  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;
  let left = r.left + r.width / 2 - tw / 2;
  let top = r.top - th - 8;
  if (top < 8) top = r.bottom + 8;
  left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
});
document.addEventListener("mouseout", (e) => {
  if (e.target.closest?.(".help-icon[data-help]")) tooltipEl.classList.add("hidden");
});

// Suscripciones Store
store.on("playstate", () => hud.syncPlayUI());
store.on("history", () => hud.syncHistoryUI());
store.on("banks-changed", () => hud.syncBanksUI());
store.on("bank-saved-flash", (slot) => {
  const btn = document.querySelector(`#mix-banks-group .bank-btn[data-bank="${slot}"]`);
  if (!btn) return;
  btn.classList.remove("saved-flash");
  void btn.offsetWidth;
  btn.classList.add("saved-flash");
});
store.on("flash-changed", () => hud.syncFlashUI());

store.on("settings", (s) => {
  stage.applySkin(s.skin);
  stage.applyStageSettings();
  hud.syncSettingsUI();
  sidebar.updateReverbUI();
  sidebar.updateInspector();
  presetsModal.refreshMeta();
  settingsModal.syncFromStore();
  runMixAnalysis();
});

store.on("tracks-loaded", () => {
  stage.rebuildOrbs();
  sidebar.renderGroupsBar();
  sidebar.renderTrackList();
  sidebar.updateReverbUI();
  sidebar.updateInspector();
  hud.syncViewModeUI();
  runMixAnalysis();
  hud.setStatus("ok", `Live · ${store.tracks.length} pistas`);
});

store.on("track-changed", (item) => {
  if (item) stage.updateOrb(item);
  else stage.updateAllOrbs();
  sidebar.updateInspector();
  runMixAnalysis();
});

store.on("track-renamed", (item) => {
  stage.rebuildOrbLabel(item);
  sidebar.renderTrackList();
  sidebar.renderGroupsBar();
  sidebar.updateInspector();
  hud.syncViewModeUI();
});

store.on("track-color-changed", (item) => {
  stage.updateOrbColor(item);
  sidebar.renderTrackList();
  sidebar.renderGroupsBar();
  sidebar.updateInspector();
  if (store.viewMode === "eq") stage.eqWindow.sync();
});

store.on("mute-solo", () => {
  stage.updateAllOrbs();
  sidebar.syncMuteSoloBadges();
  runMixAnalysis();
});

store.on("selection", () => {
  stage.updateAllOrbs();
  sidebar.syncSelectionHighlights();
  sidebar.updateInspector();
  hud.syncViewModeUI();

  const sel = store.getSelectedTracks();
  for (const t of sel) {
    if (!t.eq?.bound) abletonService.ensureEqBound(t);
  }
  if (store.viewMode === "eq") {
    bindCollidingRivalsEq(sel[0]);
    stage.eqWindow.sync();
  }
});

store.on("view-mode", (mode) => {
  stage.applyViewMode(mode);
  hud.syncViewModeUI();
  if (mode === "eq") {
    const item = store.getSelectedTracks()[0];
    if (item && !item.eq?.bound) abletonService.ensureEqBound(item);
    bindCollidingRivalsEq(item);
  } else {
    runMixAnalysis();
  }
});

store.on("eq-changed", () => {
  stage.eqWindow.sync();
  hud.syncViewModeUI();
});

store.on("groups", () => {
  sidebar.renderGroupsBar();
  sidebar.renderTrackList();
});

store.on("reverb-changed", () => {
  sidebar.updateReverbUI();
  stage.updateAllOrbs();
  runMixAnalysis();
});

store.on("snapshot-applied", () => {
  store.tracks.forEach((t) => {
    stage.rebuildOrbLabel(t);
    stage.updateOrbColor(t);
  });
  stage.updateAllOrbs();
  runMixAnalysis();
  sidebar.renderGroupsBar();
  sidebar.renderTrackList();
  sidebar.syncMuteSoloBadges();
  sidebar.updateInspector();
  hud.syncViewModeUI();
});

store.on("master-meter", () => psychoPanel.updateMasterMeter());

store.on("scenes-changed", () => sidebar.syncScenesUI());
store.on("song-time", (beats) => sidebar.updateSongBar(beats));

async function rescanAll() {
  hud.setStatus("warn", "Escaneando...");
  await withLoading("Escaneando pistas y efectos de Ableton...", async () => {
    try {
      await abletonService.scanAll();
    } catch (err) {
      hud.setStatus("err", "Error escaneando");
      console.error(err);
      errorHandler.show({
        title: "Error escaneando el proyecto de Ableton",
        message: err?.message || "No se pudieron leer las pistas o dispositivos.",
        error: err,
        onRetry: () => rescanAll(),
      });
    }
  });
}

async function bootApp() {
  await withLoading("Conectando a Ableton Live...", async () => {
    try {
      await abletonService.connect();
      loadingText.textContent = "Cargando pistas del proyecto...";
      await abletonService.scanAll();
    } catch (err) {
      hud.setStatus("err", "Sin conexión a Ableton");
      console.error(err);
      errorHandler.show({
        title: "No se pudo conectar con Ableton Live",
        message: err?.message || "Fallo al conectar o leer el proyecto actual.",
        error: err,
        onRetry: () => bootApp(),
      });
    }
  });
}

stage.applySkin(store.settings.skin);
stage.applyStageSettings();
await bootApp();

stage.applySkin(store.settings.skin);
stage.applyStageSettings();

await withLoading("Conectando a Ableton Live...", async () => {
  try {
    await abletonService.connect();
    loadingText.textContent = "Cargando pistas del proyecto...";
    await abletonService.scanAll();
  } catch (err) {
    hud.setStatus("err", "Sin conexión a Ableton");
    console.error(err);
  }
});