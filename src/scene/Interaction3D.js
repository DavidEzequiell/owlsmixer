import * as THREE from "three";
import { store, HALF_H, clamp, xToPan, zToVol, zToSend } from "../store.js";
import { abletonService } from "../services/abletonService.js";

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

    this.wheelBeforeSnapshot = null;
    this.wheelHistoryTimer = null;

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

  bindEvents() {
    const dom = this.stage.renderer.domElement;

    dom.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const hit = this.raycast(e);
      if (!hit) return;

      const item = hit.object.userData.trackItem;
      if (!item || item.locked) return;

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
      this.dragModeY = e.shiftKey;
      this.dragMoved = false;
      this.dragBeforeSnapshot = store.captureSnapshot();
      this.stage.controls.enabled = false;

      if (this.dragModeY) {
        const camDir = new THREE.Vector3();
        this.stage.camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();
        this.dragPlane.setFromNormalAndCoplanarPoint(camDir, hit.object.position);
      } else {
        this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hit.object.position);
      }

      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragHit)) {
        this.dragStartWorld.copy(this.dragHit);
      }

      this.dragBaseStates = targets.map((tItem) => {
        tItem.isDragging = true;
        const orb = this.stage.orbs.get(tItem.id);
        return {
          item: tItem,
          y: tItem.y,
          startPos: orb ? orb.mesh.position.clone() : new THREE.Vector3(),
        };
      });
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.draggingPrimary) {
        const hit = this.raycast(e);
        dom.style.cursor = hit ? "grab" : "default";
        return;
      }

      dom.style.cursor = "grabbing";
      this.updatePointer(e);
      this.raycaster.setFromCamera(this.pointer, this.stage.camera);

      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragHit)) {
        const delta = this.dragHit.clone().sub(this.dragStartWorld);
        if (delta.lengthSq() > 0.0004) this.dragMoved = true;

        const isGibsonZ = store.settings.zMode === "gibson";

        for (const st of this.dragBaseStates) {
          if (this.dragModeY) {
            st.item.y = clamp(st.y + delta.y, -HALF_H + 0.3, HALF_H - 0.3);
          } else {
            const nx = st.startPos.x + delta.x;
            const nz = st.startPos.z + delta.z;
            st.item.pan = xToPan(nx);
            st.item._ableton.setPanLive(st.item.pan);

            if (isGibsonZ) {
              st.item.vol = zToVol(nz);
              st.item._ableton.setVolLive(st.item.vol);
            } else {
              st.item.sendA = zToSend(nz);
              st.item._ableton.setSendALive(st.item.sendA);
            }
          }
          this.stage.updateOrb(st.item);
        }
        store.emit("track-changed", this.draggingPrimary);
      }
    });

    window.addEventListener("pointerup", () => {
      if (!this.draggingPrimary) return;
      for (const st of this.dragBaseStates) {
        st.item._ableton.setPanLive(st.item.pan, true);
        st.item._ableton.setVolLive(st.item.vol, true);
        st.item._ableton.setSendALive(st.item.sendA, true);
        st.item.isDragging = false;
      }
      if (this.dragMoved && this.dragBeforeSnapshot) {
        store.pushHistory(this.dragBeforeSnapshot);
      }
      this.dragBeforeSnapshot = null;
      this.dragBaseStates = [];
      this.draggingPrimary = null;
      this.stage.controls.enabled = true;
      dom.style.cursor = "default";
    });

    // Rueda sobre una esfera: modifica el eje secundario (Reverb en modo Gibson, Volumen en modo Espacial)
    dom.addEventListener("wheel", (e) => {
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
      const isGibsonZ = store.settings.zMode === "gibson";

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

    // Atajos globales de teclado
    window.addEventListener("keydown", async (e) => {
      const active = document.activeElement;
      const isTyping =
        active &&
        ((active.tagName === "INPUT" && ["text", "search", "number"].includes(active.type)) ||
          active.tagName === "TEXTAREA");
      if (isTyping) return;

      // Ctrl+Z / Ctrl+Y (Undo / Redo)
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) {
          e.preventDefault();
          this.onUndo?.();
          return;
        }
        if (k === "y" || (k === "z" && e.shiftKey)) {
          e.preventDefault();
          this.onRedo?.();
          return;
        }
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

      if (active?.tagName === "SELECT") return;
      const key = e.key.toLowerCase();
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
}