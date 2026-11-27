import { SKINS } from "../data/skins.js";
import { ROLES } from "../data/roles.js";
import { COLOR_TEMPLATES, resolveColorTemplateMap } from "../data/colorTemplates.js";
import { store, APP_VERSION } from "../store.js";
import { GRAPHICS_QUALITY_PRESETS } from "../scene/Stage3D.js";
import { abletonService } from "../services/abletonService.js";

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

    // Inyecta controles extra dentro de Preferencias
    this.optGraphicsQuality = this._ensureQualityControl();
    this.optAutoSize = this._ensureAutoSizeControl();
    const extra3d = this._ensureExtra3DControls();
    this.optTrackIcons = extra3d.optTrackIcons;
    this.optTrackNames = extra3d.optTrackNames;
    this.optAutoFadeSilent = extra3d.optAutoFadeSilent;

    const colorCtrls = this._ensureColorTemplateControls();
    this.selColorTemplate = colorCtrls.selColorTemplate;
    this.colorTemplateDesc = colorCtrls.descEl;
    this.colorRolesGrid = colorCtrls.rolesGrid;
    this.btnApplyColorTemplate = colorCtrls.btnApply;
    this.btnResetCustomColors = colorCtrls.btnResetCustom;
    this.colorStatusEl = colorCtrls.statusEl;

    const sessCtrls = this._ensureSessionControls();
    this.btnClearSession = sessCtrls.btnClearSession;
    this.btnClearAllSessions = sessCtrls.btnClearAllSessions;
    this.sessionStatusEl = sessCtrls.statusEl;

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
    this.populateColorTemplates();

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
    this.optTrackIcons?.addEventListener("change", () => store.updateSettings({ showTrackIcons: this.optTrackIcons.checked }));
    this.optTrackNames?.addEventListener("change", () => store.updateSettings({ showTrackNames: this.optTrackNames.checked }));
    this.optAutoFadeSilent?.addEventListener("change", () => store.updateSettings({ autoFadeSilent: this.optAutoFadeSilent.checked }));

    this.selColorTemplate?.addEventListener("change", () => {
      this.selColorTemplate.blur();
      store.updateSettings({ colorTemplate: this.selColorTemplate.value });
      this.renderColorTemplatePreview();
    });

    this.btnApplyColorTemplate?.addEventListener("click", async () => {
      this.btnApplyColorTemplate.blur();
      const tplKey = store.settings.colorTemplate || "art_of_mixing";
      const map = resolveColorTemplateMap(tplKey, store.settings.customRoleColors);
      this.btnApplyColorTemplate.disabled = true;
      try {
        const count = await abletonService.applyColorTemplate(map, { includeBuses: false });
        if (this.colorStatusEl) {
          this.colorStatusEl.textContent = count > 0
            ? `✓ Colores aplicados a ${count} pistas (Ctrl+Z para deshacer).`
            : "Sin pistas desbloqueadas para recolorear.";
        }
      } finally {
        this.btnApplyColorTemplate.disabled = false;
      }
    });

    this.btnResetCustomColors?.addEventListener("click", () => {
      this.btnResetCustomColors.blur();
      store.updateSettings({ customRoleColors: {} });
      this.renderColorTemplatePreview();
      if (this.colorStatusEl) this.colorStatusEl.textContent = "Colores personalizados restablecidos a Gibson.";
    });

    this.btnClearSession?.addEventListener("click", () => {
      this.btnClearSession.blur();
      if (!confirm("¿Borrar el perfil autoguardado del proyecto actual? (No toca nada en Ableton Live.)")) return;
      store.clearCurrentSavedSession();
      this.syncSessionControls("✓ Perfil actual eliminado.");
    });

    this.btnClearAllSessions?.addEventListener("click", () => {
      this.btnClearAllSessions.blur();
      if (!confirm("¿Borrar TODOS los perfiles autoguardados del navegador?")) return;
      store.clearAllSavedSessions();
      this.syncSessionControls("✓ Todos los perfiles guardados fueron eliminados.");
    });

    store.on("settings", () => {
      if (this.isOpen()) this.syncFromStore();
    });
    store.on("session-autosaved", () => { if (this.isOpen()) this.syncSessionControls(); });
    store.on("session-cleared", () => { if (this.isOpen()) this.syncSessionControls(); });

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

  _ensureExtra3DControls() {
    const anchorRow = (this.optDropLines || this.optFloorShadows)?.closest(".setting-row");
    const insertAfter = (ref, id, title, desc) => {
      const existing = document.getElementById(id);
      if (existing) return existing;
      if (!ref?.parentNode) return null;
      const row = document.createElement("div");
      row.className = "setting-row";
      row.innerHTML = `
        <div>
          <strong>${title}</strong>
          <div class="muted-note" style="margin:2px 0 0;">${desc}</div>
        </div>
        <input type="checkbox" id="${id}" />
      `;
      ref.parentNode.insertBefore(row, ref.nextSibling);
      return row.querySelector(`#${id}`);
    };

    const optTrackIcons = insertAfter(
      anchorRow,
      "opt-show-track-icons",
      "Iconos de instrumentos en 3D",
      "Muestra el icono vectorial SVG del rol centrado en la cara frontal de cada esfera."
    );
    const optTrackNames = insertAfter(
      optTrackIcons?.closest(".setting-row") || anchorRow,
      "opt-show-track-names",
      "Nombres de pista en 3D",
      "Muestra el texto con el nombre de cada pista. Podés combinar solo iconos, solo nombres o vista limpia."
    );
    const optAutoFadeSilent = insertAfter(
      optTrackNames?.closest(".setting-row") || anchorRow,
      "opt-auto-fade-silent",
      "Ocultar pistas sin audio durante Play",
      "Desvanece pistas sin clips activos o en silencio al reproducir (vuelven al pausar o apenas entra señal)."
    );

    return { optTrackIcons, optTrackNames, optAutoFadeSilent };
  }

  _ensureColorTemplateControls() {
    let row = document.getElementById("opt-color-template-row");
    if (!row && this.tabPanels.prefs) {
      row = document.createElement("div");
      row.id = "opt-color-template-row";
      row.className = "setting-row";
      row.style.flexDirection = "column";
      row.style.alignItems = "stretch";
      row.style.gap = "8px";
      row.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div>
            <strong>Colores por instrumento (Templates)</strong>
            <div id="opt-color-tpl-desc" class="muted-note" style="margin:2px 0 0;"></div>
          </div>
          <select id="opt-color-template"></select>
        </div>
        <div id="opt-color-roles-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:4px;"></div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button type="button" id="btn-apply-color-template" class="mini-btn">Aplicar colores a la sesión</button>
          <button type="button" id="btn-reset-custom-colors" class="mini-btn hidden">Restablecer mis colores</button>
          <span id="opt-color-status" class="muted-note" style="margin:0;"></span>
        </div>
      `;
      this.tabPanels.prefs.appendChild(row);
    }

    return {
      selColorTemplate: document.getElementById("opt-color-template"),
      descEl: document.getElementById("opt-color-tpl-desc"),
      rolesGrid: document.getElementById("opt-color-roles-grid"),
      btnApply: document.getElementById("btn-apply-color-template"),
      btnResetCustom: document.getElementById("btn-reset-custom-colors"),
      statusEl: document.getElementById("opt-color-status"),
    };
  }

  populateColorTemplates() {
    if (!this.selColorTemplate) return;
    this.selColorTemplate.innerHTML = "";
    const cur = store.settings.colorTemplate || "art_of_mixing";
    Object.entries(COLOR_TEMPLATES).forEach(([key, tpl]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = tpl.name;
      if (key === cur) opt.selected = true;
      this.selColorTemplate.appendChild(opt);
    });
    this.renderColorTemplatePreview();
  }

  renderColorTemplatePreview() {
    if (!this.colorRolesGrid) return;
    const tplKey = store.settings.colorTemplate || "art_of_mixing";
    const tpl = COLOR_TEMPLATES[tplKey] || COLOR_TEMPLATES.art_of_mixing;
    const map = resolveColorTemplateMap(tplKey, store.settings.customRoleColors);
    const isCustom = tplKey === "custom";

    if (this.colorTemplateDesc) this.colorTemplateDesc.textContent = tpl.desc || "";
    this.btnResetCustomColors?.classList.toggle("hidden", !isCustom);

    this.colorRolesGrid.innerHTML = "";
    const editableRoles = Object.entries(ROLES).filter(([k]) => k !== "bus");

    for (const [roleKey, roleCfg] of editableRoles) {
      const hex = map[roleKey] || "#3b82f6";
      const cell = document.createElement("label");
      cell.style.cssText =
        "display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:4px;" +
        "border:1px solid var(--border, rgba(148,163,184,0.22));font-size:10.5px;" +
        (isCustom ? "cursor:pointer;" : "opacity:0.92;");

      const inp = document.createElement("input");
      inp.type = "color";
      inp.value = hex;
      inp.style.cssText = "width:18px;height:18px;padding:0;border:none;background:transparent;cursor:pointer;";
      inp.title = isCustom
        ? `Elegir color para ${roleCfg.label}`
        : `Cambiar color (pasa automáticamente a Personalizado)`;

      inp.addEventListener("change", () => {
        const nextCustom = {
          ...resolveColorTemplateMap(tplKey, store.settings.customRoleColors),
          [roleKey]: inp.value,
        };
        store.updateSettings({ colorTemplate: "custom", customRoleColors: nextCustom });
        if (this.selColorTemplate) this.selColorTemplate.value = "custom";
        this.renderColorTemplatePreview();
      });

      const span = document.createElement("span");
      span.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      span.textContent = roleCfg.label;

      cell.append(inp, span);
      this.colorRolesGrid.appendChild(cell);
    }
  }

  _ensureSessionControls() {
    let row = document.getElementById("opt-session-autosave-row");
    if (!row && this.tabPanels.prefs) {
      row = document.createElement("div");
      row.id = "opt-session-autosave-row";
      row.className = "setting-row";
      row.style.flexDirection = "column";
      row.style.alignItems = "stretch";
      row.style.gap = "8px";
      row.innerHTML = `
        <div>
          <strong>Perfiles autoguardados por proyecto</strong>
          <div class="muted-note" style="margin:2px 0 0;">
            Owls guarda tus roles 3D, alturas Y, grupos virtuales, bancos A/B/C/D y escenas por cada proyecto de Ableton y los restaura solos al volver a abrirlo.
          </div>
          <div id="opt-session-status" class="muted-note" style="margin:4px 0 0;"></div>
        </div>
        <div id="opt-sessions-list" style="display:flex;flex-direction:column;gap:4px;max-height:150px;overflow-y:auto;"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" id="btn-clear-current-session" class="mini-btn">Limpiar perfil actual</button>
          <button type="button" id="btn-clear-all-sessions" class="mini-btn">Borrar todos</button>
        </div>
      `;
      this.tabPanels.prefs.appendChild(row);
    }

    this.sessionsListEl = document.getElementById("opt-sessions-list");
    return {
      btnClearSession: document.getElementById("btn-clear-current-session"),
      btnClearAllSessions: document.getElementById("btn-clear-all-sessions"),
      statusEl: document.getElementById("opt-session-status"),
    };
  }

  syncSessionControls(customMsg = "") {
    const sessions = store.listSavedSessions();
    const count = sessions.length;

    if (this.btnClearAllSessions) {
      this.btnClearAllSessions.textContent = `Borrar todos (${count})`;
      this.btnClearAllSessions.disabled = count === 0;
    }
    if (this.btnClearSession) {
      const hasCurrent = sessions.some((s) => s.isCurrent);
      this.btnClearSession.disabled = !hasCurrent;
    }
    if (this.sessionStatusEl) {
      if (customMsg) {
        this.sessionStatusEl.textContent = customMsg;
      } else {
        const lastStr = store.lastAutosaveAt
          ? `Último guardado: ${new Date(store.lastAutosaveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Sin autoguardado activo en el proyecto actual";
        this.sessionStatusEl.textContent = `${lastStr} · ${count} perfil(es) en este navegador.`;
      }
    }

    if (!this.sessionsListEl) return;
    this.sessionsListEl.innerHTML = "";
    if (count === 0) return;

    for (const s of sessions) {
      const itemRow = document.createElement("div");
      itemRow.style.cssText =
        "display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;" +
        "border:1px solid var(--border, rgba(148,163,184,0.22));font-size:11px;";

      const dt = s.updatedAt ? new Date(s.updatedAt) : null;
      const dateStr = dt
        ? `${dt.toLocaleDateString([], { day: "2-digit", month: "2-digit" })} ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "";

      const info = document.createElement("div");
      info.style.cssText = "flex:1;min-width:0;overflow:hidden;";
      const topLine = document.createElement("div");
      topLine.style.cssText = "font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      topLine.textContent = `${s.isCurrent ? "● Actual · " : ""}${s.trackCount} pistas · ${dateStr}`;
      const subLine = document.createElement("div");
      subLine.style.cssText = "font-size:10px;opacity:0.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      subLine.textContent = s.previewNames || "(sin nombres)";
      info.append(topLine, subLine);
      itemRow.appendChild(info);

      if (!s.isCurrent && store.tracks.length > 0) {
        const btnApply = document.createElement("button");
        btnApply.type = "button";
        btnApply.className = "mini-btn";
        btnApply.textContent = "Aplicar";
        btnApply.title = "Recuperar roles 3D, bancos y escenas de este perfil sobre el proyecto abierto";
        btnApply.addEventListener("click", () => {
          btnApply.blur();
          if (store.loadSavedSessionByKey(s.key)) {
            this.syncSessionControls("✓ Perfil aplicado al proyecto actual.");
          }
        });
        itemRow.appendChild(btnApply);
      }

      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "icon-btn";
      btnDel.textContent = "×";
      btnDel.title = "Eliminar este perfil guardado";
      btnDel.addEventListener("click", () => {
        btnDel.blur();
        store.deleteSavedSession(s.key);
        this.syncSessionControls();
      });
      itemRow.appendChild(btnDel);

      this.sessionsListEl.appendChild(itemRow);
    }
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
    if (this.optTrackIcons) this.optTrackIcons.checked = s.showTrackIcons !== false;
    if (this.optTrackNames) this.optTrackNames.checked = s.showTrackNames !== false;
    if (this.optAutoFadeSilent) this.optAutoFadeSilent.checked = Boolean(s.autoFadeSilent);
    if (this.selColorTemplate) this.selColorTemplate.value = s.colorTemplate || "art_of_mixing";
    this.renderColorTemplatePreview();
    this.syncSessionControls();
  }
}