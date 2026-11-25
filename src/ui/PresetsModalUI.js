import { PRESETS } from "../data/presets.js";
import { ROLES } from "../data/roles.js";
import { store, formatPan, formatVolume } from "../store.js";
import { abletonService } from "../services/abletonService.js";

const PDF_STATIC_PATH = "./assets/art_of_mixing.pdf";

export class PresetsModalUI {
  constructor({ windowManager, onPresetApplied }) {
    this.windowManager = windowManager;
    this.onPresetApplied = onPresetApplied;

    this.select = document.getElementById("preset-select");
    this.btnPdfRef = document.getElementById("btn-open-pdf-ref");
    this.refBadge = document.getElementById("preset-ref-badge");
    this.descEl = document.getElementById("preset-desc");
    this.previewEl = document.getElementById("preset-preview-roles");
    this.btnApply = document.getElementById("btn-apply-preset");

    // Modal Visor PDF
    this.pdfModal = document.getElementById("pdf-modal");
    this.pdfTitle = document.getElementById("pdf-modal-title");
    this.pdfExtLink = document.getElementById("pdf-external-link");
    this.pdfIframe = document.getElementById("pdf-iframe");
    this.btnClosePdf = document.getElementById("btn-close-pdf");

    this.populatePresets();
    this.bindEvents();
    this.refreshMeta();
  }

  populatePresets() {
    this.select.innerHTML = "";
    Object.entries(PRESETS).forEach(([key, p]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = p.name;
      this.select.appendChild(opt);
    });
  }

  bindEvents() {
    this.select.addEventListener("change", () => this.refreshMeta());

    this.btnPdfRef.addEventListener("click", () => {
      const preset = PRESETS[this.select.value];
      if (!preset) return;
      const page = preset.pdfPage || 1;
      const url = `${PDF_STATIC_PATH}?p=${page}#page=${page}`;
      this.pdfTitle.textContent = `📖 ${preset.name} — ${preset.ref}`;
      this.pdfExtLink.href = `${PDF_STATIC_PATH}#page=${page}`;
      this.pdfIframe.src = url;
      this.pdfModal.classList.remove("hidden");
    });

    this.btnClosePdf.addEventListener("click", () => this.closePdf());
    this.pdfModal.addEventListener("click", (e) => {
      if (e.target === this.pdfModal) this.closePdf();
    });

    this.btnApply.addEventListener("click", async () => {
      this.btnApply.blur();
      const preset = PRESETS[this.select.value];
      if (!preset) return;

      store.pushHistory(store.captureSnapshot());

      for (const item of store.tracks) {
        if (item.locked || item.isGroup) continue;
        const target = preset.roles[item.role];
        if (!target) continue;

        item.pan = target.pan;
        item.vol = target.vol;
        item.sendA = target.sendA;
        item.y = target.y;
        if (target.shape) item.shape = target.shape;

        await item._ableton.panParam.set("value", item.pan);
        await item._ableton.volParam.set("value", item.vol);
        if (item._ableton.sendAParam) await item._ableton.sendAParam.set("value", item.sendA);
      }

      if (preset.reverb && store.reverbInfo.connected) {
        abletonService.setReverbDecay(preset.reverb.decay, true);
        abletonService.setReverbPredelay(preset.reverb.predelay, true);
      }

      this.onPresetApplied?.();
    });
  }

  refreshMeta() {
    const p = PRESETS[this.select.value];
    if (!p) return;
    this.refBadge.textContent = p.ref || "Ver PDF";
    this.descEl.textContent = p.desc || "";

    this.previewEl.innerHTML = "";
    const unit = store.settings.volUnit;
    Object.entries(p.roles).forEach(([roleKey, cfg]) => {
      const tag = document.createElement("span");
      tag.className = "preset-role-tag";
      const label = ROLES[roleKey]?.label || roleKey;
      const shapeIcon = cfg.shape === "oblong" ? "⬭" : "●";
      tag.textContent = `${shapeIcon} ${label}: ${formatPan(cfg.pan)} · ${formatVolume(cfg.vol, unit)}`;
      this.previewEl.appendChild(tag);
    });
  }

  isOpen() { return this.windowManager.isWindowOpen("presets"); }
  isPdfOpen() { return !this.pdfModal.classList.contains("hidden"); }
  open() { this.windowManager.setWindowOpen("presets", true); }
  close() { this.windowManager.setWindowOpen("presets", false); }
  closePdf() { this.pdfModal.classList.add("hidden"); this.pdfIframe.src = "about:blank"; }
  toggle() { this.windowManager.toggleWindow("presets"); }
}