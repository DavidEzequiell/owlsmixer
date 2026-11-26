import { SKINS } from "../data/skins.js";
import { store, APP_VERSION } from "../store.js";
import { GRAPHICS_QUALITY_PRESETS } from "../scene/Stage3D.js";

export class SettingsModalUI {
  constructor() {
    this.backdrop = document.getElementById("settings-modal");
    this.btnClose = document.getElementById("btn-close-settings");
    this.tabs = document.querySelectorAll("#settings-modal .tab-btn");
    this.tabPanels = {
      prefs: document.getElementById("tab-prefs"),
      manual: document.getElementById("tab-manual"),
      guide: document.getElementById("tab-guide"),
    };

    this.optSkin = document.getElementById("opt-skin");
    this.optVolUnit = document.getElementById("opt-vol-unit");
    this.optZMode = document.getElementById("opt-z-mode");
    this.optReverbCubes = document.getElementById("opt-show-reverb-cubes");
    this.optVolLevels = document.getElementById("opt-show-vol-levels");
    this.optFreqBands = document.getElementById("opt-show-freq-bands");
    this.optFloorShadows = document.getElementById("opt-show-floor-shadows");
    this.optDropLines = document.getElementById("opt-show-drop-lines");
    this.optEqTips = document.getElementById("opt-show-eq-tips");
    this.optFreqSizing = document.getElementById("opt-freq-sizing");

    // Inyecta selector de Calidad Gráfica y Auto-Size dentro de Preferencias
    this.optGraphicsQuality = this._ensureQualityControl();
    this.optAutoSize = this._ensureAutoSizeControl();

    // Despeja el Dock inferior moviendo Auto-Size a Opciones
    document.getElementById("btn-auto-size")?.classList.add("hidden");

    // Easter Egg David Gibson VHS
    this.versionBtn = document.getElementById("app-version-egg");
    this.eggPanel = document.getElementById("easter-egg-panel");
    this.btnEggSkin97 = document.getElementById("btn-egg-skin97");
    this.eggClicks = 0;
    this.eggTimer = null;

    if (this.versionBtn) this.versionBtn.textContent = `v${APP_VERSION}`;

    this.populateSkins();
    this.populateGraphicsQuality();

    this.btnClose.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.tab;
        this.tabs.forEach((b) => b.classList.toggle("active", b === btn));
        Object.entries(this.tabPanels).forEach(([k, panel]) => {
          panel?.classList.toggle("hidden", k !== key);
        });
      });
    });

    this.optSkin.addEventListener("change", () => {
      this.optSkin.blur();
      store.updateSettings({ skin: this.optSkin.value });
    });
    this.optGraphicsQuality?.addEventListener("change", () => {
      this.optGraphicsQuality.blur();
      store.updateSettings({ graphicsQuality: this.optGraphicsQuality.value });
    });
    this.optVolUnit.addEventListener("change", () => store.updateSettings({ volUnit: this.optVolUnit.value }));
    this.optZMode.addEventListener("change", () => store.updateSettings({ zMode: this.optZMode.value }));
    this.optReverbCubes.addEventListener("change", () => store.updateSettings({ showReverbCubes: this.optReverbCubes.checked }));
    this.optVolLevels.addEventListener("change", () => store.updateSettings({ showVolLevels: this.optVolLevels.checked }));
    this.optFreqBands.addEventListener("change", () => store.updateSettings({ showFreqBands: this.optFreqBands.checked }));
    this.optFloorShadows.addEventListener("change", () => store.updateSettings({ showFloorShadows: this.optFloorShadows.checked }));
    this.optDropLines.addEventListener("change", () => store.updateSettings({ showDropLines: this.optDropLines.checked }));
    this.optEqTips.addEventListener("change", () => store.updateSettings({ showEqTips: this.optEqTips.checked }));
    this.optFreqSizing.addEventListener("change", () => store.updateSettings({ freqSizing: this.optFreqSizing.checked }));
    this.optAutoSize?.addEventListener("change", () => store.updateSettings({ autoSize: this.optAutoSize.checked }));

    store.on("settings", () => {
      if (this.isOpen()) this.syncFromStore();
    });

    this.initEasterEgg();
    this.syncFromStore();
  }

  _ensureQualityControl() {
    const existing = document.getElementById("opt-graphics-quality");
    if (existing) return existing;

    const skinRow = this.optSkin?.closest(".setting-row");
    if (!skinRow?.parentNode) return null;

    const row = document.createElement("div");
    row.className = "setting-row";
    row.innerHTML = `
      <div>
        <strong>Calidad gráfica 3D
          <span class="help-icon" data-help="Rendimiento: 30 FPS, resolución 1x, esferas simples y desactiva sombras del piso, niebla y luces extra para liberar GPU. Balanceado: 60 FPS recomendado. Studio Ultra: 60 FPS, HiDPI 2x, esferas 48×36, ACESFilmic e iluminación de estudio.">?</span>
        </strong>
        <div class="muted-note" style="margin:2px 0 0;">Ajusta resolución, detalle de esferas, sombras, iluminación y FPS sin reiniciar.</div>
      </div>
      <select id="opt-graphics-quality"></select>
    `;
    skinRow.parentNode.insertBefore(row, skinRow.nextSibling);
    return row.querySelector("#opt-graphics-quality");
  }

  _ensureAutoSizeControl() {
    const existing = document.getElementById("opt-auto-size");
    if (existing) return existing;

    const freqRow = this.optFreqSizing?.closest(".setting-row");
    if (!freqRow?.parentNode) return null;

    const row = document.createElement("div");
    row.className = "setting-row";
    row.innerHTML = `
      <div>
        <strong>Auto-Size dinámico (Crest + HPF EQ)</strong>
        <div class="muted-note" style="margin:2px 0 0;">Ajusta el radio según densidad dinámica y cortes de graves (&lt;300 Hz). Desactivalo para escalar manual.</div>
      </div>
      <input type="checkbox" id="opt-auto-size" />
    `;
    freqRow.parentNode.insertBefore(row, freqRow.nextSibling);
    return row.querySelector("#opt-auto-size");
  }

  populateGraphicsQuality() {
    if (!this.optGraphicsQuality) return;
    this.optGraphicsQuality.innerHTML = "";
    const cur = store.settings.graphicsQuality || "balanced";
    Object.entries(GRAPHICS_QUALITY_PRESETS).forEach(([key, cfg]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = cfg.label;
      if (key === cur) opt.selected = true;
      this.optGraphicsQuality.appendChild(opt);
    });
  }

  initEasterEgg() {
    this.versionBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.versionBtn.blur();
      clearTimeout(this.eggTimer);
      this.eggClicks += 1;

      if (this.eggClicks >= 5) {
        this.eggClicks = 0;
        if (!this.eggPanel) return;
        const wasHidden = this.eggPanel.classList.contains("hidden");
        this.eggPanel.classList.toggle("hidden", !wasHidden);
        this.versionBtn.textContent = wasHidden ? "📼 VHS '97" : `v${APP_VERSION}`;
        if (wasHidden) this.eggPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      if (this.eggClicks >= 2) {
        this.versionBtn.textContent = `📼 ${this.eggClicks}/5`;
      }

      this.eggTimer = setTimeout(() => {
        this.eggClicks = 0;
        if (this.eggPanel?.classList.contains("hidden")) {
          this.versionBtn.textContent = `v${APP_VERSION}`;
        }
      }, 2600);
    });

    this.btnEggSkin97?.addEventListener("click", () => {
      this.btnEggSkin97.blur();
      store.updateSettings({ skin: "gibson_90s" });
    });
  }

  populateSkins() {
    this.optSkin.innerHTML = "";
    Object.entries(SKINS).forEach(([key, sk]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = sk.name;
      if (key === store.settings.skin) opt.selected = true;
      this.optSkin.appendChild(opt);
    });
  }

  isOpen() {
    return !this.backdrop.classList.contains("hidden");
  }

  open() {
    this.syncFromStore();
    this.backdrop.classList.remove("hidden");
  }

  close() {
    this.backdrop.classList.add("hidden");
  }

  syncFromStore() {
    const s = store.settings;
    this.optSkin.value = s.skin;
    if (this.optGraphicsQuality) this.optGraphicsQuality.value = s.graphicsQuality || "balanced";
    this.optVolUnit.value = s.volUnit;
    this.optZMode.value = s.zMode;
    this.optReverbCubes.checked = s.showReverbCubes;
    this.optVolLevels.checked = s.showVolLevels;
    this.optFreqBands.checked = s.showFreqBands;
    this.optFloorShadows.checked = s.showFloorShadows !== false;
    this.optDropLines.checked = s.showDropLines !== false;
    this.optEqTips.checked = s.showEqTips;
    this.optFreqSizing.checked = s.freqSizing;
    if (this.optAutoSize) this.optAutoSize.checked = s.autoSize !== false;
  }
}