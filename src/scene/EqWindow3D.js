import * as THREE from "three";
import { HALF_W, HALF_H, clamp, formatFreq } from "../engine/psychoacoustics.js";
import {
  GIBSON_EQ_STRIPS,
  EQ_X_SPAN,
  STRIP_H,
  eqGainToX,
  freqToEqY,
  stripCenterY,
  findBandsInStrip,
} from "../data/eqBands.js";
import { store } from "../store.js";
import { makeTextSprite } from "./TrackOrb.js";

const FILTER_SHORT = ["HP48", "HP12", "LS", "BELL", "NOTCH", "HS", "LP12", "LP48"];

export class EqWindow3D {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    this.stripMeshes = [];
    this.barsGroup = new THREE.Group();
    this.ghostGroup = new THREE.Group();
    this.nodesGroup = new THREE.Group();
    this.group.add(this.ghostGroup, this.barsGroup, this.nodesGroup);

    this.buildBackdrop();
    this.buildInteractiveStrips();
  }

  buildBackdrop() {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 768;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(8, 12, 22, 0.88)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rowH = canvas.height / GIBSON_EQ_STRIPS.length;

    // De arriba hacia abajo en canvas (6 -> 0)
    for (let i = 0; i < GIBSON_EQ_STRIPS.length; i++) {
      const strip = GIBSON_EQ_STRIPS[GIBSON_EQ_STRIPS.length - 1 - i];
      const y = i * rowH;

      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.035)" : "rgba(15, 23, 42, 0.25)";
      ctx.fillRect(0, y, canvas.width, rowH);

      // Acento de color al borde izquierdo
      ctx.fillStyle = strip.color;
      ctx.fillRect(0, y + 4, 8, rowH - 8);

      // Línea divisoria horizontal
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();

      // Etiqueta de frecuencia (Izquierda) y sub-banda (Derecha)
      ctx.fillStyle = "rgba(241, 245, 249, 0.86)";
      ctx.font = "700 26px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(strip.label, 24, y + rowH * 0.5);

      ctx.fillStyle = "rgba(148, 163, 184, 0.52)";
      ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(strip.sub.toUpperCase(), canvas.width - 22, y + rowH * 0.5);
    }

    // Marcas de dB verticales (-15, -10, -5, 0, +5, +10, +15)
    const cx = canvas.width / 2;
    const spanPx = (EQ_X_SPAN / HALF_W) * (canvas.width / 2);
    [-15, -10, -5, 0, 5, 10, 15].forEach((db) => {
      const x = cx + (db / 15) * spanPx;
      ctx.strokeStyle = db === 0 ? "rgba(96, 165, 250, 0.8)" : "rgba(148, 163, 184, 0.16)";
      ctx.lineWidth = db === 0 ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      ctx.fillStyle = db === 0 ? "#93c5fd" : db < 0 ? "rgba(248, 113, 113, 0.72)" : "rgba(74, 222, 128, 0.72)";
      ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(db === 0 ? "0 dB" : `${db > 0 ? "+" : ""}${db}`, x, 20);
    });

    // Encabezados Cut / Boost
    ctx.font = "800 20px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(248, 113, 113, 0.65)";
    ctx.textAlign = "left";
    ctx.fillText("◀ CUT (-)", 240, 22);
    ctx.fillStyle = "rgba(74, 222, 128, 0.65)";
    ctx.textAlign = "right";
    ctx.fillText("(+) BOOST ▶", canvas.width - 240, 22);

    const tex = new THREE.CanvasTexture(canvas);
    const bgPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, HALF_H * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    bgPlane.position.z = -0.35;
    this.group.add(bgPlane);
  }

  buildInteractiveStrips() {
    const geo = new THREE.PlaneGeometry(HALF_W * 2, STRIP_H * 0.94);
    for (let i = 0; i < GIBSON_EQ_STRIPS.length; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(GIBSON_EQ_STRIPS[i].color),
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, stripCenterY(i), 0.02);
      mesh.userData.eqStripIndex = i;
      this.group.add(mesh);
      this.stripMeshes.push(mesh);
    }
  }

  setHoveredStrip(idx) {
    this.stripMeshes.forEach((m, i) => {
      m.material.opacity = i === idx ? 0.11 : 0.0;
    });
  }

  clearGroup(grp) {
    while (grp.children.length > 0) {
      const c = grp.children[0];
      c.geometry?.dispose();
      c.material?.map?.dispose();
      c.material?.dispose();
      grp.remove(c);
    }
  }

  drawGainBar(targetGroup, stripIdx, gainDb, colorHex, opacity, zPos, barScaleY = 0.56) {
    if (Math.abs(gainDb) < 0.1) return;
    const xEnd = eqGainToX(gainDb);
    const width = Math.max(0.06, Math.abs(xEnd));
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, STRIP_H * barScaleY, 0.08),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity,
      })
    );
    mesh.position.set(xEnd / 2, stripCenterY(stripIdx), zPos);
    targetGroup.add(mesh);
  }

  sync() {
    if (!this.group.visible) return;
    this.clearGroup(this.barsGroup);
    this.clearGroup(this.ghostGroup);
    this.clearGroup(this.nodesGroup);

    const sel = store.getSelectedTracks();
    const item = sel[0];
    if (!item || !item.eq?.bound) return;

    // 1. Fantasmas de pistas en colisión ("Solar Eclipse" espectral)
    const collisions = store.mixAnalysis?.collisions || [];
    const rivalIds = new Set();
    collisions.forEach((c) => {
      if (c.a.id === item.id) rivalIds.add(c.b.id);
      if (c.b.id === item.id) rivalIds.add(c.a.id);
    });

    rivalIds.forEach((rid) => {
      const rival = store.getTrackById(rid);
      if (!rival || !rival.eq?.bound) return;
      for (let i = 0; i < GIBSON_EQ_STRIPS.length; i++) {
        const hits = findBandsInStrip(rival.eq.bands, i);
        hits.forEach(({ band }) => {
          this.drawGainBar(this.ghostGroup, i, band.gainDb, rival.colorHex, 0.28, -0.18, 0.72);
        });
      }
    });

    // 2. Barras por cada una de las 7 franjas de la pista seleccionada
    for (let i = 0; i < GIBSON_EQ_STRIPS.length; i++) {
      const hits = findBandsInStrip(item.eq.bands, i);
      hits.forEach(({ band }) => {
        const barCol = band.gainDb >= 0 ? "#22c55e" : "#ef4444";
        this.drawGainBar(this.barsGroup, i, band.gainDb, barCol, 0.65, 0.06, 0.48);
      });
    }

    // 3. Nodos reales de las 8 bandas del EQ Eight
    item.eq.bands.forEach((b) => {
      if (!b.on) return;
      const isCutFilter = b.type <= 1 || b.type >= 6 || b.type === 4;
      const x = isCutFilter ? 0 : eqGainToX(b.gainDb);
      const y = freqToEqY(b.freqHz);

      const nodeCol = isCutFilter ? "#f59e0b" : b.gainDb >= 0 ? "#4ade80" : "#f87171";
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 20, 16),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(nodeCol),
          emissive: new THREE.Color(nodeCol),
          emissiveIntensity: 0.45,
          roughness: 0.25,
        })
      );
      sphere.position.set(x, y, 0.22);
      this.nodesGroup.add(sphere);

      const fName = FILTER_SHORT[b.type] || "EQ";
      const valText = isCutFilter
        ? `[${b.bandNum}] ${fName} ${formatFreq(b.freqHz)}`
        : `[${b.bandNum}] ${formatFreq(b.freqHz)} (${b.gainDb > 0 ? "+" : ""}${b.gainDb.toFixed(1)}dB)`;

      const lbl = makeTextSprite(valText, "#ffffff", 18, true);
      lbl.scale.set(2.35, 0.56, 1);
      lbl.position.set(clamp(x + (x >= 0 ? 0.95 : -0.95), -HALF_W + 1.1, HALF_W - 1.1), y + 0.18, 0.28);
      this.nodesGroup.add(lbl);
    });
  }

  getPickableStrips() {
    return this.group.visible ? this.stripMeshes : [];
  }
}