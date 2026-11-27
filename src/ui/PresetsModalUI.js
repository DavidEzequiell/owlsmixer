import { PRESETS, computePresetRelativeOffsetDb, resolvePresetTrackVol } from "../data/presets.js";
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

    // Control de modo Relativo inyectado encima del botón Aplicar
    const relControls = this._ensureRelativeControl();
    this.chkRelative = relControls.chkRelative;
    this.relWrap = relControls.wrap;
    this.relMetaEl = relControls.metaEl;

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

  _ensureRelativeControl() {
    let wrap = document.getElementById("preset-relative-wrap");
    if (!wrap && this.btnApply?.parentElement) {
      wrap = document.createElement("div");
      wrap.id = "preset-relative-wrap";
      wrap.style.cssText =
        "margin:8px 0 6px;padding:6px 8px;border-radius:6px;border:1px solid var(--border, rgba(148,163,184,0.28));" +
        "background:rgba(148,163,184,0.07);display:flex;flex-direction:column;gap:3px;";
      wrap.innerHTML = `
        <label style="display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;cursor:pointer;user-select:none;">
          <input type="checkbox" id="chk-preset-relative" />
          <span>Mantener volumen promedio actual (relativo)</span>
        </label>
        <div id="preset-relative-meta" style="font-size:10.5px;opacity:0.78;padding-left:20px;"></div>
      `;
      this.btnApply.parentElement.insertBefore(wrap, this.btnApply);
    }

    const chkRelative = document.getElementById("chk-preset-relative");
    const metaEl = document.getElementById("preset-relative-meta");
    if (chkRelative) chkRelative.checked = Boolean(store.settings.presetRelativeVol);
    return { wrap, chkRelative, metaEl };
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

    this.chkRelative?.addEventListener("change", () => {
      this.chkRelative.blur();
      store.updateSettings({ presetRelativeVol: this.chkRelative.checked });
      this.refreshMeta();
    });

    store.on("tracks-loaded", () => {
      if (this.isOpen()) this.refreshMeta();
    });
    store.on("settings", () => {
      if (this.chkRelative) this.chkRelative.checked = Boolean(store.settings.presetRelativeVol);
      if (this.isOpen()) this.refreshMeta();
    });

    this.btnPdfRef.addEventListener("click", () => {
      const preset = PRESETS[this.select.value];
      if (!preset || !preset.pdfPage) return;
      const page = preset.pdfPage;
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
      if (!preset || this.btnApply.disabled) return;

      const relativeVolume = Boolean(this.chkRelative?.checked) && !preset.isDefaultDry;
      const prevText = this.btnApply.textContent;
      this.btnApply.disabled = true;
      this.btnApply.textContent = "Aplicando...";
      try {
        const applied = await abletonService.applyPreset(preset, { relativeVolume });
        if (applied) {
          this.onPresetApplied?.();
          this.refreshMeta();
        }
      } finally {
        this.btnApply.disabled = false;
        this.btnApply.textContent = prevText;
      }
    });
  }

  refreshMeta() {
    const p = PRESETS[this.select.value];
    if (!p) return;
    this.btnPdfRef.disabled = !p.pdfPage;
    this.refBadge.textContent = p.ref || "Sin referencia PDF";
    this.descEl.textContent = p.desc || "";

    const isDry = Boolean(p.isDefaultDry);
    if (this.chkRelative) this.chkRelative.disabled = isDry;
    if (this.relWrap) this.relWrap.style.opacity = isDry ? "0.55" : "1";

    const useRelative = Boolean(this.chkRelative?.checked) && !isDry;
    const relInfo = useRelative
      ? computePresetRelativeOffsetDb(p, store.tracks)
      : { offsetDb: 0, avgCurrentDb: null, avgPresetDb: null, matchedCount: 0 };

    if (this.relMetaEl) {
      if (isDry) {
        this.relMetaEl.textContent = "No aplica en Default Dry (siempre lleva los faders a 0.0 dB).";
      } else if (!useRelative) {
        this.relMetaEl.textContent = "Modo absoluto: aplica los niveles originales de Gibson + Pan + Reverb.";
      } else if (relInfo.matchedCount === 0) {
        this.relMetaEl.textContent = "Sin pistas con roles coincidentes aún (asigná roles para calcular offset).";
      } else {
        const sign = relInfo.offsetDb >= 0 ? "+" : "";
        this.relMetaEl.textContent =
          `Promedio actual (${relInfo.matchedCount} pistas): ${relInfo.avgCurrentDb.toFixed(1)} dB · ` +
          `Offset aplicado: ${sign}${relInfo.offsetDb.toFixed(1)} dB`;
      }
    }

    this.previewEl.innerHTML = "";
    if (isDry) {
      ["● Todas: C · 0.0 dB", "Send A: 0%", "EQ Eight: OFF", "Esfera · 1.00x"].forEach((txt) => {
        const tag = document.createElement("span");
        tag.className = "preset-role-tag";
        tag.textContent = txt;
        this.previewEl.appendChild(tag);
      });
      return;
    }

    const unit = store.settings.volUnit;
    Object.entries(p.roles).forEach(([roleKey, cfg]) => {
      const tag = document.createElement("span");
      tag.className = "preset-role-tag";
      const label = ROLES[roleKey]?.label || roleKey;
      const shapeIcon = cfg.shape === "oblong" ? "⬭" : "●";
      const previewVol = useRelative ? resolvePresetTrackVol(cfg.vol, relInfo.offsetDb) : cfg.vol;
      tag.textContent = `${shapeIcon} ${label}: ${formatPan(cfg.pan)} · ${formatVolume(previewVol, unit)}`;
      this.previewEl.appendChild(tag);
    });
  }

  isOpen() { return this.windowManager.isWindowOpen("presets"); }
  isPdfOpen() { return !this.pdfModal.classList.contains("hidden"); }
  open() {
    this.windowManager.setWindowOpen("presets", true);
    this.refreshMeta();
  }
  close() { this.windowManager.setWindowOpen("presets", false); }
  closePdf() { this.pdfModal.classList.add("hidden"); this.pdfIframe.src = "about:blank"; }
  toggle() {
    this.windowManager.toggleWindow("presets");
    if (this.isOpen()) this.refreshMeta();
  }
}