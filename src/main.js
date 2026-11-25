import { store } from "./store.js";
import { abletonService } from "./services/abletonService.js";
import { Stage3D } from "./scene/Stage3D.js";
import { Interaction3D } from "./scene/Interaction3D.js";
import { HudUI } from "./ui/HudUI.js";
import { SidebarUI } from "./ui/SidebarUI.js";
import { PresetsModalUI } from "./ui/PresetsModalUI.js";
import { SettingsModalUI } from "./ui/SettingsModalUI.js";

const viewportEl = document.getElementById("viewport");
const sidebarEl = document.getElementById("sidebar");
const resizerEl = document.getElementById("sidebar-resizer");

const stage = new Stage3D(viewportEl);
const settingsModal = new SettingsModalUI();

async function performUndo() {
  const snap = store.popUndo();
  if (!snap) return;
  await abletonService.applySnapshot(snap);
}

async function performRedo() {
  const snap = store.popRedo();
  if (!snap) return;
  await abletonService.applySnapshot(snap);
}

async function handleImportMix(data) {
  if (!data || !data.snapshot) throw new Error("Formato de mix inválido");
  store.pushHistory(store.captureSnapshot());
  if (data.settings) store.updateSettings(data.settings);
  await abletonService.applySnapshot(data.snapshot);
  if (data.reverb && store.reverbInfo.connected) {
    if (typeof data.reverb.decay === "number") abletonService.setReverbDecay(data.reverb.decay, true);
    if (typeof data.reverb.predelay === "number") abletonService.setReverbPredelay(data.reverb.predelay, true);
  }
}

const presetsModal = new PresetsModalUI({
  onPresetApplied: () => {
    stage.updateAllOrbs();
    sidebar.updateInspector();
  },
});

const hud = new HudUI({
  onRescan: () => rescanAll(),
  onUndo: performUndo,
  onRedo: performRedo,
  onCamera: (cam) => stage.setCameraView(cam),
  onOpenSettings: () => settingsModal.open(),
  onTogglePresets: () => presetsModal.toggle(),
  onImportMix: handleImportMix,
});

const sidebar = new SidebarUI({
  onTrackVisualChanged: (item) => (item ? stage.updateOrb(item) : stage.updateAllOrbs()),
  onOrbLabelChanged: (item) => stage.rebuildOrbLabel(item),
});

new Interaction3D(stage, {
  onUndo: performUndo,
  onRedo: performRedo,
  onEscape: () => {
    if (presetsModal.isPdfOpen()) presetsModal.closePdf();
    else if (settingsModal.isOpen()) settingsModal.close();
    else if (presetsModal.isOpen()) presetsModal.close();
    else store.setSelection([]);
  },
});

// =========================================================================
// RESIZER DE SIDEBAR (arrastrable + guardado en localStorage)
// =========================================================================
const savedW = parseInt(localStorage.getItem("owls3d_sidebar_w") || "0", 10);
if (savedW >= 280 && savedW <= 680) {
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
  const w = Math.max(280, Math.min(680, window.innerWidth - e.clientX));
  sidebarEl.style.width = `${w}px`;
  stage.resize();
});
window.addEventListener("pointerup", () => {
  if (!resizing) return;
  resizing = false;
  resizerEl.classList.remove("resizing");
  localStorage.setItem("owls3d_sidebar_w", String(sidebarEl.offsetWidth));
});

// =========================================================================
// PORTAL DE HELPTEXTS ESTILO SALESFORCE (?)
// =========================================================================
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
  if (e.target.closest?.(".help-icon[data-help]")) {
    tooltipEl.classList.add("hidden");
  }
});

// =========================================================================
// SUSCRIPCIONES AL STORE
// =========================================================================
store.on("playstate", () => hud.syncPlayUI());
store.on("history", () => hud.syncHistoryUI());

store.on("settings", (s) => {
  stage.applySkin(s.skin);
  stage.applyStageSettings();
  hud.syncSettingsUI();
  sidebar.updateReverbUI();
  sidebar.updateInspector();
  presetsModal.refreshMeta();
  settingsModal.syncFromStore();
});

store.on("tracks-loaded", () => {
  stage.rebuildOrbs();
  sidebar.renderGroupsBar();
  sidebar.renderTrackList();
  sidebar.updateReverbUI();
  sidebar.updateInspector();
  hud.setStatus("ok", `Conectado · ${store.tracks.length} pistas`);
});

store.on("track-changed", (item) => {
  if (item) stage.updateOrb(item);
  else stage.updateAllOrbs();
  sidebar.updateInspector();
});

store.on("track-renamed", (item) => {
  stage.rebuildOrbLabel(item);
  sidebar.renderTrackList();
  sidebar.renderGroupsBar();
  sidebar.updateInspector();
});

store.on("mute-solo", () => {
  stage.updateAllOrbs();
  sidebar.syncMuteSoloBadges();
});

store.on("selection", () => {
  stage.updateAllOrbs();
  sidebar.syncSelectionHighlights();
  sidebar.updateInspector();
});

store.on("groups", () => {
  sidebar.renderGroupsBar();
  sidebar.renderTrackList();
});

store.on("reverb-changed", () => {
  sidebar.updateReverbUI();
  stage.updateAllOrbs();
});

store.on("snapshot-applied", () => {
  store.tracks.forEach((t) => stage.rebuildOrbLabel(t));
  stage.updateAllOrbs();
  sidebar.renderGroupsBar();
  sidebar.renderTrackList();
  sidebar.syncMuteSoloBadges();
  sidebar.updateInspector();
});

async function rescanAll() {
  hud.setStatus("warn", "Escaneando pistas...");
  try {
    await abletonService.scanAll();
  } catch (err) {
    hud.setStatus("err", "Error escaneando Ableton");
    console.error(err);
  }
}

stage.applySkin(store.settings.skin);
stage.applyStageSettings();

try {
  await abletonService.connect();
  await rescanAll();
} catch (err) {
  hud.setStatus("err", "No se pudo conectar a Ableton");
  console.error(err);
}