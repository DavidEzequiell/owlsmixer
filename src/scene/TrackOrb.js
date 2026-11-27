import * as THREE from "three";
import { ROLES, getRoleIconKey } from "../data/roles.js";
import { loadRoleIconImage } from "../data/roleIcons.js";
import { store, HALF_H, clamp, panToX, volToZ, sendToZ } from "../store.js";
import {
  HALF_W, HALF_D, computePsychoRadius, computeTrueDepthZ, abletonMeterToDb,
} from "../engine/psychoacoustics.js";

const ORB_GEO_SPECS = {
  performance: { sphereW: 16, sphereH: 12, circle: 16, ring: 16, lock: 18, torusR: 8,  torusT: 22 },
  balanced:    { sphereW: 28, sphereH: 20, circle: 24, ring: 24, lock: 24, torusR: 10, torusT: 32 },
  ultra:       { sphereW: 48, sphereH: 36, circle: 36, ring: 32, lock: 36, torusR: 14, torusT: 48 },
};

// Umbral en dBFS para considerar que una pista tiene señal musical real (filtra noise floor de amplis ~-45 dBFS)
const SILENCE_GATE_DB = -38;

const sharedGeoPools = new Map();
let sharedReverbBoxGeo = null;
let sharedReverbEdgesGeo = null;

function getSharedReverbGeos() {
  if (!sharedReverbBoxGeo) {
    sharedReverbBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    sharedReverbEdgesGeo = new THREE.EdgesGeometry(sharedReverbBoxGeo);
  }
  return { box: sharedReverbBoxGeo, edges: sharedReverbEdgesGeo };
}

function getSharedOrbGeos(qualityKey = "balanced") {
  const key = ORB_GEO_SPECS[qualityKey] ? qualityKey : "balanced";
  if (sharedGeoPools.has(key)) return sharedGeoPools.get(key);

  const s = ORB_GEO_SPECS[key];
  const pool = {
    sphere:    new THREE.SphereGeometry(1, s.sphereW, s.sphereH),
    shadow:    new THREE.CircleGeometry(1, s.circle),
    ring:      new THREE.RingGeometry(0.18, 0.28, s.ring),
    lockRing:  new THREE.RingGeometry(1.12, 1.24, s.lock),
    busOrbit:  new THREE.TorusGeometry(1.28, 0.045, s.torusR, s.torusT),
    carveRing: new THREE.TorusGeometry(1.10, 0.028, 8, s.torusT),
  };
  sharedGeoPools.set(key, pool);
  return pool;
}

export function disposeUnusedOrbGeometryPools(activeQualityKey = "balanced") {
  const keepKey = ORB_GEO_SPECS[activeQualityKey] ? activeQualityKey : "balanced";
  for (const [key, pool] of sharedGeoPools.entries()) {
    if (key === keepKey) continue;
    pool.sphere.dispose();
    pool.shadow.dispose();
    pool.ring.dispose();
    pool.lockRing.dispose();
    pool.busOrbit.dispose();
    pool.carveRing.dispose();
    sharedGeoPools.delete(key);
  }
}

// Etiqueta estándar usada por Stage3D / EqWindow3D (ejes, LEFT/RIGHT, bandas)
export function makeTextSprite(text, textColor = "#ffffff", fontSize = 24, withBg = true) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 128;
  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  const boxW = Math.min(canvas.width - 16, metrics.width + 44);
  const boxH = fontSize + 24;

  if (withBg) {
    ctx.fillStyle = "rgba(11, 15, 25, 0.80)";
    ctx.strokeStyle = "rgba(100, 116, 139, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect((canvas.width - boxW) / 2, (canvas.height - boxH) / 2, boxW, boxH, 16);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.8, 0.7, 1);
  return sprite;
}

// Sprite estilo "The Art of Mixing" centrado sobre la cara frontal de la esfera:
// renderiza SVG vectorial y/o tipografía limpia con contorno suave (sin caja negra)
function drawOrbFaceCanvas(canvas, { iconImg, name, showIcons, showNames, locked }) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const drawCleanText = (txt, x, y, maxW, fontPx) => {
    let size = fontPx;
    ctx.font = `800 ${size}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
    while (size > 24 && ctx.measureText(txt).width > maxW) {
      size -= 2;
      ctx.font = `800 ${size}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(5, Math.round(size * 0.16));
    ctx.strokeStyle = "rgba(6, 10, 18, 0.88)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = 8;
    ctx.strokeText(txt, x, y, maxW);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(txt, x, y, maxW);
  };

  const drawVectorIcon = (cx, cy, size) => {
    if (!iconImg) return;
    ctx.save();
    ctx.shadowColor = "rgba(4, 8, 16, 0.90)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(iconImg, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
  };

  const labelTxt = (locked ? "🔒 " : "") + String(name || "").trim();

  if (showIcons && !showNames) {
    drawVectorIcon(w / 2, h / 2, Math.min(w, h) * 0.68);
    if (locked) {
      ctx.font = "700 32px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText("🔒", w - 18, 14);
    }
  } else if (!showIcons && showNames) {
    drawCleanText(labelTxt, w / 2, h / 2, w - 32, 54);
  } else if (showIcons && showNames) {
    drawVectorIcon(w / 2, h * 0.36, 104);
    drawCleanText(labelTxt, w / 2, h * 0.77, w - 32, 42);
  }
}

function createOrbFaceSprite({ iconKey, name, showIcons, showNames, locked, isStillCurrent }) {
  const iconOnly = showIcons && !showNames;
  const textOnly = !showIcons && showNames;

  const canvas = document.createElement("canvas");
  canvas.width = iconOnly ? 256 : 512;
  canvas.height = iconOnly ? 256 : textOnly ? 160 : 240;

  drawOrbFaceCanvas(canvas, { iconImg: null, name, showIcons, showNames, locked });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 2;
  sprite.userData._aspect = canvas.width / canvas.height;
  sprite.userData._mode = iconOnly ? "icon" : textOnly ? "text" : "both";

  if (showIcons) {
    loadRoleIconImage(iconKey).then((img) => {
      if (typeof isStillCurrent === "function" && !isStillCurrent(sprite)) return;
      drawOrbFaceCanvas(canvas, { iconImg: img, name, showIcons, showNames, locked });
      tex.needsUpdate = true;
    }).catch(() => {});
  }

  return sprite;
}

export class TrackOrb {
  constructor(item, skinScene, qualityKey = "balanced") {
    this.item = item;
    this.group = new THREE.Group();
    this._lastDropX = NaN;
    this._lastDropY = NaN;
    this._lastDropZ = NaN;

    const geos = getSharedOrbGeos(qualityKey);
    const revGeos = getSharedReverbGeos();

    // Esfera / Elipsoide principal (geometría compartida por nivel de calidad)
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(item.colorHex),
      emissive: new THREE.Color(item.colorHex),
      emissiveIntensity: 0.22,
      roughness: skinScene.sphereRoughness,
      metalness: skinScene.sphereMetalness,
      flatShading: skinScene.sphereFlatShading,
      transparent: true,
      opacity: 0.9,
    });
    this.mesh = new THREE.Mesh(geos.sphere, mat);
    this.mesh.userData.trackItem = item;
    this.group.add(this.mesh);

    // Cubo translúcido de Reverb (Visual 36 / 100 de David Gibson)
    const revMat = new THREE.MeshBasicMaterial({
      color: skinScene.reverbCube,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.reverbCube = new THREE.Mesh(revGeos.box, revMat);
    this.reverbWire = new THREE.LineSegments(
      revGeos.edges,
      new THREE.LineBasicMaterial({ color: skinScene.reverbCube, transparent: true, opacity: 0.35 })
    );
    this.reverbCube.add(this.reverbWire);
    this.reverbCube.visible = false;
    this.group.add(this.reverbCube);

    // Anillo orbital para Group Buses de Ableton
    this.busOrbit = null;
    if (item.isGroup) {
      this.busOrbit = new THREE.Mesh(
        geos.busOrbit,
        new THREE.MeshBasicMaterial({ color: item.colorHex, transparent: true, opacity: 0.8 })
      );
      this.busOrbit.rotation.x = Math.PI / 2.4;
      this.group.add(this.busOrbit);
    }

    // Aro dorado para pistas bloqueadas (🔒)
    this.lockRing = new THREE.Mesh(
      geos.lockRing,
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.lockRing.visible = false;
    this.group.add(this.lockRing);

    // Aro cian/menta discreto para pistas esculpidas con Priorizar (EQ carving / Duck)
    this.carveRing = new THREE.Mesh(
      geos.carveRing,
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.35, depthWrite: false })
    );
    this.carveRing.rotation.x = Math.PI / 2.2;
    this.carveRing.rotation.y = 0.35;
    this.carveRing.visible = false;
    this.group.add(this.carveRing);

    // Línea vertical al piso + sombra ovalada (geometría propia para actualizar posición)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -HALF_H, 0),
    ]);
    this.dropLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: item.colorHex, transparent: true, opacity: 0.38 })
    );
    this.group.add(this.dropLine);

    this.shadowDisc = new THREE.Mesh(
      geos.shadow,
      new THREE.MeshBasicMaterial({ color: 0x04060b, transparent: true, opacity: 0.45, depthWrite: false })
    );
    this.shadowDisc.rotation.x = -Math.PI / 2;
    this.shadowDisc.position.y = -HALF_H + 0.015;
    this.group.add(this.shadowDisc);

    this.ring = new THREE.Mesh(
      geos.ring,
      new THREE.MeshBasicMaterial({ color: item.colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = -HALF_H + 0.025;
    this.group.add(this.ring);

    this._wasPlaying = false;
    this._lastAudibleAt = 0;
    this._silenceVis = 1.0;
    this._lastLabelKey = "";
    this.label = null;
    this.rebuildLabel();
  }

  applyQuality(qualityKey = "balanced") {
    const geos = getSharedOrbGeos(qualityKey);
    this.mesh.geometry = geos.sphere;
    this.shadowDisc.geometry = geos.shadow;
    this.ring.geometry = geos.ring;
    this.lockRing.geometry = geos.lockRing;
    this.carveRing.geometry = geos.carveRing;
    if (this.busOrbit) this.busOrbit.geometry = geos.busOrbit;
  }

  rebuildLabel() {
    const showIcons = store.settings.showTrackIcons !== false;
    const showNames = store.settings.showTrackNames !== false;
    const iconKey = getRoleIconKey(this.item.role, this.item.isGroup);
    const nextKey = `${showIcons ? 1 : 0}|${showNames ? 1 : 0}|${iconKey}|${this.item.locked ? 1 : 0}|${this.item.isGroup ? 1 : 0}|${this.item.name}`;

    if (this._lastLabelKey === nextKey && (this.label || (!showIcons && !showNames))) return;
    this._lastLabelKey = nextKey;

    if (this.label) {
      this.label.material.map?.dispose();
      this.label.material.dispose();
      this.group.remove(this.label);
      this.label = null;
    }

    if (!showIcons && !showNames) return;

    this.label = createOrbFaceSprite({
      iconKey,
      name: this.item.name,
      showIcons,
      showNames,
      locked: this.item.locked,
      isStillCurrent: (sp) => this.label === sp,
    });
    this.group.add(this.label);
  }

  applySkin(skinScene) {
    this.mesh.material.roughness = skinScene.sphereRoughness;
    this.mesh.material.metalness = skinScene.sphereMetalness;
    this.mesh.material.flatShading = skinScene.sphereFlatShading;
    this.mesh.material.needsUpdate = true;
    this.reverbCube.material.color.setHex(skinScene.reverbCube);
    this.reverbWire.material.color.setHex(skinScene.reverbCube);
  }

  updateColor(hex) {
    const col = new THREE.Color(hex);
    this.mesh.material.color.copy(col);
    this.mesh.material.emissive.copy(col);
    this.dropLine.material.color.copy(col);
    this.ring.material.color.copy(col);
    if (this.busOrbit) this.busOrbit.material.color.copy(col);
  }

  getBaseRadius() {
    const roleCfg = ROLES[this.item.role] || ROLES.other;
    return computePsychoRadius(this.item, {
      freqSizing: store.settings.freqSizing,
      roleSizeFactor: roleCfg.sizeFactor,
      autoSize: store.settings.autoSize,
      lowCutScale: this.item._eqLowCutScale ?? 1.0,
    });
  }

  getLogicalZ() {
    const zMode = store.settings.zMode;
    if (zMode === "spatial") return sendToZ(this.item.sendA);
    if (zMode === "depth") {
      return computeTrueDepthZ(this.item.vol, this.item.sendA, store.reverbInfo.decay);
    }
    return volToZ(this.item.vol);
  }

  sync(camera, anySoloOverride = null) {
    const item = this.item;
    const { settings } = store;
    const baseVisible = store.viewMode === "mix" && !item.hidden && !(item.isGroup && !store.showBuses);
    if (!baseVisible) {
      this.group.visible = false;
      item._isSilentHidden = false;
      return;
    }

    const now = performance.now();
    const isSelected = store.selectedIds.has(item.id);
    const isPlaying = Boolean(store.isPlaying);

    // Auto-ocultar / desvanecer pistas sin clip activo ni señal musical durante Play
    if (settings.autoFadeSilent && isPlaying) {
      if (!this._wasPlaying) {
        this._lastAudibleAt = now - 1150;
      }

      // 1) Si tiene clips en Arrangement y no está monitoreando en vivo (In o Auto+Arm), chequear timeline primero
      const hasArrClips = Array.isArray(item.clipRanges) && item.clipRanges.length > 0;
      const hasSessionClip = (item.playingSlotIndex ?? -1) >= 0;
      const isLiveMonitoring =
        item.monitoringState === 0 || (item.monitoringState === 1 && Boolean(item.armed));

      let inTimelineClip = true;
      if (hasArrClips && !hasSessionClip && !isLiveMonitoring) {
        const beat = store.currentSongBeat || 0;
        inTimelineClip = item.clipRanges.some((r) => beat >= r.start - 0.15 && beat <= r.end + 1.0);
      }

      if (isSelected || item.isDragging) {
        this._lastAudibleAt = now;
        this._silenceVis = Math.min(1, this._silenceVis + (1 - this._silenceVis) * 0.40 + 0.06);
      } else if (!inTimelineClip) {
        // Fuera de todo clip del Arrangement: desvanecimiento rápido (~0.2 s) sin mirar noise floor de amplis
        this._silenceVis = Math.max(0, this._silenceVis - 0.09);
      } else {
        // Dentro de un clip (o pista ruteada en In como EZDrummer): gate real en dBFS (> -38 dBFS)
        const meterDb = abletonMeterToDb(Math.max(item.meter || 0, item.smoothMeter || 0));
        const hasAudio = Number.isFinite(meterDb) && meterDb > SILENCE_GATE_DB;
        if (hasAudio) {
          this._lastAudibleAt = now;
          this._silenceVis = Math.min(1, this._silenceVis + (1 - this._silenceVis) * 0.40 + 0.06);
        } else {
          const silentMs = now - this._lastAudibleAt;
          if (silentMs <= 1400) {
            this._silenceVis = Math.min(1, this._silenceVis + 0.08);
          } else {
            this._silenceVis = clamp(1 - (silentMs - 1400) / 700, 0, 1);
          }
        }
      }
    } else {
      this._lastAudibleAt = now;
      this._silenceVis = 1.0;
    }
    this._wasPlaying = isPlaying;

    const silenceFade = this._silenceVis;
    if (silenceFade <= 0.01) {
      this.group.visible = false;
      item._isSilentHidden = true;
      return;
    }
    item._isSilentHidden = false;
    this.group.visible = true;

    // Mantener etiqueta/icono sincronizado con settings, rol, nombre o bloqueo
    this.rebuildLabel();

    const rawX = panToX(item.pan);
    const rawZ = this.getLogicalZ();
    const baseR = this.getBaseRadius();

    const anySolo = anySoloOverride !== null ? anySoloOverride : store.tracks.some((t) => t.solo);
    const isSilent = item.mute || (anySolo && !item.solo);
    const pulse = 1 + (isSilent ? 0 : item.smoothMeter * 0.22);
    const fadeScale = 0.78 + 0.22 * silenceFade;

    // Forma Esfera vs Elipsoide Stereo/Fattening (Visual 29, p. 52), contenido a escala realista
    let rx = baseR * pulse * fadeScale;
    let ry = baseR * pulse * fadeScale;
    let rz = baseR * pulse * fadeScale;
    if (item.shape === "oblong") {
      rx = Math.min(2.6, baseR * 1.75 * pulse) * fadeScale;
      ry = baseR * 0.56 * pulse * fadeScale;
      rz = baseR * 0.68 * pulse * fadeScale;
    }

    // Contención limpia dentro de la caja wireframe (sin atravesar paredes, piso ni techo)
    const padX = Math.min(rx, HALF_W * 0.65);
    const padY = Math.min(ry, HALF_H * 0.72);
    const padZ = Math.min(rz, HALF_D * 0.65);
    const x = clamp(rawX, -HALF_W + padX, HALF_W - padX);
    const y = clamp(item.y, -HALF_H + padY, HALF_H - padY);
    const z = clamp(rawZ, -HALF_D + padZ, HALF_D - padZ);

    this.mesh.position.set(x, y, z);
    this.mesh.scale.set(rx, ry, rz);

    // Cubo translúcido de Reverb (Visual 36 / 100), contenido dentro de la caja
    const showRev = settings.showReverbCubes && item.sendA > 0.04 && !isSilent;
    this.reverbCube.visible = showRev;
    if (showRev) {
      const decayBoost = 0.75 + store.reverbInfo.decay * 0.9;
      const revW = Math.min(HALF_W * 1.9, rx * 2.05 + item.sendA * 3.6);
      const revH = Math.min(HALF_H * 1.85, ry * 1.95 + item.sendA * 1.9);
      const revD = Math.min(HALF_D * 1.85, rz * 1.95 + item.sendA * 3.2 * decayBoost);
      const revX = clamp(x, -HALF_W + revW * 0.5, HALF_W - revW * 0.5);
      const revY = clamp(y, -HALF_H + revH * 0.5, HALF_H - revH * 0.5);
      const revZ = clamp(z - revD * 0.16, -HALF_D + revD * 0.5, HALF_D - revD * 0.5);
      this.reverbCube.position.set(revX, revY, revZ);
      this.reverbCube.scale.set(revW, revH, revD);
      this.reverbCube.material.opacity = clamp(0.06 + item.sendA * 0.15, 0.05, 0.22) * silenceFade;
      this.reverbWire.material.opacity = clamp(0.15 + item.sendA * 0.32, 0.15, 0.50) * silenceFade;
    }

    if (this.busOrbit) {
      this.busOrbit.position.set(x, y, z);
      this.busOrbit.scale.setScalar(baseR * pulse * fadeScale);
      this.busOrbit.material.opacity = (isSilent ? 0.15 : 0.85) * silenceFade;
    }

    this.lockRing.visible = item.locked;
    if (item.locked) {
      this.lockRing.position.set(x, y, z);
      this.lockRing.scale.setScalar(Math.max(rx, ry) * 1.05);
      this.lockRing.material.opacity = 0.85 * silenceFade;
      if (camera) this.lockRing.lookAt(camera.position);
    }

    // Reflejo visual 3D de Priorizar (pulso cian/menta al recortar + aro discreto persistente)
    const carveAge = item._lastCarve ? now - item._lastCarve.at : Infinity;
    const isFreshCarve = carveAge >= 0 && carveAge < 2200;
    const hasActiveCarve =
      (Array.isArray(item.eqCuts) && item.eqCuts.length > 0) ||
      (item.dynamics?.duckSteps || 0) > 0;
    const showCarveRing = !isSilent && (isFreshCarve || hasActiveCarve);
    this.carveRing.visible = showCarveRing;
    let carveFlashBoost = 0;

    if (showCarveRing) {
      this.carveRing.position.set(x, y, z);
      if (isFreshCarve) {
        const t = carveAge / 2200;
        const wave = Math.sin(t * Math.PI * 3) * (1 - t);
        const expand = 1.06 + Math.abs(wave) * 0.28;
        this.carveRing.scale.set(rx * expand, rz * expand, ry * expand);
        this.carveRing.material.opacity = clamp(0.36 + (1 - t) * 0.60, 0.32, 0.96) * silenceFade;
        carveFlashBoost = (1 - t) * 0.35;
      } else {
        this.carveRing.scale.set(rx * 1.02, rz * 1.02, ry * 1.02);
        this.carveRing.material.opacity = (isSelected ? 0.52 : 0.30) * silenceFade;
      }
    }

    // Drop line, aro guía y sombra en el piso (solo sube buffer GPU si cambió la posición)
    const showShadows = settings.showFloorShadows !== false && settings.graphicsQuality !== "performance";
    const showGuides = settings.showDropLines !== false;

    this.dropLine.visible = showGuides;
    if (
      showGuides &&
      (Math.abs(x - this._lastDropX) > 0.0005 ||
        Math.abs(y - this._lastDropY) > 0.0005 ||
        Math.abs(z - this._lastDropZ) > 0.0005)
    ) {
      const posAttr = this.dropLine.geometry.attributes.position;
      posAttr.setXYZ(0, x, y, z);
      posAttr.setXYZ(1, x, -HALF_H, z);
      posAttr.needsUpdate = true;
      this._lastDropX = x;
      this._lastDropY = y;
      this._lastDropZ = z;
    }

    this.shadowDisc.visible = showShadows;
    if (showShadows) {
      this.shadowDisc.position.set(x, -HALF_H + 0.015, z);
      this.shadowDisc.scale.set(rx * 0.95, rz * 0.95, 1);
      this.shadowDisc.material.opacity = (isSilent ? 0.12 : 0.48) * silenceFade;
    }

    this.ring.visible = showGuides;
    if (showGuides) {
      this.ring.position.set(x, -HALF_H + 0.025, z);
    }

    if (this.label) {
      // Posicionar centrado sobre la cara frontal del elipsoide mirando hacia la cámara
      let dx = 0;
      let dy = 0;
      let dz = 1;
      if (camera) {
        dx = camera.position.x - x;
        dy = camera.position.y - y;
        dz = camera.position.z - z;
        const len = Math.hypot(dx, dy, dz);
        if (len > 1e-4) {
          dx /= len;
          dy /= len;
          dz /= len;
        }
      }

      const safeRx = Math.max(0.12, rx);
      const safeRy = Math.max(0.12, ry);
      const safeRz = Math.max(0.12, rz);
      const invEllip = Math.sqrt((dx / safeRx) ** 2 + (dy / safeRy) ** 2 + (dz / safeRz) ** 2);
      const surfaceDist = invEllip > 1e-4 ? 1 / invEllip : safeRx;
      const frontOffset = surfaceDist + 0.08;

      this.label.position.set(x + dx * frontOffset, y + dy * frontOffset, z + dz * frontOffset);

      // Escalar proporcionalmente a la esfera/elipsoide con mínimos legibles
      const mode = this.label.userData._mode;
      const aspect = this.label.userData._aspect || 1;
      if (mode === "icon") {
        const s = clamp(Math.min(rx, ry) * 1.18, 0.48, 1.45);
        this.label.scale.set(s, s, 1);
      } else if (mode === "text") {
        const w = clamp(rx * 1.95, 1.25, 2.85);
        this.label.scale.set(w, w / aspect, 1);
      } else {
        const w = clamp(Math.min(rx * 1.85, ry * 2.4), 1.15, 2.55);
        this.label.scale.set(w, w / aspect, 1);
      }

      this.label.material.opacity = (isSilent ? 0.30 : 1.0) * silenceFade;
    }

    // Estados visuales Mute / Solo / Selección / Recorte / Silencio
    this.mesh.material.wireframe = item.mute;
    this.mesh.material.opacity = (item.mute ? 0.24 : isSilent ? 0.18 : 0.88) * silenceFade;
    this.dropLine.material.opacity = (isSilent ? 0.07 : (isSelected ? 0.72 : 0.35)) * silenceFade;
    this.ring.material.opacity = (isSilent ? 0.12 : (isSelected ? 0.9 : 0.55)) * silenceFade;

    const baseGlow = item.solo ? 0.78 : (isSelected ? 0.58 : 0.20);
    this.mesh.material.emissiveIntensity = isSilent ? 0.05 : baseGlow + item.smoothMeter * 0.42 + carveFlashBoost;
  }

  // Libera únicamente materiales/buffers exclusivos de esta pista (nunca las geometrías compartidas)
  dispose() {
    this.mesh.material.dispose();
    this.reverbCube.material.dispose();
    this.reverbWire.material.dispose();
    this.dropLine.geometry.dispose();
    this.dropLine.material.dispose();
    this.shadowDisc.material.dispose();
    this.ring.material.dispose();
    this.lockRing.material.dispose();
    this.carveRing.material.dispose();
    if (this.busOrbit) {
      this.busOrbit.material.dispose();
    }
    if (this.label) {
      this.label.material.map?.dispose();
      this.label.material.dispose();
    }
  }
}