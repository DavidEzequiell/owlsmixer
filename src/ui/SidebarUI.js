import { ROLES } from "../data/roles.js";
import { ABLETON_QUICK_SWATCHES } from "../data/colorTemplates.js";
import {
  store, clamp, formatVolume, formatPan, yToFreq, formatFreq,
  abletonVolToDb, getApparentVolumeLevel,
} from "../store.js";
import { abletonService } from "../services/abletonService.js";
import { getGibsonQuickEqForRole } from "../data/eqBands.js";

export class SidebarUI {
  constructor({ onTrackVisualChanged, onOrbLabelChanged }) {
    this.onTrackVisualChanged = onTrackVisualChanged;
    this.onOrbLabelChanged = onOrbLabelChanged;

    // Return A Reverb
    this.revDeviceName = document.getElementById("reverb-device-name");
    this.slRevDecay = document.getElementById("sl-rev-decay");
    this.valRevDecay = document.getElementById("val-rev-decay");
    this.slRevPre = document.getElementById("sl-rev-predelay");
    this.valRevPre = document.getElementById("val-rev-predelay");
    this.chkHideReverb3D = document.getElementById("chk-hide-reverb-3d");

    // Grupos
    this.groupsBar = document.getElementById("groups-bar");
    this.btnNewVGroup = document.getElementById("btn-new-vgroup");
    this.btnClearSel = document.getElementById("btn-clear-sel");
    this.chkShowBuses = document.getElementById("chk-show-buses");

    // Inspector
    this.inspName = document.getElementById("insp-name");
    this.inspRoleBadge = document.getElementById("insp-role-badge");
    this.inspSingle = document.getElementById("inspector-single");
    this.inspMulti = document.getElementById("inspector-multi");

    this.slPan = document.getElementById("sl-pan");
    this.valPan = document.getElementById("val-pan");
    this.slVol = document.getElementById("sl-vol");
    this.valVol = document.getElementById("val-vol");
    this.slSend = document.getElementById("sl-send");
    this.valSend = document.getElementById("val-send");
    this.slY = document.getElementById("sl-y");
    this.valY = document.getElementById("val-y");
    this.yReadonlyHint = document.getElementById("y-readonly-hint");
    this.slSize = document.getElementById("sl-size");
    this.valSize = document.getElementById("val-size");
    this.btnToggleShape = document.getElementById("btn-toggle-shape");
    this.btnToggleLock = document.getElementById("btn-toggle-lock");
    this.eqTipBox = document.getElementById("eq-tip-box");

    // Popover de color
    this.colorPopover = document.getElementById("color-popover");
    this.colorPopoverTitle = document.getElementById("color-popover-title");
    this.btnCloseColorPopover = document.getElementById("btn-close-color-popover");
    this.colorSwatchesEl = document.getElementById("color-swatches");
    this.inpCustomColor = document.getElementById("inp-custom-color");
    this.colorTargetTrack = null;

    this.slGrpPan = document.getElementById("sl-grp-pan");
    this.valGrpPan = document.getElementById("val-grp-pan");
    this.slGrpVol = document.getElementById("sl-grp-vol");
    this.valGrpVol = document.getElementById("val-grp-vol");
    this.slGrpSend = document.getElementById("sl-grp-send");
    this.valGrpSend = document.getElementById("val-grp-send");
    this.slGrpSpread = document.getElementById("sl-grp-spread");
    this.valGrpSpread = document.getElementById("val-grp-spread");

    this.trackCountEl = document.getElementById("track-count");
    this.trackListEl = document.getElementById("track-list");

    this.multiSliderActive = false;
    this.multiBeforeSnapshot = null;
    this.multiBase = [];
    this.multiBaseAvg = { pan: 0, vol: 0, sendA: 0 };
    this.draggedTrackId = null;
    this.activeSingleSlider = null;
    this.singleSliderBefore = null;
    this._suppressNextScrollFocus = false;

    this.btnQuickEq = document.getElementById("btn-quick-eq");
    this.btnOpenEqWin = document.getElementById("btn-open-eq-win");

    this.trackSearchQuery = "";
    this.trackFilterMode = "all"; // "all" | "eq" | "visible"

    this.initCollapsibleSections();
    this.initReverbUI();
    this.initGroupsUI();
    this.initInspectorUI();
    this.initColorPickerUI();
    this.initTrackSearchUI();
    this.initScenesUI();
    this.initSliderDoubleClickResets();

    store.on("session-autosaved", () => this.updateAutosaveBadge(false));
    store.on("session-restored", () => this.updateAutosaveBadge(true));
    store.on("session-cleared", () => {
      if (!this.autosaveBadge) return;
      this.autosaveBadge.textContent = "💾 Limpiado";
      this.autosaveBadge.classList.remove("saved-ok");
      clearTimeout(this._autosaveBadgeTimer);
      this._autosaveBadgeTimer = setTimeout(() => {
        if (this.autosaveBadge) this.autosaveBadge.textContent = "💾 Auto";
      }, 2200);
    });
  }

  _normalizeSearch(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  initTrackSearchUI() {
    if (!this.trackListEl?.parentNode) return;

    if (this.trackCountEl?.parentNode && !document.getElementById("autosave-badge")) {
      const badge = document.createElement("button");
      badge.type = "button";
      badge.id = "autosave-badge";
      badge.className = "autosave-badge";
      badge.textContent = "💾 Auto";
      badge.title = "Autoguardado por sesión activo (clic para guardar ahora · gestionar perfiles en ⚙ Opciones)";
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        badge.blur();
        store.saveSessionNow();
      });
      this.trackCountEl.parentNode.insertBefore(badge, this.trackCountEl);
      this.autosaveBadge = badge;
    } else {
      this.autosaveBadge = document.getElementById("autosave-badge");
    }

    const bar = document.createElement("div");
    bar.className = "track-search-bar";
    bar.innerHTML = `
      <div class="track-search-input-wrap">
        <span class="track-search-icon" aria-hidden="true">⌕</span>
        <input id="track-search-input" class="track-search-input" type="text" placeholder="Buscar pista, rol o grupo... (Ctrl+F)" autocomplete="off" spellcheck="false" />
        <button type="button" id="btn-clear-search" class="track-search-clear hidden" title="Limpiar búsqueda (Esc)">×</button>
      </div>
      <div class="track-filter-chips" role="group" aria-label="Filtro rápido de pistas">
        <button type="button" class="track-filter-chip active" data-filter="all">Todas</button>
        <button type="button" class="track-filter-chip" data-filter="eq" title="Solo pistas con EQ detectado">EQ</button>
        <button type="button" class="track-filter-chip" data-filter="visible" title="Solo pistas visibles y sin mute">Activas</button>
      </div>
    `;
    this.trackListEl.parentNode.insertBefore(bar, this.trackListEl);

    this.inpTrackSearch = bar.querySelector("#track-search-input");
    this.btnClearSearch = bar.querySelector("#btn-clear-search");
    this.filterChipBtns = bar.querySelectorAll(".track-filter-chip");

    const syncClearBtn = () => {
      const active = Boolean(this.trackSearchQuery || this.trackFilterMode !== "all");
      this.btnClearSearch.classList.toggle("hidden", !active);
    };

    this.inpTrackSearch.addEventListener("input", () => {
      this.trackSearchQuery = this.inpTrackSearch.value.trim();
      syncClearBtn();
      this.renderTrackList();
    });

    this.inpTrackSearch.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        this.clearTrackSearch();
        this.inpTrackSearch.blur();
      }
    });

    this.btnClearSearch.addEventListener("click", () => {
      this.btnClearSearch.blur();
      this.clearTrackSearch();
    });

    this.filterChipBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.blur();
        this.trackFilterMode = btn.dataset.filter || "all";
        this.filterChipBtns.forEach((b) => b.classList.toggle("active", b === btn));
        syncClearBtn();
        this.renderTrackList();
      });
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (document.body.classList.contains("sidebar-hidden")) {
          document.body.classList.remove("sidebar-hidden");
          window.dispatchEvent(new Event("resize"));
        }
        this.inpTrackSearch.focus();
        this.inpTrackSearch.select();
      }
    });
  }

  clearTrackSearch() {
    this.trackSearchQuery = "";
    this.trackFilterMode = "all";
    if (this.inpTrackSearch) this.inpTrackSearch.value = "";
    this.btnClearSearch?.classList.add("hidden");
    this.filterChipBtns?.forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
    this.renderTrackList();
  }

  updateAutosaveBadge(restored = false) {
    if (!this.autosaveBadge) return;
    const dt = store.lastAutosaveAt ? new Date(store.lastAutosaveAt) : new Date();
    const hhmm = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const banksCount = Object.values(store.banks).filter(Boolean).length;
    this.autosaveBadge.textContent = restored ? "💾 Restaurada" : "💾 Guardado";
    this.autosaveBadge.title = restored
      ? `Sesión restaurada (${hhmm}) · ${banksCount} banco(s) y ${store.virtualGroups.length} grupo(s) · Clic para guardar ahora`
      : `Último autoguardado: ${hhmm} · ${banksCount} banco(s) · Clic para guardar ahora`;
    this.autosaveBadge.classList.add("saved-ok");
    clearTimeout(this._autosaveBadgeTimer);
    this._autosaveBadgeTimer = setTimeout(() => {
      if (!this.autosaveBadge) return;
      this.autosaveBadge.textContent = "💾 Auto";
      this.autosaveBadge.classList.remove("saved-ok");
    }, 2200);
  }

  matchesTrackFilter(item, groupLabel = "") {
    if (this.trackFilterMode === "eq" && !item.eq?.hasDevice) return false;
    if (this.trackFilterMode === "visible" && (item.hidden || item.mute)) return false;

    if (!this.trackSearchQuery) return true;
    const q = this._normalizeSearch(this.trackSearchQuery);
    const roleLabel = ROLES[item.role]?.label || item.role || "";
    const haystack = this._normalizeSearch(`${item.name} ${roleLabel} ${groupLabel}`);
    return haystack.includes(q);
  }

  initCollapsibleSections() {
    document.querySelectorAll(".collapsible-section").forEach((sec) => {
      const title = sec.querySelector(".clickable-title");
      const arrow = sec.querySelector(".sec-arrow");
      if (!title) return;
      title.addEventListener("click", () => {
        const collapsed = sec.classList.toggle("collapsed");
        if (arrow) arrow.textContent = collapsed ? "▶" : "▼";
      });
    });
  }

  initReverbUI() {
    this.slRevDecay.addEventListener("input", () => abletonService.setReverbDecay(parseFloat(this.slRevDecay.value)));
    this.slRevDecay.addEventListener("change", () => abletonService.setReverbDecay(parseFloat(this.slRevDecay.value), true));
    this.slRevPre.addEventListener("input", () => abletonService.setReverbPredelay(parseFloat(this.slRevPre.value)));
    this.slRevPre.addEventListener("change", () => abletonService.setReverbPredelay(parseFloat(this.slRevPre.value), true));

    this.chkHideReverb3D.checked = !store.settings.showReverbCubes;
    this.chkHideReverb3D.addEventListener("change", () => {
      store.updateSettings({ showReverbCubes: !this.chkHideReverb3D.checked });
    });
  }

  updateReverbUI() {
    const r = store.reverbInfo;
    this.revDeviceName.textContent = r.connected ? r.adapterName : r.deviceName;
    this.slRevDecay.disabled = !r.decayParam;
    this.slRevPre.disabled = !r.predelayParam;
    this.slRevDecay.value = r.decay;
    this.slRevPre.value = r.predelay;
    this.valRevDecay.textContent = r.decayParam ? `${Math.round(r.decay * 100)}%` : "--";
    this.valRevPre.textContent = r.predelayParam ? `${Math.round(r.predelay * 100)}%` : "--";
    this.chkHideReverb3D.checked = !store.settings.showReverbCubes;
  }

  initGroupsUI() {
    this.btnClearSel.addEventListener("click", () => store.setSelection([]));
    this.chkShowBuses.addEventListener("change", () => {
      store.showBuses = this.chkShowBuses.checked;
      this.onTrackVisualChanged();
    });

    this.btnNewVGroup.addEventListener("click", () => {
      this.btnNewVGroup.blur();
      const name = prompt("Nombre del grupo virtual (ej. Guitarras, Voces):");
      if (!name || !name.trim()) return;
      const before = store.captureSnapshot();
      const vg = store.createVirtualGroup(name);
      store.getSelectedTracks().filter((t) => !t.isGroup).forEach((t) => (t.vGroupId = vg.id));
      store.pushHistory(before);
      this.renderGroupsBar();
      this.renderTrackList();
    });
  }

  renderGroupsBar() {
    this.groupsBar.innerHTML = "";

    const buses = store.tracks.filter((t) => t.isGroup);
    buses.forEach((bus) => {
      const children = store.tracks.filter((t) => t.groupId === bus.id);
      if (children.length === 0) return;
      const ids = children.map((c) => c.id);
      const btn = document.createElement("button");
      btn.className = "group-chip";
      btn.dataset.ids = ids.join(",");
      btn.innerHTML = `<span class="track-swatch" style="background:${bus.colorHex}"></span>📁 ${bus.name} (${children.length})`;
      btn.addEventListener("click", () => { btn.blur(); store.setSelection(ids); });
      this.groupsBar.appendChild(btn);
    });

    store.virtualGroups.forEach((vg) => {
      const children = store.tracks.filter((t) => t.vGroupId === vg.id);
      const ids = children.map((c) => c.id);
      const btn = document.createElement("button");
      btn.className = "group-chip";
      btn.dataset.ids = ids.join(",");
      btn.innerHTML = `<span class="track-swatch" style="background:${vg.color}"></span>◈ ${vg.name} (${children.length})`;
      btn.addEventListener("click", () => { btn.blur(); if (ids.length) store.setSelection(ids); });

      btn.addEventListener("dragover", (e) => { e.preventDefault(); btn.classList.add("drop-over"); });
      btn.addEventListener("dragleave", () => btn.classList.remove("drop-over"));
      btn.addEventListener("drop", (e) => {
        e.preventDefault();
        btn.classList.remove("drop-over");
        if (this.draggedTrackId) store.assignTrackToVirtualGroup(this.draggedTrackId, vg.id);
      });
      this.groupsBar.appendChild(btn);
    });

    const nonBusIds = store.tracks.filter((t) => !t.isGroup && !t.locked && !t.hidden).map((t) => t.id);
    if (nonBusIds.length > 1) {
      const btnAll = document.createElement("button");
      btnAll.className = "group-chip";
      btnAll.dataset.ids = nonBusIds.join(",");
      btnAll.textContent = `✦ Todas (${nonBusIds.length})`;
      btnAll.addEventListener("click", () => { btnAll.blur(); store.setSelection(nonBusIds); });
      this.groupsBar.appendChild(btnAll);
    }

    if (this.groupsBar.children.length === 0) {
      this.groupsBar.innerHTML = `<span style="font-size:11px; color:var(--text-muted)">Creá "+ Grupo" y arrastrá pistas adentro, o usá Ctrl+G en Ableton.</span>`;
    }
    this.syncSelectionHighlights();
  }

  initInspectorUI() {
    const startSingle = (sl) => {
      const sel = store.getSelectedTracks();
      if (sel.length !== 1 || sel[0].locked) return;
      if (sl === this.slY && !sel[0].eq?.hasDevice) return;
      this.activeSingleSlider = sl;
      this.singleSliderBefore = store.captureSnapshot();
      sel[0].isDragging = true;
    };
    const endSingle = () => {
      if (!this.activeSingleSlider && !this.singleSliderBefore) return;
      const sel = store.getSelectedTracks();
      const wasY = this.activeSingleSlider === this.slY;
      this.activeSingleSlider = null;

      if (sel.length === 1) {
        const item = sel[0];
        item._ableton.setPanLive(item.pan, true);
        item._ableton.setVolLive(item.vol, true);
        item._ableton.setSendALive(item.sendA, true);
        if (wasY && item.eq?.hasDevice) {
          abletonService.applyYAxisTiltEq(item, { immediate: true });
        }
        item.isDragging = false;
      }
      if (this.singleSliderBefore) {
        store.pushHistory(this.singleSliderBefore);
        this.singleSliderBefore = null;
      }
    };

    [this.slPan, this.slVol, this.slSend, this.slY, this.slSize].forEach((sl) => {
      sl.addEventListener("pointerdown", () => startSingle(sl));
      sl.addEventListener("pointerup", endSingle);
      sl.addEventListener("change", endSingle);
    });

    this.slPan.addEventListener("input", () => {
      const sel = store.getSelectedTracks();
      if (sel.length !== 1 || sel[0].locked) return;
      sel[0].pan = parseFloat(this.slPan.value);
      sel[0]._ableton.setPanLive(sel[0].pan);
      this.onTrackVisualChanged(sel[0]);
      this.updateInspector();
    });

    this.slVol.addEventListener("input", () => {
      const sel = store.getSelectedTracks();
      if (sel.length !== 1 || sel[0].locked) return;
      sel[0].vol = parseFloat(this.slVol.value);
      sel[0]._ableton.setVolLive(sel[0].vol);
      this.onTrackVisualChanged(sel[0]);
      this.updateInspector();
    });

    this.slSend.addEventListener("input", () => {
      const sel = store.getSelectedTracks();
      if (sel.length !== 1 || sel[0].locked) return;
      sel[0].sendA = parseFloat(this.slSend.value);
      sel[0]._ableton.setSendALive(sel[0].sendA);
      this.onTrackVisualChanged(sel[0]);
      this.updateInspector();
    });

    this.slY.addEventListener("input", () => {
      const sel = store.getSelectedTracks();
      if (sel.length !== 1 || sel[0].locked || !sel[0].eq?.hasDevice) return;
      sel[0].y = parseFloat(this.slY.value);
      abletonService.applyYAxisTiltEq(sel[0], { immediate: false });
      this.onTrackVisualChanged(sel[0]);
      this.updateInspector();
    });

    this.slSize.addEventListener("input", () => {
      const sel = store.getSelectedTracks();
      if (sel.length !== 1 || sel[0].locked) return;
      sel[0].sizeScale = parseFloat(this.slSize.value);
      this.onTrackVisualChanged(sel[0]);
      this.updateInspector();
    });

    this.btnToggleShape.addEventListener("click", () => {
      this.btnToggleShape.blur();
      const sel = store.getSelectedTracks();
      if (sel.length !== 1) return;
      store.pushHistory(store.captureSnapshot());
      sel[0].shape = sel[0].shape === "oblong" ? "sphere" : "oblong";
      this.onTrackVisualChanged(sel[0]);
      this.updateInspector();
    });

    this.btnToggleLock.addEventListener("click", () => {
      this.btnToggleLock.blur();
      const sel = store.getSelectedTracks();
      if (sel.length !== 1) return;
      this.toggleLock(sel[0]);
    });

    this.btnQuickEq.addEventListener("click", async () => {
      this.btnQuickEq.blur();
      const sel = store.getSelectedTracks();
      if (sel.length !== 1 || sel[0].locked || !sel[0].eq?.hasDevice) return;
      const presetBands = getGibsonQuickEqForRole(sel[0].role);
      await abletonService.applyEqPreset(sel[0], presetBands, true);
      this.updateInspector();
    });

    this.btnOpenEqWin.addEventListener("click", () => {
      this.btnOpenEqWin.blur();
      store.setViewMode(store.viewMode === "eq" ? "mix" : "eq");
    });

    // Sliders de Conjunto
    const beginMulti = () => {
      const sel = store.getSelectedTracks().filter((t) => !t.locked);
      if (sel.length < 2) return;
      this.multiSliderActive = true;
      this.multiBeforeSnapshot = store.captureSnapshot();
      this.multiBase = sel.map((item) => {
        item.isDragging = true;
        return { item, pan: item.pan, vol: item.vol, sendA: item.sendA };
      });
      this.multiBaseAvg = {
        pan: sel.reduce((a, b) => a + b.pan, 0) / sel.length,
        vol: sel.reduce((a, b) => a + b.vol, 0) / sel.length,
        sendA: sel.reduce((a, b) => a + b.sendA, 0) / sel.length,
      };
    };

    const endMulti = () => {
      if (!this.multiSliderActive) return;
      for (const b of this.multiBase) {
        b.item._ableton.setPanLive(b.item.pan, true);
        b.item._ableton.setVolLive(b.item.vol, true);
        b.item._ableton.setSendALive(b.item.sendA, true);
        b.item.isDragging = false;
      }
      if (this.multiBeforeSnapshot) store.pushHistory(this.multiBeforeSnapshot);
      this.multiSliderActive = false;
      this.multiBeforeSnapshot = null;
      this.multiBase = [];
      this.updateInspector();
    };

    [this.slGrpPan, this.slGrpVol, this.slGrpSend, this.slGrpSpread].forEach((sl) => {
      sl.addEventListener("pointerdown", beginMulti);
      sl.addEventListener("pointerup", endMulti);
      sl.addEventListener("change", endMulti);
    });

    this.slGrpPan.addEventListener("input", () => {
      if (!this.multiSliderActive) beginMulti();
      const targetAvg = parseFloat(this.slGrpPan.value);
      const delta = targetAvg - this.multiBaseAvg.pan;
      this.valGrpPan.textContent = formatPan(targetAvg);
      for (const b of this.multiBase) {
        b.item.pan = clamp(b.pan + delta, -1, 1);
        b.item._ableton.setPanLive(b.item.pan);
      }
      this.onTrackVisualChanged();
    });

    this.slGrpVol.addEventListener("input", () => {
      if (!this.multiSliderActive) beginMulti();
      const targetAvg = parseFloat(this.slGrpVol.value);
      const delta = targetAvg - this.multiBaseAvg.vol;
      this.valGrpVol.textContent = formatVolume(targetAvg, store.settings.volUnit);
      for (const b of this.multiBase) {
        b.item.vol = clamp(b.vol + delta, 0, 1);
        b.item._ableton.setVolLive(b.item.vol);
      }
      this.onTrackVisualChanged();
    });

    this.slGrpSend.addEventListener("input", () => {
      if (!this.multiSliderActive) beginMulti();
      const targetAvg = parseFloat(this.slGrpSend.value);
      const delta = targetAvg - this.multiBaseAvg.sendA;
      this.valGrpSend.textContent = `${Math.round(targetAvg * 100)}%`;
      for (const b of this.multiBase) {
        b.item.sendA = clamp(b.sendA + delta, 0, 1);
        b.item._ableton.setSendALive(b.item.sendA);
      }
      this.onTrackVisualChanged();
    });

    this.slGrpSpread.addEventListener("input", () => {
      if (!this.multiSliderActive) beginMulti();
      const factor = parseFloat(this.slGrpSpread.value);
      this.valGrpSpread.textContent = `${Math.round(factor * 100)}%`;
      for (const b of this.multiBase) {
        b.item.pan = clamp(this.multiBaseAvg.pan + (b.pan - this.multiBaseAvg.pan) * factor, -1, 1);
        b.item._ableton.setPanLive(b.item.pan);
      }
      this.onTrackVisualChanged();
    });
  }

  initSliderDoubleClickResets() {
    const resetSingle = (slider, applyFn) => {
      slider?.addEventListener("dblclick", () => {
        if (slider.disabled) return;
        const sel = store.getSelectedTracks();
        if (sel.length !== 1 || sel[0].locked) return;
        store.pushHistory(store.captureSnapshot());
        applyFn(sel[0]);
        this.onTrackVisualChanged(sel[0]);
        this.updateInspector();
      });
    };

    resetSingle(this.slPan, (item) => {
      item.pan = 0;
      item._ableton.setPanLive(0, true);
    });
    resetSingle(this.slVol, (item) => {
      item.vol = 0.85;
      item._ableton.setVolLive(0.85, true);
    });
    resetSingle(this.slSend, (item) => {
      item.sendA = 0;
      item._ableton.setSendALive(0, true);
    });
    resetSingle(this.slY, (item) => {
      if (!item.eq?.hasDevice) return;
      item.y = ROLES[item.role]?.defaultY ?? 0;
      abletonService.applyYAxisTiltEq(item, { immediate: true });
    });
    resetSingle(this.slSize, (item) => {
      item.sizeScale = 1.0;
    });

    const resetMulti = (slider, applyFn) => {
      slider?.addEventListener("dblclick", () => {
        const sel = store.getSelectedTracks().filter((t) => !t.locked);
        if (sel.length < 2) return;
        store.pushHistory(store.captureSnapshot());
        sel.forEach(applyFn);
        this.onTrackVisualChanged();
        this.updateInspector();
      });
    };

    resetMulti(this.slGrpPan, (item) => {
      item.pan = 0;
      item._ableton.setPanLive(0, true);
    });
    resetMulti(this.slGrpVol, (item) => {
      item.vol = 0.85;
      item._ableton.setVolLive(0.85, true);
    });
    resetMulti(this.slGrpSend, (item) => {
      item.sendA = 0;
      item._ableton.setSendALive(0, true);
    });

    this.slRevDecay?.addEventListener("dblclick", () => {
      if (this.slRevDecay.disabled) return;
      abletonService.setReverbDecay(0.5, true);
    });
    this.slRevPre?.addEventListener("dblclick", () => {
      if (this.slRevPre.disabled) return;
      abletonService.setReverbPredelay(0.2, true);
    });
  }

  initColorPickerUI() {
    // Asegura que el popover viva directo en <body> (nunca atrapado dentro de un modal .hidden)
    if (this.colorPopover && this.colorPopover.parentElement !== document.body) {
      document.body.appendChild(this.colorPopover);
    }

    this.colorSwatchesEl.innerHTML = "";
    ABLETON_QUICK_SWATCHES.forEach((hex) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch-btn";
      btn.dataset.hex = hex;
      btn.style.background = hex;
      btn.title = hex;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        btn.blur();
        if (!this.colorTargetTrack) return;
        abletonService.setTrackColor(this.colorTargetTrack, hex, true);
        this.closeColorPopover();
      });
      this.colorSwatchesEl.appendChild(btn);
    });

    this.inpCustomColor.addEventListener("change", () => {
      if (!this.colorTargetTrack) return;
      abletonService.setTrackColor(this.colorTargetTrack, this.inpCustomColor.value, true);
      this.closeColorPopover();
    });

    this.btnCloseColorPopover?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeColorPopover();
    });

    document.addEventListener("pointerdown", (e) => {
      if (
        this.colorPopover &&
        !this.colorPopover.classList.contains("hidden") &&
        !this.colorPopover.contains(e.target) &&
        !e.target.closest?.(".track-swatch-btn")
      ) {
        this.closeColorPopover();
      }
    });
  }
  openColorPopover(item, clientX, clientY) {
    if (!this.colorPopover || !item) return;

    if (!this.colorPopover.classList.contains("hidden") && this.colorTargetTrack?.id === item.id) {
      this.closeColorPopover();
      return;
    }

    this.colorTargetTrack = item;
    this.colorPopoverTitle.textContent = item.name;
    this.inpCustomColor.value = /^#[0-9a-f]{6}$/i.test(item.colorHex) ? item.colorHex : "#3b82f6";
    this.colorSwatchesEl.querySelectorAll(".swatch-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.hex.toLowerCase() === item.colorHex.toLowerCase());
    });

    this.colorPopover.style.zIndex = "9600";
    this.colorPopover.classList.remove("hidden");
    const pw = this.colorPopover.offsetWidth || 198;
    const ph = this.colorPopover.offsetHeight || 150;
    const left = Math.max(8, Math.min(window.innerWidth - pw - 8, clientX - pw + 24));
    const top = Math.max(8, Math.min(window.innerHeight - ph - 8, clientY + 10));
    this.colorPopover.style.left = `${left}px`;
    this.colorPopover.style.top = `${top}px`;
  }

  isColorPopoverOpen() {
    return Boolean(this.colorPopover && !this.colorPopover.classList.contains("hidden"));
  }

  closeColorPopover() {
    this.colorPopover?.classList.add("hidden");
    this.colorTargetTrack = null;
  }

  updateInspector() {
    const sel = store.getSelectedTracks();
    const unit = store.settings.volUnit;

    if (sel.length === 0) {
      this.btnQuickEq.textContent = "⚡ Quick EQ Gibson";
      this.inspSingle.classList.remove("hidden");
      this.inspMulti.classList.add("hidden");
      [
        this.slPan, this.slVol, this.slSend, this.slY, this.slSize,
        this.btnToggleShape, this.btnToggleLock, this.btnQuickEq, this.btnOpenEqWin,
      ].forEach((c) => (c.disabled = true));
      this.inspName.textContent = "Seleccioná una esfera";
      this.inspRoleBadge.textContent = "";
      this.valPan.textContent = "C";
      this.valVol.textContent = "--";
      this.valSend.textContent = "0%";
      this.valY.textContent = "--";
      this.valSize.textContent = "1.00x";
      this.yReadonlyHint?.classList.add("hidden");
      this.eqTipBox.classList.add("hidden");
      return;
    }

    if (sel.length === 1) {
      const item = sel[0];
      const roleCfg = ROLES[item.role] || ROLES.other;
      const hasEq = Boolean(item.eq?.hasDevice);

      this.inspSingle.classList.remove("hidden");
      this.inspMulti.classList.add("hidden");
      const autoOn = store.settings.autoSize;
      [this.slPan, this.slVol].forEach((c) => (c.disabled = item.locked));
      this.slY.disabled = item.locked || !hasEq;
      this.slY.title = hasEq
        ? "Tilt EQ real en Ableton (Banda 6 Low-Shelf + Banda 7 High-Shelf)"
        : "Solo lectura: agregá un EQ Eight en esta pista en Ableton para mover el Eje Y";
      this.yReadonlyHint?.classList.toggle("hidden", hasEq);

      this.slSize.disabled = item.locked || autoOn;
      this.slSize.title = autoOn ? "Controlado por Auto-Size (desactivalo en Opciones para ajustar manual)" : "";
      this.slSend.disabled = item.locked || !item._ableton.sendAParam;
      this.btnToggleShape.disabled = false;
      this.btnToggleLock.disabled = false;
      this.btnQuickEq.disabled = item.locked || !hasEq;
      this.btnQuickEq.textContent = hasEq ? "⚡ Quick EQ Gibson" : "⚡ Sin EQ Eight";
      this.btnOpenEqWin.disabled = !hasEq;

      this.inspName.textContent = (item.locked ? "🔒 " : "") + (item.isGroup ? `📁 ${item.name}` : item.name);
      this.inspRoleBadge.textContent = roleCfg.label;

      const volLvl = getApparentVolumeLevel(abletonVolToDb(item.vol));
      this.slPan.value = item.pan;
      this.valPan.textContent = formatPan(item.pan);
      this.slVol.value = item.vol;
      this.valVol.textContent = `${formatVolume(item.vol, unit)} · L${volLvl.lvl}`;
      this.slSend.value = item.sendA;
      this.valSend.textContent = item._ableton.sendAParam ? `${Math.round(item.sendA * 100)}%` : "Sin Return A";
      this.slY.value = item.y;
      const bandLabel = hasEq ? "Tilt EQ" : "Solo visual";
      this.valY.textContent = `${formatFreq(yToFreq(item.y))} · ${bandLabel}`;

      const sc = item.sizeScale ?? 1.0;
      const autoMult = autoOn ? (item.crestScale ?? 1.0) * (item._eqLowCutScale ?? 1.0) : 1.0;
      const shownScale = clamp(sc * autoMult, 0.4, 2.4);
      this.slSize.value = autoOn ? shownScale : sc;
      this.valSize.textContent = autoOn ? `Auto ${shownScale.toFixed(2)}x` : `${sc.toFixed(2)}x`;

      this.btnToggleShape.textContent = item.shape === "oblong" ? "Forma: Elipsoide" : "Forma: Esfera";
      this.btnToggleLock.textContent = item.locked ? "🔒 Bloqueada" : "🔓 Libre";
      this.btnToggleLock.classList.toggle("active-toggle", item.locked);

      if (store.settings.showEqTips && roleCfg.eqTip) {
        this.eqTipBox.textContent = "💡 " + roleCfg.eqTip;
        this.eqTipBox.classList.remove("hidden");
      } else {
        this.eqTipBox.classList.add("hidden");
      }
      return;
    }

    this.inspSingle.classList.add("hidden");
    this.inspMulti.classList.remove("hidden");
    this.inspName.textContent = "Conjunto activo";
    this.inspRoleBadge.textContent = `${sel.length} pistas`;

    if (!this.multiSliderActive) {
      const avgPan = sel.reduce((a, b) => a + b.pan, 0) / sel.length;
      const avgVol = sel.reduce((a, b) => a + b.vol, 0) / sel.length;
      const avgSend = sel.reduce((a, b) => a + b.sendA, 0) / sel.length;

      this.slGrpPan.value = avgPan;
      this.valGrpPan.textContent = formatPan(avgPan);
      this.slGrpVol.value = avgVol;
      this.valGrpVol.textContent = formatVolume(avgVol, unit);
      this.slGrpSend.value = avgSend;
      this.valGrpSend.textContent = `${Math.round(avgSend * 100)}%`;
      this.slGrpSpread.value = 1;
      this.valGrpSpread.textContent = "100%";
    }
  }

  toggleHide(item) {
    store.pushHistory(store.captureSnapshot());
    item.hidden = !item.hidden;
    if (item.hidden && store.selectedIds.has(item.id)) {
      store.selectedIds.delete(item.id);
      store.emit("selection");
    }
    this.onTrackVisualChanged(item);
    this.renderTrackList();
  }

  toggleLock(item) {
    store.pushHistory(store.captureSnapshot());
    item.locked = !item.locked;
    this.onOrbLabelChanged(item);
    this.onTrackVisualChanged(item);
    this.renderTrackList();
    this.updateInspector();
  }

  startInlineRename(item, nameEl) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "rename-input";
    input.value = item.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const next = input.value.trim();
      if (next && next !== item.name) await abletonService.renameTrack(item, next);
      else this.renderTrackList();
    };
    const cancel = () => {
      if (done) return;
      done = true;
      this.renderTrackList();
    };

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") commit();
      if (e.key === "Escape") cancel();
    });
    input.addEventListener("blur", commit);
    input.addEventListener("click", (e) => e.stopPropagation());
  }

  _makeClickableSwatch(item) {
    const sw = document.createElement("span");
    sw.setAttribute("role", "button");
    sw.tabIndex = 0;
    sw.draggable = false;
    sw.className = "track-swatch track-swatch-btn";
    sw.style.background = item.colorHex;
    sw.title = "Clic para cambiar color (Ableton Live + 3D)";
    sw.addEventListener("pointerdown", (e) => e.stopPropagation());
    const openPicker = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = sw.getBoundingClientRect();
      this.openColorPopover(item, r.left + r.width / 2, r.bottom);
    };
    sw.addEventListener("click", openPicker);
    sw.addEventListener("contextmenu", openPicker);
    return sw;
  }

  buildTrackRow(item, isChild = false) {
    const div = document.createElement("div");
    div.className =
      "track-item" +
      (isChild ? " is-child" : "") +
      (item.hidden ? " is-hidden" : "") +
      (item.locked ? " is-locked" : "");
    div.dataset.id = item.id;

    if (!item.isGroup) {
      div.draggable = true;
      div.addEventListener("dragstart", (e) => {
        if (e.target?.closest?.(".track-swatch-btn")) {
          e.preventDefault();
          return;
        }
        this.draggedTrackId = item.id;
        div.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      div.addEventListener("dragend", () => {
        this.draggedTrackId = null;
        div.classList.remove("dragging");
      });
    }

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "track-chk";
    chk.checked = store.selectedIds.has(item.id);
    chk.addEventListener("click", (e) => {
      e.stopPropagation();
      this._suppressNextScrollFocus = true;
      store.toggleInSelection(item.id);
    });

    const sw = this._makeClickableSwatch(item);

    const nm = document.createElement("span");
    nm.className = "track-name";
    nm.textContent = item.isGroup ? `📁 ${item.name} (Bus)` : item.name;
    nm.title = "Doble clic para renombrar en Ableton";
    nm.addEventListener("dblclick", (e) => { e.stopPropagation(); this.startInlineRename(item, nm); });

    const eqBadge = document.createElement("span");
    eqBadge.className = "eq-badge" + (item.eq?.hasDevice ? "" : " hidden");
    eqBadge.textContent = item.eq?.adapterName === "EQ Three" ? "EQ3" : "EQ";
    eqBadge.title = item.eq?.hasDevice
      ? `${item.eq.deviceName || "EQ"} (${item.eq.adapterName || "Adapter"}) — Eje Y Tilt EQ activo`
      : "";

    const dynBadge = document.createElement("span");
    dynBadge.className =
      "dyn-badge" +
      (item.dynamics?.hasDevice ? "" : " hidden") +
      (item.dynamics?.hasSidechain ? " is-sc" : "");
    dynBadge.textContent = item.dynamics?.hasSidechain ? "SC" : "CMP";
    dynBadge.title = item.dynamics?.hasDevice
      ? `${item.dynamics.deviceName || item.dynamics.adapterName}${item.dynamics.hasSidechain ? " · Sidechain activo" : ""}`
      : "";

    const btnEye = document.createElement("button");
    btnEye.className = "icon-btn" + (item.hidden ? " hidden-on" : "");
    btnEye.textContent = item.hidden ? "⊘" : "👁";
    btnEye.title = item.hidden ? "Mostrar en mapa 3D" : "Ocultar del mapa 3D";
    btnEye.addEventListener("click", (e) => { e.stopPropagation(); this.toggleHide(item); });

    const btnLock = document.createElement("button");
    btnLock.className = "icon-btn" + (item.locked ? " locked" : "");
    btnLock.textContent = item.locked ? "🔒" : "🔓";
    btnLock.title = item.locked ? "Desbloquear" : "Bloquear contra misclicks y presets";
    btnLock.addEventListener("click", (e) => { e.stopPropagation(); this.toggleLock(item); });

    const btnM = document.createElement("button");
    btnM.className = "icon-btn btn-mute" + (item.mute ? " muted" : "");
    btnM.textContent = "M";
    btnM.addEventListener("click", (e) => { e.stopPropagation(); abletonService.setMute(item, !item.mute, true); });

    const btnS = document.createElement("button");
    btnS.className = "icon-btn btn-solo" + (item.solo ? " soloed" : "");
    btnS.textContent = "S";
    btnS.addEventListener("click", (e) => { e.stopPropagation(); abletonService.setSolo(item, !item.solo, true); });

    const sel = document.createElement("select");
    sel.className = "role-select";
    Object.entries(ROLES).forEach(([k, cfg]) => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = cfg.label;
      if (k === item.role) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("click", (e) => e.stopPropagation());
    sel.addEventListener("change", () => {
      store.pushHistory(store.captureSnapshot());
      item.role = sel.value;
      const cfg = ROLES[item.role] || ROLES.other;
      item.y = cfg.defaultY;
      item.shape = cfg.shape || "sphere";
      this.onTrackVisualChanged(item);
      if (store.selectedIds.has(item.id)) this.updateInspector();
    });

    div.addEventListener("click", (e) => {
      this._suppressNextScrollFocus = true;
      if (e.shiftKey || e.ctrlKey) store.toggleInSelection(item.id);
      else store.setSelection([item.id]);
    });

    div.append(chk, sw, nm, eqBadge, dynBadge, btnEye, btnLock, btnM, btnS, sel);
    return div;
  }

  renderTrackList() {
    this.trackListEl.innerHTML = "";
    const isFiltering = Boolean(this.trackSearchQuery || this.trackFilterMode !== "all");
    const renderedIds = new Set();
    let matchedCount = 0;

    const abletonBuses = store.tracks.filter((t) => t.isGroup);
    abletonBuses.forEach((bus) => {
      const children = store.tracks.filter((t) => t.groupId === bus.id && !t.vGroupId);
      const busMatches = this.matchesTrackFilter(bus, bus.name);
      const visibleChildren = isFiltering
        ? children.filter((c) => this.matchesTrackFilter(c, bus.name))
        : children;

      renderedIds.add(bus.id);
      children.forEach((c) => renderedIds.add(c.id));

      if (isFiltering && !busMatches && visibleChildren.length === 0) return;

      const isCollapsed = isFiltering ? false : store.collapsedGroups.has(bus.id);

      const header = document.createElement("div");
      header.className = "group-header";

      const arrow = document.createElement("span");
      arrow.className = "collapse-arrow";
      arrow.textContent = isCollapsed ? "▶" : "▼";

      const sw = this._makeClickableSwatch(bus);

      const title = document.createElement("span");
      title.style.flex = "1";
      title.textContent = `📁 ${bus.name} (${visibleChildren.length})`;

      header.append(arrow, sw, title);
      header.addEventListener("click", () => store.toggleCollapseGroup(bus.id));
      this.trackListEl.appendChild(header);

      if (!isCollapsed) {
        if (!isFiltering || busMatches) {
          this.trackListEl.appendChild(this.buildTrackRow(bus, true));
          matchedCount++;
        }
        visibleChildren.forEach((c) => {
          this.trackListEl.appendChild(this.buildTrackRow(c, true));
          matchedCount++;
        });
      }
    });

    store.virtualGroups.forEach((vg) => {
      const children = store.tracks.filter((t) => t.vGroupId === vg.id);
      const visibleChildren = isFiltering
        ? children.filter((c) => this.matchesTrackFilter(c, vg.name))
        : children;

      children.forEach((c) => renderedIds.add(c.id));

      if (isFiltering && visibleChildren.length === 0) return;

      const isCollapsed = isFiltering ? false : store.collapsedGroups.has(vg.id);

      const header = document.createElement("div");
      header.className = "group-header";

      const arrow = document.createElement("span");
      arrow.className = "collapse-arrow";
      arrow.textContent = isCollapsed ? "▶" : "▼";

      const sw = document.createElement("span");
      sw.className = "track-swatch";
      sw.style.background = vg.color;

      const title = document.createElement("span");
      title.style.flex = "1";
      title.textContent = `◈ ${vg.name} (${visibleChildren.length})`;

      const btnDel = document.createElement("button");
      btnDel.className = "icon-btn";
      btnDel.textContent = "×";
      btnDel.title = "Disolver grupo virtual";
      btnDel.addEventListener("click", (e) => {
        e.stopPropagation();
        store.pushHistory(store.captureSnapshot());
        store.tracks.forEach((t) => { if (t.vGroupId === vg.id) t.vGroupId = null; });
        store.virtualGroups = store.virtualGroups.filter((g) => g.id !== vg.id);
        this.renderGroupsBar();
        this.renderTrackList();
      });

      header.append(arrow, sw, title, btnDel);
      header.addEventListener("click", () => store.toggleCollapseGroup(vg.id));
      header.addEventListener("dragover", (e) => { e.preventDefault(); header.classList.add("drop-over"); });
      header.addEventListener("dragleave", () => header.classList.remove("drop-over"));
      header.addEventListener("drop", (e) => {
        e.preventDefault();
        header.classList.remove("drop-over");
        if (this.draggedTrackId) store.assignTrackToVirtualGroup(this.draggedTrackId, vg.id);
      });
      this.trackListEl.appendChild(header);

      if (!isCollapsed) {
        visibleChildren.forEach((c) => {
          this.trackListEl.appendChild(this.buildTrackRow(c, true));
          matchedCount++;
        });
      }
    });

    const standaloneAll = store.tracks.filter((t) => !renderedIds.has(t.id));
    const standalone = isFiltering
      ? standaloneAll.filter((t) => this.matchesTrackFilter(t, ""))
      : standaloneAll;

    if (!isFiltering && (store.virtualGroups.length > 0 || abletonBuses.length > 0)) {
      const ungrpHeader = document.createElement("div");
      ungrpHeader.className = "group-header";
      ungrpHeader.style.opacity = "0.75";
      ungrpHeader.innerHTML = `<span style="flex:1">Sin agrupar (${standalone.length}) — soltá acá para desagrupar</span>`;
      ungrpHeader.addEventListener("dragover", (e) => { e.preventDefault(); ungrpHeader.classList.add("drop-over"); });
      ungrpHeader.addEventListener("dragleave", () => ungrpHeader.classList.remove("drop-over"));
      ungrpHeader.addEventListener("drop", (e) => {
        e.preventDefault();
        ungrpHeader.classList.remove("drop-over");
        if (this.draggedTrackId) store.assignTrackToVirtualGroup(this.draggedTrackId, null);
      });
      this.trackListEl.appendChild(ungrpHeader);
    }

    standalone.forEach((t) => {
      this.trackListEl.appendChild(this.buildTrackRow(t, false));
      matchedCount++;
    });

    if (isFiltering && matchedCount === 0) {
      const empty = document.createElement("div");
      empty.className = "track-search-empty";
      const txt = document.createElement("span");
      txt.textContent = "Sin pistas que coincidan con el filtro.";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mini-btn";
      btn.textContent = "Limpiar filtro";
      btn.addEventListener("click", () => this.clearTrackSearch());
      empty.append(txt, btn);
      this.trackListEl.appendChild(empty);
    }

    this.trackCountEl.textContent = isFiltering
      ? `${matchedCount}/${store.tracks.length} pistas`
      : `${store.tracks.length} pistas`;
    this.syncSelectionHighlights();
  }

  syncSelectionHighlights() {
    this.btnClearSel.disabled = store.selectedIds.size === 0;
    const fromListClick = Boolean(this._suppressNextScrollFocus);
    this._suppressNextScrollFocus = false;

    if (!fromListClick && store.selectedIds.size === 1) {
      const targetId = Array.from(store.selectedIds)[0];
      const targetTrack = store.getTrackById(targetId);
      if (targetTrack) {
        const parentGroupKey = targetTrack.vGroupId || targetTrack.groupId;
        if (parentGroupKey && store.collapsedGroups.has(String(parentGroupKey))) {
          store.collapsedGroups.delete(String(parentGroupKey));
          this._suppressNextScrollFocus = false;
          this.renderTrackList();
          return;
        }
      }
    }

    let firstSelectedEl = null;
    document.querySelectorAll(".track-item").forEach((el) => {
      const isSel = store.selectedIds.has(el.dataset.id);
      el.classList.toggle("selected", isSel);
      if (isSel && !firstSelectedEl) firstSelectedEl = el;
      const chk = el.querySelector(".track-chk");
      if (chk) chk.checked = isSel;
    });

    document.querySelectorAll(".group-chip").forEach((btn) => {
      const ids = (btn.dataset.ids || "").split(",").filter(Boolean);
      const active = ids.length > 0 && ids.length === store.selectedIds.size && ids.every((id) => store.selectedIds.has(id));
      btn.classList.toggle("active", active);
    });

    if (!fromListClick && firstSelectedEl && store.selectedIds.size === 1) {
      firstSelectedEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  syncMuteSoloBadges() {
    document.querySelectorAll(".track-item").forEach((el) => {
      const item = store.getTrackById(el.dataset.id);
      if (!item) return;
      el.querySelector(".btn-mute")?.classList.toggle("muted", item.mute);
      el.querySelector(".btn-solo")?.classList.toggle("soloed", item.solo);
    });
  }

  initScenesUI() {
    this.valSongBar = document.getElementById("val-song-bar");
    this.btnScenesAuto = document.getElementById("btn-scenes-auto");
    this.btnAddScene = document.getElementById("btn-add-scene");
    this.btnImportCues = document.getElementById("btn-import-cues");
    this.scenesListEl = document.getElementById("scenes-list");

    this.btnScenesAuto.addEventListener("click", () => {
      this.btnScenesAuto.blur();
      store.scenesAutoEnabled = !store.scenesAutoEnabled;
      store.lastSceneRuleId = null;
      store.emit("scenes-changed");
    });

    this.btnAddScene.addEventListener("click", () => {
      this.btnAddScene.blur();
      const bank = store.activeBank || "A";
      const bar = Math.floor((store.currentSongBeat || 0) / 4) + 1;
      const defLabel = store.scenes.length === 0 ? "Verso" : store.scenes.length === 1 ? "Estribillo" : `Compás ${bar}`;
      store.addSceneRule(store.currentSongBeat || 0, bank, defLabel);
    });

    this.btnImportCues.addEventListener("click", async () => {
      this.btnImportCues.blur();
      const count = await abletonService.importCueLocators();
      if (count === 0) alert("No se encontraron Locators/Cue Points en el proyecto de Ableton.");
    });

    this.syncScenesUI();
  }

  updateSongBar(beats) {
    if (!this.valSongBar) return;
    const bar = Math.floor((Number(beats) || 0) / 4) + 1;
    this.valSongBar.textContent = `Compás ${bar}`;
  }

  syncScenesUI() {
    if (!this.scenesListEl) return;
    this.btnScenesAuto.textContent = store.scenesAutoEnabled ? "Auto: ON" : "Auto: OFF";
    this.btnScenesAuto.classList.toggle("active-toggle", store.scenesAutoEnabled);

    const scenes = store.scenes || [];
    this.scenesListEl.innerHTML = "";
    if (scenes.length === 0) {
      this.scenesListEl.innerHTML = `<div class="muted-note" style="margin:2px 0 0;">Guardá Verso en <b>A</b> y Estribillo en <b>B</b>, y tocá "+ Escena" mientras suena el tema.</div>`;
      return;
    }

    scenes.forEach((r) => {
      const row = document.createElement("div");
      row.className = "scene-row";

      const barTag = document.createElement("span");
      barTag.className = "scene-bar";
      barTag.textContent = `C.${r.bar}`;

      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "scene-name";
      inp.value = r.label;
      inp.addEventListener("change", () => store.updateSceneRule(r.id, { label: inp.value }));

      const sel = document.createElement("select");
      sel.className = "scene-bank";
      ["A", "B", "C", "D"].forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = `Banco ${b}`;
        if (b === r.bank) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => store.updateSceneRule(r.id, { bank: sel.value }));

      const del = document.createElement("button");
      del.className = "icon-btn";
      del.textContent = "×";
      del.addEventListener("click", () => store.removeSceneRule(r.id));

      row.append(barTag, inp, sel, del);
      this.scenesListEl.appendChild(row);
    });
  }
}