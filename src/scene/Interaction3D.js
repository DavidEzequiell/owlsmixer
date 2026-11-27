import * as THREE from "three";
import {
  store, HALF_H, clamp, panToX, volToZ, sendToZ, xToPan, zToVol, zToSend,
  formatPan, formatVolume, formatFreq, yToFreq, abletonVolToDb, getApparentVolumeLevel,
} from "../store.js";
import { abletonService } from "../services/abletonService.js";
import { pickBandSlotForStrip, xToEqGain, eqYToFreq, GIBSON_EQ_STRIPS } from "../data/eqBands.js";
import {
  computeTrueDepthZ, solveTrueDepthDrag, directToReverbRatioDb,
} from "../engine/psychoacoustics.js";
export class Interaction3D {
  constructor(stage, { onUndo, onRedo, onEscape }) {
    this.stage = stage;
    this.onUndo = onUndo;
    this.onRedo = onRedo;
    this.onEscape = onEscape;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragPlane = new THREE.Plane();
    this.dragHit = new THREE.Vector3();
    this.dragStartWorld = new THREE.Vector3();
    this.dragBaseStates = [];
    this.draggingPrimary = null;
    this.dragModeY = false;
    this.dragMoved = false;
    this.dragBeforeSnapshot = null;

    this.draggingEq = null;
    this.eqPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    this.wheelBeforeSnapshot = null;
    this.wheelHistoryTimer = null;

    this.dragTooltipEl = document.getElementById("drag-tooltip");

    this.bindEvents();
  }

  updatePointer(e) {
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  raycast(e) {
    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.stage.camera);
    const hits = this.raycaster.intersectObjects(this.stage.getPickableMeshes(), false);
    return hits.length > 0 ? hits[0] : null;
  }

  raycastEq(e) {
    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.stage.camera);
    const hits = this.raycaster.intersectObjects(this.stage.eqWindow.getPickableStrips(), false);
    return hits.length > 0 ? hits[0] : null;
  }

  configureDragPlane(e, anchorPos, isYMode) {
    this.dragModeY = isYMode;
    if (isYMode) {
      const camDir = new THREE.Vector3();
      this.stage.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 1e-4) camDir.set(0, 0, -1);
      else camDir.normalize();
      this.dragPlane.setFromNormalAndCoplanarPoint(camDir, anchorPos);
    } else {
      this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), anchorPos);
    }

    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.stage.camera);
    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragHit)) {
      this.dragStartWorld.copy(this.dragHit);
    }
  }

  snapshotDragBases(targets) {
    const zMode = store.settings.zMode;
    const decay = store.reverbInfo.decay;
    this.dragBaseStates = targets.map((tItem) => {
      tItem.isDragging = true;
      const logicalX = panToX(tItem.pan);
      const logicalZ = zMode === "spatial"
        ? sendToZ(tItem.sendA)
        : zMode === "depth"
          ? computeTrueDepthZ(tItem.vol, tItem.sendA, decay)
          : volToZ(tItem.vol);
      return {
        item: tItem,
        y: tItem.y,
        vol: tItem.vol,
        sendA: tItem.sendA,
        startPos: new THREE.Vector3(logicalX, tItem.y, logicalZ),
      };
    });
  }

  bindEvents() {
    const dom = this.stage.renderer.domElement;
    const viewport = this.stage.viewportEl;

    dom.addEventListener("contextmenu", (e) => {
      if (store.viewMode === "eq") e.preventDefault();
    });

    // Capture en viewportEl: corre ANTES que OrbitControls cuando tocás una esfera/franja
    viewport.addEventListener("pointerdown", async (e) => {
      if (e.target !== dom) return;

      if (store.viewMode === "eq") {
        const hit = this.raycastEq(e);
        if (!hit) return;

        e.stopPropagation();

        const stripIdx = hit.object.userData.eqStripIndex;
        const item = store.getSelectedTracks()[0];
        if (!item || item.locked || !item.eq?.hasDevice) return;
        if (!item.eq.bound) {
          const ok = await abletonService.ensureEqBound(item);
          if (!ok) return;
        }

        const bandIdx = pickBandSlotForStrip(item.eq.bands, stripIdx);
        const band = item.eq.bands[bandIdx];
        const strip = GIBSON_EQ_STRIPS[stripIdx];

        if (e.button === 2) {
          e.preventDefault();
          const nextOn = !band.on;
          const patch = { on: nextOn };
          if (nextOn && !band.on) {
            patch.freqHz = strip.centerHz;
            patch.type = strip.defaultType;
          }
          await abletonService.setEqBand(item, bandIdx, patch, { immediate: true, recordHistory: true });
          this.stage.eqWindow.sync();
          return;
        }

        if (e.button !== 0) return;

        this.stage.controls.enabled = false;
        this.draggingEq = {
          item,
          bandIdx,
          stripIdx,
          beforeSnap: store.captureSnapshot(),
        };

        const gainDb = xToEqGain(hit.point.x, !e.ctrlKey);
        const patch = { gainDb };
        if (!band.on) {
          patch.on = true;
          patch.freqHz = strip.centerHz;
          patch.type = strip.defaultType;
        }
        await abletonService.setEqBand(item, bandIdx, patch, { immediate: false, recordHistory: false });
        this.stage.eqWindow.sync();
        return;
      }

      if (e.button !== 0) return;
      const hit = this.raycast(e);
      if (!hit) return;

      const item = hit.object.userData.trackItem;
      if (!item || item.locked) return;

      // Evita que OrbitControls agarre Shift+Drag como paneo de cámara
      e.stopPropagation();

      if (e.ctrlKey) {
        e.preventDefault();
        abletonService.setMute(item, !item.mute, true);
        return;
      }
      if (e.altKey) {
        e.preventDefault();
        abletonService.setSolo(item, !item.solo, true);
        return;
      }

      if (!store.selectedIds.has(item.id)) {
        store.setSelection([item.id]);
      }

      const targets = store.getSelectedTracks().filter((t) => !t.locked && !t.hidden);
      if (targets.length === 0) return;

      this.draggingPrimary = item;
      this.dragMoved = false;
      this.dragBeforeSnapshot = store.captureSnapshot();
      this.stage.controls.enabled = false;

      this.configureDragPlane(e, hit.object.position, e.shiftKey);
      this.snapshotDragBases(targets);
      dom.style.cursor = this.dragModeY ? "ns-resize" : "grabbing";
    }, { capture: true });

    window.addEventListener("pointermove", (e) => {
      if (this.draggingEq) {
        dom.style.cursor = e.shiftKey ? "move" : "ew-resize";
        this.updatePointer(e);
        this.raycaster.setFromCamera(this.pointer, this.stage.camera);
        if (this.raycaster.ray.intersectPlane(this.eqPlane, this.dragHit)) {
          const patch = { gainDb: xToEqGain(this.dragHit.x, !e.ctrlKey) };
          if (e.shiftKey) patch.freqHz = eqYToFreq(this.dragHit.y);
          abletonService.setEqBand(this.draggingEq.item, this.draggingEq.bandIdx, patch);
          this.stage.eqWindow.sync();
          const b = this.draggingEq.item.eq.bands[this.draggingEq.bandIdx];
          this.showDragTooltip(
            `<b>[${b.bandNum}]</b> ${formatFreq(b.freqHz)} · ${b.gainDb > 0 ? "+" : ""}${b.gainDb.toFixed(1)} dB · Q ${b.q.toFixed(2)}`,
            e.clientX,
            e.clientY
          );
        }
        return;
      }

      if (store.viewMode === "eq") {
        const hit = this.raycastEq(e);
        this.stage.eqWindow.setHoveredStrip(hit ? hit.object.userData.eqStripIndex : -1);
        dom.style.cursor = hit ? "crosshair" : "default";
        return;
      }

      if (!this.draggingPrimary) {
        const hit = this.raycast(e);
        dom.style.cursor = hit ? (e.shiftKey ? "ns-resize" : "grab") : "default";
        return;
      }

      // Si apretás o soltás Shift a mitad del arrastre, reancla suavemente sin saltos
      if (e.shiftKey !== this.dragModeY) {
        const primaryOrb = this.stage.orbs.get(this.draggingPrimary.id);
        if (primaryOrb) {
          this.configureDragPlane(e, primaryOrb.mesh.position, e.shiftKey);
          this.snapshotDragBases(this.dragBaseStates.map((s) => s.item));
        }
      }

      dom.style.cursor = this.dragModeY ? "ns-resize" : "grabbing";
      this.updatePointer(e);
      this.raycaster.setFromCamera(this.pointer, this.stage.camera);

      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragHit)) {
        const delta = this.dragHit.clone().sub(this.dragStartWorld);
        const zMode = store.settings.zMode;
        const decay = store.reverbInfo.decay;
        let anyApplied = false;

        for (const st of this.dragBaseStates) {
          if (this.dragModeY) {
            if (!st.item.eq?.hasDevice) continue;
            st.item.y = clamp(st.y + delta.y, -HALF_H + 0.3, HALF_H - 0.3);
            abletonService.applyYAxisTiltEq(st.item, { immediate: false });
            anyApplied = true;
          } else {
            const nx = st.startPos.x + delta.x;
            const nz = st.startPos.z + delta.z;
            st.item.pan = xToPan(nx);
            st.item._ableton.setPanLive(st.item.pan);

            if (zMode === "spatial") {
              st.item.sendA = zToSend(nz);
              st.item._ableton.setSendALive(st.item.sendA);
            } else if (zMode === "depth") {
              const solved = solveTrueDepthDrag(st.vol, st.sendA, delta.z, decay);
              st.item.vol = solved.vol;
              st.item.sendA = solved.sendA;
              st.item._ableton.setVolLive(st.item.vol);
              st.item._ableton.setSendALive(st.item.sendA);
            } else {
              st.item.vol = zToVol(nz);
              st.item._ableton.setVolLive(st.item.vol);
            }
            anyApplied = true;
          }
          this.stage.updateOrb(st.item);
        }

        if (anyApplied && delta.lengthSq() > 0.0004) this.dragMoved = true;
        if (anyApplied) store.emit("track-changed", this.draggingPrimary);
        this.showShadowTooltip(this.draggingPrimary, this.dragModeY);
      }
    });

    window.addEventListener("pointerup", () => {
      if (this.draggingEq) {
        const { item, bandIdx, beforeSnap } = this.draggingEq;
        const b = item.eq.bands[bandIdx];
        abletonService.setEqBand(item, bandIdx, { gainDb: b.gainDb, freqHz: b.freqHz }, { immediate: true });
        if (beforeSnap) store.pushHistory(beforeSnap);
        this.draggingEq = null;
        this.stage.controls.enabled = true;
        dom.style.cursor = "default";
        this.hideDragTooltip();
        return;
      }

      if (!this.draggingPrimary) return;
      for (const st of this.dragBaseStates) {
        st.item._ableton.setPanLive(st.item.pan, true);
        st.item._ableton.setVolLive(st.item.vol, true);
        st.item._ableton.setSendALive(st.item.sendA, true);
        if (this.dragMoved && this.dragModeY && st.item.eq?.hasDevice) {
          abletonService.applyYAxisTiltEq(st.item, { immediate: true });
        }
        st.item.isDragging = false;
      }

      if (this.dragMoved && !this.dragModeY && store.settings.zMode === "depth") {
        for (const st of this.dragBaseStates) {
          abletonService.applyTrueDepthAir(st.item);
        }
      }

      if (this.dragMoved && this.dragBeforeSnapshot) {
        store.pushHistory(this.dragBeforeSnapshot);
      }
      this.dragBeforeSnapshot = null;
      this.dragBaseStates = [];
      this.draggingPrimary = null;
      this.stage.controls.enabled = true;
      dom.style.cursor = "default";
      this.hideDragTooltip();
    });

    dom.addEventListener("wheel", (e) => {
      if (store.viewMode === "eq") {
        const hit = this.raycastEq(e);
        if (!hit) return;
        const item = store.getSelectedTracks()[0];
        if (!item || item.locked || !item.eq?.bound) return;

        e.preventDefault();
        e.stopPropagation();

        if (!this.wheelBeforeSnapshot) this.wheelBeforeSnapshot = store.captureSnapshot();
        clearTimeout(this.wheelHistoryTimer);
        this.wheelHistoryTimer = setTimeout(() => {
          if (this.wheelBeforeSnapshot) {
            store.pushHistory(this.wheelBeforeSnapshot);
            this.wheelBeforeSnapshot = null;
          }
        }, 400);

        const stripIdx = hit.object.userData.eqStripIndex;
        const bandIdx = pickBandSlotForStrip(item.eq.bands, stripIdx);
        const band = item.eq.bands[bandIdx];
        const deltaQ = e.deltaY < 0 ? 0.04 : -0.04;
        abletonService.setEqBand(item, bandIdx, { q: clamp(band.q + deltaQ, 0, 1) });
        this.stage.eqWindow.sync();
        return;
      }

      const hit = this.raycast(e);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();

      const item = hit.object.userData.trackItem;
      if (!item || item.locked) return;

      if (!store.selectedIds.has(item.id)) store.setSelection([item.id]);
      const targets = store.getSelectedTracks().filter((t) => !t.locked && !t.hidden);
      if (targets.length === 0) return;

      if (!this.wheelBeforeSnapshot) {
        this.wheelBeforeSnapshot = store.captureSnapshot();
      }
      clearTimeout(this.wheelHistoryTimer);
      this.wheelHistoryTimer = setTimeout(() => {
        if (this.wheelBeforeSnapshot) {
          store.pushHistory(this.wheelBeforeSnapshot);
          this.wheelBeforeSnapshot = null;
        }
      }, 400);

      const delta = e.deltaY < 0 ? 0.03 : -0.03;
      const isGibsonZ = store.settings.zMode !== "spatial";

      for (const tItem of targets) {
        if (isGibsonZ) {
          tItem.sendA = clamp(tItem.sendA + delta, 0, 1);
          tItem._ableton.setSendALive(tItem.sendA);
        } else {
          tItem.vol = clamp(tItem.vol + delta, 0, 1);
          tItem._ableton.setVolLive(tItem.vol);
        }
        this.stage.updateOrb(tItem);
      }
      store.emit("track-changed", item);
    }, { passive: false, capture: true });

    window.addEventListener("keydown", async (e) => {
      const active = document.activeElement;
      const isTyping =
        active &&
        ((active.tagName === "INPUT" && ["text", "search", "number"].includes(active.type)) ||
          active.tagName === "TEXTAREA");
      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) { e.preventDefault(); this.onUndo?.(); return; }
        if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); this.onRedo?.(); return; }
      }

      if (e.code === "Space") {
        e.preventDefault();
        abletonService.togglePlay(e.shiftKey);
        return;
      }

      if (e.key === "Escape") {
        this.onEscape?.();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.body.classList.toggle("sidebar-hidden");
        document.getElementById("btn-toggle-sidebar")?.classList.toggle(
          "active",
          document.body.classList.contains("sidebar-hidden")
        );
        this.stage.resize();
        return;
      }

      if (active?.tagName === "SELECT") return;
      const key = e.key.toLowerCase();

      if (key === "e") {
        store.setViewMode(store.viewMode === "mix" ? "eq" : "mix");
        return;
      }

      const sel = store.getSelectedTracks();
      if (key === "m" && sel.length > 0) {
        store.pushHistory(store.captureSnapshot());
        const nextMute = !sel.every((i) => i.mute);
        for (const t of sel) await abletonService.setMute(t, nextMute, false);
      } else if (key === "s" && sel.length > 0) {
        store.pushHistory(store.captureSnapshot());
        const nextSolo = !sel.every((i) => i.solo);
        for (const t of sel) await abletonService.setSolo(t, nextSolo, false);
      } else if (key === "u") {
        const soloed = store.tracks.filter((t) => t.solo);
        if (soloed.length > 0) {
          store.pushHistory(store.captureSnapshot());
          for (const t of soloed) await abletonService.setSolo(t, false, false);
        }
      }
    });
  }
  showDragTooltip(html, screenX, screenY) {
    if (!this.dragTooltipEl) return;
    this.dragTooltipEl.innerHTML = html;
    this.dragTooltipEl.classList.remove("hidden");
    const rect = this.stage.viewportEl.getBoundingClientRect();
    const tw = this.dragTooltipEl.offsetWidth || 180;
    const th = this.dragTooltipEl.offsetHeight || 28;
    const lx = clamp(screenX - rect.left - tw / 2, 8, rect.width - tw - 8);
    const ly = clamp(screenY - rect.top - th - 14, 54, rect.height - th - 64);
    this.dragTooltipEl.style.left = `${lx}px`;
    this.dragTooltipEl.style.top = `${ly}px`;
  }

  showShadowTooltip(item, isYMode) {
    const orb = this.stage.orbs.get(item.id);
    if (!orb) return;
    const p = orb.mesh.position.clone();
    p.y = -HALF_H;
    p.project(this.stage.camera);
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    const sx = r.left + (p.x * 0.5 + 0.5) * r.width;
    const sy = r.top + (-p.y * 0.5 + 0.5) * r.height;

    let html;
    if (isYMode) {
      html = item.eq?.hasDevice
        ? `<b>${item.name}</b> · ${formatFreq(yToFreq(item.y))} · Tilt EQ`
        : `🔒 <b>${item.name}</b> · Eje Y solo lectura (agregá EQ Eight)`;
    } else {
      const lvl = getApparentVolumeLevel(abletonVolToDb(item.vol));
      const drrNote = store.settings.zMode === "depth"
        ? ` · DRR ${Math.round(directToReverbRatioDb(item.sendA, store.reverbInfo.decay))} dB`
        : "";
      html = `<b>${item.name}</b> · ${formatPan(item.pan)} · ${formatVolume(item.vol, store.settings.volUnit)} (L${lvl.lvl}) · Rev ${Math.round(item.sendA * 100)}%${drrNote}`;
    }
    this.showDragTooltip(html, sx, sy);
  }

  hideDragTooltip() {
    this.dragTooltipEl?.classList.add("hidden");
  }
}