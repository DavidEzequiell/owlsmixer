import { ROLES } from "../data/roles.js";
import { store, clamp, formatVolume, formatPan, yToFreq, formatFreq, abletonVolToDb, getApparentVolumeLevel } from "../store.js";
import { abletonService } from "../services/abletonService.js";

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
    
    this.slSend = document.getElementById("sl-send");
    this.valSend = document.getElementById("val-send");
    this.slY = document.getElementById("sl-y");
    this.slSize = document.getElementById("sl-size");
    this.valSize = document.getElementById("val-size");
    this.btnToggleShape = document.getElementById("btn-toggle-shape");
    this.btnToggleLock = document.getElementById("btn-toggle-lock");
    this.eqTipBox = document.getElementById("eq-tip-box");
    this.colorSwatchesEl = document.getElementById("color-swatches");
    this.inpCustomColor = document.getElementById("inp-custom-color");

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

    this.singleSliderBefore = null;
    this.multiSliderActive = false;
    this.multiBeforeSnapshot = null;
    this.multiBase = [];
    this.multiBaseAvg = { pan: 0, vol: 0, sendA: 0 };
    this.draggedTrackId = null;

    this.initCollapsibleSections();
    this.initReverbUI();
    this.initGroupsUI();
    this.initInspectorUI();
    this.initColorPickerUI();
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
    const startSingle = () => {
      const sel = store.getSelectedTracks();
      if (sel.length !== 1 || sel[0].locked) return;
      this.singleSliderBefore = store.captureSnapshot();
      sel[0].isDragging = true;
    };
    const endSingle = () => {
      const sel = store.getSelectedTracks();
      if (sel.length === 1) {
        const item = sel[0];
        item._ableton.setPanLive(item.pan, true);
        item._ableton.setVolLive(item.vol, true);
        item._ableton.setSendALive(item.sendA, true);
        item.isDragging = false;
      }
      if (this.singleSliderBefore) {
        store.pushHistory(this.singleSliderBefore);
        this.singleSliderBefore = null;
      }
    };

    [this.slPan, this.slVol, this.slSend, this.slY, this.slSize].forEach((sl) => {
      sl.addEventListener("pointerdown", startSingle);
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
      if (sel.length !== 1 || sel[0].locked) return;
      sel[0].y = parseFloat(this.slY.value);
      this.onTrackVisualChanged(sel[0]);
      this.updateInspector();
    });

    // Ajuste manual del tamaño visual de la esfera
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
  initColorPickerUI() {
    const ABLETON_PALETTE = [
      "#ff3636", "#ff7c24", "#ffd12a", "#8ce639",
      "#1bc96b", "#00d4c8", "#2d9dff", "#5c6bff",
      "#9c59ff", "#e859c9", "#ff8fab", "#a8b3c2",
    ];
    this.colorSwatchesEl.innerHTML = "";
    ABLETON_PALETTE.forEach((hex) => {
      const btn = document.createElement("button");
      btn.className = "swatch-btn";
      btn.dataset.hex = hex;
      btn.style.background = hex;
      btn.title = hex;
      btn.addEventListener("click", () => {
        btn.blur();
        const sel = store.getSelectedTracks();
        if (sel.length === 1) abletonService.setTrackColor(sel[0], hex, true);
      });
      this.colorSwatchesEl.appendChild(btn);
    });

    this.inpCustomColor.addEventListener("change", () => {
      const sel = store.getSelectedTracks();
      if (sel.length === 1) abletonService.setTrackColor(sel[0], this.inpCustomColor.value, true);
    });
  }

  updateInspector() {
    const sel = store.getSelectedTracks();
    const unit = store.settings.volUnit;

    if (sel.length === 0) {
      this.inspSingle.classList.remove("hidden");
      this.inspMulti.classList.add("hidden");
      [this.slPan, this.slVol, this.slSend, this.slY, this.slSize, this.btnToggleShape, this.btnToggleLock].forEach((c) => (c.disabled = true));
      this.inspName.textContent = "Seleccioná una esfera";
      this.inspRoleBadge.textContent = "";
      this.eqTipBox.classList.add("hidden");
      this.inpCustomColor.disabled = true;
      this.colorSwatchesEl.querySelectorAll(".swatch-btn").forEach((b) => { b.disabled = true; b.classList.remove("active"); });
      return;
    }

    if (sel.length === 1) {
      const item = sel[0];
      const roleCfg = ROLES[item.role] || ROLES.other;

      this.inspSingle.classList.remove("hidden");
      this.inspMulti.classList.add("hidden");
      [this.slPan, this.slVol, this.slSend, this.slY, this.slSize].forEach((c) => (c.disabled = item.locked));
      this.btnToggleShape.disabled = false;
      this.btnToggleLock.disabled = false;

      this.inspName.textContent = (item.locked ? "🔒 " : "") + (item.isGroup ? `📁 ${item.name}` : item.name);
      this.inspRoleBadge.textContent = roleCfg.label;
      const volLvl = getApparentVolumeLevel(abletonVolToDb(item.vol));
      this.valVol.textContent = `${formatVolume(item.vol, unit)} · L${volLvl.lvl}`;
      this.slPan.value = item.pan;
      this.valPan.textContent = formatPan(item.pan);
      this.slVol.value = item.vol;
      this.valVol.textContent = formatVolume(item.vol, unit);
      this.slSend.value = item.sendA;
      this.valSend.textContent = item._ableton.sendAParam ? `${Math.round(item.sendA * 100)}%` : "Sin Return A";
      this.slY.value = item.y;
      this.valY.textContent = item.y < -1.5 ? "Low" : item.y > 1.5 ? "High" : "Mid";

      const sc = item.sizeScale ?? 1.0;
      this.slSize.value = sc;
      this.valSize.textContent = `${sc.toFixed(2)}x`;

      this.btnToggleShape.textContent = item.shape === "oblong" ? "Forma: Elipsoide" : "Forma: Esfera";
      this.btnToggleLock.textContent = item.locked ? "🔒 Bloqueada" : "🔓 Libre";
      this.btnToggleLock.classList.toggle("active-toggle", item.locked);

      if (store.settings.showEqTips && roleCfg.eqTip) {
        this.eqTipBox.textContent = "💡 " + roleCfg.eqTip;
        this.eqTipBox.classList.remove("hidden");
      } else {
        this.eqTipBox.classList.add("hidden");
      }
      this.inpCustomColor.disabled = false;
      this.inpCustomColor.value = item.colorHex;
      this.colorSwatchesEl.querySelectorAll(".swatch-btn").forEach((b) => {
        b.disabled = false;
        b.classList.toggle("active", b.dataset.hex.toLowerCase() === item.colorHex.toLowerCase());
      });
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
    chk.addEventListener("click", (e) => { e.stopPropagation(); store.toggleInSelection(item.id); });

    const sw = document.createElement("span");
    sw.className = "track-swatch";
    sw.style.background = item.colorHex;

    const nm = document.createElement("span");
    nm.className = "track-name";
    nm.textContent = item.isGroup ? `📁 ${item.name} (Bus)` : item.name;
    nm.title = "Doble clic para renombrar en Ableton";
    nm.addEventListener("dblclick", (e) => { e.stopPropagation(); this.startInlineRename(item, nm); });

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
      if (e.shiftKey || e.ctrlKey) store.toggleInSelection(item.id);
      else store.setSelection([item.id]);
    });

    div.append(chk, sw, nm, btnEye, btnLock, btnM, btnS, sel);
    return div;
  }

  renderTrackList() {
    this.trackListEl.innerHTML = "";
    this.trackCountEl.textContent = `${store.tracks.length} pistas`;
    const renderedIds = new Set();

    const abletonBuses = store.tracks.filter((t) => t.isGroup);
    abletonBuses.forEach((bus) => {
      const children = store.tracks.filter((t) => t.groupId === bus.id && !t.vGroupId);
      const isCollapsed = store.collapsedGroups.has(bus.id);

      const header = document.createElement("div");
      header.className = "group-header";
      header.innerHTML =
        `<span class="collapse-arrow">${isCollapsed ? "▶" : "▼"}</span>` +
        `<span class="track-swatch" style="background:${bus.colorHex}"></span>` +
        `<span style="flex:1">📁 ${bus.name} (${children.length})</span>`;
      header.addEventListener("click", () => store.toggleCollapseGroup(bus.id));
      this.trackListEl.appendChild(header);

      renderedIds.add(bus.id);
      if (!isCollapsed) {
        this.trackListEl.appendChild(this.buildTrackRow(bus, true));
        children.forEach((c) => { renderedIds.add(c.id); this.trackListEl.appendChild(this.buildTrackRow(c, true)); });
      } else {
        children.forEach((c) => renderedIds.add(c.id));
      }
    });

    store.virtualGroups.forEach((vg) => {
      const children = store.tracks.filter((t) => t.vGroupId === vg.id);
      const isCollapsed = store.collapsedGroups.has(vg.id);

      const header = document.createElement("div");
      header.className = "group-header";
      header.innerHTML =
        `<span class="collapse-arrow">${isCollapsed ? "▶" : "▼"}</span>` +
        `<span class="track-swatch" style="background:${vg.color}"></span>` +
        `<span style="flex:1">◈ ${vg.name} (${children.length})</span>`;

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
      header.appendChild(btnDel);

      header.addEventListener("click", () => store.toggleCollapseGroup(vg.id));
      header.addEventListener("dragover", (e) => { e.preventDefault(); header.classList.add("drop-over"); });
      header.addEventListener("dragleave", () => header.classList.remove("drop-over"));
      header.addEventListener("drop", (e) => {
        e.preventDefault();
        header.classList.remove("drop-over");
        if (this.draggedTrackId) store.assignTrackToVirtualGroup(this.draggedTrackId, vg.id);
      });
      this.trackListEl.appendChild(header);

      children.forEach((c) => {
        renderedIds.add(c.id);
        if (!isCollapsed) this.trackListEl.appendChild(this.buildTrackRow(c, true));
      });
    });

    const standalone = store.tracks.filter((t) => !renderedIds.has(t.id));
    if (store.virtualGroups.length > 0 || abletonBuses.length > 0) {
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

    standalone.forEach((t) => this.trackListEl.appendChild(this.buildTrackRow(t, false)));
    this.syncSelectionHighlights();
  }

  syncSelectionHighlights() {
    this.btnClearSel.disabled = store.selectedIds.size === 0;
    document.querySelectorAll(".track-item").forEach((el) => {
      const isSel = store.selectedIds.has(el.dataset.id);
      el.classList.toggle("selected", isSel);
      const chk = el.querySelector(".track-chk");
      if (chk) chk.checked = isSel;
    });
    document.querySelectorAll(".group-chip").forEach((btn) => {
      const ids = (btn.dataset.ids || "").split(",").filter(Boolean);
      const active = ids.length > 0 && ids.length === store.selectedIds.size && ids.every((id) => store.selectedIds.has(id));
      btn.classList.toggle("active", active);
    });
  }

  syncMuteSoloBadges() {
    document.querySelectorAll(".track-item").forEach((el) => {
      const item = store.getTrackById(el.dataset.id);
      if (!item) return;
      el.querySelector(".btn-mute")?.classList.toggle("muted", item.mute);
      el.querySelector(".btn-solo")?.classList.toggle("soloed", item.solo);
    });
  }
}