import { SKINS } from "../data/skins.js";
import { store } from "../store.js";
import { abletonService } from "../services/abletonService.js";

export class HudUI {
  constructor({ onRescan, onUndo, onRedo, onCamera, onOpenSettings, onImportMix, onTogglePresets }) {
    this.statusDot = document.getElementById("status-dot");
    this.statusText = document.getElementById("status-text");
    this.btnPlay = document.getElementById("btn-play");
    this.btnRescan = document.getElementById("btn-rescan");
    this.btnUndo = document.getElementById("btn-undo");
    this.btnRedo = document.getElementById("btn-redo");
    this.btnZMode = document.getElementById("btn-zmode");
    this.skinSelect = document.getElementById("skin-select");
    this.btnSaveMix = document.getElementById("btn-save-mix");
    this.btnLoadMix = document.getElementById("btn-load-mix");
    this.fileLoadMix = document.getElementById("file-load-mix");
    this.btnSettings = document.getElementById("btn-settings");
    this.hudHelp = document.getElementById("hud-help");

    // Poblar selector de Skins
    Object.entries(SKINS).forEach(([key, sk]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = sk.name;
      if (key === store.settings.skin) opt.selected = true;
      this.skinSelect.appendChild(opt);
    });

    this.btnPresets = document.getElementById("btn-open-presets");
     this.btnPresets.addEventListener("click", () => {
     this.btnPresets.blur();
     onTogglePresets();
    });

    this.skinSelect.addEventListener("change", () => {
      this.skinSelect.blur();
      store.updateSettings({ skin: this.skinSelect.value });
    });

    this.btnPlay.addEventListener("click", () => {
      this.btnPlay.blur();
      abletonService.togglePlay(false);
    });

    this.btnRescan.addEventListener("click", () => {
      this.btnRescan.blur();
      onRescan();
    });

    this.btnUndo.addEventListener("click", () => {
      this.btnUndo.blur();
      onUndo();
    });

    this.btnRedo.addEventListener("click", () => {
      this.btnRedo.blur();
      onRedo();
    });

    document.querySelectorAll("[data-cam]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.blur();
        onCamera(btn.dataset.cam);
      });
    });

    this.btnZMode.addEventListener("click", () => {
      this.btnZMode.blur();
      const next = store.settings.zMode === "gibson" ? "spatial" : "gibson";
      store.updateSettings({ zMode: next });
    });

    // Exportar Mix Snapshot JSON ("Mix_by_OwlsMixer3D.json")
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

    // Importar Mix Snapshot JSON
    this.btnLoadMix.addEventListener("click", () => {
      this.btnLoadMix.blur();
      this.fileLoadMix.value = "";
      this.fileLoadMix.click();
    });

    this.fileLoadMix.addEventListener("change", async () => {
      const file = this.fileLoadMix.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await onImportMix(data);
      } catch (err) {
        alert("No se pudo leer el archivo JSON del mix: " + err.message);
      }
    });

    this.btnSettings.addEventListener("click", () => {
      this.btnSettings.blur();
      onOpenSettings();
    });

    this.syncSettingsUI();
    this.syncHistoryUI();
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
    const isGibson = store.settings.zMode === "gibson";
    this.btnZMode.textContent = isGibson ? "Eje Z: Volumen (Gibson)" : "Eje Z: Reverb (Send A)";
    this.skinSelect.value = store.settings.skin;

    const dragDesc = isGibson ? "Pan (X) + Volumen (Z)" : "Pan (X) + Send A (Z)";
    const wheelDesc = isGibson ? "Reverb Send A" : "Volumen";
    this.hudHelp.innerHTML =
      `<b>Space:</b> Play/Pause &nbsp;|&nbsp; <b>Ctrl+Z / Y:</b> Undo/Redo &nbsp;|&nbsp; <b>Arrastrar:</b> ${dragDesc} &nbsp;|&nbsp; <b>Shift+Arrastrar:</b> Altura (Y) &nbsp;|&nbsp; <b>Rueda:</b> ${wheelDesc}<br/>` +
      `<b>Ctrl+Click (M):</b> Mute &nbsp;|&nbsp; <b>Alt+Click (S):</b> Solo &nbsp;|&nbsp; <b>U:</b> Quitar Solos &nbsp;|&nbsp; <b>Esc:</b> Limpiar selección &nbsp;|&nbsp; <b>Doble clic en lista:</b> Renombrar`;
  }
}