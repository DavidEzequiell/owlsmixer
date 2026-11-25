import { store } from "../store.js";

export class SettingsModalUI {
  constructor() {
    this.backdrop = document.getElementById("settings-modal");
    this.btnClose = document.getElementById("btn-close-settings");
    this.tabs = document.querySelectorAll(".tab-btn");
    this.tabPrefs = document.getElementById("tab-prefs");
    this.tabGuide = document.getElementById("tab-guide");

    this.optVolUnit = document.getElementById("opt-vol-unit");
    this.optZMode = document.getElementById("opt-z-mode");
    this.optReverbCubes = document.getElementById("opt-show-reverb-cubes");
    this.optVolLevels = document.getElementById("opt-show-vol-levels");
    this.optFreqBands = document.getElementById("opt-show-freq-bands");
    this.optEqTips = document.getElementById("opt-show-eq-tips");
    this.optFreqSizing = document.getElementById("opt-freq-sizing");

    this.btnClose.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.tabs.forEach((b) => b.classList.toggle("active", b === btn));
        const showPrefs = btn.dataset.tab === "prefs";
        this.tabPrefs.classList.toggle("hidden", !showPrefs);
        this.tabGuide.classList.toggle("hidden", showPrefs);
      });
    });

    this.optVolUnit.addEventListener("change", () => store.updateSettings({ volUnit: this.optVolUnit.value }));
    this.optZMode.addEventListener("change", () => store.updateSettings({ zMode: this.optZMode.value }));
    this.optReverbCubes.addEventListener("change", () => store.updateSettings({ showReverbCubes: this.optReverbCubes.checked }));
    this.optVolLevels.addEventListener("change", () => store.updateSettings({ showVolLevels: this.optVolLevels.checked }));
    this.optFreqBands.addEventListener("change", () => store.updateSettings({ showFreqBands: this.optFreqBands.checked }));
    this.optEqTips.addEventListener("change", () => store.updateSettings({ showEqTips: this.optEqTips.checked }));
    this.optFreqSizing.addEventListener("change", () => store.updateSettings({ freqSizing: this.optFreqSizing.checked }));

    this.syncFromStore();
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
    this.optVolUnit.value = s.volUnit;
    this.optZMode.value = s.zMode;
    this.optReverbCubes.checked = s.showReverbCubes;
    this.optVolLevels.checked = s.showVolLevels;
    this.optFreqBands.checked = s.showFreqBands;
    this.optEqTips.checked = s.showEqTips;
    this.optFreqSizing.checked = s.freqSizing;
  }
}