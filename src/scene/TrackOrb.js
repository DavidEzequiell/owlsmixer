import * as THREE from "three";
import { ROLES } from "../data/roles.js";
import { store, HALF_H, clamp, panToX, volToZ, sendToZ } from "../store.js";

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

export class TrackOrb {
  constructor(item, skinScene) {
    this.item = item;
    this.group = new THREE.Group();

    // Esfera / Elipsoide principal
    const geo = new THREE.SphereGeometry(1, 32, 24);
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
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.userData.trackItem = item;
    this.group.add(this.mesh);

    // Cubo translúcido de Reverb (Visual 36 / 100 de David Gibson)
    const revGeo = new THREE.BoxGeometry(1, 1, 1);
    const revMat = new THREE.MeshBasicMaterial({
      color: skinScene.reverbCube,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.reverbCube = new THREE.Mesh(revGeo, revMat);
    this.reverbWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(revGeo),
      new THREE.LineBasicMaterial({ color: skinScene.reverbCube, transparent: true, opacity: 0.35 })
    );
    this.reverbCube.add(this.reverbWire);
    this.reverbCube.visible = false;
    this.group.add(this.reverbCube);

    // Anillo orbital para Group Buses de Ableton
    this.busOrbit = null;
    if (item.isGroup) {
      this.busOrbit = new THREE.Mesh(
        new THREE.TorusGeometry(1.28, 0.045, 10, 36),
        new THREE.MeshBasicMaterial({ color: item.colorHex, transparent: true, opacity: 0.8 })
      );
      this.busOrbit.rotation.x = Math.PI / 2.4;
      this.group.add(this.busOrbit);
    }

    // Aro dorado para pistas bloqueadas (🔒)
    this.lockRing = new THREE.Mesh(
      new THREE.RingGeometry(1.12, 1.24, 28),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.lockRing.visible = false;
    this.group.add(this.lockRing);

    // Línea vertical al piso + sombra ovalada (como en los diagramas de Gibson)
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
      new THREE.CircleGeometry(1, 28),
      new THREE.MeshBasicMaterial({ color: 0x04060b, transparent: true, opacity: 0.45, depthWrite: false })
    );
    this.shadowDisc.rotation.x = -Math.PI / 2;
    this.shadowDisc.position.y = -HALF_H + 0.015;
    this.group.add(this.shadowDisc);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.28, 24),
      new THREE.MeshBasicMaterial({ color: item.colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = -HALF_H + 0.025;
    this.group.add(this.ring);

    this.label = null;
    this.rebuildLabel();
  }

  rebuildLabel() {
    if (this.label) {
      this.label.material.map?.dispose();
      this.label.material.dispose();
      this.group.remove(this.label);
    }
    const prefix = (this.item.locked ? "🔒 " : "") + (this.item.isGroup ? "📁 " : "");
    this.label = makeTextSprite(`${prefix}${this.item.name}`, "#ffffff", 24, true);
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

  getBaseRadius() {
    const { settings } = store;
    const roleCfg = ROLES[this.item.role] || ROLES.other;
    const freqFactor = settings.freqSizing ? roleCfg.sizeFactor : 1.0;
    const volFactor = 0.28 + clamp(this.item.vol, 0, 1) * 0.56;
    const manualScale = this.item.sizeScale ?? 1.0;
    return clamp(volFactor * freqFactor * manualScale, 0.18, 2.3);
  }

  sync(camera) {
    const item = this.item;
    const { settings } = store;
    const visible = !item.hidden && !(item.isGroup && !store.showBuses);
    this.group.visible = visible;
    if (!visible) return;

    const x = panToX(item.pan);
    const z = settings.zMode === "gibson" ? volToZ(item.vol) : sendToZ(item.sendA);
    const baseR = this.getBaseRadius();

    // Evitar que las esferas gigantes de graves atraviesen el piso
    const minY = -HALF_H + (item.shape === "oblong" ? baseR * 0.55 : baseR * 0.85);
    const y = clamp(item.y, minY, HALF_H - 0.35);

    const anySolo = store.tracks.some((t) => t.solo);
    const isSilent = item.mute || (anySolo && !item.solo);
    const isSelected = store.selectedIds.has(item.id);
    const pulse = 1 + (isSilent ? 0 : item.smoothMeter * 0.24);

    this.mesh.position.set(x, y, z);

    // Forma Esfera vs Elipsoide Stereo/Fattening (Visual 29, p. 52)
    let rx = baseR * pulse;
    let ry = baseR * pulse;
    let rz = baseR * pulse;
    if (item.shape === "oblong") {
      rx = Math.min(4.6, baseR * 2.45 * pulse);
      ry = baseR * 0.56 * pulse;
      rz = baseR * 0.72 * pulse;
    }
    this.mesh.scale.set(rx, ry, rz);

    // Cubo translúcido de Reverb (Visual 36 / 100)
    const showRev = settings.showReverbCubes && item.sendA > 0.04 && !isSilent;
    this.reverbCube.visible = showRev;
    if (showRev) {
      const decayBoost = 0.75 + store.reverbInfo.decay * 0.9;
      const revW = Math.min(9.6, rx * 2.1 + item.sendA * 4.5);
      const revH = Math.min(5.6, ry * 2.0 + item.sendA * 2.2);
      const revD = Math.min(7.4, rz * 2.0 + item.sendA * 3.8 * decayBoost);
      this.reverbCube.position.set(x, y, z - revD * 0.18);
      this.reverbCube.scale.set(revW, revH, revD);
      this.reverbCube.material.opacity = clamp(0.06 + item.sendA * 0.16, 0.05, 0.24);
      this.reverbWire.material.opacity = clamp(0.15 + item.sendA * 0.35, 0.15, 0.55);
    }

    if (this.busOrbit) {
      this.busOrbit.position.set(x, y, z);
      this.busOrbit.scale.setScalar(baseR * pulse);
      this.busOrbit.material.opacity = isSilent ? 0.15 : 0.85;
    }

    this.lockRing.visible = item.locked;
    if (item.locked) {
      this.lockRing.position.set(x, y, z);
      this.lockRing.scale.setScalar(Math.max(rx, ry) * 1.05);
      if (camera) this.lockRing.lookAt(camera.position);
    }

    // Drop line y sombra en el piso
    const posAttr = this.dropLine.geometry.attributes.position;
    posAttr.setXYZ(0, x, y, z);
    posAttr.setXYZ(1, x, -HALF_H, z);
    posAttr.needsUpdate = true;

    this.shadowDisc.position.set(x, -HALF_H + 0.015, z);
    this.shadowDisc.scale.set(rx * 0.95, rz * 0.95, 1);
    this.shadowDisc.material.opacity = isSilent ? 0.12 : 0.48;

    this.ring.position.set(x, -HALF_H + 0.025, z);
    this.label.position.set(x, y + ry + 0.38, z);

    // Estados visuales Mute / Solo / Selección
    this.mesh.material.wireframe = item.mute;
    this.mesh.material.opacity = item.mute ? 0.24 : isSilent ? 0.18 : 0.88;
    this.dropLine.material.opacity = isSilent ? 0.07 : (isSelected ? 0.72 : 0.35);
    this.ring.material.opacity = isSilent ? 0.12 : (isSelected ? 0.9 : 0.55);
    this.label.material.opacity = isSilent ? 0.30 : 1.0;

    const baseGlow = item.solo ? 0.78 : (isSelected ? 0.58 : 0.20);
    this.mesh.material.emissiveIntensity = isSilent ? 0.05 : baseGlow + item.smoothMeter * 0.42;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.reverbCube.geometry.dispose();
    this.reverbCube.material.dispose();
    this.dropLine.geometry.dispose();
    this.dropLine.material.dispose();
    this.shadowDisc.geometry.dispose();
    this.shadowDisc.material.dispose();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
    this.lockRing.geometry.dispose();
    this.lockRing.material.dispose();
    if (this.busOrbit) {
      this.busOrbit.geometry.dispose();
      this.busOrbit.material.dispose();
    }
    if (this.label) {
      this.label.material.map?.dispose();
      this.label.material.dispose();
    }
  }
}