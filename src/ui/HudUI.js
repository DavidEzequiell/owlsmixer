import { store } from "../store.js";
import { abletonService } from "../services/abletonService.js";

export class HudUI {
  constructor({ windowManager, onRescan, onUndo, onRedo, onCamera, onOpenSettings, onTogglePresets, onImportMix }) {
    this.windowManager = windowManager;

    this.statusDot = document.getElementById("status-dot");
    this.statusText = document.getElementById("status-text");
    this.btnPlay = document.getElementById("btn-play");
    this.btnRescan = document.getElementById("btn-rescan");
    this.btnUndo = document.getElementById("btn-undo");
    this.btnRedo = document.getElementById("btn-redo");
    this.btnPresets = document.getElementById("btn-open-presets");
    this.btnZMode = document.getElementById("btn-zmode");

    // Menú desplegable de Ventanas en la barra superior
    this.windowsDropdown = document.getElementById("windows-dropdown");
    this.btnWindowsMenu = document.getElementById("btn-windows-menu");
    this.windowsPopover = document.getElementById("windows-popover");
    this.winToggleInputs = document.querySelectorAll("#windows-popover input[data-win-toggle]");
    this.panelToggleInputs = document.querySelectorAll("#windows-popover input[data-panel-toggle]");
    this.btnResetWindows = document.getElementById("btn-reset-windows");

    // Menú desplegable de Capas en el Dock
    this.layersDropdown = document.getElementById("layers-dropdown");
    this.btnLayersMenu = document.getElementById("btn-layers-menu");
    this.layersPopover = document.getElementById("layers-popover");
    this.layerInputs = document.querySelectorAll("#layers-popover input[data-layer-setting]");

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

    // Wiring del popover 🪟 Ventanas ▾
    this.btnWindowsMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      this.btnWindowsMenu.blur();
      const willOpen = this.windowsPopover.classList.contains("hidden");
      this.closePopovers();
      if (willOpen) {
        this.syncWindowsMenuUI();
        this.windowsPopover.classList.remove("hidden");
        this.btnWindowsMenu.classList.add("active");
      }
    });

    this.winToggleInputs.forEach((inp) => {
      inp.addEventListener("change", () => {
        this.windowManager?.setWindowOpen(inp.dataset.winToggle, inp.checked);
      });
    });

    this.panelToggleInputs.forEach((inp) => {
      inp.addEventListener("change", () => {
        this.windowManager?.setSidebarPanelVisible(inp.dataset.panelToggle, inp.checked);
      });
    });

    this.btnResetWindows?.addEventListener("click", () => {
      this.btnResetWindows.blur();
      this.windowManager?.resetPositions();
    });

    // Wiring del popover 👁 Capas ▾
    this.btnLayersMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      this.btnLayersMenu.blur();
      const willOpen = this.layersPopover.classList.contains("hidden");
      this.closePopovers();
      if (willOpen) {
        this.layersPopover.classList.remove("hidden");
        this.btnLayersMenu.classList.add("active");
      }
    });

    this.layerInputs.forEach((inp) => {
      inp.addEventListener("change", () => {
        const key = inp.dataset.layerSetting;
        if (key) store.updateSettings({ [key]: inp.checked });
      });
    });

    document.addEventListener("pointerdown", (e) => {
      if (!this.layersDropdown?.contains(e.target) && !this.windowsDropdown?.contains(e.target)) {
        this.closePopovers();
      }
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
    this.syncWindowsMenuUI();
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

  hasOpenPopover() {
    return (
      Boolean(this.layersPopover && !this.layersPopover.classList.contains("hidden")) ||
      Boolean(this.windowsPopover && !this.windowsPopover.classList.contains("hidden"))
    );
  }

  closePopovers() {
    this.layersPopover?.classList.add("hidden");
    this.btnLayersMenu?.classList.remove("active");
    this.windowsPopover?.classList.add("hidden");
    this.btnWindowsMenu?.classList.remove("active");
  }

  syncWindowsMenuUI() {
    if (!this.windowManager) return;
    this.winToggleInputs.forEach((inp) => {
      inp.checked = this.windowManager.isWindowOpen(inp.dataset.winToggle);
    });
    this.panelToggleInputs.forEach((inp) => {
      inp.checked = this.windowManager.isSidebarPanelVisible(inp.dataset.panelToggle);
    });
  }

  syncSettingsUI() {
    const zMode = store.settings.zMode;
    this.btnZMode.textContent =
      zMode === "depth" ? "Eje Z: True Depth" : zMode === "spatial" ? "Eje Z: Reverb" : "Eje Z: Volumen";
    this.btnZMode.classList.toggle("active-toggle", zMode === "depth");
    this.btnAutoSize.classList.toggle("active", store.settings.autoSize);

    this.layerInputs.forEach((inp) => {
      const key = inp.dataset.layerSetting;
      if (key) inp.checked = store.settings[key] !== false;
    });

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