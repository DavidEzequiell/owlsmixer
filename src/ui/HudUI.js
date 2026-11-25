import { SKINS } from "../data/skins.js";
import { store } from "../store.js";
import { abletonService } from "../services/abletonService.js";

export class HudUI {
  constructor({ onRescan, onUndo, onRedo, onCamera, onOpenSettings, onTogglePresets, onImportMix }) {
    this.statusDot = document.getElementById("status-dot");
    this.statusText = document.getElementById("status-text");
    this.btnPlay = document.getElementById("btn-play");
    this.btnRescan = document.getElementById("btn-rescan");
    this.btnUndo = document.getElementById("btn-undo");
    this.btnRedo = document.getElementById("btn-redo");
    this.btnPresets = document.getElementById("btn-open-presets");
    this.btnZMode = document.getElementById("btn-zmode");
    this.btnQuickReverb = document.getElementById("btn-quick-reverb");
    this.btnQuickLevels = document.getElementById("btn-quick-levels");
    this.btnQuickCollisions = document.getElementById("btn-quick-collisions");
    this.btnQuickCollisions.addEventListener("click", () => {
      this.btnQuickCollisions.blur();
      store.updateSettings({ showCollisions: !store.settings.showCollisions });
    });
    this.skinSelect = document.getElementById("skin-select");
    this.btnSaveMix = document.getElementById("btn-save-mix");
    this.btnLoadMix = document.getElementById("btn-load-mix");
    this.fileLoadMix = document.getElementById("file-load-mix");
    this.btnSettings = document.getElementById("btn-settings");
    this.btnToggleShortcuts = document.getElementById("btn-toggle-shortcuts");
    this.hudHelp = document.getElementById("hud-help");

    this.eqBanner = document.getElementById("eq-banner");
    this.viewModeBtns = document.querySelectorAll("#view-mode-switch button[data-view]");
    this.viewModeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.blur();
        store.setViewMode(btn.dataset.view);
      });
    });

    this.btnAutoSize = document.getElementById("btn-auto-size");
    this.btnFlashFreeze = document.getElementById("btn-flash-freeze");

    this.btnAutoSize.addEventListener("click", () => {
      this.btnAutoSize.blur();
      store.updateSettings({ autoSize: !store.settings.autoSize });
    });
    this.btnFlashFreeze.addEventListener("click", () => {
      this.btnFlashFreeze.blur();
      store.toggleFlashFreeze();
    });

    Object.entries(SKINS).forEach(([key, sk]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = sk.name;
      if (key === store.settings.skin) opt.selected = true;
      this.skinSelect.appendChild(opt);
    });

    this.skinSelect.addEventListener("change", () => {
      this.skinSelect.blur();
      store.updateSettings({ skin: this.skinSelect.value });
    });

    this.btnPlay.addEventListener("click", () => { this.btnPlay.blur(); abletonService.togglePlay(false); });
    this.btnRescan.addEventListener("click", () => { this.btnRescan.blur(); onRescan(); });
    this.btnUndo.addEventListener("click", () => { this.btnUndo.blur(); onUndo(); });
    this.btnRedo.addEventListener("click", () => { this.btnRedo.blur(); onRedo(); });
    this.btnPresets.addEventListener("click", () => { this.btnPresets.blur(); onTogglePresets(); });
    this.bankBtns = document.querySelectorAll("#mix-banks-group .bank-btn");
    this.btnDryBypass = document.getElementById("btn-dry-bypass");

    this.bankBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        btn.blur();
        await abletonService.handleBankAction(btn.dataset.bank, e.shiftKey);
      });
      btn.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        btn.blur();
        await abletonService.handleBankAction(btn.dataset.bank, true);
      });
    });

    this.btnDryBypass.addEventListener("click", async () => {
      this.btnDryBypass.blur();
      await abletonService.toggleDryBypass();
    });

    document.querySelectorAll("[data-cam]").forEach((btn) => {
      btn.addEventListener("click", () => { btn.blur(); onCamera(btn.dataset.cam); });
    });

    this.btnZMode.addEventListener("click", () => {
    this.btnZMode.blur();
    const order = ["gibson", "depth", "spatial"];
    const next = order[(order.indexOf(store.settings.zMode) + 1) % order.length];
    store.updateSettings({ zMode: next });
  });

    this.btnQuickReverb.addEventListener("click", () => {
      this.btnQuickReverb.blur();
      store.updateSettings({ showReverbCubes: !store.settings.showReverbCubes });
    });

    this.btnQuickLevels.addEventListener("click", () => {
      this.btnQuickLevels.blur();
      store.updateSettings({ showVolLevels: !store.settings.showVolLevels });
    });

    this.btnToggleShortcuts.addEventListener("click", () => {
      this.btnToggleShortcuts.blur();
      this.hudHelp.classList.toggle("hidden");
    });

    this.btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
    this.btnFullscreen = document.getElementById("btn-fullscreen");

    this.btnToggleSidebar.addEventListener("click", () => {
      this.btnToggleSidebar.blur();
      this.toggleSidebar();
    });

    this.btnFullscreen.addEventListener("click", async () => {
      this.btnFullscreen.blur();
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (err) {
        console.warn("Fullscreen no disponible:", err);
      }
    });

    document.addEventListener("fullscreenchange", () => {
      this.btnFullscreen.classList.toggle("active", Boolean(document.fullscreenElement));
      window.dispatchEvent(new Event("resize"));
    });

    this.btnSaveMix.addEventListener("click", () => {
      this.btnSaveMix.blur();
      const payload = store.buildExportPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Mix_by_OwlsMixer3D.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    this.btnLoadMix.addEventListener("click", () => {
      this.btnLoadMix.blur();
      this.fileLoadMix.value = "";
      this.fileLoadMix.click();
    });

    this.fileLoadMix.addEventListener("change", async () => {
      const file = this.fileLoadMix.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        await onImportMix(data);
      } catch (err) {
        alert("No se pudo leer el archivo JSON del mix: " + err.message);
      }
    });

    this.btnSettings.addEventListener("click", () => { this.btnSettings.blur(); onOpenSettings(); });

    this.syncSettingsUI();
    this.syncHistoryUI();
    this.syncViewModeUI();
    this.syncBanksUI();
  }

  syncViewModeUI() {
    this.viewModeBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === store.viewMode);
    });

    if (store.viewMode !== "eq") {
      this.eqBanner.classList.add("hidden");
      return;
    }

    this.eqBanner.classList.remove("hidden");
    const item = store.getSelectedTracks()[0];
    if (!item) {
      this.eqBanner.className = "eq-banner warn";
      this.eqBanner.textContent = "🎛️ EQ Window — Seleccioná una pista de la lista para ver/editar su EQ Eight";
    } else if (!item.eq?.hasDevice) {
      this.eqBanner.className = "eq-banner warn";
      this.eqBanner.textContent = `⚠️ "${item.name}" no tiene EQ Eight en Ableton (agregalo y tocá ↻ o reseleccioná)`;
    } else {
      this.eqBanner.className = "eq-banner";
      this.eqBanner.textContent = `🎛️ EQ Window: ${item.name} — Arrastrá X: Cut/Boost · Shift+Drag: Hz · Rueda: Q · Clic Der: On/Off`;
    }
  }

  setStatus(state, text) {
    this.statusDot.className = "dot" + (state === "ok" ? " ok" : state === "err" ? " err" : "");
    this.statusText.textContent = text;
  }

  syncPlayUI() {
    this.btnPlay.textContent = store.isPlaying ? "⏸ Pause" : "▶ Play";
    this.btnPlay.classList.toggle("playing", store.isPlaying);
  }

  syncHistoryUI() {
    this.btnUndo.disabled = !store.canUndo();
    this.btnRedo.disabled = !store.canRedo();
  }

  syncSettingsUI() {
    const zMode = store.settings.zMode;
    this.btnZMode.textContent =
    zMode === "depth" ? "Eje Z: True Depth" : zMode === "spatial" ? "Eje Z: Reverb" : "Eje Z: Volumen";
    this.btnZMode.classList.toggle("active-toggle", zMode === "depth");
    this.skinSelect.value = store.settings.skin;
    this.btnQuickReverb.classList.toggle("active", store.settings.showReverbCubes);
    this.btnQuickLevels.classList.toggle("active", store.settings.showVolLevels);
    this.btnQuickCollisions.classList.toggle("active", store.settings.showCollisions);
    this.btnAutoSize.classList.toggle("active", store.settings.autoSize);

     const dragDesc =
          zMode === "depth"
          ? "Pan (X) + Profundidad (Vol + Reverb inv. + Aire EQ)"
          : zMode === "spatial"
            ? "Pan (X) + Send A (Z)"
            : "Pan (X) + Volumen (Z)";
      const wheelDesc = zMode === "spatial" ? "Volumen" : "Reverb Send A";

    this.hudHelp.innerHTML =
      `<b>Space:</b> Play/Pause<br/>` +
      `<b>Ctrl+Z / Ctrl+Y:</b> Deshacer / Rehacer<br/>` +
      `<b>Arrastrar esfera:</b> ${dragDesc}<br/>` +
      `<b>Shift + Arrastrar:</b> Altura Frecuencia (Y)<br/>` +
      `<b>Rueda sobre esfera:</b> ${wheelDesc}<br/>` +
      `<b>Ctrl+Click (M):</b> Mute &nbsp;|&nbsp; <b>Alt+Click (S):</b> Solo &nbsp;|&nbsp; <b>U:</b> Quitar Solos<br/>` +
      `<b>Esc:</b> Limpiar selección &nbsp;|&nbsp; <b>Doble clic en lista:</b> Renombrar`;
  }
  syncBanksUI() {
    this.bankBtns.forEach((btn) => {
      const slot = btn.dataset.bank;
      const hasData = Boolean(store.banks[slot]);
      const isActive = store.activeBank === slot && !store.isDryBypass;
      btn.classList.toggle("has-data", hasData);
      btn.classList.toggle("active", isActive);
      btn.title = isActive
        ? `Banco ${slot} (activo) — Tus cambios se guardan en ${slot} al pasar a otro banco`
        : hasData
          ? `Banco ${slot} (guardado) — Clic: cambiar a ${slot} · Shift+Clic / Der: copiar mezcla actual a ${slot}`
          : `Banco ${slot} (vacío) — Clic para crear ${slot} desde la mezcla actual`;
    });
    this.btnDryBypass.classList.toggle("active", store.isDryBypass);
    this.btnDryBypass.classList.toggle("dry-on", store.isDryBypass);
  }
  syncFlashUI() {
    this.btnFlashFreeze.classList.toggle("active", store.flashFreeze);
    this.btnFlashFreeze.textContent = store.flashFreeze ? "❄ Congelado" : "⚡ Flash";
  }
  toggleSidebar() {
    const hidden = document.body.classList.toggle("sidebar-hidden");
    this.btnToggleSidebar.classList.toggle("active", hidden);
    window.dispatchEvent(new Event("resize"));
  }
  
}