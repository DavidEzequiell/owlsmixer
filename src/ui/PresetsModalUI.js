import { PRESETS } from "../data/presets.js";
import { ROLES } from "../data/roles.js";
import { store, formatPan, formatVolume } from "../store.js";
import { abletonService } from "../services/abletonService.js";

const PDF_STATIC_PATH = "./assets/art_of_mixing.pdf";

export class PresetsModalUI {
  constructor({ onPresetApplied }) {
    this.onPresetApplied = onPresetApplied;

    this.win = document.getElementById("presets-window");
    this.dragHandle = document.getElementById("presets-drag-handle");
    this.btnClose = document.getElementById("btn-close-presets");
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
    this.initDrag();
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

  initDrag() {
    let dragging = false;
    let offX = 0;
    let offY = 0;

    this.dragHandle.addEventListener("pointerdown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      dragging = true;
      const rect = this.win.getBoundingClientRect();
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      this.dragHandle.setPointerCapture(e.pointerId);
    });

    this.dragHandle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const x = Math.max(8, Math.min(window.innerWidth - this.win.offsetWidth - 8, e.clientX - offX));
      const y = Math.max(8, Math.min(window.innerHeight - 60, e.clientY - offY));
      this.win.style.left = `${x}px`;
      this.win.style.top = `${y}px`;
    });

    this.dragHandle.addEventListener("pointerup", () => { dragging = false; });
  }

  bindEvents() {
    this.btnClose.addEventListener("click", () => this.close());
    this.select.addEventListener("change", () => this.refreshMeta());

    // Abrir PDF Static Resource en la página exacta
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

    // Aplicar preset solo a pistas desbloqueadas
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

    // Preview rápido de qué roles toca este preset
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

  isOpen() { return !this.win.classList.contains("hidden"); }
  isPdfOpen() { return !this.pdfModal.classList.contains("hidden"); }
  open() { this.refreshMeta(); this.win.classList.remove("hidden"); }
  close() { this.win.classList.add("hidden"); }
  closePdf() { this.pdfModal.classList.add("hidden"); this.pdfIframe.src = "about:blank"; }
  toggle() { this.isOpen() ? this.close() : this.open(); }
}